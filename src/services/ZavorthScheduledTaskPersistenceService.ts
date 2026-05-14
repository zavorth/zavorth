import { createHash } from 'node:crypto';
import type {
  SchedulerGovernedScheduledTaskMetadata,
  SchedulerTaskBudget,
  SchedulerTaskGuardrails,
} from './SchedulerService.js';
import type { ScheduledTask } from '../storage/SchedulerRepository.js';
import {
  ZAVORTH_SCHEDULED_TASK_PERSISTENCE_CONTRACT_VERSION,
  type ZavorthPersistedScheduledTaskGovernedMetadata,
  type ZavorthScheduledTaskPersistenceAction,
  type ZavorthScheduledTaskPersistenceCheck,
  type ZavorthScheduledTaskPersistenceInput,
  type ZavorthScheduledTaskPersistenceReceipt,
  type ZavorthScheduledTaskPersistenceSnapshot,
  type ZavorthScheduledTaskPersistenceStatus,
} from '../contracts/ZavorthScheduledTaskPersistenceContract.js';
import type { ZavorthScheduledTaskInput } from '../contracts/ZavorthScheduledTaskContract.js';
import { ZavorthScheduledTaskExecutionGatewayRuntimeService } from './ZavorthScheduledTaskExecutionGatewayRuntimeService.js';

type SchedulerLike = {
  scheduleTask(
    command: string,
    schedule: string,
    userId: string,
    options?: {
      intentText?: string | null;
      delivery?: ScheduledTask['delivery'];
      deliveryTarget?: string | null;
      budget?: Partial<SchedulerTaskBudget> | null;
      guardrails?: Partial<SchedulerTaskGuardrails> | null;
      governedScheduledTask?: SchedulerGovernedScheduledTaskMetadata | null;
    },
  ): ScheduledTask;
  findTaskByPrefix?(idPrefix: string): ScheduledTask | null;
  getTask?(id: string): ScheduledTask | null;
  pauseTask?(id: string): ScheduledTask | null;
  resumeTask?(id: string): ScheduledTask | null;
  removeTask?(id: string): boolean;
  updateTaskRuntimeMetadata?(
    id: string,
    input: {
      budget?: Partial<SchedulerTaskBudget> | null;
      guardrails?: Partial<SchedulerTaskGuardrails> | null;
      governedScheduledTask?: SchedulerGovernedScheduledTaskMetadata | null;
      pausedReason?: string | null;
    },
  ): ScheduledTask | null;
};

type Runtime = {
  now?: () => Date;
  cwd?: () => string;
  schedulerService?: SchedulerLike | null;
  runtimeService?: Pick<ZavorthScheduledTaskExecutionGatewayRuntimeService, 'buildSnapshot'> | null;
};

