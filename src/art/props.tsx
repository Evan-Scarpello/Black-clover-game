// Props: grimoire, weapons, head accessories, magic effects and familiars.
import type { JSX } from 'preact';
import { OUT, Pt, spline, shade, tint, leavesPath, sparkle, spikeRing } from './core';
import type { Spec, Fx } from './types';
import { armPoses } from './body';

type El = JSX.Element;

// ---------------------------------------------------------------- grimoire

export function clover(n: number, s: number, fill: string, stroke = OUT, sw = 0.7): El {
  return (
    <g fill={fill} stroke={stroke} stroke-width={sw}>
      <path d={`M0 0Q${s * 0.5} ${s * 1.1} ${s * 1.2} ${s * 1.5}`} fill="none" stroke-width={sw + 0.3} />
      <path d={leavesPath(n, s, n === 4 ? 45 : 0)} />
    </g>
  );
}

export function grimoire(spec: Spec): El | null {
  const g = spec.grimoire;
  if (!g) return null;
  const side = g.side || 'L';
  const x = side === 'L' ? 14.6 : 85.4;
  const y = 77;
  const rot = side === 'L' ? -12 : 12;
  const cover = g.cover;
  const leaves = g.leaves || 3;
  const clv = g.clover || '#f0c040';
  const dark = shade(cover, 0.35);
  const black = leaves === 5;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <ellipse cx={0} cy={13} rx={6} ry={1.4} fill="#000" opacity={0.18} stroke="none" />
      <path d="M-5.6 -7.4L6.8 -7.4Q7.6 -7.4 7.6 -6.6L7.6 7.4Q7.6 8.2 6.8 8.2L-5.6 8.2Z" fill={dark} />
      <path d="M-5.4 -6.6L6.4 -6.6L6.4 7L-5.4 7Z" fill="#f6ecd2" stroke-width={1.3} />
      <path d="M6.4 -4.6L-4 -4.6M6.4 -2.4L-4 -2.4M6.4 -0.2L-4 -0.2M6.4 2L-4 2M6.4 4.2L-4 4.2" stroke="#d8c8a0" stroke-width={0.5} fill="none" />
      <path d="M-7 -8.6L4.8 -8.6Q6 -8.6 6 -7.4L6 6.2Q6 7.4 4.8 7.4L-7 7.4Q-8.2 7.4 -8.2 6.2L-8.2 -7.4Q-8.2 -8.6 -7 -8.6Z" fill={cover} />
      <path d="M-8.2 -7.4Q-8.2 -8.6 -7 -8.6L-5.4 -8.6L-5.4 7.4L-7 7.4Q-8.2 7.4 -8.2 6.2Z" fill={dark} stroke-width={1.2} />
      <path d="M3.4 -8.6L6 -8.6L6 -6ZM3.4 7.4L6 7.4L6 4.8Z" fill="#e8c260" stroke-width={0.8} />
      <g transform="translate(0.6 -0.8)">
        {black ? <circle cx={0} cy={-0.4} r={5.2} fill="#3a1d24" opacity={0.6} stroke="none" /> : null}
        {clover(leaves, leaves === 5 ? 2.5 : leaves === 4 ? 2.7 : 2.9, clv, black ? '#b8a8c8' : OUT, black ? 0.5 : 0.7)}
      </g>
      <path d={sparkle(side === 'L' ? -9 : 9, -10, 2.2) + sparkle(side === 'L' ? 8.6 : -8.6, -11, 1.4)} fill="#fff6c8" stroke="none" />
    </g>
  );
}

// ---------------------------------------------------------------- weapons

export function weaponLayer(spec: Spec): 'back' | 'front' | null {
  const w = spec.weapon;
  if (!w || w === 'none') return null;
  return w === 'greatsword' || w === 'staff' || w === 'spear' ? 'back' : 'front';
}

