// Arena rules as pure functions: Elo rating, tiers, daily tickets, weekly seasons, the
// Honor Medal shop, offline rival (bot) generation, online-defense validation and
// matchmaking. No store access here — actions.ts applies these to the save.

import { afkRates } from '../../data/campaign';
import { FORMATIONS, FORMATION_MAP } from '../../data/formations';
import { HERO_MAP, SUMMONABLE } from '../../data/heroes';
import type { Combatant, TeamSetup } from '../../game/battle';
import { teamPower } from '../../game/power';
import { rng, type Rng } from '../../game/rng';
import { RARITY_INFO, levelCap } from '../../game/stats';
import type { FormationDef, HeroDef, Rarity, StatMods } from '../../game/types';
import { defaultArena, type ArenaSave, type ArenaSeasonResult } from './state';

// ───────── hashing / seeded helpers ─────────

/** FNV-1a 32-bit hash of a string. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mix numbers into one well-spread uint32 seed. */
export function mixSeed(...parts: number[]): number {
  let h = 0x9e3779b9;
  for (const p of parts) {
    h ^= (p >>> 0) + 0x7f4a7c15 + (h << 6) + (h >>> 2);
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
  }
  return h >>> 0;
}

function pick<T>(r: Rng, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length) % xs.length];
}

