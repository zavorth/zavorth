import {
  type ApprovalCoordinator,
  type ApprovalCoordinatorGatewayPort,
  type ApprovalPresenterDismissal,
} from './ApprovalCoordinator.js';
import type { AgentPermissionService } from '../permission/AgentPermissionService.js';
import type {
  SmartDecisionAdvice,
  SmartDecisionAdvisor,
  SmartDecisionInput,
} from './SmartDecisionAdvisor.js';
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
  type SurfaceDecisionPendingFilter,
  type SurfaceDecisionPort,
} from './SurfaceDecisionPort.js';

export type SurfaceDecisionPendingEntry = {
  decisionType: SurfaceDecisionType;
  ref: string;
};

type SurfaceDecisionSpineOptions = {
  coordinator: Pick<ApprovalCoordinator, 'registerPendingApproval' | 'collectPresenterDismissals' | 'getGatewayPort'> &
    Partial<Pick<ApprovalCoordinator, 'listPendingMenuRefs'>>;
  scopeMemory: Pick<AgentPermissionService, 'respond' | 'evaluate'>;
  accessGate?: (input: { userId: string | null }) => Promise<{ allowed: boolean; reason?: string }>;
  /**
   * Opt-in pre-decision advisor (OFF when omitted). Never consulted by
   * resolve(): callers MAY invoke advisePending() before deciding.
   */
  smartAdvisor?: Pick<SmartDecisionAdvisor, 'advise'>;
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
  private readonly smartAdvisor: SurfaceDecisionSpineOptions['smartAdvisor'];

  constructor(options: SurfaceDecisionSpineOptions) {
    this.coordinator = options.coordinator;
    this.scopeMemory = options.scopeMemory;
    this.accessGate = options.accessGate;
    this.smartAdvisor = options.smartAdvisor;
  }

  public getGatewayPort(): ApprovalCoordinatorGatewayPort {
    return this.coordinator.getGatewayPort();
  }

  public registerDecisionPort(type: SurfaceDecisionType, port: SurfaceDecisionPort): void {
    this.ports.set(type, port);
  }

  public listRegisteredTypes(): SurfaceDecisionType[] {
    return SURFACE_DECISION_TYPES.filter((type) => this.ports.has(type));
  }

  /**
   * Explicit pre-decision advice hook. Callers MAY invoke this before
   * resolve(); the spine never consults it automatically, so wiring an
   * advisor can never change what resolve() does. Without an advisor the
   * answer is the fail-closed disabled verdict.
   */
  public async advisePending(input: SmartDecisionInput): Promise<SmartDecisionAdvice> {
    if (!this.smartAdvisor) {
      return { action: 'ask', source: 'disabled' };
    }
    return this.smartAdvisor.advise(input);
  }

  /**
   * First registered decision type whose port claims the reference, in the
   * canonical contract order. Cross-surface resolvers use this to honor
   * 'decisionType: first registered port claiming ref'; null means no port
   * claims it and callers fall back to their default type.
   */
  public findClaimingType(ref: string): SurfaceDecisionType | null {
    const normalized = String(ref || '').trim();
    for (const type of SURFACE_DECISION_TYPES) {
      const port = this.ports.get(type);
      if (port && port.findPending(normalized)) {
        return type;
      }
    }
    return null;
  }

  /**
   * Deterministic cross-surface pending listing: every registered port that
   * can enumerate its store contributes its refs under its own decision type,
   * then live coordinator menus contribute their rendered refs attributed to
   * the agent-run domain (the coordinator's gateway is the universal-run
   * approval store). Refs already listed by a port are not repeated.
   */
  public listPending(filter: SurfaceDecisionPendingFilter = {}): SurfaceDecisionPendingEntry[] {
    const entries: SurfaceDecisionPendingEntry[] = [];
    const seenKeys = new Set<string>();
    const portRefs = new Set<string>();
    for (const type of SURFACE_DECISION_TYPES) {
      const port = this.ports.get(type);
      if (!port?.listPending) {
        continue;
      }
      for (const ref of port.listPending(filter)) {
        const normalized = String(ref || '').trim();
        if (!normalized) {
          continue;
        }
        const key = `${type}:${normalized}`;
        if (seenKeys.has(key)) {
          continue;
        }
        seenKeys.add(key);
        portRefs.add(normalized);
        entries.push({ decisionType: type, ref: normalized });
      }
    }
    for (const ref of this.coordinator.listPendingMenuRefs?.() ?? []) {
      if (portRefs.has(ref)) {
        continue;
      }
      const key = `agent-run:${ref}`;
      if (seenKeys.has(key)) {
        continue;
      }
      seenKeys.add(key);
      entries.push({ decisionType: 'agent-run', ref });
    }
    return entries;
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

    // TOCTOU guard: re-check pending state immediately before deciding.
    // A concurrent async request for the same ref could have resolved it
    // between registerPendingApproval and this point. Node.js single-threaded
    // event loop prevents true parallelism within a synchronous block, but
    // await boundaries yield the microtask queue. The engine's own idempotency
    // ensures a duplicate decision is harmless; this guard makes the short-path
    // explicit rather than relying on that alone.
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
