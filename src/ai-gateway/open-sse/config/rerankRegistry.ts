export interface RerankModelEntry {
  id: string;
  provider: string;
}

const RERANK_MODELS: RerankModelEntry[] = [
  { id: "rerank-english-v3.0", provider: "cohere" },
  { id: "rerank-multilingual-v3.0", provider: "cohere" },
  { id: "text-rerank-001", provider: "google" },
];

export function parseRerankModel(model: string): { provider: string; model: string } {
  const slashIdx = model.indexOf("/");
  if (slashIdx >= 0) {
    return { provider: model.slice(0, slashIdx), model: model.slice(slashIdx + 1) };
  }
  const fallback = getRerankProvider(model);
  return { provider: fallback, model };
}

export function getRerankProvider(model: string): string {
  const entry = RERANK_MODELS.find((item) => item.id === model);
  return entry?.provider ?? "cohere";
}

export function getAllRerankModels(): RerankModelEntry[] {
  return [...RERANK_MODELS];
}
