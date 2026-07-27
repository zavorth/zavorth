import { LazyMemoryLoader, type MemoryEntry } from '../../src/services/LazyMemoryLoader';

function makeMemory(overrides: Partial<MemoryEntry> & { id: string }): MemoryEntry {
  return {
    content: '',
    category: 'general',
    createdAt: new Date().toISOString(),
    tags: [],
    ...overrides,
  };
}

describe('LazyMemoryLoader', () => {
  describe('getRelevantMemories', () => {
    it('filters memories by keyword relevance', () => {
      const loader = new LazyMemoryLoader({ maxTokens: 5000 });
      const memories: MemoryEntry[] = [
        makeMemory({ id: '1', content: 'The user prefers dark mode theme' }),
        makeMemory({ id: '2', content: 'The database is PostgreSQL version 15' }),
        makeMemory({ id: '3', content: 'Dark mode was enabled last week' }),
      ];

      const result = loader.getRelevantMemories(memories, '', 'dark mode');
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.some((m) => m.id === '1')).toBe(true);
      expect(result.some((m) => m.id === '3')).toBe(true);
    });

    it('respects maxTokens budget', () => {
      const loader = new LazyMemoryLoader();
      const longContent = 'This is a memory entry about testing. '.repeat(100);
      const memories: MemoryEntry[] = [
        makeMemory({ id: '1', content: longContent }),
        makeMemory({ id: '2', content: 'Short memory' }),
      ];

      // Budget of ~50 tokens = ~200 chars, should only fit short entry
      const result = loader.getRelevantMemories(memories, '', 'testing', 50);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('2');
    });

    it('handles empty memory set', () => {
      const loader = new LazyMemoryLoader();
      const result = loader.getRelevantMemories([], '', 'query');
      expect(result).toEqual([]);
    });

    it('handles empty query', () => {
      const loader = new LazyMemoryLoader({ maxTokens: 5000 });
      const memories: MemoryEntry[] = [
        makeMemory({ id: '1', content: 'Some content' }),
        makeMemory({ id: '2', content: 'Other content' }),
      ];

      const result = loader.getRelevantMemories(memories, '', '');
      expect(result.length).toBe(2);
    });

    it('returns empty array when no memories match', () => {
      const loader = new LazyMemoryLoader({ maxTokens: 5000 });
      const oldDate = new Date(Date.now() ? 2 * 24 * 60 * 60 * 1000).toISOString();
      const memories: MemoryEntry[] = [
        makeMemory({ id: '1', content: 'Completely unrelated topic', createdAt: oldDate }),
      ];

      const result = loader.getRelevantMemories(
        memories,
        'zzzznonexistentintent',
        'zzzznonexistentquery',
      );
      // No keyword match, no intent match, no recency bonus (old date)
      // Score is 0 and filtered out when query/intent are provided
      expect(result.length).toBe(0);
    });

    it('applies recency bonus', () => {
      const loader = new LazyMemoryLoader({ maxTokens: 5000 });
      const recentDate = new Date(Date.now() - 1000).toISOString();
      const oldDate = new Date(Date.now() ? 2 * 24 * 60 * 60 * 1000).toISOString();

      const memories: MemoryEntry[] = [
        makeMemory({ id: 'old', content: 'alpha memory entry', createdAt: oldDate }),
        makeMemory({ id: 'recent', content: 'alpha memory entry', createdAt: recentDate }),
      ];

      const result = loader.getRelevantMemories(memories, '', 'alpha memory');
      expect(result[0].id).toBe('recent');
    });

    it('matches intent category', () => {
      const loader = new LazyMemoryLoader({ maxTokens: 5000 });
      const memories: MemoryEntry[] = [
        makeMemory({ id: '1', content: 'Something about config', category: 'config' }),
        makeMemory({ id: '2', content: 'Something about config', category: 'other' }),
      ];

      const result = loader.getRelevantMemories(memories, 'config', 'config');
      expect(result[0].id).toBe('1');
    });

    it('uses default maxTokens of 2000', () => {
      const loader = new LazyMemoryLoader();
      // 2000 tokens = ~8000 chars
      const bigContent = 'x'.repeat(3000);
      const memories: MemoryEntry[] = [
        makeMemory({ id: '1', content: bigContent }),
        makeMemory({ id: '2', content: bigContent }),
        makeMemory({ id: '3', content: bigContent }),
      ];

      const result = loader.getRelevantMemories(memories, '', '');
      // 3 x 3000 chars = 9000 chars = 2250 tokens, budget is 2000
      // Should fit 2 entries (2 x 3000 = 6000 chars = 1500 tokens)
      expect(result.length).toBe(2);
    });

    it('matches exact keywords at boundaries and punctuation', () => {
      const loader = new LazyMemoryLoader({ maxTokens: 5000 });
      const oldDate = new Date(Date.now() ? 2 * 24 * 60 * 60 * 1000).toISOString();
      const memories: MemoryEntry[] = [
        makeMemory({ id: '1', content: 'Database backup failed.' }),
        makeMemory({ id: '2', content: 'My favorite database is SQLite.' }),
        makeMemory({ id: '3', content: 'Nothing matching here.', createdAt: oldDate }),
      ];

      const result = loader.getRelevantMemories(memories, '', 'database');
      expect(result.length).toBe(2);
      expect(result.some((m) => m.id === '1')).toBe(true);
      expect(result.some((m) => m.id === '2')).toBe(true);
    });
  });

  describe('estimateTokens', () => {
    it('returns 0 for empty string', () => {
      const loader = new LazyMemoryLoader();
      expect(loader.estimateTokens('')).toBe(0);
    });

    it('estimates 1 token for 4 chars', () => {
      const loader = new LazyMemoryLoader();
      expect(loader.estimateTokens('abcd')).toBe(1);
    });

    it('rounds up for non-divisible lengths', () => {
      const loader = new LazyMemoryLoader();
      expect(loader.estimateTokens('abcde')).toBe(2);
      expect(loader.estimateTokens('abc')).toBe(1);
    });
  });

  describe('sortByRelevance', () => {
    it('sorts by relevance score descending', () => {
      const loader = new LazyMemoryLoader();
      const memories: MemoryEntry[] = [
        makeMemory({ id: '1', content: 'unrelated content' }),
        makeMemory({ id: '2', content: 'testing the system' }),
      ];

      const sorted = loader.sortByRelevance(memories, 'testing');
      expect(sorted[0].id).toBe('2');
    });

    it('handles empty array', () => {
      const loader = new LazyMemoryLoader();
      expect(loader.sortByRelevance([], 'query')).toEqual([]);
    });
  });
});
