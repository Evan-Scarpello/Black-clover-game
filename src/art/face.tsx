// Head / face rendering: face shape, ears, eyes, brows, mouth and face extras.
import type { JSX } from 'preact';
import { OUT, THIN, shade, tint, mix, ell } from './core';
import type { Spec, EyeStyle, BrowStyle, MouthStyle } from './types';

type El = JSX.Element;

/** Face silhouette (chibi: wide cheeks, soft small chin). Top at y=14, chin at ~61. */
export const FACE_D =
  'M30.5 35C30.5 47 36 56.8 44 59.6Q50.5 61.8 57 59.6C64.5 56.8 69.5 47 69.5 35C69.5 21 61 14 50 14C39 14 30.5 21 30.5 35Z';
/** Wider-jawed variant for brutes / older men. */
export const FACE_SQUARE_D =
  'M30.5 35C30.5 45 31.6 52.4 36.4 57.4Q43 62.6 50.6 62.6Q58 62.6 64.6 57.4C69.4 52.4 69.5 45 69.5 35C69.5 21 61 14 50 14C39 14 30.5 21 30.5 35Z';
/** Cel-shade region on the right cheek (light from the upper-left); clipped to the face. */
const FACE_SHADE = 'M58 13C64.6 17 66.4 27 66 37C65.6 48 63 55.6 56.4 61.6L80 66L80 10Z';

export function faceD(spec: Spec): string {
  return spec.faceShape === 'square' ? FACE_SQUARE_D : FACE_D;
}

/** Feature anchor points (features are nudged right: the head turns slightly to the viewer's right). */
export const EYE_Y = 42;
export const EYE_L = 41.6;
export const EYE_R = 60.2;
export const MOUTH: [number, number] = [51.6, 53.8];
export const NOSE: [number, number] = [52.6, 48.6];

const RIGHT_EYE_SX = 0.93; // far eye is a touch narrower

export function neck(spec: Spec): El {
  const s = spec.skin;
  const w = spec.build === 'big' || spec.build === 'muscular' ? 6 : spec.build === 'slim' || spec.build === 'girl' || spec.build === 'tiny' ? 4 : 4.8;
  return (
    <g>
      <path d={`M${50 - w} 54L${50 + w} 54L${50 + w} 66L${50 - w} 66Z`} fill={s} />
      <path d={`M${50 - w + 1.2} 57.5Q50 63 ${50 + w - 1.2} 57.5L${50 + w - 1.2} 55L${50 - w + 1.2} 55Z`} fill={shade(s, 0.22)} stroke="none" />
    </g>
  );
}

export function ears(spec: Spec, side: 'back' | 'front'): El | null {
  const s = spec.skin;
  if (spec.ears === 'none') return null;
  if (spec.ears === 'elf') {
    if (side !== 'back') return null;
    return (
      <g>
        <path d="M33 37.5C27 34 21 30 15.5 27.5C18 33 23 41.5 32 47Z" fill={s} />
        <path d="M30 39C26 36.5 22 33.5 19.5 32C22 36.5 25 40.5 30 43.5Z" fill={shade(s, 0.2)} stroke="none" />
        <path d="M67 37.5C73 34 79 30 84.5 27.5C82 33 77 41.5 68 47Z" fill={s} />
        <path d="M70 39C74 36.5 78 33.5 80.5 32C78 36.5 75 40.5 70 43.5Z" fill={shade(s, 0.2)} stroke="none" />
      </g>
    );
  }
  if (side !== 'back') return null;
  return (
    <g>
      <path d={ell(31, 43.5, 3.6, 4.6)} fill={s} />
      <path d="M30.2 41.5Q28.6 43.5 30.4 46" fill="none" stroke={shade(s, 0.35)} stroke-width={THIN} />
      <path d={ell(69.2, 43.5, 3.2, 4.4)} fill={s} />
    </g>
  );
}

/** Face base: fill, cheek shade and the shadow cast by the bangs (clipped to the face). */
export function faceBase(spec: Spec, uid: string, hairFrontD: string | null): El {
  const dark = (spec.face || []).includes('shadow');
  const s = dark ? '#2a1f3d' : spec.skin;
  const sh = dark ? '#1c142a' : shade(spec.skin, 0.2);
  const cid = `${uid}-face`;
  const fd = faceD(spec);
  return (
    <g>
      <clipPath id={cid}>
        <path d={fd} />
      </clipPath>
      <path d={fd} fill={s} stroke="none" />
      <g clip-path={`url(#${cid})`} stroke="none" fill={sh}>
        <path d={FACE_SHADE} />
        {hairFrontD ? <path d={hairFrontD} transform="translate(1.4 2.6)" /> : null}
        {dark ? <path d="M28 14H72V40Q50 30 28 40Z" fill="#120c1c" /> : null}
      </g>
      <path d={fd} fill="none" />
    </g>
  );
}

