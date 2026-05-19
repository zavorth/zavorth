import type { ScheduledTask } from '../../../src/storage/SchedulerRepository.js';
import { ZavorthScheduledTaskOperationalGuardService } from '../../../src/services/ZavorthScheduledTaskOperationalGuardService.js';

describe('ZavorthScheduledTaskOperationalGuardService', () => {
  const now = () => new Date('2026-05-12T10:00:00.000Z');

  it('reports healthy governed tasks without workload execution', () => {
    const scheduler = new MemoryScheduler([
      makeTask('task-healthy', governedMetadata('approval-ok', '2026-05-19T10:00:00.000Z')),
    ]);
    const service = new ZavorthScheduledTaskOperationalGuardService({ schedulerService: scheduler, now });

    const snapshot = service.buildSnapshot();

    expect(snapshot.status).toBe('healthy');
    expect(snapshot.summary.governedTasks).toBe(1);
    expect(snapshot.summary.workloadExecutionPerformed).toBe(false);
    expect(scheduler.pauseTask).not.toHaveBeenCalled();
  });

  it('flags expired approvals and recommends reapproval', () => {
    const scheduler = new MemoryScheduler([
      makeTask('task-expired', governedMetadata('approval-expired', '2026-05-11T10:00:00.000Z')),
    ]);
    const service = new ZavorthScheduledTaskOperationalGuardService({ schedulerService: scheduler, now });

    const snapshot = service.buildSnapshot();

    expect(snapshot.status).toBe('critical');
    expect(snapshot.summary.approvalExpiredTasks).toBe(1);
    expect(snapshot.tasks[0]).toEqual(expect.objectContaining({
      operationalStatus: 'approval_expired',
      recommendedCommand: '/automations reapprove task',
    }));
    expect(scheduler.pauseTask).not.toHaveBeenCalled();
  });

  it('applies auto-pause only when explicitly requested', () => {
    const scheduler = new MemoryScheduler([
      {
        ...makeTask('task-failing', governedMetadata('approval-ok', '2026-05-19T10:00:00.000Z')),
        consecutive_failures: 3,
        last_status: 'failed',
      },
    ]);
    const service = new ZavorthScheduledTaskOperationalGuardService({ schedulerService: scheduler, now });

    const preview = service.buildSnapshot();
    const applied = service.buildSnapshot({ applyAutoPause: true });

    expect(preview.status).toBe('attention');
    expect(preview.summary.autoPauseRecommendedTasks).toBe(1);
    expect(scheduler.pauseTask).toHaveBeenCalledTimes(1);
    expect(applied.summary.autoPausedTasks).toBe(1);
    expect(applied.receipts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'auto-pause-applied', status: 'applied' }),
    ]));
  });

  it('marks legacy tasks as critical without mutating them', () => {
    const scheduler = new MemoryScheduler([makeTask('legacy-task', null)]);
    const service = new ZavorthScheduledTaskOperationalGuardService({ schedulerService: scheduler, now });

    const snapshot = service.buildSnapshot({ applyAutoPause: true });

    expect(snapshot.status).toBe('critical');
    expect(snapshot.summary.legacyTasks).toBe(1);
    expect(snapshot.tasks[0]?.operationalStatus).toBe('legacy');
    expect(scheduler.pauseTask).not.toHaveBeenCalled();
  });
});

class MemoryScheduler {
  public readonly pauseTask = jest.fn((id: string, reason?: string | null): ScheduledTask | null => {
    const task = this.tasks.find((entry) => entry.id === id) || null;
    if (!task) return null;
    task.status = 'paused';
    task.paused_reason = reason || null;
    return { ...task };
  });

  public constructor(private readonly tasks: ScheduledTask[]) {}

  public listTasks(): ScheduledTask[] {
    return this.tasks.map((task) => ({ ...task }));
  }

  public describeTaskRuntime(task: ScheduledTask) {
    const guardrails = JSON.parse(String(task.guardrail_json || '{}'));
    return {
      budget: {
        maxRuntimeMs: 600000,
        maxMemoryMb: 256,
        retries: 2,
        backoffMs: 30000,
        maxConcurrentRuns: 1,
        maxPerTaskConcurrentRuns: 1,
        maintenanceWindows: [],
      },
      guardrails: {
        autoPauseAfterConsecutiveFailures: Number(guardrails.autoPauseAfterConsecutiveFailures || 3),
        idempotencyKeySeed: 'fixture',
        outboxTtlMs: 604800000,
        outboxMaxBytes: 104857600,
        pauseCreatesInboxNotice: true,
        governedScheduledTask: guardrails.governedScheduledTask || null,
      },
      autoPause: {
        threshold: 3,
        consecutiveFailures: Number(task.consecutive_failures || 0),
        paused: task.status === 'paused',
        pausedReason: task.paused_reason || null,
        lastFailureAt: task.last_failure_at || null,
      },
    };
  }
}

function makeTask(id: string, metadata: any): ScheduledTask {
  return {
    id,
    command: '/status',
    schedule: 'every 1h',
    created_at: '2026-05-12T09:00:00.000Z',
    last_run: null,
    next_run: '2026-05-12T11:00:00.000Z',
    created_by: 'operator',
    status: 'active',
    intent_text: 'status recorrente',
    delivery: 'app',
    delivery_target: null,
    last_status: 'idle',
    last_error: null,
    last_result: null,
    run_count: 0,
    failure_count: 0,
    budget_json: '{}',
    guardrail_json: JSON.stringify({
      autoPauseAfterConsecutiveFailures: 3,
      governedScheduledTask: metadata,
    }),
    paused_reason: null,
    last_failure_at: null,
    consecutive_failures: 0,
  };
}

function governedMetadata(approvalId: string, expiresAt: string) {
  return {
    contractVersion: '2026-05-12.persisted-scheduled-task-registration-checkpoint-3',
    stage: 'checkpoint-3-persisted-scheduled-task-registration',
    registryStatus: 'active',
    approvalId,
    approvalExpiresAt: expiresAt,
    approvalVerificationReason: 'valid',
    approvedScopeHash: `hash-${approvalId}`,
    approvedScope: {
      intent: 'status recorrente',
      command: '/status',
      workspace: process.cwd(),
      surface: 'web',
      createdBy: 'operator',
      allowedTools: ['scheduled_task_dispatch'],
    },
    approvedBudget: {
      maxRuntimeMs: 600000,
      maxTokens: 6000,
      maxToolCalls: 8,
      maxNetworkRequests: 0,
      maxCommands: 1,
      maxMutations: 0,
      maxRetries: 2,
    },
    renewalPolicy: 'require_reapproval',
    receipts: [],
    persistedAt: '2026-05-12T09:00:00.000Z',
    executionGatewayRequired: true,
    noDirectToolDispatch: true,
  };
}
