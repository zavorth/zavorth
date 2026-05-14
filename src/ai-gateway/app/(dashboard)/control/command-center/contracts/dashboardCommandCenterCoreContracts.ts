export type DashboardRuntimeStatus = "ready" | "degraded" | "blocked" | "offline";

export type DashboardEventStatus = "pending" | "running" | "done" | "failed";

export type DashboardAgentRunStatus =
  | "idle"
  | "queued"
  | "thinking"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type DashboardToolRiskLevel = "safe" | "attention" | "danger" | "unknown";

export type DashboardReplyPortKind = "web" | "cli" | "telegram" | "api" | "unknown";

export type DashboardReplyPortStatus = "available" | "degraded" | "blocked" | "offline";

export type DashboardRuntimeAdapterSource = {
  kind: "control-page" | "universal-agent-runtime" | "legacy-runtime" | "unknown";
  label: string;
  version?: string;
  notes?: string;
};

export type DashboardBlocker = {
  id: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "danger";
  actionId?: string;
};

export type DashboardRuntimeSnapshot = {
  status: DashboardRuntimeStatus;
  operatorLabel: string;
  currentModelLabel: string;
  currentProviderLabel: string;
  activeSessionId?: string;
  summary: string;
  blockers: DashboardBlocker[];
  wsStatus: "connecting" | "connected" | "disconnected";
};

export type DashboardToolExposure = {
  id: string;
  label: string;
  capabilityId?: string;
  risk: DashboardToolRiskLevel;
  requiresApproval: boolean;
  description?: string;
};

export type DashboardToolExposureProfile = {
  mode: "safe" | "confirm" | "restricted" | "unknown";
  summary: string;
  tools: DashboardToolExposure[];
};

export type DashboardNaturalCapabilityDiscoveryRecommendation = {
  id: string;
  label: string;
  capabilityId?: string;
  toolIds: string[];
  groups: string[];
  confidence: number;
  risk: DashboardToolRiskLevel;
  requiresApproval: boolean;
  previewRequired: boolean;
  reason: string;
  nextSafeAction: string;
};

export type DashboardNaturalCapabilityDiscoverySnapshot = {
  contractVersion: string;
  generatedAt: string;
  intentCategory: string;
  confidence: number;
  recommendedToolNames: string[];
  groups: string[];
  recommendations: DashboardNaturalCapabilityDiscoveryRecommendation[];
  safety: {
    noExecutionPerformed: boolean;
    naturalLanguageDoesNotBypassPolicy: boolean;
    highestRisk: DashboardToolRiskLevel;
    requiresApproval: boolean;
    previewRequired: boolean;
    approvalRequiredToolIds: string[];
    previewRequiredToolIds: string[];
  };
  quarantine: {
    importedCapabilityTrustPresent: boolean;
    quarantinedCount: number;
    blockedToolIds: string[];
    warning: string | null;
  };
  nextSafeAction: string;
};

export type DashboardUniversalPreviewModePlanStep = {
  id: string;
  kind: string;
  label: string;
  toolId?: string;
  risk: DashboardToolRiskLevel;
  requiresApproval: boolean;
  previewRequired: boolean;
  action: string;
  impact: string;
};

export type DashboardUniversalPreviewModeSnapshot = {
  contractVersion: string;
  generatedAt: string;
  mode: "runtime-preview" | "preview-only" | "unknown";
  planSteps: DashboardUniversalPreviewModePlanStep[];
  toolExposure: {
    mode: DashboardToolExposureProfile["mode"];
    exposedToolIds: string[];
    blockedToolIds: string[];
  };
  risk: {
    highestRisk: DashboardToolRiskLevel;
    requiresApproval: boolean;
    previewRequired: boolean;
    approvalRequiredToolIds: string[];
    previewRequiredToolIds: string[];
  };
  safety: {
    noExecutionPerformed: boolean;
    naturalLanguageDoesNotBypassPolicy: boolean;
    workspacePolicyApplies: boolean;
    approvalsStillRequired: boolean;
    selfmodApplyBlocked: boolean;
    computerUseBlockedUntilApproval: boolean;
    executorBlockedInPreviewMode: boolean;
    toolsActuallyCalled: string[];
  };
  nextSafeAction: string;
};

