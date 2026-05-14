"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Input, Modal, ModelSelectModal } from "@/shared/components";
import { useTranslations } from "next-intl";
import CliStatusBadge from "./CliStatusBadge";
import CliToolCardFrame, {
  CliToolCardSection,
  CliToolLabeledField,
  CliToolMetaPill,
  CliToolNotice,
} from "./CliToolCardFrame";

const fieldClassName =
  "w-full rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm text-text-main outline-none transition focus:border-primary/40 focus:ring-0 dark:border-white/10 dark:bg-white/[0.05]";

export default function ZavorthBridgeToolCard({
  tool,
  isExpanded,
  onToggle,
  apiKeys,
  activeProviders,
  hasActiveProviders,
  cloudEnabled,
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
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [sudoPassword, setSudoPassword] = useState("");
  const [selectedApiKey, setSelectedApiKey] = useState("");
  const [message, setMessage] = useState(null);
  const [modelMappings, setModelMappings] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [currentEditingAlias, setCurrentEditingAlias] = useState(null);

  useEffect(() => {
    if (apiKeys?.length > 0 && !selectedApiKey) {
      setSelectedApiKey(apiKeys[0].key);
    }
  }, [apiKeys, selectedApiKey]);

  useEffect(() => {
    if (isExpanded && !status) {
      fetchStatus();
      loadSavedMappings();
    }
  }, [isExpanded, status]);

  const loadSavedMappings = async () => {
    try {
      const res = await fetch(`/api/cli-tools/zavorth-bridge-mitm/alias?tool=${tool.id}`);
      if (res.ok) {
        const data = await res.json();
        const aliases = data.aliases || {};
        if (Object.keys(aliases).length > 0) {
          setModelMappings(aliases);
        }
      }
    } catch (error) {
      console.log("Error loading saved mappings:", error);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/cli-tools/zavorth-bridge-mitm");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (error) {
      console.log("Error fetching status:", error);
      setStatus({ running: false });
    }
  };

  const isWindows =
    typeof navigator !== "undefined" && navigator.userAgent?.includes("Windows");

  const handleStart = () => {
    if (isWindows || status?.hasCachedPassword) {
      doStart("");
    } else {
      setShowPasswordModal(true);
      setMessage(null);
    }
  };

  const handleStop = () => {
    if (isWindows || status?.hasCachedPassword) {
      doStop("");
    } else {
      setShowPasswordModal(true);
      setMessage(null);
    }
  };

  const doStart = async (password) => {
    setLoading(true);
    setMessage(null);

    try {
      const keyToUse =
        selectedApiKey?.trim() ||
        (apiKeys?.length > 0 ? apiKeys[0].key : null) ||
        (!cloudEnabled ? "sk_ZavorthGateway" : null);

      const res = await fetch("/api/cli-tools/zavorth-bridge-mitm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: keyToUse, sudoPassword: password }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: "success",
          text: translateOrFallback("mitmStarted", "MITM bridge started"),
        });
        setShowPasswordModal(false);
        setSudoPassword("");
        fetchStatus();
      } else {
        setMessage({
          type: "error",
          text: data.error || translateOrFallback("failedStart", "Failed to start"),
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const doStop = async (password) => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/cli-tools/zavorth-bridge-mitm", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sudoPassword: password }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: "success",
          text: translateOrFallback("mitmStopped", "MITM bridge stopped"),
        });
        setShowPasswordModal(false);
        setSudoPassword("");
        fetchStatus();
      } else {
        setMessage({
          type: "error",
          text: data.error || translateOrFallback("failedStop", "Failed to stop"),
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPassword = () => {
    if (!sudoPassword.trim()) {
      setMessage({
        type: "error",
        text: translateOrFallback("sudoPasswordRequiredError", "Sudo password required"),
      });
      return;
    }

    if (status?.running) {
      doStop(sudoPassword);
    } else {
      doStart(sudoPassword);
    }
  };

  const openModelSelector = (alias) => {
    setCurrentEditingAlias(alias);
    setModalOpen(true);
  };

  const handleModelSelect = (model) => {
    if (!currentEditingAlias) {
      return;
    }

    setModelMappings((prev) => ({
      ...prev,
      [currentEditingAlias]: model.value,
    }));
  };

  const handleModelMappingChange = (alias, value) => {
    setModelMappings((prev) => ({
      ...prev,
      [alias]: value,
    }));
  };

  const handleSaveMappings = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/cli-tools/zavorth-bridge-mitm/alias", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: tool.id, mappings: modelMappings }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || translateOrFallback("failedSaveMappings", "Failed to save"));
      }

      setMessage({
        type: "success",
        text: translateOrFallback("mappingsSaved", "Mappings saved"),
      });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const isRunning = status?.running;
  const aliasCount = tool.defaultModels?.length || 0;
  const summary = isRunning
    ? translateOrFallback(
        "cards.zavorthBridge.summaryRunning",
        "The Zavorth relay is live and ready to remap tool traffic through your local gateway."
      )
    : translateOrFallback(
        "cards.zavorthBridge.summaryIdle",
        "Keep the relay offline until you want to intercept requests, then bring it up from this control surface."
      );

  const renderRelayState = () => {
    if (status === null) {
      return (
        <CliToolMetaPill tone="neutral" icon="frame_inspect">
          {translateOrFallback("cards.zavorthBridge.inspectState", "Inspect relay state")}
        </CliToolMetaPill>
      );
    }

    return isRunning ? (
      <CliToolMetaPill tone="success" icon="radio_button_checked">
        {translateOrFallback("active", "Active")}
      </CliToolMetaPill>
    ) : (
      <CliToolMetaPill tone="muted" icon="radio_button_unchecked">
        {translateOrFallback("inactive", "Inactive")}
      </CliToolMetaPill>
    );
  };

  const renderMessage = () => {
    if (!message) {
      return null;
    }

    return (
      <CliToolNotice
        tone={message.type === "success" ? "success" : "danger"}
        icon={message.type === "success" ? "check_circle" : "error"}
        title={message.text}
      />
    );
  };

  return (
    <>
      <CliToolCardFrame
        tool={tool}
        toolKey={tool.id}
        isExpanded={isExpanded}
        onToggle={onToggle}
        eyebrow={translateOrFallback("cards.zavorthBridge.eyebrow", "Traffic bridge")}
        summary={summary}
        status={
          <>
            {renderRelayState()}
            <CliStatusBadge batchStatus={batchStatus} lastConfiguredAt={lastConfiguredAt} />
          </>
        }
        meta={
          <>
            <CliToolMetaPill icon="lan">
              {translateOrFallback(
                "cards.zavorthBridge.providers",
                `${activeProviders?.length || 0} providers online`,
                {
                  count: activeProviders?.length || 0,
                }
              )}
            </CliToolMetaPill>
            <CliToolMetaPill icon="tune">
              {translateOrFallback("cards.zavorthBridge.aliases", `${aliasCount} aliases`, {
                count: aliasCount,
              })}
            </CliToolMetaPill>
          </>
        }
      >
        <CliToolCardSection
          title={translateOrFallback("cards.zavorthBridge.controlTitle", "Control plane")}
          description={translateOrFallback(
            "cards.zavorthBridge.controlDescription",
            "Start or stop the relay from the dashboard without leaving the Zavorth surface."
          )}
          icon="deployed_code"
        >
          {!hasActiveProviders && !isRunning ? (
            <CliToolNotice
              tone="warning"
              icon="warning"
              title={translateOrFallback("noActiveProviders", "No active providers")}
            >
              <p>
                {translateOrFallback(
                  "noActiveProvidersDesc",
                  "Connect at least one provider before you start the relay."
                )}
              </p>
            </CliToolNotice>
          ) : null}

          {status?.hasCachedPassword && !isWindows ? (
            <CliToolNotice
              tone="info"
              icon="lock_clock"
              title={translateOrFallback("cards.zavorthBridge.cachedPassword", "Cached operator password")}
            >
              <p>
                {translateOrFallback(
                  "cards.zavorthBridge.cachedPasswordHint",
                  "The local relay already holds a cached password, so Zavorth can reuse it for the next start or stop action."
                )}
              </p>
            </CliToolNotice>
          ) : null}

          {renderMessage()}

          <div className="flex flex-wrap items-center gap-2">
            {isRunning ? (
              <Button
                variant="danger"
                size="sm"
                onClick={handleStop}
                disabled={loading}
                icon="stop_circle"
              >
                {translateOrFallback("stopMitm", "Stop relay")}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleStart}
                disabled={loading || !hasActiveProviders}
                icon="play_circle"
              >
                {translateOrFallback("startMitm", "Start relay")}
              </Button>
            )}

            <CliToolMetaPill tone={isRunning ? "success" : "warning"} icon="shield_lock">
              {isWindows
                ? translateOrFallback("cards.zavorthBridge.platformWindows", "Windows uses UAC prompts")
                : translateOrFallback(
                    "cards.zavorthBridge.platformUnix",
                    "macOS/Linux may request operator elevation"
                  )}
            </CliToolMetaPill>
          </div>
        </CliToolCardSection>

        {isRunning ? (
          <>
            <CliToolCardSection
              title={translateOrFallback("cards.zavorthBridge.keyTitle", "Credential route")}
              description={translateOrFallback(
                "cards.zavorthBridge.keyDescription",
                "Choose which Zavorth key the relay should present when this tool calls upstream models."
              )}
              icon="key"
            >
              <CliToolLabeledField
                label={translateOrFallback("apiKey", "API key")}
                hint={translateOrFallback(
                  "cards.zavorthBridge.keyHint",
                  "The selected key is used for forwarded model requests."
                )}
              >
                {apiKeys.length > 0 ? (
                  <select
                    value={selectedApiKey}
                    onChange={(event) => setSelectedApiKey(event.target.value)}
                    className={fieldClassName}
                  >
                    {apiKeys.map((key) => (
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
                            "cards.zavorthBridge.localKeyInjected",
                            "Local gateway key will be injected automatically"
                          )
                    }
                  >
                    <p>
                      {cloudEnabled
                        ? translateOrFallback(
                            "cards.zavorthBridge.noCloudKeyHint",
                            "Add a provider key in Settings before you continue."
                          )
                        : translateOrFallback(
                            "cards.zavorthBridge.localKeyHint",
                            "Zavorth keeps a local fallback key available while the relay is running."
                          )}
                    </p>
                  </CliToolNotice>
                )}
              </CliToolLabeledField>
            </CliToolCardSection>

            <CliToolCardSection
              title={translateOrFallback("cards.zavorthBridge.aliasTitle", "Alias relay")}
              description={translateOrFallback(
                "cards.zavorthBridge.aliasDescription",
                "Map the tool-facing aliases to real Zavorth models before you save the relay profile."
              )}
              icon="model_training"
              tone="info"
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSaveMappings}
                  disabled={loading || Object.keys(modelMappings).length === 0}
                >
                  {translateOrFallback("saveMappings", "Save mappings")}
                </Button>
              }
            >
              {(tool.defaultModels || []).map((model) => (
                <CliToolLabeledField
                  key={model.alias}
                  label={model.name}
                  hint={translateOrFallback("cards.zavorthBridge.aliasHint", "Alias") + `: ${model.alias}`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={modelMappings[model.alias] || ""}
                      onChange={(event) =>
                        handleModelMappingChange(model.alias, event.target.value)
                      }
                      placeholder={translateOrFallback("modelPlaceholder", "model")}
                      className={fieldClassName}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openModelSelector(model.alias)}
                      disabled={!hasActiveProviders}
                    >
                      {translateOrFallback("select", "Select")}
                    </Button>
                    {modelMappings[model.alias] ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleModelMappingChange(model.alias, "")}
                        icon="close"
                        aria-label={translateOrFallback("clear", "Clear")}
                        className="px-2"
                      />
                    ) : null}
                  </div>
                </CliToolLabeledField>
              ))}
            </CliToolCardSection>
          </>
        ) : (
          <CliToolCardSection
            title={translateOrFallback("howItWorks", "How it works")}
            description={translateOrFallback(
              "cards.zavorthBridge.howDescription",
              "Zavorth only brings the interception layer online when you explicitly start the relay."
            )}
            icon="route"
            tone="warning"
          >
            {(() => {
              const mitmDomains = {
                zavorthBridge: "daily-cloudcode-pa.googleapis.com",
                kiro: "api.anthropic.com",
              };
              const toolName = tool.name || tool.id;
              const domain = mitmDomains[tool.id] || mitmDomains.zavorthBridge;

              return (
                <>
                  <CliToolNotice
                    tone="info"
                    icon="privacy_tip"
                    title={translateOrFallback("cards.zavorthBridge.boundaryTitle", "Interception boundary")}
                  >
                    <p>
                      {translateOrFallback(
                        "mitmHowWorksDesc",
                        `${toolName} points to the local relay, and Zavorth rewrites the upstream target before forwarding the request.`,
                        { toolName }
                      )}
                    </p>
                  </CliToolNotice>

                  <div className="grid gap-3">
                    <div className="rounded-2xl border border-black/8 bg-black/[0.025] p-3 dark:border-white/8 dark:bg-white/[0.03]">
                      <p className="text-sm font-medium text-text-main">
                        1. {translateOrFallback("mitmStep1", "Install the local trust material")}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-black/8 bg-black/[0.025] p-3 dark:border-white/8 dark:bg-white/[0.03]">
                      <p className="text-sm font-medium text-text-main">
                        2.{" "}
                        {translateOrFallback(
                          "cards.zavorthBridge.domainRoute",
                          "Route the tool traffic for this domain through the relay:"
                        )}
                      </p>
                      <code className="mt-2 inline-flex max-w-full rounded-xl bg-black/[0.04] px-2.5 py-1.5 text-xs text-text-main dark:bg-white/[0.06]">
                        {domain}
                      </code>
                    </div>
                    <div className="rounded-2xl border border-black/8 bg-black/[0.025] p-3 dark:border-white/8 dark:bg-white/[0.03]">
                      <p className="text-sm font-medium text-text-main">
                        3.{" "}
                        {translateOrFallback(
                          "mitmStep3",
                          `Restart ${toolName} and let Zavorth translate the selected aliases.`,
                          { toolName }
                        )}
                      </p>
                    </div>
                  </div>
                </>
              );
            })()}
          </CliToolCardSection>
        )}
      </CliToolCardFrame>

      <Modal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setSudoPassword("");
          setMessage(null);
        }}
        title={translateOrFallback("sudoPasswordRequiredTitle", "Sudo password required")}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <CliToolNotice
            tone="warning"
            icon="warning"
            title={translateOrFallback("sudoPasswordHintTitle", "Operator confirmation")}
          >
            <p>{translateOrFallback("sudoPasswordHint", "Zavorth needs elevated access to manage the local relay.")}</p>
          </CliToolNotice>

          <Input
            type="password"
            placeholder={translateOrFallback("enterSudoPassword", "Enter sudo password")}
            value={sudoPassword}
            onChange={(event) => setSudoPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !loading) {
                handleConfirmPassword();
              }
            }}
          />

          {renderMessage()}

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowPasswordModal(false);
                setSudoPassword("");
                setMessage(null);
              }}
              disabled={loading}
            >
              {translateOrFallback("cancel", "Cancel")}
            </Button>
            <Button variant="primary" size="sm" onClick={handleConfirmPassword} loading={loading}>
              {translateOrFallback("confirm", "Confirm")}
            </Button>
          </div>
        </div>
      </Modal>

      <ModelSelectModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={handleModelSelect}
        selectedModel={currentEditingAlias ? modelMappings[currentEditingAlias] : null}
        activeProviders={activeProviders}
        title={translateOrFallback(
          "selectModelForAlias",
          `Select model for ${currentEditingAlias || ""}`,
          {
            alias: currentEditingAlias || "",
          }
        )}
      />
    </>
  );
}
