import type {
  RemoteMeshNotebookApprovalUxSnapshot,
} from "../../../../../../contracts/RemoteMeshNotebookApprovalUxContract.js";
import type {
  DashboardAgentEvent,
  DashboardAgentRun,
  DashboardAgentTraceSnapshot,
  DashboardAgentRunStatus,
  DashboardArtifactSummary,
  DashboardChatMessage,
  DashboardHealthSnapshot,
  DashboardIdentitySnapshot,
  DashboardIntegrationSummary,
  DashboardLogEntry,
  DashboardMemorySignal,
  DashboardModelProfile,
  DashboardNaturalFirstRuntimeSnapshot,
  DashboardReplyPort,
  DashboardReplaySummary,
  DashboardRuntimeAdapterSource,
  DashboardRuntimeSnapshot,
  DashboardRuntimeStatus,
  DashboardSessionSummary,
  DashboardToolExposureProfile,
  DashboardToolRiskLevel,
} from "./dashboardCommandCenterCoreContracts.js";
import type {
  DashboardAgentTeamCompilerSnapshot,
  DashboardArtifactMemorySnapshot,
  DashboardAskBeforeAssumptionPolicySnapshot,
  DashboardCapabilityNegotiationSnapshot,
  DashboardCrossChannelContinuitySnapshot,
  DashboardMemoryWithReceiptsSnapshot,
  DashboardNaturalCapabilityDiscoverySnapshot,
  DashboardPersonalOpsAutopilotSnapshot,
  DashboardSafetyNarrativeSnapshot,
  DashboardSelfingDashboardSnapshot,
  DashboardToolRehearsalSnapshot,
  DashboardUniversalPreviewModeSnapshot,
} from "./dashboardCommandCenterCapabilityContracts.js";
import type {
  DashboardProductEntryRuntimeSnapshot,
  DashboardProductizationEvidenceSnapshot,
  DashboardReleaseInstallerRollbackPathSnapshot,
  DashboardRunArtifactReceiptReplaySnapshot,
  DashboardUniversalIntentTrustEnforcementSnapshot,
} from "./dashboardCommandCenterProductContracts.js";
import type {
  DashboardFeedbackTelemetryProductLoopSnapshot,
  DashboardIntegrationShowcasePartnerSurfaceSnapshot,
  DashboardPublicAdoptionPilotLoopSnapshot,
  DashboardPublicSiteDocsDemoSyncSnapshot,
} from "./dashboardCommandCenterAdoptionContracts.js";
import type {
  DashboardBlueprintCompletionGateSnapshot,
  DashboardProviderMeshConsolidationSnapshot,
  DashboardReleaseAdoptionReadinessSnapshot,
  DashboardReleaseCandidatePreCanaryGateSnapshot,
} from "./dashboardCommandCenterReleaseContracts.js";

export type DashboardSkillMcpQuarantineEntry = {
  id: string;
  kind: "skill" | "mcp";
  trustState: "trusted" | "safe" | "quarantined";
  riskLevel: "low" | "medium" | "high";
  quarantined: boolean;
  requiresReview: boolean;
  canExposeToModel: boolean;
  canExposeTools: boolean;
  toolNames: string[];
  reasons: string[];
  origin: {
    source: string;
    ref: string | null;
  };
  actions: {
    inspectCommand: string;
    reviewCommand: string;
    promoteCommand: string;
    keepQuarantinedCommand: string;
  };
};

export type DashboardSkillMcpQuarantineSnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  summary: {
    total: number;
    trusted: number;
    safe: number;
    quarantined: number;
    reviewRequired: number;
    blockedToolCount: number;
  };
  entries: DashboardSkillMcpQuarantineEntry[];
  receipts: Array<{
    id: string;
    kind: "skill" | "mcp" | "policy";
    detail: string;
  }>;
  policy: {
    externalImportsNeverTrustedAutomatically: boolean;
    quarantinedToolsHidden: boolean;
    toolExposureGatedByImportedCapabilityTrust: boolean;
    noMarketplaceInstallPerformed: boolean;
    promotionsRequireExplicitOperatorAction: boolean;
    naturalLanguageDoesNotBypassQuarantine: boolean;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    reviewHint: string;
  };
  nextSafeAction: string;
};

