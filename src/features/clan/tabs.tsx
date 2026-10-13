// Clan home tabs. Other players' text is rendered as JSX text only.
import { useEffect, useRef, useState } from 'preact/hooks';
import { CharacterArt } from '../../art/CharacterArt';
import { getHero } from '../../data/heroes';
import { today, type Reward } from '../../game/state';
import { canAfford, getState, useGame } from '../../game/store';
import { RARITY_INFO, fmt } from '../../game/stats';
import { CurrencyIcon, Modal, RewardList, formatDuration, toast } from '../../ui/components/common';
import type { Nav } from '../../ui/nav';
import { buyShopItem, checkIn, claimKillChests, clan, donate, leaveClan, sendChat, startRaid, upgradeResearch } from './actions';
import { CHAT_MAX, CHECKIN_XP, DONATIONS, MAX_MEMBERS, RAID_ATTEMPTS_PER_DAY, RAID_MAX_LEVEL, RESEARCH } from './data';
import { ClanEmblem } from './Emblem';
import {
  addRewards,
  attemptsLeft,
  canSendChat,
  checkinAvailable,
  checkinReward,
  chestsClaimable,
  cleanText,
  donatedToday,
  killChest,
  msUntilTomorrow,
  msUntilWeekEnd,
  researchCap,
  researchCost,
  researchLevel,
  shopItems,
  shopLeft,
  textLength,
  type ShopItem,
} from './logic';
import type { ClanView } from './view';

