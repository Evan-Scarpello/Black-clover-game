// Bespoke monster renderers (non-humanoid enemies).
import type { JSX } from 'preact';
import { OUT, spline, shade, tint, sparkle } from './core';

type El = JSX.Element;

export interface Monster {
  draw: (uid: string) => El;
  /** portrait crop [x, y, w, h] */
  portrait: [number, number, number, number];
  aura: string;
}

// ---------------------------------------------------------------- magic beast (wolf)

const FUR = '#5c4cb0';
const FUR_D = '#3b2e80';
const FUR_L = '#9c8ce2';
const GLOW = '#7ff0ff';

function beast(uid: string): El {
  const bodyD = spline([
    [20, 80], [21, 69], [27, 62], [31, 55.4, 1], [35.4, 60], [40.4, 53.6, 1], [44.6, 59], [50, 53, 1], [53.6, 59.4],
    [62, 61], [71, 64], [77, 74], [75, 86], [66, 92.6], [50, 93.6], [34, 92.6], [24, 88],
  ]);
  const headD = spline([
    [62, 63], [59, 52], [62, 42], [70, 36], [80, 36.4], [87, 41], [92, 48], [98.6, 53, 1], [99, 58.4],
    [96, 62.4, 1], [88, 66.4], [80, 70], [70, 71],
  ]);
  const cid = `${uid}-bb`;
  return (
    <g transform="translate(50 117.6) scale(0.94) translate(-51 -117.6)">
      <ellipse cx={52} cy={116.6} rx={40} ry={3.6} fill="#000" opacity={0.22} stroke="none" />
      {/* tail */}
      <path d={spline([[25, 75], [13, 71], [6, 61], [3, 47, 1], [9.6, 52.6], [9.4, 42, 1], [15.4, 52], [19.6, 60.4], [27, 67]])} fill={FUR_D} />
      <path d="M9 52Q12 60 18 64" fill="none" stroke={GLOW} stroke-width={1.2} opacity={0.9} />
      {/* far legs */}
      <path d={spline([[29, 84], [28, 104], [26, 116.4, 1], [34, 116.4, 1], [34.6, 104], [37, 88]])} fill={FUR_D} />
      <path d={spline([[60, 86], [61, 104], [59, 116.4, 1], [67.4, 116.4, 1], [67.4, 104], [69, 86]])} fill={FUR_D} />
      {/* body */}
      <clipPath id={cid}><path d={bodyD} /></clipPath>
      <path d={bodyD} fill={FUR} stroke="none" />
      <g clip-path={`url(#${cid})`} stroke="none">
        <path d="M14 86Q50 78 84 84L84 100L14 100Z" fill={FUR_L} />
        <path d="M14 66Q30 60 44 66Q36 70 30 80Z" fill={FUR_D} opacity={0.5} />
      </g>
      <path d={bodyD} fill="none" />
      <path d="M44 66Q48 70 46 76M52 64Q57 69 55 76" fill="none" stroke={GLOW} stroke-width={1.3} />
      {/* near legs */}
      <path d={spline([[25, 76], [36, 73], [42.4, 84], [40.6, 100], [42, 116.4, 1], [30, 116.4, 1], [32.4, 104], [29.4, 92]])} fill={FUR} />
      <path d="M33 82Q37 88 35 96" fill="none" stroke={GLOW} stroke-width={1.3} />
      <path d={spline([[61, 78], [72.6, 77], [75.4, 90], [73.6, 104], [77, 116.4, 1], [64, 116.4, 1], [66, 104], [63.4, 90]])} fill={FUR} />
      <path d="M34 116.4L34.6 113M38 116.4L38.4 113M68 116.4L68.6 113M72 116.4L72.4 113" fill="none" stroke-width={1.2} />
      {/* neck ruff */}
      <path d={spline([[58, 72, 1], [55.6, 64], [52.6, 56, 1], [58.6, 57], [57.4, 48, 1], [64, 52], [66, 44, 1], [70, 56], [72, 74]])} fill={FUR_L} />
      {/* ears */}
      <path d="M63 46L60.4 26L71.4 38Z" fill={FUR_D} />
      <path d="M71 40L75.6 21L83 39.4Z" fill={FUR} />
      <path d="M73.6 37L76 26.6L80 37.6Z" fill="#c66ad8" stroke="none" />
      {/* head */}
      <path d={headD} fill={FUR} />
      <path d="M80 62Q88 63 96 61.4L92 66Q86 67 80 66Z" fill={FUR_L} stroke="none" />
      <path d="M80.4 61.4Q88.6 62.4 96.6 60.6" fill="none" stroke-width={1.6} />
      <path d="M85 61.6L86.4 65L87.6 61.8ZM90.4 61.4L91.6 64.4L92.8 61Z" fill="#fff" stroke-width={0.8} />
      <ellipse cx={98} cy={54.4} rx={2.4} ry={1.8} fill={OUT} stroke="none" />
      <circle cx={97.4} cy={53.8} r={0.6} fill="#fff" stroke="none" />
      {/* eye */}
      <path d="M74 48.6Q80 43.6 86 47.4Q80 52 74 48.6Z" fill={GLOW} stroke-width={1.2} />
      <ellipse cx={80.6} cy={48} rx={0.9} ry={2.2} fill="#123040" stroke="none" />
      <circle cx={79} cy={47} r={0.8} fill="#fff" stroke="none" />
      <path d="M72.6 44.6L86.6 43" fill="none" stroke-width={2} />
      <path d="M66 54Q70 58 68 64M86 39Q90 42 91 47" fill="none" stroke={GLOW} stroke-width={1.2} />
      <path d={sparkle(91, 30, 2.4)} fill={GLOW} stroke="none" />
    </g>
  );
}

