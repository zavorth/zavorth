import type { Context } from 'grammy';
import type { TelegramTaskApprovalService } from '../../../gateways/channels/telegram/controllers/TelegramTaskApprovalService.js';
import type { SurfaceDecisionReceipt } from '../SurfaceDecisionContract.js';
import {
  createCaptureReplyIO,
  type CaptureReplyIO,
  type SurfaceDecisionPort,
  type SurfaceDecisionPortDecideInput,
  type SurfaceDecisionPortDecideRawInput,
} from '../SurfaceDecisionPort.js';

export type TaskDecisionEngine = Pick<
  TelegramTaskApprovalService,
  'handleApproval' | 'handleRejection'
>;

export type TaskDecisionPortOptions = {
  /**
   * Accurate pending lookup over the engine's task store when the caller can
   * supply one; without it the port stays optimistic and the engine's own
   * error path produces the guidance receipt.
   */
  isPending?: (ref: string) => boolean;
};

const UNTEXTED_RECEIPT: SurfaceDecisionReceipt = {
  resolved: true,
  receiptText: null,
  decidedBy: 'operator',
  dismissals: [],
};

/**
 * Adapts the Telegram task-approval decision engine to the universal port.
 * The engine speaks grammy Context and pushes its receipt through ctx.reply;
 * headless resolutions hand it a capturing io so the text comes back as
 * receiptText instead of being sent. When a live transport context is bound
 * the engine receives it verbatim — downstream hooks (task/workflow resume)
 * keep the original context identity and the receipt stays textless.
 */
export class TaskDecisionPort implements SurfaceDecisionPort {
  private readonly engine: TaskDecisionEngine;
  private readonly isPendingOverride: ((ref: string) => boolean) | null;

  constructor(engine: TaskDecisionEngine, options: TaskDecisionPortOptions = {}) {
    this.engine = engine;
    this.isPendingOverride = options.isPending ?? null;
  }

  public findPending(ref: string): boolean {
    if (this.isPendingOverride) {
      return this.isPendingOverride(ref);
    }
    return true;
  }

  public async decide(input: SurfaceDecisionPortDecideInput): Promise<SurfaceDecisionReceipt> {
    if (input.transportContext != null) {
      const nativeContext = input.transportContext as Context;
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
      await this.engine.handleApproval(input.transportContext as Context, input.rawArgs);
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

  // Single documented seam: the legacy engine is typed against grammy Context,
  // while the universal contract only guarantees actor/chat hints; the capture
  // harness satisfies the engine structurally at runtime.
  private buildLegacyContext(
    input: { actorId: string | null; chatId?: string | null },
    capture: CaptureReplyIO,
  ): Context {
    const synthetic = {
      reply: (text: string) => capture.reply(text),
      from: input.actorId ? { id: input.actorId } : undefined,
      chat: input.chatId ? { id: input.chatId } : undefined,
    };
    return synthetic as unknown as Context;
  }
}
