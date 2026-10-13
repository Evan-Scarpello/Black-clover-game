// Inline SVG art for the hideout base map. Strokes don't scale (vector-effect via CSS),
// so every landmark keeps the same chunky comic outline at any size.
// Animated bits are separate HTML layers (see Hub.tsx) so the big SVGs never repaint per frame.
import type { JSX } from 'preact';

export type ArtKind = 'grimoire' | 'arena' | 'clan' | 'trials' | 'missions' | 'market' | 'pass' | 'post' | 'trophy' | 'cottage' | 'gate' | 'hideout';

/** Height / width of each art's viewBox. */
export const ART_RATIO: Record<ArtKind, number> = {
  grimoire: 2.3,
  arena: 0.66,
  clan: 0.86,
  trials: 1.62,
  missions: 0.84,
  market: 0.9,
  pass: 0.9,
  post: 1.05,
  trophy: 0.95,
  cottage: 0.92,
  gate: 0.6,
  hideout: 1.12,
};

/** Which art a registry screen gets; unknown screens get a cottage with their icon on a sign. */
export const SCREEN_ART: Record<string, ArtKind> = {
  arena: 'arena',
  clan: 'clan',
  tower: 'trials',
  dispatch: 'missions',
  shop: 'market',
  pass: 'pass',
  login: 'post',
  achievements: 'trophy',
};

const INK = '#0b0710';

function Svg({ kind, children }: { kind: ArtKind; children: JSX.Element | JSX.Element[] }) {
  const h = Math.round(ART_RATIO[kind] * 100);
  return (
    <svg class="lm-svg" viewBox={`0 0 100 ${h}`} preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <g stroke={INK} stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">
        {children}
      </g>
    </svg>
  );
}

const Shadow = ({ y, rx = 44 }: { y: number; rx?: number }) => <ellipse cx="50" cy={y} rx={rx} ry="5" fill="rgba(0,0,0,.35)" stroke="none" />;

function GrimoireTower() {
  return (
    <Svg kind="grimoire">
      <Shadow y={226} rx={40} />
      <path d="M14 228 h72 l-6 -12 h-60Z" fill="#5b4a7a" />
      <path d="M26 216 L33 86 L67 86 L74 216Z" fill="#6b5c96" />
      <path d="M33 86 L34 70 L66 70 L67 86Z" fill="#4a3d6b" />
      <path d="M28 186 L72 186 M30 150 L70 150 M31 116 L69 116" stroke-width="2" fill="none" />
      <path d="M38 216 Q50 190 62 160 Q42 140 60 116 Q46 100 56 86" stroke="#b46bff" stroke-width="3.2" fill="none" opacity=".9" />
      <rect x="44" y="190" width="12" height="26" rx="6" fill="#2a1d14" />
      <rect x="46" y="128" width="9" height="13" rx="4" fill="#ffd36b" />
      <rect x="40" y="160" width="8" height="12" rx="4" fill="#ffd36b" />
      <rect x="54" y="96" width="8" height="12" rx="4" fill="#ffd36b" />
      <path d="M28 70 L50 30 L72 70Z" fill="#2b1f4a" />
      <path d="M50 30 L50 14" stroke-width="2.4" />
      <path d="M38 70 L50 48 L62 70" fill="none" stroke="#b46bff" stroke-width="2" />
    </Svg>
  );
}

function Arena() {
  return (
    <Svg kind="arena">
      <Shadow y={62} rx={48} />
      <ellipse cx="50" cy="25" rx="46" ry="12" fill="#a8774a" />
      <ellipse cx="50" cy="28" rx="34" ry="7.5" fill="#f0d39a" />
      <path d="M4 25 C4 34 26 40 50 40 C74 40 96 34 96 25 L96 54 C96 60 74 64 50 64 C26 64 4 60 4 54Z" fill="#c99a62" />
      <path d="M4 38 C24 46 76 46 96 38" fill="none" stroke-width="2" />
      <g fill="#3b2418">
        <path d="M11 44 a3.6 3.6 0 0 1 7.2 0 v8 h-7.2Z" />
        <path d="M25 47 a3.6 3.6 0 0 1 7.2 0 v8 h-7.2Z" />
        <path d="M67.8 47 a3.6 3.6 0 0 1 7.2 0 v8 h-7.2Z" />
        <path d="M81.8 44 a3.6 3.6 0 0 1 7.2 0 v8 h-7.2Z" />
        <path d="M42 48 a8 8 0 0 1 16 0 v14 h-16Z" />
      </g>
      <g fill="#ffc531">
        <path d="M43 32 l14 -10 M57 32 l-14 -10" stroke-width="3.2" fill="none" stroke="#e8e0f0" />
      </g>
      <path d="M12 26 V4 M88 26 V4" stroke-width="2.2" />
    </Svg>
  );
}

