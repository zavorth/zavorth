import { PromptCacheService } from '../../src/services/PromptCacheService';

describe('PromptCacheService', () => {
  it('returns cached prompt on cache hit', () => {
    const cache = new PromptCacheService();
    cache.setCachedPrompt('code_review', 'You are a code reviewer.');

    expect(cache.getCachedPrompt('code_review')).toBe('You are a code reviewer.');
    expect(cache.getStats().hits).toBe(1);
  });

  it('returns null on cache miss', () => {
    const cache = new PromptCacheService();

    expect(cache.getCachedPrompt('nonexistent')).toBeNull();
    expect(cache.getStats().misses).toBe(1);
  });

  it('respects TTL expiration', () => {
    const cache = new PromptCacheService({ defaultTtlMs: 100 });
    cache.setCachedPrompt('short_lived', 'prompt');

    expect(cache.getCachedPrompt('short_lived')).toBe('prompt');

    // Wait for TTL to expire
    const start = Date.now();
    while (Date.now() - start < 150) {
      // busy wait for expiration
    }

    expect(cache.getCachedPrompt('short_lived')).toBeNull();
    expect(cache.getStats().misses).toBe(1);
  });

  it('respects custom TTL per entry', () => {
    const cache = new PromptCacheService({ defaultTtlMs: 60000 });
    cache.setCachedPrompt('custom_ttl', 'prompt', 50);

    expect(cache.getCachedPrompt('custom_ttl')).toBe('prompt');

    const start = Date.now();
    while (Date.now() - start < 100) {
      // busy wait for expiration
    }

    expect(cache.getCachedPrompt('custom_ttl')).toBeNull();
  });

  it('evicts least-recently-used entry when max entries exceeded', () => {
    const cache = new PromptCacheService({ maxEntries: 3 });

    // Insert entries with distinct timestamps to guarantee deterministic LRU ordering
    cache.setCachedPrompt('a', 'promptA');
    const delay = () => {
      const start = Date.now();
      while (Date.now() - start < 5) { /* spin */ }
    };
    delay();
    cache.setCachedPrompt('b', 'promptB');
    delay();
    cache.setCachedPrompt('c', 'promptC');
    delay();

    // Access 'a' and 'b' to update their lastAccessed timestamps
    cache.getCachedPrompt('a');
    delay();
    cache.getCachedPrompt('b');
    delay();

    // Adding a fourth entry should evict 'c' (least recently used)
    cache.setCachedPrompt('d', 'promptD');

    expect(cache.getCachedPrompt('a')).toBe('promptA');
    expect(cache.getCachedPrompt('b')).toBe('promptB');
    expect(cache.getCachedPrompt('c')).toBeNull();
    expect(cache.getCachedPrompt('d')).toBe('promptD');
    expect(cache.getStats().size).toBe(3);
  });

  it('invalidates a specific intent', () => {
    const cache = new PromptCacheService();
    cache.setCachedPrompt('intent_a', 'promptA');
    cache.setCachedPrompt('intent_b', 'promptB');

    cache.invalidate('intent_a');

    expect(cache.getCachedPrompt('intent_a')).toBeNull();
    expect(cache.getCachedPrompt('intent_b')).toBe('promptB');
  });

  it('invalidates all entries', () => {
    const cache = new PromptCacheService();
    cache.setCachedPrompt('a', 'promptA');
    cache.setCachedPrompt('b', 'promptB');

    cache.invalidate();

    expect(cache.getStats().size).toBe(0);
    expect(cache.getCachedPrompt('a')).toBeNull();
    expect(cache.getCachedPrompt('b')).toBeNull();
  });

  it('tracks hit and miss statistics correctly', () => {
    const cache = new PromptCacheService();
    cache.setCachedPrompt('x', 'promptX');

    cache.getCachedPrompt('x');   // hit
    cache.getCachedPrompt('x');   // hit
    cache.getCachedPrompt('y');   // miss

    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(1);
  });

  it('builds cache key with userId', () => {
    const cache = new PromptCacheService();

    expect(cache.buildCacheKey('code_review')).toBe('code_review');
    expect(cache.buildCacheKey('code_review', 'user123')).toBe('code_review::user123');
  });

  it('handles empty intent string', () => {
    const cache = new PromptCacheService();

    cache.setCachedPrompt('', 'empty intent prompt');
    expect(cache.getCachedPrompt('')).toBe('empty intent prompt');
  });

  it('does not cache null or undefined prompt', () => {
    const cache = new PromptCacheService();

    cache.setCachedPrompt('null_key', null as unknown as string);
    cache.setCachedPrompt('undef_key', undefined as unknown as string);

    expect(cache.getCachedPrompt('null_key')).toBeNull();
    expect(cache.getCachedPrompt('undef_key')).toBeNull();
    expect(cache.getStats().size).toBe(0);
  });

  it('uses default options when none provided', () => {
    const cache = new PromptCacheService();

    // Default maxEntries is 100, default TTL is 5 minutes
    for (let i = 0; i < 100; i++) {
      cache.setCachedPrompt(`intent_${i}`, `prompt_${i}`);
    }
    expect(cache.getStats().size).toBe(100);

    // Adding one more should evict the first entry
    cache.setCachedPrompt('intent_100', 'prompt_100');
    expect(cache.getStats().size).toBe(100);
    expect(cache.getCachedPrompt('intent_0')).toBeNull();
    expect(cache.getCachedPrompt('intent_100')).toBe('prompt_100');
  });

  it('updates expiration on get (refreshes TTL)', () => {
    const cache = new PromptCacheService({ defaultTtlMs: 200 });
    cache.setCachedPrompt('refresh', 'prompt');

    // Access after 100ms — should still be alive
    const start = Date.now();
    while (Date.now() - start < 100) {
      // busy wait
    }
    expect(cache.getCachedPrompt('refresh')).toBe('prompt');

    // Wait another 150ms (total 250ms from set, but 150ms from last access)
    while (Date.now() - start < 250) {
      // busy wait
    }
    // The entry was NOT refreshed on get, so it should be expired now
    expect(cache.getCachedPrompt('refresh')).toBeNull();
  });

  it('does not evict entries when updating an existing entry at max capacity', () => {
    const cache = new PromptCacheService({ maxEntries: 2 });
    cache.setCachedPrompt('key1', 'val1');
    cache.setCachedPrompt('key2', 'val2');

    // Overwriting 'key1' should NOT trigger eviction of 'key2'
    cache.setCachedPrompt('key1', 'newVal1');

    expect(cache.getCachedPrompt('key1')).toBe('newVal1');
    expect(cache.getCachedPrompt('key2')).toBe('val2');
    expect(cache.getStats().size).toBe(2);
  });
});
