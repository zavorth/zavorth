import fs from 'fs';
import path from 'path';
import os from 'os';
import { PromptCacheService } from '../../../src/services/plugins/PromptCacheService';

describe('PromptCacheService', () => {
  let service: PromptCacheService;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompt-cache-'));
    service = new PromptCacheService({ storageDir: tmpDir });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('cache miss then hit', () => {
    it('returns miss on first check', () => {
      const result = service.checkCache('Hello world', 'openai', 'gpt-4o');
      expect(result.hit).toBe(false);
      expect(result.cache_id).toBeNull();
      expect(result.tokens_saved).toBe(0);
    });

    it('returns hit after adding to cache', () => {
      service.addToCache('Hello world', 'openai', 'gpt-4o', 100);
      const result = service.checkCache('Hello world', 'openai', 'gpt-4o');
      expect(result.hit).toBe(true);
      expect(result.cache_id).toBeTruthy();
      expect(result.tokens_saved).toBe(100);
    });

    it('returns miss for different provider', () => {
      service.addToCache('Hello', 'openai', 'gpt-4o', 50);
      const result = service.checkCache('Hello', 'anthropic', 'claude-4');
      expect(result.hit).toBe(false);
    });

    it('returns miss for different model', () => {
      service.addToCache('Hello', 'openai', 'gpt-4o', 50);
      const result = service.checkCache('Hello', 'openai', 'gpt-4o-mini');
      expect(result.hit).toBe(false);
    });

    it('increments cache_hits on repeated access', () => {
      service.addToCache('test prompt', 'openai', 'gpt-4o', 50);
      service.checkCache('test prompt', 'openai', 'gpt-4o');
      service.checkCache('test prompt', 'openai', 'gpt-4o');
      const stats = service.getStats();
      expect(stats).toContain('Cache hits: 2');
    });
  });

  describe('hash computation', () => {
    it('returns consistent hash for same input', () => {
      const h1 = service.computeHash('Hello world');
      const h2 = service.computeHash('Hello world');
      expect(h1).toBe(h2);
    });

    it('returns different hash for different input', () => {
      const h1 = service.computeHash('Hello');
      const h2 = service.computeHash('World');
      expect(h1).not.toBe(h2);
    });

    it('returns a non-empty string', () => {
      const hash = service.computeHash('test');
      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
    });

    it('returns base-36 encoded string', () => {
      const hash = service.computeHash('test data');
      expect(hash).toMatch(/^[0-9a-z]+$/);
    });
  });

  describe('common prefix extraction', () => {
    it('returns empty array for empty input', () => {
      const prefix = service.findCommonPrefix([]);
      expect(prefix).toEqual([]);
    });

    it('returns full content for single prompt', () => {
      const prefix = service.findCommonPrefix(['hello world']);
      expect(prefix).toEqual(['hello', 'world']);
    });

    it('finds common prefix between prompts', () => {
      const prefix = service.findCommonPrefix([
        'You are a helpful assistant',
        'You are a coding assistant',
      ]);
      expect(prefix).toEqual(['You', 'are', 'a']);
    });

    it('returns empty when no common prefix', () => {
      const prefix = service.findCommonPrefix([
        'Hello world',
        'Goodbye moon',
      ]);
      expect(prefix).toEqual([]);
    });

    it('handles multiple prompts', () => {
      const prefix = service.findCommonPrefix([
        'The quick brown fox',
        'The quick red fox',
        'The quick blue fox',
      ]);
      expect(prefix).toEqual(['The', 'quick']);
    });
  });

  describe('prompt ordering optimization', () => {
    it('returns prompts as-is when cache is empty', () => {
      const prompts = ['a', 'b', 'c'];
      const result = service.optimizePromptOrder(prompts);
      expect(result).toHaveLength(3);
    });

    it('returns single prompt unchanged', () => {
      const result = service.optimizePromptOrder(['only one']);
      expect(result).toEqual(['only one']);
    });

    it('returns empty array unchanged', () => {
      const result = service.optimizePromptOrder([]);
      expect(result).toEqual([]);
    });

    it('orders by cache hits descending', () => {
      service.addToCache('popular', 'openai', 'gpt-4o', 50);
      service.addToCache('rare', 'openai', 'gpt-4o', 50);

      service.checkCache('popular', 'openai', 'gpt-4o');
      service.checkCache('popular', 'openai', 'gpt-4o');
      service.checkCache('popular', 'openai', 'gpt-4o');
      service.checkCache('rare', 'openai', 'gpt-4o');

      const result = service.optimizePromptOrder(['rare', 'popular']);
      expect(result[0]).toBe('popular');
    });
  });

  describe('cache eviction', () => {
    it('returns 0 when nothing to evict', () => {
      const evicted = service.evict(1000);
      expect(evicted).toBe(0);
    });

    it('evicts old entries with low hits', () => {
      service.addToCache('old prompt', 'openai', 'gpt-4o', 50);

      const cachePath = path.join(tmpDir, 'cache.json');
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      const key = Object.keys(data)[0];
      data[key].last_used = new Date(Date.now() ? 8 * 24 * 60 * 60 * 1000).toISOString();
      data[key].cache_hits = 0;
      fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf-8');

      const freshService = new PromptCacheService({ storageDir: tmpDir });
      const evicted = freshService.evict(7 * 24 * 60 * 60 * 1000);
      expect(evicted).toBe(1);
    });

    it('does not evict entries with high hits', () => {
      service.addToCache('popular old', 'openai', 'gpt-4o', 50);
      for (let i = 0; i < 10; i++) {
        service.checkCache('popular old', 'openai', 'gpt-4o');
      }

      const cachePath = path.join(tmpDir, 'cache.json');
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      const key = Object.keys(data)[0];
      data[key].last_used = new Date(Date.now() ? 8 * 24 * 60 * 60 * 1000).toISOString();
      fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf-8');

      const freshService = new PromptCacheService({ storageDir: tmpDir });
      const evicted = freshService.evict(7 * 24 * 60 * 60 * 1000);
      expect(evicted).toBe(0);
    });
  });

  describe('stats', () => {
    it('starts with zero stats', () => {
      const stats = service.getStats();
      expect(stats).toContain('Cached prompts: 0');
      expect(stats).toContain('Cache hits: 0');
      expect(stats).toContain('Cache misses: 0');
      expect(stats).toContain('Hit rate: 0.0%');
    });

    it('tracks hits and misses', () => {
      service.addToCache('cached', 'openai', 'gpt-4o', 100);
      service.checkCache('cached', 'openai', 'gpt-4o');
      service.checkCache('not-cached', 'openai', 'gpt-4o');
      const stats = service.getStats();
      expect(stats).toContain('Cache hits: 1');
      expect(stats).toContain('Cache misses: 1');
      expect(stats).toContain('Hit rate: 50.0%');
    });

    it('tracks tokens saved', () => {
      service.addToCache('big prompt', 'openai', 'gpt-4o', 500);
      service.checkCache('big prompt', 'openai', 'gpt-4o');
      const stats = service.getStats();
      expect(stats).toContain('Tokens saved: 500');
    });

    it('tracks cached prompt count', () => {
      service.addToCache('a', 'openai', 'gpt-4o', 10);
      service.addToCache('b', 'openai', 'gpt-4o', 20);
      const stats = service.getStats();
      expect(stats).toContain('Cached prompts: 2');
    });
  });

  describe('listCached()', () => {
    it('returns empty message when no cache', () => {
      const list = service.listCached();
      expect(list).toBe('No cached prompts.');
    });

    it('lists cached prompts', () => {
      service.addToCache('test', 'openai', 'gpt-4o', 100);
      const list = service.listCached();
      expect(list).toContain('openai/gpt-4o');
      expect(list).toContain('tokens:100');
    });

    it('orders by cache hits', () => {
      service.addToCache('popular', 'openai', 'gpt-4o', 50);
      service.addToCache('rare', 'openai', 'gpt-4o', 50);

      service.checkCache('popular', 'openai', 'gpt-4o');
      service.checkCache('popular', 'openai', 'gpt-4o');
      service.checkCache('popular', 'openai', 'gpt-4o');
      service.checkCache('rare', 'openai', 'gpt-4o');

      const list = service.listCached();
      const hitsMatches = list.match(/hits:(\d+)/g) || [];
      expect(hitsMatches.length).toBeGreaterThanOrEqual(2);
      const firstHits = parseInt(hitsMatches[0].replace('hits:', ''));
      const secondHits = parseInt(hitsMatches[1].replace('hits:', ''));
      expect(firstHits).toBeGreaterThanOrEqual(secondHits);
    });
  });

  describe('persistence', () => {
    it('saves cache to disk', () => {
      service.addToCache('persist test', 'openai', 'gpt-4o', 100);
      const cachePath = path.join(tmpDir, 'cache.json');
      expect(fs.existsSync(cachePath)).toBe(true);
    });

    it('loads cache from disk on construction', () => {
      service.addToCache('loaded', 'openai', 'gpt-4o', 200);
      const freshService = new PromptCacheService({ storageDir: tmpDir });
      const result = freshService.checkCache('loaded', 'openai', 'gpt-4o');
      expect(result.hit).toBe(true);
      expect(result.tokens_saved).toBe(200);
    });
  });
});
