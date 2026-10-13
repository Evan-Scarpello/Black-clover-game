// Procedural world-map scenery: one static SVG per region (drawn once, then just scrolled)
// plus a handful of tiny animated "fx" elements rendered as HTML so their animations stay on
// the compositor. Everything is drawn in map units (see mapLayout.ts).
import type { JSX } from 'preact';
import { memo } from 'preact/compat';
import { CHAPTERS } from '../../data/campaign';
import { rng } from '../../game/rng';
import { MAP_W, REGION_H, type Decor, type RegionLayout, regionLayout } from './mapLayout';

const INK = '#0b0710';

export interface Palette {
  base: [string, string];
  leaf: string;
  leaf2: string;
  trunk: string;
  stone: string;
  stone2: string;
  roof: string;
  wall: string;
  road: string;
  roadDim: string;
  patch: string;
  patch2: string;
}

export const PALETTES: Palette[] = [
  // Hage Village — fields at sunset
  { base: ['#86ad4c', '#5e8634'], leaf: '#4f9a3a', leaf2: '#8fd16a', trunk: '#7a4a2a', stone: '#c9bfae', stone2: '#ece4d6', roof: '#c0563c', wall: '#f6e9cc', road: '#f2dca2', roadDim: '#a99b6f', patch: '#d8c25e', patch2: '#9cc456' },
  // The Dungeon
  { base: ['#565671', '#2a2840'], leaf: '#3f6b5a', leaf2: '#5f9a82', trunk: '#4a3a30', stone: '#7c7896', stone2: '#aaa6c4', roof: '#5b4a7a', wall: '#8c88a6', road: '#c4c0da', roadDim: '#6a6684', patch: '#3b3953', patch2: '#1a1828' },
  // Royal Capital Raid
  { base: ['#a5867a', '#6f5146'], leaf: '#5b8c3a', leaf2: '#8bc34a', trunk: '#6d4c41', stone: '#d7ccc8', stone2: '#f2eeec', roof: '#c62828', wall: '#f5e6d3', road: '#efe1cf', roadDim: '#a89284', patch: '#c4aea2', patch2: '#3a2a26' },
  // Underwater Temple
  { base: ['#3aa6dc', '#0c3c86'], leaf: '#2e9e6a', leaf2: '#5fd39a', trunk: '#3e6b5a', stone: '#7fa6b6', stone2: '#c3e6ef', roof: '#00838f', wall: '#e0f7fa', road: '#efe3b6', roadDim: '#8fa7a8', patch: '#2bb3a2', patch2: '#082a66' },
  // Royal Knights Exam
  { base: ['#c2a594', '#8f7064'], leaf: '#6a9a3a', leaf2: '#9ccc65', trunk: '#6d4c41', stone: '#d6c8bd', stone2: '#f3ebe4', roof: '#e65100', wall: '#fff3e0', road: '#fbecd0', roadDim: '#b49c86', patch: '#e9cfa6', patch2: '#d9b98a' },
  // Elf Reincarnation
  { base: ['#86bd4a', '#3f6b2a'], leaf: '#3f8a3a', leaf2: '#8fd16a', trunk: '#6b4a3a', stone: '#b9b2c9', stone2: '#e3def0', roof: '#7b1fa2', wall: '#f3e5f5', road: '#f3e7bf', roadDim: '#9fa477', patch: '#a6d66a', patch2: '#4fa3d8' },
  // Spade Kingdom Raid
  { base: ['#463d5e', '#18132a'], leaf: '#3a3350', leaf2: '#5a4f78', trunk: '#1a1424', stone: '#5c5470', stone2: '#8b82a3', roof: '#2a2238', wall: '#4a4060', road: '#9c93b8', roadDim: '#4f4866', patch: '#2a2340', patch2: '#b388ff' },
  // Gate of the Underworld
  { base: ['#55332b', '#1c0907'], leaf: '#4a2c26', leaf2: '#6d3b30', trunk: '#2b1410', stone: '#5d4037', stone2: '#8a6a5e', roof: '#7f0000', wall: '#5d4037', road: '#b3988d', roadDim: '#5a3f38', patch: '#ff6d00', patch2: '#ff3d00' },
  // Paladin's Ascension
  { base: ['#ffefc0', '#ffbe45'], leaf: '#7cb342', leaf2: '#aed581', trunk: '#8d6e63', stone: '#fff8e1', stone2: '#ffffff', roof: '#ffb300', wall: '#fffdf5', road: '#ffffff', roadDim: '#e3c27a', patch: '#ffffff', patch2: '#ffd54f' },
];

