// Pure clan logic: levels, research, raid math, NPC simulation, daily limits, shop,
// chat sanitising and online-doc validation. No store access — everything here is testable.

import { FORMATION_MAP } from '../../data/formations';
import { HERO_MAP, SUMMONABLE, type HeroDef } from '../../data/heroes';
import { Battle, type TeamSetup } from '../../game/battle';
import { rng, type Rng } from '../../game/rng';
import type { Reward } from '../../game/state';
import type { StatMods } from '../../game/types';
import {
  AVATAR_HEROES,
  CHECKIN_XP,
  DONATIONS,
  RAID_ATTEMPT_XP,
  CHAT_COOLDOWN_MS,
  CHAT_KEEP,
  CHAT_LINES,
  CHAT_MAX,
  CHAT_REPLIES,
  CLAN_COLORS,
  DESC_MAX,
  EMBLEMS,
  MAX_LEVEL,
  NAME_MAX,
  NAME_MIN,
  NPC_CLAN_MAP,
  NPC_NAMES,
  RAID_ATTEMPTS_PER_DAY,
  RAID_BOSSES,
  RAID_MAX_LEVEL,
  RESEARCH,
  type NpcClanDef,
  type RaidBossDef,
  type ResearchNode,
} from './data';
import { defaultClan, defaultClanRaid, type ClanChatMsg, type ClanInfo, type ClanSave } from './state';

// ───────── hashing & dates ─────────

/** FNV-1a 32-bit hash of a string. */
export function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function seeded(...parts: (string | number)[]): Rng {
  return rng(hash(parts.join('|')));
}

const DAY_MS = 86400000;

/** Local calendar day as a day count (DST-safe). */
export function dayNumber(now: number): number {
  const d = new Date(now);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

/** Same format as today() in game/state.ts, for a day number. */
export function dayKey(dn: number): string {
  const d = new Date(dn * DAY_MS);
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

/** Day number of the Monday that starts this week. */
export function weekStart(now: number): number {
  const dn = dayNumber(now);
  return dn - ((dn + 3) % 7);
}

export function weekKey(now: number): string {
  return dayKey(weekStart(now));
}

export function weekIndex(now: number): number {
  return Math.floor((weekStart(now) - 4) / 7);
}

/** Local midnight (ms) of the given day number. */
export function dayStartMs(dn: number): number {
  const d = new Date(dn * DAY_MS);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).getTime();
}

export function msUntilTomorrow(now: number): number {
  return dayStartMs(dayNumber(now) + 1) - now;
}

export function msUntilWeekEnd(now: number): number {
  return dayStartMs(weekStart(now) + 7) - now;
}

export function daysBetween(from: number, to: number): number {
  if (!from || from > to) return 0;
  return dayNumber(to) - dayNumber(from);
}

// ───────── slice normalisation ─────────

/** Fill nested defaults missing from older saves (state.ts only shallow-merges). Idempotent. */
export function normalizeClan(c: ClanSave): ClanSave {
  const d = defaultClan();
  for (const k of Object.keys(d) as (keyof ClanSave)[]) {
    if ((c as any)[k] === undefined) (c as any)[k] = (d as any)[k];
  }
  if (!c.raid || typeof c.raid !== 'object') c.raid = defaultClanRaid();
  else c.raid = { ...defaultClanRaid(), ...c.raid };
  if (!Array.isArray(c.donated)) c.donated = [];
  if (!Array.isArray(c.chat)) c.chat = [];
  if (!c.research || typeof c.research !== 'object') c.research = {};
  if (!c.shopBought || typeof c.shopBought !== 'object') c.shopBought = {};
  return c;
}

export function clanKind(id: string | null): 'npc' | 'local' | 'online' | null {
  if (!id) return null;
  if (id.startsWith('npc:')) return 'npc';
  if (id.startsWith('local:')) return 'local';
  return 'online';
}

// ───────── clan level ─────────

/** XP needed to go from `level` to `level + 1`. */
export function xpNeed(level: number): number {
  return 400 + 300 * level;
}

/** Total XP needed to reach `level`. */
export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level))) - 1;
  return 400 * l + (300 * l * (l + 1)) / 2;
}

export interface LevelInfo {
  level: number;
  into: number;
  need: number;
  max: boolean;
}

export function levelFromXp(xp: number): LevelInfo {
  const x = Math.max(0, Number.isFinite(xp) ? xp : 0);
  let level = 1;
  while (level < MAX_LEVEL && x >= xpForLevel(level + 1)) level++;
  if (level >= MAX_LEVEL) return { level: MAX_LEVEL, into: 0, need: 0, max: true };
  return { level, into: x - xpForLevel(level), need: xpNeed(level), max: false };
}

