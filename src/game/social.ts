// Shared access to the artifact's online services (db + viewer identity) for social
// features (arena, clans). Resolves null outside the claude.ai viewer, when signed
// out, or when the page was published without the capabilities — callers must fall
// back to offline play.

export interface Social {
  db: any;
  user: any;
  /** This viewer's opaque id (the only identity ever stored). */
  uid: string;
}

let pending: Promise<Social | null> | null = null;

export function getSocial(): Promise<Social | null> {
  pending ??= (async () => {
    const claude = (window as any).claude;
    if (!claude?.use) return null;
    try {
      const [db, user] = await Promise.all([claude.use('db'), claude.use('user')]);
      if (!db || !user) return null;
      const uid = await user.id();
      return uid ? { db, user, uid } : null;
    } catch {
      return null;
    }
  })();
  return pending;
}

/** Display names for player ids ('' when unknown). Never store the result. */
export async function playerNames(ids: string[]): Promise<Record<string, string>> {
  const social = await getSocial();
  if (!social || !ids.length) return {};
  try {
    const ps = await social.user.profiles(ids);
    return Object.fromEntries(ids.map((id) => [id, ps?.[id]?.name || '']));
  } catch {
    return {};
  }
}
