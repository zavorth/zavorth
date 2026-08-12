import { ZavorthAutomationActionService } from '../../src/services/ZavorthAutomationActionService.js';

describe('ZavorthAutomationActionService', () => {
  it('creates a mutation preview before scheduling natural-language automation', async () => {
    const scheduleTask = jest.fn(() => ({
      id: 'task-1-abc',
      command: 'verifique meus canais',
      schedule: 'daily 09:00',
      created_at: '2026-04-12T10:00:00.000Z',
      last_run: null,
      next_run: '2026-04-13T09:00:00.000Z',
      created_by: 'u1',
      status: 'active',
      delivery: 'telegram',
      intent_text: 'todo dia as 9h verifique meus canais',
    }));
    const createPlan = jest.fn(() => ({
      id: 'plan-automation-1',
      status: 'waiting_approval',
      approval: { required: true, status: 'pending', permissionId: null },
      resourceImpact: { ramMb: 80, diskMb: 5, processCount: 0, externalExposure: 'local', recurring: true, notes: [] },
      payload: {
        actionId: 'create',
        intentText: 'todo dia as 9h verifique meus canais',
        sourceSurface: 'telegram',
      },
    }));
    const service = new ZavorthAutomationActionService({
      loadSchedulerService: async () => ({
        scheduleTask,
        findTaskByPrefix: jest.fn(),
        pauseTask: jest.fn(),
        resumeTask: jest.fn(),
        removeTask: jest.fn(),
      } as any),
      loadMaintenanceService: async () => ({
        enable: jest.fn(),
        disable: jest.fn(),
        triggerNow: jest.fn(),
        getStatus: jest.fn(),
      } as any),
      controlPlaneService: {
        buildSnapshot: jest.fn(async () => ({
          narrative: {
            operatorSummary: 'Nenhuma automacao nova aplicada.',
            nextAction: 'Aprovar plano antes de ativar recorrencia.',
          },
        })),
      } as any,
      mutationPlaneService: {
        createPlan,
        readPlan: jest.fn(),
        attachApproval: jest.fn((planId: string, approval: any) => ({
          id: planId,
          status: 'waiting_approval',
          approval: { required: true, status: 'pending', permissionId: approval.permissionId },
          resourceImpact: { ramMb: 80, diskMb: 5, processCount: 0, externalExposure: 'local', recurring: true, notes: [] },
          payload: {
            actionId: 'create',
            intentText: 'todo dia as 9h verifique meus canais',
            sourceSurface: 'telegram',
          },
        })),
        approvePlan: jest.fn(),
        markApplied: jest.fn(),
        markBlocked: jest.fn(),
      } as any,
      trustDecisionService: {
        evaluate: jest.fn(async () => ({
          generatedAt: '2026-04-12T10:00:00.000Z',
          decision: 'requires_approval',
          ok: false,
          reason: 'Automacao recorrente exige budget salvo e approval.',
          permission: { permission_id: 'perm-automation-1', status: 'pending' },
          profile: 'ops',
          capabilityId: 'recurring-automation',
          recommendedScope: 'once',
        })),
      } as any,
    });

    const execution = await service.execute({
      actionId: 'create',
      intentText: 'todo dia as 9h verifique meus canais',
      requestedBy: 'u1',
      sourceSurface: 'telegram',
    });

    expect(scheduleTask).not.toHaveBeenCalled();
    expect(execution.ok).toBe(false);
    expect(execution.status).toBe('waiting_approval');
    expect(createPlan).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'automation',
      payload: expect.objectContaining({
        budget: expect.objectContaining({
          maxRuntimeMs: 600000,
          maxPerTaskConcurrentRuns: 1,
        }),
        guardrails: expect.objectContaining({
          autoPauseAfterConsecutiveFailures: 3,
          pauseCreatesInboxNotice: true,
        }),
        outboxRetention: expect.objectContaining({
          idempotencyRequired: false,
        }),
      }),
      validationPlan: expect.arrayContaining([
        expect.stringContaining('outbox idempotente'),
      ]),
    }));
    expect(execution.mutationPlan?.id).toBe('plan-automation-1');
    expect(execution.runId).toBe('plan-automation-1');
    expect(execution.approvalId).toBe('perm-automation-1');
    expect(execution.execution_lifecycle).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'plan',
        status: 'approval_required',
        source: 'automation',
      }),
      expect.objectContaining({
        kind: 'approval',
        approvalId: 'perm-automation-1',
        status: 'approval_required',
      }),
    ]));
  });
});
