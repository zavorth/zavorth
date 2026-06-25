import type {
  DashboardAgentEvent,
  DashboardAgentRun,
  DashboardAgentTraceEvent,
  DashboardAgentTraceKind,
  DashboardAgentTraceSnapshot,
  DashboardEventStatus,
  DashboardToolRiskLevel,
  DashboardVisibleCapability,
  DashboardVisibleCapabilityKind,
  DashboardVisibleCapabilitySideEffect,
} from "../contracts";
import {
  asArray,
  asRecord,
  asText,
  formatTimestamp,
  normalizeToolRisk,
  type DashboardCommandCenterAdapterInput,
  type LooseRecord,
} from "./dashboardCommandCenterAdapterShared";

function normalizeTraceKind(value: unknown, fallbackEvent?: DashboardAgentEvent): DashboardAgentTraceKind {
  const raw = asText(value).toLowerCase().replace(/_/g, ".");
  const candidates: DashboardAgentTraceKind[] = [
    "thinking.started",
    "thinking.summary",
    "skill.selected",
    "file.explored",
    "tool.previewed",
    "tool.awaiting_approval",
    "tool.approved",
    "tool.denied",
    "tool.executed",
    "artifact.created",
    "receipt.recorded",
    "run.completed",
    "run.failed",
    "status",
  ];
  if (candidates.includes(raw as DashboardAgentTraceKind)) {
    return raw as DashboardAgentTraceKind;
  }
  if (raw.includes("skill")) {
    return "skill.selected";
  }
  if (raw.includes("file") || raw.includes("explor")) {
    return "file.explored";
  }
  if (raw.includes("receipt")) {
    return "receipt.recorded";
  }
  if (raw.includes("artifact")) {
    return "artifact.created";
  }
  if (raw.includes("approval") && (raw.includes("wait") || raw.includes("pending"))) {
    return "tool.awaiting_approval";
  }
  if (raw.includes("approv")) {
    return "tool.approved";
  }
  if (raw.includes("deny") || raw.includes("reject")) {
    return "tool.denied";
  }
  if (raw.includes("preview")) {
    return "tool.previewed";
  }
  if (raw.includes("tool") || raw.includes("exec")) {
    return "tool.executed";
  }
  if (raw.includes("think") || raw.includes("reason")) {
    return "thinking.summary";
  }
  if (raw.includes("complete") || raw.includes("done")) {
    return "run.completed";
  }
  if (raw.includes("fail") || raw.includes("error")) {
    return "run.failed";
  }
  if (fallbackEvent?.kind === "thinking") {
    return "thinking.summary";
  }
  if (fallbackEvent?.kind === "tool") {
    return fallbackEvent.status === "pending" ? "tool.previewed" : "tool.executed";
  }
  if (fallbackEvent?.kind === "approval") {
    return "tool.awaiting_approval";
  }
  if (fallbackEvent?.kind === "artifact") {
    return "artifact.created";
  }
  if (fallbackEvent?.kind === "error") {
    return "run.failed";
  }
  return "status";
}

function formatTraceKindTitle(kind: DashboardAgentTraceKind): string {
  if (kind === "thinking.started") {
    return "Thought started";
  }
  if (kind === "thinking.summary") {
    return "Thought summary";
  }
  if (kind === "skill.selected") {
    return "Selected skill";
  }
  if (kind === "file.explored") {
    return "Explored file";
  }
  if (kind === "tool.previewed") {
    return "Prepared tool";
  }
  if (kind === "tool.awaiting_approval") {
    return "Waiting for approval";
  }
  if (kind === "tool.approved") {
    return "Approval granted";
  }
  if (kind === "tool.denied") {
    return "Approval denied";
  }
  if (kind === "tool.executed") {
    return "Ran tool";
  }
  if (kind === "artifact.created") {
    return "Created artifact";
  }
  if (kind === "receipt.recorded") {
    return "Recorded receipt";
  }
  if (kind === "run.completed") {
    return "Run completed";
  }
  if (kind === "run.failed") {
    return "Run failed";
  }
  return "Runtime update";
}

function normalizeTraceStatus(value: unknown, kind: DashboardAgentTraceKind): DashboardEventStatus {
  const status = normalizeEventStatus(value ?? kind);
  if (kind === "tool.awaiting_approval" || kind === "thinking.started") {
    return "pending";
  }
  if (kind === "run.failed") {
    return "failed";
  }
  return (status || "done") as DashboardEventStatus;
}

function sanitizeTraceSummary(value: unknown, fallback = "Evento operacional registrado."): string {
  const text = asText(value, fallback)
    .replace(/\b(chain[- ]?of[- ]?thought|raciocinio bruto|raw reasoning|hidden reasoning)\b/gi, "resumo seguro")
    .trim();
  return text || fallback;
}

