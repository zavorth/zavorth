import {
  createZavorthNativeCapabilityRegistryFixture,
  normalizeZavorthNativeCapabilityRegistryReplacementFixture,
} from './ZavorthNativeCapabilityRegistry.js';
import {
  createZavorthNativeDashboardViewModelRegistryFixture,
  normalizeZavorthNativeDashboardViewModelRegistryFixture,
} from './ZavorthNativeDashboardViewModelRegistry.js';
import {
  normalizeRuntimeAdapterDashboardLiveAssimilationFixture,
} from './RuntimeAdapterDashboardLiveAssimilation.js';
import {
  normalizeMessageTransportCapabilityDiscoveryFixture,
} from './RuntimeAdapterRealMessageTransportCapabilityDiscovery.js';
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
  ZavorthNativeCapabilityRegistry,
  ZavorthNativeCapabilityRegistryEntry,
  ZavorthNativeCapabilityRegistryReplacementNormalization,
} from './ZavorthNativeCapabilityRegistry.js';
import type {
  ZavorthNativeDashboardViewModelRegistry,
  ZavorthNativeDashboardViewModelRegistryNormalization,
} from './ZavorthNativeDashboardViewModelRegistry.js';
import type {
  RuntimeAdapterDashboardLiveAssimilationNormalization,
  RuntimeAdapterDashboardOperationalStatus,
} from './RuntimeAdapterDashboardLiveAssimilation.js';
import type {
  ExternalExecutorLiveObservabilityProjectionNormalization,
} from './RuntimeAdapterExternalExecutorLiveObservabilityProjection.js';
import type {
  ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization,
} from './RuntimeAdapterExternalExecutorLiveReadOnlyBridgeBoundary.js';
import type {
  ExternalExecutorReadOnlyEventStreamAdapterNormalization,
} from './RuntimeAdapterExternalExecutorReadOnlyEventStreamAdapter.js';
import type {
  ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization,
} from './RuntimeAdapterExternalExecutorRealCapabilitySnapshotReadOnly.js';
import type {
  ExternalExecutorSessionHistoryReadOnlyBridgeNormalization,
} from './RuntimeAdapterExternalExecutorSessionHistoryReadOnlyBridge.js';
import type {
  ZavorthExternalMessageTransportCapability,
  ZavorthMessageTransportCapabilityDiscoveryNormalization,
} from './RuntimeAdapterRealMessageTransportCapabilityDiscovery.js';

export const ZAVORTH_NATIVE_INTEGRATION_REGISTRY_NOW = '2026-04-29T01:30:00.000Z' as const;
export const ZAVORTH_NATIVE_INTEGRATION_REGISTRY_RUNTIME_ID = 'zavorth-native-integration-registry' as const;

export type ZavorthNativeIntegrationRegistryDecision =
  | 'blocked'
  | 'native-integration-registry-ready';

export type ZavorthNativeIntegrationKind =
  | 'channel'
  | 'message-transport'
  | 'provider';

export type ZavorthNativeIntegrationClassification =
  | 'blocked'
  | 'degraded'
  | 'read-only'
  | 'send-capable-but-blocked'
  | 'unavailable'
  | 'unknown';

export type ZavorthNativeIntegrationStatus =
  | 'blocked'
  | 'degraded'
  | 'ready'
  | 'unavailable'
  | 'unknown';

export type ZavorthNativeIntegrationProvenanceKind =
  | 'dashboard-view-model-registry'
  | 'live-read-only-bridge'
  | 'native-capability-registry'
  | 'real-capability-snapshot'
  | 'transport-discovery';

export type ZavorthNativeIntegrationSecretRefMetadata = {
  nativeContract: 'ZavorthNativeIntegrationSecretRefMetadata/v1';
  name: string;
  purpose: 'channel-credential' | 'gateway-token' | 'provider-auth-metadata';
  status: 'metadata-only' | 'present-redacted' | 'unknown';
  rawValueSerialized: false;
};

export type ZavorthNativeIntegrationProvenance = {
  nativeContract: 'ZavorthNativeIntegrationProvenance/v1';
  sourceKind: ZavorthNativeIntegrationProvenanceKind;
  sourceEvidenceIds: string[];
  sourceRuntimeNameInternal: 'ExternalExecutor';
  sourceRuntimePublicIdentity: false;
  sourceStructuresPublic: false;
  sourceIdsEvidenceOnly: true;
  redacted: true;
};

