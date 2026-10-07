import { memo } from 'preact/compat';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CharacterArt } from '../../art/CharacterArt';
import { getStage } from '../../data/campaign';
import { Battle, OVERTIME, type BattleEvent, type Unit } from '../../game/battle';
import { randomSeed } from '../../game/rng';
import { fmt } from '../../game/stats';
import { playerTeam, recordBattle, updateSettings, useGame, type BattleReward } from '../../game/store';
import type { StatusId } from '../../game/types';
import { RewardList } from '../components/common';
import { sfx } from '../sfx';

const STEP = 0.05;

const STATUS_ICON: Record<StatusId, string> = {
  stun: '💫',
  silence: '🤐',
  burn: '🔥',
  poison: '☠️',
  bleed: '🩸',
  regen: '💚',
  atkUp: '⚔️',
  atkDown: '🔻',
  defUp: '🛡️',
  defDown: '💔',
  spdUp: '💨',
  spdDown: '🐌',
  taunt: '😤',
  mark: '🎯',
  reflect: '🪞',
  fate: '🧵',
};

const STATUS_TEXT: Partial<Record<StatusId, string>> = {
  stun: 'STUN!',
  silence: 'SILENCE',
  burn: 'BURN',
  poison: 'POISON',
  bleed: 'BLEED',
  taunt: 'TAUNT!',
  mark: 'MARKED',
  atkDown: 'ATK↓',
  defDown: 'DEF↓',
  spdDown: 'SPD↓',
  fate: 'FATE',
};

const ONOMATOPOEIA = ['POW!', 'BAM!', 'WHAM!', 'KRAK!', 'BOOM!', 'SMASH!'];

interface Float {
  id: number;
  x: number;
  y: number;
  text: string;
  cls: string;
  until: number;
}

interface Proj {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  color: string;
  until: number;
}

interface Slash {
  id: number;
  x: number;
  y: number;
  color: string;
  until: number;
}

interface Cutin {
  key: number;
  id: string;
  enemy: boolean;
  name: string;
  shout: string;
  color: string;
  dur: number;
}

const Art = memo(function Art({ id, flip, mode }: { id: string; flip?: boolean; mode?: 'full' | 'portrait' }) {
  return <CharacterArt id={id} mode={mode ?? 'full'} flip={flip} />;
});

export function BattleScreen(props: { stage: number; onExit: () => void; onNext: (stage: number) => void }) {
  const [attempt, setAttempt] = useState(0);
  return <BattleView key={attempt} {...props} onRetry={() => setAttempt((a) => a + 1)} />;
}

