import { describe, expect, it } from 'vitest';
import { getBanners, summon, PITY_LEGENDARY, PITY_MYTHIC } from '../src/game/gacha';
import { newSave } from '../src/game/state';
import { rng } from '../src/game/rng';
import { RARITY_INFO } from '../src/game/stats';
import { getStage, afkRates } from '../src/data/campaign';
import { teamPower } from '../src/game/power';

describe('gacha', () => {
  it('first 10-pull guarantees a Legendary or better', () => {
    for (let seed = 0; seed < 50; seed++) {
      const s = newSave(0);
      const res = summon(s, getBanners(0)[1], 10, rng(seed), 0);
      expect(res.some((r) => RARITY_INFO[r.hero.rarity].order >= 2)).toBe(true);
    }
  });

  it('every 10-pull has at least one Epic+', () => {
    const s = newSave(0);
    s.gacha.firstTen = true;
    for (let seed = 0; seed < 200; seed++) {
      const res = summon(s, getBanners(0)[1], 10, rng(seed), 0);
      expect(res.some((r) => r.hero.rarity !== 'R')).toBe(true);
    }
  });

  it('pity counters cap the drought', () => {
    const s = newSave(0);
    s.gacha.firstTen = true;
    const r = rng(99);
    let sinceLeg = 0;
    let sinceMyth = 0;
    let maxLeg = 0;
    let maxMyth = 0;
    for (let i = 0; i < 3000; i++) {
      const [res] = summon(s, getBanners(0)[0], 1, r, 0);
      sinceLeg = RARITY_INFO[res.hero.rarity].order >= 2 ? 0 : sinceLeg + 1;
      sinceMyth = res.hero.rarity === 'UR' ? 0 : sinceMyth + 1;
      maxLeg = Math.max(maxLeg, sinceLeg);
      maxMyth = Math.max(maxMyth, sinceMyth);
    }
    expect(maxLeg).toBeLessThan(PITY_LEGENDARY);
    expect(maxMyth).toBeLessThan(PITY_MYTHIC);
  });

  it('duplicates convert into shards', () => {
    const s = newSave(0);
    s.gacha.firstTen = true;
    const res = summon(s, getBanners(0)[1], 10, rng(5), 0).concat(summon(s, getBanners(0)[1], 10, rng(6), 0));
    const dupes = res.filter((r) => !r.isNew);
    expect(dupes.length).toBeGreaterThan(0);
    const totalShards = Object.values(s.heroes).reduce((a, h) => a + h.shards, 0);
    expect(totalShards).toBe(dupes.reduce((a, d) => a + d.shards, 0));
  });
});

describe('campaign', () => {
  it('stages get harder and AFK income grows', () => {
    expect(teamPower(getStage(50).team)).toBeGreaterThan(teamPower(getStage(10).team));
    expect(afkRates(50).yul).toBeGreaterThan(afkRates(0).yul);
  });
  it('boss stages contain exactly one boss', () => {
    for (const i of [9, 19, 49, 89, 99]) {
      expect(getStage(i).team.members.filter((m) => m.boss).length).toBe(1);
      expect(getStage(i).team.members.length).toBe(5);
    }
  });
});
