import type { CapabilityAutopilotSurface } from '../contracts/CapabilityAutopilotContract.js';
import type { CapabilityAutopilotPreflightCheck } from './CapabilityAutopilotPreflightEntrypointService.js';
import type {
  CapabilityPreflightDispatchReceipt,
  CapabilityPreflightDispatchReceiptSnapshot,
} from './CapabilityAutopilotPreflightDispatchReceiptService.js';

export type CapabilityPreflightDispatchAdapterKind =
  | 'cli_command_preview'
  | 'web_route_intent'
  | 'chat_callback_ack'
  | 'telegram_callback_ack'
  | 'api_operation_descriptor'
  | 'manual_operator_prompt';

export type CapabilityPreflightDispatchAdapterStatus =
  | 'adapter_ready'
  | 'blocked';

export type CapabilityPreflightDispatchAdapterEnvelope = {
  gate: 'capability-autopilot-preflight-dispatch-adapter';
  generatedAt: string;
  surface: 'capability-autopilot-preflight-dispatch-adapter';
  status: CapabilityPreflightDispatchAdapterStatus;
  capabilityId: string;
  sourceReceiptId: string;
  sourceSurface: CapabilityAutopilotSurface;
  sourceAction: CapabilityPreflightDispatchReceipt['sourceAction'];
  dispatchMode: CapabilityPreflightDispatchReceipt['dispatchMode'];
  adapterKind: CapabilityPreflightDispatchAdapterKind;
  target: {
    command: string | null;
    route: string | null;
    callbackData: string | null;
    method: 'GET' | 'POST' | null;
  };
  adapterPayload: Record<string, unknown>;
  requiresExplicitUserAction: true;
  requiresApproval: boolean;
  requiresValidation: boolean;
  receiptConfirmed: boolean;
  adapterPrepared: boolean;
  adapterInvoked: false;
  dispatchExecuted: false;
  shouldRunAutomatically: false;
  sideEffectLevel: 'none';
  blockers: string[];
  safeSummary: string;
  metadata: Record<string, unknown>;
};

export type CapabilityPreflightDispatchAdapterSnapshot = {
  gate: 'capability-autopilot-preflight-dispatch-adapter';
  surface: 'capability-autopilot-preflight-dispatch-adapter';
  generatedAt: string;
  capabilityId: string;
  status: 'ready' | 'blocked';
  summary: {
    ok: boolean;
    passed: number;
    warnings: number;
    failed: number;
  };
  sourceSnapshotGate: CapabilityPreflightDispatchReceiptSnapshot['gate'];
  envelopes: CapabilityPreflightDispatchAdapterEnvelope[];
  checks: CapabilityAutopilotPreflightCheck[];
  nextRecommendedGate: {
    gate: 'capability-autopilot-preflight-side-effect-gate';
    title: string;
    reason: string;
  };
  metadata: Record<string, unknown>;
};

export type CapabilityAutopilotPreflightDispatchAdapterRuntime = {
  now?: () => Date;
};

export class CapabilityAutopilotPreflightDispatchAdapterService {
  private readonly now: () => Date;

