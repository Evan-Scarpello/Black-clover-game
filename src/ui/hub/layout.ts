// Where things stand on the hideout base map. Pure data + math (unit-tested).
// Map units: the scene is MAP_W wide; y grows downward; landmark y is its ground line.

export const MAP_W = 400;

export interface Plot {
  key: string;
  /** Centre x of the landmark. */
  x: number;
  /** Ground line (bottom) of the landmark. */
  y: number;
  /** Art width in map units. */
  w: number;
}

/** Hand-placed plots in the town below the hideout (three rows). */
export const BASE_PLOTS: Plot[] = [
  { key: 'a', x: 104, y: 724, w: 150 },
  { key: 'b', x: 298, y: 716, w: 128 },
  { key: 'c', x: 66, y: 876, w: 82 },
  { key: 'd', x: 196, y: 872, w: 112 },
  { key: 'e', x: 326, y: 880, w: 104 },
  { key: 'f', x: 84, y: 1030, w: 108 },
  { key: 'g', x: 202, y: 1022, w: 90 },
  { key: 'h', x: 320, y: 1032, w: 100 },
];

/** Art-matched plot for the screens we know about; anything new takes the next free plot. */
export const PREFERRED_PLOT: Record<string, string> = {
  arena: 'a',
  clan: 'b',
  tower: 'c',
  dispatch: 'd',
  shop: 'e',
  pass: 'f',
  login: 'g',
  achievements: 'h',
};

/** Fixed landmarks above the town. */
export const SUMMON_SPOT = { x: 74, y: 432, w: 104 };
export const HIDEOUT_SPOT = { x: 236, y: 446, w: 196 };
export const SQUAD_Y = 548;
export const SQUAD_XS = [72, 136, 200, 264, 328];

const ROW_GAP = 152;
const EXTRA_XS = [84, 200, 316];
const GATE_GAP = 150;
const BOTTOM_PAD = 34;

export interface HubLayout {
  placements: { id: string; plot: Plot }[];
  /** Ground line of the campaign gate. */
  gateY: number;
  /** Total map height in map units. */
  height: number;
}

/** Give every screen id a plot: its preferred one when free, else the next free one, else a new row. */
export function layoutHub(ids: string[]): HubLayout {
  const used = new Set<string>();
  const out = new Map<string, Plot>();
  const unique = [...new Set(ids)];
  for (const id of unique) {
    const key = PREFERRED_PLOT[id];
    const plot = key ? BASE_PLOTS.find((p) => p.key === key) : undefined;
    if (plot && !used.has(plot.key)) {
      used.add(plot.key);
      out.set(id, plot);
    }
  }
  let extra = 0;
  const lastBaseY = Math.max(...BASE_PLOTS.map((p) => p.y));
  for (const id of unique) {
    if (out.has(id)) continue;
    const free = BASE_PLOTS.find((p) => !used.has(p.key));
    if (free) {
      used.add(free.key);
      out.set(id, free);
      continue;
    }
    const row = Math.floor(extra / EXTRA_XS.length) + 1;
    out.set(id, { key: `x${extra}`, x: EXTRA_XS[extra % EXTRA_XS.length], y: lastBaseY + row * ROW_GAP, w: 96 });
    extra++;
  }
  const placements = unique.map((id) => ({ id, plot: out.get(id)! }));
  const lowest = Math.max(lastBaseY, ...placements.map((p) => p.plot.y));
  const gateY = lowest + GATE_GAP;
  return { placements, gateY, height: gateY + BOTTOM_PAD };
}

/** CSS position (percent of the map box) for a map point. */
export function toPct(x: number, y: number, height: number): { left: string; top: string } {
  return { left: `${((x / MAP_W) * 100).toFixed(3)}%`, top: `${((y / height) * 100).toFixed(3)}%` };
}
