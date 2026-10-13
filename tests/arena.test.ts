import { describe, expect, it } from 'vitest';
import { FORMATION_MAP } from '../src/data/formations';
import { SUMMONABLE } from '../src/data/heroes';
import { teamPower } from '../src/game/power';
import { levelCap } from '../src/game/stats';
import {
  FREE_TICKETS,
  MIN_DELTA,
  SEASON_EPOCH,
  TICKET_COSTS,
  TIERS,
  WEEK_MS,
  applyDelta,
  botName,
  currentRating,
  defenseDocBody,
  eloDelta,
  expectedScore,
  fightMedals,
  leaderboardBots,
  makeBot,
  parseDefenseDoc,
  pickOpponents,
  ratingDeltas,
  refreshTickets,
  rollSeason,
  sanitizeArena,
  seasonEnd,
  seasonId,
  seasonReward,
  seasonStart,
  shopItems,
  shopLeft,
  softReset,
  ticketCost,
  ticketsToday,
  tierIndex,
  tierOf,
  tierProgress,
  type OnlineDefense,
} from '../src/features/arena/logic';
import { defaultArena } from '../src/features/arena/state';

const ids = (n: number) => SUMMONABLE.slice(0, n).map((h) => h.id);

function validDoc(over: Record<string, unknown> = {}) {
  return {
    v: 1,
    defense: {
      formation: 'balanced',
      members: ids(5).map((heroId, slot) => ({ heroId, level: 20, stars: 5, slot })),
    },
    power: 999999,
    rating: 1100,
    wins: 12,
    season: 41,
    updatedAt: 1_700_000_000_000,
    ...over,
  };
}

describe('elo', () => {
  it('even match: ±16 with K=32', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5);
    expect(eloDelta(1000, 1000, true)).toBe(16);
    expect(eloDelta(1000, 1000, false)).toBe(-16);
  });

  it('upsets pay more than expected wins', () => {
    expect(eloDelta(1000, 1200, true)).toBeGreaterThan(eloDelta(1000, 1000, true));
    expect(eloDelta(1200, 1000, true)).toBeLessThan(16);
    expect(eloDelta(1200, 1000, false)).toBeLessThan(-16);
  });

  it('every result moves the rating by at least MIN_DELTA', () => {
    expect(eloDelta(2000, 1000, true)).toBe(MIN_DELTA);
    expect(eloDelta(1000, 2000, false)).toBe(-MIN_DELTA);
    for (let me = 0; me <= 3000; me += 137)
      for (let opp = 0; opp <= 3000; opp += 211) {
        expect(eloDelta(me, opp, true)).toBeGreaterThanOrEqual(MIN_DELTA);
        expect(eloDelta(me, opp, false)).toBeLessThanOrEqual(-MIN_DELTA);
        expect(Math.abs(eloDelta(me, opp, true))).toBeLessThanOrEqual(32);
      }
  });

  it('losses are softened in Bronze/Silver and the rating never goes below 0', () => {
    expect(ratingDeltas(1000, 1000).loss).toBe(-8); // Bronze: half
    expect(ratingDeltas(1150, 1150).loss).toBe(-12); // Silver: three quarters
    expect(ratingDeltas(1500, 1500).loss).toBe(-16);
    expect(ratingDeltas(1000, 1000).win).toBe(16);
    expect(ratingDeltas(3, 3).loss).toBe(-3);
    expect(applyDelta(3, -20)).toBe(0);
    expect(applyDelta(4995, 30)).toBe(5000);
  });
});

