import { BONUS_QUEST, DAILY_QUESTS, claimable, questProgress, type QuestDef } from '../../game/quests';
import { claimQuest, useGame } from '../../game/store';
import { fmt } from '../../game/stats';
import { CurrencyIcon, Modal, formatDuration, toast, useNow } from '../components/common';
import { sfx } from '../sfx';

export function Quests({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const now = useNow(1000);
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);

  const Row = ({ q, bonus }: { q: QuestDef; bonus?: boolean }) => {
    const prog = questProgress(s, q);
    const done = s.quests.claimed.includes(q.id);
    const ready = claimable(s, q);
    return (
      <div class={`quest ${done ? 'done' : ''} ${bonus ? 'bonus' : ''}`}>
        <div class="q-main">
          <div class="q-text">{q.text}</div>
          <div class="bar">
            <i style={{ width: `${(prog / q.goal) * 100}%` }} />
          </div>
          <div class="q-rew">
            <span>
              {prog}/{q.goal}
            </span>
            {(['gems', 'tickets', 'yul', 'essence'] as const)
              .filter((k) => q.reward[k])
              .map((k) => (
                <span key={k}>
                  <CurrencyIcon kind={k} />
                  {fmt(q.reward[k]!)}
                </span>
              ))}
          </div>
        </div>
        <button
          class={`btn small ${ready ? 'green' : 'dark'}`}
          disabled={!ready}
          onClick={() => {
            if (claimQuest(q.id)) {
              sfx.coin();
              toast('Quest reward claimed!');
            }
          }}
        >
          {done ? '✓' : ready ? 'Claim' : 'Go'}
        </button>
      </div>
    );
  };

  return (
    <Modal onClose={onClose}>
      <h2 class="panel-title" style={{ fontSize: 26 }}>
        📜 Daily Quests
      </h2>
      <div class="small-text muted" style={{ marginBottom: 10 }}>
        Resets in {formatDuration(midnight.getTime() - now)}
      </div>
      {DAILY_QUESTS.map((q) => (
        <Row key={q.id} q={q} />
      ))}
      <Row q={BONUS_QUEST} bonus />
    </Modal>
  );
}
