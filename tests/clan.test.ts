import { describe, expect, it } from 'vitest';
import { Battle } from '../src/game/battle';
import { newSave, today } from '../src/game/state';
import { HERO_MAP, SUMMONABLE } from '../src/data/heroes';
import { CHAT_KEEP, CHAT_MAX, DONATIONS, NPC_CLANS, RAID_BOSSES, RAID_MAX_LEVEL, RESEARCH } from '../src/features/clan/data';
import {
  appendChat,
  attemptsLeft,
  bossForWeek,
  canLeave,
  canSendChat,
  checkinAvailable,
  chestsClaimable,
  clanXpFromContributions,
  cleanText,
  dayKey,
  dayNumber,
  donatedToday,
  levelFromXp,
  nameError,
  normalizeClan,
  npcClanXp,
  parseChatDoc,
  parseClanDoc,
  parseMemberDoc,
  parseRaidDoc,
  raidDamage,
  raidEnemy,
  raidPool,
  raidStatus,
  recruitCount,
  researchCap,
  researchCost,
  researchMods,
  shopItems,
  shopLeft,
  simChat,
  simMembers,
  simWeekDamage,
  validId,
  weekKey,
  weekStart,
  xpForLevel,
  xpNeed,
} from '../src/features/clan/logic';
import { defaultClan } from '../src/features/clan/state';
import { buildView } from '../src/features/clan/view';

const T = new Date(2026, 9, 14, 15, 30).getTime(); // Wed 14 Oct 2026, 15:30 local

describe('clan dates', () => {
  it('week starts on Monday and matches today() format', () => {
    expect(dayKey(dayNumber(T))).toBe(today(T));
    expect(weekKey(T)).toBe(today(new Date(2026, 9, 12).getTime()));
    expect(weekKey(new Date(2026, 9, 18, 23, 59).getTime())).toBe(weekKey(T)); // Sunday night
    expect(weekKey(new Date(2026, 9, 19, 0, 1).getTime())).not.toBe(weekKey(T)); // next Monday
  });

  it('rotates the raid boss every week', () => {
    const seen = new Set<string>();
    for (let w = 0; w < RAID_BOSSES.length; w++) seen.add(bossForWeek(T + w * 7 * 86400000).id);
    expect(seen.size).toBe(RAID_BOSSES.length);
    for (const b of RAID_BOSSES) expect(HERO_MAP[b.heroId]).toBeTruthy();
  });
});

describe('clan level', () => {
  it('derives level from XP thresholds', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, into: 0, need: xpNeed(1), max: false });
    expect(levelFromXp(xpForLevel(2) - 1).level).toBe(1);
    expect(levelFromXp(xpForLevel(2)).level).toBe(2);
    expect(levelFromXp(xpForLevel(7) + 10)).toMatchObject({ level: 7, into: 10 });
    expect(levelFromXp(1e12).max).toBe(true);
    expect(levelFromXp(NaN).level).toBe(1);
    expect(levelFromXp(-50).level).toBe(1);
  });

  it('sums member contributions (clamped) into clan XP', () => {
    expect(clanXpFromContributions([100, 200, 300])).toBe(600);
    expect(clanXpFromContributions([-500, 100])).toBe(100);
    expect(clanXpFromContributions([1e15])).toBe(5_000_000);
    const lv = levelFromXp(clanXpFromContributions([xpForLevel(3), xpForLevel(3)])).level;
    expect(lv).toBeGreaterThan(3);
  });

  it('NPC clans start at their level and grow while you are in', () => {
    for (const d of NPC_CLANS) {
      expect(levelFromXp(npcClanXp(d, 0, 0)).level).toBe(d.level);
      expect(npcClanXp(d, 100, 3)).toBeGreaterThan(npcClanXp(d, 0, 0) + 100);
    }
  });
});

