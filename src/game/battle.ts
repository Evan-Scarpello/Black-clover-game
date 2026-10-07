// Deterministic, tick-based auto-battle engine.
// The UI steps it in real time and renders the emitted events; the idle/skip
// paths just run it to completion.

import { getHero } from '../data/heroes';
import { addMods, applyMods, rawStats } from './stats';
import { rng as makeRng, type Rng } from './rng';
import { teamBonuses } from './team';
import type { Effect, FormationDef, HeroDef, Row, StatMods, Stats, StatusId, TargetSel } from './types';

export interface Combatant {
  heroId: string;
  level: number;
  stars: number;
  slot: number;
  boss?: boolean;
  /** Enemy difficulty multiplier applied to HP / ATK / DEF. */
  mult?: number;
}

export interface TeamSetup {
  members: Combatant[];
  formation: FormationDef;
}

export interface StatusInst {
  id: StatusId;
  t: number;
  max: number;
  value: number;
  tick: number;
}

export interface Unit {
  uid: string;
  def: HeroDef;
  side: 0 | 1;
  slot: number;
  row: Row;
  startRow: Row;
  level: number;
  stars: number;
  boss: boolean;
  raw: Stats;
  permMods: StatMods;
  rowMods: { front: StatMods; back: StatMods };
  maxHp: number;
  hp: number;
  shield: number;
  shieldT: number;
  energy: number;
  cd: number;
  alive: boolean;
  statuses: StatusInst[];
  fired: Set<string>;
  everyT: number[];
  dmgDealt: number;
  dmgTaken: number;
  healDone: number;
}

export type BattleEvent =
  | { t: 'basic'; src: string; target: string }
  | { t: 'ult'; src: string; name: string; shout: string; color: string }
  | { t: 'dmg'; src?: string; target: string; amount: number; crit: boolean; kind: 'hit' | 'dot' | 'reflect'; dot?: StatusId; absorbed: number }
  | { t: 'heal'; target: string; amount: number }
  | { t: 'shield'; target: string; amount: number }
  | { t: 'shieldBreak'; target: string }
  | { t: 'status'; target: string; status: StatusId }
  | { t: 'move'; target: string; row: Row }
  | { t: 'death'; target: string }
  | { t: 'revive'; target: string }
  | { t: 'fate'; target: string }
  | { t: 'passive'; src: string; name: string }
  | { t: 'end'; winner: 0 | 1 };

export const ACTION_INTERVAL = 2.4;
export const TIME_LIMIT = 90;
/** After this many seconds healing is halved and damage ramps up to break stalemates. */
export const OVERTIME = 45;
const DEF_K = 300;
const BUFFS: StatusId[] = ['atkUp', 'defUp', 'spdUp', 'regen', 'taunt', 'reflect', 'fate'];
const DEBUFFS: StatusId[] = ['stun', 'silence', 'burn', 'poison', 'bleed', 'atkDown', 'defDown', 'spdDown', 'mark'];
const DOTS: StatusId[] = ['burn', 'poison', 'bleed'];

interface Ctx {
  caster: Unit;
  last: Unit[];
}

export class Battle {
  units: Unit[] = [];
  time = 0;
  over = false;
  winner: 0 | 1 | null = null;
  events: BattleEvent[] = [];
  autoUlt: [boolean, boolean] = [true, true];
  ultsCast: [number, number] = [0, 0];
  timeLimit = TIME_LIMIT;
  frontSlots: [number, number];
  private rand: Rng;
  private pending: string[] = [];
  private started = false;

  constructor(a: TeamSetup, b: TeamSetup, seed: number) {
    this.rand = makeRng(seed);
    this.frontSlots = [a.formation.rows.filter((r) => r === 'front').length, b.formation.rows.filter((r) => r === 'front').length];
    this.build(a, 0);
    this.build(b, 1);
  }

