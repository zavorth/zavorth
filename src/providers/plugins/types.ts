import type { ILlmProvider, ChatMessage, LlmResponse, LlmStreamEvent, ToolDefinition, ProviderChatOptions } from '../ILlmProvider.js';

export type ApiMode =
  | 'openai_completions'
  | 'anthropic_messages'
  | 'bedrock_converse'
  | 'codex_responses';

export type AuthType =
  | 'api_key'
  | 'oauth_device_code'
  | 'oauth_external'
  | 'aws_sdk'
  | 'vertex_oauth'
  | 'copilot'
  | 'none';

export type ThinkingFormat =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'zai'
  | 'qwen'
  | 'kimi';

export type ReasoningEffortFormat =
  | 'openai'
  | 'deepseek'
  | 'qwen'
  | 'kimi';

export type CacheControlFormat =
  | 'openai'
  | 'anthropic'
  | 'google';

export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsTools: boolean;
  supportsThinking: boolean;
  supportsReasoningEffort: boolean;
  supportsCacheControl: boolean;
  supportsStore: boolean;
  supportsDeveloperRole: boolean;
  supportsVision: boolean;
  supportsAudio: boolean;
  supportsCodeExecution: boolean;
  supportsWebSearch: boolean;
  supportsMediaGeneration: boolean;
  nativeToolNames: string[];
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsThinking: boolean;
  supportsVision: boolean;
  supportsTools: boolean;
  costPerInputToken?: number;
  costPerOutputToken?: number;
}

export interface ThinkingLevelConfig {
  level: 'none' | 'low' | 'medium' | 'high' | 'xhigh';
  budgetTokens?: number;
  enabled?: boolean;
}

export interface TransportChatContext {
  model: string;
  messages: ChatMessage[];
  systemPrompt: string | null;
  tools?: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  thinking?: ThinkingLevelConfig;
  extraBody?: Record<string, unknown>;
  extraHeaders?: Record<string, string>;
}

export interface TransportChatResponse {
  content: string | null;
  toolCalls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
  finishReason: string;
  usage?: { inputTokens: number; outputTokens: number };
  thinking?: string;
  metadata?: Record<string, unknown>;
}

export interface TransportStreamEvent {
  type: 'start' | 'delta' | 'thinking_delta' | 'tool_call_delta' | 'done' | 'error';
  delta?: string;
  thinkingDelta?: string;
  accumulated?: string;
  chunkIndex?: number;
  toolCallDelta?: {
    index: number;
    id?: string;
    name?: string;
    argumentsDelta?: string;
  };
  response?: TransportChatResponse;
  done?: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface TransportAdapter {
  readonly apiMode: ApiMode;
  chat(context: TransportChatContext): Promise<TransportChatResponse>;
  streamChat(context: TransportChatContext): AsyncIterable<TransportStreamEvent>;
}

export interface CompatLayer {
  readonly apiMode: ApiMode;
  transformRequest(request: Record<string, unknown>, model: string): Record<string, unknown>;
  transformResponse(response: Record<string, unknown>): TransportChatResponse;
  buildThinkingPayload(level: ThinkingLevelConfig): Record<string, unknown>;
}

export interface AuthProvider {
  readonly authType: AuthType;
  resolveCredentials(envVars: Record<string, string | undefined>): Promise<ResolvedCredentials>;
  buildHeaders(credentials: ResolvedCredentials): Record<string, string>;
  buildBody(credentials: ResolvedCredentials): Record<string, unknown>;
}

export interface ResolvedCredentials {
  apiKey?: string;
  baseUrl?: string;
  token?: string;
  awsAccessKey?: string;
  awsSecretKey?: string;
  awsSessionToken?: string;
  awsRegion?: string;
  projectId?: string;
  region?: string;
  extra?: Record<string, unknown>;
}

export interface ModelCatalog {
  readonly providerId: string;
  getStaticModels(): ModelInfo[];
  fetchModels?(apiKey: string, baseUrl: string): Promise<ModelInfo[]>;
  findModel(modelId: string): ModelInfo | undefined;
}

export interface ThinkingAdapter {
  readonly providerId: string;
  detectThinkingCapability(modelId: string): boolean;
  getThinkingConfig(modelId: string, level: string): ThinkingLevelConfig;
  getSupportedLevels(modelId: string): string[];
}

export interface EnhancedProviderPluginManifest {
  name: string;
  aliases?: string[];
  description?: string;
  apiMode: ApiMode;
  authType: AuthType;
  authConfig?: {
    apiKeyEnvVars?: string[];
    apiKeyHeader?: string;
    oauth?: {
      authorizeUrl: string;
      tokenUrl: string;
      scopes: string[];
    };
    aws?: {
      region: string;
      service: string;
    };
  };
  baseUrl?: string;
  baseUrlEnvVar?: string;
  envVars?: string[];
  defaultModel?: string;
  defaultModelEnvVar?: string;
  defaultMaxTokens?: number;
  defaultHeaders?: Record<string, string>;
  capabilities: ProviderCapabilities;
  compat: {
    thinkingFormat?: ThinkingFormat;
    reasoningEffortFormat?: ReasoningEffortFormat;
    cacheControlFormat?: CacheControlFormat;
    supportsStore?: boolean;
    supportsDeveloperRole?: boolean;
  };
  models?: ModelInfo[];
  fetchModels?: (apiKey: string, baseUrl: string) => Promise<ModelInfo[]>;
}

export interface EnhancedProviderPlugin {
  manifest: EnhancedProviderPluginManifest;
  create: (target: any) => ILlmProvider;
  transport?: TransportAdapter;
  compat?: CompatLayer;
  auth?: AuthProvider;
  catalog?: ModelCatalog;
  thinking?: ThinkingAdapter;
}