export type DashboardProviderArenaCandidate = {
  id: string;
  routeId: string;
  providerId: string;
  providerLabel: string;
  modelLabel: string;
  familyId: string;
  routeKind: string;
  readiness: string;
  ready: boolean;
  healthStatus: "healthy" | "unhealthy" | "unknown" | "not_applicable";
  capabilityScore: number;
  costScore: number;
  latencyScore: number;
  reliabilityScore: number;
  healthScore: number;
  overallScore: number;
  source: string;
  explanation: string[];
  fallbackRouteIds: string[];
  receipts: string[];
};

export type DashboardProviderArenaSnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  summary: {
    candidateCount: number;
    readyCandidateCount: number;
    fallbackUsed: boolean;
    routeObserved: boolean;
    budgetObserved: boolean;
    observatoryReceiptCount: number;
    hasProviderEvidence: boolean;
    recommendedProviderLabel: string;
    recommendedModelLabel: string;
    recommendedFamilyId: string;
    decisionSource: string;
  };
  selected: {
    candidateId: string | null;
    providerLabel: string;
    modelLabel: string;
    routeId: string | null;
    source: string;
    explanation: string[];
  };
  candidates: DashboardProviderArenaCandidate[];
  comparison: {
    recommendedCandidateId: string | null;
    configuredCandidateId: string | null;
    learnedCandidateId: string | null;
    fallbackCandidateIds: string[];
    decisionSource: string;
    explanation: string[];
  };
  receipts: Array<{
    id: string;
    kind: "run-observatory" | "route" | "budget" | "model-picker" | "policy";
    source: string;
    detail: string;
    status: "pending" | "done" | "failed";
    observatoryReceiptId?: string;
  }>;
  policy: {
    noProviderExecutionPerformed: boolean;
    usesRunObservatoryReceipts: boolean;
    comparesConfiguredAndObservedRoute: boolean;
    doesNotOverrideModelPicker: boolean;
    fallbackVisible: boolean;
    secretsSerialized: boolean;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    arenaHint: string;
  };
  nextSafeAction: string;
};

export type DashboardProviderCockpitAction = {
  id: string;
  label: string;
  command: string;
  kind: "read" | "probe_packet" | "live_probe" | "configure" | "select";
  providerId: string | null;
  risk: "read" | "sensitive";
  requiresApproval: boolean;
  dashboardCanExecute: false;
  summary: string;
};

export type DashboardProviderCockpitCard = {
  id: string;
  providerId: string;
  title: string;
  status: "ready" | "missing_auth" | "missing_base_url" | "needs_probe" | "degraded" | "unsupported" | "blocked";
  liveStatus: "not_run" | "passed" | "failed" | "blocked";
  priority: "primary" | "normal" | "blocked";
  model: string | null;
  summary: string;
  evidence: {
    liveNetworkUsed: boolean;
    target: string | null;
    httpStatus: number | null;
    durationMs: number | null;
    modelCount: number | null;
    evidenceHash: string | null;
  };
  actions: DashboardProviderCockpitAction[];
};

export type DashboardProviderCockpitSnapshot = {
  contractVersion: string;
  schemaVersion: 1;
  surface: "command-center-provider-cockpit";
  generatedAt: string;
  status: "ready" | "attention" | "blocked";
  visualMutationApplied: boolean;
  executionAuthority: boolean;
  selectedProviderId: string | null;
  summary: {
    totalProviders: number;
    readyProviders: number;
    livePassed: number;
    liveFailed: number;
    liveBlocked: number;
    missingAuth: number;
    missingBaseUrl: number;
    needsProbe: number;
  };
  cards: DashboardProviderCockpitCard[];
  actions: DashboardProviderCockpitAction[];
  healthChecks: Array<{
    id: string;
    label: string;
    status: "ready" | "attention" | "blocked";
    detail: string;
  }>;
  receipts: Array<{
    id: string;
    kind: "matrix" | "live-evidence" | "safety";
    status: "recorded" | "not-run" | "blocked";
    providerId: string | null;
    detail: string;
    evidenceHash: string | null;
  }>;
  commandCenterProjection: {
    route: "/control";
    endpoint: "/api/providers/readiness";
    renderMode: "projection-only";
    visualApprovalRequired: boolean;
    canRenderCardsAfterApproval: boolean;
  };
  safety: {
    noRawProviderSecrets: boolean;
    normalRenderMakesNoNetworkCalls: boolean;
    liveProbeRequiresExplicitOperatorAction: boolean;
    commandCenterCannotExecuteProviderCalls: boolean;
  };
  nextAction: string;
};

