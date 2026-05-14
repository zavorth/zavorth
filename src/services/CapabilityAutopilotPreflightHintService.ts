import type {
  CapabilityMemoryRecord,
  CapabilityReadinessSnapshot,
  CapabilityReceipt,
} from '../contracts/CapabilityAutopilotContract.js';
import {
  CapabilityAutopilotMemoryRecallService,
  type CapabilityMemoryRecallResult,
} from './CapabilityAutopilotMemoryRecallService.js';
import { CapabilityAutopilotReadinessService } from './CapabilityAutopilotReadinessService.js';

type ReadinessLike = Pick<CapabilityAutopilotReadinessService, 'buildReadinessSnapshot'>;
type RecallLike = Pick<CapabilityAutopilotMemoryRecallService, 'buildQueryFromReceipt' | 'recall'>;

export type CapabilityPreflightHintStatus =
  | 'hint_available'
  | 'no_hint'
  | 'insufficient_signal';

export type CapabilityPreflightHintKind =
  | 'ready'
  | 'permission'
  | 'fallback'
  | 'repair'
  | 'manual'
  | 'none';

export type CapabilityPreflightHintInput = {
  capabilityId: string;
  records: CapabilityMemoryRecord[];
  receipt?: CapabilityReceipt | null;
  workspace?: string | null;
  rawIntentText?: string | null;
  maxResults?: number;
};

export type CapabilityPreflightHintResult = {
  generatedAt: string;
  capabilityId: string;
  status: CapabilityPreflightHintStatus;
  hintKind: CapabilityPreflightHintKind;
  readiness: CapabilityReadinessSnapshot;
  recall: CapabilityMemoryRecallResult;
  headline: string;
  userSummary: string;
  technicalSummary: string;
  recommendedNextAction: string | null;
  shouldAskPermission: boolean;
  requiresExplicitUserChoice: boolean;
  shouldRunAutomatically: false;
  metadata: Record<string, unknown>;
};

export type CapabilityAutopilotPreflightHintRuntime = {
  now?: () => Date;
  readinessService?: ReadinessLike;
  recallService?: RecallLike;
};

export class CapabilityAutopilotPreflightHintService {
  private readonly now: () => Date;
  private readonly readinessService: ReadinessLike;
  private readonly recallService: RecallLike;

  constructor(runtime: CapabilityAutopilotPreflightHintRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.readinessService = runtime.readinessService || new CapabilityAutopilotReadinessService();
    this.recallService = runtime.recallService || new CapabilityAutopilotMemoryRecallService({
      now: this.now,
    });
  }

  public async buildPreflightHint(
    input: CapabilityPreflightHintInput,
  ): Promise<CapabilityPreflightHintResult> {
    const generatedAt = this.now().toISOString();
    const readiness = await this.readinessService.buildReadinessSnapshot(input.capabilityId);
    const recall = this.recallService.recall(
      input.records,
      this.buildRecallQuery(input, readiness),
    );
    const hintKind = this.resolveHintKind(recall);
    const status = this.resolveStatus(recall);

    return {
      generatedAt,
      capabilityId: input.capabilityId,
      status,
      hintKind,
      readiness,
      recall,
      headline: this.buildHeadline(readiness, recall, hintKind, status),
      userSummary: this.buildUserSummary(readiness, recall, hintKind, status),
      technicalSummary: this.buildTechnicalSummary(readiness, recall, hintKind, status),
      recommendedNextAction: status === 'hint_available' ? recall.recommendedNextAction : null,
      shouldAskPermission: this.shouldAskPermission(hintKind),
      requiresExplicitUserChoice: hintKind === 'fallback' || hintKind === 'permission' || hintKind === 'repair',
      shouldRunAutomatically: false,
      metadata: {
        phase: 'capability-autopilot-phase-14',
        autoExecute: false,
        rawIntentStored: false,
        rawWorkspaceStored: false,
        recordCount: input.records.length,
        recallStatus: recall.status,
        recallShouldPreloadHint: recall.shouldPreloadHint,
        readinessStatus: readiness.status,
        readinessReady: readiness.ready,
        readinessSafeToRun: readiness.safeToRun,
      },
    };
  }

