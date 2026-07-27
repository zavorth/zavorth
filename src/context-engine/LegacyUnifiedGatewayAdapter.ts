
/**
 * LegacyUnifiedGatewayAdapter
 *
 * Legacy adapter for the old UnifiedGateway. It remains only as a compatibility
 * fallback for surfaces that have not attached the canonical ZavorthAgentGateway yet.
 */

import { randomUUID } from 'crypto';

import { ContextEngine, type ContextEvent } from './ContextEngine.js';
import type { MessageChannel } from '../contracts/PlatformContract.js';
import { asErrorLike } from '../utils/errorLike.js';

export interface LegacyGatewayIncomingEvent {
  /** Origin surface */
  surface: MessageChannel;
  /** Platform chat ID */
  chatId: string;
  /** User ID */
  userId: string;
  /** Raw message text */
  text: string;
  /** Whether this is a group message */
  isGroup: boolean;
  /** Optional multimodal data (image, base64 audio) */
  inlineData?: Array<{ mimeType: string; data: string }>;
  /** Callback for replying on the origin platform */
  reply: (text: string) => Promise<void>;
  /** Extra surface metadata */
  metadata?: Record<string, unknown>;
}

export interface LegacyGatewayResult {
  /** Generated text response */
  responseText: string;
  /** Origin surface */
  surface: MessageChannel;
  /** Intent category detected by the firewall */
  intentCategory: string;
  /** Firewall stats */
  firewallStats: string;
  /** Whether a cheaper model was suggested */
  fastModelSuggested: boolean;
}

type LegacyGatewayAgentAction = Record<string, unknown> | null | undefined;

type LegacyGatewayAgentCallback = (
  message: string,
  userId: string,
  chatId: string,
  surface: MessageChannel,
  tools: unknown[],
  inlineData?: Array<{ mimeType: string; data: string }>,
  metadata?: Record<string, unknown>,
) => Promise<{ text: string; action?: LegacyGatewayAgentAction }>;

export class LegacyUnifiedGatewayAdapter {
  private readonly contextEngine: ContextEngine;
  private agentCallback: LegacyGatewayAgentCallback | null = null;

  constructor(contextEngine?: ContextEngine) {
    this.contextEngine = contextEngine || new ContextEngine();
  }

  /**
   * Registers the conversational agent callback.
   * The adapter is agent-agnostic: it only needs a function that
   * receives text + tools and returns a response.
   */
  public setAgentCallback(callback: LegacyGatewayAgentCallback): void {
    this.agentCallback = callback;
  }

  public recordEvent(event: ContextEvent): void {
    this.contextEngine.pushEvent(event);
  }

  /**
   * Legacy universal entry point. Any surface not migrated yet calls
   * this method while ZavorthAgentGateway owns the canonical path.
   *
   * Flow:
   * 1. Records the event in ContextEngine.
   * 2. Calls the legacy conversational agent.
   * 3. Records the response in ContextEngine.
   * 4. Replies through the surface callback.
   */
  public async handleEvent(event: LegacyGatewayIncomingEvent): Promise<LegacyGatewayResult> {
    const { surface, chatId, userId, text, inlineData, reply } = event;

    const userEvent: ContextEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      surface,
      chatId,
      userId,
      role: 'user',
      content: text,
      inlineData,
    };
    this.contextEngine.pushEvent(userEvent);

    if (!this.agentCallback) {
      const errorMsg = 'Gateway is active but no agent is registered.';
      await reply(errorMsg);
      return {
        responseText: errorMsg,
        surface,
        intentCategory: 'error',
        firewallStats: '',
        fastModelSuggested: false,
      };
    }

    const responseText = await this.callAgent(text, userId, chatId, surface, inlineData, event.metadata);

    const assistantEvent: ContextEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      surface,
      chatId,
      userId,
      role: 'assistant',
      content: responseText,
    };
    this.contextEngine.pushEvent(assistantEvent);

    await reply(responseText);

    return {
      responseText,
      surface,
      intentCategory: 'delegated',
      firewallStats: 'Firewall evaluation delegated to ConversationalAgent',
      fastModelSuggested: false,
    };
  }

  /**
   * Returns ContextEngine for direct access (debugging, stats).
   */
  public getContextEngine(): ContextEngine {
    return this.contextEngine;
  }

  private async callAgent(
    text: string,
    userId: string,
    chatId: string,
    surface: MessageChannel,
    inlineData?: Array<{ mimeType: string; data: string }>,
    metadata?: Record<string, unknown>,
  ): Promise<string> {
    try {
      const result = await this.agentCallback!(text, userId, chatId, surface, [], inlineData, metadata);
      return result.text || 'No response from the agent.';
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : String(error);
      console.error(`[LegacyUnifiedGatewayAdapter] Agent error: ${message}`);
      return `Error while processing your message: ${message}`;
    }
  }
}

export type GatewayIncomingEvent = LegacyGatewayIncomingEvent;
export type GatewayResult = LegacyGatewayResult;