export type DashboardTaskSummary = {
  id: string;
  title: string;
  status: DashboardAgentRunStatus;
  summary: string;
  runId?: string;
  sessionId?: string;
  currentStep?: string;
  updatedAt: string;
};

export type DashboardRunObservatoryQuery = {
  runId?: string | null;
  traceId?: string | null;
  sessionId?: string | null;
  status?: DashboardAgentRunStatus | DashboardAgentRunStatus[] | null;
  limit?: number | null;
};

export type DashboardRunObservatoryRun = {
  id: string;
  traceId?: string;
  requestId?: string;
  sessionId?: string;
  title: string;
  status: DashboardAgentRunStatus;
  summary: string;
  updatedAt: string;
  providerLabel?: string;
  modelLabel?: string;
  eventCount: number;
  artifactCount: number;
  approvalCount: number;
  matchedBy: Array<"runId" | "traceId" | "sessionId" | "status" | "recent">;
};

export type DashboardRunObservatoryReceiptKind =
  | "input"
  | "planning"
  | "memory"
  | "tool"
  | "approval"
  | "artifact"
  | "reply"
  | "error"
  | "status"
  | "budget"
  | "model-route"
  | "capability"
  | "workflow";

export type DashboardRunObservatoryReceipt = {
  id: string;
  runId: string;
  traceId?: string;
  sessionId?: string;
  kind: DashboardRunObservatoryReceiptKind;
  source: string;
  title: string;
  detail?: string;
  status: string;
  createdAt: string;
};

export type DashboardRunObservatoryTimelineEvent = DashboardRunObservatoryReceipt & {
  relativeOrder: number;
  receiptId: string;
};

export type DashboardRunObservatorySidecarCard = {
  id: string;
  name: string;
  enabled: boolean;
  running: boolean;
  ready: boolean;
  baseUrl?: string | null;
  checkedAt?: string | null;
  message?: string | null;
};

export type DashboardRunObservatorySidecarReceipt = {
  id: string;
  sidecarId: string;
  kind: "shell" | "browser";
  action: string;
  status: "succeeded" | "failed" | "blocked";
  createdAt: string;
  auditId: string;
  runtime: string;
  isolationLevel: string;
  durationMs: number | null;
  exitCode: number | null;
  summary: string;
};

export type DashboardRunObservatorySidecars = {
  health: DashboardRunObservatorySidecarCard[];
  receipts: {
    contractVersion: string;
    generatedAt: string;
    totalReceipts: number;
    recentReceipts: DashboardRunObservatorySidecarReceipt[];
    summary: {
      shellReceipts: number;
      browserReceipts: number;
      succeeded: number;
      failed: number;
      blocked: number;
    };
  };
  summary: {
    totalSidecars: number;
    readySidecars: number;
    attentionSidecars: number;
    recentReceiptCount: number;
  };
};

export type DashboardRunObservatoryDiffPreview = {
  id: string;
  runId: string;
  traceId?: string;
  sessionId?: string;
  receiptId: string;
  planId: string | null;
  title: string;
  status: string;
  approvalRequired: boolean;
  applied: boolean;
  summary: string;
  text: string;
  observability: {
    draftReady: boolean;
    planGenerated: boolean;
    mutationPlaneStatus: string;
    mutationPlaneApprovalStatus: string;
    approvalPath: string;
    approvalReason: string;
    riskGateDecision: string;
    riskGateCanExecuteNow: boolean;
    draftLatencyMs: number | null;
    applyState: string;
    liveActionApplied: boolean;
  };
  files: Array<{
    path: string;
    operation: string;
    status: string;
    hunkCount: number;
  }>;
  actions: {
    approveApplyLabel: string;
    approveApplyInstruction: string;
    rollbackLabel: string;
    rollbackInstruction: string;
    rollbackArtifactPath: string | null;
    commandCenterPath: string;
  };
};

