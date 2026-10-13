// Static clan data: emblems, NPC clans, research nodes, raid bosses, shop and chat flavour.
// Fan-made names only — this is an unofficial fan game.

import type { StatMods } from '../../game/types';

// ───────── emblems & colours ─────────

export const EMBLEMS = ['clover', 'bull', 'star', 'moon', 'flame', 'swords', 'crown', 'bolt', 'eye', 'diamond'] as const;
export type EmblemId = (typeof EMBLEMS)[number];

export const CLAN_COLORS = ['#e63946', '#ff9f1c', '#ffc531', '#3ddc84', '#2ec4b6', '#4fa3ff', '#b46bff', '#ff6fa8', '#5a6378'];

export const NAME_MIN = 3;
export const NAME_MAX = 20;
export const DESC_MAX = 80;
export const CHAT_MAX = 140;
export const CHAT_KEEP = 15;
export const CHAT_COOLDOWN_MS = 3000;
export const MAX_MEMBERS = 30;
export const MAX_LEVEL = 20;

// ───────── NPC clans ─────────

export interface NpcClanDef {
  id: string;
  name: string;
  emblem: EmblemId;
  color: string;
  desc: string;
  /** Starting clan level. */
  level: number;
  /** Members besides you. */
  members: number;
  /** Typical member power. */
  power: number;
  /** Share of members who show up each day (0-1). */
  activity: number;
  /** Clan-specific chat lines. */
  lines: string[];
}

export const NPC_CLANS: NpcClanDef[] = [
  {
    id: 'npc:midnight-grimoires',
    name: 'Midnight Grimoires',
    emblem: 'moon',
    color: '#b46bff',
    desc: 'Night owls who raid at dawn. Bring snacks.',
    level: 7,
    members: 16,
    power: 21000,
    activity: 0.85,
    lines: ['Raid at midnight, as tradition demands.', 'Who stole my grimoire bookmark again?', 'Nap first, raid second.'],
  },
  {
    id: 'npc:clover-vanguard',
    name: 'Clover Vanguard',
    emblem: 'clover',
    color: '#3ddc84',
    desc: 'Friendly and casual. Check in daily, never give up!',
    level: 4,
    members: 11,
    power: 12500,
    activity: 0.75,
    lines: ['Four leaves, one squad!', 'New folks: donate the small tier, it adds up.', 'Clover power, go!'],
  },
  {
    id: 'npc:crimson-cubs',
    name: 'Crimson Cubs',
    emblem: 'flame',
    color: '#e63946',
    desc: 'Burn bright! Weekly raid damage race, top 3 get bragging rights.',
    level: 9,
    members: 19,
    power: 28000,
    activity: 0.92,
    lines: ['Damage race update: I am winning. Obviously.', 'Fire beats devils. Science.', 'Turn up the heat, team!'],
  },
  {
    id: 'npc:anti-magic-club',
    name: 'Anti-Magic Club',
    emblem: 'swords',
    color: '#5a6378',
    desc: 'No magic? No problem. We hit things very hard.',
    level: 5,
    members: 13,
    power: 16000,
    activity: 0.8,
    lines: ['Swing first, ask questions later.', 'Did 200 push-ups before the raid.', 'Muscles are a kind of magic, right?'],
  },
  {
    id: 'npc:wizard-king-hopefuls',
    name: 'Wizard King Hopefuls',
    emblem: 'crown',
    color: '#ffc531',
    desc: 'We all want the hat. Daily donors only, please.',
    level: 11,
    members: 22,
    power: 36000,
    activity: 0.95,
    lines: ['One day that hat will be mine.', 'Donations are how kings are made.', 'Research maxed. Kneel. (Jk, hi!)'],
  },
  {
    id: 'npc:hamlet-heroes',
    name: 'Hamlet Heroes',
    emblem: 'star',
    color: '#ff9f1c',
    desc: 'Small-town mages with big dreams. Newbies welcome!',
    level: 2,
    members: 8,
    power: 8000,
    activity: 0.7,
    lines: ['Hi from the countryside!', 'Just started, any tips?', 'Our boss bar moved! Proud of us.'],
  },
];

export const NPC_CLAN_MAP: Record<string, NpcClanDef> = Object.fromEntries(NPC_CLANS.map((c) => [c.id, c]));

/** Fan-made player handles for NPC members and recruits. */
export const NPC_NAMES = [
  'GrimoireGremlin', 'Captain Crumbs', 'SleepyMage', 'ManaMuncher', 'Pebble the Brave', 'BullRider', 'Rosa Thorns',
  'Kid Clover', 'SpellSlinger', 'NightOwl', 'Yul Hoarder', 'FiveLeafFan', 'Hamlet Hero', 'AntiMagicAndy', 'ManaZoneMike',
  'Sir Shieldalot', 'Spade Ace', 'Golden Goose', 'Croissant Mage', 'Wind Wisp', 'Lava Lily', 'Thorny Tom', 'Ice Ivy',
  'Lightning Lou', 'Cloverleaf Cleo', 'Dungeon Dan', 'Potion Pat', 'Reaper Rex', 'RaidBossBait', 'Overtime Olly',
  'UltSpammer', 'AFK Andrea', 'StarUp Stan', 'PityPull Pete', 'Mythic Maya', 'Gacha Gwen', 'Rune Ruby', 'Moss Mage',
  'Ember Eli', 'Quartz Quinn', 'Bubbles', 'Mochi Mage', 'Stormy', 'Tea Time Theo',
];

