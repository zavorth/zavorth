import type {
  RuntimeAdapterBridgeChannelHealthSnapshot,
  RuntimeAdapterCapabilityInventorySnapshot,
  RuntimeAdapterDeliveryReceipt,
  RuntimeAdapterSessionReadModel,
  RuntimeAdapterWorkerStatusSnapshot,
} from "../../../../../../contracts/CommandCenterRuntimeBoundaryContract.js";
import {
  ZAVORTH_COMMAND_CENTER_ASSIMILATION_VERSION,
  type ZavorthApprovalCard,
  type ZavorthArtifactSignal,
  type ZavorthCapabilityState,
  type ZavorthChannelActivity,
  type ZavorthCommandCenterAssimilationSnapshot,
  type ZavorthCommandCenterIdentityLeak,
  type ZavorthCommandCenterIdentityLeakScan,
  type ZavorthCommandCenterRuntimeStatus,
  type ZavorthCommandCenterTransportStatus,
  type ZavorthCommandCenterUiState,
  type ZavorthOperationalEvent,
  type ZavorthOrdinaryUserWorkflow,
  type ZavorthRuntimeSnapshot,
  type ZavorthSessionTimeline,
  type ZavorthSessionTimelineEntry,
  type ZavorthWorkerStatus,
} from "../contracts";
import {
  COMMAND_CENTER_RUNTIME_PROJECTION_VERSION,
  type CommandCenterRuntimeProjection,
} from "./commandCenterRuntimeProjection";

export type ZavorthCommandCenterAssimilationInput = {
  projection?: CommandCenterRuntimeProjection | null;
  capabilityInventory?: RuntimeAdapterCapabilityInventorySnapshot | null;
  channelHealth?: RuntimeAdapterBridgeChannelHealthSnapshot | null;
  deliveryReceipts?: RuntimeAdapterDeliveryReceipt[];
  sessionReadModels?: RuntimeAdapterSessionReadModel[];
  externalWorkers?: RuntimeAdapterWorkerStatusSnapshot[];
  transportStatus?: ZavorthCommandCenterTransportStatus;
  loading?: boolean;
  error?: string | null;
  identityLeakTerms?: string[];
  now?: () => Date;
};

export type ZavorthCommandCenterRealtimeEvent =
  | ({
    type: "projection.snapshot";
  } & Omit<ZavorthCommandCenterAssimilationInput, "projection"> & {
    projection: CommandCenterRuntimeProjection;
  })
  | {
    type: "transport.reconnecting";
    at?: string;
  }
  | {
    type: "transport.connected";
    at?: string;
  }
  | {
    type: "transport.disconnected";
    reason?: string;
    at?: string;
  }
  | {
    type: "runtime.failure";
    error: string;
    at?: string;
  }
  | {
    type: "reset.empty";
    at?: string;
  };

function asText(value: unknown, fallback = ""): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function asArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function nowIso(now?: () => Date): string {
  return (now || (() => new Date()))().toISOString();
}

function normalizeRuntimeStatus(
  status: unknown,
  transportStatus: ZavorthCommandCenterTransportStatus,
  error?: string | null,
): ZavorthCommandCenterRuntimeStatus {
  if (error) {
    return "blocked";
  }
  if (transportStatus === "disconnected") {
    return "offline";
  }
  if (transportStatus === "reconnecting") {
    return "degraded";
  }
  return status === "ready" || status === "degraded" || status === "blocked" || status === "offline"
    ? status
    : "ready";
}

function normalizeTransportStatus(
  projection: CommandCenterRuntimeProjection,
  explicit?: ZavorthCommandCenterTransportStatus,
): ZavorthCommandCenterTransportStatus {
  if (explicit) {
    return explicit;
  }
  if (projection.wsStatus === "connected") {
    return "connected";
  }
  if (projection.wsStatus === "connecting") {
    return "connecting";
  }
  return "disconnected";
}

