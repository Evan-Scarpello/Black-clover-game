// PvP Arena: attack other players' defense squads (AI-controlled) and climb the weekly ranks.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { CharacterArt } from '../../art/CharacterArt';
import { FORMATION_MAP, FORMATIONS } from '../../data/formations';
import { getHero } from '../../data/heroes';
import type { TeamSetup } from '../../game/battle';
import { teamPower } from '../../game/power';
import { today } from '../../game/state';
import { fmt, heroPower } from '../../game/stats';
import { getState, lineupTeam, playerTeam, useGame } from '../../game/store';
import { CurrencyIcon, Modal, RarityBadge, RewardList, Stars, formatDuration, toast, useNow } from '../../ui/components/common';
import type { ScreenDef, ScreenProps } from '../../ui/nav';
import {
  buyShopItem,
  buyTicket,
  claimSeason,
  ensureArena,
  followSquad,
  itemReward,
  refreshOpponents,
  setDefenseFromSquad,
  startArenaFight,
} from './actions';
import './arena.css';
import {
  FREE_TICKETS,
  REFRESH_GEMS,
  SEASON_GEMS,
  SEASON_MEDALS,
  TIERS,
  leaderboardBots,
  pickOpponents,
  ratingDeltas,
  refreshFreeIn,
  seasonEnd,
  seasonId,
  shopItems,
  shopLeft,
  ticketCost,
  ticketsToday,
  tierIndex,
  tierOf,
  tierProgress,
  type OnlineDefense,
  type Opponent,
  type ShopItem,
  type Tier,
} from './logic';
import { ARENA_UNLOCK, defenseLineup, fetchBoard, fetchPool, myUid, onPublishStatus, publishStatus, resolveNames, schedulePublish } from './online';
import type { ArenaHistoryEntry } from './state';

type ArenaTab = 'battle' | 'defense' | 'ranks' | 'shop' | 'history';

/** How long the opponent list waits for online players before showing offline rivals. */
const POOL_WAIT_MS = 3000;

const TABS: { id: ArenaTab; label: string; icon: string }[] = [
  { id: 'battle', label: 'Battle', icon: '⚔️' },
  { id: 'defense', label: 'Defense', icon: '🛡️' },
  { id: 'ranks', label: 'Ranks', icon: '🏆' },
  { id: 'shop', label: 'Shop', icon: '🎖️' },
  { id: 'history', label: 'History', icon: '📜' },
];

// ───────── small helpers ─────────

function longDuration(ms: number): string {
  const d = Math.floor(ms / 86400000);
  if (d > 0) return `${d}d ${Math.floor((ms % 86400000) / 3600000)}h`;
  return formatDuration(ms);
}

