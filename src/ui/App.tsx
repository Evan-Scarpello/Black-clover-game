import { useEffect, useState } from 'preact/hooks';
import { STAGES_PER_CHAPTER } from '../data/campaign';
import { BONUS_QUEST, DAILY_QUESTS, claimable } from '../game/quests';
import { fmtShort } from '../game/stats';
import { afkPending, markChapterSeen, saveNow, startSession, useGame } from '../game/store';
import { CurrencyIcon, Toasts, formatDuration } from './components/common';
import { BattleScreen } from './screens/Battle';
import { Campaign } from './screens/Campaign';
import { HeroDetail } from './screens/HeroDetail';
import { Heroes } from './screens/Heroes';
import { Home } from './screens/Home';
import { Quests } from './screens/Quests';
import { Settings } from './screens/Settings';
import { Squad } from './screens/Squad';
import { Story } from './screens/Story';
import { Summon } from './screens/Summon';
import { Tutorial } from './screens/Tutorial';
import { Modal } from './components/common';
import { sfx } from './sfx';

export type Tab = 'home' | 'heroes' | 'campaign' | 'squad' | 'summon';

export interface Nav {
  go: (t: Tab) => void;
  openHero: (id: string) => void;
  fight: (stage: number) => void;
  openQuests: () => void;
}

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Base', icon: '🏰' },
  { id: 'heroes', label: 'Heroes', icon: '🧙' },
  { id: 'campaign', label: 'Battle', icon: '⚔️' },
  { id: 'squad', label: 'Squad', icon: '🛡️' },
  { id: 'summon', label: 'Summon', icon: '📖' },
];

export function App() {
  const s = useGame();
  const [tab, setTab] = useState<Tab>('home');
  const [hero, setHero] = useState<string | null>(null);
  const [battle, setBattle] = useState<number | null>(null);
  const [story, setStory] = useState<{ chapter: number; then: number } | null>(null);
  const [welcome, setWelcome] = useState<number | null>(null);
  const [quests, setQuests] = useState(false);
  const [settings, setSettings] = useState(false);

  useEffect(() => {
    const away = startSession();
    if (away > 120000 && s.tutorialDone) setWelcome(away);
    const onVis = () => {
      if (document.visibilityState === 'hidden') saveNow();
      else {
        const gone = startSession();
        if (gone > 120000) setWelcome(gone);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', saveNow);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', saveNow);
    };
  }, []);

  const nav: Nav = {
    go: (t) => {
      sfx.click();
      setTab(t);
    },
    openHero: (id) => setHero(id),
    fight: (stage) => {
      const chapter = Math.floor(stage / STAGES_PER_CHAPTER);
      if (chapter > s.seenChapter) setStory({ chapter, then: stage });
      else setBattle(stage);
    },
    openQuests: () => setQuests(true),
  };

  const questBadge = [...DAILY_QUESTS, BONUS_QUEST].some((q) => claimable(s, q));
  const afkFull = afkPending().hours >= 1;

  return (
    <div class="shell">
      <div class="topbar">
        {(['yul', 'essence', 'gems', 'tickets'] as const).map((k) => (
          <div class="currency" key={k}>
            <CurrencyIcon kind={k} />
            <span>{fmtShort(s.currencies[k])}</span>
          </div>
        ))}
        <button class="icon-btn" onClick={() => setQuests(true)} aria-label="Quests" style={{ position: 'relative' }}>
          📜{questBadge && <span class="badge-dot" style={{ top: -4, right: -4 }} />}
        </button>
        <button class="icon-btn" onClick={() => setSettings(true)} aria-label="Settings">
          ⚙️
        </button>
      </div>

      <div class="content" key={tab}>
        {tab === 'home' && <Home nav={nav} />}
        {tab === 'heroes' && <Heroes nav={nav} />}
        {tab === 'campaign' && <Campaign nav={nav} />}
        {tab === 'squad' && <Squad nav={nav} />}
        {tab === 'summon' && <Summon nav={nav} />}
      </div>

      <nav class="navbar" style={{ gridTemplateColumns: `repeat(${NAV.length}, 1fr)` }}>
        {NAV.map((n) => (
          <button key={n.id} class={`nav-item ${tab === n.id ? 'active' : ''} ${n.id === 'campaign' ? 'nav-battle' : ''}`} onClick={() => nav.go(n.id)}>
            <span class="nav-ico">{n.icon}</span>
            {n.label}
            {n.id === 'home' && afkFull && tab !== 'home' && <span class="badge-dot" />}
          </button>
        ))}
      </nav>

      {hero && <HeroDetail id={hero} onClose={() => setHero(null)} onNavigate={setHero} />}
      {quests && <Quests onClose={() => setQuests(false)} />}
      {settings && <Settings onClose={() => setSettings(false)} />}

      {story && (
        <Story
          chapter={story.chapter}
          onDone={() => {
            markChapterSeen(story.chapter);
            setBattle(story.then);
            setStory(null);
          }}
        />
      )}

      {battle !== null && (
        <BattleScreen
          key={battle}
          stage={battle}
          onExit={() => setBattle(null)}
          onNext={(next) => {
            const chapter = Math.floor(next / STAGES_PER_CHAPTER);
            if (chapter > getSeen()) {
              setBattle(null);
              setStory({ chapter, then: next });
            } else setBattle(next);
          }}
        />
      )}

      {welcome !== null && (
        <Modal center onClose={() => setWelcome(null)}>
          <h2 class="panel-title">Welcome back, Magic Knight!</h2>
          <p style={{ margin: '0 0 8px' }}>
            You were away for <b>{formatDuration(welcome)}</b>. Your squad kept fighting — the AFK chest at the base has filled up.
          </p>
          <button
            class="btn green block"
            onClick={() => {
              setWelcome(null);
              setTab('home');
            }}
          >
            To the Hideout!
          </button>
        </Modal>
      )}

      {!s.tutorialDone && <Tutorial />}
      <Toasts />
    </div>
  );

  function getSeen() {
    return s.seenChapter;
  }
}
