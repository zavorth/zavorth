import {
  createZavorthNativeCapabilityRegistryFixture,
  normalizeZavorthNativeCapabilityRegistryReplacementFixture,
} from './ZavorthNativeCapabilityRegistry.js';
import {
  createZavorthNativeConfigStateRegistryFixture,
  normalizeZavorthNativeConfigStateRegistryFixture,
} from './ZavorthNativeConfigStateRegistry.js';
import {
  createZavorthNativeDashboardViewModelRegistryFixture,
  normalizeZavorthNativeDashboardViewModelRegistryFixture,
} from './ZavorthNativeDashboardViewModelRegistry.js';
import {
  createZavorthNativeIntegrationRegistryFixture,
  normalizeZavorthNativeIntegrationRegistryFixture,
} from './ZavorthNativeIntegrationRegistry.js';
import {
  createZavorthNativeSessionHistoryRegistryFixture,
  normalizeZavorthNativeSessionHistoryRegistryFixture,
} from './ZavorthNativeSessionHistoryRegistry.js';
import {
  normalizeExternalAgentCommandCenterLiveAssimilationFixture,
} from './ExternalAgentCommandCenterLiveAssimilation.js';
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
  ZavorthNativeCapabilityRegistryReplacementNormalization,
} from './ZavorthNativeCapabilityRegistry.js';
import type {
  ZavorthNativeConfigStateRegistry,
  ZavorthNativeConfigStateRegistryNormalization,
} from './ZavorthNativeConfigStateRegistry.js';
import type {
  ZavorthNativeDashboardViewModelRegistry,
  ZavorthNativeDashboardViewModelRegistryNormalization,
} from './ZavorthNativeDashboardViewModelRegistry.js';
import type {
  ZavorthNativeIntegrationRegistry,
  ZavorthNativeIntegrationRegistryNormalization,
} from './ZavorthNativeIntegrationRegistry.js';
import type {
  ZavorthNativeSessionHistoryRegistry,
  ZavorthNativeSessionHistoryRegistryNormalization,
} from './ZavorthNativeSessionHistoryRegistry.js';
import type {
  ExternalAgentCommandCenterLiveAssimilationNormalization,
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

export const ZAVORTH_NATIVE_REGISTRY_PARITY_NOW = '2026-04-29T03:00:00.000Z' as const;
export const ZAVORTH_NATIVE_REGISTRY_PARITY_RUNTIME_ID = 'zavorth-native-registry-parity-dependency-reduction' as const;

export type ZavorthNativeRegistryParityDecision =
  | 'blocked'
  | 'native-registry-parity-ready';

export type ZavorthNativeRegistryParitySurfaceId =
  | 'action-dispatch-execution'
  | 'capability-lookup-classify'
  | 'config-secretref-state-metadata-lookup'
  | 'dashboard-render-view-lookup'
  | 'live-refresh-reconciliation'
  | 'provider-channel-transport-metadata-lookup'
  | 'session-history-metadata-lookup'
  | 'state-migration-import';

export type ZavorthNativeRegistryParitySurfaceClassification =
  | 'adapter-required'
  | 'blocked'
  | 'degraded'
  | 'native-partial'
  | 'native-ready';

export type ZavorthNativeRegistryParityResult =
  | 'adapter-required-for-live-refresh'
  | 'blocked-by-policy'
  | 'degraded-parity'
  | 'native-parity-sufficient-for-selected-surface'
  | 'native-parity-sufficient-with-gaps';

export type ZavorthNativeRegistryParitySurface = {
  nativeContract: 'ZavorthNativeRegistryParitySurface/v1';
  id: ZavorthNativeRegistryParitySurfaceId;
  label: string;
  classification: ZavorthNativeRegistryParitySurfaceClassification;
  nativeRegistryIds: string[];
  baselineArtifactIds: string[];
  nativeRecordCount: number;
  baselineRecordCount: number;
  parityResult: ZavorthNativeRegistryParityResult;
  commandCenterNativePathReady: boolean;
  gaps: string[];
  runtimeExternalExecutorRequiredForLookup: false;
  runtimeExternalExecutorRequiredForRender: false;
  adapterRequiredForSurface: boolean;
  adapterRemovalAllowed: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryParityExecutionGate = {
  runtimeExternalExecutorRequiredForNativeReadyLookup: false;
  runtimeExternalExecutorRequiredForNativeReadyRender: false;
  adapterRemovalAllowed: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryDependencyReduction = {
  nativeContract: 'ZavorthNativeRegistryDependencyReduction/v1';
  capabilityLookupNativeReady: true;
  dashboardRenderNativeReady: true;
  integrationLookupNativeReady: true;
  sessionHistoryLookupNativeReady: true;
  configStateLookupNativeReady: true;
  commandCenterCanUseNativeReadySurfaces: true;
  liveExternalExecutorOptionalForRefreshOnly: true;
  adapterStillRequiredForRefreshReconciliation: true;
  adapterStillRequiredForUnreplacedSurfaces: true;
  adapterRemovalAllowed: false;
};

export type ZavorthNativeRegistryParityGap = {
  nativeContract: 'ZavorthNativeRegistryParityGap/v1';
  id: string;
  label: string;
  classification: 'adapter-required' | 'blocked' | 'deferred';
  affectedSurfaceIds: ZavorthNativeRegistryParitySurfaceId[];
  nextGateRequired: string;
  adapterRemovalAllowed: false;
  executionAuthority: false;
};

export type ZavorthNativeRegistryParityCommandCenterRoute = {
  nativeContract: 'ZavorthNativeRegistryParityCommandCenterRoute/v1';
  id: string;
  sourceSurfaceId: ZavorthNativeRegistryParitySurfaceId;
  registryId: string;
  commandCenterUsesNativeRegistry: true;
  runtimeExternalExecutorRequiredForRender: false;
  publicSourceIdentityExposed: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryParitySource = {
  realCapabilitySnapshot: ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization;
  liveReadOnlyBridge: ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization;
  observabilityProjection: ExternalExecutorLiveObservabilityProjectionNormalization;
  eventStreamAdapter: ExternalExecutorReadOnlyEventStreamAdapterNormalization;
  sessionHistoryBridge: ExternalExecutorSessionHistoryReadOnlyBridgeNormalization;
  commandCenterAssimilation: ExternalAgentCommandCenterLiveAssimilationNormalization;
  nativeCapabilityRegistry: ZavorthNativeCapabilityRegistryReplacementNormalization;
  capabilityRegistry: ZavorthNativeCapabilityRegistry;
  nativeDashboardViewModelRegistry: ZavorthNativeDashboardViewModelRegistryNormalization;
  dashboardRegistry: ZavorthNativeDashboardViewModelRegistry;
  nativeIntegrationRegistry: ZavorthNativeIntegrationRegistryNormalization;
  integrationRegistry: ZavorthNativeIntegrationRegistry;
  nativeSessionHistoryRegistry: ZavorthNativeSessionHistoryRegistryNormalization;
  sessionHistoryRegistry: ZavorthNativeSessionHistoryRegistry;
  nativeConfigStateRegistry: ZavorthNativeConfigStateRegistryNormalization;
  configStateRegistry: ZavorthNativeConfigStateRegistry;
  externalExecutorLiveCalledDuringNativeLookup: false;
  externalExecutorLiveCalledDuringNativeRender: false;
  adapterRemovalAttempted: false;
  executionAttempted: false;
  stateMigrationAttempted: false;
};

export type ZavorthNativeRegistryParityNormalization = {
  nativeContract: 'ZavorthNativeRegistryParityDependencyReduction/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthNativeRegistryParityDecision;
  status: 'blocked' | 'native-registry-parity-ready';
  sourceReadiness: {
    realCapabilitySnapshot: ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization['decision'];
    liveReadOnlyBridge: ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization['decision'];
    observabilityProjection: ExternalExecutorLiveObservabilityProjectionNormalization['decision'];
    eventStreamAdapter: ExternalExecutorReadOnlyEventStreamAdapterNormalization['decision'];
    sessionHistoryBridge: ExternalExecutorSessionHistoryReadOnlyBridgeNormalization['decision'];
    commandCenterAssimilation: ExternalAgentCommandCenterLiveAssimilationNormalization['decision'];
    nativeCapabilityRegistry: ZavorthNativeCapabilityRegistryReplacementNormalization['decision'];
    nativeDashboardViewModelRegistry: ZavorthNativeDashboardViewModelRegistryNormalization['decision'];
    nativeIntegrationRegistry: ZavorthNativeIntegrationRegistryNormalization['decision'];
    nativeSessionHistoryRegistry: ZavorthNativeSessionHistoryRegistryNormalization['decision'];
    nativeConfigStateRegistry: ZavorthNativeConfigStateRegistryNormalization['decision'];
  };
  surfaces: ZavorthNativeRegistryParitySurface[];
  commandCenterNativeRoutes: ZavorthNativeRegistryParityCommandCenterRoute[];
  dependencyReduction: ZavorthNativeRegistryDependencyReduction;
  remainingGaps: ZavorthNativeRegistryParityGap[];
  executionGate: ZavorthNativeRegistryParityExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    sourceIdentityPublic: false;
    sourceStructuresPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-native-refresh-reconciliation-or-adapter-removal-parity-gate';
};

export type ZavorthNativeRegistryParityOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  source: ZavorthNativeRegistryParitySource;
};

export type ZavorthNativeRegistryParitySurfaceFilter = {
  classification?: ZavorthNativeRegistryParitySurfaceClassification;
  nativeReady?: boolean;
  adapterRequired?: boolean;
};

function countCommandCenterAssimilationRows(source: ZavorthNativeRegistryParitySource): number {
  const viewModel = source.commandCenterAssimilation.viewModel;

  return [
    viewModel.runtime,
    viewModel.health,
    ...viewModel.capabilities,
    ...viewModel.events,
    ...viewModel.sessions,
    ...viewModel.messages,
    ...viewModel.channels,
    ...viewModel.plugins,
    ...viewModel.providers,
    ...viewModel.gatewayLifecycle,
  ].length;
}

function capabilitySurface(source: ZavorthNativeRegistryParitySource): ZavorthNativeRegistryParitySurface {
  return {
    nativeContract: 'ZavorthNativeRegistryParitySurface/v1',
    id: 'capability-lookup-classify',
    label: 'Capability lookup and classification',
    classification: 'native-ready',
    nativeRegistryIds: [source.nativeCapabilityRegistry.registry.id],
    baselineArtifactIds: [
      'docs/161-wave-1-real-capability-snapshot-read-only.md',
      'docs/169-wave-1-external-executor-live-read-only-bridge-boundary.md',
      'docs/170-wave-1-external-executor-live-observability-projection.md',
      'docs/171-wave-1-external-executor-read-only-event-stream-adapter.md',
      'docs/173-wave-1-command-center-live-assimilation.md',
      'docs/183-wave-2-real-message-transport-capability-discovery.md',
    ],
    nativeRecordCount: source.nativeCapabilityRegistry.registry.entries.length,
    baselineRecordCount: source.realCapabilitySnapshot.capabilityInventory.inventory.length +
      source.liveReadOnlyBridge.surfaces.length +
      source.commandCenterAssimilation.viewModel.capabilities.length,
    parityResult: 'native-parity-sufficient-for-selected-surface',
    commandCenterNativePathReady: true,
    gaps: ['live refresh/reconciliation remains adapter-required'],
    runtimeExternalExecutorRequiredForLookup: false,
    runtimeExternalExecutorRequiredForRender: false,
    adapterRequiredForSurface: false,
    adapterRemovalAllowed: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    stateMigrated: false,
    sourceModuleCopied: false,
    rawSecretSerialized: false,
  };
}

function dashboardSurface(source: ZavorthNativeRegistryParitySource): ZavorthNativeRegistryParitySurface {
  return {
    nativeContract: 'ZavorthNativeRegistryParitySurface/v1',
    id: 'dashboard-render-view-lookup',
    label: 'Command Center render and view lookup',
    classification: 'native-ready',
    nativeRegistryIds: [
      source.nativeDashboardViewModelRegistry.registry.id,
      source.nativeCapabilityRegistry.registry.id,
    ],
    baselineArtifactIds: [
      'docs/161-wave-1-real-capability-snapshot-read-only.md',
      'docs/169-wave-1-external-executor-live-read-only-bridge-boundary.md',
      'docs/170-wave-1-external-executor-live-observability-projection.md',
      'docs/171-wave-1-external-executor-read-only-event-stream-adapter.md',
      'docs/172-wave-1-external-executor-session-history-read-only-bridge.md',
      'docs/173-wave-1-command-center-live-assimilation.md',
    ],
    nativeRecordCount: source.nativeDashboardViewModelRegistry.registry.records.length,
    baselineRecordCount: countCommandCenterAssimilationRows(source),
    parityResult: 'native-parity-sufficient-for-selected-surface',
    commandCenterNativePathReady: true,
    gaps: ['live dashboard refresh remains adapter-required'],
    runtimeExternalExecutorRequiredForLookup: false,
    runtimeExternalExecutorRequiredForRender: false,
    adapterRequiredForSurface: false,
    adapterRemovalAllowed: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    stateMigrated: false,
    sourceModuleCopied: false,
    rawSecretSerialized: false,
  };
}

function integrationSurface(source: ZavorthNativeRegistryParitySource): ZavorthNativeRegistryParitySurface {
  const baselineIntegrationSurfaces = source.liveReadOnlyBridge.surfaces
    .filter((surface) => (
      surface.surfaceKind === 'channel' ||
      surface.surfaceKind === 'provider' ||
      surface.surfaceKind === 'message'
    ));

  return {
    nativeContract: 'ZavorthNativeRegistryParitySurface/v1',
    id: 'provider-channel-transport-metadata-lookup',
    label: 'Provider, channel, and transport metadata lookup',
    classification: 'native-ready',
    nativeRegistryIds: [
      source.nativeIntegrationRegistry.registry.id,
      source.nativeCapabilityRegistry.registry.id,
      source.nativeDashboardViewModelRegistry.registry.id,
    ],
    baselineArtifactIds: [
      'docs/161-wave-1-real-capability-snapshot-read-only.md',
      'docs/169-wave-1-external-executor-live-read-only-bridge-boundary.md',
      'docs/170-wave-1-external-executor-live-observability-projection.md',
      'docs/171-wave-1-external-executor-read-only-event-stream-adapter.md',
      'docs/173-wave-1-command-center-live-assimilation.md',
      'docs/183-wave-2-real-message-transport-capability-discovery.md',
    ],
    nativeRecordCount: source.nativeIntegrationRegistry.registry.records.length,
    baselineRecordCount: baselineIntegrationSurfaces.length +
      source.commandCenterAssimilation.viewModel.channels.length +
      source.commandCenterAssimilation.viewModel.providers.length,
    parityResult: 'native-parity-sufficient-with-gaps',
    commandCenterNativePathReady: true,
    gaps: [
      'send-capable transports remain blocked',
      'provider execution remains blocked',
      'real transport open remains blocked',
    ],
    runtimeExternalExecutorRequiredForLookup: false,
    runtimeExternalExecutorRequiredForRender: false,
    adapterRequiredForSurface: false,
    adapterRemovalAllowed: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    stateMigrated: false,
    sourceModuleCopied: false,
    rawSecretSerialized: false,
  };
}

function sessionSurface(source: ZavorthNativeRegistryParitySource): ZavorthNativeRegistryParitySurface {
  return {
    nativeContract: 'ZavorthNativeRegistryParitySurface/v1',
    id: 'session-history-metadata-lookup',
    label: 'Session, thread, and message metadata lookup',
    classification: 'native-ready',
    nativeRegistryIds: [
      source.nativeSessionHistoryRegistry.registry.id,
      source.nativeIntegrationRegistry.registry.id,
      source.nativeDashboardViewModelRegistry.registry.id,
    ],
    baselineArtifactIds: [
      'docs/167-wave-1-sqlite-session-store-dry-run-design.md',
      'docs/172-wave-1-external-executor-session-history-read-only-bridge.md',
      'docs/173-wave-1-command-center-live-assimilation.md',
      'docs/185-wave-3-first-native-capability-registry-replacement-slice.md',
      'docs/186-wave-3-dashboard-view-model-registry-native-slice.md',
      'docs/187-wave-3-provider-channel-transport-native-registry.md',
    ],
    nativeRecordCount: source.nativeSessionHistoryRegistry.registry.sessions.length +
      source.nativeSessionHistoryRegistry.registry.threads.length +
      source.nativeSessionHistoryRegistry.registry.messages.length,
    baselineRecordCount: source.sessionHistoryBridge.sessionViews.length +
      source.sessionHistoryBridge.sessionViews.reduce((total, view) => total + view.messages.length, 0) +
      source.commandCenterAssimilation.viewModel.sessions.length +
      source.commandCenterAssimilation.viewModel.messages.length,
    parityResult: 'native-parity-sufficient-with-gaps',
    commandCenterNativePathReady: true,
    gaps: [
      'raw message content remains unavailable or redacted',
      'real session import remains blocked',
      'source DB copy/write-open remains blocked',
    ],
    runtimeExternalExecutorRequiredForLookup: false,
    runtimeExternalExecutorRequiredForRender: false,
    adapterRequiredForSurface: false,
    adapterRemovalAllowed: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    stateMigrated: false,
    sourceModuleCopied: false,
    rawSecretSerialized: false,
  };
}

function configSurface(source: ZavorthNativeRegistryParitySource): ZavorthNativeRegistryParitySurface {
  return {
    nativeContract: 'ZavorthNativeRegistryParitySurface/v1',
    id: 'config-secretref-state-metadata-lookup',
    label: 'Config, SecretRef, state, cache, log, and rollback metadata lookup',
    classification: 'native-ready',
    nativeRegistryIds: [
      source.nativeConfigStateRegistry.registry.id,
      source.nativeCapabilityRegistry.registry.id,
      source.nativeIntegrationRegistry.registry.id,
      source.nativeSessionHistoryRegistry.registry.id,
    ],
    baselineArtifactIds: [
      'docs/157-wave-1-external-agent-secret-ref-resolver-injection-boundary.md',
      'docs/162-wave-0-external-agent-config-state-migration-strategy.md',
      'docs/163-wave-1-external-agent-config-state-read-only-inventory.md',
      'docs/164-wave-1-redaction-and-secretref-mapping.md',
      'docs/165-wave-1-dry-run-migration-plan.md',
      'docs/166-wave-1-rollback-restore-rehearsal.md',
      'docs/189-wave-3-config-secrets-state-native-registry.md',
    ],
    nativeRecordCount: source.nativeConfigStateRegistry.registry.records.length,
    baselineRecordCount: source.nativeConfigStateRegistry.registry.records.length,
    parityResult: 'native-parity-sufficient-with-gaps',
    commandCenterNativePathReady: true,
    gaps: [
      'SecretRef values remain unavailable by design',
      'config/state migration remains blocked',
      'backup/rollback rehearsal remains metadata-only',
    ],
    runtimeExternalExecutorRequiredForLookup: false,
    runtimeExternalExecutorRequiredForRender: false,
    adapterRequiredForSurface: false,
    adapterRemovalAllowed: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    stateMigrated: false,
    sourceModuleCopied: false,
    rawSecretSerialized: false,
  };
}

function liveRefreshSurface(): ZavorthNativeRegistryParitySurface {
  return {
    nativeContract: 'ZavorthNativeRegistryParitySurface/v1',
    id: 'live-refresh-reconciliation',
    label: 'Live refresh and reconciliation',
    classification: 'adapter-required',
    nativeRegistryIds: [],
    baselineArtifactIds: [
      'docs/156-wave-1-authenticated-ephemeral-external-executor-gateway-health-probe.md',
      'docs/161-wave-1-real-capability-snapshot-read-only.md',
      'docs/176-wave-2-first-governed-read-only-gateway-action.md',
      'docs/177-wave-2-governed-read-only-capability-refresh.md',
    ],
    nativeRecordCount: 0,
    baselineRecordCount: 2,
    parityResult: 'adapter-required-for-live-refresh',
    commandCenterNativePathReady: false,
    gaps: ['future refresh/reconciliation still needs explicit adapter/live gate'],
    runtimeExternalExecutorRequiredForLookup: false,
    runtimeExternalExecutorRequiredForRender: false,
    adapterRequiredForSurface: true,
    adapterRemovalAllowed: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    stateMigrated: false,
    sourceModuleCopied: false,
    rawSecretSerialized: false,
  };
}

function actionDispatchSurface(): ZavorthNativeRegistryParitySurface {
  return {
    nativeContract: 'ZavorthNativeRegistryParitySurface/v1',
    id: 'action-dispatch-execution',
    label: 'Action dispatch and external execution',
    classification: 'blocked',
    nativeRegistryIds: [],
    baselineArtifactIds: [
      'docs/174-wave-2-controlled-action-dispatch-design.md',
      'docs/175-wave-2-controlled-dry-run-action-planner.md',
      'docs/178-wave-2-approval-required-mutation-rehearsal.md',
      'docs/179-wave-2-approval-grant-contract.md',
      'docs/180-wave-2-approved-mutation-execution-harness.md',
      'docs/181-wave-2-first-live-mutation-micro-slice.md',
      'docs/182-wave-2-message-send-live-rehearsal-transport-blocked.md',
    ],
    nativeRecordCount: 0,
    baselineRecordCount: 7,
    parityResult: 'blocked-by-policy',
    commandCenterNativePathReady: false,
    gaps: [
      'message send remains blocked',
      'provider/tool/command execution remains blocked',
      'gateway mutation remains blocked',
    ],
    runtimeExternalExecutorRequiredForLookup: false,
    runtimeExternalExecutorRequiredForRender: false,
    adapterRequiredForSurface: true,
    adapterRemovalAllowed: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    stateMigrated: false,
    sourceModuleCopied: false,
    rawSecretSerialized: false,
  };
}

function stateMigrationSurface(): ZavorthNativeRegistryParitySurface {
  return {
    nativeContract: 'ZavorthNativeRegistryParitySurface/v1',
    id: 'state-migration-import',
    label: 'State migration and import',
    classification: 'blocked',
    nativeRegistryIds: [],
    baselineArtifactIds: [
      'docs/162-wave-0-external-agent-config-state-migration-strategy.md',
      'docs/163-wave-1-external-agent-config-state-read-only-inventory.md',
      'docs/164-wave-1-redaction-and-secretref-mapping.md',
      'docs/165-wave-1-dry-run-migration-plan.md',
      'docs/166-wave-1-rollback-restore-rehearsal.md',
      'docs/167-wave-1-sqlite-session-store-dry-run-design.md',
    ],
    nativeRecordCount: 0,
    baselineRecordCount: 6,
    parityResult: 'blocked-by-policy',
    commandCenterNativePathReady: false,
    gaps: [
      'controlled migration has not been authorized',
      'SQLite/session import remains dry-run only',
      'rollback restore has not touched real files',
    ],
    runtimeExternalExecutorRequiredForLookup: false,
    runtimeExternalExecutorRequiredForRender: false,
    adapterRequiredForSurface: true,
    adapterRemovalAllowed: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    stateMigrated: false,
    sourceModuleCopied: false,
    rawSecretSerialized: false,
  };
}

function buildSurfaces(source: ZavorthNativeRegistryParitySource): ZavorthNativeRegistryParitySurface[] {
  return [
    capabilitySurface(source),
    dashboardSurface(source),
    integrationSurface(source),
    sessionSurface(source),
    configSurface(source),
    liveRefreshSurface(),
    actionDispatchSurface(),
    stateMigrationSurface(),
  ];
}

function commandCenterRoutes(
  source: ZavorthNativeRegistryParitySource,
  surfaces: ZavorthNativeRegistryParitySurface[],
): ZavorthNativeRegistryParityCommandCenterRoute[] {
  const registryIdsBySurface: Record<
    Exclude<ZavorthNativeRegistryParitySurfaceId, 'action-dispatch-execution' | 'live-refresh-reconciliation' | 'state-migration-import'>,
    string
  > = {
    'capability-lookup-classify': source.nativeCapabilityRegistry.registry.id,
    'dashboard-render-view-lookup': source.nativeDashboardViewModelRegistry.registry.id,
    'provider-channel-transport-metadata-lookup': source.nativeIntegrationRegistry.registry.id,
    'session-history-metadata-lookup': source.nativeSessionHistoryRegistry.registry.id,
    'config-secretref-state-metadata-lookup': source.nativeConfigStateRegistry.registry.id,
  };

  return surfaces
    .filter((surface) => surface.classification === 'native-ready' && surface.commandCenterNativePathReady)
    .map((surface) => ({
      nativeContract: 'ZavorthNativeRegistryParityCommandCenterRoute/v1',
      id: `${surface.id}:command-center-native-route`,
      sourceSurfaceId: surface.id,
      registryId: registryIdsBySurface[
        surface.id as keyof typeof registryIdsBySurface
      ],
      commandCenterUsesNativeRegistry: true,
      runtimeExternalExecutorRequiredForRender: false,
      publicSourceIdentityExposed: false,
      rawSecretSerialized: false,
    }));
}

function dependencyReduction(): ZavorthNativeRegistryDependencyReduction {
  return {
    nativeContract: 'ZavorthNativeRegistryDependencyReduction/v1',
    capabilityLookupNativeReady: true,
    dashboardRenderNativeReady: true,
    integrationLookupNativeReady: true,
    sessionHistoryLookupNativeReady: true,
    configStateLookupNativeReady: true,
    commandCenterCanUseNativeReadySurfaces: true,
    liveExternalExecutorOptionalForRefreshOnly: true,
    adapterStillRequiredForRefreshReconciliation: true,
    adapterStillRequiredForUnreplacedSurfaces: true,
    adapterRemovalAllowed: false,
  };
}

function remainingGaps(): ZavorthNativeRegistryParityGap[] {
  return [
    {
      nativeContract: 'ZavorthNativeRegistryParityGap/v1',
      id: 'live-refresh-reconciliation-gap',
      label: 'Live refresh and reconciliation still require a future adapter/live gate.',
      classification: 'adapter-required',
      affectedSurfaceIds: ['live-refresh-reconciliation'],
      nextGateRequired: 'future-native-refresh-reconciliation-gate',
      adapterRemovalAllowed: false,
      executionAuthority: false,
    },
    {
      nativeContract: 'ZavorthNativeRegistryParityGap/v1',
      id: 'execution-dispatch-gap',
      label: 'Message send, provider execution, command/tool execution, and gateway mutation remain blocked.',
      classification: 'blocked',
      affectedSurfaceIds: ['action-dispatch-execution'],
      nextGateRequired: 'future-controlled-execution-gate',
      adapterRemovalAllowed: false,
      executionAuthority: false,
    },
    {
      nativeContract: 'ZavorthNativeRegistryParityGap/v1',
      id: 'state-migration-import-gap',
      label: 'Config/state/session migration and import remain dry-run/deferred only.',
      classification: 'blocked',
      affectedSurfaceIds: ['state-migration-import', 'config-secretref-state-metadata-lookup', 'session-history-metadata-lookup'],
      nextGateRequired: 'future-controlled-migration-import-gate',
      adapterRemovalAllowed: false,
      executionAuthority: false,
    },
    {
      nativeContract: 'ZavorthNativeRegistryParityGap/v1',
      id: 'adapter-removal-gap',
      label: 'Adapter removal remains blocked until native parity and refresh reconciliation are validated.',
      classification: 'deferred',
      affectedSurfaceIds: [
        'capability-lookup-classify',
        'dashboard-render-view-lookup',
        'provider-channel-transport-metadata-lookup',
        'session-history-metadata-lookup',
        'config-secretref-state-metadata-lookup',
        'live-refresh-reconciliation',
      ],
      nextGateRequired: 'future-adapter-removal-parity-gate',
      adapterRemovalAllowed: false,
      executionAuthority: false,
    },
  ];
}

function executionGate(): ZavorthNativeRegistryParityExecutionGate {
  return {
    runtimeExternalExecutorRequiredForNativeReadyLookup: false,
    runtimeExternalExecutorRequiredForNativeReadyRender: false,
    adapterRemovalAllowed: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    stateMigrated: false,
    sourceModuleCopied: false,
    rawSecretSerialized: false,
  };
}

function sourceReady(source: ZavorthNativeRegistryParitySource): boolean {
  return (
    source.realCapabilitySnapshot.decision === 'real-capability-snapshot-read-only-ok' &&
    source.liveReadOnlyBridge.decision === 'external-executor-live-read-only-bridge-boundary-ready' &&
    source.observabilityProjection.decision === 'external-executor-live-observability-projection-ready' &&
    source.eventStreamAdapter.decision === 'external-executor-read-only-event-stream-adapter-ready' &&
    source.sessionHistoryBridge.decision === 'external-executor-session-history-read-only-bridge-ready' &&
    source.commandCenterAssimilation.decision === 'command-center-live-assimilation-ready' &&
    source.nativeCapabilityRegistry.decision === 'native-capability-registry-replacement-ready' &&
    source.nativeDashboardViewModelRegistry.decision === 'native-dashboard-view-model-registry-ready' &&
    source.nativeIntegrationRegistry.decision === 'native-integration-registry-ready' &&
    source.nativeSessionHistoryRegistry.decision === 'native-session-history-registry-ready' &&
    source.nativeConfigStateRegistry.decision === 'native-config-state-registry-ready' &&
    !source.externalExecutorLiveCalledDuringNativeLookup &&
    !source.externalExecutorLiveCalledDuringNativeRender &&
    !source.adapterRemovalAttempted &&
    !source.executionAttempted &&
    !source.stateMigrationAttempted
  );
}

function surfaceMatchesFilter(
  surface: ZavorthNativeRegistryParitySurface,
  filter: ZavorthNativeRegistryParitySurfaceFilter,
): boolean {
  if (filter.classification && surface.classification !== filter.classification) {
    return false;
  }
  if (filter.nativeReady !== undefined && (surface.classification === 'native-ready') !== filter.nativeReady) {
    return false;
  }
  if (filter.adapterRequired !== undefined && surface.adapterRequiredForSurface !== filter.adapterRequired) {
    return false;
  }
  return true;
}

export class ZavorthNativeRegistryParityChecker {
  private readonly surfacesById: Map<ZavorthNativeRegistryParitySurfaceId, ZavorthNativeRegistryParitySurface>;

  public constructor(public readonly normalization: ZavorthNativeRegistryParityNormalization) {
    this.surfacesById = new Map(normalization.surfaces.map((surface) => [surface.id, surface]));
  }

  public listSurfaces(filter: ZavorthNativeRegistryParitySurfaceFilter = {}): ZavorthNativeRegistryParitySurface[] {
    return this.normalization.surfaces.filter((surface) => surfaceMatchesFilter(surface, filter));
  }

  public lookupSurface(id: ZavorthNativeRegistryParitySurfaceId): ZavorthNativeRegistryParitySurface | undefined {
    return this.surfacesById.get(id);
  }

  public nativeReadySurfaces(): ZavorthNativeRegistryParitySurface[] {
    return this.listSurfaces({ nativeReady: true });
  }

  public commandCenterNativeRoutes(): ZavorthNativeRegistryParityCommandCenterRoute[] {
    return this.normalization.commandCenterNativeRoutes;
  }

  public gaps(): ZavorthNativeRegistryParityGap[] {
    return this.normalization.remainingGaps;
  }
}

export function createZavorthNativeRegistryParityFixtureSource(): ZavorthNativeRegistryParitySource {
  return {
    realCapabilitySnapshot: normalizeExternalExecutorRealCapabilitySnapshotReadOnlyFixture(),
    liveReadOnlyBridge: normalizeExternalExecutorLiveReadOnlyBridgeBoundaryFixture(),
    observabilityProjection: normalizeExternalExecutorLiveObservabilityProjectionFixture(),
    eventStreamAdapter: normalizeExternalExecutorReadOnlyEventStreamAdapterFixture(),
    sessionHistoryBridge: normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture(),
    commandCenterAssimilation: normalizeExternalAgentCommandCenterLiveAssimilationFixture(),
    nativeCapabilityRegistry: normalizeZavorthNativeCapabilityRegistryReplacementFixture(),
    capabilityRegistry: createZavorthNativeCapabilityRegistryFixture(),
    nativeDashboardViewModelRegistry: normalizeZavorthNativeDashboardViewModelRegistryFixture(),
    dashboardRegistry: createZavorthNativeDashboardViewModelRegistryFixture(),
    nativeIntegrationRegistry: normalizeZavorthNativeIntegrationRegistryFixture(),
    integrationRegistry: createZavorthNativeIntegrationRegistryFixture(),
    nativeSessionHistoryRegistry: normalizeZavorthNativeSessionHistoryRegistryFixture(),
    sessionHistoryRegistry: createZavorthNativeSessionHistoryRegistryFixture(),
    nativeConfigStateRegistry: normalizeZavorthNativeConfigStateRegistryFixture(),
    configStateRegistry: createZavorthNativeConfigStateRegistryFixture(),
    externalExecutorLiveCalledDuringNativeLookup: false,
    externalExecutorLiveCalledDuringNativeRender: false,
    adapterRemovalAttempted: false,
    executionAttempted: false,
    stateMigrationAttempted: false,
  };
}

export function normalizeZavorthNativeRegistryParityDependencyReduction<TRuntimeId extends string>(
  options: ZavorthNativeRegistryParityOptions<TRuntimeId>,
): ZavorthNativeRegistryParityNormalization {
  const surfaces = buildSurfaces(options.source);
  const nativeReadySurfaces = surfaces.filter((surface) => surface.classification === 'native-ready');
  const routes = commandCenterRoutes(options.source, surfaces);
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    nativeReadySurfaces.length === 5 &&
    routes.length === nativeReadySurfaces.length &&
    surfaces.some((surface) => surface.classification === 'adapter-required') &&
    surfaces.some((surface) => surface.classification === 'blocked') &&
    remainingGaps().length > 0;

  return {
    nativeContract: 'ZavorthNativeRegistryParityDependencyReduction/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'native-registry-parity-ready' : 'blocked',
    status: ready ? 'native-registry-parity-ready' : 'blocked',
    sourceReadiness: {
      realCapabilitySnapshot: options.source.realCapabilitySnapshot.decision,
      liveReadOnlyBridge: options.source.liveReadOnlyBridge.decision,
      observabilityProjection: options.source.observabilityProjection.decision,
      eventStreamAdapter: options.source.eventStreamAdapter.decision,
      sessionHistoryBridge: options.source.sessionHistoryBridge.decision,
      commandCenterAssimilation: options.source.commandCenterAssimilation.decision,
      nativeCapabilityRegistry: options.source.nativeCapabilityRegistry.decision,
      nativeDashboardViewModelRegistry: options.source.nativeDashboardViewModelRegistry.decision,
      nativeIntegrationRegistry: options.source.nativeIntegrationRegistry.decision,
      nativeSessionHistoryRegistry: options.source.nativeSessionHistoryRegistry.decision,
      nativeConfigStateRegistry: options.source.nativeConfigStateRegistry.decision,
    },
    surfaces,
    commandCenterNativeRoutes: routes,
    dependencyReduction: dependencyReduction(),
    remainingGaps: remainingGaps(),
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-native-refresh-reconciliation-or-adapter-removal-parity-gate',
  };
}

export function normalizeZavorthNativeRegistryParityDependencyReductionFixture(): ZavorthNativeRegistryParityNormalization {
  return normalizeZavorthNativeRegistryParityDependencyReduction({
    generatedAt: ZAVORTH_NATIVE_REGISTRY_PARITY_NOW,
    runtimeId: ZAVORTH_NATIVE_REGISTRY_PARITY_RUNTIME_ID,
    idPrefix: 'zavorth-native-registry-parity',
    source: createZavorthNativeRegistryParityFixtureSource(),
  });
}

export function createZavorthNativeRegistryParityCheckerFixture(): ZavorthNativeRegistryParityChecker {
  return new ZavorthNativeRegistryParityChecker(
    normalizeZavorthNativeRegistryParityDependencyReductionFixture(),
  );
}