describe('tiers', () => {
  it('maps ratings to tiers at the thresholds', () => {
    expect(tierOf(0).name).toBe('Bronze');
    expect(tierOf(1000).name).toBe('Bronze');
    expect(tierOf(1099).name).toBe('Bronze');
    expect(tierOf(1100).name).toBe('Silver');
    expect(tierOf(1200).name).toBe('Gold');
    expect(tierOf(1300).name).toBe('Platinum');
    expect(tierOf(1450).name).toBe('Diamond');
    expect(tierOf(1600).name).toBe('Magic Knight Captain');
    expect(tierOf(1800).name).toBe('Wizard King');
    expect(tierOf(4000).name).toBe('Wizard King');
  });

  it('tiers ascend and progress stays within 0..1', () => {
    for (let i = 1; i < TIERS.length; i++) expect(TIERS[i].min).toBeGreaterThan(TIERS[i - 1].min);
    for (let r = 0; r < 2500; r += 25) {
      const p = tierProgress(r);
      expect(p.frac).toBeGreaterThanOrEqual(0);
      expect(p.frac).toBeLessThanOrEqual(1);
      if (p.next) expect(p.toNext).toBe(p.next.min - r);
    }
    expect(tierProgress(1150).frac).toBeCloseTo(0.5);
    expect(tierProgress(1900).next).toBeNull();
  });
});

describe('tickets', () => {
  it('a new day refills the free tickets and resets purchases', () => {
    const a = defaultArena();
    expect(ticketsToday(a, '2026-10-13')).toBe(FREE_TICKETS);
    refreshTickets(a, '2026-10-13');
    a.tickets = 0;
    a.bought = 3;
    expect(ticketsToday(a, '2026-10-13')).toBe(0);
    expect(ticketsToday(a, '2026-10-14')).toBe(FREE_TICKETS);
    refreshTickets(a, '2026-10-14');
    expect(a.tickets).toBe(FREE_TICKETS);
    expect(a.bought).toBe(0);
    // refreshing the same day again changes nothing
    a.tickets = 2;
    refreshTickets(a, '2026-10-14');
    expect(a.tickets).toBe(2);
  });

  it('bought extras above the free amount carry over', () => {
    const a = defaultArena();
    refreshTickets(a, 'd1');
    a.tickets = 7;
    refreshTickets(a, 'd2');
    expect(a.tickets).toBe(7);
  });

  it('extra tickets get pricier and run out', () => {
    const a = defaultArena();
    refreshTickets(a, 'd1');
    const costs: number[] = [];
    for (let i = 0; i < 10; i++) {
      const c = ticketCost(a, 'd1');
      if (c === null) break;
      costs.push(c);
      a.bought++;
    }
    expect(costs).toEqual(TICKET_COSTS);
    for (let i = 1; i < costs.length; i++) expect(costs[i]).toBeGreaterThan(costs[i - 1]);
    expect(ticketCost(a, 'd1')).toBeNull();
    expect(ticketCost(a, 'd2')).toBe(TICKET_COSTS[0]);
  });
});

describe('seasons', () => {
  it('weekly ids roll over on Monday 00:00 UTC', () => {
    expect(seasonId(SEASON_EPOCH)).toBe(1);
    expect(seasonId(SEASON_EPOCH + WEEK_MS - 1)).toBe(1);
    expect(seasonId(SEASON_EPOCH + WEEK_MS)).toBe(2);
    expect(new Date(seasonStart(5)).getUTCDay()).toBe(1);
    expect(seasonEnd(5)).toBe(seasonStart(6));
    const now = Date.UTC(2026, 9, 13, 12);
    const id = seasonId(now);
    expect(seasonStart(id)).toBeLessThanOrEqual(now);
    expect(seasonEnd(id)).toBeGreaterThan(now);
    expect(seasonId(0)).toBe(1); // clamps before the epoch
  });

  it('soft reset halves the distance to 1000', () => {
    expect(softReset(1000)).toBe(1000);
    expect(softReset(1800)).toBe(1400);
    expect(softReset(900)).toBe(950);
  });

  it('first visit joins the season without a summary', () => {
    const a = defaultArena();
    expect(rollSeason(a, SEASON_EPOCH + 3 * WEEK_MS)).toBeNull();
    expect(a.seasonId).toBe(4);
    expect(a.rating).toBe(1000);
  });

  it('rollover records the result, resets the rating and the season record', () => {
    const a = defaultArena();
    a.seasonId = 4;
    a.rating = 1500;
    a.bestRating = 1530;
    a.seasonWins = 9;
    a.seasonLosses = 4;
    expect(rollSeason(a, seasonStart(4) + 1000)).toBeNull(); // same season
    const r = rollSeason(a, seasonStart(5) + 10)!;
    expect(r).not.toBeNull();
    expect(r.id).toBe(4);
    expect(r.rating).toBe(1500);
    expect(r.best).toBe(1530);
    expect(r).toMatchObject(seasonReward(1500));
    expect(r.newRating).toBe(1250);
    expect(a.rating).toBe(1250);
    expect(a.seasonId).toBe(5);
    expect(a.seasonWins).toBe(0);
    expect(a.seasonResult).toEqual(r);
    // no fights in season 5 → no new reward, but the rating still resets
    expect(rollSeason(a, seasonStart(6))).toBeNull();
    expect(a.rating).toBe(1125);
    expect(a.seasonResult).toEqual(r);
  });

  it('ratings published in older seasons are soft-reset for matchmaking', () => {
    expect(currentRating(1400, 10, 10)).toBe(1400);
    expect(currentRating(1400, null, 10)).toBe(1400);
    expect(currentRating(1400, 9, 10)).toBe(1200);
    expect(currentRating(1400, 8, 10)).toBe(1100);
    expect(currentRating(600, 9, 10)).toBe(800);
    expect(Math.abs(currentRating(1800, 1, 999) - 1000)).toBeLessThanOrEqual(1);
  });

  it('season rewards grow with tier', () => {
    let prev = { gems: 0, medals: 0 };
    for (const t of TIERS) {
      const r = seasonReward(t.min);
      expect(r.gems).toBeGreaterThan(prev.gems);
      expect(r.medals).toBeGreaterThan(prev.medals);
      prev = r;
    }
  });
});

