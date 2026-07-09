import {
  createZavorthNativeCapabilityRegistryFixture,
  normalizeZavorthNativeCapabilityRegistryReplacementFixture,
} from './ZavorthNativeCapabilityRegistry.js';
import {
  normalizeExternalAgentZavorthControlLiveAssimilationFixture,
} from './ExternalAgentZavorthControlLiveAssimilation.js';
import {
  normalizeMessageTransportCapabilityDiscoveryFixture,
} from './ExternalAgentRealMessageTransportCapabilityDiscovery.js';
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
  ZavorthNativeCapabilityRegistry,
  ZavorthNativeCapabilityRegistryZavorthControlView,
  ZavorthNativeCapabilityRegistryReplacementNormalization,
} from './ZavorthNativeCapabilityRegistry.js';
import type {
  ZavorthControlEventView,
  ZavorthControlHealthStatusView,
  ZavorthControlLiveAssimilationViewModel,
  ZavorthControlMessageMetadataView,
  ZavorthControlRuntimeView,
  ZavorthControlSessionView,
  ZavorthControlSurfaceView,
  ExternalAgentZavorthControlLiveAssimilationNormalization,
  ExternalAgentZavorthControlOperationalStatus,
} from './ExternalAgentZavorthControlLiveAssimilation.js';
import type {
  ExternalExecutorLiveObservabilityProjectionNormalization,
} from './ExternalAgentExternalExecutorLiveObservabilityProjection.js';
import type {
  ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization,
} from './ExternalAgentExternalExecutorLiveReadOnlyBridgeBoundary.js';
import type {
  ExternalExecutorReadOnlyEventStreamAdapterNormalization,
} from './ExternalAgentExternalExecutorReadOnlyEventStreamAdapter.js';
import type {
  ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization,
} from './ExternalAgentExternalExecutorRealCapabilitySnapshotReadOnly.js';
import type {
  ExternalExecutorSessionHistoryReadOnlyBridgeNormalization,
} from './ExternalAgentExternalExecutorSessionHistoryReadOnlyBridge.js';
import type {
  ZavorthMessageTransportCapabilityDiscoveryNormalization,
} from './ExternalAgentRealMessageTransportCapabilityDiscovery.js';

export const ZAVORTH_NATIVE_ZAVORTH_CONTROL_VIEW_MODEL_REGISTRY_NOW = '2026-04-29T01:00:00.000Z' as const;
export const ZAVORTH_NATIVE_ZAVORTH_CONTROL_VIEW_MODEL_REGISTRY_RUNTIME_ID = 'zavorth-native-zavorthControl-view-model-registry' as const;

export type ZavorthNativeZavorthControlViewModelRegistryDecision =
  | 'blocked'
  | 'native-zavorthControl-view-model-registry-ready';

export type ZavorthNativeZavorthControlViewModelType =
  | 'capability'
  | 'channel'
  | 'event'
  | 'gateway-lifecycle'
  | 'health-status'
  | 'message-metadata'
  | 'plugin'
  | 'provider'
  | 'session'
  | 'transport-metadata';

export type ZavorthNativeZavorthControlViewModelProvenanceKind =
  | 'zavorthControl-assimilation'
  | 'event-stream-adapter'
  | 'live-observability-projection'
  | 'live-read-only-bridge'
  | 'native-capability-registry'
  | 'real-capability-snapshot'
  | 'session-history-bridge'
  | 'transport-discovery';

export type ZavorthNativeZavorthControlViewModelProvenance = {
  nativeContract: 'ZavorthNativeZavorthControlViewModelProvenance/v1';
  sourceKind: ZavorthNativeZavorthControlViewModelProvenanceKind;
  sourceEvidenceIds: string[];
  sourceRuntimeNameInternal: 'ExternalExecutor';
  sourceRuntimePublicIdentity: false;
  sourceStructuresPublic: false;
  sourceIdsEvidenceOnly: true;
  redacted: true;
};

