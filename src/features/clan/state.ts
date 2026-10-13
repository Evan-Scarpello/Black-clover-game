// Save slice for Clans. Pure data: types + defaults only.
export interface ClanSave {
  /** Joined clan id (an NPC clan id like "npc:..." or an online clan's owner id), or null. */
  clanId: string | null;
  checkinDay: string;
  raidDay: string;
  raidAttempts: number;
  contribution: number;
}

export function defaultClan(): ClanSave {
  return { clanId: null, checkinDay: '', raidDay: '', raidAttempts: 0, contribution: 0 };
}
