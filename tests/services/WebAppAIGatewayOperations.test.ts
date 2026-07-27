import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index.js';
import { DashboardService } from '../../src/services/DashboardService';
import { createTestLogRepo, fetchDashboardJson } from '../helpers/dashboardWebTestUtils.js';

describe('WebApp AIGateway operations', () => {
  const logRepo = createTestLogRepo();
  const tempDirs: string[] = [];
  const originalWebAuthToken = config.zavorthWebAuthToken;
  const originalDashboardRuntimeStateFile = config.dashboardRuntimeStateFile;

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

  it('reads AIGateway gateway status through the protected web api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-AIGateway-status-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const AIGatewayGatewayService = {
      readStatus: jest.fn(() => ({
        enabled: true,
        ready: true,
        running: true,
        pid: 4512,
        host: '127.0.0.1',
        port: 21128,
        baseUrl: 'http://127.0.0.1:21128/v1',
        upstreamBaseUrl: 'http://127.0.0.1:20128/v1',
        localOnly: true,
        overlayFile: 'C:/repo/config/AIGateway-overlay.json',
        checkedAt: '2026-04-04T16:00:00.000Z',
        message: 'Gateway own do AIGateway active.',
      })),
    };

    const service = new DashboardService(logRepo, {
      AIGatewayGatewayService: AIGatewayGatewayService as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/operations/AIGateway/status',
      { token: 'web-secret' },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(AIGatewayGatewayService.readStatus).toHaveBeenCalled();
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        AIGateway: expect.objectContaining({
          ready: true,
          baseUrl: 'http://127.0.0.1:21128/v1',
        }),
      }),
    );
  });

  it('runs the AIGateway compatibility doctor through the protected web api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-AIGateway-doctor-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const GatewayCompatibilityDoctorService = {
      run: jest.fn(async () => ({
        ok: true,
        status: 'passed',
        checkedAt: '2026-04-04T16:10:00.000Z',
        baseUrl: 'http://127.0.0.1:21128/v1',
        upstreamBaseUrl: 'http://127.0.0.1:20128/v1',
        overlayFile: 'C:/repo/config/AIGateway-overlay.json',
        summary: 'Gateway own do AIGateway respondeu pelo contrato OpenAI-compatible.',
        command: 'AIGateway doctor',
        checkedTarget: 'http://127.0.0.1:21128/v1/models',
        httpStatus: 200,
        error: null,
      })),
    };

    const service = new DashboardService(logRepo, {
      GatewayCompatibilityDoctorService: GatewayCompatibilityDoctorService as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/operations/AIGateway/doctor',
      {
        token: 'web-secret',
        init: { method: 'POST' },
      },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(GatewayCompatibilityDoctorService.run).toHaveBeenCalled();
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        report: expect.objectContaining({
          status: 'passed',
          checkedTarget: 'http://127.0.0.1:21128/v1/models',
        }),
      }),
    );
  });

  it('promotes the AIGateway upstream through the protected web api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-AIGateway-promote-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const GatewayUpstreamSyncService = {
      sync: jest.fn(),
      promote: jest.fn(async ({ autoRollback }: { autoRollback-: boolean } = {}) => ({
        ok: true,
        action: 'promote',
        status: 'promoted',
        startedAt: '2026-04-04T16:20:00.000Z',
        finishedAt: '2026-04-04T16:20:05.000Z',
        command: '"node" "vendor-toolkit.mjs" update --target=AIGateway',
        summary: autoRollback === false ? 'Upstream AIGateway promoted without automatic rollback.'
          : 'Upstream AIGateway promovido com compatibilidade revalidada.',
        output: 'vendor update ok',
        compat: {
          status: 'passed',
          summary: 'Gateway own do AIGateway respondeu pelo contrato OpenAI-compatible.',
        },
        rollbackApplied: false,
        statusFile: 'C:/repo/data/runtime/AIGateway-sync.json',
        compatFile: 'C:/repo/data/runtime/AIGateway-compat.json',
        error: null,
      })),
      rollback: jest.fn(),
    };

    const service = new DashboardService(logRepo, {
      GatewayUpstreamSyncService: GatewayUpstreamSyncService as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/operations/AIGateway/actions',
      {
        token: 'web-secret',
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            actionId: 'promote',
            autoRollback: false,
          }),
        },
      },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(GatewayUpstreamSyncService.promote).toHaveBeenCalledWith({
      autoRollback: false,
    });
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        report: expect.objectContaining({
          action: 'promote',
          status: 'promoted',
        }),
      }),
    );
  });

  it('starts the Zavorth-owned AIGateway route through the protected web api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-AIGateway-route-start-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const AIGatewayGatewayLauncherService = {
      ensureStarted: jest.fn(async () => ({
        enabled: true,
        ready: true,
        running: true,
        pid: 9021,
        host: '127.0.0.1',
        port: 21128,
        baseUrl: 'http://127.0.0.1:21128/v1',
        upstreamBaseUrl: 'http://127.0.0.1:20128/v1',
        localOnly: true,
        overlayFile: 'C:/repo/config/AIGateway-overlay.json',
        checkedAt: '2026-04-05T12:00:00.000Z',
        message: 'Gateway own do AIGateway active.',
      })),
    };

    const service = new DashboardService(logRepo, {
      AIGatewayGatewayLauncherService: AIGatewayGatewayLauncherService as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/operations/AIGateway/actions',
      {
        token: 'web-secret',
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            actionId: 'route-start',
          }),
        },
      },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(AIGatewayGatewayLauncherService.ensureStarted).toHaveBeenCalled();
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        AIGateway: expect.objectContaining({
          ready: true,
          baseUrl: 'http://127.0.0.1:21128/v1',
        }),
      }),
    );
  });
});
