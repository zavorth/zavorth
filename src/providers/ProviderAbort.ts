import type { ProviderChatOptions } from './ILlmProvider.js';

export function buildProviderRequestOptions(options?: ProviderChatOptions): Record<string, unknown> | undefined {
  return options?.signal ? { signal: options.signal } : undefined;
}

export function isProviderAbortError(error: unknown, signal?: AbortSignal | null): boolean {
  if (signal?.aborted) {
    return true;
  }
  if (!error || typeof error !== 'object') {
    return false;
  }
  const record = error as { name?: unknown; code?: unknown; message?: unknown };
  const name = String(record.name || '');
  const code = String(record.code || '');
  const message = String(record.message || '');
  return name === 'AbortError'
    || code === 'ABORT_ERR'
    || /\baborted\b|\baborterror\b/i.test(message);
}
