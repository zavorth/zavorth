import { createHash } from 'crypto';
import type { CapabilityAutopilotPreflightCheck } from './CapabilityAutopilotPreflightEntrypointService.js';
import type {
  CapabilityPreflightRealApplyApprovalDecision,
  CapabilityPreflightRealApplyApprovalGateSnapshot,
} from './CapabilityAutopilotPreflightRealApplyApprovalGateService.js';

export type CapabilityPreflightControlledRealApplyStatus =
  | 'controlled_apply_succeeded'
  | 'adapter_failed'
  | 'blocked';

export type CapabilityPreflightControlledRealApplyAdapterMode =
  | 'fixture'
  | 'real';

export type CapabilityPreflightControlledRealApplyAdapterContext = {
  generatedAt: string;
  actorId: string | null;
  executionReceiptId: string | null;
  budgetLockId: string | null;
  rollbackPlanId: string | null;
  auditReceiptId: string | null;
  reason: string | null;
};

export type CapabilityPreflightControlledRealApplyAdapterResult = {
  ok: boolean;
  adapterReceiptId: string;
  mode: CapabilityPreflightControlledRealApplyAdapterMode;
  sideEffectInvoked: boolean;
  executedAgainstRealTarget: boolean;
  targetFingerprint: string | null;
  outputSummary: string;
  evidence: string[];
  rollbackToken: string | null;
  errorCode?: string | null;
  metadata?: Record<string, unknown>;
};

export type CapabilityPreflightControlledRealApplyAdapter = (
  decision: CapabilityPreflightRealApplyApprovalDecision,
  context: CapabilityPreflightControlledRealApplyAdapterContext,
) =>
  | CapabilityPreflightControlledRealApplyAdapterResult
  | Promise<CapabilityPreflightControlledRealApplyAdapterResult>;

export type CapabilityPreflightControlledRealApplyOptions = {
  controlledExecutionConfirmed?: boolean;
  budgetLocked?: boolean;
  rollbackPlanApproved?: boolean;
  auditSinkReady?: boolean;
  actorId?: string | null;
  executionReceiptId?: string | null;
  budgetLockId?: string | null;
  rollbackPlanId?: string | null;
  auditReceiptId?: string | null;
  reason?: string | null;
};

export type CapabilityPreflightControlledRealApplyExecution = {
  gate: 'capability-autopilot-preflight-controlled-real-apply';
  controlledExecutionId: string;
  generatedAt: string;
  surface: 'capability-autopilot-preflight-controlled-real-apply-executor';
  status: CapabilityPreflightControlledRealApplyStatus;
  capabilityId: string;
  sourceDecisionGate: CapabilityPreflightRealApplyApprovalDecision['gate'];
  sourceDecisionId: string;
  sourceSurface: CapabilityPreflightRealApplyApprovalDecision['sourceSurface'];
  sourceAction: CapabilityPreflightRealApplyApprovalDecision['sourceAction'];
  invocationKind: CapabilityPreflightRealApplyApprovalDecision['invocationKind'];
  applyAdapterKind: CapabilityPreflightRealApplyApprovalDecision['applyAdapterKind'];
  dispatchMode: CapabilityPreflightRealApplyApprovalDecision['dispatchMode'];
  target: CapabilityPreflightRealApplyApprovalDecision['target'];
  sourceRealApplyAuthorized: boolean;
  controlledExecutionConfirmed: boolean;
  requiresExplicitUserAction: true;
  adapterRequired: true;
  adapterAvailable: boolean;
  budgetLocked: boolean;
  rollbackPlanApproved: boolean;
  auditSinkReady: boolean;
  realApplyInvoked: boolean;
  applyInvoked: boolean;
  adapterInvoked: boolean;
  sideEffectInvoked: boolean;
  dispatchExecuted: boolean;
  executedAgainstRealTarget: boolean;
  shouldRunAutomatically: false;
  sideEffectLevel: 'controlled_real_apply' | 'none';
  budgetLock: {
    budgetLockId: string | null;
    estimatedUnits: number;
    limitUnits: number;
    withinBudget: boolean;
  };
  rollbackPlan: {
    rollbackPlanId: string | null;
    rollbackRequired: boolean;
    rollbackToken: string | null;
    rollbackHint: string;
  };
  audit: {
    sourceDecisionGeneratedAt: string;
    actorId: string | null;
    executionReceiptId: string | null;
    budgetLockId: string | null;
    rollbackPlanId: string | null;
    auditReceiptId: string | null;
    reason: string | null;
  };
  adapterResult: CapabilityPreflightControlledRealApplyAdapterResult | null;
  blockers: string[];
  evidence: string[];
  safeSummary: string;
  metadata: Record<string, unknown>;
};

