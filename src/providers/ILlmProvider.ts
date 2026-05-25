/**
 * Tipos e interface para provedores de LLM.
 */

export interface InlineData {
  mimeType: string;
  data: string; // Base64
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  inlineData?: InlineData[];
  toolCallId?: string;
  toolName?: string;
  toolCalls?: ToolCall[];
}

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  category?: string;
  dangerLevel?: string;
  requiresPermission?: boolean;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LlmResponse {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderChatOptions {
  modelName?: string;
  providerNativeTools?: ProviderNativeToolRequest[];
}

export type ProviderNativeToolName =
  | 'google_search'
  | 'provider_web_search'
  | 'provider_code_execution'
  | 'code_execution'
  | 'provider_vision'
  | 'provider_audio'
  | 'provider_media_generation';

export type ProviderNativeToolRequest = {
  name: ProviderNativeToolName;
  reason: string;
  requiredEvidence?: 'citations' | 'grounding_metadata' | 'none';
};

/**
 * ILlmProvider — Interface para provedores de LLM.
 * Implementações devem converter entre formato interno e formato da API.
 */
export interface ILlmProvider {
  readonly name: string;

  /**
   * Envia mensagens para o LLM e recebe uma resposta.
   * @param messages - Histórico de mensagens
   * @param tools - Ferramentas disponíveis (opcional)
   * @returns Resposta do LLM com possíveis tool calls
   */
  chat(messages: ChatMessage[], tools?: ToolDefinition[], options?: ProviderChatOptions): Promise<LlmResponse>;
}
