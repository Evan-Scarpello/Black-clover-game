// Magic Knight Missions: pure board generation, requirement checks, timing and auto-assign.
import { afkRates } from '../../data/campaign';
import { FACTION_MAP } from '../../data/formations';
import { HERO_MAP, SUMMONABLE } from '../../data/heroes';
import { rng, type Rng } from '../../game/rng';
import { RARITY_INFO, heroPower } from '../../game/stats';
import type { Faction, OwnedHero, Rarity, Role } from '../../game/types';
import type { DispatchMission, DispatchSave, MissionDef, MissionRank, MissionReq, MissionReward } from './state';

const HOUR = 3600000;

export interface RankInfo {
  hours: number;
  /** Hours of AFK income the Yul/Essence part is worth. */
  afkHours: number;
  gems: number;
  tickets: number;
  /** Hero pages (S only). */
  pages: number;
  size: [number, number];
  reqs: [number, number];
  color: string;
}

export const RANKS: Record<MissionRank, RankInfo> = {
  C: { hours: 1, afkHours: 1, gems: 10, tickets: 0, pages: 0, size: [1, 1], reqs: [0, 1], color: '#7fb3d5' },
  B: { hours: 2, afkHours: 2, gems: 25, tickets: 0, pages: 0, size: [1, 2], reqs: [1, 1], color: '#3ddc84' },
  A: { hours: 4, afkHours: 3.5, gems: 60, tickets: 0, pages: 0, size: [2, 3], reqs: [1, 2], color: '#b46bff' },
  S: { hours: 8, afkHours: 6, gems: 120, tickets: 1, pages: 4, size: [3, 3], reqs: [2, 2], color: '#ffc531' },
};

export const RANK_ORDER: MissionRank[] = ['S', 'A', 'B', 'C'];

const TITLES: Record<MissionRank, [string, string][]> = {
  C: [
    ['Escort the merchant caravan', '🐴'],
    ['Clear magic beasts near Hage', '🐗'],
    ['Patrol the Forsaken Realm', '🏚️'],
    ['Find a lost grimoire', '📕'],
    ['Guard the harvest festival', '🌾'],
    ['Chase bandits off the trade road', '🗡️'],
    ['Hunt a giant boar for dinner', '🍖'],
    ['Deliver letters to the capital', '✉️'],
  ],
  B: [
    ['Investigate the dungeon', '🕳️'],
    ['Escort a noble to the Royal Capital', '👑'],
    ['Recover stolen magic stones', '💎'],
    ['Scout the Diamond Kingdom border', '🔭'],
    ['Calm a rampaging mana zone', '🌋'],
    ['Track a Midnight Sun spy', '👁️'],
  ],
  A: [
    ['Raid a Midnight Sun hideout', '🌑'],
    ["Seal a dungeon's ancient core", '🔮'],
    ['Hunt a rogue mage in the Grand Magic Zone', '🧙'],
    ['Guard the Royal Knights Exam', '🏟️'],
    ['Explore the Underwater Temple', '🌊'],
  ],
  S: [
    ['Infiltrate the Spade Kingdom', '♠️'],
    ["Seal a devil's gate", '😈'],
    ['Retrieve a forbidden grimoire', '📜'],
    ["Repel the Dark Triad's vanguard", '⚔️'],
  ],
};

const FACTIONS: Faction[] = ['Black Bulls', 'Golden Dawn', 'Magic Knights', 'Midnight Sun', 'Spade Kingdom'];
const ROLES: Role[] = ['Attacker', 'Defender', 'Support'];
const STAR_REQ: Record<MissionRank, number> = { C: 2, B: 3, A: 4, S: 5 };
const RARITY_REQ: Partial<Record<MissionRank, Rarity>> = { B: 'SR', A: 'SSR', S: 'UR' };
const REQ_KINDS: Record<MissionRank, MissionReq['kind'][]> = {
  C: ['role', 'range', 'faction'],
  B: ['role', 'faction', 'stars', 'rarity', 'range'],
  A: ['faction', 'stars', 'rarity', 'role'],
  S: ['rarity', 'stars', 'faction', 'role'],
};

