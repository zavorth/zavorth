"use client";

import { useState, useEffect, useCallback } from "react";
import { CardSkeleton, Button, Toggle } from "@/shared/components";
import { OAUTH_PROVIDERS, APIKEY_PROVIDERS } from "@/shared/constants/config";
import { FREE_PROVIDERS, isClaudeCodeCompatibleProvider } from "@/shared/constants/providers";
import { getErrorCode, getRelativeTime } from "@/shared/utils";
import { useNotificationStore } from "@/store/notificationStore";
import ModelAvailabilityBadge from "./components/ModelAvailabilityBadge";
import { useTranslations } from "next-intl";
import {
  buildMergedOAuthProviderEntries,
  buildProviderEntries,
  filterConfiguredProviderEntries,
} from "./providerPageUtils";
import { readConfiguredOnlyPreference, writeConfiguredOnlyPreference } from "./providerPageStorage";
import { ApiKeyProviderCard, ProviderCard } from "./provider-page-cards";
import {
  ADD_CC_COMPATIBLE_LABEL,
  CC_COMPATIBLE_LABEL,
  AddAnthropicCompatibleModal,
  AddCcCompatibleModal,
  AddOpenAICompatibleModal,
} from "./provider-page-modals";
import { ProviderTestResultsView } from "./provider-page-test-results";

function getConnectionErrorTag(connection) {
  if (!connection) return null;

  const explicitType = connection.lastErrorType;
  if (explicitType === "runtime_error") return "RUNTIME";
  if (
    explicitType === "upstream_auth_error" ||
    explicitType === "auth_missing" ||
    explicitType === "token_refresh_failed" ||
    explicitType === "token_expired"
  ) {
    return "AUTH";
  }
  if (explicitType === "upstream_rate_limited") return "429";
  if (explicitType === "upstream_unavailable") return "5XX";
  if (explicitType === "network_error") return "NET";

  const numericCode = Number(connection.errorCode);
  if (Number.isFinite(numericCode) && numericCode >= 400) {
    return String(numericCode);
  }

  const fromMessage = getErrorCode(connection.lastError);
  if (fromMessage === "401" || fromMessage === "403") return "AUTH";
  if (fromMessage && fromMessage !== "ERR") return fromMessage;

  const msg = (connection.lastError || "").toLowerCase();
  if (msg.includes("runtime") || msg.includes("not runnable") || msg.includes("not installed"))
    return "RUNTIME";
  if (
    msg.includes("invalid api key") ||
    msg.includes("token invalid") ||
    msg.includes("revoked") ||
    msg.includes("unauthorized")
  )
    return "AUTH";

  return "ERR";
}

function normalizePickerKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getPickerFamilies(modelPicker) {
  return Array.isArray(modelPicker?.families) ? modelPicker.families : [];
}

function getPickerRoutes(modelPicker) {
  return getPickerFamilies(modelPicker).flatMap((family) =>
    Array.isArray(family.routes) ? family.routes : []
  );
}

function findPickerRouteForProvider(modelPicker, providerId) {
  const expected = normalizePickerKey(providerId);
  if (!expected) return null;

  return getPickerRoutes(modelPicker).find((route) => {
    return [route.id, route.providerId, route.providerName, route.label]
      .map(normalizePickerKey)
      .includes(expected);
  }) || null;
}

function resolvePickerSelection(modelPicker) {
  const families = getPickerFamilies(modelPicker);
  const selected = modelPicker?.selected || {};
  const family = families.find((entry) => normalizePickerKey(entry.id) === normalizePickerKey(selected.familyId))
    || families.find((entry) => entry.ready === true)
    || families[0]
    || null;
  const routes = Array.isArray(family?.routes) ? family.routes : [];
  const route = routes.find((entry) => normalizePickerKey(entry.id) === normalizePickerKey(selected.routeId))
    || routes.find((entry) => entry.ready === true)
    || routes[0]
    || null;
  const models = Array.isArray(route?.models) ? route.models : [];
  const model = models.find((entry) => normalizePickerKey(entry.modelId) === normalizePickerKey(selected.modelId))
    || models.find((entry) => entry.primary === true)
    || models[0]
    || null;

  return { family, route, model, families, routes: getPickerRoutes(modelPicker) };
}

