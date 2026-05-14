import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index.js';
import { DashboardService } from '../../src/services/DashboardService';
import { createTestLogRepo, fetchDashboardJson } from '../helpers/dashboardWebTestUtils.js';

function buildPlatformSnapshot(selectedId: string | null = 'plugin:openrouter') {
  return {
    generatedAt: '2026-04-03T12:00:00.000Z',
    summary: {
      total: 4,
      plugins: 2,
      skills: 1,
      mcps: 1,
      ready: 3,
      partial: 1,
      planned: 0,
      disabled: 0,
      trusted: 3,
      enabled: 1,
    },
    entries: [
      {
        id: 'plugin:openrouter',
        label: 'OpenRouter',
        kind: 'plugin',
        summary: 'Gateway remoto pronto.',
      },
      {
        id: 'plugin:external-executor',
        label: 'ExternalExecutor',
        kind: 'plugin',
        summary: 'Connector em onboarding.',
      },
      {
        id: 'skill:zavorthBridge',
        label: 'zavorthBridge',
        kind: 'skill',
        summary: 'Skill instalada.',
      },
      {
        id: 'mcp:filesystem',
        label: 'filesystem',
        kind: 'mcp',
        summary: 'Servidor MCP habilitado.',
      },
    ],
    selected: selectedId
      ? {
          id: selectedId,
          label: 'OpenRouter',
          kind: 'plugin',
          summary: 'Gateway remoto pronto.',
        }
      : null,
    featuredIds: ['plugin:openrouter', 'skill:zavorthBridge'],
    narrative: {
      headline: 'Platform plane unifica plugins, skills e MCPs.',
      operatorSummary: '2 plugins, 1 skill e 1 MCP visiveis.',
    },
  };
}

describe('Dashboard platform plane', () => {
  const logRepo = createTestLogRepo();
  const originalDashboardRuntimeStateFile = config.dashboardRuntimeStateFile;
  const tempDirs: string[] = [];

  afterEach(() => {
    config.dashboardRuntimeStateFile = originalDashboardRuntimeStateFile;
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('serves the unified platform plane through the classic dashboard api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-platform-plane-'));
    tempDirs.push(root);
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
      '/api/operations/platform',
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        summary: expect.objectContaining({
          total: 4,
          plugins: 2,
          mcps: 1,
        }),
        selected: expect.objectContaining({
          id: 'plugin:openrouter',
        }),
      }),
    );
  });

  it('executes platform plane actions through the classic dashboard api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-platform-actions-'));
    tempDirs.push(root);
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
        generatedAt: '2026-04-03T12:06:00.000Z',
        entryId: 'plugin:openrouter',
        actionId: 'trust',
        status: 'applied',
        ok: true,
        summary: 'OpenRouter marcado como trusted no platform plane.',
        details: ['Nenhum segredo foi alterado.'],
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
      '/api/operations/platform/actions',
      {
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            entryId: 'plugin:openrouter',
            actionId: 'trust',
          }),
        },
      },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(platformActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        entryId: 'plugin:openrouter',
        actionId: 'trust',
        requestedBy: 'dashboard',
      }),
    );
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          summary: 'OpenRouter marcado como trusted no platform plane.',
        }),
        platform: expect.objectContaining({
          selected: expect.objectContaining({
            id: 'plugin:openrouter',
          }),
        }),
      }),
    );
  });

  it('syncs the remote platform registry through the classic dashboard api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-platform-sync-'));
    tempDirs.push(root);
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const platformRegistryService = {
      buildSnapshot: jest.fn(() => buildPlatformSnapshot('plugin:openrouter')),
    };
    const platformCatalogSyncService = {
      sync: jest.fn(async () => ({
        ok: true,
        status: 'ready',
        summary: 'Registry remoto pronto com 4 item(ns), 0 colecao(oes) e 0 recipe(s).',
        entryCount: 4,
        collectionCount: 0,
        recipeCount: 0,
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
      '/api/operations/platform/sync',
      {
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
          selected: expect.objectContaining({
            id: 'plugin:openrouter',
          }),
        }),
      }),
    );
  });

  it('publishes a platform package through the classic dashboard api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dashboard-platform-publish-'));
    tempDirs.push(root);
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
      '/api/operations/platform/publish',
      {
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
          selected: expect.objectContaining({
            id: 'plugin:openrouter',
          }),
        }),
      }),
    );
  });
});
