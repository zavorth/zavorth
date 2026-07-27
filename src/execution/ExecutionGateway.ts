import { v4 as uuidv4 } from 'uuid';
import type { ExecutionRequest, ExecutionResult, ExecutionTiming } from '../contracts/ExecutionContract.js';
import {
  buildExecutionLifecycleRecord,
  createExecutionCorrelation,
  type ZavorthExecutionCorrelation,
  type ExecutionLifecycleRecord,
} from '../contracts/ExecutionLifecycleContract.js';
import type { IExecutor } from '../contracts/IExecutor.js';
import type { Plan } from '../contracts/PlanContract.js';
import type { Task } from '../contracts/TaskContract.js';
import { TelemetryRuntimeService } from '../observability/telemetry/TelemetryRuntimeService.js';
import { RiskClassification } from '../orchestrator/RiskClassifier.js';
import { ZavorthCorrelationTraceService } from '../services/ZavorthCorrelationTraceService.js';
import { ExecutorRecoveryService } from '../services/ExecutorRecoveryService.js';
import { HostIdentityService } from '../services/HostIdentityService.js';
import { SelfHealingService } from '../services/SelfHealingService.js';
import { ToolHookPipelineService } from '../services/ToolHookPipelineService.js';
import { LogRepository } from '../storage/LogRepository.js';
import { ModeManager, OperationalMode } from '../security/OperationalMode.js';
import { PolicyEngine, type PolicyEvaluation } from '../security/PolicyEngine.js';
import { WorkspaceResolver } from '../security/WorkspaceResolver.js';
import { config } from '../config/index.js';
import {
  resolveExecutionGatewayExecutorName,
  resolveExecutionGatewayWorkspace,
} from './execution-gateway/ExecutionGatewayAliases.js';
import {
  buildExecutionGatewayRuntimeHookContext,
  recordExecutionGatewayTelemetry,
  runExecutionGatewayRuntimeFailureHook,
  runExecutionGatewayRuntimeHook,
} from './execution-gateway/ExecutionGatewayHooks.js';
import {
  buildExecutionGatewayLifecycle,
  buildExecutionGatewayOutcomeLifecycle,
} from './execution-gateway/ExecutionGatewayLifecycle.js';
import { buildExecutionGatewayRequest } from './execution-gateway/ExecutionGatewayRequestSupport.js';
import { asErrorLike, errorMessage } from '../utils/errorLike.js';

type ExecutionGatewayRuntime = {
  defaultWorkspace?: string | null;
  hookPipelineService?: Pick<ToolHookPipelineService, 'run'>;
};

export interface GatewayDecision {
  allowed: boolean;
  reason: string;
  requires_confirmation: boolean;
  correlation: ZavorthExecutionCorrelation;
  lifecycle: ExecutionLifecycleRecord[];
  policy_evaluation: PolicyEvaluation | null;
  risk_classification: RiskClassification | null;
  mode_sufficient: boolean;
  execution_result: ExecutionResult | null;
}

/**
 * ExecutionGateway - Intermediate layer between Zavorth and any executor.
 * Single pass-through point: validates policies, mode, risk, and confirmation before running.
 */
export class ExecutionGateway {
  private policyEngine: PolicyEngine;
  private modeManager: ModeManager;
  private logRepo: LogRepository;
  private executors: Map<string, IExecutor>;
  private healer: SelfHealingService | null = null;
  private executorRecovery: ExecutorRecoveryService;
  private hostIdentityService: HostIdentityService | null = null;
  private telemetryRuntime: TelemetryRuntimeService | null;
  private defaultWorkspace: string | null;
  private hookPipeline: Pick<ToolHookPipelineService, 'run'>;
  private correlationTraceService: ZavorthCorrelationTraceService;

