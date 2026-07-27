import { createHash } from 'node:crypto';
import type { GatewayDecision } from '../execution/ExecutionGateway.js';
import type { Plan } from '../contracts/PlanContract.js';
import type { Task } from '../contracts/TaskContract.js';
import type { TaskSource } from '../contracts/PlatformContract.js';
import {
  ZAVORTH_SCHEDULED_TASK_RUNTIME_CONTRACT_VERSION,
  type ZavorthScheduledTaskGatewayDecisionSummary,
  type ZavorthScheduledTaskRuntimeCheck,
  type ZavorthScheduledTaskRuntimeInput,
  type ZavorthScheduledTaskRuntimeMode,
  type ZavorthScheduledTaskRuntimeReceipt,
  type ZavorthScheduledTaskRuntimeSnapshot,
  type ZavorthScheduledTaskRuntimeStatus,
} from '../contracts/ZavorthScheduledTaskRuntimeContract.js';
import type {
  ZavorthScheduledTaskInput,
  ZavorthScheduledTaskSnapshot,
} from '../contracts/ZavorthScheduledTaskContract.js';
import { ZavorthGovernedScheduledTaskRegistryService } from './ZavorthGovernedScheduledTaskRegistryService.js';

type GatewayLike = {
  submit(task: Task, plan: Plan, dryRun?: boolean): Promise<GatewayDecision>;
};

type Runtime = {
  now?: () => Date;
  cwd?: () => string;
  registry?: Pick<ZavorthGovernedScheduledTaskRegistryService, 'buildSnapshot'>;
  executionGateway?: GatewayLike | null;
};

type NormalizedTick = {
  taskId: string;
  due: boolean;
  submit: boolean;
  dryRun: boolean;
  killSwitchEnabled: boolean;
  executor: string;
  scopeOverride: {
    command: string | null;
    workspace: string | null;
    schedule: string | null;
  };
};

const DEFAULT_TASK_ID = 'scheduled-task-gate-2-preview';

