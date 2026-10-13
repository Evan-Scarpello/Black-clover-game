// Damage-meter math for the battle screen (pure; unit-tested in tests/ui.test.ts).

export interface MeterUnit {
  uid: string;
  side: 0 | 1;
  alive: boolean;
  dmgDealt: number;
  healDone: number;
  dmgTaken?: number;
  def: { id: string; name: string };
}

export interface MeterRow {
  uid: string;
  heroId: string;
  name: string;
  dmg: number;
  heal: number;
  taken: number;
  alive: boolean;
  /** 0..1 bar lengths on one shared scale (the side's biggest number). */
  dmgPct: number;
  healPct: number;
  /** Share of the side's total damage, 0..1. */
  share: number;
}

const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);

/** One side's rows, biggest contributors first. */
export function meterRows(units: readonly MeterUnit[], side: 0 | 1): MeterRow[] {
  const mine = units.filter((u) => u.side === side);
  const total = mine.reduce((a, u) => a + num(u.dmgDealt), 0);
  const top = Math.max(1, ...mine.map((u) => Math.max(num(u.dmgDealt), num(u.healDone))));
  return mine
    .map((u) => {
      const dmg = num(u.dmgDealt);
      const heal = num(u.healDone);
      return {
        uid: u.uid,
        heroId: u.def.id,
        name: u.def.name.split(' ')[0],
        dmg,
        heal,
        taken: num(u.dmgTaken),
        alive: u.alive,
        dmgPct: dmg / top,
        healPct: heal / top,
        share: total ? dmg / total : 0,
      };
    })
    .sort((a, b) => b.dmg + b.heal - (a.dmg + a.heal) || a.uid.localeCompare(b.uid));
}

/** Total damage a side has dealt. */
export function sideDamage(units: readonly MeterUnit[], side: 0 | 1): number {
  return units.filter((u) => u.side === side).reduce((a, u) => a + num(u.dmgDealt), 0);
}

/** "0:42" style clock for a number of seconds (never negative). */
export function clock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec - 1e-6));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Raid timer urgency: 'calm' → 'warn' (≤ 20s) → 'danger' (≤ 10s). */
export function timerLevel(remaining: number): 'calm' | 'warn' | 'danger' {
  return remaining <= 10 ? 'danger' : remaining <= 20 ? 'warn' : 'calm';
}
