import {
  normalizeExternalAgentZavorthControlLiveAssimilationFixture,
} from './ExternalAgentZavorthControlLiveAssimilation.js';
import {
  planZavorthExternalDryRunActionsFixture,
} from './ExternalAgentControlledDryRunActionPlanner.js';
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
import type {
  ExternalAgentZavorthControlAuthorityDisposition,
  ExternalAgentZavorthControlLiveAssimilationNormalization,
  ExternalAgentZavorthControlOperationalStatus,
} from './ExternalAgentZavorthControlLiveAssimilation.js';
import type {
  ZavorthExternalDryRunActionPlannerNormalization,
} from './ExternalAgentControlledDryRunActionPlanner.js';
import type {
  ExternalAgentLiveReadinessCapabilityInventoryRow,
  ExternalAgentLiveReadinessCapabilityRowKind,
} from './ExternalAgentLiveReadinessAssimilationPack.js';
import type {
  ExternalExecutorLiveObservabilityProjectionNormalization,
} from './ExternalAgentExternalExecutorLiveObservabilityProjection.js';
import type {
  ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization,
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
  ZavorthExternalMessageTransportCapability,
  ZavorthMessageTransportCapabilityDiscoveryNormalization,
  ZavorthMessageTransportCapabilityState,
} from './ExternalAgentRealMessageTransportCapabilityDiscovery.js';

export const ZAVORTH_NATIVE_CAPABILITY_REGISTRY_NOW = '2026-04-29T00:30:00.000Z' as const;
export const ZAVORTH_NATIVE_CAPABILITY_REGISTRY_RUNTIME_ID = 'zavorth-native-capability-registry' as const;

export type ZavorthNativeCapabilityRegistryDecision =
  | 'blocked'
  | 'native-capability-registry-replacement-ready';

export type ZavorthNativeCapabilityRegistryEntryKind =
  | 'capability'
  | 'channel'
  | 'command-http'
  | 'gateway-method'
  | 'message-transport'
  | 'plugin'
  | 'provider'
  | 'session-history'
  | 'worker-node';

export type ZavorthNativeCapabilityRegistryClassification =
  | 'approval-required'
  | 'blocked'
  | 'degraded'
  | 'read-only'
  | 'send-capable-but-blocked'
  | 'unavailable'
  | 'unsupported';

export type ZavorthNativeCapabilityRegistrySourceKind =
  | 'zavorthControl-assimilation'
  | 'dry-run-planner'
  | 'event-stream-adapter'
  | 'live-observability-projection'
  | 'live-read-only-bridge'
  | 'real-capability-snapshot'
  | 'transport-discovery';

export type ZavorthNativeCapabilityRegistryProvenance = {
  nativeContract: 'ZavorthNativeCapabilityRegistryProvenance/v1';
  sourceKind: ZavorthNativeCapabilityRegistrySourceKind;
  sourceEvidenceIds: string[];
  sourceRuntimeNameInternal: 'ExternalExecutor';
  sourceRuntimePublicIdentity: false;
  sourceStructuresPublic: false;
  sourceIdsEvidenceOnly: true;
  redacted: true;
};

