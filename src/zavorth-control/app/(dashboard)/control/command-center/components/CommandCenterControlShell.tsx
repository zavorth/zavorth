"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ControlPageClientModel } from "../../controlPageClient.types";
import { asText } from "../../controlPageClient.utils";
import { buildDashboardCommandCenterViewModel } from "../adapters";
import type {
  DashboardCommandAction,
  DashboardCommandCenterViewModel,
  DashboardIntelligenceFabricHealthSnapshot,
  DashboardNavigationSector,
  DashboardRunObservatoryDiffPreview,
  DashboardRunObservatoryQuery,
} from "../contracts";
// QA sentinel: CommandCenterStateCard Run Observatory viewModel.runObservatory formatCommandCenterRunObservatoryQuery bcc-release-strip
import { applyCommandCenterDiffPreview } from "./CommandCenterApplyDiffPreviewAction";
import { demoteCommandCenterIntelligenceFabric } from "./CommandCenterDemoteFabricAction";
import { CommandCenterChatSurface } from "./CommandCenterChatSurface";
import { CommandCenterCommandPalette } from "./CommandCenterCommandPalette";
import { buildCommandCenterActiveRunMetadata } from "./CommandCenterControlShellMetadata";
import { CommandCenterMissionBrief } from "./CommandCenterControlShellChrome";
import {
  renderCommandCenterCronSector,
  renderCommandCenterDocsSector,
  resolveCommandCenterSalesPackBusinessIdentity,
} from "./CommandCenterControlShellAuxiliary";
import { CommandCenterDeveloperWorkspace } from "./CommandCenterDeveloperWorkspace";
import { CommandCenterGatewayConsole } from "./CommandCenterGatewayConsole";
import { CommandCenterOnboardingPanel } from "./CommandCenterOnboardingPanel";
import { OnboardingWizardModal } from "./OnboardingWizardModal";
import {  commandCenterRunObservatoryHasQuery,
  filterCommandCenterRunObservatory,
  formatCommandCenterBudgetDetail,
  formatCommandCenterBudgetLabel,
  formatCommandCenterModelRouteDetail,
  formatCommandCenterModelRouteLabel,
  formatCommandCenterRunIdentity,
  formatCommandCenterRunMatchedBy,
  formatCommandCenterRunObservatoryQuery,
  formatCommandCenterRunStatusIndex,
  normalizeCommandCenterRunObservatoryQuery,
} from "./CommandCenterObservability";
import { CommandCenterOperationsPanel } from "./CommandCenterOperationsPanel";
import { CommandCenterOverviewSector } from "./CommandCenterOverviewSector";
import { CommandCenterSalesOsSector } from "./CommandCenterSalesOsSector";
import { RuntimeKeyValueList } from "./CommandCenterRuntimeKeyValueList";
import {
  applyCommandCenterRunObservatoryQuery,
  asRecordArray,
  clearCommandCenterRunObservatorySearchParams,
  formatRuntimeDetail,
  humanAgentStatus,
  humanRuntimeStatus,
  readCommandCenterRunObservatoryUrlQuery,
  runtimeTone,
} from "./CommandCenterControlShellHelpers";
import {
  CommandCenterBadge,
  CommandCenterBridge,
  CommandCenterCard,
  CommandCenterDock,
  CommandCenterShell,
} from "./CommandCenterPrimitives";
import { useCommandCenterNexusWorkbench } from "./useCommandCenterNexusWorkbench";
import {
  useCommandCenterSalesPackBusinessMode,
  type CommandCenterSalesPackBusinessController,
} from "./useCommandCenterSalesPackBusinessMode";

const COMMAND_CENTER_BLOCKED_FIXTURE_QUERY_PARAM = "fixture";

type CommandCenterControlShellProps = { model: ControlPageClientModel };

