// Clan Hall: browse/create/join clans, then the clan home (overview, members, raid,
// research, chat, shop). Importing this module registers the clan research team bonus.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CharacterArt } from '../../art/CharacterArt';
import { today, type SaveState } from '../../game/state';
import { useGame } from '../../game/store';
import { fmt } from '../../game/stats';
import { CurrencyIcon, Modal, toast, useNow } from '../../ui/components/common';
import type { ScreenDef, ScreenProps } from '../../ui/nav';
import { clan, createClan, joinClan, leaveClan, safePower, touchPresence } from './actions';
import { CLAN_COLORS, DESC_MAX, EMBLEMS, MAX_MEMBERS, NAME_MAX, NPC_CLANS } from './data';
import { ClanEmblem } from './Emblem';
import { attemptsLeft, canLeave, checkinAvailable, chestsClaimable, cleanText, clanKind, nameError, textLength, weekKey } from './logic';
import { emptyOnline, fetchOnlineClans, syncClanDoc, watchClan, type OnlineListing } from './online';
import type { ClanInfo } from './state';
import { ChatTab, MembersTab, OverviewTab, RaidTab, ResearchTab, ShopTab } from './tabs';
import { buildView, type OnlineData } from './view';
import './clan.css';

const UNLOCK_STAGE = 15;

function ClanScreen({ nav }: ScreenProps) {
  const s = useGame();
  const c = clan(s);
  const root = useRef<HTMLDivElement>(null);
  // Joining or leaving swaps the whole page: start the new view at the top.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const body = root.current?.closest('.page-body') as HTMLElement | null;
    if (body) body.scrollTop = 0;
  }, [c.clanId]);
  return (
    <div class="screen clan-screen" ref={root}>
      {c.clanId ? <ClanHome nav={nav} /> : <ClanBrowser />}
    </div>
  );
}

export const clanScreen: ScreenDef = {
  id: 'clan',
  title: 'Clan Hall',
  icon: '🏯',
  blurb: 'Join a clan, check in daily and take down the clan raid boss together.',
  unlockStage: UNLOCK_STAGE,
  component: ClanScreen,
  badge: (s: SaveState) => {
    if (s.stage < UNLOCK_STAGE || !s.clan?.clanId) return false;
    const c = clan(s);
    const day = today();
    return checkinAvailable(c, day) || attemptsLeft(c, day) > 0;
  },
};

/** Profile hero for "you": the squad lead, else any owned hero. */
export function myHero(s: SaveState): string {
  return s.squad.slots.find((x) => x && s.heroes[x]) ?? Object.keys(s.heroes)[0] ?? 'asta';
}

// ───────── browser (no clan yet) ─────────

interface Listing {
  id: string;
  info: Omit<ClanInfo, 'createdAt'>;
  level: number;
  members: number;
  power: number;
  live: boolean;
}

const NPC_LISTINGS: Listing[] = NPC_CLANS.map((d) => ({
  id: d.id,
  info: { name: d.name, emblem: d.emblem, color: d.color, desc: d.desc },
  level: d.level,
  members: d.members,
  power: d.power,
  live: false,
}));

