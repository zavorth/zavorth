import { ZavorthScheduledTaskExecutionGatewayRuntimeService } from './ZavorthScheduledTaskExecutionGatewayRuntimeService.js';
import type { GatewayDecision } from '../execution/ExecutionGateway.js';
import type { Plan } from '../contracts/PlanContract.js';
import type { Task } from '../contracts/TaskContract.js';
import type { ScheduledTask } from '../storage/SchedulerRepository.js';
import type {
  SchedulerGovernedScheduledTaskMetadata,
  SchedulerTaskRuntimeDescriptor,
} from './SchedulerService.js';

import { ZavorthScheduledTaskOperationalGuardService } from './ZavorthScheduledTaskOperationalGuardService.js';
import {
  ZAVORTH_SCHEDULED_TASK_LIVE_TICK_CERTIFICATION_CONTRACT_VERSION,
  type ZavorthScheduledTaskLiveTickBlockReason,
  type ZavorthScheduledTaskLiveTickCertificationInput,
  type ZavorthScheduledTaskLiveTickCertificationSnapshot,
  type ZavorthScheduledTaskLiveTickCertificationStatus,
  type ZavorthScheduledTaskLiveTickReceipt,
  type ZavorthScheduledTaskLiveTickScenario,
  type ZavorthScheduledTaskLiveTickScenarioId,
  type ZavorthScheduledTaskLiveTickScenarioStatus,
} from '../contracts/ZavorthScheduledTaskLiveTickCertificationContract.js';
import type { ZavorthScheduledTaskInput } from '../contracts/ZavorthScheduledTaskContract.js';
import type { ZavorthScheduledTaskOperationalGuardSnapshot } from '../contracts/ZavorthScheduledTaskOperationalGuardContract.js';
import type { ZavorthScheduledTaskRuntimeSnapshot } from '../contracts/ZavorthScheduledTaskRuntimeContract.js';
import { logger } from '../logger.js';

type SchedulerLiveTickLike = {
  listTasks(includePaused?: boolean): ScheduledTask[];
  getTask?(id: string): ScheduledTask | null;
  findTaskByPrefix?(idPrefix: string): ScheduledTask | null;
  pauseTask?(id: string, reason?: string | null): ScheduledTask | null;
  describeTaskRuntime?(task: ScheduledTask): SchedulerTaskRuntimeDescriptor;
};

type GatewayLike = {
  submit(task: Task, plan: Plan, dryRun?: boolean): Promise<GatewayDecision>;
};

type Runtime = {
  schedulerService?: SchedulerLiveTickLike | null;
  executionGateway?: GatewayLike | null;
  now?: () => Date;
  cwd?: () => string;
};

type CertificationContext = {
  scheduler: SchedulerLiveTickLike;
  guard: ZavorthScheduledTaskOperationalGuardSnapshot;
  dryRun: boolean;
  gateway: GatewayLike;
};

const FIXTURE_NOW = '2026-05-12T10:00:00.000Z';

export class ZavorthScheduledTaskLiveTickCertificationService {
  private readonly scheduler: SchedulerLiveTickLike | null;
  private readonly executionGateway: GatewayLike | null;
  private readonly now: () => Date;
  private readonly cwd: () => string;

  public constructor(runtime: Runtime = {}) {
    this.scheduler = runtime.schedulerService || null;
    this.executionGateway = runtime.executionGateway || null;
    this.now = runtime.now || (() => new Date());
    this.cwd = runtime.cwd || (() => process.cwd());
  }

