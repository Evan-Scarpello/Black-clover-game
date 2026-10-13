import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HERO_MAP } from '../src/data/heroes';
import {
  ACHIEVEMENTS,
  PASS_TIERS,
  REFRESH_COSTS,
  SEASON_EPOCH,
  XP_CAPS,
  addPassXp,
  applyRefresh,
  canClaimTier,
  claimAchievement,
  claimGift,
  claimLoginDay,
  claimPassTiers,
  ensureShopDay,
  evaluate,
  generateStock,
  loginLegendary,
  loginView,
  markBought,
  normalizeProgression,
  offerFromKey,
  passBadge,
  passClaimables,
  passState,
  passTierRewards,
  passXpFor,
  refreshCost,
  rolloverSeason,
  seasonAt,
  seasonEndsAt,
  shopOffer,
  shopView,
  tierAt,
  tierCost,
  tierProgress,
  xpForTier,
} from '../src/features/progression/logic';
import { BONUS_QUEST, DAILY_QUESTS, applyQuestEvent, bump, claimable, questLocked, questProgress, refreshDay } from '../src/game/quests';
import { migrate, newSave, today, type SaveState } from '../src/game/state';

const DAY = 24 * 3600 * 1000;
// Local noon on a fixed date, so day math never straddles midnight.
const T0 = new Date(2026, 9, 13, 12, 0, 0).getTime();

function save(now = T0): SaveState {
  const s = newSave(now);
  refreshDay(s, now);
  return s;
}

// ───────── login calendar ─────────

describe('login calendar', () => {
  it('claims once per calendar day', () => {
    const s = save();
    expect(loginView(s, T0).canClaim).toBe(true);
    const r = claimLoginDay(s, T0);
    expect(r?.index).toBe(0);
    expect(r?.reward.yul).toBeGreaterThan(0);
    expect(claimLoginDay(s, T0)).toBeNull();
    expect(claimLoginDay(s, T0 + 3 * 3600e3)).toBeNull(); // later the same day
    expect(loginView(s, T0).canClaim).toBe(false);
    expect(loginView(s, T0).days[0].state).toBe('claimed');
  });

  it('next day continues the calendar; skipped days never reset it', () => {
    const s = save();
    claimLoginDay(s, T0);
    expect(claimLoginDay(s, T0 + DAY)?.index).toBe(1);
    // Away for 5 days: still day 3, not day 1.
    const r = claimLoginDay(s, T0 + 6 * DAY);
    expect(r?.index).toBe(2);
    expect(r?.reward.gems).toBe(100);
    expect(s.progression.login.claimed).toBe(3);
  });

  it('day 7 pays gems, tickets and 10 Legendary pages, then the cycle wraps', () => {
    const s = save();
    let last = null as ReturnType<typeof claimLoginDay>;
    for (let d = 0; d < 7; d++) last = claimLoginDay(s, T0 + d * DAY);
    expect(last?.index).toBe(6);
    expect(last?.reward.gems).toBe(300);
    expect(last?.reward.tickets).toBe(3);
    const [[hero, pages]] = Object.entries(last!.reward.shards!);
    expect(pages).toBe(10);
    expect(HERO_MAP[hero].rarity).toBe('SSR');
    expect(hero).toBe(loginLegendary(0));
    // Same day after day 7: the full calendar stays stamped.
    const v = loginView(s, T0 + 6 * DAY);
    expect(v.days.every((d) => d.state === 'claimed')).toBe(true);
    // Next day: a fresh calendar starting at day 1.
    const v2 = loginView(s, T0 + 7 * DAY);
    expect(v2.cycle).toBe(1);
    expect(v2.days[0].state).toBe('today');
    const r = claimLoginDay(s, T0 + 7 * DAY);
    expect(r?.index).toBe(0);
    expect(r?.cycle).toBe(1);
  });

  it('a damaged "claimed today" with zero claims still lets you claim', () => {
    const s = save();
    s.progression.login = { lastDay: today(T0), claimed: 0 };
    expect(loginView(s, T0).canClaim).toBe(true);
    expect(claimLoginDay(s, T0)?.index).toBe(0);
    expect(claimLoginDay(s, T0)).toBeNull();
  });

  it('day 7 Legendary is deterministic per cycle', () => {
    expect(loginLegendary(3)).toBe(loginLegendary(3));
    const picks = new Set(Array.from({ length: 12 }, (_, c) => loginLegendary(c)));
    expect(picks.size).toBeGreaterThan(1);
  });
});

