"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, ModelSelectModal } from "@/shared/components";
import { useTranslations } from "next-intl";
import { copyToClipboard } from "@/shared/utils/clipboard";
import CliStatusBadge from "./CliStatusBadge";
import CliToolCardFrame, {
  CliToolCardSection,
  CliToolMetaPill,
  CliToolNotice,
} from "./CliToolCardFrame";

const fieldClassName =
  "w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm text-text-main outline-none transition focus:border-primary/40 focus:ring-0 dark:border-white/10 dark:bg-white/[0.05]";

const modelStorageKey = (toolId: string) => `Zavorth-cli-model-${toolId}`;
const keyStorageKey = (toolId: string) => `Zavorth-cli-key-${toolId}`;
const legacyModelStorageKey = (toolId: string) => `ZavorthGateway-cli-model-${toolId}`;
const legacyKeyStorageKey = (toolId: string) => `ZavorthGateway-cli-key-${toolId}`;

function readSessionBackedSecret(key, legacyKey) {
  if (typeof window === "undefined") return "";
  try {
    const sessionValue = window.sessionStorage.getItem(key);
    if (sessionValue) return sessionValue;

    const legacyValue = window.localStorage.getItem(key) || window.localStorage.getItem(legacyKey);
    if (!legacyValue) return "";

    window.sessionStorage.setItem(key, legacyValue);
    window.localStorage.removeItem(key);
    window.localStorage.removeItem(legacyKey);
    return legacyValue;
  } catch {
    return "";
  }
}

function writeSessionBackedSecret(key, value) {
  if (typeof window === "undefined") return;
  try {
    if (value) {
      window.sessionStorage.setItem(key, value);
    } else {
      window.sessionStorage.removeItem(key);
    }
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures; the in-memory React state still carries the selection.
  }
}