export function CommandCenterControlShell({ model }: CommandCenterControlShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsText = searchParams.toString();
  const [activeSectorId, setActiveSectorId] = useState<DashboardNavigationSector["id"]>("terminal");
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    async function checkOnboarding() {
      try {
        const res = await fetch("/api/onboarding/state");
        const data = await res.json();
        if (data?.phase === "wizard_required") {
          setShowWizard(true);
        }
      } catch (err) {
        console.error("Failed to check onboarding state", err);
      }
    }
    void checkOnboarding();
  }, []);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const nexusWorkbenchController = useCommandCenterNexusWorkbench({
    activeSessionId: model.activeSessionId,
    wsStatus: model.wsStatus,
    reloadControlState: model.loadControlState,
  });
  const salesPackBusinessIdentity = useMemo(
    () => resolveCommandCenterSalesPackBusinessIdentity(model),
    [
      model.state,
      model.runtime,
      model.productModeId,
    ],
  );
  const salesPackBusinessMode = useCommandCenterSalesPackBusinessMode(salesPackBusinessIdentity);
  const nexusWorkbench = nexusWorkbenchController.snapshot;
  const observatoryQuery = useMemo(
    () => readCommandCenterRunObservatoryUrlQuery(searchParams),
    [searchParamsText],
  );
  const liveViewModel = useMemo(
    () => {
      const agentRuntime = model.state?.agentRuntime as Record<string, any> | null | undefined;
      const activeRun = agentRuntime?.activeRun as Record<string, any> | null | undefined;
      return applyCommandCenterRunObservatoryQuery(buildDashboardCommandCenterViewModel({
        state: model.state,
        runtime: model.runtime,
        activeSessionId: model.activeSessionId,
        effectiveSessionId: model.effectiveSessionId,
        productModeId: model.productModeId,
        productModeLabel: model.productModeLabel,
        runtimeStatus: model.runtimeStatus,
        wsStatus: model.wsStatus,
        error: model.error,
        loading: model.loading,
        sending: model.sending,
        sessionEntries: model.sessionEntries,
        transcriptEntries: model.transcriptEntries,
        taskEntries: model.taskEntries,
        toolRuns: model.toolRuns,
        artifacts: model.artifacts,
        approvals: model.approvals,
        capabilities: model.capabilities,
        companions: model.companions,
        topConsumers: model.topConsumers,
        memoryRecall: model.memoryRecall,
        memoryRecallSources: model.memoryRecallSources,
        runtimeWarnings: model.runtimeWarnings,
        recommendations: model.recommendations,
        recommendedJourneys: model.recommendedJourneys,
        visibleSurfaces: model.visibleSurfaces,
        adapterSource: agentRuntime?.source || null,
        agentRun: activeRun || null,
        agentTrace: activeRun?.trace || agentRuntime?.trace || null,
        traceEvents: activeRun?.traceEvents || agentRuntime?.traceEvents || [],
        runObservatory: agentRuntime?.runObservatory || null,
        ...buildCommandCenterActiveRunMetadata(activeRun),
        developerWorkspace: model.developerWorkspace,
        nexusWorkbench,
      }), observatoryQuery);
    },
    [model, nexusWorkbench, observatoryQuery],
  );
  const viewModel = liveViewModel;

  const activeSector = viewModel.sectors.find((sector) => sector.id === activeSectorId);
  const handleRunObservatoryQueryChange = (query: DashboardRunObservatoryQuery) => {
    const normalizedQuery = normalizeCommandCenterRunObservatoryQuery(query);
    const next = new URLSearchParams(searchParamsText);
    clearCommandCenterRunObservatorySearchParams(next);
    if (normalizedQuery.runId) {
      next.set("runId", normalizedQuery.runId);
    }
    if (normalizedQuery.traceId) {
      next.set("traceId", normalizedQuery.traceId);
    }
    if (normalizedQuery.status) {
      next.set("status", Array.isArray(normalizedQuery.status)
        ? normalizedQuery.status.join(",")
        : normalizedQuery.status);
    }
    if (normalizedQuery.limit) {
      next.set("limit", String(normalizedQuery.limit));
    }
    if (normalizedQuery.sessionId) {
      next.set("sessionId", normalizedQuery.sessionId);
    }
    router.replace(`/control${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
    setActiveSectorId("overview");
    if (normalizedQuery.sessionId && normalizedQuery.sessionId !== model.activeSessionId) {
      void model.loadControlState(normalizedQuery.sessionId);
    }
  };
  const handleDraftCommand = (command: string) => {
    model.setDraft(command);
    setActiveSectorId("terminal");
  };
  const handleApplyDiffPreview = (preview: DashboardRunObservatoryDiffPreview) => applyCommandCenterDiffPreview({
    preview,
    activeSessionId: model.activeSessionId,
    reloadControlState: model.loadControlState,
  });
  const handleDemoteIntelligenceFabric = (health: DashboardIntelligenceFabricHealthSnapshot) => demoteCommandCenterIntelligenceFabric({
    health,
    activeSessionId: model.activeSessionId,
    reloadControlState: model.loadControlState,
  });
  const handleAction = (action: DashboardCommandAction) => {
    if (action.id === "navigate.chat") {
      setActiveSectorId("terminal");
      return;
    }
    if (action.id === "workspace.open") {
      setActiveSectorId("workspace");
      return;
    }
    if (action.id === "runtime.doctor") {
      handleDraftCommand("/doctor");
      return;
    }
    if (action.id === "runtime.status") {
      handleDraftCommand("/mode status");
      return;
    }
    if (action.id === "session.new") {
      handleDraftCommand("Comecar uma nova sessao");
      return;
    }
    if (action.id === "settings.open") {
      setActiveSectorId("config");
      return;
    }
    if (action.id === "approvals.open") {
      setActiveSectorId("overview");
    }
  };
  useEffect(() => {
    const next = new URLSearchParams(searchParamsText);
    if (!next.has(COMMAND_CENTER_BLOCKED_FIXTURE_QUERY_PARAM)) return;
    next.delete(COMMAND_CENTER_BLOCKED_FIXTURE_QUERY_PARAM);
    router.replace(`/control${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false });
  }, [router, searchParamsText]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  return (
    <CommandCenterShell
      bridge={(
        <CommandCenterBridge
          runtime={viewModel.runtime}
          currentTitle={activeSector?.title ?? "Chat"}
          onSearch={() => setPaletteOpen(true)}
        />
      )}
      dock={(
        <CommandCenterDock
          sectors={viewModel.sectors}
          activeSectorId={activeSectorId}
          onSelect={setActiveSectorId}
        />
      )}
    >
      <CommandCenterMissionBrief
        viewModel={viewModel}
        onAction={handleAction}
      />

      <div className="bcc-control-grid">
        <aside className="bcc-side-panel">
          <CommandCenterOnboardingPanel
            model={model}
            viewModel={viewModel}
            onDraftCommand={handleDraftCommand}
            onNavigate={setActiveSectorId}
          />

          <CommandCenterCard label="Sessao ativa" title={viewModel.runtime.activeSessionId ?? "Nova conversa"}>
            <p>{viewModel.runtime.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CommandCenterBadge tone={viewModel.runtime.status === "ready" ? "ok" : "warn"}>
                {viewModel.runtime.currentModelLabel}
              </CommandCenterBadge>
              <CommandCenterBadge>
                {viewModel.runtime.currentProviderLabel}
              </CommandCenterBadge>
            </div>
          </CommandCenterCard>

          <CommandCenterCard label="Sessoes" title={`${viewModel.counts.sessions} visiveis`}>
            <div className="bcc-list">
              {viewModel.sessions.length > 0 ? viewModel.sessions.slice(0, 6).map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className="bcc-list-item text-left"
                  data-active={session.status === "active"}
                  onClick={() => {
                    void model.handleSessionChange(session.id);
                  }}
                >
                  <span className="bcc-list-item__title">{session.title}</span>
                  <span className="bcc-list-item__meta">{session.updatedAt}</span>
                </button>
              )) : (
                <p className="bcc-empty-note">Nenhuma sessao listada ainda.</p>
              )}
            </div>
          </CommandCenterCard>

          <CommandCenterCard label="Acoes" title="Proximo passo">
            <div className="bcc-list">
              {viewModel.actions.slice(0, 4).map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="bcc-list-item text-left"
                  onClick={() => {
                    if (action.id === "runtime.doctor") {
                      handleDraftCommand("/doctor");
                    } else if (action.id === "runtime.status") {
                      handleDraftCommand("/mode status");
                    } else if (action.id === "session.new") {
                      handleDraftCommand("Comecar uma nova sessao");
                    } else {
                      handleAction(action);
                    }
                  }}
                >
                  <span className="bcc-list-item__title">{action.label}</span>
                  <span className="bcc-list-item__meta">{action.description}</span>
                </button>
              ))}
            </div>
          </CommandCenterCard>
        </aside>
        <section className="bcc-panel bcc-chat-panel">
          {activeSectorId === "terminal" ? (
            <CommandCenterChatSurface
              viewModel={viewModel}
              draft={model.draft}
              sending={model.sending}
              onDraftChange={model.setDraft}
              onSend={model.handleSend}
              onResolveApproval={model.handleApproval}
              resolvingApprovalId={model.resolvingApprovalId}
            />
          ) : (
            <CommandCenterSectorFrame
              sector={activeSector}
              sectorId={activeSectorId}
              viewModel={viewModel}
              model={model}
              onNavigate={setActiveSectorId}
            >
                <SectorContent
                  sectorId={activeSectorId}
                  viewModel={viewModel}
                  model={model}
                  observatoryQuery={observatoryQuery}
                  onRunObservatoryQueryChange={handleRunObservatoryQueryChange}
                  onApplyDiffPreview={handleApplyDiffPreview}
                  onDemoteIntelligenceFabric={handleDemoteIntelligenceFabric}
                  nexusWorkbenchActionId={nexusWorkbenchController.busyActionId}
                  nexusWorkbenchMessage={nexusWorkbenchController.message}
                  onResolveNexusApproval={nexusWorkbenchController.resolveApproval}
                  onRunNexusWorkbenchAction={nexusWorkbenchController.runAction}
                  onInspectNexusCapabilities={nexusWorkbenchController.inspectCapabilities}
                  salesPackBusinessMode={salesPackBusinessMode}
                  nexusWorkbenchRaw={nexusWorkbenchController.snapshot}
                />
            </CommandCenterSectorFrame>
          )}
        </section>
        <CommandCenterOperationsPanel
          model={model}
          viewModel={viewModel}
          onDraftCommand={handleDraftCommand}
        />
      </div>

      <CommandCenterCommandPalette
        open={paletteOpen}
        actions={viewModel.actions}
        sectors={viewModel.sectors}
        activeSectorId={activeSectorId}
        onClose={() => setPaletteOpen(false)}
        onAction={handleAction}
        onNavigate={setActiveSectorId}
      />
      <OnboardingWizardModal
        isOpen={showWizard}
        onComplete={() => {
          setShowWizard(false);
          void model.loadControlState();
        }}
      />
    </CommandCenterShell>
  );
}

type CommandCenterSectorFrameProps = {
  sector: DashboardNavigationSector | undefined;
  sectorId: DashboardNavigationSector["id"];
  viewModel: DashboardCommandCenterViewModel;
  model: ControlPageClientModel;
  onNavigate: (sectorId: DashboardNavigationSector["id"]) => void;
  children: ReactNode;
};

function CommandCenterSectorFrame({
  sector,
  sectorId,
  viewModel,
  model,
  onNavigate,
  children,
}: CommandCenterSectorFrameProps) {
  const title = sector?.title ?? "Painel";
  const subtitle = commandCenterSectorSubtitle(sectorId);
  const pendingApprovals = viewModel.approvals.filter((approval) => approval.status === "pending").length;
  const receiptCount = viewModel.runObservatory.receipts?.length ?? viewModel.counts.artifacts;

  return (
    <div className="bcc-sector-surface" data-sector={sectorId}>
      <header className="bcc-sector-header">
        <div>
          <p className="bcc-sector-header__eyebrow">{sector?.label ?? "Zavorth"}</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="bcc-sector-header__actions">
          <CommandCenterBadge tone={viewModel.runtime.status === "ready" ? "ok" : "warn"}>
            {viewModel.runtime.currentProviderLabel}
          </CommandCenterBadge>
          <CommandCenterBadge tone={pendingApprovals > 0 ? "warn" : "ok"}>
            {pendingApprovals} approval
          </CommandCenterBadge>
          <CommandCenterBadge>
            {receiptCount} receipt
          </CommandCenterBadge>
        </div>
      </header>

      <div className="bcc-sector-quickbar" aria-label="Acoes rapidas da secao">
        <button type="button" onClick={() => onNavigate("terminal")}>Abrir chat</button>
        <button type="button" onClick={() => onNavigate("overview")}>Visao geral</button>
        <button type="button" onClick={() => onNavigate("config")}>Config</button>
        <button type="button" onClick={() => void model.loadControlState(model.activeSessionId)}>Atualizar</button>
      </div>

      <div className="bcc-sector-content">
        {children}
      </div>
    </div>
  );
}

