/**
 * Dynamic Model Catalog Service.
 * Data-driven model registry loading schema definitions across 180+ providers.
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
            this.cachedProviders = providersMap;
            return providersMap;
          }
        } catch {
          // Graceful fallback to next path
        }
      }
    }

    // 2. Default standard catalog if cache is empty
    this.cachedProviders = this.buildDefaultFallbackCatalog();
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
          cost: { input: 3.0, output: 15.0, cache_read: 0.3 },
          limit: { context: 200000, output: 64000 },
        },
        'claude-3-5-sonnet-20241022': {
          id: 'claude-3-5-sonnet-20241022',
          name: 'Claude 3.5 Sonnet',
          cost: { input: 3.0, output: 15.0, cache_read: 0.3 },
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
          cost: { input: 2.5, output: 10.0, cache_read: 1.25 },
          limit: { context: 128000, output: 16384 },
        },
        'o3-mini': {
          id: 'o3-mini',
          name: 'o3-mini',
          reasoning: true,
          reasoning_options: [{ type: 'effort', values: ['low', 'medium', 'high'] }],
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
          cost: { input: 1.25, output: 10.0 },
          limit: { context: 2000000, output: 65536 },
        },
        'gemini-2.5-flash': {
          id: 'gemini-2.5-flash',
          name: 'Gemini 2.5 Flash',
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
}
