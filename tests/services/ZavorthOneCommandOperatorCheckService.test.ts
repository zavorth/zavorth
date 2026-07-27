import { ZavorthOneCommandOperatorCheckService } from '../../src/services/ZavorthOneCommandOperatorCheckService.js';

describe('ZavorthOneCommandOperatorCheckService', () => {
  it('aggregates the operator surfaces into one safe verdict', async () => {
    const readyToGo = {
      buildSnapshot: jest.fn(async () => readyToGoSnapshot('ready')),
    };
    const service = new ZavorthOneCommandOperatorCheckService({
      now: () => new Date('2026-05-18T12:00:00.000Z'),
      readyToGo,
      dailyUse: {
        buildSnapshot: jest.fn(async () => dailyUseSnapshot('passed')),
      },
      dashboard: {
        buildSnapshot: jest.fn(() => dashboardSnapshot()),
      },
      trust: {
        buildSnapshot: jest.fn(() => trustSnapshot('ready')),
      },
    });

    const snapshot = await service.buildSnapshot({ live: false });
    const text = service.renderCli(snapshot);

    expect(snapshot.contractVersion).toBe('zavorth-one-command-operator-check/1');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.strictPass).toBe(true);
    expect(snapshot.summary.areas).toBe(5);
    expect(snapshot.summary.liveProviderProbeRequested).toBe(false);
    expect(snapshot.areas.map((area) => area.id)).toEqual([
      'ready-to-go',
      'daily-use',
      'dashboard-permissions',
      'trust-approvals',
      'operator-safety',
    ]);
    expect(snapshot.safety).toEqual(expect.objectContaining({
      noPromptExecution: true,
      noToolExecution: true,
      noLiveTransactionExecution: true,
      noRawSecretsSerialized: true,
      dashboardCanExecuteTargetAction: false,
      approvalsRemainGatewayMediated: true,
    }));
    expect(readyToGo.buildSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      refreshProviders: false,
    }));
    expect(text).toContain('Zavorth Operator Check');
    expect(text).toContain('Dashboard Permissions');
  });

  it('reports attention without hiding daily-use friction', async () => {
    const service = new ZavorthOneCommandOperatorCheckService({
      readyToGo: {
        buildSnapshot: jest.fn(async () => readyToGoSnapshot('attention')),
      },
      dailyUse: {
        buildSnapshot: jest.fn(async () => dailyUseSnapshot('attention')),
      },
      dashboard: {
        buildSnapshot: jest.fn(() => dashboardSnapshot()),
      },
      trust: {
        buildSnapshot: jest.fn(() => trustSnapshot('attention')),
      },
    });

    const snapshot = await service.buildSnapshot({ live: true });

    expect(snapshot.status).toBe('attention');
    expect(snapshot.strictPass).toBe(false);
    expect(snapshot.summary.liveProviderProbeRequested).toBe(true);
    expect(snapshot.areas.find((area) => area.id === 'daily-use')?.summary).toContain('need attention');
    expect(snapshot.source.dashboard.permissionPanel.items.map((item) => item.id)).toContain('extreme-mode');
  });

  it('blocks when the dashboard permission boundary is missing', async () => {
    const dashboard = dashboardSnapshot();
    dashboard.permissionPanel.items = dashboard.permissionPanel.items.filter((item) => item.id !== 'revoke');
    const service = new ZavorthOneCommandOperatorCheckService({
      readyToGo: {
        buildSnapshot: jest.fn(async () => readyToGoSnapshot('ready')),
      },
      dailyUse: {
        buildSnapshot: jest.fn(async () => dailyUseSnapshot('passed')),
      },
      dashboard: {
        buildSnapshot: jest.fn(() => dashboard),
      },
      trust: {
        buildSnapshot: jest.fn(() => trustSnapshot('ready')),
      },
    });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.areas.find((area) => area.id === 'dashboard-permissions')?.status).toBe('blocked');
  });

  it('fails closed instead of throwing when an older dashboard projection has no permission panel', async () => {
    const dashboard = dashboardSnapshot();
    delete dashboard.permissionPanel;
    const service = new ZavorthOneCommandOperatorCheckService({
      readyToGo: {
        buildSnapshot: jest.fn(async () => readyToGoSnapshot('ready')),
      },
      dailyUse: {
        buildSnapshot: jest.fn(async () => dailyUseSnapshot('passed')),
      },
      dashboard: {
        buildSnapshot: jest.fn(() => dashboard),
      },
      trust: {
        buildSnapshot: jest.fn(() => trustSnapshot('ready')),
      },
    });

    const snapshot = await service.buildSnapshot();
    const dashboardArea = snapshot.areas.find((area) => area.id === 'dashboard-permissions');

    expect(snapshot.status).toBe('blocked');
    expect(dashboardArea?.status).toBe('blocked');
    expect(dashboardArea?.evidence).toContain('permissionPanel=missing');
  });
});

function readyToGoSnapshot(status: 'ready' | 'attention') {
  const ready = status === 'ready';
  return {
    generatedAt: '2026-05-18T12:00:00.000Z',
    status,
    remoteReady: ready,
    localReady: true,
    actions: {
      primary: ready ? 'Pode usar remoto agora.' : 'Pode usar localmente; revise avisos.',
      fixes: 'zavorth readiness fixes',
    },
    summary: {
      providerDefaultRoutes: 2,
    },
    channels: {
      telegram: ready ? 'ready' : 'attention',
      dashboard: 'ready',
    },
    safety: {
      noRawSecretsSerialized: true,
    },
  } as any;
}

function dailyUseSnapshot(status: 'passed' | 'attention') {
  return {
    generatedAt: '2026-05-18T12:00:00.000Z',
    status,
    summary: {
      scenarios: 5,
      passed: status === 'passed' ? 5 : 4,
      attention: status === 'passed' ? 0 : 1,
      failed: 0,
    },
    findings: status === 'passed' ? []
      : [{
        severity: 'warning',
        summary: 'Skill Curator ainda tem merges destrutivos em preview.',
        nextAction: 'Revisar merges destrutivos separadamente.',
      }],
    safety: {
      simulationOnly: true,
      noFileContentExfiltration: true,
    },
  } as any;
}

function dashboardSnapshot() {
  return {
    generatedAt: '2026-05-18T12:00:00.000Z',
    surface: 'dashboard-experience-home',
    permissionPanel: {
      title: 'permissions',
      defaultPosture: 'Projection-only: botoes abrunder review.',
      items: [
        { id: 'permissions' },
        { id: 'auto-approvals' },
        { id: 'extreme-mode' },
        { id: 'revoke' },
        { id: 'receipts' },
      ],
    },
    safety: {
      dashboardCanExecuteTargetAction: false,
      rawSecretsSerialized: false,
    },
  } as any;
}

function trustSnapshot(status: 'ready' | 'attention') {
  return {
    generatedAt: '2026-05-18T12:00:00.000Z',
    status,
    summary: {
      pendingApprovals: status === 'ready' ? 0 : 1,
      activePersistentPolicies: 0,
      activeBreakGlassPolicies: 0,
    },
    narrative: {
      nextAction: 'zavorth trust',
    },
    safety: {
      criticalRiskCannotBeAutoApproved: true,
      breakGlassRequiresDoubleConfirmation: true,
      receiptsRequired: true,
      rawSecretsSerialized: false,
      naturalLanguageCanRequestApprovalButNotBypass: true,
    },
  } as any;
}
