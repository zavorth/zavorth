import type {
  DashboardAgentEvent,
  DashboardAgentRun,
  DashboardAgentRunStatus,
  DashboardApprovalSummary,
  DashboardArtifactSummary,
  DashboardBlocker,
  DashboardBudgetSnapshot,
  DashboardChatMessage,
  DashboardCommandAction,
  DashboardCommandCenterViewModel,
  DashboardHealthCheck,
  DashboardHealthSnapshot,
  DashboardIdentitySnapshot,
  DashboardIntegrationSummary,
  DashboardLogEntry,
  DashboardMemorySignal,
  DashboardModelProfile,
  DashboardNavigationSector,
  DashboardReplyPort,
  DashboardReplyPortStatus,
  DashboardReleaseStatus,
  DashboardReplaySummary,
  DashboardRuntimeAdapterSource,
  DashboardRuntimeSnapshot,
  DashboardRuntimeStatus,
  DashboardSessionSummary,
  DashboardTaskSummary,
  DashboardToolExposure,
  DashboardToolExposureProfile,
} from "../contracts";
import {
  buildTraceSnapshot,
  mapTraceEntry,
  mapMessageEvent,
  normalizeEventStatus,
} from "./dashboardCommandCenterTraceAdapter";
import {
  asCommandCenterTextArray as asTextArray,
  inferCommandCenterBudgetStatus as inferBudgetStatus,
  resolveCommandCenterAgentRun as resolveAgentRun,
  resolveCommandCenterAgentRunMetadata as resolveAgentRunMetadata,
  resolveCommandCenterModelPickerSelection as resolveModelPickerSelection,
  resolveCommandCenterProviderRouteBudgetCorrelation as resolveProviderRouteBudgetCorrelation,
  resolveCommandCenterRunBudget as resolveRunBudget,
  summarizeCommandCenterBudget as summarizeBudget,
} from "./dashboardCommandCenterRunObservability";
import { buildDashboardRunObservatory } from "./dashboardCommandCenterRunObservatory";
import {
  asArray,
  asNumber,
  asRecord,
  asText,
  formatTimestamp,
  normalizeMemoryLayer,
  normalizeToolRisk,
  type DashboardCommandCenterAdapterInput,
  type LooseRecord,
} from "./dashboardCommandCenterAdapterShared";
import {
  buildCapabilityNegotiation,
  buildNaturalCapabilityDiscovery,
  buildSafetyNarrative,
  buildToolRehearsal,
  buildUniversalPreviewMode,
} from "./dashboardCommandCenterAdapterCapabilitySnapshots";
import {
  buildNaturalFirstRuntime,
} from "./dashboardCommandCenterAdapterNaturalFirst";
import {
  buildArtifactMemory,
  buildMemoryWithReceipts,
  buildPersonalOpsAutopilot,
  buildSelfingDashboard,
} from "./dashboardCommandCenterAdapterMemorySnapshots";
import {
  buildAgentTeamCompiler,
  buildAskBeforeAssumptionPolicy,
  buildCrossChannelContinuity,
} from "./dashboardCommandCenterAdapterTeamSnapshots";
import {
  buildBlueprintCompletionGate,
  buildFeedbackTelemetryProductLoop,
  buildIntegrationShowcasePartnerSurface,
  buildPublicAdoptionPilotLoop,
  buildPublicSiteDocsDemoSync,
  buildProductEntryRuntime,
  buildProductizationEvidence,
  buildProviderMeshConsolidation,
  buildReleaseAdoptionReadiness,
  buildReleaseCandidatePreCanaryGate,
  buildReleaseInstallerRollbackPath,
  buildRunArtifactReceiptReplay,
  buildUniversalIntentTrustEnforcement,
} from "./dashboardCommandCenterAdapterProductSnapshots";
import {
  buildProviderCockpit,
  buildProviderArena,
  buildSkillMcpQuarantine,
} from "./dashboardCommandCenterAdapterProviderSnapshots";
import { buildSubagentAutoInvocation } from "./dashboardCommandCenterSubagentSnapshots";
import { buildNexusWorkbench } from "./dashboardCommandCenterNexusWorkbenchAdapter";

// Agent Team Compiler QA keeps summary.roleCount visible through this adapter boundary.

function normalizeRuntimeStatus(input: DashboardCommandCenterAdapterInput): DashboardRuntimeStatus {
  if (input.error) {
    return "blocked";
  }
  if (input.wsStatus === "disconnected") {
    return "offline";
  }
  const raw = asText(input.runtimeStatus ?? input.runtime?.status ?? input.runtime?.gateway?.status).toLowerCase();
  if (["offline", "down", "stopped", "unreachable"].includes(raw)) {
    return "offline";
  }
  if (["blocked", "failed", "error", "fatal"].includes(raw)) {
    return "blocked";
  }
  if (["degraded", "warning", "warn", "partial"].includes(raw)) {
    return "degraded";
  }
  if (asArray(input.runtimeWarnings).length > 0 || asArray(input.approvals).length > 0) {
    return "degraded";
  }
  return "ready";
}

function buildRuntimeBlockers(input: DashboardCommandCenterAdapterInput): DashboardBlocker[] {
  const blockers: DashboardBlocker[] = [];

  if (input.error) {
    blockers.push({
      id: "control-error",
      title: "Control UI bloqueada",
      detail: input.error,
      severity: "danger",
      actionId: "runtime.doctor",
    });
  }

  asArray<string>(input.runtimeWarnings).slice(0, 6).forEach((warning, index) => {
    blockers.push({
      id: `runtime-warning-${index}`,
      title: "Aviso do runtime",
      detail: asText(warning, "Aviso sem detalhe."),
      severity: "warning",
      actionId: "runtime.doctor",
    });
  });

  const approvals = asArray(input.approvals);
  if (approvals.length > 0) {
    blockers.push({
      id: "pending-approvals",
      title: "Aprovacoes pendentes",
      detail: `${approvals.length} ${approvals.length === 1 ? "acao precisa" : "acoes precisam"} da sua confirmacao.`,
      severity: "warning",
      actionId: "approvals.open",
    });
  }

  return blockers;
}

function resolveProviderLabel(input: DashboardCommandCenterAdapterInput): string {
  const selected = resolveModelPickerSelection(input);
  const runtime = input.runtime;
  const state = input.state;
  return asText(
    selected?.providerLabel
      ?? selected?.providerName
      ?? runtime?.provider
      ?? runtime?.providerLabel
      ?? runtime?.gateway?.provider
      ?? state?.gateway?.provider
      ?? state?.productMode?.providerLabel,
    "provider nao informado",
  );
}

function resolveModelLabel(input: DashboardCommandCenterAdapterInput): string {
  const selected = resolveModelPickerSelection(input);
  return asText(
    selected?.modelLabel
      ?? selected?.modelName
      ?? input.runtime?.model
      ?? input.runtime?.modelLabel
      ?? input.runtime?.gateway?.model
      ?? input.state?.gateway?.model
      ?? input.state?.productMode?.modelLabel
      ?? input.productModeLabel,
    "modelo nao informado",
  );
}

