import {
  type ApprovalCoordinator,
  type ApprovalPresenterDismissal,
} from './ApprovalCoordinator.js';
import type { AgentPermissionService } from '../permission/AgentPermissionService.js';
import { SURFACE_DECISION_TYPES } from './SurfaceDecisionContract.js';
import type {
  SurfaceDecisionChoice,
  SurfaceDecisionDismissal,
  SurfaceDecisionReceipt,
  SurfaceDecisionRequest,
  SurfaceDecisionScopeMemory,
  SurfaceDecisionType,
} from './SurfaceDecisionContract.js';
import {
  createCaptureReplyIO,
  type SurfaceDecisionPort,
} from './SurfaceDecisionPort.js';

type SurfaceDecisionSpineOptions = {
  coordinator: Pick<ApprovalCoordinator, 'registerPendingApproval' | 'collectPresenterDismissals'>;
  scopeMemory: Pick<AgentPermissionService, 'respond' | 'evaluate'>;
  accessGate?: (input: { userId: string | null }) => Promise<{ allowed: boolean; reason?: string }>;
};

export type SurfaceDecisionResolveInput =
  | (SurfaceDecisionRequest & {
      choice: SurfaceDecisionChoice;
      transportContext?: unknown;
    })
  | (SurfaceDecisionRequest & {
      rawArgs: string;
      transportContext?: unknown;
    });

const GROUPED_RECEIPT_PREFIX = '[grouped] ';

/**
 * The single decision spine: any surface resolves any decision type through
 * resolve(), which composes access gating, duplicate coalescing, the typed
 * decision port, scope memory, and cross-surface presenter dismissals.
 */
export class SurfaceDecisionSpine {
  private readonly ports = new Map<SurfaceDecisionType, SurfaceDecisionPort>();
  private readonly coordinator: SurfaceDecisionSpineOptions['coordinator'];
  private readonly scopeMemory: SurfaceDecisionSpineOptions['scopeMemory'];
  private readonly accessGate: SurfaceDecisionSpineOptions['accessGate'];

  constructor(options: SurfaceDecisionSpineOptions) {
    this.coordinator = options.coordinator;
    this.scopeMemory = options.scopeMemory;
    this.accessGate = options.accessGate;
  }

  public registerDecisionPort(type: SurfaceDecisionType, port: SurfaceDecisionPort): void {
    this.ports.set(type, port);
  }

  public listRegisteredTypes(): SurfaceDecisionType[] {
    return SURFACE_DECISION_TYPES.filter((type) => this.ports.has(type));
  }

  public async resolve(input: SurfaceDecisionResolveInput): Promise<SurfaceDecisionReceipt> {
    if (this.accessGate) {
      const verdict = await this.accessGate({ userId: input.userId ?? null });
      if (!verdict.allowed) {
        return {
          resolved: false,
          receiptText: verdict.reason ?? null,
          decidedBy: 'operator',
          dismissals: [],
        };
      }
    }

    const ref = String(input.decisionRef || '').trim();
    const port = this.ports.get(input.decisionType);
    if (!port) {
      return { resolved: false, receiptText: null, decidedBy: 'operator', dismissals: [] };
    }

    const coalescing = this.coordinator.registerPendingApproval({
      sessionId: input.sessionId ?? '',
      ref,
      title: input.title ?? null,
      reason: input.reason ?? null,
      risk: input.risk ?? null,
    });
    const grouped =
      coalescing.isDuplicate && coalescing.leaderRef !== '' && coalescing.leaderRef !== ref;

    if (!port.findPending(ref)) {
      return { resolved: false, receiptText: null, decidedBy: 'operator', dismissals: [] };
    }

    const outcome =
      'rawArgs' in input && port.decideRaw
        ? await port.decideRaw({
            rawArgs: input.rawArgs,
            actorId: input.userId ?? null,
            chatId: input.chatId ?? null,
            transportContext: input.transportContext,
          })
        : await port.decide({
            ref,
            choice: readChoice(input),
            actorId: input.userId ?? null,
            surface: input.surface,
            chatId: input.chatId,
            sessionId: input.sessionId ?? null,
            io: createCaptureReplyIO(),
            transportContext: input.transportContext,
          });

    const receiptText =
      outcome.receiptText == null ? null : grouped ? `${GROUPED_RECEIPT_PREFIX}${outcome.receiptText}` : outcome.receiptText;

    return {
      resolved: outcome.resolved,
      receiptText,
      decidedBy: grouped ? 'coalesced-follower' : outcome.decidedBy,
      scopeMemory:
        outcome.resolved && 'choice' in input && input.choice !== 'once'
          ? this.recordScopeMemory(input, input.choice)
          : undefined,
      dismissals: outcome.resolved
        ? this.coordinator.collectPresenterDismissals([ref]).map(toReceiptDismissal)
        : [],
    };
  }

  /**
   * Best-effort scope memory write: a failing memory must never break the
   * operator's decision, so any error collapses into recorded:false. Raw-args
   * resolutions never reach this method — their engines run their own
   * permission memory inside the parsed decision itself.
   */
  private recordScopeMemory(
    input: SurfaceDecisionRequest,
    choice: SurfaceDecisionChoice,
  ): SurfaceDecisionScopeMemory {
    try {
      const remembered = this.scopeMemory.respond({
        choice,
        toolName: `${input.decisionType}:${input.decisionRef}`,
        pattern: input.title ?? input.reason ?? '',
        risk: input.risk ?? null,
        sessionId: input.sessionId ?? null,
        actorId: input.userId ?? null,
        surface: input.surface,
      });
      return {
        recorded: Boolean(remembered?.remembered),
        choice,
        expiresAt: remembered?.expiresAt ?? null,
      };
    } catch {
      return { recorded: false, choice, expiresAt: null };
    }
  }
}

function readChoice(input: SurfaceDecisionResolveInput): SurfaceDecisionChoice {
  return 'choice' in input ? input.choice : 'once';
}

function toReceiptDismissal(dismissal: ApprovalPresenterDismissal): SurfaceDecisionDismissal {
  return {
    surface: dismissal.platform,
    chatId: dismissal.chatId,
    resolvedRefs: [...dismissal.resolvedRefs],
    promptMessageId: dismissal.promptMessageId,
  };
}