export type CapabilityPreflightControlledRealApplyExecutorSnapshot = {
  gate: 'capability-autopilot-preflight-controlled-real-apply';
  surface: 'capability-autopilot-preflight-controlled-real-apply-executor';
  generatedAt: string;
  capabilityId: string;
  status: 'ready' | 'blocked';
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  sourceSnapshotGate: CapabilityPreflightRealApplyApprovalGateSnapshot['gate'];
  executions: CapabilityPreflightControlledRealApplyExecution[];
  checks: CapabilityAutopilotPreflightCheck[];
  nextRecommendedGate: {
    gate: 'capability-autopilot-preflight-post-run-rollback';
    title: string;
    reason: string;
  };
  metadata: Record<string, unknown>;
};

export type CapabilityAutopilotPreflightControlledRealApplyExecutorRuntime = {
  now?: () => Date;
  adapter?: CapabilityPreflightControlledRealApplyAdapter | null;
};

export class CapabilityAutopilotPreflightControlledRealApplyExecutorService {
  private readonly now: () => Date;
  private readonly adapter: CapabilityPreflightControlledRealApplyAdapter | null;

  constructor(runtime: CapabilityAutopilotPreflightControlledRealApplyExecutorRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.adapter = runtime.adapter || null;
  }

  public async buildExecution(
    decision: CapabilityPreflightRealApplyApprovalDecision,
    options: CapabilityPreflightControlledRealApplyOptions = {},
  ): Promise<CapabilityPreflightControlledRealApplyExecution> {
    const generatedAt = this.now().toISOString();
    const context = this.buildContext(generatedAt, options);
    const budgetLock = this.buildBudgetLock(decision, options);
    const blockers = this.resolveBlockers(decision, options, budgetLock.withinBudget);
    const controlledExecutionId = this.buildControlledExecutionId(decision, generatedAt, options.executionReceiptId || null);

    if (blockers.length > 0 || !this.adapter) {
      const finalBlockers = !this.adapter
        ? Array.from(new Set([...blockers, 'execution_adapter_required']))
        : blockers;
      return this.buildBlockedExecution(decision, {
        controlledExecutionId,
        generatedAt,
        context,
        options,
        budgetLock,
        blockers: finalBlockers,
      });
    }

    const adapterResult = await this.adapter(decision, context);
    const status: CapabilityPreflightControlledRealApplyStatus = adapterResult.ok
      ? 'controlled_apply_succeeded'
      : 'adapter_failed';
    const invoked = adapterResult.ok && adapterResult.sideEffectInvoked;

    return {
      gate: 'capability-autopilot-preflight-controlled-real-apply',
      controlledExecutionId,
      generatedAt,
      surface: 'capability-autopilot-preflight-controlled-real-apply-executor',
      status,
      capabilityId: decision.capabilityId,
      sourceDecisionGate: decision.gate,
      sourceDecisionId: decision.realApplyGateId,
      sourceSurface: decision.sourceSurface,
      sourceAction: decision.sourceAction,
      invocationKind: decision.invocationKind,
      applyAdapterKind: decision.applyAdapterKind,
      dispatchMode: decision.dispatchMode,
      target: decision.target,
      sourceRealApplyAuthorized: decision.realApplyAuthorized,
      controlledExecutionConfirmed: options.controlledExecutionConfirmed === true,
      requiresExplicitUserAction: true,
      adapterRequired: true,
      adapterAvailable: true,
      budgetLocked: options.budgetLocked === true,
      rollbackPlanApproved: options.rollbackPlanApproved === true,
      auditSinkReady: options.auditSinkReady === true,
      realApplyInvoked: invoked,
      applyInvoked: invoked,
      adapterInvoked: true,
      sideEffectInvoked: invoked,
      dispatchExecuted: invoked,
      executedAgainstRealTarget: adapterResult.executedAgainstRealTarget,
      shouldRunAutomatically: false,
      sideEffectLevel: invoked ? 'controlled_real_apply' : 'none',
      budgetLock,
      rollbackPlan: {
        rollbackPlanId: options.rollbackPlanId || null,
        rollbackRequired: invoked,
        rollbackToken: adapterResult.rollbackToken,
        rollbackHint: this.buildRollbackHint(decision, adapterResult),
      },
      audit: {
        sourceDecisionGeneratedAt: decision.generatedAt,
        actorId: options.actorId || null,
        executionReceiptId: options.executionReceiptId || null,
        budgetLockId: options.budgetLockId || null,
        rollbackPlanId: options.rollbackPlanId || null,
        auditReceiptId: options.auditReceiptId || null,
        reason: options.reason || null,
      },
      adapterResult,
      blockers: adapterResult.ok ? [] : [adapterResult.errorCode || 'adapter_failed'],
      evidence: this.buildEvidence(decision, budgetLock, adapterResult),
      safeSummary: this.buildSafeSummary(decision, status, adapterResult),
      metadata: {
        gate: 'capability-autopilot-preflight-controlled-real-apply',
        sourceDecisionStatus: decision.status,
        sourceActionKind: decision.sourceAction?.kind || null,
        autoExecute: false,
        adapterMode: adapterResult.mode,
        controlledExecution: true,
        realApplyInvoked: invoked,
        applyInvoked: invoked,
        adapterInvoked: true,
        sideEffectInvoked: invoked,
        dispatchExecuted: invoked,
        executedAgainstRealTarget: adapterResult.executedAgainstRealTarget,
      },
    };
  }

