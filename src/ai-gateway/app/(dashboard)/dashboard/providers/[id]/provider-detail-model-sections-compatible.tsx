"use client";

import { useState, useCallback, useMemo } from "react";
import PropTypes from "prop-types";
import { useNotificationStore } from "@/store/notificationStore";
import { Button } from "@/shared/components";
import { resolveManagedModelAlias } from "@/shared/utils/providerModelAliases";
import {
  buildProviderModelRows,
  filterProviderModelRows,
  getProviderModelRowCounts,
} from "./provider-detail-model-sections-utils";
import {
  ModelVisibilityToolbar,
  PassthroughModelRow,
} from "./provider-detail-model-sections-shared";
import {
  providerText,
} from "./provider-detail-model-compat";

export function CompatibleModelsSection({
  providerStorageAlias,
  providerDisplayAlias,
  modelAliases,
  fallbackModels = [],
  description,
  inputLabel,
  inputPlaceholder,
  copied,
  onCopy,
  onSetAlias,
  onDeleteAlias,
  connections,
  isAnthropic,
  onImportWithProgress,
  t,
  effectiveModelNormalize,
  effectiveModelPreserveDeveloper,
  getUpstreamHeadersRecord,
  saveModelCompatFlags,
  compatSavingModelId,
  onModelsChanged,
  allowImport,
  isModelHidden,
  onToggleHidden,
  onBulkToggleHidden,
  bulkTogglePending,
  togglingModelId,
}: any) {
  const [newModel, setNewModel] = useState("");
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [modelFilter, setModelFilter] = useState("");
  const notify = useNotificationStore();

  const providerAliases = useMemo(
    () =>
      buildProviderModelRows({
        modelAliases,
        aliasPrefix: providerStorageAlias,
        fullModelPrefix: providerDisplayAlias,
        fallbackModels,
        isModelHidden,
      }),
    [fallbackModels, isModelHidden, modelAliases, providerDisplayAlias, providerStorageAlias]
  );

  const filteredModels = useMemo(
    () => filterProviderModelRows(providerAliases, modelFilter),
    [modelFilter, providerAliases]
  );
  const { activeCount, hiddenFilteredCount, visibleFilteredCount } = useMemo(
    () => getProviderModelRowCounts(providerAliases, filteredModels),
    [filteredModels, providerAliases]
  );

  const resolveAlias = useCallback(
    (modelId: string, workingAliases: Record<string, string>) =>
      resolveManagedModelAlias({
        modelId,
        fullModel: `${providerStorageAlias}/${modelId}`,
        providerDisplayAlias,
        existingAliases: workingAliases,
      }),
    [providerDisplayAlias, providerStorageAlias]
  );

  const handleAdd = async () => {
    if (!newModel.trim() || adding) return;
    const modelId = newModel.trim();
    const resolvedAlias = resolveAlias(modelId, modelAliases);
    if (!resolvedAlias) {
      notify.error(t("allSuggestedAliasesExist"));
      return;
    }

    setAdding(true);
    try {
      const customModelRes = await fetch("/api/provider-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerStorageAlias,
          modelId,
          modelName: modelId,
          source: "manual",
        }),
      });

      if (!customModelRes.ok) {
        let errorData: { error?: { message?: string } } = {};
        try {
          errorData = await customModelRes.json();
        } catch (jsonError) {
          console.error("Failed to parse error response from custom model API:", jsonError);
        }
        throw new Error(errorData.error?.message || t("failedSaveCustomModel"));
      }

      await onSetAlias(modelId, resolvedAlias, providerStorageAlias);
      setNewModel("");
      notify.success(t("modelAddedSuccess", { modelId }));
      onModelsChanged?.();
    } catch (error) {
      console.error("Error adding model:", error);
      notify.error(error instanceof Error ? error.message : t("failedAddModelTryAgain"));
    } finally {
      setAdding(false);
    }
  };

  const handleImport = async () => {
    if (!allowImport || importing) return;
    const activeConnection = connections.find((conn) => conn.isActive !== false);
    if (!activeConnection) return;

    setImporting(true);
    try {
      const workingAliases = { ...modelAliases };
      await onImportWithProgress(
        async () => {
          const res = await fetch(`/api/providers/${activeConnection.id}/models`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || t("failedImportModels"));
          return data;
        },
        async (model: any) => {
          const modelId = model.id || model.name || model.model;
          if (!modelId) return false;
          const resolvedAlias = resolveAlias(modelId, workingAliases);
          if (!resolvedAlias) return false;

          const customModelRes = await fetch("/api/provider-models", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: providerStorageAlias,
              modelId,
              modelName: model.name || modelId,
              source: "imported",
            }),
          });

          if (!customModelRes.ok) {
            notify.error(t("failedSaveImportedModel"));
            return false;
          }

          await onSetAlias(modelId, resolvedAlias, providerStorageAlias);
          workingAliases[resolvedAlias] = `${providerStorageAlias}/${modelId}`;
          return true;
        }
      );
    } catch (error) {
      console.error("Error importing models:", error);
      notify.error(t("failedImportModelsTryAgain"));
    } finally {
      setImporting(false);
    }
  };

  const canImport = connections.some((conn) => conn.isActive !== false);

  const handleDeleteModel = async (modelId: string, alias?: string | null) => {
    try {
      const res = await fetch(
        `/api/provider-models?provider=${encodeURIComponent(providerStorageAlias)}&model=${encodeURIComponent(modelId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        throw new Error(t("failedRemoveModelFromDatabase"));
      }
      if (alias) {
        await onDeleteAlias(alias);
      }
      notify.success(t("modelRemovedSuccess"));
      onModelsChanged?.();
    } catch (error) {
      console.error("Error deleting model:", error);
      notify.error(error instanceof Error ? error.message : t("failedDeleteModelTryAgain"));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-muted">{description}</p>

      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <label
            htmlFor="new-compatible-model-input"
            className="text-xs text-text-muted mb-1 block"
          >
            {inputLabel}
          </label>
          <input
            id="new-compatible-model-input"
            type="text"
            value={newModel}
            onChange={(e) => setNewModel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={inputPlaceholder}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-primary"
          />
        </div>
        <Button size="sm" icon="add" onClick={handleAdd} disabled={!newModel.trim() || adding}>
          {adding ? t("adding") : t("add")}
        </Button>
        {allowImport && (
          <Button
            size="sm"
            variant="secondary"
            icon="download"
            onClick={handleImport}
            disabled={!canImport || importing}
          >
            {importing ? t("importingModels") : t("importFromModels")}
          </Button>
        )}
      </div>

      {allowImport && !canImport && (
        <p className="text-xs text-text-muted">{t("addConnectionToImport")}</p>
      )}

      {providerAliases.length > 0 && (
        <div className="flex flex-col gap-3">
          <ModelVisibilityToolbar
            t={t}
            filterValue={modelFilter}
            onFilterChange={setModelFilter}
            activeCount={activeCount}
            totalCount={providerAliases.length}
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
          {filteredModels.map(({ modelId, alias, isHidden, fullModel }) => (
            <PassthroughModelRow
              key={`${providerStorageAlias}:${modelId}`}
              modelId={modelId}
              fullModel={fullModel}
              isHidden={isHidden}
              copied={copied}
              onCopy={onCopy}
              onDeleteAlias={() => handleDeleteModel(modelId, alias)}
              t={t}
              showDeveloperToggle={!isAnthropic}
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

CompatibleModelsSection.propTypes = {
  providerStorageAlias: PropTypes.string.isRequired,
  providerDisplayAlias: PropTypes.string.isRequired,
  modelAliases: PropTypes.object.isRequired,
  fallbackModels: PropTypes.array,
  description: PropTypes.string.isRequired,
  inputLabel: PropTypes.string.isRequired,
  inputPlaceholder: PropTypes.string.isRequired,
  copied: PropTypes.string,
  onCopy: PropTypes.func.isRequired,
  onSetAlias: PropTypes.func.isRequired,
  onDeleteAlias: PropTypes.func.isRequired,
  connections: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      isActive: PropTypes.bool,
    })
  ).isRequired,
  isAnthropic: PropTypes.bool,
  onImportWithProgress: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
  effectiveModelNormalize: PropTypes.func.isRequired,
  effectiveModelPreserveDeveloper: PropTypes.func.isRequired,
  getUpstreamHeadersRecord: PropTypes.func.isRequired,
  saveModelCompatFlags: PropTypes.func.isRequired,
  compatSavingModelId: PropTypes.string,
  onModelsChanged: PropTypes.func,
  allowImport: PropTypes.bool.isRequired,
  isModelHidden: PropTypes.func.isRequired,
  onToggleHidden: PropTypes.func.isRequired,
  onBulkToggleHidden: PropTypes.func.isRequired,
  bulkTogglePending: PropTypes.bool,
  togglingModelId: PropTypes.string,
};
