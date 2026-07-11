export const DESKTOP_LAST_OPEN_AT_KEY = 'zvd:last-open-at';
export const DESKTOP_PREVIOUS_OPEN_AT_KEY = 'zvd:previous-open-at';
export const DESKTOP_LAST_SESSION_ID_KEY = 'zvd:last-session-id';
export const DESKTOP_LAST_SESSION_TITLE_KEY = 'zvd:last-session-title';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function resolveStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

export function touchDesktopOpenClock(storage?: StorageLike, now = new Date()): {
  previousOpenAt: string | null;
  currentOpenAt: string;
} {
  const store = resolveStorage(storage);
  const currentOpenAt = now.toISOString();
  if (!store) {
    return { previousOpenAt: null, currentOpenAt };
  }
  const previousOpenAt = store.getItem(DESKTOP_LAST_OPEN_AT_KEY);
  if (previousOpenAt) {
    store.setItem(DESKTOP_PREVIOUS_OPEN_AT_KEY, previousOpenAt);
  }
  store.setItem(DESKTOP_LAST_OPEN_AT_KEY, currentOpenAt);
  return { previousOpenAt, currentOpenAt };
}

export function readDesktopOpenClock(storage?: StorageLike): {
  previousOpenAt: string | null;
  currentOpenAt: string | null;
} {
  const store = resolveStorage(storage);
  if (!store) return { previousOpenAt: null, currentOpenAt: null };
  return {
    previousOpenAt: store.getItem(DESKTOP_PREVIOUS_OPEN_AT_KEY) || store.getItem(DESKTOP_LAST_OPEN_AT_KEY),
    currentOpenAt: store.getItem(DESKTOP_LAST_OPEN_AT_KEY),
  };
}

export function rememberDesktopSession(
  input: { id: string; title?: string | null },
  storage?: StorageLike,
): void {
  const store = resolveStorage(storage);
  if (!store || !input.id) return;
  store.setItem(DESKTOP_LAST_SESSION_ID_KEY, input.id);
  if (input.title) store.setItem(DESKTOP_LAST_SESSION_TITLE_KEY, input.title);
}

export function readRememberedDesktopSession(storage?: StorageLike): {
  id: string | null;
  title: string | null;
} {
  const store = resolveStorage(storage);
  if (!store) return { id: null, title: null };
  return {
    id: store.getItem(DESKTOP_LAST_SESSION_ID_KEY),
    title: store.getItem(DESKTOP_LAST_SESSION_TITLE_KEY),
  };
}

export function isDay1ReturnEligible(previousOpenAt: string | null, currentOpenAt: string | null): boolean {
  if (!previousOpenAt || !currentOpenAt) return false;
  const previous = new Date(previousOpenAt);
  const current = new Date(currentOpenAt);
  if (Number.isNaN(previous.getTime()) || Number.isNaN(current.getTime())) return false;
  const prevDay = `${previous.getUTCFullYear()}-${previous.getUTCMonth()}-${previous.getUTCDate()}`;
  const curDay = `${current.getUTCFullYear()}-${current.getUTCMonth()}-${current.getUTCDate()}`;
  const delta = current.getTime() - previous.getTime();
  return prevDay !== curDay && delta >= 12 * 60 * 60 * 1000 && delta <= 48 * 60 * 60 * 1000;
}
