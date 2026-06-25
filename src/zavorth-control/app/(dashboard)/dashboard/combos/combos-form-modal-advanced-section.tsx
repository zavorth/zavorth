"use client";

import { FieldLabelWithHelp } from "./combos-page-shared";
import { ADVANCED_FIELD_HELP_FALLBACK, getI18nOrFallback } from "./combos-page-helpers";
import type { ComboFormModalController } from "./combos-form-modal.hooks";

type Props = Pick<
  ComboFormModalController,
  | "t"
  | "strategy"
  | "showAdvanced"
  | "setShowAdvanced"
  | "config"
  | "setConfig"
  | "agentSystemMessage"
  | "setAgentSystemMessage"
  | "agentToolFilter"
  | "setAgentToolFilter"
  | "agentContextCache"
  | "setAgentContextCache"
>;

export function ComboFormModalAdvancedSection(props: Props) {
  const {
    t,
    strategy,
    showAdvanced,
    setShowAdvanced,
    config,
    setConfig,
    agentSystemMessage,
    setAgentSystemMessage,
    agentToolFilter,
    setAgentToolFilter,
    agentContextCache,
    setAgentContextCache,
  } = props;

  return (
    <>
      <button
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center gap-1 text-xs text-text-muted hover:text-text-main transition-colors self-start"
      >
        <span className="material-symbols-outlined text-[14px]">
          {showAdvanced ? "expand_less" : "expand_more"}
        </span>
        {t("advancedSettings")}
      </button>

      {showAdvanced && (
        <div className="flex flex-col gap-2 p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-lg border border-black/5 dark:border-white/5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabelWithHelp
                label={t("maxRetries")}
                help={getI18nOrFallback(
                  t,
                  "advancedHelp.maxRetries",
                  ADVANCED_FIELD_HELP_FALLBACK.maxRetries
                )}
              />
              <input
                type="number"
                min="0"
                max="10"
                value={(config.maxRetries as number | undefined) ?? ""}
                placeholder="1"
                onChange={(e) =>
                  setConfig({
                    ...config,
                    maxRetries: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="w-full text-xs py-1.5 px-2 rounded border border-black/10 dark:border-white/10 bg-transparent focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <FieldLabelWithHelp
                label={t("retryDelay")}
                help={getI18nOrFallback(
                  t,
                  "advancedHelp.retryDelay",
                  ADVANCED_FIELD_HELP_FALLBACK.retryDelay
                )}
              />
              <input
                type="number"
                min="0"
                max="60000"
                step="500"
                value={(config.retryDelayMs as number | undefined) ?? ""}
                placeholder="2000"
                onChange={(e) =>
                  setConfig({
                    ...config,
                    retryDelayMs: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="w-full text-xs py-1.5 px-2 rounded border border-black/10 dark:border-white/10 bg-transparent focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <FieldLabelWithHelp
                label={t("timeout")}
                help={getI18nOrFallback(
                  t,
                  "advancedHelp.timeout",
                  ADVANCED_FIELD_HELP_FALLBACK.timeout
                )}
              />
              <input
                type="number"
                min="1000"
                max="600000"
                step="1000"
                value={(config.timeoutMs as number | undefined) ?? ""}
                placeholder="120000"
                onChange={(e) =>
                  setConfig({
                    ...config,
                    timeoutMs: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="w-full text-xs py-1.5 px-2 rounded border border-black/10 dark:border-white/10 bg-transparent focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <FieldLabelWithHelp
                label={t("healthcheck")}
                help={getI18nOrFallback(
                  t,
                  "advancedHelp.healthcheck",
                  ADVANCED_FIELD_HELP_FALLBACK.healthcheck
                )}
              />
              <input
                type="checkbox"
                checked={config.healthCheckEnabled !== false}
                onChange={(e) => setConfig({ ...config, healthCheckEnabled: e.target.checked })}
                className="accent-primary"
              />
            </div>
          </div>
          {strategy === "round-robin" && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/5 dark:border-white/5">
              <div>
                <FieldLabelWithHelp
                  label={t("concurrencyPerModel")}
                  help={getI18nOrFallback(
                    t,
                    "advancedHelp.concurrencyPerModel",
                    ADVANCED_FIELD_HELP_FALLBACK.concurrencyPerModel
                  )}
                />
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={(config.concurrencyPerModel as number | undefined) ?? ""}
                  placeholder="3"
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      concurrencyPerModel: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full text-xs py-1.5 px-2 rounded border border-black/10 dark:border-white/10 bg-transparent focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <FieldLabelWithHelp
                  label={t("queueTimeout")}
                  help={getI18nOrFallback(
                    t,
                    "advancedHelp.queueTimeout",
                    ADVANCED_FIELD_HELP_FALLBACK.queueTimeout
                  )}
                />
                <input
                  type="number"
                  min="1000"
                  max="120000"
                  step="1000"
                  value={(config.queueTimeoutMs as number | undefined) ?? ""}
                  placeholder="30000"
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      queueTimeoutMs: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full text-xs py-1.5 px-2 rounded border border-black/10 dark:border-white/10 bg-transparent focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          )}
          {strategy === "context-relay" && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 border-t border-black/5 dark:border-white/5">
              <div>
                <FieldLabelWithHelp
                  label={getI18nOrFallback(
                    t,
                    "contextRelayHandoffThreshold",
                    "Handoff Threshold"
                  )}
                  help={getI18nOrFallback(
                    t,
                    "contextRelayHandoffThresholdHelp",
                    "When quota usage reaches this threshold, ZavorthGateway generates a structured handoff summary before the account is exhausted."
                  )}
                />
                <input
                  type="number"
                  min="0.5"
                  max="0.94"
                  step="0.01"
                  value={(config.handoffThreshold as number | undefined) ?? ""}
                  placeholder="0.85"
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      handoffThreshold: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full text-xs py-1.5 px-2 rounded border border-black/10 dark:border-white/10 bg-transparent focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <FieldLabelWithHelp
                  label={getI18nOrFallback(
                    t,
                    "contextRelayMaxMessages",
                    "Max Messages For Summary"
                  )}
                  help={getI18nOrFallback(
                    t,
                    "contextRelayMaxMessagesHelp",
                    "Limits how much recent history is condensed into the relay summary."
                  )}
                />
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={(config.maxMessagesForSummary as number | undefined) ?? ""}
                  placeholder="30"
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      maxMessagesForSummary: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full text-xs py-1.5 px-2 rounded border border-black/10 dark:border-white/10 bg-transparent focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <FieldLabelWithHelp
                  label={getI18nOrFallback(t, "contextRelaySummaryModel", "Summary Model")}
                  help={getI18nOrFallback(
                    t,
                    "contextRelaySummaryModelHelp",
                    "Optional override model used only for generating the handoff summary. Leave empty to reuse the active combo model."
                  )}
                />
                <input
                  type="text"
                  value={(config.handoffModel as string | undefined) ?? ""}
                  placeholder="codex/gpt-5.4"
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      handoffModel: e.target.value || undefined,
                    })
                  }
                  className="w-full text-xs py-1.5 px-2 rounded border border-black/10 dark:border-white/10 bg-transparent focus:border-primary focus:outline-none"
                />
              </div>
              <div className="md:col-span-3 rounded-md border border-fuchsia-500/20 bg-fuchsia-500/5 px-2 py-1.5">
                <p className="text-[10px] text-fuchsia-700 dark:text-fuchsia-300">
                  {getI18nOrFallback(
                    t,
                    "contextRelayProviderNote",
                    "Context Relay currently generates handoffs for Codex account rotation. Pair it with multiple accounts of the same provider for the best continuity."
                  )}
                </p>
              </div>
            </div>
          )}
          <p className="text-[10px] text-text-muted">{t("advancedHint")}</p>
        </div>
      )}

      <div className="flex flex-col gap-2 p-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-lg border border-black/5 dark:border-white/5">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="material-symbols-outlined text-[14px] text-primary">smart_toy</span>
          <p className="text-xs font-medium">Agent Features</p>
          <span className="text-[10px] text-text-muted">- optional, for agent/tool workflows</span>
        </div>

        <div>
          <label className="text-[11px] font-medium text-text-muted block mb-0.5">
            System Message Override
          </label>
          <textarea
            rows={2}
            value={agentSystemMessage}
            onChange={(e) => setAgentSystemMessage(e.target.value)}
            placeholder="Override the system prompt for all requests routed through this combo..."
            className="w-full text-xs py-1.5 px-2 rounded border border-black/10 dark:border-white/10 bg-transparent focus:border-primary focus:outline-none resize-none"
          />
          <p className="text-[10px] text-text-muted mt-0.5">
            Replaces any system message sent by the client. Leave empty to pass through client
            system messages.
          </p>
        </div>

        <div>
          <label className="text-[11px] font-medium text-text-muted block mb-0.5">
            Tool Filter Regex
          </label>
          <input
            type="text"
            value={agentToolFilter}
            onChange={(e) => setAgentToolFilter(e.target.value)}
            placeholder="e.g. ^(bash|computer)$"
            className="w-full text-xs py-1.5 px-2 rounded border border-black/10 dark:border-white/10 bg-transparent focus:border-primary focus:outline-none font-mono"
          />
          <p className="text-[10px] text-text-muted mt-0.5">
            Only tools whose name matches this regex are forwarded to the provider. Leave empty to
            forward all tools.
          </p>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div>
            <label className="text-[11px] font-medium text-text-muted block">
              Context Cache Protection
            </label>
            <p className="text-[10px] text-text-muted">
              Pins the provider/model across turns to preserve cache sessions. Internal tags are
              stripped before forwarding to the provider.
            </p>
          </div>
          <input
            type="checkbox"
            checked={agentContextCache}
            onChange={(e) => setAgentContextCache(e.target.checked)}
            className="accent-primary shrink-0"
          />
        </div>
      </div>
    </>
  );
}
