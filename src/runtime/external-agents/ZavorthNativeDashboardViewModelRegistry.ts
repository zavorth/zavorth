import {
  createZavorthNativeCapabilityRegistryFixture,
  normalizeZavorthNativeCapabilityRegistryReplacementFixture,
} from './ZavorthNativeCapabilityRegistry.js';
import {
  normalizeExternalAgentCommandCenterLiveAssimilationFixture,
} from './ExternalAgentCommandCenterLiveAssimilation.js';
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
  ZavorthNativeCapabilityRegistryCommandCenterView,
  ZavorthNativeCapabilityRegistryReplacementNormalization,
} from './ZavorthNativeCapabilityRegistry.js';
import type {
  ZavorthCommandCenterEventView,
  ZavorthCommandCenterHealthStatusView,
  ZavorthCommandCenterLiveAssimilationViewModel,
  ZavorthCommandCenterMessageMetadataView,
  ZavorthCommandCenterRuntimeView,
  ZavorthCommandCenterSessionView,
  ZavorthCommandCenterSurfaceView,
  ExternalAgentCommandCenterLiveAssimilationNormalization,
  ExternalAgentCommandCenterOperationalStatus,
} from './ExternalAgentCommandCenterLiveAssimilation.js';
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

export const ZAVORTH_NATIVE_DASHBOARD_VIEW_MODEL_REGISTRY_NOW = '2026-04-29T01:00:00.000Z' as const;
export const ZAVORTH_NATIVE_DASHBOARD_VIEW_MODEL_REGISTRY_RUNTIME_ID = 'zavorth-native-dashboard-view-model-registry' as const;

export type ZavorthNativeDashboardViewModelRegistryDecision =
  | 'blocked'
  | 'native-dashboard-view-model-registry-ready';

export type ZavorthNativeDashboardViewModelType =
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

export type ZavorthNativeDashboardViewModelProvenanceKind =
  | 'command-center-assimilation'
  | 'event-stream-adapter'
  | 'live-observability-projection'
  | 'live-read-only-bridge'
  | 'native-capability-registry'
  | 'real-capability-snapshot'
  | 'session-history-bridge'
  | 'transport-discovery';

export type ZavorthNativeDashboardViewModelProvenance = {
  nativeContract: 'ZavorthNativeDashboardViewModelProvenance/v1';
  sourceKind: ZavorthNativeDashboardViewModelProvenanceKind;
  sourceEvidenceIds: string[];
  sourceRuntimeNameInternal: 'ExternalExecutor';
  sourceRuntimePublicIdentity: false;
  sourceStructuresPublic: false;
  sourceIdsEvidenceOnly: true;
  redacted: true;
};