const o = { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' } as const;
const thin = { stroke: INK, 'stroke-width': 1.4, 'stroke-linejoin': 'round' } as const;

// ───────── small reusable shapes ─────────

/** Circles blended into one silhouette with a single outline (ink pass, then fill pass). */
function blob(circles: [number, number, number][], fill: string, hi?: string): JSX.Element {
  return (
    <g>
      {circles.map(([x, y, r], i) => (
        <circle key={`i${i}`} cx={x} cy={y} r={r + 2} fill={INK} />
      ))}
      {circles.map(([x, y, r], i) => (
        <circle key={`f${i}`} cx={x} cy={y} r={r} fill={fill} />
      ))}
      {hi && <circle cx={circles[0][0] - circles[0][2] * 0.35} cy={circles[0][1] - circles[0][2] * 0.35} r={circles[0][2] * 0.38} fill={hi} opacity={0.75} />}
    </g>
  );
}

function tree(p: Palette) {
  return (
    <g>
      <ellipse cx={0} cy={0} rx={13} ry={4} fill="#000" opacity={0.18} />
      <path d="M-3 0 L-2.4 -15 L2.4 -15 L3 0Z" fill={p.trunk} {...o} />
      {blob(
        [
          [0, -25, 12],
          [-9, -17, 8.5],
          [9, -18, 8.5],
        ],
        p.leaf,
        p.leaf2,
      )}
    </g>
  );
}

function bush(p: Palette) {
  return blob(
    [
      [0, -8, 7.5],
      [-7, -5, 5.5],
      [7, -5, 5.5],
    ],
    p.leaf,
    p.leaf2,
  );
}

function rock(p: Palette) {
  return (
    <g>
      <path d="M-11 0 L-9.5 -7 L-4 -12 L5 -11.5 L11 -5 L10.5 0Z" fill={p.stone} {...o} />
      <path d="M-6 -8 L-2 -10.5 L4 -10" fill="none" stroke={p.stone2} stroke-width={2} stroke-linecap="round" />
    </g>
  );
}

function house(p: Palette, roof = p.roof) {
  return (
    <g>
      <ellipse cx={0} cy={0} rx={17} ry={4} fill="#000" opacity={0.18} />
      <rect x={-13} y={-17} width={26} height={17} fill={p.wall} {...o} />
      <path d="M-17 -16 L0 -31 L17 -16Z" fill={roof} {...o} />
      <path d="M-11 -18 L0 -27.5" stroke="#fff" stroke-opacity={0.35} stroke-width={2} stroke-linecap="round" />
      <rect x={-3.5} y={-10} width={7} height={10} fill="#5d3a22" {...thin} />
      <rect x={6} y={-13} width={5} height={5} fill="#ffe9a8" {...thin} />
      <rect x={-11} y={-13} width={5} height={5} fill="#ffe9a8" {...thin} />
    </g>
  );
}

function skull() {
  return (
    <g>
      <path d="M-6 -3 Q-7 -13 0 -13 Q7 -13 6 -3 L4 -3 L4 0 L-4 0 L-4 -3Z" fill="#efe6d8" {...thin} />
      <circle cx={-2.4} cy={-7} r={1.8} fill={INK} />
      <circle cx={2.4} cy={-7} r={1.8} fill={INK} />
    </g>
  );
}

function crystals(color: string, big: boolean) {
  const k = big ? 1.7 : 1;
  return (
    <g transform={`scale(${k})`}>
      <ellipse cx={0} cy={0} rx={13} ry={4} fill={color} opacity={0.3} />
      <path d="M-9 0 L-11 -10 L-7 -17 L-4 -9 L-4 0Z" fill={color} {...thin} />
      <path d="M-4 0 L-4 -16 L0 -26 L4 -16 L4 0Z" fill={color} {...thin} />
      <path d="M4 0 L5 -11 L9 -16 L11 -8 L9 0Z" fill={color} {...thin} />
      <path d="M-1.5 -16 L0 -22 M1 -6 L1 -14" stroke="#fff" stroke-width={1.6} stroke-linecap="round" opacity={0.85} />
    </g>
  );
}

function column(p: Palette, h: number, broken = true) {
  const top = broken ? `L-3 ${-h - 4} L0 ${-h + 1} L3 ${-h - 3} L6 ${-h}` : `L6 ${-h}`;
  return (
    <g>
      <rect x={-8} y={-4} width={16} height={4} fill={p.stone} {...thin} />
      <path d={`M-6 -4 L-6 ${-h} ${top} L6 -4Z`} fill={p.stone2} {...thin} />
      <path d={`M-2 -6 L-2 ${-h + 3} M2 -6 L2 ${-h + 3}`} stroke={p.stone} stroke-width={1.2} />
    </g>
  );
}

function flag(color: string, h = 26) {
  return (
    <g>
      <path d={`M0 0 L0 ${-h}`} stroke={INK} stroke-width={2.4} stroke-linecap="round" />
      <path d={`M1 ${-h} L14 ${-h + 4} L1 ${-h + 9}Z`} fill={color} {...thin} />
    </g>
  );
}

function cloudShape(fill: string) {
  return blob(
    [
      [0, -10, 10],
      [-11, -6, 7],
      [11, -6, 7.5],
      [-4, -4, 7],
      [5, -3, 7],
    ],
    fill,
    '#ffffff',
  );
}

// ───────── prop & patch renderers ─────────

type Draw = (p: Palette, d: Decor, accent: string) => JSX.Element | null;

const DRAW: Record<string, Draw> = {
  tree: (p) => tree(p),
  bush: (p) => bush(p),
  rock: (p) => rock(p),
  house: (p) => house(p),
  haystack: () => (
    <g>
      <path d="M-12 0 Q-12 -18 0 -18 Q12 -18 12 0Z" fill="#e8c35a" {...o} />
      <path d="M-6 -3 Q-5 -11 0 -14 M2 -2 Q3 -10 7 -12" stroke="#b8902e" stroke-width={1.5} fill="none" />
    </g>
  ),
  fence: () => (
    <g>
      <path d="M-17 -6 L17 -6 M-17 -11 L17 -11" stroke={INK} stroke-width={4.2} stroke-linecap="round" />
      <path d="M-17 -6 L17 -6 M-17 -11 L17 -11" stroke="#c99a62" stroke-width={2} stroke-linecap="round" />
      {[-16, -5, 6, 16].map((x) => (
        <rect key={x} x={x - 2} y={-15} width={4} height={15} rx={1} fill="#a87a48" {...thin} />
      ))}
    </g>
  ),
  church: (p) => (
    <g>
      <ellipse cx={0} cy={0} rx={30} ry={6} fill="#000" opacity={0.18} />
      <rect x={-24} y={-26} width={30} height={26} fill={p.wall} {...o} />
      <path d="M-27 -25 L-9 -41 L9 -25Z" fill={p.roof} {...o} />
      <path d="M-14 0 L-14 -9 Q-9 -15 -4 -9 L-4 0Z" fill="#6b3f22" {...thin} />
      <rect x={4} y={-50} width={16} height={50} fill={p.wall} {...o} />
      <path d="M2 -49 L12 -74 L22 -49Z" fill={p.roof} {...o} />
      <circle cx={12} cy={-39} r={4} fill="#ffd36b" {...thin} />
      <circle cx={12} cy={-76} r={2.6} fill="#ffd36b" {...thin} />
      <rect x={-20} y={-20} width={5} height={7} rx={2.5} fill="#8ecae6" {...thin} />
      <rect x={9} y={-26} width={6} height={8} rx={3} fill="#8ecae6" {...thin} />
    </g>
  ),
  windmill: (p) => (
    <g>
      <ellipse cx={0} cy={0} rx={15} ry={4} fill="#000" opacity={0.18} />
      <path d="M-11 0 L-6.5 -36 L6.5 -36 L11 0Z" fill={p.wall} {...o} />
      <path d="M-8.5 -35 Q0 -47 8.5 -35Z" fill={p.roof} {...o} />
      <path d="M-3 0 L-3 -7 Q0 -10 3 -7 L3 0Z" fill="#6b3f22" {...thin} />
      <circle cx={0} cy={-20} r={2.6} fill="#8ecae6" {...thin} />
    </g>
  ),
  field: (p, d) => (
    <g transform={`rotate(${d.flip ? -14 : 12})`} opacity={0.9}>
      <rect x={-42} y={-24} width={84} height={48} rx={8} fill={d.x > MAP_W / 2 ? p.patch : p.patch2} stroke="rgba(0,0,0,.28)" stroke-width={2} />
      {[-14, -4, 6, 16].map((y) => (
        <path key={y} d={`M-36 ${y} L36 ${y}`} stroke="rgba(0,0,0,.14)" stroke-width={3} stroke-linecap="round" />
      ))}
    </g>
  ),
  pond: (p) => (
    <g>
      <ellipse cx={0} cy={0} rx={32} ry={16} fill="#4fc3f7" stroke="rgba(0,0,0,.35)" stroke-width={2.4} />
      <ellipse cx={-6} cy={-4} rx={14} ry={4} fill="#b3e5fc" opacity={0.7} />
      <circle cx={18} cy={4} r={3} fill={p.leaf} />
    </g>
  ),
  // dungeon
  slab: (p, d) => (
    <path
      transform={`rotate(${d.flip ? 20 : -10})`}
      d="M-40 -6 L-28 -24 L6 -28 L38 -14 L34 12 L-4 22 L-34 14Z"
      fill={p.patch}
      stroke="rgba(0,0,0,.35)"
      stroke-width={2}
      opacity={0.75}
    />
  ),
  pit: (p) => (
    <g>
      <ellipse cx={0} cy={0} rx={28} ry={13} fill={p.patch2} stroke="rgba(0,0,0,.5)" stroke-width={2.4} />
      <ellipse cx={0} cy={3} rx={18} ry={7} fill="#000" opacity={0.5} />
    </g>
  ),
  ruin: (p) => (
    <g>
      <ellipse cx={0} cy={0} rx={28} ry={5} fill="#000" opacity={0.22} />
      <g transform="translate(-16 0)">{column(p, 30)}</g>
      <g transform="translate(0 2)">{column(p, 16)}</g>
      <g transform="translate(16 0)">{column(p, 38, false)}</g>
      <rect x={8} y={-44} width={18} height={6} fill={p.stone} {...thin} />
      <path d="M-26 0 L-22 -4 L-18 0Z M20 2 L24 -3 L28 2Z" fill={p.stone} {...thin} />
    </g>
  ),
  arch: (p) => (
    <g>
      <ellipse cx={0} cy={0} rx={28} ry={5} fill="#000" opacity={0.22} />
      <path d="M-24 0 L-24 -26 Q-24 -46 0 -46 Q24 -46 24 -26 L24 0 L14 0 L14 -24 Q14 -36 0 -36 Q-14 -36 -14 -24 L-14 0Z" fill={p.stone} {...o} />
      <path d="M-24 -14 L-14 -14 M14 -14 L24 -14 M-19 -36 L-12 -31 M19 -36 L12 -31 M0 -46 L0 -36" stroke={INK} stroke-width={1.4} />
    </g>
  ),
  crystalBig: (_p, _d, accent) => crystals(accent, true),
  crystal: (_p, _d, accent) => crystals(accent, false),
  pillar: (p) => column(p, 22),
  skull: () => skull(),
  torch: () => (
    <g>
      <path d="M0 0 L0 -18" stroke={INK} stroke-width={3.4} stroke-linecap="round" />
      <path d="M0 0 L0 -18" stroke="#8d6e63" stroke-width={1.6} stroke-linecap="round" />
      <path d="M-4 -18 L4 -18 L3 -22 L-3 -22Z" fill="#5d4037" {...thin} />
    </g>
  ),
  // capital
  plaza: (p) => (
    <g opacity={0.8}>
      <circle cx={0} cy={0} r={40} fill={p.patch} stroke="rgba(0,0,0,.3)" stroke-width={2} />
      <circle cx={0} cy={0} r={26} fill="none" stroke="rgba(0,0,0,.14)" stroke-width={3} stroke-dasharray="5 4" />
      <circle cx={0} cy={0} r={12} fill="none" stroke="rgba(0,0,0,.14)" stroke-width={3} stroke-dasharray="4 4" />
    </g>
  ),
  scorch: (p) => (
    <path d="M-26 2 L-20 -10 L-8 -6 L-2 -16 L8 -8 L22 -12 L26 2 L14 12 L0 8 L-12 14Z" fill={p.patch2} opacity={0.55} />
  ),
  keep: (p) => (
    <g>
      <ellipse cx={0} cy={0} rx={18} ry={5} fill="#000" opacity={0.2} />
      <rect x={-12} y={-46} width={24} height={46} fill={p.stone} {...o} />
      <path d="M-14 -46 L-14 -52 L-9 -52 L-9 -48 L-3 -48 L-3 -52 L3 -52 L3 -48 L9 -48 L9 -52 L14 -52 L14 -46Z" fill={p.stone2} {...thin} />
      <path d="M-15 -52 L0 -74 L15 -52Z" fill={p.roof} {...o} />
      <path d="M0 -74 L0 -84" stroke={INK} stroke-width={2} />
      <path d="M1 -84 L11 -81 L1 -78Z" fill="#ffd36b" {...thin} />
      <rect x={-3} y={-34} width={6} height={9} rx={3} fill="#2b1f1a" {...thin} />
      <path d="M-4 0 L-4 -10 Q0 -14 4 -10 L4 0Z" fill="#5d3a22" {...thin} />
    </g>
  ),
  fountain: (p) => (
    <g>
      <ellipse cx={0} cy={-2} rx={24} ry={10} fill={p.stone} {...o} />
      <ellipse cx={0} cy={-4} rx={18} ry={6.5} fill="#4fc3f7" {...thin} />
      <rect x={-3} y={-20} width={6} height={16} fill={p.stone2} {...thin} />
      <ellipse cx={0} cy={-20} rx={8} ry={3} fill={p.stone} {...thin} />
      <path d="M0 -22 Q-8 -30 -12 -12 M0 -22 Q8 -30 12 -12" stroke="#b3e5fc" stroke-width={2} fill="none" stroke-linecap="round" />
    </g>
  ),
  banner: () => (
    <g>
      <path d="M0 0 L0 -30" stroke={INK} stroke-width={2.6} stroke-linecap="round" />
      <path d="M-8 -29 L8 -29" stroke={INK} stroke-width={2.4} stroke-linecap="round" />
      <path d="M-7 -28 L7 -28 L7 -10 L0 -14 L-7 -10Z" fill="#c62828" {...thin} />
      <circle cx={0} cy={-21} r={3} fill="#ffd36b" {...thin} />
    </g>
  ),
  fire: () => (
    <g>
      <path d="M-8 0 L8 -4 M-8 -4 L8 0" stroke={INK} stroke-width={4} stroke-linecap="round" />
      <path d="M-8 0 L8 -4 M-8 -4 L8 0" stroke="#6d4c41" stroke-width={2} stroke-linecap="round" />
    </g>
  ),
  crate: () => (
    <g>
      <rect x={-8} y={-15} width={16} height={15} fill="#c99a62" {...o} />
      <path d="M-8 -15 L8 0 M8 -15 L-8 0" stroke="#7a5230" stroke-width={1.6} />
    </g>
  ),
  // underwater
  sand: (p) => <ellipse cx={0} cy={0} rx={44} ry={20} fill={p.patch} opacity={0.55} />,
  trench: (p) => <ellipse cx={0} cy={0} rx={34} ry={14} fill={p.patch2} opacity={0.6} />,
  coralBig: () => (
    <g>
      <path d="M0 0 L0 -18 M0 -14 L-12 -28 M0 -18 L10 -34 M-12 -28 L-16 -38 M-8 -24 L-2 -36 M10 -34 L18 -40 M6 -27 L14 -26" stroke={INK} stroke-width={8.5} stroke-linecap="round" fill="none" />
      <path d="M0 0 L0 -18 M0 -14 L-12 -28 M0 -18 L10 -34 M-12 -28 L-16 -38 M-8 -24 L-2 -36 M10 -34 L18 -40 M6 -27 L14 -26" stroke="#ff7aa2" stroke-width={4.5} stroke-linecap="round" fill="none" />
      <path d="M-11 -27 L-14 -34 M10 -33 L15 -37" stroke="#ffd0dd" stroke-width={1.6} stroke-linecap="round" />
    </g>
  ),
  coral: () => (
    <g>
      <path d="M0 0 L0 -10 M0 -8 L-7 -16 M0 -10 L6 -18 M-4 -12 L-3 -20" stroke={INK} stroke-width={7} stroke-linecap="round" fill="none" />
      <path d="M0 0 L0 -10 M0 -8 L-7 -16 M0 -10 L6 -18 M-4 -12 L-3 -20" stroke="#ffab40" stroke-width={3.4} stroke-linecap="round" fill="none" />
    </g>
  ),
  seaweed: (p) => (
    <g>
      <path d="M-4 0 Q-9 -8 -4 -15 Q1 -22 -4 -30 M3 0 Q8 -7 3 -14 Q-1 -20 4 -24" stroke={INK} stroke-width={6} stroke-linecap="round" fill="none" />
      <path d="M-4 0 Q-9 -8 -4 -15 Q1 -22 -4 -30 M3 0 Q8 -7 3 -14 Q-1 -20 4 -24" stroke={p.leaf2} stroke-width={3} stroke-linecap="round" fill="none" />
    </g>
  ),
  shell: () => (
    <g>
      <path d="M0 0 L-9 -6 Q-8 -15 0 -16 Q8 -15 9 -6Z" fill="#ffccbc" {...thin} />
      <path d="M0 0 L-5 -13 M0 0 L0 -15 M0 0 L5 -13" stroke="#d48a78" stroke-width={1.2} />
    </g>
  ),
  column: (p) => column(p, 30),
  shipwreck: () => (
    <g transform="rotate(-8)">
      <ellipse cx={0} cy={2} rx={34} ry={6} fill="#000" opacity={0.25} />
      <path d="M-32 -14 L30 -18 L24 0 L-24 2Z" fill="#7a5230" {...o} />
      <path d="M-26 -8 L26 -10" stroke="#5a3a20" stroke-width={1.6} />
      <path d="M-2 -16 L4 -46" stroke={INK} stroke-width={4.4} stroke-linecap="round" />
      <path d="M-2 -16 L4 -46" stroke="#8d6e63" stroke-width={2.2} stroke-linecap="round" />
      <path d="M4 -42 L18 -36 L5 -30Z" fill="#cfd8dc" {...thin} opacity={0.85} />
      <circle cx={-18} cy={-9} r={2.6} fill="#2b1f1a" />
      <circle cx={-8} cy={-10} r={2.6} fill="#2b1f1a" />
    </g>
  ),
  // exam
  track: (p) => <ellipse cx={0} cy={0} rx={46} ry={22} fill="none" stroke={p.patch} stroke-width={9} opacity={0.75} />,
  sandpit: (p) => <ellipse cx={0} cy={0} rx={28} ry={13} fill={p.patch2} opacity={0.7} stroke="rgba(0,0,0,.2)" stroke-width={2} />,
  tent: () => (
    <g>
      <ellipse cx={0} cy={0} rx={22} ry={5} fill="#000" opacity={0.2} />
      <path d="M-20 0 L0 -30 L20 0Z" fill="#fff3e0" {...o} />
      <path d="M-13 0 L0 -30 L-6 0Z M0 0 L0 -30 L7 0Z" fill="#e53935" />
      <path d="M-20 0 L0 -30 L20 0Z" fill="none" {...o} />
      <path d="M-4 0 L0 -10 L4 0Z" fill="#3e2723" {...thin} />
      <path d="M0 -30 L0 -40" stroke={INK} stroke-width={2} />
      <path d="M1 -40 L10 -37 L1 -34Z" fill="#ffd36b" {...thin} />
    </g>
  ),
  stand: (p) => (
    <g>
      <ellipse cx={0} cy={0} rx={34} ry={5} fill="#000" opacity={0.2} />
      <path d="M-32 0 L-26 -26 L26 -26 L32 0Z" fill="#a1887f" {...o} />
      {[-20, -12, -4].map((y) => (
        <path key={y} d={`M${-30 + (y + 26) * 0.2} ${y} L${30 - (y + 26) * 0.2} ${y}`} stroke={INK} stroke-width={1.3} />
      ))}
      {[-22, -14, -6, 2, 10, 18].map((x, i) => (
        <circle key={x} cx={x} cy={-29 + (i % 2) * 2} r={3} fill={['#ffcc80', '#ef9a9a', '#90caf9', '#fff59d'][i % 4]} {...thin} />
      ))}
      <rect x={-30} y={-34} width={60} height={4} fill={p.roof} {...thin} />
    </g>
  ),
  dummy: () => (
    <g>
      <path d="M0 0 L0 -22 M-9 -15 L9 -15" stroke={INK} stroke-width={4} stroke-linecap="round" />
      <path d="M0 0 L0 -22 M-9 -15 L9 -15" stroke="#a87a48" stroke-width={2} stroke-linecap="round" />
      <circle cx={0} cy={-25} r={5} fill="#e8c35a" {...thin} />
      <path d="M-3 -26 L3 -24 M3 -26 L-3 -24" stroke={INK} stroke-width={1} />
    </g>
  ),
  flag: (p) => flag(p.roof),
  target: () => (
    <g>
      <path d="M-6 0 L0 -10 L6 0" stroke={INK} stroke-width={2.2} fill="none" />
      <circle cx={0} cy={-16} r={9} fill="#fff" {...thin} />
      <circle cx={0} cy={-16} r={6} fill="#e53935" />
      <circle cx={0} cy={-16} r={3} fill="#fff" />
      <circle cx={0} cy={-16} r={1.4} fill="#e53935" />
    </g>
  ),
  // elf
  meadow: (p) => (
    <g opacity={0.8}>
      <ellipse cx={0} cy={0} rx={42} ry={20} fill={p.patch} />
      {[
        [-20, -4],
        [-6, 6],
        [10, -8],
        [22, 4],
        [0, -12],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.2} fill={['#fff59d', '#f8bbd0', '#ffffff'][i % 3]} />
      ))}
    </g>
  ),
  bigTree: (p) => (
    <g>
      <ellipse cx={0} cy={0} rx={30} ry={6} fill="#000" opacity={0.22} />
      <path d="M-10 0 Q-6 -18 -7 -36 L7 -36 Q6 -18 10 0 L16 2 L4 1 L0 3 L-4 1 L-16 2Z" fill={p.trunk} {...o} />
      {blob(
        [
          [0, -58, 22],
          [-20, -44, 15],
          [20, -45, 15],
          [-10, -72, 13],
          [12, -70, 13],
        ],
        p.leaf,
        p.leaf2,
      )}
      <circle cx={-14} cy={-50} r={2.4} fill="#fff59d" />
      <circle cx={16} cy={-60} r={2.4} fill="#e1bee7" />
      <circle cx={2} cy={-76} r={2} fill="#fff59d" />
    </g>
  ),
  mushroom: () => (
    <g>
      <path d="M-3 0 L-2.4 -8 L2.4 -8 L3 0Z" fill="#fff3e0" {...thin} />
      <path d="M-9 -7 Q-9 -17 0 -17 Q9 -17 9 -7Z" fill="#e53935" {...thin} />
      <circle cx={-3.5} cy={-12} r={1.6} fill="#fff" />
      <circle cx={3} cy={-13.5} r={1.4} fill="#fff" />
    </g>
  ),
  flower: () => (
    <g>
      <path d="M0 0 L0 -8" stroke="#2e7d32" stroke-width={1.6} />
      {[0, 72, 144, 216, 288].map((a) => (
        <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 3} cy={-10 + Math.sin((a * Math.PI) / 180) * 3} r={2.4} fill="#f8bbd0" stroke={INK} stroke-width={0.8} />
      ))}
      <circle cx={0} cy={-10} r={1.8} fill="#fff59d" />
    </g>
  ),
  // spade
  mire: (p) => (
    <g opacity={0.85}>
      <ellipse cx={0} cy={0} rx={42} ry={18} fill={p.patch} />
      <circle cx={-12} cy={-2} r={3} fill="none" stroke={p.patch2} stroke-width={1.2} opacity={0.6} />
      <circle cx={14} cy={4} r={2.4} fill="none" stroke={p.patch2} stroke-width={1.2} opacity={0.6} />
    </g>
  ),
  crack: (p) => (
    <g>
      <path d="M-28 -6 L-14 2 L-6 -8 L6 4 L14 -4 L28 6 M-6 -8 L-4 -16 M6 4 L10 12" stroke={INK} stroke-width={4.4} fill="none" stroke-linecap="round" />
      <path d="M-28 -6 L-14 2 L-6 -8 L6 4 L14 -4 L28 6 M-6 -8 L-4 -16 M6 4 L10 12" stroke={p.patch2} stroke-width={1.6} fill="none" stroke-linecap="round" />
    </g>
  ),
  spire: (p) => (
    <g>
      <ellipse cx={0} cy={0} rx={18} ry={5} fill="#000" opacity={0.3} />
      <path d="M-11 0 L-9 -58 L9 -58 L11 0Z" fill={p.wall} {...o} />
      <path d="M-13 -57 L0 -92 L13 -57Z" fill={p.roof} {...o} />
      <path d="M-13 -57 L-18 -50 M13 -57 L18 -50" stroke={INK} stroke-width={2.4} stroke-linecap="round" />
      <rect x={-3} y={-48} width={6} height={9} rx={3} fill="#b388ff" {...thin} />
      <rect x={-3} y={-28} width={6} height={9} rx={3} fill="#b388ff" {...thin} />
      <path d="M-4 0 L-4 -9 Q0 -13 4 -9 L4 0Z" fill="#120d1c" {...thin} />
    </g>
  ),
  deadTree: (p) => (
    <g>
      <path d="M0 0 L0 -20 L-9 -30 M0 -20 L7 -32 L12 -36 M7 -32 L4 -40 M-9 -30 L-14 -33 M0 -12 L6 -18" stroke={INK} stroke-width={5} stroke-linecap="round" fill="none" />
      <path d="M0 0 L0 -20 L-9 -30 M0 -20 L7 -32 L12 -36 M7 -32 L4 -40 M-9 -30 L-14 -33 M0 -12 L6 -18" stroke={p.leaf2} stroke-width={2} stroke-linecap="round" fill="none" />
    </g>
  ),
  grave: (p) => (
    <g>
      <path d="M-6 0 L-6 -11 Q-6 -17 0 -17 Q6 -17 6 -11 L6 0Z" fill={p.stone2} {...thin} />
      <path d="M0 -14 Q-3 -10 0 -8 Q3 -10 0 -14Z M0 -8 L0 -5" stroke={INK} stroke-width={1.1} fill={INK} />
    </g>
  ),
  spike: (p) => (
    <g>
      <path d="M-10 0 L-6 -16 L-2 0Z M-3 0 L1 -22 L5 0Z M4 0 L8 -12 L11 0Z" fill={p.stone2} {...thin} />
    </g>
  ),
  // underworld
  lava: (p) => (
    <g>
      <path d="M-44 0 Q-36 -18 -12 -14 Q4 -24 24 -14 Q46 -10 40 4 Q30 18 4 14 Q-20 22 -36 12Z" fill="#2b0d08" />
      <path d="M-38 1 Q-30 -12 -12 -9 Q4 -18 22 -9 Q38 -6 34 3 Q26 13 4 10 Q-18 16 -31 9Z" fill={p.patch} />
      <path d="M-20 0 Q-8 -8 6 -3 Q18 -2 22 2" stroke="#ffd54f" stroke-width={3} fill="none" stroke-linecap="round" />
    </g>
  ),
  spikeRock: (p) => (
    <g>
      <ellipse cx={0} cy={0} rx={22} ry={5} fill="#000" opacity={0.3} />
      <path d="M-20 0 L-14 -20 L-8 -10 L-2 -36 L5 -14 L11 -26 L20 0Z" fill={p.stone} {...o} />
      <path d="M-2 -36 L0 -20 M11 -26 L10 -14" stroke="#ff7043" stroke-width={1.6} stroke-linecap="round" />
    </g>
  ),
  bonePile: () => (
    <g>
      <path d="M-16 0 L10 -8 M-12 -8 L14 0 M-4 -14 L6 2" stroke={INK} stroke-width={5.4} stroke-linecap="round" />
      <path d="M-16 0 L10 -8 M-12 -8 L14 0 M-4 -14 L6 2" stroke="#efe6d8" stroke-width={2.6} stroke-linecap="round" />
      <g transform="translate(-14 -2) scale(.8)">{skull()}</g>
    </g>
  ),
  bones: () => (
    <g>
      <path d="M-10 -2 L10 -6 M-8 -8 L8 0" stroke={INK} stroke-width={4.6} stroke-linecap="round" />
      <path d="M-10 -2 L10 -6 M-8 -8 L8 0" stroke="#efe6d8" stroke-width={2.2} stroke-linecap="round" />
    </g>
  ),
  // paladin
  cloudBank: () => (
    <g opacity={0.7}>
      {cloudShape('#ffffff')}
      <g transform="translate(26 8) scale(.8)">{cloudShape('#ffffff')}</g>
    </g>
  ),
  halo: (p) => <ellipse cx={0} cy={0} rx={30} ry={11} fill="none" stroke={p.patch2} stroke-width={4} opacity={0.75} />,
  island: (p) => (
    <g>
      <path d="M-30 -10 Q-22 26 -2 34 Q2 22 10 26 Q22 6 30 -10Z" fill={p.trunk} {...o} />
      <ellipse cx={0} cy={-10} rx={31} ry={10} fill={p.leaf} {...o} />
      <ellipse cx={-6} cy={-13} rx={16} ry={4} fill={p.leaf2} opacity={0.8} />
      <g transform="translate(14 -10) scale(.7)">{tree(p)}</g>
      <g transform="translate(-14 -8) scale(.7)">{rock(p)}</g>
    </g>
  ),
  pillarGold: () => (
    <g>
      <rect x={-7} y={-4} width={14} height={4} fill="#ffb300" {...thin} />
      <rect x={-5} y={-30} width={10} height={26} fill="#ffe082" {...thin} />
      <rect x={-7} y={-34} width={14} height={4} fill="#ffb300" {...thin} />
      <ellipse cx={0} cy={-42} rx={8} ry={3} fill="none" stroke="#fff59d" stroke-width={2.2} />
      <path d="M-2 -28 L-2 -6" stroke="#fff8e1" stroke-width={1.6} />
    </g>
  ),
  cloud: () => cloudShape('#ffffff'),
  sparkle: () => <path d="M0 -14 L2 -8 L8 -6 L2 -4 L0 2 L-2 -4 L-8 -6 L-2 -8Z" fill="#fff59d" {...thin} />,

  // ───────── lairs (drawn behind the boss node; local (0,-34) is the node centre) ─────────
  tower: (p) => (
    <g>
      <ellipse cx={0} cy={0} rx={44} ry={8} fill="#000" opacity={0.2} />
      <path d="M-22 0 L-17 -108 L17 -108 L22 0Z" fill={p.stone} {...o} />
      <path d="M-10 -10 L-8 -100" stroke={p.stone2} stroke-width={3} stroke-linecap="round" opacity={0.8} />
      <path d="M-21 -108 L-21 -116 L-13 -116 L-13 -111 L-5 -111 L-5 -116 L5 -116 L5 -111 L13 -111 L13 -116 L21 -116 L21 -108Z" fill={p.stone2} {...o} />
      <rect x={-5} y={-92} width={10} height={14} rx={5} fill="#3b2a1a" {...thin} />
      <rect x={-4} y={-66} width={8} height={11} rx={4} fill="#ffd36b" {...thin} />
      {[
        [-36, -86, -14],
        [34, -96, 16],
        [-30, -54, 8],
        [36, -60, -10],
      ].map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <rect x={-6} y={-8} width={12} height={16} rx={2} fill={['#2e7d32', '#6d4c41', '#1565c0', '#8e24aa'][i]} {...thin} />
          <rect x={-4} y={-6} width={8} height={12} fill="none" stroke="#ffd36b" stroke-width={1} />
        </g>
      ))}
    </g>
  ),
  dungeon: (p, _d, accent) => (
    <g>
      <path d="M-86 2 Q-80 -60 -40 -96 Q0 -122 40 -96 Q80 -60 86 2Z" fill={p.stone} {...o} />
      <path d="M-60 -40 Q-50 -70 -24 -88 M50 -30 Q56 -58 34 -84" stroke={p.stone2} stroke-width={3} fill="none" stroke-linecap="round" opacity={0.7} />
      <path d="M-30 2 L-30 -46 Q-30 -76 0 -76 Q30 -76 30 -46 L30 2Z" fill="#100c1a" {...o} />
      {[-38, -26, 26, 38].map((x, i) => (
        <path key={x} d={`M${x} ${-30 - i * 6} l3 -6 l3 6 l-3 6Z`} fill={accent} opacity={0.9} />
      ))}
      <path d="M-14 -82 l4 -6 l4 6 l-4 6Z M10 -82 l4 -6 l4 6 l-4 6Z" fill={accent} />
      <g transform="translate(-62 0) scale(1.2)">{crystals(accent, false)}</g>
      <g transform="translate(64 2) scale(1.4)">{crystals(accent, false)}</g>
    </g>
  ),
  castle: (p) => (
    <g>
      <ellipse cx={0} cy={2} rx={92} ry={9} fill="#000" opacity={0.2} />
      <rect x={-72} y={-62} width={144} height={62} fill={p.stone} {...o} />
      <path
        d="M-72 -62 L-72 -70 L-62 -70 L-62 -64 L-50 -64 L-50 -70 L-38 -70 L-38 -64 L-26 -64 L-26 -70 L26 -70 L26 -64 L38 -64 L38 -70 L50 -70 L50 -64 L62 -64 L62 -70 L72 -70 L72 -62Z"
        fill={p.stone2}
        {...o}
      />
      <path d="M-30 2 L-30 -52 Q-30 -82 0 -82 Q30 -82 30 -52 L30 2Z" fill="#2b1f1a" {...o} />
      {[-1, 1].map((sd) => (
        <g key={sd} transform={`translate(${sd * 74} 0)`}>
          <rect x={-16} y={-90} width={32} height={90} fill={p.stone} {...o} />
          <path d="M-19 -90 L0 -122 L19 -90Z" fill={p.roof} {...o} />
          <path d="M0 -122 L0 -134" stroke={INK} stroke-width={2} />
          <path d="M1 -134 L13 -130 L1 -126Z" fill="#ffd36b" {...thin} />
          <rect x={-4} y={-72} width={8} height={12} rx={4} fill="#2b1f1a" {...thin} />
        </g>
      ))}
      {[-48, 48].map((x) => (
        <g key={x}>
          <path d={`M${x - 9} -60 L${x + 9} -60 L${x + 9} -30 L${x} -36 L${x - 9} -30Z`} fill="#c62828" {...thin} />
          <circle cx={x} cy={-48} r={4} fill="#ffd36b" {...thin} />
        </g>
      ))}
    </g>
  ),
  temple: (p) => (
    <g>
      <ellipse cx={0} cy={2} rx={84} ry={9} fill="#000" opacity={0.22} />
      <path d="M-80 2 L-74 -8 L74 -8 L80 2Z" fill={p.stone} {...o} />
      <path d="M-72 -8 L-68 -16 L68 -16 L72 -8Z" fill={p.stone2} {...o} />
      {[-58, -36, 36, 58].map((x) => (
        <g key={x}>
          <rect x={x - 7} y={-84} width={14} height={68} fill={p.wall} {...o} />
          <path d={`M${x - 2} -80 L${x - 2} -20 M${x + 2} -80 L${x + 2} -20`} stroke={p.stone} stroke-width={1.2} />
        </g>
      ))}
      <rect x={-26} y={-84} width={52} height={68} fill="#06265a" {...o} />
      <path d="M-70 -84 L70 -84 L70 -94 L-70 -94Z" fill={p.wall} {...o} />
      <path d="M-76 -94 L0 -128 L76 -94Z" fill={p.wall} {...o} />
      <circle cx={0} cy={-108} r={8} fill="#4fc3f7" {...thin} />
      <path d="M-58 -84 Q-62 -60 -52 -40" stroke="#2e9e6a" stroke-width={3} fill="none" stroke-linecap="round" />
      <path d="M58 -84 Q64 -64 54 -46" stroke="#2e9e6a" stroke-width={3} fill="none" stroke-linecap="round" />
    </g>
  ),
  arena: (p) => (
    <g>
      <ellipse cx={0} cy={-30} rx={96} ry={62} fill={p.stone} {...o} />
      <ellipse cx={0} cy={-32} rx={82} ry={50} fill="#a1887f" {...o} />
      {[0.9, 0.8, 0.7].map((k) => (
        <ellipse key={k} cx={0} cy={-32} rx={82 * k} ry={50 * k} fill="none" stroke={INK} stroke-width={1.1} opacity={0.6} />
      ))}
      <ellipse cx={0} cy={-34} rx={54} ry={30} fill="#ffe0b2" {...o} />
      <ellipse cx={0} cy={-34} rx={30} ry={14} fill="none" stroke="#e6b980" stroke-width={2.4} />
      {Array.from({ length: 13 }, (_, i) => {
        const a = Math.PI * (0.08 + (0.84 * i) / 12);
        const x = Math.cos(a) * 89;
        const y = -30 + Math.sin(a) * 56;
        return <rect key={i} x={x - 3.5} y={y - 4} width={7} height={8} rx={3.5} fill="#5d4037" {...thin} />;
      })}
      {[-70, -36, 0, 36, 70].map((x, i) => (
        <g key={x} transform={`translate(${x} ${-30 - Math.sqrt(Math.max(0, 1 - (x / 96) ** 2)) * 62})`}>{flag(['#e53935', '#ffb300', '#1e88e5', '#ffb300', '#e53935'][i], 18)}</g>
      ))}
    </g>
  ),
  worldTree: (p) => (
    <g>
      <ellipse cx={0} cy={2} rx={70} ry={10} fill="#000" opacity={0.25} />
      <path d="M-26 2 Q-18 -40 -20 -80 L20 -80 Q18 -40 26 2 L46 6 L18 0 L0 8 L-18 0 L-46 6Z" fill={p.trunk} {...o} />
      <path d="M-10 -10 Q-6 -40 -10 -70" stroke="#8d6e63" stroke-width={3} fill="none" opacity={0.7} />
      {blob(
        [
          [0, -118, 40],
          [-46, -96, 28],
          [46, -98, 28],
          [-30, -138, 26],
          [32, -140, 26],
          [0, -150, 22],
        ],
        p.leaf,
        p.leaf2,
      )}
      {[
        [-40, -110],
        [30, -124],
        [-8, -142],
        [50, -92],
        [-56, -90],
        [10, -100],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3.2} fill={i % 2 ? '#fff59d' : '#e1bee7'} stroke={INK} stroke-width={1} />
      ))}
    </g>
  ),
  darkCastle: (p) => (
    <g>
      <ellipse cx={0} cy={2} rx={90} ry={9} fill="#000" opacity={0.35} />
      <rect x={-70} y={-56} width={140} height={56} fill={p.wall} {...o} />
      {[-58, 58].map((x) => (
        <g key={x} transform={`translate(${x} 0)`}>
          <path d="M-14 0 L-12 -92 L12 -92 L14 0Z" fill={p.wall} {...o} />
          <path d="M-16 -91 L0 -136 L16 -91Z" fill={p.roof} {...o} />
          <rect x={-3} y={-76} width={6} height={10} rx={3} fill="#b388ff" {...thin} />
        </g>
      ))}
      <path d="M-20 -54 L-18 -110 L18 -110 L20 -54Z" fill={p.wall} {...o} />
      <path d="M-23 -109 L0 -158 L23 -109Z" fill={p.roof} {...o} />
      <path d="M0 -146 Q-6 -138 0 -133 Q6 -138 0 -146Z" fill="#b388ff" />
      <path d="M-28 2 L-28 -40 Q-28 -66 0 -66 Q28 -66 28 -40 L28 2Z" fill="#120d1c" {...o} />
      <path d="M-28 -40 Q-28 -66 0 -66 Q28 -66 28 -40" fill="none" stroke="#b388ff" stroke-width={2} opacity={0.8} />
    </g>
  ),
  hellGate: (p) => (
    <g>
      <ellipse cx={0} cy={2} rx={92} ry={10} fill="#ff3d00" opacity={0.25} />
      {[-1, 1].map((sd) => (
        <g key={sd} transform={`translate(${sd * 58} 0)`}>
          <path d="M-16 2 L-13 -112 L13 -112 L16 2Z" fill={p.stone} {...o} />
          <path d={`M${-sd * 4} -112 Q${sd * 18} -130 ${sd * 30} -150 Q${sd * 8} -134 ${sd * -10} -112Z`} fill="#efe6d8" {...o} />
          <path d="M-8 -90 L8 -90 M-8 -60 L8 -60 M-8 -30 L8 -30" stroke={INK} stroke-width={1.4} />
        </g>
      ))}
      <path d="M-44 2 L-44 -84 Q-44 -126 0 -126 Q44 -126 44 -84 L44 2Z" fill="#3a0703" {...o} />
      <path d="M0 -122 L0 2" stroke={INK} stroke-width={2.4} />
      <ellipse cx={0} cy={-98} rx={22} ry={11} fill="#ffd54f" {...o} />
      <ellipse cx={0} cy={-98} rx={4} ry={10} fill={INK} />
      <path d="M-44 -70 Q-30 -60 -44 -50 M44 -70 Q30 -60 44 -50" stroke="#757575" stroke-width={3} fill="none" />
    </g>
  ),
  throne: () => (
    <g>
      <circle cx={0} cy={-56} r={64} fill="#fffde7" opacity={0.55} />
      <circle cx={0} cy={-56} r={58} fill="none" stroke="#ffb300" stroke-width={6} />
      <circle cx={0} cy={-56} r={58} fill="none" stroke={INK} stroke-width={1.6} />
      <circle cx={0} cy={-56} r={64} fill="none" stroke={INK} stroke-width={1.6} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <path key={i} d={`M${Math.cos(a) * 70} ${-56 + Math.sin(a) * 70} L${Math.cos(a) * 84} ${-56 + Math.sin(a) * 84}`} stroke="#ffb300" stroke-width={4} stroke-linecap="round" />;
      })}
      <path d="M-50 2 L-42 -10 L42 -10 L50 2Z" fill="#fffdf5" {...o} />
      <path d="M-38 -10 L-32 -20 L32 -20 L38 -10Z" fill="#fff8e1" {...o} />
      <path d="M-26 -20 L-26 -74 Q0 -96 26 -74 L26 -20Z" fill="#ffe082" {...o} />
      <path d="M-18 -24 L-18 -68 Q0 -82 18 -68 L18 -24Z" fill="#ffb300" {...thin} />
    </g>
  ),
};

