import { useEffect, useMemo, useState } from 'preact/hooks';
import { CharacterArt } from '../../art/CharacterArt';
import { getHero } from '../../data/heroes';
import { COST_SINGLE, COST_TEN, PITY_LEGENDARY, PITY_MYTHIC, RATES, getBanners, type PullResult } from '../../game/gacha';
import { RARITY_INFO, fmt } from '../../game/stats';
import { summon, useGame } from '../../game/store';
import type { Rarity } from '../../game/types';
import type { Nav } from '../nav';
import { CurrencyIcon, HeroCard, Modal, Portal, RarityBadge, toast } from '../components/common';
import { sfx } from '../sfx';

const GLOW: Record<Rarity, string> = { R: '#4fa3ff', SR: '#b46bff', SSR: '#ffc531', UR: '#ff3d6e' };

function GrimoireBook({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 180 180" class="book">
      <circle cx="90" cy="90" r="80" fill={color} opacity="0.25" />
      <circle cx="90" cy="90" r="58" fill={color} opacity="0.3" />
      <g stroke="#0b0710" stroke-width="4" stroke-linejoin="round">
        <path d="M30 50 L90 40 L150 50 L150 140 L90 150 L30 140Z" fill="#2a1d14" />
        <path d="M36 54 L88 46 L88 142 L36 134Z" fill="#f3ead2" />
        <path d="M144 54 L92 46 L92 142 L144 134Z" fill="#efe3c6" />
      </g>
      <g fill={color} stroke="#0b0710" stroke-width="2.5">
        <circle cx="62" cy="80" r="11" />
        <circle cx="74" cy="92" r="11" />
        <circle cx="62" cy="104" r="11" />
        <circle cx="50" cy="92" r="11" />
      </g>
      <g stroke={color} stroke-width="3" opacity="0.9">
        <path d="M104 74 h28 M104 88 h22 M104 102 h28 M104 116 h18" />
      </g>
    </svg>
  );
}

