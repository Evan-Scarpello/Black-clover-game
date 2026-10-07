import type { ComponentChildren } from 'preact';
import { createPortal, memo } from 'preact/compat';
import { useEffect, useState } from 'preact/hooks';
import { CharacterArt } from '../../art/CharacterArt';
import { getHero } from '../../data/heroes';
import type { Currencies } from '../../game/state';
import { RARITY_INFO, ROLE_INFO, fmt } from '../../game/stats';
import type { OwnedHero, Rarity } from '../../game/types';

// ───────── currency icons ─────────

export function CurrencyIcon({ kind, size = 20 }: { kind: keyof Currencies; size?: number }) {
  const s = { width: size, height: size };
  switch (kind) {
    case 'yul':
      return (
        <svg class="ico" viewBox="0 0 24 24" style={s}>
          <circle cx="12" cy="12" r="10" fill="#ffc531" stroke="#0b0710" stroke-width="2" />
          <circle cx="12" cy="12" r="6.5" fill="none" stroke="#c98a00" stroke-width="1.6" />
          <text x="12" y="16" text-anchor="middle" font-size="10" font-weight="900" fill="#7a4d00" font-family="Nunito, sans-serif">
            Y
          </text>
        </svg>
      );
    case 'essence':
      return (
        <svg class="ico" viewBox="0 0 24 24" style={s}>
          <path d="M12 2 C16 8 19 11 19 15 a7 7 0 0 1 -14 0 C5 11 8 8 12 2Z" fill="#4fc3f7" stroke="#0b0710" stroke-width="2" stroke-linejoin="round" />
          <path d="M9 14 a3 3 0 0 0 3 3" stroke="#e1f5fe" stroke-width="2" fill="none" stroke-linecap="round" />
        </svg>
      );
    case 'gems':
      return (
        <svg class="ico" viewBox="0 0 24 24" style={s}>
          <path d="M6 3 h12 l4 6 -10 13 L2 9Z" fill="#3ddc84" stroke="#0b0710" stroke-width="2" stroke-linejoin="round" />
          <path d="M2 9 h20 M8.5 3 L12 22 M15.5 3 L12 22" stroke="#0e7a43" stroke-width="1.3" fill="none" />
          <path d="M7 5 l2 3" stroke="#d6ffe8" stroke-width="1.6" stroke-linecap="round" />
        </svg>
      );
    case 'tickets':
      return (
        <svg class="ico" viewBox="0 0 24 24" style={s}>
          <path d="M3 6 h18 v4 a2 2 0 0 0 0 4 v4 H3 v-4 a2 2 0 0 0 0 -4Z" fill="#ff6fa8" stroke="#0b0710" stroke-width="2" stroke-linejoin="round" />
          <g fill="#fff" stroke="#0b0710" stroke-width="0.8">
            <circle cx="10.5" cy="10.5" r="1.8" />
            <circle cx="13.5" cy="10.5" r="1.8" />
            <circle cx="10.5" cy="13.5" r="1.8" />
            <circle cx="13.5" cy="13.5" r="1.8" />
          </g>
        </svg>
      );
  }
}

export function Cost({ kind, amount }: { kind: keyof Currencies; amount: number }) {
  return (
    <span class="cost">
      <CurrencyIcon kind={kind} size={16} />
      {fmt(amount)}
    </span>
  );
}

export function RewardList({ r }: { r: Partial<Currencies> }) {
  const keys = (['yul', 'essence', 'gems', 'tickets'] as const).filter((k) => (r[k] ?? 0) > 0);
  return (
    <div class="rewards">
      {keys.map((k, i) => (
        <div class="reward" key={k} style={{ animationDelay: `${i * 0.08}s` }}>
          <CurrencyIcon kind={k} />+{fmt(r[k]!)}
        </div>
      ))}
    </div>
  );
}

// ───────── badges ─────────

export function Stars({ n, max }: { n: number; max?: number }) {
  return (
    <span class="stars">
      {'★'.repeat(n)}
      {max ? <span style={{ opacity: 0.25 }}>{'★'.repeat(Math.max(0, max - n))}</span> : null}
    </span>
  );
}

export function RarityBadge({ r, short, class: cls }: { r: Rarity; short?: boolean; class?: string }) {
  return <span class={`rarity ${r} ${cls ?? ''}`}>{short ? r : RARITY_INFO[r].name}</span>;
}

// ───────── hero card ─────────

interface HeroCardProps {
  id: string;
  owned?: OwnedHero | null;
  locked?: boolean;
  selected?: boolean;
  inSquad?: boolean;
  upgradable?: boolean;
  onClick?: () => void;
}

export const HeroCard = memo(function HeroCard({ id, owned, locked, selected, inSquad, upgradable, onClick }: HeroCardProps) {
  const h = getHero(id);
  const rc = RARITY_INFO[h.rarity].color;
  return (
    <button
      class={`hero-card ${h.rarity} ${locked ? 'locked' : ''} ${selected ? 'selected' : ''}`}
      style={{ '--hc': h.color, '--rc': rc } as any}
      onClick={onClick}
    >
      <div class="card-bg" />
      <div class="card-art">
        <CharacterArt id={id} mode="full" />
      </div>
      <div class="card-frame" />
      {owned && <div class="card-lv">Lv{owned.level}</div>}
      <div class="card-role">{ROLE_INFO[h.role].icon}</div>
      <RarityBadge r={h.rarity} short class="card-rar" />
      <div class="card-name">
        {locked ? '???' : h.name.split(' ')[0]}
        <Stars n={owned?.stars ?? RARITY_INFO[h.rarity].startStars} />
      </div>
      {inSquad && <div class="in-squad">IN SQUAD</div>}
      {upgradable && <div class="upg">▲</div>}
    </button>
  );
});

// ───────── modal ─────────

/** Render overlays at the shell level so they cover the whole phone frame, not the scroll area. */
export function Portal({ children }: { children: ComponentChildren }) {
  const host = document.querySelector('.shell');
  return host ? createPortal(children as any, host) : <>{children}</>;
}

export function Modal({ children, onClose, center }: { children: ComponentChildren; onClose: () => void; center?: boolean }) {
  return (
    <Portal>
    <div class={`modal-wrap ${center ? 'center' : ''}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal">
        <button class="icon-btn modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        {children}
      </div>
    </div>
    </Portal>
  );
}

// ───────── toasts ─────────

type ToastMsg = { id: number; text: string };
let toastId = 0;
const toastListeners = new Set<(t: ToastMsg) => void>();

export function toast(text: string) {
  const t = { id: ++toastId, text };
  toastListeners.forEach((l) => l(t));
}

export function Toasts() {
  const [items, setItems] = useState<ToastMsg[]>([]);
  useEffect(() => {
    const l = (t: ToastMsg) => {
      setItems((xs) => [...xs.slice(-3), t]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== t.id)), 2700);
    };
    toastListeners.add(l);
    return () => {
      toastListeners.delete(l);
    };
  }, []);
  return (
    <div class="toasts">
      {items.map((t) => (
        <div class="toast" key={t.id}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}m ${(s % 60).toString().padStart(2, '0')}s`;
}
