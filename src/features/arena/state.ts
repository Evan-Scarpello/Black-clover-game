// Save slice for the PvP Arena. Pure data: types + defaults only (no imports of store/state).
export interface ArenaSave {
  rating: number;
  tickets: number;
  ticketDay: string;
  wins: number;
  losses: number;
  /** Defense lineup other players fight against (null = use current squad). */
  defense: { formation: string; slots: (string | null)[] } | null;
  seasonId: number;
  history: { at: number; opponent: string; won: boolean; delta: number }[];
}

export function defaultArena(): ArenaSave {
  return { rating: 1000, tickets: 5, ticketDay: '', wins: 0, losses: 0, defense: null, seasonId: 0, history: [] };
}
