import { ZavorthSelfHealControlPlaneService } from '../../src/services/ZavorthSelfHealControlPlaneService';

function createHealthSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    generatedAt: '2026-04-24T16:00:00.000Z',
    sidecars: {
      AIGateway: {
        id: 'AIGateway',
        name: 'AIGateway',
        enabled: false,
        running: false,
        ready: false,
        message: 'desabilitado por configuracao',
      },
      ZavorthTerminal: {
        id: 'zavorth-terminal',
        name: 'Zavorth Terminal',
        enabled: false,
        running: false,
        ready: false,
        message: 'desabilitado por configuracao',
      },
    },
    remoteTransportDoctor: {
      status: 'passed',
      summary: 'Transportes remotos dormentes ou saudaveis.',
      items: [],
    },
    channelProviderDoctor: {
      status: 'passed',
      items: [],
    },
    publish: {
      smokeTest: 'passed',
      gitPush: 'passed',
      recommendedAction: null,
    },
    storage: {
      freePercent: 80,
      hotspots: [],
    },
    errors: {
      lastError: null,
      recent: [],
    },
    ...overrides,
  };
}

describe('ZavorthSelfHealControlPlaneService', () => {
  it('builds a preview plan without executing autorepair', async () => {
    const run = jest.fn();
    const service = new ZavorthSelfHealControlPlaneService({
      now: () => new Date('2026-04-24T16:00:00.000Z'),
      operationsHealthService: {
        readSnapshotFast: jest.fn(() => createHealthSnapshot({
          sidecars: {
            AIGateway: {
              id: 'AIGateway',
              name: 'AIGateway',
              enabled: true,
              running: false,
              ready: false,
              message: 'AIGateway ainda nao iniciou nesta sessao.',
            },
          },
        }) as any),
        readSnapshotLive: jest.fn(),
      },
      autoRepairService: {
        readLastReport: jest.fn(() => null),
        summarizeLastRun: jest.fn(() => 'sem autorepair anterior'),
        run,
      } as any,
    });

    const snapshot = await service.buildPreview();

    expect(snapshot.phase).toBe('30');
    expect(snapshot.surface).toBe('self-heal-control-plane');
    expect(snapshot.mode).toBe('preview');
    expect(snapshot.plan).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          flowId: 'sidecar_down',
          command: expect.stringContaining('ops autorepair dryrun'),
        }),
      ]),
    );
    expect(snapshot.contracts.previewDoesNotExecute).toBe(true);
    expect(run).not.toHaveBeenCalled();
  });

  it('blocks sensitive apply actions and keeps them in the outbox', async () => {
    const run = jest.fn();
    const service = new ZavorthSelfHealControlPlaneService({
      now: () => new Date('2026-04-24T16:00:00.000Z'),
      operationsHealthService: {
        readSnapshotFast: jest.fn(() => createHealthSnapshot({
          publish: {
            smokeTest: 'failed',
            gitPush: 'passed',
            recommendedAction: 'rollback recomendado',
          },
        }) as any),
        readSnapshotLive: jest.fn(),
      },
      autoRepairService: {
        readLastReport: jest.fn(() => null),
        summarizeLastRun: jest.fn(() => 'sem autorepair anterior'),
        run,
      } as any,
    });

    const snapshot = await service.buildPreview({ apply: true, requestedBy: 'tester' });

    expect(snapshot.mode).toBe('apply');
    expect(snapshot.status).toBe('blocked');
    expect(snapshot.execution.attempted).toBe(false);
    expect(snapshot.outbox).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          approvalRequired: true,
          flowId: 'publish_failed',
        }),
      ]),
    );
    expect(snapshot.contracts.applyRespectsTrustPolicy).toBe(true);
    expect(run).not.toHaveBeenCalled();
  });

  it('returns daily report with top failures, pending items and proposed actions', async () => {
    const service = new ZavorthSelfHealControlPlaneService({
      now: () => new Date('2026-04-24T16:00:00.000Z'),
      operationsHealthService: {
        readSnapshotFast: jest.fn(() => createHealthSnapshot({
          errors: {
            lastError: {
              category: 'artifact',
              message: 'artifact delivery failed for task-1',
            },
            recent: [],
          },
        }) as any),
        readSnapshotLive: jest.fn(),
      },
    });

    const snapshot = await service.buildDailyReport();

    expect(snapshot.mode).toBe('daily-report');
    expect(snapshot.dailyReport.topFailures[0]).toContain('Entrega de artefatos');
    expect(snapshot.dailyReport.proposedActions[0]).toContain('Revalidar entrega');
    expect(snapshot.dailyReport.pendingItems.length).toBeGreaterThan(0);
  });

  it('pauses repeated failed recovery instead of looping', async () => {
    const service = new ZavorthSelfHealControlPlaneService({
      now: () => new Date('2026-04-24T16:00:00.000Z'),
      operationsHealthService: {
        readSnapshotFast: jest.fn(() => createHealthSnapshot({
          errors: {
            lastError: {
              category: 'runtime',
              message: 'runtime timeout slow loop',
            },
            recent: [],
          },
        }) as any),
        readSnapshotLive: jest.fn(),
      },
      autoRepairService: {
        readLastReport: jest.fn(() => ({
          status: 'failed',
          attempts: [
            { status: 'failed' },
            { status: 'failed' },
          ],
          warnings: ['repeated failure'],
        })),
        summarizeLastRun: jest.fn(() => 'falhas repetidas'),
        run: jest.fn(),
      } as any,
    });

    const snapshot = await service.buildPreview({ apply: true });

    expect(snapshot.status).toBe('paused');
    expect(snapshot.repetitionGuard.paused).toBe(true);
    expect(snapshot.contracts.repeatedFailuresPause).toBe(true);
  });

  it('standardizes broken remote executor recovery before asking for help', async () => {
    const service = new ZavorthSelfHealControlPlaneService({
      now: () => new Date('2026-04-24T16:00:00.000Z'),
      operationsHealthService: {
        readSnapshotFast: jest.fn(() => createHealthSnapshot({
          remoteTransportDoctor: {
            status: 'failed',
            summary: 'Executor remoto perdeu sessao.',
            items: [
              {
                transportId: 'node-host',
                status: 'failed',
                error: 'session lost',
              },
            ],
          },
        }) as any),
        readSnapshotLive: jest.fn(),
      },
    });

    const snapshot = await service.buildPreview();
    const action = snapshot.plan.find((entry) => entry.flowId === 'remote_executor_session_lost');

    expect(action?.command).toContain('ops autorepair dryrun');
    expect(snapshot.contracts.brokenExecutorAttemptsStandardRecovery).toBe(true);
  });
});
