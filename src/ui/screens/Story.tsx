import { useState } from 'preact/hooks';
import { CharacterArt } from '../../art/CharacterArt';
import { CHAPTERS } from '../../data/campaign';

const PANEL_BG = ['#ffe9a8', '#bfe3ff', '#ffc4c4'];

/** Comic-book chapter intro, one panel revealed per tap. */
export function Story({ chapter, onDone }: { chapter: number; onDone: () => void }) {
  const ch = CHAPTERS[chapter % CHAPTERS.length];
  const [shown, setShown] = useState(1);
  const next = () => (shown >= ch.story.length ? onDone() : setShown(shown + 1));
  return (
    <div class="story" onClick={next}>
      <div class="st-title">
        <div class="sub">Chapter {chapter + 1}</div>
        <h2>{ch.name}</h2>
        <div class="sub" style={{ color: '#c62828' }}>
          {ch.subtitle}
        </div>
      </div>
      <div class="panels">
        {ch.story.slice(0, shown).map((p, i) => {
          const right = i % 2 === 1;
          return (
            <div class="cpanel" key={i} style={{ '--pb': `linear-gradient(${right ? 225 : 135}deg, ${PANEL_BG[i % 3]}, #fff 70%)` } as any}>
              <div class="p-art" style={right ? { right: -6 } : { left: -6 }}>
                {p.heroId && <CharacterArt id={p.heroId} mode="full" flip={right} />}
              </div>
              <div class="bubble" style={right ? { left: 12 } : { right: 12 }}>
                <b>{p.speaker}</b>
                {p.text}
              </div>
            </div>
          );
        })}
      </div>
      <div class="tap-hint">{shown >= ch.story.length ? 'TAP TO BATTLE!' : 'TAP TO CONTINUE'}</div>
      <button
        class="btn dark small"
        style={{ position: 'absolute', top: 'calc(10px + var(--safe-top))', right: 10 }}
        onClick={(e) => {
          e.stopPropagation();
          onDone();
        }}
      >
        Skip
      </button>
    </div>
  );
}
