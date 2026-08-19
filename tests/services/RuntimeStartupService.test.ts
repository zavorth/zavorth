import { RuntimeStartupService } from '../../src/services/RuntimeStartupService';

describe('RuntimeStartupService', () => {
  it('waits until the local console is usable even when mutable access is still pending', async () => {
    const prepareRuntime = jest.fn(async () => undefined);
    const launchRuntime = jest.fn(async () => undefined);
    const inspectLive = jest
      .fn()
      .mockResolvedValueOnce({
        summary: 'Host not ready yet.',
        runtime: {
          hostSupervisor: { alive: false },
          telegramWorker: { alive: false },
        },
        local: {
          ready: false,
          issues: [
            'O host supervisor is not active.',
'A Zavorth web surface did not respond at http://127.0.0.1:33333/app.',
          ],
        },
      })
      .mockResolvedValueOnce({
        summary: 'Local runtime not yet ready for continuous use.',
        runtime: {
          hostSupervisor: { alive: true },
          telegramWorker: { alive: true },
          dashboard: { active: true },
        },
        local: {
          ready: false,
          issues: [
            'O current host has not yet been authorized for mutable executions.',
          ],
        },
      });
    const buildManifest = jest.fn().mockResolvedValue({
      summary: 'Bootstrap complete: Zavorth ready for local and remote use',
      local: { appUrl: 'http://127.0.0.1:33333/app' },
      remote: { appUrl: null },
      auth: { required: true, source: 'env', authorizedHost: false },
      guides: { local: [], remote: [] },
      nextSteps: [],
      warnings: [],
    });
    const assess = jest
      .fn()
      .mockReturnValueOnce({
        readyForUse: false,
        blockingReasons: ['The host supervisor is not active.'],
        warnings: [],
        healthRenewal: { status: 'fresh', summary: 'Health checks are fresh or do not yet require light renewal.', items: [], commands: [] },
        discordRepair: { status: 'not_applicable', summary: 'Discord is not enabled in this runtime.', recommendedActions: [], nextStep: null },
        summary: 'Host not ready yet.',
      })
      .mockReturnValueOnce({
        readyForUse: true,
        blockingReasons: [],
        warnings: [],
        healthRenewal: { status: 'fresh', summary: 'Health checks are fresh or do not yet require light renewal.', items: [], commands: [] },
        discordRepair: { status: 'not_applicable', summary: 'Discord is not enabled in this runtime.', recommendedActions: [], nextStep: null },
        summary: 'Bootstrap complete: Zavorth ready for local use.',
      });

    let clock = 0;
    const service = new RuntimeStartupService({
      prepareRuntime,
      launchRuntime,
      readinessService: { inspectLive } as any,
      manifestService: { buildManifest } as any,
      recoveryService: { assess } as any,
      sleep: async () => {
        clock += 2_000;
      },
      now: () => clock,
    });

    const result = await service.startAndWait({
      timeoutMs: 10_000,
      pollIntervalMs: 2_000,
      requireMutableAccess: false,
    });

    expect(result.ok).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.attempts).toBe(2);
    expect(prepareRuntime).toHaveBeenCalledTimes(1);
    expect(launchRuntime).toHaveBeenCalledTimes(1);
    expect(buildManifest).toHaveBeenCalledTimes(1);
    expect(result.bootState.phase).toBe('ready');
    expect(result.healthRenewal.status).toBe('fresh');
  });

  it('times out when the console never becomes reachable', async () => {
    const prepareRuntime = jest.fn(async () => undefined);
    const launchRuntime = jest.fn(async () => undefined);
    const readiness = {
      summary: 'Zavorth web surface did not respond.',
      runtime: {
        hostSupervisor: { alive: true },
        telegramWorker: { alive: true },
        dashboard: { active: false },
      },
      local: {
        ready: false,
        issues: [
          'Zavorth web surface did not respond at http://127.0.0.1:33333/app.',
        ],
      },
    };
    const inspectLive = jest.fn().mockResolvedValue(readiness);
    const buildManifest = jest.fn().mockResolvedValue({
      summary: 'Bootstrap still pending.',
      local: { appUrl: 'http://127.0.0.1:33333/app' },
      remote: { appUrl: null },
      auth: { required: true, source: 'env', authorizedHost: true },
      guides: { local: [], remote: [] },
      nextSteps: [],
      warnings: [],
    });
    const assess = jest.fn().mockReturnValue({
      readyForUse: false,
      blockingReasons: ['Zavorth web surface did not respond at http://127.0.0.1:33333/app.'],
      warnings: ['There are 1 health check(s) with light renewal recommended.'],
      healthRenewal: {
        status: 'renewal_recommended',
        summary: 'There are 1 health check(s) with light renewal recommended.',
        items: [{ id: 'system-overlord-smoke', label: 'System Overlord smoke', command: 'npm run test:overlord:smoke', summary: 'System Overlord smoke became stale and deserves light renewal.' }],
        commands: ['npm run test:overlord:smoke'],
      },
      discordRepair: { status: 'not_applicable', summary: 'Discord is not enabled in this runtime.', recommendedActions: [], nextStep: null },
      summary: 'Zavorth web surface did not respond.',
    });

    let clock = 0;
    const service = new RuntimeStartupService({
      prepareRuntime,
      launchRuntime,
      readinessService: { inspectLive } as any,
      manifestService: { buildManifest } as any,
      recoveryService: { assess } as any,
      sleep: async () => {
        clock += 2_000;
      },
      now: () => clock,
    });

    const result = await service.startAndWait({
      timeoutMs: 4_000,
      pollIntervalMs: 2_000,
      requireMutableAccess: false,
    });

    expect(result.ok).toBe(false);
    expect(result.timedOut).toBe(true);
    expect(result.attempts).toBe(4);
    expect(prepareRuntime).toHaveBeenCalledTimes(1);
    expect(buildManifest).toHaveBeenCalledTimes(1);
    expect(result.bootState.phase).toBe('timed_out');
    expect(result.healthRenewal.status).toBe('renewal_recommended');
  });

  it('accepts a live dashboard on readonly startup even when the host lock is stale', async () => {
    const launchRuntime = jest.fn(async () => undefined);
    const inspectLive = jest.fn().mockResolvedValue({
      summary: 'Zavorth not yet ready for consistent use: Current host not authorized for mutable executions.',
      runtime: {
        hostSupervisor: { alive: false },
        telegramWorker: { alive: true },
        dashboard: { active: true },
      },
      local: {
        ready: false,
        issues: ['Current host not yet authorized for mutable executions.'],
      },
    });
    const buildManifest = jest.fn().mockResolvedValue({
      summary: 'Bootstrap basic complete: Zavorth ready for local use.',
      local: { appUrl: 'http://127.0.0.1:33333/app' },
      remote: { appUrl: null },
      auth: { required: true, source: 'env', authorizedHost: false },
      guides: { local: [], remote: [] },
      nextSteps: [],
      warnings: [],
    });
const assess = jest.fn().mockReturnValue({
      readyForUse: true,
      blockingReasons: [],
      warnings: ['Native Discord has not yet entered ready state.'],
      healthRenewal: { status: 'fresh', summary: 'Health checks are fresh or do not yet require light renewal.', items: [], commands: [] },
      discordRepair: {
        status: 'attention',
        summary: 'Native Discord has not yet entered ready state.',
        recommendedActions: ['/autorepair', '/reload'],
        nextStep: 'Use /autorepair or /reload to reconcile native Discord gateway.',
      },
      summary: 'Bootstrap basic complete: Zavorth ready for local use. Warnings: Native Discord has not yet entered ready state.',
    });

    const service = new RuntimeStartupService({
      launchRuntime,
      readinessService: { inspectLive } as any,
      manifestService: { buildManifest } as any,
      recoveryService: { assess } as any,
      sleep: async () => undefined,
      now: () => 0,
    });

    const result = await service.startAndWait({
      timeoutMs: 10_000,
      pollIntervalMs: 2_000,
      requireMutableAccess: false,
    });

    expect(result.ok).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.attempts).toBe(1);
    expect(result.summary).toContain('Warnings');
  });

  it('prepares the runtime before attempting to launch it', async () => {
    const callOrder: string[] = [];
    const inspectLive = jest.fn().mockResolvedValue({
      summary: 'Zavorth ready for local and remote use.',
      runtime: {
        hostSupervisor: { alive: true },
        telegramWorker: { alive: true },
      },
      local: {
        ready: true,
        issues: [],
      },
    });
    const buildManifest = jest.fn().mockResolvedValue({
      summary: 'Bootstrap complete: Zavorth ready for local and remote use',
      local: { appUrl: 'http://127.0.0.1:33333/app' },
      remote: { appUrl: 'https://example.com/app' },
      auth: { required: true, source: 'env', authorizedHost: true },
      guides: { local: [], remote: [] },
      nextSteps: [],
      warnings: [],
    });
    const assess = jest.fn().mockReturnValue({
      readyForUse: true,
      blockingReasons: [],
      warnings: [],
      healthRenewal: { status: 'fresh', summary: 'Health checks are fresh or do not yet require light renewal.', items: [], commands: [] },
      discordRepair: { status: 'not_applicable', summary: 'Discord is not enabled in this runtime.', recommendedActions: [], nextStep: null },
      summary: 'Zavorth ready for local and remote use.',
    });

    const service = new RuntimeStartupService({
      prepareRuntime: async () => {
        callOrder.push('prepare');
      },
      launchRuntime: async () => {
        callOrder.push('launch');
      },
      readinessService: { inspectLive } as any,
      manifestService: { buildManifest } as any,
      recoveryService: { assess } as any,
      sleep: async () => undefined,
      now: () => 0,
    });

    await service.startAndWait({
      timeoutMs: 10_000,
      pollIntervalMs: 2_000,
      requireMutableAccess: false,
    });

    expect(callOrder).toEqual(['prepare', 'launch']);
  });
});
