import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CharacterArt } from '../../art/CharacterArt';
import { getHero } from '../../data/heroes';
import { COST_SINGLE, COST_TEN, PITY_LEGENDARY, PITY_MYTHIC, RATES, getBanners, type Banner, type PullResult } from '../../game/gacha';
import { RARITY_INFO, fmt } from '../../game/stats';
import { summon, useGame } from '../../game/store';
import type { HeroDef, Rarity } from '../../game/types';
import { Burst, CurrencyIcon, HeroCard, Modal, Portal, RarityBadge, toast } from '../components/common';
import { haptic } from '../haptics';
import type { Nav } from '../nav';
import { reducedMotion } from '../prefs';
import { sfx } from '../sfx';
import './summon.css';

const GLOW: Record<Rarity, string> = { R: '#4fa3ff', SR: '#b46bff', SSR: '#ffc531', UR: '#ff3d6e' };
const RARITIES: Rarity[] = ['R', 'SR', 'SSR', 'UR'];

function tabLabel(b: Banner): string {
  return b.tab || (b.id === 'featured' ? '★ Featured' : b.name);
}

function safeHero(id: string): HeroDef | null {
  try {
    return getHero(id);
  } catch {
    return null;
  }
}

function GrimoireBook({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 180 180" class="book" aria-hidden="true">
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

function Reveal({ results, onDone, onAgain, again }: { results: PullResult[]; onDone: () => void; onAgain: () => void; again: { label: string; kind: 'tickets' | 'gems'; amt: number; ok: boolean } }) {
  const best = results.reduce((a, r) => Math.max(a, RARITY_INFO[r.hero.rarity].order), 0);
  const bestR = RARITIES[best];
  const [phase, setPhase] = useState<'book' | 'splash' | 'cards'>('book');
  const splashes = useMemo(() => results.filter((r) => r.hero.rarity === 'UR' || (r.hero.rarity === 'SSR' && r.isNew)), [results]);
  const [splashIdx, setSplashIdx] = useState(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const newCount = results.filter((r) => r.isNew).length;
  const pages = results.reduce((a, r) => a + (r.isNew ? 0 : r.shards), 0);

  useEffect(() => {
    sfx.summon();
    haptic(best >= 2 ? 'medium' : 'light');
    const t = setTimeout(() => advance(), reducedMotion() ? 500 : 1700);
    return () => clearTimeout(t);
  }, []);

  // Legendary+ heroes buzz when they appear (splash or, for dupes, the card grid).
  useEffect(() => {
    if (phase === 'splash') haptic('rare');
    if (phase !== 'cards') return;
    if (best >= 2 && !splashes.length) haptic('rare');
    const ts = results.map((r, i) => setTimeout(() => sfx.reveal(RARITY_INFO[r.hero.rarity].order), i * 110 + 200));
    return () => ts.forEach(clearTimeout);
  }, [phase]);

  function advance() {
    if (phaseRef.current !== 'book') return;
    if (splashes.length) {
      sfx.reveal(3);
      setPhase('splash');
    } else setPhase('cards');
  }

  const nextSplash = () => {
    if (splashIdx + 1 < splashes.length) {
      setSplashIdx(splashIdx + 1);
      sfx.reveal(3);
      haptic('rare');
    } else setPhase('cards');
  };

  const sp = splashes[splashIdx];
  return (
    <div class={`reveal reveal-${bestR}`} style={{ '--glow': GLOW[bestR] } as any} role="dialog" aria-modal="true" aria-label="Summon results">
      <div class="rays" />
      {phase === 'book' && (
        <button class="sum-book" onClick={advance} aria-label="Open the grimoire">
          <GrimoireBook color={GLOW[bestR]} />
          {best >= 2 && <Burst key="b" count={16} spread={130} colors={[GLOW[bestR], '#fff3a0', '#ffffff']} />}
          <div class="comic center sum-book-text">The grimoire answers...</div>
          <div class="muted small-text sum-skip">tap to skip</div>
        </button>
      )}
      {phase === 'splash' && sp && (
        <button class={`splash sum-splash ${sp.hero.rarity}`} key={splashIdx} style={{ '--sc': sp.hero.color, '--rc': GLOW[sp.hero.rarity] } as any} onClick={nextSplash}>
          <span class="sum-splash-rays" aria-hidden="true" />
          <Burst count={22} spread={170} colors={[GLOW[sp.hero.rarity], '#fff3a0', '#ffffff']} />
          <span class="sum-splash-tier">{RARITY_INFO[sp.hero.rarity].name}!</span>
          <div class="splash-art">
            <CharacterArt id={sp.hero.id} mode="full" />
          </div>
          {sp.isNew && <span class="sum-new-stamp">NEW!</span>}
          <h2>{sp.hero.name}</h2>
          <div class="small-text" style={{ fontWeight: 900, marginTop: 4 }}>
            {sp.hero.title}
          </div>
          <div class="quote" style={{ maxWidth: 280 }}>
            "{sp.hero.quote}"
          </div>
          <div class="muted small-text" style={{ marginTop: 14 }}>
            {splashes.length > 1 ? `${splashIdx + 1}/${splashes.length} · ` : ''}tap to continue
          </div>
        </button>
      )}
      {phase === 'cards' && (
        <>
          <div class="sum-summary" aria-live="polite">
            {newCount > 0 && <span class="chip sum-chip-new">{newCount} NEW</span>}
            {pages > 0 && <span class="chip">+{pages} pages</span>}
            <span class="chip" style={{ color: GLOW[bestR] }}>
              Best: {RARITY_INFO[bestR].name}
            </span>
          </div>
          <div class={`reveal-grid ${results.length === 1 ? 'single' : ''}`}>
            {results.map((r, i) => (
              <div class={`flip glow-${r.hero.rarity}`} key={i} style={{ position: 'relative', '--fd': `${i * 0.11}s` } as any}>
                <div class="flip-inner" style={{ animationDelay: `${i * 0.11}s`, animationFillMode: 'both' }}>
                  <div class="flip-face">
                    <HeroCard id={r.hero.id} />
                  </div>
                  <div class="flip-face flip-back">🍀</div>
                </div>
                {RARITY_INFO[r.hero.rarity].order >= 2 && <span class="sum-flare" aria-hidden="true" />}
                {r.isNew ? <div class="new-tag">NEW!</div> : <div class="shard-tag">+{r.shards} pages</div>}
              </div>
            ))}
          </div>
          <div class="row sum-again" style={{ marginTop: 22 }}>
            <button class="btn dark" onClick={onDone}>
              Done
            </button>
            <button class="btn" onClick={onAgain} disabled={!again.ok}>
              {again.label}
              <span class="cost">
                <CurrencyIcon kind={again.kind} size={16} />
                {fmt(again.amt)}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function BannerArt({ banner }: { banner: Banner }) {
  const feat = banner.featured.map(safeHero).filter(Boolean) as HeroDef[];
  if (!feat.length)
    return (
      <div class="b-art sum-trio">
        {['yuno', 'yami', 'noelle'].map((id, i) => (
          <div key={id} class={i === 1 ? 'mid' : ''}>
            <CharacterArt id={id} mode="full" />
          </div>
        ))}
      </div>
    );
  const [main, ...rest] = feat;
  return (
    <>
      {rest[1] && (
        <div class="b-art2 sum-side2">
          <CharacterArt id={rest[1].id} mode="full" />
        </div>
      )}
      {rest[0] && (
        <div class="b-art2 sum-side1">
          <CharacterArt id={rest[0].id} mode="full" />
        </div>
      )}
      <div class="b-art sum-main">
        <CharacterArt id={main.id} mode="full" />
      </div>
    </>
  );
}

export function Summon({ nav }: { nav: Nav }) {
  const s = useGame();
  const banners = getBanners();
  const [bannerId, setBannerId] = useState(banners[0].id);
  const banner = banners.find((b) => b.id === bannerId) ?? banners[0];
  const [dir, setDir] = useState<1 | -1>(1);
  const [results, setResults] = useState<{ list: PullResult[]; count: 1 | 10; key: number; banner: string } | null>(null);
  const [rates, setRates] = useState(false);
  // One pull at a time: a fast double tap must never spend twice.
  const busy = useRef(false);

  const doPull = (id: string, count: 1 | 10): boolean => {
    if (busy.current) return false;
    busy.current = true;
    const r = summon(id, count);
    if (!r) {
      busy.current = false;
      haptic('error');
      return false;
    }
    setResults({ list: r, count, key: Date.now(), banner: id });
    return true;
  };

  const pull = (count: 1 | 10) => {
    if (results) return;
    if (!doPull(banner.id, count)) toast('Not enough gems or tickets! Clear stages and quests to earn more.', 'bad');
  };

  const pick = (b: Banner) => {
    if (b.id === banner.id) return;
    const from = banners.findIndex((x) => x.id === banner.id);
    const to = banners.findIndex((x) => x.id === b.id);
    setDir(to > from ? 1 : -1);
    setBannerId(b.id);
    sfx.click();
    haptic('tap');
  };

  const label = (count: 1 | 10) => (s.currencies.tickets >= count ? { kind: 'tickets' as const, amt: count } : { kind: 'gems' as const, amt: count === 10 ? COST_TEN : COST_SINGLE });
  const afford = (count: 1 | 10) => s.currencies.tickets >= count || s.currencies.gems >= (count === 10 ? COST_TEN : COST_SINGLE);
  const l1 = label(1);
  const l10 = label(10);
  const featured = banner.featured.map(safeHero).filter(Boolean) as HeroDef[];

  return (
    <div class="screen">
      <div class="tabs sum-tabs" role="tablist" aria-label="Banners">
        {banners.map((b) => (
          <button key={b.id} role="tab" aria-selected={b.id === banner.id} class={`tab ${b.id === banner.id ? 'on' : ''} ${b.limited ? 'limited' : ''}`} onClick={() => pick(b)}>
            <span class="sum-tab-lbl">{tabLabel(b)}</span>
            {b.limited && <span class="sum-tab-spark" aria-hidden="true" />}
          </button>
        ))}
      </div>

      <div class={`banner sum-banner ${banner.limited ? 'limited' : ''} ${dir > 0 ? 'from-r' : 'from-l'}`} key={banner.id} style={{ '--b1': banner.colors[0], '--b2': banner.colors[1] } as any}>
        <div class="b-bg" />
        <BannerArt banner={banner} />
        <div class="b-text">
          <div class={`chip on sum-badge ${banner.limited ? 'lim' : ''}`}>{banner.badge || (banner.id === 'featured' ? 'RATE UP · THIS WEEK' : 'ALWAYS OPEN')}</div>
          <h2>{banner.name}</h2>
        </div>
        <div class="b-tag sum-tagline">{banner.tagline}</div>
      </div>

      <div class="pull-btns">
        <button onClick={() => pull(1)} aria-disabled={!afford(1)} class={`btn blue ${afford(1) ? '' : 'sum-poor'}`}>
          Summon ×1
          <span class="cost">
            <CurrencyIcon kind={l1.kind} size={16} />
            {fmt(l1.amt)}
          </span>
        </button>
        <button onClick={() => pull(10)} aria-disabled={!afford(10)} class={`btn sum-ten ${afford(10) ? '' : 'sum-poor'}`}>
          Summon ×10
          <span class="cost">
            <CurrencyIcon kind={l10.kind} size={16} />
            {fmt(l10.amt)}
          </span>
        </button>
      </div>

      <div class="panel" style={{ marginTop: 12 }}>
        <div class="spread">
          <div style={{ minWidth: 0 }}>
            <div class="small-text">
              Legendary+ guaranteed in <b style={{ color: 'var(--ssr)' }}>{Math.max(1, PITY_LEGENDARY - s.gacha.pity)}</b> summons
            </div>
            <div class="bar sum-pity" aria-hidden="true">
              <i style={{ width: `${Math.min(100, (s.gacha.pity / PITY_LEGENDARY) * 100)}%`, background: 'linear-gradient(90deg,#ff9f1c,#ffc531)' }} />
            </div>
            <div class="small-text">
              Mythic guaranteed in <b style={{ color: 'var(--ur)' }}>{Math.max(1, PITY_MYTHIC - s.gacha.mythicPity)}</b> summons
            </div>
            <div class="bar sum-pity" aria-hidden="true">
              <i style={{ width: `${Math.min(100, (s.gacha.mythicPity / PITY_MYTHIC) * 100)}%`, background: 'linear-gradient(90deg,#b46bff,#ff3d6e)' }} />
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
          <div class="hero-grid sum-feat">
            {featured.map((h) => (
              <HeroCard key={h.id} id={h.id} owned={s.heroes[h.id]} onClick={() => nav.openHero(h.id)} />
            ))}
          </div>
        </div>
      )}

      {rates && (
        <Modal center onClose={() => setRates(false)} label="Summon rates">
          <h3 class="panel-title">Summon Rates</h3>
          {RARITIES.slice()
            .reverse()
            .map((r) => (
              <div class="spread" key={r} style={{ padding: '4px 0' }}>
                <RarityBadge r={r} />
                <b>{(RATES[r] * 100).toFixed(1)}%</b>
              </div>
            ))}
          <p class="small-text muted">
            Featured heroes take 50% of their rarity's share{banner.limited ? ' (each limited Mythic takes 25%)' : ''}. Legendary+ is guaranteed within {PITY_LEGENDARY} summons and a Mythic within {PITY_MYTHIC}. Duplicates become
            grimoire pages used for Star Ups.
          </p>
        </Modal>
      )}

      {results && (
        <Portal>
          <Reveal
            key={results.key}
            results={results.list}
            again={{ label: `Again ×${results.count}`, ...label(results.count), ok: afford(results.count) }}
            onDone={() => {
              busy.current = false;
              setResults(null);
            }}
            onAgain={() => {
              busy.current = false;
              if (!doPull(results.banner, results.count)) {
                toast('Not enough gems or tickets!', 'bad');
                setResults(null);
              }
            }}
          />
        </Portal>
      )}
    </div>
  );
}