export type ZavorthNativeZavorthControlViewModelRecord = {
  nativeContract: 'ZavorthNativeZavorthControlViewModelRecord/v1';
  id: string;
  viewType: ZavorthNativeZavorthControlViewModelType;
  label: string;
  summary: string;
  status: ExternalAgentZavorthControlOperationalStatus;
  capabilityRegistryEntryId?: string;
  sourceViewContract: string;
  provenance: ZavorthNativeZavorthControlViewModelProvenance;
  readOnly: true;
  zavorthControlConsumable: true;
  runtimeExternalExecutorRequiredForZavorthControlViewLookup: false;
  runtimeExternalExecutorRequiredForZavorthControlRender: false;
  runtimeExternalExecutorRequiredForCapabilityLookup: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  sourceModuleCopied: false;
  adapterRemovalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeZavorthControlRenderedViewModel = {
  nativeContract: 'ZavorthNativeZavorthControlRenderedViewModel/v1';
  id: string;
  viewType: ZavorthNativeZavorthControlViewModelType;
  label: string;
  summary: string;
  status: ExternalAgentZavorthControlOperationalStatus;
  capabilityRegistryEntryId?: string;
  hasInternalProvenance: true;
  sourceIdentityPublic: false;
  sourceStructuresPublic: false;
  sourceIdsEvidenceOnly: true;
  readOnly: true;
  executionAuthority: false;
};

export type ZavorthNativeZavorthControlRenderResult = {
  nativeContract: 'ZavorthNativeZavorthControlRenderResult/v1';
  generatedAt: string;
  rows: ZavorthNativeZavorthControlRenderedViewModel[];
  runtimeExternalExecutorRequiredForZavorthControlRender: false;
  runtimeExternalExecutorRequiredForZavorthControlViewLookup: false;
  runtimeExternalExecutorRequiredForCapabilityLookup: false;
  sourceIdentityPublic: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeZavorthControlViewModelRegistryFilter = {
  viewType?: ZavorthNativeZavorthControlViewModelType;
  status?: ExternalAgentZavorthControlOperationalStatus;
  degradedOrUnavailable?: boolean;
  provenanceSourceKind?: ZavorthNativeZavorthControlViewModelProvenanceKind;
};

export type ZavorthNativeZavorthControlViewModelLookupResult = {
  nativeContract: 'ZavorthNativeZavorthControlViewModelLookupResult/v1';
  lookupId: string;
  found: boolean;
  record?: ZavorthNativeZavorthControlViewModelRecord;
  runtimeExternalExecutorRequiredForZavorthControlViewLookup: false;
  runtimeExternalExecutorRequiredForZavorthControlRender: false;
  sourceRuntimeAuthority: false;
};

export type ZavorthNativeZavorthControlViewModelRegistrySnapshot = {
  nativeContract: 'ZavorthNativeZavorthControlViewModelRegistry/v1';
  id: string;
  generatedAt: string;
  records: ZavorthNativeZavorthControlViewModelRecord[];
  indexes: {
    byType: Record<ZavorthNativeZavorthControlViewModelType, number>;
    byStatus: Record<ExternalAgentZavorthControlOperationalStatus, number>;
    degradedOrUnavailableIds: string[];
  };
  sourceArtifactsConsumed: {
    realCapabilitySnapshot: 'docs/real-capability-snapshot-read-only.md';
    liveReadOnlyBridge: 'docs/external-executor-live-read-only-bridge-boundary.md';
    observabilityProjection: 'docs/external-executor-live-observability-projection.md';
    eventStreamAdapter: 'docs/external-executor-read-only-event-stream-adapter.md';
    sessionHistoryBridge: 'docs/external-executor-session-history-read-only-bridge.md';
    zavorthControlAssimilation: 'docs/control-live-assimilation.md';
    transportDiscovery: 'docs/real-message-transport-capability-discovery.md';
    nativeCapabilityRegistry: 'docs/first-native-capability-registry-replacement-slice.md';
  };
  runtimeExternalExecutorRequiredForZavorthControlViewLookup: false;
  runtimeExternalExecutorRequiredForZavorthControlRender: false;
  runtimeExternalExecutorRequiredForCapabilityLookup: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  nativeReplacementAuthorizedForZavorthControlViewModels: true;
  adapterRemovalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeZavorthControlViewModelRegistryExecutionGate = {
  runtimeExternalExecutorRequiredForZavorthControlViewLookup: false;
  runtimeExternalExecutorRequiredForZavorthControlRender: false;
  runtimeExternalExecutorRequiredForCapabilityLookup: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorizedForZavorthControlViewModels: true;
  adapterRemovalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeZavorthControlViewModelRegistryIntegration = {
  nativeContract: 'ZavorthNativeZavorthControlViewModelRegistryIntegration/v1';
  zavorthControlAdapterPrepared: true;
  zavorthControlConsumesNativeRegistry: true;
  capabilityCardsFromNativeCapabilityRegistry: true;
  transportMetadataFromNativeCapabilityRegistry: true;
  liveExternalExecutorOptionalForRefreshOnly: true;
  runtimeExternalExecutorRequiredForZavorthControlRender: false;
  publicSourceIdentityExposed: false;
};

export type ZavorthNativeZavorthControlViewModelRegistrySource = {
  realCapabilitySnapshot: ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization;
  liveReadOnlyBridge: ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization;
  observabilityProjection: ExternalExecutorLiveObservabilityProjectionNormalization;
  eventStreamAdapter: ExternalExecutorReadOnlyEventStreamAdapterNormalization;
  sessionHistoryBridge: ExternalExecutorSessionHistoryReadOnlyBridgeNormalization;
  zavorthControlAssimilation: ExternalAgentZavorthControlLiveAssimilationNormalization;
  transportDiscovery: ZavorthMessageTransportCapabilityDiscoveryNormalization;
  nativeCapabilityRegistry: ZavorthNativeCapabilityRegistryReplacementNormalization;
  capabilityRegistry: ZavorthNativeCapabilityRegistry;
  mutableLiveLookupAttempted: false;
  gatewayLiveCalledDuringRender: false;
  externalAdapterInvokedForRender: false;
};

export type ZavorthNativeZavorthControlViewModelRegistryNormalization = {
  nativeContract: 'ZavorthNativeZavorthControlViewModelRegistrySlice/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthNativeZavorthControlViewModelRegistryDecision;
  status: 'native-zavorthControl-view-model-registry-ready' | 'blocked';
  sourceReadiness: {
    realCapabilitySnapshot: ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization['decision'];
    liveReadOnlyBridge: ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization['decision'];
    observabilityProjection: ExternalExecutorLiveObservabilityProjectionNormalization['decision'];
    eventStreamAdapter: ExternalExecutorReadOnlyEventStreamAdapterNormalization['decision'];
    sessionHistoryBridge: ExternalExecutorSessionHistoryReadOnlyBridgeNormalization['decision'];
    zavorthControlAssimilation: ExternalAgentZavorthControlLiveAssimilationNormalization['decision'];
    transportDiscovery: ZavorthMessageTransportCapabilityDiscoveryNormalization['decision'];
    nativeCapabilityRegistry: ZavorthNativeCapabilityRegistryReplacementNormalization['decision'];
  };
  registry: ZavorthNativeZavorthControlViewModelRegistrySnapshot;
  integration: ZavorthNativeZavorthControlViewModelRegistryIntegration;
  dependencyReductionProof: {
    renderWorksWithoutLiveExternalExecutor: true;
    lookupWorksWithoutLiveExternalExecutor: true;
    filterWorksWithoutLiveExternalExecutor: true;
    capabilityLookupUses185Registry: true;
    degradedUnavailablePreserved: true;
  };
  executionGate: ZavorthNativeZavorthControlViewModelRegistryExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    sourceIdentityPublic: false;
    sourceStructuresPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-zavorthControl-native-consistency-or-native-refresh-gate';
};

export type ZavorthNativeZavorthControlViewModelRegistryOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  source: ZavorthNativeZavorthControlViewModelRegistrySource;
};

function emptyTypeIndex(): Record<ZavorthNativeZavorthControlViewModelType, number> {
  return {
    capability: 0,
    channel: 0,
    event: 0,
    'gateway-lifecycle': 0,
    'health-status': 0,
    'message-metadata': 0,
    plugin: 0,
    provider: 0,
    session: 0,
    'transport-metadata': 0,
  };
}

function emptyStatusIndex(): Record<ExternalAgentZavorthControlOperationalStatus, number> {
  return {
    blocked: 0,
    degraded: 0,
    ready: 0,
    unavailable: 0,
    unknown: 0,
  };
}

function provenance(
  sourceKind: ZavorthNativeZavorthControlViewModelProvenanceKind,
  sourceEvidenceIds: string[],
): ZavorthNativeZavorthControlViewModelProvenance {
  return {
    nativeContract: 'ZavorthNativeZavorthControlViewModelProvenance/v1',
    sourceKind,
    sourceEvidenceIds,
    sourceRuntimeNameInternal: 'ExternalExecutor',
    sourceRuntimePublicIdentity: false,
    sourceStructuresPublic: false,
    sourceIdsEvidenceOnly: true,
    redacted: true,
  };
}

function record(
  idPrefix: string,
  index: number,
  viewType: ZavorthNativeZavorthControlViewModelType,
  label: string,
  summary: string,
  status: ExternalAgentZavorthControlOperationalStatus,
  sourceViewContract: string,
  provenanceKind: ZavorthNativeZavorthControlViewModelProvenanceKind,
  sourceEvidenceIds: string[],
  capabilityRegistryEntryId?: string,
): ZavorthNativeZavorthControlViewModelRecord {
  return {
    nativeContract: 'ZavorthNativeZavorthControlViewModelRecord/v1',
    id: `${idPrefix}:view-${index + 1}-${viewType}`,
    viewType,
    label,
    summary,
    status,
    ...(capabilityRegistryEntryId ? { capabilityRegistryEntryId } : {}),
    sourceViewContract,
    provenance: provenance(provenanceKind, sourceEvidenceIds),
    readOnly: true,
    zavorthControlConsumable: true,
    runtimeExternalExecutorRequiredForZavorthControlViewLookup: false,
    runtimeExternalExecutorRequiredForZavorthControlRender: false,
    runtimeExternalExecutorRequiredForCapabilityLookup: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    sourceModuleCopied: false,
    adapterRemovalAllowed: false,
    rawSecretSerialized: false,
  };
}

function viewTypeForCapability(view: ZavorthNativeCapabilityRegistryZavorthControlView): ZavorthNativeZavorthControlViewModelType {
  if (view.kind === 'plugin') {
    return 'plugin';
  }
  if (view.kind === 'provider') {
    return 'provider';
  }
  if (view.kind === 'channel') {
    return 'channel';
  }
  if (view.kind === 'gateway-method') {
    return 'gateway-lifecycle';
  }
  if (view.kind === 'message-transport') {
    return 'transport-metadata';
  }
  if (view.kind === 'session-history') {
    return 'session';
  }
  return 'capability';
}

function capabilitySummary(view: ZavorthNativeCapabilityRegistryZavorthControlView): string {
  return `Native capability registry card; ${view.authorityDisposition} authority disposition.`;
}

function recordsFromCapabilityRegistry(
  idPrefix: string,
  startIndex: number,
  capabilityRegistry: ZavorthNativeCapabilityRegistry,
): ZavorthNativeZavorthControlViewModelRecord[] {
  return capabilityRegistry.toZavorthControlViews().map((view, index) => (
    record(
      idPrefix,
      startIndex + index,
      viewTypeForCapability(view),
      view.label,
      capabilitySummary(view),
      view.status,
      view.nativeContract,
      'native-capability-registry',
      [view.registryEntryId, 'docs/first-native-capability-registry-replacement-slice.md'],
      view.registryEntryId,
    )
  ));
}

function recordsFromHealth(
  idPrefix: string,
  startIndex: number,
  runtime: ZavorthControlRuntimeView,
  health: ZavorthControlHealthStatusView,
): ZavorthNativeZavorthControlViewModelRecord[] {
  return [
    record(
      idPrefix,
      startIndex,
      'health-status',
      'Runtime status',
      'Runtime status projected from authenticated read-only evidence.',
      runtime.status,
      runtime.nativeContract,
      'zavorthControl-assimilation',
      [runtime.id, 'docs/control-live-assimilation.md'],
    ),
    record(
      idPrefix,
      startIndex + 1,
      'health-status',
      health.label,
      health.summary,
      health.status,
      health.nativeContract,
      'live-observability-projection',
      [health.id, 'docs/external-executor-live-observability-projection.md'],
    ),
  ];
}

function recordsFromEvents(
  idPrefix: string,
  startIndex: number,
  events: ZavorthControlEventView[],
): ZavorthNativeZavorthControlViewModelRecord[] {
  return events.map((event, index) => (
    record(
      idPrefix,
      startIndex + index,
      'event',
      event.title,
      `Read-only event metadata: ${event.kind}.`,
      event.status,
      event.nativeContract,
      'event-stream-adapter',
      [event.id, 'docs/external-executor-read-only-event-stream-adapter.md'],
    )
  ));
}

function recordsFromSessions(
  idPrefix: string,
  startIndex: number,
  sessions: ZavorthControlSessionView[],
): ZavorthNativeZavorthControlViewModelRecord[] {
  return sessions.map((session, index) => (
    record(
      idPrefix,
      startIndex + index,
      'session',
      session.label,
      `Read-only session metadata; message count ${session.messageCount}.`,
      session.status,
      session.nativeContract,
      'session-history-bridge',
      [session.id, 'docs/external-executor-session-history-read-only-bridge.md'],
    )
  ));
}

function recordsFromMessages(
  idPrefix: string,
  startIndex: number,
  messages: ZavorthControlMessageMetadataView[],
): ZavorthNativeZavorthControlViewModelRecord[] {
  return messages.map((message, index) => (
    record(
      idPrefix,
      startIndex + index,
      'message-metadata',
      `Message metadata ${index + 1}`,
      `Message content state: ${message.contentState}; preview is redacted or unavailable.`,
      message.contentState === 'unavailable' ? 'unavailable' : 'ready',
      message.nativeContract,
      'session-history-bridge',
      [message.id, message.sessionViewId, 'docs/external-executor-session-history-read-only-bridge.md'],
    )
  ));
}

function recordsFromSurfaces(
  idPrefix: string,
  startIndex: number,
  viewType: ZavorthNativeZavorthControlViewModelType,
  surfaces: ZavorthControlSurfaceView[],
  provenanceKind: ZavorthNativeZavorthControlViewModelProvenanceKind,
): ZavorthNativeZavorthControlViewModelRecord[] {
  return surfaces.map((surface, index) => (
    record(
      idPrefix,
      startIndex + index,
      viewType,
      surface.label,
      `Surface authority disposition: ${surface.authorityDisposition}.`,
      surface.status,
      surface.nativeContract,
      provenanceKind,
      [surface.id, 'docs/control-live-assimilation.md'],
    )
  ));
}

function buildRecords(
  idPrefix: string,
  source: ZavorthNativeZavorthControlViewModelRegistrySource,
): ZavorthNativeZavorthControlViewModelRecord[] {
  const viewModel: ZavorthControlLiveAssimilationViewModel = source.zavorthControlAssimilation.viewModel;
  const groups = [
    recordsFromCapabilityRegistry(idPrefix, 0, source.capabilityRegistry),
    recordsFromHealth(idPrefix, 1000, viewModel.runtime, viewModel.health),
    recordsFromEvents(idPrefix, 2000, viewModel.events),
    recordsFromSessions(idPrefix, 3000, viewModel.sessions),
    recordsFromMessages(idPrefix, 4000, viewModel.messages),
    recordsFromSurfaces(idPrefix, 5000, 'channel', viewModel.channels, 'zavorthControl-assimilation'),
    recordsFromSurfaces(idPrefix, 6000, 'plugin', viewModel.plugins, 'zavorthControl-assimilation'),
    recordsFromSurfaces(idPrefix, 7000, 'provider', viewModel.providers, 'zavorthControl-assimilation'),
    recordsFromSurfaces(idPrefix, 8000, 'gateway-lifecycle', viewModel.gatewayLifecycle, 'live-read-only-bridge'),
  ];

  return groups.flat();
}

function byTypeIndex(records: ZavorthNativeZavorthControlViewModelRecord[]): Record<ZavorthNativeZavorthControlViewModelType, number> {
  const index = emptyTypeIndex();
  records.forEach((entry) => {
    index[entry.viewType] += 1;
  });
  return index;
}

function byStatusIndex(records: ZavorthNativeZavorthControlViewModelRecord[]): Record<ExternalAgentZavorthControlOperationalStatus, number> {
  const index = emptyStatusIndex();
  records.forEach((entry) => {
    index[entry.status] += 1;
  });
  return index;
}

function degradedOrUnavailableIds(records: ZavorthNativeZavorthControlViewModelRecord[]): string[] {
  return records
    .filter((entry) => entry.status === 'degraded' || entry.status === 'unavailable')
    .map((entry) => entry.id);
}

function sourceReady(source: ZavorthNativeZavorthControlViewModelRegistrySource): boolean {
  return (
    source.realCapabilitySnapshot.decision === 'real-capability-snapshot-read-only-ok' &&
    source.liveReadOnlyBridge.decision === 'external-executor-live-read-only-bridge-boundary-ready' &&
    source.observabilityProjection.decision === 'external-executor-live-observability-projection-ready' &&
    source.eventStreamAdapter.decision === 'external-executor-read-only-event-stream-adapter-ready' &&
    source.sessionHistoryBridge.decision === 'external-executor-session-history-read-only-bridge-ready' &&
    source.zavorthControlAssimilation.decision === 'zavorthControl-live-assimilation-ready' &&
    source.transportDiscovery.decision === 'real-message-transport-capability-discovery-ready' &&
    source.nativeCapabilityRegistry.decision === 'native-capability-registry-replacement-ready' &&
    !source.mutableLiveLookupAttempted &&
    !source.gatewayLiveCalledDuringRender &&
    !source.externalAdapterInvokedForRender
  );
}

function buildSnapshot(
  options: ZavorthNativeZavorthControlViewModelRegistryOptions,
): ZavorthNativeZavorthControlViewModelRegistrySnapshot {
  const records = buildRecords(options.idPrefix, options.source);

  return {
    nativeContract: 'ZavorthNativeZavorthControlViewModelRegistry/v1',
    id: `${options.idPrefix}:registry`,
    generatedAt: options.generatedAt,
    records,
    indexes: {
      byType: byTypeIndex(records),
      byStatus: byStatusIndex(records),
      degradedOrUnavailableIds: degradedOrUnavailableIds(records),
    },
    sourceArtifactsConsumed: {
      realCapabilitySnapshot: 'docs/real-capability-snapshot-read-only.md',
      liveReadOnlyBridge: 'docs/external-executor-live-read-only-bridge-boundary.md',
      observabilityProjection: 'docs/external-executor-live-observability-projection.md',
      eventStreamAdapter: 'docs/external-executor-read-only-event-stream-adapter.md',
      sessionHistoryBridge: 'docs/external-executor-session-history-read-only-bridge.md',
      zavorthControlAssimilation: 'docs/control-live-assimilation.md',
      transportDiscovery: 'docs/real-message-transport-capability-discovery.md',
      nativeCapabilityRegistry: 'docs/first-native-capability-registry-replacement-slice.md',
    },
    runtimeExternalExecutorRequiredForZavorthControlViewLookup: false,
    runtimeExternalExecutorRequiredForZavorthControlRender: false,
    runtimeExternalExecutorRequiredForCapabilityLookup: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    nativeReplacementAuthorizedForZavorthControlViewModels: true,
    adapterRemovalAllowed: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthNativeZavorthControlViewModelRegistryExecutionGate {
  return {
    runtimeExternalExecutorRequiredForZavorthControlViewLookup: false,
    runtimeExternalExecutorRequiredForZavorthControlRender: false,
    runtimeExternalExecutorRequiredForCapabilityLookup: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorizedForZavorthControlViewModels: true,
    adapterRemovalAllowed: false,
    rawSecretSerialized: false,
  };
}

function renderedViewModel(record: ZavorthNativeZavorthControlViewModelRecord): ZavorthNativeZavorthControlRenderedViewModel {
  return {
    nativeContract: 'ZavorthNativeZavorthControlRenderedViewModel/v1',
    id: record.id,
    viewType: record.viewType,
    label: record.label,
    summary: record.summary,
    status: record.status,
    ...(record.capabilityRegistryEntryId ? { capabilityRegistryEntryId: record.capabilityRegistryEntryId } : {}),
    hasInternalProvenance: true,
    sourceIdentityPublic: false,
    sourceStructuresPublic: false,
    sourceIdsEvidenceOnly: true,
    readOnly: true,
    executionAuthority: false,
  };
}

function matchesFilter(
  record: ZavorthNativeZavorthControlViewModelRecord,
  filter: ZavorthNativeZavorthControlViewModelRegistryFilter,
): boolean {
  if (filter.viewType && record.viewType !== filter.viewType) {
    return false;
  }
  if (filter.status && record.status !== filter.status) {
    return false;
  }
  if (filter.degradedOrUnavailable && record.status !== 'degraded' && record.status !== 'unavailable') {
    return false;
  }
  if (filter.provenanceSourceKind && record.provenance.sourceKind !== filter.provenanceSourceKind) {
    return false;
  }
  return true;
}

export class ZavorthNativeZavorthControlViewModelRegistry {
  private readonly recordsById: Map<string, ZavorthNativeZavorthControlViewModelRecord>;

  public constructor(public readonly snapshot: ZavorthNativeZavorthControlViewModelRegistrySnapshot) {
    this.recordsById = new Map(snapshot.records.map((entry) => [entry.id, entry]));
  }

  public list(filter: ZavorthNativeZavorthControlViewModelRegistryFilter = {}): ZavorthNativeZavorthControlViewModelRecord[] {
    return this.snapshot.records.filter((entry) => matchesFilter(entry, filter));
  }

  public lookup(id: string): ZavorthNativeZavorthControlViewModelLookupResult {
    const record = this.recordsById.get(id);

    return {
      nativeContract: 'ZavorthNativeZavorthControlViewModelLookupResult/v1',
      lookupId: id,
      found: Boolean(record),
      ...(record ? { record } : {}),
      runtimeExternalExecutorRequiredForZavorthControlViewLookup: false,
      runtimeExternalExecutorRequiredForZavorthControlRender: false,
      sourceRuntimeAuthority: false,
    };
  }

  public render(filter: ZavorthNativeZavorthControlViewModelRegistryFilter = {}): ZavorthNativeZavorthControlRenderResult {
    return {
      nativeContract: 'ZavorthNativeZavorthControlRenderResult/v1',
      generatedAt: this.snapshot.generatedAt,
      rows: this.list(filter).map(renderedViewModel),
      runtimeExternalExecutorRequiredForZavorthControlRender: false,
      runtimeExternalExecutorRequiredForZavorthControlViewLookup: false,
      runtimeExternalExecutorRequiredForCapabilityLookup: false,
      sourceIdentityPublic: false,
      rawSecretSerialized: false,
    };
  }
}

export function createZavorthNativeZavorthControlViewModelRegistryFixtureSource(): ZavorthNativeZavorthControlViewModelRegistrySource {
  return {
    realCapabilitySnapshot: normalizeExternalExecutorRealCapabilitySnapshotReadOnlyFixture(),
    liveReadOnlyBridge: normalizeExternalExecutorLiveReadOnlyBridgeBoundaryFixture(),
    observabilityProjection: normalizeExternalExecutorLiveObservabilityProjectionFixture(),
    eventStreamAdapter: normalizeExternalExecutorReadOnlyEventStreamAdapterFixture(),
    sessionHistoryBridge: normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture(),
    zavorthControlAssimilation: normalizeExternalAgentZavorthControlLiveAssimilationFixture(),
    transportDiscovery: normalizeMessageTransportCapabilityDiscoveryFixture(),
    nativeCapabilityRegistry: normalizeZavorthNativeCapabilityRegistryReplacementFixture(),
    capabilityRegistry: createZavorthNativeCapabilityRegistryFixture(),
    mutableLiveLookupAttempted: false,
    gatewayLiveCalledDuringRender: false,
    externalAdapterInvokedForRender: false,
  };
}

export function normalizeZavorthNativeZavorthControlViewModelRegistry<TRuntimeId extends string>(
  options: ZavorthNativeZavorthControlViewModelRegistryOptions<TRuntimeId>,
): ZavorthNativeZavorthControlViewModelRegistryNormalization {
  const registry = buildSnapshot(options);
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    registry.records.length > 0 &&
    registry.indexes.byType.capability > 0 &&
    registry.indexes.byType['health-status'] > 0 &&
    registry.indexes.byType.event > 0 &&
    registry.indexes.byType.session > 0 &&
    registry.indexes.byType['message-metadata'] > 0 &&
    registry.indexes.byType['transport-metadata'] > 0 &&
    registry.indexes.degradedOrUnavailableIds.length > 0;

  return {
    nativeContract: 'ZavorthNativeZavorthControlViewModelRegistrySlice/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'native-zavorthControl-view-model-registry-ready' : 'blocked',
    status: ready ? 'native-zavorthControl-view-model-registry-ready' : 'blocked',
    sourceReadiness: {
      realCapabilitySnapshot: options.source.realCapabilitySnapshot.decision,
      liveReadOnlyBridge: options.source.liveReadOnlyBridge.decision,
      observabilityProjection: options.source.observabilityProjection.decision,
      eventStreamAdapter: options.source.eventStreamAdapter.decision,
      sessionHistoryBridge: options.source.sessionHistoryBridge.decision,
      zavorthControlAssimilation: options.source.zavorthControlAssimilation.decision,
      transportDiscovery: options.source.transportDiscovery.decision,
      nativeCapabilityRegistry: options.source.nativeCapabilityRegistry.decision,
    },
    registry,
    integration: {
      nativeContract: 'ZavorthNativeZavorthControlViewModelRegistryIntegration/v1',
      zavorthControlAdapterPrepared: true,
      zavorthControlConsumesNativeRegistry: true,
      capabilityCardsFromNativeCapabilityRegistry: true,
      transportMetadataFromNativeCapabilityRegistry: true,
      liveExternalExecutorOptionalForRefreshOnly: true,
      runtimeExternalExecutorRequiredForZavorthControlRender: false,
      publicSourceIdentityExposed: false,
    },
    dependencyReductionProof: {
      renderWorksWithoutLiveExternalExecutor: true,
      lookupWorksWithoutLiveExternalExecutor: true,
      filterWorksWithoutLiveExternalExecutor: true,
      capabilityLookupUses185Registry: true,
      degradedUnavailablePreserved: true,
    },
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-zavorthControl-native-consistency-or-native-refresh-gate',
  };
}

export function normalizeZavorthNativeZavorthControlViewModelRegistryFixture(): ZavorthNativeZavorthControlViewModelRegistryNormalization {
  return normalizeZavorthNativeZavorthControlViewModelRegistry({
    generatedAt: ZAVORTH_NATIVE_ZAVORTH_CONTROL_VIEW_MODEL_REGISTRY_NOW,
    runtimeId: ZAVORTH_NATIVE_ZAVORTH_CONTROL_VIEW_MODEL_REGISTRY_RUNTIME_ID,
    idPrefix: 'zavorth-native-zavorthControl-view-model-registry',
    source: createZavorthNativeZavorthControlViewModelRegistryFixtureSource(),
  });
}

export function createZavorthNativeZavorthControlViewModelRegistryFixture(): ZavorthNativeZavorthControlViewModelRegistry {
  return new ZavorthNativeZavorthControlViewModelRegistry(
    normalizeZavorthNativeZavorthControlViewModelRegistryFixture().registry,
  );
}
