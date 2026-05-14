import {
  normalizeExternalExecutorLiveObservabilityProjectionFixture,
} from './ExternalAgentExternalExecutorLiveObservabilityProjection.js';
import {
  normalizeExternalExecutorLiveReadOnlyBridgeBoundaryFixture,
} from './ExternalAgentExternalExecutorLiveReadOnlyBridgeBoundary.js';
import {
  normalizeExternalExecutorReadOnlyEventStreamAdapterFixture,
} from './ExternalAgentExternalExecutorReadOnlyEventStreamAdapter.js';
import {
  normalizeExternalExecutorRealCapabilitySnapshotReadOnlyFixture,
} from './ExternalAgentExternalExecutorRealCapabilitySnapshotReadOnly.js';
import {
  normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture,
} from './ExternalAgentExternalExecutorSessionHistoryReadOnlyBridge.js';
import type {
  ExternalAgentLiveReadinessCapabilityInventoryRow,
  ExternalAgentLiveReadinessCapabilityRowKind,
  ExternalAgentLiveReadinessImportClassification,
} from './ExternalAgentLiveReadinessAssimilationPack.js';
import type {
  ExternalExecutorLiveObservabilityProjectionNormalization,
  ExternalExecutorLiveObservabilityProjectionStatus,
} from './ExternalAgentExternalExecutorLiveObservabilityProjection.js';
import type {
  ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization,
  ExternalExecutorLiveReadOnlyBridgeSurface,
  ExternalExecutorLiveReadOnlyBridgeSurfaceKind,
} from './ExternalAgentExternalExecutorLiveReadOnlyBridgeBoundary.js';
import type {
  ExternalExecutorReadOnlyEventStreamAdapterNormalization,
  ExternalExecutorReadOnlySourceEventKind,
} from './ExternalAgentExternalExecutorReadOnlyEventStreamAdapter.js';
import type {
  ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization,
} from './ExternalAgentExternalExecutorRealCapabilitySnapshotReadOnly.js';
import type {
  ZavorthExternalSessionViewStatus,
  ExternalExecutorSessionHistoryReadOnlyBridgeNormalization,
} from './ExternalAgentExternalExecutorSessionHistoryReadOnlyBridge.js';

export const EXTERNAL_AGENT_COMMAND_CENTER_LIVE_ASSIMILATION_NOW = '2026-04-28T21:30:00.000Z' as const;
export const EXTERNAL_AGENT_COMMAND_CENTER_LIVE_ASSIMILATION_RUNTIME_ID = 'external-agent-command-center-live-assimilation' as const;

export type ExternalAgentCommandCenterLiveAssimilationDecision =
  | 'blocked'
  | 'command-center-live-assimilation-ready';

export type ExternalAgentCommandCenterOperationalStatus =
  | 'blocked'
  | 'degraded'
  | 'ready'
  | 'unavailable'
  | 'unknown';

export type ExternalAgentCommandCenterAuthorityDisposition =
  | 'approval-required'
  | 'blocked'
  | 'read-only';

export type ExternalAgentCommandCenterLiveAssimilationSource = {
  snapshot: ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization;
  bridge: ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization;
  observability: ExternalExecutorLiveObservabilityProjectionNormalization;
  eventStream: ExternalExecutorReadOnlyEventStreamAdapterNormalization;
  sessionHistory: ExternalExecutorSessionHistoryReadOnlyBridgeNormalization;
  sourceIdentityQuarantined: true;
  sourceRuntimeNamePublic: false;
  sourceVisualIdentityPublic: false;
  mutableStreamOpened: false;
  actionDispatched: false;
  messageSent: false;
  providerExecuted: false;
  commandExecuted: false;
  sessionImported: false;
  migrationPerformed: false;
  writeBackPerformed: false;
  stateMigrated: false;
  sourceModulesCopied: false;
  nativeReplacementAuthorized: false;
};

export type ZavorthCommandCenterRuntimeView = {
  nativeContract: 'ZavorthCommandCenterRuntimeView/v1';
  id: string;
  label: 'External live runtime';
  status: ExternalAgentCommandCenterOperationalStatus;
  healthProbeAuthenticated: true;
  statusProbeAvailable: true;
  capabilityProbeAvailable: true;
  cleanupConfirmed: true;
  postListenerCount: 0;
  postProcessCount: 0;
  sourceIdentityPublic: false;
  sourceIdentityQuarantined: true;
  readOnly: true;
};

