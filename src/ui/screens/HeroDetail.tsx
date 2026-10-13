import { useEffect, useRef, useState } from 'preact/hooks';
import { CharacterArt } from '../../art/CharacterArt';
import { BONDS, FACTION_MAP } from '../../data/formations';
import { SUMMONABLE, getHero } from '../../data/heroes';
import { MAX_STARS, RARITY_INFO, ROLE_INFO, fmt, heroPower, heroStats, levelCap, levelUpCost, starUpCost } from '../../game/stats';
import { canAfford, levelUp, starUp, useGame } from '../../game/store';
import { AnimatedNumber, Burst, Cost, Modal, RarityBadge, Stars, toast, useHoldRepeat } from '../components/common';
import { haptic } from '../haptics';
import { reducedMotion } from '../prefs';
import { sfx } from '../sfx';
import './heroes.css';
import { modsText } from './Squad';

function Desc({ text }: { text: string }) {
  if (text.startsWith('FORMATION SHIFT')) {
    return (
      <p>
        <span class="shift-tag">⇄ FORMATION SHIFT</span>
        {text.slice('FORMATION SHIFT'.length)}
      </p>
    );
  }
  return <p>{text}</p>;
}

type Cele = { k: number; kind: 'lv'; level: number } | { k: number; kind: 'star'; stars: number; cap: number };

const pct = (n: number) => `${n}%`;

