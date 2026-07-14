import { createHash } from 'crypto';
import type {
  CapabilityAutopilotPreflightCheck,
  CapabilityAutopilotPreflightSnapshot,
} from './CapabilityAutopilotPreflightEntrypointService.js';
import {
  CapabilityAutopilotPreflightActionHandlerService,
  type CapabilityPreflightActionHandlerResult,
} from './CapabilityAutopilotPreflightActionHandlerService.js';

export type CapabilityPreflightDispatchReceiptStatus =
  | 'dispatch_receipt_ready'
  | 'blocked';

export type CapabilityPreflightDispatchMode =
  | 'open_only'
  | 'diagnosis_preview'
  | 'permission_request'
  | 'fallback_selection'
  | 'validation_request'
  | 'resume_request'
  | 'memory_hint';

export type CapabilityPreflightDispatchReceipt = {
  gate: 'capability-autopilot-preflight-dispatch-receipt';
  receiptId: string;
  generatedAt: string;
  surface: 'capability-autopilot-preflight-dispatch-receipt';
  status: CapabilityPreflightDispatchReceiptStatus;
  capabilityId: string;
  sourceSurface: CapabilityPreflightActionHandlerResult['sourceSurface'];
  sourceAction: CapabilityPreflightActionHandlerResult['sourceAction'];
  handlerKind: CapabilityPreflightActionHandlerResult['handlerKind'];
  handlerStage: CapabilityPreflightActionHandlerResult['handlerStage'];
  dispatchMode: CapabilityPreflightDispatchMode | null;
  target: CapabilityPreflightActionHandlerResult['target'];
  explicitlyConfirmed: boolean;
  requiresExplicitUserAction: true;
  requiresApproval: boolean;
  requiresValidation: boolean;
  dispatchPrepared: boolean;
  dispatchExecuted: false;
  shouldRunAutomatically: false;
  sideEffectLevel: 'none';
  blockers: string[];
  safeSummary: string;
  audit: {
    sourcePlanGate: CapabilityPreflightActionHandlerResult['gate'];
    sourcePlanGeneratedAt: string;
    confirmationId: string | null;
    actorId: string | null;
    reason: string | null;
  };
  metadata: Record<string, unknown>;
};

export type CapabilityPreflightDispatchReceiptSnapshot = {
  gate: 'capability-autopilot-preflight-dispatch-receipt';
  surface: 'capability-autopilot-preflight-dispatch-receipt';
  generatedAt: string;
  capabilityId: string;
  status: 'ready' | 'blocked';
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  sourceSnapshotGate: CapabilityAutopilotPreflightSnapshot['gate'];
  receipts: CapabilityPreflightDispatchReceipt[];
  checks: CapabilityAutopilotPreflightCheck[];
  nextRecommendedGate: {
    gate: 'capability-autopilot-preflight-dispatch-adapter';
    title: string;
    reason: string;
  };
  metadata: Record<string, unknown>;
};

export type CapabilityPreflightDispatchReceiptOptions = {
  explicitlyConfirmed?: boolean;
  actorId?: string | null;
  confirmationId?: string | null;
  reason?: string | null;
};

export type CapabilityAutopilotPreflightDispatchReceiptRuntime = {
  now?: () => Date;
  actionHandlerService?: Pick<CapabilityAutopilotPreflightActionHandlerService, 'handleAction'>;
};

export class CapabilityAutopilotPreflightDispatchReceiptService {
  private readonly now: () => Date;
  private readonly actionHandlerService: Pick<CapabilityAutopilotPreflightActionHandlerService, 'handleAction'>;

  constructor(runtime: CapabilityAutopilotPreflightDispatchReceiptRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.actionHandlerService = runtime.actionHandlerService || new CapabilityAutopilotPreflightActionHandlerService({
      now: this.now,
    });
  }

