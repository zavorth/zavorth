import type {
  SurfaceDecisionChoice,
  SurfaceDecisionReceipt,
} from './SurfaceDecisionContract.js';

/**
 * Transport-facing output channel for a decision interaction. Legacy engines
 * that push text through `ctx.reply` are adapted with a capturing io so the
 * guidance text is RETURNED as the receipt instead of being sent directly.
 */
export interface DecisionIO {
  reply(text: string): Promise<unknown>;
}

export interface CaptureReplyIO extends DecisionIO {
  readonly capturedText: string | null;
}

export function createCaptureReplyIO(): CaptureReplyIO {
  let captured: string | null = null;
  return {
    async reply(text: string): Promise<unknown> {
      captured = String(text ?? '');
      return null;
    },
    get capturedText(): string | null {
      return captured;
    },
  };
}

export type SurfaceDecisionPortDecideInput = {
  ref: string;
  choice: SurfaceDecisionChoice;
  actorId: string | null;
  surface: string;
  io: DecisionIO;
  chatId?: string | null;
  sessionId?: string | null;
  /**
   * Transport-native interaction context (grammy Context, discord message…).
   * When supplied, the engine receives it verbatim so downstream hooks keep
   * the original object identity; the receipt then carries no text because
   * the engine already spoke through that live context.
   */
  transportContext?: unknown;
};

export type SurfaceDecisionPortDecideRawInput = {
  rawArgs: string;
  actorId: string | null;
  chatId?: string | null;
  transportContext?: unknown;
};

/**
 * The one port every decision engine implements so any surface can resolve
 * any decision type through the spine. `findPending` must answer whether the
 * reference still has a live pending decision; engines without an accurate
 * lookup stay optimistic (true) and let their own error paths speak.
 */
export interface SurfaceDecisionPort {
  findPending(ref: string): boolean;
  decide(input: SurfaceDecisionPortDecideInput): Promise<SurfaceDecisionReceipt>;
  /**
   * Unparsed-decision entry: the port hands the raw operator input straight
   * to the engine, which keeps sole ownership of reference and scope-word
   * parsing (ordinals, bare refs, deny words, multi-pending guidance).
   */
  decideRaw?(input: SurfaceDecisionPortDecideRawInput): Promise<SurfaceDecisionReceipt>;
}
