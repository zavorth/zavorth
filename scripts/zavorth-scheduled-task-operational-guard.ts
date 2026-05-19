#!/usr/bin/env tsx
import { Database } from '../src/storage/Database.js';
import { SchedulerRepository, type ScheduledTask } from '../src/storage/SchedulerRepository.js';
import { SchedulerService, type SchedulerGovernedScheduledTaskMetadata } from '../src/services/SchedulerService.js';
import { ZavorthScheduledTaskOperationalGuardService } from '../src/services/ZavorthScheduledTaskOperationalGuardService.js';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scheduler = args.fixture
    ? new FixtureScheduler(args)
    : new SchedulerService(new SchedulerRepository(await Database.getInstance()));
  const service = new ZavorthScheduledTaskOperationalGuardService({
    schedulerService: scheduler as any,
    now: () => new Date(args.now || new Date().toISOString()),
  });
  const snapshot = service.buildSnapshot({
    applyAutoPause: args.applyAutoPause,
    requestedBy: args.requestedBy,
    approvalExpiryWarningMs: args.warningMs,
  });
  if (args.json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }
  console.log(service.renderReport(snapshot));
}

function parseArgs(argv: string[]) {
  const args = {
    json: false,
    fixture: false,
    applyAutoPause: false,
    expired: false,
    expiring: false,
    failing: false,
    legacy: false,
    now: '',
    requestedBy: 'operator',
    warningMs: undefined as number | undefined,
  };
  for (const arg of argv) {
    if (arg === '--json') args.json = true;
    else if (arg === '--fixture-scheduler') args.fixture = true;
    else if (arg === '--apply-auto-pause') args.applyAutoPause = true;
    else if (arg === '--expired') args.expired = true;
    else if (arg === '--expiring') args.expiring = true;
    else if (arg === '--failing') args.failing = true;
    else if (arg === '--legacy') args.legacy = true;
    else if (arg.startsWith('--now=')) args.now = arg.slice('--now='.length);
    else if (arg.startsWith('--requested-by=')) args.requestedBy = arg.slice('--requested-by='.length);
    else if (arg.startsWith('--warning-ms=')) args.warningMs = Number(arg.slice('--warning-ms='.length));
  }
  return args;
}

class FixtureScheduler {
  private readonly tasks: ScheduledTask[] = [];

  public constructor(private readonly args: ReturnType<typeof parseArgs>) {
    if (!args.expired && !args.expiring && !args.failing && !args.legacy) {
      this.tasks.push(this.makeTask('healthy-task', governedMetadata('healthy-approval', '2026-05-19T10:00:00.000Z')));
    }
    if (args.expired) this.tasks.push(this.makeTask('expired-task', governedMetadata('expired-approval', '2026-05-11T10:00:00.000Z')));
    if (args.expiring) this.tasks.push(this.makeTask('expiring-task', governedMetadata('expiring-approval', '2026-05-12T18:00:00.000Z')));
    if (args.failing) this.tasks.push({
      ...this.makeTask('failing-task', governedMetadata('failing-approval', '2026-05-19T10:00:00.000Z')),
      consecutive_failures: 3,
      last_status: 'failed',
    });
    if (args.legacy) this.tasks.push(this.makeTask('legacy-task', null));
  }

  public listTasks(): ScheduledTask[] {
    return this.tasks.map((task) => ({ ...task }));
  }

  public pauseTask(id: string, reason?: string | null): ScheduledTask | null {
    const task = this.tasks.find((entry) => entry.id === id) || null;
    if (!task) return null;
    task.status = 'paused';
    task.paused_reason = reason || null;
    return { ...task };
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
        threshold: Number(guardrails.autoPauseAfterConsecutiveFailures || 3),
        consecutiveFailures: Number(task.consecutive_failures || 0),
        paused: task.status === 'paused',
        pausedReason: task.paused_reason || null,
        lastFailureAt: task.last_failure_at || null,
      },
    };
  }

  private makeTask(id: string, metadata: SchedulerGovernedScheduledTaskMetadata | null): ScheduledTask {
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

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
