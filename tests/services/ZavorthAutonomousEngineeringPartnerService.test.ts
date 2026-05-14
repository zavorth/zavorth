import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthAutonomousEngineeringPartnerService } from '../../src/services/ZavorthAutonomousEngineeringPartnerService';

function mutationPlaneMock() {
  const plans: any[] = [];
  return {
    plans,
    createPlan: jest.fn((input: any) => {
      const plan = {
        id: `partner-plan-${plans.length + 1}`,
        domain: input.domain,
        actionId: input.actionId,
        title: input.title,
        summary: input.summary,
        status: input.approvalRequired ? 'waiting_approval' : 'draft',
        riskLevel: input.riskLevel,
        approval: {
          required: input.approvalRequired,
          status: input.approvalRequired ? 'pending' : 'not_required',
          permissionId: null,
          reason: input.approvalReason,
          defaultScope: 'once',
          availableScopes: ['once', 'session', 'host'],
        },
        resourceImpact: input.resourceImpact,
        readinessGates: input.readinessGates,
        validationPlan: input.validationPlan,
        rollbackPlan: input.rollbackPlan,
        payload: input.payload,
        audit: [],
      };
      plans.unshift(plan);
      return plan;
    }),
    listPlans: jest.fn(() => plans),
    readPlan: jest.fn((planId: string) => plans.find((entry) => entry.id === planId) || null),
    approvePlan: jest.fn((planId: string, approval: any) => {
      const plan = plans.find((entry) => entry.id === planId);
      if (!plan) {
        throw new Error('missing plan');
      }
      plan.status = 'approved';
      plan.approval = {
        ...plan.approval,
        status: 'approved',
        approvedBy: approval.approvedBy,
      };
      return plan;
    }),
    attachApproval: jest.fn((planId: string, approval: any) => {
      const plan = plans.find((entry) => entry.id === planId);
      if (!plan) {
        throw new Error('missing plan');
      }
      plan.approval = {
        ...plan.approval,
        permissionId: approval.permissionId,
        status: approval.status,
        reason: approval.reason,
      };
      return plan;
    }),
    markApplied: jest.fn((planId: string, summary: string, appliedActions: string[]) => {
      const plan = plans.find((entry) => entry.id === planId);
      if (!plan) {
        throw new Error('missing plan');
      }
      plan.status = 'applied';
      plan.audit.push({ event: 'plan.applied', summary, appliedActions });
      return plan;
    }),
    markBlocked: jest.fn((planId: string, reason: string) => {
      const plan = plans.find((entry) => entry.id === planId);
      if (!plan) {
        throw new Error('missing plan');
      }
      plan.status = 'blocked';
      plan.audit.push({ event: 'plan.blocked', message: reason });
      return plan;
    }),
  };
}

function snapshotService(snapshot: any) {
  return {
    buildSnapshot: jest.fn(async () => snapshot),
  };
}

function sourceSnapshots(overrides: Record<string, any> = {}) {
  return {
    rolloutReadinessService: snapshotService(overrides.rollout || {
      summary: { posture: 'healthy', gateStatus: 'passed', canProceed: true },
      narrative: { operatorSummary: 'Rollout local liberado.' },
    }),
    sandboxControlPlaneService: snapshotService(overrides.sandbox || {
      summary: { posture: 'healthy', untrustedExecutionReady: true },
      narrative: { operatorSummary: 'Sandbox forte disponivel.' },
    }),
    federatedMeshService: snapshotService(overrides.federatedMesh || {
      summary: { posture: 'attention', infrastructureState: 'dormant' },
      narrative: { operatorSummary: 'Mesh dormente com fallback local.' },
    }),
    canvasWorkspaceService: snapshotService(overrides.canvas || {
      summary: { posture: 'healthy', entities: 4 },
      narrative: { operatorSummary: 'Canvas projetado sem sidecars.' },
    }),
    automationControlPlaneService: snapshotService(overrides.automation || {
      summary: { posture: 'healthy', coreSchedulerDormant: true },
      narrative: { operatorSummary: 'Automations em control plane.' },
    }),
    evalControlPlaneService: snapshotService(overrides.evals || {
      summary: { posture: 'healthy', regressions: 0 },
      regressionGate: { canProceed: true, rolloutBlocked: false },
      narrative: { operatorSummary: 'Regression gate passou.' },
    }),
    replayLearningService: snapshotService(overrides.replayLearning || {
      summary: { posture: 'healthy', heavyRuntimesStarted: false },
      narrative: { operatorSummary: 'Replay learning suggest-only.' },
    }),
    skillEvolutionService: snapshotService(overrides.skillEvolution || {
      summary: { posture: 'healthy', heavyRuntimesStarted: false },
      actions: ['skills:evolve -- --preview --intent "<pedido>"'],
    }),
    hardwareActionPlaneService: snapshotService(overrides.hardware || {
      summary: { posture: 'healthy', emergencyStopActive: false, heavyRuntimesStarted: false },
      narrative: { operatorSummary: 'Hardware action plane seguro.' },
    }),
  };
}