  public buildDispatchReceipt(
    plan: CapabilityPreflightActionHandlerResult,
    options: CapabilityPreflightDispatchReceiptOptions = {},
  ): CapabilityPreflightDispatchReceipt {
    const generatedAt = this.now().toISOString();
    const explicitlyConfirmed = options.explicitlyConfirmed === true || plan.userConfirmed === true;
    const blockers = this.resolveBlockers(plan, explicitlyConfirmed);
    const status: CapabilityPreflightDispatchReceiptStatus = blockers.length > 0
      ? 'blocked'
      : 'dispatch_receipt_ready';
    const receiptId = this.buildReceiptId(plan, generatedAt, options.confirmationId || null);

    return {
      gate: 'capability-autopilot-preflight-dispatch-receipt',
      receiptId,
      generatedAt,
      surface: 'capability-autopilot-preflight-dispatch-receipt',
      status,
      capabilityId: plan.capabilityId,
      sourceSurface: plan.sourceSurface,
      sourceAction: plan.sourceAction,
      handlerKind: plan.handlerKind,
      handlerStage: plan.handlerStage,
      dispatchMode: this.resolveDispatchMode(plan),
      target: plan.target,
      explicitlyConfirmed,
      requiresExplicitUserAction: true,
      requiresApproval: plan.requiresApproval,
      requiresValidation: plan.requiresValidation,
      dispatchPrepared: status === 'dispatch_receipt_ready',
      dispatchExecuted: false,
      shouldRunAutomatically: false,
      sideEffectLevel: 'none',
      blockers,
      safeSummary: this.buildSafeSummary(plan, status),
      audit: {
        sourcePlanGate: plan.gate,
        sourcePlanGeneratedAt: plan.generatedAt,
        confirmationId: options.confirmationId || null,
        actorId: options.actorId || null,
        reason: options.reason || null,
      },
      metadata: {
        gate: 'capability-autopilot-preflight-dispatch-receipt',
        sourceActionKind: plan.sourceAction?.kind || null,
        sourceHandlerKind: plan.handlerKind,
        autoExecute: false,
        dispatchAttempted: false,
        dispatchExecuted: false,
      },
    };
  }

