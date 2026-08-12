export interface FallbackDecision {
  provider: string;
  model: string;
  reason: string;
  maxOutputTokens: number;
  isFallback: true;
}

const FALLBACK_PROVIDER = "nvidia";
const FALLBACK_MODEL = "openai/gpt-oss-120b";
const FALLBACK_MAX_OUTPUT_TOKENS = 8192;

const BUDGET_KEYWORDS = [
  "402",
  "payment required",
  "billing",
  "quota exhausted",
  "insufficient balance",
  "out of quota",
  "rate limit exceeded",
  "usage limit",
  "credit limit",
  "no credits",
];

export function isFallbackDecision(value: unknown): value is FallbackDecision {
  return (
    typeof value === "object" &&
    value !== null &&
    "isFallback" in value &&
    (value as Record<string, unknown>).isFallback === true &&
    "provider" in value &&
    "model" in value &&
    "reason" in value
  );
}

export function shouldUseFallback(
  status: number,
  message: string,
  hasTools: boolean
): FallbackDecision | null {
  if (hasTools) return null;
  if (status === 402) {
    return {
      provider: FALLBACK_PROVIDER,
      model: FALLBACK_MODEL,
      reason: "Payment required",
      maxOutputTokens: FALLBACK_MAX_OUTPUT_TOKENS,
      isFallback: true,
    };
  }
  const normalized = (message || "").toLowerCase();
  const hit = BUDGET_KEYWORDS.find((keyword) => normalized.includes(keyword));
  if (hit) {
    return {
      provider: FALLBACK_PROVIDER,
      model: FALLBACK_MODEL,
      reason: `Budget exhaustion signal: ${hit}`,
      maxOutputTokens: FALLBACK_MAX_OUTPUT_TOKENS,
      isFallback: true,
    };
  }
  return null;
}
