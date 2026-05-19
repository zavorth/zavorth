import { createHash } from 'crypto';
import type { CapabilityAutopilotPreflightCheck } from './CapabilityAutopilotPreflightEntrypointService.js';
import type {
  CapabilityPreflightSideEffectGateDecision,
  CapabilityPreflightSideEffectGateSnapshot,
} from './CapabilityAutopilotPreflightSideEffectGateService.js';

export type CapabilityPreflightApplyAdapterStatus =
  | 'apply_receipt_ready'
  | 'blocked';

export type CapabilityPreflightApplyAdapterKind =
  | 'cli_apply_plan'
  | 'web_navigation_plan'
  | 'chat_callback_plan'
  | 'telegram_callback_plan'
  | 'api_request_plan'
  | 'manual_operator_plan';

export type CapabilityPreflightApplyAdapterOptions = {
  explicitApplyConfirmed?: boolean;
  actorId?: string | null;
  applyConfirmationId?: string | null;
  reason?: string | null;
};

export type CapabilityPreflightApplyReceipt = {
  phase: '73';
  applyReceiptId: string;
  generatedAt: string;
  surface: 'capability-autopilot-preflight-apply-adapter';
  status: CapabilityPreflightApplyAdapterStatus;
  capabilityId: string;
  sourceDecisionPhase: CapabilityPreflightSideEffectGateDecision['phase'];
  sourceSurface: CapabilityPreflightSideEffectGateDecision['sourceSurface'];
  sourceReceiptId: string;
  sourceAction: CapabilityPreflightSideEffectGateDecision['sourceAction'];
  adapterKind: CapabilityPreflightSideEffectGateDecision['adapterKind'];
  applyAdapterKind: CapabilityPreflightApplyAdapterKind;
  dispatchMode: CapabilityPreflightSideEffectGateDecision['dispatchMode'];
  target: CapabilityPreflightSideEffectGateDecision['target'];
  explicitApplyConfirmed: boolean;
  requiresExplicitUserAction: true;
  requiresApproval: boolean;
  requiresValidation: boolean;
  approvalStatus: CapabilityPreflightSideEffectGateDecision['approvalStatus'];
  validationStatus: CapabilityPreflightSideEffectGateDecision['validationStatus'];
  applyPrepared: boolean;
  applyInvoked: false;
  adapterInvoked: false;
  sideEffectInvoked: false;
  dispatchExecuted: false;
  shouldRunAutomatically: false;
  sideEffectLevel: 'prepared_only';
  blockers: string[];
  invocationPlan: {
    kind: CapabilityPreflightApplyAdapterKind;
    command: string | null;
    route: string | null;
    callbackData: string | null;
    method: 'GET' | 'POST' | null;
    dryRun: true;
  };
  rollbackHint: string;
  safeSummary: string;
  audit: {
    sourceDecisionGeneratedAt: string;
    actorId: string | null;
    applyConfirmationId: string | null;
    reason: string | null;
  };
  metadata: Record<string, unknown>;
};

export type CapabilityPreflightApplyAdapterSnapshot = {
  phase: '73';
  surface: 'capability-autopilot-preflight-apply-adapter';
  generatedAt: string;
  capabilityId: string;
  status: 'ready' | 'blocked';
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  sourceSnapshotPhase: CapabilityPreflightSideEffectGateSnapshot['phase'];
  applyReceipts: CapabilityPreflightApplyReceipt[];
  checks: CapabilityAutopilotPreflightCheck[];
  nextRecommendedPhase: {
    phase: '74';
    title: string;
    reason: string;
  };
  metadata: Record<string, unknown>;
};

export type CapabilityAutopilotPreflightApplyAdapterRuntime = {
  now?: () => Date;
};

export class CapabilityAutopilotPreflightApplyAdapterService {
  private readonly now: () => Date;

