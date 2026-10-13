// Tower of Trials: pure floor generation (enemy squads, twists, rewards). No store access.
import { afkRates, stageLevel, stageMult } from '../../data/campaign';
import { FACTION_MAP, FORMATION_MAP } from '../../data/formations';
import { HERO_MAP, SUMMONABLE } from '../../data/heroes';
import type { Combatant, TeamSetup } from '../../game/battle';
import { teamPower } from '../../game/power';
import { rng } from '../../game/rng';
import type { Reward } from '../../game/state';
import { RARITY_INFO } from '../../game/stats';
import type { Faction, HeroDef, Rarity, StatMods } from '../../game/types';

/** Floor f plays like campaign stage `stageBase + stagePerFloor * f`, a bit meaner. */
export const TOWER = { stageBase: 8, stagePerFloor: 2.2, extraMult: 1.06 };
/**
 * Enemy power relative to the reference squad (see refPower). Every floor is normalised to
 * this so the climb never gets easier: normal floors ~10% above a campaign stage at the
 * same depth, bosses and Trials well above that (Trial twists add on top).
 */
export const POWER_FACTOR = { normal: 1.12, boss: 1.3, trial: 1.3 };
export const BOSS_EVERY = 5;
export const TRIAL_EVERY = 10;
/** Floors with hero-page rewards. */
export const LEGENDARY_EVERY = 10;
export const MYTHIC_EVERY = 25;

export type TwistId = 'blitz' | 'fury' | 'faction' | 'fortress' | 'haste' | 'twin';

export interface TrialTwist {
  id: TwistId;
  name: string;
  icon: string;
  text: string;
  faction?: Faction;
}

export interface TowerFloor {
  floor: number;
  /** Campaign-stage equivalent depth (fractional). */
  depth: number;
  level: number;
  isBoss: boolean;
  isTrial: boolean;
  /** Floor hands out hero pages / tickets on first clear. */
  milestone: boolean;
  twist: TrialTwist | null;
  /** Hero id leading the floor (boss, or the toughest elite). */
  leader: string;
  name: string;
  banner: string;
  team: TeamSetup;
  reward: Reward;
  theme: { sky: [string, string]; ground: string };
}

const MINION_TIERS: string[][] = [
  ['bandit', 'bandit_mage', 'magic_beast', 'golem'],
  ['golem', 'diamond_mage', 'acolyte', 'magic_beast'],
  ['spade_soldier', 'imp', 'acolyte', 'diamond_mage'],
];

/** Boss order as you climb (loops). */
const BOSS_ORDER = ['revchi', 'mars', 'vetto', 'fana', 'licht', 'mereoleona', 'zenon', 'vanica', 'dante', 'lucifero', 'nozel', 'yami', 'julius', 'lucius'];

const TRIAL_FACTIONS: Faction[] = ['Black Bulls', 'Spade Kingdom', 'Golden Dawn', 'Midnight Sun', 'Magic Knights'];

const TWISTS: Omit<TrialTwist, 'faction'>[] = [
  { id: 'fury', name: 'Fury Trial', icon: '🔥', text: 'Enemies are berserk: +30% ATK.' },
  { id: 'blitz', name: 'Blitz Trial', icon: '⚡', text: 'Enemies are locked into Clover Blitz: all five charge from the front row.' },
  { id: 'faction', name: 'Faction Trial', icon: '🏳️', text: 'Every enemy comes from one faction, with full synergy.' },
  { id: 'fortress', name: 'Iron Trial', icon: '🧱', text: 'Enemies dig into Iron Fortress with +25% HP and +20% DEF.' },
  { id: 'haste', name: 'Haste Trial', icon: '💨', text: 'Enemies move fast: +25% SPD and +25% energy gain.' },
  { id: 'twin', name: 'Twin Boss Trial', icon: '☠️', text: 'Two bosses lead the enemy squad.' },
];

const NORMAL_FORMATIONS = ['balanced', 'vanguard', 'balanced', 'spearhead', 'vanguard', 'fortress'];

const exists = (id: string) => !!HERO_MAP[id];

export function floorDepth(f: number): number {
  return TOWER.stageBase + TOWER.stagePerFloor * f;
}

export function floorLevel(f: number): number {
  return stageLevel(Math.floor(floorDepth(f)));
}

export function floorMult(f: number): number {
  return stageMult(floorDepth(f)) * TOWER.extraMult;
}

export function floorStars(f: number): number {
  return Math.min(7, 1 + Math.floor(floorDepth(f) / 20));
}

export const isBossFloor = (f: number) => f > 0 && f % BOSS_EVERY === 0;
export const isTrialFloor = (f: number) => f > 0 && f % TRIAL_EVERY === 0;