export type ZavorthCommandCenterHealthStatusView = {
  nativeContract: 'ZavorthCommandCenterHealthStatusView/v1';
  id: string;
  status: ExternalAgentCommandCenterOperationalStatus;
  label: 'Read-only runtime health';
  summary: string;
  degradedCount: number;
  unavailableCount: number;
  rawExceptionSerialized: false;
  zavorthRuntimeFailed: false;
  readOnly: true;
};

export type ZavorthCommandCenterCapabilityView = {
  nativeContract: 'ZavorthCommandCenterCapabilityView/v1';
  id: string;
  label: string;
  category: ExternalAgentLiveReadinessCapabilityRowKind;
  kind: ExternalAgentLiveReadinessCapabilityInventoryRow['kind'];
  status: ExternalAgentCommandCenterOperationalStatus;
  importClassification: ExternalAgentLiveReadinessImportClassification;
  authorityDisposition: ExternalAgentCommandCenterAuthorityDisposition;
  risk: ExternalAgentLiveReadinessCapabilityInventoryRow['risk'];
  trustState: ExternalAgentLiveReadinessCapabilityInventoryRow['trustState'];
  sourceIdsEvidenceOnly: true;
  executionAuthority: false;
  readOnly: true;
};

export type ZavorthCommandCenterEventView = {
  nativeContract: 'ZavorthCommandCenterEventView/v1';
  id: string;
  kind: ExternalExecutorReadOnlySourceEventKind;
  status: ExternalAgentCommandCenterOperationalStatus;
  severity: 'danger' | 'info' | 'warning';
  title: string;
  payloadRedacted: true;
  sourceIdsEvidenceOnly: true;
  dispatchPerformed: false;
  commandCenterConsumable: true;
  readOnly: true;
};

export type ZavorthCommandCenterSessionView = {
  nativeContract: 'ZavorthCommandCenterSessionView/v1';
  id: string;
  label: string;
  status: ExternalAgentCommandCenterOperationalStatus;
  channel: string;
  messageCount: number;
  importAuthority: false;
  migrationAllowed: false;
  writeBackAllowed: false;
  sourceIdsEvidenceOnly: true;
  commandCenterConsumable: true;
  readOnly: true;
};

export type ZavorthCommandCenterMessageMetadataView = {
  nativeContract: 'ZavorthCommandCenterMessageMetadataView/v1';
  id: string;
  sessionViewId: string;
  roleFamily: string;
  contentState: 'redacted' | 'unavailable';
  contentPreview: '[redacted-content]' | '[unavailable]';
  sensitiveContentRedacted: true;
  rawContentSerialized: false;
  sourceIdsEvidenceOnly: true;
  readOnly: true;
};

export type ZavorthCommandCenterSurfaceView = {
  nativeContract: 'ZavorthCommandCenterSurfaceView/v1';
  id: string;
  surfaceKind: ExternalExecutorLiveReadOnlyBridgeSurfaceKind | 'gateway-lifecycle';
  label: string;
  status: ExternalAgentCommandCenterOperationalStatus;
  authorityDisposition: ExternalAgentCommandCenterAuthorityDisposition;
  sourceIdsEvidenceOnly: true;
  readOnly: true;
  executionAuthority: false;
};

export type ZavorthCommandCenterOperationalStates = {
  nativeContract: 'ZavorthCommandCenterOperationalStates/v1';
  degraded: string[];
  unavailable: string[];
  unknown: string[];
  blocked: string[];
  representedAsOperationalState: true;
  rawExceptionSerialized: false;
  zavorthRuntimeFailed: false;
};

export type ZavorthCommandCenterLiveAssimilationViewModel = {
  nativeContract: 'ZavorthCommandCenterLiveAssimilationViewModel/v1';
  id: string;
  generatedAt: string;
  runtime: ZavorthCommandCenterRuntimeView;
  health: ZavorthCommandCenterHealthStatusView;
  capabilities: ZavorthCommandCenterCapabilityView[];
  events: ZavorthCommandCenterEventView[];
  sessions: ZavorthCommandCenterSessionView[];
  messages: ZavorthCommandCenterMessageMetadataView[];
  channels: ZavorthCommandCenterSurfaceView[];
  plugins: ZavorthCommandCenterSurfaceView[];
  providers: ZavorthCommandCenterSurfaceView[];
  gatewayLifecycle: ZavorthCommandCenterSurfaceView[];
  operationalStates: ZavorthCommandCenterOperationalStates;
  dashboardUsesSourceVisualIdentity: false;
  sourceRuntimeNamePublic: false;
  sourceStructuresPublic: false;
  readOnly: true;
};