// ---------------------------------------------------------------- eyes

interface EyeGeom {
  /** lid line (left eye, local coords, outer corner at -x) */
  lid: string;
  /** optional skin cover polygon above the lid (local coords) */
  cover?: string;
  irisRx: number;
  irisRy: number;
  pupil: 'round' | 'slit' | 'small' | 'none';
  lash?: boolean;
  scale?: number;
}

const LID_ROUND = 'M-5.7 -0.4C-5.2 -5.3 -1.8 -7.1 0.9 -6.9C3.5 -6.7 5.2 -4.9 5.5 -2C4.6 -4.5 2.9 -5.4 0.8 -5.5C-1.9 -5.6 -4.1 -4.2 -5.7 -0.4Z';

function eyeGeom(style: EyeStyle, lashes: boolean): EyeGeom {
  switch (style) {
    case 'sharp':
      return {
        lid: 'M-6 -2.6C-4.6 -5.6 -1.4 -6.2 1.6 -5C3.4 -4.2 4.8 -2.8 5.6 -0.6C4.4 -2.3 3 -3.2 1.3 -3.7C-1.6 -4.6 -4.2 -4.4 -6 -2.6Z',
        cover: 'M-7 -9L-6 -2.6C-4.6 -5.6 -1.4 -6.2 1.6 -5C3.4 -4.2 4.8 -2.8 5.6 -0.6L7 -0.6L7 -9Z',
        irisRx: 3.3, irisRy: 4.6, pupil: 'round', lash: lashes,
      };
    case 'fierce':
      return {
        lid: 'M-6.2 -2.2C-4.8 -5 -1.4 -5.6 1.6 -4.2C3.4 -3.4 4.8 -2 5.6 0.2C4.4 -1.5 3 -2.4 1.3 -2.9C-1.6 -3.8 -4.2 -3.8 -6.2 -2.2Z',
        cover: 'M-7 -9L-6.2 -2.2C-4.8 -5 -1.4 -5.6 1.6 -4.2C3.4 -3.4 4.8 -2 5.6 0.2L7 0.2L7 -9Z',
        irisRx: 2.6, irisRy: 3.7, pupil: 'slit', lash: lashes,
      };
    case 'beast':
      return {
        lid: 'M-6.2 -2.4C-4.8 -5 -1.4 -5.4 1.6 -4C3.4 -3.2 4.8 -1.8 5.6 0.4C4.4 -1.3 3 -2.2 1.3 -2.7C-1.6 -3.6 -4.2 -3.8 -6.2 -2.4Z',
        cover: 'M-7 -9L-6.2 -2.4C-4.8 -5 -1.4 -5.4 1.6 -4C3.4 -3.2 4.8 -1.8 5.6 0.4L7 0.4L7 -9Z',
        irisRx: 3.2, irisRy: 4.2, pupil: 'slit', lash: false,
      };
    case 'narrow':
      return {
        lid: 'M-5.9 -0.6C-4 -2.4 -1 -2.6 2 -2.1C3.6 -1.8 4.8 -1.1 5.6 0.2C4.4 -0.4 3.1 -0.7 1.6 -0.9C-1.4 -1.2 -4 -1 -5.9 -0.6Z',
        cover: 'M-7 -9L-5.9 -0.6C-4 -2.4 -1 -2.6 2 -2.1C3.6 -1.8 4.8 -1.1 5.6 0.2L7 0.2L7 -9Z',
        irisRx: 3.3, irisRy: 4.6, pupil: 'round', lash: lashes,
      };
    case 'tired':
      return {
        lid: 'M-5.6 0.4C-4 -1.2 -1 -1.4 2 -1C3.6 -0.8 4.8 -0.2 5.4 0.8C4.4 0.4 3.1 0.2 1.6 0.1C-1.4 -0.1 -4 0 -5.6 0.4Z',
        cover: 'M-7 -9L-5.6 0.4C-4 -1.2 -1 -1.4 2 -1C3.6 -0.8 4.8 -0.2 5.4 0.8L7 0.8L7 -9Z',
        irisRx: 3.2, irisRy: 4.4, pupil: 'round', lash: lashes,
      };
    case 'cold':
      return {
        lid: 'M-5.9 -1.6C-4.4 -4.2 -1.4 -4.8 1.6 -4.2C3.5 -3.8 4.9 -2.8 5.6 -0.8C4.5 -2 3.1 -2.6 1.4 -2.9C-1.5 -3.4 -4 -3.2 -5.9 -1.6Z',
        cover: 'M-7 -9L-5.9 -1.6C-4.4 -4.2 -1.4 -4.8 1.6 -4.2C3.5 -3.8 4.9 -2.8 5.6 -0.8L7 -0.8L7 -9Z',
        irisRx: 3.3, irisRy: 4.6, pupil: 'round', lash: lashes,
      };
    case 'gentle':
      return {
        lid: 'M-5.8 -0.8C-5 -4.8 -1.8 -6 0.9 -5.8C3.5 -5.6 5.1 -4.2 5.5 -1.4C4.6 -3.6 2.9 -4.4 0.8 -4.5C-1.9 -4.6 -4.1 -3.6 -5.8 -0.8Z',
        cover: 'M-7 -9L-5.8 -0.8C-5 -4.8 -1.8 -6 0.9 -5.8C3.5 -5.6 5.1 -4.2 5.5 -1.4L7 -1.4L7 -9Z',
        irisRx: 3.5, irisRy: 4.8, pupil: 'round', lash: true,
      };
    case 'crazy':
      return {
        lid: 'M-6 -1.8C-4.8 -5.6 -1.4 -6.6 1.4 -6C3.6 -5.5 5 -4 5.6 -1.6C4.4 -3.4 3 -4.2 1.2 -4.5C-1.8 -5 -4.2 -4.2 -6 -1.8Z',
        irisRx: 2.3, irisRy: 2.9, pupil: 'small', lash: lashes,
      };
    case 'cute':
      return { lid: LID_ROUND, irisRx: 3.9, irisRy: 5.2, pupil: 'round', lash: true, scale: 1.12 };
    default:
      return { lid: LID_ROUND, irisRx: 3.5, irisRy: 4.9, pupil: 'round', lash: lashes };
  }
}