export type ZavorthNativeIntegrationRecord = {
  nativeContract: 'ZavorthNativeIntegrationRecord/v1';
  id: string;
  integrationKind: ZavorthNativeIntegrationKind;
  integrationType: string;
  status: ZavorthNativeIntegrationStatus;
  classification: ZavorthNativeIntegrationClassification;
  configured: boolean;
  supportsSend: boolean;
  supportsReceive: boolean;
  supportsDryRun: boolean;
  sendPolicy: 'blocked' | 'not-supported';
  receivePolicy: 'metadata-only' | 'not-supported' | 'unknown';
  requiredSecretRefs: ZavorthNativeIntegrationSecretRefMetadata[];
  requiredScopes: string[];
  requiredPermissions: string[];
  targetRequirements: string[];
  rateLimitModel: string;
  ackModel: string;
  errorModel: string;
  capabilityRegistryEntryIds: string[];
  dashboardViewModelIds: string[];
  provenance: ZavorthNativeIntegrationProvenance;
  runtimeExternalExecutorRequiredForIntegrationLookup: false;
  runtimeExternalExecutorRequiredForTransportClassification: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  transportActuallyOpened: false;
  sourceModuleCopied: false;
  adapterRemovalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeIntegrationRegistryFilter = {
  integrationKind?: ZavorthNativeIntegrationKind;
  status?: ZavorthNativeIntegrationStatus;
  classification?: ZavorthNativeIntegrationClassification;
  requiresSecretRef?: boolean;
  supportsSend?: boolean;
  degradedOrUnavailable?: boolean;
};

export type ZavorthNativeIntegrationLookupResult = {
  nativeContract: 'ZavorthNativeIntegrationLookupResult/v1';
  lookupId: string;
  found: boolean;
  record?: ZavorthNativeIntegrationRecord;
  runtimeExternalExecutorRequiredForIntegrationLookup: false;
  runtimeExternalExecutorRequiredForTransportClassification: false;
  sourceRuntimeAuthority: false;
};

export type ZavorthNativeIntegrationCapabilityCrossReference = {
  nativeContract: 'ZavorthNativeIntegrationCapabilityCrossReference/v1';
  integrationId: string;
  capabilityRegistryEntryIds: string[];
  dashboardViewModelIds: string[];
  capabilityRegistryLookupRequiredExternalExecutorLive: false;
  dashboardLookupRequiredExternalExecutorLive: false;
  sourceAuthorityGranted: false;
};

export type ZavorthNativeIntegrationDashboardProjection = {
  nativeContract: 'ZavorthNativeIntegrationDashboardProjection/v1';
  id: string;
  integrationId: string;
  integrationKind: ZavorthNativeIntegrationKind;
  label: string;
  status: RuntimeAdapterDashboardOperationalStatus;
  classification: ZavorthNativeIntegrationClassification;
  secretRefCount: number;
  supportsSend: boolean;
  sendPolicy: ZavorthNativeIntegrationRecord['sendPolicy'];
  dashboardConsumable: true;
  sourceIdentityPublic: false;
  executionAuthority: false;
};

export type ZavorthNativeIntegrationRegistrySnapshot = {
  nativeContract: 'ZavorthNativeIntegrationRegistry/v1';
  id: string;
  generatedAt: string;
  records: ZavorthNativeIntegrationRecord[];
  indexes: {
    byKind: Record<ZavorthNativeIntegrationKind, number>;
    byClassification: Record<ZavorthNativeIntegrationClassification, number>;
    sendCapableBlockedIds: string[];
    secretRefRequiredIds: string[];
    degradedOrUnavailableIds: string[];
  };
  sourceArtifactsConsumed: {
    realCapabilitySnapshot: 'docs/real-capability-snapshot-read-only.md';
    liveReadOnlyBridge: 'docs/external-executor-live-read-only-bridge-boundary.md';
    observabilityProjection: 'docs/external-executor-live-observability-projection.md';
    eventStreamAdapter: 'docs/external-executor-read-only-event-stream-adapter.md';
    sessionHistoryBridge: 'docs/external-executor-session-history-read-only-bridge.md';
    dashboardAssimilation: 'docs/dashboard-live-assimilation.md';
    transportDiscovery: 'docs/real-message-transport-capability-discovery.md';
    nativeCapabilityRegistry: 'docs/first-native-capability-registry-replacement-slice.md';
    dashboardViewModelRegistry: 'docs/dashboard-view-model-registry-native-slice.md';
  };
  runtimeExternalExecutorRequiredForIntegrationLookup: false;
  runtimeExternalExecutorRequiredForTransportClassification: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  nativeReplacementAuthorizedForIntegrationMetadata: true;
  adapterRemovalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeIntegrationRegistryExecutionGate = {
  runtimeExternalExecutorRequiredForIntegrationLookup: false;
  runtimeExternalExecutorRequiredForTransportClassification: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  transportActuallyOpened: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorizedForIntegrationMetadata: true;
  adapterRemovalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeIntegrationRegistryIntegration = {
  nativeContract: 'ZavorthNativeIntegrationRegistryIntegration/v1';
  capabilityRegistryCrossReferenceReady: true;
  dashboardProjectionReady: true;
  sendCapableTransportsBlocked: true;
  secretRefsMetadataOnly: true;
  liveExternalExecutorOptionalForRefreshOnly: true;
  runtimeExternalExecutorRequiredForIntegrationLookup: false;
  runtimeExternalExecutorRequiredForTransportClassification: false;
  publicSourceIdentityExposed: false;
};

export type ZavorthNativeIntegrationRegistrySource = {
  realCapabilitySnapshot: ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization;
  liveReadOnlyBridge: ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization;
  observabilityProjection: ExternalExecutorLiveObservabilityProjectionNormalization;
  eventStreamAdapter: ExternalExecutorReadOnlyEventStreamAdapterNormalization;
  sessionHistoryBridge: ExternalExecutorSessionHistoryReadOnlyBridgeNormalization;
  dashboardAssimilation: RuntimeAdapterDashboardLiveAssimilationNormalization;
  transportDiscovery: ZavorthMessageTransportCapabilityDiscoveryNormalization;
  nativeCapabilityRegistry: ZavorthNativeCapabilityRegistryReplacementNormalization;
  capabilityRegistry: ZavorthNativeCapabilityRegistry;
  dashboardViewModelRegistry: ZavorthNativeDashboardViewModelRegistryNormalization;
  dashboardRegistry: ZavorthNativeDashboardViewModelRegistry;
  gatewayLiveCalledDuringLookup: false;
  externalTransportOpened: false;
  providerExecuted: false;
};

export type ZavorthNativeIntegrationRegistryNormalization = {
  nativeContract: 'ZavorthNativeIntegrationRegistrySlice/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthNativeIntegrationRegistryDecision;
  status: 'blocked' | 'native-integration-registry-ready';
  sourceReadiness: {
    realCapabilitySnapshot: ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization['decision'];
    liveReadOnlyBridge: ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization['decision'];
    observabilityProjection: ExternalExecutorLiveObservabilityProjectionNormalization['decision'];
    eventStreamAdapter: ExternalExecutorReadOnlyEventStreamAdapterNormalization['decision'];
    sessionHistoryBridge: ExternalExecutorSessionHistoryReadOnlyBridgeNormalization['decision'];
    dashboardAssimilation: RuntimeAdapterDashboardLiveAssimilationNormalization['decision'];
    transportDiscovery: ZavorthMessageTransportCapabilityDiscoveryNormalization['decision'];
    nativeCapabilityRegistry: ZavorthNativeCapabilityRegistryReplacementNormalization['decision'];
    dashboardViewModelRegistry: ZavorthNativeDashboardViewModelRegistryNormalization['decision'];
  };
  registry: ZavorthNativeIntegrationRegistrySnapshot;
  crossReferences: ZavorthNativeIntegrationCapabilityCrossReference[];
  dashboardProjection: ZavorthNativeIntegrationDashboardProjection[];
  integration: ZavorthNativeIntegrationRegistryIntegration;
  dependencyReductionProof: {
    lookupWorksWithoutLiveExternalExecutor: true;
    listWorksWithoutLiveExternalExecutor: true;
    filterWorksWithoutLiveExternalExecutor: true;
    classifyWorksWithoutLiveExternalExecutor: true;
    capabilityRegistryCrossReferenceWorks: true;
    dashboardProjectionConsumesNativeMetadata: true;
  };
  executionGate: ZavorthNativeIntegrationRegistryExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    secretRefsMetadataOnly: true;
    sourceIdentityPublic: false;
    sourceStructuresPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-native-integration-refresh-or-dashboard-consistency-gate';
};

export type ZavorthNativeIntegrationRegistryOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  source: ZavorthNativeIntegrationRegistrySource;
};

function emptyKindIndex(): Record<ZavorthNativeIntegrationKind, number> {
  return {
    channel: 0,
    'message-transport': 0,
    provider: 0,
  };
}

function emptyClassificationIndex(): Record<ZavorthNativeIntegrationClassification, number> {
  return {
    blocked: 0,
    degraded: 0,
    'read-only': 0,
    'send-capable-but-blocked': 0,
    unavailable: 0,
    unknown: 0,
  };
}

function provenance(
  sourceKind: ZavorthNativeIntegrationProvenanceKind,
  sourceEvidenceIds: string[],
): ZavorthNativeIntegrationProvenance {
  return {
    nativeContract: 'ZavorthNativeIntegrationProvenance/v1',
    sourceKind,
    sourceEvidenceIds,
    sourceRuntimeNameInternal: 'ExternalExecutor',
    sourceRuntimePublicIdentity: false,
    sourceStructuresPublic: false,
    sourceIdsEvidenceOnly: true,
    redacted: true,
  };
}

function statusFromCapability(entry: ZavorthNativeCapabilityRegistryEntry): ZavorthNativeIntegrationStatus {
  if (entry.classification === 'read-only' || entry.classification === 'approval-required') {
    return entry.availability === 'degraded' ? 'degraded' : 'ready';
  }
  if (entry.classification === 'send-capable-but-blocked' || entry.classification === 'blocked') {
    return 'blocked';
  }
  if (entry.classification === 'unavailable') {
    return 'unavailable';
  }
  if (entry.classification === 'unsupported') {
    return 'unknown';
  }
  return 'degraded';
}

function classificationFromCapability(
  entry: ZavorthNativeCapabilityRegistryEntry,
): ZavorthNativeIntegrationClassification {
  if (entry.classification === 'approval-required') {
    return 'read-only';
  }
  if (
    entry.classification === 'read-only' ||
    entry.classification === 'send-capable-but-blocked' ||
    entry.classification === 'blocked' ||
    entry.classification === 'degraded' ||
    entry.classification === 'unavailable'
  ) {
    return entry.classification;
  }
  return 'unknown';
}

function secretRef(
  name: string,
  purpose: ZavorthNativeIntegrationSecretRefMetadata['purpose'],
  status: ZavorthNativeIntegrationSecretRefMetadata['status'] = 'metadata-only',
): ZavorthNativeIntegrationSecretRefMetadata {
  return {
    nativeContract: 'ZavorthNativeIntegrationSecretRefMetadata/v1',
    name,
    purpose,
    status,
    rawValueSerialized: false,
  };
}

function dashboardIdsForType(
  dashboardRegistry: ZavorthNativeDashboardViewModelRegistry,
  viewType: 'channel' | 'provider' | 'transport-metadata',
): string[] {
  return dashboardRegistry.list({ viewType }).map((view) => view.id);
}

function providerRecords(
  idPrefix: string,
  source: ZavorthNativeIntegrationRegistrySource,
): ZavorthNativeIntegrationRecord[] {
  const providerEntries = source.capabilityRegistry.list({ kind: 'provider' });
  const authProviderRefs = source.transportDiscovery.discoveryEvidence.configuredAuthProviders
    .map((provider) => secretRef(`external-auth-${provider.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`, 'provider-auth-metadata'));

  return providerEntries.map((entry, index) => ({
    nativeContract: 'ZavorthNativeIntegrationRecord/v1',
    id: `${idPrefix}:provider-${index + 1}`,
    integrationKind: 'provider',
    integrationType: 'provider-metadata',
    status: statusFromCapability(entry),
    classification: classificationFromCapability(entry),
    configured: authProviderRefs.length > 0,
    supportsSend: false,
    supportsReceive: false,
    supportsDryRun: false,
    sendPolicy: 'not-supported',
    receivePolicy: 'not-supported',
    requiredSecretRefs: authProviderRefs,
    requiredScopes: ['provider.metadata.read'],
    requiredPermissions: ['provider.metadata.readonly'],
    targetRequirements: ['none'],
    rateLimitModel: 'not-exposed-by-read-only-discovery',
    ackModel: 'metadata-only',
    errorModel: 'degraded-provider-metadata',
    capabilityRegistryEntryIds: [entry.id],
    dashboardViewModelIds: dashboardIdsForType(source.dashboardRegistry, 'provider'),
    provenance: provenance('native-capability-registry', [
      entry.id,
      'docs/real-capability-snapshot-read-only.md',
      'docs/first-native-capability-registry-replacement-slice.md',
    ]),
    runtimeExternalExecutorRequiredForIntegrationLookup: false,
    runtimeExternalExecutorRequiredForTransportClassification: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    transportActuallyOpened: false,
    sourceModuleCopied: false,
    adapterRemovalAllowed: false,
    rawSecretSerialized: false,
  }));
}

function channelRecords(
  idPrefix: string,
  source: ZavorthNativeIntegrationRegistrySource,
): ZavorthNativeIntegrationRecord[] {
  const channelEntries = source.capabilityRegistry.list({ kind: 'channel' });

  return channelEntries.map((entry, index) => ({
    nativeContract: 'ZavorthNativeIntegrationRecord/v1',
    id: `${idPrefix}:channel-${index + 1}`,
    integrationKind: 'channel',
    integrationType: 'channel-metadata',
    status: statusFromCapability(entry),
    classification: classificationFromCapability(entry),
    configured: false,
    supportsSend: false,
    supportsReceive: true,
    supportsDryRun: false,
    sendPolicy: 'not-supported',
    receivePolicy: 'metadata-only',
    requiredSecretRefs: [],
    requiredScopes: ['channel.metadata.read'],
    requiredPermissions: ['channel.metadata.readonly'],
    targetRequirements: ['channel id metadata only'],
    rateLimitModel: 'not-exposed-by-read-only-discovery',
    ackModel: 'metadata-only',
    errorModel: 'degraded-channel-metadata',
    capabilityRegistryEntryIds: [entry.id],
    dashboardViewModelIds: dashboardIdsForType(source.dashboardRegistry, 'channel'),
    provenance: provenance('live-read-only-bridge', [
      entry.id,
      'docs/external-executor-live-read-only-bridge-boundary.md',
      'docs/first-native-capability-registry-replacement-slice.md',
    ]),
    runtimeExternalExecutorRequiredForIntegrationLookup: false,
    runtimeExternalExecutorRequiredForTransportClassification: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    transportActuallyOpened: false,
    sourceModuleCopied: false,
    adapterRemovalAllowed: false,
    rawSecretSerialized: false,
  }));
}

function statusFromTransport(capability: ZavorthExternalMessageTransportCapability): ZavorthNativeIntegrationStatus {
  if (capability.status === 'read-only') {
    return 'ready';
  }
  if (capability.status === 'degraded-unknown') {
    return 'unknown';
  }
  return capability.configured ? 'blocked' : 'unavailable';
}

function classificationFromTransport(
  capability: ZavorthExternalMessageTransportCapability,
): ZavorthNativeIntegrationClassification {
  if (capability.status === 'read-only') {
    return 'read-only';
  }
  if (capability.supportsSend) {
    return 'send-capable-but-blocked';
  }
  if (capability.status === 'degraded-unknown') {
    return 'unknown';
  }
  return 'unavailable';
}

function transportCapabilityEntryId(
  capabilityRegistry: ZavorthNativeCapabilityRegistry,
  transportKind: string,
): string[] {
  return capabilityRegistry
    .list({ kind: 'message-transport' })
    .filter((entry) => entry.id.endsWith(`-${transportKind}`) || entry.publicLabel.toLowerCase().endsWith(`: ${transportKind}`))
    .map((entry) => entry.id);
}

function transportRecords(
  idPrefix: string,
  source: ZavorthNativeIntegrationRegistrySource,
): ZavorthNativeIntegrationRecord[] {
  return source.transportDiscovery.capabilities.map((capability, index) => {
    const capabilityRegistryEntryIds = transportCapabilityEntryId(source.capabilityRegistry, capability.transportKind);
    const requiredSecretRefs = capability.secretRef
      ? [secretRef(capability.secretRef.name, capability.secretRef.purpose, capability.secretRef.status)]
      : [];

    return {
      nativeContract: 'ZavorthNativeIntegrationRecord/v1',
      id: `${idPrefix}:transport-${index + 1}-${capability.transportKind}`,
      integrationKind: 'message-transport',
      integrationType: capability.transportKind,
      status: statusFromTransport(capability),
      classification: classificationFromTransport(capability),
      configured: capability.configured,
      supportsSend: capability.supportsSend,
      supportsReceive: capability.transportKind === 'status-only',
      supportsDryRun: capability.supportsDryRun,
      sendPolicy: capability.supportsSend ? 'blocked' : 'not-supported',
      receivePolicy: capability.transportKind === 'status-only' ? 'metadata-only' : 'unknown',
      requiredSecretRefs,
      requiredScopes: capability.requiredScopes,
      requiredPermissions: capability.requiredScopes.map((scope) => `${scope}:readonly-metadata`),
      targetRequirements: capability.targetRequirements,
      rateLimitModel: capability.rateLimitModel,
      ackModel: capability.ackModel,
      errorModel: capability.errorModel,
      capabilityRegistryEntryIds,
      dashboardViewModelIds: dashboardIdsForType(source.dashboardRegistry, 'transport-metadata')
        .filter((id) => capabilityRegistryEntryIds.some((capabilityId) => id.includes(capabilityId.split(':').pop() || capability.transportKind))),
      provenance: provenance('transport-discovery', [
        capability.id,
        ...capability.sourceEvidence,
        'docs/real-message-transport-capability-discovery.md',
      ]),
      runtimeExternalExecutorRequiredForIntegrationLookup: false,
      runtimeExternalExecutorRequiredForTransportClassification: false,
      sourceRuntimeAuthority: false,
      executionAuthority: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      transportActuallyOpened: false,
      sourceModuleCopied: false,
      adapterRemovalAllowed: false,
      rawSecretSerialized: false,
    };
  });
}

function createRecords(
  idPrefix: string,
  source: ZavorthNativeIntegrationRegistrySource,
): ZavorthNativeIntegrationRecord[] {
  return [
    ...providerRecords(idPrefix, source),
    ...channelRecords(idPrefix, source),
    ...transportRecords(idPrefix, source),
  ];
}

function byKindIndex(records: ZavorthNativeIntegrationRecord[]): Record<ZavorthNativeIntegrationKind, number> {
  const index = emptyKindIndex();
  records.forEach((record) => {
    index[record.integrationKind] += 1;
  });
  return index;
}

function byClassificationIndex(
  records: ZavorthNativeIntegrationRecord[],
): Record<ZavorthNativeIntegrationClassification, number> {
  const index = emptyClassificationIndex();
  records.forEach((record) => {
    index[record.classification] += 1;
  });
  return index;
}

function operationalStatus(status: ZavorthNativeIntegrationStatus): RuntimeAdapterDashboardOperationalStatus {
  if (status === 'ready') {
    return 'ready';
  }
  if (status === 'blocked') {
    return 'blocked';
  }
  if (status === 'unavailable') {
    return 'unavailable';
  }
  if (status === 'unknown') {
    return 'unknown';
  }
  return 'degraded';
}

function buildSnapshot(
  options: ZavorthNativeIntegrationRegistryOptions,
): ZavorthNativeIntegrationRegistrySnapshot {
  const records = createRecords(options.idPrefix, options.source);

  return {
    nativeContract: 'ZavorthNativeIntegrationRegistry/v1',
    id: `${options.idPrefix}:registry`,
    generatedAt: options.generatedAt,
    records,
    indexes: {
      byKind: byKindIndex(records),
      byClassification: byClassificationIndex(records),
      sendCapableBlockedIds: records
        .filter((record) => record.supportsSend && record.sendPolicy === 'blocked')
        .map((record) => record.id),
      secretRefRequiredIds: records
        .filter((record) => record.requiredSecretRefs.length > 0)
        .map((record) => record.id),
      degradedOrUnavailableIds: records
        .filter((record) => record.status === 'degraded' || record.status === 'unavailable' || record.status === 'unknown')
        .map((record) => record.id),
    },
    sourceArtifactsConsumed: {
      realCapabilitySnapshot: 'docs/real-capability-snapshot-read-only.md',
      liveReadOnlyBridge: 'docs/external-executor-live-read-only-bridge-boundary.md',
      observabilityProjection: 'docs/external-executor-live-observability-projection.md',
      eventStreamAdapter: 'docs/external-executor-read-only-event-stream-adapter.md',
      sessionHistoryBridge: 'docs/external-executor-session-history-read-only-bridge.md',
      dashboardAssimilation: 'docs/dashboard-live-assimilation.md',
      transportDiscovery: 'docs/real-message-transport-capability-discovery.md',
      nativeCapabilityRegistry: 'docs/first-native-capability-registry-replacement-slice.md',
      dashboardViewModelRegistry: 'docs/dashboard-view-model-registry-native-slice.md',
    },
    runtimeExternalExecutorRequiredForIntegrationLookup: false,
    runtimeExternalExecutorRequiredForTransportClassification: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    nativeReplacementAuthorizedForIntegrationMetadata: true,
    adapterRemovalAllowed: false,
    rawSecretSerialized: false,
  };
}

function sourceReady(source: ZavorthNativeIntegrationRegistrySource): boolean {
  return (
    source.realCapabilitySnapshot.decision === 'real-capability-snapshot-read-only-ok' &&
    source.liveReadOnlyBridge.decision === 'external-executor-live-read-only-bridge-boundary-ready' &&
    source.observabilityProjection.decision === 'external-executor-live-observability-projection-ready' &&
    source.eventStreamAdapter.decision === 'external-executor-read-only-event-stream-adapter-ready' &&
    source.sessionHistoryBridge.decision === 'external-executor-session-history-read-only-bridge-ready' &&
    source.dashboardAssimilation.decision === 'dashboard-live-assimilation-ready' &&
    source.transportDiscovery.decision === 'real-message-transport-capability-discovery-ready' &&
    source.nativeCapabilityRegistry.decision === 'native-capability-registry-replacement-ready' &&
    source.dashboardViewModelRegistry.decision === 'native-dashboard-view-model-registry-ready' &&
    !source.gatewayLiveCalledDuringLookup &&
    !source.externalTransportOpened &&
    !source.providerExecuted
  );
}

function executionGate(): ZavorthNativeIntegrationRegistryExecutionGate {
  return {
    runtimeExternalExecutorRequiredForIntegrationLookup: false,
    runtimeExternalExecutorRequiredForTransportClassification: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    transportActuallyOpened: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorizedForIntegrationMetadata: true,
    adapterRemovalAllowed: false,
    rawSecretSerialized: false,
  };
}

function crossReferences(records: ZavorthNativeIntegrationRecord[]): ZavorthNativeIntegrationCapabilityCrossReference[] {
  return records.map((record) => ({
    nativeContract: 'ZavorthNativeIntegrationCapabilityCrossReference/v1',
    integrationId: record.id,
    capabilityRegistryEntryIds: record.capabilityRegistryEntryIds,
    dashboardViewModelIds: record.dashboardViewModelIds,
    capabilityRegistryLookupRequiredExternalExecutorLive: false,
    dashboardLookupRequiredExternalExecutorLive: false,
    sourceAuthorityGranted: false,
  }));
}

function dashboardProjection(records: ZavorthNativeIntegrationRecord[]): ZavorthNativeIntegrationDashboardProjection[] {
  return records.map((record) => ({
    nativeContract: 'ZavorthNativeIntegrationDashboardProjection/v1',
    id: `${record.id}:dashboard-projection`,
    integrationId: record.id,
    integrationKind: record.integrationKind,
    label: `${record.integrationKind} integration: ${record.integrationType}`,
    status: operationalStatus(record.status),
    classification: record.classification,
    secretRefCount: record.requiredSecretRefs.length,
    supportsSend: record.supportsSend,
    sendPolicy: record.sendPolicy,
    dashboardConsumable: true,
    sourceIdentityPublic: false,
    executionAuthority: false,
  }));
}

function matchesFilter(record: ZavorthNativeIntegrationRecord, filter: ZavorthNativeIntegrationRegistryFilter): boolean {
  if (filter.integrationKind && record.integrationKind !== filter.integrationKind) {
    return false;
  }
  if (filter.status && record.status !== filter.status) {
    return false;
  }
  if (filter.classification && record.classification !== filter.classification) {
    return false;
  }
  if (filter.requiresSecretRef !== undefined && (record.requiredSecretRefs.length > 0) !== filter.requiresSecretRef) {
    return false;
  }
  if (filter.supportsSend !== undefined && record.supportsSend !== filter.supportsSend) {
    return false;
  }
  if (filter.degradedOrUnavailable && record.status !== 'degraded' && record.status !== 'unavailable' && record.status !== 'unknown') {
    return false;
  }
  return true;
}

export class ZavorthNativeIntegrationRegistry {
  private readonly recordsById: Map<string, ZavorthNativeIntegrationRecord>;

  public constructor(public readonly snapshot: ZavorthNativeIntegrationRegistrySnapshot) {
    this.recordsById = new Map(snapshot.records.map((record) => [record.id, record]));
  }

  public list(filter: ZavorthNativeIntegrationRegistryFilter = {}): ZavorthNativeIntegrationRecord[] {
    return this.snapshot.records.filter((record) => matchesFilter(record, filter));
  }

  public lookup(id: string): ZavorthNativeIntegrationLookupResult {
    const record = this.recordsById.get(id);

    return {
      nativeContract: 'ZavorthNativeIntegrationLookupResult/v1',
      lookupId: id,
      found: Boolean(record),
      ...(record ? { record } : {}),
      runtimeExternalExecutorRequiredForIntegrationLookup: false,
      runtimeExternalExecutorRequiredForTransportClassification: false,
      sourceRuntimeAuthority: false,
    };
  }

  public classify(id: string): ZavorthNativeIntegrationClassification | 'missing' {
    return this.recordsById.get(id)?.classification ?? 'missing';
  }

  public toDashboardProjection(): ZavorthNativeIntegrationDashboardProjection[] {
    return dashboardProjection(this.snapshot.records);
  }
}

export function createZavorthNativeIntegrationRegistryFixtureSource(): ZavorthNativeIntegrationRegistrySource {
  return {
    realCapabilitySnapshot: normalizeExternalExecutorRealCapabilitySnapshotReadOnlyFixture(),
    liveReadOnlyBridge: normalizeExternalExecutorLiveReadOnlyBridgeBoundaryFixture(),
    observabilityProjection: normalizeExternalExecutorLiveObservabilityProjectionFixture(),
    eventStreamAdapter: normalizeExternalExecutorReadOnlyEventStreamAdapterFixture(),
    sessionHistoryBridge: normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture(),
    dashboardAssimilation: normalizeRuntimeAdapterDashboardLiveAssimilationFixture(),
    transportDiscovery: normalizeMessageTransportCapabilityDiscoveryFixture(),
    nativeCapabilityRegistry: normalizeZavorthNativeCapabilityRegistryReplacementFixture(),
    capabilityRegistry: createZavorthNativeCapabilityRegistryFixture(),
    dashboardViewModelRegistry: normalizeZavorthNativeDashboardViewModelRegistryFixture(),
    dashboardRegistry: createZavorthNativeDashboardViewModelRegistryFixture(),
    gatewayLiveCalledDuringLookup: false,
    externalTransportOpened: false,
    providerExecuted: false,
  };
}

export function normalizeZavorthNativeIntegrationRegistry<TRuntimeId extends string>(
  options: ZavorthNativeIntegrationRegistryOptions<TRuntimeId>,
): ZavorthNativeIntegrationRegistryNormalization {
  const registry = buildSnapshot(options);
  const refs = crossReferences(registry.records);
  const projection = dashboardProjection(registry.records);
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    registry.records.length > 0 &&
    registry.indexes.byKind.provider > 0 &&
    registry.indexes.byKind.channel > 0 &&
    registry.indexes.byKind['message-transport'] > 0 &&
    registry.indexes.sendCapableBlockedIds.length > 0 &&
    registry.indexes.secretRefRequiredIds.length > 0 &&
    registry.indexes.degradedOrUnavailableIds.length > 0;

  return {
    nativeContract: 'ZavorthNativeIntegrationRegistrySlice/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'native-integration-registry-ready' : 'blocked',
    status: ready ? 'native-integration-registry-ready' : 'blocked',
    sourceReadiness: {
      realCapabilitySnapshot: options.source.realCapabilitySnapshot.decision,
      liveReadOnlyBridge: options.source.liveReadOnlyBridge.decision,
      observabilityProjection: options.source.observabilityProjection.decision,
      eventStreamAdapter: options.source.eventStreamAdapter.decision,
      sessionHistoryBridge: options.source.sessionHistoryBridge.decision,
      dashboardAssimilation: options.source.dashboardAssimilation.decision,
      transportDiscovery: options.source.transportDiscovery.decision,
      nativeCapabilityRegistry: options.source.nativeCapabilityRegistry.decision,
      dashboardViewModelRegistry: options.source.dashboardViewModelRegistry.decision,
    },
    registry,
    crossReferences: refs,
    dashboardProjection: projection,
    integration: {
      nativeContract: 'ZavorthNativeIntegrationRegistryIntegration/v1',
      capabilityRegistryCrossReferenceReady: true,
      dashboardProjectionReady: true,
      sendCapableTransportsBlocked: true,
      secretRefsMetadataOnly: true,
      liveExternalExecutorOptionalForRefreshOnly: true,
      runtimeExternalExecutorRequiredForIntegrationLookup: false,
      runtimeExternalExecutorRequiredForTransportClassification: false,
      publicSourceIdentityExposed: false,
    },
    dependencyReductionProof: {
      lookupWorksWithoutLiveExternalExecutor: true,
      listWorksWithoutLiveExternalExecutor: true,
      filterWorksWithoutLiveExternalExecutor: true,
      classifyWorksWithoutLiveExternalExecutor: true,
      capabilityRegistryCrossReferenceWorks: true,
      dashboardProjectionConsumesNativeMetadata: true,
    },
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      secretRefsMetadataOnly: true,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-native-integration-refresh-or-dashboard-consistency-gate',
  };
}

export function normalizeZavorthNativeIntegrationRegistryFixture(): ZavorthNativeIntegrationRegistryNormalization {
  return normalizeZavorthNativeIntegrationRegistry({
    generatedAt: ZAVORTH_NATIVE_INTEGRATION_REGISTRY_NOW,
    runtimeId: ZAVORTH_NATIVE_INTEGRATION_REGISTRY_RUNTIME_ID,
    idPrefix: 'zavorth-native-integration-registry',
    source: createZavorthNativeIntegrationRegistryFixtureSource(),
  });
}

export function createZavorthNativeIntegrationRegistryFixture(): ZavorthNativeIntegrationRegistry {
  return new ZavorthNativeIntegrationRegistry(
    normalizeZavorthNativeIntegrationRegistryFixture().registry,
  );
}