function ProvidersModelPickerSummary({ modelPicker, error }) {
  const { family, route, model, families, routes } = resolvePickerSelection(modelPicker);
  const readyRoutes = routes.filter((entry) => entry.ready === true);
  const fallbackRoutes = routes.filter((entry) => entry.catalogSource === "fallback_catalog" || entry.routeClass === "fallback");

  return (
    <section className="border border-border rounded-xl bg-bg-subtle/60 p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted">Model Picker</p>
          <h2 className="text-lg font-semibold">
            {family?.label || "Catalogo canonico"} / {model?.label || route?.label || "sem modelo"}
          </h2>
          <p className="text-sm text-text-muted">
            {route
              ? `${route.label} - ${route.readinessCode || route.readiness || "unknown"} - ${route.catalogSource || "catalog"}`
              : error || "Picker ainda nao retornou uma rota canonica."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-lg border border-border bg-bg-primary px-2.5 py-1">
            familias {families.length}
          </span>
          <span className="rounded-lg border border-border bg-bg-primary px-2.5 py-1">
            rotas prontas {readyRoutes.length}/{routes.length}
          </span>
          <span className="rounded-lg border border-border bg-bg-primary px-2.5 py-1">
            fallback {fallbackRoutes.length}
          </span>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-amber-500">{error}</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {families.slice(0, 4).map((entry) => (
            <div key={entry.id} className="rounded-lg border border-border bg-bg-primary p-3">
              <p className="font-medium text-sm">{entry.label}</p>
              <p className="text-xs text-text-muted">
                {entry.readiness} - {Array.isArray(entry.routes) ? entry.routes.length : 0} rotas
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function ProvidersPage() {
  const [connections, setConnections] = useState<any[]>([]);
  const [providerNodes, setProviderNodes] = useState<any[]>([]);
  const [modelPicker, setModelPicker] = useState<any>(null);
  const [modelPickerError, setModelPickerError] = useState<string | null>(null);
  const [ccCompatibleProviderEnabled, setCcCompatibleProviderEnabled] = useState(false);
  const [expirations, setExpirations] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAddCompatibleModal, setShowAddCompatibleModal] = useState(false);
  const [showAddAnthropicCompatibleModal, setShowAddAnthropicCompatibleModal] = useState(false);
  const [showAddCcCompatibleModal, setShowAddCcCompatibleModal] = useState(false);
  const [testingMode, setTestingMode] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<any>(null);
  const [importingZed, setImportingZed] = useState(false);
  const [showConfiguredOnly, setShowConfiguredOnly] = useState(false);
  const [configuredOnlyPreferenceReady, setConfiguredOnlyPreferenceReady] = useState(false);
  const [oauthEnvRepairStatus, setOauthEnvRepairStatus] = useState<{
    available: boolean;
    missingCount: number;
  } | null>(null);
  const [repairingEnv, setRepairingEnv] = useState(false);
  const notify = useNotificationStore();
  const t = useTranslations("providers");
  const tc = useTranslations("common");

  useEffect(() => {
    setShowConfiguredOnly(readConfiguredOnlyPreference());
    setConfiguredOnlyPreferenceReady(true);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const pickerRequest = fetch("/api/onboarding/model-picker?includeAdvanced=true").catch(() => null);
        const [connectionsRes, nodesRes, expirationsRes, pickerRes] = await Promise.all([
          fetch("/api/providers"),
          fetch("/api/provider-nodes"),
          fetch("/api/providers/expiration"),
          pickerRequest,
        ]);
        const connectionsData = await connectionsRes.json();
        const nodesData = await nodesRes.json();
        const expirationsData = await expirationsRes.json();
        if (connectionsRes.ok) setConnections(connectionsData.connections || []);
        if (nodesRes.ok) {
          setProviderNodes(nodesData.nodes || []);
          setCcCompatibleProviderEnabled(nodesData.ccCompatibleProviderEnabled === true);
        }
        if (expirationsRes.ok && expirationsData) setExpirations(expirationsData);
        if (pickerRes) {
          const pickerData = await pickerRes.json().catch(() => null);
          if (pickerRes.ok && pickerData?.picker) {
            setModelPicker(pickerData.picker);
            setModelPickerError(null);
          } else {
            setModelPicker(null);
            setModelPickerError("Model Picker indisponivel; providers seguem com estados atuais.");
          }
        } else {
          setModelPickerError("Model Picker indisponivel; providers seguem com estados atuais.");
        }
      } catch (error) {
        console.log("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!configuredOnlyPreferenceReady) return;

    writeConfiguredOnlyPreference(showConfiguredOnly);
  }, [configuredOnlyPreferenceReady, showConfiguredOnly]);

  const fetchOauthEnvRepairStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/system/env/repair", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setOauthEnvRepairStatus({
          available: Boolean(data.available),
          missingCount: Number(data.missingCount || 0),
        });
      } else {
        setOauthEnvRepairStatus(null);
      }
    } catch {
      setOauthEnvRepairStatus(null);
    }
  }, []);

  useEffect(() => {
    void fetchOauthEnvRepairStatus();
  }, [fetchOauthEnvRepairStatus]);

  const handleZedImport = async () => {
    setImportingZed(true);
    try {
      const res = await fetch("/api/providers/zed/import", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.count > 0) {
          notify.success(
            `Imported ${data.count} credentials from Zed IDE (${data.providers.join(", ")}).`
          );
          // Refresh connections silently
          const connectionsRes = await fetch("/api/providers");
          const connectionsData = await connectionsRes.json();
          if (connectionsRes.ok) setConnections(connectionsData.connections || []);
        } else {
          notify.info("No supported OAuth credentials found in Zed IDE.");
        }
      } else {
        notify.error(data.error || "Failed to import from Zed IDE.");
      }
    } catch (error) {
      notify.error("Network error while trying to import from Zed.");
    } finally {
      setImportingZed(false);
    }
  };

  const handleRepairEnv = async () => {
    if (!oauthEnvRepairStatus?.available || repairingEnv) return;

    setRepairingEnv(true);
    try {
      const res = await fetch("/api/system/env/repair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t("repairEnvFailed"));
      }
      notify.success(
        data.backupPath ? `${t("repairEnvSuccess")} (${data.backupPath})` : t("repairEnvSuccess")
      );
      await fetchOauthEnvRepairStatus();
    } catch (error) {
      notify.error(error instanceof Error ? error.message : t("repairEnvFailed"));
    } finally {
      setRepairingEnv(false);
    }
  };

  const getProviderStats = (providerId, authType) => {
    const providerConnections = connections.filter((c) => {
      if (c.provider !== providerId) return false;
      if (authType === "free") return true;
      return c.authType === authType;
    });

    // Helper: check if connection is effectively active (cooldown expired)
    const getEffectiveStatus = (conn) => {
      const isCooldown =
        conn.rateLimitedUntil && new Date(conn.rateLimitedUntil).getTime() > Date.now();
      return conn.testStatus === "unavailable" && !isCooldown ? "active" : conn.testStatus;
    };

    const connected = providerConnections.filter((c) => {
      const status = getEffectiveStatus(c);
      return status === "active" || status === "success";
    }).length;

    const errorConns = providerConnections.filter((c) => {
      const status = getEffectiveStatus(c);
      return status === "error" || status === "expired" || status === "unavailable";
    });

    const error = errorConns.length;
    const total = providerConnections.length;

    // Check if all connections are manually disabled
    const allDisabled = total > 0 && providerConnections.every((c) => c.isActive === false);

    // Get latest error info
    const latestError = errorConns.sort(
      (a: any, b: any) =>
        (new Date(b.lastErrorAt || 0) as any) - (new Date(a.lastErrorAt || 0) as any)
    )[0];
    const errorCode = latestError ? getConnectionErrorTag(latestError) : null;
    const errorTime = latestError?.lastErrorAt ? getRelativeTime(latestError.lastErrorAt) : null;

    // Check expirations
    const providerExpirations =
      expirations?.list?.filter((e: any) => e.provider === providerId) || [];
    const hasExpired = providerExpirations.some((e: any) => e.status === "expired");
    const hasExpiringSoon = providerExpirations.some((e: any) => e.status === "expiring_soon");
    let expiryStatus = null;
    if (hasExpired) expiryStatus = "expired";
    else if (hasExpiringSoon) expiryStatus = "expiring_soon";

    return { connected, error, total, errorCode, errorTime, allDisabled, expiryStatus };
  };

  // Toggle all connections for a provider on/off
  const handleToggleProvider = async (providerId: string, authType: string, newActive: boolean) => {
    const providerConns = connections.filter((c) => {
      if (c.provider !== providerId) return false;
      if (authType === "free") return true;
      return c.authType === authType;
    });
    // Optimistically update UI
    setConnections((prev) =>
      prev.map((c) =>
        c.provider === providerId && (authType === "free" || c.authType === authType)
          ? { ...c, isActive: newActive }
          : c
      )
    );
    // Fire API calls in parallel
    await Promise.allSettled(
      providerConns.map((c) =>
        fetch(`/api/providers/${c.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: newActive }),
        })
      )
    );
  };

  const handleBatchTest = async (mode, providerId = null) => {
    if (testingMode) return;
    setTestingMode(mode === "provider" ? providerId : mode);
    setTestResults(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90_000); // 90s max
    try {
      const res = await fetch("/api/providers/test-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, providerId }),
        signal: controller.signal,
      });
      let data: any;
      try {
        data = await res.json();
      } catch {
        // Response body is not valid JSON (e.g. truncated due to timeout)
        data = { error: t("providerTestFailed"), results: [], summary: null };
      }
      setTestResults({
        ...data,
        // Normalize error: if API returns an error object { message, details }, extract the string
        error: data.error
          ? typeof data.error === "object"
            ? data.error.message || data.error.error || JSON.stringify(data.error)
            : String(data.error)
          : null,
      });
      if (data?.summary) {
        const { passed, failed, total } = data.summary;
        if (failed === 0) notify.success(t("allTestsPassed", { total }));
        else notify.warning(t("testSummary", { passed, failed, total }));
      }
    } catch (error: any) {
      const isAbort = error?.name === "AbortError";
      const msg = isAbort ? t("providerTestTimeout") : t("providerTestFailed");
      setTestResults({ error: msg, results: [], summary: null });
      notify.error(msg);
    } finally {
      clearTimeout(timeoutId);
      setTestingMode(null);
    }
  };

  const compatibleProviders = providerNodes
    .filter((node) => node.type === "openai-compatible")
    .map((node) => ({
      id: node.id,
      name: node.name || t("openaiCompatibleName"),
      color: "#10A37F",
      textIcon: "OC",
      apiType: node.apiType,
    }));

  const anthropicCompatibleProviders = providerNodes
    .filter(
      (node) => node.type === "anthropic-compatible" && !isClaudeCodeCompatibleProvider(node.id)
    )
    .map((node) => ({
      id: node.id,
      name: node.name || t("anthropicCompatibleName"),
      color: "#D97757",
      textIcon: "AC",
    }));

  const ccCompatibleProviders = providerNodes
    .filter(
      (node) => node.type === "anthropic-compatible" && isClaudeCodeCompatibleProvider(node.id)
    )
    .map((node) => ({
      id: node.id,
      name: node.name || CC_COMPATIBLE_LABEL,
      color: "#B45309",
      textIcon: "CC",
    }));

  const oauthProviderEntries = filterConfiguredProviderEntries(
    buildMergedOAuthProviderEntries(OAUTH_PROVIDERS, FREE_PROVIDERS, getProviderStats),
    showConfiguredOnly
  );

  const apiKeyProviderEntries = filterConfiguredProviderEntries(
    buildProviderEntries(APIKEY_PROVIDERS, "apikey", "apikey", getProviderStats),
    showConfiguredOnly
  );

  const compatibleProviderEntries = filterConfiguredProviderEntries(
    [
      ...compatibleProviders.map((provider) => ({
        providerId: provider.id,
        provider,
        stats: getProviderStats(provider.id, "apikey"),
        displayAuthType: "compatible" as const,
        toggleAuthType: "apikey" as const,
      })),
      ...anthropicCompatibleProviders.map((provider) => ({
        providerId: provider.id,
        provider,
        stats: getProviderStats(provider.id, "apikey"),
        displayAuthType: "compatible" as const,
        toggleAuthType: "apikey" as const,
      })),
      ...ccCompatibleProviders.map((provider) => ({
        providerId: provider.id,
        provider,
        stats: getProviderStats(provider.id, "apikey"),
        displayAuthType: "compatible" as const,
        toggleAuthType: "apikey" as const,
      })),
    ],
    showConfiguredOnly
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Expiration Banner */}
      {expirations?.summary &&
        (expirations.summary.expired > 0 || expirations.summary.expiringSoon > 0) && (
          <div
            className={`p-4 rounded-xl flex items-start gap-3 border ${
              expirations.summary.expired > 0
                ? "bg-red-500/10 border-red-500/20"
                : "bg-amber-500/10 border-amber-500/20"
            }`}
          >
            <span
              className={`material-symbols-outlined text-[24px] ${
                expirations.summary.expired > 0 ? "text-red-500" : "text-amber-500"
              }`}
            >
              {expirations.summary.expired > 0 ? "error" : "warning"}
            </span>
            <div className="flex-1">
              <h3
                className={`font-semibold ${expirations.summary.expired > 0 ? "text-red-500" : "text-amber-500"}`}
              >
                {expirations.summary.expired > 0
                  ? `${expirations.summary.expired} Provider connection(s) expired`
                  : `${expirations.summary.expiringSoon} Provider connection(s) expiring soon`}
              </h3>
              <p className="text-sm mt-1 opacity-80 text-text-main">
                {expirations.summary.expired > 0
                  ? "Immediate action required. Expired connections will permanently fail."
                  : "Please review and renew expiring connections to avoid disruption."}
              </p>
            </div>
          </div>
        )}

      <ProvidersModelPickerSummary modelPicker={modelPicker} error={modelPickerError} />

      {/* OAuth Providers (including providers that expose free tiers via OAuth) */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold flex items-center gap-2 flex-1 min-w-0">
            {t("oauthProviders")}{" "}
            <span className="size-2.5 rounded-full bg-blue-500" title={t("oauthLabel")} />
          </h2>
          <div className="flex items-center gap-2">
            <ModelAvailabilityBadge />
            <Toggle
              size="sm"
              checked={showConfiguredOnly}
              onChange={setShowConfiguredOnly}
              label={t("showConfiguredOnly")}
              className="rounded-lg border border-border bg-bg-subtle px-3 py-1.5"
            />
            <button
              onClick={handleZedImport}
              disabled={importingZed}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors bg-bg-subtle border-border text-text-muted hover:text-text-primary hover:border-primary/40`}
              title="Import credentials from Zed IDE"
            >
              <span
                className={`material-symbols-outlined text-[14px] ${importingZed ? "animate-spin" : ""}`}
              >
                {importingZed ? "sync" : "download"}
              </span>
              {importingZed ? "Importing..." : "Import from Zed"}
            </button>
            {oauthEnvRepairStatus?.available && oauthEnvRepairStatus.missingCount > 0 && (
              <button
                onClick={handleRepairEnv}
                disabled={repairingEnv}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  repairingEnv
                    ? "bg-primary/20 border-primary/40 text-primary animate-pulse"
                    : "bg-bg-subtle border-border text-text-muted hover:text-text-primary hover:border-primary/40"
                }`}
                title={t("repairEnvHint")}
                aria-label={t("repairEnv")}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {repairingEnv ? "sync" : "settings_backup_restore"}
                </span>
                {repairingEnv ? t("repairEnvWorking") : t("repairEnv")}
              </button>
            )}
            <button
              onClick={() => handleBatchTest("oauth")}
              disabled={!!testingMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                testingMode === "oauth"
                  ? "bg-primary/20 border-primary/40 text-primary animate-pulse"
                  : "bg-bg-subtle border-border text-text-muted hover:text-text-primary hover:border-primary/40"
              }`}
              title={t("testAllOAuth")}
              aria-label={t("testAllOAuth")}
            >
              <span className="material-symbols-outlined text-[14px]">
                {testingMode === "oauth" ? "sync" : "play_arrow"}
              </span>
              {testingMode === "oauth" ? t("testing") : t("testAll")}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {oauthProviderEntries.map(
            ({ providerId, provider, stats, displayAuthType, toggleAuthType }) => (
              <ProviderCard
                key={providerId}
                providerId={providerId}
                provider={provider}
                stats={stats}
                authType={displayAuthType}
                onToggle={(active) => handleToggleProvider(providerId, toggleAuthType, active)}
                pickerRoute={findPickerRouteForProvider(modelPicker, providerId)}
              />
            )
          )}
        </div>
      </div>

      {/* API Key Providers — fixed list */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold flex items-center gap-2 flex-1 min-w-0">
            {t("apiKeyProviders")}{" "}
            <span className="size-2.5 rounded-full bg-amber-500" title={t("apiKeyLabel")} />
          </h2>
          <button
            onClick={() => handleBatchTest("apikey")}
            disabled={!!testingMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              testingMode === "apikey"
                ? "bg-primary/20 border-primary/40 text-primary animate-pulse"
                : "bg-bg-subtle border-border text-text-muted hover:text-text-primary hover:border-primary/40"
            }`}
            title={t("testAllApiKey")}
            aria-label={t("testAllApiKey")}
          >
            <span className="material-symbols-outlined text-[14px]">
              {testingMode === "apikey" ? "sync" : "play_arrow"}
            </span>
            {testingMode === "apikey" ? t("testing") : t("testAll")}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {apiKeyProviderEntries.map(
            ({ providerId, provider, stats, displayAuthType, toggleAuthType }) => (
              <ApiKeyProviderCard
                key={providerId}
                providerId={providerId}
                provider={provider}
                stats={stats}
                authType={displayAuthType}
                onToggle={(active) => handleToggleProvider(providerId, toggleAuthType, active)}
                pickerRoute={findPickerRouteForProvider(modelPicker, providerId)}
              />
            )
          )}
        </div>
      </div>

      {/* API Key Compatible Providers — dynamic (OpenAI/Anthropic compatible) */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold flex items-center gap-2 flex-1 min-w-0">
            {t("compatibleProviders")}{" "}
            <span className="size-2.5 rounded-full bg-orange-500" title={t("compatibleLabel")} />
          </h2>
          <div className="flex flex-wrap gap-2">
            {(compatibleProviders.length > 0 ||
              anthropicCompatibleProviders.length > 0 ||
              ccCompatibleProviders.length > 0) && (
              <button
                onClick={() => handleBatchTest("compatible")}
                disabled={!!testingMode}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  testingMode === "compatible"
                    ? "bg-primary/20 border-primary/40 text-primary animate-pulse"
                    : "bg-bg-subtle border-border text-text-muted hover:text-text-primary hover:border-primary/40"
                }`}
                title={t("testAllCompatible")}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {testingMode === "compatible" ? "sync" : "play_arrow"}
                </span>
                {testingMode === "compatible" ? t("testing") : t("testAll")}
              </button>
            )}
            {ccCompatibleProviderEnabled && (
              <Button size="sm" icon="add" onClick={() => setShowAddCcCompatibleModal(true)}>
                {ADD_CC_COMPATIBLE_LABEL}
              </Button>
            )}
            <Button size="sm" icon="add" onClick={() => setShowAddAnthropicCompatibleModal(true)}>
              {t("addAnthropicCompatible")}
            </Button>
            <Button size="sm" icon="add" onClick={() => setShowAddCompatibleModal(true)}>
              {t("addOpenAICompatible")}
            </Button>
          </div>
        </div>
        {compatibleProviders.length === 0 &&
        anthropicCompatibleProviders.length === 0 &&
        ccCompatibleProviders.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-xl">
            <span className="material-symbols-outlined text-[32px] text-text-muted mb-2">
              extension
            </span>
            <p className="text-text-muted text-sm">{t("noCompatibleYet")}</p>
            <p className="text-text-muted text-xs mt-1">{t("compatibleHint")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {compatibleProviderEntries.map(
              ({ providerId, provider, stats, displayAuthType, toggleAuthType }) => (
                <ApiKeyProviderCard
                  key={providerId}
                  providerId={providerId}
                  provider={provider}
                  stats={stats}
                  authType={displayAuthType}
                  onToggle={(active) => handleToggleProvider(providerId, toggleAuthType, active)}
                  pickerRoute={findPickerRouteForProvider(modelPicker, providerId)}
                />
              )
            )}
          </div>
        )}
      </div>
      <AddOpenAICompatibleModal
        isOpen={showAddCompatibleModal}
        onClose={() => setShowAddCompatibleModal(false)}
        onCreated={(node) => {
          setProviderNodes((prev) => [...prev, node]);
          setShowAddCompatibleModal(false);
        }}
      />
      <AddAnthropicCompatibleModal
        isOpen={showAddAnthropicCompatibleModal}
        onClose={() => setShowAddAnthropicCompatibleModal(false)}
        onCreated={(node) => {
          setProviderNodes((prev) => [...prev, node]);
          setShowAddAnthropicCompatibleModal(false);
        }}
      />
      {ccCompatibleProviderEnabled && (
        <AddCcCompatibleModal
          isOpen={showAddCcCompatibleModal}
          onClose={() => setShowAddCcCompatibleModal(false)}
          onCreated={(node) => {
            setProviderNodes((prev) => [...prev, node]);
            setShowAddCcCompatibleModal(false);
          }}
        />
      )}
      {/* Test Results Modal */}
      {testResults && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
          onClick={() => setTestResults(null)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-bg-primary border border-border rounded-xl w-full max-w-[600px] max-h-[80vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-border bg-bg-primary/95 backdrop-blur-sm rounded-t-xl">
              <h3 className="font-semibold">{t("testResults")}</h3>
              <button
                onClick={() => setTestResults(null)}
                className="p-1 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-text-primary transition-colors"
                aria-label={tc("close")}
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <div className="p-5">
              <ProviderTestResultsView results={testResults} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
