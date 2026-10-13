import { useState } from 'preact/hooks';
import { CharacterArt } from '../../art/CharacterArt';
import { AFK_CAP_HOURS, afkRates, getStage } from '../../data/campaign';
import { BONUS_QUEST, DAILY_QUESTS, claimable } from '../../game/quests';
import { fmt } from '../../game/stats';
import { teamPower } from '../../game/power';
import { afkPending, claimAfk, fastReward, fastRewardCost, playerTeam, useGame, FAST_REWARD_HOURS } from '../../game/store';
import type { Nav } from '../nav';
import { SCREENS } from './registry';
import { CurrencyIcon, formatDuration, toast, useNow } from '../components/common';
import { sfx } from '../sfx';

export function HideoutScene() {
  return (
    <svg class="scene-bg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#2b1b52" />
          <stop offset="0.55" stop-color="#c2508a" />
          <stop offset="1" stop-color="#ffb36b" />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="url(#sky)" />
      <circle cx="320" cy="70" r="26" fill="#fff3c4" opacity="0.9" />
      <g fill="#fff" opacity="0.6">
        <circle cx="40" cy="30" r="1.5" />
        <circle cx="120" cy="18" r="1.2" />
        <circle cx="210" cy="40" r="1.4" />
        <circle cx="260" cy="14" r="1" />
        <circle cx="380" cy="30" r="1.3" />
      </g>
      <path d="M0 190 L60 140 L110 175 L170 120 L230 170 L290 130 L350 168 L400 140 L400 300 L0 300Z" fill="#4a2d6b" />
      <path d="M0 215 L80 180 L150 205 L220 175 L300 200 L400 178 L400 300 L0 300Z" fill="#3b2457" />
      {/* Black Bulls hideout */}
      <g stroke="#0b0710" stroke-width="3" stroke-linejoin="round">
        <rect x="150" y="96" width="100" height="120" fill="#3a3046" />
        <rect x="128" y="140" width="40" height="76" fill="#463a55" />
        <rect x="232" y="128" width="46" height="88" fill="#463a55" />
        <path d="M144 98 L200 52 L256 98Z" fill="#26202f" />
        <path d="M124 142 L148 116 L172 142Z" fill="#26202f" />
        <path d="M228 130 L255 100 L282 130Z" fill="#26202f" />
        <rect x="190" y="30" width="20" height="30" fill="#463a55" />
        {/* bull horns emblem */}
        <path d="M180 66 Q170 50 178 40 Q184 56 196 60Z M220 66 Q230 50 222 40 Q216 56 204 60Z" fill="#e8dcc8" />
        <circle cx="200" cy="68" r="11" fill="#c62828" />
        <rect x="186" y="170" width="28" height="46" rx="12" fill="#2a1d14" />
      </g>
      <g fill="#ffd36b" stroke="#0b0710" stroke-width="2">
        <rect x="166" y="112" width="14" height="18" rx="3" />
        <rect x="220" y="112" width="14" height="18" rx="3" />
        <rect x="193" y="120" width="14" height="18" rx="3" />
        <rect x="140" y="158" width="12" height="15" rx="3" />
        <rect x="248" y="146" width="12" height="15" rx="3" />
      </g>
      <path d="M200 30 L200 8" stroke="#0b0710" stroke-width="3" />
      <path d="M200 8 L224 14 L200 22Z" fill="#c62828" stroke="#0b0710" stroke-width="2" />
      <path d="M0 238 Q100 222 200 232 T400 228 L400 300 L0 300Z" fill="#4f7a34" stroke="#0b0710" stroke-width="3" />
      <path d="M0 262 Q120 250 220 258 T400 254 L400 300 L0 300Z" fill="#3e6528" />
    </svg>
  );
}

