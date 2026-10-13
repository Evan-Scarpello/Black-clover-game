// Store-bound mission actions: each one mutates the save, then commits once.
import { today } from '../../game/state';
import { canAfford, commit, emitGameEvent, getState, grantReward, pay } from '../../game/store';
import {
  claimMission,
  defOf,
  finishNowCost,
  missionStatus,
  quickAssign,
  recallMission,
  refreshBoard,
  remainingMs,
  rushMission,
  startMission,
  type StartCheck,
} from './logic';
import type { MissionReward } from './state';

/** Load today's board if the day rolled over (or on first visit). */
export function ensureBoard(now = Date.now()): boolean {
  const s = getState();
  if (!refreshBoard(s.dispatch, today(now), s.stage)) return false;
  commit();
  return true;
}

export function startDispatch(id: string, heroIds: string[], now = Date.now()): StartCheck {
  const s = getState();
  const res = startMission(s.dispatch, id, heroIds, s.heroes, now);
  if (res.ok) {
    emitGameEvent({ type: 'feature', name: 'mission' });
    commit();
  }
  return res;
}

function addReward(into: MissionReward, r: MissionReward) {
  for (const k of ['yul', 'essence', 'gems', 'tickets'] as const) if (r[k]) into[k] = (into[k] ?? 0) + r[k]!;
  for (const [id, n] of Object.entries(r.shards ?? {})) {
    into.shards = into.shards ?? {};
    into.shards[id] = (into.shards[id] ?? 0) + n;
  }
}

/** Claim every finished mission (or just `only`). Returns the combined reward, or null if nothing was ready. */
export function claimDispatch(now = Date.now(), only?: string): { reward: MissionReward; count: number } | null {
  const s = getState();
  const total: MissionReward = {};
  let count = 0;
  for (const m of [...s.dispatch.missions]) {
    if (only && m.id !== only) continue;
    const r = claimMission(s.dispatch, m.id, now);
    if (!r) continue;
    grantReward(r);
    addReward(total, r);
    emitGameEvent({ type: 'feature', name: 'dispatch' });
    count++;
  }
  if (!count) return null;
  commit();
  return { reward: total, count };
}

export function rushCost(id: string, now = Date.now()): number | null {
  const d = getState().dispatch;
  const m = d.missions.find((x) => x.id === id);
  const def = defOf(d, id);
  if (!m || !def || missionStatus(m, def, now) !== 'active') return null;
  return finishNowCost(remainingMs(m, def, now));
}

/** Pay gems to finish now, then claim. */
export function rushDispatch(id: string, now = Date.now()): { reward: MissionReward; count: number } | { error: string } {
  const cost = rushCost(id, now);
  if (cost === null) return { error: 'That mission is not running.' };
  if (!canAfford({ gems: cost })) return { error: `Not enough Gems (${cost} needed).` };
  const s = getState();
  if (rushMission(s.dispatch, id, now) === null) return { error: 'That mission is not running.' };
  pay({ gems: cost });
  // claimDispatch commits (the mission is ready now).
  return claimDispatch(now, id) ?? { error: 'Could not claim.' };
}

export function recallDispatch(id: string, now = Date.now()): boolean {
  if (!recallMission(getState().dispatch, id, now)) return false;
  commit();
  return true;
}

/** Auto-assign and start every idle mission it can. Returns how many started. */
export function quickDispatch(now = Date.now()): number {
  const s = getState();
  const plan = quickAssign(s.dispatch, s.heroes, now);
  let started = 0;
  for (const [id, heroes] of Object.entries(plan)) {
    if (!startMission(s.dispatch, id, heroes, s.heroes, now).ok) continue;
    emitGameEvent({ type: 'feature', name: 'mission' });
    started++;
  }
  if (started) commit();
  return started;
}
