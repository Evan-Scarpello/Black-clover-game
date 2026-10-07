import { useMemo, useState } from 'preact/hooks';
import { CharacterArt } from '../../art/CharacterArt';
import { CHAPTERS, STAGES_PER_CHAPTER, getStage } from '../../data/campaign';
import { getHero } from '../../data/heroes';
import { teamPower } from '../../game/power';
import { fmt } from '../../game/stats';
import { playerTeam, useGame } from '../../game/store';
import type { Nav } from '../App';
import { CurrencyIcon } from '../components/common';

export function Campaign({ nav }: { nav: Nav }) {
  const s = useGame();
  const currentChapter = Math.floor(s.stage / STAGES_PER_CHAPTER);
  const [chapter, setChapter] = useState(currentChapter);
  const [sel, setSel] = useState(s.stage);
  const ch = CHAPTERS[chapter % CHAPTERS.length];
  const loop = Math.floor(chapter / CHAPTERS.length);
  const first = chapter * STAGES_PER_CHAPTER;
  const info = useMemo(() => getStage(sel), [sel]);
  const myPower = teamPower(playerTeam(s));
  const enemyPower = teamPower(info.team);
  const ratio = myPower / Math.max(1, enemyPower);
  const verdict = ratio >= 1.15 ? ['Easy', '#7dff9b'] : ratio >= 0.95 ? ['Even', '#ffd166'] : ratio >= 0.8 ? ['Tough', '#ffa26b'] : ['Deadly', '#ff6b6b'];

  const changeChapter = (d: number) => {
    const c = Math.max(0, Math.min(currentChapter, chapter + d));
    setChapter(c);
    setSel(Math.min(s.stage, c * STAGES_PER_CHAPTER + STAGES_PER_CHAPTER - 1));
  };

  return (
    <div class="screen">
      <div class="chapter-nav">
        <button class="btn dark small" disabled={chapter === 0} onClick={() => changeChapter(-1)}>
          ◀
        </button>
        <div class="comic" style={{ fontSize: 18, color: 'var(--muted)' }}>
          Chapter {chapter + 1}
          {loop ? ` · Abyss ${loop}` : ''}
        </div>
        <button class="btn dark small" disabled={chapter >= currentChapter} onClick={() => changeChapter(1)}>
          ▶
        </button>
      </div>

      <div class="chapter-hero" style={{ background: `linear-gradient(135deg, ${ch.sky[0]}, ${ch.sky[1]})` }}>
        <div class="field-bg" style={{ position: 'absolute', inset: 0 }}>
          <div class="hatch" />
        </div>
        <div class="ch-text">
          <h2>{ch.name}</h2>
          <div class="chip" style={{ marginTop: 6, background: 'rgba(0,0,0,.5)' }}>
            {ch.subtitle}
          </div>
        </div>
        <div class="ch-art">
          <CharacterArt id={ch.boss} mode="full" flip />
        </div>
      </div>

      <div class="panel">
        <div class="stage-path">
          {Array.from({ length: STAGES_PER_CHAPTER }, (_, k) => {
            const idx = first + k;
            const cleared = idx < s.stage;
            const current = idx === s.stage;
            const locked = idx > s.stage;
            const boss = k === STAGES_PER_CHAPTER - 1;
            return (
              <button
                key={idx}
                class={`stage-node ${cleared ? 'cleared' : ''} ${current ? 'current' : ''} ${locked ? 'locked' : ''} ${boss ? 'boss' : ''} ${sel === idx ? 'sel' : ''}`}
                disabled={locked}
                onClick={() => setSel(idx)}
              >
                {boss ? '☠' : k + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div class="panel">
        <div class="spread">
          <h3 class="panel-title" style={{ margin: 0 }}>
            Stage {info.label}
          </h3>
          <span class="chip" style={{ color: verdict[1] }}>
            {verdict[0]}
          </span>
        </div>
        <div class="small-text muted" style={{ margin: '2px 0 10px' }}>
          {info.name} · Enemy Lv {info.level} · {info.team.formation.name}
        </div>
        <div class="lineup">
          {info.team.members.map((m) => {
            const h = getHero(m.heroId);
            return (
              <div class={`mini ${m.boss ? 'boss' : ''}`} key={m.slot} title={h.name} style={{ background: `radial-gradient(circle at 50% 35%, ${h.color}, #1b1330 75%)` }}>
                <CharacterArt id={m.heroId} mode="portrait" flip />
                <div class="lv">
                  {m.boss ? 'BOSS ' : ''}Lv{m.level}
                </div>
              </div>
            );
          })}
        </div>
        <div class="spread" style={{ margin: '12px 0 6px' }}>
          <div>
            <div class="small-text muted">Your squad</div>
            <div class="power" style={{ fontSize: 22 }}>
              ⚡{fmt(myPower)}
            </div>
          </div>
          <div class="comic" style={{ fontSize: 20, color: 'var(--muted)' }}>
            VS
          </div>
          <div style={{ textAlign: 'right' }}>
            <div class="small-text muted">Enemies</div>
            <div class="power" style={{ fontSize: 22, color: '#ff9a9a' }}>
              ⚡{fmt(enemyPower)}
            </div>
          </div>
        </div>
        <div class="row small-text" style={{ justifyContent: 'center', gap: 12, margin: '6px 0 10px', fontWeight: 900 }}>
          <span class="row" style={{ gap: 3 }}>
            <CurrencyIcon kind="yul" size={16} />
            {fmt(info.rewards.yul)}
          </span>
          <span class="row" style={{ gap: 3 }}>
            <CurrencyIcon kind="essence" size={16} />
            {fmt(info.rewards.essence)}
          </span>
          {sel >= s.stage && (
            <span class="row" style={{ gap: 3, color: 'var(--green)' }}>
              First clear: <CurrencyIcon kind="gems" size={16} />
              {info.firstClear.gems}
              {info.firstClear.tickets ? (
                <>
                  <CurrencyIcon kind="tickets" size={16} />
                  {info.firstClear.tickets}
                </>
              ) : null}
            </span>
          )}
        </div>
        <div class="row">
          <button class="btn dark" onClick={() => nav.go('squad')}>
            Edit Squad
          </button>
          <button class="btn red big" style={{ flex: 1 }} onClick={() => nav.fight(sel)}>
            {sel < s.stage ? 'Replay' : 'Battle!'}
          </button>
        </div>
      </div>
    </div>
  );
}