/** Most clan XP one member can honestly earn in a day: check-in + every donation + every raid attempt. */
export const MAX_DAILY_XP = CHECKIN_XP + DONATIONS.reduce((a, t) => a + t.xp, 0) + RAID_ATTEMPTS_PER_DAY * RAID_ATTEMPT_XP;
/** No online clan predates this; spoofed older timestamps are floored to it. */
export const ONLINE_EPOCH = Date.UTC(2025, 0, 1);

/** Cap another player's claimed contribution at what was possible since they joined (online docs are untrusted). */
export function plausibleContribution(contribution: number, joinedAt: number, now: number, clanCreatedAt = 0): number {
  const since = Math.max(joinedAt || 0, clanCreatedAt || 0, ONLINE_EPOCH);
  // +2 days of slack: joining late one evening still allows today's and tomorrow's dailies.
  const days = Math.max(0, Math.floor((now - since) / DAY_MS)) + 2;
  return Math.max(0, Math.min(Number.isFinite(contribution) ? contribution : 0, days * MAX_DAILY_XP));
}

/** Clan XP from member contributions (online clans: no shared counter, no write races). */
export function clanXpFromContributions(contribs: number[]): number {
  return contribs.reduce((a, c) => a + clampNum(c, 0, MAX_CONTRIBUTION), 0);
}

// ───────── research ─────────

export function researchCap(node: ResearchNode, clanLevel: number): number {
  if (clanLevel < node.unlock) return 0;
  return Math.min(node.max, clanLevel + 2);
}

/** Crests to raise a node from `lvl` to `lvl + 1`. */
export function researchCost(node: ResearchNode, lvl: number): number {
  return Math.round((node.baseCost * Math.pow(lvl + 1, 1.3)) / 5) * 5;
}