export class ZavorthScheduledTaskPersistenceService {
  private readonly now: () => Date;
  private readonly scheduler: SchedulerLike | null;
  private readonly runtimeService: Pick<ZavorthScheduledTaskExecutionGatewayRuntimeService, 'buildSnapshot'>;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.scheduler = runtime.schedulerService || null;
    this.runtimeService = runtime.runtimeService || new ZavorthScheduledTaskExecutionGatewayRuntimeService({
      now: this.now,
      cwd: runtime.cwd,
    });
  }

  public async buildSnapshot(input: ZavorthScheduledTaskPersistenceInput = {}): Promise<ZavorthScheduledTaskPersistenceSnapshot> {
    const generatedAt = this.now().toISOString();
    const action = normalizeAction(input.action);
    const runtime = await this.runtimeService.buildSnapshot({
      scheduledTask: input.scheduledTask || {},
      tick: {
        submit: false,
        due: true,
        dryRun: true,
      },
    });
    const schedulerAvailable = Boolean(this.scheduler);
    const initialMetadata = buildGovernedMetadata(runtime, generatedAt);
    const actionResult = await this.executeAction(action, input, runtime, initialMetadata, schedulerAvailable);
    const status = actionResult.status;
    const task = actionResult.task;
    const governedMetadata = actionResult.metadata;
    const checks = buildChecks({
      action,
      status,
      schedulerAvailable,
      runtimeReady: runtime.status === 'ready',
      taskFound: actionResult.taskFound,
      taskGoverned: Boolean(governedMetadata),
      approvalFresh: runtime.registry.approvalVerification.ok,
      persistencePerformed: actionResult.persistencePerformed,
    });
    const receipts = buildReceipts(action, status, runtime, task, governedMetadata, actionResult.persistencePerformed);
    const summary = {
      schedulerAvailable,
      runtimeReady: runtime.status === 'ready',
      taskPersisted: Boolean(task && actionResult.persistencePerformed),
      taskGoverned: Boolean(governedMetadata),
      approvalFresh: runtime.registry.approvalVerification.ok,
      executionPerformed: false as false,
    };

    return {
      generatedAt,
      contractVersion: ZAVORTH_SCHEDULED_TASK_PERSISTENCE_CONTRACT_VERSION,
      source: 'ZavorthScheduledTaskPersistenceService',
      phase: 'phase-3-persisted-scheduled-task-registration',
      status,
      action,
      runtime,
      task,
      governedMetadata: governedMetadata as ZavorthPersistedScheduledTaskGovernedMetadata | null,
      checks,
      receipts,
      safety: {
        persistsOnlyPhase2ReadyRuntime: true,
        storesGovernedScopeInGuardrails: true,
        storesBudgetsInSchedulerMetadata: true,
        pauseResumeRevokeUseSchedulerService: true,
        reapprovalDoesNotChangeCommandOrSchedule: true,
        noDirectExecutionDuringRegistration: true,
        rawSecretsSerialized: false,
      },
      summary,
      commands: {
        report: 'npx tsx scripts/zavorth-scheduled-task-persistence.ts',
        json: 'npx tsx scripts/zavorth-scheduled-task-persistence.ts --json',
        register: 'npx tsx scripts/zavorth-scheduled-task-persistence.ts --json --action=register --owner-confirmed --approval=schedule-owner-ok',
        check: 'node scripts/zavorth-scheduled-task-persistence-check.mjs',
      },
      narrative: narrativeForStatus(status, action, summary),
    };
  }

  public formatSnapshotText(snapshot: ZavorthScheduledTaskPersistenceSnapshot): string {
    const lines = [
      'Zavorth Persisted Scheduled Task Registration - Phase 3',
      '',
      `Status: ${snapshot.status}`,
      `Action: ${snapshot.action}`,
      `Runtime: ${snapshot.runtime.status}`,
      `Scheduler available: ${snapshot.summary.schedulerAvailable}`,
      `Task: ${snapshot.task?.id || 'none'}`,
      `Governed metadata: ${snapshot.summary.taskGoverned}`,
      `Execution performed: ${snapshot.summary.executionPerformed}`,
      '',
      'Checks:',
      ...snapshot.checks.map((check) => `- ${check.kind}: ${check.status} | ${check.summary}`),
      '',
      snapshot.narrative.operatorSummary,
      `Next: ${snapshot.narrative.nextAction}`,
    ];
    return lines.join('\n');
  }

  private async executeAction(
    action: ZavorthScheduledTaskPersistenceAction,
    input: ZavorthScheduledTaskPersistenceInput,
    runtime: Awaited<ReturnType<ZavorthScheduledTaskExecutionGatewayRuntimeService['buildSnapshot']>>,
    metadata: SchedulerGovernedScheduledTaskMetadata,
    schedulerAvailable: boolean,
  ): Promise<{
    status: ZavorthScheduledTaskPersistenceStatus;
    task: ScheduledTask | null;
    metadata: SchedulerGovernedScheduledTaskMetadata | null;
    taskFound: boolean;
    persistencePerformed: boolean;
  }> {
    if (runtime.status === 'needs_reapproval') return result('needs_reapproval');
    if (runtime.status === 'expired') return result('expired');
    if (runtime.status !== 'ready') return result('blocked');
    if (action === 'preview') {
      return {
        status: 'preview_ready',
        task: null,
        metadata,
        taskFound: false,
        persistencePerformed: false,
      };
    }
    if (!schedulerAvailable || !this.scheduler) return result('scheduler_unavailable');

    if (action === 'register') {
      const task = this.scheduler.scheduleTask(
        runtime.registry.registration.schedulerCommand,
        runtime.registry.registration.schedulerSchedule,
        runtime.registry.registration.schedulerUserId,
        {
          intentText: runtime.registry.registration.schedulerOptions.intentText,
          delivery: deliveryForSchedulerInput(input.scheduler?.delivery, runtime.registry.scope.surface),
          deliveryTarget: clean(input.scheduler?.deliveryTarget) || null,
          budget: schedulerBudget(runtime),
          guardrails: schedulerGuardrails(metadata),
          governedScheduledTask: metadata,
        },
      );
      return {
        status: 'persisted',
        task,
        metadata,
        taskFound: true,
        persistencePerformed: true,
      };
    }

    const task = this.findTask(input.taskId);
    if (!task) return result('blocked', null, false);
    const existingMetadata = readGovernedMetadata(task);
    if (!existingMetadata) return result('blocked', task, true);

    if (action === 'pause') {
      const paused = this.scheduler.pauseTask?.(task.id) || task;
      return {
        status: 'paused',
        task: paused,
        metadata: existingMetadata,
        taskFound: true,
        persistencePerformed: true,
      };
    }
    if (action === 'resume') {
      const resumed = this.scheduler.resumeTask?.(task.id) || task;
      return {
        status: 'resumed',
        task: resumed,
        metadata: existingMetadata,
        taskFound: true,
        persistencePerformed: true,
      };
    }
    if (action === 'revoke') {
      this.scheduler.removeTask?.(task.id);
      return {
        status: 'revoked',
        task,
        metadata: existingMetadata,
        taskFound: true,
        persistencePerformed: true,
      };
    }
    if (action === 'reapprove') {
      const freshInput = preserveExistingTaskScope(input.scheduledTask || {}, task, existingMetadata);
      const service = new ZavorthScheduledTaskExecutionGatewayRuntimeService({
        now: this.now,
        cwd: () => existingMetadata.approvedScope.workspace,
      });
      const freshRuntime = await service.buildSnapshot({
        scheduledTask: freshInput,
        tick: { submit: false, due: true, dryRun: true },
      });
      if (freshRuntime.status === 'needs_reapproval') return result('needs_reapproval', task, true);
      if (freshRuntime.status === 'expired') return result('expired', task, true);
      if (freshRuntime.status !== 'ready') return result('blocked', task, true);
      const freshMetadata = buildGovernedMetadata(freshRuntime, this.now().toISOString());
      const updated = this.scheduler.updateTaskRuntimeMetadata?.(task.id, {
        budget: schedulerBudget(freshRuntime),
        guardrails: schedulerGuardrails(freshMetadata),
        governedScheduledTask: freshMetadata,
        pausedReason: null,
      }) || task;
      return {
        status: 'reapproved',
        task: updated,
        metadata: freshMetadata,
        taskFound: true,
        persistencePerformed: true,
      };
    }
    return result('blocked');
  }

  private findTask(taskId: string | null | undefined): ScheduledTask | null {
    const normalized = String(taskId || '').trim();
    if (!normalized || !this.scheduler) return null;
    return this.scheduler.findTaskByPrefix?.(normalized)
      || this.scheduler.getTask?.(normalized)
      || null;
  }
}

