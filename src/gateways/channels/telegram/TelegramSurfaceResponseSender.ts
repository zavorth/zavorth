import type { Context } from 'grammy';
import type {
  SurfaceRenderOptions,
  SurfaceResponse,
} from '../../../domain/surface/application/surface-response/index.js';
import { resolveSurfaceProfileForChannel } from '../../../domain/surface/application/surface-affordance/index.js';
import {
  explainSurfaceProjection,
  projectResponseForChannel,
  recordSurfaceProjectionTelemetry,
  registerPendingSurfaceApproval,
} from '../../../domain/surface/application/surface-projection/index.js';

export type TelegramSurfaceReplyResult = {
  messageId: number | null;
  chatId: string | null;
  text: string;
  usedNativeButtons: boolean;
};

export async function replyWithTelegramSurfaceResponse(
  ctx: Context,
  response: SurfaceResponse,
  options: SurfaceRenderOptions & {
    /** When set, register message for reaction/voice resolution. */
    trackApprovalId?: string | null;
    highRisk?: boolean;
  } = {},
): Promise<TelegramSurfaceReplyResult> {
  const profile = resolveSurfaceProfileForChannel('telegram');
  const output = projectResponseForChannel('telegram', response, options, { profile });

  const explain = explainSurfaceProjection({
    channel: 'telegram',
    profile,
    projectorOutput: output,
  });
  recordSurfaceProjectionTelemetry({
    channel: 'telegram',
    profileId: profile.id,
    usedNativeButtons: output.usedNativeButtons,
    intent: response.intent,
    responseId: response.id,
    reasons: explain.reasons,
  });

  let sent: { message_id?: number } | null = null;
  if (output.replyOptions && Object.keys(output.replyOptions).length > 0) {
    // Only pass Telegram-native keys to grammy; keep metadata client-side via track index.
    const { reply_markup } = output.replyOptions as { reply_markup?: unknown };
    const replyOpts = reply_markup ? { reply_markup } : undefined;
    sent = replyOpts
      ? ((await ctx.reply(output.text, replyOpts as never)) as { message_id?: number })
      : ((await ctx.reply(output.text)) as { message_id?: number });
  } else {
    sent = (await ctx.reply(output.text)) as { message_id?: number };
  }

  const chatId = ctx.chat?.id != null ? String(ctx.chat.id) : null;
  const messageId = sent?.message_id != null ? Number(sent.message_id) : null;
  const trackId = String(options.trackApprovalId || response.metadata?.approvalId || '').trim();

  if (trackId && chatId && messageId != null) {
    registerPendingSurfaceApproval({
      approvalId: trackId,
      surface: 'telegram',
      chatId,
      messageId,
      highRisk: Boolean(options.highRisk || response.metadata?.highRisk),
      numberedOptions: (response.actions || []).map((a) => a.id),
    });
  }

  return {
    messageId,
    chatId,
    text: output.text,
    usedNativeButtons: output.usedNativeButtons,
  };
}