export type ExternalAgentCommandCenterLiveAssimilationExecutionGate = {
  executionAuthority: false;
  actionDispatchAllowed: false;
  messageSendAllowed: false;
  providerExecutionAllowed: false;
  commandExecutionAllowed: false;
  sessionImportAllowed: false;
  migrationAllowed: false;
  writeBackAllowed: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  mutableStreamOpened: false;
  rawSecretSerialized: false;
};

export type ExternalAgentCommandCenterLiveAssimilationRedaction = {
  rawSecretSerialized: false;
  rawMessageContentSerialized: false;
  sensitiveMetadataRedacted: true;
  sourceIdentityPublic: false;
  sourceIdsEvidenceOnly: true;
  serializedPublicViewContainsSensitiveFixture: false;
};

export type ExternalAgentCommandCenterLiveAssimilationNormalization = {
  nativeContract: 'ZavorthCommandCenterLiveAssimilationBoundary/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ExternalAgentCommandCenterLiveAssimilationDecision;
  readOnly: true;
  sourceGateReadiness: {
    capabilitySnapshotReady: boolean;
    bridgeReady: boolean;
    observabilityProjectionReady: boolean;
    eventStreamAdapterReady: boolean;
    sessionHistoryBridgeReady: boolean;
    sourceIdentityQuarantined: true;
  };
  viewModel: ZavorthCommandCenterLiveAssimilationViewModel;
  executionGate: ExternalAgentCommandCenterLiveAssimilationExecutionGate;
  redaction: ExternalAgentCommandCenterLiveAssimilationRedaction;
  nextGateRecommended: 'future-explicit-gate-required-before-mutable-assimilation';
};

export type ExternalAgentCommandCenterLiveAssimilationOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  source: ExternalAgentCommandCenterLiveAssimilationSource;
};

function capabilityStatus(row: ExternalAgentLiveReadinessCapabilityInventoryRow): ExternalAgentCommandCenterOperationalStatus {
  if (row.policy === 'blocked' || row.importClassification === 'blocked') {
    return 'blocked';
  }
  if (row.availability === 'unavailable' || row.importClassification === 'unavailable') {
    return 'unavailable';
  }
  if (row.availability === 'degraded' || row.importClassification === 'degraded') {
    return 'degraded';
  }
  return 'ready';
}

function projectionStatus(status: ExternalExecutorLiveObservabilityProjectionStatus): ExternalAgentCommandCenterOperationalStatus {
  return status;
}

function sessionStatus(status: ZavorthExternalSessionViewStatus): ExternalAgentCommandCenterOperationalStatus {
  return status;
}

function authorityDisposition(
  policy: ExternalAgentLiveReadinessCapabilityInventoryRow['policy'],
  classification: ExternalAgentLiveReadinessImportClassification,
): ExternalAgentCommandCenterAuthorityDisposition {
  if (policy === 'blocked' || classification === 'blocked') {
    return 'blocked';
  }
  if (policy === 'approval-required' || classification === 'approval-required') {
    return 'approval-required';
  }
  return 'read-only';
}

function surfaceStatus(surface: ExternalExecutorLiveReadOnlyBridgeSurface): ExternalAgentCommandCenterOperationalStatus {
  if (surface.policy === 'blocked' || surface.classification === 'blocked') {
    return 'blocked';
  }
  if (surface.availability === 'unavailable' || surface.classification === 'unavailable') {
    return 'unavailable';
  }
  if (surface.availability === 'degraded' || surface.classification === 'degraded') {
    return 'degraded';
  }
  return 'ready';
}

function capabilityLabel(rowKind: ExternalAgentLiveReadinessCapabilityRowKind, index: number): string {
  return `Capability surface ${index + 1}: ${rowKind.replace(/-/g, ' ')}`;
}

function eventTitle(kind: ExternalExecutorReadOnlySourceEventKind, index: number): string {
  return `Read-only event ${index + 1}: ${kind.replace(/-/g, ' ')}`;
}

function surfaceLabel(kind: ExternalExecutorLiveReadOnlyBridgeSurfaceKind | 'gateway-lifecycle', index: number): string {
  return `Read-only ${kind.replace(/-/g, ' ')} surface ${index + 1}`;
}