function ago(at: number, now: number): string {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function untilMidnight(now: number): number {
  const d = new Date(now);
  d.setHours(24, 0, 0, 0);
  return d.getTime() - now;
}

/** Strongest member of a team (for avatars). */
function aceOf(team: TeamSetup): string | null {
  let best: string | null = null;
  let bp = -1;
  for (const m of team.members) {
    const p = heroPower(getHero(m.heroId), m.level, m.stars);
    if (p > bp) {
      bp = p;
      best = m.heroId;
    }
  }
  return best;
}

function knownHero(id: string | null | undefined): id is string {
  if (!id) return false;
  try {
    getHero(id);
    return true;
  } catch {
    return false;
  }
}

function oppName(o: { id: string; kind?: string; botName?: string }, names: Record<string, string>): string {
  if (o.botName) return o.botName;
  return names[o.id] || 'Magic Knight';
}

// ───────── tier emblem ─────────

function starPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M${pts.join('L')}Z`;
}

function EmblemGlyph({ index }: { index: number }) {
  const ink = { stroke: '#0b0710', 'stroke-width': 2, 'stroke-linejoin': 'round' } as const;
  switch (index) {
    case 0:
      return <path d={starPath(32, 35, 12)} fill="#fff4dc" {...ink} />;
    case 1:
      return (
        <g fill="#ffffff" {...ink}>
          <path d={starPath(23, 36, 9)} />
          <path d={starPath(41, 36, 9)} />
        </g>
      );
    case 2:
      return (
        <g fill="#fff6c4" {...ink}>
          <path d={starPath(32, 28, 9)} />
          <path d={starPath(21, 43, 8)} />
          <path d={starPath(43, 43, 8)} />
        </g>
      );
    case 3:
      return (
        <g {...ink}>
          <path d="M20 30 L26 22 H38 L44 30 L32 50 Z" fill="#e8fffb" />
          <path d="M20 30 H44 M26 22 L32 50 M38 22 L32 50" fill="none" stroke-width="1.3" />
        </g>
      );
    case 4:
      return (
        <g {...ink}>
          <path d="M32 16 L46 34 L32 54 L18 34 Z" fill="#e6f4ff" />
          <path d="M18 34 H46 M32 16 L26 34 L32 54 L38 34 Z" fill="none" stroke-width="1.3" />
        </g>
      );
    case 5:
      return (
        <g {...ink}>
          <path d="M32 40 L34 54" fill="none" stroke-width="3" stroke-linecap="round" />
          <g fill="#3ddc84">
            <circle cx="26" cy="29" r="6.5" />
            <circle cx="38" cy="29" r="6.5" />
            <circle cx="26" cy="41" r="6.5" />
            <circle cx="38" cy="41" r="6.5" />
          </g>
        </g>
      );
    default:
      return (
        <g {...ink}>
          <path d="M16 46 L14 24 L24 33 L32 19 L40 33 L50 24 L48 46 Z" fill="#ffd95a" />
          <circle cx="32" cy="38" r="3.4" fill="#ff3d6e" stroke-width="1.4" />
        </g>
      );
  }
}

export function TierEmblem({ tier, size = 56 }: { tier: Tier; size?: number }) {
  const index = TIERS.indexOf(tier);
  const gid = `arena-tg-${tier.id}`;
  return (
    <svg class={`arena-emblem tier-${tier.id}`} viewBox="0 0 64 72" width={size} height={(size * 72) / 64} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={tier.color} />
          <stop offset="1" stop-color={tier.shade} />
        </linearGradient>
      </defs>
      {index >= 5 && <path d="M6 18 L-2 30 L8 30 L2 42 L12 38 Z M58 18 L66 30 L56 30 L62 42 L52 38 Z" fill={tier.shade} stroke="#0b0710" stroke-width="2" stroke-linejoin="round" />}
      <path d="M32 3 L58 12 V34 C58 52 46 63 32 69 C18 63 6 52 6 34 V12 Z" fill={`url(#${gid})`} stroke="#0b0710" stroke-width="3" stroke-linejoin="round" />
      <path d="M32 9 L52 16 V34 C52 48 43 57 32 62 C21 57 12 48 12 34 V16 Z" fill="rgba(255,255,255,0.16)" stroke="rgba(255,255,255,0.45)" stroke-width="1.5" />
      <EmblemGlyph index={index} />
    </svg>
  );
}

function TierChip({ rating }: { rating: number }) {
  const t = tierOf(rating);
  return (
    <span class="arena-tierchip" style={{ '--tc': t.color, '--ts': t.shade } as any}>
      <TierEmblem tier={t} size={14} />
      {t.name}
    </span>
  );
}

// ───────── shared bits ─────────

function MiniLineup({ ids, size = 'md' }: { ids: string[]; size?: 'sm' | 'md' }) {
  return (
    <div class={`arena-minis ${size}`}>
      {ids.map((id, i) => (
        <div class="arena-mini" key={`${id}-${i}`} style={{ '--hc': knownHero(id) ? getHero(id).color : '#555' } as any}>
          {knownHero(id) ? <CharacterArt id={id} mode="portrait" /> : null}
        </div>
      ))}
    </div>
  );
}

function teamIds(team: TeamSetup): string[] {
  return team.members
    .slice()
    .sort((a, b) => a.slot - b.slot)
    .map((m) => m.heroId);
}

