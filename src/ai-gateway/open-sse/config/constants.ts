export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  RATE_LIMITED: 429,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export const COOLDOWN_MS = {
  rateLimit: 60_000,
  auth: 120_000,
  notFoundLocal: 30_000,
} as const;

export const DEFAULT_API_LIMITS = {
  maxTokens: 128_000,
  maxOutputTokens: 16_384,
  defaultTemperature: 0.7,
} as const;

export type ProviderProfile = {
  maxTokens: number;
  maxOutputTokens: number;
  defaultTemperature: number;
};

export const PROVIDER_PROFILES: Record<string, ProviderProfile> = {
  openai: { maxTokens: 128_000, maxOutputTokens: 16_384, defaultTemperature: 0.7 },
  anthropic: { maxTokens: 200_000, maxOutputTokens: 16_384, defaultTemperature: 0.7 },
  claude: { maxTokens: 200_000, maxOutputTokens: 16_384, defaultTemperature: 0.7 },
  google: { maxTokens: 2_097_152, maxOutputTokens: 8_192, defaultTemperature: 0.7 },
  gemini: { maxTokens: 2_097_152, maxOutputTokens: 8_192, defaultTemperature: 0.7 },
  groq: { maxTokens: 8_192, maxOutputTokens: 8_192, defaultTemperature: 0.7 },
  openrouter: { maxTokens: 128_000, maxOutputTokens: 16_384, defaultTemperature: 0.7 },
  ollama: { maxTokens: 32_000, maxOutputTokens: 8_192, defaultTemperature: 0.7 },
  mistral: { maxTokens: 32_000, maxOutputTokens: 8_192, defaultTemperature: 0.7 },
  deepseek: { maxTokens: 64_000, maxOutputTokens: 8_192, defaultTemperature: 0.7 },
  cohere: { maxTokens: 128_000, maxOutputTokens: 4_096, defaultTemperature: 0.7 },
  together: { maxTokens: 128_000, maxOutputTokens: 16_384, defaultTemperature: 0.7 },
  cerebras: { maxTokens: 8_192, maxOutputTokens: 4_096, defaultTemperature: 0.7 },
  sambanova: { maxTokens: 8_192, maxOutputTokens: 4_096, defaultTemperature: 0.7 },
  huggingface: { maxTokens: 4_096, maxOutputTokens: 4_096, defaultTemperature: 0.7 },
  github: { maxTokens: 128_000, maxOutputTokens: 16_384, defaultTemperature: 0.7 },
};