  private buildRecallQuery(
    input: CapabilityPreflightHintInput,
    readiness: CapabilityReadinessSnapshot,
  ) {
    if (input.receipt) {
      return this.recallService.buildQueryFromReceipt(input.receipt, {
        workspace: input.workspace,
        rawIntentText: input.rawIntentText,
        maxResults: input.maxResults,
      });
    }

    return {
      capabilityId: input.capabilityId,
      workspace: input.workspace || null,
      rawIntentText: input.rawIntentText || null,
      failureKind: readiness.ready ? null : readiness.blockingReason || readiness.status,
      maxResults: input.maxResults,
    };
  }

  private resolveStatus(recall: CapabilityMemoryRecallResult): CapabilityPreflightHintStatus {
    if (recall.status === 'insufficient_signal') {
      return 'insufficient_signal';
    }
    if (recall.status !== 'match_found' || !recall.shouldPreloadHint) {
      return 'no_hint';
    }
    return 'hint_available';
  }

  private resolveHintKind(recall: CapabilityMemoryRecallResult): CapabilityPreflightHintKind {
    if (recall.status !== 'match_found' || !recall.shouldPreloadHint) {
      return 'none';
    }

    switch (recall.recommendedNextAction) {
      case 'resume_original_intent_after_readiness_check':
        return 'ready';
      case 'ask_for_explicit_approval_with_scoped_permissions':
        return 'permission';
      case 'continue_selected_fallback_with_audit_receipt':
        return 'fallback';
      case 'rebuild_preview_first_repair_plan':
        return 'repair';
      case 'offer_visible_fallback_or_manual_operator_review':
        return 'manual';
      default:
        return 'none';
    }
  }

  private shouldAskPermission(kind: CapabilityPreflightHintKind): boolean {
    return kind === 'permission' || kind === 'fallback' || kind === 'repair';
  }

  private buildHeadline(
    readiness: CapabilityReadinessSnapshot,
    recall: CapabilityMemoryRecallResult,
    hintKind: CapabilityPreflightHintKind,
    status: CapabilityPreflightHintStatus,
  ): string {
    if (status === 'insufficient_signal') {
      return 'Ainda nao tenho sinal suficiente para sugerir um caminho conhecido.';
    }
    if (status === 'no_hint') {
      return 'Vou seguir pelo diagnostico normal desta capability.';
    }
    if (hintKind === 'ready') {
      return 'Ja vi um caso parecido que terminou pronto para retomar.';
    }
    if (hintKind === 'permission') {
      return 'Ja vi um caso parecido que precisou de permissao contextual.';
    }
    if (hintKind === 'fallback') {
      return 'Ja vi um caso parecido que usou fallback escolhido pelo usuario.';
    }
    if (hintKind === 'repair') {
      return 'Ja vi um caso parecido que precisou reconstruir o plano de reparo.';
    }
    if (hintKind === 'manual') {
      return 'Ja vi um caso parecido que pediu revisao manual ou fallback visivel.';
    }
    return readiness.summary || recall.safeSummary;
  }

  private buildUserSummary(
    readiness: CapabilityReadinessSnapshot,
    recall: CapabilityMemoryRecallResult,
    hintKind: CapabilityPreflightHintKind,
    status: CapabilityPreflightHintStatus,
  ): string {
    if (status !== 'hint_available') {
      return `${readiness.summary} ${recall.safeSummary}`.trim();
    }

    const base = recall.safeSummary;
    if (hintKind === 'fallback') {
      return `${base} Posso mostrar essa alternativa, mas nao vou trocar de executor sem voce escolher.`;
    }
    if (hintKind === 'permission') {
      return `${base} Posso preparar um pedido de permissao com escopo claro, mas nada sera executado sem aprovacao.`;
    }
    if (hintKind === 'repair') {
      return `${base} Posso montar um plano preview-first antes de qualquer mudanca.`;
    }
    return `${base} Vou tratar isso como dica de preflight, nao como ordem automatica.`;
  }

  private buildTechnicalSummary(
    readiness: CapabilityReadinessSnapshot,
    recall: CapabilityMemoryRecallResult,
    hintKind: CapabilityPreflightHintKind,
    status: CapabilityPreflightHintStatus,
  ): string {
    return [
      `preflightHint=${status}`,
      `hintKind=${hintKind}`,
      `readiness=${readiness.status}`,
      `ready=${readiness.ready}`,
      `safeToRun=${readiness.safeToRun}`,
      `recall=${recall.status}`,
      `matches=${recall.matches.length}`,
      `bestScore=${recall.bestMatch?.score ?? 0}`,
      `autoExecute=false`,
    ].join('; ');
  }
}
