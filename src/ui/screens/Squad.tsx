import { useMemo, useState } from 'preact/hooks';
import { CharacterArt } from '../../art/CharacterArt';
import { FACTIONS, FORMATIONS, FORMATION_MAP } from '../../data/formations';
import { getHero } from '../../data/heroes';
import { teamPower } from '../../game/power';
import { fmt, heroPower } from '../../game/stats';
import { autoFill, playerTeam, setFormation, setSlot, useGame } from '../../game/store';
import { teamBonuses } from '../../game/team';
import type { Row, StatMods } from '../../game/types';
import type { Nav } from '../nav';
import { HeroCard, toast } from '../components/common';
import { sfx } from '../sfx';

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
  const formation = FORMATION_MAP[s.squad.formation];
  const [sel, setSel] = useState<number>(() => Math.max(0, s.squad.slots.findIndex((x) => !x)));
  const team = playerTeam(s);
  const power = teamPower(team);
  const bonus = useMemo(() => teamBonuses(team.members.map((m) => m.heroId)), [s.squad.slots.join()]);

  const roster = Object.values(s.heroes)
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

  const assign = (id: string) => {
    sfx.click();
    setSlot(sel, id);
    const next = s.squad.slots.findIndex((x, i) => !x && i !== sel);
    if (next >= 0) setSel(next);
  };

  return (
    <div class="screen">
      <div class="spread" style={{ marginBottom: 10 }}>
        <div>
          <div class="small-text muted">Squad Power</div>
          <div class="power" style={{ fontSize: 30 }}>
            ⚡{fmt(power)}
          </div>
        </div>
        <button
          class="btn blue"
          onClick={() => {
            autoFill();
            toast('Strongest squad assembled!');
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
                onClick={() => (locked ? toast(`Clear stage ${clearLabel(f.unlockStage)} to unlock ${f.name}`) : setFormation(f.id))}
              >
                <div class="fname">{f.name}</div>
                <MiniFormation rows={f.rows} />
                <div class="small-text muted">{locked ? `🔒 Clear ${clearLabel(f.unlockStage)}` : `${f.rows.filter((r) => r === 'front').length}F · ${f.rows.filter((r) => r === 'back').length}B`}</div>
              </button>
            );
          })}
        </div>
        <div class="small-text" style={{ marginTop: 4 }}>
          {formation.desc}
        </div>
      </div>

      <div class="board" style={{ marginTop: 12 }}>
        <div class="lane-label" style={{ left: '24%', color: '#9fd2ff' }}>
          BACK ROW
        </div>
        <div class="lane-label" style={{ left: '62%', color: '#ffb0b0' }}>
          FRONT ROW
        </div>
        <div class="enemy-side">ENEMY ▶</div>
        {formation.rows.map((row, slot) => {
          const id = s.squad.slots[slot];
          const h = id ? getHero(id) : null;
          const p = pos[slot];
          return (
            <div key={slot} class={`slot ${id ? '' : 'empty'} ${sel === slot ? 'sel' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} onClick={() => setSel(slot)}>
              <div class="slot-art">
                {h ? <CharacterArt id={h.id} mode="full" /> : '+'}
                {h && (h.formation[row] ? <span class="trait-on">✦</span> : null)}
              </div>
              {h && <div class="slot-name">{h.name.split(' ')[0]}</div>}
            </div>
          );
        })}
      </div>

      {s.squad.slots[sel] && (
        <div class="row" style={{ marginTop: 10, justifyContent: 'space-between' }}>
          <span class="small-text muted">Slot {sel + 1} selected · tap a hero below to swap</span>
          <button class="btn red small" onClick={() => setSlot(sel, null)}>
            Remove
          </button>
        </div>
      )}

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
            <HeroCard key={h.id} id={h.id} owned={h} inSquad={s.squad.slots.includes(h.id)} onClick={() => assign(h.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}