export function weapon(spec: Spec): El | null {
  const w = spec.weapon;
  if (!w || w === 'none') return null;
  const { r } = armPoses(spec);
  const t = (rot: number) => `translate(${r.hx} ${r.hy}) rotate(${rot})`;
  switch (w) {
    case 'greatsword':
      return (
        <g transform={t(24)}>
          <path d="M-1.5 6L1.5 6L1.7 -3L-1.7 -3Z" fill="#5a3a2a" stroke-width={1.6} />
          <circle cx={0} cy={7.2} r={2} fill="#3a3040" stroke-width={1.4} />
          <path d="M-6.6 -3.6L6.6 -3.6L6 -6.6L-6 -6.6Z" fill="#2f2a36" />
          <path d="M-5 -6.4L-5.4 -55L-2 -61L5.2 -58.6L5.4 -42L4 -40L5.4 -37.6L5 -6.4Z" fill="#26222c" />
          <path d="M1.4 -8L1.6 -56.4" fill="none" stroke="#4a4456" stroke-width={1.6} />
          <path d="M-3.4 -20Q-1.6 -22 -2.4 -25Q-3.8 -23 -3.4 -20ZM2.4 -30Q4.2 -31 3.8 -34Q2.2 -33 2.4 -30ZM-2.6 -44Q-1 -47 -2 -49Q-3.6 -46 -2.6 -44Z" fill="#7a4632" stroke="none" />
          <path d="M-5 -6.4L-5.4 -55L-2 -61L5.2 -58.6L5.4 -42L4 -40L5.4 -37.6L5 -6.4Z" fill="none" />
        </g>
      );
    case 'katana':
      return (
        <g transform={t(32)}>
          <path d="M-1.4 7L1.4 7L1.4 -3L-1.4 -3Z" fill="#2a2230" stroke-width={1.5} />
          <path d="M-1.4 5L1.4 3.6M-1.4 2L1.4 0.6M-1.4 -1L1.4 -2.4" stroke="#8a6ab0" stroke-width={0.7} fill="none" />
          <ellipse cx={0} cy={-3.6} rx={4} ry={1.4} fill="#c9a24a" stroke-width={1.3} />
          <path d="M-1.3 -4.6Q-1.8 -26 -0.4 -44L1.4 -40Q1.4 -24 1.3 -4.6Z" fill="#e6ecf4" stroke-width={1.5} />
          <path d="M0.3 -6Q0.1 -24 0.6 -38" fill="none" stroke="#a9b8cc" stroke-width={0.8} />
        </g>
      );
    case 'lightsword':
      return (
        <g transform={t(18)}>
          <path d="M-3.4 -4L-2.6 -46L0 -52L2.6 -46L3.4 -4Z" fill="#fff6c0" opacity={0.45} stroke="none" transform="scale(1.7 1.05)" />
          <path d="M-1.4 6L1.4 6L1.4 -2L-1.4 -2Z" fill="#e8d7a0" stroke-width={1.4} />
          <path d="M-5.4 -2L5.4 -2L4.4 -4.6L-4.4 -4.6Z" fill="#f2cf5a" stroke-width={1.4} />
          <path d="M-2.4 -4.6L-2 -45L0 -51L2 -45L2.4 -4.6Z" fill="#fffbe8" stroke="#e8b830" stroke-width={1.4} />
          <path d="M0 -8L0 -44" stroke="#ffe680" stroke-width={0.9} fill="none" />
        </g>
      );
    case 'club':
      return (
        <g transform={t(28)}>
          <path d="M-1.8 6L-3.6 -26Q0 -31 3.6 -26L1.8 6Z" fill="#8a5a36" />
          <path d="M-1.4 -20L-4.4 -21.6M1.8 -14L4.6 -15M-0.6 -26L-1 -29.4" stroke-width={1.6} fill="none" />
          <path d="M1 0L1.6 -22" stroke="#a87448" stroke-width={1.2} fill="none" />
        </g>
      );
    case 'spoon':
      return (
        <g transform={t(16)}>
          <path d="M-1.2 5L-1 -10L1 -10L1.2 5Z" fill="#d8dce6" stroke-width={1.4} />
          <ellipse cx={0} cy={-14.6} rx={4.2} ry={5.6} fill="#e6e9f0" stroke-width={1.6} />
          <ellipse cx={0} cy={-14} rx={2.8} ry={3.8} fill="#fff6d0" stroke="none" />
          <path d="M-1.4 -17L-0.4 -18.6" stroke="#fff" stroke-width={1} fill="none" />
          <circle cx={0.6} cy={-13} r={1.6} fill="#f2a0b0" stroke-width={0.6} />
        </g>
      );
    case 'mirror':
      return (
        <g transform={t(-8)}>
          <path d="M-1.3 4L-1.1 -6L1.1 -6L1.3 4Z" fill="#7a5ab0" stroke-width={1.4} />
          <ellipse cx={0} cy={-12} rx={6.2} ry={7} fill="#c9a24a" />
          <ellipse cx={0} cy={-12} rx={4.6} ry={5.4} fill="#bfe8ff" stroke-width={1} />
          <path d="M-2.4 -14.6L1 -17M-2.6 -11.6L2.6 -15.4" stroke="#fff" stroke-width={1.1} fill="none" />
        </g>
      );
    case 'staff':
      return (
        <g transform={t(6)}>
          <path d="M-1.2 26L-1.4 -40L1.4 -40L1.2 26Z" fill="#6a4a32" stroke-width={1.6} />
          <circle cx={0} cy={-44} r={6.6} fill="#b36cff" opacity={0.3} stroke="none" />
          <path d="M-3.4 -38Q-4.6 -44 0 -48.6Q4.6 -44 3.4 -38Z" fill="#4a3448" stroke-width={1.4} />
          <circle cx={0} cy={-43} r={3} fill="#d9a2ff" stroke-width={1.2} />
          <circle cx={-0.8} cy={-44} r={0.9} fill="#fff" stroke="none" />
        </g>
      );
    case 'spear':
      return (
        <g transform={t(4)}>
          <path d="M-1 28L-1 -40L1 -40L1 28Z" fill="#4a3a52" stroke-width={1.5} />
          <path d="M0 -54L3.4 -42L0 -38.6L-3.4 -42Z" fill="#c9d0e0" stroke-width={1.5} />
          <path d="M-3.6 -38.6L3.6 -38.6" stroke-width={2} fill="none" />
          <path d="M0 -51L0 -41" stroke="#fff" stroke-width={0.8} fill="none" />
        </g>
      );
    case 'crystalSword':
      return (
        <g transform={t(26)}>
          <path d="M-1.3 6L1.3 6L1.3 -2L-1.3 -2Z" fill="#2a3a4a" stroke-width={1.4} />
          <path d="M-4.6 -2L4.6 -2L3.6 -4.6L-3.6 -4.6Z" fill="#5ac8e8" stroke-width={1.3} />
          <path d="M-2.8 -4.6L-3.4 -30L0 -40L3.4 -30L2.8 -4.6Z" fill="#aef4ff" stroke-width={1.5} />
          <path d="M0 -6L0 -38M-3.2 -28L0 -24L3.2 -28" stroke="#5ab8d8" stroke-width={0.8} fill="none" />
        </g>
      );
    case 'dagger':
      return (
        <g transform={t(30)}>
          <path d="M-1 4L1 4L1 -2L-1 -2Z" fill="#3a2a2a" stroke-width={1.3} />
          <path d="M-3 -2L3 -2" stroke-width={2} fill="none" />
          <path d="M-1.6 -2.6L0 -16L1.6 -2.6Z" fill="#dfe4ee" stroke-width={1.3} />
        </g>
      );
  }
  return null;
}

// ---------------------------------------------------------------- head accessories