function ClanBrowser() {
  const s = useGame();
  const [online, setOnline] = useState<OnlineListing[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchOnlineClans()
      .then((l) => alive && setOnline(l))
      .catch(() => alive && setOnline([]));
    return () => {
      alive = false;
    };
  }, []);

  const listings = useMemo(() => {
    const live: Listing[] = (online ?? []).map((o) => ({ id: o.id, info: o.info, level: o.level, members: o.members, power: o.power, live: true }));
    return [...live, ...NPC_LISTINGS];
  }, [online]);

  const join = async (l: Listing) => {
    if (busy) return;
    setBusy(l.id);
    const ok = await joinClan(l.id, l.live ? null : { ...l.info, createdAt: 0 });
    setBusy(null);
    if (ok) toast(`Welcome to ${l.info.name}!`);
  };

  return (
    <>
      <div class="panel clan-hero">
        <div class="clan-hero-art" aria-hidden="true">
          <div class="clan-hero-fig f1">
            <CharacterArt id="yuno" mode="full" />
          </div>
          <div class="clan-hero-fig f2">
            <CharacterArt id="asta" mode="full" />
          </div>
          <div class="clan-hero-fig f3">
            <CharacterArt id="noelle" mode="full" flip />
          </div>
        </div>
        <h2 class="clan-hero-title">Find your squad!</h2>
        <p class="clan-hero-text">Clans share a weekly raid boss, a crest shop and research that powers up your heroes.</p>
        <button class="btn green big block" onClick={() => setCreating(true)}>
          ✚ Create a Clan
        </button>
      </div>

      <div class="clan-section-head">
        <h3 class="panel-title">Recommended</h3>
        {online === null && <span class="chip clan-chip-load">Searching…</span>}
      </div>
      {s.clan?.leftDay === today() && <p class="small-text muted clan-note">You left a clan today. You can join a new one, but can't leave again until tomorrow.</p>}
      <div class="clan-list">
        {listings.map((l, i) => (
          <div class="clan-card" key={l.id} style={{ animationDelay: `${Math.min(i, 8) * 0.04}s` }}>
            <ClanEmblem emblem={l.info.emblem} color={l.info.color} size={54} />
            <div class="clan-card-main">
              <div class="clan-card-name">{l.info.name}</div>
              <div class="clan-card-chips">
                <span class="chip clan-lv">Lv {l.level}</span>
                <span class="chip">
                  👥 {l.members}/{MAX_MEMBERS}
                </span>
                {l.power > 0 && <span class="chip">⚡ {fmt(l.power)}</span>}
                {l.live ? <span class="chip clan-live">LIVE</span> : <span class="chip clan-npc">NPC</span>}
              </div>
              {l.info.desc && <div class="clan-card-desc">{l.info.desc}</div>}
            </div>
            <button class="btn green small clan-join" disabled={!!busy || l.members >= MAX_MEMBERS} onClick={() => join(l)}>
              {busy === l.id ? '…' : l.members >= MAX_MEMBERS ? 'Full' : 'Join'}
            </button>
          </div>
        ))}
      </div>
      {online !== null && !online.length && <p class="small-text muted clan-note">No player clans found online right now. NPC clans are always open, or start your own!</p>}
      {creating && <CreateSheet onClose={() => setCreating(false)} />}
    </>
  );
}