export function ago(t: number, now: number): string {
  if (!(t > 0)) return 'a while ago';
  const d = Math.max(0, now - t);
  if (d < 120000) return 'online now';
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`;
  return `${Math.floor(d / 86400000)}d ago`;
}

function heroOk(id: string): boolean {
  try {
    getHero(id);
    return true;
  } catch {
    return false;
  }
}

export function Avatar({ hero, size = 40, you }: { hero: string; size?: number; you?: boolean }) {
  return (
    <span class={`clan-avatar ${you ? 'you' : ''}`} style={{ width: size, height: size }}>
      <CharacterArt id={heroOk(hero) ? hero : 'asta'} mode="portrait" />
    </span>
  );
}

// ───────── overview ─────────

export function OverviewTab({ view, now, canLeaveToday }: { view: ClanView; now: number; canLeaveToday: boolean }) {
  const s = useGame();
  const c = clan(s);
  const day = today();
  const canCheck = checkinAvailable(c, day);
  const reward = checkinReward(view.lvl.level);
  const donated = donatedToday(c, day);
  const [confirm, setConfirm] = useState(false);
  const [got, setGot] = useState(false);

  const doCheckIn = () => {
    const r = checkIn(view.lvl.level);
    if (r) {
      setGot(true);
      toast(`Checked in! +${CHECKIN_XP} clan XP`);
    }
  };

  const doDonate = (i: number) => {
    const t = DONATIONS[i];
    if (!canAfford({ yul: t.yul })) return toast(`Not enough Yul — you need ${fmt(t.yul)}.`);
    if (donate(i)) toast(`Thanks for the ${t.name}! +${t.crests} crests`);
  };

  return (
    <>
      <div class={`panel clan-checkin ${canCheck ? 'ready' : ''}`}>
        <div class="spread">
          <div>
            <h3 class="panel-title">Daily Check-in</h3>
            <div class="small-text muted">+{CHECKIN_XP} clan XP for the clan, goodies for you.</div>
          </div>
          <div class="clan-checkin-stamp" aria-hidden="true">
            {canCheck ? '📜' : '✅'}
          </div>
        </div>
        {canCheck ? (
          <>
            <RewardList r={reward} />
            <button class="btn green big block" onClick={doCheckIn}>
              Check In!
            </button>
          </>
        ) : (
          <div class={`clan-done ${got ? 'clan-pop' : ''}`}>Checked in today · next in {formatDuration(msUntilTomorrow(now))}</div>
        )}
      </div>

      <div class="panel">
        <h3 class="panel-title">Donate</h3>
        <div class="small-text muted clan-sub">Spend Yul to grow the clan. Each tier once a day.</div>
        <div class="clan-donations">
          {DONATIONS.map((t, i) => {
            const done = donated.includes(i);
            return (
              <div class={`clan-donation tier${i} ${done ? 'done' : ''}`} key={t.name}>
                <div class="clan-donation-ico" aria-hidden="true">
                  {['👛', '🧰', '🏦'][i]}
                </div>
                <div class="clan-donation-name">{t.name}</div>
                <div class="clan-donation-gain">
                  <span>
                    <CurrencyIcon kind="crests" size={14} />+{t.crests}
                  </span>
                  <span>+{t.xp} XP</span>
                </div>
                <button class="btn small block" disabled={done} onClick={() => doDonate(i)}>
                  {done ? (
                    'Done ✓'
                  ) : (
                    <span class="cost">
                      <CurrencyIcon kind="yul" size={16} />
                      {fmt(t.yul)}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div class="panel">
        <h3 class="panel-title">Your Standing</h3>
        <div class="clan-stats">
          <div class="clan-stat">
            <b>{fmt(c.contribution)}</b>
            <span>Contribution</span>
          </div>
          <div class="clan-stat">
            <b>{fmt(view.raid.rows.find((r) => r.isYou)?.damage ?? 0)}</b>
            <span>Raid dmg (week)</span>
          </div>
          <div class="clan-stat">
            <b>{RESEARCH.reduce((a, n) => a + researchLevel(c.research, n.id), 0)}</b>
            <span>Research lvls</span>
          </div>
        </div>
        <div class="small-text muted clan-sub">
          {view.amLeader ? 'You lead this clan.' : 'Member'} · joined {c.joinedAt ? ago(c.joinedAt, now).replace('online now', 'just now') : 'recently'}
        </div>
      </div>

      <button class="btn dark small clan-leave" onClick={() => setConfirm(true)}>
        🚪 Leave clan
      </button>

      {confirm && (
        <Modal center onClose={() => setConfirm(false)}>
          <h3 class="panel-title">Leave {view.info.name}?</h3>
          {!canLeaveToday ? (
            <p class="muted">You already left a clan today. You can leave again tomorrow.</p>
          ) : (
            <>
              <p class="clan-confirm-text">
                Your contribution resets to zero. Research levels stay with you.
                {view.amLeader && view.kind === 'online' && <b> You're the leader — leaving disbands the clan for everyone.</b>}
                {view.kind === 'local' && <b> Your offline clan and its recruits will be gone.</b>}
              </p>
              <p class="small-text muted">You can only leave a clan once per day.</p>
            </>
          )}
          <div class="row clan-confirm-btns">
            <button class="btn dark" onClick={() => setConfirm(false)}>
              Stay
            </button>
            <button
              class="btn red"
              disabled={!canLeaveToday}
              onClick={() => {
                setConfirm(false);
                if (leaveClan()) toast(`You left ${view.info.name}.`);
              }}
            >
              Leave
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

// ───────── members ─────────

export function MembersTab({ view, now }: { view: ClanView; now: number }) {
  return (
    <div class="panel">
      <div class="spread">
        <h3 class="panel-title">Members</h3>
        <span class="chip">
          {view.members.length}/{MAX_MEMBERS}
        </span>
      </div>
      {view.kind !== 'online' && <div class="small-text muted clan-sub">{view.kind === 'npc' ? 'NPC clan — your clanmates are friendly bots.' : 'Offline clan — NPC recruits join you over time.'}</div>}
      {view.net === 'offline' && <div class="small-text muted clan-sub">Offline — showing only you until the clan hall is reachable.</div>}
      <div class="clan-members">
        {view.members.map((m) => (
          <div class={`clan-member ${m.isYou ? 'you' : ''}`} key={m.id}>
            <Avatar hero={m.hero} you={m.isYou} />
            <div class="clan-member-main">
              <div class="clan-member-name">
                <span class="clan-ellipsis">{m.name}</span>
                {m.leader ? <span class="chip clan-role leader">Leader</span> : <span class="chip clan-role">Member</span>}
              </div>
              <div class="clan-member-sub">
                ⚡ {fmt(m.power)} · <span class={now - m.lastActive < 120000 ? 'clan-online' : ''}>{ago(m.lastActive, now)}</span>
              </div>
            </div>
            <div class="clan-member-contrib">
              <b>{fmt(m.contribution)}</b>
              <span>contrib.</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────── raid ─────────

export function RaidTab({ view, nav, now }: { view: ClanView; nav: Nav; now: number }) {
  const s = useGame();
  const c = clan(s);
  const day = today();
  const left = attemptsLeft(c, day);
  const { boss, status, rows, week } = view.raid;
  const chests = chestsClaimable(c, view.id, week, status.kills);
  const hpPct = status.maxHp ? (status.hp / status.maxHp) * 100 : 0;
  const top = Math.max(1, ...rows.map((r) => r.damage));
  const mine = c.raid.week === week && c.raid.clanId === view.id ? c.raid : null;
  const [busy, setBusy] = useState(false);

  const attack = () => {
    if (busy) return;
    setBusy(true);
    const spec = startRaid({ clanId: view.id, clanLevel: view.lvl.level, boss, bossLevel: status.bossLevel, hp: status.hp, maxHp: status.maxHp });
    if (spec) nav.battle(spec);
    setTimeout(() => setBusy(false), 600);
  };

  const claim = () => {
    const r = claimKillChests(view.id, status.kills, view.lvl.level);
    if (r) toast(`Kill chest${chests > 1 ? 's' : ''} opened!`);
  };

  let chestPreview: Reward = {};
  for (let l = (mine?.claimed ?? 0) + 1; l <= Math.min(RAID_MAX_LEVEL, status.kills); l++) chestPreview = addRewards(chestPreview, killChest(l, view.lvl.level));

  return (
    <>
      <div class="panel clan-boss" style={{ '--sky1': boss.sky[0], '--sky2': boss.sky[1], '--ground': boss.ground } as any}>
        <div class="clan-boss-art" aria-hidden="true">
          <CharacterArt id={heroOk(boss.heroId) ? boss.heroId : 'lucifero'} mode="full" flip />
        </div>
        <div class="clan-boss-info">
          <span class="chip clan-boss-week">THIS WEEK</span>
          <h3 class="clan-boss-name">{boss.name}</h3>
          <div class="clan-boss-lv">
            Boss Lv {status.bossLevel}
            {status.kills > 0 && <span class="clan-kills">☠ ×{status.kills}</span>}
          </div>
          <p class="clan-boss-blurb">{boss.blurb}</p>
        </div>
        <div class="clan-boss-hp">
          <div class="clan-hpbar">
            <i style={{ width: `${Math.max(0, Math.min(100, hpPct))}%` }} />
            <span>{status.cleared ? 'DEFEATED' : `${fmt(status.hp)} / ${fmt(status.maxHp)}`}</span>
          </div>
          <div class="small-text clan-boss-reset">Resets in {formatDuration(msUntilWeekEnd(now))}</div>
        </div>
      </div>

      {chests > 0 && (
        <div class="panel clan-chest">
          <div class="clan-chest-ico" aria-hidden="true">
            🎁
          </div>
          <div class="clan-chest-main">
            <h3 class="panel-title">Kill chest{chests > 1 ? `s ×${chests}` : ''}!</h3>
            <RewardList r={chestPreview} />
          </div>
          <button class="btn green" onClick={claim}>
            Claim
          </button>
        </div>
      )}
      {!chests && status.kills > (mine?.claimed ?? 0) && !mine?.hits && (
        <p class="small-text muted clan-note">Hit the boss once this week to claim its kill chests.</p>
      )}

      <div class="panel clan-attack">
        <div class="spread">
          <div>
            <div class="clan-attempts">
              {Array.from({ length: RAID_ATTEMPTS_PER_DAY }, (_, i) => (
                <span key={i} class={`clan-pip ${i < left ? 'on' : ''}`} />
              ))}
              <span>
                {left}/{RAID_ATTEMPTS_PER_DAY} attempts today
              </span>
            </div>
            <div class="small-text muted">45s per fight. Your damage hits the shared boss.</div>
          </div>
        </div>
        {status.cleared ? (
          <div class="clan-done">Every boss level is down this week. Legendary work!</div>
        ) : left > 0 ? (
          <button class="btn red big block clan-attack-btn" disabled={busy || view.net === 'loading'} onClick={attack}>
            {view.net === 'loading' ? 'Syncing boss HP…' : '⚔️ ATTACK!'}
          </button>
        ) : (
          <div class="clan-done">Out of attempts · more in {formatDuration(msUntilTomorrow(now))}</div>
        )}
        <div class="clan-mystats">
          <span>
            Week <b>{fmt(mine?.damage ?? 0)}</b>
          </span>
          <span>
            Hits <b>{mine?.hits ?? 0}</b>
          </span>
          <span>
            Best <b>{fmt(c.raid.best)}</b>
          </span>
        </div>
      </div>

      <div class="panel">
        <h3 class="panel-title">Damage Board</h3>
        <div class="clan-board">
          {rows.slice(0, 30).map((r, i) => (
            <div class={`clan-board-row ${r.isYou ? 'you' : ''}`} key={r.id}>
              <span class={`clan-rank r${i + 1}`}>{i + 1}</span>
              <Avatar hero={r.hero} size={30} you={r.isYou} />
              <div class="clan-board-main">
                <div class="clan-board-name">
                  <span class="clan-ellipsis">{r.name}</span>
                  <b>{fmt(r.damage)}</b>
                </div>
                <div class="clan-board-bar">
                  <i style={{ width: `${(r.damage / top) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ───────── research ─────────

const STAT_LABEL: Record<string, string> = { atk: 'ATK', hp: 'HP', def: 'DEF', energy: 'Energy', crit: 'Crit' };

export function ResearchTab({ view }: { view: ClanView }) {
  const s = useGame();
  const c = clan(s);
  const [flash, setFlash] = useState<string | null>(null);
  const bonuses = RESEARCH.map((n) => ({ n, lvl: researchLevel(c.research, n.id) })).filter((x) => x.lvl > 0);

  const up = (id: string) => {
    const node = RESEARCH.find((n) => n.id === id)!;
    const cost = researchCost(node, researchLevel(c.research, id));
    if (!canAfford({ crests: cost })) return toast(`Not enough Clan Crests (${fmt(cost)} needed).`);
    if (upgradeResearch(id, view.lvl.level)) {
      setFlash(id);
      setTimeout(() => setFlash((f) => (f === id ? null : f)), 700);
    }
  };

  return (
    <>
      <div class="panel clan-research-sum">
        <div class="spread">
          <h3 class="panel-title">Research</h3>
          <span class="chip clan-crest-chip">
            <CurrencyIcon kind="crests" size={16} />
            {fmt(s.currencies.crests)}
          </span>
        </div>
        <div class="small-text muted clan-sub">Personal upgrades for every hero you field. They stay with you if you leave. Level cap = clan level + 2.</div>
        <div class="chips clan-bonus-chips">
          {bonuses.length ? (
            bonuses.map(({ n, lvl }) => (
              <span class="chip on" key={n.id}>
                {n.stat ? `+${Math.round(lvl * n.per * 100)}% ${STAT_LABEL[n.stat] ?? n.stat}` : `+${Math.round(lvl * n.per * 100)}% AFK Yul`}
              </span>
            ))
          ) : (
            <span class="small-text muted">No research yet — start with Black Bulls Training!</span>
          )}
        </div>
      </div>
      <div class="clan-research">
        {RESEARCH.map((n) => {
          const lvl = researchLevel(c.research, n.id);
          const cap = researchCap(n, view.lvl.level);
          const locked = cap === 0;
          const maxed = lvl >= n.max;
          const capped = !maxed && lvl >= cap;
          const cost = researchCost(n, lvl);
          return (
            <div class={`clan-node ${locked ? 'locked' : ''} ${flash === n.id ? 'flash' : ''}`} key={n.id}>
              <div class="clan-node-ico" aria-hidden="true">
                {n.icon}
              </div>
              <div class="clan-node-main">
                <div class="clan-node-name">{n.name}</div>
                <div class="small-text muted">{n.desc}</div>
                <div class="clan-pips" aria-label={`Level ${lvl} of ${n.max}`}>
                  {Array.from({ length: n.max }, (_, i) => (
                    <i key={i} class={i < lvl ? 'on' : i < cap ? 'open' : ''} />
                  ))}
                </div>
              </div>
              <div class="clan-node-act">
                {locked ? (
                  <span class="chip">🔒 Clan Lv {n.unlock}</span>
                ) : maxed ? (
                  <span class="chip on">MAX</span>
                ) : capped ? (
                  <span class="chip clan-cap">⬆ Clan Lv {lvl - 1}</span>
                ) : (
                  <button class="btn purple small" onClick={() => up(n.id)} disabled={!canAfford({ crests: cost })}>
                    <span class="cost">
                      <CurrencyIcon kind="crests" size={16} />
                      {fmt(cost)}
                    </span>
                  </button>
                )}
                <span class="clan-node-lv">
                  Lv {lvl}/{n.max}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ───────── chat ─────────

let lastSent = 0;

export function ChatTab({ view }: { view: ClanView }) {
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const lines = view.chat;
  const lastKey = lines.length ? lines[lines.length - 1].key : '';

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastKey, lines.length]);

  const send = () => {
    const clean = cleanText(text, CHAT_MAX);
    if (!clean) return;
    const now = Date.now();
    if (!canSendChat(lastSent, now)) return toast('Easy there! One message every 3 seconds.');
    if (sendChat(clean, now)) {
      lastSent = now;
      setText('');
    }
  };

  const len = textLength(text);
  return (
    <div class="panel clan-chat">
      {view.kind !== 'online' && <div class="small-text muted clan-sub">Clanmates here are friendly bots. Join or create an online clan to chat with real players.</div>}
      {view.net === 'offline' && <div class="small-text muted clan-sub">Offline — your messages sync when the clan hall is reachable.</div>}
      <div class="clan-chat-list" ref={listRef} aria-live="polite">
        {lines.length === 0 && <div class="empty-hint">No messages yet. Say hi! 👋</div>}
        {lines.map((l) => (
          <div class={`clan-msg ${l.isYou ? 'you' : ''}`} key={l.key}>
            {!l.isYou && <Avatar hero={l.hero} size={30} />}
            <div class="clan-bubble">
              <div class="clan-msg-head">
                <span class="clan-ellipsis">{l.name}</span>
                <span class="clan-msg-time">{timeOf(l.t)}</span>
              </div>
              <div class="clan-msg-text">{l.text}</div>
            </div>
          </div>
        ))}
      </div>
      <form
        class="clan-chat-form"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          class="clan-input"
          value={text}
          maxLength={CHAT_MAX + 10}
          placeholder="Message your clan…"
          autocomplete="off"
          enterkeyhint="send"
          onInput={(e) => setText((e.target as HTMLInputElement).value.slice(0, CHAT_MAX + 10))}
          aria-label="Chat message"
        />
        <button class="btn green small clan-send" type="submit" disabled={!cleanText(text, CHAT_MAX)}>
          Send
        </button>
      </form>
      <div class={`small-text clan-count ${len > CHAT_MAX ? 'bad' : 'muted'}`}>
        {Math.min(len, 999)}/{CHAT_MAX}
      </div>
    </div>
  );
}

function timeOf(t: number): string {
  const d = new Date(t);
  const hm = `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  if (today(t) === today()) return hm;
  if (today(t) === today(Date.now() - 86400000)) return `Yday ${hm}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${hm}`;
}

// ───────── shop ─────────

export function ShopTab({ now }: { now: number }) {
  const s = useGame();
  const c = clan(s);
  const day = today();
  const items = shopItems(day);
  const [bought, setBought] = useState<string | null>(null);

  const buy = (it: ShopItem) => {
    if (!canAfford({ crests: it.cost })) return toast(`Not enough Clan Crests (${fmt(it.cost)} needed).`);
    if (buyShopItem(it)) {
      setBought(it.id);
      setTimeout(() => setBought((b) => (b === it.id ? null : b)), 700);
      toast(`Bought ${it.label}!`);
    }
  };

  return (
    <>
      <div class="panel clan-shop-head">
        <div class="spread">
          <h3 class="panel-title">Crest Shop</h3>
          <span class="chip clan-crest-chip">
            <CurrencyIcon kind="crests" size={16} />
            {fmt(s.currencies.crests)}
          </span>
        </div>
        <div class="small-text muted">Hero pages rotate daily · refresh in {formatDuration(msUntilTomorrow(now))}</div>
      </div>
      <div class="clan-shop">
        {items.map((it) => {
          const left = shopLeft(c, day, it);
          const h = it.heroId && heroOk(it.heroId) ? getHero(it.heroId) : null;
          const owned = h ? !!getState().heroes[h.id] : false;
          return (
            <div class={`clan-item ${left <= 0 ? 'sold' : ''} ${bought === it.id ? 'clan-pop' : ''}`} key={it.id} style={h ? ({ '--rc': RARITY_INFO[h.rarity].color } as any) : undefined}>
              {it.tag && <span class={`rarity ${h?.rarity ?? ''} clan-item-tag`}>{it.tag}</span>}
              <div class={`clan-item-art ${h ? 'hero' : ''}`}>
                {h ? <CharacterArt id={h.id} mode="portrait" /> : <CurrencyIcon kind={it.reward.tickets ? 'tickets' : it.reward.essence ? 'essence' : 'yul'} size={44} />}
              </div>
              <div class="clan-item-name">{it.label}</div>
              <div class="small-text muted clan-item-amt">
                {h ? `×${it.reward.shards?.[h.id] ?? 0} pages${owned ? '' : ' · unlock at 10'}` : `×${fmt(it.reward.tickets ?? it.reward.essence ?? it.reward.yul ?? 0)}`}
              </div>
              <button class="btn small block" disabled={left <= 0 || !canAfford({ crests: it.cost })} onClick={() => buy(it)}>
                {left <= 0 ? (
                  'Sold out'
                ) : (
                  <span class="cost">
                    <CurrencyIcon kind="crests" size={16} />
                    {fmt(it.cost)}
                  </span>
                )}
              </button>
              <div class="clan-item-left">
                {left}/{it.limit} left today
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export { ClanEmblem };
