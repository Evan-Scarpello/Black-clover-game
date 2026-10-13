import { describe, expect, it, vi } from 'vitest';
import {
  BOSS_EVERY,
  POWER_FACTOR,
  TRIAL_EVERY,
  canChallenge,
  floorLevel,
  floorMult,
  floorReward,
  floorTwist,
  isBossFloor,
  isFirstClear,
  isMilestone,
  isTrialFloor,
  nextMilestone,
  refPower,
  towerFloor,
} from '../src/features/tower/logic';
import { HERO_MAP } from '../src/data/heroes';
import { teamPower } from '../src/game/power';
import { newSave } from '../src/game/state';
import type { Nav } from '../src/ui/nav';

const FLOORS = Array.from({ length: 80 }, (_, i) => i + 1);
const basePower = (f: number) => teamPower({ ...towerFloor(f).team, bonus: undefined });

describe('tower floors', () => {
  it('are deterministic: same floor, same squad', () => {
    for (const f of FLOORS) expect(JSON.stringify(towerFloor(f))).toBe(JSON.stringify(towerFloor(f)));
    // Different floors are different fights.
    expect(JSON.stringify(towerFloor(3).team)).not.toBe(JSON.stringify(towerFloor(4).team));
  });

  it('always field five real heroes in distinct slots', () => {
    for (const f of FLOORS) {
      const t = towerFloor(f).team;
      expect(t.members).toHaveLength(5);
      expect(new Set(t.members.map((m) => m.slot)).size).toBe(5);
      for (const m of t.members) {
        expect(HERO_MAP[m.heroId], `floor ${f}: ${m.heroId}`).toBeTruthy();
        expect(m.slot).toBeGreaterThanOrEqual(0);
        expect(m.slot).toBeLessThan(5);
        expect(m.mult).toBeGreaterThan(0);
        expect(Number.isFinite(m.mult)).toBe(true);
      }
      expect(t.formation?.rows?.length).toBe(5);
    }
  });

  it('include NPC enemies and heroes/villains from the roster', () => {
    const ids = new Set(FLOORS.flatMap((f) => towerFloor(f).team.members.map((m) => m.heroId)));
    expect(['golem', 'bandit', 'magic_beast'].some((id) => ids.has(id))).toBe(true);
    expect(ids.size).toBeGreaterThan(25);
  });

  it('scale up monotonically', () => {
    for (let f = 1; f < 120; f++) {
      expect(floorLevel(f + 1)).toBeGreaterThanOrEqual(floorLevel(f));
      expect(floorMult(f + 1)).toBeGreaterThanOrEqual(floorMult(f));
      expect(refPower(f + 1)).toBeGreaterThan(refPower(f));
    }
    // Within each kind of floor, the enemy power budget never drops as you climb.
    const kinds: Record<string, number[]> = { normal: [], boss: [], trial: [] };
    for (const f of FLOORS) kinds[isTrialFloor(f) ? 'trial' : isBossFloor(f) ? 'boss' : 'normal'].push(f);
    for (const list of Object.values(kinds)) {
      for (let i = 1; i < list.length; i++) expect(basePower(list[i])).toBeGreaterThanOrEqual(basePower(list[i - 1]) * 0.99);
    }
    // Normalised to the budget (power is near-linear in mult, so within a couple of percent).
    for (const f of FLOORS) {
      const k = isTrialFloor(f) ? POWER_FACTOR.trial : isBossFloor(f) ? POWER_FACTOR.boss : POWER_FACTOR.normal;
      expect(Math.abs(basePower(f) / (refPower(f) * k) - 1)).toBeLessThan(0.03);
    }
    // Floor 40 is far tougher than floor 1.
    expect(teamPower(towerFloor(40).team)).toBeGreaterThan(teamPower(towerFloor(1).team) * 5);
  });

  it('put a boss on every 5th floor and only there', () => {
    for (const f of FLOORS) {
      const info = towerFloor(f);
      const bosses = info.team.members.filter((m) => m.boss);
      if (f % BOSS_EVERY === 0) {
        expect(info.isBoss).toBe(true);
        expect(bosses.length).toBeGreaterThanOrEqual(1);
        expect(bosses.some((m) => m.heroId === info.leader)).toBe(true);
      } else {
        expect(info.isBoss).toBe(false);
        expect(bosses).toHaveLength(0);
      }
    }
  });

  it('make every 10th floor a Trial with a visible twist', () => {
    const seen = new Set<string>();
    for (const f of FLOORS) {
      const info = towerFloor(f);
      if (f % TRIAL_EVERY !== 0) {
        expect(info.twist).toBeNull();
        expect(floorTwist(f)).toBeNull();
        continue;
      }
      const tw = info.twist!;
      expect(info.isTrial).toBe(true);
      expect(tw.text.length).toBeGreaterThan(10);
      seen.add(tw.id);
      if (tw.id === 'blitz') expect(info.team.formation.id).toBe('blitz');
      if (tw.id === 'fury') expect(info.team.bonus?.atk).toBeCloseTo(0.3);
      if (tw.id === 'fortress') expect(info.team.formation.id).toBe('fortress');
      if (tw.id === 'twin') expect(info.team.members.filter((m) => m.boss)).toHaveLength(2);
      if (tw.id === 'faction') {
        expect(tw.faction).toBeTruthy();
        for (const m of info.team.members) expect(HERO_MAP[m.heroId].faction).toBe(tw.faction);
      }
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });

  it('pay more for higher floors and extra on milestones', () => {
    for (let f = 1; f < 60; f++) {
      const a = floorReward(f);
      const b = floorReward(f + 1);
      if (!isBossFloor(f) && !isBossFloor(f + 1)) {
        expect(b.gems!).toBeGreaterThanOrEqual(a.gems!);
        expect(b.yul!).toBeGreaterThanOrEqual(a.yul!);
      }
    }
    for (const f of FLOORS) {
      const r = floorReward(f);
      if (isMilestone(f)) {
        expect(r.tickets).toBeGreaterThanOrEqual(1);
        const pages = Object.entries(r.shards ?? {});
        expect(pages.length).toBeGreaterThan(0);
        for (const [id] of pages) expect(['SSR', 'UR']).toContain(HERO_MAP[id].rarity);
      } else {
        expect(r.tickets ?? 0).toBe(0);
        expect(r.shards).toBeUndefined();
      }
    }
    expect(Object.keys(floorReward(25).shards!).map((id) => HERO_MAP[id].rarity)).toContain('UR');
    expect(nextMilestone(0)).toBe(10);
    expect(nextMilestone(10)).toBe(20);
    expect(nextMilestone(24)).toBe(25);
  });

  it('only allow the next floor or replays, and only pay the next floor', () => {
    expect(canChallenge(0, 1)).toBe(true);
    expect(canChallenge(0, 2)).toBe(false);
    expect(canChallenge(5, 3)).toBe(true);
    expect(canChallenge(5, 0)).toBe(false);
    expect(isFirstClear(5, 6)).toBe(true);
    expect(isFirstClear(5, 5)).toBe(false);
    expect(isFirstClear(5, 8)).toBe(false);
  });

  it('handles junk floor numbers', () => {
    expect(towerFloor(0).floor).toBe(1);
    expect(towerFloor(-3).floor).toBe(1);
    expect(towerFloor(2.7).floor).toBe(2);
  });
});

describe('tower battle results', () => {
  const nav = { battle: vi.fn() } as unknown as Nav;

  it('records first clears once and pays nothing for replays or losses', async () => {
    const store = await import('../src/game/store');
    const { recordTowerBattle, towerBattle } = await import('../src/features/tower/battle');
    const s = newSave(0);
    s.stage = 30;
    store.replaceState(s);
    const gems0 = store.getState().currencies.gems;

    const lost = recordTowerBattle(1, false, 0, nav);
    expect(lost.won).toBe(false);
    expect(lost.reward).toBeNull();
    expect(store.getState().tower.floor).toBe(0);

    const win = recordTowerBattle(1, true, 2, nav);
    expect(win.won).toBe(true);
    expect(win.notes).toContain('Floor 1 cleared!');
    expect(win.reward).toEqual(floorReward(1));
    expect(store.getState().tower.floor).toBe(1);
    const gems1 = store.getState().currencies.gems;
    expect(gems1).toBe(gems0 + floorReward(1).gems!);

    const replay = recordTowerBattle(1, true, 0, nav);
    expect(replay.reward).toBeNull();
    expect(store.getState().tower.floor).toBe(1);
    expect(store.getState().currencies.gems).toBe(gems1);

    // Skipping ahead never counts.
    recordTowerBattle(5, true, 0, nav);
    expect(store.getState().tower.floor).toBe(1);

    // "Next" climbs the following floor.
    win.next!.go();
    expect((nav.battle as any).mock.calls.at(-1)[0].label).toBe('Floor 2');

    const spec = towerBattle(12, nav);
    expect(spec.kind).toBe('tower');
    expect(spec.enemy).toEqual(towerFloor(12).team);
  });

  it('milestone floors hand out hero pages', async () => {
    const store = await import('../src/game/store');
    const { recordTowerBattle } = await import('../src/features/tower/battle');
    const s = newSave(0);
    s.tower.floor = 9;
    store.replaceState(s);
    const tickets0 = store.getState().currencies.tickets;
    recordTowerBattle(10, true, 0, nav);
    expect(store.getState().tower.floor).toBe(10);
    expect(store.getState().currencies.tickets).toBe(tickets0 + floorReward(10).tickets!);
  });
});
