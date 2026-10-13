import { useEffect, useRef, useState } from 'preact/hooks';
import { useGame } from '../../game/store';
import { fmt } from '../../game/stats';
import { CurrencyIcon, Modal, RewardList, formatDuration, toast, useNow } from '../../ui/components/common';
import type { ScreenProps } from '../../ui/nav';
import { sfx } from '../../ui/sfx';
import { buyPremium, claimAllPass, claimPass, dismissSeasonNotice, syncProgression } from './actions';
import {
  DAY_MS,
  PASS_PREMIUM_COST,
  PASS_TIERS,
  XP_CAPS,
  canClaimTier,
  passClaimables,
  passHeroes,
  passState,
  passTiers,
  seasonEndsAt,
  tierAt,
  tierProgress,
  type PassTrack,
} from './logic';
import { HeroFace, RewardChips, rewardText } from './parts';
import { today } from '../../game/state';

const XP_SOURCES: { label: string; xp: string; cap?: string }[] = [
  { label: 'Campaign win', xp: '+10', cap: 'campaign' },
  { label: 'Arena win', xp: '+20', cap: 'arena' },
  { label: 'Tower floor cleared', xp: '+20', cap: 'tower' },
  { label: 'Clan Raid attack', xp: '+25', cap: 'raid' },
  { label: 'Daily quest claimed', xp: '+15' },
  { label: 'Summon (per hero)', xp: '+5' },
  { label: 'Hero level up', xp: '+2' },
  { label: 'Star up', xp: '+10', cap: 'starUp' },
  { label: 'AFK chest collected', xp: '+10', cap: 'afk' },
  { label: 'Shop, login, missions & more', xp: '+10', cap: 'feature' },
];

/** Nearest ancestor that scrolls vertically (the page body). */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let n = el.parentElement; n; n = n.parentElement) {
    const oy = getComputedStyle(n).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return n;
  }
  return null;
}

function timeLeft(ms: number): string {
  if (ms <= 0) return 'Ending…';
  const days = Math.floor(ms / DAY_MS);
  return days >= 1 ? `${days}d ${Math.floor((ms % DAY_MS) / 3600000)}h left` : `${formatDuration(ms)} left`;
}

