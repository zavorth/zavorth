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
  // Do not fall back previous → last: that collapses previous/current and
  // hides real day-1 eligibility when PREVIOUS was never written.
  return {
    previousOpenAt: store.getItem(DESKTOP_PREVIOUS_OPEN_AT_KEY),
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

/** UTC calendar day key (YYYY-MM-DD), 1-based month, zero-padded. */
export function calendarDayKey(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isDay1ReturnEligible(previousOpenAt: string | null, currentOpenAt: string | null): boolean {
  if (!previousOpenAt || !currentOpenAt) return false;
  const previous = new Date(previousOpenAt);
  const current = new Date(currentOpenAt);
  if (Number.isNaN(previous.getTime()) || Number.isNaN(current.getTime())) return false;
  const prevDay = calendarDayKey(previousOpenAt);
  const curDay = calendarDayKey(currentOpenAt);
  if (!prevDay || !curDay || prevDay === curDay) return false;
  const delta = current.getTime() - previous.getTime();
  return delta >= 12 * 60 * 60 * 1000 && delta <= 48 * 60 * 60 * 1000;
}

/** Browser-safe projection of unfinished continuity work for the banner. */
export function buildDesktopPendingTasks(
  pendingApprovals: number,
  memoryDraftCount: number,
): string[] {
  const tasks: string[] = [];
  const approvals = Math.max(0, Number(pendingApprovals || 0));
  if (approvals > 0) {
    tasks.push(approvals === 1
      ? 'Review 1 pending approval'
      : `Review ${approvals} pending approvals`);
  }
  const drafts = Math.max(0, Number(memoryDraftCount || 0));
  if (drafts > 0) {
    tasks.push(drafts === 1
      ? 'Review 1 memory draft'
      : `Review ${drafts} memory drafts`);
  }
  return tasks;
}