  public async buildExecutorSnapshot(
    source: CapabilityPreflightRealApplyApprovalGateSnapshot,
    options: CapabilityPreflightControlledRealApplyOptions = {},
  ): Promise<CapabilityPreflightControlledRealApplyExecutorSnapshot> {
    const generatedAt = this.now().toISOString();
    const executions = await Promise.all(source.decisions.map((decision) => this.buildExecution(decision, options)));
    const checks = this.buildChecks(source, executions);
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      gate: 'capability-autopilot-preflight-controlled-real-apply',
      surface: 'capability-autopilot-preflight-controlled-real-apply-executor',
      generatedAt,
      capabilityId: source.capabilityId,
      status: failed > 0 ? 'blocked' : 'ready',
      summary: {
        ok: failed === 0,
        passed,
        warnings,
        failed,
      },
      sourceSnapshotGate: source.gate,
      executions,
      checks,
      nextRecommendedGate: {
        gate: 'capability-autopilot-preflight-post-run-rollback',
        title: 'Real Apply Post-Run Verification And Rollback Ledger',
        reason:
          'Depois da execucao controlada, o proximo passo e verificar resultado real, consolidar rollback ledger e registrar auditoria pos-run por superficie.',
      },
      metadata: {
        gate: 'capability-autopilot-preflight-controlled-real-apply',
        sourceSnapshotStatus: source.status,
        decisionCount: source.decisions.length,
        executionCount: executions.length,
        autoExecute: false,
        controlledExecution: true,
        adapterAvailable: this.adapter !== null,
        succeededCount: executions.filter((execution) => execution.status === 'controlled_apply_succeeded').length,
        sideEffectInvokedCount: executions.filter((execution) => execution.sideEffectInvoked).length,
      },
    };
  }

  public renderReport(snapshot: CapabilityPreflightControlledRealApplyExecutorSnapshot): string {
    const lines: string[] = [];
    lines.push('[capability-autopilot-preflight-controlled-apply] Preflight Controlled Real Apply Executor');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`capability: ${snapshot.capabilityId}`);
    lines.push(`executions: ${snapshot.executions.length}`);
    lines.push('');
    for (const item of snapshot.checks) {
      lines.push(`[${item.status}] ${item.title}`);
      lines.push(`  ${item.reason}`);
      for (const evidence of item.evidence) {
        lines.push(`  - ${evidence}`);
      }
    }
    lines.push('');
    lines.push(`proximo passo recomendada: ${snapshot.nextRecommendedGate.gate} - ${snapshot.nextRecommendedGate.title}`);
    lines.push(snapshot.nextRecommendedGate.reason);
    return lines.join('\n');
  }

  private buildBlockedExecution(
    decision: CapabilityPreflightRealApplyApprovalDecision,
    data: {
      controlledExecutionId: string;
      generatedAt: string;
      context: CapabilityPreflightControlledRealApplyAdapterContext;
      options: CapabilityPreflightControlledRealApplyOptions;
      budgetLock: CapabilityPreflightControlledRealApplyExecution['budgetLock'];
      blockers: string[];
    },
  ): CapabilityPreflightControlledRealApplyExecution {
    return {
      gate: 'capability-autopilot-preflight-controlled-real-apply',
      controlledExecutionId: data.controlledExecutionId,
      generatedAt: data.generatedAt,
      surface: 'capability-autopilot-preflight-controlled-real-apply-executor',
      status: 'blocked',
      capabilityId: decision.capabilityId,
      sourceDecisionGate: decision.gate,
      sourceDecisionId: decision.realApplyGateId,
      sourceSurface: decision.sourceSurface,
      sourceAction: decision.sourceAction,
      invocationKind: decision.invocationKind,
      applyAdapterKind: decision.applyAdapterKind,
      dispatchMode: decision.dispatchMode,
      target: decision.target,
      sourceRealApplyAuthorized: decision.realApplyAuthorized,
      controlledExecutionConfirmed: data.options.controlledExecutionConfirmed === true,
      requiresExplicitUserAction: true,
      adapterRequired: true,
      adapterAvailable: this.adapter !== null,
      budgetLocked: data.options.budgetLocked === true,
      rollbackPlanApproved: data.options.rollbackPlanApproved === true,
      auditSinkReady: data.options.auditSinkReady === true,
      realApplyInvoked: false,
      applyInvoked: false,
      adapterInvoked: false,
      sideEffectInvoked: false,
      dispatchExecuted: false,
      executedAgainstRealTarget: false,
      shouldRunAutomatically: false,
      sideEffectLevel: 'none',
      budgetLock: data.budgetLock,
      rollbackPlan: {
        rollbackPlanId: data.options.rollbackPlanId || null,
        rollbackRequired: false,
        rollbackToken: null,
        rollbackHint: this.buildRollbackHint(decision, null),
      },
      audit: {
        sourceDecisionGeneratedAt: decision.generatedAt,
        actorId: data.context.actorId,
        executionReceiptId: data.context.executionReceiptId,
        budgetLockId: data.context.budgetLockId,
        rollbackPlanId: data.context.rollbackPlanId,
        auditReceiptId: data.context.auditReceiptId,
        reason: data.context.reason,
      },
      adapterResult: null,
      blockers: data.blockers,
      evidence: [
        `sourceDecisionStatus=${decision.status}`,
        `realApplyAuthorized=${decision.realApplyAuthorized}`,
        `adapterAvailable=${this.adapter !== null}`,
        `budgetLocked=${data.options.budgetLocked === true}`,
        `rollbackPlanApproved=${data.options.rollbackPlanApproved === true}`,
        `auditSinkReady=${data.options.auditSinkReady === true}`,
      ],
      safeSummary: `Execucao controlada bloqueada para ${decision.sourceAction?.kind || '<sem-action>'}; adapter nao foi invocado.`,
      metadata: {
        gate: 'capability-autopilot-preflight-controlled-real-apply',
        sourceDecisionStatus: decision.status,
        sourceActionKind: decision.sourceAction?.kind || null,
        autoExecute: false,
        controlledExecution: true,
        realApplyInvoked: false,
        applyInvoked: false,
        adapterInvoked: false,
        sideEffectInvoked: false,
        dispatchExecuted: false,
        executedAgainstRealTarget: false,
      },
    };
  }

  private buildContext(
    generatedAt: string,
    options: CapabilityPreflightControlledRealApplyOptions,
  ): CapabilityPreflightControlledRealApplyAdapterContext {
    return {
      generatedAt,
      actorId: options.actorId || null,
      executionReceiptId: options.executionReceiptId || null,
      budgetLockId: options.budgetLockId || null,
      rollbackPlanId: options.rollbackPlanId || null,
      auditReceiptId: options.auditReceiptId || null,
      reason: options.reason || null,
    };
  }

  private buildBudgetLock(
    decision: CapabilityPreflightRealApplyApprovalDecision,
    options: CapabilityPreflightControlledRealApplyOptions,
  ): CapabilityPreflightControlledRealApplyExecution['budgetLock'] {
    return {
      budgetLockId: options.budgetLockId || null,
      estimatedUnits: decision.budget.estimatedUnits,
      limitUnits: decision.budget.limitUnits,
      withinBudget: decision.budget.withinBudget,
    };
  }

  private resolveBlockers(
    decision: CapabilityPreflightRealApplyApprovalDecision,
    options: CapabilityPreflightControlledRealApplyOptions,
    withinBudget: boolean,
  ): string[] {
    const blockers = [...decision.blockers];
    if (decision.status !== 'real_apply_ready' || !decision.realApplyAuthorized) {
      blockers.push(`real_apply_not_authorized:${decision.status}`);
    }
    if (decision.realApplyInvoked || decision.applyInvoked || decision.adapterInvoked || decision.sideEffectInvoked || decision.dispatchExecuted) {
      blockers.push('source_decision_already_invoked');
    }
    if (options.controlledExecutionConfirmed !== true) {
      blockers.push('controlled_execution_confirmation_required');
    }
    if (options.budgetLocked !== true || !options.budgetLockId) {
      blockers.push('budget_lock_required');
    }
    if (!withinBudget) {
      blockers.push('budget_not_within_limit');
    }
    if (options.rollbackPlanApproved !== true || !options.rollbackPlanId) {
      blockers.push('rollback_plan_required');
    }
    if (options.auditSinkReady !== true || !options.auditReceiptId) {
      blockers.push('audit_sink_required');
    }
    if (decision.shouldRunAutomatically !== false) {
      blockers.push('automatic_controlled_apply_not_allowed');
    }
    return Array.from(new Set(blockers));
  }

  private buildChecks(
    source: CapabilityPreflightRealApplyApprovalGateSnapshot,
    executions: CapabilityPreflightControlledRealApplyExecution[],
  ): CapabilityAutopilotPreflightCheck[] {
    const serialized = JSON.stringify({ source, executions });
    const blocked = executions.filter((execution) => execution.status === 'blocked');
    const failed = executions.filter((execution) => execution.status === 'adapter_failed');

    return [
      this.check(
        'capability-autopilot-preflight-controlled-apply:coverage',
        'controlled execution por approval decision',
        executions.length === source.decisions.length && blocked.length === 0 && failed.length === 0 ? 'pass' : 'fail',
        'Cada approval decision pronta precisa gerar uma execucao controlada bem-sucedida.',
        [
          `decisions=${source.decisions.length}`,
          `executions=${executions.length}`,
          `blocked=${blocked.length}`,
          `adapterFailed=${failed.length}`,
          ...blocked.map((execution) => `${execution.sourceSurface}:${execution.blockers.join('|')}`),
          ...failed.map((execution) => `${execution.sourceSurface}:${execution.blockers.join('|')}`),
        ],
      ),
      this.check(
        'capability-autopilot-preflight-controlled-apply:source-authorization',
        'fonte autorizada pelo gate de real-apply',
        executions.every((execution) =>
          execution.sourceRealApplyAuthorized &&
          execution.status === 'controlled_apply_succeeded'
        ) ? 'pass' : 'fail',
        'Executor real controlado so consome decisions autorizadas pelo gate final.',
        executions.map((execution) =>
          `${execution.sourceSurface}:${execution.sourceAction?.kind || '<none>'}:authorized=${execution.sourceRealApplyAuthorized}:status=${execution.status}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-controlled-apply:preconditions',
        'budget lock rollback e auditoria prontos',
        executions.every((execution) =>
          execution.controlledExecutionConfirmed &&
          execution.budgetLocked &&
          execution.budgetLock.budgetLockId !== null &&
          execution.budgetLock.withinBudget &&
          execution.rollbackPlanApproved &&
          execution.rollbackPlan.rollbackPlanId !== null &&
          execution.auditSinkReady &&
          execution.audit.auditReceiptId !== null
        ) ? 'pass' : 'fail',
        'Apply real exige confirmacao, budget lock, rollback plan e audit sink antes do adapter.',
        executions.map((execution) =>
          `${execution.sourceSurface}:budgetLock=${execution.budgetLock.budgetLockId || '<none>'}:rollback=${execution.rollbackPlan.rollbackPlanId || '<none>'}:audit=${execution.audit.auditReceiptId || '<none>'}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-controlled-apply:adapter-invoked',
        'adapter injetado invocado',
        executions.every((execution) =>
          execution.adapterAvailable &&
          execution.adapterInvoked &&
          execution.realApplyInvoked &&
          execution.applyInvoked &&
          execution.sideEffectInvoked &&
          execution.dispatchExecuted &&
          execution.sideEffectLevel === 'controlled_real_apply'
        ) ? 'pass' : 'fail',
        'Este gate e o primeiro que invoca um adapter de apply real controlado.',
        executions.map((execution) =>
          `${execution.sourceSurface}:${execution.adapterResult?.mode || '<none>'}:adapter=${execution.adapterInvoked}:sideEffect=${execution.sideEffectInvoked}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-controlled-apply:rollback-token',
        'rollback token registrado',
        executions.every((execution) =>
          execution.rollbackPlan.rollbackRequired &&
          execution.rollbackPlan.rollbackToken !== null
        ) ? 'pass' : 'fail',
        'Toda execucao controlada bem-sucedida precisa deixar rollback token.',
        executions.map((execution) =>
          `${execution.sourceSurface}:rollbackRequired=${execution.rollbackPlan.rollbackRequired}:token=${execution.rollbackPlan.rollbackToken || '<none>'}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-controlled-apply:explicit-only',
        'sem execucao automatica',
        executions.every((execution) =>
          execution.shouldRunAutomatically === false &&
          execution.metadata.autoExecute === false
        ) ? 'pass' : 'fail',
        'Mesmo executando adapter real controlado, a etapa continua dependente de acao explicita.',
        executions.map((execution) =>
          `${execution.sourceSurface}:auto=${execution.shouldRunAutomatically}:confirmed=${execution.controlledExecutionConfirmed}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-controlled-apply:no-raw-payload',
        'sem payload cru serializado',
        !serialized.includes('rawText') && !serialized.includes('normalizedText') ? 'pass' : 'fail',
        'Snapshots publicos da execucao controlada nao podem reintroduzir intent cru.',
        [
          `containsRawKeys=${String(serialized.includes('rawText') || serialized.includes('normalizedText'))}`,
        ],
      ),
    ];
  }

  private buildControlledExecutionId(
    decision: CapabilityPreflightRealApplyApprovalDecision,
    generatedAt: string,
    executionReceiptId: string | null,
  ): string {
    const digest = createHash('sha256')
      .update([
        decision.capabilityId,
        decision.sourceSurface,
        decision.realApplyGateId,
        decision.sourceAction?.id || '<none>',
        decision.invocationKind,
        generatedAt,
        executionReceiptId || '<none>',
      ].join('|'), 'utf8')
      .digest('hex')
      .slice(0, 16);
    return `${decision.capabilityId}-controlled-apply-${digest}`;
  }

  private buildEvidence(
    decision: CapabilityPreflightRealApplyApprovalDecision,
    budgetLock: CapabilityPreflightControlledRealApplyExecution['budgetLock'],
    adapterResult: CapabilityPreflightControlledRealApplyAdapterResult,
  ): string[] {
    return [
      `sourceDecisionId=${decision.realApplyGateId}`,
      `sourceAction=${decision.sourceAction?.kind || '<none>'}`,
      `budgetLock=${budgetLock.budgetLockId || '<none>'}`,
      `adapterReceiptId=${adapterResult.adapterReceiptId}`,
      `adapterMode=${adapterResult.mode}`,
      `sideEffectInvoked=${adapterResult.sideEffectInvoked}`,
      `executedAgainstRealTarget=${adapterResult.executedAgainstRealTarget}`,
      ...adapterResult.evidence,
    ];
  }

  private buildRollbackHint(
    decision: CapabilityPreflightRealApplyApprovalDecision,
    adapterResult: CapabilityPreflightControlledRealApplyAdapterResult | null,
  ): string {
    if (!adapterResult || !adapterResult.rollbackToken) {
      return `No controlled apply was committed for ${decision.sourceAction?.kind || '<none>'}.`;
    }
    return `Use rollback token ${adapterResult.rollbackToken} to revert controlled apply for ${decision.sourceAction?.kind || '<none>'}.`;
  }

  private buildSafeSummary(
    decision: CapabilityPreflightRealApplyApprovalDecision,
    status: CapabilityPreflightControlledRealApplyStatus,
    adapterResult: CapabilityPreflightControlledRealApplyAdapterResult,
  ): string {
    if (status === 'adapter_failed') {
      return `Execucao controlada falhou para ${decision.sourceAction?.kind || '<sem-action>'}; rollback token=${adapterResult.rollbackToken || '<nenhum>'}.`;
    }
    return `Execucao controlada concluida para ${decision.sourceAction?.kind || '<sem-action>'}; adapter=${adapterResult.mode}; rollback token registrado.`;
  }

  private check(
    id: string,
    title: string,
    status: CapabilityAutopilotPreflightCheck['status'],
    reason: string,
    evidence: string[] = [],
  ): CapabilityAutopilotPreflightCheck {
    return {
      id,
      title,
      status,
      reason,
      evidence,
    };
  }
}
