import type {
  ZavorthAgentGatewaySnapshot,
  UniversalAgentEvent,
  UniversalAgentRun,
  UniversalAgentRunObservatorySnapshot,
  UniversalAgentWorkflowJob,
  UniversalApprovalRequest,
  UniversalArtifactSummary,
  UniversalMemorySignal,
  UniversalReplyPort,
  UniversalToolExposure,
} from "../../../../../../contracts/CommandCenterRuntimeBoundaryContract.js";
import { mapPerceptionControlProjection } from "./perceptionControlProjection";
import type {
  DashboardAgentEvent,
  DashboardAgentRun,
  DashboardAgentRunStatus,
  DashboardApprovalSummary,
  DashboardAgentTeamCompilerSnapshot,
  DashboardAskBeforeAssumptionPolicySnapshot,
  DashboardArtifactMemorySnapshot,
  DashboardArtifactSummary,
  DashboardBudgetSnapshot,
  DashboardCapabilityNegotiationSnapshot,
  DashboardChatMessage,
  DashboardCrossChannelContinuitySnapshot,
  DashboardFeedbackTelemetryProductLoopSnapshot,
  DashboardHealthSnapshot,
  DashboardIntegrationShowcasePartnerSurfaceSnapshot,
  DashboardMemorySignal,
  DashboardMemoryWithReceiptsSnapshot,
  DashboardModelProfile,
  DashboardNaturalCapabilityDiscoverySnapshot,
  DashboardNaturalFirstRuntimeSnapshot,
  DashboardPersonalOpsAutopilotSnapshot,
  DashboardProductEntryRuntimeSnapshot,
  DashboardProductizationEvidenceSnapshot,
  DashboardPublicAdoptionPilotLoopSnapshot,
  DashboardPublicSiteDocsDemoSyncSnapshot,
  DashboardProviderMeshConsolidationSnapshot,
  DashboardProviderArenaSnapshot,
  DashboardProviderCockpitSnapshot,
  DashboardReplyPort,
  DashboardBlueprintCompletionGateSnapshot,
  DashboardReleaseAdoptionReadinessSnapshot,
  DashboardReleaseCandidatePreCanaryGateSnapshot,
  DashboardReleaseInstallerRollbackPathSnapshot,
  DashboardRunObservatorySnapshot,
  DashboardRunArtifactReceiptReplaySnapshot,
  DashboardRuntimeStatus,
  DashboardSafetyNarrativeSnapshot,
  DashboardSelfingDashboardSnapshot,
  DashboardSessionSummary,
  DashboardSkillMcpQuarantineSnapshot,
  DashboardSubagentAutoInvocationSnapshot,
  DashboardTaskSummary,
  DashboardToolExposure,
  DashboardToolExposureProfile,
  DashboardToolRehearsalSnapshot,
  DashboardUniversalIntentTrustEnforcementSnapshot,
  DashboardUniversalPreviewModeSnapshot,
} from "../contracts";
import {
  COMMAND_CENTER_RUNTIME_PROJECTION_VERSION,
  type CommandCenterRuntimeProjection,
} from "./commandCenterRuntimeProjection";

function formatTimestamp(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) {
    return "agora";
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  return date.toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapRuntimeStatus(run: UniversalAgentRun | null): DashboardRuntimeStatus {
  if (!run) {
    return "ready";
  }
  if (run.status === "failed" || run.status === "cancelled") {
    return "blocked";
  }
  if (run.status === "waiting_approval" || run.status === "queued") {
    return "degraded";
  }
  return "ready";
}

function mapAgentRunStatus(status: UniversalAgentRun["status"]): DashboardAgentRunStatus {
  return status;
}

function mapEventKind(kind: UniversalAgentEvent["kind"]): DashboardAgentEvent["kind"] {
  if (kind === "planning") {
    return "thinking";
  }
  if (kind === "memory" || kind === "input" || kind === "reply" || kind === "status") {
    return "status";
  }
  return kind;
}

function mapEvent(event: UniversalAgentEvent): DashboardAgentEvent {
  return {
    id: event.id,
    kind: mapEventKind(event.kind),
    title: event.title,
    detail: event.detail,
    status: event.status,
  };
}

function mapToolExposure(tool: UniversalToolExposure): DashboardToolExposure {
  return {
    id: tool.id,
    label: tool.label,
    capabilityId: tool.capabilityId,
    risk: tool.risk,
    requiresApproval: tool.requiresApproval,
    description: tool.description,
  };
}

function mapToolExposureProfile(run: UniversalAgentRun | null): DashboardToolExposureProfile {
  if (!run) {
    return {
      mode: "unknown",
      summary: "Nenhuma execucao ativa expondo ferramentas agora.",
      tools: [],
    };
  }

  return {
    mode: run.toolExposure.mode,
    summary: run.toolExposure.summary,
    tools: run.toolExposure.tools.map(mapToolExposure),
  };
}

function mapReplyPort(port: UniversalReplyPort): DashboardReplyPort {
  return {
    id: port.id,
    label: port.label,
    kind: port.kind,
    status: port.status,
    primary: port.primary,
    description: port.description,
  };
}

function mapModelProfile(run: UniversalAgentRun | null): DashboardModelProfile | null {
  if (!run) {
    return null;
  }

  return {
    providerLabel: run.modelProfile.providerLabel,
    modelLabel: run.modelProfile.modelLabel,
    routingPolicy: run.modelProfile.routingPolicy,
    fallbackModelLabel: run.modelProfile.fallbackModelLabel,
    routeId: run.modelProfile.routeId,
    familyId: run.modelProfile.familyId,
    selectionSource: run.modelProfile.selectionSource,
    readiness: run.modelProfile.readiness,
    ready: run.modelProfile.ready,
    fallbackOrder: run.modelProfile.fallbackOrder,
    selectionExplanation: run.modelProfile.selectionExplanation,
    supportsTools: run.modelProfile.supportsTools,
    supportsVision: run.modelProfile.supportsVision,
    supportsStreaming: run.modelProfile.supportsStreaming,
  };
}

function mapAgentRun(run: UniversalAgentRun | null): DashboardAgentRun | null {
  if (!run) {
    return null;
  }

  return {
    id: run.id,
    title: run.title,
    status: mapAgentRunStatus(run.status),
    sessionId: run.sessionId,
    startedAt: formatTimestamp(run.createdAt),
    updatedAt: formatTimestamp(run.updatedAt),
    summary: run.summary,
    providerLabel: run.modelProfile.providerLabel,
    modelLabel: run.modelProfile.modelLabel,
    events: run.events.map(mapEvent),
    trace: null,
    metadata: run.metadata,
  };
}

function mapBudget(run: UniversalAgentRun | null): DashboardBudgetSnapshot | null {
  const budget = run?.metadata?.runBudget;
  if (!budget || typeof budget !== "object" || Array.isArray(budget)) {
    return null;
  }
  const raw = budget as Record<string, unknown>;
  const reason = String(raw.reason || "").trim();
  const estimatedCostUnits = asNumber(raw.estimatedCostUnits);
  const maxEstimatedCostUnits = asNumber(raw.maxEstimatedCostUnits);
  return {
    status: raw.degraded === true ? "exceeded" : reason ? "attention" : "ok",
    summary: reason
      ? `Budget do run exige atencao: ${reason}.`
      : "Budget operacional mapeado a partir do AgentRunService.",
    source: String(raw.source || "").trim() || undefined,
    reason: reason || undefined,
    estimatedCostUnits,
    maxEstimatedCostUnits,
    inputChars: asNumber(raw.inputChars),
    requestedToolCount: asNumber(raw.requestedToolCount),
    exposedToolCount: asNumber(raw.exposedToolCount),
  };
}

function asTextArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => String(entry || "").trim()).filter(Boolean);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizeDiscoveryRisk(value: unknown): DashboardNaturalCapabilityDiscoverySnapshot["safety"]["highestRisk"] {
  const raw = String(value || "").toLowerCase();
  if (raw === "safe" || raw === "attention" || raw === "danger" || raw === "unknown") {
    return raw;
  }
  return "unknown";
}

function normalizePreviewRisk(value: unknown): DashboardUniversalPreviewModeSnapshot["risk"]["highestRisk"] {
  return normalizeDiscoveryRisk(value);
}

