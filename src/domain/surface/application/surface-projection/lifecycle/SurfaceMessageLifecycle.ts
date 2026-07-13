/**
 * F5a — Message lifecycle helpers (edit in-place, clear controls, decision receipt).
 * Pure ops descriptors — adapters apply them with native APIs.
 */

export const SURFACE_MESSAGE_LIFECYCLE_VERSION = 'surface-lifecycle/v1' as const;

export type SurfaceLifecycleOpKind =
  | 'edit_text'
  | 'clear_controls'
  | 'edit_and_clear_controls'
  | 'ephemeral_notice'
  | 'delete_message';

export type SurfaceLifecycleOp = {
  version: typeof SURFACE_MESSAGE_LIFECYCLE_VERSION;
  kind: SurfaceLifecycleOpKind;
  /** New message text when editing. */
  text?: string | null;
  /** Channel this op is optimized for (hint only). */
  surface?: string | null;
  /** Platform-specific payload (telegram reply_markup removal, discord components: []). */
  nativePatch?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
};

export type SurfaceLifecycleContext = {
  surface: string;
  messageId?: string | null;
  chatId?: string | null;
  approvalId?: string | null;
  choice?: string | null;
};

/** Clear inline keyboard / components after a decision. */
export function buildClearControlsOp(
  surface = 'telegram',
): SurfaceLifecycleOp {
  const normalized = String(surface || 'telegram').toLowerCase();
  let nativePatch: Record<string, unknown> | null = null;
  if (normalized === 'telegram') {
    nativePatch = { reply_markup: { inline_keyboard: [] } };
  } else if (normalized === 'discord') {
    nativePatch = { components: [] };
  } else if (normalized === 'web' || normalized === 'desktop') {
    nativePatch = { surfaceActions: [], controlsCleared: true };
  }

  return {
    version: SURFACE_MESSAGE_LIFECYCLE_VERSION,
    kind: 'clear_controls',
    surface: normalized,
    nativePatch,
    metadata: { reason: 'decision_recorded' },
  };
}

/** Progress / status edit without necessarily clearing controls. */
export function buildProgressEditOp(
  text: string,
  surface = 'telegram',
): SurfaceLifecycleOp {
  return {
    version: SURFACE_MESSAGE_LIFECYCLE_VERSION,
    kind: 'edit_text',
    text: String(text || '').trim(),
    surface: String(surface || 'telegram').toLowerCase(),
    metadata: { reason: 'progress' },
  };
}

/** After approve/deny: update text + remove controls. */
export function buildDecisionReceiptOp(input: {
  surface?: string;
  title?: string;
  choice?: string | null;
  approvalId?: string | null;
  detail?: string | null;
}): SurfaceLifecycleOp {
  const surface = String(input.surface || 'telegram').toLowerCase();
  const choice = String(input.choice || '').trim();
  const id = String(input.approvalId || '').trim();
  const shortId = id ? id.slice(0, 8) : '';
  const title = String(input.title || 'Decision recorded').trim();
  const detail = String(input.detail || '').trim();
  const lines = [
    title,
    choice ? `Choice: ${choice}` : null,
    shortId ? `Ref: ${shortId}` : null,
    detail || null,
  ].filter(Boolean);
  const text = lines.join('\n');

  const clear = buildClearControlsOp(surface);
  return {
    version: SURFACE_MESSAGE_LIFECYCLE_VERSION,
    kind: 'edit_and_clear_controls',
    text,
    surface,
    nativePatch: clear.nativePatch,
    metadata: {
      reason: 'decision_receipt',
      choice: choice || null,
      approvalId: id || null,
    },
  };
}

/** Ephemeral / toast-style notice (desktop, discord ephemeral, web toast). */
export function buildEphemeralNoticeOp(
  text: string,
  surface = 'desktop',
): SurfaceLifecycleOp {
  return {
    version: SURFACE_MESSAGE_LIFECYCLE_VERSION,
    kind: 'ephemeral_notice',
    text: String(text || '').trim(),
    surface: String(surface || 'desktop').toLowerCase(),
    nativePatch: {
      ephemeral: true,
      toast: true,
    },
    metadata: { reason: 'ephemeral' },
  };
}

/**
 * Apply lifecycle ops against a minimal context adapter.
 * Telegram: editMessageText / editMessageReplyMarkup
 * Generic: editMessage(messageId, text) + optional clear via reply options
 */
export type SurfaceLifecycleAdapter = {
  surface: string;
  editMessage?: (messageId: string, text: string, options?: Record<string, unknown>) => Promise<void>;
  editReplyMarkup?: (messageId: string, markup: unknown) => Promise<void>;
  reply?: (text: string, options?: Record<string, unknown>) => Promise<void>;
  answerCallback?: (text: string) => Promise<void>;
};

export async function applySurfaceLifecycleOp(
  adapter: SurfaceLifecycleAdapter,
  op: SurfaceLifecycleOp,
  ctx: SurfaceLifecycleContext = { surface: adapter.surface },
): Promise<{ applied: boolean; op: SurfaceLifecycleOp }> {
  const messageId = String(ctx.messageId || '').trim();

  if (op.kind === 'ephemeral_notice') {
    if (adapter.answerCallback && op.text) {
      await adapter.answerCallback(op.text.slice(0, 180));
      return { applied: true, op };
    }
    if (adapter.reply && op.text) {
      await adapter.reply(op.text, { ...(op.nativePatch || {}), ephemeral: true });
      return { applied: true, op };
    }
    return { applied: false, op };
  }

  if (op.kind === 'clear_controls') {
    if (messageId && adapter.editReplyMarkup && op.nativePatch) {
      await adapter.editReplyMarkup(messageId, op.nativePatch);
      return { applied: true, op };
    }
    if (messageId && adapter.editMessage && op.nativePatch) {
      await adapter.editMessage(messageId, '', op.nativePatch);
      return { applied: true, op };
    }
    return { applied: false, op };
  }

  if (op.kind === 'edit_text' || op.kind === 'edit_and_clear_controls') {
    if (messageId && adapter.editMessage && op.text != null) {
      const options =
        op.kind === 'edit_and_clear_controls' ? { ...(op.nativePatch || {}) } : undefined;
      await adapter.editMessage(messageId, op.text, options);
      return { applied: true, op };
    }
    if (adapter.reply && op.text) {
      await adapter.reply(op.text, op.nativePatch || undefined);
      return { applied: true, op };
    }
    return { applied: false, op };
  }

  return { applied: false, op };
}

/** Convenience: decision receipt + clear controls for telegram-like flows. */
export function buildPostDecisionLifecycle(input: {
  surface: string;
  choice?: string | null;
  approvalId?: string | null;
  allowed?: boolean;
}): SurfaceLifecycleOp[] {
  const choice = input.choice || (input.allowed === false ? 'deny' : 'once');
  const title =
    choice === 'deny' || input.allowed === false
      ? 'Denied.'
      : `Allowed (${choice}).`;
  return [
    buildDecisionReceiptOp({
      surface: input.surface,
      title,
      choice,
      approvalId: input.approvalId,
      detail: 'Controls cleared.',
    }),
  ];
}
