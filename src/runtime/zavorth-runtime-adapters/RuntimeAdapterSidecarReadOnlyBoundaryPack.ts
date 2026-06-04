import type {
  NormalizedInboundMessage,
  ToolExposurePolicyContractInput,
} from '../agent/contracts/index.js';
import type {
  UniversalAgentChannel,
  UniversalToolRiskLevel,
} from '../agent/UniversalAgentRuntimeTypes.js';
import type {
  ImportedCapabilityTrustState,
} from '../agent/security/index.js';
import type {
  RuntimeAdapterCapabilityKind,
  RuntimeAdapterChannelDescriptor,
  RuntimeAdapterEventEnvelope,
  RuntimeAdapterHealthSnapshot,
} from './contracts.js';

export const RUNTIME_ADAPTER_CANONICAL_SIDECAR_READ_ONLY_FIXTURE_NOW = '2026-04-28T12:00:00.000Z' as const;
export const RUNTIME_ADAPTER_CANONICAL_SIDECAR_READ_ONLY_RUNTIME_ID = 'external-runtime-adapter-v1-sidecar-read-only-runtime' as const;

export type RuntimeAdapterSidecarReadOnlyTransport =
  | 'disabled'
  | 'http'
  | 'stdio'
  | 'websocket'
  | 'wsl-command';

export type RuntimeAdapterSidecarReadOnlyStatus =
  | 'degraded'
  | 'offline'
  | 'ready';

export type RuntimeAdapterSidecarReadOnlySecretPurpose =
  | 'action-dispatch'
  | 'capability-snapshot'
  | 'event-pull'
  | 'health-probe'
  | 'runtime-config';

export type RuntimeAdapterSidecarReadOnlyExecutionGate = {
  sidecarOptional: true;
  zavorthRunsWithoutSidecar: true;
  sidecarProcessStarted: false;
  sourceRuntimeConnected: false;
  externalExecutorLiveCalled: false;
  httpConnectionOpened: false;
  websocketConnectionOpened: false;
  externalCommandExecuted: false;
  externalToolExecuted: false;
  externalProviderExecuted: false;
  sourceHandlerLoaded: false;
  sourceHttpRouteRegistered: false;
  sourceGatewayMethodDispatched: false;
  sourceServiceLaunched: false;
  rawSecretsRead: false;
  configMigrated: false;
  stateMigrated: false;
  sourceModulesCopied: false;
  adapterRemoved: false;
  actionReachedExecutor: false;
};

export type RuntimeAdapterSidecarReadOnlyProcessSource = {
  commandHint?: string;
  endpointHint?: string;
  transportHint: RuntimeAdapterSidecarReadOnlyTransport;
  workingDirectoryHint?: string;
};

export type RuntimeAdapterSidecarReadOnlyCapabilitySource = {
  publicCapabilityIdSeed: string;
  kind: RuntimeAdapterCapabilityKind;
  risk: UniversalToolRiskLevel;
  toolNames: string[];
  trustState: ImportedCapabilityTrustState;
};

export type RuntimeAdapterSidecarReadOnlyEventSource = {
  publicEventIdSeed: string;
  sessionId: string;
  channel: UniversalAgentChannel;
  occurredAt: string;
  text: string;
  requestedTools: string[];
};

export type RuntimeAdapterSidecarReadOnlySecretRefSource = {
  publicSecretRefIdSeed: string;
  purpose: RuntimeAdapterSidecarReadOnlySecretPurpose;
  providerId: string;
};

export type RuntimeAdapterSidecarReadOnlyFailureSource = {
  publicFailureIdSeed: string;
  kind: 'action-rejected' | 'probe-timeout' | 'stale-snapshot' | 'startup-failure' | 'transport-error';
  retryable: boolean;
  rollbackRecommended: boolean;
  status: 'degraded' | 'offline';
};

export type RuntimeAdapterSidecarReadOnlyBlockedActionSource = {
  publicActionIdSeed: string;
  decision: 'approval_required' | 'blocked';
  requestedTools: string[];
  risk: UniversalToolRiskLevel;
};

