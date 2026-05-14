import type { DashboardCommandCenterAdapterInput } from "../adapters/dashboardCommandCenterAdapter";
import type { ModelPickerContract } from "../../../../../../contracts/ModelPickerContract.js";
import type { ZavorthPerceptionCommandCenterProjection } from "../../../../../../contracts/ZavorthPerceptionCrossSurfaceCertificationContract.js";
import {
  createZavorthNativeCapabilityRegistryFixture,
  createZavorthNativeConfigStateRegistryFixture,
  createZavorthNativeDashboardViewModelRegistryFixture,
  createZavorthNativeIntegrationRegistryFixture,
  createZavorthNativeSessionHistoryRegistryFixture,
  normalizeZavorthPartialAdapterDeprecationGateFixture,
} from "../../../../../../contracts/CommandCenterRuntimeBoundaryContract.js";
import type {
  ZavorthNativeCapabilityRegistry,
  ZavorthNativeCapabilityRegistryEntry,
  ZavorthNativeConfigStateRegistry,
  ZavorthNativeConfigStateRecord,
  ZavorthNativeDashboardViewModelRegistry,
  ZavorthNativeDashboardViewModelRecord,
  ZavorthNativeIntegrationRecord,
  ZavorthNativeIntegrationRegistry,
  ZavorthNativeSessionHistoryRegistry,
  ZavorthNativeSessionMetadataRecord,
  ZavorthPartialAdapterDeprecationNormalization,
} from "../../../../../../contracts/CommandCenterRuntimeBoundaryContract.js";
import type {
  DashboardAgentEvent,
  DashboardAgentRun,
  DashboardApprovalSummary,
  DashboardAgentTeamCompilerSnapshot,
  DashboardAskBeforeAssumptionPolicySnapshot,
  DashboardArtifactMemorySnapshot,
  DashboardArtifactSummary,
  DashboardBudgetSnapshot,
  DashboardCapabilityNegotiationSnapshot,
  DashboardChatMessage,
  DashboardCrossChannelContinuitySnapshot,
  DashboardFeedbackTelemetryProductLoopSnapshot,
  DashboardHealthSnapshot,
  DashboardIdentitySnapshot,
  DashboardIntegrationShowcasePartnerSurfaceSnapshot,
  DashboardIntegrationSummary,
  DashboardLogEntry,
  DashboardMemorySignal,
  DashboardMemoryWithReceiptsSnapshot,
  DashboardModelProfile,
  DashboardNaturalCapabilityDiscoverySnapshot,
  DashboardNaturalFirstRuntimeSnapshot,
  DashboardPersonalOpsAutopilotSnapshot,
  DashboardProductEntryRuntimeSnapshot,
  DashboardProductizationEvidenceSnapshot,
  DashboardPublicAdoptionPilotLoopSnapshot,
  DashboardPublicSiteDocsDemoSyncSnapshot,
  DashboardProviderMeshConsolidationSnapshot,
  DashboardProviderArenaSnapshot,
  DashboardProviderCockpitSnapshot,
  DashboardReplyPort,
  DashboardBlueprintCompletionGateSnapshot,
  DashboardReleaseAdoptionReadinessSnapshot,
  DashboardReleaseCandidatePreCanaryGateSnapshot,
  DashboardReleaseInstallerRollbackPathSnapshot,
  DashboardReleaseStatus,
  DashboardReplaySummary,
  DashboardRunArtifactReceiptReplaySnapshot,
  DashboardRunObservatorySnapshot,
  DashboardRuntimeAdapterSource,
  DashboardRuntimeStatus,
  DashboardSafetyNarrativeSnapshot,
  DashboardSelfingDashboardSnapshot,
  DashboardSessionSummary,
  DashboardSkillMcpQuarantineSnapshot,
  DashboardSubagentAutoInvocationSnapshot,
  DashboardTaskSummary,
  DashboardToolExposure,
  DashboardToolExposureProfile,
  DashboardToolRehearsalSnapshot,
  DashboardUniversalIntentTrustEnforcementSnapshot,
  DashboardUniversalPreviewModeSnapshot,
} from "../contracts";

