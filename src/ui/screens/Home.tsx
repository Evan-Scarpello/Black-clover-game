// The Black Bulls hideout base map: an illustrated town you scroll through, with a landmark
// for every feature page in the registry, the Grimoire Tower (Summon), the campaign gate,
// your squad idling outside, an event rail and a dock with the AFK chest + next battle.
import type { ComponentChildren } from 'preact';
import { memo } from 'preact/compat';
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CharacterArt } from '../../art/CharacterArt';
import { getStage } from '../../data/campaign';
import { getHero } from '../../data/heroes';
import { teamPower } from '../../game/power';
import { BONUS_QUEST, DAILY_QUESTS, claimable } from '../../game/quests';
import type { SaveState } from '../../game/state';
import { fmt } from '../../game/stats';
import { afkPending, playerTeam, useGame } from '../../game/store';
import { toast } from '../components/common';
import { haptic } from '../haptics';
import { AfkModal, CHEST_READY_HOURS, ChestArt, DockChest } from '../hub/AfkChest';
import { Backdrop, LAMPS } from '../hub/Backdrop';
import { ART_RATIO, FloatingGrimoire, LandmarkArt, Pennant, SCREEN_ART, type ArtKind } from '../hub/art';
import { HIDEOUT_SPOT, MAP_W, SQUAD_XS, SQUAD_Y, SUMMON_SPOT, layoutHub } from '../hub/layout';
import '../hub/hub.css';
import { unlockText } from '../motion';
import type { Nav, ScreenDef, ScreenId } from '../nav';
import { sfx } from '../sfx';
import { SCREENS, SCREEN_MAP } from './registry';

/** Sky trimmed off the top of the map (map units) so the town starts higher on screen. */
const CROP = 70;

function safeBadge(d: ScreenDef | undefined, s: SaveState): boolean {
  if (!d?.badge) return false;
  try {
    return !!d.badge(s);
  } catch {
    return false;
  }
}

// ───────── geometry helpers (map units → % of the map box) ─────────

interface Frame {
  h: number;
}
const px = (x: number) => `${((x / MAP_W) * 100).toFixed(3)}%`;
const py = (f: Frame, y: number) => `${(((y - CROP) / (f.h - CROP)) * 100).toFixed(3)}%`;

// ───────── decorations that animate on top of the static art ─────────

type Deco = { t: 'flag' | 'glow' | 'spark'; x: number; y: number; c?: string };
const DECO: Partial<Record<ArtKind, Deco[]>> = {
  arena: [
    { t: 'flag', x: 12, y: 4, c: '#e63946' },
    { t: 'flag', x: 88, y: 4, c: '#ffc531' },
  ],
  clan: [{ t: 'flag', x: 50, y: 2, c: '#b46bff' }],
  pass: [{ t: 'flag', x: 50, y: 1, c: '#ffc531' }],
  hideout: [{ t: 'flag', x: 50, y: -10, c: '#c62828' }],
  trials: [
    { t: 'glow', x: 50, y: 36, c: '#ff4b5c' },
    { t: 'glow', x: 50, y: 72, c: '#ff4b5c' },
  ],
  gate: [
    { t: 'glow', x: 20, y: 45, c: '#ffd36b' },
    { t: 'glow', x: 80, y: 45, c: '#ffd36b' },
  ],
  market: [{ t: 'spark', x: 62, y: 56 }],
  trophy: [{ t: 'spark', x: 50, y: 22 }],
  post: [{ t: 'spark', x: 54, y: 36 }],
  missions: [{ t: 'spark', x: 50, y: 40 }],
};

function Decos({ kind }: { kind: ArtKind }) {
  const list = DECO[kind];
  if (!list) return null;
  return (
    <>
      {list.map((d, i) => (
        <span key={i} class={`lm-deco lm-${d.t}`} style={{ left: `${d.x}%`, top: `${d.y}%`, '--c': d.c ?? '#fff3a0', animationDelay: `${-i * 0.7}s` } as any} aria-hidden="true">
          {d.t === 'flag' && <Pennant color={d.c} />}
        </span>
      ))}
    </>
  );
}

// ───────── a tappable landmark ─────────