function Chest({ pct, onClick }: { pct: number; onClick: () => void }) {
  const glow = Math.min(1, pct);
  return (
    <svg class={`chest ${pct >= 0.25 ? 'full' : ''}`} viewBox="0 0 86 78" onClick={onClick}>
      <ellipse cx="43" cy="72" rx="34" ry="5" fill="rgba(0,0,0,.35)" />
      <circle cx="43" cy="36" r={30 * glow} fill="#ffd36b" opacity={0.25 * glow} />
      <g stroke="#0b0710" stroke-width="3" stroke-linejoin="round">
        <rect x="10" y="34" width="66" height="36" rx="5" fill="#8d4a1f" />
        <path d="M10 36 Q10 10 43 10 Q76 10 76 36Z" fill="#a85a26" />
        <rect x="8" y="32" width="70" height="8" rx="3" fill="#ffc531" />
        <rect x="36" y="30" width="14" height="18" rx="3" fill="#ffc531" />
        <path d="M20 13 L20 70 M66 13 L66 70" stroke="#ffc531" stroke-width="4" />
      </g>
      <circle cx="43" cy="40" r="3" fill="#0b0710" />
      {pct > 0.05 && (
        <g>
          <circle cx="30" cy="8" r="5" fill="#ffc531" stroke="#0b0710" stroke-width="2" />
          <circle cx="55" cy="6" r="4" fill="#3ddc84" stroke="#0b0710" stroke-width="2" />
          <circle cx="44" cy="2" r="3" fill="#4fc3f7" stroke="#0b0710" stroke-width="2" />
        </g>
      )}
    </svg>
  );
}

