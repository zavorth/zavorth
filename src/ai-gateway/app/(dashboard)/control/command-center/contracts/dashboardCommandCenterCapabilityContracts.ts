import type {
  DashboardEventStatus,
  DashboardToolRiskLevel,
} from "./dashboardCommandCenterCoreContracts.js";

export type DashboardSelfingDashboardSectionId =
  | "identity"
  | "tone"
  | "user"
  | "environment"
  | "memory"
  | "permissions";

export type DashboardSelfingDashboardCard = {
  id: string;
  section: DashboardSelfingDashboardSectionId;
  title: string;
  value: string;
  source: string;
  sourceRef: string | null;
  confidence: number;
  editable: boolean;
  sensitive: boolean;
  previewRequired: boolean;
  versioned: boolean;
  actions: {
    reviewCommand: string;
    previewCommand: string;
    historyCommand: string;
  };
};

export type DashboardSelfingDashboardSnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: "ready" | "needs-review" | "empty" | "blocked" | "unknown";
  identity: {
    agentName: string;
    userName: string;
    workspaceName: string;
    tonePreference: string | null;
    memoryMode: string | null;
    safetyPosture: string | null;
    trustMode: string;
    providerLabel: string;
    modelLabel: string;
  };
  summary: {
    cardCount: number;
    identityFileCount: number;
    editableCardCount: number;
    sensitiveCardCount: number;
    memoryReceiptCount: number;
    lowConfidenceMemoryCount: number;
    knownToolCount: number;
    pendingApprovalCount: number;
    updateSuggestionCount: number;
    versionedChangesRequired: boolean;
  };
  cards: DashboardSelfingDashboardCard[];
  suggestions: Array<{
    id: string;
    section: DashboardSelfingDashboardSectionId;
    title: string;
    detail: string;
    reason: string;
    sensitive: boolean;
    previewCommand: string;
  }>;
  receipts: Array<{
    id: string;
    kind: string;
    source: string;
    detail: string;
    status: "ready" | "needs-review" | "missing";
  }>;
  policy: {
    readOnlySnapshot: boolean;
    noIdentityChanged: boolean;
    noMemoryChanged: boolean;
    noConfigChanged: boolean;
    changesRequirePreview: boolean;
    changesAreVersioned: boolean;
    sensitiveChangesRequireApproval: boolean;
    memoryCorrectionsUseReceipts: boolean;
    secretsSerialized: boolean;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    previewHint: string;
    versioningHint: string;
  };
  nextSafeAction: string;
};

export type DashboardArtifactMemoryCategory =
  | "plan"
  | "diff"
  | "report"
  | "spec"
  | "decision"
  | "execution"
  | "prompt"
  | "release"
  | "run-summary"
  | "file"
  | "log"
  | "handoff"
  | "unknown";

export type DashboardArtifactMemoryEntry = {
  id: string;
  artifactId: string;
  memoryId: string;
  title: string;
  kind: string;
  category: DashboardArtifactMemoryCategory;
  status: string;
  createdAt: string;
  runId: string;
  traceId: string;
  sessionId: string;
  projectRef: string | null;
  taskRef: string | null;
  summary: string;
  searchableText: string;
  tags: string[];
  importance: "low" | "medium" | "high";
  reusable: boolean;
  receipt: {
    observatoryReceiptId: string | null;
    memoryReceiptId: string | null;
    source: string;
  };
  actions: {
    openCommand: string;
    rememberCommand: string;
    reuseCommand: string;
    citeCommand: string;
    forgetCommand: string;
  };
};

export type DashboardArtifactMemorySnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: "ready" | "needs-index" | "empty" | "blocked" | "unknown";
  summary: {
    artifactCount: number;
    memoryEntryCount: number;
    reusableCount: number;
    readyArtifactCount: number;
    runSummaryIndexed: boolean;
    receiptCount: number;
    linkedMemoryReceiptCount: number;
    runObservatoryLinked: boolean;
    searchReady: boolean;
    indexedCategories: DashboardArtifactMemoryCategory[];
  };
  entries: DashboardArtifactMemoryEntry[];
  search: {
    queryHints: string[];
    facets: Array<{
      id: string;
      label: string;
      count: number;
    }>;
    commands: {
      searchCommand: string;
      latestCommand: string;
      byRunCommand: string;
    };
  };
  receipts: Array<{
    id: string;
    kind: string;
    source: string;
    artifactId?: string;
    detail: string;
    status: "ready" | "needs-index" | "missing";
    observatoryReceiptId?: string;
  }>;
  policy: {
    noArtifactContentInvented: boolean;
    noFilesystemReadPerformed: boolean;
    noArtifactMutation: boolean;
    memoryWriteNotPerformed: boolean;
    promotionRequiresExplicitAction: boolean;
    reusedArtifactMustCiteOrigin: boolean;
    secretsSerialized: boolean;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    searchHint: string;
    reuseHint: string;
  };
  nextSafeAction: string;
};

