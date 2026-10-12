// Global game store: one mutable save object + subscribe/commit, persisted to localStorage.

import { useEffect, useState } from 'preact/hooks';
import { AFK_CAP_HOURS, afkRates, getStage } from '../data/campaign';
import { FORMATIONS, FORMATION_MAP } from '../data/formations';
import { getHero } from '../data/heroes';
import type { Combatant, TeamSetup } from './battle';
import { COST_SINGLE, COST_TEN, getBanners, summon as doSummon, type PullResult } from './gacha';
import { BONUS_QUEST, DAILY_QUESTS, bump, claimable, refreshDay } from './quests';
import { randomSeed, rng } from './rng';
import { loadSave, newSave, writeSave, type Currencies, type SaveState } from './state';
import { MAX_STARS, heroPower, levelCap, levelUpCost, starUpCost } from './stats';
import { teamPower } from './power';

let state: SaveState = loadSave();
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function getState(): SaveState {
  return state;
}

const commitHooks = new Set<() => void>();

/** Run after every progress-changing commit (used by the cloud save). */
export function onCommit(fn: () => void) {
  commitHooks.add(fn);
}

/** Save locally and notify the UI without marking new progress. */
function commitQuiet() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => writeSave(state), 250);
  listeners.forEach((l) => l());
}

export function commit() {
  state.updatedAt = Date.now();
  commitQuiet();
  commitHooks.forEach((h) => h());
}

/** Swap in a save from elsewhere (cloud copy or a hot reload snapshot). */
export function replaceState(next: SaveState) {
  state = next;
  writeSave(state);
  listeners.forEach((l) => l());
}