function buildService(root: string, overrides: Record<string, any> = {}) {
  const mutationPlane = overrides.mutationPlane || mutationPlaneMock();
  const trustDecision = overrides.trustDecision || {
    evaluate: jest.fn(async () => ({
      generatedAt: '2026-04-24T15:00:00.000Z',
      decision: 'requires_approval',
      ok: false,
      reason: 'Missao supervisionada exige approval.',
      permission: { permission_id: 'perm-partner-1', status: 'pending' },
      profile: 'ops',
      capabilityId: 'autonomous-partner.supervised',
      recommendedScope: 'session',
    })),
  };
  const policyLedger = overrides.policyLedger || {
    append: jest.fn((entry: any) => entry),
    summarize: jest.fn(() => ({ total: 0 })),
  };
  const service = new ZavorthAutonomousEngineeringPartnerService({
    now: () => new Date('2026-04-24T15:00:00.000Z'),
    workspaceRoot: root,
    stateFile: path.join(root, 'missions.json'),
    ...sourceSnapshots(overrides.sources || {}),
    mutationPlaneService: mutationPlane as any,
    trustDecisionService: trustDecision as any,
    policyLedgerService: policyLedger as any,
  });
  return { service, mutationPlane, trustDecision, policyLedger };
}

describe('ZavorthAutonomousEngineeringPartnerService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-partner-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('projects mission control without starting heavy runtimes', async () => {
    const { service } = buildService(root);

    const snapshot = await service.buildSnapshot();

    expect(snapshot.summary.heavyRuntimesStarted).toBe(false);
    expect(snapshot.summary.coreIdle).toBe(true);
    expect(snapshot.policy.directExecutionOnRead).toBe(false);
    expect(snapshot.autonomyLevels.map((entry) => entry.id)).toEqual([
      'assist',
      'draft',
      'supervised',
      'delegated',
      'autonomous-with-budget',
    ]);
    expect(snapshot.sourceHealth).toHaveLength(9);
  });

  it('delegates supervised mutable missions with budget, checkpoints and approval', async () => {
    const { service, mutationPlane, trustDecision, policyLedger } = buildService(root);

    const delegated = await service.delegateMission({
      objective: 'corrigir bug de deploy, aplicar patch e validar testes',
      autonomyLevel: 'supervised',
      riskLevel: 'medium',
      mutable: true,
      requestedBy: 'tester',
      successCriteria: ['teste passa', 'diff revisado'],
      budget: {
        maxActions: 12,
        maxMutableActions: 3,
        maxDurationMs: 600_000,
      },
    });

    expect(delegated.status).toBe('waiting_approval');
    expect(delegated.mission).toEqual(expect.objectContaining({
      autonomyLevel: 'supervised',
      status: 'waiting_approval',
      successCriteria: ['teste passa', 'diff revisado'],
      budget: expect.objectContaining({
        maxActions: 12,
        maxMutableActions: 3,
      }),
    }));
    expect(delegated.mission.checkpoints.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'rollout-readiness',
      'sandbox-envelope',
      'eval-regression-gate',
      'canvas-review',
      'final-evidence-pack',
    ]));
    expect(delegated.mutationPlan).toEqual(expect.objectContaining({
      domain: 'autonomous-partner',
      actionId: 'mission.delegate',
      status: 'waiting_approval',
      approval: expect.objectContaining({
        permissionId: 'perm-partner-1',
      }),
    }));
    expect(mutationPlane.createPlan).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'autonomous-partner',
      approvalRequired: true,
      readinessGates: expect.arrayContaining([
        expect.objectContaining({
          id: 'autonomous-mission-readiness',
          canProceed: true,
        }),
      ]),
    }));
    expect(trustDecision.evaluate).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'autonomous-partner',
      actionId: 'mission.delegate',
      capabilityId: 'autonomous-partner.supervised',
    }));
    expect(policyLedger.append).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'autonomous-partner',
      status: 'previewed',
      planId: 'partner-plan-1',
    }));
  });

  it('approves missions and tracks progress evidence inside budget', async () => {
    const { service } = buildService(root);
    const delegated = await service.delegateMission({
      objective: 'corrigir bug de testes',
      autonomyLevel: 'supervised',
      mutable: true,
    });

    const approved = await service.approveMission({
      missionId: delegated.mission.id,
      approvedBy: 'tester',
    });
    const progress = await service.recordProgress({
      missionId: delegated.mission.id,
      actions: 2,
      mutableActions: 1,
      durationMs: 1000,
      evidence: {
        kind: 'test',
        status: 'passed',
        summary: 'jest passou',
        ref: 'tests/services/foo.test.ts',
      },
    });

    expect(approved.status).toBe('running');
    expect(progress.status).toBe('running');
    expect(progress.ok).toBe(true);
    expect(progress.mission?.usage).toEqual(expect.objectContaining({
      actions: 2,
      mutableActions: 1,
      durationMs: 1000,
    }));
    expect(progress.mission?.evidence[0]).toEqual(expect.objectContaining({
      kind: 'test',
      status: 'passed',
      summary: 'jest passou',
    }));
  });

  it('pauses missions automatically when budget or failures are exceeded', async () => {
    const { service } = buildService(root);
    const delegated = await service.delegateMission({
      objective: 'aplicar patch pequeno',
      autonomyLevel: 'autonomous-with-budget',
      mutable: true,
      budget: {
        maxActions: 2,
        maxMutableActions: 1,
        pauseOnFailureCount: 2,
      },
    });
    await service.approveMission({ missionId: delegated.mission.id, approvedBy: 'tester' });

    const progress = await service.recordProgress({
      missionId: delegated.mission.id,
      actions: 3,
      mutableActions: 2,
      failures: 2,
      summary: 'tentativas excederam budget',
    });

    expect(progress.status).toBe('paused');
    expect(progress.ok).toBe(false);
    expect(progress.blockers.join(' ')).toContain('Budget de actions excedido');
    expect(progress.mission?.pauseReason).toContain('Budget de actions excedido');
    expect(progress.snapshot.summary.pausedMissions).toBe(1);
  });

  it('blocks missions when required rollout gates cannot proceed', async () => {
    const { service, mutationPlane } = buildService(root, {
      sources: {
        rollout: {
          summary: { posture: 'critical', gateStatus: 'blocked', canProceed: false },
          narrative: { operatorSummary: 'Rollout bloqueado por regressao.' },
        },
      },
    });

    const delegated = await service.delegateMission({
      objective: 'deploy production com rollback',
      autonomyLevel: 'delegated',
      riskLevel: 'high',
      mutable: true,
    });

    expect(delegated.status).toBe('blocked');
    expect(delegated.ok).toBe(false);
    expect(delegated.readinessGate.canProceed).toBe(false);
    expect(delegated.readinessGate.blockers.join(' ')).toContain('Rollout readiness');
    expect(mutationPlane.markBlocked).toHaveBeenCalledWith('partner-plan-1', expect.stringContaining('Rollout readiness'));
  });

  it('completes missions with tests, diffs, logs and rollback evidence', async () => {
    const { service, mutationPlane, policyLedger } = buildService(root);
    const delegated = await service.delegateMission({
      objective: 'corrigir bug e validar release local',
      autonomyLevel: 'supervised',
      mutable: true,
    });
    await service.approveMission({ missionId: delegated.mission.id, approvedBy: 'tester' });
    await service.recordProgress({
      missionId: delegated.mission.id,
      actions: 1,
      evidence: {
        kind: 'diff',
        status: 'passed',
        summary: 'Patch revisado',
        ref: 'src/foo.ts',
      },
    });

    const completed = await service.completeMission({
      missionId: delegated.mission.id,
      summary: 'Missao concluida com QA local.',
      tests: ['npm run runtime:check'],
      diffs: ['src/foo.ts'],
      logs: ['qa:phase passou'],
      rollbackAvailable: true,
      rollbackPlan: ['reverter patch src/foo.ts'],
    });

    expect(completed.status).toBe('completed');
    expect(completed.ok).toBe(true);
    expect(completed.mission?.result).toEqual(expect.objectContaining({
      summary: 'Missao concluida com QA local.',
      tests: ['npm run runtime:check'],
      diffs: ['src/foo.ts'],
      logs: ['qa:phase passou'],
      rollbackAvailable: true,
      rollbackPlan: ['reverter patch src/foo.ts'],
    }));
    expect(mutationPlane.markApplied).toHaveBeenCalledWith('partner-plan-1', 'Missao concluida com QA local.', ['mission.complete']);
    expect(policyLedger.append).toHaveBeenLastCalledWith(expect.objectContaining({
      domain: 'autonomous-partner',
      status: 'applied',
      planId: 'partner-plan-1',
    }));
  });
});
