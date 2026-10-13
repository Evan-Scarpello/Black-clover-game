// Store-bound actions for the progression features + the game-event listener that
// feeds the Grimoire Pass and the daily quests. Imported (for its side effect) by
// ./screen.tsx, which the screen registry loads at startup.
import { applyQuestEvent } from '../../game/quests';
import type { Reward } from '../../game/state';
import { canAfford, commit, emitGameEvent, getState, grantReward, onGameEvent, pay, subscribe } from '../../game/store';
import {
  PASS_PREMIUM_COST,
  addPassXp,
  addReward,
  evaluate,
  isEmptyReward,
  applyRefresh,
  claimAchievement,
  claimGift,
  claimLoginDay,
  claimPassTiers,
  ensureProgression,
  ensureShopDay,
  passClaimables,
  passState,
  refreshCost,
  rolloverSeason,
  shopOffer,
  markBought,
  type PassTrack,
  type ShopOffer,
} from './logic';

function startSeason(now: number) {
  const s = getState();
  const leftover = rolloverSeason(s, now);
  if (leftover) grantReward(leftover);
  return leftover;
}

// Feed pass XP and daily quests from everything the player does. The emitter commits.
onGameEvent((e) => {
  const s = getState();
  const now = Date.now();
  applyQuestEvent(s, e);
  startSeason(now);
  addPassXp(s, e, now);
});

// Roll the pass over before anything (e.g. a quest's passXp reward) adds XP to a stale season.
try {
  startSeason(Date.now());
} catch (err) {
  console.error('progression init failed', err);
}

/** Cheap shape check: the store's grantReward writes progression.pass.xp directly. */
function sliceOk(p: any): boolean {
  return !!p && typeof p === 'object' && !!p.pass && typeof p.pass === 'object' && Number.isFinite(p.pass.xp) && Array.isArray(p.pass.claimedFree) && !!p.login && !!p.shop && Array.isArray(p.achievements);
}

// A swapped-in save (cloud copy) may carry an old or damaged slice: repair it in memory
// before anything writes to it. Persisted with the next commit.
subscribe(() => {
  const s = getState();
  if (!sliceOk(s.progression)) ensureProgression(s);
});

/** Bring day/season-based state up to date when a page opens. Commits only on change. */
export function syncProgression(now = Date.now()) {
  const s = getState();
  const before = JSON.stringify(s.progression);
  startSeason(now);
  ensureShopDay(s, now);
  if (JSON.stringify(s.progression) !== before) commit();
}

// ───────── login ─────────

export function claimLogin(now = Date.now()): { reward: Reward; index: number; cycle: number } | null {
  const s = getState();
  const r = claimLoginDay(s, now);
  if (!r) return null;
  grantReward(r.reward);
  emitGameEvent({ type: 'feature', name: 'login' });
  commit();
  return r;
}

// ───────── pass ─────────

export function claimPass(list: { track: PassTrack; tier: number }[], now = Date.now()): Reward | null {
  const s = getState();
  startSeason(now);
  const r = claimPassTiers(s, list, now);
  if (!r) return null;
  grantReward(r);
  commit();
  return r;
}

export function claimAllPass(now = Date.now()): Reward | null {
  startSeason(now);
  return claimPass(passClaimables(passState(getState(), now)), now);
}

export function buyPremium(now = Date.now()): boolean {
  const s = getState();
  startSeason(now);
  const p = ensureProgression(s).pass;
  if (p.premium || !canAfford({ gems: PASS_PREMIUM_COST })) return false;
  pay({ gems: PASS_PREMIUM_COST });
  p.premium = true;
  commit();
  return true;
}

export function dismissSeasonNotice() {
  const p = ensureProgression(getState()).pass;
  if (!p.notice) return;
  p.notice = null;
  commit();
}

// ───────── shop ─────────

export type BuyResult = { ok: true; offer: ShopOffer } | { ok: false; reason: 'gone' | 'funds' };

export function buyOffer(key: string, now = Date.now()): BuyResult {
  const s = getState();
  ensureShopDay(s, now);
  const offer = shopOffer(s, key, now);
  if (!offer) return { ok: false, reason: 'gone' };
  if (!canAfford(offer.price)) return { ok: false, reason: 'funds' };
  if (!markBought(s, key, now)) return { ok: false, reason: 'gone' };
  pay(offer.price);
  grantReward(offer.reward);
  emitGameEvent({ type: 'feature', name: 'shop' });
  commit();
  return { ok: true, offer };
}

export function refreshShop(now = Date.now()): boolean {
  const s = getState();
  ensureShopDay(s, now);
  const cost = refreshCost(s.progression.shop.refreshes);
  if (cost === null || !canAfford({ gems: cost })) return false;
  if (!applyRefresh(s, now)) return false;
  pay({ gems: cost });
  commit();
  return true;
}

export function takeGift(now = Date.now()): Reward | null {
  const s = getState();
  const r = claimGift(s, now);
  if (!r) return null;
  grantReward(r);
  emitGameEvent({ type: 'feature', name: 'shop' });
  commit();
  return r;
}

// ───────── achievements ─────────

export function claimAchievementReward(id: string): Reward | null {
  const s = getState();
  const r = claimAchievement(s, id);
  if (!r) return null;
  grantReward(r);
  emitGameEvent({ type: 'feature', name: 'achievement' });
  commit();
  return r;
}

/** Claim every finished achievement at once. Returns the combined reward and count. */
export function claimAllAchievements(): { reward: Reward; count: number } | null {
  const s = getState();
  const total: Reward = {};
  let count = 0;
  for (const a of evaluate(s)) {
    if (!a.ready) continue;
    const r = claimAchievement(s, a.def.id);
    if (!r) continue;
    addReward(total, r);
    count++;
  }
  if (!count) return null;
  if (!isEmptyReward(total)) grantReward(total);
  emitGameEvent({ type: 'feature', name: 'achievement', amount: count });
  commit();
  return { reward: total, count };
}
