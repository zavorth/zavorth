import type { Context } from 'grammy';
import type { SurfaceDecisionReceipt } from '../SurfaceDecisionContract.js';
import {
  createCaptureReplyIO,
  type CaptureReplyIO,
  type SurfaceDecisionPendingFilter,
  type SurfaceDecisionPort,
  type SurfaceDecisionPortDecideInput,
  type SurfaceDecisionPortDecideRawInput,
} from '../SurfaceDecisionPort.js';

function assertEngineContext(context: unknown): asserts context is Context {
  if (!context || typeof (context as Record<string, unknown>).reply !== 'function') {
    throw new Error('Invalid engine context: missing reply()');
  }
}

export type ToolRuntimeDecisionEngine = {
  handleEchoCommand: (ctx: Context, args: string) => Promise<void>;
};

export type ToolRuntimeDecisionPortOptions = {
  /**
   * Accurate pending lookup when the caller can supply one. The Echo pending
   * store lives in the external tool-runtime's permission service and is only
   * reachable asynchronously (client.readPendingPermissions), so without an
   * injected check the port stays optimistic and the engine's own resolution
   * paths produce the failure output.
   */
  isPending?: (ref: string) => boolean;
  /**
   * Enumeration of live pending Echo approval references for cross-surface
   * pending listings; without it the port cannot contribute to
   * spine.listPending because no synchronous enumeration exists on the engine.
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
 * Adapts the Telegram Echo (external tool-runtime) approval engine to the
 * universal decision port. The engine merges approve/reject/list into one
 * command entry (handleEchoCommand) and speaks grammy Context through
 * replyWithTelegramSurfaceResponse; headless resolutions hand it a capturing
 * io so the receipt text comes back instead of being sent, while a bound
 * transport context is passed verbatim so native replies and keyboards keep
 * happening. The engine only distinguishes approve vs reject (boolean), so
 * 'deny' maps to reject and once/session/always map to a plain approve with
 * no scope suffix — appending one would corrupt the reference parsing.
 */
export class ToolRuntimeDecisionPort implements SurfaceDecisionPort {
  private readonly engine: ToolRuntimeDecisionEngine;
  private readonly isPendingOverride: ((ref: string) => boolean) | null;
  private readonly pendingRefsProvider: ((filter: SurfaceDecisionPendingFilter) => string[]) | null;

  constructor(engine: ToolRuntimeDecisionEngine, options: ToolRuntimeDecisionPortOptions = {}) {
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
    const action = input.choice === 'deny' ? 'reject' : 'approve';
    const args = `${action} ${input.ref}`.trim();
    if (input.transportContext != null) {
      await this.engine.handleEchoCommand(this.asEngineContext(input.transportContext), args);
      return UNTEXTED_RECEIPT;
    }

    const capture = createCaptureReplyIO();
    await this.engine.handleEchoCommand(this.buildLegacyContext(input, capture), args);
    return {
      resolved: true,
      receiptText: capture.capturedText,
      decidedBy: 'operator',
      dismissals: [],
    };
  }

  public async decideRaw(input: SurfaceDecisionPortDecideRawInput): Promise<SurfaceDecisionReceipt> {
    if (input.transportContext != null) {
      await this.engine.handleEchoCommand(this.asEngineContext(input.transportContext), input.rawArgs);
      return UNTEXTED_RECEIPT;
    }

    const capture = createCaptureReplyIO();
    await this.engine.handleEchoCommand(
      this.buildLegacyContext({ actorId: input.actorId, chatId: input.chatId }, capture),
      input.rawArgs,
    );
    return {
      resolved: true,
      receiptText: capture.capturedText,
      decidedBy: 'operator',
      dismissals: [],
    };
  }

  private asEngineContext(context: unknown): Context {
    assertEngineContext(context);
    return context;
  }

  private buildLegacyContext(
    input: { actorId: string | null; chatId?: string | null },
    capture: CaptureReplyIO,
  ): Context {
    return this.asEngineContext({
      reply: (text: string) => capture.reply(text),
      from: input.actorId ? { id: input.actorId } : undefined,
      chat: input.chatId != null && input.chatId !== '' ? { id: input.chatId } : undefined,
    });
  }
}