describe('save hygiene', () => {
  it('repairs a corrupted slice', () => {
    const a: any = { ...defaultArena(), rating: 'x', tickets: -4, history: 'nope', defense: { formation: 1 }, pending: 5, shopBought: null };
    sanitizeArena(a);
    expect(a.rating).toBe(1000);
    expect(a.tickets).toBe(0);
    expect(a.history).toEqual([]);
    expect(a.defense).toBeNull();
    expect(a.pending).toBeNull();
    expect(a.shopBought).toEqual({});
  });

  it('repairs old or damaged history entries and season results', () => {
    const a: any = {
      ...defaultArena(),
      history: [{ at: 5, opponent: 'bot-1', won: true, delta: 12 }, { opponent: 'u_x', delta: 'NaN', lineup: 'asta' }, null, { at: 1 }],
      seasonResult: { id: 3 },
    };
    sanitizeArena(a);
    expect(a.history).toEqual([{ at: 5, opponent: 'bot-1', won: true, delta: 12 }, { at: 0, opponent: 'u_x', won: false, delta: 0 }]);
    expect(a.seasonResult).toBeNull();
  });
});

describe('shop', () => {
  it('rotates daily, is deterministic, and offers Epic/Legendary/Mythic pages', () => {
    const a = shopItems('2026-10-13', 30);
    expect(shopItems('2026-10-13', 30)).toEqual(a);
    const pages = a.filter((i) => i.kind === 'pages');
    expect(pages.length).toBe(3);
    const rar = pages.map((p) => SUMMONABLE.find((h) => h.id === p.heroId)!.rarity);
    expect(rar).toEqual(['SR', 'SSR', 'UR']);
    expect(pages[2].cost).toBeGreaterThan(pages[1].cost);
    const days = new Set(Array.from({ length: 10 }, (_, i) => shopItems(`2026-10-${i + 1}`, 30).map((x) => x.id).join()));
    expect(days.size).toBeGreaterThan(1);
  });

  it('limits purchases per day', () => {
    const s = defaultArena();
    const item = shopItems('d1', 10).find((i) => i.kind === 'tickets')!;
    expect(shopLeft(s, 'd1', item)).toBe(item.limit);
    s.shopDay = 'd1';
    s.shopBought = { [item.id]: item.limit };
    expect(shopLeft(s, 'd1', item)).toBe(0);
    expect(shopLeft(s, 'd2', item)).toBe(item.limit);
  });
});