  public async buildSnapshot(
    input: ZavorthScheduledTaskLiveTickCertificationInput = {},
  ): Promise<ZavorthScheduledTaskLiveTickCertificationSnapshot> {
    const generatedAt = this.nowFromInput(input).toISOString();
    const scenario = normalizeScenario(input.scenario);
    const dryRun = input.dryRun === true;
    const scheduler = this.scheduler || new FixtureScheduler(scenario);
    const gateway = this.executionGateway || new FixtureExecutionGateway(() => this.nowFromInput(input));
    const guard = new ZavorthScheduledTaskOperationalGuardService({
      schedulerService: scheduler,
      now: () => this.nowFromInput(input),
    }).buildSnapshot({ applyAutoPause: input.applyAutoPause === true });
    const context = { scheduler, guard, dryRun, gateway };
    const scenarios = await this.resolveScenarios(input, scenario, context);
    const runtimeSnapshots = scenarios
      .filter((scenarioResult) => scenarioResult.runtime)
      .map((scenarioResult) => ({
        scenarioId: scenarioResult.scenario.id,
        status: scenarioResult.runtime!.status,
        gatewayCalled: scenarioResult.runtime!.summary.gatewayCalled,
        executionPerformed: scenarioResult.runtime!.summary.executionPerformed,
        runtime: scenarioResult.runtime!,
      }));
    const scenarioCards = scenarios.map((entry) => entry.scenario);
    const summary = {
      scenarios: scenarioCards.length,
      passedScenarios: scenarioCards.filter((entry) => entry.expectedBehaviorObserved).length,
      blockedBeforeGateway: scenarioCards.filter((entry) => entry.blockReason !== 'none' && !entry.gatewayCalled).length,
      gatewaySubmitted: scenarioCards.filter((entry) => entry.gatewayCalled).length,
      executionPerformed: scenarioCards.filter((entry) => entry.executionPerformed).length,
      autoPaused: scenarioCards.filter((entry) => entry.autoPauseApplied).length,
      hostTasksCertified: scenarioCards.filter((entry) => entry.id === 'host_task').length,
    };
    const status = resolveSnapshotStatus(summary, scenarioCards);
    const receipts = buildReceipts(status, scenarioCards, guard);

    return {
      generatedAt,
      contractVersion: ZAVORTH_SCHEDULED_TASK_LIVE_TICK_CERTIFICATION_CONTRACT_VERSION,
      source: 'ZavorthScheduledTaskLiveTickCertificationService',
      gate: 'scheduler-live-tick-certification',
      status,
      summary,
      guard,
      scenarios: scenarioCards,
      runtimeSnapshots,
      receipts,
      safety: {
        consumesPersistedGovernedMetadata: true,
        appliesOperationalGuardBeforeGateway: true,
        validatesApprovalOnTick: true,
        blocksExpiredApproval: true,
        blocksScopeDrift: true,
        routesThroughExecutionGateway: true,
        noDirectDispatcherBypass: true,
        fixtureHasNoExternalIo: true,
        rawSecretsSerialized: false,
      },
      commands: {
        report: 'npx tsx scripts/zavorth-scheduled-task-live-tick-certification.ts',
        json: 'npx tsx scripts/zavorth-scheduled-task-live-tick-certification.ts --json',
        hostTask: 'npx tsx scripts/zavorth-scheduled-task-live-tick-certification.ts --json --task=<id>',
        check: 'node scripts/zavorth-scheduled-task-live-tick-certification-check.mjs',
      },
      narrative: narrativeForStatus(status, summary),
    };
  }

  public renderReport(snapshot: ZavorthScheduledTaskLiveTickCertificationSnapshot): string {
    const lines = [
      'Scheduled Task Live Tick Certification - Runtime gateway',
      '',
      `Status: ${snapshot.status}`,
      snapshot.narrative.operatorSummary,
      `Scenarios: ${snapshot.summary.passedScenarios}/${snapshot.summary.scenarios} passed`,
      `Gateway submits: ${snapshot.summary.gatewaySubmitted}`,
      `Blocked before gateway: ${snapshot.summary.blockedBeforeGateway}`,
      `Auto-paused: ${snapshot.summary.autoPaused}`,
      '',
      'Scenarios:',
      ...snapshot.scenarios.map((scenario) =>
        `- ${scenario.id}: ${scenario.status} | gateway=${scenario.gatewayCalled} | block=${scenario.blockReason} | ${scenario.summary}`),
      '',
      `Next: ${snapshot.narrative.nextAction}`,
    ];
    return lines.join('\n');
  }

  private async resolveScenarios(
    input: ZavorthScheduledTaskLiveTickCertificationInput,
    scenario: ZavorthScheduledTaskLiveTickScenarioId | 'all',
    context: CertificationContext,
  ): Promise<Array<{ scenario: ZavorthScheduledTaskLiveTickScenario; runtime: ZavorthScheduledTaskRuntimeSnapshot | null }>> {
    if (input.taskId) {
      const task = findTask(context.scheduler, input.taskId);
      return [await this.certifyTask('host_task', task, context)];
    }
    const scenarios = scenario === 'all'
      ? [
        'valid_gateway_submit',
        'expired_approval_block',
        'scope_drift_block',
        'legacy_task_block',
        'failure_auto_pause_block',
      ] as ZavorthScheduledTaskLiveTickScenarioId[]
      : [scenario];
    const results = [];
    for (const entry of scenarios) {
      results.push(await this.certifyTask(entry, findFixtureTask(context.scheduler, entry), context));
    }
    return results;
  }