function BattleView({ stage, onExit, onNext, onRetry }: { stage: number; onExit: () => void; onNext: (stage: number) => void; onRetry: () => void }) {
  const s = useGame();
  const info = useMemo(() => getStage(stage), [stage]);
  const battleRef = useRef<Battle | null>(null);
  if (!battleRef.current) {
    const b = new Battle(playerTeam(), info.team, randomSeed());
    b.autoUlt[0] = s.settings.autoUlt;
    battleRef.current = b;
  }
  const b = battleRef.current;
  const empty = !b.units.some((u) => u.side === 0);

  const fieldRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 400, h: 420 });
  const [, setFrame] = useState(0);
  const floats = useRef<Float[]>([]);
  const projs = useRef<Proj[]>([]);
  const slashes = useRef<Slash[]>([]);
  const unitCls = useRef<Record<string, { cls: string; until: number }>>({});
  const [cutin, setCutin] = useState<Cutin | null>(null);
  const [banner, setBanner] = useState<{ key: number; text: string; color?: string } | null>({ key: 0, text: info.isBoss ? 'BOSS BATTLE!' : 'FIGHT!' });
  const [flash, setFlash] = useState<{ key: number; color: string } | null>(null);
  const [result, setResult] = useState<{ won: boolean; reward: BattleReward | null; mvp: Unit | null } | null>(null);
  const pending = useRef<BattleEvent[]>([]);
  const pauseUntil = useRef(performance.now() + 900);
  const nextId = useRef(1);
  const otShown = useRef(false);
  const speedRef = useRef(s.settings.speed);
  speedRef.current = s.settings.speed;

  useLayoutEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ───────── layout ─────────
  const layout = useMemo(() => {
    return () => {
      const pos: Record<string, { x: number; y: number }> = {};
      const cols: Record<string, Unit[]> = {};
      for (const u of b.units) {
        const key = `${u.side}-${u.row}`;
        (cols[key] ??= []).push(u);
      }
      const maxN = Math.max(1, ...Object.values(cols).map((c) => c.length));
      const top = size.h * 0.17;
      const avail = size.h * 0.8;
      const xFrac: Record<string, number> = { '0-back': 0.14, '0-front': 0.36, '1-front': 0.64, '1-back': 0.86 };
      for (const [key, list] of Object.entries(cols)) {
        list.sort((a, c) => a.slot - c.slot);
        const n = list.length;
        list.forEach((u, i) => {
          const zig = n > 2 ? (i % 2 ? 1 : -1) * size.w * 0.035 * (u.side ? -1 : 1) : 0;
          pos[u.uid] = { x: size.w * xFrac[key] + zig, y: top + ((i + 0.5) * avail) / n };
        });
      }
      const uw = Math.max(52, Math.min(84, (avail / maxN) * 0.72, size.w * 0.19));
      return { pos, uw };
    };
  }, [b, size]);

  // ───────── event processing ─────────
  const process = (e: BattleEvent, now: number): boolean => {
    const { pos } = layout();
    const sp = speedRef.current;
    const at = (uid: string) => pos[uid] ?? { x: size.w / 2, y: size.h / 2 };
    const float = (uid: string, text: string, cls: string, life = 900, jitter = 14) => {
      const p = at(uid);
      floats.current.push({ id: nextId.current++, x: p.x + (Math.random() - 0.5) * jitter * 2, y: p.y - 20 - Math.random() * 10, text, cls, until: now + life });
    };
    const mark = (uid: string, cls: string, ms: number) => {
      unitCls.current[uid] = { cls, until: now + ms };
    };
    switch (e.t) {
      case 'basic': {
        const src = b.unit(e.src)!;
        const melee = src.def.range === 'melee';
        mark(e.src, melee ? 'atk-melee' : 'atk-ranged', 320);
        const a = at(e.src);
        const t = at(e.target);
        if (!melee) {
          projs.current.push({ id: nextId.current++, x: a.x, y: a.y - 10, dx: t.x - a.x, dy: t.y - a.y, color: src.def.color, until: now + 260 / Math.sqrt(sp) });
        } else {
          slashes.current.push({ id: nextId.current++, x: t.x, y: t.y - 6, color: src.def.color, until: now + 300 });
        }
        break;
      }
      case 'ult': {
        const src = b.unit(e.src)!;
        // Only player heroes and bosses get the full comic cut-in (which pauses the action);
        // regular enemies just shout their move.
        if (src.side === 1 && !src.boss) {
          mark(e.src, 'casting', 600);
          float(e.src, e.shout, 'sfx', 900, 0);
          return false;
        }
        const dur = Math.round(1050 / Math.pow(sp, 0.45));
        setCutin({ key: nextId.current++, id: src.def.id, enemy: src.side === 1, name: e.name, shout: e.shout, color: e.color, dur });
        mark(e.src, 'casting', 600);
        pauseUntil.current = now + dur * 0.85;
        sfx.ult();
        setTimeout(() => setFlash({ key: Date.now(), color: e.color }), dur * 0.8);
        return true;
      }
      case 'dmg': {
        const crit = e.crit;
        if (e.kind === 'dot') float(e.target, `${fmt(e.amount)}`, `dot ${e.dot ?? ''}`, 800, 18);
        else if (e.kind === 'reflect') float(e.target, `${fmt(e.amount)}`, 'dot', 800);
        else {
          float(e.target, fmt(e.amount + e.absorbed), crit ? 'crit' : '', crit ? 1000 : 900);
          mark(e.target, 'hit', 250);
          if (crit) {
            sfx.crit();
            if (Math.random() < 0.35) float(e.target, ONOMATOPOEIA[Math.floor(Math.random() * ONOMATOPOEIA.length)], 'sfx', 700, 30);
          } else sfx.hit();
        }
        break;
      }
      case 'heal':
        float(e.target, `+${fmt(e.amount)}`, 'heal', 900);
        sfx.heal();
        break;
      case 'shield':
        float(e.target, `+🛡 ${fmt(e.amount)}`, 'shield', 900);
        break;
      case 'shieldBreak':
        float(e.target, 'SHIELD BREAK!', 'status', 900);
        break;
      case 'status':
        if (STATUS_TEXT[e.status]) float(e.target, STATUS_TEXT[e.status]!, 'status', 800, 20);
        break;
      case 'move':
        setTimeout(() => {
          const p = layout().pos[e.target];
          if (p) floats.current.push({ id: nextId.current++, x: p.x, y: p.y - 34, text: e.row === 'front' ? '⇢ FRONT ROW' : '⇠ BACK ROW', cls: 'move', until: performance.now() + 1100 });
        }, 50);
        break;
      case 'death':
        sfx.death();
        break;
      case 'revive':
        float(e.target, 'REVIVED!', 'heal', 1200);
        break;
      case 'fate':
        float(e.target, 'FATE REWRITTEN!', 'fate', 1200);
        break;
      case 'passive':
        float(e.src, `✦ ${b.unit(e.src)!.def.passive.name}`, 'passive', 1400, 0);
        break;
      case 'end':
        setTimeout(() => finish(), 900);
        break;
    }
    return false;
  };

  const finish = () => {
    const won = b.winner === 0;
    const reward = recordBattle(stage, won, b.ultsCast[0]);
    const mvp = b.units.filter((u) => u.side === 0).sort((x, y) => y.dmgDealt + y.healDone - (x.dmgDealt + x.healDone))[0] ?? null;
    setResult({ won, reward, mvp });
    if (won) sfx.win();
    else sfx.lose();
  };

  // ───────── main loop ─────────
  useEffect(() => {
    if (empty) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (now >= pauseUntil.current) {
        // flush events queued behind a cut-in first
        while (pending.current.length && now >= pauseUntil.current) {
          if (process(pending.current.shift()!, now)) break;
        }
        if (!pending.current.length && !b.over && now >= pauseUntil.current) {
          acc += dt * speedRef.current;
          while (acc >= STEP && !b.over) {
            acc -= STEP;
            b.step(STEP);
            const evs = b.drainEvents();
            let paused = false;
            for (let i = 0; i < evs.length; i++) {
              if (paused) {
                pending.current.push(evs[i]);
                continue;
              }
              paused = process(evs[i], now);
            }
            if (paused) {
              acc = 0;
              break;
            }
          }
          if (!otShown.current && b.time >= OVERTIME && !b.over) {
            otShown.current = true;
            setBanner({ key: nextId.current++, text: 'OVERTIME!', color: '#ff4b5c' });
          }
        }
      }
      floats.current = floats.current.filter((f) => f.until > now);
      projs.current = projs.current.filter((p) => p.until > now);
      slashes.current = slashes.current.filter((p) => p.until > now);
      // Once the fight is over and the last effects have faded, stop re-rendering every frame.
      if (!b.over || floats.current.length || projs.current.length || pending.current.length) setFrame((f) => (f + 1) % 1e6);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [b, layout]);

  // auto-advance after a win
  useEffect(() => {
    if (result?.won && s.settings.autoAdvance) {
      const t = setTimeout(() => onNext(stage + 1), 2200);
      return () => clearTimeout(t);
    }
  }, [result]);

  const skip = () => {
    if (b.over || result) return;
    b.runToEnd();
    pending.current = [];
    finish();
  };

  const { pos, uw } = layout();
  const now = performance.now();
  const remaining = Math.max(0, b.timeLimit - b.time);
  const mine = b.units.filter((u) => u.side === 0).sort((x, y) => x.slot - y.slot);
  const ch = info.chapter;

  return (
    <div class="battle">
      <div class="battle-top">
        <button class="icon-btn" onClick={onExit} aria-label="Leave battle">
          ✕
        </button>
        <div class="stage-lbl">
          <span style={{ color: 'var(--gold)' }}>{info.label}</span> {info.name}
        </div>
        <div class={`timer ${b.time >= OVERTIME ? 'ot' : ''}`}>
          {Math.floor(remaining / 60)}:{Math.floor(remaining % 60).toString().padStart(2, '0')}
        </div>
        <button class="toggle" onClick={() => updateSettings({ speed: ((s.settings.speed % 3) + 1) as 1 | 2 | 3 })}>
          {s.settings.speed}x
        </button>
        <button
          class={`toggle ${s.settings.autoUlt ? 'on' : ''}`}
          onClick={() => {
            const v = !s.settings.autoUlt;
            updateSettings({ autoUlt: v });
            b.autoUlt[0] = v;
          }}
        >
          AUTO
        </button>
        <button class={`toggle ${s.settings.autoAdvance ? 'on' : ''}`} onClick={() => updateSettings({ autoAdvance: !s.settings.autoAdvance })} title="Auto-advance to the next stage after a win">
          ⏩
        </button>
        <button class="toggle" onClick={skip}>
          SKIP
        </button>
      </div>

      <div class="field" ref={fieldRef}>
        <div class="field-bg" style={{ background: `linear-gradient(180deg, ${ch.sky[0]}, ${ch.sky[1]})` }}>
          <div class="ground" style={{ background: `linear-gradient(180deg, ${ch.ground}, #120c1c)` }} />
          <div class="hatch" />
        </div>
        <div class="row-label" style={{ left: size.w * 0.14 }}>BACK</div>
        <div class="row-label" style={{ left: size.w * 0.36 }}>FRONT</div>
        <div class="row-label" style={{ left: size.w * 0.64 }}>FRONT</div>
        <div class="row-label" style={{ left: size.w * 0.86 }}>BACK</div>

        {b.units.map((u) => {
          const p = pos[u.uid];
          if (!p) return null;
          const fx = unitCls.current[u.uid];
          const cls = fx && fx.until > now ? fx.cls : '';
          const stunned = b.has(u, 'stun');
          const ready = u.alive && u.energy >= 100;
          const shownStatuses = [...new Set(u.statuses.filter((x) => x.t < 900).map((x) => x.id))].slice(0, 4);
          return (
            <div
              key={u.uid}
              class={`unit ${u.side ? 'enemy' : ''} ${cls} ${u.alive ? '' : 'dead'} ${stunned ? 'stunned' : ''} ${ready ? 'ready' : ''}`}
              style={{ left: p.x, top: p.y, '--uw': `${u.boss ? uw * 1.25 : uw}px`, '--uc': u.def.color, zIndex: 10 + Math.round(p.y / 10) } as any}
            >
              {u.boss && <div class="boss-tag">BOSS</div>}
              <div class="statuses">{shownStatuses.map((id) => <span key={id}>{STATUS_ICON[id]}</span>)}</div>
              <div class="sprite">
                <div class="sprite-inner">
                  <Art id={u.def.id} flip={u.side === 1} />
                </div>
              </div>
              <div class="hud">
                <div class="hp">
                  <i style={{ width: `${(u.hp / u.maxHp) * 100}%` }} />
                  {u.shield > 0 && <b style={{ left: 0, width: `${Math.min(100, (u.shield / u.maxHp) * 100)}%` }} />}
                </div>
                <div class={`en ${ready ? 'full' : ''}`}>
                  <i style={{ width: `${u.energy}%` }} />
                </div>
              </div>
            </div>
          );
        })}

        {projs.current.map((p) => (
          <div
            key={p.id}
            class="proj"
            style={{ left: p.x, top: p.y, background: p.color, '--pc': p.color, '--dx': `${p.dx}px`, '--dy': `${p.dy}px`, '--pd': `${Math.max(80, p.until - now)}ms` } as any}
          />
        ))}
        {slashes.current.map((sl) => (
          <svg key={sl.id} class="slash" style={{ left: sl.x, top: sl.y }} viewBox="0 0 70 70">
            <path d="M8 58 Q30 30 62 8 Q38 36 14 62Z" fill={sl.color} stroke="#0b0710" stroke-width="2.5" />
            <path d="M16 62 Q40 44 66 30" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.8" />
          </svg>
        ))}
        {floats.current.map((f) => (
          <div key={f.id} class={`float ${f.cls}`} style={{ left: f.x, top: f.y }}>
            {f.text}
          </div>
        ))}

        {cutin && (
          <div key={cutin.key} class={`cutin ${cutin.enemy ? 'enemy' : ''}`} style={{ '--cc': cutin.color, '--cd': `${cutin.dur}ms` } as any} onAnimationEnd={() => setCutin(null)}>
            <div class="lines" />
            <div class="cut-art">
              <Art id={cutin.id} mode="full" />
            </div>
            <div class="cut-text">
              <div class="shout">{cutin.shout}</div>
              <div class="ultname">{cutin.name}</div>
            </div>
          </div>
        )}
        {flash && <div key={flash.key} class="flash" style={{ background: `radial-gradient(circle, transparent 35%, ${flash.color} 120%)` }} onAnimationEnd={() => setFlash(null)} />}
        {banner && (
          <div key={banner.key} class="banner-text" style={{ color: banner.color }} onAnimationEnd={() => setBanner(null)}>
            {banner.text}
          </div>
        )}

        {empty && (
          <div class="result">
            <h1 class="lose" style={{ fontSize: 40 }}>
              NO SQUAD!
            </h1>
            <p>Assign heroes to your squad before heading into battle.</p>
            <button class="btn" onClick={onExit}>
              Back
            </button>
          </div>
        )}

        {result && <ResultOverlay result={result} stage={stage} autoAdvance={s.settings.autoAdvance} onExit={onExit} onNext={onNext} onRetry={onRetry} />}
      </div>

      <div class="ult-bar">
        {mine.map((u) => {
          const ready = b.canCast(u) && !b.over;
          return (
            <button
              key={u.uid}
              class={`ult-btn ${ready ? 'ready' : ''} ${u.alive ? '' : 'dead'}`}
              onClick={() => {
                if (ready) b.requestUlt(u.uid);
              }}
              aria-label={`${u.def.name} ultimate`}
            >
              <div class="ult-fill" style={{ height: `${u.energy}%` }} />
              <div class="ult-art">
                <Art id={u.def.id} mode="portrait" />
              </div>
              {ready && <div class="tap">ULT!</div>}
              <div class="ult-hp">
                <i style={{ width: `${(u.hp / u.maxHp) * 100}%` }} />
              </div>
            </button>
          );
        })}
        {Array.from({ length: Math.max(0, 5 - mine.length) }, (_, i) => (
          <div key={`e${i}`} class="ult-btn" style={{ opacity: 0.3 }} />
        ))}
      </div>
    </div>
  );
}