export class ZavorthScheduledTaskExecutionGatewayRuntimeService {
  private readonly now: () => Date;
  private readonly registry: Pick<ZavorthGovernedScheduledTaskRegistryService, 'buildSnapshot'>;
  private readonly executionGateway: GatewayLike | null;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.registry = runtime.registry || new ZavorthGovernedScheduledTaskRegistryService({
      now: this.now,
      cwd: runtime.cwd,
    });
    this.executionGateway = runtime.executionGateway || null;
  }

  public async buildSnapshot(input: ZavorthScheduledTaskRuntimeInput = {}): Promise<ZavorthScheduledTaskRuntimeSnapshot> {
    const generatedAt = this.now().toISOString();
    const registry = this.registry.buildSnapshot(input.scheduledTask || {});
    const tick = normalizeTick(input, registry);
    const scopeInvariant = isScopeInvariant(registry, tick);
    const task = buildTask(registry, tick, generatedAt);
    const plan = buildPlan(registry, tick, task);
    const preStatus = resolvePreGatewayStatus(registry, tick, scopeInvariant);
    const gatewayDecision = await this.submitIfAllowed(preStatus, task, plan, tick);
    const status = resolveFinalStatus(preStatus, gatewayDecision, tick);
    const checks = buildChecks(registry, tick, scopeInvariant, gatewayDecision);
    const receipts = buildReceipts(status, registry, tick, scopeInvariant, gatewayDecision);
    const summary = summarize(registry, tick, scopeInvariant, gatewayDecision);

    return {
      generatedAt,
      contractVersion: ZAVORTH_SCHEDULED_TASK_RUNTIME_CONTRACT_VERSION,
      source: 'ZavorthScheduledTaskExecutionGatewayRuntimeService',
      gate: 'scheduled-task-execution-gateway',
      status,
      mode: modeForStatus(status, tick),
      registry,
      task,
      plan,
      gatewayDecision,
      checks,
      receipts,
      safety: {
        consumesStage1Registry: true,
        validatesEnvelopeOnEveryTick: true,
        preservesApprovedScope: true,
        usesExecutionGatewaySubmit: true,
        noDirectToolDispatch: true,
        dryRunIsDefaultWithoutHostGateway: true,
        killSwitchHonoredOnEveryTick: true,
        rawSecretsSerialized: false,
      },
      summary,
      commands: {
        report: 'npx tsx scripts/zavorth-scheduled-task-runtime.ts',
        json: 'npx tsx scripts/zavorth-scheduled-task-runtime.ts --json',
        submitDryRun: 'npx tsx scripts/zavorth-scheduled-task-runtime.ts --json --owner-confirmed --approval=schedule-owner-ok --submit',
        check: 'node scripts/zavorth-scheduled-task-runtime-check.mjs',
      },
      narrative: narrativeForStatus(status, summary),
    };
  }

  public formatSnapshotText(snapshot: ZavorthScheduledTaskRuntimeSnapshot): string {
    const lines = [
      'Zavorth Scheduled Task Execution Gateway Runtime - Preview engine',
      '',
      `Status: ${snapshot.status}`,
      `Mode: ${snapshot.mode}`,
      `Registry: ${snapshot.registry.status}`,
      `Due: ${snapshot.summary.due}`,
      `Submit requested: ${snapshot.summary.submitRequested}`,
      `Gateway called: ${snapshot.summary.gatewayCalled}`,
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

  private async submitIfAllowed(
    status: ZavorthScheduledTaskRuntimeStatus,
    task: Task,
    plan: Plan,
    tick: NormalizedTick,
  ): Promise<ZavorthScheduledTaskGatewayDecisionSummary> {
    if (status !== 'ready' || !tick.submit) {
      return emptyGatewayDecision(tick.dryRun, 'Gateway submit not requested.');
    }
    const gateway = this.executionGateway || (tick.dryRun ? new ScheduledTaskDryRunGateway() : null);
    if (!gateway) {
      return emptyGatewayDecision(false, 'ExecutionGateway is not available on this host.');
    }
    const decision = await gateway.submit(task, plan, tick.dryRun);
    return summarizeGatewayDecision(decision, tick.dryRun);
  }
}

class ScheduledTaskDryRunGateway implements GatewayLike {
  public async submit(task: Task, plan: Plan, dryRun = true): Promise<GatewayDecision> {
    return {
      allowed: true,
      reason: dryRun ? 'Scheduled task dry-run reached ExecutionGateway boundary.'
        : 'Scheduled task fixture gateway does not perform live execution.',
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
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        actions_executed: [],
        files_read: [],
        files_written: [],
        files_deleted: [],
        commands_executed: [],
        stdout: 'scheduled task fixture execution',
        stderr: null,
        diff_summary: null,
        artifacts: [],
        rollback_available: false,
        error_code: null,
        error_message: null,
        metadata: {
          fixture: true,
          noExternalIo: true,
        },
      },
    };
  }
}

function normalizeTick(input: ZavorthScheduledTaskRuntimeInput, registry: ZavorthScheduledTaskSnapshot): NormalizedTick {
  const tick = input.tick || {};
  return {
    taskId: clean(tick.taskId) || deterministicId(registry),
    due: tick.due !== false,
    submit: tick.submit === true,
    dryRun: tick.dryRun !== false,
    killSwitchEnabled: tick.killSwitchEnabled === true,
    executor: clean(tick.executor) || 'local',
    scopeOverride: {
      command: clean(tick.scopeOverride?.command) || null,
      workspace: clean(tick.scopeOverride?.workspace) || null,
      schedule: clean(tick.scopeOverride?.schedule) || null,
    },
  };
}

