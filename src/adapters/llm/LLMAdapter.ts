/**
 * Pure Agnostic LLM Adapter Interface for Zavorth.
 * Decoupled from agent orchestration, fallback chains, and internal catalogs.
 */

export interface AdapterCapabilities {
  readonly streaming: boolean;
  readonly toolCalling: boolean;
  readonly vision: boolean;
  readonly reasoning: boolean;
  readonly jsonMode: boolean;
}

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface Message {
  role: MessageRole;
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolParameterSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  description?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
}

export interface CompleteOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | 'required' | { name: string };
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high' | 'xhigh';
  signal?: AbortSignal;
}

export interface CompletionUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface Completion {
  id: string;
  model: string;
  content: string;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | 'error';
  usage?: CompletionUsage;
}

export interface StreamChunk {
  delta: string;
  toolCallDelta?: {
    index: number;
    id?: string;
    name?: string;
    argumentsDelta?: string;
  };
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'content_filter' | 'error';
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow?: number;
  supportsStreaming: boolean;
  supportsTools: boolean;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  latencyMs?: number;
}

export interface LLMAdapter {
  readonly name: string;
  readonly capabilities: AdapterCapabilities;

  complete(messages: Message[], options?: CompleteOptions): Promise<Completion>;
  streamComplete(messages: Message[], options?: CompleteOptions): AsyncIterable<StreamChunk>;
  listModels(): Promise<ModelInfo[]>;
  validateConfig(): Promise<ValidationResult>;

  initialize(config?: Record<string, unknown>): Promise<void>;
  shutdown(): Promise<void>;
}
