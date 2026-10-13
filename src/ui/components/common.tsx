import { createContext, type ComponentChildren } from 'preact';
import { createPortal, memo } from 'preact/compat';
import { useCallback, useContext, useEffect, useRef, useState } from 'preact/hooks';
import { CharacterArt } from '../../art/CharacterArt';
import { getHero } from '../../data/heroes';
import type { Currencies, Reward } from '../../game/state';
import { RARITY_INFO, ROLE_INFO, fmt } from '../../game/stats';
import type { OwnedHero, Rarity } from '../../game/types';
import { reducedMotion } from '../prefs';

export { AnimatedNumber, Burst, Skeleton, SkeletonList, flyRewards, useCountUp, useHoldRepeat } from './fx';

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
    case 'medals':
      return (
        <svg class="ico" viewBox="0 0 24 24" style={s}>
          <path d="M7 2 h4 l1 6 h-4Z M13 2 h4 l-1 6 h-4Z" fill="#e63946" stroke="#0b0710" stroke-width="1.6" stroke-linejoin="round" />
          <circle cx="12" cy="15" r="7" fill="#c0c7d6" stroke="#0b0710" stroke-width="2" />
          <path d="M12 10.5 l1.4 2.8 3 .4 -2.2 2.1 .5 3 -2.7-1.4 -2.7 1.4 .5-3 -2.2-2.1 3-.4Z" fill="#ffc531" stroke="#0b0710" stroke-width="0.9" stroke-linejoin="round" />
        </svg>
      );
    case 'crests':
      return (
        <svg class="ico" viewBox="0 0 24 24" style={s}>
          <path d="M12 2 L20 5 V11 C20 16 16.5 19.5 12 22 C7.5 19.5 4 16 4 11 V5Z" fill="#7b4fd0" stroke="#0b0710" stroke-width="2" stroke-linejoin="round" />
          <g fill="#3ddc84" stroke="#0b0710" stroke-width="0.9">
            <circle cx="10.2" cy="9.6" r="2" />
            <circle cx="13.8" cy="9.6" r="2" />
            <circle cx="10.2" cy="13.2" r="2" />
            <circle cx="13.8" cy="13.2" r="2" />
          </g>
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

export function RewardList({ r }: { r: Reward }) {
  const keys = (['yul', 'essence', 'gems', 'tickets', 'medals', 'crests'] as const).filter((k) => (r[k] ?? 0) > 0);
  const shards = Object.entries(r.shards ?? {}).filter(([, n]) => n > 0);
  let i = 0;
  return (
    <div class="rewards">
      {keys.map((k) => (
        <div class="reward" key={k} style={{ animationDelay: `${i++ * 0.08}s` }}>
          <CurrencyIcon kind={k} />+{fmt(r[k]!)}
        </div>
      ))}
      {shards.map(([id, n]) => (
        <div class="reward" key={id} style={{ animationDelay: `${i++ * 0.08}s` }}>
          <span class="reward-face">
            <CharacterArt id={id} mode="portrait" />
          </span>
          +{n} pages
        </div>
      ))}
      {r.passXp ? (
        <div class="reward" style={{ animationDelay: `${i++ * 0.08}s` }}>
          🎟️ +{fmt(r.passXp)} Pass XP
        </div>
      ) : null}
    </div>
  );
}

export const CURRENCY_NAMES: Record<keyof Currencies, string> = {
  yul: 'Yul',
  essence: 'Essence',
  gems: 'Gems',
  tickets: 'Summon Tickets',
  medals: 'Honor Medals',
  crests: 'Clan Crests',
};

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

// Press tilt: the card leans toward the finger and catches a highlight.
function tiltDown(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const px = (e.clientX - r.left) / r.width - 0.5;
  const py = (e.clientY - r.top) / r.height - 0.5;
  el.style.setProperty('--tx', `${(px * 18).toFixed(1)}deg`);
  el.style.setProperty('--ty', `${(-py * 18).toFixed(1)}deg`);
  el.style.setProperty('--gx', `${((px + 0.5) * 100).toFixed(0)}%`);
  el.style.setProperty('--gy', `${((py + 0.5) * 100).toFixed(0)}%`);
  el.classList.add('pressing');
}

function tiltUp(e: PointerEvent) {
  (e.currentTarget as HTMLElement).classList.remove('pressing');
}

export const HeroCard = memo(function HeroCard({ id, owned, locked, selected, inSquad, upgradable, onClick }: HeroCardProps) {
  const h = getHero(id);
  const rc = RARITY_INFO[h.rarity].color;
  const name = locked ? 'Unknown hero' : h.name;
  return (
    <button
      class={`hero-card ${h.rarity} ${locked ? 'locked' : ''} ${selected ? 'selected' : ''}`}
      style={{ '--hc': h.color, '--rc': rc } as any}
      onClick={onClick}
      onPointerDown={tiltDown}
      onPointerUp={tiltUp}
      onPointerLeave={tiltUp}
      onPointerCancel={tiltUp}
      data-hero={id}
      aria-label={`${name}${owned ? `, level ${owned.level}, ${owned.stars} stars` : ''}${inSquad ? ', in squad' : ''}${upgradable ? ', can upgrade' : ''}`}
    >
      <div class="card-bg" />
      <div class="card-art">
        <CharacterArt id={id} mode="full" />
      </div>
      <div class="card-frame" />
      <div class="card-shine" />
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

const ModalCloseContext = createContext<() => void>(() => {});

/** Inside a <Modal>: close it with its exit animation (e.g. after a confirm button). */
export function useModalClose(): () => void {
  return useContext(ModalCloseContext);
}

// Escape closes the most recently opened modal only.
const modalStack: (() => void)[] = [];
let escBound = false;
function bindEscape() {
  if (escBound || typeof window === 'undefined') return;
  escBound = true;
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalStack.length) {
      e.preventDefault();
      modalStack[modalStack.length - 1]();
    }
  });
}

const CLOSE_MS = 190;

export function Modal({ children, onClose, center, label }: { children: ComponentChildren; onClose: () => void; center?: boolean; label?: string }) {
  const [closing, setClosing] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closingRef = useRef(false);
  const alive = useRef(true);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; dy: number; t0: number; id: number } | null>(null);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (reducedMotion()) {
      onCloseRef.current();
      return;
    }
    setClosing(true);
    setTimeout(() => {
      if (alive.current) onCloseRef.current();
    }, CLOSE_MS);
  }, []);

  useEffect(() => {
    bindEscape();
    modalStack.push(requestClose);
    const prev = document.activeElement as HTMLElement | null;
    sheetRef.current?.focus({ preventScroll: true });
    return () => {
      alive.current = false;
      const i = modalStack.lastIndexOf(requestClose);
      if (i >= 0) modalStack.splice(i, 1);
      if (prev && prev !== document.body && document.contains(prev)) {
        try {
          prev.focus({ preventScroll: true });
        } catch {
          /* element can't take focus any more */
        }
      }
    };
  }, []);

  // Drag the sheet's grip down to dismiss it.
  const gripDown = (e: PointerEvent) => {
    if (center || closingRef.current) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { y0: e.clientY, dy: 0, t0: e.timeStamp, id: e.pointerId };
    sheetRef.current?.classList.add('dragging');
  };
  const gripMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !sheetRef.current) return;
    d.dy = Math.max(0, e.clientY - d.y0);
    sheetRef.current.style.transform = `translateY(${d.dy}px)`;
  };
  const gripUp = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const el = sheetRef.current;
    if (!el) return;
    el.classList.remove('dragging');
    const v = d.dy / Math.max(1, e.timeStamp - d.t0);
    if (d.dy > 110 || (d.dy > 30 && v > 0.6)) {
      el.style.setProperty('--drag', `${d.dy}px`);
      el.style.transform = '';
      requestClose();
    } else el.style.transform = '';
  };

  return (
    <Portal>
      <div
        class={`modal-wrap ${center ? 'center' : ''} ${closing ? 'closing' : ''}`}
        onClick={(e) => e.target === e.currentTarget && requestClose()}
      >
        <div class="modal" ref={sheetRef} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
          {!center && (
            <div class="sheet-grip" onPointerDown={gripDown} onPointerMove={gripMove} onPointerUp={gripUp} onPointerCancel={gripUp} aria-hidden="true">
              <i />
            </div>
          )}
          <button class="icon-btn modal-close" onClick={requestClose} aria-label="Close">
            ✕
          </button>
          <ModalCloseContext.Provider value={requestClose}>{children}</ModalCloseContext.Provider>
        </div>
      </div>
    </Portal>
  );
}

