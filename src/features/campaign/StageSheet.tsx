// Bottom sheet for one stage node: enemies, power check, rewards, stars and the fight button.
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CharacterArt } from '../../art/CharacterArt';
import { STAGES_PER_CHAPTER, getStage } from '../../data/campaign';
import { getHero } from '../../data/heroes';
import { teamPower } from '../../game/power';
import type { SaveState } from '../../game/state';
import { fmt } from '../../game/stats';
import { playerTeam } from '../../game/store';
import { CurrencyIcon, Portal } from '../../ui/components/common';
import type { Nav } from '../../ui/nav';
import { reducedMotion } from '../../ui/prefs';
import { STAR_RULES, stageStars } from './stars';
import { powerVerdict } from './verdict';

/** Fixed bottom sheet with its own slide in/out (portalled over the whole phone frame).
 * Children get `close` to dismiss with the slide-out animation. */
export function Sheet({ onClose, children, label }: { onClose: () => void; children: (close: () => void) => ComponentChildren; label: string }) {
  const [closing, setClosing] = useState(false);
  const done = useRef(false);
  const close = () => {
    if (done.current) return;
    setClosing(true);
    setTimeout(
      () => {
        if (done.current) return;
        done.current = true;
        onClose();
      },
      reducedMotion() ? 0 : 190,
    );
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // The chest celebration sits on top and takes Escape first.
      if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('.cmap-party')) return;
      e.preventDefault();
      close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <Portal>
      <div class={`cmap-sheet-wrap ${closing ? 'out' : ''}`} onClick={(e) => e.target === e.currentTarget && close()}>
        <div class="cmap-sheet" role="dialog" aria-label={label}>
          <div class="cmap-grab" aria-hidden="true" />
          <button class="icon-btn cmap-sheet-x" onClick={close} aria-label="Close">
            ✕
          </button>
          {children(close)}
        </div>
      </div>
    </Portal>
  );
}

interface StageSheetProps {
  stage: number;
  s: SaveState;
  nav: Nav;
  onClose: () => void;
  /** Scroll the map to a stage and open its sheet. */
  onJump: (stage: number) => void;
}

