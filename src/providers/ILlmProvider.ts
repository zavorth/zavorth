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
}

export interface ProviderChatOptions {
  modelName?: string;
}

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