export const COMMAND_CENTER_RUNTIME_PROJECTION_VERSION = "command-center-runtime-projection/v1" as const;
export const COMMAND_CENTER_NATIVE_FIRST_RUNTIME_PROJECTION_VERSION = "command-center-native-first-runtime-projection/v1" as const;

export type CommandCenterNativeFirstConsumerIntegrationSource = {
  adapterDeprecation: ZavorthPartialAdapterDeprecationNormalization;
  capabilityRegistry: ZavorthNativeCapabilityRegistry;
  dashboardRegistry: ZavorthNativeDashboardViewModelRegistry;
  integrationRegistry: ZavorthNativeIntegrationRegistry;
  sessionHistoryRegistry: ZavorthNativeSessionHistoryRegistry;
  configStateRegistry: ZavorthNativeConfigStateRegistry;
  adapterRefreshRequested: false;
  adapterCalledForDefaultLookup: false;
  adapterCalledForDefaultRender: false;
  externalSourceLiveCalledForDefaultPath: false;
  executionAttempted: false;
  stateMigrationAttempted: false;
  sourceModuleCopyAttempted: false;
  rawSecretSerialized: false;
};

export type CommandCenterNativeFirstConsumerIntegrationResult = {
  nativeContract: "CommandCenterNativeFirstConsumerIntegration/v1";
  projection: CommandCenterRuntimeProjection;
  adapterInput: DashboardCommandCenterAdapterInput;
  policy: {
    commandCenterNativeFirstEnabled: true;
    commandCenterDefaultAdapterCall: false;
    externalSourceRequiredForCommandCenterRender: false;
    externalSourceRequiredForCommandCenterLookup: false;
    adapterRefreshAllowed: true;
    adapterRemovalAllowed: false;
    executionAuthority: false;
    messageActuallySent: false;
    providerActuallyExecuted: false;
    commandActuallyExecuted: false;
    toolActuallyExecuted: false;
    stateMigrated: false;
    sourceModuleCopied: false;
    rawSecretSerialized: false;
  };
  nativeRegistryConsumer: {
    capabilityCardsFromNativeRegistry: true;
    dashboardViewsFromNativeRegistry: true;
    integrationMetadataFromNativeRegistry: true;
    sessionHistoryMetadataFromNativeRegistry: true;
    configStateMetadataFromNativeRegistry: true;
    adapterFallbackExplicitOnly: true;
  };
};

