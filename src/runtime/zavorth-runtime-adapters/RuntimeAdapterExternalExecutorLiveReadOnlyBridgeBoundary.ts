import {
  normalizeExternalExecutorRealCapabilitySnapshotReadOnlyFixture,
  EXTERNAL_EXECUTOR_REAL_CAPABILITY_SNAPSHOT_READ_ONLY_NOW,
  EXTERNAL_EXECUTOR_REAL_CAPABILITY_SNAPSHOT_READ_ONLY_RUNTIME_ID,
} from './RuntimeAdapterExternalExecutorRealCapabilitySnapshotReadOnly.js';
import type {
  RuntimeAdapterLiveReadinessCapabilityInventoryRow,
  RuntimeAdapterLiveReadinessCapabilityRowKind,
} from './RuntimeAdapterLiveReadinessAssimilationPack.js';
import type {
  ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization,
} from './RuntimeAdapterExternalExecutorRealCapabilitySnapshotReadOnly.js';

export const EXTERNAL_EXECUTOR_LIVE_READ_ONLY_BRIDGE_BOUNDARY_NOW = '2026-04-28T20:10:00.000Z' as const;
export const EXTERNAL_EXECUTOR_LIVE_READ_ONLY_BRIDGE_BOUNDARY_RUNTIME_ID = 'external-executor-live-read-only-bridge-boundary' as const;

export type ExternalExecutorLiveReadOnlyBridgeDecision =
  | 'blocked'
  | 'external-executor-live-read-only-bridge-boundary-ready';

export type ExternalExecutorLiveReadOnlyBridgeSurfaceKind =
  | 'channel'
  | 'event'
  | 'gateway-method'
  | 'message'
  | 'plugin'
  | 'provider'
  | 'session';

export type ExternalExecutorLiveReadOnlyBridgeSource = {
  realSnapshot: ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization;
  sourceSnapshotDoc: 'docs/real-capability-snapshot-read-only.md';
  secretRefId: 'external-executor-gateway-token';
  secretInjectionChannel: 'env-var';
  tokenStatus: 'present-redacted';
  mutableStreamOpened: false;
  messageSent: false;
  stateMigrated: false;
};

export type ExternalExecutorLiveReadOnlyBridgeSurface = {
  nativeContract: 'ZavorthExternalExecutorLiveReadOnlyBridgeSurface/v1';
  id: string;
  surfaceKind: ExternalExecutorLiveReadOnlyBridgeSurfaceKind;
  rowKind: RuntimeAdapterLiveReadinessCapabilityRowKind;
  label: string;
  availability: RuntimeAdapterLiveReadinessCapabilityInventoryRow['availability'];
  classification: RuntimeAdapterLiveReadinessCapabilityInventoryRow['importClassification'];
  policy: RuntimeAdapterLiveReadinessCapabilityInventoryRow['policy'];
  sourceEvidenceId: string;
  sourceIdsEvidenceOnly: true;
  readOnly: true;
  executionAuthority: false;
  actionDispatchAllowed: false;
  providerExecutionAllowed: false;
  commandExecutionAllowed: false;
  messageSendAllowed: false;
  sessionImportAllowed: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
};

export type ExternalExecutorLiveReadOnlyBridgeObservability = {
  nativeContract: 'ZavorthExternalExecutorLiveReadOnlyBridgeObservability/v1';
  sourceSnapshotDecision: ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization['decision'];
  healthStatus: 'ready' | 'degraded';
  zavorthControlProjectionRows: number;
  healthProbeAuthenticated: true;
  statusRpcOk: true;
  probeOk: true;
  cleanupConfirmed: true;
  postListenerCount: 0;
  postProcessCount: 0;
  degradedRows: string[];
  unavailableRows: string[];
  zavorthRuntimeFailed: false;
};

export type ExternalExecutorLiveReadOnlyBridgeFailureModel = {
  nativeContract: 'ZavorthExternalExecutorLiveReadOnlyBridgeFailureModel/v1';
  degradedUnavailablePreserved: true;
  degradedRows: string[];
  unavailableRows: string[];
  failureMode: 'metadata-only-degraded-unavailable';
  zavorthRuntimeContinues: true;
  rollbackRequiredBeforeMutation: true;
};

export type ExternalExecutorLiveReadOnlyBridgeExecutionGate = {
  executionAuthority: false;
  actionDispatchAllowed: false;
  providerExecutionAllowed: false;
  commandExecutionAllowed: false;
  messageSendAllowed: false;
  liveMutableStreamOpened: false;
  sourceRuntimeConnectedForMutation: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  stateMigrated: false;
  tokenViaSecretRefEnvVar: true;
  rawSecretSerialized: false;
};

