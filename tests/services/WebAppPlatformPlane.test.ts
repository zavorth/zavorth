import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index.js';
import { DashboardService } from '../../src/services/DashboardService';
import { createTestLogRepo, fetchDashboardJson } from '../helpers/dashboardWebTestUtils.js';

function buildPlatformSnapshot(selectedId: string | null = 'plugin:openrouter') {
  const collections = [
    {
      id: 'collection:ui-debug',
      label: 'UI Debug',
      source: 'registry:local-catalog',
      summary: 'Colecao para browser debugging.',
      actionHint: '/platform collection:ui-debug',
      featured: true,
      itemCount: 2,
      readyCount: 1,
      adoptedCount: 1,
      missingCount: 0,
      kinds: ['skill', 'mcp'],
      tags: ['browser'],
      capabilities: ['browser', 'prompt-workflow'],
      details: ['Pack: ui-debug'],
      entryIds: ['skill:zavorthBridge', 'mcp:filesystem'],
      searchText: 'collection ui debug',
      actions: [{ id: 'collection:ui-debug:install', label: 'Adotar colecao', kind: 'install', command: '/platform install collection:ui-debug' }],
      items: [
        {
          id: 'skill:zavorthBridge',
          label: 'zavorthBridge',
          kind: 'skill',
          readiness: 'ready',
          installState: 'installed',
          discoveryOnly: false,
        },
        {
          id: 'mcp:filesystem',
          label: 'filesystem',
          kind: 'mcp',
          readiness: 'ready',
          installState: 'enabled',
          discoveryOnly: false,
        },
      ],
    },
  ];

  return {
    generatedAt: '2026-04-03T12:00:00.000Z',
    summary: {
      total: 3,
      plugins: 1,
      skills: 1,
      mcps: 1,
      ready: 3,
      partial: 0,
      planned: 0,
      disabled: 0,
      trusted: 3,
      enabled: 1,
      catalogBacked: 3,
      discoveryOnly: 0,
      featured: 1,
      collections: collections.length,
      featuredCollections: 1,
    },
    entries: [
      {
        id: 'plugin:openrouter',
        label: 'OpenRouter',
        kind: 'plugin',
        summary: 'Gateway remoto pronto.',
        actionHint: '/integrations openrouter',
        actions: [{ id: 'plugin:openrouter:inspect', label: 'Inspecionar', kind: 'inspect', command: '/platform plugin:openrouter' }],
      },
      {
        id: 'skill:zavorthBridge',
        label: 'zavorthBridge',
        kind: 'skill',
        summary: 'Skill instalada.',
        actionHint: 'skill-library/zavorthBridge/SKILL.md',
        actions: [{ id: 'skill:zavorthBridge:open', label: 'Abrir', kind: 'open', command: 'skill-library/zavorthBridge/SKILL.md' }],
      },
      {
        id: 'mcp:filesystem',
        label: 'filesystem',
        kind: 'mcp',
        summary: 'Servidor MCP habilitado.',
        actionHint: 'npx @modelcontextprotocol/server-filesystem',
        actions: [{ id: 'mcp:filesystem:inspect', label: 'Inspecionar', kind: 'inspect', command: '/platform mcp:filesystem' }],
      },
    ],
    collections,
    selected: selectedId && !String(selectedId).startsWith('collection:')
      ? {
          id: selectedId,
          label: 'OpenRouter',
          kind: 'plugin',
          summary: 'Gateway remoto pronto.',
          actionHint: '/integrations openrouter',
          actions: [{ id: 'plugin:openrouter:inspect', label: 'Inspecionar', kind: 'inspect', command: '/platform plugin:openrouter' }],
        }
      : null,
    selectedCollection: selectedId === 'collection:ui-debug'
      ? collections[0]
      : null,
    query: null,
    featuredIds: ['plugin:openrouter', 'skill:zavorthBridge'],
    featuredCollectionIds: ['collection:ui-debug'],
    narrative: {
      headline: 'Platform plane unifica plugins, skills e MCPs.',
      operatorSummary: '1 plugin, 1 skill e 1 MCP prontos.',
    },
  };
}

