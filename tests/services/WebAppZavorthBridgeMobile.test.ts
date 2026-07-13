import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index.js';
import { DashboardService } from '../../src/services/DashboardService';
import { createTestLogRepo, fetchDashboardJson } from '../helpers/dashboardWebTestUtils.js';

describe('WebApp ZavorthBridge mobile access', () => {
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

  it('starts ZavorthBridge mobile access through the protected web api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-agmobile-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const zavorthBridgeMobileAccessService = {
      start: jest.fn(async () => ({
        action: 'start',
        ok: true,
        state: 'active',
        mode: 'public',
        accessUrl: 'https://ag.example.com',
        publicUrl: 'https://ag.example.com',
        localUrl: 'http://192.168.0.20:4747',
        requiresPassword: true,
        secret: 'mobile-secret',
        summary: 'Acesso movel do ZavorthBridge ativo via URL publica.',
        guide: {
          steps: ['Abra o link no celular.'],
          notes: [],
        },
      })),
      status: jest.fn(),
      guide: jest.fn(),
      stop: jest.fn(),
    };

    const service = new DashboardService(logRepo, {
      zavorthBridgeMobileAccessService: zavorthBridgeMobileAccessService as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/operations/zavorthBridge/mobile/start',
      {
        token: 'web-secret',
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ forceRepair: false }),
        },
      },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(zavorthBridgeMobileAccessService.start).toHaveBeenCalled();
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        mobileAccess: expect.objectContaining({
          accessUrl: 'https://ag.example.com',
          secret: 'mobile-secret',
        }),
      }),
    );
  });

  it('reads ZavorthBridge mobile access status through the protected web api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-agmobile-status-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const zavorthBridgeMobileAccessService = {
      start: jest.fn(),
      status: jest.fn(async () => ({
        action: 'status',
        ok: true,
        state: 'ready',
        mode: 'lan',
        accessUrl: 'http://192.168.0.20:4747',
        publicUrl: null,
        localUrl: 'http://192.168.0.20:4747',
        requiresPassword: false,
        secret: null,
        summary: 'ZavorthBridge remote ready for mobile via LAN.',
        guide: {
          steps: ['Conecte o celular na mesma rede e abra o link.'],
          notes: [],
        },
      })),
      guide: jest.fn(),
      stop: jest.fn(),
    };

    const service = new DashboardService(logRepo, {
      zavorthBridgeMobileAccessService: zavorthBridgeMobileAccessService as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/operations/zavorthBridge/mobile/status',
      { token: 'web-secret' },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(zavorthBridgeMobileAccessService.status).toHaveBeenCalled();
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        mobileAccess: expect.objectContaining({
          accessUrl: 'http://192.168.0.20:4747',
        }),
      }),
    );
  });
});
