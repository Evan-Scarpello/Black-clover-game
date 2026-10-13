// Pure rules for the retention systems: 7-day login, Grimoire Pass, daily shop and
// achievements. No store imports — every function takes the save (and `now`) so it
// can be unit tested. Functions named claim*/buy*/ensure* mutate the save they are
// given but never grant currencies; ./actions.ts grants rewards and commits.
import { afkRates } from '../../data/campaign';
import { HERO_MAP, SUMMONABLE } from '../../data/heroes';
import { rng } from '../../game/rng';
import { today, type Currencies, type Reward, type SaveState } from '../../game/state';
import type { GameEvent } from '../../game/store';
import type { Rarity } from '../../game/types';
import { defaultProgression, type PassSave, type ProgressionSave, type RewardData } from './state';

export const DAY_MS = 24 * 3600 * 1000;
const CURRENCY_KEYS: (keyof Currencies)[] = ['yul', 'essence', 'gems', 'tickets', 'medals', 'crests'];

// ───────── helpers ─────────

/** FNV-1a string hash → uint32 seed. */
export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Summonable hero ids of one rarity, sorted for stable picks. */
export function heroesOf(r: Rarity): string[] {
  return SUMMONABLE.filter((h) => h.rarity === r)
    .map((h) => h.id)
    .sort();
}

function pick<T>(list: T[], seed: number): T {
  return list[Math.floor(rng(seed)() * list.length) % list.length];
}

/** Round to a friendly shop number (12,300 → 12,000). */
export function nice(n: number): number {
  if (n >= 100000) return Math.round(n / 5000) * 5000;
  if (n >= 10000) return Math.round(n / 1000) * 1000;
  if (n >= 1000) return Math.round(n / 100) * 100;
  return Math.max(10, Math.round(n / 10) * 10);
}

/** Yul / Essence worth `hours` of AFK income at this campaign progress (keeps rewards relevant late game). */
export const afkYul = (stage: number, hours: number) => nice(afkRates(Math.max(0, stage | 0)).yul * hours);
export const afkEssence = (stage: number, hours: number) => nice(afkRates(Math.max(0, stage | 0)).essence * hours);

export function addReward(into: Reward, r: Reward | null | undefined): Reward {
  if (!r) return into;
  for (const k of CURRENCY_KEYS) if (r[k]) into[k] = (into[k] ?? 0) + r[k]!;
  if (r.passXp) into.passXp = (into.passXp ?? 0) + r.passXp;
  for (const [id, n] of Object.entries(r.shards ?? {})) {
    if (!n) continue;
    into.shards ??= {};
    into.shards[id] = (into.shards[id] ?? 0) + n;
  }
  return into;
}

export function isEmptyReward(r: Reward | null | undefined): boolean {
  if (!r) return true;
  return !CURRENCY_KEYS.some((k) => (r[k] ?? 0) > 0) && !(r.passXp ?? 0) && !Object.values(r.shards ?? {}).some((n) => n > 0);
}

// ───────── save normalisation ─────────

const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const int = (v: unknown, d = 0) => Math.max(0, Math.floor(num(v, d)));
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const ints = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'number' && Number.isInteger(x)))] : []);
const strs = (v: unknown) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string'))] : []);
const obj = (v: unknown): any => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

function cleanReward(v: unknown): RewardData | null {
  const r = obj(v);
  const out: Reward = {};
  for (const k of CURRENCY_KEYS) if (int(r[k]) > 0) out[k] = int(r[k]);
  for (const [id, n] of Object.entries(obj(r.shards))) if (HERO_MAP[id] && int(n) > 0) (out.shards ??= {})[id] = int(n);
  return isEmptyReward(out) ? null : out;
}

