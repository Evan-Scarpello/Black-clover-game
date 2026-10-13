// Arena actions: apply the pure rules in logic.ts to the save, one commit per player action.

import { bump } from '../../game/quests';
import { randomSeed } from '../../game/rng';
import { today, type Reward } from '../../game/state';
import { commit, emitGameEvent, getState, grantReward, playerTeam } from '../../game/store';
import type { BattleSpec, Nav } from '../../ui/nav';
import {
  HISTORY_MAX,
  REFRESH_GEMS,
  applyDelta,
  fightMedals,
  ratingDeltas,
  refreshFreeIn,
  refreshTickets,
  rollSeason,
  sanitizeArena,
  shopItems,
  shopLeft,
  ticketCost,
  tierIndex,
  TIERS,
  type Opponent,
  type ShopItem,
} from './logic';
import { fetchPool, schedulePublish } from './online';
import type { ArenaHistoryEntry } from './state';

/** Colosseum at sunset. */
export const ARENA_THEME: BattleSpec['theme'] = { sky: ['#ffb45e', '#a2342c'], ground: '#c08a52' };

/** Bring the slice up to date (repair, new ticket day, season rollover). Commits only on change. */
export function ensureArena(now = Date.now()): boolean {
  const s = getState();
  const before = JSON.stringify(s.arena);
  const a = sanitizeArena(s.arena);
  refreshTickets(a, today(now));
  rollSeason(a, now);
  if (JSON.stringify(a) === before) return false;
  commit();
  return true;
}

let lastStart = 0;

/** Swallow an accidental double tap on a paid button (a deliberate second purchase is slower).
 * Paid actions return '' for a swallowed tap, an error message, or null on success. */
const lastTap: Record<string, number> = {};
function doubleTap(key: string, now: number, ms = 350): boolean {
  const prev = lastTap[key] ?? -Infinity;
  lastTap[key] = now;
  return now - prev >= 0 && now - prev < ms;
}

/**
 * Spend a ticket and launch a fight. The loss is recorded up front (leaving early counts as a
 * loss); finishing the fight corrects it. Returns an error message, or null when the fight started.
 */
export function startArenaFight(opp: Opponent, displayName: string, nav: Nav, now = Date.now()): string | null {
  if (now - lastStart < 1500) return null; // double tap
  const s = getState();
  const a = sanitizeArena(s.arena);
  refreshTickets(a, today(now));
  rollSeason(a, now);
  if (a.tickets < 1) return 'No Arena tickets left today.';
  const ally = playerTeam();
  if (!ally.members.length) return 'Put some heroes in your squad first!';
  if (!opp.team.members.length) return 'That opponent has no squad.';
  lastStart = now;

  const { win, loss } = ratingDeltas(a.rating, opp.rating);
  const key = `arena-${now}-${opp.id}`;
  a.tickets--;
  a.pending = { key, at: now, before: a.rating, winDelta: win, lossDelta: loss };
  a.rating = applyDelta(a.rating, loss);
  a.losses++;
  a.seasonLosses++;
  const entry: ArenaHistoryEntry = {
    at: now,
    opponent: opp.id,
    won: false,
    delta: loss,
    forfeit: true,
    oppRating: opp.rating,
    oppPower: opp.power,
    lineup: opp.team.members
      .slice()
      .sort((x, y) => x.slot - y.slot)
      .map((m) => m.heroId),
  };
  if (opp.kind === 'bot' && opp.botName) entry.botName = opp.botName;
  a.history.unshift(entry);
  if (a.history.length > HISTORY_MAX) a.history.length = HISTORY_MAX;
  // A fresh set of opponents after every fight.
  a.oppSeed = randomSeed();
  commit();
  schedulePublish();

  const name = displayName.slice(0, 22) || 'Magic Knight';
  nav.battle({
    key,
    kind: 'arena',
    label: 'Arena',
    title: `vs ${name}`,
    theme: ARENA_THEME,
    ally,
    // Keep the team bonus: a bot's "training bonus" or a player's clan research is part of its power.
    enemy: { members: opp.team.members.map((m) => ({ ...m })), formation: opp.team.formation, bonus: opp.team.bonus },
    banner: 'ARENA!',
    finish: (b) => finishArenaFight(key, b.winner === 0, b.ultsCast[0], nav),
  });
  return null;
}