function routeLabel(route: string): string {
  const labels: Record<string, string> = {
    "slash-command": "Comando",
    "light-chat": "Conversa leve",
    "llm-reply": "Resposta LLM",
    "capability-discovery": "Descoberta",
    "memory-recall": "Memoria",
    "tool-preview": "Preview",
    "approval-proposal": "Approval",
    "governed-execution": "Execucao governada",
  };
  return labels[route] || "Rota natural";
}

function naturalFirstStatus(input: {
  route: string;
  runStatus: UniversalAgentRun["status"];
  lightReply: Record<string, unknown> | null;
  llmRuntime: Record<string, unknown> | null;
  memoryContinuity: Record<string, unknown> | null;
  approvalSafety: Record<string, unknown> | null;
}): DashboardNaturalFirstRuntimeSnapshot["status"] {
  if (String(input.approvalSafety?.status || "") === "approval-required" || input.runStatus === "waiting_approval") {
    return "approval-required";
  }
  if (input.lightReply) {
    return "light-reply";
  }
  if (input.llmRuntime) {
    return "llm-reply";
  }
  if (input.memoryContinuity) {
    return "memory-recall";
  }
  if (input.route === "tool-preview") {
    return "tool-preview";
  }
  if (input.route === "governed-execution") {
    return "governed-execution";
  }
  if (input.runStatus === "completed") {
    return "completed";
  }
  return input.route ? "classified" : "unknown";
}

function mapNaturalFirstRuntime(run: UniversalAgentRun | null): DashboardNaturalFirstRuntimeSnapshot | null {
  const route = asRecord(run?.metadata?.naturalFirstRoute);
  if (!run || !route) {
    return null;
  }
  const entrypoint = asRecord(run.metadata.naturalFirstEntrypoint) || {};
  const lightReply = asRecord(run.metadata.naturalFirstLightReply);
  const llmRuntime = asRecord(run.metadata.naturalFirstLlmRuntime);
  const memoryContinuity = asRecord(run.metadata.naturalFirstMemoryContinuity);
  const approvalSafety = asRecord(run.metadata.naturalFirstApprovalSafety);
  const approvalRisk = asRecord(approvalSafety?.risk);
  const routeRisk = asRecord(route.risk);
  const routeName = String(route.route || "unknown");
  const riskLevel = normalizeDiscoveryRisk(approvalRisk?.level ?? routeRisk?.level);
  const requiresApproval = approvalRisk?.routeRequiresApproval === true
    || approvalRisk?.toolRequiresApproval === true
    || routeRisk?.requiresApproval === true
    || route.requiresApproval === true;
  const previewRequired = approvalRisk?.previewRequired === true || routeRisk?.previewRequired === true;
  const status = naturalFirstStatus({
    route: routeName,
    runStatus: run.status,
    lightReply,
    llmRuntime,
    memoryContinuity,
    approvalSafety,
  });
  const label = routeLabel(routeName);
  const headline = status === "approval-required"
    ? "Acao aguardando aprovacao"
    : status === "tool-preview"
      ? "Preview governado preparado"
      : status === "governed-execution"
        ? "Execucao governada em andamento"
        : status === "completed" || status === "light-reply" || status === "llm-reply" || status === "memory-recall"
          ? "Resposta pronta"
          : "Mensagem classificada";
  const detail = String(
    approvalSafety?.summary
      || lightReply?.summary
      || llmRuntime?.summary
      || memoryContinuity?.summary
      || route.reason
      || run.summary
      || "",
  );
  const memoryPolicy = asRecord(memoryContinuity?.policy) || {};
  const lightSafety = asRecord(lightReply?.safety) || {};
  const llmSafety = asRecord(llmRuntime?.safety) || {};
  const approvalEnforcement = asRecord(approvalSafety?.enforcement) || {};
  return {
    contractVersion: "natural-first-command-center-ux/8",
    generatedAt: formatTimestamp(String(approvalSafety?.generatedAt || memoryContinuity?.generatedAt || lightReply?.generatedAt || run.updatedAt)),
    route: routeName,
    routeLabel: label,
    status,
    tone: run.status === "failed" || run.status === "cancelled"
      ? "blocked"
      : status === "approval-required" || requiresApproval || previewRequired
        ? "degraded"
        : "ready",
    headline,
    detail,
    receivedText: run.input,
    inputKind: String(entrypoint.inputKind || "free-text"),
    shouldEnterGateway: entrypoint.gatewayRequired !== false && route.shouldEnterGateway !== false,
    channel: run.channel,
    costTier: String(asRecord(route.cost)?.tier || "unknown"),
    effort: String(route.effort || "unknown"),
    usesLlm: String(route.usesLlm || "unknown"),
    risk: {
      level: riskLevel,
      requiresApproval,
      previewRequired,
      reasons: asTextArray(approvalRisk?.reasons || routeRisk?.reasons),
    },
    stages: [
      {
        id: "received",
        label: "Mensagem recebida",
        detail: run.title || run.input,
        status: "done",
      },
      {
        id: "classified",
        label: `Classificada como ${label}`,
        detail: String(route.reason || "Classificacao Natural First registrada."),
        status: "done",
      },
      {
        id: "result",
        label: status === "approval-required" ? "Aguardando aprovacao" : "Resposta pronta",
        detail,
        status: run.status === "failed" ? "blocked" : status === "approval-required" ? "pending" : "done",
      },
    ],
    policies: {
      noExecutorForLightChat: lightSafety.noExecutorCalled === true,
      noToolExecutionBeforeApproval: approvalEnforcement.noToolExecutionBeforeApproval === true,
      noMemoryInvented: memoryPolicy.noMemoryInvented === true,
      noApprovalBypass: approvalEnforcement.noApprovalBypass === true
        || lightSafety.approvalBypass === false
        || llmSafety.noApprovalBypass === true,
      gracefulLlmFallback: asRecord(run.metadata.executorResolution)?.gracefulFallback === true || llmRuntime?.fallbackUsed === true,
    },
    nextSafeAction: String(
      approvalSafety?.nextSafeAction
        || memoryContinuity?.nextSafeAction
        || llmRuntime?.nextSafeAction
        || route.reason
        || "Continuar pelo gateway governado.",
    ),
  };
}

function normalizeSafetyNarrativeStatus(value: unknown): DashboardSafetyNarrativeSnapshot["status"] {
  const raw = String(value || "").toLowerCase();
  if (raw === "clear" || raw === "explaining" || raw === "waiting-approval" || raw === "blocked" || raw === "failed") {
    return raw;
  }
  return "unknown";
}

function normalizeSubagentAutoStatus(value: unknown): DashboardSubagentAutoInvocationSnapshot["status"] {
  const raw = String(value || "").toLowerCase();
  if (raw === "auto-selected" || raw === "approval-required" || raw === "skipped") {
    return raw;
  }
  return "unknown";
}

function normalizeSubagentTimelineStatus(
  value: unknown,
): DashboardSubagentAutoInvocationSnapshot["timeline"][number]["status"] {
  const raw = String(value || "").toLowerCase();
  if (raw === "pending" || raw === "running" || raw === "done" || raw === "failed") {
    return raw;
  }
  if (raw === "completed" || raw === "ready" || raw === "auto-selected") {
    return "done";
  }
  if (raw === "queued" || raw === "thinking" || raw === "approval-required") {
    return "pending";
  }
  if (raw === "cancelled" || raw === "blocked" || raw === "denied") {
    return "failed";
  }
  return "unknown";
}

function normalizeSubagentActionStyle(
  value: unknown,
): DashboardSubagentAutoInvocationSnapshot["actions"][number]["style"] {
  const raw = String(value || "").toLowerCase();
  if (raw === "primary" || raw === "secondary" || raw === "success" || raw === "danger") {
    return raw;
  }
  return "secondary";
}

function cleanSubagentText(value: unknown, fallback = ""): string {
  const text = String(value ?? fallback).replace(/\s+/g, " ").trim() || fallback;
  const redacted = text
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, "[redacted-secret]")
    .replace(/\bAIza[0-9A-Za-z_-]{20,}\b/g, "[redacted-secret]")
    .replace(/\bghp_[0-9A-Za-z_]{20,}\b/g, "[redacted-secret]");
  return redacted.length > 420 ? `${redacted.slice(0, 417)}...` : redacted;
}