export type ZavorthNativeCapabilityRegistryEntry = {
  nativeContract: 'ZavorthNativeCapabilityRegistryEntry/v1';
  id: string;
  kind: ZavorthNativeCapabilityRegistryEntryKind;
  category: ExternalAgentLiveReadinessCapabilityRowKind | 'message-transport-capability';
  publicLabel: string;
  publicDescription: string;
  classification: ZavorthNativeCapabilityRegistryClassification;
  availability: 'available' | 'blocked' | 'degraded' | 'unavailable' | 'unknown';
  policyDisposition: 'approval-required' | 'blocked' | 'read-only';
  zavorthControlVisible: boolean;
  plannerConsumable: boolean;
  plannerDisposition: 'approval-required' | 'blocked' | 'dry-run-only' | 'read-only' | 'unsupported';
  toolNames: string[];
  provenance: ZavorthNativeCapabilityRegistryProvenance;
  runtimeExternalExecutorRequiredForLookup: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  sourceModuleCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeCapabilityRegistrySnapshot = {
  nativeContract: 'ZavorthNativeCapabilityRegistry/v1';
  id: string;
  generatedAt: string;
  entries: ZavorthNativeCapabilityRegistryEntry[];
  indexes: {
    byClassification: Record<ZavorthNativeCapabilityRegistryClassification, number>;
    byKind: Record<ZavorthNativeCapabilityRegistryEntryKind, number>;
  };
  sourceArtifactsConsumed: {
    realCapabilitySnapshot: 'docs/real-capability-snapshot-read-only.md';
    liveReadOnlyBridge: 'docs/external-executor-live-read-only-bridge-boundary.md';
    observabilityProjection: 'docs/external-executor-live-observability-projection.md';
    eventStreamAdapter: 'docs/external-executor-read-only-event-stream-adapter.md';
    zavorthControlAssimilation: 'docs/zavorthControl-live-assimilation.md';
    dryRunPlanner: 'docs/zavorthControlled-dry-run-action-planner.md';
    transportDiscovery: 'docs/real-message-transport-capability-discovery.md';
  };
  runtimeExternalExecutorRequiredForRegistryLookup: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  nativeReplacementAuthorizedForRegistry: true;
  rawSecretSerialized: false;
};

export type ZavorthNativeCapabilityRegistryLookupResult = {
  nativeContract: 'ZavorthNativeCapabilityRegistryLookupResult/v1';
  lookupId: string;
  found: boolean;
  entry?: ZavorthNativeCapabilityRegistryEntry;
  runtimeExternalExecutorRequiredForLookup: false;
  sourceRuntimeAuthority: false;
};

export type ZavorthNativeCapabilityRegistryZavorthControlView = {
  nativeContract: 'ZavorthNativeCapabilityRegistryZavorthControlView/v1';
  id: string;
  registryEntryId: string;
  label: string;
  category: ZavorthNativeCapabilityRegistryEntry['category'];
  kind: ZavorthNativeCapabilityRegistryEntryKind;
  status: ExternalAgentZavorthControlOperationalStatus;
  authorityDisposition: ExternalAgentZavorthControlAuthorityDisposition;
  sourceIdentityPublic: false;
  sourceStructuresPublic: false;
  sourceIdsEvidenceOnly: true;
  readOnly: true;
  executionAuthority: false;
};

export type ZavorthNativeCapabilityRegistryPlannerInput = {
  nativeContract: 'ZavorthNativeCapabilityRegistryPlannerInput/v1';
  id: string;
  registryEntryId: string;
  category: ZavorthNativeCapabilityRegistryEntry['category'];
  classification: ZavorthNativeCapabilityRegistryClassification;
  plannerDisposition: ZavorthNativeCapabilityRegistryEntry['plannerDisposition'];
  sourceCapabilityInputOnly: true;
  sourceAuthorityGranted: false;
  directExternalInvocationAllowed: false;
  executionAuthority: false;
};

export type ZavorthNativeCapabilityRegistryIntegration = {
  nativeContract: 'ZavorthNativeCapabilityRegistryIntegration/v1';
  zavorthControlViews: ZavorthNativeCapabilityRegistryZavorthControlView[];
  plannerInputs: ZavorthNativeCapabilityRegistryPlannerInput[];
  zavorthControlUsesZavorthNativeViewModels: true;
  plannerUsesRegistryInputOnly: true;
  liveExternalExecutorOptionalForRefreshOnly: true;
  runtimeExternalExecutorRequiredForLookup: false;
  sourceIdentityPublic: false;
};

export type ZavorthNativeCapabilityRegistryExecutionGate = {
  runtimeExternalExecutorRequiredForRegistryLookup: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorizedForRegistry: true;
  rawSecretSerialized: false;
};

export type ZavorthNativeCapabilityRegistrySource = {
  realCapabilitySnapshot: ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization;
  liveReadOnlyBridge: ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization;
  observabilityProjection: ExternalExecutorLiveObservabilityProjectionNormalization;
  eventStreamAdapter: ExternalExecutorReadOnlyEventStreamAdapterNormalization;
  zavorthControlAssimilation: ExternalAgentZavorthControlLiveAssimilationNormalization;
  dryRunPlanner: ZavorthExternalDryRunActionPlannerNormalization;
  transportDiscovery: ZavorthMessageTransportCapabilityDiscoveryNormalization;
  requestedSlice: 'capability-plugin-registry';
  routeAdjustmentFrom184: {
    originallySelectedTarget: 'zavorthControl-view-models';
    promotedTargetFor185: 'capability-plugin-registry';
    explicitOperatorRequest: true;
    zavorthControlRemainsConsumer: true;
  };
};

export type ZavorthNativeCapabilityRegistryReplacementNormalization = {
  nativeContract: 'ZavorthNativeCapabilityRegistryReplacementSlice/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthNativeCapabilityRegistryDecision;
  status: 'native-capability-registry-replacement-ready' | 'blocked';
  routeAdjustmentFrom184: ZavorthNativeCapabilityRegistrySource['routeAdjustmentFrom184'];
  sourceReadiness: {
    realCapabilitySnapshot: ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization['decision'];
    liveReadOnlyBridge: ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization['decision'];
    observabilityProjection: ExternalExecutorLiveObservabilityProjectionNormalization['decision'];
    eventStreamAdapter: ExternalExecutorReadOnlyEventStreamAdapterNormalization['decision'];
    zavorthControlAssimilation: ExternalAgentZavorthControlLiveAssimilationNormalization['decision'];
    dryRunPlanner: ZavorthExternalDryRunActionPlannerNormalization['decision'];
    transportDiscovery: ZavorthMessageTransportCapabilityDiscoveryNormalization['decision'];
  };
  registry: ZavorthNativeCapabilityRegistrySnapshot;
  integration: ZavorthNativeCapabilityRegistryIntegration;
  dependencyReductionProof: {
    lookupWorksWithoutLiveExternalExecutor: true;
    listWorksWithoutLiveExternalExecutor: true;
    classifyWorksWithoutLiveExternalExecutor: true;
    zavorthControlConsumerUsesRegistry: true;
    plannerConsumerUsesRegistry: true;
    liveExternalExecutorOptionalForRefreshOnly: true;
  };
  executionGate: ZavorthNativeCapabilityRegistryExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    sourceIdentityPublic: false;
    sourceStructuresPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-native-registry-refresh-or-zavorthControl-registry-slice';
};

export type ZavorthNativeCapabilityRegistryOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  source: ZavorthNativeCapabilityRegistrySource;
};