function ClanHall() {
  return (
    <Svg kind="clan">
      <Shadow y={82} rx={46} />
      <rect x="10" y="38" width="80" height="44" fill="#6e5a8f" />
      <path d="M4 40 L50 10 L96 40Z" fill="#7b4fd0" />
      <path d="M22 26 L50 8 L78 26" fill="none" stroke-width="2" />
      <rect x="40" y="56" width="20" height="26" rx="9" fill="#2a1d14" />
      <path d="M50 56 V82" stroke-width="1.6" />
      <g fill="#ffd36b">
        <rect x="17" y="48" width="10" height="12" rx="4" />
        <rect x="73" y="48" width="10" height="12" rx="4" />
      </g>
      <path d="M8 82 h84" stroke-width="3" />
      <path d="M30 40 V30 M70 40 V30" stroke-width="2" />
    </Svg>
  );
}

function TrialsTower() {
  return (
    <Svg kind="trials">
      <Shadow y={158} rx={40} />
      <path d="M18 158 L22 40 L78 40 L82 158Z" fill="#4a3d63" />
      <path d="M14 40 h72 v-12 h-10 v6 h-10 v-6 h-12 v6 h-8 v-6 h-12 v6 h-10 v-6 h-10Z" fill="#5d4f7a" />
      <path d="M20 70 h60 M19 100 h62 M18 130 h64" stroke-width="1.8" fill="none" />
      <g fill="#ff4b5c">
        <rect x="44" y="50" width="12" height="14" rx="5" />
        <rect x="30" y="80" width="10" height="12" rx="4" />
        <rect x="60" y="80" width="10" height="12" rx="4" />
        <rect x="44" y="108" width="12" height="14" rx="5" />
      </g>
      <path d="M38 158 v-18 a12 12 0 0 1 24 0 v18Z" fill="#1d1426" />
      <path d="M41 146 h18 M41 152 h18" stroke="#6b5c88" stroke-width="1.4" />
    </Svg>
  );
}

function Missions() {
  return (
    <Svg kind="missions">
      <Shadow y={80} rx={44} />
      <path d="M18 80 V28 M82 80 V28" stroke-width="3.4" />
      <path d="M10 30 L50 10 L90 30Z" fill="#8d4a1f" />
      <rect x="16" y="28" width="68" height="38" rx="3" fill="#b86b34" />
      <g fill="#fff3d6">
        <path d="M22 33 h16 v20 h-16Z" />
        <path d="M42 32 h18 v16 h-18Z" />
        <path d="M64 34 h15 v22 h-15Z" />
        <path d="M44 51 h14 v12 h-14Z" />
      </g>
      <g fill="#ff4b5c" stroke-width="1.4">
        <circle cx="30" cy="34" r="2.2" />
        <circle cx="51" cy="33" r="2.2" />
        <circle cx="71" cy="35" r="2.2" />
        <circle cx="51" cy="52" r="2.2" />
      </g>
      <path d="M25 40 h10 M25 45 h8 M45 40 h11 M67 42 h9 M67 47 h7" stroke="#8a7a66" stroke-width="1.4" />
      <rect x="64" y="66" width="22" height="14" fill="#8d4a1f" />
      <path d="M64 73 h22" stroke-width="1.6" />
    </Svg>
  );
}

function Market() {
  return (
    <Svg kind="market">
      <Shadow y={86} rx={46} />
      <path d="M14 86 V36 M86 86 V36" stroke-width="3.2" />
      <rect x="10" y="58" width="80" height="28" fill="#8d4a1f" />
      <path d="M10 66 h80" stroke-width="1.8" />
      <path d="M6 38 L14 18 H86 L94 38Z" fill="#fff3e6" />
      <g fill="#e63946" stroke="none">
        <path d="M14 18 h12 l-4 20 h-14Z" />
        <path d="M38 18 h12 l-1 20 h-12Z" />
        <path d="M62 18 h12 l3 20 h-12Z" />
      </g>
      <path d="M6 38 L14 18 H86 L94 38Z" fill="none" />
      <path d="M6 38 q6 7 12 0 q6 7 12 0 q6 7 12 0 q6 7 12 0 q6 7 12 0 q6 7 12 0 q7 7 14 0" fill="#e63946" />
      <circle cx="26" cy="54" r="6" fill="#3ddc84" />
      <path d="M38 58 v-10 h8 v10" fill="#4fc3f7" />
      <path d="M38 48 h8 l-1 -4 h-6Z" fill="#4fc3f7" />
      <circle cx="62" cy="53" r="6.5" fill="#ffc531" />
      <path d="M72 58 l5 -10 l5 10Z" fill="#b46bff" />
    </Svg>
  );
}

