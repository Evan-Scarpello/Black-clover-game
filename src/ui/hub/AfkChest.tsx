// The hideout's AFK chest: the art, the dock button (with fill ring) and the collect modal.
// Each piece ticks its own clock so the big base map never re-renders once a second.
import { useRef, useState } from 'preact/hooks';
import { AFK_CAP_HOURS, afkRates } from '../../data/campaign';
import { fmt } from '../../game/stats';
import { FAST_REWARD_HOURS, afkPending, claimAfk, fastReward, fastRewardCost, useGame } from '../../game/store';
import { CurrencyIcon, Modal, formatDuration, toast, useModalClose, useNow } from '../components/common';
import { Burst, flyRewards } from '../components/fx';
import { haptic } from '../haptics';
import { sfx } from '../sfx';

/** The chest counts as "ready" (red dot, wiggle) after an hour of AFK time. */
export const CHEST_READY_HOURS = 1;

export function ChestArt({ pct, open }: { pct: number; open?: boolean }) {
  const glow = Math.max(0, Math.min(1, pct));
  return (
    <svg class="chest-art" viewBox="0 0 86 78" aria-hidden="true">
      <ellipse cx="43" cy="72" rx="34" ry="5" fill="rgba(0,0,0,.35)" />
      <circle cx="43" cy="36" r={8 + 26 * glow} fill="#ffd36b" opacity={0.1 + 0.22 * glow} />
      <g stroke="#0b0710" stroke-width="3" stroke-linejoin="round">
        <rect x="10" y="34" width="66" height="36" rx="5" fill="#8d4a1f" />
        {open ? <path d="M12 34 L18 6 Q43 -2 68 6 L74 34Z" fill="#a85a26" /> : <path d="M10 36 Q10 10 43 10 Q76 10 76 36Z" fill="#a85a26" />}
        <rect x="8" y="32" width="70" height="8" rx="3" fill="#ffc531" />
        <rect x="36" y="30" width="14" height="18" rx="3" fill="#ffc531" />
        <path d="M20 40 L20 70 M66 40 L66 70" stroke="#ffc531" stroke-width="4" />
        {!open && <path d="M20 13 L20 34 M66 13 L66 34" stroke="#ffc531" stroke-width="4" />}
      </g>
      <circle cx="43" cy="40" r="3" fill="#0b0710" />
      {pct > 0.05 && !open && (
        <g stroke="#0b0710" stroke-width="2">
          <circle cx="30" cy="8" r="5" fill="#ffc531" />
          <circle cx="55" cy="6" r="4" fill="#3ddc84" />
          <circle cx="44" cy="2" r="3" fill="#4fc3f7" />
        </g>
      )}
    </svg>
  );
}