export function PassPage(_: ScreenProps) {
  const s = useGame();
  const now = useNow(30000);
  const p = passState(s, now);
  const tp = tierProgress(p.xp);
  const tiers = passTiers(p.season, s.stage);
  const ready = passClaimables(p);
  const heroes = passHeroes(p.season);
  const premGems = tiers.reduce((a, t) => a + (t.premium.gems ?? 0), 0);
  const premTickets = tiers.reduce((a, t) => a + (t.premium.tickets ?? 0), 0);
  const [confirm, setConfirm] = useState(false);
  const focusRef = useRef<HTMLDivElement>(null);
  const focusTier = Math.min(PASS_TIERS, ready.length ? ready[0].tier : tp.tier + 1);
  const capDay = p.capDay === today(now);

  useEffect(() => {
    syncProgression();
    // Bring the first claimable (or next) tier into view.
    const el = focusRef.current;
    const box = el ? scrollParent(el) : null;
    if (el && box && focusTier > 3) {
      const d = el.getBoundingClientRect().top - box.getBoundingClientRect().top;
      box.scrollTop += d - box.clientHeight / 2 + el.clientHeight / 2;
    }
  }, []);

  const claimOne = (track: PassTrack, tier: number) => {
    if (!canClaimTier(p, track, tier)) {
      if (tier > tierAt(p.xp)) toast(`Reach tier ${tier} to claim this.`);
      else if (track === 'premium' && !p.premium) toast('Unlock the Premium track to claim this.');
      return;
    }
    const r = claimPass([{ track, tier }]);
    if (r) {
      sfx.coin();
      toast(rewardText(r));
    }
  };

  const claimAll = () => {
    const r = claimAllPass();
    if (r) {
      sfx.coin();
      toast(`Claimed! ${rewardText(r)}`);
    }
  };

  return (
    <div class="screen prog-pass">
      {p.notice && (
        <div class="panel prog-notice">
          <h3 class="comic">🎉 Season {p.season} has begun!</h3>
          <div class="small-text">Your Season {p.notice.from} pass was reset. {p.notice.reward ? 'Rewards you reached but never claimed were sent to you:' : 'Fresh tiers, fresh rewards — go get them!'}</div>
          {p.notice.reward && <RewardList r={p.notice.reward} />}
          <button class="btn small block" onClick={dismissSeasonNotice}>
            Got it
          </button>
        </div>
      )}

      <div class="prog-pass-top">
        <div class="prog-tierbadge">
          <span>Tier</span>
          <b>{tp.tier}</b>
        </div>
        <div class="prog-pass-mid">
          <div class="spread">
            <span class="comic prog-season">Season {p.season}</span>
            <span class="prog-left">⏳ {timeLeft(seasonEndsAt(p.season) - now)}</span>
          </div>
          <div class="bar prog-xpbar">
            <i style={{ width: tp.max ? '100%' : `${(tp.into / tp.need) * 100}%` }} />
          </div>
          <div class="small-text muted">{tp.max ? `MAX tier · ${fmt(p.xp)} XP` : `${fmt(tp.into)} / ${fmt(tp.need)} XP to tier ${tp.tier + 1}`}</div>
        </div>
        <button class={`btn small ${ready.length ? 'green' : 'dark'} prog-claimall`} disabled={!ready.length} onClick={claimAll}>
          <span>Claim</span>
          <span>all{ready.length ? ` (${ready.length})` : ''}</span>
        </button>
      </div>

      {p.premium ? (
        <div class="prog-premium-on">✨ Premium track active — every reward is yours to claim!</div>
      ) : (
        <div class="panel prog-premium">
          <div class="prog-premium-faces">
            <HeroFace id={heroes.mythic} size={46} />
            <HeroFace id={heroes.legendary} size={40} />
          </div>
          <div class="prog-premium-text">
            <b class="comic">Unlock Premium</b>
            <span class="small-text">
              Mythic & Legendary pages, {premTickets} tickets and {fmt(premGems)} gems back.
            </span>
          </div>
          <button class="btn purple small" onClick={() => setConfirm(true)}>
            <CurrencyIcon kind="gems" size={16} />
            {fmt(PASS_PREMIUM_COST)}
          </button>
        </div>
      )}

      <div class="prog-track-head">
        <span>Free</span>
        <span />
        <span class="prem">Premium</span>
      </div>
      <div class="prog-track">
        {tiers.map((t) => {
          const reached = t.tier <= tp.tier;
          const cell = (track: PassTrack) => {
            const claimed = (track === 'free' ? p.claimedFree : p.claimedPremium).includes(t.tier);
            const lockedPrem = track === 'premium' && !p.premium;
            const can = canClaimTier(p, track, t.tier);
            const state = claimed ? 'claimed' : can ? 'ready' : !reached ? 'future' : lockedPrem ? 'plocked' : 'future';
            const reward = track === 'free' ? t.free : t.premium;
            const big = !!reward.shards;
            return (
              <button class={`prog-cell ${track} ${state} ${big ? 'big' : ''}`} onClick={() => claimOne(track, t.tier)} aria-label={`${track} tier ${t.tier}`}>
                <RewardChips r={reward} size={big ? 20 : 18} />
                {claimed && <span class="prog-check">✓</span>}
                {lockedPrem && !claimed && <span class="prog-lock">🔒</span>}
              </button>
            );
          };
          return (
            <div key={t.tier} ref={t.tier === focusTier ? focusRef : undefined} class={`prog-tier ${reached ? 'reached' : ''} ${t.tier === tp.tier + 1 ? 'next' : ''}`}>
              {cell('free')}
              <div class="prog-tier-n">
                <span>{t.tier}</span>
              </div>
              {cell('premium')}
            </div>
          );
        })}
      </div>

      <div class="panel prog-xp-help">
        <h3 class="panel-title">How to earn Pass XP</h3>
        {XP_SOURCES.map((x) => (
          <div class="spread prog-xp-row" key={x.label}>
            <span>{x.label}</span>
            <span>
              <b class="prog-xp-val">{x.xp}</b>
              {x.cap && (
                <span class="muted small-text">
                  {' '}
                  · {capDay ? Math.min(p.capUsed[x.cap] ?? 0, XP_CAPS[x.cap]) : 0}/{XP_CAPS[x.cap]} today
                </span>
              )}
            </span>
          </div>
        ))}
        <div class="small-text muted" style={{ marginTop: 6 }}>
          Daily quests also pay bonus Pass XP. A new season starts every 28 days: XP, tiers and Premium reset.
        </div>
      </div>

      {confirm && (
        <Modal center onClose={() => setConfirm(false)}>
          <h2 class="panel-title">Unlock Premium?</h2>
          <p class="small-text" style={{ margin: '0 0 10px' }}>
            Season {p.season} Premium track: 10 pages each of a Mythic and a Legendary hero, extra gems, tickets, Yul and Essence on every tier — including tiers you already reached.
          </p>
          <div class="prog-confirm-cost">
            <CurrencyIcon kind="gems" size={26} />
            <b>{fmt(PASS_PREMIUM_COST)}</b>
            <span class="muted small-text">(you have {fmt(s.currencies.gems)})</span>
          </div>
          {seasonEndsAt(p.season) - now < 3 * DAY_MS && (
            <div class="small-text center prog-short" style={{ marginTop: 6 }}>
              Heads up: Season {p.season} ends in {timeLeft(seasonEndsAt(p.season) - now).replace(' left', '')}. Premium resets when Season {p.season + 1} starts.
            </div>
          )}
          <div class="small-text muted center" style={{ margin: '6px 0 12px' }}>
            Fan build: paid with in-game gems only. No real money, ever.
          </div>
          <div class="row">
            <button class="btn dark" style={{ flex: 1 }} onClick={() => setConfirm(false)}>
              Not now
            </button>
            <button
              class="btn purple"
              style={{ flex: 1 }}
              disabled={s.currencies.gems < PASS_PREMIUM_COST}
              onClick={() => {
                if (buyPremium()) {
                  sfx.win();
                  toast('Premium unlocked! Claim your rewards.');
                  setConfirm(false);
                } else toast('Not enough gems yet.');
              }}
            >
              {s.currencies.gems < PASS_PREMIUM_COST ? 'Need gems' : 'Unlock'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