function resolvePreGatewayStatus(
  registry: ZavorthScheduledTaskSnapshot,
  tick: NormalizedTick,
  scopeInvariant: boolean,
): ZavorthScheduledTaskRuntimeStatus {
  if (registry.status === 'needs_reapproval') return 'needs_reapproval';
  if (registry.status === 'expired') return 'expired';
  if (registry.status !== 'active') return 'blocked';
  if (tick.killSwitchEnabled || !scopeInvariant) return 'blocked';
  if (!tick.due) return 'not_due';
  return 'ready';
}

function resolveFinalStatus(
  preStatus: ZavorthScheduledTaskRuntimeStatus,
  gatewayDecision: ZavorthScheduledTaskGatewayDecisionSummary,
  tick: NormalizedTick,
): ZavorthScheduledTaskRuntimeStatus {
  if (preStatus !== 'ready' || !tick.submit) return preStatus;
  if (!gatewayDecision.called) return 'gateway_unavailable';
  if (!gatewayDecision.allowed) return 'gateway_blocked';
  if (gatewayDecision.executionSuccess === false) return 'gateway_failed';
  if (tick.dryRun) return 'dry_run_submitted';
  if (gatewayDecision.executionSuccess === true) return 'completed';
  return 'submitted';
}

function buildTask(registry: ZavorthScheduledTaskSnapshot, tick: NormalizedTick, nowIso: string): Task {
  const source = sourceForSurface(registry.scope.surface);
  const riskLevel = Math.max(
    registry.budget.maxMutations > 0 ? 3 : 1,
    registry.budget.maxCommands > 0 ? 2 : 1,
    registry.budget.maxNetworkRequests > 0 ? 2 : 1,
  );
  return {
    task_id: tick.taskId,
    created_at: nowIso,
    updated_at: nowIso,
    source,
    chat_id: `${source}:scheduled`,
    user_id: registry.scope.createdBy,
    raw_message: registry.scope.command,
    normalized_message: registry.scope.command,
    command_type: 'scheduled_task',
    intent: registry.scope.intent,
    target: null,
    workspace: registry.scope.workspace,
    risk_level: riskLevel,
    status: 'approved',
    requires_planning: false,
    requires_approval: false,
    approval_status: registry.approvalVerification.ok ? 'approved' : 'pending',
    planner_used: 'scheduled-task-runtime-gate-2',
    executor_used: null,
    fallback_used: false,
    parent_task_id: null,
    actions_planned: [],
    actions_executed: [],
    target_files: [],
    artifacts: [],
    stdout_summary: null,
    stderr_summary: null,
    diff_summary: null,
    result_summary: null,
    error_summary: null,
    rollback_available: false,
    metadata: {
      scheduledTaskRuntime: 'gate-2-scheduled-task-execution-gateway',
      scheduledTaskApprovalId: registry.approvalEnvelope?.approvalId || null,
      schedule: registry.schedule?.normalized || null,
      budget: registry.budget,
      dryRun: tick.dryRun,
    },
  };
}

function buildPlan(registry: ZavorthScheduledTaskSnapshot, tick: NormalizedTick, task: Task): Plan {
  return {
    plan_id: `plan-${tick.taskId}`,
    task_id: task.task_id,
    objective: registry.scope.intent,
    context: 'Recurring task generated from a verified governed scheduled-task scope.',
    assumptions: [
      'The recurring task may not expand beyond the signed scope.',
      'The approval envelope is revalidated on every tick.',
      'The scheduler never dispatches tools directly.',
    ],
    executor_recommendation: tick.executor,
    workspace_recommendation: registry.scope.workspace,
    risk_level: task.risk_level,
    requires_approval: false,
    steps: [
      {
        step_id: 'scheduled-task-dispatch',
        type: 'analyze',
        description: 'Dispatch the approved recurring task through the normal agent execution plane.',
        tool: 'scheduled_task_dispatch',
        args: {
          intent: registry.scope.intent,
          command: registry.scope.command,
          allowedTools: registry.scope.allowedTools,
          schedule: registry.schedule?.normalized || null,
          budget: registry.budget,
        },
        command: null,
        file_targets: [registry.scope.workspace],
        expected_output: 'Recurring task processed through ExecutionGateway.',
        sensitive: task.risk_level >= 3,
      },
    ],
    validation_steps: [
      'Verify that the result stayed inside the approved scope.',
      'Record a recurring execution receipt.',
    ],
    success_condition: 'ExecutionGateway accepted or completed the scheduled task without scope expansion.',
    rollback_condition: 'Pause the scheduled task and request re-approval if scope, policy, mode or budget checks fail.',
    notes: [
      'Preview engine consumes the Intent model registry snapshot.',
      'A real host must inject ExecutionGateway for non-dry-run execution.',
    ],
  };
}