/** A well-formed copy of the slice (old saves, cloud copies, hand-edited JSON). */
export function normalizeProgression(raw: unknown): ProgressionSave {
  const d = defaultProgression();
  const p = obj(raw);
  const l = obj(p.login);
  const pa = obj(p.pass);
  const sh = obj(p.shop);
  const caps: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(pa.capUsed))) caps[k] = int(v);
  const notice = pa.notice && typeof pa.notice === 'object' ? { from: int(pa.notice.from), reward: cleanReward(pa.notice.reward) } : null;
  return {
    ...p,
    login: { lastDay: str(l.lastDay), claimed: int(l.claimed) },
    pass: {
      season: Math.max(1, int(pa.season, d.pass.season)),
      xp: int(pa.xp),
      premium: pa.premium === true,
      claimedFree: ints(pa.claimedFree),
      claimedPremium: ints(pa.claimedPremium),
      capDay: str(pa.capDay),
      capUsed: caps,
      notice,
    },
    shop: { day: str(sh.day), stock: strs(sh.stock), bought: strs(sh.bought), refreshes: int(sh.refreshes), giftDay: str(sh.giftDay) },
    achievements: strs(p.achievements),
  };
}

/** Read-only view for render code and badges (never mutates the save). */
export function prog(s: SaveState): ProgressionSave {
  return normalizeProgression(s.progression);
}

/** Mutating: repair s.progression in place before an action writes to it. */
export function ensureProgression(s: SaveState): ProgressionSave {
  s.progression = normalizeProgression(s.progression);
  return s.progression;
}

// ───────── 7-day login calendar ─────────

export const LOGIN_CYCLE = 7;

/** The Legendary whose pages pay out on day 7 of a given cycle (0-based). */
export function loginLegendary(cycle: number): string {
  return pick(heroesOf('SSR'), hashSeed(`login-cycle-${cycle}`));
}

/** Reward for calendar day `index` (0-6) of `cycle`. Yul/Essence scale with campaign progress. */
export function loginReward(index: number, cycle: number, stage: number): Reward {
  switch (index) {
    case 0:
      return { yul: afkYul(stage, 3) };
    case 1:
      return { essence: afkEssence(stage, 3) };
    case 2:
      return { gems: 100 };
    case 3:
      return { yul: afkYul(stage, 4), essence: afkEssence(stage, 4) };
    case 4:
      return { gems: 200 };
    case 5:
      return { tickets: 2 };
    default:
      return { gems: 300, tickets: 3, shards: { [loginLegendary(cycle)]: 10 } };
  }
}

export type LoginDayState = 'claimed' | 'today' | 'future';

export interface LoginView {
  /** Total login days ever claimed. */
  total: number;
  canClaim: boolean;
  /** 0-based cycle shown on the calendar. */
  cycle: number;
  /** Day index (0-6) that the next claim pays. */
  nextIndex: number;
  days: { index: number; reward: Reward; state: LoginDayState }[];
}

/** One claim per calendar day (a save that says "claimed today" but has 0 claims is treated as unclaimed). */
function loginOpen(l: { lastDay: string; claimed: number }, day: string): boolean {
  return l.lastDay !== day || l.claimed <= 0;
}

export function canClaimLogin(s: SaveState, now = Date.now()): boolean {
  return loginOpen(prog(s).login, today(now));
}

export function loginView(s: SaveState, now = Date.now()): LoginView {
  const l = prog(s).login;
  const canClaim = loginOpen(l, today(now));
  // After claiming day 7 the full calendar stays stamped until tomorrow.
  const anchor = !canClaim && l.claimed > 0 ? l.claimed - 1 : l.claimed;
  const cycle = Math.floor(anchor / LOGIN_CYCLE);
  const done = l.claimed - cycle * LOGIN_CYCLE;
  const days = Array.from({ length: LOGIN_CYCLE }, (_, index) => ({
    index,
    reward: loginReward(index, cycle, s.stage),
    state: (index < done ? 'claimed' : index === done && canClaim ? 'today' : 'future') as LoginDayState,
  }));
  return { total: l.claimed, canClaim, cycle, nextIndex: l.claimed % LOGIN_CYCLE, days };
}

/** Claim today's login reward. Returns what to grant, or null when already claimed today. */
export function claimLoginDay(s: SaveState, now = Date.now()): { reward: Reward; index: number; cycle: number } | null {
  const p = ensureProgression(s);
  const d = today(now);
  if (!loginOpen(p.login, d)) return null;
  const index = p.login.claimed % LOGIN_CYCLE;
  const cycle = Math.floor(p.login.claimed / LOGIN_CYCLE);
  const reward = loginReward(index, cycle, s.stage);
  p.login.claimed++;
  p.login.lastDay = d;
  return { reward, index, cycle };
}