function commandCenterSectorSubtitle(sectorId: DashboardNavigationSector["id"]): string {
  const copy: Record<DashboardNavigationSector["id"], string> = {
    terminal: "Converse em linguagem natural e aprove apenas quando houver risco real.",
    overview: "Resumo operacional com prontidao, trabalho atual e sinais importantes.",
    workspace: "Arquivos, processos e estado do workspace sem misturar com conversa.",
    gateway: "Rotas, provider, status de conexao e diagnostico do gateway.",
    "sales-os": "Superficie comercial e operacional quando o modo de negocio estiver ativo.",
    channels: "Canais conectados, configuraveis e continuidade entre superficies.",
    instances: "Clientes, consumers e instancias conectadas ao runtime local.",
    sessions: "Historico navegavel das conversas e runs recentes.",
    agents: "Agentes, workers e delegacoes governadas.",
    skills: "Skills, capabilities, quarentena e uso seguro de ferramentas.",
    nodes: "Rede de companions e nos externos autorizados.",
    dreams: "Memoria, artifacts reutilizaveis e sinais do Mnemos.",
    usage: "Uso real, consumo, provider ativo e sinais de custo.",
    config: "Preferencias, provider mesh, seguranca e readiness de produto.",
    docs: "Documentacao operacional curta, sem planos antigos no caminho principal.",
    cron: "Rotinas agendadas e automacoes governadas.",
  };

  return copy[sectorId] ?? "Painel operacional do Zavorth.";
}

