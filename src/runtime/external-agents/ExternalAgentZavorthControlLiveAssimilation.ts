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

export const EXTERNAL_AGENT_ZAVORTH_CONTROL_LIVE_ASSIMILATION_NOW = '2026-04-28T21:30:00.000Z' as const;
export const EXTERNAL_AGENT_ZAVORTH_CONTROL_LIVE_ASSIMILATION_RUNTIME_ID = 'external-agent-zavorthControl-live-assimilation' as const;

export type ExternalAgentZavorthControlLiveAssimilationDecision =
  | 'blocked'
  | 'zavorthControl-live-assimilation-ready';

export type ExternalAgentZavorthControlOperationalStatus =
  | 'blocked'
  | 'degraded'
  | 'ready'
  | 'unavailable'
  | 'unknown';

export type ExternalAgentZavorthControlAuthorityDisposition =
  | 'approval-required'
  | 'blocked'
  | 'read-only';

export type ExternalAgentZavorthControlLiveAssimilationSource = {
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

export type ZavorthControlRuntimeView = {
  nativeContract: 'ZavorthControlRuntimeView/v1';
  id: string;
  label: 'External live runtime';
  status: ExternalAgentZavorthControlOperationalStatus;
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

export type ZavorthControlHealthStatusView = {
  nativeContract: 'ZavorthControlHealthStatusView/v1';
  id: string;
  status: ExternalAgentZavorthControlOperationalStatus;
  label: 'Read-only runtime health';
  summary: string;
  degradedCount: number;
  unavailableCount: number;
  rawExceptionSerialized: false;
  zavorthRuntimeFailed: false;
  readOnly: true;
};

export type ZavorthControlCapabilityView = {
  nativeContract: 'ZavorthControlCapabilityView/v1';
  id: string;
  label: string;
  category: ExternalAgentLiveReadinessCapabilityRowKind;
  kind: ExternalAgentLiveReadinessCapabilityInventoryRow['kind'];
  status: ExternalAgentZavorthControlOperationalStatus;
  importClassification: ExternalAgentLiveReadinessImportClassification;
  authorityDisposition: ExternalAgentZavorthControlAuthorityDisposition;
  risk: ExternalAgentLiveReadinessCapabilityInventoryRow['risk'];
  trustState: ExternalAgentLiveReadinessCapabilityInventoryRow['trustState'];
  sourceIdsEvidenceOnly: true;
  executionAuthority: false;
  readOnly: true;
};

export type ZavorthControlEventView = {
  nativeContract: 'ZavorthControlEventView/v1';
  id: string;
  kind: ExternalExecutorReadOnlySourceEventKind;
  status: ExternalAgentZavorthControlOperationalStatus;
  severity: 'danger' | 'info' | 'warning';
  title: string;
  payloadRedacted: true;
  sourceIdsEvidenceOnly: true;
  dispatchPerformed: false;
  zavorthControlConsumable: true;
  readOnly: true;
};

export type ZavorthControlSessionView = {
  nativeContract: 'ZavorthControlSessionView/v1';
  id: string;
  label: string;
  status: ExternalAgentZavorthControlOperationalStatus;
  channel: string;
  messageCount: number;
  importAuthority: false;
  migrationAllowed: false;
  writeBackAllowed: false;
  sourceIdsEvidenceOnly: true;
  zavorthControlConsumable: true;
  readOnly: true;
};

export type ZavorthControlMessageMetadataView = {
  nativeContract: 'ZavorthControlMessageMetadataView/v1';
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

export type ZavorthControlSurfaceView = {
  nativeContract: 'ZavorthControlSurfaceView/v1';
  id: string;
  surfaceKind: ExternalExecutorLiveReadOnlyBridgeSurfaceKind | 'gateway-lifecycle';
  label: string;
  status: ExternalAgentZavorthControlOperationalStatus;
  authorityDisposition: ExternalAgentZavorthControlAuthorityDisposition;
  sourceIdsEvidenceOnly: true;
  readOnly: true;
  executionAuthority: false;
};

export type ZavorthControlOperationalStates = {
  nativeContract: 'ZavorthControlOperationalStates/v1';
  degraded: string[];
  unavailable: string[];
  unknown: string[];
  blocked: string[];
  representedAsOperationalState: true;
  rawExceptionSerialized: false;
  zavorthRuntimeFailed: false;
};

export type ZavorthControlLiveAssimilationViewModel = {
  nativeContract: 'ZavorthControlLiveAssimilationViewModel/v1';
  id: string;
  generatedAt: string;
  runtime: ZavorthControlRuntimeView;
  health: ZavorthControlHealthStatusView;
  capabilities: ZavorthControlCapabilityView[];
  events: ZavorthControlEventView[];
  sessions: ZavorthControlSessionView[];
  messages: ZavorthControlMessageMetadataView[];
  channels: ZavorthControlSurfaceView[];
  plugins: ZavorthControlSurfaceView[];
  providers: ZavorthControlSurfaceView[];
  gatewayLifecycle: ZavorthControlSurfaceView[];
  operationalStates: ZavorthControlOperationalStates;
  zavorthControlUsesSourceVisualIdentity: false;
  sourceRuntimeNamePublic: false;
  sourceStructuresPublic: false;
  readOnly: true;
};

export type ExternalAgentZavorthControlLiveAssimilationExecutionGate = {
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

export type ExternalAgentZavorthControlLiveAssimilationRedaction = {
  rawSecretSerialized: false;
  rawMessageContentSerialized: false;
  sensitiveMetadataRedacted: true;
  sourceIdentityPublic: false;
  sourceIdsEvidenceOnly: true;
  serializedPublicViewContainsSensitiveFixture: false;
};

export type ExternalAgentZavorthControlLiveAssimilationNormalization = {
  nativeContract: 'ZavorthControlLiveAssimilationBoundary/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ExternalAgentZavorthControlLiveAssimilationDecision;
  readOnly: true;
  sourceGateReadiness: {
    capabilitySnapshotReady: boolean;
    bridgeReady: boolean;
    observabilityProjectionReady: boolean;
    eventStreamAdapterReady: boolean;
    sessionHistoryBridgeReady: boolean;
    sourceIdentityQuarantined: true;
  };
  viewModel: ZavorthControlLiveAssimilationViewModel;
  executionGate: ExternalAgentZavorthControlLiveAssimilationExecutionGate;
  redaction: ExternalAgentZavorthControlLiveAssimilationRedaction;
  nextGateRecommended: 'future-explicit-gate-required-before-mutable-assimilation';
};

export type ExternalAgentZavorthControlLiveAssimilationOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  source: ExternalAgentZavorthControlLiveAssimilationSource;
};

function capabilityStatus(row: ExternalAgentLiveReadinessCapabilityInventoryRow): ExternalAgentZavorthControlOperationalStatus {
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

function projectionStatus(status: ExternalExecutorLiveObservabilityProjectionStatus): ExternalAgentZavorthControlOperationalStatus {
  return status;
}

function sessionStatus(status: ZavorthExternalSessionViewStatus): ExternalAgentZavorthControlOperationalStatus {
  return status;
}

function authorityDisposition(
  policy: ExternalAgentLiveReadinessCapabilityInventoryRow['policy'],
  classification: ExternalAgentLiveReadinessImportClassification,
): ExternalAgentZavorthControlAuthorityDisposition {
  if (policy === 'blocked' || classification === 'blocked') {
    return 'blocked';
  }
  if (policy === 'approval-required' || classification === 'approval-required') {
    return 'approval-required';
  }
  return 'read-only';
}

function surfaceStatus(surface: ExternalExecutorLiveReadOnlyBridgeSurface): ExternalAgentZavorthControlOperationalStatus {
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
  source: ExternalAgentZavorthControlLiveAssimilationSource,
): ZavorthControlRuntimeView {
  const runtimeStatus: ExternalAgentZavorthControlOperationalStatus =
    source.observability.runtimeObservability.status === 'ready' ? 'ready' : 'degraded';

  return {
    nativeContract: 'ZavorthControlRuntimeView/v1',
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
  source: ExternalAgentZavorthControlLiveAssimilationSource,
): ZavorthControlHealthStatusView {
  return {
    nativeContract: 'ZavorthControlHealthStatusView/v1',
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
  source: ExternalAgentZavorthControlLiveAssimilationSource,
): ZavorthControlCapabilityView[] {
  return source.bridge.capabilityInventoryNative.inventory.map((row, index) => ({
    nativeContract: 'ZavorthControlCapabilityView/v1',
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
  source: ExternalAgentZavorthControlLiveAssimilationSource,
): ZavorthControlEventView[] {
  return source.eventStream.zavorthControlEvents.map((event, index) => ({
    nativeContract: 'ZavorthControlEventView/v1',
    id: `${idPrefix}:event-${index + 1}-${event.kind}`,
    kind: event.kind,
    status: projectionStatus(event.status),
    severity: event.severity,
    title: eventTitle(event.kind, index),
    payloadRedacted: true,
    sourceIdsEvidenceOnly: true,
    dispatchPerformed: false,
    zavorthControlConsumable: true,
    readOnly: true,
  }));
}

function buildSessionViews(
  idPrefix: string,
  source: ExternalAgentZavorthControlLiveAssimilationSource,
): ZavorthControlSessionView[] {
  return source.sessionHistory.zavorthControlViews.map((session, index) => ({
    nativeContract: 'ZavorthControlSessionView/v1',
    id: `${idPrefix}:session-${index + 1}`,
    label: `Read-only session metadata ${index + 1}`,
    status: sessionStatus(session.status),
    channel: session.channel,
    messageCount: session.messageCount,
    importAuthority: false,
    migrationAllowed: false,
    writeBackAllowed: false,
    sourceIdsEvidenceOnly: true,
    zavorthControlConsumable: true,
    readOnly: true,
  }));
}

function buildMessageViews(
  idPrefix: string,
  source: ExternalAgentZavorthControlLiveAssimilationSource,
): ZavorthControlMessageMetadataView[] {
  return source.sessionHistory.sessionViews.flatMap((session, sessionIndex) => (
    session.messages.map((message, messageIndex) => ({
      nativeContract: 'ZavorthControlMessageMetadataView/v1',
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
  source: ExternalAgentZavorthControlLiveAssimilationSource,
  surfaceKinds: ExternalExecutorLiveReadOnlyBridgeSurfaceKind[],
): ZavorthControlSurfaceView[] {
  return source.bridge.surfaces
    .filter((surface) => surfaceKinds.includes(surface.surfaceKind))
    .map((surface, index) => ({
      nativeContract: 'ZavorthControlSurfaceView/v1',
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
  source: ExternalAgentZavorthControlLiveAssimilationSource,
): ZavorthControlSurfaceView[] {
  return [
    {
      nativeContract: 'ZavorthControlSurfaceView/v1',
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
    capabilities: ZavorthControlCapabilityView[];
    events: ZavorthControlEventView[];
    sessions: ZavorthControlSessionView[];
    channels: ZavorthControlSurfaceView[];
    plugins: ZavorthControlSurfaceView[];
    providers: ZavorthControlSurfaceView[];
    gatewayLifecycle: ZavorthControlSurfaceView[];
  },
): ZavorthControlOperationalStates {
  const rows = [
    ...viewModelParts.capabilities,
    ...viewModelParts.events,
    ...viewModelParts.sessions,
    ...viewModelParts.channels,
    ...viewModelParts.plugins,
    ...viewModelParts.providers,
    ...viewModelParts.gatewayLifecycle,
  ];
  const labelsByStatus = (status: ExternalAgentZavorthControlOperationalStatus): string[] => (
    rows
      .filter((row) => row.status === status)
      .map((row) => ('label' in row ? row.label : row.title))
  );

  return {
    nativeContract: 'ZavorthControlOperationalStates/v1',
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
  options: ExternalAgentZavorthControlLiveAssimilationOptions,
): ZavorthControlLiveAssimilationViewModel {
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
    nativeContract: 'ZavorthControlLiveAssimilationViewModel/v1',
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
    zavorthControlUsesSourceVisualIdentity: false,
    sourceRuntimeNamePublic: false,
    sourceStructuresPublic: false,
    readOnly: true,
  };
}

export function createExternalAgentZavorthControlLiveAssimilationFixtureSource(): ExternalAgentZavorthControlLiveAssimilationSource {
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

export function normalizeExternalAgentZavorthControlLiveAssimilation<TRuntimeId extends string>(
  options: ExternalAgentZavorthControlLiveAssimilationOptions<TRuntimeId>,
): ExternalAgentZavorthControlLiveAssimilationNormalization {
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
    nativeContract: 'ZavorthControlLiveAssimilationBoundary/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'zavorthControl-live-assimilation-ready' : 'blocked',
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

export function normalizeExternalAgentZavorthControlLiveAssimilationFixture(): ExternalAgentZavorthControlLiveAssimilationNormalization {
  return normalizeExternalAgentZavorthControlLiveAssimilation({
    source: createExternalAgentZavorthControlLiveAssimilationFixtureSource(),
    generatedAt: EXTERNAL_AGENT_ZAVORTH_CONTROL_LIVE_ASSIMILATION_NOW,
    runtimeId: EXTERNAL_AGENT_ZAVORTH_CONTROL_LIVE_ASSIMILATION_RUNTIME_ID,
    idPrefix: 'external-agent-zavorthControl-live-assimilation',
  });
}