function shuffle<T>(r: Rng, xs: readonly T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

// ───────── rating (Elo) ─────────

export const START_RATING = 1000;
export const ELO_K = 32;
export const MIN_DELTA = 5;
export const MIN_RATING = 0;
export const MAX_RATING = 5000;

/** Chance the player (rating `me`) beats `opp` according to Elo. */
export function expectedScore(me: number, opp: number): number {
  return 1 / (1 + Math.pow(10, (opp - me) / 400));
}

/** Plain Elo change for one fight, at least ±MIN_DELTA. */
export function eloDelta(me: number, opp: number, won: boolean, k = ELO_K): number {
  const d = Math.round(k * ((won ? 1 : 0) - expectedScore(me, opp)));
  return won ? Math.max(MIN_DELTA, d) : Math.min(-MIN_DELTA, d);
}

/** Losses cost less in the lower tiers so new players can climb. */
export function lossFactor(rating: number): number {
  const t = tierIndex(rating);
  return t === 0 ? 0.5 : t === 1 ? 0.75 : 1;
}

/** Rating change for a win and for a loss against `opp` (never drops below MIN_RATING). */
export function ratingDeltas(me: number, opp: number): { win: number; loss: number } {
  const win = Math.min(eloDelta(me, opp, true), MAX_RATING - me);
  const loss = Math.max(Math.min(-MIN_DELTA, Math.round(eloDelta(me, opp, false) * lossFactor(me))), MIN_RATING - me);
  return { win, loss };
}

export function applyDelta(rating: number, delta: number): number {
  return clamp(Math.round(rating + delta), MIN_RATING, MAX_RATING);
}

// ───────── tiers ─────────

export interface Tier {
  id: string;
  name: string;
  min: number;
  color: string;
  /** Darker shade for gradients/outlines. */
  shade: string;
  icon: string;
}

export const TIERS: Tier[] = [
  { id: 'bronze', name: 'Bronze', min: 0, color: '#d98b4a', shade: '#8a4b1f', icon: '🥉' },
  { id: 'silver', name: 'Silver', min: 1100, color: '#d6dce8', shade: '#7d879c', icon: '🥈' },
  { id: 'gold', name: 'Gold', min: 1200, color: '#ffc531', shade: '#b77800', icon: '🥇' },
  { id: 'platinum', name: 'Platinum', min: 1300, color: '#5ee6cf', shade: '#1d8f7f', icon: '💠' },
  { id: 'diamond', name: 'Diamond', min: 1450, color: '#7cc4ff', shade: '#2f6fd0', icon: '💎' },
  { id: 'captain', name: 'Magic Knight Captain', min: 1600, color: '#c58bff', shade: '#6d32c4', icon: '🛡️' },
  { id: 'wizard', name: 'Wizard King', min: 1800, color: '#ff5d7e', shade: '#b0123f', icon: '👑' },
];

export function tierIndex(rating: number): number {
  let i = 0;
  for (let t = 0; t < TIERS.length; t++) if (rating >= TIERS[t].min) i = t;
  return i;
}

export function tierOf(rating: number): Tier {
  return TIERS[tierIndex(rating)];
}

/** Progress through the current tier toward the next one. */
export function tierProgress(rating: number): { tier: Tier; next: Tier | null; frac: number; toNext: number } {
  const i = tierIndex(rating);
  const tier = TIERS[i];
  const next = TIERS[i + 1] ?? null;
  if (!next) return { tier, next, frac: 1, toNext: 0 };
  const lo = i === 0 ? START_RATING - 100 : tier.min;
  return { tier, next, frac: clamp((rating - lo) / (next.min - lo), 0, 1), toNext: next.min - rating };
}

/** Honor Medals for one fight. */
export function fightMedals(rating: number, won: boolean): number {
  return won ? 20 + 4 * tierIndex(rating) : 6;
}

// ───────── tickets ─────────

export const FREE_TICKETS = 5;
/** Gem price of each extra ticket bought on the same day. */
export const TICKET_COSTS = [20, 30, 40, 60, 80, 100];

/** Tickets the player has today (without mutating the save). */
export function ticketsToday(a: ArenaSave, day: string): number {
  const t = Number.isFinite(a.tickets) ? Math.max(0, a.tickets) : 0;
  return a.ticketDay === day ? t : Math.max(t, FREE_TICKETS);
}

/** Start a new ticket day: refill the free tickets (purchased extras carry over). */
export function refreshTickets(a: ArenaSave, day: string) {
  if (a.ticketDay === day) return;
  a.tickets = ticketsToday(a, day);
  a.ticketDay = day;
  a.bought = 0;
}

/** Gem cost of the next extra ticket today, or null when today's purchases are used up. */
export function ticketCost(a: ArenaSave, day: string): number | null {
  const bought = a.ticketDay === day ? a.bought || 0 : 0;
  return TICKET_COSTS[bought] ?? null;
}

// ───────── opponent refresh ─────────

export const FREE_REFRESH_MS = 5 * 60 * 1000;
export const REFRESH_GEMS = 10;

export function refreshFreeIn(a: ArenaSave, now: number): number {
  return Math.max(0, (a.refreshAt || 0) + FREE_REFRESH_MS - now);
}

// ───────── seasons (one per week, Monday 00:00 UTC) ─────────

export const WEEK_MS = 7 * 24 * 3600 * 1000;
/** Monday 5 Jan 2026, 00:00 UTC — the start of Season 1. */
export const SEASON_EPOCH = Date.UTC(2026, 0, 5);

export function seasonId(now: number): number {
  return Math.max(1, Math.floor((now - SEASON_EPOCH) / WEEK_MS) + 1);
}

export function seasonStart(id: number): number {
  return SEASON_EPOCH + (id - 1) * WEEK_MS;
}

export function seasonEnd(id: number): number {
  return SEASON_EPOCH + id * WEEK_MS;
}

/** Halve the distance to the starting rating. */
export function softReset(rating: number): number {
  return Math.round(START_RATING + (rating - START_RATING) / 2);
}

/** A rating published in an older season, as it would stand now after each missed soft reset. */
export function currentRating(rating: number, docSeason: number | null, sid: number): number {
  if (docSeason === null || docSeason >= sid) return rating;
  let r = rating;
  for (let i = 0; i < Math.min(sid - docSeason, 12); i++) r = softReset(r);
  return r;
}

export const SEASON_GEMS = [60, 100, 160, 240, 350, 500, 800];
export const SEASON_MEDALS = [120, 200, 300, 420, 560, 750, 1000];

export function seasonReward(rating: number): { gems: number; medals: number } {
  const t = tierIndex(rating);
  return { gems: SEASON_GEMS[t], medals: SEASON_MEDALS[t] };
}

/**
 * Move the save into the season containing `now`. When the stored season has ended and the
 * player fought in it, records the result (tier reward to collect) and soft-resets the rating.
 * Returns the new result, or null when nothing changed for the player.
 */
export function rollSeason(a: ArenaSave, now: number): ArenaSeasonResult | null {
  const sid = seasonId(now);
  if (a.seasonId === sid) return null;
  if (!a.seasonId || a.seasonId > sid) {
    // First visit (or a clock that went backwards): just join the current season.
    a.seasonId = sid;
    return null;
  }
  const fights = (a.seasonWins || 0) + (a.seasonLosses || 0);
  const before = a.rating;
  a.rating = softReset(a.rating);
  let result: ArenaSeasonResult | null = null;
  if (fights > 0) {
    const r = seasonReward(before);
    result = {
      id: a.seasonId,
      rating: before,
      best: Math.max(a.bestRating || 0, before),
      wins: a.seasonWins || 0,
      losses: a.seasonLosses || 0,
      gems: r.gems,
      medals: r.medals,
      newRating: a.rating,
    };
    // An older unclaimed result is replaced: keep the better reward.
    if (!a.seasonResult || a.seasonResult.gems <= result.gems) a.seasonResult = result;
  }
  a.seasonId = sid;
  a.seasonWins = 0;
  a.seasonLosses = 0;
  a.bestRating = a.rating;
  return result;
}

// ───────── save hygiene ─────────

/** Repair fields an old or corrupted save might hold (the migration only fills missing keys). */
export function sanitizeArena(a: ArenaSave): ArenaSave {
  const d = defaultArena();
  const num = (x: unknown, fb: number) => (typeof x === 'number' && Number.isFinite(x) ? x : fb);
  a.rating = clamp(num(a.rating, d.rating), MIN_RATING, MAX_RATING);
  a.tickets = Math.max(0, Math.floor(num(a.tickets, d.tickets)));
  a.wins = Math.max(0, Math.floor(num(a.wins, 0)));
  a.losses = Math.max(0, Math.floor(num(a.losses, 0)));
  a.bought = Math.max(0, Math.floor(num(a.bought, 0)));
  a.oppSeed = Math.floor(num(a.oppSeed, 1)) >>> 0;
  a.refreshAt = num(a.refreshAt, 0);
  a.seasonId = Math.floor(num(a.seasonId, 0));
  a.seasonWins = Math.max(0, Math.floor(num(a.seasonWins, 0)));
  a.seasonLosses = Math.max(0, Math.floor(num(a.seasonLosses, 0)));
  a.bestRating = num(a.bestRating, a.rating);
  a.defenseAt = num(a.defenseAt, 0);
  a.pubAt = num(a.pubAt, 0);
  if (typeof a.ticketDay !== 'string') a.ticketDay = '';
  if (typeof a.shopDay !== 'string') a.shopDay = '';
  if (typeof a.pubSig !== 'string') a.pubSig = '';
  if (!a.shopBought || typeof a.shopBought !== 'object') a.shopBought = {};
  if (!Array.isArray(a.history)) a.history = [];
  a.history = a.history.filter((h) => h && typeof h === 'object' && typeof h.opponent === 'string').slice(0, HISTORY_MAX);
  for (const h of a.history) {
    h.at = num(h.at, 0);
    h.delta = Math.round(num(h.delta, 0));
    h.won = h.won === true;
    if (h.lineup !== undefined && !Array.isArray(h.lineup)) delete h.lineup;
  }
  if (a.defense && (typeof a.defense !== 'object' || !Array.isArray(a.defense.slots) || typeof a.defense.formation !== 'string')) a.defense = null;
  if (a.pending && (typeof a.pending !== 'object' || typeof a.pending.key !== 'string')) a.pending = null;
  if (a.seasonResult && (typeof a.seasonResult !== 'object' || !Number.isFinite(a.seasonResult.rating))) a.seasonResult = null;
  return a;
}


export const HISTORY_MAX = 20;

// ───────── Honor Medal shop ─────────

export interface ShopItem {
  id: string;
  kind: 'pages' | 'tickets' | 'essence' | 'yul';
  heroId?: string;
  amount: number;
  cost: number;
  /** Purchases allowed per day. */
  limit: number;
}

const PAGE_OFFERS: { rarity: Rarity; amount: number; cost: number; limit: number }[] = [
  { rarity: 'SR', amount: 5, cost: 80, limit: 2 },
  { rarity: 'SSR', amount: 5, cost: 240, limit: 1 },
  { rarity: 'UR', amount: 5, cost: 480, limit: 1 },
];

/** Today's shop: three rotating hero-page offers (Epic, Legendary, Mythic) plus staples. */
export function shopItems(day: string, stage: number): ShopItem[] {
  const r = rng(hashString(`arena-shop:${day}`));
  const items: ShopItem[] = [];
  for (const o of PAGE_OFFERS) {
    const pool = SUMMONABLE.filter((h) => h.rarity === o.rarity);
    if (!pool.length) continue;
    const h = pick(r, pool);
    items.push({ id: `pages-${o.rarity}-${h.id}`, kind: 'pages', heroId: h.id, amount: o.amount, cost: o.cost, limit: o.limit });
  }
  const rates = afkRates(Math.max(0, stage));
  items.push({ id: 'tickets', kind: 'tickets', amount: 1, cost: 150, limit: 3 });
  items.push({ id: 'essence', kind: 'essence', amount: Math.round(rates.essence * 2), cost: 60, limit: 3 });
  items.push({ id: 'yul', kind: 'yul', amount: Math.round(rates.yul * 3), cost: 40, limit: 3 });
  return items;
}

export function shopLeft(a: ArenaSave, day: string, item: ShopItem): number {
  const bought = a.shopDay === day ? (a.shopBought?.[item.id] ?? 0) : 0;
  return Math.max(0, item.limit - bought);
}

// ───────── offline rivals (bots) ─────────

const HANDLES = [
  'AntiMagicAsta99', 'GrimoireCollector', 'BlackBullsFan', 'NeverGiveUp', 'FinralWarpZone', 'MuscleMagicMagna',
  'CharmyFoodTruck', 'HageVillageHero', 'ZephyrRival', 'ClockTowerKid', 'FiveLeafDreams', 'LuckyVoltage',
  'SilverEagleRoyal', 'CrimsonLionRoar', 'GoldenDawnMain', 'MimosaBloom', 'SpadeRaidBoss', 'DevilUnionDude',
  'MereoleonaFanClub', 'WizardKingSoon', 'BullsBasement', 'SylphWhisperer', 'ManaZoneMaster', 'TimeMagicTom',
  'GrimoireTowerAce', 'CloverCastleGuard', 'AquaDeerLuv', 'CoralPeacockPop', 'PurpleOrcaPilot', 'AzureDeerDash',
];
const PREFIX = ['AntiMagic', 'Grimoire', 'BlackBull', 'GoldenDawn', 'Clover', 'Zephyr', 'Mana', 'Demon', 'Spade', 'Wizard', 'Hage', 'Crimson', 'Silver', 'Coral', 'Midnight', 'Sylph', 'Undine', 'Salamander', 'Royal', 'Rampage', 'Star', 'Shadow'];
const CORE = ['Knight', 'Collector', 'Fan', 'Slayer', 'Rival', 'Captain', 'Mage', 'Kid', 'Squad', 'Main', 'Sage', 'Ace', 'Legend', 'Brawler', 'Rookie', 'Hunter', 'Hero', 'Wizard'];
const SUFFIX = ['', '', '', '99', '7', '_x', '42', 'GG', '777', '13', 'Jr', '2k', '01'];

/** Deterministic, Black Clover-flavoured player handle for an offline rival. */
export function botName(seed: number): string {
  const r = rng(mixSeed(seed, 0xb07));
  if (r() < 0.4) return pick(r, HANDLES);
  return `${pick(r, PREFIX)}${pick(r, CORE)}${pick(r, SUFFIX)}`;
}

function rarityWeights(perHero: number): Record<Rarity, number> {
  if (perHero < 800) return { R: 7, SR: 3, SSR: 0, UR: 0 };
  if (perHero < 1100) return { R: 3, SR: 5, SSR: 2, UR: 0 };
  if (perHero < 1500) return { R: 1, SR: 4, SSR: 4, UR: 1 };
  if (perHero < 2600) return { R: 0, SR: 3, SSR: 5, UR: 2 };
  return { R: 0, SR: 2, SSR: 5, UR: 3 };
}

const FORMATION_WEIGHTS: Record<string, number> = { balanced: 3, vanguard: 3, spearhead: 2, fortress: 2, blitz: 1 };

function frontScore(h: HeroDef): number {
  return (h.role === 'Defender' ? 3 : 0) + (h.range === 'melee' ? 2 : 0) - (h.role === 'Support' ? 2 : 0);
}

/** Put front-liners into the formation's front slots, the rest behind. */
export function placeHeroes(heroes: HeroDef[], formation: FormationDef): { def: HeroDef; slot: number }[] {
  const sorted = heroes.slice().sort((a, b) => frontScore(b) - frontScore(a));
  const front = formation.rows.map((r, i) => (r === 'front' ? i : -1)).filter((i) => i >= 0);
  const back = formation.rows.map((r, i) => (r === 'back' ? i : -1)).filter((i) => i >= 0);
  const order = [...front, ...back];
  return sorted.slice(0, 5).map((def, i) => ({ def, slot: order[i] }));
}

function weightedPick(r: Rng, pool: { h: HeroDef; w: number }[]): HeroDef | null {
  const total = pool.reduce((s, p) => s + p.w, 0);
  if (total <= 0) return pool.length ? pool[Math.floor(r() * pool.length)].h : null;
  let x = r() * total;
  for (const p of pool) {
    x -= p.w;
    if (x <= 0) return p.h;
  }
  return pool[pool.length - 1].h;
}

/** Pick 5 distinct heroes: rarity follows the power budget, sometimes themed on one faction,
 * always with at least one Defender. */
function pickBotHeroes(r: Rng, perHero: number): HeroDef[] {
  const weights = rarityWeights(perHero);
  const factions = [...new Set(SUMMONABLE.map((h) => h.faction))];
  const theme = r() < 0.45 ? pick(r, factions) : null;
  let pool = SUMMONABLE.map((h) => ({ h, w: weights[h.rarity] * (theme && h.faction === theme ? 4 : 1) }));
  const out: HeroDef[] = [];
  while (out.length < 5 && pool.length) {
    const h = weightedPick(r, pool);
    if (!h) break;
    out.push(h);
    pool = pool.filter((p) => p.h.id !== h.id);
  }
  if (!out.some((h) => h.role === 'Defender')) {
    const defs = SUMMONABLE.filter((h) => h.role === 'Defender' && !out.includes(h)).map((h) => ({ h, w: weights[h.rarity] + 0.01 }));
    const d = weightedPick(r, defs);
    if (d) {
      // Replace the least front-friendly pick.
      const worst = out.slice().sort((a, b) => frontScore(a) - frontScore(b))[0];
      out[out.indexOf(worst)] = d;
    }
  }
  return out;
}

export interface Opponent {
  id: string;
  kind: 'bot' | 'player';
  /** Offline rival's handle (bots only). Real players' names are resolved at render. */
  botName?: string;
  rating: number;
  power: number;
  team: TeamSetup;
}

/** An offline rival whose team power lands close to `targetPower`. Deterministic per seed. */
export function makeBot(seed: number, targetPower: number, rating: number): Opponent {
  const r = rng(mixSeed(seed, 0x5eed));
  const target = Math.max(500, Number.isFinite(targetPower) ? targetPower : 500);
  const perHero = target / 5;
  const formationIds = FORMATIONS.map((f) => ({ id: f.id, w: FORMATION_WEIGHTS[f.id] ?? 1 }));
  let x = r() * formationIds.reduce((s, f) => s + f.w, 0);
  let formation = FORMATIONS[0];
  for (const f of formationIds) {
    x -= f.w;
    if (x <= 0) {
      formation = FORMATION_MAP[f.id];
      break;
    }
  }
  const picks = pickBotHeroes(r, perHero);
  let placed = placeHeroes(picks, formation);
  const extra = (perHero > 4000 ? 3 : perHero > 2500 ? 2 : perHero > 1400 ? 1 : 0) + (r() < 0.5 ? 1 : 0);
  const jitter = placed.map(() => Math.floor(r() * 5) - 2);
  let starBoost = 0;

  const build = (level: number): TeamSetup => {
    const members: Combatant[] = placed.map((p, i) => {
      const start = RARITY_INFO[p.def.rarity].startStars;
      const stars = clamp(start + extra + starBoost, start, 7);
      return { heroId: p.def.id, level: clamp(level + jitter[i], 1, levelCap(stars)), stars, slot: p.slot };
    });
    return { members, formation };
  };

  // Raise stars until max level can reach the target, lower them if level 1 already overshoots.
  for (let i = 0; i < 7 && teamPower(build(80)) < target && extra + starBoost < 6; i++) starBoost++;
  for (let i = 0; i < 7 && teamPower(build(1)) > target && extra + starBoost > -6; i++) starBoost--;
  // Still too strong at level 1 (a tiny target): trade the rarest heroes for humbler ones.
  for (let i = 0; i < 5 && teamPower(build(1)) > target * 1.03; i++) {
    const order = RARITY_INFO[picks.slice().sort((a, b) => RARITY_INFO[b.rarity].order - RARITY_INFO[a.rarity].order)[0].rarity].order;
    if (order === 0) break;
    const idx = picks.findIndex((h) => RARITY_INFO[h.rarity].order === order);
    const old = picks[idx];
    const lower = SUMMONABLE.filter((h) => RARITY_INFO[h.rarity].order < order && !picks.includes(h));
    const sameRole = lower.filter((h) => h.role === old.role);
    const cands = sameRole.length ? sameRole : lower;
    if (!cands.length) break;
    const minOrder = Math.min(...cands.map((h) => RARITY_INFO[h.rarity].order));
    const swap = pick(r, cands.filter((h) => RARITY_INFO[h.rarity].order === minOrder));
    picks[idx] = swap;
    placed = placeHeroes(picks, formation);
  }

  let lo = 1;
  let hi = 80;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (teamPower(build(mid)) <= target) lo = mid;
    else hi = mid - 1;
  }
  let team = build(lo);
  const up = build(lo + 1);
  if (Math.abs(teamPower(up) - target) < Math.abs(teamPower(team) - target)) team = up;
  // Past the level/star caps (players boosted by team bonuses): a rival "training bonus".
  if (teamPower(team) < target * 0.97) {
    const maxed = team;
    const withBonus = (k: number): TeamSetup => ({ ...maxed, bonus: { hp: k, atk: k, def: k } });
    let a = 0;
    let b = 3;
    for (let i = 0; i < 24; i++) {
      const m = (a + b) / 2;
      if (teamPower(withBonus(m)) < target) a = m;
      else b = m;
    }
    team = withBonus(Math.round(b * 1000) / 1000);
  }
  return { id: `bot-${seed >>> 0}`, kind: 'bot', botName: botName(seed), rating: clamp(Math.round(rating), MIN_RATING, MAX_RATING), power: teamPower(team), team };
}