// ───────── Grimoire Pass ─────────

describe('grimoire pass', () => {
  it('XP → tier math follows the curve', () => {
    expect(tierCost(1)).toBe(100);
    expect(tierCost(2)).toBe(115);
    expect(xpForTier(1)).toBe(100);
    expect(xpForTier(2)).toBe(215);
    expect(tierAt(0)).toBe(0);
    expect(tierAt(99)).toBe(0);
    expect(tierAt(100)).toBe(1);
    expect(tierAt(214)).toBe(1);
    expect(tierAt(215)).toBe(2);
    expect(tierAt(xpForTier(PASS_TIERS))).toBe(PASS_TIERS);
    expect(tierAt(1e9)).toBe(PASS_TIERS);
    expect(tierProgress(150)).toEqual({ tier: 1, into: 50, need: 115, max: false });
    expect(tierProgress(1e9).max).toBe(true);
    // Every tier's cost adds up.
    let sum = 0;
    for (let t = 1; t <= PASS_TIERS; t++) sum += tierCost(t);
    expect(xpForTier(PASS_TIERS)).toBe(sum);
  });

  it('seasons are 28 days from a fixed epoch', () => {
    expect(seasonAt(SEASON_EPOCH)).toBe(1);
    expect(seasonAt(SEASON_EPOCH + 28 * DAY - 1)).toBe(1);
    expect(seasonAt(SEASON_EPOCH + 28 * DAY)).toBe(2);
    expect(seasonAt(SEASON_EPOCH - 100 * DAY)).toBe(1);
    expect(seasonEndsAt(1)).toBe(SEASON_EPOCH + 28 * DAY);
    const n = seasonAt(T0);
    expect(seasonEndsAt(n)).toBeGreaterThan(T0);
    expect(seasonEndsAt(n) - 28 * DAY).toBeLessThanOrEqual(T0);
  });

  it('free tiers need the tier; premium tiers also need premium', () => {
    const s = save();
    rolloverSeason(s, T0);
    s.progression.pass.xp = xpForTier(3);
    const p = s.progression.pass;
    expect(canClaimTier(p, 'free', 3)).toBe(true);
    expect(canClaimTier(p, 'free', 4)).toBe(false);
    expect(canClaimTier(p, 'premium', 1)).toBe(false);
    expect(canClaimTier(p, 'free', 0)).toBe(false);
    expect(passClaimables(p)).toHaveLength(3);
    p.premium = true;
    expect(canClaimTier(p, 'premium', 1)).toBe(true);
    expect(passClaimables(p)).toHaveLength(6);
  });

  it('claims pay once and sum rewards', () => {
    const s = save();
    rolloverSeason(s, T0);
    s.progression.pass.xp = xpForTier(2);
    const season = s.progression.pass.season;
    const r = claimPassTiers(s, [{ track: 'free', tier: 1 }, { track: 'free', tier: 2 }, { track: 'premium', tier: 1 }, { track: 'free', tier: 9 }], T0);
    const t1 = passTierRewards(1, season, s.stage).free;
    const t2 = passTierRewards(2, season, s.stage).free;
    expect(r).toEqual({ ...t1, ...t2 });
    expect(s.progression.pass.claimedFree).toEqual([1, 2]);
    expect(s.progression.pass.claimedPremium).toEqual([]);
    expect(claimPassTiers(s, [{ track: 'free', tier: 1 }], T0)).toBeNull();
    expect(passBadge(s, T0)).toBe(false);
  });

  it('premium track holds Legendary pages at 15 and Mythic pages at 30', () => {
    const t15 = passTierRewards(15, 4, 0).premium;
    const t30 = passTierRewards(30, 4, 0).premium;
    expect(HERO_MAP[Object.keys(t15.shards!)[0]].rarity).toBe('SSR');
    expect(HERO_MAP[Object.keys(t30.shards!)[0]].rarity).toBe('UR');
    // Premium pays back more gems than it costs.
    let gems = 0;
    for (let t = 1; t <= PASS_TIERS; t++) gems += passTierRewards(t, 4, 0).premium.gems ?? 0;
    expect(gems).toBeGreaterThan(1500);
  });

  it('a new season resets XP, claims and premium and sends unclaimed rewards', () => {
    const s = save();
    const season = seasonAt(T0);
    s.progression.pass = { ...s.progression.pass, season: season - 1, xp: xpForTier(2), premium: true, claimedFree: [1], claimedPremium: [] };
    const left = rolloverSeason(s, T0);
    const prev = (t: number) => passTierRewards(t, season - 1, s.stage);
    expect(left).toBeTruthy();
    // Unclaimed: free 2, premium 1 and 2.
    const expectGems = (prev(2).free.gems ?? 0) + (prev(1).premium.gems ?? 0) + (prev(2).premium.gems ?? 0);
    expect(left!.gems ?? 0).toBe(expectGems);
    const p = s.progression.pass;
    expect(p.season).toBe(season);
    expect(p.xp).toBe(0);
    expect(p.premium).toBe(false);
    expect(p.claimedFree).toEqual([]);
    expect(p.notice?.from).toBe(season - 1);
    // Idempotent and never backwards.
    expect(rolloverSeason(s, T0)).toBeNull();
    p.xp = 500;
    expect(rolloverSeason(s, SEASON_EPOCH)).toBeNull();
    expect(p.xp).toBe(500);
  });

  it('a brand-new save starts the current season without a notice', () => {
    const s = save();
    expect(rolloverSeason(s, T0)).toBeNull();
    expect(s.progression.pass.season).toBe(seasonAt(T0));
    expect(s.progression.pass.notice).toBeNull();
  });

  it('a stale season reads as fresh before any mutation', () => {
    const s = save();
    s.progression.pass = { ...s.progression.pass, season: 1, xp: 5000, premium: true };
    const v = passState(s, T0);
    expect(v.xp).toBe(0);
    expect(v.premium).toBe(false);
    expect(passBadge(s, T0)).toBe(false);
    expect(s.progression.pass.xp).toBe(5000); // untouched
  });

  it('awards XP per event with daily caps', () => {
    expect(passXpFor({ type: 'battle', kind: 'campaign', won: true }).xp).toBe(10);
    expect(passXpFor({ type: 'battle', kind: 'arena', won: true }).xp).toBe(20);
    expect(passXpFor({ type: 'battle', kind: 'tower', won: true }).xp).toBe(20);
    expect(passXpFor({ type: 'battle', kind: 'raid', won: false }).xp).toBe(25);
    expect(passXpFor({ type: 'battle', kind: 'arena', won: false }).xp).toBe(0);
    expect(passXpFor({ type: 'summon', count: 10 }).xp).toBe(50);
    expect(passXpFor({ type: 'levelUp', count: 3 }).xp).toBe(6);
    expect(passXpFor({ type: 'afkClaim' }).xp).toBe(10);
    expect(passXpFor({ type: 'questClaim', id: 'win' }).xp).toBe(15);
    expect(passXpFor({ type: 'feature', name: 'shop' }).xp).toBe(10);

    const s = save();
    rolloverSeason(s, T0);
    let total = 0;
    for (let i = 0; i < XP_CAPS.afk + 4; i++) total += addPassXp(s, { type: 'afkClaim' }, T0);
    expect(total).toBe(XP_CAPS.afk * 10);
    expect(addPassXp(s, { type: 'summon', count: 10 }, T0)).toBe(50); // uncapped
    expect(addPassXp(s, { type: 'afkClaim' }, T0 + DAY)).toBe(10); // caps reset tomorrow
    expect(s.progression.pass.xp).toBe(XP_CAPS.afk * 10 + 60);
  });
});