  private build(team: TeamSetup, side: 0 | 1) {
    const bonus = teamBonuses(team.members.map((m) => m.heroId));
    for (const m of team.members) {
      const def = getHero(m.heroId);
      const raw = rawStats(def, m.level, m.stars);
      if (m.mult) {
        raw.hp *= m.mult;
        raw.atk *= m.mult;
        raw.def *= m.mult;
      }
      if (m.boss) {
        raw.hp *= 3.5;
        raw.atk *= 1.25;
        raw.def *= 1.15;
      }
      const permMods: StatMods = {};
      addMods(permMods, def.passive.stats);
      addMods(permMods, bonus.perHero[m.heroId]);
      const front = addMods(addMods({}, team.formation.front), def.formation.front);
      const back = addMods(addMods({}, team.formation.back), def.formation.back);
      const row = team.formation.rows[m.slot] ?? 'back';
      const startMods = addMods(addMods({}, permMods), row === 'front' ? front : back);
      const maxHp = Math.round(applyMods(raw, startMods).hp);
      const u: Unit = {
        uid: `${side}-${m.slot}`,
        def,
        side,
        slot: m.slot,
        row,
        startRow: row,
        level: m.level,
        stars: m.stars,
        boss: !!m.boss,
        raw,
        permMods,
        rowMods: { front, back },
        maxHp,
        hp: maxHp,
        shield: 0,
        shieldT: 0,
        energy: 0,
        cd: 0,
        alive: true,
        statuses: [],
        fired: new Set(),
        everyT: (def.passive.triggers ?? []).map((t) => t.interval ?? 0),
        dmgDealt: 0,
        dmgTaken: 0,
        healDone: 0,
      };
      u.cd = (ACTION_INTERVAL * (0.25 + this.rand() * 0.6) * 100) / this.stat(u).spd;
      this.units.push(u);
    }
  }

  // ───────── public API ─────────

  unit(uid: string): Unit | undefined {
    return this.units.find((u) => u.uid === uid);
  }

  start() {
    if (this.started) return;
    this.started = true;
    for (const u of this.units) this.fire(u, 'battleStart');
  }

  requestUlt(uid: string) {
    if (!this.pending.includes(uid)) this.pending.push(uid);
  }

  canCast(u: Unit): boolean {
    return u.alive && u.energy >= 100 && !this.has(u, 'stun') && !this.has(u, 'silence');
  }

  /** Advance the simulation by dt seconds. */
  step(dt: number) {
    if (!this.started) this.start();
    if (this.over) return;
    this.time += dt;

    for (const u of this.units) {
      if (!u.alive) continue;
      this.tickStatuses(u, dt);
      if (this.over) return;
    }

    while (this.pending.length) {
      const u = this.unit(this.pending.shift()!);
      if (u && this.canCast(u)) this.castUlt(u);
      if (this.over) return;
    }

    for (const u of this.units) {
      if (!u.alive || this.over) continue;
      if (this.autoUlt[u.side] && this.canCast(u)) {
        this.castUlt(u);
        if (this.over) return;
      }
      if (!u.alive || this.has(u, 'stun')) continue;
      u.cd -= (dt * this.stat(u).spd) / 100;
      if (u.cd <= 0) {
        u.cd += ACTION_INTERVAL;
        this.basicAttack(u);
      }
    }

    if (!this.over && this.time >= this.timeLimit) this.end(1);
  }

  /** Run to completion (for skip / offline simulation). */
  runToEnd(dt = 0.1): 0 | 1 {
    let guard = 0;
    while (!this.over && guard++ < 100000) this.step(dt);
    this.events.length = 0;
    return this.winner ?? 1;
  }

  drainEvents(): BattleEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ───────── stats ─────────

  stat(u: Unit): Stats {
    const mods: StatMods = {};
    addMods(mods, u.permMods);
    addMods(mods, u.rowMods[u.row]);
    for (const s of u.statuses) {
      switch (s.id) {
        case 'atkUp': mods.atk = (mods.atk ?? 0) + s.value; break;
        case 'atkDown': mods.atk = (mods.atk ?? 0) - s.value; break;
        case 'defUp': mods.def = (mods.def ?? 0) + s.value; break;
        case 'defDown': mods.def = (mods.def ?? 0) - s.value; break;
        case 'spdUp': mods.spd = (mods.spd ?? 0) + s.value; break;
        case 'spdDown': mods.spd = (mods.spd ?? 0) - s.value; break;
      }
    }
    return applyMods(u.raw, mods);
  }

