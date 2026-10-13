// Builds one display model for any clan kind (NPC, offline "local", online). Pure.

import type { RaidBossDef } from './data';
import {
  avatarFor,
  bossForWeek,
  clanKind,
  clanXpFromContributions,
  daysBetween,
  levelFromXp,
  myWeekDamage,
  npcClan,
  npcClanXp,
  plausibleContribution,
  raidStatus,
  recruitCount,
  recruitXp,
  simChat,
  simLastActive,
  simMembers,
  simReplies,
  simWeekDamage,
  sortChat,
  weekKey,
  type ChatLine,
  type LevelInfo,
  type MemberDoc,
  type RaidStatus,
  type SimMember,
} from './logic';
import type { ClanChatMsg, ClanInfo, ClanSave } from './state';

export interface MemberRow {
  id: string;
  /** Online player id (resolve the display name at render time). */
  uid?: string;
  name: string;
  hero: string;
  isYou: boolean;
  leader: boolean;
  power: number;
  lastActive: number;
  contribution: number;
}

export interface RaidRow {
  id: string;
  name: string;
  hero: string;
  isYou: boolean;
  damage: number;
}

export interface OnlineData {
  status: 'loading' | 'ready' | 'off';
  uid: string | null;
  /** Clan doc (null when missing or unreadable). */
  info: ClanInfo | null;
  /** false once a successful read says the clan doc is gone. */
  exists: boolean | null;
  members: Record<string, MemberDoc>;
  raids: Record<string, number>;
  chats: Record<string, ClanChatMsg[]>;
  names: Record<string, string>;
}

export interface ClanView {
  id: string;
  kind: 'npc' | 'local' | 'online';
  info: ClanInfo;
  xp: number;
  lvl: LevelInfo;
  members: MemberRow[];
  raid: { boss: RaidBossDef; status: RaidStatus; rows: RaidRow[]; total: number; week: string; members: number };
  chat: ChatLine[];
  sims: SimMember[];
  amLeader: boolean;
  /** Online clans only: live data, still loading, or offline (showing your own progress). */
  net: 'live' | 'loading' | 'offline' | null;
  disbanded: boolean;
}

export const YOU = 'You';
export const MEMBER_FALLBACK = 'Clan member';

function fallbackInfo(name = 'Your Clan'): ClanInfo {
  return { name, emblem: 'clover', color: '#3ddc84', desc: '', createdAt: 0 };
}

