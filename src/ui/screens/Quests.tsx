import { useState } from 'preact/hooks';
import * as Q from '../../game/quests';
import { BONUS_QUEST, DAILY_QUESTS, claimable, questProgress, type QuestDef } from '../../game/quests';
import type { SaveState } from '../../game/state';
import { fmt } from '../../game/stats';
import { claimQuest, useGame } from '../../game/store';
import { CurrencyIcon, Modal, formatDuration, toast, useModalClose, useNow } from '../components/common';
import { Burst, flyRewards } from '../components/fx';
import { haptic } from '../haptics';
import type { Nav, ScreenId, Tab } from '../nav';
import { sfx } from '../sfx';

const REWARD_KEYS = ['gems', 'tickets', 'yul', 'essence', 'medals', 'crests'] as const;

/** Where "Go" takes you for each daily quest. */
const GO: Record<string, { tab?: Tab; screen?: ScreenId }> = {
  afk: { tab: 'home' },
  win: { tab: 'campaign' },
  ult: { tab: 'campaign' },
  summon: { tab: 'summon' },
  levelup: { tab: 'heroes' },
  shop: { screen: 'shop' },
  mission: { screen: 'dispatch' },
  tower: { screen: 'tower' },
  arena: { screen: 'arena' },
  raid: { screen: 'clan' },
};

// Lock helpers are optional so the modal keeps working with older quest data.
const locked = (s: SaveState, q: QuestDef): boolean => (typeof (Q as any).questLocked === 'function' ? !!(Q as any).questLocked(s, q) : false);
const lockReason = (s: SaveState, q: QuestDef): string => (typeof (Q as any).questLockReason === 'function' ? String((Q as any).questLockReason(s, q) || 'Locked') : 'Locked');

type RowState = 'ready' | 'progress' | 'locked' | 'done';

function rowState(s: SaveState, q: QuestDef): RowState {
  if (s.quests.claimed.includes(q.id)) return 'done';
  if (locked(s, q)) return 'locked';
  return claimable(s, q) ? 'ready' : 'progress';
}

const ORDER: Record<RowState, number> = { ready: 0, progress: 1, locked: 2, done: 3 };

function QuestsBody({ nav }: { nav?: Nav }) {
  const s = useGame();
  const now = useNow(1000);
  const close = useModalClose();
  const [flash, setFlash] = useState<Record<string, number>>({});
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);

  const claim = (q: QuestDef, el: Element | null): boolean => {
    if (!claimQuest(q.id)) return false;
    sfx.coin();
    haptic('success');
    flyRewards(el, q.reward);
    setFlash((f) => ({ ...f, [q.id]: Date.now() }));
    return true;
  };

  const ready = [...DAILY_QUESTS, BONUS_QUEST].filter((q) => claimable(s, q));
  const doneCount = DAILY_QUESTS.filter((q) => s.quests.claimed.includes(q.id)).length;
  const open = DAILY_QUESTS.filter((q) => !locked(s, q)).length;
  const rows = DAILY_QUESTS.map((q, i) => ({ q, st: rowState(s, q), i })).sort((a, b) => ORDER[a.st] - ORDER[b.st] || a.i - b.i);

  const go = (q: QuestDef) => {
    const g = GO[q.id];
    if (!g || !nav) return;
    close();
    if (g.screen) nav.open(g.screen);
    else if (g.tab) nav.go(g.tab);
  };

  // A render helper, not a component: rows must not remount every second (useNow).
  const row = (q: QuestDef, st: RowState, bonus?: boolean) => {
    const prog = questProgress(s, q);
    const pct = Math.min(1, prog / Math.max(1, q.goal));
    const canGo = st === 'progress' && !!GO[q.id] && !!nav;
    return (
      <div class={`quest q-${st} ${st === 'done' ? 'done' : ''} ${bonus ? 'bonus' : ''}`} key={q.id}>
        {flash[q.id] && <Burst key={flash[q.id]} count={12} spread={70} />}
        <div class="q-main">
          <div class="q-text">{q.text}</div>
          <div class="q-bar" aria-hidden="true">
            <i style={{ transform: `scaleX(${pct})` }} />
          </div>
          <div class="q-rew">
            <span class="q-count">
              {st === 'locked' ? `🔒 ${lockReason(s, q)}` : `${prog}/${q.goal}`}
            </span>
            {REWARD_KEYS.filter((k) => q.reward[k]).map((k) => (
              <span key={k}>
                <CurrencyIcon kind={k} />
                {fmt(q.reward[k]!)}
              </span>
            ))}
            {q.reward.passXp ? <span class="q-xp">+{q.reward.passXp} XP</span> : null}
          </div>
        </div>
        {st === 'done' ? (
          <span class="q-stamp" aria-label="Claimed">
            ✓
          </span>
        ) : st === 'ready' ? (
          <button class="btn small green q-claim" onClick={(e) => claim(q, e.currentTarget as Element) && toast('Quest reward claimed!', 'reward')}>
            Claim
          </button>
        ) : canGo ? (
          <button class="btn small dark" onClick={() => go(q)} aria-label={`Go: ${q.text}`}>
            Go ›
          </button>
        ) : (
          <button class="btn small dark" disabled aria-label={st === 'locked' ? 'Locked' : 'In progress'}>
            {st === 'locked' ? '🔒' : '…'}
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      <h2 class="panel-title" style={{ fontSize: 26 }}>
        📜 Daily Quests
      </h2>
      <div class="q-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div class="small-text muted">Resets in {formatDuration(midnight.getTime() - now)}</div>
          <div class="q-total" aria-label={`${doneCount} of ${open} quests claimed`}>
            <div class="q-bar big">
              <i style={{ transform: `scaleX(${Math.min(1, doneCount / Math.max(1, open))})` }} />
            </div>
            <b>
              {doneCount}/{open}
            </b>
          </div>
        </div>
        {ready.length >= 2 && (
          <button
            class="btn green small"
            onClick={(e) => {
              const el = e.currentTarget as Element;
              let n = 0;
              // Daily quests first so the bonus can become claimable in the same tap.
              for (const q of [...DAILY_QUESTS, BONUS_QUEST]) if (claimable(s, q) && claim(q, el)) n++;
              if (n) toast(`Claimed ${n} quest rewards!`, 'reward');
            }}
          >
            Claim all
          </button>
        )}
      </div>
      {rows.map(({ q, st }) => row(q, st))}
      {row(BONUS_QUEST, rowState(s, BONUS_QUEST), true)}
    </>
  );
}

export function Quests({ onClose, nav }: { onClose: () => void; nav?: Nav }) {
  return (
    <Modal onClose={onClose} label="Daily quests">
      <QuestsBody nav={nav} />
    </Modal>
  );
}
