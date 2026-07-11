import { ToolResultCache } from '../../src/cognitive-firewall/ToolResultCache';

describe('ToolResultCache', () => {
  let cache: ToolResultCache;

  beforeEach(() => {
    cache = new ToolResultCache({ maxEntries: 5, defaultTtlMs: 5000 });
  });

  describe('basic get/set', () => {
    it('returns cached result on hit', () => {
      cache.set('web_search', { query: 'test' }, 'search results');

      const result = cache.get('web_search', { query: 'test' });

      expect(result).toBe('search results');
    });

    it('returns null on cache miss', () => {
      const result = cache.get('web_search', { query: 'unknown' });

      expect(result).toBeNull();
    });

    it('returns null for different args on same tool', () => {
      cache.set('web_search', { query: 'test' }, 'results');

      expect(cache.get('web_search', { query: 'other' })).toBeNull();
    });

    it('handles args with different key order as same entry', () => {
      cache.set('web_search', { query: 'test', page: 1 }, 'results');

      const result = cache.get('web_search', { page: 1, query: 'test' });

      expect(result).toBe('results');
    });
  });

  describe('TTL expiration', () => {
    it('returns null after TTL expires', async () => {
      cache.set('web_search', { query: 'test' }, 'results', 100);

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(cache.get('web_search', { query: 'test' })).toBeNull();
    });

    it('returns result before TTL expires', () => {
      cache.set('web_search', { query: 'test' }, 'results', 10000);

      expect(cache.get('web_search', { query: 'test' })).toBe('results');
    });
  });

  describe('non-cacheable tools', () => {
    it.each([
      'run_sandbox_code',
      'remote_shell',
      'desktop_automation',
      'execute_command',
      'run_command',
      'create_file',
      'delete_file',
      'send_message',
      'unknown_plugin_tool',
    ])('never caches results for %s', (toolName) => {
      cache.set(toolName, { code: 'test' }, 'output');

      expect(cache.get(toolName, { code: 'test' })).toBeNull();
      expect(cache.size).toBe(0);
    });

    it('allows caching for cacheable tools', () => {
      cache.set('web_search', { query: 'test' }, 'results');

      expect(cache.size).toBe(1);
    });
  });

  describe('LRU eviction', () => {
    it('evicts entries when exceeding maxEntries', () => {
      // Fill cache to max (5 entries)
      for (let i = 0; i < 5; i++) {
        cache.set('web_search', { query: `q${i}` }, `result ${i}`);
      }
      expect(cache.size).toBe(5);

      // Add 3 more entries — should trigger eviction
      cache.set('web_search', { query: 'q5' }, 'result 5');
      cache.set('web_search', { query: 'q6' }, 'result 6');
      cache.set('web_search', { query: 'q7' }, 'result 7');

      // Cache should still be at max capacity
      expect(cache.size).toBe(5);

      // The newest entries should be cached
      expect(cache.get('web_search', { query: 'q7' })).toBe('result 7');

      // At least some older entries should have been evicted
      const stats = cache.getStats();
      expect(stats.evictions).toBeGreaterThanOrEqual(3);
    });
  });

  describe('invalidate', () => {
    it('invalidates all entries for a specific tool', () => {
      cache.set('web_search', { query: 'a' }, 'result a');
      cache.set('web_search', { query: 'b' }, 'result b');
      cache.set('read_file', { path: 'test.ts' }, 'file content');

      cache.invalidate('web_search');

      expect(cache.get('web_search', { query: 'a' })).toBeNull();
      expect(cache.get('web_search', { query: 'b' })).toBeNull();
      expect(cache.get('read_file', { path: 'test.ts' })).toBe('file content');
      expect(cache.size).toBe(1);
    });
  });

  describe('clear', () => {
    it('clears the entire cache', () => {
      cache.set('web_search', { query: 'a' }, 'result a');
      cache.set('read_file', { path: 'test.ts' }, 'file content');

      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.get('web_search', { query: 'a' })).toBeNull();
    });
  });

  describe('has', () => {
    it('returns true for cached entries', () => {
      cache.set('web_search', { query: 'test' }, 'results');

      expect(cache.has('web_search', { query: 'test' })).toBe(true);
    });

    it('returns false for missing entries', () => {
      expect(cache.has('web_search', { query: 'test' })).toBe(false);
    });

    it('returns false for non-cacheable tools', () => {
      cache.set('run_sandbox_code', { code: 'test' }, 'output');

      expect(cache.has('run_sandbox_code', { code: 'test' })).toBe(false);
    });
  });

  describe('stats', () => {
    it('tracks hits and misses', () => {
      cache.set('web_search', { query: 'test' }, 'results');

      cache.get('web_search', { query: 'test' }); // hit
      cache.get('web_search', { query: 'test' }); // hit
      cache.get('web_search', { query: 'other' }); // miss

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.size).toBe(1);
    });

    it('tracks evictions', () => {
      for (let i = 0; i < 7; i++) {
        cache.set('web_search', { query: `q${i}` }, `result ${i}`);
      }

      const stats = cache.getStats();
      expect(stats.evictions).toBe(2); // 7 - 5 = 2 evictions
      expect(stats.size).toBe(5);
    });
  });

  describe('nested args', () => {
    it('handles nested object args deterministically', () => {
      const args = { config: { nested: { b: 2, a: 1 } }, query: 'test' };
      cache.set('web_search', args, 'nested results');

      // Same args with different key order
      const reorderedArgs = { query: 'test', config: { nested: { a: 1, b: 2 } } };
      expect(cache.get('web_search', reorderedArgs)).toBe('nested results');
    });

    it('handles array args', () => {
      cache.set('web_search', { tags: ['b', 'a'] }, 'array results');

      expect(cache.get('web_search', { tags: ['b', 'a'] })).toBe('array results');
    });
  });
});
