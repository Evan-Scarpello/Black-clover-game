import { useState } from 'preact/hooks';
import { CharacterArt } from '../../art/CharacterArt';
import { finishTutorial } from '../../game/store';
import { haptic } from '../haptics';
import { sfx } from '../sfx';
import './settings.css';

const PAGES = [
  {
    hero: 'yami',
    title: 'Welcome to the Black Bulls!',
    items: [
      <>Build a <b>squad of 5</b> heroes — Attackers, Defenders and Supports.</>,
      <>Battles are <b>automatic</b>. Heroes charge energy and unleash <b>Ultimates</b> — tap a glowing portrait to fire one yourself.</>,
      <>Your squad keeps earning <b>AFK rewards</b> while you're away. Collect them from the chest at the hideout.</>,
    ],
  },
  {
    hero: 'finral',
    title: 'Formations Matter!',
    items: [
      <>The <b>front row</b> takes the hits; the <b>back row</b> is protected until the front falls.</>,
      <>Every hero has a <b>Formation Trait</b> that changes with their row — put them where they shine.</>,
      <>Some ultimates <b>shift formations mid-battle</b>: Finral swaps the wounded to safety, Henry rebuilds the line, Charlotte and Langris drag enemies forward.</>,
      <>Field heroes from the same squad for <b>synergy bonuses</b>, and pair rivals like Asta & Yuno for <b>bonds</b>.</>,
    ],
  },
  {
    hero: 'asta',
    title: 'Summon Your Legends!',
    items: [
      <>Use gems or tickets at the <b>Grimoire Tower</b> to summon heroes and villains: <b>Rare, Epic, Legendary and Mythic</b>.</>,
      <>Your first ×10 summon <b>guarantees a Legendary</b>. You start with 3,000 gems and 10 tickets!</>,
      <>Duplicates become grimoire pages to <b>Star Up</b> heroes and raise their level cap.</>,
    ],
  },
];

export function Tutorial() {
  const [page, setPage] = useState(0);
  const p = PAGES[page];
  const next = () => {
    sfx.click();
    haptic('tap');
    setPage((n) => Math.min(PAGES.length - 1, n + 1));
  };
  return (
    <div class="tutorial" role="dialog" aria-modal="true" aria-label="How to play">
      <div class="panel tut-panel" key={page}>
        <div class="tut-hero">
          <CharacterArt id={p.hero} mode="full" />
        </div>
        <h2 class="panel-title" style={{ justifyContent: 'center', fontSize: 26 }}>
          {p.title}
        </h2>
        <ul>
          {p.items.map((x, i) => (
            <li key={i} style={{ animationDelay: `${0.12 + i * 0.07}s` }}>
              {x}
            </li>
          ))}
        </ul>
        <div class="spread">
          <span class="tut-dots" aria-label={`Page ${page + 1} of ${PAGES.length}`}>
            {PAGES.map((_, i) => (
              <i key={i} class={i === page ? 'on' : i < page ? 'done' : ''} />
            ))}
          </span>
          {page < PAGES.length - 1 ? (
            <button class="btn" onClick={next}>
              Next
            </button>
          ) : (
            <button
              class="btn green"
              onClick={() => {
                haptic('success');
                finishTutorial();
              }}
            >
              Let's go!
            </button>
          )}
        </div>
        {page < PAGES.length - 1 && (
          <button class="tut-skip" onClick={finishTutorial}>
            Skip intro
          </button>
        )}
      </div>
    </div>
  );
}
