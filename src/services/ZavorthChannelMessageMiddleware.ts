/**
 * ChannelMessageMiddleware — Plugs into any gateway's message pipeline
 * to add commandless mode and adaptive formatting.
 *
 * This middleware intercepts incoming messages, detects intent,
 * and formats responses for the target channel. It works with
 * the existing NaturalInvocationRouter and PresentationAdapter.
 *
 * Usage:
 *   const middleware = new ZavorthChannelMessageMiddleware();
 *
 *   // In your gateway's message handler:
 *   const result = await middleware.processIncoming({
 *     text: message,
 *     channelId: 'telegram',
 *     userId: '123',
 *   });
 *
 *   if (result.handled) {
 *     await ctx.reply(result.response.text);
 *   }
 */

import { ZavorthCommandlessModeService, type CommandlessInput } from './ZavorthCommandlessModeService.js';
import { ZavorthPresentationAdapterService, type UniversalResponse } from './ZavorthPresentationAdapterService.js';
import { ZavorthChannelCapabilitiesService } from './ZavorthChannelCapabilitiesService.js';
import { detectDeviceLocale } from './ZavorthIntentI18n.js';
import { getChannelPairingService } from './ZavorthChannelPairingService.js';

export interface MiddlewareInput {
  text: string;
  channelId: string;
  userId?: string;
  sessionId?: string;
  locale?: string;
  isFirstInteraction?: boolean;
}

export interface MiddlewareResult {
  handled: boolean;
  response: {
    text: string;
    buttons?: Array<{ label: string; value: string }>;
  } | null;
  action: string;
  confidence: number;
  requiresApproval: boolean;
  locale: string;
  error?: string;
}

export class ZavorthChannelMessageMiddleware {
  private readonly commandless: ZavorthCommandlessModeService;
  private readonly presentation: ZavorthPresentationAdapterService;
  private readonly caps: ZavorthChannelCapabilitiesService;

  constructor(deps?: {
    commandless?: ZavorthCommandlessModeService;
    presentation?: ZavorthPresentationAdapterService;
    caps?: ZavorthChannelCapabilitiesService;
  }) {
    this.caps = deps?.caps ?? new ZavorthChannelCapabilitiesService();
    this.presentation = deps?.presentation ?? new ZavorthPresentationAdapterService(this.caps);
    this.commandless = deps?.commandless ?? new ZavorthCommandlessModeService({
      presentation: this.presentation,
      caps: this.caps,
    });
  }

  /**
   * Process an incoming message through the middleware pipeline.
   * Returns a result indicating whether the message was handled
   * and the formatted response if so.
   */
  public async processIncoming(input: MiddlewareInput): Promise<MiddlewareResult> {
    const locale = input.locale ?? detectDeviceLocale();

    const isLocalChannel = input.channelId === 'cli' || input.channelId === 'web';
    if (!isLocalChannel && input.userId) {
      const pairingService = getChannelPairingService();
      if (!pairingService.isUserPaired(input.channelId, input.userId)) {
        const potentialCode = input.text.trim().toUpperCase();
        const success = pairingService.pairUser(input.channelId, input.userId, potentialCode);
        if (success) {
          return {
            handled: true,
            response: {
              text: '✅ Channel paired successfully! Welcome to Zavorth.',
            },
            action: 'pairing_success',
            confidence: 1.0,
            requiresApproval: false,
            locale,
          };
        } else {
          return {
            handled: true,
            response: {
              text: '🔒 Access Denied. To link this channel with Zavorth, please enter the single-use pairing code shown in your server console.',
            },
            action: 'pairing_required',
            confidence: 1.0,
            requiresApproval: false,
            locale,
          };
        }
      }
    }

    try {
      const commandlessInput: CommandlessInput = {
        message: input.text,
        channelId: input.channelId,
        userId: input.userId,
        isFirstInteraction: input.isFirstInteraction,
        locale,
      };

      const result = await this.commandless.process(commandlessInput);

      return {
        handled: true,
        response: {
          text: result.formatted.text,
          buttons: result.formatted.buttons,
        },
        action: result.action,
        confidence: result.confidence,
        requiresApproval: result.requiresApproval,
        locale: result.detectedLanguage,
      };
    } catch (error: unknown) {
      // Graceful degradation: if middleware fails, let the gateway handle it
      return {
        handled: false,
        response: null,
        action: 'error',
        confidence: 0,
        requiresApproval: false,
        locale,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Format an existing response for a specific channel.
   * Useful when the agent has already generated a response
   * and you need to adapt it for the target channel.
   */
  public formatForChannel(
    response: UniversalResponse,
    channelId: string,
  ): { text: string; buttons?: Array<{ label: string; value: string }> } {
    const formatted = this.presentation.format(response, channelId);
    return {
      text: formatted.text,
      buttons: formatted.buttons,
    };
  }

  /**
   * Check if a message looks like a command (starts with /).
   * Commands should bypass the middleware.
   */
  public isCommand(text: string): boolean {
    return text.trim().startsWith('/');
  }

  /**
   * Get a localized greeting for a channel.
   */
  public getGreeting(channelId: string, locale?: string): string {
    const lang = locale ?? detectDeviceLocale();
    const greetings: Record<string, string> = {
      en: "Hi! I'm Zavorth. Ask me anything — no commands needed.",
      pt: 'Oi! Sou o Zavorth. Pode me pedir qualquer coisa — sem comandos.',
      es: '¡Hola! Soy Zavorth. Pide lo que necesites — sin comandos.',
      fr: 'Bonjour ! Je suis Zavorth. Demandez-moi n\'importe quoi — sans commandes.',
      de: 'Hallo! Ich bin Zavorth. Frag mich was du willst — ohne Befehle.',
      ja: 'こんにちは！Zavorthです。何でも聞いてください — コマンド不要です。',
      zh: '你好！我是Zavorth。随时问我 — 不需要命令。',
      ko: '안녕하세요! Zavorth입니다. 뭐든 물어보세요 — 명령어 불필요.',
    };
    return greetings[lang] ?? greetings.en;
  }
}
