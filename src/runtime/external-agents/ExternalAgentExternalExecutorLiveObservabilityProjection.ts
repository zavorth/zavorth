import {
  normalizeExternalExecutorLiveReadOnlyBridgeBoundaryFixture,
} from './ExternalAgentExternalExecutorLiveReadOnlyBridgeBoundary.js';
import type {
  ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization,
  ExternalExecutorLiveReadOnlyBridgeSurface,
  ExternalExecutorLiveReadOnlyBridgeSurfaceKind,
} from './ExternalAgentExternalExecutorLiveReadOnlyBridgeBoundary.js';

export const EXTERNAL_EXECUTOR_LIVE_OBSERVABILITY_PROJECTION_NOW = '2026-04-28T20:25:00.000Z' as const;
export const EXTERNAL_EXECUTOR_LIVE_OBSERVABILITY_PROJECTION_RUNTIME_ID = 'external-executor-live-observability-projection' as const;

export type ExternalExecutorLiveObservabilityProjectionDecision =
  | 'blocked'
  | 'external-executor-live-observability-projection-ready';

export type ExternalExecutorLiveObservabilityProjectionStatus =
  | 'blocked'
  | 'degraded'
  | 'ready'
  | 'unavailable';

export type ExternalExecutorLiveObservabilityProjectionInput = {
  bridge: ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization;
  bridgeDoc: 'docs/external-executor-live-read-only-bridge-boundary.md';
  sourceSnapshotDoc: 'docs/real-capability-snapshot-read-only.md';
  secretRefId: 'external-executor-gateway-token';
  tokenStatus: 'present-redacted';
  liveExternalExecutorStartedByProjection: false;
  mutableStreamOpened: false;
  stateMigrated: false;
};

export type ExternalExecutorLiveObservabilityRuntimeProjection = {
  nativeContract: 'ZavorthExternalExecutorLiveRuntimeObservabilityProjection/v1';
  runtimeId: string;
  status: 'ready' | 'degraded';
  sourceBridgeDecision: ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization['decision'];
  sourceSnapshotDecision: ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization['observability']['sourceSnapshotDecision'];
  healthProbeAuthenticated: true;
  statusRpcOk: true;
  probeOk: true;
  cleanupConfirmed: true;
  postListenerCount: 0;
  postProcessCount: 0;
  capabilitySurfaceCount: number;
  degradedSurfaceCount: number;
  unavailableSurfaceCount: number;
  sourceIdsEvidenceOnly: true;
  executionAuthority: false;
};

export type ExternalExecutorLiveObservabilityDashboardRow = {
  nativeContract: 'ZavorthExternalExecutorDashboardObservabilityRow/v1';
  id: string;
  surfaceKind: ExternalExecutorLiveReadOnlyBridgeSurfaceKind | 'runtime';
  label: string;
  status: ExternalExecutorLiveObservabilityProjectionStatus;
  summary: string;
  readOnly: true;
  sourceEvidenceId: string;
  sourceIdsEvidenceOnly: true;
  executionAuthority: false;
  actionDispatchAllowed: false;
  messageSendAllowed: false;
  providerExecutionAllowed: false;
  commandExecutionAllowed: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
};

export type ExternalExecutorLiveObservabilityDashboardProjection = {
  nativeContract: 'ZavorthExternalExecutorDashboardObservabilityProjection/v1';
  id: string;
  runtimeStatus: 'ready' | 'degraded';
  usesZavorthTerms: true;
  readOnly: true;
  rows: ExternalExecutorLiveObservabilityDashboardRow[];
  executableControlsExposed: false;
  actionDispatchControlsExposed: false;
  messageSendControlsExposed: false;
  providerExecutionControlsExposed: false;
  commandExecutionControlsExposed: false;
  sessionImportControlsExposed: false;
};

export type ExternalExecutorLiveObservabilityFailureProjection = {
  nativeContract: 'ZavorthExternalExecutorLiveObservabilityFailureProjection/v1';
  failureRows: Array<{
    id: string;
    surfaceKind: ExternalExecutorLiveReadOnlyBridgeSurfaceKind;
    status: 'degraded' | 'unavailable' | 'blocked';
    reason: string;
    rawExceptionSerialized: false;
    zavorthRuntimeFailed: false;
  }>;
  degradedUnavailableMapped: true;
  rawExceptionThrown: false;
  rawExceptionSerialized: false;
  zavorthRuntimeContinues: true;
};

export type ExternalExecutorLiveObservabilityExecutionGate = {
  executionAuthority: false;
  actionDispatchAllowed: false;
  messageSendAllowed: false;
  providerExecutionAllowed: false;
  commandExecutionAllowed: false;
  liveMutableStreamOpened: false;
  liveExternalExecutorStartedByProjection: false;
  sourceRuntimeConnectedForMutation: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  tokenViaSecretRefEnvVar: true;
  rawSecretSerialized: false;
};

