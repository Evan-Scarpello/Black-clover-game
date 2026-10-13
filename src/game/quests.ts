import type { Reward, SaveState } from './state';
import { today } from './state';

export interface QuestDef {
  id: string;
  text: string;
  goal: number;
  reward: Reward;
}

export const DAILY_QUESTS: QuestDef[] = [
  { id: 'login', text: 'Report to the Black Bulls hideout', goal: 1, reward: { gems: 50 } },
  { id: 'afk', text: 'Collect AFK rewards', goal: 1, reward: { gems: 50, yul: 2000 } },
  { id: 'win', text: 'Win 5 battles', goal: 5, reward: { gems: 100, essence: 2000 } },
  { id: 'summon', text: 'Summon 3 heroes', goal: 3, reward: { gems: 100, tickets: 1 } },
  { id: 'levelup', text: 'Level up heroes 5 times', goal: 5, reward: { gems: 50, yul: 3000 } },
  { id: 'ult', text: 'Unleash 10 ultimates', goal: 10, reward: { gems: 50, essence: 1500 } },
];

export const BONUS_QUEST: QuestDef = { id: 'all', text: 'Complete every daily quest', goal: DAILY_QUESTS.length, reward: { gems: 200, tickets: 1 } };

export function refreshDay(s: SaveState, now = Date.now()) {
  const d = today(now);
  if (s.quests.day !== d) s.quests = { day: d, progress: {}, claimed: [] };
  if (s.fastRewards.day !== d) s.fastRewards = { day: d, used: 0 };
  if (!s.quests.progress.login) s.quests.progress.login = 1;
}

export function bump(s: SaveState, id: string, n = 1) {
  s.quests.progress[id] = (s.quests.progress[id] ?? 0) + n;
}

export function questProgress(s: SaveState, q: QuestDef): number {
  if (q.id === 'all') return DAILY_QUESTS.filter((d) => s.quests.claimed.includes(d.id)).length;
  return Math.min(q.goal, s.quests.progress[q.id] ?? 0);
}

export function claimable(s: SaveState, q: QuestDef): boolean {
  return !s.quests.claimed.includes(q.id) && questProgress(s, q) >= q.goal;
}
