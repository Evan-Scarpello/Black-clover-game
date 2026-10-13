import { describe, expect, it } from 'vitest';
import { CHAPTERS, STAGES_PER_CHAPTER, getStage } from '../src/data/campaign';
import { FORMATION_MAP } from '../src/data/formations';
import { campaignBattle } from '../src/features/campaign/adapter';
import {
  BOSS_R,
  MAP_W,
  NODE_R,
  REGION_H,
  buildRegionLayout,
  mapHeight,
  nodeMapPos,
  regionLayout,
  regionTop,
  topChapterFor,
} from '../src/features/campaign/mapLayout';
import { defaultCampaign, type CampaignSave } from '../src/features/campaign/state';
import {
  CHAPTER_MAX_STARS,
  CHEST_STARS,
  STAR_TIME_LIMIT,
  TWO_STAR_TIME,
  campaignBadge,
  chapterStars,
  chestReward,
  chestStatus,
  claimChest,
  computeStars,
  ensureCampaign,
  readyChests,
  recordStars,
  sanitizeCampaign,
  stageStars,
  starString,
  starsFromBattle,
  totalStars,
} from '../src/features/campaign/stars';
import { powerVerdict } from '../src/features/campaign/verdict';
import { Battle, OVERTIME, type TeamSetup } from '../src/game/battle';
import { newSave } from '../src/game/state';
import { getState, onGameEvent, replaceState } from '../src/game/store';
import type { Nav } from '../src/ui/nav';

const fullStars = (c: CampaignSave, from: number, to: number, n: number) => {
  for (let i = from; i < to; i++) c.stars[String(i)] = n;
};

describe('star rating', () => {
  it('follows the documented rule', () => {
    expect(computeStars({ won: false, fallen: 0, time: 10 })).toBe(0);
    expect(computeStars({ won: true, fallen: 0, time: 20 })).toBe(3);
    expect(computeStars({ won: true, fallen: 0, time: STAR_TIME_LIMIT })).toBe(3);
    expect(computeStars({ won: true, fallen: 0, time: STAR_TIME_LIMIT + 0.1 })).toBe(2);
    expect(computeStars({ won: true, fallen: 1, time: 10 })).toBe(2);
    expect(computeStars({ won: true, fallen: 1, time: TWO_STAR_TIME })).toBe(2);
    expect(computeStars({ won: true, fallen: 0, time: TWO_STAR_TIME + 1 })).toBe(1);
    expect(computeStars({ won: true, fallen: 2, time: 10 })).toBe(1);
    expect(computeStars({ won: true, fallen: 4, time: 89 })).toBe(1);
    // 3★ ends exactly when overtime starts.
    expect(STAR_TIME_LIMIT).toBe(OVERTIME);
  });

  it('reads a finished battle (only player-side knockouts count)', () => {
    const units = (down: number, enemyDown: number) => [
      ...Array.from({ length: 5 }, (_, i) => ({ side: 0 as const, alive: i >= down })),
      ...Array.from({ length: 5 }, (_, i) => ({ side: 1 as const, alive: i >= enemyDown })),
    ];
    expect(starsFromBattle({ winner: 0, time: 30, units: units(0, 5) })).toBe(3);
    expect(starsFromBattle({ winner: 0, time: 30, units: units(1, 5) })).toBe(2);
    expect(starsFromBattle({ winner: 0, time: 60, units: units(0, 5) })).toBe(2);
    expect(starsFromBattle({ winner: 0, time: 75, units: units(0, 5) })).toBe(1);
    expect(starsFromBattle({ winner: 0, time: 30, units: units(3, 5) })).toBe(1);
    expect(starsFromBattle({ winner: 1, time: 30, units: units(5, 0) })).toBe(0);
    expect(starsFromBattle({ winner: null, time: 90, units: units(0, 0) })).toBe(0);
  });

  it('formats star strings', () => {
    expect(starString(3)).toBe('★★★');
    expect(starString(1)).toBe('★☆☆');
    expect(starString(0)).toBe('☆☆☆');
    expect(starString(9)).toBe('★★★');
  });

  it('an overpowered squad can earn 3 stars in a real fight', () => {
    const team: TeamSetup = {
      formation: FORMATION_MAP.balanced,
      members: ['asta', 'yuno', 'yami', 'noelle', 'mimosa'].map((heroId, slot) => ({ heroId, level: 60, stars: 5, slot })),
    };
    const b = new Battle(team, getStage(0).team, 1234);
    b.runToEnd();
    expect(b.winner).toBe(0);
    expect(starsFromBattle(b)).toBe(3);
  });
});