function oneEye(spec: Spec, cx: number, side: -1 | 1): El {
  const style = spec.eyes.style || 'round';
  const iris = spec.eyes.color;
  const sx = side === 1 ? RIGHT_EYE_SX : 1;
  if (style === 'closed') {
    // happy closed eyes ^ ^
    return (
      <g transform={`translate(${cx} ${EYE_Y + 1}) scale(${sx} 1)`}>
        <path d="M-4.6 1.6Q-0.2 -5.2 4.4 1.4" fill="none" stroke-width={2.2} />
        <path d={side === -1 ? 'M-4.6 1.6L-6 0.6' : 'M4.4 1.4L5.8 0.4'} fill="none" stroke-width={1.6} />
      </g>
    );
  }
  if (style === 'glow') {
    return (
      <g transform={`translate(${cx} ${EYE_Y}) scale(${sx} 1)`} stroke="none">
        <ellipse cx={0} cy={0} rx={4.4} ry={2.6} fill={iris} opacity={0.35} />
        <path d="M-3.6 0.6Q0 -3.4 3.6 -0.4Q0 2.2 -3.6 0.6Z" fill={iris} />
        <ellipse cx={0.3} cy={-0.3} rx={1.3} ry={0.9} fill="#fffbe6" />
      </g>
    );
  }
  const g = eyeGeom(style, !!spec.eyes.lashes);
  const sc = g.scale || 1;
  const ix = 0.6, iy = 0.7;
  const pupilFill = mix(iris, OUT, 0.78);
  const skin = (spec.face || []).includes('pale') ? spec.skin : spec.skin;
  return (
    <g transform={`translate(${cx} ${EYE_Y}) scale(${sx * sc} ${sc})`}>
      {/* sclera */}
      <path d="M-4.9 -0.4C-4.9 -4.6 -2.5 -6 0.2 -6C2.8 -6 4.9 -4.5 4.9 -0.4C4.9 3.6 2.6 5.9 0 5.9C-2.6 5.9 -4.9 3.6 -4.9 -0.4Z" fill="#fff" stroke="none" />
      {/* iris */}
      <ellipse cx={ix} cy={iy} rx={g.irisRx} ry={g.irisRy} fill={iris} stroke-width={0.9} />
      <ellipse cx={ix} cy={iy - g.irisRy * 0.42} rx={g.irisRx * 0.92} ry={g.irisRy * 0.55} fill={shade(iris, 0.38)} stroke="none" />
      <ellipse cx={ix} cy={iy + g.irisRy * 0.62} rx={g.irisRx * 0.6} ry={g.irisRy * 0.24} fill={tint(iris, 0.45)} stroke="none" />
      {g.pupil === 'round' && <ellipse cx={ix + 0.1} cy={iy + 0.3} rx={g.irisRx * 0.48} ry={g.irisRy * 0.52} fill={pupilFill} stroke="none" />}
      {g.pupil === 'slit' && <ellipse cx={ix + 0.1} cy={iy + 0.2} rx={0.65} ry={g.irisRy * 0.75} fill={pupilFill} stroke="none" />}
      {g.pupil === 'small' && <circle cx={ix + 0.1} cy={iy} r={0.9} fill={pupilFill} stroke="none" />}
      {/* highlights (same side on both eyes) */}
      <path d={ell(ix - 1.4 * sx, iy - g.irisRy * 0.42, g.irisRx * 0.42, g.irisRy * 0.36) + ell(ix + 1.5 * sx, iy + g.irisRy * 0.45, g.irisRx * 0.22, g.irisRx * 0.22)} fill="#fff" stroke="none" />
      {g.pupil === 'small' && <circle cx={ix - 0.6} cy={iy - 0.8} r={0.55} fill="#fff" stroke="none" />}
      {/* lids (mirrored for the right eye so the outer corner points outward) */}
      <g transform={side === 1 ? 'scale(-1 1)' : undefined}>
        {g.cover && <path d={g.cover} fill={skin} stroke="none" />}
        <path d={g.lid} fill={OUT} stroke-width={0.6} />
        {g.lash && <path d="M-5.4 -1.6L-7.6 -3.2L-6.6 -0.8Z" fill={OUT} stroke-width={0.6} />}
        <path d="M-3.6 5.6Q-1.6 6.6 0.4 6.4" fill="none" stroke-width={0.9} opacity={0.75} />
      </g>
    </g>
  );
}

