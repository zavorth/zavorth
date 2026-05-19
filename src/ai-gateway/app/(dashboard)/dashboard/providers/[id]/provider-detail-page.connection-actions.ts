"use client";

import { normalizeCodexLimitPolicy } from "./provider-detail-model-compat";

export async function parseApiErrorMessage(res: Response, fallback: string) {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => ({}));
    if (typeof data?.error === "string" && data.error.trim()) {
      return data.error;
    }
    if (data?.error?.message) {
      return data.error.message;
    }
  }

  const text = await res.text().catch(() => "");
  return text.trim() || fallback;
}

export function getAttachmentFilename(res: Response, fallback: string) {
  const disposition = res.headers.get("content-disposition") || "";
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const plainMatch = disposition.match(/filename=\"([^\"]+)\"/i);
  if (plainMatch?.[1]) {
    return plainMatch[1];
  }

  return fallback;
}

export async function handleDeleteConnectionAction(id: string, deps: any) {
  if (!confirm(deps.t("deleteConnectionConfirm"))) return;
  try {
    const res = await fetch(`/api/providers/${id}`, { method: "DELETE" });
    if (res.ok) {
      deps.setConnections((prev: any[]) => prev.filter((connection) => connection.id !== id));
      if (deps.providerId === "gemini") {
        await deps.fetchProviderModelMeta();
      }
    }
  } catch (error) {
    console.log("Error deleting connection:", error);
  }
}

export async function handleSaveApiKeyAction(formData: any, deps: any) {
  try {
    const res = await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: deps.providerId, ...formData }),
    });
    if (res.ok) {
      const connectionData = await res.json();
      const newConnection = connectionData?.connection;
      await deps.fetchConnections();
      deps.setShowAddApiKeyModal(false);

      if (deps.providerId === "gemini" && newConnection?.id) {
        deps.setShowImportModal(true);
        deps.setImportProgress({
          current: 0,
          total: 0,
          stage: "fetching",
          status: deps.t("fetchingModels"),
          logs: [],
          error: "",
          importedCount: 0,
        });

        try {
          const syncRes = await fetch(`/api/providers/${newConnection.id}/sync-models`, {
            method: "POST",
            signal: AbortSignal.timeout(30_000),
          });
          const syncData = await syncRes.json();

          if (!syncRes.ok || syncData.error) {
            deps.setImportProgress((prev: any) => ({
              ...prev,
              stage: "error",
              status: deps.t("failedFetchModels"),
              error: syncData.error?.message || syncData.error || deps.t("failedImportModels"),
            }));
            return null;
          }

          const syncedCount = syncData.syncedModels || 0;
          const syncedModelList: Array<{ id: string; name?: string }> = syncData.models || [];
          const logs: string[] = [];
          if (syncedModelList.length > 0) {
            logs.push(`OK ${syncedCount} models available`);
            logs.push("");
            for (const model of syncedModelList) {
              logs.push(`  ${model.name || model.id}`);
            }
          }

          deps.setImportProgress((prev: any) => ({
            ...prev,
            stage: "done",
            status: deps.t("modelsImported", { count: syncedCount }),
            total: syncedCount,
            current: syncedCount,
            importedCount: syncedCount,
            logs,
          }));

          await deps.fetchProviderModelMeta();
        } catch (syncError) {
          deps.setImportProgress((prev: any) => ({
            ...prev,
            stage: "error",
            status: deps.t("failedFetchModels"),
            error: String(syncError),
          }));
        }
      }
      return null;
    }
    const data = await res.json().catch(() => ({}));
    const errorMsg = data.error?.message || data.error || deps.t("failedSaveConnection");
    return errorMsg;
  } catch (error) {
    console.log("Error saving connection:", error);
    return deps.t("failedSaveConnectionRetry");
  }
}