export function saveNow() {
  state.lastSeen = Date.now();
  writeSave(state);
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useGame(): SaveState {
  const [, setV] = useState(0);
  useEffect(() => {
    const l = () => setV((v) => v + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}

// ───────── session bootstrap ─────────

/** Returns how long the player was away (ms) before this session. */
export function startSession(now = Date.now()): number {
  const away = now - state.lastSeen;
  refreshDay(state, now);
  state.lastSeen = now;
  commitQuiet();
  return away;
}

// ───────── currencies ─────────

export function canAfford(cost: Partial<Currencies>): boolean {
  return (Object.keys(cost) as (keyof Currencies)[]).every((k) => state.currencies[k] >= (cost[k] ?? 0));
}

function pay(cost: Partial<Currencies>) {
  for (const k of Object.keys(cost) as (keyof Currencies)[]) state.currencies[k] -= cost[k] ?? 0;
}

export function grant(r: Partial<Currencies>) {
  for (const k of Object.keys(r) as (keyof Currencies)[]) state.currencies[k] += Math.floor(r[k] ?? 0);
}

// ───────── heroes ─────────

export function levelUp(id: string, times = 1): number {
  const h = state.heroes[id];
  if (!h) return 0;
  let done = 0;
  for (let i = 0; i < times; i++) {
    if (h.level >= levelCap(h.stars)) break;
    const cost = levelUpCost(h.level);
    if (!canAfford(cost)) break;
    pay(cost);
    h.level++;
    done++;
  }
  if (done) {
    bump(state, 'levelup', done);
    commit();
  }
  return done;
}

export function starUp(id: string): boolean {
  const h = state.heroes[id];
  if (!h || h.stars >= MAX_STARS) return false;
  const cost = starUpCost(getHero(id), h.stars);
  if (h.shards < cost) return false;
  h.shards -= cost;
  h.stars++;
  commit();
  return true;
}

/** True when the hero can afford a level-up or a star-up right now. */
export function canLevel(s: SaveState, id: string): boolean {
  const h = s.heroes[id];
  if (!h) return false;
  if (h.stars < MAX_STARS && h.shards >= starUpCost(getHero(id), h.stars)) return true;
  if (h.level >= levelCap(h.stars)) return false;
  const c = levelUpCost(h.level);
  return s.currencies.yul >= c.yul && s.currencies.essence >= c.essence;
}

export function ownedPower(id: string): number {
  const h = state.heroes[id];
  return h ? heroPower(getHero(id), h.level, h.stars) : 0;
}

// ───────── squad ─────────

export function unlockedFormations() {
  return FORMATIONS.filter((f) => state.stage >= f.unlockStage);
}

export function setFormation(id: string) {
  if (!FORMATION_MAP[id] || state.stage < FORMATION_MAP[id].unlockStage) return;
  state.squad.formation = id;
  commit();
}

export function setSlot(slot: number, heroId: string | null) {
  const slots = state.squad.slots;
  if (heroId) {
    const existing = slots.indexOf(heroId);
    if (existing >= 0) slots[existing] = slots[slot] ?? null; // swap
  }
  slots[slot] = heroId;
  commit();
}

export function swapSlots(a: number, b: number) {
  const s = state.squad.slots;
  [s[a], s[b]] = [s[b], s[a]];
  commit();
}

/** Fill the squad with the five strongest heroes, Defenders/melee placed in front slots. */
export function autoFill() {
  const formation = FORMATION_MAP[state.squad.formation];
  const best = Object.values(state.heroes)
    .map((h) => ({ id: h.id, p: heroPower(getHero(h.id), h.level, h.stars) }))
    .sort((a, b) => b.p - a.p)
    .slice(0, 5)
    .map((x) => getHero(x.id));
  const frontScore = (h: ReturnType<typeof getHero>) => (h.role === 'Defender' ? 3 : 0) + (h.range === 'melee' ? 2 : 0) - (h.role === 'Support' ? 2 : 0);
  best.sort((a, b) => frontScore(b) - frontScore(a));
  const frontIdx = formation.rows.map((r, i) => (r === 'front' ? i : -1)).filter((i) => i >= 0);
  const backIdx = formation.rows.map((r, i) => (r === 'back' ? i : -1)).filter((i) => i >= 0);
  const order = [...frontIdx, ...backIdx];
  const slots: (string | null)[] = [null, null, null, null, null];
  best.forEach((h, i) => (slots[order[i]] = h.id));
  state.squad.slots = slots;
  commit();
}

export function playerTeam(s: SaveState = state): TeamSetup {
  const members: Combatant[] = [];
  s.squad.slots.forEach((id, slot) => {
    const h = id ? s.heroes[id] : null;
    if (h) members.push({ heroId: h.id, level: h.level, stars: h.stars, slot });
  });
  return { members, formation: FORMATION_MAP[s.squad.formation] ?? FORMATIONS[0] };
}

export function squadPower(): number {
  return teamPower(playerTeam());
}

// ───────── campaign ─────────

export interface BattleReward {
  yul: number;
  essence: number;
  gems: number;
  tickets: number;
  firstClear: boolean;
  unlockedFormation?: string;
}

export function recordBattle(stageIndex: number, won: boolean, ults: number): BattleReward | null {
  state.stats.battles++;
  state.stats.ults += ults;
  bump(state, 'ult', ults);
  if (!won) {
    commit();
    return null;
  }
  state.stats.wins++;
  bump(state, 'win');
  const st = getStage(stageIndex);
  const first = stageIndex >= state.stage;
  const reward: BattleReward = {
    yul: st.rewards.yul,
    essence: st.rewards.essence,
    gems: first ? st.firstClear.gems : 0,
    tickets: first ? st.firstClear.tickets : 0,
    firstClear: first,
  };
  if (first) {
    state.stage = stageIndex + 1;
    const unlocked = FORMATIONS.find((f) => f.unlockStage === state.stage);
    if (unlocked) reward.unlockedFormation = unlocked.name;
  }
  grant(reward);
  commit();
  return reward;
}

// ───────── idle / AFK ─────────

export function afkPending(now = Date.now()) {
  const hours = Math.min(AFK_CAP_HOURS, Math.max(0, now - state.lastAfkClaim) / 3600000);
  const r = afkRates(state.stage);
  return {
    hours,
    capped: hours >= AFK_CAP_HOURS,
    yul: Math.floor(r.yul * hours),
    essence: Math.floor(r.essence * hours),
    gems: Math.floor(r.gems * hours),
  };
}

export function claimAfk(now = Date.now()) {
  const p = afkPending(now);
  grant({ yul: p.yul, essence: p.essence, gems: p.gems });
  state.lastAfkClaim = now;
  bump(state, 'afk');
  commit();
  return p;
}

export const FAST_REWARD_HOURS = 2;
export const FAST_REWARD_COSTS = [0, 100, 200];

export function fastRewardCost(): number | null {
  return FAST_REWARD_COSTS[state.fastRewards.used] ?? null;
}

export function fastReward() {
  const cost = fastRewardCost();
  if (cost === null || state.currencies.gems < cost) return null;
  state.currencies.gems -= cost;
  state.fastRewards.used++;
  const r = afkRates(state.stage);
  const got = { yul: r.yul * FAST_REWARD_HOURS, essence: r.essence * FAST_REWARD_HOURS, gems: 0 };
  grant(got);
  commit();
  return got;
}

// ───────── summon ─────────

export function summon(bannerId: string, count: 1 | 10): PullResult[] | null {
  const banner = getBanners().find((b) => b.id === bannerId);
  if (!banner) return null;
  if (state.currencies.tickets >= count) state.currencies.tickets -= count;
  else {
    const cost = count === 10 ? COST_TEN : COST_SINGLE;
    if (state.currencies.gems < cost) return null;
    state.currencies.gems -= cost;
  }
  const results = doSummon(state, banner, count, rng(randomSeed()));
  state.stats.pulls += count;
  bump(state, 'summon', count);
  commit();
  return results;
}

// ───────── quests ─────────

export function claimQuest(id: string): boolean {
  const q = [...DAILY_QUESTS, BONUS_QUEST].find((x) => x.id === id);
  if (!q || !claimable(state, q)) return false;
  state.quests.claimed.push(id);
  grant(q.reward);
  commit();
  return true;
}

// ───────── misc ─────────

export function updateSettings(p: Partial<SaveState['settings']>) {
  Object.assign(state.settings, p);
  commit();
}

export function markChapterSeen(idx: number) {
  state.seenChapter = Math.max(state.seenChapter, idx);
  commit();
}

export function finishTutorial() {
  state.tutorialDone = true;
  commit();
}

export function resetGame() {
  state = newSave();
  refreshDay(state);
  writeSave(state);
  listeners.forEach((l) => l());
  commitHooks.forEach((h) => h());
}