export function StageSheet({ stage, s, nav, onClose, onJump }: StageSheetProps) {
  const info = useMemo(() => getStage(stage), [stage]);
  const cleared = s.stage;
  const status = stage < cleared ? 'cleared' : stage === cleared ? 'current' : 'locked';
  const myPower = teamPower(playerTeam(s));
  const enemyPower = useMemo(() => teamPower(info.team), [info]);
  const v = powerVerdict(myPower, enemyPower);
  const stars = stageStars(s.campaign, cleared, stage);
  const squadEmpty = !(s.squad?.slots ?? []).some((id) => !!id && !!s.heroes[id]);
  const loop = info.loop;
  const prev = stage > 0 ? getStage(stage - 1) : null;
  const chapterNo = info.chapterIdx + 1;

  const fight = () => {
    if (squadEmpty) {
      nav.go('squad');
      onClose();
      return;
    }
    onClose();
    nav.fight(stage);
  };

  return (
    <Sheet onClose={onClose} label={`Stage ${info.label}`}>
      {(close) => (
      <>
      <div class="cmap-sheet-head" style={{ background: `linear-gradient(120deg, ${info.chapter.sky[0]}, ${info.chapter.sky[1]})` }}>
        <span class={`cmap-sheet-lbl ${info.isBoss ? 'boss' : ''}`}>{info.label}</span>
        <div class="cmap-sheet-title">
          <h3>{info.isBoss ? 'Boss Battle' : `Stage ${info.num} of ${STAGES_PER_CHAPTER}`}</h3>
          <div class="cmap-sheet-sub">
            {info.isBoss ? getHero(info.chapter.boss).name : info.chapter.name}
            {loop ? ` · Abyss ${loop}` : ''} · Ch. {chapterNo}
          </div>
        </div>
        <div class="cmap-sheet-stars" aria-label={`${stars} of 3 stars`}>
          {[1, 2, 3].map((i) => (
            <span key={i} class={i <= stars ? 'on' : ''}>
              ★
            </span>
          ))}
        </div>
      </div>

      <div class="cmap-sheet-body">
        <div class="spread small-text muted">
          <span>
            Enemy Lv {info.level} · {info.team.formation.name}
          </span>
          <span class="chip" style={{ color: v.color }}>
            {v.label}
          </span>
        </div>
        <div class="lineup cmap-lineup">
          {info.team.members.map((m) => {
            const h = getHero(m.heroId);
            return (
              <div class={`mini ${m.boss ? 'boss' : ''}`} key={m.slot} title={h.name} style={{ background: `radial-gradient(circle at 50% 35%, ${h.color}, #1b1330 75%)` }}>
                <CharacterArt id={m.heroId} mode="portrait" flip />
                {m.boss && <span class="cmap-mini-boss">BOSS</span>}
                <div class="lv">Lv{m.level}</div>
              </div>
            );
          })}
        </div>

        <div class="cmap-vs">
          <div>
            <div class="small-text muted">Your squad</div>
            <div class="power">⚡{fmt(myPower)}</div>
          </div>
          <div class="comic cmap-vs-mid">VS</div>
          <div style={{ textAlign: 'right' }}>
            <div class="small-text muted">Enemies</div>
            <div class="power" style={{ color: '#ff9a9a' }}>
              ⚡{fmt(enemyPower)}
            </div>
          </div>
        </div>
        <div class="cmap-tug" aria-hidden="true">
          <i style={{ width: `${Math.round(v.share * 100)}%` }} />
        </div>

        <div class="cmap-rewards">
          <div class="cmap-rw-col">
            <div class="cmap-rw-h">Rewards</div>
            <div class="row" style={{ gap: 10 }}>
              <span class="cmap-rw">
                <CurrencyIcon kind="yul" size={18} />
                {fmt(info.rewards.yul)}
              </span>
              <span class="cmap-rw">
                <CurrencyIcon kind="essence" size={18} />
                {fmt(info.rewards.essence)}
              </span>
            </div>
          </div>
          <div class={`cmap-rw-col ${status === 'cleared' ? 'done' : ''}`}>
            <div class="cmap-rw-h">{status === 'cleared' ? 'First clear ✓' : 'First clear'}</div>
            <div class="row" style={{ gap: 10 }}>
              <span class="cmap-rw">
                <CurrencyIcon kind="gems" size={18} />
                {info.firstClear.gems}
              </span>
              {info.firstClear.tickets ? (
                <span class="cmap-rw">
                  <CurrencyIcon kind="tickets" size={18} />
                  {info.firstClear.tickets}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div class="cmap-rules">
          {STAR_RULES.map((r) => (
            <div key={r.stars} class={`cmap-rule ${stars >= r.stars ? 'got' : ''}`}>
              <span class="cmap-rule-stars">{'★'.repeat(r.stars)}</span>
              <span>{r.text}</span>
              <span class="cmap-rule-check">{stars >= r.stars ? '✓' : ''}</span>
            </div>
          ))}
        </div>

        {status === 'locked' ? (
          <div class="cmap-locked">
            <div>
              🔒 Clear <b>{prev?.label}</b> first.
            </div>
            {stage - 1 > cleared && (
              <button
                class="btn small"
                onClick={() => {
                  close();
                  onJump(cleared);
                }}
              >
                Go to {getStage(cleared).label}
              </button>
            )}
          </div>
        ) : (
          <div class="row cmap-actions">
            <button
              class="btn dark"
              onClick={() => {
                onClose();
                nav.go('squad');
              }}
            >
              Edit Squad
            </button>
            <button class="btn red big cmap-fight" onClick={fight}>
              {squadEmpty ? 'Pick a Squad' : status === 'cleared' ? 'Replay' : 'Battle!'}
            </button>
          </div>
        )}
      </div>
      </>
      )}
    </Sheet>
  );
}