function ResultOverlay({
  result,
  stage,
  autoAdvance,
  onExit,
  onNext,
  onRetry,
}: {
  result: { won: boolean; reward: BattleReward | null; mvp: Unit | null };
  stage: number;
  autoAdvance: boolean;
  onExit: () => void;
  onNext: (s: number) => void;
  onRetry: () => void;
}) {
  const { won, reward, mvp } = result;
  return (
    <div class="result">
      {won && <div class="burst-bg" />}
      <h1 class={won ? 'win' : 'lose'}>{won ? 'VICTORY!' : 'DEFEAT'}</h1>
      {mvp && (
        <div class="mvp">
          <div class="mvp-art">
            <CharacterArt id={mvp.def.id} mode="portrait" />
          </div>
          <div>
            <div class="comic" style={{ color: 'var(--gold)', fontSize: 16 }}>
              MVP
            </div>
            <div class="comic" style={{ fontSize: 22 }}>
              {mvp.def.name}
            </div>
            <div class="small-text muted">
              {fmt(mvp.dmgDealt)} dmg{mvp.healDone ? ` · ${fmt(mvp.healDone)} healed` : ''}
            </div>
          </div>
        </div>
      )}
      {won && reward && (
        <>
          {reward.firstClear && <div class="chip on">FIRST CLEAR BONUS</div>}
          <RewardList r={reward} />
          {reward.unlockedFormation && <div class="chip on" style={{ marginBottom: 10 }}>New formation unlocked: {reward.unlockedFormation}!</div>}
        </>
      )}
      {!won && (
        <p class="center" style={{ maxWidth: 300, margin: '10px 0 16px' }}>
          Level up your heroes, try a different formation, or bring a Defender to the front row!
        </p>
      )}
      <div class="row">
        <button class="btn dark" onClick={onExit}>
          Base
        </button>
        {won ? (
          <button class="btn green" onClick={() => onNext(stage + 1)}>
            {autoAdvance ? 'Next ⏩ (auto)' : 'Next Stage'}
          </button>
        ) : (
          <button class="btn" onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