export function headUnder(spec: Spec): El | null {
  const h = spec.head || [];
  const out: El[] = [];
  if (h.includes('headband')) {
    out.push(
      <g key="hb">
        <path d="M28.6 27.6Q50 19.8 71.4 27.6L71.6 34Q50 26.4 28.4 34Z" fill="#221c26" />
        <path d="M33 29.6Q50 24.4 67 29.6" fill="none" stroke="#4a4256" stroke-width={1.2} />
      </g>,
    );
  }
  return out.length ? <g>{out}</g> : null;
}

export function headBack(spec: Spec): El | null {
  const h = spec.head || [];
  const out: El[] = [];
  if (h.includes('headband')) {
    out.push(
      <g key="hbt">
        <path d="M28 30Q19 27 12.6 31.6Q19.6 31.4 27.6 34Z" fill="#221c26" />
        <path d="M27.6 32Q20 35 15.6 41.4Q22.6 38.4 28.4 34.6Z" fill="#221c26" />
      </g>,
    );
  }
  if (h.includes('bandana')) {
    out.push(<path key="bdt" d="M73 22Q82 20 88 26Q81 26 74 28ZM73 25Q80 29 83 36Q77 32 72.6 29Z" fill="#b8322c" />);
  }
  return out.length ? <g>{out}</g> : null;
}

export function headOver(spec: Spec): El | null {
  const h = spec.head || [];
  const out: El[] = [];
  if (h.includes('crown')) {
    out.push(
      <g key="cr" transform="translate(59 9) rotate(16)">
        <path d="M-8 3L-9 -5L-4.4 -1L0 -8L4.4 -1L9 -5L8 3Z" fill="#2a1830" />
        <path d="M-8 3L8 3L8 5.4L-8 5.4Z" fill="#3a2440" stroke-width={1.6} />
        <circle cx={0} cy={-8} r={1.4} fill="#e8304a" stroke-width={1} />
        <circle cx={0} cy={1.4} r={1.4} fill="#e8304a" stroke="none" />
        <circle cx={-9} cy={-5} r={1} fill="#e8304a" stroke="none" />
        <circle cx={9} cy={-5} r={1} fill="#e8304a" stroke="none" />
      </g>,
    );
  }
  if (h.includes('horns')) {
    out.push(
      <g key="hn">
        <path d="M38 13Q33 5 36 -0.6Q37.6 6 43.4 10Z" fill="#3a2440" />
        <path d="M62 13Q67 5 64 -0.6Q62.4 6 56.6 10Z" fill="#3a2440" />
        <path d="M37.2 7Q37.4 4 36.6 2M62.8 7Q62.6 4 63.4 2" stroke="#7a5a8a" stroke-width={0.9} fill="none" />
      </g>,
    );
  }
  if (h.includes('witchHat')) {
    out.push(
      <g key="wh" transform="rotate(-8 50 14)">
        <path d="M37 13Q42 -2 54 -6Q64 -9 70 -4Q62 -4 60 2Q58 8 63 13Z" fill="#3b2252" />
        <path d="M38.4 10.4Q50 12.6 62 10.6L62.6 13.6Q50 15.6 37.6 13.4Z" fill="#e05a8a" stroke-width={1.6} />
        <path d="M18 15.6Q50 4 84 15.6Q50 23.6 18 15.6Z" fill="#4a2a66" />
        <path d="M24 15.6Q50 9 78 15.4" fill="none" stroke="#6b3f8f" stroke-width={1.2} />
        <path d="M48 -1Q52 -4 56 -4.4" stroke="#6b4a8a" stroke-width={1.2} fill="none" />
      </g>,
    );
  }
  if (h.includes('flower')) {
    out.push(
      <g key="fl" transform="translate(30.6 21.6)">
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx={0} cy={-3} rx={2.4} ry={3.2} fill="#ffe2ec" transform={`rotate(${a})`} stroke-width={1.1} />
        ))}
        <circle cx={0} cy={0} r={1.8} fill="#ffc83a" stroke-width={1} />
      </g>,
    );
  }
  if (h.includes('goggles')) {
    out.push(
      <g key="gg">
        <path d="M27 21Q50 6 73 21" fill="none" stroke={OUT} stroke-width={4.2} />
        <path d="M27 21Q50 6 73 21" fill="none" stroke="#5a3a2a" stroke-width={2.2} />
        <circle cx={41.6} cy={13.6} r={4.6} fill="#c9a24a" />
        <circle cx={41.6} cy={13.6} r={3} fill="#7ae8c8" stroke-width={1} />
        <circle cx={57.6} cy={13} r={4.6} fill="#c9a24a" />
        <circle cx={57.6} cy={13} r={3} fill="#7ae8c8" stroke-width={1} />
        <path d="M40.4 12.4L42 11.2M56.4 11.8L58 10.6" stroke="#fff" stroke-width={1} fill="none" />
      </g>,
    );
  }
  if (h.includes('bandana')) {
    out.push(
      <g key="bd">
        <path d="M27.2 30Q25.6 12 40 8.4Q50 6.4 60 8.4Q74.6 12 72.8 30Q50 20.6 27.2 30Z" fill="#c4382f" />
        <path d="M36 14Q40 12 43 14M54 12.6Q58 11 61 13.4M44 20Q47 18 50 20" fill="none" stroke="#f2d0c0" stroke-width={1.1} />
      </g>,
    );
  }
  if (h.includes('helmet')) {
    out.push(
      <g key="hm">
        <path d="M25.6 58Q22.6 36 26 22Q31 6 50 4.6Q69 6 74 22Q77.4 36 74.4 58L66 58L66.6 34Q60 30 50 30Q40 30 33.4 34L34 58Z" fill="#3a3448" />
        <path d="M30 22Q36 10 50 9" fill="none" stroke="#6a6280" stroke-width={1.8} />
        <path d="M33.4 34Q50 27 66.6 34L66.4 38Q50 32 33.6 38Z" fill="#5a5270" stroke-width={1.4} />
        <path d="M50 4.6L50 -1.4" stroke-width={2.4} fill="none" />
        <g transform="translate(50 18) scale(0.9)">
          <path d="M0 -4.4C-1.4 -2.4 -4.2 -0.6 -3.8 1.6C-3.4 3.4 -1.2 3.4 -0.4 2.2L-1.2 4.4L1.2 4.4L0.4 2.2C1.2 3.4 3.4 3.4 3.8 1.6C4.2 -0.6 1.4 -2.4 0 -4.4Z" fill="#b277f0" stroke-width={0.8} />
        </g>
      </g>,
    );
  }
  if (h.includes('crystalHelm')) {
    out.push(
      <g key="ch">
        <path d="M27.6 30L26.4 20L32 10L41 4L50 0.6L59 4L68 10L73.6 20L72.4 30Q50 22 27.6 30Z" fill="#8fe2f4" />
        <path d="M32 10L37 25M50 0.6L50 23.6M68 10L63 25M41 4L43.6 23.8M59 4L56.4 23.8" stroke="#3f9fc0" stroke-width={1} fill="none" />
        <path d="M31 21L34.6 12L38 19Z" fill="#e6fbff" stroke="none" />
        <path d="M50 0.6L45.6 -5.6L50 -3.6L54.4 -5.6Z" fill="#aef4ff" stroke-width={1.4} />
        <path d="M26.4 27.6Q50 19 73.6 27.6L73.8 33Q50 24.6 26.2 33Z" fill="#c9d2e4" />
        <path d="M30 28Q50 21.6 70 28" fill="none" stroke="#f4f8ff" stroke-width={1} />
        <circle cx={50} cy={26.4} r={2} fill="#5ac8e8" stroke-width={1.1} />
        <path d="M26.2 32L31.6 32.4L32.4 46L28 48.6Z" fill="#c9d2e4" />
        <path d="M73.8 32L68.4 32.4L67.6 46L72 48.6Z" fill="#c9d2e4" />
      </g>,
    );
  }
  return out.length ? <g>{out}</g> : null;
}

