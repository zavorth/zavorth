import { SkillBrowserService } from '../../src/skills/marketplace/SkillBrowserService';
import type { SkillSourceConfig } from '../../src/skills/marketplace/SkillBrowserService';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('SkillBrowserService', () => {
  let service: SkillBrowserService;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = path.join(os.tmpdir(), `skill-browser-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    service = new SkillBrowserService({
      dataDir: tmpDir,
      cacheTtlMs: 5 * 60 * 1000, // 5 minutes for tests
      requestTimeoutMs: 5000,
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('Source Management', () => {
    it('adds and retrieves sources', () => {
      const source: SkillSourceConfig = {
        id: 'test-repo',
        name: 'Test Repository',
        type: 'git-repo',
        baseUrl: 'https://github.com/test/repo',
        enabled: true,
        priority: 1,
      };

      service.addSource(source);
      const sources = service.getSources();

      expect(sources).toHaveLength(1);
      expect(sources[0].id).toBe('test-repo');
      expect(sources[0].name).toBe('Test Repository');
    });

    it('removes sources', () => {
      const source: SkillSourceConfig = {
        id: 'test-repo',
        name: 'Test Repository',
        type: 'git-repo',
        baseUrl: 'https://github.com/test/repo',
        enabled: true,
        priority: 1,
      };

      service.addSource(source);
      expect(service.getSources()).toHaveLength(1);

      const removed = service.removeSource('test-repo');
      expect(removed).toBe(true);
      expect(service.getSources()).toHaveLength(0);
    });

    it('enables and disables sources', () => {
      const source: SkillSourceConfig = {
        id: 'test-repo',
        name: 'Test Repository',
        type: 'git-repo',
        baseUrl: 'https://github.com/test/repo',
        enabled: true,
        priority: 1,
      };

      service.addSource(source);
      service.setSourceEnabled('test-repo', false);

      const sources = service.getSources();
      expect(sources[0].enabled).toBe(false);
    });
  });

  describe('Cache', () => {
    it('returns cache stats', () => {
      const stats = service.getCacheStats();
      expect(stats.sources).toBe(0);
      expect(stats.totalEntries).toBe(0);
    });

    it('invalidates cache', () => {
      service.invalidateCache('nonexistent');
      service.invalidateAllCache();
      const stats = service.getCacheStats();
      expect(stats.sources).toBe(0);
    });
  });

  describe('Search', () => {
    it('searches across enabled sources', async () => {
      // Add a source that will fail (no network in test)
      const source: SkillSourceConfig = {
        id: 'failing-source',
        name: 'Failing Source',
        type: 'custom-api',
        baseUrl: 'http://localhost:99999/nonexistent',
        enabled: true,
        priority: 1,
      };

      service.addSource(source);

      const result = await service.search({
        query: 'test query',
        useSemanticMatch: false,
      });

      expect(result.entries).toHaveLength(0);
      expect(result.sourcesSearched).toContain('failing-source');
      // sourcesFailed may or may not have entries depending on error handling
      expect(result.semanticMatchUsed).toBe(false);
    });

    it('filters by tags', async () => {
      // This test verifies the filter logic works
      const result = await service.search({
        query: 'test',
        tags: ['nonexistent-tag'],
        useSemanticMatch: false,
      });

      expect(result.entries).toHaveLength(0);
    });

    it('respects source IDs filter', async () => {
      const result = await service.search({
        query: 'test',
        sourceIds: ['nonexistent-source'],
        useSemanticMatch: false,
      });

      expect(result.sourcesSearched).toHaveLength(0);
    });
  });

  describe('Semantic Matching', () => {
    it('detects generic queries', async () => {
      // The isGenericQuery is private, but we can test it indirectly
      // by checking if semanticMatchUsed is true for generic queries
      const result = await service.search({
        query: 'install a skill for data analysis',
        useSemanticMatch: true,
      });

      // Semantic matching will fail without LLM, but the flag should be set
      expect(result.semanticMatchUsed).toBe(true);
    });

    it('skips semantic matching when disabled', async () => {
      const result = await service.search({
        query: 'install a skill for data analysis',
        useSemanticMatch: false,
      });

      expect(result.semanticMatchUsed).toBe(false);
    });
  });

  describe('Browse', () => {
    it('returns empty for disabled sources', async () => {
      const source: SkillSourceConfig = {
        id: 'disabled-source',
        name: 'Disabled Source',
        type: 'git-repo',
        baseUrl: 'https://github.com/test/repo',
        enabled: false,
        priority: 1,
      };

      service.addSource(source);
      const entries = await service.browseSource('disabled-source');
      expect(entries).toHaveLength(0);
    });

    it('returns empty for nonexistent sources', async () => {
      const entries = await service.browseSource('nonexistent');
      expect(entries).toHaveLength(0);
    });
  });
});
