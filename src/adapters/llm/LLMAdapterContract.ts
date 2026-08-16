/**
 * Universal LLM Adapter Contract.
 * Strict, vendor-agnostic contracts for LLM interaction, tool calling, and streaming.
 */

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCallFunction {
  name: string;
  arguments: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: ToolCallFunction;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  thought?: string;
}

export interface ToolPropertySchema {
  type: string;
  description?: string;
  enum?: string[];
  items?: Record<string, unknown>;
  properties?: Record<string, unknown>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolPropertySchema | Record<string, unknown>>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface CompletionOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  thinking?: {
    enabled?: boolean;
    budgetTokens?: number;
    effort?: 'low' | 'medium' | 'high';
  };
  stopSequences?: string[];
  signal?: AbortSignal;
  customHeaders?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface StreamChunk {
  deltaText: string;
  deltaReasoning?: string;
  toolCallDeltas?: Array<{
    index: number;
    id?: string;
    name?: string;
    arguments?: string;
  }>;
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  usage?: TokenUsage;
}

export interface CompletionResult {
  content: string;
  reasoningContent?: string;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error';
  usage: TokenUsage;
  model: string;
  provider: string;
  latencyMs: number;
  costUsd: number;
}

export interface ModelMetadata {
  id: string;
  provider: string;
  displayName: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsTools: boolean;
  supportsVision: boolean;
  supportsReasoning: boolean;
  isOpenWeights?: boolean;
  cost?: {
    input: number;
    output: number;
    cache_read?: number;
    cache_write?: number;
  };
}

export interface LLMAdapter {
  readonly id: string;
  readonly name: string;

  /**
   * Generates a non-streaming completion.
   */
  complete(messages: ChatMessage[], options: CompletionOptions): Promise<CompletionResult>;

  /**
   * Streams completion tokens and tool call deltas asynchronously.
   */
  streamComplete(messages: ChatMessage[], options: CompletionOptions): AsyncIterable<StreamChunk>;

  /**
   * Discovers available models for this adapter.
   */
  listModels(): Promise<ModelMetadata[]>;

  /**
   * Validates credentials and endpoint connectivity.
   */
  validateConfig(): Promise<{ valid: boolean; reason?: string }>;
}