describe('best-star persistence', () => {
  it('keeps the best rating', () => {
    const c = defaultCampaign();
    expect(recordStars(c, 4, 2)).toEqual({ prev: 0, best: 2, improved: true });
    expect(recordStars(c, 4, 1)).toEqual({ prev: 2, best: 2, improved: false });
    expect(c.stars['4']).toBe(2);
    expect(recordStars(c, 4, 3)).toEqual({ prev: 2, best: 3, improved: true });
    expect(c.stars['4']).toBe(3);
    expect(recordStars(c, 4, 0).best).toBe(3);
    expect(c.stars['4']).toBe(3);
  });

  it('treats stages cleared before stars existed as 1★', () => {
    const c = defaultCampaign();
    expect(stageStars(c, 10, 3)).toBe(1);
    expect(recordStars(c, 3, 1, 10)).toEqual({ prev: 1, best: 1, improved: false });
    expect(recordStars(c, 3, 2, 10)).toEqual({ prev: 1, best: 2, improved: true });
    expect(stageStars(c, 10, 3)).toBe(2);
  });

  it('shows 0 stars for uncleared stages, even with stale data', () => {
    const c = defaultCampaign();
    c.stars['12'] = 3;
    expect(stageStars(c, 12, 12)).toBe(0);
    expect(stageStars(c, 13, 12)).toBe(3);
    expect(stageStars(undefined, 5, 2)).toBe(1);
  });

  it('clamps junk values from damaged saves', () => {
    const c = defaultCampaign();
    (c.stars as any)['1'] = 'lots';
    (c.stars as any)['2'] = 99;
    (c.stars as any)['3'] = -4;
    expect(stageStars(c, 10, 1)).toBe(1);
    expect(stageStars(c, 10, 2)).toBe(3);
    expect(stageStars(c, 10, 3)).toBe(1);
    const broken = { stars: null, chests: [1, 2] } as any;
    sanitizeCampaign(broken);
    expect(broken).toEqual({ stars: {}, chests: {} });
    const s: { campaign?: CampaignSave } = {};
    expect(ensureCampaign(s)).toEqual({ stars: {}, chests: {} });
    expect(s.campaign).toBeDefined();
  });

  it('sums chapter and total stars', () => {
    const c = defaultCampaign();
    fullStars(c, 0, 10, 3);
    fullStars(c, 10, 15, 2);
    expect(chapterStars(c, 15, 0)).toBe(CHAPTER_MAX_STARS);
    expect(chapterStars(c, 15, 1)).toBe(10);
    expect(chapterStars(c, 15, 2)).toBe(0);
    expect(totalStars(c, 15)).toBe(40);
    expect(totalStars(c, 0)).toBe(0);
  });
});

