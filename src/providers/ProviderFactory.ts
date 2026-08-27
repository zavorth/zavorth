/**
 * Provider Factory — Central instantiation service for LLM providers.
 * Seamlessly resolves credentials, protocols, and endpoints using DynamicModelCatalogService.
 */

import { UNIVERSAL_PROVIDER_CATALOG, type ProviderCatalogEntry } from '../services/providers/catalog/UniversalProviderCatalog.js';
import { ZavorthProviderFuzzyResolver, ProviderMatch } from '../services/providers/catalog/ZavorthProviderFuzzyResolver.js';
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
  chat?: (_messages: ChatMessage[], _tools?: ToolDefinition[], _options?: ProviderChatOptions) => Promise<LlmResponse>;
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
  adapterKind?: ProviderCatalogEntry['protocol'] | 'anthropic_compatible' | 'gateway' | 'local_openai_compatible' | 'bespoke';
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

export type ProviderFactoryCustomRegistration = {
  id: string;
  name: string;
  baseUrl: string;
  apiKeyEnv: string;
  defaultModel?: string | null;
};

export function providerFactoryInputName(input: string | ProviderFactoryCreateInput): string {
  if (typeof input === 'string') return input;
  return input.providerName || input.providerId || input.routeId || input.providerLabel || '';
}

export class ProviderFactory {
  private static resolver = new ZavorthProviderFuzzyResolver();
  private static catalog = UNIVERSAL_PROVIDER_CATALOG;
  private static idToEntry = new Map<string, ProviderCatalogEntry>();
  private static cache: Map<string, ILlmProvider> = new Map<string, ILlmProvider>();

  private static readonly DEFAULT_PROVIDER_ENV_KEYS = [
    'ZAVORTH_DEFAULT_PROVIDER',
    'LLM_PROVIDER',
    'ZAVORTH_LLM_PROVIDER',
  ];
  private static customProviders = new Map<string, ProviderFactoryCustomRegistration>();

  static registerCustomProvider(registration: ProviderFactoryCustomRegistration): void {
    const id = registration.id.trim().toLowerCase();
    if (!id) {
      return;
    }
    this.customProviders.set(id, {
      id,
      name: registration.name.trim() || id,
      baseUrl: registration.baseUrl.trim(),
      apiKeyEnv: registration.apiKeyEnv.trim(),
      defaultModel: registration.defaultModel || null,
    });
    this.clearCache();
  }

  static unregisterCustomProvider(id: string): void {
    const key = id.trim().toLowerCase();
    if (this.customProviders.delete(key)) {
      this.clearCache();
    }
  }

  static listCustomProviders(): ProviderFactoryCustomRegistration[] {
    return Array.from(this.customProviders.values());
  }

  private static lookupCustomProvider(input: string | ProviderFactoryCreateInput): ProviderFactoryCustomRegistration | null {
    const name = providerFactoryInputName(input).trim().toLowerCase();
    if (!name) {
      return null;
    }
    return this.customProviders.get(name) || null;
  }

  private static readonly knownProviderKeys = new Set<string>(
    UNIVERSAL_PROVIDER_CATALOG.flatMap((entry) => [entry.id.toLowerCase(), entry.name.toLowerCase()]),
  );

  static {
    for (const entry of ProviderFactory.catalog) {
      ProviderFactory.idToEntry.set(entry.id, entry);
    }
  }

  static create(input?: string | ProviderFactoryCreateInput): ILlmProvider {
    const target = this.resolveRuntimeTarget(this.resolveDefaultInput(input));
    const cached = this.cache.get(target.providerName);
    if (cached) return cached;
    const adapter = this.buildSingleProvider(target);
    const provider = wrapLlmProviderWithEgressGuard(new DynamicAdapterProvider(target.providerName, adapter));
    this.cache.set(target.providerName, provider);
    return provider;
  }

  private static resolveDefaultInput(input?: string | ProviderFactoryCreateInput): string | ProviderFactoryCreateInput {
    if (typeof input === 'string') {
      const name = input.trim();
      if (name && name !== 'default') return input;
    } else if (input) {
      const name = providerFactoryInputName(input).trim();
      if (name && name !== 'default') return input;
    }
    for (const key of this.DEFAULT_PROVIDER_ENV_KEYS) {
      const value = process.env[key]?.trim();
      if (value) {
        const custom = this.customProviders.get(value.toLowerCase());
        if (custom) {
          return this.customProviderCreateInput(custom);
        }
        return value;
      }
    }
    throw new Error(
      'No provider specified: set ZAVORTH_DEFAULT_PROVIDER (or LLM_PROVIDER / ZAVORTH_LLM_PROVIDER) or pass an explicit provider name.',
    );
  }

  private static customProviderCreateInput(custom: ProviderFactoryCustomRegistration): ProviderFactoryCreateInput {
    return {
      providerName: custom.id,
      routeKind: 'custom_compatible',
      baseUrl: custom.baseUrl,
      apiKey: process.env[custom.apiKeyEnv],
      modelName: custom.defaultModel || undefined,
    };
  }

  static clearCache(): void {
    this.cache.clear();
  }