export function researchLevel(levels: Record<string, number> | undefined, id: string): number {
  const v = levels?.[id];
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

/** Battle stat bonus from research, applied to every player team. */
export function researchMods(levels: Record<string, number> | undefined): StatMods {
  const mods: StatMods = {};
  for (const n of RESEARCH) {
    if (!n.stat) continue;
    const lvl = Math.min(n.max, researchLevel(levels, n.id));
    if (lvl > 0) mods[n.stat] = (mods[n.stat] ?? 0) + lvl * n.per;
  }
  return mods;
}

/** Extra share of AFK Yul from Golden Bounty (0.1 = +10%). */
export function bountyRate(levels: Record<string, number> | undefined): number {
  const n = RESEARCH.find((r) => r.id === 'golden')!;
  return Math.min(n.max, researchLevel(levels, 'golden')) * n.per;
}

// ───────── daily limits ─────────

export function checkinAvailable(c: ClanSave, day: string): boolean {
  return !!c.clanId && c.checkinDay !== day;
}

export function checkinReward(clanLevel: number): Reward {
  return { crests: 30 + 3 * clanLevel, yul: 1000 + 200 * clanLevel };
}

export function attemptsLeft(c: ClanSave, day: string): number {
  if (c.raidDay !== day) return RAID_ATTEMPTS_PER_DAY;
  return Math.max(0, RAID_ATTEMPTS_PER_DAY - (c.raidAttempts || 0));
}

export function donatedToday(c: ClanSave, day: string): number[] {
  return c.donateDay === day && Array.isArray(c.donated) ? c.donated : [];
}

export function canLeave(c: ClanSave, day: string): boolean {
  return !!c.clanId && c.leftDay !== day;
}

// ───────── raid ─────────

export const RAID_REF_DAMAGE = 30000;

export function bossForWeek(now: number): RaidBossDef {
  const i = weekIndex(now);
  return RAID_BOSSES[((i % RAID_BOSSES.length) + RAID_BOSSES.length) % RAID_BOSSES.length];
}

/** HP of boss level `bossLevel` this week. Scales with clan size, not clan level, so the
 * bar never jumps when the clan levels up mid-week. */
export function raidPool(bossLevel: number, members: number): number {
  const m = Math.max(4, Math.min(30, Math.floor(members) || 0));
  return Math.round(RAID_REF_DAMAGE * m * 3.75 * (1 + 0.4 * (bossLevel - 1)));
}

export interface RaidStatus {
  bossLevel: number;
  hp: number;
  maxHp: number;
  /** Boss levels defeated this week. */
  kills: number;
  /** Every boss level beaten this week. */
  cleared: boolean;
}

/** Turn the clan's total weekly damage into boss level + remaining HP (pools are cumulative). */
export function raidStatus(totalDamage: number, members: number): RaidStatus {
  let left = Math.max(0, Number.isFinite(totalDamage) ? totalDamage : 0);
  let level = 1;
  let kills = 0;
  while (level <= RAID_MAX_LEVEL) {
    const pool = raidPool(level, members);
    if (left < pool) return { bossLevel: level, hp: Math.round(pool - left), maxHp: pool, kills, cleared: false };
    left -= pool;
    kills++;
    level++;
  }
  const maxHp = raidPool(RAID_MAX_LEVEL, members);
  return { bossLevel: RAID_MAX_LEVEL, hp: 0, maxHp, kills: RAID_MAX_LEVEL, cleared: true };
}

export function raidBossStats(bossLevel: number, clanLevel: number) {
  const level = Math.max(1, Math.min(80, 15 + 2 * (bossLevel - 1) + Math.floor((clanLevel - 1) / 2)));
  return { level, stars: Math.min(7, 1 + Math.floor(level / 10)), atk: -0.3 + 0.06 * (bossLevel - 1) };
}

/** The enemy team for a raid fight: one boss whose in-battle HP is the boss's remaining HP. */
export function raidEnemy(boss: RaidBossDef, bossLevel: number, clanLevel: number, hp: number): TeamSetup {
  const st = raidBossStats(bossLevel, clanLevel);
  const formation = FORMATION_MAP['spearhead'] ?? Object.values(FORMATION_MAP)[0];
  const heroId = HERO_MAP[boss.heroId] ? boss.heroId : 'lucifero';
  const team: TeamSetup = {
    members: [{ heroId, level: st.level, stars: st.stars, slot: 0, boss: true, mult: 1 }],
    formation,
    bonus: { atk: st.atk },
  };
  // Measure the boss's HP before the bonus, then size the HP bonus to land on `hp`.
  const probe = new Battle({ members: [], formation }, team, 1).units.find((u) => u.side === 1);
  if (probe && hp > 0) {
    const want = Math.max(1, hp);
    const extra = want / probe.raw.hp - probe.maxHp / probe.raw.hp;
    team.bonus = { ...team.bonus, hp: extra };
  }
  return team;
}

export function raidDamage(units: { side: number; dmgDealt: number }[]): number {
  return Math.max(0, Math.round(units.filter((u) => u.side === 0).reduce((a, u) => a + (u.dmgDealt || 0), 0)));
}

export function raidAttemptReward(damage: number, clanLevel: number): Reward {
  const ratio = Math.max(0, damage) / RAID_REF_DAMAGE;
  const crests = Math.round(Math.min(140, 20 + 30 * ratio) + 2 * clanLevel);
  const gems = ratio >= 2 ? 30 : ratio >= 1 ? 20 : ratio >= 0.4 ? 10 : 5;
  return { crests, gems };
}

export function killChest(bossLevel: number, clanLevel: number): Reward {
  return { crests: 100 + 40 * bossLevel + 5 * clanLevel, gems: 40 + 20 * bossLevel, essence: 1500 * bossLevel };
}

export function addRewards(a: Reward, b: Reward): Reward {
  const out: Reward = { ...a };
  for (const k of ['yul', 'essence', 'gems', 'tickets', 'medals', 'crests'] as const) {
    if (b[k]) out[k] = (out[k] ?? 0) + (b[k] ?? 0);
  }
  if (b.shards) {
    out.shards = { ...(out.shards ?? {}) };
    for (const [id, n] of Object.entries(b.shards)) out.shards[id] = (out.shards[id] ?? 0) + n;
  }
  if (b.passXp) out.passXp = (out.passXp ?? 0) + b.passXp;
  return out;
}

/** Your weekly damage in this clan (0 when it belongs to another week or clan). */
export function myWeekDamage(c: ClanSave, clanId: string, week: string): number {
  return c.raid && c.raid.week === week && c.raid.clanId === clanId ? c.raid.damage : 0;
}

export function chestsClaimable(c: ClanSave, clanId: string, week: string, kills: number): number {
  const r = c.raid;
  if (!r || r.week !== week || r.clanId !== clanId || r.hits <= 0) return 0;
  return Math.max(0, Math.min(RAID_MAX_LEVEL, kills) - r.claimed);
}

// ───────── simulated members (NPC clans + recruits of offline clans) ─────────

export interface SimMember {
  id: string;
  name: string;
  hero: string;
  power: number;
  /** Raid damage multiplier vs the reference damage. */
  strength: number;
  leader: boolean;
  /** Contribution before you joined. */
  baseContribution: number;
}

export function simMembers(clanId: string, count: number, powerBase: number, withLeader: boolean): SimMember[] {
  const r = seeded('members', clanId);
  const names = [...NPC_NAMES];
  const out: SimMember[] = [];
  const n = Math.max(0, Math.min(names.length, Math.floor(count)));
  for (let i = 0; i < n; i++) {
    const name = names.splice(Math.floor(r() * names.length), 1)[0];
    const strength = 0.55 + r() * 1.0 + (withLeader && i === 0 ? 0.3 : 0);
    out.push({
      id: `${clanId}#${i}`,
      name,
      hero: AVATAR_HEROES[Math.floor(r() * AVATAR_HEROES.length)],
      power: Math.round(powerBase * (0.5 + strength * 0.6)),
      strength,
      leader: withLeader && i === 0,
      baseContribution: Math.round(300 + r() * 2800 + (withLeader && i === 0 ? 2000 : 0)),
    });
  }
  return out;
}

/** One sim member's raid hits on a given day: [ms after midnight, damage]. Deterministic. */
export function simDayHits(clanId: string, m: SimMember, dn: number, activity: number): [number, number][] {
  const hits: [number, number][] = [];
  for (let a = 0; a < RAID_ATTEMPTS_PER_DAY; a++) {
    const r = seeded('raid', clanId, m.id, dn, a);
    const show = r();
    const at = Math.floor((7 + r() * 16) * 3600000);
    const dmg = Math.round(RAID_REF_DAMAGE * m.strength * (0.75 + 0.5 * r()));
    if (show <= activity) hits.push([at, dmg]);
  }
  return hits;
}

/** Each sim member's damage so far this week (only hits that already happened today). */
export function simWeekDamage(clanId: string, members: SimMember[], activity: number, now: number, sinceDay = -Infinity): Record<string, number> {
  const out: Record<string, number> = {};
  const start = weekStart(now);
  const todayDn = dayNumber(now);
  const intoDay = now - dayStartMs(todayDn);
  for (const m of members) {
    let total = 0;
    for (let dn = Math.max(start, sinceDay); dn <= todayDn; dn++) {
      for (const [at, dmg] of simDayHits(clanId, m, dn, activity)) if (dn < todayDn || at <= intoDay) total += dmg;
    }
    out[m.id] = total;
  }
  return out;
}

/** When a sim member was last seen (their latest hit time, else a deterministic time yesterday). */
export function simLastActive(clanId: string, m: SimMember, activity: number, now: number): number {
  const todayDn = dayNumber(now);
  const intoDay = now - dayStartMs(todayDn);
  for (let back = 0; back < 4; back++) {
    const dn = todayDn - back;
    const hits = simDayHits(clanId, m, dn, activity)
      .map(([at]) => at)
      .filter((at) => back > 0 || at <= intoDay);
    if (hits.length) return dayStartMs(dn) + Math.max(...hits);
  }
  return dayStartMs(todayDn - 4) + Math.floor(seeded('seen', clanId, m.id)() * DAY_MS);
}

/** Recruits who joined your offline clan (grows by one a day). */
export function recruitCount(daysSinceCreated: number): number {
  return Math.min(11, 2 + Math.max(0, Math.floor(daysSinceCreated)));
}

export function recruitXp(daysSinceCreated: number): number {
  let xp = 0;
  for (let d = 0; d < Math.max(0, Math.floor(daysSinceCreated)); d++) xp += 25 * recruitCount(d);
  return xp;
}

/** NPC clan XP: its starting level, plus what its members add each day you're in it, plus you. */
export function npcClanXp(def: NpcClanDef, contribution: number, daysInClan: number): number {
  const base = xpForLevel(def.level) + Math.floor(xpNeed(def.level) * (hash(def.id) % 70) / 100);
  return base + Math.round(def.members * def.activity * 35) * Math.max(0, daysInClan) + Math.max(0, contribution);
}

// ───────── chat ─────────

// Control chars, bidi overrides and zero-width joiners that could garble the layout.
const UNSAFE_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g;

/** Clean free text from players: strip control/bidi chars, collapse whitespace, clamp length. */
export function cleanText(raw: unknown, max: number): string {
  if (typeof raw !== 'string') return '';
  const s = raw.replace(UNSAFE_CHARS, ' ').replace(/\s+/g, ' ').trim();
  const chars = Array.from(s);
  return chars.length > max ? chars.slice(0, max).join('').trim() : s;
}

export function textLength(s: string): number {
  return Array.from(s).length;
}

export function nameError(raw: string): string | null {
  const n = cleanText(raw, 100);
  if (textLength(n) < NAME_MIN) return `Name needs at least ${NAME_MIN} characters.`;
  if (textLength(n) > NAME_MAX) return `Name can be at most ${NAME_MAX} characters.`;
  return null;
}

export function canSendChat(lastSentAt: number, now: number): boolean {
  return now - lastSentAt >= CHAT_COOLDOWN_MS;
}

/** Append a message, keeping the last CHAT_KEEP. Returns null when the text is empty. */
export function appendChat(msgs: ClanChatMsg[], text: string, t: number): ClanChatMsg[] | null {
  const clean = cleanText(text, CHAT_MAX);
  if (!clean) return null;
  return [...(Array.isArray(msgs) ? msgs : []), { t, text: clean }].slice(-CHAT_KEEP);
}

export interface ChatLine {
  key: string;
  t: number;
  /** Sender id: "me", a sim member id or an online uid. */
  who: string;
  name: string;
  hero: string;
  text: string;
  isYou: boolean;
}

/** Canned NPC chatter for yesterday and today (only lines whose time has passed). */
export function simChat(clanId: string, members: SimMember[], extraLines: string[], now: number): ChatLine[] {
  if (!members.length) return [];
  const pool = [...extraLines, ...CHAT_LINES];
  const out: ChatLine[] = [];
  const todayDn = dayNumber(now);
  for (let dn = todayDn - 1; dn <= todayDn; dn++) {
    const r = seeded('chat', clanId, dn);
    const n = 4 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      const t = dayStartMs(dn) + Math.floor((7 + r() * 16) * 3600000);
      const m = members[Math.floor(r() * members.length)];
      const text = pool[Math.floor(r() * pool.length)];
      if (t <= now) out.push({ key: `sim-${dn}-${i}`, t, who: m.id, name: m.name, hero: m.hero, text, isYou: false });
    }
  }
  return out;
}

