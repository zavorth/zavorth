import type { Context } from 'grammy';
import {
  renderTelegramSurfaceResponse,
  type SurfaceRenderOptions,
  type SurfaceResponse,
} from '../../../domain/surface/application/surface-response/index.js';

export async function replyWithTelegramSurfaceResponse(
  ctx: Context,
  response: SurfaceResponse,
  options: SurfaceRenderOptions = {},
): Promise<void> {
  const rendered = renderTelegramSurfaceResponse(response, options);
  const replyOptions = rendered.native.replyMarkup
    ? { reply_markup: rendered.native.replyMarkup }
    : undefined;

  if (replyOptions) {
    await ctx.reply(rendered.text, replyOptions as any);
    return;
  }

  await ctx.reply(rendered.text);
}