/** Rating offset and power factor of each opponent slot, easiest first. */
export const BOT_PLANS = [
  { dr: -70, pf: 0.87 },
  { dr: -25, pf: 0.95 },
  { dr: 25, pf: 1.03 },
  { dr: 75, pf: 1.12 },
];
const PLAN_USE: Record<number, number[]> = { 0: [], 1: [2], 2: [1, 3], 3: [0, 2, 3], 4: [0, 1, 2, 3] };

/** Higher ratings bring slightly stronger rivals. */
export function ratingPressure(rating: number): number {
  return clamp((rating - START_RATING) / 4000, -0.03, 0.06);
}

// ───────── online defenses ─────────

export interface OnlineDefense {
  id: string;
  rating: number;
  wins: number;
  /** Recomputed from the validated team — the doc's own `power` is never trusted. */
  power: number;
  updatedAt: number;
  season: number | null;
  team: TeamSetup;
}

const ID_RE = /^[A-Za-z0-9_\-.~:@+]{1,128}$/;
const isInt = (x: unknown, lo: number, hi: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= lo && x <= hi;
const isNum = (x: unknown, lo: number, hi: number): x is number => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;

/** Team-wide stat bonuses (clan research etc.) a published defense may carry. */
export const BONUS_KEYS = ['hp', 'atk', 'def', 'spd', 'crit', 'critDmg', 'heal', 'energy', 'lifesteal'] as const;
/** Largest bonus per stat accepted from another player's doc. */
export const MAX_BONUS = 0.6;

/** Known, non-zero bonus stats only, rounded — or undefined when there are none. */
export function cleanBonus(b: StatMods | undefined): StatMods | undefined {
  if (!b) return undefined;
  const out: StatMods = {};
  let any = false;
  for (const k of BONUS_KEYS) {
    const v = b[k];
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      out[k] = Math.round(Math.min(v, MAX_BONUS) * 1e4) / 1e4;
      any = true;
    }
  }
  return any ? out : undefined;
}

