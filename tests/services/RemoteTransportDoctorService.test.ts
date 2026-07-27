import fs from 'fs';
import os from 'os';
import path from 'path';
import { RemoteTransportDoctorService } from '../../src/services/RemoteTransportDoctorService.js';

describe('RemoteTransportDoctorService', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('writes a persisted report and validates ready remote transports', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-remote-transport-doctor-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'remote-transport-doctor-last.json');
    const aiGatewaySidecar = {
      start: jest.fn(async () => ({
        ready: false,
        message: 'AIGateway still booting.',
      })),
    };
    const gatewayLauncher = {
      ensureStarted: jest.fn(async () => ({
        enabled: true,
        ready: false,
        running: false,
        pid: null,
        host: '127.0.0.1',
        port: 21128,
        baseUrl: 'http://127.0.0.1:21128/v1',
        upstreamBaseUrl: 'http://127.0.0.1:20128/v1',
        localOnly: true,
        overlayFile: 'C:/repo/config/AIGateway-overlay.json',
        checkedAt: '2026-04-02T12:00:00.000Z',
        message: 'Gateway still booting.',
      })),
    };

    const service = new RemoteTransportDoctorService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      reportFilePath: reportFile,
      fetchImpl: jest.fn(async () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:4100');
      }) as any,
      aiGatewaySidecar: aiGatewaySidecar as any,
      gatewayLauncher: gatewayLauncher as any,
      remoteTransportService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-02T11:59:00.000Z',
          summary: {
            total: 4,
            ready: 2,
            partial: 1,
            planned: 1,
            disabled: 0,
            live: 2,
            reachable: 1,
            attentionRequired: 2,
            pendingWork: 3,
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
              operatorSummary: 'Discord ready.',
              actionHint: '/channels discord',
              telemetry: {
                updatedAt: '2026-04-02T11:58:00.000Z',
                pendingWork: 0,
                lastError: null,
                statusLine: 'Bridge visible in the remote plan.',
              },
              details: ['Mode: native.'],
              actions: [],
            },
            {
              id: 'AIGateway',
              label: 'AIGateway',
              kind: 'sidecar',
              transport: 'http-sidecar',
              direction: 'bidirectional',
              readiness: 'partial',
              available: false,
              endpoint: 'http://127.0.0.1:4100',
              operatorSummary: 'AIGateway em preparo.',
              actionHint: '/connect AIGateway',
              telemetry: {
                updatedAt: '2026-04-02T11:57:00.000Z',
                pendingWork: 2,
                lastError: 'Health ainda not confirmado.',
                statusLine: 'Sidecar ainda sem health ready.',
              },
              details: ['Endpoint: http://127.0.0.1:4100.'],
              actions: [],
            },
            {
              id: 'omni-zavorth-bridge-remote',
              label: 'Zavorth Bridge Remote',
              kind: 'sidecar',
              transport: 'http-sidecar',
              direction: 'bidirectional',
              readiness: 'disabled',
              available: false,
              endpoint: null,
              operatorSummary: 'Desativado neste host.',
              actionHint: null,
              telemetry: {
                updatedAt: null,
                pendingWork: 0,
                lastError: null,
                statusLine: 'Sidecar desativado.',
              },
              details: [],
              actions: [],
            },
            {
              id: 'node-host',
              label: 'Node host transport',
              kind: 'node-host',
              transport: 'node-mesh-heartbeat',
              direction: 'bidirectional',
              readiness: 'ready',
              available: true,
              endpoint: null,
              operatorSummary: 'Node host ready.',
              actionHint: '/nodeinvoke system.run',
              telemetry: {
                updatedAt: '2026-04-02T11:59:30.000Z',
                pendingWork: 1,
                lastError: null,
                statusLine: 'Node host online.',
              },
              details: ['Online: 1.'],
              actions: [],
            },
          ],
          selected: null,
          suggestedActions: [],
          narrative: {
            headline: 'Zavorth exposes transportes remotos.',
            operatorSummary: 'Resumo remoto.',
          },
        })),
      } as any,
    });

    const report = await service.run();

    expect(report.checkedAt).toBe('2026-04-02T12:00:00.000Z');
    expect(report.status).toBe('failed');
    expect(report.summary).toContain('pending items operacionais');
    expect(report.command).toBe('npm run test:transports:smoke');
    expect(report.items).toHaveLength(4);
    expect(report.items.find((item) => item.transportId === 'discord-transport')).toEqual(
      expect.objectContaining({
        status: 'passed',
        probeStatus: 'skipped',
        probeHttpStatus: null,
      }),
    );
    expect(report.items.find((item) => item.transportId === 'AIGateway')).toEqual(
      expect.objectContaining({
        status: 'failed',
        probeStatus: 'failed',
        probeHttpStatus: null,
      }),
    );
    expect(aiGatewaySidecar.start).toHaveBeenCalled();
    expect(gatewayLauncher.ensureStarted).toHaveBeenCalled();
    expect(report.items.find((item) => item.transportId === 'omni-zavorth-bridge-remote')?.status).toBe('skipped');
    expect(fs.existsSync(reportFile)).toBe(true);
    expect(JSON.parse(fs.readFileSync(reportFile, 'utf8'))).toEqual(expect.objectContaining({
      status: 'failed',
      command: 'npm run test:transports:smoke',
    }));
  });

  it('marks the report as skipped when every transport is disabled', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-remote-transport-doctor-skip-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'remote-transport-doctor-last.json');

    const service = new RemoteTransportDoctorService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      reportFilePath: reportFile,
      remoteTransportService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-02T11:59:00.000Z',
          summary: {
            total: 1,
            ready: 0,
            partial: 0,
            planned: 0,
            disabled: 1,
            live: 0,
            reachable: 0,
            attentionRequired: 0,
            pendingWork: 0,
          },
          entries: [
            {
              id: 'discord-transport',
              label: 'Discord transport',
              kind: 'bridge',
              transport: 'discord-transport',
              direction: 'bidirectional',
              readiness: 'disabled',
              available: false,
              endpoint: null,
              operatorSummary: 'Discord transport desativado neste runtime.',
              actionHint: null,
              telemetry: {
                updatedAt: null,
                pendingWork: 0,
                lastError: null,
                statusLine: 'Bridge desativado.',
              },
              details: [],
              actions: [],
            },
          ],
          selected: null,
          suggestedActions: [],
          narrative: {
            headline: 'Zavorth exposes transportes remotos.',
            operatorSummary: 'Resumo remoto.',
          },
        })),
      } as any,
    });

    const report = await service.run();

    expect(report.status).toBe('skipped');
    expect(report.items[0].status).toBe('skipped');
    expect(report.items[0].recommendedAction).toBeNull();
    expect(fs.existsSync(reportFile)).toBe(true);
  });

  it('skips inactive sidecars when only benign status errors exist', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-remote-transport-doctor-benign-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'remote-transport-doctor-last.json');

    const service = new RemoteTransportDoctorService({
      now: () => new Date('2026-04-02T12:10:00.000Z'),
      reportFilePath: reportFile,
      remoteTransportService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-02T12:09:00.000Z',
          summary: {
            total: 1,
            ready: 0,
            partial: 1,
            planned: 0,
            disabled: 0,
            live: 0,
            reachable: 0,
            attentionRequired: 1,
            pendingWork: 0,
          },
          entries: [
            {
              id: 'AIGateway',
              label: 'AIGateway',
              kind: 'sidecar',
              transport: 'http-sidecar',
              direction: 'bidirectional',
              readiness: 'partial',
              available: false,
              endpoint: 'http://127.0.0.1:21128/v1',
              operatorSummary: 'AIGateway existe localmente, mas ainda not confirmou health ready.',
              actionHint: '/connect AIGateway',
              telemetry: {
                updatedAt: '2026-04-02T12:08:30.000Z',
                pendingWork: 0,
                lastError: 'Failure ao encamyr request ao AIGateway upstream: fetch failed',
                statusLine: 'Sidecar ainda sem health ready.',
              },
              details: ['Sem PID active.'],
              actions: [],
            },
          ],
          selected: null,
          suggestedActions: [],
          narrative: {
            headline: 'Zavorth exposes transportes remotos.',
            operatorSummary: 'Resumo remoto.',
          },
        })),
      } as any,
    });

    const report = await service.run();

    expect(report.status).toBe('skipped');
    expect(report.items[0]).toEqual(expect.objectContaining({
      status: 'skipped',
      probeStatus: 'skipped',
    }));
    expect(fs.existsSync(reportFile)).toBe(true);
  });

  it('uses an active endpoint probe when the transport declares an http endpoint', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-remote-transport-doctor-probe-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'remote-transport-doctor-last.json');
    const fetchImpl = jest.fn(async () => ({
      status: 200,
    })) as any;

    const service = new RemoteTransportDoctorService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      reportFilePath: reportFile,
      fetchImpl,
      remoteTransportService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-02T11:59:00.000Z',
          summary: {
            total: 1,
            ready: 1,
            partial: 0,
            planned: 0,
            disabled: 0,
            live: 1,
            reachable: 1,
            attentionRequired: 0,
            pendingWork: 0,
          },
          entries: [
            {
              id: 'AIGateway',
              label: 'AIGateway',
              kind: 'sidecar',
              transport: 'http-sidecar',
              direction: 'bidirectional',
              readiness: 'ready',
              available: true,
              endpoint: 'http://127.0.0.1:4100/health',
              operatorSummary: 'AIGateway ready.',
              actionHint: '/connect AIGateway',
              telemetry: {
                updatedAt: '2026-04-02T11:57:00.000Z',
                pendingWork: 0,
                lastError: null,
                statusLine: 'Sidecar com health ready.',
              },
              details: ['Endpoint: http://127.0.0.1:4100/health.'],
              actions: [],
            },
          ],
          selected: null,
          suggestedActions: [],
          narrative: {
            headline: 'Zavorth exposes transportes remotos.',
            operatorSummary: 'Resumo remoto.',
          },
        })),
      } as any,
    });

    const report = await service.run();

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:4100/health',
      expect.objectContaining({
        method: 'GET',
      }),
    );
    expect(report.status).toBe('passed');
    expect(report.items[0]).toEqual(
      expect.objectContaining({
        transportId: 'AIGateway',
        status: 'passed',
        probeStatus: 'passed',
        probeHttpStatus: 200,
      }),
    );
  });

  it('starts the AIGateway stack on demand before re-running the endpoint probe', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-remote-transport-doctor-autostart-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'remote-transport-doctor-last.json');
    const fetchImpl = jest
      .fn()
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:21128'))
      .mockResolvedValueOnce({ status: 200 }) as any;
    const aiGatewaySidecar = {
      start: jest.fn(async () => ({
        ready: true,
        message: 'AIGateway sidecar started.',
      })),
    };
    const gatewayLauncher = {
      ensureStarted: jest.fn(async () => ({
        enabled: true,
        ready: true,
        running: true,
        pid: 1234,
        host: '127.0.0.1',
        port: 21128,
        baseUrl: 'http://127.0.0.1:21128/v1',
        upstreamBaseUrl: 'http://127.0.0.1:20128/v1',
        localOnly: true,
        overlayFile: 'C:/repo/config/AIGateway-overlay.json',
        checkedAt: '2026-04-02T12:00:00.000Z',
        message: 'Gateway started.',
      })),
    };

    const service = new RemoteTransportDoctorService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      reportFilePath: reportFile,
      fetchImpl,
      aiGatewaySidecar: aiGatewaySidecar as any,
      gatewayLauncher: gatewayLauncher as any,
      remoteTransportService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-02T11:59:00.000Z',
          summary: {
            total: 1,
            ready: 1,
            partial: 0,
            planned: 0,
            disabled: 0,
            live: 1,
            reachable: 0,
            attentionRequired: 0,
            pendingWork: 0,
          },
          entries: [
            {
              id: 'AIGateway',
              label: 'AIGateway',
              kind: 'sidecar',
              transport: 'http-sidecar',
              direction: 'bidirectional',
              readiness: 'ready',
              available: true,
              endpoint: 'http://127.0.0.1:21128/v1/models',
              operatorSummary: 'AIGateway ready on paper.',
              actionHint: '/connect AIGateway',
              telemetry: {
                updatedAt: '2026-04-02T11:57:00.000Z',
                pendingWork: 0,
                lastError: null,
                statusLine: 'Gateway persisted as ready.',
              },
              details: [],
              actions: [],
            },
          ],
          selected: null,
          suggestedActions: [],
          narrative: {
            headline: 'Zavorth exposes transportes remotos.',
            operatorSummary: 'Resumo remoto.',
          },
        })),
      } as any,
    });

    const report = await service.run();

    expect(aiGatewaySidecar.start).toHaveBeenCalled();
    expect(gatewayLauncher.ensureStarted).toHaveBeenCalled();
    expect(report.status).toBe('passed');
    expect(report.items[0].details).toEqual(expect.arrayContaining([
      'AIGateway sidecar started.',
      'Gateway started.',
    ]));
  });

  it('reads the last persisted report scoped to a selected transport', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-remote-transport-doctor-read-'));
    tempDirs.push(root);
    const reportFile = path.join(root, 'remote-transport-doctor-last.json');

    const service = new RemoteTransportDoctorService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      reportFilePath: reportFile,
      remoteTransportService: {
        buildSnapshot: jest.fn(() => ({
          generatedAt: '2026-04-02T11:59:00.000Z',
          summary: {
            total: 2,
            ready: 1,
            partial: 1,
            planned: 0,
            disabled: 0,
            live: 1,
            reachable: 1,
            attentionRequired: 1,
            pendingWork: 0,
          },
          entries: [
            {
              id: 'AIGateway',
              label: 'AIGateway',
              kind: 'sidecar',
              transport: 'http-sidecar',
              direction: 'bidirectional',
              readiness: 'ready',
              available: true,
              endpoint: 'http://127.0.0.1:4100/health',
              operatorSummary: 'AIGateway ready.',
              actionHint: '/connect AIGateway',
              telemetry: {
                updatedAt: '2026-04-02T11:57:00.000Z',
                pendingWork: 0,
                lastError: null,
                statusLine: 'Sidecar com health ready.',
              },
              details: ['Endpoint: http://127.0.0.1:4100/health.'],
              actions: [],
            },
            {
              id: 'node-host',
              label: 'Node host transport',
              kind: 'node-host',
              transport: 'node-mesh-heartbeat',
              direction: 'bidirectional',
              readiness: 'partial',
              available: false,
              endpoint: null,
              operatorSummary: 'Node waiting for heartbeat.',
              actionHint: '/nodepair headless',
              telemetry: {
                updatedAt: '2026-04-02T11:58:00.000Z',
                pendingWork: 0,
                lastError: 'Heartbeat missing.',
                statusLine: 'Node offline waiting for heartbeat.',
              },
              details: ['Pareados: 1.'],
              actions: [],
            },
          ],
          selected: null,
          suggestedActions: [],
          narrative: {
            headline: 'Zavorth exposes transportes remotos.',
            operatorSummary: 'Resumo remoto.',
          },
        })),
      } as any,
      fetchImpl: jest.fn(async () => ({
        status: 200,
      })) as any,
    });

    await service.run();
    const filtered = service.readLastReport({ selectedId: 'AIGateway' });

    expect(filtered).toEqual(
      expect.objectContaining({
        status: 'passed',
        items: [
          expect.objectContaining({
            transportId: 'AIGateway',
          }),
        ],
      }),
    );
  });
});