describe('bots', () => {
  it('are deterministic per seed', () => {
    const a = makeBot(1234, 12000, 1050);
    const b = makeBot(1234, 12000, 1050);
    expect(a).toEqual(b);
    expect(botName(77)).toBe(botName(77));
    const names = new Set(Array.from({ length: 40 }, (_, i) => botName(i)));
    expect(names.size).toBeGreaterThan(20);
    for (const n of names) expect(n.length).toBeLessThanOrEqual(20);
  });

  it('build legal squads: 5 distinct summonable heroes, a Defender, legal levels', () => {
    for (let seed = 0; seed < 60; seed++) {
      const b = makeBot(seed, 3000 + seed * 900, 1000);
      const heroIds = b.team.members.map((m) => m.heroId);
      expect(new Set(heroIds).size).toBe(5);
      expect(new Set(b.team.members.map((m) => m.slot)).size).toBe(5);
      for (const m of b.team.members) {
        const h = SUMMONABLE.find((x) => x.id === m.heroId)!;
        expect(h).toBeTruthy();
        expect(m.stars).toBeGreaterThanOrEqual(1);
        expect(m.stars).toBeLessThanOrEqual(7);
        expect(m.level).toBeGreaterThanOrEqual(1);
        expect(m.level).toBeLessThanOrEqual(levelCap(m.stars));
      }
      expect(b.team.members.some((m) => SUMMONABLE.find((x) => x.id === m.heroId)!.role === 'Defender')).toBe(true);
      expect(b.power).toBe(teamPower(b.team));
      // A bot's published-style doc passes the same validation real players go through.
      expect(parseDefenseDoc('u_x', defenseDocBody(b.team, { rating: 1000, wins: 0 }, 1, 1))).not.toBeNull();
    }
  });

  it('land close to the target power', () => {
    for (const target of [3500, 5000, 8000, 15000, 30000, 45000, 70000]) {
      for (let seed = 1; seed <= 12; seed++) {
        const b = makeBot(seed * 7919, target, 1000);
        expect(Math.abs(b.power - target) / target).toBeLessThan(0.08);
      }
    }
  });
});