// ───────── Grimoire Pass ─────────

export const PASS_TIERS = 30;
export const PASS_PREMIUM_COST = 1500;
export const SEASON_DAYS = 28;
/** Season 1 started Monday 5 Jan 2026 (UTC). Every player shares the same season clock. */
export const SEASON_EPOCH = Date.UTC(2026, 0, 5);
const SEASON_MS = SEASON_DAYS * DAY_MS;

export function seasonAt(now = Date.now()): number {
  return Math.max(1, Math.floor((now - SEASON_EPOCH) / SEASON_MS) + 1);
}

export function seasonEndsAt(season: number): number {
  return SEASON_EPOCH + season * SEASON_MS;
}

/** XP needed to go from tier t-1 to tier t (gentle curve: 100, 115, 130 …). */
export function tierCost(t: number): number {
  return 100 + 15 * (t - 1);
}

/** Total XP needed to reach tier t. */
export function xpForTier(t: number): number {
  const n = Math.max(0, Math.min(PASS_TIERS, Math.floor(t)));
  return 100 * n + (15 * n * (n - 1)) / 2;
}

export function tierAt(xp: number): number {
  let t = 0;
  while (t < PASS_TIERS && xp >= xpForTier(t + 1)) t++;
  return t;
}

export function tierProgress(xp: number): { tier: number; into: number; need: number; max: boolean } {
  const tier = tierAt(xp);
  if (tier >= PASS_TIERS) return { tier, into: 0, need: 0, max: true };
  return { tier, into: xp - xpForTier(tier), need: tierCost(tier + 1), max: false };
}

/** Heroes featured by a season's pass. */
export function passHeroes(season: number): { epicA: string; epicB: string; legendary: string; mythic: string } {
  const epics = heroesOf('SR');
  const a = Math.floor(rng(hashSeed(`pass-epic-${season}`))() * epics.length) % epics.length;
  // A second, different Epic: step 1..n-1 places forward.
  const b = epics.length > 1 ? (a + 1 + (hashSeed(`pass-epic2-${season}`) % (epics.length - 1))) % epics.length : a;
  return {
    epicA: epics[a],
    epicB: epics[b],
    legendary: pick(heroesOf('SSR'), hashSeed(`pass-legendary-${season}`)),
    mythic: pick(heroesOf('UR'), hashSeed(`pass-mythic-${season}`)),
  };
}

export interface PassTierDef {
  tier: number;
  free: Reward;
  premium: Reward;
}

export function passTierRewards(t: number, season: number, stage: number): PassTierDef {
  const h = passHeroes(season);
  let free: Reward;
  if (t === 30) free = { gems: 300, tickets: 2 };
  else if (t === 20) free = { gems: 100, shards: { [h.epicB]: 10 } };
  else if (t === 10) free = { shards: { [h.epicA]: 10 } };
  else if (t % 5 === 0) free = { tickets: 1 };
  else if (t % 3 === 0) free = { gems: 60 };
  else if (t % 2 === 0) free = { essence: afkEssence(stage, 2) };
  else free = { yul: afkYul(stage, 2) };

  let premium: Reward;
  if (t === 30) premium = { gems: 300, shards: { [h.mythic]: 10 } };
  else if (t === 15) premium = { shards: { [h.legendary]: 10 } };
  else if (t % 5 === 0) premium = { tickets: 2 };
  else if (t % 3 === 0) premium = { gems: 120 };
  else if (t % 2 === 0) premium = { gems: 50, essence: afkEssence(stage, 4) };
  else premium = { gems: 40, yul: afkYul(stage, 4) };
  return { tier: t, free, premium };
}

export function passTiers(season: number, stage: number): PassTierDef[] {
  return Array.from({ length: PASS_TIERS }, (_, i) => passTierRewards(i + 1, season, stage));
}

export type PassTrack = 'free' | 'premium';

/** The pass as it should be seen right now (a stale season reads as a fresh one). */
export function passState(s: SaveState, now = Date.now()): PassSave {
  const p = prog(s).pass;
  const cur = seasonAt(now);
  if (p.season >= cur) return p;
  return { ...p, season: cur, xp: 0, premium: false, claimedFree: [], claimedPremium: [], notice: null };
}