function nullableSubagentText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function subagentRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => asRecord(entry)).filter((entry): entry is Record<string, unknown> => Boolean(entry));
}

function buildSubagentAutoActions(
  rawActions: unknown,
  selectedSessionId: string | null,
): DashboardSubagentAutoInvocationSnapshot["actions"] {
  const requested = subagentRecordArray(rawActions);
  if (requested.length > 0) {
    return requested.slice(0, 8).map((entry, index) => ({
      id: cleanSubagentText(entry.id, `subagent-action-${index + 1}`),
      label: cleanSubagentText(entry.label, "Acao de agente"),
      command: cleanSubagentText(entry.command, "/agents status"),
      style: normalizeSubagentActionStyle(entry.style),
      requiresApproval: entry.requiresApproval === true,
      reason: cleanSubagentText(entry.reason, "Acao projetada pelo runtime de subagentes."),
    }));
  }
  const selected = selectedSessionId || "latest";
  return [
    { id: "agents-status", label: "Ver status", command: "/agents status", style: "primary", requiresApproval: false, reason: "Mostra sessoes, runs, workers e policy." },
    { id: "agents-read", label: "Ler ultimo", command: `/agents read ${selected}`, style: "secondary", requiresApproval: false, reason: "Abre o contexto operacional da sessao selecionada." },
    { id: "agents-summarize", label: "Resumir", command: `/agents summarize ${selected}`, style: "secondary", requiresApproval: false, reason: "Gera sintese rastreavel do trabalho dos subagentes." },
    { id: "agents-cancel", label: "Cancelar", command: `/agents cancel ${selected}`, style: "danger", requiresApproval: true, reason: "Interrompe a sessao selecionada; exige cuidado operacional." },
  ];
}

function buildSubagentAutoTimeline(
  run: UniversalAgentRun,
  raw: Record<string, unknown>,
): DashboardSubagentAutoInvocationSnapshot["timeline"] {
  const explicitTimeline = subagentRecordArray(raw.timeline);
  if (explicitTimeline.length > 0) {
    return explicitTimeline.slice(-8).map((entry, index) => ({
      id: cleanSubagentText(entry.id, `subagent-timeline-${index + 1}`),
      title: cleanSubagentText(entry.title ?? entry.kind, "Evento de subagente"),
      detail: cleanSubagentText(entry.detail ?? entry.summary, "Evento operacional registrado."),
      status: normalizeSubagentTimelineStatus(entry.status),
      createdAt: formatTimestamp(String(entry.createdAt || entry.generatedAt || entry.updatedAt || run.updatedAt)),
    }));
  }
  const agentEvents = run.events
    .filter((event) => /subagent|agente|agent/i.test(`${event.title} ${event.detail || ""} ${event.kind}`))
    .slice(-7)
    .map((event) => ({
      id: event.id,
      title: cleanSubagentText(event.title, "Evento de subagente"),
      detail: cleanSubagentText(event.detail, "Evento operacional registrado."),
      status: normalizeSubagentTimelineStatus(event.status),
      createdAt: formatTimestamp(event.createdAt),
    }));
  return [
    {
      id: "subagent-decision",
      title: "Decisao de subagentes",
      detail: cleanSubagentText(raw.publicRationale ?? raw.operatorSummary, "Decisao registrada pelo roteador de subagentes."),
      status: normalizeSubagentTimelineStatus(raw.status),
      createdAt: formatTimestamp(String(raw.generatedAt || run.createdAt)),
    },
    ...agentEvents,
  ].slice(-8);
}

function buildSubagentAutoReceipts(
  raw: Record<string, unknown>,
): DashboardSubagentAutoInvocationSnapshot["receipts"] {
  const explicitReceipts = subagentRecordArray(raw.receipts);
  if (explicitReceipts.length > 0) {
    return explicitReceipts.slice(0, 8).map((receipt, index) => ({
      id: cleanSubagentText(receipt.id, `subagent-receipt-${index + 1}`),
      kind: cleanSubagentText(receipt.kind ?? receipt.type, "receipt"),
      status: cleanSubagentText(receipt.status ?? receipt.decision, "unknown"),
      reason: cleanSubagentText(receipt.reason ?? receipt.detail ?? receipt.summary, "Receipt operacional de subagente."),
    }));
  }
  return [{
    id: cleanSubagentText(raw.decisionId, "subagent-auto-decision"),
    kind: "decision",
    status: normalizeSubagentAutoStatus(raw.status),
    reason: cleanSubagentText(raw.publicRationale ?? raw.operatorSummary, "Decisao automatica registrada sem receipt adicional."),
  }];
}

function mapSubagentAutoInvocation(
  run: UniversalAgentRun | null,
): DashboardSubagentAutoInvocationSnapshot | null {
  const raw = asRecord(run?.metadata?.subagentAutoInvocation);
  if (!raw || !run) {
    return null;
  }
  const dashboard = asRecord(raw.dashboard) || {};
  const safety = asRecord(raw.safety) || {};
  const roles = Array.isArray(raw.roles) ? raw.roles : [];
  const mappedRoles = roles.slice(0, 8).map((entry, index) => {
    const role = asRecord(entry) || {};
    return {
      roleId: cleanSubagentText(role.roleId, `role-${index + 1}`),
      label: cleanSubagentText(role.label, String(role.roleId || `Role ${index + 1}`)),
      whySelected: cleanSubagentText(role.whySelected, "Selecionado pela politica de subagentes."),
    };
  });
  const operational = asRecord(raw.operational) || {};
  const selectedSessionId = nullableSubagentText(
    operational.selectedSessionId ?? raw.selectedSessionId ?? raw.sessionId ?? run.sessionId,
  );
  const selectedRunId = nullableSubagentText(operational.selectedRunId ?? raw.selectedRunId ?? raw.runId ?? run.id);
  return {
    contractVersion: String(raw.contractVersion || "subagent-auto-invocation/v1"),
    generatedAt: formatTimestamp(String(raw.generatedAt || run?.updatedAt || "")),
    status: normalizeSubagentAutoStatus(raw.status ?? dashboard.status),
    selectedBy: cleanSubagentText(raw.selectedBy, "unknown"),
    action: cleanSubagentText(raw.action, "unknown"),
    mode: cleanSubagentText(raw.mode, "unknown"),
    channel: cleanSubagentText(raw.channel || run.channel, "unknown"),
    confidence: asNumber(raw.confidence) ?? 0,
    live: raw.live === true,
    badges: asTextArray(raw.badges).length > 0 ? asTextArray(raw.badges) : asTextArray(dashboard.badges),
    roles: mappedRoles,
    triggers: asTextArray(raw.triggers),
    riskSignals: asTextArray(raw.riskSignals),
    publicRationale: cleanSubagentText(raw.publicRationale || raw.operatorSummary, "Decisao automatica de subagentes registrada."),
    nextSafeAction: cleanSubagentText(raw.nextSafeAction ?? dashboard.nextSafeAction, "Acompanhar workers, receipts e sintese final."),
    safety: {
      noRawChainOfThought: safety.noRawChainOfThought !== false,
      noSecretValuesSerialized: safety.noSecretValuesSerialized !== false,
      readOnlyOnly: safety.readOnlyOnly !== false,
      approvalsRequiredForMutation: safety.workspaceMutationRequiresApproval !== false
        && safety.commandExecutionRequiresApproval !== false
        && safety.externalSideEffectsRequireApproval !== false,
    },
    operational: {
      runId: nullableSubagentText(operational.runId ?? run.id),
      traceId: nullableSubagentText(operational.traceId ?? run.traceId),
      requestId: nullableSubagentText(operational.requestId ?? run.requestId),
      sessionId: nullableSubagentText(operational.sessionId ?? run.sessionId),
      selectedSessionId,
      selectedRunId,
      runtimeStatus: cleanSubagentText(operational.runtimeStatus ?? run.status, "unknown"),
      activeSessions: asNumber(operational.activeSessions) ?? 1,
      liveRuns: asNumber(operational.liveRuns) ?? (raw.live === true ? 1 : 0),
      workerResults: asNumber(operational.workerResults) ?? mappedRoles.length,
      failedWorkerResults: asNumber(operational.failedWorkerResults) ?? 0,
      approvalRequiredRuns: asNumber(operational.approvalRequiredRuns) ?? (run.status === "waiting_approval" ? 1 : 0),
      deniedRuns: asNumber(operational.deniedRuns) ?? (run.status === "failed" ? 1 : 0),
      lastUpdatedAt: formatTimestamp(String(operational.lastUpdatedAt || run.updatedAt)),
    },
    actions: buildSubagentAutoActions(raw.actions, selectedSessionId),
    timeline: buildSubagentAutoTimeline(run, raw),
    receipts: buildSubagentAutoReceipts(raw),
    surface: {
      commandCenterPath: cleanSubagentText(asRecord(raw.surface)?.commandCenterPath ?? raw.commandCenterPath, "/control?sector=agents"),
      cliCommand: cleanSubagentText(asRecord(raw.surface)?.cliCommand ?? raw.cliCommand, "npm run zavorth:subagents -- status"),
      channelCommand: cleanSubagentText(asRecord(raw.surface)?.channelCommand ?? raw.channelCommand, "/agents status"),
      reviewHint: cleanSubagentText(
        asRecord(raw.surface)?.reviewHint ?? raw.reviewHint,
        "Revise roles, motivo, policy e receipts antes de permitir mutacao.",
      ),
    },
  };
}