/** Validate a doc's optional bonus: absent → undefined, malformed → 'bad'. Unknown keys are ignored. */
function parseBonus(raw: unknown): StatMods | undefined | 'bad' {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) return 'bad';
  const r = raw as Record<string, unknown>;
  const out: StatMods = {};
  for (const k of BONUS_KEYS) {
    if (r[k] === undefined) continue;
    if (!isNum(r[k], 0, MAX_BONUS)) return 'bad';
    out[k] = r[k] as number;
  }
  return cleanBonus(out);
}

/** Validate another player's published defense. Anything malformed or unknown → null. */
export function parseDefenseDoc(id: unknown, raw: unknown): OnlineDefense | null {
  if (typeof id !== 'string' || !ID_RE.test(id)) return null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const d = raw as Record<string, unknown>;
  if (d.v !== 1) return null;
  if (!isNum(d.rating, MIN_RATING, MAX_RATING)) return null;
  if (!isNum(d.updatedAt, 0, 8.64e15)) return null;
  const wins = d.wins === undefined ? 0 : d.wins;
  if (!isInt(wins, 0, 1e7)) return null;
  const season = d.season === undefined ? null : d.season;
  if (season !== null && !isInt(season, 0, 1e6)) return null;
  const def = d.defense as Record<string, unknown> | null;
  if (!def || typeof def !== 'object' || Array.isArray(def)) return null;
  if (typeof def.formation !== 'string' || !Object.prototype.hasOwnProperty.call(FORMATION_MAP, def.formation)) return null;
  const formation = FORMATION_MAP[def.formation];
  const ms = def.members;
  if (!Array.isArray(ms) || ms.length < 1 || ms.length > 5) return null;
  const members: Combatant[] = [];
  const seenHero = new Set<string>();
  const seenSlot = new Set<number>();
  for (const m of ms) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return null;
    const { heroId, level, stars, slot } = m as Record<string, unknown>;
    if (typeof heroId !== 'string' || !Object.prototype.hasOwnProperty.call(HERO_MAP, heroId)) return null;
    if (!HERO_MAP[heroId].summonable) return null;
    if (!isInt(stars, 1, 7) || !isInt(level, 1, levelCap(stars)) || !isInt(slot, 0, 4)) return null;
    if (seenHero.has(heroId) || seenSlot.has(slot)) return null;
    seenHero.add(heroId);
    seenSlot.add(slot);
    members.push({ heroId, level, stars, slot });
  }
  const bonus = parseBonus(def.bonus);
  if (bonus === 'bad') return null;
  const team: TeamSetup = bonus ? { members, formation, bonus } : { members, formation };
  return { id, rating: Math.round(d.rating), wins, power: teamPower(team), updatedAt: d.updatedAt, season, team };
}