  has(u: Unit, id: StatusId): boolean {
    return u.statuses.some((s) => s.id === id);
  }

  private statusVal(u: Unit, id: StatusId): number {
    return u.statuses.find((s) => s.id === id)?.value ?? 0;
  }

  // ───────── turn logic ─────────

  private tickStatuses(u: Unit, dt: number) {
    if (u.shieldT > 0) {
      u.shieldT -= dt;
      if (u.shieldT <= 0) u.shield = 0;
    }
    for (const s of [...u.statuses]) {
      s.t -= dt;
      if (DOTS.includes(s.id) || s.id === 'regen') {
        s.tick -= dt;
        while (s.tick <= 0 && u.alive) {
          s.tick += 1;
          if (s.id === 'regen') this.heal(null, u, s.value);
          else this.applyDamage(null, u, Math.max(1, Math.round(s.value * (1 + this.statusVal(u, 'mark')) * this.overtimeDamage())), 'dot', false, false, s.id);
        }
        if (!u.alive || this.over) return;
      }
    }
    u.statuses = u.statuses.filter((s) => s.t > 0);
    const trig = u.def.passive.triggers ?? [];
    trig.forEach((tr, i) => {
      if (tr.on !== 'every' || !u.alive) return;
      u.everyT[i] -= dt;
      if (u.everyT[i] <= 0) {
        u.everyT[i] += tr.interval ?? 5;
        this.runEffects({ caster: u, last: [] }, tr.effects);
      }
    });
  }

  private basicAttack(u: Unit) {
    const target = this.pickAuto(u);
    if (!target) return;
    this.events.push({ t: 'basic', src: u.uid, target: target.uid });
    const hits = u.def.basic.hits ?? 1;
    for (let i = 0; i < hits; i++) this.dealDamage(u, target, u.def.basic.mult ?? 1, {});
    this.gainEnergy(u, 22);
    if (u.alive) this.fire(u, 'basic', [target]);
  }

  private castUlt(u: Unit) {
    u.energy = 0;
    this.ultsCast[u.side]++;
    const ult = u.def.ultimate;
    this.events.push({ t: 'ult', src: u.uid, name: ult.name, shout: ult.shout, color: u.def.color });
    this.runEffects({ caster: u, last: [] }, ult.effects);
    if (u.alive) this.fire(u, 'ultimate');
  }

  private fire(u: Unit, on: string, last: Unit[] = []) {
    const trig = u.def.passive.triggers;
    if (!trig) return;
    trig.forEach((tr, i) => {
      if (tr.on !== on) return;
      const key = `t${i}`;
      if (tr.once && u.fired.has(key)) return;
      if (tr.chance !== undefined && this.rand() >= tr.chance) return;
      if (tr.once) u.fired.add(key);
      if (on !== 'basic' && on !== 'every') this.events.push({ t: 'passive', src: u.uid, name: u.def.passive.name });
      this.runEffects({ caster: u, last }, tr.effects);
    });
  }

  private checkThresholds(t: Unit) {
    const pct = t.hp / t.maxHp;
    (t.def.passive.triggers ?? []).forEach((tr, i) => {
      if (tr.on !== 'lowHp') return;
      const key = `low${i}`;
      if (t.fired.has(key) || pct >= (tr.threshold ?? 0.3)) return;
      t.fired.add(key);
      this.events.push({ t: 'passive', src: t.uid, name: t.def.passive.name });
      this.runEffects({ caster: t, last: [t] }, tr.effects);
    });
    if (t.row !== 'front') return;
    for (const a of this.allies(t)) {
      if (a === t) continue;
      (a.def.passive.triggers ?? []).forEach((tr, i) => {
        if (tr.on !== 'allyLowHp') return;
        const key = `ally${i}:${t.uid}`;
        if (a.fired.has(key) || pct >= (tr.threshold ?? 0.3) || !t.alive) return;
        a.fired.add(key);
        this.events.push({ t: 'passive', src: a.uid, name: a.def.passive.name });
        this.runEffects({ caster: a, last: [t] }, tr.effects);
      });
    }
  }

