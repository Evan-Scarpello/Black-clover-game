// Body, outfits, arms, legs and squad robes.
import type { JSX } from 'preact';
import { OUT, SW, Pt, spline, mirrorPts, shade, tint, leavesPath, spikeRing } from './core';
import type { Spec, Squad, Build } from './types';

type El = JSX.Element;

export interface BuildDef { sh: number; wa: number; hip: number; arm: number }
export const BUILDS: Record<Build, BuildDef> = {
  normal: { sh: 12.5, wa: 10, hip: 11, arm: 6.2 },
  muscular: { sh: 15, wa: 11.2, hip: 11.6, arm: 7.8 },
  big: { sh: 16.8, wa: 13, hip: 12.6, arm: 8.6 },
  slim: { sh: 11.4, wa: 9, hip: 10, arm: 5.4 },
  girl: { sh: 11, wa: 8.2, hip: 10.2, arm: 5.2 },
  tiny: { sh: 11, wa: 9.6, hip: 10.4, arm: 5.4 },
};

export function buildOf(spec: Spec): BuildDef {
  return BUILDS[spec.build || 'normal'];
}

export interface SquadDef { cape: string; lining: string; trim: string; trim2?: string; emblem: string }
export const SQUADS: Record<Squad, SquadDef> = {
  bulls: { cape: '#231d2b', lining: '#5c1a26', trim: '#e2ad35', trim2: '#c42a33', emblem: 'bull' },
  dawn: { cape: '#f6efdc', lining: '#cdb98a', trim: '#e3ac2c', emblem: 'dawn' },
  lions: { cape: '#cf2a31', lining: '#7c1622', trim: '#f4c23c', emblem: 'lion' },
  eagles: { cape: '#26305a', lining: '#151a33', trim: '#c9d2e4', emblem: 'eagle' },
  rose: { cape: '#2f64c4', lining: '#1b3b7e', trim: '#f07aa6', emblem: 'rose' },
  king: { cape: '#f8f4ec', lining: '#6c3fb0', trim: '#e6b43a', trim2: '#8e5bd6', emblem: 'clock' },
  sun: { cape: '#f1ebdf', lining: '#bfb3a0', trim: '#d9a62c', emblem: 'suneye' },
  spade: { cape: '#2a1d36', lining: '#4c2470', trim: '#a764e0', emblem: 'spade' },
  diamond: { cape: '#2f6a8c', lining: '#1c4258', trim: '#9ff0ff', emblem: 'diamond' },
  bandit: { cape: '#5a4636', lining: '#3a2c22', trim: '#8a6a4a', emblem: 'none' },
  dark: { cape: '#2a2236', lining: '#17121f', trim: '#6a5a80', emblem: 'none' },
  none: { cape: '#444', lining: '#222', trim: '#888', emblem: 'none' },
};

// ---------------------------------------------------------------- emblems

