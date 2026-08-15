import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type {
  SurfaceRenderedResponse,
  SurfaceRenderOptions,
  SurfaceRenderTarget,
  SurfaceResponse,
} from '../../application/surface-response/index.js';
import { resolveSurfaceProfileForChannel } from '../../application/surface-affordance/index.js';
import {
  getSurfaceProjector,
  projectResponseForChannel,
  registerPendingSurfaceApproval,
  type SurfaceProjectorOutput,
} from '../../application/surface-projection/index.js';

export function resolveSharedSurfaceRenderTarget(platform: unknown): SurfaceRenderTarget {
  const normalized = String(platform || '').trim().toLowerCase();
  switch (normalized) {
    case 'telegram':
      return 'telegram';
    case 'discord':
      return 'discord';
    case 'slack':
      return 'slack';
    case 'whatsapp':
      return 'whatsapp';
    case 'instagram':
      return 'instagram';
    case 'teams':
      return 'teams';
    case 'email':
      return 'email';
    case 'signal':
      return 'signal';
    case 'imessage':
    case 'ios-imessage':
      return 'imessage';
    case 'cli':
    case 'terminal':
      return 'cli';
    case 'web':
    case 'zavorthControl':
      return 'web';
    case 'desktop':
      return 'web';
    default:
      return 'plain';
  }
}

export function resolveSharedSurfaceChannel(platform: unknown): string {
  const normalized = String(platform || '').trim().toLowerCase();
  switch (normalized) {
    case 'ios-imessage':
      return 'imessage';
    case 'terminal':
      return 'cli';
    case 'zavorthControl':
      return 'web';
    default:
      return normalized || 'plain';
  }
}

/**
 * Project a SurfaceResponse through the F3 projector registry for this platform.
 */
export function projectSharedSurfaceResponse(
  platform: unknown,
  response: SurfaceResponse,
  options: SurfaceRenderOptions = {},
): SurfaceProjectorOutput {
  const channel = resolveSharedSurfaceChannel(platform);
  const profile = resolveSurfaceProfileForChannel(channel);
  return projectResponseForChannel(channel, response, options, { profile });
}

export async function replyWithSharedSurfaceResponse(
  ctx: IMessageContext,
  response: SurfaceResponse,
  options: SurfaceRenderOptions & {
    trackApprovalId?: string | null;
    highRisk?: boolean;
  } = {},
): Promise<SurfaceRenderedResponse> {
  const channel = resolveSharedSurfaceChannel(ctx.platform);
  const output = projectSharedSurfaceResponse(ctx.platform, response, options);

  // Messaging APIs often ignore non-native replyOptions; always send text.
  // Telegram/Discord gateways that understand reply_markup/components still get them.
  const transportOptions = filterTransportReplyOptions(channel, output.replyOptions);

  if (transportOptions && Object.keys(transportOptions).length > 0) {
    await ctx.reply(output.text, transportOptions);
  } else {
    await ctx.reply(output.text);
  }

  // Track pending approvals so numbered replies / reactions can resolve task id.
  const trackId = String(
    options.trackApprovalId || response.metadata?.approvalId || '',
  ).trim();
  const chatId = String(ctx.chatId || '').trim();
  if (trackId && chatId && (response.intent === 'approval' || trackId)) {
    const replyMeta = (output.replyOptions || {}) as Record<string, unknown>;
    registerPendingSurfaceApproval({
      approvalId: trackId,
      surface: channel,
      chatId,
      messageId: String(ctx.messageId || Date.now()),
      highRisk: Boolean(options.highRisk || response.metadata?.highRisk),
      numberedOptions: Array.isArray(replyMeta.numberedOptions)
        ? (replyMeta.numberedOptions as string[])
        : (response.actions || []).map((a) => a.id),
    });
  }

  return output.rendered;
}

function filterTransportReplyOptions(
  channel: string,
  replyOptions: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!replyOptions) return null;
  if (channel === 'telegram') {
    return replyOptions.reply_markup
      ? { reply_markup: replyOptions.reply_markup }
      : null;
  }
  if (channel === 'discord') {
    const out: Record<string, unknown> = {};
    if (replyOptions.allowedMentions) out.allowedMentions = replyOptions.allowedMentions;
    if (Array.isArray(replyOptions.components)) out.components = replyOptions.components;
    return Object.keys(out).length ? out : null;
  }
  // whatsapp/signal/slack/etc. — text only on the wire
  return null;
}

/**
 * @deprecated Prefer projectSharedSurfaceResponse / getSurfaceProjector.
 * Kept for callers that only need reply option shaping from a pre-rendered native blob.
 */
export function buildSharedSurfaceReplyOptions(
  target: SurfaceRenderTarget,
  native: unknown,
): Record<string, unknown> | null {
  // Delegate to projector path for telegram/discord consistency.
  const channel =
    target === 'plain' || target === 'cli' || target === 'web'
      ? target
      : String(target);
  // Reconstruct minimal output from an already-rendered native by reusing projector internals
  // only when we have a full response — for legacy callers, keep previous shape:
  if (target === 'telegram') {
    const telegram = native as { replyMarkup?: unknown } | null;
    return telegram?.replyMarkup ? { reply_markup: telegram.replyMarkup } : null;
  }
  if (target === 'discord') {
    const discord = native as {
      allowedMentions?: unknown;
      components?: unknown[];
    } | null;
    if (!discord) return null;
    return {
      allowedMentions: discord.allowedMentions,
      ...(Array.isArray(discord.components) && discord.components.length > 0
        ? { components: discord.components }
        : {}),
    };
  }
  return null;
}