function RankCard({ rating, wins, losses, sid, now }: { rating: number; wins: number; losses: number; sid: number; now: number }) {
  const { tier, next, frac, toNext } = tierProgress(rating);
  return (
    <div class="arena-rank" style={{ '--tc': tier.color, '--ts': tier.shade } as any}>
      <div class="arena-rank-emblem">
        <TierEmblem tier={tier} size={62} />
      </div>
      <div class="arena-rank-main">
        <div class="arena-rank-tier">{tier.name}</div>
        <div class="arena-rank-rating">
          <span class="power">{rating}</span>
          <span class="muted small-text">
            {' '}
            · {wins}W {losses}L
          </span>
        </div>
        <div class="bar arena-rank-bar">
          <i style={{ width: `${Math.round(frac * 100)}%` }} />
        </div>
        <div class="arena-rank-next small-text">{next ? `${toNext} to ${next.name}` : 'Top tier reached!'}</div>
      </div>
      <div class="arena-season">
        <div class="arena-season-n">Season {sid}</div>
        <div class="arena-season-t">⏳ {longDuration(seasonEnd(sid) - now)}</div>
      </div>
    </div>
  );
}

// ───────── Battle tab ─────────

function OpponentCard({
  o,
  name,
  myRating,
  myPower,
  disabled,
  onFight,
  index,
}: {
  o: Opponent;
  name: string;
  myRating: number;
  myPower: number;
  disabled: boolean;
  onFight: () => void;
  index: number;
}) {
  const { win, loss } = ratingDeltas(myRating, o.rating);
  const ace = aceOf(o.team);
  const rel = o.power > myPower * 1.05 ? 'hi' : o.power < myPower * 0.95 ? 'lo' : 'even';
  return (
    <div class="arena-opp" style={{ animationDelay: `${index * 0.06}s` }}>
      <div class="arena-opp-top">
        <div class="arena-opp-ava" style={{ '--hc': ace ? getHero(ace).color : '#555' } as any}>
          {ace && <CharacterArt id={ace} mode="portrait" />}
        </div>
        <div class="arena-opp-info">
          <div class="arena-opp-name">
            <span class="arena-opp-nm">{name}</span>
            {o.kind === 'player' && <span class="arena-live">● Online</span>}
          </div>
          <div class="arena-opp-meta">
            <TierChip rating={o.rating} />
            <b>{o.rating}</b>
          </div>
          <div class={`arena-opp-pow ${rel}`}>⚡ {fmt(o.power)}</div>
        </div>
        <button class="btn red arena-fight" disabled={disabled} onClick={onFight}>
          Fight
          <span class="arena-fight-delta">
            +{win} / {loss}
          </span>
        </button>
      </div>
      <MiniLineup ids={teamIds(o.team)} />
    </div>
  );
}