// ---------------------------------------------------------------- effects / familiars

function flame(x: number, y: number, s: number, key: string, c1 = '#ff6a1f', c2 = '#ffd23f'): El {
  return (
    <g key={key} transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 4Q-4.6 3.6 -4.4 -0.6Q-4.2 -4 -1.6 -6Q-2 -3.4 -0.4 -2.6Q-0.6 -6.6 2.4 -9.4Q1.8 -5.6 3.8 -3.4Q5.2 -1.4 4.2 1.4Q3 4 0 4Z" fill={c1} stroke-width={1.2 / s} />
      <path d="M0 2.6Q-2.4 2.2 -2.2 0Q-2 -1.6 -0.8 -2.6Q-0.6 -1 0.6 -0.8Q0.8 -3 2 -4.2Q2 -2 2.8 -0.6Q3 1.8 0 2.6Z" fill={c2} stroke="none" />
    </g>
  );
}

function bubble(x: number, y: number, r: number, key: string, col = '#7fd0ff'): El {
  return (
    <g key={key}>
      <circle cx={x} cy={y} r={r} fill={col} fill-opacity={0.45} stroke={tint(col, 0.1)} stroke-width={1} />
      <path d={`M${x - r * 0.5} ${y - r * 0.2}Q${x - r * 0.45} ${y - r * 0.55} ${x - r * 0.1} ${y - r * 0.6}`} fill="none" stroke="#fff" stroke-width={Math.max(0.8, r * 0.25)} />
    </g>
  );
}

function rose(x: number, y: number, s: number, key: string): El {
  return (
    <g key={key} transform={`translate(${x} ${y}) scale(${s})`} stroke-width={1.2 / s}>
      <circle cx={0} cy={0} r={3} fill="#e8366a" />
      <path d="M-1.6 -0.4Q0 -2.2 1.6 -0.4Q0.8 1.4 -0.6 0.6Q-0.4 -0.4 0.6 -0.4" fill="none" stroke={shade('#e8366a', 0.5)} stroke-width={0.7 / s} />
    </g>
  );
}