  constructor(runtime: CapabilityAutopilotPreflightApplyAdapterRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildApplyReceipt(
    decision: CapabilityPreflightSideEffectGateDecision,
    options: CapabilityPreflightApplyAdapterOptions = {},
  ): CapabilityPreflightApplyReceipt {
    const generatedAt = this.now().toISOString();
    const explicitApplyConfirmed = options.explicitApplyConfirmed === true;
    const applyAdapterKind = this.resolveApplyAdapterKind(decision);
    const blockers = this.resolveBlockers(decision, explicitApplyConfirmed);
    const status: CapabilityPreflightApplyAdapterStatus = blockers.length > 0 ? 'blocked' : 'apply_receipt_ready';
    const applyReceiptId = this.buildApplyReceiptId(decision, generatedAt, options.applyConfirmationId || null);

    return {
      phase: '73',
      applyReceiptId,
      generatedAt,
      surface: 'capability-autopilot-preflight-apply-adapter',
      status,
      capabilityId: decision.capabilityId,
      sourceDecisionPhase: decision.phase,
      sourceSurface: decision.sourceSurface,
      sourceReceiptId: decision.sourceReceiptId,
      sourceAction: decision.sourceAction,
      adapterKind: decision.adapterKind,
      applyAdapterKind,
      dispatchMode: decision.dispatchMode,
      target: decision.target,
      explicitApplyConfirmed,
      requiresExplicitUserAction: true,
      requiresApproval: decision.requiresApproval,
      requiresValidation: decision.requiresValidation,
      approvalStatus: decision.approvalStatus,
      validationStatus: decision.validationStatus,
      applyPrepared: status === 'apply_receipt_ready',
      applyInvoked: false,
      adapterInvoked: false,
      sideEffectInvoked: false,
      dispatchExecuted: false,
      shouldRunAutomatically: false,
      sideEffectLevel: 'prepared_only',
      blockers,
      invocationPlan: {
        kind: applyAdapterKind,
        command: decision.target.command || null,
        route: decision.target.route || null,
        callbackData: decision.target.callbackData || null,
        method: decision.target.method,
        dryRun: true,
      },
      rollbackHint: this.buildRollbackHint(decision),
      safeSummary: this.buildSafeSummary(decision, status),
      audit: {
        sourceDecisionGeneratedAt: decision.generatedAt,
        actorId: options.actorId || null,
        applyConfirmationId: options.applyConfirmationId || null,
        reason: options.reason || null,
      },
      metadata: {
        phase: 'capability-autopilot-checkpoint-73',
        sourceDecisionStatus: decision.status,
        sourceActionKind: decision.sourceAction?.kind || null,
        autoExecute: false,
        applyInvoked: false,
        adapterInvoked: false,
        sideEffectInvoked: false,
        dispatchExecuted: false,
      },
    };
  }

  public buildApplySnapshot(
    source: CapabilityPreflightSideEffectGateSnapshot,
    options: CapabilityPreflightApplyAdapterOptions = {},
  ): CapabilityPreflightApplyAdapterSnapshot {
    const generatedAt = this.now().toISOString();
    const applyReceipts = source.decisions.map((decision) => this.buildApplyReceipt(decision, options));
    const checks = this.buildChecks(source, applyReceipts);
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      phase: '73',
      surface: 'capability-autopilot-preflight-apply-adapter',
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
      applyReceipts,
      checks,
      nextRecommendedPhase: {
        phase: '74',
        title: 'Preflight Apply Dry-Run Executor',
        reason:
          'Depois de preparar receipts de apply, o proximo passo e executar somente dry-runs instrumentados antes de permitir side effects reais por superficie.',
      },
      metadata: {
        phase: 'capability-autopilot-checkpoint-73',
        sourceSnapshotStatus: source.status,
        decisionCount: source.decisions.length,
        applyReceiptCount: applyReceipts.length,
        autoExecute: false,
        applyInvoked: false,
        adapterInvoked: false,
        sideEffectInvoked: false,
        dispatchExecuted: false,
      },
    };
  }

