/**
 * Types and interface for LLM providers.
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
  metadata?: {
    pluginId?: string;
    source?: string;
    sourceTrusted?: boolean;
    [key: string]: unknown;
  };
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

export type LlmStreamToolCallDelta = {
  index: number;
  id?: string;
  name?: string;
  argumentsDelta?: string;
  arguments?: string;
};

export type LlmStreamEvent = {
  type: 'start' | 'delta' | 'tool_call_delta' | 'done';
  delta?: string;
  accumulated?: string;
  chunkIndex?: number;
  toolCallDelta?: LlmStreamToolCallDelta;
  response?: LlmResponse;
  done?: boolean;
  metadata?: Record<string, unknown>;
};

export interface ProviderChatOptions {
  modelName?: string;
  providerNativeTools?: ProviderNativeToolRequest[];
  signal?: AbortSignal;
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
 * Implementations must convert between internal format and API format.
 */
export interface ILlmProvider {
  readonly name: string;

  /**
   * Sends messages to the LLM and receives a response.
   * @param messages - Histórico de mensagens
   * @param tools - Ferramentas disponíveis (opcional)
   * @returns Resposta do LLM com possíveis tool calls
   */
  chat(messages: ChatMessage[], tools?: ToolDefinition[], options?: ProviderChatOptions): Promise<LlmResponse>;
  streamChat?(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    options?: ProviderChatOptions,
  ): AsyncIterable<LlmStreamEvent>;
}
