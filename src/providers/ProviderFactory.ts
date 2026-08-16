/**
 * Provider Factory — Central instantiation service for LLM providers.
 * Seamlessly resolves credentials, protocols, and endpoints using DynamicModelCatalogService.
 */

import { UNIVERSAL_PROVIDER_CATALOG, type ProviderCatalogEntry } from '../services/providers/catalog/UniversalProviderCatalog.js';
import { ZavorthProviderFuzzyResolver } from '../services/providers/catalog/ZavorthProviderFuzzyResolver.js';
import { DynamicModelCatalogService } from '../services/providers/catalog/DynamicModelCatalogService.js';
import { ZavorthUniversalDynamicAdapter, type DynamicAdapterConfig } from './ZavorthUniversalDynamicAdapter.js';
import type { ChatMessage, ILlmProvider, LlmResponse, ProviderChatOptions, ToolDefinition } from './ILlmProvider.js';
import { wrapLlmProviderWithEgressGuard } from '../security/LlmEgressGuard.js';

export interface DedicatedOpenAiCompatibleProviderConfig {
  modelEnv: string;
  defaultModel: string;
  baseUrl: string;
}

export const DEDICATED_OPENAI_COMPATIBLE_PROVIDERS: Record<string, DedicatedOpenAiCompatibleProviderConfig> = {
  groq: {
    modelEnv: 'GROQ_API_KEY',
    defaultModel: 'llama-3.3-70b-versatile',
    baseUrl: 'https://api.groq.com/openai/v1',
  },
  xai: {
    modelEnv: 'XAI_API_KEY',
    defaultModel: 'grok-4',
    baseUrl: 'https://api.x.ai/v1',
  },
  mistral: {
    modelEnv: 'MISTRAL_API_KEY',
    defaultModel: 'mistral-large-latest',
    baseUrl: 'https://api.mistral.ai/v1',
  },
  cerebras: {
    modelEnv: 'CEREBRAS_API_KEY',
    defaultModel: 'llama-3.3-70b',
    baseUrl: 'https://api.cerebras.ai/v1',
  },
  together: {
    modelEnv: 'TOGETHER_API_KEY',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    baseUrl: 'https://api.together.xyz/v1',
  },
};

interface LegacyAdapterShape {
  chat?: (messages: ChatMessage[], tools?: ToolDefinition[], options?: ProviderChatOptions) => Promise<LlmResponse>;
}

class DynamicAdapterProvider implements ILlmProvider {
  public readonly name: string;
  private readonly adapter: ZavorthUniversalDynamicAdapter;

  constructor(name: string, adapter: ZavorthUniversalDynamicAdapter) {
    this.name = name;
    this.adapter = adapter;
  }

  async chat(messages: ChatMessage[], tools?: ToolDefinition[], options?: ProviderChatOptions): Promise<LlmResponse> {
    const target = this.adapter as unknown as LegacyAdapterShape;
    if (typeof target.chat !== 'function') {
      throw new Error(`Provider ${this.name} does not implement chat on the dynamic adapter`);
    }
    return target.chat.call(this.adapter, messages, tools, options);
  }
}

export interface RuntimeTarget {
  providerName: string;
  modelName?: string;
  runtimeSupported: boolean;
  adapterKind?: ProviderCatalogEntry['protocol'] | 'anthropic_compatible' | 'gateway' | 'local_openai_compatible';
  apiKey?: string;
  baseUrl?: string;
  explanation?: string[];
}

export type ProviderFactoryRuntimeTarget = RuntimeTarget & {
  firstClassProvider?: boolean;
  genericCompatible?: boolean;
  explanation?: string[];
};

export interface ProviderFactoryRouteInput {
  providerName?: string;
  providerId?: string;
  providerLabel?: string;
  routeId?: string;
  routeKind?: string;
  modelName?: string;
  modelLabel?: string;
  familyId?: string;
  credentialKind?: string;
  credentialRef?: string | null;
  catalogSource?: string;
  readiness?: string;
  ready?: boolean;
  fallbackRouteIds?: string[];
  fallbackOrder?: string[];
  capabilities?: string[];
  modalities?: string[];
  limitations?: string[];
  baseUrlRef?: string | null;
  adapterKind?: string;
}

export interface ProviderFactoryCreateInput extends ProviderFactoryRouteInput {
  baseUrl?: string;
  apiKey?: string;
}

export function providerFactoryInputName(input: string | ProviderFactoryCreateInput): string {
  if (typeof input === 'string') return input;
  return input.providerName || input.providerId || input.routeId || input.providerLabel || '';
}

export class ProviderFactory {
  private static resolver = new ZavorthProviderFuzzyResolver();
  private static catalog = UNIVERSAL_PROVIDER_CATALOG;
  private static idToEntry = new Map<string, ProviderCatalogEntry>();
  private static cache: Map<string, ILlmProvider> = new Map<string, ILlmProvider>();

  static {
    for (const entry of ProviderFactory.catalog) {
      ProviderFactory.idToEntry.set(entry.id, entry);
    }
  }