  static normalizeProviderName(input: string): string {
    const raw = String(input ?? '');
    if (!raw.trim()) {
      return '';
    }
    const custom = this.customProviders.get(raw.trim().toLowerCase());
    if (custom) {
      return custom.id;
    }
    const match = this.resolver.resolveProviderInput(raw);
    if (!match.provider) {
      throw new Error(this.formatUnknownProviderMessage(input, match));
    }
    return match.provider.id;
  }

  private static formatUnknownProviderMessage(input: string, match: ProviderMatch): string {
    const base = `Provider not registered: ${input}`;
    if (match.suggestions?.length) {
      return `${base}. Did you mean: ${match.suggestions.map((s) => s.id).join(', ')}?`;
    }
    return `${base}.`;
  }

  static resolveRuntimeTarget(input: string | ProviderFactoryCreateInput): ProviderFactoryRuntimeTarget {
    // Handle generic OpenAI-compatible providers from profile objects
    const inputObj = typeof input === 'string' ? null : input;
    const hasCustomBaseUrl = inputObj?.baseUrl && typeof inputObj.baseUrl === 'string';
    const providerNameFromInput = inputObj?.providerName || inputObj?.providerId || inputObj?.routeId;
    const isCustomCompatible = hasCustomBaseUrl && providerNameFromInput &&
      !this.knownProviderKeys.has(providerNameFromInput.toLowerCase());

    if (inputObj && (inputObj.routeKind === 'custom_compatible' || isCustomCompatible)) {
      const providerName = inputObj.providerName || inputObj.providerId || inputObj.routeId || 'openai-compatible';
      return {
        providerName,
        modelName: inputObj.modelName,
        runtimeSupported: true,
        adapterKind: 'openai_compatible',
        apiKey: inputObj.apiKey !== undefined ? inputObj.apiKey : process.env[inputObj.credentialRef || 'OPENAI_API_KEY'],
        baseUrl: inputObj.baseUrl,
        firstClassProvider: false,
        genericCompatible: true,
      };
    }

    const custom = this.lookupCustomProvider(input);
    if (custom) {
      const modelName = (inputObj?.modelName || '').trim() || custom.defaultModel || undefined;
      return {
        providerName: custom.id,
        modelName,
        runtimeSupported: true,
        adapterKind: 'openai_compatible',
        apiKey: inputObj?.apiKey !== undefined ? inputObj.apiKey : process.env[custom.apiKeyEnv] || '',
        baseUrl: inputObj?.baseUrl || custom.baseUrl,
        firstClassProvider: false,
        genericCompatible: true,
      };
    }

    const match = this.resolver.resolveProviderInput(providerFactoryInputName(input));
    if (match.matchKind === 'not_found' || !match.provider) {
      throw new Error(this.formatUnknownProviderMessage(providerFactoryInputName(input), match));
    }
    const provider = match.provider;
    const isFirstClass = provider.runtimeSupported;
    const adapterKind = isFirstClass && provider.id !== 'ollama' ? (provider.id in DEDICATED_OPENAI_COMPATIBLE_PROVIDERS ? 'openai_compatible' : 'bespoke') : provider.protocol;

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
      explanation: match.explanation,
      genericCompatible: !isFirstClass,
    };
  }

  static buildSingleProvider(target: ProviderFactoryRuntimeTarget): ZavorthUniversalDynamicAdapter {
    // Handle generic OpenAI-compatible providers
    if (target.genericCompatible && target.adapterKind === 'openai_compatible') {
      // Check runtimeSupported for generic compatible providers too
      const entry = this.idToEntry.get(target.providerName);
      if (entry && !entry.runtimeSupported) {
        throw new Error(`Provider ${target.providerName} cannot be used as a chat model`);
      }
      if (!target.baseUrl) {
        throw new Error(`Provider ${target.providerName} requires an explicit base URL`);
      }
      if (!target.modelName) {
        throw new Error(`Provider ${target.providerName} requires an explicit default model`);
      }
      return new ZavorthUniversalDynamicAdapter({
        providerId: target.providerName,
        baseUrl: target.baseUrl,
        apiKey: target.apiKey || '',
        defaultModel: target.modelName,
        protocol: 'openai_compatible',
      });
    }

    const entry = this.idToEntry.get(target.providerName);
    if (!entry) {
      throw new Error(`Provider ${target.providerName} not registered`);
    }
    if (!entry.runtimeSupported) {
      throw new Error(`Provider ${target.providerName} cannot be used as a chat model`);
    }
    if (!entry.defaultModel) {
      throw new Error(`Provider ${target.providerName} has no default model`);
    }

    const dynamicProvider = DynamicModelCatalogService.getProvider(entry.id);
    const envKey = dynamicProvider?.env?.[0] || entry.envKey;
    const apiKey = target.apiKey || (envKey ? process.env[envKey] : '') || process.env[entry.envKey] || '';
    const baseUrl = target.baseUrl || this.getBaseUrl(entry);
    if (!baseUrl) {
      throw new Error(`Provider ${target.providerName} has no configured base URL`);
    }

    return new ZavorthUniversalDynamicAdapter({
      providerId: entry.id,
      baseUrl,
      apiKey,
      defaultModel: entry.defaultModel,
      protocol: entry.protocol as DynamicAdapterConfig['protocol'],
    });
  }

  private static getBaseUrl(entry: ProviderCatalogEntry): string | undefined {
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

    return defaultUrls[entry.id];
  }
}