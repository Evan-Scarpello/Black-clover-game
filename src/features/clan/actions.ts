// Clan actions: every user action mutates the save, emits game events and commits once.
// Importing this module registers the research team bonus and the Golden Bounty AFK bonus.

import { AFK_CAP_HOURS, afkRates } from '../../data/campaign';
import { getHero } from '../../data/heroes';
import type { Battle } from '../../game/battle';
import { today, type Reward, type SaveState } from '../../game/state';
import { canAfford, commit, emitGameEvent, getState, grantReward, onGameEvent, pay, playerTeam, registerTeamBonus, squadPower } from '../../game/store';
import { fmt } from '../../game/stats';
import { toast } from '../../ui/components/common';
import type { BattleOutcome, BattleSpec } from '../../ui/nav';
import { CHECKIN_XP, DONATIONS, RAID_ATTEMPT_XP, RAID_MAX_LEVEL, RAID_TIME_LIMIT, RESEARCH_MAP, type RaidBossDef } from './data';
import {
  addRewards,
  appendChat,
  attemptsLeft,
  bountyRate,
  canLeave,
  checkinAvailable,
  checkinReward,
  chestsClaimable,
  clanKind,
  killChest,
  normalizeClan,
  raidAttemptReward,
  raidDamage,
  raidEnemy,
  researchCap,
  researchCost,
  researchLevel,
  researchMods,
  shopLeft,
  weekKey,
  type ShopItem,
} from './logic';
import { createOnlineClan, joinOnlineClan, leaveOnlineClan, syncChat, syncMember, syncRaid } from './online';
import { defaultClanRaid, type ClanInfo, type ClanSave } from './state';

export function clan(s: SaveState = getState()): ClanSave {
  if (!s.clan) (s as any).clan = {};
  return normalizeClan(s.clan);
}

// ───────── module-load registrations ─────────

registerTeamBonus((s) => researchMods(s.clan?.research));

/** Golden Bounty: extra Yul whenever the AFK chest is claimed (based on the hours it filled). */
onGameEvent((e) => {
  if (e.type !== 'afkClaim') return;
  const s = getState();
  const c = clan(s);
  const prev = c.bountyMark;
  c.bountyMark = s.lastAfkClaim;
  const rate = bountyRate(c.research);
  if (!rate || !prev || prev >= s.lastAfkClaim) return;
  const hours = Math.min(AFK_CAP_HOURS, (s.lastAfkClaim - prev) / 3600000);
  const bonus = Math.floor(afkRates(s.stage).yul * hours * rate);
  if (bonus > 0) {
    grantReward({ yul: bonus });
    toast(`💰 Golden Bounty: +${fmt(bonus)} Yul`);
  }
});

// ───────── online mirror (fire and forget) ─────────

function mirrorMember(c: ClanSave) {
  if (clanKind(c.clanId) !== 'online' || !c.clanId) return;
  void syncMember(c.clanId, safePower(), c.contribution, c.joinedAt || Date.now());
}

export function safePower(): number {
  try {
    return squadPower();
  } catch {
    return 0;
  }
}

/** Refresh our member doc (power / last active) at most every 10 minutes. */
let lastPresence = 0;
export function touchPresence(now = Date.now()) {
  const c = clan();
  if (clanKind(c.clanId) !== 'online' || now - lastPresence < 600000) return;
  lastPresence = now;
  mirrorMember(c);
  if (c.chat.length && c.clanId) void syncChat(c.clanId, c.chat);
  if (c.raid.clanId === c.clanId && c.raid.week === weekKey(now) && c.raid.damage > 0 && c.clanId) void syncRaid(c.clanId, c.raid.week, c.raid.damage);
}

// ───────── join / create / leave ─────────

function enter(c: ClanSave, id: string, info: ClanInfo | null, now: number) {
  c.clanId = id;
  c.info = info;
  c.joinedAt = now;
  c.contribution = 0;
  c.chat = [];
}

/** Join an NPC clan (instant) or an online clan (checks the db first). */
export async function joinClan(id: string, info: ClanInfo | null): Promise<boolean> {
  const c = clan();
  if (c.clanId) return false;
  const now = Date.now();
  if (clanKind(id) === 'online') {
    const res = await joinOnlineClan(id, { power: safePower(), now });
    if (!res.ok) {
      toast(
        res.reason === 'full'
          ? 'That clan is full.'
          : res.reason === 'missing'
            ? 'That clan no longer exists.'
            : "Couldn't reach the clan hall. Try again or pick another clan.",
      );
      return false;
    }
    if (clan().clanId) return false; // joined something else meanwhile (double tap)
    enter(clan(), id, res.info, now);
  } else {
    enter(c, id, info, now);
  }
  emitGameEvent({ type: 'feature', name: 'clanJoin' });
  commit();
  return true;
}