// ---------------------------------------------------------------- golem

const STONE = '#948ca2';
const STONE_D = '#655d76';
const MOSS = '#72b04a';
const MOSS_D = '#4b8a34';
const RUNE = '#5ef0ff';

function golem(uid: string): El {
  const body = spline([[19, 60], [25, 45], [39, 36.6], [61, 35.6], [75, 42], [82, 57], [80.4, 78], [70, 93], [50, 97.6], [30, 93.6], [20, 80]]);
  const cid = `${uid}-gb`;
  const armUpper = (m: boolean) => (
    <path d={spline([[24, 46], [12, 50.6], [7.4, 64], [11, 74.4], [22, 71], [28.6, 58]])} fill={STONE} transform={m ? 'translate(100 0) scale(-1 1)' : undefined} />
  );
  const fist = (m: boolean) => (
    <g transform={m ? 'translate(100 0) scale(-1 1)' : undefined}>
      <path d={spline([[3.6, 86], [8, 75.6], [20.6, 74], [26.6, 86], [23, 102], [12, 106], [4, 99]])} fill={STONE} />
      <path d="M8 98Q14 101 20 98M7 90Q11 92 14 90" fill="none" stroke-width={1.3} />
      <path d={spline([[7, 78], [13, 74.6], [21, 76], [16, 79.4], [10, 80.4]])} fill={MOSS} stroke-width={1.6} />
    </g>
  );
  return (
    <g>
      <ellipse cx={50} cy={116.6} rx={40} ry={3.8} fill="#000" opacity={0.22} stroke="none" />
      {/* legs */}
      <path d="M34 90L47 90L47.6 110L33 110Z" fill={STONE_D} />
      <path d="M53 90L66 90L67 110L52.4 110Z" fill={STONE_D} />
      <path d="M29.6 108L49 108L49.6 117.4L28.6 117.4Z" fill={STONE} />
      <path d="M51 108L70.4 108L71.4 117.4L50.4 117.4Z" fill={STONE} />
      {armUpper(false)}
      {armUpper(true)}
      {/* body */}
      <clipPath id={cid}><path d={body} /></clipPath>
      <path d={body} fill={STONE} stroke="none" />
      <g clip-path={`url(#${cid})`} stroke="none">
        <path d="M66 30Q86 60 64 100L100 100L100 30Z" fill={STONE_D} />
        <path d="M14 84Q50 100 86 84L86 104L14 104Z" fill={STONE_D} opacity={0.6} />
        <circle cx={50} cy={66} r={13} fill={RUNE} opacity={0.18} />
      </g>
      <path d={body} fill="none" />
      <path d="M28 70L34 76L32 84M70 58L76 62M66 84L72 80L74 86M36 46L40 52" fill="none" stroke={shade(STONE_D, 0.4)} stroke-width={1.3} />
      {/* moss on top */}
      <path d={spline([[24, 47], [32, 39.6], [44, 36], [58, 35.6], [70, 39], [77, 46], [71, 47.4], [69.6, 51, 1], [66, 46.6], [58, 45.4], [56, 50, 1], [52.4, 45], [42, 45.4], [39.6, 49.6, 1], [37, 45.4], [30, 47.4], [27.6, 50.6, 1]])} fill={MOSS} />
      <path d="M32 42Q44 37 58 37.6" fill="none" stroke={tint(MOSS, 0.4)} stroke-width={1.4} />
      {/* rune */}
      <circle cx={50} cy={66} r={7.6} fill="#2a3a4a" stroke-width={2} />
      <circle cx={50} cy={66} r={5.6} fill="none" stroke={RUNE} stroke-width={1.4} />
      <path d="M50 61.4L50 70.6M46.4 64L53.6 68M53.6 64L46.4 68" fill="none" stroke={RUNE} stroke-width={1.3} />
      {/* head */}
      <path d={spline([[39, 42], [37.6, 28], [43, 19], [57, 18.4], [63, 27], [61.6, 41], [50, 44]])} fill={STONE} />
      <path d={spline([[40, 25], [45, 18.6], [56, 18], [61.4, 24], [56, 23.6], [50, 25], [44, 24]])} fill={MOSS_D} stroke-width={1.8} />
      <path d="M41 30.6L59 30.6L58 35.6L42 35.6Z" fill="#2a2636" stroke-width={1.6} />
      <rect x={43.6} y={31.8} width={4.4} height={2.6} rx={1} fill={RUNE} stroke="none" />
      <rect x={52} y={31.8} width={4.4} height={2.6} rx={1} fill={RUNE} stroke="none" />
      <path d="M44 39.6L56 39.6" fill="none" stroke-width={1.3} />
      {fist(false)}
      {fist(true)}
      <path d={sparkle(86, 26, 2.2)} fill={RUNE} stroke="none" />
    </g>
  );
}