function PassPavilion() {
  return (
    <Svg kind="pass">
      <Shadow y={86} rx={46} />
      <path d="M8 86 L16 40 H84 L92 86Z" fill="#6a3fb5" />
      <g fill="#ffc531" stroke="none">
        <path d="M28 40 L22 86 H34 L38 40Z" />
        <path d="M62 40 L66 86 H78 L72 40Z" />
      </g>
      <path d="M8 86 L16 40 H84 L92 86Z" fill="none" />
      <path d="M12 42 L50 8 L88 42Z" fill="#8a5ad6" />
      <path d="M50 8 V2" stroke-width="2.2" />
      <path d="M40 86 v-20 a10 10 0 0 1 20 0 v20Z" fill="#2a1d14" />
      <rect x="30" y="46" width="40" height="16" rx="3" fill="#ff6fa8" />
      <path d="M38 50 v8 M62 50 v8" stroke-dasharray="2 2" stroke-width="1.4" />
      <path d="M46 54 l4 -3 l4 3 l-4 3Z" fill="#fff" stroke-width="1.4" />
    </Svg>
  );
}

function Post() {
  return (
    <Svg kind="post">
      <Shadow y={100} rx={36} />
      <path d="M50 100 V56" stroke-width="5" />
      <path d="M50 100 V56" stroke="#8d4a1f" stroke-width="2" />
      <rect x="18" y="10" width="64" height="54" rx="6" fill="#fff8ec" />
      <path d="M18 16 a6 6 0 0 1 6 -6 h52 a6 6 0 0 1 6 6 v10 h-64Z" fill="#e63946" />
      <circle cx="32" cy="8" r="3" fill="#c0c7d6" />
      <circle cx="68" cy="8" r="3" fill="#c0c7d6" />
      <g fill="#d8cfe6" stroke-width="1.2">
        <rect x="26" y="32" width="8" height="7" rx="1.5" />
        <rect x="38" y="32" width="8" height="7" rx="1.5" />
        <rect x="50" y="32" width="8" height="7" rx="1.5" fill="#3ddc84" />
        <rect x="62" y="32" width="8" height="7" rx="1.5" />
        <rect x="26" y="44" width="8" height="7" rx="1.5" />
        <rect x="38" y="44" width="8" height="7" rx="1.5" />
        <rect x="50" y="44" width="8" height="7" rx="1.5" />
        <rect x="62" y="44" width="8" height="7" rx="1.5" fill="#ffc531" />
      </g>
      <rect x="58" y="74" width="26" height="18" rx="8" fill="#4fa3ff" />
      <path d="M62 80 h18" stroke-width="1.6" />
    </Svg>
  );
}

function Trophy() {
  return (
    <Svg kind="trophy">
      <Shadow y={94} rx={38} />
      <path d="M22 94 L28 68 H72 L78 94Z" fill="#8d7fa8" />
      <path d="M24 82 h52" stroke-width="1.6" />
      <rect x="34" y="60" width="32" height="10" rx="3" fill="#6b5c88" />
      <path d="M44 60 V50 H56 V60Z" fill="#ffb300" />
      <path d="M30 12 H70 V22 C70 40 60 50 50 50 C40 50 30 40 30 22Z" fill="#ffc531" />
      <path d="M30 18 C16 18 16 36 32 36 M70 18 C84 18 84 36 68 36" fill="none" stroke-width="3" />
      <path d="M38 18 C38 30 42 38 46 42" stroke="#fff3a0" stroke-width="2.4" fill="none" />
      <path d="M50 22 l3 6 6 1 -4.5 4 1 6 -5.5 -3 -5.5 3 1 -6 -4.5 -4 6 -1Z" fill="#fff3a0" stroke-width="1.4" />
      <path d="M14 70 q-6 -14 4 -26 M86 70 q6 -14 -4 -26" stroke="#3ddc84" stroke-width="3.4" fill="none" />
    </Svg>
  );
}

function Cottage() {
  return (
    <Svg kind="cottage">
      <Shadow y={90} rx={42} />
      <rect x="14" y="44" width="72" height="46" fill="#7a6a96" />
      <path d="M6 46 L50 12 L94 46Z" fill="#4a3d6b" />
      <rect x="40" y="62" width="20" height="28" rx="9" fill="#2a1d14" />
      <rect x="20" y="54" width="12" height="12" rx="4" fill="#ffd36b" />
      <rect x="68" y="54" width="12" height="12" rx="4" fill="#ffd36b" />
      <rect x="68" y="16" width="10" height="18" fill="#5d4f7a" />
    </Svg>
  );
}