function emptyClassificationIndex(): Record<ZavorthNativeCapabilityRegistryClassification, number> {
  return {
    'approval-required': 0,
    blocked: 0,
    degraded: 0,
    'read-only': 0,
    'send-capable-but-blocked': 0,
    unavailable: 0,
    unsupported: 0,
  };
}

function emptyKindIndex(): Record<ZavorthNativeCapabilityRegistryEntryKind, number> {
  return {
    capability: 0,
    channel: 0,
    'command-http': 0,
    'gateway-method': 0,
    'message-transport': 0,
    plugin: 0,
    provider: 0,
    'session-history': 0,
    'worker-node': 0,
  };
}

function registryKindForRow(rowKind: ExternalAgentLiveReadinessCapabilityRowKind): ZavorthNativeCapabilityRegistryEntryKind {
  if (rowKind === 'plugin-capabilities') {
    return 'plugin';
  }
  if (rowKind === 'provider-capabilities') {
    return 'provider';
  }
  if (rowKind === 'channel-capabilities') {
    return 'channel';
  }
  if (rowKind === 'command-http-capabilities') {
    return 'command-http';
  }
  if (rowKind === 'gateway-method-capabilities') {
    return 'gateway-method';
  }
  if (rowKind === 'session-history-capabilities') {
    return 'session-history';
  }
  return 'worker-node';
}

function publicLabelForRow(rowKind: ExternalAgentLiveReadinessCapabilityRowKind): string {
  const labels: Record<ExternalAgentLiveReadinessCapabilityRowKind, string> = {
    'channel-capabilities': 'Channel capability metadata',
    'command-http-capabilities': 'Command and HTTP capability metadata',
    'gateway-method-capabilities': 'Gateway method capability metadata',
    'plugin-capabilities': 'Plugin capability metadata',
    'provider-capabilities': 'Provider capability metadata',
    'session-history-capabilities': 'Session and history capability metadata',
    'worker-node-capabilities': 'Worker and node capability metadata',
  };

  return labels[rowKind];
}