// ───────── shop ─────────

describe('daily shop', () => {
  it('stock is deterministic per day and refresh, with 6 valid offers', () => {
    const a = generateStock('2026-10-13', 0);
    expect(a).toEqual(generateStock('2026-10-13', 0));
    expect(a).toHaveLength(6);
    expect(new Set(a).size).toBe(6);
    const days = new Set(Array.from({ length: 10 }, (_, i) => generateStock(`2026-10-${i + 1}`, 0).join()));
    expect(days.size).toBeGreaterThan(5);
    expect(generateStock('2026-10-13', 1)).not.toEqual(a);
    for (const k of a) expect(offerFromKey(k, 20)).toBeTruthy();
    const heroes = a.map((k) => offerFromKey(k, 0)!.heroId).filter(Boolean);
    expect(new Set(heroes).size).toBe(heroes.length);
    expect(heroes.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects garbled keys', () => {
    expect(offerFromKey('0:nope', 0)).toBeNull();
    expect(offerFromKey('0:legG:not_a_hero', 0)).toBeNull();
    expect(offerFromKey('0:legG', 0)).toBeNull();
    expect(offerFromKey('0:toString', 0)).toBeNull();
    expect(offerFromKey('', 0)).toBeNull();
  });

  it('each offer sells once per day', () => {
    const s = save();
    const v = shopView(s, T0);
    expect(v.offers).toHaveLength(6);
    expect(v.bought).toEqual([]);
    const key = v.offers[0].key;
    expect(shopOffer(s, key, T0)).toBeTruthy();
    expect(markBought(s, key, T0)).toBe(true);
    expect(markBought(s, key, T0)).toBe(false);
    expect(shopOffer(s, key, T0)).toBeNull();
    expect(shopView(s, T0).bought).toEqual([key]);
    expect(markBought(s, 'bogus', T0)).toBe(false);
    // Tomorrow: new stock, nothing sold.
    const tomorrow = shopView(s, T0 + DAY);
    expect(tomorrow.bought).toEqual([]);
    expect(ensureShopDay(s, T0 + DAY)).toBe(true);
    expect(s.progression.shop.bought).toEqual([]);
    expect(s.progression.shop.day).toBe(today(T0 + DAY));
  });

  it('refreshes escalate 50/100/200 then stop, and reset daily', () => {
    expect(REFRESH_COSTS).toEqual([50, 100, 200]);
    const s = save();
    ensureShopDay(s, T0);
    const first = [...s.progression.shop.stock];
    markBought(s, first[0], T0);
    expect(refreshCost(s.progression.shop.refreshes)).toBe(50);
    expect(applyRefresh(s, T0)).toBe(true);
    expect(s.progression.shop.bought).toEqual([]);
    expect(s.progression.shop.stock).not.toEqual(first);
    expect(refreshCost(s.progression.shop.refreshes)).toBe(100);
    applyRefresh(s, T0);
    expect(refreshCost(s.progression.shop.refreshes)).toBe(200);
    applyRefresh(s, T0);
    expect(refreshCost(s.progression.shop.refreshes)).toBeNull();
    expect(applyRefresh(s, T0)).toBe(false);
    expect(shopView(s, T0 + DAY).refreshCost).toBe(50);
  });

  it('free gift once per day', () => {
    const s = save();
    expect(shopView(s, T0).giftReady).toBe(true);
    expect(claimGift(s, T0)?.gems).toBeGreaterThan(0);
    expect(claimGift(s, T0)).toBeNull();
    expect(shopView(s, T0).giftReady).toBe(false);
    expect(claimGift(s, T0 + DAY)).toBeTruthy();
  });
});

// ───────── achievements ─────────

describe('achievements', () => {
  it('evaluates progress from the save', () => {
    const s = save();
    s.stage = 31;
    s.stats.pulls = 120;
    s.heroes.asta.level = 45;
    s.heroes.asta.stars = 7;
    s.arena.wins = 12;
    s.tower.floor = 26;
    s.clan.clanId = 'npc:bulls';
    s.campaign.stars = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(i), i < 11 ? 3 : 2]));
    s.progression.login.claimed = 8;
    const by = Object.fromEntries(evaluate(s).map((a) => [a.def.id, a]));
    expect(by.stage10.ready && by.stage30.ready).toBe(true);
    expect(by.stage60.ready).toBe(false);
    expect(by.stage60.progress).toBe(31);
    expect(by.pulls100.ready).toBe(true);
    expect(by.pulls300.progress).toBe(120);
    expect(by.level40.ready).toBe(true);
    expect(by.level60.ready).toBe(false);
    expect(by.star7.ready).toBe(true);
    expect(by.arena10.ready).toBe(true);
    expect(by.tower25.ready).toBe(true);
    expect(by.tower50.ready).toBe(false);
    expect(by.clan.ready).toBe(true);
    expect(by.stars10.ready).toBe(true);
    expect(by.stars10.progress).toBe(10);
    expect(by.login7.ready).toBe(true);
    expect(by.heroes10.progress).toBe(5);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(25);
  });

  it('claims once', () => {
    const s = save();
    s.stage = 12;
    expect(claimAchievement(s, 'stage30')).toBeNull();
    expect(claimAchievement(s, 'stage10')?.gems).toBe(100);
    expect(claimAchievement(s, 'stage10')).toBeNull();
    expect(evaluate(s).find((a) => a.def.id === 'stage10')?.claimed).toBe(true);
    expect(claimAchievement(s, 'nope')).toBeNull();
  });

  it('survives old or broken saves', () => {
    const raw: any = { ...newSave(T0) };
    delete raw.arena;
    delete raw.tower;
    delete raw.campaign;
    raw.progression = { login: { claimed: 'x' }, pass: null, achievements: 'oops' };
    const s = migrate(raw);
    expect(() => evaluate(s)).not.toThrow();
    const p = normalizeProgression(s.progression);
    expect(p.login.claimed).toBe(0);
    expect(p.pass.claimedFree).toEqual([]);
    expect(p.shop.stock).toEqual([]);
    expect(p.achievements).toEqual([]);
    // Partial nested objects from an older version keep their values.
    const q = normalizeProgression({ pass: { season: 3, xp: 250, premium: true, claimedFree: [1, 1, 'x'], claimedPremium: [] } });
    expect(q.pass).toMatchObject({ season: 3, xp: 250, premium: true, claimedFree: [1], capUsed: {}, notice: null });
  });
});

