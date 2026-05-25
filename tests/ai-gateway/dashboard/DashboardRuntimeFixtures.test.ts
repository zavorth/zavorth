import {
  DASHBOARD_COMMAND_CENTER_FIXTURE_IDS,
  buildDashboardDashboardFixture,
  getDashboardDashboardFixture,
  listDashboardDashboardFixtures,
  type DashboardDashboardFixtureId,
} from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/fixtures/dashboardDashboardFixtures.js';

const REQUIRED_FIXTURE_IDS: DashboardDashboardFixtureId[] = [
  'safe-run',
  'awaiting-approval',
  'remote-mesh-mcp-approval',
  'failed-run',
  'artifact-ready',
  'replay-available',
  'policy-blocked',
  'budget-exceeded',
  'auto-subagents',
  'first-run-pending',
  'doctor-degraded',
  'release-preview-ready',
];

describe('DashboardRuntimeFixtures', () => {
  it('freezes the required product scenarios for the Dashboard cockpit', () => {
    expect([...DASHBOARD_COMMAND_CENTER_FIXTURE_IDS]).toEqual(REQUIRED_FIXTURE_IDS);
    expect(listDashboardDashboardFixtures()).toHaveLength(REQUIRED_FIXTURE_IDS.length);
  });

  it.each(REQUIRED_FIXTURE_IDS)('builds a valid view model for fixture %s', (fixtureId) => {
    const fixture = getDashboardDashboardFixture(fixtureId);
    const viewModel = buildDashboardDashboardFixture(fixtureId);

    expect(fixture.id).toBe(fixtureId);
    expect(fixture.label).toEqual(expect.any(String));
    expect(fixture.description).toEqual(expect.any(String));
    expect(viewModel.contractVersion).toBe('dashboard-runtime-contract/v1');
    expect(viewModel.generatedAt).toEqual(expect.any(String));
    expect(viewModel.adapterSource).toEqual(expect.objectContaining({
      label: expect.any(String),
    }));
    expect(viewModel.runtime).toEqual(expect.objectContaining({
      status: expect.any(String),
      currentProviderLabel: expect.any(String),
      currentModelLabel: expect.any(String),
    }));
    expect(viewModel.actions.length).toBeGreaterThan(0);
    expect(JSON.stringify(viewModel).toLowerCase()).not.toContain('lorem ipsum');
  });

  it('models a safe run without approvals or restricted tools', () => {
    const viewModel = buildDashboardDashboardFixture('safe-run');

    expect(viewModel.runtime.status).toBe('ready');
    expect(viewModel.agentRun).toEqual(expect.objectContaining({
      id: 'run-safe-001',
      status: 'completed',
    }));
    expect(viewModel.approvals).toHaveLength(0);
    expect(viewModel.toolExposure).toEqual(expect.objectContaining({
      mode: 'safe',
      tools: [
        expect.objectContaining({
          id: 'read_file',
          risk: 'safe',
          requiresApproval: false,
        }),
      ],
    }));
  });

  it('models automatic subagent delegation as governed telemetry', () => {
    const viewModel = buildDashboardDashboardFixture('auto-subagents');

    expect(viewModel.subagentAutoInvocation).toEqual(expect.objectContaining({
      status: 'auto-selected',
      selectedBy: 'implicit-complexity',
      live: true,
      safety: expect.objectContaining({
        readOnlyOnly: true,
        approvalsRequiredForMutation: true,
      }),
    }));
    expect(viewModel.subagentAutoInvocation?.roles).toEqual(expect.arrayContaining([
      expect.objectContaining({ roleId: 'researcher' }),
      expect.objectContaining({ roleId: 'auditor' }),
    ]));
    expect(JSON.stringify(viewModel.subagentAutoInvocation)).not.toMatch(/sk-[A-Za-z0-9_-]{16,}|AIza[0-9A-Za-z_-]{20,}|ghp_[0-9A-Za-z_]{20,}/);
  });

  it('models a pending approval as a visible blocker and approval action', () => {
    const viewModel = buildDashboardDashboardFixture('awaiting-approval');

    expect(viewModel.runtime.status).toBe('degraded');
    expect(viewModel.agentRun).toEqual(expect.objectContaining({
      status: 'waiting_approval',
    }));
    expect(viewModel.approvals).toEqual([
      expect.objectContaining({
        id: 'approval-write-001',
        status: 'pending',
        risk: 'danger',
        command: 'approve approval-write-001',
      }),
    ]);
    expect(viewModel.runtime.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'pending-approvals',
      }),
    ]));
    expect(viewModel.actions[0]).toEqual(expect.objectContaining({
      id: 'approvals.open',
      group: 'approval',
    }));
  });

  it('models execution failure with blocked health and error logs', () => {
    const viewModel = buildDashboardDashboardFixture('failed-run');

    expect(viewModel.runtime.status).toBe('blocked');
    expect(viewModel.agentRun).toEqual(expect.objectContaining({
      status: 'failed',
    }));
    expect(viewModel.health).toEqual(expect.objectContaining({
      status: 'blocked',
      checks: [
        expect.objectContaining({
          id: 'renderer',
          status: 'blocked',
        }),
      ],
    }));
    expect(viewModel.logs).toEqual([
      expect.objectContaining({
        level: 'error',
        runId: 'run-failed-001',
      }),
    ]);
  });

  it('models artifact and replay states separately', () => {
    const artifactFixture = buildDashboardDashboardFixture('artifact-ready');
    const replayFixture = buildDashboardDashboardFixture('replay-available');

    expect(artifactFixture.artifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'artifact-diff-001',
        kind: 'diff',
        status: 'ready',
      }),
      expect.objectContaining({
        id: 'artifact-plan-001',
        kind: 'plan',
        status: 'ready',
      }),
    ]));
    expect(artifactFixture.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'tool-workspace-diff',
        kind: 'tool',
        status: 'done',
      }),
    ]));
    expect(replayFixture.replay).toEqual(expect.objectContaining({
      id: 'replay-run-001',
      status: 'available',
      eventCount: 7,
      artifactCount: 1,
    }));
  });

  it('models policy and budget gates without pretending execution succeeded', () => {
    const policyFixture = buildDashboardDashboardFixture('policy-blocked');
    const budgetFixture = buildDashboardDashboardFixture('budget-exceeded');

    expect(policyFixture.runtime.status).toBe('blocked');
    expect(policyFixture.agentRun).toEqual(expect.objectContaining({
      status: 'failed',
      summary: 'Execucao bloqueada pela policy de rede.',
    }));
    expect(policyFixture.toolExposure.tools).toEqual([
      expect.objectContaining({
        id: 'web.search',
        requiresApproval: true,
      }),
    ]);
    expect(budgetFixture.runtime.status).toBe('degraded');
    expect(budgetFixture.agentRun).toEqual(expect.objectContaining({
      status: 'queued',
    }));
    expect(budgetFixture.budget).toEqual(expect.objectContaining({
      status: 'exceeded',
      tokenBudget: 10000,
      tokensUsed: 14200,
    }));
  });

  it('models first-run, doctor and release readiness states', () => {
    const firstRun = buildDashboardDashboardFixture('first-run-pending');
    const doctor = buildDashboardDashboardFixture('doctor-degraded');
    const release = buildDashboardDashboardFixture('release-preview-ready');

    expect(firstRun.identity).toEqual(expect.objectContaining({
      firstRunStatus: 'pending',
      summary: 'Falta nome, tom e preferencias iniciais.',
    }));
    expect(firstRun.runtime.status).toBe('degraded');
    expect(doctor.health).toEqual(expect.objectContaining({
      status: 'degraded',
      checks: expect.arrayContaining([
        expect.objectContaining({
          id: 'provider-primary',
          status: 'degraded',
        }),
      ]),
    }));
    expect(doctor.integrations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'provider-primary',
        status: 'degraded',
      }),
    ]));
    expect(release.releaseStatus).toEqual(expect.objectContaining({
      status: 'preview_ready',
      channel: 'preview',
      rollbackAvailable: true,
      version: '2026.04.26-preview',
    }));
  });
});