export type ExternalExecutorLiveObservabilityProjectionNormalization = {
  nativeContract: 'ZavorthExternalExecutorLiveObservabilityProjection/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ExternalExecutorLiveObservabilityProjectionDecision;
  bridgeDoc: ExternalExecutorLiveObservabilityProjectionInput['bridgeDoc'];
  sourceSnapshotDoc: ExternalExecutorLiveObservabilityProjectionInput['sourceSnapshotDoc'];
  readOnly: true;
  runtimeObservability: ExternalExecutorLiveObservabilityRuntimeProjection;
  dashboardProjection: ExternalExecutorLiveObservabilityDashboardProjection;
  failureProjection: ExternalExecutorLiveObservabilityFailureProjection;
  executionGate: ExternalExecutorLiveObservabilityExecutionGate;
  nextGateRecommended: 'future-read-only-event-diff-or-controlled-event-bridge-design';
};

export type ExternalExecutorLiveObservabilityProjectionOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  source: ExternalExecutorLiveObservabilityProjectionInput;
};

function statusForSurface(surface: ExternalExecutorLiveReadOnlyBridgeSurface): ExternalExecutorLiveObservabilityProjectionStatus {
  if (surface.availability === 'unavailable' || surface.classification === 'unavailable') {
    return 'unavailable';
  }
  if (surface.policy === 'blocked' || surface.classification === 'blocked') {
    return 'blocked';
  }
  if (surface.availability === 'degraded' || surface.classification === 'degraded') {
    return 'degraded';
  }
  return 'ready';
}

function summaryForSurface(surface: ExternalExecutorLiveReadOnlyBridgeSurface): string {
  const status = statusForSurface(surface);

  if (status === 'blocked') {
    return `${surface.label}; blocked as read-only Zavorth metadata.`;
  }
  if (status === 'unavailable') {
    return `${surface.label}; unavailable in source evidence, represented honestly.`;
  }
  if (status === 'degraded') {
    return `${surface.label}; degraded source state preserved without runtime failure.`;
  }
  return `${surface.label}; available as read-only Zavorth observability.`;
}

function buildRuntimeProjection(
  runtimeId: string,
  bridge: ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization,
): ExternalExecutorLiveObservabilityRuntimeProjection {
  const degradedSurfaceCount = bridge.surfaces.filter((surface) => statusForSurface(surface) === 'degraded').length;
  const unavailableSurfaceCount = bridge.surfaces.filter((surface) => {
    const status = statusForSurface(surface);
    return status === 'unavailable' || status === 'blocked';
  }).length;

  return {
    nativeContract: 'ZavorthExternalExecutorLiveRuntimeObservabilityProjection/v1',
    runtimeId,
    status: bridge.decision === 'external-executor-live-read-only-bridge-boundary-ready' ? 'ready' : 'degraded',
    sourceBridgeDecision: bridge.decision,
    sourceSnapshotDecision: bridge.observability.sourceSnapshotDecision,
    healthProbeAuthenticated: bridge.observability.healthProbeAuthenticated,
    statusRpcOk: bridge.observability.statusRpcOk,
    probeOk: bridge.observability.probeOk,
    cleanupConfirmed: bridge.observability.cleanupConfirmed,
    postListenerCount: bridge.observability.postListenerCount,
    postProcessCount: bridge.observability.postProcessCount,
    capabilitySurfaceCount: bridge.surfaces.length,
    degradedSurfaceCount,
    unavailableSurfaceCount,
    sourceIdsEvidenceOnly: true,
    executionAuthority: false,
  };
}

function buildDashboardProjection(
  idPrefix: string,
  runtimeProjection: ExternalExecutorLiveObservabilityRuntimeProjection,
  bridge: ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization,
): ExternalExecutorLiveObservabilityDashboardProjection {
  const runtimeRow: ExternalExecutorLiveObservabilityDashboardRow = {
    nativeContract: 'ZavorthExternalExecutorDashboardObservabilityRow/v1',
    id: `${idPrefix}:dashboard-runtime`,
    surfaceKind: 'runtime',
    label: 'ExternalExecutor live read-only runtime observability',
    status: runtimeProjection.status,
    summary: 'Authenticated health/status/probe evidence projected as Zavorth runtime observability.',
    readOnly: true,
    sourceEvidenceId: bridge.sourceSnapshotDoc,
    sourceIdsEvidenceOnly: true,
    executionAuthority: false,
    actionDispatchAllowed: false,
    messageSendAllowed: false,
    providerExecutionAllowed: false,
    commandExecutionAllowed: false,
    sourceModuleCopied: false,
    nativeReplacementAuthorized: false,
  };

  return {
    nativeContract: 'ZavorthExternalExecutorDashboardObservabilityProjection/v1',
    id: `${idPrefix}:dashboard-observability`,
    runtimeStatus: runtimeProjection.status,
    usesZavorthTerms: true,
    readOnly: true,
    rows: [
      runtimeRow,
      ...bridge.surfaces.map((surface, index): ExternalExecutorLiveObservabilityDashboardRow => ({
        nativeContract: 'ZavorthExternalExecutorDashboardObservabilityRow/v1',
        id: `${idPrefix}:dashboard-${index + 1}-${surface.surfaceKind}`,
        surfaceKind: surface.surfaceKind,
        label: surface.label,
        status: statusForSurface(surface),
        summary: summaryForSurface(surface),
        readOnly: true,
        sourceEvidenceId: surface.sourceEvidenceId,
        sourceIdsEvidenceOnly: true,
        executionAuthority: false,
        actionDispatchAllowed: false,
        messageSendAllowed: false,
        providerExecutionAllowed: false,
        commandExecutionAllowed: false,
        sourceModuleCopied: false,
        nativeReplacementAuthorized: false,
      })),
    ],
    executableControlsExposed: false,
    actionDispatchControlsExposed: false,
    messageSendControlsExposed: false,
    providerExecutionControlsExposed: false,
    commandExecutionControlsExposed: false,
    sessionImportControlsExposed: false,
  };
}

