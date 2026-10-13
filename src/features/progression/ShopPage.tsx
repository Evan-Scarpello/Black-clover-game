import { useEffect, useRef, useState } from 'preact/hooks';
import { CharacterArt } from '../../art/CharacterArt';
import { HERO_MAP } from '../../data/heroes';
import type { Currencies } from '../../game/state';
import { RARITY_INFO, fmt, fmtShort } from '../../game/stats';
import { useGame } from '../../game/store';
import { CURRENCY_NAMES, CurrencyIcon, Modal, RarityBadge, RewardList, formatDuration, toast, useNow } from '../../ui/components/common';
import type { ScreenProps } from '../../ui/nav';
import { sfx } from '../../ui/sfx';
import { buyOffer, refreshShop, syncProgression, takeGift } from './actions';
import { REFRESH_COSTS, shopView, type ShopOffer } from './logic';
import { RewardChips, msToMidnight, rewardText } from './parts';

function priceOf(o: ShopOffer): { kind: keyof Currencies; amount: number } {
  const kind = (Object.keys(o.price) as (keyof Currencies)[]).find((k) => (o.price[k] ?? 0) > 0) ?? 'gems';
  return { kind, amount: o.price[kind] ?? 0 };
}

function offerInfo(o: ShopOffer): { title: string; qty: string; heroId?: string; icon?: keyof Currencies } {
  if (o.heroId) {
    const h = HERO_MAP[o.heroId];
    return { title: h ? h.name.split(' ')[0] : 'Hero', qty: `${o.reward.shards?.[o.heroId] ?? 0} pages`, heroId: o.heroId };
  }
  const k = (Object.keys(o.reward) as (keyof Currencies)[]).find((x) => x !== ('shards' as any) && (o.reward[x] ?? 0) > 0) ?? 'yul';
  const n = o.reward[k] ?? 0;
  return { title: k === 'tickets' ? 'Summon Ticket' : CURRENCY_NAMES[k], qty: k === 'tickets' ? `×${n}` : `+${fmtShort(n)}`, icon: k };
}

