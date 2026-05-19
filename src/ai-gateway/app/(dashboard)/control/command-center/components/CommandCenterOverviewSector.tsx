"use client";

import { useState } from "react";
import type {
  DashboardCommandCenterViewModel,
  DashboardIntelligenceFabricHealthSnapshot,
  DashboardNexusWorkbenchAction,
  DashboardNexusWorkbenchPendingApproval,
  DashboardRunObservatoryDiffPreview,
  DashboardRunObservatoryQuery,
} from "../contracts";
import {
  formatCommandCenterBudgetDetail,
  formatCommandCenterBudgetLabel,
  formatCommandCenterModelRouteDetail,
  formatCommandCenterModelRouteLabel,
  formatCommandCenterRunIdentity,
  formatCommandCenterRunMatchedBy,
  formatCommandCenterRunObservatoryQuery,
  formatCommandCenterRunStatusIndex,
} from "./CommandCenterObservability";
import { CommandCenterBadge, CommandCenterCard } from "./CommandCenterPrimitives";
import { CommandCenterOverviewProductCards } from "./CommandCenterOverviewProductCards";
import { humanAgentStatus, humanRuntimeStatus, runtimeTone } from "./CommandCenterControlShellHelpers";
import type { CommandCenterSalesPackBusinessController } from "./useCommandCenterSalesPackBusinessMode";