export default function DefaultToolCard({
  toolId,
  tool,
  isExpanded,
  onToggle,
  baseUrl,
  apiKeys,
  activeProviders = [],
  cloudEnabled = false,
  batchStatus,
  lastConfiguredAt = null,
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
  const [copiedField, setCopiedField] = useState(null);
  const [showModelModal, setShowModelModal] = useState(false);
  const [modelValue, setModelValue] = useState("");
  const [runtimeStatus, setRuntimeStatus] = useState(null);
  const [message, setMessage] = useState(null);
  const [saving, setSaving] = useState(false);
  const runtimeFetchStartedRef = useRef(false);

  const [selectedApiKey, setSelectedApiKey] = useState(() =>
    apiKeys?.length > 0 ? apiKeys[0].key : ""
  );

  useEffect(() => {
    const savedModel =
      localStorage.getItem(modelStorageKey(toolId)) ||
      localStorage.getItem(legacyModelStorageKey(toolId));
    if (savedModel) {
      setModelValue(savedModel);
    }

    const savedKey = readSessionBackedSecret(keyStorageKey(toolId), legacyKeyStorageKey(toolId));
    if (savedKey && apiKeys?.some((key) => key.key === savedKey)) {
      setSelectedApiKey(savedKey);
    }
  }, [toolId, apiKeys]);

  const handleModelChange = useCallback(
    (value) => {
      setModelValue(value);
      if (value) {
        localStorage.setItem(modelStorageKey(toolId), value);
      } else {
        localStorage.removeItem(modelStorageKey(toolId));
      }
    },
    [toolId]
  );

  const handleApiKeyChange = useCallback(
    (value) => {
      setSelectedApiKey(value);
      writeSessionBackedSecret(keyStorageKey(toolId), value);
    },
    [toolId]
  );

  useEffect(() => {
    if (!isExpanded || runtimeStatus || runtimeFetchStartedRef.current) {
      return;
    }

    runtimeFetchStartedRef.current = true;

    fetch(`/api/cli-tools/runtime/${toolId}`)
      .then((res) => res.json())
      .then((data) => setRuntimeStatus(data))
      .catch((error) =>
        setRuntimeStatus({
          error: error?.message || translateOrFallback("runtimeCheckFailed", "Runtime check failed"),
        })
      );
  }, [isExpanded, runtimeStatus, toolId, translateOrFallback]);

  const replaceVars = (text) => {
    const keyToUse =
      selectedApiKey && selectedApiKey.trim()
        ? selectedApiKey
        : !cloudEnabled
          ? "sk_ZavorthGateway"
          : translateOrFallback("yourApiKeyPlaceholder", "your-api-key");

    const normalizedBaseUrl = baseUrl || "http://localhost:20128";
    const baseUrlWithV1 = normalizedBaseUrl.endsWith("/v1")
      ? normalizedBaseUrl
      : `${normalizedBaseUrl}/v1`;

    return text
      .replace(/\{\{baseUrl\}\}/g, baseUrlWithV1)
      .replace(/\{\{apiKey\}\}/g, keyToUse)
      .replace(/\{\{model\}\}/g, modelValue || translateOrFallback("modelPlaceholder", "model"));
  };

  const handleCopy = async (text, field) => {
    await copyToClipboard(replaceVars(text));
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSelectModel = (model) => {
    handleModelChange(model.value);
  };

  const hasActiveProviders = activeProviders.length > 0;
  const checkingRuntime = isExpanded && runtimeStatus === null;
  const supportsDirectSave = ["continue", "opencode"].includes(toolId);

  const handleSaveConfig = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const keyToUse =
        selectedApiKey && selectedApiKey.trim()
          ? selectedApiKey
          : !cloudEnabled
            ? "sk_ZavorthGateway"
            : "";

      const normalizedBaseUrl = baseUrl || "http://localhost:20128";
      const baseUrlWithV1 = normalizedBaseUrl.endsWith("/v1")
        ? normalizedBaseUrl
        : `${normalizedBaseUrl}/v1`;

      const res = await fetch(`/api/cli-tools/guide-settings/${toolId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: baseUrlWithV1,
          apiKey: keyToUse,
          model: modelValue,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessage({
          type: "success",
          text: data.message || translateOrFallback("configurationSaved", "Configuration saved"),
        });
      } else {
        setMessage({
          type: "error",
          text: data.error || translateOrFallback("failedToSave", "Failed to save"),
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const canShowGuide = () => !(tool.requiresCloud && !cloudEnabled);

  const getSurfaceLabel = () => {
    switch (tool.configType) {
      case "guide":
        return translateOrFallback("cards.guideSurface", "Operator guide");
      case "env":
        return translateOrFallback("cards.envSurface", "Environment bridge");
      case "mitm":
        return translateOrFallback("cards.mitmSurface", "Traffic bridge");
      default:
        return translateOrFallback("cards.manualSurface", "Manual surface");
    }
  };

  const getCommandLabel = () => {
    if (Array.isArray(tool.defaultCommands) && tool.defaultCommands.length > 0) {
      return tool.defaultCommands.join(" / ");
    }

    if (typeof tool.defaultCommand === "string" && tool.defaultCommand.trim()) {
      return tool.defaultCommand.trim();
    }

    return null;
  };

  const renderRuntimeBadge = () => {
    const runtime = runtimeStatus;
    const isGuide = runtime?.reason === "not_required" || tool.configType === "guide";
    const isDetected = runtime
      ? runtime.installed && runtime.runnable
      : batchStatus?.installed && batchStatus?.runnable;
    const isInstalled = runtime ? runtime.installed : batchStatus?.installed;

    if (isGuide) {
      return (
        <CliToolMetaPill tone="info" icon="menu_book">
          {translateOrFallback("guide", "Guide")}
        </CliToolMetaPill>
      );
    }

    if (isDetected) {
      return (
        <CliToolMetaPill tone="success" icon="terminal">
          {translateOrFallback("detected", "Detected")}
        </CliToolMetaPill>
      );
    }

    if (isInstalled === false && (runtime || batchStatus)) {
      return (
        <CliToolMetaPill tone="muted" icon="download">
          {translateOrFallback("notInstalled", "Not installed")}
        </CliToolMetaPill>
      );
    }

    if (isInstalled && !isDetected && (runtime || batchStatus)) {
      return (
        <CliToolMetaPill tone="warning" icon="warning">
          {translateOrFallback("notReady", "Not ready")}
        </CliToolMetaPill>
      );
    }

    return (
      <CliToolMetaPill tone="neutral" icon="frame_inspect">
        {translateOrFallback("cards.runtimeProbeOnOpen", "Runtime probe on open")}
      </CliToolMetaPill>
    );
  };

  const renderApiKeySelector = () => {
    if (apiKeys && apiKeys.length > 0) {
      return (
        <div className="flex items-center gap-2">
          <select
            value={selectedApiKey}
            onChange={(event) => handleApiKeyChange(event.target.value)}
            className={fieldClassName}
          >
            {apiKeys.map((key) => (
              <option key={key.id} value={key.key}>
                {key.key}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleCopy(selectedApiKey, "apiKey")}
            icon={copiedField === "apiKey" ? "check" : "content_copy"}
            aria-label={translateOrFallback("copy", "Copy")}
            className="shrink-0 px-2"
          />
        </div>
      );
    }

    return (
      <CliToolNotice
        tone={cloudEnabled ? "warning" : "info"}
        icon={cloudEnabled ? "vpn_key_off" : "key"}
        title={
          cloudEnabled
            ? translateOrFallback("noApiKeysCreateOne", "Create an API key first")
            : translateOrFallback("cards.localKeyInjected", "Local gateway key is injected automatically")
        }
      >
        <p>
          {cloudEnabled
            ? translateOrFallback(
                "cards.default.cloudKeyHint",
                "Open Settings and add a provider key before finishing this setup."
              )
            : translateOrFallback(
                "cards.default.localKeyHint",
                "Zavorth keeps a local fallback key for on-device relay scenarios."
              )}
        </p>
      </CliToolNotice>
    );
  };

  const renderModelSelector = () => {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={modelValue}
          onChange={(event) => handleModelChange(event.target.value)}
          placeholder={translateOrFallback("modelPlaceholder", "model")}
          className={fieldClassName}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setShowModelModal(true)}
          disabled={!hasActiveProviders}
          className="shrink-0"
        >
          {translateOrFallback("selectModel", "Select model")}
        </Button>
        {modelValue ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleCopy(modelValue, "model")}
              icon={copiedField === "model" ? "check" : "content_copy"}
              aria-label={translateOrFallback("copy", "Copy")}
              className="shrink-0 px-2"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleModelChange("")}
              icon="close"
              aria-label={translateOrFallback("clear", "Clear")}
              className="shrink-0 px-2"
            />
          </>
        ) : null}
      </div>
    );
  };

  const renderNotes = () => {
    if (!tool.notes || tool.notes.length === 0) {
      return null;
    }

    return tool.notes.map((note, index) => {
      if (note.type === "cloudCheck" && cloudEnabled) {
        return null;
      }

      let tone = "info";
      let icon = "info";

      if (note.type === "warning") {
        tone = "warning";
        icon = "warning";
      } else if (note.type === "cloudCheck" && !cloudEnabled) {
        tone = "danger";
        icon = "error";
      }

      return (
        <CliToolNotice
          key={`${toolId}-note-${index}`}
          tone={tone}
          icon={icon}
          title={translateOrFallback(`cards.default.note${index}`, "Operator note")}
        >
          <p>{translateOrFallback(`guides.${toolId}.notes.${index}`, note.text)}</p>
        </CliToolNotice>
      );
    });
  };

  const renderRuntimePanel = () => {
    if (checkingRuntime) {
      return (
        <CliToolNotice
          tone="info"
          icon="progress_activity"
          title={translateOrFallback("checkingRuntime", "Checking runtime")}
        >
          <p>
            {translateOrFallback(
              "cards.default.runtimeProbeText",
              "Zavorth is probing the local machine before it suggests the final setup path."
            )}
          </p>
        </CliToolNotice>
      );
    }

    if (runtimeStatus?.error) {
      return (
        <CliToolNotice
          tone="danger"
          icon="error"
          title={translateOrFallback("failedCheckRuntimeStatus", "Failed to check runtime")}
        >
          <p>
            {translateOrFallback(
              "cards.default.runtimeErrorText",
              "The setup guide still works, but runtime detection did not complete cleanly."
            )}
          </p>
        </CliToolNotice>
      );
    }

    if (!runtimeStatus) {
      return null;
    }

    const noticeTitle =
      runtimeStatus.reason === "not_required"
        ? translateOrFallback("guideOnlyIntegration", "Guide-only integration")
        : runtimeStatus.installed && runtimeStatus.runnable
          ? translateOrFallback("cliRuntimeDetected", "CLI runtime detected")
          : runtimeStatus.installed
            ? translateOrFallback(
                "cliFoundNotRunnable",
                `CLI found, but not runnable${runtimeStatus.reason ? `: ${runtimeStatus.reason}` : ""}`,
                {
                  reason: runtimeStatus.reason ? `: ${runtimeStatus.reason}` : "",
                }
              )
            : translateOrFallback("cliRuntimeNotDetected", "CLI runtime not detected");

    const noticeTone =
      runtimeStatus.reason === "not_required"
        ? "info"
        : runtimeStatus.installed && runtimeStatus.runnable
          ? "success"
          : "warning";

    const noticeIcon =
      runtimeStatus.reason === "not_required"
        ? "info"
        : runtimeStatus.installed && runtimeStatus.runnable
          ? "check_circle"
          : "warning";

    return (
      <CliToolNotice tone={noticeTone} icon={noticeIcon} title={noticeTitle}>
        <div className="flex flex-wrap gap-2">
          {runtimeStatus.commandPath ? (
            <CliToolMetaPill icon="terminal" className="max-w-full break-all">
              <code className="truncate">{runtimeStatus.commandPath}</code>
            </CliToolMetaPill>
          ) : null}
          {runtimeStatus.configPath ? (
            <CliToolMetaPill icon="folder_open" className="max-w-full break-all">
              <code className="truncate">{runtimeStatus.configPath}</code>
            </CliToolMetaPill>
          ) : null}
        </div>
      </CliToolNotice>
    );
  };

  const renderGuideStep = (item) => {
    return (
      <div
        key={`${toolId}-step-${item.step}`}
        className="rounded-2xl border border-black/8 bg-black/[0.025] p-4 dark:border-white/8 dark:bg-white/[0.03]"
      >
        <div className="flex items-start gap-3">
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white shadow-sm"
            style={{ backgroundColor: tool.color }}
          >
            {item.step}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-main">
              {translateOrFallback(`guides.${toolId}.steps.${item.step}.title`, item.title)}
            </p>

            {item.desc ? (
              <p className="mt-1 text-sm leading-5 text-text-muted">
                {translateOrFallback(`guides.${toolId}.steps.${item.step}.desc`, item.desc)}
              </p>
            ) : null}

            {item.type === "apiKeySelector" ? <div className="mt-3">{renderApiKeySelector()}</div> : null}
            {item.type === "modelSelector" ? <div className="mt-3">{renderModelSelector()}</div> : null}

            {item.value ? (
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 rounded-xl border border-black/8 bg-white/70 px-3 py-2 text-sm font-mono text-text-main dark:border-white/8 dark:bg-white/[0.03]">
                  {replaceVars(item.value)}
                </code>
                {item.copyable ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCopy(item.value, `${item.step}-${item.title}`)}
                    icon={
                      copiedField === `${item.step}-${item.title}` ? "check" : "content_copy"
                    }
                    aria-label={translateOrFallback("copy", "Copy")}
                    className="shrink-0 px-2"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const renderGuideFlow = () => {
    if (!canShowGuide()) {
      return (
        <CliToolNotice
          tone="warning"
          icon="cloud_off"
          title={translateOrFallback("cards.default.cloudRequiredTitle", "Cloud endpoint required")}
        >
          <p>
            {translateOrFallback(
              "cards.default.cloudRequiredBody",
              "Enable the cloud endpoint in Settings before you route this tool through Zavorth."
            )}
          </p>
        </CliToolNotice>
      );
    }

    if (!tool.guideSteps) {
      return <p className="text-sm text-text-muted">{translateOrFallback("comingSoon", "Coming soon")}</p>;
    }

    return <div className="flex flex-col gap-3">{tool.guideSteps.map(renderGuideStep)}</div>;
  };

  const commandLabel = getCommandLabel();
  const summary = !canShowGuide()
    ? translateOrFallback(
        "cards.default.summaryCloudLocked",
        "This surface stays locked until the cloud endpoint is available."
      )
    : translateOrFallback(`toolDescriptions.${toolId}`, tool.description);

  return (
    <>
      <CliToolCardFrame
        tool={tool}
        toolKey={toolId}
        isExpanded={isExpanded}
        onToggle={onToggle}
        eyebrow={getSurfaceLabel()}
        summary={summary}
        status={
          <>
            {renderRuntimeBadge()}
            <CliStatusBadge batchStatus={batchStatus} lastConfiguredAt={lastConfiguredAt} />
          </>
        }
        meta={
          <>
            {commandLabel ? (
              <CliToolMetaPill icon="terminal">
                {translateOrFallback("cards.default.commandPill", "Launch")}: {commandLabel}
              </CliToolMetaPill>
            ) : null}
            {tool.settingsFile ? (
              <CliToolMetaPill icon="folder_open" className="max-w-full break-all">
                <span className="truncate">{tool.settingsFile}</span>
              </CliToolMetaPill>
            ) : null}
          </>
        }
      >
        <CliToolCardSection
          title={translateOrFallback("cards.default.statusTitle", "Surface status")}
          description={translateOrFallback(
            "cards.default.statusDescription",
            "Zavorth checks the local runtime here and keeps your guide selections pinned to this machine."
          )}
          icon="monitoring"
        >
          {renderRuntimePanel()}
          {renderNotes()}
        </CliToolCardSection>

        <CliToolCardSection
          title={translateOrFallback("cards.default.flowTitle", "Setup flow")}
          description={translateOrFallback(
            "cards.default.flowDescription",
            "Follow the target-tool steps below and reuse the Zavorth values exactly as shown."
          )}
          icon="checklist"
        >
          {renderGuideFlow()}
        </CliToolCardSection>

        {canShowGuide() && tool.codeBlock ? (
          <CliToolCardSection
            title={translateOrFallback("cards.default.payloadTitle", "Config payload")}
            description={translateOrFallback(
              "cards.default.payloadDescription",
              "Copy this payload into the tool when it asks for a model or provider definition."
            )}
            icon="data_object"
            tone="info"
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleCopy(tool.codeBlock.code, "codeblock")}
                icon={copiedField === "codeblock" ? "check" : "content_copy"}
              >
                {copiedField === "codeblock"
                  ? translateOrFallback("copied", "Copied")
                  : translateOrFallback("copy", "Copy")}
              </Button>
            }
          >
            <pre className="overflow-x-auto rounded-2xl border border-black/8 bg-black/[0.03] p-4 dark:border-white/8 dark:bg-black/20">
              <code className="text-sm whitespace-pre text-text-main">
                {replaceVars(tool.codeBlock.code)}
              </code>
            </pre>
          </CliToolCardSection>
        ) : null}

        {canShowGuide() ? (
          <CliToolCardSection
            title={translateOrFallback("cards.default.actionsTitle", "Operator actions")}
            description={translateOrFallback(
              "cards.default.actionsDescription",
              "Save the generated config when supported, or copy the payload to finish the handoff manually."
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
              {supportsDirectSave ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveConfig}
                  disabled={!modelValue}
                  loading={saving}
                >
                  {translateOrFallback("saveConfig", "Save config")}
                </Button>
              ) : null}

              {tool.codeBlock ? (
                <Button
                  variant={supportsDirectSave ? "outline" : "primary"}
                  size="sm"
                  onClick={() => handleCopy(tool.codeBlock.code, "codeblock")}
                  icon={copiedField === "codeblock" ? "check" : "content_copy"}
                >
                  {copiedField === "codeblock"
                    ? translateOrFallback("copied", "Copied")
                    : translateOrFallback("copyConfig", "Copy config")}
                </Button>
              ) : null}

              {modelValue ? (
                <CliToolMetaPill tone="success" icon="check_circle">
                  {translateOrFallback("selectionSaved", "Selection saved")}
                </CliToolMetaPill>
              ) : null}
            </div>
          </CliToolCardSection>
        ) : null}
      </CliToolCardFrame>

      <ModelSelectModal
        isOpen={showModelModal}
        onClose={() => setShowModelModal(false)}
        onSelect={handleSelectModel}
        selectedModel={modelValue}
        activeProviders={activeProviders}
        title={translateOrFallback("selectModel", "Select model")}
      />
    </>
  );
}
