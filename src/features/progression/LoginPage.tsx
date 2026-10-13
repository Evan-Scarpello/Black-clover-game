import { useState } from 'preact/hooks';
import { CharacterArt } from '../../art/CharacterArt';
import { HERO_MAP } from '../../data/heroes';
import { useGame } from '../../game/store';
import { RewardList, formatDuration, toast, useNow } from '../../ui/components/common';
import type { ScreenProps } from '../../ui/nav';
import { sfx } from '../../ui/sfx';
import { claimLogin } from './actions';
import { LOGIN_CYCLE, loginLegendary, loginView } from './logic';
import { RewardChips, msToMidnight, rewardText } from './parts';

export function LoginPage(_: ScreenProps) {
  const s = useGame();
  const now = useNow(1000);
  const v = loginView(s, now);
  const [stamped, setStamped] = useState<number | null>(null);
  const legendId = loginLegendary(v.cycle);
  const legend = HERO_MAP[legendId];
  const todayDay = v.canClaim ? v.days[v.nextIndex] : v.days[(v.total - 1 + LOGIN_CYCLE) % LOGIN_CYCLE];

  const claim = () => {
    const r = claimLogin();
    if (!r) return;
    sfx.coin();
    setStamped(r.index);
    toast(`Day ${r.index + 1}: ${rewardText(r.reward)}`);
  };

  return (
    <div class="screen prog-login">
      <div class="panel prog-banner">
        <div class="prog-banner-text">
          <div class="prog-kicker">Daily login</div>
          <h3 class="comic">Report for duty!</h3>
          <div class="small-text">Claim one reward each day. Miss a day? No problem — your calendar waits for you.</div>
        </div>
        <div class="prog-count">
          <b>{v.total}</b>
          <span>{v.total === 1 ? 'day' : 'days'}</span>
        </div>
      </div>

      <div class="prog-cal">
        {v.days.map((d) => {
          const big = d.index === LOGIN_CYCLE - 1;
          return (
            <div
              key={`${v.cycle}-${d.index}`}
              class={`prog-day ${d.state} ${big ? 'big' : ''}`}
              onClick={d.state === 'today' ? claim : undefined}
              role={d.state === 'today' ? 'button' : undefined}
              aria-label={`Day ${d.index + 1}${d.state === 'claimed' ? ', claimed' : d.state === 'today' ? ', claim now' : ''}`}
            >
              <div class="prog-day-n">Day {d.index + 1}</div>
              {big ? (
                <div class="prog-day-big">
                  <div class="prog-day-art">
                    <CharacterArt id={legendId} mode="full" />
                  </div>
                  <div class="prog-day-bigtext">
                    <span class="prog-day-who">{legend?.name.split(' ')[0] ?? 'Legendary'}</span>
                    <RewardChips r={d.reward} size={16} />
                  </div>
                </div>
              ) : (
                <div class="prog-day-rew">
                  <RewardChips r={d.reward} size={26} />
                </div>
              )}
              {d.state === 'claimed' && <div class={`prog-stamp ${stamped === d.index ? 'anim' : ''}`}>Claimed</div>}
            </div>
          );
        })}
      </div>

      {v.canClaim ? (
        <button class="btn green big block prog-claim-btn" onClick={claim}>
          Claim Day {v.nextIndex + 1}!
        </button>
      ) : (
        <div class="panel prog-today">
          <div class="spread">
            <span class="comic prog-today-title">✔ Day {todayDay.index + 1} claimed</span>
            <span class="chip">⏳ {formatDuration(msToMidnight(now))}</span>
          </div>
          <RewardList r={todayDay.reward} />
          <div class="small-text muted center">Come back tomorrow for Day {v.nextIndex + 1}.</div>
        </div>
      )}

      <div class="small-text muted center prog-foot">
        Calendar {v.cycle + 1} · Day 7 always pays 300 gems, 3 tickets and 10 pages of a Legendary — a different one every calendar.
      </div>
    </div>
  );
}