/** The body this player publishes at arena/<uid>. */
export function defenseDocBody(team: TeamSetup, a: Pick<ArenaSave, 'rating' | 'wins'>, season: number, now: number) {
  const bonus = cleanBonus(team.bonus);
  const defense: { formation: string; members: Combatant[]; bonus?: StatMods } = {
    formation: team.formation.id,
    members: team.members.map((m) => ({ heroId: m.heroId, level: m.level, stars: m.stars, slot: m.slot })),
  };
  if (bonus) defense.bonus = bonus;
  return {
    v: 1,
    defense,
    power: teamPower({ members: team.members, formation: team.formation, bonus }),
    rating: Math.round(a.rating),
    wins: Math.floor(a.wins),
    season,
    updatedAt: now,
  };
}

// ───────── matchmaking ─────────

export interface MatchOptions {
  seed: number;
  rating: number;
  /** Player squad power — offline rivals are scaled around it. */
  power: number;
  pool?: OnlineDefense[];
  selfId?: string | null;
  count?: number;
  maxOnline?: number;
  /** Max rating gap for real players. */
  window?: number;
}

/** Up to `maxOnline` real players near your rating, offline rivals for the rest. Sorted by rating. */
export function pickOpponents(o: MatchOptions): Opponent[] {
  const count = clamp(o.count ?? 4, 1, 4);
  const window = o.window ?? 250;
  const r = rng(mixSeed(o.seed, 0xa7e4a));
  const near = (o.pool ?? [])
    .filter((p) => p.id !== o.selfId && Math.abs(p.rating - o.rating) <= window && p.team.members.length > 0)
    .sort((a, b) => Math.abs(a.rating - o.rating) - Math.abs(b.rating - o.rating) || (a.id < b.id ? -1 : 1))
    .slice(0, 8);
  const seen = new Set<string>();
  const players: Opponent[] = [];
  for (const p of shuffle(r, near)) {
    if (players.length >= Math.min(o.maxOnline ?? 2, count) || seen.has(p.id)) continue;
    seen.add(p.id);
    players.push({ id: p.id, kind: 'player', rating: p.rating, power: p.power, team: p.team });
  }
  const plans = PLAN_USE[count - players.length] ?? [];
  const myPower = Math.max(800, o.power || 0);
  const bots = plans.map((pi, i) => {
    const seed = mixSeed(o.seed, pi, i);
    const br = rng(seed);
    const plan = BOT_PLANS[pi];
    const dr = plan.dr + Math.round((br() - 0.5) * 30);
    const pf = plan.pf + (br() - 0.5) * 0.04 + ratingPressure(o.rating);
    return makeBot(seed, myPower * pf, o.rating + dr);
  });
  return [...players, ...bots].sort((a, b) => a.rating - b.rating || (a.id < b.id ? -1 : 1));
}

