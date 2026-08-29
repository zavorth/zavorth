/**
 * Dynamic Model Catalog Service.
 * Data-driven model registry loading schema definitions from cache files.
 * Falls back to a small built-in catalog of well-known providers.
 * Dynamically registers custom providers at runtime via registerProvider/registerModel.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ModelCost {
  input: number;
  output: number;
  cache_read?: number;
  cache_write?: number;
}

export interface ModelLimit {
  context: number;
  output: number;
}

export interface ReasoningOption {
  type: 'toggle' | 'effort';
  values?: string[];
}

export interface ModelDefinition {
  id: string;
  name: string;
  description?: string;
  family?: string;
  attachment?: boolean;
  reasoning?: boolean;
  reasoning_options?: ReasoningOption[];
  tool_call?: boolean;
  structured_output?: boolean;
  temperature?: boolean;
  open_weights?: boolean;
  supportsImageCompression?: boolean;
  limit?: ModelLimit;
  cost?: ModelCost;
  providerId: string;
  providerName: string;
}

export interface ProviderDefinition {
  id: string;
  name: string;
  api?: string;
  env?: string[];
  doc?: string;
  models: Record<string, Omit<ModelDefinition, 'providerId' | 'providerName'>>;
}

export class DynamicModelCatalogService {
  private static cachedProviders: Map<string, ProviderDefinition> | null = null;

  /**
   * Resolves the path to the models.json cache file.
   */
  static getCachePaths(): string[] {
    const home = os.homedir();
    return [
      path.join(home, '.cache', 'opencode', 'models.json'),
      path.join(home, '.cache', 'zavorth', 'models.json'),
      path.join(home, '.config', 'opencode', 'models.json'),
    ];
  }

  /**
   * Loads all provider and model definitions from local cache or fallback.
   */
  static loadCatalog(): Map<string, ProviderDefinition> {
    if (this.cachedProviders) {
      return this.cachedProviders;
    }

    const providersMap = new Map<string, ProviderDefinition>();

    // 1. Try loading from cache paths
    for (const filePath of this.getCachePaths()) {
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, 'utf-8');
          const data: Record<string, ProviderDefinition> = JSON.parse(raw);
          for (const [key, value] of Object.entries(data)) {
            providersMap.set(key.toLowerCase(), value);
          }
          if (providersMap.size > 0) {
            break;
          }
        } catch {
          // Graceful fallback to next path
        }
      }
    }

    // 2. Merge default standard catalog so certified models and capabilities are always guaranteed
    const fallback = this.buildDefaultFallbackCatalog();
    for (const [providerKey, providerDef] of fallback.entries()) {
      const existing = providersMap.get(providerKey);
      if (!existing) {
        providersMap.set(providerKey, providerDef);
      } else {
        for (const [modelId, fallbackModel] of Object.entries(providerDef.models)) {
          const cachedModel = existing.models[modelId];
          if (cachedModel) {
            if (fallbackModel.supportsImageCompression !== undefined) {
              cachedModel.supportsImageCompression = fallbackModel.supportsImageCompression;
            }
          } else {
            existing.models[modelId] = fallbackModel;
          }
        }
      }
    }

    this.cachedProviders = providersMap;
    return this.cachedProviders;
  }

  /**
   * Returns all loaded providers.
   */
  static getAllProviders(): ProviderDefinition[] {
    return Array.from(this.loadCatalog().values());
  }

  /**
   * Returns a specific provider by ID.
   */
  static getProvider(providerId: string): ProviderDefinition | null {
    return this.loadCatalog().get(providerId.toLowerCase()) || null;
  }

  /**
   * Finds a model definition by ID across all providers or within a specific provider.
   */
  static getModel(modelId: string, providerId?: string): ModelDefinition | null {
    const catalog = this.loadCatalog();
    const cleanModelId = modelId.trim();

    if (providerId) {
      const provider = catalog.get(providerId.toLowerCase());
      if (provider?.models) {
        const found = provider.models[cleanModelId] || provider.models[cleanModelId.toLowerCase()];
        if (found) {
          return {
            ...found,
            providerId: provider.id,
            providerName: provider.name,
          };
        }
      }
    }

    for (const provider of catalog.values()) {
      if (provider.models) {
        for (const [key, m] of Object.entries(provider.models)) {
          if (key === cleanModelId || key.toLowerCase() === cleanModelId.toLowerCase() || m.id === cleanModelId) {
            return {
              ...m,
              providerId: provider.id,
              providerName: provider.name,
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Dynamically registers a new custom provider at runtime.
   */
  static registerProvider(provider: ProviderDefinition): void {
    const catalog = this.loadCatalog();
    catalog.set(provider.id.toLowerCase(), provider);
  }

  /**
   * Dynamically registers a new model under an existing or new provider.
   */
  static registerModel(providerId: string, model: ModelDefinition): void {
    const catalog = this.loadCatalog();
    const cleanProviderId = providerId.toLowerCase();
    let provider = catalog.get(cleanProviderId);

    if (!provider) {
      provider = {
        id: cleanProviderId,
        name: model.providerName || providerId,
        models: {},
      };
      catalog.set(cleanProviderId, provider);
    }

    provider.models[model.id] = {
      id: model.id,
      name: model.name || model.id,
      description: model.description,
      family: model.family,
      reasoning: model.reasoning,
      reasoning_options: model.reasoning_options,
      tool_call: model.tool_call,
      limit: model.limit,
      cost: model.cost,
    };
  }

  /**
   * Searches models matching a query.
   */
  static searchModels(query: string): ModelDefinition[] {
    const q = query.trim().toLowerCase();
    const results: ModelDefinition[] = [];
    const catalog = this.loadCatalog();

    for (const provider of catalog.values()) {
      if (provider.models) {
        for (const m of Object.values(provider.models)) {
          if (
            !q ||
            m.id.toLowerCase().includes(q) ||
            m.name.toLowerCase().includes(q) ||
            provider.name.toLowerCase().includes(q)
          ) {
            results.push({
              ...m,
              providerId: provider.id,
              providerName: provider.name,
            });
          }
        }
      }
    }

    return results;
  }

  /**
   * Builds default fallback catalog when cache file is unavailable.
   */
  private static buildDefaultFallbackCatalog(): Map<string, ProviderDefinition> {
    const map = new Map<string, ProviderDefinition>();

    map.set('anthropic', {
      id: 'anthropic',
      name: 'Anthropic',
      models: {
        'claude-3-7-sonnet-20250219': {
          id: 'claude-3-7-sonnet-20250219',
          name: 'Claude 3.7 Sonnet',
          reasoning: true,
          reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high', 'xhigh'] }],
          supportsImageCompression: true,
          cost: { input: 3.0, output: 15.0, cache_read: 0.3 },
          limit: { context: 200000, output: 64000 },
        },
        'claude-3-5-sonnet-20241022': {
          id: 'claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet',
          supportsImageCompression: true,
          cost: { input: 3.0, output: 15.0, cache_read: 0.3 },
          limit: { context: 200000, output: 8192 },
        },
        'claude-fable-5': {
          id: 'claude-fable-5',
          name: 'Claude Fable 5',
          supportsImageCompression: true,
          limit: { context: 200000, output: 8192 },
        },
      },
    });

    map.set('openai', {
      id: 'openai',
      name: 'OpenAI',
      models: {
        'gpt-4o': {
          id: 'gpt-4o',
          name: 'GPT-4o',
          supportsImageCompression: false,
          cost: { input: 2.5, output: 10.0, cache_read: 1.25 },
          limit: { context: 128000, output: 16384 },
        },
        'o3-mini': {
          id: 'o3-mini',
          name: 'o3-mini',
          reasoning: true,
          reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high'] }],
          supportsImageCompression: false,
          cost: { input: 1.1, output: 4.4, cache_read: 0.55 },
          limit: { context: 200000, output: 100000 },
        },
      },
    });

    map.set('google', {
      id: 'google',
      name: 'Google',
      models: {
        'gemini-2.5-pro': {
          id: 'gemini-2.5-pro',
          name: 'Gemini 2.5 Pro',
          supportsImageCompression: false,
          cost: { input: 1.25, output: 10.0 },
          limit: { context: 2000000, output: 65536 },
        },
        'gemini-2.5-flash': {
          id: 'gemini-2.5-flash',
          name: 'Gemini 2.5 Flash',
          supportsImageCompression: false,
          cost: { input: 0.15, output: 0.6 },
          limit: { context: 1000000, output: 65536 },
        },
      },
    });

    map.set('ollama', {
      id: 'ollama',
      name: 'Ollama / Local',
      models: {
        'llama3.3:latest': {
          id: 'llama3.3:latest',
          name: 'Llama 3.3 70B',
          open_weights: true,
          limit: { context: 128000, output: 8192 },
        },
        'deepseek-r1:latest': {
          id: 'deepseek-r1:latest',
          name: 'DeepSeek R1',
          reasoning: true,
          open_weights: true,
          limit: { context: 128000, output: 8192 },
        },
      },
    });

    return map;
  }

  static listProviders(_filter?: string): ProviderDefinition[] {
    return this.getAllProviders();
  }

  static findModel(modelId: string, providerId?: string): ModelDefinition | null {
    return this.getModel(modelId, providerId);
  }
}
