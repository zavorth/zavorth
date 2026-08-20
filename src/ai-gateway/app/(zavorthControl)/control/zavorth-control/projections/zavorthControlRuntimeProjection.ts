import {
  createZavorthNativeCapabilityRegistryFixture,
  createZavorthNativeConfigStateRegistryFixture,
  createZavorthNativeZavorthControlViewModelRegistryFixture,
  createZavorthNativeIntegrationRegistryFixture,
  createZavorthNativeSessionHistoryRegistryFixture,
} from '../../../../../../contracts/runtime/CommandCenterRuntimeBoundaryContract.js';
import type { ZavorthControlProviderCockpitSnapshot } from '../contracts/zavorthControlObservabilityContracts';

export const ZAVORTH_CONTROL_NATIVE_FIRST_RUNTIME_PROJECTION_VERSION = 'zavorth-control-native-first-runtime-projection/v1' as const;
export const ZAVORTH_CONTROL_NATIVE_FIRST_RUNTIME_NOW = '2026-05-19T00:00:00.000Z' as const;

type AnyRecord = Record<string, any>;

type ZavorthControlRuntimeProjectionProviderCockpit = {
  providerCockpit?: ZavorthControlProviderCockpitSnapshot | null;
  perceptionControl?: AnyRecord | null;
};

function array<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function statusFromNative(status: string): string {
  if (status === 'ready') {
    return 'ready';
  }
  if (status === 'blocked') {
    return 'blocked';
  }
  if (status === 'unavailable' || status === 'unknown') {
    return 'offline';
  }
  return 'degraded';
}

function integrationStatus(status: string): string {
  if (status === 'ready') {
    return 'connected';
  }
  if (status === 'blocked') {
    return 'disabled';
  }
  if (status === 'unavailable' || status === 'unknown') {
    return 'missing';
  }
  return 'degraded';
}

function riskFromCapability(entry: AnyRecord): string {
  if (entry.classification === 'blocked' || entry.classification === 'unavailable') {
    return 'danger';
  }
  if (
    entry.classification === 'approval-required' ||
    entry.classification === 'send-capable-but-blocked' ||
    entry.classification === 'degraded' ||
    entry.classification === 'unsupported'
  ) {
    return 'attention';
  }
  return 'safe';
}

function toolExposureFromCapability(entry: AnyRecord): AnyRecord {
  return {
    id: `native-capability:${entry.id}`,
    label: entry.publicLabel,
    capabilityId: entry.id,
    risk: riskFromCapability(entry),
    requiresApproval: entry.policyDisposition === 'approval-required',
    description: entry.publicDescription,
  };
}

function messagesFromNativeRegistry(sessionHistoryRegistry: AnyRecord): AnyRecord[] {
  return sessionHistoryRegistry.listMessages().map((message: AnyRecord) => ({
    id: message.publicMessageAlias,
    role: message.roleFamily === 'unknown' ? 'system' : message.roleFamily,
    text: message.contentState === 'redacted' ? '[redacted-content]' : '[unavailable]',
    createdAt: message.createdAt || 'metadata-only',
  }));
}

function sessionsFromNativeRegistry(sessionHistoryRegistry: AnyRecord): AnyRecord[] {
  return sessionHistoryRegistry.listSessions().map((session: AnyRecord) => ({
    id: session.publicSessionAlias,
    title: session.title,
    updatedAt: session.timestamps?.updatedAt || session.timestamps?.createdAt || 'metadata-only',
    status: session.status === 'ready' ? 'idle' : session.status === 'unavailable' ? 'closed' : 'blocked',
    channelLabel: session.channel,
    messageCount: session.messageCount,
  }));
}

