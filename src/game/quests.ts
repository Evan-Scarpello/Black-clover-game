import type { Reward, SaveState } from './state';
import { today } from './state';
import type { GameEvent } from './store';

export interface QuestDef {
  id: string;
  text: string;
  goal: number;
  reward: Reward;
  /** Campaign stages that must be cleared before the quest is offered (its feature unlocks). */
  unlockStage?: number;
  /** Only offered once the player has joined a clan. */
  needsClan?: boolean;
}

export const DAILY_QUESTS: QuestDef[] = [
  { id: 'login', text: 'Report to the Black Bulls hideout', goal: 1, reward: { gems: 50, passXp: 10 } },
  { id: 'afk', text: 'Collect AFK rewards', goal: 1, reward: { gems: 50, yul: 2000, passXp: 10 } },
  { id: 'win', text: 'Win 5 battles', goal: 5, reward: { gems: 100, essence: 2000, passXp: 20 } },
  { id: 'summon', text: 'Summon 3 heroes', goal: 3, reward: { gems: 100, tickets: 1, passXp: 20 } },
  { id: 'levelup', text: 'Level up heroes 5 times', goal: 5, reward: { gems: 50, yul: 3000, passXp: 10 } },
  { id: 'ult', text: 'Unleash 10 ultimates', goal: 10, reward: { gems: 50, essence: 1500, passXp: 10 } },
  { id: 'shop', text: 'Grab a deal or the free gift in the Shop', goal: 1, reward: { yul: 3000, passXp: 10 } },
  { id: 'mission', text: 'Send a squad on a Magic Knight mission', goal: 1, reward: { essence: 2000, passXp: 15 }, unlockStage: 3 },
  { id: 'tower', text: 'Clear a Tower of Trials floor', goal: 1, reward: { gems: 50, passXp: 15 }, unlockStage: 5 },
  { id: 'arena', text: 'Fight 2 Arena battles', goal: 2, reward: { gems: 50, medals: 50, passXp: 20 }, unlockStage: 10 },
  { id: 'raid', text: 'Attack the Clan Raid boss', goal: 1, reward: { gems: 50, crests: 50, passXp: 20 }, unlockStage: 15, needsClan: true },
];

export const BONUS_QUEST: QuestDef = { id: 'all', text: 'Complete every daily quest', goal: DAILY_QUESTS.length, reward: { gems: 200, tickets: 1, passXp: 30 } };

/** 'feature' event names (emitGameEvent({type:'feature', name})) that progress a daily quest.
 * 'mission' = a Magic Knight mission was started (claiming one emits 'dispatch', which doesn't count). */
export const FEATURE_QUESTS: Record<string, string> = { shop: 'shop', mission: 'mission' };

export function refreshDay(s: SaveState, now = Date.now()) {
  const d = today(now);
  if (s.quests.day !== d) s.quests = { day: d, progress: {}, claimed: [] };
  if (s.fastRewards.day !== d) s.fastRewards = { day: d, used: 0 };
  if (!s.quests.progress.login) s.quests.progress.login = 1;
}

export function bump(s: SaveState, id: string, n = 1) {
  // The app can stay open past midnight: start the new day before counting.
  if (s.quests.day !== today()) refreshDay(s);
  if (!(n > 0)) return;
  s.quests.progress[id] = (s.quests.progress[id] ?? 0) + n;
}

/** Quests whose feature isn't open yet. They count as done for the bonus quest. */
export function questLocked(s: SaveState, q: QuestDef): boolean {
  if ((q.unlockStage ?? 0) > (s.stage ?? 0)) return true;
  return !!q.needsClan && !s.clan?.clanId;
}

/** Short reason a quest isn't available, e.g. "Clear 10 stages". */
export function questLockReason(s: SaveState, q: QuestDef): string {
  if ((q.unlockStage ?? 0) > (s.stage ?? 0)) return `Clear ${q.unlockStage} stages`;
  if (q.needsClan && !s.clan?.clanId) return 'Join a clan';
  return '';
}

export function questProgress(s: SaveState, q: QuestDef): number {
  if (q.id === 'all') return DAILY_QUESTS.filter((d) => s.quests.claimed.includes(d.id) || questLocked(s, d)).length;
  return Math.min(q.goal, s.quests.progress[q.id] ?? 0);
}

export function claimable(s: SaveState, q: QuestDef): boolean {
  return !s.quests.claimed.includes(q.id) && !questLocked(s, q) && questProgress(s, q) >= q.goal;
}

/** Progress daily quests from game events (registered by the progression feature). */
export function applyQuestEvent(s: SaveState, e: GameEvent) {
  if (e.type === 'battle') {
    if (e.kind === 'arena') bump(s, 'arena');
    if (e.kind === 'raid') bump(s, 'raid');
    if (e.kind === 'tower' && e.won) bump(s, 'tower');
    // Campaign wins are already counted by recordBattle in the store.
    if (e.kind !== 'campaign' && e.won) bump(s, 'win');
  } else if (e.type === 'feature') {
    const id = Object.prototype.hasOwnProperty.call(FEATURE_QUESTS, e.name) ? FEATURE_QUESTS[e.name] : undefined;
    if (id) bump(s, id);
  }
}
