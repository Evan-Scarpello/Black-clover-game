// World-map geometry: pure and deterministic (same chapter → same layout), so the map
// never jumps between renders and can be unit tested. Coordinates are "map units": every
// region is MAP_W × REGION_H units and scales uniformly with the screen width.
//
// The campaign climbs UPWARD: stage 1 of a chapter sits near the bottom of its region,
// the boss near the top. Regions stack bottom (chapter 1) → top (newest chapter), with a
// fog cap above the last revealed region.
import { STAGES_PER_CHAPTER } from '../../data/campaign';
import { rng } from '../../game/rng';

export const MAP_W = 360;
export const REGION_H = 1000;
export const FOG_H = 430;
/** Bottom band of every region that holds the chapter banner. */
export const BANNER_Y = 925;
export const NODE_BOTTOM_Y = 800;
export const NODE_TOP_Y = 165;
/** Node radii in map units (used for spacing/overlap rules; the UI draws fixed-size buttons). */
export const NODE_R = 23;
export const BOSS_R = 33;
export const CENTER_X = MAP_W / 2;

export interface Pt {
  x: number;
  y: number;
}

export interface MapNode extends Pt {
  /** Stage within the chapter (0-9). */
  k: number;
  /** Global stage index (chapter * 10 + k). */
  index: number;
  boss: boolean;
  r: number;
  /** Side where the squad marker floats (-1 left, 1 right). */
  side: -1 | 1;
}

export interface Decor extends Pt {
  kind: string;
  /** Scale factor. */
  s: number;
  flip: boolean;
  /** Ground patches may sit under the road; props never do. */
  patch: boolean;
}

export interface RegionLayout {
  chapter: number;
  /** Scenery theme = story chapter (0-8); Abyss loops reuse it. */
  theme: number;
  loop: number;
  nodes: MapNode[];
  /** Road pieces: [entry→n0, n0→n1, …, n9→exit]; each an SVG path "d". */
  segs: string[];
  entry: Pt;
  exit: Pt;
  decor: Decor[];
}

export const THEME_COUNT = 9;

interface ThemeCfg {
  lair: string;
  /** Larger landmarks, placed first (kind, footprint radius). */
  big: [string, number][];
  small: [string, number][];
  smallCount: number;
  patches: [string, number][];
  patchCount: number;
}

// Footprint radii are in map units at scale 1.
const THEMES: ThemeCfg[] = [
  {
    // Hage Village
    lair: 'tower',
    big: [['church', 40], ['windmill', 34], ['house', 24], ['house', 24], ['windmill', 34]],
    small: [['tree', 16], ['tree', 16], ['bush', 11], ['haystack', 12], ['fence', 16], ['tree', 16], ['rock', 10]],
    smallCount: 16,
    patches: [['field', 46], ['field', 46], ['pond', 34]],
    patchCount: 6,
  },
  {
    // The Dungeon
    lair: 'dungeon',
    big: [['ruin', 32], ['arch', 30], ['crystalBig', 26], ['ruin', 32]],
    small: [['crystal', 13], ['rock', 11], ['pillar', 11], ['skull', 8], ['torch', 8], ['crystal', 13]],
    smallCount: 17,
    patches: [['slab', 40], ['slab', 40], ['pit', 30]],
    patchCount: 6,
  },
  {
    // Royal Capital Raid
    lair: 'castle',
    big: [['keep', 30], ['house', 24], ['house', 24], ['fountain', 26], ['keep', 30]],
    small: [['banner', 10], ['house', 22], ['fire', 10], ['crate', 9], ['tree', 15], ['banner', 10]],
    smallCount: 15,
    patches: [['plaza', 44], ['plaza', 44], ['scorch', 30]],
    patchCount: 6,
  },
  {
    // Underwater Temple
    lair: 'temple',
    big: [['coralBig', 30], ['column', 18], ['shipwreck', 36], ['coralBig', 30]],
    small: [['coral', 14], ['seaweed', 10], ['shell', 9], ['rock', 11], ['seaweed', 10], ['column', 16]],
    smallCount: 18,
    patches: [['sand', 46], ['sand', 46], ['trench', 34]],
    patchCount: 6,
  },
  {
    // Royal Knights Exam
    lair: 'arena',
    big: [['tent', 26], ['tent', 26], ['stand', 34], ['tent', 26]],
    small: [['dummy', 10], ['flag', 10], ['crate', 9], ['bush', 11], ['rock', 10], ['target', 11]],
    smallCount: 15,
    patches: [['track', 46], ['track', 46], ['sandpit', 30]],
    patchCount: 5,
  },
  {
    // Elf Reincarnation
    lair: 'worldTree',
    big: [['bigTree', 40], ['bigTree', 40], ['bigTree', 40]],
    small: [['tree', 16], ['mushroom', 10], ['bush', 11], ['flower', 8], ['tree', 16], ['flower', 8]],
    smallCount: 18,
    patches: [['meadow', 44], ['meadow', 44], ['pond', 32]],
    patchCount: 6,
  },
  {
    // Spade Kingdom Raid
    lair: 'darkCastle',
    big: [['spire', 30], ['spire', 30], ['deadTree', 22], ['spire', 30]],
    small: [['deadTree', 18], ['rock', 11], ['grave', 9], ['spike', 11], ['deadTree', 18]],
    smallCount: 15,
    patches: [['mire', 44], ['mire', 44], ['crack', 30]],
    patchCount: 6,
  },
  {
    // Gate of the Underworld
    lair: 'hellGate',
    big: [['spikeRock', 26], ['spikeRock', 26], ['bonePile', 22]],
    small: [['rock', 11], ['spike', 11], ['skull', 8], ['bones', 11], ['rock', 11]],
    smallCount: 15,
    patches: [['lava', 46], ['lava', 46], ['crack', 30]],
    patchCount: 6,
  },
  {
    // Paladin's Ascension
    lair: 'throne',
    big: [['island', 40], ['island', 40], ['pillarGold', 18], ['island', 40]],
    small: [['cloud', 22], ['pillarGold', 16], ['cloud', 22], ['sparkle', 8]],
    smallCount: 13,
    patches: [['cloudBank', 46], ['cloudBank', 46], ['halo', 30]],
    patchCount: 5,
  },
];

