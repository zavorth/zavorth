/**
 * UI-facing session chrome integration cases.
 * Pure module coverage lives in sessionChrome.test.ts; this file adds
 * sort + label integration scenarios used by DesktopSidebar wiring.
 */
import { describe, expect, it } from 'vitest';
import {
  archiveSession,
  getSessionLabel,
  loadSessionChrome,
  pinSession,
  renameSession,
  saveSessionChrome,
  sortSessionsForSidebar,
  type SessionChromeMap,
} from '../src/session/sessionChrome';

// Re-export pure module for tooling / discovery that imports this path.
export * from '../src/session/sessionChrome';

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

describe('sessionChrome sidebar integration', () => {
  it('labels pinned/renamed sessions and hides archived by default', () => {
    let map: SessionChromeMap = {};
    map = renameSession(map, 's1', 'Release plan');
    map = pinSession(map, 's1', true);
    map = archiveSession(map, 's2', true);
    map = renameSession(map, 's3', 'Draft notes');

    const sessions = [
      { id: 's1', createdAt: '2024-01-01T00:00:00.000Z', label: 'Session 1' },
      { id: 's2', createdAt: '2024-06-01T00:00:00.000Z', label: 'Session 2' },
      { id: 's3', createdAt: '2024-03-01T00:00:00.000Z', label: 'Session 3' },
    ];

    const visible = sortSessionsForSidebar(sessions, map);
    expect(visible.map(s => s.id)).toEqual(['s1', 's3']);
    expect(getSessionLabel(map, 's1', 'Session 1')).toBe('Release plan');
    expect(getSessionLabel(map, 's3', 'Session 3')).toBe('Draft notes');
    expect(Boolean(map.s1?.pinned)).toBe(true);
  });

  it('includes archived when show-archived is on, after active threads', () => {
    const map: SessionChromeMap = {
      active: { pinned: true },
      old: { archived: true },
      mid: {},
    };
    const sessions = [
      { id: 'mid', createdAt: '2024-02-01T00:00:00.000Z' },
      { id: 'old', createdAt: '2024-05-01T00:00:00.000Z' },
      { id: 'active', createdAt: '2024-01-01T00:00:00.000Z' },
    ];
    const sorted = sortSessionsForSidebar(sessions, map, { includeArchived: true });
    expect(sorted.map(s => s.id)).toEqual(['active', 'mid', 'old']);
  });

  it('persists chrome map for sidebar remount', () => {
    const storage = memoryStorage();
    let map = pinSession({}, 'alpha', true);
    map = renameSession(map, 'alpha', 'Pinned alpha');
    saveSessionChrome(storage, map);
    const reloaded = loadSessionChrome(storage);
    expect(getSessionLabel(reloaded, 'alpha', 'alpha')).toBe('Pinned alpha');
    expect(reloaded.alpha?.pinned).toBe(true);
  });
});
