"use client";

import { useState } from "react";
import PropTypes from "prop-types";
import { Button } from "@/shared/components";
import {
  buildProviderModelRows,
  filterProviderModelRows,
  getDefaultAliasFromModelId,
  getProviderModelRowCounts,
} from "./provider-detail-model-sections-utils";
import {
  ModelVisibilityToolbar,
  PassthroughModelRow,
} from "./provider-detail-model-sections-shared";
import { providerText } from "./provider-detail-model-compat";

export function PassthroughModelsSection({
  providerAlias,
  modelAliases,
  copied,
  onCopy,
  onSetAlias,
  onDeleteAlias,
  t,
  effectiveModelNormalize,
  effectiveModelPreserveDeveloper,
  getUpstreamHeadersRecord,
  saveModelCompatFlags,
  compatSavingModelId,
  isModelHidden,
  onToggleHidden,
  onBulkToggleHidden,
  bulkTogglePending,
  togglingModelId,
}: any) {
  const [newModel, setNewModel] = useState("");
  const [adding, setAdding] = useState(false);
  const [modelFilter, setModelFilter] = useState("");

  const allModels = buildProviderModelRows({
    modelAliases,
    aliasPrefix: providerAlias,
    isModelHidden,
  });
  const filteredModels = filterProviderModelRows(allModels, modelFilter);
  const { activeCount, hiddenFilteredCount, visibleFilteredCount } = getProviderModelRowCounts(
    allModels,
    filteredModels
  );

  const handleAdd = async () => {
    if (!newModel.trim() || adding) return;
    const modelId = newModel.trim();
    const defaultAlias = getDefaultAliasFromModelId(modelId);

    if (modelAliases[defaultAlias]) {
      alert(t("aliasExistsAlert", { alias: defaultAlias }));
      return;
    }

    setAdding(true);
    try {
      await onSetAlias(modelId, defaultAlias);
      setNewModel("");
    } catch (error) {
      console.log("Error adding model:", error);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">{t("openRouterAnyModelHint")}</p>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="new-model-input" className="text-xs text-text-muted mb-1 block">
            {t("modelIdFromOpenRouter")}
          </label>
          <input
            id="new-model-input"
            type="text"
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={t("openRouterModelPlaceholder")}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
          />
        </div>
        <Button size="sm" icon="add" onClick={handleAdd} disabled={!newModel.trim() || adding}>
          {adding ? t("adding") : t("add")}
        </Button>
      </div>

      {allModels.length > 0 && (
        <div className="flex flex-col gap-3">
          <ModelVisibilityToolbar
            t={t}
            filterValue={modelFilter}
            onFilterChange={setModelFilter}
            activeCount={activeCount}
            totalCount={allModels.length}
            onSelectAll={() =>
              onBulkToggleHidden(
                filteredModels.map((model) => model.modelId),
                false
              )
            }
            onDeselectAll={() =>
              onBulkToggleHidden(
                filteredModels.map((model) => model.modelId),
                true
              )
            }
            selectAllDisabled={hiddenFilteredCount === 0 || bulkTogglePending}
            deselectAllDisabled={visibleFilteredCount === 0 || bulkTogglePending}
          />
          {filteredModels.map(({ modelId, fullModel, alias, isHidden }) => (
            <PassthroughModelRow
              key={fullModel as string}
              modelId={modelId}
              fullModel={fullModel}
              isHidden={isHidden}
              copied={copied}
              onCopy={onCopy}
              onDeleteAlias={() => onDeleteAlias(alias)}
              t={t}
              showDeveloperToggle
              effectiveModelNormalize={effectiveModelNormalize}
              effectiveModelPreserveDeveloper={effectiveModelPreserveDeveloper}
              getUpstreamHeadersRecord={(p) => getUpstreamHeadersRecord(modelId, p)}
              saveModelCompatFlags={saveModelCompatFlags}
              compatDisabled={compatSavingModelId === modelId}
              onToggleHidden={onToggleHidden}
              togglingHidden={togglingModelId === modelId}
            />
          ))}
          {filteredModels.length === 0 && modelFilter && (
            <p className="py-2 text-sm text-text-muted">
              {providerText(t, "noModelsMatch", `No models match "${modelFilter}"`, {
                filter: modelFilter,
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

PassthroughModelsSection.propTypes = {
  providerAlias: PropTypes.string.isRequired,
  modelAliases: PropTypes.object.isRequired,
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
  onSetAlias: PropTypes.func.isRequired,
  onDeleteAlias: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
  effectiveModelNormalize: PropTypes.func.isRequired,
  effectiveModelPreserveDeveloper: PropTypes.func.isRequired,
  getUpstreamHeadersRecord: PropTypes.func.isRequired,
  saveModelCompatFlags: PropTypes.func.isRequired,
  compatSavingModelId: PropTypes.string,
  isModelHidden: PropTypes.func.isRequired,
  onToggleHidden: PropTypes.func.isRequired,
  onBulkToggleHidden: PropTypes.func.isRequired,
  bulkTogglePending: PropTypes.bool,
  togglingModelId: PropTypes.string,
};