/** Effects drawn behind the character. */
export function fxBack(spec: Spec): El | null {
  const fx = spec.fx || [];
  if (!fx.length) return null;
  const out: El[] = [];
  const has = (f: Fx) => fx.includes(f);
  if (has('soulHalo')) {
    out.push(
      <g key="halo">
        <ellipse cx={50} cy={30} rx={31} ry={31} fill="#ffe7a0" opacity={0.18} stroke="none" />
        <ellipse cx={50} cy={30} rx={28} ry={28} fill="none" stroke="#f2c94a" stroke-width={2.6} />
        <ellipse cx={50} cy={30} rx={28} ry={28} fill="none" stroke="#fff4c8" stroke-width={0.9} />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
          const r = (a * Math.PI) / 180;
          return <circle key={a} cx={50 + Math.cos(r) * 28} cy={30 + Math.sin(r) * 28} r={1.6} fill="#fff4c8" stroke-width={0.8} />;
        })}
      </g>,
    );
  }
  if (has('water')) {
    const back = 'M90 88Q90 74 50 72Q12 74 10 90';
    out.push(
      <g key="watb">
        <path d={back} fill="none" stroke={OUT} stroke-width={5.6} />
        <path d={back} fill="none" stroke="#3a9ae0" stroke-width={3} />
      </g>,
    );
  }
  if (has('blood')) {
    out.push(
      <g key="blood" fill="none" stroke-linecap="round">
        <path d="M30 70Q12 64 14 46Q16 32 8 24" stroke={OUT} stroke-width={6.4} />
        <path d="M30 70Q12 64 14 46Q16 32 8 24" stroke="#c4142e" stroke-width={3.4} />
        <path d="M70 70Q90 66 88 48Q86 36 94 28" stroke={OUT} stroke-width={6.4} />
        <path d="M70 70Q90 66 88 48Q86 36 94 28" stroke="#c4142e" stroke-width={3.4} />
        <path d="M68 80Q84 90 92 84" stroke={OUT} stroke-width={5.4} />
        <path d="M68 80Q84 90 92 84" stroke="#c4142e" stroke-width={2.6} />
        <path d="M13 44Q15.4 36 11 30" stroke="#ff5a6e" stroke-width={1} />
      </g>,
    );
  }
  if (has('boneWing')) {
    out.push(
      <g key="bw">
        <path d="M64 64Q74 50 88 40L90 46L84 50L94 52L90 58L84 58L92 64L86 68L76 66Z" fill="#ece4d0" />
        <path d="M66 64Q76 54 86 46M74 64L88 56" stroke="#b9ae94" stroke-width={1} fill="none" />
      </g>,
    );
  }
  if (has('antiMagic')) {
    out.push(
      <g key="am" fill="#1c1622" opacity={0.85} stroke="none">
        <path d="M80 22Q90 30 84 42Q92 36 94 24Q90 30 80 22Z" />
        <path d="M70 12Q78 6 76 -2Q82 8 74 16Z" />
        <path d="M90 62Q98 54 96 44Q100 56 92 66Z" />
      </g>,
    );
  }
  if (has('blocks')) {
    const blk = (x: number, y: number, k: string) => (
      <g key={k} transform={`translate(${x} ${y})`}>
        <path d="M-4 -2L0 -4.4L4 -2L4 3L0 5.4L-4 3Z" fill="#b58a5c" stroke-width={1.4} />
        <path d="M-4 -2L0 0.4L4 -2M0 0.4L0 5.4" fill="none" stroke-width={1} />
        <path d="M-4 -2L0 -4.4L4 -2L0 0.4Z" fill="#d9b07c" stroke="none" />
      </g>
    );
    out.push(<g key="blocks">{blk(14, 36, 'a')}{blk(86, 46, 'b')}{blk(83, 30, 'c')}{blk(18, 54, 'd')}</g>);
  }
  if (has('portals')) {
    out.push(
      <g key="pts">
        <ellipse cx={14} cy={40} rx={6.4} ry={9} fill="#1a1028" stroke="#a46cff" stroke-width={1.8} />
        <ellipse cx={14} cy={40} rx={3.6} ry={5.6} fill="none" stroke="#5a3a9a" stroke-width={1} />
        <ellipse cx={87} cy={56} rx={5.6} ry={8} fill="#1a1028" stroke="#a46cff" stroke-width={1.8} />
      </g>,
    );
  }
  if (has('crystals')) {
    const c = (x: number, y: number, r: number, k: string) => (
      <path key={k} d={`M${x} ${y - 6}L${x + 3} ${y}L${x} ${y + 6}L${x - 3} ${y}Z`} fill="#aef4ff" stroke-width={1.2} transform={`rotate(${r} ${x} ${y})`} />
    );
    out.push(<g key="cry">{c(15, 40, -20, 'a')}{c(86, 36, 18, 'b')}{c(88, 60, 30, 'c')}</g>);
  }
  return out.length ? <g>{out}</g> : null;
}

