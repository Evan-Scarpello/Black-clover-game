// Hair style library. A style = front silhouette (outer edge + side-lock inner
// edges) + a bang variant + an optional back mass. Everything is authored as
// spline point lists (see core.spline) so styles are easy to tweak.
import type { JSX } from 'preact';
import { OUT, Pt, spline, shade, tint, spikeRing } from './core';
import type { HairStyle, Spec } from './types';

type El = JSX.Element;

interface Sil { outer: Pt[]; inner: Pt[] }

// ---------------------------------------------------------------- silhouettes
// outer: from the viewer-left lock tip, clockwise over the top, to the right
// lock tip and up its inner edge. inner: left lock inner edge (top -> bottom).

const S_SHORT: Sil = {
  outer: [[30.8, 47, 1], [28.2, 39], [26.6, 30], [28, 21], [33, 13], [41, 8], [50, 6.4], [59.4, 7.6], [67.4, 12.6], [72.2, 20.6], [73.6, 30], [72, 39], [69.4, 47, 1], [67.8, 40]],
  inner: [[33.4, 40]],
};
const S_MESSY: Sil = {
  outer: [[30.8, 47, 1], [28, 39], [23.5, 33, 1], [27, 28], [24.6, 18.6, 1], [31.4, 15.6], [32.6, 6.6, 1], [40.6, 9.6], [47.4, 3, 1], [52.4, 8.4], [61, 4.4, 1], [62.6, 10.6], [72, 10.6, 1], [70.8, 16.8], [77, 23.6, 1], [72.8, 27], [76, 34, 1], [72.4, 38], [69.4, 47, 1], [67.8, 40]],
  inner: [[33.4, 40]],
};
const S_SPIKY: Sil = {
  outer: [[31, 46, 1], [28.2, 38.6], [20, 33.4, 1], [26.8, 28.6], [17.4, 21.4, 1], [28, 19.4], [22.6, 8.6, 1], [34, 11.4], [38.4, 1, 1], [45.4, 8.4], [53, 0, 1], [57.4, 7.6], [67, 2, 1], [66.6, 10.4], [78, 9.6, 1], [72.2, 17.4], [82, 22.4, 1], [73.6, 26.4], [80, 33.2, 1], [72.4, 36.6], [69, 46, 1], [67.6, 37.6]],
  inner: [[33, 37]],
};
const S_FLAME: Sil = {
  outer: [[31.2, 45, 1], [28.4, 37], [23.4, 31.4, 1], [27, 26.6], [22.6, 16.6, 1], [30.6, 16.4], [30, 5.6, 1], [38.6, 10.2], [44.6, 0.6, 1], [49.6, 8], [59.4, 0.4, 1], [61, 8.4], [71.6, 5, 1], [69.4, 13], [79, 15.4, 1], [72.8, 21.6], [78, 29, 1], [73, 31.4], [69, 45, 1], [67.4, 36]],
  inner: [[33.4, 36]],
};
const S_LONG: Sil = {
  outer: [[29.6, 68, 1], [27, 56], [26.2, 43], [26.2, 31], [28.8, 20], [35.4, 11.4], [45.6, 7], [56, 7.4], [65, 11.4], [71.2, 19.4], [73.8, 30.6], [73.8, 43], [73, 56], [70.4, 68, 1], [68.6, 58], [67.6, 47]],
  inner: [[33.6, 47], [32, 58]],
};
const S_WAVYLONG: Sil = {
  outer: [[28, 70, 1], [25.4, 62], [27, 54.6], [24.6, 46], [25.6, 36], [27.4, 26], [31, 16.6], [38, 9.6], [48, 6.6], [58, 7.2], [66, 11], [71.6, 18.4], [74.4, 28], [74.6, 38], [75.6, 46.6], [73, 55], [75, 63], [72, 70, 1], [69.6, 62], [69.8, 55], [67.4, 47]],
  inner: [[33.4, 47], [30.8, 55], [31.6, 63]],
};
const S_TOUSLED: Sil = {
  outer: [[30.6, 56, 1], [28.4, 46], [25.4, 40, 1], [26.6, 32], [23.6, 24, 1], [28.4, 20.4], [29, 11, 1], [36.6, 10.4], [42, 3.6, 1], [48.6, 7], [58, 4, 1], [61, 9], [70.4, 9.4, 1], [69.6, 15.6], [77, 20.6, 1], [73, 25], [76.6, 33, 1], [73, 36.6], [74.4, 45, 1], [71.4, 46], [69.6, 56, 1], [68, 47]],
  inner: [[33.4, 47]],
};
const S_WILD: Sil = {
  outer: [[30, 55, 1], [27.4, 47], [21.6, 45, 1], [25.6, 39], [19.4, 31, 1], [25.6, 27], [20, 16, 1], [29, 16.4], [29, 6, 1], [37.6, 10], [44.4, 2.6, 1], [50.4, 8], [60, 3, 1], [61.6, 10], [73, 7, 1], [71, 15], [81, 18, 1], [74.6, 24], [81, 32, 1], [74.6, 35], [79, 44, 1], [73, 45], [70, 55, 1], [68, 46]],
  inner: [[33.6, 46]],
};
const S_MANE: Sil = {
  outer: [[30, 52, 1], [26, 43], [18.6, 39, 1], [24.6, 32.6], [16, 25, 1], [26.6, 22], [21.6, 11, 1], [32.4, 13.6], [34, 3.6, 1], [43.2, 9.6], [50.4, 2.4, 1], [55.6, 9.6], [66, 4, 1], [66.8, 12.6], [78.2, 11.6, 1], [73.2, 19.6], [83.4, 24.6, 1], [74.4, 28.6], [81.6, 37, 1], [73.6, 40], [70, 52, 1], [67.8, 41]],
  inner: [[33.2, 41]],
};
const S_WAVY: Sil = {
  outer: [[31, 50, 1], [27, 44], [24.6, 38.6, 1], [26, 33], [24.4, 26, 1], [27.6, 20.6], [28.6, 13.6, 1], [35, 11.4], [39, 6.4, 1], [45.4, 6.6], [52, 4.6, 1], [57.4, 6.6], [64.4, 6.6, 1], [66.6, 11.6], [73.4, 14.6, 1], [72.6, 20.6], [76, 27.6, 1], [74, 32.6], [75.6, 40, 1], [72.6, 43.4], [69.4, 50, 1], [67.4, 42]],
  inner: [[33.6, 42]],
};
const S_UPSWEPT: Sil = {
  outer: [[31.4, 46, 1], [28.6, 38], [26.2, 29], [26.6, 20], [30.4, 12.6], [34.6, 3.6, 1], [40, 8.4], [45.6, 0.4, 1], [51, 6.6], [58.6, 1.6, 1], [61.6, 8.6], [69.6, 7, 1], [70, 14.4], [73.8, 22.6], [74.2, 32], [72.4, 39.6], [69, 46, 1], [67.4, 37.4]],
  inner: [[33.6, 38]],
};
const S_SWEPT: Sil = {
  outer: [[31.5, 44, 1], [28.5, 36], [23, 31, 1], [27, 26], [19, 18, 1], [29, 17], [24, 6, 1], [35, 10], [39, 1, 1], [46, 7], [55, 1, 1], [58, 8], [69, 4, 1], [67.5, 12], [79, 13, 1], [72.5, 20], [78.5, 28, 1], [72.5, 30], [69, 44, 1], [67.5, 34]],
  inner: [[33.4, 36]],
};
const S_SLICKED: Sil = {
  outer: [[31.4, 44, 1], [28.4, 36], [26.6, 27], [28.6, 18], [34.4, 11], [42.4, 7], [51, 6], [60, 7], [67.4, 11.4], [72, 18.6], [73.6, 27.4], [72.2, 36], [69, 44, 1], [67.4, 35]],
  inner: [[33.4, 35]],
};
const S_POMP: Sil = {
  outer: [[30.6, 36, 1], [28.4, 29], [28.8, 21], [26.6, 13.6], [29.4, 5.4], [37.4, 0.2], [49, -1.8], [61, -0.8], [70, 3], [75.6, 9.6], [74.6, 16.4], [72, 22], [71.6, 29], [69.6, 36, 1], [67.8, 29]],
  inner: [[32.4, 29]],
};
const S_BOB: Sil = {
  outer: [[30.4, 54, 1], [26, 50], [25.2, 44, 1], [23.6, 38], [24.6, 31, 1], [24, 24], [28, 18.6, 1], [30, 12], [37, 9.6, 1], [42, 5], [50, 5.6, 1], [57.4, 4.6], [63.4, 9.4, 1], [70, 11.6], [72.4, 18.6, 1], [76, 24], [75.4, 31, 1], [76.6, 38], [75, 44, 1], [74, 50], [69.6, 54, 1], [67.4, 45]],
  inner: [[33.4, 45]],
};
const S_MEDIUM: Sil = {
  outer: [[28, 62, 1], [26.6, 54], [25, 46], [26, 35], [27.6, 24], [32, 15], [40, 9], [50, 7], [60, 8], [67.6, 13], [72.4, 21], [74, 32], [74.6, 44], [73.4, 54], [72, 62, 1], [69.6, 54], [67.6, 46]],
  inner: [[33.6, 46], [31, 54]],
};
const S_FRINGE: Sil = {
  outer: [[30.6, 52, 1], [28, 44], [26.2, 34], [27, 24], [31.4, 14.6], [39.6, 8.6], [50, 6.4], [60, 7.6], [68, 12.6], [72.6, 21], [74, 32], [72.6, 43], [69.6, 52, 1], [67.8, 42]],
  inner: [[33.4, 42]],
};

