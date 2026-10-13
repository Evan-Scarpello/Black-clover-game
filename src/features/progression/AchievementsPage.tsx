import { useState } from 'preact/hooks';
import { fmt } from '../../game/stats';
import { useGame } from '../../game/store';
import { toast } from '../../ui/components/common';
import type { ScreenProps } from '../../ui/nav';
import { sfx } from '../../ui/sfx';
import { claimAchievementReward, claimAllAchievements } from './actions';
import { evaluate, type AchievementStatus } from './logic';
import { RewardChips, rewardText } from './parts';

type Filter = 'all' | 'ready' | 'done';

function order(a: AchievementStatus): number {
  return a.ready ? 0 : a.claimed ? 2 : 1;
}

export function AchievementsPage(_: ScreenProps) {
  const s = useGame();
  const [filter, setFilter] = useState<Filter>('all');
  const [justClaimed, setJustClaimed] = useState<string | null>(null);
  const list = evaluate(s);
  const done = list.filter((a) => a.claimed).length;
  const readyN = list.filter((a) => a.ready).length;
  const shown = list
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => (filter === 'ready' ? a.ready : filter === 'done' ? a.claimed : true))
    .sort((x, y) => order(x.a) - order(y.a) || x.i - y.i)
    .map(({ a }) => a);

  const claim = (a: AchievementStatus) => {
    const r = claimAchievementReward(a.def.id);
    if (r) {
      sfx.coin();
      setJustClaimed(a.def.id);
      toast(`${a.def.name}! ${rewardText(r)}`);
    }
  };

  const claimAll = () => {
    const r = claimAllAchievements();
    if (r) {
      sfx.coin();
      setJustClaimed(null);
      toast(`${r.count} achievements! ${rewardText(r.reward)}`);
    }
  };

  return (
    <div class="screen prog-ach">
      <div class="panel prog-ach-head">
        <div class="prog-ach-trophy" aria-hidden="true">
          🏆
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div class="spread">
            <b class="comic prog-ach-count">
              {done} / {list.length} complete
            </b>
            {readyN > 1 ? (
              <button class="btn green small prog-ach-all" onClick={claimAll}>
                Claim all ({readyN})
              </button>
            ) : readyN === 1 ? (
              <span class="chip on">1 ready!</span>
            ) : null}
          </div>
          <div class="bar" style={{ marginTop: 4 }}>
            <i style={{ width: `${(done / list.length) * 100}%` }} />
          </div>
        </div>
      </div>

      <div class="tabs">
        {(['all', 'ready', 'done'] as Filter[]).map((f) => (
          <button key={f} class={`tab ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : f === 'ready' ? `Ready${readyN ? ` (${readyN})` : ''}` : 'Done'}
          </button>
        ))}
      </div>

      {shown.length === 0 && (
        <div class="empty-hint panel">{filter === 'ready' ? 'Nothing to claim yet — keep adventuring!' : 'No achievements completed yet. Your first one is closer than you think!'}</div>
      )}

      {shown.map((a) => (
        <div key={a.def.id} class={`prog-ach-row ${a.ready ? 'ready' : ''} ${a.claimed ? 'claimed' : ''} ${justClaimed === a.def.id ? 'just' : ''}`}>
          <div class="prog-ach-ico">{a.def.icon}</div>
          <div class="prog-ach-main">
            <div class="prog-ach-name">
              {a.def.name}
              <span class="prog-ach-group">{a.def.group}</span>
            </div>
            <div class="small-text muted">{a.def.desc}</div>
            <div class="bar prog-ach-bar">
              <i style={{ width: `${(a.progress / a.goal) * 100}%` }} />
            </div>
            <div class="prog-ach-meta">
              <span>
                {fmt(a.progress)}/{fmt(a.goal)}
              </span>
              <RewardChips r={a.def.reward} size={15} />
            </div>
          </div>
          {a.claimed ? (
            <span class="prog-ach-done">✓</span>
          ) : (
            <button class={`btn small ${a.ready ? 'green' : 'dark'}`} disabled={!a.ready} onClick={() => claim(a)}>
              {a.ready ? 'Claim' : `${Math.floor((a.progress / a.goal) * 100)}%`}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