function mapNaturalCapabilityDiscovery(
  run: UniversalAgentRun | null,
): DashboardNaturalCapabilityDiscoverySnapshot | null {
  const raw = asRecord(run?.metadata?.naturalCapabilityDiscovery);
  if (!raw) {
    return null;
  }
  const safety = asRecord(raw.safety) || {};
  const quarantine = asRecord(raw.quarantine) || {};
  const recommendations = Array.isArray(raw.recommendations) ? raw.recommendations : [];

  return {
    contractVersion: String(raw.contractVersion || "unknown"),
    generatedAt: formatTimestamp(String(raw.generatedAt || "")),
    intentCategory: String(raw.intentCategory || "unknown"),
    confidence: asNumber(raw.confidence) ?? 0,
    recommendedToolNames: asTextArray(raw.recommendedToolNames),
    groups: asTextArray(raw.groups),
    recommendations: recommendations.slice(0, 12).map((entry, index) => {
      const item = asRecord(entry) || {};
      const risk = normalizeDiscoveryRisk(item.risk);
      return {
        id: String(item.id || item.capabilityId || `capability-discovery-${index + 1}`),
        label: String(item.label || item.capabilityId || "Capability recomendada"),
        capabilityId: String(item.capabilityId || "").trim() || undefined,
        toolIds: asTextArray(item.toolIds),
        groups: asTextArray(item.groups),
        confidence: asNumber(item.confidence ?? item.score) ?? 0,
        risk,
        requiresApproval: item.requiresApproval === true || risk === "danger",
        previewRequired: item.previewRequired === true,
        reason: String(item.reason || "Inferida a partir do pedido em linguagem natural."),
        nextSafeAction: String(item.nextSafeAction || "Aplicar policy antes de executar qualquer tool."),
      };
    }),
    safety: {
      noExecutionPerformed: safety.noExecutionPerformed === true,
      naturalLanguageDoesNotBypassPolicy: safety.naturalLanguageDoesNotBypassPolicy === true,
      highestRisk: normalizeDiscoveryRisk(safety.highestRisk),
      requiresApproval: safety.requiresApproval === true,
      previewRequired: safety.previewRequired === true,
      approvalRequiredToolIds: asTextArray(safety.approvalRequiredToolIds),
      previewRequiredToolIds: asTextArray(safety.previewRequiredToolIds),
    },
    quarantine: {
      importedCapabilityTrustPresent: quarantine.importedCapabilityTrustPresent === true,
      quarantinedCount: asNumber(quarantine.quarantinedCount) ?? 0,
      blockedToolIds: asTextArray(quarantine.blockedToolIds),
      warning: String(quarantine.warning || "").trim() || null,
    },
    nextSafeAction: String(raw.nextSafeAction || "Responder diretamente ou pedir clarificacao."),
  };
}

function mapUniversalPreviewMode(
  run: UniversalAgentRun | null,
): DashboardUniversalPreviewModeSnapshot | null {
  const raw = asRecord(run?.metadata?.universalPreviewMode);
  if (!raw) {
    return null;
  }
  const risk = asRecord(raw.risk) || {};
  const safety = asRecord(raw.safety) || {};
  const toolExposure = asRecord(raw.toolExposure) || {};
  const planSteps = Array.isArray(raw.planSteps) ? raw.planSteps : [];
  const modeRaw = String(raw.mode || "").trim();
  const toolExposureModeRaw = String(toolExposure.mode || "").trim();
  const toolExposureMode = toolExposureModeRaw === "safe"
    || toolExposureModeRaw === "confirm"
    || toolExposureModeRaw === "restricted"
    || toolExposureModeRaw === "unknown"
    ? toolExposureModeRaw
    : "unknown";

  return {
    contractVersion: String(raw.contractVersion || "unknown"),
    generatedAt: formatTimestamp(String(raw.generatedAt || "")),
    mode: modeRaw === "runtime-preview" || modeRaw === "preview-only" ? modeRaw : "unknown",
    planSteps: planSteps.slice(0, 12).map((entry, index) => {
      const item = asRecord(entry) || {};
      const stepRisk = normalizePreviewRisk(item.risk);
      return {
        id: String(item.id || item.toolId || `universal-preview-step-${index + 1}`),
        kind: String(item.kind || "unknown"),
        label: String(item.label || item.toolId || "Etapa de preview"),
        toolId: String(item.toolId || "").trim() || undefined,
        risk: stepRisk,
        requiresApproval: item.requiresApproval === true || stepRisk === "danger",
        previewRequired: item.previewRequired === true,
        action: String(item.action || "Aplicar policy antes de executar."),
        impact: String(item.impact || "Impacto nao informado."),
      };
    }),
    toolExposure: {
      mode: toolExposureMode,
      exposedToolIds: asTextArray(toolExposure.exposedToolIds),
      blockedToolIds: asTextArray(toolExposure.blockedToolIds),
    },
    risk: {
      highestRisk: normalizePreviewRisk(risk.highestRisk),
      requiresApproval: risk.requiresApproval === true,
      previewRequired: risk.previewRequired === true,
      approvalRequiredToolIds: asTextArray(risk.approvalRequiredToolIds),
      previewRequiredToolIds: asTextArray(risk.previewRequiredToolIds),
    },
    safety: {
      noExecutionPerformed: safety.noExecutionPerformed === true,
      naturalLanguageDoesNotBypassPolicy: safety.naturalLanguageDoesNotBypassPolicy === true,
      workspacePolicyApplies: safety.workspacePolicyApplies === true,
      approvalsStillRequired: safety.approvalsStillRequired === true,
      selfmodApplyBlocked: safety.selfmodApplyBlocked === true,
      computerUseBlockedUntilApproval: safety.computerUseBlockedUntilApproval === true,
      executorBlockedInPreviewMode: safety.executorBlockedInPreviewMode === true,
      toolsActuallyCalled: asTextArray(safety.toolsActuallyCalled),
    },
    nextSafeAction: String(raw.nextSafeAction || "Confirmar escopo antes de executar."),
  };
}

function mapCapabilityNegotiation(
  run: UniversalAgentRun | null,
): DashboardCapabilityNegotiationSnapshot | null {
  const raw = asRecord(run?.metadata?.capabilityNegotiation);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardCapabilityNegotiationSnapshot;
}

function mapToolRehearsal(
  run: UniversalAgentRun | null,
): DashboardToolRehearsalSnapshot | null {
  const raw = asRecord(run?.metadata?.toolRehearsal);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardToolRehearsalSnapshot;
}

