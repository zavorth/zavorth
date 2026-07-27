import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  SESSION_CHROME_KEY,
  loadSessionChrome,
  saveSessionChrome,
  renameSession,
  pinSession,
  archiveSession,
  getSessionLabel,
  sortSessionsForSidebar,
  isSessionVisible,
  type SessionChromeMap,
} from '../src/session/sessionChrome';

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const store = new Map<string, string>(Object.entries(seed));
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  } as Storage;
}

describe('sessionChrome constants', () => {
  it('uses stable localStorage key', () => {
    expect(SESSION_CHROME_KEY).toBe('zvd:session-chrome');
  });
});

describe('loadSessionChrome / saveSessionChrome', () => {
  it('returns empty map for null storage', () => {
    expect(loadSessionChrome(null)).toEqual({});
  });

  it('returns empty map when key missing', () => {
    expect(loadSessionChrome(memoryStorage())).toEqual({});
  });

  it('returns empty map on invalid JSON', () => {
    const storage = memoryStorage({ [SESSION_CHROME_KEY]: '{not-json' });
    expect(loadSessionChrome(storage)).toEqual({});
  });

  it('returns empty map when stored value is not an object', () => {
    const storage = memoryStorage({ [SESSION_CHROME_KEY]: JSON.stringify(['x']) });
    expect(loadSessionChrome(storage)).toEqual({});
  });

  it('round-trips a chrome map', () => {
    const storage = memoryStorage();
    const map: SessionChromeMap = {
      s1: { label: 'Alpha', pinned: true, archived: false, updatedAt: 100 },
      s2: { label: 'Beta', pinned: false, archived: true, updatedAt: 200 },
    };
    saveSessionChrome(storage, map);
    expect(storage.getItem(SESSION_CHROME_KEY)).toContain('Alpha');
    expect(loadSessionChrome(storage)).toEqual(map);
  });

  it('save is a no-op for null storage', () => {
    expect(() => saveSessionChrome(null, { a: { label: 'x' } })).not.toThrow();
  });

  it('ignores malformed entries when loading', () => {
    const storage = memoryStorage({
      [SESSION_CHROME_KEY]: JSON.stringify({
        good: { label: 'Ok', pinned: true },
        bad: 'nope',
        '': { label: 'empty-id' },
      }),
    });
    const loaded = loadSessionChrome(storage);
    expect(loaded).toEqual({ good: { label: 'Ok', pinned: true } });
  });
});

describe('rename / pin / archive', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renames immutably and stamps updatedAt', () => {
    const map: SessionChromeMap = { s1: { label: 'Old', pinned: true } };
    const next = renameSession(map, 's1', '  New Name  ');
    expect(next).not.toBe(map);
    expect(next.s1).toEqual({
      label: 'New Name',
      pinned: true,
      updatedAt: 1_700_000_000_000,
    });
    expect(map.s1.label).toBe('Old');
  });

  it('creates entry on rename for unknown id', () => {
    const next = renameSession({}, 'new', 'Hello');
    expect(next.new).toEqual({ label: 'Hello', updatedAt: 1_700_000_000_000 });
  });

  it('clears label when rename with blank string', () => {
    const next = renameSession({ s1: { label: 'X' } }, 's1', '   ');
    expect(next.s1.label).toBeUndefined();
  });

  it('pins and unpins', () => {
    let map = pinSession({}, 's1', true);
    expect(map.s1.pinned).toBe(true);
    map = pinSession(map, 's1', false);
    expect(map.s1.pinned).toBe(false);
  });

  it('archives and unarchives', () => {
    let map = archiveSession({}, 's1', true);
    expect(map.s1.archived).toBe(true);
    map = archiveSession(map, 's1', false);
    expect(map.s1.archived).toBe(false);
  });

  it('ignores empty session ids', () => {
    expect(renameSession({ a: { label: 'a' } }, '  ', 'x')).toEqual({ a: { label: 'a' } });
  });
});

describe('getSessionLabel', () => {
  it('returns custom label when present', () => {
    expect(getSessionLabel({ s1: { label: 'Custom' } }, 's1', 'Fallback')).toBe('Custom');
  });

  it('returns fallback when missing or blank', () => {
    expect(getSessionLabel({}, 's1', 'Fallback')).toBe('Fallback');
    expect(getSessionLabel({ s1: { label: '  ' } }, 's1', 'Fallback')).toBe('Fallback');
    expect(getSessionLabel({ s1: {} }, 's1', 'Fallback')).toBe('Fallback');
  });
});

describe('isSessionVisible', () => {
  it('hides archived by default', () => {
    expect(isSessionVisible({ s1: { archived: true } }, 's1')).toBe(false);
    expect(isSessionVisible({ s1: { archived: false } }, 's1')).toBe(true);
    expect(isSessionVisible({}, 's1')).toBe(true);
  });

  it('shows archived when includeArchived', () => {
    expect(isSessionVisible({ s1: { archived: true } }, 's1', true)).toBe(true);
  });
});

describe('sortSessionsForSidebar', () => {
  const sessions = [
    { id: 'a', createdAt: '2024-01-01T00:00:00.000Z' },
    { id: 'b', createdAt: '2024-06-01T00:00:00.000Z' },
    { id: 'c', createdAt: '2024-03-01T00:00:00.000Z' },
    { id: 'd', createdAt: '2024-12-01T00:00:00.000Z' },
  ];

  it('sorts by createdAt desc when no chrome', () => {
    const sorted = sortSessionsForSidebar(sessions, {});
    expect(sorted.map(s => s.id)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('puts pinned first', () => {
    const map: SessionChromeMap = {
      a: { pinned: true },
      c: { pinned: true },
    };
    const sorted = sortSessionsForSidebar(sessions, map);
    expect(sorted.map(s => s.id)).toEqual(['c', 'a', 'd', 'b']);
  });

  it('hides archived by default', () => {
    const map: SessionChromeMap = {
      b: { archived: true },
      d: { pinned: true },
    };
    const sorted = sortSessionsForSidebar(sessions, map);
    expect(sorted.map(s => s.id)).toEqual(['d', 'c', 'a']);
  });

  it('includes archived after non-archived when requested', () => {
    const map: SessionChromeMap = {
      b: { archived: true },
      a: { archived: true, pinned: true },
      d: { pinned: true },
    };
    const sorted = sortSessionsForSidebar(sessions, map, { includeArchived: true });
    // pinned first (d, a), then non-archived c, then archived b
    // within pinned: non-archived d before archived a... Spec: pinned first, then non-archived, then createdAt
    // Comparison: both pinned, then archived flag (non-archived first), then date
    expect(sorted.map(s => s.id)).toEqual(['d', 'a', 'c', 'b']);
  });

  it('does not mutate input array', () => {
    const copy = sessions.slice();
    sortSessionsForSidebar(sessions, { a: { pinned: true } });
    expect(sessions).toEqual(copy);
  });
});