export type DashboardIntelligenceFabricHealthSnapshot = {
  contractVersion: string;
  generatedAt: string;
  status: "ready" | "attention" | "degraded";
  recommendation: "maintain_default" | "observe" | "auto_demote_controlled";
  summary: {
    runs: number;
    fabricRuns: number;
    observedRuns: number;
    disabledRuns: number;
    fallbackCurrentRuntimeRuns: number;
    errorFallbackRuns: number;
    orientedRuns: number;
    fallbackRate: number;
    errorFallbackRate: number;
    disabledRate: number;
    orientationRate: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
  };
  thresholds: {
    minRuns: number;
    maxFallbackRate: number;
    maxErrorFallbackRate: number;
    maxDisabledRate: number;
    maxAverageLatencyMs: number;
    maxP95LatencyMs: number;
  };
  surfaces: Array<{
    surface: string;
    runs: number;
    observed: number;
    disabled: number;
    fallbackCurrentRuntime: number;
    errorFallback: number;
    oriented: number;
    averageLatencyMs: number;
  }>;
  findings: Array<{
    id: string;
    severity: "info" | "warning" | "blocker";
    message: string;
  }>;
  rollback: {
    available: boolean;
    demoteMode: "disabled";
    instruction: string;
    destructive: boolean;
  };
  receipts: string[];
};

export type DashboardLlmRuntimeTelemetrySnapshot = {
  contractVersion: string;
  generatedAt: string;
  summary: {
    totalAttempts: number;
    succeeded: number;
    failed: number;
    skippedUnavailable: number;
    fallbackAttempts: number;
    fallbackRate: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
    providerCount: number;
    surfaceCount: number;
  };
  providers: Array<{
    providerName: string;
    attempts: number;
    succeeded: number;
    failed: number;
    skippedUnavailable: number;
    fallbackAttempts: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
    lastStatus: "skipped_unavailable" | "failed" | "succeeded";
    lastError?: string;
    lastAttemptAt: string;
    models: string[];
  }>;
  surfaces: Array<{
    surface: string;
    attempts: number;
    fallbackAttempts: number;
    fallbackRate: number;
    averageLatencyMs: number;
    p95LatencyMs: number;
  }>;
  recentAttempts: Array<{
    id: string;
    recordedAt: string;
    runId: string | null;
    traceId: string | null;
    sessionId: string | null;
    surface: string;
    requestedProviderName: string;
    primaryProviderName: string;
    providerName: string;
    modelName: string | null;
    status: "skipped_unavailable" | "failed" | "succeeded";
    fallback: boolean;
    fallbackAllowed: boolean;
    durationMs: number;
    error?: string;
  }>;
  receipts: string[];
};

export type DashboardRunObservatorySnapshot = {
  contractVersion?: string;
  generatedAt: string;
  query: DashboardRunObservatoryQuery;
  totalRuns: number;
  matchedRuns: number;
  summary?: {
    totalRuns: number;
    matchedRuns: number;
    eventCount: number;
    artifactCount: number;
    approvalCount: number;
    pendingApprovalCount: number;
    memorySignalCount: number;
    receiptCount: number;
    replayableRunCount: number;
    failedRunCount: number;
    waitingApprovalRunCount: number;
    runningRunCount: number;
  };
  health?: {
    status: "ready" | "attention" | "degraded";
    issues: string[];
    nextSafeAction: string;
    receiptsAvailable: boolean;
    replayAvailable: boolean;
    staleRunCount: number;
  };
  indexes: {
    runIds: string[];
    traceIds: string[];
    sessionIds: string[];
    statuses: Array<{
      status: DashboardAgentRunStatus;
      count: number;
    }>;
  };
  runSummaries?: Array<{
    id: string;
    traceId?: string;
    requestId?: string;
    sessionId?: string;
    title: string;
    status: DashboardAgentRunStatus;
    channel?: string;
    providerLabel?: string;
    modelLabel?: string;
    eventCount: number;
    artifactCount: number;
    approvalCount: number;
    pendingApprovalCount: number;
    memorySignalCount: number;
    receiptCount: number;
    replayable: boolean;
    hasError: boolean;
    firstEventAt: string | null;
    lastEventAt: string;
  }>;
  runs: DashboardRunObservatoryRun[];
  timeline?: DashboardRunObservatoryTimelineEvent[];
  receipts?: DashboardRunObservatoryReceipt[];
  diffPreviews?: DashboardRunObservatoryDiffPreview[];
  intelligenceFabricHealth?: DashboardIntelligenceFabricHealthSnapshot;
  llmTelemetry?: DashboardLlmRuntimeTelemetrySnapshot;
  sidecars?: DashboardRunObservatorySidecars;
  replay?: {
    available: boolean;
    runCount: number;
    eventCount: number;
    artifactCount: number;
    receiptCount: number;
    anchors: Array<{
      id: string;
      runId: string;
      traceId?: string;
      label: string;
      kind: DashboardRunObservatoryReceiptKind;
      status: string;
      createdAt: string;
    }>;
    commandHints: string[];
    summary: string;
  };
  surface?: {
    commandCenterPath: string;
    cliCommand: string;
    filterHints: string[];
  };
};

