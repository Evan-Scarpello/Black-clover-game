import { defaultArena, type ArenaSave } from '../features/arena/state';
import { defaultCampaign, type CampaignSave } from '../features/campaign/state';
import { defaultClan, type ClanSave } from '../features/clan/state';
import { defaultDispatch, type DispatchSave } from '../features/dispatch/state';
import { defaultProgression, type ProgressionSave } from '../features/progression/state';
import { defaultTower, type TowerSave } from '../features/tower/state';
import type { OwnedHero } from './types';

export interface Currencies {
  yul: number;
  essence: number;
  gems: number;
  tickets: number;
  /** Arena currency (Honor Medals). */
  medals: number;
  /** Clan currency (Clan Crests). */
  crests: number;
}

/** Anything a feature can hand out: currencies, hero grimoire pages, Grimoire Pass XP. */
export interface Reward extends Partial<Currencies> {
  /** Grimoire pages (shards) per hero id. Pages for an unowned hero collect in
   * `pendingShards`; at 10 pages the hero is unlocked (see grantReward in store). */
  shards?: Record<string, number>;
  passXp?: number;
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
  /** Last real progress change (drives cloud-save conflict resolution). */
  updatedAt: number;
  lastSeen: number;
  lastAfkClaim: number;
  currencies: Currencies;
  heroes: Record<string, OwnedHero>;
  /** Grimoire pages for heroes not yet owned (unlock at 10). */
  pendingShards: Record<string, number>;
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
  // Feature slices (each owned by src/features/<name>/state.ts)
  arena: ArenaSave;
  clan: ClanSave;
  tower: TowerSave;
  dispatch: DispatchSave;
  progression: ProgressionSave;
  campaign: CampaignSave;
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
    updatedAt: now,
    lastSeen: now,
    lastAfkClaim: now,
    currencies: { yul: 8000, essence: 5000, gems: 3000, tickets: 10, medals: 0, crests: 0 },
    heroes: Object.fromEntries(STARTER_HEROES.map((id) => [id, { id, level: 1, stars: startStars[id], shards: 0, obtainedAt: now }])),
    pendingShards: {},
    squad: { formation: 'balanced', slots: ['sol', 'asta', 'magna', 'finral', 'charmy'] },
    stage: 0,
    gacha: { pity: 0, mythicPity: 0, total: 0, firstTen: false },
    quests: { day: today(now), progress: {}, claimed: [] },
    fastRewards: { day: today(now), used: 0 },
    settings: { autoUlt: true, speed: 2, autoAdvance: false, sound: true },
    seenChapter: -1,
    tutorialDone: false,
    stats: { battles: 0, wins: 0, ults: 0, pulls: 0 },
    arena: defaultArena(),
    clan: defaultClan(),
    tower: defaultTower(),
    dispatch: defaultDispatch(),
    progression: defaultProgression(),
    campaign: defaultCampaign(),
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
    arena: { ...base.arena, ...raw.arena },
    clan: { ...base.clan, ...raw.clan },
    tower: { ...base.tower, ...raw.tower },
    dispatch: { ...base.dispatch, ...raw.dispatch },
    progression: { ...base.progression, ...raw.progression },
    campaign: { ...base.campaign, ...raw.campaign },
    heroes: raw.heroes && Object.keys(raw.heroes).length ? raw.heroes : base.heroes,
  };
}

let fresh = false;

/** True when this session started from a brand-new save (nothing on this device). */
export function startedFresh(): boolean {
  return fresh;
}

export function loadSave(): SaveState {
  try {
    const txt = localStorage.getItem(SAVE_KEY);
    if (txt) return migrate(JSON.parse(txt));
  } catch {
    /* corrupted or unavailable storage — start fresh */
  }
  fresh = true;
  return newSave();
}

export function writeSave(s: SaveState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* storage full / private mode — progress stays in memory */
  }
}
