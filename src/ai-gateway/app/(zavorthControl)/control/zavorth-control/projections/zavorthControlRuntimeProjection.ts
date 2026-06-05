import {
  createZavorthNativeCapabilityRegistryFixture,
  createZavorthNativeConfigStateRegistryFixture,
  createZavorthNativeDashboardViewModelRegistryFixture,
  createZavorthNativeIntegrationRegistryFixture,
  createZavorthNativeSessionHistoryRegistryFixture,
} from '../../../../../../contracts/CommandCenterRuntimeBoundaryContract.js';

export const ZAVORTH_CONTROL_NATIVE_FIRST_RUNTIME_PROJECTION_VERSION = 'zavorth-control-native-first-runtime-projection/v1' as const;
export const ZAVORTH_CONTROL_NATIVE_FIRST_RUNTIME_NOW = '2026-05-19T00:00:00.000Z' as const;

type AnyRecord = Record<string, any>;

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

function healthFromNative(policy: AnyRecord, dashboardRegistry: AnyRecord): AnyRecord {
  return {
    status: array(policy.blockedSurfaces).length > 0 ? 'degraded' : 'ready',
    summary: 'ZavorthControl usando registries Zavorth-native no caminho padrao.',
    checks: [
      {
        id: 'native-first-zavorthControl',
        label: 'Native-first ZavorthControl',
        status: 'ready',
        detail: 'Lookup e render usam registries Zavorth-native.',
      },
      {
        id: 'native-registry-only',
        label: 'Superficie nativa',
        status: 'ready',
        detail: 'Renderizacao nao depende de adapter legado.',
      },
      {
        id: 'zavorthControl-registry-degraded-rows',
        label: 'Estados degradados preservados',
        status: dashboardRegistry.list({ degradedOrUnavailable: true }).length > 0 ? 'degraded' : 'ready',
        detail: 'Linhas degraded/unavailable continuam renderizaveis.',
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

function eventsFromNativeDashboardViews(dashboardRegistry: AnyRecord, policy: AnyRecord): AnyRecord[] {
  const viewEvents = dashboardRegistry.list({ degradedOrUnavailable: true }).slice(0, 12).map((view: AnyRecord) => ({
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
      detail: policy.adapterRefreshAllowed ? 'Refresh explicito habilitado por policy.' : 'Refresh por adapter legado desativado no caminho padrao.',
      status: 'done',
    },
  ];
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
        message: 'ZavorthControl renderiza direto dos registries Zavorth-native.',
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
    selfingDashboard: projection.selfingDashboard,
    artifactMemory: projection.artifactMemory,
    personalOpsAutopilot: projection.personalOpsAutopilot,
    agentTeamCompiler: projection.agentTeamCompiler,
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
  };
}

export function createZavorthControlNativeFirstConsumerIntegrationFixtureSource(): AnyRecord {
  return {
    nativeFirstPolicy: createPolicy(),
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

export function buildZavorthControlNativeFirstRuntimeProjection(
  source: AnyRecord = createZavorthControlNativeFirstConsumerIntegrationFixtureSource(),
): AnyRecord {
  const generatedAt = source.nativeFirstPolicy.generatedAt;
  const capabilities = source.capabilityRegistry.list().map(toolExposureFromCapability);
  const health = healthFromNative(source.nativeFirstPolicy, source.dashboardRegistry);
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
    events: eventsFromNativeDashboardViews(source.dashboardRegistry, source.nativeFirstPolicy),
    approvals: [],
    artifacts: [],
    memorySignals: [],
    capabilities,
    toolExposure: {
      mode: capabilities.some((capability: AnyRecord) => capability.risk === 'danger')
        ? 'restricted'
        : capabilities.some((capability: AnyRecord) => capability.requiresApproval || capability.risk === 'attention')
          ? 'confirm'
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