/** A friendly NPC reply a few seconds after each of your messages. */
export function simReplies(clanId: string, members: SimMember[], mine: ClanChatMsg[], now: number): ChatLine[] {
  if (!members.length) return [];
  const out: ChatLine[] = [];
  for (const msg of mine) {
    const r = seeded('reply', clanId, msg.t);
    const t = msg.t + 2500 + Math.floor(r() * 5000);
    const m = members[Math.floor(r() * members.length)];
    if (t <= now) out.push({ key: `rep-${msg.t}`, t, who: m.id, name: m.name, hero: m.hero, text: CHAT_REPLIES[Math.floor(r() * CHAT_REPLIES.length)], isYou: false });
  }
  return out;
}

export function sortChat(lines: ChatLine[], keep = 40): ChatLine[] {
  return [...lines].sort((a, b) => a.t - b.t || a.key.localeCompare(b.key)).slice(-keep);
}

// ───────── shop ─────────

export interface ShopItem {
  id: string;
  label: string;
  /** Hero id for page items. */
  heroId?: string;
  reward: Reward;
  cost: number;
  limit: number;
  tag?: string;
}

/** Today's clan shop: four rotating hero-page offers (one per rarity) + staples. */
export function shopItems(day: string, pool: HeroDef[] = SUMMONABLE): ShopItem[] {
  const r = seeded('shop', day);
  const items: ShopItem[] = [];
  const offers: { rarity: HeroDef['rarity']; pages: number; cost: number; limit: number; tag: string }[] = [
    { rarity: 'UR', pages: 5, cost: 1500, limit: 1, tag: 'Mythic' },
    { rarity: 'SSR', pages: 5, cost: 700, limit: 1, tag: 'Legendary' },
    { rarity: 'SR', pages: 5, cost: 220, limit: 2, tag: 'Epic' },
    { rarity: 'R', pages: 5, cost: 90, limit: 3, tag: 'Rare' },
  ];
  for (const o of offers) {
    const list = pool.filter((h) => h.rarity === o.rarity);
    if (!list.length) continue;
    const h = list[Math.floor(r() * list.length)];
    items.push({ id: `pages:${h.id}`, label: `${h.name.split(' ')[0]} pages`, heroId: h.id, reward: { shards: { [h.id]: o.pages } }, cost: o.cost, limit: o.limit, tag: o.tag });
  }
  items.push(
    { id: 'ticket', label: 'Summon Ticket', reward: { tickets: 1 }, cost: 160, limit: 2 },
    { id: 'essence', label: 'Essence Flask', reward: { essence: 3000 }, cost: 60, limit: 3 },
    { id: 'yul', label: 'Yul Sack', reward: { yul: 20000 }, cost: 50, limit: 3 },
  );
  return items;
}

