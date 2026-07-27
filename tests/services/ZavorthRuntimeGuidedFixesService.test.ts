import { ZavorthRuntimeGuidedFixesService } from '../../src/services/ZavorthRuntimeGuidedFixesService.js';
import type { ZavorthRuntimeReadinessSnapshot } from '../../src/services/ZavorthRuntimeReadinessService.js';

describe('ZavorthRuntimeGuidedFixesService', () => {
  it('turns provider attention into an explicit live-proof fix', () => {
    const service = new ZavorthRuntimeGuidedFixesService({
      providerReadiness: {
        buildSnapshot: () => providerSnapshot(),
      },
    });
    const snapshot = service.buildSnapshot(readinessSnapshot('attention'));
    const cli = service.renderCli(snapshot);

    expect(snapshot.contractVersion).toBe('zavorth-runtime-guided-fixes/1');
    expect(snapshot.surface).toBe('runtime-guided-fixes');
    expect(snapshot.primaryFix).toEqual(expect.objectContaining({
      id: 'fix-provider-live-proof',
      kind: 'provider-live-proof',
      command: 'zavorth readiness fix provider --live-proof --provider gemini',
      executionAuthority: false,
      safeByDefault: true,
    }));
    expect(snapshot.dashboardProjection).toEqual(expect.objectContaining({
      endpoint: '/api/runtime/readiness/fixes',
      executionAuthority: false,
      canExecuteLiveProviderProbe: false,
    }));
    expect(snapshot.telegramProjection.command).toBe('/fixes');
    expect(cli).toContain('Validar provider com prova live');
    expect(cli).not.toContain('defaultRouteAllowed');
    expect(cli).not.toContain('tokenPresent');
  });

  it('renders a ready dashboard fix when nothing is pending', () => {
    const service = new ZavorthRuntimeGuidedFixesService({
      providerReadiness: {
        buildSnapshot: () => providerSnapshot(),
      },
    });
    const snapshot = service.buildSnapshot(readinessSnapshot('ready'));

    expect(snapshot.pending).toBe(0);
    expect(snapshot.primaryFix).toEqual(expect.objectContaining({
      id: 'open-dashboard-ready',
      command: 'zavorth go',
      route: '/zavorthControl',
    }));
  });
});

function readinessSnapshot(status: 'ready' | 'attention'): ZavorthRuntimeReadinessSnapshot {
  const checks = status === 'ready' ? [
      check('provider-mesh', 'Provider Mesh', 'ready', false),
      check('dashboard', 'Dashboard', 'ready', true),
    ]
    : [
      check('provider-mesh', 'Provider Mesh', 'attention', false),
      check('dashboard', 'Dashboard', 'ready', true),
    ];
  return {
    contractVersion: 'zavorth-runtime-readiness/1',
    schemaVersion: 1,
    surface: 'runtime-readiness',
    generatedAt: '2026-05-16T12:00:00.000Z',
    status,
    dailyUseReady: true,
    summary: {
      ready: checks.filter((entry) => entry.status === 'ready').length,
      attention: checks.filter((entry) => entry.status === 'attention').length,
      blocked: 0,
      requiredBlocked: 0,
      providerOk: status === 'ready',
      dashboardOk: true,
      telegramOk: false,
      approvalsOk: true,
      transactionPlaneSafe: true,
      skillsBlockedByDefault: true,
      memoryReady: true,
      naturalFirstReady: true,
    },
    checks,
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
    nextAction: 'next',
  };
}

function check(id: any, label: string, status: 'ready' | 'attention', required: boolean) {
  return {
    id,
    label,
    status,
    required,
    summary: `${label} summary`,
    evidence: [],
    command: 'zavorth readiness',
    nextAction: `${label} next`,
  };
}

function providerSnapshot() {
  return {
    contractVersion: '2026-05-14.checkpoint-3-live-completion',
    schemaVersion: 1,
    surface: 'provider-readiness-matrix',
    generatedAt: '2026-05-16T12:00:00.000Z',
    status: 'ready',
    activeProvider: 'gemini',
    activeModel: 'gemini-test',
    summary: {
      total: 1,
      ready: 1,
      defaultRouteAllowed: 0,
    },
    entries: [
      {
        id: 'gemini',
        status: 'ready',
      },
    ],
  } as any;
}
