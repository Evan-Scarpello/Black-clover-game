import { memo } from 'preact/compat';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { STAGES_PER_CHAPTER } from '../data/campaign';
import { getHero } from '../data/heroes';
import { campaignBattle } from '../features/campaign/adapter';
import { BONUS_QUEST, DAILY_QUESTS, claimable } from '../game/quests';
import type { SaveState } from '../game/state';
import { MAX_STARS, fmt, fmtShort, starUpCost } from '../game/stats';
import { afkPending, getState, markChapterSeen, saveNow, startSession, useGame } from '../game/store';
import { CURRENCY_NAMES, CurrencyIcon, Modal, Toasts, formatDuration, toast } from './components/common';
import { FlyLayer, useCountUp } from './components/fx';
import { onIdle, setX, settleMs, slideX, swipeAllowedFrom } from './gestures';
import { haptic } from './haptics';
import { TAB_ORDER, VelocityTracker, classifyIntent, deltaText, neighborTab, rubberBand, shouldCommit, stageLabel, tabDirection, tabIndex } from './motion';
import type { BattleSpec, Nav, ScreenId, Tab } from './nav';
import { motionPref, onPrefsChange, reducedMotion } from './prefs';
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

const TOP_CURRENCIES = ['yul', 'essence', 'gems', 'tickets'] as const;

interface PageEntry {
  id: ScreenId;
  params?: Record<string, unknown>;
  key: number;
  /** 'anim' plays the slide-out; 'drag' was already swiped away by the finger. */
  leaving?: 'anim' | 'drag';
}

type PaneMode = 'tap' | 'swipe' | 'none';

/** Edge-swipe zone for "back" on feature pages (px from the left edge). */
const EDGE = 24;

function starUpReady(s: SaveState): boolean {
  return Object.values(s.heroes).some((h) => {
    try {
      return h.stars < MAX_STARS && h.shards >= starUpCost(getHero(h.id), h.stars);
    } catch {
      return false;
    }
  });
}

// ───────── top bar ─────────

const CurrencyChip = memo(function CurrencyChip({ kind, value }: { kind: (typeof TOP_CURRENCIES)[number]; value: number }) {
  const { shown, change } = useCountUp(value);
  return (
    <button
      class={`currency ${change ? (change.dir > 0 ? 'gain' : 'spend') : ''}`}
      data-currency={kind}
      aria-label={`${CURRENCY_NAMES[kind]}: ${fmt(value)}`}
      onClick={() => toast(`${CURRENCY_NAMES[kind]}: ${Math.floor(value).toLocaleString('en-US')}`)}
    >
      <span class="cur-ico" key={`i${change?.key ?? 0}`}>
        <CurrencyIcon kind={kind} />
      </span>
      <span class="cur-val">{fmtShort(Math.round(shown))}</span>
      {change && (
        <span key={`d${change.key}`} class={`cur-delta ${change.dir > 0 ? 'up' : 'down'}`} aria-hidden="true">
          {deltaText(change.delta, fmtShort)}
        </span>
      )}
    </button>
  );
});

// ───────── tab panes (kept alive once visited) ─────────

const TabScreen = memo(function TabScreen({ tab, nav }: { tab: Tab; nav: Nav }) {
  switch (tab) {
    case 'home':
      return <Home nav={nav} />;
    case 'heroes':
      return <Heroes nav={nav} />;
    case 'campaign':
      return <Campaign nav={nav} />;
    case 'squad':
      return <Squad nav={nav} />;
    case 'summon':
      return <Summon nav={nav} />;
  }
});

const PageView = memo(function PageView({
  entry,
  nav,
  under,
  setRef,
  onGone,
}: {
  entry: PageEntry;
  nav: Nav;
  under: boolean;
  setRef: (key: number, el: HTMLElement | null) => void;
  onGone: (key: number) => void;
}) {
  const def = SCREEN_MAP[entry.id];
  // Safety net: if the exit animation never reports back (hidden tab, reduced motion), still unmount.
  useEffect(() => {
    if (!entry.leaving) return;
    const t = setTimeout(() => onGone(entry.key), entry.leaving === 'drag' ? 0 : 420);
    return () => clearTimeout(t);
  }, [entry.leaving]);
  if (!def) return null;
  const Comp = def.component;
  return (
    <section
      ref={(el) => setRef(entry.key, el)}
      class={`page ${entry.leaving === 'anim' ? 'page-leave' : entry.leaving === 'drag' ? 'page-gone' : 'page-enter'} ${under ? 'under' : ''}`}
      aria-label={def.title}
      inert={under || !!entry.leaving}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && entry.leaving) onGone(entry.key);
      }}
    >
      <div class="page-head">
        <button class="icon-btn back-btn" onClick={() => nav.back()} aria-label="Back">
          ◀
        </button>
        <h2 class="page-title">
          <span aria-hidden="true">{def.icon}</span> {def.title}
        </h2>
      </div>
      <div class="page-body">
        <Comp nav={nav} params={entry.params} />
      </div>
    </section>
  );
});

