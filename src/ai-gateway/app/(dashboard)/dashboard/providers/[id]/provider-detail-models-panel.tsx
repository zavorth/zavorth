"use client";

import { useCallback, useMemo } from "react";
import { useNotificationStore } from "@/store/notificationStore";
import { Button } from "@/shared/components";
import { getCompatibleFallbackModels } from "@/lib/providers/managedAvailableModels";
import { MODEL_COMPAT_PROTOCOL_KEYS } from "@/shared/constants/modelCompat";
import {
  buildCompatMap,
  effectiveNormalizeForProtocol,
  effectivePreserveForProtocol,
  effectiveUpstreamHeadersForProtocol,
  formatProviderModelsErrorResponse,
  isModelHidden,
  providerText,
  type ModelCompatSavePatch,
} from "./provider-detail-model-compat";
import {
  CompatibleModelsSection,
  CustomModelsSection,
  ModelRow,
  ModelVisibilityToolbar,
  PassthroughModelsSection,
} from "./provider-detail-model-sections";

export function ProviderDetailModelsPanel(props: any) {
  const {
    t,
    providerId,
    providerInfo,
    modelMeta,
    setCompatSavingModelId,
    fetchProviderModelMeta,
    providerStorageAlias,
    providerDisplayAlias,
    modelAliases,
    copied,
    copy,
    handleSetAlias,
    handleDeleteAlias,
    connections,
    isAnthropicProtocolCompatible,
    handleCompatibleImportWithProgress,
    compatibleSupportsModelImport,
    bulkVisibilityAction,
    togglingModelId,
    setTogglingModelId,
    setBulkVisibilityAction,
    handleImportModels,
    canImportModels,
    importingModels,
    models,
    modelFilter,
    setModelFilter,
    providerAlias,
    providerAliasEntries,
    handleClearAllModels,
    clearingModels,
    isManagedAvailableModelsProvider,
    isCcCompatible,
    isAnthropicCompatible,
    handleToggleAutoSync,
    togglingAutoSync,
    isAutoSyncEnabled,
    compatSavingModelId,
  } = props;
  const notify = useNotificationStore();
  const customMap = useMemo(() => buildCompatMap(modelMeta.customModels), [modelMeta.customModels]);
  const overrideMap = useMemo(
    () => buildCompatMap(modelMeta.modelCompatOverrides),
    [modelMeta.modelCompatOverrides]
  );
  const compatibleFallbackModels = useMemo(
    () => getCompatibleFallbackModels(providerId, modelMeta.customModels),
    [providerId, modelMeta.customModels]
  );

  const effectiveModelNormalize = (modelId: string, protocol = MODEL_COMPAT_PROTOCOL_KEYS[0]) =>
    effectiveNormalizeForProtocol(modelId, protocol, customMap, overrideMap);

  const effectiveModelPreserveDeveloper = (
    modelId: string,
    protocol = MODEL_COMPAT_PROTOCOL_KEYS[0]
  ) => effectivePreserveForProtocol(modelId, protocol, customMap, overrideMap);

  const effectiveModelHidden = useCallback(
    (modelId: string) => isModelHidden(modelId, customMap, overrideMap),
    [customMap, overrideMap]
  );

  const getUpstreamHeadersRecordForModel = useCallback(
    (modelId: string, protocol: string) =>
      effectiveUpstreamHeadersForProtocol(modelId, protocol, customMap, overrideMap),
    [customMap, overrideMap]
  );

  const saveModelCompatFlags = async (modelId: string, patch: ModelCompatSavePatch) => {
    setCompatSavingModelId(modelId);
    try {
      const c = customMap.get(modelId) as Record<string, unknown> | undefined;
      let body: Record<string, unknown>;
      const onlyCompatByProtocol =
        patch.compatByProtocol &&
        patch.normalizeToolCallId === undefined &&
        patch.preserveOpenAIDeveloperRole === undefined &&
        !("upstreamHeaders" in patch);

      if (c) {
        if (onlyCompatByProtocol) {
          body = {
            provider: providerId,
            modelId,
            compatByProtocol: patch.compatByProtocol,
          };
        } else {
          body = {
            provider: providerId,
            modelId,
            modelName: (c.name as string) || modelId,
            source: (c.source as string) || "manual",
            apiFormat: (c.apiFormat as string) || "chat-completions",
            supportedEndpoints:
              Array.isArray(c.supportedEndpoints) && (c.supportedEndpoints as unknown[]).length
                ? c.supportedEndpoints
                : ["chat"],
            normalizeToolCallId:
              patch.normalizeToolCallId !== undefined
                ? patch.normalizeToolCallId
                : Boolean(c.normalizeToolCallId),
            preserveOpenAIDeveloperRole:
              patch.preserveOpenAIDeveloperRole !== undefined
                ? patch.preserveOpenAIDeveloperRole
                : Object.prototype.hasOwnProperty.call(c, "preserveOpenAIDeveloperRole")
                  ? Boolean(c.preserveOpenAIDeveloperRole)
                  : true,
          };
          if (patch.compatByProtocol) body.compatByProtocol = patch.compatByProtocol;
        }
      } else {
        body = { provider: providerId, modelId, ...patch };
      }
      const res = await fetch("/api/provider-models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await formatProviderModelsErrorResponse(res);
        notify.error(
          detail ? `${t("failedSaveCustomModel")} â€” ${detail}` : t("failedSaveCustomModel")
        );
        return;
      }
    } catch {
      notify.error(t("failedSaveCustomModel"));
      return;
    } finally {
      setCompatSavingModelId(null);
    }
    try {
      await fetchProviderModelMeta();
    } catch {
      /* refresh failure is non-critical â€” data was already saved */
    }
  };

  const handleToggleModelHidden = async (
    providerKey: string,
    modelId: string,
    hidden: boolean
  ): Promise<void> => {
    setTogglingModelId(modelId);
    try {
      const res = await fetch(
        `/api/provider-models?provider=${encodeURIComponent(providerKey)}&modelId=${encodeURIComponent(modelId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isHidden: hidden }),
        }
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        notify.error(detail || t("failedSaveCustomModel"));
        return;
      }
      // Optimistic update: refresh model meta
      await fetchProviderModelMeta().catch(() => {});
    } catch {
      notify.error(t("failedSaveCustomModel"));
    } finally {
      setTogglingModelId(null);
    }
  };

  const handleBulkToggleModelHidden = async (
    providerKey: string,
    modelIds: string[],
    hidden: boolean
  ): Promise<void> => {
    if (modelIds.length === 0) return;
    setBulkVisibilityAction(hidden ? "deselect" : "select");
    try {
      const res = await fetch(`/api/provider-models?provider=${encodeURIComponent(providerKey)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden: hidden, modelIds }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        notify.error(detail || t("failedSaveCustomModel"));
        return;
      }
      await fetchProviderModelMeta().catch(() => {});
    } catch {
      notify.error(t("failedSaveCustomModel"));
    } finally {
      setBulkVisibilityAction(null);
    }
  };

  const renderModelsSection = () => {
    const autoSyncToggle = compatibleSupportsModelImport && canImportModels && (
      <button
        onClick={handleToggleAutoSync}
        disabled={togglingAutoSync}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-transparent cursor-pointer text-[12px] disabled:opacity-50 disabled:cursor-not-allowed"
        title={t("autoSyncTooltip")}
      >
        <span
          className="material-symbols-outlined text-[16px]"
          style={{ color: isAutoSyncEnabled ? "#22c55e" : "var(--color-text-muted)" }}
        >
          {isAutoSyncEnabled ? "toggle_on" : "toggle_off"}
        </span>
        <span className="text-text-main">{t("autoSync")}</span>
      </button>
    );

    const clearAllButton = (modelMeta.customModels.length > 0 ||
      providerAliasEntries.length > 0) && (
      <button
        onClick={handleClearAllModels}
        disabled={clearingModels}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-red-300 dark:border-red-800 bg-transparent cursor-pointer text-[12px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
        title={t("clearAllModels")}
      >
        <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
        <span>{t("clearAllModels")}</span>
      </button>
    );

    if (isManagedAvailableModelsProvider) {
      const description =
        providerId === "openrouter"
          ? t("openRouterAnyModelHint")
          : isCcCompatible
            ? "CC Compatible available models mirror the OAuth Claude Code provider list."
            : t("compatibleModelsDescription", {
                type: isAnthropicCompatible ? t("anthropic") : t("openai"),
              });
      const inputLabel = providerId === "openrouter" ? t("modelIdFromOpenRouter") : t("modelId");
      const inputPlaceholder =
        providerId === "openrouter"
          ? t("openRouterModelPlaceholder")
          : isCcCompatible
            ? "claude-sonnet-4-6"
            : isAnthropicCompatible
              ? t("anthropicCompatibleModelPlaceholder")
              : t("openaiCompatibleModelPlaceholder");

      return (
        <div>
          <div className="flex items-center gap-2 mb-4">
            {autoSyncToggle}
            {clearAllButton}
          </div>
          <CompatibleModelsSection
            providerStorageAlias={providerStorageAlias}
            providerDisplayAlias={providerDisplayAlias}
            modelAliases={modelAliases}
            fallbackModels={compatibleFallbackModels}
            description={description}
            inputLabel={inputLabel}
            inputPlaceholder={inputPlaceholder}
            copied={copied}
            onCopy={copy}
            onSetAlias={handleSetAlias}
            onDeleteAlias={handleDeleteAlias}
            connections={connections}
            isAnthropic={isAnthropicProtocolCompatible}
            onImportWithProgress={handleCompatibleImportWithProgress}
            t={t}
            effectiveModelNormalize={effectiveModelNormalize}
            effectiveModelPreserveDeveloper={effectiveModelPreserveDeveloper}
            getUpstreamHeadersRecord={getUpstreamHeadersRecordForModel}
            saveModelCompatFlags={saveModelCompatFlags}
            compatSavingModelId={compatSavingModelId}
            onModelsChanged={fetchProviderModelMeta}
            allowImport={compatibleSupportsModelImport}
            isModelHidden={effectiveModelHidden}
            onToggleHidden={(modelId, hidden) =>
              handleToggleModelHidden(providerStorageAlias, modelId, hidden)
            }
            onBulkToggleHidden={(modelIds, hidden) =>
              handleBulkToggleModelHidden(providerStorageAlias, modelIds, hidden)
            }
            bulkTogglePending={bulkVisibilityAction !== null}
            togglingModelId={togglingModelId}
          />
        </div>
      );
    }

    if (providerInfo.passthroughModels) {
      return (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Button
              size="sm"
              variant="secondary"
              icon="download"
              onClick={handleImportModels}
              disabled={!canImportModels || importingModels}
            >
              {importingModels ? t("importingModels") : t("importFromModels")}
            </Button>
            {autoSyncToggle}
            {clearAllButton}
            {!canImportModels && (
              <span className="text-xs text-text-muted">{t("addConnectionToImport")}</span>
            )}
          </div>
          <PassthroughModelsSection
            providerAlias={providerAlias}
            modelAliases={modelAliases}
            copied={copied}
            onCopy={copy}
            onSetAlias={handleSetAlias}
            onDeleteAlias={handleDeleteAlias}
            t={t}
            effectiveModelNormalize={effectiveModelNormalize}
            effectiveModelPreserveDeveloper={effectiveModelPreserveDeveloper}
            getUpstreamHeadersRecord={getUpstreamHeadersRecordForModel}
            saveModelCompatFlags={saveModelCompatFlags}
            compatSavingModelId={compatSavingModelId}
            isModelHidden={effectiveModelHidden}
            onToggleHidden={(modelId, hidden) =>
              handleToggleModelHidden(providerStorageAlias, modelId, hidden)
            }
            onBulkToggleHidden={(modelIds, hidden) =>
              handleBulkToggleModelHidden(providerStorageAlias, modelIds, hidden)
            }
            bulkTogglePending={bulkVisibilityAction !== null}
            togglingModelId={togglingModelId}
          />
        </div>
      );
    }

    const importButton =
      providerId === "gemini" ? null : (
        <div className="flex items-center gap-2 mb-4">
          <Button
            size="sm"
            variant="secondary"
            icon="download"
            onClick={handleImportModels}
            disabled={!canImportModels || importingModels}
          >
            {importingModels ? t("importingModels") : t("importFromModels")}
          </Button>
          {autoSyncToggle}
          {!canImportModels && (
            <span className="text-xs text-text-muted">{t("addConnectionToImport")}</span>
          )}
        </div>
      );

    if (models.length === 0) {
      return (
        <div>
          {importButton}
          <p className="text-sm text-text-muted">{t("noModelsConfigured")}</p>
        </div>
      );
    }
    const modelsWithVisibility = models.map((model) => ({
      ...model,
      isHidden: effectiveModelHidden(model.id),
    }));
    const filteredModels = modelFilter
      ? modelsWithVisibility.filter((m) => m.id.toLowerCase().includes(modelFilter.toLowerCase()))
      : modelsWithVisibility;
    const activeCount = modelsWithVisibility.filter((m) => !m.isHidden).length;
    const hiddenFilteredCount = filteredModels.filter((m) => m.isHidden).length;
    const visibleFilteredCount = filteredModels.length - hiddenFilteredCount;
    return (
      <div>
        {importButton}
        {modelsWithVisibility.length > 0 && (
          <ModelVisibilityToolbar
            t={t}
            filterValue={modelFilter}
            onFilterChange={setModelFilter}
            activeCount={activeCount}
            totalCount={modelsWithVisibility.length}
            onSelectAll={() =>
              handleBulkToggleModelHidden(
                providerId,
                filteredModels.map((model) => model.id),
                false
              )
            }
            onDeselectAll={() =>
              handleBulkToggleModelHidden(
                providerId,
                filteredModels.map((model) => model.id),
                true
              )
            }
            selectAllDisabled={hiddenFilteredCount === 0 || bulkVisibilityAction !== null}
            deselectAllDisabled={visibleFilteredCount === 0 || bulkVisibilityAction !== null}
          />
        )}
        <div className="flex flex-wrap gap-3">
          {filteredModels.map((model) => {
            return (
              <ModelRow
                key={model.id}
                model={model}
                fullModel={`${providerDisplayAlias}/${model.id}`}
                copied={copied}
                onCopy={copy}
                t={t}
                showDeveloperToggle
                effectiveModelNormalize={effectiveModelNormalize}
                effectiveModelPreserveDeveloper={effectiveModelPreserveDeveloper}
                getUpstreamHeadersRecord={(p) => getUpstreamHeadersRecordForModel(model.id, p)}
                saveModelCompatFlags={saveModelCompatFlags}
                compatDisabled={compatSavingModelId === model.id}
                onToggleHidden={(modelId, hidden) =>
                  handleToggleModelHidden(providerId, modelId, hidden)
                }
                togglingHidden={togglingModelId === model.id}
              />
            );
          })}
          {filteredModels.length === 0 && modelFilter && (
            <p className="text-sm text-text-muted py-2">
              {providerText(t, "noModelsMatch", `No models match "${modelFilter}"`, {
                filter: modelFilter,
              })}
            </p>
          )}
        </div>
      </div>
    );
  };
  return (
    <>
      {renderModelsSection()}
      {!isManagedAvailableModelsProvider && providerId !== "gemini" && (
        <CustomModelsSection
          providerId={providerId}
          providerAlias={providerDisplayAlias}
          copied={copied}
          onCopy={copy}
          onModelsChanged={fetchProviderModelMeta}
        />
      )}
    </>
  );
}
