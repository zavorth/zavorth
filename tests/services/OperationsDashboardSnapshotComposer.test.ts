import { OperationsCockpitSnapshotComposer } from '../../src/domain/observability/infrastructure/operations-cockpit/OperationsCockpitSnapshotComposer.js';

describe('OperationsCockpitSnapshotComposer', () => {
  it('preserves the cockpit snapshot shape and healthy narrative', () => {
    const now = new Date('2026-04-17T12:00:00.000Z');
    const composer = new OperationsCockpitSnapshotComposer({ now: () => now });

    const operationsSnapshot = {
      generatedAt: now.toISOString(),
      sidecars: {
        AIGateway: {
          enabled: true,
          ready: true,
          running: true,
          name: 'AI Gateway',
          checkedAt: now.toISOString(),
        },
        ZavorthTerminal: {
          enabled: true,
          ready: true,
          running: true,
          name: 'Zavorth Terminal',
          checkedAt: now.toISOString(),
        },
      },
      docker: {
        required: false,
        canRun: true,
        detail: null,
      },
      publish: {
        available: true,
        publishedAt: now.toISOString(),
      },
      maintenance: {
        available: true,
        completedSteps: 4,
        stepCount: 4,
      },
      maintenanceAutomation: {
        enabled: true,
        lastTriggerSource: null,
        nextPlannedAt: now.toISOString(),
      },
      nodeMeshSmoke: {
        status: 'passed',
        stale: false,
        checkedAt: now.toISOString(),
        recentCapabilityId: 'node-mesh-invoke-01',
      },
      channelProviderDoctor: {
        status: 'passed',
        stale: false,
        checkedAt: now.toISOString(),
        items: [],
      },
      remoteTransportDoctor: {
        status: 'passed',
        stale: false,
        checkedAt: now.toISOString(),
        items: [],
      },
      storage: {
        freePercent: 80,
        rootPath: 'C:/workspace/zavorth/data',
      },
      security: {
        needsAttention: false,
        lastAudit: {
          available: true,
          generatedAt: now.toISOString(),
          totalEvents: 0,
          latestEventType: null,
          latestTaskId: null,
          latestChainHash: null,
        },
        lastPreflight: {
          summary: null,
          generatedAt: null,
        },
      },
      errors: {
        recent: [],
      },
    } as any;

    const stats = {
      uptime_seconds: 7260,
      ram_mb_rss: 256,
      ram_mb_heap: 128,
      cpu_arch: 'x64',
      platform: 'win32',
      timestamp: now.toISOString(),
    };

    const snapshot = composer.composeSnapshot(operationsSnapshot, stats);

    expect(snapshot.generatedAt).toBe(now.toISOString());
    expect(snapshot.status).toBe('healthy');
    expect(snapshot.headline).toBe('Runtime estavel, 2/2 sidecars prontos e nenhum alerta critico.');
    expect(snapshot.summary).toEqual({
      enabledSidecars: 2,
      readySidecars: 2,
      recentErrorCount: 0,
      freeDiskPercent: 80,
      publishAgeLabel: 'agora',
    });
    expect(snapshot.runtime).toEqual({
      uptimeLabel: '2h 1m',
      memoryLabel: '256 MB RSS',
      heapLabel: '128 MB heap',
      platformLabel: 'win32 / x64',
      sampledAt: now.toISOString(),
    });
    expect(snapshot.alerts).toEqual([]);
    expect(snapshot.actions).toEqual([
      {
        id: 'maintenance-keepalive',
        label: 'Manter o host saudavel',
        command: 'npm run ops:maintain',
        reason: 'Fluxo padrao para manter trim, backup e verificacoes em dia.',
        priority: 'normal',
      },
    ]);
    expect(snapshot.highlights).toContain('2/2 sidecars habilitados estao prontos.');
    expect(snapshot.operations).toBe(operationsSnapshot);
  });
});
