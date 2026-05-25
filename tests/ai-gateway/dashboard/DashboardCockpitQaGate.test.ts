import {
  buildDashboardDashboardFixture,
  type DashboardDashboardFixtureId,
} from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/fixtures/dashboardDashboardFixtures.js';

type CockpitRequirement = {
  id: string;
  fixtureId: DashboardDashboardFixtureId;
  assert: () => void;
};

describe('DashboardCockpitQaGate', () => {
  const safeRun = buildDashboardDashboardFixture('safe-run');
  const approval = buildDashboardDashboardFixture('awaiting-approval');
  const failedRun = buildDashboardDashboardFixture('failed-run');
  const artifact = buildDashboardDashboardFixture('artifact-ready');
  const replay = buildDashboardDashboardFixture('replay-available');
  const policy = buildDashboardDashboardFixture('policy-blocked');
  const budget = buildDashboardDashboardFixture('budget-exceeded');
  const firstRun = buildDashboardDashboardFixture('first-run-pending');
  const doctor = buildDashboardDashboardFixture('doctor-degraded');
  const release = buildDashboardDashboardFixture('release-preview-ready');

  const requirements: CockpitRequirement[] = [
    {
      id: 'run',
      fixtureId: 'safe-run',
      assert: () => {
        expect(safeRun.agentRun).toEqual(expect.objectContaining({
          id: 'run-safe-001',
          status: 'completed',
        }));
        expect(safeRun.messages.length).toBeGreaterThanOrEqual(2);
        expect(safeRun.runtime.status).toBe('ready');
      },
    },
    {
      id: 'approval',
      fixtureId: 'awaiting-approval',
      assert: () => {
        expect(approval.agentRun).toEqual(expect.objectContaining({
          status: 'waiting_approval',
        }));
        expect(approval.approvals).toEqual([
          expect.objectContaining({
            status: 'pending',
            risk: 'danger',
          }),
        ]);
        expect(approval.actions[0]).toEqual(expect.objectContaining({
          id: 'approvals.open',
        }));
      },
    },
    {
      id: 'artifact',
      fixtureId: 'artifact-ready',
      assert: () => {
        expect(artifact.artifacts).toEqual(expect.arrayContaining([
          expect.objectContaining({
            id: 'artifact-diff-001',
            kind: 'diff',
            status: 'ready',
          }),
        ]));
        expect(artifact.counts.artifacts).toBeGreaterThan(0);
      },
    },
    {
      id: 'replay',
      fixtureId: 'replay-available',
      assert: () => {
        expect(replay.replay).toEqual(expect.objectContaining({
          status: 'available',
          eventCount: 7,
          artifactCount: 1,
        }));
      },
    },
    {
      id: 'health',
      fixtureId: 'doctor-degraded',
      assert: () => {
        expect(doctor.runtime.status).toBe('degraded');
        expect(doctor.health.checks).toEqual(expect.arrayContaining([
          expect.objectContaining({
            id: 'provider-primary',
            status: 'degraded',
          }),
        ]));
      },
    },
    {
      id: 'identity',
      fixtureId: 'first-run-pending',
      assert: () => {
        expect(firstRun.identity).toEqual(expect.objectContaining({
          agentName: 'Zavorth',
          firstRunStatus: 'pending',
        }));
        expect(firstRun.emptyState.subtitle).toContain('bloqueios');
      },
    },
    {
      id: 'release',
      fixtureId: 'release-preview-ready',
      assert: () => {
        expect(release.releaseStatus).toEqual(expect.objectContaining({
          status: 'preview_ready',
          channel: 'preview',
          rollbackAvailable: true,
        }));
      },
    },
    {
      id: 'budget',
      fixtureId: 'budget-exceeded',
      assert: () => {
        expect(budget.budget).toEqual(expect.objectContaining({
          status: 'exceeded',
          tokenBudget: 10000,
          tokensUsed: 14200,
        }));
        expect(budget.agentRun).toEqual(expect.objectContaining({
          status: 'queued',
        }));
      },
    },
    {
      id: 'policy',
      fixtureId: 'policy-blocked',
      assert: () => {
        expect(policy.runtime.status).toBe('blocked');
        expect(policy.health.checks).toEqual(expect.arrayContaining([
          expect.objectContaining({
            id: 'network-policy',
            status: 'blocked',
          }),
        ]));
        expect(policy.toolExposure.tools).toEqual([
          expect.objectContaining({
            id: 'web.search',
            requiresApproval: true,
          }),
        ]);
      },
    },
    {
      id: 'failure',
      fixtureId: 'failed-run',
      assert: () => {
        expect(failedRun.agentRun).toEqual(expect.objectContaining({
          status: 'failed',
        }));
        expect(failedRun.logs).toEqual([
          expect.objectContaining({
            level: 'error',
          }),
        ]);
      },
    },
  ];

  it('covers all required cockpit dimensions with real runtime contract fixtures', () => {
    const covered = new Set(requirements.map((requirement) => requirement.id));

    expect([...covered].sort()).toEqual([
      'approval',
      'artifact',
      'budget',
      'failure',
      'health',
      'identity',
      'policy',
      'release',
      'replay',
      'run',
    ]);

    requirements.forEach((requirement) => requirement.assert());
  });

  it('keeps the cockpit gate honest: no fixture may pass through as fake demo text', () => {
    const payload = JSON.stringify([
      safeRun,
      approval,
      failedRun,
      artifact,
      replay,
      policy,
      budget,
      firstRun,
      doctor,
      release,
    ]).toLowerCase();

    expect(payload).not.toContain('lorem ipsum');
    expect(payload).not.toContain('fake dashboard');
    expect(payload).not.toContain('demo metric');
    expect(payload).not.toContain('mock response');
  });

  it('documents which fixture satisfies each cockpit requirement', () => {
    expect(requirements.map((requirement) => ({
      id: requirement.id,
      fixtureId: requirement.fixtureId,
    }))).toEqual([
      { id: 'run', fixtureId: 'safe-run' },
      { id: 'approval', fixtureId: 'awaiting-approval' },
      { id: 'artifact', fixtureId: 'artifact-ready' },
      { id: 'replay', fixtureId: 'replay-available' },
      { id: 'health', fixtureId: 'doctor-degraded' },
      { id: 'identity', fixtureId: 'first-run-pending' },
      { id: 'release', fixtureId: 'release-preview-ready' },
      { id: 'budget', fixtureId: 'budget-exceeded' },
      { id: 'policy', fixtureId: 'policy-blocked' },
      { id: 'failure', fixtureId: 'failed-run' },
    ]);
  });
});