export function themeOf(chapter: number): number {
  return ((chapter % THEME_COUNT) + THEME_COUNT) % THEME_COUNT;
}

function cubicAt(p0: Pt, c1: Pt, c2: Pt, p1: Pt, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
    y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y,
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

const cache = new Map<number, RegionLayout>();

/** Cached layout for a chapter's region (layouts never change, so build each once). */
export function regionLayout(chapter: number): RegionLayout {
  const c = Math.max(0, Math.floor(chapter) || 0);
  let hit = cache.get(c);
  if (!hit) {
    hit = buildRegionLayout(c);
    cache.set(c, hit);
  }
  return hit;
}

/** Build a region layout from scratch. Pure: same chapter in, same layout out. */
export function buildRegionLayout(chapter: number): RegionLayout {
  const theme = themeOf(chapter);
  const loop = Math.floor(chapter / THEME_COUNT);
  const rand = rng(chapter * 977 + 31);
  const amp = 88 + rand() * 18;
  const freq = 0.95 + rand() * 0.3;
  const phase = rand() * Math.PI * 2;
  const n = STAGES_PER_CHAPTER;
  const step = (NODE_BOTTOM_Y - NODE_TOP_Y) / (n - 1);

  const nodes: MapNode[] = [];
  for (let k = 0; k < n; k++) {
    const boss = k === n - 1;
    let x = CENTER_X + amp * Math.sin(phase + k * freq) + (rand() - 0.5) * 18;
    if (boss) x = CENTER_X + (x - CENTER_X) * 0.3;
    // Keep the first node near the middle so the road enters calmly under the banner.
    if (k === 0) x = CENTER_X + (x - CENTER_X) * 0.55;
    x = Math.max(58, Math.min(MAP_W - 58, x));
    const y = NODE_BOTTOM_Y - k * step;
    nodes.push({ k, index: chapter * n + k, x: r1(x), y: r1(y), boss, r: boss ? BOSS_R : NODE_R, side: x <= CENTER_X ? 1 : -1 });
  }
  // The squad marker floats on the side away from the next node (boss: away from the last one).
  for (const nd of nodes) {
    const other = nd.boss ? nodes[nd.k - 1] : nodes[nd.k + 1];
    const dx = nd.x - other.x;
    if (Math.abs(dx) > 6) nd.side = dx > 0 ? 1 : -1;
    // Never push the marker off the map edge.
    if (nd.x + nd.side * 60 > MAP_W - 18 || nd.x + nd.side * 60 < 18) nd.side = nd.side === 1 ? -1 : 1;
  }

  // Road: Catmull-Rom through entry → nodes → exit, with vertical tangents at the region
  // edges so neighbouring regions join without a kink.
  const entry: Pt = { x: CENTER_X, y: REGION_H };
  const exit: Pt = { x: CENTER_X, y: 0 };
  const pts: Pt[] = [entry, ...nodes, exit];
  const segs: string[] = [];
  const samples: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const prev = pts[i - 1];
    const next = pts[i + 2];
    const c1: Pt = prev ? { x: p0.x + (p1.x - prev.x) / 6, y: p0.y + (p1.y - prev.y) / 6 } : { x: p0.x, y: p0.y - step / 2 };
    const c2: Pt = next ? { x: p1.x - (next.x - p0.x) / 6, y: p1.y - (next.y - p0.y) / 6 } : { x: p1.x, y: p1.y + step / 2 };
    segs.push(`M${r1(p0.x)} ${r1(p0.y)}C${r1(c1.x)} ${r1(c1.y)} ${r1(c2.x)} ${r1(c2.y)} ${r1(p1.x)} ${r1(p1.y)}`);
    for (let t = 0; t <= 1.0001; t += 0.1) samples.push(cubicAt(p0, c1, c2, p1, t));
  }

  // Scenery: lair behind the boss, then landmarks and props kept clear of road and nodes.
  const cfg = THEMES[theme];
  const decor: Decor[] = [];
  const boss = nodes[n - 1];
  decor.push({ kind: cfg.lair, x: boss.x, y: boss.y + 34, s: 1, flip: false, patch: false });
  const placed: { x: number; y: number; r: number }[] = [{ x: boss.x, y: boss.y - 20, r: 70 }];

  const clearOfRoad = (x: number, y: number, r: number) => {
    for (const p of samples) if ((p.x - x) ** 2 + (p.y - y) ** 2 < (r + 16) ** 2) return false;
    for (const nd of nodes) if ((nd.x - x) ** 2 + (nd.y - y) ** 2 < (r + nd.r + 22) ** 2) return false;
    return true;
  };
  const clearOfProps = (x: number, y: number, r: number) => placed.every((p) => (p.x - x) ** 2 + (p.y - y) ** 2 >= ((p.r + r) * 0.92) ** 2);

  const tryPlace = (kind: string, fr: number, s: number, attempts: number, yMin: number, yMax: number) => {
    const rad = fr * s;
    for (let a = 0; a < attempts; a++) {
      const x = 14 + rad * 0.6 + rand() * (MAP_W - 28 - rad * 1.2);
      const y = yMin + rand() * (yMax - yMin);
      if (!clearOfRoad(x, y - rad * 0.6, rad) || !clearOfProps(x, y - rad * 0.6, rad)) continue;
      decor.push({ kind, x: r1(x), y: r1(y), s: r1(s * 100) / 100, flip: rand() < 0.5, patch: false });
      placed.push({ x, y: y - rad * 0.6, r: rad });
      return true;
    }
    return false;
  };

  const top = NODE_TOP_Y + 20;
  const bottom = BANNER_Y - 70;
  cfg.big.forEach(([kind, fr], i) => {
    // Spread landmarks over the height of the region.
    const band = (bottom - top) / cfg.big.length;
    tryPlace(kind, fr, 0.95 + rand() * 0.15, 60, top + band * i, top + band * (i + 1));
  });
  for (let i = 0; i < cfg.smallCount; i++) {
    const [kind, fr] = cfg.small[i % cfg.small.length];
    tryPlace(kind, fr, 0.8 + rand() * 0.35, 40, 40, bottom + 30);
  }

  const patches: Decor[] = [];
  for (let i = 0; i < cfg.patchCount; i++) {
    const [kind] = cfg.patches[i % cfg.patches.length];
    patches.push({
      kind,
      x: r1(30 + rand() * (MAP_W - 60)),
      y: r1(60 + ((REGION_H - 160) * (i + rand() * 0.8)) / cfg.patchCount),
      s: r1((0.85 + rand() * 0.4) * 100) / 100,
      flip: rand() < 0.5,
      patch: true,
    });
  }

  // Patches first (ground), then props sorted back-to-front by their base line.
  const props = decor.slice(1).sort((a, b) => a.y - b.y);
  return { chapter, theme, loop, nodes, segs, entry, exit, decor: [...patches, decor[0], ...props] };
}

/** Map-unit Y of a region's top edge, counted from the top of the whole map. */
export function regionTop(chapter: number, topChapter: number): number {
  return FOG_H + (topChapter - chapter) * REGION_H;
}

export function mapHeight(topChapter: number): number {
  return FOG_H + (topChapter + 1) * REGION_H;
}

/** A stage node's position in whole-map units. */
export function nodeMapPos(stage: number, topChapter: number): Pt {
  const chapter = Math.floor(stage / STAGES_PER_CHAPTER);
  const nd = regionLayout(chapter).nodes[stage % STAGES_PER_CHAPTER];
  return { x: nd.x, y: regionTop(chapter, topChapter) + nd.y };
}

/** Highest chapter drawn on the map (current + 2); everything above is fog. */
export function topChapterFor(cleared: number): number {
  return Math.floor(Math.max(0, cleared) / STAGES_PER_CHAPTER) + 2;
}
