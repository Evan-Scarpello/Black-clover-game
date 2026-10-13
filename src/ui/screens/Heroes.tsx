import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { FACTIONS } from '../../data/formations';
import { SUMMONABLE, getHero } from '../../data/heroes';
import { RARITY_INFO, heroPower } from '../../game/stats';
import { canLevel, useGame } from '../../game/store';
import type { HeroDef, Role } from '../../game/types';
import { HeroCard } from '../components/common';
import { captureRects, playFlip, type Rects } from '../flip';
import { haptic } from '../haptics';
import type { Nav } from '../nav';
import './heroes.css';

type Sort = 'power' | 'rarity' | 'level';
const SORT_LABEL: Record<Sort, string> = { power: '⚡ Power', rarity: '💎 Rarity', level: '⬆ Level' };

function safeHero(id: string): HeroDef | null {
  try {
    return getHero(id);
  } catch {
    return null;
  }
}

export function Heroes({ nav }: { nav: Nav }) {
  const s = useGame();
  const [role, setRole] = useState<Role | 'All'>('All');
  const [faction, setFaction] = useState<string>('All');
  const [sort, setSort] = useState<Sort>('power');
  const listRef = useRef<HTMLDivElement>(null);
  const before = useRef<Rects | null>(null);

  // FLIP: remember where cards were before a filter/sort change, then glide them.
  const change = (fn: () => void) => {
    before.current = captureRects(listRef.current, 'data-hero');
    haptic('tap');
    fn();
  };
  useLayoutEffect(() => {
    if (!before.current) return;
    playFlip(listRef.current, before.current, 'data-hero');
    before.current = null;
  }, [role, faction, sort]);

  const match = (h: HeroDef) => (role === 'All' || h.role === role) && (faction === 'All' || h.faction === faction);

  const owned = Object.values(s.heroes)
    .map((o) => ({ o, def: safeHero(o.id) }))
    .filter((x): x is { o: (typeof x)['o']; def: HeroDef } => !!x.def && match(x.def))
    .map((x) => ({ ...x, p: heroPower(x.def, x.o.level, x.o.stars) }))
    .sort((a, b) => {
      if (sort === 'rarity') return RARITY_INFO[b.def.rarity].order - RARITY_INFO[a.def.rarity].order || b.p - a.p;
      if (sort === 'level') return b.o.level - a.o.level || b.p - a.p;
      return b.p - a.p;
    });
  const missing = SUMMONABLE.filter((h) => !s.heroes[h.id] && match(h)).sort((a, b) => RARITY_INFO[b.rarity].order - RARITY_INFO[a.rarity].order);
  const total = SUMMONABLE.length;
  const have = SUMMONABLE.filter((h) => s.heroes[h.id]).length;
  const squad = new Set(s.squad.slots.filter(Boolean) as string[]);
  const filtered = role !== 'All' || faction !== 'All';

  return (
    <div class="screen heroes-screen">
      <div class="spread" style={{ marginBottom: 8 }}>
        <h2 class="panel-title" style={{ margin: 0, fontSize: 28 }}>
          Magic Knights
        </h2>
        <span class="chip heroes-count" aria-label={`${have} of ${total} heroes collected`}>
          📚 {have}/{total}
          <span class="heroes-count-bar" aria-hidden="true">
            <i style={{ width: `${(have / Math.max(1, total)) * 100}%` }} />
          </span>
        </span>
      </div>
      <div class="chips" role="group" aria-label="Filter by role">
        {(['All', 'Attacker', 'Defender', 'Support'] as const).map((r) => (
          <button key={r} class={`chip ${role === r ? 'on' : ''}`} aria-pressed={role === r} onClick={() => role !== r && change(() => setRole(r))}>
            {r === 'Attacker' ? '⚔️ ' : r === 'Defender' ? '🛡️ ' : r === 'Support' ? '✨ ' : ''}
            {r}
          </button>
        ))}
      </div>
      <div class="chips" style={{ marginTop: 4 }} role="group" aria-label="Filter by squad">
        <button class={`chip ${faction === 'All' ? 'on' : ''}`} aria-pressed={faction === 'All'} onClick={() => faction !== 'All' && change(() => setFaction('All'))}>
          All Squads
        </button>
        {FACTIONS.map((f) => (
          <button key={f.id} class={`chip ${faction === f.id ? 'on' : ''}`} aria-pressed={faction === f.id} onClick={() => faction !== f.id && change(() => setFaction(f.id))}>
            {f.emblem} {f.id}
          </button>
        ))}
      </div>
      <div class="row heroes-sort" role="group" aria-label="Sort">
        <span class="small-text muted">Sort</span>
        {(['power', 'rarity', 'level'] as const).map((k) => (
          <button key={k} class={`chip ${sort === k ? 'on' : ''}`} aria-pressed={sort === k} onClick={() => sort !== k && change(() => setSort(k))}>
            {SORT_LABEL[k]}
          </button>
        ))}
        {filtered && (
          <button
            class="chip heroes-clear"
            onClick={() =>
              change(() => {
                setRole('All');
                setFaction('All');
              })
            }
          >
            ✕ Clear
          </button>
        )}
      </div>
      <div ref={listRef}>
        <div class="hero-grid">
          {owned.map(({ o }) => (
            <HeroCard key={o.id} id={o.id} owned={o} inSquad={squad.has(o.id)} upgradable={canLevel(s, o.id)} onClick={() => nav.openHero(o.id)} />
          ))}
        </div>
        {!owned.length && (
          <div class="empty-hint heroes-empty">
            {filtered ? 'None of your heroes match these filters.' : 'No heroes yet. Head to the Grimoire Tower to summon some!'}
          </div>
        )}
        {missing.length > 0 && (
          <>
            <h3 class="panel-title heroes-missing-title">
              Not yet summoned <span class="chip">{missing.length}</span>
            </h3>
            <div class="hero-grid">
              {missing.map((h) => (
                <HeroCard key={h.id} id={h.id} locked onClick={() => nav.openHero(h.id)} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