  // ───────── targeting ─────────

  private allies(u: Unit): Unit[] {
    return this.units.filter((x) => x.side === u.side && x.alive);
  }

  private enemies(u: Unit): Unit[] {
    return this.units.filter((x) => x.side !== u.side && x.alive);
  }

  private pct(u: Unit) {
    return u.hp / u.maxHp;
  }

  private pick<T>(arr: T[]): T | undefined {
    return arr.length ? arr[Math.floor(this.rand() * arr.length)] : undefined;
  }

  private pickAuto(u: Unit): Unit | undefined {
    const foes = this.enemies(u);
    if (!foes.length) return undefined;
    const taunters = foes.filter((f) => this.has(f, 'taunt'));
    if (taunters.length) return this.pick(taunters);
    const front = foes.filter((f) => f.row === 'front');
    const back = foes.filter((f) => f.row === 'back');
    let pool = front.length ? front : back;
    if (u.def.range === 'ranged' && front.length && back.length && this.rand() < 0.3) pool = back;
    // Defenders draw more aggro.
    const weighted: Unit[] = [];
    for (const p of pool) {
      weighted.push(p);
      if (p.def.role === 'Defender') weighted.push(p);
    }
    return this.pick(weighted);
  }

  private resolve(ctx: Ctx, sel: TargetSel): Unit[] {
    const me = ctx.caster;
    const foes = this.enemies(me);
    const friends = this.allies(me);
    const minBy = (arr: Unit[], f: (u: Unit) => number) => (arr.length ? [arr.reduce((a, b) => (f(b) < f(a) ? b : a))] : []);
    const rowOr = (arr: Unit[], row: Row) => {
      const r = arr.filter((x) => x.row === row);
      return r.length ? r : arr;
    };
    switch (sel) {
      case 'enemyAuto': {
        const t = this.pickAuto(me);
        return t ? [t] : [];
      }
      case 'enemyFront': return rowOr(foes, 'front');
      case 'enemyBack': return rowOr(foes, 'back');
      case 'enemyAll': return foes;
      case 'enemyLowest': return minBy(foes, (x) => this.pct(x));
      case 'enemyHighestAtk': return minBy(foes, (x) => -this.stat(x).atk);
      case 'enemyBackLowest': {
        const back = foes.filter((x) => x.row === 'back');
        return minBy(back.length ? back : foes, (x) => this.pct(x));
      }
      case 'enemyRandom': {
        const t = this.pick(foes);
        return t ? [t] : [];
      }
      case 'self': return me.alive ? [me] : [];
      case 'allyAll': return friends;
      case 'allyFront': return rowOr(friends, 'front');
      case 'allyBack': return rowOr(friends, 'back');
      case 'allyLowest': return minBy(friends, (x) => this.pct(x) * 10 + x.hp / 1e6);
      case 'allyFaction': return friends.filter((x) => x.def.faction === me.def.faction);
      case 'same': return ctx.last.filter((x) => x.alive);
    }
  }

  // ───────── effects ─────────

  private runEffects(ctx: Ctx, effects: Effect[]) {
    for (const e of effects) {
      if (this.over) return;
      this.runEffect(ctx, e);
    }
  }