export type CommandCenterRuntimeProjection = {
  projectionVersion: typeof COMMAND_CENTER_RUNTIME_PROJECTION_VERSION;
  generatedAt: string;
  adapterSource: DashboardRuntimeAdapterSource;
  runtimeStatus: DashboardRuntimeStatus;
  wsStatus: "connecting" | "connected" | "disconnected";
  state?: Record<string, unknown> | null;
  runtime?: Record<string, unknown> | null;
  activeSessionId?: string | null;
  effectiveSessionId?: string | null;
  productModeId?: string;
  productModeLabel?: string;
  error?: string | null;
  loading?: boolean;
  sending?: boolean;
  agentRun: DashboardAgentRun | null;
  sessions: DashboardSessionSummary[];
  messages: DashboardChatMessage[];
  tasks: DashboardTaskSummary[];
  events: DashboardAgentEvent[];
  approvals: DashboardApprovalSummary[];
  artifacts: DashboardArtifactSummary[];
  memorySignals: DashboardMemorySignal[];
  capabilities: DashboardToolExposure[];
  toolExposure: DashboardToolExposureProfile;
  budget?: DashboardBudgetSnapshot | null;
  replay?: DashboardReplaySummary | null;
  runObservatory?: DashboardRunObservatorySnapshot | null;
  naturalFirstRuntime?: DashboardNaturalFirstRuntimeSnapshot | null;
  capabilityDiscovery?: DashboardNaturalCapabilityDiscoverySnapshot | null;
  universalPreviewMode?: DashboardUniversalPreviewModeSnapshot | null;
  capabilityNegotiation?: DashboardCapabilityNegotiationSnapshot | null;
  toolRehearsal?: DashboardToolRehearsalSnapshot | null;
  safetyNarrative?: DashboardSafetyNarrativeSnapshot | null;
  memoryWithReceipts?: DashboardMemoryWithReceiptsSnapshot | null;
  selfingDashboard?: DashboardSelfingDashboardSnapshot | null;
  artifactMemory?: DashboardArtifactMemorySnapshot | null;
  personalOpsAutopilot?: DashboardPersonalOpsAutopilotSnapshot | null;
  agentTeamCompiler?: DashboardAgentTeamCompilerSnapshot | null;
  crossChannelContinuity?: DashboardCrossChannelContinuitySnapshot | null;
  askBeforeAssumptionPolicy?: DashboardAskBeforeAssumptionPolicySnapshot | null;
  providerMeshConsolidation?: DashboardProviderMeshConsolidationSnapshot | null;
  universalIntentTrustEnforcement?: DashboardUniversalIntentTrustEnforcementSnapshot | null;
  runArtifactReceiptReplay?: DashboardRunArtifactReceiptReplaySnapshot | null;
  productizationEvidence?: DashboardProductizationEvidenceSnapshot | null;
  productEntryRuntime?: DashboardProductEntryRuntimeSnapshot | null;
  releaseInstallerRollbackPath?: DashboardReleaseInstallerRollbackPathSnapshot | null;
  publicSiteDocsDemoSync?: DashboardPublicSiteDocsDemoSyncSnapshot | null;
  feedbackTelemetryProductLoop?: DashboardFeedbackTelemetryProductLoopSnapshot | null;
  publicAdoptionPilotLoop?: DashboardPublicAdoptionPilotLoopSnapshot | null;
  integrationShowcasePartnerSurface?: DashboardIntegrationShowcasePartnerSurfaceSnapshot | null;
  releaseAdoptionReadiness?: DashboardReleaseAdoptionReadinessSnapshot | null;
  releaseCandidatePreCanaryGate?: DashboardReleaseCandidatePreCanaryGateSnapshot | null;
  blueprintCompletionGate?: DashboardBlueprintCompletionGateSnapshot | null;
  skillMcpQuarantine?: DashboardSkillMcpQuarantineSnapshot | null;
  providerArena?: DashboardProviderArenaSnapshot | null;
  providerCockpit?: DashboardProviderCockpitSnapshot | null;
  subagentAutoInvocation?: DashboardSubagentAutoInvocationSnapshot | null;
  perceptionControl?: ZavorthPerceptionCommandCenterProjection | null;
  replyPorts: DashboardReplyPort[];
  modelProfile?: DashboardModelProfile | null;
  modelPicker?: ModelPickerContract | null;
  health?: DashboardHealthSnapshot | null;
  releaseStatus?: DashboardReleaseStatus | null;
  integrations: DashboardIntegrationSummary[];
  identity?: DashboardIdentitySnapshot | null;
  logs: DashboardLogEntry[];
  workflowJobs: Record<string, unknown>[];
  runtimeWarnings: string[];
};

function statusFromNativeView(status: ZavorthNativeDashboardViewModelRecord["status"]): DashboardRuntimeStatus {
  if (status === "ready") {
    return "ready";
  }
  if (status === "blocked") {
    return "blocked";
  }
  if (status === "unavailable" || status === "unknown") {
    return "offline";
  }
  return "degraded";
}

function eventStatusFromNativeView(status: ZavorthNativeDashboardViewModelRecord["status"]): DashboardAgentEvent["status"] {
  if (status === "ready" || status === "blocked") {
    return "done";
  }
  if (status === "unavailable") {
    return "failed";
  }
  return "pending";
}

function riskFromCapability(entry: ZavorthNativeCapabilityRegistryEntry): DashboardToolRiskLevel {
  if (entry.classification === "blocked" || entry.classification === "unavailable") {
    return "danger";
  }
  if (
    entry.classification === "approval-required" ||
    entry.classification === "send-capable-but-blocked" ||
    entry.classification === "degraded" ||
    entry.classification === "unsupported"
  ) {
    return "attention";
  }
  return "safe";
}

