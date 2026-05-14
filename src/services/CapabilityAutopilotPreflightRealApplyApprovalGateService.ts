import { createHash } from 'crypto';
import type { CapabilityAutopilotPreflightCheck } from './CapabilityAutopilotPreflightEntrypointService.js';
import type {
  CapabilityPreflightApplyDryRunExecution,
  CapabilityPreflightApplyDryRunExecutorSnapshot,
  CapabilityPreflightApplyDryRunInvocationKind,
} from './CapabilityAutopilotPreflightApplyDryRunExecutorService.js';

export type CapabilityPreflightRealApplyApprovalStatus =
  | 'real_apply_ready'
  | 'blocked';

export type CapabilityPreflightRealApplyApprovalOptions = {
  finalApprovalGranted?: boolean;
  budgetApproved?: boolean;
  scopeApproved?: boolean;
  allowedSurfaces?: Array<CapabilityPreflightApplyDryRunExecution['sourceSurface']>;
  budgetLimitUnits?: number;
  estimatedBudgetUnits?: number;
  actorId?: string | null;
  finalApprovalReceiptId?: string | null;
  budgetReceiptId?: string | null;
  scopeReceiptId?: string | null;
  reason?: string | null;
};

export type CapabilityPreflightRealApplyApprovalDecision = {
  phase: '75';
  realApplyGateId: string;
  generatedAt: string;
  surface: 'capability-autopilot-preflight-real-apply-approval-gate';
  status: CapabilityPreflightRealApplyApprovalStatus;
  capabilityId: string;
  sourceDryRunPhase: CapabilityPreflightApplyDryRunExecution['phase'];
  sourceDryRunExecutionId: string;
  sourceSurface: CapabilityPreflightApplyDryRunExecution['sourceSurface'];
  sourceAction: CapabilityPreflightApplyDryRunExecution['sourceAction'];
  invocationKind: CapabilityPreflightApplyDryRunInvocationKind;
  applyAdapterKind: CapabilityPreflightApplyDryRunExecution['applyAdapterKind'];
  dispatchMode: CapabilityPreflightApplyDryRunExecution['dispatchMode'];
  target: CapabilityPreflightApplyDryRunExecution['target'];
  requiresExplicitUserAction: true;
  requiresFinalApproval: true;
  requiresBudgetApproval: true;
  requiresScopeApproval: true;
  finalApprovalGranted: boolean;
  budgetApproved: boolean;
  scopeApproved: boolean;
  sourceDryRunPassed: boolean;
  sourceDryRunStatus: CapabilityPreflightApplyDryRunExecution['status'];
  realApplyAuthorized: boolean;
  realApplyPrepared: boolean;
  realApplyInvoked: false;
  applyInvoked: false;
  adapterInvoked: false;
  sideEffectInvoked: false;
  dispatchExecuted: false;
  executedAgainstRealTarget: false;
  shouldRunAutomatically: false;
  sideEffectLevel: 'approval_only';
  budget: {
    estimatedUnits: number;
    limitUnits: number;
    withinBudget: boolean;
    budgetReceiptId: string | null;
  };
  scope: {
    allowedSurfaces: Array<CapabilityPreflightApplyDryRunExecution['sourceSurface']>;
    sourceSurfaceAllowed: boolean;
    scopeReceiptId: string | null;
  };
  blockers: string[];
  evidence: string[];
  rollbackHint: string;
  safeSummary: string;
  audit: {
    sourceDryRunGeneratedAt: string;
    actorId: string | null;
    finalApprovalReceiptId: string | null;
    budgetReceiptId: string | null;
    scopeReceiptId: string | null;
    reason: string | null;
  };
  metadata: Record<string, unknown>;
};

export type CapabilityPreflightRealApplyApprovalGateSnapshot = {
  phase: '75';
  surface: 'capability-autopilot-preflight-real-apply-approval-gate';
  generatedAt: string;
  capabilityId: string;
  status: 'ready' | 'blocked';
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  sourceSnapshotPhase: CapabilityPreflightApplyDryRunExecutorSnapshot['phase'];
  decisions: CapabilityPreflightRealApplyApprovalDecision[];
  checks: CapabilityAutopilotPreflightCheck[];
  nextRecommendedPhase: {
    phase: '76';
    title: string;
    reason: string;
  };
  metadata: Record<string, unknown>;
};