function result(
  status: ZavorthScheduledTaskPersistenceStatus,
  task: ScheduledTask | null = null,
  taskFound = false,
): {
  status: ZavorthScheduledTaskPersistenceStatus;
  task: ScheduledTask | null;
  metadata: SchedulerGovernedScheduledTaskMetadata | null;
  taskFound: boolean;
  persistencePerformed: boolean;
} {
  return {
    status,
    task,
    metadata: task ? readGovernedMetadata(task) : null,
    taskFound,
    persistencePerformed: false,
  };
}

function normalizeAction(value: unknown): ZavorthScheduledTaskPersistenceAction {
  if (value === 'register' || value === 'pause' || value === 'resume' || value === 'revoke' || value === 'reapprove') {
    return value;
  }
  return 'preview';
}

function buildGovernedMetadata(
  runtime: Awaited<ReturnType<ZavorthScheduledTaskExecutionGatewayRuntimeService['buildSnapshot']>>,
  persistedAt: string,
): SchedulerGovernedScheduledTaskMetadata {
  const registry = runtime.registry;
  const scopeHash = hashStable({
    scope: registry.scope,
    budget: registry.budget,
    schedule: registry.schedule?.normalized || null,
    approvalId: registry.approvalEnvelope?.approvalId || null,
  });
  return {
    contractVersion: ZAVORTH_SCHEDULED_TASK_PERSISTENCE_CONTRACT_VERSION,
    phase: 'phase-3-persisted-scheduled-task-registration',
    registryStatus: registry.status,
    approvalId: registry.approvalEnvelope?.approvalId || null,
    approvalExpiresAt: registry.approvalEnvelope?.expiresAt || null,
    approvalVerificationReason: registry.approvalVerification.reason,
    approvedScopeHash: scopeHash,
    approvedScope: {
      intent: registry.scope.intent,
      command: registry.scope.command,
      workspace: registry.scope.workspace,
      surface: registry.scope.surface,
      createdBy: registry.scope.createdBy,
      allowedTools: registry.scope.allowedTools,
    },
    approvedBudget: {
      maxRuntimeMs: registry.budget.maxRuntimeMs,
      maxTokens: registry.budget.maxTokens,
      maxToolCalls: registry.budget.maxToolCalls,
      maxNetworkRequests: registry.budget.maxNetworkRequests,
      maxCommands: registry.budget.maxCommands,
      maxMutations: registry.budget.maxMutations,
      maxRetries: registry.budget.maxRetries,
    },
    renewalPolicy: registry.renewalPolicy,
    receipts: [
      ...registry.receipts.map((receipt) => ({
        id: receipt.id,
        kind: receipt.kind,
        status: receipt.status,
      })),
      ...runtime.receipts.map((receipt) => ({
        id: receipt.id,
        kind: receipt.kind,
        status: receipt.status,
      })),
    ].slice(0, 20),
    persistedAt,
    executionGatewayRequired: true,
    noDirectToolDispatch: true,
  };
}

