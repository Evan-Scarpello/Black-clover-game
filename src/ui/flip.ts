// FLIP list transitions: capture where items are, let the DOM change, then glide them
// from the old spot to the new one (transform/opacity only). New items pop in.
import { reducedMotion } from './prefs';

export type Rects = Map<string, DOMRect>;

/** Positions of every element under `root` that carries `attr` (its value is the key). */
export function captureRects(root: Element | null | undefined, attr = 'data-flip'): Rects {
  const out: Rects = new Map();
  if (!root) return out;
  root.querySelectorAll(`[${attr}]`).forEach((el) => {
    const k = el.getAttribute(attr);
    if (k) out.set(k, el.getBoundingClientRect());
  });
  return out;
}

/** Animate elements from their captured rects to where they are now. Caps work for long lists. */
export function playFlip(root: Element | null | undefined, before: Rects, attr = 'data-flip', max = 80) {
  if (!root || reducedMotion() || !before.size) return;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1000;
  let n = 0;
  let fresh = 0;
  root.querySelectorAll<HTMLElement>(`[${attr}]`).forEach((el) => {
    if (n >= max || typeof el.animate !== 'function') return;
    const k = el.getAttribute(attr);
    if (!k) return;
    const now = el.getBoundingClientRect();
    // Off-screen items just appear; animating them costs frames for nothing.
    if (now.bottom < -40 || now.top > vh + 40) return;
    const was = before.get(k);
    n++;
    if (was) {
      const dx = was.left - now.left;
      const dy = was.top - now.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { duration: 340, easing: 'cubic-bezier(.22,.9,.24,1)' });
    } else {
      el.animate(
        [
          { transform: 'scale(.8)', opacity: 0 },
          { transform: 'scale(1)', opacity: 1 },
        ],
        { duration: 280, delay: Math.min(10, fresh++) * 22, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'backwards' },
      );
    }
  });
}
