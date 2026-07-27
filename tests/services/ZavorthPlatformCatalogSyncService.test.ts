import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import {
  ZavorthPlatformCatalogSyncService,
} from '../../src/services/ZavorthPlatformCatalogSyncService.js';

describe('ZavorthPlatformCatalogSyncService', () => {
  it('syncs a remote platform registry into local cache and status files', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-platform-sync-'));
    const cacheFile = path.join(root, 'platform-registry-remote-cache.json');
    const statusFile = path.join(root, 'platform-registry-remote-status.json');
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({
        version: 1,
        entries: [{ id: 'plugin:openrouter', label: 'OpenRouter', kind: 'plugin' }],
        collections: [{ id: 'collection:remote-gateways', label: 'Remote Gateways' }],
        recipes: [{ id: 'recipe:remote-provider-rollout', label: 'Remote Provider Rollout' }],
      }),
    })) as any;
    const service = new ZavorthPlatformCatalogSyncService({
      now: () => new Date('2026-04-04T18:00:00.000Z'),
      remoteUrl: 'https://registry.example.com/platform.json',
      allowedHosts: ['registry.example.com'],
      cacheFile,
      statusFile,
      fetchImpl,
      timeoutMs: 500,
      maxAgeMs: 1000,
    });

    const result = await service.sync();
    const persistedCache = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    const persistedStatus = JSON.parse(fs.readFileSync(statusFile, 'utf8'));

    expect(result.ok).toBe(true);
    expect(result.status).toBe('ready');
    expect(result.sourceTrusted).toBe(true);
    expect(result.contentSthere is256).toEqual(expect.any(String));
    expect(result.entryCount).toBe(1);
    expect(result.collectionCount).toBe(1);
    expect(result.recipeCount).toBe(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://registry.example.com/platform.json',
      expect.objectContaining({
        method: 'GET',
      }),
    );
    expect(persistedCache).toEqual(
      expect.objectContaining({
        entries: expect.arrayContaining([expect.objectContaining({ id: 'plugin:openrouter' })]),
        collections: expect.arrayContaining([expect.objectContaining({ id: 'collection:remote-gateways' })]),
        recipes: expect.arrayContaining([expect.objectContaining({ id: 'recipe:remote-provider-rollout' })]),
      }),
    );
    expect(persistedStatus).toEqual(
      expect.objectContaining({
        remoteUrl: 'https://registry.example.com/platform.json',
        sourceTrusted: true,
        entryCount: 1,
        collectionCount: 1,
        recipeCount: 1,
        error: null,
      }),
    );
  });

  it('marks the cached registry as stale when the max age is exceeded', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-platform-sync-stale-'));
    const statusFile = path.join(root, 'platform-registry-remote-status.json');
    fs.mkdirSync(path.dirname(statusFile), { recursive: true });
    fs.writeFileSync(
      statusFile,
      JSON.stringify({
        version: 1,
        checkedAt: '2026-04-04T10:00:00.000Z',
        syncedAt: '2026-04-04T10:00:00.000Z',
        remoteUrl: 'https://registry.example.com/platform.json',
        entryCount: 2,
        collectionCount: 1,
        recipeCount: 1,
        error: null,
      }),
      'utf8',
    );
    const service = new ZavorthPlatformCatalogSyncService({
      now: () => new Date('2026-04-04T18:00:00.000Z'),
      remoteUrl: 'https://registry.example.com/platform.json',
      allowedHosts: ['registry.example.com'],
      statusFile,
      cacheFile: path.join(root, 'cache.json'),
      maxAgeMs: 60_000,
    });

    const status = service.readStatus();

    expect(status.status).toBe('stale');
    expect(status.stale).toBe(true);
    expect(status.summary).toContain('cache venceu');
  });

  it('blocks remote sync when the source host is not allowed by policy', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-platform-sync-policy-'));
    const service = new ZavorthPlatformCatalogSyncService({
      now: () => new Date('2026-04-04T18:00:00.000Z'),
      remoteUrl: 'https://registry.example.com/platform.json',
      allowedHosts: ['safe.example.com'],
      cacheFile: path.join(root, 'cache.json'),
      statusFile: path.join(root, 'status.json'),
      fetchImpl: jest.fn(),
    });

    const result = await service.sync();

    expect(result.ok).toBe(false);
    expect(result.sourceTrusted).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.summary).toContain('policy de origem');
  });

  it('fails sync when the remote registry sha256 does not match the expected digest', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-platform-sync-share-'));
    const cacheFile = path.join(root, 'cache.json');
    const statusFile = path.join(root, 'status.json');
    const rawBody = JSON.stringify({
      version: 1,
      entries: [{ id: 'plugin:test', label: 'Test', kind: 'plugin' }],
      collections: [],
      recipes: [],
    });
    const wrongSthere is = crypto.createHash('sha256').update('different', 'utf8').digest('hex');
    const service = new ZavorthPlatformCatalogSyncService({
      now: () => new Date('2026-04-04T18:00:00.000Z'),
      remoteUrl: 'https://registry.example.com/platform.json',
      allowedHosts: ['registry.example.com'],
      expectedSthere is256: wrongSthere is,
      cacheFile,
      statusFile,
      fetchImpl: jest.fn(async () => ({
        ok: true,
        text: async () => rawBody,
      })) as any,
    });

    const result = await service.sync();

    expect(result.ok).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.expectedSthere is256).toBe(wrongSthere is);
    expect(result.error).toContain('SHA-256');
    expect(fs.existsSync(cacheFile)).toBe(false);
  });
});