/** Animated bits for a prop (anchor offsets in local units before scale). */
const PROP_FX: Record<string, { fx: string; dx: number; dy: number; size: number }[]> = {
  windmill: [{ fx: 'blades', dx: 0, dy: -36, size: 50 }],
  torch: [{ fx: 'flame', dx: 0, dy: -24, size: 12 }],
  fire: [{ fx: 'flame', dx: 0, dy: -7, size: 18 }, { fx: 'smoke', dx: 0, dy: -26, size: 18 }],
  crystalBig: [{ fx: 'glint', dx: 0, dy: -30, size: 14 }],
  fountain: [{ fx: 'glint', dx: 0, dy: -24, size: 10 }],
  pillarGold: [{ fx: 'glint', dx: 0, dy: -42, size: 12 }],
  sparkle: [{ fx: 'glint', dx: 0, dy: -8, size: 12 }],
};

/** Ambient fx per theme scattered over the region. */
const AMBIENT: { fx: string; count: number; size: [number, number] }[] = [
  { fx: 'bird', count: 2, size: [14, 18] },
  { fx: 'glint', count: 5, size: [8, 12] },
  { fx: 'smoke', count: 3, size: [16, 24] },
  { fx: 'bubble', count: 9, size: [6, 12] },
  { fx: 'pennant', count: 0, size: [10, 12] },
  { fx: 'mote', count: 9, size: [5, 8] },
  { fx: 'mist', count: 3, size: [120, 170] },
  { fx: 'ember', count: 10, size: [4, 7] },
  { fx: 'drift', count: 3, size: [60, 90] },
];