function toolExposureFromCapability(entry: ZavorthNativeCapabilityRegistryEntry): DashboardToolExposure {
  return {
    id: `native-capability:${entry.id}`,
    label: entry.publicLabel,
    capabilityId: entry.id,
    risk: riskFromCapability(entry),
    requiresApproval: entry.policyDisposition === "approval-required",
    description: entry.publicDescription,
  };
}

function healthStatusFromPolicies(
  adapterDeprecation: ZavorthPartialAdapterDeprecationNormalization,
): DashboardRuntimeStatus {
  return adapterDeprecation.blockedSurfaces.length > 0 || adapterDeprecation.adapterRequiredSurfaces.length > 0
    ? "degraded"
    : "ready";
}

function healthFromNativeFirstPolicy(
  adapterDeprecation: ZavorthPartialAdapterDeprecationNormalization,
  dashboardRegistry: ZavorthNativeDashboardViewModelRegistry,
): DashboardHealthSnapshot {
  return {
    status: healthStatusFromPolicies(adapterDeprecation),
    summary: "Command Center usando registries Zavorth-native no caminho padrao.",
    checks: [
      {
        id: "native-first-command-center",
        label: "Native-first Command Center",
        status: "ready",
        detail: "Lookup e render usam registries Zavorth-native.",
      },
      {
        id: "adapter-refresh-explicit",
        label: "Adapter refresh explicito",
        status: "degraded",
        detail: "Adapter reservado para refresh, reconciliacao ou fallback degradado.",
      },
      {
        id: "dashboard-registry-degraded-rows",
        label: "Estados degradados preservados",
        status: dashboardRegistry.list({ degradedOrUnavailable: true }).length > 0 ? "degraded" : "ready",
        detail: "Linhas degraded/unavailable continuam renderizaveis.",
      },
    ],
  };
}

function integrationStatus(record: ZavorthNativeIntegrationRecord | ZavorthNativeConfigStateRecord): DashboardIntegrationSummary["status"] {
  const status = "status" in record ? record.status : "degraded";
  if (status === "ready") {
    return "connected";
  }
  if (status === "blocked") {
    return "disabled";
  }
  if (status === "unavailable" || status === "unknown") {
    return "missing";
  }
  return "degraded";
}

function integrationCategoryFromNative(record: ZavorthNativeIntegrationRecord): DashboardIntegrationSummary["category"] {
  if (record.integrationKind === "provider") {
    return "provider";
  }
  if (record.integrationKind === "channel" || record.integrationKind === "message-transport") {
    return "channel";
  }
  return "runtime";
}

function configCategoryForDashboard(record: ZavorthNativeConfigStateRecord): DashboardIntegrationSummary["category"] {
  if (record.category === "provider-credentials") {
    return "provider";
  }
  if (record.category === "channel-credentials") {
    return "channel";
  }
  if (record.category === "sqlite-store" || record.category === "workspace") {
    return "storage";
  }
  return "runtime";
}

function integrationsFromNativeRegistries(
  integrationRegistry: ZavorthNativeIntegrationRegistry,
  configStateRegistry: ZavorthNativeConfigStateRegistry,
): DashboardIntegrationSummary[] {
  const integrationRows = integrationRegistry.list().map((record): DashboardIntegrationSummary => ({
    id: `native-integration:${record.id}`,
    label: `${record.integrationKind} metadata`,
    category: integrationCategoryFromNative(record),
    status: integrationStatus(record),
    detail: `${record.classification}; SecretRefs: ${record.requiredSecretRefs.length}.`,
  }));
  const configRows = configStateRegistry.list().map((record): DashboardIntegrationSummary => ({
    id: `native-config-state:${record.id}`,
    label: record.publicLabel,
    category: configCategoryForDashboard(record),
    status: integrationStatus(record),
    detail: `${record.decision}; ${record.migrationEligibility}.`,
  }));

  return [...integrationRows, ...configRows];
}

