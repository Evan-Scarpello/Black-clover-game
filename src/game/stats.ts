import type { HeroDef, Rarity, Role, StatMods, Stats } from './types';

export const RARITY_INFO: Record<Rarity, { name: string; color: string; mult: number; startStars: number; order: number }> = {
  R: { name: 'Rare', color: '#4fa3ff', mult: 1.0, startStars: 1, order: 0 },
  SR: { name: 'Epic', color: '#b46bff', mult: 1.15, startStars: 2, order: 1 },
  SSR: { name: 'Legendary', color: '#ffc531', mult: 1.32, startStars: 3, order: 2 },
  UR: { name: 'Mythic', color: '#ff3d6e', mult: 1.5, startStars: 4, order: 3 },
};

export const ROLE_INFO: Record<Role, { icon: string; color: string; desc: string }> = {
  Attacker: { icon: '⚔️', color: '#ff5a5a', desc: 'High ATK damage dealers.' },
  Defender: { icon: '🛡️', color: '#4fc3f7', desc: 'Sturdy front-liners who draw enemy fire.' },
  Support: { icon: '✨', color: '#7ee081', desc: 'Healers, shielders and disruptors.' },
};

const ROLE_BASE: Record<Role, { hp: number; atk: number; def: number; spd: number; crit: number }> = {
  Attacker: { hp: 900, atk: 100, def: 40, spd: 100, crit: 0.12 },
  Defender: { hp: 1500, atk: 62, def: 80, spd: 88, crit: 0.05 },
  Support: { hp: 1050, atk: 80, def: 50, spd: 96, crit: 0.08 },
};

export const MAX_STARS = 7;

export function levelCap(stars: number): number {
  return 10 + stars * 10;
}

export function levelMult(level: number): number {
  return 1 + 0.09 * (level - 1);
}

export function starMult(stars: number): number {
  return 1 + 0.14 * (stars - 1);
}

export function emptyStats(): Stats {
  return { hp: 0, atk: 0, def: 0, spd: 0, crit: 0, critDmg: 0, heal: 0, energy: 0, lifesteal: 0 };
}

export function addMods(into: StatMods, m?: StatMods): StatMods {
  if (!m) return into;
  for (const k of Object.keys(m) as (keyof StatMods)[]) {
    into[k] = (into[k] ?? 0) + (m[k] ?? 0);
  }
  return into;
}

/** Raw stats from rarity, role, level and stars (no passives or bonuses). */
export function rawStats(def: HeroDef, level: number, stars: number): Stats {
  const rb = ROLE_BASE[def.role];
  const r = RARITY_INFO[def.rarity].mult;
  const lm = levelMult(level);
  const sm = starMult(stars);
  const b = def.base ?? {};
  return {
    hp: rb.hp * r * lm * sm * (1 + (b.hp ?? 0)),
    atk: rb.atk * r * lm * sm * (1 + (b.atk ?? 0)),
    def: rb.def * r * lm * sm * (1 + (b.def ?? 0)),
    spd: rb.spd * (1 + 0.01 * (stars - 1)) * (1 + (b.spd ?? 0)),
    crit: rb.crit + (b.crit ?? 0),
    critDmg: 1.6 + (b.critDmg ?? 0),
    heal: 0,
    energy: 0,
    lifesteal: 0,
  };
}

/** Apply percentage mods to raw stats. */
export function applyMods(raw: Stats, mods: StatMods): Stats {
  return {
    hp: raw.hp * Math.max(0.1, 1 + (mods.hp ?? 0)),
    atk: raw.atk * Math.max(0.1, 1 + (mods.atk ?? 0)),
    def: raw.def * Math.max(0, 1 + (mods.def ?? 0)),
    spd: raw.spd * Math.max(0.2, 1 + (mods.spd ?? 0)),
    crit: Math.min(1, raw.crit + (mods.crit ?? 0)),
    critDmg: raw.critDmg + (mods.critDmg ?? 0),
    heal: raw.heal + (mods.heal ?? 0),
    energy: raw.energy + (mods.energy ?? 0),
    lifesteal: raw.lifesteal + (mods.lifesteal ?? 0),
  };
}

/** Display stats for a hero (includes its own passive stat bonuses). */
export function heroStats(def: HeroDef, level: number, stars: number): Stats {
  return applyMods(rawStats(def, level, stars), def.passive.stats ?? {});
}

export function statPower(s: Stats): number {
  return Math.round(s.hp * 0.12 + s.atk * 1.6 + s.def * 1.3 + s.spd * 0.6 + s.crit * 200 + (s.critDmg - 1.6) * 100 + s.heal * 120);
}

export function heroPower(def: HeroDef, level: number, stars: number): number {
  return statPower(heroStats(def, level, stars));
}

// ───────── Economy ─────────

export function levelUpCost(level: number): { yul: number; essence: number } {
  return {
    yul: Math.round(20 * Math.pow(level, 1.5) + 30),
    essence: Math.round(12 * Math.pow(level, 1.5) + 20),
  };
}

export const SHARDS_PER_DUPE = 10;

export function starUpCost(def: HeroDef, stars: number): number {
  const start = RARITY_INFO[def.rarity].startStars;
  return SHARDS_PER_DUPE * (stars - start + 1);
}

/** Very compact number for tight spots like the currency bar (8.2K, 1.4M). */
export function fmtShort(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e8 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return Math.floor(n).toString();
}

export function fmt(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'K';
  return Math.floor(n).toLocaleString('en-US');
}
