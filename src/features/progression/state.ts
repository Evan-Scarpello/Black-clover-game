// Save slice for login calendar, Grimoire Pass, shop and achievements. Pure data only.
//
// Note: the save migration only shallow-merges this slice, so nested objects from old
// or cloud saves can miss fields added later. Always read/write through
// normalizeProgression()/ensureProgression() in ./logic.ts.

/** Structural copy of game/state Reward (this file must not import state.ts). */
export interface RewardData {
  yul?: number;
  essence?: number;
  gems?: number;
  tickets?: number;
  medals?: number;
  crests?: number;
  shards?: Record<string, number>;
  passXp?: number;
}

export interface PassSave {
  /** Season number this progress belongs to. */
  season: number;
  xp: number;
  premium: boolean;
  /** Tier numbers (1-based) already claimed on each track. */
  claimedFree: number[];
  claimedPremium: number[];
  /** Day string the daily XP caps below belong to. */
  capDay: string;
  /** Capped XP events counted today, per source (campaign, arena, afk, feature...). */
  capUsed: Record<string, number>;
  /** Shown on the pass page after a season rollover until dismissed. */
  notice: { from: number; reward: RewardData | null } | null;
}

export interface ProgressionSave {
  /** lastDay = day string of the last claim; claimed = total login days claimed. */
  login: { lastDay: string; claimed: number };
  pass: PassSave;
  /** stock = offer keys for `day`; bought = offer keys bought; giftDay = last free gift day. */
  shop: { day: string; stock: string[]; bought: string[]; refreshes: number; giftDay: string };
  /** Ids of claimed achievements. */
  achievements: string[];
}

export function defaultProgression(): ProgressionSave {
  return {
    login: { lastDay: '', claimed: 0 },
    pass: { season: 1, xp: 0, premium: false, claimedFree: [], claimedPremium: [], capDay: '', capUsed: {}, notice: null },
    shop: { day: '', stock: [], bought: [], refreshes: 0, giftDay: '' },
    achievements: [],
  };
}
