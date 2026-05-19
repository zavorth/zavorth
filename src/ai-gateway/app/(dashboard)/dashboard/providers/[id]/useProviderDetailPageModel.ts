"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useNotificationStore } from "@/store/notificationStore";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  FREE_PROVIDERS,
  OAUTH_PROVIDERS,
  APIKEY_PROVIDERS,
  getProviderAlias,
  isOpenAICompatibleProvider,
  isAnthropicCompatibleProvider,
  isClaudeCodeCompatibleProvider,
  supportsApiKeyOnFreeProvider,
} from "@/shared/constants/providers";
import { getModelsByProviderId } from "@/shared/constants/models";
import { compatibleProviderSupportsModelImport } from "@/lib/providers/managedAvailableModels";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { CC_COMPATIBLE_LABEL, type CompatModelRow } from "./provider-detail-model-compat";
import {
  handleApplyCodexAuthLocalAction,
  handleBatchTestAllAction,
  handleDeleteConnectionAction,
  handleExportCodexAuthFileAction,
  handleRefreshTokenAction,
  handleRetestConnectionAction,
  handleSaveApiKeyAction,
  handleSwapPriorityAction,
  handleToggleCodexLimitAction,
  handleToggleRateLimitAction,
  handleUpdateConnectionAction,
  handleUpdateConnectionStatusAction,
} from "./provider-detail-page.connection-actions";
import {
  handleClearAllModelsAction,
  handleCompatibleImportWithProgressAction,
  handleImportModelsAction,
  handleToggleAutoSyncAction,
} from "./provider-detail-page.model-actions";