export type ZavorthNativeDashboardViewModelRecord = {
  nativeContract: 'ZavorthNativeDashboardViewModelRecord/v1';
  id: string;
  viewType: ZavorthNativeDashboardViewModelType;
  label: string;
  summary: string;
  status: ExternalAgentCommandCenterOperationalStatus;
  capabilityRegistryEntryId?: string;
  sourceViewContract: string;
  provenance: ZavorthNativeDashboardViewModelProvenance;
  readOnly: true;
  commandCenterConsumable: true;
  runtimeExternalExecutorRequiredForDashboardViewLookup: false;
  runtimeExternalExecutorRequiredForDashboardRender: false;
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

export type ZavorthNativeDashboardRenderedViewModel = {
  nativeContract: 'ZavorthNativeDashboardRenderedViewModel/v1';
  id: string;
  viewType: ZavorthNativeDashboardViewModelType;
  label: string;
  summary: string;
  status: ExternalAgentCommandCenterOperationalStatus;
  capabilityRegistryEntryId?: string;
  hasInternalProvenance: true;
  sourceIdentityPublic: false;
  sourceStructuresPublic: false;
  sourceIdsEvidenceOnly: true;
  readOnly: true;
  executionAuthority: false;
};

export type ZavorthNativeDashboardRenderResult = {
  nativeContract: 'ZavorthNativeDashboardRenderResult/v1';
  generatedAt: string;
  rows: ZavorthNativeDashboardRenderedViewModel[];
  runtimeExternalExecutorRequiredForDashboardRender: false;
  runtimeExternalExecutorRequiredForDashboardViewLookup: false;
  runtimeExternalExecutorRequiredForCapabilityLookup: false;
  sourceIdentityPublic: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeDashboardViewModelRegistryFilter = {
  viewType?: ZavorthNativeDashboardViewModelType;
  status?: ExternalAgentCommandCenterOperationalStatus;
  degradedOrUnavailable?: boolean;
  provenanceSourceKind?: ZavorthNativeDashboardViewModelProvenanceKind;
};

export type ZavorthNativeDashboardViewModelLookupResult = {
  nativeContract: 'ZavorthNativeDashboardViewModelLookupResult/v1';
  lookupId: string;
  found: boolean;
  record?: ZavorthNativeDashboardViewModelRecord;
  runtimeExternalExecutorRequiredForDashboardViewLookup: false;
  runtimeExternalExecutorRequiredForDashboardRender: false;
  sourceRuntimeAuthority: false;
};

export type ZavorthNativeDashboardViewModelRegistrySnapshot = {
  nativeContract: 'ZavorthNativeDashboardViewModelRegistry/v1';
  id: string;
  generatedAt: string;
  records: ZavorthNativeDashboardViewModelRecord[];
  indexes: {
    byType: Record<ZavorthNativeDashboardViewModelType, number>;
    byStatus: Record<ExternalAgentCommandCenterOperationalStatus, number>;
    degradedOrUnavailableIds: string[];
  };
  sourceArtifactsConsumed: {
    realCapabilitySnapshot: 'docs/real-capability-snapshot-read-only.md';
    liveReadOnlyBridge: 'docs/external-executor-live-read-only-bridge-boundary.md';
    observabilityProjection: 'docs/external-executor-live-observability-projection.md';
    eventStreamAdapter: 'docs/external-executor-read-only-event-stream-adapter.md';
    sessionHistoryBridge: 'docs/external-executor-session-history-read-only-bridge.md';
    commandCenterAssimilation: 'docs/command-center-live-assimilation.md';
    transportDiscovery: 'docs/real-message-transport-capability-discovery.md';
    nativeCapabilityRegistry: 'docs/first-native-capability-registry-replacement-slice.md';
  };
  runtimeExternalExecutorRequiredForDashboardViewLookup: false;
  runtimeExternalExecutorRequiredForDashboardRender: false;
  runtimeExternalExecutorRequiredForCapabilityLookup: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  nativeReplacementAuthorizedForDashboardViewModels: true;
  adapterRemovalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeDashboardViewModelRegistryExecutionGate = {
  runtimeExternalExecutorRequiredForDashboardViewLookup: false;
  runtimeExternalExecutorRequiredForDashboardRender: false;
  runtimeExternalExecutorRequiredForCapabilityLookup: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorizedForDashboardViewModels: true;
  adapterRemovalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeDashboardViewModelRegistryIntegration = {
  nativeContract: 'ZavorthNativeDashboardViewModelRegistryIntegration/v1';
  commandCenterAdapterPrepared: true;
  commandCenterConsumesNativeRegistry: true;
  capabilityCardsFromNativeCapabilityRegistry: true;
  transportMetadataFromNativeCapabilityRegistry: true;
  liveExternalExecutorOptionalForRefreshOnly: true;
  runtimeExternalExecutorRequiredForDashboardRender: false;
  publicSourceIdentityExposed: false;
};

export type ZavorthNativeDashboardViewModelRegistrySource = {
  realCapabilitySnapshot: ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization;
  liveReadOnlyBridge: ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization;
  observabilityProjection: ExternalExecutorLiveObservabilityProjectionNormalization;
  eventStreamAdapter: ExternalExecutorReadOnlyEventStreamAdapterNormalization;
  sessionHistoryBridge: ExternalExecutorSessionHistoryReadOnlyBridgeNormalization;
  commandCenterAssimilation: ExternalAgentCommandCenterLiveAssimilationNormalization;
  transportDiscovery: ZavorthMessageTransportCapabilityDiscoveryNormalization;
  nativeCapabilityRegistry: ZavorthNativeCapabilityRegistryReplacementNormalization;
  capabilityRegistry: ZavorthNativeCapabilityRegistry;
  mutableLiveLookupAttempted: false;
  gatewayLiveCalledDuringRender: false;
  externalAdapterInvokedForRender: false;
};

export type ZavorthNativeDashboardViewModelRegistryNormalization = {
  nativeContract: 'ZavorthNativeDashboardViewModelRegistrySlice/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthNativeDashboardViewModelRegistryDecision;
  status: 'native-dashboard-view-model-registry-ready' | 'blocked';
  sourceReadiness: {
    realCapabilitySnapshot: ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization['decision'];
    liveReadOnlyBridge: ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization['decision'];
    observabilityProjection: ExternalExecutorLiveObservabilityProjectionNormalization['decision'];
    eventStreamAdapter: ExternalExecutorReadOnlyEventStreamAdapterNormalization['decision'];
    sessionHistoryBridge: ExternalExecutorSessionHistoryReadOnlyBridgeNormalization['decision'];
    commandCenterAssimilation: ExternalAgentCommandCenterLiveAssimilationNormalization['decision'];
    transportDiscovery: ZavorthMessageTransportCapabilityDiscoveryNormalization['decision'];
    nativeCapabilityRegistry: ZavorthNativeCapabilityRegistryReplacementNormalization['decision'];
  };
  registry: ZavorthNativeDashboardViewModelRegistrySnapshot;
  integration: ZavorthNativeDashboardViewModelRegistryIntegration;
  dependencyReductionProof: {
    renderWorksWithoutLiveExternalExecutor: true;
    lookupWorksWithoutLiveExternalExecutor: true;
    filterWorksWithoutLiveExternalExecutor: true;
    capabilityLookupUses185Registry: true;
    degradedUnavailablePreserved: true;
  };
  executionGate: ZavorthNativeDashboardViewModelRegistryExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    sourceIdentityPublic: false;
    sourceStructuresPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-dashboard-native-parity-or-native-refresh-gate';
};

export type ZavorthNativeDashboardViewModelRegistryOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  source: ZavorthNativeDashboardViewModelRegistrySource;
};

function emptyTypeIndex(): Record<ZavorthNativeDashboardViewModelType, number> {
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

function emptyStatusIndex(): Record<ExternalAgentCommandCenterOperationalStatus, number> {
  return {
    blocked: 0,
    degraded: 0,
    ready: 0,
    unavailable: 0,
    unknown: 0,
  };
}

function provenance(
  sourceKind: ZavorthNativeDashboardViewModelProvenanceKind,
  sourceEvidenceIds: string[],
): ZavorthNativeDashboardViewModelProvenance {
  return {
    nativeContract: 'ZavorthNativeDashboardViewModelProvenance/v1',
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
  viewType: ZavorthNativeDashboardViewModelType,
  label: string,
  summary: string,
  status: ExternalAgentCommandCenterOperationalStatus,
  sourceViewContract: string,
  provenanceKind: ZavorthNativeDashboardViewModelProvenanceKind,
  sourceEvidenceIds: string[],
  capabilityRegistryEntryId?: string,
): ZavorthNativeDashboardViewModelRecord {
  return {
    nativeContract: 'ZavorthNativeDashboardViewModelRecord/v1',
    id: `${idPrefix}:view-${index + 1}-${viewType}`,
    viewType,
    label,
    summary,
    status,
    ...(capabilityRegistryEntryId ? { capabilityRegistryEntryId } : {}),
    sourceViewContract,
    provenance: provenance(provenanceKind, sourceEvidenceIds),
    readOnly: true,
    commandCenterConsumable: true,
    runtimeExternalExecutorRequiredForDashboardViewLookup: false,
    runtimeExternalExecutorRequiredForDashboardRender: false,
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

function viewTypeForCapability(view: ZavorthNativeCapabilityRegistryCommandCenterView): ZavorthNativeDashboardViewModelType {
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

function capabilitySummary(view: ZavorthNativeCapabilityRegistryCommandCenterView): string {
  return `Native capability registry card; ${view.authorityDisposition} authority disposition.`;
}

function recordsFromCapabilityRegistry(
  idPrefix: string,
  startIndex: number,
  capabilityRegistry: ZavorthNativeCapabilityRegistry,
): ZavorthNativeDashboardViewModelRecord[] {
  return capabilityRegistry.toCommandCenterViews().map((view, index) => (
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
  runtime: ZavorthCommandCenterRuntimeView,
  health: ZavorthCommandCenterHealthStatusView,
): ZavorthNativeDashboardViewModelRecord[] {
  return [
    record(
      idPrefix,
      startIndex,
      'health-status',
      'Runtime status',
      'Runtime status projected from authenticated read-only evidence.',
      runtime.status,
      runtime.nativeContract,
      'command-center-assimilation',
      [runtime.id, 'docs/command-center-live-assimilation.md'],
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
  events: ZavorthCommandCenterEventView[],
): ZavorthNativeDashboardViewModelRecord[] {
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
  sessions: ZavorthCommandCenterSessionView[],
): ZavorthNativeDashboardViewModelRecord[] {
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
  messages: ZavorthCommandCenterMessageMetadataView[],
): ZavorthNativeDashboardViewModelRecord[] {
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
  viewType: ZavorthNativeDashboardViewModelType,
  surfaces: ZavorthCommandCenterSurfaceView[],
  provenanceKind: ZavorthNativeDashboardViewModelProvenanceKind,
): ZavorthNativeDashboardViewModelRecord[] {
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
      [surface.id, 'docs/command-center-live-assimilation.md'],
    )
  ));
}

function buildRecords(
  idPrefix: string,
  source: ZavorthNativeDashboardViewModelRegistrySource,
): ZavorthNativeDashboardViewModelRecord[] {
  const viewModel: ZavorthCommandCenterLiveAssimilationViewModel = source.commandCenterAssimilation.viewModel;
  const groups = [
    recordsFromCapabilityRegistry(idPrefix, 0, source.capabilityRegistry),
    recordsFromHealth(idPrefix, 1000, viewModel.runtime, viewModel.health),
    recordsFromEvents(idPrefix, 2000, viewModel.events),
    recordsFromSessions(idPrefix, 3000, viewModel.sessions),
    recordsFromMessages(idPrefix, 4000, viewModel.messages),
    recordsFromSurfaces(idPrefix, 5000, 'channel', viewModel.channels, 'command-center-assimilation'),
    recordsFromSurfaces(idPrefix, 6000, 'plugin', viewModel.plugins, 'command-center-assimilation'),
    recordsFromSurfaces(idPrefix, 7000, 'provider', viewModel.providers, 'command-center-assimilation'),
    recordsFromSurfaces(idPrefix, 8000, 'gateway-lifecycle', viewModel.gatewayLifecycle, 'live-read-only-bridge'),
  ];

  return groups.flat();
}

function byTypeIndex(records: ZavorthNativeDashboardViewModelRecord[]): Record<ZavorthNativeDashboardViewModelType, number> {
  const index = emptyTypeIndex();
  records.forEach((entry) => {
    index[entry.viewType] += 1;
  });
  return index;
}

function byStatusIndex(records: ZavorthNativeDashboardViewModelRecord[]): Record<ExternalAgentCommandCenterOperationalStatus, number> {
  const index = emptyStatusIndex();
  records.forEach((entry) => {
    index[entry.status] += 1;
  });
  return index;
}

function degradedOrUnavailableIds(records: ZavorthNativeDashboardViewModelRecord[]): string[] {
  return records
    .filter((entry) => entry.status === 'degraded' || entry.status === 'unavailable')
    .map((entry) => entry.id);
}

function sourceReady(source: ZavorthNativeDashboardViewModelRegistrySource): boolean {
  return (
    source.realCapabilitySnapshot.decision === 'real-capability-snapshot-read-only-ok' &&
    source.liveReadOnlyBridge.decision === 'external-executor-live-read-only-bridge-boundary-ready' &&
    source.observabilityProjection.decision === 'external-executor-live-observability-projection-ready' &&
    source.eventStreamAdapter.decision === 'external-executor-read-only-event-stream-adapter-ready' &&
    source.sessionHistoryBridge.decision === 'external-executor-session-history-read-only-bridge-ready' &&
    source.commandCenterAssimilation.decision === 'command-center-live-assimilation-ready' &&
    source.transportDiscovery.decision === 'real-message-transport-capability-discovery-ready' &&
    source.nativeCapabilityRegistry.decision === 'native-capability-registry-replacement-ready' &&
    !source.mutableLiveLookupAttempted &&
    !source.gatewayLiveCalledDuringRender &&
    !source.externalAdapterInvokedForRender
  );
}

function buildSnapshot(
  options: ZavorthNativeDashboardViewModelRegistryOptions,
): ZavorthNativeDashboardViewModelRegistrySnapshot {
  const records = buildRecords(options.idPrefix, options.source);

  return {
    nativeContract: 'ZavorthNativeDashboardViewModelRegistry/v1',
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
      commandCenterAssimilation: 'docs/command-center-live-assimilation.md',
      transportDiscovery: 'docs/real-message-transport-capability-discovery.md',
      nativeCapabilityRegistry: 'docs/first-native-capability-registry-replacement-slice.md',
    },
    runtimeExternalExecutorRequiredForDashboardViewLookup: false,
    runtimeExternalExecutorRequiredForDashboardRender: false,
    runtimeExternalExecutorRequiredForCapabilityLookup: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    nativeReplacementAuthorizedForDashboardViewModels: true,
    adapterRemovalAllowed: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthNativeDashboardViewModelRegistryExecutionGate {
  return {
    runtimeExternalExecutorRequiredForDashboardViewLookup: false,
    runtimeExternalExecutorRequiredForDashboardRender: false,
    runtimeExternalExecutorRequiredForCapabilityLookup: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorizedForDashboardViewModels: true,
    adapterRemovalAllowed: false,
    rawSecretSerialized: false,
  };
}

function renderedViewModel(record: ZavorthNativeDashboardViewModelRecord): ZavorthNativeDashboardRenderedViewModel {
  return {
    nativeContract: 'ZavorthNativeDashboardRenderedViewModel/v1',
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
  record: ZavorthNativeDashboardViewModelRecord,
  filter: ZavorthNativeDashboardViewModelRegistryFilter,
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

export class ZavorthNativeDashboardViewModelRegistry {
  private readonly recordsById: Map<string, ZavorthNativeDashboardViewModelRecord>;

  public constructor(public readonly snapshot: ZavorthNativeDashboardViewModelRegistrySnapshot) {
    this.recordsById = new Map(snapshot.records.map((entry) => [entry.id, entry]));
  }

  public list(filter: ZavorthNativeDashboardViewModelRegistryFilter = {}): ZavorthNativeDashboardViewModelRecord[] {
    return this.snapshot.records.filter((entry) => matchesFilter(entry, filter));
  }

  public lookup(id: string): ZavorthNativeDashboardViewModelLookupResult {
    const record = this.recordsById.get(id);

    return {
      nativeContract: 'ZavorthNativeDashboardViewModelLookupResult/v1',
      lookupId: id,
      found: Boolean(record),
      ...(record ? { record } : {}),
      runtimeExternalExecutorRequiredForDashboardViewLookup: false,
      runtimeExternalExecutorRequiredForDashboardRender: false,
      sourceRuntimeAuthority: false,
    };
  }

  public render(filter: ZavorthNativeDashboardViewModelRegistryFilter = {}): ZavorthNativeDashboardRenderResult {
    return {
      nativeContract: 'ZavorthNativeDashboardRenderResult/v1',
      generatedAt: this.snapshot.generatedAt,
      rows: this.list(filter).map(renderedViewModel),
      runtimeExternalExecutorRequiredForDashboardRender: false,
      runtimeExternalExecutorRequiredForDashboardViewLookup: false,
      runtimeExternalExecutorRequiredForCapabilityLookup: false,
      sourceIdentityPublic: false,
      rawSecretSerialized: false,
    };
  }
}

export function createZavorthNativeDashboardViewModelRegistryFixtureSource(): ZavorthNativeDashboardViewModelRegistrySource {
  return {
    realCapabilitySnapshot: normalizeExternalExecutorRealCapabilitySnapshotReadOnlyFixture(),
    liveReadOnlyBridge: normalizeExternalExecutorLiveReadOnlyBridgeBoundaryFixture(),
    observabilityProjection: normalizeExternalExecutorLiveObservabilityProjectionFixture(),
    eventStreamAdapter: normalizeExternalExecutorReadOnlyEventStreamAdapterFixture(),
    sessionHistoryBridge: normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture(),
    commandCenterAssimilation: normalizeExternalAgentCommandCenterLiveAssimilationFixture(),
    transportDiscovery: normalizeMessageTransportCapabilityDiscoveryFixture(),
    nativeCapabilityRegistry: normalizeZavorthNativeCapabilityRegistryReplacementFixture(),
    capabilityRegistry: createZavorthNativeCapabilityRegistryFixture(),
    mutableLiveLookupAttempted: false,
    gatewayLiveCalledDuringRender: false,
    externalAdapterInvokedForRender: false,
  };
}

export function normalizeZavorthNativeDashboardViewModelRegistry<TRuntimeId extends string>(
  options: ZavorthNativeDashboardViewModelRegistryOptions<TRuntimeId>,
): ZavorthNativeDashboardViewModelRegistryNormalization {
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
    nativeContract: 'ZavorthNativeDashboardViewModelRegistrySlice/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'native-dashboard-view-model-registry-ready' : 'blocked',
    status: ready ? 'native-dashboard-view-model-registry-ready' : 'blocked',
    sourceReadiness: {
      realCapabilitySnapshot: options.source.realCapabilitySnapshot.decision,
      liveReadOnlyBridge: options.source.liveReadOnlyBridge.decision,
      observabilityProjection: options.source.observabilityProjection.decision,
      eventStreamAdapter: options.source.eventStreamAdapter.decision,
      sessionHistoryBridge: options.source.sessionHistoryBridge.decision,
      commandCenterAssimilation: options.source.commandCenterAssimilation.decision,
      transportDiscovery: options.source.transportDiscovery.decision,
      nativeCapabilityRegistry: options.source.nativeCapabilityRegistry.decision,
    },
    registry,
    integration: {
      nativeContract: 'ZavorthNativeDashboardViewModelRegistryIntegration/v1',
      commandCenterAdapterPrepared: true,
      commandCenterConsumesNativeRegistry: true,
      capabilityCardsFromNativeCapabilityRegistry: true,
      transportMetadataFromNativeCapabilityRegistry: true,
      liveExternalExecutorOptionalForRefreshOnly: true,
      runtimeExternalExecutorRequiredForDashboardRender: false,
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
    nextGateRecommended: 'future-dashboard-native-parity-or-native-refresh-gate',
  };
}

export function normalizeZavorthNativeDashboardViewModelRegistryFixture(): ZavorthNativeDashboardViewModelRegistryNormalization {
  return normalizeZavorthNativeDashboardViewModelRegistry({
    generatedAt: ZAVORTH_NATIVE_DASHBOARD_VIEW_MODEL_REGISTRY_NOW,
    runtimeId: ZAVORTH_NATIVE_DASHBOARD_VIEW_MODEL_REGISTRY_RUNTIME_ID,
    idPrefix: 'zavorth-native-dashboard-view-model-registry',
    source: createZavorthNativeDashboardViewModelRegistryFixtureSource(),
  });
}

export function createZavorthNativeDashboardViewModelRegistryFixture(): ZavorthNativeDashboardViewModelRegistry {
  return new ZavorthNativeDashboardViewModelRegistry(
    normalizeZavorthNativeDashboardViewModelRegistryFixture().registry,
  );
}