describe('campaign adapter', () => {
  const nav = { fight: () => {} } as unknown as Nav;
  const fake = (won: boolean, down: number, time: number) =>
    ({
      winner: won ? 0 : 1,
      time,
      ultsCast: [1, 0],
      units: [
        ...Array.from({ length: 5 }, (_, i) => ({ side: 0, alive: i >= down })),
        ...Array.from({ length: 5 }, () => ({ side: 1, alive: !won })),
      ],
    }) as any;

  it('records stars on a win and keeps the existing outcome', () => {
    const save = newSave(0);
    save.stage = 5;
    replaceState(save);
    const events: any[] = [];
    onGameEvent((e) => events.push(e));

    const out = campaignBattle(5, nav).finish(fake(true, 1, 40));
    const s = getState();
    expect(out.won).toBe(true);
    expect(s.stage).toBe(6);
    expect(s.campaign.stars['5']).toBe(2);
    expect(out.notes).toContain('★★☆');
    expect(out.notes).toContain('First clear bonus');
    expect(out.reward?.gems).toBe(getStage(5).firstClear.gems);
    expect(out.next?.auto).toBe(true);
    expect(events.some((e) => e.type === 'feature' && e.name === 'campaignStars' && e.amount === 2)).toBe(true);

    // Replay with a worse result: best stays, no first-clear gems.
    const replay = campaignBattle(5, nav).finish(fake(true, 3, 80));
    expect(s.campaign.stars['5']).toBe(2);
    expect(replay.notes).toContain('★☆☆');
    expect(replay.notes).not.toContain('New star record!');
    expect(replay.reward?.gems).toBe(0);

    // Flawless replay: new record.
    const best = campaignBattle(5, nav).finish(fake(true, 0, 30));
    expect(s.campaign.stars['5']).toBe(3);
    expect(best.notes).toContain('New star record!');
    expect(best.notes!.some((n) => n.startsWith('3★:'))).toBe(false);
  });

  it('records nothing on a loss', () => {
    const save = newSave(0);
    save.stage = 2;
    replaceState(save);
    const out = campaignBattle(2, nav).finish(fake(false, 5, 90));
    expect(out.won).toBe(false);
    expect(getState().stage).toBe(2);
    expect(getState().campaign.stars['2']).toBeUndefined();
  });

  it('survives a save without the campaign slice', () => {
    const save = newSave(0) as any;
    delete save.campaign;
    save.stage = 0;
    replaceState(save);
    campaignBattle(0, nav).finish(fake(true, 0, 20));
    expect(getState().campaign.stars['0']).toBe(3);
  });
});

describe('chapter star chests', () => {
  it('unlocks at 10 / 20 / 30 stars', () => {
    const c = defaultCampaign();
    fullStars(c, 0, 10, 1); // 10★ in chapter 1
    expect(chestStatus(c, 10, 0, 0)).toBe('ready');
    expect(chestStatus(c, 10, 0, 1)).toBe('locked');
    fullStars(c, 0, 10, 2);
    expect(chestStatus(c, 10, 0, 1)).toBe('ready');
    expect(chestStatus(c, 10, 0, 2)).toBe('locked');
    fullStars(c, 0, 10, 3);
    expect(chestStatus(c, 10, 0, 2)).toBe('ready');
    expect(chestStatus(c, 10, 0, 3)).toBe('locked');
    expect(chestStatus(c, 10, 0, -1)).toBe('locked');
  });

  it('counts only cleared stages', () => {
    const c = defaultCampaign();
    fullStars(c, 0, 10, 3);
    // Only 3 stages actually cleared (e.g. stale data): 9★ is not enough.
    expect(chapterStars(c, 3, 0)).toBe(9);
    expect(chestStatus(c, 3, 0, 0)).toBe('locked');
    expect(claimChest(c, 3, 0, 0)).toBeNull();
  });

  it('claims once and records it', () => {
    const c = defaultCampaign();
    fullStars(c, 0, 20, 3);
    const r = claimChest(c, 20, 1, 0);
    expect(r).toEqual(chestReward(1, 0));
    expect(c.chests['1']).toEqual([0]);
    expect(chestStatus(c, 20, 1, 0)).toBe('claimed');
    expect(claimChest(c, 20, 1, 0)).toBeNull();
    claimChest(c, 20, 1, 2);
    claimChest(c, 20, 1, 1);
    expect(c.chests['1']).toEqual([0, 1, 2]);
  });

  it('lists ready chests and drives the badge', () => {
    const c = defaultCampaign();
    expect(readyChests(c, 0)).toEqual([]);
    expect(campaignBadge({ stage: 0, campaign: c })).toBe(false);
    fullStars(c, 0, 10, 2);
    fullStars(c, 10, 20, 1);
    expect(readyChests(c, 20)).toEqual([
      { chapter: 0, tier: 0 },
      { chapter: 0, tier: 1 },
      { chapter: 1, tier: 0 },
    ]);
    expect(campaignBadge({ stage: 20, campaign: c })).toBe(true);
    for (const { chapter, tier } of readyChests(c, 20)) claimChest(c, 20, chapter, tier);
    expect(campaignBadge({ stage: 20, campaign: c })).toBe(false);
    // Old saves (no slice) still work: every cleared stage counts as 1★.
    expect(campaignBadge({ stage: 10 })).toBe(true);
  });

  it('scales rewards with the chapter and the tier', () => {
    for (let ch = 0; ch < 20; ch++) {
      for (let t = 0; t < CHEST_STARS.length; t++) {
        const r = chestReward(ch, t);
        expect(r.gems).toBeGreaterThan(0);
        expect(r.gems!).toBeGreaterThanOrEqual(chestReward(Math.max(0, ch - 1), t).gems!);
        if (t > 0) expect(r.gems!).toBeGreaterThan(chestReward(ch, t - 1).gems!);
      }
    }
    expect(chestReward(0, 0).essence).toBeGreaterThan(0);
    expect(chestReward(0, 1).tickets).toBe(1);
    expect(chestReward(0, 2).tickets).toBe(2);
    expect(chestReward(5, 0).essence!).toBeGreaterThan(chestReward(0, 0).essence!);
  });
});

