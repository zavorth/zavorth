export interface ImageModelEntry {
  id: string;
  name: string;
  provider: string;
  supportedSizes?: string[];
}

export interface ImageProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  authType: string;
  authHeader: string;
  models: ImageModelEntry[];
}

const IMAGE_MODELS: ImageModelEntry[] = [
  { id: "dall-e-3", name: "DALL-E 3", provider: "openai", supportedSizes: ["1024x1024", "1792x1024", "1024x1792"] },
  { id: "dall-e-2", name: "DALL-E 2", provider: "openai", supportedSizes: ["1024x1024", "512x512", "256x256"] },
  { id: "gpt-image-1", name: "GPT Image 1", provider: "openai", supportedSizes: ["1024x1024", "1536x1024", "1024x1536"] },
  { id: "imagen-3.0-generate-002", name: "Imagen 3", provider: "google", supportedSizes: ["1024x1024"] },
  { id: "stable-diffusion-xl", name: "Stable Diffusion XL", provider: "stability", supportedSizes: ["1024x1024"] },
];

export function getAllImageModels(): ImageModelEntry[] {
  return [...IMAGE_MODELS];
}

export function parseImageModel(model: string): { provider: string | null; model: string } {
  const slashIdx = model.indexOf("/");
  if (slashIdx >= 0) {
    return { provider: model.slice(0, slashIdx), model: model.slice(slashIdx + 1) };
  }
  const entry = IMAGE_MODELS.find((item) => item.id === model);
  return { provider: entry?.provider ?? null, model };
}

export function getImageProvider(providerId: string): ImageProviderConfig | undefined {
  const models = IMAGE_MODELS.filter((m) => m.provider === providerId);
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
