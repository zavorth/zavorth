import {
  evaluateZavorthAdapterDecommissionStaticGuard,
} from './ZavorthAdapterDecommissionReadinessPack.js';
import type {
  ZavorthAdapterDecommissionReadinessNormalization,
  ZavorthAdapterDecommissionStaticGuard,
  ZavorthAdapterDecommissionStaticGuardFile,
  ZavorthAdapterUsageInventoryRow,
} from './ZavorthAdapterDecommissionReadinessPack.js';
import type {
  ZavorthNativeAbsorptionPublicSurfaceHardeningNormalization,
} from './ZavorthNativeAbsorptionPublicSurfaceHardeningPack.js';
import type {
  ZavorthNativeRegistryConsumerExpansionNormalization,
} from './ZavorthNativeRegistryConsumerExpansionPack.js';
import type {
  ZavorthNativeRefreshCommitReceipt,
} from './ZavorthNativeRefreshCommitPack.js';
import type {
  ZavorthPartialAdapterRemovalImplementationNormalization,
} from './ZavorthPartialAdapterRemovalImplementationPack.js';

export const ZAVORTH_PARTIAL_ADAPTER_DECOMMISSION_IMPLEMENTATION_PACK_NOW = '2026-04-29T14:00:00.000Z' as const;
export const ZAVORTH_PARTIAL_ADAPTER_DECOMMISSION_IMPLEMENTATION_PACK_RUNTIME_ID = 'zavorth-partial-adapter-decommission-implementation-pack' as const;

export type ZavorthPartialAdapterDecommissionImplementationDecision =
  | 'blocked'
  | 'partial-adapter-decommission-implemented';

export type ZavorthPartialAdapterDecommissionImplementationAction =
  | 'default-legacy-route-removed-or-isolated'
  | 'preserved-adapter-required'
  | 'preserved-behind-explicit-refresh'
  | 'preserved-blocked'
  | 'preserved-for-audit';

export type ZavorthPartialAdapterDecommissionImplementationStatus =
  | 'blocked'
  | 'isolated'
  | 'preserved';

