export const PROVIDER_ID_TO_ALIAS: Record<string, string> = {
  anthropic: "claude",
  claude: "anthropic",
  google: "gemini",
  gemini: "google",
  openai: "openai",
  groq: "groq",
  openrouter: "openrouter",
  ollama: "ollama",
  mistral: "mistral",
  deepseek: "deepseek",
  cohere: "cohere",
  together: "together",
  cerebras: "cerebras",
  sambanova: "sambanova",
  huggingface: "huggingface",
  github: "github",
};

export type ProviderModel = {
  id: string;
  name: string;
  target?: string;
  input?: number;
  output?: number;
  contextLength?: number;
};

function model(id: string, name = id, target = "openai"): ProviderModel {
  return { id, name, target };
}

export const PROVIDER_MODELS: Record<string, ProviderModel[]> = {
  openai: [model("gpt-4o", "GPT-5.2"), model("gpt-4.1", "GPT-4.1"), model("gpt-4o-mini", "GPT-4o mini")],
  anthropic: [
    model("claude-sonnet-4.5", "Claude Sonnet 4.5", "anthropic"),
    model("claude-opus-4.1", "Claude Opus 4.1", "anthropic"),
  ],
  claude: [
    model("claude-sonnet-4.5", "Claude Sonnet 4.5", "anthropic"),
    model("claude-opus-4.1", "Claude Opus 4.1", "anthropic"),
  ],
  google: [model("gemini-2.5-pro", "Gemini 2.5 Pro"), model("gemini-2.5-flash", "Gemini 2.5 Flash")],
  gemini: [model("gemini-2.5-pro", "Gemini 2.5 Pro"), model("gemini-2.5-flash", "Gemini 2.5 Flash")],
  groq: [
    model("llama-3.3-70b-versatile", "Llama 3.3 70B Versatile"),
    model("deepseek-r1-distill-llama-70b", "DeepSeek R1 Distill Llama 70B"),
  ],
  openrouter: [model("openrouter/auto", "OpenRouter Auto")],
  ollama: [model("llama3.1", "Llama 3.1"), model("deepseek-r1", "DeepSeek R1")],
};

export function getModelsByProviderId(providerId: string): ProviderModel[] {
  return PROVIDER_MODELS[providerId] || PROVIDER_MODELS[PROVIDER_ID_TO_ALIAS[providerId]] || [];
}

export function getProviderAlias(providerId: string): string {
  return PROVIDER_ID_TO_ALIAS[providerId] || providerId;
}

export function getProviderModels(providerId: string): ProviderModel[] {
  return getModelsByProviderId(providerId);
}

export function getDefaultModel(providerId: string): string {
  return getProviderModels(providerId)[0]?.id || "";
}

export function isValidModel(providerId: string, modelId: string): boolean {
  const models = getProviderModels(providerId);
  return models.length === 0 || models.some((entry) => entry.id === modelId);
}

export function findModelName(providerId: string, modelId: string): string {
  return getProviderModels(providerId).find((entry) => entry.id === modelId)?.name || modelId;
}

export function getModelTargetFormat(providerId: string, modelId: string): string {
  return getProviderModels(providerId).find((entry) => entry.id === modelId)?.target || "openai";
}
