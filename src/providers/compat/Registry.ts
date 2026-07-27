import type { CompatLayer } from './types.js';

const registry = new Map<string, CompatLayer>();

export function registerCompat(providerId: string, compat: CompatLayer): void {
  registry.set(providerId, compat);
}

export function getCompat(providerId: string): CompatLayer | undefined {
  return registry.get(providerId);
}