  constructor(
    logRepo: LogRepository,
    initialMode?: OperationalMode,
    modeStateFile?: string,
    telemetryRuntime?: TelemetryRuntimeService | null,
    runtime: ExecutionGatewayRuntime = {},
  ) {
    this.policyEngine = new PolicyEngine();
    const persistenceFile = initialMode ? null : (modeStateFile || config.operationalModeStateFile);
    this.modeManager = new ModeManager(
      initialMode || OperationalMode.WORKSPACE,
      persistenceFile,
    );
    this.logRepo = logRepo;
    this.executors = new Map();
    this.executorRecovery = new ExecutorRecoveryService();
    this.telemetryRuntime = telemetryRuntime || null;
    this.defaultWorkspace = resolveExecutionGatewayWorkspace(runtime.defaultWorkspace, null);
    this.hookPipeline = runtime.hookPipelineService || new ToolHookPipelineService();
    this.correlationTraceService = new ZavorthCorrelationTraceService();
  }

  public registerExecutor(name: string, executor: IExecutor): void {
    this.executors.set(name, executor);
  }

  public setHostIdentityService(service: HostIdentityService): void {
    this.hostIdentityService = service;
  }

  public async submit(task: Task, plan: Plan, dryRun: boolean = false): Promise<GatewayDecision> {
    const correlation = this.buildCorrelation(task);
    const traceId = correlation.traceId;
    const decision = this.createInitialDecision(task, plan, correlation);

    this.logRepo.log(
      'info',
      'ExecutionGateway',
      `Evaluating plan ${plan.plan_id} for task ${task.task_id.substring(0, 8)}`,
    );
    await recordExecutionGatewayTelemetry(
      this.telemetryRuntime,
      traceId,
      'execution.started',
      'running',
      {
        traceId,
        runId: decision.correlation.runId,
        sessionId: decision.correlation.sessionId,
        approvalId: decision.correlation.approvalId,
        artifactId: decision.correlation.artifactId,
        taskId: task.task_id,
        planId: plan.plan_id,
        executorRecommendation: plan.executor_recommendation,
        dryRun,
      },
    );

    const workspaceValidationError = this.validateWorkspaceRecommendation(plan);
    if (workspaceValidationError) {
      return this.blockDecision(decision, workspaceValidationError, 'warn', 'execution.blocked', 'workspace_invalid', {
        taskId: task.task_id,
        planId: plan.plan_id,
        reason: workspaceValidationError,
      });
    }

    const hostAuthorizationError = this.getHostAuthorizationBlockReason(plan);
    if (hostAuthorizationError) {
      return this.blockDecision(decision, hostAuthorizationError, 'security', 'execution.blocked', 'host_unauthorized', {
        taskId: task.task_id,
        planId: plan.plan_id,
        reason: hostAuthorizationError,
      });
    }

    const policyResult = this.policyEngine.evaluate(plan);
    decision.policy_evaluation = policyResult;
    if (!policyResult.allowed) {
      const reason = `Blocked by security policy: ${policyResult.violations.map((v) => v.detail).join('; ')}`;
      return this.blockDecision(decision, reason, 'warn', 'execution.blocked', 'policy_blocked', {
        taskId: task.task_id,
        planId: plan.plan_id,
        reason,
      });
    }

    if (dryRun) {
      return this.completeDryRunDecision(decision, task, plan);
    }

    const modeBlockReason = this.getModeBlockReason(plan);
    if (modeBlockReason) {
      decision.mode_sufficient = false;
      return this.blockDecision(decision, modeBlockReason, 'warn', 'execution.blocked', 'mode_insufficient', {
        taskId: task.task_id,
        planId: plan.plan_id,
        reason: modeBlockReason,
      });
    }

    const approvalBlockReason = this.getApprovalBlockReason(task, plan);
    if (approvalBlockReason) {
      decision.requires_confirmation = true;
      return this.blockDecision(decision, approvalBlockReason, 'info', 'execution.blocked', 'approval_required', {
        taskId: task.task_id,
        planId: plan.plan_id,
        reason: approvalBlockReason,
      });
    }

    return this.runRegisteredExecutor(task, plan, decision);
  }

  public getModeManager(): ModeManager {
    return this.modeManager;
  }

  public getPolicyEngine(): PolicyEngine {
    return this.policyEngine;
  }

  private buildCorrelation(task: Task): ZavorthExecutionCorrelation {
    return createExecutionCorrelation(this.correlationTraceService.buildTaskCorrelation(task));
  }

