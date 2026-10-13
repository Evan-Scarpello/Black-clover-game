// Magic Knight Missions: a daily bounty board. Send heroes out, come back for the loot.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CharacterArt } from '../../art/CharacterArt';
import { HERO_MAP } from '../../data/heroes';
import { today, type SaveState } from '../../game/state';
import { RARITY_INFO, ROLE_INFO, fmtShort, heroPower } from '../../game/stats';
import { useGame } from '../../game/store';
import type { OwnedHero } from '../../game/types';
import { CurrencyIcon, Modal, RewardList, Stars, formatDuration, toast, useNow } from '../../ui/components/common';
import type { ScreenDef, ScreenProps } from '../../ui/nav';
import { claimDispatch, ensureBoard, quickDispatch, recallDispatch, rushDispatch, startDispatch } from './actions';
import {
  RANKS,
  busyHeroes,
  bestTeam,
  checkTeam,
  defOf,
  durationMs,
  finishNowCost,
  hasReady,
  heroMeets,
  missionStatus,
  msToNextDay,
  remainingMs,
  reqIcon,
  reqText,
  reqsMet,
  type MissionStatus,
} from './logic';
import type { DispatchMission, MissionDef, MissionReward } from './state';
import './dispatch.css';

const STATUS_ORDER: Record<MissionStatus, number> = { ready: 0, active: 1, idle: 2, claimed: 3 };

function RankStamp({ rank, small }: { rank: MissionDef['rank']; small?: boolean }) {
  return (
    <span class={`dsp-stamp r-${rank} ${small ? 'sm' : ''}`} style={{ '--rk': RANKS[rank].color } as any}>
      {rank}
    </span>
  );
}

function RewardRow({ r }: { r: MissionReward }) {
  const keys = (['gems', 'tickets', 'yul', 'essence'] as const).filter((k) => (r[k] ?? 0) > 0);
  return (
    <div class="dsp-rew">
      {keys.map((k) => (
        <span key={k} class="dsp-rew-item">
          <CurrencyIcon kind={k} size={16} />
          {fmtShort(r[k]!)}
        </span>
      ))}
      {Object.entries(r.shards ?? {}).map(([id, n]) =>
        HERO_MAP[id] ? (
          <span key={id} class="dsp-rew-item">
            <span class="reward-face">
              <CharacterArt id={id} mode="portrait" />
            </span>
            {n} {HERO_MAP[id].name.split(' ')[0]} pages
          </span>
        ) : null,
      )}
    </div>
  );
}

function Face({ id, size = 34 }: { id: string; size?: number }) {
  const h = HERO_MAP[id];
  if (!h) return null;
  return (
    <span class="dsp-face" style={{ width: size, height: size, background: `radial-gradient(circle at 50% 35%, ${h.color}, #1b1330 78%)`, borderColor: RARITY_INFO[h.rarity].color }}>
      <CharacterArt id={id} mode="portrait" />
    </span>
  );
}

interface CardProps {
  m: DispatchMission;
  def: MissionDef;
  now: number;
  free: OwnedHero[];
  onAssign: () => void;
  onClaim: () => void;
  onRush: () => void;
  onRecall: () => void;
}