function Gate() {
  return (
    <Svg kind="gate">
      <Shadow y={58} rx={50} />
      <rect x="8" y="10" width="24" height="50" fill="#7d6f99" />
      <rect x="68" y="10" width="24" height="50" fill="#7d6f99" />
      <path d="M6 12 v-8 h5 v4 h5 v-4 h5 v4 h5 v-4 h5 v8Z M66 12 v-8 h5 v4 h5 v-4 h5 v4 h5 v-4 h5 v8Z" fill="#8d7fa8" />
      <rect x="30" y="22" width="40" height="38" fill="#6b5c88" />
      <path d="M36 60 V40 a14 14 0 0 1 28 0 V60Z" fill="#1d1426" />
      <path d="M40 40 v20 M46 34 v26 M54 34 v26 M60 40 v20 M36 46 h28 M36 53 h28" stroke="#5d4f7a" stroke-width="1.6" />
      <rect x="16" y="22" width="8" height="10" rx="3" fill="#ffd36b" />
      <rect x="76" y="22" width="8" height="10" rx="3" fill="#ffd36b" />
      <path d="M30 22 h40" stroke-width="2" />
    </Svg>
  );
}

function Hideout() {
  return (
    <Svg kind="hideout">
      <Shadow y={110} rx={48} />
      <rect x="6" y="56" width="24" height="54" fill="#463a55" />
      <rect x="70" y="50" width="26" height="60" fill="#463a55" />
      <rect x="26" y="34" width="48" height="76" fill="#3a3046" />
      <path d="M4 58 L18 40 L32 58Z" fill="#26202f" />
      <path d="M68 52 L83 32 L98 52Z" fill="#26202f" />
      <path d="M22 36 L50 8 L78 36Z" fill="#26202f" />
      <rect x="44" y="0" width="12" height="14" fill="#463a55" />
      <path d="M38 30 Q32 20 37 13 Q40 23 47 26Z M62 30 Q68 20 63 13 Q60 23 53 26Z" fill="#e8dcc8" />
      <circle cx="50" cy="31" r="6.4" fill="#c62828" />
      <g fill="#ffd36b">
        <rect x="33" y="44" width="9" height="11" rx="3" />
        <rect x="58" y="44" width="9" height="11" rx="3" />
        <rect x="45.5" y="52" width="9" height="11" rx="3" />
        <rect x="12" y="66" width="8" height="10" rx="3" />
        <rect x="78" y="62" width="8" height="10" rx="3" />
        <rect x="33" y="70" width="9" height="11" rx="3" />
        <rect x="80" y="82" width="8" height="10" rx="3" />
      </g>
      <rect x="41" y="82" width="18" height="28" rx="8" fill="#2a1d14" />
      <path d="M50 82 V110" stroke-width="1.4" />
      <path d="M4 110 h92" stroke-width="3" />
    </Svg>
  );
}

const ART: Record<ArtKind, () => JSX.Element> = {
  grimoire: GrimoireTower,
  arena: Arena,
  clan: ClanHall,
  trials: TrialsTower,
  missions: Missions,
  market: Market,
  pass: PassPavilion,
  post: Post,
  trophy: Trophy,
  cottage: Cottage,
  gate: Gate,
  hideout: Hideout,
};

export function LandmarkArt({ kind }: { kind: ArtKind }) {
  const A = ART[kind];
  return <A />;
}

/** A floating grimoire with a magic circle — the Summon tower's beacon. */
export function FloatingGrimoire() {
  return (
    <svg viewBox="0 0 60 50" aria-hidden="true" class="lm-svg">
      <g stroke={INK} stroke-width="2.4" stroke-linejoin="round">
        <path d="M8 14 L30 10 L52 14 L52 42 L30 46 L8 42Z" fill="#2a1d14" />
        <path d="M11 16 L29 13 L29 43 L11 40Z" fill="#f3ead2" />
        <path d="M49 16 L31 13 L31 43 L49 40Z" fill="#efe3c6" />
        <g fill="#3ddc84" stroke-width="1.4">
          <circle cx="20" cy="24" r="3.4" />
          <circle cx="24" cy="28" r="3.4" />
          <circle cx="20" cy="32" r="3.4" />
          <circle cx="16" cy="28" r="3.4" />
        </g>
        <path d="M35 22 h10 M35 28 h8 M35 34 h10" stroke="#b46bff" stroke-width="2" />
      </g>
    </svg>
  );
}

/** Small waving pennant used on several landmarks. */
export function Pennant({ color = '#e63946' }: { color?: string }) {
  return (
    <svg viewBox="0 0 30 20" aria-hidden="true" class="lm-svg">
      <path d="M1 2 L28 8 L1 16Z" fill={color} stroke={INK} stroke-width="2.2" stroke-linejoin="round" />
    </svg>
  );
}