function buildRuntimeView(
  idPrefix: string,
  source: ExternalAgentCommandCenterLiveAssimilationSource,
): ZavorthCommandCenterRuntimeView {
  const runtimeStatus: ExternalAgentCommandCenterOperationalStatus =
    source.observability.runtimeObservability.status === 'ready' ? 'ready' : 'degraded';

  return {
    nativeContract: 'ZavorthCommandCenterRuntimeView/v1',
    id: `${idPrefix}:runtime`,
    label: 'External live runtime',
    status: runtimeStatus,
    healthProbeAuthenticated: true,
    statusProbeAvailable: true,
    capabilityProbeAvailable: true,
    cleanupConfirmed: source.bridge.observability.cleanupConfirmed,
    postListenerCount: source.bridge.observability.postListenerCount,
    postProcessCount: source.bridge.observability.postProcessCount,
    sourceIdentityPublic: false,
    sourceIdentityQuarantined: true,
    readOnly: true,
  };
}

function buildHealthView(
  idPrefix: string,
  source: ExternalAgentCommandCenterLiveAssimilationSource,
): ZavorthCommandCenterHealthStatusView {
  return {
    nativeContract: 'ZavorthCommandCenterHealthStatusView/v1',
    id: `${idPrefix}:health`,
    status: source.bridge.observability.healthStatus,
    label: 'Read-only runtime health',
    summary: 'Authenticated health, status, and capability probes are projected as read-only operational state.',
    degradedCount: source.bridge.failureModel.degradedRows.length,
    unavailableCount: source.bridge.failureModel.unavailableRows.length,
    rawExceptionSerialized: false,
    zavorthRuntimeFailed: false,
    readOnly: true,
  };
}

function buildCapabilityViews(
  idPrefix: string,
  source: ExternalAgentCommandCenterLiveAssimilationSource,
): ZavorthCommandCenterCapabilityView[] {
  return source.bridge.capabilityInventoryNative.inventory.map((row, index) => ({
    nativeContract: 'ZavorthCommandCenterCapabilityView/v1',
    id: `${idPrefix}:capability-${index + 1}-${row.rowKind}`,
    label: capabilityLabel(row.rowKind, index),
    category: row.rowKind,
    kind: row.kind,
    status: capabilityStatus(row),
    importClassification: row.importClassification,
    authorityDisposition: authorityDisposition(row.policy, row.importClassification),
    risk: row.risk,
    trustState: row.trustState,
    sourceIdsEvidenceOnly: true,
    executionAuthority: false,
    readOnly: true,
  }));
}

function buildEventViews(
  idPrefix: string,
  source: ExternalAgentCommandCenterLiveAssimilationSource,
): ZavorthCommandCenterEventView[] {
  return source.eventStream.commandCenterEvents.map((event, index) => ({
    nativeContract: 'ZavorthCommandCenterEventView/v1',
    id: `${idPrefix}:event-${index + 1}-${event.kind}`,
    kind: event.kind,
    status: projectionStatus(event.status),
    severity: event.severity,
    title: eventTitle(event.kind, index),
    payloadRedacted: true,
    sourceIdsEvidenceOnly: true,
    dispatchPerformed: false,
    commandCenterConsumable: true,
    readOnly: true,
  }));
}

function buildSessionViews(
  idPrefix: string,
  source: ExternalAgentCommandCenterLiveAssimilationSource,
): ZavorthCommandCenterSessionView[] {
  return source.sessionHistory.commandCenterViews.map((session, index) => ({
    nativeContract: 'ZavorthCommandCenterSessionView/v1',
    id: `${idPrefix}:session-${index + 1}`,
    label: `Read-only session metadata ${index + 1}`,
    status: sessionStatus(session.status),
    channel: session.channel,
    messageCount: session.messageCount,
    importAuthority: false,
    migrationAllowed: false,
    writeBackAllowed: false,
    sourceIdsEvidenceOnly: true,
    commandCenterConsumable: true,
    readOnly: true,
  }));
}

function buildMessageViews(
  idPrefix: string,
  source: ExternalAgentCommandCenterLiveAssimilationSource,
): ZavorthCommandCenterMessageMetadataView[] {
  return source.sessionHistory.sessionViews.flatMap((session, sessionIndex) => (
    session.messages.map((message, messageIndex) => ({
      nativeContract: 'ZavorthCommandCenterMessageMetadataView/v1',
      id: `${idPrefix}:message-${sessionIndex + 1}-${messageIndex + 1}`,
      sessionViewId: `${idPrefix}:session-${sessionIndex + 1}`,
      roleFamily: message.roleFamily,
      contentState: message.contentState,
      contentPreview: message.contentPreview,
      sensitiveContentRedacted: true,
      rawContentSerialized: false,
      sourceIdsEvidenceOnly: true,
      readOnly: true,
    }))
  ));
}