function createEmptyProjection(generatedAt: string): CommandCenterRuntimeProjection {
  return {
    projectionVersion: COMMAND_CENTER_RUNTIME_PROJECTION_VERSION,
    generatedAt,
    adapterSource: {
      kind: "universal-agent-runtime",
      label: "Zavorth Agent Gateway",
      version: COMMAND_CENTER_RUNTIME_PROJECTION_VERSION,
    },
    runtimeStatus: "ready",
    wsStatus: "connected",
    runtime: {
      status: "ready",
    },
    activeSessionId: null,
    effectiveSessionId: null,
    productModeId: "agent",
    productModeLabel: "agent",
    agentRun: null,
    sessions: [],
    messages: [],
    tasks: [],
    events: [],
    approvals: [],
    artifacts: [],
    memorySignals: [],
    capabilities: [],
    toolExposure: {
      mode: "unknown",
      summary: "Nenhuma ferramenta exposta para a projeção atual.",
      tools: [],
    },
    budget: null,
    replay: null,
    replyPorts: [],
    modelProfile: null,
    health: null,
    releaseStatus: null,
    integrations: [],
    identity: null,
    logs: [],
    workflowJobs: [],
    runtimeWarnings: [],
  };
}

function mapEventStatus(status: unknown): ZavorthOperationalEvent["status"] {
  if (status === "failed") {
    return "failed";
  }
  if (status === "pending") {
    return "pending";
  }
  if (status === "running") {
    return "running";
  }
  return "done";
}

function severityFromRuntimeStatus(status: ZavorthCommandCenterRuntimeStatus): ZavorthOperationalEvent["severity"] {
  if (status === "blocked" || status === "offline") {
    return "danger";
  }
  if (status === "degraded") {
    return "warning";
  }
  return "info";
}

function mapProjectionEvents(
  projection: CommandCenterRuntimeProjection,
  generatedAt: string,
): ZavorthOperationalEvent[] {
  const explicitEvents = projection.events.map((event): ZavorthOperationalEvent => ({
    id: `zavorth-event:${event.id}`,
    kind: event.kind === "approval" || event.kind === "artifact" ? event.kind : "runtime",
    title: event.title,
    detail: event.detail,
    status: mapEventStatus(event.status),
    severity: event.kind === "error" || event.status === "failed" ? "danger" : "info",
    createdAt: generatedAt,
    sessionId: projection.effectiveSessionId || projection.activeSessionId || undefined,
    source: "zavorth",
  }));
  const warnings = projection.runtimeWarnings.map((warning, index): ZavorthOperationalEvent => ({
    id: `zavorth-runtime-warning:${index + 1}`,
    kind: "health",
    title: "Runtime warning",
    detail: warning,
    status: "pending",
    severity: "warning",
    createdAt: generatedAt,
    source: "zavorth",
  }));
  return [...explicitEvents, ...warnings];
}

function buildRuntimeSnapshot(
  projection: CommandCenterRuntimeProjection,
  generatedAt: string,
  transportStatus: ZavorthCommandCenterTransportStatus,
  error?: string | null,
): ZavorthRuntimeSnapshot {
  const status = normalizeRuntimeStatus(projection.runtimeStatus, transportStatus, error);
  return {
    id: "zavorth-command-center-runtime",
    status,
    transportStatus,
    activeSessionId: projection.effectiveSessionId || projection.activeSessionId || null,
    summary: error
      ? `Command Center bloqueado: ${error}`
      : status === "ready"
        ? "Command Center pronto com projeções Zavorth-native."
        : "Command Center operando em estado de atenção.",
    generatedAt,
    healthStatus: projection.health?.status || status,
    viewModelSource: "zavorth-command-center-projection",
  };
}

function mapProjectionMessage(entry: CommandCenterRuntimeProjection["messages"][number]): ZavorthSessionTimelineEntry {
  return {
    id: `zavorth-message:${entry.id}`,
    role: entry.role,
    text: entry.text,
    createdAt: entry.createdAt,
    artifactIds: entry.events?.filter((event) => event.kind === "artifact").map((event) => event.id),
  };
}

function mapReadModelEntry(entry: RuntimeAdapterSessionReadModel["entries"][number]): ZavorthSessionTimelineEntry {
  return {
    id: `zavorth-history:${entry.id}`,
    role: entry.role,
    text: entry.text,
    createdAt: entry.createdAt,
    eventId: entry.eventId,
    replyPacketId: entry.replyPacketId,
    artifactIds: entry.attachments?.map((attachment) => attachment.id),
  };
}