function MissionCard({ m, def, now, free, onAssign, onClaim, onRush, onRecall }: CardProps) {
  const status = missionStatus(m, def, now);
  const left = remainingMs(m, def, now);
  const pct = status === 'active' ? 100 * (1 - left / durationMs(def)) : status === 'idle' ? 0 : 100;
  const cost = status === 'active' ? finishNowCost(left) : 0;
  const carried = !def.id.startsWith(`${today(now)}#`) && status !== 'claimed';
  return (
    <div class={`dsp-card st-${status}`} style={{ '--rk': RANKS[def.rank].color } as any}>
      <RankStamp rank={def.rank} />
      <div class="dsp-main">
        <div class="dsp-title">
          <span class="dsp-title-ico">{def.icon}</span>
          {def.title}
        </div>
        <div class="dsp-meta">
          <span>⏱ {def.hours}h</span>
          <span>
            👥 {def.size} hero{def.size > 1 ? 'es' : ''}
          </span>
          {carried && <span class="dsp-carry">From yesterday</span>}
        </div>
        {def.reqs.length > 0 && (
          <div class="dsp-reqs">
            {def.reqs.map((q, i) => {
              // Running missions were checked at start; open ones warn when no free hero fits.
              const met = status !== 'idle';
              const possible = met || free.some((h) => heroMeets(q, h));
              return (
                <span key={i} class={`dsp-req ${met ? 'ok' : possible ? '' : 'no'}`}>
                  {met ? '✔' : possible ? reqIcon(q) : '✖'} {reqText(q)}
                </span>
              );
            })}
          </div>
        )}
        <RewardRow r={def.reward} />
      </div>

      <div class="dsp-foot">
        {status === 'idle' && (
          <>
            <span class="dsp-hint">Needs {def.size} free hero{def.size > 1 ? 'es' : ''}</span>
            <button class="btn blue small dsp-act" onClick={onAssign}>
              Assign
            </button>
          </>
        )}
        {status === 'active' && (
          <>
            <div class="dsp-faces">
              {m.heroes.map((id) => (
                <Face key={id} id={id} size={32} />
              ))}
            </div>
            <div class="dsp-timer">
              <div class="bar">
                <i style={{ width: `${pct}%` }} />
              </div>
              <span class="dsp-left">{formatDuration(left)} left</span>
            </div>
            <button class="icon-btn dsp-recall" onClick={onRecall} aria-label="Recall heroes">
              ↩
            </button>
            <button class="btn purple small dsp-rush" onClick={onRush} aria-label={`Finish now for ${cost} gems`}>
              <span class="cost">
                <CurrencyIcon kind="gems" size={16} />
                {cost}
              </span>
              Finish
            </button>
          </>
        )}
        {status === 'ready' && (
          <>
            <div class="dsp-faces">
              {m.heroes.map((id) => (
                <Face key={id} id={id} size={32} />
              ))}
            </div>
            <span class="dsp-done-text">Mission complete!</span>
            <button class="btn green small dsp-act dsp-claim" onClick={onClaim}>
              Claim!
            </button>
          </>
        )}
        {status === 'claimed' && <span class="dsp-hint">✔ Rewards collected</span>}
      </div>
      {status === 'claimed' && <span class="dsp-done-stamp">DONE</span>}
    </div>
  );
}

// ───────── hero picker sheet ─────────

