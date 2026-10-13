import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CharacterArt } from '../../art/CharacterArt';
import { FACTIONS, FORMATIONS, FORMATION_MAP } from '../../data/formations';
import { getHero } from '../../data/heroes';
import { teamPower } from '../../game/power';
import { heroPower } from '../../game/stats';
import { autoFill, playerTeam, setFormation, setSlot, swapSlots, useGame } from '../../game/store';
import { teamBonuses } from '../../game/team';
import type { Row, StatMods } from '../../game/types';
import type { Nav } from '../nav';
import { AnimatedNumber, HeroCard, toast } from '../components/common';
import { captureRects, playFlip, type Rects } from '../flip';
import { haptic } from '../haptics';
import { sfx } from '../sfx';
import { assignTarget, initialSelection, nextEmpty, slotTap } from '../squadLogic';
import './squad.css';

const MOD_LABEL: Record<keyof StatMods, string> = {
  hp: 'HP',
  atk: 'ATK',
  def: 'DEF',
  spd: 'SPD',
  crit: 'Crit',
  critDmg: 'Crit DMG',
  heal: 'Healing',
  energy: 'Energy',
  lifesteal: 'Lifesteal',
};

export function modsText(m?: StatMods): string {
  if (!m) return '—';
  const parts = (Object.keys(m) as (keyof StatMods)[]).filter((k) => m[k]).map((k) => `${m[k]! > 0 ? '+' : ''}${Math.round(m[k]! * 100)}% ${MOD_LABEL[k]}`);
  return parts.length ? parts.join(', ') : '—';
}

/** Label of the stage that must be cleared for `cleared` total clears. */
export function clearLabel(cleared: number): string {
  return `${Math.floor((cleared - 1) / 10) + 1}-${((cleared - 1) % 10) + 1}`;
}

export function MiniFormation({ rows }: { rows: Row[] }) {
  const front = rows.filter((r) => r === 'front').length;
  const back = rows.length - front;
  return (
    <div class="mini-form">
      <div class="col">{Array.from({ length: back }, (_, i) => <i key={i} class="dot b" />)}</div>
      <div class="col">{Array.from({ length: front }, (_, i) => <i key={i} class="dot f" />)}</div>
    </div>
  );
}

