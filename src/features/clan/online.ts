// Online clans over the artifact db. Everything here is best-effort: any failure resolves
// to null/empty and the UI falls back to NPC/offline play. Only opaque ids are stored.
//
// Docs (each written only by its owner):
//   clans/<leaderUid>     {v:1, name, emblem, color, desc, createdAt}
//   clanMembers/<uid>     {v:1, clanId, joinedAt, power, contribution, lastActive}
//   clanRaids/<uid>       {v:1, clanId, week, damage}
//   clanChat/<uid>        {v:1, clanId, msgs:[{t, text}]}

import { getSocial, playerNames, type Social } from '../../game/social';
import { MAX_MEMBERS } from './data';
import {
  clanXpFromContributions,
  levelFromXp,
  parseChatDoc,
  parseClanDoc,
  parseMemberDoc,
  parseRaidDoc,
  plausibleContribution,
  validId,
  type MemberDoc,
} from './logic';
import type { ClanChatMsg, ClanInfo } from './state';
import type { OnlineData } from './view';

const TIMEOUT_MS = 6000;

function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** The online services, or null (offline, signed out, not granted, slow). */
export async function social(): Promise<Social | null> {
  try {
    const s = await withTimeout(getSocial(), 8000);
    return s && validId(s.uid) ? s : null;
  } catch {
    return null;
  }
}

// ───────── writes: one at a time per doc, latest body wins ─────────

const writing = new Map<string, Promise<void>>();
const queued = new Map<string, Record<string, unknown> | null>();
/** Last body this session wrote successfully per path, so unchanged bodies are not re-sent. */
const written = new Map<string, string>();

async function flushDoc(s: Social, path: string): Promise<void> {
  while (queued.has(path)) {
    const body = queued.get(path)!;
    queued.delete(path);
    const key = JSON.stringify(body);
    if (written.get(path) === key) continue;
    try {
      const ref = s.db.doc(path);
      await withTimeout(body === null ? ref.delete() : ref.set(body));
      written.set(path, key);
    } catch {
      written.delete(path); /* best-effort: the next real change rewrites it */
    }
  }
  writing.delete(path);
}

/** Queue a full write (or delete with null) of one of this player's own docs. */
export async function writeDoc(collection: string, body: Record<string, unknown> | null, force = false): Promise<boolean> {
  const s = await social();
  if (!s) return false;
  const path = `${collection}/${s.uid}`;
  if (force) written.delete(path);
  queued.set(path, body);
  if (!writing.has(path)) writing.set(path, flushDoc(s, path));
  await writing.get(path);
  return true;
}

/** A single write that reports failure (used where the UI must know, e.g. creating a clan). */
async function strictSet(path: string, s: Social, body: Record<string, unknown>): Promise<boolean> {
  try {
    await withTimeout(s.db.doc(path).set(body));
    written.set(path, JSON.stringify(body));
    return true;
  } catch {
    written.delete(path);
    return false;
  }
}

// ───────── clan browser ─────────

export interface OnlineListing {
  id: string;
  info: ClanInfo;
  members: number;
  level: number;
  power: number;
}

/** Online clans with member counts and levels (empty when offline). */
export async function fetchOnlineClans(): Promise<OnlineListing[]> {
  const s = await social();
  if (!s) return [];
  try {
    const [clans, members] = await withTimeout(
      Promise.all([s.db.collection('clans').limit(60).get(), s.db.collection('clanMembers').limit(1000).get()]),
    );
    const byClan: Record<string, MemberDoc[]> = {};
    for (const d of members?.docs ?? []) {
      if (!validId(d?.id)) continue;
      const m = parseMemberDoc(d.data?.());
      if (m) (byClan[m.clanId] ??= []).push(m);
    }
    const out: OnlineListing[] = [];
    const now = Date.now();
    for (const d of clans?.docs ?? []) {
      if (!validId(d?.id)) continue;
      const info = parseClanDoc(d.data?.());
      if (!info) continue;
      const ms = byClan[d.id] ?? [];
      // No members at all = an abandoned clan (an active leader always has a member doc).
      if (!ms.length || d.id === s.uid) continue;
      out.push({
        id: d.id,
        info,
        members: ms.length,
        level: levelFromXp(clanXpFromContributions(ms.map((m) => plausibleContribution(m.contribution, m.joinedAt, now, info.createdAt)))).level,
        power: ms.length ? Math.round(ms.reduce((a, m) => a + m.power, 0) / ms.length) : 0,
      });
    }
    return out.sort((a, b) => b.level - a.level || b.members - a.members).slice(0, 20);
  } catch {
    return [];
  }
}