describe('online defense validation', () => {
  it('accepts a well-formed doc and recomputes power', () => {
    const p = parseDefenseDoc('u_abc', validDoc())!;
    expect(p).not.toBeNull();
    expect(p.team.members.length).toBe(5);
    expect(p.power).toBe(teamPower(p.team));
    expect(p.power).not.toBe(999999);
    expect(p.rating).toBe(1100);
    expect(p.season).toBe(41);
  });

  it('rejects malformed docs', () => {
    const bad: unknown[] = [
      null,
      'str',
      [],
      validDoc({ v: 2 }),
      validDoc({ rating: 'high' }),
      validDoc({ rating: NaN }),
      validDoc({ rating: Infinity }),
      validDoc({ rating: -5 }),
      validDoc({ updatedAt: undefined }),
      validDoc({ wins: -1 }),
      validDoc({ wins: 1.5 }),
      validDoc({ season: 'x' }),
      validDoc({ defense: null }),
      validDoc({ defense: { formation: 'nope', members: [] } }),
      validDoc({ defense: { formation: '__proto__', members: [{ heroId: 'asta', level: 1, stars: 4, slot: 0 }] } }),
      validDoc({ defense: { formation: 'balanced', members: [] } }),
      validDoc({ defense: { formation: 'balanced', members: 'asta' } }),
      validDoc({ defense: { formation: 'balanced', members: ids(6).map((heroId, slot) => ({ heroId, level: 5, stars: 5, slot: slot % 5 })) } }),
      validDoc({ defense: { formation: 'balanced', members: [{ heroId: 'not_a_hero', level: 5, stars: 3, slot: 0 }] } }),
      validDoc({ defense: { formation: 'balanced', members: [{ heroId: 'bandit', level: 5, stars: 3, slot: 0 }] } }), // enemy, not summonable
      validDoc({ defense: { formation: 'balanced', members: [{ heroId: 'constructor', level: 5, stars: 3, slot: 0 }] } }),
      validDoc({ defense: { formation: 'balanced', members: [{ heroId: 'asta', level: 0, stars: 4, slot: 0 }] } }),
      validDoc({ defense: { formation: 'balanced', members: [{ heroId: 'asta', level: 999, stars: 4, slot: 0 }] } }),
      validDoc({ defense: { formation: 'balanced', members: [{ heroId: 'asta', level: 5, stars: 9, slot: 0 }] } }),
      validDoc({ defense: { formation: 'balanced', members: [{ heroId: 'asta', level: 5, stars: 4, slot: 7 }] } }),
      validDoc({ defense: { formation: 'balanced', members: [{ heroId: 'asta', level: 5.5, stars: 4, slot: 0 }] } }),
      validDoc({ defense: { formation: 'balanced', members: [{ heroId: 'asta', level: 5, stars: 4, slot: 0 }, { heroId: 'asta', level: 5, stars: 4, slot: 1 }] } }),
      validDoc({ defense: { formation: 'balanced', members: [{ heroId: 'asta', level: 5, stars: 4, slot: 0 }, { heroId: 'yuno', level: 5, stars: 4, slot: 0 }] } }),
      validDoc({ defense: { formation: 'balanced', members: [null] } }),
    ];
    for (const d of bad) expect(parseDefenseDoc('u_abc', d)).toBeNull();
    expect(parseDefenseDoc('', validDoc())).toBeNull();
    expect(parseDefenseDoc('bad/id', validDoc())).toBeNull();
    expect(parseDefenseDoc(42, validDoc())).toBeNull();
  });

  it('carries a sane team bonus and rejects out-of-range ones', () => {
    const base = validDoc();
    const withBonus = (bonus: unknown) => ({ ...base, defense: { ...base.defense, bonus } });
    const p = parseDefenseDoc('u_abc', withBonus({ atk: 0.15, hp: 0.09, junk: 99 }))!;
    expect(p.team.bonus).toEqual({ atk: 0.15, hp: 0.09 });
    expect(p.power).toBeGreaterThan(parseDefenseDoc('u_abc', base)!.power);
    expect(parseDefenseDoc('u_abc', withBonus({}))!.team.bonus).toBeUndefined();
    for (const bad of [{ atk: 5 }, { hp: -0.1 }, { def: 'x' }, [0.1], 'atk']) expect(parseDefenseDoc('u_abc', withBonus(bad))).toBeNull();
  });

  it('publishes a body that round-trips through validation', () => {
    const team = { members: ids(5).map((heroId, slot) => ({ heroId, level: 12, stars: 4, slot })), formation: FORMATION_MAP.balanced, bonus: { atk: 0.06, hp: 0 } };
    const body = defenseDocBody(team, { rating: 1234.4, wins: 7 }, 41, 1_700_000_000_000);
    expect(body.defense.bonus).toEqual({ atk: 0.06 });
    const p = parseDefenseDoc('u_me', JSON.parse(JSON.stringify(body)))!;
    expect(p).not.toBeNull();
    expect(p.rating).toBe(1234);
    expect(p.power).toBe(body.power);
    expect(p.team.bonus).toEqual({ atk: 0.06 });
  });

  it('drops boss / multiplier extras from members', () => {
    const d = validDoc({ defense: { formation: 'vanguard', members: [{ heroId: 'asta', level: 5, stars: 4, slot: 0, boss: true, mult: 50 }] } });
    const p = parseDefenseDoc('u_abc', d)!;
    expect(p.team.members[0]).toEqual({ heroId: 'asta', level: 5, stars: 4, slot: 0 });
    expect(p.team.formation).toBe(FORMATION_MAP.vanguard);
  });
});