export function canClaimTier(p: PassSave, track: PassTrack, tier: number): boolean {
  if (!Number.isInteger(tier) || tier < 1 || tier > PASS_TIERS || tier > tierAt(p.xp)) return false;
  if (track === 'premium') return p.premium && !p.claimedPremium.includes(tier);
  return !p.claimedFree.includes(tier);
}

export function passClaimables(p: PassSave): { track: PassTrack; tier: number }[] {
  const out: { track: PassTrack; tier: number }[] = [];
  const reached = tierAt(p.xp);
  for (let t = 1; t <= reached; t++) {
    if (canClaimTier(p, 'free', t)) out.push({ track: 'free', tier: t });
    if (canClaimTier(p, 'premium', t)) out.push({ track: 'premium', tier: t });
  }
  return out;
}

export function passBadge(s: SaveState, now = Date.now()): boolean {
  return passClaimables(passState(s, now)).length > 0;
}

/**
 * Start the current season if the stored pass belongs to an older one: XP, claims and
 * premium reset. Rewards the player had reached but not claimed are returned so the
 * caller can send them on (and a "New season" note is stored). Never rolls backwards.
 */
export function rolloverSeason(s: SaveState, now = Date.now()): Reward | null {
  const p = ensureProgression(s);
  const cur = seasonAt(now);
  const old = p.pass;
  if (old.season >= cur) return null;
  const hadProgress = old.xp > 0 || old.premium || old.claimedFree.length > 0 || old.claimedPremium.length > 0;
  const leftover: Reward = {};
  const reached = tierAt(old.xp);
  for (let t = 1; t <= reached; t++) {
    const def = passTierRewards(t, old.season, s.stage);
    if (!old.claimedFree.includes(t)) addReward(leftover, def.free);
    if (old.premium && !old.claimedPremium.includes(t)) addReward(leftover, def.premium);
  }
  const reward = isEmptyReward(leftover) ? null : leftover;
  p.pass = {
    season: cur,
    xp: 0,
    premium: false,
    claimedFree: [],
    claimedPremium: [],
    capDay: old.capDay,
    capUsed: old.capUsed,
    notice: hadProgress ? { from: old.season, reward } : null,
  };
  return reward;
}

/** Claim tiers (already validated or not — invalid entries are skipped). Returns the total reward. */
export function claimPassTiers(s: SaveState, list: { track: PassTrack; tier: number }[], now = Date.now()): Reward | null {
  rolloverSeason(s, now);
  const p = ensureProgression(s).pass;
  const total: Reward = {};
  let any = false;
  for (const { track, tier } of list) {
    if (!canClaimTier(p, track, tier)) continue;
    const def = passTierRewards(tier, p.season, s.stage);
    if (track === 'premium') p.claimedPremium.push(tier);
    else p.claimedFree.push(tier);
    addReward(total, track === 'premium' ? def.premium : def.free);
    any = true;
  }
  return any ? total : null;
}

/** Events per day that still earn pass XP from each capped source. */
export const XP_CAPS: Record<string, number> = { campaign: 30, arena: 20, tower: 20, raid: 10, afk: 6, feature: 25, starUp: 10 };

/** Pass XP an event is worth, and the daily cap bucket it counts against (if any). */
export function passXpFor(e: GameEvent): { xp: number; cap?: string } {
  switch (e.type) {
    case 'battle':
      if (e.kind === 'raid') return { xp: 25, cap: 'raid' }; // raid attempts are limited and score by damage
      if (!e.won) return { xp: 0 };
      return e.kind === 'campaign' ? { xp: 10, cap: 'campaign' } : { xp: 20, cap: e.kind };
    case 'summon':
      return { xp: 5 * Math.max(0, Math.floor(e.count || 0)) };
    case 'levelUp':
      return { xp: 2 * Math.max(0, Math.floor(e.count || 0)) };
    case 'starUp':
      return { xp: 10, cap: 'starUp' };
    case 'afkClaim':
      return { xp: 10, cap: 'afk' };
    case 'questClaim':
      return { xp: 15 };
    case 'feature':
      return { xp: 10, cap: 'feature' };
    default:
      return { xp: 0 };
  }
}

