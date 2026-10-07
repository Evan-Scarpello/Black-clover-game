import { CharacterArt } from '../../art/CharacterArt';
import { FACTION_MAP, BONDS } from '../../data/formations';
import { SUMMONABLE, getHero } from '../../data/heroes';
import { MAX_STARS, RARITY_INFO, ROLE_INFO, fmt, heroPower, heroStats, levelCap, levelUpCost, starUpCost } from '../../game/stats';
import { canAfford, levelUp, starUp, useGame } from '../../game/store';
import { Cost, Modal, RarityBadge, Stars, toast } from '../components/common';
import { sfx } from '../sfx';
import { modsText } from './Squad';

function Desc({ text }: { text: string }) {
  if (text.startsWith('FORMATION SHIFT')) {
    return (
      <p>
        <span class="shift-tag">⇄ FORMATION SHIFT</span>
        {text.slice('FORMATION SHIFT'.length)}
      </p>
    );
  }
  return <p>{text}</p>;
}

export function HeroDetail({ id, onClose, onNavigate }: { id: string; onClose: () => void; onNavigate: (id: string) => void }) {
  const s = useGame();
  const h = getHero(id);
  const owned = s.heroes[id];
  const level = owned?.level ?? 1;
  const stars = owned?.stars ?? RARITY_INFO[h.rarity].startStars;
  const st = heroStats(h, level, stars);
  const cap = levelCap(stars);
  const cost = levelUpCost(level);
  const starCost = stars < MAX_STARS ? starUpCost(h, stars) : 0;
  const faction = FACTION_MAP[h.faction];
  const bonds = BONDS.filter((b) => b.heroes.includes(id));

  const list = SUMMONABLE.filter((x) => s.heroes[x.id] || !owned).map((x) => x.id);
  const idx = list.indexOf(id);

  const doLevel = (n: number) => {
    const done = levelUp(id, n);
    if (done) {
      sfx.coin();
      toast(`${h.name.split(' ')[0]} reached Lv ${s.heroes[id].level}!`);
    } else if (level >= cap) toast('Level cap reached — star up to raise it!');
    else toast('Not enough Yul or Essence.');
  };

  return (
    <Modal onClose={onClose}>
      <div class="hd-head" style={{ '--hc': h.color } as any}>
        <div class="hd-bg" />
        <div class="hd-art">
          <CharacterArt id={id} mode="full" />
        </div>
        <div class="hd-info">
          <RarityBadge r={h.rarity} />
          <h2 style={{ marginTop: 6 }}>{h.name}</h2>
          <div class="hd-title">{h.title}</div>
          <div class="row wrap" style={{ gap: 4 }}>
            <span class="chip" style={{ background: ROLE_INFO[h.role].color, color: '#0b0710' }}>
              {ROLE_INFO[h.role].icon} {h.role}
            </span>
            <span class="chip">{h.range === 'melee' ? '🗡 Melee' : '🏹 Ranged'}</span>
            {faction && (
              <span class="chip" style={{ color: faction.color }}>
                {faction.emblem} {h.faction}
              </span>
            )}
          </div>
          <div class="quote">"{h.quote}"</div>
        </div>
        {list.length > 1 && idx >= 0 && (
          <>
            <button class="icon-btn" style={{ position: 'absolute', left: 8, top: 10 }} onClick={() => onNavigate(list[(idx - 1 + list.length) % list.length])}>
              ◀
            </button>
            <button class="icon-btn" style={{ position: 'absolute', left: 46, top: 10 }} onClick={() => onNavigate(list[(idx + 1) % list.length])}>
              ▶
            </button>
          </>
        )}
      </div>

      <div class="spread" style={{ marginTop: 10 }}>
        <div>
          <Stars n={stars} max={MAX_STARS} />
          <div class="comic" style={{ fontSize: 20 }}>
            Lv {level}
            <span class="muted" style={{ fontSize: 15 }}>
              {' '}
              / {cap}
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div class="small-text muted">Power</div>
          <div class="power" style={{ fontSize: 24 }}>
            ⚡{fmt(heroPower(h, level, stars))}
          </div>
        </div>
      </div>

      <div class="stat-grid">
        {[
          ['HP', fmt(st.hp)],
          ['ATK', fmt(st.atk)],
          ['DEF', fmt(st.def)],
          ['SPD', Math.round(st.spd)],
          ['CRIT', `${Math.round(st.crit * 100)}%`],
          ['MAGIC', h.magic],
        ].map(([k, v]) => (
          <div class="stat" key={k}>
            <div class="k">{k}</div>
            <div class="v" style={k === 'MAGIC' ? { fontSize: 11, lineHeight: '17px' } : undefined}>
              {v}
            </div>
          </div>
        ))}
      </div>

      {owned ? (
        <div class="upgrade-row">
          <button class="btn green" disabled={level >= cap || !canAfford(cost)} onClick={() => doLevel(1)} style={{ flexDirection: 'column', gap: 0 }}>
            Level Up
            <span class="row" style={{ gap: 6 }}>
              <Cost kind="yul" amount={cost.yul} />
              <Cost kind="essence" amount={cost.essence} />
            </span>
          </button>
          <button class="btn blue" disabled={level >= cap || !canAfford(cost)} onClick={() => doLevel(10)}>
            Lv +10
          </button>
          <button
            class="btn purple"
            style={{ gridColumn: 'span 2' }}
            disabled={stars >= MAX_STARS || owned.shards < starCost}
            onClick={() => {
              if (starUp(id)) {
                sfx.reveal(2);
                toast(`${h.name.split(' ')[0]} ascended to ${stars + 1}★! Level cap is now ${levelCap(stars + 1)}.`);
              }
            }}
          >
            {stars >= MAX_STARS ? 'MAX STARS' : `★ Star Up · ${owned.shards}/${starCost} grimoire pages`}
          </button>
        </div>
      ) : (
        <div class="panel center" style={{ marginTop: 10 }}>
          <b>Not summoned yet.</b>
          <div class="small-text muted">Find {h.name.split(' ')[0]} in the Grimoire Tower.</div>
        </div>
      )}
      {owned && <div class="small-text muted center" style={{ marginTop: 6 }}>Duplicate summons become grimoire pages used for Star Ups.</div>}

      <div class="ability">
        <div class="ab-head">
          <span class="ab-kind" style={{ background: 'var(--gold)' }}>
            ULTIMATE
          </span>
          <span class="ab-name">{h.ultimate.name}</span>
        </div>
        <Desc text={h.ultimate.desc} />
      </div>
      <div class="ability">
        <div class="ab-head">
          <span class="ab-kind" style={{ background: '#b46bff', color: '#fff' }}>
            PASSIVE
          </span>
          <span class="ab-name">{h.passive.name}</span>
        </div>
        <p>{h.passive.desc}</p>
      </div>
      <div class="ability">
        <div class="ab-head">
          <span class="ab-kind" style={{ background: '#4fc3f7' }}>
            FORMATION
          </span>
          <span class="ab-name">{h.formation.name}</span>
        </div>
        <p>
          <b style={{ color: '#ffb0b0' }}>Front row:</b> {modsText(h.formation.front)}
          <br />
          <b style={{ color: '#9fd2ff' }}>Back row:</b> {modsText(h.formation.back)}
        </p>
      </div>
      <div class="ability">
        <div class="ab-head">
          <span class="ab-kind" style={{ background: '#ddd' }}>
            BASIC
          </span>
          <span class="ab-name">{h.basic.name}</span>
        </div>
        <p>
          {h.range === 'melee' ? 'Strikes the enemy front row' : 'Fires at the enemy front row, sometimes sniping the back row'} for {Math.round((h.basic.mult ?? 1) * 100)}% ATK. Builds energy for the
          ultimate.
        </p>
      </div>
      {(faction || bonds.length > 0) && (
        <div class="ability">
          <div class="ab-head">
            <span class="ab-kind" style={{ background: faction?.color ?? '#ccc' }}>
              SYNERGY
            </span>
            <span class="ab-name">{faction?.synergy ?? 'Bonds'}</span>
          </div>
          {faction && <p>{faction.tiers.map((t) => `${t.count} ${h.faction}: ${t.text}`).join(' · ')}</p>}
          {bonds.map((b) => (
            <p key={b.id} style={{ marginTop: 4 }}>
              🔗 <b>{b.name}</b> with {b.heroes.filter((x) => x !== id).map((x) => getHero(x).name.split(' ')[0]).join(' / ')}: {b.text}
            </p>
          ))}
        </div>
      )}
    </Modal>
  );
}
