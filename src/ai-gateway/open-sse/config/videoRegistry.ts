export interface VideoModelEntry {
  id: string;
  name: string;
  provider: string;
}

export interface VideoProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  authType: string;
  authHeader: string;
  models: VideoModelEntry[];
}

const VIDEO_MODELS: VideoModelEntry[] = [
  { id: "sora", name: "Sora", provider: "openai" },
  { id: "kling-v1", name: "Kling v1", provider: "kling" },
  { id: "runway-gen-3", name: "Runway Gen-3", provider: "runway" },
];

export function getAllVideoModels(): VideoModelEntry[] {
  return [...VIDEO_MODELS];
}

export function parseVideoModel(model: string): { provider: string | null; model: string } {
  const slashIdx = model.indexOf("/");
  if (slashIdx >= 0) {
    return { provider: model.slice(0, slashIdx), model: model.slice(slashIdx + 1) };
  }
  const entry = VIDEO_MODELS.find((item) => item.id === model);
  return { provider: entry?.provider ?? null, model };
}

export function getVideoProvider(providerId: string): VideoProviderConfig | undefined {
  const models = VIDEO_MODELS.filter((m) => m.provider === providerId);
  if (models.length === 0) return undefined;
  return {
    id: providerId,
    name: providerId,
    baseUrl: "",
    authType: "apikey",
    authHeader: "bearer",
    models,
  };
}