export type DashboardCapabilityNegotiationCapability = {
  id: string;
  label: string;
  source: string;
  toolIds: string[];
  groups: string[];
  risk: DashboardToolRiskLevel;
  permission: "none" | "preview" | "approval" | "operator" | "unknown";
  requiresApproval: boolean;
  previewRequired: boolean;
  available: boolean;
  blocked: boolean;
  reason: string;
  nextSafeAction: string;
};

export type DashboardCapabilityNegotiationSnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: "not-needed" | "proposal" | "waiting-approval" | "approved" | "blocked" | "unknown";
  decisionSource: string;
  summary: {
    capabilityCount: number;
    allowedToolCount: number;
    blockedToolCount: number;
    approvalRequired: boolean;
    previewRequired: boolean;
    highestRisk: DashboardToolRiskLevel;
    sensitiveTask: boolean;
    approvedScope: boolean;
    pathScoped: boolean;
  };
  capabilities: DashboardCapabilityNegotiationCapability[];
  scope: {
    id: string;
    summary: string;
    allowedToolIds: string[];
    blockedToolIds: string[];
    pathHints: string[];
    surfaces: string[];
    approvalRequired: boolean;
    previewRequired: boolean;
    constraints: string[];
    approved: boolean;
  };
  proposal: {
    title: string;
    summary: string;
    userQuestion: string;
    approvalId: string | null;
    requestedCapabilityIds: string[];
  } | null;
  policy: {
    noExecutionPerformed: boolean;
    naturalLanguageDoesNotBypassPolicy: boolean;
    approvedScopeLimitsTools: boolean;
    approvedScopeLimitsPaths: boolean;
    approvalsStillRequired: boolean;
    previewStillRequired: boolean;
    quarantineStillRequired: boolean;
    secretsSerialized: boolean;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    approvalHint: string;
  };
  nextSafeAction: string;
};

export type DashboardToolRehearsalCall = {
  id: string;
  order: number;
  toolId: string;
  label: string;
  risk: DashboardToolRiskLevel;
  requiresApproval: boolean;
  previewRequired: boolean;
  allowedByScope: boolean;
  blockedByScope: boolean;
  dryRunSupported: boolean;
  externalSideEffect: boolean;
  approximateArguments: Record<string, unknown>;
  expectedOutput: string;
  refusalReason: string | null;
  receipts: string[];
};

export type DashboardToolRehearsalSnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: "not-needed" | "waiting-scope" | "proposal" | "waiting-approval" | "approved" | "blocked" | "unknown";
  summary: {
    callCount: number;
    dangerousCallCount: number;
    blockedCallCount: number;
    approvalRequired: boolean;
    scopeApproved: boolean;
    scopeId: string | null;
    highestRisk: DashboardToolRiskLevel;
    budgetAllowed: boolean;
    rehearsalRequired: boolean;
  };
  calls: DashboardToolRehearsalCall[];
  adjustments: Array<{
    id: string;
    label: string;
    detail: string;
    commandHint: string;
  }>;
  approval: {
    required: boolean;
    approvalId: string | null;
    title: string;
    question: string;
  };
  policy: {
    noToolExecuted: boolean;
    noFilesystemMutation: boolean;
    noShellSpawned: boolean;
    noNetworkCall: boolean;
    approximateArgumentsOnly: boolean;
    realExecutionLimitedToRehearsedScope: boolean;
    approvalsStillRequired: boolean;
    previewStillRequired: boolean;
    secretsSerialized: boolean;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    approvalHint: string;
  };
  nextSafeAction: string;
};

export type DashboardSafetyNarrativeReason = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  risk: DashboardToolRiskLevel;
  source: string;
  toolIds: string[];
  redactionApplied: boolean;
};

