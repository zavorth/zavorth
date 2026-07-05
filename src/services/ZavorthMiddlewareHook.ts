/**
 * MiddlewareHook — Optional hook for gateways to enable
 * commandless mode and adaptive formatting.
 *
 * This hook is designed to be minimally invasive:
 * - It only activates when explicitly enabled
 * - It wraps around the existing flow, not replaces it
 * - If it fails, the original flow continues unchanged
 *
 * Integration:
 *   import { hookMiddleware } from '../services/ZavorthMiddlewareHook.js';
 *
 *   // In your gateway's message handler:
 *   const hookResult = await hookMiddleware({
 *     text: message,
 *     channelId: 'telegram',
 *     userId: '123',
 *     reply: (text) => ctx.reply(text),
 *   });
 *
 *   if (hookResult.handled) return; // Middleware handled it
 *   // Otherwise, continue with existing flow
 */

import { ZavorthChannelMessageMiddleware, type MiddlewareResult } from './ZavorthChannelMessageMiddleware.js';

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let middlewareInstance: ZavorthChannelMessageMiddleware | null = null;

function getMiddleware(): ZavorthChannelMessageMiddleware {
  if (!middlewareInstance) {
    middlewareInstance = new ZavorthChannelMessageMiddleware();
  }
  return middlewareInstance;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HookInput {
  text: string;
  channelId: string;
  userId?: string;
  sessionId?: string;
  locale?: string;
  /** Optional reply callback — if provided, middleware will send response directly */
  reply?: (text: string) => Promise<void>;
}

export interface HookResult {
  handled: boolean;
  response?: string;
  buttons?: Array<{ label: string; value: string }>;
  error?: string;
}

// ---------------------------------------------------------------------------
// Hook function
// ---------------------------------------------------------------------------

/**
 * Try to handle a message through the middleware.
 * Returns handled=true if the middleware processed it successfully.
 * Returns handled=false if the gateway should continue with its normal flow.
 */
export async function hookMiddleware(input: HookInput): Promise<HookResult> {
  const middleware = getMiddleware();

  // Skip commands
  if (middleware.isCommand(input.text)) {
    return { handled: false };
  }

  try {
    const result = await middleware.processIncoming({
      text: input.text,
      channelId: input.channelId,
      userId: input.userId,
      sessionId: input.sessionId,
      locale: input.locale,
    });

    if (result.handled && result.response) {
      const responseText = typeof result.response === 'string' 
        ? result.response 
        : result.response.text;
      
      // Send reply directly if callback provided
      if (input.reply && responseText) {
        await input.reply(responseText);
      }
      return {
        handled: true,
        response: responseText,
        buttons: typeof result.response === 'object' ? result.response.buttons : undefined,
      };
    }

    return { handled: false };
  } catch (error) {
    // Graceful degradation: don't break the gateway
    return {
      handled: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check if a message is a command (starts with /).
 */
export function isCommand(text: string): boolean {
  return getMiddleware().isCommand(text);
}

/**
 * Get a localized greeting for a channel.
 */
export function getGreeting(channelId: string, locale?: string): string {
  return getMiddleware().getGreeting(channelId, locale);
}