function buildSurfaceViews(
  idPrefix: string,
  source: ExternalAgentCommandCenterLiveAssimilationSource,
  surfaceKinds: ExternalExecutorLiveReadOnlyBridgeSurfaceKind[],
): ZavorthCommandCenterSurfaceView[] {
  return source.bridge.surfaces
    .filter((surface) => surfaceKinds.includes(surface.surfaceKind))
    .map((surface, index) => ({
      nativeContract: 'ZavorthCommandCenterSurfaceView/v1',
      id: `${idPrefix}:${surface.surfaceKind}-${index + 1}`,
      surfaceKind: surface.surfaceKind,
      label: surfaceLabel(surface.surfaceKind, index),
      status: surfaceStatus(surface),
      authorityDisposition: authorityDisposition(surface.policy, surface.classification),
      sourceIdsEvidenceOnly: true,
      readOnly: true,
      executionAuthority: false,
    }));
}

function buildGatewayLifecycleViews(
  idPrefix: string,
  source: ExternalAgentCommandCenterLiveAssimilationSource,
): ZavorthCommandCenterSurfaceView[] {
  return [
    {
      nativeContract: 'ZavorthCommandCenterSurfaceView/v1',
      id: `${idPrefix}:gateway-lifecycle-health`,
      surfaceKind: 'gateway-lifecycle',
      label: surfaceLabel('gateway-lifecycle', 0),
      status: source.bridge.observability.cleanupConfirmed ? 'ready' : 'degraded',
      authorityDisposition: 'read-only',
      sourceIdsEvidenceOnly: true,
      readOnly: true,
      executionAuthority: false,
    },
  ];
}

function buildOperationalStates(
  viewModelParts: {
    capabilities: ZavorthCommandCenterCapabilityView[];
    events: ZavorthCommandCenterEventView[];
    sessions: ZavorthCommandCenterSessionView[];
    channels: ZavorthCommandCenterSurfaceView[];
    plugins: ZavorthCommandCenterSurfaceView[];
    providers: ZavorthCommandCenterSurfaceView[];
    gatewayLifecycle: ZavorthCommandCenterSurfaceView[];
  },
): ZavorthCommandCenterOperationalStates {
  const rows = [
    ...viewModelParts.capabilities,
    ...viewModelParts.events,
    ...viewModelParts.sessions,
    ...viewModelParts.channels,
    ...viewModelParts.plugins,
    ...viewModelParts.providers,
    ...viewModelParts.gatewayLifecycle,
  ];
  const labelsByStatus = (status: ExternalAgentCommandCenterOperationalStatus): string[] => (
    rows
      .filter((row) => row.status === status)
      .map((row) => ('label' in row ? row.label : row.title))
  );

  return {
    nativeContract: 'ZavorthCommandCenterOperationalStates/v1',
    degraded: labelsByStatus('degraded'),
    unavailable: labelsByStatus('unavailable'),
    unknown: labelsByStatus('unknown'),
    blocked: labelsByStatus('blocked'),
    representedAsOperationalState: true,
    rawExceptionSerialized: false,
    zavorthRuntimeFailed: false,
  };
}

function buildViewModel(
  options: ExternalAgentCommandCenterLiveAssimilationOptions,
): ZavorthCommandCenterLiveAssimilationViewModel {
  const { source } = options;
  const runtime = buildRuntimeView(options.idPrefix, source);
  const health = buildHealthView(options.idPrefix, source);
  const capabilities = buildCapabilityViews(options.idPrefix, source);
  const events = buildEventViews(options.idPrefix, source);
  const sessions = buildSessionViews(options.idPrefix, source);
  const messages = buildMessageViews(options.idPrefix, source);
  const channels = buildSurfaceViews(options.idPrefix, source, ['channel', 'message']);
  const plugins = buildSurfaceViews(options.idPrefix, source, ['plugin']);
  const providers = buildSurfaceViews(options.idPrefix, source, ['provider']);
  const gatewayLifecycle = [
    ...buildSurfaceViews(options.idPrefix, source, ['event', 'gateway-method']),
    ...buildGatewayLifecycleViews(options.idPrefix, source),
  ];
  const operationalStates = buildOperationalStates({
    capabilities,
    events,
    sessions,
    channels,
    plugins,
    providers,
    gatewayLifecycle,
  });

  return {
    nativeContract: 'ZavorthCommandCenterLiveAssimilationViewModel/v1',
    id: `${options.idPrefix}:view-model`,
    generatedAt: options.generatedAt,
    runtime,
    health,
    capabilities,
    events,
    sessions,
    messages,
    channels,
    plugins,
    providers,
    gatewayLifecycle,
    operationalStates,
    dashboardUsesSourceVisualIdentity: false,
    sourceRuntimeNamePublic: false,
    sourceStructuresPublic: false,
    readOnly: true,
  };
}