// ---------------------------------------------------------------- imp

const IMP = '#d24a6c';
const IMP_D = '#9e2a52';
const WING = '#3e1a44';

function imp(uid: string): El {
  const head = 'M32 46C32 33 40 26 50 26C60 26 68 33 68 46C68 58 60 64 50 64C40 64 32 58 32 46Z';
  const cid = `${uid}-ih`;
  const wing = spline([[42, 62], [32, 44], [16, 30, 1], [17.6, 42], [6.6, 44.6, 1], [14.4, 52], [8, 62, 1], [20, 60.6], [22, 72, 1], [30, 66]]);
  return (
    <g>
      <ellipse cx={50} cy={116} rx={16} ry={3} fill="#000" opacity={0.2} stroke="none" />
      {/* wings */}
      <path d={wing} fill={WING} />
      <path d={wing} fill={WING} transform="translate(100 0) scale(-1 1)" />
      <path d="M40 60L16 30M38 58L8 46M36 60L9 61.6M34 62L21.6 71" fill="none" stroke="#6a3a74" stroke-width={1.1} />
      <path d="M60 60L84 30M62 58L92 46M64 60L91 61.6M66 62L78.4 71" fill="none" stroke="#6a3a74" stroke-width={1.1} />
      {/* tail */}
      <path d="M54 82Q66 96 76 86Q84 78 80 70" fill="none" stroke={OUT} stroke-width={5.6} />
      <path d="M54 82Q66 96 76 86Q84 78 80 70" fill="none" stroke={IMP_D} stroke-width={3} />
      <path d="M80 64L85.6 71L80.6 70.4L76.6 73.6Z" fill={IMP_D} stroke-width={1.6} />
      {/* legs */}
      <path d="M45 82L43 92L39 94.6" fill="none" stroke={OUT} stroke-width={6} />
      <path d="M45 82L43 92L39 94.6" fill="none" stroke={IMP} stroke-width={3.2} />
      <path d="M55 82L57 92L61 94.6" fill="none" stroke={OUT} stroke-width={6} />
      <path d="M55 82L57 92L61 94.6" fill="none" stroke={IMP} stroke-width={3.2} />
      {/* body */}
      <path d={spline([[41, 70], [44, 63], [56, 63], [59, 70], [58, 82], [50, 86], [42, 82]])} fill={IMP} />
      <path d={spline([[45.6, 70], [50, 67], [54.4, 70], [54, 79], [50, 82], [46, 79]])} fill="#f08aa2" stroke="none" />
      {/* arms */}
      <path d="M42 68L34 74L31 70" fill="none" stroke={OUT} stroke-width={5.8} />
      <path d="M42 68L34 74L31 70" fill="none" stroke={IMP} stroke-width={3} />
      <path d="M58 68L66 72L70 66" fill="none" stroke={OUT} stroke-width={5.8} />
      <path d="M58 68L66 72L70 66" fill="none" stroke={IMP} stroke-width={3} />
      <circle cx={70.6} cy={62.6} r={4.2} fill="#a46cff" opacity={0.35} stroke="none" />
      <circle cx={70.6} cy={62.6} r={2.6} fill="#c49aff" stroke-width={1.2} />
      {/* horns + ears */}
      <path d="M37 34Q28 26 30 14Q34 24 43 28Z" fill="#3a2236" />
      <path d="M63 34Q72 26 70 14Q66 24 57 28Z" fill="#3a2236" />
      <path d="M32 18Q32.6 22 35 25M68 18Q67.4 22 65 25" fill="none" stroke="#7a5a8a" stroke-width={1} />
      <path d="M33 44L22 38L32.6 52Z" fill={IMP} />
      <path d="M67 44L78 38L67.4 52Z" fill={IMP} />
      {/* head */}
      <clipPath id={cid}><path d={head} /></clipPath>
      <path d={head} fill={IMP} stroke="none" />
      <g clip-path={`url(#${cid})`} stroke="none">
        <path d="M58 26Q72 40 60 66L80 66L80 26Z" fill={IMP_D} />
      </g>
      <path d={head} fill="none" />
      {/* eyes */}
      <path d="M38.4 44Q42.6 38.6 47 42.4Q46 48 42 48Q38.6 47.4 38.4 44Z" fill="#ffd23a" stroke-width={1.2} />
      <path d="M61.6 44Q57.4 38.6 53 42.4Q54 48 58 48Q61.4 47.4 61.6 44Z" fill="#ffd23a" stroke-width={1.2} />
      <ellipse cx={43.4} cy={44.4} rx={0.9} ry={2.4} fill={OUT} stroke="none" />
      <ellipse cx={57} cy={44.4} rx={0.9} ry={2.4} fill={OUT} stroke="none" />
      <path d="M37.6 39.4L46 41.6M62.4 39.4L54 41.6" fill="none" stroke-width={1.8} />
      {/* grin */}
      <path d="M41 52Q50 60 59 52Q55 58.6 50 58.6Q45 58.6 41 52Z" fill="#6a1430" stroke-width={1.3} />
      <path d="M44 53.6L45.4 56L46.6 54.6ZM56 53.6L54.6 56L53.4 54.6Z" fill="#fff" stroke="none" />
      <ellipse cx={39.6} cy={50} rx={2.4} ry={1.3} fill="#ff9ab4" opacity={0.6} stroke="none" />
      <ellipse cx={60.4} cy={50} rx={2.4} ry={1.3} fill="#ff9ab4" opacity={0.6} stroke="none" />
    </g>
  );
}