export function CommandCenterOverviewSector({
  viewModel,
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
}: {
  viewModel: DashboardCommandCenterViewModel;
  observatoryQuery: DashboardRunObservatoryQuery;
  onRunObservatoryQueryChange: (query: DashboardRunObservatoryQuery) => void;
  onApplyDiffPreview: (preview: DashboardRunObservatoryDiffPreview) => Promise<void>;
  onDemoteIntelligenceFabric: (health: DashboardIntelligenceFabricHealthSnapshot) => Promise<void>;
  nexusWorkbenchActionId: string | null;
  nexusWorkbenchMessage: string | null;
  onResolveNexusApproval: (approval: DashboardNexusWorkbenchPendingApproval, approved: boolean) => Promise<void>;
  onRunNexusWorkbenchAction: (action: DashboardNexusWorkbenchAction) => Promise<void>;
  onInspectNexusCapabilities: () => Promise<void>;
  salesPackBusinessMode: CommandCenterSalesPackBusinessController;
}) {
  const [applyingDiffPreviewId, setApplyingDiffPreviewId] = useState<string | null>(null);
  const [diffPreviewActionMessage, setDiffPreviewActionMessage] = useState<string | null>(null);
  const [demotingFabric, setDemotingFabric] = useState(false);
  const [fabricDemoteMessage, setFabricDemoteMessage] = useState<string | null>(null);
  const run = viewModel.agentRun;
  const naturalFirst = viewModel.naturalFirstRuntime;
  const visibleNaturalFirstStages = naturalFirst?.stages.slice(0, 4) || [];
  const visibleNaturalFirstPolicyPills = naturalFirst ? buildNaturalFirstPolicyPills(naturalFirst) : [];
  const visibleChecks = viewModel.health.checks.slice(0, 5);
  const visibleTasks = viewModel.tasks.slice(0, 5);
  const visibleTools = viewModel.toolExposure.tools.slice(0, 5);
  const discovery = viewModel.capabilityDiscovery;
  const preview = viewModel.universalPreviewMode;
  const negotiation = viewModel.capabilityNegotiation;
  const rehearsal = viewModel.toolRehearsal;
  const safetyNarrative = viewModel.safetyNarrative;
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
  const nexusWorkbench = viewModel.nexusWorkbench;
  const publicSiteDocsDemoSync = viewModel.publicSiteDocsDemoSync;
  const feedbackTelemetryProductLoop = viewModel.feedbackTelemetryProductLoop;
  const publicAdoptionPilotLoop = viewModel.publicAdoptionPilotLoop;
  const integrationShowcasePartnerSurface = viewModel.integrationShowcasePartnerSurface;
  const releaseAdoptionReadiness = viewModel.releaseAdoptionReadiness;
  const releaseCandidatePreCanaryGate = viewModel.releaseCandidatePreCanaryGate;
  const blueprintCompletionGate = viewModel.blueprintCompletionGate;
  const subagentAutoInvocation = viewModel.subagentAutoInvocation;
  const visibleDiscoveryRecommendations = discovery?.recommendations.slice(0, 4) || [];
  const visiblePreviewSteps = preview?.planSteps.slice(0, 4) || [];
  const visibleNegotiatedCapabilities = negotiation?.capabilities.slice(0, 4) || [];
  const visibleRehearsalCalls = rehearsal?.calls.slice(0, 4) || [];
  const visibleSafetyReasons = safetyNarrative?.reasons.slice(0, 4) || [];
  const visibleSelfingSuggestions = selfingDashboard?.suggestions.slice(0, 3) || [];
  const visibleArtifactMemoryEntries = artifactMemory?.entries.slice(0, 3) || [];
  const visiblePersonalOpsSuggestions = personalOpsAutopilot?.suggestions.slice(0, 3) || [];
  const visibleAgentTeamRoles = agentTeamCompiler?.roles.slice(0, 3) || [];
  const visibleContinuityChannels = crossChannelContinuity?.channels.slice(0, 4) || [];
  const visibleAskQuestions = askBeforeAssumptionPolicy?.questions.slice(0, 4) || [];
  const visibleProviderMeshRoutes = providerMeshConsolidation?.routes.slice(0, 4) || [];
  const visibleUniversalIntentGates = universalIntentTrustEnforcement?.gates.slice(0, 4) || [];
  const visibleReplayFrames = runArtifactReceiptReplay?.frames.slice(0, 4) || [];
  const visibleProductizationGates = productizationEvidence?.gates.slice(0, 4) || [];
  const visibleProductEntryGates = productEntryRuntime?.gates.slice(0, 4) || [];
  const visibleReleasePathGates = releaseInstallerRollbackPath?.gates.slice(0, 4) || [];
  const visiblePublicSyncGates = publicSiteDocsDemoSync?.gates.slice(0, 4) || [];
  const visibleFeedbackLoopGates = feedbackTelemetryProductLoop?.gates.slice(0, 4) || [];
  const visiblePilotLoopGates = publicAdoptionPilotLoop?.gates.slice(0, 4) || [];
  const visibleIntegrationShowcaseGates = integrationShowcasePartnerSurface?.gates.slice(0, 4) || [];
  const visibleReleaseAdoptionGates = releaseAdoptionReadiness?.gates.slice(0, 4) || [];
  const visiblePreCanaryGates = releaseCandidatePreCanaryGate?.gates.slice(0, 4) || [];
  const visibleBlueprintCompletionGates = blueprintCompletionGate?.gates.slice(0, 4) || [];
  const visibleSubagentAutoRoles = subagentAutoInvocation?.roles.slice(0, 4) || [];
  const visibleSubagentAutoTriggers = subagentAutoInvocation?.triggers.slice(0, 3) || [];
  const visibleSubagentAutoRisks = subagentAutoInvocation?.riskSignals.slice(0, 3) || [];
  const visibleObservedRuns = viewModel.runObservatory.runs.slice(0, 5);
  const visibleDiffPreviews = viewModel.runObservatory.diffPreviews?.slice(0, 3) || [];
  const visibleNexusActions = nexusWorkbench?.actions.slice(0, 3) || [];
  const visibleNexusApprovals = nexusWorkbench?.approvals.pending.slice(0, 2) || [];
  const visibleNexusExecutions = nexusWorkbench?.execution.recent.slice(0, 2) || [];
  const visibleProvisionedEdges = nexusWorkbench?.capabilities.provisionedEdges.slice(0, 3) || [];
  const salesPackSnapshot = salesPackBusinessMode.snapshot;
  const visibleBusinessInbox = salesPackSnapshot?.sourceSnapshots.inbox.slice(0, 3) || [];
  const visibleBusinessActions = salesPackSnapshot?.actions.slice(0, 3) || [];
  const fabricHealth = viewModel.runObservatory.intelligenceFabricHealth;
  const visibleFabricHealthFindings = fabricHealth?.findings.slice(0, 3) || [];
  const llmTelemetry = viewModel.runObservatory.llmTelemetry;
  const visibleLlmProviders = llmTelemetry?.providers.slice(0, 3) || [];
  const visibleLlmAttempts = llmTelemetry?.recentAttempts.slice(0, 3) || [];
  const activeStatus = Array.isArray(observatoryQuery.status)
    ? observatoryQuery.status[0]
    : observatoryQuery.status || null;
  const handleApplyDiffPreview = async (preview: DashboardRunObservatoryDiffPreview) => {
    setApplyingDiffPreviewId(preview.id);
    setDiffPreviewActionMessage(null);
    try {
      await onApplyDiffPreview(preview);
      setDiffPreviewActionMessage(`Aplicacao solicitada para ${preview.planId || preview.id}.`);
    } catch (error: any) {
      setDiffPreviewActionMessage(error?.message || "Falha ao aplicar rascunho.");
    } finally {
      setApplyingDiffPreviewId(null);
    }
  };
  const handleDemoteIntelligenceFabric = async () => {
    if (!fabricHealth) {
      return;
    }
    setDemotingFabric(true);
    setFabricDemoteMessage(null);
    try {
      await onDemoteIntelligenceFabric(fabricHealth);
      setFabricDemoteMessage("Demote controlado solicitado. Rollback continua disponivel no Observatory.");
    } catch (error: any) {
      setFabricDemoteMessage(error?.message || "Falha ao aplicar demote controlado do Fabric.");
    } finally {
      setDemotingFabric(false);
    }
  };

  return (
    <div className="bcc-overview-stack">
      <section className="bcc-overview-hero" data-status={viewModel.runtime.status}>
        <div>
          <span className="bcc-card__label">Cockpit</span>
          <h2>{run?.title ?? "Sem run ativa"}</h2>
          <p>{run?.summary ?? viewModel.runtime.summary}</p>
        </div>
        <div className="bcc-overview-hero__rail">
          <CommandCenterBadge tone={runtimeTone(viewModel.runtime.status)}>
            {humanRuntimeStatus(viewModel.runtime.status)}
          </CommandCenterBadge>
          <CommandCenterBadge>{viewModel.adapterSource.label}</CommandCenterBadge>
        </div>
      </section>

      {naturalFirst ? (
        <section className="bcc-natural-first-runtime" data-tone={naturalFirst.tone} aria-label="Natural First Runtime">
          <div className="bcc-natural-first-runtime__summary">
            <span className="bcc-card__label">Natural First</span>
            <h3>{naturalFirst.headline}</h3>
            <p>{naturalFirst.detail}</p>
            <div className="bcc-natural-first-runtime__meta">
              <CommandCenterBadge tone={runtimeTone(naturalFirst.tone)}>
                {naturalFirst.routeLabel}
              </CommandCenterBadge>
              <CommandCenterBadge tone={naturalFirst.risk.requiresApproval ? "warn" : "ok"}>
                {humanNaturalFirstStatus(naturalFirst.status)}
              </CommandCenterBadge>
              <span>{naturalFirst.channel}</span>
              <span>{naturalFirst.costTier}</span>
              <span>{naturalFirst.usesLlm}</span>
            </div>
          </div>
          <div className="bcc-natural-first-runtime__flow">
            {visibleNaturalFirstStages.map((stage) => (
              <div key={stage.id} className="bcc-natural-first-runtime__stage" data-status={stage.status}>
                <span>{stage.label}</span>
                <small>{stage.detail}</small>
              </div>
            ))}
          </div>
          <div className="bcc-natural-first-runtime__policy" aria-label="Politicas Natural First">
            {visibleNaturalFirstPolicyPills.map((pill) => (
              <span key={pill.id} data-active={pill.active}>
                {pill.label}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <div className="bcc-state-grid">
        <CommandCenterStateCard
          label="Approval"
          value={viewModel.counts.approvals > 0 ? `${viewModel.counts.approvals} pendente` : "limpo"}
          detail={safetyNarrative?.nextSafeAction ?? viewModel.approvals[0]?.reason ?? "Nenhuma acao sensivel aguardando confirmacao."}
          tone={viewModel.counts.approvals > 0 ? "warn" : "ok"}
        />
        <CommandCenterStateCard
          label="Artifact"
          value={viewModel.counts.artifacts > 0 ? `${viewModel.counts.artifacts} pronto` : "nenhum"}
          detail={viewModel.artifacts[0]?.title ?? "As entregas aparecem aqui quando ficarem prontas."}
          tone={viewModel.counts.artifacts > 0 ? "info" : "ok"}
        />
        <CommandCenterStateCard
          label="Budget"
          value={formatCommandCenterBudgetLabel(viewModel.budget)}
          detail={formatCommandCenterBudgetDetail(viewModel.budget)}
          tone={viewModel.budget.status === "exceeded" ? "danger" : viewModel.budget.status === "attention" ? "warn" : "ok"}
        />
        <CommandCenterStateCard
          label="Rota"
          value={formatCommandCenterModelRouteLabel(viewModel.modelProfile)}
          detail={formatCommandCenterModelRouteDetail(viewModel.modelProfile)}
          tone={viewModel.modelProfile.readiness === "blocked" ? "danger" : viewModel.modelProfile.ready === false ? "warn" : "info"}
        />
        <CommandCenterStateCard
          label="Nexus"
          value={nexusWorkbench ? humanNexusWorkbenchStatus(nexusWorkbench.status) : "carregando"}
          detail={nexusWorkbench?.headline ?? "Workbench operacional aparece assim que a superficie responder."}
          tone={nexusWorkbench ? nexusWorkbenchTone(nexusWorkbench.status) : "ok"}
        />
        <CommandCenterStateCard
          label="Fabric"
          value={fabricHealth ? fabricHealth.status : "sem health"}
          detail={fabricHealth
            ? `${fabricHealth.recommendation} - fallback ${formatPercent(fabricHealth.summary.fallbackRate)} - p95 ${fabricHealth.summary.p95LatencyMs}ms`
            : "Health pos-default aparece quando o Run Observatory publicar runs com Fabric."}
          tone={fabricHealth?.status === "degraded" ? "danger" : fabricHealth?.status === "attention" ? "warn" : fabricHealth ? "info" : "ok"}
        />
        <CommandCenterStateCard
          label="Replay"
          value={viewModel.replay.status}
          detail={viewModel.replay.summary}
          tone={viewModel.replay.status === "available" ? "info" : "ok"}
        />
        <CommandCenterStateCard
          label="Replay Hardening"
          value={runArtifactReceiptReplay ? `${runArtifactReceiptReplay.summary.frameCount} frames` : "sem replay"}
          detail={runArtifactReceiptReplay?.nextSafeAction ?? "Replay auditavel aparece quando houver receipts e artifacts."}
          tone={runArtifactReceiptReplay?.status === "blocked" ? "danger" : runArtifactReceiptReplay?.status === "partial" ? "warn" : runArtifactReceiptReplay ? "info" : "ok"}
        />
        <CommandCenterStateCard
          label="Product Evidence"
          value={productizationEvidence ? `${productizationEvidence.summary.readyGateCount}/${productizationEvidence.gates.length} gates` : "sem evidencia"}
          detail={productizationEvidence?.nextSafeAction ?? "Release readiness aparece quando o runtime publica evidencia de produto."}
          tone={productizationEvidence?.status === "blocked" ? "danger" : productizationEvidence?.status === "partial" ? "warn" : productizationEvidence ? "info" : "ok"}
        />
        <CommandCenterStateCard
          label="Product Entry"
          value={productEntryRuntime?.status ?? "sem entrada"}
          detail={productEntryRuntime?.nextSafeAction ?? "Primeiro uso compartilhado aparece quando o Product Entry Runtime publicar estado."}
          tone={productEntryRuntime?.status === "blocked_by_policy" ? "danger" : productEntryRuntime?.status === "handoff_to_agent_runtime" ? "info" : productEntryRuntime ? "warn" : "ok"}
        />
        <CommandCenterStateCard
          label="Release Path"
          value={releaseInstallerRollbackPath?.status ?? "sem path"}
          detail={releaseInstallerRollbackPath?.nextSafeAction ?? "Release, installer e rollback aparecem quando a Channel mesh8 publicar o snapshot."}
          tone={releaseInstallerRollbackPath?.status === "blocked" ? "danger" : releaseInstallerRollbackPath?.status?.startsWith("needs-") ? "warn" : releaseInstallerRollbackPath ? "info" : "ok"}
        />
        <CommandCenterStateCard
          label="Public Sync"
          value={publicSiteDocsDemoSync?.status ?? "sem sync"}
          detail={publicSiteDocsDemoSync?.nextSafeAction ?? "Site/docs/demo aparecem quando a Channel mesh9 publicar o snapshot."}
          tone={publicSiteDocsDemoSync?.status === "blocked" || publicSiteDocsDemoSync?.status === "stable-claim-blocked" ? "danger" : publicSiteDocsDemoSync?.status?.startsWith("needs-") ? "warn" : publicSiteDocsDemoSync ? "info" : "ok"}
        />
        <CommandCenterStateCard
          label="Feedback Loop"
          value={feedbackTelemetryProductLoop?.status ?? "sem loop"}
          detail={feedbackTelemetryProductLoop?.nextSafeAction ?? "Feedback opt-in aparece quando a Feedback Telemetry publicar o snapshot."}
          tone={feedbackTelemetryProductLoop?.status === "blocked" ? "danger" : feedbackTelemetryProductLoop?.status?.startsWith("needs-") ? "warn" : feedbackTelemetryProductLoop ? "info" : "ok"}
        />
        <CommandCenterStateCard
          label="Pilot Loop"
          value={publicAdoptionPilotLoop?.status ?? "sem piloto"}
          detail={publicAdoptionPilotLoop?.nextSafeAction ?? "Piloto publico aparece quando a Public Adoption Pilot publicar o snapshot."}
          tone={publicAdoptionPilotLoop?.status === "blocked" ? "danger" : publicAdoptionPilotLoop?.status?.startsWith("needs-") ? "warn" : publicAdoptionPilotLoop ? "info" : "ok"}
        />
        <CommandCenterStateCard
          label="Integration Showcase"
          value={integrationShowcasePartnerSurface?.status ?? "sem showcase"}
          detail={integrationShowcasePartnerSurface?.nextSafeAction ?? "Showcase de integracoes aparece quando a Integration Showcase publicar o snapshot."}
          tone={integrationShowcasePartnerSurface?.status === "blocked" || integrationShowcasePartnerSurface?.status === "partner-claim-blocked" ? "danger" : integrationShowcasePartnerSurface?.status?.startsWith("needs-") ? "warn" : integrationShowcasePartnerSurface ? "info" : "ok"}
        />
        <CommandCenterStateCard
          label="Release Adoption"
          value={releaseAdoptionReadiness?.status ?? "sem readiness"}
          detail={releaseAdoptionReadiness?.nextSafeAction ?? "Release/adoption aparece quando a Release Adoption Readiness publicar o snapshot."}
          tone={releaseAdoptionReadiness?.status === "blocked" ? "danger" : releaseAdoptionReadiness?.status?.startsWith("needs-") ? "warn" : releaseAdoptionReadiness ? "info" : "ok"}
        />
        <CommandCenterStateCard
          label="Pre-Canary"
          value={releaseCandidatePreCanaryGate?.status ?? "sem gate"}
          detail={releaseCandidatePreCanaryGate?.nextSafeAction ?? "Release candidate/pre-canary aparece quando a Pre-Canary Gate publicar o snapshot."}
          tone={releaseCandidatePreCanaryGate?.status === "blocked" ? "danger" : releaseCandidatePreCanaryGate?.status?.startsWith("needs-") ? "warn" : releaseCandidatePreCanaryGate ? "info" : "ok"}
        />
        <CommandCenterStateCard
          label="Blueprint"
          value={blueprintCompletionGate?.status ?? "em fechamento"}
          detail={blueprintCompletionGate?.nextSafeAction ?? "Blueprint completion aparece quando o gate final publicar o snapshot."}
          tone={blueprintCompletionGate?.status === "blocked" ? "danger" : blueprintCompletionGate?.status?.startsWith("needs-") ? "warn" : blueprintCompletionGate ? "info" : "ok"}
        />
        <CommandCenterStateCard
          label="Selfing"
          value={selfingDashboard?.status ?? "sem snapshot"}
          detail={selfingDashboard?.nextSafeAction ?? "Identidade e memoria aparecem quando houver run ativa."}
          tone={selfingDashboard?.status === "blocked" ? "danger" : selfingDashboard?.status === "needs-review" ? "warn" : selfingDashboard ? "info" : "ok"}
        />
        <CommandCenterStateCard
          label="Artifact Memory"
          value={artifactMemory ? `${artifactMemory.summary.memoryEntryCount} entradas` : "sem indice"}
          detail={artifactMemory?.nextSafeAction ?? "Artifacts reutilizaveis aparecem quando houver origem citavel."}
          tone={artifactMemory?.status === "blocked" ? "danger" : artifactMemory?.status === "needs-index" ? "warn" : artifactMemory ? "info" : "ok"}
        />
        <CommandCenterStateCard
          label="Ops Autopilot"
          value={personalOpsAutopilot ? `${personalOpsAutopilot.summary.suggestionCount} sugestoes` : "idle"}
          detail={personalOpsAutopilot?.nextSafeAction ?? "Autopilot publica sugestoes quando observar risco operacional."}
          tone={personalOpsAutopilot?.status === "blocked" ? "danger" : personalOpsAutopilot?.status === "waiting-approval" ? "warn" : personalOpsAutopilot?.status === "suggesting" ? "info" : "ok"}
        />
        <CommandCenterStateCard
          label="Agent Team"
          value={agentTeamCompiler ? `${agentTeamCompiler.summary.roleCount} roles` : "idle"}
          detail={agentTeamCompiler?.nextSafeAction ?? "Compiler aparece quando houver pedido de equipe/subagentes."}
          tone={agentTeamCompiler?.status === "blocked" ? "danger" : agentTeamCompiler?.status === "waiting-approval" ? "warn" : agentTeamCompiler?.status === "compiled" ? "info" : "ok"}
        />
        <CommandCenterStateCard
          label="Auto Subagents"
          value={subagentAutoInvocation ? humanSubagentAutoStatus(subagentAutoInvocation.status) : "sem decisao"}
          detail={subagentAutoInvocation
            ? `${subagentAutoInvocation.selectedBy} - ${subagentAutoInvocation.roles.length} role(s) - ${Math.round(subagentAutoInvocation.confidence * 100)}%`
            : "A decisao automatica aparece quando o runtime escolhe subagentes."}
          tone={subagentAutoInvocation ? subagentAutoTone(subagentAutoInvocation.status) : "ok"}
        />
        <CommandCenterStateCard
          label="Continuity"
          value={crossChannelContinuity ? `${crossChannelContinuity.summary.channelCount} canais` : "single"}
          detail={crossChannelContinuity?.nextSafeAction ?? "Continuidade usa o canal atual quando nao ha handoff."}
          tone={crossChannelContinuity?.status === "blocked" ? "danger" : crossChannelContinuity?.status === "handoff-ready" ? "warn" : crossChannelContinuity?.status === "bridged" ? "info" : "ok"}
        />
        <CommandCenterStateCard
          label="Ask Policy"
          value={askBeforeAssumptionPolicy ? `${askBeforeAssumptionPolicy.summary.questionCount} perguntas` : "clear"}
          detail={askBeforeAssumptionPolicy?.nextSafeAction ?? "Nenhuma assuncao pendente publicada."}
          tone={askBeforeAssumptionPolicy?.status === "blocked" ? "danger" : askBeforeAssumptionPolicy?.status === "needs-question" ? "warn" : askBeforeAssumptionPolicy ? "info" : "ok"}
        />
        <CommandCenterStateCard
          label="UNI / Trust"
          value={universalIntentTrustEnforcement ? universalIntentTrustEnforcement.summary.trustLevel : "sem snapshot"}
          detail={universalIntentTrustEnforcement?.nextSafeAction ?? "UNI e Trust Slider aparecem quando houver run ativa."}
          tone={universalIntentTrustEnforcement?.status === "blocked" ? "danger" : universalIntentTrustEnforcement?.status === "requires-permission" || universalIntentTrustEnforcement?.status === "requires-clarification" ? "warn" : universalIntentTrustEnforcement ? "info" : "ok"}
        />
        <CommandCenterStateCard
          label="Provider Mesh"
          value={providerMeshConsolidation ? `${providerMeshConsolidation.summary.readyRouteCount}/${providerMeshConsolidation.summary.routeCount} rotas` : "sem mesh"}
          detail={providerMeshConsolidation?.nextSafeAction ?? "Model Picker aparece quando houver snapshot de provider mesh."}
          tone={providerMeshConsolidation?.status === "blocked" ? "danger" : providerMeshConsolidation?.status === "partial" ? "warn" : providerMeshConsolidation ? "info" : "ok"}
        />
        <CommandCenterStateCard
          label={preview?.mode === "preview-only" ? "Preview" : "Observatory"}
          value={preview?.mode === "preview-only" ? preview.risk.highestRisk : `${viewModel.runObservatory.matchedRuns}/${viewModel.runObservatory.totalRuns}`}
          detail={preview?.nextSafeAction ?? formatCommandCenterRunObservatoryQuery(viewModel.runObservatory)}
          tone={preview?.mode === "preview-only" ? "info" : viewModel.runObservatory.matchedRuns > 0 ? "info" : "ok"}
        />
      </div>

      <div className="bcc-overview-columns">
        <CommandCenterCard
          label="Nexus Workbench"
          title={nexusWorkbench ? nexusWorkbench.headline : "Carregando operacao Nexus/Echo"}
        >
          {nexusWorkbench ? (
            <div className="bcc-list">
              <div className="bcc-list-item" data-active={nexusWorkbench.operatorExperience.tone !== "ok" ? "true" : "false"}>
                <span className="bcc-list-item__title">
                  {nexusWorkbench.operatorExperience.statusLabel}
                </span>
                <span className="bcc-list-item__meta">
                  {nexusWorkbench.operatorExperience.primaryMessage}
                </span>
                <span className="bcc-list-item__meta">
                  Proximo: {nexusWorkbench.operatorExperience.nextStep}
                </span>
                <span className="bcc-inline-actions">
                  {nexusWorkbench.operatorExperience.cards.slice(0, 4).map((card) => (
                    <span key={card.id} className="bcc-tool-chip" title={card.detail} data-risk={card.tone === "ok" ? "safe" : "attention"}>
                      {card.label}: {card.value}
                    </span>
                  ))}
                </span>
              </div>
              <div className="bcc-list-item" data-active={nexusWorkbench.status === "ready" ? "true" : "false"}>
                <span className="bcc-list-item__title">
                  {nexusWorkbench.runtime.primaryLabel}
                </span>
                <span className="bcc-list-item__meta">
                  fallback Echo {nexusWorkbench.runtime.echoFallbackAvailable ? "pronto" : "indisponivel"} - {nexusWorkbench.capabilities.totalTools} ferramenta(s)
                </span>
                <span className="bcc-list-item__meta">
                  Proximo passo: {nexusWorkbench.capabilities.nextAction}
                </span>
              </div>
              <div className="bcc-list-item" data-active={nexusWorkbench.approvals.pendingCount > 0 ? "true" : "false"}>
                <span className="bcc-list-item__title">
                  {nexusWorkbench.approvals.pendingCount > 0
                    ? `${nexusWorkbench.approvals.pendingCount} confirmacao(oes) aguardando`
                    : "Sem confirmacoes pendentes"}
                </span>
                {visibleNexusApprovals.length > 0 ? visibleNexusApprovals.map((approval) => (
                  <span key={approval.id} className="bcc-list-item__meta">
                    {approval.action}: {approval.reason}
                    <span className="bcc-inline-actions">
                      <button
                        type="button"
                        className="bcc-link-button"
                        disabled={nexusWorkbenchActionId === `${approval.id}:approve`}
                        onClick={() => {
                          void onResolveNexusApproval(approval, true);
                        }}
                      >
                        {nexusWorkbenchActionId === `${approval.id}:approve` ? "Aprovando..." : "Aprovar"}
                      </button>
                      <button
                        type="button"
                        className="bcc-link-button"
                        disabled={nexusWorkbenchActionId === `${approval.id}:reject`}
                        onClick={() => {
                          void onResolveNexusApproval(approval, false);
                        }}
                      >
                        {nexusWorkbenchActionId === `${approval.id}:reject` ? "Negando..." : "Negar"}
                      </button>
                    </span>
                  </span>
                )) : (
                  <span className="bcc-list-item__meta">
                    Acoes sensiveis continuam passando pela confirmacao normal.
                  </span>
                )}
              </div>
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">
                  Echo {nexusWorkbench.echoExperience.online ? "online" : "em observacao"}
                </span>
                <span className="bcc-list-item__meta">
                  {nexusWorkbench.echoExperience.providerName}/{nexusWorkbench.echoExperience.model}
                  {nexusWorkbench.echoExperience.latencyMs !== undefined
                    ? ` - ${nexusWorkbench.echoExperience.latencyMs}ms`
                    : ""}
                </span>
                <span className="bcc-list-item__meta">
                  voz {nexusWorkbench.echoExperience.voiceRequests} pedido(s) - historico {nexusWorkbench.execution.recentCount}
                </span>
              </div>
              {visibleProvisionedEdges.length > 0 ? (
                <div className="bcc-list-item">
                  <span className="bcc-list-item__title">Bordas provisionadas</span>
                  {visibleProvisionedEdges.map((edge) => (
                    <span key={edge.id} className="bcc-list-item__meta">
                      {edge.label}: {edge.readiness?.status ?? edge.publicStatus} - {edge.readiness?.nextAction ?? edge.nextStep}
                    </span>
                  ))}
                </div>
              ) : null}
              {visibleNexusExecutions.length > 0 ? (
                <div className="bcc-list-item">
                  <span className="bcc-list-item__title">Ultimas execucoes</span>
                  {visibleNexusExecutions.map((execution) => (
                    <span key={execution.id} className="bcc-list-item__meta">
                      {execution.status}: {execution.prompt}
                    </span>
                  ))}
                </div>
              ) : null}
              {visibleNexusActions.length > 0 ? (
                <div className="bcc-list-item">
                  <span className="bcc-list-item__title">Acoes disponiveis</span>
                  {visibleNexusActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      className="bcc-list-item text-left"
                      disabled={nexusWorkbenchActionId === action.id}
                      onClick={() => {
                        void onRunNexusWorkbenchAction(action);
                      }}
                    >
                      <span className="bcc-list-item__title">
                        {nexusWorkbenchActionId === action.id ? `${action.label}...` : action.label}
                      </span>
                      <span className="bcc-list-item__meta">
                        {action.description} - {action.method} {action.route}
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="bcc-list-item text-left"
                    disabled={nexusWorkbenchActionId === "capability-readiness"}
                    onClick={() => {
                      void onInspectNexusCapabilities();
                    }}
                  >
                    <span className="bcc-list-item__title">
                      {nexusWorkbenchActionId === "capability-readiness" ? "Abrindo readiness..." : "Abrir readiness completo"}
                    </span>
                    <span className="bcc-list-item__meta">
                      Carrega capacidades oficiais sem instalar, ativar ou usar segredo.
                    </span>
                  </button>
                  {nexusWorkbenchMessage ? (
                    <span className="bcc-list-item__meta">{nexusWorkbenchMessage}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="bcc-empty-note">O Command Center vai mostrar o Workbench assim que a API responder.</p>
          )}
        </CommandCenterCard>

        <CommandCenterCard
          label="Modo Business"
          title={salesPackBusinessMode.effectiveEnabled
            ? "Atendimento e vendas governados"
            : "Atendimento comercial fica oculto por padrao"}
        >
          {salesPackBusinessMode.effectiveEnabled && salesPackSnapshot ? (
            <div className="bcc-list">
              <div className="bcc-list-item" data-active={salesPackSnapshot.summary.posture === "healthy" ? "true" : "false"}>
                <span className="bcc-list-item__title">
                  {salesPackSnapshot.summary.conversations} atendimento(s), {salesPackSnapshot.summary.leads} cliente(s)
                </span>
                <span className="bcc-list-item__meta">
                  {salesPackSnapshot.summary.pendingApprovals > 0
                    ? `${salesPackSnapshot.summary.pendingApprovals} confirmacao(oes) aguardando voce.`
                    : "Sem confirmacoes comerciais pendentes."}
                </span>
                <span className="bcc-list-item__meta">
                  Proximo passo: {salesPackSnapshot.narrative.nextAction}
                </span>
              </div>
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">
                  Canal {salesPackSnapshot.sourceSnapshots.channelHealth.configured ? "pronto" : "precisa configurar"}
                </span>
                <span className="bcc-list-item__meta">
                  {salesPackSnapshot.sourceSnapshots.channelHealth.platform} em modo {salesPackSnapshot.sourceSnapshots.channelHealth.mode}; nenhum envio externo e feito pela demo local.
                </span>
              </div>
              {visibleBusinessInbox.length > 0 ? (
                <div className="bcc-list-item">
                  <span className="bcc-list-item__title">Ultimos atendimentos</span>
                  {visibleBusinessInbox.map((entry) => (
                    <span key={entry.id} className="bcc-list-item__meta">
                      Cliente {entry.customerId}: {entry.status} - {entry.lastIntent}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="bcc-empty-note">Nenhum atendimento comercial registrado ainda.</p>
              )}
              {visibleBusinessActions.length > 0 ? (
                <div className="bcc-list-item">
                  <span className="bcc-list-item__title">Sugestoes seguras</span>
                  {visibleBusinessActions.map((action) => (
                    <span key={action.id} className="bcc-list-item__meta">
                      {action.label}: {action.reason}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="bcc-inline-actions">
                <button
                  type="button"
                  className="bcc-link-button"
                  disabled={salesPackBusinessMode.loading}
                  onClick={() => {
                    void salesPackBusinessMode.refresh();
                  }}
                >
                  {salesPackBusinessMode.loading ? "Atualizando..." : "Atualizar"}
                </button>
                <button
                  type="button"
                  className="bcc-link-button"
                  disabled={salesPackBusinessMode.busyActionId === "sales-pack-demo"}
                  onClick={() => {
                    void salesPackBusinessMode.seedDemo();
                  }}
                >
                  {salesPackBusinessMode.busyActionId === "sales-pack-demo" ? "Criando..." : "Criar exemplo local"}
                </button>
                <button
                  type="button"
                  className="bcc-link-button"
                  onClick={salesPackBusinessMode.disable}
                >
                  Ocultar
                </button>
              </div>
              {salesPackBusinessMode.message ? (
                <span className="bcc-list-item__meta">{salesPackBusinessMode.message}</span>
              ) : null}
            </div>
          ) : (
            <div className="bcc-list">
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">
                  Assistente local primeiro; negocio quando voce quiser
                </span>
                <span className="bcc-list-item__meta">
                  O painel comercial nao aparece para uso domestico comum. Ative quando quiser atender clientes, preparar canais ou testar um fluxo de vendas local.
                </span>
              </div>
              <div className="bcc-inline-actions">
                <button
                  type="button"
                  className="bcc-link-button"
                  disabled={salesPackBusinessMode.loading}
                  onClick={() => {
                    void salesPackBusinessMode.enable();
                  }}
                >
                  {salesPackBusinessMode.loading ? "Ativando..." : "Ativar Modo Business"}
                </button>
              </div>
              {salesPackBusinessMode.message ? (
                <span className="bcc-list-item__meta">{salesPackBusinessMode.message}</span>
              ) : null}
            </div>
          )}
        </CommandCenterCard>

        <CommandCenterCard label="Run Observatory" title={formatCommandCenterRunStatusIndex(viewModel.runObservatory)}>
          <div className="bcc-run-observatory-toolbar" aria-label="Filtros do Run Observatory">
            {(["failed", "waiting_approval", "running"] as const).map((status) => (
              <button
                key={status}
                type="button"
                className="bcc-run-observatory-filter"
                data-active={activeStatus === status ? "true" : "false"}
                onClick={() => onRunObservatoryQueryChange({ status })}
              >
                {humanAgentStatus(status)}
              </button>
            ))}
            <button
              type="button"
              className="bcc-run-observatory-filter"
              data-active={commandCenterRunObservatoryHasQuery(observatoryQuery) ? "false" : "true"}
              onClick={() => onRunObservatoryQueryChange({})}
            >
              Limpar
            </button>
          </div>
          <p className="bcc-run-card__query">
            {formatCommandCenterRunObservatoryQuery(viewModel.runObservatory)}
          </p>
          {viewModel.runObservatory.health ? (
            <p className="bcc-run-card__query">
              Health {viewModel.runObservatory.health.status}: {viewModel.runObservatory.health.nextSafeAction}
            </p>
          ) : null}
          {fabricHealth ? (
            <div className="bcc-run-timeline" aria-label="Saude do Intelligence Fabric">
              <div className="bcc-run-timeline__item" data-status={fabricHealth.status === "ready" ? "done" : fabricHealth.status === "attention" ? "pending" : "failed"}>
                <span>Fabric {fabricHealth.status}: {fabricHealth.recommendation}</span>
                <small>
                  {fabricHealth.summary.fabricRuns} run(s) - fallback {formatPercent(fabricHealth.summary.fallbackRate)} - erro {formatPercent(fabricHealth.summary.errorFallbackRate)} - orientacao {formatPercent(fabricHealth.summary.orientationRate)}
                </small>
                <small>
                  latencia media {fabricHealth.summary.averageLatencyMs}ms - p95 {fabricHealth.summary.p95LatencyMs}ms
                </small>
                {fabricHealth.recommendation === "auto_demote_controlled" ? (
                  <small>Rollback: {fabricHealth.rollback.instruction}</small>
                ) : null}
                {fabricHealth.recommendation === "auto_demote_controlled" ? (
                  <div className="bcc-run-observatory-actions">
                    <button
                      type="button"
                      className="bcc-run-observatory-filter"
                      disabled={demotingFabric}
                      onClick={() => void handleDemoteIntelligenceFabric()}
                    >
                      {demotingFabric ? "Desativando..." : "Desativar Fabric"}
                    </button>
                  </div>
                ) : null}
              </div>
              {visibleFabricHealthFindings.map((finding) => (
                <div key={finding.id} className="bcc-run-timeline__item" data-status={finding.severity === "blocker" ? "failed" : finding.severity === "warning" ? "pending" : "done"}>
                  <span>{finding.id}</span>
                  <small>{finding.message}</small>
                </div>
              ))}
              {fabricDemoteMessage ? (
                <p className="bcc-run-card__query">{fabricDemoteMessage}</p>
              ) : null}
            </div>
          ) : null}
          {llmTelemetry ? (
            <div className="bcc-run-timeline" aria-label="Telemetria de fallback LLM">
              <div className="bcc-run-timeline__item" data-status={llmTelemetry.summary.failed > 0 ? "pending" : "done"}>
                <span>LLM fallback: {llmTelemetry.summary.totalAttempts} tentativa(s)</span>
                <small>
                  fallback {formatPercent(llmTelemetry.summary.fallbackRate)} - media {llmTelemetry.summary.averageLatencyMs}ms - p95 {llmTelemetry.summary.p95LatencyMs}ms
                </small>
                <small>
                  sucesso {llmTelemetry.summary.succeeded} - falha {llmTelemetry.summary.failed} - indisponivel {llmTelemetry.summary.skippedUnavailable}
                </small>
              </div>
              {visibleLlmProviders.map((provider) => (
                <div key={provider.providerName} className="bcc-run-timeline__item" data-status={provider.lastStatus === "succeeded" ? "done" : provider.lastStatus === "failed" ? "failed" : "pending"}>
                  <span>{provider.providerName}</span>
                  <small>
                    {provider.attempts} tentativa(s) - fallback {provider.fallbackAttempts} - media {provider.averageLatencyMs}ms - p95 {provider.p95LatencyMs}ms
                  </small>
                  {provider.lastError ? <small>{provider.lastError}</small> : null}
                </div>
              ))}
              {visibleLlmAttempts.map((attempt) => (
                <div key={attempt.id} className="bcc-run-timeline__item" data-status={attempt.status === "succeeded" ? "done" : attempt.status === "failed" ? "failed" : "pending"}>
                  <span>{attempt.providerName}{attempt.modelName ? `/${attempt.modelName}` : ""}</span>
                  <small>
                    {attempt.surface} - {attempt.status} - {attempt.durationMs}ms{attempt.fallback ? " - fallback" : ""}
                  </small>
                </div>
              ))}
            </div>
          ) : null}
          {viewModel.runObservatory.replay ? (
            <p className="bcc-run-card__query">
              Replay: {viewModel.runObservatory.replay.summary}
            </p>
          ) : null}
          {viewModel.runObservatory.sidecars ? (
            <div className="bcc-run-timeline">
              {viewModel.runObservatory.sidecars.health.slice(0, 4).map((sidecar) => (
                <div key={sidecar.id} className="bcc-run-timeline__item" data-status={sidecar.ready ? "done" : sidecar.enabled ? "pending" : "blocked"}>
                  <span>{sidecar.name}</span>
                  <small>{sidecar.ready ? "pronto" : sidecar.enabled ? "atencao" : "desativado"} - {sidecar.message ?? sidecar.baseUrl ?? "sem detalhe"}</small>
                </div>
              ))}
              {viewModel.runObservatory.sidecars.receipts.recentReceipts.slice(0, 2).map((receipt) => (
                <div key={receipt.id} className="bcc-run-timeline__item" data-status={receipt.status === "succeeded" ? "done" : receipt.status}>
                  <span>{receipt.action}</span>
                  <small>{receipt.runtime} - {receipt.summary}</small>
                </div>
              ))}
            </div>
          ) : null}
          {visibleDiffPreviews.length > 0 ? (
            <div className="bcc-run-timeline" aria-label="Previas de alteracao pendentes">
              {visibleDiffPreviews.map((preview) => (
                <div key={preview.id} className="bcc-run-timeline__item" data-status={preview.applied ? "done" : preview.approvalRequired ? "pending" : "running"}>
                  <span>{preview.title}: {preview.actions.approveApplyLabel}</span>
                  <small>{preview.summary}</small>
                  <small>
                    Draft {preview.observability.draftReady ? "pronto" : "fechado"} - plan {preview.planId || "sem plan"} - Mutation {preview.observability.mutationPlaneStatus}/{preview.observability.mutationPlaneApprovalStatus}
                  </small>
                  <small>
                    Gate {preview.observability.riskGateDecision} - {preview.observability.approvalPath} - {preview.observability.approvalReason}
                  </small>
                  <small>
                    Apply {preview.observability.applyState} - {preview.observability.liveActionApplied ? "impacto aplicado" : "sem impacto live"}{preview.observability.draftLatencyMs !== null ? ` - ${preview.observability.draftLatencyMs}ms` : ""}
                  </small>
                  <small>{preview.actions.approveApplyInstruction}</small>
                  <small>{preview.actions.rollbackLabel}: {preview.actions.rollbackInstruction}</small>
                  <div className="bcc-run-observatory-actions">
                    <button
                      type="button"
                      className="bcc-run-observatory-filter"
                      onClick={() => onRunObservatoryQueryChange({ runId: preview.runId })}
                    >
                      run
                    </button>
                    {preview.planId && !preview.applied ? (
                      <button
                        type="button"
                        className="bcc-run-observatory-filter"
                        disabled={applyingDiffPreviewId === preview.id}
                        onClick={() => void handleApplyDiffPreview(preview)}
                      >
                        {applyingDiffPreviewId === preview.id ? "Aplicando..." : preview.actions.approveApplyLabel}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {diffPreviewActionMessage ? (
                <p className="bcc-run-card__query">{diffPreviewActionMessage}</p>
              ) : null}
            </div>
          ) : null}
          {viewModel.runObservatory.receipts?.length ? (
            <div className="bcc-run-timeline">
              {viewModel.runObservatory.receipts.slice(0, 4).map((receipt) => (
                <div key={receipt.id} className="bcc-run-timeline__item" data-status={receipt.status}>
                  <span>{receipt.title}</span>
                  <small>{receipt.source} - {receipt.detail ?? receipt.kind}</small>
                </div>
              ))}
            </div>
          ) : null}
          <div className="bcc-run-observatory-list">
            {visibleObservedRuns.length > 0 ? visibleObservedRuns.map((observedRun) => (
              <div key={observedRun.id} className="bcc-run-observatory-item" data-status={observedRun.status}>
                <div>
                  <span>{observedRun.title}</span>
                  <small>{formatCommandCenterRunIdentity(observedRun)}</small>
                </div>
                <div>
                  <strong>{humanAgentStatus(observedRun.status)}</strong>
                  <small>
                    {formatCommandCenterRunMatchedBy(observedRun.matchedBy)}
                    {observedRun.eventCount > 0 ? ` - ${observedRun.eventCount} eventos` : ""}
                    {observedRun.artifactCount > 0 ? ` - ${observedRun.artifactCount} artifacts` : ""}
                    {observedRun.approvalCount > 0 ? ` - ${observedRun.approvalCount} approvals` : ""}
                  </small>
                </div>
                <div className="bcc-run-observatory-actions">
                  <button
                    type="button"
                    className="bcc-run-observatory-filter"
                    onClick={() => onRunObservatoryQueryChange({ runId: observedRun.id })}
                  >
                    run
                  </button>
                  {observedRun.traceId ? (
                    <button
                      type="button"
                      className="bcc-run-observatory-filter"
                      onClick={() => onRunObservatoryQueryChange({ traceId: observedRun.traceId })}
                    >
                      trace
                    </button>
                  ) : null}
                  {observedRun.sessionId ? (
                    <button
                      type="button"
                      className="bcc-run-observatory-filter"
                      onClick={() => onRunObservatoryQueryChange({ sessionId: observedRun.sessionId })}
                    >
                      sessao
                    </button>
                  ) : null}
                </div>
              </div>
            )) : (
              <p className="bcc-empty-note">Nenhuma run local encontrada para a consulta atual.</p>
            )}
          </div>
        </CommandCenterCard>

        <CommandCenterOverviewProductCards viewModel={viewModel} />

        <CommandCenterCard label="Linha do tempo" title={run ? humanAgentStatus(run.status) : "Idle"}>
          <div className="bcc-run-timeline">
            {(run?.events.length ? run.events : viewModel.events).slice(0, 6).map((event) => (
              <div key={event.id} className="bcc-run-timeline__item" data-status={event.status ?? "done"}>
                <span>{event.title}</span>
                <small>{event.detail ?? event.kind}</small>
              </div>
            ))}
            {!run?.events.length && viewModel.events.length === 0 ? (
              <p className="bcc-empty-note">Sem eventos recentes no runtime.</p>
            ) : null}
          </div>
        </CommandCenterCard>

        <CommandCenterCard label="Doctor" title={humanRuntimeStatus(viewModel.health.status)}>
          <div className="bcc-health-list">
            {visibleChecks.length > 0 ? visibleChecks.map((check) => (
              <div key={check.id} className="bcc-health-row" data-status={check.status}>
                <span>{check.label}</span>
                <small>{check.detail ?? humanRuntimeStatus(check.status)}</small>
              </div>
            )) : (
              <p className="bcc-empty-note">Nenhum check detalhado foi retornado.</p>
            )}
          </div>
        </CommandCenterCard>

        {preview ? (
          <CommandCenterCard label="Preview" title={`${preview.mode} - ${preview.risk.highestRisk}`}>
            <p className="bcc-empty-note">{preview.nextSafeAction}</p>
            <div className="bcc-tool-chip-grid">
              {visiblePreviewSteps.length > 0 ? visiblePreviewSteps.map((step) => (
                <span key={step.id} className="bcc-tool-chip" data-risk={step.risk}>
                  {step.label}
                  {step.requiresApproval ? " - approval" : ""}
                  {step.previewRequired ? " - preview" : ""}
                </span>
              )) : (
                <p className="bcc-empty-note">Nenhuma etapa de preview publicada.</p>
              )}
            </div>
          </CommandCenterCard>
        ) : null}

        {safetyNarrative ? (
          <CommandCenterCard label="Safety" title={`${safetyNarrative.status} - ${safetyNarrative.highRiskBlockPresent ? "high-risk" : "clear"}`}>
            <p className="bcc-empty-note">{safetyNarrative.nextSafeAction}</p>
            <div className="bcc-tool-chip-grid">
              {visibleSafetyReasons.length > 0 ? visibleSafetyReasons.map((reason) => (
                <span key={reason.id} className="bcc-tool-chip" data-risk={reason.risk}>
                  {reason.title}
                  {reason.redactionApplied ? " - redigido" : ""}
                </span>
              )) : (
                <p className="bcc-empty-note">Nenhum bloqueio high-risk publicado.</p>
              )}
            </div>
          </CommandCenterCard>
        ) : null}

        {selfingDashboard ? (
          <CommandCenterCard label="Selfing" title={`${selfingDashboard.identity.agentName} - ${selfingDashboard.summary.cardCount} cards`}>
            <p className="bcc-empty-note">{selfingDashboard.nextSafeAction}</p>
            <div className="bcc-list">
              {visibleSelfingSuggestions.length > 0 ? visibleSelfingSuggestions.map((suggestion) => (
                <div key={suggestion.id} className="bcc-list-item">
                  <span className="bcc-list-item__title">{suggestion.title}</span>
                  <span className="bcc-list-item__meta">{suggestion.detail}</span>
                </div>
              )) : (
                <p className="bcc-empty-note">Identidade e memoria sem sugestoes pendentes.</p>
              )}
            </div>
          </CommandCenterCard>
        ) : null}

        {artifactMemory ? (
          <CommandCenterCard label="Artifact Memory" title={`${artifactMemory.status} - ${artifactMemory.summary.memoryEntryCount} entradas`}>
            <p className="bcc-empty-note">{artifactMemory.nextSafeAction}</p>
            <div className="bcc-list">
              {visibleArtifactMemoryEntries.length > 0 ? visibleArtifactMemoryEntries.map((entry) => (
                <div key={entry.id} className="bcc-list-item">
                  <span className="bcc-list-item__title">{entry.category}: {entry.title}</span>
                  <span className="bcc-list-item__meta">
                    {entry.artifactId} - {entry.reusable ? "reutilizavel" : "bloqueado"} - {entry.receipt.observatoryReceiptId || "receipt pendente"}
                  </span>
                </div>
              )) : (
                <p className="bcc-empty-note">Nenhum artifact citavel indexado neste run.</p>
              )}
            </div>
          </CommandCenterCard>
        ) : null}

        {personalOpsAutopilot ? (
          <CommandCenterCard label="Ops Autopilot" title={`${personalOpsAutopilot.status} - ${personalOpsAutopilot.summary.suggestionCount} sugestoes`}>
            <p className="bcc-empty-note">{personalOpsAutopilot.nextSafeAction}</p>
            <div className="bcc-list">
              {visiblePersonalOpsSuggestions.length > 0 ? visiblePersonalOpsSuggestions.map((suggestion) => (
                <div key={suggestion.id} className="bcc-list-item">
                  <span className="bcc-list-item__title">{suggestion.category}: {suggestion.title}</span>
                  <span className="bcc-list-item__meta">
                    {suggestion.severity} - {suggestion.requiresApproval ? "approval" : "read-only"} - {suggestion.actions.previewCommand}
                  </span>
                </div>
              )) : (
                <p className="bcc-empty-note">Nenhuma correcao operacional sugerida agora.</p>
              )}
            </div>
          </CommandCenterCard>
        ) : null}

        {agentTeamCompiler ? (
          <CommandCenterCard label="Agent Team Compiler" title={`${agentTeamCompiler.status} - ${agentTeamCompiler.summary.roleCount} roles`}>
            <p className="bcc-empty-note">{agentTeamCompiler.nextSafeAction}</p>
            <div className="bcc-list">
              {visibleAgentTeamRoles.length > 0 ? visibleAgentTeamRoles.map((role) => (
                <div key={role.id} className="bcc-list-item">
                  <span className="bcc-list-item__title">{role.roleId}: {role.label}</span>
                  <span className="bcc-list-item__meta">
                    {role.kind} - {role.scope.mode} - {role.provider.providerLabel}/{role.provider.modelLabel}
                  </span>
                </div>
              )) : (
                <p className="bcc-empty-note">Nenhuma equipe compilada para este run.</p>
              )}
            </div>
          </CommandCenterCard>
        ) : null}

        <CommandCenterCard
          label="Auto Subagents"
          title={subagentAutoInvocation
            ? `${humanSubagentAutoStatus(subagentAutoInvocation.status)} - ${subagentAutoInvocation.roles.length} role(s)`
            : "Sem decisao automatica"}
        >
          {subagentAutoInvocation ? (
            <div className="bcc-list">
              <div className="bcc-list-item" data-active={subagentAutoInvocation.status === "auto-selected" ? "true" : "false"}>
                <span className="bcc-list-item__title">
                  {subagentAutoInvocation.selectedBy} / {subagentAutoInvocation.mode}
                </span>
                <span className="bcc-list-item__meta">
                  {subagentAutoInvocation.publicRationale} - live {subagentAutoInvocation.live ? "sim" : "nao"} - confidence {Math.round(subagentAutoInvocation.confidence * 100)}%
                </span>
                <span className="bcc-list-item__meta">
                  Proximo passo: {subagentAutoInvocation.nextSafeAction}
                </span>
              </div>
              {visibleSubagentAutoRoles.length > 0 ? visibleSubagentAutoRoles.map((role) => (
                <div key={`auto-subagent-role:${role.roleId}`} className="bcc-list-item">
                  <span className="bcc-list-item__title">{role.roleId}: {role.label}</span>
                  <span className="bcc-list-item__meta">{role.whySelected}</span>
                </div>
              )) : (
                <p className="bcc-empty-note">Nenhum role selecionado nesta decisao.</p>
              )}
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">Sinais</span>
                <span className="bcc-list-item__meta">
                  gatilhos: {visibleSubagentAutoTriggers.length > 0 ? visibleSubagentAutoTriggers.join(", ") : "n/d"} - riscos: {visibleSubagentAutoRisks.length > 0 ? visibleSubagentAutoRisks.join(", ") : "nenhum"}
                </span>
              </div>
              <div className="bcc-list-item">
                <span className="bcc-list-item__title">Policy</span>
                <span className="bcc-list-item__meta">
                  read-only: {String(subagentAutoInvocation.safety.readOnlyOnly)} - sem CoT bruto: {String(subagentAutoInvocation.safety.noRawChainOfThought)} - mutacao exige approval: {String(subagentAutoInvocation.safety.approvalsRequiredForMutation)}
                </span>
              </div>
            </div>
          ) : (
            <p>Auto Subagents aparece quando o loop principal decide delegar leitura, pesquisa ou revisao para workers governados.</p>
          )}
        </CommandCenterCard>

        {crossChannelContinuity ? (
          <CommandCenterCard label="Cross-Channel Continuity" title={`${crossChannelContinuity.status} - ${crossChannelContinuity.summary.handoffCount} handoffs`}>
            <p className="bcc-empty-note">{crossChannelContinuity.nextSafeAction}</p>
            <div className="bcc-list">
              {visibleContinuityChannels.length > 0 ? visibleContinuityChannels.map((channel) => (
                <div key={channel.id} className="bcc-list-item">
                  <span className="bcc-list-item__title">{channel.kind}: {channel.label}</span>
                  <span className="bcc-list-item__meta">
                    {channel.status} - {channel.source} - {channel.primary ? "primary" : "secondary"}
                  </span>
                </div>
              )) : (
                <p className="bcc-empty-note">Nenhum canal de continuidade publicado.</p>
              )}
            </div>
          </CommandCenterCard>
        ) : null}

        {askBeforeAssumptionPolicy ? (
          <CommandCenterCard label="Ask Before Assumption" title={`${askBeforeAssumptionPolicy.status} - ${askBeforeAssumptionPolicy.summary.questionCount} perguntas`}>
            <p className="bcc-empty-note">{askBeforeAssumptionPolicy.nextSafeAction}</p>
            <div className="bcc-list">
              {visibleAskQuestions.length > 0 ? visibleAskQuestions.map((question) => (
                <div key={question.id} className="bcc-list-item">
                  <span className="bcc-list-item__title">{question.priority}: {question.question}</span>
                  <span className="bcc-list-item__meta">
                    {question.defaultAction} - {question.blocksMutation ? "bloqueia mutacao" : "read-only"} - {question.reason}
                  </span>
                </div>
              )) : (
                <p className="bcc-empty-note">Nenhuma pergunta obrigatoria para este run.</p>
              )}
            </div>
          </CommandCenterCard>
        ) : null}

        {universalIntentTrustEnforcement ? (
          <CommandCenterCard label="UNI / Trust" title={`${universalIntentTrustEnforcement.status} - ${universalIntentTrustEnforcement.summary.trustLevel}`}>
            <p className="bcc-empty-note">{universalIntentTrustEnforcement.nextSafeAction}</p>
            <div className="bcc-list">
              {visibleUniversalIntentGates.length > 0 ? visibleUniversalIntentGates.map((gate) => (
                <div key={gate.id} className="bcc-list-item">
                  <span className="bcc-list-item__title">{gate.status}: {gate.label}</span>
                  <span className="bcc-list-item__meta">
                    {gate.source} - {gate.detail}
                  </span>
                </div>
              )) : (
                <p className="bcc-empty-note">Nenhum gate UNI publicado.</p>
              )}
            </div>
          </CommandCenterCard>
        ) : null}

        {providerMeshConsolidation ? (
          <CommandCenterCard label="Provider Mesh" title={`${providerMeshConsolidation.status} - ${providerMeshConsolidation.summary.modelCount} modelos`}>
            <p className="bcc-empty-note">{providerMeshConsolidation.nextSafeAction}</p>
            <div className="bcc-list">
              {visibleProviderMeshRoutes.length > 0 ? visibleProviderMeshRoutes.map((route) => (
                <div key={route.id} className="bcc-list-item">
                  <span className="bcc-list-item__title">{route.label}: {route.readiness}</span>
                  <span className="bcc-list-item__meta">
                    {route.modelCount} modelo(s) - {route.runtime.adapterKind} - {route.runtime.runtimeSupported ? "factory ok" : "factory pendente"}
                  </span>
                </div>
              )) : (
                <p className="bcc-empty-note">Nenhuma rota canonica publicada.</p>
              )}
            </div>
          </CommandCenterCard>
        ) : null}

        <CommandCenterCard
          label="Ferramentas"
          title={discovery ? `Discovery ${discovery.intentCategory} (${Math.round(discovery.confidence * 100)}%)` : viewModel.toolExposure.summary}
        >
          {discovery ? (
            <p className="bcc-empty-note">{discovery.nextSafeAction}</p>
          ) : null}
          <div className="bcc-tool-chip-grid">
            {visibleDiscoveryRecommendations.length > 0 ? visibleDiscoveryRecommendations.map((recommendation) => (
              <span key={recommendation.id} className="bcc-tool-chip" data-risk={recommendation.risk}>
                {recommendation.label}
                {recommendation.requiresApproval ? " · approval" : ""}
                {recommendation.previewRequired ? " · preview" : ""}
              </span>
            )) : visibleTools.length > 0 ? visibleTools.map((tool) => (
              <span key={tool.id} className="bcc-tool-chip" data-risk={tool.risk}>
                {tool.label}
                {tool.requiresApproval ? " · approval" : ""}
              </span>
            )) : (
              <p className="bcc-empty-note">Nenhuma ferramenta exposta neste snapshot.</p>
            )}
          </div>
        </CommandCenterCard>

        <CommandCenterCard label="Tarefas" title={`${viewModel.counts.tasks} registradas`}>
          <div className="bcc-list">
            {visibleTasks.length > 0 ? visibleTasks.map((task) => (
              <div key={task.id} className="bcc-list-item">
                <span className="bcc-list-item__title">{task.title}</span>
                <span className="bcc-list-item__meta">{humanAgentStatus(task.status)} - {task.summary}</span>
              </div>
            )) : (
              <p className="bcc-empty-note">Nenhuma tarefa duravel retornada ainda.</p>
            )}
          </div>
        </CommandCenterCard>
      </div>

      <section className="bcc-release-strip">
        <div>
          <span className="bcc-card__label">Release</span>
          <strong>{viewModel.releaseStatus.version ?? viewModel.releaseStatus.channel}</strong>
          <p>{viewModel.releaseStatus.summary}</p>
        </div>
        <CommandCenterBadge tone={viewModel.releaseStatus.status === "blocked" ? "danger" : "info"}>
          rollback {viewModel.releaseStatus.rollbackAvailable ? "pronto" : "indisponivel"}
        </CommandCenterBadge>
      </section>
    </div>
  );
}

type CommandCenterStateCardProps = {
  label: string;
  value: string;
  detail: string;
  tone: "info" | "ok" | "warn" | "danger";
};

function CommandCenterStateCard({
  label,
  value,
  detail,
  tone,
}: CommandCenterStateCardProps) {
  return (
    <article className="bcc-state-card" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function humanNaturalFirstStatus(
  status: NonNullable<DashboardCommandCenterViewModel["naturalFirstRuntime"]>["status"],
): string {
  if (status === "approval-required") {
    return "aguardando approval";
  }
  if (status === "tool-preview") {
    return "preview";
  }
  if (status === "light-reply") {
    return "resposta leve";
  }
  if (status === "llm-reply") {
    return "resposta LLM";
  }
  if (status === "memory-recall") {
    return "memoria";
  }
  if (status === "governed-execution") {
    return "execucao";
  }
  if (status === "completed") {
    return "concluido";
  }
  if (status === "classified") {
    return "classificado";
  }
  return "recebido";
}

function buildNaturalFirstPolicyPills(
  naturalFirst: NonNullable<DashboardCommandCenterViewModel["naturalFirstRuntime"]>,
): Array<{ id: string; label: string; active: boolean }> {
  return [
    {
      id: "gateway",
      label: naturalFirst.shouldEnterGateway ? "gateway" : "atalho",
      active: naturalFirst.shouldEnterGateway,
    },
    {
      id: "approval",
      label: naturalFirst.policies.noApprovalBypass ? "sem bypass" : "approval aberto",
      active: naturalFirst.policies.noApprovalBypass,
    },
    {
      id: "tools",
      label: naturalFirst.policies.noToolExecutionBeforeApproval ? "tools bloqueadas" : "tools controladas",
      active: naturalFirst.policies.noToolExecutionBeforeApproval,
    },
    {
      id: "memory",
      label: naturalFirst.policies.noMemoryInvented ? "memoria com fonte" : "memoria opcional",
      active: naturalFirst.policies.noMemoryInvented,
    },
    {
      id: "llm",
      label: naturalFirst.policies.gracefulLlmFallback ? "fallback honesto" : "LLM natural",
      active: naturalFirst.policies.gracefulLlmFallback,
    },
  ];
}

function humanNexusWorkbenchStatus(status: NonNullable<DashboardCommandCenterViewModel["nexusWorkbench"]>["status"]): string {
  if (status === "needs-confirmation") {
    return "aguarda confirmacao";
  }
  if (status === "fallback") {
    return "fallback seguro";
  }
  if (status === "degraded") {
    return "em observacao";
  }
  if (status === "offline") {
    return "offline";
  }
  return "pronto";
}

function nexusWorkbenchTone(status: NonNullable<DashboardCommandCenterViewModel["nexusWorkbench"]>["status"]): "info" | "ok" | "warn" | "danger" {
  if (status === "offline") {
    return "danger";
  }
  if (status === "needs-confirmation" || status === "degraded") {
    return "warn";
  }
  if (status === "fallback") {
    return "info";
  }
  return "ok";
}

function humanSubagentAutoStatus(status: NonNullable<DashboardCommandCenterViewModel["subagentAutoInvocation"]>["status"]): string {
  if (status === "auto-selected") {
    return "auto selecionado";
  }
  if (status === "approval-required") {
    return "aguarda approval";
  }
  if (status === "skipped") {
    return "ignorado";
  }
  return "desconhecido";
}

function subagentAutoTone(status: NonNullable<DashboardCommandCenterViewModel["subagentAutoInvocation"]>["status"]): "info" | "ok" | "warn" | "danger" {
  if (status === "approval-required") {
    return "warn";
  }
  if (status === "auto-selected") {
    return "info";
  }
  if (status === "skipped") {
    return "ok";
  }
  return "warn";
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) {
    return "0%";
  }
  return `${Math.round(value * 1000) / 10}%`;
}
