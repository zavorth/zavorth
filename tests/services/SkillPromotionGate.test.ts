import fs from 'fs';
import os from 'os';
import path from 'path';
import { SkillPromotionGate } from '../../src/services/SkillPromotionGate';
import { ZavorthSkillEvolutionService } from '../../src/services/ZavorthSkillEvolutionService';
import { ZavorthSkillEvolutionRegistryService } from '../../src/services/ZavorthSkillEvolutionRegistryService';
import type { ZavorthCapabilityRunEnvelope } from '../../src/contracts/ZavorthMutationPlaneContract';

function buildEnvelope(): ZavorthCapabilityRunEnvelope {
  return {
    id: 'sandbox-run:skill-promotion-test',
    capabilityId: 'sandbox-execution',
    requestedBy: 'skill-promotion',
    sourceSurface: 'jest',
    mode: 'dry-run',
    trustDecisionId: null,
    budget: {
      cpuCores: 1,
      memoryMb: 512,
      diskMb: 512,
      maxDurationMs: 30000,
      maxNetworkCalls: 0,
      maxFilesystemWrites: 0,
      maxProcesses: 8,
      maxInvocations: 1,
    },
    sandboxProfile: 'process',
    networkPolicy: 'none',
    filesystemPolicy: {
      tempWorkspaceOnly: true,
      hostMountsReadOnly: true,
      deniedHostWrite: true,
      allowlistedMounts: [],
      artifactCollection: 'explicit',
    },
    inputRefs: ['inline:test'],
    outputRefs: [],
    cleanupPlan: {
      killOnTimeout: true,
      removeWorkspace: true,
      removeContainerOrVm: true,
      ttlMs: 86400000,
      notes: [],
    },
    auditId: 'audit:sandbox:skill-promotion-test',
    riskLevel: 'low',
    status: 'ready',
    reasons: ['test envelope'],
  };
}

function mutationPlaneMock() {
  let plan: any = null;
  return {
    get plan() {
      return plan;
    },
    approve() {
      plan = {
        ...plan,
        status: 'approved',
        approval: {
          ...plan.approval,
          status: 'approved',
        },
      };
    },
    createPlan: jest.fn((input: any) => {
      plan = {
        id: 'skill-promotion-plan-1',
        domain: input.domain,
        actionId: input.actionId,
        status: input.approvalRequired ? 'waiting_approval' : 'draft',
        approval: {
          required: input.approvalRequired,
          status: input.approvalRequired ? 'pending' : 'not_required',
          permissionId: null,
          defaultScope: 'once',
          availableScopes: ['once', 'session', 'host'],
          reason: input.approvalReason,
        },
        resourceImpact: input.resourceImpact,
        readinessGates: input.readinessGates,
        retentionPolicy: input.retentionPolicy,
        validationPlan: input.validationPlan,
        rollbackPlan: input.rollbackPlan,
        payload: input.payload,
        riskLevel: input.riskLevel,
      };
      return plan;
    }),
    readPlan: jest.fn(() => plan),
    attachApproval: jest.fn((_planId: string, approval: any) => {
      plan = {
        ...plan,
        approval: {
          ...plan.approval,
          permissionId: approval.permissionId,
          status: approval.status,
          reason: approval.reason,
        },
      };
      return plan;
    }),
    approvePlan: jest.fn((_planId: string, approval: any) => {
      plan = {
        ...plan,
        status: 'approved',
        approval: {
          ...plan.approval,
          status: 'approved',
          permissionId: approval.permissionId || plan.approval.permissionId,
        },
      };
      return plan;
    }),
    rejectPlan: jest.fn((_planId: string, reason: string) => {
      plan = {
        ...plan,
        status: 'blocked',
        approval: {
          ...plan.approval,
          status: 'rejected',
          reason,
        },
      };
      return plan;
    }),
    markApplied: jest.fn((_planId: string, summary: string) => {
      plan = {
        ...plan,
        status: 'applied',
        audit: [{ event: 'plan.applied', message: summary }],
      };
      return plan;
    }),
    markBlocked: jest.fn((_planId: string, reason: string) => {
      plan = {
        ...plan,
        status: 'blocked',
        audit: [{ event: 'plan.blocked', message: reason }],
      };
      return plan;
    }),
  };
}

