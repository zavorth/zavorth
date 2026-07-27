import { logger } from '../logger.js';
import type { ILlmProvider, ChatMessage, ToolDefinition, LlmResponse, LlmStreamEvent, ProviderChatOptions } from './ILlmProvider.js';
import { ProviderFactory, type ProviderFactoryCreateInput } from './ProviderFactory.js';
import { ProviderBootstrap, type ResolvedProvider } from './ProviderBootstrap.js';
import { ProviderRegistry } from './ProviderRegistry.js';
import type { TransportAdapter } from './transports/TransportAdapter.js';
import type { CompatLayer } from './compat/types.js';
import type { ThinkingAdapter, ThinkingLevelConfig } from './thinking/types.js';
import type { AuthProvider, ResolvedCredentials } from './auth/types.js';
import type { ModelCatalog, ModelInfo } from './catalog/types.js';
import { wrapLlmProviderWithEgressGuard } from '../security/LlmEgressGuard.js';

export interface EnhancedProviderInfo {
  name: string;
  apiMode: string;
  authType: string;
  baseUrl: string | null;
  apiKey: string | null;
  defaultModel: string | null;
  defaultHeaders: Record<string, string>;
  hasTransport: boolean;
  hasCompat: boolean;
  hasThinking: boolean;
  hasCatalog: boolean;
  hasAuth: boolean;
  transportName: string | null;
  compatProviderId: string | null;
  thinkingProviderId: string | null;
  catalogProviderId: string | null;
  authTypeResolved: string | null;
  supportedThinkingLevels: string[];
}

export interface ProviderListEntry {
  name: string;
  apiMode: string;
  authType: string;
  capabilities: string[];
  thinkingLevels: string[];
}

class TransportBasedProvider implements ILlmProvider {
  readonly name: string;

  private transport: TransportAdapter;
  private compat: CompatLayer | null;
  private thinking: ThinkingAdapter | null;
  private auth: AuthProvider | null;
  private credentials: ResolvedCredentials | null;
  private modelName: string | null;
  private baseUrl: string | null;
  private defaultHeaders: Record<string, string>;

  constructor(
    name: string,
    transport: TransportAdapter,
    compat: CompatLayer | null,
    thinking: ThinkingAdapter | null,
    auth: AuthProvider | null,
    credentials: ResolvedCredentials | null,
    modelName: string | null,
    baseUrl: string | null,
    defaultHeaders: Record<string, string>,
  ) {
    this.name = name;
    this.transport = transport;
    this.compat = compat;
    this.thinking = thinking;
    this.auth = auth;
    this.credentials = credentials;
    this.modelName = modelName;
    this.baseUrl = baseUrl;
    this.defaultHeaders = defaultHeaders;
  }

  async chat(messages: ChatMessage[], tools?: ToolDefinition[], options?: ProviderChatOptions): Promise<LlmResponse> {
    const effectiveModel = options?.modelName || this.modelName || undefined;
    let request = this.buildRequest(messages, tools, options, effectiveModel);

    if (this.compat) {
      request = this.compat.transformRequest(request, effectiveModel || '');
    }

    const response = await this.transport.chat(messages, tools, { ...options, modelName: effectiveModel });

    if (this.compat) {
      return this.applyCompatResponse(response, effectiveModel || '');
    }

    return response;
  }

  async *streamChat(messages: ChatMessage[], tools?: ToolDefinition[], options?: ProviderChatOptions): AsyncIterable<LlmStreamEvent> {
    const effectiveModel = options?.modelName || this.modelName || undefined;
    yield* this.transport.streamChat(messages, tools, { ...options, modelName: effectiveModel });
  }

  private buildRequest(
    messages: ChatMessage[],
    tools: ToolDefinition[] | undefined,
    options: ProviderChatOptions | undefined,
    model: string | undefined,
  ): Record<string, unknown> {
    const request: Record<string, unknown> = {
      model,
      messages,
      tools,
    };

    if (options?.reasoningEffort && this.thinking) {
      const config = this.thinking.getThinkingConfig(model || '', options.reasoningEffort);
      if (config.enabled) {
        request.thinking = this.compat
          ? this.compat.buildThinkingPayload(config)
          : { type: 'enabled', budget_tokens: config.budgetTokens };
      }
    }

    if (this.credentials?.apiKey) {
      request.apiKey = this.credentials.apiKey;
    }

    if (Object.keys(this.defaultHeaders).length > 0) {
      request.defaultHeaders = this.defaultHeaders;
    }

    return request;
  }

  private applyCompatResponse(response: LlmResponse, model: string): LlmResponse {
    if (!this.compat) return response;

    const compatInput: Record<string, unknown> = {
      choices: [{
        message: {
          role: 'assistant',
          content: response.content,
          tool_calls: response.toolCalls?.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          })),
        },
        finish_reason: response.finishReason,
      }],
    };

    const transformed = this.compat.transformResponse(compatInput);
    return {
      content: transformed.content ?? response.content,
      toolCalls: transformed.toolCalls.length > 0
        ? transformed.toolCalls.map((tc) => ({ id: tc.id, name: tc.name, arguments: tc.arguments }))
        : response.toolCalls,
      finishReason: transformed.finishReason || response.finishReason,
      metadata: response.metadata,
    };
  }
}