/** Effects drawn in front of the character (hands, familiars, particles). */
export function fxFront(spec: Spec): El | null {
  const fx = spec.fx || [];
  if (!fx.length) return null;
  const { l, r } = armPoses(spec);
  const out: El[] = [];
  const has = (f: Fx) => fx.includes(f);
  if (has('fireFists')) {
    out.push(flame(l.hx, l.hy - 3, 1.3, 'ffl'), flame(r.hx, r.hy - 3, 1.3, 'ffr'));
  }
  if (has('fire')) out.push(flame(r.hx + 1, r.hy - 6, 1.5, 'fire'));
  if (has('fireball')) {
    out.push(
      <g key="fb">
        <path d={`M${r.hx + 2} ${r.hy - 10}Q${r.hx + 14} ${r.hy - 18} ${r.hx + 18} ${r.hy - 28}Q${r.hx + 12} ${r.hy - 22} ${r.hx + 6} ${r.hy - 20}`} fill="#ff8a2a" stroke-width={1.4} />
        <circle cx={r.hx + 1} cy={r.hy - 9} r={7.4} fill="#ff6a1f" />
        <circle cx={r.hx} cy={r.hy - 9.6} r={4.6} fill="#ffd23f" stroke="none" />
        <circle cx={r.hx - 1.4} cy={r.hy - 11} r={1.6} fill="#fff6c8" stroke="none" />
      </g>,
    );
  }
  if (has('water')) {
    const front = 'M10 90Q18 104 50 105Q80 104 90 88';
    out.push(
      <g key="wat">
        <path d={front} fill="none" stroke={OUT} stroke-width={6.4} />
        <path d={front} fill="none" stroke="#5ec4ff" stroke-width={3.8} />
        <path d="M22 99Q34 103.4 46 103.6" fill="none" stroke="#e6f8ff" stroke-width={1.2} />
        <path d="M90 88Q93 84 92 80Q95 84 93 89Z" fill="#5ec4ff" stroke-width={1.2} />
        {bubble(14, 50, 3.4, 'b1')}
        {bubble(r.hx + 6, r.hy - 12, 3, 'b2')}
        {bubble(20, 38, 2, 'b3')}
        {bubble(86, 62, 2.2, 'b4')}
      </g>,
    );
  }
  if (has('mercury')) {
    out.push(
      <g key="mer">
        {bubble(r.hx + 6, r.hy - 10, 3.2, 'm1', '#c8cfdc')}
        {bubble(r.hx + 12, r.hy - 20, 2.4, 'm2', '#c8cfdc')}
        {bubble(16, 44, 2.8, 'm3', '#c8cfdc')}
        <path d={`M${r.hx + 1} ${r.hy - 3}Q${r.hx + 4} ${r.hy - 8} ${r.hx + 4.2} ${r.hy - 7}`} fill="none" stroke="#c8cfdc" stroke-width={2} />
      </g>,
    );
  }
  if (has('roses')) {
    out.push(
      <g key="rs">
        <path d="M14 96Q8 80 18 70Q28 62 22 50Q18 42 26 36" fill="none" stroke={OUT} stroke-width={4.6} />
        <path d="M14 96Q8 80 18 70Q28 62 22 50Q18 42 26 36" fill="none" stroke="#3f8f3a" stroke-width={2.2} />
        <path d="M86 98Q94 86 86 76Q80 68 88 58" fill="none" stroke={OUT} stroke-width={4.6} />
        <path d="M86 98Q94 86 86 76Q80 68 88 58" fill="none" stroke="#3f8f3a" stroke-width={2.2} />
        <path d="M11.4 84L8 83M19.6 70L22 66.6M23.6 56L27 56.6M90.6 86L94 85.4M84.6 72L81 71" stroke-width={1.4} fill="none" />
        {rose(26, 36, 1.2, 'r1')}
        {rose(18, 70, 1, 'r2')}
        {rose(88, 58, 1.1, 'r3')}
      </g>,
    );
  }
  if (has('gravity') || has('darkOrb')) {
    const g = has('gravity');
    out.push(
      <g key="grav">
        <circle cx={r.hx + 2} cy={r.hy - 10} r={9} fill="#7a3fd0" opacity={0.25} stroke="none" />
        <circle cx={r.hx + 2} cy={r.hy - 10} r={6} fill="#2a1240" />
        <circle cx={r.hx + 2} cy={r.hy - 10} r={3.4} fill="#8a4ae6" stroke="none" />
        <circle cx={r.hx + 0.6} cy={r.hy - 11.6} r={1.2} fill="#e0c8ff" stroke="none" />
        {g ? <ellipse cx={r.hx + 2} cy={r.hy - 10} rx={11} ry={3.4} fill="none" stroke="#b98aff" stroke-width={1.3} transform={`rotate(-20 ${r.hx + 2} ${r.hy - 10})`} /> : null}
      </g>,
    );
  }
  if (has('portal')) {
    out.push(
      <g key="por">
        <ellipse cx={86} cy={66} rx={8} ry={12.4} fill="#a46cff" opacity={0.25} stroke="none" />
        <ellipse cx={86} cy={66} rx={6.2} ry={10.4} fill="#2a1450" stroke-width={2} />
        <ellipse cx={86} cy={66} rx={6.2} ry={10.4} fill="none" stroke="#c49aff" stroke-width={1.6} />
        <ellipse cx={86} cy={66} rx={3.4} ry={6.4} fill="none" stroke="#7a4ad0" stroke-width={1} />
        <path d={sparkle(80, 52, 2)} fill="#e6d4ff" stroke="none" />
      </g>,
    );
  }
  if (has('lightning')) {
    const bolt = (x: number, y: number, s: number, k: string) => (
      <path key={k} d="M0 -5L2.6 -0.6L0.6 -0.2L2.4 5L-2.4 -0.6L-0.4 -1Z" transform={`translate(${x} ${y}) scale(${s})`} fill="#ffe94a" stroke-width={0.9 / s} />
    );
    out.push(<g key="lt">{bolt(l.hx - 4, l.hy - 6, 1.1, 'a')}{bolt(r.hx + 4, r.hy - 7, 1.3, 'b')}{bolt(33, 112, 0.9, 'c')}{bolt(67, 112, 0.9, 'd')}{bolt(86, 40, 1, 'e')}</g>);
  }
  if (has('thread')) {
    out.push(
      <g key="thr" fill="none" stroke="#e8203a" stroke-width={1.1}>
        <path d={`M${r.hx + 2} ${r.hy - 2}Q${r.hx + 14} ${r.hy - 6} ${r.hx + 12} ${r.hy - 18}Q${r.hx + 10} ${r.hy - 28} ${r.hx + 22} ${r.hy - 36}`} />
        <path d={`M${r.hx + 3} ${r.hy}Q${r.hx + 18} ${r.hy + 2} ${r.hx + 20} ${r.hy - 10}Q${r.hx + 22} ${r.hy - 20} ${r.hx + 28} ${r.hy - 22}`} />
        <path d={`M${l.hx - 2} ${l.hy}Q${l.hx - 12} ${l.hy - 4} ${l.hx - 10} ${l.hy - 16}Q${l.hx - 8} ${l.hy - 26} ${l.hx - 16} ${l.hy - 32}`} />
        <path d={`M${l.hx} ${l.hy + 2}Q${l.hx - 10} ${l.hy + 10} ${l.hx - 16} ${l.hy + 6}`} />
        <circle cx={r.hx + 22} cy={r.hy - 36} r={1.3} fill="#e8203a" stroke="none" />
        <circle cx={l.hx - 16} cy={l.hy - 32} r={1.3} fill="#e8203a" stroke="none" />
      </g>,
    );
  }
  if (has('cube')) {
    out.push(
      <g key="cube" transform={`translate(${r.hx + 3} ${r.hy - 13})`}>
        <path d="M-6 -3L0 -6.4L6 -3L6 4L0 7.4L-6 4Z" fill="#7a5aff" fill-opacity={0.35} stroke="#c8b8ff" stroke-width={1.3} />
        <path d="M-6 -3L0 0.4L6 -3M0 0.4L0 7.4" fill="none" stroke="#c8b8ff" stroke-width={1} />
        <path d={sparkle(0, 0.6, 1.8)} fill="#fff" stroke="none" />
      </g>,
    );
  }
  if (has('flowers')) {
    const fl = (x: number, y: number, c: string, k: string) => (
      <g key={k} transform={`translate(${x} ${y})`}>
        {[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx={0} cy={-2.2} rx={1.7} ry={2.4} fill={c} transform={`rotate(${a})`} stroke-width={0.8} />)}
        <circle cx={0} cy={0} r={1.2} fill="#ffd23f" stroke-width={0.7} />
      </g>
    );
    out.push(<g key="fls">{fl(14, 108, '#ff9ac0', 'a')}{fl(86, 108, '#fff', 'b')}{fl(88, 44, '#ffb0d0', 'c')}{fl(r.hx + 3, r.hy - 8, '#fff0a0', 'd')}</g>);
  }
  if (has('poison')) {
    out.push(
      <g key="poi" fill="#9a4ad8" opacity={0.75} stroke="none">
        <path d={`M${r.hx} ${r.hy - 4}Q${r.hx + 8} ${r.hy - 10} ${r.hx + 4} ${r.hy - 18}Q${r.hx + 12} ${r.hy - 12} ${r.hx + 8} ${r.hy - 2}Z`} />
        <circle cx={r.hx + 10} cy={r.hy - 22} r={2.2} />
        <circle cx={16} cy={44} r={3} />
        <circle cx={12} cy={54} r={1.8} />
        <path d="M84 30Q90 36 86 42Q94 38 90 28Z" />
      </g>,
    );
  }
  if (has('steel')) {
    out.push(
      <g key="stl">
        <path d={`M${r.hx + 2} ${r.hy - 18}L${r.hx + 12} ${r.hy - 16}L${r.hx + 11} ${r.hy - 2}L${r.hx + 3} ${r.hy - 4}Z`} fill="#a9b4c6" />
        <path d={`M${r.hx + 4} ${r.hy - 14}L${r.hx + 9} ${r.hy - 13}`} stroke="#eef2f8" stroke-width={1.2} fill="none" />
        <circle cx={r.hx + 4.4} cy={r.hy - 6} r={0.8} fill={OUT} stroke="none" />
        <circle cx={r.hx + 9.6} cy={r.hy - 5} r={0.8} fill={OUT} stroke="none" />
      </g>,
    );
  }
  if (has('rock')) {
    const rk = (x: number, y: number, s: number, k: string) => (
      <path key={k} d="M-4 1L-3 -3L1 -4.4L4.4 -1.6L3.6 3L-1 4Z" transform={`translate(${x} ${y}) scale(${s})`} fill="#a57a52" stroke-width={1.4 / s} />
    );
    out.push(<g key="rk">{rk(r.hx + 4, r.hy - 10, 1.3, 'a')}{rk(16, 46, 1, 'b')}{rk(88, 40, 0.8, 'c')}</g>);
  }
  if (has('gel')) {
    const gl = (x: number, y: number, s: number, k: string) => (
      <g key={k} transform={`translate(${x} ${y}) scale(${s})`}>
        <path d="M-4 2Q-4.6 -3 0 -4Q4.6 -3 4 2Q0 4 -4 2Z" fill="#6ae86a" fill-opacity={0.8} stroke-width={1.2 / s} />
        <circle cx={-1.4} cy={-1.6} r={0.9} fill="#e8ffe0" stroke="none" />
      </g>
    );
    out.push(<g key="gel">{gl(r.hx + 4, r.hy - 8, 1.3, 'a')}{gl(15, 48, 1, 'b')}{gl(86, 100, 1.1, 'c')}</g>);
  }
  if (has('bones')) {
    out.push(
      <g key="bn">
        <path d={`M${r.hx} ${r.hy - 2}L${r.hx + 6} ${r.hy - 16}L${r.hx + 4} ${r.hy - 3}L${r.hx + 12} ${r.hy - 10}L${r.hx + 6} ${r.hy + 1}Z`} fill="#ece4d0" stroke-width={1.4} />
      </g>,
    );
  }
  if (has('sprout')) {
    out.push(
      <g key="spr" transform={`translate(${r.hx + 2} ${r.hy - 6})`}>
        <path d="M0 0Q-0.6 -6 0.6 -10" fill="none" stroke="#7a5236" stroke-width={2.2} />
        <ellipse cx={-3.4} cy={-10} rx={3.6} ry={2.4} fill="#5ec46a" transform="rotate(-25 -3.4 -10)" stroke-width={1.1} />
        <ellipse cx={3.8} cy={-11.4} rx={3.8} ry={2.4} fill="#7fdc6a" transform="rotate(25 3.8 -11.4)" stroke-width={1.1} />
        <ellipse cx={0.4} cy={-14.6} rx={2.6} ry={2.4} fill="#9ae87a" stroke-width={1.1} />
        <path d={sparkle(7, -17, 1.6)} fill="#e8ffd0" stroke="none" />
      </g>,
    );
  }
  if (has('wind')) {
    const sw = (d: string, k: string) => <path key={k} d={d} fill="#bff7dc" stroke-width={1.3} />;
    out.push(
      <g key="wnd">
        {sw('M70 108Q84 106 92 94Q88 104 72 111Z', 'a')}
        {sw('M76 98Q86 95 90 86Q89 95 78 101Z', 'b')}
        {sw('M30 108Q16 106 9 95Q14 104 28 111Z', 'c')}
        <path d="M84 70Q88 66 92 68Q90 72 86 72Z" fill="#7fdc6a" stroke-width={1} />
      </g>,
    );
  }
  if (has('light')) {
    out.push(
      <g key="lgt" fill="#fff4b0" stroke="none">
        <path d={sparkle(14, 40, 3)} />
        <path d={sparkle(86, 34, 2.4)} />
        <path d={sparkle(20, 98, 2)} />
        <circle cx={84} cy={92} r={1.4} />
      </g>,
    );
  }
  if (has('curse')) {
    out.push(
      <g key="crs" fill="none" stroke="#b05ae0" stroke-width={1.3}>
        <path d="M10 40L14 34L18 40L14 46ZM14 34L14 46" />
        <path d="M84 52Q90 48 92 54Q88 60 84 56" />
        <circle cx={88} cy={30} r={3} />
        <path d="M86 28L90 32M90 28L86 32" />
      </g>,
    );
  }
  if (has('claws')) {
    const cl = (x: number, y: number, s: number, k: string) => (
      <path key={k} d={`M${x - 3} ${y + 2}L${x - 4.6 * s} ${y + 7}L${x - 1} ${y + 3.4}L${x} ${y + 8}L${x + 1} ${y + 3.4}L${x + 4.6 * s} ${y + 7}L${x + 3} ${y + 2}Z`} fill="#f4f0e6" stroke-width={1.2} />
    );
    out.push(<g key="clw">{cl(l.hx, l.hy, 1, 'a')}{cl(r.hx, r.hy, 1, 'b')}</g>);
  }
  if (has('clock')) out.push(clockDial(85, 30, 'clk'));
  if (has('salamander')) out.push(salamander(85, 30, 'sal'));
  if (has('bell')) out.push(bell(84, 28, 'bell'));
  if (has('sheep')) out.push(sheep(20, 96, 'shp'));
  return out.length ? <g>{out}</g> : null;
}

