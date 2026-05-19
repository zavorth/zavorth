import { ZavorthReadyToGoService } from '../../src/services/ZavorthReadyToGoService.js';
import type { ZavorthRuntimeReadinessSnapshot } from '../../src/services/ZavorthRuntimeReadinessService.js';

describe('ZavorthReadyToGoService', () => {
  it('builds a provider-agnostic remote-ready verdict from active provider and fallbacks', async () => {
    const providerReadiness = {
      buildSnapshot: jest.fn(() => providerSnapshot()),
      buildLiveSnapshot: jest.fn(async () => providerSnapshot()),
    };
    const service = new ZavorthReadyToGoService({
      now: () => new Date('2026-05-16T12:00:00.000Z'),
      runtimeReadiness: {
        buildSnapshot: jest.fn(async () => readinessSnapshot('ready')),
      },
      providerReadiness,
      guidedFixes: {
        buildSnapshot: jest.fn(() => ({ fixes: [] })),
      },
    });

    const snapshot = await service.buildSnapshot({ refreshProviders: true });
    const text = service.renderCli(snapshot);

    expect(providerReadiness.buildLiveSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      live: true,
      allowAllLive: true,
    }));
    expect(snapshot.contractVersion).toBe('zavorth-ready-to-go/1');
    expect(snapshot.remoteReady).toBe(true);
    expect(snapshot.status).toBe('ready');
    expect(snapshot.provider.activeProvider).toBe('openai');
    expect(snapshot.provider.lanes.map((lane) => lane.id)).toEqual(['openai', 'deepseek', 'qwen']);
    expect(snapshot.provider.lanes[0]).toEqual(expect.objectContaining({
      role: 'active',
      defaultRouteAllowed: true,
    }));
    expect(snapshot.safety).toEqual(expect.objectContaining({
      noPromptExecution: true,
      noToolExecution: true,
      noLiveTransactionExecution: true,
      noRawSecretsSerialized: true,
    }));
    expect(text).toContain('Pode sair do PC');
    expect(text).toContain('Zavorth Ready To Go');
  });

  it('supports offline mode without refreshing providers', async () => {
    const providerReadiness = {
      buildSnapshot: jest.fn(() => providerSnapshot()),
      buildLiveSnapshot: jest.fn(async () => providerSnapshot()),
    };
    const service = new ZavorthReadyToGoService({
      runtimeReadiness: {
        buildSnapshot: jest.fn(async () => readinessSnapshot('ready')),
      },
      providerReadiness,
      guidedFixes: {
        buildSnapshot: jest.fn(() => ({ fixes: [] })),
      },
    });

    const snapshot = await service.buildSnapshot({ refreshProviders: false });

    expect(providerReadiness.buildSnapshot).toHaveBeenCalled();
    expect(providerReadiness.buildLiveSnapshot).not.toHaveBeenCalled();
    expect(snapshot.provider.liveNetworkUsed).toBe(false);
  });

  it('keeps remote use in attention when Telegram is not ready', async () => {
    const service = new ZavorthReadyToGoService({
      runtimeReadiness: {
        buildSnapshot: jest.fn(async () => readinessSnapshot('attention')),
      },
      providerReadiness: {
        buildSnapshot: jest.fn(() => providerSnapshot()),
        buildLiveSnapshot: jest.fn(async () => providerSnapshot()),
      },
      guidedFixes: {
        buildSnapshot: jest.fn(() => ({
          fixes: [
            {
              id: 'fix-telegram',
              status: 'attention',
              label: 'Guiar conexao do Telegram',
              command: 'zavorth connectors doctor telegram',
            },
          ],
        })),
      },
    });

    const snapshot = await service.buildSnapshot({ refreshProviders: false });

    expect(snapshot.localReady).toBe(true);
    expect(snapshot.remoteReady).toBe(false);
    expect(snapshot.status).toBe('attention');
    expect(snapshot.guidedFixes[0]).toEqual(expect.objectContaining({
      id: 'fix-telegram',
    }));
  });
});

function readinessSnapshot(status: 'ready' | 'attention'): ZavorthRuntimeReadinessSnapshot {
  const telegramStatus = status === 'ready' ? 'ready' : 'attention';
  return {
    contractVersion: 'zavorth-runtime-readiness/1',
    schemaVersion: 1,
    surface: 'runtime-readiness',
    generatedAt: '2026-05-16T12:00:00.000Z',
    status,
    dailyUseReady: true,
    summary: {
      ready: status === 'ready' ? 8 : 7,
      attention: status === 'ready' ? 0 : 1,
      blocked: 0,
      requiredBlocked: 0,
      providerOk: true,
      dashboardOk: true,
      telegramOk: telegramStatus === 'ready',
      approvalsOk: true,
      transactionPlaneSafe: true,
      skillsBlockedByDefault: true,
      memoryReady: true,
      naturalFirstReady: true,
    },
    checks: [
      check('provider-mesh', 'Provider Mesh', 'ready', false),
      check('dashboard', 'Dashboard', 'ready', true),
      check('telegram', 'Telegram', telegramStatus, false),
      check('approvals', 'Approvals', 'ready', true),
    ],
    operator: {
      primaryCommand: 'zavorth readiness',
      jsonCommand: 'zavorth readiness --json',
      dailyCommand: 'zavorth daily',
      dashboardRoute: '/dashboard',
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
    nextAction: 'next',
  };
}

function check(id: any, label: string, status: 'ready' | 'attention', required: boolean) {
  return {
    id,
    label,
    status,
    required,
    summary: label,
    evidence: [],
    command: 'zavorth readiness',
    nextAction: 'next',
  };
}

function providerSnapshot() {
  return {
    contractVersion: '2026-05-14.checkpoint-3-live-completion',
    schemaVersion: 1,
    surface: 'provider-readiness-matrix',
    generatedAt: '2026-05-16T12:00:00.000Z',
    status: 'ready',
    activeProvider: 'openai',
    activeModel: 'gpt-test',
    summary: {
      defaultRouteAllowed: 2,
      liveReady: 2,
      liveFailed: 0,
    },
    entries: [
      providerEntry('openai', 'gpt-test', true),
      providerEntry('deepseek', 'deepseek-test', true),
      providerEntry('qwen', 'qwen-test', false, 'failed'),
    ],
  } as any;
}

function providerEntry(id: string, model: string, allowed: boolean, probeStatus = 'passed') {
  return {
    id,
    label: id,
    providerName: id,
    providerId: id,
    familyIds: [id],
    status: 'ready',
    liveReady: allowed,
    defaultRouteAllowed: allowed,
    readinessProof: allowed ? 'live_probe' : 'catalog',
    defaultBlockReason: allowed ? null : 'Provider needs live proof.',
    userAction: 'test',
    currentModelName: model,
    probe: {
      status: probeStatus,
      summary: probeStatus === 'failed' ? 'Live probe failed with HTTP 401.' : 'Live probe passed.',
    },
  };
}