// ───────── toasts ─────────

export type ToastKind = 'info' | 'good' | 'bad' | 'reward';
type ToastMsg = { id: number; text: string; kind: ToastKind; out?: boolean };
let toastId = 0;
const toastListeners = new Set<(t: ToastMsg) => void>();
const TOAST_ICON: Record<ToastKind, string> = { info: '', good: '✔', bad: '!', reward: '✦' };

/** Pop a short message under the top bar. `kind` only changes the colour/icon. */
export function toast(text: string, kind: ToastKind = 'info') {
  const t = { id: ++toastId, text, kind };
  toastListeners.forEach((l) => l(t));
}

export function Toasts() {
  const [items, setItems] = useState<ToastMsg[]>([]);
  const dismiss = useRef((id: number) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, out: true } : x)));
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 260);
  }).current;
  useEffect(() => {
    const l = (t: ToastMsg) => {
      // Same text again replaces the old one instead of stacking duplicates.
      setItems((xs) => [...xs.filter((x) => x.text !== t.text).slice(-2), t]);
      setTimeout(() => dismiss(t.id), 2600);
    };
    toastListeners.add(l);
    return () => {
      toastListeners.delete(l);
    };
  }, []);
  return (
    <div class="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div class={`toast ${t.kind} ${t.out ? 'out' : ''}`} key={t.id} onClick={() => dismiss(t.id)}>
          {TOAST_ICON[t.kind] && <span class="toast-ico">{TOAST_ICON[t.kind]}</span>}
          <span>{t.text}</span>
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