export type DashboardApprovalSummary = {
  id: string;
  runId?: string;
  title: string;
  reason: string;
  risk: DashboardToolRiskLevel;
  status: "pending" | "approved" | "rejected" | "expired";
  command?: string;
  scope?: string;
  createdAt: string;
};

export type DashboardBudgetSnapshot = {
  status: "unknown" | "ok" | "attention" | "exceeded";
  summary: string;
  source?: string;
  reason?: string;
  currency?: string;
  estimatedCost?: number;
  spent?: number;
  tokenBudget?: number;
  tokensUsed?: number;
  estimatedCostUnits?: number;
  maxEstimatedCostUnits?: number;
  inputChars?: number;
  requestedToolCount?: number;
  exposedToolCount?: number;
};

export type DashboardReplaySummary = {
  id: string;
  runId?: string;
  title: string;
  status: "none" | "pending" | "available" | "failed";
  summary: string;
  eventCount: number;
  artifactCount: number;
  updatedAt: string;
};

export type DashboardHealthCheck = {
  id: string;
  label: string;
  status: DashboardRuntimeStatus;
  detail?: string;
  actionId?: string;
};

export type DashboardHealthSnapshot = {
  status: DashboardRuntimeStatus;
  summary: string;
  checks: DashboardHealthCheck[];
};

export type DashboardReleaseStatus = {
  status: "unknown" | "preview_ready" | "stable" | "update_available" | "blocked";
  channel: "unknown" | "preview" | "stable" | "lts" | "dev";
  summary: string;
  version?: string;
  rollbackAvailable: boolean;
  updatedAt?: string;
};

export type DashboardIntegrationSummary = {
  id: string;
  label: string;
  category: "provider" | "channel" | "mcp" | "storage" | "runtime" | "unknown";
  status: "connected" | "degraded" | "disabled" | "missing";
  detail?: string;
};

export type DashboardIdentitySnapshot = {
  agentName: string;
  userName: string;
  language: string;
  tone: string;
  initiative: "low" | "balanced" | "high" | "unknown";
  firstRunStatus: "pending" | "complete" | "unknown";
  summary: string;
};

export type DashboardLogEntry = {
  id: string;
  level: "debug" | "info" | "warn" | "error";
  source: string;
  message: string;
  createdAt: string;
  runId?: string;
};

export type DashboardCommandAction = {
  id: string;
  label: string;
  description: string;
  group: "navigate" | "runtime" | "session" | "approval" | "settings";
  danger?: boolean;
};

export type DashboardNavigationSector = {
  id:
    | "terminal"
    | "overview"
    | "workspace"
    | "gateway"
    | "sales-os"
    | "channels"
    | "instances"
    | "sessions"
    | "usage"
    | "agents"
    | "skills"
    | "nodes"
    | "dreams"
    | "config"
    | "docs"
    | "cron";
  label: string;
  title: string;
  enabled: boolean;
  badgeCount?: number;
};

export type DashboardNexusWorkbenchAction = {
  id: string;
  label: string;
  description: string;
  kind: "safe_execution" | "approval_resolution" | "capability_readiness" | "navigation" | "unknown";
  method: string;
  route: string;
  risk: string;
  prompt?: string;
};