function PickerSheet({ s, def, onClose, onStarted }: { s: SaveState; def: MissionDef; onClose: () => void; onStarted: () => void }) {
  const busy = useMemo(() => busyHeroes(s.dispatch), [s.dispatch.missions]);
  const [chosen, setChosen] = useState<string[]>([]);
  const owned = Object.values(s.heroes).filter((h) => h && HERO_MAP[h.id]);
  const chosenHeroes = chosen.map((id) => s.heroes[id]).filter(Boolean);
  const met = reqsMet(def, chosenHeroes);
  const check = checkTeam(def, chosen, s.heroes, busy);

  const sorted = useMemo(() => {
    const fits = (h: OwnedHero) => def.reqs.filter((q) => heroMeets(q, h)).length;
    return [...owned].sort(
      (a, b) =>
        Number(busy.has(a.id)) - Number(busy.has(b.id)) ||
        fits(b) - fits(a) ||
        heroPower(HERO_MAP[b.id], b.level, b.stars) - heroPower(HERO_MAP[a.id], a.level, a.stars),
    );
  }, [def.id, owned.length, busy]);

  const toggle = (id: string) => {
    if (busy.has(id)) {
      toast(`${HERO_MAP[id].name} is already on a mission.`);
      return;
    }
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length >= def.size ? [...c.slice(0, def.size - 1), id] : [...c, id]));
  };

  const autoPick = () => {
    const free = owned.filter((h) => !busy.has(h.id));
    const power = (h: OwnedHero) => heroPower(HERO_MAP[h.id], h.level, h.stars);
    const max = Math.max(1, ...free.map(power));
    const cost = (h: OwnedHero) => 1 + power(h) / max;
    const team = bestTeam(def, [...free].sort((a, b) => cost(a) - cost(b)), cost);
    if (team) setChosen(team);
    else toast('No free heroes fit every requirement yet.');
  };

  const freeCount = owned.filter((h) => !busy.has(h.id)).length;
  // One start per sheet, even on a double tap.
  const started = useRef(false);
  const start = () => {
    if (started.current) return;
    const res = startDispatch(def.id, chosen);
    if (!res.ok) {
      toast(res.reason);
      return;
    }
    started.current = true;
    toast(`${def.title}: squad deployed!`);
    onStarted();
  };

  return (
    <Modal onClose={onClose}>
      <div class="dsp-sheet">
        <div class="dsp-sheet-head">
          <RankStamp rank={def.rank} small />
          <div style={{ minWidth: 0 }}>
            <h3 class="dsp-sheet-title">{def.title}</h3>
            <div class="small-text muted">
              ⏱ {def.hours}h · send {def.size} hero{def.size > 1 ? 'es' : ''}
            </div>
          </div>
        </div>

        <div class="dsp-checks">
          <span class={`dsp-check ${chosen.length === def.size ? 'ok' : ''}`}>
            {chosen.length === def.size ? '✔' : '○'} {chosen.length}/{def.size} heroes
          </span>
          {def.reqs.map((q, i) => (
            <span key={i} class={`dsp-check ${met[i] ? 'ok' : ''}`}>
              {met[i] ? '✔' : '○'} {reqIcon(q)} {reqText(q)}
            </span>
          ))}
        </div>

        <div class="dsp-slots">
          {Array.from({ length: def.size }, (_, i) => {
            const id = chosen[i];
            return id ? (
              <button key={i} class="dsp-slot filled" onClick={() => toggle(id)} aria-label={`Remove ${HERO_MAP[id].name}`}>
                <Face id={id} size={58} />
                <span class="dsp-slot-x">✕</span>
              </button>
            ) : (
              <div key={i} class="dsp-slot">
                +
              </div>
            );
          })}
        </div>

        {owned.length === 0 ? (
          <div class="empty-hint">No heroes yet. Summon some first!</div>
        ) : (
          <div class="dsp-grid">
            {sorted.map((h) => {
              const d = HERO_MAP[h.id];
              const away = busy.has(h.id);
              const sel = chosen.includes(h.id);
              const helps = def.reqs.some((q, i) => !met[i] && heroMeets(q, h));
              return (
                <button key={h.id} class={`dsp-pick ${away ? 'away' : ''} ${sel ? 'sel' : ''}`} onClick={() => toggle(h.id)} aria-pressed={sel}>
                  <span class="dsp-pick-art" style={{ background: `radial-gradient(circle at 50% 35%, ${d.color}, #1b1330 78%)`, borderColor: RARITY_INFO[d.rarity].color }}>
                    <CharacterArt id={h.id} mode="portrait" />
                    <span class="dsp-pick-lv">Lv{h.level}</span>
                    <span class="dsp-pick-role">{ROLE_INFO[d.role].icon}</span>
                    {helps && !sel && !away && <span class="dsp-pick-fit">✓</span>}
                    {sel && <span class="dsp-pick-sel">✔</span>}
                    {away && <span class="dsp-pick-away">AWAY</span>}
                  </span>
                  <Stars n={h.stars} />
                  <span class="dsp-pick-name">{d.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        )}

        {owned.length > 0 && freeCount < def.size && (
          <div class="dsp-why">
            Only {freeCount} free hero{freeCount === 1 ? '' : 'es'} right now. This one needs {def.size}.
          </div>
        )}
        {!check.ok && chosen.length === def.size && <div class="dsp-why">{check.reason}</div>}
        <div class="dsp-sheet-foot">
          <button class="btn dark" onClick={autoPick}>
            Auto-pick
          </button>
          <button class="btn green dsp-start" disabled={!check.ok} onClick={start}>
            Start · {def.hours}h
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ───────── page ─────────

function DispatchPage(_: ScreenProps) {
  const s = useGame();
  const now = useNow(1000);
  const day = today(now);
  const [picking, setPicking] = useState<string | null>(null);
  const [loot, setLoot] = useState<{ reward: MissionReward; count: number } | null>(null);
  const [recall, setRecall] = useState<string | null>(null);

  // New day (or first visit): load the board. Runs in an effect, never during render.
  useEffect(() => {
    ensureBoard();
  }, [day]);

  const d = s.dispatch;
  const busy = busyHeroes(d);
  const free = Object.values(s.heroes).filter((h) => h && HERO_MAP[h.id] && !busy.has(h.id));
  const rows = d.missions
    .map((m, i) => ({ m, i, def: defOf(d, m.id) }))
    .filter((x): x is { m: DispatchMission; i: number; def: MissionDef } => !!x.def)
    .map((x) => ({ ...x, status: missionStatus(x.m, x.def, now) }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.i - b.i);
  const counts = { ready: 0, active: 0, idle: 0, claimed: 0 } as Record<MissionStatus, number>;
  rows.forEach((r) => counts[r.status]++);
  const pickingDef = picking ? defOf(d, picking) : undefined;

  const quick = () => {
    const n = quickDispatch();
    toast(n ? `Quick dispatch: ${n} mission${n > 1 ? 's' : ''} underway!` : counts.idle ? 'No free heroes fit the open missions.' : 'No open missions left today.');
  };
  const claimAll = () => {
    const res = claimDispatch();
    if (res) setLoot(res);
  };
  const claimOne = (id: string) => {
    const res = claimDispatch(Date.now(), id);
    if (res) setLoot(res);
  };
  const rush = (id: string) => {
    const res = rushDispatch(id);
    if ('error' in res) toast(res.error);
    else setLoot(res);
  };

  return (
    <div class="screen dsp-screen">
      <div class="panel dsp-head">
        <div class="spread">
          <div>
            <h3 class="panel-title" style={{ margin: 0 }}>
              Mission Board
            </h3>
            <div class="small-text muted">New board in {formatDuration(msToNextDay(now))}</div>
          </div>
          <div class="dsp-counts">
            {counts.ready > 0 && <span class="chip dsp-chip-ready">{counts.ready} ready</span>}
            <span class="chip">{counts.active} out</span>
            <span class="chip">{counts.idle} open</span>
          </div>
        </div>
        <div class="row dsp-head-btns">
          <button class="btn green small" style={{ flex: 1 }} disabled={!counts.idle} onClick={quick}>
            ⚡ Quick Dispatch
          </button>
          <button class="btn small" style={{ flex: 1 }} disabled={!counts.ready} onClick={claimAll}>
            🎁 Claim All{counts.ready ? ` (${counts.ready})` : ''}
          </button>
        </div>
        <div class="small-text muted dsp-tip">Heroes on missions can still fight. Every mission succeeds. Rewards grow as you clear more stages.</div>
      </div>

      {rows.length === 0 ? (
        <div class="empty-hint">Pinning up today's missions…</div>
      ) : (
        <div class="dsp-list">
          {rows.map(({ m, def }) => (
            <MissionCard
              key={m.id}
              m={m}
              def={def}
              now={now}
              free={free}
              onAssign={() => setPicking(m.id)}
              onClaim={() => claimOne(m.id)}
              onRush={() => rush(m.id)}
              onRecall={() => setRecall(m.id)}
            />
          ))}
        </div>
      )}

      {pickingDef && <PickerSheet s={s} def={pickingDef} onClose={() => setPicking(null)} onStarted={() => setPicking(null)} />}

      {recall && (
        <Modal center onClose={() => setRecall(null)}>
          <h2 class="panel-title">Recall the squad?</h2>
          <p style={{ margin: '0 0 12px' }}>They come home now and the mission resets. No rewards for an unfinished job.</p>
          <div class="row">
            <button class="btn dark" style={{ flex: 1 }} onClick={() => setRecall(null)}>
              Keep going
            </button>
            <button
              class="btn red"
              style={{ flex: 1 }}
              onClick={() => {
                recallDispatch(recall);
                setRecall(null);
              }}
            >
              Recall
            </button>
          </div>
        </Modal>
      )}

      {loot && (
        <Modal center onClose={() => setLoot(null)}>
          <h2 class="panel-title">{loot.count > 1 ? `${loot.count} missions complete!` : 'Mission complete!'}</h2>
          <RewardList r={loot.reward} />
          <button class="btn green block" onClick={() => setLoot(null)}>
            Nice!
          </button>
        </Modal>
      )}
    </div>
  );
}

export const dispatchScreen: ScreenDef = {
  id: 'dispatch',
  title: 'Missions',
  icon: '📜',
  blurb: "Send heroes on timed missions while you're away.",
  unlockStage: 3,
  component: DispatchPage,
  badge: (s) => hasReady(s.dispatch, Date.now()),
};
