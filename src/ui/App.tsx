import { useEffect, useRef, useState } from 'preact/hooks';
import { STAGES_PER_CHAPTER } from '../data/campaign';
import { campaignBattle } from '../features/campaign/adapter';
import { BONUS_QUEST, DAILY_QUESTS, claimable } from '../game/quests';
import { fmtShort } from '../game/stats';
import { afkPending, getState, markChapterSeen, saveNow, startSession, useGame } from '../game/store';
import { CurrencyIcon, Modal, Toasts, formatDuration, toast } from './components/common';
import type { BattleSpec, Nav, ScreenId, Tab } from './nav';
import { BattleScreen } from './screens/Battle';
import { Campaign } from './screens/Campaign';
import { HeroDetail } from './screens/HeroDetail';
import { Heroes } from './screens/Heroes';
import { Home } from './screens/Home';
import { Quests } from './screens/Quests';
import { SCREEN_MAP } from './screens/registry';
import { Settings } from './screens/Settings';
import { Squad } from './screens/Squad';
import { Story } from './screens/Story';
import { Summon } from './screens/Summon';
import { Tutorial } from './screens/Tutorial';
import { sfx } from './sfx';

export type { Nav, Tab } from './nav';

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Base', icon: '🏰' },
  { id: 'heroes', label: 'Heroes', icon: '🧙' },
  { id: 'campaign', label: 'Battle', icon: '⚔️' },
  { id: 'squad', label: 'Squad', icon: '🛡️' },
  { id: 'summon', label: 'Summon', icon: '📖' },
];

interface PageEntry {
  id: ScreenId;
  params?: Record<string, unknown>;
  key: number;
}

export function App() {
  const s = useGame();
  const [tab, setTab] = useState<Tab>('home');
  const [stack, setStack] = useState<PageEntry[]>([]);
  const [hero, setHero] = useState<string | null>(null);
  const [battle, setBattle] = useState<BattleSpec | null>(null);
  const [story, setStory] = useState<{ chapter: number; then: number } | null>(null);
  const [welcome, setWelcome] = useState<number | null>(null);
  const [quests, setQuests] = useState(false);
  const [settings, setSettings] = useState(false);
  const pageKey = useRef(1);

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
    tab,
    go: (t) => {
      sfx.click();
      setStack([]);
      setTab(t);
    },
    open: (id, params) => {
      const def = SCREEN_MAP[id];
      if (!def) return;
      if ((def.unlockStage ?? 0) > getState().stage) {
        toast(`${def.title} unlocks after clearing ${def.unlockStage} campaign stages.`);
        return;
      }
      sfx.click();
      setStack((st) => [...st, { id, params, key: pageKey.current++ }]);
    },
    back: () => setStack((st) => st.slice(0, -1)),
    openHero: (id) => setHero(id),
    fight: (stage) => {
      const chapter = Math.floor(stage / STAGES_PER_CHAPTER);
      if (chapter > getState().seenChapter) {
        setBattle(null);
        setStory({ chapter, then: stage });
      } else setBattle(campaignBattle(stage, nav));
    },
    battle: (spec) => setBattle(spec),
    closeBattle: () => setBattle(null),
    openQuests: () => setQuests(true),
  };

  const questBadge = [...DAILY_QUESTS, BONUS_QUEST].some((q) => claimable(s, q));
  const afkFull = afkPending().hours >= 1;
  const top = stack[stack.length - 1];
  const TopPage = top ? SCREEN_MAP[top.id] : null;

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

      {top && TopPage && (
        <div class="page" key={top.key}>
          <div class="page-head">
            <button class="icon-btn" onClick={nav.back} aria-label="Back">
              ◀
            </button>
            <h2 class="page-title">
              <span>{TopPage.icon}</span> {TopPage.title}
            </h2>
          </div>
          <div class="page-body">
            <TopPage.component nav={nav} params={top.params} />
          </div>
        </div>
      )}

      <nav class="navbar" style={{ gridTemplateColumns: `repeat(${NAV.length}, 1fr)` }}>
        {NAV.map((n) => (
          <button key={n.id} class={`nav-item ${tab === n.id && !top ? 'active' : ''} ${n.id === 'campaign' ? 'nav-battle' : ''}`} onClick={() => nav.go(n.id)}>
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
            setBattle(campaignBattle(story.then, nav));
            setStory(null);
          }}
        />
      )}

      {battle && <BattleScreen key={battle.key} spec={battle} onExit={() => setBattle(null)} />}

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
              setStack([]);
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
}