export function emblem(kind: string, x: number, y: number, s = 1): El | null {
  const t = `translate(${x} ${y}) scale(${s})`;
  const sw = 0.8;
  switch (kind) {
    case 'bull':
      return (
        <g transform={t} stroke-width={sw}>
          <path d="M-1.6 -1.2Q-5 -0.8 -4.6 -4.6Q-3.4 -2.4 -1 -2.6ZM1.6 -1.2Q5 -0.8 4.6 -4.6Q3.4 -2.4 1 -2.6Z" fill="#e2ad35" />
          <path d="M-2.4 -2.2Q0 -3.2 2.4 -2.2Q2.6 1.6 0 3.4Q-2.6 1.6 -2.4 -2.2Z" fill="#c42a33" />
          <circle cx={-0.9} cy={-0.6} r={0.45} fill="#ffe7a0" stroke="none" />
          <circle cx={0.9} cy={-0.6} r={0.45} fill="#ffe7a0" stroke="none" />
        </g>
      );
    case 'dawn':
      return (
        <g transform={t} stroke-width={sw}>
          <path d="M0 -4.6L1.2 -1.4L4.4 -1.6L2 0.6L3 3.8L0 2L-3 3.8L-2 0.6L-4.4 -1.6L-1.2 -1.4Z" fill="#f2c33a" />
          <circle cx={0} cy={0} r={1.1} fill="#fff4c4" stroke="none" />
        </g>
      );
    case 'lion': {
      const ring = spikeRing(0, 0, 2.6, 2.6, 0, 360, 9, 1.6, 0);
      ring.pop();
      return (
        <g transform={t} stroke-width={sw}>
          <path d={spline(ring)} fill="#f4c23c" />
          <circle cx={0} cy={0.2} r={1.9} fill="#ffdf7a" />
          <path d="M-0.8 0.9Q0 1.6 0.8 0.9" fill="none" stroke-width={0.6} />
        </g>
      );
    }
    case 'eagle':
      return (
        <g transform={t} stroke-width={sw}>
          <path d="M0 -1L-5 -3.6L-3.6 -0.6L-5.2 0.4L-2.6 1.4L0 3.6L2.6 1.4L5.2 0.4L3.6 -0.6L5 -3.6Z" fill="#d8deea" />
          <circle cx={0} cy={-1.4} r={1.2} fill="#f2f4fa" />
        </g>
      );
    case 'rose':
      return (
        <g transform={t} stroke-width={sw}>
          <path d="M-1 2.4L-3.6 4.2L-2.4 1.4ZM1 2.4L3.6 4.2L2.4 1.4Z" fill="#4fae5a" />
          <circle cx={0} cy={0} r={2.8} fill="#ef5c8e" />
          <path d="M-1.4 -0.4Q0 -1.8 1.4 -0.4Q0.6 1.2 -0.6 0.4" fill="none" stroke-width={0.6} />
        </g>
      );
    case 'clock':
      return (
        <g transform={t} stroke-width={sw}>
          <circle cx={0} cy={0} r={3.4} fill="#f2c94a" />
          <circle cx={0} cy={0} r={2.3} fill="#fff8dc" stroke-width={0.5} />
          <path d="M0 0L0 -1.8M0 0L1.3 0.7" fill="none" stroke="#6c3fb0" stroke-width={0.7} />
        </g>
      );
    case 'suneye':
      return (
        <g transform={t} stroke-width={sw}>
          <path d="M-4.4 -1.6L-5.6 -3.6M-2.2 -2.6L-2.8 -4.8M0 -3L0 -5.4M2.2 -2.6L2.8 -4.8M4.4 -1.6L5.6 -3.6" fill="none" stroke="#d9a62c" stroke-width={1} />
          <path d="M-4.8 0.4Q0 -4.2 4.8 0.4Q0 4.4 -4.8 0.4Z" fill="#1d1626" />
          <circle cx={0} cy={0.4} r={1.6} fill="#e8b830" stroke="none" />
          <circle cx={0} cy={0.4} r={0.6} fill="#1d1626" stroke="none" />
        </g>
      );
    case 'spade':
      return (
        <g transform={t} stroke-width={sw}>
          <path d="M0 -4.4C-1.4 -2.4 -4.2 -0.6 -3.8 1.6C-3.4 3.4 -1.2 3.4 -0.4 2.2L-1.2 4.4L1.2 4.4L0.4 2.2C1.2 3.4 3.4 3.4 3.8 1.6C4.2 -0.6 1.4 -2.4 0 -4.4Z" fill="#b277f0" />
        </g>
      );
    case 'diamond':
      return (
        <g transform={t} stroke-width={sw}>
          <path d="M0 -4.2L3.4 0L0 4.2L-3.4 0Z" fill="#9ff0ff" />
          <path d="M0 -4.2L1.2 0L0 4.2" fill="none" stroke="#5ab8d8" stroke-width={0.6} />
        </g>
      );
    case 'clover':
      return <path transform={t} fill="#e2ad35" stroke-width={0.6} d={leavesPath(3, 2.2, 0)} />;
  }
  return null;
}

// ---------------------------------------------------------------- legs & boots

