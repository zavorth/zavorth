"use client";

export type ProviderModelSectionRow = {
  modelId: string;
  fullModel: string;
  alias: string | null;
  isHidden: boolean;
};

type ModelAliasesMap = Record<string, string>;

type BuildProviderModelRowsArgs = {
  modelAliases: ModelAliasesMap;
  aliasPrefix: string;
  fullModelPrefix?: string;
  fallbackModels?: Array<{ id?: string | null }>;
  isModelHidden: (modelId: string) => boolean;
};

export function getModelIdFromFullModel(fullModel: string, providerAlias: string): string {
  const prefix = `${providerAlias}/`;
  return fullModel.startsWith(prefix) ? fullModel.slice(prefix.length) : fullModel;
}

export function buildProviderModelRows({
  modelAliases,
  aliasPrefix,
  fullModelPrefix = aliasPrefix,
  fallbackModels = [],
  isModelHidden,
}: BuildProviderModelRowsArgs): ProviderModelSectionRow[] {
  const rows = Object.entries(modelAliases)
    .filter(([, model]) => (model as string).startsWith(`${aliasPrefix}/`))
    .map(([alias, fullModel]) => {
      const fullModelStr = fullModel as string;
      const modelId = getModelIdFromFullModel(fullModelStr, aliasPrefix);
      return {
        modelId,
        fullModel: `${fullModelPrefix}/${modelId}`,
        alias,
        isHidden: isModelHidden(modelId),
      };
    });

  const seenModelIds = new Set(rows.map((row) => row.modelId));
  for (const model of fallbackModels) {
    if (!model?.id || seenModelIds.has(model.id)) continue;
    rows.push({
      modelId: model.id,
      fullModel: `${fullModelPrefix}/${model.id}`,
      alias: null,
      isHidden: isModelHidden(model.id),
    });
    seenModelIds.add(model.id);
  }

  return rows;
}

export function filterProviderModelRows(
  rows: ProviderModelSectionRow[],
  modelFilter: string
): ProviderModelSectionRow[] {
  const query = modelFilter.trim().toLowerCase();
  if (!query) return rows;
  return rows.filter(({ modelId }) => modelId.toLowerCase().includes(query));
}

export function getProviderModelRowCounts(
  rows: ProviderModelSectionRow[],
  filteredRows: ProviderModelSectionRow[] = rows
): {
  activeCount: number;
  hiddenFilteredCount: number;
  visibleFilteredCount: number;
} {
  const activeCount = rows.filter((row) => !row.isHidden).length;
  const hiddenFilteredCount = filteredRows.filter((row) => row.isHidden).length;
  return {
    activeCount,
    hiddenFilteredCount,
    visibleFilteredCount: filteredRows.length - hiddenFilteredCount,
  };
}

export function getDefaultAliasFromModelId(modelId: string): string {
  const parts = modelId.split("/");
  return parts[parts.length - 1];
}