export function HeroDetail({ id, onClose, onNavigate }: { id: string; onClose: () => void; onNavigate: (id: string) => void }) {
  const s = useGame();
  const h = getHero(id);
  const owned = s.heroes[id];
  const level = owned?.level ?? 1;
  const stars = owned?.stars ?? RARITY_INFO[h.rarity].startStars;
  const st = heroStats(h, level, stars);
  const cap = levelCap(stars);
  const cost = levelUpCost(level);
  const starCost = stars < MAX_STARS ? starUpCost(h, stars) : 0;
  const faction = FACTION_MAP[h.faction];
  const bonds = BONDS.filter((b) => b.heroes.includes(id));
  const [cele, setCele] = useState<Cele | null>(null);
  const dir = useRef<1 | -1>(1);
  const failed = useRef(false);
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const artRef = useRef<HTMLDivElement>(null);

  const list = SUMMONABLE.filter((x) => s.heroes[x.id] || !owned).map((x) => x.id);
  const idx = list.indexOf(id);
  const canNav = list.length > 1 && idx >= 0;

  useEffect(() => setCele(null), [id]);
  // Hop the hero on every level, then clear the pop once it has played.
  useEffect(() => {
    if (cele?.kind === 'star') {
      const t = setTimeout(() => setCele((c) => (c?.k === cele.k ? null : c)), 2600);
      return () => clearTimeout(t);
    }
    if (!cele || cele.kind !== 'lv') return;
    const el = artRef.current;
    if (el && typeof el.animate === 'function' && !reducedMotion())
      el.animate(
        [{ transform: 'translateY(0) scale(1)' }, { transform: 'translateY(-14px) scale(1.04, .97)', offset: 0.4 }, { transform: 'translateY(0) scale(1)' }],
        { duration: 380, easing: 'cubic-bezier(.3,1.4,.5,1)' },
      );
    const t = setTimeout(() => setCele((c) => (c?.k === cele.k ? null : c)), 1300);
    return () => clearTimeout(t);
  }, [cele?.k]);

  const go = (d: 1 | -1) => {
    if (!canNav) return;
    dir.current = d;
    haptic('tap');
    sfx.click();
    onNavigate(list[(idx + d + list.length) % list.length]);
  };

  /** Level up `n` times; returns false (and explains once per press) when nothing happened. */
  const tryLevel = (n: number): boolean => {
    const before = s.heroes[id]?.level ?? 0;
    const done = levelUp(id, n);
    if (done) {
      const now = s.heroes[id].level;
      sfx.levelUp();
      haptic(now >= levelCap(s.heroes[id].stars) ? 'success' : 'light');
      setCele({ k: Date.now() + now, kind: 'lv', level: now });
      failed.current = false;
      return true;
    }
    if (!failed.current) {
      failed.current = true;
      haptic('error');
      if (before >= levelCap(s.heroes[id]?.stars ?? stars)) toast('Level cap reached. Star up to raise it!', 'bad');
      else toast('Not enough Yul or Essence.', 'bad');
    }
    return false;
  };

  const hold = useHoldRepeat(() => tryLevel(1), { delay: 380, interval: 160, min: 90 });

  const doStar = () => {
    if (!starUp(id)) return;
    const ns = s.heroes[id].stars;
    sfx.starUp();
    haptic('heavy');
    setCele({ k: Date.now(), kind: 'star', stars: ns, cap: levelCap(ns) });
    if (reducedMotion()) toast(`${h.name.split(' ')[0]} ascended to ${ns}★! Level cap is now ${levelCap(ns)}.`, 'good');
  };

  const onDown = (e: PointerEvent) => {
    if (!canNav || e.pointerType === 'mouse') return;
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onUp = (e: PointerEvent) => {
    const g = swipe.current;
    swipe.current = null;
    if (!g || g.id !== e.pointerId) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.6) go(dx < 0 ? 1 : -1);
  };

  const levelBlocked = level >= cap || !canAfford(cost);
  const stats: [string, number | string, ((n: number) => string) | null][] = [
    ['HP', st.hp, fmt],
    ['ATK', st.atk, fmt],
    ['DEF', st.def, fmt],
    ['SPD', Math.round(st.spd), String],
    ['CRIT', Math.round(st.crit * 100), pct],
    ['MAGIC', h.magic, null],
  ];

  return (
    <Modal onClose={onClose} label={`${h.name} details`}>
      <div class="hd-head" style={{ '--hc': h.color } as any} onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (swipe.current = null)}>
        <div class="hd-bg" />
        <div class={`hd-art hd-swap ${dir.current > 0 ? 'from-r' : 'from-l'}`} key={id} ref={artRef}>
          <CharacterArt id={id} mode="full" />
        </div>
        <div class="hd-info hd-swap-info" key={`i${id}`}>
          <RarityBadge r={h.rarity} />
          <h2 style={{ marginTop: 6 }}>{h.name}</h2>
          <div class="hd-title">{h.title}</div>
          <div class="row wrap" style={{ gap: 4 }}>
            <span class="chip" style={{ background: ROLE_INFO[h.role].color, color: '#0b0710' }}>
              {ROLE_INFO[h.role].icon} {h.role}
            </span>
            <span class="chip">{h.range === 'melee' ? '🗡 Melee' : '🏹 Ranged'}</span>
            {faction && (
              <span class="chip" style={{ color: faction.color }}>
                {faction.emblem} {h.faction}
              </span>
            )}
          </div>
          <div class="quote">"{h.quote}"</div>
        </div>
        {canNav && (
          <>
            <button class="icon-btn hd-nav" style={{ left: 8 }} onClick={() => go(-1)} aria-label="Previous hero">
              ◀
            </button>
            <button class="icon-btn hd-nav" style={{ left: 50 }} onClick={() => go(1)} aria-label="Next hero">
              ▶
            </button>
          </>
        )}
        {cele?.kind === 'lv' && (
          <div class="hd-lvpop" key={cele.k} aria-live="polite">
            <Burst count={12} spread={80} />
            <span class="hd-lvpop-t">LEVEL UP!</span>
            <span class="hd-lvpop-n">Lv {cele.level}</span>
          </div>
        )}
        {cele?.kind === 'star' && (
          <button class="hd-starcele" key={cele.k} onClick={() => setCele(null)} aria-label={`Star up! ${cele.stars} stars. Tap to close`}>
            <span class="hd-starcele-rays" aria-hidden="true" />
            <Burst count={22} spread={150} colors={['#ffc531', '#fff3a0', '#ffffff', '#ff9f1c']} />
            <span class="hd-starcele-t">STAR UP!</span>
            <span class="hd-starcele-stars" aria-hidden="true">
              {Array.from({ length: cele.stars }, (_, i) => (
                <i key={i} class={i === cele.stars - 1 ? 'new' : ''} style={{ animationDelay: `${0.15 + i * 0.07}s` }}>
                  ★
                </i>
              ))}
            </span>
            <span class="hd-starcele-sub">Level cap is now {cele.cap}</span>
          </button>
        )}
      </div>

      <div class="spread" style={{ marginTop: 10 }}>
        <div>
          <span class={`hd-stars ${cele?.kind === 'star' ? 'pop' : ''}`} key={`s${stars}`}>
            <Stars n={stars} max={MAX_STARS} />
          </span>
          <div class="comic" style={{ fontSize: 20 }}>
            Lv <AnimatedNumber value={level} format={String} />
            <span class="muted" style={{ fontSize: 15 }}>
              {' '}
              / {cap}
            </span>
          </div>
          {owned && (
            <div class="bar hd-capbar" aria-hidden="true">
              <i style={{ width: `${Math.min(100, (level / cap) * 100)}%` }} />
            </div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div class="small-text muted">Power</div>
          <div class="power" style={{ fontSize: 24 }}>
            ⚡<AnimatedNumber value={heroPower(h, level, stars)} />
          </div>
        </div>
      </div>

      <div class="stat-grid">
        {stats.map(([k, v, f]) => (
          <div class="stat" key={k}>
            <div class="k">{k}</div>
            <div class="v" style={k === 'MAGIC' ? { fontSize: 11, lineHeight: '17px' } : undefined}>
              {f && typeof v === 'number' ? <AnimatedNumber value={v} format={f} /> : v}
            </div>
          </div>
        ))}
      </div>

      {owned ? (
        <div class="upgrade-row">
          <button
            class="btn green hd-lvbtn"
            disabled={levelBlocked}
            {...hold}
            onPointerDown={(e: PointerEvent) => {
              failed.current = false;
              hold.onPointerDown(e);
            }}
            onClick={() => {
              failed.current = false;
              hold.onClick();
            }}
            style={{ flexDirection: 'column', gap: 0 }}
            aria-label="Level up. Hold to level up repeatedly"
          >
            Level Up
            <span class="row" style={{ gap: 6 }}>
              <Cost kind="yul" amount={cost.yul} />
              <Cost kind="essence" amount={cost.essence} />
            </span>
          </button>
          <button
            class="btn blue"
            disabled={levelBlocked}
            onClick={() => {
              failed.current = false;
              tryLevel(10);
            }}
          >
            Lv +10
          </button>
          <button class={`btn purple ${stars < MAX_STARS && owned.shards >= starCost ? 'hd-star-ready' : ''}`} style={{ gridColumn: 'span 2' }} disabled={stars >= MAX_STARS || owned.shards < starCost} onClick={doStar}>
            {stars >= MAX_STARS ? 'MAX STARS' : `★ Star Up · ${owned.shards}/${starCost} grimoire pages`}
          </button>
        </div>
      ) : (
        <div class="panel center" style={{ marginTop: 10 }}>
          <b>Not summoned yet.</b>
          <div class="small-text muted">Find {h.name.split(' ')[0]} in the Grimoire Tower.</div>
        </div>
      )}
      {owned && (
        <div class="small-text muted center" style={{ marginTop: 6 }}>
          Hold Level Up to keep going. Duplicate summons become grimoire pages for Star Ups.
        </div>
      )}

      <div class="ability">
        <div class="ab-head">
          <span class="ab-kind" style={{ background: 'var(--gold)' }}>
            ULTIMATE
          </span>
          <span class="ab-name">{h.ultimate.name}</span>
        </div>
        <Desc text={h.ultimate.desc} />
      </div>
      <div class="ability">
        <div class="ab-head">
          <span class="ab-kind" style={{ background: '#b46bff', color: '#fff' }}>
            PASSIVE
          </span>
          <span class="ab-name">{h.passive.name}</span>
        </div>
        <p>{h.passive.desc}</p>
      </div>
      <div class="ability">
        <div class="ab-head">
          <span class="ab-kind" style={{ background: '#4fc3f7' }}>
            FORMATION
          </span>
          <span class="ab-name">{h.formation.name}</span>
        </div>
        <p>
          <b style={{ color: '#ffb0b0' }}>Front row:</b> {modsText(h.formation.front)}
          <br />
          <b style={{ color: '#9fd2ff' }}>Back row:</b> {modsText(h.formation.back)}
        </p>
      </div>
      <div class="ability">
        <div class="ab-head">
          <span class="ab-kind" style={{ background: '#ddd' }}>
            BASIC
          </span>
          <span class="ab-name">{h.basic.name}</span>
        </div>
        <p>
          {h.range === 'melee' ? 'Strikes the enemy front row' : 'Fires at the enemy front row, sometimes sniping the back row'} for {Math.round((h.basic.mult ?? 1) * 100)}% ATK. Builds energy for the
          ultimate.
        </p>
      </div>
      {(faction || bonds.length > 0) && (
        <div class="ability">
          <div class="ab-head">
            <span class="ab-kind" style={{ background: faction?.color ?? '#ccc' }}>
              SYNERGY
            </span>
            <span class="ab-name">{faction?.synergy ?? 'Bonds'}</span>
          </div>
          {faction && <p>{faction.tiers.map((t) => `${t.count} ${h.faction}: ${t.text}`).join(' · ')}</p>}
          {bonds.map((b) => (
            <p key={b.id} style={{ marginTop: 4 }}>
              🔗 <b>{b.name}</b> with{' '}
              {b.heroes
                .filter((x) => x !== id)
                .map((x) => {
                  try {
                    return getHero(x).name.split(' ')[0];
                  } catch {
                    return x;
                  }
                })
                .join(' / ')}
              : {b.text}
            </p>
          ))}
        </div>
      )}
    </Modal>
  );
}