export function buildView(c: ClanSave, me: { power: number; hero: string }, now: number, online?: OnlineData | null): ClanView | null {
  const id = c.clanId;
  const kind = clanKind(id);
  if (!id || !kind) return null;
  const week = weekKey(now);
  const boss = bossForWeek(now);
  const myDamage = myWeekDamage(c, id, week);
  const meRow = (leader: boolean, contribution = c.contribution): MemberRow => ({
    id: 'me',
    name: YOU,
    hero: me.hero,
    isYou: true,
    leader,
    power: me.power,
    lastActive: now,
    contribution,
  });
  const myChat = (c.chat ?? []).map((m) => ({ key: `me-${m.t}`, t: m.t, who: 'me', name: YOU, hero: me.hero, text: m.text, isYou: true }));

  if (kind === 'npc' || kind === 'local') {
    const def = npcClan(id);
    let info: ClanInfo;
    let sims: SimMember[];
    let xp: number;
    let activity: number;
    let lines: string[] = [];
    const daysIn = daysBetween(c.joinedAt, now);
    if (kind === 'npc' && def) {
      info = { name: def.name, emblem: def.emblem, color: def.color, desc: def.desc, createdAt: 0 };
      sims = simMembers(id, def.members, def.power, true);
      xp = npcClanXp(def, c.contribution, daysIn);
      activity = def.activity;
      lines = def.lines;
    } else {
      info = c.info ?? fallbackInfo();
      const days = daysBetween(info.createdAt || c.joinedAt, now);
      sims = simMembers(id, recruitCount(days), Math.max(3000, me.power * 0.8), false);
      xp = c.contribution + recruitXp(days);
      activity = 0.8;
    }
    const simDmg = simWeekDamage(id, sims, activity, now);
    const members: MemberRow[] = sims.map((m) => ({
      id: m.id,
      name: m.name,
      hero: m.hero,
      isYou: false,
      leader: m.leader,
      power: m.power,
      lastActive: simLastActive(id, m, activity, now),
      contribution: kind === 'npc' ? m.baseContribution + Math.round(35 * m.strength * activity) * daysIn : Math.round(25 * m.strength) * daysIn,
    }));
    members.push(meRow(kind === 'local'));
    const rows: RaidRow[] = sims.map((m) => ({ id: m.id, name: m.name, hero: m.hero, isYou: false, damage: simDmg[m.id] ?? 0 }));
    rows.push({ id: 'me', name: YOU, hero: me.hero, isYou: true, damage: myDamage });
    const total = rows.reduce((a, r) => a + r.damage, 0);
    const chat = sortChat([...simChat(id, sims, lines, now), ...myChat, ...simReplies(id, sims, c.chat ?? [], now)]);
    return {
      id,
      kind,
      info,
      xp,
      lvl: levelFromXp(xp),
      members: sortMembers(members),
      raid: { boss, status: raidStatus(total, members.length), rows: sortRows(rows), total, week, members: members.length },
      chat,
      sims,
      amLeader: kind === 'local',
      net: null,
      disbanded: false,
    };
  }

  // ───── online clan ─────
  const live = online?.status === 'ready';
  const uid = online?.uid ?? null;
  const amLeader = !!uid && uid === id;
  const info = (live ? online!.info : null) ?? c.info ?? fallbackInfo('Clan');
  const members: MemberRow[] = [];
  let myContribution = c.contribution;
  if (live) {
    for (const [mid, d] of Object.entries(online!.members)) {
      if (mid === uid) {
        myContribution = Math.max(myContribution, d.contribution);
        continue;
      }
      members.push({
        id: mid,
        uid: mid,
        name: online!.names[mid] || MEMBER_FALLBACK,
        hero: avatarFor(mid),
        isYou: false,
        leader: mid === id,
        power: d.power,
        lastActive: d.lastActive,
        contribution: plausibleContribution(d.contribution, d.joinedAt, now, online!.info?.createdAt),
      });
    }
  }
  members.push(meRow(amLeader, myContribution));
  const xp = clanXpFromContributions(members.map((m) => m.contribution));
  const rows: RaidRow[] = [];
  if (live) {
    for (const [mid, dmg] of Object.entries(online!.raids)) {
      if (mid === uid || !online!.members[mid]) continue;
      rows.push({ id: mid, name: online!.names[mid] || MEMBER_FALLBACK, hero: avatarFor(mid), isYou: false, damage: dmg });
    }
  }
  const myDoc = live && uid ? (online!.raids[uid] ?? 0) : 0;
  rows.push({ id: 'me', name: YOU, hero: me.hero, isYou: true, damage: Math.max(myDamage, myDoc) });
  const total = rows.reduce((a, r) => a + r.damage, 0);
  const others: ChatLine[] = [];
  if (live) {
    for (const [mid, msgs] of Object.entries(online!.chats)) {
      if (mid === uid || !online!.members[mid]) continue;
      msgs.forEach((m, i) =>
        others.push({ key: `${mid}-${m.t}-${i}`, t: m.t, who: mid, name: online!.names[mid] || MEMBER_FALLBACK, hero: avatarFor(mid), text: m.text, isYou: false }),
      );
    }
  }
  return {
    id,
    kind,
    info,
    xp,
    lvl: levelFromXp(xp),
    members: sortMembers(members),
    raid: { boss, status: raidStatus(total, members.length), rows: sortRows(rows), total, week, members: members.length },
    chat: sortChat([...others, ...myChat]),
    sims: [],
    amLeader,
    net: live ? 'live' : online?.status === 'loading' ? 'loading' : 'offline',
    disbanded: live && online!.exists === false && !amLeader,
  };
}

function sortMembers(ms: MemberRow[]): MemberRow[] {
  return [...ms].sort((a, b) => Number(b.leader) - Number(a.leader) || b.contribution - a.contribution || a.name.localeCompare(b.name));
}

function sortRows(rows: RaidRow[]): RaidRow[] {
  return [...rows].sort((a, b) => b.damage - a.damage || Number(b.isYou) - Number(a.isYou));
}
