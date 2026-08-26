import type { SurfaceDecisionReceipt } from '../SurfaceDecisionContract.js';
import type { TaskApprovalService, TaskDecisionContext } from '../TaskApprovalService.js';
import {
  createCaptureReplyIO,
  type CaptureReplyIO,
  type SurfaceDecisionPendingFilter,
  type SurfaceDecisionPort,
  type SurfaceDecisionPortDecideInput,
  type SurfaceDecisionPortDecideRawInput,
} from '../SurfaceDecisionPort.js';

function assertTaskDecisionContext(context: unknown): asserts context is TaskDecisionContext {
  if (!context || typeof (context as Record<string, unknown>).reply !== 'function') {
    throw new Error('Invalid task decision context: missing reply()');
  }
}

export type TaskDecisionEngine = Pick<
  TaskApprovalService,
  'handleApproval' | 'handleRejection'
>;

export type TaskDecisionPortOptions = {
  /**
   * Accurate pending lookup over the engine's task store when the caller can
   * supply one; without it the port stays optimistic and the engine's own
   * error path produces the guidance receipt.
   */
  isPending?: (ref: string) => boolean;
  /**
   * Enumeration of live pending task references for cross-surface pending
   * listings; without it the port cannot contribute to spine.listPending.
   */
  pendingRefs?: (filter: SurfaceDecisionPendingFilter) => string[];
};

const UNTEXTED_RECEIPT: SurfaceDecisionReceipt = {
  resolved: true,
  receiptText: null,
  decidedBy: 'operator',
  dismissals: [],
};

/**
 * Adapts the channel-agnostic task-approval decision engine to the universal
 * port. The engine speaks the structural TaskDecisionContext and pushes its
 * receipt through ctx.reply; headless resolutions hand it a capturing io so
 * the text comes back as receiptText instead of being sent. When a live
 * transport context is bound the engine receives it verbatim — downstream
 * hooks (task/workflow resume) keep the original context identity and the
 * receipt stays textless.
 */
export class TaskDecisionPort implements SurfaceDecisionPort {
  private readonly engine: TaskDecisionEngine;
  private readonly isPendingOverride: ((ref: string) => boolean) | null;
  private readonly pendingRefsProvider: ((filter: SurfaceDecisionPendingFilter) => string[]) | null;

  constructor(engine: TaskDecisionEngine, options: TaskDecisionPortOptions = {}) {
    this.engine = engine;
    this.isPendingOverride = options.isPending ?? null;
    this.pendingRefsProvider = options.pendingRefs ?? null;
  }

  public findPending(ref: string): boolean {
    if (this.isPendingOverride) {
      return this.isPendingOverride(ref);
    }
    return true;
  }

  public listPending(filter: SurfaceDecisionPendingFilter = {}): string[] {
    return this.pendingRefsProvider ? this.pendingRefsProvider(filter) : [];
  }

  public async decide(input: SurfaceDecisionPortDecideInput): Promise<SurfaceDecisionReceipt> {
    if (input.transportContext != null) {
      assertTaskDecisionContext(input.transportContext);
      const nativeContext = input.transportContext;
      if (input.choice === 'deny') {
        await this.engine.handleRejection(nativeContext, input.ref);
      } else {
        const args = input.choice === 'once' ? input.ref : `${input.ref} ${input.choice}`;
        await this.engine.handleApproval(nativeContext, args);
      }
      return UNTEXTED_RECEIPT;
    }

    const capture = createCaptureReplyIO();
    await this.runParsedChoice(input, capture);
    return {
      resolved: true,
      receiptText: capture.capturedText,
      decidedBy: 'operator',
      dismissals: [],
    };
  }

  public async decideRaw(input: SurfaceDecisionPortDecideRawInput): Promise<SurfaceDecisionReceipt> {
    if (input.transportContext != null) {
      assertTaskDecisionContext(input.transportContext);
      await this.engine.handleApproval(input.transportContext, input.rawArgs);
      return UNTEXTED_RECEIPT;
    }

    const capture = createCaptureReplyIO();
    const legacyContext = this.buildLegacyContext(
      { actorId: input.actorId, chatId: input.chatId },
      capture,
    );
    await this.engine.handleApproval(legacyContext, input.rawArgs);
    return {
      resolved: true,
      receiptText: capture.capturedText,
      decidedBy: 'operator',
      dismissals: [],
    };
  }

  private async runParsedChoice(
    input: SurfaceDecisionPortDecideInput,
    capture: CaptureReplyIO,
  ): Promise<void> {
    if (input.choice === 'deny') {
      await this.engine.handleRejection(this.buildLegacyContext(input, capture), input.ref);
      return;
    }
    const args = input.choice === 'once' ? input.ref : `${input.ref} ${input.choice}`;
    await this.engine.handleApproval(this.buildLegacyContext(input, capture), args);
  }

  private buildLegacyContext(
    input: { actorId: string | null; chatId?: string | null },
    capture: CaptureReplyIO,
  ): TaskDecisionContext {
    return {
      reply: (text: string) => capture.reply(text),
      from: input.actorId ? { id: input.actorId } : undefined,
      chat: input.chatId ? { id: input.chatId } : undefined,
    };
  }
}
