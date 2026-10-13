// Pure motion & gesture math shared by the shell, the hub and the screens.
// No DOM access here so it can be unit-tested (tests/ui.test.ts).
import type { Tab } from './nav';

/** Bottom-nav order; transitions and swipes follow it. */
export const TAB_ORDER: Tab[] = ['home', 'heroes', 'campaign', 'squad', 'summon'];

export function tabIndex(t: Tab): number {
  return Math.max(0, TAB_ORDER.indexOf(t));
}

/** +1 when `to` sits right of `from` in the nav (content slides in from the right), -1 when left, 0 when equal. */
export function tabDirection(from: Tab, to: Tab): -1 | 0 | 1 {
  const d = tabIndex(to) - tabIndex(from);
  return d > 0 ? 1 : d < 0 ? -1 : 0;
}

/** The tab next to `t` in direction `dir` (+1 = right), or null at either end. */
export function neighborTab(t: Tab, dir: -1 | 1): Tab | null {
  return TAB_ORDER[tabIndex(t) + dir] ?? null;
}

export type Intent = 'pending' | 'horizontal' | 'vertical';

/**
 * Decide which axis a touch drag belongs to once it leaves the slop radius.
 * Horizontal needs a clear lead (1.4×) over vertical so diagonal scrolls stay scrolls.
 */
export function classifyIntent(dx: number, dy: number, slop = 10): Intent {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < slop && ay < slop) return 'pending';
  return ax > ay * 1.4 ? 'horizontal' : 'vertical';
}

/** Should a released horizontal drag complete its navigation? A long drag or a quick flick does. */
export function shouldCommit(dx: number, vx: number, width: number, distFrac = 0.28): boolean {
  if (!width || !dx) return false;
  const flick = Math.abs(vx) > 0.45 && Math.sign(vx) === Math.sign(dx) && Math.abs(dx) > 24;
  return flick || Math.abs(dx) > width * distFrac;
}

/** Elastic resistance past the first/last tab: never exceeds `limit`. */
export function rubberBand(dx: number, limit = 72): number {
  const a = Math.abs(dx);
  return Math.sign(dx) * ((a * limit) / (a + limit));
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Tracks recent pointer samples and reports velocity in px/ms. */
export class VelocityTracker {
  private pts: { x: number; t: number }[] = [];
  constructor(private windowMs = 100) {}
  add(x: number, t: number) {
    this.pts.push({ x, t });
    while (this.pts.length > 2 && t - this.pts[0].t > this.windowMs) this.pts.shift();
  }
  velocity(): number {
    if (this.pts.length < 2) return 0;
    const a = this.pts[0];
    const b = this.pts[this.pts.length - 1];
    const dt = b.t - a.t;
    return dt > 0 ? (b.x - a.x) / dt : 0;
  }
}

// ───────── tweens ─────────

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);

export function tween(from: number, to: number, t: number): number {
  return from + (to - from) * clamp(t, 0, 1);
}

/** Count-up length: bigger jumps get a little longer, but always snappy. */
export function countDuration(from: number, to: number): number {
  const d = Math.abs(to - from);
  if (d === 0) return 0;
  return Math.round(clamp(320 + Math.log10(d + 1) * 90, 320, 900));
}

// ───────── labels ─────────

/** Label of the campaign stage you must clear to reach `cleared` total clears ("1-5" style). */
export function stageLabel(cleared: number): string {
  const n = Math.max(1, Math.floor(cleared));
  return `${Math.floor((n - 1) / 10) + 1}-${((n - 1) % 10) + 1}`;
}

/** "Clear 1-5" — or null when the feature is already open. */
export function unlockText(unlockStage: number | undefined, stage: number): string | null {
  const need = unlockStage ?? 0;
  return need > stage ? `Clear ${stageLabel(need)}` : null;
}

/** Signed short delta like "+1.2K" / "-300" for currency change pops. */
export function deltaText(delta: number, short: (n: number) => string): string {
  if (!delta) return '';
  return `${delta > 0 ? '+' : '-'}${short(Math.abs(delta))}`;
}