function sessionStatusForDashboard(status: ZavorthNativeSessionMetadataRecord["status"]): DashboardSessionSummary["status"] {
  if (status === "ready") {
    return "idle";
  }
  if (status === "unavailable") {
    return "closed";
  }
  return "blocked";
}

function sessionsFromNativeRegistry(
  sessionHistoryRegistry: ZavorthNativeSessionHistoryRegistry,
): DashboardSessionSummary[] {
  return sessionHistoryRegistry.listSessions().map((session): DashboardSessionSummary => ({
    id: session.publicSessionAlias,
    title: session.title,
    updatedAt: session.timestamps.updatedAt || session.timestamps.createdAt || "metadata-only",
    status: sessionStatusForDashboard(session.status),
    channelLabel: session.channel,
    messageCount: session.messageCount,
  }));
}

function messagesFromNativeRegistry(
  sessionHistoryRegistry: ZavorthNativeSessionHistoryRegistry,
): DashboardChatMessage[] {
  return sessionHistoryRegistry.listMessages().map((message): DashboardChatMessage => ({
    id: message.publicMessageAlias,
    role: message.roleFamily === "unknown" ? "system" : message.roleFamily,
    text: message.contentState === "redacted" ? "[redacted-content]" : "[unavailable]",
    createdAt: message.createdAt || "metadata-only",
  }));
}

function eventsFromNativeDashboardViews(
  dashboardRegistry: ZavorthNativeDashboardViewModelRegistry,
  adapterDeprecation: ZavorthPartialAdapterDeprecationNormalization,
): DashboardAgentEvent[] {
  const viewEvents = dashboardRegistry.list({ degradedOrUnavailable: true }).slice(0, 12).map((view): DashboardAgentEvent => ({
    id: `native-view:${view.id}`,
    kind: view.status === "unavailable" ? "error" : "status",
    title: view.label,
    detail: view.summary,
    status: eventStatusFromNativeView(view.status),
  }));
  const policyEvents = [
    {
      id: "native-first-policy:adapter-refresh",
      kind: "status" as const,
      title: "Adapter refresh explicit",
      detail: `${adapterDeprecation.adapterRequiredSurfaces.length} surface remains adapter-required for refresh/reconciliation.`,
      status: "pending" as const,
    },
  ];

  return [...viewEvents, ...policyEvents];
}

function runtimeMetadata(
  source: CommandCenterNativeFirstConsumerIntegrationSource,
): Record<string, unknown> {
  return {
    status: "ready",
    nativeFirst: {
      commandCenterNativeFirstEnabled: true,
      commandCenterDefaultAdapterCall: false,
      externalSourceRequiredForCommandCenterRender: false,
      externalSourceRequiredForCommandCenterLookup: false,
      adapterRefreshAllowed: source.adapterDeprecation.executionGate.adapterRefreshAllowed,
      adapterRemovalAllowed: source.adapterDeprecation.executionGate.adapterRemovalAllowed,
    },
    nativeRegistryCounts: {
      capabilities: source.capabilityRegistry.list().length,
      dashboardViews: source.dashboardRegistry.list().length,
      integrations: source.integrationRegistry.list().length,
      sessions: source.sessionHistoryRegistry.listSessions().length,
      configState: source.configStateRegistry.list().length,
    },
  };
}

export function createCommandCenterNativeFirstConsumerIntegrationFixtureSource(): CommandCenterNativeFirstConsumerIntegrationSource {
  return {
    adapterDeprecation: normalizeZavorthPartialAdapterDeprecationGateFixture(),
    capabilityRegistry: createZavorthNativeCapabilityRegistryFixture(),
    dashboardRegistry: createZavorthNativeDashboardViewModelRegistryFixture(),
    integrationRegistry: createZavorthNativeIntegrationRegistryFixture(),
    sessionHistoryRegistry: createZavorthNativeSessionHistoryRegistryFixture(),
    configStateRegistry: createZavorthNativeConfigStateRegistryFixture(),
    adapterRefreshRequested: false,
    adapterCalledForDefaultLookup: false,
    adapterCalledForDefaultRender: false,
    externalSourceLiveCalledForDefaultPath: false,
    executionAttempted: false,
    stateMigrationAttempted: false,
    sourceModuleCopyAttempted: false,
    rawSecretSerialized: false,
  };
}