describe('research', () => {
  it('totals bonuses per stat', () => {
    expect(researchMods({})).toEqual({});
    const m = researchMods({ bulls: 4, iron: 2, swift: 3, golden: 5, keen: 1 });
    expect(m.atk).toBeCloseTo(0.12);
    expect(m.hp).toBeCloseTo(0.06);
    expect(m.energy).toBeCloseTo(0.06);
    expect(m.crit).toBeCloseTo(0.01);
    expect(m.def).toBeUndefined();
    expect(Object.keys(m)).not.toContain('golden');
  });

  it('ignores junk and clamps to max level', () => {
    expect(researchMods({ bulls: 99 }).atk).toBeCloseTo(0.3);
    expect(researchMods({ bulls: NaN as any, iron: -3, nope: 5 } as any)).toEqual({});
    expect(researchMods(undefined)).toEqual({});
  });

  it('gates by clan level and costs rise', () => {
    const bulls = RESEARCH.find((n) => n.id === 'bulls')!;
    const keen = RESEARCH.find((n) => n.id === 'keen')!;
    expect(researchCap(bulls, 1)).toBe(3);
    expect(researchCap(bulls, 20)).toBe(bulls.max);
    expect(researchCap(keen, keen.unlock - 1)).toBe(0);
    for (let l = 0; l < 9; l++) expect(researchCost(bulls, l + 1)).toBeGreaterThan(researchCost(bulls, l));
  });
});

describe('raid', () => {
  it('rolls the boss over when cumulative damage beats each pool', () => {
    const members = 12;
    const p1 = raidPool(1, members);
    const p2 = raidPool(2, members);
    expect(p2).toBeGreaterThan(p1);
    expect(raidStatus(0, members)).toEqual({ bossLevel: 1, hp: p1, maxHp: p1, kills: 0, cleared: false });
    expect(raidStatus(p1 - 1, members)).toMatchObject({ bossLevel: 1, hp: 1, kills: 0 });
    expect(raidStatus(p1, members)).toMatchObject({ bossLevel: 2, hp: p2, kills: 1 });
    expect(raidStatus(p1 + 500, members)).toMatchObject({ bossLevel: 2, hp: p2 - 500, kills: 1 });
    expect(raidStatus(1e15, members)).toMatchObject({ bossLevel: RAID_MAX_LEVEL, hp: 0, kills: RAID_MAX_LEVEL, cleared: true });
    expect(raidStatus(-5, members).hp).toBe(p1);
  });

  it('pool scales with members (min 4, max 30)', () => {
    expect(raidPool(1, 1)).toBe(raidPool(1, 4));
    expect(raidPool(1, 99)).toBe(raidPool(1, 30));
    expect(raidPool(1, 10)).toBeGreaterThan(raidPool(1, 5));
  });

  it('kill chests need a hit this week and are claimed once', () => {
    const c = defaultClan();
    c.clanId = 'npc:clover-vanguard';
    const wk = weekKey(T);
    expect(chestsClaimable(c, c.clanId, wk, 2)).toBe(0); // no hits
    c.raid = { week: wk, clanId: c.clanId, damage: 1000, best: 1000, hits: 1, claimed: 0 };
    expect(chestsClaimable(c, c.clanId, wk, 2)).toBe(2);
    c.raid.claimed = 2;
    expect(chestsClaimable(c, c.clanId, wk, 2)).toBe(0);
    expect(chestsClaimable(c, 'npc:other', wk, 2)).toBe(0);
    expect(chestsClaimable(c, c.clanId, 'old-week', 2)).toBe(0);
  });

  it('builds a boss whose in-battle HP is the remaining raid HP', () => {
    for (const hp of [50_000, 1_234_567, 9_000_000]) {
      const team = raidEnemy(RAID_BOSSES[0], 2, 5, hp);
      const b = new Battle({ members: [], formation: team.formation }, team, 3);
      const boss = b.units.find((u) => u.side === 1)!;
      expect(boss.boss).toBe(true);
      expect(Math.abs(boss.maxHp - hp) / hp).toBeLessThan(0.001);
    }
  });

  it('counts only the player side damage', () => {
    expect(raidDamage([{ side: 0, dmgDealt: 100.4 }, { side: 0, dmgDealt: 50 }, { side: 1, dmgDealt: 9999 }])).toBe(150);
    expect(raidDamage([])).toBe(0);
  });
});

