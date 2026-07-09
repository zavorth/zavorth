/**
 * Pure context-window meter for the composer (token estimate + level).
 */

export type ContextMeterLevel = 'ok' | 'warn' | 'critical';

export type ContextMeter = {
  usedTokens: number;
  limitTokens: number;
  ratio: number; // 0-1
  level: ContextMeterLevel;
  label: string; // e.g. "12k / 128k"
};

export const DEFAULT_CONTEXT_LIMIT_TOKENS = 128_000;
export const CONTEXT_WARN_RATIO = 0.7;
export const CONTEXT_CRITICAL_RATIO = 0.9;

/** Rough token estimate: ~4 characters per token. */
export function estimateTokensFromText(text: string): number {
  if (!text) return 0;
  return Math.ceil(String(text).length / 4);
}

/** Compact k-unit formatting for token counts (e.g. 12000 → "12k"). */
export function formatTokenCount(tokens: number): string {
  const n = Math.max(0, Math.round(tokens));
  if (n < 1000) return String(n);
  const k = n / 1000;
  if (k >= 10) return `${Math.round(k)}k`;
  // 1.0k – 9.9k: one decimal when needed
  const one = Math.round(k * 10) / 10;
  if (Number.isInteger(one)) return `${one}k`;
  return `${one.toFixed(1)}k`;
}

function resolveLevel(ratio: number): ContextMeterLevel {
  if (ratio < CONTEXT_WARN_RATIO) return 'ok';
  if (ratio < CONTEXT_CRITICAL_RATIO) return 'warn';
  return 'critical';
}

export function buildContextMeter(input: {
  messages: Array<{ content?: string }>;
  systemBudget?: number;
  limitTokens?: number;
  toolPayloadChars?: number;
}): ContextMeter {
  const limitTokens = Math.max(1, input.limitTokens ?? DEFAULT_CONTEXT_LIMIT_TOKENS);
  const systemBudget = Math.max(0, input.systemBudget ?? 0);
  const toolPayloadChars = Math.max(0, input.toolPayloadChars ?? 0);

  let messageChars = 0;
  for (const msg of input.messages ?? []) {
    if (msg && typeof msg.content === 'string') {
      messageChars += msg.content.length;
    }
  }

  const fromMessages = messageChars > 0 ? Math.ceil(messageChars / 4) : 0;
  const fromTools = toolPayloadChars > 0 ? Math.ceil(toolPayloadChars / 4) : 0;
  const usedTokens = fromMessages + fromTools + systemBudget;

  const rawRatio = usedTokens / limitTokens;
  const ratio = Math.min(1, Math.max(0, rawRatio));
  const level = resolveLevel(rawRatio);

  return {
    usedTokens,
    limitTokens,
    ratio,
    level,
    label: `${formatTokenCount(usedTokens)} / ${formatTokenCount(limitTokens)}`,
  };
}