export function buildCommandCenterNativeFirstRuntimeProjection(
  source: CommandCenterNativeFirstConsumerIntegrationSource = createCommandCenterNativeFirstConsumerIntegrationFixtureSource(),
): CommandCenterNativeFirstConsumerIntegrationResult {
  const generatedAt = source.adapterDeprecation.generatedAt;
  const capabilities = source.capabilityRegistry.list().map(toolExposureFromCapability);
  const health = healthFromNativeFirstPolicy(source.adapterDeprecation, source.dashboardRegistry);
  const projection: CommandCenterRuntimeProjection = {
    projectionVersion: COMMAND_CENTER_RUNTIME_PROJECTION_VERSION,
    generatedAt,
    adapterSource: {
      kind: "universal-agent-runtime",
      label: "Zavorth Native Registry Projection",
      version: COMMAND_CENTER_NATIVE_FIRST_RUNTIME_PROJECTION_VERSION,
      notes: "Native-first default path; adapter refresh is explicit.",
    },
    runtimeStatus: health.status === "blocked" ? "blocked" : health.status === "offline" ? "offline" : "ready",
    wsStatus: "connected",
    runtime: runtimeMetadata(source),
    activeSessionId: null,
    effectiveSessionId: null,
    productModeId: "native-first",
    productModeLabel: "native-first",
    error: null,
    loading: false,
    sending: false,
    agentRun: null,
    sessions: sessionsFromNativeRegistry(source.sessionHistoryRegistry),
    messages: messagesFromNativeRegistry(source.sessionHistoryRegistry),
    tasks: [],
    events: eventsFromNativeDashboardViews(source.dashboardRegistry, source.adapterDeprecation),
    approvals: [],
    artifacts: [],
    memorySignals: [],
    capabilities,
    toolExposure: {
      mode: capabilities.some((capability) => capability.risk === "danger")
        ? "restricted"
        : capabilities.some((capability) => capability.requiresApproval || capability.risk === "attention")
          ? "confirm"
          : "safe",
      summary: "Capabilities loaded from Zavorth-native registries.",
      tools: capabilities,
    },
    budget: null,
    replay: null,
    runObservatory: {
      generatedAt,
      query: {},
      totalRuns: 0,
      matchedRuns: 0,
      indexes: {
        runIds: [],
        traceIds: [],
        sessionIds: [],
        statuses: [],
      },
      runs: [],
    },
    replyPorts: [
      {
        id: "command-center-native-first",
        label: "Command Center",
        kind: "web",
        status: "available",
        primary: true,
        description: "Native-first dashboard projection.",
      },
    ],
    modelProfile: {
      providerLabel: "Zavorth",
      modelLabel: "Native Registry",
      routingPolicy: "gateway",
      supportsTools: true,
    },
    health,
    releaseStatus: null,
    integrations: integrationsFromNativeRegistries(source.integrationRegistry, source.configStateRegistry),
    identity: {
      agentName: "Zavorth",
      userName: "Operator",
      language: "en-US",
      tone: "direct",
      initiative: "balanced",
      firstRunStatus: "complete",
      summary: "Zavorth Command Center using native registry view models.",
    },
    logs: source.adapterDeprecation.policies.map((policy) => ({
      id: `native-first-policy:${policy.surfaceId}`,
      level: policy.policyMode === "blocked" ? "warn" : "info",
      source: "native-registry-policy",
      message: `${policy.surfaceId}: ${policy.policyMode}`,
      createdAt: generatedAt,
    })),
    workflowJobs: [],
    runtimeWarnings: [
      "Adapter refresh/reconciliation is explicit and not the default render path.",
      ...source.adapterDeprecation.blockedSurfaces.map((surfaceId) => `Blocked surface: ${surfaceId}`),
    ],
  };
  const adapterInput = buildDashboardAdapterInputFromCommandCenterRuntimeProjection(projection);

  return {
    nativeContract: "CommandCenterNativeFirstConsumerIntegration/v1",
    projection,
    adapterInput,
    policy: {
      commandCenterNativeFirstEnabled: true,
      commandCenterDefaultAdapterCall: false,
      externalSourceRequiredForCommandCenterRender: false,
      externalSourceRequiredForCommandCenterLookup: false,
      adapterRefreshAllowed: true,
      adapterRemovalAllowed: false,
      executionAuthority: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      stateMigrated: false,
      sourceModuleCopied: false,
      rawSecretSerialized: false,
    },
    nativeRegistryConsumer: {
      capabilityCardsFromNativeRegistry: true,
      dashboardViewsFromNativeRegistry: true,
      integrationMetadataFromNativeRegistry: true,
      sessionHistoryMetadataFromNativeRegistry: true,
      configStateMetadataFromNativeRegistry: true,
      adapterFallbackExplicitOnly: true,
    },
  };
}