function buildRuntimeSnapshot(input: DashboardCommandCenterAdapterInput): DashboardRuntimeSnapshot {
  const status = normalizeRuntimeStatus(input);
  const blockers = buildRuntimeBlockers(input);
  const activeSessionId = asText(input.effectiveSessionId ?? input.activeSessionId);
  const modeLabel = asText(input.productModeLabel, asText(input.productModeId, "chat"));

  return {
    status,
    operatorLabel: asText(input.state?.operator?.label ?? input.state?.user?.label, "Operador"),
    currentModelLabel: resolveModelLabel(input),
    currentProviderLabel: resolveProviderLabel(input),
    activeSessionId: activeSessionId || undefined,
    summary: status === "ready"
      ? `Zavorth pronto em modo ${modeLabel}.`
      : "Zavorth precisa de atencao antes de operar com confianca.",
    blockers,
    wsStatus: input.wsStatus ?? "disconnected",
  };
}

function buildAdapterSource(input: DashboardCommandCenterAdapterInput): DashboardRuntimeAdapterSource {
  const rawKind = asText(input.adapterSource?.kind ?? input.runtime?.adapterSource?.kind).toLowerCase();
  const kind: DashboardRuntimeAdapterSource["kind"] =
    rawKind === "universal-agent-runtime"
      ? "universal-agent-runtime"
      : rawKind === "legacy-runtime"
        ? "legacy-runtime"
        : rawKind === "unknown"
          ? "unknown"
          : "control-page";

  return {
    kind,
    label: asText(
      input.adapterSource?.label ?? input.runtime?.adapterSource?.label,
      kind === "universal-agent-runtime" ? "Zavorth Agent Gateway" : "Control Page Adapter",
    ),
    version: asText(input.adapterSource?.version ?? input.runtime?.adapterSource?.version) || undefined,
    notes: asText(input.adapterSource?.notes ?? input.runtime?.adapterSource?.notes) || undefined,
  };
}

function normalizeAgentRunStatus(
  value: unknown,
  input: DashboardCommandCenterAdapterInput,
): DashboardAgentRunStatus {
  const statusRaw = asText(value).toLowerCase();
  if (statusRaw.includes("cancel")) {
    return "cancelled";
  }
  if (statusRaw.includes("fail") || statusRaw.includes("error")) {
    return "failed";
  }
  if (statusRaw.includes("approval") || statusRaw.includes("wait")) {
    return "waiting_approval";
  }
  if (statusRaw.includes("queue") || statusRaw.includes("pending")) {
    return "queued";
  }
  if (statusRaw.includes("think") || statusRaw.includes("reason")) {
    return "thinking";
  }
  if (statusRaw.includes("run") || statusRaw.includes("progress")) {
    return "running";
  }
  if (statusRaw.includes("complete") || statusRaw.includes("done") || statusRaw.includes("success")) {
    return "completed";
  }
  if (input.error) {
    return "failed";
  }
  if (asArray(input.approvals).length > 0) {
    return "waiting_approval";
  }
  if (input.sending) {
    return "thinking";
  }
  return "idle";
}

function eventTitleExists(events: DashboardAgentEvent[], title: string): boolean {
  const normalized = title.toLowerCase();
  return events.some((event) => event.title.toLowerCase() === normalized);
}

function buildModelPickerEvent(
  input: DashboardCommandCenterAdapterInput,
  existingEvents: DashboardAgentEvent[],
): DashboardAgentEvent[] {
  if (eventTitleExists(existingEvents, "Model Picker aplicado")) {
    return [];
  }
  const selection = resolveModelPickerSelection(input);
  if (!selection) {
    return [];
  }
  const provider = asText(selection.providerLabel ?? selection.providerName, "provider nao informado");
  const model = asText(selection.modelLabel ?? selection.modelName, "modelo nao informado");
  const source = asText(selection.source ?? selection.selectionSource);
  const readiness = asText(selection.readiness);
  return [
    {
      id: "agent-run-model-picker",
      kind: "status",
      title: "Model Picker aplicado",
      detail: [
        `${provider}/${model}`,
        source ? `fonte ${source}` : "",
        readiness ? `readiness ${readiness}` : "",
      ].filter(Boolean).join("; "),
      status: "done",
    },
  ];
}

function buildBudgetEvent(
  input: DashboardCommandCenterAdapterInput,
  existingEvents: DashboardAgentEvent[],
): DashboardAgentEvent[] {
  if (eventTitleExists(existingEvents, "Budget do run calculado")) {
    return [];
  }
  const raw = resolveRunBudget(input);
  if (!raw) {
    return [];
  }
  const reason = asText(raw.reason ?? raw.allReasons?.[0]);
  const summary = summarizeBudget(raw);
  return [
    {
      id: "agent-run-budget",
      kind: "status",
      title: "Budget do run calculado",
      detail: asText(raw.summary ?? raw.description, [summary, reason ? `motivo ${reason}` : ""].filter(Boolean).join("; ")),
      status: normalizeBudgetStatus(raw.status ?? raw.state ?? (raw.degraded === true ? "exceeded" : "ok")) === "exceeded"
        ? "failed"
        : "done",
    },
  ];
}

function buildRouteCorrelationEvent(
  input: DashboardCommandCenterAdapterInput,
  existingEvents: DashboardAgentEvent[],
): DashboardAgentEvent[] {
  if (
    eventTitleExists(existingEvents, "Rota LLM correlacionada")
    || eventTitleExists(existingEvents, "Rota e budget correlacionados")
  ) {
    return [];
  }
  const correlation = resolveProviderRouteBudgetCorrelation(input)
    || asRecord(resolveAgentRunMetadata(input)?.llmRuntimeRoute);
  if (!correlation) {
    return [];
  }
  const provider = asText(correlation.providerLabel ?? correlation.providerName, "provider nao informado");
  const model = asText(correlation.modelLabel ?? correlation.modelName);
  const routingPolicy = asText(correlation.routingPolicy ?? correlation.routeSource);
  const fallbackUsed = correlation.fallbackUsed === true ? "fallback usado" : "";
  return [
    {
      id: "agent-run-route-budget",
      kind: "status",
      title: "Rota e budget correlacionados",
      detail: [
        model ? `${provider}/${model}` : provider,
        routingPolicy ? `rota ${routingPolicy}` : "",
        fallbackUsed,
      ].filter(Boolean).join("; "),
      status: "done",
    },
  ];
}