export interface FxItem {
  fx: string;
  x: number;
  y: number;
  size: number;
  delay: number;
}

const fxCache = new Map<number, FxItem[]>();

export function regionFx(chapter: number): FxItem[] {
  const hit = fxCache.get(chapter);
  if (hit) return hit;
  const L = regionLayout(chapter);
  const r = rng(chapter * 131 + 7);
  const out: FxItem[] = [];
  for (const d of L.decor) {
    for (const f of PROP_FX[d.kind] ?? []) {
      out.push({ fx: f.fx, x: d.x + f.dx * d.s * (d.flip ? -1 : 1), y: d.y + f.dy * d.s, size: f.size * d.s, delay: r() * 3 });
    }
  }
  const amb = AMBIENT[L.theme];
  for (let i = 0; i < amb.count; i++) {
    out.push({
      fx: amb.fx,
      x: 20 + r() * (MAP_W - 40),
      y: 60 + ((REGION_H - 220) * (i + r())) / amb.count,
      size: amb.size[0] + r() * (amb.size[1] - amb.size[0]),
      delay: r() * 6,
    });
  }
  fxCache.set(chapter, out);
  return out;
}

// ───────── region SVG ─────────

function zigzag(seed: number): string {
  const r = rng(seed);
  let d = 'M0 0';
  for (let x = 0; x <= MAP_W; x += 12) d += ` L${x} ${(2 + r() * 7).toFixed(1)}`;
  return d + ` L${MAP_W} 0Z`;
}