describe('matchmaking', () => {
  const player = (id: string, rating: number): OnlineDefense => {
    const p = parseDefenseDoc(id, validDoc({ rating }))!;
    return p;
  };

  it('offline: four bots around your rating, easiest first', () => {
    const list = pickOpponents({ seed: 5, rating: 1200, power: 20000 });
    expect(list.length).toBe(4);
    expect(list.every((o) => o.kind === 'bot')).toBe(true);
    for (let i = 1; i < list.length; i++) expect(list[i].rating).toBeGreaterThanOrEqual(list[i - 1].rating);
    for (const o of list) {
      expect(Math.abs(o.rating - 1200)).toBeLessThanOrEqual(100);
      expect(o.power / 20000).toBeGreaterThan(0.78);
      expect(o.power / 20000).toBeLessThan(1.25);
    }
    expect(pickOpponents({ seed: 5, rating: 1200, power: 20000 })).toEqual(list);
    expect(pickOpponents({ seed: 6, rating: 1200, power: 20000 }).map((o) => o.id)).not.toEqual(list.map((o) => o.id));
  });

  it('online: picks up to two real players near your rating, never yourself', () => {
    const pool = [player('me', 1205), player('near1', 1180), player('near2', 1260), player('near3', 1150), player('far', 1900), player('low', 600)];
    for (let seed = 0; seed < 20; seed++) {
      const list = pickOpponents({ seed, rating: 1200, power: 20000, pool, selfId: 'me' });
      expect(list.length).toBe(4);
      const real = list.filter((o) => o.kind === 'player');
      expect(real.length).toBe(2);
      for (const r of real) expect(['near1', 'near2', 'near3']).toContain(r.id);
      expect(new Set(list.map((o) => o.id)).size).toBe(4);
    }
  });

  it('only one real player in range → three bots', () => {
    const list = pickOpponents({ seed: 1, rating: 1000, power: 9000, pool: [player('p1', 1010), player('far', 2000)] });
    expect(list.filter((o) => o.kind === 'player').map((o) => o.id)).toEqual(['p1']);
    expect(list.filter((o) => o.kind === 'bot').length).toBe(3);
  });
});

describe('leaderboard bots', () => {
  it('are deterministic per season and climb during the week', () => {
    const sid = 10;
    const early = leaderboardBots(sid, seasonStart(sid));
    const late = leaderboardBots(sid, seasonEnd(sid) - 1);
    expect(leaderboardBots(sid, seasonStart(sid))).toEqual(early);
    expect(early.length).toBe(60);
    expect(Math.max(...late.map((b) => b.rating))).toBeGreaterThan(Math.max(...early.map((b) => b.rating)));
    expect(tierIndex(Math.max(...late.map((b) => b.rating)))).toBeGreaterThanOrEqual(4);
  });

  it('have unique names and leave room below the starting rating', () => {
    for (const sid of [3, 41, 99]) {
      const mid = leaderboardBots(sid, seasonStart(sid) + WEEK_MS / 2);
      expect(new Set(mid.map((b) => b.name)).size).toBe(mid.length);
      const below = mid.filter((b) => b.rating < 1000).length;
      expect(below).toBeGreaterThan(3);
      expect(below).toBeLessThan(mid.length / 3);
    }
  });
});