export type DashboardNexusWorkbenchPendingApproval = {
  id: string;
  action: string;
  reason: string;
  requestedAt: string;
  status: string;
  resolveRoute: string;
};

export type DashboardNexusWorkbenchRecentExecution = {
  id: string;
  timestamp: string;
  prompt: string;
  status: string;
  durationMs?: number;
  tools: string[];
  finalResponse: string;
};

export type DashboardNexusWorkbenchSnapshot = {
  status: "ready" | "needs-confirmation" | "fallback" | "degraded" | "offline";
  headline: string;
  generatedAt: string;
  operatorExperience: {
    statusLabel: string;
    tone: "ok" | "attention" | "warning" | "decision" | "fallback";
    primaryMessage: string;
    nextStep: string;
    cards: Array<{
      id: string;
      label: string;
      value: string;
      tone: "ok" | "attention" | "warning" | "decision" | "fallback";
      detail: string;
    }>;
  };
  runtime: {
    primary: string;
    primaryLabel: string;
    agentGatewayAvailable: boolean;
    echoFallbackAvailable: boolean;
  };
  execution: {
    recentCount: number;
    recent: DashboardNexusWorkbenchRecentExecution[];
  };
  approvals: {
    pendingCount: number;
    pending: DashboardNexusWorkbenchPendingApproval[];
  };
  capabilities: {
    totalTools: number;
    categories: Record<string, number>;
    lifecycleCount: number;
    maturityCount: number;
    nextAction: string;
    provisionedEdges: Array<{
      id: string;
      label: string;
      status: string;
      publicStatus: string;
      runtimeTruth: string;
      ownerLayer: string;
      commands: string[];
      limitations: string[];
      nextStep: string;
      readiness: {
        itemId: string;
        label: string;
        kind: string;
        status: string;
        nextAction: string;
        blockers: string[];
        checks: Array<{
          id: string;
          kind: string;
          status: string;
          summary: string;
        }>;
      } | null;
    }>;
  };
  echoExperience: {
    status: string;
    providerName: string;
    model: string;
    online: boolean;
    latencyMs?: number;
    recentExecutions: number;
    voiceRequests: number;
    watchModeNextAction: string | null;
  };
  actions: DashboardNexusWorkbenchAction[];
  receipts: string[];
};

export type DashboardSubagentAutoInvocationSnapshot = {
  contractVersion: string;
  generatedAt: string;
  status: "auto-selected" | "approval-required" | "skipped" | "unknown";
  selectedBy: string;
  action: string;
  mode: string;
  channel: string;
  confidence: number;
  live: boolean;
  badges: string[];
  roles: Array<{
    roleId: string;
    label: string;
    whySelected: string;
  }>;
  triggers: string[];
  riskSignals: string[];
  publicRationale: string;
  nextSafeAction: string;
  safety: {
    noRawChainOfThought: boolean;
    noSecretValuesSerialized: boolean;
    readOnlyOnly: boolean;
    approvalsRequiredForMutation: boolean;
  };
  operational: {
    runId: string | null;
    traceId: string | null;
    requestId: string | null;
    sessionId: string | null;
    selectedSessionId: string | null;
    selectedRunId: string | null;
    runtimeStatus: string;
    activeSessions: number;
    liveRuns: number;
    workerResults: number;
    failedWorkerResults: number;
    approvalRequiredRuns: number;
    deniedRuns: number;
    lastUpdatedAt: string;
  };
  actions: Array<{
    id: string;
    label: string;
    command: string;
    style: "primary" | "secondary" | "success" | "danger";
    requiresApproval: boolean;
    reason: string;
  }>;
  timeline: Array<{
    id: string;
    title: string;
    detail: string;
    status: "pending" | "running" | "done" | "failed" | "unknown";
    createdAt: string;
  }>;
  receipts: Array<{
    id: string;
    kind: string;
    status: string;
    reason: string;
  }>;
  surface: {
    commandCenterPath: string;
    cliCommand: string;
    channelCommand: string;
    reviewHint: string;
  };
};