export function useProviderDetailPageModel() {
  const params = useParams();
  const router = useRouter();
  const providerId = params.id as string;
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [providerNode, setProviderNode] = useState(null);
  const [showOAuthModal, setShowOAuthModal] = useState(false);
  const [showAddApiKeyModal, setShowAddApiKeyModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditNodeModal, setShowEditNodeModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState(null);
  const [retestingId, setRetestingId] = useState(null);
  const [batchTesting, setBatchTesting] = useState(false);
  const [batchTestResults, setBatchTestResults] = useState<any>(null);
  const [modelAliases, setModelAliases] = useState({});
  const [headerImgError, setHeaderImgError] = useState(false);
  const { copied, copy } = useCopyToClipboard();
  const t = useTranslations("providers");
  const notify = useNotificationStore();
  const [proxyTarget, setProxyTarget] = useState(null);
  const [proxyConfig, setProxyConfig] = useState(null);
  const [connProxyMap, setConnProxyMap] = useState<
    Record<string, { proxy: any; level: string } | null>
  >({});
  const [importingModels, setImportingModels] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importProgress, setImportProgress] = useState({
    current: 0,
    total: 0,
    stage: "idle" as "idle" | "fetching" | "importing" | "done" | "error",
    status: "",
    logs: [] as string[],
    error: "",
    importedCount: 0,
  });
  const [modelMeta, setModelMeta] = useState<{
    customModels: CompatModelRow[];
    modelCompatOverrides: Array<CompatModelRow & { id: string }>;
  }>({ customModels: [], modelCompatOverrides: [] });
  const [syncedAvailableModels, setSyncedAvailableModels] = useState<any[]>([]);
  const [compatSavingModelId, setCompatSavingModelId] = useState<string | null>(null);
  const [modelFilter, setModelFilter] = useState("");
  const [togglingModelId, setTogglingModelId] = useState<string | null>(null);
  const [bulkVisibilityAction, setBulkVisibilityAction] = useState<"select" | "deselect" | null>(
    null,
  );
  const [applyingCodexAuthId, setApplyingCodexAuthId] = useState<string | null>(null);
  const [exportingCodexAuthId, setExportingCodexAuthId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [togglingAutoSync, setTogglingAutoSync] = useState(false);
  const [clearingModels, setClearingModels] = useState(false);

  const isOpenAICompatible = isOpenAICompatibleProvider(providerId);
  const isCcCompatible = isClaudeCodeCompatibleProvider(providerId);
  const isAnthropicCompatible =
    isAnthropicCompatibleProvider(providerId) && !isClaudeCodeCompatibleProvider(providerId);
  const isCompatible = isOpenAICompatible || isAnthropicCompatible || isCcCompatible;
  const isAnthropicProtocolCompatible = isAnthropicCompatible || isCcCompatible;
  const providerAlias = getProviderAlias(providerId);
  const providerStorageAlias = isCompatible ? providerId : providerAlias;
  const providerDisplayAlias = isCompatible ? providerNode?.prefix || providerId : providerAlias;
  const providerSupportsOAuth =
    !!(FREE_PROVIDERS as any)[providerId] || !!(OAUTH_PROVIDERS as any)[providerId];
  const providerSupportsPat = supportsApiKeyOnFreeProvider(providerId);
  const isOAuth = providerSupportsOAuth && !providerSupportsPat;
  const isSearchProvider = providerId.endsWith("-search");
  const compatibleSupportsModelImport = compatibleProviderSupportsModelImport(providerId);
  const isManagedAvailableModelsProvider = isCompatible || providerId === "openrouter";
  const registryModels = getModelsByProviderId(providerId);
  const models = providerId === "gemini" ? syncedAvailableModels : registryModels;

  const providerInfo = providerNode
    ? {
        id: providerNode.id,
        name:
          providerNode.name ||
          (isCcCompatible
            ? CC_COMPATIBLE_LABEL
            : providerNode.type === "anthropic-compatible"
              ? t("anthropicCompatibleName")
              : t("openaiCompatibleName")),
        color: isCcCompatible
          ? "#B45309"
          : providerNode.type === "anthropic-compatible"
            ? "#D97757"
            : "#10A37F",
        textIcon: isCcCompatible
          ? "CC"
          : providerNode.type === "anthropic-compatible"
            ? "AC"
            : "OC",
        apiType: providerNode.apiType,
        baseUrl: providerNode.baseUrl,
        type: providerNode.type,
      }
    : (FREE_PROVIDERS as any)[providerId] ||
      (OAUTH_PROVIDERS as any)[providerId] ||
      (APIKEY_PROVIDERS as any)[providerId];

  const fetchAliases = useCallback(async () => {
    try {
      const res = await fetch("/api/models/alias");
      const data = await res.json();
      if (res.ok) {
        setModelAliases(data.aliases || {});
      }
    } catch (error) {
      console.log("Error fetching aliases:", error);
    }
  }, []);

  const fetchProviderModelMeta = useCallback(async () => {
    if (isSearchProvider) return;
    try {
      const res = await fetch(`/api/provider-models?provider=${encodeURIComponent(providerId)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setModelMeta({
        customModels: data.models || [],
        modelCompatOverrides: data.modelCompatOverrides || [],
      });
      if (providerId === "gemini") {
        try {
          const syncRes = await fetch("/api/synced-available-models?provider=gemini", {
            cache: "no-store",
          });
          if (syncRes.ok) {
            const syncData = await syncRes.json();
            setSyncedAvailableModels(syncData.models || []);
          }
        } catch {
          // Non-critical
        }
      }
    } catch (error) {
      console.error("fetchProviderModelMeta", error);
    }
  }, [providerId, isSearchProvider]);

  const fetchConnections = useCallback(async () => {
    try {
      const [connectionsRes, nodesRes] = await Promise.all([
        fetch("/api/providers", { cache: "no-store" }),
        fetch("/api/provider-nodes", { cache: "no-store" }),
      ]);
      const connectionsData = await connectionsRes.json();
      const nodesData = await nodesRes.json();
      if (connectionsRes.ok) {
        const filtered = (connectionsData.connections || []).filter(
          (connection) => connection.provider === providerId,
        );
        setConnections(filtered);
      }
      if (nodesRes.ok) {
        let node = (nodesData.nodes || []).find((entry) => entry.id === providerId) || null;
        if (!node && isCompatible) {
          for (let attempt = 0; attempt < 3; attempt += 1) {
            await new Promise((resolve) => setTimeout(resolve, 150));
            const retryRes = await fetch("/api/provider-nodes", { cache: "no-store" });
            if (!retryRes.ok) continue;
            const retryData = await retryRes.json();
            node = (retryData.nodes || []).find((entry) => entry.id === providerId) || null;
            if (node) break;
          }
        }
        setProviderNode(node);
      }
    } catch (error) {
      console.log("Error fetching connections:", error);
    } finally {
      setLoading(false);
    }
  }, [providerId, isCompatible]);

  const loadConnProxies = useCallback(async (conns: { id?: string }[]) => {
    if (!conns.length) return;
    try {
      const results = await Promise.all(
        conns
          .filter((connection) => connection.id)
          .map((connection) =>
            fetch(`/api/settings/proxy?resolve=${encodeURIComponent(connection.id!)}`, {
              cache: "no-store",
            })
              .then((response) => (response.ok ? response.json() : null))
              .then((data) => [connection.id!, data] as [string, any])
              .catch(() => [connection.id!, null] as [string, any]),
          ),
      );
      const map: Record<string, { proxy: any; level: string } | null> = {};
      for (const [id, data] of results) {
        map[id] = data?.proxy ? data : null;
      }
      setConnProxyMap(map);
    } catch {
      // ignore
    }
  }, []);

  const handleUpdateNode = async (formData: any) => {
    try {
      const res = await fetch(`/api/provider-nodes/${providerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        setProviderNode(data.node);
        await fetchConnections();
        setShowEditNodeModal(false);
      }
    } catch (error) {
      console.log("Error updating provider node:", error);
    }
  };

  useEffect(() => {
    fetchConnections();
    fetchAliases();
    fetch("/api/settings/proxy")
      .then((response) => (response.ok ? response.json() : null))
      .then((config) => setProxyConfig(config))
      .catch(() => {});
  }, [fetchConnections, fetchAliases]);

  useEffect(() => {
    if (loading || isSearchProvider) return;
    fetchProviderModelMeta();
  }, [loading, isSearchProvider, fetchProviderModelMeta]);

  useEffect(() => {
    if (!loading && connections.length > 0) {
      void loadConnProxies(connections);
    }
  }, [loading, connections, loadConnProxies]);

  const handleSetAlias = async (modelId: string, alias: string, providerAliasOverride = providerAlias) => {
    const fullModel = `${providerAliasOverride}/${modelId}`;
    try {
      const res = await fetch("/api/models/alias", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: fullModel, alias }),
      });
      if (res.ok) {
        await fetchAliases();
      } else {
        const data = await res.json();
        alert(data.error || t("failedSetAlias"));
      }
    } catch (error) {
      console.log("Error setting alias:", error);
    }
  };

  const handleDeleteAlias = async (alias: string) => {
    try {
      const res = await fetch(`/api/models/alias?alias=${encodeURIComponent(alias)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchAliases();
      }
    } catch (error) {
      console.log("Error deleting alias:", error);
    }
  };

  const handleDelete = async (id: string) =>
    handleDeleteConnectionAction(id, {
      providerId,
      setConnections,
      fetchProviderModelMeta,
      t,
    });

  const handleOAuthSuccess = useCallback(() => {
    fetchConnections();
    setShowOAuthModal(false);
  }, [fetchConnections]);

  const openPrimaryAddFlow = useCallback(() => {
    if (isOAuth) {
      setShowOAuthModal(true);
      return;
    }
    setShowAddApiKeyModal(true);
  }, [isOAuth]);

  const handleSaveApiKey = async (formData: any) =>
    handleSaveApiKeyAction(formData, {
      providerId,
      fetchConnections,
      setShowAddApiKeyModal,
      setShowImportModal,
      setImportProgress,
      fetchProviderModelMeta,
      t,
    });

  const handleUpdateConnection = async (formData: any) =>
    handleUpdateConnectionAction(formData, {
      selectedConnection,
      fetchConnections,
      setShowEditModal,
      t,
    });

  const handleUpdateConnectionStatus = async (id: string, isActive: boolean) =>
    handleUpdateConnectionStatusAction(id, isActive, { setConnections });

  const handleToggleRateLimit = async (connectionId: string, enabled: boolean) =>
    handleToggleRateLimitAction(connectionId, enabled, { setConnections });

  const handleToggleCodexLimit = async (connectionId: string, field: string, enabled: boolean) =>
    handleToggleCodexLimitAction(connectionId, field, enabled, {
      connections,
      setConnections,
      notify,
    });

  const handleRetestConnection = async (connectionId: string) =>
    handleRetestConnectionAction(connectionId, {
      retestingId,
      setRetestingId,
      fetchConnections,
      t,
    });

  const handleBatchTestAll = async () =>
    handleBatchTestAllAction({
      batchTesting,
      connections,
      setBatchTesting,
      setBatchTestResults,
      fetchConnections,
      providerId,
      t,
      notify,
    });

  const handleRefreshToken = async (connectionId: string) =>
    handleRefreshTokenAction(connectionId, {
      refreshingId,
      setRefreshingId,
      fetchConnections,
      notify,
      t,
    });

  const handleApplyCodexAuthLocal = async (connectionId: string) =>
    handleApplyCodexAuthLocalAction(connectionId, {
      applyingCodexAuthId,
      setApplyingCodexAuthId,
      notify,
      t,
    });

  const handleExportCodexAuthFile = async (connectionId: string) =>
    handleExportCodexAuthFileAction(connectionId, {
      exportingCodexAuthId,
      setExportingCodexAuthId,
      notify,
      t,
    });

  const handleSwapPriority = async (conn1: any, conn2: any) =>
    handleSwapPriorityAction(conn1, conn2, {
      connections,
      fetchConnections,
    });

  const handleImportModels = async () =>
    handleImportModelsAction({
      importingModels,
      connections,
      setImportingModels,
      setShowImportModal,
      setImportProgress,
      t,
      modelMeta,
      models,
      modelAliases,
      providerId,
      providerStorageAlias,
      handleSetAlias,
      fetchAliases,
      fetchProviderModelMeta,
    });

  const handleCompatibleImportWithProgress = async (
    fetchModels: () => Promise<{ models: any[] }>,
    processModel: (model: any) => Promise<boolean>,
  ) =>
    handleCompatibleImportWithProgressAction(fetchModels, processModel, {
      setShowImportModal,
      setImportProgress,
      t,
    });

  const canImportModels = connections.some((connection) => connection.isActive !== false);
  const autoSyncConnection = connections.find((connection: any) => connection.isActive !== false);
  const isAutoSyncEnabled = !!autoSyncConnection?.providerSpecificData?.autoSync;

  const handleToggleAutoSync = async () =>
    handleToggleAutoSyncAction({
      autoSyncConnection,
      togglingAutoSync,
      isAutoSyncEnabled,
      setTogglingAutoSync,
      fetchConnections,
      notify,
      t,
    });

  const providerAliasEntries = useMemo(
    () =>
      Object.entries(modelAliases).filter(([, model]) =>
        (model as string).startsWith(`${providerStorageAlias}/`),
      ),
    [modelAliases, providerStorageAlias],
  );

  const handleClearAllModels = async () =>
    handleClearAllModelsAction({
      clearingModels,
      providerStorageAlias,
      providerAliasEntries,
      setClearingModels,
      fetchProviderModelMeta,
      fetchAliases,
      notify,
      t,
    });

  return {
    loading,
    providerInfo,
    t,
    router,
    providerId,
    providerNode,
    connections,
    isCompatible,
    isOpenAICompatible,
    isCcCompatible,
    isAnthropicCompatible,
    isAnthropicProtocolCompatible,
    showAddApiKeyModal,
    setShowAddApiKeyModal,
    showEditNodeModal,
    setShowEditNodeModal,
    openPrimaryAddFlow,
    providerSupportsPat,
    isOAuth,
    proxyConfig,
    setProxyTarget,
    handleBatchTestAll,
    batchTesting,
    retestingId,
    handleRetestConnection,
    handleSwapPriority,
    handleUpdateConnectionStatus,
    handleToggleRateLimit,
    handleToggleCodexLimit,
    setSelectedConnection,
    setShowEditModal,
    handleDelete,
    setShowOAuthModal,
    refreshingId,
    handleRefreshToken,
    applyingCodexAuthId,
    handleApplyCodexAuthLocal,
    exportingCodexAuthId,
    handleExportCodexAuthFile,
    connProxyMap,
    isSearchProvider,
    modelMeta,
    compatSavingModelId,
    setCompatSavingModelId,
    copied,
    copy,
    modelAliases,
    fetchProviderModelMeta,
    providerStorageAlias,
    providerDisplayAlias,
    handleSetAlias,
    handleDeleteAlias,
    providerAliasEntries,
    compatibleSupportsModelImport,
    canImportModels,
    handleToggleAutoSync,
    togglingAutoSync,
    isAutoSyncEnabled,
    handleClearAllModels,
    clearingModels,
    importingModels,
    handleImportModels,
    isManagedAvailableModelsProvider,
    handleCompatibleImportWithProgress,
    modelFilter,
    setModelFilter,
    bulkVisibilityAction,
    togglingModelId,
    setTogglingModelId,
    setBulkVisibilityAction,
    models,
    providerAlias,
    showOAuthModal,
    handleOAuthSuccess,
    showEditModal,
    selectedConnection,
    handleUpdateConnection,
    handleSaveApiKey,
    headerImgError,
    setHeaderImgError,
    showImportModal,
    importProgress,
    setShowImportModal,
    batchTestResults,
    setBatchTestResults,
    proxyTarget,
    loadConnProxies,
    handleUpdateNode,
  };
}

export type ProviderDetailPageModel = ReturnType<typeof useProviderDetailPageModel>;
