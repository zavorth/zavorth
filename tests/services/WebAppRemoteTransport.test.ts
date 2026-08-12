import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../../src/config/index.js';
import { DashboardService } from '../../src/services/DashboardService.js';
import { createTestLogRepo, fetchDashboardJson } from '../helpers/dashboardWebTestUtils.js';

function buildRemoteTransportSnapshot(selectedId: string | null = 'node-host') {
  return {
    generatedAt: '2026-04-02T12:00:00.000Z',
    summary: {
      total: 4,
      ready: 2,
      partial: 1,
      planned: 1,
      disabled: 0,
      live: 2,
      reachable: 1,
      attentionRequired: 1,
      pendingWork: 0,
    },
    entries: [
      {
        id: 'discord-transport',
        label: 'Discord transport',
        kind: 'bridge',
        transport: 'discord-native-gateway',
        direction: 'bidirectional',
        readiness: 'ready',
        available: true,
        endpoint: null,
        operatorSummary: 'Discord pronto.',
        actionHint: '/status',
        details: ['Mode: native.'],
      },
    ],
    selected: selectedId
      ? {
          id: selectedId,
          label: 'Node host transport',
          kind: 'node-host',
          transport: 'node-mesh-heartbeat',
          direction: 'bidirectional',
          readiness: 'partial',
          available: false,
        endpoint: null,
        operatorSummary: 'Node pareado aguardando heartbeat.',
        actionHint: '/nodepair headless',
        telemetry: {
          updatedAt: '2026-04-02T11:59:00.000Z',
          pendingWork: 0,
          lastError: null,
          statusLine: 'Node offline aguardando heartbeat.',
        },
        details: ['Pareados: 1.'],
      }
      : null,
    suggestedActions: [
      {
        id: 'node-host-pair',
        label: 'Preparar node host',
        command: '/nodepair headless',
        severity: 'warn',
        reason: 'Node pareado aguardando heartbeat.',
      },
    ],
    narrative: {
      headline: 'Zavorth expoe 4 transporte(s) remoto(s) no plano atual.',
      operatorSummary: '2 pronto(s), 1 em preparo e 0 desativado(s).',
    },
  };
}

function buildRemoteTransportHistory(transportId: string = 'node-host') {
  return {
    generatedAt: '2026-04-02T12:06:00.000Z',
    transportId,
    summary: {
      total: 2,
      ok: 1,
      blocked: 1,
    },
    entries: [
      {
        occurredAt: '2026-04-02T12:05:00.000Z',
        transportId,
        actionId: 'repair',
        status: 'applied',
        ok: true,
        summary: 'Repair executado.',
        requestedBy: 'web',
      },
      {
        occurredAt: '2026-04-02T12:04:00.000Z',
        transportId,
        actionId: 'smoke',
        status: 'blocked',
        ok: false,
        summary: 'Smoke encontrou pendencias.',
        requestedBy: 'web',
      },
    ],
  };
}

function buildRemoteTransportDoctorReport(transportId: string = 'node-host') {
  return {
    checkedAt: '2026-04-02T12:07:00.000Z',
    status: 'passed',
    summary: 'Doctor remoto validou o transporte selecionado.',
    command: 'npm run test:transports:smoke',
    file: 'C:/tmp/remote-transport-doctor-last.json',
    items: [
      {
        transportId,
        label: 'Node host transport',
        kind: 'node-host',
        transport: 'node-mesh-heartbeat',
        readiness: 'partial',
        available: false,
        endpoint: null,
        status: 'passed',
        probeStatus: 'skipped',
        probeHttpStatus: null,
        summary: 'Node host validado pelo doctor.',
        error: null,
        recommendedAction: null,
        details: ['Heartbeat aguardando confirmacao operacional.'],
      },
    ],
  };
}

