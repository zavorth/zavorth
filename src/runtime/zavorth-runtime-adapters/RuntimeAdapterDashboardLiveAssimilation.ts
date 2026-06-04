import {
  normalizeExternalExecutorLiveObservabilityProjectionFixture,
} from './RuntimeAdapterExternalExecutorLiveObservabilityProjection.js';
import {
  normalizeExternalExecutorLiveReadOnlyBridgeBoundaryFixture,
} from './RuntimeAdapterExternalExecutorLiveReadOnlyBridgeBoundary.js';
import {
  normalizeExternalExecutorReadOnlyEventStreamAdapterFixture,
} from './RuntimeAdapterExternalExecutorReadOnlyEventStreamAdapter.js';
import {
  normalizeExternalExecutorRealCapabilitySnapshotReadOnlyFixture,
} from './RuntimeAdapterExternalExecutorRealCapabilitySnapshotReadOnly.js';
import {
  normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture,
} from './RuntimeAdapterExternalExecutorSessionHistoryReadOnlyBridge.js';
import type {
  RuntimeAdapterLiveReadinessCapabilityInventoryRow,
  RuntimeAdapterLiveReadinessCapabilityRowKind,
  RuntimeAdapterLiveReadinessImportClassification,
} from './RuntimeAdapterLiveReadinessAssimilationPack.js';
import type {
  ExternalExecutorLiveObservabilityProjectionNormalization,
  ExternalExecutorLiveObservabilityProjectionStatus,
} from './RuntimeAdapterExternalExecutorLiveObservabilityProjection.js';
import type {
  ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization,
  ExternalExecutorLiveReadOnlyBridgeSurface,
  ExternalExecutorLiveReadOnlyBridgeSurfaceKind,
} from './RuntimeAdapterExternalExecutorLiveReadOnlyBridgeBoundary.js';
import type {
  ExternalExecutorReadOnlyEventStreamAdapterNormalization,
  ExternalExecutorReadOnlySourceEventKind,
} from './RuntimeAdapterExternalExecutorReadOnlyEventStreamAdapter.js';
import type {
  ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization,
} from './RuntimeAdapterExternalExecutorRealCapabilitySnapshotReadOnly.js';
import type {
  ZavorthExternalSessionViewStatus,
  ExternalExecutorSessionHistoryReadOnlyBridgeNormalization,
} from './RuntimeAdapterExternalExecutorSessionHistoryReadOnlyBridge.js';

export const RUNTIME_ADAPTER_COMMAND_CENTER_LIVE_ASSIMILATION_NOW = '2026-04-28T21:30:00.000Z' as const;
export const RUNTIME_ADAPTER_COMMAND_CENTER_LIVE_ASSIMILATION_RUNTIME_ID = 'runtime-adapter-dashboard-live-assimilation' as const;

export type RuntimeAdapterDashboardLiveAssimilationDecision =
  | 'blocked'
  | 'dashboard-live-assimilation-ready';

export type RuntimeAdapterDashboardOperationalStatus =
  | 'blocked'
  | 'degraded'
  | 'ready'
  | 'unavailable'
  | 'unknown';

export type RuntimeAdapterDashboardAuthorityDisposition =
  | 'approval-required'
  | 'blocked'
  | 'read-only';