export type RuntimeAdapterSidecarReadOnlyBoundaryPackSource = {
  sourceRuntimeName: string;
  sourceRuntimeVersion?: string;
  process: RuntimeAdapterSidecarReadOnlyProcessSource;
  healthStatus: RuntimeAdapterSidecarReadOnlyStatus;
  channels: RuntimeAdapterChannelDescriptor[];
  capabilities: RuntimeAdapterSidecarReadOnlyCapabilitySource[];
  events: RuntimeAdapterSidecarReadOnlyEventSource[];
  secretRefs: RuntimeAdapterSidecarReadOnlySecretRefSource[];
  configKeyHints: string[];
  statePathHints: string[];
  failures: RuntimeAdapterSidecarReadOnlyFailureSource[];
  blockedActions: RuntimeAdapterSidecarReadOnlyBlockedActionSource[];
};

export type ZavorthSidecarProcessDescriptor = {
  id: string;
  runtimeId: string;
  label: string;
  transport: RuntimeAdapterSidecarReadOnlyTransport;
  optional: true;
  disabledByDefault: true;
  zavorthRunsWithoutSidecar: true;
  launchPolicy: {
    authority: 'zavorth-sidecar-read-only-boundary-pack';
    processSpawnAllowed: false;
    commandExecutionAllowed: false;
    workingDirectoryMutationAllowed: false;
    liveConnectionAllowed: false;
  };
  sourceHintsStoredAsEvidenceOnly: true;
  sourceCommandHintStoredAsEvidenceOnly: true;
  sourceEndpointHintStoredAsEvidenceOnly: true;
  sourceWorkingDirectoryHintStoredAsEvidenceOnly: true;
  nativeContract: 'ZavorthSidecarProcessDescriptor/v1';
};

export type ZavorthSidecarCapabilitySnapshotRow = {
  id: string;
  label: string;
  kind: RuntimeAdapterCapabilityKind;
  risk: UniversalToolRiskLevel;
  trustState: ImportedCapabilityTrustState;
  toolNames: string[];
  sourceCapabilityStoredAsEvidenceOnly: true;
  sourceModuleLoaded: false;
  providerSdkLoaded: false;
  externalToolExecuted: false;
  nativeContract: 'ZavorthSidecarCapabilitySnapshotRow/v1';
};

export type ZavorthSidecarCapabilitySnapshot = {
  id: string;
  rows: ZavorthSidecarCapabilitySnapshotRow[];
  toolExposurePolicyInput: ToolExposurePolicyContractInput;
  inventoryRows: Array<{
    id: string;
    capabilityId: string;
    policy: 'approval-required' | 'allowed' | 'blocked';
  }>;
  sourceCapabilitiesStoredAsEvidenceOnly: true;
  sourceModulesLoaded: false;
  externalToolsExecuted: false;
  nativeContract: 'ZavorthSidecarCapabilitySnapshot/v1';
};

export type ZavorthSidecarEventPullEnvelope = {
  id: string;
  eventEnvelope: RuntimeAdapterEventEnvelope;
  normalizedInboundMessage: NormalizedInboundMessage;
  sourceCursorStoredAsEvidenceOnly: true;
  sourceEventIdStoredAsEvidenceOnly: true;
  noSecondEventBus: true;
  livePollPerformed: false;
  httpRequestOpened: false;
  websocketReadOpened: false;
  sourceEventBusSubscribed: false;
  nativeContract: 'ZavorthSidecarEventPullEnvelope/v1';
};

export type ZavorthSidecarSecretRef = {
  id: string;
  purpose: RuntimeAdapterSidecarReadOnlySecretPurpose;
  providerId: string;
  rawSecretValueLoaded: false;
  sourceSecretNameStoredAsEvidenceOnly: true;
  nativeContract: 'SecretRef';
};

