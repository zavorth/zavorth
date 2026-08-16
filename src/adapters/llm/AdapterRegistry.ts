/**
 * Zavorth LLM Adapter Registry.
 * Centralized dependency-injected registry for dynamic adapter resolution.
 */

import { LLMAdapter } from './LLMAdapter.js';

export class AdapterRegistry {
  private readonly adapters = new Map<string, LLMAdapter>();
  private defaultAdapterName: string = 'openai';

  public register(adapter: LLMAdapter, isDefault: boolean = false): this {
    this.adapters.set(adapter.name.toLowerCase(), adapter);
    if (isDefault) {
      this.defaultAdapterName = adapter.name.toLowerCase();
    }
    return this;
  }

  public get(name: string): LLMAdapter {
    const normalized = name.toLowerCase();
    const adapter = this.adapters.get(normalized);
    if (!adapter) {
      throw new Error(`LLM Adapter "${name}" is not registered in AdapterRegistry. Available: ${this.listNames().join(', ')}`);
    }
    return adapter;
  }

  public has(name: string): boolean {
    return this.adapters.has(name.toLowerCase());
  }

  public setDefault(name: string): this {
    if (!this.has(name)) {
      throw new Error(`Cannot set default adapter "${name}": not registered.`);
    }
    this.defaultAdapterName = name.toLowerCase();
    return this;
  }

  public getDefault(): LLMAdapter {
    if (!this.has(this.defaultAdapterName)) {
      const first = this.adapters.values().next().value;
      if (!first) {
        throw new Error('No LLM adapters are registered in AdapterRegistry.');
      }
      return first;
    }
    return this.get(this.defaultAdapterName);
  }

  public list(): LLMAdapter[] {
    return Array.from(this.adapters.values());
  }

  public listNames(): string[] {
    return Array.from(this.adapters.keys());
  }
}
