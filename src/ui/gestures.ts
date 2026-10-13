// DOM-side gesture helpers for the shell (tab swipes, edge-swipe back).
// The math lives in motion.ts; this file only reads the DOM.

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

/**
 * May a horizontal swipe that starts on `target` navigate? Not from inputs, from anything
 * marked data-noswipe (drag boards, sliders…), or from inside a horizontally scrollable strip.
 */
export function swipeAllowedFrom(target: EventTarget | null, root: Element, checkScrollers = true): boolean {
  let el = target instanceof Element ? target : null;
  if (!el) return true;
  if (el.closest(EDITABLE) || el.closest('[data-noswipe]')) return false;
  if (!checkScrollers) return true;
  while (el && el !== root) {
    if (el instanceof HTMLElement && el.scrollWidth > el.clientWidth + 1) {
      const ox = getComputedStyle(el).overflowX;
      if (ox === 'auto' || ox === 'scroll') return false;
    }
    el = el.parentElement;
  }
  return true;
}

export function setX(el: HTMLElement | null | undefined, x: number | null) {
  if (!el) return;
  el.style.transform = x === null ? '' : `translate3d(${x.toFixed(1)}px,0,0)`;
}

/** Current translateX of an element (inline style or running animation). */
export function currentX(el: HTMLElement): number {
  try {
    const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    return m.m41;
  } catch {
    return 0;
  }
}

export const EASE_OUT = 'cubic-bezier(.22,.9,.24,1)';

/** Slide an element horizontally with WAAPI and hold the end state until cancelled. */
export function slideX(el: HTMLElement, from: number, to: number, ms: number, extra?: { fromOpacity?: number; toOpacity?: number }): Animation | null {
  if (typeof el.animate !== 'function') return null;
  const a: Keyframe = { transform: `translate3d(${from}px,0,0)` };
  const b: Keyframe = { transform: `translate3d(${to}px,0,0)` };
  if (extra?.fromOpacity !== undefined) a.opacity = extra.fromOpacity;
  if (extra?.toOpacity !== undefined) b.opacity = extra.toOpacity;
  return el.animate([a, b], { duration: Math.max(1, ms), easing: EASE_OUT, fill: 'forwards' });
}

/** Settle duration for a release: shorter when the finger was already moving fast. */
export function settleMs(remaining: number, vx: number): number {
  const v = Math.abs(vx);
  const byV = v > 0.1 ? Math.abs(remaining) / v : 320;
  return Math.round(Math.min(320, Math.max(150, byV)));
}

export function onIdle(fn: () => void, timeout = 900): () => void {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(fn, { timeout });
    return () => w.cancelIdleCallback?.(id);
  }
  const t = setTimeout(fn, 350);
  return () => clearTimeout(t);
}