  private runEffect(ctx: Ctx, e: Effect) {
    const me = ctx.caster;
    switch (e.kind) {
      case 'damage': {
        const hits = e.hits ?? 1;
        const hitSet = new Set<Unit>();
        if (e.target === 'enemyRandom') {
          for (let i = 0; i < hits; i++) {
            const t = this.pick(this.enemies(me));
            if (!t) break;
            hitSet.add(t);
            this.dealDamage(me, t, e.mult, e);
          }
        } else {
          const targets = this.resolve(ctx, e.target);
          for (let i = 0; i < hits; i++) {
            for (const t of targets) {
              if (!t.alive) continue;
              hitSet.add(t);
              this.dealDamage(me, t, e.mult, e);
            }
          }
        }
        ctx.last = [...hitSet];
        break;
      }
      case 'heal': {
        const targets = this.resolve(ctx, e.target);
        const s = this.stat(me);
        for (const t of targets) {
          const amt = (e.mult ?? 0) * s.atk * (1 + s.heal) + (e.pctMax ?? 0) * t.maxHp;
          this.heal(me, t, amt);
        }
        ctx.last = targets;
        break;
      }
      case 'shield': {
        const targets = this.resolve(ctx, e.target);
        const s = this.stat(me);
        const amt = ((e.mult ?? 0) * s.atk + (e.pctCasterHp ?? 0) * me.maxHp) * (1 + s.heal);
        for (const t of targets) this.addShield(t, amt, e.duration ?? 8);
        ctx.last = targets;
        break;
      }
      case 'status': {
        const targets = this.resolve(ctx, e.target);
        for (const t of targets) {
          if (e.chance !== undefined && this.rand() >= e.chance) continue;
          this.applyStatus(me, t, e.status, e.duration, e.value ?? 0);
        }
        ctx.last = targets;
        break;
      }
      case 'move': {
        const targets = this.resolve(ctx, e.target);
        for (const t of targets) this.setRow(t, e.to);
        ctx.last = targets;
        break;
      }
      case 'dispel': {
        const targets = this.resolve(ctx, e.target);
        for (const t of targets) {
          t.statuses = t.statuses.filter((s) => !BUFFS.includes(s.id) || s.t > 900);
          if (t.shield > 0) {
            t.shield = 0;
            this.events.push({ t: 'shieldBreak', target: t.uid });
          }
        }
        ctx.last = targets;
        break;
      }
      case 'cleanse': {
        const targets = this.resolve(ctx, e.target);
        for (const t of targets) t.statuses = t.statuses.filter((s) => !DEBUFFS.includes(s.id));
        ctx.last = targets;
        break;
      }
      case 'energy': {
        const targets = this.resolve(ctx, e.target);
        for (const t of targets) t.energy = Math.min(100, t.energy + e.amount);
        ctx.last = targets;
        break;
      }
      case 'revive': {
        const fallen = this.units.filter((x) => x.side === me.side && !x.alive).sort((a, b) => a.slot - b.slot)[0];
        if (fallen) {
          fallen.alive = true;
          fallen.hp = Math.round(fallen.maxHp * e.pct);
          fallen.energy = 0;
          fallen.statuses = [];
          fallen.row = fallen.startRow;
          fallen.cd = ACTION_INTERVAL;
          this.events.push({ t: 'revive', target: fallen.uid });
          ctx.last = [fallen];
        } else if (e.fallback) {
          this.runEffects(ctx, e.fallback);
        }
        break;
      }
      case 'reform':
        this.reform(ctx, e.mode);
        break;
    }
  }