export function buildDashboardAdapterInputFromCommandCenterRuntimeProjection(
  projection: CommandCenterRuntimeProjection,
): DashboardCommandCenterAdapterInput {
  const toolEvents = projection.events.filter((event) => event.kind === "tool");

  return {
    state: projection.state || null,
    runtime: {
      ...(projection.runtime || {}),
      status: projection.runtimeStatus,
      provider: projection.modelProfile?.providerLabel,
      model: projection.modelProfile?.modelLabel,
      adapterSource: projection.adapterSource,
      modelProfile: projection.modelProfile || undefined,
      modelPicker: projection.modelPicker || undefined,
      toolExposureProfile: projection.toolExposure,
      health: projection.health || undefined,
      releaseStatus: projection.releaseStatus || undefined,
      integrations: projection.integrations,
      identity: projection.identity || undefined,
      logs: projection.logs,
      naturalFirstRuntime: projection.naturalFirstRuntime || undefined,
      capabilityDiscovery: projection.capabilityDiscovery || undefined,
      universalPreviewMode: projection.universalPreviewMode || undefined,
      capabilityNegotiation: projection.capabilityNegotiation || undefined,
      toolRehearsal: projection.toolRehearsal || undefined,
      safetyNarrative: projection.safetyNarrative || undefined,
      memoryWithReceipts: projection.memoryWithReceipts || undefined,
      selfingDashboard: projection.selfingDashboard || undefined,
      artifactMemory: projection.artifactMemory || undefined,
      personalOpsAutopilot: projection.personalOpsAutopilot || undefined,
      agentTeamCompiler: projection.agentTeamCompiler || undefined,
      crossChannelContinuity: projection.crossChannelContinuity || undefined,
      askBeforeAssumptionPolicy: projection.askBeforeAssumptionPolicy || undefined,
      providerMeshConsolidation: projection.providerMeshConsolidation || undefined,
      universalIntentTrustEnforcement: projection.universalIntentTrustEnforcement || undefined,
      runArtifactReceiptReplay: projection.runArtifactReceiptReplay || undefined,
      productizationEvidence: projection.productizationEvidence || undefined,
      productEntryRuntime: projection.productEntryRuntime || undefined,
      releaseInstallerRollbackPath: projection.releaseInstallerRollbackPath || undefined,
      publicSiteDocsDemoSync: projection.publicSiteDocsDemoSync || undefined,
      feedbackTelemetryProductLoop: projection.feedbackTelemetryProductLoop || undefined,
      publicAdoptionPilotLoop: projection.publicAdoptionPilotLoop || undefined,
      integrationShowcasePartnerSurface: projection.integrationShowcasePartnerSurface || undefined,
      releaseAdoptionReadiness: projection.releaseAdoptionReadiness || undefined,
      releaseCandidatePreCanaryGate: projection.releaseCandidatePreCanaryGate || undefined,
      blueprintCompletionGate: projection.blueprintCompletionGate || undefined,
      skillMcpQuarantine: projection.skillMcpQuarantine || undefined,
      providerArena: projection.providerArena || undefined,
      providerCockpit: projection.providerCockpit || undefined,
      subagentAutoInvocation: projection.subagentAutoInvocation || undefined,
      perceptionControl: projection.perceptionControl || undefined,
    },
    activeSessionId: projection.activeSessionId || null,
    effectiveSessionId: projection.effectiveSessionId || projection.activeSessionId || null,
    productModeId: projection.productModeId,
    productModeLabel: projection.productModeLabel || "agent",
    runtimeStatus: projection.runtimeStatus,
    wsStatus: projection.wsStatus,
    error: projection.error || null,
    loading: projection.loading,
    sending: projection.sending,
    sessionEntries: projection.sessions,
    transcriptEntries: projection.messages,
    taskEntries: projection.tasks,
    toolRuns: toolEvents,
    artifacts: projection.artifacts,
    approvals: projection.approvals,
    budget: projection.budget || null,
    budgetSnapshot: projection.budget || null,
    replay: projection.replay || null,
    runObservatory: projection.runObservatory || null,
    naturalFirstRuntime: projection.naturalFirstRuntime || null,
    capabilityDiscovery: projection.capabilityDiscovery || null,
    universalPreviewMode: projection.universalPreviewMode || null,
    capabilityNegotiation: projection.capabilityNegotiation || null,
    toolRehearsal: projection.toolRehearsal || null,
    safetyNarrative: projection.safetyNarrative || null,
    memoryWithReceipts: projection.memoryWithReceipts || null,
    selfingDashboard: projection.selfingDashboard || null,
    artifactMemory: projection.artifactMemory || null,
    personalOpsAutopilot: projection.personalOpsAutopilot || null,
    agentTeamCompiler: projection.agentTeamCompiler || null,
    crossChannelContinuity: projection.crossChannelContinuity || null,
    askBeforeAssumptionPolicy: projection.askBeforeAssumptionPolicy || null,
    providerMeshConsolidation: projection.providerMeshConsolidation || null,
    universalIntentTrustEnforcement: projection.universalIntentTrustEnforcement || null,
    runArtifactReceiptReplay: projection.runArtifactReceiptReplay || null,
    productizationEvidence: projection.productizationEvidence || null,
    productEntryRuntime: projection.productEntryRuntime || null,
    releaseInstallerRollbackPath: projection.releaseInstallerRollbackPath || null,
    publicSiteDocsDemoSync: projection.publicSiteDocsDemoSync || null,
    feedbackTelemetryProductLoop: projection.feedbackTelemetryProductLoop || null,
    publicAdoptionPilotLoop: projection.publicAdoptionPilotLoop || null,
    integrationShowcasePartnerSurface: projection.integrationShowcasePartnerSurface || null,
    releaseAdoptionReadiness: projection.releaseAdoptionReadiness || null,
    releaseCandidatePreCanaryGate: projection.releaseCandidatePreCanaryGate || null,
    blueprintCompletionGate: projection.blueprintCompletionGate || null,
    skillMcpQuarantine: projection.skillMcpQuarantine || null,
    providerArena: projection.providerArena || null,
    providerCockpit: projection.providerCockpit || null,
    subagentAutoInvocation: projection.subagentAutoInvocation || null,
    perceptionControl: projection.perceptionControl || null,
    health: projection.health || null,
    healthChecks: projection.health?.checks || [],
    releaseStatus: projection.releaseStatus || null,
    integrations: projection.integrations,
    identity: projection.identity || null,
    logs: projection.logs,
    workflowJobs: projection.workflowJobs,
    capabilities: projection.capabilities.length > 0 ? projection.capabilities : projection.toolExposure.tools,
    memoryRecallSources: projection.memorySignals,
    runtimeWarnings: projection.runtimeWarnings,
    adapterSource: projection.adapterSource,
    agentRun: projection.agentRun,
    agentEvents: projection.events,
    toolExposureProfile: projection.toolExposure,
    toolExposures: projection.toolExposure.tools,
    replyPorts: projection.replyPorts,
    modelProfile: projection.modelProfile || null,
    modelPicker: projection.modelPicker || null,
  };
}
