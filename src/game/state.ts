import type { OwnedHero } from './types';

export interface Currencies {
  yul: number;
  essence: number;
  gems: number;
  tickets: number;
}

export interface Settings {
  autoUlt: boolean;
  speed: 1 | 2 | 3;
  autoAdvance: boolean;
  sound: boolean;
}

export interface SaveState {
  version: 1;
  createdAt: number;
  lastSeen: number;
  lastAfkClaim: number;
  currencies: Currencies;
  heroes: Record<string, OwnedHero>;
  squad: { formation: string; slots: (string | null)[] };
  /** Number of campaign stages cleared (= index of the next stage). */
  stage: number;
  gacha: { pity: number; mythicPity: number; total: number; firstTen: boolean };
  quests: { day: string; progress: Record<string, number>; claimed: string[] };
  fastRewards: { day: string; used: number };
  settings: Settings;
  seenChapter: number;
  tutorialDone: boolean;
  stats: { battles: number; wins: number; ults: number; pulls: number };
}

export const SAVE_KEY = 'black-clover-grimoire-squads/save-v1';

export const STARTER_HEROES = ['asta', 'finral', 'magna', 'charmy', 'sol'];

export function today(now = Date.now()): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function newSave(now = Date.now()): SaveState {
  const startStars: Record<string, number> = { asta: 4, finral: 2, magna: 1, charmy: 1, sol: 1 };
  return {
    version: 1,
    createdAt: now,
    lastSeen: now,
    lastAfkClaim: now,
    currencies: { yul: 8000, essence: 5000, gems: 3000, tickets: 10 },
    heroes: Object.fromEntries(STARTER_HEROES.map((id) => [id, { id, level: 1, stars: startStars[id], shards: 0, obtainedAt: now }])),
    squad: { formation: 'balanced', slots: ['sol', 'asta', 'magna', 'finral', 'charmy'] },
    stage: 0,
    gacha: { pity: 0, mythicPity: 0, total: 0, firstTen: false },
    quests: { day: today(now), progress: {}, claimed: [] },
    fastRewards: { day: today(now), used: 0 },
    settings: { autoUlt: true, speed: 2, autoAdvance: false, sound: true },
    seenChapter: -1,
    tutorialDone: false,
    stats: { battles: 0, wins: 0, ults: 0, pulls: 0 },
  };
}

/** Fill any fields missing from older saves. */
export function migrate(raw: any): SaveState {
  const base = newSave(raw?.createdAt ?? Date.now());
  if (!raw || typeof raw !== 'object' || raw.version !== 1) return base;
  return {
    ...base,
    ...raw,
    currencies: { ...base.currencies, ...raw.currencies },
    squad: { ...base.squad, ...raw.squad },
    gacha: { ...base.gacha, ...raw.gacha },
    quests: { ...base.quests, ...raw.quests },
    fastRewards: { ...base.fastRewards, ...raw.fastRewards },
    settings: { ...base.settings, ...raw.settings },
    stats: { ...base.stats, ...raw.stats },
    heroes: raw.heroes && Object.keys(raw.heroes).length ? raw.heroes : base.heroes,
  };
}

export function loadSave(): SaveState {
  try {
    const txt = localStorage.getItem(SAVE_KEY);
    if (txt) return migrate(JSON.parse(txt));
  } catch {
    /* corrupted or unavailable storage — start fresh */
  }
  return newSave();
}

export function writeSave(s: SaveState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* storage full / private mode — progress stays in memory */
  }
}