function schedulerBudget(
  runtime: Awaited<ReturnType<ZavorthScheduledTaskExecutionGatewayRuntimeService['buildSnapshot']>>,
): Partial<SchedulerTaskBudget> {
  return {
    maxRuntimeMs: runtime.registry.budget.maxRuntimeMs,
    retries: runtime.registry.budget.maxRetries,
    maxConcurrentRuns: 1,
    maxPerTaskConcurrentRuns: 1,
  };
}

function schedulerGuardrails(metadata: SchedulerGovernedScheduledTaskMetadata): Partial<SchedulerTaskGuardrails> {
  return {
    autoPauseAfterConsecutiveFailures: 3,
    idempotencyKeySeed: `governed-schedule:${metadata.approvedScopeHash}`,
    outboxTtlMs: 7 * 24 * 60 * 60 * 1000,
    outboxMaxBytes: 100 * 1024 * 1024,
    pauseCreatesInboxNotice: true,
    governedScheduledTask: metadata,
  };
}

function deliveryForSurface(surface: string): ScheduledTask['delivery'] {
  if (surface === 'telegram') return 'telegram';
  if (surface === 'web' || surface === 'command_center' || surface === 'cli' || surface === 'api') return 'app';
  return 'app';
}

function deliveryForSchedulerInput(delivery: unknown, surface: string): ScheduledTask['delivery'] {
  if (delivery === 'telegram' || delivery === 'app' || delivery === 'email' || delivery === 'webhook') {
    return delivery;
  }
  return deliveryForSurface(surface);
}

function readGovernedMetadata(task: ScheduledTask | null): SchedulerGovernedScheduledTaskMetadata | null {
  if (!task?.guardrail_json) return null;
  try {
    const parsed = JSON.parse(task.guardrail_json);
    const metadata = parsed?.governedScheduledTask;
    if (
      metadata
      && metadata.phase === 'phase-3-persisted-scheduled-task-registration'
      && typeof metadata.approvedScopeHash === 'string'
    ) {
      return metadata as SchedulerGovernedScheduledTaskMetadata;
    }
  } catch {
    return null;
  }
  return null;
}

