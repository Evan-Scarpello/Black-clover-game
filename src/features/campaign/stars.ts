// Stage star ratings and chapter star chests. Pure functions over the CampaignSave slice
// (no store access) so they are easy to test; callers grant rewards and commit.
//
// STAR RULE (shown to players in the stage sheet):
//   ★★★  win with no hero knocked out, before overtime starts (45s of battle time)
//   ★★   win within 70s with at most one hero knocked out
//   ★    any other win
// Battle time is simulated time, so game speed (1x/2x/3x) and Skip don't change it.
// Simulations show heroes rarely fall in a won fight, so time carries most of the weight:
// at even power a mid-game fight lands ~2★, and ~1.25x power earns 3★.
// A hero that was knocked out and revived counts as standing (only the final state matters).
// Stages cleared before stars existed count as 1★ — every cleared stage was won at least once.
import { STAGES_PER_CHAPTER } from '../../data/campaign';
import type { Reward } from '../../game/state';
import type { CampaignSave } from './state';

/** 3★ time limit: the start of overtime (OVERTIME in src/game/battle.ts). */
export const STAR_TIME_LIMIT = 45;
/** 2★ time limit (battles end at 90s). */
export const TWO_STAR_TIME = 70;
export const MAX_STAGE_STARS = 3;
export const CHAPTER_MAX_STARS = STAGES_PER_CHAPTER * MAX_STAGE_STARS;

export const STAR_RULES: { stars: number; text: string }[] = [
  { stars: 1, text: 'Win the battle' },
  { stars: 2, text: `Win within ${TWO_STAR_TIME}s, at most 1 hero down` },
  { stars: 3, text: `Nobody down, win before overtime (${STAR_TIME_LIMIT}s)` },
];

export interface StarInput {
  won: boolean;
  /** Player heroes knocked out at the end of the fight. */
  fallen: number;
  /** Battle time in seconds. */
  time: number;
}

export function computeStars({ won, fallen, time }: StarInput): number {
  if (!won) return 0;
  if (fallen <= 0 && time <= STAR_TIME_LIMIT) return 3;
  if (fallen <= 1 && time <= TWO_STAR_TIME) return 2;
  return 1;
}

/** Minimal view of a finished Battle (keeps this module free of the engine). */
export interface FinishedBattle {
  winner: 0 | 1 | null;
  time: number;
  units: { side: 0 | 1; alive: boolean }[];
}

export function starsFromBattle(b: FinishedBattle): number {
  const fallen = b.units.filter((u) => u.side === 0 && !u.alive).length;
  return computeStars({ won: b.winner === 0, fallen, time: b.time });
}

export function starString(n: number, max = MAX_STAGE_STARS): string {
  const k = clampStars(n);
  return '★'.repeat(k) + '☆'.repeat(Math.max(0, max - k));
}

function clampStars(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : 0;
  return Math.max(0, Math.min(MAX_STAGE_STARS, n));
}

/** The save's campaign slice, created/repaired in place if an old or damaged save lacks it. */
export function ensureCampaign(s: { campaign?: CampaignSave }): CampaignSave {
  if (!s.campaign || typeof s.campaign !== 'object') s.campaign = { stars: {}, chests: {} };
  return sanitizeCampaign(s.campaign);
}

/** Repair a slice that came from an old or damaged save. Returns the same object. */
export function sanitizeCampaign(c: CampaignSave): CampaignSave {
  if (!c.stars || typeof c.stars !== 'object' || Array.isArray(c.stars)) c.stars = {};
  if (!c.chests || typeof c.chests !== 'object' || Array.isArray(c.chests)) c.chests = {};
  return c;
}

/** Record a win's stars, keeping the best ever. `cleared` (SaveState.stage before this win)
 * lets stages cleared before stars existed count as 1★ already, matching stageStars(). */