export function createExternalAgentCommandCenterLiveAssimilationFixtureSource(): ExternalAgentCommandCenterLiveAssimilationSource {
  return {
    snapshot: normalizeExternalExecutorRealCapabilitySnapshotReadOnlyFixture(),
    bridge: normalizeExternalExecutorLiveReadOnlyBridgeBoundaryFixture(),
    observability: normalizeExternalExecutorLiveObservabilityProjectionFixture(),
    eventStream: normalizeExternalExecutorReadOnlyEventStreamAdapterFixture(),
    sessionHistory: normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture(),
    sourceIdentityQuarantined: true,
    sourceRuntimeNamePublic: false,
    sourceVisualIdentityPublic: false,
    mutableStreamOpened: false,
    actionDispatched: false,
    messageSent: false,
    providerExecuted: false,
    commandExecuted: false,
    sessionImported: false,
    migrationPerformed: false,
    writeBackPerformed: false,
    stateMigrated: false,
    sourceModulesCopied: false,
    nativeReplacementAuthorized: false,
  };
}

export function normalizeExternalAgentCommandCenterLiveAssimilation<TRuntimeId extends string>(
  options: ExternalAgentCommandCenterLiveAssimilationOptions<TRuntimeId>,
): ExternalAgentCommandCenterLiveAssimilationNormalization {
  const sourceGateReadiness = {
    capabilitySnapshotReady: options.source.snapshot.decision === 'real-capability-snapshot-read-only-ok',
    bridgeReady: options.source.bridge.decision === 'external-executor-live-read-only-bridge-boundary-ready',
    observabilityProjectionReady: options.source.observability.decision === 'external-executor-live-observability-projection-ready',
    eventStreamAdapterReady: options.source.eventStream.decision === 'external-executor-read-only-event-stream-adapter-ready',
    sessionHistoryBridgeReady: options.source.sessionHistory.decision === 'external-executor-session-history-read-only-bridge-ready',
    sourceIdentityQuarantined: true,
  } as const;
  const forbiddenAuthority =
    options.source.mutableStreamOpened ||
    options.source.actionDispatched ||
    options.source.messageSent ||
    options.source.providerExecuted ||
    options.source.commandExecuted ||
    options.source.sessionImported ||
    options.source.migrationPerformed ||
    options.source.writeBackPerformed ||
    options.source.stateMigrated ||
    options.source.sourceModulesCopied ||
    options.source.nativeReplacementAuthorized;
  const ready = Object.values(sourceGateReadiness).every(Boolean) && !forbiddenAuthority;

  return {
    nativeContract: 'ZavorthCommandCenterLiveAssimilationBoundary/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'command-center-live-assimilation-ready' : 'blocked',
    readOnly: true,
    sourceGateReadiness,
    viewModel: buildViewModel(options),
    executionGate: {
      executionAuthority: false,
      actionDispatchAllowed: false,
      messageSendAllowed: false,
      providerExecutionAllowed: false,
      commandExecutionAllowed: false,
      sessionImportAllowed: false,
      migrationAllowed: false,
      writeBackAllowed: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorized: false,
      mutableStreamOpened: false,
      rawSecretSerialized: false,
    },
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sensitiveMetadataRedacted: true,
      sourceIdentityPublic: false,
      sourceIdsEvidenceOnly: true,
      serializedPublicViewContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-explicit-gate-required-before-mutable-assimilation',
  };
}

export function normalizeExternalAgentCommandCenterLiveAssimilationFixture(): ExternalAgentCommandCenterLiveAssimilationNormalization {
  return normalizeExternalAgentCommandCenterLiveAssimilation({
    source: createExternalAgentCommandCenterLiveAssimilationFixtureSource(),
    generatedAt: EXTERNAL_AGENT_COMMAND_CENTER_LIVE_ASSIMILATION_NOW,
    runtimeId: EXTERNAL_AGENT_COMMAND_CENTER_LIVE_ASSIMILATION_RUNTIME_ID,
    idPrefix: 'external-agent-command-center-live-assimilation',
  });
}
