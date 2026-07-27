import { ZavorthCliTuiPolishService } from '../../src/services/ZavorthCliTuiPolishService.js';
import type { ZavorthRuntimeReadinessSnapshot } from '../../src/services/ZavorthRuntimeReadinessService.js';

describe('ZavorthCliTuiPolishService', () => {
  it('builds a polished terminal cockpit without hidden execution', async () => {
    const service = new ZavorthCliTuiPolishService({
      now: () => new Date('2026-05-18T09:00:00.000Z'),
      readyToGo: {
        buildSnapshot: jest.fn(async () => readySnapshot()),
      },
      runtimeReadiness: {
        buildSnapshot: jest.fn(async () => readinessSnapshot()),
      },
      guidedFixes: {
        buildSnapshot: jest.fn(() => ({ fixes: [] })),
      },
    });

    const snapshot = await service.buildSnapshot({ refreshProviders: false });
    const text = service.renderCli(snapshot);

    expect(snapshot.contractVersion).toBe('zavorth-cli-tui-polish/1');
    expect(snapshot.surface).toBe('cli-tui-polish');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.mode).toBe('offline');
    expect(snapshot.cards.map((card) => card.id)).toEqual([
      'ready',
      'providers',
      'readiness',
      'approvals',
      'receipts',
      'dashboard',
    ]);
    expect(snapshot.operator).toEqual(expect.objectContaining({
      activeProvider: 'gemini',
      activeModel: 'gemini-test',
      dashboardUrl: '/zavorthControl',
      remoteReady: true,
    }));
    expect(snapshot.providers.map((provider) => provider.id)).toEqual(['gemini', 'openrouter']);
    expect(snapshot.channels.map((channel) => channel.id)).toEqual(['dashboard', 'telegram', 'approvals']);
    expect(snapshot.shortcuts.map((shortcut) => shortcut.key)).toEqual([
      '/ask',
      '/edit',
      '/apply',
      '/model',
      '/ready',
      '/trust',
    ]);
    expect(snapshot.safety).toEqual(expect.objectContaining({
      noPromptExecution: true,
      noDirectPromptExecution: true,
      promptRoutingAvailable: true,
      noToolExecution: true,
      noLiveTransactionExecution: true,
      noRawSecretsSerialized: true,
      liveProviderProbeRequiresRefreshFlag: true,
      cliProjectionCannotApproveOrExecute: true,
    }));
    expect(text).toContain('Zavorth');
    expect(text).toContain('Status');
    expect(text).toContain('Operator');
    expect(text).toContain('Channels');
    expect(text).toContain('Providers');
    expect(text).toContain('Smart commands');
    expect(text).toContain('Approvals');
    expect(text).toContain('Receipts');
    expect(text).toContain('zavorth ask');
    expect(text).toContain('zavorth edit');
    expect(text).toContain('zavorth ready --offline');
    expect(text).toContain('Action mode is available');
  });

  it('marks refreshed mode only when provider refresh is explicit', async () => {
    const readyToGo = {
      buildSnapshot: jest.fn(async () => readySnapshot()),
    };
    const service = new ZavorthCliTuiPolishService({
      readyToGo,
      runtimeReadiness: {
        buildSnapshot: jest.fn(async () => readinessSnapshot()),
      },
      guidedFixes: {
        buildSnapshot: jest.fn(() => ({ fixes: [] })),
      },
    });

    const snapshot = await service.buildSnapshot({ refreshProviders: true });

    expect(snapshot.mode).toBe('refreshed');
    expect(readyToGo.buildSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      refreshProviders: true,
    }));
  });
});

function readySnapshot() {
  return {
    contractVersion: 'zavorth-ready-to-go/1',
    schemaVersion: 1,
    surface: 'zavorth-ready-to-go',
    generatedAt: '2026-05-18T09:00:00.000Z',
    status: 'ready',
    remoteReady: true,
    localReady: true,
    headline: 'You can leave the PC: Zavorth is ready for remote use.',
    summary: {
      runtimeStatus: 'ready',
      runtimeReady: true,
      providerReady: true,
      providerDefaultRoutes: 2,
      providerLiveReady: 2,
      providerLiveFailed: 0,
      telegramReady: true,
      dashboardReady: true,
      approvalsReady: true,
      blockingFixes: 0,
      attentionFixes: 0,
    },
    provider: {
      refreshRequested: false,
      liveNetworkUsed: false,
      activeProvider: 'gemini',
      activeModel: 'gemini-test',
      lanes: [
        lane('gemini', 'active', 'gemini-test'),
        lane('openrouter', 'fallback', 'openrouter-test'),
      ],
      failed: [],
      missingConfiguredProof: [],
    },
    channels: {
      dashboard: 'ready',
      telegram: 'ready',
      approvals: 'ready',
    },
    actions: {
      primary: 'Pode usar remoto agora.',
      dashboard: '/zavorthControl',
      telegram: '/readiness',
      fixes: 'zavorth readiness fixes',
      refreshProviders: 'zavorth ready --refresh-providers',
      offline: 'zavorth ready --offline',
    },
    guidedFixes: [],
    safety: {
      noPromptExecution: true,
      noToolExecution: true,
      noLiveTransactionExecution: true,
      noRawSecretsSerialized: true,
      providerProbeIsExplicitOperatorAction: true,
      approvalsRemainGatewayMediated: true,
    },
    source: {
      readinessGeneratedAt: '2026-05-18T09:00:00.000Z',
      providerGeneratedAt: '2026-05-18T09:00:00.000Z',
    },
  } as any;
}

function lane(id: string, role: 'active' | 'fallback', model: string) {
  return {
    id,
    label: id,
    role,
    status: 'ready',
    liveReady: true,
    defaultRouteAllowed: true,
    proof: 'live_probe',
    model,
    summary: 'Live proof ok.',
  };
}

function readinessSnapshot(): ZavorthRuntimeReadinessSnapshot {
  return {
    contractVersion: 'zavorth-runtime-readiness/1',
    schemaVersion: 1,
    surface: 'runtime-readiness',
    generatedAt: '2026-05-18T09:00:00.000Z',
    status: 'ready',
    dailyUseReady: true,
    summary: {
      ready: 8,
      attention: 0,
      blocked: 0,
      requiredBlocked: 0,
      providerOk: true,
      dashboardOk: true,
      telegramOk: true,
      approvalsOk: true,
      transactionPlaneSafe: true,
      skillsBlockedByDefault: true,
      memoryReady: true,
      naturalFirstReady: true,
    },
    checks: [
      check('provider-mesh'),
      check('dashboard'),
      check('telegram'),
      check('approvals'),
    ],
    operator: {
      primaryCommand: 'zavorth readiness',
      jsonCommand: 'zavorth readiness --json',
      dailyCommand: 'zavorth daily',
      dashboardRoute: '/zavorthControl',
      safeStartupCommand: 'zavorth go',
    },
    safety: {
      noLiveTransactionExecution: true,
      noHiddenProviderProbe: true,
      noRawSecretsSerialized: true,
      importedSkillsDoNotBypassReview: true,
      dashboardHasNoTargetExecutionAuthority: true,
      approvalsRemainGatewayMediated: true,
    },
    nextAction: 'Zavorth is ready for daily use.',
  };
}

function check(id: any) {
  return {
    id,
    label: id,
    status: 'ready',
    required: true,
    summary: id,
    evidence: [],
    command: 'zavorth readiness',
    nextAction: 'next',
  };
}
