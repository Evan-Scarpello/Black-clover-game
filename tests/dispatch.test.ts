import { describe, expect, it } from 'vitest';
import {
  RANKS,
  busyHeroes,
  checkTeam,
  claimMission,
  defOf,
  durationMs,
  finishNowCost,
  generateBoard,
  hasReady,
  heroMeets,
  missionStatus,
  msToNextDay,
  quickAssign,
  recallMission,
  refreshBoard,
  remainingMs,
  reqsMet,
  rushMission,
  startMission,
} from '../src/features/dispatch/logic';
import { defaultDispatch, type DispatchSave, type MissionDef } from '../src/features/dispatch/state';
import { HERO_MAP, SUMMONABLE } from '../src/data/heroes';
import { newSave, today } from '../src/game/state';
import type { OwnedHero } from '../src/game/types';

const HOUR = 3600000;
const T0 = new Date(2026, 9, 13, 9, 0, 0).getTime();
const DAY = today(T0);

const own = (id: string, stars = 1, level = 1): OwnedHero => ({ id, level, stars, shards: 0, obtainedAt: 0 });
const roster = (ids: string[], stars = 1): Record<string, OwnedHero> => Object.fromEntries(ids.map((id) => [id, own(id, stars)]));
const ALL = roster(SUMMONABLE.map((h) => h.id), 6);
const days = (n: number) => Array.from({ length: n }, (_, i) => today(T0 + i * 24 * HOUR));

function freshBoard(day = DAY, stage = 20): DispatchSave {
  const d = defaultDispatch();
  refreshBoard(d, day, stage);
  return d;
}

/** A team that satisfies `def` from a roster, by brute force (for tests only). */
function anyValidTeam(def: MissionDef, owned: Record<string, OwnedHero>): string[] | null {
  const ids = Object.keys(owned);
  const go = (start: number, acc: string[]): string[] | null => {
    if (acc.length === def.size) return checkTeam(def, acc, owned, new Set()).ok ? [...acc] : null;
    for (let i = start; i < ids.length; i++) {
      const r = go(i + 1, [...acc, ids[i]]);
      if (r) return r;
    }
    return null;
  };
  return go(0, []);
}

describe('mission board generation', () => {
  it('is deterministic per date and changes between dates', () => {
    expect(generateBoard(DAY, 20)).toEqual(generateBoard(DAY, 20));
    const boards = days(10).map((d) => JSON.stringify(generateBoard(d, 20).map((m) => [m.title, m.rank, m.reqs])));
    expect(new Set(boards).size).toBeGreaterThan(8);
  });

  it('makes 6-8 well-formed missions a day', () => {
    let sDays = 0;
    for (const day of days(365)) {
      const board = generateBoard(day, 30);
      expect(board.length).toBeGreaterThanOrEqual(6);
      expect(board.length).toBeLessThanOrEqual(8);
      expect(new Set(board.map((m) => m.id)).size).toBe(board.length);
      expect(new Set(board.map((m) => m.title)).size).toBe(board.length);
      const ranks = board.map((m) => m.rank);
      expect(ranks.filter((r) => r === 'S').length).toBeLessThanOrEqual(1);
      if (ranks.includes('S')) sDays++;
      for (const m of board) {
        expect(m.id.startsWith(`${day}#`)).toBe(true);
        expect(m.hours).toBe(RANKS[m.rank].hours);
        expect(m.size).toBeGreaterThanOrEqual(1);
        expect(m.size).toBeLessThanOrEqual(3);
        expect(m.reqs.length).toBeLessThanOrEqual(2);
        expect(new Set(m.reqs.map((q) => q.kind)).size).toBe(m.reqs.length);
        expect(m.reward.gems).toBe(RANKS[m.rank].gems);
        expect(m.reward.yul).toBeGreaterThan(0);
        expect(m.reward.essence).toBeGreaterThan(0);
        if (m.rank === 'S') {
          expect(m.reward.tickets).toBeGreaterThanOrEqual(1);
          const pages = Object.keys(m.reward.shards ?? {});
          expect(pages).toHaveLength(1);
          expect(['SSR', 'UR']).toContain(HERO_MAP[pages[0]].rarity);
        } else {
          expect(m.reward.shards).toBeUndefined();
        }
        // Every mission can be done by a big enough roster.
        expect(anyValidTeam(m, ALL), `${m.title} ${JSON.stringify(m.reqs)}`).not.toBeNull();
      }
    }
    // S missions are rare but real.
    expect(sDays).toBeGreaterThan(10);
    expect(sDays).toBeLessThan(365 * 0.6);
  });

  it('scales rewards with rank and campaign progress', () => {
    const order = ['C', 'B', 'A', 'S'] as const;
    for (let i = 1; i < order.length; i++) {
      expect(RANKS[order[i]].gems).toBeGreaterThan(RANKS[order[i - 1]].gems);
      expect(RANKS[order[i]].afkHours).toBeGreaterThan(RANKS[order[i - 1]].afkHours);
      expect(RANKS[order[i]].hours).toBeGreaterThan(RANKS[order[i - 1]].hours);
    }
    const early = generateBoard(DAY, 2);
    const late = generateBoard(DAY, 60);
    const sum = (b: MissionDef[]) => b.reduce((t, m) => t + (m.reward.yul ?? 0) + (m.reward.essence ?? 0), 0);
    expect(sum(late)).toBeGreaterThan(sum(early));
    // Same day, same missions, whatever the stage.
    expect(late.map((m) => m.title)).toEqual(early.map((m) => m.title));
  });
});

