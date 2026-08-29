/**
 * Channel message middleware: pairing gate for remote channels.
 * Free text is not handled here; the agent gateway owns natural language.
 */

import { ZavorthPresentationAdapterService, type UniversalResponse } from './ZavorthPresentationAdapterService.js';
import { ZavorthChannelCapabilitiesService } from './ZavorthChannelCapabilitiesService.js';
import { getChannelPairingService } from './ZavorthChannelPairingService.js';
import { ZavorthUserLocalePreferenceService } from './localization/ZavorthUserLocalePreferenceService.js';

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
  private readonly presentation: ZavorthPresentationAdapterService;
  private readonly caps: ZavorthChannelCapabilitiesService;
  private readonly localePreferenceService: ZavorthUserLocalePreferenceService;

  constructor(deps?: {
    presentation?: ZavorthPresentationAdapterService;
    caps?: ZavorthChannelCapabilitiesService;
    localePreferenceService?: ZavorthUserLocalePreferenceService;
  }) {
    this.caps = deps?.caps ?? new ZavorthChannelCapabilitiesService();
    this.presentation = deps?.presentation ?? new ZavorthPresentationAdapterService(this.caps);
    this.localePreferenceService = deps?.localePreferenceService ?? new ZavorthUserLocalePreferenceService();
  }

  /**
   * Pairing-only. Free text always returns handled=false so the agent owns the turn.
   */
  public async processIncoming(input: MiddlewareInput): Promise<MiddlewareResult> {
    const locale = await this.resolveLocale(input);

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
        }
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

    return {
      handled: false,
      response: null,
      action: 'agent_first',
      confidence: 0,
      requiresApproval: false,
      locale,
    };
  }

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

  public isCommand(text: string): boolean {
    return text.trim().startsWith('/');
  }

  /** Simple greeting helper (not a routing brain). */
  public getGreeting(_channelId: string, locale?: string): string {
    const lang = String(locale || 'en').toLowerCase().split('-')[0].split('_')[0].trim();
    const greetings: Record<string, string> = {
      en: "Hi! I'm Zavorth. Ask me anything — I use tools when needed.",
      pt: 'Oi! Sou o Zavorth. Pode me pedir qualquer coisa — uso ferramentas quando necessário.',
      es: '¡Hola! Soy Zavorth. Pide lo que necesites — uso herramientas cuando hace falta.',
    };
    return greetings[lang] ?? greetings.en;
  }

  private async resolveLocale(input: MiddlewareInput): Promise<string> {
    if (input.userId) {
      return this.localePreferenceService.resolveUserLocale(input.userId, input.locale);
    }
    const signal = String(input.locale || '').trim();
    return signal || 'en';
  }
}
