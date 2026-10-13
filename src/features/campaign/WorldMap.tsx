// The Battle tab: a vertically scrolling world map that climbs from Hage Village up through
// every chapter into the endless Abyss. Only regions near the viewport render their scenery.
import { memo } from 'preact/compat';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CharacterArt } from '../../art/CharacterArt';
import { CHAPTERS, STAGES_PER_CHAPTER, getStage } from '../../data/campaign';
import { getHero } from '../../data/heroes';
import { teamPower } from '../../game/power';
import type { Reward, SaveState } from '../../game/state';
import { fmtShort } from '../../game/stats';
import { commit, emitGameEvent, getState, grantReward, playerTeam, useGame } from '../../game/store';
import { Portal, RewardList, toast } from '../../ui/components/common';
import { haptic } from '../../ui/haptics';
import type { Nav } from '../../ui/nav';
import { reducedMotion } from '../../ui/prefs';
import { sfx } from '../../ui/sfx';
import './campaign.css';
import { BANNER_Y, FOG_H, MAP_W, REGION_H, mapHeight, nodeMapPos, regionLayout, regionTop, themeOf, topChapterFor } from './mapLayout';
import { ChestIcon, FogArt, PALETTES, RegionArt, regionFx } from './scenery';
import { StageSheet, Sheet } from './StageSheet';
import { CHAPTER_MAX_STARS, CHEST_NAMES, CHEST_STARS, chapterStars, chestReward, chestStatus, claimChest, ensureCampaign, readyChests, stageStars, totalStars } from './stars';

/** Map px kept free at the bottom for the battle dock. */
const DOCK_PAD = 92;
/** Regions further than this (px) outside the viewport render as flat placeholders. */
const NEAR_PX = 700;
/** Nodes in the fogged top region above this map-unit line stay hidden. */
const FOG_LINE = 520;

export function leaderId(s: SaveState): string {
  const slots = s.squad?.slots ?? [];
  const first = slots[0] && s.heroes[slots[0]] ? slots[0] : slots.find((x) => x && s.heroes[x]);
  return first ?? Object.keys(s.heroes)[0] ?? 'asta';
}

/** True when at least one squad slot holds an owned hero. */
export function hasSquad(s: SaveState): boolean {
  return (s.squad?.slots ?? []).some((id) => !!id && !!s.heroes[id]);
}

function chapterTitle(c: number): { name: string; subtitle: string; tag: string } {
  const ch = CHAPTERS[themeOf(c)];
  const loop = Math.floor(c / CHAPTERS.length);
  return loop
    ? { name: ch.name, subtitle: `Chapter ${c + 1} · ${ch.subtitle}`, tag: `Abyss ${loop}` }
    : { name: ch.name, subtitle: ch.subtitle, tag: `Chapter ${c + 1}` };
}

/** Eased scroll tween. Native smooth scrollTo stalls in some WebViews (and while the tab pane
 * is sliding in), so the map animates scrollTop itself. Returns a cancel function. */
function tweenScroll(sc: HTMLElement, to: number): () => void {
  const from = sc.scrollTop;
  const d = to - from;
  if (Math.abs(d) < 2 || reducedMotion()) {
    sc.scrollTop = to;
    return () => {};
  }
  const ms = Math.max(380, Math.min(900, 300 + Math.abs(d) * 0.3));
  const t0 = performance.now();
  let raf = requestAnimationFrame(function step(now) {
    // rAF timestamps can predate t0 (frame start), so clamp at 0 too.
    const t = Math.max(0, Math.min(1, (now - t0) / ms));
    sc.scrollTop = from + d * (1 - Math.pow(1 - t, 3));
    if (t < 1) raf = requestAnimationFrame(step);
  });
  return () => cancelAnimationFrame(raf);
}

// ───────── nodes ─────────

interface NodeProps {
  index: number;
  k: number;
  boss: boolean;
  left: number;
  top: number;
  status: 'cleared' | 'current' | 'locked';
  stars: number;
  bossId: string;
  fresh: boolean;
  onTap: (index: number) => void;
}

