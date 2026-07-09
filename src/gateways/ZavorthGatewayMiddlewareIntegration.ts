import { logger } from '../logger.js';
/**
 * GatewayMiddlewareIntegration — Example integration of the
 * ChannelMessageMiddleware into Telegram and WhatsApp gateways.
 *
 * This file shows how to wire the middleware into existing gateways.
 * It's a reference implementation that can be adapted to each gateway's
 * specific architecture.
 *
 * Integration points:
 * - Telegram: BotGatewayMessageProcessing.ts → tryHandleNaturalConversationThroughAgentGateway
 * - WhatsApp: WhatsAppChannelAdapter.ts → onMessageReceived → eventBus.emit
 */

import { ZavorthChannelMessageMiddleware } from '../services/ZavorthChannelMessageMiddleware.js';

// Singleton instance for use across gateways

let middlewareInstance: ZavorthChannelMessageMiddleware | null = null;

export function getGatewayMiddleware(): ZavorthChannelMessageMiddleware {
  if (!middlewareInstance) {
    middlewareInstance = new ZavorthChannelMessageMiddleware();
  }
  return middlewareInstance;
}

// Telegram integration example

/**
 * How to integrate into BotGatewayMessageProcessing.ts:
 *
 * 1. Import the middleware:
 *    import { getGatewayMiddleware } from '../../ZavorthGatewayMiddlewareIntegration.js';
 *
 * 2. In tryHandleNaturalConversationThroughAgentGateway, add before the agent call:
 *
 *    const middleware = getGatewayMiddleware();
 *    if (!middleware.isCommand(text)) {
 *      const result = await middleware.processIncoming({
 *        text,
 *        channelId: 'telegram',
 *        userId,
 *        locale: ingressMetadata?.preferredLanguageCode ?? undefined,
 *      });
 *
 *      if (result.handled && result.response) {
 *        await ctx.reply(result.response.text);
 *        return true;
 *      }
 *    }
 */

// WhatsApp integration example

/**
 * How to integrate into WhatsAppChannelAdapter.ts:
 *
 * 1. Import the middleware:
 *    import { getGatewayMiddleware } from '../../ZavorthGatewayMiddlewareIntegration.js';
 *
 * 2. In onMessageReceived, after validation and before eventBus.emit:
 *
 *    const middleware = getGatewayMiddleware();
 *    if (!middleware.isCommand(rawText)) {
 *      const result = await middleware.processIncoming({
 *        text: rawText,
 *        channelId: 'whatsapp',
 *        userId,
 *      });
 *
 *      if (result.handled && result.response) {
 *        await this.sendMessage({
 *          chatId,
 *          text: result.response.text,
 *        });
 *        return;
 *      }
 *    }
 */

// Discord integration example

/**
 * How to integrate into Discord gateway:
 *
 * 1. Import the middleware:
 *    import { getGatewayMiddleware } from '../../ZavorthGatewayMiddlewareIntegration.js';
 *
 * 2. In message handler:
 *
 *    const middleware = getGatewayMiddleware();
 *    if (!middleware.isCommand(message.content)) {
 *      const result = await middleware.processIncoming({
 *        text: message.content,
 *        channelId: 'discord',
 *        userId: message.author.id,
 *      });
 *
 *      if (result.handled && result.response) {
 *        await message.reply(result.response.text);
 *        return;
 *      }
 *    }
 */

// Error handling wrapper

/**
 * Wraps any gateway's message handler with the middleware.
 * Provides graceful error handling and logging.
 */
export async function withMiddleware<T>(
  handler: () => Promise<T>,
  context: {
    text: string;
    channelId: string;
    userId?: string;
    reply: (text: string) => Promise<void>;
  },
): Promise<T | null> {
  const middleware = getGatewayMiddleware();

  if (middleware.isCommand(context.text)) {
    return handler();
  }

  const result = await middleware.processIncoming({
    text: context.text,
    channelId: context.channelId,
    userId: context.userId,
  });

  if (result.handled && result.response) {
    await context.reply(result.response.text);
    return null;
  }

  if (result.error) {
    logger.error(`[Middleware] Error processing message: ${result.error}`);
  }

  return handler();
}