  private reform(ctx: Ctx, mode: 'rescue' | 'fortify' | 'disrupt') {
    const me = ctx.caster;
    if (mode === 'rescue') {
      const friends = this.allies(me);
      const front = friends.filter((x) => x.row === 'front').sort((a, b) => this.pct(a) - this.pct(b));
      const back = friends
        .filter((x) => x.row === 'back')
        .sort((a, b) => this.pct(b) + (b.def.role === 'Defender' ? 0.5 : 0) - (this.pct(a) + (a.def.role === 'Defender' ? 0.5 : 0)));
      const injured = front[0];
      const healthy = back[0];
      if (injured && healthy && this.pct(injured) < this.pct(healthy)) {
        this.setRow(injured, 'back');
        this.setRow(healthy, 'front');
        ctx.last = [injured];
      } else if (injured && !healthy && front.length > 1) {
        this.setRow(injured, 'back');
        ctx.last = [injured];
      } else {
        ctx.last = this.resolve(ctx, 'allyLowest');
      }
      return;
    }
    if (mode === 'fortify') {
      const friends = this.allies(me);
      const nFront = Math.max(1, Math.min(friends.length, this.frontSlots[me.side]));
      const score = (u: Unit) =>
        (u.def.role === 'Defender' ? 1 : 0) +
        (u.def.role === 'Attacker' && u.def.range === 'melee' ? 0.6 : 0) -
        (u.def.role === 'Support' ? 1.2 : 0) -
        (u.def.range === 'ranged' ? 0.4 : 0) +
        this.pct(u) * 1.5;
      const sorted = [...friends].sort((a, b) => score(b) - score(a));
      sorted.forEach((u, i) => this.setRow(u, i < nFront ? 'front' : 'back'));
      ctx.last = sorted.slice(0, nFront);
      return;
    }
    // disrupt the enemy formation
    const foes = this.enemies(me);
    const sturdy = foes.filter((x) => x.row === 'front').sort((a, b) => this.stat(b).def - this.stat(a).def)[0];
    const weak = foes.filter((x) => x.row === 'back').sort((a, b) => this.pct(a) - this.pct(b))[0];
    const frontCount = foes.filter((x) => x.row === 'front').length;
    if (sturdy && weak) {
      this.setRow(sturdy, 'back');
      this.setRow(weak, 'front');
    } else if (weak) {
      this.setRow(weak, 'front');
    } else if (sturdy && frontCount > 1) {
      this.setRow(sturdy, 'back');
    }
    ctx.last = weak ? [weak] : sturdy ? [sturdy] : [];
  }

  private setRow(u: Unit, row: Row) {
    if (!u.alive || u.row === row) return;
    u.row = row;
    this.events.push({ t: 'move', target: u.uid, row });
  }

  private dealDamage(src: Unit, tgt: Unit, mult: number, opts: { ignoreDef?: number; bonusCrit?: number; lifesteal?: number }) {
    if (!tgt.alive || !src.alive) return;
    const ss = this.stat(src);
    const ts = this.stat(tgt);
    const ign = Math.min(0.9, (opts.ignoreDef ?? 0) + (src.def.passive.ignoreDef ?? 0));
    let dmg = ss.atk * mult * (DEF_K / (DEF_K + ts.def * (1 - ign)));
    const crit = this.rand() < ss.crit + (opts.bonusCrit ?? 0);
    if (crit) dmg *= ss.critDmg;
    dmg *= 0.92 + this.rand() * 0.16;
    dmg *= 1 + this.statusVal(tgt, 'mark');
    dmg *= this.overtimeDamage();
    const amount = Math.max(1, Math.round(dmg));
    const dealt = this.applyDamage(src, tgt, amount, 'hit', crit, !!src.def.passive.antiMagic);
    const ls = ss.lifesteal + (opts.lifesteal ?? 0);
    if (ls > 0 && dealt > 0 && src.alive) this.heal(src, src, dealt * ls);
  }

