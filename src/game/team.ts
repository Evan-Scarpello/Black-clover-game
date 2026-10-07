import { BONDS, FACTIONS, type BondDef, type FactionInfo, type SynergyTier } from '../data/formations';
import { getHero } from '../data/heroes';
import { addMods } from './stats';
import type { StatMods } from './types';

export interface ActiveSynergy {
  faction: FactionInfo;
  count: number;
  tier: SynergyTier | null;
  next: SynergyTier | null;
}

export interface TeamBonus {
  synergies: ActiveSynergy[];
  bonds: BondDef[];
  perHero: Record<string, StatMods>;
}

/** Faction synergies (members of that faction) and bonds (bond members) for a lineup. */
export function teamBonuses(heroIds: string[]): TeamBonus {
  const ids = [...new Set(heroIds)];
  const perHero: Record<string, StatMods> = Object.fromEntries(ids.map((id) => [id, {}]));
  const synergies: ActiveSynergy[] = [];
  for (const f of FACTIONS) {
    const members = ids.filter((id) => getHero(id).faction === f.id);
    if (!members.length) continue;
    const tier = [...f.tiers].reverse().find((t) => members.length >= t.count) ?? null;
    const next = f.tiers.find((t) => members.length < t.count) ?? null;
    synergies.push({ faction: f, count: members.length, tier, next });
    if (tier) for (const m of members) addMods(perHero[m], tier.mods);
  }
  synergies.sort((a, b) => b.count - a.count);
  const bonds = BONDS.filter((b) => b.heroes.filter((h) => ids.includes(h)).length >= b.min);
  for (const b of bonds) for (const h of b.heroes) if (perHero[h]) addMods(perHero[h], b.mods);
  return { synergies, bonds, perHero };
}
