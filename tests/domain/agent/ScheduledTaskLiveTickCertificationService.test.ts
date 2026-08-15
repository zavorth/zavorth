import type { GatewayDecision } from '../../../src/execution/ExecutionGateway.js';
import type { ScheduledTask } from '../../../src/storage/SchedulerRepository.js';
import type { SchedulerGovernedScheduledTaskMetadata } from '../../../src/services/SchedulerService.js';
import { ZavorthScheduledTaskLiveTickCertificationService } from '../../../src/services/ZavorthScheduledTaskLiveTickCertificationService.js';


describe('ZavorthScheduledTaskLiveTickCertificationService', () => {
  const now = () => new Date('2026-05-12T10:00:00.000Z');

  it('routes a healthy persisted governed task through ExecutionGateway', async () => {
    const scheduler = new MemoryScheduler([
      makeTask('task-healthy', governedMetadata('approval-ok', '2026-05-19T10:00:00.000Z')),
    ]);
    const gateway = fixtureGateway();
    const service = new ZavorthScheduledTaskLiveTickCertificationService({
      schedulerService: scheduler,
      executionGateway: gateway,
      now,
    });

    const snapshot = await service.buildSnapshot({ taskId: 'task-healthy' });

    expect(snapshot.status).toBe('passed');
    expect(snapshot.summary.gatewaySubmitted).toBe(1);
    expect(snapshot.summary.executionPerformed).toBe(1);
    expect(snapshot.scenarios[0]).toMatchObject({
      id: 'host_task',
      blockReason: 'none',
      gatewayCalled: true,
      expectedBehaviorObserved: true,
    });
    expect(gateway.submit).toHaveBeenCalledWith(
      expect.objectContaining({ command_type: 'scheduled_task' }),
      expect.objectContaining({ executor_recommendation: 'local' }),
      false,
    );
  });

  it('blocks expired approvals before ExecutionGateway', async () => {
    const scheduler = new MemoryScheduler([
      makeTask('task-expired', governedMetadata('approval-expired', '2026-05-11T10:00:00.000Z')),
    ]);
    const gateway = fixtureGateway();
    const service = new ZavorthScheduledTaskLiveTickCertificationService({
      schedulerService: scheduler,
      executionGateway: gateway,
      now,
    });

    const snapshot = await service.buildSnapshot({ taskId: 'task-expired' });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.summary.gatewaySubmitted).toBe(0);
    expect(snapshot.scenarios[0]).toMatchObject({
      blockReason: 'approval_expired',
      gatewayCalled: false,
      expectedBehaviorObserved: true,
    });
    expect(gateway.submit).not.toHaveBeenCalled();
  });

  it('blocks scope drift before ExecutionGateway', async () => {
    const scheduler = new MemoryScheduler([
      {
        ...makeTask('task-drift', governedMetadata('approval-ok', '2026-05-19T10:00:00.000Z')),
        command: '/status --tampered',
      },
    ]);
    const gateway = fixtureGateway();
    const service = new ZavorthScheduledTaskLiveTickCertificationService({
      schedulerService: scheduler,
      executionGateway: gateway,
      now,
    });

    const snapshot = await service.buildSnapshot({ taskId: 'task-drift' });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.scenarios[0]).toMatchObject({
      blockReason: 'scope_drift',
      scopeInvariant: false,
      gatewayCalled: false,
      expectedBehaviorObserved: true,
    });
    expect(gateway.submit).not.toHaveBeenCalled();
  });

  it('auto-pauses noisy tasks before ExecutionGateway only through scheduler lifecycle', async () => {
    const scheduler = new MemoryScheduler([
      {
        ...makeTask('task-failing', governedMetadata('approval-ok', '2026-05-19T10:00:00.000Z')),
        consecutive_failures: 3,
        last_status: 'failed',
      },
    ]);
    const gateway = fixtureGateway();
    const service = new ZavorthScheduledTaskLiveTickCertificationService({
      schedulerService: scheduler,
      executionGateway: gateway,
      now,
    });

    const snapshot = await service.buildSnapshot({ taskId: 'task-failing', applyAutoPause: true });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.summary.autoPaused).toBe(1);
    expect(snapshot.scenarios[0]).toMatchObject({
      blockReason: 'auto_pause_required',
      autoPauseApplied: true,
      gatewayCalled: false,
      expectedBehaviorObserved: true,
    });
    expect(scheduler.pauseTask).toHaveBeenCalledWith(
      'task-failing',
      'auto-paused after 3 consecutive failures',
    );
    expect(gateway.submit).not.toHaveBeenCalled();
  });

  it('certifies the fixture matrix end to end', async () => {
    const service = new ZavorthScheduledTaskLiveTickCertificationService({ now });

    const snapshot = await service.buildSnapshot({ applyAutoPause: true });

    expect(snapshot.status).toBe('passed');
    expect(snapshot.summary).toEqual(expect.objectContaining({
      scenarios: 5,
      passedScenarios: 5,
      gatewaySubmitted: 1,
      blockedBeforeGateway: 4,
      autoPaused: 2,
    }));
    expect(snapshot.safety).toMatchObject({
      appliesOperationalGuardBeforeGateway: true,
      routesThroughExecutionGateway: true,
      noDirectDispatcherBypass: true,
    });
  });
});

function fixtureGateway() {
  return {
    submit: jest.fn(async (task, plan, dryRun): Promise<GatewayDecision> => ({
      allowed: true,
      reason: 'fixture gateway completed live tick',
      requires_confirmation: false,
      correlation: {
        traceId: 'trace-live-tick',
        runId: 'run-live-tick',
        sessionId: task.chat_id,
        approvalId: task.metadata.scheduledTaskApprovalId,
        artifactId: null,
      },
      lifecycle: [],
      policy_evaluation: { allowed: true, violations: [], warnings: [] },
      risk_classification: null,
      mode_sufficient: true,
      execution_result: dryRun ? null : {
        execution_id: 'exec-live-tick',
        task_id: task.task_id,
        executor: plan.executor_recommendation,
        success: true,
        started_at: '2026-05-12T10:00:00.000Z',
        finished_at: '2026-05-12T10:00:00.100Z',
        actions_executed: [],
        files_read: [],
        files_written: [],
        files_deleted: [],
        commands_executed: [],
        stdout: 'ok',
        stderr: null,
        diff_summary: null,
        artifacts: [],
        rollback_available: false,
        error_code: null,
        error_message: null,
        metadata: { dryRun },
      },
    })),
  };
}

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
      workspace: __dirname,
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