function buildFailureProjection(
  bridge: ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization,
): ExternalExecutorLiveObservabilityFailureProjection {
  return {
    nativeContract: 'ZavorthExternalExecutorLiveObservabilityFailureProjection/v1',
    failureRows: bridge.surfaces
      .filter((surface) => statusForSurface(surface) !== 'ready')
      .map((surface) => {
        const status = statusForSurface(surface);

        return {
          id: `${surface.id}:failure-projection`,
          surfaceKind: surface.surfaceKind,
          status: status === 'ready' ? 'degraded' : status,
          reason: summaryForSurface(surface),
          rawExceptionSerialized: false,
          zavorthRuntimeFailed: false,
        };
      }),
    degradedUnavailableMapped: true,
    rawExceptionThrown: false,
    rawExceptionSerialized: false,
    zavorthRuntimeContinues: true,
  };
}

export function createExternalExecutorLiveObservabilityProjectionFixtureInput(): ExternalExecutorLiveObservabilityProjectionInput {
  return {
    bridge: normalizeExternalExecutorLiveReadOnlyBridgeBoundaryFixture(),
    bridgeDoc: 'docs/external-executor-live-read-only-bridge-boundary.md',
    sourceSnapshotDoc: 'docs/real-capability-snapshot-read-only.md',
    secretRefId: 'external-executor-gateway-token',
    tokenStatus: 'present-redacted',
    liveExternalExecutorStartedByProjection: false,
    mutableStreamOpened: false,
    stateMigrated: false,
  };
}

export function normalizeExternalExecutorLiveObservabilityProjection<TRuntimeId extends string>(
  options: ExternalExecutorLiveObservabilityProjectionOptions<TRuntimeId>,
): ExternalExecutorLiveObservabilityProjectionNormalization {
  const { bridge } = options.source;
  const projectionReady =
    bridge.decision === 'external-executor-live-read-only-bridge-boundary-ready' &&
    bridge.executionGate.executionAuthority === false &&
    bridge.executionGate.actionDispatchAllowed === false &&
    bridge.executionGate.providerExecutionAllowed === false &&
    bridge.executionGate.commandExecutionAllowed === false &&
    bridge.executionGate.messageSendAllowed === false &&
    bridge.executionGate.rawSecretSerialized === false &&
    options.source.tokenStatus === 'present-redacted' &&
    !options.source.liveExternalExecutorStartedByProjection &&
    !options.source.mutableStreamOpened &&
    !options.source.stateMigrated;
  const runtimeObservability = buildRuntimeProjection(options.runtimeId, bridge);

  return {
    nativeContract: 'ZavorthExternalExecutorLiveObservabilityProjection/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: projectionReady ? 'external-executor-live-observability-projection-ready' : 'blocked',
    bridgeDoc: options.source.bridgeDoc,
    sourceSnapshotDoc: options.source.sourceSnapshotDoc,
    readOnly: true,
    runtimeObservability,
    dashboardProjection: buildDashboardProjection(options.idPrefix, runtimeObservability, bridge),
    failureProjection: buildFailureProjection(bridge),
    executionGate: {
      executionAuthority: false,
      actionDispatchAllowed: false,
      messageSendAllowed: false,
      providerExecutionAllowed: false,
      commandExecutionAllowed: false,
      liveMutableStreamOpened: false,
      liveExternalExecutorStartedByProjection: false,
      sourceRuntimeConnectedForMutation: false,
      stateMigrated: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorized: false,
      tokenViaSecretRefEnvVar: true,
      rawSecretSerialized: false,
    },
    nextGateRecommended: 'future-read-only-event-diff-or-controlled-event-bridge-design',
  };
}

export function normalizeExternalExecutorLiveObservabilityProjectionFixture(): ExternalExecutorLiveObservabilityProjectionNormalization {
  return normalizeExternalExecutorLiveObservabilityProjection({
    source: createExternalExecutorLiveObservabilityProjectionFixtureInput(),
    generatedAt: EXTERNAL_EXECUTOR_LIVE_OBSERVABILITY_PROJECTION_NOW,
    runtimeId: EXTERNAL_EXECUTOR_LIVE_OBSERVABILITY_PROJECTION_RUNTIME_ID,
    idPrefix: 'external-executor-live-observability',
  });
}