export function eyes(spec: Spec): El {
  return (
    <g>
      {oneEye(spec, EYE_L, -1)}
      {oneEye(spec, EYE_R, 1)}
    </g>
  );
}

// ---------------------------------------------------------------- brows

const BROWS: Record<Exclude<BrowStyle, 'none'>, string> = {
  normal: 'M-4.6 -8.4Q-1 -10.2 3.4 -9.2',
  angry: 'M-4.8 -10.6Q-0.6 -9.8 3.8 -7.4',
  thick: 'M-5 -10.8Q-0.6 -10 4 -7.2',
  raised: 'M-4.6 -9.8Q-0.6 -12.2 3.4 -10.8',
  worried: 'M-4.4 -8.2Q0 -8.6 3.6 -11',
  flat: 'M-4.4 -9.4L3.6 -9.4',
};

export function brows(spec: Spec): El | null {
  const st = spec.brows || 'normal';
  if (st === 'none') return null;
  const col = spec.hair.style === 'bald' || spec.hair.style === 'none' ? OUT : mix(spec.hair.shade || shade(spec.hair.color, 0.45), OUT, 0.35);
  const d = BROWS[st];
  const w = st === 'thick' ? 2.6 : 1.9;
  return (
    <g fill="none" stroke={col} stroke-width={w}>
      <path d={d} transform={`translate(${EYE_L} ${EYE_Y})`} />
      <path d={d} transform={`translate(${EYE_R} ${EYE_Y}) scale(${-RIGHT_EYE_SX} 1)`} />
    </g>
  );
}

// ---------------------------------------------------------------- mouth

const MOUTH_RED = '#7a1d2e';
const TONGUE = '#ef7086';