// ───────── daily quests ─────────

describe('daily quests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('feature and battle events progress quests', () => {
    const s = save();
    s.stage = 20;
    applyQuestEvent(s, { type: 'battle', kind: 'arena', won: false });
    applyQuestEvent(s, { type: 'battle', kind: 'arena', won: true });
    applyQuestEvent(s, { type: 'battle', kind: 'tower', won: false });
    applyQuestEvent(s, { type: 'battle', kind: 'tower', won: true });
    applyQuestEvent(s, { type: 'battle', kind: 'raid', won: false });
    applyQuestEvent(s, { type: 'battle', kind: 'campaign', won: true });
    applyQuestEvent(s, { type: 'feature', name: 'shop' });
    applyQuestEvent(s, { type: 'feature', name: 'mission' });
    applyQuestEvent(s, { type: 'feature', name: 'dispatch' }); // claiming a mission doesn't count as sending one
    applyQuestEvent(s, { type: 'feature', name: 'unknown' });
    expect(s.quests.progress.arena).toBe(2);
    expect(s.quests.progress.tower).toBe(1);
    expect(s.quests.progress.raid).toBe(1);
    expect(s.quests.progress.shop).toBe(1);
    expect(s.quests.progress.mission).toBe(1);
    // arena + tower wins count; campaign wins are counted by the store itself.
    expect(s.quests.progress.win).toBe(2);
    const arena = DAILY_QUESTS.find((q) => q.id === 'arena')!;
    expect(claimable(s, arena)).toBe(true);
  });

  it('locked quests cannot be claimed but count for the bonus', () => {
    const s = save();
    s.stage = 0;
    const tower = DAILY_QUESTS.find((q) => q.id === 'tower')!;
    const raid = DAILY_QUESTS.find((q) => q.id === 'raid')!;
    bump(s, 'tower');
    expect(questLocked(s, tower)).toBe(true);
    expect(claimable(s, tower)).toBe(false);
    s.stage = 20;
    expect(questLocked(s, raid)).toBe(true); // no clan yet
    s.clan.clanId = 'npc:x';
    expect(questLocked(s, raid)).toBe(false);

    s.stage = 0;
    s.clan.clanId = null;
    const lockedN = DAILY_QUESTS.filter((q) => questLocked(s, q)).length;
    expect(lockedN).toBe(4);
    expect(questProgress(s, BONUS_QUEST)).toBe(lockedN);
    s.quests.claimed = DAILY_QUESTS.filter((q) => !questLocked(s, q)).map((q) => q.id);
    expect(questProgress(s, BONUS_QUEST)).toBe(BONUS_QUEST.goal);
    expect(claimable(s, BONUS_QUEST)).toBe(true);
  });

  it('every quest pays pass XP and the bonus goal matches the list', () => {
    expect(BONUS_QUEST.goal).toBe(DAILY_QUESTS.length);
    for (const q of [...DAILY_QUESTS, BONUS_QUEST]) expect(q.reward.passXp).toBeGreaterThan(0);
    expect(new Set(DAILY_QUESTS.map((q) => q.id)).size).toBe(DAILY_QUESTS.length);
  });

  it('old quest progress keeps working', () => {
    const raw: any = { ...newSave(T0), quests: { day: today(T0), progress: { login: 1, win: 3, afk: 1 }, claimed: ['login', 'afk'] } };
    const s = migrate(raw);
    s.stage = 50;
    s.clan.clanId = 'npc:x';
    bump(s, 'win', 2);
    expect(s.quests.progress.win).toBe(5);
    expect(s.quests.claimed).toEqual(['login', 'afk']);
    expect(claimable(s, DAILY_QUESTS.find((q) => q.id === 'win')!)).toBe(true);
    expect(questProgress(s, BONUS_QUEST)).toBe(2);
  });

  it('bump starts a new day when the app stays open past midnight', () => {
    const s = save();
    bump(s, 'win', 4);
    s.quests.claimed.push('login');
    vi.setSystemTime(T0 + DAY);
    bump(s, 'win');
    expect(s.quests.day).toBe(today(T0 + DAY));
    expect(s.quests.progress.win).toBe(1);
    expect(s.quests.claimed).toEqual([]);
    expect(s.quests.progress.login).toBe(1);
  });
});

