import type { Faction, FormationDef, StatMods } from '../game/types';

export const FORMATIONS: FormationDef[] = [
  {
    id: 'balanced',
    name: 'Balanced Squad',
    desc: '2 front · 3 back. A solid all-rounder: everyone gets +5% HP and ATK.',
    rows: ['front', 'front', 'back', 'back', 'back'],
    front: { hp: 0.05, atk: 0.05 },
    back: { hp: 0.05, atk: 0.05 },
    unlockStage: 0,
  },
  {
    id: 'vanguard',
    name: 'Vanguard',
    desc: '3 front · 2 back. Front row +15% DEF, back row +10% ATK.',
    rows: ['front', 'front', 'front', 'back', 'back'],
    front: { def: 0.15 },
    back: { atk: 0.1 },
    unlockStage: 5,
  },
  {
    id: 'spearhead',
    name: 'Spearhead',
    desc: '1 front · 4 back. The lone point gets +40% HP and +20% DEF; back row +12% ATK.',
    rows: ['front', 'back', 'back', 'back', 'back'],
    front: { hp: 0.4, def: 0.2 },
    back: { atk: 0.12 },
    unlockStage: 15,
  },
  {
    id: 'fortress',
    name: 'Iron Fortress',
    desc: '4 front · 1 back. Front row +20% DEF; the protected back-liner gets +30% ATK and healing.',
    rows: ['front', 'front', 'front', 'front', 'back'],
    front: { def: 0.2 },
    back: { atk: 0.3, heal: 0.3 },
    unlockStage: 25,
  },
  {
    id: 'blitz',
    name: 'Clover Blitz',
    desc: 'All 5 in front. +20% ATK and +15% SPD, but -15% DEF. All in!',
    rows: ['front', 'front', 'front', 'front', 'front'],
    front: { atk: 0.2, spd: 0.15, def: -0.15 },
    back: {},
    unlockStage: 40,
  },
];

export const FORMATION_MAP = Object.fromEntries(FORMATIONS.map((f) => [f.id, f]));

export interface SynergyTier {
  count: number;
  mods: StatMods;
  text: string;
}

export interface FactionInfo {
  id: Faction;
  synergy: string;
  color: string;
  emblem: string;
  tiers: SynergyTier[];
}

export const FACTIONS: FactionInfo[] = [
  {
    id: 'Black Bulls',
    synergy: 'Surpass Your Limits',
    color: '#ff4b3e',
    emblem: '🐂',
    tiers: [
      { count: 2, mods: { atk: 0.08 }, text: '+8% ATK' },
      { count: 3, mods: { atk: 0.12, energy: 0.1 }, text: '+12% ATK, +10% energy gain' },
      { count: 5, mods: { atk: 0.2, energy: 0.2 }, text: '+20% ATK, +20% energy gain' },
    ],
  },
  {
    id: 'Golden Dawn',
    synergy: 'Elite Order',
    color: '#ffd54a',
    emblem: '🌅',
    tiers: [
      { count: 2, mods: { hp: 0.08 }, text: '+8% HP' },
      { count: 3, mods: { hp: 0.12, def: 0.08 }, text: '+12% HP, +8% DEF' },
      { count: 5, mods: { hp: 0.2, def: 0.15 }, text: '+20% HP, +15% DEF' },
    ],
  },
  {
    id: 'Magic Knights',
    synergy: "Captains' Conference",
    color: '#4fc3f7',
    emblem: '🛡️',
    tiers: [
      { count: 2, mods: { def: 0.08 }, text: '+8% DEF' },
      { count: 3, mods: { def: 0.1, atk: 0.08 }, text: '+10% DEF, +8% ATK' },
      { count: 5, mods: { def: 0.15, atk: 0.15 }, text: '+15% DEF, +15% ATK' },
    ],
  },
  {
    id: 'Midnight Sun',
    synergy: 'Reincarnation',
    color: '#fff3b0',
    emblem: '👁️',
    tiers: [
      { count: 2, mods: { spd: 0.08 }, text: '+8% SPD' },
      { count: 3, mods: { spd: 0.12, crit: 0.1 }, text: '+12% SPD, +10% crit' },
      { count: 5, mods: { spd: 0.2, crit: 0.15 }, text: '+20% SPD, +15% crit' },
    ],
  },
  {
    id: 'Spade Kingdom',
    synergy: 'Dark Triad',
    color: '#b388ff',
    emblem: '♠️',
    tiers: [
      { count: 2, mods: { critDmg: 0.1 }, text: '+10% crit damage' },
      { count: 3, mods: { atk: 0.1, critDmg: 0.2 }, text: '+10% ATK, +20% crit damage' },
      { count: 5, mods: { atk: 0.2, critDmg: 0.3 }, text: '+20% ATK, +30% crit damage' },
    ],
  },
];