  private createInitialDecision(
    task: Task,
    plan: Plan,
    correlation: ZavorthExecutionCorrelation,
  ): GatewayDecision {
    return {
      allowed: false,
      reason: '',
      requires_confirmation: false,
      correlation,
      lifecycle: buildExecutionGatewayLifecycle(task, plan, correlation),
      policy_evaluation: null,
      risk_classification: null,
      mode_sufficient: true,
      execution_result: null,
    };
  }

  private buildTelemetryCorrelationPayload(decision: GatewayDecision): Record<string, string | null> {
    return {
      traceId: decision.correlation.traceId,
      runId: decision.correlation.runId,
      sessionId: decision.correlation.sessionId,
      approvalId: decision.correlation.approvalId,
      artifactId: decision.correlation.artifactId,
    };
  }

  private normalizeExecutionResultTiming(result: ExecutionResult): ExecutionResult {
    const timing = this.buildCanonicalExecutionTiming(
      result.timing?.startedAt || result.started_at,
      result.timing?.finishedAt || result.finished_at,
    );
    result.started_at = timing.startedAt;
    result.finished_at = timing.finishedAt;
    result.timing = timing;
    result.metadata = {
      ...(result.metadata || {}),
      timing,
      started_at: result.started_at,
      finished_at: result.finished_at,
    };
    return result;
  }

  private buildCanonicalExecutionTiming(
    startedAtInput: string | null | undefined,
    finishedAtInput: string | null | undefined,
  ): ExecutionTiming {
    const startedAt = this.normalizeExecutionTimestamp(startedAtInput, new Date());
    const finishedAt = this.normalizeExecutionTimestamp(finishedAtInput, new Date());
    const startedMs = Date.parse(startedAt);
    const finishedMs = Date.parse(finishedAt);
    const durationMs =
      Number.isFinite(startedMs) && Number.isFinite(finishedMs)
        ? Math.max(0, finishedMs - startedMs)
        : 0;
    return { startedAt, finishedAt, durationMs };
  }

  private normalizeExecutionTimestamp(value: string | null | undefined, fallback: Date): string {
    const parsed = Date.parse(String(value || ''));
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
    return fallback.toISOString();
  }

  private validateWorkspaceRecommendation(plan: Plan): string | null {
    try {
      if (plan.workspace_recommendation) {
        WorkspaceResolver.validate(plan.workspace_recommendation);
      }
      return null;
    } catch (error: unknown) { const err = asErrorLike(error); return `Invalid workspace: ${err.message}`;
    }
  }

  private getHostAuthorizationBlockReason(plan: Plan): string | null {
    if (!this.hostIdentityService) {
      return null;
    }

    const hostStatus = this.hostIdentityService.getStatus();
    const mutatingStep = (plan.steps || []).some(
      (step) => !['read', 'list', 'search', 'analyze'].includes(step.type),
    );
    if (hostStatus.authorized || !mutatingStep) {
      return null;
    }

    return `Host is not authorized for mutable execution. Current fingerprint: ${hostStatus.currentFingerprint.substring(0, 12)}...`;
  }

  private getModeBlockReason(plan: Plan): string | null {
    for (const step of plan.steps) {
      if (!this.modeManager.isSufficientFor(step.type)) {
        return `Insufficient operational mode. Current mode: ${this.modeManager.getMode()}, required for '${step.type}': ${ModeManager.minimumModeFor(step.type)}`;
      }
    }
    return null;
  }

  private getApprovalBlockReason(task: Task, plan: Plan): string | null {
    const explicitApprovalSatisfied =
      plan.requires_approval &&
      (task.approval_status === 'approved' || task.requires_approval === false);

    if (plan.requires_approval && !explicitApprovalSatisfied) {
      return `Plan requires explicit approval (risk level ${plan.risk_level}).`;
    }

    return null;
  }