export function ShopPage(_: ScreenProps) {
  const s = useGame();
  const now = useNow(1000);
  const v = shopView(s, now);
  const [sel, setSel] = useState<ShopOffer | null>(null);
  const [spin, setSpin] = useState(0);
  // Ignore a quick second tap on "New stock" so a double-tap doesn't pay for two refreshes.
  const lastRefresh = useRef(0);

  useEffect(() => {
    syncProgression();
  }, []);

  const left = REFRESH_COSTS.length - v.refreshes;

  const buy = (o: ShopOffer) => {
    const r = buyOffer(o.key);
    if (r.ok) {
      sfx.coin();
      toast(`Bought! ${rewardText(o.reward)}`);
      setSel(null);
    } else if (r.reason === 'funds') toast(`Not enough ${CURRENCY_NAMES[priceOf(o).kind]}.`);
    else {
      toast('That deal is gone — check the new stock.');
      setSel(null);
    }
  };

  const refresh = () => {
    if (v.refreshCost === null) return;
    const t = Date.now();
    if (t - lastRefresh.current < 700) return;
    lastRefresh.current = t;
    if (s.currencies.gems < v.refreshCost) {
      toast('Not enough gems to refresh.');
      return;
    }
    if (refreshShop()) {
      sfx.click();
      setSpin((n) => n + 1);
      toast('Fresh stock is in!');
    }
  };

  const gift = () => {
    const r = takeGift();
    if (r) {
      sfx.coin();
      toast(`Free gift: ${rewardText(r)}`);
    }
  };

  return (
    <div class="screen prog-shop">
      <div class={`panel prog-gift ${v.giftReady ? 'ready' : ''}`}>
        <div class="prog-gift-box" aria-hidden="true">
          🎁
        </div>
        <div class="prog-gift-text">
          <b class="comic">Daily free gift</b>
          <RewardChips r={v.gift} size={16} />
        </div>
        {v.giftReady ? (
          <button class="btn green small" onClick={gift}>
            Free!
          </button>
        ) : (
          <span class="chip">✓ {formatDuration(msToMidnight(now))}</span>
        )}
      </div>

      <div class="spread prog-shop-head">
        <h3 class="panel-title" style={{ margin: 0 }}>
          Today's deals
        </h3>
        <span class="small-text muted">New stock in {formatDuration(msToMidnight(now))}</span>
      </div>

      <div class="prog-shop-grid" key={`${v.day}-${v.refreshes}-${spin}`}>
        {v.offers.map((o, i) => {
          const sold = v.bought.includes(o.key);
          const info = offerInfo(o);
          const price = priceOf(o);
          const rarity = info.heroId ? HERO_MAP[info.heroId]?.rarity : undefined;
          const afford = (s.currencies[price.kind] ?? 0) >= price.amount;
          return (
            <button
              key={o.key}
              class={`prog-offer ${sold ? 'sold' : ''} ${rarity ?? ''}`}
              style={{ '--oc': rarity ? RARITY_INFO[rarity].color : '#4fc3f7', animationDelay: `${i * 0.05}s` } as any}
              onClick={() => (sold ? toast('Sold out — new stock at midnight.') : setSel(o))}
            >
              {o.tag && !sold && <span class="prog-offer-tag">{o.tag}</span>}
              <div class="prog-offer-art">
                {info.heroId ? <CharacterArt id={info.heroId} mode="portrait" /> : <CurrencyIcon kind={info.icon!} size={46} />}
              </div>
              <div class="prog-offer-name">{info.title}</div>
              <div class="prog-offer-qty">{info.qty}</div>
              <div class={`prog-offer-price ${afford ? '' : 'short'}`}>
                <CurrencyIcon kind={price.kind} size={15} />
                {fmtShort(price.amount)}
              </div>
              {sold && <div class="prog-stamp sold">Sold out</div>}
            </button>
          );
        })}
      </div>

      <button class="btn blue block prog-refresh" disabled={v.refreshCost === null} onClick={refresh}>
        {v.refreshCost === null ? (
          'No refreshes left today'
        ) : (
          <>
            🔄 New stock
            <span class="cost">
              <CurrencyIcon kind="gems" size={16} />
              {v.refreshCost}
            </span>
            <span class="prog-refresh-left">({left} left)</span>
          </>
        )}
      </button>
      <div class="small-text muted center" style={{ marginTop: 8 }}>
        Each deal can be bought once per day. Stock is the same for every player and changes at midnight.
      </div>

      {sel && (
        <Modal center onClose={() => setSel(null)}>
          {(() => {
            const info = offerInfo(sel);
            const price = priceOf(sel);
            const h = info.heroId ? HERO_MAP[info.heroId] : undefined;
            const afford = (s.currencies[price.kind] ?? 0) >= price.amount;
            return (
              <div class="prog-buy">
                <div class="prog-buy-art" style={{ '--oc': h ? RARITY_INFO[h.rarity].color : '#4fc3f7' } as any}>
                  {h ? <CharacterArt id={h.id} mode="full" /> : <CurrencyIcon kind={info.icon!} size={84} />}
                </div>
                <h2 class="panel-title" style={{ justifyContent: 'center' }}>
                  {h ? `${h.name} pages` : info.title}
                </h2>
                {h && (
                  <div class="center small-text" style={{ marginBottom: 4 }}>
                    <RarityBadge r={h.rarity} /> {s.heroes[h.id] ? 'Pages go toward Star Ups.' : '10 pages unlock this hero!'}
                  </div>
                )}
                <RewardList r={sel.reward} />
                <div class="row">
                  <button class="btn dark" style={{ flex: 1 }} onClick={() => setSel(null)}>
                    Cancel
                  </button>
                  <button class="btn green" style={{ flex: 1.4 }} disabled={!afford} onClick={() => buy(sel)}>
                    Buy
                    <span class="cost">
                      <CurrencyIcon kind={price.kind} size={16} />
                      {fmt(price.amount)}
                    </span>
                  </button>
                </div>
                {!afford && <div class="small-text center prog-short">You need {fmt(price.amount - (s.currencies[price.kind] ?? 0))} more {CURRENCY_NAMES[price.kind]}.</div>}
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}