export function shopLeft(c: ClanSave, day: string, item: ShopItem): number {
  const bought = c.shopDay === day ? (c.shopBought?.[item.id] ?? 0) : 0;
  return Math.max(0, item.limit - bought);
}

// ───────── online documents (untrusted) ─────────

export const MAX_CONTRIBUTION = 5_000_000;
export const MAX_POWER = 100_000_000;
export const MAX_RAID_DAMAGE = 1_000_000_000;

function clampNum(v: unknown, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : min;
  return Math.max(min, Math.min(max, n));
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Opaque player ids (doc ids) are only ever used as keys/paths: keep them short and plain. */
export function validId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 128 && /^[A-Za-z0-9_\-.~:@+]+$/.test(id) && id !== '.' && id !== '..';
}

export function validColor(c: unknown): string {
  return typeof c === 'string' && CLAN_COLORS.includes(c) ? c : CLAN_COLORS[0];
}

export function validEmblem(e: unknown): string {
  return typeof e === 'string' && (EMBLEMS as readonly string[]).includes(e) ? e : EMBLEMS[0];
}

/** clans/<leaderUid>: {v:1, name, emblem, color, desc, createdAt}. */
export function parseClanDoc(raw: unknown): ClanInfo | null {
  if (!isObj(raw) || raw.v !== 1) return null;
  const name = cleanText(raw.name, NAME_MAX);
  if (textLength(name) < NAME_MIN) return null;
  return {
    name,
    emblem: validEmblem(raw.emblem),
    color: validColor(raw.color),
    desc: cleanText(raw.desc, DESC_MAX),
    createdAt: clampNum(raw.createdAt, 0, 1e15),
  };
}

