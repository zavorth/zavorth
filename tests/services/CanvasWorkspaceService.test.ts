import fs from 'fs';
import os from 'os';
import path from 'path';
import { CanvasWorkspaceService } from '../../src/services/CanvasWorkspaceService';

function mutationPlaneMock(seedPlans: any[] = []) {
  const plans = [...seedPlans];
  return {
    plans,
    createPlan: jest.fn((input: any) => {
      const plan = {
        id: `workspace-canvas-${input.actionId}-${plans.length + 1}`,
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
        readinessGates: input.readinessGates,
        resourceImpact: input.resourceImpact,
        retentionPolicy: input.retentionPolicy,
        payload: input.payload,
      };
      plans.unshift(plan);
      return plan;
    }),
    listPlans: jest.fn(() => plans),
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
  };
}

function buildSources() {
  return {
    automationService: {
      buildSnapshot: jest.fn(() => ({
        summary: {
          posture: 'healthy',
          activeTasks: 1,
          pausedTasks: 0,
          coreSchedulerDormant: true,
        },
        tasks: [
          {
            id: 'task-1',
            prompt: 'verificar rollout',
            schedule: 'daily',
            status: 'active',
          },
        ],
      })),
    },
    watchModeService: {
      buildSnapshot: jest.fn(() => ({
        summary: {
          posture: 'attention',
          totalRuns: 1,
          artifactEntries: 1,
          activeStatus: 'idle',
          pendingApprovals: 0,
        },
        watchMode: {
          runs: [
            {
              id: 'watch-1',
              artifacts: [
                {
                  id: 'screenshot-1',
                  kind: 'screenshot',
                  title: 'Tela do deploy',
                  summary: 'Screenshot redigido',
                },
              ],
            },
          ],
        },
      })),
    },
    evalControlPlaneService: {
      buildSnapshot: jest.fn(() => ({
        summary: {
          posture: 'healthy',
          regressions: 0,
          scorecards: 2,
        },
        regressionGate: {
          status: 'passed',
          canProceed: true,
        },
      })),
    },
    rolloutReadinessService: {
      buildSnapshot: jest.fn(() => ({
        summary: {
          posture: 'attention',
          gateStatus: 'warning',
          scope: 'local',
          canProceed: false,
        },
        gate: {
          id: 'rollout-local',
          status: 'warning',
          canProceed: false,
        },
      })),
    },
    federatedMeshService: {
      buildSnapshot: jest.fn(() => ({
        localNodeId: 'local-test',
        summary: {
          posture: 'attention',
          onlineNodes: 1,
          remoteNodes: 2,
          infrastructureState: 'mesh_online',
        },
        nodes: [
          {
            id: 'node-1',
            label: 'GPU Worker',
            profile: 'gpu-worker',
            status: 'online',
            trust: 'trusted',
            capabilityIds: ['system.run', 'files.read'],
          },
        ],
      })),
    },
    skillEvolutionService: {
      buildSnapshot: jest.fn(() => ({
        summary: {
          posture: 'healthy',
          total: 1,
          waitingApproval: 0,
          heavyRuntimesStarted: false,
        },
        records: [
          {
            id: 'skill-1',
            skillName: 'release-helper',
            status: 'trusted_local',
          },
        ],
      })),
    },
  };
}

function buildService(root: string, overrides: Record<string, any> = {}) {
  const mutationPlane = overrides.mutationPlane || mutationPlaneMock(overrides.seedPlans || []);
  const service = new CanvasWorkspaceService({
    now: () => new Date('2026-04-22T10:00:00.000Z'),
    workspaceRoot: root,
    stateFile: path.join(root, 'canvas.json'),
    mutationPlaneService: mutationPlane as any,
    ...buildSources(),
    ...overrides,
  });
  return { service, mutationPlane };
}