interface LandmarkProps {
  f: Frame;
  x: number;
  y: number;
  w: number;
  art: ArtKind;
  title: string;
  icon: string;
  /** "Clear 1-5" when locked. */
  lock?: string | null;
  badge?: boolean;
  /** Extra line under the label (e.g. "3-8"). */
  sub?: string;
  aria: string;
  onTap: () => void;
  children?: ComponentChildren;
  idx: number;
  id?: string;
}

function Landmark({ f, x, y, w, art, title, icon, lock, badge, sub, aria, onTap, children, idx, id }: LandmarkProps) {
  const [hit, setHit] = useState(0);
  const btn = useRef<HTMLButtonElement>(null);
  // Keep labels near the map edges fully on screen by nudging them inward.
  useLayoutEffect(() => {
    const el = btn.current;
    if (!el) return;
    const fit = () => {
      const map = el.closest('.hub-map');
      if (!map) return;
      const m = map.getBoundingClientRect();
      if (!m.width) return;
      el.style.removeProperty('--nx');
      let nx = 0;
      el.querySelectorAll<HTMLElement>('.lm-label, .lm-sub').forEach((lab) => {
        const r = lab.getBoundingClientRect();
        if (r.left < m.left + 4) nx = Math.max(nx, m.left + 4 - r.left);
        else if (r.right > m.right - 4) nx = Math.min(nx, m.right - 4 - r.right);
      });
      if (nx) el.style.setProperty('--nx', `${nx.toFixed(1)}px`);
    };
    fit();
    let live = true;
    // Label widths change once the comic font arrives.
    document.fonts?.ready.then(() => live && fit()).catch(() => {});
    window.addEventListener('resize', fit);
    return () => {
      live = false;
      window.removeEventListener('resize', fit);
    };
  }, [title, lock, sub]);
  return (
    <button
      ref={btn}
      class={`lm lm-k-${art} ${lock ? 'locked' : ''}`}
      data-landmark={id ?? art}
      style={{ left: px(x), top: py(f, y), width: px(w), zIndex: Math.round(y), '--d': `${(-idx * 0.83).toFixed(2)}s` } as any}
      aria-label={aria}
      onClick={() => {
        setHit((h) => h + 1);
        onTap();
      }}
    >
      <span class={`lm-art ${hit ? (lock ? 'lm-shake' : 'lm-pop') : ''}`} key={hit} style={{ aspectRatio: `100 / ${Math.round(ART_RATIO[art] * 100)}` }}>
        <LandmarkArt kind={art} />
        {!lock && <Decos kind={art} />}
        {children}
      </span>
      <span class="lm-label">
        <span class="lm-ico" aria-hidden="true">
          {lock ? '🔒' : icon}
        </span>
        <span class="lm-name">{title}</span>
        {badge && !lock && <span class="badge-dot lm-dot" />}
      </span>
      {(lock || sub) && <span class={`lm-sub ${lock ? 'lm-req' : ''}`}>{lock ?? sub}</span>}
    </button>
  );
}

// ───────── squad idling in front of the hideout ─────────

const QUIPS = ['Ready!', "Let's go!", 'Need a nap…', 'Train harder!', 'Snacks?', 'Next stage!', 'Watch this!', 'Bring it on!'];

