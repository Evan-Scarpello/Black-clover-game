// Device-only UI preferences (vibration, reduced motion). They live in localStorage —
// not the save — because they describe this device, not the player's progress.
// Every storage access is guarded: localStorage can be missing or throw (private mode, artifacts).

export type MotionPref = 'system' | 'reduce';

const VIBRATION_KEY = 'bcgs/ui/vibration';
const MOTION_KEY = 'bcgs/ui/motion';

function read(key: string): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — keep the value for this session only */
  }
}

let vibration: boolean | null = null;
let motion: MotionPref | null = null;
const listeners = new Set<() => void>();

export function onPrefsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function vibrationEnabled(): boolean {
  if (vibration === null) vibration = read(VIBRATION_KEY) !== 'off';
  return vibration;
}

export function setVibrationEnabled(on: boolean) {
  vibration = on;
  write(VIBRATION_KEY, on ? 'on' : 'off');
  listeners.forEach((l) => l());
}

export function motionPref(): MotionPref {
  if (motion === null) motion = read(MOTION_KEY) === 'reduce' ? 'reduce' : 'system';
  return motion;
}

export function setMotionPref(p: MotionPref) {
  motion = p;
  write(MOTION_KEY, p);
  listeners.forEach((l) => l());
}

/** True when animations should be skipped (OS setting or the in-game toggle). */
export function reducedMotion(): boolean {
  if (motionPref() === 'reduce') return true;
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** Test hook: forget cached values so the next read hits storage again. */
export function _resetPrefsCache() {
  vibration = null;
  motion = null;
}