function buildChecks(
  registry: ZavorthScheduledTaskSnapshot,
  tick: NormalizedTick,
  scopeInvariant: boolean,
  gatewayDecision: ZavorthScheduledTaskGatewayDecisionSummary,
): ZavorthScheduledTaskRuntimeCheck[] {
  return [
    check('registry-active', registry.status === 'active', 'registry-active', `Registry status is ${registry.status}.`, 'Complete Intent model approval before runtime ticks.'),
    check('due-window', tick.due, 'due-window', tick.due ? 'Scheduled task is due now.' : 'Scheduled task is not due yet.', 'Wait until next_run before submitting to ExecutionGateway.'),
    warn('submit-request', tick.submit, 'submit-request', tick.submit ? 'Tick requested ExecutionGateway submit.' : 'Tick only prepared the gateway task and plan.', 'Submit only from the scheduler tick path.'),
    check('scope-envelope-fresh', registry.approvalVerification.ok, 'scope-envelope-fresh', `Approval verification: ${registry.approvalVerification.reason}.`, 'Renew the signed scheduled-task approval envelope.'),
    check('scope-invariance', scopeInvariant, 'scope-invariance', scopeInvariant ? 'No scope override was detected.' : 'A tick tried to alter command, workspace or schedule.', 'Reject scope changes and ask the owner to approve a new schedule.'),
    check('kill-switch', !tick.killSwitchEnabled, 'kill-switch', tick.killSwitchEnabled ? 'Runtime kill switch is enabled.' : 'Runtime kill switch is clear.', 'Disable the kill switch before recurring execution.'),
    check('budget-boundary', registry.checks.every((item) => item.kind !== 'budget-boundary' || item.status !== 'fail'), 'budget-boundary', 'Budget boundary from Intent model was consumed.', 'Lower recurring task budget before execution.'),
    tick.submit
      ? check('execution-gateway', gatewayDecision.called && gatewayDecision.allowed, 'execution-gateway', gatewayDecision.called ? `Gateway reason: ${gatewayDecision.reason || 'none'}.` : 'ExecutionGateway was not called.', 'Inject an ExecutionGateway or use dry-run for preview.')
      : warn('execution-gateway', true, 'execution-gateway', 'ExecutionGateway call is pending until a due scheduler tick submits.', null),
    check('no-direct-dispatch', true, 'no-direct-dispatch', 'No tool, command, network call or workspace mutation bypasses ExecutionGateway.', null),
  ];
}

