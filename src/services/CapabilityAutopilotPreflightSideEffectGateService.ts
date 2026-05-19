import type { CapabilityAutopilotPreflightCheck } from './CapabilityAutopilotPreflightEntrypointService.js';
import type {
  CapabilityPreflightDispatchAdapterEnvelope,
  CapabilityPreflightDispatchAdapterSnapshot,
} from './CapabilityAutopilotPreflightDispatchAdapterService.js';

export type CapabilityPreflightSideEffectGateStatus =
  | 'side_effect_ready'
  | 'blocked';

export type CapabilityPreflightSideEffectApprovalStatus =
  | 'not_required'
  | 'approved'
  | 'missing';

export type CapabilityPreflightSideEffectValidationStatus =
  | 'not_required'
  | 'validated'
  | 'missing';

export type CapabilityPreflightSideEffectGateOptions = {
  approvalGranted?: boolean;
  validationPassed?: boolean;
  actorId?: string | null;
  approvalReceiptId?: string | null;
  validationReceiptId?: string | null;
  reason?: string | null;
};

export type CapabilityPreflightSideEffectGateDecision = {
  phase: '72';
  generatedAt: string;
  surface: 'capability-autopilot-preflight-side-effect-gate';
  status: CapabilityPreflightSideEffectGateStatus;
  capabilityId: string;
  sourceSurface: CapabilityPreflightDispatchAdapterEnvelope['sourceSurface'];
  sourceReceiptId: string;
  sourceAction: CapabilityPreflightDispatchAdapterEnvelope['sourceAction'];
  adapterKind: CapabilityPreflightDispatchAdapterEnvelope['adapterKind'];
  dispatchMode: CapabilityPreflightDispatchAdapterEnvelope['dispatchMode'];
  target: CapabilityPreflightDispatchAdapterEnvelope['target'];
  requiresExplicitUserAction: true;
  requiresApproval: boolean;
  requiresValidation: boolean;
  approvalStatus: CapabilityPreflightSideEffectApprovalStatus;
  validationStatus: CapabilityPreflightSideEffectValidationStatus;
  sideEffectAuthorized: boolean;
  sideEffectInvoked: false;
  adapterInvoked: false;
  dispatchExecuted: false;
  shouldRunAutomatically: false;
  sideEffectLevel: 'gate_only';
  blockers: string[];
  safeSummary: string;
  audit: {
    sourceAdapterPhase: CapabilityPreflightDispatchAdapterEnvelope['phase'];
    sourceAdapterGeneratedAt: string;
    actorId: string | null;
    approvalReceiptId: string | null;
    validationReceiptId: string | null;
    reason: string | null;
  };
  metadata: Record<string, unknown>;
};

export type CapabilityPreflightSideEffectGateSnapshot = {
  phase: '72';
  surface: 'capability-autopilot-preflight-side-effect-gate';
  generatedAt: string;
  capabilityId: string;
  status: 'ready' | 'blocked';
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  sourceSnapshotPhase: CapabilityPreflightDispatchAdapterSnapshot['phase'];
  decisions: CapabilityPreflightSideEffectGateDecision[];
  checks: CapabilityAutopilotPreflightCheck[];
  nextRecommendedPhase: {
    phase: '73';
    title: string;
    reason: string;
  };
  metadata: Record<string, unknown>;
};

export type CapabilityAutopilotPreflightSideEffectGateRuntime = {
  now?: () => Date;
};

export class CapabilityAutopilotPreflightSideEffectGateService {
  private readonly now: () => Date;