describe('mission requirements', () => {
  const def = (reqs: MissionDef['reqs'], size = 2): MissionDef => ({ id: 'x', title: 't', icon: '', rank: 'B', hours: 2, size, reqs, reward: {} });

  it('checks each requirement kind against a hero', () => {
    expect(heroMeets({ kind: 'faction', faction: 'Black Bulls' }, own('asta'))).toBe(true);
    expect(heroMeets({ kind: 'faction', faction: 'Golden Dawn' }, own('asta'))).toBe(false);
    expect(heroMeets({ kind: 'role', role: HERO_MAP.mimosa.role }, own('mimosa'))).toBe(true);
    expect(heroMeets({ kind: 'range', range: HERO_MAP.asta.range }, own('asta'))).toBe(true);
    expect(heroMeets({ kind: 'stars', min: 4 }, own('magna', 3))).toBe(false);
    expect(heroMeets({ kind: 'stars', min: 4 }, own('magna', 4))).toBe(true);
    expect(heroMeets({ kind: 'rarity', min: 'UR' }, own('asta'))).toBe(true);
    expect(heroMeets({ kind: 'rarity', min: 'UR' }, own('magna'))).toBe(false);
    expect(heroMeets({ kind: 'rarity', min: 'SR' }, own('noelle'))).toBe(true);
    expect(heroMeets({ kind: 'faction', faction: 'Black Bulls' }, own('not_a_hero'))).toBe(false);
  });

  it('validates whole teams with a reason', () => {
    const owned = roster(['asta', 'magna', 'noelle', 'yuno']);
    const d = def([{ kind: 'faction', faction: 'Golden Dawn' }, { kind: 'rarity', min: 'UR' }]);
    expect(checkTeam(d, ['asta', 'magna'], owned, new Set())).toMatchObject({ ok: false, reason: 'Needs Golden Dawn hero.' });
    expect(checkTeam(d, ['yuno', 'magna'], owned, new Set()).ok).toBe(true); // Yuno covers both
    expect(checkTeam(d, ['yuno'], owned, new Set()).ok).toBe(false); // wrong size
    expect(checkTeam(d, ['yuno', 'yuno'], owned, new Set()).ok).toBe(false); // duplicate
    expect(checkTeam(d, ['yuno', 'luck'], owned, new Set()).ok).toBe(false); // not owned
    expect(checkTeam(d, ['yuno', 'magna'], owned, new Set(['yuno'])).ok).toBe(false); // busy
    expect(reqsMet(d, [own('asta')])).toEqual([false, true]);
  });
});

