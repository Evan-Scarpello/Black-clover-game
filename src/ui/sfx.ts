// Tiny synthesized sound effects (no audio assets needed).
import { getState } from '../game/store';

let ctx: AudioContext | null = null;
let last: Record<string, number> = {};

function ac(): AudioContext | null {
  if (!getState().settings.sound) return null;
  try {
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur: number, vol: number, delay = 0) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  const g = a.createGain();
  const f = a.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1800;
  src.buffer = buf;
  g.gain.setValueAtTime(vol, t0);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t0);
}

/** Throttle so a 3x-speed battle doesn't become noise soup. */
function gate(key: string, ms: number): boolean {
  const now = performance.now();
  if (now - (last[key] ?? 0) < ms) return false;
  last[key] = now;
  return true;
}

export const sfx = {
  click: () => gate('click', 40) && tone(660, 0.06, 'square', 0.04),
  hit: () => gate('hit', 70) && noise(0.08, 0.12),
  crit: () => {
    if (!gate('crit', 90)) return;
    noise(0.12, 0.2);
    tone(220, 0.15, 'sawtooth', 0.06, -120);
  },
  heal: () => gate('heal', 150) && tone(880, 0.18, 'sine', 0.05, 440),
  ult: () => {
    tone(196, 0.5, 'sawtooth', 0.07, 400);
    tone(392, 0.45, 'square', 0.04, 600, 0.05);
    noise(0.3, 0.12, 0.1);
  },
  death: () => gate('death', 100) && tone(300, 0.35, 'triangle', 0.08, -220),
  coin: () => {
    tone(988, 0.08, 'square', 0.05);
    tone(1319, 0.18, 'square', 0.05, 0, 0.07);
  },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'square', 0.05, 0, i * 0.11)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, 0.35, 'triangle', 0.07, 0, i * 0.18)),
  summon: () => {
    tone(220, 1.2, 'sine', 0.06, 660);
    noise(0.6, 0.06, 0.6);
  },
  levelUp: () => gate('lvl', 60) && [659, 880].forEach((f, i) => tone(f, 0.09, 'square', 0.04, 0, i * 0.05)),
  starUp: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'square', 0.045, 0, i * 0.08)),
  swap: () => gate('swap', 60) && tone(440, 0.08, 'triangle', 0.06, 220),
  reveal: (tier: number) => {
    const base = [523, 587, 784, 1047][tier] ?? 523;
    tone(base, 0.3, 'triangle', 0.07);
    if (tier >= 2) tone(base * 1.5, 0.5, 'square', 0.04, 0, 0.12);
    if (tier >= 3) [0, 1, 2].forEach((i) => tone(base * 2, 0.2, 'square', 0.04, 0, 0.25 + i * 0.1));
  },
};
