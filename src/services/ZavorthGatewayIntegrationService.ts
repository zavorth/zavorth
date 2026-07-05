/**
 * GatewayIntegrationService — Bridges the commandless mode and
 * presentation adapter into the existing gateway infrastructure.
 *
 * This service wraps the natural conversation flow to add:
 * 1. Intent detection from raw text (CommandlessMode)
 * 2. Response formatting for the user's channel (PresentationAdapter)
 * 3. Locale-aware greetings and titles
 *
 * Usage in gateways:
 *   const integration = new ZavorthGatewayIntegrationService();
 *   const result = await integration.processMessage({
 *     text: userMessage,
 *     channelId: 'telegram',
 *     userId: '12345',
 *   });
 *   await ctx.reply(result.formatted.text);
 */

import { ZavorthCommandlessModeService, type CommandlessInput, type CommandlessResponse } from './ZavorthCommandlessModeService.js';
import {
  ZavorthPresentationAdapterService,
  type UniversalResponse,
} from './ZavorthPresentationAdapterService.js';
import { ZavorthChannelCapabilitiesService } from './ZavorthChannelCapabilitiesService.js';
import { detectDeviceLocale, getLanguagePack, mergeLanguagePacks } from './ZavorthIntentI18n.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GatewayMessageInput {
  /** Raw text from the user. */
  text: string;

  /** Channel identifier (telegram, whatsapp, discord, etc.). */
  channelId: string;

  /** User ID for tracking. */
  userId?: string;

  /** Chat/session ID. */
  sessionId?: string;

  /** Override locale. If not set, auto-detects. */
  locale?: string;

  /** Whether this is the user's first message. */
  isFirstInteraction?: boolean;
}

export interface GatewayMessageResult {
  /** The formatted response text. */
  text: string;

  /** Optional inline buttons. */
  buttons?: Array<{ label: string; value: string }>;

  /** Detected intent action. */
  action: string;

  /** Confidence of intent detection. */
  confidence: number;

  /** Whether the response requires user approval. */
  requiresApproval: boolean;

  /** Language used for this interaction. */
  locale: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ZavorthGatewayIntegrationService {
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
   * Process a raw user message through the full pipeline:
   * intent detection → response generation → channel formatting.
   */
  public async processMessage(input: GatewayMessageInput): Promise<GatewayMessageResult> {
    const locale = input.locale ?? detectDeviceLocale();

    const commandlessInput: CommandlessInput = {
      message: input.text,
      channelId: input.channelId,
      userId: input.userId,
      isFirstInteraction: input.isFirstInteraction,
      locale,
    };

    const response = await this.commandless.process(commandlessInput);

    return {
      text: response.formatted.text,
      buttons: response.formatted.buttons,
      action: response.action,
      confidence: response.confidence,
      requiresApproval: response.requiresApproval,
      locale: response.detectedLanguage,
    };
  }

  /**
   * Format an existing response for a specific channel.
   * Useful when the agent has already generated a response
   * and you just need to format it for the target channel.
   */
  public formatResponse(
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
   * Get a localized greeting for a user.
   */
  public getGreeting(locale?: string): string {
    const lang = locale ?? detectDeviceLocale();
    const pack = getLanguagePack(lang);

    const greetings: Record<string, string> = {
      'en-US': "Hi! I'm Zavorth. Ask me anything — no commands needed.",
      'pt-BR': 'Oi! Sou o Zavorth. Pode me pedir qualquer coisa — sem comandos.',
      'es-ES': '¡Hola! Soy Zavorth. Pide lo que necesites — sin comandos.',
      'fr-FR': 'Bonjour ! Je suis Zavorth. Demandez-moi n\'importe quoi — sans commandes.',
      'de-DE': 'Hallo! Ich bin Zavorth. Frag mich was du willst — ohne Befehle.',
      'ja-JP': 'こんにちは！Zavorthです。何でも聞いてください — コマンド不要です。',
      'zh-CN': '你好！我是Zavorth。随时问我 — 不需要命令。',
      'ko-KR': '안녕하세요! Zavorth입니다. 뭐든 물어보세요 — 명령어 불필요.',
    };

    return greetings[pack.code] ?? greetings['en-US'];
  }

  /**
   * Get channel capabilities for debugging/testing.
   */
  public getChannelCapabilities(channelId: string) {
    return this.caps.get(channelId);
  }
}