  private async runRegisteredExecutor(
    task: Task,
    plan: Plan,
    decision: GatewayDecision,
  ): Promise<GatewayDecision> {
    const traceId = decision.correlation.traceId;
    const requestedExecutorName = plan.executor_recommendation || 'local';
    const executorName = resolveExecutionGatewayExecutorName(requestedExecutorName);
    const executor = this.executors.get(executorName);

    if (!executor) {
      const reason = `Executor '${executorName}' is not registered in the gateway.`;
      return this.blockDecision(decision, reason, 'error', 'execution.failed', 'executor_missing', {
        taskId: task.task_id,
        planId: plan.plan_id,
        reason,
      });
    }

    try {
      const available = await executor.isAvailable();
      if (!available) {
        const reason = `Executor '${executorName}' unavailable on this host.`;
        return this.blockDecision(decision, reason, 'warn', 'execution.blocked', 'executor_unavailable', {
          taskId: task.task_id,
          planId: plan.plan_id,
          executor: executorName,
          reason,
        });
      }

      const request = buildExecutionGatewayRequest({
        correlation: decision.correlation,
        decisionLifecycle: decision.lifecycle,
        executorName,
        plan,
        policyEngine: this.policyEngine,
        requestedExecutorName,
        task,
      });
      const hookWorkspace = resolveExecutionGatewayWorkspace(request.workspace, this.defaultWorkspace);
      const runtimeHookContext = buildExecutionGatewayRuntimeHookContext({
        defaultWorkspace: this.defaultWorkspace,
        executorName,
        plan,
        request,
        requestedExecutorName,
        task,
        traceId,
      });
      const beforeRuntime = await runExecutionGatewayRuntimeHook(
        this.hookPipeline,
        'runtime.before_execute',
        hookWorkspace,
        runtimeHookContext,
      );
      if (!beforeRuntime.ok) {
        const reason = 'A hook blocked runtime execution.';
        await runExecutionGatewayRuntimeFailureHook(this.hookPipeline, hookWorkspace, {
          ...runtimeHookContext,
          reason: 'blocked_by_hook',
        });
        return this.blockDecision(decision, reason, 'warn', 'execution.blocked', 'runtime_hook_blocked', {
          taskId: task.task_id,
          planId: plan.plan_id,
          executor: executorName,
          reason,
        });
      }

      const result = this.normalizeExecutionResultTiming(
        await this.executeWithRecoveryAndHealing(executor, request, executorName),
      );
      decision.allowed = true;
      decision.execution_result = result;
      decision.reason = result.success ? 'Execution completed successfully.'
        : `Execution failed: ${result.error_message}`;
      decision.lifecycle = buildExecutionGatewayOutcomeLifecycle({
        correlation: decision.correlation,
        existing: decision.lifecycle,
        plan,
        result,
        task,
      });
      result.metadata = {
        ...(result.metadata || {}),
        traceId,
        runId: decision.correlation.runId,
        sessionId: decision.correlation.sessionId,
        approvalId: decision.correlation.approvalId,
        artifactId: decision.correlation.artifactId,
        timing: result.timing,
        started_at: result.started_at,
        finished_at: result.finished_at,
        execution_lifecycle: decision.lifecycle,
      };

      this.logRepo.log('info', 'ExecutionGateway', decision.reason);
      if (result.success) {
        await runExecutionGatewayRuntimeHook(this.hookPipeline, 'runtime.after_execute', hookWorkspace, {
          ...runtimeHookContext,
          success: true,
          errorCode: result.error_code,
          errorMessage: result.error_message,
          commandsExecuted: result.commands_executed.length,
          actionsExecuted: result.actions_executed.length,
          timing: result.timing,
        });
      } else {
        await runExecutionGatewayRuntimeFailureHook(this.hookPipeline, hookWorkspace, {
          ...runtimeHookContext,
          reason: 'execution_failed',
          errorCode: result.error_code,
          errorMessage: result.error_message,
          commandsExecuted: result.commands_executed.length,
          actionsExecuted: result.actions_executed.length,
          timing: result.timing,
        });
      }
      await recordExecutionGatewayTelemetry(
        this.telemetryRuntime,
        traceId,
        result.success ? 'execution.completed' : 'execution.failed',
        result.success ? 'success' : 'failed',
        {
          ...this.buildTelemetryCorrelationPayload(decision),
          taskId: task.task_id,
          planId: plan.plan_id,
          executor: executorName,
          success: result.success,
          errorCode: result.error_code,
          errorMessage: result.error_message,
          timing: result.timing,
        },
      );
    } catch (error: unknown) { const err = asErrorLike(error); const workspace = resolveExecutionGatewayWorkspace(
        plan.workspace_recommendation || task.workspace || '',
        this.defaultWorkspace,
      );
      const reason = `Execution error: ${err.message}`;
      this.logRepo.log('error', 'ExecutionGateway', reason);
      await runExecutionGatewayRuntimeFailureHook(this.hookPipeline, workspace, {
        traceId,
        taskId: task.task_id,
        planId: plan.plan_id,
        executor: resolveExecutionGatewayExecutorName(plan.executor_recommendation || 'local'),
        requestedExecutor: plan.executor_recommendation || 'local',
        workspace,
        riskLevel: plan.risk_level,
        requiresApproval: plan.requires_approval,
        instructionCount: plan.steps.length,
        reason: 'gateway_exception',
        errorMessage: errorMessage(error),
      });
      await recordExecutionGatewayTelemetry(
        this.telemetryRuntime,
        traceId,
        'execution.failed',
        'exception',
        {
          taskId: task.task_id,
          planId: plan.plan_id,
          reason,
        },
      );
      decision.reason = reason;
    }

    return decision;
  }

