"use client";

function buildImportProgress(t: any) {
  return {
    current: 0,
    total: 0,
    phase: "fetching" as const,
    status: t("fetchingModels"),
    logs: [] as string[],
    error: "",
    importedCount: 0,
  };
}

export async function handleImportModelsAction(deps: any) {
  if (deps.importingModels) return;
  const activeConnection = deps.connections.find((connection: any) => connection.isActive !== false);
  if (!activeConnection) return;

  deps.setImportingModels(true);
  deps.setShowImportModal(true);
  deps.setImportProgress(buildImportProgress(deps.t));

  try {
    const res = await fetch(`/api/providers/${activeConnection.id}/models`);
    const data = await res.json();
    if (!res.ok) {
      deps.setImportProgress((prev: any) => ({
        ...prev,
        phase: "error",
        status: deps.t("failedFetchModels"),
        error: data.error || deps.t("failedImportModels"),
      }));
      return;
    }
    const fetchedModels = data.models || [];
    if (fetchedModels.length === 0) {
      deps.setImportProgress((prev: any) => ({
        ...prev,
        phase: "done",
        status: deps.t("noModelsFound"),
        logs: [deps.t("noModelsReturnedFromEndpoint")],
      }));
      return;
    }

    const existingIds = new Set([
      ...(deps.modelMeta.customModels || []).map((model: any) => model.id),
      ...deps.models.map((model: any) => model.id),
    ]);
    const newModels = fetchedModels.filter(
      (model: any) => !existingIds.has(model.id || model.name || model.model),
    );

    if (newModels.length === 0) {
      deps.setImportProgress((prev: any) => ({
        ...prev,
        phase: "done",
        status: deps.t("allModelsAlreadyImported") || "All models already imported",
        logs: [deps.t("noNewModelsToImport") || "No new models to import"],
        importedCount: 0,
        total: 0,
        current: 0,
      }));
      return;
    }

    deps.setImportProgress((prev: any) => ({
      ...prev,
      phase: "importing",
      total: newModels.length,
      current: 0,
      status: deps.t("importingModelsProgress", { current: 0, total: newModels.length }),
      logs: [
        deps.t("foundModelsStartingImport", { count: newModels.length }),
        ...(newModels.length < fetchedModels.length
          ? [
              deps.t("skippingExistingModels", { count: fetchedModels.length - newModels.length }) ||
                `Skipping ${fetchedModels.length - newModels.length} existing models`,
            ]
          : []),
      ],
    }));

    let importedCount = 0;
    for (let i = 0; i < newModels.length; i += 1) {
      const model = newModels[i];
      const modelId = model.id || model.name || model.model;
      if (!modelId) continue;
      const parts = modelId.split("/");
      const baseAlias = parts[parts.length - 1];

      deps.setImportProgress((prev: any) => ({
        ...prev,
        current: i + 1,
        status: deps.t("importingModelsProgress", { current: i + 1, total: newModels.length }),
        logs: [...prev.logs, deps.t("importingModelById", { modelId })],
      }));

      await fetch("/api/provider-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: deps.providerId,
          modelId,
          modelName: model.name || modelId,
          source: "imported",
        }),
      });
      if (!deps.modelAliases[baseAlias]) {
        await deps.handleSetAlias(modelId, baseAlias, deps.providerStorageAlias);
      }
      importedCount += 1;
    }

    await deps.fetchAliases();

    deps.setImportProgress((prev: any) => ({
      ...prev,
      phase: "done",
      current: newModels.length,
      status:
        importedCount > 0
          ? deps.t("importSuccessCount", { count: importedCount })
          : deps.t("noNewModelsAddedExisting"),
      logs: [
        ...prev.logs,
        importedCount > 0
          ? deps.t("importDoneCount", { count: importedCount })
          : deps.t("noNewModelsAdded"),
      ],
      importedCount,
    }));

    if (importedCount > 0) {
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  } catch (error) {
    console.log("Error importing models:", error);
    deps.setImportProgress((prev: any) => ({
      ...prev,
      phase: "error",
      status: deps.t("importFailed"),
      error: error instanceof Error ? error.message : deps.t("unexpectedErrorOccurred"),
    }));
  } finally {
    deps.setImportingModels(false);
  }
}

