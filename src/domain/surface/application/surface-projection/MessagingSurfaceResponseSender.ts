/**
 * Channel-agnostic messaging surface sender (WhatsApp / Signal / Slack / etc.).
 * Projects SurfaceResponse, sends text-only transport, registers pending approvals
 * for numbered reply / slash / voice follow-up.
 */

import type {
  SurfaceRenderOptions,
  SurfaceResponse,
} from '../surface-response/SurfaceResponseContract.js';
import { resolveSurfaceProfileForChannel } from '../surface-affordance/index.js';
import {
  explainSurfaceProjection,
  recordSurfaceProjectionTelemetry,
} from './SurfaceProjectionObservability.js';
import {
  clearPendingSurfaceApproval,
  registerPendingSurfaceApproval,
  resolvePendingSurfaceApproval,
} from './PendingSurfaceApprovalIndex.js';
import {
  isPermissionDecisionEvent,
  parseSurfaceInteraction,
  toPermissionApprovalArgs,
} from './interaction/index.js';
import { projectResponseForChannel } from './projectors/SurfaceProjectorRegistry.js';
import type { SurfaceProjectorOutput } from './projectors/SurfaceProjectorContract.js';

export type MessagingSendFn = (input: {
  chatId: string;
  text: string;
  replyOptions?: Record<string, unknown> | null;
}) => Promise<{ messageId?: string | number | null } | void>;

export type ReplyWithMessagingSurfaceOptions = SurfaceRenderOptions & {
  trackApprovalId?: string | null;
  highRisk?: boolean;
  messageId?: string | number | null;
};

export type MessagingSurfaceReplyResult = {
  channel: string;
  text: string;
  output: SurfaceProjectorOutput;
  messageId: string | null;
  tracked: boolean;
};

/** Strip non-transport keys; keep numbered metadata only for registration. */
export function extractMessagingTransportPayload(output: SurfaceProjectorOutput): {
  text: string;
  transportOptions: Record<string, unknown> | null;
  numberedOptions: string[] | undefined;
  approvalId: string | null;
} {
  const opts = (output.replyOptions || {}) as Record<string, unknown>;
  const numberedOptions = Array.isArray(opts.numberedOptions)
    ? (opts.numberedOptions as string[])
    : undefined;
  const approvalId =
    opts.approvalId != null ? String(opts.approvalId).trim() : null;

  return {
    text: output.text,
    transportOptions: null,
    numberedOptions,
    approvalId,
  };
}

export async function replyWithMessagingSurfaceResponse(input: {
  channel: string;
  chatId: string;
  response: SurfaceResponse;
  send: MessagingSendFn;
  options?: ReplyWithMessagingSurfaceOptions;
}): Promise<MessagingSurfaceReplyResult> {
  const channel = String(input.channel || 'plain').toLowerCase();
  const chatId = String(input.chatId || '').trim();
  const profile = resolveSurfaceProfileForChannel(channel);
  const output = projectResponseForChannel(channel, input.response, input.options || {}, {
    profile,
  });

  const explain = explainSurfaceProjection({
    channel,
    profile,
    projectorOutput: output,
  });
  recordSurfaceProjectionTelemetry({
    channel,
    profileId: profile.id,
    usedNativeButtons: output.usedNativeButtons,
    intent: input.response.intent,
    responseId: input.response.id,
    reasons: explain.reasons.slice(0, 4),
  });

  const transport = extractMessagingTransportPayload(output);
  const sent = await input.send({
    chatId,
    text: transport.text,
    replyOptions: transport.transportOptions,
  });

  const messageId = String(
    sent && typeof sent === 'object' && sent.messageId != null
      ? sent.messageId
      : input.options?.messageId != null
        ? input.options.messageId
        : Date.now(),
  );

  const trackId = String(
    input.options?.trackApprovalId ||
      input.response.metadata?.approvalId ||
      transport.approvalId ||
      '',
  ).trim();

  let tracked = false;
  if (trackId && chatId) {
    registerPendingSurfaceApproval({
      approvalId: trackId,
      surface: channel,
      chatId,
      messageId,
      highRisk: Boolean(input.options?.highRisk || input.response.metadata?.highRisk),
      numberedOptions:
        transport.numberedOptions ||
        (input.response.actions || []).map((a) => a.id),
    });
    tracked = true;
  }

  return { channel, text: transport.text, output, messageId, tracked };
}

/**
 * Try to consume inbound text as numbered / slash approval for a pending surface.
 */
export function tryConsumeMessagingPermissionText(input: {
  channel: string;
  chatId: string;
  userId?: string | null;
  rawText: string;
}): { taskId: string; choice: 'once' | 'session' | 'always' | 'deny' } | null {
  const channel = String(input.channel || '').toLowerCase();
  const chatId = String(input.chatId || '').trim();
  const rawText = String(input.rawText || '').trim();
  if (!channel || !chatId || !rawText) return null;

  const pending = resolvePendingSurfaceApproval({ surface: channel, chatId });
  if (!pending) {
    const event = parseSurfaceInteraction({
      surface: channel,
      raw: rawText,
      kindHint: 'text',
      actorId: input.userId || null,
      sessionId: chatId,
    });
    return event ? toPermissionApprovalArgs(event) : null;
  }

  const event = parseSurfaceInteraction({
    surface: channel,
    raw: rawText,
    kindHint: 'text',
    actorId: input.userId || null,
    sessionId: chatId,
    numberedOptions: pending.numberedOptions,
    highRisk: pending.highRisk,
    metadata: {
      approvalId: pending.approvalId,
      taskId: pending.approvalId,
      highRisk: pending.highRisk,
    },
  });

  if (!event) return null;

  let permission = toPermissionApprovalArgs(event);
  if (!permission && event.choice) {
    permission = { taskId: pending.approvalId, choice: event.choice };
  }
  if (!permission && isPermissionDecisionEvent(event) && event.approvalId && event.choice) {
    permission = { taskId: event.approvalId, choice: event.choice };
  }
  if (!permission) return null;

  clearPendingSurfaceApproval({
    surface: channel,
    chatId,
    approvalId: permission.taskId,
  });
  return permission;
}
