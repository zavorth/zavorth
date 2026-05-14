import type {
  DashboardEventStatus,
  DashboardToolRiskLevel,
} from "./dashboardCommandCenterCoreContracts.js";

export type DashboardProviderMeshConsolidatedRoute = {
  id: string;
  label: string;
  providerId: string;
  providerName: string;
  routeKind: string;
  routeClass: string;
  readiness: "ready" | "needs_config" | "needs_probe" | "unknown";
  ready: boolean;
  issue: string | null;
  familyIds: string[];
  modelCount: number;
  catalogSource: string;
  fallbackRouteIds: string[];
  runtime: {
    adapterKind: string;
    runtimeSupported: boolean;
    firstClassProvider: boolean;
    genericCompatible: boolean;
  };
};

export type DashboardProviderMeshConsolidatedFamily = {
  id: string;
  label: string;
  ready: boolean;
  readiness: "ready" | "needs_config" | "needs_probe" | "unknown";
  routeCount: number;
  readyRouteCount: number;
  modelCount: number;
  capabilities: string[];
  selected: boolean;
};

export type DashboardUniversalIntentTrustEnforcementSnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: "allow" | "requires-clarification" | "requires-permission" | "blocked" | "unknown";
  summary: {
    intent: string;
    risk: "safe" | "attention" | "danger" | "unknown";
    trustLevel: "protected" | "collaborator" | "overlord" | "unknown";
    trustDecision: "allow" | "requires_permission" | "block" | "unknown";
    posture: string;
    requestedToolCount: number;
    capabilityCount: number;
    matchedSignalCount: number;
    requiresClarification: boolean;
    requiresPermission: boolean;
    previewRequired: boolean;
    approvalRequired: boolean;
    blocked: boolean;
    hostAllowed: boolean;
    workspaceRootPresent: boolean;
  };
  universalIntent: {
    intent: string;
    risk: "safe" | "attention" | "danger" | "unknown";
    sideEffect: string;
    confidence: number;
    capabilityRequired: string[];
    matchedSignals: string[];
    nextSafeAction: string;
  };
  permission: {
    required: boolean;
    kind: string;
    scope: string;
    prompt: string | null;
    reason: string | null;
    previewRequired: boolean;
    approvalRequired: boolean;
    sideEffect: string;
    scopeBoundary: {
      sessionId: string | null;
      workspaceRoot: string | null;
      targetPath: string | null;
      hostAllowed: boolean;
    };
  };
  clarification: {
    required: boolean;
    askBeforeAssumption: boolean;
    question: string | null;
    reason: string | null;
    missing: string[];
    sensitiveDomain: boolean;
  };
  trustSlider: {
    level: "protected" | "collaborator" | "overlord" | "unknown";
    decision: "allow" | "requires_permission" | "block" | "unknown";
    sandboxTier: string;
    permissionBoundary: string;
    permissionScope: string;
    previewRequired: boolean;
    approvalRequired: boolean;
    blocked: boolean;
    blockReason: string | null;
  };
  gates: Array<{
    id: string;
    label: string;
    status: "passed" | "requires-action" | "blocked";
    source: string;
    detail: string;
  }>;
  receipts: Array<{
    id: string;
    kind: string;
    source: string;
    detail: string;
    status: "ready" | "requires-action" | "blocked";
  }>;
  policy: {
    universalIntentIsSourceOfTruth: boolean;
    trustSliderEnforcedBeforeExecutor: boolean;
    naturalLanguageDoesNotBypassPolicy: boolean;
    permissionNarrativeRequired: boolean;
    previewBeforeMutation: boolean;
    approvalRequiredForPermission: boolean;
    hostScopeRequiresOverlord: boolean;
    workspaceBoundaryEnforced: boolean;
    noToolExecutedBySnapshot: boolean;
    secretsSerialized: boolean;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    trustHint: string;
    permissionHint: string;
  };
  nextSafeAction: string;
};

export type DashboardRunArtifactReceiptReplaySnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: "ready" | "partial" | "empty" | "blocked" | "unknown";
  summary: {
    runCount: number;
    frameCount: number;
    artifactCount: number;
    artifactLinkCount: number;
    observatoryReceiptCount: number;
    featureReceiptCount: number;
    memoryReceiptCount: number;
    coveredFeatureCount: number;
    missingFeatureCount: number;
    replayAnchorCount: number;
    replayable: boolean;
    runObservatoryLinked: boolean;
    artifactMemoryLinked: boolean;
    memoryWithReceiptsLinked: boolean;
  };
  observatory: {
    contractVersion: string;
    replayAvailable: boolean;
    receiptCount: number;
    timelineCount: number;
    healthStatus: string;
    nextSafeAction: string;
  };
  features: Array<{
    featureId: string;
    metadataKey: string;
    label: string;
    present: boolean;
    contractVersion: string | null;
    status: string | null;
    receiptCount: number;
    frameCount: number;
    source: string | null;
  }>;
  frames: Array<{
    id: string;
    order: number;
    kind: string;
    source: string;
    title: string;
    detail: string;
    status: string;
    createdAt: string;
    receiptId: string | null;
    artifactId: string | null;
    featureId: string | null;
  }>;
  artifactLinks: Array<{
    artifactId: string;
    title: string;
    kind: string;
    status: string;
    createdAt: string;
    category: string;
    replayFrameId: string;
    observatoryReceiptId: string | null;
    memoryReceiptId: string | null;
    commands: {
      openCommand: string;
      replayCommand: string;
      citeCommand: string;
    };
  }>;
  receiptLinks: Array<{
    id: string;
    kind: string;
    source: string;
    featureId: string | null;
    title: string;
    detail: string;
    status: string;
    createdAt: string;
    artifactId: string | null;
    frameId: string | null;
  }>;
  replay: {
    available: boolean;
    anchors: Array<{
      id: string;
      frameId: string;
      kind: string;
      label: string;
      status: string;
      createdAt: string;
    }>;
    commandHints: string[];
    summary: string;
  };
  policy: {
    noToolExecutedByReplay: boolean;
    noFilesystemReadPerformed: boolean;
    noArtifactContentInvented: boolean;
    noArtifactMutation: boolean;
    replayUsesReceiptsOnly: boolean;
    artifactsMustCiteOrigin: boolean;
    naturalLanguageDoesNotBypassPolicy: boolean;
    secretsSerialized: boolean;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    replayHint: string;
    receiptHint: string;
  };
  nextSafeAction: string;
};

export type DashboardProductizationEvidenceSnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status: "ready" | "partial" | "blocked" | "unknown";
  summary: {
    readyGateCount: number;
    partialGateCount: number;
    missingGateCount: number;
    blockedGateCount: number;
    surfaceCount: number;
    linkedRuntimeEvidenceCount: number;
    productizationContractLinked: boolean;
    releasePreviewReady: boolean;
    stableReleaseAllowed: boolean;
    replayLinked: boolean;
    commandCenterLinked: boolean;
    docsLinked: boolean;
    websiteLinked: boolean;
  };
  productization: {
    contractService: string;
    c9Linked: boolean;
    phase: string | null;
    status: string | null;
    controlReady: boolean;
    cliReady: boolean;
    sdkReady: boolean;
    docsReady: boolean;
    websiteReady: boolean;
    sourceMetadataKey: string | null;
  };
  releaseReadiness: {
    status: "preview-ready" | "stable-ready" | "partial" | "blocked" | "unknown";
    channel: "preview" | "stable" | "lts" | "dev" | "unknown";
    version: string | null;
    rollbackAvailable: boolean;
    stableRequiresRealRelease: boolean;
    noReleasePublished: boolean;
    noInstallerExecuted: boolean;
    noCanaryStarted: boolean;
    nextReleaseWave: string;
  };
  runtimeEvidence: {
    runArtifactReceiptReplay: boolean;
    runObservatory: boolean;
    providerMeshConsolidation: boolean;
    universalIntentTrustEnforcement: boolean;
    safetyNarrative: boolean;
    commandCenterProjection: boolean;
    gatewayControlApi: boolean;
  };
  gates: Array<{
    id: string;
    label: string;
    status: "ready" | "partial" | "missing" | "blocked";
    source: string;
    command: string;
    detail: string;
    critical: boolean;
  }>;
  surfaces: Array<{
    id: string;
    label: string;
    status: "ready" | "partial" | "missing" | "blocked";
    path: string;
    evidence: string;
  }>;
  receipts: Array<{
    id: string;
    kind: string;
    source: string;
    detail: string;
    status: "ready" | "partial" | "missing" | "blocked";
  }>;
  policy: {
    noReleasePublished: boolean;
    noInstallerExecuted: boolean;
    noCanaryStarted: boolean;
    previewOnlyUntilReleaseGatesPass: boolean;
    stableRequiresRealRelease: boolean;
    productizationClaimsNeedReceipts: boolean;
    naturalLanguageDoesNotBypassPolicy: boolean;
    replayEvidenceMustRemainReceiptsOnly: boolean;
    secretsSerialized: boolean;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    releaseHint: string;
    docsHint: string;
  };
  nextSafeAction: string;
};

export type DashboardProductEntryRuntimeSnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status:
    | "ready"
    | "needs_first_run"
    | "needs_doctor"
    | "needs_install_preview"
    | "blocked_by_policy"
    | "rollback_available"
    | "handoff_to_agent_runtime"
    | "unknown";
  entry: {
    channel: string;
    requestedSurface: string;
    handoffTarget: string | null;
    handoffAllowed: boolean;
    sharedStateSource: string;
  };
  firstRun: {
    profileConfigured: boolean;
    profilePath: string;
    bootstrapPlanStatus: string;
    dryRunAvailable: boolean;
    nonInteractiveSafe: boolean;
    questionCount: number;
    safeDefaultsAvailable: boolean;
    personalizationPending: boolean;
    personalizationReasons: string[];
    onboardingStatus: string;
    onboardingRoute: string | null;
  };
  workspace: {
    workspaceRoot: string | null;
    storageRoot: string | null;
    identityConfigured: boolean;
    memoryMode: string | null;
    safetyPosture: string | null;
    providerStatus: string | null;
    rollbackAvailable: boolean;
  };
  readiness: {
    productizationEvidenceLinked: boolean;
    releasePreviewReady: boolean;
    doctorRequired: boolean;
    installPreviewRequired: boolean;
    firstRunRequired: boolean;
    canStartAgentRuntime: boolean;
    handoffToAgentRuntime: boolean;
  };
  gates: Array<{
    id: string;
    label: string;
    status: "ready" | "needs-action" | "blocked" | "unknown";
    source: string;
    command: string;
    detail: string;
    critical: boolean;
  }>;
  surfaces: Array<{
    id: string;
    label: string;
    commandOrPath: string;
    status: "ready" | "needs-action" | "blocked" | "unknown";
    entryState: string;
  }>;
  receipts: Array<{
    id: string;
    kind: string;
    source: string;
    detail: string;
    status: "ready" | "needs-action" | "blocked" | "unknown";
  }>;
  policy: {
    noProfileWritePerformed: boolean;
    noRuntimePersistentStart: boolean;
    noProviderExecutionPerformed: boolean;
    noToolExecutionPerformed: boolean;
    noMessageSendPerformed: boolean;
    noRawImportPerformed: boolean;
    firstRunStateSharedAcrossSurfaces: boolean;
    naturalLanguageDoesNotBypassPolicy: boolean;
    secretsSerialized: boolean;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    publicStartRoute: string;
    dashboardOnboardingPath: string;
    goCommand: string;
  };
  nextSafeAction: string;
};

export type DashboardReleaseInstallerRollbackPathSnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status:
    | "preview-ready"
    | "needs-product-entry"
    | "needs-release-bundle"
    | "needs-installer-preview"
    | "rollback-ready"
    | "blocked"
    | "dormant-canary"
    | "unknown";
  release: {
    channel: "preview" | "stable" | "lts" | "dev" | "unknown";
    version: string | null;
    stableAllowed: boolean;
    releaseBundleLinked: boolean;
    releaseBundleStatus: "ready" | "attention" | "blocked" | "unknown";
    route: string | null;
  };
  installer: {
    previewAvailable: boolean;
    installerExecuted: boolean;
    requiredCommands: string[];
    dryRunCommand: string;
    hostedInstallerAllowed: boolean;
    checksumRequired: boolean;
  };
  rollback: {
    rollbackAvailable: boolean;
    rollbackExecuted: boolean;
    rollbackCommand: string;
    cleanupPreviewRequired: boolean;
    scope: string;
  };
  readiness: {
    productEntryRuntimeLinked: boolean;
    productizationEvidenceLinked: boolean;
    releasePreviewReady: boolean;
    releaseBundleReady: boolean;
    firstRunReady: boolean;
    canPublishStable: boolean;
    canStartCanary: boolean;
  };
  gates: Array<{
    id: string;
    label: string;
    status: "ready" | "needs-action" | "blocked" | "unknown";
    source: string;
    command: string;
    detail: string;
    critical: boolean;
  }>;
  surfaces: Array<{
    id: string;
    label: string;
    commandOrPath: string;
    status: "ready" | "needs-action" | "blocked" | "unknown";
    detail: string;
  }>;
  receipts: Array<{
    id: string;
    kind: string;
    source: string;
    detail: string;
    status: "ready" | "needs-action" | "blocked" | "unknown";
  }>;
  policy: {
    noReleasePublished: boolean;
    noInstallerExecuted: boolean;
    noRollbackExecuted: boolean;
    noCanaryStarted: boolean;
    noStableTagMoved: boolean;
    noLatestTagMoved: boolean;
    hostedInstallerRequiresChecksums: boolean;
    rollbackRequiresExplicitCommand: boolean;
    naturalLanguageDoesNotBypassPolicy: boolean;
    secretsSerialized: boolean;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    publicReleaseRoute: string;
    dryRunCommand: string;
    rollbackCommand: string;
  };
  nextSafeAction: string;
};