export type DashboardPersonalOpsAutopilotCategory =
  | "provider"
  | "budget"
  | "memory"
  | "artifact-memory"
  | "capability"
  | "skill"
  | "watch-mode"
  | "node-mesh"
  | "channel"
  | "safety"
  | "runtime"
  | "automation";

export type DashboardPersonalOpsAutopilotSuggestion = {
  id: string;
  category: DashboardPersonalOpsAutopilotCategory;
  title: string;
  cause: string;
  impact: string;
  nextStep: string;
  severity: "info" | "warning" | "danger";
  confidence: number;
  requiresApproval: boolean;
  previewAvailable: boolean;
  mutableAction: boolean;
  evidence: Array<{
    source: string;
    ref: string | null;
    detail: string;
    receiptId?: string;
  }>;
  relatedArtifactIds: string[];
  relatedToolIds: string[];
  actions: {
    previewCommand: string;
    approvalCommand: string;
    runCommand: string;
    dismissCommand: string;
  };
};

export type DashboardPersonalOpsAutopilotSnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: "idle" | "suggesting" | "waiting-approval" | "blocked" | "unknown";
  summary: {
    suggestionCount: number;
    attentionCount: number;
    approvalRequiredCount: number;
    previewAvailableCount: number;
    mutableActionCount: number;
    providerIssueCount: number;
    budgetIssueCount: number;
    artifactOpportunityCount: number;
    naturalIntentObserved: boolean;
    runObservatoryLinked: boolean;
  };
  suggestions: DashboardPersonalOpsAutopilotSuggestion[];
  receipts: Array<{
    id: string;
    kind: string;
    source: string;
    detail: string;
    status: "ready" | "needs-review" | "missing";
  }>;
  policy: {
    noMutableActionExecuted: boolean;
    noAutorepairStarted: boolean;
    approvalsRequiredForMutation: boolean;
    previewBeforeAutorepair: boolean;
    naturalLanguageDoesNotBypassPolicy: boolean;
    usesReceiptsForSuggestions: boolean;
    secretsSerialized: boolean;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    previewHint: string;
    approvalHint: string;
  };
  nextSafeAction: string;
};

export type DashboardAgentTeamCompilerRoleKind =
  | "planner"
  | "researcher"
  | "implementer"
  | "verifier"
  | "provider-specialist"
  | "safety-reviewer"
  | "memory-curator"
  | "operator-liaison";

export type DashboardAgentTeamCompilerRole = {
  id: string;
  roleId: string;
  kind: DashboardAgentTeamCompilerRoleKind;
  label: string;
  objective: string;
  why: string;
  dependsOn: string[];
  handoffTo: string[];
  capabilityIds: string[];
  toolIds: string[];
  provider: {
    providerLabel: string;
    modelLabel: string;
    candidateId: string | null;
    source: string;
    advisoryOnly: boolean;
  };
  scope: {
    mode: string;
    allowedTools: string[];
    deniedPaths: string[];
    requiresApproval: boolean;
    policyTags: string[];
  };
  budget: {
    maxToolCalls: number;
    maxWallClockMs: number;
    maxOutputBytes: number;
  };
  approval: {
    required: boolean;
    reason: string;
    inheritedApprovalId: string | null;
  };
  risk: "safe" | "attention" | "danger" | "unknown";
  actions: {
    previewCommand: string;
    approveCommand: string;
    launchCommand: string;
    inspectCommand: string;
  };
};

export type DashboardAgentTeamCompilerSnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: "not-needed" | "compiled" | "waiting-approval" | "blocked" | "unknown";
  objective: string;
  topology: {
    mode: "linear" | "parallel" | "review-gated" | "unknown";
    edges: Array<{
      from: string;
      to: string;
      reason: string;
    }>;
  };
  summary: {
    roleCount: number;
    approvalRequiredCount: number;
    providerAssignedCount: number;
    blockedRoleCount: number;
    requestedSwarm: boolean;
    providerArenaLinked: boolean;
    capabilityNegotiationLinked: boolean;
    subagentReceiptsPrepared: boolean;
    compilerOnly: boolean;
  };
  roles: DashboardAgentTeamCompilerRole[];
  receipts: Array<{
    id: string;
    kind: string;
    source: string;
    detail: string;
    status: "ready" | "needs-approval" | "missing";
  }>;
  policy: {
    noSubagentsLaunched: boolean;
    approvalRequiredBeforeLaunch: boolean;
    budgetsDefaultToZero: boolean;
    providerSelectionIsAdvisory: boolean;
    respectsCapabilityNegotiation: boolean;
    naturalLanguageDoesNotBypassPolicy: boolean;
    secretsSerialized: boolean;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    previewHint: string;
    approvalHint: string;
  };
  nextSafeAction: string;
};

