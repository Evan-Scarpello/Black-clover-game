import { describe, expect, it } from 'vitest';
import { Battle, type TeamSetup } from '../src/game/battle';
import { FORMATION_MAP } from '../src/data/formations';
import { HEROES, SUMMONABLE } from '../src/data/heroes';
import { getStage } from '../src/data/campaign';
import { RARITY_INFO } from '../src/game/stats';

const team = (ids: string[], level: number, formation = 'balanced'): TeamSetup => ({
  formation: FORMATION_MAP[formation],
  members: ids.map((heroId, slot) => {
    const h = HEROES.find((x) => x.id === heroId)!;
    return { heroId, slot, level, stars: RARITY_INFO[h.rarity].startStars };
  }),
});

describe('battle engine', () => {
  it('is deterministic for a given seed', () => {
    const run = () => {
      const b = new Battle(team(['asta', 'noelle', 'finral', 'yuno', 'mimosa'], 10), getStage(5).team, 42);
      const w = b.runToEnd();
      return [w, b.time.toFixed(2), b.units.map((u) => u.hp).join(',')].join('|');
    };
    expect(run()).toBe(run());
  });

  it('starter squad beats stage 1-1', () => {
    const b = new Battle(team(['sol', 'asta', 'magna', 'finral', 'charmy'], 1), getStage(0).team, 7);
    expect(b.runToEnd()).toBe(0);
  });

  it('every hero can fight and cast its ultimate without errors', () => {
    for (const h of HEROES) {
      const b = new Battle(team([h.id, 'klaus', 'magna', 'charmy', 'gordon'], 20), team(['bandit', 'golem', 'bandit_mage', 'acolyte', 'magic_beast'], 20), 3);
      b.start();
      const hero = b.units.find((u) => u.def.id === h.id && u.side === 0)!;
      hero.energy = 100;
      let ult = false;
      for (let i = 0; i < 2000 && !b.over; i++) {
        b.step(0.1);
        for (const e of b.drainEvents()) if (e.t === 'ult' && e.src === hero.uid) ult = true;
      }
      expect(ult, h.id).toBe(true);
    }
  });

  it('formation-changing ultimates move units between rows', () => {
    const check = (id: string, enemySide: boolean, lineup = [id, 'sol', 'magna', 'charmy', 'gordon']) => {
      const b = new Battle(team(lineup, 20), team(['golem', 'bandit', 'bandit_mage', 'acolyte', 'magic_beast'], 20), 11);
      b.start();
      const u = b.units.find((x) => x.def.id === id && x.side === 0)!;
      // injure the front line so rescue / fortify have something to do
      for (const x of b.units) if (x.side === 0 && x.row === 'front' && x !== u) x.hp = Math.round(x.maxHp * 0.2);
      u.energy = 100;
      b.requestUlt(u.uid);
      b.step(0.05);
      const moves = b.drainEvents().filter((e) => e.t === 'move');
      expect(moves.length, id).toBeGreaterThan(0);
      const movedSides = moves.map((m) => (m.t === 'move' ? b.unit(m.target)!.side : -1));
      expect(movedSides.includes(enemySide ? 1 : 0), id).toBe(true);
    };
    check('finral', false);
    check('henry', false, ['charmy', 'sol', 'henry', 'magna', 'gordon']);
    check('valtos', true);
    check('langris', true);
    check('charlotte', true);
  });

  it('every summonable hero has a complete kit', () => {
    expect(SUMMONABLE.length).toBeGreaterThanOrEqual(30);
    for (const h of SUMMONABLE) {
      expect(h.ultimate.effects.length, h.id).toBeGreaterThan(0);
      expect(h.passive.desc.length, h.id).toBeGreaterThan(5);
      expect(h.formation.front || h.formation.back, h.id).toBeTruthy();
    }
  });
});