export type DashboardSafetyNarrativeAlternative = {
  id: string;
  label: string;
  detail: string;
  commandHint?: string;
  safe: boolean;
  requiresApproval: boolean;
};

export type DashboardSafetyNarrativeSnapshot = {
  contractVersion: string;
  generatedAt: string;
  status: "clear" | "explaining" | "waiting-approval" | "blocked" | "failed" | "unknown";
  highRiskBlockPresent: boolean;
  summary: string;
  userMessage: string;
  reasons: DashboardSafetyNarrativeReason[];
  alternatives: DashboardSafetyNarrativeAlternative[];
  redaction: {
    pathRedactionApplied: boolean;
    secretRedactionApplied: boolean;
    sensitivePathCount: number;
    secretCount: number;
    rawSecretSerialized: boolean;
  };
  policy: {
    naturalLanguageDoesNotBypassPolicy: boolean;
    alternativesDoNotExecute: boolean;
    workspaceBoundaryRespected: boolean;
    approvalsRemainRequired: boolean;
    previewRemainsRequired: boolean;
    quarantineRemainsRequired: boolean;
  };
  nextSafeAction: string;
};

export type DashboardReplyPort = {
  id: string;
  label: string;
  kind: DashboardReplyPortKind;
  status: DashboardReplyPortStatus;
  primary?: boolean;
  description?: string;
};

export type DashboardModelProfile = {
  providerLabel: string;
  modelLabel: string;
  routingPolicy: "direct" | "gateway" | "fallback" | "unknown";
  fallbackModelLabel?: string;
  routeId?: string;
  familyId?: string;
  selectionSource?: string;
  readiness?: string;
  ready?: boolean;
  fallbackOrder?: string[];
  selectionExplanation?: string[];
  supportsTools?: boolean;
  supportsVision?: boolean;
  supportsStreaming?: boolean;
};

export type DashboardSessionSummary = {
  id: string;
  title: string;
  updatedAt: string;
  status: "active" | "idle" | "blocked" | "closed";
  channelLabel?: string;
  messageCount?: number;
};

export type DashboardAgentEvent = {
  id: string;
  kind: "thinking" | "tool" | "approval" | "artifact" | "error" | "status";
  title: string;
  detail?: string;
  status?: DashboardEventStatus;
};

export type DashboardAgentTraceKind =
  | "thinking.started"
  | "thinking.summary"
  | "skill.selected"
  | "file.explored"
  | "tool.previewed"
  | "tool.awaiting_approval"
  | "tool.approved"
  | "tool.denied"
  | "tool.executed"
  | "artifact.created"
  | "receipt.recorded"
  | "run.completed"
  | "run.failed"
  | "status";

export type DashboardVisibleCapabilityKind =
  | "skill"
  | "tool"
  | "mcp"
  | "file"
  | "shell"
  | "docker"
  | "runtime";

export type DashboardVisibleCapabilitySideEffect =
  | "none"
  | "read"
  | "write"
  | "network"
  | "process"
  | "container"
  | "unknown";

export type DashboardVisibleCapability = {
  id: string;
  label: string;
  kind: DashboardVisibleCapabilityKind;
  risk: DashboardToolRiskLevel;
  requiresApproval: boolean;
  previewRequired: boolean;
  allowed: boolean;
  sideEffect: DashboardVisibleCapabilitySideEffect;
  reason: string;
  scope: string;
};

export type DashboardAgentTraceEvent = {
  id: string;
  kind: DashboardAgentTraceKind;
  title: string;
  summary: string;
  status: DashboardEventStatus;
  createdAt: string;
  safeForUser: true;
  chipLabel?: string;
  target?: string;
  risk?: DashboardToolRiskLevel;
  capability?: DashboardVisibleCapability;
  sourceEventId?: string;
  metadata?: Record<string, unknown>;
};

