// Static backdrop of the hideout base map (sky, hills, river, roads, trees, town wall).
// It never animates, so the browser paints it once; moving bits live in HTML layers.
import { memo } from 'preact/compat';
import { MAP_W } from './layout';

const INK = '#0b0710';

const STARS = [
  [22, 40], [60, 22], [98, 58], [132, 30], [170, 14], [214, 46], [250, 22], [292, 52], [318, 18], [380, 46],
  [40, 120], [118, 102], [186, 96], [268, 110], [390, 130], [12, 186], [150, 170], [236, 160], [300, 196],
];

type TreeKind = 'pine' | 'round' | 'bush';
const BASE_TREES: [number, number, TreeKind][] = [
  [16, 472, 'pine'], [388, 480, 'round'], [22, 566, 'round'], [380, 572, 'pine'], [18, 664, 'pine'], [386, 650, 'round'],
  [160, 652, 'bush'], [252, 662, 'bush'], [20, 812, 'round'], [386, 812, 'pine'], [132, 806, 'bush'], [266, 812, 'bush'],
  [16, 962, 'pine'], [388, 966, 'round'], [140, 964, 'bush'], [262, 966, 'bush'], [22, 1110, 'round'], [380, 1108, 'pine'],
];

function Tree({ x, y, kind }: { x: number; y: number; kind: TreeKind }) {
  if (kind === 'pine')
    return (
      <g>
        <rect x={x - 3} y={y - 10} width="6" height="10" fill="#5a3418" />
        <path d={`M${x} ${y - 52} L${x + 15} ${y - 26} L${x + 8} ${y - 26} L${x + 19} ${y - 9} L${x - 19} ${y - 9} L${x - 8} ${y - 26} L${x - 15} ${y - 26}Z`} fill="#2f6b3a" />
      </g>
    );
  if (kind === 'round')
    return (
      <g>
        <rect x={x - 3} y={y - 14} width="6" height="14" fill="#5a3418" />
        <circle cx={x} cy={y - 30} r="17" fill="#3f8a45" />
        <path d={`M${x - 8} ${y - 36} a8 8 0 0 1 9 -6`} fill="none" stroke="#7ccf6e" stroke-width="2.2" />
      </g>
    );
  return <path d={`M${x - 18} ${y} a9 9 0 0 1 6 -14 a10 10 0 0 1 18 -2 a9 9 0 0 1 12 16Z`} fill="#4d9a49" />;
}

export const LAMPS: [number, number][] = [
  [174, 516],
  [228, 694],
  [172, 846],
  [228, 996],
];