function mapSafetyNarrative(
  run: UniversalAgentRun | null,
): DashboardSafetyNarrativeSnapshot | null {
  const raw = asRecord(run?.metadata?.safetyNarrative);
  if (!raw) {
    return null;
  }
  const redaction = asRecord(raw.redaction) || {};
  const policy = asRecord(raw.policy) || {};
  const reasons = Array.isArray(raw.reasons) ? raw.reasons : [];
  const alternatives = Array.isArray(raw.alternatives) ? raw.alternatives : [];
  return {
    contractVersion: String(raw.contractVersion || "unknown"),
    generatedAt: formatTimestamp(String(raw.generatedAt || "")),
    status: normalizeSafetyNarrativeStatus(raw.status),
    highRiskBlockPresent: raw.highRiskBlockPresent === true,
    summary: String(raw.summary || "Safety Narrative disponivel."),
    userMessage: String(raw.userMessage || raw.summary || ""),
    reasons: reasons.slice(0, 12).map((entry, index) => {
      const item = asRecord(entry) || {};
      return {
        id: String(item.id || `safety-reason-${index + 1}`),
        kind: String(item.kind || "unknown"),
        title: String(item.title || "Motivo de seguranca"),
        detail: String(item.detail || "Detalhe nao informado."),
        risk: normalizeDiscoveryRisk(item.risk),
        source: String(item.source || "SafetyNarrativeService"),
        toolIds: asTextArray(item.toolIds),
        redactionApplied: item.redactionApplied === true,
      };
    }),
    alternatives: alternatives.slice(0, 8).map((entry, index) => {
      const item = asRecord(entry) || {};
      return {
        id: String(item.id || `safety-alternative-${index + 1}`),
        label: String(item.label || "Alternativa segura"),
        detail: String(item.detail || "Detalhe nao informado."),
        commandHint: String(item.commandHint || "").trim() || undefined,
        safe: item.safe !== false,
        requiresApproval: item.requiresApproval === true,
      };
    }),
    redaction: {
      pathRedactionApplied: redaction.pathRedactionApplied === true,
      secretRedactionApplied: redaction.secretRedactionApplied === true,
      sensitivePathCount: asNumber(redaction.sensitivePathCount) ?? 0,
      secretCount: asNumber(redaction.secretCount) ?? 0,
      rawSecretSerialized: redaction.rawSecretSerialized === true,
    },
    policy: {
      naturalLanguageDoesNotBypassPolicy: policy.naturalLanguageDoesNotBypassPolicy === true,
      alternativesDoNotExecute: policy.alternativesDoNotExecute === true,
      workspaceBoundaryRespected: policy.workspaceBoundaryRespected === true,
      approvalsRemainRequired: policy.approvalsRemainRequired === true,
      previewRemainsRequired: policy.previewRemainsRequired === true,
      quarantineRemainsRequired: policy.quarantineRemainsRequired === true,
    },
    nextSafeAction: String(raw.nextSafeAction || "Continuar pelo runtime governado."),
  };
}

function normalizeMemoryReceiptConfidenceLabel(
  value: unknown,
): DashboardMemoryWithReceiptsSnapshot["receipts"][number]["confidenceLabel"] {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "high") {
    return "high";
  }
  if (raw === "low") {
    return "low";
  }
  return "medium";
}

function normalizeMemoryLayer(value: unknown): DashboardMemorySignal["layer"] {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "episodic") {
    return "episodic";
  }
  if (raw === "semantic") {
    return "semantic";
  }
  if (raw === "procedural") {
    return "procedural";
  }
  return "working";
}

function mapMemoryWithReceipts(
  run: UniversalAgentRun | null,
): DashboardMemoryWithReceiptsSnapshot | null {
  const raw = asRecord(run?.metadata?.memoryWithReceipts);
  if (!raw) {
    return null;
  }
  const identifiers = asRecord(raw.identifiers) || {};
  const summary = asRecord(raw.summary) || {};
  const audit = asRecord(raw.audit) || {};
  const surface = asRecord(raw.surface) || {};
  const receipts = Array.isArray(raw.receipts) ? raw.receipts : [];
  return {
    contractVersion: String(raw.contractVersion || "unknown"),
    generatedAt: formatTimestamp(String(raw.generatedAt || "")),
    identifiers: {
      runId: String(identifiers.runId || ""),
      traceId: String(identifiers.traceId || ""),
      requestId: String(identifiers.requestId || ""),
      sessionId: String(identifiers.sessionId || ""),
    },
    summary: {
      memoryCount: asNumber(summary.memoryCount) ?? 0,
      receiptCount: asNumber(summary.receiptCount) ?? 0,
      layers: Array.isArray(summary.layers)
        ? summary.layers.map(normalizeMemoryLayer)
        : [],
      averageConfidence: asNumber(summary.averageConfidence) ?? null,
      lowConfidenceCount: asNumber(summary.lowConfidenceCount) ?? 0,
    },
    receipts: receipts.slice(0, 12).map((entry, index) => {
      const item = asRecord(entry) || {};
      const origin = asRecord(item.origin) || {};
      const actions = asRecord(item.actions) || {};
      return {
        id: String(item.id || `memory-receipt-${index + 1}`),
        memoryId: String(item.memoryId || item.id || `memory-${index + 1}`),
        title: String(item.title || "Memoria usada"),
        layer: normalizeMemoryLayer(item.layer),
        summary: String(item.summary || "Fonte de memoria disponivel."),
        source: String(item.source || "MemoryWithReceiptsService"),
        sourceType: String(item.sourceType || "unknown"),
        createdAt: formatTimestamp(String(item.createdAt || "")),
        confidence: asNumber(item.confidence) ?? 0,
        confidenceLabel: normalizeMemoryReceiptConfidenceLabel(item.confidenceLabel),
        observatoryReceiptId: String(item.observatoryReceiptId || "").trim() || undefined,
        origin: {
          kind: String(origin.kind || "unknown"),
          ref: String(origin.ref || "").trim() || null,
          artifactId: String(origin.artifactId || "").trim() || undefined,
          eventId: String(origin.eventId || "").trim() || undefined,
        },
        actions: {
          reviewCommand: String(actions.reviewCommand || "zavorth memory receipts"),
          askSourceCommand: String(actions.askSourceCommand || "zavorth memory source"),
          forgetCommand: String(actions.forgetCommand || "zavorth memory forget <id>"),
          correctCommand: String(actions.correctCommand || "zavorth memory correct <id> \"<novo valor>\""),
        },
      };
    }),
    audit: {
      allMemoryHasReceipt: audit.allMemoryHasReceipt === true,
      canAnswerSourceQuestion: audit.canAnswerSourceQuestion === true,
      canForgetOrCorrect: audit.canForgetOrCorrect === true,
      runObservatoryLinked: audit.runObservatoryLinked === true,
      noMemoryInvented: audit.noMemoryInvented !== false,
    },
    surface: {
      cliCommand: String(surface.cliCommand || "zavorth memory receipts --json"),
      commandCenterPath: String(surface.commandCenterPath || "/control?sector=dreams"),
      sourceQuestionHint: String(surface.sourceQuestionHint || "Pergunte de onde veio a memoria."),
    },
    nextSafeAction: String(raw.nextSafeAction || "Manter receipts de memoria visiveis."),
  };
}

function mapSelfingDashboard(
  run: UniversalAgentRun | null,
): DashboardSelfingDashboardSnapshot | null {
  const raw = asRecord(run?.metadata?.selfingDashboard);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardSelfingDashboardSnapshot;
}

function mapArtifactMemory(
  run: UniversalAgentRun | null,
): DashboardArtifactMemorySnapshot | null {
  const raw = asRecord(run?.metadata?.artifactMemory);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardArtifactMemorySnapshot;
}

function mapPersonalOpsAutopilot(
  run: UniversalAgentRun | null,
): DashboardPersonalOpsAutopilotSnapshot | null {
  const raw = asRecord(run?.metadata?.personalOpsAutopilot);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardPersonalOpsAutopilotSnapshot;
}

function mapAgentTeamCompiler(
  run: UniversalAgentRun | null,
): DashboardAgentTeamCompilerSnapshot | null {
  const raw = asRecord(run?.metadata?.agentTeamCompiler);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardAgentTeamCompilerSnapshot;
}

function mapCrossChannelContinuity(
  run: UniversalAgentRun | null,
): DashboardCrossChannelContinuitySnapshot | null {
  const raw = asRecord(run?.metadata?.crossChannelContinuity);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardCrossChannelContinuitySnapshot;
}