/** FNV-1a: a stable 32-bit seed from a string. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const pick = <T>(r: Rng, xs: T[]): T => xs[Math.floor(r() * xs.length)];
const between = (r: Rng, [lo, hi]: [number, number]) => lo + Math.floor(r() * (hi - lo + 1));
const round = (v: number, step: number) => Math.max(step, Math.round(v / step) * step);

function makeReq(kind: MissionReq['kind'], rank: MissionRank, r: Rng): MissionReq {
  switch (kind) {
    case 'faction':
      return { kind, faction: pick(r, FACTIONS) };
    case 'role':
      return { kind, role: pick(r, ROLES) };
    case 'range':
      return { kind, range: r() < 0.5 ? 'melee' : 'ranged' };
    case 'stars':
      return { kind, min: STAR_REQ[rank] };
    case 'rarity':
      return { kind, min: RARITY_REQ[rank] ?? 'SR' };
  }
}

function makeReward(rank: MissionRank, stage: number, r: Rng): MissionReward {
  const info = RANKS[rank];
  const afk = afkRates(Math.max(0, Math.floor(stage)));
  // Some missions pay mostly Yul, some mostly Essence, some evenly.
  const focus = r();
  const [ky, ke] = focus < 0.34 ? [1.6, 0.4] : focus < 0.67 ? [0.4, 1.6] : [1, 1];
  const reward: MissionReward = {
    yul: round(afk.yul * info.afkHours * ky, 100),
    essence: round(afk.essence * info.afkHours * ke, 50),
    gems: info.gems,
  };
  if (info.tickets) reward.tickets = info.tickets;
  if (info.pages) {
    const rarity: Rarity = r() < 0.5 ? 'SSR' : 'UR';
    const pool = SUMMONABLE.filter((h) => h.rarity === rarity);
    if (pool.length) reward.shards = { [pick(r, pool).id]: info.pages };
  }
  return reward;
}

/** The day's board. Same day → same missions; rewards scale with `stage` (campaign progress). */
export function generateBoard(day: string, stage: number): MissionDef[] {
  const r = rng(hashString(`missions:${day}`));
  const count = 6 + Math.floor(r() * 3);
  const ranks: MissionRank[] = ['C', 'C', 'B', 'B', 'A'];
  let hasS = false;
  while (ranks.length < count) {
    const x = r();
    if (x < 0.14 && !hasS) {
      ranks.push('S');
      hasS = true;
    } else ranks.push(x < 0.42 ? 'A' : x < 0.72 ? 'B' : 'C');
  }
  ranks.sort((a, b) => RANK_ORDER.indexOf(a) - RANK_ORDER.indexOf(b));

  const usedTitles = new Set<string>();
  return ranks.map((rank, i) => {
    const info = RANKS[rank];
    const pool = TITLES[rank].filter(([t]) => !usedTitles.has(t));
    const [title, icon] = pick(r, pool.length ? pool : TITLES[rank]);
    usedTitles.add(title);
    const size = between(r, info.size);
    const nReqs = between(r, info.reqs);
    const kinds = [...REQ_KINDS[rank]];
    const reqs: MissionReq[] = [];
    for (let k = 0; k < nReqs && kinds.length; k++) {
      const kind = kinds.splice(Math.floor(r() * kinds.length), 1)[0];
      reqs.push(makeReq(kind, rank, r));
    }
    return { id: `${day}#${i}`, title, icon, rank, hours: info.hours, size, reqs, reward: makeReward(rank, stage, r) };
  });
}

// ───────── requirements ─────────

