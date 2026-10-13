// Campaign stage → BattleSpec. Owns what a campaign win records and shows.
import { getStage } from '../../data/campaign';
import { playerTeam, recordBattle } from '../../game/store';
import type { BattleSpec, Nav } from '../../ui/nav';

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
      const r = recordBattle(stage, won, b.ultsCast[0]);
      const notes: string[] = [];
      if (r?.firstClear) notes.push('First clear bonus');
      if (r?.unlockedFormation) notes.push(`New formation: ${r.unlockedFormation}`);
      return {
        won,
        reward: r ? { yul: r.yul, essence: r.essence, gems: r.gems, tickets: r.tickets } : null,
        notes,
        next: won ? { label: 'Next Stage', auto: true, go: () => nav.fight(stage + 1) } : undefined,
      };
    },
  };
}