function buildReceipts(
  status: ZavorthScheduledTaskRuntimeStatus,
  registry: ZavorthScheduledTaskSnapshot,
  tick: NormalizedTick,
  scopeInvariant: boolean,
  gatewayDecision: ZavorthScheduledTaskGatewayDecisionSummary,
): ZavorthScheduledTaskRuntimeReceipt[] {
  return [
    {
      id: 'gate-2-scheduled-task-execution-gateway',
      kind: 'gate-2-scheduled-task-execution-gateway',
      status: status === 'blocked' ? 'blocked' : 'recorded',
      summary: `Scheduled task runtime status is ${status}.`,
    },
    {
      id: 'gate-2-registry-consumed',
      kind: 'registry-consumed',
      status: registry.status === 'active' ? 'recorded' : 'blocked',
      summary: `Consumed Intent model registry snapshot with status ${registry.status}.`,
    },
    {
      id: registry.approvalEnvelope?.approvalId || 'gate-2-scope-revalidated',
      kind: 'scope-revalidated',
      status: registry.approvalVerification.ok ? 'recorded' : 'blocked',
      summary: `Approval envelope revalidation result: ${registry.approvalVerification.reason}.`,
    },
    {
      id: 'gate-2-scope-invariance',
      kind: 'scope-invariance',
      status: scopeInvariant ? 'recorded' : 'blocked',
      summary: scopeInvariant ? 'Tick preserved the approved command, workspace and schedule.' : 'Tick tried to change the approved scope.',
    },
    {
      id: 'gate-2-gateway-submit',
      kind: 'gateway-submit',
      status: gatewayDecision.called ? 'submitted' : tick.submit ? 'blocked' : 'skipped',
      summary: gatewayDecision.called ? 'Tick entered ExecutionGateway.submit().' : 'Tick did not submit to ExecutionGateway.',
    },
    {
      id: gatewayDecision.executionId || 'gate-2-gateway-result',
      kind: 'gateway-result',
      status: gatewayDecision.called && gatewayDecision.allowed ? 'recorded' : gatewayDecision.called ? 'failed' : 'skipped',
      summary: gatewayDecision.reason || 'No gateway result was produced.',
    },
    {
      id: 'gate-2-execution-boundary',
      kind: 'execution-boundary',
      status: 'recorded',
      summary: 'Scheduler path delegates through ExecutionGateway and does not directly execute tools.',
    },
  ];
}

function summarize(
  registry: ZavorthScheduledTaskSnapshot,
  tick: NormalizedTick,
  scopeInvariant: boolean,
  gatewayDecision: ZavorthScheduledTaskGatewayDecisionSummary,
): ZavorthScheduledTaskRuntimeSnapshot['summary'] {
  return {
    registryActive: registry.status === 'active',
    due: tick.due,
    submitRequested: tick.submit,
    dryRun: tick.dryRun,
    scopeInvariant,
    gatewayCalled: gatewayDecision.called,
    gatewayAllowed: gatewayDecision.allowed,
    executionPerformed: gatewayDecision.executionSuccess === true && !tick.dryRun,
    blockedByKillSwitch: tick.killSwitchEnabled,
  };
}

function modeForStatus(status: ZavorthScheduledTaskRuntimeStatus, tick: NormalizedTick): ZavorthScheduledTaskRuntimeMode {
  if (status === 'not_due') return 'not-due';
  if (status === 'dry_run_submitted') return 'gateway-dry-run';
  if (status === 'submitted' || status === 'completed') return 'gateway-live';
  if (status === 'gateway_blocked' || status === 'gateway_failed' || status === 'gateway_unavailable' || status === 'blocked') return 'gateway-block';
  return tick.submit ? 'gateway-dry-run' : 'hold';
}

function narrativeForStatus(
  status: ZavorthScheduledTaskRuntimeStatus,
  summary: ZavorthScheduledTaskRuntimeSnapshot['summary'],
): ZavorthScheduledTaskRuntimeSnapshot['narrative'] {
  if (status === 'dry_run_submitted') {
    return {
      headline: 'Scheduled task reached ExecutionGateway in dry-run mode.',
      operatorSummary: 'The due tick consumed the signed Intent model registry and entered the gateway without performing live execution.',
      nextAction: 'Approval gate should add channel commands and scheduler persistence around this runtime path.',
    };
  }
  if (status === 'completed' || status === 'submitted') {
    return {
      headline: 'Scheduled task entered live ExecutionGateway execution.',
      operatorSummary: 'A host-provided ExecutionGateway accepted the recurring tick under the pre-approved scope.',
      nextAction: 'Monitor receipts, failures and budget counters before allowing broader recurring automation.',
    };
  }
  if (status === 'ready') {
    return {
      headline: 'Scheduled task is ready for a due tick.',
      operatorSummary: 'The registry is active, the scope is invariant and the runtime can submit when the scheduler tick fires.',
      nextAction: 'Submit only when the scheduler says the task is due.',
    };
  }
  return {
    headline: 'Scheduled task runtime is holding execution.',
    operatorSummary: `Registry active=${summary.registryActive}, due=${summary.due}, gatewayCalled=${summary.gatewayCalled}, killSwitch=${summary.blockedByKillSwitch}.`,
    nextAction: 'Resolve approval, schedule, scope or gateway availability before executing recurring work.',
  };
}