  private async executeWithRecoveryAndHealing(
    executor: IExecutor,
    request: ExecutionRequest,
    executorName: string,
  ): Promise<ExecutionResult> {
    let result = await executor.execute(request);
    const recoveryAttempt = this.executorRecovery.buildRecoveryAttempt(executorName, request, result);
    if (recoveryAttempt) {
      this.logRepo.log('warn', 'ExecutionGateway', `[ExecutorRecovery] ${recoveryAttempt.note}`);
      const retryResult = await executor.execute(recoveryAttempt.request);
      retryResult.actions_executed = [
        ...(result.actions_executed || []),
        `[EXECUTOR-RECOVERY] ${recoveryAttempt.note}`,
        ...(retryResult.actions_executed || []),
      ];
      retryResult.metadata = {
        ...(retryResult.metadata || {}),
        executor_recovery: {
          note: recoveryAttempt.note,
          attempted_at: new Date().toISOString(),
          previous_error_code: result.error_code,
        },
      };
      result = retryResult;
    }

    let retries = 0;
    const canAttemptShellPatch =
      this.executorRecovery.supportsCommandPatch(executorName) &&
      String(result.error_code || '').trim() !== 'SANDBOX_REQUIRED_DOCKER_UNAVAILABLE';

    while (
      !result.success &&
      retries < 3 &&
      canAttemptShellPatch &&
      (this.modeManager.getMode() === OperationalMode.BUILD || this.modeManager.getMode() === OperationalMode.PRIVILEGED)
    ) {
      this.logRepo.log(
        'warn',
        'ExecutionGateway',
        `Execution failed, starting self-correction attempt ${retries + 1}/3...`,
      );

      const fixCommand = await this.proposeSelfHealingFix(request, result);
      if (!fixCommand) {
        this.logRepo.log('warn', 'ExecutionGateway', 'Auto-correction could not propose a safe patch.');
        break;
      }

      if (this.policyEngine.isCommandBlocked(fixCommand)) {
        this.logRepo.log('warn', 'ExecutionGateway', `Auto-correction patch blocked by policy: ${fixCommand}`);
        result.actions_executed.push(`[SELF-HEALING] Patch blocked by policy: ${fixCommand}`);
        break;
      }

      this.logRepo.log('info', 'ExecutionGateway', `Applying self-correction patch: ${fixCommand}`);

      const patchRequest: ExecutionRequest = {
        ...request,
        execution_id: uuidv4(),
        objective: 'Apply self-correction patch',
        instructions: [fixCommand],
      };

      const patchResult = await executor.execute(patchRequest);
      result.actions_executed.push(`[SELF-HEALING] Quick correction attempt: ${fixCommand}`);

      if (patchResult.success) {
        this.logRepo.log('info', 'ExecutionGateway', 'Patch applied successfully, re-running original command...');
        const retryResult = await executor.execute(request);
        retryResult.actions_executed = [...result.actions_executed, ...retryResult.actions_executed];
        result = retryResult;
      } else {
        this.logRepo.log('error', 'ExecutionGateway', 'Self-correction patch also failed.');
        result.actions_executed.push(`[SELF-HEALING] Failed to apply patch: ${patchResult.error_message}`);
      }

      retries += 1;
    }

    if (!result.success && canAttemptShellPatch) {
      const suggestedFix = await this.proposeSelfHealingFix(request, result);
      if (suggestedFix) {
        result.metadata = {
          ...(result.metadata || {}),
          self_reflection: {
            suggested_fix: suggestedFix,
            analyzed_at: new Date().toISOString(),
          },
        };
      }
    }

    return result;
  }