export type ZavorthPartialAdapterDecommissionImplementationRow = {
  nativeContract: 'ZavorthPartialAdapterDecommissionImplementationRow/v1';
  usageId: string;
  label: string;
  path: string;
  priorClassification: ZavorthAdapterUsageInventoryRow['classification'];
  priorDisposition: ZavorthAdapterUsageInventoryRow['decommissionDisposition'];
  implementationAction: ZavorthPartialAdapterDecommissionImplementationAction;
  implementationStatus: ZavorthPartialAdapterDecommissionImplementationStatus;
  safeRemovalCandidateFrom206: boolean;
  defaultLegacyUsageRemovedOrIsolated: boolean;
  adapterRequiredSurfacePreserved: boolean;
  refreshBoundaryPreserved: boolean;
  fallbackExplicitOnly: boolean;
  actualFileDeleted: false;
  adapterGlobalStillAvailable: true;
  adapterDefaultPathForNativeReadySurfaces: false;
  runtimeExternalExecutorRequiredForNativeReadyConsumers: false;
  adapterRefreshAllowed: boolean;
  adapterRemovalGlobalAllowed: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  externalMutationActuallyPerformed: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthPartialAdapterDecommissionConsumerRewire = {
  nativeContract: 'ZavorthPartialAdapterDecommissionConsumerRewire/v1';
  consumerId: string;
  path: string;
  defaultPath: 'native-registry';
  adapterAllowedModes: ['explicit-refresh', 'reconciliation', 'degraded-fallback'];
  defaultAdapterUsageRemovedOrIsolated: true;
  adapterCalledForDefaultPath: false;
  runtimeExternalExecutorRequiredForDefaultPath: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
};

export type ZavorthPartialAdapterDecommissionAdapterGlobalAvailability = {
  nativeContract: 'ZavorthPartialAdapterDecommissionAdapterGlobalAvailability/v1';
  globalAdapterStillAvailable: true;
  fixtureAdapterPath: 'src/runtime/external-agents/FixtureExternalAgentAdapter.ts';
  liveProbePath: 'src/runtime/external-agents/ExternalAgentExternalExecutorLiveReadOnlyProbe.ts';
  refreshReconciliationPath: 'src/runtime/external-agents/ZavorthNativeRegistryRefreshReconciliation.ts';
  adapterRequiredSurfacesPreserved: true;
  adapterRemovalGlobalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthPartialAdapterDecommissionReport = {
  nativeContract: 'ZavorthPartialAdapterDecommissionReport/v1';
  removedOrIsolatedUsageIds: string[];
  adapterRequiredPreservedUsageIds: string[];
  refreshReconciliationPreservedUsageIds: string[];
  fallbackExplicitPreservedUsageIds: string[];
  blockedPreservedUsageIds: string[];
  nextCandidates: string[];
  adapterRemovalGlobalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthPartialAdapterDecommissionRegressionHardening = {
  nativeContract: 'ZavorthPartialAdapterDecommissionRegressionHardening/v1';
  publicSurfaceZavorthNative: true;
  productionLoadedNativeRegistryFallbackPreserved: true;
  inMemoryNativeRegistryFallbackPreserved: true;
  refreshCommitControlledPathPreserved: true;
  staticGuardReinforced: true;
  adapterGlobalStillAvailable: true;
  rawSecretSerialized: false;
};

export type ZavorthPartialAdapterDecommissionExecutionGate = {
  partialAdapterDecommissionImplemented: true;
  adapterGlobalStillAvailable: true;
  adapterRemovalGlobalAllowed: false;
  adapterDefaultPathForNativeReadySurfaces: false;
  runtimeExternalExecutorRequiredForNativeReadyConsumers: false;
  adapterRefreshAllowed: true;
  adapterRequiredSurfacesPreserved: true;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  externalMutationActuallyPerformed: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthPartialAdapterDecommissionImplementationSource = {
  decommissionReadiness: Pick<
    ZavorthAdapterDecommissionReadinessNormalization,
    'decision' | 'usageInventory'
  >;
  partialAdapterRemoval: Pick<ZavorthPartialAdapterRemovalImplementationNormalization, 'decision'>;
  publicSurfaceHardening: Pick<ZavorthNativeAbsorptionPublicSurfaceHardeningNormalization, 'decision'>;
  consumerExpansion: Pick<ZavorthNativeRegistryConsumerExpansionNormalization, 'decision'>;
  refreshCommit: Pick<ZavorthNativeRefreshCommitReceipt, 'decision'>;
  staticGuardFiles: ZavorthAdapterDecommissionStaticGuardFile[];
  adapterGlobalAvailable: true;
  adapterRemovalAttempted: false;
  adapterRequiredSurfaceRemoved: false;
  bridgeOrLiveProbeDeleted: false;
  externalExecutorLiveCalledForDefaultPath: false;
  executionAttempted: false;
  externalMutationAttempted: false;
  stateMigrationAttempted: false;
  sourceModuleCopyAttempted: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
};

export type ZavorthPartialAdapterDecommissionImplementationNormalization = {
  nativeContract: 'ZavorthPartialAdapterDecommissionImplementationPack/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthPartialAdapterDecommissionImplementationDecision;
  status: 'blocked' | 'partial-adapter-decommission-implemented';
  sourceReadiness: {
    decommissionReadiness: ZavorthAdapterDecommissionReadinessNormalization['decision'];
    partialAdapterRemoval: ZavorthPartialAdapterRemovalImplementationNormalization['decision'];
    publicSurfaceHardening: ZavorthNativeAbsorptionPublicSurfaceHardeningNormalization['decision'];
    consumerExpansion: ZavorthNativeRegistryConsumerExpansionNormalization['decision'];
    refreshCommit: ZavorthNativeRefreshCommitReceipt['decision'];
  };
  implementationRows: ZavorthPartialAdapterDecommissionImplementationRow[];
  consumerRewiring: ZavorthPartialAdapterDecommissionConsumerRewire[];
  staticGuard: ZavorthAdapterDecommissionStaticGuard;
  adapterGlobalAvailability: ZavorthPartialAdapterDecommissionAdapterGlobalAvailability;
  regressionHardening: ZavorthPartialAdapterDecommissionRegressionHardening;
  decommissionReport: ZavorthPartialAdapterDecommissionReport;
  executionGate: ZavorthPartialAdapterDecommissionExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    publicSourceIdentityExposed: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-refresh-boundary-hardening-or-next-partial-decommission-pack';
};

export type ZavorthPartialAdapterDecommissionImplementationOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  runtimeId: TRuntimeId;
  source: ZavorthPartialAdapterDecommissionImplementationSource;
};

const CONSUMER_REWIRE_IDS = new Set([
  'command-center-runtime-projection-default-route',
  'controlled-dry-run-action-planner-default-route',
  'command-http-policy-preflight-default-route',
  'command-http-observability-projection-default-route',
]);

function readinessUsage(
  row: Omit<ZavorthAdapterUsageInventoryRow, 'nativeContract' | 'defaultAdapterPath' | 'adapterCalledForDefaultPath' | 'externalExecutorLiveCalledForDefaultPath' | 'adapterRemovalGlobalAllowed' | 'runtimeExternalExecutorRequiredForNativeReadyConsumers' | 'messageActuallySent' | 'providerActuallyExecuted' | 'commandActuallyExecuted' | 'toolActuallyExecuted' | 'externalMutationActuallyPerformed' | 'stateMigrated' | 'sourceModuleCopied' | 'rawSecretSerialized'>,
): ZavorthAdapterUsageInventoryRow {
  return {
    nativeContract: 'ZavorthAdapterUsageInventoryRow/v1',
    ...row,
    defaultAdapterPath: false,
    adapterCalledForDefaultPath: false,
    externalExecutorLiveCalledForDefaultPath: false,
    adapterRemovalGlobalAllowed: false,
    runtimeExternalExecutorRequiredForNativeReadyConsumers: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    externalMutationActuallyPerformed: false,
    stateMigrated: false,
    sourceModuleCopied: false,
    rawSecretSerialized: false,
  };
}

function buildReadinessUsageInventory(): ZavorthAdapterUsageInventoryRow[] {
  return [
    readinessUsage({
      usageId: 'command-center-runtime-projection-default-route',
      label: 'Command Center runtime projection default route',
      path: 'src/ai-gateway/app/(dashboard)/control/command-center/projections/commandCenterRuntimeProjection.ts',
      usageKind: 'native-ready-consumer',
      classification: 'safe-removal-candidate',
      decommissionDisposition: 'can-remove-now',
      nativeReadySurface: true,
      explicitAllowlist: false,
      allowlistRoles: [],
      safeRemovalCandidate: true,
      adapterRefreshAllowed: false,
    }),
    readinessUsage({
      usageId: 'controlled-dry-run-action-planner-default-route',
      label: 'Controlled dry-run action planner default route',
      path: 'src/runtime/external-agents/ExternalAgentControlledDryRunActionPlanner.ts',
      usageKind: 'native-ready-consumer',
      classification: 'safe-removal-candidate',
      decommissionDisposition: 'can-remove-now',
      nativeReadySurface: true,
      explicitAllowlist: false,
      allowlistRoles: [],
      safeRemovalCandidate: true,
      adapterRefreshAllowed: false,
    }),
    readinessUsage({
      usageId: 'command-http-policy-preflight-default-route',
      label: 'Command/http policy preflight default route',
      path: 'src/runtime/external-agents/ExternalAgentCommandHttpPolicyPreflightBoundary.ts',
      usageKind: 'native-ready-consumer',
      classification: 'safe-removal-candidate',
      decommissionDisposition: 'can-remove-now',
      nativeReadySurface: true,
      explicitAllowlist: false,
      allowlistRoles: [],
      safeRemovalCandidate: true,
      adapterRefreshAllowed: false,
    }),
    readinessUsage({
      usageId: 'command-http-observability-projection-default-route',
      label: 'Command/http observability projection default route',
      path: 'src/runtime/external-agents/ExternalAgentCommandHttpObservabilityProjectionBoundary.ts',
      usageKind: 'native-ready-consumer',
      classification: 'safe-removal-candidate',
      decommissionDisposition: 'can-remove-now',
      nativeReadySurface: true,
      explicitAllowlist: false,
      allowlistRoles: [],
      safeRemovalCandidate: true,
      adapterRefreshAllowed: false,
    }),
    readinessUsage({
      usageId: 'native-registry-refresh-reconciliation',
      label: 'Native registry refresh/reconciliation boundary',
      path: 'src/runtime/external-agents/ZavorthNativeRegistryRefreshReconciliation.ts',
      usageKind: 'refresh-reconciliation-boundary',
      classification: 'refresh-reconciliation-allowed',
      decommissionDisposition: 'isolate-behind-refresh-boundary',
      nativeReadySurface: false,
      explicitAllowlist: true,
      allowlistRoles: ['refresh-source', 'reconciliation-source'],
      safeRemovalCandidate: false,
      adapterRefreshAllowed: true,
    }),
    readinessUsage({
      usageId: 'native-refresh-commit-pack',
      label: 'Native refresh commit pack',
      path: 'src/runtime/external-agents/ZavorthNativeRefreshCommitPack.ts',
      usageKind: 'refresh-reconciliation-boundary',
      classification: 'refresh-reconciliation-allowed',
      decommissionDisposition: 'isolate-behind-refresh-boundary',
      nativeReadySurface: false,
      explicitAllowlist: true,
      allowlistRoles: ['refresh-source', 'reconciliation-source'],
      safeRemovalCandidate: false,
      adapterRefreshAllowed: true,
    }),
    readinessUsage({
      usageId: 'fixture-external-agent-adapter',
      label: 'Fixture external agent adapter',
      path: 'src/runtime/external-agents/FixtureExternalAgentAdapter.ts',
      usageKind: 'fixture-adapter',
      classification: 'fallback-explicit',
      decommissionDisposition: 'unknown-needs-audit',
      nativeReadySurface: false,
      explicitAllowlist: true,
      allowlistRoles: ['adapter-contract-fixture', 'degraded-fallback-explicit'],
      safeRemovalCandidate: false,
      removalBlockedReason: 'still referenced by contract and inbound conformance tests',
      adapterRefreshAllowed: false,
    }),
    readinessUsage({
      usageId: 'external-executor-live-read-only-probe',
      label: 'Live read-only probe boundary',
      path: 'src/runtime/external-agents/ExternalAgentExternalExecutorLiveReadOnlyProbe.ts',
      usageKind: 'live-probe-boundary',
      classification: 'adapter-required',
      decommissionDisposition: 'keep-required',
      nativeReadySurface: false,
      explicitAllowlist: true,
      allowlistRoles: ['live-probe-read-only'],
      safeRemovalCandidate: false,
      removalBlockedReason: 'read-only refresh and source health evidence still need this boundary',
      adapterRefreshAllowed: true,
    }),
    readinessUsage({
      usageId: 'external-executor-authenticated-health-probe',
      label: 'Authenticated gateway health probe boundary',
      path: 'src/runtime/external-agents/ExternalAgentExternalExecutorAuthenticatedEphemeralGatewayHealthProbe.ts',
      usageKind: 'live-probe-boundary',
      classification: 'adapter-required',
      decommissionDisposition: 'keep-required',
      nativeReadySurface: false,
      explicitAllowlist: true,
      allowlistRoles: ['live-probe-read-only'],
      safeRemovalCandidate: false,
      removalBlockedReason: 'authenticated health remains refresh/readiness evidence',
      adapterRefreshAllowed: true,
    }),
    readinessUsage({
      usageId: 'external-executor-real-capability-snapshot',
      label: 'Real capability snapshot read-only boundary',
      path: 'src/runtime/external-agents/ExternalAgentExternalExecutorRealCapabilitySnapshotReadOnly.ts',
      usageKind: 'live-probe-boundary',
      classification: 'adapter-required',
      decommissionDisposition: 'keep-required',
      nativeReadySurface: false,
      explicitAllowlist: true,
      allowlistRoles: ['live-probe-read-only'],
      safeRemovalCandidate: false,
      removalBlockedReason: 'future refresh can still reconcile against real read-only snapshot source',
      adapterRefreshAllowed: true,
    }),
    readinessUsage({
      usageId: 'external-executor-live-read-only-bridge',
      label: 'Live read-only bridge boundary',
      path: 'src/runtime/external-agents/ExternalAgentExternalExecutorLiveReadOnlyBridgeBoundary.ts',
      usageKind: 'read-only-bridge-boundary',
      classification: 'adapter-required',
      decommissionDisposition: 'keep-required',
      nativeReadySurface: false,
      explicitAllowlist: true,
      allowlistRoles: ['live-probe-read-only', 'reconciliation-source'],
      safeRemovalCandidate: false,
      removalBlockedReason: 'bridge remains source evidence for refresh and reconciliation',
      adapterRefreshAllowed: true,
    }),
    readinessUsage({
      usageId: 'approved-mutation-execution-harness',
      label: 'Approved mutation execution harness',
      path: 'src/runtime/external-agents/ExternalAgentApprovedMutationExecutionHarness.ts',
      usageKind: 'action-mutation-boundary',
      classification: 'adapter-required',
      decommissionDisposition: 'blocked',
      nativeReadySurface: false,
      explicitAllowlist: false,
      allowlistRoles: [],
      safeRemovalCandidate: false,
      removalBlockedReason: 'mutation/message/provider/command execution remains blocked and not decommissionable',
      adapterRefreshAllowed: false,
    }),
  ];
}

function implementationActionFor(
  row: ZavorthAdapterUsageInventoryRow,
): ZavorthPartialAdapterDecommissionImplementationAction {
  if (row.safeRemovalCandidate) {
    return 'default-legacy-route-removed-or-isolated';
  }
  if (row.decommissionDisposition === 'isolate-behind-refresh-boundary') {
    return 'preserved-behind-explicit-refresh';
  }
  if (row.decommissionDisposition === 'keep-required') {
    return 'preserved-adapter-required';
  }
  if (row.decommissionDisposition === 'blocked') {
    return 'preserved-blocked';
  }
  return 'preserved-for-audit';
}

function implementationStatusFor(
  row: ZavorthAdapterUsageInventoryRow,
): ZavorthPartialAdapterDecommissionImplementationStatus {
  if (row.safeRemovalCandidate) {
    return 'isolated';
  }
  if (row.decommissionDisposition === 'blocked') {
    return 'blocked';
  }
  return 'preserved';
}

function implementationRow(row: ZavorthAdapterUsageInventoryRow): ZavorthPartialAdapterDecommissionImplementationRow {
  const refreshBoundaryPreserved = row.decommissionDisposition === 'isolate-behind-refresh-boundary';
  const adapterRequiredSurfacePreserved = row.decommissionDisposition === 'keep-required' || row.decommissionDisposition === 'blocked';

  return {
    nativeContract: 'ZavorthPartialAdapterDecommissionImplementationRow/v1',
    usageId: row.usageId,
    label: row.label,
    path: row.path,
    priorClassification: row.classification,
    priorDisposition: row.decommissionDisposition,
    implementationAction: implementationActionFor(row),
    implementationStatus: implementationStatusFor(row),
    safeRemovalCandidateFrom206: row.safeRemovalCandidate,
    defaultLegacyUsageRemovedOrIsolated: row.safeRemovalCandidate,
    adapterRequiredSurfacePreserved,
    refreshBoundaryPreserved,
    fallbackExplicitOnly: row.explicitAllowlist || row.safeRemovalCandidate,
    actualFileDeleted: false,
    adapterGlobalStillAvailable: true,
    adapterDefaultPathForNativeReadySurfaces: false,
    runtimeExternalExecutorRequiredForNativeReadyConsumers: false,
    adapterRefreshAllowed: row.adapterRefreshAllowed || refreshBoundaryPreserved,
    adapterRemovalGlobalAllowed: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    externalMutationActuallyPerformed: false,
    stateMigrated: false,
    sourceModuleCopied: false,
    rawSecretSerialized: false,
  };
}

function buildImplementationRows(
  readiness: Pick<ZavorthAdapterDecommissionReadinessNormalization, 'usageInventory'>,
): ZavorthPartialAdapterDecommissionImplementationRow[] {
  return readiness.usageInventory.map(implementationRow);
}

function consumerRewiring(
  rows: ZavorthPartialAdapterDecommissionImplementationRow[],
): ZavorthPartialAdapterDecommissionConsumerRewire[] {
  return rows
    .filter((row) => CONSUMER_REWIRE_IDS.has(row.usageId))
    .map((row) => ({
      nativeContract: 'ZavorthPartialAdapterDecommissionConsumerRewire/v1',
      consumerId: row.usageId,
      path: row.path,
      defaultPath: 'native-registry',
      adapterAllowedModes: ['explicit-refresh', 'reconciliation', 'degraded-fallback'],
      defaultAdapterUsageRemovedOrIsolated: true,
      adapterCalledForDefaultPath: false,
      runtimeExternalExecutorRequiredForDefaultPath: false,
      publicExternalExecutorIdentityExposed: false,
      rawSecretSerialized: false,
    }));
}

function adapterGlobalAvailability(): ZavorthPartialAdapterDecommissionAdapterGlobalAvailability {
  return {
    nativeContract: 'ZavorthPartialAdapterDecommissionAdapterGlobalAvailability/v1',
    globalAdapterStillAvailable: true,
    fixtureAdapterPath: 'src/runtime/external-agents/FixtureExternalAgentAdapter.ts',
    liveProbePath: 'src/runtime/external-agents/ExternalAgentExternalExecutorLiveReadOnlyProbe.ts',
    refreshReconciliationPath: 'src/runtime/external-agents/ZavorthNativeRegistryRefreshReconciliation.ts',
    adapterRequiredSurfacesPreserved: true,
    adapterRemovalGlobalAllowed: false,
    rawSecretSerialized: false,
  };
}

function decommissionReport(
  rows: ZavorthPartialAdapterDecommissionImplementationRow[],
): ZavorthPartialAdapterDecommissionReport {
  return {
    nativeContract: 'ZavorthPartialAdapterDecommissionReport/v1',
    removedOrIsolatedUsageIds: rows
      .filter((row) => row.defaultLegacyUsageRemovedOrIsolated)
      .map((row) => row.usageId),
    adapterRequiredPreservedUsageIds: rows
      .filter((row) => row.adapterRequiredSurfacePreserved)
      .map((row) => row.usageId),
    refreshReconciliationPreservedUsageIds: rows
      .filter((row) => row.refreshBoundaryPreserved)
      .map((row) => row.usageId),
    fallbackExplicitPreservedUsageIds: rows
      .filter((row) => row.implementationAction === 'preserved-for-audit')
      .map((row) => row.usageId),
    blockedPreservedUsageIds: rows
      .filter((row) => row.implementationAction === 'preserved-blocked')
      .map((row) => row.usageId),
    nextCandidates: [
      'fixture-external-agent-adapter',
      'public-legacy-doc-api-name-cleanup',
      'refresh-boundary-wrapper-hardening',
    ],
    adapterRemovalGlobalAllowed: false,
    rawSecretSerialized: false,
  };
}

function regressionHardening(): ZavorthPartialAdapterDecommissionRegressionHardening {
  return {
    nativeContract: 'ZavorthPartialAdapterDecommissionRegressionHardening/v1',
    publicSurfaceZavorthNative: true,
    productionLoadedNativeRegistryFallbackPreserved: true,
    inMemoryNativeRegistryFallbackPreserved: true,
    refreshCommitControlledPathPreserved: true,
    staticGuardReinforced: true,
    adapterGlobalStillAvailable: true,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthPartialAdapterDecommissionExecutionGate {
  return {
    partialAdapterDecommissionImplemented: true,
    adapterGlobalStillAvailable: true,
    adapterRemovalGlobalAllowed: false,
    adapterDefaultPathForNativeReadySurfaces: false,
    runtimeExternalExecutorRequiredForNativeReadyConsumers: false,
    adapterRefreshAllowed: true,
    adapterRequiredSurfacesPreserved: true,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    externalMutationActuallyPerformed: false,
    stateMigrated: false,
    sourceModuleCopied: false,
    rawSecretSerialized: false,
  };
}

function sourceReady(source: ZavorthPartialAdapterDecommissionImplementationSource): boolean {
  return (
    source.decommissionReadiness.decision === 'adapter-decommission-readiness-ready' &&
    source.partialAdapterRemoval.decision === 'partial-adapter-removal-implemented' &&
    source.publicSurfaceHardening.decision === 'native-absorption-public-surface-hardened' &&
    source.consumerExpansion.decision === 'native-registry-consumer-expansion-ready' &&
    source.refreshCommit.decision === 'native-refresh-commit-ready' &&
    source.adapterGlobalAvailable &&
    !source.adapterRemovalAttempted &&
    !source.adapterRequiredSurfaceRemoved &&
    !source.bridgeOrLiveProbeDeleted &&
    !source.externalExecutorLiveCalledForDefaultPath &&
    !source.executionAttempted &&
    !source.externalMutationAttempted &&
    !source.stateMigrationAttempted &&
    !source.sourceModuleCopyAttempted &&
    !source.publicExternalExecutorIdentityExposed &&
    !source.rawSecretSerialized
  );
}

export class ZavorthPartialAdapterDecommissionImplementationPack {
  private readonly rowsById: Map<string, ZavorthPartialAdapterDecommissionImplementationRow>;

  public constructor(public readonly normalization: ZavorthPartialAdapterDecommissionImplementationNormalization) {
    this.rowsById = new Map(normalization.implementationRows.map((row) => [row.usageId, row]));
  }

  public lookupImplementation(usageId: string): ZavorthPartialAdapterDecommissionImplementationRow | undefined {
    return this.rowsById.get(usageId);
  }

  public removedOrIsolatedRows(): ZavorthPartialAdapterDecommissionImplementationRow[] {
    return this.normalization.implementationRows.filter((row) => row.defaultLegacyUsageRemovedOrIsolated);
  }

  public preservedAdapterRequiredRows(): ZavorthPartialAdapterDecommissionImplementationRow[] {
    return this.normalization.implementationRows.filter((row) => row.adapterRequiredSurfacePreserved);
  }
}

export function createZavorthPartialAdapterDecommissionImplementationFixtureSource(
  staticGuardFiles: ZavorthAdapterDecommissionStaticGuardFile[] = [],
): ZavorthPartialAdapterDecommissionImplementationSource {
  return {
    decommissionReadiness: {
      decision: 'adapter-decommission-readiness-ready',
      usageInventory: buildReadinessUsageInventory(),
    },
    partialAdapterRemoval: { decision: 'partial-adapter-removal-implemented' },
    publicSurfaceHardening: { decision: 'native-absorption-public-surface-hardened' },
    consumerExpansion: { decision: 'native-registry-consumer-expansion-ready' },
    refreshCommit: { decision: 'native-refresh-commit-ready' },
    staticGuardFiles,
    adapterGlobalAvailable: true,
    adapterRemovalAttempted: false,
    adapterRequiredSurfaceRemoved: false,
    bridgeOrLiveProbeDeleted: false,
    externalExecutorLiveCalledForDefaultPath: false,
    executionAttempted: false,
    externalMutationAttempted: false,
    stateMigrationAttempted: false,
    sourceModuleCopyAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    rawSecretSerialized: false,
  };
}

export function normalizeZavorthPartialAdapterDecommissionImplementationPack<TRuntimeId extends string>(
  options: ZavorthPartialAdapterDecommissionImplementationOptions<TRuntimeId>,
): ZavorthPartialAdapterDecommissionImplementationNormalization {
  const implementationRows = buildImplementationRows(options.source.decommissionReadiness);
  const rewiring = consumerRewiring(implementationRows);
  const staticGuard = evaluateZavorthAdapterDecommissionStaticGuard(options.source.staticGuardFiles);
  const report = decommissionReport(implementationRows);
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    staticGuard.passed &&
    rewiring.length >= 4 &&
    report.removedOrIsolatedUsageIds.length >= 4 &&
    report.adapterRequiredPreservedUsageIds.length > 0 &&
    implementationRows.every((row) => (
      row.adapterGlobalStillAvailable &&
      !row.adapterDefaultPathForNativeReadySurfaces &&
      !row.runtimeExternalExecutorRequiredForNativeReadyConsumers &&
      !row.rawSecretSerialized
    ));

  return {
    nativeContract: 'ZavorthPartialAdapterDecommissionImplementationPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'partial-adapter-decommission-implemented' : 'blocked',
    status: ready ? 'partial-adapter-decommission-implemented' : 'blocked',
    sourceReadiness: {
      decommissionReadiness: options.source.decommissionReadiness.decision,
      partialAdapterRemoval: options.source.partialAdapterRemoval.decision,
      publicSurfaceHardening: options.source.publicSurfaceHardening.decision,
      consumerExpansion: options.source.consumerExpansion.decision,
      refreshCommit: options.source.refreshCommit.decision,
    },
    implementationRows,
    consumerRewiring: rewiring,
    staticGuard,
    adapterGlobalAvailability: adapterGlobalAvailability(),
    regressionHardening: regressionHardening(),
    decommissionReport: report,
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      publicSourceIdentityExposed: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-refresh-boundary-hardening-or-next-partial-decommission-pack',
  };
}

export function normalizeZavorthPartialAdapterDecommissionImplementationPackFixture(
  staticGuardFiles: ZavorthAdapterDecommissionStaticGuardFile[] = [],
): ZavorthPartialAdapterDecommissionImplementationNormalization {
  return normalizeZavorthPartialAdapterDecommissionImplementationPack({
    generatedAt: ZAVORTH_PARTIAL_ADAPTER_DECOMMISSION_IMPLEMENTATION_PACK_NOW,
    runtimeId: ZAVORTH_PARTIAL_ADAPTER_DECOMMISSION_IMPLEMENTATION_PACK_RUNTIME_ID,
    source: createZavorthPartialAdapterDecommissionImplementationFixtureSource(staticGuardFiles),
  });
}

export function createZavorthPartialAdapterDecommissionImplementationPackFixture(
  staticGuardFiles: ZavorthAdapterDecommissionStaticGuardFile[] = [],
): ZavorthPartialAdapterDecommissionImplementationPack {
  return new ZavorthPartialAdapterDecommissionImplementationPack(
    normalizeZavorthPartialAdapterDecommissionImplementationPackFixture(staticGuardFiles),
  );
}