describe('WebApp platform plane', () => {
  const logRepo = createTestLogRepo();
  const originalWebAuthToken = config.zavorthWebAuthToken;
  const originalDashboardRuntimeStateFile = config.dashboardRuntimeStateFile;
  const tempDirs: string[] = [];

  afterEach(() => {
    config.zavorthWebAuthToken = originalWebAuthToken;
    config.dashboardRuntimeStateFile = originalDashboardRuntimeStateFile;
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('exposes the unified platform plane through the protected web api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-platform-plane-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const platformRegistryService = {
      buildSnapshot: jest.fn(({ selectedId }: any = {}) => buildPlatformSnapshot(selectedId || 'plugin:openrouter')),
    };

    const service = new DashboardService(logRepo, {
      platformRegistryService: platformRegistryService as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/platform',
      { token: 'web-secret' },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        platform: expect.objectContaining({
          summary: expect.objectContaining({
            total: 3,
            skills: 1,
            mcps: 1,
          }),
          selected: expect.objectContaining({
            id: 'plugin:openrouter',
          }),
        }),
      }),
    );
  });

  it('executes platform plane actions through the protected web api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-platform-actions-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const platformRegistryService = {
      buildSnapshot: jest.fn(({ selectedId }: any = {}) => buildPlatformSnapshot(selectedId || 'plugin:openrouter')),
    };
    const pluginRegistryService = {
      buildSnapshot: jest.fn(() => ({
        summary: {
          total: 1,
          installed: 1,
          trusted: 1,
        },
        selected: {
          id: 'openrouter',
          label: 'OpenRouter',
        },
      })),
    };
    const platformActionService = {
      execute: jest.fn(() => ({
        generatedAt: '2026-04-03T12:05:00.000Z',
        entryId: 'plugin:openrouter',
        actionId: 'open',
        status: 'manual',
        ok: true,
        summary: 'OpenRouter: proximo passo pronto.',
        details: ['Atalho recomendado: /integrations openrouter'],
        delegated: null,
        selected: buildPlatformSnapshot('plugin:openrouter').selected,
        snapshot: buildPlatformSnapshot('plugin:openrouter'),
      })),
    };

    const service = new DashboardService(logRepo, {
      pluginRegistryService: pluginRegistryService as any,
      platformRegistryService: platformRegistryService as any,
      platformActionService: platformActionService as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/platform/actions',
      {
        token: 'web-secret',
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entryId: 'plugin:openrouter',
            actionId: 'open',
          }),
        },
      },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(platformActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        entryId: 'plugin:openrouter',
        actionId: 'open',
      }),
    );
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          summary: 'OpenRouter: proximo passo pronto.',
        }),
        platform: expect.objectContaining({
          selected: expect.objectContaining({
            id: 'plugin:openrouter',
          }),
        }),
      }),
    );
  });

  it('returns selectedCollection when a curated collection action is executed through the protected web api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-platform-collection-actions-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const platformRegistryService = {
      buildSnapshot: jest.fn(({ selectedId }: any = {}) => buildPlatformSnapshot(selectedId || 'plugin:openrouter')),
    };
    const platformActionService = {
      execute: jest.fn(() => ({
        generatedAt: '2026-04-03T12:06:00.000Z',
        entryId: 'collection:ui-debug',
        actionId: 'install',
        status: 'applied',
        ok: true,
        summary: 'UI Debug adotada no platform plane.',
        details: ['Itens avaliados: 2 | aplicados: 1 | noop: 1 | bloqueados: 0.'],
        delegated: null,
        selected: null,
        selectedCollection: buildPlatformSnapshot('collection:ui-debug').selectedCollection,
        snapshot: buildPlatformSnapshot('collection:ui-debug'),
      })),
    };

    const service = new DashboardService(logRepo, {
      platformRegistryService: platformRegistryService as any,
      platformActionService: platformActionService as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/platform/actions',
      {
        token: 'web-secret',
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entryId: 'collection:ui-debug',
            actionId: 'install',
          }),
        },
      },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          summary: 'UI Debug adotada no platform plane.',
        }),
        platform: expect.objectContaining({
          selectedCollection: expect.objectContaining({
            id: 'collection:ui-debug',
          }),
          selected: null,
        }),
      }),
    );
  });

  it('syncs the remote platform registry through the protected web api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-platform-sync-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const platformRegistryService = {
      buildSnapshot: jest.fn(() => buildPlatformSnapshot('plugin:openrouter')),
    };
    const platformCatalogSyncService = {
      sync: jest.fn(async () => ({
        ok: true,
        status: 'ready',
        summary: 'Registry remoto pronto com 3 item(ns), 1 colecao(oes) e 1 recipe(s).',
        entryCount: 3,
        collectionCount: 1,
        recipeCount: 1,
        cacheFile: 'C:/tmp/platform-cache.json',
        error: null,
      })),
    };

    const service = new DashboardService(logRepo, {
      platformRegistryService: platformRegistryService as any,
      platformCatalogSyncService: platformCatalogSyncService as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/platform/sync',
      {
        token: 'web-secret',
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: '{}',
        },
      },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(platformCatalogSyncService.sync).toHaveBeenCalled();
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          status: 'ready',
        }),
        platform: expect.objectContaining({
          summary: expect.objectContaining({
            total: 3,
          }),
        }),
      }),
    );
  });

  it('publishes a platform package through the protected web api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-platform-publish-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const platformRegistryService = {
      buildSnapshot: jest.fn(() => buildPlatformSnapshot('plugin:openrouter')),
    };
    const platformPublisherService = {
      publishDetailed: jest.fn(async () => ({
        ok: true,
        releaseId: '@example/sql-analyzer@1.2.3',
        packageId: '@example/sql-analyzer',
        version: '1.2.3',
        signature: 'sha256:abc123',
        packageSha256: 'abc123',
        fileCount: 2,
        outputFile: 'C:/repo/data/runtime/platform-publish/example.json',
        uploadStatus: 'prepared',
      })),
    };

    const service = new DashboardService(logRepo, {
      platformRegistryService: platformRegistryService as any,
      platformPublisherService: platformPublisherService as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/platform/publish',
      {
        token: 'web-secret',
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            packagePath: 'C:/tmp/sql-analyzer',
          }),
        },
      },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(platformPublisherService.publishDetailed).toHaveBeenCalledWith(
      expect.objectContaining({
        packagePath: 'C:/tmp/sql-analyzer',
        signLocal: true,
      }),
    );
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          releaseId: '@example/sql-analyzer@1.2.3',
          uploadStatus: 'prepared',
        }),
        platform: expect.objectContaining({
          summary: expect.objectContaining({
            total: 3,
          }),
        }),
      }),
    );
  });
});
