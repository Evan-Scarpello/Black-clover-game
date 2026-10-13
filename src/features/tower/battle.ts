// Tower floor → BattleSpec. Owns what a tower fight records and shows.
import { getHero } from '../../data/heroes';
import { bump } from '../../game/quests';
import { commit, emitGameEvent, getState, grantReward, playerTeam } from '../../game/store';
import type { BattleOutcome, BattleSpec, Nav } from '../../ui/nav';
import { isFirstClear, towerFloor } from './logic';

export function towerBattle(floor: number, nav: Nav): BattleSpec {
  const info = towerFloor(floor);
  return {
    key: `tower-${floor}-${Date.now()}`,
    kind: 'tower',
    label: `Floor ${floor}`,
    // Short: the battle header shows it after the gold label and truncates long text.
    title: info.twist ? 'Trial' : info.isBoss ? getHero(info.leader).name.split(' ')[0] : 'Tower',
    theme: info.theme,
    ally: playerTeam(),
    enemy: info.team,
    banner: info.banner,
    finish: (b) => recordTowerBattle(floor, b.winner === 0, b.ultsCast[0], nav),
  };
}

/** Apply a finished tower fight to the save and describe the result screen. */
export function recordTowerBattle(floor: number, won: boolean, ults: number, nav: Nav): BattleOutcome {
  const s = getState();
  const info = towerFloor(floor);
  const first = won && isFirstClear(s.tower.floor, floor);
  s.stats.battles++;
  s.stats.ults += ults;
  // Ultimates count toward the daily quest here; wins and the tower quest are counted by the
  // progression listener from the battle event below.
  bump(s, 'ult', ults);
  if (won) s.stats.wins++;
  if (first) {
    s.tower.floor = floor;
    grantReward(info.reward);
  }
  emitGameEvent({ type: 'battle', kind: 'tower', won });
  commit();

  const notes: string[] = [];
  if (first) notes.push(`Floor ${floor} cleared!`);
  else if (won) notes.push('Replay: no rewards');
  if (first && info.milestone) notes.push('Milestone reward');
  if (info.twist) notes.push(info.twist.name);
  return {
    won,
    title: first ? 'CLEARED!' : undefined,
    reward: first ? info.reward : null,
    notes,
    next: won ? { label: `Floor ${floor + 1}`, go: () => nav.battle(towerBattle(floor + 1, nav)) } : undefined,
  };
}