const StageNode = memo(function StageNode({ index, k, boss, left, top, status, stars, bossId, fresh, onTap }: NodeProps) {
  return (
    <button
      class={`cmap-node ${boss ? 'boss' : ''} ${status}`}
      style={{ left, top }}
      onClick={() => onTap(index)}
      aria-label={`Stage ${Math.floor(index / STAGES_PER_CHAPTER) + 1}-${k + 1}${status === 'locked' ? ', locked' : status === 'current' ? ', next battle' : `, ${stars} stars`}`}
    >
      {boss ? (
        <span class="cmap-boss-face">
          <CharacterArt id={bossId} mode="portrait" flip />
          {status === 'locked' && <span class="cmap-boss-q">🔒</span>}
        </span>
      ) : (
        <span class="cmap-node-face">{status === 'current' ? '⚔' : k + 1}</span>
      )}
      {boss && <span class="cmap-boss-tag">{status === 'cleared' ? 'BEATEN' : 'BOSS'}</span>}
      {status === 'current' && <span class="cmap-ring" aria-hidden="true" />}
      {status === 'cleared' && (
        <span class={`cmap-stars ${fresh ? 'fresh' : ''}`} aria-hidden="true">
          {[1, 2, 3].map((i) => (
            <i key={i} class={i <= stars ? 'on' : ''} style={{ animationDelay: `${0.15 + i * 0.12}s` }}>
              ★
            </i>
          ))}
        </span>
      )}
    </button>
  );
});

// ───────── chapter banner ─────────

interface BannerProps {
  chapter: number;
  top: number;
  locked: boolean;
  stars: number;
  chests: ('locked' | 'ready' | 'claimed')[];
  onChest: (chapter: number, tier: number) => void;
}