  private async certifyTask(
    scenarioId: ZavorthScheduledTaskLiveTickScenarioId,
    task: ScheduledTask | null,
    context: CertificationContext,
  ): Promise<{ scenario: ZavorthScheduledTaskLiveTickScenario; runtime: ZavorthScheduledTaskRuntimeSnapshot | null }> {
    if (!task) {
      return {
        scenario: buildScenarioCard({
          id: scenarioId,
          task,
          guard: context.guard,
          blockReason: 'missing_task',
          runtime: null,
          expected: false,
          summary: 'No scheduled task was available for certification.',
        }),
        runtime: null,
      };
    }

    const metadata = readGovernedMetadata(task);
    const guardTask = context.guard.tasks.find((entry) => entry.id === task.id) || null;
    const scopeInvariant = metadata ? isScopeInvariant(task, metadata) : false;
    const blockReason = resolveBlockReason(task, metadata, guardTask, scopeInvariant);
    if (blockReason !== 'none') {
      return {
        scenario: buildScenarioCard({
          id: scenarioId,
          task: currentTask(context.scheduler, task),
          guard: context.guard,
          blockReason,
          runtime: null,
          expected: expectedBlockedScenario(scenarioId, blockReason),
          summary: summaryForBlock(blockReason),
        }),
        runtime: null,
      };
    }

    const runtime = await new ZavorthScheduledTaskExecutionGatewayRuntimeService({
      now: this.now,
      cwd: () => metadata!.approvedScope.workspace || this.cwd(),
      executionGateway: context.gateway,
    }).buildSnapshot({
      scheduledTask: buildRuntimeInputFromPersistedTask(task, metadata!, this.now()),
      tick: {
        taskId: task.id,
        due: true,
        submit: true,
        dryRun: context.dryRun,
        executor: 'local',
        scopeOverride: {
          command: task.command,
          workspace: metadata!.approvedScope.workspace,
          schedule: task.schedule,
        },
      },
    });
    const runtimeBlock = runtime.summary.gatewayCalled && !runtime.summary.gatewayAllowed
      ? 'gateway_rejected'
      : runtime.summary.gatewayCalled
        ? 'none'
        : 'runtime_not_ready';
    return {
      scenario: buildScenarioCard({
        id: scenarioId,
        task,
        guard: context.guard,
        blockReason: runtimeBlock,
        runtime,
        expected: expectedRuntimeScenario(scenarioId, runtime),
        summary: runtime.summary.gatewayCalled
          ? 'Persisted scheduled task reached ExecutionGateway through the certified path.'
          : `Runtime held the tick with status ${runtime.status}.`,
      }),
      runtime,
    };
  }

  private nowFromInput(input: ZavorthScheduledTaskLiveTickCertificationInput): Date {
    const value = String(input.now || '').trim();
    if (!value) return this.now();
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : this.now();
  }
}

class FixtureExecutionGateway implements GatewayLike {
  public constructor(private readonly now: () => Date) {}

  public async submit(task: Task, plan: Plan, dryRun = false): Promise<GatewayDecision> {
    const now = this.now().toISOString();
    return {
      allowed: true,
      reason: 'Runtime gateway fixture gateway accepted the governed scheduled tick without external IO.',
      requires_confirmation: false,
      correlation: {
        traceId: `trace-${task.task_id}`,
        runId: `run-${task.task_id}`,
        sessionId: task.chat_id,
        approvalId: task.metadata.scheduledTaskApprovalId || null,
        artifactId: null,
      },
      lifecycle: [],
      policy_evaluation: { allowed: true, violations: [], warnings: [] },
      risk_classification: null,
      mode_sufficient: true,
      execution_result: dryRun ? null : {
        execution_id: `exec-${plan.plan_id}`,
        task_id: task.task_id,
        executor: plan.executor_recommendation,
        success: true,
        started_at: now,
        finished_at: now,
        actions_executed: [],
        files_read: [],
        files_written: [],
        files_deleted: [],
        commands_executed: [],
        stdout: 'checkpoint-6 scheduled task fixture execution',
        stderr: null,
        diff_summary: null,
        artifacts: [],
        rollback_available: false,
        error_code: null,
        error_message: null,
        metadata: {
          fixture: true,
          noExternalIo: true,
          gate: 'scheduler-live-tick-certification',
        },
      },
    };
  }
}