describe('WebApp remote transport endpoint', () => {
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

  it('serves the remote transport plane through the protected web api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-remote-transports-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const remoteTransportService = {
      buildSnapshot: jest.fn(({ selectedId }: any = {}) => buildRemoteTransportSnapshot(selectedId || 'node-host')),
    };

    const service = new DashboardService(logRepo, {
      remoteTransportService: remoteTransportService as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/transports?selectedId=node-host',
      { token: 'web-secret' },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(remoteTransportService.buildSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedId: 'node-host',
      }),
    );
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        transports: expect.objectContaining({
          summary: expect.objectContaining({
            total: 4,
            ready: 2,
          }),
          selected: expect.objectContaining({
            id: 'node-host',
          }),
        }),
      }),
    );
  });

  it('executes remote transport actions through the protected web api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-remote-transports-actions-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const remoteTransportService = {
      buildSnapshot: jest.fn(({ selectedId }: any = {}) => buildRemoteTransportSnapshot(selectedId || 'node-host')),
    };
    const remoteTransportActionService = {
      execute: jest.fn(async () => ({
        generatedAt: '2026-04-02T12:05:00.000Z',
        transportId: 'node-host',
        actionId: 'repair',
        status: 'applied',
        ok: true,
        summary: 'Node host transport recebeu um roteiro de repair.',
        details: ['Comando sugerido: /nodepair headless'],
        selected: buildRemoteTransportSnapshot('node-host').selected,
        snapshot: buildRemoteTransportSnapshot('node-host'),
      })),
    };

    const service = new DashboardService(logRepo, {
      remoteTransportService: remoteTransportService as any,
      remoteTransportActionService: remoteTransportActionService as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/transports/actions',
      {
        token: 'web-secret',
        init: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            transportId: 'node-host',
            actionId: 'repair',
          }),
        },
      },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(remoteTransportActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        transportId: 'node-host',
        actionId: 'repair',
      }),
    );
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          summary: 'Node host transport recebeu um roteiro de repair.',
        }),
        transports: expect.objectContaining({
          selected: expect.objectContaining({
            id: 'node-host',
          }),
        }),
      }),
    );
  });

  it('serves per-transport history and last doctor report through the protected web api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-remote-transports-history-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const remoteTransportService = {
      buildSnapshot: jest.fn(({ selectedId }: any = {}) => buildRemoteTransportSnapshot(selectedId || 'node-host')),
    };
    const remoteTransportActionService = {
      execute: jest.fn(),
      readHistory: jest.fn(({ transportId }: any = {}) => buildRemoteTransportHistory(transportId || 'node-host')),
    };
    const remoteTransportDoctorService = {
      run: jest.fn(),
      readLastReport: jest.fn(({ selectedId }: any = {}) => buildRemoteTransportDoctorReport(selectedId || 'node-host')),
    };

    const service = new DashboardService(logRepo, {
      remoteTransportService: remoteTransportService as any,
      remoteTransportActionService: remoteTransportActionService as any,
      remoteTransportDoctorService: remoteTransportDoctorService as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/transports/node-host/history',
      { token: 'web-secret' },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(remoteTransportActionService.readHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        transportId: 'node-host',
        limit: 10,
      }),
    );
    expect(remoteTransportDoctorService.readLastReport).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedId: 'node-host',
      }),
    );
    expect(payload).toEqual(
      expect.objectContaining({
        transport: expect.objectContaining({
          id: 'node-host',
        }),
        history: expect.objectContaining({
          transportId: 'node-host',
          summary: expect.objectContaining({
            total: 2,
          }),
        }),
        doctor: expect.objectContaining({
          status: 'passed',
        }),
      }),
    );
  });

  it('runs remote transport doctor through the protected web api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-remote-transports-doctor-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const remoteTransportService = {
      buildSnapshot: jest.fn(({ selectedId }: any = {}) => buildRemoteTransportSnapshot(selectedId || 'node-host')),
    };
    const remoteTransportDoctorService = {
      run: jest.fn(async ({ selectedId }: any = {}) => buildRemoteTransportDoctorReport(selectedId || 'node-host')),
      readLastReport: jest.fn(),
    };

    const service = new DashboardService(logRepo, {
      remoteTransportService: remoteTransportService as any,
      remoteTransportDoctorService: remoteTransportDoctorService as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/transports/node-host/doctor',
      {
        token: 'web-secret',
        init: {
          method: 'POST',
        },
      },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(remoteTransportDoctorService.run).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedId: 'node-host',
      }),
    );
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        report: expect.objectContaining({
          status: 'passed',
        }),
        transports: expect.objectContaining({
          selected: expect.objectContaining({
            id: 'node-host',
          }),
        }),
      }),
    );
  });

  it('executes per-transport recover through the protected web api', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-web-remote-transports-recover-'));
    tempDirs.push(root);
    config.zavorthWebAuthToken = 'web-secret';
    config.dashboardRuntimeStateFile = path.join(root, 'dashboard-runtime.json');

    const remoteTransportService = {
      buildSnapshot: jest.fn(({ selectedId }: any = {}) => buildRemoteTransportSnapshot(selectedId || 'node-host')),
    };
    const remoteTransportActionService = {
      execute: jest.fn(async () => ({
        generatedAt: '2026-04-02T12:08:00.000Z',
        transportId: 'node-host',
        actionId: 'repair',
        status: 'applied',
        ok: true,
        summary: 'Node host transport recebeu repair canonico.',
        details: ['Repair aplicado e fila reconciliada.'],
        selected: buildRemoteTransportSnapshot('node-host').selected,
        snapshot: buildRemoteTransportSnapshot('node-host'),
      })),
      readHistory: jest.fn(({ transportId }: any = {}) => buildRemoteTransportHistory(transportId || 'node-host')),
    };

    const service = new DashboardService(logRepo, {
      remoteTransportService: remoteTransportService as any,
      remoteTransportActionService: remoteTransportActionService as any,
    });

    await service.start();
    const { status, payload } = await fetchDashboardJson(
      service.getUrl(),
      '/api/web/transports/node-host/recover',
      {
        token: 'web-secret',
        init: {
          method: 'POST',
        },
      },
    );
    await service.stopAsync();

    expect(status).toBe(200);
    expect(remoteTransportActionService.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        transportId: 'node-host',
        actionId: 'repair',
      }),
    );
    expect(payload).toEqual(
      expect.objectContaining({
        ok: true,
        result: expect.objectContaining({
          summary: 'Node host transport recebeu repair canonico.',
        }),
        history: expect.objectContaining({
          transportId: 'node-host',
        }),
      }),
    );
  });
});
