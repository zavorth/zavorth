import { describe, expect, it } from 'vitest';
import {
  DRAFT_STORAGE_KEY,
  clearDraft,
  getDraft,
  loadDrafts,
  saveDraft,
  shouldClearComposerAfterSend,
} from '../src/composer/composerDrafts';

function createMemoryStorage(seed?: Record<string, string>) {
  const map = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    removeItem(key: string) {
      map.delete(key);
    },
    _map: map,
  };
}

describe('DRAFT_STORAGE_KEY', () => {
  it('is the stable zvd drafts key', () => {
    expect(DRAFT_STORAGE_KEY).toBe('zvd:composer-drafts');
  });
});

describe('shouldClearComposerAfterSend', () => {
  it('clears only a message originating from the current composer draft', () => {
    expect(shouldClearComposerAfterSend('my draft', 'my draft')).toBe(true);
    expect(shouldClearComposerAfterSend('subagent payload', 'my draft')).toBe(false);
  });
});

describe('loadDrafts', () => {
  it('returns empty object for null storage', () => {
    expect(loadDrafts(null)).toEqual({});
  });

  it('returns empty object when key missing', () => {
    const storage = createMemoryStorage();
    expect(loadDrafts(storage)).toEqual({});
  });

  it('parses valid draft map', () => {
    const storage = createMemoryStorage({
      [DRAFT_STORAGE_KEY]: JSON.stringify({ s1: 'hello', s2: 'world' }),
    });
    expect(loadDrafts(storage)).toEqual({ s1: 'hello', s2: 'world' });
  });

  it('ignores non-string values and invalid JSON', () => {
    const storage = createMemoryStorage({
      [DRAFT_STORAGE_KEY]: JSON.stringify({ s1: 'ok', s2: 12, s3: null }),
    });
    expect(loadDrafts(storage)).toEqual({ s1: 'ok' });

    const bad = createMemoryStorage({ [DRAFT_STORAGE_KEY]: '{not-json' });
    expect(loadDrafts(bad)).toEqual({});

    const arr = createMemoryStorage({ [DRAFT_STORAGE_KEY]: '[]' });
    expect(loadDrafts(arr)).toEqual({});
  });
});

describe('saveDraft', () => {
  it('no-ops for null storage', () => {
    expect(() => saveDraft(null, 's1', 'text')).not.toThrow();
  });

  it('no-ops for empty sessionId', () => {
    const storage = createMemoryStorage();
    saveDraft(storage, '  ', 'text');
    expect(storage._map.size).toBe(0);
  });

  it('saves draft text for a session', () => {
    const storage = createMemoryStorage();
    saveDraft(storage, 'sess-a', 'draft body');
    expect(loadDrafts(storage)).toEqual({ 'sess-a': 'draft body' });
    expect(getDraft(storage, 'sess-a')).toBe('draft body');
  });

  it('overwrites existing draft for same session', () => {
    const storage = createMemoryStorage();
    saveDraft(storage, 's1', 'one');
    saveDraft(storage, 's1', 'two');
    expect(getDraft(storage, 's1')).toBe('two');
  });

  it('keeps drafts for other sessions', () => {
    const storage = createMemoryStorage();
    saveDraft(storage, 'a', 'A');
    saveDraft(storage, 'b', 'B');
    saveDraft(storage, 'a', 'A2');
    expect(loadDrafts(storage)).toEqual({ a: 'A2', b: 'B' });
  });

  it('deletes draft when text is empty or whitespace', () => {
    const storage = createMemoryStorage();
    saveDraft(storage, 's1', 'keep me');
    saveDraft(storage, 's1', '');
    expect(getDraft(storage, 's1')).toBe('');
    expect(loadDrafts(storage)).toEqual({});

    saveDraft(storage, 's2', 'x');
    saveDraft(storage, 's2', '   \n');
    expect(loadDrafts(storage)).toEqual({});
  });

  it('preserves non-trimmed content when non-empty after trim', () => {
    // save keeps original string if trim is non-empty (leading/trailing spaces intentional?)
    // Spec: empty text deletes; we store the provided text (not necessarily trimmed body)
    const storage = createMemoryStorage();
    saveDraft(storage, 's1', '  hello  ');
    expect(getDraft(storage, 's1')).toBe('  hello  ');
  });
});

describe('getDraft', () => {
  it('returns empty string for missing session or null storage', () => {
    expect(getDraft(null, 's1')).toBe('');
    const storage = createMemoryStorage();
    expect(getDraft(storage, 'missing')).toBe('');
    expect(getDraft(storage, '')).toBe('');
  });
});

describe('clearDraft', () => {
  it('no-ops for null storage', () => {
    expect(() => clearDraft(null, 's1')).not.toThrow();
  });

  it('removes only the target session draft', () => {
    const storage = createMemoryStorage();
    saveDraft(storage, 'a', 'A');
    saveDraft(storage, 'b', 'B');
    clearDraft(storage, 'a');
    expect(loadDrafts(storage)).toEqual({ b: 'B' });
  });

  it('is a no-op when session has no draft', () => {
    const storage = createMemoryStorage();
    saveDraft(storage, 'a', 'A');
    clearDraft(storage, 'missing');
    expect(loadDrafts(storage)).toEqual({ a: 'A' });
  });
});
