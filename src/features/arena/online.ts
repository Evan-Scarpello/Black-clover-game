// Online side of the Arena: read other players' published defenses (opponents and the
// leaderboard) and publish this player's own defense at arena/<uid>. Everything here
// degrades to offline play: any failure resolves to an empty list / no-op.

import { getSocial, playerNames } from '../../game/social';
import { getState, lineupTeam, onCommit } from '../../game/store';
import { currentRating, defenseDocBody, hashString, parseDefenseDoc, seasonId, type OnlineDefense } from './logic';

export const ARENA_UNLOCK = 10;
const COLLECTION = 'arena';

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(null);
      },
    );
  });
}

/** True once getSocial() has answered (null then really means offline, not just slow). */
let socialSettled = false;

async function social() {
  try {
    const p = getSocial();
    void p.then(
      () => (socialSettled = true),
      () => (socialSettled = true),
    );
    return await withTimeout(p, 12000);
  } catch {
    socialSettled = true;
    return null;
  }
}

/** This viewer's opaque id, or null offline. */
export async function myUid(): Promise<string | null> {
  return (await social())?.uid ?? null;
}

function parseSnap(snap: any, selfId: string | null): OnlineDefense[] {
  const docs: any[] = Array.isArray(snap?.docs) ? snap.docs : [];
  const out: OnlineDefense[] = [];
  for (const d of docs.slice(0, 100)) {
    try {
      if (!d || d.id === selfId) continue;
      const p = parseDefenseDoc(d.id, typeof d.data === 'function' ? d.data() : null);
      if (p) out.push(p);
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

// ───────── opponents pool ─────────

let poolCache: { at: number; list: OnlineDefense[] } | null = null;
let poolLoading: Promise<OnlineDefense[]> | null = null;

/** Recently active players' defenses (max 60, validated). Cached for a minute. */
export function fetchPool(force = false): Promise<OnlineDefense[]> {
  // A fetch already running (e.g. a forced refresh) is newer than the cache.
  if (poolLoading) return poolLoading;
  if (!force && poolCache && Date.now() - poolCache.at < 60000) return Promise.resolve(poolCache.list);
  poolLoading = (async () => {
    const s = await social();
    let list: OnlineDefense[] = [];
    if (s) {
      const q = (build: () => Promise<any>) => withTimeout<any>(Promise.resolve().then(build), 8000);
      let snap = await q(() => s.db.collection(COLLECTION).orderBy('updatedAt', 'desc').limit(60).get());
      if (!snap) snap = await q(() => s.db.collection(COLLECTION).limit(60).get());
      // Players who haven't been back since an older season get that season's soft reset.
      const sid = seasonId(Date.now());
      list = parseSnap(snap, s.uid).map((p) => ({ ...p, rating: currentRating(p.rating, p.season, sid) }));
    }
    poolCache = { at: Date.now(), list };
    poolLoading = null;
    return list;
  })().catch(() => {
    poolLoading = null;
    return [];
  });
  return poolLoading;
}

/** Top players of a season by rating (validated). */
export async function fetchBoard(sid: number): Promise<{ list: OnlineDefense[]; uid: string | null }> {
  const s = await social();
  if (!s) return { list: [], uid: null };
  const query = (build: () => Promise<any>) => {
    try {
      return withTimeout<any>(Promise.resolve().then(build), 8000);
    } catch {
      return Promise.resolve(null);
    }
  };
  const col = () => s.db.collection(COLLECTION);
  // This season's docs first; fall back to an unfiltered query when the filter isn't supported.
  let snap = await query(() => col().where('season', '==', sid).orderBy('rating', 'desc').limit(50).get());
  if (!snap) snap = await query(() => col().orderBy('rating', 'desc').limit(50).get());
  const list = parseSnap(snap, null).filter((p) => p.season === null || p.season === sid);
  return { list, uid: s.uid };
}

/** Display names for real players (fallback "Magic Knight"); never stored. */
export async function resolveNames(ids: string[]): Promise<Record<string, string>> {
  const uniq = [...new Set(ids.filter((id) => !id.startsWith('bot-') && !id.startsWith('lb-')))];
  if (!uniq.length) return {};
  const names = (await withTimeout(playerNames(uniq), 6000)) ?? {};
  return Object.fromEntries(uniq.map((id) => [id, clampName(names[id]) || 'Magic Knight']));
}

export function clampName(n: unknown): string {
  if (typeof n !== 'string') return '';
  const t = n.replace(/\s+/g, ' ').trim();
  return t.length > 20 ? `${t.slice(0, 19)}…` : t;
}

// ───────── publishing this player's defense ─────────

export type PublishStatus = 'off' | 'pending' | 'live' | 'error';
let status: PublishStatus = 'off';
const watchers = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
/** A db write has been sent and not answered yet (it may outlive the publish timeout). */
let writing = false;
let again = false;
let disabled = false;
let lastWrite = 0;

export function publishStatus(): PublishStatus {
  return status;
}

export function onPublishStatus(fn: () => void): () => void {
  watchers.add(fn);
  return () => {
    watchers.delete(fn);
  };
}

function setStatus(s: PublishStatus) {
  if (s === status) return;
  status = s;
  watchers.forEach((w) => w());
}

/** The defense lineup other players fight: the locked-in defense, or the current squad. */
export function defenseLineup(s = getState()) {
  return s.arena.defense ?? s.squad;
}

/** Republish the defense soon if it (or the rating) changed. Safe to call often. */
export function schedulePublish(delay = 4000) {
  if (disabled) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), Math.max(delay, 20000 - (Date.now() - lastWrite), 0));
}

async function flush() {
  timer = null;
  if (disabled) return;
  if (inFlight) {
    again = true;
    return;
  }
  if (getState().stage < ARENA_UNLOCK) return;
  inFlight = true;
  let retryIn = 0;
  try {
    retryIn = await publishOnce();
  } catch {
    retryIn = 30000;
  } finally {
    inFlight = false;
  }
  if (disabled) return;
  if (retryIn) schedulePublish(retryIn);
  else if (again) {
    again = false;
    schedulePublish(3000);
  }
}

/** One publish attempt. Returns a delay to retry after, or 0 when done (written or nothing to do). */
async function publishOnce(): Promise<number> {
  const soc = await social();
  if (!soc) {
    setStatus('off');
    // Offline for good (no viewer / signed out), or just slow to connect: try again later.
    if (socialSettled) {
      disabled = true;
      return 0;
    }
    return 60000;
  }
  const s = getState();
  const team = lineupTeam(defenseLineup(s), s);
  const now = Date.now();
  const body = defenseDocBody(team, s.arena, seasonId(now), now);
  const sig = String(hashString(JSON.stringify({ ...body, updatedAt: 0 })));
  // Unchanged: skip, but refresh once a day so active players stay findable.
  const stale = now - (s.arena.pubAt || 0) > 24 * 3600e3;
  if (!team.members.length || (sig === s.arena.pubSig && !stale)) {
    setStatus(team.members.length && s.arena.pubSig ? 'live' : 'off');
    return 0;
  }
  setStatus('pending');
  // A write that outlived its timeout is still running: never start a second one on top.
  if (writing) return 30000;
  writing = true;
  const outcome = await new Promise<'ok' | 'timeout' | { err: any }>((resolve) => {
    const t = setTimeout(() => resolve('timeout'), 15000);
    Promise.resolve()
      .then(() => soc.db.doc(`${COLLECTION}/${soc.uid}`).set(body))
      .then(
        () => {
          writing = false;
          clearTimeout(t);
          resolve('ok');
        },
        (err: any) => {
          writing = false;
          clearTimeout(t);
          resolve({ err });
        },
      );
  });
  if (outcome === 'ok') {
    lastWrite = Date.now();
    // Bookkeeping only (no commit): persisted with the next save.
    s.arena.pubSig = sig;
    s.arena.pubAt = now;
    setStatus('live');
    return 0;
  }
  const code = outcome === 'timeout' ? 'timeout' : outcome.err?.code;
  if (code === 'timeout' || code === 'unavailable' || code === 'resource_exhausted' || code === 'deadline-exceeded') {
    setStatus('pending');
    return 30000;
  }
  // View-only, forbidden, revoked…: play on with offline rivals.
  disabled = true;
  setStatus('error');
  return 0;
}

// Level-ups, squad edits and arena results all change what other players should face.
onCommit(() => {
  const s = getState();
  if (s.stage >= ARENA_UNLOCK) schedulePublish(6000);
});
