"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, ManualConfigModal, ModelSelectModal } from "@/shared/components";
import { useTranslations } from "next-intl";
import CliStatusBadge from "./CliStatusBadge";
import CliToolCardFrame, {
  CliToolCardSection,
  CliToolLabeledField,
  CliToolMetaPill,
  CliToolNotice,
} from "./CliToolCardFrame";
import {
  MANAGED_CLI_TOOL_PROFILES,
  isLocalOrCloudUrl,
  toV1Url,
  type ManagedCliToolProfile,
} from "./managed-cli-tool-card/managedCliToolProfiles";

export { MANAGED_CLI_TOOL_PROFILES };

const fieldClassName =
  "w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm text-text-main outline-none transition focus:border-primary/40 focus:ring-0 dark:border-white/10 dark:bg-white/[0.05]";

export default function ManagedCliToolCard({
  profile,
  tool,
  isExpanded,
  onToggle,
  baseUrl,
  hasActiveProviders,
  apiKeys,
  activeProviders,
  cloudEnabled,
  batchStatus,
  lastConfiguredAt,
}: {
  profile: ManagedCliToolProfile;
  tool: any;
  isExpanded: boolean;
  onToggle: () => void;
  baseUrl: string;
  hasActiveProviders: boolean;
  apiKeys: any[];
  activeProviders: any[];
  cloudEnabled: boolean;
  batchStatus?: any;
  lastConfiguredAt?: string | null;
}) {
  const t = useTranslations("cliTools");
  const [status, setStatus] = useState(null);
  const [checking, setChecking] = useState(false);
  const [applying, setApplying] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState(null);
  const [selectedApiKey, setSelectedApiKey] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modelAliases, setModelAliases] = useState({});
  const [showManualConfigModal, setShowManualConfigModal] = useState(false);
  const [customBaseUrl, setCustomBaseUrl] = useState("");
  const [backups, setBackups] = useState([]);
  const [showBackups, setShowBackups] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(null);
  const initializedRef = useRef(false);

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

  const cliReady = !!(status?.installed && status?.runnable);
  const statusBaseUrl = profile.statusBaseUrl?.(status) || "";
  const hasCanonicalProvider = profile.hasCanonicalProvider?.(status) || false;
  const configStatus = useMemo(() => {
    if (!cliReady) return null;
    if (!hasCanonicalProvider) return "not_configured";
    if (!statusBaseUrl) return "configured";
    return isLocalOrCloudUrl(statusBaseUrl, cloudEnabled) ? "configured" : "other";
  }, [cliReady, cloudEnabled, hasCanonicalProvider, statusBaseUrl]);
  const effectiveConfigStatus = configStatus || batchStatus?.configStatus || null;

  useEffect(() => {
    if (apiKeys?.length > 0 && !selectedApiKey) {
      setSelectedApiKey(apiKeys[0].key);
    }
  }, [apiKeys, selectedApiKey]);

  useEffect(() => {
    if (isExpanded && !status) {
      checkStatus();
      fetchModelAliases();
      fetchBackups();
    }
  }, [isExpanded, status]);

  useEffect(() => {
    if (!status || initializedRef.current) return;

    const modelFromStatus = profile.statusModel?.(status);
    if (modelFromStatus) {
      setSelectedModel(modelFromStatus);
    }

    const keyFromStatus = profile.statusApiKey?.(status);
    if (keyFromStatus && apiKeys?.some((key: any) => key.key === keyFromStatus)) {
      setSelectedApiKey(keyFromStatus);
    }

    if (modelFromStatus || keyFromStatus) {
      initializedRef.current = true;
    }
  }, [apiKeys, profile, status]);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch(profile.endpoint);
      const data = await res.json();
      setStatus(data);
    } catch (error) {
      setStatus({ installed: false, error: error.message });
    } finally {
      setChecking(false);
    }
  };

  const fetchModelAliases = async () => {
    try {
      const res = await fetch("/api/models/alias");
      if (!res.ok) return;
      const data = await res.json();
      setModelAliases(data.aliases || {});
    } catch {
      /* optional metadata */
    }
  };

  const fetchBackups = async () => {
    try {
      const res = await fetch(`/api/cli-tools/backups?tool=${profile.toolId}`);
      if (!res.ok) return;
      const data = await res.json();
      setBackups(data.backups || []);
    } catch {
      /* optional metadata */
    }
  };

  const getEffectiveBaseUrl = () => {
    const url = customBaseUrl || baseUrl || "http://localhost:20128";
    return toV1Url(url);
  };

  const getDisplayUrl = () => customBaseUrl || toV1Url(baseUrl || "http://localhost:20128");

  const handleApply = async () => {
    setApplying(true);
    setMessage(null);

    try {
      const keyToUse =
        selectedApiKey?.trim() ||
        (apiKeys?.length > 0 ? apiKeys[0].key : null) ||
        (!cloudEnabled ? "sk_ZavorthGateway" : null);

      const res = await fetch(profile.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: getEffectiveBaseUrl(),
          apiKey: keyToUse,
          model: selectedModel,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({
          type: "success",
          text: data.message || translateOrFallback("settingsApplied", "Settings applied"),
        });
        await checkStatus();
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

  const handleReset = async () => {
    setRestoring(true);
    setMessage(null);

    try {
      const res = await fetch(profile.endpoint, { method: "DELETE" });
      const data = await res.json();

      if (res.ok) {
        setMessage({
          type: "success",
          text: data.message || translateOrFallback("settingsReset", "Settings reset"),
        });
        setSelectedModel("");
        setSelectedApiKey("");
        initializedRef.current = false;
        await checkStatus();
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
        body: JSON.stringify({ tool: profile.toolId, backupId }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({
          type: "success",
          text: data.message || translateOrFallback("backupRestored", "Backup restored"),
        });
        await checkStatus();
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

  const handleSelectModel = (model) => {
    setSelectedModel(model.value);
    setModalOpen(false);
  };

  const handleManualInput = (config) => {
    if (config.model) setSelectedModel(config.model);
    if (config.apiKey) setSelectedApiKey(config.apiKey);
    if (config.baseUrl) setCustomBaseUrl(config.baseUrl);
    setShowManualConfigModal(false);
  };

  const manualConfigs = () => {
    if (profile.manualMode !== "files" || !profile.createManualConfigs) {
      return [];
    }

    return profile.createManualConfigs({
      selectedModel,
      selectedApiKey,
      effectiveBaseUrl: getEffectiveBaseUrl(),
      cloudEnabled,
    });
  };

  const renderRuntimeNotice = () => {
    if (checking) {
      return (
        <CliToolNotice
          tone="info"
          icon="progress_activity"
          title={translateOrFallback("checkingCli", `Checking ${profile.displayName}`, {
            tool: profile.displayName,
          })}
        >
          <p>
            {translateOrFallback(
              "cards.managed.probing",
              "Zavorth is reading the local CLI state before changing configuration."
            )}
          </p>
        </CliToolNotice>
      );
    }

    if (!status) return null;

    if (!cliReady) {
      return (
        <CliToolNotice
          tone="warning"
          icon="warning"
          title={
            status.installed
              ? translateOrFallback("cliNotRunnable", `${profile.displayName} is not runnable`, {
                  tool: profile.displayName,
                })
              : translateOrFallback("cliNotInstalled", `${profile.displayName} is not installed`, {
                  tool: profile.displayName,
                })
          }
        >
          <p>
            {status.installed
              ? translateOrFallback(
                  "cliFoundFailedHealthcheck",
                  `Zavorth found ${profile.displayName}, but its health check failed${
                    status.reason ? ` (${status.reason})` : ""
                  }.`,
                  { tool: profile.displayName, reason: status.reason ? ` (${status.reason})` : "" }
                )
              : translateOrFallback(
                  "installCliPrompt",
                  `Install ${profile.displayName}, then reopen this card.`,
                  { tool: profile.displayName }
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
            ? translateOrFallback(
                "cards.managed.configuredTitle",
                `${profile.displayName} is routed through Zavorth`
              )
            : translateOrFallback(
                "cards.managed.readyTitle",
                `${profile.displayName} is ready for Zavorth routing`
              )
        }
      >
        <div className="flex flex-wrap gap-2">
          {status.commandPath ? (
            <CliToolMetaPill icon="terminal">
              <code>{status.commandPath}</code>
            </CliToolMetaPill>
          ) : null}
          {status.authPath ? (
            <CliToolMetaPill icon="folder_open">
              <code>{status.authPath}</code>
            </CliToolMetaPill>
          ) : null}
          {profile.currentDetails?.(status, t) ? (
            <CliToolMetaPill icon="tune">{profile.currentDetails(status, t)}</CliToolMetaPill>
          ) : null}
        </div>
      </CliToolNotice>
    );
  };

  return (
    <>
      <CliToolCardFrame
        tool={tool}
        toolKey={profile.toolId}
        isExpanded={isExpanded}
        onToggle={onToggle}
        eyebrow={translateOrFallback("cards.managed.eyebrow", "CLI configuration surface")}
        summary={translateOrFallback(
          `toolDescriptions.${profile.toolId}`,
          tool.description || `${profile.displayName} configuration`
        )}
        status={
          <CliStatusBadge
            effectiveConfigStatus={effectiveConfigStatus}
            batchStatus={batchStatus}
            lastConfiguredAt={lastConfiguredAt}
          />
        }
        meta={
          <>
            <CliToolMetaPill icon="terminal">
              {tool.defaultCommand || profile.displayName.toLowerCase()}
            </CliToolMetaPill>
            <CliToolMetaPill tone={cliReady ? "success" : "neutral"} icon="settings_ethernet">
              {cliReady
                ? translateOrFallback("cards.managed.runtimeReady", "Runtime ready")
                : translateOrFallback("cards.managed.runtimePending", "Runtime check on open")}
            </CliToolMetaPill>
          </>
        }
      >
        <CliToolCardSection
          title={translateOrFallback("cards.managed.statusTitle", "Runtime and current route")}
          description={translateOrFallback(
            "cards.managed.statusDescription",
            "Zavorth reads the installed CLI and only writes the target config when the operator applies it."
          )}
          icon="monitoring"
        >
          {renderRuntimeNotice()}
        </CliToolCardSection>

        {cliReady ? (
          <>
            <CliToolCardSection
              title={translateOrFallback("cards.managed.routeTitle", "Zavorth route")}
              description={translateOrFallback(
                "cards.managed.routeDescription",
                "Choose the endpoint, key and model that this CLI should use."
              )}
              icon="route"
            >
              {statusBaseUrl ? (
                <CliToolLabeledField
                  label={translateOrFallback("current", "Current")}
                  hint={translateOrFallback(
                    "cards.managed.currentHint",
                    "Value currently detected in the tool config."
                  )}
                >
                  <code className="block truncate rounded-xl bg-black/[0.04] px-3 py-2 text-sm text-text-muted dark:bg-white/[0.05]">
                    {statusBaseUrl}
                  </code>
                </CliToolLabeledField>
              ) : null}

              <CliToolLabeledField
                label={translateOrFallback("baseUrl", "Base URL")}
                hint={translateOrFallback(
                  "cards.managed.baseUrlHint",
                  "Defaults to the active Zavorth gateway endpoint."
                )}
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
                  "cards.managed.apiKeyHint",
                  "Select a stored key or let local-only mode use the gateway fallback key."
                )}
              >
                {apiKeys?.length > 0 ? (
                  <select
                    value={selectedApiKey}
                    onChange={(event) => setSelectedApiKey(event.target.value)}
                    className={fieldClassName}
                  >
                    {apiKeys.map((key: any) => (
                      <option key={key.id} value={key.key}>
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
                            "cards.managed.localFallbackKey",
                            "Local fallback key will be used"
                          )
                    }
                  >
                    <p>
                      {cloudEnabled
                        ? translateOrFallback(
                            "cards.managed.noCloudKeyHint",
                            "Add an API key before applying this config."
                          )
                        : translateOrFallback(
                            "cards.managed.localFallbackHint",
                            "Zavorth preserves local relay behavior with the fallback key."
                          )}
                    </p>
                  </CliToolNotice>
                )}
              </CliToolLabeledField>

              <CliToolLabeledField
                label={translateOrFallback("model", "Model")}
                hint={translateOrFallback(
                  "cards.managed.modelHint",
                  "Pick a model from active providers or type an explicit provider/model id."
                )}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={selectedModel}
                    onChange={(event) => setSelectedModel(event.target.value)}
                    placeholder={translateOrFallback("providerModelPlaceholder", "provider/model")}
                    className={fieldClassName}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setModalOpen(true)}
                    disabled={!hasActiveProviders}
                  >
                    {translateOrFallback("selectModel", "Select model")}
                  </Button>
                  {selectedModel ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="close"
                      onClick={() => setSelectedModel("")}
                      aria-label={translateOrFallback("clear", "Clear")}
                      className="shrink-0 px-2"
                    />
                  ) : null}
                </div>
              </CliToolLabeledField>
            </CliToolCardSection>

            <CliToolCardSection
              title={translateOrFallback("cards.managed.actionsTitle", "Operator actions")}
              description={translateOrFallback(
                "cards.managed.actionsDescription",
                "Apply the route, reset the managed block, or open the manual handoff when needed."
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
                  onClick={handleApply}
                  disabled={!selectedModel}
                  loading={applying}
                  icon="save"
                >
                  {configStatus === "configured"
                    ? translateOrFallback("updateConfig", "Update config")
                    : translateOrFallback("applyConfig", "Apply config")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={!hasCanonicalProvider}
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
                      {backups.map((backup: any) => (
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
        onSelect={handleSelectModel}
        selectedModel={selectedModel}
        activeProviders={activeProviders}
        modelAliases={modelAliases}
        title={translateOrFallback("selectModelForTool", `Select model for ${profile.displayName}`, {
          tool: profile.displayName,
        })}
      />

      {profile.manualMode === "files" ? (
        <ManualConfigModal
          isOpen={showManualConfigModal}
          onClose={() => setShowManualConfigModal(false)}
          title={translateOrFallback(profile.manualTitleKey, `${profile.displayName} manual configuration`)}
          configs={manualConfigs()}
        />
      ) : showManualConfigModal ? (
        <ManualConfigModal
          isOpen={showManualConfigModal}
          onClose={() => setShowManualConfigModal(false)}
          title={translateOrFallback(profile.manualTitleKey, `${profile.displayName} manual configuration`)}
          {...({
            onApply: handleManualInput,
            currentConfig: {
              model: selectedModel,
              apiKey: selectedApiKey,
              baseUrl: customBaseUrl || baseUrl,
            },
          } as any)}
        />
      ) : null}
    </>
  );
}
