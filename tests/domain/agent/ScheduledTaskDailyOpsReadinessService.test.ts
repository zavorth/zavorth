import type { ScheduledTask } from '../../../src/storage/SchedulerRepository.js';
import type { SchedulerGovernedScheduledTaskMetadata } from '../../../src/services/SchedulerService.js';
import { ZavorthScheduledTaskDailyOpsReadinessService } from '../../../src/services/ZavorthScheduledTaskDailyOpsReadinessService.js';

describe('ZavorthScheduledTaskDailyOpsReadinessService', () => {
  const now = () => new Date('2026-05-12T10:00:00.000Z');

  it('builds daily readiness from Phase 6 and existing governed surfaces', async () => {
    const service = new ZavorthScheduledTaskDailyOpsReadinessService({ now });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.status).toBe('attention');
    expect(snapshot.summary.dailyUseReady).toBe(true);
    expect(snapshot.liveTickCertification.status).toBe('passed');
    expect(snapshot.safety).toMatchObject({
      consumesPhase6LiveTickCertification: true,
      allUserActionsGoThroughGovernedSurfaces: true,
      noDashboardVisualMutation: true,
      noDirectDispatcherBypass: true,
    });
    expect(snapshot.surfaces).toEqual(expect.arrayContaining([
      expect.objectContaining({ surface: 'shared_surface', command: '/schedule', status: 'ready' }),
      expect.objectContaining({ surface: 'telegram', command: '/schedule', status: 'ready' }),
      expect.objectContaining({ surface: 'automation_control_plane', command: '/automations reapprove', status: 'ready' }),
      expect.objectContaining({ surface: 'dashboard_projection', status: 'projection_only' }),
    ]));
  });

  it('certifies a healthy real host task when requested explicitly', async () => {
    const scheduler = new MemoryScheduler([
      makeTask('task-healthy', governedMetadata('approval-ok', '2026-05-19T10:00:00.000Z')),
    ]);
    const service = new ZavorthScheduledTaskDailyOpsReadinessService({ schedulerService: scheduler, now });

    const snapshot = await service.buildSnapshot({ taskId: 'task-healthy' });

    expect(snapshot.status).toBe('ready');
    expect(snapshot.summary.hostTaskChecked).toBe(true);
    expect(snapshot.hostTaskCertification?.status).toBe('passed');
    expect(snapshot.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'host-task-readiness', status: 'pass' }),
    ]));
  });

  it('keeps daily use non-blocked but warns when no host task was selected', async () => {
    const service = new ZavorthScheduledTaskDailyOpsReadinessService({ now });

    const snapshot = await service.buildSnapshot();

    expect(snapshot.status).toBe('attention');
    expect(snapshot.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'host-task-readiness', status: 'warn' }),
    ]));
    expect(snapshot.narrative.nextAction).toContain('--task=<id>');
  });

  it('surfaces host task blocks as attention instead of hiding them', async () => {
    const scheduler = new MemoryScheduler([
      makeTask('task-expired', governedMetadata('approval-expired', '2026-05-11T10:00:00.000Z')),
    ]);
    const service = new ZavorthScheduledTaskDailyOpsReadinessService({ schedulerService: scheduler, now });

    const snapshot = await service.buildSnapshot({ taskId: 'task-expired' });

    expect(snapshot.status).toBe('attention');
    expect(snapshot.hostTaskCertification?.status).toBe('blocked');
    expect(snapshot.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'host-task-readiness', status: 'warn' }),
    ]));
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

  public getTask(id: string): ScheduledTask | null {
    const task = this.tasks.find((entry) => entry.id === id) || null;
    return task ? { ...task } : null;
  }

  public findTaskByPrefix(idPrefix: string): ScheduledTask | null {
    const task = this.tasks.find((entry) => entry.id.startsWith(idPrefix)) || null;
    return task ? { ...task } : null;
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

function makeTask(id: string, metadata: SchedulerGovernedScheduledTaskMetadata | null): ScheduledTask {
  return {
    id,
    command: '/status',
    schedule: 'every 1h',
    created_at: '2026-05-12T09:00:00.000Z',
    last_run: null,
    next_run: '2026-05-12T10:00:00.000Z',
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

function governedMetadata(approvalId: string, expiresAt: string): SchedulerGovernedScheduledTaskMetadata {
  return {
    contractVersion: '2026-05-12.persisted-scheduled-task-registration-phase-3',
    phase: 'phase-3-persisted-scheduled-task-registration',
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
