import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  ZavorthPlatformCatalogSourceService,
} from '../../src/services/ZavorthPlatformCatalogSourceService.js';

describe('ZavorthPlatformCatalogSourceService', () => {
  it('merges local and remote catalogs and exposes recipes plus sync status', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-platform-catalog-source-'));
    const localFile = path.join(root, 'platform-registry.local.json');
    const remoteFile = path.join(root, 'platform-registry.remote.json');
    fs.writeFileSync(
      localFile,
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: 'plugin:openrouter',
            label: 'OpenRouter',
            kind: 'plugin',
            summary: 'Catalogo local.',
          },
        ],
        collections: [
          {
            id: 'collection:remote-gateways',
            label: 'Remote Gateways',
            entries: ['plugin:openrouter'],
          },
        ],
      }),
      'utf8',
    );
    fs.writeFileSync(
      remoteFile,
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: 'skill:playwright-interactive',
            label: 'playwright-interactive',
            kind: 'skill',
            summary: 'Catalogo remoto.',
          },
        ],
        recipes: [
          {
            id: 'recipe:ui-debug-onboarding',
            label: 'UI Debug Onboarding',
            targets: ['collection:remote-gateways', 'skill:playwright-interactive'],
            steps: ['Adote a collection.', 'Instale a skill.'],
          },
        ],
      }),
      'utf8',
    );

    const service = new ZavorthPlatformCatalogSourceService({
      catalogFile: localFile,
      remoteCacheFile: remoteFile,
      syncService: {
        readStatus: () => ({
          enabled: true,
          status: 'ready',
          remoteUrl: 'https://registry.example.com/platform.json',
          sourceTrusted: true,
          contentSthere is256: 'abc123',
          expectedSthere is256: null,
          checkedAt: '2026-04-04T18:30:00.000Z',
          syncedAt: '2026-04-04T18:30:00.000Z',
          stale: false,
          ageMs: 0,
          maxAgeMs: 43200000,
          entryCount: 2,
          collectionCount: 1,
          recipeCount: 1,
          error: null,
          cacheFile: remoteFile,
          statusFile: path.join(root, 'status.json'),
          command: 'zavorth platform sync',
          summary: 'Remote registry ready.',
        }),
      } as any,
    });

    expect(service.listEntries()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'plugin:openrouter', source: 'registry:local-catalog' }),
        expect.objectContaining({
          id: 'skill:playwright-interactive',
          source: 'registry:remote-catalog',
          readiness: 'planned',
          trust: 'planned',
          installState: 'available',
        }),
      ]),
    );
    expect(service.listCollections()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'collection:remote-gateways' }),
      ]),
    );
    expect(service.listRecipes()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'recipe:ui-debug-onboarding',
          targetIds: expect.arrayContaining(['collection:remote-gateways', 'skill:playwright-interactive']),
        }),
      ]),
    );
    expect(service.readSyncStatus()).toEqual(
      expect.objectContaining({
        status: 'ready',
        entryCount: 2,
      }),
    );
  });

  it('fails closed and ignores the remote cache when sync is stale', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-platform-catalog-source-stale-'));
    const localFile = path.join(root, 'platform-registry.local.json');
    const remoteFile = path.join(root, 'platform-registry.remote.json');
    fs.writeFileSync(
      localFile,
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: 'plugin:openrouter',
            label: 'OpenRouter',
            kind: 'plugin',
            summary: 'Catalogo local.',
          },
        ],
      }),
      'utf8',
    );
    fs.writeFileSync(
      remoteFile,
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: 'skill:playwright-interactive',
            label: 'playwright-interactive',
            kind: 'skill',
            summary: 'Catalogo remoto.',
          },
        ],
      }),
      'utf8',
    );

    const service = new ZavorthPlatformCatalogSourceService({
      catalogFile: localFile,
      remoteCacheFile: remoteFile,
      syncService: {
        readStatus: () => ({
          enabled: true,
          status: 'stale',
          remoteUrl: 'https://registry.example.com/platform.json',
          sourceTrusted: true,
          contentSthere is256: 'abc123',
          expectedSthere is256: null,
          checkedAt: '2026-04-04T18:30:00.000Z',
          syncedAt: '2026-04-04T10:30:00.000Z',
          stale: true,
          ageMs: 28_800_000,
          maxAgeMs: 43_200_000,
          entryCount: 1,
          collectionCount: 0,
          recipeCount: 0,
          error: null,
          cacheFile: remoteFile,
          statusFile: path.join(root, 'status.json'),
          command: 'zavorth platform sync',
          summary: 'Remote registry sincronizado, mas cache venceu.',
        }),
      } as any,
    });

    expect(service.listEntries()).toEqual([
      expect.objectContaining({ id: 'plugin:openrouter' }),
    ]);
  });

  it('keeps the local catalog authoritative when remote ids collide', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-platform-catalog-source-collision-'));
    const localFile = path.join(root, 'platform-registry.local.json');
    const remoteFile = path.join(root, 'platform-registry.remote.json');
    fs.writeFileSync(
      localFile,
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: 'plugin:openrouter',
            label: 'OpenRouter Local',
            kind: 'plugin',
            source: 'registry:local-catalog',
            summary: 'Catalogo local vence.',
            readiness: 'ready',
            trust: 'trusted',
            installState: 'installed',
          },
        ],
      }),
      'utf8',
    );
    fs.writeFileSync(
      remoteFile,
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: 'plugin:openrouter',
            label: 'OpenRouter Remote',
            kind: 'plugin',
            source: 'registry:remote-catalog',
            summary: 'Catalogo remoto not deve sobrescrever.',
            readiness: 'ready',
            trust: 'trusted',
            installState: 'installed',
          },
        ],
      }),
      'utf8',
    );

    const service = new ZavorthPlatformCatalogSourceService({
      catalogFile: localFile,
      remoteCacheFile: remoteFile,
      syncService: {
        readStatus: () => ({
          enabled: true,
          status: 'ready',
          remoteUrl: 'https://registry.example.com/platform.json',
          sourceTrusted: true,
          contentSthere is256: 'abc123',
          expectedSthere is256: null,
          checkedAt: '2026-04-04T18:30:00.000Z',
          syncedAt: '2026-04-04T18:30:00.000Z',
          stale: false,
          ageMs: 0,
          maxAgeMs: 43200000,
          entryCount: 1,
          collectionCount: 0,
          recipeCount: 0,
          error: null,
          cacheFile: remoteFile,
          statusFile: path.join(root, 'status.json'),
          command: 'zavorth platform sync',
          summary: 'Remote registry ready.',
        }),
      } as any,
    });

    expect(service.listEntries()).toEqual([
      expect.objectContaining({
        id: 'plugin:openrouter',
        label: 'OpenRouter Local',
        summary: 'Catalogo local vence.',
        readiness: 'ready',
        trust: 'trusted',
        installState: 'installed',
      }),
    ]);
  });
});