// ---------------------------------------------------------------- bangs (right -> left)

type Bang = { pts: Pt[]; lines?: string };
const BANGS: Record<string, Bang> = {
  zig: {
    pts: [[65.2, 33.6, 1], [61.8, 27.4], [58.2, 34.6, 1], [55, 27.6], [51.4, 35.2, 1], [47.8, 27.6], [44.2, 35, 1], [40.6, 27.6], [36.6, 34.4, 1]],
    lines: 'M61.8 27.4Q61.6 21 57.6 16M48 27.6Q48.6 21 46.6 15.6M40.8 27.8Q40 22.6 37.6 19.4',
  },
  blunt: {
    pts: [[66, 34.6, 1], [62.6, 32.4], [59, 35, 1], [55.4, 32.6], [51.6, 35.4, 1], [47.8, 32.6], [44.2, 35.2, 1], [40.6, 32.6], [36.8, 34.8, 1]],
    lines: 'M62.6 32.4Q62.4 25 58 18M55.4 32.6Q55.6 24 53 16.6M47.8 32.6Q48 24.6 45.4 17.6M40.6 32.6Q40 26 37.4 21',
  },
  side: {
    pts: [[65.6, 31.4, 1], [61.4, 24.8], [57.6, 29.6, 1], [55.2, 27], [49.6, 30.6], [45.6, 34.8, 1], [44.4, 31], [40, 34.6], [35.8, 38.4, 1]],
    lines: 'M61.4 24.8Q58 20 52.6 18.4M55.2 27Q50 23.4 43.4 23.6M49.6 30.6Q44 28.6 39 30.4',
  },
  parted: {
    pts: [[66.4, 38, 1], [64.8, 30], [60.6, 23], [55, 19.2], [51.6, 17.8, 1], [48.4, 19], [42.4, 22.8], [38, 29.6], [35.4, 38, 1]],
    lines: 'M60 24Q56.4 18 52 15.4M42.4 23Q46 17.6 50.6 15.4',
  },
  center: {
    pts: [[65.6, 36.6, 1], [62.4, 28.6], [58.8, 37.6, 1], [56, 29], [51.6, 40.6, 1], [49.2, 29], [45, 37.4, 1], [41.4, 28.4], [37, 36.2, 1]],
    lines: 'M62.4 28.6Q62 22 58 17M56 29Q56 22 54 16.4M49.2 29Q48.6 22 45.6 16.6M41.4 28.4Q40.6 23 38 20',
  },
  spikyShort: {
    pts: [[65, 29.6, 1], [62, 24], [58.5, 29.4, 1], [55, 23.6], [51, 29.8, 1], [47, 23.6], [43, 29.4, 1], [39, 23.6], [35.2, 29.6, 1]],
    lines: 'M62 24Q61.4 19 58.4 15M55 23.6Q55 18 52.6 13.6M47 23.6Q46.6 18.4 44 14.6',
  },
  hairline: {
    pts: [[65.4, 28], [60, 22.6], [54.6, 24.6, 1], [51, 20.8], [45, 22.6], [39.6, 25.4], [35.4, 30]],
    lines: 'M60 22.6Q58 16 54 11.6M51 20.8Q49 15 45.6 11.6M45 22.6Q41 17.6 36.4 16',
  },
  slick: {
    pts: [[65.6, 29], [61, 22.4], [55, 20], [50.6, 20.6], [48.6, 26.4, 1], [47.6, 21.4], [42.6, 22.4], [38, 25.6], [35, 31]],
    lines: 'M61 22.4Q57 15.6 51 13M55 20Q50 15 44 13.6M47.6 21.4Q43 17.6 37.4 18.4',
  },
  fringe: {
    pts: [[65.6, 34, 1], [62, 27.8], [58.2, 36, 1], [55, 28.2], [51.4, 42, 1], [48.6, 30], [44.4, 45, 1], [42, 31], [37.6, 44, 1], [36, 34]],
    lines: 'M62 27.8Q61.4 21 57.6 16.6M55 28.2Q54.6 21 51.6 15.6M48.6 30Q47.6 22 43.6 17.4',
  },
  pomp: {
    pts: [[66.6, 29], [66, 23], [62, 19.2], [56, 17.6], [50, 19], [44, 18], [38.4, 20.2], [34.6, 24.6], [33.4, 31]],
    lines: 'M37 19.6Q37 9 47.6 4M44.6 18Q46 9.6 56.6 4.6M53.4 18Q57 11 66 7.4M61 18.8Q67 14.6 72 13.4M31 22Q30.4 15 34 9.6',
  },
  band: {
    pts: [[65.4, 27.6, 1], [62.2, 22.4], [58.6, 27.2, 1], [55, 21.6], [51, 27.6, 1], [47, 21.6], [43, 27, 1], [39.2, 22], [35.4, 27.4, 1]],
    lines: 'M62.2 22.4Q61.6 18 58.6 14.6M55 21.6Q55 17 52.6 13M47 21.6Q46.6 17.4 44 13.8',
  },
  wavy: {
    pts: [[64.6, 30.2, 1], [60.5, 25.6], [55.4, 27], [51.2, 33, 1], [49, 25.6], [44, 24.4], [39.4, 27], [35.4, 32.6, 1]],
    lines: 'M60.5 25.6Q60 19 55 15M49 25.6Q49.6 18 46 13.6M44 24.4Q40 21 36.4 21.6',
  },
};

