// Haptic feedback through navigator.vibrate (Android / some browsers; a silent no-op on iOS).
// Gated by the Vibration toggle in Settings.
import { vibrationEnabled } from './prefs';

export type HapticKind = 'tap' | 'light' | 'medium' | 'heavy' | 'success' | 'rare' | 'error';

export const HAPTIC_PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 6,
  light: 12,
  medium: 24,
  heavy: [30, 40, 50],
  success: [14, 60, 28],
  rare: [20, 40, 20, 40, 70],
  error: [40, 40, 40],
};

let lastAt = 0;

export function haptic(kind: HapticKind = 'light'): boolean {
  if (!vibrationEnabled()) return false;
  try {
    const now = Date.now();
    // Bursts of taps (hold-to-level) shouldn't buzz continuously.
    if ((kind === 'tap' || kind === 'light') && now - lastAt < 70) return false;
    lastAt = now;
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }) : null;
    if (!nav || typeof nav.vibrate !== 'function') return false;
    return !!nav.vibrate(HAPTIC_PATTERNS[kind]);
  } catch {
    return false;
  }
}
