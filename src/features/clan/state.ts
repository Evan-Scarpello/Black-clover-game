// Save slice for Clans. Pure data: types + defaults only.

/** Display info for a clan (NPC clans derive it from data; local/online clans keep a copy here). */
export interface ClanInfo {
  name: string;
  emblem: string;
  color: string;
  desc: string;
  createdAt: number;
}

export interface ClanChatMsg {
  t: number;
  text: string;
}

export interface ClanRaidSave {
  /** Week key (local date of that week's Monday) the numbers below belong to. */
  week: string;
  /** Clan the weekly damage was dealt in (switching clans starts from zero). */
  clanId: string | null;
  /** Your total raid damage this week. */
  damage: number;
  /** Personal best single attempt (all time). */
  best: number;
  /** Attempts made this week. */
  hits: number;
  /** Kill chests claimed this week. */
  claimed: number;
}

export interface ClanSave {
  /** Joined clan id: "npc:<slug>" for NPC clans, "local:<createdAt>" for a clan made
   * offline, otherwise an online clan's leader id. null = no clan. */
  clanId: string | null;
  checkinDay: string;
  /** Day the attempts below were counted on. */
  raidDay: string;
  /** Raid attempts used on raidDay. */
  raidAttempts: number;
  /** Clan XP you have contributed to your current clan (resets when you join a new one). */
  contribution: number;
  // ───── added by the clan feature ─────
  joinedAt: number;
  /** Day you last left a clan (one leave per day). */
  leftDay: string;
  /** Info of the current clan: source of truth for local clans, offline cache for online ones. */
  info: ClanInfo | null;
  donateDay: string;
  /** Donation tiers used on donateDay. */
  donated: number[];
  /** Personal research levels by node id (kept when you leave). */
  research: Record<string, number>;
  /** lastAfkClaim seen by the Golden Bounty bonus. */
  bountyMark: number;
  raid: ClanRaidSave;
  shopDay: string;
  /** Items bought on shopDay, by item id. */
  shopBought: Record<string, number>;
  /** Your recent chat messages in the current clan. */
  chat: ClanChatMsg[];
}

export function defaultClanRaid(): ClanRaidSave {
  return { week: '', clanId: null, damage: 0, best: 0, hits: 0, claimed: 0 };
}

export function defaultClan(): ClanSave {
  return {
    clanId: null,
    checkinDay: '',
    raidDay: '',
    raidAttempts: 0,
    contribution: 0,
    joinedAt: 0,
    leftDay: '',
    info: null,
    donateDay: '',
    donated: [],
    research: {},
    bountyMark: 0,
    raid: defaultClanRaid(),
    shopDay: '',
    shopBought: {},
    chat: [],
  };
}