function preserveExistingTaskScope(
  input: ZavorthScheduledTaskInput,
  task: ScheduledTask,
  metadata: SchedulerGovernedScheduledTaskMetadata,
): ZavorthScheduledTaskInput {
  return {
    ...input,
    intent: metadata.approvedScope.intent,
    command: task.command,
    schedule: task.schedule,
    workspace: metadata.approvedScope.workspace,
    surface: metadata.approvedScope.surface as ZavorthScheduledTaskInput['surface'],
    createdBy: metadata.approvedScope.createdBy,
    allowedTools: metadata.approvedScope.allowedTools,
  };
}

function buildChecks(input: {
  action: ZavorthScheduledTaskPersistenceAction;
  status: ZavorthScheduledTaskPersistenceStatus;
  schedulerAvailable: boolean;
  runtimeReady: boolean;
  taskFound: boolean;
  taskGoverned: boolean;
  approvalFresh: boolean;
  persistencePerformed: boolean;
}): ZavorthScheduledTaskPersistenceCheck[] {
  return [
    check('runtime-ready', input.runtimeReady, 'runtime-ready', input.runtimeReady ? 'Phase 2 runtime is ready.' : `Runtime is ${input.status}.`, 'Resolve Phase 1/2 gates before persistence.'),
    input.action === 'preview'
      ? warn('scheduler-available', input.schedulerAvailable, 'scheduler-available', input.schedulerAvailable ? 'SchedulerService is available.' : 'Preview can run without SchedulerService.', 'Inject SchedulerService for register/pause/resume/revoke.')
      : check('scheduler-available', input.schedulerAvailable, 'scheduler-available', input.schedulerAvailable ? 'SchedulerService is available.' : 'SchedulerService is missing.', 'Inject SchedulerService before mutating scheduled tasks.'),
    check('action-supported', true, 'action-supported', `Action ${input.action} is supported by Phase 3.`, null),
    input.action === 'register' || input.action === 'preview'
      ? warn('task-found', true, 'task-found', 'Existing task lookup is not required for this action.', null)
      : check('task-found', input.taskFound, 'task-found', input.taskFound ? 'Target scheduled task was found.' : 'Target scheduled task was not found.', 'Pass a valid task id or prefix.'),
    input.action === 'register' || input.action === 'preview'
      ? warn('governed-metadata', input.taskGoverned || input.action === 'preview', 'governed-metadata', input.taskGoverned ? 'Governed metadata is present.' : 'Governed metadata is prepared for persistence.', null)
      : check('governed-metadata', input.taskGoverned, 'governed-metadata', input.taskGoverned ? 'Task has governed metadata.' : 'Task is not a governed scheduled task.', 'Use a Phase 3-governed scheduled task.'),
    check('approval-fresh', input.approvalFresh, 'approval-fresh', input.approvalFresh ? 'Approval envelope is fresh.' : 'Approval envelope is missing, invalid or expired.', 'Reapprove the scheduled task scope.'),
    input.action === 'preview'
      ? warn('persistence', true, 'persistence', 'Preview does not persist by design.', null)
      : check('persistence', input.persistencePerformed, 'persistence', input.persistencePerformed ? 'Scheduler mutation was performed through SchedulerService.' : 'Scheduler mutation was not performed.', 'Resolve the failing gate before retrying.'),
    check('no-direct-execution', true, 'no-direct-execution', 'Registration and lifecycle commands do not execute the scheduled workload.', null),
  ];
}

