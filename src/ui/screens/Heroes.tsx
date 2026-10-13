import { useState } from 'preact/hooks';
import { FACTIONS } from '../../data/formations';
import { SUMMONABLE, getHero } from '../../data/heroes';
import { RARITY_INFO, heroPower } from '../../game/stats';
import { canLevel, useGame } from '../../game/store';
import type { Role } from '../../game/types';
import type { Nav } from '../nav';
import { HeroCard } from '../components/common';

type Sort = 'power' | 'rarity' | 'level';

export function Heroes({ nav }: { nav: Nav }) {
  const s = useGame();
  const [role, setRole] = useState<Role | 'All'>('All');
  const [faction, setFaction] = useState<string>('All');
  const [sort, setSort] = useState<Sort>('power');

  const match = (id: string) => {
    const h = getHero(id);
    return (role === 'All' || h.role === role) && (faction === 'All' || h.faction === faction);
  };

  const owned = Object.values(s.heroes)
    .filter((h) => match(h.id))
    .map((h) => ({ o: h, def: getHero(h.id), p: heroPower(getHero(h.id), h.level, h.stars) }))
    .sort((a, b) => {
      if (sort === 'rarity') return RARITY_INFO[b.def.rarity].order - RARITY_INFO[a.def.rarity].order || b.p - a.p;
      if (sort === 'level') return b.o.level - a.o.level || b.p - a.p;
      return b.p - a.p;
    });
  const missing = SUMMONABLE.filter((h) => !s.heroes[h.id] && match(h.id)).sort((a, b) => RARITY_INFO[b.rarity].order - RARITY_INFO[a.rarity].order);
  const total = SUMMONABLE.length;
  const have = SUMMONABLE.filter((h) => s.heroes[h.id]).length;

  return (
    <div class="screen">
      <div class="spread" style={{ marginBottom: 8 }}>
        <h2 class="panel-title" style={{ margin: 0, fontSize: 28 }}>
          Magic Knights
        </h2>
        <span class="chip">
          📚 {have}/{total} collected
        </span>
      </div>
      <div class="chips">
        {(['All', 'Attacker', 'Defender', 'Support'] as const).map((r) => (
          <button key={r} class={`chip ${role === r ? 'on' : ''}`} onClick={() => setRole(r)}>
            {r === 'Attacker' ? '⚔️ ' : r === 'Defender' ? '🛡️ ' : r === 'Support' ? '✨ ' : ''}
            {r}
          </button>
        ))}
      </div>
      <div class="chips" style={{ marginTop: 4 }}>
        <button class={`chip ${faction === 'All' ? 'on' : ''}`} onClick={() => setFaction('All')}>
          All Squads
        </button>
        {FACTIONS.map((f) => (
          <button key={f.id} class={`chip ${faction === f.id ? 'on' : ''}`} onClick={() => setFaction(f.id)}>
            {f.emblem} {f.id}
          </button>
        ))}
      </div>
      <div class="row" style={{ margin: '6px 0 10px' }}>
        <span class="small-text muted">Sort:</span>
        {(['power', 'rarity', 'level'] as const).map((k) => (
          <button key={k} class={`chip ${sort === k ? 'on' : ''}`} onClick={() => setSort(k)} style={{ cursor: 'pointer' }}>
            {k}
          </button>
        ))}
      </div>
      <div class="hero-grid">
        {owned.map(({ o }) => (
          <HeroCard key={o.id} id={o.id} owned={o} inSquad={false} upgradable={canLevel(s, o.id)} onClick={() => nav.openHero(o.id)} />
        ))}
      </div>
      {missing.length > 0 && (
        <>
          <h3 class="panel-title" style={{ marginTop: 18, fontSize: 18, color: 'var(--muted)' }}>
            Not yet summoned
          </h3>
          <div class="hero-grid">
            {missing.map((h) => (
              <HeroCard key={h.id} id={h.id} locked onClick={() => nav.openHero(h.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
