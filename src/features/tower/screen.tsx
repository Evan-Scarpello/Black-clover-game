// Tower of Trials: an endless climb. The tower view scrolls; the preview card shows the picked floor.
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CharacterArt } from '../../art/CharacterArt';
import { getHero } from '../../data/heroes';
import { teamPower } from '../../game/power';
import type { Reward } from '../../game/state';
import { fmt, fmtShort } from '../../game/stats';
import { playerTeam, useGame } from '../../game/store';
import { CurrencyIcon } from '../../ui/components/common';
import type { ScreenDef, ScreenProps } from '../../ui/nav';
import { towerBattle } from './battle';
import { canChallenge, floorReward, nextMilestone, towerFloor } from './logic';
import './tower.css';

/** Floors drawn above the current one. */
const AHEAD = 5;
/** Cleared floors drawn below the current one before the rest are folded away. */
const BEHIND = 6;

function verdict(ratio: number): [string, string] {
  if (ratio >= 1.15) return ['Easy', '#7dff9b'];
  if (ratio >= 0.95) return ['Even', '#ffd166'];
  if (ratio >= 0.8) return ['Tough', '#ffa26b'];
  return ['Deadly', '#ff6b6b'];
}

function MiniReward({ r }: { r: Reward }) {
  const keys = (['gems', 'tickets', 'yul', 'essence'] as const).filter((k) => (r[k] ?? 0) > 0);
  return (
    <div class="tw-rew">
      {keys.map((k) => (
        <span key={k} class="tw-rew-item">
          <CurrencyIcon kind={k} size={16} />
          {fmtShort(r[k]!)}
        </span>
      ))}
      {Object.entries(r.shards ?? {}).map(([id, n]) => (
        <span key={id} class="tw-rew-item">
          <span class="reward-face">
            <CharacterArt id={id} mode="portrait" />
          </span>
          {n} {getHero(id).name.split(' ')[0]} pages
        </span>
      ))}
    </div>
  );
}

function FloorBlock({ f, cleared, sel, onPick }: { f: number; cleared: number; sel: number; onPick: (f: number) => void }) {
  const info = useMemo(() => towerFloor(f), [f]);
  const done = f <= cleared;
  const current = f === cleared + 1;
  const ahead = f - cleared - 1;
  const state = done ? 'done' : current ? 'current' : 'locked';
  return (
    <button
      class={`tw-floor ${state} ${info.isBoss ? 'boss' : ''} ${info.isTrial ? 'trial' : ''} ${sel === f ? 'sel' : ''}`}
      style={!done && !current ? { opacity: Math.max(0.42, 1 - ahead * 0.12) } : undefined}
      data-floor={f}
      onClick={() => onPick(f)}
      aria-label={`Floor ${f}${done ? ', cleared' : current ? ', next to climb' : ', locked'}`}
    >
      <span class="tw-plaque">
        <small>FLOOR</small>
        {f}
      </span>
      <span class="tw-window">
        <span class="tw-window-art">
          <CharacterArt id={info.leader} mode="portrait" />
        </span>
      </span>
      <span class="tw-tags">
        {info.isTrial ? (
          <span class="tw-tag trial">
            {info.twist?.icon} TRIAL
          </span>
        ) : info.isBoss ? (
          <span class="tw-tag boss">☠ BOSS</span>
        ) : null}
        {info.milestone && !done && <span class="tw-tag gift">🎁</span>}
        {done && <span class="tw-tag ok">✔</span>}
        {current && <span class="tw-tag go">⚔ NEXT</span>}
      </span>
    </button>
  );
}

function Tower({ cleared, sel, onPick }: { cleared: number; sel: number; onPick: (f: number) => void }) {
  const view = useRef<HTMLDivElement>(null);
  const current = cleared + 1;
  // Always show the next milestone so the gift floor is something to aim at.
  const top = Math.max(current + AHEAD, Math.min(nextMilestone(cleared), current + 12));
  const low = Math.max(1, current - BEHIND);
  const floors: number[] = [];
  for (let f = top; f >= low; f--) floors.push(f);

  const scrollTo = (f: number, center: boolean) => {
    const el = view.current;
    const node = el?.querySelector<HTMLElement>(`[data-floor="${f}"]`);
    if (!el || !node) return;
    const y = node.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
    if (center) el.scrollTop = Math.max(0, y - el.clientHeight * 0.7 + node.offsetHeight / 2);
    else if (y < el.scrollTop + 8) el.scrollTop = Math.max(0, y - 24);
    else if (y + node.offsetHeight > el.scrollTop + el.clientHeight - 8) el.scrollTop = y + node.offsetHeight - el.clientHeight + 24;
  };

  // Keep the next floor in view, low in the window so more of the climb shows above it.
  useLayoutEffect(() => scrollTo(current, true), [current]);
  // Reveal a floor picked from outside the tower (the milestone button).
  useLayoutEffect(() => scrollTo(sel, false), [sel]);

  return (
    <div class="tw-view" ref={view}>
      <div class="tw-sky">
        <div class="tw-top">
          <span class="tw-moon" />
          <span class="tw-cloud c1" />
          <span class="tw-cloud c2" />
          <div class="tw-mist">The tower climbs on forever…</div>
        </div>
        <div class="tw-parapet">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
        <div class="tw-stack">
          {floors.map((f) => (
            <FloorBlock key={f} f={f} cleared={cleared} sel={sel} onPick={onPick} />
          ))}
          {low > 1 && (
            <div class="tw-folded">
              <span>Floors 1–{low - 1} conquered</span>
            </div>
          )}
        </div>
        <div class="tw-base">
          <div class="tw-door" />
          <span class="tw-torch l">🔥</span>
          <span class="tw-torch r">🔥</span>
          <div class="tw-sign">TOWER OF TRIALS</div>
        </div>
      </div>
    </div>
  );
}