// ---------------------------------------------------------------- back masses

const B_SHORT: Pt[] = [[32, 56], [27, 49, 1], [25.6, 38], [26.4, 26], [31, 15], [40, 8.6], [50, 7], [60, 8.6], [69, 15], [73.6, 26], [74.4, 38], [73, 49, 1], [68, 56], [50, 58]];
const B_LONG: Pt[] = [[21.4, 98, 1], [19.6, 82], [19.6, 62], [20.4, 44], [23.6, 26], [31.6, 12.6], [44, 6.6], [56, 6.6], [68.4, 12.6], [76.4, 26], [79.6, 44], [80.4, 62], [80.4, 82], [78.6, 98, 1], [72.6, 93], [66.4, 98, 1], [58, 94], [50, 97, 1], [42, 94], [33.6, 98, 1], [27.4, 93]];
const B_WAVYLONG: Pt[] = [[19, 98, 1], [21, 90], [17.6, 80], [20.6, 70], [17.6, 60], [20, 50], [18.6, 40], [22.6, 26], [31.6, 12.6], [44, 6.6], [56, 6.6], [68.4, 12.6], [77.4, 26], [81.4, 40], [80, 50], [82.4, 60], [79.4, 70], [82.4, 80], [79, 90], [81, 98, 1], [72, 95], [64, 98, 1], [56, 95], [50, 98, 1], [44, 95], [36, 98, 1], [28, 95]];
const B_TOUSLED: Pt[] = [[30, 62, 1], [26, 56], [22, 52, 1], [24.6, 44], [21.6, 34], [24, 22], [31, 12], [42, 6.6], [58, 6.6], [69, 12], [76, 22], [78.4, 34], [75.4, 44], [78, 52, 1], [74, 56], [70, 62, 1], [62, 58], [56, 62, 1], [50, 58], [44, 62, 1], [38, 58]];
const B_MEDIUM: Pt[] = [[24, 67, 1], [22.6, 58], [22, 46], [23, 30], [29, 16], [40, 8], [50, 6.6], [60, 8], [71, 16], [77, 30], [78, 46], [77.4, 58], [76, 67, 1], [68, 62], [60, 64], [50, 62], [40, 64], [32, 62]];
const B_UPSWEPT: Pt[] = [[24, 80, 1], [22, 66], [21.6, 52], [23, 36], [27, 22], [36, 10], [50, 6], [64, 10], [73, 22], [77, 36], [78.4, 52], [78, 66], [76, 80, 1], [70, 73], [64, 78, 1], [58, 71], [50, 73], [42, 71], [36, 78, 1], [30, 73]];
const B_BOB: Pt[] = [[30, 60, 1], [24.6, 54], [22.6, 44], [22.6, 30], [27, 17], [38, 8], [50, 6], [62, 8], [73, 17], [77.4, 30], [77.4, 44], [75.4, 54], [70, 60, 1], [60, 58], [50, 60], [40, 58]];
const B_WILD: Pt[] = [[28, 64, 1], [24, 56], [18, 54, 1], [22.6, 46], [17, 38, 1], [22.6, 30], [21, 18], [30, 9], [42, 5], [58, 5], [70, 9], [79, 18], [77.4, 30], [83, 38, 1], [77.4, 46], [82, 54, 1], [76, 56], [72, 64, 1], [64, 58], [56, 63, 1], [50, 58], [44, 63, 1], [36, 58]];

