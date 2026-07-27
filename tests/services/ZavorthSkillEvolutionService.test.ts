import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthSkillEvolutionService } from '@zavorth/skills/ZavorthSkillEvolutionService.js';
import { ZavorthSkillEvolutionRegistryService } from '../../src/services/ZavorthSkillEvolutionRegistryService';
import type { ZavorthCapabilityRunEnvelope } from '../../src/contracts/ZavorthMutationPlaneContract';

function buildEnvelope(): ZavorthCapabilityRunEnvelope {
  return {
    id: 'sandbox-run:skill-evolution-test',
    capabilityId: 'sandbox-execution',
    requestedBy: 'skill-evolution',
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
    auditId: 'audit:sandbox:skill-evolution-test',
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
        id: 'skill-evolution-plan-1',
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

function buildService(root: string, overrides: Record<string, any> = {}) {
  const mutationPlane = overrides.mutationPlane || mutationPlaneMock();
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
  const service = new ZavorthSkillEvolutionService({
    projectRoot: root,
    draftRoot: path.join(root, 'runtime', 'drafts'),
    targetRoot: path.join(root, 'skill-library'),
    backupRoot: path.join(root, 'runtime', 'backups'),
    registryService: new ZavorthSkillEvolutionRegistryService({
      registryFile: path.join(root, 'runtime', 'registry.json'),
      now: () => new Date('2026-04-19T10:00:00.000Z'),
    }),
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
        envelopeId: 'sandbox-run:skill-evolution-test',
        auditId: 'audit:sandbox:skill-evolution-test',
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
        permission: { permission_id: 'perm-skill-1', status: 'pending' },
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
    evalProvider: overrides.evalProvider || {
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
  return { service, mutationPlane };
}

describe('ZavorthSkillEvolutionService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-skill-evolution-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('turns a natural request into a tested draft without installing it', async () => {
    const { service, mutationPlane } = buildService(root);

    const preview = await service.preview({
      intentText: 'learn to validate local release before publishing',
      demonstration: 'contato do exemplo: owner@example.com',
      requestedBy: 'tester',
      sourceSurface: 'cli',
    });

    expect(preview.status).toBe('waiting_approval');
    expect(preview.ok).toBe(false);
    expect(preview.record.status).toBe('waiting_approval');
    expect(fs.existsSync(preview.record.skillFilePath!)).toBe(true);
    expect(fs.existsSync(path.join(preview.record.draftDirPath, 'EVIDENCE.json'))).toBe(true);
    expect(fs.existsSync(preview.record.targetDirPath!)).toBe(false);
    expect(mutationPlane.createPlan).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'skill-evolution',
      actionId: 'install-learned-skill',
      readinessGates: expect.arrayContaining([
        expect.objectContaining({ id: 'skill-evolution-sandbox', canProceed: true }),
        expect.objectContaining({ id: 'skill-evolution-regression-gate', canProceed: true }),
      ]),
      validationPlan: expect.arrayContaining([
        expect.stringContaining('auto-installation silenciosa'),
      ]),
      payload: expect.objectContaining({
        draftId: preview.record.id,
        installMode: 'trusted_local',
        redaction: expect.objectContaining({
          rawIntentPersisted: false,
        }),
      }),
    }));
    expect(JSON.stringify(mutationPlane.createPlan.mock.calls[0][0].payload)).not.toContain('owner@example.com');
  });

  it('blocks high-risk or domain-specific tasks from becoming automatic skills', async () => {
    const { service, mutationPlane } = buildService(root);

    const preview = await service.preview({
      intentText: 'aprenda fazer database migration em production conforme meus ultimos PRs',
      requestedBy: 'tester',
      sourceSurface: 'cli',
    });

    expect(preview.status).toBe('blocked');
    expect(preview.ok).toBe(false);
    expect(preview.summary).toContain('Skill Memory Policy blocked');
    expect(preview.details).toEqual(expect.arrayContaining([
      'high-risk-task-must-remain-a-governed-mission',
      'domain-specific-task-is-not-safe-as-reusable-skill',
    ]));
    expect(preview.record.skillFilePath).toBeNull();
    expect(fs.existsSync(preview.record.draftDirPath)).toBe(false);
    expect(mutationPlane.createPlan).not.toHaveBeenCalled();
  });

  it('blocks promotion when the regression gate fails', async () => {
    const failingEval = {
      buildGate: jest.fn(() => ({
        id: 'skill-evolution-regression-gate',
        status: 'failed',
        canProceed: false,
        score: 0.4,
        minScore: 0.8,
        summary: 'Regression gate falhou.',
        blockers: ['Critical regression in skill flow.'],
        warnings: [],
        evidence: [{ id: 'eval-1', status: 'failed', summary: 'critical' }],
      })),
    };
    const { service, mutationPlane } = buildService(root, { evalProvider: failingEval });

    const preview = await service.preview({
      intentText: 'aprenda validar changelog local',
      requestedBy: 'tester',
      sourceSurface: 'cli',
    });

    expect(preview.status).toBe('blocked');
    expect(preview.record.status).toBe('blocked');
    expect(preview.details).toEqual(expect.arrayContaining([
      'Critical regression in skill flow.',
    ]));
    expect(mutationPlane.createPlan).not.toHaveBeenCalled();
  });

  it('installs an approved draft and rolls it back', async () => {
    const { service, mutationPlane } = buildService(root);
    const preview = await service.preview({
      intentText: 'aprenda revisar checklist de release',
      requestedBy: 'tester',
      sourceSurface: 'cli',
    });
    mutationPlane.approve();

    const apply = await service.apply({
      planId: preview.mutationPlan!.id,
      requestedBy: 'tester',
    });

    expect(apply.status).toBe('installed');
    expect(apply.ok).toBe(true);
    expect(fs.existsSync(path.join(apply.record.targetDirPath!, 'SKILL.md'))).toBe(true);
    expect(mutationPlane.markApplied).toHaveBeenCalled();

    const rollback = service.rollback({
      draftId: apply.record.id,
      requestedBy: 'tester',
    });

    expect(rollback.status).toBe('rolled_back');
    expect(rollback.ok).toBe(true);
    expect(fs.existsSync(apply.record.targetDirPath!)).toBe(false);
  });

  it('blocks silent install when the mutation plan is not approved', async () => {
    const { service } = buildService(root);
    const preview = await service.preview({
      intentText: 'aprenda validar smoke local antes de merge',
      requestedBy: 'tester',
      sourceSurface: 'cli',
    });

    const blocked = await service.apply({
      planId: preview.mutationPlan!.id,
      requestedBy: 'tester',
    });

    expect(blocked.status).toBe('blocked');
    expect(blocked.ok).toBe(false);
    expect(blocked.summary).toContain('aguarda approval');
    expect(blocked.details).toEqual(expect.arrayContaining([
      'silentInstallBlocked=true',
      'No file foi instalado.',
    ]));
    expect(fs.existsSync(preview.record.targetDirPath!)).toBe(false);
  });

  it('keeps silentInstallBlocked true in the evolution snapshot policy', () => {
    const { service } = buildService(root);
    const snapshot = service.buildSnapshot();
    expect(snapshot.policy.silentInstallBlocked).toBe(true);
    expect(snapshot.policy.draftFirst).toBe(true);
  });
});