describe('NPC simulation', () => {
  const def = NPC_CLANS[0];
  const members = simMembers(def.id, def.members, def.power, true);

  it('is deterministic for (clan, date)', () => {
    expect(simMembers(def.id, def.members, def.power, true)).toEqual(members);
    expect(simWeekDamage(def.id, members, def.activity, T)).toEqual(simWeekDamage(def.id, members, def.activity, T));
    expect(simChat(def.id, members, def.lines, T)).toEqual(simChat(def.id, members, def.lines, T));
    expect(members.filter((m) => m.leader)).toHaveLength(1);
    expect(new Set(members.map((m) => m.name)).size).toBe(members.length);
  });

  it('only grows through the week and resets on Monday', () => {
    const sum = (now: number) => Object.values(simWeekDamage(def.id, members, def.activity, now)).reduce((a, b) => a + b, 0);
    const mon = new Date(2026, 9, 12, 0, 5).getTime();
    const tue = new Date(2026, 9, 13, 23, 0).getTime();
    const sun = new Date(2026, 9, 18, 23, 59).getTime();
    expect(sum(mon)).toBe(0); // nobody raids before 7am
    expect(sum(tue)).toBeGreaterThan(0);
    expect(sum(T)).toBeGreaterThanOrEqual(sum(tue));
    expect(sum(sun)).toBeGreaterThan(sum(T));
    expect(sum(new Date(2026, 9, 19, 1, 0).getTime())).toBe(0);
  });

  it('chat only shows lines whose time has passed', () => {
    const lines = simChat(def.id, members, def.lines, T);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => l.t <= T)).toBe(true);
  });

  it('offline clans gain a recruit a day (capped)', () => {
    expect(recruitCount(0)).toBe(2);
    expect(recruitCount(3)).toBe(5);
    expect(recruitCount(100)).toBe(11);
  });
});

describe('daily limits', () => {
  it('check-in, raid attempts, donations and leave reset by day', () => {
    const c = defaultClan();
    const d1 = today(T);
    const d2 = today(T + 86400000);
    expect(checkinAvailable(c, d1)).toBe(false); // not in a clan
    c.clanId = 'npc:hamlet-heroes';
    expect(checkinAvailable(c, d1)).toBe(true);
    c.checkinDay = d1;
    expect(checkinAvailable(c, d1)).toBe(false);
    expect(checkinAvailable(c, d2)).toBe(true);

    expect(attemptsLeft(c, d1)).toBe(2);
    c.raidDay = d1;
    c.raidAttempts = 2;
    expect(attemptsLeft(c, d1)).toBe(0);
    expect(attemptsLeft(c, d2)).toBe(2);

    c.donateDay = d1;
    c.donated = [0, 2];
    expect(donatedToday(c, d1)).toEqual([0, 2]);
    expect(donatedToday(c, d2)).toEqual([]);
    expect(DONATIONS).toHaveLength(3);

    expect(canLeave(c, d1)).toBe(true);
    c.leftDay = d1;
    expect(canLeave(c, d1)).toBe(false);
    expect(canLeave(c, d2)).toBe(true);
  });

  it('normalizes slices from older saves', () => {
    const old: any = { clanId: 'npc:x', checkinDay: '', raidDay: '', raidAttempts: 0, contribution: 5 };
    const c = normalizeClan(old);
    expect(c.raid.damage).toBe(0);
    expect(c.research).toEqual({});
    expect(c.chat).toEqual([]);
    expect(c.contribution).toBe(5);
    const s = newSave(T);
    expect(normalizeClan(s.clan)).toEqual(defaultClan());
  });
});

