// Small interaction/animation helpers shared by every screen:
// count-up numbers, skeleton shimmer, hold-to-repeat buttons, particle bursts and
// reward "fly to the top bar" coins. Everything respects reduced motion.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Currencies } from '../../game/state';
import { fmt } from '../../game/stats';
import { countDuration, easeOutCubic, tween } from '../motion';
import { reducedMotion } from '../prefs';

// ───────── count-up numbers ─────────

export interface CountChange {
  dir: 1 | -1;
  delta: number;
  key: number;
}

let changeSeq = 0;

/** Animates toward `value` whenever it changes; reports the last change for pulse/delta pops. */
export function useCountUp(value: number): { shown: number; change: CountChange | null } {
  const [shown, setShown] = useState(value);
  const [change, setChange] = useState<CountChange | null>(null);
  const shownRef = useRef(value);
  const target = useRef(value);

  useEffect(() => {
    if (value === target.current) return;
    const from = shownRef.current;
    const prevTarget = target.current;
    target.current = value;
    if (!Number.isFinite(value)) return;
    setChange({ dir: value > prevTarget ? 1 : -1, delta: value - prevTarget, key: ++changeSeq });
    const dur = countDuration(from, value);
    if (reducedMotion() || dur === 0) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const t0 = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const p = Math.min(1, (now - t0) / dur);
      const v = p >= 1 ? value : tween(from, value, easeOutCubic(p));
      shownRef.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [value]);

  // Drop the delta pop once its animation is long over.
  useEffect(() => {
    if (!change) return;
    const t = setTimeout(() => setChange((c) => (c?.key === change.key ? null : c)), 1400);
    return () => clearTimeout(t);
  }, [change?.key]);

  return { shown, change };
}

/** A number that counts toward its new value and pulses green/red when it changes. */
export function AnimatedNumber({ value, format = fmt, class: cls }: { value: number; format?: (n: number) => string; class?: string }) {
  const { shown, change } = useCountUp(value);
  return (
    <span class={`anum ${cls ?? ''}`}>
      <span key={change?.key ?? 0} class={change ? (change.dir > 0 ? 'anum-up' : 'anum-down') : ''}>
        {format(Math.round(shown))}
      </span>
    </span>
  );
}

// ───────── skeleton shimmer (loading states) ─────────

export function Skeleton({ w = '100%', h = 14, r = 8, class: cls }: { w?: number | string; h?: number | string; r?: number; class?: string }) {
  return <span class={`skeleton ${cls ?? ''}`} style={{ width: w, height: h, borderRadius: r }} aria-hidden="true" />;
}

/** A few placeholder rows (avatar + two lines) while online data loads. */
export function SkeletonList({ rows = 3, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <div class="skeleton-list" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div class="skeleton-row" key={i}>
          {avatar && <Skeleton w={44} h={44} r={12} />}
          <div class="skeleton-lines">
            <Skeleton w={`${70 - ((i * 13) % 30)}%`} h={14} />
            <Skeleton w={`${45 + ((i * 17) % 30)}%`} h={10} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ───────── hold-to-repeat ─────────

/**
 * Button props that fire `fn` on press and keep firing while held (accelerating).
 * `fn` returns false to stop. Keyboard / screen-reader clicks fire once.
 */
export function useHoldRepeat(fn: () => boolean | void, opts: { delay?: number; interval?: number; min?: number } = {}) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerFired = useRef(false);
  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    window.removeEventListener('pointerup', stop);
    window.removeEventListener('pointercancel', stop);
  };
  useEffect(() => stop, []);
  const delay = opts.delay ?? 420;
  const start = (e: PointerEvent) => {
    if (e.button !== undefined && e.button > 0) return;
    stop();
    pointerFired.current = true;
    if (fnRef.current() === false) return;
    let gap = opts.interval ?? 150;
    const min = opts.min ?? 45;
    const loop = () => {
      if (fnRef.current() === false) return stop();
      gap = Math.max(min, gap * 0.86);
      timer.current = setTimeout(loop, gap);
    };
    timer.current = setTimeout(loop, delay);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  };
  return {
    onPointerDown: start,
    onPointerLeave: stop,
    onContextMenu: (e: Event) => e.preventDefault(),
    onClick: () => {
      if (pointerFired.current) {
        pointerFired.current = false;
        return;
      }
      fnRef.current();
    },
  };
}

// ───────── particle bursts ─────────

/** Radial burst of sparks; mount it with a fresh `key` to replay. */
export function Burst({ count = 14, colors = ['#ffc531', '#fff3a0', '#ff9f1c'], spread = 90, glyph }: { count?: number; colors?: string[]; spread?: number; glyph?: string }) {
  const parts = useRef(
    Array.from({ length: count }, (_, i) => {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const d = spread * (0.55 + Math.random() * 0.45);
      return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, c: colors[i % colors.length], s: 0.6 + Math.random() * 0.7, delay: Math.random() * 0.08 };
    }),
  ).current;
  if (reducedMotion()) return null;
  return (
    <span class="fx-burst" aria-hidden="true">
      {parts.map((p, i) => (
        <i
          key={i}
          class={glyph ? 'glyph' : ''}
          style={{ '--dx': `${p.dx.toFixed(1)}px`, '--dy': `${p.dy.toFixed(1)}px`, '--s': p.s.toFixed(2), background: glyph ? 'none' : p.c, color: p.c, animationDelay: `${p.delay}s` } as any}
        >
          {glyph}
        </i>
      ))}
    </span>
  );
}