export function mouth(spec: Spec): El | null {
  const st: MouthStyle = spec.mouth || 'smile';
  const [mx, my] = MOUTH;
  const t = `translate(${mx} ${my})`;
  switch (st) {
    case 'none':
      return null;
    case 'smile':
      return <path transform={t} d="M-3.2 -0.8Q0 2.4 3.2 -0.8" fill="none" stroke-width={1.6} />;
    case 'gentle':
      return <path transform={t} d="M-2.3 -0.3Q0 1.6 2.3 -0.3" fill="none" stroke-width={1.4} />;
    case 'flat':
      return <path transform={t} d="M-2.2 0.4Q0 0 2.2 0.3" fill="none" stroke-width={1.5} />;
    case 'frown':
      return <path transform={t} d="M-2.6 1.4Q0 -0.6 2.6 1.4" fill="none" stroke-width={1.5} />;
    case 'pout':
      return <path transform={t} d="M-1.6 0.8Q0 -0.4 1.6 0.8" fill="none" stroke-width={1.4} />;
    case 'cat':
      return <path transform={t} d="M-3.2 -0.6Q-1.6 1.8 0 0Q1.6 1.8 3.2 -0.6" fill="none" stroke-width={1.4} />;
    case 'smirk':
      return (
        <g transform={t} fill="none">
          <path d="M-3 0.4Q0.6 1.8 3.4 -1.6" stroke-width={1.5} />
          <path d="M3 -2.4Q3.9 -1.6 3.7 -0.6" stroke-width={1.1} />
        </g>
      );
    case 'open':
      return (
        <g transform={t} stroke-width={1.3}>
          <ellipse cx={0} cy={0.6} rx={1.8} ry={2.1} fill={MOUTH_RED} />
          <ellipse cx={0} cy={1.7} rx={1} ry={0.6} fill={TONGUE} stroke="none" />
        </g>
      );
    case 'lips':
      return (
        <g transform={t} stroke-width={1}>
          <path d="M-2.8 0Q-1.4 -1.2 0 -0.5Q1.4 -1.2 2.8 0Q0 2.4 -2.8 0Z" fill="#2a1430" />
          <path d="M-1 -0.1Q0 0.3 1 -0.1" fill="none" stroke="#6b4a78" stroke-width={0.6} />
        </g>
      );
    case 'grin':
    case 'fang':
    case 'happy':
    case 'snarl': {
      const wide = st === 'snarl' ? 4.2 : st === 'happy' ? 4.4 : 4.8;
      const outer = st === 'happy'
        ? `M${-wide} -1.2Q0 -0.2 ${wide} -1.2Q${wide - 0.6} 5.4 0 5.6Q${-wide + 0.6} 5.4 ${-wide} -1.2Z`
        : st === 'snarl'
          ? `M${-wide} -0.6Q0 -2 ${wide} -0.6Q${wide - 0.4} 3.4 0 3.6Q${-wide + 0.4} 3.4 ${-wide} -0.6Z`
          : `M${-wide} -1.8Q0 -0.4 ${wide} -1.8Q${wide - 0.6} 4.8 0 5Q${-wide + 0.6} 4.8 ${-wide} -1.8Z`;
      return (
        <g transform={t}>
          <path d={outer} fill={MOUTH_RED} stroke="none" />
          {st !== 'snarl' && <path d="M-2.4 4.4Q0 2.2 2.4 4.4Q0 5.4 -2.4 4.4Z" fill={TONGUE} stroke="none" />}
          {st !== 'happy' && (
            <path d={st === 'snarl'
              ? `M${-wide + 0.4} -0.6Q0 -1.8 ${wide - 0.4} -0.6L${wide - 0.6} 3Q0 3.6 ${-wide + 0.6} 3Z`
              : `M${-wide + 0.3} -1.5Q0 -0.3 ${wide - 0.3} -1.5L${wide - 0.5} 0.5Q0 1.4 ${-wide + 0.5} 0.5Z`} fill="#fff" stroke="none" />
          )}
          {st === 'snarl' && <path d="M-1.6 -1L-1.6 3.4M1.4 -1L1.4 3.4M0 1.2L-4 1.2M0 1.2L4 1.2" stroke-width={0.6} fill="none" />}
          {st === 'fang' && <path d="M-3.6 -1L-2.8 2.2L-2 -0.7ZM3.6 -1L2.8 2.2L2 -0.7Z" fill="#fff" stroke-width={0.6} />}
          <path d={outer} fill="none" stroke-width={1.4} />
        </g>
      );
    }
    case 'wide': {
      const o = 'M-7 -3Q0 2.4 7 -3Q5.6 5.6 0 5.8Q-5.6 5.6 -7 -3Z';
      return (
        <g transform={`translate(${mx - 0.4} ${my})`}>
          <path d={o} fill={MOUTH_RED} stroke="none" />
          <path d="M-6.6 -2.6Q0 2.4 6.6 -2.6L6 0.4Q0 4.4 -6 0.4Z" fill="#fff" stroke="none" />
          <path d="M-3.6 0.4L-3.4 2.6M-1.2 1.5L-1.1 3.4M1.2 1.5L1.1 3.4M3.6 0.4L3.4 2.6M-5.4 -0.8L-5 1.2M5.4 -0.8L5 1.2" stroke-width={0.6} fill="none" />
          <path d={o} fill="none" stroke-width={1.4} />
        </g>
      );
    }
  }
  return null;
}

export function nose(spec: Spec): El | null {
  if ((spec.face || []).some((f) => f === 'clothMask' || f === 'scarf' || f === 'shadow')) return null;
  return <path d={`M${NOSE[0]} ${NOSE[1] - 0.8}Q${NOSE[0] + 1.1} ${NOSE[1] + 0.6} ${NOSE[0] - 0.1} ${NOSE[1] + 1}`} fill="none" stroke={shade(spec.skin, 0.55)} stroke-width={1.1} />;
}

export function blush(spec: Spec): El | null {
  if (!spec.blush) return null;
  return (
    <g stroke="none">
      <ellipse cx={EYE_L - 1.2} cy={EYE_Y + 7.2} rx={4} ry={2} fill="#ff7a9c" opacity={0.5} />
      <ellipse cx={EYE_R + 1} cy={EYE_Y + 7.2} rx={3.6} ry={2} fill="#ff7a9c" opacity={0.5} />
      <path d={`M${EYE_L - 3} ${EYE_Y + 8}l1.2 -2M${EYE_L - 1} ${EYE_Y + 8}l1.2 -2M${EYE_L + 1} ${EYE_Y + 8}l1.2 -2M${EYE_R - 1} ${EYE_Y + 8}l1.2 -2M${EYE_R + 1} ${EYE_Y + 8}l1.2 -2`} stroke="#e0476e" stroke-width={0.8} fill="none" />
    </g>
  );
}

