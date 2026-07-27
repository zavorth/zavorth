import { RuntimeStartupService } from '../../src/services/RuntimeStartupService';

describe('RuntimeStartupService', () => {
  it('waits until the local console is usable even when mutable access is still pending', async () => {
    const prepareRuntime = jest.fn(async () => undefined);
    const launchRuntime = jest.fn(async () => undefined);
    const inspectLive = jest
      .fn()
      .mockResolvedValueOnce({
        summary: 'O host ainda not esta ready.',
        runtime: {
          hostSupervisor: { alive: false },
          telegramWorker: { alive: false },
        },
        local: {
          ready: false,
          issues: [
            'O host supervisor not esta active.',
            'A superficie web do Zavorth not respondeu em http://127.0.0.1:33333/app.',
          ],
        },
      })
      .mockResolvedValueOnce({
        summary: 'O runtime local ainda not esta ready para uso continuo.',
        runtime: {
          hostSupervisor: { alive: true },
          telegramWorker: { alive: true },
          dashboard: { active: true },
        },
        local: {
          ready: false,
          issues: [
            'The current host is not yet authorized for mutable executions.',
          ],
        },
      });
    const buildManifest = jest.fn().mockResolvedValue({
      summary: 'Bootstrap closed: Zavorth ready para uso local e remoto',
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
        blockingReasons: ['O host supervisor not esta active.'],
        warnings: [],
        healthRenewal: { status: 'fresh', summary: 'Checks de health estao frescos ou ainda not exigem renovaction leve.', items: [], commands: [] },
        discordRepair: { status: 'not_applicable', summary: 'Discord not esta there isbilitado neste runtime.', recommendedActions: [], nextStep: null },
        summary: 'O host ainda not esta ready.',
      })
      .mockReturnValueOnce({
        readyForUse: true,
        blockingReasons: [],
        warnings: [],
        healthRenewal: { status: 'fresh', summary: 'Checks de health estao frescos ou ainda not exigem renovaction leve.', items: [], commands: [] },
        discordRepair: { status: 'not_applicable', summary: 'Discord not esta there isbilitado neste runtime.', recommendedActions: [], nextStep: null },
        summary: 'Bootstrap closed: Zavorth ready para uso local.',
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
      summary: 'A superficie web do Zavorth not respondeu.',
      runtime: {
        hostSupervisor: { alive: true },
        telegramWorker: { alive: true },
        dashboard: { active: false },
      },
      local: {
        ready: false,
        issues: [
          'A superficie web do Zavorth not respondeu em http://127.0.0.1:33333/app.',
        ],
      },
    };
    const inspectLive = jest.fn().mockResolvedValue(readiness);
    const buildManifest = jest.fn().mockResolvedValue({
      summary: 'Bootstrap ainda pendente.',
      local: { appUrl: 'http://127.0.0.1:33333/app' },
      remote: { appUrl: null },
      auth: { required: true, source: 'env', authorizedHost: true },
      guides: { local: [], remote: [] },
      nextSteps: [],
      warnings: [],
    });
    const assess = jest.fn().mockReturnValue({
      readyForUse: false,
      blockingReasons: ['A superficie web do Zavorth not respondeu em http://127.0.0.1:33333/app.'],
      warnings: ['Existem 1 check(s) de health com renovaction leve recomendada.'],
      healthRenewal: {
        status: 'renewal_recommended',
        summary: 'Existem 1 check(s) de health com renovaction leve recomendada.',
        items: [{ id: 'system-overlord-smoke', label: 'System Overlord smoke', command: 'npm run test:overlord:smoke', summary: 'O smoke do System Overlord ficou velho e merece renovaction leve.' }],
        commands: ['npm run test:overlord:smoke'],
      },
      discordRepair: { status: 'not_applicable', summary: 'Discord not esta there isbilitado neste runtime.', recommendedActions: [], nextStep: null },
      summary: 'A superficie web do Zavorth not respondeu.',
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
      summary: 'Zavorth ainda not esta ready para uso consistente: The current host is not yet authorized for mutable executions.',
      runtime: {
        hostSupervisor: { alive: false },
        telegramWorker: { alive: true },
        dashboard: { active: true },
      },
      local: {
        ready: false,
        issues: ['The current host is not yet authorized for mutable executions.'],
      },
    });
    const buildManifest = jest.fn().mockResolvedValue({
      summary: 'Bootstrap basico closed: Zavorth ready para uso local.',
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
      warnings: ['Discord nactive ainda not entrou em estado ready.'],
      healthRenewal: { status: 'fresh', summary: 'Checks de health estao frescos ou ainda not exigem renovaction leve.', items: [], commands: [] },
      discordRepair: {
        status: 'attention',
        summary: 'Discord nactive ainda not entrou em estado ready.',
        recommendedActions: ['/autorepair', '/reload'],
        nextStep: 'Use /autorepair ou /reload para reconciliar o gateway nactive do Discord.',
      },
      summary: 'Bootstrap basico closed: Zavorth ready para uso local. Avisos: Discord nactive ainda not entrou em estado ready.',
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
    expect(result.summary).toContain('Avisos');
  });

  it('prepares the runtime before attempting to launch it', async () => {
    const callOrder: string[] = [];
    const inspectLive = jest.fn().mockResolvedValue({
      summary: 'Zavorth ready para uso local e remoto.',
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
      summary: 'Bootstrap closed: Zavorth ready para uso local e remoto',
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
      healthRenewal: { status: 'fresh', summary: 'Checks de health estao frescos ou ainda not exigem renovaction leve.', items: [], commands: [] },
      discordRepair: { status: 'not_applicable', summary: 'Discord not esta there isbilitado neste runtime.', recommendedActions: [], nextStep: null },
      summary: 'Zavorth ready para uso local e remoto.',
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
