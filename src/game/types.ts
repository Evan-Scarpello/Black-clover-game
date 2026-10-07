// Core type definitions shared by data, engine and UI.

export type Rarity = 'R' | 'SR' | 'SSR' | 'UR';
export type Role = 'Attacker' | 'Defender' | 'Support';
export type Range = 'melee' | 'ranged';
export type Row = 'front' | 'back';
export type Faction = 'Black Bulls' | 'Golden Dawn' | 'Magic Knights' | 'Midnight Sun' | 'Spade Kingdom' | 'Wild';

/** Percentage modifiers (0.15 = +15%). */
export interface StatMods {
  hp?: number;
  atk?: number;
  def?: number;
  spd?: number;
  crit?: number; // flat crit chance added (0.1 = +10%)
  critDmg?: number; // flat crit damage multiplier added
  heal?: number; // healing & shielding power
  energy?: number; // energy gain
  lifesteal?: number; // flat lifesteal fraction
}

export type TargetSel =
  | 'enemyAuto' // standard basic-attack targeting (front row first)
  | 'enemyFront'
  | 'enemyBack'
  | 'enemyAll'
  | 'enemyLowest' // lowest HP %
  | 'enemyHighestAtk'
  | 'enemyBackLowest'
  | 'enemyRandom'
  | 'self'
  | 'allyAll'
  | 'allyFront'
  | 'allyBack'
  | 'allyLowest'
  | 'allyFaction' // living allies of the caster's faction
  | 'same'; // the targets of the previous effect

export type StatusId =
  | 'stun'
  | 'silence'
  | 'burn'
  | 'poison'
  | 'bleed'
  | 'regen'
  | 'atkUp'
  | 'atkDown'
  | 'defUp'
  | 'defDown'
  | 'spdUp'
  | 'spdDown'
  | 'taunt'
  | 'mark'
  | 'reflect'
  | 'fate';

export type Effect =
  | { kind: 'damage'; target: TargetSel; mult: number; hits?: number; ignoreDef?: number; bonusCrit?: number; lifesteal?: number }
  | { kind: 'heal'; target: TargetSel; mult?: number; pctMax?: number }
  | { kind: 'shield'; target: TargetSel; mult?: number; pctCasterHp?: number; duration?: number }
  | { kind: 'status'; target: TargetSel; status: StatusId; duration: number; value?: number; chance?: number }
  | { kind: 'move'; target: TargetSel; to: Row }
  | { kind: 'dispel'; target: TargetSel }
  | { kind: 'cleanse'; target: TargetSel }
  | { kind: 'energy'; target: TargetSel; amount: number }
  | { kind: 'revive'; pct: number; fallback?: Effect[] }
  /**
   * Formation-changing: rearranges a whole side.
   *  rescue   – own side: swap most-injured front ally with healthiest back ally
   *  fortify  – own side: Defenders / highest HP to the front, injured & Supports to the back
   *  disrupt  – enemy side: push their sturdiest front unit back, pull their weakest back unit forward
   */
  | { kind: 'reform'; mode: 'rescue' | 'fortify' | 'disrupt' };

export type TriggerOn = 'battleStart' | 'basic' | 'ultimate' | 'lowHp' | 'kill' | 'allyDeath' | 'allyLowHp' | 'every';

export interface Trigger {
  on: TriggerOn;
  chance?: number;
  interval?: number; // for 'every' (seconds)
  threshold?: number; // for lowHp / allyLowHp (default 0.3)
  once?: boolean;
  effects: Effect[];
}

export interface Ability {
  name: string;
  desc: string;
}

export interface Ultimate extends Ability {
  effects: Effect[];
  /** Short shout shown in the comic cut-in. */
  shout: string;
}

export interface Passive extends Ability {
  stats?: StatMods;
  triggers?: Trigger[];
  /** Anti-magic: damage strips shields. */
  antiMagic?: boolean;
  /** Fraction of target DEF ignored by all of this hero's damage. */
  ignoreDef?: number;
  /** Basic attack applies these effects to its target. */
  onHit?: Effect[];
}

/** Row-dependent bonus — the core of formation strategy. */
export interface FormationTrait extends Ability {
  front?: StatMods;
  back?: StatMods;
}

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  rarity: Rarity;
  role: Role;
  range: Range;
  faction: Faction;
  magic: string;
  color: string; // signature VFX / aura color
  quote: string;
  base?: StatMods; // per-hero base stat tweaks
  basic: { name: string; mult?: number; hits?: number };
  ultimate: Ultimate;
  passive: Passive;
  formation: FormationTrait;
  summonable: boolean;
  boss?: boolean;
}

export interface Stats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
  crit: number;
  critDmg: number;
  heal: number;
  energy: number;
  lifesteal: number;
}

export interface FormationDef {
  id: string;
  name: string;
  desc: string;
  /** Row of each of the 5 slots. */
  rows: [Row, Row, Row, Row, Row];
  front: StatMods;
  back: StatMods;
  unlockStage: number; // global stage index that must be cleared
}

export interface OwnedHero {
  id: string;
  level: number;
  stars: number;
  shards: number;
  obtainedAt: number;
}