function buildStack(root: string) {
  const mutationPlane = mutationPlaneMock();
  const policy = {
    version: 1,
    updatedAt: null,
    defaultPolicy: 'deny',
    allowedSourceIds: ['workspace-library'],
    rules: [{
      sourceId: 'workspace-library',
      mode: 'all',
      skillNames: [],
      reason: 'test',
    }],
  };
  const registry = new ZavorthSkillEvolutionRegistryService({
    registryFile: path.join(root, 'runtime', 'registry.json'),
    now: () => new Date('2026-04-19T10:00:00.000Z'),
  });
  const evolution = new ZavorthSkillEvolutionService({
    projectRoot: root,
    draftRoot: path.join(root, 'runtime', 'drafts'),
    targetRoot: path.join(root, 'skill-library'),
    backupRoot: path.join(root, 'runtime', 'backups'),
    registryService: registry,
    mutationPlaneService: mutationPlane as any,
    sandboxControlPlaneService: {
      buildSnapshot: jest.fn(() => ({ envelopePreview: buildEnvelope() })),
    } as any,
    sandboxExecutionService: {
      executeEnvelope: jest.fn(async () => ({
        stdout: 'skill draft validated\n',
        stderr: '',
        exitCode: 0,
        executionTimeMs: 3,
        securityLevel: 'local-jail',
        runtime: 'LocalJailSandboxRuntime',
        envelopeId: 'sandbox-run:skill-promotion-test',
        auditId: 'audit:sandbox:skill-promotion-test',
        sandboxProfile: 'process',
        networkPolicy: 'none',
        artifacts: [],
        cleanup: {
          killOnTimeout: true,
          removeWorkspace: true,
          removeContainerOrVm: true,
          completed: true,
        },
      })),
    } as any,
    trustDecisionService: {
      evaluate: jest.fn(async () => ({
        generatedAt: '2026-04-19T10:00:00.000Z',
        decision: 'requires_approval',
        ok: false,
        reason: 'Skill aprendida exige approval.',
        permission: { permission_id: 'perm-skill-promotion-1', status: 'pending' },
        profile: 'ops',
        capabilityId: 'skill-evolution',
        recommendedScope: 'once',
      })),
    } as any,
    permissionService: {
      getRequest: jest.fn(),
    } as any,
    skillTrustPolicyService: {
      readPolicy: jest.fn(() => policy),
      savePolicy: jest.fn((document: any) => document),
    } as any,
    evalProvider: {
      buildGate: jest.fn(() => ({
        id: 'skill-evolution-regression-gate',
        status: 'passed',
        canProceed: true,
        score: 0.95,
        minScore: 0.8,
        summary: 'Regression gate passou.',
        blockers: [],
        warnings: [],
        evidence: [{ id: 'eval-1', status: 'passed', summary: 'ok' }],
      })),
    },
    now: () => new Date('2026-04-19T10:00:00.000Z'),
  });
  const gate = new SkillPromotionGate({
    now: () => new Date('2026-04-19T10:00:00.000Z'),
    evolutionService: evolution,
    registryService: registry,
    mutationPlaneService: mutationPlane as any,
  });
  return { gate, evolution, registry, mutationPlane };
}