// ───────── leaderboard rivals ─────────

export interface BoardBot {
  id: string;
  name: string;
  rating: number;
  ace: string;
}

/**
 * A season's worth of offline rivals for the leaderboard. They spread out from the starting
 * rating as the week goes on: the best climb toward Wizard King, the bottom fifth slips below
 * 1000, so a fresh player starts mid-table rather than dead last. Names are unique per season.
 */
export function leaderboardBots(sid: number, now: number, n = 60): BoardBot[] {
  const f = clamp((now - seasonStart(sid)) / WEEK_MS, 0, 1);
  const aces = SUMMONABLE.filter((h) => h.rarity === 'UR' || h.rarity === 'SSR');
  const out: BoardBot[] = [];
  const used = new Set<string>();
  for (let i = 0; i < n; i++) {
    const seed = mixSeed(sid, i, 0x1eade7);
    const r = rng(seed);
    const peak = START_RATING - 140 + 1130 * Math.pow(1 - i / n, 1.7) * (0.85 + 0.3 * r());
    const rating = clamp(Math.round(START_RATING + (peak - START_RATING) * (0.35 + 0.65 * f)), MIN_RATING, MAX_RATING);
    let name = botName(seed);
    for (let k = 1; used.has(name) && k < 8; k++) name = botName(mixSeed(seed, k));
    if (used.has(name)) name = `${name.slice(0, 16)}${i}`;
    used.add(name);
    out.push({ id: `lb-${sid}-${i}`, name, rating, ace: pick(r, aces.length ? aces : SUMMONABLE).id });
  }
  return out;
}