export type CapabilityAutopilotPreflightRealApplyApprovalGateRuntime = {
  now?: () => Date;
};

export class CapabilityAutopilotPreflightRealApplyApprovalGateService {
  private readonly now: () => Date;

  constructor(runtime: CapabilityAutopilotPreflightRealApplyApprovalGateRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildDecision(
    execution: CapabilityPreflightApplyDryRunExecution,
    options: CapabilityPreflightRealApplyApprovalOptions = {},
  ): CapabilityPreflightRealApplyApprovalDecision {
    const generatedAt = this.now().toISOString();
    const finalApprovalGranted = options.finalApprovalGranted === true;
    const budgetApproved = options.budgetApproved === true;
    const scopeApproved = options.scopeApproved === true;
    const budget = this.resolveBudget(execution, options);
    const scope = this.resolveScope(execution, options);
    const blockers = this.resolveBlockers(execution, {
      finalApprovalGranted,
      budgetApproved,
      scopeApproved,
      withinBudget: budget.withinBudget,
      sourceSurfaceAllowed: scope.sourceSurfaceAllowed,
    });
    const status: CapabilityPreflightRealApplyApprovalStatus = blockers.length > 0 ? 'blocked' : 'real_apply_ready';
    const realApplyAuthorized = status === 'real_apply_ready';
    const realApplyGateId = this.buildRealApplyGateId(execution, generatedAt, options.finalApprovalReceiptId || null);

    return {
      phase: '75',
      realApplyGateId,
      generatedAt,
      surface: 'capability-autopilot-preflight-real-apply-approval-gate',
      status,
      capabilityId: execution.capabilityId,
      sourceDryRunPhase: execution.phase,
      sourceDryRunExecutionId: execution.dryRunExecutionId,
      sourceSurface: execution.sourceSurface,
      sourceAction: execution.sourceAction,
      invocationKind: execution.invocationKind,
      applyAdapterKind: execution.applyAdapterKind,
      dispatchMode: execution.dispatchMode,
      target: execution.target,
      requiresExplicitUserAction: true,
      requiresFinalApproval: true,
      requiresBudgetApproval: true,
      requiresScopeApproval: true,
      finalApprovalGranted,
      budgetApproved,
      scopeApproved,
      sourceDryRunPassed: execution.dryRunPassed,
      sourceDryRunStatus: execution.status,
      realApplyAuthorized,
      realApplyPrepared: realApplyAuthorized,
      realApplyInvoked: false,
      applyInvoked: false,
      adapterInvoked: false,
      sideEffectInvoked: false,
      dispatchExecuted: false,
      executedAgainstRealTarget: false,
      shouldRunAutomatically: false,
      sideEffectLevel: 'approval_only',
      budget,
      scope,
      blockers,
      evidence: this.buildEvidence(execution, budget, scope, realApplyAuthorized),
      rollbackHint: this.buildRollbackHint(execution),
      safeSummary: this.buildSafeSummary(execution, status),
      audit: {
        sourceDryRunGeneratedAt: execution.generatedAt,
        actorId: options.actorId || null,
        finalApprovalReceiptId: options.finalApprovalReceiptId || null,
        budgetReceiptId: options.budgetReceiptId || null,
        scopeReceiptId: options.scopeReceiptId || null,
        reason: options.reason || null,
      },
      metadata: {
        phase: 'capability-autopilot-phase-75',
        sourceDryRunStatus: execution.status,
        sourceActionKind: execution.sourceAction?.kind || null,
        autoExecute: false,
        realApplyAuthorized,
        realApplyPrepared: realApplyAuthorized,
        realApplyInvoked: false,
        applyInvoked: false,
        adapterInvoked: false,
        sideEffectInvoked: false,
        dispatchExecuted: false,
        executedAgainstRealTarget: false,
      },
    };
  }

  public buildGateSnapshot(
    source: CapabilityPreflightApplyDryRunExecutorSnapshot,
    options: CapabilityPreflightRealApplyApprovalOptions = {},
  ): CapabilityPreflightRealApplyApprovalGateSnapshot {
    const generatedAt = this.now().toISOString();
    const decisions = source.executions.map((execution) => this.buildDecision(execution, options));
    const checks = this.buildChecks(source, decisions);
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      phase: '75',
      surface: 'capability-autopilot-preflight-real-apply-approval-gate',
      generatedAt,
      capabilityId: source.capabilityId,
      status: failed > 0 ? 'blocked' : 'ready',
      summary: {
        ok: failed === 0,
        passed,
        warnings,
        failed,
      },
      sourceSnapshotPhase: source.phase,
      decisions,
      checks,
      nextRecommendedPhase: {
        phase: '76',
        title: 'Preflight Controlled Real Apply Executor',
        reason:
          'Depois do gate final, o proximo passo e executar apply real somente com adapter injetado, budget travado, auditoria e rollback plan por superficie.',
      },
      metadata: {
        phase: 'capability-autopilot-phase-75',
        sourceSnapshotStatus: source.status,
        dryRunExecutionCount: source.executions.length,
        decisionCount: decisions.length,
        autoExecute: false,
        realApplyAuthorizedCount: decisions.filter((decision) => decision.realApplyAuthorized).length,
        realApplyInvoked: false,
        applyInvoked: false,
        adapterInvoked: false,
        sideEffectInvoked: false,
        dispatchExecuted: false,
        executedAgainstRealTarget: false,
      },
    };
  }