function maneBack(): string {
  const ring = spikeRing(50, 44, 27, 29, -90, 270, 13, 10, 8, [1, 0.8, 1.1, 0.9, 1.2, 1, 0.9, 1.15, 1, 0.85, 1.1, 1, 0.9]);
  ring.pop();
  return spline(ring);
}

// ---------------------------------------------------------------- style table

interface StyleDef {
  sil?: Sil;
  bangs?: string;
  back?: Pt[] | 'mane' | null;
  shine?: string | null;
  streak?: [number, number, number, number]; // top x,y -> tip x,y
  extraLines?: string;
}

const SHINE = 'M33.6 22.4Q36.4 15.4 43.4 12.2';
const SHINE2 = 'M47 10.8L50.4 10.4';

const STYLES: Record<Exclude<HairStyle, 'none' | 'bald' | 'twintails' | 'ponytail'>, StyleDef> = {
  spiky: { sil: S_SPIKY, bangs: 'spikyShort', back: B_SHORT, streak: [58, 9, 58.5, 29.4] },
  flame: { sil: S_FLAME, bangs: 'spikyShort', back: B_SHORT, streak: [57, 6, 58.5, 29.4] },
  messy: { sil: S_MESSY, bangs: 'zig', back: B_SHORT, streak: [58, 9, 58.2, 34.6] },
  tousled: { sil: S_TOUSLED, bangs: 'center', back: B_TOUSLED, streak: [56, 9, 51.6, 40.6] },
  swept: { sil: S_SWEPT, bangs: 'hairline', back: B_SHORT, shine: 'M36 18Q39 12.6 45 10.6' },
  wavy: { sil: S_WAVY, bangs: 'wavy', back: B_SHORT, streak: [58, 8, 51.2, 33] },
  mane: { sil: S_MANE, bangs: 'zig', back: 'mane' },
  upswept: { sil: S_UPSWEPT, bangs: 'hairline', back: B_UPSWEPT, shine: 'M33.6 19Q36.4 11 42.4 7.6' },
  long: { sil: S_LONG, bangs: 'zig', back: B_LONG, streak: [58, 9, 58.2, 34.6] },
  longWavy: { sil: S_WAVYLONG, bangs: 'side', back: B_WAVYLONG },
  wild: { sil: S_WILD, bangs: 'zig', back: B_WILD },
  medium: { sil: S_MEDIUM, bangs: 'side', back: B_MEDIUM },
  fringe: { sil: S_FRINGE, bangs: 'fringe', back: B_SHORT },
  sidepart: { sil: S_SHORT, bangs: 'side', back: B_SHORT },
  pompadour: { sil: S_POMP, bangs: 'pomp', back: null, shine: 'M33 9.6Q38 4 46 2.4' },
  bob: { sil: S_BOB, bangs: 'blunt', back: B_BOB },
  slicked: { sil: S_SLICKED, bangs: 'slick', back: B_SHORT, shine: 'M35.4 17Q39 11.6 45.4 10' },
};