function clockDial(x: number, y: number, key: string): El {
  return (
    <g key={key} transform={`translate(${x} ${y})`}>
      <circle cx={0} cy={0} r={12.4} fill="#c49aff" opacity={0.18} stroke="none" />
      <circle cx={0} cy={0} r={9} fill="#f2c94a" />
      <circle cx={0} cy={0} r={6.8} fill="#fffaf0" stroke-width={1} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        return <path key={i} d={`M${Math.cos(a) * 5.2} ${Math.sin(a) * 5.2}L${Math.cos(a) * 6.2} ${Math.sin(a) * 6.2}`} stroke="#8e5bd6" stroke-width={i % 3 ? 0.6 : 1.1} />;
      })}
      <path d="M0 0L0 -4.6M0 0L3.2 1.6" fill="none" stroke="#6c3fb0" stroke-width={1.2} />
      <circle cx={0} cy={0} r={0.9} fill="#6c3fb0" stroke="none" />
      <path d="M-2.4 -10.6L2.4 -10.6L1.6 -8.6L-1.6 -8.6Z" fill="#f2c94a" stroke-width={1.1} />
      <path d={sparkle(-11, -8, 2)} fill="#fff4c8" stroke="none" />
      <path d={sparkle(9.6, 9.6, 1.4)} fill="#e6d4ff" stroke="none" />
    </g>
  );
}