function publicDescriptionForClassification(
  classification: ZavorthNativeCapabilityRegistryClassification,
): string {
  if (classification === 'send-capable-but-blocked') {
    return 'Mutable transport capability is known, but live send remains blocked by Zavorth policy.';
  }
  if (classification === 'approval-required') {
    return 'Capability metadata is available and future active use requires Zavorth approval gates.';
  }
  if (classification === 'blocked') {
    return 'Capability is represented as metadata and blocked for execution.';
  }
  if (classification === 'unsupported') {
    return 'Capability shape is not supported by the current Zavorth registry consumer.';
  }
  if (classification === 'degraded') {
    return 'Capability metadata is preserved as degraded evidence.';
  }
  if (classification === 'unavailable') {
    return 'Capability metadata is unavailable and represented honestly.';
  }
  return 'Capability is safe to list and inspect as read-only Zavorth metadata.';
}

function classificationFromSnapshotRow(
  row: ExternalAgentLiveReadinessCapabilityInventoryRow,
): ZavorthNativeCapabilityRegistryClassification {
  if (row.availability === 'unavailable' || row.importClassification === 'unavailable') {
    return 'unavailable';
  }
  if (row.availability === 'degraded' || row.importClassification === 'degraded') {
    return 'degraded';
  }
  if (row.policy === 'blocked' || row.importClassification === 'blocked') {
    return 'blocked';
  }
  if (row.policy === 'approval-required' || row.importClassification === 'approval-required') {
    return 'approval-required';
  }
  return 'read-only';
}

function classificationFromTransport(
  capability: ZavorthExternalMessageTransportCapability,
): ZavorthNativeCapabilityRegistryClassification {
  if (capability.status === 'read-only') {
    return 'read-only';
  }
  if (capability.supportsSend) {
    return 'send-capable-but-blocked';
  }
  if (capability.status === 'degraded-unknown') {
    return 'unsupported';
  }
  return 'unavailable';
}

function availabilityForClassification(
  classification: ZavorthNativeCapabilityRegistryClassification,
): ZavorthNativeCapabilityRegistryEntry['availability'] {
  if (classification === 'blocked' || classification === 'send-capable-but-blocked') {
    return 'blocked';
  }
  if (classification === 'degraded' || classification === 'unsupported') {
    return 'degraded';
  }
  if (classification === 'unavailable') {
    return 'unavailable';
  }
  return 'available';
}

function policyDispositionForClassification(
  classification: ZavorthNativeCapabilityRegistryClassification,
): ZavorthNativeCapabilityRegistryEntry['policyDisposition'] {
  if (classification === 'approval-required' || classification === 'send-capable-but-blocked') {
    return 'approval-required';
  }
  if (classification === 'blocked' || classification === 'unsupported' || classification === 'unavailable') {
    return 'blocked';
  }
  return 'read-only';
}

function plannerDispositionForClassification(
  classification: ZavorthNativeCapabilityRegistryClassification,
): ZavorthNativeCapabilityRegistryEntry['plannerDisposition'] {
  if (classification === 'approval-required' || classification === 'send-capable-but-blocked') {
    return 'approval-required';
  }
  if (classification === 'blocked' || classification === 'unavailable') {
    return 'blocked';
  }
  if (classification === 'unsupported' || classification === 'degraded') {
    return 'unsupported';
  }
  return 'read-only';
}

function zavorthControlStatusForClassification(
  classification: ZavorthNativeCapabilityRegistryClassification,
): ExternalAgentZavorthControlOperationalStatus {
  if (classification === 'blocked' || classification === 'send-capable-but-blocked' || classification === 'approval-required') {
    return 'blocked';
  }
  if (classification === 'degraded' || classification === 'unsupported') {
    return 'degraded';
  }
  if (classification === 'unavailable') {
    return 'unavailable';
  }
  return 'ready';
}