/** Settle a started fight. Idempotent: a second call for the same key changes nothing. */
export function finishArenaFight(key: string, won: boolean, ults: number, nav: Nav) {
  const s = getState();
  const a = s.arena;
  const p = a.pending;
  const next = { label: 'Next Opponent', go: () => nav.closeBattle() };
  if (!p || p.key !== key) return { won, notes: ['Result already recorded'], next, canRetry: false };
  a.pending = null;
  const tierBefore = tierIndex(a.rating - p.lossDelta);
  let delta = p.lossDelta;
  if (won) {
    delta = p.winDelta;
    // Relative fix-up keeps any season reset that happened mid-fight.
    a.rating = applyDelta(a.rating, p.winDelta - p.lossDelta);
    a.losses = Math.max(0, a.losses - 1);
    a.seasonLosses = Math.max(0, a.seasonLosses - 1);
    a.wins++;
    a.seasonWins++;
  }
  a.bestRating = Math.max(a.bestRating || 0, a.rating);
  const medals = fightMedals(a.rating - delta, won);
  const e = a.history.find((h) => h.at === p.at);
  if (e) {
    e.won = won;
    e.delta = delta;
    e.forfeit = false;
    e.medals = medals;
  }
  const reward: Reward = { medals };
  grantReward(reward);
  if (ults > 0) bump(s, 'ult', ults);
  emitGameEvent({ type: 'battle', kind: 'arena', won });
  commit();
  schedulePublish();

  const notes = [`Rating ${delta >= 0 ? '+' : ''}${delta} → ${a.rating}`];
  const tierAfter = tierIndex(a.rating);
  if (tierAfter > tierBefore) notes.push(`Promoted to ${TIERS[tierAfter].name}!`);
  else if (tierAfter < tierBefore) notes.push(`Dropped to ${TIERS[tierAfter].name}`);
  return { won, reward, notes, next, canRetry: false };
}

/** Buy one extra ticket with gems (escalating price, limited per day). */
export function buyTicket(now = Date.now()): string | null {
  if (doubleTap('ticket', now)) return '';
  const s = getState();
  const a = sanitizeArena(s.arena);
  refreshTickets(a, today(now));
  const cost = ticketCost(a, today(now));
  if (cost === null) return 'No more ticket purchases today.';
  if (s.currencies.gems < cost) return 'Not enough gems.';
  s.currencies.gems -= cost;
  a.tickets++;
  a.bought++;
  commit();
  return null;
}

/** New opponents: free every few minutes, otherwise a few gems. */
export function refreshOpponents(now = Date.now()): string | null {
  if (doubleTap('refresh', now)) return '';
  const s = getState();
  const a = sanitizeArena(s.arena);
  if (refreshFreeIn(a, now) > 0) {
    if (s.currencies.gems < REFRESH_GEMS) return 'Not enough gems.';
    s.currencies.gems -= REFRESH_GEMS;
  } else a.refreshAt = now;
  a.oppSeed = randomSeed();
  commit();
  void fetchPool(true);
  return null;
}

/** Lock in the current squad as the defense other players fight. */
export function setDefenseFromSquad(now = Date.now()) {
  const s = getState();
  s.arena.defense = { formation: s.squad.formation, slots: s.squad.slots.slice(0, 5) };
  s.arena.defenseAt = now;
  commit();
  schedulePublish(1500);
}

/** Let the defense follow the squad again. */
export function followSquad() {
  const s = getState();
  s.arena.defense = null;
  s.arena.defenseAt = 0;
  commit();
  schedulePublish(1500);
}

export function itemReward(item: ShopItem): Reward {
  switch (item.kind) {
    case 'pages':
      return { shards: { [item.heroId!]: item.amount } };
    case 'tickets':
      return { tickets: item.amount };
    case 'essence':
      return { essence: item.amount };
    case 'yul':
      return { yul: item.amount };
  }
}

/** Spend Honor Medals in the shop. Returns an error message or null on success. */
export function buyShopItem(itemId: string, now = Date.now()): string | null {
  if (doubleTap(`shop:${itemId}`, now)) return '';
  const s = getState();
  const a = sanitizeArena(s.arena);
  const day = today(now);
  const item = shopItems(day, s.stage).find((i) => i.id === itemId);
  if (!item) return 'That offer has expired.';
  if (a.shopDay !== day) {
    a.shopDay = day;
    a.shopBought = {};
  }
  if (shopLeft(a, day, item) <= 0) return 'Sold out for today.';
  if (s.currencies.medals < item.cost) return 'Not enough Honor Medals.';
  s.currencies.medals -= item.cost;
  a.shopBought[item.id] = (a.shopBought[item.id] ?? 0) + 1;
  grantReward(itemReward(item));
  emitGameEvent({ type: 'feature', name: 'arenaShop', amount: item.cost });
  commit();
  return null;
}

/** Collect last season's tier reward. */
export function claimSeason(): Reward | null {
  const s = getState();
  const r = s.arena.seasonResult;
  if (!r) return null;
  const reward: Reward = { gems: Math.max(0, r.gems | 0), medals: Math.max(0, r.medals | 0) };
  s.arena.seasonResult = null;
  grantReward(reward);
  emitGameEvent({ type: 'feature', name: 'arenaSeason' });
  commit();
  return reward;
}