function salamander(x: number, y: number, key: string): El {
  return (
    <g key={key} transform={`translate(${x} ${y})`}>
      <path d="M4 3Q10 6 12 0Q13 -4 10 -6Q11 -1 7 0Z" fill="#ff8a2a" stroke-width={1.2} />
      {flame(11, -6, 0.6, 'tf')}
      <path d={spline([[-6, -1], [-4, -5], [1, -5.6], [5, -2], [5, 3], [0, 5], [-5, 4]])} fill="#ff5a2a" stroke-width={1.4} />
      <path d="M-3 4L-4 7M2 4.6L2.6 7.4" stroke-width={1.6} fill="none" />
      <circle cx={-3} cy={-1.4} r={1.4} fill="#fff" stroke-width={0.6} />
      <circle cx={-2.8} cy={-1.2} r={0.7} fill={OUT} stroke="none" />
      <path d="M-2 -5Q-1 -9 1 -6Q2 -9.6 3.6 -5" fill="#ffd23f" stroke-width={1} />
      <path d="M-6 1.6Q-4.6 2.4 -3.6 1.6" fill="none" stroke-width={0.8} />
    </g>
  );
}

function bell(x: number, y: number, key: string): El {
  return (
    <g key={key} transform={`translate(${x} ${y})`}>
      <circle cx={0} cy={2} r={10} fill="#8af0b0" opacity={0.2} stroke="none" />
      <ellipse cx={-5} cy={0} rx={4.4} ry={2.4} fill="#e6fff0" fill-opacity={0.75} stroke="#5ac88a" stroke-width={0.9} transform="rotate(-30 -5 0)" />
      <ellipse cx={5} cy={0} rx={4.4} ry={2.4} fill="#e6fff0" fill-opacity={0.75} stroke="#5ac88a" stroke-width={0.9} transform="rotate(30 5 0)" />
      <path d="M-2 2Q0 1 2 2L2.4 8Q0 9 -2.4 8Z" fill="#4ad07a" stroke-width={1.1} />
      <circle cx={0} cy={-1.8} r={3} fill="#ffe6d6" stroke-width={1.1} />
      <path d="M-3.4 -1.4Q-3.8 -5.6 0 -5.6Q3.8 -5.6 3.4 -1.4Q2 -3.6 0 -3.2Q-2 -3.6 -3.4 -1.4Z" fill="#3ec46a" stroke-width={1} />
      <path d="M3 -4.4Q6 -6 5 -9" fill="none" stroke="#3ec46a" stroke-width={1.6} />
      <circle cx={-1} cy={-1.4} r={0.5} fill={OUT} stroke="none" />
      <circle cx={1.2} cy={-1.4} r={0.5} fill={OUT} stroke="none" />
    </g>
  );
}

function sheep(x: number, y: number, key: string): El {
  const ring = spikeRing(0, 0, 6.6, 5, 0, 360, 9, 1.8, 0);
  ring.pop();
  const wool = ring.map((p) => [p[0], p[1]] as Pt);
  return (
    <g key={key} transform={`translate(${x} ${y})`}>
      <path d="M-3 4L-3 8.4M3 4L3 8.4" stroke-width={2.6} fill="none" />
      <path d={spline(wool)} fill="#fffaf0" />
      <ellipse cx={-4.4} cy={-0.6} rx={3} ry={3.4} fill="#f6e0d0" stroke-width={1.2} />
      <circle cx={-5.4} cy={-1} r={0.6} fill={OUT} stroke="none" />
      <circle cx={-3.4} cy={-1} r={0.6} fill={OUT} stroke="none" />
      <ellipse cx={-6.6} cy={-2.6} rx={1.6} ry={0.9} fill="#f6e0d0" stroke-width={0.8} />
      <path d="M2 -2Q4 -3.6 5 -1" fill="none" stroke="#e8dcc8" stroke-width={1} />
    </g>
  );
}

