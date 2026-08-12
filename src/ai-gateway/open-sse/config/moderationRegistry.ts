export interface ModerationModelEntry {
  id: string;
  provider: string;
}

const MODERATION_MODELS: ModerationModelEntry[] = [
  { id: "text-moderation-latest", provider: "openai" },
  { id: "omni-moderation-latest", provider: "openai" },
];

export function parseModerationModel(model: string): { provider: string; model: string } {
  const slashIdx = model.indexOf("/");
  if (slashIdx >= 0) {
    return { provider: model.slice(0, slashIdx), model: model.slice(slashIdx + 1) };
  }
  const entry = MODERATION_MODELS.find((item) => item.id === model);
  return { provider: entry?.provider ?? "openai", model };
}

export function getAllModerationModels(): ModerationModelEntry[] {
  return [...MODERATION_MODELS];
}