export function heroMeets(req: MissionReq, h: OwnedHero): boolean {
  const def = HERO_MAP[h.id];
  if (!def) return false;
  switch (req.kind) {
    case 'faction':
      return def.faction === req.faction;
    case 'role':
      return def.role === req.role;
    case 'range':
      return def.range === req.range;
    case 'stars':
      return h.stars >= req.min;
    case 'rarity':
      return RARITY_INFO[def.rarity].order >= RARITY_INFO[req.min].order;
  }
}

export function reqText(req: MissionReq): string {
  switch (req.kind) {
    case 'faction':
      return `${req.faction} hero`;
    case 'role':
      return `a ${req.role}`;
    case 'range':
      return req.range === 'melee' ? 'a melee hero' : 'a ranged hero';
    case 'stars':
      return `a ${req.min}★+ hero`;
    case 'rarity':
      return req.min === 'UR' ? 'a Mythic hero' : `a ${RARITY_INFO[req.min].name}+ hero`;
  }
}

export function reqIcon(req: MissionReq): string {
  switch (req.kind) {
    case 'faction':
      return FACTION_MAP[req.faction]?.emblem ?? '🏳️';
    case 'role':
      return req.role === 'Attacker' ? '⚔️' : req.role === 'Defender' ? '🛡️' : '✨';
    case 'range':
      return req.range === 'melee' ? '👊' : '🏹';
    case 'stars':
      return '⭐';
    case 'rarity':
      return '💠';
  }
}

/** Which requirements the chosen heroes cover (one flag per requirement). */
export function reqsMet(def: MissionDef, heroes: OwnedHero[]): boolean[] {
  return def.reqs.map((q) => heroes.some((h) => heroMeets(q, h)));
}

/** Heroes currently away on a started, unclaimed mission. */
export function busyHeroes(d: DispatchSave): Set<string> {
  const busy = new Set<string>();
  for (const m of d.missions) if (!m.claimed && m.heroes.length) m.heroes.forEach((id) => busy.add(id));
  return busy;
}

export type StartCheck = { ok: true } | { ok: false; reason: string };

export function checkTeam(def: MissionDef, ids: string[], owned: Record<string, OwnedHero>, busy: Set<string>): StartCheck {
  if (new Set(ids).size !== ids.length) return { ok: false, reason: 'A hero can only go once.' };
  if (ids.length !== def.size) return { ok: false, reason: `Send exactly ${def.size} hero${def.size > 1 ? 'es' : ''}.` };
  const heroes: OwnedHero[] = [];
  for (const id of ids) {
    const h = owned[id];
    if (!h || !HERO_MAP[id]) return { ok: false, reason: 'You do not own that hero.' };
    if (busy.has(id)) return { ok: false, reason: `${HERO_MAP[id].name} is already on a mission.` };
    heroes.push(h);
  }
  const met = reqsMet(def, heroes);
  const miss = def.reqs.findIndex((_, i) => !met[i]);
  if (miss >= 0) return { ok: false, reason: `Needs ${reqText(def.reqs[miss])}.` };
  return { ok: true };
}

// ───────── timing ─────────

export type MissionStatus = 'idle' | 'active' | 'ready' | 'claimed';

export function durationMs(def: MissionDef): number {
  return def.hours * HOUR;
}

/** Time left, clamped to [0, duration] so a clock jump backwards can't extend it forever. */
export function remainingMs(m: DispatchMission, def: MissionDef, now: number): number {
  if (!m.heroes.length) return durationMs(def);
  const elapsed = Math.max(0, now - m.startedAt);
  return Math.max(0, Math.min(durationMs(def), durationMs(def) - elapsed));
}

export function missionStatus(m: DispatchMission, def: MissionDef, now: number): MissionStatus {
  if (m.claimed) return 'claimed';
  if (!m.heroes.length) return 'idle';
  return remainingMs(m, def, now) <= 0 ? 'ready' : 'active';
}