export async function handleUpdateConnectionAction(formData: any, deps: any) {
  try {
    const res = await fetch(`/api/providers/${deps.selectedConnection.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    if (res.ok) {
      await deps.fetchConnections();
      deps.setShowEditModal(false);
      return null;
    }
    const data = await res.json().catch(() => ({}));
    return data.error?.message || data.error || deps.t("failedSaveConnection");
  } catch (error) {
    console.log("Error updating connection:", error);
    return deps.t("failedSaveConnectionRetry");
  }
}

export async function handleUpdateConnectionStatusAction(id: string, isActive: boolean, deps: any) {
  try {
    const res = await fetch(`/api/providers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    if (res.ok) {
      deps.setConnections((prev: any[]) =>
        prev.map((connection) => (connection.id === id ? { ...connection, isActive } : connection))
      );
    }
  } catch (error) {
    console.log("Error updating connection status:", error);
  }
}

export async function handleToggleRateLimitAction(
  connectionId: string,
  enabled: boolean,
  deps: any,
) {
  try {
    const res = await fetch("/api/rate-limits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, enabled }),
    });
    if (res.ok) {
      deps.setConnections((prev: any[]) =>
        prev.map((connection) =>
          connection.id === connectionId
            ? { ...connection, rateLimitProtection: enabled }
            : connection
        )
      );
    }
  } catch (error) {
    console.error("Error toggling rate limit:", error);
  }
}

