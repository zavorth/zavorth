/**
 * Universal LLM Adapter Registry.
 * Manages dynamically registered LLM adapters with model resolution and fallback resolution.
 */

import type { LLMAdapter } from './LLMAdapterContract.js';
import { DynamicModelCatalogService } from '../../services/providers/catalog/DynamicModelCatalogService.js';

export class AdapterRegistry {
  private readonly adapters = new Map<string, LLMAdapter>();
  private defaultAdapterId: string | null = null;

  /**
   * Registers a new LLM adapter.
   */
  public register(adapter: LLMAdapter, isDefault = false): void {
    this.adapters.set(adapter.id.toLowerCase(), adapter);
    if (isDefault || !this.defaultAdapterId) {
      this.defaultAdapterId = adapter.id.toLowerCase();
    }
  }

  /**
   * Retrieves an adapter by its ID.
   */
  public get(id: string): LLMAdapter | null {
    return this.adapters.get(id.toLowerCase()) || null;
  }

  /**
   * Checks if an adapter is registered.
   */
  public has(id: string): boolean {
    return this.adapters.has(id.toLowerCase());
  }

  /**
   * Lists all registered adapters.
   */
  public list(): LLMAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Gets the default adapter.
   */
  public getDefault(): LLMAdapter | null {
    if (!this.defaultAdapterId) return null;
    return this.adapters.get(this.defaultAdapterId) || null;
  }

  /**
   * Sets the default adapter ID.
   */
  public setDefault(id: string): void {
    if (this.adapters.has(id.toLowerCase())) {
      this.defaultAdapterId = id.toLowerCase();
    }
  }

  /**
   * Resolves the best matching adapter for a given model identifier or provider hint.
   * Resolution is data-driven: explicit provider hint first, then the model catalog,
   * then a generic openai-compatible adapter. No vendor-name keyword heuristics.
   */
  public resolveAdapterForModel(modelId: string, providerHint?: string): LLMAdapter | null {
    const hint = providerHint?.toLowerCase();
    if (hint && this.adapters.has(hint)) {
      return this.adapters.get(hint)!;
    }

    const modelDef = DynamicModelCatalogService.findModel(modelId);
    if (modelDef?.providerId) {
      const providerId = modelDef.providerId.toLowerCase();
      if (this.adapters.has(providerId)) {
        return this.adapters.get(providerId)!;
      }
    }

    if (this.adapters.has('openai-compatible')) {
      return this.adapters.get('openai-compatible')!;
    }

    return this.getDefault();
  }

  /**
   * Clears all registered adapters (for testing).
   */
  public clear(): void {
    this.adapters.clear();
    this.defaultAdapterId = null;
  }
}
