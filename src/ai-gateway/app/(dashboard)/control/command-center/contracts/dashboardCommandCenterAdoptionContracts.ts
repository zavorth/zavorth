import type {
  DashboardEventStatus,
  DashboardRuntimeStatus,
  DashboardToolRiskLevel,
} from "./dashboardCommandCenterCoreContracts.js";

export type DashboardPublicSiteDocsDemoSyncSnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status:
    | "synced-preview"
    | "needs-release-path"
    | "needs-public-site"
    | "needs-docs"
    | "needs-demo"
    | "blocked"
    | "stable-claim-blocked"
    | "unknown";
  sync: {
    releasePathLinked: boolean;
    releasePathStatus: string | null;
    websiteLinked: boolean;
    docsLinked: boolean;
    demoLinked: boolean;
    releaseBundleLinked: boolean;
    publicRoutes: string[];
  };
  publicSite: {
    status: string;
    routeCount: number;
    requiredRoutes: string[];
    forbiddenClaimCount: number;
    buildExecuted: boolean;
    deployExecuted: boolean;
  };
  docs: {
    status: string;
    routes: string[];
    recipeCount: number;
    noSecretsMatrixReady: boolean;
    releasePathMentionRequired: boolean;
  };
  demo: {
    status: string;
    route: string;
    fixtureFirst: boolean;
    requiredStateCount: number;
    requiredArtifactCount: number;
    replayExpected: boolean;
    approvalStoryPresent: boolean;
  };
  releaseNarrative: {
    channel: string;
    stableClaimAllowed: boolean;
    previewOnly: boolean;
    installerDryRun: boolean;
    rollbackDryRun: boolean;
    canaryDormant: boolean;
  };
  readiness: {
    releaseInstallerRollbackPathLinked: boolean;
    websitePublicLinked: boolean;
    publicDemoLinked: boolean;
    publicDocsRecipesLinked: boolean;
    publicReleaseBundleLinked: boolean;
    docsDemoAligned: boolean;
    noStableClaim: boolean;
    canPublishSitePreview: boolean;
    canAnnounceStable: boolean;
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
    noWebsiteBuildExecuted: boolean;
    noPublicDeployExecuted: boolean;
    noDemoLiveExecution: boolean;
    noExternalTelemetryEnabled: boolean;
    noReleasePublished: boolean;
    noInstallerExecuted: boolean;
    noStableClaimPublished: boolean;
    noCanaryStarted: boolean;
    docsMustDescribePreview: boolean;
    naturalLanguageDoesNotBypassPolicy: boolean;
    secretsSerialized: boolean;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    websiteRoute: string;
    docsRoute: string;
    examplesRoute: string;
    demoRoute: string;
    releaseRoute: string;
  };
  nextSafeAction: string;
};

export type DashboardFeedbackTelemetryProductLoopSnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status:
    | "opt-in-ready"
    | "needs-public-sync"
    | "needs-feedback-loop"
    | "needs-redaction-preview"
    | "needs-product-ledger"
    | "blocked"
    | "telemetry-disabled"
    | "unknown";
  feedback: {
    contractLinked: boolean;
    contractStatus: "ready" | "attention" | "blocked" | "unknown";
    route: string | null;
    fixturePath: string | null;
    previewCommand: string;
    revokeCommand: string;
    deleteCommand: string;
    requiredCommands: string[];
    previewAvailable: boolean;
    revokeAvailable: boolean;
    deleteAvailable: boolean;
  };
  telemetry: {
    enabledByDefault: false;
    optInRequired: true;
    externalTelemetryEnabled: false;
    redactedPreviewAvailable: boolean;
    aggregatedOnly: true;
    rawPayloadAllowed: false;
    consentAssumed: false;
  };
  productLoop: {
    ledgerPath: string;
    previewArtifactPath: string;
    ledgerAvailable: boolean;
    issueTemplateAvailable: boolean;
    supportRoute: string;
    productLearningEnabled: boolean;
  };
  readiness: {
    publicSiteDocsDemoSyncLinked: boolean;
    feedbackTelemetryContractLinked: boolean;
    feedbackRouteReady: boolean;
    docsFeedbackLinked: boolean;
    privacyLinked: boolean;
    canCollectFeedbackPreview: boolean;
    canSendFeedbackExternally: false;
    canEnableTelemetry: false;
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
    noTelemetryEnabled: true;
    noFeedbackSent: true;
    noExternalNetworkCall: true;
    noRawPayloadSerialized: true;
    noConsentAssumed: true;
    revokeDeleteAvailable: true;
    optInRequired: true;
    redactionPreviewRequired: true;
    productLedgerLocalOnly: true;
    naturalLanguageDoesNotBypassPolicy: true;
    secretsSerialized: false;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    feedbackRoute: string;
    privacyRoute: string;
    docsAnchor: string;
    previewCommand: string;
    revokeCommand: string;
    deleteCommand: string;
  };
  nextSafeAction: string;
};