export type DashboardAgentTraceSnapshot = {
  contractVersion: "zavorth-agent-trace/v1";
  generatedAt: string;
  runId?: string;
  traceId?: string;
  sessionId?: string;
  policy: {
    rawChainOfThoughtExposed: false;
    summariesOnly: true;
    toolCallsRequirePolicy: true;
  };
  summary: {
    eventCount: number;
    thinkingCount: number;
    skillCount: number;
    toolCount: number;
    approvalCount: number;
    artifactCount: number;
    receiptCount: number;
    capabilityCount: number;
    approvalRequiredCapabilityCount: number;
    hasPendingApproval: boolean;
  };
  events: DashboardAgentTraceEvent[];
};

export type DashboardNaturalFirstRuntimeSnapshot = {
  contractVersion: "natural-first-command-center-ux/8";
  generatedAt: string;
  route: string;
  routeLabel: string;
  status:
    | "received"
    | "classified"
    | "light-reply"
    | "llm-reply"
    | "memory-recall"
    | "tool-preview"
    | "approval-required"
    | "governed-execution"
    | "completed"
    | "unknown";
  tone: DashboardRuntimeStatus;
  headline: string;
  detail: string;
  receivedText: string;
  inputKind: string;
  shouldEnterGateway: boolean;
  channel: string;
  costTier: string;
  effort: string;
  usesLlm: string;
  risk: {
    level: DashboardToolRiskLevel;
    requiresApproval: boolean;
    previewRequired: boolean;
    reasons: string[];
  };
  stages: Array<{
    id: string;
    label: string;
    detail: string;
    status: "done" | "pending" | "blocked";
  }>;
  policies: {
    noExecutorForLightChat: boolean;
    noToolExecutionBeforeApproval: boolean;
    noMemoryInvented: boolean;
    noApprovalBypass: boolean;
    gracefulLlmFallback: boolean;
  };
  nextSafeAction: string;
};

export type DashboardAgentRun = {
  id: string;
  traceId?: string;
  requestId?: string;
  title: string;
  status: DashboardAgentRunStatus;
  sessionId?: string;
  startedAt?: string;
  updatedAt: string;
  summary: string;
  providerLabel?: string;
  modelLabel?: string;
  events: DashboardAgentEvent[];
  trace: DashboardAgentTraceSnapshot | null;
  metadata?: Record<string, unknown>;
};

export type DashboardChatMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  text: string;
  createdAt: string;
  modelLabel?: string;
  events?: DashboardAgentEvent[];
  trace?: DashboardAgentTraceEvent[];
};

export type DashboardArtifactSummary = {
  id: string;
  title: string;
  kind: "file" | "report" | "diff" | "log" | "plan" | "handoff";
  createdAt: string;
  sessionId?: string;
  status: "draft" | "ready" | "failed";
};

export type DashboardMemorySignal = {
  id: string;
  title: string;
  layer: "working" | "episodic" | "semantic" | "procedural";
  summary: string;
  confidence?: number;
};

export type DashboardMemoryWithReceipt = {
  id: string;
  memoryId: string;
  title: string;
  layer: "working" | "episodic" | "semantic" | "procedural";
  summary: string;
  source: string;
  sourceType: string;
  createdAt: string;
  confidence: number;
  confidenceLabel: "low" | "medium" | "high";
  observatoryReceiptId?: string;
  origin: {
    kind: string;
    ref: string | null;
    artifactId?: string;
    eventId?: string;
  };
  actions: {
    reviewCommand: string;
    askSourceCommand: string;
    forgetCommand: string;
    correctCommand: string;
  };
};

export type DashboardMemoryWithReceiptsSnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  summary: {
    memoryCount: number;
    receiptCount: number;
    layers: DashboardMemoryWithReceipt["layer"][];
    averageConfidence: number | null;
    lowConfidenceCount: number;
  };
  receipts: DashboardMemoryWithReceipt[];
  audit: {
    allMemoryHasReceipt: boolean;
    canAnswerSourceQuestion: boolean;
    canForgetOrCorrect: boolean;
    runObservatoryLinked: boolean;
    noMemoryInvented: boolean;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    sourceQuestionHint: string;
  };
  nextSafeAction: string;
};