  private completeDryRunDecision(
    decision: GatewayDecision,
    task: Task,
    plan: Plan,
  ): GatewayDecision {
    decision.allowed = true;
    decision.reason = 'Dry run - plan validated successfully, execution kept in dry-run mode.';
    const dryRunStartedAt = new Date().toISOString();
    const dryRunFinishedAt = new Date().toISOString();
    const dryRunTiming = this.buildCanonicalExecutionTiming(dryRunStartedAt, dryRunFinishedAt);
    decision.lifecycle = [
      ...decision.lifecycle,
      buildExecutionLifecycleRecord({
        kind: 'run',
        status: 'noop',
        correlation: decision.correlation,
        summary: 'Dry run validated without mutating runtime state.',
        source: 'execution-gateway',
        surface: task.source,
        parentId: plan.plan_id,
        timing: dryRunTiming,
        metadata: {
          timing: dryRunTiming,
        },
      }),
    ];
    decision.execution_result = {
      execution_id: uuidv4(),
      task_id: task.task_id,
      executor: 'dry_run',
      success: true,
      started_at: dryRunTiming.startedAt,
      finished_at: dryRunTiming.finishedAt,
      timing: dryRunTiming,
      actions_executed: plan.steps.map((step) => `[DRY_RUN] ${step.description}`),
      files_read: [],
      files_written: [],
      files_deleted: [],
      commands_executed: [],
      stdout: null,
      stderr: null,
      diff_summary: null,
      artifacts: [],
      rollback_available: false,
      error_code: null,
      error_message: null,
      metadata: {
        dry_run: true,
        traceId: decision.correlation.traceId,
        runId: decision.correlation.runId,
        sessionId: decision.correlation.sessionId,
        approvalId: decision.correlation.approvalId,
        artifactId: decision.correlation.artifactId,
        timing: dryRunTiming,
        started_at: dryRunTiming.startedAt,
        finished_at: dryRunTiming.finishedAt,
        execution_lifecycle: decision.lifecycle,
      },
    };
    this.logRepo.log('info', 'ExecutionGateway', decision.reason);
    void recordExecutionGatewayTelemetry(
      this.telemetryRuntime,
      decision.correlation.traceId,
      'execution.completed',
      'dry_run',
      {
        ...this.buildTelemetryCorrelationPayload(decision),
        taskId: task.task_id,
        planId: plan.plan_id,
        dryRun: true,
        timing: dryRunTiming,
      },
    );
    return decision;
  }

  private async blockDecision(
    decision: GatewayDecision,
    reason: string,
    logLevel: 'info' | 'warn' | 'error' | 'security',
    telemetryEvent: string,
    telemetryStatus: string,
    telemetryPayload: Record<string, unknown>,
  ): Promise<GatewayDecision> {
    decision.reason = reason;
    this.logRepo.log(logLevel, 'ExecutionGateway', reason);
    await recordExecutionGatewayTelemetry(
      this.telemetryRuntime,
      decision.correlation.traceId,
      telemetryEvent,
      telemetryStatus,
      {
        ...this.buildTelemetryCorrelationPayload(decision),
        ...telemetryPayload,
      },
    );
    return decision;
  }

  private async proposeSelfHealingFix(
    request: ExecutionRequest,
    result: ExecutionResult,
  ): Promise<string | null> {
    try {
      if (!this.healer) {
        this.healer = new SelfHealingService();
      }
      return await this.healer.analyzeAndProposeFix(request, result);
    } catch (error: unknown) {return null;
    }
  }
}