/** Gems to finish right now: 1 gem per 2 minutes left, at least 5. */
export function finishNowCost(remaining: number): number {
  if (remaining <= 0) return 0;
  return Math.max(5, Math.ceil(remaining / 120000));
}

export function defOf(d: DispatchSave, id: string): MissionDef | undefined {
  return d.board.find((b) => b.id === id);
}

export function hasReady(d: DispatchSave | undefined, now: number): boolean {
  if (!d || !Array.isArray(d.missions) || !Array.isArray(d.board)) return false;
  return d.missions.some((m) => {
    const def = defOf(d, m.id);
    return !!def && missionStatus(m, def, now) === 'ready';
  });
}

// ───────── board lifecycle (mutates the slice; callers commit) ─────────

function validDef(b: unknown): b is MissionDef {
  const x = b as MissionDef;
  return (
    !!x &&
    typeof x.id === 'string' &&
    typeof x.title === 'string' &&
    !!RANKS[x.rank] &&
    Number.isFinite(x.hours) &&
    x.hours > 0 &&
    Number.isInteger(x.size) &&
    x.size >= 1 &&
    Array.isArray(x.reqs) &&
    !!x.reward &&
    typeof x.reward === 'object'
  );
}

/** Make sure `d` holds `day`'s board. Unfinished missions from earlier days carry over. Returns true if changed. */
export function refreshBoard(d: DispatchSave, day: string, stage: number): boolean {
  if (!Array.isArray(d.board)) d.board = [];
  if (!Array.isArray(d.missions)) d.missions = [];
  if (typeof d.completed !== 'number') d.completed = 0;
  // Drop anything malformed or without a definition (saves can be old, synced or hand-edited).
  d.board = d.board.filter(validDef);
  d.missions = d.missions.filter((m) => m && typeof m.id === 'string' && Array.isArray(m.heroes) && d.board.some((b) => b.id === m.id));
  if (d.day === day && d.board.length) return false;
  const keep = d.missions.filter((m) => m.heroes.length > 0 && !m.claimed);
  const keepDefs = d.board.filter((b) => keep.some((m) => m.id === b.id));
  const fresh = generateBoard(day, stage);
  d.day = day;
  d.board = [...keepDefs, ...fresh];
  d.missions = [...keep, ...fresh.map((def) => ({ id: def.id, heroes: [], startedAt: 0, claimed: false }))];
  return true;
}

export function startMission(d: DispatchSave, id: string, ids: string[], owned: Record<string, OwnedHero>, now: number): StartCheck {
  const m = d.missions.find((x) => x.id === id);
  const def = defOf(d, id);
  if (!m || !def) return { ok: false, reason: 'That mission is gone.' };
  if (m.claimed || m.heroes.length) return { ok: false, reason: 'That mission is already underway.' };
  const check = checkTeam(def, ids, owned, busyHeroes(d));
  if (!check.ok) return check;
  m.heroes = [...ids];
  m.startedAt = now;
  return check;
}

/** Bring the heroes home early (no reward). */
export function recallMission(d: DispatchSave, id: string, now: number): boolean {
  const m = d.missions.find((x) => x.id === id);
  const def = defOf(d, id);
  if (!m || !def || missionStatus(m, def, now) !== 'active') return false;
  m.heroes = [];
  m.startedAt = 0;
  return true;
}

/** Mark a finished mission claimed and return its reward (caller grants + commits). */
export function claimMission(d: DispatchSave, id: string, now: number): MissionReward | null {
  const m = d.missions.find((x) => x.id === id);
  const def = defOf(d, id);
  if (!m || !def || missionStatus(m, def, now) !== 'ready') return null;
  m.claimed = true;
  d.completed = (d.completed ?? 0) + 1;
  return def.reward;
}