/** Create a clan: online when the clan hall is reachable, otherwise an offline clan with recruits. */
export async function createClan(info: ClanInfo): Promise<'online' | 'local' | false> {
  if (clan().clanId) return false;
  const now = info.createdAt || Date.now();
  const res = await createOnlineClan(info, { power: safePower(), contribution: 0, now });
  const c = clan();
  if (c.clanId) return false;
  if (res.ok) enter(c, res.id, info, now);
  else enter(c, `local:${now}`, info, now);
  emitGameEvent({ type: 'feature', name: 'clanCreate' });
  emitGameEvent({ type: 'feature', name: 'clanJoin' });
  commit();
  return res.ok ? 'online' : 'local';
}

export function leaveClan(force = false): boolean {
  const s = getState();
  const c = clan(s);
  const day = today();
  if (!c.clanId || (!force && !canLeave(c, day))) return false;
  const old = c.clanId;
  if (clanKind(old) === 'online') void leaveOnlineClan(old);
  c.clanId = null;
  c.info = null;
  c.contribution = 0;
  c.joinedAt = 0;
  c.chat = [];
  if (!force) c.leftDay = day;
  commit();
  return true;
}

// ───────── daily: check-in & donations ─────────

export function checkIn(clanLevel: number): Reward | null {
  const c = clan();
  const day = today();
  if (!checkinAvailable(c, day)) return null;
  const r = checkinReward(clanLevel);
  c.checkinDay = day;
  c.contribution += CHECKIN_XP;
  grantReward(r);
  emitGameEvent({ type: 'feature', name: 'clanCheckIn' });
  commit();
  mirrorMember(c);
  return r;
}

export function donate(tier: number): boolean {
  const c = clan();
  const t = DONATIONS[tier];
  const day = today();
  if (!c.clanId || !t) return false;
  if (c.donateDay !== day) {
    c.donateDay = day;
    c.donated = [];
  }
  if (c.donated.includes(tier) || !canAfford({ yul: t.yul })) return false;
  pay({ yul: t.yul });
  c.donated = [...c.donated, tier];
  c.contribution += t.xp;
  grantReward({ crests: t.crests });
  emitGameEvent({ type: 'feature', name: 'clanDonate', amount: t.yul });
  commit();
  mirrorMember(c);
  return true;
}

// ───────── research ─────────

export function upgradeResearch(id: string, clanLevel: number): boolean {
  const s = getState();
  const c = clan(s);
  const node = RESEARCH_MAP[id];
  if (!node || !c.clanId) return false;
  const lvl = researchLevel(c.research, id);
  if (lvl >= researchCap(node, clanLevel)) return false;
  const cost = researchCost(node, lvl);
  if (!canAfford({ crests: cost })) return false;
  pay({ crests: cost });
  c.research = { ...c.research, [id]: lvl + 1 };
  if (id === 'golden' && lvl === 0) c.bountyMark = s.lastAfkClaim;
  emitGameEvent({ type: 'feature', name: 'clanResearch', amount: lvl + 1 });
  commit();
  return true;
}

// ───────── shop ─────────

export function buyShopItem(item: ShopItem): boolean {
  const c = clan();
  const day = today();
  if (!c.clanId || shopLeft(c, day, item) <= 0 || !canAfford({ crests: item.cost })) return false;
  if (item.heroId) {
    try {
      getHero(item.heroId);
    } catch {
      return false;
    }
  }
  if (c.shopDay !== day) {
    c.shopDay = day;
    c.shopBought = {};
  }
  pay({ crests: item.cost });
  c.shopBought = { ...c.shopBought, [item.id]: (c.shopBought[item.id] ?? 0) + 1 };
  grantReward(item.reward);
  emitGameEvent({ type: 'feature', name: 'clanShop', amount: item.cost });
  commit();
  return true;
}

// ───────── chat ─────────