export type CreateResult = { ok: true; id: string } | { ok: false; reason: 'offline' | 'failed' };

/** Register a new online clan led by this player. */
export async function createOnlineClan(info: ClanInfo, member: { power: number; contribution: number; now: number }): Promise<CreateResult> {
  const s = await social();
  if (!s) return { ok: false, reason: 'offline' };
  const ok = await strictSet(`clans/${s.uid}`, s, { v: 1, name: info.name, emblem: info.emblem, color: info.color, desc: info.desc, createdAt: info.createdAt });
  if (!ok) return { ok: false, reason: 'failed' };
  await strictSet(`clanMembers/${s.uid}`, s, memberBody(s.uid, member.power, member.contribution, member.now, member.now));
  return { ok: true, id: s.uid };
}

export type JoinResult = { ok: true; info: ClanInfo } | { ok: false; reason: 'offline' | 'missing' | 'full' | 'failed' };

/** Join an online clan: re-check it exists and has room, then write our member doc. */
export async function joinOnlineClan(clanId: string, member: { power: number; now: number }): Promise<JoinResult> {
  const s = await social();
  if (!s) return { ok: false, reason: 'offline' };
  if (!validId(clanId)) return { ok: false, reason: 'missing' };
  try {
    const [clanSnap, memSnap] = await withTimeout(
      Promise.all([s.db.doc(`clans/${clanId}`).get(), s.db.collection('clanMembers').where('clanId', '==', clanId).limit(MAX_MEMBERS + 5).get()]),
    );
    const info = clanSnap?.exists ? parseClanDoc(clanSnap.data?.()) : null;
    if (!info) return { ok: false, reason: 'missing' };
    const count = (memSnap?.docs ?? []).filter((d: any) => d?.id !== s.uid && parseMemberDoc(d.data?.(), clanId)).length;
    if (count >= MAX_MEMBERS) return { ok: false, reason: 'full' };
    const ok = await strictSet(`clanMembers/${s.uid}`, s, memberBody(clanId, member.power, 0, member.now, member.now));
    return ok ? { ok: true, info } : { ok: false, reason: 'failed' };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/** Leave: drop our member + chat docs; a leader also disbands the clan doc. */
export async function leaveOnlineClan(clanId: string): Promise<void> {
  const s = await social();
  if (!s) return;
  const jobs = [writeDoc('clanMembers', null), writeDoc('clanChat', null)];
  if (clanId === s.uid) jobs.push(writeDoc('clans', null));
  await Promise.all(jobs);
}

export function memberBody(clanId: string, power: number, contribution: number, joinedAt: number, now: number) {
  return { v: 1, clanId, joinedAt, power: Math.round(power), contribution: Math.round(contribution), lastActive: now };
}

export function syncMember(clanId: string, power: number, contribution: number, joinedAt: number, now = Date.now()) {
  return writeDoc('clanMembers', memberBody(clanId, power, contribution, joinedAt, now));
}

export function syncRaid(clanId: string, week: string, damage: number) {
  return writeDoc('clanRaids', { v: 1, clanId, week, damage: Math.round(damage) });
}

export function syncChat(clanId: string, msgs: ClanChatMsg[]) {
  return writeDoc('clanChat', { v: 1, clanId, msgs: msgs.map((m) => ({ t: m.t, text: m.text })) });
}

/** Re-register the leader's clan doc (forced: it is only called when the doc is missing). */
export function syncClanDoc(info: ClanInfo) {
  return writeDoc('clans', { v: 1, name: info.name, emblem: info.emblem, color: info.color, desc: info.desc, createdAt: info.createdAt }, true);
}

// ───────── live clan data ─────────

export function emptyOnline(status: OnlineData['status']): OnlineData {
  return { status, uid: null, info: null, exists: null, members: {}, raids: {}, chats: {}, names: {} };
}

/**
 * Subscribe to everything the clan home needs. Calls `update` with fresh OnlineData on every
 * change; returns an unsubscribe. Subscribes once — call from a useEffect keyed on clanId/week.
 */
export function watchClan(clanId: string, week: string, update: (d: OnlineData) => void): () => void {
  let dead = false;
  const unsubs: (() => void)[] = [];
  let data = emptyOnline('loading');
  const push = (patch: Partial<OnlineData>) => {
    if (dead) return;
    data = { ...data, ...patch };
    update(data);
  };
  let nameKey = '';
  const refreshNames = (ids: string[]) => {
    const key = [...ids].sort().join(',');
    if (key === nameKey) return;
    nameKey = key;
    playerNames(ids)
      .then((names) => {
        const clean: Record<string, string> = {};
        for (const id of ids) if (typeof names[id] === 'string') clean[id] = names[id].slice(0, 40);
        push({ names: clean });
      })
      .catch(() => {});
  };

  (async () => {
    const s = await social();
    if (dead) return;
    if (!s || !validId(clanId)) return push({ status: 'off' });
    data = { ...data, uid: s.uid };
    // Only the clan doc decides online vs offline; a failing side list just stays empty.
    const fail = () => push({ status: 'off' });
    const ignore = () => {};
    const sub = (fn: () => () => void, onErr: () => void) => {
      try {
        unsubs.push(fn());
      } catch {
        onErr();
      }
    };
    let gotClan = false;
    sub(() =>
      s.db.doc(`clans/${clanId}`).onSnapshot(
        (snap: any) => {
          const info = snap?.exists ? parseClanDoc(snap.data?.()) : null;
          // A cached "missing" is not definitive; wait for the server's answer.
          if (!snap?.exists && snap?.metadata?.fromCache) return;
          gotClan = true;
          push({ info, exists: !!snap?.exists, status: 'ready' });
        },
        fail,
      ),
      fail,
    );
    sub(() =>
      s.db
        .collection('clanMembers')
        .where('clanId', '==', clanId)
        .limit(MAX_MEMBERS + 10)
        .onSnapshot((q: any) => {
          const members: Record<string, MemberDoc> = {};
          for (const d of q?.docs ?? []) {
            if (!validId(d?.id)) continue;
            const m = parseMemberDoc(d.data?.(), clanId);
            if (m) members[d.id] = m;
          }
          push({ members });
          refreshNames(Object.keys(members).filter((id) => id !== s.uid));
        }, ignore),
      ignore,
    );
    sub(() =>
      s.db
        .collection('clanRaids')
        .where('clanId', '==', clanId)
        .limit(200)
        .onSnapshot((q: any) => {
          const raids: Record<string, number> = {};
          for (const d of q?.docs ?? []) {
            if (!validId(d?.id)) continue;
            const dmg = parseRaidDoc(d.data?.(), clanId, week);
            if (dmg !== null) raids[d.id] = dmg;
          }
          push({ raids });
        }, ignore),
      ignore,
    );
    sub(() =>
      s.db
        .collection('clanChat')
        .where('clanId', '==', clanId)
        .limit(200)
        .onSnapshot((q: any) => {
          const chats: Record<string, ClanChatMsg[]> = {};
          for (const d of q?.docs ?? []) {
            if (!validId(d?.id)) continue;
            const msgs = parseChatDoc(d.data?.(), clanId);
            if (msgs.length) chats[d.id] = msgs;
          }
          push({ chats });
        }, ignore),
      ignore,
    );
    // Never hang on "loading" if the clan doc listener is slow.
    setTimeout(() => {
      if (!dead && !gotClan && data.status === 'loading') push({ status: 'off' });
    }, 10000);
  })();

  return () => {
    dead = true;
    unsubs.forEach((u) => {
      try {
        u();
      } catch {
        /* ignore */
      }
    });
  };
}