function TowerPage({ nav }: ScreenProps) {
  const s = useGame();
  const cleared = Math.max(0, Math.floor(s.tower.floor || 0));
  const current = cleared + 1;
  const [picked, setPicked] = useState<number | null>(null);
  const sel = picked ?? current;
  const info = useMemo(() => towerFloor(sel), [sel]);
  const myPower = teamPower(playerTeam(s));
  const enemyPower = useMemo(() => teamPower(info.team), [info]);
  const [vText, vColor] = verdict(myPower / Math.max(1, enemyPower));
  const squadEmpty = !s.squad.slots.some((id) => id && s.heroes[id]);
  const milestone = nextMilestone(cleared);
  const done = sel <= cleared;
  const open = canChallenge(cleared, sel);

  const pick = (f: number) => setPicked(f === current ? null : f);
  const challenge = () => {
    if (!open || squadEmpty) return;
    nav.battle(towerBattle(sel, nav));
  };

  return (
    <div class="screen tw-screen">
      <div class="tw-status">
        <div class="tw-best-box">
          <span class="tw-best-label">Best</span>
          <span class="tw-best">{cleared || '—'}</span>
        </div>
        <button class="tw-goal-btn" onClick={() => pick(milestone)} aria-label={`Next milestone: floor ${milestone}`}>
          <span class="tw-goal-floor">🎁 F{milestone}</span>
          <MiniReward r={{ tickets: floorReward(milestone).tickets, shards: floorReward(milestone).shards }} />
        </button>
      </div>

      <Tower cleared={cleared} sel={sel} onPick={pick} />

      <div class={`panel tw-card ${info.isBoss ? 'boss' : ''} ${info.isTrial ? 'trial' : ''}`}>
        <div class="spread">
          <h3 class="panel-title tw-card-title">
            Floor {sel}
            {info.isTrial ? <span class="tw-tag trial">TRIAL</span> : info.isBoss ? <span class="tw-tag boss">BOSS</span> : null}
          </h3>
          <span class="chip" style={{ color: vColor }}>
            {vText}
          </span>
        </div>
        <div class="small-text muted tw-sub">
          {info.isBoss || info.isTrial ? `${info.name} · ` : ''}Enemy Lv {info.level} · {info.team.formation.name}
        </div>
        {info.twist && (
          <div class="tw-twist">
            <span class="tw-twist-ico">{info.twist.icon}</span>
            <span>{info.twist.text}</span>
          </div>
        )}
        <div class="lineup tw-lineup">
          {info.team.members.map((m) => {
            const h = getHero(m.heroId);
            return (
              <div class={`mini ${m.boss ? 'boss' : ''}`} key={m.slot} title={h.name} style={{ background: `radial-gradient(circle at 50% 35%, ${h.color}, #1b1330 75%)` }}>
                <CharacterArt id={m.heroId} mode="portrait" flip />
                <div class="lv">
                  {m.boss ? 'BOSS ' : ''}Lv{m.level}
                </div>
              </div>
            );
          })}
        </div>
        <div class="tw-vs">
          <div>
            <div class="small-text muted">Your squad</div>
            <div class="power">⚡{fmt(myPower)}</div>
          </div>
          <div class="comic muted">VS</div>
          <div style={{ textAlign: 'right' }}>
            <div class="small-text muted">Floor {sel}</div>
            <div class="power" style={{ color: '#ff9a9a' }}>
              ⚡{fmt(enemyPower)}
            </div>
          </div>
        </div>
        <div class="tw-first">
          {done ? (
            <span class="small-text muted">Cleared. Replays are just for fun: no rewards.</span>
          ) : (
            <>
              <span class="small-text tw-first-label">First clear</span>
              <MiniReward r={info.reward} />
            </>
          )}
        </div>
        <div class="row">
          <button class="btn dark" onClick={() => nav.go('squad')}>
            Squad
          </button>
          {open ? (
            <button class={`btn ${done ? 'blue' : 'red'} big tw-go`} disabled={squadEmpty} onClick={challenge}>
              {squadEmpty ? 'Set a squad first' : done ? 'Replay' : 'Challenge!'}
            </button>
          ) : (
            <button class="btn dark big tw-go" disabled>
              Clear Floor {cleared + 1} first
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const towerScreen: ScreenDef = {
  id: 'tower',
  title: 'Tower of Trials',
  icon: '🗼',
  blurb: 'Climb an endless tower of ever-tougher floors.',
  unlockStage: 5,
  component: TowerPage,
  badge: () => false,
};