interface RegionArtProps {
  chapter: number;
  /** Road pieces reached so far in this region (0-11). */
  reached: number;
  /** Fade the top of the region into fog (last revealed region). */
  foggy: boolean;
}

export const RegionArt = memo(function RegionArt({ chapter, reached, foggy }: RegionArtProps) {
  const L: RegionLayout = regionLayout(chapter);
  const p = PALETTES[L.theme];
  const ch = CHAPTERS[L.theme];
  const accent = ch.accent;
  const id = `cm${chapter}`;
  const [patches, lair, props] = [L.decor.filter((d) => d.patch), L.decor.find((d) => !d.patch)!, L.decor.filter((d) => !d.patch).slice(1)];
  const draw = (d: Decor, key: string | number) => {
    const fn = DRAW[d.kind];
    if (!fn) return null;
    const sx = d.flip && !d.patch ? -d.s : d.s;
    return (
      <g key={key} transform={`translate(${d.x} ${d.y}) scale(${sx} ${d.s})`}>
        {fn(p, d, accent)}
      </g>
    );
  };
  const exitIdx = L.segs.length - 1;
  const roadUnder = L.segs.slice(exitIdx);
  const roadOver = L.segs.slice(0, exitIdx);
  const road = (segs: string[], offset: number) => (
    <g>
      {segs.map((d, i) => (
        <path key={`o${i}`} d={d} fill="none" stroke={INK} stroke-width={17} stroke-linecap="round" />
      ))}
      {segs.map((d, i) => (
        <path key={`f${i}`} d={d} fill="none" stroke={i + offset < reached ? p.road : p.roadDim} stroke-width={11} stroke-linecap="round" />
      ))}
      {segs.map((d, i) =>
        i + offset < reached ? <path key={`c${i}`} d={d} fill="none" stroke={accent} stroke-width={2.6} stroke-dasharray="2 9" stroke-linecap="round" opacity={0.95} /> : null,
      )}
    </g>
  );
  return (
    <svg class="cmap-art" viewBox={`0 0 ${MAP_W} ${REGION_H}`} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stop-color={p.base[0]} />
          <stop offset="1" stop-color={p.base[1]} />
        </linearGradient>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color={ch.sky[0]} stop-opacity={0.55} />
          <stop offset="0.35" stop-color={ch.sky[1]} stop-opacity={0} />
        </linearGradient>
        {foggy && (
          <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#cbc3e3" stop-opacity={1} />
            <stop offset="0.45" stop-color="#cbc3e3" stop-opacity={0.75} />
            <stop offset="0.75" stop-color="#cbc3e3" stop-opacity={0} />
          </linearGradient>
        )}
      </defs>
      <rect width={MAP_W} height={REGION_H} fill={`url(#${id}g)`} />
      <rect width={MAP_W} height={REGION_H} fill={`url(#${id}s)`} />
      {L.theme === 3 && (
        <g opacity={0.16} fill="#ffffff">
          <path d="M40 0 L90 0 L170 700 L110 700Z" />
          <path d="M200 0 L240 0 L300 560 L250 560Z" />
          <path d="M300 0 L330 0 L360 300 L340 300Z" />
        </g>
      )}
      {L.theme === 8 && (
        <g opacity={0.3} fill="#ffffff">
          <path d="M180 -10 L120 1000 L150 1000Z" />
          <path d="M180 -10 L250 1000 L290 1000Z" />
          <path d="M180 -10 L20 900 L60 900Z" />
        </g>
      )}
      {L.theme === 7 && <rect width={MAP_W} height={REGION_H} fill="#ff3d00" opacity={0.07} />}
      {patches.map((d, i) => draw(d, `p${i}`))}
      {road(roadUnder, exitIdx)}
      {draw(lair, 'lair')}
      {road(roadOver, 0)}
      {props.map((d, i) => draw(d, i))}
      {L.loop > 0 && (
        <g>
          <defs>
            <radialGradient id={`${id}v`} cx="0.5" cy="0.5" r="0.75">
              <stop offset="0.45" stop-color="#2a0050" stop-opacity={0} />
              <stop offset="1" stop-color="#2a0050" stop-opacity={0.75} />
            </radialGradient>
          </defs>
          <rect width={MAP_W} height={REGION_H} fill="#1d0638" opacity={0.34} />
          <rect width={MAP_W} height={REGION_H} fill={`url(#${id}v)`} />
          {[0, 1, 2].map((i) => {
            const r = rng(chapter * 17 + i);
            const x = 30 + r() * 300;
            const y = 120 + r() * 700;
            const d = `M${x} ${y} l${8 + r() * 10} ${12 + r() * 8} l${-6 - r() * 6} ${10 + r() * 10} l${10 + r() * 10} ${12 + r() * 6}`;
            return (
              <g key={i}>
                <path d={d} stroke={INK} stroke-width={5} fill="none" stroke-linecap="round" />
                <path d={d} stroke="#d500f9" stroke-width={2} fill="none" stroke-linecap="round" />
              </g>
            );
          })}
        </g>
      )}
      {foggy && <rect width={MAP_W} height={REGION_H} fill={`url(#${id}f)`} />}
      <path d={zigzag(chapter + 5)} fill={INK} />
    </svg>
  );
});