describe('shop', () => {
  it('rotates daily, deterministically, with one offer per rarity', () => {
    const a = shopItems('2026-10-14');
    expect(shopItems('2026-10-14')).toEqual(a);
    const days = ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'];
    const ids = new Set(days.flatMap((d) => shopItems(d).filter((i) => i.heroId).map((i) => i.heroId)));
    expect(ids.size).toBeGreaterThan(4);
    const pages = a.filter((i) => i.heroId);
    expect(pages).toHaveLength(4);
    for (const p of pages) expect(SUMMONABLE.some((h) => h.id === p.heroId)).toBe(true);
    const ur = pages.find((p) => p.tag === 'Mythic')!;
    const r = pages.find((p) => p.tag === 'Rare')!;
    expect(ur.cost).toBeGreaterThan(r.cost);
  });

  it('enforces daily limits', () => {
    const c = defaultClan();
    const day = '2026-10-14';
    const item = shopItems(day).find((i) => i.id === 'essence')!;
    expect(shopLeft(c, day, item)).toBe(item.limit);
    c.shopDay = day;
    c.shopBought = { essence: item.limit };
    expect(shopLeft(c, day, item)).toBe(0);
    expect(shopLeft(c, '2026-10-15', item)).toBe(item.limit);
  });
});

describe('chat', () => {
  it('cleans, clamps and rejects empty messages', () => {
    expect(cleanText('  hi\n\nthere\t ', CHAT_MAX)).toBe('hi there');
    expect(cleanText('a‮b\u0000c', CHAT_MAX)).toBe('a b c');
    expect(cleanText(42 as any, CHAT_MAX)).toBe('');
    expect(Array.from(cleanText('😀'.repeat(300), CHAT_MAX))).toHaveLength(CHAT_MAX);
    expect(appendChat([], '   ', 1)).toBeNull();
    let msgs = appendChat([], 'x'.repeat(500), 1)!;
    expect(msgs[0].text.length).toBe(CHAT_MAX);
    for (let i = 0; i < 40; i++) msgs = appendChat(msgs, `m${i}`, i + 2)!;
    expect(msgs).toHaveLength(CHAT_KEEP);
    expect(msgs[msgs.length - 1].text).toBe('m39');
  });

  it('rate limits to one message every 3 seconds', () => {
    expect(canSendChat(0, T)).toBe(true);
    expect(canSendChat(1000, 3999)).toBe(false);
    expect(canSendChat(1000, 4000)).toBe(true);
  });

  it('validates clan names', () => {
    expect(nameError('ab')).toBeTruthy();
    expect(nameError('  ab  ')).toBeTruthy();
    expect(nameError('Black Bullies')).toBeNull();
    expect(nameError('x'.repeat(21))).toBeTruthy();
  });
});