export interface MemberDoc {
  clanId: string;
  joinedAt: number;
  power: number;
  contribution: number;
  lastActive: number;
}

/** clanMembers/<uid>: {v:1, clanId, joinedAt, power, contribution, lastActive}. */
export function parseMemberDoc(raw: unknown, clanId?: string): MemberDoc | null {
  if (!isObj(raw) || raw.v !== 1 || !validId(raw.clanId)) return null;
  if (clanId !== undefined && raw.clanId !== clanId) return null;
  return {
    clanId: raw.clanId,
    joinedAt: clampNum(raw.joinedAt, 0, 1e15),
    power: Math.round(clampNum(raw.power, 0, MAX_POWER)),
    contribution: Math.round(clampNum(raw.contribution, 0, MAX_CONTRIBUTION)),
    lastActive: clampNum(raw.lastActive, 0, 1e15),
  };
}

/** clanRaids/<uid>: {v:1, clanId, week, damage} → this week's damage, or null. */
export function parseRaidDoc(raw: unknown, clanId: string, week: string): number | null {
  if (!isObj(raw) || raw.v !== 1 || raw.clanId !== clanId || raw.week !== week) return null;
  return Math.round(clampNum(raw.damage, 0, MAX_RAID_DAMAGE));
}

/** clanChat/<uid>: {v:1, clanId, msgs:[{t, text}]} → cleaned messages (last CHAT_KEEP). */
export function parseChatDoc(raw: unknown, clanId: string): ClanChatMsg[] {
  if (!isObj(raw) || raw.v !== 1 || raw.clanId !== clanId || !Array.isArray(raw.msgs)) return [];
  const out: ClanChatMsg[] = [];
  for (const m of raw.msgs.slice(-CHAT_KEEP)) {
    if (!isObj(m)) continue;
    const t = typeof m.t === 'number' && Number.isFinite(m.t) && m.t > 0 ? m.t : null;
    const text = cleanText(m.text, CHAT_MAX);
    if (t !== null && text) out.push({ t, text });
  }
  return out;
}

/** Profile hero for an online member (deterministic from the id). */
export function avatarFor(id: string): string {
  return AVATAR_HEROES[hash(id) % AVATAR_HEROES.length];
}

export function npcClan(id: string | null): NpcClanDef | null {
  return id ? (NPC_CLAN_MAP[id] ?? null) : null;
}