describe('SkillPromotionGate', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-promotion-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('materializes candidate-ready signals into the evolution registry without installing', () => {
    const { gate, registry } = buildStack(root);
    const result = gate.materializeCandidate({
      intentText: 'aprenda validar checklist de release local',
      candidateKind: 'auto-skill',
      runId: 'run-1',
      requestedBy: 'tester',
      sourceSurface: 'agent-run',
    });

    expect(result.status).toBe('materialized');
    expect(result.ok).toBe(true);
    expect(result.silentInstallBlocked).toBe(true);
    expect(result.installed).toBe(false);
    expect(result.candidateId).toBeTruthy();
    expect(result.continuity.receipt?.receiptId).toBeTruthy();
    expect(registry.getRecord(result.candidateId!).status).toBe('draft');
    expect(fs.existsSync(path.join(root, 'skill-library'))).toBe(false);
  });

  it('is idempotent on materialize for the same intent and never installs', () => {
    const { gate, registry } = buildStack(root);
    const first = gate.materializeCandidate({
      intentText: 'aprenda checklist de deploy local',
      candidateKind: 'auto-skill',
      runId: 'run-idem-1',
      requestedBy: 'tester',
      sourceSurface: 'learning-plane',
    });
    const second = gate.materializeCandidate({
      intentText: 'aprenda checklist de deploy local',
      candidateKind: 'auto-skill',
      runId: 'run-idem-2',
      requestedBy: 'tester',
      sourceSurface: 'learning-plane',
    });

    expect(first.candidateId).toBe(second.candidateId);
    expect(first.silentInstallBlocked).toBe(true);
    expect(second.silentInstallBlocked).toBe(true);
    expect(first.installed).toBe(false);
    expect(second.installed).toBe(false);
    expect(registry.getRecord(first.candidateId!)?.status).toBe('draft');
  });

  it('blocks install without approvalId and still emits a receipt', async () => {
    const { gate } = buildStack(root);
    const materialized = gate.materializeCandidate({
      intentText: 'aprenda revisar changelog local',
      candidateKind: 'auto-skill',
      runId: 'run-2',
      requestedBy: 'tester',
    });

    const blocked = await gate.apply({
      candidateId: materialized.candidateId!,
      requestedBy: 'tester',
    });

    expect(blocked.status).toBe('blocked');
    expect(blocked.ok).toBe(false);
    expect(blocked.installed).toBe(false);
    expect(blocked.silentInstallBlocked).toBe(true);
    expect(blocked.summary).toContain('approvalId is required');
    expect(blocked.continuity.receipt?.receiptId).toBeTruthy();
    expect(blocked.continuity.result?.data?.silentInstallBlocked).toBe(true);
  });

  it('previews, installs only with approvalId, and supports rollback', async () => {
    const { gate } = buildStack(root);
    const materialized = gate.materializeCandidate({
      intentText: 'aprenda validar release notes local',
      candidateKind: 'auto-skill',
      runId: 'run-3',
      requestedBy: 'tester',
    });

    const preview = await gate.preview(materialized.candidateId!, {
      requestedBy: 'tester',
      sourceSurface: 'jest',
    });
    expect(preview.status).toBe('waiting_approval');
    expect(preview.mutationPlanId).toBeTruthy();
    expect(preview.installed).toBe(false);

    const installed = await gate.apply({
      candidateId: materialized.candidateId!,
      approvalId: 'approval-skill-1',
      requestedBy: 'tester',
    });

    expect(installed.status).toBe('installed');
    expect(installed.ok).toBe(true);
    expect(installed.installed).toBe(true);
    expect(installed.silentInstallBlocked).toBe(true);
    expect(fs.existsSync(path.join(installed.record!.targetDirPath!, 'SKILL.md'))).toBe(true);

    const rolledBack = gate.rollback({
      candidateId: installed.candidateId!,
      requestedBy: 'tester',
    });
    expect(rolledBack.status).toBe('rolled_back');
    expect(rolledBack.ok).toBe(true);
    expect(fs.existsSync(installed.record!.targetDirPath!)).toBe(false);
    expect(rolledBack.continuity.receipt?.receiptId).toBeTruthy();
  });

  it('rejects a candidate and closes the install path', async () => {
    const { gate, mutationPlane } = buildStack(root);
    const materialized = gate.materializeCandidate({
      intentText: 'aprenda organizar notas de reuniao locais',
      candidateKind: 'auto-skill',
      runId: 'run-4',
      requestedBy: 'tester',
    });
    const preview = await gate.preview(materialized.candidateId!, { requestedBy: 'tester' });
    expect(preview.mutationPlanId).toBeTruthy();

    const rejected = gate.reject(preview.candidateId!, 'Not reusable enough', {
      requestedBy: 'tester',
    });

    expect(rejected.status).toBe('rejected');
    expect(rejected.ok).toBe(true);
    expect(rejected.record?.status).toBe('blocked');
    expect(rejected.continuity.receipt?.receiptId).toBeTruthy();
    expect(mutationPlane.rejectPlan).toHaveBeenCalled();
  });

  it('keeps evolution apply blocked when the plan is not approved', async () => {
    const { gate, evolution } = buildStack(root);
    const materialized = gate.materializeCandidate({
      intentText: 'aprenda montar checklist de QA local',
      candidateKind: 'auto-skill',
      runId: 'run-5',
      requestedBy: 'tester',
    });
    const preview = await gate.preview(materialized.candidateId!, { requestedBy: 'tester' });
    expect(preview.mutationPlanId).toBeTruthy();

    const blocked = await evolution.apply({
      planId: preview.mutationPlanId!,
      requestedBy: 'tester',
    });

    expect(blocked.status).toBe('blocked');
    expect(blocked.ok).toBe(false);
    expect(blocked.summary).toContain('aguarda approval');
    expect(blocked.details).toEqual(expect.arrayContaining([
      expect.stringContaining('silentInstallBlocked'),
    ]));
  });
});