export const Backdrop = memo(function Backdrop({ height, gateY, spurs, top = 0 }: { height: number; gateY: number; spurs: string; top?: number }) {
  const H = height;
  const trees = [...BASE_TREES];
  for (let y = 1260; y < gateY - 70; y += 150) trees.push([18, y, 'round'], [384, y + 20, 'pine']);
  const spurList = spurs
    ? spurs.split(';').map((p) => {
        const [x, y] = p.split(',').map(Number);
        return { x, y };
      })
    : [];
  const road = `M236 446 C236 490 200 500 204 560 C206 590 200 610 200 640 C200 700 190 730 196 790 C200 860 206 900 200 960 L200 ${gateY - 8}`;
  return (
    <svg class="hub-backdrop" viewBox={`0 ${top} ${MAP_W} ${H - top}`} preserveAspectRatio="xMidYMin slice" aria-hidden="true">
      <defs>
        <linearGradient id="hub-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#170f33" />
          <stop offset="0.45" stop-color="#3b2160" />
          <stop offset="0.8" stop-color="#b24c86" />
          <stop offset="1" stop-color="#ff9e6b" />
        </linearGradient>
        <linearGradient id="hub-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#5d8f3c" />
          <stop offset="0.5" stop-color="#477530" />
          <stop offset="1" stop-color="#2f4f20" />
        </linearGradient>
        <pattern id="hub-dots" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.1" fill="rgba(255,255,255,.07)" />
        </pattern>
      </defs>
      <rect width={MAP_W} height="500" fill="url(#hub-sky)" />
      <g fill="#fff">
        {STARS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 ? 1.1 : 1.7} opacity={i % 2 ? 0.55 : 0.85} />
        ))}
      </g>
      <circle cx="292" cy="128" r="48" fill="#fff3c4" opacity="0.12" />
      <circle cx="292" cy="128" r="30" fill="#fff3c4" />
      <circle cx="282" cy="120" r="5" fill="#f1dfa2" />
      <circle cx="302" cy="138" r="4" fill="#f1dfa2" />
      <g stroke={INK} stroke-width="2.6" stroke-linejoin="round">
        <path d="M0 384 L48 334 L92 364 L150 300 L204 352 L258 312 L318 356 L370 322 L400 342 L400 500 L0 500Z" fill="#3a2557" />
        <path d="M0 426 Q60 388 120 410 T240 400 T400 414 L400 500 L0 500Z" fill="#4a2d6b" />
        <path d={`M0 472 C60 452 120 438 200 436 C280 434 340 448 400 460 L400 ${H} L0 ${H}Z`} fill="url(#hub-grass)" stroke-width="3" />
      </g>
      <rect y="436" width={MAP_W} height={H - 436} fill="url(#hub-dots)" />
      <g fill="#6aa046" opacity="0.45">
        <ellipse cx="90" cy="500" rx="60" ry="14" />
        <ellipse cx="320" cy="520" rx="50" ry="12" />
        <ellipse cx="300" cy="760" rx="70" ry="16" />
        <ellipse cx="80" cy="900" rx="60" ry="14" />
        <ellipse cx="310" cy="1060" rx="64" ry="14" />
      </g>
      {/* river */}
      <g stroke={INK} stroke-width="2.8" stroke-linejoin="round">
        <path d="M-10 584 C80 572 140 612 200 600 C260 588 320 622 410 606 L410 634 C320 650 260 616 200 628 C140 640 80 600 -10 612Z" fill="#4fa3ff" />
      </g>
      <g stroke="#d6efff" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.8">
        <path d="M30 592 q10 -4 20 0" />
        <path d="M110 606 q10 -4 20 0" />
        <path d="M280 614 q10 -4 20 0" />
        <path d="M350 618 q10 -4 20 0" />
      </g>
      {/* roads */}
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">
        {spurList.map((p, i) => (
          <path key={`o${i}`} d={`M200 ${p.y - 16} Q${(200 + p.x) / 2} ${p.y - 30} ${p.x} ${p.y - 8}`} stroke={INK} stroke-width="17" />
        ))}
        <path d={road} stroke={INK} stroke-width="31" />
        {spurList.map((p, i) => (
          <path key={`i${i}`} d={`M200 ${p.y - 16} Q${(200 + p.x) / 2} ${p.y - 30} ${p.x} ${p.y - 8}`} stroke="#cfa56c" stroke-width="11" />
        ))}
        <path d={road} stroke="#d9b27a" stroke-width="25" />
        <path d={road} stroke="#c0935a" stroke-width="2" stroke-dasharray="6 12" />
      </g>
      {/* bridge */}
      <g stroke={INK} stroke-width="2.4" stroke-linejoin="round">
        <rect x="182" y="592" width="38" height="44" rx="4" fill="#a0612e" />
        <path d="M182 602 h38 M182 613 h38 M182 624 h38" stroke-width="1.6" />
        <path d="M180 590 v48 M222 590 v48" stroke-width="4" />
      </g>
      {/* lamps (glows are animated HTML on top) */}
      <g stroke={INK} stroke-width="2.2">
        {LAMPS.map(([x, y], i) => (
          <g key={i}>
            <path d={`M${x} ${y} v-30`} stroke-width="3" />
            <rect x={x - 5} y={y - 40} width="10" height="11" rx="2" fill="#ffd36b" />
          </g>
        ))}
      </g>
      {/* town wall at the campaign gate */}
      <g stroke={INK} stroke-width="2.6" stroke-linejoin="round">
        <rect x="-4" y={gateY - 46} width={MAP_W + 8} height="46" fill="#6b5c88" />
        <path
          d={Array.from({ length: 21 }, (_, i) => `M${i * 20 - 2} ${gateY - 46} v-9 h12 v9`).join(' ')}
          fill="#7d6f99"
        />
        <path d={`M-4 ${gateY - 24} H${MAP_W + 4}`} stroke-width="1.4" />
      </g>
      <g stroke={INK} stroke-width="2.4" stroke-linejoin="round">
        {trees.map(([x, y, k], i) => (
          <Tree key={i} x={x} y={y} kind={k} />
        ))}
      </g>
      <g fill="#ffd1e8" stroke={INK} stroke-width="1">
        {[
          [60, 520], [130, 690], [270, 560], [340, 700], [110, 860], [300, 850], [60, 990], [350, 1000], [180, 1120], [240, 1100],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.6" fill={i % 2 ? '#fff3a0' : '#ffd1e8'} />
        ))}
      </g>
    </svg>
  );
});
