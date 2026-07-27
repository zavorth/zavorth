import { ZavorthRolloutReadinessControlPlaneService } from '../../src/services/ZavorthRolloutReadinessControlPlaneService.js';

const NOW = '2026-04-12T22:00:00.000Z';
const WORKSPACE = 'C:\\TESTES DEV\\zavorth-core\\Zavorth';

function healthyQa(overrides: Record<string, any> = {}) {
  return {
    generatedAt: '2026-04-12T21:45:00.000Z',
    profile: 'beta',
    summary: {
      posture: 'healthy',
      healthy: 6,
      attention: 0,
      critical: 0,
      releaseReady: true,
    },
    narrative: {
      operatorSummary: 'QA ready.',
      nextAction: 'Release ready.',
    },
    ...overrides,
  };
}

function distributedRuntime(overrides: Record<string, any> = {}) {
  return {
    generatedAt: '2026-04-12T21:46:00.000Z',
    summary: {
      posture: 'healthy',
      readyChannels: 6,
      totalChannels: 6,
      onlineNodes: 2,
      readyTransports: 3,
    },
    narrative: {
      operatorSummary: 'Runtime ready.',
      nextAction: 'Runtime ready.',
    },
    entries: [{ id: 'full-node-snapshot' }],
    ...overrides,
  };
}

function runtimeStability(overrides: Record<string, any> = {}) {
  return {
    generatedAt: '2026-04-12T21:47:00.000Z',
    summary: {
      posture: 'healthy',
    },
    gate: {
      status: 'passed',
      canProceedToRollout: true,
    },
    narrative: {
      operatorSummary: 'Runtime Stability passed.',
      nextAction: 'Stability ready.',
    },
    ...overrides,
  };
}

function keepalive(overrides: Record<string, any> = {}) {
  return {
    ok: true,
    updatedAt: '2026-04-12T21:55:00.000Z',
    intervalMs: 60000,
    nodeHostId: 'node-host-1',
    notes: [],
    stale: false,
    summary: {
      total: 3,
      ready: 3,
      unhealthy: 0,
      restarts: 0,
    },
    processes: [],
    ...overrides,
  };
}

function createService(overrides: Record<string, any> = {}) {
  const publishEntries = overrides.publishEntries ?? [
    {
      releaseId: 'rel-2',
      publishedAt: '2026-04-12T21:50:00.000Z',
      branch: 'main',
      commit: 'abc123',
      archive: { id: 'archive-2' },
    },
    { releaseId: 'rel-1', publishedAt: '2026-04-11T21:50:00.000Z' },
  ];
  const publishSummaries = overrides.publishSummaries ?? [
    { releaseId: 'rel-2', comparisonToPrevious: { changed: true } },
  ];
  const maintenance = Object.prototype.hasOwnProperty.call(overrides, 'maintenance')
    ? overrides.maintenance
    : {
      startedAt: '2026-04-12T21:00:00.000Z',
      finishedAt: '2026-04-12T21:40:00.000Z',
      status: 'completed',
    };
  const runtimeStabilityControlPlaneService = overrides.runtimeStabilityControlPlaneService || {
    buildSnapshot: jest.fn(() => runtimeStability(overrides.runtimeStability)),
  };

  const service = new ZavorthRolloutReadinessControlPlaneService({
    now: () => new Date(NOW),
    workspaceRoot: WORKSPACE,
    qaControlPlaneService: {
      buildSnapshot: jest.fn(() => healthyQa(overrides.qa)),
    } as any,
    distributedRuntimeControlPlaneService: {
      buildSnapshot: jest.fn(() => distributedRuntime(overrides.distributedRuntime)),
    } as any,
    runtimeStabilityControlPlaneService: runtimeStabilityControlPlaneService as any,
    evalControlPlaneService: {
      buildSnapshot: jest.fn(() => overrides.evals ?? { regressions: [] }),
    } as any,
    keepaliveStatusService: {
      readSnapshot: jest.fn(() => keepalive(overrides.keepalive)),
    } as any,
    publishHistoryService: {
      readHistory: jest.fn(() => publishEntries),
      summarize: jest.fn(() => publishSummaries),
    } as any,
    existsSync: jest.fn(() => maintenance !== null) as any,
    readFileSync: jest.fn(() => JSON.stringify(maintenance)) as any,
  });

  return { service, runtimeStabilityControlPlaneService };
}