export function recordStars(c: CampaignSave, stage: number, stars: number, cleared = 0): { prev: number; best: number; improved: boolean } {
  sanitizeCampaign(c);
  const key = String(stage);
  const stored = clampStars(c.stars[key]);
  const prev = stage >= 0 && stage < cleared ? Math.max(1, stored) : stored;
  const got = clampStars(stars);
  if (got > stored) c.stars[key] = Math.max(got, prev);
  return { prev, best: Math.max(prev, got), improved: got > prev };
}

/** Stars shown for a stage. `cleared` is SaveState.stage (stages cleared so far). */
export function stageStars(c: CampaignSave | undefined, cleared: number, stage: number): number {
  if (stage >= cleared || stage < 0) return 0;
  const stored = c && c.stars && typeof c.stars === 'object' ? clampStars(c.stars[String(stage)]) : 0;
  return Math.max(1, stored);
}

export function chapterStars(c: CampaignSave | undefined, cleared: number, chapter: number): number {
  let n = 0;
  const first = chapter * STAGES_PER_CHAPTER;
  for (let k = 0; k < STAGES_PER_CHAPTER; k++) n += stageStars(c, cleared, first + k);
  return n;
}

export function totalStars(c: CampaignSave | undefined, cleared: number): number {
  let n = 0;
  for (let i = 0; i < cleared; i++) n += stageStars(c, cleared, i);
  return n;
}

// ───────── chapter star chests ─────────

export const CHEST_STARS = [10, 20, 30] as const;
export const CHEST_NAMES = ['Bronze Chest', 'Silver Chest', 'Golden Chest'];

/** Rewards scale with the chapter (gems flatten out deep in the Abyss). */
export function chestReward(chapter: number, tier: number): Reward {
  const c = Math.max(0, Math.floor(chapter));
  const g = Math.min(c, 18);
  if (tier <= 0) return { gems: 50 + 15 * g, essence: 2500 * (c + 1) };
  if (tier === 1) return { gems: 100 + 25 * g, yul: 6000 * (c + 1), tickets: 1 };
  return { gems: 200 + 40 * g, tickets: 2 };
}

export type ChestStatus = 'locked' | 'ready' | 'claimed';

export function chestClaimed(c: CampaignSave | undefined, chapter: number, tier: number): boolean {
  const list = c && c.chests && typeof c.chests === 'object' ? c.chests[String(chapter)] : undefined;
  return Array.isArray(list) && list.includes(tier);
}

export function chestStatus(c: CampaignSave | undefined, cleared: number, chapter: number, tier: number): ChestStatus {
  if (tier < 0 || tier >= CHEST_STARS.length) return 'locked';
  if (chestClaimed(c, chapter, tier)) return 'claimed';
  return chapterStars(c, cleared, chapter) >= CHEST_STARS[tier] ? 'ready' : 'locked';
}

/** Open a chest if it is ready: marks it claimed and returns its reward (null otherwise).
 * Callers grant the reward and commit. */
export function claimChest(c: CampaignSave, cleared: number, chapter: number, tier: number): Reward | null {
  if (chestStatus(c, cleared, chapter, tier) !== 'ready') return null;
  sanitizeCampaign(c);
  const key = String(chapter);
  const list = Array.isArray(c.chests[key]) ? c.chests[key].filter((t) => typeof t === 'number') : [];
  list.push(tier);
  c.chests[key] = list.sort((a, b) => a - b);
  return chestReward(chapter, tier);
}

/** Every chest that can be opened right now, oldest chapter first. */
export function readyChests(c: CampaignSave | undefined, cleared: number): { chapter: number; tier: number }[] {
  const out: { chapter: number; tier: number }[] = [];
  const last = Math.floor(Math.max(0, cleared - 1) / STAGES_PER_CHAPTER);
  for (let ch = 0; ch <= last; ch++) {
    for (let t = 0; t < CHEST_STARS.length; t++) if (chestStatus(c, cleared, ch, t) === 'ready') out.push({ chapter: ch, tier: t });
  }
  return out;
}

/** Red-dot helper for the Battle tab: a star chest is waiting. */
export function campaignBadge(s: { stage: number; campaign?: CampaignSave }): boolean {
  return readyChests(s.campaign, s.stage).length > 0;
}