  constructor(runtime: CapabilityAutopilotPreflightDispatchAdapterRuntime = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildEnvelope(
    receipt: CapabilityPreflightDispatchReceipt,
  ): CapabilityPreflightDispatchAdapterEnvelope {
    const generatedAt = this.now().toISOString();
    const adapterKind = this.resolveAdapterKind(receipt);
    const blockers = this.resolveBlockers(receipt, adapterKind);
    const status: CapabilityPreflightDispatchAdapterStatus = blockers.length > 0 ? 'blocked' : 'adapter_ready';

    return {
      gate: 'capability-autopilot-preflight-dispatch-adapter',
      generatedAt,
      surface: 'capability-autopilot-preflight-dispatch-adapter',
      status,
      capabilityId: receipt.capabilityId,
      sourceReceiptId: receipt.receiptId,
      sourceSurface: receipt.sourceSurface,
      sourceAction: receipt.sourceAction,
      dispatchMode: receipt.dispatchMode,
      adapterKind,
      target: {
        command: receipt.target.command || null,
        route: receipt.target.route || null,
        callbackData: receipt.target.callbackData || null,
        method: this.resolveMethod(receipt, adapterKind),
      },
      adapterPayload: this.buildAdapterPayload(receipt, adapterKind),
      requiresExplicitUserAction: true,
      requiresApproval: receipt.requiresApproval,
      requiresValidation: receipt.requiresValidation,
      receiptConfirmed: receipt.explicitlyConfirmed,
      adapterPrepared: status === 'adapter_ready',
      adapterInvoked: false,
      dispatchExecuted: false,
      shouldRunAutomatically: false,
      sideEffectLevel: 'none',
      blockers,
      safeSummary: this.buildSafeSummary(receipt, adapterKind, status),
      metadata: {
        gate: 'capability-autopilot-preflight-dispatch-adapter',
        sourceReceiptPhase: receipt.gate,
        sourceReceiptStatus: receipt.status,
        sourceActionKind: receipt.sourceAction?.kind || null,
        adapterKind,
        autoExecute: false,
        adapterInvoked: false,
        dispatchExecuted: false,
      },
    };
  }

  public buildAdapterSnapshot(
    source: CapabilityPreflightDispatchReceiptSnapshot,
  ): CapabilityPreflightDispatchAdapterSnapshot {
    const generatedAt = this.now().toISOString();
    const envelopes = source.receipts.map((receipt) => this.buildEnvelope(receipt));
    const checks = this.buildChecks(source, envelopes);
    const failed = checks.filter((check) => check.status === 'fail').length;
    const warnings = checks.filter((check) => check.status === 'warn').length;
    const passed = checks.filter((check) => check.status === 'pass').length;

    return {
      gate: 'capability-autopilot-preflight-dispatch-adapter',
      surface: 'capability-autopilot-preflight-dispatch-adapter',
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
      envelopes,
      checks,
      nextRecommendedGate: {
        gate: 'capability-autopilot-preflight-side-effect-gate',
        title: 'Preflight Dispatch Side-Effect Gate',
        reason:
          'Depois de preparar adapters por superficie, o proximo passo e criar um gate de side effect que exige approval/validation antes de qualquer invocacao real.',
      },
      metadata: {
        gate: 'capability-autopilot-preflight-dispatch-adapter',
        sourceSnapshotStatus: source.status,
        receiptCount: source.receipts.length,
        envelopeCount: envelopes.length,
        autoExecute: false,
        adapterInvoked: false,
        dispatchExecuted: false,
      },
    };
  }

  public renderReport(snapshot: CapabilityPreflightDispatchAdapterSnapshot): string {
    const lines: string[] = [];
    lines.push('[capability-autopilot-preflight-adapters] Preflight Dispatch Adapter Integration');
    lines.push(`status: ${snapshot.status}`);
    lines.push(`ok: ${snapshot.summary.ok ? 'yes' : 'no'} | pass=${snapshot.summary.passed} warn=${snapshot.summary.warnings} fail=${snapshot.summary.failed}`);
    lines.push(`capability: ${snapshot.capabilityId}`);
    lines.push(`envelopes: ${snapshot.envelopes.length}`);
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

  private resolveAdapterKind(
    receipt: CapabilityPreflightDispatchReceipt,
  ): CapabilityPreflightDispatchAdapterKind {
    if (receipt.sourceSurface === 'cli' && receipt.target.command) {
      return 'cli_command_preview';
    }
    if (receipt.sourceSurface === 'web' || receipt.sourceSurface === 'mobile') {
      return 'web_route_intent';
    }
    if (receipt.sourceSurface === 'api') {
      return 'api_operation_descriptor';
    }
    if (receipt.sourceSurface === 'chat') {
      return 'chat_callback_ack';
    }
    if (receipt.sourceSurface === 'telegram') {
      return 'telegram_callback_ack';
    }
    return 'manual_operator_prompt';
  }

  private resolveMethod(
    receipt: CapabilityPreflightDispatchReceipt,
    adapterKind: CapabilityPreflightDispatchAdapterKind,
  ): CapabilityPreflightDispatchAdapterEnvelope['target']['method'] {
    if (adapterKind === 'api_operation_descriptor') {
      return receipt.dispatchMode === 'open_only' || receipt.dispatchMode === 'memory_hint' ? 'GET' : 'POST';
    }
    if (adapterKind === 'web_route_intent') {
      return 'GET';
    }
    return null;
  }

  private resolveBlockers(
    receipt: CapabilityPreflightDispatchReceipt,
    adapterKind: CapabilityPreflightDispatchAdapterKind,
  ): string[] {
    const blockers = [...receipt.blockers];
    if (receipt.status !== 'dispatch_receipt_ready') {
      blockers.push(`receipt_not_ready:${receipt.status}`);
    }
    if (!receipt.explicitlyConfirmed) {
      blockers.push('receipt_confirmation_missing');
    }
    if (adapterKind === 'web_route_intent' && !receipt.target.route) {
      blockers.push('route_required');
    }
    if (adapterKind === 'api_operation_descriptor' && !receipt.target.route) {
      blockers.push('api_route_required');
    }
    if ((adapterKind === 'chat_callback_ack' || adapterKind === 'telegram_callback_ack') && !receipt.target.callbackData) {
      blockers.push('callback_required');
    }
    if (adapterKind === 'cli_command_preview' && !receipt.target.command) {
      blockers.push('command_required');
    }
    return Array.from(new Set(blockers));
  }

  private buildAdapterPayload(
    receipt: CapabilityPreflightDispatchReceipt,
    adapterKind: CapabilityPreflightDispatchAdapterKind,
  ): Record<string, unknown> {
    return {
      adapterKind,
      receiptId: receipt.receiptId,
      capabilityId: receipt.capabilityId,
      actionKind: receipt.sourceAction?.kind || null,
      actionLabel: receipt.sourceAction?.label || null,
      dispatchMode: receipt.dispatchMode,
      requiresApproval: receipt.requiresApproval,
      requiresValidation: receipt.requiresValidation,
      explicitUserActionRequired: true,
      sideEffectLevel: 'none',
    };
  }

  private buildChecks(
    source: CapabilityPreflightDispatchReceiptSnapshot,
    envelopes: CapabilityPreflightDispatchAdapterEnvelope[],
  ): CapabilityAutopilotPreflightCheck[] {
    const serialized = JSON.stringify({ source, envelopes });
    const blocked = envelopes.filter((envelope) => envelope.status === 'blocked');
    const surfaces = new Set(envelopes.map((envelope) => envelope.sourceSurface));
    const expectedSurfaces: CapabilityAutopilotSurface[] = ['cli', 'web', 'chat', 'telegram', 'api'];
    const missingSurfaces = expectedSurfaces.filter((surface) => !surfaces.has(surface));
    const sensitive = envelopes.filter((envelope) =>
      envelope.sourceAction?.kind === 'request_permission' ||
      envelope.sourceAction?.kind === 'show_fallbacks' ||
      envelope.sourceAction?.kind === 'run_validation' ||
      envelope.sourceAction?.kind === 'resume_after_check'
    );

    return [
      this.check(
        'capability-autopilot-preflight-adapters:coverage',
        'adapters por receipt',
        envelopes.length === source.receipts.length && blocked.length === 0 ? 'pass' : 'fail',
        'Cada receipt pronto precisa virar envelope de adapter seguro.',
        [
          `receipts=${source.receipts.length}`,
          `envelopes=${envelopes.length}`,
          `blocked=${blocked.length}`,
          ...blocked.map((envelope) => `${envelope.sourceSurface}:${envelope.blockers.join('|')}`),
        ],
      ),
      this.check(
        'capability-autopilot-preflight-adapters:surface-coverage',
        'superficies cobertas',
        missingSurfaces.length === 0 ? 'pass' : 'fail',
        'O gate padrao precisa produzir envelopes para CLI, web, chat, Telegram e API.',
        [`surfaces=${Array.from(surfaces).join(',')}`, ...missingSurfaces.map((surface) => `missing=${surface}`)],
      ),
      this.check(
        'capability-autopilot-preflight-adapters:no-invocation',
        'sem invocacao no adapter',
        envelopes.every((envelope) =>
          envelope.adapterInvoked === false &&
          envelope.dispatchExecuted === false &&
          envelope.shouldRunAutomatically === false &&
          envelope.sideEffectLevel === 'none' &&
          envelope.metadata.autoExecute === false
        ) ? 'pass' : 'fail',
        'Adapter integration prepara envelopes por superficie, mas nao invoca side effect.',
        envelopes.map((envelope) =>
          `${envelope.sourceSurface}:${envelope.adapterKind}:invoked=${envelope.adapterInvoked}:executed=${envelope.dispatchExecuted}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-adapters:explicit-only',
        'explicit-only preservado',
        envelopes.every((envelope) =>
          envelope.requiresExplicitUserAction &&
          envelope.receiptConfirmed &&
          envelope.adapterPrepared
        ) ? 'pass' : 'fail',
        'Envelope de adapter so fica pronto quando parte de receipt confirmado.',
        envelopes.map((envelope) =>
          `${envelope.sourceSurface}:${envelope.sourceAction?.kind || '<none>'}:confirmed=${envelope.receiptConfirmed}:prepared=${envelope.adapterPrepared}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-adapters:sensitive-gates',
        'gates sensiveis preservados',
        sensitive.every((envelope) =>
          (
            envelope.sourceAction?.kind === 'request_permission'
              ? envelope.requiresApproval
              : true
          ) &&
          (
            envelope.sourceAction?.kind === 'run_validation' || envelope.sourceAction?.kind === 'resume_after_check'
              ? envelope.requiresValidation
              : true
          )
        ) ? 'pass' : 'fail',
        'Adapters de permissao, fallback, validacao e resume precisam preservar gates.',
        sensitive.map((envelope) =>
          `${envelope.sourceSurface}:${envelope.sourceAction?.kind}:approval=${envelope.requiresApproval}:validation=${envelope.requiresValidation}`,
        ),
      ),
      this.check(
        'capability-autopilot-preflight-adapters:no-raw-payload',
        'sem payload cru serializado',
        !serialized.includes('rawText') && !serialized.includes('normalizedText') ? 'pass' : 'fail',
        'Envelopes publicos de adapter nao podem reintroduzir intent cru.',
        [
          `containsRawKeys=${String(serialized.includes('rawText') || serialized.includes('normalizedText'))}`,
        ],
      ),
    ];
  }

  private buildSafeSummary(
    receipt: CapabilityPreflightDispatchReceipt,
    adapterKind: CapabilityPreflightDispatchAdapterKind,
    status: CapabilityPreflightDispatchAdapterStatus,
  ): string {
    if (status === 'blocked') {
      return `Adapter ${adapterKind} bloqueado para ${receipt.sourceAction?.kind || '<sem-action>'}; nada foi invocado.`;
    }
    return `Adapter ${adapterKind} preparado para ${receipt.sourceAction?.kind || '<sem-action>'}; nada foi invocado.`;
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