export type ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization = {
  nativeContract: 'ZavorthExternalExecutorLiveReadOnlyBridgeBoundary/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ExternalExecutorLiveReadOnlyBridgeDecision;
  sourceSnapshotDoc: ExternalExecutorLiveReadOnlyBridgeSource['sourceSnapshotDoc'];
  readOnly: true;
  capabilityInventoryNative: ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization['capabilityInventory'];
  observability: ExternalExecutorLiveReadOnlyBridgeObservability;
  surfaces: ExternalExecutorLiveReadOnlyBridgeSurface[];
  failureModel: ExternalExecutorLiveReadOnlyBridgeFailureModel;
  executionGate: ExternalExecutorLiveReadOnlyBridgeExecutionGate;
  nextGateRecommended: 'future-read-only-event-diff-or-controlled-bridge-probe';
};

export type ExternalExecutorLiveReadOnlyBridgeBoundaryOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  source: ExternalExecutorLiveReadOnlyBridgeSource;
};

function rowByKind(
  snapshot: ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization,
  rowKind: RuntimeAdapterLiveReadinessCapabilityRowKind,
): RuntimeAdapterLiveReadinessCapabilityInventoryRow {
  const row = snapshot.capabilityInventory.inventory.find((candidate) => candidate.rowKind === rowKind);

  if (!row) {
    throw new Error(`Missing ExternalExecutor read-only snapshot row: ${rowKind}`);
  }

  return row;
}

function bridgeSurfaceFromRow(
  idPrefix: string,
  index: number,
  surfaceKind: ExternalExecutorLiveReadOnlyBridgeSurfaceKind,
  row: RuntimeAdapterLiveReadinessCapabilityInventoryRow,
  label: string,
): ExternalExecutorLiveReadOnlyBridgeSurface {
  return {
    nativeContract: 'ZavorthExternalExecutorLiveReadOnlyBridgeSurface/v1',
    id: `${idPrefix}:surface-${index + 1}-${surfaceKind}`,
    surfaceKind,
    rowKind: row.rowKind,
    label,
    availability: row.availability,
    classification: row.importClassification,
    policy: row.policy,
    sourceEvidenceId: row.sourceEvidence.evidenceId,
    sourceIdsEvidenceOnly: true,
    readOnly: true,
    executionAuthority: false,
    actionDispatchAllowed: false,
    providerExecutionAllowed: false,
    commandExecutionAllowed: false,
    messageSendAllowed: false,
    sessionImportAllowed: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorized: false,
  };
}

function buildBridgeSurfaces(
  idPrefix: string,
  snapshot: ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization,
): ExternalExecutorLiveReadOnlyBridgeSurface[] {
  const channel = rowByKind(snapshot, 'channel-capabilities');
  const session = rowByKind(snapshot, 'session-history-capabilities');
  const plugin = rowByKind(snapshot, 'plugin-capabilities');
  const provider = rowByKind(snapshot, 'provider-capabilities');
  const gatewayMethod = rowByKind(snapshot, 'gateway-method-capabilities');

  return [
    bridgeSurfaceFromRow(idPrefix, 0, 'channel', channel, 'ExternalExecutor channels as Zavorth read-only channel metadata'),
    bridgeSurfaceFromRow(idPrefix, 1, 'message', session, 'ExternalExecutor message/history surface as evidence-only metadata'),
    bridgeSurfaceFromRow(idPrefix, 2, 'event', gatewayMethod, 'ExternalExecutor gateway event surface as read-only envelopes only'),
    bridgeSurfaceFromRow(idPrefix, 3, 'session', session, 'ExternalExecutor session surface without import or replay'),
    bridgeSurfaceFromRow(idPrefix, 4, 'plugin', plugin, 'ExternalExecutor plugin capability surface as Zavorth inventory'),
    bridgeSurfaceFromRow(idPrefix, 5, 'provider', provider, 'ExternalExecutor provider capability surface without SDK execution'),
    bridgeSurfaceFromRow(idPrefix, 6, 'gateway-method', gatewayMethod, 'ExternalExecutor gateway method surface without dispatch'),
  ];
}

function buildObservability(
  snapshot: ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization,
): ExternalExecutorLiveReadOnlyBridgeObservability {
  const degradedRows = snapshot.degradedUnavailableStateHandling.degradedRows;
  const unavailableRows = snapshot.degradedUnavailableStateHandling.unavailableRows;

  return {
    nativeContract: 'ZavorthExternalExecutorLiveReadOnlyBridgeObservability/v1',
    sourceSnapshotDecision: snapshot.decision,
    healthStatus: snapshot.decision === 'real-capability-snapshot-read-only-ok' ? 'ready' : 'degraded',
    zavorthControlProjectionRows: snapshot.zavorthControlProjection.rows.length,
    healthProbeAuthenticated: true,
    statusRpcOk: true,
    probeOk: true,
    cleanupConfirmed: snapshot.cleanupConfirmed,
    postListenerCount: 0,
    postProcessCount: 0,
    degradedRows,
    unavailableRows,
    zavorthRuntimeFailed: false,
  };
}

