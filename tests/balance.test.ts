// Balance report — run with: DBG=1 npx vitest run tests/balance.test.ts
// or override difficulty: DBG='{"base":1.8}' npx vitest run tests/balance.test.ts
import { it } from 'vitest';
import { Battle, type TeamSetup } from '../src/game/battle';
import { FORMATION_MAP } from '../src/data/formations';
import { getHero } from '../src/data/heroes';
import { DIFFICULTY, getStage } from '../src/data/campaign';
import { RARITY_INFO } from '../src/game/stats';
const team = (ids: string[], level: number, ex = 0): TeamSetup => ({
  formation: FORMATION_MAP['balanced'],
  members: ids.map((heroId, slot) => ({ heroId, slot, level, stars: Math.min(7, RARITY_INFO[getHero(heroId).rarity].startStars + ex) })),
});
function wr(t: TeamSetup, s: number, n = 6) { let w = 0; for (let i = 0; i < n; i++) if (new Battle(t, getStage(s).team, 100 + i).runToEnd() === 0) w++; return w / n; }
function maxStage(t: TeamSetup) { let best = -1; for (let s = 0; s < 140; s++) { if (wr(t, s) >= 0.5) best = s; else if (s > best + 3) break; } return best; }
it.runIf(!!process.env.DBG)('dbg', () => {
  const params = JSON.parse(process.env.DBG === "1" ? "{}" : process.env.DBG!);
  Object.assign(DIFFICULTY, params);
  const starter = ['sol', 'asta', 'magna', 'finral', 'charmy'];
  const mid = ['noelle', 'asta', 'luck', 'finral', 'mimosa'];
  const strong = ['noelle', 'asta', 'yami', 'yuno', 'william'];
  // Mythic squads: the original five Mythics vs. the five added with the Devil Union update.
  const oldUR = ['asta', 'yami', 'yuno', 'julius', 'lucius'];
  const newUR = ['nacht', 'liebe', 'lucifero', 'zagred', 'lumiere'];
  const out: string[] = [JSON.stringify(params)];
  for (const [lvl, ex] of [[1, 0], [5, 0], [10, 0], [20, 1], [30, 1], [50, 2], [80, 3]]) {
    out.push(
      `L${lvl}+${ex}: starter ${maxStage(team(starter, lvl, ex))} mid ${maxStage(team(mid, lvl, ex))} strong ${maxStage(team(strong, lvl, ex))}` +
        ` | oldUR ${maxStage(team(oldUR, lvl, ex))} newUR ${maxStage(team(newUR, lvl, ex))}`,
    );
  }
  console.log(out.join('\n'));
}, 300000);