function CreateSheet({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [emblem, setEmblem] = useState<string>(EMBLEMS[0]);
  const [color, setColor] = useState(CLAN_COLORS[3]);
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const clean = cleanText(name, NAME_MAX);
  const err = nameError(name);

  const submit = async () => {
    setTouched(true);
    if (err || busy) return;
    setBusy(true);
    const info: ClanInfo = { name: clean, emblem, color, desc: cleanText(desc, DESC_MAX), createdAt: Date.now() };
    const res = await createClan(info);
    setBusy(false);
    if (!res) return toast("Couldn't create the clan.");
    toast(res === 'online' ? `${info.name} is open for recruits!` : `${info.name} founded! Recruits will find you soon.`);
    onClose();
  };

  return (
    <Modal onClose={busy ? () => {} : onClose}>
      <h2 class="panel-title">Create a Clan</h2>
      <div class="clan-create-preview">
        <ClanEmblem emblem={emblem} color={color} size={76} class="clan-pop" key={`${emblem}${color}`} />
        <div>
          <div class="clan-create-name">{clean || 'Your Clan Name'}</div>
          <div class="small-text muted">{cleanText(desc, DESC_MAX) || 'Open · anyone can join'}</div>
        </div>
      </div>

      <label class="clan-label" for="clan-name">
        Name <span class="muted">{textLength(clean)}/{NAME_MAX}</span>
      </label>
      <input
        id="clan-name"
        class={`clan-input ${touched && err ? 'bad' : ''}`}
        value={name}
        maxLength={NAME_MAX}
        placeholder="e.g. Grimoire Gang"
        autocomplete="off"
        onInput={(e) => setName((e.target as HTMLInputElement).value.slice(0, NAME_MAX))}
        onBlur={() => setTouched(true)}
      />
      {touched && err && <div class="clan-err">{err}</div>}

      <div class="clan-label">Emblem</div>
      <div class="clan-emblem-grid">
        {EMBLEMS.map((e) => (
          <button key={e} class={`clan-pick ${emblem === e ? 'on' : ''}`} onClick={() => setEmblem(e)} aria-label={`Emblem ${e}`} aria-pressed={emblem === e}>
            <ClanEmblem emblem={e} color={color} size={40} />
          </button>
        ))}
      </div>

      <div class="clan-label">Colour</div>
      <div class="clan-swatches">
        {CLAN_COLORS.map((col) => (
          <button
            key={col}
            class={`clan-swatch ${color === col ? 'on' : ''}`}
            style={{ background: col }}
            onClick={() => setColor(col)}
            aria-label={`Colour ${col}`}
            aria-pressed={color === col}
          />
        ))}
      </div>

      <label class="clan-label" for="clan-desc">
        Description <span class="muted">{textLength(cleanText(desc, DESC_MAX))}/{DESC_MAX}</span>
      </label>
      <textarea
        id="clan-desc"
        class="clan-input clan-textarea"
        value={desc}
        rows={2}
        maxLength={DESC_MAX}
        placeholder="What's your clan about?"
        onInput={(e) => setDesc((e.target as HTMLTextAreaElement).value.slice(0, DESC_MAX))}
      />

      <div class="clan-open-row">
        <span class="chip on">OPEN</span>
        <span class="small-text muted">Anyone can join. Online when the clan hall is reachable, otherwise offline with NPC recruits.</span>
      </div>
      <button class="btn green big block" disabled={busy || (touched && !!err)} onClick={submit}>
        {busy ? 'Founding…' : 'Found Clan!'}
      </button>
    </Modal>
  );
}

// ───────── clan home ─────────

type TabId = 'overview' | 'members' | 'raid' | 'research' | 'chat' | 'shop';
const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: 'overview', icon: '🏯', label: 'Hall' },
  { id: 'members', icon: '👥', label: 'Members' },
  { id: 'raid', icon: '👹', label: 'Raid' },
  { id: 'research', icon: '📚', label: 'Research' },
  { id: 'chat', icon: '💬', label: 'Chat' },
  { id: 'shop', icon: '🛒', label: 'Shop' },
];

let lastTab: TabId = 'overview';

function useOnlineClan(clanId: string | null, week: string): OnlineData | null {
  const online = clanKind(clanId) === 'online';
  const [data, setData] = useState<OnlineData | null>(online ? emptyOnline('loading') : null);
  useEffect(() => {
    if (!online || !clanId) {
      setData(null);
      return;
    }
    setData(emptyOnline('loading'));
    return watchClan(clanId, week, setData);
  }, [clanId, online, week]);
  return data;
}