function traceChipFromKind(kind: DashboardAgentTraceKind, entry?: LooseRecord, event?: DashboardAgentEvent): string {
  const explicit = asText(entry?.chipLabel ?? entry?.chip ?? entry?.toolName ?? entry?.tool ?? entry?.skillName ?? entry?.skill ?? entry?.capabilityId);
  if (explicit) {
    return explicit;
  }
  if (kind.startsWith("thinking")) {
    return "thinking";
  }
  if (kind.startsWith("skill")) {
    return "skill";
  }
  if (kind.startsWith("file")) {
    return "file";
  }
  if (kind.startsWith("tool")) {
    return asText(event?.title, "tool");
  }
  if (kind.startsWith("artifact")) {
    return "artifact";
  }
  if (kind.startsWith("receipt")) {
    return "receipt";
  }
  return "runtime";
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = asText(value).toLowerCase();
  if (["true", "yes", "sim", "1", "required"].includes(normalized)) {
    return true;
  }
  if (["false", "no", "nao", "0", "none"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function explicitCapability(entry?: LooseRecord): LooseRecord | null {
  return asRecord(entry?.capability ?? entry?.visibleCapability ?? entry?.toolExposure ?? entry?.toolProfile);
}

function normalizeCapabilityKind(value: unknown, label: string, traceKind: DashboardAgentTraceKind): DashboardVisibleCapabilityKind {
  const raw = asText(value).toLowerCase();
  if (["skill", "tool", "mcp", "file", "shell", "docker", "runtime"].includes(raw)) {
    return raw as DashboardVisibleCapabilityKind;
  }
  const name = label.toLowerCase();
  if (name.includes("docker") || name.includes("container")) {
    return "docker";
  }
  if (name.includes("mcp") || name.includes("notebook.")) {
    return "mcp";
  }
  if (name.includes("shell") || name.includes("exec") || name.includes("bash")) {
    return "shell";
  }
  if (traceKind.startsWith("skill")) {
    return "skill";
  }
  if (name.includes("file") || name.includes("read") || name.includes("write") || name.includes("patch") || traceKind === "file.explored") {
    return "file";
  }
  if (traceKind.startsWith("tool")) {
    return "tool";
  }
  return "runtime";
}

function inferCapabilitySideEffect(label: string, traceKind: DashboardAgentTraceKind, explicit?: unknown): DashboardVisibleCapabilitySideEffect {
  const raw = asText(explicit).toLowerCase();
  if (["none", "read", "write", "network", "process", "container", "unknown"].includes(raw)) {
    return raw as DashboardVisibleCapabilitySideEffect;
  }
  const normalized = label.toLowerCase();
  if (normalized.includes("docker") || normalized.includes("container")) {
    return normalized.includes("logs") || normalized.includes("list") || normalized.includes("status") ? "read" : "container";
  }
  if (normalized.includes("write") || normalized.includes("edit") || normalized.includes("patch") || normalized.includes("apply")) {
    return "write";
  }
  if (normalized.includes("shell") || normalized.includes("exec") || normalized.includes("bash") || normalized.includes("test")) {
    return "process";
  }
  if (normalized.includes("mcp") || normalized.includes("remote") || normalized.includes("notebook.")) {
    return "network";
  }
  if (normalized.includes("read") || normalized.includes("list") || traceKind === "file.explored") {
    return "read";
  }
  return traceKind.startsWith("thinking") || traceKind.startsWith("receipt") ? "none" : "unknown";
}

function inferCapabilityRisk(label: string, entry: LooseRecord | undefined, traceKind: DashboardAgentTraceKind): DashboardToolRiskLevel {
  const explicit = entry ? normalizeToolRisk(entry) : "unknown";
  if (explicit !== "unknown") {
    return explicit;
  }
  const normalized = label.toLowerCase();
  if (normalized.includes("sudo") || normalized.includes("shell") || normalized.includes("exec") || normalized.includes("delete") || normalized.includes("rm ") || normalized.includes("apply_control")) {
    return "danger";
  }
  if (normalized.includes("write") || normalized.includes("edit") || normalized.includes("patch") || normalized.includes("apply") || traceKind === "tool.awaiting_approval") {
    return "attention";
  }
  if (normalized.includes("read") || normalized.includes("list") || normalized.includes("logs") || normalized.includes("status") || traceKind === "file.explored") {
    return "safe";
  }
  return "unknown";
}

function buildCapabilityReason(label: string, kind: DashboardVisibleCapabilityKind, entry?: LooseRecord): string {
  const explicit = asText(entry?.reason ?? entry?.rationale ?? entry?.why ?? entry?.selectionReason);
  if (explicit) {
    return explicit;
  }
  if (kind === "skill") {
    return `Selecionado para preparar o run com o perfil ${label}.`;
  }
  if (kind === "docker") {
    return "Selecionado porque o pedido envolve estado de container allowlisted.";
  }
  if (kind === "mcp") {
    return "Selecionado porque a acao passa pelo notebook MCP governado.";
  }
  if (kind === "file") {
    return "Selecionado porque o run precisa operar dentro do escopo de workspace.";
  }
  if (kind === "shell") {
    return "Selecionado apenas como capacidade sensivel sujeita a policy e approval.";
  }
  return "Selecionado pelo runtime para explicar a capacidade usada neste passo.";
}

function buildVisibleCapability(
  entry: LooseRecord | undefined,
  traceKind: DashboardAgentTraceKind,
  event?: DashboardAgentEvent,
): DashboardVisibleCapability | undefined {
  const explicit = explicitCapability(entry);
  const label = asText(
    explicit?.label
      ?? explicit?.id
      ?? entry?.toolName
      ?? entry?.tool
      ?? entry?.skillName
      ?? entry?.skill
      ?? entry?.chipLabel
      ?? event?.title,
  );
  const shouldDerive = Boolean(
    explicit
      || entry?.toolName
      || entry?.tool
      || entry?.skillName
      || entry?.skill
      || traceKind.startsWith("skill")
      || traceKind.startsWith("file")
      || traceKind.startsWith("tool")
      || event?.kind === "tool"
      || event?.kind === "approval",
  );
  if (!shouldDerive) {
    return undefined;
  }
  const normalizedLabel = label || traceChipFromKind(traceKind, entry, event);
  const kind = normalizeCapabilityKind(explicit?.kind ?? entry?.capabilityKind ?? entry?.kind, normalizedLabel, traceKind);
  const risk = inferCapabilityRisk(normalizedLabel, explicit ?? entry, traceKind);
  const sideEffect = inferCapabilitySideEffect(normalizedLabel, traceKind, explicit?.sideEffect ?? entry?.sideEffect);
  const approvalDefault = risk === "danger" || traceKind === "tool.awaiting_approval" || sideEffect === "write" || sideEffect === "process" || sideEffect === "container";
  const previewDefault = approvalDefault || sideEffect !== "none" && sideEffect !== "read";

  return {
    id: asText(explicit?.id ?? entry?.capabilityId ?? entry?.toolId ?? entry?.toolName ?? entry?.skillName ?? normalizedLabel, normalizedLabel),
    label: normalizedLabel,
    kind,
    risk,
    requiresApproval: asBoolean(explicit?.requiresApproval ?? entry?.requiresApproval ?? entry?.approvalRequired, approvalDefault),
    previewRequired: asBoolean(explicit?.previewRequired ?? entry?.previewRequired, previewDefault),
    allowed: asBoolean(explicit?.allowed ?? entry?.allowed ?? entry?.allowedByScope, !approvalDefault || traceKind === "tool.approved" || traceKind === "tool.executed"),
    sideEffect,
    reason: buildCapabilityReason(normalizedLabel, kind, explicit ?? entry),
    scope: asText(explicit?.scope ?? entry?.scope ?? entry?.target ?? entry?.path ?? entry?.file ?? entry?.resource, "runtime"),
  };
}

export function mapTraceEntry(entry: LooseRecord, index: number): DashboardAgentTraceEvent {
  const eventLike = mapMessageEvent(entry, index);
  const kind = normalizeTraceKind(entry.kind ?? entry.type ?? entry.phase ?? entry.eventKind, eventLike);
  const risk = normalizeToolRisk(entry);
  return {
    id: asText(entry.id ?? entry.traceEventId ?? entry.eventId ?? entry.toolRunId, `trace-event-${index + 1}`),
    kind,
    title: asText(entry.title ?? entry.label ?? entry.name, formatTraceKindTitle(kind)),
    summary: sanitizeTraceSummary(entry.summary ?? entry.detail ?? entry.message ?? eventLike.detail, eventLike.title),
    status: normalizeTraceStatus(entry.status ?? entry.state ?? eventLike.status, kind),
    createdAt: formatTimestamp(entry.createdAt ?? entry.timestamp ?? entry.updatedAt),
    safeForUser: true,
    chipLabel: traceChipFromKind(kind, entry, eventLike),
    target: asText(entry.target ?? entry.path ?? entry.file ?? entry.resource ?? entry.scope) || undefined,
    risk,
    capability: buildVisibleCapability(entry, kind, eventLike),
    sourceEventId: asText(entry.sourceEventId ?? eventLike.id) || undefined,
    metadata: asRecord(entry.metadata) || undefined,
  };
}

function mapEventToTrace(event: DashboardAgentEvent, index: number): DashboardAgentTraceEvent {
  const kind = normalizeTraceKind(event.kind, event);
  return {
    id: `trace:${event.id || index + 1}`,
    kind,
    title: formatTraceKindTitle(kind),
    summary: sanitizeTraceSummary(event.detail, event.title),
    status: normalizeTraceStatus(event.status, kind),
    createdAt: "agora",
    safeForUser: true,
    chipLabel: traceChipFromKind(kind, undefined, event),
    risk: event.kind === "error" ? "danger" : event.kind === "approval" ? "attention" : "unknown",
    capability: buildVisibleCapability(undefined, kind, event),
    sourceEventId: event.id,
  };
}

function dedupeTraceEvents(events: DashboardAgentTraceEvent[]): DashboardAgentTraceEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = event.id || `${event.kind}:${event.title}:${event.summary}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function buildTraceSnapshot(
  input: DashboardCommandCenterAdapterInput,
  run: Pick<DashboardAgentRun, "id" | "traceId" | "sessionId"> | null,
  events: DashboardAgentEvent[],
): DashboardAgentTraceSnapshot | null {
  const rawTrace = asRecord(input.agentTrace ?? input.agentRun?.trace ?? input.state?.agentTrace ?? input.runtime?.agentTrace);
  const explicitTraceEvents = [
    ...asArray<LooseRecord>(rawTrace?.events),
    ...asArray<LooseRecord>(input.traceEvents),
    ...asArray<LooseRecord>(input.agentRun?.traceEvents),
    ...asArray<LooseRecord>(input.state?.traceEvents),
    ...asArray<LooseRecord>(input.runtime?.traceEvents),
  ].map(mapTraceEntry);
  const derivedTraceEvents = events.map(mapEventToTrace);
  const traceEvents = dedupeTraceEvents([...explicitTraceEvents, ...derivedTraceEvents]).slice(0, 32);

  if (traceEvents.length === 0) {
    return null;
  }

  const countKind = (predicate: (event: DashboardAgentTraceEvent) => boolean) =>
    traceEvents.filter(predicate).length;

  return {
    contractVersion: "zavorth-agent-trace/v1",
    generatedAt: new Date().toISOString(),
    runId: asText(rawTrace?.runId ?? run?.id) || undefined,
    traceId: asText(rawTrace?.traceId ?? run?.traceId) || undefined,
    sessionId: asText(rawTrace?.sessionId ?? run?.sessionId) || undefined,
    policy: {
      rawChainOfThoughtExposed: false,
      summariesOnly: true,
      toolCallsRequirePolicy: true,
    },
    summary: {
      eventCount: traceEvents.length,
      thinkingCount: countKind((event) => event.kind.startsWith("thinking")),
      skillCount: countKind((event) => event.kind.startsWith("skill")),
      toolCount: countKind((event) => event.kind.startsWith("tool")),
      approvalCount: countKind((event) => event.kind.includes("approval") || event.kind === "tool.awaiting_approval"),
      artifactCount: countKind((event) => event.kind.startsWith("artifact")),
      receiptCount: countKind((event) => event.kind.startsWith("receipt")),
      capabilityCount: countKind((event) => Boolean(event.capability)),
      approvalRequiredCapabilityCount: countKind((event) => Boolean(event.capability?.requiresApproval)),
      hasPendingApproval: traceEvents.some((event) => event.kind === "tool.awaiting_approval" && event.status === "pending"),
    },
    events: traceEvents,
  };
}

export function normalizeEventStatus(value: unknown): DashboardAgentEvent["status"] {
  const statusRaw = asText(value).toLowerCase();
  if (statusRaw.includes("fail") || statusRaw.includes("error")) {
    return "failed";
  }
  if (statusRaw.includes("pending") || statusRaw.includes("wait")) {
    return "pending";
  }
  if (statusRaw.includes("run") || statusRaw.includes("progress") || statusRaw.includes("thinking")) {
    return "running";
  }
  return "done";
}

function normalizeEventKind(value: unknown): DashboardAgentEvent["kind"] {
  const kind = asText(value).toLowerCase();
  if (kind.includes("tool") || kind.includes("exec")) {
    return "tool";
  }
  if (kind.includes("approval")) {
    return "approval";
  }
  if (kind.includes("artifact") || kind.includes("file")) {
    return "artifact";
  }
  if (kind.includes("error") || kind.includes("fail")) {
    return "error";
  }
  if (kind.includes("think") || kind.includes("reason")) {
    return "thinking";
  }
  return "status";
}

export function mapMessageEvent(entry: LooseRecord, index: number): DashboardAgentEvent {
  return {
    id: asText(entry.id ?? entry.eventId ?? entry.toolRunId ?? entry.name, `message-event-${index + 1}`),
    kind: normalizeEventKind(entry.kind ?? entry.type),
    title: asText(entry.title ?? entry.name ?? entry.tool ?? entry.phase, "Evento do runtime"),
    detail: asText(entry.detail ?? entry.summary ?? entry.status) || undefined,
    status: normalizeEventStatus(entry.status ?? entry.state ?? entry.phase),
  };
}