function mapAskBeforeAssumptionPolicy(
  run: UniversalAgentRun | null,
): DashboardAskBeforeAssumptionPolicySnapshot | null {
  const raw = asRecord(run?.metadata?.askBeforeAssumptionPolicy);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardAskBeforeAssumptionPolicySnapshot;
}

function mapProviderMeshConsolidation(
  run: UniversalAgentRun | null,
): DashboardProviderMeshConsolidationSnapshot | null {
  const raw = asRecord(run?.metadata?.providerMeshConsolidation);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardProviderMeshConsolidationSnapshot;
}

function mapUniversalIntentTrustEnforcement(
  run: UniversalAgentRun | null,
): DashboardUniversalIntentTrustEnforcementSnapshot | null {
  const raw = asRecord(run?.metadata?.universalIntentTrustEnforcement);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardUniversalIntentTrustEnforcementSnapshot;
}

function mapRunArtifactReceiptReplay(
  run: UniversalAgentRun | null,
): DashboardRunArtifactReceiptReplaySnapshot | null {
  const raw = asRecord(run?.metadata?.runArtifactReceiptReplay);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardRunArtifactReceiptReplaySnapshot;
}

function mapProductizationEvidence(
  run: UniversalAgentRun | null,
): DashboardProductizationEvidenceSnapshot | null {
  const raw = asRecord(run?.metadata?.productizationEvidence);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardProductizationEvidenceSnapshot;
}

function mapProductEntryRuntime(
  run: UniversalAgentRun | null,
): DashboardProductEntryRuntimeSnapshot | null {
  const raw = asRecord(run?.metadata?.productEntryRuntime);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardProductEntryRuntimeSnapshot;
}

function normalizeSkillMcpKind(value: unknown): DashboardSkillMcpQuarantineSnapshot["entries"][number]["kind"] {
  return String(value || "").trim().toLowerCase() === "mcp" ? "mcp" : "skill";
}

function normalizeSkillMcpTrustState(value: unknown): DashboardSkillMcpQuarantineSnapshot["entries"][number]["trustState"] {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "trusted" || raw === "safe" || raw === "quarantined") {
    return raw;
  }
  return "safe";
}

function normalizeSkillMcpRiskLevel(value: unknown): DashboardSkillMcpQuarantineSnapshot["entries"][number]["riskLevel"] {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "low" || raw === "medium" || raw === "high") {
    return raw;
  }
  return "medium";
}

function mapSkillMcpQuarantine(
  run: UniversalAgentRun | null,
): DashboardSkillMcpQuarantineSnapshot | null {
  const raw = asRecord(run?.metadata?.skillMcpQuarantine);
  if (!raw) {
    return null;
  }
  const identifiers = asRecord(raw.identifiers) || {};
  const summary = asRecord(raw.summary) || {};
  const policy = asRecord(raw.policy) || {};
  const surface = asRecord(raw.surface) || {};
  const entries = Array.isArray(raw.entries) ? raw.entries : [];
  const receipts = Array.isArray(raw.receipts) ? raw.receipts : [];
  return {
    contractVersion: String(raw.contractVersion || "unknown"),
    generatedAt: formatTimestamp(String(raw.generatedAt || "")),
    identifiers: {
      runId: String(identifiers.runId || ""),
      traceId: String(identifiers.traceId || ""),
      requestId: String(identifiers.requestId || ""),
      sessionId: String(identifiers.sessionId || ""),
    },
    summary: {
      total: asNumber(summary.total) ?? 0,
      trusted: asNumber(summary.trusted) ?? 0,
      safe: asNumber(summary.safe) ?? 0,
      quarantined: asNumber(summary.quarantined) ?? 0,
      reviewRequired: asNumber(summary.reviewRequired) ?? 0,
      blockedToolCount: asNumber(summary.blockedToolCount) ?? 0,
    },
    entries: entries.slice(0, 12).map((entry, index) => {
      const item = asRecord(entry) || {};
      const origin = asRecord(item.origin) || {};
      const actions = asRecord(item.actions) || {};
      return {
        id: String(item.id || `imported-capability-${index + 1}`),
        kind: normalizeSkillMcpKind(item.kind),
        trustState: normalizeSkillMcpTrustState(item.trustState),
        riskLevel: normalizeSkillMcpRiskLevel(item.riskLevel),
        quarantined: item.quarantined === true,
        requiresReview: item.requiresReview === true,
        canExposeToModel: item.canExposeToModel !== false,
        canExposeTools: item.canExposeTools !== false,
        toolNames: asTextArray(item.toolNames),
        reasons: asTextArray(item.reasons),
        origin: {
          source: String(origin.source || "runtime"),
          ref: String(origin.ref || "").trim() || null,
        },
        actions: {
          inspectCommand: String(actions.inspectCommand || "zavorth quarantine inspect <id>"),
          reviewCommand: String(actions.reviewCommand || "zavorth quarantine review <id>"),
          promoteCommand: String(actions.promoteCommand || "zavorth quarantine promote <id> --confirm"),
          keepQuarantinedCommand: String(actions.keepQuarantinedCommand || "zavorth quarantine keep <id>"),
        },
      };
    }),
    receipts: receipts.slice(0, 12).map((receipt, index) => {
      const item = asRecord(receipt) || {};
      const rawKind = String(item.kind || "").trim().toLowerCase();
      return {
        id: String(item.id || `quarantine-receipt-${index + 1}`),
        kind: rawKind === "policy" ? "policy" : normalizeSkillMcpKind(item.kind),
        detail: String(item.detail || "Receipt de quarentena."),
      };
    }),
    policy: {
      externalImportsNeverTrustedAutomatically: policy.externalImportsNeverTrustedAutomatically === true,
      quarantinedToolsHidden: policy.quarantinedToolsHidden === true,
      toolExposureGatedByImportedCapabilityTrust: policy.toolExposureGatedByImportedCapabilityTrust === true,
      noMarketplaceInstallPerformed: policy.noMarketplaceInstallPerformed === true,
      promotionsRequireExplicitOperatorAction: policy.promotionsRequireExplicitOperatorAction === true,
      naturalLanguageDoesNotBypassQuarantine: policy.naturalLanguageDoesNotBypassQuarantine === true,
    },
    surface: {
      cliCommand: String(surface.cliCommand || "zavorth quarantine --json"),
      commandCenterPath: String(surface.commandCenterPath || "/control?sector=skills"),
      reviewHint: String(surface.reviewHint || "Revisar origem e risco antes de promover."),
    },
    nextSafeAction: String(raw.nextSafeAction || "Manter quarantine ate review explicito."),
  };
}

function mapProviderArena(
  run: UniversalAgentRun | null,
): DashboardProviderArenaSnapshot | null {
  const raw = asRecord(run?.metadata?.providerArena);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardProviderArenaSnapshot;
}

function mapProviderCockpit(
  run: UniversalAgentRun | null,
  snapshot?: ZavorthAgentGatewaySnapshot | null,
): DashboardProviderCockpitSnapshot | null {
  const raw = asRecord(run?.metadata?.providerCockpit)
    || asRecord((snapshot as Record<string, unknown> | null | undefined)?.providerCockpit);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardProviderCockpitSnapshot;
}

function mapReleaseInstallerRollbackPath(
  run: UniversalAgentRun | null,
): DashboardReleaseInstallerRollbackPathSnapshot | null {
  const raw = asRecord(run?.metadata?.releaseInstallerRollbackPath);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardReleaseInstallerRollbackPathSnapshot;
}

function mapPublicSiteDocsDemoSync(
  run: UniversalAgentRun | null,
): DashboardPublicSiteDocsDemoSyncSnapshot | null {
  const raw = asRecord(run?.metadata?.publicSiteDocsDemoSync);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardPublicSiteDocsDemoSyncSnapshot;
}

function mapFeedbackTelemetryProductLoop(
  run: UniversalAgentRun | null,
): DashboardFeedbackTelemetryProductLoopSnapshot | null {
  const raw = asRecord(run?.metadata?.feedbackTelemetryProductLoop);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardFeedbackTelemetryProductLoopSnapshot;
}