  public renderReport(snapshot: CapabilityPreflightApplyAdapterSnapshot): string {
    const lines: string[] = [];
    lines.push('[capability-autopilot-preflight-apply] Etapa 73 - Preflight Dispatch Apply Adapter');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`capability: ${snapshot.capabilityId}`);
    lines.push(`applyReceipts: ${snapshot.applyReceipts.length}`);
    lines.push('');
    for (const item of snapshot.checks) {
      lines.push(`[${item.status}] ${item.title}`);
      lines.push(`  ${item.reason}`);
      for (const evidence of item.evidence) {
        lines.push(`  - ${evidence}`);
      }
    }
    lines.push('');
    lines.push(`proximo passo recomendada: ${snapshot.nextRecommendedPhase.phase} - ${snapshot.nextRecommendedPhase.title}`);
    lines.push(snapshot.nextRecommendedPhase.reason);
    return lines.join('\n');
  }

  private resolveApplyAdapterKind(
    decision: CapabilityPreflightSideEffectGateDecision,
  ): CapabilityPreflightApplyAdapterKind {
    switch (decision.adapterKind) {
      case 'cli_command_preview':
        return 'cli_apply_plan';
      case 'web_route_intent':
        return 'web_navigation_plan';
      case 'chat_callback_ack':
        return 'chat_callback_plan';
      case 'telegram_callback_ack':
        return 'telegram_callback_plan';
      case 'api_operation_descriptor':
        return 'api_request_plan';
      case 'manual_operator_prompt':
      default:
        return 'manual_operator_plan';
    }
  }

  private resolveBlockers(
    decision: CapabilityPreflightSideEffectGateDecision,
    explicitApplyConfirmed: boolean,
  ): string[] {
    const blockers = [...decision.blockers];
    if (decision.status !== 'side_effect_ready') {
      blockers.push(`side_effect_not_ready:${decision.status}`);
    }
    if (!decision.sideEffectAuthorized) {
      blockers.push('side_effect_not_authorized');
    }
    if (!explicitApplyConfirmed) {
      blockers.push('apply_confirmation_required');
    }
    if (decision.sideEffectInvoked || decision.adapterInvoked || decision.dispatchExecuted) {
      blockers.push('source_decision_already_invoked');
    }
    return Array.from(new Set(blockers));
  }

  private buildChecks(
    source: CapabilityPreflightSideEffectGateSnapshot,
    applyReceipts: CapabilityPreflightApplyReceipt[],
  ): CapabilityAutopilotPreflightCheck[] {
    const serialized = JSON.stringify({ source, applyReceipts });
    const blocked = applyReceipts.filter((receipt) => receipt.status === 'blocked');

    return [
      this.check(
        'capability-autopilot-preflight-apply:coverage',
        'apply receipt por decision',
        applyReceipts.length === source.decisions.length && blocked.length === 0 ? 'pass' : 'fail',
        'Cada decision autorizada precisa gerar um apply receipt preparado.',
        [
          `decisions=${source.decisions.length}`,
          `applyReceipts=${applyReceipts.length}`,
          `blocked=${blocked.length}`,
          ...blocked.map((receipt) => `${receipt.sourceSurface}:${receipt.blockers.join('|')}`),
        ],
      ),
      this.check(
        'capability-autopilot-preflight-apply:no-invocation',
        'sem apply automatico',
        applyReceipts.every((receipt) =>
          receipt.applyInvoked === false &&
          receipt.adapterInvoked === false &&
          receipt.sideEffectInvoked === false &&
          receipt.dispatchExecuted === false &&
          receipt.shouldRunAutomatically === false &&
          receipt.metadata.autoExecute === false
        ) ? 'pass' : 'fail',
        'Apply adapter emite receipt e plano dry-run; ele ainda nao invoca superficies reais.',
        applyReceipts.map((receipt) =>
          `${receipt.sourceSurface}:${receipt.applyAdapterKind}:prepared=${receipt.applyPrepared}:invoked=${receipt.applyInvoked}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-apply:explicit-confirmation',
        'confirmacao de apply registrada',
        applyReceipts.every((receipt) =>
          receipt.explicitApplyConfirmed &&
          receipt.requiresExplicitUserAction &&
          receipt.applyPrepared
        ) ? 'pass' : 'fail',
        'Apply receipt pronto exige confirmacao explicita separada do gate anterior.',
        applyReceipts.map((receipt) =>
          `${receipt.sourceSurface}:${receipt.sourceAction?.kind || '<none>'}:applyConfirmed=${receipt.explicitApplyConfirmed}:prepared=${receipt.applyPrepared}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-apply:dry-run-plan',
        'plano dry-run',
        applyReceipts.every((receipt) => receipt.invocationPlan.dryRun === true) ? 'pass' : 'fail',
        'A Etapa 73 so prepara plano dry-run para a proximo passo.',
        applyReceipts.map((receipt) => `${receipt.sourceSurface}:${receipt.applyAdapterKind}:dryRun=${receipt.invocationPlan.dryRun}`),
      ),
      this.check(
        'capability-autopilot-preflight-apply:no-raw-payload',
        'sem payload cru serializado',
        !serialized.includes('rawText') && !serialized.includes('normalizedText') ? 'pass' : 'fail',
        'Apply receipts publicos nao podem reintroduzir intent cru.',
        [
          `containsRawKeys=${String(serialized.includes('rawText') || serialized.includes('normalizedText'))}`,
        ],
      ),
    ];
  }

  private buildApplyReceiptId(
    decision: CapabilityPreflightSideEffectGateDecision,
    generatedAt: string,
    applyConfirmationId: string | null,
  ): string {
    const digest = createHash('sha256')
      .update([
        decision.capabilityId,
        decision.sourceSurface,
        decision.sourceReceiptId,
        decision.sourceAction?.id || '<none>',
        decision.adapterKind,
        generatedAt,
        applyConfirmationId || '<none>',
      ].join('|'), 'utf8')
      .digest('hex')
      .slice(0, 16);
    return `${decision.capabilityId}-preflight-apply-${digest}`;
  }

  private buildRollbackHint(decision: CapabilityPreflightSideEffectGateDecision): string {
    return [
      `No side effect was invoked for ${decision.sourceAction?.kind || '<none>'}.`,
      'Rollback is to discard this apply receipt and keep the prior dispatch receipt for audit.',
    ].join(' ');
  }

  private buildSafeSummary(
    decision: CapabilityPreflightSideEffectGateDecision,
    status: CapabilityPreflightApplyAdapterStatus,
  ): string {
    if (status === 'blocked') {
      return `Apply receipt bloqueado para ${decision.sourceAction?.kind || '<sem-action>'}; nada foi invocado.`;
    }
    return `Apply receipt preparado para ${decision.sourceAction?.kind || '<sem-action>'}; plano dry-run criado e nada foi invocado.`;
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
