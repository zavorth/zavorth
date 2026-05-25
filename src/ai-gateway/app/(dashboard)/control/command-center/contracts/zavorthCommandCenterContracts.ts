export const ZAVORTH_COMMAND_CENTER_ASSIMILATION_VERSION = "zavorth-command-center-assimilation/v1" as const;

export type ZavorthCommandCenterRuntimeStatus = "ready" | "degraded" | "blocked" | "offline";

export type ZavorthCommandCenterTransportStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export type ZavorthOperationalEvent = {
  id: string;
  kind: "runtime" | "session" | "channel" | "approval" | "artifact" | "capability" | "worker" | "health" | "error";
  title: string;
  detail?: string;
  status: "pending" | "running" | "done" | "failed";
  severity: "info" | "warning" | "danger";
  createdAt: string;
  runId?: string;
  sessionId?: string;
  source: "zavorth";
};

export type ZavorthRuntimeSnapshot = {
  id: "zavorth-command-center-runtime";
  status: ZavorthCommandCenterRuntimeStatus;
  transportStatus: ZavorthCommandCenterTransportStatus;
  activeSessionId?: string | null;
  summary: string;
  generatedAt: string;
  healthStatus: ZavorthCommandCenterRuntimeStatus;
  viewModelSource: "zavorth-command-center-projection";
};

export type ZavorthSessionTimelineEntry = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  text: string;
  createdAt: string;
  eventId?: string;
  replyPacketId?: string;
  artifactIds?: string[];
};

export type ZavorthSessionTimeline = {
  id: string;
  title: string;
  status: "active" | "idle" | "blocked" | "closed";
  channelLabel?: string;
  updatedAt: string;
  messageCount: number;
  entries: ZavorthSessionTimelineEntry[];
  replayId?: string;
  handoffId?: string;
};

export type ZavorthApprovalCard = {
  id: string;
  runId?: string;
  title: string;
  reason: string;
  risk: "safe" | "attention" | "danger" | "unknown";
  status: "pending" | "approved" | "rejected" | "expired";
  actionId: "approvals.open";
  createdAt: string;
};

export type ZavorthArtifactSignal = {
  id: string;
  title: string;
  kind: "file" | "report" | "diff" | "log" | "plan" | "handoff";
  status: "draft" | "ready" | "failed";
  createdAt: string;
  sessionId?: string;
};

export type ZavorthChannelActivity = {
  id: string;
  label: string;
  channel: "web" | "cli" | "telegram" | "api" | "unknown";
  status: ZavorthCommandCenterRuntimeStatus;
  inbound: boolean;
  outbound: "reply-pipeline-only" | "unavailable";
  deliveryCount: number;
  latestDeliveryStatus?: "delivered" | "dry-run" | "blocked" | "failed";
  replyPortId: string;
};

export type ZavorthCapabilityState = {
  id: string;
  label: string;
  kind: "channel" | "skill" | "tool" | "plugin" | "provider" | "mcp" | "unknown";
  status: "available" | "degraded" | "unavailable" | "blocked";
  risk: "safe" | "attention" | "danger" | "unknown";
  requiresApproval: boolean;
  policy: "allowed" | "approval-required" | "blocked" | "unavailable";
  summary?: string;
};

export type ZavorthWorkerStatus = {
  id: string;
  kind: string;
  status: "idle" | "queued" | "running" | "waiting_approval" | "completed" | "failed" | "cancelled";
  runId?: string;
  summary: string;
  updatedAt: string;
};

export type ZavorthOrdinaryUserWorkflow = {
  id:
    | "sessions.resume"
    | "channels.review"
    | "approvals.review"
    | "artifacts.open"
    | "capabilities.review"
    | "workers.inspect"
    | "runtime.doctor";
  label: string;
  target: "sessions" | "channels" | "approvals" | "artifacts" | "capabilities" | "workers" | "runtime";
  enabled: boolean;
  status: "ready" | "empty" | "attention";
};

export type ZavorthCommandCenterUiState = {
  loading: boolean;
  empty: boolean;
  degraded: boolean;
  offline: boolean;
  error: string | null;
  message: string;
};

export type ZavorthCommandCenterIdentityLeak = {
  path: string;
  value: string;
};

export type ZavorthCommandCenterIdentityLeakScan = {
  checked: true;
  passed: boolean;
  leakCount: number;
  leaks: ZavorthCommandCenterIdentityLeak[];
};

export type ZavorthCommandCenterAssimilationSnapshot = {
  contractVersion: typeof ZAVORTH_COMMAND_CENTER_ASSIMILATION_VERSION;
  generatedAt: string;
  runtime: ZavorthRuntimeSnapshot;
  operationalEvents: ZavorthOperationalEvent[];
  sessionTimelines: ZavorthSessionTimeline[];
  approvals: ZavorthApprovalCard[];
  artifacts: ZavorthArtifactSignal[];
  channelActivity: ZavorthChannelActivity[];
  capabilities: ZavorthCapabilityState[];
  workers: ZavorthWorkerStatus[];
  memorySignals: Array<{
    id: string;
    title: string;
    layer: "working" | "episodic" | "semantic" | "procedural";
    summary: string;
    confidence?: number;
  }>;
  workflows: ZavorthOrdinaryUserWorkflow[];
  uiState: ZavorthCommandCenterUiState;
  identityLeakScan: ZavorthCommandCenterIdentityLeakScan;
};