export function sendChat(text: string, now = Date.now()): boolean {
  const c = clan();
  if (!c.clanId) return false;
  const next = appendChat(c.chat, text, now);
  if (!next) return false;
  c.chat = next;
  commit();
  if (clanKind(c.clanId) === 'online') void syncChat(c.clanId, c.chat);
  return true;
}

// ───────── raid ─────────

export interface RaidContext {
  clanId: string;
  clanLevel: number;
  boss: RaidBossDef;
  bossLevel: number;
  /** Boss HP left when the fight starts. */
  hp: number;
  maxHp: number;
}

/** Spend an attempt now (so quitting mid-fight can't reroll) and build the fight. */
export function startRaid(ctx: RaidContext): BattleSpec | null {
  const s = getState();
  const c = clan(s);
  const day = today();
  if (c.clanId !== ctx.clanId || attemptsLeft(c, day) <= 0 || ctx.hp <= 0) return null;
  const ally = playerTeam(s);
  if (!ally.members.length) {
    toast('Put some heroes in your squad first!');
    return null;
  }
  if (c.raidDay !== day) {
    c.raidDay = day;
    c.raidAttempts = 0;
  }
  c.raidAttempts++;
  commit();
  const week = weekKey(Date.now());
  let done: BattleOutcome | null = null;
  return {
    key: `raid-${ctx.clanId}-${week}-${day}-${c.raidAttempts}`,
    kind: 'raid',
    label: `Raid Lv ${ctx.bossLevel}`,
    title: ctx.boss.short,
    theme: { sky: ctx.boss.sky, ground: ctx.boss.ground },
    ally,
    enemy: raidEnemy(ctx.boss, ctx.bossLevel, ctx.clanLevel, ctx.hp),
    timeLimit: RAID_TIME_LIMIT,
    banner: 'CLAN RAID!',
    finish: (b: Battle) => {
      if (done) return done;
      done = recordRaid(ctx, raidDamage(b.units), b.winner === 0, week);
      return done;
    },
  };
}

export function recordRaid(ctx: RaidContext, damage: number, killedInFight: boolean, week: string): BattleOutcome {
  const c = clan();
  if (c.clanId !== ctx.clanId) return { won: false, title: 'RAID OVER', notes: ['You left the clan'], canRetry: false };
  if (c.raid.week !== week) c.raid = { ...defaultClanRaid(), best: c.raid.best };
  // Switching clans mid-week starts your damage over, but kill chests already opened this
  // week stay counted, so clan-hopping can't farm the same boss levels twice.
  else if (c.raid.clanId !== ctx.clanId) c.raid = { ...defaultClanRaid(), best: c.raid.best, claimed: c.raid.claimed };
  c.raid.week = week;
  c.raid.clanId = ctx.clanId;
  c.raid.damage += damage;
  c.raid.hits++;
  const pb = damage > c.raid.best;
  if (pb) c.raid.best = damage;
  c.contribution += RAID_ATTEMPT_XP;
  const defeated = killedInFight || damage >= ctx.hp;
  const reward = raidAttemptReward(damage, ctx.clanLevel);
  grantReward(reward);
  emitGameEvent({ type: 'battle', kind: 'raid', won: defeated });
  commit();
  if (clanKind(ctx.clanId) === 'online') {
    void syncRaid(ctx.clanId, week, c.raid.damage);
    mirrorMember(c);
  }
  const pct = ctx.maxHp > 0 ? Math.min(100, (damage / ctx.maxHp) * 100) : 0;
  const notes = [defeated ? 'BOSS DEFEATED! Kill chest ready' : `${pct < 1 ? pct.toFixed(1) : Math.round(pct)}% of the boss's HP`];
  if (pb) notes.push('New personal best!');
  return { won: true, title: 'RAID OVER', reward, stat: { label: 'Damage dealt', value: fmt(damage) }, notes, canRetry: false };
}

/** Claim every kill chest earned this week. */
export function claimKillChests(clanId: string, kills: number, clanLevel: number): Reward | null {
  const c = clan();
  const week = weekKey(Date.now());
  const n = chestsClaimable(c, clanId, week, kills);
  if (n <= 0) return null;
  let r: Reward = {};
  for (let lvl = c.raid.claimed + 1; lvl <= Math.min(RAID_MAX_LEVEL, c.raid.claimed + n); lvl++) r = addRewards(r, killChest(lvl, clanLevel));
  c.raid.claimed += n;
  grantReward(r);
  emitGameEvent({ type: 'feature', name: 'clanChest', amount: n });
  commit();
  return r;
}
