import { describe, expect, it, vi } from 'vitest';
import {
  TAB_ORDER,
  VelocityTracker,
  classifyIntent,
  countDuration,
  deltaText,
  neighborTab,
  rubberBand,
  shouldCommit,
  stageLabel,
  tabDirection,
  tween,
  unlockText,
} from '../src/ui/motion';
import { BASE_PLOTS, MAP_W, PREFERRED_PLOT, layoutHub, toPct } from '../src/ui/hub/layout';
import { HAPTIC_PATTERNS, haptic } from '../src/ui/haptics';
import { _resetPrefsCache, motionPref, reducedMotion, setMotionPref, setVibrationEnabled, vibrationEnabled } from '../src/ui/prefs';

describe('tab navigation math', () => {
  it('orders tabs like the bottom nav', () => {
    expect(TAB_ORDER).toEqual(['home', 'heroes', 'campaign', 'squad', 'summon']);
  });
  it('slides toward the destination', () => {
    expect(tabDirection('home', 'summon')).toBe(1);
    expect(tabDirection('squad', 'heroes')).toBe(-1);
    expect(tabDirection('campaign', 'campaign')).toBe(0);
  });
  it('finds neighbours and stops at the ends', () => {
    expect(neighborTab('home', 1)).toBe('heroes');
    expect(neighborTab('home', -1)).toBeNull();
    expect(neighborTab('summon', 1)).toBeNull();
    expect(neighborTab('summon', -1)).toBe('squad');
  });
});

describe('gesture intent', () => {
  it('waits inside the slop radius', () => {
    expect(classifyIntent(4, 3)).toBe('pending');
    expect(classifyIntent(-9, 9)).toBe('pending');
  });
  it('needs a clear horizontal lead', () => {
    expect(classifyIntent(30, 4)).toBe('horizontal');
    expect(classifyIntent(-30, 10)).toBe('horizontal');
    expect(classifyIntent(14, 12)).toBe('vertical');
    expect(classifyIntent(2, 40)).toBe('vertical');
  });
  it('commits long drags and quick flicks only', () => {
    expect(shouldCommit(-150, 0, 390)).toBe(true);
    expect(shouldCommit(-60, 0, 390)).toBe(false);
    expect(shouldCommit(-60, -0.8, 390)).toBe(true);
    // a flick against the drag direction does not count
    expect(shouldCommit(-60, 0.8, 390)).toBe(false);
    // tiny twitch with velocity is ignored
    expect(shouldCommit(10, 2, 390)).toBe(false);
    expect(shouldCommit(0, 2, 390)).toBe(false);
    expect(shouldCommit(100, 0, 0)).toBe(false);
  });
  it('rubber-bands toward a limit', () => {
    expect(rubberBand(0)).toBe(0);
    expect(Math.abs(rubberBand(10000, 72))).toBeLessThan(72);
    expect(rubberBand(-50, 72)).toBeLessThan(0);
    expect(Math.abs(rubberBand(40, 72))).toBeLessThan(40);
  });
  it('measures velocity over a short window', () => {
    const v = new VelocityTracker(100);
    expect(v.velocity()).toBe(0);
    v.add(0, 0);
    v.add(10, 10);
    v.add(30, 20);
    expect(v.velocity()).toBeCloseTo(1.5);
    v.add(30, 400);
    v.add(30, 420);
    expect(v.velocity()).toBe(0);
  });
});

