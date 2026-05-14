import fs from 'fs';
import os from 'os';
import path from 'path';
import { ZavorthReplayLearningRegistryService } from '../../src/services/ZavorthReplayLearningRegistryService';
import { ZavorthReplayLearningService } from '../../src/services/ZavorthReplayLearningService';

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
        id: 'replay-learning-plan-1',
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
  const registry = new ZavorthReplayLearningRegistryService({
    registryFile: path.join(root, 'replay-learning-registry.json'),
    now: () => new Date('2026-04-20T10:00:00.000Z'),
  });
  const service = new ZavorthReplayLearningService({
    projectRoot: root,
    registryService: registry,
    mutationPlaneService: mutationPlane as any,
    trustDecisionService: {
      evaluate: jest.fn(async () => ({
        generatedAt: '2026-04-20T10:00:00.000Z',
        decision: 'requires_approval',
        ok: false,
        reason: 'Replay learning exige approval.',
        permission: { permission_id: 'perm-replay-1', status: 'pending' },
        profile: 'ops',
        capabilityId: 'replay-learning',
        recommendedScope: 'once',
      })),
    } as any,
    permissionService: {
      getRequest: jest.fn(),
    } as any,
    now: () => new Date('2026-04-20T10:00:00.000Z'),
  });
  return { service, mutationPlane, registry };
}

const replayText = [
  'prefiro sempre primeiro rodar testes unitarios antes de mexer em release token=abc123',
  'quando der erro de build, debug pelo log e reproduz com jest',
  'mantenha estilo TypeScript com nomes claros e estrutura por services',
  'esse checklist pode virar uma skill para repetir toda vez',
].join('\n');

describe('ZavorthReplayLearningService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-replay-learning-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('imports a replay in suggest-only mode with redaction and no mutation plan', async () => {
    const { service, mutationPlane } = buildService(root);

    const preview = await service.preview({
      replayText,
      requestedBy: 'tester',
      sourceSurface: 'cli',
      suggestOnly: true,
    });

    expect(preview.status).toBe('suggest_only');
    expect(preview.ok).toBe(true);
    expect(preview.mutationPlan).toBeNull();
    expect(mutationPlane.createPlan).not.toHaveBeenCalled();
    expect(preview.records.length).toBeGreaterThanOrEqual(4);
    expect(preview.records.map((entry) => entry.kind)).toEqual(expect.arrayContaining([
      'preference',
      'debug-pattern',
      'coding-style',
      'skill-candidate',
    ]));
    expect(JSON.stringify(preview.records)).not.toContain('abc123');
    expect(preview.records[0].artifact.redaction.rawTranscriptPersisted).toBe(false);
    expect(preview.records[0].artifact.redaction.rawSecretsPersisted).toBe(false);
  });

  it('creates a mutation plan and trust decision before approving replay learning', async () => {
    const { service, mutationPlane } = buildService(root);

    const preview = await service.preview({
      replayText,
      requestedBy: 'tester',
      sourceSurface: 'cli',
      suggestOnly: false,
    });

    expect(preview.status).toBe('waiting_approval');
    expect(preview.ok).toBe(false);
    expect(preview.mutationPlan?.id).toBe('replay-learning-plan-1');
    expect(preview.records.every((entry) => entry.status === 'waiting_approval')).toBe(true);
    expect(mutationPlane.createPlan).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'replay-learning',
      actionId: 'approve-learning',
      payload: expect.objectContaining({
        rawReplayPersisted: false,
        recordIds: expect.arrayContaining(preview.records.map((entry) => entry.id)),
      }),
      validationPlan: expect.arrayContaining([
        expect.stringContaining('rawReplayPersisted=false'),
      ]),
    }));
    expect(JSON.stringify(mutationPlane.createPlan.mock.calls[0][0].payload)).not.toContain('abc123');
  });

  it('applies approved learning to the local digital twin profile and revokes it', async () => {
    const { service, mutationPlane } = buildService(root);
    const preview = await service.preview({
      replayText,
      requestedBy: 'tester',
      sourceSurface: 'cli',
      suggestOnly: false,
    });
    mutationPlane.approve();

    const applied = await service.apply({
      planId: preview.mutationPlan!.id,
      requestedBy: 'tester',
    });

    expect(applied.status).toBe('approved');
    expect(applied.ok).toBe(true);
    expect(applied.profile.mode).toBe('suggest-only');
    expect(applied.profile.approvedRecordIds.length).toBe(preview.records.length);
    expect(service.suggest({ objective: 'como eu faria debug desse erro?' }).suggestions.length).toBeGreaterThan(0);

    const revoked = service.revoke({
      recordId: applied.records[0].id,
      reason: 'teste de revogacao',
      requestedBy: 'tester',
    });

    expect(revoked.status).toBe('revoked');
    expect(revoked.profile.revokedRecordIds).toContain(applied.records[0].id);
    expect(revoked.profile.approvedRecordIds).not.toContain(applied.records[0].id);
  });
});
