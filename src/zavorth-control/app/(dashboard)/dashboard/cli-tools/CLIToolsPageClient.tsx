"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardSkeleton } from "@/shared/components";
import { CLI_TOOLS } from "@/shared/constants/cliTools";
import {
  PROVIDER_MODELS,
  getModelsByProviderId,
  PROVIDER_ID_TO_ALIAS,
} from "@/shared/constants/models";
import {
  ClaudeToolCard,
  CodexToolCard,
  DroidToolCard,
  ExternalExecutorToolCard,
  ClineToolCard,
  KiloToolCard,
  DefaultToolCard,
  ZavorthBridgeToolCard,
  CopilotToolCard,
} from "./components";
import { useTranslations } from "next-intl";

const CLOUD_URL = process.env.NEXT_PUBLIC_CLOUD_URL;

export default function CLIToolsPageClient({ machineId }) {
  const t = useTranslations("cliTools");
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedTool, setExpandedTool] = useState(null);
  const [modelMappings, setModelMappings] = useState({});
  const [cloudEnabled, setCloudEnabled] = useState(false);
  const [apiKeys, setApiKeys] = useState([]);
  const [toolStatuses, setToolStatuses] = useState({});
  const [statusesLoaded, setStatusesLoaded] = useState(false);
  const [dynamicModels, setDynamicModels] = useState([]);
  const translateOrFallback = useCallback(
    (key, fallback, values = undefined) => {
      try {
        return t(key, values);
      } catch {
        return fallback;
      }
    },
    [t]
  );

  useEffect(() => {
    fetchConnections();
    loadCloudSettings();
    fetchApiKeys();
    fetchToolStatuses();
    fetchDynamicModels();
  }, []);

  const loadCloudSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setCloudEnabled(data.cloudEnabled || false);
      }
    } catch (error) {
      console.log("Error loading cloud settings:", error);
    }
  };

  const fetchApiKeys = async () => {
    try {
      const res = await fetch("/api/keys");
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data.keys || []);
      }
    } catch (error) {
      console.log("Error fetching API keys:", error);
    }
  };

  const fetchToolStatuses = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s client timeout
      const res = await fetch("/api/cli-tools/status", { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        setToolStatuses(data || {});
      }
    } catch (error) {
      // Timeout or network error — proceed without statuses
      console.log("CLI tool status check timed out or failed:", error);
    } finally {
      setStatusesLoaded(true);
    }
  };

  const fetchConnections = async () => {
    try {
      const res = await fetch("/api/providers");
      const data = await res.json();
      if (res.ok) {
        setConnections(data.connections || []);
      }
    } catch (error) {
      console.log("Error fetching connections:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDynamicModels = async () => {
    try {
      const res = await fetch("/v1/models");
      if (res.ok) {
        const data = await res.json();
        setDynamicModels(data?.data || []);
      }
    } catch (error) {
      console.log("Error fetching dynamic models:", error);
    }
  };

  const getActiveProviders = () => {
    return connections.filter((c) => c.isActive !== false);
  };

  const getAllAvailableModels = () => {
    const activeProviders = getActiveProviders();
    const models = [];
    const seenModels = new Set();

    // First: add static models from the constants
    activeProviders.forEach((conn) => {
      const alias = PROVIDER_ID_TO_ALIAS[conn.provider] || conn.provider;
      const providerModels = getModelsByProviderId(conn.provider);
      providerModels.forEach((m) => {
        const modelValue = `${alias}/${m.id}`;
        if (!seenModels.has(modelValue)) {
          seenModels.add(modelValue);
          models.push({
            value: modelValue,
            label: `${alias}/${m.id}`,
            provider: conn.provider,
            alias: alias,
            connectionName: conn.name,
            modelId: m.id,
          });
        }
      });
    });

    // Second: add dynamic models from /v1/models (fills gaps for Kiro, OpenCode, custom providers)
    const activeProviderIds = new Set(activeProviders.map((c) => c.provider));
    const activeAliases = new Set(
      activeProviders.map((c) => PROVIDER_ID_TO_ALIAS[c.provider] || c.provider)
    );
    dynamicModels.forEach((dm) => {
      const modelId = dm.id || dm;
      if (seenModels.has(modelId)) return;
      // Parse alias/model format
      const slashIdx = modelId.indexOf("/");
      if (slashIdx === -1) return;
      const alias = modelId.substring(0, slashIdx);
      const bareModel = modelId.substring(slashIdx + 1);
      if (!activeAliases.has(alias) && !activeProviderIds.has(alias)) return;
      seenModels.add(modelId);
      models.push({
        value: modelId,
        label: modelId,
        provider: alias,
        alias: alias,
        connectionName: "",
        modelId: bareModel,
      });
    });

    return models;
  };

  const handleModelMappingChange = useCallback((toolId, modelAlias, targetModel) => {
    setModelMappings((prev) => {
      // Prevent unnecessary updates if value hasn't changed
      if (prev[toolId]?.[modelAlias] === targetModel) {
        return prev;
      }
      return {
        ...prev,
        [toolId]: {
          ...prev[toolId],
          [modelAlias]: targetModel,
        },
      };
    });
  }, []);

  const getBaseUrl = () => {
    if (cloudEnabled && CLOUD_URL) {
      return CLOUD_URL;
    }
    // Use window.location.origin directly — works correctly in Docker/reverse-proxy
    // Per @alpgul feedback: don't use baseUrl prop (has port duplication issues)
    if (typeof window !== "undefined") {
      return window.location.origin;
    }
    return "http://localhost:20128";
  };

  if (loading || !statusesLoaded) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  const availableModels = getAllAvailableModels();
  const hasActiveProviders = availableModels.length > 0;
  const activeProvidersSnapshot = getActiveProviders();
  const totalToolCount = Object.keys(CLI_TOOLS).length;

  const renderToolCard = (toolId, tool) => {
    const commonProps = {
      tool,
      isExpanded: expandedTool === toolId,
      onToggle: () => setExpandedTool(expandedTool === toolId ? null : toolId),
      baseUrl: getBaseUrl(),
      apiKeys,
      batchStatus: toolStatuses[toolId] || null,
      lastConfiguredAt: toolStatuses[toolId]?.lastConfiguredAt || null,
    };

    switch (toolId) {
      case "claude":
        return (
          <ClaudeToolCard
            key={toolId}
            {...commonProps}
            activeProviders={getActiveProviders()}
            modelMappings={modelMappings[toolId] || {}}
            onModelMappingChange={(alias, target) =>
              handleModelMappingChange(toolId, alias, target)
            }
            hasActiveProviders={hasActiveProviders}
            cloudEnabled={cloudEnabled}
          />
        );
      case "codex":
        return (
          <CodexToolCard
            key={toolId}
            {...commonProps}
            activeProviders={getActiveProviders()}
            cloudEnabled={cloudEnabled}
          />
        );
      case "droid":
        return (
          <DroidToolCard
            key={toolId}
            {...commonProps}
            activeProviders={getActiveProviders()}
            hasActiveProviders={hasActiveProviders}
            cloudEnabled={cloudEnabled}
          />
        );
      case "external-executor":
        return (
          <ExternalExecutorToolCard
            key={toolId}
            {...commonProps}
            activeProviders={getActiveProviders()}
            hasActiveProviders={hasActiveProviders}
            cloudEnabled={cloudEnabled}
          />
        );
      case "zavorthBridge":
        return (
          <ZavorthBridgeToolCard
            key={toolId}
            {...commonProps}
            activeProviders={getActiveProviders()}
            hasActiveProviders={hasActiveProviders}
            cloudEnabled={cloudEnabled}
          />
        );
      case "cline":
        return (
          <ClineToolCard
            key={toolId}
            {...commonProps}
            activeProviders={getActiveProviders()}
            hasActiveProviders={hasActiveProviders}
            cloudEnabled={cloudEnabled}
          />
        );
      case "kilo":
        return (
          <KiloToolCard
            key={toolId}
            {...commonProps}
            activeProviders={getActiveProviders()}
            hasActiveProviders={hasActiveProviders}
            cloudEnabled={cloudEnabled}
          />
        );
      case "copilot":
        return (
          <CopilotToolCard
            key={toolId}
            {...commonProps}
            activeProviders={getActiveProviders()}
            hasActiveProviders={hasActiveProviders}
            cloudEnabled={cloudEnabled}
          />
        );
      default:
        // #487: Any tool with configType "mitm" should use the MITM card (Start/Stop controls)
        if (tool.configType === "mitm") {
          return (
            <ZavorthBridgeToolCard
              key={toolId}
              {...commonProps}
              activeProviders={getActiveProviders()}
              hasActiveProviders={hasActiveProviders}
              cloudEnabled={cloudEnabled}
            />
          );
        }
        return (
          <DefaultToolCard
            key={toolId}
            toolId={toolId}
            {...commonProps}
            activeProviders={getActiveProviders()}
            cloudEnabled={cloudEnabled}
          />
        );
    }
  };

  const getToolDocsHref = (toolId, tool) => {
    if (typeof tool.docsUrl === "string" && tool.docsUrl.trim()) {
      return tool.docsUrl.trim();
    }
    return `/docs?section=cli-tools&tool=${toolId}`;
  };

  const getToolUseCase = (toolId, tool) => {
    const fallbackDescription = translateOrFallback(`toolDescriptions.${toolId}`, tool.description);
    return translateOrFallback(`toolUseCases.${toolId}`, fallbackDescription);
  };

  return (
    <div className="flex flex-col gap-6">
      <Card padding="none" className="overflow-hidden">
        <div className="relative overflow-hidden p-5 sm:p-6">
          <div className="absolute -right-16 -top-20 size-48 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -bottom-24 left-1/3 size-48 rounded-full bg-emerald-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                <span className="material-symbols-outlined text-[14px]">hub</span>
                Zavorth CLI control plane
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-text-main">
                Route local developer tools through one Zavorth gateway.
              </h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">
                Each card now owns a Zavorth-native setup state: runtime probe, credential route,
                model selection, backup handoff and compatibility notes stay explicit instead of
                mirroring the old subtree surface.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
              <div className="rounded-2xl border border-black/8 bg-white/70 p-3 shadow-sm dark:border-white/8 dark:bg-white/[0.04]">
                <p className="text-xl font-semibold text-text-main">{totalToolCount}</p>
                <p className="text-[11px] uppercase tracking-wide text-text-muted">tools</p>
              </div>
              <div className="rounded-2xl border border-black/8 bg-white/70 p-3 shadow-sm dark:border-white/8 dark:bg-white/[0.04]">
                <p className="text-xl font-semibold text-text-main">
                  {activeProvidersSnapshot.length}
                </p>
                <p className="text-[11px] uppercase tracking-wide text-text-muted">providers</p>
              </div>
              <div className="rounded-2xl border border-black/8 bg-white/70 p-3 shadow-sm dark:border-white/8 dark:bg-white/[0.04]">
                <p className="text-xl font-semibold text-text-main">
                  {cloudEnabled ? "Cloud" : "Local"}
                </p>
                <p className="text-[11px] uppercase tracking-wide text-text-muted">endpoint</p>
              </div>
            </div>
          </div>
          <div className="relative mt-5 grid grid-cols-1 gap-2 text-xs text-text-muted md:grid-cols-3">
            <div className="rounded-2xl border border-border/50 bg-black/[0.02] p-3 dark:bg-white/[0.02]">
              <span className="mb-1 block font-semibold text-text-main">{t("installationGuide")}</span>
              Runtime detection stays per tool, so unsupported machines degrade into guide mode.
            </div>
            <div className="rounded-2xl border border-border/50 bg-black/[0.02] p-3 dark:bg-white/[0.02]">
              <span className="mb-1 block font-semibold text-text-main">{t("configureEndpoint")}</span>
              The active Zavorth endpoint is injected into config writers and manual payloads.
            </div>
            <div className="rounded-2xl border border-border/50 bg-black/[0.02] p-3 dark:bg-white/[0.02]">
              <span className="mb-1 block font-semibold text-text-main">{t("testConnection")}</span>
              Status badges and backup metadata keep the operator aware of each handoff.
            </div>
          </div>
        </div>
      </Card>

      {!hasActiveProviders && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-yellow-500">warning</span>
            <div>
              <p className="font-medium text-yellow-600 dark:text-yellow-400">
                {t("noActiveProviders")}
              </p>
              <p className="text-sm text-text-muted">{t("noActiveProvidersDesc")}</p>
            </div>
          </div>
        </Card>
      )}

      <div className="flex flex-col gap-5">
        {Object.entries(CLI_TOOLS).map(([toolId, tool]) => {
          const docsHref = getToolDocsHref(toolId, tool);
          const isExternalDocs = /^https?:\/\//i.test(docsHref);
          return (
            <div key={toolId} className="flex flex-col gap-2.5">
              {renderToolCard(toolId, tool)}
              <div className="rounded-2xl border border-border/50 bg-black/[0.02] p-3 dark:bg-white/[0.02]">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                      {t("whenToUseLabel")}
                    </p>
                    <p className="mt-1 text-xs text-text-muted break-words">
                      {getToolUseCase(toolId, tool)}
                    </p>
                  </div>
                  <a
                    href={docsHref}
                    target={isExternalDocs ? "_blank" : undefined}
                    rel={isExternalDocs ? "noopener noreferrer" : undefined}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15"
                  >
                    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                      menu_book
                    </span>
                    {t("openToolDocs")}
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