// ---------------------------------------------------------------- face extras

/** Extras drawn under the eyes (skin marks). */
export function faceMarks(spec: Spec): El | null {
  const f = spec.face || [];
  if (!f.length) return null;
  const out: El[] = [];
  if (f.includes('stubble')) {
    out.push(
      <g key="stub" stroke="none">
        <path d="M39 51.5Q41 58.5 47 60.3Q51.5 61.4 56 60.2Q62.5 58.6 64.6 51.5Q61 56.8 56.5 57.6Q51.5 58.6 47 57.6Q41.6 56.6 39 51.5Z" fill={mix(spec.skin, '#3a2a3a', 0.28)} />
      </g>,
    );
  }
  if (f.includes('darkCircles')) {
    out.push(
      <g key="dc" fill="none" stroke="#7b5a8e" stroke-width={1} opacity={0.8}>
        <path d={`M${EYE_L - 4} ${EYE_Y + 7}Q${EYE_L} ${EYE_Y + 9} ${EYE_L + 4} ${EYE_Y + 6.6}`} />
        <path d={`M${EYE_R - 4} ${EYE_Y + 6.6}Q${EYE_R} ${EYE_Y + 9} ${EYE_R + 3.6} ${EYE_Y + 7}`} />
      </g>,
    );
  }
  if (f.includes('curseMarks')) {
    out.push(
      <g key="curse" fill="none" stroke={spec.skin < '#8' ? '#ff4a3a' : '#7a2f9a'} stroke-width={1.1}>
        <path d="M34 47Q37 50 36 54M36.2 50.8L39 51.6" />
        <path d="M67 47Q64.4 50 65.4 54M65.2 50.8L62.6 51.6" />
        <path d="M51 16.5L51 21M48.6 19L53.4 19" />
      </g>,
    );
  }
  if (f.includes('tattoo')) {
    out.push(
      <g key="tat" fill="#2b2650" stroke="none">
        <path d="M33 37L38 36.4L35.4 39.4ZM33.6 41L37.8 40.6L35.6 43.4Z" />
        <path d="M67.4 37L62.6 36.4L65 39.4ZM66.8 41L62.8 40.6L64.8 43.4Z" />
        <path d="M46 16L50 22L54.4 16L50 18.6Z" />
      </g>,
    );
  }
  if (f.includes('freckles')) {
    out.push(
      <g key="fr" fill={shade(spec.skin, 0.35)} stroke="none">
        <circle cx={38} cy={50} r={0.6} /><circle cx={40} cy={51} r={0.6} /><circle cx={39.4} cy={49} r={0.5} />
        <circle cx={63} cy={50} r={0.6} /><circle cx={65} cy={49.4} r={0.5} />
      </g>,
    );
  }
  return out.length ? <g>{out}</g> : null;
}