  static create(input: string | ProviderFactoryCreateInput = 'openai'): ILlmProvider {
    const target = this.resolveRuntimeTarget(providerFactoryInputName(input));
    const cached = this.cache.get(target.providerName);
    if (cached) return wrapLlmProviderWithEgressGuard(cached);
    const adapter = this.buildSingleProvider(target);
    const provider = new DynamicAdapterProvider(target.providerName, adapter);
    this.cache.set(target.providerName, provider);
    return wrapLlmProviderWithEgressGuard(provider);
  }

  static clearCache(): void {
    this.cache.clear();
  }

  static normalizeProviderName(input: string): string {
    const match = this.resolver.resolveProviderInput(input);
    return match.provider.id;
  }

  static resolveRuntimeTarget(input: string | ProviderFactoryCreateInput): RuntimeTarget {
    const match = this.resolver.resolveProviderInput(providerFactoryInputName(input));
    const provider = match.provider;
    const isFirstClass = ['openai', 'gemini', 'deepseek', 'qwen', 'openrouter', 'ollama', 'groq', 'xai', 'mistral', 'cerebras', 'together'].includes(provider.id);
    const adapterKind = isFirstClass && provider.id !== 'ollama' ? (provider.id in DEDICATED_OPENAI_COMPATIBLE_PROVIDERS ? 'openai_compatible' : 'bespoke') : provider.protocol;
    const isFallback = match.matchKind === 'fallback_default';

    // Dynamic resolution from DynamicModelCatalogService when available
    const dynamicProvider = DynamicModelCatalogService.getProvider(provider.id);
    const envKey = dynamicProvider?.env?.[0] || provider.envKey;
    const apiKey = (envKey ? process.env[envKey] : undefined) || process.env[provider.envKey];

    return {
      providerName: provider.id,
      modelName: match.requestedModel,
      runtimeSupported: provider.runtimeSupported,
      adapterKind,
      apiKey,
      baseUrl: this.getBaseUrl(provider),
      firstClassProvider: isFirstClass,
      explanation: match.explanation || (isFallback ? ['Gemini legacy fallback for unknown provider'] : undefined),
      genericCompatible: !isFirstClass,
    };
  }

  static buildSingleProvider(target: RuntimeTarget): ZavorthUniversalDynamicAdapter {
    const entry = this.idToEntry.get(target.providerName);
    if (!entry) {
      throw new Error(`Provider ${target.providerName} not registered`);
    }
    if (!entry.runtimeSupported) {
      throw new Error(`Provider ${target.providerName} cannot be used as a chat model`);
    }

    const dynamicProvider = DynamicModelCatalogService.getProvider(entry.id);
    const envKey = dynamicProvider?.env?.[0] || entry.envKey;
    const apiKey = target.apiKey || (envKey ? process.env[envKey] : '') || process.env[entry.envKey] || '';

    return new ZavorthUniversalDynamicAdapter({
      providerId: entry.id,
      baseUrl: target.baseUrl || this.getBaseUrl(entry),
      apiKey,
      defaultModel: entry.defaultModel || 'gpt-4o',
      protocol: entry.protocol as DynamicAdapterConfig['protocol'],
    });
  }

  private static getBaseUrl(entry: ProviderCatalogEntry): string {
    const dedicated = DEDICATED_OPENAI_COMPATIBLE_PROVIDERS[entry.id];
    if (dedicated) {
      return dedicated.baseUrl;
    }

    // Dynamic lookup from DynamicModelCatalogService
    const dynamicProvider = DynamicModelCatalogService.getProvider(entry.id);
    if (dynamicProvider?.api) {
      return dynamicProvider.api;
    }

    // Clean fallback mapping
    const defaultUrls: Record<string, string> = {
      openai: 'https://api.openai.com/v1',
      anthropic: 'https://api.anthropic.com/v1',
      gemini: 'https://generativelanguage.googleapis.com/v1beta',
      perplexity: 'https://api.perplexity.ai',
      fireworks: 'https://api.fireworks.ai/inference/v1',
      deepseek: 'https://api.deepseek.com/v1',
      cohere: 'https://api.cohere.ai/v1',
      openrouter: 'https://openrouter.ai/api/v1',
      portkey: 'https://api.portkey.ai/v1',
      liteLLM: 'http://localhost:4000/v1',
      sambanova: 'https://api.sambanova.ai/v1',
      kimi: 'https://api.moonshot.cn/v1',
      zhipu: 'https://open.bigmodel.cn/api/paas/v4',
      baichuan: 'https://api.baichuan-ai.com/v1',
      minimax: 'https://api.minimax.chat/v1',
      qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      ollama: 'http://localhost:11434/v1',
      lmstudio: 'http://localhost:1234/v1',
      jan: 'http://localhost:1337/v1',
      gpt4all: 'http://localhost:4891/v1',
      'llama.cpp': 'http://localhost:8080/v1',
    };

    return defaultUrls[entry.id] || 'https://api.openai.com/v1';
  }
}