export function Home({ nav }: { nav: Nav }) {
  const s = useGame();
  const now = useNow(1000);
  const p = afkPending(now);
  const rates = afkRates(s.stage);
  const [bursts, setBursts] = useState<{ id: number; kind: 'yul' | 'essence' | 'gems'; dx: number; dy: number; x: number; y: number }[]>([]);
  const next = getStage(s.stage);
  const myPower = teamPower(playerTeam(s));
  const enemyPower = teamPower(next.team);
  const squadIds = s.squad.slots.filter(Boolean) as string[];
  const lead = squadIds[0];
  const questsReady = [...DAILY_QUESTS, BONUS_QUEST].filter((q) => claimable(s, q)).length;
  const questsDone = s.quests.claimed.length;
  const fastCost = fastRewardCost();

  const claim = (e: MouseEvent) => {
    if (p.yul <= 0) {
      toast('The chest is still empty — check back soon!');
      return;
    }
    const got = claimAfk(now);
    sfx.coin();
    const rect = (e.currentTarget as Element).getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const items = Array.from({ length: 14 }, (_, i) => ({
      id: Date.now() + i,
      kind: (['yul', 'essence', 'gems'] as const)[i % 3],
      dx: (Math.random() - 0.3) * 260,
      dy: -260 - Math.random() * 200,
      x,
      y,
    }));
    setBursts(items);
    setTimeout(() => setBursts([]), 1000);
    toast(`+${fmt(got.yul)} Yul · +${fmt(got.essence)} Essence${got.gems ? ` · +${got.gems} Gems` : ''}`);
  };

  return (
    <div class="screen">
      <div class="home-scene">
        <HideoutScene />
        <div class="home-title">
          <h1>
            BLACK CLOVER
            <em>GRIMOIRE SQUADS</em>
          </h1>
          <span class="fan-tag">Unofficial fan game</span>
        </div>
        <div class="home-squad">
          {squadIds.slice(1, 3).map((id) => (
            <div class="idle" key={id}>
              <CharacterArt id={id} mode="full" />
            </div>
          ))}
          {lead && (
            <div class="idle lead">
              <CharacterArt id={lead} mode="full" />
            </div>
          )}
          {squadIds.slice(3, 5).map((id) => (
            <div class="idle" key={id}>
              <CharacterArt id={id} mode="full" />
            </div>
          ))}
        </div>
      </div>

      <div class="panel afk-card" style={{ marginTop: 14 }}>
        <Chest pct={p.hours / AFK_CAP_HOURS} onClick={claim as any} />
        <div class="afk-info">
          <div class="spread">
            <h3 class="comic" style={{ fontSize: 20, color: 'var(--gold)' }}>
              AFK Rewards
            </h3>
            <span class="small-text muted">
              {formatDuration(p.hours * 3600000)} / {AFK_CAP_HOURS}h
            </span>
          </div>
          <div class="bar" style={{ margin: '4px 0' }}>
            <i style={{ width: `${(p.hours / AFK_CAP_HOURS) * 100}%`, background: p.capped ? 'linear-gradient(90deg,#ff4b5c,#ffc531)' : undefined }} />
          </div>
          <div class="afk-yields">
            <span>
              <CurrencyIcon kind="yul" />
              {fmt(p.yul)}
            </span>
            <span>
              <CurrencyIcon kind="essence" />
              {fmt(p.essence)}
            </span>
            <span>
              <CurrencyIcon kind="gems" />
              {fmt(p.gems)}
            </span>
          </div>
          <div class="row">
            <button class="btn green small" style={{ flex: 1 }} onClick={claim as any}>
              Collect
            </button>
            <button
              class="btn blue small"
              disabled={fastCost === null || s.currencies.gems < (fastCost ?? 0)}
              onClick={() => {
                const r = fastReward();
                if (r) {
                  sfx.coin();
                  toast(`Fast Reward! +${fmt(r.yul)} Yul · +${fmt(r.essence)} Essence`);
                }
              }}
            >
              ⚡ {FAST_REWARD_HOURS}h {fastCost === null ? '(0 left)' : fastCost === 0 ? 'FREE' : <><CurrencyIcon kind="gems" size={14} />{fastCost}</>}
            </button>
          </div>
          <div class="small-text muted" style={{ marginTop: 4 }}>
            Earning {fmt(rates.yul)} Yul · {fmt(rates.essence)} Essence · {rates.gems} Gems per hour
          </div>
        </div>
      </div>

      <div class="panel stage-card">
        <div class="stage-num">{next.label}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div class="comic" style={{ fontSize: 18 }}>
            {next.name}
          </div>
          <div class="small-text">
            <span class="power">⚡{fmt(myPower)}</span> <span class="muted">vs</span>{' '}
            <span class="power" style={{ color: myPower >= enemyPower ? '#7dff9b' : '#ff8a8a' }}>
              ⚡{fmt(enemyPower)}
            </span>
          </div>
        </div>
        <button class="btn red" onClick={() => nav.fight(s.stage)}>
          Battle!
        </button>
      </div>

      <div class="row" style={{ marginTop: 12, alignItems: 'stretch' }}>
        <button class="panel" style={{ flex: 1, textAlign: 'left', cursor: 'pointer', margin: 0 }} onClick={nav.openQuests}>
          <div class="comic" style={{ fontSize: 18, color: 'var(--gold)' }}>
            📜 Daily Quests
          </div>
          <div class="small-text">
            {questsDone}/{DAILY_QUESTS.length + 1} done{questsReady ? <b style={{ color: 'var(--green)' }}> · {questsReady} ready!</b> : null}
          </div>
        </button>
        <button class="panel" style={{ flex: 1, textAlign: 'left', cursor: 'pointer', margin: 0 }} onClick={() => nav.go('summon')}>
          <div class="comic" style={{ fontSize: 18, color: 'var(--gold)' }}>
            📖 Summon
          </div>
          <div class="small-text">
            {s.currencies.tickets} tickets · {fmt(s.currencies.gems)} gems
          </div>
        </button>
      </div>

      <div class="panel" style={{ marginTop: 12 }}>
        <h3 class="panel-title">Kingdom</h3>
        <div class="hub-grid">
          {SCREENS.map((d) => {
            const locked = (d.unlockStage ?? 0) > s.stage;
            return (
              <button key={d.id} class={`hub-tile ${locked ? 'locked' : ''}`} onClick={() => nav.open(d.id)}>
                <span class="hub-ico">{locked ? '🔒' : d.icon}</span>
                <span class="hub-name">{d.title}</span>
                {!locked && d.badge?.(s) && <span class="badge-dot" />}
              </button>
            );
          })}
        </div>
      </div>

      {bursts.map((b) => (
        <div class="coin-burst" key={b.id} style={{ left: b.x, top: b.y, position: 'fixed', '--dx': `${b.dx}px`, '--dy': `${b.dy}px` } as any}>
          <CurrencyIcon kind={b.kind} size={22} />
        </div>
      ))}
    </div>
  );
}