export function legs(spec: Spec): El {
  const b = buildOf(spec);
  const o = spec.outfit;
  const pants = o.bottom || '#3a3348';
  const boots = o.boots || '#4a3426';
  const hip = b.hip;
  const els: El[] = [];
  const isDress = o.style === 'dress';
  if (o.style !== 'robe') {
    if (isDress) {
      const legCol = o.bottom || spec.skin;
      els.push(
        <path key="lg" d={`M${50 - hip + 2.4} 96L48.4 96L48.2 108L${50 - hip + 2.8} 108ZM51.6 96L${50 + hip - 2.4} 96L${50 + hip - 2.8} 108L51.8 108Z`} fill={legCol} />,
      );
    } else {
      const pd = `M${50 - hip + 0.4} 87L${50 + hip - 0.4} 87L${50 + hip - 1} 108L51.4 108L50 96.6L48.6 108L${50 - hip + 1} 108Z`;
      els.push(<path key="p" d={pd} fill={pants} />);
      els.push(<path key="ps" d={`M${50 + hip - 4} 89L${50 + hip - 0.8} 89L${50 + hip - 1.2} 106.6L${50 + hip - 3.6} 106.6Z`} fill={shade(pants, 0.25)} stroke="none" />);
    }
  }
  const x0 = 50 - hip + 1.2;
  const bl = `M${x0} 103L48.8 103L49.2 113.6Q49.4 117.6 46 117.6L${x0 - 2.6} 117.6Q${x0 - 6} 117.6 ${x0 - 5.4} 115Q${x0 - 4.6} 112 ${x0} 111.4Z`;
  const x1 = 50 + hip - 1.2;
  const br = `M${x1} 103L51.2 103L50.8 113.6Q50.6 117.6 54 117.6L${x1 + 2.6} 117.6Q${x1 + 6} 117.6 ${x1 + 5.4} 115Q${x1 + 4.6} 112 ${x1} 111.4Z`;
  els.push(<path key="bl" d={bl} fill={boots} />, <path key="br" d={br} fill={boots} />);
  els.push(
    <path key="bc" d={`M${x0 - 0.4} 103L49 103L49 106L${x0 - 0.2} 106ZM${x1 + 0.4} 103L51 103L51 106L${x1 + 0.2} 106Z`} fill={tint(boots, 0.18)} stroke-width={1.6} />,
    <path key="bh" d={`M${x0 - 3.4} 113.4Q${x0 - 1.4} 112.6 ${x0 + 0.6} 113.2M${x1 + 3.4} 113.4Q${x1 + 1.4} 112.6 ${x1 - 0.6} 113.2`} fill="none" stroke={tint(boots, 0.35)} stroke-width={1.2} />,
  );
  return <g>{els}</g>;
}

// ---------------------------------------------------------------- torso

function torsoD(b: BuildDef): string {
  const { sh, wa, hip } = b;
  return `M${50 - sh} 63.6Q50 58.4 ${50 + sh} 63.6C${50 + sh + 0.6} 71 ${50 + wa + 1} 78 ${50 + wa} 84L${50 + hip} 91Q50 93 ${50 - hip} 91L${50 - wa} 84C${50 - wa - 1} 78 ${50 - sh - 0.6} 71 ${50 - sh} 63.6Z`;
}

