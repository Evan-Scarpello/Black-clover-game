// Small shared UI pieces for the progression pages.
import { CharacterArt } from '../../art/CharacterArt';
import { HERO_MAP } from '../../data/heroes';
import type { Currencies, Reward } from '../../game/state';
import { RARITY_INFO, fmtShort } from '../../game/stats';
import { CurrencyIcon } from '../../ui/components/common';

const KEYS: (keyof Currencies)[] = ['gems', 'tickets', 'yul', 'essence', 'medals', 'crests'];

export type RewardItem = { kind: 'cur'; key: keyof Currencies; n: number } | { kind: 'hero'; id: string; n: number } | { kind: 'xp'; n: number };

/** Flatten a reward into display items, most exciting first (pages, gems, tickets…). */
export function rewardItems(r: Reward): RewardItem[] {
  const out: RewardItem[] = [];
  for (const [id, n] of Object.entries(r.shards ?? {})) if (n > 0 && HERO_MAP[id]) out.push({ kind: 'hero', id, n });
  for (const k of KEYS) if ((r[k] ?? 0) > 0) out.push({ kind: 'cur', key: k, n: r[k]! });
  if ((r.passXp ?? 0) > 0) out.push({ kind: 'xp', n: r.passXp! });
  return out;
}

export function HeroFace({ id, size = 34 }: { id: string; size?: number }) {
  const h = HERO_MAP[id];
  const rc = h ? RARITY_INFO[h.rarity].color : '#888';
  return (
    <span class="prog-face" style={{ width: size, height: size, borderColor: rc, background: h?.color ?? '#333' } as any}>
      <CharacterArt id={id} mode="portrait" />
    </span>
  );
}

/** Compact icon+amount chips. */
export function RewardChips({ r, size = 18, max }: { r: Reward; size?: number; max?: number }) {
  const items = rewardItems(r).slice(0, max ?? 99);
  return (
    <span class="prog-chips">
      {items.map((it, i) => (
        <span class="prog-rc" key={i}>
          {it.kind === 'hero' ? <HeroFace id={it.id} size={size + 6} /> : it.kind === 'cur' ? <CurrencyIcon kind={it.key} size={size} /> : <span style={{ fontSize: size - 2 }}>🎟️</span>}
          <b>{it.kind === 'hero' ? `×${it.n}` : fmtShort(it.n)}</b>
        </span>
      ))}
    </span>
  );
}

/** Human summary for toasts: "+300 Gems · +3 Tickets · +10 Noelle pages". */
export function rewardText(r: Reward): string {
  const names: Record<keyof Currencies, string> = { yul: 'Yul', essence: 'Essence', gems: 'Gems', tickets: 'Tickets', medals: 'Medals', crests: 'Crests' };
  return rewardItems(r)
    .map((it) => (it.kind === 'hero' ? `+${it.n} ${HERO_MAP[it.id]?.name.split(' ')[0] ?? 'hero'} pages` : it.kind === 'cur' ? `+${fmtShort(it.n)} ${it.key === 'tickets' && it.n === 1 ? 'Ticket' : names[it.key]}` : `+${it.n} Pass XP`))
    .join(' · ');
}

/** Milliseconds until local midnight (daily reset). */
export function msToMidnight(now: number): number {
  const d = new Date(now);
  d.setHours(24, 0, 0, 0);
  return d.getTime() - now;
}