  public renderReport(snapshot: CapabilityPreflightRealApplyApprovalGateSnapshot): string {
    const lines: string[] = [];
    lines.push('[capability-autopilot-preflight-real-apply] Fase 75 - Preflight Real Apply Approval Gate');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`capability: ${snapshot.capabilityId}`);
    lines.push(`decisions: ${snapshot.decisions.length}`);
    lines.push('');
    for (const item of snapshot.checks) {
      lines.push(`[${item.status}] ${item.title}`);
      lines.push(`  ${item.reason}`);
      for (const evidence of item.evidence) {
        lines.push(`  - ${evidence}`);
      }
    }
    lines.push('');
    lines.push(`proxima fase recomendada: ${snapshot.nextRecommendedPhase.phase} - ${snapshot.nextRecommendedPhase.title}`);
    lines.push(snapshot.nextRecommendedPhase.reason);
    return lines.join('\n');
  }

  private resolveBudget(
    execution: CapabilityPreflightApplyDryRunExecution,
    options: CapabilityPreflightRealApplyApprovalOptions,
  ): CapabilityPreflightRealApplyApprovalDecision['budget'] {
    const estimatedUnits = this.normalizeBudgetValue(
      options.estimatedBudgetUnits,
      this.estimateBudgetUnits(execution.invocationKind),
    );
    const limitUnits = this.normalizeBudgetValue(options.budgetLimitUnits, 25);
    return {
      estimatedUnits,
      limitUnits,
      withinBudget: estimatedUnits <= limitUnits,
      budgetReceiptId: options.budgetReceiptId || null,
    };
  }

  private resolveScope(
    execution: CapabilityPreflightApplyDryRunExecution,
    options: CapabilityPreflightRealApplyApprovalOptions,
  ): CapabilityPreflightRealApplyApprovalDecision['scope'] {
    const defaultAllowedSurfaces: Array<CapabilityPreflightApplyDryRunExecution['sourceSurface']> = [
      'cli',
      'web',
      'chat',
      'telegram',
      'api',
    ];
    const allowedSurfaces = options.allowedSurfaces && options.allowedSurfaces.length > 0
      ? Array.from(new Set(options.allowedSurfaces))
      : defaultAllowedSurfaces;
    return {
      allowedSurfaces,
      sourceSurfaceAllowed: allowedSurfaces.includes(execution.sourceSurface),
      scopeReceiptId: options.scopeReceiptId || null,
    };
  }

  private resolveBlockers(
    execution: CapabilityPreflightApplyDryRunExecution,
    gates: {
      finalApprovalGranted: boolean;
      budgetApproved: boolean;
      scopeApproved: boolean;
      withinBudget: boolean;
      sourceSurfaceAllowed: boolean;
    },
  ): string[] {
    const blockers = [...execution.blockers];
    if (execution.status !== 'dry_run_passed') {
      blockers.push(`dry_run_not_passed:${execution.status}`);
    }
    if (!execution.dryRunPassed || !execution.dryRunCompleted || !execution.dryRunConfirmed) {
      blockers.push('dry_run_evidence_required');
    }
    if (!gates.finalApprovalGranted) {
      blockers.push('final_approval_required');
    }
    if (!gates.budgetApproved) {
      blockers.push('budget_approval_required');
    }
    if (!gates.withinBudget) {
      blockers.push('budget_exceeded');
    }
    if (!gates.scopeApproved) {
      blockers.push('scope_approval_required');
    }
    if (!gates.sourceSurfaceAllowed) {
      blockers.push('surface_out_of_scope');
    }
    if (
      execution.applyInvoked ||
      execution.adapterInvoked ||
      execution.sideEffectInvoked ||
      execution.dispatchExecuted ||
      execution.executedAgainstRealTarget
    ) {
      blockers.push('source_dry_run_already_invoked_real_target');
    }
    if (execution.shouldRunAutomatically !== false) {
      blockers.push('automatic_real_apply_not_allowed');
    }
    return Array.from(new Set(blockers));
  }

  private buildChecks(
    source: CapabilityPreflightApplyDryRunExecutorSnapshot,
    decisions: CapabilityPreflightRealApplyApprovalDecision[],
  ): CapabilityAutopilotPreflightCheck[] {
    const serialized = JSON.stringify({ source, decisions });
    const blocked = decisions.filter((decision) => decision.status === 'blocked');

    return [
      this.check(
        'capability-autopilot-preflight-real-apply:coverage',
        'approval decision por dry-run execution',
        decisions.length === source.executions.length && blocked.length === 0 ? 'pass' : 'fail',
        'Cada dry-run execution precisa gerar uma decision final autorizada ou bloqueada explicitamente.',
        [
          `dryRunExecutions=${source.executions.length}`,
          `decisions=${decisions.length}`,
          `blocked=${blocked.length}`,
          ...blocked.map((decision) => `${decision.sourceSurface}:${decision.blockers.join('|')}`),
        ],
      ),
      this.check(
        'capability-autopilot-preflight-real-apply:no-invocation',
        'sem apply real automatico',
        decisions.every((decision) =>
          decision.realApplyInvoked === false &&
          decision.applyInvoked === false &&
          decision.adapterInvoked === false &&
          decision.sideEffectInvoked === false &&
          decision.dispatchExecuted === false &&
          decision.executedAgainstRealTarget === false &&
          decision.shouldRunAutomatically === false &&
          decision.metadata.autoExecute === false
        ) ? 'pass' : 'fail',
        'O gate autoriza a proxima etapa, mas ainda nao invoca alvo real.',
        decisions.map((decision) =>
          `${decision.sourceSurface}:${decision.invocationKind}:authorized=${decision.realApplyAuthorized}:invoked=${decision.realApplyInvoked}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-real-apply:final-approval',
        'approval final registrado',
        decisions.every((decision) =>
          decision.finalApprovalGranted &&
          decision.requiresFinalApproval &&
          decision.realApplyAuthorized
        ) ? 'pass' : 'fail',
        'Apply real exige approval final separado do dry-run.',
        decisions.map((decision) =>
          `${decision.sourceSurface}:${decision.sourceAction?.kind || '<none>'}:finalApproval=${decision.finalApprovalGranted}:authorized=${decision.realApplyAuthorized}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-real-apply:budget',
        'budget aprovado e dentro do limite',
        decisions.every((decision) =>
          decision.budgetApproved &&
          decision.budget.withinBudget &&
          decision.budget.estimatedUnits <= decision.budget.limitUnits
        ) ? 'pass' : 'fail',
        'Apply real exige budget aprovado e limite suficiente.',
        decisions.map((decision) =>
          `${decision.sourceSurface}:budget=${decision.budget.estimatedUnits}/${decision.budget.limitUnits}:approved=${decision.budgetApproved}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-real-apply:scope',
        'escopo aprovado por superficie',
        decisions.every((decision) =>
          decision.scopeApproved &&
          decision.scope.sourceSurfaceAllowed
        ) ? 'pass' : 'fail',
        'Apply real so pode seguir em superficies explicitamente aprovadas.',
        decisions.map((decision) =>
          `${decision.sourceSurface}:scopeApproved=${decision.scopeApproved}:allowed=${decision.scope.sourceSurfaceAllowed}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-real-apply:source-dry-run',
        'fonte dry-run valida',
        decisions.every((decision) =>
          decision.sourceDryRunStatus === 'dry_run_passed' &&
          decision.sourceDryRunPassed
        ) ? 'pass' : 'fail',
        'Apply real so pode ser autorizado depois de dry-run concluido.',
        decisions.map((decision) =>
          `${decision.sourceSurface}:${decision.sourceAction?.kind || '<none>'}:dryRun=${decision.sourceDryRunStatus}:passed=${decision.sourceDryRunPassed}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-real-apply:no-raw-payload',
        'sem payload cru serializado',
        !serialized.includes('rawText') && !serialized.includes('normalizedText') ? 'pass' : 'fail',
        'Approval snapshots publicos nao podem reintroduzir intent cru.',
        [
          `containsRawKeys=${String(serialized.includes('rawText') || serialized.includes('normalizedText'))}`,
        ],
      ),
    ];
  }

  private buildRealApplyGateId(
    execution: CapabilityPreflightApplyDryRunExecution,
    generatedAt: string,
    finalApprovalReceiptId: string | null,
  ): string {
    const digest = createHash('sha256')
      .update([
        execution.capabilityId,
        execution.sourceSurface,
        execution.dryRunExecutionId,
        execution.sourceAction?.id || '<none>',
        execution.invocationKind,
        generatedAt,
        finalApprovalReceiptId || '<none>',
      ].join('|'), 'utf8')
      .digest('hex')
      .slice(0, 16);
    return `${execution.capabilityId}-preflight-real-apply-${digest}`;
  }

  private normalizeBudgetValue(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
  }

  private estimateBudgetUnits(invocationKind: CapabilityPreflightApplyDryRunInvocationKind): number {
    switch (invocationKind) {
      case 'cli_command_dry_run':
        return 3;
      case 'web_navigation_dry_run':
      case 'api_request_dry_run':
        return 2;
      case 'chat_callback_dry_run':
      case 'telegram_callback_dry_run':
      case 'manual_operator_dry_run':
      default:
        return 1;
    }
  }

  private buildEvidence(
    execution: CapabilityPreflightApplyDryRunExecution,
    budget: CapabilityPreflightRealApplyApprovalDecision['budget'],
    scope: CapabilityPreflightRealApplyApprovalDecision['scope'],
    realApplyAuthorized: boolean,
  ): string[] {
    return [
      `sourceDryRunExecutionId=${execution.dryRunExecutionId}`,
      `sourceDryRunPassed=${execution.dryRunPassed}`,
      `invocationKind=${execution.invocationKind}`,
      `budget=${budget.estimatedUnits}/${budget.limitUnits}`,
      `surfaceAllowed=${scope.sourceSurfaceAllowed}`,
      `realApplyAuthorized=${realApplyAuthorized}`,
      'realInvocation=false',
    ];
  }

  private buildRollbackHint(execution: CapabilityPreflightApplyDryRunExecution): string {
    return [
      `Approval gate only for ${execution.sourceAction?.kind || '<none>'}.`,
      'Rollback is to revoke this approval decision before any real executor consumes it.',
    ].join(' ');
  }

  private buildSafeSummary(
    execution: CapabilityPreflightApplyDryRunExecution,
    status: CapabilityPreflightRealApplyApprovalStatus,
  ): string {
    if (status === 'blocked') {
      return `Apply real bloqueado para ${execution.sourceAction?.kind || '<sem-action>'}; nenhum alvo real foi invocado.`;
    }
    return `Apply real autorizado para ${execution.sourceAction?.kind || '<sem-action>'}; aguardando executor controlado, sem invocacao real nesta fase.`;
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