export function Squad(_: { nav: Nav }) {
  const s = useGame();
  const formation = FORMATION_MAP[s.squad.formation] ?? FORMATIONS[0];
  const [sel, setSel] = useState<number>(() => initialSelection(s.squad.slots));
  const [over, setOver] = useState<number>(-1);
  const [dragFrom, setDragFrom] = useState<number>(-1);
  const boardRef = useRef<HTMLDivElement>(null);
  const flipBefore = useRef<Rects | null>(null);
  const drag = useRef<{ id: number; slot: number; x0: number; y0: number; el: HTMLElement; on: boolean; over: number } | null>(null);
  const team = playerTeam(s);
  const power = teamPower(team);
  const slotsKey = s.squad.slots.join();
  const bonus = useMemo(() => teamBonuses(team.members.map((m) => m.heroId)), [slotsKey]);

  const roster = Object.values(s.heroes)
    .filter((h) => {
      try {
        return !!getHero(h.id);
      } catch {
        return false;
      }
    })
    .map((h) => ({ h, p: heroPower(getHero(h.id), h.level, h.stars) }))
    .sort((a, b) => b.p - a.p);

  // board positions
  const frontSlots = formation.rows.map((r, i) => (r === 'front' ? i : -1)).filter((i) => i >= 0);
  const backSlots = formation.rows.map((r, i) => (r === 'back' ? i : -1)).filter((i) => i >= 0);
  const pos: Record<number, { x: number; y: number }> = {};
  const place = (list: number[], x: number) =>
    list.forEach((slot, i) => {
      const n = list.length;
      pos[slot] = { x: x + (n > 2 ? (i % 2 ? 4 : -4) : 0), y: 14 + ((i + 0.5) * 82) / n };
    });
  place(backSlots, 24);
  place(frontSlots, 62);

  // FLIP: units glide to their new spots after swaps, assignments and formation changes.
  const capture = () => {
    flipBefore.current = captureRects(boardRef.current);
  };
  useLayoutEffect(() => {
    if (!flipBefore.current) return;
    playFlip(boardRef.current, flipBefore.current);
    flipBefore.current = null;
  }, [slotsKey, formation.id]);

  // Drop a stale selection if the squad changed elsewhere (auto-fill, another screen).
  useEffect(() => {
    if (sel >= formation.rows.length) setSel(-1);
  }, [formation.id]);

  const doSwap = (a: number, b: number) => {
    capture();
    swapSlots(a, b);
    sfx.swap();
    haptic('light');
    setSel(-1);
  };

  const tapSlot = (slot: number) => {
    const act = slotTap(sel, slot, s.squad.slots);
    if (act.kind === 'swap') doSwap(act.a, act.b);
    else {
      sfx.click();
      haptic('tap');
      setSel(act.kind === 'select' ? act.slot : -1);
    }
  };

  const assign = (id: string) => {
    const target = assignTarget(sel, s.squad.slots);
    if (target < 0) {
      const at = s.squad.slots.indexOf(id);
      if (at >= 0) setSel(at);
      else toast('Tap a squad slot first, then pick a hero for it.');
      sfx.click();
      return;
    }
    if (s.squad.slots[target] === id) return;
    capture();
    sfx.swap();
    haptic('light');
    setSlot(target, id);
    setSel(nextEmpty(s.squad.slots, target));
  };

  // Drag a unit onto another slot to swap them.
  const onUnitDown = (slot: number) => (e: PointerEvent) => {
    if (e.button > 0) return;
    const el = e.currentTarget as HTMLElement;
    drag.current = { id: e.pointerId, slot, x0: e.clientX, y0: e.clientY, el, on: false, over: -1 };
  };
  const onUnitMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.on) {
      if (Math.hypot(dx, dy) < 9) return;
      d.on = true;
      try {
        d.el.setPointerCapture(e.pointerId);
      } catch {
        /* pointer already gone */
      }
      setDragFrom(d.slot);
      haptic('tap');
    }
    d.el.style.translate = `${dx}px ${dy}px`;
    let target = -1;
    const hit = document.elementsFromPoint(e.clientX, e.clientY);
    for (const h of hit) {
      if (d.el.contains(h)) continue;
      const slotEl = (h as Element).closest?.('[data-slot]');
      if (slotEl && boardRef.current?.contains(slotEl)) {
        target = Number(slotEl.getAttribute('data-slot'));
        break;
      }
    }
    if (target === d.slot) target = -1;
    if (target !== d.over) {
      d.over = target;
      setOver(target);
    }
  };
  const onUnitUp = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.on) return; // a plain tap: the click handler takes it
    setDragFrom(-1);
    setOver(-1);
    // Glide home (or to the new slot) from wherever the finger let go.
    const target = d.over;
    capture();
    d.el.style.translate = '';
    if (target >= 0) doSwap(d.slot, target);
    else {
      playFlip(boardRef.current, flipBefore.current ?? new Map());
      flipBefore.current = null;
    }
    // Swallow the click that follows a drag.
    const stop = (ev: Event) => {
      ev.stopPropagation();
      ev.preventDefault();
    };
    d.el.addEventListener('click', stop, { capture: true, once: true });
    setTimeout(() => d.el.removeEventListener('click', stop, { capture: true }), 0);
  };

  const pickFormation = (id: string, locked: boolean, label: string, name: string) => {
    if (locked) {
      toast(`Clear stage ${label} to unlock ${name}`);
      haptic('error');
      return;
    }
    if (id === formation.id) return;
    capture();
    setFormation(id);
    sfx.swap();
    haptic('light');
  };

  const selHero = sel >= 0 ? s.squad.slots[sel] : null;

  return (
    <div class="screen squad-screen">
      <div class="spread" style={{ marginBottom: 10 }}>
        <div>
          <div class="small-text muted">Squad Power</div>
          <div class="power" style={{ fontSize: 30 }}>
            ⚡<AnimatedNumber value={power} />
          </div>
        </div>
        <button
          class="btn blue"
          onClick={() => {
            if (!roster.length) return toast('Summon some heroes first!');
            capture();
            autoFill();
            setSel(-1);
            sfx.swap();
            haptic('success');
            toast('Strongest squad assembled!', 'good');
          }}
        >
          Auto-Fill
        </button>
      </div>

      <div class="panel">
        <h3 class="panel-title">Formation</h3>
        <div class="formation-list">
          {FORMATIONS.map((f) => {
            const locked = s.stage < f.unlockStage;
            return (
              <button
                key={f.id}
                class={`formation-card ${f.id === formation.id ? 'on' : ''} ${locked ? 'locked' : ''}`}
                aria-pressed={f.id === formation.id}
                onClick={() => pickFormation(f.id, locked, clearLabel(f.unlockStage), f.name)}
              >
                <div class="fname">{f.name}</div>
                <MiniFormation rows={f.rows} />
                <div class="small-text muted">{locked ? `🔒 Clear ${clearLabel(f.unlockStage)}` : `${f.rows.filter((r) => r === 'front').length}F · ${f.rows.filter((r) => r === 'back').length}B`}</div>
              </button>
            );
          })}
        </div>
        <div class="small-text sq-desc" key={formation.id}>
          {formation.desc}
        </div>
      </div>

      <div class={`board squad-board ${dragFrom >= 0 ? 'is-dragging' : ''}`} style={{ marginTop: 12 }} ref={boardRef} data-noswipe>
        <div class="lane-label" style={{ left: '24%', color: '#9fd2ff' }}>
          BACK ROW
        </div>
        <div class="lane-label" style={{ left: '62%', color: '#ffb0b0' }}>
          FRONT ROW
        </div>
        <div class="enemy-side">ENEMY ▶</div>
        {formation.rows.map((row, slot) => {
          const id = s.squad.slots[slot];
          const p = pos[slot];
          return (
            <button
              key={`pad${slot}`}
              data-flip={`pad${slot}`}
              data-slot={slot}
              class={`slot sq-pad ${id ? 'filled' : 'empty'} ${row} ${sel === slot ? 'sel' : ''} ${over === slot ? 'over' : ''}`}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              onClick={() => tapSlot(slot)}
              aria-label={`${row === 'front' ? 'Front' : 'Back'} row slot ${slot + 1}, ${id ? 'occupied' : 'empty'}${sel === slot ? ', selected' : ''}`}
              tabIndex={id ? -1 : 0}
            >
              <div class="slot-art">{id ? null : '+'}</div>
            </button>
          );
        })}
        {formation.rows.map((row, slot) => {
          const id = s.squad.slots[slot];
          if (!id) return null;
          let h: ReturnType<typeof getHero> | null = null;
          try {
            h = getHero(id);
          } catch {
            return null;
          }
          const p = pos[slot];
          return (
            <button
              key={id}
              data-flip={id}
              data-slot={slot}
              class={`slot sq-unit ${sel === slot ? 'sel' : ''} ${dragFrom === slot ? 'dragging' : ''} ${over === slot ? 'over' : ''}`}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              onClick={() => tapSlot(slot)}
              onPointerDown={onUnitDown(slot)}
              onPointerMove={onUnitMove}
              onPointerUp={onUnitUp}
              onPointerCancel={onUnitUp}
              aria-label={`${h.name}, ${row} row${sel === slot ? ', selected. Tap another slot to swap' : ''}`}
            >
              <div class="slot-art">
                <CharacterArt id={h.id} mode="full" />
                {h.formation[row] ? <span class="trait-on">✦</span> : null}
              </div>
              <div class="slot-name">{h.name.split(' ')[0]}</div>
            </button>
          );
        })}
      </div>

      <div class="row sq-hint" style={{ marginTop: 10, justifyContent: 'space-between', minHeight: 34 }}>
        <span class="small-text muted">
          {selHero
            ? `${getHero(selHero).name.split(' ')[0]} selected · tap a slot to move, or a hero below to swap in`
            : sel >= 0
              ? `Slot ${sel + 1} selected · tap a hero below to place them`
              : 'Tap or drag heroes to rearrange your squad'}
        </span>
        {selHero && (
          <button
            class="btn red small"
            onClick={() => {
              capture();
              setSlot(sel, null);
              sfx.click();
              haptic('light');
            }}
          >
            Remove
          </button>
        )}
      </div>

      <div class="panel" style={{ marginTop: 12 }}>
        <h3 class="panel-title">Formation Traits</h3>
        {team.members.length === 0 && <div class="empty-hint">Your squad is empty.</div>}
        <div class="syn-list">
          {team.members.map((m) => {
            const h = getHero(m.heroId);
            const row = formation.rows[m.slot];
            return (
              <div class="syn" key={m.slot}>
                <span class="chip" style={{ background: row === 'front' ? '#7a2533' : '#1f4a7a', minWidth: 52, justifyContent: 'center' }}>
                  {row === 'front' ? 'FRONT' : 'BACK'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{h.name.split(' ')[0]}</b> · <span class="muted">{h.formation.name}</span>
                  <div class="small-text" style={{ color: h.formation[row] ? '#c9ffd8' : 'var(--muted)' }}>
                    {modsText(h.formation[row])}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div class="panel">
        <h3 class="panel-title">Synergies</h3>
        <div class="syn-list">
          {bonus.synergies.map((sy) => (
            <div class={`syn ${sy.tier ? '' : 'off'}`} key={sy.faction.id}>
              <span class="count" style={{ color: sy.faction.color }}>
                {sy.count}
              </span>
              <div style={{ flex: 1 }}>
                <b>
                  {sy.faction.emblem} {sy.faction.id}
                </b>{' '}
                <span class="muted">· {sy.faction.synergy}</span>
                <div class="small-text">
                  {sy.tier ? <span style={{ color: '#c9ffd8' }}>{sy.tier.text}</span> : <span class="muted">Need {sy.next?.count}</span>}
                  {sy.tier && sy.next ? <span class="muted"> · next at {sy.next.count}: {sy.next.text}</span> : null}
                </div>
              </div>
            </div>
          ))}
          {bonus.bonds.map((bd) => (
            <div class="syn" key={bd.id} style={{ background: 'rgba(255,197,49,.12)' }}>
              <span class="count">🔗</span>
              <div style={{ flex: 1 }}>
                <b>{bd.name}</b>
                <div class="small-text" style={{ color: '#ffe6a3' }}>
                  {bd.text} for {bd.heroes.filter((x) => s.squad.slots.includes(x)).map((x) => getHero(x).name.split(' ')[0]).join(' & ')}
                </div>
              </div>
            </div>
          ))}
          {bonus.synergies.length === 0 && <div class="empty-hint">Field heroes from the same squad to unlock bonuses.</div>}
        </div>
        <div class="small-text muted" style={{ marginTop: 8 }}>
          Squad bonuses apply to members of that faction: {FACTIONS.map((f) => f.emblem).join(' ')} at 2 / 3 / 5 members.
        </div>
      </div>

      <div class="panel">
        <h3 class="panel-title">Your Heroes</h3>
        <div class="hero-grid">
          {roster.map(({ h }) => (
            <HeroCard key={h.id} id={h.id} owned={h} inSquad={s.squad.slots.includes(h.id)} selected={!!selHero && selHero === h.id} onClick={() => assign(h.id)} />
          ))}
        </div>
        {!roster.length && <div class="empty-hint">No heroes yet. Summon some at the Grimoire Tower!</div>}
      </div>
    </div>
  );
}
