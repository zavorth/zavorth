import type {
  DashboardEventStatus,
  DashboardRuntimeStatus,
  DashboardToolRiskLevel,
} from "./dashboardCommandCenterCoreContracts.js";

export type DashboardReleaseAdoptionReadinessSnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status:
    | "release-adoption-ready"
    | "needs-integration-showcase"
    | "needs-release-train"
    | "needs-public-adoption"
    | "needs-support-loop"
    | "needs-feedback-metrics"
    | "blocked"
    | "unknown";
  integrationShowcase: {
    linked: boolean;
    status: string;
    showcaseReady: boolean;
    vendorCount: number;
    fixtureReadyCount: number;
    partnerClaimBlocked: boolean;
    qaCommand: string | null;
  };
  releaseTrain: {
    linked: boolean;
    status: string;
    phase: string | null;
    baselineVersion: string | null;
    packageVersion: string | null;
    policyCount: number;
    calendarItemCount: number;
    releaseCandidateItemCount: number;
    hotfixStepCount: number;
    failedCheckCount: number;
    qaCommand: string;
  };
  publicAdoption: {
    linked: boolean;
    status: string;
    phase: string | null;
    readinessScore: number;
    claimCount: number;
    riskCount: number;
    runbookStepCount: number;
    failedCheckCount: number;
    qaCommand: string;
  };
  supportLoop: {
    feedbackLoopReady: boolean;
    pilotLoopReady: boolean;
    supportPolicyCount: number;
    triageRuleCount: number;
    plannedPilotCount: number;
    dashboardAggregatedOnly: boolean;
    noPayloadPolicy: boolean;
    metricsReady: boolean;
  };
  readiness: {
    integrationShowcaseReady: boolean;
    releaseTrainReady: boolean;
    publicAdoptionReady: boolean;
    supportLoopReady: boolean;
    feedbackMetricsReady: boolean;
    ltsHotfixPolicyReady: boolean;
    docsRunbookReady: boolean;
    canOpenPublicAdoption: boolean;
    canStartCanary: false;
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
    routeOrCommand: string;
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
    noDeployExecuted: true;
    noTelemetryEnabled: true;
    noImplicitCollection: true;
    noExternalSubmission: true;
    noRawPayloadSerialized: true;
    noStableClaimWithoutEvidence: true;
    noCanaryStarted: true;
    noNetworkRequiredForReadiness: true;
    releaseRequiresRollbackPreview: true;
    adoptionMetricsAggregatedOnly: true;
    naturalLanguageDoesNotBypassPolicy: true;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    releaseRoute: string;
    feedbackRoute: string;
    docsRoute: string;
    releaseTrainCommand: string;
    publicAdoptionCommand: string;
    pilotLoopCommand: string;
    feedbackPreviewCommand: string;
    phaseGateCommand: string;
  };
  nextSafeAction: string;
};

export type DashboardReleaseCandidatePreCanaryGateSnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status:
    | "pre-canary-ready"
    | "needs-release-adoption-readiness"
    | "needs-evidence-pack"
    | "needs-ecosystem-publishing"
    | "needs-autopilot-readiness"
    | "needs-go-no-go"
    | "blocked"
    | "unknown";
  releaseAdoption: {
    linked: boolean;
    status: string;
    ready: boolean;
    canOpenPublicAdoption: boolean;
    canStartCanary: false;
  };
  evidencePack: {
    linked: boolean;
    status: string;
    checkCount: number;
    passCount: number;
    artifactCount: number;
    releaseNotesReady: boolean;
    changelogReady: boolean;
    rollbackPreviewReady: boolean;
    knownIssuesReady: boolean;
    evidencePackReady: boolean;
  };
  ecosystem: {
    linked: boolean;
    status: string;
    integrationCount: number;
    fixtureReadyCount: number;
    docsReady: boolean;
    matrixReady: boolean;
    partnerSurfaceReady: boolean;
    noFormalPartnerClaim: boolean;
    ecosystemPublishingReady: boolean;
  };
  autopilot: {
    linked: boolean;
    status: string;
    recommendation: string;
    releaseCandidateReady: boolean;
    killSwitchReady: boolean;
    stagedRolloutPlanReady: boolean;
    rollbackRehearsalFresh: boolean;
    telemetryReviewPassed: boolean;
    privacyReviewPassed: boolean;
    rcFlagDefaultOff: boolean;
    globalRolloutEnabled: boolean;
    autoPromoteEnabled: boolean;
    blockerCount: number;
  };
  goNoGo: {
    linked: boolean;
    decision: "go" | "no-go" | "unknown";
    ready: boolean;
    explicitApproval: boolean;
    approverId: string | null;
    approvalReceiptId: string | null;
    rollbackOwner: string | null;
    incidentOwner: string | null;
    reasonCount: number;
    canaryStarted: false;
    rolloutStarted: false;
  };
  readiness: {
    releaseAdoptionReady: boolean;
    evidencePackReady: boolean;
    ecosystemPublishingReady: boolean;
    autopilotReleaseCandidateReady: boolean;
    goNoGoReady: boolean;
    governanceReady: boolean;
    rollbackReady: boolean;
    canOpenPreCanary: boolean;
    canStartCanary: false;
    rolloutStarted: false;
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
    routeOrCommand: string;
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
    noCanaryStarted: true;
    noRolloutStarted: true;
    noDeployExecuted: true;
    noGlobalRolloutEnabled: true;
    noAutoPromoteEnabled: true;
    noTelemetryEnabled: true;
    noExternalMutation: true;
    noSecretsSerialized: true;
    goNoGoRequiresExplicitApproval: true;
    rollbackPreviewRequired: true;
    ecosystemClaimsRequireEvidence: true;
    naturalLanguageDoesNotBypassPolicy: true;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    evidencePackCommand: string;
    integrationCommand: string;
    autopilotCommand: string;
    phaseGateCommand: string;
    rollbackPreviewCommand: string;
  };
  nextSafeAction: string;
};

export type DashboardBlueprintCompletionGateSnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status:
    | "blueprint-complete"
    | "needs-pre-canary"
    | "needs-rollout-plan"
    | "needs-release-execution"
    | "needs-canary-promotion"
    | "needs-release-decision"
    | "blocked"
    | "unknown";
  summary: {
    completedGateCount: number;
    requiredGateCount: 5;
    releaseChannel: string;
    releaseDecision: string;
    blueprintComplete: boolean;
  };
  preCanary: {
    linked: boolean;
    status: string;
    ready: boolean;
    canOpenPreCanary: boolean;
  };
  rolloutPlan: {
    linked: boolean;
    status: string;
    ready: boolean;
    canaryPercent: number;
    manualPromotionRequired: boolean;
    globalRolloutEnabled: boolean;
    autoRolloutEnabled: boolean;
  };
  releaseExecution: {
    linked: boolean;
    status: string;
    ready: boolean;
    releaseVersion: string | null;
    releaseTag: string | null;
    initialCanaryPercent: number;
    manualOperatorPresent: boolean;
    autoExecuteEnabled: boolean;
    globalRolloutEnabled: boolean;
    skipCanaryEnabled: boolean;
  };
  canaryPromotion: {
    linked: boolean;
    status: string;
    ready: boolean;
    nextCohortPercent: number;
    promotionApproved: boolean;
    rollbackRecommended: boolean;
    autoPromoteEnabled: boolean;
    globalRolloutEnabled: boolean;
    skipApprovalEnabled: boolean;
  };
  releaseDecision: {
    linked: boolean;
    decision: string;
    ready: boolean;
    releaseChannel: string;
    riskPosture: string;
    missingPhaseCount: number;
    failedPhaseCount: number;
    featureFlagDefaultEnabled: boolean;
  };
  readiness: {
    preCanaryReady: boolean;
    rolloutPlanReady: boolean;
    releaseExecutionReady: boolean;
    canaryPromotionReady: boolean;
    releaseDecisionReady: boolean;
    safeguardsReady: boolean;
    blueprintComplete: boolean;
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
  receipts: Array<{
    id: string;
    kind: string;
    source: string;
    detail: string;
    status: "ready" | "needs-action" | "blocked" | "unknown";
  }>;
  policy: {
    noUngovernedDeploy: true;
    manualPromotionRequired: true;
    noAutoExecute: true;
    noGlobalRolloutByDefault: true;
    noSkipCanary: true;
    noSkipApproval: true;
    rollbackPathRequired: true;
    auditReceiptsRequired: true;
    featureFlagRequired: true;
    naturalLanguageDoesNotBypassPolicy: true;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    preCanaryCommand: string;
    rolloutCommand: string;
    executionCommand: string;
    canaryPromotionCommand: string;
    decisionCommand: string;
    finalGateCommand: string;
  };
  nextSafeAction: string;
};

export type DashboardProviderMeshConsolidationSnapshot = {
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
    manifestCount: number;
    familyCount: number;
    routeCount: number;
    readyRouteCount: number;
    modelCount: number;
    customModelCount: number;
    importedModelCount: number;
    incompleteProviderCount: number;
    selectedReady: boolean;
    providerArenaLinked: boolean;
    p0ExtraComplete: boolean;
  };
  p0ExtraCoverage: Record<string, boolean>;
  selected: {
    familyId: string | null;
    routeId: string | null;
    modelId: string | null;
    providerName: string | null;
    providerLabel: string | null;
    modelName: string | null;
    modelLabel: string | null;
    ready: boolean;
    source: string;
    fallbackRouteIds: string[];
    fallbackOrder: string[];
    runtimeFactory: {
      adapterKind: string;
      runtimeSupported: boolean;
      firstClassProvider: boolean;
      genericCompatible: boolean;
      explanation: string[];
    };
  };
  families: DashboardProviderMeshConsolidatedFamily[];
  routes: DashboardProviderMeshConsolidatedRoute[];
  modelSources: Record<string, number>;
  onboarding: {
    status: "ready" | "partial" | "blocked" | "unknown";
    requestedCapability: string | null;
    firstQuestionId: string;
    capabilityCount: number;
    selectedCapability: string | null;
    sameContractAcrossSurfaces: boolean;
    consumers: string[];
  };
  receipts: Array<{
    id: string;
    kind: string;
    source: string;
    detail: string;
    status: "ready" | "partial" | "missing";
  }>;
  policy: {
    noProviderExecutionPerformed: boolean;
    modelPickerContractIsSourceOfTruth: boolean;
    providerFactoryUsesSelectedProfile: boolean;
    catalogDoesNotCreateRuntimeAdapter: boolean;
    noLegacyProviderSwitch: boolean;
    onboardingAsksCapabilityFirst: boolean;
    secretsSerialized: boolean;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    pickerHint: string;
    onboardingHint: string;
  };
  nextSafeAction: string;
};
