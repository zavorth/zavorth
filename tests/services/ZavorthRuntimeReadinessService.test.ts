import { ZavorthRuntimeReadinessService } from '../../src/services/ZavorthRuntimeReadinessService.js';

describe('ZavorthRuntimeReadinessService', () => {
  it('builds one operator readiness snapshot across the daily runtime planes', async () => {
    const service = new ZavorthRuntimeReadinessService({
      now: () => new Date('2026-05-16T12:00:00.000Z'),
      env: {
        TELEGRAM_BOT_TOKEN: 'telegram-token-redacted',
      },
      projectRoot: process.cwd(),
      existsSync: (file) => String(file).endsWith('page.tsx'),
      providerReadiness: {
        buildSnapshot: () => providerSnapshot({ ready: 1, defaultRouteAllowed: 1 }),
      },
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.contractVersion).toBe('zavorth-runtime-readiness/1');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.dailyUseReady).toBe(true);
    expect(snapshot.summary).toEqual(expect.objectContaining({
      providerOk: true,
      dashboardOk: true,
      telegramOk: true,
      approvalsOk: true,
      transactionPlaneSafe: true,
      skillsBlockedByDefault: true,
      memoryReady: true,
      naturalFirstReady: true,
    }));
    expect(snapshot.checks.map((check) => check.id)).toEqual([
      'natural-first-runtime',
      'provider-mesh',
      'dashboard',
      'telegram',
      'approvals',
      'transaction-plane',
      'skill-imports',
      'memory-continuity',
    ]);
    expect(snapshot.safety).toEqual(expect.objectContaining({
      noLiveTransactionExecution: true,
      noHiddenProviderProbe: true,
      noRawSecretsSerialized: true,
      importedSkillsDoNotBypassReview: true,
      dashboardHasNoTargetExecutionAuthority: true,
      approvalsRemainGatewayMediated: true,
    }));
    expect(JSON.stringify(snapshot)).not.toContain('telegram-token-redacted');
  });

  it('keeps Zavorth usable with optional provider or Telegram attention', async () => {
    const service = new ZavorthRuntimeReadinessService({
      now: () => new Date('2026-05-16T12:00:00.000Z'),
      env: {},
      projectRoot: process.cwd(),
      existsSync: (file) => String(file).endsWith('page.tsx'),
      providerReadiness: {
        buildSnapshot: () => providerSnapshot({ ready: 0, defaultRouteAllowed: 0, missingAuth: 1 }),
      },
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.status).toBe('attention');
    expect(snapshot.dailyUseReady).toBe(true);
    expect(snapshot.summary.providerOk).toBe(false);
    expect(snapshot.summary.telegramOk).toBe(false);
    expect(snapshot.nextAction).toContain('Zavorth is usable');
  });

  it('blocks unattended use when a required safety contract fails', async () => {
    const service = new ZavorthRuntimeReadinessService({
      now: () => new Date('2026-05-16T12:00:00.000Z'),
      projectRoot: process.cwd(),
      existsSync: () => false,
    });

    const snapshot = await service.buildSnapshot();
    const dashboard = snapshot.checks.find((check) => check.id === 'dashboard');

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.dailyUseReady).toBe(false);
    expect(dashboard?.status).toBe('blocked');
    expect(snapshot.nextAction).toContain('Dashboard');
  });

  it('renders a concise CLI report with the next safe action', async () => {
    const service = new ZavorthRuntimeReadinessService({
      now: () => new Date('2026-05-16T12:00:00.000Z'),
      env: {
        TELEGRAM_BOT_TOKEN: 'telegram-token-redacted',
      },
      projectRoot: process.cwd(),
      existsSync: (file) => String(file).endsWith('page.tsx'),
      providerReadiness: {
        buildSnapshot: () => providerSnapshot({ ready: 1, defaultRouteAllowed: 1 }),
      },
    });

    const text = service.renderText(await service.buildSnapshot());

    expect(text).toContain('[zavorth-runtime-readiness]');
    expect(text).toContain('status=ready');
    expect(text).toContain('primary=zavorth readiness');
    expect(text).toContain('dashboard=/dashboard');
    expect(text).toContain('next=Zavorth is ready for daily use');
  });
});

function providerSnapshot(input: {
  ready: number;
  defaultRouteAllowed: number;
  missingAuth-: number;
}) {
  return {
    contractVersion: '2026-05-14.checkpoint-3-live-completion',
    schemaVersion: 1,
    surface: 'provider-readiness-matrix',
    generatedAt: '2026-05-16T12:00:00.000Z',
    status: input.ready > 0 ? 'ready' : 'attention',
    activeProvider: input.ready > 0 ? 'openai' : 'none',
    activeModel: input.ready > 0 ? 'gpt-test' : 'none',
    summary: {
      total: 1,
      ready: input.ready,
      livePassed: 0,
      liveFailed: 0,
      liveBlocked: 0,
      liveNotRun: 1,
      liveReady: 0,
      catalogReadyButNotLive: input.ready,
      defaultRouteAllowed: input.defaultRouteAllowed,
      missingAuth: input.missingAuth || 0,
      missingBaseUrl: 0,
      needsProbe: 0,
      degraded: 0,
      unsupported: 0,
      blocked: 0,
    },
    entries: [],
    profiles: [],
    simpleCatalog: {
      fastAndCheap: [],
      higherIntelligence: [],
      localPrivate: [],
      openAiCompatible: [],
    },
    liveCompletion: {
      providerSelectionRequiresLiveProof: true,
      catalogSupportIsNotLiveProof: true,
      liveProbeRequiresExplicitOperatorAction: true,
      rawSecretsSerialized: false,
      publicApiProviderTestEndpoint: '/api/v1/providers/:id/test',
      defaultRoutingPolicy: 'ready-and-live-proof',
      counts: {
        catalogReady: input.ready,
        liveReady: 0,
        catalogReadyButNotLive: input.ready,
        defaultRouteAllowed: input.defaultRouteAllowed,
      },
    },
    commands: [],
    dashboardProjection: {
      route: '/zavorthControl',
      endpoint: '/api/providers/readiness',
      executionAuthority: false,
      canRenderTestButtons: true,
    },
    invariants: [],
    nextAction: input.ready > 0 ? 'Provider ready.' : 'Configure provider credentials.',
  };
}