describe('ZavorthRolloutReadinessControlPlaneService', () => {
  it('combines QA, stability, distributed runtime, maintenance and publish history into one rollout snapshot', async () => {
    const { service } = createService();

    const snapshot = await service.buildSnapshot({ profile: 'beta', scope: 'production' });

    expect(snapshot.generatedAt).toBe(NOW);
    expect(snapshot.profile).toBe('beta');
    expect(snapshot.summary.scope).toBe('production');
    expect(snapshot.summary.posture).toBe('healthy');
    expect(snapshot.summary.releaseReady).toBe(true);
    expect(snapshot.summary.gateStatus).toBe('passed');
    expect(snapshot.gate.canProceed).toBe(true);
    expect(snapshot.gate.evidence?.map((entry) => entry.id)).toContain('runtime-stability');
    expect(snapshot.cards.map((entry) => entry.id)).toEqual([
      'qa',
      'stability',
      'distributed',
      'maintenance',
      'publish',
    ]);
    expect(snapshot.summary.publishEntries).toBe(2);
    expect(await service.renderReport({ profile: 'beta', scope: 'production' })).toContain('Gate production: passed');
  });

  it('keeps local rollout usable when environment signals are warnings or critical', async () => {
    const { service } = createService({
      distributedRuntime: {
        summary: {
          posture: 'critical',
          readyChannels: 0,
          totalChannels: 6,
          onlineNodes: 0,
          readyTransports: 0,
        },
      },
      runtimeStability: {
        summary: { posture: 'attention' },
        gate: { status: 'warning', canProceedToRollout: false },
      },
      keepalive: { ok: false },
      maintenance: null,
      publishEntries: [],
      publishSummaries: [],
    });

    const snapshot = await service.buildSnapshot({ scope: 'local' });

    expect(snapshot.summary.posture).toBe('critical');
    expect(snapshot.summary.gateStatus).toBe('warning');
    expect(snapshot.gate.canProceed).toBe(true);
    expect(snapshot.gate.blockers).toEqual([]);
    expect(snapshot.gate.warnings).toEqual(expect.arrayContaining([
      'Runtime distribuido esta em postura critica.',
      'Runtime Stability Gate not esta passed.',
      'Backup/maintenance/restore recente missing ou vencido.',
      'Historico de publish limpo/recente missing.',
    ]));
  });

  it('blocks production rollout when required evidence is missing or stale', async () => {
    const { service } = createService({
      distributedRuntime: {
        summary: {
          posture: 'critical',
          readyChannels: 0,
          totalChannels: 6,
          onlineNodes: 0,
          readyTransports: 0,
        },
      },
      runtimeStability: {
        summary: { posture: 'attention' },
        gate: { status: 'warning', canProceedToRollout: false },
      },
      keepalive: { ok: false },
      maintenance: null,
      publishEntries: [],
      publishSummaries: [],
    });

    const snapshot = await service.buildSnapshot({ scope: 'production' });

    expect(snapshot.summary.gateStatus).toBe('failed');
    expect(snapshot.gate.canProceed).toBe(false);
    expect(snapshot.gate.blockers).toEqual(expect.arrayContaining([
      'Runtime distribuido esta em postura critica.',
      'Runtime Stability Gate needs estar passed para production.',
      'Backup/maintenance/restore recente missing ou vencido.',
      'Historico de publish limpo/recente missing.',
      'Keepalive supervisionado not esta active.',
    ]));
  });

  it('passes refresh through to the runtime stability gate', async () => {
    const runtimeStabilityControlPlaneService = {
      buildSnapshot: jest.fn(() => runtimeStability()),
    };
    const { service } = createService({ runtimeStabilityControlPlaneService });

    await service.buildSnapshot();
    await service.buildSnapshot({ refresh: true });

    expect(runtimeStabilityControlPlaneService.buildSnapshot).toHaveBeenNthCalledWith(1, { deepDoctor: false });
    expect(runtimeStabilityControlPlaneService.buildSnapshot).toHaveBeenNthCalledWith(2, { deepDoctor: true });
  });

  it('compacts source snapshots by default and can expose full sources on demand', async () => {
    const { service } = createService();

    const compact = await service.buildSnapshot();
    const full = await service.buildSnapshot({ includeSources: true });

    expect(compact.sourceSnapshots.distributedRuntime.entries).toBeUndefined();
    expect(full.sourceSnapshots.distributedRuntime.entries).toEqual([{ id: 'full-node-snapshot' }]);
  });
});
