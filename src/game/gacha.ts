import { SUMMONABLE, getHero } from '../data/heroes';
import type { Rng } from './rng';
import type { SaveState } from './state';
import { RARITY_INFO, SHARDS_PER_DUPE } from './stats';
import type { HeroDef, Rarity } from './types';

export const RATES: Record<Rarity, number> = { UR: 0.015, SSR: 0.085, SR: 0.3, R: 0.6 };
export const PITY_LEGENDARY = 40; // guaranteed Legendary+ within this many pulls
export const PITY_MYTHIC = 100; // guaranteed Mythic within this many pulls
export const COST_SINGLE = 300;
export const COST_TEN = 2700;

export interface Banner {
  id: string;
  name: string;
  tagline: string;
  featured: string[]; // hero ids with rate-up (Mythics first, then Legendaries)
  colors: [string, string];
  /** Short label for the banner tab. */
  tab: string;
  /** Chip text above the banner name. */
  badge: string;
  /** Limited-time event banner (its Mythics are not on the weekly rotation). */
  limited?: boolean;
}

export interface PullResult {
  hero: HeroDef;
  isNew: boolean;
  shards: number;
}

const byRarity = (r: Rarity) => SUMMONABLE.filter((h) => h.rarity === r);

/** The limited Devil Union banner: its two Mythics each take 25% of Mythic pulls. */
export const DEVIL_UNION = {
  id: 'devil-union',
  mythics: ['nacht', 'liebe'],
  legendaries: ['secre', 'jack'],
} as const;

const firstName = (id: string) => getHero(id).name.split(' ')[0];

/** Banners: weekly rotating featured, the limited Devil Union event and the standard pool. */
export function getBanners(now = Date.now()): Banner[] {
  const week = Math.floor(now / (7 * 24 * 3600 * 1000));
  // The limited banner's Mythics stay off the weekly rotation so the two never feature the same hero.
  const limitedIds: readonly string[] = DEVIL_UNION.mythics;
  const urs = byRarity('UR').filter((h) => !limitedIds.includes(h.id));
  const ssrs = byRarity('SSR');
  const ur = urs[week % urs.length];
  const ssrA = ssrs[week % ssrs.length];
  const ssrB = ssrs[(week + 4) % ssrs.length];
  const [m1, m2] = DEVIL_UNION.mythics;
  const [l1, l2] = DEVIL_UNION.legendaries;
  return [
    {
      id: 'featured',
      name: `${ur.name.split(' ')[0]}'s Grimoire`,
      tagline: `Rate-up! 50% of Mythic pulls are ${ur.name}. Featured Legendaries: ${ssrA.name.split(' ')[0]} & ${ssrB.name.split(' ')[0]}.`,
      featured: [ur.id, ssrA.id, ssrB.id],
      colors: [ur.color, '#1b1033'],
      tab: '★ Featured',
      badge: 'RATE UP · THIS WEEK',
    },
    {
      id: DEVIL_UNION.id,
      name: 'Devil Union',
      tagline: `Limited! ${firstName(m1)} and ${firstName(m2)} are 25% of Mythic pulls each. Featured Legendaries: ${firstName(l1)} & ${firstName(l2)}.`,
      featured: [m1, m2, l1, l2],
      colors: ['#7d5cff', '#120a1f'],
      tab: '😈 Limited',
      badge: 'LIMITED · DEVIL UNION',
      limited: true,
    },
    {
      id: 'standard',
      name: 'Grimoire Tower',
      tagline: 'Every Magic Knight and villain can answer the call.',
      featured: [],
      colors: ['#3ddc84', '#102a1c'],
      tab: 'Standard',
      badge: 'ALWAYS OPEN',
    },
  ];
}

function rollRarity(s: SaveState, rand: Rng, forceSRPlus: boolean): Rarity {
  if (s.gacha.mythicPity >= PITY_MYTHIC - 1) return 'UR';
  if (s.gacha.pity >= PITY_LEGENDARY - 1) return rand() < RATES.UR / (RATES.UR + RATES.SSR) ? 'UR' : 'SSR';
  const x = rand();
  if (x < RATES.UR) return 'UR';
  if (x < RATES.UR + RATES.SSR) return 'SSR';
  if (forceSRPlus || x < RATES.UR + RATES.SSR + RATES.SR) return 'SR';
  return 'R';
}

function pickHero(r: Rarity, banner: Banner, rand: Rng): HeroDef {
  const pool = byRarity(r);
  const feat = pool.filter((h) => banner.featured.includes(h.id));
  if (feat.length && rand() < 0.5) return feat[Math.floor(rand() * feat.length)];
  return pool[Math.floor(rand() * pool.length)];
}

/** Perform pulls, mutating the save (pity, roster, shards). Currency is handled by the caller. */
export function summon(s: SaveState, banner: Banner, count: number, rand: Rng, now = Date.now()): PullResult[] {
  const results: PullResult[] = [];
  const firstTen = count === 10 && !s.gacha.firstTen;
  for (let i = 0; i < count; i++) {
    const last = i === count - 1;
    let rarity = rollRarity(s, rand, count === 10 && last && !results.some((r) => r.hero.rarity !== 'R'));
    if (firstTen && last && !results.some((r) => RARITY_INFO[r.hero.rarity].order >= 2) && RARITY_INFO[rarity].order < 2) rarity = 'SSR';
    const hero = pickHero(rarity, banner, rand);
    s.gacha.total++;
    s.gacha.pity = RARITY_INFO[rarity].order >= 2 ? 0 : s.gacha.pity + 1;
    s.gacha.mythicPity = rarity === 'UR' ? 0 : s.gacha.mythicPity + 1;
    const owned = s.heroes[hero.id];
    if (owned) {
      const shards = rarity === 'UR' ? SHARDS_PER_DUPE * 2 : SHARDS_PER_DUPE;
      owned.shards += shards;
      results.push({ hero, isNew: false, shards });
    } else {
      s.heroes[hero.id] = { id: hero.id, level: 1, stars: RARITY_INFO[rarity].startStars, shards: 0, obtainedAt: now };
      results.push({ hero, isNew: true, shards: 0 });
    }
  }
  if (firstTen) s.gacha.firstTen = true;
  return results;
}