  constructor(runtime: CapabilityAutopilotPreflightSideEffectGateRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public evaluateEnvelope(
    envelope: CapabilityPreflightDispatchAdapterEnvelope,
    options: CapabilityPreflightSideEffectGateOptions = {},
  ): CapabilityPreflightSideEffectGateDecision {
    const generatedAt = this.now().toISOString();
    const approvalStatus = this.resolveApprovalStatus(envelope, options);
    const validationStatus = this.resolveValidationStatus(envelope, options);
    const blockers = this.resolveBlockers(envelope, approvalStatus, validationStatus);
    const status: CapabilityPreflightSideEffectGateStatus = blockers.length > 0 ? 'blocked' : 'side_effect_ready';

    return {
      phase: '72',
      generatedAt,
      surface: 'capability-autopilot-preflight-side-effect-gate',
      status,
      capabilityId: envelope.capabilityId,
      sourceSurface: envelope.sourceSurface,
      sourceReceiptId: envelope.sourceReceiptId,
      sourceAction: envelope.sourceAction,
      adapterKind: envelope.adapterKind,
      dispatchMode: envelope.dispatchMode,
      target: envelope.target,
      requiresExplicitUserAction: true,
      requiresApproval: envelope.requiresApproval,
      requiresValidation: envelope.requiresValidation,
      approvalStatus,
      validationStatus,
      sideEffectAuthorized: status === 'side_effect_ready',
      sideEffectInvoked: false,
      adapterInvoked: false,
      dispatchExecuted: false,
      shouldRunAutomatically: false,
      sideEffectLevel: 'gate_only',
      blockers,
      safeSummary: this.buildSafeSummary(envelope, status),
      audit: {
        sourceAdapterPhase: envelope.phase,
        sourceAdapterGeneratedAt: envelope.generatedAt,
        actorId: options.actorId || null,
        approvalReceiptId: options.approvalReceiptId || null,
        validationReceiptId: options.validationReceiptId || null,
        reason: options.reason || null,
      },
      metadata: {
        phase: 'capability-autopilot-checkpoint-72',
        sourceAdapterKind: envelope.adapterKind,
        sourceActionKind: envelope.sourceAction?.kind || null,
        autoExecute: false,
        sideEffectInvoked: false,
        adapterInvoked: false,
        dispatchExecuted: false,
      },
    };
  }

  public buildGateSnapshot(
    source: CapabilityPreflightDispatchAdapterSnapshot,
    options: CapabilityPreflightSideEffectGateOptions = {},
  ): CapabilityPreflightSideEffectGateSnapshot {
    const generatedAt = this.now().toISOString();
    const decisions = source.envelopes.map((envelope) => this.evaluateEnvelope(envelope, options));
    const checks = this.buildChecks(source, decisions);
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      phase: '72',
      surface: 'capability-autopilot-preflight-side-effect-gate',
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
        phase: '73',
        title: 'Preflight Dispatch Apply Adapter',
        reason:
          'Depois do side-effect gate, o proximo passo e criar adapters de apply que recebam uma decisao autorizada e ainda emitam receipt antes de invocar qualquer superficie real.',
      },
      metadata: {
        phase: 'capability-autopilot-checkpoint-72',
        sourceSnapshotStatus: source.status,
        envelopeCount: source.envelopes.length,
        decisionCount: decisions.length,
        autoExecute: false,
        sideEffectInvoked: false,
        adapterInvoked: false,
        dispatchExecuted: false,
      },
    };
  }

  public renderReport(snapshot: CapabilityPreflightSideEffectGateSnapshot): string {
    const lines: string[] = [];
    lines.push('[capability-autopilot-preflight-side-effect] Etapa 72 - Preflight Dispatch Side-Effect Gate');
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
    lines.push(`proximo passo recomendada: ${snapshot.nextRecommendedPhase.phase} - ${snapshot.nextRecommendedPhase.title}`);
    lines.push(snapshot.nextRecommendedPhase.reason);
    return lines.join('\n');
  }

  private resolveApprovalStatus(
    envelope: CapabilityPreflightDispatchAdapterEnvelope,
    options: CapabilityPreflightSideEffectGateOptions,
  ): CapabilityPreflightSideEffectApprovalStatus {
    if (!envelope.requiresApproval) {
      return 'not_required';
    }
    return options.approvalGranted === true ? 'approved' : 'missing';
  }

  private resolveValidationStatus(
    envelope: CapabilityPreflightDispatchAdapterEnvelope,
    options: CapabilityPreflightSideEffectGateOptions,
  ): CapabilityPreflightSideEffectValidationStatus {
    if (!envelope.requiresValidation) {
      return 'not_required';
    }
    return options.validationPassed === true ? 'validated' : 'missing';
  }

  private resolveBlockers(
    envelope: CapabilityPreflightDispatchAdapterEnvelope,
    approvalStatus: CapabilityPreflightSideEffectApprovalStatus,
    validationStatus: CapabilityPreflightSideEffectValidationStatus,
  ): string[] {
    const blockers = [...envelope.blockers];
    if (envelope.status !== 'adapter_ready') {
      blockers.push(`adapter_not_ready:${envelope.status}`);
    }
    if (!envelope.adapterPrepared) {
      blockers.push('adapter_not_prepared');
    }
    if (!envelope.receiptConfirmed) {
      blockers.push('receipt_confirmation_missing');
    }
    if (approvalStatus === 'missing') {
      blockers.push('approval_required');
    }
    if (validationStatus === 'missing') {
      blockers.push('validation_required');
    }
    return Array.from(new Set(blockers));
  }

  private buildChecks(
    source: CapabilityPreflightDispatchAdapterSnapshot,
    decisions: CapabilityPreflightSideEffectGateDecision[],
  ): CapabilityAutopilotPreflightCheck[] {
    const serialized = JSON.stringify({ source, decisions });
    const blocked = decisions.filter((decision) => decision.status === 'blocked');
    const approvalsMissing = decisions.filter((decision) => decision.approvalStatus === 'missing');
    const validationsMissing = decisions.filter((decision) => decision.validationStatus === 'missing');

    return [
      this.check(
        'capability-autopilot-preflight-side-effect:coverage',
        'decisao por adapter',
        decisions.length === source.envelopes.length && blocked.length === 0 ? 'pass' : 'fail',
        'Cada envelope de adapter precisa passar pelo gate de side effect.',
        [
          `envelopes=${source.envelopes.length}`,
          `decisions=${decisions.length}`,
          `blocked=${blocked.length}`,
          ...blocked.map((decision) => `${decision.sourceSurface}:${decision.blockers.join('|')}`),
        ],
      ),
      this.check(
        'capability-autopilot-preflight-side-effect:no-invocation',
        'sem side effect invocado',
        decisions.every((decision) =>
          decision.sideEffectInvoked === false &&
          decision.adapterInvoked === false &&
          decision.dispatchExecuted === false &&
          decision.shouldRunAutomatically === false &&
          decision.metadata.autoExecute === false
        ) ? 'pass' : 'fail',
        'O gate autoriza ou bloqueia; ele ainda nao invoca nenhuma superficie real.',
        decisions.map((decision) =>
          `${decision.sourceSurface}:${decision.sourceAction?.kind || '<none>'}:authorized=${decision.sideEffectAuthorized}:invoked=${decision.sideEffectInvoked}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-side-effect:approval-gate',
        'approval preservado',
        approvalsMissing.length === 0 ? 'pass' : 'fail',
        'Actions que exigem approval precisam carregar evidencia de approval antes de side effect.',
        approvalsMissing.length === 0
          ? decisions
            .filter((decision) => decision.requiresApproval)
            .map((decision) => `${decision.sourceSurface}:${decision.sourceAction?.kind}:approval=${decision.approvalStatus}`)
          : approvalsMissing.map((decision) => `${decision.sourceSurface}:${decision.sourceAction?.kind}:approval=missing`),
      ),
      this.check(
        'capability-autopilot-preflight-side-effect:validation-gate',
        'validation preservado',
        validationsMissing.length === 0 ? 'pass' : 'fail',
        'Actions que exigem validation precisam carregar evidencia de validation antes de side effect.',
        validationsMissing.length === 0
          ? decisions
            .filter((decision) => decision.requiresValidation)
            .map((decision) => `${decision.sourceSurface}:${decision.sourceAction?.kind}:validation=${decision.validationStatus}`)
          : validationsMissing.map((decision) => `${decision.sourceSurface}:${decision.sourceAction?.kind}:validation=missing`),
      ),
      this.check(
        'capability-autopilot-preflight-side-effect:no-raw-payload',
        'sem payload cru serializado',
        !serialized.includes('rawText') && !serialized.includes('normalizedText') ? 'pass' : 'fail',
        'Gate publico de side effect nao pode reintroduzir intent cru.',
        [
          `containsRawKeys=${String(serialized.includes('rawText') || serialized.includes('normalizedText'))}`,
        ],
      ),
    ];
  }

  private buildSafeSummary(
    envelope: CapabilityPreflightDispatchAdapterEnvelope,
    status: CapabilityPreflightSideEffectGateStatus,
  ): string {
    if (status === 'blocked') {
      return `Side-effect gate bloqueou ${envelope.sourceAction?.kind || '<sem-action>'}; nada foi invocado.`;
    }
    return `Side-effect gate autorizou ${envelope.sourceAction?.kind || '<sem-action>'} para proxima etapa; nada foi invocado.`;
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
