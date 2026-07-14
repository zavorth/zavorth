/**
 * Thin gateway hook: pairing only.
 * Free text is not claimed here; gateways continue to the agent when handled=false.
 */

import { ZavorthChannelMessageMiddleware, type MiddlewareResult } from './ZavorthChannelMessageMiddleware.js';

let middlewareInstance: ZavorthChannelMessageMiddleware | null = null;

function getMiddleware(): ZavorthChannelMessageMiddleware {
  if (!middlewareInstance) {
    middlewareInstance = new ZavorthChannelMessageMiddleware();
  }
  return middlewareInstance;
}

export interface HookInput {
  text: string;
  channelId: string;
  userId?: string;
  sessionId?: string;
  locale?: string;
  reply?: (text: string) => Promise<void>;
}

export interface HookResult {
  handled: boolean;
  response?: string;
  buttons?: Array<{ label: string; value: string }>;
  error?: string;
}

/**
 * Pairing-only. Returns handled=true only for pairing success/deny.
 * Free text returns handled=false so the agent owns the turn.
 */
export async function hookMiddleware(input: HookInput): Promise<HookResult> {
  const middleware = getMiddleware();

  if (middleware.isCommand(input.text)) {
    return { handled: false };
  }

  try {
    const result: MiddlewareResult = await middleware.processIncoming({
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
  } catch (error: unknown) {
    return {
      handled: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function isCommand(text: string): boolean {
  return getMiddleware().isCommand(text);
}

export function getGreeting(channelId: string, locale?: string): string {
  return getMiddleware().getGreeting(channelId, locale);
}