function mergeUniqueEntries(entries: ZavorthSessionTimelineEntry[]): ZavorthSessionTimelineEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = entry.id.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildSessionTimelines(
  projection: CommandCenterRuntimeProjection,
  readModels: RuntimeAdapterSessionReadModel[],
): ZavorthSessionTimeline[] {
  const timelines = new Map<string, ZavorthSessionTimeline>();
  const activeSessionId = projection.effectiveSessionId || projection.activeSessionId || null;
  projection.sessions.forEach((session) => {
    timelines.set(session.id, {
      id: session.id,
      title: session.title,
      status: session.status,
      channelLabel: session.channelLabel,
      updatedAt: session.updatedAt,
      messageCount: session.messageCount || 0,
      entries: session.id === activeSessionId ? projection.messages.map(mapProjectionMessage) : [],
    });
  });

  readModels.forEach((model) => {
    const existing = timelines.get(model.id);
    timelines.set(model.id, {
      id: model.id,
      title: model.title,
      status: existing?.status || (model.id === activeSessionId ? "active" : "idle"),
      channelLabel: existing?.channelLabel || model.channel,
      updatedAt: model.updatedAt || existing?.updatedAt || "agora",
      messageCount: model.entries.length,
      entries: mergeUniqueEntries([
        ...(existing?.entries || []),
        ...model.entries.map(mapReadModelEntry),
      ]),
      replayId: model.replay.id,
      handoffId: model.handoff.id,
    });
  });

  return Array.from(timelines.values());
}

function mapApproval(approval: CommandCenterRuntimeProjection["approvals"][number]): ZavorthApprovalCard {
  return {
    id: approval.id,
    runId: approval.runId,
    title: approval.title,
    reason: approval.reason,
    risk: approval.risk,
    status: approval.status,
    actionId: "approvals.open",
    createdAt: approval.createdAt,
  };
}