const TWIN: StyleDef = { sil: S_SHORT, bangs: 'blunt', back: B_SHORT };
const PONY: StyleDef = { sil: S_MESSY, bangs: 'zig', back: B_SHORT };

function styleDef(spec: Spec): StyleDef | null {
  const st = spec.hair.style;
  if (st === 'none' || st === 'bald') return null;
  if (st === 'twintails') return TWIN;
  if (st === 'ponytail') return PONY;
  return (STYLES as Record<string, StyleDef>)[st] || STYLES.messy;
}

export interface HairParts {
  back: El | null;
  front: El | null;
  frontD: string | null;
}

function bangsOf(spec: Spec, def: StyleDef): Bang {
  const key = spec.hair.bangs || def.bangs || 'zig';
  return BANGS[key] || BANGS.zig;
}

/** Front hair outline path for the given spec (also used for the bang shadow). */
export function hairFrontPath(spec: Spec): string | null {
  const def = styleDef(spec);
  if (!def || !def.sil) return null;
  const b = bangsOf(spec, def);
  return spline([...def.sil.outer, ...b.pts, ...def.sil.inner]);
}

function lockPath(x0: number, y0: number, xt: number, yt: number): string {
  const mx = (x0 + xt) / 2, my = (y0 + yt) / 2;
  return spline([[x0 - 3.6, y0], [mx - 2.6, my], [xt, yt, 1], [mx + 2, my], [x0 + 3.4, y0 - 0.6]]);
}