export function torso(spec: Spec, uid: string): El {
  const b = buildOf(spec);
  const o = spec.outfit;
  const top = o.top;
  const sh = shade(top, 0.28);
  const acc = o.accent || shade(top, 0.45);
  const els: El[] = [];
  const cid = `${uid}-torso`;

  if (o.style === 'robe') {
    const { sh: s } = b;
    const d = `M${50 - s} 63Q50 58 ${50 + s} 63C${50 + s + 1.2} 80 ${50 + s + 5} 100 ${50 + s + 7} 111.6Q50 115 ${50 - s - 7} 111.6C${50 - s - 5} 100 ${50 - s - 1.2} 80 ${50 - s} 63Z`;
    els.push(
      <clipPath key="c" id={cid}><path d={d} /></clipPath>,
      <path key="f" d={d} fill={top} stroke="none" />,
      <g key="s" clip-path={`url(#${cid})`} stroke="none">
        <path d={`M${50 + s - 5} 58C${50 + s - 2} 80 ${50 + s - 1} 100 ${50 + s} 116L80 116L80 58Z`} fill={sh} />
        <path d="M47.4 60L49 60L48.4 116L46.2 116ZM51 60L52.6 60L53.8 116L51.6 116Z" fill={acc} />
        <path d="M30 82.6L70 82.6L70 86.6L30 86.6Z" fill={o.belt || shade(top, 0.5)} />
        <path d="M30 82.6L70 82.6M30 86.6L70 86.6" fill="none" stroke={OUT} stroke-width={1.1} />
      </g>,
      <g key="btn" fill={acc} stroke-width={0.9}>
        <circle cx={50} cy={70} r={1.3} />
        <circle cx={50} cy={76.4} r={1.3} />
        <path d="M47.6 82.2L52.4 82.2L52.4 87L47.6 87Z" />
      </g>,
      <path key="fold" d={`M${44} 92Q${43} 104 ${41.6} 112M${57} 92Q${58.4} 104 ${59.6} 112`} fill="none" stroke={shade(top, 0.4)} stroke-width={1.1} />,
      <path key="o" d={d} fill="none" />,
    );
    return <g>{els}</g>;
  }

  if (o.style === 'coat') {
    const s = b.sh;
    const tails = `M${50 - s + 1} 80C${50 - s - 3} 92 ${50 - s - 6} 100 ${50 - s - 7} 108L${50 - s + 6} 106L50 92L${50 + s - 6} 106L${50 + s + 7} 108C${50 + s + 6} 100 ${50 + s + 3} 92 ${50 + s - 1} 80Z`;
    els.push(<path key="tails" d={tails} fill={top} />);
  }

  const d = torsoD(b);
  els.push(
    <clipPath key="c" id={cid}><path d={d} /></clipPath>,
    <path key="f" d={d} fill={top} stroke="none" />,
  );
  const inner: El[] = [<path key="s" d={`M${50 + b.wa - 4.6} 58C${50 + b.wa - 1.6} 70 ${50 + b.wa - 2} 82 ${50 + b.hip - 3} 95L80 95L80 58Z`} fill={sh} />];
  if (o.style === 'dress') {
    // bodice lacing / bow
    inner.push(<path key="lace" d="M50 64L50 82" fill="none" stroke={acc} stroke-width={1.6} />);
  } else if (o.style === 'armor') {
    inner.push(<path key="plate" d={`M${50 - b.sh + 3} 66Q50 62 ${50 + b.sh - 3} 66L${50 + b.wa - 1.4} 81Q50 85 ${50 - b.wa + 1.4} 81Z`} fill={acc} stroke={OUT} stroke-width={1.4} />);
    inner.push(<path key="plateh" d={`M${50 - b.sh + 6} 68Q${50 - 4} 66 ${50 - 2} 67.6`} fill="none" stroke={tint(acc, 0.5)} stroke-width={1.2} />);
  } else if (o.style === 'bare') {
    inner.push(<path key="pec" d={`M${50 - b.sh + 4} 70Q${50 - 6} 75 50 71.6Q${50 + 6} 75 ${50 + b.sh - 4} 70M50 72L50 82M45 78Q47 79 49 78M51 78Q53 79 55 78`} fill="none" stroke={shade(top, 0.45)} stroke-width={1.3} />);
  } else if (o.style === 'shirt' || o.style === 'coat') {
    inner.push(<path key="v" d="M45.6 60L50 67.4L54.4 60" fill={shade(top, 0.15)} stroke={OUT} stroke-width={1.3} />);
  }
  if (o.style !== 'dress' && o.style !== 'armor') {
    inner.push(<path key="belt" d={`M30 84L70 84L70 89L30 89Z`} fill={o.belt || '#5a3a2a'} />);
    inner.push(<path key="beltl" d="M30 84L70 84M30 89L70 89" fill="none" stroke={OUT} stroke-width={1.2} />);
    inner.push(<rect key="buckle" x={47.6} y={83.6} width={4.8} height={5.8} rx={1} fill="#e8b84a" stroke={OUT} stroke-width={1.1} />);
  }
  els.push(<g key="in" clip-path={`url(#${cid})`} stroke="none">{inner}</g>);
  els.push(<path key="o" d={d} fill="none" />);

  if (o.style === 'dress') {
    const w = b.wa;
    const skirt = `M${50 - w} 80L${50 + w} 80C${50 + w + 3} 87 ${50 + w + 6} 94 ${50 + w + 8.4} 99.6Q${50 + w + 4} 102.6 ${50 + w} 100.4Q${50 + w / 2} 103.6 50 101Q${50 - w / 2} 103.6 ${50 - w} 100.4Q${50 - w - 4} 102.6 ${50 - w - 8.4} 99.6C${50 - w - 6} 94 ${50 - w - 3} 87 ${50 - w} 80Z`;
    const scid = `${uid}-skirt`;
    els.push(
      <clipPath key="sc" id={scid}><path d={skirt} /></clipPath>,
      <path key="sk" d={skirt} fill={o.bottom && o.bottom !== spec.skin ? top : top} stroke="none" />,
      <g key="sks" clip-path={`url(#${scid})`} stroke="none">
        <path d={`M${50 + w - 2} 78L${50 + w + 2} 90L${50 + w + 6} 106L80 106L80 78Z`} fill={sh} />
        <path d="M20 97L80 97L80 106L20 106Z" fill={acc} />
      </g>,
      <path key="skf" d={`M${50 - 4} 84L${50 - 6} 99M${50 + 4} 84L${50 + 5.4} 99`} fill="none" stroke={shade(top, 0.4)} stroke-width={1.1} />,
      <path key="sko" d={skirt} fill="none" />,
      <path key="waist" d={`M${50 - w - 0.6} 79L${50 + w + 0.6} 79L${50 + w + 0.4} 82.6L${50 - w - 0.4} 82.6Z`} fill={acc} stroke-width={1.6} />,
    );
  }
  return <g>{els}</g>;
}