export type DashboardCommandCenterViewModel = {
  contractVersion: "command-center-runtime-contract/v1";
  generatedAt: string;
  adapterSource: DashboardRuntimeAdapterSource;
  runtime: DashboardRuntimeSnapshot;
  agentRun: DashboardAgentRun | null;
  tasks: DashboardTaskSummary[];
  runObservatory: DashboardRunObservatorySnapshot;
  approvals: DashboardApprovalSummary[];
  naturalFirstRuntime: DashboardNaturalFirstRuntimeSnapshot | null;
  capabilityDiscovery: DashboardNaturalCapabilityDiscoverySnapshot | null;
  universalPreviewMode: DashboardUniversalPreviewModeSnapshot | null;
  capabilityNegotiation: DashboardCapabilityNegotiationSnapshot | null;
  toolRehearsal: DashboardToolRehearsalSnapshot | null;
  safetyNarrative: DashboardSafetyNarrativeSnapshot | null;
  memoryWithReceipts: DashboardMemoryWithReceiptsSnapshot | null;
  selfingDashboard: DashboardSelfingDashboardSnapshot | null;
  artifactMemory: DashboardArtifactMemorySnapshot | null;
  personalOpsAutopilot: DashboardPersonalOpsAutopilotSnapshot | null;
  agentTeamCompiler: DashboardAgentTeamCompilerSnapshot | null;
  crossChannelContinuity: DashboardCrossChannelContinuitySnapshot | null;
  askBeforeAssumptionPolicy: DashboardAskBeforeAssumptionPolicySnapshot | null;
  providerMeshConsolidation: DashboardProviderMeshConsolidationSnapshot | null;
  universalIntentTrustEnforcement: DashboardUniversalIntentTrustEnforcementSnapshot | null;
  runArtifactReceiptReplay: DashboardRunArtifactReceiptReplaySnapshot | null;
  productizationEvidence: DashboardProductizationEvidenceSnapshot | null;
  productEntryRuntime: DashboardProductEntryRuntimeSnapshot | null;
  releaseInstallerRollbackPath: DashboardReleaseInstallerRollbackPathSnapshot | null;
  publicSiteDocsDemoSync: DashboardPublicSiteDocsDemoSyncSnapshot | null;
  feedbackTelemetryProductLoop: DashboardFeedbackTelemetryProductLoopSnapshot | null;
  publicAdoptionPilotLoop: DashboardPublicAdoptionPilotLoopSnapshot | null;
  integrationShowcasePartnerSurface: DashboardIntegrationShowcasePartnerSurfaceSnapshot | null;
  releaseAdoptionReadiness: DashboardReleaseAdoptionReadinessSnapshot | null;
  releaseCandidatePreCanaryGate: DashboardReleaseCandidatePreCanaryGateSnapshot | null;
  blueprintCompletionGate: DashboardBlueprintCompletionGateSnapshot | null;
  skillMcpQuarantine: DashboardSkillMcpQuarantineSnapshot | null;
  providerArena: DashboardProviderArenaSnapshot | null;
  providerCockpit: DashboardProviderCockpitSnapshot | null;
  subagentAutoInvocation: DashboardSubagentAutoInvocationSnapshot | null;
  nexusWorkbench: DashboardNexusWorkbenchSnapshot | null;
  remoteMeshApprovalUx: RemoteMeshNotebookApprovalUxSnapshot | null;
  toolExposure: DashboardToolExposureProfile;
  budget: DashboardBudgetSnapshot;
  replay: DashboardReplaySummary;
  replyPorts: DashboardReplyPort[];
  modelProfile: DashboardModelProfile;
  health: DashboardHealthSnapshot;
  releaseStatus: DashboardReleaseStatus;
  integrations: DashboardIntegrationSummary[];
  identity: DashboardIdentitySnapshot;
  logs: DashboardLogEntry[];
  sectors: DashboardNavigationSector[];
  sessions: DashboardSessionSummary[];
  messages: DashboardChatMessage[];
  events: DashboardAgentEvent[];
  trace: DashboardAgentTraceSnapshot | null;
  artifacts: DashboardArtifactSummary[];
  memorySignals: DashboardMemorySignal[];
  actions: DashboardCommandAction[];
  counts: {
    tasks: number;
    sessions: number;
    approvals: number;
    artifacts: number;
    capabilities: number;
    integrations: number;
    nodes: number;
    blockers: number;
    logs: number;
  };
  emptyState: {
    title: string;
    subtitle: string;
    suggestions: string[];
  };
};
