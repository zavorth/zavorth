"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import {
  MAX_SELECTED_MODELS,
  sanitizeInput,
  useDebouncedValue,
  validateKeyName,
} from "../api-manager-client-helpers";
import type {
  AccessSchedule,
  ApiKey,
  KeyUsageStats,
  Model,
  ProviderConnection,
  ProviderGroup,
} from "../api-manager-client-helpers";

export function useApiManagerPage() {
  const t = useTranslations("apiManager");
  const tc = useTranslations("common");
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [allModels, setAllModels] = useState<Model[]>([]);
  const [allConnections, setAllConnections] = useState<ProviderConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [searchModel, setSearchModel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usageStats, setUsageStats] = useState<Record<string, KeyUsageStats>>({});
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [allowKeyReveal, setAllowKeyReveal] = useState(false);

  const { copied, copy } = useCopyToClipboard();

  const fetchUsageStats = async (apiKeys: ApiKey[]) => {
    if (apiKeys.length === 0) return;
    try {
      const res = await fetch("/api/usage/call-logs?limit=1000");
      if (!res.ok) return;
      const logs = await res.json();
      const stats: Record<string, KeyUsageStats> = {};

      for (const key of apiKeys) {
        const keyLogs = (logs || []).filter(
          (log: any) => log.apiKeyId === key.id || log.apiKeyName === key.name
        );
        stats[key.id] = {
          totalRequests: keyLogs.length,
          lastUsed:
            keyLogs.length > 0
              ? keyLogs.sort(
                  (a: any, b: any) =>
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                )[0]?.timestamp
              : null,
        };
      }
      setUsageStats(stats);
    } catch (e) {
      console.log("Error fetching usage stats:", e);
    }
  };

  const fetchSessionCounts = async (apiKeys: ApiKey[]) => {
    if (apiKeys.length === 0) {
      setSessionCounts({});
      return;
    }
    try {
      const res = await fetch("/api/sessions");
      if (!res.ok) return;
      const data = await res.json();
      const byApiKeyRaw =
        data && typeof data.byApiKey === "object" && !Array.isArray(data.byApiKey)
          ? data.byApiKey
          : {};
      const normalized: Record<string, number> = {};
      for (const key of apiKeys) {
        const value = byApiKeyRaw[key.id];
        normalized[key.id] =
          typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
      }
      setSessionCounts(normalized);
    } catch (error) {
      console.log("Error fetching session counts:", error);
    }
  };

  const fetchData = async () => {
    try {
      const res = await fetch("/api/keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
        setAllowKeyReveal(data.allowKeyReveal === true);
        fetchUsageStats(data.keys || []);
        fetchSessionCounts(data.keys || []);
      }
    } catch (error) {
      console.log("Error fetching keys:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchModels = async () => {
    try {
      const res = await fetch("/v1/models");
      if (res.ok) {
        const data = await res.json();
        setAllModels(data.data || []);
      }
    } catch (error) {
      console.log("Error fetching models:", error);
    }
  };

  const fetchConnections = async () => {
    try {
      const res = await fetch("/api/providers");
      if (res.ok) {
        const data = await res.json();
        setAllConnections(data.connections || []);
      }
    } catch (error) {
      console.log("Error fetching connections:", error);
    }
  };

  useEffect(() => {
    fetchData();
    fetchModels();
    fetchConnections();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const handleCreateKey = async () => {
    const sanitizedName = sanitizeInput(newKeyName);
    const validation = validateKeyName(sanitizedName, t);

    if (!validation.valid) {
      setError(validation.error || t("invalidKeyName"));
      return;
    }

    setIsSubmitting(true);
    clearError();

    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: sanitizedName }),
      });
      const data = await res.json();

      if (res.ok) {
        setCreatedKey(data.key);
        await fetchData();
        setNewKeyName("");
        setShowAddModal(false);
      } else {
        setError(data.error || t("failedCreateKey"));
      }
    } catch (error) {
      console.error("Error creating key:", error);
      setError(t("failedCreateKeyRetry"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!id || typeof id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(id)) {
      setError(t("invalidKeyId"));
      return;
    }

    if (!confirm(t("deleteConfirm"))) return;

    setIsSubmitting(true);
    clearError();

    try {
      const res = await fetch(`/api/keys/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
      } else {
        const data = await res.json();
        setError(data.error || t("failedDeleteKey"));
      }
    } catch (error) {
      console.error("Error deleting key:", error);
      setError(t("failedDeleteKeyRetry"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenPermissions = (key: ApiKey) => {
    if (!key || !key.id) return;
    setEditingKey(key);
    setShowPermissionsModal(true);
  };

  const handleCopyExistingKey = async (keyId: string) => {
    if (!keyId) return;

    try {
      const res = await fetch(`/api/keys/${encodeURIComponent(keyId)}/reveal`);
      if (!res.ok) {
        console.log("Error revealing key:", await res.text());
        return;
      }

      const data = await res.json();
      if (typeof data?.key === "string") {
        await copy(data.key, `existing_key_${keyId}`);
      }
    } catch (error) {
      console.log("Error copying existing key:", error);
    }
  };

  const handleUpdatePermissions = async (
    allowedModels: string[],
    noLog: boolean,
    allowedConnections: string[],
    autoResolve: boolean,
    isActive: boolean,
    maxSessions: number,
    accessSchedule: AccessSchedule | null
  ) => {
    if (!editingKey || !editingKey.id) return;

    if (!Array.isArray(allowedModels)) {
      setError(t("invalidModelsSelection"));
      return;
    }

    if (allowedModels.length > MAX_SELECTED_MODELS) {
      setError(t("cannotSelectMoreThanModels", { max: MAX_SELECTED_MODELS }));
      return;
    }

    const validModels = allowedModels.filter(
      (id) => typeof id === "string" && id.length > 0 && id.length < 200
    );

    const validConnections = allowedConnections.filter(
      (id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)
    );
    const normalizedMaxSessions =
      typeof maxSessions === "number" && Number.isFinite(maxSessions)
        ? Math.max(0, Math.floor(maxSessions))
        : 0;

    setIsSubmitting(true);
    clearError();

    try {
      const res = await fetch(`/api/keys/${encodeURIComponent(editingKey.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowedModels: validModels,
          allowedConnections: validConnections,
          noLog,
          autoResolve,
          isActive,
          maxSessions: normalizedMaxSessions,
          accessSchedule,
        }),
      });

      if (res.ok) {
        await fetchData();
        setShowPermissionsModal(false);
        setEditingKey(null);
      } else {
        const data = await res.json();
        setError(data.error || t("failedUpdatePermissions"));
      }
    } catch (error) {
      console.error("Error updating permissions:", error);
      setError(t("failedUpdatePermissionsRetry"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const debouncedSearchModel = useDebouncedValue(searchModel, 150);

  const modelsByProvider = useMemo((): ProviderGroup[] => {
    const grouped: Record<string, Model[]> = {};
    for (const model of allModels) {
      const provider = model.owned_by || t("unknownProvider");
      if (!grouped[provider]) grouped[provider] = [];
      grouped[provider].push(model);
    }
    return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allModels]);

  const filteredModelsByProvider = useMemo((): ProviderGroup[] => {
    if (!debouncedSearchModel.trim()) return modelsByProvider;

    const search = debouncedSearchModel.toLowerCase();
    return modelsByProvider
      .map(
        ([provider, models]): ProviderGroup => [
          provider,
          models.filter(
            (m) => m.id.toLowerCase().includes(search) || provider.toLowerCase().includes(search)
          ),
        ]
      )
      .filter(([, models]) => models.length > 0);
  }, [modelsByProvider, debouncedSearchModel]);

  return {
    allConnections,
    allModels,
    allowKeyReveal,
    clearError,
    copied,
    copy,
    createdKey,
    editingKey,
    error,
    filteredModelsByProvider,
    handleCopyExistingKey,
    handleCreateKey,
    handleDeleteKey,
    handleOpenPermissions,
    handleUpdatePermissions,
    isSubmitting,
    keys,
    loading,
    newKeyName,
    searchModel,
    sessionCounts,
    setCreatedKey,
    setEditingKey,
    setNewKeyName,
    setSearchModel,
    setShowAddModal,
    setShowPermissionsModal,
    showAddModal,
    showPermissionsModal,
    t,
    tc,
    usageStats,
  };
}