export function hair(spec: Spec, uid: string): HairParts {
  const st = spec.hair.style;
  const base = spec.hair.color;
  const dark = spec.hair.shade || shade(base, 0.32);
  if (st === 'none') return { back: null, front: null, frontD: null };
  if (st === 'bald') {
    return {
      back: null,
      frontD: null,
      front: (
        <g stroke="none">
          <ellipse cx={41} cy={21} rx={4.6} ry={2.4} fill="#fff" opacity={0.45} transform="rotate(-25 41 21)" />
        </g>
      ),
    };
  }
  const def = styleDef(spec)!;
  const b = bangsOf(spec, def);
  const frontD = spline([...def.sil!.outer, ...b.pts, ...def.sil!.inner]);
  const shineCol = tint(base, base === '#000000' ? 0.3 : 0.42);

  // ----- back
  const backEls: El[] = [];
  let backD: string | null = null;
  if (def.back === 'mane') backD = maneBack();
  else if (def.back) backD = spline(def.back);
  if (st === 'twintails') {
    const tailL = spline([[29, 17], [21, 21], [14.4, 34], [11.6, 50], [13, 64], [10.6, 74, 1], [15.4, 70.6], [17.4, 83, 1], [19.4, 70], [20.8, 56], [23.4, 42], [28.6, 30]]);
    const tcid = `${uid}-tails`;
    const both = (d: string, k: string) => (
      <g key={k}>
        <path d={d} fill={base} stroke="none" />
        <path d={d} fill="none" />
      </g>
    );
    const mir = 'translate(100 0) scale(-1 1)';
    backEls.push(
      <clipPath key="tc" id={tcid}><path d={tailL} /><path d={tailL} transform={mir} /></clipPath>,
      both(tailL, 'tl'),
      <g key="tr" transform={mir}>{both(tailL, 'trr')}</g>,
      <g key="ts" clip-path={`url(#${tcid})`} stroke="none" fill={dark}>
        <path d="M4 20Q14 40 14 60Q14 74 18 86L4 86Z" />
        <path d="M96 20Q86 40 86 60Q86 74 82 86L96 86Z" />
      </g>,
      <path key="tlo" d={tailL} fill="none" />,
      <path key="tro" d={tailL} transform={mir} fill="none" />,
      <path key="tll" d="M22 26Q17 40 17.6 58M25 30Q21 44 21.4 54M78 26Q83 40 82.4 58M75 30Q79 44 78.6 54" fill="none" stroke={shade(dark, 0.3)} stroke-width={1.1} />,
    );
  }
  if (st === 'ponytail') {
    const tail = spline([[57, 12], [63, 3.6], [74, 0], [85, 3.6], [91.6, 12], [94.6, 20.6, 1], [92, 26], [93.4, 36, 1], [89.6, 40], [90.4, 50, 1], [86.4, 52], [85, 62, 1], [82.4, 52], [80.4, 42], [79.6, 32], [76.6, 22], [70, 15], [63, 14.6]]);
    const tcid = `${uid}-pony`;
    backEls.push(
      <clipPath key="ptc" id={tcid}><path d={tail} /></clipPath>,
      <path key="pt" d={tail} fill={base} stroke="none" />,
      <path key="pts" d="M66 16Q80 18 82 34Q83 46 84 62L70 62L60 16Z" fill={dark} clip-path={`url(#${tcid})`} stroke="none" />,
      <path key="pto" d={tail} fill="none" />,
      <path key="ptl" d="M72 4Q86 8 88.6 22Q89 32 87 44M66 8Q78 10 83.6 22Q85.6 32 85 46" fill="none" stroke={shade(dark, 0.3)} stroke-width={1.1} />,
      <path key="pth" d="M70 3.6Q80 2.4 86 7" fill="none" stroke={tint(base, 0.42)} stroke-width={2} />,
    );
  }
  if (backD) backEls.push(<path key="b" d={backD} fill={dark} />);
  if (spec.hair.tips && backD) {
    const cid = `${uid}-tips`;
    backEls.push(
      <clipPath key="tc" id={cid}><rect x={0} y={90} width={100} height={40} /></clipPath>,
      <path key="bt" d={backD} fill={spec.hair.tips} clip-path={`url(#${cid})`} />,
    );
  }

  // ----- front
  const cid = `${uid}-hair`;
  const frontEls: El[] = [
    <clipPath key="c" id={cid}><path d={frontD} /></clipPath>,
    <path key="f" d={frontD} fill={base} stroke="none" />,
  ];
  const inside: El[] = [];
  // darker underside on the right (cel shade)
  inside.push(<path key="sh" d="M60 4C78 8 84 30 80 74L100 74L100 0Z" fill={dark} opacity={0.55} />);
  if (spec.hair.streak && def.streak) {
    const [x0, y0, xt, yt] = def.streak;
    inside.push(<path key="st" d={lockPath(x0, y0, xt, yt)} fill={spec.hair.streak} stroke={OUT} stroke-width={1} />);
  }
  if (spec.hair.tips) {
    inside.push(<rect key="tp" x={0} y={59.5} width={100} height={20} fill={spec.hair.tips} />);
  }
  frontEls.push(<g key="in" clip-path={`url(#${cid})`} stroke="none">{inside}</g>);
  if (b.lines) frontEls.push(<path key="ln" d={b.lines} fill="none" stroke={shade(dark, 0.35)} stroke-width={1.1} />);
  if (def.extraLines) frontEls.push(<path key="xl" d={def.extraLines} fill="none" stroke={shade(dark, 0.35)} stroke-width={1.1} />);
  const shine = def.shine === undefined ? SHINE : def.shine;
  if (shine) {
    frontEls.push(
      <path key="sn" d={shine} fill="none" stroke={shineCol} stroke-width={2.2} />,
      <path key="sn2" d={SHINE2} fill="none" stroke={shineCol} stroke-width={2} opacity={def.shine === undefined ? 1 : 0} />,
    );
  }
  frontEls.push(<path key="o" d={frontD} fill="none" />);
  if (st === 'twintails') {
    frontEls.push(
      <g key="ties">
        <path d="M24.6 15.6L30.6 19.6L28 24.4L22 20.4Z" fill="#3b2a5a" stroke-width={1.6} />
        <path d="M75.4 15.6L69.4 19.6L72 24.4L78 20.4Z" fill="#3b2a5a" stroke-width={1.6} />
      </g>,
    );
  }
  if (st === 'ponytail') {
    frontEls.push(<path key="tie" d="M58.6 6.6L64.6 4L66.6 9.6L60.6 12Z" fill="#2fd07a" stroke-width={1.6} />);
  }

  return {
    back: backEls.length ? <g>{backEls}</g> : null,
    front: <g>{frontEls}</g>,
    frontD,
  };
}