export type DashboardPublicAdoptionPilotLoopSnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status:
    | "pilot-ready"
    | "needs-feedback-product-loop"
    | "needs-pilot-loop"
    | "needs-artifacts"
    | "needs-dashboard"
    | "blocked"
    | "adoption-disabled"
    | "unknown";
  feedbackProductLoop: {
    linked: boolean;
    status: string;
    optInReady: boolean;
    previewCommand: string | null;
    revokeCommand: string | null;
    deleteCommand: string | null;
  };
  pilot: {
    contractLinked: boolean;
    contractStatus: "ready" | "attention" | "blocked" | "unknown";
    phase: string | null;
    artifactDir: string | null;
    templateCount: number;
    triageRuleCount: number;
    ledgerEntryCount: number;
    supportPolicyCount: number;
    dashboardMetricCount: number;
    nextPhase: string | null;
  };
  artifacts: {
    feedbackPreviewPath: string | null;
    pilotLedgerPath: string | null;
    dashboardPath: string | null;
    feedbackPreviewReady: boolean;
    pilotLedgerReady: boolean;
    dashboardReady: boolean;
  };
  adoptionLoop: {
    plannedPilotCount: number;
    activePilotCount: number;
    completedPilotCount: number;
    highSeverityRuleCount: number;
    supportPolicyReady: boolean;
    dashboardAggregationOnly: boolean;
    noPayloadPolicy: boolean;
  };
  readiness: {
    feedbackProductLoopReady: boolean;
    pilotLoopContractLinked: boolean;
    templatesReady: boolean;
    triageReady: boolean;
    ledgerReady: boolean;
    supportReady: boolean;
    dashboardReady: boolean;
    canStartControlledPilot: boolean;
    canCollectPublicFeedback: boolean;
    canPublishPilotMetrics: boolean;
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
    noImplicitCollection: true;
    noTelemetryEnabled: true;
    noExternalSubmission: true;
    noWorkspacePayloadStored: true;
    noSecretsSerialized: true;
    optInRequired: true;
    redactedPreviewRequired: true;
    localLedgerOnly: true;
    dashboardAggregatedOnly: true;
    pilotRequiresExplicitOwner: true;
    naturalLanguageDoesNotBypassPolicy: true;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    feedbackRoute: string;
    docsAnchor: string;
    pilotLoopCommand: string;
    qaCommand: string;
    phaseGateCommand: string;
    ledgerArtifact: string;
    dashboardArtifact: string;
  };
  nextSafeAction: string;
};

export type DashboardIntegrationShowcasePartnerSurfaceSnapshot = {
  contractVersion: string;
  generatedAt: string;
  identifiers: {
    runId: string;
    traceId: string;
    requestId: string;
    sessionId: string;
  };
  status:
    | "showcase-ready"
    | "needs-public-adoption-pilot-loop"
    | "needs-integration-showcase"
    | "needs-smoke"
    | "needs-matrix"
    | "needs-partner-surface"
    | "blocked"
    | "partner-claim-blocked"
    | "unknown";
  publicAdoptionPilotLoop: {
    linked: boolean;
    status: string;
    pilotReady: boolean;
    qaCommand: string | null;
  };
  showcase: {
    contractLinked: boolean;
    contractStatus: "ready" | "attention" | "blocked" | "unknown";
    phase: string | null;
    routeCount: number;
    integrationCount: number;
    vendorCount: number;
    fixtureReadyCount: number;
    credentialModeCount: number;
    formalPartnersRegistered: number;
    nextPhase: string | null;
  };
  artifacts: {
    smokePath: string | null;
    matrixPath: string | null;
    partnerSurfacePath: string | null;
    smokeReady: boolean;
    matrixReady: boolean;
    partnerSurfaceReady: boolean;
  };
  partnerSurface: {
    registryRequiredForFormalClaim: boolean;
    allowedClaimCount: number;
    prohibitedClaimCount: number;
    auditArtifactCount: number;
    unsafeFormalClaims: string[];
    canClaimFormalPartner: false;
  };
  readiness: {
    publicAdoptionPilotLoopReady: boolean;
    integrationShowcaseLinked: boolean;
    routesReady: boolean;
    fixtureModesReady: boolean;
    capabilityMatrixReady: boolean;
    trustPlaneReady: boolean;
    partnerSurfacePolicyReady: boolean;
    artifactsReady: boolean;
    canPublishShowcasePreview: boolean;
    canClaimFormalPartner: false;
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
    noFormalPartnerClaimWithoutRegistry: true;
    noCredentialRequiredForFixture: true;
    noNetworkRequiredForFixture: true;
    noExternalMutation: true;
    noSecretsSerialized: true;
    fixtureFirst: true;
    safeDegradationRequired: true;
    trustPlaneRequired: true;
    partnerSurfaceAuditable: true;
    naturalLanguageDoesNotBypassPolicy: true;
  };
  surface: {
    cliCommand: string;
    commandCenterPath: string;
    integrationsRoute: string;
    docsAnchor: string;
    integrationShowcaseCommand: string;
    qaCommand: string;
    phaseGateCommand: string;
    smokeArtifact: string;
    matrixArtifact: string;
    partnerSurfaceArtifact: string;
  };
  nextSafeAction: string;
};