describe('tweens and labels', () => {
  it('tweens and clamps', () => {
    expect(tween(0, 100, 0.5)).toBe(50);
    expect(tween(0, 100, 2)).toBe(100);
    expect(tween(10, 0, -1)).toBe(10);
  });
  it('keeps count-ups snappy', () => {
    expect(countDuration(5, 5)).toBe(0);
    expect(countDuration(0, 10)).toBeGreaterThanOrEqual(320);
    expect(countDuration(0, 1e12)).toBeLessThanOrEqual(900);
  });
  it('formats stage unlock requirements', () => {
    expect(stageLabel(1)).toBe('1-1');
    expect(stageLabel(5)).toBe('1-5');
    expect(stageLabel(10)).toBe('1-10');
    expect(stageLabel(11)).toBe('2-1');
    expect(stageLabel(27)).toBe('3-7');
    expect(stageLabel(0)).toBe('1-1');
    expect(unlockText(10, 3)).toBe('Clear 1-10');
    expect(unlockText(10, 10)).toBeNull();
    expect(unlockText(undefined, 0)).toBeNull();
  });
  it('formats currency deltas', () => {
    const short = (n: number) => String(n);
    expect(deltaText(0, short)).toBe('');
    expect(deltaText(120, short)).toBe('+120');
    expect(deltaText(-300, short)).toBe('-300');
  });
});

describe('hub layout', () => {
  const known = ['arena', 'clan', 'tower', 'dispatch', 'shop', 'pass', 'login', 'achievements'];
  it('puts known screens on their art-matched plot', () => {
    const l = layoutHub(known);
    for (const { id, plot } of l.placements) expect(plot.key).toBe(PREFERRED_PLOT[id]);
    expect(l.gateY).toBeGreaterThan(Math.max(...BASE_PLOTS.map((p) => p.y)));
    expect(l.height).toBeGreaterThan(l.gateY);
  });
  it('fits unknown and extra screens without overlaps and grows the map', () => {
    const ids = [...known, 'raids', 'guild-war', 'fishing', 'casino'];
    const l = layoutHub(ids);
    expect(l.placements).toHaveLength(ids.length);
    const spots = new Set(l.placements.map((p) => `${p.plot.x},${p.plot.y}`));
    expect(spots.size).toBe(ids.length);
    for (const p of l.placements) {
      expect(p.plot.x).toBeGreaterThan(0);
      expect(p.plot.x).toBeLessThan(MAP_W);
      expect(p.plot.y).toBeLessThan(l.gateY);
    }
    expect(l.height).toBeGreaterThan(layoutHub(known).height);
  });
  it('fills free base plots before adding rows and ignores duplicates', () => {
    const l = layoutHub(['mystery', 'arena', 'arena']);
    expect(l.placements).toHaveLength(2);
    expect(l.placements.find((p) => p.id === 'arena')!.plot.key).toBe('a');
    expect(l.placements.find((p) => p.id === 'mystery')!.plot.key).toBe('b');
    expect(layoutHub([]).placements).toHaveLength(0);
  });
  it('converts map units to percentages', () => {
    expect(toPct(200, 500, 1000)).toEqual({ left: '50.000%', top: '50.000%' });
  });
});

describe('device prefs and haptics', () => {
  it('survive missing storage and navigator', () => {
    _resetPrefsCache();
    expect(vibrationEnabled()).toBe(true);
    expect(motionPref()).toBe('system');
    expect(reducedMotion()).toBe(false);
    expect(haptic('heavy')).toBe(false);
  });
  it('persist toggles to storage and gate vibration', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    _resetPrefsCache();
    expect(haptic('success')).toBe(true);
    expect(vibrate).toHaveBeenCalledWith(HAPTIC_PATTERNS.success);
    setVibrationEnabled(false);
    expect(haptic('heavy')).toBe(false);
    expect(vibrate).toHaveBeenCalledTimes(1);
    _resetPrefsCache();
    expect(vibrationEnabled()).toBe(false);
    setMotionPref('reduce');
    _resetPrefsCache();
    expect(reducedMotion()).toBe(true);
    vi.unstubAllGlobals();
  });
  it('never throws when storage or vibrate explode', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    });
    vi.stubGlobal('navigator', {
      vibrate: () => {
        throw new Error('nope');
      },
    });
    _resetPrefsCache();
    expect(() => setVibrationEnabled(true)).not.toThrow();
    expect(haptic('heavy')).toBe(false);
    vi.unstubAllGlobals();
    _resetPrefsCache();
  });
});
