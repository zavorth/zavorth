export const FREE_STACK_PRESET_MODELS = [
  { model: "gemini-cli/gemini-3-flash-preview", weight: 0 },
  { model: "kr/claude-sonnet-4.5", weight: 0 },
  { model: "if/kimi-k2-thinking", weight: 0 },
  { model: "if/qwen3-coder-plus", weight: 0 },
  { model: "if/deepseek-v3.2", weight: 0 },
  { model: "nvidia/llama-3.3-70b-instruct", weight: 0 },
  { model: "groq/llama-3.3-70b-versatile", weight: 0 },
];

export const PAID_PREMIUM_PRESET_MODELS = [
  { model: "cu/claude-4.6-opus-high", weight: 0 },
  { model: "zavorthBridge/claude-sonnet-4-6", weight: 0 },
  { model: "cu/claude-4.6-sonnet-high", weight: 0 },
  { model: "zavorthBridge/gemini-2.5-pro", weight: 0 },
  { model: "zavorthBridge/gemini-3-pro-high", weight: 0 },
];

export const COMBO_FORM_STRATEGY_DEFAULTS = {
  priority: { maxRetries: 2, retryDelayMs: 1500, healthCheckEnabled: true },
  weighted: { maxRetries: 1, retryDelayMs: 1000, healthCheckEnabled: true },
  "round-robin": {
    maxRetries: 1,
    retryDelayMs: 750,
    healthCheckEnabled: true,
    concurrencyPerModel: 3,
    queueTimeoutMs: 30000,
  },
  "context-relay": {
    maxRetries: 1,
    retryDelayMs: 750,
    healthCheckEnabled: true,
    handoffThreshold: 0.85,
    maxMessagesForSummary: 30,
  },
  random: { maxRetries: 1, retryDelayMs: 1000, healthCheckEnabled: true },
  "least-used": { maxRetries: 1, retryDelayMs: 1000, healthCheckEnabled: true },
  "cost-optimized": { maxRetries: 1, retryDelayMs: 500, healthCheckEnabled: true },
} as const;