const ChapterBanner = memo(function ChapterBanner({ chapter, top, locked, stars, chests, onChest }: BannerProps) {
  const t = chapterTitle(chapter);
  const ch = CHAPTERS[themeOf(chapter)];
  const prevBoss = chapter > 0 ? getHero(CHAPTERS[themeOf(chapter - 1)].boss).name : '';
  return (
    <div class={`cmap-banner ${locked ? 'locked' : ''} ${chapter >= CHAPTERS.length ? 'abyss' : ''}`} style={{ top, '--acc': ch.accent } as any}>
      <div class="cmap-ribbon">
        <span class="cmap-ribbon-tag">{t.tag}</span>
        <span class="cmap-ribbon-name">{t.name}</span>
      </div>
      <div class="cmap-ribbon-sub">{t.subtitle}</div>
      {locked ? (
        <div class="cmap-banner-lock">🔒 Defeat {prevBoss} to enter</div>
      ) : (
        <div class="cmap-chests">
          <span class="cmap-chest-stars">
            <b>★</b> {stars}/{CHAPTER_MAX_STARS}
          </span>
          {CHEST_STARS.map((need, tier) => (
            <button
              key={tier}
              class={`cmap-chest ${chests[tier]}`}
              onClick={() => onChest(chapter, tier)}
              aria-label={`${CHEST_NAMES[tier]} at ${need} stars: ${chests[tier]}`}
            >
              <ChestIcon tier={tier} open={chests[tier] === 'claimed'} size={30} />
              <span>{chests[tier] === 'claimed' ? '✓' : `${need}★`}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

// ───────── fx ─────────

const RegionFx = memo(function RegionFx({ chapter, scale, foggy }: { chapter: number; scale: number; foggy: boolean }) {
  const items = regionFx(chapter).filter((f) => !foggy || f.y > FOG_LINE);
  return (
    <div class="cmap-fxl" aria-hidden="true">
      {items.map((f, i) => (
        <i
          key={i}
          class={`cmap-fx fx-${f.fx}`}
          style={{
            left: (f.x - f.size / 2) * scale,
            top: (f.y - f.size / 2) * scale,
            width: f.size * scale,
            height: f.size * scale,
            animationDelay: `${-f.delay.toFixed(2)}s`,
          }}
        />
      ))}
    </div>
  );
});

// ───────── one region ─────────

interface RegionProps {
  chapter: number;
  scale: number;
  top: number;
  near: boolean;
  cleared: number;
  topCh: number;
  stars: Record<string, number>;
  chests: Record<string, number[]>;
  fresh: number;
  onNode: (i: number) => void;
  onChest: (c: number, t: number) => void;
}

function Region({ chapter, scale, top, near, cleared, topCh, stars, chests, fresh, onNode, onChest }: RegionProps) {
  const L = regionLayout(chapter);
  const h = REGION_H * scale;
  const first = chapter * STAGES_PER_CHAPTER;
  // Road pieces reached: entry piece once the chapter is open, then one per node reached.
  const reached = cleared < first ? 0 : Math.min(L.segs.length, cleared - first + 2);
  const foggy = chapter === topCh;
  const camp = { stars, chests };
  if (!near) return <div class="cmap-region ph" style={{ top, height: h, background: PALETTES[L.theme].base[1] }} />;
  const curCh = Math.floor(cleared / STAGES_PER_CHAPTER);
  const locked = chapter > curCh;
  const chestState = CHEST_STARS.map((_, t) => chestStatus(camp, cleared, chapter, t));
  return (
    <div class={`cmap-region ${L.loop ? 'abyss' : ''}`} style={{ top, height: h }} data-chapter={chapter}>
      <RegionArt chapter={chapter} reached={reached} foggy={foggy} />
      <RegionFx chapter={chapter} scale={scale} foggy={foggy} />
      {L.nodes.map((n) => {
        if (foggy && (n.boss || n.y < FOG_LINE)) return null;
        const status = n.index < cleared ? 'cleared' : n.index === cleared ? 'current' : 'locked';
        return (
          <StageNode
            key={n.index}
            index={n.index}
            k={n.k}
            boss={n.boss}
            left={n.x * scale}
            top={n.y * scale}
            status={status}
            stars={stageStars(camp, cleared, n.index)}
            bossId={CHAPTERS[L.theme].boss}
            fresh={n.index === fresh}
            onTap={onNode}
          />
        );
      })}
      <ChapterBanner
        chapter={chapter}
        top={BANNER_Y * scale}
        locked={locked}
        stars={chapterStars(camp, cleared, chapter)}
        chests={chestState}
        onChest={onChest}
      />
    </div>
  );
}

// ───────── chest popup ─────────

function ChestParty({ chapter, tier, reward, onClose }: { chapter: number; tier: number; reward: Reward; onClose: () => void }) {
  const [open, setOpen] = useState(reducedMotion());
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => {
      setOpen(true);
      sfx.coin();
      haptic('success');
    }, 650);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const sparks = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        const d = 90 + (i % 3) * 30;
        return { x: Math.cos(a) * d, y: Math.sin(a) * d, delay: (i % 4) * 0.04 };
      }),
    [],
  );
  return (
    <Portal>
      <div class="cmap-party" onClick={(e) => e.target === e.currentTarget && open && onClose()}>
        <div class={`cmap-party-card ${open ? 'open' : ''}`} role="dialog" aria-label={CHEST_NAMES[tier]}>
          <div class="cmap-party-stage">
            {open && <div class="cmap-rays" aria-hidden="true" />}
            <div class={`cmap-party-chest ${open ? 'open' : 'shake'}`}>
              <ChestIcon tier={tier} open={open} size={112} />
            </div>
            {open &&
              sparks.map((p, i) => (
                <i key={i} class="cmap-spark" style={{ '--x': `${p.x}px`, '--y': `${p.y}px`, animationDelay: `${p.delay}s` } as any}>
                  ★
                </i>
              ))}
          </div>
          <h2 class="cmap-party-title">{CHEST_NAMES[tier]}!</h2>
          <div class="small-text muted">
            Chapter {chapter + 1} · {CHEST_STARS[tier]}★ reached
          </div>
          <div class={`cmap-party-rw ${open ? 'show' : ''}`}>{open && <RewardList r={reward} />}</div>
          <button class="btn green big block" disabled={!open} onClick={onClose}>
            Collect!
          </button>
        </div>
      </div>
    </Portal>
  );
}

// ───────── chest overview sheet ─────────

function ChestOverview({ s, onClose, onChest, onGo }: { s: SaveState; onClose: () => void; onChest: (c: number, t: number) => void; onGo: (c: number) => void }) {
  const cleared = s.stage;
  const curCh = Math.floor(cleared / STAGES_PER_CHAPTER);
  const rows = Array.from({ length: curCh + 1 }, (_, i) => curCh - i);
  return (
    <Sheet onClose={onClose} label="Star chests">
      {(close) => (
        <div class="cmap-sheet-body">
          <h3 class="panel-title" style={{ marginTop: 2 }}>
            ★ Star Chests
          </h3>
          <div class="small-text muted" style={{ marginBottom: 8 }}>
            Earn up to 3★ per stage. Every chapter hides chests at 10, 20 and 30★ — replay old stages to grab them all.
          </div>
          <div class="cmap-ov-list">
            {rows.map((c) => {
              const t = chapterTitle(c);
              const n = chapterStars(s.campaign, cleared, c);
              return (
                <div class="cmap-ov-row" key={c}>
                  <button
                    class="cmap-ov-name"
                    onClick={() => {
                      close();
                      onGo(c);
                    }}
                  >
                    <span class="cmap-ov-tag" style={{ background: CHAPTERS[themeOf(c)].accent }}>
                      {c + 1}
                    </span>
                    <span class="cmap-ov-txt">
                      <b>{t.name}</b>
                      <span class="cmap-ov-bar">
                        <i style={{ width: `${(n / CHAPTER_MAX_STARS) * 100}%` }} />
                      </span>
                      <span class="small-text muted">
                        ★ {n}/{CHAPTER_MAX_STARS}
                        {Math.floor(c / CHAPTERS.length) ? ` · Abyss ${Math.floor(c / CHAPTERS.length)}` : ''}
                      </span>
                    </span>
                  </button>
                  <div class="cmap-ov-chests">
                    {CHEST_STARS.map((need, tier) => {
                      const st = chestStatus(s.campaign, cleared, c, tier);
                      return (
                        <button key={tier} class={`cmap-chest ${st}`} onClick={() => onChest(c, tier)} aria-label={`${CHEST_NAMES[tier]}: ${st}`}>
                          <ChestIcon tier={tier} open={st === 'claimed'} size={28} />
                          <span>{st === 'claimed' ? '✓' : `${need}★`}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Sheet>
  );
}

// ───────── the map ─────────

export function WorldMap({ nav }: { nav: Nav }) {
  const s = useGame();
  const cleared = Math.max(0, Math.floor(Number(s.stage) || 0));
  const curCh = Math.floor(cleared / STAGES_PER_CHAPTER);
  const topCh = topChapterFor(cleared);
  const rootRef = useRef<HTMLDivElement>(null);
  const scRef = useRef<HTMLDivElement>(null);
  const cloudRefs = useRef<(HTMLElement | null)[]>([]);
  const [w, setW] = useState(0);
  const [near, setNear] = useState('');
  const [shown, setShown] = useState(cleared);
  const [fresh, setFresh] = useState(-1);
  const [fab, setFab] = useState<-1 | 0 | 1>(0);
  const [sheet, setSheet] = useState<number | null>(null);
  const [overview, setOverview] = useState(false);
  const [party, setParty] = useState<{ chapter: number; tier: number; reward: Reward } | null>(null);
  const visibleRef = useRef(true);
  const initRef = useRef(false);
  const live = useRef({ cleared, topCh, scale: 0 });
  const scale = w / MAP_W;
  live.current = { cleared, topCh, scale };

  const campaign = s.campaign ?? { stars: {}, chests: {} };
  const starsObj = campaign.stars && typeof campaign.stars === 'object' ? campaign.stars : {};
  const chestsObj = campaign.chests && typeof campaign.chests === 'object' ? campaign.chests : {};
  const total = totalStars(campaign, cleared);
  const ready = readyChests(campaign, cleared).length;
  const power = teamPower(playerTeam(s));
  const cur = getStage(cleared);
  const leader = leaderId(s);

  // ── measure ──
  useLayoutEffect(() => {
    const el = scRef.current;
    if (!el) return;
    const measure = () => setW((prev) => (el.clientWidth && Math.abs(el.clientWidth - prev) > 0.5 ? el.clientWidth : prev));
    measure();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    } else window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  const targetFor = (stage: number) => {
    const sc = scRef.current;
    const { topCh: tc, scale: k } = live.current;
    if (!sc || !k) return 0;
    const y = nodeMapPos(stage, tc).y * k;
    const max = Math.max(0, sc.scrollHeight - sc.clientHeight);
    return Math.max(0, Math.min(max, y - sc.clientHeight * 0.56));
  };

  const stopTween = useRef<() => void>(() => {});
  const scrollToY = (y: number) => {
    const sc = scRef.current;
    if (!sc) return;
    stopTween.current();
    const max = Math.max(0, sc.scrollHeight - sc.clientHeight);
    stopTween.current = tweenScroll(sc, Math.max(0, Math.min(max, y)));
  };
  const lastSwoop = useRef(0);

  /** Bring a stage into view. `swoop` starts a little below so the map visibly glides up;
   * `gentle` only scrolls when the node is not comfortably on screen already. */
  const focusStage = (stage: number, how: 'instant' | 'smooth' | 'swoop' | 'gentle' = 'smooth') => {
    const sc = scRef.current;
    if (!sc || !live.current.scale) return;
    const target = targetFor(stage);
    if (how === 'gentle') {
      const y = nodeMapPos(stage, live.current.topCh).y * live.current.scale;
      if (y > sc.scrollTop + 110 && y < sc.scrollTop + sc.clientHeight - 140) return;
    }
    if (how === 'instant' || reducedMotion()) {
      stopTween.current();
      sc.scrollTop = target;
      return;
    }
    if (how === 'swoop') {
      lastSwoop.current = Date.now();
      stopTween.current();
      sc.scrollTop = Math.min(sc.scrollHeight - sc.clientHeight, target + 320);
    }
    scrollToY(target);
  };

  // A finger on the map always wins over an auto-scroll in progress.
  useEffect(() => {
    const sc = scRef.current;
    if (!sc) return;
    const stop = () => stopTween.current();
    sc.addEventListener('touchstart', stop, { passive: true });
    sc.addEventListener('wheel', stop, { passive: true });
    sc.addEventListener('pointerdown', stop, { passive: true });
    return () => {
      stop();
      sc.removeEventListener('touchstart', stop);
      sc.removeEventListener('wheel', stop);
      sc.removeEventListener('pointerdown', stop);
    };
  }, []);

  // ── first layout: jump to the current stage ──
  useLayoutEffect(() => {
    if (!w || initRef.current) return;
    initRef.current = true;
    focusStage(cleared, 'swoop');
  }, [w]);

  // ── scroll-driven bits: near regions, jump button, parallax clouds ──
  useEffect(() => {
    const sc = scRef.current;
    if (!sc || !w) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const { cleared: cl, topCh: tc, scale: k } = live.current;
      const top = sc.scrollTop;
      const h = sc.clientHeight || 600;
      const lo = top - NEAR_PX;
      const hi = top + h + NEAR_PX;
      const list: number[] = [];
      for (let c = 0; c <= tc; c++) {
        const y0 = regionTop(c, tc) * k;
        if (y0 + REGION_H * k > lo && y0 < hi) list.push(c);
      }
      const key = list.join(',');
      setNear((p) => (p === key ? p : key));
      const ny = nodeMapPos(cl, tc).y * k;
      const dir = ny < top + 80 ? -1 : ny > top + h - DOCK_PAD - 40 ? 1 : 0;
      setFab((p) => (p === dir ? p : dir));
      cloudRefs.current.forEach((el, i) => {
        if (!el) return;
        const span = h + 360;
        const base = i * (span / 3) + 60;
        const y = ((((base - top * (0.32 + i * 0.1)) % span) + span) % span) - 180;
        el.style.transform = `translate3d(0, ${y.toFixed(1)}px, 0)`;
      });
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    sc.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => {
      sc.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [w, topCh, cleared]);

  // ── re-centre when the tab is opened again (panes stay mounted) ──
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let lastFocus = 0;
    const refocus = () => {
      const now = Date.now();
      if (now - lastFocus < 600 || now - lastSwoop.current < 900 || !initRef.current) return;
      lastFocus = now;
      focusStage(live.current.cleared, 'gentle');
    };
    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      let first = true;
      io = new IntersectionObserver((entries) => {
        const vis = entries.some((e) => e.isIntersecting && e.intersectionRatio > 0.5);
        const was = visibleRef.current;
        visibleRef.current = vis;
        if (first) {
          first = false;
          return;
        }
        if (vis && !was) refocus();
      }, { threshold: [0, 0.5, 0.9] });
      io.observe(root);
    }
    const pane = root.closest('.tab-pane');
    let mo: MutationObserver | null = null;
    if (pane && typeof MutationObserver !== 'undefined') {
      let active = pane.classList.contains('is-active');
      mo = new MutationObserver(() => {
        const now = pane.classList.contains('is-active');
        if (now && !active) refocus();
        active = now;
      });
      mo.observe(pane, { attributes: true, attributeFilter: ['class'] });
    }
    const onFocusEvt = () => {
      lastFocus = 0;
      refocus();
    };
    window.addEventListener('campaign:focus', onFocusEvt);
    return () => {
      io?.disconnect();
      mo?.disconnect();
      window.removeEventListener('campaign:focus', onFocusEvt);
    };
  }, []);

  // ── marker hops node to node after wins (once the map is on screen again) ──
  const mapOnScreen = () => {
    const root = rootRef.current;
    if (!root || document.visibilityState === 'hidden') return false;
    if (nav.tab !== 'campaign' || !visibleRef.current) return false;
    if (root.closest('[inert]')) return false;
    return !document.querySelector('.battle, .story');
  };
  useEffect(() => {
    if (shown === cleared) return;
    if (cleared < shown || cleared - shown > 12) {
      setShown(cleared);
      return;
    }
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (!mapOnScreen()) {
        t = setTimeout(tick, 350);
        return;
      }
      const next = shown + 1;
      setFresh(shown);
      setShown(next);
      focusStage(next, 'gentle');
      if (next === cleared) haptic('light');
    };
    t = setTimeout(tick, reducedMotion() ? 0 : 520);
    return () => clearTimeout(t);
  }, [cleared, shown]);

  // ── actions ──
  const onNode = (i: number) => {
    sfx.click();
    haptic('tap');
    setSheet(i);
  };
  const onChest = (chapter: number, tier: number) => {
    const st = getState();
    const status = chestStatus(st.campaign, st.stage, chapter, tier);
    if (status === 'claimed') {
      toast(`${CHEST_NAMES[tier]} already opened.`);
      return;
    }
    if (status === 'locked') {
      const r = chestReward(chapter, tier);
      const bits = [r.gems ? `${r.gems} gems` : '', r.tickets ? `${r.tickets} ticket${r.tickets > 1 ? 's' : ''}` : '', r.essence ? `${fmtShort(r.essence)} essence` : '', r.yul ? `${fmtShort(r.yul)} yul` : '']
        .filter(Boolean)
        .join(', ');
      toast(`Reach ${CHEST_STARS[tier]}★ in Chapter ${chapter + 1} to open: ${bits}`);
      return;
    }
    const reward = claimChest(ensureCampaign(st), st.stage, chapter, tier);
    if (!reward) return;
    grantReward(reward);
    emitGameEvent({ type: 'feature', name: 'campaignChest', amount: 1 });
    commit();
    haptic('medium');
    setParty({ chapter, tier, reward });
  };
  const goChapter = (c: number) => {
    const sc = scRef.current;
    if (!sc || !scale) return;
    scrollToY((regionTop(c, topCh) + REGION_H * 0.55) * scale - sc.clientHeight / 2);
  };
  const fightCurrent = () => {
    if (!hasSquad(getState())) {
      toast('Pick your squad first!');
      nav.go('squad');
      return;
    }
    nav.fight(cleared);
  };
  const jumpTo = (stage: number) => {
    setSheet(null);
    focusStage(stage, 'smooth');
    setTimeout(() => setSheet(stage), reducedMotion() ? 250 : 650);
  };

  // ── render ──
  const nearSet = new Set(near.split(',').filter(Boolean).map(Number));
  if (!near && w) for (let c = Math.max(0, curCh - 1); c <= Math.min(topCh, curCh + 1); c++) nearSet.add(c);
  const regions: number[] = [];
  for (let c = topCh; c >= 0; c--) regions.push(c);
  const mapH = mapHeight(topCh) * scale;
  const marker = nodeMapPos(shown, topCh);
  const markerNode = regionLayout(Math.floor(shown / STAGES_PER_CHAPTER)).nodes[shown % STAGES_PER_CHAPTER];
  const markerBoss = markerNode.boss;
  const mx = (marker.x + markerNode.side * (markerBoss ? 46 : 38)) * scale;
  const my = (marker.y - (markerBoss ? 30 : 26)) * scale;
  const bottomBase = PALETTES[0].base[0];

  return (
    <div class="cmap-root" ref={rootRef}>
      <div class="cmap-scroll" ref={scRef}>
        {w > 0 && (
          <div class="cmap-map" style={{ height: mapH + DOCK_PAD, background: bottomBase }}>
            <div class="cmap-fog" style={{ height: FOG_H * scale + 2 }}>
              <FogArt seed={topCh} />
              <div class="cmap-fog-text">
                <div class="comic">Uncharted Lands</div>
                <div class="small-text">Defeat {getHero(CHAPTERS[themeOf(curCh)].boss).name} to push back the fog</div>
              </div>
            </div>
            {regions.map((c) => (
              <Region
                key={c}
                chapter={c}
                scale={scale}
                top={regionTop(c, topCh) * scale}
                near={nearSet.has(c)}
                cleared={cleared}
                topCh={topCh}
                stars={starsObj}
                chests={chestsObj}
                fresh={fresh}
                onNode={onNode}
                onChest={onChest}
              />
            ))}
            <div class="cmap-marker" style={{ transform: `translate3d(${mx.toFixed(1)}px, ${my.toFixed(1)}px, 0)` }} aria-hidden="true">
              <div class="cmap-marker-hop" key={shown}>
                <div class="cmap-marker-pin">
                  <CharacterArt id={leader} mode="portrait" />
                </div>
                <div class="cmap-marker-tip" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div class="cmap-clouds" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <i
            key={i}
            ref={(el) => {
              cloudRefs.current[i] = el;
            }}
            class={`cmap-cloud c${i}`}
          />
        ))}
      </div>

      <div class="cmap-head">
        <button class="cmap-head-stage" onClick={() => focusStage(cleared, 'smooth')} aria-label={`Next battle: stage ${cur.label}`}>
          <span class="cmap-head-lbl">{cur.label}</span>
          <span class="cmap-head-txt">
            <b>{cur.isBoss ? 'Boss Stage' : `Stage ${cur.num}`}</b>
            <span>{cur.loop ? `Abyss ${cur.loop} · ${cur.chapter.name}` : cur.chapter.name}</span>
          </span>
        </button>
        <button class="cmap-head-chip stars" onClick={() => setOverview(true)} aria-label={`${total} stars, star chests`}>
          <b>★</b>
          {total}
          {ready > 0 && <span class="badge-dot cmap-dot" />}
        </button>
        <span class="cmap-head-chip">
          <b class="cmap-bolt">⚡</b>
          {fmtShort(power)}
        </span>
      </div>

      {fab !== 0 && (
        <button class={`cmap-fab ${fab < 0 ? 'up' : 'down'}`} onClick={() => focusStage(cleared, 'smooth')} aria-label="Jump to current stage">
          <span class="cmap-fab-face">
            <CharacterArt id={leader} mode="portrait" />
          </span>
          <span class="cmap-fab-arrow">{fab < 0 ? '▲' : '▼'}</span>
        </button>
      )}

      <div class="cmap-dock">
        <button
          class="btn dark cmap-dock-squad"
          onClick={() => nav.go('squad')}
          aria-label="Edit squad"
        >
          🛡️
        </button>
        <button class="btn red big cmap-dock-go" onClick={fightCurrent}>
          <span>Battle</span>
          <span class="cmap-dock-lbl">{cur.label}</span>
        </button>
      </div>

      {sheet !== null && <StageSheet key={sheet} stage={sheet} s={s} nav={nav} onClose={() => setSheet(null)} onJump={jumpTo} />}
      {overview && <ChestOverview s={s} onClose={() => setOverview(false)} onChest={onChest} onGo={goChapter} />}
      {party && <ChestParty key={`${party.chapter}-${party.tier}`} {...party} onClose={() => setParty(null)} />}
    </div>
  );
}
