import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DiscoveryCache } from '../../../../src/services/providers/catalog/DiscoveryCache.js';

describe('DiscoveryCache', () => {
  let cache: DiscoveryCache<string>;

  beforeEach(() => {
    cache = new DiscoveryCache<string>({
      ttlMs: 1000,
      maxEntries: 5,
      staleWhileRevalidateMs: 500,
    });
  });

  describe('get/set', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for missing keys', () => {
      expect(cache.get('missing')).toBeUndefined();
    });

    it('should track cache hits', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key1');
      const stats = cache.stats();
      expect(stats.hits).toBe(2);
    });

    it('should track cache misses', () => {
      cache.get('missing');
      const stats = cache.stats();
      expect(stats.misses).toBe(1);
    });
  });

  describe('has()', () => {
    it('should return true for existing keys', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
    });

    it('should return false for missing keys', () => {
      expect(cache.has('missing')).toBe(false);
    });
  });

  describe('isStale()', () => {
    it('should return false for fresh entries', () => {
      cache.set('key1', 'value1');
      expect(cache.isStale('key1')).toBe(false);
    });

    it('should return true for missing entries', () => {
      expect(cache.isStale('missing')).toBe(true);
    });
  });

  describe('delete()', () => {
    it('should remove entries', () => {
      cache.set('key1', 'value1');
      cache.delete('key1');
      expect(cache.has('key1')).toBe(false);
    });
  });

  describe('clear()', () => {
    it('should remove all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });

  describe('size()', () => {
    it('should track number of entries', () => {
      expect(cache.size()).toBe(0);
      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
    });
  });

  describe('stats()', () => {
    it('should return cache statistics', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('missing');
      const stats = cache.stats();
      expect(stats.size).toBe(1);
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0.5);
    });
  });

  describe('eviction', () => {
    it('should evict when max entries reached', () => {
      for (let i = 0; i < 6; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      expect(cache.size()).toBeLessThanOrEqual(5);
    });
  });

  describe('keys()', () => {
    it('should return all cache keys', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      const keys = cache.keys();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });
  });
});