class FixtureScheduler implements SchedulerLiveTickLike {
  private readonly tasks: ScheduledTask[];

  public constructor(scenario: ZavorthScheduledTaskLiveTickScenarioId | 'all') {
    this.tasks = buildFixtureTasks(scenario);
  }

  public listTasks(includePaused = true): ScheduledTask[] {
    const tasks = includePaused ? this.tasks : this.tasks.filter((task) => task.status === 'active');
    return tasks.map((task) => ({ ...task }));
  }

  public getTask(id: string): ScheduledTask | null {
    const task = this.tasks.find((entry) => entry.id === id) || null;
    return task ? { ...task } : null;
  }

  public findTaskByPrefix(idPrefix: string): ScheduledTask | null {
    const normalized = String(idPrefix || '').trim().toLowerCase();
    const task = this.tasks.find((entry) => entry.id.toLowerCase().startsWith(normalized)) || null;
    return task ? { ...task } : null;
  }

  public pauseTask(id: string, reason?: string | null): ScheduledTask | null {
    const task = this.tasks.find((entry) => entry.id === id) || null;
    if (!task) return null;
    task.status = 'paused';
    task.paused_reason = reason || null;
    return { ...task };
  }

  public describeTaskRuntime(task: ScheduledTask): SchedulerTaskRuntimeDescriptor {
    const guardrails = readGuardrails(task);
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
        idempotencyKeySeed: 'checkpoint-6-fixture',
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
}

function buildFixtureTasks(scenario: ZavorthScheduledTaskLiveTickScenarioId | 'all'): ScheduledTask[] {
  const stableFutureApproval = '2099-05-19T10:00:00.000Z';
  const fixtures: Record<Exclude<ZavorthScheduledTaskLiveTickScenarioId, 'host_task'>, ScheduledTask> = {
    valid_gateway_submit: makeTask('valid-gateway-submit', governedMetadata('valid-approval', stableFutureApproval)),
    expired_approval_block: makeTask('expired-approval-block', governedMetadata('expired-approval', '2026-05-11T10:00:00.000Z')),
    scope_drift_block: {
      ...makeTask('scope-drift-block', governedMetadata('drift-approval', stableFutureApproval)),
      command: '/gateway tampered',
    },
    legacy_task_block: makeTask('legacy-task-block', null),
    failure_auto_pause_block: {
      ...makeTask('failure-auto-pause-block', governedMetadata('failing-approval', stableFutureApproval)),
      last_status: 'failed',
      consecutive_failures: 3,
    },
  };
  if (scenario === 'all') return Object.values(fixtures);
  return scenario === 'host_task' ? [] : [fixtures[scenario]];
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
    gate: 'persisted-scheduled-task-registration',
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

function buildRuntimeInputFromPersistedTask(
  task: ScheduledTask,
  metadata: SchedulerGovernedScheduledTaskMetadata,
  now: Date,
): ZavorthScheduledTaskInput {
  const remainingTtlMs = remainingApprovalTtlMs(now, metadata.approvalExpiresAt);
  return {
    intent: metadata.approvedScope.intent,
    command: task.command,
    schedule: task.schedule,
    workspace: metadata.approvedScope.workspace,
    surface: metadata.approvedScope.surface as ZavorthScheduledTaskInput['surface'],
    createdBy: metadata.approvedScope.createdBy,
    allowedTools: metadata.approvedScope.allowedTools,
    budget: metadata.approvedBudget,
    approval: {
      ownerConfirmed: true,
      approvalId: metadata.approvalId || `persisted-${task.id}`,
      approvedBy: metadata.approvedScope.createdBy,
      ttlMs: remainingTtlMs,
    },
    policy: {
      requireApproval: true,
      killSwitchEnabled: false,
      noCompound: true,
      renewalPolicy: metadata.renewalPolicy as ZavorthScheduledTaskInput['policy'] extends infer T
        ? T extends { renewalPolicy?: infer R } ? R : never
        : never,
    },
  };
}

function remainingApprovalTtlMs(now: Date, expiresAt: string | null): number {
  const parsed = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  if (!Number.isFinite(parsed)) return 7 * 24 * 60 * 60 * 1000;
  return Math.max(60 * 1000, parsed - now.getTime());
}

function buildScenarioCard(input: {
  id: ZavorthScheduledTaskLiveTickScenarioId;
  task: ScheduledTask | null;
  guard: ZavorthScheduledTaskOperationalGuardSnapshot;
  blockReason: ZavorthScheduledTaskLiveTickBlockReason;
  runtime: ZavorthScheduledTaskRuntimeSnapshot | null;
  expected: boolean;
  summary: string;
}): ZavorthScheduledTaskLiveTickScenario {
  const guardTask = input.task
    ? input.guard.tasks.find((entry) => entry.id === input.task!.id) || null
    : null;
  const status = resolveScenarioStatus(input.blockReason, input.runtime, guardTask);
  const receiptIds = [
    ...input.guard.receipts.map((receipt) => receipt.id),
    ...(input.runtime?.receipts.map((receipt) => receipt.id) || []),
  ].slice(0, 12);
  return {
    id: input.id,
    label: labelForScenario(input.id),
    status,
    expectedBehaviorObserved: input.expected,
    taskId: input.task?.id || null,
    taskStatus: input.task?.status || null,
    blockReason: input.blockReason,
    gatewayCalled: input.runtime?.summary.gatewayCalled || false,
    gatewayAllowed: input.runtime?.summary.gatewayAllowed || false,
    executionPerformed: input.runtime?.summary.executionPerformed || false,
    runtimeStatus: input.runtime?.status || null,
    operationalStatus: guardTask?.operationalStatus || null,
    scopeInvariant: input.runtime?.summary.scopeInvariant ?? input.blockReason !== 'scope_drift',
    autoPauseApplied: guardTask?.operationalStatus === 'auto_paused',
    receiptIds,
    summary: input.summary,
  };
}

function resolveScenarioStatus(
  blockReason: ZavorthScheduledTaskLiveTickBlockReason,
  runtime: ZavorthScheduledTaskRuntimeSnapshot | null,
  guardTask: { operationalStatus: string } | null,
): ZavorthScheduledTaskLiveTickScenarioStatus {
  if (guardTask?.operationalStatus === 'auto_paused') return 'auto_paused';
  if (blockReason !== 'none') return 'blocked';
  if (runtime?.summary.gatewayCalled && runtime.summary.gatewayAllowed) return 'passed';
  return 'failed';
}

function expectedBlockedScenario(
  scenarioId: ZavorthScheduledTaskLiveTickScenarioId,
  blockReason: ZavorthScheduledTaskLiveTickBlockReason,
): boolean {
  if (scenarioId === 'expired_approval_block') return blockReason === 'approval_expired';
  if (scenarioId === 'scope_drift_block') return blockReason === 'scope_drift';
  if (scenarioId === 'legacy_task_block') return blockReason === 'legacy_task';
  if (scenarioId === 'failure_auto_pause_block') return blockReason === 'auto_pause_required';
  return scenarioId === 'host_task' && blockReason !== 'missing_task';
}

function expectedRuntimeScenario(
  scenarioId: ZavorthScheduledTaskLiveTickScenarioId,
  runtime: ZavorthScheduledTaskRuntimeSnapshot,
): boolean {
  if (scenarioId === 'valid_gateway_submit') {
    return runtime.summary.gatewayCalled && runtime.summary.gatewayAllowed;
  }
  if (scenarioId === 'host_task') {
    return runtime.summary.gatewayCalled || runtime.status === 'dry_run_submitted';
  }
  return false;
}

function resolveBlockReason(
  task: ScheduledTask,
  metadata: SchedulerGovernedScheduledTaskMetadata | null,
  guardTask: { operationalStatus: string; approvalExpired?: boolean } | null,
  scopeInvariant: boolean,
): ZavorthScheduledTaskLiveTickBlockReason {
  if (!metadata) return 'legacy_task';
  if (guardTask?.approvalExpired || guardTask?.operationalStatus === 'approval_expired') return 'approval_expired';
  if (guardTask?.operationalStatus === 'auto_pause_recommended' || guardTask?.operationalStatus === 'auto_paused') {
    return 'auto_pause_required';
  }
  if (task.status !== 'active') return 'task_paused';
  if (!scopeInvariant) return 'scope_drift';
  return 'none';
}

function isScopeInvariant(task: ScheduledTask, metadata: SchedulerGovernedScheduledTaskMetadata): boolean {
  const taskCommand = clean(task.command);
  const approvedCommand = clean(metadata.approvedScope.command);
  const taskUser = clean(task.created_by);
  const approvedUser = clean(metadata.approvedScope.createdBy);
  return taskCommand === approvedCommand
    && (!taskUser || !approvedUser || taskUser === approvedUser)
    && metadata.executionGatewayRequired === true
    && metadata.noDirectToolDispatch === true;
}

function readGovernedMetadata(task: ScheduledTask | null): SchedulerGovernedScheduledTaskMetadata | null {
  if (!task?.guardrail_json) return null;
  try {
    const parsed = JSON.parse(task.guardrail_json);
    const metadata = parsed?.governedScheduledTask;
    if (
      metadata
      && metadata.gate === 'persisted-scheduled-task-registration'
      && typeof metadata.approvedScopeHash === 'string'
    ) {
      return metadata as SchedulerGovernedScheduledTaskMetadata;
    }
  } catch (error: unknown) {logger.warn('[Zavorth Scheduled Task Live Tick Certification] JSON parse failed', error); return null; }
  return null;
}

function readGuardrails(task: ScheduledTask): any {
  try {
    return JSON.parse(String(task.guardrail_json || '{}'));
  } catch (error: unknown) {logger.warn('[Zavorth Scheduled Task Live Tick Certification] JSON parse failed', error); return {}; }
}

function findTask(scheduler: SchedulerLiveTickLike, taskId: string): ScheduledTask | null {
  return scheduler.findTaskByPrefix?.(taskId)
    || scheduler.getTask?.(taskId)
    || scheduler.listTasks(true).find((task) => task.id === taskId)
    || null;
}

function findFixtureTask(
  scheduler: SchedulerLiveTickLike,
  scenario: ZavorthScheduledTaskLiveTickScenarioId,
): ScheduledTask | null {
  const byScenario = scheduler.listTasks(true).find((task) => task.id === scenario.replace(/_/g, '-'));
  if (byScenario) return byScenario;
  if (scenario === 'valid_gateway_submit') return findTask(scheduler, 'valid');
  if (scenario === 'expired_approval_block') return findTask(scheduler, 'expired');
  if (scenario === 'scope_drift_block') return findTask(scheduler, 'scope');
  if (scenario === 'legacy_task_block') return findTask(scheduler, 'legacy');
  if (scenario === 'failure_auto_pause_block') return findTask(scheduler, 'failure');
  return null;
}

function currentTask(scheduler: SchedulerLiveTickLike, task: ScheduledTask): ScheduledTask {
  return findTask(scheduler, task.id) || task;
}

function buildReceipts(
  status: ZavorthScheduledTaskLiveTickCertificationStatus,
  scenarios: ZavorthScheduledTaskLiveTickScenario[],
  guard: ZavorthScheduledTaskOperationalGuardSnapshot,
): ZavorthScheduledTaskLiveTickReceipt[] {
  const receipts: ZavorthScheduledTaskLiveTickReceipt[] = [
    {
      id: 'checkpoint-6-scheduled-task-live-tick-certification',
      kind: 'checkpoint-6-scheduled-task-live-tick-certification',
      status: status === 'failed' ? 'failed' : 'passed',
      summary: `Runtime gateway live tick certification status is ${status}.`,
    },
    {
      id: 'checkpoint-6-operational-guard-consumed',
      kind: 'operational-guard-consumed',
      status: guard.status === 'critical' ? 'blocked' : 'recorded',
      summary: `Operational guard scanned ${guard.summary.totalTasks} scheduled task(s) before gateway submission.`,
    },
    {
      id: 'checkpoint-6-no-direct-dispatch',
      kind: 'no-direct-dispatch',
      status: 'recorded',
      summary: 'Certified path does not invoke the scheduler dispatcher directly.',
    },
  ];
  for (const scenario of scenarios) {
    receipts.push({
      id: `checkpoint-6-${scenario.id}`,
      kind: scenario.gatewayCalled ? 'execution-gateway-submit' : 'blocked-before-gateway',
      status: scenario.gatewayCalled ? 'passed' : scenario.autoPauseApplied ? 'applied' : 'blocked',
      summary: `${scenario.id}: ${scenario.summary}`,
    });
    if (scenario.blockReason === 'scope_drift') {
      receipts.push({
        id: `checkpoint-6-${scenario.id}-scope-drift`,
        kind: 'scope-drift-check',
        status: 'blocked',
        summary: 'Scope drift was blocked before ExecutionGateway.',
      });
    }
  }
  return receipts;
}

function resolveSnapshotStatus(
  summary: ZavorthScheduledTaskLiveTickCertificationSnapshot['summary'],
  scenarios: ZavorthScheduledTaskLiveTickScenario[],
): ZavorthScheduledTaskLiveTickCertificationStatus {
  if (scenarios.some((scenario) => !scenario.expectedBehaviorObserved)) return 'failed';
  if (summary.hostTasksCertified > 0 && summary.gatewaySubmitted === 0) return 'blocked';
  if (summary.autoPaused > 0 || summary.blockedBeforeGateway > 0) return 'passed';
  return 'passed';
}

function narrativeForStatus(
  status: ZavorthScheduledTaskLiveTickCertificationStatus,
  summary: ZavorthScheduledTaskLiveTickCertificationSnapshot['summary'],
): ZavorthScheduledTaskLiveTickCertificationSnapshot['narrative'] {
  if (status === 'passed') {
    return {
      headline: 'Scheduler live tick path is certified.',
      operatorSummary: 'Governed scheduled tasks either entered ExecutionGateway or were blocked before execution for the expected safety reason.',
      nextAction: 'Use this gate before enabling broader recurring automations on a live host.',
    };
  }
  if (status === 'blocked') {
    return {
      headline: 'Host task was safely blocked.',
      operatorSummary: 'The selected host task did not enter ExecutionGateway because the pre-gateway guard found a safety condition.',
      nextAction: 'Reapprove, resume or replace the scheduled task before expecting it to run.',
    };
  }
  return {
    headline: 'Scheduler live tick certification failed.',
    operatorSummary: `${summary.passedScenarios}/${summary.scenarios} scenarios behaved as expected.`,
    nextAction: 'Inspect scenario receipts before enabling recurring automation.',
  };
}

function labelForScenario(id: ZavorthScheduledTaskLiveTickScenarioId): string {
  const labels: Record<ZavorthScheduledTaskLiveTickScenarioId, string> = {
    valid_gateway_submit: 'valid governed task enters ExecutionGateway',
    expired_approval_block: 'expired approval blocks before gateway',
    scope_drift_block: 'scope drift blocks before gateway',
    legacy_task_block: 'legacy task blocks before gateway',
    failure_auto_pause_block: 'noisy task is auto-paused before gateway',
    host_task: 'host scheduled task certification',
  };
  return labels[id];
}

function summaryForBlock(reason: ZavorthScheduledTaskLiveTickBlockReason): string {
  const summaries: Record<ZavorthScheduledTaskLiveTickBlockReason, string> = {
    none: 'Task can submit to ExecutionGateway.',
    legacy_task: 'Task has no governed scheduled-task metadata.',
    approval_expired: 'Task approval expired and requires reapproval.',
    approval_expiring: 'Task approval is expiring soon.',
    auto_pause_required: 'Task exceeded failure threshold and must be paused before running again.',
    task_paused: 'Task is already paused.',
    scope_drift: 'Persisted task no longer matches the approved command/user scope.',
    missing_task: 'Task was not found.',
    runtime_not_ready: 'Runtime did not reach gateway-ready state.',
    gateway_rejected: 'ExecutionGateway rejected the tick.',
  };
  return summaries[reason];
}

function normalizeScenario(value: unknown): ZavorthScheduledTaskLiveTickScenarioId | 'all' {
  const normalized = String(value || '').trim();
  const allowed = new Set<ZavorthScheduledTaskLiveTickScenarioId | 'all'>([
    'all',
    'valid_gateway_submit',
    'expired_approval_block',
    'scope_drift_block',
    'legacy_task_block',
    'failure_auto_pause_block',
    'host_task',
  ]);
  return allowed.has(normalized as ZavorthScheduledTaskLiveTickScenarioId | 'all')
    ? normalized as ZavorthScheduledTaskLiveTickScenarioId | 'all'
    : 'all';
}

function clean(value: unknown): string {
  return String(value || '').trim();
}

export const ZAVORTH_SCHEDULED_TASK_LIVE_TICK_FIXTURE_NOW = FIXTURE_NOW;
