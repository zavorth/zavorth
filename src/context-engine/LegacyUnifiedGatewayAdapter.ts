/**
 * LegacyUnifiedGatewayAdapter
 *
 * Adapter legado do antigo UnifiedGateway. Ele continua existindo apenas para
 * fallback de compatibilidade em surfaces que ainda nao anexaram o
 * ZavorthAgentGateway canonico.
 */

import { randomUUID } from 'crypto';

import { ContextEngine, type ContextEvent } from './ContextEngine.js';
import type { MessageChannel } from '../contracts/PlatformContract.js';

export interface LegacyGatewayIncomingEvent {
  /** Plataforma de origem */
  surface: MessageChannel;
  /** ID do chat na plataforma */
  chatId: string;
  /** ID do usuario */
  userId: string;
  /** Texto bruto da mensagem */
  text: string;
  /** Se e mensagem de grupo */
  isGroup: boolean;
  /** Dados multimodais opcionais (imagem, audio base64) */
  inlineData?: Array<{ mimeType: string; data: string }>;
  /** Callback para responder na plataforma de origem */
  reply: (text: string) => Promise<void>;
  /** Metadados extras da superficie */
  metadata?: Record<string, unknown>;
}

export interface LegacyGatewayResult {
  /** Resposta textual gerada */
  responseText: string;
  /** Plataforma de origem */
  surface: MessageChannel;
  /** Categoria de intencao detectada pelo firewall */
  intentCategory: string;
  /** Stats do firewall */
  firewallStats: string;
  /** Se um modelo mais barato foi sugerido */
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
   * Registra o callback do agente conversacional.
   * O adapter e agnostico ao agente: so precisa de uma funcao que
   * receba texto + tools e retorne resposta.
   */
  public setAgentCallback(callback: LegacyGatewayAgentCallback): void {
    this.agentCallback = callback;
  }

  public recordEvent(event: ContextEvent): void {
    this.contextEngine.pushEvent(event);
  }

  /**
   * Ponto de entrada universal legado. Qualquer surface ainda nao migrada chama
   * este metodo enquanto o ZavorthAgentGateway assume o caminho canonico.
   *
   * Fluxo:
   * 1. Registra o evento no ContextEngine.
   * 2. Chama o agente conversacional legado.
   * 3. Registra a resposta no ContextEngine.
   * 4. Responde via callback da superficie.
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
      const errorMsg = 'Gateway ativo mas sem agente registrado.';
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
   * Retorna o ContextEngine para acesso direto (debugging, stats).
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
      return result.text || 'Sem resposta do agente.';
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[LegacyUnifiedGatewayAdapter] Agent error: ${message}`);
      return `Erro ao processar sua mensagem: ${message}`;
    }
  }
}

export type GatewayIncomingEvent = LegacyGatewayIncomingEvent;
export type GatewayResult = LegacyGatewayResult;