function Reveal({ results, onDone, onAgain, againLabel }: { results: PullResult[]; onDone: () => void; onAgain: () => void; againLabel: string }) {
  const best = results.reduce((a, r) => Math.max(a, RARITY_INFO[r.hero.rarity].order), 0);
  const bestR = (['R', 'SR', 'SSR', 'UR'] as Rarity[])[best];
  const [phase, setPhase] = useState<'book' | 'splash' | 'cards'>('book');
  const splashes = useMemo(() => results.filter((r) => r.hero.rarity === 'UR' || (r.hero.rarity === 'SSR' && r.isNew)), [results]);
  const [splashIdx, setSplashIdx] = useState(0);

  useEffect(() => {
    sfx.summon();
    const t = setTimeout(() => advance(), 1700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase === 'cards') results.forEach((r, i) => setTimeout(() => sfx.reveal(RARITY_INFO[r.hero.rarity].order), i * 110 + 200));
  }, [phase]);

  function advance() {
    setPhase((p) => {
      if (p === 'book') {
        if (splashes.length) {
          sfx.reveal(3);
          return 'splash';
        }
        return 'cards';
      }
      return p;
    });
  }

  const nextSplash = () => {
    if (splashIdx + 1 < splashes.length) {
      setSplashIdx(splashIdx + 1);
      sfx.reveal(3);
    } else setPhase('cards');
  };

  return (
    <div class="reveal" style={{ '--glow': GLOW[bestR] } as any}>
      <div class="rays" />
      {phase === 'book' && (
        <div onClick={advance} style={{ cursor: 'pointer', position: 'relative' }}>
          <GrimoireBook color={GLOW[bestR]} />
          <div class="comic center" style={{ fontSize: 22, marginTop: 10 }}>
            The grimoire answers...
          </div>
        </div>
      )}
      {phase === 'splash' && splashes[splashIdx] && (
        <div class="splash" style={{ '--sc': splashes[splashIdx].hero.color } as any} onClick={nextSplash}>
          <RarityBadge r={splashes[splashIdx].hero.rarity} />
          <div class="splash-art">
            <CharacterArt id={splashes[splashIdx].hero.id} mode="full" />
          </div>
          <h2>{splashes[splashIdx].hero.name}</h2>
          <div class="small-text" style={{ fontWeight: 900, marginTop: 4 }}>
            {splashes[splashIdx].hero.title}
          </div>
          <div class="quote" style={{ maxWidth: 280 }}>"{splashes[splashIdx].hero.quote}"</div>
          <div class="muted small-text" style={{ marginTop: 14 }}>
            tap to continue
          </div>
        </div>
      )}
      {phase === 'cards' && (
        <>
          <div class={`reveal-grid ${results.length === 1 ? 'single' : ''}`}>
            {results.map((r, i) => (
              <div class={`flip glow-${r.hero.rarity}`} key={i} style={{ position: 'relative' }}>
                <div class="flip-inner" style={{ animationDelay: `${i * 0.11}s`, animationFillMode: 'both' }}>
                  <div class="flip-face">
                    <HeroCard id={r.hero.id} />
                  </div>
                  <div class="flip-face flip-back">🍀</div>
                </div>
                {r.isNew ? <div class="new-tag">NEW!</div> : <div class="shard-tag">+{r.shards} pages</div>}
              </div>
            ))}
          </div>
          <div class="row" style={{ marginTop: 22 }}>
            <button class="btn dark" onClick={onDone}>
              Done
            </button>
            <button class="btn" onClick={onAgain}>
              {againLabel}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function Summon({ nav }: { nav: Nav }) {
  const s = useGame();
  const banners = getBanners();
  const [bannerId, setBannerId] = useState(banners[0].id);
  const banner = banners.find((b) => b.id === bannerId)!;
  const [results, setResults] = useState<{ list: PullResult[]; count: 1 | 10; key: number } | null>(null);
  const [rates, setRates] = useState(false);

  const pull = (count: 1 | 10) => {
    const r = summon(bannerId, count);
    if (!r) {
      toast('Not enough gems or tickets! Clear stages and quests to earn more.');
      return;
    }
    setResults({ list: r, count, key: Date.now() });
  };

  const label = (count: 1 | 10) => (s.currencies.tickets >= count ? { kind: 'tickets' as const, amt: count } : { kind: 'gems' as const, amt: count === 10 ? COST_TEN : COST_SINGLE });
  const l1 = label(1);
  const l10 = label(10);
  const featured = banner.featured.map(getHero);

  return (
    <div class="screen">
      <div class="tabs">
        {banners.map((b) => (
          <button key={b.id} class={`tab ${b.id === bannerId ? 'on' : ''}`} onClick={() => setBannerId(b.id)}>
            {b.id === 'featured' ? '★ Featured' : 'Standard'}
          </button>
        ))}
      </div>

      <div class="banner" style={{ '--b1': banner.colors[0], '--b2': banner.colors[1] } as any}>
        <div class="b-bg" />
        {featured.length ? (
          <>
            <div class="b-art2" style={{ right: 150, bottom: 10 }}>
              <CharacterArt id={featured[1].id} mode="full" />
            </div>
            <div class="b-art2" style={{ right: 100, bottom: -4, width: 96, height: 116 }}>
              <CharacterArt id={featured[2].id} mode="full" />
            </div>
            <div class="b-art">
              <CharacterArt id={featured[0].id} mode="full" />
            </div>
          </>
        ) : (
          <div class="b-art" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: 260, right: -20 }}>
            {['yuno', 'yami', 'noelle'].map((id, i) => (
              <div key={id} style={{ width: i === 1 ? 120 : 92, height: i === 1 ? 150 : 112, margin: '0 -14px', zIndex: i === 1 ? 2 : 1 }}>
                <CharacterArt id={id} mode="full" />
              </div>
            ))}
          </div>
        )}
        <div class="b-text">
          <div class="chip on" style={{ marginBottom: 6 }}>
            {banner.id === 'featured' ? 'RATE UP · THIS WEEK' : 'ALWAYS OPEN'}
          </div>
          <h2>{banner.name}</h2>
          <div class="b-tag">{banner.tagline}</div>
        </div>
      </div>

      <div class="pull-btns">
        <button class="btn blue" onClick={() => pull(1)}>
          Summon ×1
          <span class="cost">
            <CurrencyIcon kind={l1.kind} size={16} />
            {fmt(l1.amt)}
          </span>
        </button>
        <button class="btn" onClick={() => pull(10)}>
          Summon ×10
          <span class="cost">
            <CurrencyIcon kind={l10.kind} size={16} />
            {fmt(l10.amt)}
          </span>
        </button>
      </div>

      <div class="panel" style={{ marginTop: 12 }}>
        <div class="spread">
          <div>
            <div class="small-text">
              Legendary+ guaranteed in <b style={{ color: 'var(--ssr)' }}>{PITY_LEGENDARY - s.gacha.pity}</b> summons
            </div>
            <div class="small-text">
              Mythic guaranteed in <b style={{ color: 'var(--ur)' }}>{PITY_MYTHIC - s.gacha.mythicPity}</b> summons
            </div>
            <div class="small-text muted">Every ×10 includes at least one Epic or better.{!s.gacha.firstTen && ' Your first ×10 guarantees a Legendary!'}</div>
          </div>
          <button class="btn dark small" onClick={() => setRates(true)}>
            Rates
          </button>
        </div>
      </div>

      {featured.length > 0 && (
        <div class="panel">
          <h3 class="panel-title">Featured Heroes</h3>
          <div class="hero-grid">
            {featured.map((h) => (
              <HeroCard key={h.id} id={h.id} owned={s.heroes[h.id]} onClick={() => nav.openHero(h.id)} />
            ))}
          </div>
        </div>
      )}

      {rates && (
        <Modal center onClose={() => setRates(false)}>
          <h3 class="panel-title">Summon Rates</h3>
          {(['UR', 'SSR', 'SR', 'R'] as Rarity[]).map((r) => (
            <div class="spread" key={r} style={{ padding: '4px 0' }}>
              <RarityBadge r={r} />
              <b>{(RATES[r] * 100).toFixed(1)}%</b>
            </div>
          ))}
          <p class="small-text muted">
            Featured heroes take 50% of their rarity's share. Legendary+ is guaranteed within {PITY_LEGENDARY} summons and a Mythic within {PITY_MYTHIC}. Duplicates become 10 grimoire pages (20 for
            Mythics) used for Star Ups.
          </p>
        </Modal>
      )}

      {results && (
        <Portal>
        <Reveal
          key={results.key}
          results={results.list}
          againLabel={`Again ×${results.count}`}
          onDone={() => setResults(null)}
          onAgain={() => {
            const r = summon(bannerId, results.count);
            if (!r) {
              toast('Not enough gems or tickets!');
              setResults(null);
            } else setResults({ list: r, count: results.count, key: Date.now() });
          }}
        />
        </Portal>
      )}
    </div>
  );
}