  public buildReceiptSnapshot(
    source: CapabilityAutopilotPreflightSnapshot,
    options: CapabilityPreflightDispatchReceiptOptions = {},
  ): CapabilityPreflightDispatchReceiptSnapshot {
    const generatedAt = this.now().toISOString();
    const explicitlyConfirmed = options.explicitlyConfirmed !== false;
    const receipts = source.payloads.flatMap((payload) =>
      payload.actions.map((action) => {
        const plan = this.actionHandlerService.handleAction(source, {
          surface: payload.surface,
          actionId: action.id,
          userConfirmed: explicitlyConfirmed,
        });
        return this.buildDispatchReceipt(plan, {
          ...options,
          explicitlyConfirmed,
        });
      }),
    );
    const checks = this.buildChecks(source, receipts);
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      gate: 'capability-autopilot-preflight-dispatch-receipt',
      surface: 'capability-autopilot-preflight-dispatch-receipt',
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
      receipts,
      checks,
      nextRecommendedGate: {
        gate: 'capability-autopilot-preflight-dispatch-adapter',
        title: 'Preflight Dispatch Adapter Integration',
        reason:
          'Depois de registrar receipts de dispatch explicito, o proximo passo e conectar adapters reais de CLI, web, chat, Telegram e API sem perder approval, validation e auditoria.',
      },
      metadata: {
        gate: 'capability-autopilot-preflight-dispatch-receipt',
        sourceSnapshotStatus: source.status,
        receiptCount: receipts.length,
        autoExecute: false,
        dispatchAttempted: false,
        dispatchExecuted: false,
      },
    };
  }

  public renderReport(snapshot: CapabilityPreflightDispatchReceiptSnapshot): string {
    const lines: string[] = [];
    lines.push('[capability-autopilot-preflight-dispatch] Preflight Handler Execution Receipts');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`capability: ${snapshot.capabilityId}`);
    lines.push(`receipts: ${snapshot.receipts.length}`);
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

  private resolveBlockers(
    plan: CapabilityPreflightActionHandlerResult,
    explicitlyConfirmed: boolean,
  ): string[] {
    const blockers = [...plan.blockers];
    if (plan.status !== 'handler_ready') {
      blockers.push(`handler_not_ready:${plan.status}`);
    }
    if (!explicitlyConfirmed) {
      blockers.push('explicit_confirmation_required');
    }
    if (plan.requiresExplicitUserAction !== true) {
      blockers.push('missing_explicit_user_action_contract');
    }
    return Array.from(new Set(blockers));
  }

  private resolveDispatchMode(
    plan: CapabilityPreflightActionHandlerResult,
  ): CapabilityPreflightDispatchMode | null {
    switch (plan.handlerKind) {
      case 'open_preflight_snapshot':
        return 'open_only';
      case 'start_diagnosis_preview':
        return 'diagnosis_preview';
      case 'prepare_permission_request':
        return 'permission_request';
      case 'open_fallback_selection':
        return 'fallback_selection';
      case 'prepare_validation_check':
        return 'validation_request';
      case 'prepare_resume_after_validation':
        return 'resume_request';
      case 'open_redacted_memory_hint':
        return 'memory_hint';
      default:
        return null;
    }
  }

  private buildChecks(
    source: CapabilityAutopilotPreflightSnapshot,
    receipts: CapabilityPreflightDispatchReceipt[],
  ): CapabilityAutopilotPreflightCheck[] {
    const serialized = JSON.stringify({ source, receipts });
    const sourceActionCount = source.payloads.reduce((sum, payload) => sum + payload.actions.length, 0);
    const blocked = receipts.filter((receipt) => receipt.status === 'blocked');
    const sensitive = receipts.filter((receipt) =>
      receipt.sourceAction?.kind === 'request_permission' ||
      receipt.sourceAction?.kind === 'show_fallbacks' ||
      receipt.sourceAction?.kind === 'run_validation' ||
      receipt.sourceAction?.kind === 'resume_after_check'
    );

    return [
      this.check(
        'capability-autopilot-preflight-dispatch:coverage',
        'receipt por action',
        receipts.length === sourceActionCount && blocked.length === 0 ? 'pass' : 'fail',
        'Each explicitly chosen action must produce an auditable receipt.',
        [
          `sourceActions=${sourceActionCount}`,
          `receipts=${receipts.length}`,
          `blocked=${blocked.length}`,
          ...blocked.map((receipt) => `${receipt.sourceSurface}:${receipt.blockers.join('|')}`),
        ],
      ),
      this.check(
        'capability-autopilot-preflight-dispatch:no-execution',
        'sem execucao no receipt',
        receipts.every((receipt) =>
          receipt.dispatchExecuted === false &&
          receipt.shouldRunAutomatically === false &&
          receipt.sideEffectLevel === 'none' &&
          receipt.metadata.autoExecute === false
        ) ? 'pass' : 'fail',
        'Receipt de dispatch registra a tentativa explicita, mas nao executa side effect.',
        receipts.map((receipt) =>
          `${receipt.sourceSurface}:${receipt.sourceAction?.kind || '<none>'}:executed=${receipt.dispatchExecuted}:sideEffect=${receipt.sideEffectLevel}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-dispatch:explicit-confirmation',
        'confirmacao explicita registrada',
        receipts.every((receipt) =>
          receipt.explicitlyConfirmed &&
          receipt.requiresExplicitUserAction &&
          receipt.dispatchPrepared
        ) ? 'pass' : 'fail',
        'Este gate so prepara receipt pronto quando existe confirmacao explicita.',
        receipts.map((receipt) =>
          `${receipt.sourceSurface}:${receipt.sourceAction?.kind || '<none>'}:confirmed=${receipt.explicitlyConfirmed}:prepared=${receipt.dispatchPrepared}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-dispatch:sensitive-gates',
        'gates sensiveis preservados',
        sensitive.every((receipt) =>
          (
            receipt.sourceAction?.kind === 'request_permission'
              ? receipt.requiresApproval
              : true
          ) &&
          (
            receipt.sourceAction?.kind === 'run_validation' || receipt.sourceAction?.kind === 'resume_after_check'
              ? receipt.requiresValidation
              : true
          )
        ) ? 'pass' : 'fail',
        'Receipts de permissao, fallback, validacao e resume precisam preservar approval/validation gates.',
        sensitive.map((receipt) =>
          `${receipt.sourceSurface}:${receipt.sourceAction?.kind}:approval=${receipt.requiresApproval}:validation=${receipt.requiresValidation}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-dispatch:no-raw-payload',
        'sem payload cru serializado',
        !serialized.includes('rawText') && !serialized.includes('normalizedText') ? 'pass' : 'fail',
        'Receipts publicos de dispatch nao podem reintroduzir intent cru.',
        [
          `containsRawKeys=${String(serialized.includes('rawText') || serialized.includes('normalizedText'))}`,
        ],
      ),
    ];
  }

  private buildReceiptId(
    plan: CapabilityPreflightActionHandlerResult,
    generatedAt: string,
    confirmationId: string | null,
  ): string {
    const digest = createHash('sha256')
      .update([
        plan.capabilityId,
        plan.sourceSurface,
        plan.sourceAction?.id || '<none>',
        plan.handlerKind || '<none>',
        generatedAt,
        confirmationId || '<none>',
      ].join('|'), 'utf8')
      .digest('hex')
      .slice(0, 16);
    return `${plan.capabilityId}-preflight-dispatch-${digest}`;
  }

  private buildSafeSummary(
    plan: CapabilityPreflightActionHandlerResult,
    status: CapabilityPreflightDispatchReceiptStatus,
  ): string {
    if (status === 'blocked') {
      return `Dispatch receipt bloqueado para ${plan.sourceAction?.kind || '<sem-action>'}; nenhum side effect foi executado.`;
    }
    return `Dispatch receipt preparado para ${plan.sourceAction?.kind || '<sem-action>'}; nenhum side effect foi executado.`;
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
