import { ZavorthRemoteTransportService } from '../../src/services/ZavorthRemoteTransportService.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('ZavorthRemoteTransportService', () => {
  it('aggregates bridge, sidecars and node host into one transport plane snapshot', () => {
    const service = new ZavorthRemoteTransportService({
      now: () => new Date('2026-04-02T12:00:00.000Z'),
      sidecarStatusService: {
        readSummary: jest.fn(() => ({
          AIGateway: {
            id: 'AIGateway',
            name: 'AIGateway',
            ready: false,
            enabled: true,
            localUrl: 'http://127.0.0.1:4100',
            baseUrl: null,
            endpoint: 'http://127.0.0.1:4100',
            pid: 4120,
            message: 'booting',
          },
          ZavorthTerminal: {
            id: 'omni-zavorth-bridge-remote',
            name: 'Zavorth Bridge Remote',
            ready: false,
            enabled: true,
            localUrl: null,
            baseUrl: null,
            endpoint: null,
            pid: null,
            message: 'booting',
          },
        })),
      } as any,
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 2,
            paired: 1,
            pending: 1,
            online: 1,
            offline: 1,
            invokable: 1,
            capabilities: 3,
          },
          selected: {
            id: 'node-alpha',
            transport: 'node-mesh-heartbeat',
            status: 'online',
            pendingInvocations: 0,
            lastSeenAt: '2026-04-02T11:59:30.000Z',
            nextAction: 'Heartbeat stable; ready to invoke.',
            maintenance: {
              supported: true,
              pending: 0,
              claimed: 0,
              latestStatus: 'completed',
              latestAction: 'repair',
              latestResultSummary: 'Repair completed.',
              recoverKind: null,
            },
          },
        })),
      } as any,
      existsSync: jest.fn(() => true) as any,
      readFileSync: jest.fn(() => JSON.stringify({
        mode: 'bridge',
        enabled: true,
        started: true,
        pendingInbox: 1,
        pendingOutbox: 0,
        updatedAt: '2026-04-02T11:59:00.000Z',
      })) as any,
    });

    const snapshot = service.buildSnapshot({ selectedId: 'node-host' });

    expect(snapshot.generatedAt).toBe('2026-04-02T12:00:00.000Z');
    expect(snapshot.summary.total).toBe(4);
    expect(snapshot.summary.ready).toBe(2);
    expect(snapshot.summary.attentionRequired).toBe(3);
    expect(snapshot.summary.pendingWork).toBe(1);
    expect(snapshot.selected).toEqual(
      expect.objectContaining({
        id: 'node-host',
        readiness: 'ready',
        operatorSummary: expect.stringContaining('invocavel'),
        telemetry: expect.objectContaining({
          pendingWork: 0,
          updatedAt: '2026-04-02T11:59:30.000Z',
          statusLine: expect.stringContaining('repair concluiu com sucesso'),
        }),
        details: expect.arrayContaining([
          expect.stringContaining('Maintenance: repair / completed'),
        ]),
      }),
    );
    expect(snapshot.entries.map((entry) => entry.id)).toEqual([
      'discord-transport',
      'AIGateway',
      'omni-zavorth-bridge-remote',
      'node-host',
    ]);
    expect(snapshot.suggestedActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'AIGateway-prepare',
        }),
      ]),
    );
    expect(snapshot.entries.find((entry) => entry.id === 'discord-transport')?.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'repair',
        }),
      ]),
    );
  });

  it('marks Discord transport as disabled when the capability is dormant in core', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-remote-discord-dormant-'));
    const lifecycleFile = path.join(root, 'capability-lifecycle.json');
    const bridgeStatusFile = path.join(root, 'discord-bridge-status.json');
    fs.writeFileSync(
      lifecycleFile,
      JSON.stringify({
        capabilities: {
          discord: {
            state: 'dormant',
            notes: 'Perfil core not preaquece Discord.',
          },
        },
      }),
      'utf8',
    );
    fs.writeFileSync(
      bridgeStatusFile,
      JSON.stringify({
        mode: 'native',
        enabled: true,
        started: false,
        pendingInbox: 0,
        pendingOutbox: 0,
        updatedAt: '2026-04-02T11:59:00.000Z',
      }),
      'utf8',
    );

    const service = new ZavorthRemoteTransportService({
      capabilityLifecycleStateFile: lifecycleFile,
      bridgeStatusFilePath: bridgeStatusFile,
      discordRequiredOnBoot: false,
      sidecarStatusService: {
        readSummary: jest.fn(() => ({
          AIGateway: {
            id: 'AIGateway',
            name: 'AIGateway',
            ready: true,
            enabled: true,
            localUrl: 'http://127.0.0.1:4100',
            baseUrl: null,
            endpoint: 'http://127.0.0.1:4100',
            pid: 4120,
            message: null,
          },
          ZavorthTerminal: {
            id: 'omni-zavorth-bridge-remote',
            name: 'Zavorth Bridge Remote',
            ready: false,
            enabled: false,
            localUrl: null,
            baseUrl: null,
            endpoint: null,
            pid: null,
            message: null,
          },
        })),
      } as any,
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 0,
            paired: 0,
            pending: 0,
            online: 0,
            offline: 0,
            invokable: 0,
            capabilities: 0,
          },
          selected: null,
        })),
      } as any,
      existsSync: jest.fn((target: string) => target === lifecycleFile || target === bridgeStatusFile) as any,
      readFileSync: jest.fn((target: string) => {
        if (target === lifecycleFile) {
          return fs.readFileSync(lifecycleFile, 'utf8');
        }
        if (target === bridgeStatusFile) {
          return fs.readFileSync(bridgeStatusFile, 'utf8');
        }
        return '';
      }) as any,
    });

    const snapshot = service.buildSnapshot({ selectedId: 'discord-transport' });
    const discord = snapshot.entries.find((entry) => entry.id === 'discord-transport');

    expect(discord).toEqual(
      expect.objectContaining({
        readiness: 'disabled',
        actionHint: '/enable discord',
        operatorSummary: expect.stringContaining('dormente no profile atual'),
      }),
    );

    fs.rmSync(root, { recursive: true, force: true });
  });

  it('keeps ZavorthBridge Remote disabled and out of transport attention when the core profile leaves it dormant', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-remote-zavorth-bridge-dormant-'));
    const lifecycleFile = path.join(root, 'capability-lifecycle.json');
    fs.writeFileSync(
      lifecycleFile,
      JSON.stringify({
        capabilities: {
          discord: {
            state: 'dormant',
            notes: 'Perfil core not preaquece Discord.',
          },
          remote: {
            state: 'dormant',
            notes: 'Perfil core mantem os sidecars remotos dormentes.',
          },
        },
      }),
      'utf8',
    );

    const service = new ZavorthRemoteTransportService({
      capabilityLifecycleStateFile: lifecycleFile,
      sidecarStatusService: {
        readSummary: jest.fn(() => ({
          AIGateway: {
            id: 'AIGateway',
            name: 'AIGateway',
            ready: true,
            enabled: true,
            localUrl: 'http://127.0.0.1:4100',
            baseUrl: null,
            endpoint: 'http://127.0.0.1:4100',
            pid: 4120,
            message: null,
          },
          ZavorthTerminal: {
            id: 'zavorth-terminal',
            name: 'ZavorthBridge Remote',
            ready: false,
            enabled: true,
            running: false,
            localUrl: 'http://127.0.0.1:4747',
            baseUrl: null,
            endpoint: null,
            pid: null,
            message: 'booting',
          },
        })),
      } as any,
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 1,
            paired: 1,
            pending: 0,
            online: 1,
            offline: 0,
            invokable: 1,
            capabilities: 1,
          },
          selected: {
            id: 'node-alpha',
            transport: 'node-mesh-heartbeat',
            status: 'online',
            pendingInvocations: 0,
            lastSeenAt: '2026-04-02T11:59:30.000Z',
            nextAction: 'Heartbeat stable; ready to invoke.',
            maintenance: {
              supported: false,
              pending: 0,
              claimed: 0,
              latestStatus: null,
              latestAction: null,
              latestResultSummary: null,
              recoverKind: null,
            },
          },
        })),
      } as any,
      existsSync: jest.fn((target: string) => target === lifecycleFile) as any,
      readFileSync: jest.fn((target: string) => {
        if (target === lifecycleFile) {
          return fs.readFileSync(lifecycleFile, 'utf8');
        }
        return JSON.stringify({
          mode: 'native',
          enabled: true,
          started: false,
          pendingInbox: 0,
          pendingOutbox: 0,
          updatedAt: '2026-04-02T11:59:00.000Z',
        });
      }) as any,
    });

    const snapshot = service.buildSnapshot();
    const zavorthBridge = snapshot.entries.find((entry) => entry.id === 'zavorth-terminal');

    expect(zavorthBridge).toEqual(
      expect.objectContaining({
        readiness: 'disabled',
        operatorSummary: expect.stringContaining('dormente no profile atual'),
        actionHint: '/enable zavorth-bridge-remote',
        telemetry: expect.objectContaining({
          lastError: null,
          statusLine: expect.stringContaining('dormente pelo lifecycle'),
        }),
      }),
    );
    expect(snapshot.summary.attentionRequired).toBe(0);

    fs.rmSync(root, { recursive: true, force: true });
  });

  it('keeps AIGateway disabled when the core profile leaves remote sidecars dormant by default', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-remote-aigateway-dormant-'));
    const lifecycleFile = path.join(root, 'capability-lifecycle.json');
    fs.writeFileSync(
      lifecycleFile,
      JSON.stringify({
        profile: 'core',
        productMode: 'builder',
        capabilities: {},
      }),
      'utf8',
    );

    const service = new ZavorthRemoteTransportService({
      capabilityLifecycleStateFile: lifecycleFile,
      sidecarStatusService: {
        readSummary: jest.fn(() => ({
          AIGateway: {
            id: 'AIGateway',
            name: 'AIGateway',
            ready: false,
            enabled: true,
            running: true,
            localUrl: 'http://127.0.0.1:21128/v1',
            baseUrl: 'http://127.0.0.1:21128/v1',
            endpoint: 'http://127.0.0.1:21128/v1',
            pid: 13028,
            message: 'Gateway own do AIGateway respondeu ao upstream.',
          },
          ZavorthTerminal: {
            id: 'zavorth-terminal',
            name: 'ZavorthBridge Remote',
            ready: false,
            enabled: true,
            running: false,
            localUrl: 'http://127.0.0.1:4747',
            baseUrl: null,
            endpoint: null,
            pid: null,
            message: 'booting',
          },
        })),
      } as any,
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          summary: {
            total: 0,
            paired: 0,
            pending: 0,
            online: 0,
            offline: 0,
            invokable: 0,
            capabilities: 0,
          },
          selected: null,
        })),
      } as any,
      existsSync: jest.fn((target: string) => target === lifecycleFile) as any,
      readFileSync: jest.fn((target: string) => {
        if (target === lifecycleFile) {
          return fs.readFileSync(lifecycleFile, 'utf8');
        }
        return JSON.stringify({
          mode: 'native',
          enabled: false,
          started: false,
          pendingInbox: 0,
          pendingOutbox: 0,
          updatedAt: '2026-04-02T11:59:00.000Z',
        });
      }) as any,
    });

    const snapshot = service.buildSnapshot({ selectedId: 'AIGateway' });
    const aiGateway = snapshot.entries.find((entry) => entry.id === 'AIGateway');

    expect(aiGateway).toEqual(
      expect.objectContaining({
        readiness: 'disabled',
        actionHint: '/connect AIGateway',
        operatorSummary: expect.stringContaining('dormente no profile atual'),
        telemetry: expect.objectContaining({
          lastError: null,
          statusLine: expect.stringContaining('dormente pelo lifecycle'),
        }),
      }),
    );
    expect(snapshot.summary.attentionRequired).toBe(0);

    fs.rmSync(root, { recursive: true, force: true });
  });
});