describe('world map layout', () => {
  const chapters = Array.from({ length: 24 }, (_, i) => i);

  it('is deterministic', () => {
    for (const c of chapters) {
      expect(JSON.stringify(buildRegionLayout(c))).toBe(JSON.stringify(buildRegionLayout(c)));
      expect(JSON.stringify(regionLayout(c))).toBe(JSON.stringify(buildRegionLayout(c)));
    }
    expect(regionLayout(3)).toBe(regionLayout(3));
  });

  it('places 10 nodes per chapter climbing upward, boss last', () => {
    for (const c of chapters) {
      const L = regionLayout(c);
      expect(L.nodes).toHaveLength(STAGES_PER_CHAPTER);
      expect(L.theme).toBe(c % CHAPTERS.length);
      expect(L.loop).toBe(Math.floor(c / CHAPTERS.length));
      expect(L.segs).toHaveLength(STAGES_PER_CHAPTER + 1);
      L.nodes.forEach((n, k) => {
        expect(n.index).toBe(c * STAGES_PER_CHAPTER + k);
        expect(n.boss).toBe(k === STAGES_PER_CHAPTER - 1);
        expect(n.r).toBe(n.boss ? BOSS_R : NODE_R);
        expect(n.x - n.r).toBeGreaterThanOrEqual(0);
        expect(n.x + n.r).toBeLessThanOrEqual(MAP_W);
        expect(n.y).toBeGreaterThan(0);
        expect(n.y).toBeLessThan(REGION_H);
        if (k > 0) expect(n.y).toBeLessThan(L.nodes[k - 1].y);
      });
    }
  });

  it('never overlaps nodes', () => {
    for (const c of chapters) {
      const { nodes } = regionLayout(c);
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          expect(d).toBeGreaterThan(nodes[i].r + nodes[j].r + 8);
        }
    }
  });

  it('keeps scenery props off the stage nodes', () => {
    for (const c of chapters) {
      const L = regionLayout(c);
      const props = L.decor.filter((d) => !d.patch).slice(1); // skip the lair behind the boss
      for (const p of props)
        for (const n of L.nodes) expect(Math.hypot(p.x - n.x, p.y - n.y)).toBeGreaterThan(n.r);
    }
  });

  it('stacks regions so the whole path climbs monotonically', () => {
    const top = topChapterFor(57);
    expect(top).toBe(7);
    expect(mapHeight(top)).toBe(regionTop(0, top) + REGION_H);
    let prev = Infinity;
    for (let stage = 0; stage < (top + 1) * STAGES_PER_CHAPTER; stage++) {
      const p = nodeMapPos(stage, top);
      expect(p.y).toBeLessThan(prev);
      expect(p.y).toBeGreaterThan(0);
      prev = p.y;
    }
    expect(topChapterFor(0)).toBe(2);
    expect(topChapterFor(-5)).toBe(2);
  });
});

describe('power verdict', () => {
  it('grades the matchup', () => {
    expect(powerVerdict(1200, 1000).label).toBe('Easy');
    expect(powerVerdict(1000, 1000).label).toBe('Even');
    expect(powerVerdict(850, 1000).label).toBe('Tough');
    expect(powerVerdict(500, 1000).label).toBe('Deadly');
    expect(powerVerdict(0, 0).label).toBe('Deadly');
    expect(powerVerdict(1000, 1000).share).toBeCloseTo(0.5);
  });
});