export type RuntimeAdapterDashboardLiveAssimilationSource = {
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

export type ZavorthDashboardRuntimeView = {
  nativeContract: 'ZavorthDashboardRuntimeView/v1';
  id: string;
  label: 'External live runtime';
  status: RuntimeAdapterDashboardOperationalStatus;
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

export type ZavorthDashboardHealthStatusView = {
  nativeContract: 'ZavorthDashboardHealthStatusView/v1';
  id: string;
  status: RuntimeAdapterDashboardOperationalStatus;
  label: 'Read-only runtime health';
  summary: string;
  degradedCount: number;
  unavailableCount: number;
  rawExceptionSerialized: false;
  zavorthRuntimeFailed: false;
  readOnly: true;
};

export type ZavorthDashboardCapabilityView = {
  nativeContract: 'ZavorthDashboardCapabilityView/v1';
  id: string;
  label: string;
  category: RuntimeAdapterLiveReadinessCapabilityRowKind;
  kind: RuntimeAdapterLiveReadinessCapabilityInventoryRow['kind'];
  status: RuntimeAdapterDashboardOperationalStatus;
  importClassification: RuntimeAdapterLiveReadinessImportClassification;
  authorityDisposition: RuntimeAdapterDashboardAuthorityDisposition;
  risk: RuntimeAdapterLiveReadinessCapabilityInventoryRow['risk'];
  trustState: RuntimeAdapterLiveReadinessCapabilityInventoryRow['trustState'];
  sourceIdsEvidenceOnly: true;
  executionAuthority: false;
  readOnly: true;
};

export type ZavorthDashboardEventView = {
  nativeContract: 'ZavorthDashboardEventView/v1';
  id: string;
  kind: ExternalExecutorReadOnlySourceEventKind;
  status: RuntimeAdapterDashboardOperationalStatus;
  severity: 'danger' | 'info' | 'warning';
  title: string;
  payloadRedacted: true;
  sourceIdsEvidenceOnly: true;
  dispatchPerformed: false;
  dashboardConsumable: true;
  readOnly: true;
};

export type ZavorthDashboardSessionView = {
  nativeContract: 'ZavorthDashboardSessionView/v1';
  id: string;
  label: string;
  status: RuntimeAdapterDashboardOperationalStatus;
  channel: string;
  messageCount: number;
  importAuthority: false;
  migrationAllowed: false;
  writeBackAllowed: false;
  sourceIdsEvidenceOnly: true;
  dashboardConsumable: true;
  readOnly: true;
};

export type ZavorthDashboardMessageMetadataView = {
  nativeContract: 'ZavorthDashboardMessageMetadataView/v1';
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

export type ZavorthDashboardSurfaceView = {
  nativeContract: 'ZavorthDashboardSurfaceView/v1';
  id: string;
  surfaceKind: ExternalExecutorLiveReadOnlyBridgeSurfaceKind | 'gateway-lifecycle';
  label: string;
  status: RuntimeAdapterDashboardOperationalStatus;
  authorityDisposition: RuntimeAdapterDashboardAuthorityDisposition;
  sourceIdsEvidenceOnly: true;
  readOnly: true;
  executionAuthority: false;
};

export type ZavorthDashboardOperationalStates = {
  nativeContract: 'ZavorthDashboardOperationalStates/v1';
  degraded: string[];
  unavailable: string[];
  unknown: string[];
  blocked: string[];
  representedAsOperationalState: true;
  rawExceptionSerialized: false;
  zavorthRuntimeFailed: false;
};

export type ZavorthDashboardLiveAssimilationViewModel = {
  nativeContract: 'ZavorthDashboardLiveAssimilationViewModel/v1';
  id: string;
  generatedAt: string;
  runtime: ZavorthDashboardRuntimeView;
  health: ZavorthDashboardHealthStatusView;
  capabilities: ZavorthDashboardCapabilityView[];
  events: ZavorthDashboardEventView[];
  sessions: ZavorthDashboardSessionView[];
  messages: ZavorthDashboardMessageMetadataView[];
  channels: ZavorthDashboardSurfaceView[];
  plugins: ZavorthDashboardSurfaceView[];
  providers: ZavorthDashboardSurfaceView[];
  gatewayLifecycle: ZavorthDashboardSurfaceView[];
  operationalStates: ZavorthDashboardOperationalStates;
  dashboardUsesSourceVisualIdentity: false;
  sourceRuntimeNamePublic: false;
  sourceStructuresPublic: false;
  readOnly: true;
};

export type RuntimeAdapterDashboardLiveAssimilationExecutionGate = {
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

export type RuntimeAdapterDashboardLiveAssimilationRedaction = {
  rawSecretSerialized: false;
  rawMessageContentSerialized: false;
  sensitiveMetadataRedacted: true;
  sourceIdentityPublic: false;
  sourceIdsEvidenceOnly: true;
  serializedPublicViewContainsSensitiveFixture: false;
};

export type RuntimeAdapterDashboardLiveAssimilationNormalization = {
  nativeContract: 'ZavorthDashboardLiveAssimilationBoundary/v1';
  generatedAt: string;
  runtimeId: string;
  decision: RuntimeAdapterDashboardLiveAssimilationDecision;
  readOnly: true;
  sourceGateReadiness: {
    capabilitySnapshotReady: boolean;
    bridgeReady: boolean;
    observabilityProjectionReady: boolean;
    eventStreamAdapterReady: boolean;
    sessionHistoryBridgeReady: boolean;
    sourceIdentityQuarantined: true;
  };
  viewModel: ZavorthDashboardLiveAssimilationViewModel;
  executionGate: RuntimeAdapterDashboardLiveAssimilationExecutionGate;
  redaction: RuntimeAdapterDashboardLiveAssimilationRedaction;
  nextGateRecommended: 'future-explicit-gate-required-before-mutable-assimilation';
};

export type RuntimeAdapterDashboardLiveAssimilationOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  source: RuntimeAdapterDashboardLiveAssimilationSource;
};

function capabilityStatus(row: RuntimeAdapterLiveReadinessCapabilityInventoryRow): RuntimeAdapterDashboardOperationalStatus {
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

function projectionStatus(status: ExternalExecutorLiveObservabilityProjectionStatus): RuntimeAdapterDashboardOperationalStatus {
  return status;
}

function sessionStatus(status: ZavorthExternalSessionViewStatus): RuntimeAdapterDashboardOperationalStatus {
  return status;
}

function authorityDisposition(
  policy: RuntimeAdapterLiveReadinessCapabilityInventoryRow['policy'],
  classification: RuntimeAdapterLiveReadinessImportClassification,
): RuntimeAdapterDashboardAuthorityDisposition {
  if (policy === 'blocked' || classification === 'blocked') {
    return 'blocked';
  }
  if (policy === 'approval-required' || classification === 'approval-required') {
    return 'approval-required';
  }
  return 'read-only';
}

function surfaceStatus(surface: ExternalExecutorLiveReadOnlyBridgeSurface): RuntimeAdapterDashboardOperationalStatus {
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

function capabilityLabel(rowKind: RuntimeAdapterLiveReadinessCapabilityRowKind, index: number): string {
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
  source: RuntimeAdapterDashboardLiveAssimilationSource,
): ZavorthDashboardRuntimeView {
  const runtimeStatus: RuntimeAdapterDashboardOperationalStatus =
    source.observability.runtimeObservability.status === 'ready' ? 'ready' : 'degraded';

  return {
    nativeContract: 'ZavorthDashboardRuntimeView/v1',
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
  source: RuntimeAdapterDashboardLiveAssimilationSource,
): ZavorthDashboardHealthStatusView {
  return {
    nativeContract: 'ZavorthDashboardHealthStatusView/v1',
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
  source: RuntimeAdapterDashboardLiveAssimilationSource,
): ZavorthDashboardCapabilityView[] {
  return source.bridge.capabilityInventoryNative.inventory.map((row, index) => ({
    nativeContract: 'ZavorthDashboardCapabilityView/v1',
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
  source: RuntimeAdapterDashboardLiveAssimilationSource,
): ZavorthDashboardEventView[] {
  return source.eventStream.dashboardEvents.map((event, index) => ({
    nativeContract: 'ZavorthDashboardEventView/v1',
    id: `${idPrefix}:event-${index + 1}-${event.kind}`,
    kind: event.kind,
    status: projectionStatus(event.status),
    severity: event.severity,
    title: eventTitle(event.kind, index),
    payloadRedacted: true,
    sourceIdsEvidenceOnly: true,
    dispatchPerformed: false,
    dashboardConsumable: true,
    readOnly: true,
  }));
}

function buildSessionViews(
  idPrefix: string,
  source: RuntimeAdapterDashboardLiveAssimilationSource,
): ZavorthDashboardSessionView[] {
  return source.sessionHistory.dashboardViews.map((session, index) => ({
    nativeContract: 'ZavorthDashboardSessionView/v1',
    id: `${idPrefix}:session-${index + 1}`,
    label: `Read-only session metadata ${index + 1}`,
    status: sessionStatus(session.status),
    channel: session.channel,
    messageCount: session.messageCount,
    importAuthority: false,
    migrationAllowed: false,
    writeBackAllowed: false,
    sourceIdsEvidenceOnly: true,
    dashboardConsumable: true,
    readOnly: true,
  }));
}

function buildMessageViews(
  idPrefix: string,
  source: RuntimeAdapterDashboardLiveAssimilationSource,
): ZavorthDashboardMessageMetadataView[] {
  return source.sessionHistory.sessionViews.flatMap((session, sessionIndex) => (
    session.messages.map((message, messageIndex) => ({
      nativeContract: 'ZavorthDashboardMessageMetadataView/v1',
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
  source: RuntimeAdapterDashboardLiveAssimilationSource,
  surfaceKinds: ExternalExecutorLiveReadOnlyBridgeSurfaceKind[],
): ZavorthDashboardSurfaceView[] {
  return source.bridge.surfaces
    .filter((surface) => surfaceKinds.includes(surface.surfaceKind))
    .map((surface, index) => ({
      nativeContract: 'ZavorthDashboardSurfaceView/v1',
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
  source: RuntimeAdapterDashboardLiveAssimilationSource,
): ZavorthDashboardSurfaceView[] {
  return [
    {
      nativeContract: 'ZavorthDashboardSurfaceView/v1',
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
    capabilities: ZavorthDashboardCapabilityView[];
    events: ZavorthDashboardEventView[];
    sessions: ZavorthDashboardSessionView[];
    channels: ZavorthDashboardSurfaceView[];
    plugins: ZavorthDashboardSurfaceView[];
    providers: ZavorthDashboardSurfaceView[];
    gatewayLifecycle: ZavorthDashboardSurfaceView[];
  },
): ZavorthDashboardOperationalStates {
  const rows = [
    ...viewModelParts.capabilities,
    ...viewModelParts.events,
    ...viewModelParts.sessions,
    ...viewModelParts.channels,
    ...viewModelParts.plugins,
    ...viewModelParts.providers,
    ...viewModelParts.gatewayLifecycle,
  ];
  const labelsByStatus = (status: RuntimeAdapterDashboardOperationalStatus): string[] => (
    rows
      .filter((row) => row.status === status)
      .map((row) => ('label' in row ? row.label : row.title))
  );

  return {
    nativeContract: 'ZavorthDashboardOperationalStates/v1',
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
  options: RuntimeAdapterDashboardLiveAssimilationOptions,
): ZavorthDashboardLiveAssimilationViewModel {
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
    nativeContract: 'ZavorthDashboardLiveAssimilationViewModel/v1',
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

export function createRuntimeAdapterDashboardLiveAssimilationFixtureSource(): RuntimeAdapterDashboardLiveAssimilationSource {
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

export function normalizeRuntimeAdapterDashboardLiveAssimilation<TRuntimeId extends string>(
  options: RuntimeAdapterDashboardLiveAssimilationOptions<TRuntimeId>,
): RuntimeAdapterDashboardLiveAssimilationNormalization {
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
    nativeContract: 'ZavorthDashboardLiveAssimilationBoundary/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'dashboard-live-assimilation-ready' : 'blocked',
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

export function normalizeRuntimeAdapterDashboardLiveAssimilationFixture(): RuntimeAdapterDashboardLiveAssimilationNormalization {
  return normalizeRuntimeAdapterDashboardLiveAssimilation({
    source: createRuntimeAdapterDashboardLiveAssimilationFixtureSource(),
    generatedAt: RUNTIME_ADAPTER_COMMAND_CENTER_LIVE_ASSIMILATION_NOW,
    runtimeId: RUNTIME_ADAPTER_COMMAND_CENTER_LIVE_ASSIMILATION_RUNTIME_ID,
    idPrefix: 'runtime-adapter-dashboard-live-assimilation',
  });
}
