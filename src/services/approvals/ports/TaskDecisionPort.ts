import type { Context } from 'grammy';
import type { TelegramTaskApprovalService } from '../../../gateways/channels/telegram/controllers/TelegramTaskApprovalService.js';
import type { SurfaceDecisionReceipt } from '../SurfaceDecisionContract.js';
import {
  createCaptureReplyIO,
  type CaptureReplyIO,
  type SurfaceDecisionPort,
  type SurfaceDecisionPortDecideInput,
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

/**
 * Adapts the Telegram task-approval decision engine to the universal port.
 * The engine speaks grammy Context and pushes its receipt through ctx.reply;
 * this port hands it a capturing io so the text comes back as receiptText
 * instead of being sent, keeping the spine transport-agnostic.
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
    const capture = createCaptureReplyIO();
    if (input.choice === 'deny') {
      await this.engine.handleRejection(this.buildLegacyContext(input, capture), input.ref);
    } else {
      const args = input.choice === 'once' ? input.ref : `${input.ref} ${input.choice}`;
      await this.engine.handleApproval(this.buildLegacyContext(input, capture), args);
    }
    return {
      resolved: true,
      receiptText: capture.capturedText,
      decidedBy: 'operator',
      dismissals: [],
    };
  }

  // Single documented seam: the legacy engine is typed against grammy Context,
  // while the universal contract only guarantees actor/chat hints; the capture
  // harness satisfies the engine structurally at runtime.
  private buildLegacyContext(input: SurfaceDecisionPortDecideInput, capture: CaptureReplyIO): Context {
    const synthetic = {
      reply: (text: string) => capture.reply(text),
      from: input.actorId ? { id: input.actorId } : undefined,
      chat: input.chatId ? { id: input.chatId } : undefined,
    };
    return synthetic as unknown as Context;
  }
}
