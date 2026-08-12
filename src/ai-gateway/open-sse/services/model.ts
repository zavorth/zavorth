import { PROVIDER_ID_TO_ALIAS, PROVIDER_MODELS, type ProviderModel } from "../config/providerModels";

export interface ModelInfo {
  provider: string;
  model: string;
  alias?: string;
  providerAlias?: string;
  extendedContext?: number;
  targetFormat: string;
}

export function parseModel(rawModel: string): ModelInfo | null {
  if (!rawModel) return null;
  const slashIdx = rawModel.indexOf("/");
  if (slashIdx >= 0) {
    const provider = rawModel.slice(0, slashIdx);
    const model = rawModel.slice(slashIdx + 1);
    const targetFormat = getModelTargetFormat(provider, model);
    const entry = PROVIDER_MODELS[provider] ?? PROVIDER_MODELS[PROVIDER_ID_TO_ALIAS[provider]];
    const found = entry?.find((m) => m.id === model);
    return {
      provider,
      model,
      providerAlias: PROVIDER_ID_TO_ALIAS[provider] || provider,
      extendedContext: found?.contextLength,
      targetFormat,
    };
  }
  for (const [providerId, models] of Object.entries(PROVIDER_MODELS)) {
    const found = models.find((m) => m.id === rawModel);
    if (found) {
      return {
        provider: providerId,
        model: rawModel,
        providerAlias: PROVIDER_ID_TO_ALIAS[providerId] || providerId,
        extendedContext: found.contextLength,
        targetFormat: found.target ?? "openai",
      };
    }
  }
  return { provider: "openai", model: rawModel, targetFormat: "openai" };
}

export function getModelInfoCore(rawModel: string): ModelInfo | null {
  return parseModel(rawModel);
}

export function resolveModelAliasFromMap(model: string, aliasMap: Record<string, string>): string {
  return aliasMap[model] ?? model;
}

function getModelTargetFormat(provider: string, model: string): string {
  const models = PROVIDER_MODELS[provider] ?? PROVIDER_MODELS[PROVIDER_ID_TO_ALIAS[provider]];
  const entry = models?.find((m) => m.id === model);
  return entry?.target ?? "openai";
}