export type ZavorthSidecarRuntimeConfigBoundary = {
  id: string;
  secretRefs: ZavorthSidecarSecretRef[];
  configKeys: Array<{
    id: string;
    sourceConfigKeyStoredAsEvidenceOnly: true;
  }>;
  statePaths: Array<{
    id: string;
    sourceStatePathStoredAsEvidenceOnly: true;
  }>;
  rawSecretsRead: false;
  envValuesRead: false;
  configMigrated: false;
  stateMigrated: false;
  nativeContract: 'ZavorthSidecarRuntimeConfigBoundary/v1';
};

export type ZavorthSidecarFailureRecord = {
  id: string;
  kind: RuntimeAdapterSidecarReadOnlyFailureSource['kind'];
  status: RuntimeAdapterSidecarReadOnlyFailureSource['status'];
  retryable: boolean;
  rollbackRecommended: boolean;
  sourceFailureStoredAsEvidenceOnly: true;
  sourceStateMutated: false;
  adapterRemoved: false;
  nativeContract: 'ZavorthSidecarFailureRecord/v1';
};

export type ZavorthSidecarRollbackModel = {
  id: string;
  degradedState: 'degraded' | 'offline';
  rollbackAvailable: true;
  disableSidecarRecommended: boolean;
  zavorthFallbackAvailable: true;
  sourceRuntimeRequired: false;
  adapterRemovalAllowed: false;
  sourceStateMutationAllowed: false;
  failures: ZavorthSidecarFailureRecord[];
  nativeContract: 'ZavorthSidecarRollbackModel/v1';
};

export type ZavorthSidecarBlockedDispatchCandidate = {
  id: string;
  decision: 'approval_required' | 'blocked';
  requestedTools: string[];
  risk: UniversalToolRiskLevel;
  requiresInvocationEnvelope: true;
  requiresPolicyPreflight: true;
  requiresApproval: boolean;
  executionAuthority: false;
  actionReachedExecutor: false;
  externalToolExecuted: false;
  nativeContract: 'ZavorthSidecarBlockedDispatchCandidate/v1';
};

export type ZavorthSidecarObservabilityRow = {
  id: string;
  kind:
    | 'blocked-dispatch'
    | 'capability-snapshot'
    | 'event-pull'
    | 'failure-rollback'
    | 'health'
    | 'process-descriptor'
    | 'runtime-config';
  label: string;
  status: 'blocked' | 'degraded' | 'offline' | 'ready';
  readOnly: true;
  dashboardVisible: true;
  executableControlExposed: false;
  routeRegistrationControlExposed: false;
  gatewayDispatchControlExposed: false;
  serviceLaunchControlExposed: false;
  cliSpawnControlExposed: false;
  providerExecutionControlExposed: false;
  sourceToolExecutionControlExposed: false;
  nativeContract: 'ZavorthSidecarObservabilityRow/v1';
};

export type ZavorthSidecarObservabilityProjection = {
  id: string;
  rows: ZavorthSidecarObservabilityRow[];
  logs: Array<{
    id: string;
    rowId: string;
    source: 'zavorth';
    readOnly: true;
  }>;
  dashboard: {
    readOnly: true;
    rows: ZavorthSidecarObservabilityRow[];
    executableControlsExposed: false;
  };
  nativeContract: 'ZavorthSidecarObservabilityProjection/v1';
};

export type RuntimeAdapterSidecarReadOnlyBoundaryPackOptions<TRuntimeId extends string = string> = {
  source: RuntimeAdapterSidecarReadOnlyBoundaryPackSource;
  generatedAt: string;
  runtimeId: TRuntimeId;
  idPrefix: string;
  executionGate: RuntimeAdapterSidecarReadOnlyExecutionGate;
};