function BattleTab({
  opponents,
  names,
  online,
  loading,
  now,
  nav,
}: {
  opponents: Opponent[];
  names: Record<string, string>;
  online: boolean;
  loading: boolean;
  now: number;
  nav: ScreenProps['nav'];
}) {
  const s = getState();
  const a = s.arena;
  const day = today(now);
  const tickets = ticketsToday(a, day);
  const cost = ticketCost(a, day);
  const freeIn = refreshFreeIn(a, now);
  const myPower = teamPower(playerTeam());
  const squadEmpty = !playerTeam().members.length;

  const fight = (o: Opponent) => {
    const err = startArenaFight(o, oppName(o, names), nav);
    if (err) toast(err);
  };

  return (
    <>
      <div class="panel arena-tickets">
        <div class="arena-tix-left">
          <div class="arena-tix-label">Arena Tickets</div>
          <div class="arena-pips" aria-label={`${tickets} tickets`}>
            {Array.from({ length: Math.max(FREE_TICKETS, tickets) }, (_, i) => (
              <span key={i} class={`arena-pip ${i < tickets ? 'on' : ''}`} />
            ))}
            <b class="arena-tix-n">{tickets}</b>
          </div>
        </div>
        <button
          class="btn small green arena-buy"
          disabled={cost === null}
          onClick={() => {
            const err = buyTicket();
            if (err !== '') toast(err ?? '+1 Arena ticket!');
          }}
        >
          {cost === null ? (
            'Sold out'
          ) : (
            <>
              +1 <span class="cost">
                <CurrencyIcon kind="gems" size={16} />
                {cost}
              </span>
            </>
          )}
        </button>
      </div>

      <div class="spread arena-opps-head">
        <h3 class="arena-h">Choose your opponent</h3>
        <button
          class="btn small dark arena-refresh"
          onClick={() => {
            const err = refreshOpponents();
            if (err) toast(err);
          }}
        >
          🔄{' '}
          {freeIn > 0 ? (
            <span class="cost">
              <CurrencyIcon kind="gems" size={14} />
              {REFRESH_GEMS}
            </span>
          ) : (
            'Free'
          )}
        </button>
      </div>
      {freeIn > 0 && <div class="small-text muted arena-free-in">Free refresh in {formatDuration(freeIn)}</div>}

      {squadEmpty ? (
        <div class="panel empty-hint">
          Your squad is empty.
          <div class="section-gap" />
          <button class="btn" onClick={() => nav.go('squad')}>
            Build Squad
          </button>
        </div>
      ) : loading ? (
        <div class="arena-opps" aria-busy="true" aria-label="Finding opponents">
          {[0, 1, 2, 3].map((i) => (
            <div class="arena-opp arena-skel" key={i}>
              <div class="arena-opp-top">
                <div class="arena-opp-ava" />
                <div class="arena-opp-info">
                  <i class="arena-skel-line w60" />
                  <i class="arena-skel-line w40" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div class="arena-opps">
          {opponents.map((o, i) => (
            <OpponentCard
              key={o.id}
              index={i}
              o={o}
              name={oppName(o, names)}
              myRating={a.rating}
              myPower={myPower}
              disabled={tickets < 1}
              onFight={() => fight(o)}
            />
          ))}
        </div>
      )}

      {tickets < 1 && !squadEmpty && <div class="arena-note warn">Out of tickets — 5 free tickets arrive tomorrow, or buy one above.</div>}
      <div class="arena-note">
        Your power: <b class="power">⚡ {fmt(myPower)}</b>. Leaving a fight early counts as a loss.{' '}
        {loading ? 'Looking for online players…' : online ? 'Players marked Online are real squads.' : 'Offline: rival Magic Knights fill in.'}
      </div>
    </>
  );
}

// ───────── Defense tab ─────────

function DefenseTab({ nav }: { nav: ScreenProps['nav'] }) {
  const s = getState();
  const a = s.arena;
  const [pub, setPub] = useState(publishStatus());
  useEffect(() => onPublishStatus(() => setPub(publishStatus())), []);
  const lineup = defenseLineup(s);
  const team = lineupTeam(lineup, s);
  const formation = FORMATION_MAP[lineup.formation] ?? FORMATIONS[0];
  const power = teamPower(team);
  const locked = !!a.defense;
  const differs = locked && (a.defense!.formation !== s.squad.formation || a.defense!.slots.some((id, i) => (id ?? null) !== (s.squad.slots[i] ?? null)));
  const bySlot = new Map(team.members.map((m) => [m.slot, m]));
  const rowSlots = (row: 'front' | 'back') => formation.rows.map((r, i) => (r === row ? i : -1)).filter((i) => i >= 0);

  const slot = (i: number) => {
    const m = bySlot.get(i);
    if (!m)
      return (
        <div class="arena-dslot empty" key={i}>
          <div class="arena-dslot-art" />
          <div class="arena-dslot-name">Empty</div>
        </div>
      );
    const h = getHero(m.heroId);
    return (
      <button class="arena-dslot" key={i} style={{ '--hc': h.color } as any} onClick={() => nav.openHero(m.heroId)}>
        <div class="arena-dslot-art">
          <CharacterArt id={m.heroId} mode="portrait" />
        </div>
        <div class="arena-dslot-lv">Lv{m.level}</div>
        <div class="arena-dslot-name">{h.name.split(' ')[0]}</div>
        <Stars n={m.stars} />
      </button>
    );
  };

  return (
    <>
      <div class="panel arena-def">
        <div class="spread">
          <h3 class="panel-title" style={{ margin: 0 }}>
            🛡️ Your Defense
          </h3>
          <span class="power arena-def-pow">⚡ {fmt(power)}</span>
        </div>
        <div class="row wrap arena-def-tags">
          <span class="chip">{formation.name}</span>
          <span class={`chip ${locked ? 'on' : ''}`}>{locked ? '🔒 Locked in' : '🔁 Follows your squad'}</span>
        </div>
        {(['front', 'back'] as const).map((row) =>
          rowSlots(row).length ? (
            <div class="arena-drow" key={row}>
              <div class={`arena-drow-lbl ${row}`}>{row === 'front' ? 'FRONT' : 'BACK'}</div>
              <div class="arena-drow-slots">
                {rowSlots(row).map(slot)}
              </div>
            </div>
          ) : null,
        )}
        {differs && <div class="arena-note warn">Your squad has changed since you locked this defense in.</div>}
        <button
          class="btn green block arena-def-set"
          onClick={() => {
            if (!playerTeam().members.length) return toast('Your squad is empty.');
            setDefenseFromSquad();
            toast('Defense locked in!');
          }}
        >
          Set current squad as defense
        </button>
        <div class="row arena-def-btns">
          {locked && (
            <button
              class="btn small dark"
              onClick={() => {
                followSquad();
                toast('Your defense now follows your squad.');
              }}
            >
              Follow my squad
            </button>
          )}
          <button class="btn small dark" onClick={() => nav.go('squad')}>
            Edit squad
          </button>
        </div>
      </div>
      <div class="panel arena-def-info">
        <div class={`arena-pub ${pub}`}>
          {pub === 'live'
            ? '🌐 Online — other players can challenge this squad.'
            : pub === 'pending'
              ? '⏳ Sending your defense online…'
              : pub === 'error'
                ? '⚠️ Your defense could not go online. Offline rivals still work.'
                : '📴 Offline — your defense is saved on this device.'}
        </div>
        <ul class="arena-tips">
          <li>Other players attack this squad. The AI fights for you.</li>
          <li>Defending never changes your rating, so experiment freely.</li>
          <li>Tip: sturdy Defenders up front and a healer behind are hard to crack.</li>
        </ul>
      </div>
    </>
  );
}

// ───────── Ranks tab ─────────

interface BoardRow {
  id: string;
  name: string;
  rating: number;
  ace: string | null;
  me?: boolean;
  online?: boolean;
}

function RanksTab({ now, names, uid, board, boardState }: { now: number; names: Record<string, string>; uid: string | null; board: OnlineDefense[]; boardState: 'loading' | 'online' | 'offline' }) {
  const s = getState();
  const sid = seasonId(now);
  const hourKey = Math.floor(now / 600000);
  const bots = useMemo(() => leaderboardBots(sid, now), [sid, hourKey]);
  const myAce = aceOf(playerTeam());
  const rows = ([
    ...bots.map((b) => ({ id: b.id, name: b.name, rating: b.rating, ace: b.ace })),
    ...board.filter((p) => p.id !== uid).map((p) => ({ id: p.id, name: names[p.id] || 'Magic Knight', rating: p.rating, ace: aceOf(p.team), online: true })),
    { id: 'me', name: 'You', rating: s.arena.rating, ace: myAce, me: true },
  ] as BoardRow[]).sort((x, y) => y.rating - x.rating || (x.me ? -1 : y.me ? 1 : 0));
  const myRank = rows.findIndex((r) => r.me) + 1;
  const top = rows.slice(0, 50);

  const row = (r: BoardRow, rank: number) => (
    <div key={r.id} class={`arena-lb-row ${r.me ? 'me' : ''} ${rank <= 3 ? `top${rank}` : ''}`}>
      <span class="arena-lb-rank">{rank}</span>
      <span class="arena-lb-ava" style={{ '--hc': r.ace && knownHero(r.ace) ? getHero(r.ace).color : '#555' } as any}>
        {r.ace && knownHero(r.ace) && <CharacterArt id={r.ace} mode="portrait" />}
      </span>
      <span class="arena-lb-name">
        <span class="arena-lb-nm">{r.name}</span>
        {r.online && <span class="arena-live sm">●</span>}
      </span>
      <TierEmblem tier={tierOf(r.rating)} size={20} />
      <b class="arena-lb-rating">{r.rating}</b>
    </div>
  );

  return (
    <>
      <div class="spread arena-lb-head">
        <h3 class="arena-h">Season {sid} Top 50</h3>
        <span class="small-text muted">{boardState === 'loading' ? 'Loading…' : boardState === 'online' ? '🌐 Live' : '📴 Offline'}</span>
      </div>
      <div class="panel arena-lb">
        {top.map((r, i) => row(r, i + 1))}
        {myRank > 50 && (
          <>
            <div class="arena-lb-gap">⋯</div>
            {row(rows[myRank - 1], myRank)}
          </>
        )}
      </div>
      <div class="arena-note">Season rewards by tier land when the week ends. Rankings mix online players (●) with rival Magic Knights.</div>
      <div class="panel arena-tiers">
        <h3 class="arena-h">Season rewards</h3>
        {TIERS.slice()
          .reverse()
          .map((t) => {
            const i = TIERS.indexOf(t);
            const on = tierIndex(s.arena.rating) === i;
            return (
              <div class={`arena-tier-row ${on ? 'on' : ''}`} key={t.id}>
                <TierEmblem tier={t} size={26} />
                <span class="arena-tier-name">{t.name}</span>
                <span class="arena-tier-min small-text muted">{t.min ? `${t.min}+` : ''}</span>
                <span class="arena-tier-rew">
                  <CurrencyIcon kind="gems" size={14} />
                  {SEASON_GEMS[i]}
                  <CurrencyIcon kind="medals" size={14} />
                  {SEASON_MEDALS[i]}
                </span>
              </div>
            );
          })}
      </div>
    </>
  );
}

// ───────── Shop tab ─────────

const ITEM_NAMES: Record<ShopItem['kind'], string> = { pages: 'Grimoire Pages', tickets: 'Summon Ticket', essence: 'Essence', yul: 'Yul' };

function ShopTab({ now }: { now: number }) {
  const s = getState();
  const day = today(now);
  const items = useMemo(() => shopItems(day, s.stage), [day, s.stage]);
  return (
    <>
      <div class="panel arena-medals">
        <CurrencyIcon kind="medals" size={34} />
        <div>
          <div class="arena-medals-n power">{fmt(s.currencies.medals)}</div>
          <div class="small-text muted">Honor Medals</div>
        </div>
        <div class="arena-restock small-text">
          Restocks in
          <br />
          <b>{formatDuration(untilMidnight(now))}</b>
        </div>
      </div>
      <div class="arena-shop">
        {items.map((it) => {
          const left = shopLeft(s.arena, day, it);
          const h = it.kind === 'pages' && it.heroId && knownHero(it.heroId) ? getHero(it.heroId) : null;
          const afford = s.currencies.medals >= it.cost;
          return (
            <div class={`arena-item ${h ? h.rarity : ''} ${left ? '' : 'sold'}`} key={it.id} style={h ? ({ '--hc': h.color } as any) : undefined}>
              <div class="arena-item-art">
                {h ? (
                  <>
                    <CharacterArt id={h.id} mode="portrait" />
                    <RarityBadge r={h.rarity} short class="arena-item-rar" />
                  </>
                ) : (
                  <CurrencyIcon kind={it.kind === 'tickets' ? 'tickets' : it.kind === 'essence' ? 'essence' : 'yul'} size={46} />
                )}
                <span class="arena-item-amt">×{fmt(it.amount)}</span>
              </div>
              <div class="arena-item-name">{h ? `${h.name.split(' ')[0]} Pages` : ITEM_NAMES[it.kind]}</div>
              <div class="arena-item-left small-text">{left ? `${left}/${it.limit} left today` : 'Sold out'}</div>
              <button
                class="btn small arena-item-buy"
                disabled={!left || !afford}
                onClick={() => {
                  const err = buyShopItem(it.id);
                  if (err !== null) return err ? toast(err) : undefined;
                  const r = itemReward(it);
                  toast(h ? `+${it.amount} ${h.name.split(' ')[0]} pages!` : `+${fmt(r.essence ?? r.yul ?? r.tickets ?? 0)} ${ITEM_NAMES[it.kind]}!`);
                }}
              >
                <span class="cost">
                  <CurrencyIcon kind="medals" size={16} />
                  {it.cost}
                </span>
              </button>
            </div>
          );
        })}
      </div>
      <div class="arena-note">Win Arena fights and finish seasons in high tiers to earn Honor Medals. 10 pages unlock a new hero.</div>
    </>
  );
}

// ───────── History tab ─────────

function HistoryTab({ now, names }: { now: number; names: Record<string, string> }) {
  const a = getState().arena;
  const list = a.history;
  return (
    <>
      <div class="panel arena-hist-sum">
        <div>
          <div class="small-text muted">This season</div>
          <b>
            {a.seasonWins}W · {a.seasonLosses}L
          </b>
        </div>
        <div>
          <div class="small-text muted">Best rating</div>
          <b>{Math.max(a.bestRating || 0, a.rating)}</b>
        </div>
        <div>
          <div class="small-text muted">All time</div>
          <b>
            {a.wins}W · {a.losses}L
          </b>
        </div>
      </div>
      {!list.length ? (
        <div class="panel empty-hint">No fights yet. Pick an opponent on the Battle tab!</div>
      ) : (
        <div class="arena-hist">
          {list.map((h: ArenaHistoryEntry) => {
            // A fight still marked forfeit was left early (or the app closed mid-fight). A fight that
            // is actually running sits under the battle overlay, so it is never seen here.
            const left = !!h.forfeit;
            const cls = left ? 'left' : h.won ? 'win' : 'loss';
            return (
              <div class={`arena-hist-row ${cls}`} key={`${h.at}-${h.opponent}`}>
                <div class="arena-hist-stamp">{left ? 'LEFT' : h.won ? 'WIN' : 'LOSS'}</div>
                <div class="arena-hist-main">
                  <div class="arena-hist-name">{oppName({ id: h.opponent, botName: h.botName }, names)}</div>
                  <div class="small-text muted">
                    {ago(h.at, now)}
                    {typeof h.oppRating === 'number' ? ` · ${h.oppRating}` : ''}
                    {typeof h.oppPower === 'number' ? ` · ⚡${fmt(h.oppPower)}` : ''}
                  </div>
                  {Array.isArray(h.lineup) && <MiniLineup ids={h.lineup.slice(0, 5).filter((x) => typeof x === 'string')} size="sm" />}
                </div>
                <div class={`arena-hist-delta ${h.delta >= 0 ? 'up' : 'down'}`}>
                  {h.delta >= 0 ? '+' : ''}
                  {h.delta}
                  {h.medals ? (
                    <span class="arena-hist-medals">
                      <CurrencyIcon kind="medals" size={13} />
                      {h.medals}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ───────── season summary ─────────

function SeasonModal() {
  const r = getState().arena.seasonResult;
  if (!r) return null;
  const tier = tierOf(r.rating);
  const close = () => {
    const got = claimSeason();
    if (got) toast('Season rewards collected!');
  };
  return (
    <Modal center onClose={close}>
      <div class="arena-sm" style={{ '--tc': tier.color, '--ts': tier.shade } as any}>
        <div class="arena-sm-burst" />
        <div class="arena-sm-kicker">Season {r.id} complete!</div>
        <div class="arena-sm-emblem">
          <TierEmblem tier={tier} size={96} />
        </div>
        <h2 class="arena-sm-tier">{tier.name}</h2>
        <div class="arena-sm-stats">
          <div>
            <span class="muted small-text">Final</span>
            <b>{r.rating}</b>
          </div>
          <div>
            <span class="muted small-text">Best</span>
            <b>{r.best}</b>
          </div>
          <div>
            <span class="muted small-text">Record</span>
            <b>
              {r.wins}W {r.losses}L
            </b>
          </div>
        </div>
        <RewardList r={{ gems: r.gems, medals: r.medals }} />
        <p class="small-text arena-sm-reset">
          New season, fresh start: your rating moves from {r.rating} to <b>{r.newRating}</b>.
        </p>
        <button class="btn green block" onClick={close}>
          Collect rewards
        </button>
      </div>
    </Modal>
  );
}

// ───────── page ─────────

function ArenaPage({ nav, params }: ScreenProps) {
  const s = useGame();
  const now = useNow(1000);
  const sid = seasonId(now);
  const initial = typeof params?.tab === 'string' && TABS.some((t) => t.id === params.tab) ? (params.tab as ArenaTab) : 'battle';
  const [tab, setTab] = useState<ArenaTab>(initial);
  const [pool, setPool] = useState<OnlineDefense[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [names, setNames] = useState<Record<string, string>>({});
  const [board, setBoard] = useState<OnlineDefense[]>([]);
  const [boardState, setBoardState] = useState<'loading' | 'online' | 'offline'>('loading');

  // Repair / new day / season rollover on open and whenever the season or day changes.
  const day = today(now);
  useEffect(() => {
    ensureArena();
  }, [sid, day]);

  // Online defenses for this opponent list. A slow answer is kept for the next list instead of
  // swapping cards under the player's thumb.
  useEffect(() => {
    let alive = true;
    let settled = false;
    schedulePublish(1500);
    const t = setTimeout(() => {
      if (!alive || settled) return;
      settled = true;
      setLoading(false);
    }, POOL_WAIT_MS);
    void (async () => {
      const [id, list] = await Promise.all([myUid(), fetchPool()]);
      if (!alive) return;
      setUid(id);
      setOnline(!!id);
      if (settled) return;
      settled = true;
      clearTimeout(t);
      setPool(list);
      setLoading(false);
    })();
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [s.arena.oppSeed]);

  useEffect(() => {
    if (tab !== 'ranks') return;
    let alive = true;
    setBoardState((b) => (b === 'online' ? b : 'loading'));
    void fetchBoard(sid).then(
      (r) => {
        if (!alive) return;
        setBoard(r.list);
        setBoardState(r.uid ? 'online' : 'offline');
      },
      () => alive && setBoardState('offline'),
    );
    return () => {
      alive = false;
    };
  }, [tab, sid]);

  const a = s.arena;
  const myPower = teamPower(playerTeam());
  const opponents = useMemo(
    () => pickOpponents({ seed: a.oppSeed, rating: a.rating, power: myPower, pool, selfId: uid }),
    [a.oppSeed, a.rating, myPower, pool, uid],
  );

  // Resolve real players' names for whatever is on screen (never stored).
  const idKey = [...opponents.filter((o) => o.kind === 'player').map((o) => o.id), ...a.history.filter((h) => !h.botName).map((h) => h.opponent), ...board.map((p) => p.id)]
    .filter((id, i, xs) => xs.indexOf(id) === i)
    .sort()
    .join('|');
  useEffect(() => {
    if (!idKey) return;
    let alive = true;
    void resolveNames(idKey.split('|')).then((n) => alive && setNames((old) => ({ ...old, ...n })));
    return () => {
      alive = false;
    };
  }, [idKey]);

  if (s.stage < ARENA_UNLOCK) return <div class="screen empty-hint">The Arena opens after clearing {ARENA_UNLOCK} campaign stages.</div>;

  return (
    <div class="screen arena">
      <RankCard rating={a.rating} wins={a.seasonWins} losses={a.seasonLosses} sid={sid} now={now} />
      <div class="arena-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} class={`arena-tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
            <span class="arena-tab-ico">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
      <div class="arena-body" key={tab}>
        {tab === 'battle' && <BattleTab opponents={opponents} names={names} online={online} loading={loading} now={now} nav={nav} />}
        {tab === 'defense' && <DefenseTab nav={nav} />}
        {tab === 'ranks' && <RanksTab now={now} names={names} uid={uid} board={board} boardState={boardState} />}
        {tab === 'shop' && <ShopTab now={now} />}
        {tab === 'history' && <HistoryTab now={now} names={names} />}
      </div>
      <SeasonModal />
    </div>
  );
}

export const arenaScreen: ScreenDef = {
  id: 'arena',
  title: 'Arena',
  icon: '⚔️',
  blurb: "Battle other players' defense squads and climb the ranks.",
  unlockStage: 10,
  component: ArenaPage,
  badge: (s) => {
    if ((s.stage ?? 0) < ARENA_UNLOCK || !s.arena) return false;
    if (s.arena.seasonResult) return true;
    return ticketsToday(s.arena, today()) > 0;
  },
};