/** Add pass XP for a game event (respecting daily caps). Returns XP added. */
export function addPassXp(s: SaveState, e: GameEvent, now = Date.now()): number {
  const { xp, cap } = passXpFor(e);
  if (xp <= 0) return 0;
  const p = ensureProgression(s).pass;
  const d = today(now);
  if (p.capDay !== d) {
    p.capDay = d;
    p.capUsed = {};
  }
  if (cap) {
    const used = p.capUsed[cap] ?? 0;
    if (used >= (XP_CAPS[cap] ?? Infinity)) return 0;
    p.capUsed[cap] = used + 1;
  }
  p.xp += xp;
  return xp;
}

// ───────── daily shop ─────────

export const SHOP_SLOTS = 6;
export const REFRESH_COSTS = [50, 100, 200];
export const SUMMON_PRICE = 300;

type TemplateId = 'legG' | 'legY' | 'epicY' | 'epicG' | 'essY' | 'essG' | 'yulG' | 'ticketG' | 'ticketY';

interface Template {
  rarity?: Rarity;
  make(stage: number, heroId: string): { reward: Reward; price: Partial<Currencies>; tag?: string };
}

const TEMPLATES: Record<TemplateId, Template> = {
  legG: { rarity: 'SSR', make: (_, h) => ({ reward: { shards: { [h]: 5 } }, price: { gems: 450 } }) },
  legY: { rarity: 'SSR', make: (st, h) => ({ reward: { shards: { [h]: 3 } }, price: { yul: afkYul(st, 10) }, tag: 'Yul deal' }) },
  epicY: { rarity: 'SR', make: (st, h) => ({ reward: { shards: { [h]: 5 } }, price: { yul: afkYul(st, 3) } }) },
  epicG: { rarity: 'SR', make: (_, h) => ({ reward: { shards: { [h]: 10 } }, price: { gems: 180 } }) },
  essY: { make: (st) => ({ reward: { essence: afkEssence(st, 4) }, price: { yul: afkYul(st, 5) } }) },
  essG: { make: (st) => ({ reward: { essence: afkEssence(st, 10) }, price: { gems: 150 } }) },
  yulG: { make: (st) => ({ reward: { yul: afkYul(st, 10) }, price: { gems: 120 } }) },
  ticketG: { make: () => ({ reward: { tickets: 1 }, price: { gems: 240 }, tag: '-20%' }) },
  ticketY: { make: (st) => ({ reward: { tickets: 1 }, price: { yul: afkYul(st, 12) }, tag: 'Rare deal' }) },
};

/** What each of the 6 shelves can roll, with weights. */
const SLOT_POOLS: [TemplateId, number][][] = [
  [['legG', 3], ['legY', 1]],
  [['epicY', 2], ['epicG', 1]],
  [['epicY', 1], ['epicG', 1], ['legG', 1]],
  [['essY', 2], ['essG', 1]],
  [['yulG', 2], ['essG', 1]],
  [['ticketG', 3], ['ticketY', 1]],
];

export interface ShopOffer {
  key: string;
  template: TemplateId;
  heroId?: string;
  reward: Reward;
  price: Partial<Currencies>;
  tag?: string;
}

/** The 6 offer keys for a day (and refresh count). Same inputs → same stock for everyone. */
export function generateStock(day: string, refreshes: number): string[] {
  const r = rng(hashSeed(`shop|${day}|${refreshes}`));
  const used = new Set<string>();
  return SLOT_POOLS.map((pool, i) => {
    const total = pool.reduce((a, [, w]) => a + w, 0);
    let x = r() * total;
    let tpl = pool[pool.length - 1][0];
    for (const [id, w] of pool) {
      if ((x -= w) < 0) {
        tpl = id;
        break;
      }
    }
    const rarity = TEMPLATES[tpl].rarity;
    if (!rarity) return `${i}:${tpl}`;
    const heroes = heroesOf(rarity);
    const free = heroes.filter((h) => !used.has(h));
    const hero = (free.length ? free : heroes)[Math.floor(r() * (free.length || heroes.length))];
    used.add(hero);
    return `${i}:${tpl}:${hero}`;
  });
}

