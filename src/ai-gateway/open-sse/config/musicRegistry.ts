export interface MusicModelEntry {
  id: string;
  name: string;
  provider: string;
}

export interface MusicProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  authType: string;
  authHeader: string;
  models: MusicModelEntry[];
}

const MUSIC_MODELS: MusicModelEntry[] = [
  { id: "suno-v4", name: "Suno v4", provider: "suno" },
  { id: "udio-1.5", name: "Udio 1.5", provider: "udio" },
];

export function getAllMusicModels(): MusicModelEntry[] {
  return [...MUSIC_MODELS];
}

export function parseMusicModel(model: string): { provider: string | null; model: string } {
  const slashIdx = model.indexOf("/");
  if (slashIdx >= 0) {
    return { provider: model.slice(0, slashIdx), model: model.slice(slashIdx + 1) };
  }
  const entry = MUSIC_MODELS.find((item) => item.id === model);
  return { provider: entry?.provider ?? null, model };
}

export function getMusicProvider(providerId: string): MusicProviderConfig | undefined {
  const models = MUSIC_MODELS.filter((m) => m.provider === providerId);
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