/** Extras drawn over the eyes (masks, glasses, scars...). */
export function faceGear(spec: Spec): El | null {
  const f = spec.face || [];
  if (!f.length) return null;
  const out: El[] = [];
  if (f.includes('scar')) {
    out.push(
      <g key="scar" fill="none" stroke="#b5464f" stroke-width={1.1}>
        <path d="M45 37L58 51" />
        <path d="M48 39.4L49.6 38.2M51 42.6L52.6 41.4M54 45.8L55.6 44.6" stroke-width={0.8} />
      </g>,
    );
  }
  if (f.includes('scarCheek')) {
    out.push(
      <g key="scarc" fill="none" stroke="#a8404c" stroke-width={1}>
        <path d="M62 47L66.5 53.5M63 51.6L65.6 49.6" />
      </g>,
    );
  }
  if (f.includes('nosebleed')) {
    out.push(
      <path key="nb" d={`M${NOSE[0] - 0.6} ${NOSE[1] + 1}Q${NOSE[0] - 1.6} ${NOSE[1] + 3} ${NOSE[0] - 1} ${NOSE[1] + 4.6}Q${NOSE[0]} ${NOSE[1] + 3.2} ${NOSE[0] + 0.4} ${NOSE[1] + 1.2}Z`} fill="#e3263b" stroke-width={0.7} />,
    );
  }
  if (f.includes('eyeliner')) {
    out.push(
      <g key="el" fill="#2b1a3a" stroke="none" opacity={0.85}>
        <path d={`M${EYE_L - 6} ${EYE_Y}Q${EYE_L} ${EYE_Y + 10} ${EYE_L + 5.6} ${EYE_Y + 1}Q${EYE_L} ${EYE_Y + 7.4} ${EYE_L - 6} ${EYE_Y}Z`} />
        <path d={`M${EYE_R + 5.6} ${EYE_Y}Q${EYE_R} ${EYE_Y + 10} ${EYE_R - 5.4} ${EYE_Y + 1}Q${EYE_R} ${EYE_Y + 7.4} ${EYE_R + 5.6} ${EYE_Y}Z`} />
      </g>,
    );
  }
  if (f.includes('eyepatch')) {
    out.push(
      <g key="ep">
        <path d="M31 30.5L70 24" fill="none" stroke="#2a2030" stroke-width={1.6} />
        <path d={`M${EYE_L - 6} ${EYE_Y - 4}Q${EYE_L} ${EYE_Y - 7.4} ${EYE_L + 6} ${EYE_Y - 4.6}Q${EYE_L + 6.4} ${EYE_Y + 4} ${EYE_L} ${EYE_Y + 6.4}Q${EYE_L - 6.4} ${EYE_Y + 4} ${EYE_L - 6} ${EYE_Y - 4}Z`} fill="#1f1826" stroke-width={1.6} />
        <path d={`M${EYE_L - 3.4} ${EYE_Y - 3.6}Q${EYE_L} ${EYE_Y - 5} ${EYE_L + 3} ${EYE_Y - 3.8}`} fill="none" stroke="#4a3d55" stroke-width={1} />
      </g>,
    );
  }
  if (f.includes('mask')) {
    // William: ornate white mask over the upper-left of the face
    out.push(
      <g key="mask">
        <path d="M30.6 33C31 22 38 15.6 47 15C49.4 21 51.2 27 50.8 36C50.6 42 49 48 46.4 51.4C42 50.6 37.4 49.4 34 47.6C31.6 43.6 30.4 38.6 30.6 33Z" fill="#f6f1e4" stroke-width={1.8} />
        <path d="M33.6 46.2C37 47.6 41.6 48.8 45.4 49.4" fill="none" stroke="#d6a53a" stroke-width={1.2} />
        <path d="M46.2 17.6C48 23 49 28.4 48.8 34" fill="none" stroke="#d6a53a" stroke-width={1.2} />
        <path d={`M${EYE_L - 4.6} ${EYE_Y - 0.6}Q${EYE_L} ${EYE_Y - 4.6} ${EYE_L + 4.4} ${EYE_Y - 0.8}Q${EYE_L} ${EYE_Y + 2.4} ${EYE_L - 4.6} ${EYE_Y - 0.6}Z`} fill="#2a1c3a" stroke-width={1.2} />
        <circle cx={EYE_L + 0.6} cy={EYE_Y - 0.9} r={1.1} fill={spec.eyes.color} stroke="none" />
        <path d="M36 25Q40 22 44 24" fill="none" stroke="#d6a53a" stroke-width={1} />
      </g>,
    );
  }
  if (f.includes('boneMask')) {
    // Zenon: bone plate over the viewer's right half
    out.push(
      <g key="bone">
        <path d="M52.4 16.6C60.6 16 68.4 22 69.6 32C70.4 40 69 48 64.6 54.4C61 53.2 57.4 51.8 54.6 49.6C53.2 44 52.6 38 52.8 31C52.8 26 52.4 21 52.4 16.6Z" fill="#ece4d0" stroke-width={1.8} />
        <path d={`M${EYE_R - 3.8} ${EYE_Y - 2}Q${EYE_R + 0.4} ${EYE_Y - 5} ${EYE_R + 4} ${EYE_Y - 1.4}Q${EYE_R + 0.2} ${EYE_Y + 2.6} ${EYE_R - 3.8} ${EYE_Y - 2}Z`} fill="#1d1428" stroke-width={1.2} />
        <circle cx={EYE_R + 0.2} cy={EYE_Y - 1.4} r={1} fill="#e8d36a" stroke="none" />
        <path d="M56 22L60 25M58 47L62.4 48.6M66.4 30L68.4 33" fill="none" stroke="#b9ae94" stroke-width={1} />
        <path d="M56 53L57.4 57.2L59.4 53.8M61 53.6L62.4 57.6L63.8 53.6" fill="#ece4d0" stroke-width={1.1} />
      </g>,
    );
  }
  if (f.includes('glasses')) {
    out.push(
      <g key="gl" fill="none" stroke="#3a2c4a" stroke-width={1.3}>
        <rect x={EYE_L - 6} y={EYE_Y - 4.6} width={12} height={9} rx={2} fill="#bfe3ff" fill-opacity={0.25} />
        <rect x={EYE_R - 5.6} y={EYE_Y - 4.6} width={11.2} height={9} rx={2} fill="#bfe3ff" fill-opacity={0.25} />
        <path d={`M${EYE_L + 6} ${EYE_Y - 1.6}Q${(EYE_L + EYE_R) / 2} ${EYE_Y - 3.4} ${EYE_R - 5.6} ${EYE_Y - 1.6}M${EYE_L - 6} ${EYE_Y - 2}L31 ${EYE_Y - 3}M${EYE_R + 5.6} ${EYE_Y - 2}L69.4 ${EYE_Y - 3}`} />
        <path d={`M${EYE_L - 3.6} ${EYE_Y + 2.6}L${EYE_L - 0.6} ${EYE_Y - 2.4}M${EYE_R - 3} ${EYE_Y + 2.6}L${EYE_R} ${EYE_Y - 2.4}`} stroke="#fff" stroke-width={0.9} opacity={0.8} />
      </g>,
    );
  }
  if (f.includes('sunglasses')) {
    out.push(
      <g key="sg">
        <path d={`M${EYE_L - 6.4} ${EYE_Y - 4}Q${EYE_L} ${EYE_Y - 5.4} ${EYE_L + 5.8} ${EYE_Y - 3.8}Q${EYE_L + 5.6} ${EYE_Y + 3.6} ${EYE_L} ${EYE_Y + 3.8}Q${EYE_L - 6} ${EYE_Y + 3.4} ${EYE_L - 6.4} ${EYE_Y - 4}Z`} fill="#24182f" stroke-width={1.5} />
        <path d={`M${EYE_R - 5.4} ${EYE_Y - 3.8}Q${EYE_R} ${EYE_Y - 5.4} ${EYE_R + 5.8} ${EYE_Y - 4}Q${EYE_R + 5.4} ${EYE_Y + 3.4} ${EYE_R} ${EYE_Y + 3.8}Q${EYE_R - 5.2} ${EYE_Y + 3.6} ${EYE_R - 5.4} ${EYE_Y - 3.8}Z`} fill="#24182f" stroke-width={1.5} />
        <path d={`M${EYE_L + 5.8} ${EYE_Y - 3}Q${(EYE_L + EYE_R) / 2} ${EYE_Y - 4.6} ${EYE_R - 5.4} ${EYE_Y - 3}`} fill="none" stroke-width={1.5} />
        <path d={`M${EYE_L - 3.6} ${EYE_Y - 2}L${EYE_L - 1.6} ${EYE_Y - 2.8}M${EYE_R - 2.6} ${EYE_Y - 2}L${EYE_R - 0.6} ${EYE_Y - 2.8}`} fill="none" stroke="#9fd8ff" stroke-width={1.2} />
      </g>,
    );
  }
  if (f.includes('clothMask') || f.includes('scarf')) {
    const col = f.includes('scarf') ? '#2c2a3c' : '#6b4a3a';
    out.push(
      <g key="cm">
        <path d="M31.6 44.6Q51 50 69 44.6C68.4 51 64 57.4 57.4 60.2Q51 62.6 44.4 60.4C37.6 57.8 32.6 51.6 31.6 44.6Z" fill={col} stroke-width={1.8} />
        <path d="M40 50.6Q51 54.6 61.4 50.4M43.6 56Q51 58.6 58.6 55.6" fill="none" stroke={shade(col, 0.4)} stroke-width={1} />
      </g>,
    );
  }
  if (f.includes('cigarette')) {
    out.push(
      <g key="cig">
        <path d={`M${MOUTH[0] + 3} ${MOUTH[1] + 0.2}L${MOUTH[0] + 10.6} ${MOUTH[1] + 2.4}`} stroke-width={3.6} fill="none" />
        <path d={`M${MOUTH[0] + 3} ${MOUTH[1] + 0.2}L${MOUTH[0] + 10.6} ${MOUTH[1] + 2.4}`} stroke="#f4efe6" stroke-width={1.8} fill="none" />
        <path d={`M${MOUTH[0] + 3.4} ${MOUTH[1] + 0.3}L${MOUTH[0] + 5.4} ${MOUTH[1] + 0.9}`} stroke="#d99a4a" stroke-width={1.8} fill="none" />
        <circle cx={MOUTH[0] + 11} cy={MOUTH[1] + 2.5} r={1.2} fill="#ff6a2a" stroke="none" />
        <path d={`M${MOUTH[0] + 11.4} ${MOUTH[1] + 0.6}Q${MOUTH[0] + 13.6} ${MOUTH[1] - 3} ${MOUTH[0] + 11.6} ${MOUTH[1] - 5.4}Q${MOUTH[0] + 9.8} ${MOUTH[1] - 8} ${MOUTH[0] + 12.4} ${MOUTH[1] - 10.6}`} stroke="#d8d2e6" stroke-width={1.2} fill="none" opacity={0.7} />
      </g>,
    );
  }
  return out.length ? <g>{out}</g> : null;
}