/** Rebuild an offer from its key. Unknown/garbled keys give null. */
export function offerFromKey(key: string, stage: number): ShopOffer | null {
  if (typeof key !== 'string') return null;
  const [, tplRaw, hero] = key.split(':');
  const tpl = tplRaw as TemplateId;
  const def = Object.prototype.hasOwnProperty.call(TEMPLATES, tpl) ? TEMPLATES[tpl] : null;
  if (!def) return null;
  if (def.rarity && (!hero || !HERO_MAP[hero])) return null;
  const made = def.make(stage, hero ?? '');
  return { key, template: tpl, heroId: def.rarity ? hero : undefined, ...made };
}

export function refreshCost(refreshes: number): number | null {
  return REFRESH_COSTS[refreshes] ?? null;
}

export function giftReward(stage: number): Reward {
  return { gems: 30, yul: afkYul(stage, 1) };
}

export interface ShopView {
  day: string;
  offers: ShopOffer[];
  bought: string[];
  refreshes: number;
  refreshCost: number | null;
  giftReady: boolean;
  gift: Reward;
}

/** Today's shop as the player should see it (a stale day reads as a fresh stock). */
export function shopView(s: SaveState, now = Date.now()): ShopView {
  const sh = prog(s).shop;
  const d = today(now);
  const fresh = sh.day !== d || sh.stock.length !== SHOP_SLOTS;
  const refreshes = sh.day === d ? sh.refreshes : 0;
  const stock = fresh ? generateStock(d, refreshes) : sh.stock;
  return {
    day: d,
    offers: stock.map((k) => offerFromKey(k, s.stage)).filter((o): o is ShopOffer => !!o),
    bought: fresh ? [] : sh.bought,
    refreshes,
    refreshCost: refreshCost(refreshes),
    giftReady: sh.giftDay !== d,
    gift: giftReward(s.stage),
  };
}

/** Mutating: roll the shop over to today if needed. Returns true when it changed. */
export function ensureShopDay(s: SaveState, now = Date.now()): boolean {
  const sh = ensureProgression(s).shop;
  const d = today(now);
  if (sh.day === d && sh.stock.length === SHOP_SLOTS) return false;
  const refreshes = sh.day === d ? sh.refreshes : 0;
  const keepBought = sh.day === d;
  sh.day = d;
  sh.refreshes = refreshes;
  sh.stock = generateStock(d, refreshes);
  if (!keepBought) sh.bought = [];
  return true;
}

/** Validate a purchase: the offer is in today's stock and not bought yet. */
export function shopOffer(s: SaveState, key: string, now = Date.now()): ShopOffer | null {
  const v = shopView(s, now);
  if (v.bought.includes(key)) return null;
  return v.offers.find((o) => o.key === key) ?? null;
}

/** Mutating: record a purchase (the caller pays and grants). */
export function markBought(s: SaveState, key: string, now = Date.now()): boolean {
  ensureShopDay(s, now);
  const sh = s.progression.shop;
  if (!sh.stock.includes(key) || sh.bought.includes(key)) return false;
  sh.bought.push(key);
  return true;
}

/** Mutating: new stock after paying the refresh cost (caller pays). */
export function applyRefresh(s: SaveState, now = Date.now()): boolean {
  ensureShopDay(s, now);
  const sh = s.progression.shop;
  if (refreshCost(sh.refreshes) === null) return false;
  sh.refreshes++;
  sh.stock = generateStock(sh.day, sh.refreshes);
  sh.bought = [];
  return true;
}

/** Mutating: take today's free gift. Returns the reward or null if already taken. */
export function claimGift(s: SaveState, now = Date.now()): Reward | null {
  const sh = ensureProgression(s).shop;
  const d = today(now);
  if (sh.giftDay === d) return null;
  sh.giftDay = d;
  return giftReward(s.stage);
}

// ───────── achievements ─────────

export type AchievementGroup = 'Campaign' | 'Heroes' | 'Summons' | 'Arena & Tower' | 'Clan' | 'Grimoire Pass' | 'Loyalty';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
  group: AchievementGroup;
  goal: number;
  reward: Reward;
  measure: (s: SaveState) => number;
}

const heroList = (s: SaveState) => Object.values(obj(s.heroes)) as { level?: number; stars?: number }[];
const maxOf = (xs: number[]) => xs.reduce((a, b) => (b > a ? b : a), 0);