// ---------------------------------------------------------------- arms

export interface ArmPose { sx: number; sy: number; hx: number; hy: number }

export function armPoses(spec: Spec): { l: ArmPose; r: ArmPose } {
  const b = buildOf(spec);
  const lh = spec.pose?.l || [50 - b.sh - 5, 86];
  const rh = spec.pose?.r || [50 + b.sh + 5.4, 84.6];
  return {
    l: { sx: 50 - b.sh + 3, sy: 65, hx: lh[0], hy: lh[1] },
    r: { sx: 50 + b.sh - 3, sy: 65, hx: rh[0], hy: rh[1] },
  };
}

function armPath(p: ArmPose, side: -1 | 1): string {
  const mx = (p.sx + p.hx) / 2 + side * 2.6;
  const my = (p.sy + p.hy) / 2 - 0.6;
  return `M${p.sx} ${p.sy}Q${mx} ${my} ${p.hx} ${p.hy - 2.4}`;
}

export function arm(spec: Spec, side: -1 | 1): El {
  const b = buildOf(spec);
  const poses = armPoses(spec);
  const p = side === -1 ? poses.l : poses.r;
  const o = spec.outfit;
  const bare = o.sleeves === 'skin' || o.style === 'sleeveless' || o.style === 'tank' || o.style === 'bare';
  const col = bare ? spec.skin : o.sleeves || o.top;
  const d = armPath(p, side);
  const w = b.arm;
  return (
    <g fill="none">
      <path d={d} stroke={OUT} stroke-width={w + SW * 2} />
      <path d={d} stroke={col} stroke-width={w} />
      <path d={d} stroke={shade(col, 0.22)} stroke-width={w * 0.34} transform={`translate(${side * w * 0.3} 0.4)`} opacity={0.9} />
      {!bare && o.accent ? (
        <path d={`M${p.hx + (p.sx - p.hx) * 0.12} ${p.hy - 2.4 + (p.sy - p.hy) * 0.12}L${p.hx} ${p.hy - 2.4}`} stroke={o.accent} stroke-width={w - 0.2} />
      ) : null}
    </g>
  );
}