export async function handleToggleCodexLimitAction(
  connectionId: string,
  field: string,
  enabled: boolean,
  deps: any,
) {
  try {
    const target = deps.connections.find((connection: any) => connection.id === connectionId);
    if (!target) return;

    const providerSpecificData =
      target.providerSpecificData && typeof target.providerSpecificData === "object"
        ? target.providerSpecificData
        : {};
    const existingPolicy =
      providerSpecificData.codexLimitPolicy &&
      typeof providerSpecificData.codexLimitPolicy === "object"
        ? providerSpecificData.codexLimitPolicy
        : {};

    const nextPolicy = {
      ...normalizeCodexLimitPolicy(existingPolicy),
      [field]: enabled,
    };

    const res = await fetch(`/api/providers/${connectionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        providerSpecificData: {
          ...providerSpecificData,
          codexLimitPolicy: nextPolicy,
        },
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      deps.notify.error(data.error || "Failed to update Codex limit policy");
      return;
    }

    deps.setConnections((prev: any[]) =>
      prev.map((connection) =>
        connection.id === connectionId
          ? {
              ...connection,
              providerSpecificData: {
                ...(connection.providerSpecificData || {}),
                codexLimitPolicy: nextPolicy,
              },
            }
          : connection
      )
    );
    deps.notify.success("Codex limit policy updated");
  } catch (error) {
    console.error("Error toggling Codex quota policy:", error);
    deps.notify.error("Failed to update Codex limit policy");
  }
}

export async function handleRetestConnectionAction(connectionId: string, deps: any) {
  if (!connectionId || deps.retestingId) return;
  deps.setRetestingId(connectionId);
  try {
    const res = await fetch(`/api/providers/${connectionId}/test`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || deps.t("failedRetestConnection"));
      return;
    }
    await deps.fetchConnections();
  } catch (error) {
    console.error("Error retesting connection:", error);
  } finally {
    deps.setRetestingId(null);
  }
}

export async function handleBatchTestAllAction(deps: any) {
  if (deps.batchTesting || deps.connections.length === 0) return;
  deps.setBatchTesting(true);
  deps.setBatchTestResults(null);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch("/api/providers/test-batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "provider", providerId: deps.providerId }),
      signal: controller.signal,
    });
    let data: any;
    try {
      data = await res.json();
    } catch {
      data = { error: deps.t("providerTestFailed"), results: [], summary: null };
    }
    deps.setBatchTestResults({
      ...data,
      error: data.error
        ? typeof data.error === "object"
          ? data.error.message || data.error.error || JSON.stringify(data.error)
          : String(data.error)
        : null,
    });
    if (data?.summary) {
      const { passed, failed, total } = data.summary;
      if (failed === 0) deps.notify.success(deps.t("allTestsPassed", { total }));
      else deps.notify.warning(deps.t("testSummary", { passed, failed, total }));
    }
    await deps.fetchConnections();
  } catch (error: any) {
    const isAbort = error?.name === "AbortError";
    const msg = isAbort ? deps.t("providerTestTimeout") : deps.t("providerTestFailed");
    deps.setBatchTestResults({ error: msg, results: [], summary: null });
    deps.notify.error(msg);
  } finally {
    clearTimeout(timeoutId);
    deps.setBatchTesting(false);
  }
}

export async function handleRefreshTokenAction(connectionId: string, deps: any) {
  if (deps.refreshingId) return;
  deps.setRefreshingId(connectionId);
  try {
    const res = await fetch(`/api/providers/${connectionId}/refresh`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      deps.notify.success(deps.t("tokenRefreshed"));
      await deps.fetchConnections();
    } else {
      deps.notify.error(data.error || deps.t("tokenRefreshFailed"));
    }
  } catch (error) {
    console.error("Error refreshing token:", error);
    deps.notify.error(deps.t("tokenRefreshFailed"));
  } finally {
    deps.setRefreshingId(null);
  }
}

export async function handleApplyCodexAuthLocalAction(connectionId: string, deps: any) {
  if (deps.applyingCodexAuthId) return;
  deps.setApplyingCodexAuthId(connectionId);

  const defaultSuccess =
    typeof deps.t.has === "function" && deps.t.has("codexAuthAppliedLocal")
      ? deps.t("codexAuthAppliedLocal")
      : "Codex auth.json applied locally";
  const defaultError =
    typeof deps.t.has === "function" && deps.t.has("codexAuthApplyFailed")
      ? deps.t("codexAuthApplyFailed")
      : "Failed to apply Codex auth.json locally";

  try {
    const res = await fetch(`/api/providers/${connectionId}/codex-auth/apply-local`, {
      method: "POST",
    });

    if (!res.ok) {
      deps.notify.error(await parseApiErrorMessage(res, defaultError));
      return;
    }

    deps.notify.success(defaultSuccess);
  } catch (error) {
    console.error("Error applying Codex auth locally:", error);
    deps.notify.error(defaultError);
  } finally {
    deps.setApplyingCodexAuthId(null);
  }
}

export async function handleExportCodexAuthFileAction(connectionId: string, deps: any) {
  if (deps.exportingCodexAuthId) return;
  deps.setExportingCodexAuthId(connectionId);

  const defaultSuccess =
    typeof deps.t.has === "function" && deps.t.has("codexAuthExported")
      ? deps.t("codexAuthExported")
      : "Codex auth.json exported";
  const defaultError =
    typeof deps.t.has === "function" && deps.t.has("codexAuthExportFailed")
      ? deps.t("codexAuthExportFailed")
      : "Failed to export Codex auth.json";

  try {
    const res = await fetch(`/api/providers/${connectionId}/codex-auth/export`, {
      method: "POST",
    });

    if (!res.ok) {
      deps.notify.error(await parseApiErrorMessage(res, defaultError));
      return;
    }

    const blob = await res.blob();
    const filename = getAttachmentFilename(res, "codex-auth.json");
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);

    deps.notify.success(defaultSuccess);
  } catch (error) {
    console.error("Error exporting Codex auth file:", error);
    deps.notify.error(defaultError);
  } finally {
    deps.setExportingCodexAuthId(null);
  }
}

export async function handleSwapPriorityAction(conn1: any, conn2: any, deps: any) {
  if (!conn1 || !conn2) return;
  try {
    let p1 = conn2.priority;
    let p2 = conn1.priority;

    if (p1 === p2) {
      const isConn1MovingUp = deps.connections.indexOf(conn1) > deps.connections.indexOf(conn2);
      if (isConn1MovingUp) {
        p1 = conn2.priority - 0.5;
      } else {
        p1 = conn2.priority + 0.5;
      }
    }

    await Promise.all([
      fetch(`/api/providers/${conn1.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: p1 }),
      }),
      fetch(`/api/providers/${conn2.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: p2 }),
      }),
    ]);
    await deps.fetchConnections();
  } catch (error) {
    console.log("Error swapping priority:", error);
  }
}