const SquadIdle = memo(function SquadIdle({ f, ids, power, onOpen }: { f: Frame; ids: string[]; power: number; onOpen: () => void }) {
  const [talk, setTalk] = useState<{ id: string; text: string; k: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Lead in the middle, the others fanned out around them.
  const order = ids.length ? [ids[1], ids[2], ids[0], ids[3], ids[4]] : [];
  const poke = (id: string) => {
    haptic('light');
    sfx.click();
    const text = QUIPS[Math.floor(Math.random() * QUIPS.length)];
    setTalk((t) => ({ id, text, k: (t?.k ?? 0) + 1 }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setTalk(null), 1800);
  };
  return (
    <div class="hub-squad" style={{ top: py(f, SQUAD_Y) }}>
      {order.map((id, i) => {
        if (!id) return null;
        let name = id;
        try {
          name = getHero(id).name;
        } catch {
          /* unknown id in an old save */
        }
        const lead = i === 2;
        const w = lead ? 74 : 62;
        return (
          <button
            key={id}
            class={`hub-hero ${lead ? 'lead' : ''} ${talk?.id === id ? 'hop' : ''}`}
            style={{ left: px(SQUAD_XS[i]), width: px(w), '--d': `${(-i * 0.55).toFixed(2)}s`, zIndex: lead ? 3 : 2 } as any}
            onClick={() => poke(id)}
            aria-label={`${name}, squad member`}
          >
            <span class="hub-hero-art" key={talk?.id === id ? talk.k : 0}>
              <CharacterArt id={id} mode="full" />
            </span>
            {talk?.id === id && (
              <span class="hub-bubble" key={`b${talk.k}`} aria-live="polite">
                {talk.text}
              </span>
            )}
          </button>
        );
      })}
      <button class="hub-squad-tag" onClick={onOpen} aria-label={`Squad, power ${fmt(power)}. Open squad setup`}>
        <span aria-hidden="true">🛡️</span> Squad <span class="power">⚡{fmt(power)}</span>
      </button>
    </div>
  );
});

// ───────── event rail ─────────

type RailItem = { kind: 'screen'; id: ScreenId } | { kind: 'quests' };
const RAIL: RailItem[] = [{ kind: 'screen', id: 'login' }, { kind: 'screen', id: 'pass' }, { kind: 'quests' }, { kind: 'screen', id: 'shop' }];

function EventRail({ nav, s }: { nav: Nav; s: SaveState }) {
  const questsReady = [...DAILY_QUESTS, BONUS_QUEST].filter((q) => claimable(s, q)).length;
  return (
    <div class="hub-rail-anchor">
      <div class="hub-rail" role="toolbar" aria-label="Events">
        {RAIL.map((r, i) => {
          if (r.kind === 'quests')
            return (
              <button key="quests" class="rail-btn" style={{ '--i': i } as any} onClick={() => nav.openQuests()} aria-label={questsReady ? `Daily quests, ${questsReady} ready` : 'Daily quests'}>
                <span class="rail-ico" aria-hidden="true">
                  📜
                </span>
                <span class="rail-lbl">Quests</span>
                {questsReady > 0 && <span class="rail-count">{questsReady}</span>}
              </button>
            );
          const d = SCREEN_MAP[r.id];
          if (!d) return null;
          const lock = unlockText(d.unlockStage, s.stage);
          const badge = !lock && safeBadge(d, s);
          const short = d.title.split(' ').pop() ?? d.title;
          return (
            <button
              key={r.id}
              class={`rail-btn ${lock ? 'locked' : ''}`}
              style={{ '--i': i } as any}
              onClick={() => nav.open(r.id)}
              aria-label={`${d.title}${lock ? `, locked. ${lock} to unlock` : badge ? ', reward ready' : ''}`}
            >
              <span class="rail-ico" aria-hidden="true">
                {lock ? '🔒' : d.icon}
              </span>
              <span class="rail-lbl">{short}</span>
              {badge && <span class="badge-dot rail-dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ───────── the hub ─────────

export function Home({ nav }: { nav: Nav }) {
  const s = useGame();
  const [afk, setAfk] = useState(false);

  const ids = SCREENS.map((d) => d.id);
  const layout = useMemo(() => layoutHub(ids), [ids.join(',')]);
  const f: Frame = { h: layout.height };
  const spurs = useMemo(() => layout.placements.map((p) => `${p.plot.x},${p.plot.y}`).join(';'), [layout]);

  const next = getStage(s.stage);
  const squadIds = s.squad.slots.filter((x): x is string => !!x && !!s.heroes[x]);
  const myPower = teamPower(playerTeam(s));
  const enemyPower = teamPower(next.team);
  const chestReady = afkPending().hours >= CHEST_READY_HOURS;
  const openAfk = () => {
    sfx.click();
    haptic('tap');
    setAfk(true);
  };

  return (
    <div class="screen hub">
      <EventRail nav={nav} s={s} />

      <div class="hub-map" style={{ aspectRatio: `${MAP_W} / ${layout.height - CROP}` }}>
        <Backdrop height={layout.height} gateY={layout.gateY} spurs={spurs} top={CROP} />

        <div class="hub-cloud c1" aria-hidden="true" />
        <div class="hub-cloud c2" aria-hidden="true" />

        <div class="hub-title" style={{ top: py(f, CROP + 12) }}>
          <h1>
            BLACK CLOVER
            <em>GRIMOIRE SQUADS</em>
          </h1>
          <span class="fan-tag">Unofficial fan game</span>
        </div>

        {LAMPS.map(([x, y], i) => (
          <span key={i} class="hub-glow" style={{ left: px(x), top: py(f, y - 35), animationDelay: `${-i * 0.9}s` }} aria-hidden="true" />
        ))}
        {[
          [120, 520],
          [300, 660],
          [60, 800],
          [250, 930],
          [140, 1090],
          [340, 1150],
        ].map(([x, y], i) =>
          y < layout.gateY - 20 ? <span key={`f${i}`} class="hub-firefly" style={{ left: px(x), top: py(f, y), animationDelay: `${-i * 1.3}s` }} aria-hidden="true" /> : null,
        )}

        <Landmark
          f={f}
          {...SUMMON_SPOT}
          art="grimoire"
          idx={0}
          id="summon"
          title="Summon"
          icon="📖"
          badge={s.currencies.tickets > 0}
          aria={`Grimoire Tower: summon heroes${s.currencies.tickets > 0 ? `, ${s.currencies.tickets} tickets` : ''}`}
          onTap={() => nav.go('summon')}
        >
          <span class="lm-beacon" aria-hidden="true">
            <span class="lm-ring" />
            <FloatingGrimoire />
          </span>
        </Landmark>

        <Landmark
          f={f}
          {...HIDEOUT_SPOT}
          art="hideout"
          idx={1}
          id="hideout"
          title="Hideout"
          icon="🐂"
          badge={chestReady}
          aria={`Black Bulls hideout: AFK chest${chestReady ? ', rewards ready' : ''}`}
          onTap={openAfk}
        >
          <span class={`lm-chest ${chestReady ? 'ready' : ''}`} aria-hidden="true">
            <ChestArt pct={chestReady ? 1 : 0.2} />
          </span>
        </Landmark>

        <SquadIdle f={f} ids={squadIds} power={myPower} onOpen={() => nav.go('squad')} />

        {layout.placements.map(({ id, plot }, i) => {
          const d = SCREEN_MAP[id as ScreenId];
          if (!d) return null;
          const lock = unlockText(d.unlockStage, s.stage);
          const badge = !lock && safeBadge(d, s);
          return (
            <Landmark
              key={id}
              f={f}
              x={plot.x}
              y={plot.y}
              w={plot.w}
              art={SCREEN_ART[id] ?? 'cottage'}
              idx={i + 2}
              id={id}
              title={d.title}
              icon={d.icon}
              lock={lock}
              badge={badge}
              aria={`${d.title}: ${d.blurb}${lock ? ` Locked. ${lock} to unlock.` : badge ? ' Reward ready.' : ''}`}
              onTap={() => nav.open(d.id)}
            >
              {!SCREEN_ART[id] && (
                <span class="lm-sign" aria-hidden="true">
                  {d.icon}
                </span>
              )}
            </Landmark>
          );
        })}

        <Landmark
          f={f}
          x={200}
          y={layout.gateY}
          w={150}
          art="gate"
          idx={12}
          id="campaign"
          title="Campaign"
          icon="⚔️"
          sub={`Next: ${next.label}`}
          aria={`Campaign gate. Next stage ${next.label}`}
          onTap={() => nav.go('campaign')}
        />
      </div>

      <div class="hub-dock">
        <DockChest onOpen={openAfk} />
        <div class="dock-stage">
          <button class="dock-stage-info" onClick={() => nav.go('campaign')} aria-label={`Campaign map. Next stage ${next.label}, ${next.name}`}>
            <span class="dock-stage-num">{next.label}</span>
            <span class="dock-stage-text">
              <b>{next.name}</b>
              <span class="small-text">
                <span class="power">⚡{fmt(myPower)}</span> <span class="muted">vs</span>{' '}
                <span class="power" style={{ color: myPower >= enemyPower ? '#7dff9b' : '#ff8a8a' }}>
                  ⚡{fmt(enemyPower)}
                </span>
              </span>
            </span>
          </button>
          <button
            class="btn red dock-go"
            onClick={() => {
              if (!squadIds.length) {
                toast('Add heroes to your squad first!', 'bad');
                nav.go('squad');
              } else nav.fight(s.stage);
            }}
            aria-label={`Battle stage ${next.label}`}
          >
            Battle!
          </button>
        </div>
      </div>

      {afk && <AfkModal onClose={() => setAfk(false)} />}
    </div>
  );
}