export function hand(spec: Spec, side: -1 | 1, glove?: string): El {
  const poses = armPoses(spec);
  const p = side === -1 ? poses.l : poses.r;
  const b = buildOf(spec);
  const r = b.arm * 0.6 + 0.6;
  const col = glove || spec.skin;
  return (
    <g>
      <circle cx={p.hx} cy={p.hy} r={r} fill={col} />
      <path d={`M${p.hx - side * r * 0.2} ${p.hy + r * 0.2}Q${p.hx + side * 0.4} ${p.hy + r * 0.9} ${p.hx + side * r * 0.75} ${p.hy + r * 0.2}`} fill="none" stroke={shade(col, 0.4)} stroke-width={0.9} />
    </g>
  );
}

// ---------------------------------------------------------------- capes

function squadOf(spec: Spec): SquadDef | null {
  if (!spec.cape || spec.cape.style === 'none') return null;
  return SQUADS[spec.cape.squad];
}

export function capeBack(spec: Spec): El | null {
  const sq = squadOf(spec);
  if (!sq) return null;
  const b = buildOf(spec);
  const st = spec.cape!.style || 'short';
  const long = st === 'captain' || st === 'hood' || st === 'hoodUp';
  const bottom = long ? 113 : 98;
  const fl = long ? 13 : 9.6;
  const s = b.sh;
  const pts: Pt[] = [
    [50 - s - 0.5, 60.5], [50 - s - 6.4, 78], [50 - s - fl, bottom, 1], [50 - s + 3, bottom - 3.4], [50, bottom - 1.6],
    [50 + s - 3, bottom - 3.4], [50 + s + fl, bottom, 1], [50 + s + 6.4, 78], [50 + s + 0.5, 60.5], [50, 57.4],
  ];
  const d = spline(pts);
  return (
    <g>
      <path d={d} fill={sq.lining} />
      <path d={`M${50 - s - 4} 74Q${50 - s - 6} 90 ${50 - s - fl + 3.4} ${bottom - 3}M${50 + s + 4} 74Q${50 + s + 6} 90 ${50 + s + fl - 3.4} ${bottom - 3}`} fill="none" stroke={shade(sq.lining, 0.35)} stroke-width={1.2} />
    </g>
  );
}

/** Hood bunched behind the neck (or hood up behind the head). */
export function hoodBack(spec: Spec): El | null {
  const sq = squadOf(spec);
  if (!sq) return null;
  const st = spec.cape!.style || 'short';
  if (st === 'hoodUp') {
    const d = spline([[25, 62], [20.6, 42], [24, 22], [35, 9.6], [50, 5.6], [65, 9.6], [76, 22], [79.4, 42], [75, 62], [50, 66]]);
    return <path d={d} fill={shade(sq.cape, 0.18)} />;
  }
  const d = spline([[36.4, 65], [37.6, 57], [44, 53.6], [56, 53.6], [62.4, 57], [63.6, 65], [50, 62.6]]);
  return <path d={d} fill={shade(sq.cape, 0.12)} />;
}

/** Hood-up front rim, drawn over the head. Returns the rim path too (casts the face shadow). */
export const HOOD_RIM = spline([
  [26.6, 60, 1], [22.6, 42], [25.6, 22], [36, 9.6], [50, 6.4], [64, 9.6], [74.4, 22], [77.4, 42], [73.4, 60, 1],
  [67.4, 54], [67.6, 36], [62.6, 23.6], [50, 19.6], [37.4, 23.6], [32.4, 36], [32.6, 54],
]);

export function hoodFront(spec: Spec): El | null {
  const sq = squadOf(spec);
  if (!sq || spec.cape!.style !== 'hoodUp') return null;
  return (
    <g>
      <path d={HOOD_RIM} fill={sq.cape} />
      <path d="M33.4 30Q36 20.6 50 18.4" fill="none" stroke={sq.trim} stroke-width={1.6} />
      <path d="M27.6 30Q30 16 42 11" fill="none" stroke={tint(sq.cape, 0.5)} stroke-width={1.8} />
      {sq.emblem === 'suneye' ? emblem('suneye', 50, 12.4, 0.62) : null}
    </g>
  );
}