function ClanHome({ nav }: { nav: ScreenProps['nav'] }) {
  const s = useGame();
  const c = clan(s);
  const [tab, setTabState] = useState<TabId>(lastTab);
  // Chat ticks faster so NPC replies pop in a few seconds after you post.
  const now = useNow(tab === 'chat' ? 2000 : 15000);
  const week = weekKey(now);
  const online = useOnlineClan(c.clanId, week);
  const setTab = (t: TabId) => {
    lastTab = t;
    setTabState(t);
  };
  const power = safePower();
  const hero = myHero(s);
  // Cheap to rebuild; the save is mutated in place so memo deps would miss changes.
  const view = buildView(c, { power, hero }, now, online);

  useEffect(() => {
    touchPresence();
  }, [c.clanId]);

  // A leader whose clan doc went missing (e.g. a failed first write) re-registers it once.
  const healed = useRef(false);
  useEffect(() => {
    if (view?.amLeader && view.kind === 'online' && online?.status === 'ready' && online.exists === false && c.info && !healed.current) {
      healed.current = true;
      void syncClanDoc(c.info);
    }
  }, [online?.status, online?.exists, view?.amLeader]);

  // Keep the offline cache of an online clan's info fresh (only when it really changed).
  useEffect(() => {
    const info = online?.info;
    if (!info || !c.clanId) return;
    const cur = c.info;
    if (!cur || cur.name !== info.name || cur.emblem !== info.emblem || cur.color !== info.color || cur.desc !== info.desc) {
      c.info = info;
    }
  }, [online?.info]);

  if (!view) return null;
  const day = today();

  if (view.disbanded) {
    return (
      <div class="panel center clan-disbanded">
        <ClanEmblem emblem={view.info.emblem} color={view.info.color} size={72} />
        <h2 class="panel-title" style={{ justifyContent: 'center' }}>
          Clan disbanded
        </h2>
        <p class="muted">{view.info.name} was disbanded by its leader. Time to find a new squad!</p>
        <button class="btn green block" onClick={() => leaveClan(true)}>
          Find a new clan
        </button>
      </div>
    );
  }

  const left = attemptsLeft(c, day);
  const chests = chestsClaimable(c, view.id, view.raid.week, view.raid.status.kills);
  const dots: Partial<Record<TabId, boolean>> = {
    overview: checkinAvailable(c, day),
    raid: (left > 0 && !view.raid.status.cleared) || chests > 0,
  };

  return (
    <>
      <div class="panel clan-head" style={{ '--clan-col': view.info.color } as any}>
        <ClanEmblem emblem={view.info.emblem} color={view.info.color} size={68} class="clan-head-emblem" />
        <div class="clan-head-main">
          <div class="clan-head-name">{view.info.name}</div>
          <div class="clan-head-row">
            <span class="clan-lvl-badge">Lv {view.lvl.level}</span>
            <div class="bar clan-xp" title="Clan XP">
              <i style={{ width: `${view.lvl.max ? 100 : Math.min(100, (view.lvl.into / Math.max(1, view.lvl.need)) * 100)}%` }} />
            </div>
          </div>
          <div class="clan-head-meta">
            <span>{view.lvl.max ? 'MAX LEVEL' : `${fmt(view.lvl.into)}/${fmt(view.lvl.need)} XP`}</span>
            <span>
              👥 {view.members.length}/{MAX_MEMBERS}
            </span>
            <span class="clan-crests">
              <CurrencyIcon kind="crests" size={16} />
              {fmt(s.currencies.crests)}
            </span>
          </div>
        </div>
        {view.net && <span class={`chip clan-net ${view.net}`}>{view.net === 'live' ? 'LIVE' : view.net === 'loading' ? '…' : 'OFFLINE'}</span>}
      </div>
      {view.info.desc && <p class="clan-desc">“{view.info.desc}”</p>}

      <div class="clan-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} class={`clan-tab ${tab === t.id ? 'on' : ''}`} onClick={() => setTab(t.id)}>
            <span class="clan-tab-ico">{t.icon}</span>
            <span class="clan-tab-lbl">{t.label}</span>
            {dots[t.id] && <span class="badge-dot clan-tab-dot" />}
          </button>
        ))}
      </div>

      <div class="clan-tab-body" key={tab}>
        {tab === 'overview' && <OverviewTab view={view} now={now} canLeaveToday={canLeave(c, day)} />}
        {tab === 'members' && <MembersTab view={view} now={now} />}
        {tab === 'raid' && <RaidTab view={view} nav={nav} now={now} />}
        {tab === 'research' && <ResearchTab view={view} />}
        {tab === 'chat' && <ChatTab view={view} />}
        {tab === 'shop' && <ShopTab now={now} />}
      </div>
    </>
  );
}