/** Skip the wait: returns the gem cost charged by the caller, or null if not active. */
export function rushMission(d: DispatchSave, id: string, now: number): number | null {
  const m = d.missions.find((x) => x.id === id);
  const def = defOf(d, id);
  if (!m || !def || missionStatus(m, def, now) !== 'active') return null;
  const cost = finishNowCost(remainingMs(m, def, now));
  m.startedAt = now - durationMs(def);
  return cost;
}

// ───────── quick dispatch ─────────

function combos<T>(xs: T[], k: number, visit: (c: T[]) => void, start = 0, acc: T[] = []) {
  if (acc.length === k) return visit(acc);
  for (let i = start; i <= xs.length - (k - acc.length); i++) {
    acc.push(xs[i]);
    combos(xs, k, visit, i + 1, acc);
    acc.pop();
  }
}

/** Cheapest valid squad for one mission from `cands` (already sorted cheapest first). */
export function bestTeam(def: MissionDef, cands: OwnedHero[], cost: (h: OwnedHero) => number): string[] | null {
  if (cands.length < def.size) return null;
  // Shortlist: the cheapest few for each requirement plus the cheapest overall keeps the search tiny.
  const short = new Map<string, OwnedHero>();
  for (const q of def.reqs) cands.filter((h) => heroMeets(q, h)).slice(0, 6).forEach((h) => short.set(h.id, h));
  cands.slice(0, 10).forEach((h) => short.set(h.id, h));
  const pool = [...short.values()].sort((a, b) => cost(a) - cost(b));
  const found: { team: OwnedHero[] | null; cost: number } = { team: null, cost: Infinity };
  combos(pool, def.size, (c) => {
    if (!reqsMet(def, c).every(Boolean)) return;
    const total = c.reduce((t, h) => t + cost(h), 0);
    if (total < found.cost) {
      found.cost = total;
      found.team = [...c];
    }
  });
  return found.team ? found.team.map((h) => h.id) : null;
}

/**
 * Pick squads for every idle mission (rarest/hardest first). Heroes that fit many open
 * requirements are kept for the missions that need them; ties go to weaker heroes.
 * Returns missionId → hero ids. Pure: does not start anything.
 */
export function quickAssign(d: DispatchSave, owned: Record<string, OwnedHero>, now: number): Record<string, string[]> {
  const busy = busyHeroes(d);
  const idle = d.missions
    .map((m) => ({ m, def: defOf(d, m.id) }))
    .filter((x): x is { m: DispatchMission; def: MissionDef } => !!x.def && missionStatus(x.m, x.def, now) === 'idle')
    .sort(
      (a, b) =>
        RANK_ORDER.indexOf(a.def.rank) - RANK_ORDER.indexOf(b.def.rank) || b.def.reqs.length - a.def.reqs.length || b.def.size - a.def.size,
    );
  const free = Object.values(owned).filter((h) => h && HERO_MAP[h.id] && !busy.has(h.id));
  const power = new Map(free.map((h) => [h.id, heroPower(HERO_MAP[h.id], h.level, h.stars)]));
  const maxPower = Math.max(1, ...power.values());
  const allReqs = idle.flatMap((x) => x.def.reqs);
  const usefulness = new Map(free.map((h) => [h.id, allReqs.filter((q) => heroMeets(q, h)).length]));
  const cost = (h: OwnedHero) => 1 + 2 * (usefulness.get(h.id) ?? 0) + (power.get(h.id) ?? 0) / maxPower;

  const out: Record<string, string[]> = {};
  const used = new Set<string>();
  for (const { m, def } of idle) {
    const cands = free.filter((h) => !used.has(h.id)).sort((a, b) => cost(a) - cost(b));
    const team = bestTeam(def, cands, cost);
    if (!team) continue;
    out[m.id] = team;
    team.forEach((id) => used.add(id));
  }
  return out;
}

/** Milliseconds until the local-midnight board refresh. */
export function msToNextDay(now: number): number {
  const d = new Date(now);
  d.setHours(24, 0, 0, 0);
  return d.getTime() - now;
}