describe('mission timing', () => {
  it('runs idle → active → ready → claimed', () => {
    const d = freshBoard();
    const m = d.missions[d.missions.length - 1];
    const def = defOf(d, m.id)!;
    const team = anyValidTeam(def, ALL)!;
    expect(missionStatus(m, def, T0)).toBe('idle');
    expect(claimMission(d, m.id, T0)).toBeNull();

    expect(startMission(d, m.id, team, ALL, T0).ok).toBe(true);
    expect(m.startedAt).toBe(T0);
    expect(startMission(d, m.id, team, ALL, T0).ok).toBe(false); // already underway
    expect(missionStatus(m, def, T0 + 1000)).toBe('active');
    expect(remainingMs(m, def, T0 + HOUR / 2)).toBe(durationMs(def) - HOUR / 2);
    expect(missionStatus(m, def, T0 + durationMs(def) - 1)).toBe('active');
    expect(claimMission(d, m.id, T0 + durationMs(def) - 1)).toBeNull();
    expect(missionStatus(m, def, T0 + durationMs(def))).toBe('ready');
    expect(hasReady(d, T0 + durationMs(def))).toBe(true);
    expect(hasReady(d, T0)).toBe(false);

    const reward = claimMission(d, m.id, T0 + durationMs(def));
    expect(reward).toEqual(def.reward);
    expect(missionStatus(m, def, T0 + durationMs(def))).toBe('claimed');
    expect(d.completed).toBe(1);
    expect(claimMission(d, m.id, T0 + durationMs(def))).toBeNull(); // no double claim
    expect(hasReady(d, T0 + durationMs(def))).toBe(false);
  });

  it('keeps a hero on one mission at a time and frees them after claim or recall', () => {
    const d = freshBoard();
    const [a, b] = d.missions;
    const defA = defOf(d, a.id)!;
    const team = anyValidTeam(defA, ALL)!;
    startMission(d, a.id, team, ALL, T0);
    expect([...busyHeroes(d)].sort()).toEqual([...team].sort());
    const defB = defOf(d, b.id)!;
    const clash = [team[0], ...Object.keys(ALL).filter((id) => !team.includes(id))].slice(0, defB.size);
    expect(startMission(d, b.id, clash, ALL, T0).ok).toBe(false);

    expect(recallMission(d, a.id, T0 + 1000)).toBe(true);
    expect(a.heroes).toEqual([]);
    expect(missionStatus(a, defA, T0 + 1000)).toBe('idle');
    expect(busyHeroes(d).size).toBe(0);
  });

  it('never runs longer than its duration, even if the clock jumps back', () => {
    const d = freshBoard();
    const m = d.missions[0];
    const def = defOf(d, m.id)!;
    startMission(d, m.id, anyValidTeam(def, ALL)!, ALL, T0);
    expect(remainingMs(m, def, T0 - 5 * HOUR)).toBe(durationMs(def));
  });

  it('prices finish-now by remaining time and makes the mission ready', () => {
    expect(finishNowCost(0)).toBe(0);
    expect(finishNowCost(1000)).toBe(5);
    expect(finishNowCost(8 * HOUR)).toBe(240);
    expect(finishNowCost(4 * HOUR)).toBeLessThan(finishNowCost(8 * HOUR));
    const d = freshBoard();
    const m = d.missions[0];
    const def = defOf(d, m.id)!;
    expect(rushMission(d, m.id, T0)).toBeNull(); // idle
    startMission(d, m.id, anyValidTeam(def, ALL)!, ALL, T0);
    const cost = rushMission(d, m.id, T0 + HOUR / 2);
    expect(cost).toBe(finishNowCost(durationMs(def) - HOUR / 2));
    expect(missionStatus(m, def, T0 + HOUR / 2)).toBe('ready');
  });

  it('counts down to local midnight', () => {
    const ms = msToNextDay(T0);
    expect(ms).toBe(15 * HOUR);
    expect(today(T0 + ms)).not.toBe(DAY);
  });
});

describe('daily board refresh', () => {
  it('builds the board on first visit and leaves it alone the same day', () => {
    const d = defaultDispatch();
    expect(refreshBoard(d, DAY, 10)).toBe(true);
    expect(d.day).toBe(DAY);
    expect(d.missions.map((m) => m.id)).toEqual(d.board.map((b) => b.id));
    expect(d.missions.every((m) => m.heroes.length === 0 && !m.claimed)).toBe(true);
    expect(refreshBoard(d, DAY, 10)).toBe(false);
  });

  it('migrates an old save slice with no board', () => {
    const d = { day: '', missions: [{ id: 'old', heroes: ['asta'], startedAt: 1, claimed: false }] } as unknown as DispatchSave;
    expect(refreshBoard(d, DAY, 10)).toBe(true);
    expect(d.missions.some((m) => m.id === 'old')).toBe(false);
    expect(d.completed).toBe(0);
    expect(d.board.length).toBeGreaterThanOrEqual(6);
  });

  it('drops malformed board entries and their missions', () => {
    const d = freshBoard();
    const id = d.board[0].id;
    (d.board[0] as any).reqs = null;
    d.board.push({ junk: true } as any);
    refreshBoard(d, DAY, 20);
    expect(defOf(d, id)).toBeUndefined();
    expect(d.missions.some((m) => m.id === id)).toBe(false);
    expect(d.board.every((b) => Array.isArray(b.reqs))).toBe(true);
  });

  it('rolls over on a new day, keeping only missions still out', () => {
    const d = freshBoard();
    const [run, done] = d.missions;
    startMission(d, run.id, anyValidTeam(defOf(d, run.id)!, ALL)!, ALL, T0);
    const doneDef = defOf(d, done.id)!;
    const busy = busyHeroes(d);
    const freeAll = Object.fromEntries(Object.entries(ALL).filter(([id]) => !busy.has(id)));
    startMission(d, done.id, anyValidTeam(doneDef, freeAll)!, ALL, T0);
    claimMission(d, done.id, T0 + durationMs(doneDef) + 1);

    const tomorrow = today(T0 + 24 * HOUR);
    expect(refreshBoard(d, tomorrow, 10)).toBe(true);
    expect(d.day).toBe(tomorrow);
    expect(d.missions.find((m) => m.id === run.id)?.heroes.length).toBeGreaterThan(0);
    expect(d.missions.some((m) => m.id === done.id)).toBe(false);
    expect(defOf(d, run.id)).toBeTruthy();
    const fresh = d.missions.filter((m) => m.id.startsWith(`${tomorrow}#`));
    expect(fresh.length).toBe(generateBoard(tomorrow, 10).length);
    expect(d.board.length).toBe(d.missions.length);
  });
});

