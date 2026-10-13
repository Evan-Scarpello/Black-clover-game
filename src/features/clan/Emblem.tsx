// Clan emblem: a comic shield in the clan colour with a white glyph. Pure SVG (no assets).
import { validColor, validEmblem } from './logic';

const INK = '#0b0710';

function Glyph({ id }: { id: string }) {
  const g = { fill: '#fff8ec', stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round' as const, 'stroke-linecap': 'round' as const };
  switch (id) {
    case 'clover':
      return (
        <g {...g}>
          <path d="M50 52 C52 64 56 70 62 76" fill="none" />
          <circle cx="41" cy="40" r="10" />
          <circle cx="59" cy="40" r="10" />
          <circle cx="41" cy="57" r="10" />
          <circle cx="59" cy="57" r="10" />
          <circle cx="50" cy="48.5" r="4" fill="#3ddc84" />
        </g>
      );
    case 'bull':
      return (
        <g {...g}>
          <path d="M28 30 C26 42 34 48 40 46 M72 30 C74 42 66 48 60 46" fill="none" stroke-width="5" />
          <path d="M28 30 C26 42 34 48 40 46 M72 30 C74 42 66 48 60 46" fill="none" stroke="#fff8ec" stroke-width="2" />
          <path d="M38 42 H62 L60 64 C58 72 42 72 40 64Z" />
          <circle cx="45" cy="64" r="2" fill={INK} stroke="none" />
          <circle cx="55" cy="64" r="2" fill={INK} stroke="none" />
          <circle cx="44" cy="52" r="2.2" fill={INK} stroke="none" />
          <circle cx="56" cy="52" r="2.2" fill={INK} stroke="none" />
        </g>
      );
    case 'star':
      return <path {...g} d="M50 24 L57 41 L75 42 L61 54 L66 72 L50 62 L34 72 L39 54 L25 42 L43 41Z" />;
    case 'moon':
      return (
        <g {...g}>
          <path d="M57 25 A25 25 0 1 0 70 66 A20 20 0 1 1 57 25Z" />
          <path d="M66 32 l2 5 5 2 -5 2 -2 5 -2-5 -5-2 5-2Z" stroke-width="1.6" />
        </g>
      );
    case 'flame':
      return (
        <g {...g}>
          <path d="M50 22 C62 36 70 44 68 58 A18 18 0 0 1 32 58 C31 49 37 44 40 37 C43 43 46 46 49 47 C53 39 52 30 50 22Z" />
          <path d="M50 52 C56 58 57 62 55 66 A6 6 0 0 1 45 66 C44 61 47 58 50 52Z" fill="#ffc531" stroke-width="2" />
        </g>
      );
    case 'swords':
      return (
        <g {...g}>
          <path d="M30 28 L64 62 M70 28 L36 62" stroke-width="9" />
          <path d="M30 28 L64 62 M70 28 L36 62" stroke="#fff8ec" stroke-width="4" />
          <path d="M58 66 L68 56 M42 66 L32 56" stroke-width="5" />
          <circle cx="70" cy="70" r="4" />
          <circle cx="30" cy="70" r="4" />
        </g>
      );
    case 'crown':
      return (
        <g {...g}>
          <path d="M28 64 L26 36 L39 48 L50 28 L61 48 L74 36 L72 64Z" />
          <rect x="28" y="64" width="44" height="8" rx="2" />
          <circle cx="50" cy="52" r="3.5" fill="#ff4b5c" stroke-width="1.6" />
        </g>
      );
    case 'bolt':
      return <path {...g} d="M56 20 L32 54 H47 L42 80 L68 42 H53Z" />;
    case 'eye':
      return (
        <g {...g}>
          <path d="M24 50 Q50 24 76 50 Q50 76 24 50Z" />
          <circle cx="50" cy="50" r="10" fill="#ff4b5c" />
          <ellipse cx="50" cy="50" rx="3" ry="8" fill={INK} stroke="none" />
        </g>
      );
    case 'diamond':
      return (
        <g {...g}>
          <path d="M36 30 H64 L74 44 L50 76 L26 44Z" />
          <path d="M26 44 H74 M42 30 L50 44 L58 30 M50 44 L50 76" fill="none" stroke-width="2" />
        </g>
      );
    default:
      return null;
  }
}

export function ClanEmblem({ emblem, color, size = 56, class: cls }: { emblem: string; color: string; size?: number; class?: string }) {
  const col = validColor(color);
  const id = validEmblem(emblem);
  return (
    <svg class={`clan-emblem ${cls ?? ''}`} viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <path d="M50 4 L90 16 V48 C90 73 72 89 50 97 C28 89 10 73 10 48 V16Z" fill={col} stroke={INK} stroke-width="5" stroke-linejoin="round" />
      <path d="M50 12 L82 21 V48 C82 68 68 81 50 88" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="3" />
      <path d="M50 12 L18 21 V48 C18 68 32 81 50 88" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="3" />
      <Glyph id={id} />
    </svg>
  );
}