function provenance(
  sourceKind: ZavorthNativeCapabilityRegistrySourceKind,
  sourceEvidenceIds: string[],
): ZavorthNativeCapabilityRegistryProvenance {
  return {
    nativeContract: 'ZavorthNativeCapabilityRegistryProvenance/v1',
    sourceKind,
    sourceEvidenceIds,
    sourceRuntimeNameInternal: 'ExternalExecutor',
    sourceRuntimePublicIdentity: false,
    sourceStructuresPublic: false,
    sourceIdsEvidenceOnly: true,
    redacted: true,
  };
}

function snapshotEntry(
  idPrefix: string,
  row: ExternalAgentLiveReadinessCapabilityInventoryRow,
  index: number,
): ZavorthNativeCapabilityRegistryEntry {
  const classification = classificationFromSnapshotRow(row);
  const kind = registryKindForRow(row.rowKind);

  return {
    nativeContract: 'ZavorthNativeCapabilityRegistryEntry/v1',
    id: `${idPrefix}:snapshot-entry-${index + 1}-${row.rowKind}`,
    kind,
    category: row.rowKind,
    publicLabel: publicLabelForRow(row.rowKind),
    publicDescription: publicDescriptionForClassification(classification),
    classification,
    availability: availabilityForClassification(classification),
    policyDisposition: policyDispositionForClassification(classification),
    zavorthControlVisible: true,
    plannerConsumable: true,
    plannerDisposition: plannerDispositionForClassification(classification),
    toolNames: row.toolNames,
    provenance: provenance('real-capability-snapshot', [
      row.sourceEvidence.evidenceId,
      'docs/real-capability-snapshot-read-only.md',
      'docs/external-executor-live-read-only-bridge-boundary.md',
    ]),
    runtimeExternalExecutorRequiredForLookup: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    sourceModuleCopied: false,
    rawSecretSerialized: false,
  };
}

function transportLabel(capability: ZavorthExternalMessageTransportCapability): string {
  if (capability.transportKind === 'status-only') {
    return 'Gateway status transport metadata';
  }
  if (capability.transportKind === 'unknown') {
    return 'Unknown transport metadata';
  }
  return `Message transport metadata: ${capability.transportKind}`;
}

function transportDescription(
  capability: ZavorthExternalMessageTransportCapability,
  classification: ZavorthNativeCapabilityRegistryClassification,
): string {
  if (capability.supportsSend) {
    return 'Send capability was discovered as metadata, but outbound transport remains blocked.';
  }
  return publicDescriptionForClassification(classification);
}

function transportEntry(
  idPrefix: string,
  capability: ZavorthExternalMessageTransportCapability,
  index: number,
): ZavorthNativeCapabilityRegistryEntry {
  const classification = classificationFromTransport(capability);

  return {
    nativeContract: 'ZavorthNativeCapabilityRegistryEntry/v1',
    id: `${idPrefix}:transport-entry-${index + 1}-${capability.transportKind}`,
    kind: 'message-transport',
    category: 'message-transport-capability',
    publicLabel: transportLabel(capability),
    publicDescription: transportDescription(capability, classification),
    classification,
    availability: availabilityForClassification(classification),
    policyDisposition: policyDispositionForClassification(classification),
    zavorthControlVisible: true,
    plannerConsumable: true,
    plannerDisposition: plannerDispositionForClassification(classification),
    toolNames: capability.supportsSend ? ['external.channel.message.send'] : ['external.gateway.status.read'],
    provenance: provenance('transport-discovery', [
      capability.id,
      ...capability.sourceEvidence,
      'docs/real-message-transport-capability-discovery.md',
    ]),
    runtimeExternalExecutorRequiredForLookup: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    sourceModuleCopied: false,
    rawSecretSerialized: false,
  };
}

function uniqueEntries(entries: ZavorthNativeCapabilityRegistryEntry[]): ZavorthNativeCapabilityRegistryEntry[] {
  const byId = new Map<string, ZavorthNativeCapabilityRegistryEntry>();
  entries.forEach((entry) => byId.set(entry.id, entry));
  return Array.from(byId.values());
}