export class EnhancedProviderFactory {
  private static cache = new Map<string, ILlmProvider>();

  static create(name: ProviderFactoryCreateInput): ILlmProvider {
    const normalizedName = typeof name === 'string' ? name : (name.providerName || name.providerId || name.routeId || '');
    const resolved = EnhancedProviderFactory.safeResolve(normalizedName);

    if (resolved && resolved.transport) {
      const cacheKey = `enhanced|${resolved.name}|${resolved.apiMode}|${resolved.baseUrl || 'default'}`;
      if (EnhancedProviderFactory.cache.has(cacheKey)) {
        return EnhancedProviderFactory.cache.get(cacheKey)!;
      }

      const credentials: ResolvedCredentials | null = resolved.apiKey
        ? { apiKey: resolved.apiKey }
        : null;

      const provider = new TransportBasedProvider(
        resolved.name,
        resolved.transport,
        resolved.compat,
        resolved.thinking,
        resolved.auth,
        credentials,
        resolved.defaultModel,
        resolved.baseUrl,
        resolved.defaultHeaders,
      );

      const guarded = wrapLlmProviderWithEgressGuard(provider);
      EnhancedProviderFactory.cache.set(cacheKey, guarded);
      logger.info(`Enhanced provider "${resolved.name}" created via bootstrap.`);
      return guarded;
    }

    logger.info(`Falling back to ProviderFactory for "${normalizedName}".`);
    return ProviderFactory.create(name);
  }

  static listProviders(): ProviderListEntry[] {
    const registryNames = ProviderRegistry.names();
    const entries: ProviderListEntry[] = [];

    for (const name of registryNames) {
      const resolved = EnhancedProviderFactory.safeResolve(name);
      const thinkingLevels = resolved?.thinking
        ? resolved.thinking.getSupportedLevels(resolved.defaultModel || '')
        : [];

      entries.push({
        name,
        apiMode: resolved?.apiMode || 'unknown',
        authType: resolved?.authType || 'unknown',
        capabilities: EnhancedProviderFactory.buildCapabilityList(resolved),
        thinkingLevels,
      });
    }

    return entries;
  }

  static getProviderInfo(name: string): EnhancedProviderInfo | null {
    const resolved = EnhancedProviderFactory.safeResolve(name);
    if (!resolved) return null;

    const thinkingLevels = resolved.thinking
      ? resolved.thinking.getSupportedLevels(resolved.defaultModel || '')
      : [];

    return {
      name: resolved.name,
      apiMode: resolved.apiMode,
      authType: resolved.authType,
      baseUrl: resolved.baseUrl,
      apiKey: resolved.apiKey ? '***' : null,
      defaultModel: resolved.defaultModel,
      defaultHeaders: resolved.defaultHeaders,
      hasTransport: !!resolved.transport,
      hasCompat: !!resolved.compat,
      hasThinking: !!resolved.thinking,
      hasCatalog: !!resolved.catalog,
      hasAuth: !!resolved.auth,
      transportName: resolved.transport?.name || null,
      compatProviderId: resolved.compat?.providerId || null,
      thinkingProviderId: resolved.thinking?.providerId || null,
      catalogProviderId: resolved.catalog?.providerId || null,
      authTypeResolved: resolved.auth?.authType || null,
      supportedThinkingLevels: thinkingLevels,
    };
  }

  static getThinkingConfig(name: string, model: string, level: string): ThinkingLevelConfig | null {
    const resolved = EnhancedProviderFactory.safeResolve(name);
    if (!resolved?.thinking) return null;

    if (!resolved.thinking.detectThinkingCapability(model)) {
      return { level: 'none', enabled: false };
    }

    return resolved.thinking.getThinkingConfig(model, level);
  }

  static clearCache(): void {
    EnhancedProviderFactory.cache.clear();
    ProviderFactory.clearCache();
  }

  private static safeResolve(name: string): ResolvedProvider | null {
    try {
      const normalized = String(name || '').trim().toLowerCase();
      return ProviderBootstrap.resolveProvider(normalized);
    } catch (error) {
      logger.debug(`ProviderBootstrap.resolveProvider failed for "${name}": ${error}`);
      return null;
    }
  }

  private static buildCapabilityList(resolved: ResolvedProvider | null): string[] {
    if (!resolved) return [];

    const capabilities: string[] = [];

    if (resolved.transport) capabilities.push('transport');
    if (resolved.compat) capabilities.push('compat');
    if (resolved.thinking) capabilities.push('thinking');
    if (resolved.catalog) capabilities.push('catalog');
    if (resolved.auth) capabilities.push('auth');

    return capabilities;
  }
}
