import { getHero } from '../data/heroes';
import type { TeamSetup } from './battle';
import { addMods, applyMods, rawStats, statPower } from './stats';
import { teamBonuses } from './team';
import type { StatMods } from './types';

/** Squad combat power including synergies, bonds and formation row bonuses. */
export function teamPower(team: TeamSetup): number {
  const bonus = teamBonuses(team.members.map((m) => m.heroId));
  let total = 0;
  for (const m of team.members) {
    const def = getHero(m.heroId);
    const raw = rawStats(def, m.level, m.stars);
    if (m.mult) {
      raw.hp *= m.mult;
      raw.atk *= m.mult;
      raw.def *= m.mult;
    }
    if (m.boss) {
      raw.hp *= 3.5;
      raw.atk *= 1.25;
    }
    const row = team.formation.rows[m.slot] ?? 'back';
    const mods: StatMods = {};
    addMods(mods, def.passive.stats);
    addMods(mods, bonus.perHero[m.heroId]);
    addMods(mods, team.bonus);
    addMods(mods, team.formation[row]);
    addMods(mods, def.formation[row]);
    total += statPower(applyMods(raw, mods)) * (1 + 0.05 * ({ R: 0, SR: 1, SSR: 2, UR: 3 } as const)[def.rarity]);
  }
  return Math.round(total);
}
