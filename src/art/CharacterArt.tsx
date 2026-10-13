// Public entry point of the character art system.
//
//   <CharacterArt id="asta" mode="full" />      whole chibi body, viewBox 0 0 100 120
//   <CharacterArt id="yuno" mode="portrait" />  square head + shoulders crop
//
// Everything is inline SVG built from a parametric spec per character
// (see specs.ts) plus a few bespoke monster renderers (monsters.tsx).
import type { JSX } from 'preact';
import { useMemo } from 'preact/hooks';
import { OUT, SW } from './core';
import { SPECS } from './specs';
import type { Spec } from './types';
import { MONSTERS, devilWings, gravityAura, bigHorns } from './monsters';
import { hair } from './hair';
import { neck, ears, faceBase, eyes, brows, mouth, nose, blush, faceMarks, faceGear } from './face';
import { legs, torso, arm, hand, capeBack, hoodBack, hoodFront, HOOD_RIM, mantle, pauldrons } from './body';
import { grimoire, weapon, weaponLayer, headUnder, headBack, headOver, fxBack, fxFront } from './props';

export type ArtMode = 'full' | 'portrait';

export interface CharacterArtProps {
  id: string;
  mode?: ArtMode;
  class?: string;
  style?: any;
  flip?: boolean;
  /** Soft ground shadow under the feet in full mode (default true). */
  shadow?: boolean;
}

/** Every id the art system can draw. */
export const ART_IDS: string[] = [
  'asta', 'yuno', 'yami', 'julius', 'lucius', 'noelle', 'mereoleona', 'fuegoleon', 'nozel', 'charlotte',
  'william', 'dante', 'vanica', 'licht', 'finral', 'luck', 'vanessa', 'gauche', 'mimosa', 'langris',
  'henry', 'zenon', 'fana', 'vetto', 'megicula', 'magna', 'charmy', 'gordon', 'klaus', 'sol', 'leopold',
  'valtos', 'sally',
  'nacht', 'lumiere', 'liebe', 'zagred', 'secre', 'jack', 'dorothy', 'rill', 'patri', 'damnatio',
  'bandit', 'bandit_mage', 'magic_beast', 'golem', 'diamond_mage', 'acolyte', 'spade_soldier', 'imp',
  'revchi', 'mars', 'lucifero',
];

/** Signature colour per id (aura glow, card accents, damage numbers...). */
export const ART_AURA: Record<string, string> = Object.fromEntries(
  ART_IDS.map((id) => [id, MONSTERS[id]?.aura || SPECS[id]?.aura || '#8a8098']),
);

/** True if the id has dedicated art (otherwise the hooded fallback is drawn). */
export function hasArt(id: string): boolean {
  return !!(MONSTERS[id] || SPECS[id]);
}

const FEET_Y = 117.6;
const DEFAULT_PORTRAIT: [number, number, number, number] = [15, 2.5, 70, 70];

let seq = 0;

function humanoid(spec: Spec, uid: string, groundShadow: boolean): JSX.Element {
  const hp = hair(spec, uid);
  const hoodUp = spec.cape?.style === 'hoodUp';
  const shadowD = hoodUp ? HOOD_RIM : hp.frontD;
  const wl = weaponLayer(spec);
  const fx = spec.fx || [];
  const head = spec.head || [];
  const s = spec.scale || 1;
  const hs = spec.headScale || 1;
  // head layers scale about the neck so brutes can get a relatively smaller head
  const H = (el: JSX.Element | null) =>
    el && hs !== 1 ? <g transform={`translate(50 60) scale(${hs}) translate(-50 -60)`}>{el}</g> : el;
  return (
    <g transform={s !== 1 ? `translate(50 ${FEET_Y}) scale(${s}) translate(-50 ${-FEET_Y})` : undefined}>
      {groundShadow ? <ellipse cx={50} cy={FEET_Y - 0.6} rx={22} ry={3.2} fill="#000" opacity={0.22} stroke="none" /> : null}
      {fx.includes('gravityAura') ? gravityAura() : null}
      {fx.includes('devilWings') ? devilWings() : null}
      {fxBack(spec)}
      {capeBack(spec)}
      {H(
        <g>
          {headBack(spec)}
          {hp.back}
        </g>,
      )}
      {hoodBack(spec)}
      {wl === 'back' ? weapon(spec) : null}
      {legs(spec)}
      {neck(spec)}
      {torso(spec, uid)}
      {arm(spec, -1)}
      {arm(spec, 1)}
      {pauldrons(spec)}
      {mantle(spec)}
      {wl === 'front' ? weapon(spec) : null}
      {H(
        <g>
          {ears(spec, 'back')}
          {faceBase(spec, uid, shadowD)}
          {faceMarks(spec)}
          {eyes(spec)}
          {brows(spec)}
          {nose(spec)}
          {mouth(spec)}
          {blush(spec)}
          {faceGear(spec)}
          {headUnder(spec)}
          {hp.front}
          {hoodFront(spec)}
          {head.includes('bigHorns') ? bigHorns() : null}
          {headOver(spec)}
        </g>,
      )}
      {hand(spec, -1)}
      {hand(spec, 1)}
      {grimoire(spec)}
      {fxFront(spec)}
    </g>
  );
}

function portraitBox(spec: Spec | null, monsterBox?: [number, number, number, number]): string {
  if (monsterBox) return monsterBox.join(' ');
  const [x, y, w, h] = spec?.portrait || DEFAULT_PORTRAIT;
  const s = spec?.scale || 1;
  // follow the scaled figure so every portrait frames the face the same way
  const nx = 50 + (x - 50) * s;
  const ny = FEET_Y + (y - FEET_Y) * s;
  const r = (n: number) => Math.round(n * 100) / 100;
  return `${r(nx)} ${r(ny)} ${r(w * s)} ${r(h * s)}`;
}

export function CharacterArt(props: CharacterArtProps): JSX.Element {
  const { id, mode = 'full', flip = false } = props;
  const full = mode !== 'portrait';
  const groundShadow = full && props.shadow !== false;
  const uid = useMemo(() => `ca${(++seq).toString(36)}`, []);
  // The drawing only depends on these inputs. Returning the same vnode lets
  // Preact skip diffing the whole subtree when a parent re-renders (e.g. every
  // animation frame while class/style change).
  const art = useMemo(() => {
    const monster = MONSTERS[id];
    const spec = monster ? null : SPECS[id] || SPECS.__unknown;
    const body = monster ? monster.draw(uid) : humanoid(spec!, uid, groundShadow);
    return {
      viewBox: full ? '0 0 100 120' : portraitBox(spec, monster?.portrait),
      g: (
        <g
          transform={flip ? 'translate(100 0) scale(-1 1)' : undefined}
          stroke={OUT}
          stroke-width={SW}
          stroke-linejoin="round"
          stroke-linecap="round"
        >
          {body}
        </g>
      ),
    };
  }, [id, full, flip, groundShadow, uid]);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={art.viewBox}
      width="100%"
      height="100%"
      preserveAspectRatio={full ? 'xMidYMax meet' : 'xMidYMid slice'}
      class={props.class}
      style={props.style}
      role="img"
      aria-label={id}
    >
      {art.g}
    </svg>
  );
}

export default CharacterArt;
