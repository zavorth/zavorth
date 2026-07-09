/**
 * Session chrome metadata: rename, pin, archive (localStorage-backed, pure helpers).
 */

export const SESSION_CHROME_KEY = 'zvd:session-chrome';

export type SessionChromeMeta = {
  label?: string;
  pinned?: boolean;
  archived?: boolean;
  updatedAt?: number;
};

export type SessionChromeMap = Record<string, SessionChromeMeta>;

function nowMs(): number {
  return Date.now();
}

function cloneMap(map: SessionChromeMap): SessionChromeMap {
  const next: SessionChromeMap = {};
  for (const [id, meta] of Object.entries(map || {})) {
    next[id] = { ...meta };
  }
  return next;
}

function upsertMeta(
  map: SessionChromeMap,
  id: string,
  patch: Partial<SessionChromeMeta>,
  clock: () => number = nowMs,
): SessionChromeMap {
  const key = String(id || '').trim();
  if (!key) {
    return cloneMap(map);
  }
  const next = cloneMap(map);
  next[key] = {
    ...next[key],
    ...patch,
    updatedAt: clock(),
  };
  return next;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeMeta(raw: unknown): SessionChromeMeta | null {
  if (!isPlainObject(raw)) {
    return null;
  }
  const meta: SessionChromeMeta = {};
  if (typeof raw.label === 'string') {
    meta.label = raw.label;
  }
  if (typeof raw.pinned === 'boolean') {
    meta.pinned = raw.pinned;
  }
  if (typeof raw.archived === 'boolean') {
    meta.archived = raw.archived;
  }
  if (typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt)) {
    meta.updatedAt = raw.updatedAt;
  }
  return meta;
}

export function loadSessionChrome(storage: Pick<Storage, 'getItem'> | null): SessionChromeMap {
  if (!storage) {
    return {};
  }
  try {
    const raw = storage.getItem(SESSION_CHROME_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!isPlainObject(parsed)) {
      return {};
    }
    const map: SessionChromeMap = {};
    for (const [id, value] of Object.entries(parsed)) {
      const key = String(id || '').trim();
      if (!key) continue;
      const meta = normalizeMeta(value);
      if (meta) {
        map[key] = meta;
      }
    }
    return map;
  } catch {
    return {};
  }
}

export function saveSessionChrome(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  map: SessionChromeMap,
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(SESSION_CHROME_KEY, JSON.stringify(map || {}));
  } catch {
    // ignore quota / serialization failures
  }
}

export function renameSession(
  map: SessionChromeMap,
  id: string,
  label: string,
): SessionChromeMap {
  const trimmed = String(label ?? '').trim();
  return upsertMeta(map, id, { label: trimmed || undefined });
}

export function pinSession(
  map: SessionChromeMap,
  id: string,
  pinned: boolean,
): SessionChromeMap {
  return upsertMeta(map, id, { pinned: Boolean(pinned) });
}

export function archiveSession(
  map: SessionChromeMap,
  id: string,
  archived: boolean,
): SessionChromeMap {
  return upsertMeta(map, id, { archived: Boolean(archived) });
}

export function getSessionLabel(
  map: SessionChromeMap,
  id: string,
  fallback: string,
): string {
  const label = map?.[id]?.label;
  if (typeof label === 'string' && label.trim()) {
    return label.trim();
  }
  return fallback;
}

export function isSessionVisible(
  map: SessionChromeMap,
  id: string,
  includeArchived = false,
): boolean {
  if (includeArchived) {
    return true;
  }
  return !map?.[id]?.archived;
}

/**
 * Sort for sidebar: pinned first, then non-archived, then by createdAt desc.
 * Hide archived unless `includeArchived` is true.
 */
export function sortSessionsForSidebar<T extends { id: string; createdAt?: string }>(
  sessions: T[],
  map: SessionChromeMap,
  opts?: { includeArchived?: boolean },
): T[] {
  const includeArchived = Boolean(opts?.includeArchived);
  const list = (sessions || []).filter(session =>
    isSessionVisible(map, session.id, includeArchived),
  );

  return list.slice().sort((a, b) => {
    const aMeta = map?.[a.id] || {};
    const bMeta = map?.[b.id] || {};
    const aPinned = Boolean(aMeta.pinned);
    const bPinned = Boolean(bMeta.pinned);
    if (aPinned !== bPinned) {
      return aPinned ? -1 : 1;
    }

    const aArchived = Boolean(aMeta.archived);
    const bArchived = Boolean(bMeta.archived);
    if (aArchived !== bArchived) {
      return aArchived ? 1 : -1;
    }

    const aTime = Date.parse(String(a.createdAt || '')) || 0;
    const bTime = Date.parse(String(b.createdAt || '')) || 0;
    if (aTime !== bTime) {
      return bTime - aTime;
    }
    return String(a.id).localeCompare(String(b.id));
  });
}