function createRegistryEntries(
  idPrefix: string,
  source: ZavorthNativeCapabilityRegistrySource,
): ZavorthNativeCapabilityRegistryEntry[] {
  const snapshotEntries = source.realCapabilitySnapshot.capabilityInventory.inventory.map((row, index) => (
    snapshotEntry(idPrefix, row, index)
  ));
  const transportEntries = source.transportDiscovery.capabilities.map((capability, index) => (
    transportEntry(idPrefix, capability, index)
  ));

  return uniqueEntries([
    ...snapshotEntries,
    ...transportEntries,
  ]);
}

function byClassificationIndex(
  entries: ZavorthNativeCapabilityRegistryEntry[],
): Record<ZavorthNativeCapabilityRegistryClassification, number> {
  const index = emptyClassificationIndex();
  entries.forEach((entry) => {
    index[entry.classification] += 1;
  });
  return index;
}

function byKindIndex(entries: ZavorthNativeCapabilityRegistryEntry[]): Record<ZavorthNativeCapabilityRegistryEntryKind, number> {
  const index = emptyKindIndex();
  entries.forEach((entry) => {
    index[entry.kind] += 1;
  });
  return index;
}

function buildRegistrySnapshot(
  options: ZavorthNativeCapabilityRegistryOptions,
): ZavorthNativeCapabilityRegistrySnapshot {
  const entries = createRegistryEntries(options.idPrefix, options.source);

  return {
    nativeContract: 'ZavorthNativeCapabilityRegistry/v1',
    id: `${options.idPrefix}:registry`,
    generatedAt: options.generatedAt,
    entries,
    indexes: {
      byClassification: byClassificationIndex(entries),
      byKind: byKindIndex(entries),
    },
    sourceArtifactsConsumed: {
      realCapabilitySnapshot: 'docs/real-capability-snapshot-read-only.md',
      liveReadOnlyBridge: 'docs/external-executor-live-read-only-bridge-boundary.md',
      observabilityProjection: 'docs/external-executor-live-observability-projection.md',
      eventStreamAdapter: 'docs/external-executor-read-only-event-stream-adapter.md',
      zavorthControlAssimilation: 'docs/zavorthControl-live-assimilation.md',
      dryRunPlanner: 'docs/zavorthControlled-dry-run-action-planner.md',
      transportDiscovery: 'docs/real-message-transport-capability-discovery.md',
    },
    runtimeExternalExecutorRequiredForRegistryLookup: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    nativeReplacementAuthorizedForRegistry: true,
    rawSecretSerialized: false,
  };
}

function zavorthControlViewForEntry(entry: ZavorthNativeCapabilityRegistryEntry): ZavorthNativeCapabilityRegistryZavorthControlView {
  return {
    nativeContract: 'ZavorthNativeCapabilityRegistryZavorthControlView/v1',
    id: `${entry.id}:zavorthControl-view`,
    registryEntryId: entry.id,
    label: entry.publicLabel,
    category: entry.category,
    kind: entry.kind,
    status: zavorthControlStatusForClassification(entry.classification),
    authorityDisposition: entry.policyDisposition,
    sourceIdentityPublic: false,
    sourceStructuresPublic: false,
    sourceIdsEvidenceOnly: true,
    readOnly: true,
    executionAuthority: false,
  };
}

function plannerInputForEntry(entry: ZavorthNativeCapabilityRegistryEntry): ZavorthNativeCapabilityRegistryPlannerInput {
  return {
    nativeContract: 'ZavorthNativeCapabilityRegistryPlannerInput/v1',
    id: `${entry.id}:planner-input`,
    registryEntryId: entry.id,
    category: entry.category,
    classification: entry.classification,
    plannerDisposition: entry.plannerDisposition,
    sourceCapabilityInputOnly: true,
    sourceAuthorityGranted: false,
    directExternalInvocationAllowed: false,
    executionAuthority: false,
  };
}