  /** Returns damage actually dealt (incl. absorbed by shields). */
  private applyDamage(src: Unit | null, tgt: Unit, amount: number, kind: 'hit' | 'dot' | 'reflect', crit: boolean, antiMagic: boolean, dot?: StatusId): number {
    if (!tgt.alive) return 0;
    let remaining = amount;
    let absorbed = 0;
    if (antiMagic && tgt.shield > 0) {
      tgt.shield = 0;
      this.events.push({ t: 'shieldBreak', target: tgt.uid });
    }
    if (tgt.shield > 0) {
      absorbed = Math.min(tgt.shield, remaining);
      tgt.shield -= absorbed;
      remaining -= absorbed;
    }
    if (remaining >= tgt.hp) {
      const fate = tgt.statuses.find((s) => s.id === 'fate');
      if (fate) {
        tgt.statuses = tgt.statuses.filter((s) => s !== fate);
        tgt.hp = Math.max(tgt.hp, Math.round(tgt.maxHp * fate.value));
        this.events.push({ t: 'fate', target: tgt.uid });
        return absorbed;
      }
    }
    tgt.hp -= remaining;
    tgt.dmgTaken += remaining;
    if (src) src.dmgDealt += remaining + absorbed;
    this.events.push({ t: 'dmg', src: src?.uid, target: tgt.uid, amount: remaining, crit, kind, dot, absorbed });
    if (kind === 'hit') this.gainEnergy(tgt, Math.min(14, (remaining / tgt.maxHp) * 70) + 2);

    if (kind === 'hit' && src && src.alive && src.side !== tgt.side) {
      const refl = this.statusVal(tgt, 'reflect');
      if (refl > 0) this.applyDamage(tgt, src, Math.max(1, Math.round((remaining + absorbed) * refl)), 'reflect', false, false);
    }

    if (tgt.hp <= 0) {
      this.kill(tgt, src);
    } else {
      this.checkThresholds(tgt);
    }
    return remaining + absorbed;
  }

  private kill(tgt: Unit, src: Unit | null) {
    tgt.alive = false;
    tgt.hp = 0;
    tgt.shield = 0;
    tgt.statuses = [];
    this.events.push({ t: 'death', target: tgt.uid });
    if (src && src.alive && src.side !== tgt.side) this.fire(src, 'kill', [tgt]);
    for (const a of this.units) if (a.side === tgt.side && a.alive) this.fire(a, 'allyDeath', [tgt]);
    for (const side of [0, 1] as const) {
      if (!this.over && !this.units.some((u) => u.side === side && u.alive)) this.end(side === 0 ? 1 : 0);
    }
  }

  get overtime(): boolean {
    return this.time >= OVERTIME;
  }

  private overtimeDamage(): number {
    return this.time < OVERTIME ? 1 : 1 + ((this.time - OVERTIME) / 15) * 0.5;
  }

  private heal(src: Unit | null, tgt: Unit, amount: number) {
    if (!tgt.alive) return;
    const amt = Math.min(Math.round(amount * (this.overtime ? 0.5 : 1)), tgt.maxHp - tgt.hp);
    if (amt <= 0) return;
    tgt.hp += amt;
    if (src) src.healDone += amt;
    this.events.push({ t: 'heal', target: tgt.uid, amount: amt });
  }

  private addShield(t: Unit, amount: number, duration: number) {
    if (!t.alive) return;
    const amt = Math.round(amount);
    t.shield = Math.min(Math.round(t.maxHp * 0.6), t.shield + amt);
    t.shieldT = Math.max(t.shieldT, duration);
    this.events.push({ t: 'shield', target: t.uid, amount: amt });
  }

  private applyStatus(src: Unit, t: Unit, id: StatusId, duration: number, value: number) {
    if (!t.alive) return;
    let dur = duration;
    if (t.boss && (id === 'stun' || id === 'silence')) dur *= 0.5;
    let v = value;
    if (DOTS.includes(id)) v = value * this.stat(src).atk;
    if (id === 'regen') v = value * this.stat(src).atk * (1 + this.stat(src).heal);
    const existing = t.statuses.find((s) => s.id === id);
    if (existing) {
      existing.t = Math.max(existing.t, dur);
      existing.max = Math.max(existing.max, dur);
      existing.value = Math.max(existing.value, v);
    } else {
      t.statuses.push({ id, t: dur, max: dur, value: v, tick: 1 });
    }
    this.events.push({ t: 'status', target: t.uid, status: id });
  }

  private gainEnergy(u: Unit, amount: number) {
    if (!u.alive) return;
    u.energy = Math.min(100, u.energy + amount * (1 + this.stat(u).energy));
  }

  private end(winner: 0 | 1) {
    this.over = true;
    this.winner = winner;
    this.events.push({ t: 'end', winner });
  }
}
