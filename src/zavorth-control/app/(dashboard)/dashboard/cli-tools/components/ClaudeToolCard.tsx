"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ManualConfigModal, ModelSelectModal } from "@/shared/components";
import { useTranslations } from "next-intl";
import CliStatusBadge from "./CliStatusBadge";
import CliToolCardFrame, {
  CliToolCardSection,
  CliToolLabeledField,
  CliToolMetaPill,
  CliToolNotice,
} from "./CliToolCardFrame";

const CLOUD_URL = process.env.NEXT_PUBLIC_CLOUD_URL;

const fieldClassName =
  "w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm text-text-main outline-none transition focus:border-primary/40 focus:ring-0 dark:border-white/10 dark:bg-white/[0.05]";

function toV1Url(url: string) {
  return url.endsWith("/v1") ? url : `${url}/v1`;
}

export default function ClaudeToolCard({
  tool,
  isExpanded,
  onToggle,
  activeProviders,
  modelMappings,
  onModelMappingChange,
  baseUrl,
  hasActiveProviders,
  apiKeys,
  cloudEnabled,
  batchStatus,
  lastConfiguredAt,
}) {
  const t = useTranslations("cliTools");
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
  const [claudeStatus, setClaudeStatus] = useState(null);
  const [checkingClaude, setCheckingClaude] = useState(false);
  const [applying, setApplying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentEditingAlias, setCurrentEditingAlias] = useState(null);
  const [selectedApiKey, setSelectedApiKey] = useState("");
  const [modelAliases, setModelAliases] = useState({});
  const [showManualConfigModal, setShowManualConfigModal] = useState(false);
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [backups, setBackups] = useState([]);
  const [showBackups, setShowBackups] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(null);
  const hasInitializedModels = useRef(false);
  const cliReady = !!(claudeStatus?.installed && claudeStatus?.runnable);

  const getConfigStatus = () => {
    if (!cliReady) return null;
    const currentUrl = claudeStatus.settings?.env?.ANTHROPIC_BASE_URL;
    if (!currentUrl) return "not_configured";
    const localMatch = currentUrl.includes("localhost") || currentUrl.includes("127.0.0.1");
    const cloudMatch = cloudEnabled && CLOUD_URL && currentUrl.startsWith(CLOUD_URL);
    if (localMatch || cloudMatch) return "configured";
    return "other";
  };

  const configStatus = getConfigStatus();
  const effectiveConfigStatus = configStatus || batchStatus?.configStatus || null;

  useEffect(() => {
    if (apiKeys?.length > 0 && !selectedApiKey) {
      setSelectedApiKey(apiKeys[0].id);
    }
  }, [apiKeys, selectedApiKey]);

  useEffect(() => {
    if (isExpanded && !claudeStatus) {
      checkClaudeStatus();
      fetchModelAliases();
      fetchBackups();
    }
  }, [isExpanded, claudeStatus]);

  useEffect(() => {
    if (!claudeStatus?.installed || hasInitializedModels.current) return;

    hasInitializedModels.current = true;
    const env = claudeStatus.settings?.env || {};

    (tool.defaultModels || []).forEach((model) => {
      if (!model.envKey) return;
      const value = env[model.envKey] || model.defaultValue || "";
      if (value) {
        onModelMappingChange(model.alias, value);
      }
    });

    const tokenFromFile = env.ANTHROPIC_AUTH_TOKEN;
    if (tokenFromFile) {
      const matchedKey = apiKeys?.find((key) => key.key === tokenFromFile);
      if (matchedKey) setSelectedApiKey(matchedKey.id);
    }
  }, [apiKeys, claudeStatus, onModelMappingChange, tool.defaultModels]);

  const fetchModelAliases = async () => {
    try {
      const res = await fetch("/api/models/alias");
      const data = await res.json();
      if (res.ok) setModelAliases(data.aliases || {});
    } catch (error) {
      console.log("Error fetching model aliases:", error);
    }
  };

  const checkClaudeStatus = async () => {
    setCheckingClaude(true);
    try {
      const res = await fetch("/api/cli-tools/claude-settings");
      const data = await res.json();
      setClaudeStatus(data);
    } catch (error) {
      setClaudeStatus({ installed: false, error: error.message });
    } finally {
      setCheckingClaude(false);
    }
  };

  const fetchBackups = async () => {
    try {
      const res = await fetch("/api/cli-tools/backups?tool=claude");
      const data = await res.json();
      if (res.ok) setBackups(data.backups || []);
    } catch (error) {
      console.log("Error fetching backups:", error);
    }
  };

  const getEffectiveBaseUrl = () => toV1Url(customBaseUrl || baseUrl || "http://localhost:20128");
  const getDisplayUrl = () => customBaseUrl || toV1Url(baseUrl || "http://localhost:20128");

  const getSelectedKeyForManualConfig = () => {
    const selectedKey = apiKeys?.find((key) => key.id === selectedApiKey || key.key === selectedApiKey);
    if (selectedKey?.key) return selectedKey.key;
    return !cloudEnabled ? "sk_ZavorthGateway" : "<API_KEY_FROM_DASHBOARD>";
  };

  const handleApplySettings = async () => {
    setApplying(true);
    setMessage(null);
    try {
      const env: any = { ANTHROPIC_BASE_URL: getEffectiveBaseUrl() };
      const selectedKeyId = selectedApiKey?.trim() || (apiKeys?.length > 0 ? apiKeys[0].id : null);

      if (!selectedKeyId && !cloudEnabled) {
        env.ANTHROPIC_AUTH_TOKEN = "sk_ZavorthGateway";
      }

      (tool.defaultModels || []).forEach((model) => {
        const targetModel = modelMappings[model.alias];
        if (targetModel && model.envKey) env[model.envKey] = targetModel;
      });

      const postBody: Record<string, unknown> = { env };
      if (selectedKeyId) postBody.keyId = selectedKeyId;

      const res = await fetch("/api/cli-tools/claude-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postBody),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: translateOrFallback("settingsApplied", "Settings applied") });
        setClaudeStatus((prev) => ({
          ...prev,
          hasBackup: true,
          settings: { ...prev?.settings, env },
        }));
        await fetchBackups();
      } else {
        setMessage({
          type: "error",
          text: data.error || translateOrFallback("failedApplySettings", "Failed to apply"),
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setApplying(false);
    }
  };

  const handleResetSettings = async () => {
    setRestoring(true);
    setMessage(null);
    try {
      const res = await fetch("/api/cli-tools/claude-settings", { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: translateOrFallback("settingsReset", "Settings reset") });
        (tool.defaultModels || []).forEach((model) =>
          onModelMappingChange(model.alias, model.defaultValue || "")
        );
        setSelectedApiKey("");
        await checkClaudeStatus();
        await fetchBackups();
      } else {
        setMessage({
          type: "error",
          text: data.error || translateOrFallback("failedResetSettings", "Failed to reset"),
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setRestoring(false);
    }
  };

  const handleRestoreBackup = async (backupId) => {
    setRestoringBackup(backupId);
    setMessage(null);
    try {
      const res = await fetch("/api/cli-tools/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "claude", backupId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: translateOrFallback("backupRestored", "Backup restored") });
        await checkClaudeStatus();
        await fetchBackups();
      } else {
        setMessage({
          type: "error",
          text: data.error || translateOrFallback("failedRestore", "Failed to restore"),
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setRestoringBackup(null);
    }
  };

  const openModelSelector = (alias) => {
    setCurrentEditingAlias(alias);
    setModalOpen(true);
  };

  const handleModelSelect = (model) => {
    if (currentEditingAlias) onModelMappingChange(currentEditingAlias, model.value);
  };

  const getManualConfigs = () => {
    const env = {
      ANTHROPIC_BASE_URL: getEffectiveBaseUrl(),
      ANTHROPIC_AUTH_TOKEN: getSelectedKeyForManualConfig(),
    };

    (tool.defaultModels || []).forEach((model) => {
      const targetModel = modelMappings[model.alias];
      if (targetModel && model.envKey) env[model.envKey] = targetModel;
    });

    return [
      {
        filename: "~/.claude/settings.json",
        content: JSON.stringify({ env }, null, 2),
      },
    ];
  };

  const renderRuntimeNotice = () => {
    if (checkingClaude) {
      return (
        <CliToolNotice
          tone="info"
          icon="progress_activity"
          title={translateOrFallback("checkingCli", "Checking Claude", { tool: "Claude" })}
        >
          <p>
            {translateOrFallback(
              "cards.claude.probing",
              "Zavorth is reading Claude Code settings before preparing the env handoff."
            )}
          </p>
        </CliToolNotice>
      );
    }

    if (!claudeStatus) return null;

    if (!cliReady) {
      return (
        <CliToolNotice
          tone="warning"
          icon="warning"
          title={
            claudeStatus.installed
              ? translateOrFallback("cliNotRunnable", "Claude is not runnable", { tool: "Claude" })
              : translateOrFallback("cliNotInstalled", "Claude is not installed", { tool: "Claude" })
          }
        >
          <p>
            {claudeStatus.installed
              ? translateOrFallback(
                  "cliFoundFailedHealthcheck",
                  `Claude was found, but its health check failed${
                    claudeStatus.reason ? ` (${claudeStatus.reason})` : ""
                  }.`,
                  { tool: "Claude", reason: claudeStatus.reason ? ` (${claudeStatus.reason})` : "" }
                )
              : translateOrFallback(
                  "installCliPrompt",
                  "Install Claude Code, then reopen this card.",
                  { tool: "Claude" }
                )}
          </p>
        </CliToolNotice>
      );
    }

    return (
      <CliToolNotice
        tone={configStatus === "configured" ? "success" : "info"}
        icon={configStatus === "configured" ? "check_circle" : "terminal"}
        title={
          configStatus === "configured"
            ? translateOrFallback("cards.claude.configured", "Claude Code is routed through Zavorth")
            : translateOrFallback("cards.claude.ready", "Claude Code is ready for routing")
        }
      >
        <div className="flex flex-wrap gap-2">
          {claudeStatus.commandPath ? (
            <CliToolMetaPill icon="terminal">
              <code>{claudeStatus.commandPath}</code>
            </CliToolMetaPill>
          ) : null}
          {claudeStatus.settings?.env?.ANTHROPIC_BASE_URL ? (
            <CliToolMetaPill icon="route">
              <code>{claudeStatus.settings.env.ANTHROPIC_BASE_URL}</code>
            </CliToolMetaPill>
          ) : null}
        </div>
      </CliToolNotice>
    );
  };

  return (
    <>
      <CliToolCardFrame
        tool={{ ...tool, image: tool.image || "/providers/claude.png" }}
        toolKey="claude"
        isExpanded={isExpanded}
        onToggle={onToggle}
        eyebrow={translateOrFallback("cards.claude.eyebrow", "Env orchestration surface")}
        summary={translateOrFallback("toolDescriptions.claude", tool.description)}
        status={
          <CliStatusBadge
            effectiveConfigStatus={effectiveConfigStatus}
            batchStatus={batchStatus}
            lastConfiguredAt={lastConfiguredAt}
          />
        }
        meta={
          <>
            <CliToolMetaPill icon="terminal">claude</CliToolMetaPill>
            <CliToolMetaPill icon="model_training">
              {(tool.defaultModels || []).length} aliases
            </CliToolMetaPill>
          </>
        }
      >
        <CliToolCardSection
          title={translateOrFallback("cards.claude.statusTitle", "Claude runtime")}
          description={translateOrFallback(
            "cards.claude.statusDescription",
            "Zavorth keeps Claude Code configuration explicit: endpoint, auth token and model aliases are handled together."
          )}
          icon="monitoring"
        >
          {renderRuntimeNotice()}

          {!cliReady && claudeStatus ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowInstallGuide(!showInstallGuide)}
                icon={showInstallGuide ? "expand_less" : "help"}
                className="self-start"
              >
                {showInstallGuide
                  ? translateOrFallback("hide", "Hide")
                  : translateOrFallback("howToInstall", "How to install")}
              </Button>
              {showInstallGuide ? (
                <div className="rounded-2xl border border-black/8 bg-black/[0.025] p-4 dark:border-white/8 dark:bg-white/[0.03]">
                  <p className="mb-3 text-sm font-semibold text-text-main">
                    {translateOrFallback("installationGuide", "Installation guide")}
                  </p>
                  <code className="block rounded-xl bg-black/[0.04] px-3 py-2 font-mono text-xs dark:bg-white/[0.06]">
                    npm install -g @anthropic-ai/claude-code
                  </code>
                  <p className="mt-3 text-sm text-text-muted">
                    {translateOrFallback("afterInstallationRun", "After installation run")}{" "}
                    <code className="rounded bg-black/[0.04] px-1 dark:bg-white/[0.06]">claude</code>{" "}
                    {translateOrFallback("toVerify", "to verify.")}
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
        </CliToolCardSection>

        {cliReady ? (
          <>
            <CliToolCardSection
              title={translateOrFallback("cards.claude.routeTitle", "Endpoint and credential")}
              description={translateOrFallback(
                "cards.claude.routeDescription",
                "Claude expects Anthropic env variables; Zavorth writes only the managed values."
              )}
              icon="route"
            >
              <CliToolLabeledField
                label={translateOrFallback("baseUrl", "Base URL")}
                hint={translateOrFallback("cards.claude.baseUrlHint", "Written as ANTHROPIC_BASE_URL.")}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={getDisplayUrl()}
                    onChange={(event) => setCustomBaseUrl(event.target.value)}
                    placeholder={translateOrFallback("baseUrlPlaceholder", "Base URL")}
                    className={fieldClassName}
                  />
                  {customBaseUrl ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="restart_alt"
                      onClick={() => setCustomBaseUrl("")}
                      aria-label={translateOrFallback("resetToDefault", "Reset to default")}
                      className="shrink-0 px-2"
                    />
                  ) : null}
                </div>
              </CliToolLabeledField>

              <CliToolLabeledField
                label={translateOrFallback("apiKey", "API key")}
                hint={translateOrFallback(
                  "cards.claude.apiKeyHint",
                  "The backend resolves the selected key id before writing the real token."
                )}
              >
                {apiKeys.length > 0 ? (
                  <select
                    value={selectedApiKey}
                    onChange={(event) => setSelectedApiKey(event.target.value)}
                    className={fieldClassName}
                  >
                    {apiKeys.map((key) => (
                      <option key={key.id} value={key.id}>
                        {key.key}
                      </option>
                    ))}
                  </select>
                ) : (
                  <CliToolNotice
                    tone={cloudEnabled ? "warning" : "info"}
                    icon={cloudEnabled ? "vpn_key_off" : "key"}
                    title={
                      cloudEnabled
                        ? translateOrFallback("noApiKeysCreateOne", "Create an API key first")
                        : translateOrFallback(
                            "cards.claude.localFallbackKey",
                            "Local fallback token will be used"
                          )
                    }
                  />
                )}
              </CliToolLabeledField>
            </CliToolCardSection>

            <CliToolCardSection
              title={translateOrFallback("cards.claude.aliasTitle", "Claude model aliases")}
              description={translateOrFallback(
                "cards.claude.aliasDescription",
                "Map Claude's named env slots to provider/model ids available in Zavorth."
              )}
              icon="model_training"
              tone="info"
            >
              {(tool.defaultModels || []).map((model) => (
                <CliToolLabeledField key={model.alias} label={model.name} hint={model.envKey}>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={modelMappings[model.alias] || ""}
                      onChange={(event) => onModelMappingChange(model.alias, event.target.value)}
                      placeholder={translateOrFallback("providerModelPlaceholder", "provider/model")}
                      className={fieldClassName}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openModelSelector(model.alias)}
                      disabled={!hasActiveProviders}
                    >
                      {translateOrFallback("selectModel", "Select model")}
                    </Button>
                    {modelMappings[model.alias] ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="close"
                        onClick={() => onModelMappingChange(model.alias, "")}
                        aria-label={translateOrFallback("clear", "Clear")}
                        className="shrink-0 px-2"
                      />
                    ) : null}
                  </div>
                </CliToolLabeledField>
              ))}
            </CliToolCardSection>

            <CliToolCardSection
              title={translateOrFallback("cards.claude.actionsTitle", "Operator actions")}
              description={translateOrFallback(
                "cards.claude.actionsDescription",
                "Apply the env profile, reset the managed block, inspect backups or copy a manual settings file."
              )}
              icon="bolt"
            >
              {message ? (
                <CliToolNotice
                  tone={message.type === "success" ? "success" : "danger"}
                  icon={message.type === "success" ? "check_circle" : "error"}
                  title={message.text}
                />
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleApplySettings}
                  disabled={!hasActiveProviders}
                  loading={applying}
                  icon="save"
                >
                  {translateOrFallback("apply", "Apply")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetSettings}
                  disabled={!claudeStatus?.hasZavorthGateway}
                  loading={restoring}
                  icon="restart_alt"
                >
                  {translateOrFallback("reset", "Reset")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowManualConfigModal(true)}
                  icon="content_copy"
                >
                  {translateOrFallback("manualConfig", "Manual config")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowBackups(!showBackups);
                    if (!showBackups) fetchBackups();
                  }}
                  icon="history"
                >
                  {translateOrFallback("backups", "Backups")}
                  {backups.length > 0 ? ` (${backups.length})` : ""}
                </Button>
              </div>

              {showBackups ? (
                <div className="rounded-2xl border border-black/8 bg-black/[0.025] p-3 dark:border-white/8 dark:bg-white/[0.03]">
                  {backups.length === 0 ? (
                    <p className="text-sm text-text-muted">
                      {translateOrFallback("noBackupsYet", "No backups yet")}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {backups.map((backup) => (
                        <div
                          key={backup.id}
                          className="flex flex-col gap-2 rounded-xl bg-white/70 p-3 text-xs dark:bg-white/[0.04] sm:flex-row sm:items-center"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-text-main">
                              {backup.originalFile || backup.id}
                            </p>
                            <p className="text-text-muted">
                              {new Date(backup.createdAt).toLocaleString()}
                            </p>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleRestoreBackup(backup.id)}
                            loading={restoringBackup === backup.id}
                          >
                            {translateOrFallback("restore", "Restore")}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </CliToolCardSection>
          </>
        ) : null}
      </CliToolCardFrame>

      <ModelSelectModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={handleModelSelect}
        selectedModel={currentEditingAlias ? modelMappings[currentEditingAlias] : null}
        activeProviders={activeProviders}
        modelAliases={modelAliases}
        title={translateOrFallback(
          "selectModelForAlias",
          `Select model for ${currentEditingAlias || ""}`,
          { alias: currentEditingAlias || "" }
        )}
      />

      <ManualConfigModal
        isOpen={showManualConfigModal}
        onClose={() => setShowManualConfigModal(false)}
        title={translateOrFallback("claudeManualConfiguration", "Claude manual configuration")}
        configs={getManualConfigs()}
      />
    </>
  );
}