describe('CanvasWorkspaceService', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-canvas-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('projects all canvas entity kinds from canonical control planes without starting runtimes', async () => {
    const seedPlans = [
      {
        id: 'plan-approval-1',
        domain: 'automation',
        actionId: 'create',
        title: 'Criar automacao',
        summary: 'Plano aguardando approval',
        status: 'waiting_approval',
        riskLevel: 'medium',
        approval: { required: true, status: 'pending' },
        readinessGates: [],
      },
    ];
    const { service } = buildService(root, { seedPlans });

    const snapshot = await service.buildSnapshot();
    const kinds = new Set(snapshot.entities.map((entry) => entry.kind));

    expect(snapshot.summary.heavyRuntimesStarted).toBe(false);
    expect(snapshot.policy.watchModeStartsAutomatically).toBe(false);
    expect(snapshot.policy.nodesStartAutomatically).toBe(false);
    expect(snapshot.policy.automationsStartAutomatically).toBe(false);
    for (const kind of ['chat', 'file', 'diff', 'diagram', 'task', 'node', 'automation', 'approval', 'artifact', 'eval']) {
      expect(kinds.has(kind as any)).toBe(true);
    }
    expect(snapshot.diagrams[0].mermaid).toContain('MutationPlan');
    expect(snapshot.entities.find((entry) => entry.id === 'canvas-approval-plan-approval-1')).toEqual(
      expect.objectContaining({
        status: 'waiting_approval',
        sourceRef: expect.objectContaining({
          plane: 'mutation-plane',
        }),
      }),
    );
  });

  it('creates mutation plans for locks and persists multiplayer state compactly', async () => {
    const { service, mutationPlane } = buildService(root);

    const locked = await service.acquireLock({
      entityId: 'canvas-automations',
      owner: 'ana',
      ttlMs: 60000,
    });
    const blocked = await service.acquireLock({
      entityId: 'canvas-automations',
      owner: 'bruno',
      ttlMs: 60000,
    });
    const recovered = await buildService(root, { mutationPlane }).service.buildSnapshot();

    expect(locked.ok).toBe(true);
    expect(locked.lock).toEqual(expect.objectContaining({
      entityId: 'canvas-automations',
      owner: 'ana',
      mutationPlanId: expect.stringContaining('workspace-canvas-acquire-lock'),
    }));
    expect(blocked.ok).toBe(false);
    expect(blocked.summary).toContain('ana');
    expect(recovered.locks).toEqual([
      expect.objectContaining({
        owner: 'ana',
      }),
    ]);
    expect(mutationPlane.createPlan).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'workspace-canvas',
      actionId: 'acquire-lock',
      approvalRequired: false,
    }));
  });

  it('attaches Watch Mode refs through approval-gated mutation plans and approves them from canvas', async () => {
    const { service, mutationPlane } = buildService(root);

    const attached = await service.attachSource({
      entityId: 'canvas-watch-mode',
      kind: 'screenshot',
      ref: 'watch://run-1/screenshot-1',
      title: 'Tela redigida',
      requestedBy: 'ana',
    });
    expect(attached.ok).toBe(true);
    expect(attached.attachment).toEqual(expect.objectContaining({
      status: 'waiting_approval',
      mutationPlanId: attached.mutationPlan!.id,
    }));
    expect(attached.mutationPlan).toEqual(expect.objectContaining({
      domain: 'workspace-canvas',
      actionId: 'attach-source',
      status: 'waiting_approval',
    }));

    const approved = await service.approvePlan({
      planId: attached.mutationPlan!.id,
      approvedBy: 'ana',
    });

    expect(approved.status).toBe('approved');
    expect(approved.snapshot.entities.find((entry) => entry.id === 'canvas-watch-mode')?.attachments).toEqual([
      expect.objectContaining({
        status: 'approved',
      }),
    ]);
    expect(mutationPlane.approvePlan).toHaveBeenCalledWith(attached.mutationPlan!.id, expect.objectContaining({
      approvedBy: 'ana',
    }));
  });

  it('persists layout as recoverable projection state while creating a mutation plan', async () => {
    const { service, mutationPlane } = buildService(root);

    const moved = await service.saveLayout({
      entityId: 'canvas-federated-mesh',
      position: {
        x: 777,
        y: 333,
        width: 360,
      },
      requestedBy: 'ana',
    });
    const recovered = await buildService(root, { mutationPlane }).service.buildSnapshot();

    expect(moved.ok).toBe(true);
    expect(moved.mutationPlan).toEqual(expect.objectContaining({
      domain: 'workspace-canvas',
      actionId: 'save-layout',
    }));
    expect(recovered.entities.find((entry) => entry.id === 'canvas-federated-mesh')?.position).toEqual(
      expect.objectContaining({
        x: 777,
        y: 333,
        width: 360,
      }),
    );
  });

  it('plans arbitrary mutable canvas actions against real source references', async () => {
    const { service, mutationPlane } = buildService(root);

    const planned = await service.planCanvasAction({
      entityId: 'canvas-skill-evolution',
      actionId: 'promote-skill-card',
      requestedBy: 'ana',
      payload: { recordId: 'skill-1' },
    });

    expect(planned.ok).toBe(true);
    expect(planned.mutationPlan).toEqual(expect.objectContaining({
      domain: 'workspace-canvas',
      actionId: 'promote-skill-card',
      status: 'waiting_approval',
      payload: expect.objectContaining({
        entityId: 'canvas-skill-evolution',
        sourceRef: expect.objectContaining({
          plane: 'skill-evolution',
          command: 'npm run ops:skill-evolution',
        }),
      }),
    }));
    expect(mutationPlane.createPlan).toHaveBeenCalledWith(expect.objectContaining({
      readinessGates: expect.arrayContaining([
        expect.objectContaining({
          id: 'canvas-projection-only',
          canProceed: true,
        }),
      ]),
    }));
  });
});