function buildReceipts(
  action: ZavorthScheduledTaskPersistenceAction,
  status: ZavorthScheduledTaskPersistenceStatus,
  runtime: Awaited<ReturnType<ZavorthScheduledTaskExecutionGatewayRuntimeService['buildSnapshot']>>,
  task: ScheduledTask | null,
  metadata: SchedulerGovernedScheduledTaskMetadata | null,
  persistencePerformed: boolean,
): ZavorthScheduledTaskPersistenceReceipt[] {
  return [
    {
      id: 'phase-3-persisted-scheduled-task-registration',
      kind: 'phase-3-persisted-scheduled-task-registration',
      status: status === 'blocked' ? 'blocked' : 'recorded',
      summary: `Persistence action ${action} resolved as ${status}.`,
    },
    {
      id: 'phase-3-runtime-consumed',
      kind: 'runtime-consumed',
      status: runtime.status === 'ready' ? 'recorded' : 'blocked',
      summary: `Consumed Phase 2 runtime status ${runtime.status}.`,
    },
    {
      id: task?.id || 'phase-3-scheduler-task-created',
      kind: action === 'pause'
        ? 'scheduler-task-paused'
        : action === 'resume'
          ? 'scheduler-task-resumed'
          : action === 'revoke'
            ? 'scheduler-task-revoked'
            : action === 'reapprove'
              ? 'scheduler-task-reapproved'
              : 'scheduler-task-created',
      status: persistencePerformed ? 'persisted' : 'skipped',
      summary: task ? `Scheduler task ${task.id} handled through SchedulerService.` : 'No scheduler task was mutated.',
    },
    {
      id: metadata?.approvedScopeHash || 'phase-3-metadata-boundary',
      kind: 'metadata-boundary',
      status: metadata ? 'recorded' : 'blocked',
      summary: metadata ? 'Governed metadata is attached to guardrail_json.' : 'Governed metadata is missing.',
    },
    {
      id: 'phase-3-execution-boundary',
      kind: 'execution-boundary',
      status: 'recorded',
      summary: 'No scheduled workload is executed during register, pause, resume, revoke or reapprove.',
    },
  ];
}

function narrativeForStatus(
  status: ZavorthScheduledTaskPersistenceStatus,
  action: ZavorthScheduledTaskPersistenceAction,
  summary: ZavorthScheduledTaskPersistenceSnapshot['summary'],
): ZavorthScheduledTaskPersistenceSnapshot['narrative'] {
  if (status === 'persisted') {
    return {
      headline: 'Governed scheduled task persisted.',
      operatorSummary: 'The approved recurring scope is now stored in SchedulerService with budget and guardrail metadata.',
      nextAction: 'Phase 4 should expose the governed schedule lifecycle cleanly across Telegram, CLI, web and Command Center projections.',
    };
  }
  if (status === 'preview_ready') {
    return {
      headline: 'Governed scheduled task is ready to persist.',
      operatorSummary: 'The runtime is ready and the metadata envelope is prepared, but no SchedulerService mutation was requested.',
      nextAction: 'Run register with an injected SchedulerService when the user confirms persistence.',
    };
  }
  if (status === 'paused' || status === 'resumed' || status === 'revoked' || status === 'reapproved') {
    return {
      headline: `Governed scheduled task ${status}.`,
      operatorSummary: `Lifecycle action ${action} was applied through SchedulerService without executing the workload.`,
      nextAction: 'Continue monitoring receipts and require reapproval if the scope changes.',
    };
  }
  return {
    headline: 'Governed scheduled task persistence is blocked.',
    operatorSummary: `Scheduler available=${summary.schedulerAvailable}, runtimeReady=${summary.runtimeReady}, taskGoverned=${summary.taskGoverned}, approvalFresh=${summary.approvalFresh}.`,
    nextAction: 'Fix scheduler availability, approval, task id or metadata before retrying.',
  };
}

function check(
  id: string,
  passed: boolean,
  kind: ZavorthScheduledTaskPersistenceCheck['kind'],
  summary: string,
  recommendation: string | null,
): ZavorthScheduledTaskPersistenceCheck {
  return {
    id,
    status: passed ? 'pass' : 'fail',
    kind,
    summary,
    recommendation: passed ? null : recommendation,
  };
}

function warn(
  id: string,
  passed: boolean,
  kind: ZavorthScheduledTaskPersistenceCheck['kind'],
  summary: string,
  recommendation: string | null,
): ZavorthScheduledTaskPersistenceCheck {
  return {
    id,
    status: passed ? 'pass' : 'warn',
    kind,
    summary,
    recommendation: passed ? null : recommendation,
  };
}

function clean(value: unknown): string {
  return String(value || '').trim();
}

function hashStable(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}