describe('online docs (untrusted)', () => {
  it('rejects malformed clan docs and clamps fields', () => {
    expect(parseClanDoc(null)).toBeNull();
    expect(parseClanDoc([])).toBeNull();
    expect(parseClanDoc({ v: 2, name: 'Fine Name' })).toBeNull();
    expect(parseClanDoc({ v: 1, name: 'x' })).toBeNull();
    expect(parseClanDoc({ v: 1, name: { evil: true } })).toBeNull();
    const c = parseClanDoc({ v: 1, name: 'A'.repeat(99), emblem: '<script>', color: 'url(javascript:1)', desc: 'd'.repeat(500), createdAt: 'soon' })!;
    expect(c.name).toHaveLength(20);
    expect(c.emblem).toBe('clover');
    expect(c.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(c.desc).toHaveLength(80);
    expect(c.createdAt).toBe(0);
  });

  it('rejects malformed member docs and clamps numbers', () => {
    expect(parseMemberDoc({ v: 1, clanId: 'abc' }, 'other')).toBeNull();
    expect(parseMemberDoc({ v: 1, clanId: '../../x' })).toBeNull();
    expect(parseMemberDoc({ v: 1, clanId: 42 })).toBeNull();
    expect(parseMemberDoc('nope')).toBeNull();
    const m = parseMemberDoc({ v: 1, clanId: 'abc', power: 1e30, contribution: -4, lastActive: Infinity, joinedAt: NaN }, 'abc')!;
    expect(m.power).toBe(100_000_000);
    expect(m.contribution).toBe(0);
    expect(m.lastActive).toBe(0);
    expect(m.joinedAt).toBe(0);
  });

  it('only counts raid docs for this clan and week', () => {
    expect(parseRaidDoc({ v: 1, clanId: 'a', week: 'w', damage: 500 }, 'a', 'w')).toBe(500);
    expect(parseRaidDoc({ v: 1, clanId: 'a', week: 'old', damage: 500 }, 'a', 'w')).toBeNull();
    expect(parseRaidDoc({ v: 1, clanId: 'b', week: 'w', damage: 500 }, 'a', 'w')).toBeNull();
    expect(parseRaidDoc({ v: 1, clanId: 'a', week: 'w', damage: 1e20 }, 'a', 'w')).toBe(1_000_000_000);
    expect(parseRaidDoc({ v: 1, clanId: 'a', week: 'w', damage: '9' }, 'a', 'w')).toBe(0);
  });

  it('cleans chat docs', () => {
    expect(parseChatDoc({ v: 1, clanId: 'a', msgs: 'hi' }, 'a')).toEqual([]);
    expect(parseChatDoc({ v: 1, clanId: 'b', msgs: [{ t: 1, text: 'x' }] }, 'a')).toEqual([]);
    const msgs = parseChatDoc(
      { v: 1, clanId: 'a', msgs: [null, { t: 'x', text: 'bad' }, { t: 5, text: 7 }, { t: 6, text: '  ok \u0007 ' }, { t: 7, text: 'y'.repeat(999) }, ...Array(30).fill({ t: 9, text: 'z' })] },
      'a',
    );
    expect(msgs.length).toBeLessThanOrEqual(CHAT_KEEP);
    expect(msgs.every((m) => m.text.length <= CHAT_MAX && m.text.length > 0)).toBe(true);
    const all = parseChatDoc({ v: 1, clanId: 'a', msgs: [{ t: 6, text: '  ok \u0007 ' }, { t: 7, text: 'y'.repeat(999) }] }, 'a');
    expect(all).toEqual([
      { t: 6, text: 'ok' },
      { t: 7, text: 'y'.repeat(CHAT_MAX) },
    ]);
  });

  it('caps claimed contributions at what was possible since joining', async () => {
    const { plausibleContribution, MAX_DAILY_XP, ONLINE_EPOCH } = await import('../src/features/clan/logic');
    const now = Date.UTC(2026, 5, 10, 12);
    const day = 86400000;
    expect(MAX_DAILY_XP).toBe(50 + 20 + 60 + 150 + 2 * 30);
    expect(plausibleContribution(300, now - 3 * day, now)).toBe(300); // honest
    expect(plausibleContribution(1e12, now - 3 * day, now)).toBe(5 * MAX_DAILY_XP); // 3 days + slack
    expect(plausibleContribution(1e12, now + 50 * day, now)).toBe(2 * MAX_DAILY_XP); // future joinedAt
    // A spoofed ancient joinedAt is floored to the clan's creation (or the online epoch).
    expect(plausibleContribution(1e12, 0, now, now - day)).toBe(3 * MAX_DAILY_XP);
    expect(plausibleContribution(1e12, 0, now)).toBe((Math.floor((now - ONLINE_EPOCH) / day) + 2) * MAX_DAILY_XP);
    expect(plausibleContribution(NaN, now, now)).toBe(0);
    expect(plausibleContribution(-5, now, now)).toBe(0);
  });

  it('accepts only plain ids', () => {
    expect(validId('user_123-abc')).toBe(true);
    expect(validId('a/b')).toBe(false);
    expect(validId('..')).toBe(false);
    expect(validId('')).toBe(false);
    expect(validId('x'.repeat(200))).toBe(false);
  });
});

describe('clan view', () => {
  it('builds NPC, offline and online views without crashing', () => {
    const c = defaultClan();
    expect(buildView(c, { power: 1000, hero: 'asta' }, T)).toBeNull();
    c.clanId = NPC_CLANS[2].id;
    c.joinedAt = T - 3 * 86400000;
    const v = buildView(c, { power: 12000, hero: 'asta' }, T)!;
    expect(v.members).toHaveLength(NPC_CLANS[2].members + 1);
    expect(v.members[0].leader).toBe(true);
    expect(v.raid.total).toBe(v.raid.rows.reduce((a, r) => a + r.damage, 0));

    c.clanId = `local:${T - 86400000}`;
    c.info = { name: 'Solo Squad', emblem: 'bolt', color: '#4fa3ff', desc: '', createdAt: T - 86400000 };
    const lv = buildView(c, { power: 5000, hero: 'asta' }, T)!;
    expect(lv.amLeader).toBe(true);
    expect(lv.members.length).toBe(1 + recruitCount(1));

    c.clanId = 'leaderUid';
    const off = buildView(c, { power: 5000, hero: 'asta' }, T, null)!;
    expect(off.net).toBe('offline');
    expect(off.members).toHaveLength(1);
    const live = buildView(c, { power: 5000, hero: 'asta' }, T, {
      status: 'ready',
      uid: 'me1',
      info: { name: 'Live Clan', emblem: 'star', color: '#ffc531', desc: 'hey', createdAt: 1 },
      exists: true,
      members: {
        leaderUid: { clanId: 'leaderUid', joinedAt: 1, power: 9000, contribution: 800, lastActive: T },
        me1: { clanId: 'leaderUid', joinedAt: 1, power: 5000, contribution: 50, lastActive: T },
      },
      raids: { leaderUid: 20000, ghost: 99999 },
      chats: { leaderUid: [{ t: T - 1000, text: 'welcome' }] },
      names: { leaderUid: 'Captain' },
    })!;
    expect(live.net).toBe('live');
    expect(live.members).toHaveLength(2);
    expect(live.members[0]).toMatchObject({ name: 'Captain', leader: true });
    expect(live.xp).toBe(850);
    expect(live.raid.total).toBe(20000); // non-member "ghost" damage is ignored
    expect(live.chat[0].text).toBe('welcome');
  });

  it('flags a disbanded online clan', () => {
    const c = defaultClan();
    c.clanId = 'gone';
    const v = buildView(c, { power: 1, hero: 'asta' }, T, { status: 'ready', uid: 'me', info: null, exists: false, members: {}, raids: {}, chats: {}, names: {} })!;
    expect(v.disbanded).toBe(true);
  });
});

describe('weekStart', () => {
  it('is a Monday', () => {
    const d = new Date(weekStart(T) * 86400000);
    expect(d.getUTCDay()).toBe(1);
  });
});

describe('clan actions (through the store)', () => {
  it('check-in and donations are once per day; raid records damage and attempts', async () => {
    const store = await import('../src/game/store');
    const actions = await import('../src/features/clan/actions');
    const s = store.getState();
    s.stage = 30;
    s.currencies.yul = 100000;
    s.currencies.crests = 0;
    const ok = await actions.joinClan(NPC_CLANS[1].id, null);
    expect(ok).toBe(true);
    expect(s.clan.clanId).toBe(NPC_CLANS[1].id);

    const r = actions.checkIn(4)!;
    expect(r.crests).toBeGreaterThan(0);
    expect(actions.checkIn(4)).toBeNull();
    const crests = s.currencies.crests;
    const yul = s.currencies.yul;
    expect(actions.donate(0)).toBe(true);
    expect(actions.donate(0)).toBe(false);
    expect(s.currencies.yul).toBe(yul - DONATIONS[0].yul);
    expect(s.currencies.crests).toBe(crests + DONATIONS[0].crests);
    s.currencies.yul = 0;
    expect(actions.donate(2)).toBe(false);

    // Research bonus reaches player teams through registerTeamBonus.
    s.currencies.crests = 10000;
    expect(actions.upgradeResearch('bulls', 4)).toBe(true);
    expect(store.playerTeam().bonus?.atk).toBeCloseTo(0.03);
    expect(actions.upgradeResearch('keen', 4)).toBe(false); // locked below clan Lv 7

    // Raid: an attempt is spent up front, damage recorded once.
    const ctx = { clanId: s.clan.clanId!, clanLevel: 4, boss: RAID_BOSSES[0], bossLevel: 1, hp: 1000, maxHp: 1000 };
    const spec = actions.startRaid(ctx)!;
    expect(spec.kind).toBe('raid');
    expect(spec.timeLimit).toBe(45);
    expect(attemptsLeft(s.clan, today())).toBe(1);
    const fake: any = { units: [{ side: 0, dmgDealt: 1500 }, { side: 1, dmgDealt: 99 }], winner: 1 };
    const out = spec.finish(fake);
    expect(out.title).toBe('RAID OVER');
    expect(out.stat?.label).toBe('Damage dealt');
    expect(out.notes?.[0]).toMatch(/DEFEATED/);
    expect(spec.finish(fake)).toBe(out); // idempotent
    expect(s.clan.raid.damage).toBe(1500);
    expect(s.clan.raid.hits).toBe(1);

    actions.startRaid(ctx);
    expect(actions.startRaid(ctx)).toBeNull(); // out of attempts

    // Leaving: once per day.
    expect(actions.leaveClan()).toBe(true);
    expect(s.clan.clanId).toBeNull();
    expect(s.clan.contribution).toBe(0);
    expect(s.clan.research.bulls).toBe(1); // research is kept
    await actions.joinClan(NPC_CLANS[0].id, null);
    expect(actions.leaveClan()).toBe(false);
  });

  it('keeps opened kill chests counted when switching clans mid-week', async () => {
    const store = await import('../src/game/store');
    const actions = await import('../src/features/clan/actions');
    const s = store.getState();
    const wk = weekKey(Date.now());
    const ctx = { clanId: s.clan.clanId!, clanLevel: 3, boss: RAID_BOSSES[0], bossLevel: 1, hp: 1e9, maxHp: 1e9 };
    s.clan.raid = { week: wk, clanId: 'npc:somewhere-else', damage: 5000, best: 5000, hits: 2, claimed: 3 };
    actions.recordRaid(ctx, 100, false, wk);
    expect(s.clan.raid).toMatchObject({ clanId: ctx.clanId, damage: 100, hits: 1, claimed: 3, best: 5000 });
    expect(chestsClaimable(s.clan, ctx.clanId, wk, 2)).toBe(0); // the new clan has fewer kills
    expect(chestsClaimable(s.clan, ctx.clanId, wk, 5)).toBe(2); // only the extra levels
    actions.recordRaid(ctx, 100, false, 'some-later-week');
    expect(s.clan.raid).toMatchObject({ week: 'some-later-week', damage: 100, hits: 1, claimed: 0 });
  });
});

describe('clan hub badge', () => {
  it('shows only when unlocked, in a clan, and a check-in or raid attempt is left', async () => {
    const { clanScreen } = await import('../src/features/clan/screen');
    const s = newSave();
    s.stage = 30;
    expect(clanScreen.id).toBe('clan');
    expect(clanScreen.unlockStage).toBe(15);
    expect(clanScreen.badge!(s)).toBe(false); // no clan
    s.clan = { ...defaultClan(), clanId: NPC_CLANS[0].id };
    expect(clanScreen.badge!(s)).toBe(true);
    s.clan.checkinDay = today();
    expect(clanScreen.badge!(s)).toBe(true); // raid attempts left
    s.clan.raidDay = today();
    s.clan.raidAttempts = 2;
    expect(clanScreen.badge!(s)).toBe(false);
    s.clan.checkinDay = 'yesterday';
    s.stage = 10;
    expect(clanScreen.badge!(s)).toBe(false); // locked
    const old: any = newSave();
    old.stage = 30;
    old.clan = { clanId: NPC_CLANS[0].id, checkinDay: '', raidDay: '', raidAttempts: 0, contribution: 0 }; // pre-expansion slice
    expect(clanScreen.badge!(old)).toBe(true);
  });
});
