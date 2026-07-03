import type { IMessageContext } from '../../../../contracts/IMessageBroker.js';
import type {
  DiscordSurfaceNativePayload,
  SurfaceRenderedResponse,
  SurfaceRenderOptions,
  SurfaceRenderTarget,
  SurfaceResponse,
  TelegramSurfaceNativePayload,
} from '../../application/surface-response/index.js';
import { renderSurfaceResponseForTarget } from '../../application/surface-response/index.js';

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
    default:
      return 'plain';
  }
}

export async function replyWithSharedSurfaceResponse(
  ctx: IMessageContext,
  response: SurfaceResponse,
  options: SurfaceRenderOptions = {},
): Promise<SurfaceRenderedResponse> {
  const target = resolveSharedSurfaceRenderTarget(ctx.platform);
  const rendered = renderSurfaceResponseForTarget(target, response, options);
  const replyOptions = buildSharedSurfaceReplyOptions(target, rendered.native);

  if (replyOptions && Object.keys(replyOptions).length > 0) {
    await ctx.reply(rendered.text, replyOptions);
  } else {
    await ctx.reply(rendered.text);
  }

  return rendered;
}

export function buildSharedSurfaceReplyOptions(
  target: SurfaceRenderTarget,
  native: unknown,
): Record<string, unknown> | null {
  if (target === 'telegram') {
    const telegram = native as TelegramSurfaceNativePayload | null;
    return telegram?.replyMarkup ? { reply_markup: telegram.replyMarkup } : null;
  }

  if (target === 'discord') {
    const discord = native as DiscordSurfaceNativePayload | null;
    if (!discord) {
      return null;
    }
    return {
      allowedMentions: discord.allowedMentions,
      ...(discord.components.length > 0 ? { components: discord.components } : {}),
    };
  }

  return null;
}
