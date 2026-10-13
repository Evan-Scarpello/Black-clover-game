// Save slice for Magic Knight Missions (timed dispatch). Pure data: types + defaults only.
import type { Faction, Range, Rarity, Role } from '../../game/types';

export type MissionRank = 'C' | 'B' | 'A' | 'S';

/** One condition a dispatched squad must meet (any one hero can satisfy it). */
export type MissionReq =
  | { kind: 'faction'; faction: Faction }
  | { kind: 'role'; role: Role }
  | { kind: 'range'; range: Range }
  | { kind: 'stars'; min: number }
  | { kind: 'rarity'; min: Rarity };

/** Structurally a `Reward` (see src/game/state.ts). */
export interface MissionReward {
  yul?: number;
  essence?: number;
  gems?: number;
  tickets?: number;
  shards?: Record<string, number>;
}

export interface MissionDef {
  /** `${day}#${index}` — unique across days. */
  id: string;
  title: string;
  icon: string;
  rank: MissionRank;
  hours: number;
  /** Exact number of heroes to send. */
  size: number;
  reqs: MissionReq[];
  reward: MissionReward;
}

export interface DispatchMission {
  id: string;
  /** Hero ids sent; empty = not started. */
  heroes: string[];
  startedAt: number;
  claimed: boolean;
}

export interface DispatchSave {
  day: string;
  missions: DispatchMission[];
  /** Definitions for every entry in `missions` (today's board plus unfinished missions from earlier days). */
  board: MissionDef[];
  /** Lifetime missions completed. */
  completed: number;
}

export function defaultDispatch(): DispatchSave {
  return { day: '', missions: [], board: [], completed: 0 };
}
