import { useState } from 'preact/hooks';
import { CharacterArt } from '../../art/CharacterArt';
import { finishTutorial } from '../../game/store';

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
  return (
    <div class="tutorial">
      <div class="panel" style={{ position: 'relative', paddingTop: 70 }}>
        <div style={{ position: 'absolute', top: -70, left: '50%', transform: 'translateX(-50%)', width: 120, height: 140 }}>
          <CharacterArt id={p.hero} mode="full" />
        </div>
        <h2 class="panel-title" style={{ justifyContent: 'center', fontSize: 26 }}>
          {p.title}
        </h2>
        <ul>
          {p.items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
        <div class="spread">
          <span class="small-text muted">
            {page + 1} / {PAGES.length}
          </span>
          {page < PAGES.length - 1 ? (
            <button class="btn" onClick={() => setPage(page + 1)}>
              Next
            </button>
          ) : (
            <button class="btn green" onClick={finishTutorial}>
              Let's go!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