/** The twist on a Trial floor (every 10th), or null. */
export function floorTwist(f: number): TrialTwist | null {
  if (!isTrialFloor(f)) return null;
  const n = f / TRIAL_EVERY - 1;
  const base = TWISTS[n % TWISTS.length];
  if (base.id !== 'faction') return { ...base };
  const faction = TRIAL_FACTIONS[Math.floor(n / TWISTS.length) % TRIAL_FACTIONS.length];
  const emblem = FACTION_MAP[faction]?.emblem ?? base.icon;
  return { ...base, name: `${faction} Trial`, icon: emblem, faction, text: `Every enemy is from ${faction}, with full faction synergy.` };
}

function elitePool(f: number): string[] {
  const rarities: Rarity[] = f < 8 ? ['R', 'SR'] : f < 18 ? ['SR', 'SSR'] : f < 30 ? ['SR', 'SSR', 'UR'] : ['SSR', 'UR'];
  const pool = SUMMONABLE.filter((h) => rarities.includes(h.rarity)).map((h) => h.id);
  return pool.length ? pool : SUMMONABLE.map((h) => h.id);
}

function minionPool(f: number): string[] {
  const tier = MINION_TIERS[Math.min(MINION_TIERS.length - 1, Math.floor(f / 10))].filter(exists);
  return tier.length ? tier : MINION_TIERS[0].filter(exists);
}

function bossFor(f: number, offset = 0): string {
  const order = BOSS_ORDER.filter(exists);
  return order[(f / BOSS_EVERY - 1 + offset) % order.length];
}

function frontness(h: HeroDef): number {
  if (h.role === 'Defender') return 3;
  if (h.range === 'melee') return 2;
  if (h.role === 'Attacker') return 1;
  return 0;
}

/** Ids of the plain reference squad that sets each floor's power budget. */
const REF_SQUAD = ['golem', 'bandit', 'magic_beast', 'bandit_mage', 'acolyte'];

/** Power of a plain minion squad at floor f's level, stars and multiplier. Strictly rises with f. */
export function refPower(f: number): number {
  const ids = REF_SQUAD.filter(exists);
  const use = ids.length ? ids : SUMMONABLE.slice(0, 5).map((h) => h.id);
  return teamPower({
    formation: FORMATION_MAP.balanced,
    members: use.map((heroId, slot) => ({ heroId, slot, level: floorLevel(f), stars: floorStars(f), mult: floorMult(f) })),
  });
}

/** Deterministic hero picked from a rarity for milestone pages. */
function pageHero(rarity: Rarity, n: number): string | null {
  const pool = SUMMONABLE.filter((h) => h.rarity === rarity).map((h) => h.id);
  return pool.length ? pool[n % pool.length] : null;
}

const round = (v: number, step: number) => Math.max(step, Math.round(v / step) * step);

/** First-clear reward of a floor. */
export function floorReward(f: number): Reward {
  const boss = isBossFloor(f);
  const afk = afkRates(Math.floor(floorDepth(f)));
  const k = boss ? 2 : 1;
  const r: Reward = {
    yul: round((afk.yul / 4) * k, 100),
    essence: round((afk.essence / 4) * k, 50),
    gems: round((25 + 3 * f) * k, 5),
  };
  const shards: Record<string, number> = {};
  if (f % LEGENDARY_EVERY === 0) {
    r.tickets = 1;
    const id = pageHero('SSR', f / LEGENDARY_EVERY - 1);
    if (id) shards[id] = 5;
  }
  if (f % MYTHIC_EVERY === 0) {
    r.tickets = (r.tickets ?? 0) + 1;
    const id = pageHero('UR', f / MYTHIC_EVERY - 1);
    if (id) shards[id] = (shards[id] ?? 0) + 5;
  }
  if (Object.keys(shards).length) r.shards = shards;
  return r;
}

export function isMilestone(f: number): boolean {
  return f > 0 && (f % LEGENDARY_EVERY === 0 || f % MYTHIC_EVERY === 0);
}

/** Next milestone floor strictly above `cleared`. */
export function nextMilestone(cleared: number): number {
  let f = cleared + 1;
  while (!isMilestone(f)) f++;
  return f;
}