/** Round chest button for the hub dock: a fill ring shows how full the chest is. */
export function DockChest({ onOpen }: { onOpen: () => void }) {
  useGame();
  const now = useNow(1000);
  const p = afkPending(now);
  const pct = p.hours / AFK_CAP_HOURS;
  const ready = p.hours >= CHEST_READY_HOURS;
  const C = 2 * Math.PI * 27;
  return (
    <button class={`dock-chest ${ready ? 'ready' : ''} ${p.capped ? 'capped' : ''}`} onClick={onOpen} aria-label={`AFK chest, ${formatDuration(p.hours * 3600000)} of ${AFK_CAP_HOURS} hours collected`}>
      <svg class="dock-ring" viewBox="0 0 62 62" aria-hidden="true">
        <circle cx="31" cy="31" r="27" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="6" />
        <circle cx="31" cy="31" r="27" fill="none" stroke={p.capped ? '#ff4b5c' : '#3ddc84'} stroke-width="5" stroke-linecap="round" stroke-dasharray={`${(C * pct).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 31 31)" />
      </svg>
      <span class="dock-chest-art">
        <ChestArt pct={pct} />
      </span>
      <span class="dock-chest-time">{p.capped ? 'FULL' : formatDuration(p.hours * 3600000)}</span>
      {ready && <span class="badge-dot" />}
    </button>
  );
}

export function AfkModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal center onClose={onClose} label="AFK rewards">
      <AfkBody />
    </Modal>
  );
}

function AfkBody() {
  const s = useGame();
  const now = useNow(1000);
  const close = useModalClose();
  const p = afkPending(now);
  const rates = afkRates(s.stage);
  const fastCost = fastRewardCost();
  const [burst, setBurst] = useState(0);
  const [opened, setOpened] = useState(false);
  const busy = useRef(false);

  const collect = (e: MouseEvent) => {
    if (busy.current) return;
    if (p.yul <= 0) {
      toast('The chest is still empty. Check back soon!');
      return;
    }
    busy.current = true;
    const el = e.currentTarget as Element;
    const got = claimAfk(Date.now());
    sfx.coin();
    haptic('success');
    setOpened(true);
    setBurst((b) => b + 1);
    flyRewards(el, { yul: got.yul, essence: got.essence, gems: got.gems }, 6);
    toast(`+${fmt(got.yul)} Yul · +${fmt(got.essence)} Essence${got.gems ? ` · +${got.gems} Gems` : ''}`, 'reward');
    setTimeout(close, 650);
  };

  const fast = (e: MouseEvent) => {
    const el = e.currentTarget as Element;
    const r = fastReward();
    if (!r) {
      toast(fastCost === null ? 'No Fast Rewards left today.' : 'Not enough Gems.', 'bad');
      haptic('error');
      return;
    }
    sfx.coin();
    haptic('medium');
    setBurst((b) => b + 1);
    flyRewards(el, { yul: r.yul, essence: r.essence }, 5);
    toast(`Fast Reward! +${fmt(r.yul)} Yul · +${fmt(r.essence)} Essence`, 'reward');
  };

  const pct = p.hours / AFK_CAP_HOURS;
  return (
    <div class="afk-modal">
      <div class={`afk-modal-chest ${p.hours >= CHEST_READY_HOURS && !opened ? 'ready' : ''} ${opened ? 'opened' : ''}`}>
        <ChestArt pct={pct} open={opened} />
        {burst > 0 && <Burst key={burst} count={18} spread={110} />}
      </div>
      <h2 class="afk-modal-title">AFK Rewards</h2>
      <p class="afk-modal-sub">Your squad keeps fighting while you're away.</p>
      <div class="spread small-text">
        <span class="muted">Chest</span>
        <b class={p.capped ? 'afk-full' : ''}>
          {formatDuration(p.hours * 3600000)} / {AFK_CAP_HOURS}h{p.capped ? ' · FULL' : ''}
        </b>
      </div>
      <div class="bar afk-modal-bar">
        <i style={{ width: `${Math.min(100, pct * 100)}%`, background: p.capped ? 'linear-gradient(90deg,#ff4b5c,#ffc531)' : undefined }} />
      </div>
      <div class="afk-yields afk-modal-yields">
        <span>
          <CurrencyIcon kind="yul" />
          {fmt(p.yul)}
        </span>
        <span>
          <CurrencyIcon kind="essence" />
          {fmt(p.essence)}
        </span>
        <span>
          <CurrencyIcon kind="gems" />
          {fmt(p.gems)}
        </span>
      </div>
      <div class="row afk-modal-btns">
        <button class="btn green" style={{ flex: 1 }} onClick={collect as any} disabled={opened}>
          Collect
        </button>
        <button class="btn blue" disabled={fastCost === null || s.currencies.gems < (fastCost ?? 0)} onClick={fast as any} aria-label={`Fast Reward, ${FAST_REWARD_HOURS} hours of rewards`}>
          ⚡ {FAST_REWARD_HOURS}h{' '}
          {fastCost === null ? (
            <span class="cost">0 left</span>
          ) : fastCost === 0 ? (
            'FREE'
          ) : (
            <span class="cost">
              <CurrencyIcon kind="gems" size={14} />
              {fastCost}
            </span>
          )}
        </button>
      </div>
      <div class="small-text muted afk-modal-rates">
        Per hour: {fmt(rates.yul)} Yul · {fmt(rates.essence)} Essence · {rates.gems} Gems. Clear more stages to earn faster.
      </div>
    </div>
  );
}