/** Top of the map: thick cloud cover over everything not revealed yet. */
export const FogArt = memo(function FogArt({ seed }: { seed: number }) {
  const r = rng(seed * 7 + 3);
  const puffs = Array.from({ length: 16 }, () => ({ x: r() * MAP_W, y: 40 + r() * 340, s: 1.4 + r() * 1.8 }));
  return (
    <svg class="cmap-art" viewBox="0 0 360 430" aria-hidden="true">
      <defs>
        <linearGradient id="cmfog" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#8f86ad" />
          <stop offset="1" stop-color="#cbc3e3" />
        </linearGradient>
      </defs>
      <rect width={360} height={430} fill="url(#cmfog)" />
      {puffs.map((pf, i) => (
        <g key={i} transform={`translate(${pf.x} ${pf.y}) scale(${pf.s})`} opacity={0.75}>
          {blob(
            [
              [0, -10, 10],
              [-11, -6, 7],
              [11, -6, 7.5],
            ],
            i % 3 ? '#e9e4f5' : '#d8d1ec',
          )}
        </g>
      ))}
    </svg>
  );
});

/** Small closed/open chest icon used on banners and in the chest popup. */
export function ChestIcon({ tier, open, size = 34 }: { tier: number; open?: boolean; size?: number }) {
  const body = ['#c07a3a', '#9fb3c8', '#ffc531'][tier] ?? '#c07a3a';
  const band = ['#7a4a1e', '#5d7389', '#c98a00'][tier] ?? '#7a4a1e';
  return (
    <svg viewBox="0 0 40 36" width={size} height={size * 0.9} class="cmap-chest-ico" aria-hidden="true">
      {open ? (
        <>
          {/* lid flipped up behind the box: we see its darker inside face */}
          <path d="M5 15 L35 15 L32 2 L8 2Z" fill={band} stroke={INK} stroke-width={2.4} stroke-linejoin="round" />
          <path d="M10 5.5 L30 5.5" stroke="#fff" stroke-opacity={0.3} stroke-width={2} stroke-linecap="round" />
          <ellipse cx={20} cy={15.5} rx={13} ry={3.6} fill="#fff3b0" stroke={INK} stroke-width={1.6} />
        </>
      ) : (
        <path d="M4 16 Q4 4 20 4 Q36 4 36 16Z" fill={body} stroke={INK} stroke-width={2.4} stroke-linejoin="round" />
      )}
      <rect x={4} y={15} width={32} height={18} rx={2} fill={body} stroke={INK} stroke-width={2.4} stroke-linejoin="round" />
      <path d="M4 21 L36 21" stroke={band} stroke-width={3} />
      <rect x={16.5} y={13} width={7} height={9} rx={1.5} fill="#ffe082" stroke={INK} stroke-width={1.8} />
      <path d="M8 8 Q12 6 14 6" stroke="#fff" stroke-opacity={0.5} stroke-width={2} stroke-linecap="round" fill="none" />
    </svg>
  );
}