/** Build floor `f` (1-based). Same floor → same squad, always. */
export function towerFloor(f: number): TowerFloor {
  const floor = Math.max(1, Math.floor(f));
  const r = rng(floor * 104729 + 7);
  const boss = isBossFloor(floor);
  const twist = floorTwist(floor);
  const level = floorLevel(floor);
  const mult = floorMult(floor);
  const stars = floorStars(floor);

  const picks: { id: string; boss?: boolean }[] = [];
  const taken = new Set<string>();
  const bag = (pool: string[]) => {
    const free = pool.filter((id) => !taken.has(id));
    const src = free.length ? free : pool;
    const id = src[Math.floor(r() * src.length)];
    taken.add(id);
    return id;
  };

  if (twist?.faction) {
    // Faction trial: the faction's strongest hero leads, the rest are faction members.
    const members = Object.values(HERO_MAP).filter((h) => h.faction === twist.faction);
    const leaders = [...members].sort((a, b) => RARITY_INFO[b.rarity].order - RARITY_INFO[a.rarity].order);
    const top = leaders.filter((h) => h.rarity === leaders[0].rarity).map((h) => h.id);
    const lead = top[Math.floor(r() * top.length)];
    taken.add(lead);
    picks.push({ id: lead, boss: true });
    const rest = members.map((h) => h.id);
    while (picks.length < 5) picks.push({ id: bag(rest) });
  } else if (boss) {
    const lead = bossFor(floor);
    taken.add(lead);
    picks.push({ id: lead, boss: true });
    if (twist?.id === 'twin') {
      const second = [1, 2, 3].map((o) => bossFor(floor, o)).find((id) => !taken.has(id)) ?? bossFor(floor, 1);
      taken.add(second);
      picks.push({ id: second, boss: true });
    }
    const nElites = Math.min(4, 2 + Math.floor(floor / 15));
    for (let i = 0; i < nElites && picks.length < 5; i++) picks.push({ id: bag(elitePool(floor)) });
    while (picks.length < 5) picks.push({ id: bag(minionPool(floor)) });
  } else {
    const nElites = Math.min(5, 1 + Math.floor(floor / 6));
    for (let i = 0; i < nElites; i++) picks.push({ id: bag(elitePool(floor)) });
    while (picks.length < 5) picks.push({ id: bag(minionPool(floor)) });
  }

  let formationId = boss ? 'balanced' : NORMAL_FORMATIONS[Math.floor(r() * NORMAL_FORMATIONS.length)];
  const bonus: StatMods = {};
  if (twist?.id === 'blitz') formationId = 'blitz';
  if (twist?.id === 'fortress') {
    formationId = 'fortress';
    bonus.hp = 0.25;
    bonus.def = 0.2;
  }
  if (twist?.id === 'fury') bonus.atk = 0.3;
  if (twist?.id === 'haste') {
    bonus.spd = 0.25;
    bonus.energy = 0.25;
  }
  const formation = FORMATION_MAP[formationId] ?? FORMATION_MAP.balanced;

  const sorted = picks
    .map((x) => ({ ...x, def: HERO_MAP[x.id] }))
    .sort((a, b) => frontness(b.def) - frontness(a.def) || Number(!!b.boss) - Number(!!a.boss));
  const members: Combatant[] = sorted.map((x, slot) => ({
    heroId: x.id,
    slot,
    level: x.boss ? level + 3 : level,
    stars: Math.max(RARITY_INFO[x.def.rarity].startStars, stars),
    boss: x.boss || undefined,
    // Rarity-normalised like the campaign: elites differ by kit, the floor sets raw strength.
    mult: mult / RARITY_INFO[x.def.rarity].mult,
  }));

  // Normalise the squad to the floor's power budget (two passes: power is near-linear in mult).
  const target = refPower(floor) * (twist ? POWER_FACTOR.trial : boss ? POWER_FACTOR.boss : POWER_FACTOR.normal);
  for (let pass = 0; pass < 2; pass++) {
    const p = teamPower({ members, formation });
    if (p > 0) members.forEach((m) => (m.mult = (m.mult ?? 1) * (target / p)));
  }

  const leaderPick =
    picks.find((p) => p.boss)?.id ??
    [...picks].sort((a, b) => RARITY_INFO[HERO_MAP[b.id].rarity].order - RARITY_INFO[HERO_MAP[a.id].rarity].order)[0].id;
  const leaderName = HERO_MAP[leaderPick].name;

  const theme: TowerFloor['theme'] = twist
    ? { sky: ['#ffb347', '#5b1a8a'], ground: '#4e342e' }
    : boss
      ? { sky: ['#a8324a', '#1f0a14'], ground: '#4a2f36' }
      : { sky: ['#6a5aa8', '#160f2b'], ground: '#4b4560' };

  return {
    floor,
    depth: floorDepth(floor),
    level,
    isBoss: boss,
    isTrial: !!twist,
    milestone: isMilestone(floor),
    twist,
    leader: leaderPick,
    name: twist ? twist.name : boss ? `Boss: ${leaderName}` : `Floor ${floor}`,
    banner: twist ? 'TRIAL!' : boss ? 'BOSS FLOOR!' : `FLOOR ${floor}`,
    team: { members, formation, bonus: Object.keys(bonus).length ? bonus : undefined },
    reward: floorReward(floor),
    theme,
  };
}

/** Can the player challenge floor f given `cleared` floors? (Cleared floors replay for fun.) */
export function canChallenge(cleared: number, f: number): boolean {
  return f >= 1 && f <= cleared + 1;
}

/** First-clear check: only the next floor pays out. */
export function isFirstClear(cleared: number, f: number): boolean {
  return f === cleared + 1;
}
