import type {
  DashboardMemorySignal,
  DashboardReplyPortStatus,
  DashboardToolRiskLevel,
} from "../contracts";

export type LooseRecord = Record<string, any>;

export type DashboardCommandCenterAdapterInput = {
  state?: LooseRecord | null;
  runtime?: LooseRecord | null;
  activeSessionId?: string | null;
  effectiveSessionId?: string | null;
  productModeId?: string;
  productModeLabel?: string;
  runtimeStatus?: string;
  wsStatus?: "connecting" | "connected" | "disconnected";
  error?: string | null;
  loading?: boolean;
  sending?: boolean;
  sessionEntries?: LooseRecord[];
  transcriptEntries?: LooseRecord[];
  taskEntries?: LooseRecord[];
  tasks?: LooseRecord[];
  toolRuns?: LooseRecord[];
  artifacts?: LooseRecord[];
  approvals?: LooseRecord[];
  budget?: LooseRecord | null;
  budgetSnapshot?: LooseRecord | null;
  replay?: LooseRecord | null;
  replayEntries?: LooseRecord[];
  runObservatory?: LooseRecord | null;
  naturalFirstRuntime?: LooseRecord | null;
  capabilityDiscovery?: LooseRecord | null;
  universalPreviewMode?: LooseRecord | null;
  capabilityNegotiation?: LooseRecord | null;
  toolRehearsal?: LooseRecord | null;
  safetyNarrative?: LooseRecord | null;
  memoryWithReceipts?: LooseRecord | null;
  selfingDashboard?: LooseRecord | null;
  artifactMemory?: LooseRecord | null;
  personalOpsAutopilot?: LooseRecord | null;
  agentTeamCompiler?: LooseRecord | null;
  crossChannelContinuity?: LooseRecord | null;
  askBeforeAssumptionPolicy?: LooseRecord | null;
  providerMeshConsolidation?: LooseRecord | null;
  universalIntentTrustEnforcement?: LooseRecord | null;
  runArtifactReceiptReplay?: LooseRecord | null;
  home?: LooseRecord | null;
  productizationEvidence?: LooseRecord | null;
  productEntryRuntime?: LooseRecord | null;
  releaseInstallerRollbackPath?: LooseRecord | null;
  publicSiteDocsDemoSync?: LooseRecord | null;
  feedbackTelemetryProductLoop?: LooseRecord | null;
  publicAdoptionPilotLoop?: LooseRecord | null;
  integrationShowcasePartnerSurface?: LooseRecord | null;
  releaseAdoptionReadiness?: LooseRecord | null;
  releaseCandidatePreCanaryGate?: LooseRecord | null;
  blueprintCompletionGate?: LooseRecord | null;
  skillMcpQuarantine?: LooseRecord | null;
  providerArena?: LooseRecord | null;
  providerCockpit?: LooseRecord | null;
  subagentAutoInvocation?: LooseRecord | null;
  perceptionControl?: LooseRecord | null;
  nexusWorkbench?: LooseRecord | null;
  remoteMeshApprovalUx?: LooseRecord | null;
  health?: LooseRecord | null;
  healthChecks?: LooseRecord[];
  releaseStatus?: LooseRecord | null;
  integrations?: LooseRecord[];
  identity?: LooseRecord | null;
  logs?: LooseRecord[];
  workflowJobs?: LooseRecord[];
  capabilities?: LooseRecord[];
  companions?: LooseRecord[];
  topConsumers?: LooseRecord[];
  memoryRecall?: LooseRecord | null;
  memoryRecallSources?: LooseRecord[];
  runtimeWarnings?: string[];
  recommendations?: LooseRecord[];
  recommendedJourneys?: LooseRecord[];
  visibleSurfaces?: LooseRecord[];
  adapterSource?: LooseRecord | null;
  agentRun?: LooseRecord | null;
  agentEvents?: LooseRecord[];
  agentTrace?: LooseRecord | null;
  traceEvents?: LooseRecord[];
  toolExposureProfile?: LooseRecord | null;
  toolExposures?: LooseRecord[];
  replyPorts?: LooseRecord[];
  modelProfile?: LooseRecord | null;
  modelPicker?: LooseRecord | null;
  developerWorkspace?: LooseRecord | null;
};

export function asArray<T = LooseRecord>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function asText(value: unknown, fallback = ""): string {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function asRecord(value: unknown): LooseRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as LooseRecord
    : null;
}

export function formatTimestamp(value: unknown): string {
  const raw = asText(value);
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

export function normalizeToolRisk(entry: LooseRecord): DashboardToolRiskLevel {
  const riskRaw = asText(entry.risk ?? entry.riskLevel ?? entry.safety ?? entry.mode).toLowerCase();
  if (["danger", "dangerous", "high", "critical"].includes(riskRaw)) {
    return "danger";
  }
  if (["attention", "medium", "approval", "warning"].includes(riskRaw)) {
    return "attention";
  }
  if (["safe", "low", "read", "readonly"].includes(riskRaw)) {
    return "safe";
  }
  return "unknown";
}

export function normalizeMemoryLayer(value: unknown): DashboardMemorySignal["layer"] {
  const layer = asText(value).toLowerCase();
  if (["working", "episodic", "semantic", "procedural"].includes(layer)) {
    return layer as DashboardMemorySignal["layer"];
  }
  if (["hot", "shortterm", "short-term", "working-memory"].includes(layer)) {
    return "working";
  }
  if (["warm", "mnemos"].includes(layer)) {
    return "semantic";
  }
  if (["cold", "archive", "longterm", "long-term"].includes(layer)) {
    return "episodic";
  }
  return "working";
}

export function normalizeReplyPortStatus(
  value: unknown,
  fallback: DashboardReplyPortStatus,
): DashboardReplyPortStatus {
  const status = asText(value).toLowerCase();
  if (["available", "ready", "connected", "online"].includes(status)) {
    return "available";
  }
  if (["degraded", "warning", "warn"].includes(status)) {
    return "degraded";
  }
  if (["blocked", "denied", "disabled"].includes(status)) {
    return "blocked";
  }
  if (["offline", "disconnected", "down"].includes(status)) {
    return "offline";
  }
  return fallback;
}