export const FACTION_MAP = Object.fromEntries(FACTIONS.map((f) => [f.id, f])) as Record<string, FactionInfo>;

export interface BondDef {
  id: string;
  name: string;
  heroes: string[];
  min: number;
  mods: StatMods;
  text: string;
}

/** Bonds boost only the members who are fielded together. */
export const BONDS: BondDef[] = [
  { id: 'rivals', name: 'Rivals for Wizard King', heroes: ['asta', 'yuno'], min: 2, mods: { atk: 0.15, crit: 0.1 }, text: '+15% ATK, +10% crit' },
  { id: 'silva', name: 'House Silva', heroes: ['noelle', 'nozel'], min: 2, mods: { def: 0.15, hp: 0.1 }, text: '+15% DEF, +10% HP' },
  { id: 'vermillion', name: 'House Vermillion', heroes: ['mereoleona', 'fuegoleon', 'leopold', 'mimosa'], min: 2, mods: { atk: 0.12, heal: 0.1 }, text: '+12% ATK, +10% healing' },
  { id: 'zogratis', name: 'Zogratis Siblings', heroes: ['lucius', 'dante', 'vanica', 'zenon'], min: 2, mods: { atk: 0.12, hp: 0.12 }, text: '+12% ATK, +12% HP' },
  { id: 'vaude', name: 'Vaude Brothers', heroes: ['finral', 'langris'], min: 2, mods: { spd: 0.15, energy: 0.15 }, text: '+15% SPD, +15% energy gain' },
  { id: 'brawlers', name: 'Black Bull Brawlers', heroes: ['luck', 'magna'], min: 2, mods: { atk: 0.1, spd: 0.1 }, text: '+10% ATK, +10% SPD' },
  { id: 'briar', name: "Briar Heart", heroes: ['yami', 'charlotte'], min: 2, mods: { atk: 0.1, def: 0.1 }, text: '+10% ATK, +10% DEF' },
  { id: 'thirdeye', name: 'Third Eye', heroes: ['vetto', 'fana', 'valtos', 'licht'], min: 2, mods: { atk: 0.1, def: 0.1 }, text: '+10% ATK, +10% DEF' },
  { id: 'devilunion', name: 'Devil Union', heroes: ['asta', 'liebe'], min: 2, mods: { atk: 0.12, energy: 0.1 }, text: '+12% ATK, +10% energy gain' },
  { id: 'vicecaptain', name: 'Captain & Vice-Captain', heroes: ['yami', 'nacht'], min: 2, mods: { atk: 0.1, crit: 0.1 }, text: '+10% ATK, +10% crit' },
  { id: 'nero', name: 'Nero', heroes: ['secre', 'asta'], min: 2, mods: { spd: 0.1, hp: 0.1 }, text: '+10% SPD, +10% HP' },
  { id: 'wizardkings', name: 'Wizard Kings', heroes: ['julius', 'lumiere'], min: 2, mods: { hp: 0.1, def: 0.1 }, text: '+10% HP, +10% DEF' },
  { id: 'swornfriends', name: 'Sworn Friends', heroes: ['lumiere', 'licht'], min: 2, mods: { atk: 0.1, hp: 0.1 }, text: '+10% ATK, +10% HP' },
  { id: 'elvenkin', name: 'Elven Kin', heroes: ['licht', 'patri'], min: 2, mods: { spd: 0.1, atk: 0.08 }, text: '+10% SPD, +8% ATK' },
  { id: 'devillords', name: 'Devil Lords', heroes: ['lucifero', 'zagred', 'megicula'], min: 2, mods: { atk: 0.12, critDmg: 0.15 }, text: '+12% ATK, +15% crit damage' },
  {
    id: 'captains',
    name: "Captains' Council",
    heroes: ['jack', 'dorothy', 'rill', 'charlotte', 'fuegoleon', 'nozel', 'william', 'yami'],
    min: 3,
    mods: { atk: 0.08, def: 0.08 },
    text: 'Any 3 captains: +8% ATK, +8% DEF',
  },
];
