/**
 * Map Zavorth ProviderChatOptions.reasoningEffort into provider request bodies.
 */

import type { ProviderChatOptions } from './ILlmProvider.js';

export type OpenAiStyleReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh';

/**
 * Fields suitable for OpenAI-compatible chat.completions (and many aggregators).
 * - reasoning_effort: OpenAI o-series / compatible
 * - Some hosts ignore unknown fields; safe to spread when defined.
 */
export function buildOpenAiReasoningEffortBody(
  options?: ProviderChatOptions | null,
): Record<string, unknown> {
  const effort = normalizeEffort(options?.reasoningEffort);
  if (!effort || effort === 'none') {
    return {};
  }
  // xhigh is Zavorth's extended alias; some models accept it natively
  return {
    reasoning_effort: effort,
  };
}

/**
 * Anthropic-style thinking budget hints (when using extended thinking APIs).
 * Returned as optional metadata; callers attach if the adapter supports thinking.
 */
export function buildAnthropicThinkingHint(
  options?: ProviderChatOptions | null,
): { type: 'enabled'; budget_tokens: number } | null {
  const effort = normalizeEffort(options?.reasoningEffort);
  if (!effort || effort === 'none' || effort === 'low') return null;
  const budget =
    effort === 'medium' ? 4_000
      : effort === 'high' ? 10_000
        : 16_000; // xhigh
  return { type: 'enabled', budget_tokens: budget };
}

export function normalizeEffort(
  value: unknown,
): OpenAiStyleReasoningEffort | null {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  if (raw === 'none' || raw === 'off' || raw === 'minimal') return 'none';
  if (raw === 'low' || raw === 'light') return 'low';
  if (raw === 'medium' || raw === 'standard' || raw === 'mid') return 'medium';
  if (raw === 'high' || raw === 'deep') return 'high';
  if (raw === 'xhigh' || raw === 'max' || raw === 'ultra' || raw === 'ultra-code') return 'xhigh';
  return null;
}
