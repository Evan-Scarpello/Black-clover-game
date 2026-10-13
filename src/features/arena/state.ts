// Save slice for the PvP Arena. Pure data: types + defaults only (no imports of store/state).

/** One finished (or abandoned) arena fight in your own history. Only ids are stored for
 * real players — their names are resolved at render time. */
export interface ArenaHistoryEntry {
  at: number;
  /** Opponent id: a player's opaque uid, or `bot-<seed>` for an offline rival. */
  opponent: string;
  won: boolean;
  delta: number;
  /** Name of an offline rival (bots only — never a real player's name). */
  botName?: string;
  oppRating?: number;
  oppPower?: number;
  /** Opponent hero ids, for the portraits in the history list. */
  lineup?: string[];
  /** True while the fight is running, or when it was left before the end (counts as a loss). */
  forfeit?: boolean;
  medals?: number;
}

/** A fight that has started but not reported back. Its loss is already applied. */
export interface ArenaPending {
  key: string;
  at: number;
  before: number;
  winDelta: number;
  lossDelta: number;
}

/** Last season's results, waiting for the player to collect the tier reward. */
export interface ArenaSeasonResult {
  id: number;
  rating: number;
  best: number;
  wins: number;
  losses: number;
  gems: number;
  medals: number;
  /** Rating after the soft reset. */
  newRating: number;
}

export interface ArenaSave {
  rating: number;
  tickets: number;
  ticketDay: string;
  wins: number;
  losses: number;
  /** Defense lineup other players fight against (null = use current squad). */
  defense: { formation: string; slots: (string | null)[] } | null;
  seasonId: number;
  history: ArenaHistoryEntry[];
  /** Extra tickets bought with gems on `ticketDay`. */
  bought: number;
  /** Seed of the current opponent list (changes after each fight or refresh). */
  oppSeed: number;
  /** Last free opponent refresh. */
  refreshAt: number;
  pending: ArenaPending | null;
  seasonWins: number;
  seasonLosses: number;
  bestRating: number;
  seasonResult: ArenaSeasonResult | null;
  shopDay: string;
  shopBought: Record<string, number>;
  /** When the defense lineup was last locked in (0 = following the squad). */
  defenseAt: number;
  /** Hash of the last defense published online (avoids rewriting unchanged data). */
  pubSig: string;
  pubAt: number;
}

export function defaultArena(): ArenaSave {
  return {
    rating: 1000,
    tickets: 5,
    ticketDay: '',
    wins: 0,
    losses: 0,
    defense: null,
    seasonId: 0,
    history: [],
    bought: 0,
    oppSeed: 1,
    refreshAt: 0,
    pending: null,
    seasonWins: 0,
    seasonLosses: 0,
    bestRating: 1000,
    seasonResult: null,
    shopDay: '',
    shopBought: {},
    defenseAt: 0,
    pubSig: '',
    pubAt: 0,
  };
}