/** Heroes NPC members use as their profile picture. */
export const AVATAR_HEROES = [
  'asta', 'yuno', 'noelle', 'yami', 'finral', 'luck', 'vanessa', 'magna', 'charmy', 'gordon', 'mimosa', 'klaus',
  'langris', 'charlotte', 'mereoleona', 'fuegoleon', 'nozel', 'william', 'henry', 'zenon', 'sol', 'leopold', 'gauche', 'julius',
];

export const CHAT_LINES = [
  'Morning, Magic Knights! Checked in ✅',
  'Raid boss is looking crispy today 🔥',
  'Pity saved me again. Thank you, pity.',
  "Remember to donate, research isn't free!",
  'Black Bulls Training level up. My ATK feels HUGE.',
  'New personal best on the boss 💪',
  'Overtime is where heroes are made.',
  'Two attempts a day keeps the devil away.',
  'Brb, AFK chest is full again.',
  'Defenders in front, Supports in back. Trust the formation.',
  'Clan level is climbing! Nice work everyone.',
  'Hero pages in the clan shop today 👀',
  'Saving crests for Iron Will. HP is life.',
  'GG on the boss kill, team!',
  'Finral warp plays are so underrated.',
  'Who is top of the damage board this week? Respect.',
  'Pushing the next campaign chapter tonight.',
  'Never give up. That is our magic!',
  'Formation tip: Spearhead + a tanky point is wild.',
  'Anyone else hoarding tickets for the next banner?',
];

export const CHAT_REPLIES = ['Welcome! 👋', 'Ha, same!', "Let's gooo!", 'True that.', '👍', 'Agreed, captain!', 'Say that again after the raid 😄', 'Clover power!', 'Love the energy.', 'Big if true.'];

// ───────── research ─────────

export interface ResearchNode {
  id: string;
  name: string;
  icon: string;
  /** Battle stat raised (none for Golden Bounty, which boosts AFK Yul). */
  stat: keyof StatMods | null;
  /** Bonus per level (0.03 = +3%). */
  per: number;
  max: number;
  /** Clan level that opens the node. */
  unlock: number;
  baseCost: number;
  desc: string;
}

export const RESEARCH: ResearchNode[] = [
  { id: 'bulls', name: 'Black Bulls Training', icon: '🐂', stat: 'atk', per: 0.03, max: 10, unlock: 1, baseCost: 60, desc: '+3% ATK per level' },
  { id: 'iron', name: 'Iron Will', icon: '❤️', stat: 'hp', per: 0.03, max: 10, unlock: 2, baseCost: 60, desc: '+3% HP per level' },
  { id: 'mana', name: 'Mana Skin', icon: '🛡️', stat: 'def', per: 0.03, max: 10, unlock: 3, baseCost: 60, desc: '+3% DEF per level' },
  { id: 'swift', name: 'Swift Casting', icon: '⚡', stat: 'energy', per: 0.02, max: 10, unlock: 4, baseCost: 80, desc: '+2% energy gain per level' },
  { id: 'golden', name: 'Golden Bounty', icon: '💰', stat: null, per: 0.05, max: 10, unlock: 5, baseCost: 70, desc: '+5% Yul from AFK chest claims per level' },
  { id: 'keen', name: 'Keen Eye', icon: '🎯', stat: 'crit', per: 0.01, max: 10, unlock: 7, baseCost: 90, desc: '+1% crit chance per level' },
];

export const RESEARCH_MAP: Record<string, ResearchNode> = Object.fromEntries(RESEARCH.map((n) => [n.id, n]));

// ───────── raid ─────────

export interface RaidBossDef {
  id: string;
  name: string;
  /** Short name for the battle header. */
  short: string;
  heroId: string;
  blurb: string;
  sky: [string, string];
  ground: string;
}

export const RAID_BOSSES: RaidBossDef[] = [
  { id: 'lucifero', short: 'Lucifero', name: 'Devil King Lucifero', heroId: 'lucifero', blurb: 'The highest devil crushes all with gravity magic.', sky: ['#4a0a16', '#12030a'], ground: '#2a0d12' },
  { id: 'megicula', short: 'Megicula', name: "Megicula's Curse", heroId: 'megicula', blurb: 'A curse-warping devil who feeds on despair.', sky: ['#33104a', '#0d0418'], ground: '#1d0f2e' },
  { id: 'mars', short: 'Mars', name: 'Mars the Crystal Warrior', heroId: 'mars', blurb: 'Diamond-hard crystal magic. Bring big hitters.', sky: ['#103a52', '#06121c'], ground: '#13303a' },
  { id: 'revchi', short: 'Revchi', name: "Revchi's Beast Stampede", heroId: 'revchi', blurb: 'Bound beasts in one hulking form. Hit fast.', sky: ['#3d3012', '#120d05'], ground: '#2e2615' },
];

export const RAID_ATTEMPTS_PER_DAY = 2;
export const RAID_TIME_LIMIT = 45;
/** Boss levels per week (kill chests are capped by this). */
export const RAID_MAX_LEVEL = 10;

// ───────── donations & check-in ─────────

export interface DonationTier {
  name: string;
  yul: number;
  crests: number;
  xp: number;
}

export const DONATIONS: DonationTier[] = [
  { name: 'Small Pouch', yul: 2000, crests: 10, xp: 20 },
  { name: 'Treasure Chest', yul: 10000, crests: 30, xp: 60 },
  { name: 'Royal Vault', yul: 50000, crests: 80, xp: 150 },
];

export const CHECKIN_XP = 50;
export const RAID_ATTEMPT_XP = 30;
