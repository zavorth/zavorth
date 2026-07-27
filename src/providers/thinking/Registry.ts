import { ThinkingAdapter } from './types.js';

const registry = new Map<string, ThinkingAdapter>();

export function registerThinking(providerId: string, adapter: ThinkingAdapter): void {
  registry.set(providerId, adapter);
}

export function getThinking(providerId: string): ThinkingAdapter | undefined {
  return registry.get(providerId);
}