function healthFromNative(policy: AnyRecord, zavorthControlRegistry: AnyRecord): AnyRecord {
  return {
    status: array(policy.blockedSurfaces).length > 0 ? 'degraded' : 'ready',
    summary: 'ZavorthControl usando registries Zavorth-native no path default.',
    checks: [
      {
        id: 'native-first-zavorthControl',
        label: 'Native-first ZavorthControl',
        status: 'ready',
        detail: 'Lookup e render usam registries Zavorth-native.',
      },
      {
        id: 'native-registry-only',
        label: 'surface nativa',
        status: 'ready',
        detail: 'Rendering does not depend on a legacy adapter.',
      },
      {
        id: 'zavorthControl-registry-degraded-rows',
        label: 'Degraded states preserved',
        status: zavorthControlRegistry.list({ degradedOrUnavailable: true }).length > 0 ? 'degraded' : 'ready',
        detail: 'Degraded or unavailable lines remain renderable.',
      },
    ],
  };
}

function integrationsFromNativeRegistries(integrationRegistry: AnyRecord, configStateRegistry: AnyRecord): AnyRecord[] {
  const integrationRows = integrationRegistry.list().map((record: AnyRecord) => ({
    id: `native-integration:${record.id}`,
    label: `${record.integrationKind} metadata`,
    category: record.integrationKind === 'provider' ? 'provider' : record.integrationKind === 'channel' ? 'channel' : 'runtime',
    status: integrationStatus(record.status),
    detail: `${record.classification}; SecretRefs: ${record.requiredSecretRefs?.length || 0}.`,
  }));
  const configRows = configStateRegistry.list().map((record: AnyRecord) => ({
    id: `native-config-state:${record.id}`,
    label: record.publicLabel,
    category: record.category === 'provider-credentials'
      ? 'provider'
      : record.category === 'channel-credentials'
        ? 'channel'
        : 'runtime',
    status: integrationStatus(record.status),
    detail: `${record.decision}; ${record.migrationEligibility}.`,
  }));
  return [...integrationRows, ...configRows];
}

function eventsFromNativeZavorthControlViews(zavorthControlRegistry: AnyRecord, policy: AnyRecord): AnyRecord[] {
  const viewEvents = zavorthControlRegistry.list({ degradedOrUnavailable: true }).slice(0, 12).map((view: AnyRecord) => ({
    id: `native-view:${view.id}`,
    kind: view.status === 'unavailable' ? 'error' : 'status',
    title: view.label,
    detail: view.summary,
    status: view.status === 'unavailable' ? 'failed' : view.status === 'ready' ? 'done' : 'pending',
  }));
  return [
    ...viewEvents,
    {
      id: 'native-first-policy:adapter-refresh',
      kind: 'status',
      title: 'Adapter refresh explicit',
      detail: policy.adapterRefreshAllowed ? 'Explicit refresh enabled by policy.' : 'Legacy adapter refresh disabled on the default path.',
      status: 'done',
    },
  ];
}

function perceptionControlFromSource(source: AnyRecord): AnyRecord | null {
  const projection = source.perceptionControl
    || source.zavorthControlProjection
    || source.zavorthControlProjection?.perceptionControl
    || source.zavorthControlProjection
    || null;
  return projection && typeof projection === 'object' && !Array.isArray(projection)
    ? projection as AnyRecord
    : null;
}

function createPolicy(): AnyRecord {
  return {
    generatedAt: ZAVORTH_CONTROL_NATIVE_FIRST_RUNTIME_NOW,
    adapterRefreshAllowed: false,
    adapterRemovalAllowed: false,
    blockedSurfaces: [],
    runtimeWarnings: [],
    logs: [
      {
        id: 'native-first-policy:default',
        level: 'info',
        source: 'native-registry-policy',
        message: 'ZavorthControl renderiza direct dos registries Zavorth-native.',
        createdAt: ZAVORTH_CONTROL_NATIVE_FIRST_RUNTIME_NOW,
      },
    ],
  };
}