const M = {
  stage: (s: SaveState) => num(s.stage),
  heroes: (s: SaveState) => heroList(s).length,
  pulls: (s: SaveState) => Math.max(num(s.stats?.pulls), num(s.gacha?.total)),
  level: (s: SaveState) => maxOf(heroList(s).map((h) => num(h?.level))),
  stars: (s: SaveState) => maxOf(heroList(s).map((h) => num(h?.stars))),
  arenaWins: (s: SaveState) => num(s.arena?.wins),
  tower: (s: SaveState) => num(s.tower?.floor),
  clan: (s: SaveState) => (s.clan?.clanId ? 1 : 0),
  threeStars: (s: SaveState) => Object.values(obj(s.campaign?.stars)).filter((v) => v === 3).length,
  passTier: (s: SaveState) => tierAt(passState(s).xp),
  loginDays: (s: SaveState) => prog(s).login.claimed,
};

const rosterGoal = (n: number) => Math.max(1, Math.min(n, SUMMONABLE.length));

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'stage10', name: 'First Mission', desc: 'Clear 10 campaign stages', icon: '🗺️', group: 'Campaign', goal: 10, reward: { gems: 100 }, measure: M.stage },
  { id: 'stage30', name: 'Rising Star', desc: 'Clear 30 campaign stages', icon: '🗺️', group: 'Campaign', goal: 30, reward: { gems: 200, tickets: 1 }, measure: M.stage },
  { id: 'stage60', name: 'Royal Knight', desc: 'Clear 60 campaign stages', icon: '🗺️', group: 'Campaign', goal: 60, reward: { gems: 300, tickets: 2 }, measure: M.stage },
  { id: 'stage90', name: 'Kingdom Savior', desc: 'Clear all 90 story stages', icon: '👑', group: 'Campaign', goal: 90, reward: { gems: 500, tickets: 3 }, measure: M.stage },
  { id: 'stars10', name: 'Flawless', desc: 'Earn 3★ on 10 stages', icon: '⭐', group: 'Campaign', goal: 10, reward: { gems: 150 }, measure: M.threeStars },
  { id: 'stars50', name: 'Perfectionist', desc: 'Earn 3★ on 50 stages', icon: '🌟', group: 'Campaign', goal: 50, reward: { gems: 400, tickets: 2 }, measure: M.threeStars },
  { id: 'heroes10', name: 'Squad Builder', desc: `Collect ${rosterGoal(10)} heroes`, icon: '🧙', group: 'Heroes', goal: rosterGoal(10), reward: { gems: 100 }, measure: M.heroes },
  { id: 'heroes20', name: 'Full Hideout', desc: `Collect ${rosterGoal(20)} heroes`, icon: '🧙', group: 'Heroes', goal: rosterGoal(20), reward: { gems: 200, tickets: 1 }, measure: M.heroes },
  { id: 'heroes30', name: 'Grand Roster', desc: `Collect ${rosterGoal(30)} heroes`, icon: '🧙', group: 'Heroes', goal: rosterGoal(30), reward: { gems: 300, tickets: 2 }, measure: M.heroes },
  { id: 'heroes40', name: 'Every Grimoire', desc: `Collect ${rosterGoal(40)} heroes`, icon: '📚', group: 'Heroes', goal: rosterGoal(40), reward: { gems: 500, tickets: 3 }, measure: M.heroes },
  { id: 'level20', name: 'Training Montage', desc: 'Raise a hero to Lv 20', icon: '💪', group: 'Heroes', goal: 20, reward: { yul: 20000, essence: 10000 }, measure: M.level },
  { id: 'level40', name: 'Battle-Hardened', desc: 'Raise a hero to Lv 40', icon: '💪', group: 'Heroes', goal: 40, reward: { yul: 60000, essence: 30000, gems: 100 }, measure: M.level },
  { id: 'level60', name: 'Overflowing Mana', desc: 'Raise a hero to Lv 60', icon: '🔥', group: 'Heroes', goal: 60, reward: { yul: 150000, essence: 80000, gems: 300 }, measure: M.level },
  { id: 'star7', name: 'Limit Breaker', desc: 'Star a hero up to 7★', icon: '✴️', group: 'Heroes', goal: 7, reward: { gems: 500, tickets: 3 }, measure: M.stars },
  { id: 'pulls10', name: 'Grimoire Curious', desc: 'Summon 10 times', icon: '📖', group: 'Summons', goal: 10, reward: { gems: 100 }, measure: M.pulls },
  { id: 'pulls100', name: 'Tower Regular', desc: 'Summon 100 times', icon: '📖', group: 'Summons', goal: 100, reward: { gems: 300, tickets: 1 }, measure: M.pulls },
  { id: 'pulls300', name: 'Clover Collector', desc: 'Summon 300 times', icon: '🍀', group: 'Summons', goal: 300, reward: { gems: 500, tickets: 3 }, measure: M.pulls },
  { id: 'arena10', name: 'Arena Contender', desc: 'Win 10 Arena battles', icon: '⚔️', group: 'Arena & Tower', goal: 10, reward: { gems: 200, medals: 300 }, measure: M.arenaWins },
  { id: 'arena50', name: 'Arena Champion', desc: 'Win 50 Arena battles', icon: '🏅', group: 'Arena & Tower', goal: 50, reward: { gems: 500, medals: 1000 }, measure: M.arenaWins },
  { id: 'tower10', name: 'Tower Climber', desc: 'Clear Tower floor 10', icon: '🗼', group: 'Arena & Tower', goal: 10, reward: { gems: 150 }, measure: M.tower },
  { id: 'tower25', name: 'Halfway Up', desc: 'Clear Tower floor 25', icon: '🗼', group: 'Arena & Tower', goal: 25, reward: { gems: 300, tickets: 1 }, measure: M.tower },
  { id: 'tower50', name: 'Tower Conqueror', desc: 'Clear Tower floor 50', icon: '🏯', group: 'Arena & Tower', goal: 50, reward: { gems: 600, tickets: 3 }, measure: M.tower },
  { id: 'clan', name: 'Sworn Comrades', desc: 'Join a clan', icon: '🛡️', group: 'Clan', goal: 1, reward: { gems: 100, crests: 200 }, measure: M.clan },
  { id: 'pass10', name: 'Pass Holder', desc: 'Reach Grimoire Pass tier 10', icon: '🎟️', group: 'Grimoire Pass', goal: 10, reward: { gems: 150 }, measure: M.passTier },
  { id: 'pass30', name: 'Pass Master', desc: 'Reach Grimoire Pass tier 30', icon: '🎟️', group: 'Grimoire Pass', goal: 30, reward: { gems: 500, tickets: 2 }, measure: M.passTier },
  { id: 'login7', name: 'Regular', desc: 'Claim 7 daily logins', icon: '📅', group: 'Loyalty', goal: 7, reward: { gems: 150, tickets: 1 }, measure: M.loginDays },
  { id: 'login30', name: 'Never Give Up', desc: 'Claim 30 daily logins', icon: '🍀', group: 'Loyalty', goal: 30, reward: { gems: 500, tickets: 3 }, measure: M.loginDays },
];

export interface AchievementStatus {
  def: AchievementDef;
  /** Progress clamped to the goal. */
  progress: number;
  goal: number;
  claimed: boolean;
  ready: boolean;
}

export function evaluate(s: SaveState): AchievementStatus[] {
  const claimed = new Set(prog(s).achievements);
  return ACHIEVEMENTS.map((def) => {
    let v = 0;
    try {
      v = Math.max(0, Math.floor(num(def.measure(s))));
    } catch {
      v = 0;
    }
    const progress = Math.min(def.goal, v);
    const done = claimed.has(def.id);
    return { def, progress, goal: def.goal, claimed: done, ready: !done && progress >= def.goal };
  });
}

export function achievementsBadge(s: SaveState): boolean {
  return evaluate(s).some((a) => a.ready);
}

/** Mutating: mark an achievement claimed. Returns its reward, or null if not ready. */
export function claimAchievement(s: SaveState, id: string): Reward | null {
  const st = evaluate(s).find((a) => a.def.id === id);
  if (!st || !st.ready) return null;
  ensureProgression(s).achievements.push(id);
  return st.def.reward;
}