// ───────── app ─────────

export function App() {
  const s = useGame();
  const [tab, setTabState] = useState<Tab>('home');
  const [prevTab, setPrevTab] = useState<Tab | null>(null);
  const [peek, setPeek] = useState<{ tab: Tab; dir: 1 | -1 } | null>(null);
  const [mounted, setMounted] = useState<Tab[]>(['home']);
  const [stack, setStack] = useState<PageEntry[]>([]);
  const [hero, setHero] = useState<string | null>(null);
  const [battle, setBattle] = useState<BattleSpec | null>(null);
  const [battleOut, setBattleOut] = useState<BattleSpec | null>(null);
  const [story, setStory] = useState<{ chapter: number; then: number } | null>(null);
  const [welcome, setWelcome] = useState<number | null>(null);
  const [quests, setQuests] = useState(false);
  const [settings, setSettings] = useState(false);
  const [bounce, setBounce] = useState(0);
  const [motionReduced, setMotionReduced] = useState(motionPref() === 'reduce');

  const pageKey = useRef(1);
  const tabRef = useRef<Tab>(tab);
  const lastTab = useRef<Tab>(tab);
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const battleRef = useRef(battle);
  battleRef.current = battle;
  const paneMode = useRef<PaneMode>('tap');
  const paneEls = useRef<Partial<Record<Tab, HTMLElement | null>>>({});
  const pageEls = useRef(new Map<number, HTMLElement>());
  const anims = useRef<Animation[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const navbarRef = useRef<HTMLElement>(null);
  const overlayOpen = useRef(false);
  overlayOpen.current = !!(battle || story || hero || quests || settings || welcome !== null || !s.tutorialDone);

  useEffect(() => onPrefsChange(() => setMotionReduced(motionPref() === 'reduce')), []);

  // ───────── session / welcome back ─────────
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

  // ───────── pane animation plumbing ─────────
  const clearPaneAnims = () => {
    anims.current.forEach((a) => a.cancel());
    anims.current = [];
    for (const el of Object.values(paneEls.current)) setX(el, null);
    navbarRef.current?.style.setProperty('--drag', '0');
    navbarRef.current?.classList.remove('dragging');
  };

  const ensureMounted = (t: Tab) => setMounted((m) => (m.includes(t) ? m : [...m, t]));

  const switchTab = (to: Tab, mode: PaneMode = 'tap') => {
    const from = tabRef.current;
    if (to === from) return;
    clearPaneAnims();
    paneMode.current = mode;
    tabRef.current = to;
    ensureMounted(to);
    setPeek(null);
    setPrevTab(mode === 'tap' ? from : null);
    setTabState(to);
    setBounce((b) => b + 1);
  };

  // Animate tab changes once the new pane is in the DOM.
  useLayoutEffect(() => {
    const from = lastTab.current;
    lastTab.current = tab;
    if (from === tab) return;
    const mode = paneMode.current;
    paneMode.current = 'tap';
    if (mode !== 'tap') {
      clearPaneAnims();
      return;
    }
    const cur = paneEls.current[tab];
    const prev = paneEls.current[from];
    const W = viewportRef.current?.clientWidth ?? 390;
    const dir = tabDirection(from, tab);
    if (!cur || !prev || !dir || reducedMotion()) {
      setPrevTab(null);
      return;
    }
    const a = slideX(cur, dir * W, 0, 300);
    const b = slideX(prev, 0, -dir * W * 0.32, 300, { fromOpacity: 1, toOpacity: 0.35 });
    anims.current = [a, b].filter(Boolean) as Animation[];
    if (a)
      a.onfinish = () => {
        setPrevTab((p) => (p === from ? null : p));
      };
    else setPrevTab(null);
  }, [tab]);

  // Once the outgoing pane is hidden, drop its held animation frame.
  useLayoutEffect(() => {
    if (prevTab === null && !peek) clearPaneAnims();
  }, [prevTab]);

  // Warm up the neighbouring tabs while idle so swipes never wait on a first render.
  useEffect(() => {
    const t = tab;
    return onIdle(() => {
      const near = [neighborTab(t, 1), neighborTab(t, -1)].filter(Boolean) as Tab[];
      setMounted((m) => (near.every((n) => m.includes(n)) ? m : [...m, ...near.filter((n) => !m.includes(n))]));
    }, 1500);
  }, [tab]);

  // ───────── page stack ─────────
  const livePages = stack.filter((p) => !p.leaving);
  const pageOpen = livePages.length > 0;

  const popTop = (how: 'anim' | 'drag' = 'anim') => {
    const live = stackRef.current.filter((p) => !p.leaving);
    const top = live[live.length - 1];
    if (!top) return;
    const mode = reducedMotion() ? 'drag' : how;
    setStack((st) => st.map((p) => (p.key === top.key ? { ...p, leaving: mode } : p)));
  };

  const removePage = (key: number) => {
    pageEls.current.delete(key);
    setStack((st) => st.filter((p) => p.key !== key));
  };

  const setPageRef = useRef((key: number, el: HTMLElement | null) => {
    if (el) pageEls.current.set(key, el);
  }).current;

  // ───────── battle host ─────────
  const exitBattle = () => {
    const cur = battleRef.current;
    setBattle(null);
    if (cur && !reducedMotion()) {
      setBattleOut(cur);
      setTimeout(() => setBattleOut((o) => (o === cur ? null : o)), 240);
    }
  };

  // ───────── nav (one stable object; screens can hold on to it) ─────────
  const api = useRef({} as { go: (t: Tab) => void; open: Nav['open']; back: () => void; fight: (stage: number) => void });
  api.current.go = (t) => {
    sfx.click();
    haptic('tap');
    const hadPages = stackRef.current.some((p) => !p.leaving);
    if (hadPages) setStack((st) => st.map((p) => (p.leaving ? p : { ...p, leaving: reducedMotion() ? 'drag' : 'anim' })));
    if (t === tabRef.current) {
      if (!hadPages) paneEls.current[t]?.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
      return;
    }
    switchTab(t, hadPages ? 'none' : 'tap');
  };
  api.current.open = (id, params) => {
    const def = SCREEN_MAP[id];
    if (!def) return;
    if ((def.unlockStage ?? 0) > getState().stage) {
      toast(`Clear ${stageLabel(def.unlockStage!)} to unlock ${def.title}!`);
      haptic('error');
      return;
    }
    const live = stackRef.current.filter((p) => !p.leaving);
    if (live[live.length - 1]?.id === id) return; // double tap
    sfx.click();
    haptic('tap');
    setStack((st) => [...st, { id, params, key: pageKey.current++ }]);
  };
  api.current.back = () => popTop('anim');
  api.current.fight = (stage) => {
    const chapter = Math.floor(stage / STAGES_PER_CHAPTER);
    if (chapter > getState().seenChapter) {
      exitBattle();
      setStory({ chapter, then: stage });
    } else setBattle(campaignBattle(stage, navObj));
  };

  const navObj = useMemo<Nav>(
    () => ({
      get tab() {
        return tabRef.current;
      },
      go: (t) => api.current.go(t),
      open: (id, params) => api.current.open(id, params),
      back: () => api.current.back(),
      openHero: (id) => setHero(id),
      fight: (stage) => api.current.fight(stage),
      battle: (spec) => setBattle(spec),
      closeBattle: () => exitBattle(),
      openQuests: () => setQuests(true),
    }),
    [],
  );

  // ───────── swipe between tabs ─────────
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    type G = { x0: number; y0: number; intent: 'pending' | 'horizontal'; vt: VelocityTracker; dir: 0 | 1 | -1; target: Tab | null; W: number; dx: number };
    let g: G | null = null;
    const onStart = (e: TouchEvent) => {
      g = null;
      if (e.touches.length !== 1 || overlayOpen.current || stackRef.current.length || anims.current.length) return;
      if (!swipeAllowedFrom(e.target, vp)) return;
      const t = e.touches[0];
      g = { x0: t.clientX, y0: t.clientY, intent: 'pending', vt: new VelocityTracker(), dir: 0, target: null, W: vp.clientWidth, dx: 0 };
      g.vt.add(t.clientX, e.timeStamp);
    };
    const onMove = (e: TouchEvent) => {
      if (!g) return;
      const t = e.touches[0];
      if (!t || e.touches.length > 1) {
        cancel();
        return;
      }
      const dx = t.clientX - g.x0;
      const dy = t.clientY - g.y0;
      if (g.intent === 'pending') {
        const intent = classifyIntent(dx, dy);
        if (intent === 'vertical') {
          g = null;
          return;
        }
        if (intent === 'pending') return;
        g.intent = 'horizontal';
        navbarRef.current?.classList.add('dragging');
      }
      if (e.cancelable) e.preventDefault();
      g.vt.add(t.clientX, e.timeStamp);
      const dir: 1 | -1 = dx < 0 ? 1 : -1;
      const cur = tabRef.current;
      if (dir !== g.dir) {
        if (g.target) setX(paneEls.current[g.target], null);
        g.dir = dir;
        g.target = neighborTab(cur, dir);
        if (g.target) {
          ensureMounted(g.target);
          setPeek({ tab: g.target, dir });
        } else setPeek(null);
      }
      g.dx = g.target ? dx : rubberBand(dx);
      setX(paneEls.current[cur], g.dx);
      if (g.target) setX(paneEls.current[g.target], g.dx + dir * g.W);
      navbarRef.current?.style.setProperty('--drag', String(g.target ? -g.dx / g.W : 0));
    };
    const cancel = () => {
      if (g?.intent === 'horizontal') settle(false);
      g = null;
    };
    const settle = (commit: boolean) => {
      if (!g) return;
      const { dx, target, dir, W } = g;
      const vx = g.vt.velocity();
      const cur = tabRef.current;
      const curEl = paneEls.current[cur];
      const nbEl = target ? paneEls.current[target] : null;
      navbarRef.current?.classList.remove('dragging');
      if (commit && target && nbEl && curEl) {
        const ms = settleMs(dir * W + dx, vx);
        const a = slideX(curEl, dx, -dir * W, ms);
        const b = slideX(nbEl, dx + dir * W, 0, ms);
        // The indicator glides to the target tab alongside the panes.
        navbarRef.current?.style.setProperty('--drag', String(dir));
        anims.current = [a, b].filter(Boolean) as Animation[];
        sfx.click();
        haptic('tap');
        if (b) b.onfinish = () => switchTab(target, 'swipe');
        else switchTab(target, 'swipe');
        return;
      }
      navbarRef.current?.style.setProperty('--drag', '0');
      const ms = settleMs(dx, vx);
      const list: Animation[] = [];
      if (curEl) {
        const a = slideX(curEl, dx, 0, ms);
        if (a) list.push(a);
      }
      if (nbEl) {
        const b = slideX(nbEl, dx + dir * W, dir * W, ms);
        if (b) list.push(b);
      }
      anims.current = list;
      const done = () => {
        clearPaneAnims();
        setPeek(null);
      };
      if (list[0]) list[0].onfinish = done;
      else done();
    };
    const onEnd = () => {
      if (!g) return;
      if (g.intent !== 'horizontal') {
        g = null;
        return;
      }
      settle(shouldCommit(g.dx, g.vt.velocity(), g.W) && !!g.target);
      g = null;
    };
    vp.addEventListener('touchstart', onStart, { passive: true });
    vp.addEventListener('touchmove', onMove, { passive: false });
    vp.addEventListener('touchend', onEnd);
    vp.addEventListener('touchcancel', cancel);
    return () => {
      vp.removeEventListener('touchstart', onStart);
      vp.removeEventListener('touchmove', onMove);
      vp.removeEventListener('touchend', onEnd);
      vp.removeEventListener('touchcancel', cancel);
    };
  }, []);

  // ───────── edge-swipe back on feature pages ─────────
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    type G = { x0: number; y0: number; intent: 'pending' | 'horizontal'; vt: VelocityTracker; el: HTMLElement; key: number; under: HTMLElement | null; W: number; dx: number };
    let g: G | null = null;
    const underEl = (): HTMLElement | null => {
      const live = stackRef.current.filter((p) => !p.leaving);
      if (live.length >= 2) return pageEls.current.get(live[live.length - 2].key) ?? null;
      return viewportRef.current;
    };
    const onStart = (e: TouchEvent) => {
      g = null;
      if (e.touches.length !== 1 || overlayOpen.current) return;
      const live = stackRef.current.filter((p) => !p.leaving);
      const top = live[live.length - 1];
      if (!top) return;
      const el = pageEls.current.get(top.key);
      const t = e.touches[0];
      const left = main.getBoundingClientRect().left;
      if (!el || t.clientX - left > EDGE || !el.contains(e.target as Node)) return;
      if (!swipeAllowedFrom(e.target, el, false)) return;
      g = { x0: t.clientX, y0: t.clientY, intent: 'pending', vt: new VelocityTracker(), el, key: top.key, under: underEl(), W: main.clientWidth, dx: 0 };
      g.vt.add(t.clientX, e.timeStamp);
    };
    const onMove = (e: TouchEvent) => {
      if (!g) return;
      const t = e.touches[0];
      if (!t) return;
      const dx = t.clientX - g.x0;
      const dy = t.clientY - g.y0;
      if (g.intent === 'pending') {
        const intent = classifyIntent(dx, dy, 8);
        if (intent === 'vertical' || (intent === 'horizontal' && dx < 0)) {
          g = null;
          return;
        }
        if (intent === 'pending') return;
        g.intent = 'horizontal';
        g.el.classList.add('dragging');
        g.under?.classList.add('dragging');
      }
      if (e.cancelable) e.preventDefault();
      g.vt.add(t.clientX, e.timeStamp);
      g.dx = Math.max(0, dx);
      setX(g.el, g.dx);
      if (g.under) {
        const p = Math.min(1, g.dx / g.W);
        g.under.style.transform = `translate3d(${(-0.2 * g.W * (1 - p)).toFixed(1)}px,0,0)`;
        g.under.style.opacity = (0.5 + 0.5 * p).toFixed(3);
      }
    };
    const finish = (commit: boolean) => {
      if (!g) return;
      const { el, key, under, W, dx } = g;
      const vx = g.vt.velocity();
      g = null;
      el.classList.remove('dragging');
      if (commit) {
        const a = slideX(el, dx, W, settleMs(W - dx, vx));
        haptic('tap');
        if (under) {
          // let the under-layer glide home with the page
          under.classList.remove('dragging');
          under.style.transform = 'translate3d(0px,0,0)';
          under.style.opacity = '1';
        }
        const done = () => {
          if (under) {
            under.style.transform = '';
            under.style.opacity = '';
          }
          setStack((st) => st.map((p) => (p.key === key ? { ...p, leaving: 'drag' } : p)));
        };
        if (a) a.onfinish = done;
        else done();
        return;
      }
      const a = slideX(el, dx, 0, settleMs(dx, vx));
      if (under) {
        under.classList.remove('dragging');
        under.style.transform = '';
        under.style.opacity = '';
      }
      const done = () => {
        a?.cancel();
        setX(el, null);
      };
      if (a) a.onfinish = done;
      else done();
    };
    const onEnd = () => {
      if (!g) return;
      if (g.intent !== 'horizontal') {
        g = null;
        return;
      }
      finish(shouldCommit(g.dx, g.vt.velocity(), g.W, 0.33) && g.dx > 0);
    };
    const onCancel = () => finish(false);
    main.addEventListener('touchstart', onStart, { passive: true });
    main.addEventListener('touchmove', onMove, { passive: false });
    main.addEventListener('touchend', onEnd);
    main.addEventListener('touchcancel', onCancel);
    return () => {
      main.removeEventListener('touchstart', onStart);
      main.removeEventListener('touchmove', onMove);
      main.removeEventListener('touchend', onEnd);
      main.removeEventListener('touchcancel', onCancel);
    };
  }, []);

  // Escape on a feature page goes back (modals handle their own Escape first).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || overlayOpen.current) return;
      if (document.querySelector('.shell > .modal-wrap, .shell > .reveal')) return;
      if (stackRef.current.some((p) => !p.leaving)) api.current.back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ───────── render ─────────
  const questBadge = [...DAILY_QUESTS, BONUS_QUEST].some((q) => claimable(s, q));
  const afkFull = afkPending().hours >= 1;
  const heroBadge = starUpReady(s);
  const shownBattle = battle ?? battleOut;
  const tabIdx = tabIndex(tab);

  return (
    <div class="shell" data-motion={motionReduced ? 'reduce' : undefined}>
      <header class="topbar">
        {TOP_CURRENCIES.map((k) => (
          <CurrencyChip key={k} kind={k} value={s.currencies[k]} />
        ))}
        <button class="icon-btn" onClick={() => setQuests(true)} aria-label={questBadge ? 'Daily quests, rewards ready' : 'Daily quests'} style={{ position: 'relative' }}>
          📜{questBadge && <span class="badge-dot" style={{ top: -4, right: -4 }} />}
        </button>
        <button class="icon-btn" onClick={() => setSettings(true)} aria-label="Settings">
          ⚙️
        </button>
      </header>

      <main class={`main ${pageOpen ? 'has-page' : ''}`} ref={mainRef}>
        <div class={`tabs-viewport ${pageOpen ? 'under' : ''}`} ref={viewportRef} inert={pageOpen}>
          {TAB_ORDER.filter((t) => mounted.includes(t)).map((t) => {
            const state =
              t === tab ? 'is-active' : t === prevTab ? 'is-prev' : peek?.tab === t ? `is-peek ${peek.dir > 0 ? 'peek-right' : 'peek-left'}` : 'is-hidden';
            return (
              <div
                key={t}
                ref={(el) => {
                  paneEls.current[t] = el;
                }}
                class={`tab-pane ${t === tab ? 'content' : ''} ${state}`}
                data-tab={t}
                aria-hidden={t !== tab}
                inert={t !== tab}
              >
                <TabScreen tab={t} nav={navObj} />
              </div>
            );
          })}
        </div>
        {stack.map((p, i) => {
          const above = stack.slice(i + 1).some((q) => !q.leaving);
          return <PageView key={p.key} entry={p} nav={navObj} under={above && !p.leaving} setRef={setPageRef} onGone={removePage} />;
        })}
      </main>

      <nav class={`navbar ${pageOpen ? 'page-open' : ''}`} ref={navbarRef} style={{ '--i': tabIdx } as any} aria-label="Main">
        <span class="nav-indicator" aria-hidden="true" />
        {NAV.map((n) => {
          const active = tab === n.id && !pageOpen;
          return (
            <button
              key={n.id}
              class={`nav-item ${active ? 'active' : ''} ${n.id === 'campaign' ? 'nav-battle' : ''}`}
              onClick={() => navObj.go(n.id)}
              aria-current={active ? 'page' : undefined}
            >
              <span class="nav-ico" key={tab === n.id ? `b${bounce}` : 'i'} aria-hidden="true">
                {n.icon}
              </span>
              <span class="nav-lbl">{n.label}</span>
              {n.id === 'home' && afkFull && tab !== 'home' && <span class="badge-dot" />}
              {n.id === 'heroes' && heroBadge && tab !== 'heroes' && <span class="badge-dot" />}
            </button>
          );
        })}
      </nav>

      {hero && <HeroDetail id={hero} onClose={() => setHero(null)} onNavigate={setHero} />}
      {quests && <Quests onClose={() => setQuests(false)} nav={navObj} />}
      {settings && <Settings onClose={() => setSettings(false)} />}

      {story && (
        <Story
          chapter={story.chapter}
          onDone={() => {
            markChapterSeen(story.chapter);
            setBattle(campaignBattle(story.then, navObj));
            setStory(null);
          }}
        />
      )}

      {shownBattle && (
        <div class={`battle-host ${battle ? '' : 'leaving'}`} key={shownBattle.key}>
          <BattleScreen key={shownBattle.key} spec={shownBattle} onExit={exitBattle} />
        </div>
      )}

      {welcome !== null && (
        <Modal center onClose={() => setWelcome(null)} label="Welcome back">
          <div class="welcome-chest" aria-hidden="true">
            🎁
          </div>
          <h2 class="panel-title" style={{ justifyContent: 'center' }}>
            Welcome back, Magic Knight!
          </h2>
          <p style={{ margin: '0 0 12px', textAlign: 'center' }}>
            You were away for <b>{formatDuration(welcome)}</b>. Your squad kept fighting — the AFK chest at the base has filled up.
          </p>
          <button
            class="btn green block"
            onClick={() => {
              setWelcome(null);
              if (stackRef.current.length) setStack((st) => st.map((p) => (p.leaving ? p : { ...p, leaving: 'anim' })));
              if (tabRef.current !== 'home') switchTab('home', stackRef.current.length ? 'none' : 'tap');
            }}
          >
            To the Hideout!
          </button>
        </Modal>
      )}

      {!s.tutorialDone && <Tutorial />}
      <FlyLayer icon={(k) => <CurrencyIcon kind={k} size={22} />} />
      <Toasts />
    </div>
  );
}