function isScopeInvariant(registry: ZavorthScheduledTaskSnapshot, tick: NormalizedTick): boolean {
  const commandOk = !tick.scopeOverride.command || tick.scopeOverride.command === registry.scope.command;
  const workspaceOk = !tick.scopeOverride.workspace || normalizePath(tick.scopeOverride.workspace) === normalizePath(registry.scope.workspace);
  const scheduleOk = !tick.scopeOverride.schedule || tick.scopeOverride.schedule === registry.schedule?.normalized;
  return commandOk && workspaceOk && scheduleOk;
}

function summarizeGatewayDecision(decision: GatewayDecision, dryRun: boolean): ZavorthScheduledTaskGatewayDecisionSummary {
  return {
    called: true,
    dryRun,
    allowed: decision.allowed,
    requiresConfirmation: decision.requires_confirmation,
    reason: clean(decision.reason) || null,
    traceId: decision.correlation?.traceId || null,
    executionSuccess: decision.execution_result ? decision.execution_result.success : null,
    executionId: decision.execution_result?.execution_id || null,
    executor: decision.execution_result?.executor || null,
    rawDecisionSerialized: false,
  };
}

function emptyGatewayDecision(dryRun: boolean, reason: string): ZavorthScheduledTaskGatewayDecisionSummary {
  return {
    called: false,
    dryRun,
    allowed: false,
    requiresConfirmation: false,
    reason,
    traceId: null,
    executionSuccess: null,
    executionId: null,
    executor: null,
    rawDecisionSerialized: false,
  };
}

function check(
  id: string,
  passed: boolean,
  kind: ZavorthScheduledTaskRuntimeCheck['kind'],
  summary: string,
  recommendation: string | null,
): ZavorthScheduledTaskRuntimeCheck {
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
  kind: ZavorthScheduledTaskRuntimeCheck['kind'],
  summary: string,
  recommendation: string | null,
): ZavorthScheduledTaskRuntimeCheck {
  return {
    id,
    status: passed ? 'pass' : 'warn',
    kind,
    summary,
    recommendation: passed ? null : recommendation,
  };
}

function deterministicId(registry: ZavorthScheduledTaskSnapshot): string {
  const seed = [
    registry.scope.intent,
    registry.scope.command,
    registry.schedule?.normalized || 'invalid',
    registry.scope.workspace,
    registry.approvalEnvelope?.approvalId || 'no-approval',
  ].join('\n');
  const hash = createHash('sha256').update(seed).digest('hex').slice(0, 16);
  return `${DEFAULT_TASK_ID}-${hash}`;
}

function sourceForSurface(surface: string): TaskSource {
  if (surface === 'command_center') return 'web';
  const allowed = new Set<TaskSource>([
    'telegram',
    'discord',
    'whatsapp',
    'instagram',
    'slack',
    'signal',
    'imessage',
    'teams',
    'email',
    'web',
    'cli',
    'api',
    'system',
    'bridge',
  ]);
  return allowed.has(surface as TaskSource) ? surface as TaskSource : 'system';
}

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function clean(value: unknown): string {
  return String(value || '').trim();
}