function buildIntegration(
  registry: ZavorthNativeCapabilityRegistrySnapshot,
): ZavorthNativeCapabilityRegistryIntegration {
  return {
    nativeContract: 'ZavorthNativeCapabilityRegistryIntegration/v1',
    zavorthControlViews: registry.entries
      .filter((entry) => entry.zavorthControlVisible)
      .map(zavorthControlViewForEntry),
    plannerInputs: registry.entries
      .filter((entry) => entry.plannerConsumable)
      .map(plannerInputForEntry),
    zavorthControlUsesZavorthNativeViewModels: true,
    plannerUsesRegistryInputOnly: true,
    liveExternalExecutorOptionalForRefreshOnly: true,
    runtimeExternalExecutorRequiredForLookup: false,
    sourceIdentityPublic: false,
  };
}

function sourceReady(source: ZavorthNativeCapabilityRegistrySource): boolean {
  return (
    source.realCapabilitySnapshot.decision === 'real-capability-snapshot-read-only-ok' &&
    source.liveReadOnlyBridge.decision === 'external-executor-live-read-only-bridge-boundary-ready' &&
    source.observabilityProjection.decision === 'external-executor-live-observability-projection-ready' &&
    source.eventStreamAdapter.decision === 'external-executor-read-only-event-stream-adapter-ready' &&
    source.zavorthControlAssimilation.decision === 'zavorthControl-live-assimilation-ready' &&
    source.dryRunPlanner.decision === 'controlled-dry-run-action-planner-ready' &&
    source.transportDiscovery.decision === 'real-message-transport-capability-discovery-ready' &&
    source.requestedSlice === 'capability-plugin-registry'
  );
}

function executionGate(): ZavorthNativeCapabilityRegistryExecutionGate {
  return {
    runtimeExternalExecutorRequiredForRegistryLookup: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorizedForRegistry: true,
    rawSecretSerialized: false,
  };
}

export class ZavorthNativeCapabilityRegistry {
  private readonly entriesById: Map<string, ZavorthNativeCapabilityRegistryEntry>;

  public constructor(public readonly snapshot: ZavorthNativeCapabilityRegistrySnapshot) {
    this.entriesById = new Map(snapshot.entries.map((entry) => [entry.id, entry]));
  }

  public list(
    filter: Partial<Pick<ZavorthNativeCapabilityRegistryEntry, 'classification' | 'kind'>> = {},
  ): ZavorthNativeCapabilityRegistryEntry[] {
    return this.snapshot.entries.filter((entry) => (
      (!filter.classification || entry.classification === filter.classification) &&
      (!filter.kind || entry.kind === filter.kind)
    ));
  }

  public lookup(id: string): ZavorthNativeCapabilityRegistryLookupResult {
    const entry = this.entriesById.get(id);

    return {
      nativeContract: 'ZavorthNativeCapabilityRegistryLookupResult/v1',
      lookupId: id,
      found: Boolean(entry),
      ...(entry ? { entry } : {}),
      runtimeExternalExecutorRequiredForLookup: false,
      sourceRuntimeAuthority: false,
    };
  }

  public classify(id: string): ZavorthNativeCapabilityRegistryClassification | 'missing' {
    return this.entriesById.get(id)?.classification ?? 'missing';
  }

  public toZavorthControlViews(): ZavorthNativeCapabilityRegistryZavorthControlView[] {
    return this.snapshot.entries
      .filter((entry) => entry.zavorthControlVisible)
      .map(zavorthControlViewForEntry);
  }

  public toPlannerInputs(): ZavorthNativeCapabilityRegistryPlannerInput[] {
    return this.snapshot.entries
      .filter((entry) => entry.plannerConsumable)
      .map(plannerInputForEntry);
  }
}

export function createZavorthNativeCapabilityRegistryFixtureSource(): ZavorthNativeCapabilityRegistrySource {
  return {
    realCapabilitySnapshot: normalizeExternalExecutorRealCapabilitySnapshotReadOnlyFixture(),
    liveReadOnlyBridge: normalizeExternalExecutorLiveReadOnlyBridgeBoundaryFixture(),
    observabilityProjection: normalizeExternalExecutorLiveObservabilityProjectionFixture(),
    eventStreamAdapter: normalizeExternalExecutorReadOnlyEventStreamAdapterFixture(),
    zavorthControlAssimilation: normalizeExternalAgentZavorthControlLiveAssimilationFixture(),
    dryRunPlanner: planZavorthExternalDryRunActionsFixture(),
    transportDiscovery: normalizeMessageTransportCapabilityDiscoveryFixture(),
    requestedSlice: 'capability-plugin-registry',
    routeAdjustmentFrom184: {
      originallySelectedTarget: 'zavorthControl-view-models',
      promotedTargetFor185: 'capability-plugin-registry',
      explicitOperatorRequest: true,
      zavorthControlRemainsConsumer: true,
    },
  };
}