function mapPublicAdoptionPilotLoop(
  run: UniversalAgentRun | null,
): DashboardPublicAdoptionPilotLoopSnapshot | null {
  const raw = asRecord(run?.metadata?.publicAdoptionPilotLoop);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardPublicAdoptionPilotLoopSnapshot;
}

function mapIntegrationShowcasePartnerSurface(
  run: UniversalAgentRun | null,
): DashboardIntegrationShowcasePartnerSurfaceSnapshot | null {
  const raw = asRecord(run?.metadata?.integrationShowcasePartnerSurface);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardIntegrationShowcasePartnerSurfaceSnapshot;
}

function mapReleaseAdoptionReadiness(
  run: UniversalAgentRun | null,
): DashboardReleaseAdoptionReadinessSnapshot | null {
  const raw = asRecord(run?.metadata?.releaseAdoptionReadiness);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardReleaseAdoptionReadinessSnapshot;
}

function mapReleaseCandidatePreCanaryGate(
  run: UniversalAgentRun | null,
): DashboardReleaseCandidatePreCanaryGateSnapshot | null {
  const raw = asRecord(run?.metadata?.releaseCandidatePreCanaryGate);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardReleaseCandidatePreCanaryGateSnapshot;
}

function mapBlueprintCompletionGate(
  run: UniversalAgentRun | null,
): DashboardBlueprintCompletionGateSnapshot | null {
  const raw = asRecord(run?.metadata?.blueprintCompletionGate);
  if (!raw) {
    return null;
  }
  return raw as unknown as DashboardBlueprintCompletionGateSnapshot;
}

function mapRunObservatory(
  snapshot: UniversalAgentRunObservatorySnapshot | null | undefined,
): DashboardRunObservatorySnapshot | null {
  if (!snapshot) {
    return null;
  }
  return {
    contractVersion: snapshot.contractVersion,
    generatedAt: formatTimestamp(snapshot.generatedAt),
    query: snapshot.query,
    totalRuns: snapshot.totalRuns,
    matchedRuns: snapshot.matchedRuns,
    summary: snapshot.summary,
    health: snapshot.health,
    indexes: {
      runIds: snapshot.indexes.runIds,
      traceIds: snapshot.indexes.traceIds,
      sessionIds: snapshot.indexes.sessionIds,
      statuses: snapshot.indexes.statuses.map((entry) => ({
        status: mapAgentRunStatus(entry.status),
        count: entry.count,
      })),
    },
    runSummaries: snapshot.runSummaries.map((entry) => ({
      id: entry.id,
      traceId: entry.traceId,
      requestId: entry.requestId,
      sessionId: entry.sessionId,
      title: entry.title,
      status: mapAgentRunStatus(entry.status),
      channel: entry.channel,
      providerLabel: entry.providerLabel,
      modelLabel: entry.modelLabel,
      eventCount: entry.eventCount,
      artifactCount: entry.artifactCount,
      approvalCount: entry.approvalCount,
      pendingApprovalCount: entry.pendingApprovalCount,
      memorySignalCount: entry.memorySignalCount,
      receiptCount: entry.receiptCount,
      replayable: entry.replayable,
      hasError: entry.hasError,
      firstEventAt: entry.firstEventAt ? formatTimestamp(entry.firstEventAt) : null,
      lastEventAt: formatTimestamp(entry.lastEventAt),
    })),
    runs: snapshot.runs.map((entry) => ({
      id: entry.run.id,
      traceId: entry.run.traceId,
      requestId: entry.run.requestId,
      sessionId: entry.run.sessionId,
      title: entry.run.title,
      status: mapAgentRunStatus(entry.run.status),
      summary: entry.run.summary,
      updatedAt: formatTimestamp(entry.run.updatedAt),
      providerLabel: entry.run.modelProfile.providerLabel,
      modelLabel: entry.run.modelProfile.modelLabel,
      eventCount: entry.run.events.length,
      artifactCount: entry.run.artifacts.length,
      approvalCount: entry.run.approvals.length,
      matchedBy: entry.matchedBy,
    })),
    timeline: snapshot.timeline.map((entry) => ({
      id: entry.id,
      runId: entry.runId,
      traceId: entry.traceId,
      sessionId: entry.sessionId,
      kind: entry.kind,
      source: entry.kind,
      title: entry.title,
      detail: entry.detail,
      status: entry.status,
      createdAt: formatTimestamp(entry.createdAt),
      relativeOrder: entry.relativeOrder,
      receiptId: entry.receiptId,
    })),
    receipts: snapshot.receipts.map((receipt) => ({
      id: receipt.id,
      runId: receipt.runId,
      traceId: receipt.traceId,
      sessionId: receipt.sessionId,
      kind: receipt.kind,
      source: receipt.source,
      title: receipt.title,
      detail: receipt.detail,
      status: receipt.status,
      createdAt: formatTimestamp(receipt.createdAt),
    })),
    diffPreviews: snapshot.diffPreviews.map((preview) => ({
      ...preview,
      actions: {
        ...preview.actions,
      },
    })),
    intelligenceFabricHealth: snapshot.intelligenceFabricHealth,
    llmTelemetry: (snapshot as any).llmTelemetry,
    sidecars: snapshot.sidecars,
    replay: {
      ...snapshot.replay,
      anchors: snapshot.replay.anchors.map((anchor) => ({
        ...anchor,
        createdAt: formatTimestamp(anchor.createdAt),
      })),
    },
    surface: snapshot.surface,
  };
}

function mapSession(run: UniversalAgentRun, activeRunId: string | null): DashboardSessionSummary {
  const status: DashboardSessionSummary["status"] = run.id === activeRunId
    ? "active"
    : run.status === "failed" || run.status === "waiting_approval"
      ? "blocked"
      : run.status === "completed" || run.status === "cancelled"
        ? "closed"
        : "idle";

  return {
    id: run.sessionId,
    title: run.title,
    updatedAt: formatTimestamp(run.updatedAt),
    status,
    channelLabel: run.channel,
    messageCount: 2,
  };
}

function mapTask(run: UniversalAgentRun): DashboardTaskSummary {
  return {
    id: run.id,
    title: run.title,
    status: mapAgentRunStatus(run.status),
    summary: run.summary,
    runId: run.id,
    sessionId: run.sessionId,
    currentStep: run.status,
    updatedAt: formatTimestamp(run.updatedAt),
  };
}

function mapApproval(approval: UniversalApprovalRequest): DashboardApprovalSummary {
  return {
    id: approval.id,
    runId: approval.runId,
    title: approval.title,
    reason: approval.reason,
    risk: approval.risk,
    status: approval.status === "approved"
      ? "approved"
      : approval.status === "rejected"
        ? "rejected"
        : "pending",
    command: `approve ${approval.id}`,
    createdAt: formatTimestamp(approval.createdAt),
  };
}

function mapArtifact(artifact: UniversalArtifactSummary): DashboardArtifactSummary {
  return {
    id: artifact.id,
    title: artifact.title,
    kind: artifact.kind,
    createdAt: formatTimestamp(artifact.createdAt),
    sessionId: artifact.sessionId,
    status: artifact.status,
  };
}

function mapMemorySignal(signal: UniversalMemorySignal): DashboardMemorySignal {
  return {
    id: signal.id,
    title: signal.title,
    layer: signal.layer,
    summary: signal.summary,
    confidence: signal.confidence,
  };
}

function buildMessages(run: UniversalAgentRun | null): DashboardChatMessage[] {
  if (!run) {
    return [];
  }

  return [
    {
      id: `${run.id}:input`,
      role: "user",
      text: run.input,
      createdAt: formatTimestamp(run.createdAt),
      modelLabel: run.modelProfile.modelLabel,
    },
    {
      id: `${run.id}:summary`,
      role: "assistant",
      text: run.summary,
      createdAt: formatTimestamp(run.updatedAt),
      modelLabel: run.modelProfile.modelLabel,
      events: run.events.map(mapEvent),
    },
  ];
}

function mapWorkflowJob(job: UniversalAgentWorkflowJob): Record<string, unknown> {
  return {
    ...job,
    title: job.request?.text || "Retomada duravel",
    summary: job.lastError
      || (job.status === "queued"
        ? "Job aprovado aguardando worker/executor."
        : "Job duravel do Universal Agent Runtime."),
  };
}