// ───────── wiring through the real store ─────────

describe('store wiring', () => {
  it('game events feed pass XP and quests; actions grant and limit', async () => {
    const store = await import('../src/game/store');
    const actions = await import('../src/features/progression/actions');
    const s = newSave();
    s.stage = 20;
    s.currencies.gems = 2000;
    store.replaceState(s);
    refreshDay(store.getState());
    actions.syncProgression();
    const xp0 = store.getState().progression.pass.xp;
    store.emitGameEvent({ type: 'battle', kind: 'arena', won: true });
    expect(store.getState().quests.progress.arena).toBe(1);
    expect(store.getState().progression.pass.xp).toBe(xp0 + 20);

    // Shop: buy once, second tap fails.
    const offer = shopView(store.getState()).offers.find((o) => o.price.gems && o.price.gems <= 500)!;
    const gems = store.getState().currencies.gems;
    expect(actions.buyOffer(offer.key).ok).toBe(true);
    expect(store.getState().currencies.gems).toBe(gems - offer.price.gems!);
    expect(actions.buyOffer(offer.key)).toEqual({ ok: false, reason: 'gone' });
    expect(store.getState().quests.progress.shop).toBe(1);

    // Login: once per day.
    expect(actions.claimLogin()).toBeTruthy();
    expect(actions.claimLogin()).toBeNull();

    // Premium needs 1,500 gems.
    store.getState().currencies.gems = 1499;
    expect(actions.buyPremium()).toBe(false);
    store.getState().currencies.gems = 1600;
    expect(actions.buyPremium()).toBe(true);
    expect(store.getState().currencies.gems).toBe(100);
    expect(actions.buyPremium()).toBe(false);

    // Quest passXp rewards go to the pass via grantReward.
    const before = store.getState().progression.pass.xp;
    store.grantReward({ passXp: 30 });
    expect(store.getState().progression.pass.xp).toBe(before + 30);

    // Achievements: claim all at once, then nothing is left.
    const st = store.getState();
    st.stage = 31;
    const gemsBefore = st.currencies.gems;
    const all = actions.claimAllAchievements();
    expect(all?.count).toBe(2); // stage10 + stage30
    expect(store.getState().currencies.gems).toBe(gemsBefore + 300);
    expect(actions.claimAllAchievements()).toBeNull();
  });

  it('a swapped-in save with a damaged slice is repaired before rewards land', async () => {
    const store = await import('../src/game/store');
    await import('../src/features/progression/actions');
    const s: any = newSave();
    s.progression = { login: { lastDay: '', claimed: 2 }, pass: null, achievements: [] };
    store.replaceState(s);
    expect(() => store.grantReward({ passXp: 25 })).not.toThrow();
    expect(store.getState().progression.pass.xp).toBe(25);
    expect(store.getState().progression.login.claimed).toBe(2);
  });
});