export async function handleCompatibleImportWithProgressAction(
  fetchModels: () => Promise<{ models: any[] }>,
  processModel: (model: any) => Promise<boolean>,
  deps: any,
) {
  deps.setShowImportModal(true);
  deps.setImportProgress(buildImportProgress(deps.t));

  try {
    const data = await fetchModels();
    const compatibleModels = data.models || [];
    if (compatibleModels.length === 0) {
      deps.setImportProgress((prev: any) => ({
        ...prev,
        phase: "done",
        status: deps.t("noModelsFound"),
        logs: [deps.t("noModelsReturnedFromEndpoint")],
      }));
      return;
    }

    deps.setImportProgress((prev: any) => ({
      ...prev,
      phase: "importing",
      total: compatibleModels.length,
      status: deps.t("importingModelsProgress", {
        current: 0,
        total: compatibleModels.length,
      }),
      logs: [deps.t("foundModelsStartingImport", { count: compatibleModels.length })],
    }));

    let importedCount = 0;
    for (let i = 0; i < compatibleModels.length; i += 1) {
      const model = compatibleModels[i];
      const modelId = model.id || model.name || model.model;
      if (!modelId) continue;

      deps.setImportProgress((prev: any) => ({
        ...prev,
        current: i + 1,
        status: deps.t("importingModelsProgress", {
          current: i + 1,
          total: compatibleModels.length,
        }),
        logs: [...prev.logs, deps.t("importingModelById", { modelId })],
      }));

      const added = await processModel(model);
      if (added) importedCount += 1;
    }

    deps.setImportProgress((prev: any) => ({
      ...prev,
      phase: "done",
      current: compatibleModels.length,
      status:
        importedCount > 0
          ? deps.t("importSuccessCount", { count: importedCount })
          : deps.t("noNewModelsAdded"),
      logs: [
        ...prev.logs,
        importedCount > 0
          ? deps.t("importDoneCount", { count: importedCount })
          : deps.t("noNewModelsAdded"),
      ],
      importedCount,
    }));

    if (importedCount > 0) {
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  } catch (error) {
    console.log("Error importing models:", error);
    deps.setImportProgress((prev: any) => ({
      ...prev,
      phase: "error",
      status: deps.t("importFailed"),
      error: error instanceof Error ? error.message : deps.t("unexpectedErrorOccurred"),
    }));
  }
}

export async function handleToggleAutoSyncAction(deps: any) {
  if (!deps.autoSyncConnection || deps.togglingAutoSync) return;
  deps.setTogglingAutoSync(true);
  try {
    const newValue = !deps.isAutoSyncEnabled;
    await fetch(`/api/providers/${deps.autoSyncConnection.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerSpecificData: { autoSync: newValue },
      }),
    });
    await deps.fetchConnections();
    deps.notify[newValue ? "success" : "info"](
      newValue ? deps.t("autoSyncEnabled") : deps.t("autoSyncDisabled"),
    );
  } catch (error) {
    console.log("Error toggling auto-sync:", error);
    deps.notify.error(deps.t("autoSyncToggleFailed"));
  } finally {
    deps.setTogglingAutoSync(false);
  }
}

export async function handleClearAllModelsAction(deps: any) {
  if (deps.clearingModels) return;
  if (!confirm(deps.t("clearAllModelsConfirm"))) return;
  deps.setClearingModels(true);
  try {
    const res = await fetch(
      `/api/provider-models?provider=${encodeURIComponent(deps.providerStorageAlias)}&all=true`,
      { method: "DELETE" },
    );
    if (res.ok) {
      await Promise.all(
        deps.providerAliasEntries.map(([alias]: [string, string]) =>
          fetch(`/api/models/alias?alias=${encodeURIComponent(alias)}`, {
            method: "DELETE",
          }).catch(() => {}),
        ),
      );
      await deps.fetchProviderModelMeta();
      await deps.fetchAliases();
      deps.notify.success(deps.t("clearAllModelsSuccess"));
    } else {
      deps.notify.error(deps.t("clearAllModelsFailed"));
    }
  } catch {
    deps.notify.error(deps.t("clearAllModelsFailed"));
  } finally {
    deps.setClearingModels(false);
  }
}