export function buildZavorthControlAdapterInputFromZavorthControlRuntimeProjection(projection: AnyRecord): AnyRecord {
  return {
    adapterSource: projection.adapterSource,
    state: projection.state || null,
    runtime: {
      ...(projection.runtime || {}),
      status: projection.runtimeStatus,
      provider: projection.modelProfile?.providerLabel,
      model: projection.modelProfile?.modelLabel,
      modelProfile: projection.modelProfile,
      modelPicker: projection.modelPicker,
      toolExposureProfile: projection.toolExposure,
      health: projection.health,
      releaseStatus: projection.releaseStatus,
      integrations: projection.integrations,
      identity: projection.identity,
      logs: projection.logs,
      providerCockpit: projection.providerCockpit,
      perceptionControl: projection.perceptionControl,
    },
    wsStatus: projection.wsStatus,
    activeSessionId: projection.activeSessionId,
    effectiveSessionId: projection.effectiveSessionId,
    productModeId: projection.productModeId,
    productModeLabel: projection.productModeLabel,
    sessionEntries: projection.sessions || [],
    transcriptEntries: projection.messages || [],
    taskEntries: projection.tasks || [],
    events: projection.events || [],
    approvals: projection.approvals || [],
    artifacts: projection.artifacts || [],
    memorySignals: projection.memorySignals || [],
    capabilities: projection.capabilities || [],
    toolExposure: projection.toolExposure,
    budget: projection.budget,
    replay: projection.replay,
    runObservatory: projection.runObservatory,
    agentRun: projection.agentRun,
    workflowJobs: projection.workflowJobs || [],
    runtimeWarnings: projection.runtimeWarnings || [],
    modelProfile: projection.modelProfile,
    health: projection.health,
    releaseStatus: projection.releaseStatus,
    integrations: projection.integrations || [],
    identity: projection.identity,
    logs: projection.logs || [],
    subagentAutoInvocation: projection.subagentAutoInvocation,
    naturalFirstRuntime: projection.naturalFirstRuntime,
    capabilityDiscovery: projection.capabilityDiscovery,
    universalPreviewMode: projection.universalPreviewMode,
    capabilityNegotiation: projection.capabilityNegotiation,
    toolRehearsal: projection.toolRehearsal,
    safetyNarrative: projection.safetyNarrative,
    memoryWithReceipts: projection.memoryWithReceipts,
    agentSelfConfig: projection.agentSelfConfig,
    artifactMemory: projection.artifactMemory,
    personalOpsAutopilot: projection.personalOpsAutopilot,
    agentTeamCompiler: projection.agentTeamCompiler,
    dynamicWorkflow: projection.dynamicWorkflow,
    effortControl: projection.effortControl,
    crossChannelContinuity: projection.crossChannelContinuity,
    askBeforeAssumptionPolicy: projection.askBeforeAssumptionPolicy,
    providerMeshConsolidation: projection.providerMeshConsolidation,
    universalIntentTrustEnforcement: projection.universalIntentTrustEnforcement,
    runArtifactReceiptReplay: projection.runArtifactReceiptReplay,
    productizationEvidence: projection.productizationEvidence,
    productEntryRuntime: projection.productEntryRuntime,
    releaseInstallerRollbackPath: projection.releaseInstallerRollbackPath,
    publicSiteDocsDemoSync: projection.publicSiteDocsDemoSync,
    feedbackTelemetryProductLoop: projection.feedbackTelemetryProductLoop,
    publicAdoptionPilotLoop: projection.publicAdoptionPilotLoop,
    integrationShowcasePartnerSurface: projection.integrationShowcasePartnerSurface,
    releaseAdoptionReadiness: projection.releaseAdoptionReadiness,
    releaseCandidatePreCanaryGate: projection.releaseCandidatePreCanaryGate,
    blueprintCompletionGate: projection.blueprintCompletionGate,
    skillMcpQuarantine: projection.skillMcpQuarantine,
    providerArena: projection.providerArena,
    providerCockpit: projection.providerCockpit,
    perceptionControl: projection.perceptionControl,
  };
}

