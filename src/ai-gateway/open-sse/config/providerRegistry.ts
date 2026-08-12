export interface ProviderRegistryEntry {
  id: string;
  name: string;
  enabled: boolean;
  type: string;
  baseUrl?: string;
  alias?: string;
  authType?: string;
  format?: string;
  models?: Array<{ id: string; name?: string }>;
  testKeyBaseUrl?: string;
  defaultContextLength?: number;
  headers?: Record<string, string>;
  authHeader?: string;
  urlSuffix?: string;
  modelsUrl?: string;
}

export const REGISTRY: Record<string, ProviderRegistryEntry> = {
  openai: { id: "openai", name: "OpenAI", enabled: true, type: "openai", baseUrl: "https://api.openai.com/v1" },
  anthropic: { id: "anthropic", name: "Anthropic", enabled: true, type: "anthropic", baseUrl: "https://api.anthropic.com" },
  claude: { id: "claude", name: "Claude (Anthropic)", enabled: true, type: "anthropic", baseUrl: "https://api.anthropic.com" },
  google: { id: "google", name: "Google AI", enabled: true, type: "google", baseUrl: "https://generativelanguage.googleapis.com" },
  gemini: { id: "gemini", name: "Gemini (Google)", enabled: true, type: "google", baseUrl: "https://generativelanguage.googleapis.com" },
  groq: { id: "groq", name: "Groq", enabled: true, type: "openai", baseUrl: "https://api.groq.com/openai/v1" },
  openrouter: { id: "openrouter", name: "OpenRouter", enabled: true, type: "openai", baseUrl: "https://openrouter.ai/api/v1" },
  ollama: { id: "ollama", name: "Ollama (local)", enabled: true, type: "ollama", baseUrl: "http://localhost:11434" },
  mistral: { id: "mistral", name: "Mistral", enabled: true, type: "openai", baseUrl: "https://api.mistral.ai/v1" },
  deepseek: { id: "deepseek", name: "DeepSeek", enabled: true, type: "openai", baseUrl: "https://api.deepseek.com/v1" },
  cohere: { id: "cohere", name: "Cohere", enabled: true, type: "cohere", baseUrl: "https://api.cohere.ai" },
  together: { id: "together", name: "Together AI", enabled: true, type: "openai", baseUrl: "https://api.together.xyz/v1" },
  cerebras: { id: "cerebras", name: "Cerebras", enabled: true, type: "openai", baseUrl: "https://api.cerebras.ai/v1" },
  sambanova: { id: "sambanova", name: "SambaNova", enabled: true, type: "openai", baseUrl: "https://api.sambanova.ai/v1" },
  huggingface: { id: "huggingface", name: "HuggingFace", enabled: true, type: "huggingface", baseUrl: "https://api-inference.huggingface.co" },
  github: { id: "github", name: "GitHub Models", enabled: true, type: "openai", baseUrl: "https://models.inference.ai.azure.com" },
};

export function getPassthroughProviders(): Set<string> {
  return new Set(
    Object.values(REGISTRY)
      .filter((entry) => entry.enabled && entry.type === "ollama")
      .map((entry) => entry.id)
  );
}

export function isLocalProvider(providerId: string | undefined): boolean {
  const entry = providerId ? REGISTRY[providerId] : undefined;
  return Boolean(entry?.baseUrl?.includes("localhost") || entry?.baseUrl?.includes("127.0.0.1"));
}

export function getRegistryEntry(
  providerId: string
): ProviderRegistryEntry | undefined {
  return REGISTRY[providerId];
}