export type DashboardCrossChannelContinuityChannel = {
  id: string;
  label: string;
  kind: "web" | "cli" | "telegram" | "discord" | "api" | "unknown";
  status: "available" | "degraded" | "blocked" | "offline";
  primary: boolean;
  source: "reply-port" | "channel-mesh" | "node-mesh" | "metadata" | "fallback" | "unknown";
  canResume: boolean;
  canNotify: boolean;
  continuityKey: string;
  lastRunId: string | null;
  description: string;
};

export type DashboardCrossChannelContinuityHandoff = {
  id: string;
  fromChannel: "web" | "cli" | "telegram" | "discord" | "api" | "unknown";
  toChannel: "web" | "cli" | "telegram" | "discord" | "api" | "unknown";
  reason: string;
  status: "available" | "needs-approval" | "blocked";
  requiresApproval: boolean;
  previewRequired: boolean;
  command: string;
  receiptIds: string[];
};

export type DashboardCrossChannelContinuitySnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
    userId: string;
  };
  status: "single-channel" | "bridged" | "handoff-ready" | "blocked" | "unknown";
  session: {
    continuityKey: string;
    originChannel: "web" | "cli" | "telegram" | "discord" | "api" | "unknown";
    activeChannel: "web" | "cli" | "telegram" | "discord" | "api" | "unknown";
    primaryReplyPortId: string | null;
    ownerUserId: string;
    workspace: string | null;
  };
  summary: {
    channelCount: number;
    availableChannelCount: number;
    replyPortCount: number;
    handoffCount: number;
    bridgeDetected: boolean;
    nodeMeshLinked: boolean;
    runObservatoryLinked: boolean;
    continuityPromptPresent: boolean;
    sameGateway: boolean;
  };
  channels: DashboardCrossChannelContinuityChannel[];
  handoffs: DashboardCrossChannelContinuityHandoff[];
  receipts: Array<{
    id: string;
    kind: string;
    source: string;
    detail: string;
    status: "ready" | "needs-approval" | "missing";
  }>;
  policy: {
    noCrossChannelMessageSent: boolean;
    noSessionForkCreated: boolean;
    approvalRequiredForChannelSwitch: boolean;
    originalChannelPreserved: boolean;
    sameGatewayRequired: boolean;
    secretsSerialized: boolean;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    resumeHint: string;
    approvalHint: string;
  };
  nextSafeAction: string;
};

export type DashboardAskBeforeAssumptionCategory =
  | "missing-scope"
  | "missing-target"
  | "missing-permission"
  | "missing-data"
  | "risky-tool"
  | "channel-handoff"
  | "provider-route"
  | "memory-write"
  | "selfmod"
  | "workspace-mutation"
  | "unknown";

export type DashboardAskBeforeAssumption = {
  id: string;
  category: DashboardAskBeforeAssumptionCategory;
  title: string;
  detail: string;
  severity: "info" | "warning" | "danger";
  confidence: number;
  missingInput: string[];
  inferredFrom: string[];
  affectedActions: string[];
  requiresAnswer: boolean;
  questionId: string;
};

export type DashboardAskBeforeAssumptionQuestion = {
  id: string;
  priority: "low" | "medium" | "high";
  question: string;
  reason: string;
  options: string[];
  blocksMutation: boolean;
  defaultAction: "ask" | "preview" | "skip";
};

export type DashboardAskBeforeAssumptionPolicySnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: "clear" | "needs-question" | "blocked" | "unknown";
  summary: {
    assumptionCount: number;
    questionCount: number;
    blockerCount: number;
    mutableActionBlockedCount: number;
    highestSeverity: "info" | "warning" | "danger";
    previewLinked: boolean;
    capabilityNegotiationLinked: boolean;
    safetyNarrativeLinked: boolean;
  };
  assumptions: DashboardAskBeforeAssumption[];
  questions: DashboardAskBeforeAssumptionQuestion[];
  receipts: Array<{
    id: string;
    kind: string;
    source: string;
    detail: string;
    status: "ready" | "needs-answer" | "missing";
  }>;
  policy: {
    noAssumptionActedOn: boolean;
    noMutationExecuted: boolean;
    asksBeforeMutation: boolean;
    previewBeforeRiskyAction: boolean;
    approvalStillRequired: boolean;
    naturalLanguageDoesNotBypassPolicy: boolean;
    secretsSerialized: boolean;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    askHint: string;
    previewHint: string;
  };
  nextSafeAction: string;
};
