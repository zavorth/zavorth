export interface EmbeddingModelEntry {
  id: string;
  name: string;
  provider: string;
  dimensions: number;
}

export interface EmbeddingProviderNodeRow {
  prefix: string;
  baseUrl: string;
  apiType?: string;
  id?: string;
  [key: string]: unknown;
}

export interface EmbeddingProvider {
  id: string;
  name: string;
  baseUrl: string;
  authType: string;
  authHeader: string;
  models: EmbeddingModelEntry[];
  providerId?: string;
}

const EMBEDDING_MODELS: EmbeddingModelEntry[] = [
  { id: "text-embedding-3-large", name: "OpenAI Embedding 3 Large", provider: "openai", dimensions: 3072 },
  { id: "text-embedding-3-small", name: "OpenAI Embedding 3 Small", provider: "openai", dimensions: 1536 },
  { id: "text-embedding-ada-002", name: "OpenAI Ada 002", provider: "openai", dimensions: 1536 },
  { id: "embedding-001", name: "Google Embedding 001", provider: "google", dimensions: 768 },
];

const OPENAI_BASE = "https://api.openai.com/v1";
const GOOGLE_BASE = "https://generativelanguage.googleapis.com";

export function getAllEmbeddingModels(): EmbeddingModelEntry[] {
  return [...EMBEDDING_MODELS];
}

export function buildDynamicEmbeddingProvider(node: EmbeddingProviderNodeRow): EmbeddingProvider {
  const base = String(node.baseUrl || "").replace(/\/+$/, "");
  return {
    id: node.prefix,
    name: node.prefix,
    baseUrl: `${base}/embeddings`,
    authType: "apikey",
    authHeader: "bearer",
    models: [],
    providerId: node.id,
  };
}

export function parseEmbeddingModel(
  model: string,
  dynamicProviders: EmbeddingProvider[] = []
): { provider: string | null; model: string } {
  const slashIdx = model.indexOf("/");
  if (slashIdx >= 0) {
    return { provider: model.slice(0, slashIdx), model: model.slice(slashIdx + 1) };
  }
  const entry = EMBEDDING_MODELS.find((item) => item.id === model);
  if (entry) return { provider: entry.provider, model };
  const dynamic = dynamicProviders.find((p) => p.models.some((m) => m.id === model));
  return { provider: dynamic?.id ?? null, model };
}

export function getEmbeddingProvider(providerId: string): EmbeddingProvider | undefined {
  const models = EMBEDDING_MODELS.filter((m) => m.provider === providerId);
  if (models.length === 0) return undefined;
  const baseUrl = providerId === "google" ? GOOGLE_BASE : OPENAI_BASE;
  return {
    id: providerId,
    name: providerId,
    baseUrl: `${baseUrl}/embeddings`,
    authType: "apikey",
    authHeader: "bearer",
    models,
  };
}