function mantlePts(b: BuildDef, inset: number, long: boolean): Pt[] {
  const s = b.sh;
  const hem = long ? 80 : 77.4;
  return [
    [45.6 - inset * 1.5, 58.2],
    [50 - s - 1.2, 60.4],
    [50 - s - 4.8, 67],
    [50 - s - 4.4, hem - inset * 2.1, 1],
    [50 - s + 4.4, hem + 1.2 - inset * 2.1],
    [45 - inset * 1.5, hem - 3 - inset * 2.1, 1],
    [45.2 - inset * 1.5, 66],
  ];
}

/** Left capelet piece + its mirror as one path string. */
function mantlePair(b: BuildDef, inset: number, long: boolean): string {
  const pts = mantlePts(b, inset, long);
  return spline(pts) + spline(mirrorPts(pts));
}

export function mantle(spec: Spec): El | null {
  const sq = squadOf(spec);
  if (!sq) return null;
  const b = buildOf(spec);
  const st = spec.cape!.style || 'short';
  if (st === 'hoodUp' || st === 'hood') {
    // Midnight Sun style: robe closes in front; draw a shoulder yoke instead of open capelet.
    const s = b.sh;
    const yoke = spline([[50 - s - 1.4, 61], [50 - s - 4.4, 68], [50 - s - 2.4, 75, 1], [50, 79.6, 1], [50 + s + 2.4, 75, 1], [50 + s + 4.4, 68], [50 + s + 1.4, 61], [50, 57.6]]);
    return (
      <g>
        <path d={yoke} fill={sq.cape} />
        <path d={`M${50 - s - 1.4} 73.4L50 77.4L${50 + s + 1.4} 73.4`} fill="none" stroke={sq.trim} stroke-width={1.6} />
        {emblem(sq.emblem, 50, 69.6, 0.9)}
      </g>
    );
  }
  const long = st === 'captain';
  const L = mantlePair(b, 0, long);
  const L2 = mantlePair(b, 1, long);
  const x = 50 - b.sh;
  return (
    <g>
      <path d={L} fill={sq.trim2 || sq.trim} stroke="none" />
      {sq.trim2 ? <path d={mantlePair(b, 0.55, long)} fill={sq.trim} stroke="none" /> : null}
      <path d={L2} fill={sq.cape} stroke="none" />
      <path d={`M${x - 2} 62Q${x - 4.4} 67 ${x - 3.6} 74M${100 - x + 2} 62Q${100 - x + 4.4} 67 ${100 - x + 3.6} 74`} fill="none" stroke={tint(sq.cape, 0.25)} stroke-width={1.4} />
      <path d={L} fill="none" />
      {spec.cape!.collar ? (
        <path d="M38.6 61.4Q36 53 38.4 46.6Q44 52 46.4 58.6ZM61.4 61.4Q64 53 61.6 46.6Q56 52 53.6 58.6Z" fill={sq.cape} stroke-width={2} />
      ) : null}
      <circle cx={50} cy={60.6} r={1.9} fill={sq.trim} stroke-width={1.4} />
      {emblem(sq.emblem, x + 0.6, 68.4, 0.92)}
    </g>
  );
}

/** Pauldrons for armour outfits (drawn over arms). */
export function pauldrons(spec: Spec): El | null {
  if (spec.outfit.style !== 'armor') return null;
  const b = buildOf(spec);
  const col = spec.outfit.accent || tint(spec.outfit.top, 0.3);
  const d = (x: number, side: number) => `M${x - 6.4} 66Q${x - 6} 58.6 ${x} 58.6Q${x + 6} 58.6 ${x + 6.4} 66Q${x + side * 0.4} 68.2 ${x - 6.4} 66Z`;
  return (
    <g>
      <path d={d(50 - b.sh + 0.6, -1)} fill={col} />
      <path d={d(50 + b.sh - 0.6, 1)} fill={col} />
      <path d={`M${50 - b.sh - 3.4} 62.6Q${50 - b.sh} 60.4 ${50 - b.sh + 3} 61`} fill="none" stroke={tint(col, 0.5)} stroke-width={1.2} />
    </g>
  );
}