export const MONSTERS: Record<string, Monster> = {
  magic_beast: { draw: beast, portrait: [50, 23, 48, 48], aura: '#7ff0ff' },
  golem: { draw: golem, portrait: [20, 10, 60, 60], aura: '#5ef0ff' },
  imp: { draw: imp, portrait: [24, 14, 52, 52], aura: '#d24a6c' },
};

// ---------------------------------------------------------------- devil extras (Lucifero)

export function devilWings(): El {
  const w = spline([[40, 66], [28, 44], [12, 18, 1], [10, 36], [0.6, 46, 1], [8, 54], [1.6, 70, 1], [12, 70], [8, 86, 1], [20, 80], [24, 94, 1], [32, 80]]);
  return (
    <g>
      <path d={w} fill="#2a1a34" />
      <path d={w} fill="#2a1a34" transform="translate(100 0) scale(-1 1)" />
      <path d="M38 64L12 18M36 66L1 46M34 70L2 70M33 74L8 86M32 78L24 94" fill="none" stroke="#5a3a6e" stroke-width={1.3} />
      <path d="M62 64L88 18M64 66L99 46M66 70L98 70M67 74L92 86M68 78L76 94" fill="none" stroke="#5a3a6e" stroke-width={1.3} />
    </g>
  );
}

export function gravityAura(): El {
  return (
    <g>
      <ellipse cx={50} cy={60} rx={48} ry={56} fill="#5a1a9a" opacity={0.16} stroke="none" />
      <ellipse cx={50} cy={110} rx={44} ry={8} fill="none" stroke="#9a5ae6" stroke-width={1.6} opacity={0.8} />
      <ellipse cx={50} cy={110} rx={34} ry={5.6} fill="none" stroke="#c49aff" stroke-width={1} opacity={0.8} />
      <circle cx={8} cy={96} r={3.4} fill="#1a0e26" stroke="#9a5ae6" stroke-width={1.2} />
      <circle cx={92} cy={100} r={2.6} fill="#1a0e26" stroke="#9a5ae6" stroke-width={1.2} />
    </g>
  );
}

export function bigHorns(): El {
  const horn = spline([[36, 22], [28, 16], [20, 14.6], [12, 9], [7.6, 1.4, 1], [14, 6.6], [22, 9.6], [32, 12], [40, 16.6]]);
  return (
    <g>
      <path d={horn} fill="#3e3048" />
      <path d={horn} fill="#3e3048" transform="translate(100 0) scale(-1 1)" />
      <path d="M34 15.6Q24 10.6 12 6M66 15.6Q76 10.6 88 6" fill="none" stroke="#7a6a8e" stroke-width={1.2} />
      <path d="M30 15.6L31 12.4M24 14L25.4 10.6M18 11.6L19.6 8.4M70 15.6L69 12.4M76 14L74.6 10.6M82 11.6L80.4 8.4" fill="none" stroke="#1e1626" stroke-width={1} />
    </g>
  );
}
