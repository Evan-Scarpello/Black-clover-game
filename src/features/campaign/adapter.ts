// Campaign stage → BattleSpec. Owns what a campaign win records and shows.
import { getStage } from '../../data/campaign';
import { emitGameEvent, getState, playerTeam, recordBattle } from '../../game/store';
import type { BattleSpec, Nav } from '../../ui/nav';
import { MAX_STAGE_STARS, STAR_TIME_LIMIT, ensureCampaign, recordStars, starString, starsFromBattle } from './stars';

export function campaignBattle(stage: number, nav: Nav): BattleSpec {
  const info = getStage(stage);
  return {
    key: `campaign-${stage}`,
    kind: 'campaign',
    label: info.label,
    title: info.name,
    theme: { sky: info.chapter.sky, ground: info.chapter.ground },
    ally: playerTeam(),
    enemy: info.team,
    banner: info.isBoss ? 'BOSS BATTLE!' : 'FIGHT!',
    allowAutoAdvance: true,
    finish: (b) => {
      const won = b.winner === 0;
      // Stars go into the save before recordBattle, which commits once for both.
      // Rule (see stars.ts): 3★ nobody down within 60s · 2★ at most one down · 1★ any win.
      const stars = won ? starsFromBattle(b) : 0;
      let star: ReturnType<typeof recordStars> | null = null;
      if (won) {
        const s = getState();
        star = recordStars(ensureCampaign(s), stage, stars, s.stage);
        // amount = stars gained on this stage (best - previous best).
        if (star.improved) emitGameEvent({ type: 'feature', name: 'campaignStars', amount: star.best - star.prev });
      }
      const r = recordBattle(stage, won, b.ultsCast[0]);
      const notes: string[] = [];
      if (won) notes.push(starString(stars));
      if (star?.improved && star.prev > 0) notes.push('New star record!');
      if (r?.firstClear) notes.push('First clear bonus');
      if (r?.unlockedFormation) notes.push(`New formation: ${r.unlockedFormation}`);
      if (won && stars < MAX_STAGE_STARS && (star?.best ?? 0) < MAX_STAGE_STARS) notes.push(`3★: nobody down, under ${STAR_TIME_LIMIT}s`);
      return {
        won,
        reward: r ? { yul: r.yul, essence: r.essence, gems: r.gems, tickets: r.tickets } : null,
        notes,
        next: won ? { label: 'Next Stage', auto: true, go: () => nav.fight(stage + 1) } : undefined,
      };
    },
  };
}