function buildFailureModel(
  snapshot: ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization,
): ExternalExecutorLiveReadOnlyBridgeFailureModel {
  return {
    nativeContract: 'ZavorthExternalExecutorLiveReadOnlyBridgeFailureModel/v1',
    degradedUnavailablePreserved: true,
    degradedRows: snapshot.degradedUnavailableStateHandling.degradedRows,
    unavailableRows: snapshot.degradedUnavailableStateHandling.unavailableRows,
    failureMode: 'metadata-only-degraded-unavailable',
    zavorthRuntimeContinues: true,
    rollbackRequiredBeforeMutation: true,
  };
}

export function createExternalExecutorLiveReadOnlyBridgeBoundaryFixtureSource(): ExternalExecutorLiveReadOnlyBridgeSource {
  return {
    realSnapshot: normalizeExternalExecutorRealCapabilitySnapshotReadOnlyFixture(),
    sourceSnapshotDoc: 'docs/real-capability-snapshot-read-only.md',
    secretRefId: 'external-executor-gateway-token',
    secretInjectionChannel: 'env-var',
    tokenStatus: 'present-redacted',
    mutableStreamOpened: false,
    messageSent: false,
    stateMigrated: false,
  };
}

export function normalizeExternalExecutorLiveReadOnlyBridgeBoundary<TRuntimeId extends string>(
  options: ExternalExecutorLiveReadOnlyBridgeBoundaryOptions<TRuntimeId>,
): ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization {
  const { realSnapshot } = options.source;
  const bridgeReady =
    realSnapshot.decision === 'real-capability-snapshot-read-only-ok' &&
    realSnapshot.executionAuthority === false &&
    realSnapshot.cleanupConfirmed &&
    options.source.tokenStatus === 'present-redacted' &&
    options.source.secretInjectionChannel === 'env-var' &&
    !options.source.mutableStreamOpened &&
    !options.source.messageSent &&
    !options.source.stateMigrated;

  return {
    nativeContract: 'ZavorthExternalExecutorLiveReadOnlyBridgeBoundary/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: bridgeReady ? 'external-executor-live-read-only-bridge-boundary-ready' : 'blocked',
    sourceSnapshotDoc: options.source.sourceSnapshotDoc,
    readOnly: true,
    capabilityInventoryNative: realSnapshot.capabilityInventory,
    observability: buildObservability(realSnapshot),
    surfaces: buildBridgeSurfaces(options.idPrefix, realSnapshot),
    failureModel: buildFailureModel(realSnapshot),
    executionGate: {
      executionAuthority: false,
      actionDispatchAllowed: false,
      providerExecutionAllowed: false,
      commandExecutionAllowed: false,
      messageSendAllowed: false,
      liveMutableStreamOpened: false,
      sourceRuntimeConnectedForMutation: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorized: false,
      stateMigrated: false,
      tokenViaSecretRefEnvVar: true,
      rawSecretSerialized: false,
    },
    nextGateRecommended: 'future-read-only-event-diff-or-controlled-bridge-probe',
  };
}

export function normalizeExternalExecutorLiveReadOnlyBridgeBoundaryFixture(): ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization {
  return normalizeExternalExecutorLiveReadOnlyBridgeBoundary({
    source: createExternalExecutorLiveReadOnlyBridgeBoundaryFixtureSource(),
    generatedAt: EXTERNAL_EXECUTOR_LIVE_READ_ONLY_BRIDGE_BOUNDARY_NOW,
    runtimeId: EXTERNAL_EXECUTOR_LIVE_READ_ONLY_BRIDGE_BOUNDARY_RUNTIME_ID,
    idPrefix: 'external-executor-live-read-only-bridge',
  });
}

export const EXTERNAL_EXECUTOR_LIVE_READ_ONLY_BRIDGE_SOURCE_SNAPSHOT_RUNTIME_ID =
  EXTERNAL_EXECUTOR_REAL_CAPABILITY_SNAPSHOT_READ_ONLY_RUNTIME_ID;
export const EXTERNAL_EXECUTOR_LIVE_READ_ONLY_BRIDGE_SOURCE_SNAPSHOT_CAPTURED_AT =
  EXTERNAL_EXECUTOR_REAL_CAPABILITY_SNAPSHOT_READ_ONLY_NOW;