function buildRuntimeWarnings(
  run: UniversalAgentRun | null,
  workflowJobs: UniversalAgentWorkflowJob[],
): string[] {
  const warnings: string[] = [];
  if (run?.status === "waiting_approval") {
    warnings.push("Ha uma aprovacao pendente antes de continuar.");
  }
  if (run?.status === "failed") {
    warnings.push(run.summary || "A execucao ativa falhou.");
  }
  if (workflowJobs.some((job) => job.status === "failed")) {
    warnings.push("Existe job duravel com falha na fila.");
  }
  if (workflowJobs.some((job) => job.status === "queued")) {
    warnings.push("Existe job aprovado aguardando worker/executor.");
  }
  return warnings;
}

function buildHealth(
  status: DashboardRuntimeStatus,
  run: UniversalAgentRun | null,
  workflowJobs: UniversalAgentWorkflowJob[],
): DashboardHealthSnapshot {
  const checks: DashboardHealthSnapshot["checks"] = [
    {
      id: "agent-gateway",
      label: "Zavorth Agent Gateway",
      status,
      detail: run ? `Run ativo: ${run.status}.` : "Gateway sem run ativo.",
      actionId: status === "ready" ? undefined : "runtime.doctor",
    },
  ];

  if (run?.approvals.some((approval) => approval.status === "pending")) {
    checks.push({
      id: "approval-gate",
      label: "Approval gate",
      status: "degraded",
      detail: "Existe acao sensivel aguardando confirmacao.",
      actionId: "approvals.open",
    });
  }

  if (workflowJobs.length > 0) {
    checks.push({
      id: "workflow-queue",
      label: "Workflow queue",
      status: workflowJobs.some((job) => job.status === "failed") ? "blocked" : "degraded",
      detail: `${workflowJobs.length} job(s) duravel(is) no snapshot.`,
      actionId: "runtime.status",
    });
  }

  return {
    status,
    summary: status === "ready"
      ? "Runtime universal sem bloqueios relevantes."
      : "Runtime universal precisa de atencao.",
    checks,
  };
}

export function buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot(
  snapshot: ZavorthAgentGatewaySnapshot,
): CommandCenterRuntimeProjection {
  const activeRun = snapshot.activeRun;
  const runtimeStatus = mapRuntimeStatus(activeRun);
  const activeRunId = activeRun?.id || null;
  const workflowJobs = snapshot.workflowJobs || [];
  const modelProfile = mapModelProfile(activeRun);
  const toolExposure = mapToolExposureProfile(activeRun);

  return {
    projectionVersion: COMMAND_CENTER_RUNTIME_PROJECTION_VERSION,
    generatedAt: snapshot.generatedAt,
    adapterSource: {
      kind: snapshot.source.kind,
      label: snapshot.source.label,
      version: COMMAND_CENTER_RUNTIME_PROJECTION_VERSION,
    },
    runtimeStatus,
    wsStatus: "connected",
    runtime: {
      status: runtimeStatus,
      provider: modelProfile?.providerLabel,
      model: modelProfile?.modelLabel,
    },
    activeSessionId: activeRun?.sessionId || null,
    effectiveSessionId: activeRun?.sessionId || null,
    productModeId: "agent",
    productModeLabel: "agent",
    agentRun: mapAgentRun(activeRun),
    sessions: snapshot.runs.map((run) => mapSession(run, activeRunId)),
    messages: buildMessages(activeRun),
    tasks: snapshot.runs.map(mapTask),
    events: activeRun?.events.map(mapEvent) || [],
    approvals: activeRun?.approvals
      .filter((approval) => approval.status === "pending")
      .map(mapApproval) || [],
    artifacts: activeRun?.artifacts.map(mapArtifact) || [],
    memorySignals: activeRun?.memorySignals.map(mapMemorySignal) || [],
    capabilities: toolExposure.tools,
    toolExposure,
    budget: mapBudget(activeRun),
    runObservatory: mapRunObservatory(snapshot.runObservatory),
    naturalFirstRuntime: mapNaturalFirstRuntime(activeRun),
    capabilityDiscovery: mapNaturalCapabilityDiscovery(activeRun),
    universalPreviewMode: mapUniversalPreviewMode(activeRun),
    capabilityNegotiation: mapCapabilityNegotiation(activeRun),
    toolRehearsal: mapToolRehearsal(activeRun),
    safetyNarrative: mapSafetyNarrative(activeRun),
    memoryWithReceipts: mapMemoryWithReceipts(activeRun),
    selfingDashboard: mapSelfingDashboard(activeRun),
    artifactMemory: mapArtifactMemory(activeRun),
    personalOpsAutopilot: mapPersonalOpsAutopilot(activeRun),
    agentTeamCompiler: mapAgentTeamCompiler(activeRun),
    crossChannelContinuity: mapCrossChannelContinuity(activeRun),
    askBeforeAssumptionPolicy: mapAskBeforeAssumptionPolicy(activeRun),
    providerMeshConsolidation: mapProviderMeshConsolidation(activeRun),
    universalIntentTrustEnforcement: mapUniversalIntentTrustEnforcement(activeRun),
    runArtifactReceiptReplay: mapRunArtifactReceiptReplay(activeRun),
    productizationEvidence: mapProductizationEvidence(activeRun),
    productEntryRuntime: mapProductEntryRuntime(activeRun),
    releaseInstallerRollbackPath: mapReleaseInstallerRollbackPath(activeRun),
    publicSiteDocsDemoSync: mapPublicSiteDocsDemoSync(activeRun),
    feedbackTelemetryProductLoop: mapFeedbackTelemetryProductLoop(activeRun),
    publicAdoptionPilotLoop: mapPublicAdoptionPilotLoop(activeRun),
    integrationShowcasePartnerSurface: mapIntegrationShowcasePartnerSurface(activeRun),
    releaseAdoptionReadiness: mapReleaseAdoptionReadiness(activeRun),
    releaseCandidatePreCanaryGate: mapReleaseCandidatePreCanaryGate(activeRun),
    blueprintCompletionGate: mapBlueprintCompletionGate(activeRun),
    skillMcpQuarantine: mapSkillMcpQuarantine(activeRun),
    providerArena: mapProviderArena(activeRun),
    providerCockpit: mapProviderCockpit(activeRun, snapshot),
    subagentAutoInvocation: mapSubagentAutoInvocation(activeRun),
    perceptionControl: mapPerceptionControlProjection(activeRun),
    replay: activeRun
      ? {
        id: `${activeRun.id}:replay`,
        runId: activeRun.id,
        title: "Replay da execucao",
        status: activeRun.events.length > 0 || activeRun.artifacts.length > 0 ? "available" : "none",
        summary: activeRun.events.length > 0 || activeRun.artifacts.length > 0
          ? "Eventos e artifacts desta execucao podem ser revisitados."
          : "Nenhum replay real foi produzido ainda.",
        eventCount: activeRun.events.length,
        artifactCount: activeRun.artifacts.length,
        updatedAt: formatTimestamp(activeRun.updatedAt),
      }
      : null,
    replyPorts: activeRun?.replyPorts.map(mapReplyPort) || [
      {
        id: "command-center",
        label: "Command Center",
        kind: "web",
        status: "available",
        primary: true,
        description: "Resposta atual no painel web /control.",
      },
    ],
    modelProfile,
    health: buildHealth(runtimeStatus, activeRun, workflowJobs),
    releaseStatus: null,
    integrations: [
      {
        id: "agent-gateway",
        label: "Zavorth Agent Gateway",
        category: "runtime",
        status: runtimeStatus === "blocked" ? "degraded" : "connected",
        detail: snapshot.source.label,
      },
    ],
    identity: null,
    logs: activeRun?.events.map((event) => ({
      id: `${event.id}:log`,
      level: event.status === "failed" ? "error" : "info",
      source: `agent.${event.kind}`,
      message: event.detail || event.title,
      createdAt: event.createdAt,
      runId: activeRun.id,
    })) || [],
    workflowJobs: workflowJobs.map(mapWorkflowJob),
    runtimeWarnings: buildRuntimeWarnings(activeRun, workflowJobs),
  };
}
