"use client";

import { ManualConfigModal, ModelSelectModal } from "@/shared/components";
import { CodexConfigPanel } from "./codex-tool-card/CodexConfigPanel";
import { CodexInstallGuide } from "./codex-tool-card/CodexInstallGuide";
import { useCodexToolCard } from "./codex-tool-card/useCodexToolCard";
import CliStatusBadge from "./CliStatusBadge";
import CliToolCardFrame, {
  CliToolCardSection,
  CliToolMetaPill,
  CliToolNotice,
} from "./CliToolCardFrame";

export default function CodexToolCard({
  tool,
  isExpanded,
  onToggle,
  baseUrl,
  apiKeys,
  activeProviders,
  cloudEnabled,
  batchStatus,
  lastConfiguredAt,
}) {
  const state = useCodexToolCard({
    apiKeys,
    baseUrl,
    batchStatus,
    cloudEnabled,
    isExpanded,
  });
  const {
    checkingCodex,
    cliReady,
    codexStatus,
    effectiveConfigStatus,
    getManualConfigs,
    handleModelSelect,
    modalOpen,
    modelAliases,
    selectedModel,
    setModalOpen,
    setShowManualConfigModal,
    showManualConfigModal,
    t,
  } = state;

  return (
    <>
      <CliToolCardFrame
        tool={tool}
        toolKey="codex"
        isExpanded={isExpanded}
        onToggle={onToggle}
        eyebrow="Codex profile surface"
        summary={tool.description}
        status={
          <CliStatusBadge
            effectiveConfigStatus={effectiveConfigStatus}
            batchStatus={batchStatus}
            lastConfiguredAt={lastConfiguredAt}
          />
        }
        meta={
          <>
            <CliToolMetaPill icon="terminal">codex</CliToolMetaPill>
            <CliToolMetaPill tone={cliReady ? "success" : "neutral"} icon="settings_ethernet">
              {cliReady ? "Runtime ready" : "Runtime check on open"}
            </CliToolMetaPill>
          </>
        }
      >
        <CliToolCardSection
          title="Codex runtime"
          description="Zavorth keeps Codex config, auth and saved profiles together without folding this into the agent loop."
          icon="monitoring"
        >
          {checkingCodex ? (
            <CliToolNotice tone="info" icon="progress_activity" title={t("checkingCli", { tool: "Codex" })} />
          ) : null}

          {!checkingCodex && codexStatus && !cliReady ? (
            <CodexInstallGuide
              codexStatus={codexStatus}
              showInstallGuide={state.showInstallGuide}
              setShowInstallGuide={state.setShowInstallGuide}
              t={t}
            />
          ) : null}

          {!checkingCodex && cliReady ? (
            <CodexConfigPanel
              {...state}
              activeProviders={activeProviders}
              apiKeys={apiKeys}
              baseUrl={baseUrl}
              cloudEnabled={cloudEnabled}
            />
          ) : null}
        </CliToolCardSection>
      </CliToolCardFrame>

      <ModelSelectModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={handleModelSelect}
        selectedModel={selectedModel}
        activeProviders={activeProviders}
        modelAliases={modelAliases}
        title={t("selectModelForTool", { tool: "Codex" })}
      />

      <ManualConfigModal
        isOpen={showManualConfigModal}
        onClose={() => setShowManualConfigModal(false)}
        title={t("codexManualConfiguration")}
        configs={getManualConfigs()}
      />
    </>
  );
}