export function createZavorthControlNativeFirstConsumerIntegrationFixtureSource(): AnyRecord {
  return {
    nativeFirstPolicy: createPolicy(),
    capabilityRegistry: createZavorthNativeCapabilityRegistryFixture(),
    zavorthControlRegistry: createZavorthNativeZavorthControlViewModelRegistryFixture(),
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

export function buildZavorthControlNativeFirstRuntimeProjection(
  source: AnyRecord = createZavorthControlNativeFirstConsumerIntegrationFixtureSource(),
): AnyRecord {
  const generatedAt = source.nativeFirstPolicy.generatedAt;
  const capabilities = source.capabilityRegistry.list().map(toolExposureFromCapability);
  const health = healthFromNative(source.nativeFirstPolicy, source.zavorthControlRegistry);
  const projection = {
    projectionVersion: 'zavorth-control-runtime-projection/v1',
    generatedAt,
    adapterSource: {
      kind: 'universal-agent-runtime',
      label: 'Zavorth Native Registry Projection',
      version: ZAVORTH_CONTROL_NATIVE_FIRST_RUNTIME_PROJECTION_VERSION,
      notes: 'Native-first default path; adapter refresh is explicit.',
    },
    runtimeStatus: statusFromNative(health.status),
    wsStatus: 'connected',
    runtime: {
      status: 'ready',
      nativeFirst: {
        zavorthControlNativeFirstEnabled: true,
        zavorthControlDefaultAdapterCall: false,
        externalSourceRequiredForZavorthControlRender: false,
        externalSourceRequiredForZavorthControlLookup: false,
      },
    },
    productModeId: 'native-first',
    productModeLabel: 'native-first',
    agentRun: null,
    sessions: sessionsFromNativeRegistry(source.sessionHistoryRegistry),
    messages: messagesFromNativeRegistry(source.sessionHistoryRegistry),
    tasks: [],
    events: eventsFromNativeZavorthControlViews(source.zavorthControlRegistry, source.nativeFirstPolicy),
    approvals: [],
    artifacts: [],
    memorySignals: [],
    capabilities,
    toolExposure: {
      mode: capabilities.some((capability: AnyRecord) => capability.risk === 'danger') ? 'restricted'
        : capabilities.some((capability: AnyRecord) => capability.requiresApproval || capability.risk === 'attention') ? 'confirm'
          : 'safe',
      summary: 'Capabilities loaded from Zavorth-native registries.',
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
        id: 'zavorth-control-native-first',
        label: 'ZavorthControl',
        kind: 'web',
        status: 'available',
        primary: true,
      },
    ],
    modelProfile: {
      providerLabel: 'Zavorth',
      modelLabel: 'Native Registry',
      routingPolicy: 'gateway',
      supportsTools: true,
    },
    health,
    releaseStatus: null,
    integrations: integrationsFromNativeRegistries(source.integrationRegistry, source.configStateRegistry),
    identity: {
      agentName: 'Zavorth',
      userName: 'Operator',
      language: 'en-US',
      tone: 'direct',
      initiative: 'balanced',
      firstRunStatus: 'complete',
    },
    logs: source.nativeFirstPolicy.logs,
    perceptionControl: perceptionControlFromSource(source),
    workflowJobs: [],
    runtimeWarnings: [
      ...array(source.nativeFirstPolicy.runtimeWarnings),
      ...array(source.nativeFirstPolicy.blockedSurfaces).map((surfaceId) => `Blocked surface: ${surfaceId}`),
    ],
  };

  return {
    nativeContract: 'ZavorthControlNativeFirstConsumerIntegration/v1',
    projection,
    adapterInput: buildZavorthControlAdapterInputFromZavorthControlRuntimeProjection(projection),
    policy: {
      zavorthControlNativeFirstEnabled: true,
      zavorthControlDefaultAdapterCall: false,
      externalSourceRequiredForZavorthControlRender: false,
      externalSourceRequiredForZavorthControlLookup: false,
      adapterRefreshAllowed: false,
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
      zavorthControlViewsFromNativeRegistry: true,
      integrationMetadataFromNativeRegistry: true,
      sessionHistoryMetadataFromNativeRegistry: true,
      configStateMetadataFromNativeRegistry: true,
      adapterFallbackExplicitOnly: true,
    },
  };
}
