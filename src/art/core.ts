// Core drawing helpers shared by the character art system.
// Everything is plain functions returning path strings / colors so the
// renderers stay cheap (no component instances per body part).

/** Outline ink colour and default outline width (in the 100x120 box). */
export const OUT = '#1a1020';
export const SW = 2.6;
export const THIN = 1.5;

/** [x, y] or [x, y, 1] where the third value marks a sharp corner. */
export type Pt = [number, number] | [number, number, number];

const fx = (n: number) => (Math.round(n * 100) / 100).toString();

/**
 * Catmull-Rom spline through points, converted to cubic beziers.
 * Points flagged sharp (third value truthy) become corners, which is how
 * hair spikes, cape corners and claws are authored.
 */
export function spline(pts: Pt[], closed = true, tension = 1): string {
  const n = pts.length;
  if (n < 2) return '';
  const g = (i: number): Pt => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let d = `M${fx(pts[0][0])} ${fx(pts[0][1])}`;
  const segs = closed ? n : n - 1;
  const k = tension / 6;
  for (let i = 0; i < segs; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    let c1x: number, c1y: number, c2x: number, c2y: number;
    if (p1[2] || (!closed && i === 0)) {
      c1x = p1[0] + (p2[0] - p1[0]) * 0.3;
      c1y = p1[1] + (p2[1] - p1[1]) * 0.3;
    } else {
      c1x = p1[0] + (p2[0] - p0[0]) * k;
      c1y = p1[1] + (p2[1] - p0[1]) * k;
    }
    if (p2[2] || (!closed && i === segs - 1)) {
      c2x = p2[0] + (p1[0] - p2[0]) * 0.3;
      c2y = p2[1] + (p1[1] - p2[1]) * 0.3;
    } else {
      c2x = p2[0] - (p3[0] - p1[0]) * k;
      c2y = p2[1] - (p3[1] - p1[1]) * k;
    }
    d += `C${fx(c1x)} ${fx(c1y)} ${fx(c2x)} ${fx(c2y)} ${fx(p2[0])} ${fx(p2[1])}`;
  }
  return closed ? d + 'Z' : d;
}

/** Mirror a point list horizontally around x = cx (reverses order to keep winding). */
export function mirrorPts(pts: Pt[], cx = 50): Pt[] {
  return pts.map((p) => (p[2] ? [2 * cx - p[0], p[1], p[2]] : [2 * cx - p[0], p[1]]) as Pt).reverse();
}

/** Simple polyline (open) path string. */
export function line(pts: [number, number][]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${fx(p[0])} ${fx(p[1])}`).join('');
}

/** Ellipse as a path (useful when a path is needed for clips/outlines). */
export function ell(cx: number, cy: number, rx: number, ry: number): string {
  return `M${fx(cx - rx)} ${fx(cy)}a${fx(rx)} ${fx(ry)} 0 1 0 ${fx(rx * 2)} 0a${fx(rx)} ${fx(ry)} 0 1 0 ${fx(-rx * 2)} 0Z`;
}

function hex(c: string): [number, number, number] {
  let h = c.replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const v = parseInt(h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Linear mix of two hex colours. */
export function mix(a: string, b: string, t: number): string {
  const A = hex(a), B = hex(b);
  const m = (i: number) => Math.round(A[i] + (B[i] - A[i]) * t);
  return '#' + ((1 << 24) | (m(0) << 16) | (m(1) << 8) | m(2)).toString(16).slice(1);
}

/** Cel-shade tone: darker and pushed slightly toward violet for a cartoon feel. */
export function shade(c: string, t = 0.3): string {
  return mix(c, '#2b1740', t);
}

/** Lighter tint (for highlights / shine). */
export function tint(c: string, t = 0.4): string {
  return mix(c, '#ffffff', t);
}

/** Polar point helper. */
export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
}

/** Heart-shaped clover leaf with its point at the origin, pointing up (−y). */
export function leafPath(s: number): string {
  return `M0 0C${fx(-s * 1.05)} ${fx(-s * 0.35)} ${fx(-s * 0.85)} ${fx(-s * 1.25)} 0 ${fx(-s * 0.9)}C${fx(s * 0.85)} ${fx(-s * 1.25)} ${fx(s * 1.05)} ${fx(-s * 0.35)} 0 0Z`;
}

/** Several clover leaves merged into one path (one element instead of n). */
export function leavesPath(n: number, s: number, startDeg: number): string {
  // control points of leafPath, rotated per leaf
  const base: [number, number][] = [
    [-s * 1.05, -s * 0.35], [-s * 0.85, -s * 1.25], [0, -s * 0.9],
    [s * 0.85, -s * 1.25], [s * 1.05, -s * 0.35], [0, 0],
  ];
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = ((startDeg + (360 / n) * i) * Math.PI) / 180;
    const c = Math.cos(a), sn = Math.sin(a);
    const p = base.map(([x, y]) => `${fx(x * c - y * sn)} ${fx(x * sn + y * c)}`);
    d += `M0 0C${p[0]} ${p[1]} ${p[2]}C${p[3]} ${p[4]} ${p[5]}Z`;
  }
  return d;
}

/** Star/sparkle (4-point) path centred at cx, cy. */
export function sparkle(cx: number, cy: number, r: number): string {
  const q = r * 0.28;
  return `M${fx(cx)} ${fx(cy - r)}Q${fx(cx + q)} ${fx(cy - q)} ${fx(cx + r)} ${fx(cy)}Q${fx(cx + q)} ${fx(cy + q)} ${fx(cx)} ${fx(cy + r)}Q${fx(cx - q)} ${fx(cy + q)} ${fx(cx - r)} ${fx(cy)}Q${fx(cx - q)} ${fx(cy - q)} ${fx(cx)} ${fx(cy - r)}Z`;
}

/** Spikes around an ellipse: returns point list alternating valley/tip. */
export function spikeRing(
  cx: number, cy: number, rx: number, ry: number,
  fromDeg: number, toDeg: number, count: number, len: number, swirl = 0, jitter: number[] = [],
): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= count * 2; i++) {
    const t = i / (count * 2);
    const a = fromDeg + (toDeg - fromDeg) * t;
    const rad = (a * Math.PI) / 180;
    if (i % 2 === 0) {
      out.push([cx + Math.cos(rad) * rx, cy + Math.sin(rad) * ry]);
    } else {
      const j = jitter[(i - 1) / 2] ?? 1;
      const ra = ((a + swirl) * Math.PI) / 180;
      out.push([cx + Math.cos(ra) * (rx + len * j), cy + Math.sin(ra) * (ry + len * j), 1]);
    }
  }
  return out;
}