type SectorContentProps = {
  sectorId: DashboardNavigationSector["id"];
  viewModel: DashboardCommandCenterViewModel;
  model: ControlPageClientModel;
  observatoryQuery: DashboardRunObservatoryQuery;
  onRunObservatoryQueryChange: (query: DashboardRunObservatoryQuery) => void;
  onApplyDiffPreview: (preview: DashboardRunObservatoryDiffPreview) => Promise<void>;
  onDemoteIntelligenceFabric: (health: DashboardIntelligenceFabricHealthSnapshot) => Promise<void>;
  nexusWorkbenchActionId: string | null;
  nexusWorkbenchMessage: string | null;
  onResolveNexusApproval: NonNullable<ReturnType<typeof useCommandCenterNexusWorkbench>["resolveApproval"]>;
  onRunNexusWorkbenchAction: NonNullable<ReturnType<typeof useCommandCenterNexusWorkbench>["runAction"]>;
  onInspectNexusCapabilities: NonNullable<ReturnType<typeof useCommandCenterNexusWorkbench>["inspectCapabilities"]>;
  salesPackBusinessMode: CommandCenterSalesPackBusinessController;
  nexusWorkbenchRaw: Record<string, unknown> | null;
};
function SectorContent({
  sectorId,
  viewModel,
  model,
  observatoryQuery,
  onRunObservatoryQueryChange,
  onApplyDiffPreview,
  onDemoteIntelligenceFabric,
  nexusWorkbenchActionId,
  nexusWorkbenchMessage,
  onResolveNexusApproval,
  onRunNexusWorkbenchAction,
  onInspectNexusCapabilities,
  salesPackBusinessMode,
  nexusWorkbenchRaw,
}: SectorContentProps) {
  const stateRecord = model.state as Record<string, any> | null;
  const negotiation = viewModel.capabilityNegotiation;
  const rehearsal = viewModel.toolRehearsal;
  const selfingDashboard = viewModel.selfingDashboard;
  const artifactMemory = viewModel.artifactMemory;
  const personalOpsAutopilot = viewModel.personalOpsAutopilot;
  const agentTeamCompiler = viewModel.agentTeamCompiler;
  const crossChannelContinuity = viewModel.crossChannelContinuity;
  const askBeforeAssumptionPolicy = viewModel.askBeforeAssumptionPolicy;
  const providerMeshConsolidation = viewModel.providerMeshConsolidation;
  const universalIntentTrustEnforcement = viewModel.universalIntentTrustEnforcement;
  const runArtifactReceiptReplay = viewModel.runArtifactReceiptReplay;
  const productizationEvidence = viewModel.productizationEvidence;
  const productEntryRuntime = viewModel.productEntryRuntime;
  const releaseInstallerRollbackPath = viewModel.releaseInstallerRollbackPath;
  const publicSiteDocsDemoSync = viewModel.publicSiteDocsDemoSync;
  const feedbackTelemetryProductLoop = viewModel.feedbackTelemetryProductLoop;
  const publicAdoptionPilotLoop = viewModel.publicAdoptionPilotLoop;
  const integrationShowcasePartnerSurface = viewModel.integrationShowcasePartnerSurface;
  const releaseAdoptionReadiness = viewModel.releaseAdoptionReadiness;
  const releaseCandidatePreCanaryGate = viewModel.releaseCandidatePreCanaryGate;
  const blueprintCompletionGate = viewModel.blueprintCompletionGate;
  const visibleNegotiatedCapabilities = negotiation?.capabilities.slice(0, 4) || [];
  const visibleRehearsalCalls = rehearsal?.calls.slice(0, 4) || [];
  const visibleAgentTeamRoles = agentTeamCompiler?.roles.slice(0, 5) || [];
  const visibleAskQuestions = askBeforeAssumptionPolicy?.questions.slice(0, 5) || [];
  const visibleProviderMeshRoutes = providerMeshConsolidation?.routes.slice(0, 6) || [];
  const visibleUniversalIntentGates = universalIntentTrustEnforcement?.gates.slice(0, 6) || [];
  const visibleReplayFrames = runArtifactReceiptReplay?.frames.slice(0, 6) || [];
  const visibleProductizationGates = productizationEvidence?.gates.slice(0, 6) || [];
  const visibleProductEntryGates = productEntryRuntime?.gates.slice(0, 6) || [];
  const visibleReleasePathGates = releaseInstallerRollbackPath?.gates.slice(0, 6) || [];
  const visiblePublicSyncGates = publicSiteDocsDemoSync?.gates.slice(0, 6) || [];
  const visibleFeedbackLoopGates = feedbackTelemetryProductLoop?.gates.slice(0, 6) || [];
  const visiblePilotLoopGates = publicAdoptionPilotLoop?.gates.slice(0, 6) || [];
  const visibleIntegrationShowcaseGates = integrationShowcasePartnerSurface?.gates.slice(0, 6) || [];
  const visibleReleaseAdoptionGates = releaseAdoptionReadiness?.gates.slice(0, 6) || [];
  const visiblePreCanaryGates = releaseCandidatePreCanaryGate?.gates.slice(0, 6) || [];
  const visibleBlueprintCompletionGates = blueprintCompletionGate?.gates.slice(0, 6) || [];

  if (sectorId === "overview") {
    return (
      <CommandCenterOverviewSector
        viewModel={viewModel}
        observatoryQuery={observatoryQuery}
        onRunObservatoryQueryChange={onRunObservatoryQueryChange}
        onApplyDiffPreview={onApplyDiffPreview}
        onDemoteIntelligenceFabric={onDemoteIntelligenceFabric}
        nexusWorkbenchActionId={nexusWorkbenchActionId}
        nexusWorkbenchMessage={nexusWorkbenchMessage}
        onResolveNexusApproval={onResolveNexusApproval}
        onRunNexusWorkbenchAction={onRunNexusWorkbenchAction}
        onInspectNexusCapabilities={onInspectNexusCapabilities}
        salesPackBusinessMode={salesPackBusinessMode}
      />
    );
  }

  if (sectorId === "gateway") {
    return (
      <CommandCenterGatewayConsole
        model={model}
        currentProviderLabel={viewModel.runtime.currentProviderLabel}
        currentModelLabel={viewModel.runtime.currentModelLabel}
      />
    );
  }

  if (sectorId === "workspace") {
    return (
      <CommandCenterDeveloperWorkspace model={model} />
    );
  }

  if (sectorId === "channels") {
    const channelEntries = [
      ...model.visibleSurfaces,
      ...asRecordArray(model.uiSurfaceHints?.channels),
      ...asRecordArray(model.state?.gateway?.channels),
    ];
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <CommandCenterCard label="Canais" title={`${channelEntries.length} superficies`}>
          <div className="bcc-list">
            {channelEntries.length > 0 ? channelEntries.map((entry, index) => (
              <div key={`${asText(entry?.id || entry?.label || entry?.name, "channel")}-${index}`} className="bcc-list-item">
                <span className="bcc-list-item__title">
                  {asText(entry?.label || entry?.name || entry?.id, "Canal")}
                </span>
                <span className="bcc-list-item__meta">
                  {asText(entry?.status || entry?.summary || entry?.description, "Sem status curto retornado.")}
                </span>
              </div>
            )) : (
              <p className="bcc-empty-note">Nenhum canal foi retornado pelo gateway ainda.</p>
            )}
          </div>
        </CommandCenterCard>
        <CommandCenterCard
          label="Cross-Channel Continuity"
          title={crossChannelContinuity ? `${crossChannelContinuity.status} - ${crossChannelContinuity.summary.channelCount} canais` : "Sem snapshot"}
        >
          {crossChannelContinuity ? (
            <div className="bcc-list">
              {crossChannelContinuity.channels.slice(0, 6).map((channel) => (
                <div key={channel.id} className="bcc-list-item">
                  <span className="bcc-list-item__title">
                    {channel.kind}: {channel.label}
                  </span>
                  <span className="bcc-list-item__meta">
                    {channel.status} - {channel.source} - {channel.canResume ? "resume" : "sem resume"}
                  </span>
                </div>
              ))}
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">Policy</span>
                <span className="bcc-list-item__meta">
                  {crossChannelContinuity.surface.resumeHint} - {crossChannelContinuity.surface.approvalHint}
                </span>
              </div>
            </div>
          ) : (
            <p className="bcc-empty-note">A continuidade aparece quando um run publica reply ports pelo gateway universal.</p>
          )}
        </CommandCenterCard>
      </div>
    );
  }

  if (sectorId === "instances") {
    const entries = [
      ...model.companions,
      ...model.topConsumers,
    ];
    return (
      <CommandCenterCard label="Instancias" title={`${entries.length} sinais reais`}>
        <div className="bcc-list">
          {entries.length > 0 ? entries.slice(0, 12).map((entry, index) => (
            <div key={`${asText(entry?.id || entry?.label || entry?.groupId, "instance")}-${index}`} className="bcc-list-item">
              <span className="bcc-list-item__title">
                {asText(entry?.label || entry?.name || entry?.groupId || entry?.id, "Instancia")}
              </span>
              <span className="bcc-list-item__meta">
                {formatRuntimeDetail(entry)}
              </span>
            </div>
          )) : (
            <p className="bcc-empty-note">Ainda nao ha instancias ou consumidores relevantes no snapshot.</p>
          )}
        </div>
      </CommandCenterCard>
    );
  }

  if (sectorId === "sessions") {
    return (
      <CommandCenterCard label="Sessoes" title="Historico real">
        <div className="bcc-list">
          {viewModel.sessions.length > 0 ? viewModel.sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              className="bcc-list-item text-left"
              onClick={() => {
                void model.handleSessionChange(session.id);
              }}
            >
              <span className="bcc-list-item__title">{session.title}</span>
              <span className="bcc-list-item__meta">{session.status} - {session.updatedAt}</span>
            </button>
          )) : <p className="bcc-empty-note">Nenhuma sessao listada ainda.</p>}
        </div>
      </CommandCenterCard>
    );
  }

  if (sectorId === "usage") {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <CommandCenterCard label="Uso" title="Consumo real">
          <div className="bcc-list">
            {model.topConsumers.length > 0 ? model.topConsumers.slice(0, 8).map((consumer, index) => (
              <div key={`${asText(consumer?.label || consumer?.groupId, "consumer")}-${index}`} className="bcc-list-item">
                <span className="bcc-list-item__title">
                  {asText(consumer?.label || consumer?.groupId, "Consumer")}
                </span>
                <span className="bcc-list-item__meta">{formatRuntimeDetail(consumer)}</span>
              </div>
            )) : (
              <p className="bcc-empty-note">Sem top consumers relevantes no snapshot atual.</p>
            )}
          </div>
        </CommandCenterCard>
        <CommandCenterCard label="Gateway" title="Metricas">
          <RuntimeKeyValueList
            entries={[
              ["status", model.runtimeStatus],
              ["ws", model.wsStatus],
              ["modelo", viewModel.runtime.currentModelLabel],
              ["provider", viewModel.runtime.currentProviderLabel],
            ]}
          />
        </CommandCenterCard>
      </div>
    );
  }

  if (sectorId === "agents") {
    const agentEntries = [
      ...asRecordArray(stateRecord?.agentPlane?.agents),
      ...asRecordArray(stateRecord?.controlPlane?.agents),
    ];
    return (
      <CommandCenterCard label="Agentes" title={`${agentEntries.length} registrados`}>
        <div className="bcc-list">
          {agentEntries.length > 0 ? agentEntries.map((agent, index) => (
            <div key={`${asText(agent?.id || agent?.name, "agent")}-${index}`} className="bcc-list-item">
              <span className="bcc-list-item__title">{asText(agent?.label || agent?.name || agent?.id, "Agente")}</span>
              <span className="bcc-list-item__meta">{asText(agent?.summary || agent?.status, "Sem resumo curto.")}</span>
            </div>
          )) : (
            <p className="bcc-empty-note">O registry de agentes ainda nao retornou entradas para esta surface.</p>
          )}
        </div>
      </CommandCenterCard>
    );
  }

  if (sectorId === "skills") {
    const skillMcpQuarantine = viewModel.skillMcpQuarantine;
    return (
      <CommandCenterCard
        label="Skills"
        title={negotiation ? `${negotiation.status} - ${negotiation.summary.allowedToolCount} tools` : skillMcpQuarantine ? `${skillMcpQuarantine.summary.quarantined} em quarentena` : `${viewModel.counts.capabilities} capabilities`}
      >
        <div className="bcc-list">
          {negotiation ? (
            <div className="bcc-list-item">
              <span className="bcc-list-item__title">Capability Negotiation</span>
              <span className="bcc-list-item__meta">
                {negotiation.scope.summary} - {negotiation.nextSafeAction}
              </span>
            </div>
          ) : null}
          {visibleNegotiatedCapabilities.map((capability) => (
            <div key={`negotiation:${capability.id}`} className="bcc-list-item">
              <span className="bcc-list-item__title">
                {capability.label} [{capability.risk}]
              </span>
              <span className="bcc-list-item__meta">
                {capability.toolIds.join(", ") || "sem tool"} - {capability.permission} - {capability.blocked ? "bloqueada" : "disponivel"}
              </span>
            </div>
          ))}
          {rehearsal ? (
            <div className="bcc-list-item">
              <span className="bcc-list-item__title">Tool Rehearsal</span>
              <span className="bcc-list-item__meta">
                {rehearsal.summary.callCount} call(s) - {rehearsal.status} - {rehearsal.nextSafeAction}
              </span>
            </div>
          ) : null}
          {visibleRehearsalCalls.map((call) => (
            <div key={`rehearsal:${call.id}`} className="bcc-list-item">
              <span className="bcc-list-item__title">
                {call.order}. {call.toolId} [{call.risk}]
              </span>
              <span className="bcc-list-item__meta">
                {call.expectedOutput} - {call.allowedByScope ? "escopo ok" : "escopo pendente"}
              </span>
            </div>
          ))}
          {skillMcpQuarantine && skillMcpQuarantine.entries.length > 0 ? skillMcpQuarantine.entries.map((entry) => (
            <div key={`${entry.kind}:${entry.id}`} className="bcc-list-item">
              <span className="bcc-list-item__title">
                {entry.kind}:{entry.id} [{entry.trustState}]
              </span>
              <span className="bcc-list-item__meta">
                {entry.riskLevel} - {entry.origin.source} - {entry.toolNames.length} tool(s) - {entry.requiresReview ? "review necessario" : "sem review pendente"}
              </span>
            </div>
          )) : model.capabilities.length > 0 ? model.capabilities.slice(0, 12).map((capability, index) => (
            <div key={`${asText(capability?.id || capability?.name, "capability")}-${index}`} className="bcc-list-item">
              <span className="bcc-list-item__title">
                {asText(capability?.label || capability?.name || capability?.id, "Capability")}
              </span>
              <span className="bcc-list-item__meta">
                {asText(capability?.summary || capability?.status || capability?.state, "Sem resumo curto.")}
              </span>
            </div>
          )) : <p className="bcc-empty-note">Nenhuma capability retornada pelo plano atual.</p>}
          {skillMcpQuarantine ? (
            <div className="bcc-list-item">
              <span className="bcc-list-item__title">Policy de quarentena</span>
              <span className="bcc-list-item__meta">
                {skillMcpQuarantine.nextSafeAction} - {skillMcpQuarantine.surface.reviewHint}
              </span>
            </div>
          ) : null}
        </div>
      </CommandCenterCard>
    );
  }

  if (sectorId === "nodes") {
    return (
      <CommandCenterCard label="Rede" title={`${viewModel.counts.nodes} companions`}>
        <div className="bcc-list">
          {model.companions.length > 0 ? model.companions.slice(0, 10).map((companion, index) => (
            <div key={`${asText(companion?.id || companion?.name, "companion")}-${index}`} className="bcc-list-item">
              <span className="bcc-list-item__title">
                {asText(companion?.label || companion?.name || companion?.id, "Companion")}
              </span>
              <span className="bcc-list-item__meta">
                {asText(companion?.summary || companion?.status, "Companion sem resumo curto.")}
              </span>
            </div>
          )) : <p className="bcc-empty-note">Nenhum companion monitorado no snapshot atual.</p>}
        </div>
      </CommandCenterCard>
    );
  }

  if (sectorId === "dreams") {
    const memoryWithReceipts = viewModel.memoryWithReceipts;
    const visibleSelfingCards = selfingDashboard?.cards.slice(0, 8) || [];
    const visibleSelfingSuggestions = selfingDashboard?.suggestions.slice(0, 6) || [];
    const visibleArtifactMemoryEntries = artifactMemory?.entries.slice(0, 8) || [];
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <CommandCenterCard
          label="Selfing"
          title={selfingDashboard ? `${selfingDashboard.status} - ${selfingDashboard.summary.cardCount} cards` : "sem dashboard"}
        >
          <div className="bcc-list">
            {selfingDashboard ? (
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">
                  {selfingDashboard.identity.agentName} / {selfingDashboard.identity.userName}
                </span>
                <span className="bcc-list-item__meta">
                  {selfingDashboard.identity.workspaceName} - {selfingDashboard.identity.trustMode} - {selfingDashboard.nextSafeAction}
                </span>
              </div>
            ) : null}
            {visibleSelfingCards.length > 0 ? visibleSelfingCards.map((card) => (
              <div key={card.id} className="bcc-list-item">
                <span className="bcc-list-item__title">{card.section}: {card.title}</span>
                <span className="bcc-list-item__meta">
                  {card.value} - {card.source} - {card.previewRequired ? "preview" : "read-only"}{card.versioned ? " - versionado" : ""}
                </span>
              </div>
            )) : (
              <p className="bcc-empty-note">Selfing aparece quando o runtime publicar identidade/memoria no snapshot.</p>
            )}
            {visibleSelfingSuggestions.length > 0 ? visibleSelfingSuggestions.map((suggestion) => (
              <div key={suggestion.id} className="bcc-list-item">
                <span className="bcc-list-item__title">{suggestion.title}</span>
                <span className="bcc-list-item__meta">{suggestion.detail} - {suggestion.previewCommand}</span>
              </div>
            )) : null}
          </div>
        </CommandCenterCard>

        <CommandCenterCard label="Memoria" title={`${memoryWithReceipts?.summary.receiptCount ?? viewModel.memorySignals.length} receipts reais`}>
          <div className="bcc-list">
            {memoryWithReceipts && memoryWithReceipts.receipts.length > 0 ? memoryWithReceipts.receipts.map((receipt) => (
              <div key={receipt.id} className="bcc-list-item">
                <span className="bcc-list-item__title">{receipt.title}</span>
                <span className="bcc-list-item__meta">
                  {receipt.layer} - {receipt.confidenceLabel} - {receipt.source}: {receipt.summary}
                </span>
              </div>
            )) : viewModel.memorySignals.length > 0 ? viewModel.memorySignals.map((signal) => (
              <div key={signal.id} className="bcc-list-item">
                <span className="bcc-list-item__title">{signal.title}</span>
                <span className="bcc-list-item__meta">{signal.layer} - {signal.summary}</span>
              </div>
            )) : (
              <p className="bcc-empty-note">Nada inventado: sinais de memoria aparecem quando o runtime recuperar contexto.</p>
            )}
            {memoryWithReceipts ? (
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">Origem e correcao</span>
                <span className="bcc-list-item__meta">
                  {memoryWithReceipts.surface.sourceQuestionHint} - {memoryWithReceipts.nextSafeAction}
                </span>
              </div>
            ) : null}
          </div>
        </CommandCenterCard>
        <CommandCenterCard
          label="Artifact Memory"
          title={artifactMemory ? `${artifactMemory.status} - ${artifactMemory.summary.reusableCount} reutilizaveis` : "sem indice"}
        >
          <div className="bcc-list">
            {artifactMemory ? (
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">Busca e reuso</span>
                <span className="bcc-list-item__meta">
                  {artifactMemory.surface.searchHint} - {artifactMemory.nextSafeAction}
                </span>
              </div>
            ) : null}
            {visibleArtifactMemoryEntries.length > 0 ? visibleArtifactMemoryEntries.map((entry) => (
              <div key={entry.id} className="bcc-list-item">
                <span className="bcc-list-item__title">
                  {entry.category}: {entry.title}
                </span>
                <span className="bcc-list-item__meta">
                  {entry.artifactId} - {entry.actions.citeCommand} - {entry.receipt.memoryReceiptId || "memory receipt pendente"}
                </span>
              </div>
            )) : (
              <p className="bcc-empty-note">Artifacts viram memoria navegavel quando o run publica artifactId e receipt.</p>
            )}
          </div>
        </CommandCenterCard>
        {selfingDashboard ? (
          <CommandCenterCard label="Selfing Policy" title={selfingDashboard.policy.readOnlySnapshot ? "read-only" : "revisar"}>
            <RuntimeKeyValueList
              entries={[
                ["sem mutacao", String(selfingDashboard.policy.noIdentityChanged && selfingDashboard.policy.noMemoryChanged)],
                ["preview", String(selfingDashboard.policy.changesRequirePreview)],
                ["versionamento", String(selfingDashboard.policy.changesAreVersioned)],
                ["secrets", String(selfingDashboard.policy.secretsSerialized)],
              ]}
            />
          </CommandCenterCard>
        ) : null}
        {artifactMemory ? (
          <CommandCenterCard label="Artifact Policy" title={artifactMemory.policy.reusedArtifactMustCiteOrigin ? "citacao obrigatoria" : "revisar"}>
            <RuntimeKeyValueList
              entries={[
                ["sem inventar", String(artifactMemory.policy.noArtifactContentInvented)],
                ["sem ler FS", String(artifactMemory.policy.noFilesystemReadPerformed)],
                ["sem mutar artifact", String(artifactMemory.policy.noArtifactMutation)],
                ["promocao explicita", String(artifactMemory.policy.promotionRequiresExplicitAction)],
              ]}
            />
          </CommandCenterCard>
        ) : null}
      </div>
    );
  }

  if (sectorId === "config") {
    const providerArena = viewModel.providerArena;
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <CommandCenterCard label="Modelo atual" title={viewModel.runtime.currentModelLabel}>
          <p>Provider: {viewModel.runtime.currentProviderLabel}</p>
        </CommandCenterCard>
        <CommandCenterCard
          label="Replay Hardening"
          title={runArtifactReceiptReplay ? `${runArtifactReceiptReplay.status} - ${runArtifactReceiptReplay.summary.frameCount} frames` : "Sem replay auditavel"}
        >
          {runArtifactReceiptReplay ? (
            <div className="bcc-list">
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">
                  {runArtifactReceiptReplay.summary.artifactLinkCount} artifact(s), {runArtifactReceiptReplay.summary.featureReceiptCount} feature receipt(s)
                </span>
                <span className="bcc-list-item__meta">
                  {runArtifactReceiptReplay.replay.summary} - {runArtifactReceiptReplay.surface.cliCommand}
                </span>
              </div>
              {visibleReplayFrames.map((frame) => (
                <div key={`replay-hardening:${frame.id}`} className="bcc-list-item">
                  <span className="bcc-list-item__title">
                    #{frame.order} {frame.kind}: {frame.title}
                  </span>
                  <span className="bcc-list-item__meta">
                    {frame.source} - {frame.status} - {frame.receiptId || "sem receipt"}
                  </span>
                </div>
              ))}
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">Policy</span>
                <span className="bcc-list-item__meta">
                  receipts only: {String(runArtifactReceiptReplay.policy.replayUsesReceiptsOnly)} - sem FS: {String(runArtifactReceiptReplay.policy.noFilesystemReadPerformed)}
                </span>
              </div>
            </div>
          ) : (
            <p>Replay Hardening aparece quando o runtime publica frames, receipts e links de artifacts sem reexecutar tools.</p>
          )}
        </CommandCenterCard>
        <CommandCenterCard
          label="Productization Evidence"
          title={productizationEvidence ? `${productizationEvidence.status} - ${productizationEvidence.summary.readyGateCount}/${productizationEvidence.gates.length} gates` : "Sem readiness publicado"}
        >
          {productizationEvidence ? (
            <div className="bcc-list">
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">
                  {productizationEvidence.releaseReadiness.status} / {productizationEvidence.releaseReadiness.channel}
                </span>
                <span className="bcc-list-item__meta">
                  stable: {String(productizationEvidence.summary.stableReleaseAllowed)} - {productizationEvidence.surface.releaseHint}
                </span>
              </div>
              {visibleProductizationGates.map((gate) => (
                <div key={`productization-evidence:${gate.id}`} className="bcc-list-item">
                  <span className="bcc-list-item__title">
                    {gate.status}: {gate.label}
                  </span>
                  <span className="bcc-list-item__meta">
                    {gate.source} - {gate.command}
                  </span>
                </div>
              ))}
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">Policy</span>
                <span className="bcc-list-item__meta">
                  noReleasePublished: {String(productizationEvidence.policy.noReleasePublished)} - noInstallerExecuted: {String(productizationEvidence.policy.noInstallerExecuted)}
                </span>
              </div>
            </div>
          ) : (
            <p>Productization Evidence aparece quando o runtime publica readiness de produto, gates e release policy.</p>
          )}
        </CommandCenterCard>
        <CommandCenterCard
          label="Product Entry Runtime"
          title={productEntryRuntime ? `${productEntryRuntime.status} - ${productEntryRuntime.entry.requestedSurface}` : "Sem estado de entrada"}
        >
          {productEntryRuntime ? (
            <div className="bcc-list">
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">
                  First run: {productEntryRuntime.firstRun.profileConfigured ? "configurado" : "pendente"}
                </span>
                <span className="bcc-list-item__meta">
                  handoff: {String(productEntryRuntime.entry.handoffAllowed)} - {productEntryRuntime.nextSafeAction}
                </span>
              </div>
              {visibleProductEntryGates.map((gate) => (
                <div key={`product-entry:${gate.id}`} className="bcc-list-item">
                  <span className="bcc-list-item__title">
                    {gate.status}: {gate.label}
                  </span>
                  <span className="bcc-list-item__meta">
                    {gate.source} - {gate.command}
                  </span>
                </div>
              ))}
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">Policy</span>
                <span className="bcc-list-item__meta">
                  sem profile write: {String(productEntryRuntime.policy.noProfileWritePerformed)} - sem runtime persistente: {String(productEntryRuntime.policy.noRuntimePersistentStart)}
                </span>
              </div>
            </div>
          ) : (
            <p>Product Entry Runtime aparece quando CLI, dashboard ou API compartilham o mesmo estado de primeiro uso.</p>
          )}
        </CommandCenterCard>
        <CommandCenterCard
          label="Release / Installer / Rollback"
          title={releaseInstallerRollbackPath ? `${releaseInstallerRollbackPath.status} - ${releaseInstallerRollbackPath.release.channel}` : "Sem release path"}
        >
          {releaseInstallerRollbackPath ? (
            <div className="bcc-list">
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">
                  Bundle {releaseInstallerRollbackPath.release.releaseBundleStatus} / installer {releaseInstallerRollbackPath.installer.previewAvailable ? "preview" : "pendente"}
                </span>
                <span className="bcc-list-item__meta">
                  rollback: {String(releaseInstallerRollbackPath.rollback.rollbackAvailable)} - {releaseInstallerRollbackPath.nextSafeAction}
                </span>
              </div>
              {visibleReleasePathGates.map((gate) => (
                <div key={`release-path:${gate.id}`} className="bcc-list-item">
                  <span className="bcc-list-item__title">
                    {gate.status}: {gate.label}
                  </span>
                  <span className="bcc-list-item__meta">
                    {gate.source} - {gate.command}
                  </span>
                </div>
              ))}
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">Policy</span>
                <span className="bcc-list-item__meta">
                  sem release: {String(releaseInstallerRollbackPath.policy.noReleasePublished)} - sem installer: {String(releaseInstallerRollbackPath.policy.noInstallerExecuted)} - sem stable tag: {String(releaseInstallerRollbackPath.policy.noStableTagMoved)}
                </span>
              </div>
            </div>
          ) : (
            <p>Release Path aparece quando o runtime publica bundle, installer dry-run e rollback preview sem executar release real.</p>
          )}
        </CommandCenterCard>
        <CommandCenterCard
          label="Public Site / Docs / Demo Sync"
          title={publicSiteDocsDemoSync ? `${publicSiteDocsDemoSync.status} - ${publicSiteDocsDemoSync.sync.publicRoutes.length} rotas` : "Sem sync publico"}
        >
          {publicSiteDocsDemoSync ? (
            <div className="bcc-list">
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">
                  Site {publicSiteDocsDemoSync.publicSite.status} / docs {publicSiteDocsDemoSync.docs.status} / demo {publicSiteDocsDemoSync.demo.status}
                </span>
                <span className="bcc-list-item__meta">
                  preview: {String(publicSiteDocsDemoSync.readiness.canPublishSitePreview)} - stable: {String(publicSiteDocsDemoSync.readiness.canAnnounceStable)} - {publicSiteDocsDemoSync.nextSafeAction}
                </span>
              </div>
              {visiblePublicSyncGates.map((gate) => (
                <div key={`public-sync:${gate.id}`} className="bcc-list-item">
                  <span className="bcc-list-item__title">
                    {gate.status}: {gate.label}
                  </span>
                  <span className="bcc-list-item__meta">
                    {gate.source} - {gate.command}
                  </span>
                </div>
              ))}
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">Policy publica</span>
                <span className="bcc-list-item__meta">
                  sem build: {String(publicSiteDocsDemoSync.policy.noWebsiteBuildExecuted)} - sem deploy: {String(publicSiteDocsDemoSync.policy.noPublicDeployExecuted)} - sem stable claim: {String(publicSiteDocsDemoSync.policy.noStableClaimPublished)}
                </span>
              </div>
            </div>
          ) : (
            <p>Public sync aparece quando site, docs, examples, demo e release estao alinhados ao release path preview-only.</p>
          )}
        </CommandCenterCard>
        <CommandCenterCard
          label="Feedback / Telemetry Opt-In"
          title={feedbackTelemetryProductLoop ? `${feedbackTelemetryProductLoop.status} - ${feedbackTelemetryProductLoop.gates.length} gates` : "Sem loop de feedback"}
        >
          {feedbackTelemetryProductLoop ? (
            <div className="bcc-list">
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">
                  Feedback {feedbackTelemetryProductLoop.feedback.contractStatus} / preview {String(feedbackTelemetryProductLoop.feedback.previewAvailable)}
                </span>
                <span className="bcc-list-item__meta">
                  opt-in: {String(feedbackTelemetryProductLoop.telemetry.optInRequired)} - telemetry externa: {String(feedbackTelemetryProductLoop.telemetry.externalTelemetryEnabled)} - {feedbackTelemetryProductLoop.nextSafeAction}
                </span>
              </div>
              {visibleFeedbackLoopGates.map((gate) => (
                <div key={`feedback-loop:${gate.id}`} className="bcc-list-item">
                  <span className="bcc-list-item__title">
                    {gate.status}: {gate.label}
                  </span>
                  <span className="bcc-list-item__meta">
                    {gate.source} - {gate.command}
                  </span>
                </div>
              ))}
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">Policy feedback</span>
                <span className="bcc-list-item__meta">
                  sem telemetry: {String(feedbackTelemetryProductLoop.policy.noTelemetryEnabled)} - sem envio: {String(feedbackTelemetryProductLoop.policy.noFeedbackSent)} - revoke/delete: {String(feedbackTelemetryProductLoop.policy.revokeDeleteAvailable)}
                </span>
              </div>
            </div>
          ) : (
            <p>Feedback loop aparece quando public sync, /feedback, preview redigido e ledger local estiverem publicados.</p>
          )}
        </CommandCenterCard>
        <CommandCenterCard
          label="Public Adoption / Pilot Loop"
          title={publicAdoptionPilotLoop ? `${publicAdoptionPilotLoop.status} - ${publicAdoptionPilotLoop.pilot.ledgerEntryCount} pilotos` : "Sem piloto publico"}
        >
          {publicAdoptionPilotLoop ? (
            <div className="bcc-list">
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">
                  Opt-in {String(publicAdoptionPilotLoop.feedbackProductLoop.optInReady)} / dashboard {String(publicAdoptionPilotLoop.readiness.dashboardReady)}
                </span>
                <span className="bcc-list-item__meta">
                  controlled pilot: {String(publicAdoptionPilotLoop.readiness.canStartControlledPilot)} - {publicAdoptionPilotLoop.nextSafeAction}
                </span>
              </div>
              {visiblePilotLoopGates.map((gate) => (
                <div key={`pilot-loop:${gate.id}`} className="bcc-list-item">
                  <span className="bcc-list-item__title">
                    {gate.status}: {gate.label}
                  </span>
                  <span className="bcc-list-item__meta">
                    {gate.source} - {gate.command}
                  </span>
                </div>
              ))}
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">Policy piloto</span>
                <span className="bcc-list-item__meta">
                  sem coleta implicita: {String(publicAdoptionPilotLoop.policy.noImplicitCollection)} - ledger local: {String(publicAdoptionPilotLoop.policy.localLedgerOnly)} - sem payload: {String(publicAdoptionPilotLoop.policy.noWorkspacePayloadStored)}
                </span>
              </div>
            </div>
          ) : (
            <p>Pilot loop aparece quando feedback opt-in, ledger local e dashboard agregado estiverem prontos.</p>
          )}
        </CommandCenterCard>
        <CommandCenterCard
          label="Integration Showcase / Partner Surface"
          title={integrationShowcasePartnerSurface ? `${integrationShowcasePartnerSurface.status} - ${integrationShowcasePartnerSurface.showcase.integrationCount} integracoes` : "Sem showcase de integracoes"}
        >
          {integrationShowcasePartnerSurface ? (
            <div className="bcc-list">
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">
                  Vendors {integrationShowcasePartnerSurface.showcase.vendorCount} / fixtures {integrationShowcasePartnerSurface.showcase.fixtureReadyCount}
                </span>
                <span className="bcc-list-item__meta">
                  partner claim formal: {String(integrationShowcasePartnerSurface.partnerSurface.canClaimFormalPartner)} - {integrationShowcasePartnerSurface.nextSafeAction}
                </span>
              </div>
              {visibleIntegrationShowcaseGates.map((gate) => (
                <div key={`integration-showcase:${gate.id}`} className="bcc-list-item">
                  <span className="bcc-list-item__title">
                    {gate.status}: {gate.label}
                  </span>
                  <span className="bcc-list-item__meta">
                    {gate.source} - {gate.command}
                  </span>
                </div>
              ))}
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">Policy integracoes</span>
                <span className="bcc-list-item__meta">
                  sem credencial no fixture: {String(integrationShowcasePartnerSurface.policy.noCredentialRequiredForFixture)} - sem rede: {String(integrationShowcasePartnerSurface.policy.noNetworkRequiredForFixture)} - auditavel: {String(integrationShowcasePartnerSurface.policy.partnerSurfaceAuditable)}
                </span>
              </div>
            </div>
          ) : (
            <p>Integration showcase aparece quando pilot loop, smoke fixture, capability matrix e partner surface estiverem prontos.</p>
          )}
        </CommandCenterCard>
        <CommandCenterCard
          label="Release & Adoption Readiness"
          title={releaseAdoptionReadiness ? `${releaseAdoptionReadiness.status} - score ${releaseAdoptionReadiness.publicAdoption.readinessScore}` : "Sem readiness de release/adoption"}
        >
          {releaseAdoptionReadiness ? (
            <div className="bcc-list">
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">
                  Release {releaseAdoptionReadiness.releaseTrain.status} / adoption {releaseAdoptionReadiness.publicAdoption.status}
                </span>
                <span className="bcc-list-item__meta">
                  suporte: {String(releaseAdoptionReadiness.readiness.supportLoopReady)} - canary: {String(releaseAdoptionReadiness.readiness.canStartCanary)} - {releaseAdoptionReadiness.nextSafeAction}
                </span>
              </div>
              {visibleReleaseAdoptionGates.map((gate) => (
                <div key={`release-adoption:${gate.id}`} className="bcc-list-item">
                  <span className="bcc-list-item__title">
                    {gate.status}: {gate.label}
                  </span>
                  <span className="bcc-list-item__meta">
                    {gate.source} - {gate.command}
                  </span>
                </div>
              ))}
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">Policy release/adoption</span>
                <span className="bcc-list-item__meta">
                  sem deploy: {String(releaseAdoptionReadiness.policy.noDeployExecuted)} - sem canary: {String(releaseAdoptionReadiness.policy.noCanaryStarted)} - rollback preview: {String(releaseAdoptionReadiness.policy.releaseRequiresRollbackPreview)}
                </span>
              </div>
            </div>
          ) : (
            <p>Release/adoption readiness aparece quando release train, public adoption, suporte e feedback agregado estiverem prontos.</p>
          )}
        </CommandCenterCard>
        <CommandCenterCard
          label="Release Candidate / Pre-Canary"
          title={releaseCandidatePreCanaryGate ? `${releaseCandidatePreCanaryGate.status} - go/no-go ${releaseCandidatePreCanaryGate.goNoGo.decision}` : "Sem gate pre-canary"}
        >
          {releaseCandidatePreCanaryGate ? (
            <div className="bcc-list">
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">
                  Evidence {releaseCandidatePreCanaryGate.evidencePack.passCount}/{releaseCandidatePreCanaryGate.evidencePack.checkCount} / Autopilot {releaseCandidatePreCanaryGate.autopilot.status}
                </span>
                <span className="bcc-list-item__meta">
                  pre-canary: {String(releaseCandidatePreCanaryGate.readiness.canOpenPreCanary)} - canary: {String(releaseCandidatePreCanaryGate.readiness.canStartCanary)} - {releaseCandidatePreCanaryGate.nextSafeAction}
                </span>
              </div>
              {visiblePreCanaryGates.map((gate) => (
                <div key={`pre-canary:${gate.id}`} className="bcc-list-item">
                  <span className="bcc-list-item__title">
                    {gate.status}: {gate.label}
                  </span>
                  <span className="bcc-list-item__meta">
                    {gate.source} - {gate.command}
                  </span>
                </div>
              ))}
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">Policy pre-canary</span>
                <span className="bcc-list-item__meta">
                  sem canary: {String(releaseCandidatePreCanaryGate.policy.noCanaryStarted)} - sem rollout: {String(releaseCandidatePreCanaryGate.policy.noRolloutStarted)} - go/no-go explicito: {String(releaseCandidatePreCanaryGate.policy.goNoGoRequiresExplicitApproval)}
                </span>
              </div>
            </div>
          ) : (
            <p>Pre-canary gate aparece quando evidence pack, ecossistema, Autopilot RC e go/no-go estiverem anexados.</p>
          )}
        </CommandCenterCard>
        <CommandCenterCard
          label="Blueprint Completion"
          title={blueprintCompletionGate ? `${blueprintCompletionGate.status} - ${blueprintCompletionGate.summary.completedGateCount}/${blueprintCompletionGate.summary.requiredGateCount}` : "Sem fechamento final"}
        >
          {blueprintCompletionGate ? (
            <div className="bcc-list">
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">
                  {blueprintCompletionGate.summary.releaseDecision} / {blueprintCompletionGate.summary.releaseChannel}
                </span>
                <span className="bcc-list-item__meta">
                  completo: {String(blueprintCompletionGate.readiness.blueprintComplete)} - safeguards: {String(blueprintCompletionGate.readiness.safeguardsReady)} - {blueprintCompletionGate.nextSafeAction}
                </span>
              </div>
              {visibleBlueprintCompletionGates.map((gate) => (
                <div key={`blueprint:${gate.id}`} className="bcc-list-item">
                  <span className="bcc-list-item__title">
                    {gate.status}: {gate.label}
                  </span>
                  <span className="bcc-list-item__meta">
                    {gate.source} - {gate.command}
                  </span>
                </div>
              ))}
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">Policy final</span>
                <span className="bcc-list-item__meta">
                  sem auto-execute: {String(blueprintCompletionGate.policy.noAutoExecute)} - sem global default: {String(blueprintCompletionGate.policy.noGlobalRolloutByDefault)} - rollback: {String(blueprintCompletionGate.policy.rollbackPathRequired)}
                </span>
              </div>
            </div>
          ) : (
            <p>Blueprint completion aparece quando pre-canary, rollout, execution, canary promotion e release decision estiverem prontos.</p>
          )}
        </CommandCenterCard>
        <CommandCenterCard
          label="UNI / Trust"
          title={universalIntentTrustEnforcement ? `${universalIntentTrustEnforcement.summary.trustLevel} - ${universalIntentTrustEnforcement.summary.trustDecision}` : "Sem enforcement publicado"}
        >
          {universalIntentTrustEnforcement ? (
            <div className="bcc-list">
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">
                  {universalIntentTrustEnforcement.summary.intent} / {universalIntentTrustEnforcement.summary.risk}
                </span>
                <span className="bcc-list-item__meta">
                  {universalIntentTrustEnforcement.summary.posture} - {universalIntentTrustEnforcement.surface.trustHint}
                </span>
              </div>
              {visibleUniversalIntentGates.map((gate) => (
                <div key={`uni-trust:${gate.id}`} className="bcc-list-item">
                  <span className="bcc-list-item__title">
                    {gate.status}: {gate.label}
                  </span>
                  <span className="bcc-list-item__meta">
                    {gate.source} - {gate.detail}
                  </span>
                </div>
              ))}
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">Permissao</span>
                <span className="bcc-list-item__meta">
                  {universalIntentTrustEnforcement.permission.required ? universalIntentTrustEnforcement.permission.prompt : universalIntentTrustEnforcement.surface.permissionHint}
                </span>
              </div>
            </div>
          ) : (
            <p>UNI / Trust aparece quando o runtime publica classificacao, permissao conversacional e Trust Slider no mesmo snapshot.</p>
          )}
        </CommandCenterCard>
        <CommandCenterCard
          label="Provider Arena"
          title={providerArena ? `${providerArena.summary.recommendedProviderLabel}/${providerArena.summary.recommendedModelLabel}` : "Sem arena ativa"}
        >
          {providerArena ? (
            <div className="bcc-list">
              {providerArena.candidates.slice(0, 3).map((candidate) => (
                <div key={candidate.id} className="bcc-list-item">
                  <span className="bcc-list-item__title">
                    {candidate.providerLabel}/{candidate.modelLabel} - score {candidate.overallScore}
                  </span>
                  <span className="bcc-list-item__meta">
                    {candidate.source} - {candidate.readiness} - health {candidate.healthStatus}
                  </span>
                </div>
              ))}
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">Decisao</span>
                <span className="bcc-list-item__meta">
                  {providerArena.summary.decisionSource} - {providerArena.nextSafeAction}
                </span>
              </div>
            </div>
          ) : (
            <p>A arena aparece quando houver Model Picker, rota observada ou receipts de budget/provider.</p>
          )}
        </CommandCenterCard>
        <CommandCenterCard
          label="Provider Mesh"
          title={providerMeshConsolidation ? `${providerMeshConsolidation.status} - ${providerMeshConsolidation.summary.readyRouteCount}/${providerMeshConsolidation.summary.routeCount} rotas` : "Sem mesh canonico"}
        >
          {providerMeshConsolidation ? (
            <div className="bcc-list">
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">
                  {providerMeshConsolidation.selected.providerLabel}/{providerMeshConsolidation.selected.modelLabel}
                </span>
                <span className="bcc-list-item__meta">
                  {providerMeshConsolidation.selected.runtimeFactory.adapterKind} - {providerMeshConsolidation.selected.ready ? "ready" : "pendente"} - {providerMeshConsolidation.surface.pickerHint}
                </span>
              </div>
              {visibleProviderMeshRoutes.map((route) => (
                <div key={`provider-mesh:${route.id}`} className="bcc-list-item">
                  <span className="bcc-list-item__title">
                    {route.label} [{route.routeClass}]
                  </span>
                  <span className="bcc-list-item__meta">
                    {route.readiness} - {route.modelCount} modelo(s) - {route.catalogSource}
                  </span>
                </div>
              ))}
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">P0-extra</span>
                <span className="bcc-list-item__meta">
                  {providerMeshConsolidation.summary.p0ExtraComplete ? "completo" : "parcial"} - {providerMeshConsolidation.onboarding.consumers.join(", ")}
                </span>
              </div>
            </div>
          ) : (
            <p>O Provider Mesh aparece quando o runtime publica catalogo, rotas, picker, selecao e onboarding canonicos.</p>
          )}
        </CommandCenterCard>
        <CommandCenterCard
          label="Ask Before Assumption"
          title={askBeforeAssumptionPolicy ? `${askBeforeAssumptionPolicy.status} - ${askBeforeAssumptionPolicy.summary.questionCount} perguntas` : "Sem perguntas pendentes"}
        >
          {askBeforeAssumptionPolicy ? (
            <div className="bcc-list">
              {visibleAskQuestions.map((question) => (
                <div key={question.id} className="bcc-list-item">
                  <span className="bcc-list-item__title">
                    {question.priority}: {question.question}
                  </span>
                  <span className="bcc-list-item__meta">
                    {question.reason} - {question.blocksMutation ? "bloqueia mutacao" : "nao bloqueia"}
                  </span>
                </div>
              ))}
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">Policy</span>
                <span className="bcc-list-item__meta">
                  {askBeforeAssumptionPolicy.surface.askHint} - {askBeforeAssumptionPolicy.surface.previewHint}
                </span>
              </div>
            </div>
          ) : (
            <p>A policy aparece quando o runtime detecta alvo, permissao, canal ou mutacao assumidos.</p>
          )}
        </CommandCenterCard>
        <CommandCenterCard
          label="Personal Ops Autopilot"
          title={personalOpsAutopilot ? `${personalOpsAutopilot.status} - ${personalOpsAutopilot.summary.approvalRequiredCount} approvals` : "Sem sugestoes"}
        >
          {personalOpsAutopilot ? (
            <div className="bcc-list">
              {personalOpsAutopilot.suggestions.slice(0, 5).map((suggestion) => (
                <div key={suggestion.id} className="bcc-list-item">
                  <span className="bcc-list-item__title">
                    {suggestion.category}: {suggestion.title}
                  </span>
                  <span className="bcc-list-item__meta">
                    {suggestion.cause} - {suggestion.nextStep}
                  </span>
                </div>
              ))}
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">Policy</span>
                <span className="bcc-list-item__meta">
                  {personalOpsAutopilot.surface.previewHint} - {personalOpsAutopilot.surface.approvalHint}
                </span>
              </div>
            </div>
          ) : (
            <p>O autopilot aparece quando o runtime observar provider, budget, capability ou artifact com acao recomendada.</p>
          )}
        </CommandCenterCard>
        <CommandCenterCard
          label="Agent Team Compiler"
          title={agentTeamCompiler ? `${agentTeamCompiler.status} - ${agentTeamCompiler.summary.approvalRequiredCount} approvals` : "Sem team plan"}
        >
          {agentTeamCompiler ? (
            <div className="bcc-list">
              {visibleAgentTeamRoles.map((role) => (
                <div key={role.id} className="bcc-list-item">
                  <span className="bcc-list-item__title">
                    {role.roleId}: {role.label}
                  </span>
                  <span className="bcc-list-item__meta">
                    {role.objective} - {role.actions.previewCommand}
                  </span>
                </div>
              ))}
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">Policy</span>
                <span className="bcc-list-item__meta">
                  {agentTeamCompiler.surface.previewHint} - {agentTeamCompiler.surface.approvalHint}
                </span>
              </div>
            </div>
          ) : (
            <p>O compiler aparece quando houver pedido de swarm, subagentes ou equipe em paralelo.</p>
          )}
        </CommandCenterCard>
        <CommandCenterCard label="Modo" title={model.productModeLabel}>
          <p>ID: {model.productModeId}</p>
        </CommandCenterCard>
        <CommandCenterCard label="Sessao" title={viewModel.runtime.activeSessionId ?? "nao informada"}>
          <p>Estado do websocket: {model.wsStatus}</p>
        </CommandCenterCard>
        <CommandCenterCard label="Seguranca" title="Sem secrets">
          <p>Esta tela nao renderiza chaves ou tokens. Configuracoes sensiveis devem aparecer mascaradas pelo backend.</p>
        </CommandCenterCard>
      </div>
    );
  }

  if (sectorId === "docs") {
    return renderCommandCenterDocsSector();
  }

  if (sectorId === "sales-os") {
    return (
      <CommandCenterSalesOsSector
        salesPackBusinessMode={salesPackBusinessMode}
        nexusWorkbenchRaw={nexusWorkbenchRaw}
      />
    );
  }

  if (sectorId === "cron") {
    return renderCommandCenterCronSector(stateRecord);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <CommandCenterCard label="Runtime" title={viewModel.runtime.status}>
        <p>{viewModel.runtime.summary}</p>
      </CommandCenterCard>
      <CommandCenterCard label="Sessoes" title={String(viewModel.counts.sessions)}>
        <p>Dados reais do plano de sessoes atual.</p>
      </CommandCenterCard>
      <CommandCenterCard label="Artifacts" title={String(viewModel.counts.artifacts)}>
        <p>Artifacts aparecem aqui conforme o runtime produzir entregas.</p>
      </CommandCenterCard>
      <CommandCenterCard label="Memoria" title={String(viewModel.memorySignals.length)}>
        <p>Sem memoria inventada: apenas sinais vindos do runtime.</p>
      </CommandCenterCard>
    </div>
  );
}