function dedupeEvents(events: DashboardAgentEvent[]): DashboardAgentEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = event.id || `${event.title}:${event.detail || ""}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildAgentRun(
  input: DashboardCommandCenterAdapterInput,
  runtime: DashboardRuntimeSnapshot,
  events: DashboardAgentEvent[],
): DashboardAgentRun | null {
  const activeSessionId = asText(input.effectiveSessionId ?? input.activeSessionId);
  const rawRun = resolveAgentRun(input);
  const shouldExposeCurrentRun = Boolean(
    rawRun
      || activeSessionId
      || input.sending
      || input.error
      || asArray(input.toolRuns).length > 0
      || asArray(input.approvals).length > 0,
  );

  if (!shouldExposeCurrentRun) {
    return null;
  }

  const runStatus = normalizeAgentRunStatus(
    rawRun?.status ?? rawRun?.state ?? rawRun?.phase,
    input,
  );
  const title = asText(
    rawRun?.title ?? rawRun?.label ?? rawRun?.goal,
    runStatus === "idle" ? "Sessao atual" : "Execucao atual",
  );
  const rawEvents = asArray<LooseRecord>(rawRun?.events).map(mapMessageEvent);
  const inputEvents = asArray<LooseRecord>(input.agentEvents).map(mapMessageEvent);
  const metadataEvents = [
    ...buildModelPickerEvent(input, rawEvents),
    ...buildBudgetEvent(input, rawEvents),
    ...buildRouteCorrelationEvent(input, rawEvents),
  ];
  const allEvents = dedupeEvents([
    ...rawEvents,
    ...inputEvents,
    ...metadataEvents,
    ...events,
  ]).slice(0, 24);
  const runIdentity = {
    id: asText(rawRun?.id ?? rawRun?.runId ?? rawRun?.agentRunId, activeSessionId || "current-agent-run"),
    traceId: asText(rawRun?.traceId) || undefined,
    sessionId: asText(rawRun?.sessionId ?? activeSessionId) || undefined,
  };
  const trace = buildTraceSnapshot(input, runIdentity, allEvents);

  return {
    id: runIdentity.id,
    traceId: runIdentity.traceId,
    requestId: asText(rawRun?.requestId) || undefined,
    title,
    status: runStatus,
    sessionId: runIdentity.sessionId,
    startedAt: rawRun?.startedAt ? formatTimestamp(rawRun.startedAt) : undefined,
    updatedAt: formatTimestamp(rawRun?.updatedAt ?? rawRun?.timestamp ?? new Date().toISOString()),
    summary: asText(
      rawRun?.summary ?? rawRun?.description,
      runStatus === "idle"
        ? "Nenhuma execucao ativa no momento."
        : "Zavorth esta trabalhando na solicitacao atual.",
    ),
    providerLabel: runtime.currentProviderLabel,
    modelLabel: runtime.currentModelLabel,
    events: allEvents,
    trace,
    metadata: asRecord(rawRun?.metadata) || undefined,
  };
}

function mapTask(entry: LooseRecord, index: number, input: DashboardCommandCenterAdapterInput): DashboardTaskSummary {
  const status = normalizeAgentRunStatus(entry.status ?? entry.state ?? entry.phase, input);
  const runId = asText(entry.runId ?? entry.agentRunId ?? entry.workflowRunId ?? entry.id);
  return {
    id: asText(entry.taskId ?? entry.id ?? entry.runId ?? entry.workflowJobId, `task-${index + 1}`),
    title: asText(entry.title ?? entry.goal ?? entry.label ?? entry.input, "Tarefa do runtime"),
    status,
    summary: asText(
      entry.summary ?? entry.description ?? entry.detail,
      status === "completed"
        ? "Tarefa concluida."
        : status === "waiting_approval"
          ? "Tarefa aguardando aprovacao."
          : "Tarefa registrada no cockpit operacional.",
    ),
    runId: runId || undefined,
    sessionId: asText(entry.sessionId) || undefined,
    currentStep: asText(entry.currentStep ?? entry.step ?? entry.phase) || undefined,
    updatedAt: formatTimestamp(entry.updatedAt ?? entry.createdAt ?? entry.timestamp),
  };
}

function mapWorkflowJobTask(entry: LooseRecord, index: number, input: DashboardCommandCenterAdapterInput): DashboardTaskSummary {
  const status = normalizeAgentRunStatus(entry.status ?? entry.state, input);
  return {
    id: asText(entry.id ?? entry.workflowJobId, `workflow-job-${index + 1}`),
    title: asText(entry.title, "Retomada duravel"),
    status,
    summary: asText(
      entry.summary ?? entry.lastError,
      status === "queued"
        ? "Approval aprovado e aguardando worker/executor disponivel."
        : "Job duravel do Universal Agent Runtime.",
    ),
    runId: asText(entry.runId) || undefined,
    sessionId: asText(entry.request?.sessionId) || undefined,
    currentStep: asText(entry.kind, "resume_after_approval"),
    updatedAt: formatTimestamp(entry.updatedAt ?? entry.createdAt),
  };
}

function buildTasks(input: DashboardCommandCenterAdapterInput, agentRun: DashboardAgentRun | null): DashboardTaskSummary[] {
  const rawTasks = [
    ...asArray<LooseRecord>(input.taskEntries),
    ...asArray<LooseRecord>(input.tasks),
    ...asArray<LooseRecord>(input.runtime?.tasks),
    ...asArray<LooseRecord>(input.state?.tasks),
  ].map((entry, index) => mapTask(entry, index, input));
  const workflowTasks = asArray<LooseRecord>(input.workflowJobs)
    .map((entry, index) => mapWorkflowJobTask(entry, index, input));
  const currentTask = agentRun && agentRun.status !== "idle"
    ? [
      {
        id: agentRun.id,
        title: agentRun.title,
        status: agentRun.status,
        summary: agentRun.summary,
        runId: agentRun.id,
        sessionId: agentRun.sessionId,
        updatedAt: agentRun.updatedAt,
      },
    ]
    : [];
  const seen = new Set<string>();
  return [...currentTask, ...rawTasks, ...workflowTasks]
    .filter((task) => {
      const key = task.id.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .slice(0, 24);
}





function normalizeApprovalStatus(value: unknown): DashboardApprovalSummary["status"] {
  const raw = asText(value).toLowerCase();
  if (raw.includes("approve")) {
    return "approved";
  }
  if (raw.includes("reject") || raw.includes("deny") || raw.includes("cancel")) {
    return "rejected";
  }
  if (raw.includes("expire")) {
    return "expired";
  }
  return "pending";
}

function mapApprovalSummary(entry: LooseRecord, index: number): DashboardApprovalSummary {
  const id = asText(entry.approvalId ?? entry.id ?? entry.requestId, `approval-${index + 1}`);
  const runId = asText(entry.runId ?? entry.agentRunId);
  const risk = normalizeToolRisk(entry);
  return {
    id,
    runId: runId || undefined,
    title: asText(entry.title ?? entry.summary ?? entry.action, "Aprovacao pendente"),
    reason: asText(entry.reason ?? entry.detail ?? entry.description, "Acao sensivel aguardando confirmacao."),
    risk: risk === "unknown" ? "attention" : risk,
    status: normalizeApprovalStatus(entry.status ?? entry.state),
    command: asText(entry.command, `approve ${id}`),
    scope: asText(entry.scope ?? entry.capabilityId ?? entry.toolId) || undefined,
    createdAt: formatTimestamp(entry.createdAt ?? entry.timestamp ?? entry.updatedAt),
  };
}

function mapToolExposure(entry: LooseRecord, index: number): DashboardToolExposure {
  const risk = normalizeToolRisk(entry);
  return {
    id: asText(entry.id ?? entry.toolId ?? entry.capabilityId ?? entry.name, `tool-exposure-${index + 1}`),
    label: asText(entry.label ?? entry.title ?? entry.name ?? entry.capabilityId, "Ferramenta"),
    capabilityId: asText(entry.capabilityId ?? entry.capability) || undefined,
    risk,
    requiresApproval: entry.requiresApproval === true || entry.approvalRequired === true || risk === "danger",
    description: asText(entry.description ?? entry.summary) || undefined,
  };
}

function buildToolExposureProfile(input: DashboardCommandCenterAdapterInput): DashboardToolExposureProfile {
  const rawProfile = input.toolExposureProfile ?? input.runtime?.toolExposureProfile ?? input.state?.toolExposureProfile;
  const seenToolIds = new Set<string>();
  const tools = [
    ...asArray<LooseRecord>(rawProfile?.tools),
    ...asArray<LooseRecord>(input.toolExposures),
    ...asArray<LooseRecord>(input.capabilities),
  ].map(mapToolExposure).filter((tool) => {
    const key = tool.id.toLowerCase();
    if (seenToolIds.has(key)) {
      return false;
    }
    seenToolIds.add(key);
    return true;
  }).slice(0, 18);
  const explicitMode = asText(rawProfile?.mode).toLowerCase();
  const mode: DashboardToolExposureProfile["mode"] =
    explicitMode === "safe" || explicitMode === "confirm" || explicitMode === "restricted" || explicitMode === "unknown"
      ? explicitMode
      : tools.length === 0
        ? "unknown"
        : tools.some((tool) => tool.risk === "danger")
          ? "restricted"
          : tools.some((tool) => tool.requiresApproval || tool.risk === "attention")
            ? "confirm"
            : "safe";

  return {
    mode,
    summary: asText(
      rawProfile?.summary,
      tools.length === 0
        ? "Ferramentas ainda nao foram expostas para este painel."
        : `${tools.length} ${tools.length === 1 ? "ferramenta mapeada" : "ferramentas mapeadas"} para o runtime.`,
    ),
    tools,
  };
}

function normalizeReplyPortKind(value: unknown): DashboardReplyPort["kind"] {
  const kind = asText(value).toLowerCase();
  if (kind.includes("telegram")) {
    return "telegram";
  }
  if (kind.includes("cli") || kind.includes("terminal")) {
    return "cli";
  }
  if (kind.includes("api") || kind.includes("http")) {
    return "api";
  }
  if (kind.includes("web") || kind.includes("control") || kind.includes("dashboard")) {
    return "web";
  }
  return "unknown";
}

function normalizeReplyPortStatus(value: unknown, fallback: DashboardReplyPortStatus): DashboardReplyPortStatus {
  const status = asText(value).toLowerCase();
  if (status.includes("offline") || status.includes("disconnect")) {
    return "offline";
  }
  if (status.includes("block") || status.includes("fail") || status.includes("error")) {
    return "blocked";
  }
  if (status.includes("degraded") || status.includes("warn") || status.includes("partial")) {
    return "degraded";
  }
  if (status.includes("available") || status.includes("ready") || status.includes("connected") || status.includes("ok")) {
    return "available";
  }
  return fallback;
}

function mapReplyPort(entry: LooseRecord, index: number): DashboardReplyPort {
  const kind = normalizeReplyPortKind(entry.kind ?? entry.type ?? entry.surface ?? entry.channel);
  return {
    id: asText(entry.id ?? entry.portId ?? entry.surface ?? entry.channel, `reply-port-${index + 1}`),
    label: asText(entry.label ?? entry.title ?? entry.name ?? entry.surface ?? entry.channel, "Porta de resposta"),
    kind,
    status: normalizeReplyPortStatus(entry.status ?? entry.state, "available"),
    primary: entry.primary === true,
    description: asText(entry.description ?? entry.summary) || undefined,
  };
}

function buildReplyPorts(input: DashboardCommandCenterAdapterInput): DashboardReplyPort[] {
  const explicitPorts = [
    ...asArray<LooseRecord>(input.replyPorts),
    ...asArray<LooseRecord>(input.runtime?.replyPorts),
    ...asArray<LooseRecord>(input.state?.replyPorts),
  ];

  if (explicitPorts.length > 0) {
    return explicitPorts.slice(0, 12).map(mapReplyPort);
  }

  const surfacePorts = asArray<LooseRecord>(input.visibleSurfaces).slice(0, 12).map(mapReplyPort);
  if (surfacePorts.length > 0) {
    return surfacePorts;
  }

  return [
    {
      id: "command-center",
      label: "Command Center",
      kind: "web",
      status: normalizeReplyPortStatus(input.wsStatus, "offline"),
      primary: true,
      description: "Resposta atual no painel web /control.",
    },
  ];
}

function buildModelProfile(
  input: DashboardCommandCenterAdapterInput,
  runtime: DashboardRuntimeSnapshot,
): DashboardModelProfile {
  const rawProfile = input.modelProfile ?? input.runtime?.modelProfile ?? input.state?.modelProfile;
  const runProfile = asRecord(resolveAgentRun(input)?.modelProfile);
  const selected = resolveModelPickerSelection(input);
  const correlation = resolveProviderRouteBudgetCorrelation(input);
  const routingRaw = asText(
    rawProfile?.routingPolicy
      ?? runProfile?.routingPolicy
      ?? correlation?.routingPolicy
      ?? input.runtime?.routingPolicy
      ?? input.state?.gateway?.routingPolicy,
  ).toLowerCase();
  const routingPolicy: DashboardModelProfile["routingPolicy"] =
    routingRaw === "direct" || routingRaw === "gateway" || routingRaw === "fallback" || routingRaw === "unknown"
      ? routingRaw
      : input.runtime?.gateway || input.state?.gateway
        ? "gateway"
        : runtime.currentModelLabel !== "modelo nao informado"
          ? "direct"
          : "unknown";

  return {
    providerLabel: asText(
      rawProfile?.providerLabel
        ?? rawProfile?.provider
        ?? runProfile?.providerLabel
        ?? selected?.providerLabel
        ?? selected?.providerName
        ?? correlation?.providerLabel
        ?? correlation?.providerName,
      runtime.currentProviderLabel,
    ),
    modelLabel: asText(
      rawProfile?.modelLabel
        ?? rawProfile?.model
        ?? runProfile?.modelLabel
        ?? selected?.modelLabel
        ?? selected?.modelName
        ?? correlation?.modelLabel
        ?? correlation?.modelName,
      runtime.currentModelLabel,
    ),
    routingPolicy,
    fallbackModelLabel: asText(rawProfile?.fallbackModelLabel ?? rawProfile?.fallbackModel ?? runProfile?.fallbackModelLabel) || undefined,
    routeId: asText(rawProfile?.routeId ?? runProfile?.routeId ?? selected?.routeId ?? correlation?.modelPicker?.routeId) || undefined,
    familyId: asText(rawProfile?.familyId ?? runProfile?.familyId ?? selected?.familyId) || undefined,
    selectionSource: asText(rawProfile?.selectionSource ?? runProfile?.selectionSource ?? selected?.selectionSource ?? selected?.source ?? correlation?.modelPicker?.source) || undefined,
    readiness: asText(rawProfile?.readiness ?? runProfile?.readiness ?? selected?.readiness ?? correlation?.modelPicker?.readiness) || undefined,
    ready: typeof rawProfile?.ready === "boolean"
      ? rawProfile.ready
      : typeof runProfile?.ready === "boolean"
        ? runProfile.ready
        : typeof selected?.ready === "boolean"
          ? selected.ready
          : typeof correlation?.modelPicker?.ready === "boolean"
            ? correlation.modelPicker.ready
            : undefined,
    fallbackOrder: asTextArray(rawProfile?.fallbackOrder ?? runProfile?.fallbackOrder ?? selected?.fallbackOrder ?? correlation?.modelPicker?.fallbackOrder),
    selectionExplanation: asTextArray(
      rawProfile?.selectionExplanation
        ?? rawProfile?.explanation
        ?? runProfile?.selectionExplanation
        ?? runProfile?.explanation
        ?? selected?.selectionExplanation
        ?? selected?.explanation
        ?? correlation?.modelPicker?.explanation,
    ),
    supportsTools: typeof rawProfile?.supportsTools === "boolean"
      ? rawProfile.supportsTools
      : typeof runProfile?.supportsTools === "boolean"
        ? runProfile.supportsTools
        : undefined,
    supportsVision: typeof rawProfile?.supportsVision === "boolean"
      ? rawProfile.supportsVision
      : typeof runProfile?.supportsVision === "boolean"
        ? runProfile.supportsVision
        : undefined,
    supportsStreaming: typeof rawProfile?.supportsStreaming === "boolean"
      ? rawProfile.supportsStreaming
      : typeof runProfile?.supportsStreaming === "boolean"
        ? runProfile.supportsStreaming
        : undefined,
  };
}

function mapSession(entry: LooseRecord, index: number, activeSessionId?: string | null): DashboardSessionSummary {
  const id = asText(entry.sessionId ?? entry.id ?? entry.key, `session-${index + 1}`);
  const title = asText(entry.title ?? entry.label ?? entry.summary ?? entry.name, id);
  const statusRaw = asText(entry.status ?? entry.state).toLowerCase();
  const status: DashboardSessionSummary["status"] = id === activeSessionId
    ? "active"
    : statusRaw.includes("block")
      ? "blocked"
      : statusRaw.includes("closed") || statusRaw.includes("done") || statusRaw.includes("final")
        ? "closed"
        : statusRaw.includes("idle")
          ? "idle"
          : "idle";

  return {
    id,
    title,
    updatedAt: formatTimestamp(entry.updatedAt ?? entry.lastActivityAt ?? entry.createdAt),
    status,
    channelLabel: asText(entry.channel ?? entry.platform ?? entry.surface) || undefined,
    messageCount: asNumber(entry.messageCount ?? entry.messages),
  };
}

function normalizeRole(value: unknown): DashboardChatMessage["role"] {
  const role = asText(value).toLowerCase();
  if (role === "user" || role === "assistant" || role === "system" || role === "tool") {
    return role;
  }
  return "system";
}

function mapMessage(entry: LooseRecord, index: number): DashboardChatMessage {
  const events = asArray<LooseRecord>(entry.events ?? entry.toolEvents ?? entry.steps).slice(0, 6).map(mapMessageEvent);
  return {
    id: asText(entry.id ?? entry.messageId ?? entry.timestamp, `message-${index + 1}`),
    role: normalizeRole(entry.role ?? entry.source ?? entry.sender),
    text: asText(entry.text ?? entry.message ?? entry.content ?? entry.body ?? entry.markdown ?? entry.summary, "(mensagem vazia)"),
    createdAt: formatTimestamp(entry.createdAt ?? entry.timestamp ?? entry.updatedAt),
    modelLabel: asText(entry.modelLabel ?? entry.model) || undefined,
    events,
    trace: asArray<LooseRecord>(entry.trace ?? entry.traceEvents).slice(0, 8).map(mapTraceEntry),
  };
}

function mapToolRun(entry: LooseRecord, index: number): DashboardAgentEvent {
  return {
    id: asText(entry.toolRunId ?? entry.id ?? entry.name, `tool-${index + 1}`),
    kind: "tool",
    title: asText(entry.name ?? entry.tool ?? entry.command ?? entry.title, "Ferramenta executada"),
    detail: asText(entry.summary ?? entry.detail ?? entry.status) || undefined,
    status: normalizeEventStatus(entry.status ?? entry.state),
  };
}

function mapApproval(entry: LooseRecord, index: number): DashboardAgentEvent {
  return {
    id: asText(entry.approvalId ?? entry.id ?? entry.requestId, `approval-${index + 1}`),
    kind: "approval",
    title: asText(entry.title ?? entry.summary ?? entry.action, "Aprovacao pendente"),
    detail: asText(entry.detail ?? entry.description ?? entry.reason) || undefined,
    status: "pending",
  };
}

function normalizeArtifactKind(value: unknown): DashboardArtifactSummary["kind"] {
  const kind = asText(value).toLowerCase();
  if (kind.includes("diff")) {
    return "diff";
  }
  if (kind.includes("report")) {
    return "report";
  }
  if (kind.includes("log")) {
    return "log";
  }
  if (kind.includes("plan")) {
    return "plan";
  }
  if (kind.includes("handoff")) {
    return "handoff";
  }
  return "file";
}

function mapArtifact(entry: LooseRecord, index: number): DashboardArtifactSummary {
  const statusRaw = asText(entry.status ?? entry.state).toLowerCase();
  return {
    id: asText(entry.artifactId ?? entry.id ?? entry.path, `artifact-${index + 1}`),
    title: asText(entry.title ?? entry.name ?? entry.path ?? entry.summary, "Artifact"),
    kind: normalizeArtifactKind(entry.kind ?? entry.type ?? entry.mimeType ?? entry.path),
    createdAt: formatTimestamp(entry.createdAt ?? entry.updatedAt ?? entry.timestamp),
    sessionId: asText(entry.sessionId) || undefined,
    status: statusRaw.includes("fail") || statusRaw.includes("error")
      ? "failed"
      : statusRaw.includes("draft") || statusRaw.includes("pending")
        ? "draft"
        : "ready",
  };
}


function mapMemorySignal(entry: LooseRecord, index: number): DashboardMemorySignal {
  return {
    id: asText(entry.id ?? entry.sourceId ?? entry.key, `memory-${index + 1}`),
    title: asText(entry.title ?? entry.label ?? entry.name, "Memoria usada"),
    layer: normalizeMemoryLayer(entry.layer ?? entry.type),
    summary: asText(entry.summary ?? entry.description ?? entry.text, "Fonte de memoria disponivel."),
    confidence: asNumber(entry.confidence ?? entry.score),
  };
}

function normalizeBudgetStatus(value: unknown): DashboardBudgetSnapshot["status"] {
  const raw = asText(value).toLowerCase();
  if (raw.includes("exceed") || raw.includes("over") || raw.includes("blocked")) {
    return "exceeded";
  }
  if (raw.includes("warn") || raw.includes("attention") || raw.includes("near")) {
    return "attention";
  }
  if (raw.includes("ok") || raw.includes("ready") || raw.includes("safe")) {
    return "ok";
  }
  return "unknown";
}

function buildBudgetSnapshot(input: DashboardCommandCenterAdapterInput): DashboardBudgetSnapshot {
  const raw = resolveRunBudget(input);
  const tokensUsed = asNumber(raw?.tokensUsed ?? raw?.usedTokens ?? raw?.usage?.tokens);
  const tokenBudget = asNumber(raw?.tokenBudget ?? raw?.maxTokens ?? raw?.budget?.tokens);
  const estimatedCost = asNumber(raw?.estimatedCost ?? raw?.estimate ?? raw?.cost?.estimated);
  const spent = asNumber(raw?.spent ?? raw?.cost ?? raw?.cost?.spent);
  const estimatedCostUnits = asNumber(raw?.estimatedCostUnits);
  const maxEstimatedCostUnits = asNumber(raw?.maxEstimatedCostUnits);
  const inputChars = asNumber(raw?.inputChars);
  const requestedToolCount = asNumber(raw?.requestedToolCount);
  const exposedToolCount = asNumber(raw?.exposedToolCount);
  const status = inferBudgetStatus(raw);
  const budgetSummary = summarizeBudget(raw);
  const reason = asText(raw?.reason ?? raw?.allReasons?.[0]);

  return {
    status,
    summary: asText(
      raw?.summary ?? raw?.description,
      status === "unknown"
        ? "Budget ainda nao informado para esta execucao."
        : budgetSummary || "Budget operacional mapeado para o cockpit.",
    ),
    source: asText(raw?.source) || undefined,
    reason: reason || undefined,
    currency: asText(raw?.currency ?? raw?.cost?.currency) || undefined,
    estimatedCost,
    spent,
    tokenBudget,
    tokensUsed,
    estimatedCostUnits,
    maxEstimatedCostUnits,
    inputChars,
    requestedToolCount,
    exposedToolCount,
  };
}

function normalizeReplayStatus(value: unknown, eventCount: number, artifactCount: number): DashboardReplaySummary["status"] {
  const raw = asText(value).toLowerCase();
  if (raw.includes("fail") || raw.includes("error")) {
    return "failed";
  }
  if (raw.includes("pending") || raw.includes("building")) {
    return "pending";
  }
  if (raw.includes("available") || raw.includes("ready") || raw.includes("complete")) {
    return "available";
  }
  return eventCount > 0 || artifactCount > 0 ? "available" : "none";
}

function buildReplaySummary(
  input: DashboardCommandCenterAdapterInput,
  agentRun: DashboardAgentRun | null,
  events: DashboardAgentEvent[],
  artifacts: DashboardArtifactSummary[],
): DashboardReplaySummary {
  const raw = input.replay ?? asArray<LooseRecord>(input.replayEntries)[0] ?? input.runtime?.replay ?? input.state?.replay ?? null;
  const eventCount = asNumber(raw?.eventCount ?? raw?.events) ?? (agentRun?.events.length || 0) + events.length;
  const artifactCount = asNumber(raw?.artifactCount ?? raw?.artifacts) ?? artifacts.length;
  const status = normalizeReplayStatus(raw?.status ?? raw?.state, eventCount, artifactCount);
  const runId = asText(raw?.runId ?? agentRun?.id);

  return {
    id: asText(raw?.id ?? raw?.replayId, runId ? `${runId}:replay` : "replay:none"),
    runId: runId || undefined,
    title: asText(raw?.title, status === "none" ? "Replay indisponivel" : "Replay da execucao"),
    status,
    summary: asText(
      raw?.summary ?? raw?.description,
      status === "none"
        ? "Nenhum replay real foi produzido ainda."
        : "Eventos e artifacts desta execucao podem ser revisitados.",
    ),
    eventCount,
    artifactCount,
    updatedAt: formatTimestamp(raw?.updatedAt ?? raw?.createdAt ?? agentRun?.updatedAt),
  };
}

function normalizeHealthCheckStatus(value: unknown): DashboardRuntimeStatus {
  const raw = asText(value).toLowerCase();
  if (raw.includes("offline") || raw.includes("down")) {
    return "offline";
  }
  if (raw.includes("block") || raw.includes("fail") || raw.includes("error")) {
    return "blocked";
  }
  if (raw.includes("degraded") || raw.includes("warn") || raw.includes("partial")) {
    return "degraded";
  }
  return "ready";
}

function mapHealthCheck(entry: LooseRecord, index: number): DashboardHealthCheck {
  return {
    id: asText(entry.id ?? entry.checkId ?? entry.name, `health-check-${index + 1}`),
    label: asText(entry.label ?? entry.title ?? entry.name, "Check operacional"),
    status: normalizeHealthCheckStatus(entry.status ?? entry.state),
    detail: asText(entry.detail ?? entry.summary ?? entry.message) || undefined,
    actionId: asText(entry.actionId ?? entry.action) || undefined,
  };
}

function buildHealthSnapshot(
  input: DashboardCommandCenterAdapterInput,
  runtime: DashboardRuntimeSnapshot,
): DashboardHealthSnapshot {
  const raw = input.health ?? input.runtime?.health ?? input.state?.health ?? null;
  const explicitChecks = [
    ...asArray<LooseRecord>(raw?.checks),
    ...asArray<LooseRecord>(input.healthChecks),
    ...asArray<LooseRecord>(input.runtime?.healthChecks),
  ].map(mapHealthCheck);
  const blockerChecks = runtime.blockers.map((blocker, index) => ({
    id: `blocker-${blocker.id || index}`,
    label: blocker.title,
    status: blocker.severity === "danger" ? "blocked" as const : "degraded" as const,
    detail: blocker.detail,
    actionId: blocker.actionId,
  }));
  const checks = explicitChecks.length > 0 ? explicitChecks : blockerChecks;

  return {
    status: normalizeHealthCheckStatus(raw?.status ?? raw?.state ?? runtime.status),
    summary: asText(
      raw?.summary ?? raw?.description,
      runtime.status === "ready"
        ? "Health operacional sem bloqueios relevantes."
        : "Health operacional precisa de atencao.",
    ),
    checks,
  };
}

function normalizeReleaseStatus(value: unknown): DashboardReleaseStatus["status"] {
  const raw = asText(value).toLowerCase();
  if (raw.includes("preview")) {
    return "preview_ready";
  }
  if (raw.includes("update")) {
    return "update_available";
  }
  if (raw.includes("block") || raw.includes("fail")) {
    return "blocked";
  }
  if (raw.includes("stable") || raw.includes("ready")) {
    return "stable";
  }
  return "unknown";
}

function normalizeReleaseChannel(value: unknown): DashboardReleaseStatus["channel"] {
  const raw = asText(value).toLowerCase();
  if (raw === "preview" || raw === "stable" || raw === "lts" || raw === "dev") {
    return raw;
  }
  return "unknown";
}

function buildReleaseStatus(input: DashboardCommandCenterAdapterInput): DashboardReleaseStatus {
  const raw = input.releaseStatus ?? input.runtime?.releaseStatus ?? input.state?.releaseStatus ?? null;
  const status = normalizeReleaseStatus(raw?.status ?? raw?.state);

  return {
    status,
    channel: normalizeReleaseChannel(raw?.channel),
    summary: asText(
      raw?.summary ?? raw?.description,
      "Release status ainda nao conectado ao cockpit.",
    ),
    version: asText(raw?.version ?? raw?.tag) || undefined,
    rollbackAvailable: raw?.rollbackAvailable === true || raw?.rollback === true,
    updatedAt: asText(raw?.updatedAt ?? raw?.createdAt) || undefined,
  };
}

function normalizeIntegrationStatus(value: unknown): DashboardIntegrationSummary["status"] {
  const raw = asText(value).toLowerCase();
  if (raw.includes("connect") || raw.includes("ready") || raw.includes("ok")) {
    return "connected";
  }
  if (raw.includes("degraded") || raw.includes("warn") || raw.includes("partial")) {
    return "degraded";
  }
  if (raw.includes("disabled") || raw.includes("off")) {
    return "disabled";
  }
  return "missing";
}

function normalizeIntegrationCategory(value: unknown): DashboardIntegrationSummary["category"] {
  const raw = asText(value).toLowerCase();
  if (raw.includes("provider") || raw.includes("model")) {
    return "provider";
  }
  if (raw.includes("channel") || raw.includes("telegram") || raw.includes("web")) {
    return "channel";
  }
  if (raw.includes("mcp") || raw.includes("plugin")) {
    return "mcp";
  }
  if (raw.includes("storage") || raw.includes("db")) {
    return "storage";
  }
  if (raw.includes("runtime") || raw.includes("gateway")) {
    return "runtime";
  }
  return "unknown";
}

function mapIntegration(entry: LooseRecord, index: number): DashboardIntegrationSummary {
  return {
    id: asText(entry.id ?? entry.integrationId ?? entry.name, `integration-${index + 1}`),
    label: asText(entry.label ?? entry.title ?? entry.name, "Integracao"),
    category: normalizeIntegrationCategory(entry.category ?? entry.kind ?? entry.type),
    status: normalizeIntegrationStatus(entry.status ?? entry.state),
    detail: asText(entry.detail ?? entry.summary ?? entry.description) || undefined,
  };
}

function buildIntegrations(input: DashboardCommandCenterAdapterInput): DashboardIntegrationSummary[] {
  const rawIntegrations = [
    ...asArray<LooseRecord>(input.integrations),
    ...asArray<LooseRecord>(input.runtime?.integrations),
    ...asArray<LooseRecord>(input.state?.integrations),
  ];
  return rawIntegrations.slice(0, 24).map(mapIntegration);
}

function normalizeInitiative(value: unknown): DashboardIdentitySnapshot["initiative"] {
  const raw = asText(value).toLowerCase();
  if (raw.includes("low") || raw.includes("baixa")) {
    return "low";
  }
  if (raw.includes("high") || raw.includes("alta")) {
    return "high";
  }
  if (raw.includes("balanced") || raw.includes("media") || raw.includes("mÃ©dia")) {
    return "balanced";
  }
  return "unknown";
}

function normalizeFirstRunStatus(value: unknown): DashboardIdentitySnapshot["firstRunStatus"] {
  const raw = asText(value).toLowerCase();
  if (raw.includes("pend") || raw.includes("needed") || raw.includes("incomplete")) {
    return "pending";
  }
  if (raw.includes("complete") || raw.includes("done") || raw.includes("ready")) {
    return "complete";
  }
  return "unknown";
}

function buildIdentitySnapshot(input: DashboardCommandCenterAdapterInput): DashboardIdentitySnapshot {
  const raw = input.identity ?? input.runtime?.identity ?? input.state?.identity ?? input.state?.user ?? null;
  const agentName = asText(raw?.agentName ?? raw?.agent ?? raw?.assistantName, "Zavorth");
  const userName = asText(raw?.userName ?? raw?.operatorName ?? raw?.name ?? input.state?.operator?.label, "Operador");
  const firstRunStatus = normalizeFirstRunStatus(raw?.firstRunStatus ?? raw?.onboardingStatus ?? raw?.status);

  return {
    agentName,
    userName,
    language: asText(raw?.language ?? raw?.locale, "en-US"),
    tone: asText(raw?.tone ?? raw?.voice, "direto"),
    initiative: normalizeInitiative(raw?.initiative),
    firstRunStatus,
    summary: asText(
      raw?.summary ?? raw?.description,
      firstRunStatus === "pending"
        ? "Primeiro uso ainda precisa ser concluido."
        : `${agentName} pronto para operar com ${userName}.`,
    ),
  };
}

function normalizeLogLevel(value: unknown): DashboardLogEntry["level"] {
  const raw = asText(value).toLowerCase();
  if (raw.includes("debug")) {
    return "debug";
  }
  if (raw.includes("warn")) {
    return "warn";
  }
  if (raw.includes("error") || raw.includes("fail")) {
    return "error";
  }
  return "info";
}

function mapLogEntry(entry: LooseRecord, index: number): DashboardLogEntry {
  return {
    id: asText(entry.id ?? entry.logId ?? entry.timestamp, `log-${index + 1}`),
    level: normalizeLogLevel(entry.level ?? entry.severity),
    source: asText(entry.source ?? entry.scope ?? entry.module, "runtime"),
    message: asText(entry.message ?? entry.text ?? entry.summary, "Evento registrado."),
    createdAt: formatTimestamp(entry.createdAt ?? entry.timestamp ?? entry.updatedAt),
    runId: asText(entry.runId ?? entry.agentRunId) || undefined,
  };
}

function buildLogs(input: DashboardCommandCenterAdapterInput): DashboardLogEntry[] {
  return [
    ...asArray<LooseRecord>(input.logs),
    ...asArray<LooseRecord>(input.runtime?.logs),
    ...asArray<LooseRecord>(input.state?.logs),
  ].slice(0, 50).map(mapLogEntry);
}

function buildActions(input: DashboardCommandCenterAdapterInput): DashboardCommandAction[] {
  const approvalsCount = asArray(input.approvals).length;
  const actions: DashboardCommandAction[] = [
    {
      id: "navigate.chat",
      label: "Abrir chat",
      description: "Voltar para a conversa principal.",
      group: "navigate",
    },
    {
      id: "runtime.doctor",
      label: "Rodar diagnostico",
      description: "Ver o que esta bom, o que esta bloqueado e o que pode ser corrigido.",
      group: "runtime",
    },
    {
      id: "runtime.status",
      label: "Ver status",
      description: "Abrir o resumo operacional do runtime.",
      group: "runtime",
    },
    {
      id: "workspace.open",
      label: "Abrir workspace",
      description: "Ver processos, logs e hooks do projeto atual.",
      group: "navigate",
    },
    {
      id: "session.new",
      label: "Nova sessao",
      description: "Comecar uma conversa nova sem perder o historico atual.",
      group: "session",
    },
    {
      id: "settings.open",
      label: "Abrir configuracoes",
      description: "Ver provider, modelo, seguranca e preferencias.",
      group: "settings",
    },
  ];

  if (approvalsCount > 0) {
    actions.unshift({
      id: "approvals.open",
      label: `Revisar ${approvalsCount} aprovacao${approvalsCount === 1 ? "" : "es"}`,
      description: "Acoes sensiveis aguardando confirmacao.",
      group: "approval",
    });
  }

  return actions;
}

const DEFAULT_SECTORS: DashboardNavigationSector[] = [
  { id: "terminal", label: "Chat", title: "Chat", enabled: true },
  { id: "overview", label: "Painel", title: "Visao geral", enabled: true },
  { id: "workspace", label: "Workspace", title: "Developer Workspace", enabled: true },
  { id: "gateway", label: "Gateway", title: "Gateway Console", enabled: true },
  { id: "sales-os", label: "Sales OS", title: "Sales OS", enabled: true },
  { id: "channels", label: "Canais", title: "Canais", enabled: true },
  { id: "instances", label: "Nodos", title: "Instancias", enabled: true },
  { id: "sessions", label: "Sessoes", title: "Sessoes", enabled: true },
  { id: "agents", label: "Agentes", title: "Agentes", enabled: true },
  { id: "skills", label: "Skills", title: "Skills", enabled: true },
  { id: "nodes", label: "Rede", title: "Rede", enabled: true },
  { id: "dreams", label: "Sonhos", title: "Memoria", enabled: true },
  { id: "usage", label: "Uso", title: "Uso", enabled: true },
  { id: "config", label: "Config", title: "Configuracoes", enabled: true },
  { id: "docs", label: "Docs", title: "Docs", enabled: true },
  { id: "cron", label: "Cron", title: "Tarefas agendadas", enabled: true },
];

function buildSectors(input: DashboardCommandCenterAdapterInput): DashboardNavigationSector[] {
  const counts = {
    sessions: asArray(input.sessionEntries).length,
    approvals: asArray(input.approvals).length,
    artifacts: asArray(input.artifacts).length,
    capabilities: asArray(input.capabilities).length,
    nodes: asArray(input.companions).length,
    workspaceProcesses: asArray(input.developerWorkspace?.processes).length,
    salesPackConversations: asArray(input.state?.salesPack?.sourceSnapshots?.inbox).length,
  };

  return DEFAULT_SECTORS.map((sector) => {
    if (sector.id === "sessions") {
      return { ...sector, badgeCount: counts.sessions || undefined };
    }
    if (sector.id === "skills") {
      return { ...sector, badgeCount: counts.capabilities || undefined };
    }
    if (sector.id === "nodes") {
      return { ...sector, badgeCount: counts.nodes || undefined };
    }
    if (sector.id === "overview") {
      return { ...sector, badgeCount: counts.approvals || undefined };
    }
    if (sector.id === "workspace") {
      return { ...sector, badgeCount: counts.workspaceProcesses || undefined };
    }
    if (sector.id === "sales-os") {
      return { ...sector, badgeCount: counts.salesPackConversations || undefined };
    }
    return sector;
  });
}

export function buildDashboardCommandCenterViewModel(
  input: DashboardCommandCenterAdapterInput,
): DashboardCommandCenterViewModel {
  const activeSessionId = asText(input.effectiveSessionId ?? input.activeSessionId);
  const runtime = buildRuntimeSnapshot(input);
  const sessions = asArray<LooseRecord>(input.sessionEntries).map((entry, index) => mapSession(entry, index, activeSessionId));
  const messages = asArray<LooseRecord>(input.transcriptEntries).map(mapMessage);
  const toolEvents = asArray<LooseRecord>(input.toolRuns).map(mapToolRun);
  const approvalEvents = asArray<LooseRecord>(input.approvals).map(mapApproval);
  const events = [...approvalEvents, ...toolEvents].slice(0, 24);
  const artifacts = asArray<LooseRecord>(input.artifacts).map(mapArtifact);
  const memorySignals = [
    ...asArray<LooseRecord>(input.memoryRecallSources).map(mapMemorySignal),
    ...asArray<LooseRecord>(input.memoryRecall?.sources).map(mapMemorySignal),
  ].slice(0, 12);
  const agentRun = buildAgentRun(input, runtime, events);
  const trace = agentRun?.trace ?? buildTraceSnapshot(input, null, events);
  const tasks = buildTasks(input, agentRun);
  const runObservatory = buildDashboardRunObservatory(input, agentRun, tasks);
  const naturalFirstRuntime = buildNaturalFirstRuntime(input);
  const capabilityDiscovery = buildNaturalCapabilityDiscovery(input);
  const universalPreviewMode = buildUniversalPreviewMode(input);
  const capabilityNegotiation = buildCapabilityNegotiation(input);
  const toolRehearsal = buildToolRehearsal(input);
  const safetyNarrative = buildSafetyNarrative(input);
  const memoryWithReceipts = buildMemoryWithReceipts(input);
  const selfingDashboard = buildSelfingDashboard(input);
  const artifactMemory = buildArtifactMemory(input);
  const personalOpsAutopilot = buildPersonalOpsAutopilot(input);
  const agentTeamCompiler = buildAgentTeamCompiler(input);
  const crossChannelContinuity = buildCrossChannelContinuity(input);
  const askBeforeAssumptionPolicy = buildAskBeforeAssumptionPolicy(input);
  const providerMeshConsolidation = buildProviderMeshConsolidation(input);
  const universalIntentTrustEnforcement = buildUniversalIntentTrustEnforcement(input);
  const runArtifactReceiptReplay = buildRunArtifactReceiptReplay(input);
  const productizationEvidence = buildProductizationEvidence(input);
  const productEntryRuntime = buildProductEntryRuntime(input);
  const releaseInstallerRollbackPath = buildReleaseInstallerRollbackPath(input);
  const publicSiteDocsDemoSync = buildPublicSiteDocsDemoSync(input);
  const feedbackTelemetryProductLoop = buildFeedbackTelemetryProductLoop(input);
  const publicAdoptionPilotLoop = buildPublicAdoptionPilotLoop(input);
  const integrationShowcasePartnerSurface = buildIntegrationShowcasePartnerSurface(input);
  const releaseAdoptionReadiness = buildReleaseAdoptionReadiness(input);
  const releaseCandidatePreCanaryGate = buildReleaseCandidatePreCanaryGate(input);
  const blueprintCompletionGate = buildBlueprintCompletionGate(input);
  const skillMcpQuarantine = buildSkillMcpQuarantine(input);
  const providerArena = buildProviderArena(input);
  const providerCockpit = buildProviderCockpit(input);
  const subagentAutoInvocation = buildSubagentAutoInvocation(input);
  const nexusWorkbench = buildNexusWorkbench(input);
  const remoteMeshApprovalUx = asRecord(
    input.remoteMeshApprovalUx
      ?? input.agentRun?.metadata?.remoteMeshApprovalUx
      ?? input.agentRun?.metadata?.remoteMeshNotebookApprovalUx,
  ) as DashboardCommandCenterViewModel["remoteMeshApprovalUx"];
  const approvals = asArray<LooseRecord>(input.approvals).map(mapApprovalSummary);
  const budget = buildBudgetSnapshot(input);
  const replay = buildReplaySummary(input, agentRun, events, artifacts);
  const health = buildHealthSnapshot(input, runtime);
  const releaseStatus = buildReleaseStatus(input);
  const integrations = buildIntegrations(input);
  const identity = buildIdentitySnapshot(input);
  const logs = buildLogs(input);

  return {
    contractVersion: "command-center-runtime-contract/v1",
    generatedAt: new Date().toISOString(),
    adapterSource: buildAdapterSource(input),
    runtime,
    agentRun,
    tasks,
    runObservatory,
    approvals,
    naturalFirstRuntime,
    capabilityDiscovery,
    universalPreviewMode,
    capabilityNegotiation,
    toolRehearsal,
    safetyNarrative,
    memoryWithReceipts,
    selfingDashboard,
    artifactMemory,
    personalOpsAutopilot,
    agentTeamCompiler,
    crossChannelContinuity,
    askBeforeAssumptionPolicy,
    providerMeshConsolidation,
    universalIntentTrustEnforcement,
    runArtifactReceiptReplay,
    productizationEvidence,
    productEntryRuntime,
    releaseInstallerRollbackPath,
    publicSiteDocsDemoSync,
    feedbackTelemetryProductLoop,
    publicAdoptionPilotLoop,
    integrationShowcasePartnerSurface,
    releaseAdoptionReadiness,
    releaseCandidatePreCanaryGate,
    blueprintCompletionGate,
    skillMcpQuarantine,
    providerArena,
    providerCockpit,
    subagentAutoInvocation,
    nexusWorkbench,
    remoteMeshApprovalUx,
    toolExposure: buildToolExposureProfile(input),
    budget,
    replay,
    replyPorts: buildReplyPorts(input),
    modelProfile: buildModelProfile(input, runtime),
    health,
    releaseStatus,
    integrations,
    identity,
    logs,
    sectors: buildSectors(input),
    sessions,
    messages,
    events,
    trace,
    artifacts,
    memorySignals,
    actions: buildActions(input),
    counts: {
      tasks: tasks.length,
      sessions: sessions.length,
      approvals: approvals.length,
      artifacts: artifacts.length,
      capabilities: asArray(input.capabilities).length,
      integrations: integrations.length,
      nodes: asArray(input.companions).length,
      blockers: runtime.blockers.length,
      logs: logs.length,
    },
    emptyState: {
      title: "O que vamos fazer hoje?",
      subtitle: runtime.status === "ready"
        ? "Escreva como falaria com um copiloto. O Zavorth cuida do resto."
        : "Resolva os bloqueios primeiro para operar com confianca.",
      suggestions: [
        "Verificar status do sistema",
        "Analisar o repositorio atual",
        "Retomar a ultima sessao",
        "Listar artifacts recentes",
      ],
    },
  };
}
