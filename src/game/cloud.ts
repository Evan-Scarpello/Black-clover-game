// Cloud save for the published artifact: a private per-player copy of the save in the
// artifact's db (data/users/<id>/save). localStorage stays the fast local copy; this
// backs it up and carries progress across devices. Absent outside the claude.ai viewer.

import { migrate, startedFresh } from './state';
import { getState, onCommit, replaceState } from './store';

export type CloudStatus = 'off' | 'connecting' | 'synced' | 'saving' | 'error';

let status: CloudStatus = 'off';
const watchers = new Set<() => void>();

export function cloudStatus(): CloudStatus {
  return status;
}

export function onCloudStatus(fn: () => void) {
  watchers.add(fn);
  return () => watchers.delete(fn);
}

function setStatus(s: CloudStatus) {
  status = s;
  watchers.forEach((w) => w());
}

export async function initCloudSave() {
  const claude = (window as any).claude;
  if (!claude?.use) return;
  setStatus('connecting');
  let db: any;
  let user: any;
  try {
    [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
  } catch {
    return setStatus('off');
  }
  const uid = user ? await user.id() : null;
  if (!db || !uid) return setStatus('off');

  const ref = db.doc(`data/users/${uid}/save`);
  let lastJson = '';
  try {
    const snap = await ref.get();
    const remote = snap.exists ? (snap.data() as any)?.save : null;
    if (remote && typeof remote === 'object') {
      const r = migrate(remote);
      // A brand-new local save always yields to the cloud copy; otherwise newest progress wins.
      if (startedFresh() || r.updatedAt > getState().updatedAt) {
        replaceState(r);
        lastJson = JSON.stringify(getState());
      }
    }
  } catch {
    // Can't read the cloud copy: never risk overwriting it this visit.
    return setStatus('off');
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  let writing = false;
  let again = false;
  let disabled = false;

  const flush = async () => {
    timer = null;
    if (disabled) return;
    if (writing) {
      again = true;
      return;
    }
    const json = JSON.stringify(getState());
    if (json === lastJson) return setStatus('synced');
    writing = true;
    setStatus('saving');
    try {
      await ref.set({ save: JSON.parse(json), updatedAt: getState().updatedAt });
      lastJson = json;
      setStatus('synced');
    } catch (e: any) {
      if (e?.code === 'unavailable') schedule(15000);
      else {
        // No write access (view-only), quota, revoked…: keep playing on this device only.
        disabled = true;
        setStatus('error');
      }
    }
    writing = false;
    if (again) {
      again = false;
      schedule(3000);
    }
  };

  const schedule = (delay = 4000) => {
    if (disabled) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, delay);
  };

  onCommit(() => schedule());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
  if (JSON.stringify(getState()) !== lastJson) schedule(1000);
  else setStatus('synced');
}