// ───────── reward coins flying into the top bar ─────────

type FlyKind = keyof Currencies;

interface FlyCoin {
  id: number;
  kind: FlyKind;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
  tx: number;
  ty: number;
  delay: number;
}

let flyId = 0;
const flyListeners = new Set<(coins: FlyCoin[]) => void>();

/**
 * Burst currency icons out of `from` and fly them to the matching top-bar counter
 * (elements marked data-currency="yul" etc.). Falls back to a plain upward burst.
 */
export function flyRewards(from: Element | DOMRect | null, reward: Partial<Record<FlyKind, number>>, perKind = 5) {
  if (reducedMotion() || !from) return;
  const r = from instanceof Element ? from.getBoundingClientRect() : from;
  const sx = r.left + r.width / 2;
  const sy = r.top + r.height / 2;
  const coins: FlyCoin[] = [];
  const kinds = (Object.keys(reward) as FlyKind[]).filter((k) => (reward[k] ?? 0) > 0);
  kinds.forEach((kind, ki) => {
    const target = document.querySelector(`[data-currency="${kind}"]`)?.getBoundingClientRect();
    const n = Math.min(perKind, 2 + Math.floor(Math.log10((reward[kind] ?? 0) + 1)));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 30 + Math.random() * 50;
      coins.push({
        id: ++flyId,
        kind,
        sx,
        sy,
        ox: Math.cos(a) * d,
        oy: Math.sin(a) * d - 20,
        tx: target ? target.left + 11 : sx + (Math.random() - 0.5) * 200,
        ty: target ? target.top + target.height / 2 : sy - 320,
        delay: ki * 0.06 + i * 0.045,
      });
    }
  });
  if (coins.length) flyListeners.forEach((l) => l(coins));
}

/** Render once near the root (App). Hosts the flying reward icons. */
export function FlyLayer({ icon }: { icon: (kind: FlyKind) => ComponentChildren }) {
  const [coins, setCoins] = useState<FlyCoin[]>([]);
  useEffect(() => {
    const l = (c: FlyCoin[]) => {
      setCoins((xs) => [...xs.slice(-40), ...c]);
      const ids = new Set(c.map((x) => x.id));
      setTimeout(() => setCoins((xs) => xs.filter((x) => !ids.has(x.id))), 1400);
    };
    flyListeners.add(l);
    return () => {
      flyListeners.delete(l);
    };
  }, []);
  return (
    <div class="fly-layer" aria-hidden="true">
      {coins.map((c) => (
        <span
          key={c.id}
          class="coin-burst fly"
          style={{ '--sx': `${c.sx}px`, '--sy': `${c.sy}px`, '--ox': `${c.ox}px`, '--oy': `${c.oy}px`, '--tx': `${c.tx}px`, '--ty': `${c.ty}px`, animationDelay: `${c.delay}s` } as any}
        >
          {icon(c.kind)}
        </span>
      ))}
    </div>
  );
}