describe('arena actions (through the store)', () => {
  it('a fight spends a ticket up front, settles once, and pays medals', async () => {
    const store = await import('../src/game/store');
    const actions = await import('../src/features/arena/actions');
    const { today } = await import('../src/game/state');
    const s = store.getState();
    s.stage = 30;
    s.arena = defaultArena();
    actions.ensureArena();
    expect(s.arena.ticketDay).toBe(today());
    expect(s.arena.seasonId).toBe(seasonId(Date.now()));

    let spec: any = null;
    const nav: any = { battle: (x: unknown) => (spec = x), closeBattle: () => {} };
    const opp = makeBot(77, 5000, 1000);
    const medals = s.currencies.medals ?? 0;
    expect(actions.startArenaFight(opp, 'RivalName', nav, 10_000_000)).toBeNull();
    expect(spec.kind).toBe('arena');
    expect(spec.title).toBe('vs RivalName');
    expect(spec.banner).toBe('ARENA!');
    expect(spec.enemy.bonus).toEqual(opp.team.bonus);
    expect(s.arena.tickets).toBe(FREE_TICKETS - 1);
    // Leaving early is a loss: it is applied before the fight starts.
    const { win, loss } = ratingDeltas(1000, opp.rating);
    expect(s.arena.rating).toBe(1000 + loss);
    expect(s.arena.history[0]).toMatchObject({ opponent: opp.id, botName: opp.botName, forfeit: true });

    // Double tap within 1.5s doesn't start a second fight.
    expect(actions.startArenaFight(opp, 'RivalName', nav, 10_000_500)).toBeNull();
    expect(s.arena.tickets).toBe(FREE_TICKETS - 1);

    const fake: any = { winner: 0, ultsCast: [3, 0] };
    const out = spec.finish(fake);
    expect(out.won).toBe(true);
    expect(out.notes[0]).toBe(`Rating +${win} → ${1000 + win}`);
    expect(out.next.label).toBe('Next Opponent');
    expect(s.arena.rating).toBe(1000 + win);
    expect(s.arena.wins).toBe(1);
    expect(s.arena.losses).toBe(0);
    expect(s.arena.pending).toBeNull();
    expect(s.arena.history[0]).toMatchObject({ won: true, delta: win, forfeit: false });
    expect(s.currencies.medals).toBe(medals + fightMedals(1000, true));
    // Settling twice changes nothing.
    spec.finish(fake);
    expect(s.arena.rating).toBe(1000 + win);
    expect(s.currencies.medals).toBe(medals + fightMedals(1000, true));
  });

  it('extra tickets cost escalating gems; a double tap buys only one', async () => {
    const store = await import('../src/game/store');
    const actions = await import('../src/features/arena/actions');
    const s = store.getState();
    s.currencies.gems = 1000;
    const t0 = s.arena.tickets;
    expect(actions.buyTicket(20_000_000)).toBeNull();
    expect(actions.buyTicket(20_000_100)).toBe(''); // swallowed double tap
    expect(actions.buyTicket(20_001_000)).toBeNull();
    expect(s.arena.tickets).toBe(t0 + 2);
    expect(s.currencies.gems).toBe(1000 - TICKET_COSTS[0] - TICKET_COSTS[1]);
    s.currencies.gems = 0;
    expect(actions.buyTicket(20_002_000)).toBe('Not enough gems.');
  });

  it('the shop spends medals within daily limits; season rewards are collected once', async () => {
    const store = await import('../src/game/store');
    const actions = await import('../src/features/arena/actions');
    const { today } = await import('../src/game/state');
    const s = store.getState();
    const item = shopItems(today(), s.stage).find((i) => i.kind === 'essence')!;
    s.currencies.medals = item.cost * 10;
    const ess = s.currencies.essence;
    for (let i = 0; i < item.limit; i++) expect(actions.buyShopItem(item.id, 30_000_000 + i * 1000)).toBeNull();
    expect(actions.buyShopItem(item.id, 30_100_000)).toBe('Sold out for today.');
    expect(s.currencies.essence).toBe(ess + item.amount * item.limit);
    expect(s.currencies.medals).toBe(item.cost * (10 - item.limit));
    expect(actions.buyShopItem('nope', 30_200_000)).toBe('That offer has expired.');

    s.arena.seasonResult = { id: 3, rating: 1500, best: 1520, wins: 9, losses: 2, gems: 350, medals: 560, newRating: 1250 };
    const gems = s.currencies.gems;
    expect(actions.claimSeason()).toEqual({ gems: 350, medals: 560 });
    expect(actions.claimSeason()).toBeNull();
    expect(s.currencies.gems).toBe(gems + 350);
  });

  it('arena screen badge: tickets today or an unclaimed season', async () => {
    const { arenaScreen } = await import('../src/features/arena/screen');
    const s: any = { stage: 30, arena: { ...defaultArena(), tickets: 0, ticketDay: 'old-day' } };
    expect(arenaScreen.badge!(s)).toBe(true); // a new day refills
    const { today } = await import('../src/game/state');
    s.arena.ticketDay = today();
    expect(arenaScreen.badge!(s)).toBe(false);
    s.arena.seasonResult = { id: 1 };
    expect(arenaScreen.badge!(s)).toBe(true);
    expect(arenaScreen.badge!({ stage: 3, arena: defaultArena() } as any)).toBe(false);
  });
});