export function normalizeZavorthNativeCapabilityRegistryReplacement<TRuntimeId extends string>(
  options: ZavorthNativeCapabilityRegistryOptions<TRuntimeId>,
): ZavorthNativeCapabilityRegistryReplacementNormalization {
  const registry = buildRegistrySnapshot(options);
  const integration = buildIntegration(registry);
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    registry.entries.length > 0 &&
    registry.indexes.byKind.plugin > 0 &&
    registry.indexes.byKind['message-transport'] > 0 &&
    integration.zavorthControlViews.length === registry.entries.length &&
    integration.plannerInputs.length === registry.entries.length;

  return {
    nativeContract: 'ZavorthNativeCapabilityRegistryReplacementSlice/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'native-capability-registry-replacement-ready' : 'blocked',
    status: ready ? 'native-capability-registry-replacement-ready' : 'blocked',
    routeAdjustmentFrom184: options.source.routeAdjustmentFrom184,
    sourceReadiness: {
      realCapabilitySnapshot: options.source.realCapabilitySnapshot.decision,
      liveReadOnlyBridge: options.source.liveReadOnlyBridge.decision,
      observabilityProjection: options.source.observabilityProjection.decision,
      eventStreamAdapter: options.source.eventStreamAdapter.decision,
      zavorthControlAssimilation: options.source.zavorthControlAssimilation.decision,
      dryRunPlanner: options.source.dryRunPlanner.decision,
      transportDiscovery: options.source.transportDiscovery.decision,
    },
    registry,
    integration,
    dependencyReductionProof: {
      lookupWorksWithoutLiveExternalExecutor: true,
      listWorksWithoutLiveExternalExecutor: true,
      classifyWorksWithoutLiveExternalExecutor: true,
      zavorthControlConsumerUsesRegistry: true,
      plannerConsumerUsesRegistry: true,
      liveExternalExecutorOptionalForRefreshOnly: true,
    },
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-native-registry-refresh-or-zavorthControl-registry-slice',
  };
}

export function normalizeZavorthNativeCapabilityRegistryReplacementFixture(): ZavorthNativeCapabilityRegistryReplacementNormalization {
  return normalizeZavorthNativeCapabilityRegistryReplacement({
    generatedAt: ZAVORTH_NATIVE_CAPABILITY_REGISTRY_NOW,
    runtimeId: ZAVORTH_NATIVE_CAPABILITY_REGISTRY_RUNTIME_ID,
    idPrefix: 'zavorth-native-capability-registry',
    source: createZavorthNativeCapabilityRegistryFixtureSource(),
  });
}

export function createZavorthNativeCapabilityRegistryFixture(): ZavorthNativeCapabilityRegistry {
  return new ZavorthNativeCapabilityRegistry(
    normalizeZavorthNativeCapabilityRegistryReplacementFixture().registry,
  );
}

export function summarizeZavorthNativeCapabilityRegistryEventKinds(
  eventStream: ExternalExecutorReadOnlyEventStreamAdapterNormalization,
): ExternalExecutorReadOnlySourceEventKind[] {
  return Array.from(new Set(eventStream.zavorthControlEvents.map((event) => event.kind)));
}

export function summarizeZavorthNativeCapabilityRegistryBridgeSurfaceKinds(
  bridge: ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization,
): ExternalExecutorLiveReadOnlyBridgeSurfaceKind[] {
  return Array.from(new Set(bridge.surfaces.map((surface) => surface.surfaceKind)));
}

export function summarizeZavorthNativeCapabilityRegistryTransportStates(
  discovery: ZavorthMessageTransportCapabilityDiscoveryNormalization,
): ZavorthMessageTransportCapabilityState[] {
  return Array.from(new Set(discovery.capabilities.map((capability) => capability.status)));
}