describe('quick dispatch', () => {
  function validate(d: DispatchSave, owned: Record<string, OwnedHero>, plan: Record<string, string[]>) {
    const used = new Set<string>();
    const busy = busyHeroes(d);
    for (const [id, team] of Object.entries(plan)) {
      const def = defOf(d, id)!;
      expect(missionStatus(d.missions.find((m) => m.id === id)!, def, T0)).toBe('idle');
      expect(checkTeam(def, team, owned, busy)).toEqual({ ok: true });
      for (const h of team) {
        expect(used.has(h)).toBe(false);
        used.add(h);
      }
    }
  }

  it('only proposes valid, non-overlapping squads', () => {
    for (const day of days(40)) {
      const d = freshBoard(day);
      for (const owned of [ALL, roster(['asta', 'finral', 'magna', 'charmy', 'sol']), roster(SUMMONABLE.slice(0, 9).map((h) => h.id), 3)]) {
        const plan = quickAssign(d, owned, T0);
        validate(d, owned, plan);
      }
    }
  });

  it('fills every mission when the roster is deep enough', () => {
    for (const day of days(20)) {
      const d = freshBoard(day);
      const plan = quickAssign(d, ALL, T0);
      expect(Object.keys(plan).length).toBe(d.missions.length);
    }
  });

  it('skips heroes already out and missions already running', () => {
    const d = freshBoard();
    const first = d.missions[0];
    const team = anyValidTeam(defOf(d, first.id)!, ALL)!;
    startMission(d, first.id, team, ALL, T0);
    const plan = quickAssign(d, ALL, T0);
    expect(plan[first.id]).toBeUndefined();
    for (const t of Object.values(plan)) for (const id of t) expect(team).not.toContain(id);
    validate(d, ALL, plan);
  });

  it('does nothing with an empty roster', () => {
    expect(quickAssign(freshBoard(), {}, T0)).toEqual({});
  });
});

describe('dispatch actions (store)', () => {
  it('quick dispatch, finish now, claim all', async () => {
    const store = await import('../src/game/store');
    const actions = await import('../src/features/dispatch/actions');
    const s = newSave(T0);
    s.stage = 20;
    s.heroes = { ...ALL };
    s.currencies.gems = 5000;
    store.replaceState(s);

    expect(actions.ensureBoard(T0)).toBe(true);
    expect(actions.ensureBoard(T0)).toBe(false);
    const n = actions.quickDispatch(T0);
    expect(n).toBe(store.getState().dispatch.missions.length);
    expect(actions.quickDispatch(T0)).toBe(0);
    expect(actions.claimDispatch(T0)).toBeNull();

    const d = store.getState().dispatch;
    const id = d.missions[0].id;
    const cost = actions.rushCost(id, T0)!;
    expect(cost).toBeGreaterThan(0);
    const gems0 = store.getState().currencies.gems;
    const res = actions.rushDispatch(id, T0);
    expect('reward' in res && res.count).toBe(1);
    const reward = defOf(d, id)!.reward;
    expect(store.getState().currencies.gems).toBe(gems0 - cost + (reward.gems ?? 0));
    expect('error' in actions.rushDispatch(id, T0)).toBe(true); // already claimed

    // Much later everything is done: claim all pays the rest at once.
    const later = T0 + 9 * HOUR;
    expect(hasReady(store.getState().dispatch, later)).toBe(true);
    const all = actions.claimDispatch(later)!;
    expect(all.count).toBe(n - 1);
    expect(store.getState().dispatch.completed).toBe(n);
    expect(hasReady(store.getState().dispatch, later)).toBe(false);
  });

  it('refuses finish-now without the gems', async () => {
    const store = await import('../src/game/store');
    const actions = await import('../src/features/dispatch/actions');
    const s = newSave(T0);
    s.heroes = { ...ALL };
    s.currencies.gems = 0;
    store.replaceState(s);
    actions.ensureBoard(T0);
    actions.quickDispatch(T0);
    const id = store.getState().dispatch.missions[0].id;
    const res = actions.rushDispatch(id, T0 + 1000);
    expect('error' in res).toBe(true);
    expect(missionStatus(store.getState().dispatch.missions[0], defOf(store.getState().dispatch, id)!, T0 + 1000)).toBe('active');
  });
});