export type RuntimeAdapterSidecarReadOnlyBoundaryPackNormalization<TRuntimeId extends string = string> = {
  nativeContract: 'ZavorthSidecarReadOnlyBoundaryPack/v1';
  generatedAt: string;
  runtimeId: TRuntimeId;
  descriptor: ZavorthSidecarProcessDescriptor;
  health: RuntimeAdapterHealthSnapshot;
  capabilitySnapshot: ZavorthSidecarCapabilitySnapshot;
  eventPull: {
    envelopes: ZavorthSidecarEventPullEnvelope[];
    noSecondEventBus: true;
    livePollPerformed: false;
  };
  runtimeConfig: ZavorthSidecarRuntimeConfigBoundary;
  rollback: ZavorthSidecarRollbackModel;
  blockedDispatch: {
    candidates: ZavorthSidecarBlockedDispatchCandidate[];
    actionsReachedExecutor: false;
    executionAuthority: false;
  };
  observability: ZavorthSidecarObservabilityProjection;
  sidecarOptional: true;
  zavorthRunsWithoutSidecar: true;
  metadataOnly: true;
  liveConnectionBlocked: true;
  sourceModulesCopied: false;
  executionGate: RuntimeAdapterSidecarReadOnlyExecutionGate;
};

function normalizeId(value: string, fallback: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function publicId(idPrefix: string, kind: string, seed: string, index: number): string {
  return `${idPrefix}:${kind}-${index + 1}-${normalizeId(seed, kind)}`;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function capabilityPolicy(capability: Pick<RuntimeAdapterSidecarReadOnlyCapabilitySource, 'risk' | 'trustState'>): 'approval-required' | 'allowed' | 'blocked' {
  if (capability.trustState === 'quarantined' || capability.risk === 'danger') {
    return 'blocked';
  }
  if (capability.risk === 'attention' || capability.risk === 'unknown') {
    return 'approval-required';
  }
  return 'allowed';
}

function buildToolExposurePolicyInput(
  capabilities: RuntimeAdapterSidecarReadOnlyCapabilitySource[],
): ToolExposurePolicyContractInput {
  const allowedTools = capabilities
    .filter((capability) => capabilityPolicy(capability) === 'allowed')
    .flatMap((capability) => capability.toolNames);
  const approvalTools = capabilities
    .filter((capability) => capabilityPolicy(capability) === 'approval-required')
    .flatMap((capability) => capability.toolNames);
  const blockedTools = capabilities
    .filter((capability) => capabilityPolicy(capability) === 'blocked')
    .flatMap((capability) => capability.toolNames);

  return {
    requestedTools: uniqueStrings(capabilities.flatMap((capability) => capability.toolNames)),
    allowedTools: uniqueStrings(allowedTools),
    requireApprovalFor: uniqueStrings(approvalTools),
    blockedTools: uniqueStrings(blockedTools),
    blockedToolReason: 'blocked-by-sidecar-read-only-boundary-pack',
  };
}

function summarizeCapabilities(
  capabilities: RuntimeAdapterSidecarReadOnlyCapabilitySource[],
): RuntimeAdapterHealthSnapshot['capabilities'] {
  return capabilities.reduce<RuntimeAdapterHealthSnapshot['capabilities']>((summary, capability) => {
    summary.total += 1;
    summary[capability.trustState] += 1;
    return summary;
  }, {
    total: 0,
    trusted: 0,
    safe: 0,
    quarantined: 0,
  });
}

function buildDescriptor<TRuntimeId extends string>(
  options: RuntimeAdapterSidecarReadOnlyBoundaryPackOptions<TRuntimeId>,
): ZavorthSidecarProcessDescriptor {
  return {
    id: `${options.idPrefix}:process-descriptor`,
    runtimeId: options.runtimeId,
    label: 'Sidecar read-only process descriptor',
    transport: options.source.process.transportHint,
    optional: true,
    disabledByDefault: true,
    zavorthRunsWithoutSidecar: true,
    launchPolicy: {
      authority: 'zavorth-sidecar-read-only-boundary-pack',
      processSpawnAllowed: false,
      commandExecutionAllowed: false,
      workingDirectoryMutationAllowed: false,
      liveConnectionAllowed: false,
    },
    sourceHintsStoredAsEvidenceOnly: true,
    sourceCommandHintStoredAsEvidenceOnly: true,
    sourceEndpointHintStoredAsEvidenceOnly: true,
    sourceWorkingDirectoryHintStoredAsEvidenceOnly: true,
    nativeContract: 'ZavorthSidecarProcessDescriptor/v1',
  };
}

function buildHealth<TRuntimeId extends string>(
  options: RuntimeAdapterSidecarReadOnlyBoundaryPackOptions<TRuntimeId>,
): RuntimeAdapterHealthSnapshot {
  return {
    runtimeId: options.runtimeId,
    status: options.source.healthStatus,
    generatedAt: options.generatedAt,
    capabilities: summarizeCapabilities(options.source.capabilities),
    channels: options.source.channels.map((channel, index) => ({
      ...channel,
      id: `sidecar-read-only-channel-${index + 1}`,
      label: `Sidecar read-only channel ${index + 1}`,
    })),
    diagnostics: {
      notes: ['sidecar-read-only-boundary-pack', 'health-probe-no-authority'],
    },
  };
}

function buildCapabilitySnapshot<TRuntimeId extends string>(
  options: RuntimeAdapterSidecarReadOnlyBoundaryPackOptions<TRuntimeId>,
): ZavorthSidecarCapabilitySnapshot {
  const rows = options.source.capabilities.map((capability, index): ZavorthSidecarCapabilitySnapshotRow => ({
    id: publicId(options.idPrefix, 'capability', capability.publicCapabilityIdSeed, index),
    label: `Sidecar capability ${index + 1}`,
    kind: capability.kind,
    risk: capability.risk,
    trustState: capability.trustState,
    toolNames: uniqueStrings(capability.toolNames),
    sourceCapabilityStoredAsEvidenceOnly: true,
    sourceModuleLoaded: false,
    providerSdkLoaded: false,
    externalToolExecuted: false,
    nativeContract: 'ZavorthSidecarCapabilitySnapshotRow/v1',
  }));

  return {
    id: `${options.idPrefix}:capability-snapshot`,
    rows,
    toolExposurePolicyInput: buildToolExposurePolicyInput(options.source.capabilities),
    inventoryRows: rows.map((row) => ({
      id: `${row.id}:inventory`,
      capabilityId: row.id,
      policy: capabilityPolicy(row),
    })),
    sourceCapabilitiesStoredAsEvidenceOnly: true,
    sourceModulesLoaded: false,
    externalToolsExecuted: false,
    nativeContract: 'ZavorthSidecarCapabilitySnapshot/v1',
  };
}

function buildEventPull<TRuntimeId extends string>(
  options: RuntimeAdapterSidecarReadOnlyBoundaryPackOptions<TRuntimeId>,
): RuntimeAdapterSidecarReadOnlyBoundaryPackNormalization<TRuntimeId>['eventPull'] {
  const envelopes = options.source.events.map((event, index): ZavorthSidecarEventPullEnvelope => {
    const eventId = publicId(options.idPrefix, 'event', event.publicEventIdSeed, index);
    const sessionId = `sidecar-read-only-session-${normalizeId(event.sessionId, 'session')}`;
    const eventEnvelope: RuntimeAdapterEventEnvelope = {
      id: eventId,
      runtimeId: options.runtimeId,
      sessionId,
      kind: 'message',
      occurredAt: event.occurredAt,
      actor: {
        id: 'sidecar-read-only-user',
        role: 'user',
      },
      payload: {
        text: event.text,
        channel: event.channel,
        requestedTools: uniqueStrings(event.requestedTools),
      },
    };
    const normalizedInboundMessage: NormalizedInboundMessage = {
      requestId: `${eventId}:request`,
      traceId: `${options.runtimeId}:${eventId}`,
      userId: 'sidecar-read-only-user',
      sessionId,
      channel: event.channel,
      text: event.text,
      requestedTools: uniqueStrings(event.requestedTools),
      metadata: {
        source: 'sidecar-read-only-boundary-pack',
        noSecondEventBus: true,
        boundary: 'ZavorthSidecarEventPullEnvelope/v1',
      },
    };

    return {
      id: eventId,
      eventEnvelope,
      normalizedInboundMessage,
      sourceCursorStoredAsEvidenceOnly: true,
      sourceEventIdStoredAsEvidenceOnly: true,
      noSecondEventBus: true,
      livePollPerformed: false,
      httpRequestOpened: false,
      websocketReadOpened: false,
      sourceEventBusSubscribed: false,
      nativeContract: 'ZavorthSidecarEventPullEnvelope/v1',
    };
  });

  return {
    envelopes,
    noSecondEventBus: true,
    livePollPerformed: false,
  };
}

function buildRuntimeConfig<TRuntimeId extends string>(
  options: RuntimeAdapterSidecarReadOnlyBoundaryPackOptions<TRuntimeId>,
): ZavorthSidecarRuntimeConfigBoundary {
  return {
    id: `${options.idPrefix}:runtime-config`,
    secretRefs: options.source.secretRefs.map((secretRef, index) => ({
      id: publicId(options.idPrefix, 'secret-ref', secretRef.publicSecretRefIdSeed, index),
      purpose: secretRef.purpose,
      providerId: secretRef.providerId,
      rawSecretValueLoaded: false,
      sourceSecretNameStoredAsEvidenceOnly: true,
      nativeContract: 'SecretRef',
    })),
    configKeys: options.source.configKeyHints.map((_, index) => ({
      id: `${options.idPrefix}:config-key-${index + 1}`,
      sourceConfigKeyStoredAsEvidenceOnly: true,
    })),
    statePaths: options.source.statePathHints.map((_, index) => ({
      id: `${options.idPrefix}:state-path-${index + 1}`,
      sourceStatePathStoredAsEvidenceOnly: true,
    })),
    rawSecretsRead: false,
    envValuesRead: false,
    configMigrated: false,
    stateMigrated: false,
    nativeContract: 'ZavorthSidecarRuntimeConfigBoundary/v1',
  };
}

function buildRollback<TRuntimeId extends string>(
  options: RuntimeAdapterSidecarReadOnlyBoundaryPackOptions<TRuntimeId>,
): ZavorthSidecarRollbackModel {
  const failures = options.source.failures.map((failure, index): ZavorthSidecarFailureRecord => ({
    id: publicId(options.idPrefix, 'failure', failure.publicFailureIdSeed, index),
    kind: failure.kind,
    status: failure.status,
    retryable: failure.retryable,
    rollbackRecommended: failure.rollbackRecommended,
    sourceFailureStoredAsEvidenceOnly: true,
    sourceStateMutated: false,
    adapterRemoved: false,
    nativeContract: 'ZavorthSidecarFailureRecord/v1',
  }));
  const degradedState = failures.some((failure) => failure.status === 'offline') ? 'offline' : 'degraded';

  return {
    id: `${options.idPrefix}:rollback`,
    degradedState,
    rollbackAvailable: true,
    disableSidecarRecommended: failures.some((failure) => failure.rollbackRecommended),
    zavorthFallbackAvailable: true,
    sourceRuntimeRequired: false,
    adapterRemovalAllowed: false,
    sourceStateMutationAllowed: false,
    failures,
    nativeContract: 'ZavorthSidecarRollbackModel/v1',
  };
}

function buildBlockedDispatch<TRuntimeId extends string>(
  options: RuntimeAdapterSidecarReadOnlyBoundaryPackOptions<TRuntimeId>,
): RuntimeAdapterSidecarReadOnlyBoundaryPackNormalization<TRuntimeId>['blockedDispatch'] {
  return {
    candidates: options.source.blockedActions.map((action, index): ZavorthSidecarBlockedDispatchCandidate => ({
      id: publicId(options.idPrefix, 'blocked-action', action.publicActionIdSeed, index),
      decision: action.decision,
      requestedTools: uniqueStrings(action.requestedTools),
      risk: action.risk,
      requiresInvocationEnvelope: true,
      requiresPolicyPreflight: true,
      requiresApproval: action.decision === 'approval_required',
      executionAuthority: false,
      actionReachedExecutor: false,
      externalToolExecuted: false,
      nativeContract: 'ZavorthSidecarBlockedDispatchCandidate/v1',
    })),
    actionsReachedExecutor: false,
    executionAuthority: false,
  };
}

function buildObservability(
  idPrefix: string,
  health: RuntimeAdapterHealthSnapshot,
): ZavorthSidecarObservabilityProjection {
  const rows: ZavorthSidecarObservabilityRow[] = [
    ['process-descriptor', 'Process descriptor', 'ready'],
    ['health', 'Health snapshot', health.status === 'ready' ? 'ready' : health.status === 'offline' ? 'offline' : 'degraded'],
    ['capability-snapshot', 'Capability snapshot', 'ready'],
    ['event-pull', 'Event pull envelopes', 'ready'],
    ['runtime-config', 'SecretRef runtime config', 'blocked'],
    ['failure-rollback', 'Failure rollback model', health.status === 'offline' ? 'offline' : 'degraded'],
    ['blocked-dispatch', 'Blocked dispatch candidates', 'blocked'],
  ].map(([kind, label, status], index) => ({
    id: `${idPrefix}:observability-${index + 1}-${kind}`,
    kind: kind as ZavorthSidecarObservabilityRow['kind'],
    label,
    status: status as ZavorthSidecarObservabilityRow['status'],
    readOnly: true,
    dashboardVisible: true,
    executableControlExposed: false,
    routeRegistrationControlExposed: false,
    gatewayDispatchControlExposed: false,
    serviceLaunchControlExposed: false,
    cliSpawnControlExposed: false,
    providerExecutionControlExposed: false,
    sourceToolExecutionControlExposed: false,
    nativeContract: 'ZavorthSidecarObservabilityRow/v1',
  }));

  return {
    id: `${idPrefix}:observability`,
    rows,
    logs: rows.map((row) => ({
      id: `${row.id}:log`,
      rowId: row.id,
      source: 'zavorth',
      readOnly: true,
    })),
    dashboard: {
      readOnly: true,
      rows,
      executableControlsExposed: false,
    },
    nativeContract: 'ZavorthSidecarObservabilityProjection/v1',
  };
}

export function createCanonicalSidecarReadOnlyExecutionGate(): RuntimeAdapterSidecarReadOnlyExecutionGate {
  return {
    sidecarOptional: true,
    zavorthRunsWithoutSidecar: true,
    sidecarProcessStarted: false,
    sourceRuntimeConnected: false,
    externalExecutorLiveCalled: false,
    httpConnectionOpened: false,
    websocketConnectionOpened: false,
    externalCommandExecuted: false,
    externalToolExecuted: false,
    externalProviderExecuted: false,
    sourceHandlerLoaded: false,
    sourceHttpRouteRegistered: false,
    sourceGatewayMethodDispatched: false,
    sourceServiceLaunched: false,
    rawSecretsRead: false,
    configMigrated: false,
    stateMigrated: false,
    sourceModulesCopied: false,
    adapterRemoved: false,
    actionReachedExecutor: false,
  };
}

export function createCanonicalSidecarReadOnlyBoundaryPackFixtureSource(): RuntimeAdapterSidecarReadOnlyBoundaryPackSource {
  return {
    sourceRuntimeName: 'ExternalExecutor',
    sourceRuntimeVersion: 'fixture-only',
    process: {
      commandHint: 'external-executor --status',
      endpointHint: 'http://127.0.0.1:17771',
      transportHint: 'wsl-command',
      workingDirectoryHint: '/opt/external-executor',
    },
    healthStatus: 'degraded',
    channels: [
      {
        id: 'source-channel-web',
        label: 'Source web channel',
        channel: 'web',
        status: 'degraded',
        inbound: true,
        outbound: false,
        replyBoundary: 'zavorth-reply-port-only',
      },
    ],
    capabilities: [
      {
        publicCapabilityIdSeed: 'safe-status-read',
        kind: 'tool',
        risk: 'safe',
        trustState: 'safe',
        toolNames: ['sidecar.status.read'],
      },
      {
        publicCapabilityIdSeed: 'network-fetch',
        kind: 'tool',
        risk: 'attention',
        trustState: 'safe',
        toolNames: ['network_fetch'],
      },
      {
        publicCapabilityIdSeed: 'workspace-delete',
        kind: 'tool',
        risk: 'danger',
        trustState: 'quarantined',
        toolNames: ['workspace.delete'],
      },
    ],
    events: [
      {
        publicEventIdSeed: 'inbound-status-event',
        sessionId: 'source-session-1',
        channel: 'api',
        occurredAt: RUNTIME_ADAPTER_CANONICAL_SIDECAR_READ_ONLY_FIXTURE_NOW,
        text: 'Status event observed through read-only fixture boundary.',
        requestedTools: ['sidecar.status.read'],
      },
    ],
    secretRefs: [
      {
        publicSecretRefIdSeed: 'health-token',
        purpose: 'health-probe',
        providerId: 'sidecar-read-only-provider',
      },
      {
        publicSecretRefIdSeed: 'capability-token',
        purpose: 'capability-snapshot',
        providerId: 'sidecar-read-only-provider',
      },
    ],
    configKeyHints: ['EXTERNAL_EXECUTOR_HOME', 'EXTERNAL_EXECUTOR_PROFILE'],
    statePathHints: ['/home/source/.external-executor/state.json'],
    failures: [
      {
        publicFailureIdSeed: 'probe-timeout',
        kind: 'probe-timeout',
        retryable: true,
        rollbackRecommended: true,
        status: 'degraded',
      },
      {
        publicFailureIdSeed: 'stale-snapshot',
        kind: 'stale-snapshot',
        retryable: false,
        rollbackRecommended: false,
        status: 'offline',
      },
    ],
    blockedActions: [
      {
        publicActionIdSeed: 'approval-network-fetch',
        decision: 'approval_required',
        requestedTools: ['network_fetch'],
        risk: 'attention',
      },
      {
        publicActionIdSeed: 'blocked-workspace-delete',
        decision: 'blocked',
        requestedTools: ['workspace.delete'],
        risk: 'danger',
      },
    ],
  };
}

export function normalizeRuntimeAdapterSidecarReadOnlyBoundaryPack<TRuntimeId extends string>(
  options: RuntimeAdapterSidecarReadOnlyBoundaryPackOptions<TRuntimeId>,
): RuntimeAdapterSidecarReadOnlyBoundaryPackNormalization<TRuntimeId> {
  const descriptor = buildDescriptor(options);
  const health = buildHealth(options);
  const capabilitySnapshot = buildCapabilitySnapshot(options);
  const eventPull = buildEventPull(options);
  const runtimeConfig = buildRuntimeConfig(options);
  const rollback = buildRollback(options);
  const blockedDispatch = buildBlockedDispatch(options);
  const observability = buildObservability(options.idPrefix, health);

  return {
    nativeContract: 'ZavorthSidecarReadOnlyBoundaryPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    descriptor,
    health,
    capabilitySnapshot,
    eventPull,
    runtimeConfig,
    rollback,
    blockedDispatch,
    observability,
    sidecarOptional: true,
    zavorthRunsWithoutSidecar: true,
    metadataOnly: true,
    liveConnectionBlocked: true,
    sourceModulesCopied: false,
    executionGate: options.executionGate,
  };
}

export function normalizeCanonicalSidecarReadOnlyBoundaryPackFixture(): RuntimeAdapterSidecarReadOnlyBoundaryPackNormalization<typeof RUNTIME_ADAPTER_CANONICAL_SIDECAR_READ_ONLY_RUNTIME_ID> {
  return normalizeRuntimeAdapterSidecarReadOnlyBoundaryPack({
    source: createCanonicalSidecarReadOnlyBoundaryPackFixtureSource(),
    generatedAt: RUNTIME_ADAPTER_CANONICAL_SIDECAR_READ_ONLY_FIXTURE_NOW,
    runtimeId: RUNTIME_ADAPTER_CANONICAL_SIDECAR_READ_ONLY_RUNTIME_ID,
    idPrefix: 'zavorth-sidecar-read-only',
    executionGate: createCanonicalSidecarReadOnlyExecutionGate(),
  });
}
