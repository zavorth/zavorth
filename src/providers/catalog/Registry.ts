import { ModelCatalog } from './types.js';

const registry = new Map<string, ModelCatalog>();

export function registerCatalog(providerId: string, catalog: ModelCatalog): void {
  registry.set(providerId, catalog);
}

export function getCatalog(providerId: string): ModelCatalog | undefined {
  return registry.get(providerId);
}

export function listCatalogs(): Array<{ providerId: string; catalog: ModelCatalog }> {
  return Array.from(registry.entries()).map(([providerId, catalog]) => ({ providerId, catalog }));
}