function buildArtifacts(
  projection: CommandCenterRuntimeProjection,
  readModels: RuntimeAdapterSessionReadModel[],
): ZavorthArtifactSignal[] {
  const artifacts = [
    ...projection.artifacts.map((artifact): ZavorthArtifactSignal => ({
      id: artifact.id,
      title: artifact.title,
      kind: artifact.kind,
      status: artifact.status,
      createdAt: artifact.createdAt,
      sessionId: artifact.sessionId,
    })),
    ...readModels.map((model): ZavorthArtifactSignal => ({
      id: model.handoff.artifact.id,
      title: model.handoff.artifact.title,
      kind: model.handoff.artifact.kind,
      status: model.handoff.artifact.status,
      createdAt: model.handoff.artifact.createdAt,
      sessionId: model.id,
    })),
  ];
  const seen = new Set<string>();
  return artifacts.filter((artifact) => {
    const key = artifact.id.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function channelStatusToRuntimeStatus(status: string): ZavorthCommandCenterRuntimeStatus {
  if (status === "available") {
    return "ready";
  }
  if (status === "offline") {
    return "offline";
  }
  if (status === "blocked") {
    return "blocked";
  }
  return "degraded";
}

function buildChannelActivity(
  channelHealth: RuntimeAdapterBridgeChannelHealthSnapshot | null | undefined,
  receipts: RuntimeAdapterDeliveryReceipt[],
): ZavorthChannelActivity[] {
  const channels = asArray(channelHealth?.channels);
  return channels.map((channel) => {
    const explicitlyLinkedReceipts = receipts.filter((receipt) => (
      receipt.channelId === channel.id
      || receipt.channelId === `external-channel:${channel.replyPort.id}`
    ));
    const channelReceipts = explicitlyLinkedReceipts.length > 0
      ? explicitlyLinkedReceipts
      : channels.length === 1 ? receipts : [];
    const latestReceipt = channelReceipts.at(-1);
    return {
      id: channel.id,
      label: channel.label,
      channel: channel.channel,
      status: channelStatusToRuntimeStatus(channel.status),
      inbound: channel.inbound,
      outbound: channel.outbound,
      deliveryCount: channelReceipts.length,
      latestDeliveryStatus: latestReceipt?.status,
      replyPortId: channel.replyPort.id,
    };
  });
}

function mapCapabilityStatus(status: string, policy: string): ZavorthCapabilityState["status"] {
  if (policy === "blocked") {
    return "blocked";
  }
  if (policy === "unavailable" || status === "unavailable") {
    return "unavailable";
  }
  if (policy === "approval-required") {
    return "degraded";
  }
  if (status === "degraded") {
    return "degraded";
  }
  return "available";
}

function buildCapabilities(
  projection: CommandCenterRuntimeProjection,
  inventory: RuntimeAdapterCapabilityInventorySnapshot | null | undefined,
): ZavorthCapabilityState[] {
  const fromProjection = projection.toolExposure.tools.map((tool): ZavorthCapabilityState => ({
    id: tool.id,
    label: tool.label,
    kind: "tool",
    status: tool.requiresApproval ? "degraded" : "available",
    risk: tool.risk,
    requiresApproval: tool.requiresApproval,
    policy: tool.requiresApproval ? "approval-required" : "allowed",
    summary: tool.description,
  }));
  const fromInventory = asArray(inventory?.items).map((item): ZavorthCapabilityState => ({
    id: item.id,
    label: item.label,
    kind: item.kind,
    status: mapCapabilityStatus(item.status, item.policy.exposure),
    risk: item.risk,
    requiresApproval: item.requiresApproval,
    policy: item.policy.exposure,
    summary: item.summary,
  }));
  const seen = new Set<string>();
  return [...fromProjection, ...fromInventory].filter((capability) => {
    const key = capability.id.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function mapWorkerStatus(status: unknown): ZavorthWorkerStatus["status"] {
  const raw = asText(status).toLowerCase();
  if (raw === "queued") return "queued";
  if (raw === "running") return "running";
  if (raw === "waiting_approval") return "waiting_approval";
  if (raw === "completed") return "completed";
  if (raw === "failed") return "failed";
  if (raw === "cancelled") return "cancelled";
  return "idle";
}

function buildWorkers(
  projection: CommandCenterRuntimeProjection,
  generatedAt: string,
  externalWorkers: RuntimeAdapterWorkerStatusSnapshot[],
): ZavorthWorkerStatus[] {
  const workflowWorkers = projection.workflowJobs.map((job, index): ZavorthWorkerStatus => ({
    id: asText(job.id, `worker-job-${index + 1}`),
    kind: asText(job.kind, "workflow"),
    status: mapWorkerStatus(job.status),
    runId: asText(job.runId) || undefined,
    summary: asText(job.summary ?? job.lastError, "Worker duravel visivel no Command Center."),
    updatedAt: asText(job.updatedAt, generatedAt),
  }));
  const externalWorkerRows = externalWorkers.map((worker): ZavorthWorkerStatus => ({
    id: worker.id,
    kind: worker.kind,
    status: worker.status,
    runId: worker.runId,
    summary: worker.summary,
    updatedAt: worker.updatedAt,
  }));
  const seen = new Set<string>();
  return [...workflowWorkers, ...externalWorkerRows].filter((worker) => {
    const key = worker.id.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildWorkflows(input: {
  timelines: ZavorthSessionTimeline[];
  channels: ZavorthChannelActivity[];
  approvals: ZavorthApprovalCard[];
  artifacts: ZavorthArtifactSignal[];
  capabilities: ZavorthCapabilityState[];
  workers: ZavorthWorkerStatus[];
  runtime: ZavorthRuntimeSnapshot;
}): ZavorthOrdinaryUserWorkflow[] {
  return [
    {
      id: "sessions.resume",
      label: "Retomar sessao",
      target: "sessions",
      enabled: input.timelines.length > 0,
      status: input.timelines.length > 0 ? "ready" : "empty",
    },
    {
      id: "channels.review",
      label: "Ver atividade dos canais",
      target: "channels",
      enabled: input.channels.length > 0,
      status: input.channels.some((channel) => channel.status !== "ready") ? "attention" : input.channels.length > 0 ? "ready" : "empty",
    },
    {
      id: "approvals.review",
      label: "Revisar aprovacoes",
      target: "approvals",
      enabled: input.approvals.length > 0,
      status: input.approvals.length > 0 ? "attention" : "empty",
    },
    {
      id: "artifacts.open",
      label: "Abrir artifacts",
      target: "artifacts",
      enabled: input.artifacts.length > 0,
      status: input.artifacts.length > 0 ? "ready" : "empty",
    },
    {
      id: "capabilities.review",
      label: "Ver capacidades",
      target: "capabilities",
      enabled: input.capabilities.length > 0,
      status: input.capabilities.some((capability) => capability.status === "blocked" || capability.requiresApproval)
        ? "attention"
        : input.capabilities.length > 0 ? "ready" : "empty",
    },
    {
      id: "workers.inspect",
      label: "Ver workers",
      target: "workers",
      enabled: input.workers.length > 0,
      status: input.workers.some((worker) => worker.status === "failed" || worker.status === "queued") ? "attention" : input.workers.length > 0 ? "ready" : "empty",
    },
    {
      id: "runtime.doctor",
      label: "Diagnosticar runtime",
      target: "runtime",
      enabled: true,
      status: input.runtime.status === "ready" ? "ready" : "attention",
    },
  ];
}

function buildUiState(input: {
  loading: boolean;
  runtime: ZavorthRuntimeSnapshot;
  timelines: ZavorthSessionTimeline[];
  events: ZavorthOperationalEvent[];
  error: string | null;
}): ZavorthCommandCenterUiState {
  const empty = !input.loading
    && input.timelines.length === 0
    && input.events.length === 0
    && !input.runtime.activeSessionId;
  return {
    loading: input.loading,
    empty,
    degraded: input.runtime.status === "degraded",
    offline: input.runtime.status === "offline",
    error: input.error,
    message: input.error
      ? input.error
      : input.loading
        ? "Carregando estado operacional do Zavorth."
        : empty
          ? "Nenhuma atividade operacional ainda."
          : "Command Center pronto para operar em termos Zavorth.",
  };
}

function scanValue(
  value: unknown,
  terms: string[],
  path: string,
  leaks: ZavorthCommandCenterIdentityLeak[],
): void {
  if (typeof value === "string") {
    const matched = terms.find((term) => term && value.toLowerCase().includes(term.toLowerCase()));
    if (matched) {
      leaks.push({ path, value });
    }
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanValue(entry, terms, `${path}[${index}]`, leaks));
    return;
  }
  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    const matchedKey = terms.find((term) => term && key.toLowerCase().includes(term.toLowerCase()));
    if (matchedKey) {
      leaks.push({ path: `${path}.${key}`, value: key });
    }
    scanValue(entry, terms, `${path}.${key}`, leaks);
  });
}

export function scanCommandCenterSnapshotForSourceIdentityLeaks(
  value: unknown,
  terms: string[] = [],
): ZavorthCommandCenterIdentityLeakScan {
  const leaks: ZavorthCommandCenterIdentityLeak[] = [];
  const normalizedTerms = terms.map((term) => term.trim()).filter(Boolean);
  if (normalizedTerms.length > 0) {
    scanValue(value, normalizedTerms, "$", leaks);
  }
  return {
    checked: true,
    passed: leaks.length === 0,
    leakCount: leaks.length,
    leaks,
  };
}

export function buildZavorthCommandCenterAssimilationSnapshot(
  input: ZavorthCommandCenterAssimilationInput = {},
): ZavorthCommandCenterAssimilationSnapshot {
  const generatedAt = nowIso(input.now);
  const projection = input.projection || createEmptyProjection(generatedAt);
  const transportStatus = normalizeTransportStatus(projection, input.transportStatus);
  const runtime = buildRuntimeSnapshot(projection, generatedAt, transportStatus, input.error || projection.error || null);
  const readModels = asArray(input.sessionReadModels);
  const operationalEvents = mapProjectionEvents(projection, generatedAt);
  const sessionTimelines = buildSessionTimelines(projection, readModels);
  const approvals = projection.approvals.map(mapApproval);
  const artifacts = buildArtifacts(projection, readModels);
  const channelActivity = buildChannelActivity(input.channelHealth, asArray(input.deliveryReceipts));
  const capabilities = buildCapabilities(projection, input.capabilityInventory);
  const workers = buildWorkers(projection, generatedAt, asArray(input.externalWorkers));
  const memorySignals = [
    ...projection.memorySignals,
    ...readModels.flatMap((model) => model.memorySignals),
  ];
  const uiState = buildUiState({
    loading: Boolean(input.loading || projection.loading),
    runtime,
    timelines: sessionTimelines,
    events: operationalEvents,
    error: input.error || projection.error || null,
  });

  const snapshotWithoutScan = {
    contractVersion: ZAVORTH_COMMAND_CENTER_ASSIMILATION_VERSION,
    generatedAt,
    runtime,
    operationalEvents,
    sessionTimelines,
    approvals,
    artifacts,
    channelActivity,
    capabilities,
    workers,
    memorySignals,
    workflows: buildWorkflows({
      timelines: sessionTimelines,
      channels: channelActivity,
      approvals,
      artifacts,
      capabilities,
      workers,
      runtime,
    }),
    uiState,
  };

  return {
    ...snapshotWithoutScan,
    identityLeakScan: scanCommandCenterSnapshotForSourceIdentityLeaks(
      snapshotWithoutScan,
      input.identityLeakTerms || [],
    ),
  };
}

export class ZavorthCommandCenterRealtimeStore {
  private snapshot: ZavorthCommandCenterAssimilationSnapshot;
  private readonly now: () => Date;
  private readonly identityLeakTerms: string[];

  constructor(options: {
    initial?: ZavorthCommandCenterAssimilationInput;
    now?: () => Date;
    identityLeakTerms?: string[];
  } = {}) {
    this.now = options.now || (() => new Date());
    this.identityLeakTerms = options.identityLeakTerms || [];
    this.snapshot = buildZavorthCommandCenterAssimilationSnapshot({
      ...options.initial,
      identityLeakTerms: options.initial?.identityLeakTerms || this.identityLeakTerms,
      now: this.now,
    });
  }

  public getSnapshot(): ZavorthCommandCenterAssimilationSnapshot {
    return this.snapshot;
  }

  private replaceRuntimeState(input: {
    transportStatus: ZavorthCommandCenterTransportStatus;
    status: ZavorthCommandCenterRuntimeStatus;
    error?: string | null;
  }): ZavorthCommandCenterAssimilationSnapshot {
    const generatedAt = this.now().toISOString();
    const runtime: ZavorthRuntimeSnapshot = {
      ...this.snapshot.runtime,
      status: input.status,
      transportStatus: input.transportStatus,
      generatedAt,
      healthStatus: input.status,
      summary: input.error
        ? `Command Center bloqueado: ${input.error}`
        : input.status === "ready"
          ? "Command Center pronto com projeções Zavorth-native."
          : "Command Center operando em estado de atenção.",
    };
    const uiState = buildUiState({
      loading: false,
      runtime,
      timelines: this.snapshot.sessionTimelines,
      events: this.snapshot.operationalEvents,
      error: input.error || null,
    });
    const { identityLeakScan: _previousScan, ...snapshotWithoutScan } = {
      ...this.snapshot,
      generatedAt,
      runtime,
      uiState,
    };
    this.snapshot = {
      ...snapshotWithoutScan,
      identityLeakScan: scanCommandCenterSnapshotForSourceIdentityLeaks(
        snapshotWithoutScan,
        this.identityLeakTerms,
      ),
    };
    return this.snapshot;
  }

  public apply(event: ZavorthCommandCenterRealtimeEvent): ZavorthCommandCenterAssimilationSnapshot {
    if (event.type === "projection.snapshot") {
      const { type: _type, ...input } = event;
      this.snapshot = buildZavorthCommandCenterAssimilationSnapshot({
        ...input,
        identityLeakTerms: input.identityLeakTerms || this.identityLeakTerms,
        now: this.now,
      });
      return this.snapshot;
    }

    if (event.type === "reset.empty") {
      this.snapshot = buildZavorthCommandCenterAssimilationSnapshot({
        identityLeakTerms: this.identityLeakTerms,
        now: this.now,
      });
      return this.snapshot;
    }

    if (event.type === "transport.reconnecting") {
      return this.replaceRuntimeState({
        transportStatus: "reconnecting",
        status: "degraded",
      });
    }

    if (event.type === "transport.connected") {
      return this.replaceRuntimeState({
        transportStatus: "connected",
        status: "ready",
      });
    }

    if (event.type === "transport.disconnected") {
      return this.replaceRuntimeState({
        transportStatus: "disconnected",
        status: "offline",
      });
    }

    return this.replaceRuntimeState({
      transportStatus: "connected",
      status: "blocked",
      error: event.error,
    });
  }
}
