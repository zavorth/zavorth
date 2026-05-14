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
  normalizeZavorthPartialAdapterDeprecationGateFixture,
} from './ZavorthPartialAdapterDeprecationGate.js';
import {
  normalizeExternalExecutorAuthenticatedEphemeralGatewayHealthProbe,
} from './ExternalAgentExternalExecutorAuthenticatedEphemeralGatewayHealthProbe.js';
import {
  normalizeExternalExecutorRealCapabilitySnapshotReadOnlyFixture,
} from './ExternalAgentExternalExecutorRealCapabilitySnapshotReadOnly.js';
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
  ZavorthNativeRegistryParitySurfaceId,
} from './ZavorthNativeRegistryParityDependencyReduction.js';
import type {
  ZavorthNativeSessionHistoryRegistry,
  ZavorthNativeSessionHistoryRegistryNormalization,
} from './ZavorthNativeSessionHistoryRegistry.js';
import type {
  ZavorthPartialAdapterDeprecationNormalization,
} from './ZavorthPartialAdapterDeprecationGate.js';
import type {
  ExternalExecutorAuthenticatedEphemeralGatewayHealthProbeNormalization,
  ExternalExecutorAuthenticatedEphemeralGatewayHealthProbeSource,
} from './ExternalAgentExternalExecutorAuthenticatedEphemeralGatewayHealthProbe.js';
import type {
  ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization,
} from './ExternalAgentExternalExecutorRealCapabilitySnapshotReadOnly.js';

export const ZAVORTH_NATIVE_REGISTRY_REFRESH_RECONCILIATION_NOW = '2026-04-29T04:00:00.000Z' as const;
export const ZAVORTH_NATIVE_REGISTRY_REFRESH_RECONCILIATION_RUNTIME_ID = 'zavorth-native-registry-refresh-reconciliation' as const;

export type ZavorthNativeRegistryRefreshReconciliationDecision =
  | 'blocked'
  | 'native-registry-refresh-reconciliation-ready';

export type ZavorthNativeRegistryRefreshMode =
  | 'blocked'
  | 'disabled'
  | 'live-adapter-optional'
  | 'manual'
  | 'scheduled-future';

export type ZavorthNativeRegistryReconciliationOutcome =
  | 'conflict'
  | 'degraded'
  | 'no-change'
  | 'rejected-by-policy'
  | 'source-unavailable'
  | 'updated';

export type ZavorthNativeRegistryRefreshSurfaceId = Extract<
  ZavorthNativeRegistryParitySurfaceId,
  | 'capability-lookup-classify'
  | 'config-secretref-state-metadata-lookup'
  | 'dashboard-render-view-lookup'
  | 'provider-channel-transport-metadata-lookup'
  | 'session-history-metadata-lookup'
>;

export type ZavorthNativeRegistryRefreshPolicy = {
  nativeContract: 'ZavorthNativeRegistryRefreshPolicy/v1';
  mode: ZavorthNativeRegistryRefreshMode;
  label: string;
  adapterMayBeCalled: boolean;
  adapterCallIsDefaultPath: false;
  requiresExplicitOperatorIntent: boolean;
  requiresAuthenticatedHealthOk: boolean;
  requiresSecretRefOnly: boolean;
  readOnlySourceOnly: true;
  dryRunSupported: true;
  commitAllowedInThisGate: false;
  registryMutationCommitted: false;
  defaultLookupPathPreserved: 'native-registry';
  defaultRenderPathPreserved: 'native-registry';
  runtimeExternalExecutorRequiredForDefaultLookup: false;
  runtimeExternalExecutorRequiredForDefaultRender: false;
  executionAuthority: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryRefreshCandidate = {
  nativeContract: 'ZavorthNativeRegistryRefreshCandidate/v1';
  surfaceId: ZavorthNativeRegistryRefreshSurfaceId;
  nativeRegistryId: string;
  currentNativeRecordCount: number;
  optionalExternalRecordCount: number;
  outcome: ZavorthNativeRegistryReconciliationOutcome;
  diffSummary: string;
  proposedRecordDelta: number;
  conflictReason?: string;
  degradedReason?: string;
  sourceUnavailableReason?: string;
  commitPlannedForFutureGate: boolean;
  registryMutationCommitted: false;
  sourceRuntimeAuthority: false;
  sourceIdsEvidenceOnly: true;
  provenanceInternalOnly: true;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryRefreshReceipt = {
  nativeContract: 'ZavorthNativeRegistryRefreshReceipt/v1';
  id: string;
  mode: ZavorthNativeRegistryRefreshMode;
  dryRun: true;
  outcome: ZavorthNativeRegistryReconciliationOutcome;
  adapterInvocationPlanned: boolean;
  adapterActuallyCalled: false;
  optionalSourceAvailable: boolean;
  policyAllowedAdapterRefresh: boolean;
  registryMutationCommitted: false;
  nativeFirstLookupPreserved: true;
  nativeFirstRenderPreserved: true;
  runtimeExternalExecutorRequiredForDefaultLookup: false;
  runtimeExternalExecutorRequiredForDefaultRender: false;
  commandCenterNativeFirstPreserved: true;
  redacted: true;
  candidateOutcomes: Array<{
    surfaceId: ZavorthNativeRegistryRefreshSurfaceId;
    outcome: ZavorthNativeRegistryReconciliationOutcome;
    proposedRecordDelta: number;
  }>;
  diagnostics: string[];
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryRefreshReconciliationExecutionGate = {
  nativeFirstLookupPreserved: true;
  nativeFirstRenderPreserved: true;
  refreshAdapterOptional: true;
  runtimeExternalExecutorRequiredForDefaultLookup: false;
  runtimeExternalExecutorRequiredForDefaultRender: false;
  registryMutationCommitted: false;
  stateMigrated: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  sourceModuleCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryRefreshReconciliationSource = {
  partialAdapterDeprecation: ZavorthPartialAdapterDeprecationNormalization;
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
  authenticatedHealth: ExternalExecutorAuthenticatedEphemeralGatewayHealthProbeNormalization;
  optionalCapabilitySnapshot: ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization;
  adapterCalledDuringDefaultLookup: false;
  adapterCalledDuringDefaultRender: false;
  registryMutationAttempted: false;
  stateMigrationAttempted: false;
  executionAttempted: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryRefreshReconciliationNormalization = {
  nativeContract: 'ZavorthNativeRegistryRefreshReconciliation/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthNativeRegistryRefreshReconciliationDecision;
  status: 'blocked' | 'native-registry-refresh-reconciliation-ready';
  sourceReadiness: {
    partialAdapterDeprecation: ZavorthPartialAdapterDeprecationNormalization['decision'];
    authenticatedHealth: ExternalExecutorAuthenticatedEphemeralGatewayHealthProbeNormalization['decision'];
    optionalCapabilitySnapshot: ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization['decision'];
    nativeCapabilityRegistry: ZavorthNativeCapabilityRegistryReplacementNormalization['decision'];
    nativeDashboardViewModelRegistry: ZavorthNativeDashboardViewModelRegistryNormalization['decision'];
    nativeIntegrationRegistry: ZavorthNativeIntegrationRegistryNormalization['decision'];
    nativeSessionHistoryRegistry: ZavorthNativeSessionHistoryRegistryNormalization['decision'];
    nativeConfigStateRegistry: ZavorthNativeConfigStateRegistryNormalization['decision'];
  };
  refreshPolicies: ZavorthNativeRegistryRefreshPolicy[];
  candidates: ZavorthNativeRegistryRefreshCandidate[];
  dryRunReceipt: ZavorthNativeRegistryRefreshReceipt;
  commandCenterDefaultPath: {
    nativeFirstLookupPreserved: true;
    nativeFirstRenderPreserved: true;
    commandCenterNativeFirstEnabled: true;
    commandCenterDefaultAdapterCall: false;
    runtimeExternalExecutorRequiredForCommandCenterRender: false;
    runtimeExternalExecutorRequiredForCommandCenterLookup: false;
  };
  dependencyProtection: {
    externalExecutorOptionalForRefreshOnly: true;
    externalExecutorRequiredForLookupAgain: false;
    externalExecutorRequiredForRenderAgain: false;
    adapterRemovalAllowed: false;
  };
  executionGate: ZavorthNativeRegistryRefreshReconciliationExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    sourceIdentityPublic: false;
    sourceStructuresPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-native-registry-refresh-commit-or-adapter-removal-parity-gate';
};

export type ZavorthNativeRegistryRefreshReconciliationOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  source: ZavorthNativeRegistryRefreshReconciliationSource;
};

export type ZavorthNativeRegistryRefreshPlanOverrides = {
  optionalSourceAvailable?: boolean;
  policyAllowedAdapterRefresh?: boolean;
};

function authenticatedHealthOkFixture(): ExternalExecutorAuthenticatedEphemeralGatewayHealthProbeNormalization {
  const source: ExternalExecutorAuthenticatedEphemeralGatewayHealthProbeSource = {
    runtimeLabel: 'ExternalExecutor gateway authenticated ephemeral health probe',
    endpoint: 'ws://127.0.0.1:18789',
    priorSecretRefDecision: 'secret-ref-path-known',
    secretRefResolution: {
      secretRefId: 'external-executor-gateway-token',
      resolver: 'zavorth-secret-store',
      status: 'resolved',
      rawSecretValueLoadedByNormalizer: false,
      rawSecretValuePrinted: false,
      credentialPassedThroughSecureChannel: true,
      commandLineContainsRawSecret: false,
      logsContainRawSecret: false,
    },
    preflight: {
      preexistingProcessFound: false,
      preexistingListenerFound: false,
      configHashBefore: 'redacted-config-hash-before',
      configHashAfter: 'redacted-config-hash-before',
      configRestored: true,
    },
    gatewayStart: {
      attempted: true,
      startedByGate: true,
      listenerObserved: true,
      cleanupAttempted: true,
      cleanupSucceeded: true,
    },
    commandResults: [
      {
        kind: 'health',
        commandLabel: 'external-executor gateway health --read-only',
        attempted: true,
        exitCode: 0,
        stdout: 'health ok; token=[redacted-secret]',
        stderr: '',
      },
      {
        kind: 'status',
        commandLabel: 'external-executor gateway status --read-only',
        attempted: true,
        exitCode: 0,
        stdout: 'status ready; source=metadata-only',
        stderr: '',
      },
      {
        kind: 'probe',
        commandLabel: 'external-executor gateway probe --read-only',
        attempted: true,
        exitCode: 0,
        stdout: 'probe ready; capabilities=metadata-only',
        stderr: '',
      },
    ],
  };

  return normalizeExternalExecutorAuthenticatedEphemeralGatewayHealthProbe({
    generatedAt: ZAVORTH_NATIVE_REGISTRY_REFRESH_RECONCILIATION_NOW,
    runtimeId: 'external-executor-authenticated-ephemeral-gateway-health-probe',
    idPrefix: 'external-executor-authenticated-ephemeral-health',
    source,
  });
}

function refreshPolicies(): ZavorthNativeRegistryRefreshPolicy[] {
  return [
    {
      nativeContract: 'ZavorthNativeRegistryRefreshPolicy/v1',
      mode: 'disabled',
      label: 'Refresh disabled; native registries remain the only lookup and render source.',
      adapterMayBeCalled: false,
      adapterCallIsDefaultPath: false,
      requiresExplicitOperatorIntent: false,
      requiresAuthenticatedHealthOk: false,
      requiresSecretRefOnly: false,
      readOnlySourceOnly: true,
      dryRunSupported: true,
      commitAllowedInThisGate: false,
      registryMutationCommitted: false,
      defaultLookupPathPreserved: 'native-registry',
      defaultRenderPathPreserved: 'native-registry',
      runtimeExternalExecutorRequiredForDefaultLookup: false,
      runtimeExternalExecutorRequiredForDefaultRender: false,
      executionAuthority: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthNativeRegistryRefreshPolicy/v1',
      mode: 'manual',
      label: 'Manual dry-run refresh from supplied read-only evidence.',
      adapterMayBeCalled: false,
      adapterCallIsDefaultPath: false,
      requiresExplicitOperatorIntent: true,
      requiresAuthenticatedHealthOk: false,
      requiresSecretRefOnly: true,
      readOnlySourceOnly: true,
      dryRunSupported: true,
      commitAllowedInThisGate: false,
      registryMutationCommitted: false,
      defaultLookupPathPreserved: 'native-registry',
      defaultRenderPathPreserved: 'native-registry',
      runtimeExternalExecutorRequiredForDefaultLookup: false,
      runtimeExternalExecutorRequiredForDefaultRender: false,
      executionAuthority: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthNativeRegistryRefreshPolicy/v1',
      mode: 'scheduled-future',
      label: 'Future scheduler hook; no scheduler or adapter call exists in this gate.',
      adapterMayBeCalled: false,
      adapterCallIsDefaultPath: false,
      requiresExplicitOperatorIntent: true,
      requiresAuthenticatedHealthOk: true,
      requiresSecretRefOnly: true,
      readOnlySourceOnly: true,
      dryRunSupported: true,
      commitAllowedInThisGate: false,
      registryMutationCommitted: false,
      defaultLookupPathPreserved: 'native-registry',
      defaultRenderPathPreserved: 'native-registry',
      runtimeExternalExecutorRequiredForDefaultLookup: false,
      runtimeExternalExecutorRequiredForDefaultRender: false,
      executionAuthority: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthNativeRegistryRefreshPolicy/v1',
      mode: 'live-adapter-optional',
      label: 'Optional live adapter refresh source for explicit read-only reconciliation only.',
      adapterMayBeCalled: true,
      adapterCallIsDefaultPath: false,
      requiresExplicitOperatorIntent: true,
      requiresAuthenticatedHealthOk: true,
      requiresSecretRefOnly: true,
      readOnlySourceOnly: true,
      dryRunSupported: true,
      commitAllowedInThisGate: false,
      registryMutationCommitted: false,
      defaultLookupPathPreserved: 'native-registry',
      defaultRenderPathPreserved: 'native-registry',
      runtimeExternalExecutorRequiredForDefaultLookup: false,
      runtimeExternalExecutorRequiredForDefaultRender: false,
      executionAuthority: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthNativeRegistryRefreshPolicy/v1',
      mode: 'blocked',
      label: 'Policy blocked refresh.',
      adapterMayBeCalled: false,
      adapterCallIsDefaultPath: false,
      requiresExplicitOperatorIntent: true,
      requiresAuthenticatedHealthOk: true,
      requiresSecretRefOnly: true,
      readOnlySourceOnly: true,
      dryRunSupported: true,
      commitAllowedInThisGate: false,
      registryMutationCommitted: false,
      defaultLookupPathPreserved: 'native-registry',
      defaultRenderPathPreserved: 'native-registry',
      runtimeExternalExecutorRequiredForDefaultLookup: false,
      runtimeExternalExecutorRequiredForDefaultRender: false,
      executionAuthority: false,
      rawSecretSerialized: false,
    },
  ];
}

function candidate(
  surfaceId: ZavorthNativeRegistryRefreshSurfaceId,
  nativeRegistryId: string,
  currentNativeRecordCount: number,
  optionalExternalRecordCount: number,
  outcome: ZavorthNativeRegistryReconciliationOutcome,
  diffSummary: string,
  details: Partial<Pick<
    ZavorthNativeRegistryRefreshCandidate,
    'conflictReason' | 'degradedReason' | 'sourceUnavailableReason'
  >> = {},
): ZavorthNativeRegistryRefreshCandidate {
  return {
    nativeContract: 'ZavorthNativeRegistryRefreshCandidate/v1',
    surfaceId,
    nativeRegistryId,
    currentNativeRecordCount,
    optionalExternalRecordCount,
    outcome,
    diffSummary,
    proposedRecordDelta: Math.max(0, optionalExternalRecordCount - currentNativeRecordCount),
    ...details,
    commitPlannedForFutureGate: outcome === 'updated',
    registryMutationCommitted: false,
    sourceRuntimeAuthority: false,
    sourceIdsEvidenceOnly: true,
    provenanceInternalOnly: true,
    rawSecretSerialized: false,
  };
}

function buildCandidates(source: ZavorthNativeRegistryRefreshReconciliationSource): ZavorthNativeRegistryRefreshCandidate[] {
  const externalCapabilityCount = source.optionalCapabilitySnapshot.capabilityInventory.inventory.length;

  return [
    candidate(
      'capability-lookup-classify',
      source.nativeCapabilityRegistry.registry.id,
      source.nativeCapabilityRegistry.registry.entries.length,
      externalCapabilityCount,
      'updated',
      'Optional read-only snapshot can refresh capability evidence counts without changing the default lookup path.',
    ),
    candidate(
      'dashboard-render-view-lookup',
      source.nativeDashboardViewModelRegistry.registry.id,
      source.nativeDashboardViewModelRegistry.registry.records.length,
      source.nativeDashboardViewModelRegistry.registry.records.length,
      'no-change',
      'Dashboard native view model registry already matches the selected read-only projection contract.',
    ),
    candidate(
      'provider-channel-transport-metadata-lookup',
      source.nativeIntegrationRegistry.registry.id,
      source.nativeIntegrationRegistry.registry.records.length,
      externalCapabilityCount,
      'conflict',
      'Read-only evidence observes transport/provider surfaces, but send-capable items remain policy-blocked.',
      {
        conflictReason: 'send-capable transport metadata cannot be committed as executable authority',
      },
    ),
    candidate(
      'session-history-metadata-lookup',
      source.nativeSessionHistoryRegistry.registry.id,
      source.nativeSessionHistoryRegistry.registry.sessions.length +
        source.nativeSessionHistoryRegistry.registry.threads.length +
        source.nativeSessionHistoryRegistry.registry.messages.length,
      0,
      'source-unavailable',
      'The optional capability snapshot does not carry session/history rows; native registry remains authoritative for lookup.',
      {
        sourceUnavailableReason: 'live session/history import remains blocked and source DB is not opened',
      },
    ),
    candidate(
      'config-secretref-state-metadata-lookup',
      source.nativeConfigStateRegistry.registry.id,
      source.nativeConfigStateRegistry.registry.records.length,
      source.nativeConfigStateRegistry.registry.indexes.secretRefRecordIds.length,
      'degraded',
      'Config and SecretRef evidence can be compared as metadata only; raw secret values remain unavailable by design.',
      {
        degradedReason: 'SecretRef values are redacted and cannot be used as diff material',
      },
    ),
  ];
}

function receiptOutcome(
  mode: ZavorthNativeRegistryRefreshMode,
  candidates: ZavorthNativeRegistryRefreshCandidate[],
  optionalSourceAvailable: boolean,
  policyAllowedAdapterRefresh: boolean,
): ZavorthNativeRegistryReconciliationOutcome {
  if (mode === 'blocked' || !policyAllowedAdapterRefresh) {
    return 'rejected-by-policy';
  }
  if (!optionalSourceAvailable) {
    return 'source-unavailable';
  }
  if (mode === 'disabled' || mode === 'scheduled-future') {
    return 'no-change';
  }
  if (candidates.some((row) => row.outcome === 'conflict')) {
    return 'conflict';
  }
  if (candidates.some((row) => row.outcome === 'updated')) {
    return 'updated';
  }
  return 'no-change';
}

function candidateOutcomesForReceipt(
  mode: ZavorthNativeRegistryRefreshMode,
  candidates: ZavorthNativeRegistryRefreshCandidate[],
  optionalSourceAvailable: boolean,
  policyAllowedAdapterRefresh: boolean,
): ZavorthNativeRegistryRefreshReceipt['candidateOutcomes'] {
  if (mode === 'blocked' || !policyAllowedAdapterRefresh) {
    return candidates.map((row) => ({
      surfaceId: row.surfaceId,
      outcome: 'rejected-by-policy',
      proposedRecordDelta: 0,
    }));
  }
  if (!optionalSourceAvailable) {
    return candidates.map((row) => ({
      surfaceId: row.surfaceId,
      outcome: 'source-unavailable',
      proposedRecordDelta: 0,
    }));
  }
  if (mode === 'disabled' || mode === 'scheduled-future') {
    return candidates.map((row) => ({
      surfaceId: row.surfaceId,
      outcome: 'no-change',
      proposedRecordDelta: 0,
    }));
  }
  return candidates.map((row) => ({
    surfaceId: row.surfaceId,
    outcome: row.outcome,
    proposedRecordDelta: row.outcome === 'updated' ? row.proposedRecordDelta : 0,
  }));
}

function buildReceipt(
  idPrefix: string,
  mode: ZavorthNativeRegistryRefreshMode,
  candidates: ZavorthNativeRegistryRefreshCandidate[],
  overrides: ZavorthNativeRegistryRefreshPlanOverrides = {},
): ZavorthNativeRegistryRefreshReceipt {
  const optionalSourceAvailable = overrides.optionalSourceAvailable ?? true;
  const policyAllowedAdapterRefresh = overrides.policyAllowedAdapterRefresh ?? mode !== 'blocked';
  const outcome = receiptOutcome(mode, candidates, optionalSourceAvailable, policyAllowedAdapterRefresh);
  const candidateOutcomes = candidateOutcomesForReceipt(
    mode,
    candidates,
    optionalSourceAvailable,
    policyAllowedAdapterRefresh,
  );

  return {
    nativeContract: 'ZavorthNativeRegistryRefreshReceipt/v1',
    id: `${idPrefix}:refresh-receipt:${mode}`,
    mode,
    dryRun: true,
    outcome,
    adapterInvocationPlanned: mode === 'live-adapter-optional' && optionalSourceAvailable && policyAllowedAdapterRefresh,
    adapterActuallyCalled: false,
    optionalSourceAvailable,
    policyAllowedAdapterRefresh,
    registryMutationCommitted: false,
    nativeFirstLookupPreserved: true,
    nativeFirstRenderPreserved: true,
    runtimeExternalExecutorRequiredForDefaultLookup: false,
    runtimeExternalExecutorRequiredForDefaultRender: false,
    commandCenterNativeFirstPreserved: true,
    redacted: true,
    candidateOutcomes,
    diagnostics: [
      `mode:${mode}`,
      `outcome:${outcome}`,
      `candidate-count:${candidates.length}`,
      'adapter-actually-called:false',
      'registry-mutation-committed:false',
    ],
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    stateMigrated: false,
    sourceModuleCopied: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthNativeRegistryRefreshReconciliationExecutionGate {
  return {
    nativeFirstLookupPreserved: true,
    nativeFirstRenderPreserved: true,
    refreshAdapterOptional: true,
    runtimeExternalExecutorRequiredForDefaultLookup: false,
    runtimeExternalExecutorRequiredForDefaultRender: false,
    registryMutationCommitted: false,
    stateMigrated: false,
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

function sourceReady(source: ZavorthNativeRegistryRefreshReconciliationSource): boolean {
  return (
    source.partialAdapterDeprecation.decision === 'partial-adapter-deprecation-ready' &&
    source.authenticatedHealth.decision === 'authenticated-health-ok' &&
    source.optionalCapabilitySnapshot.decision === 'real-capability-snapshot-read-only-ok' &&
    source.nativeCapabilityRegistry.decision === 'native-capability-registry-replacement-ready' &&
    source.nativeDashboardViewModelRegistry.decision === 'native-dashboard-view-model-registry-ready' &&
    source.nativeIntegrationRegistry.decision === 'native-integration-registry-ready' &&
    source.nativeSessionHistoryRegistry.decision === 'native-session-history-registry-ready' &&
    source.nativeConfigStateRegistry.decision === 'native-config-state-registry-ready' &&
    !source.adapterCalledDuringDefaultLookup &&
    !source.adapterCalledDuringDefaultRender &&
    !source.registryMutationAttempted &&
    !source.stateMigrationAttempted &&
    !source.executionAttempted &&
    !source.rawSecretSerialized
  );
}

export class ZavorthNativeRegistryRefreshReconciliation {
  public constructor(public readonly normalization: ZavorthNativeRegistryRefreshReconciliationNormalization) {}

  public listPolicies(): ZavorthNativeRegistryRefreshPolicy[] {
    return this.normalization.refreshPolicies;
  }

  public lookupPolicy(mode: ZavorthNativeRegistryRefreshMode): ZavorthNativeRegistryRefreshPolicy | undefined {
    return this.normalization.refreshPolicies.find((policy) => policy.mode === mode);
  }

  public planRefresh(
    mode: ZavorthNativeRegistryRefreshMode,
    overrides: ZavorthNativeRegistryRefreshPlanOverrides = {},
  ): ZavorthNativeRegistryRefreshReceipt {
    return buildReceipt(
      this.normalization.runtimeId,
      mode,
      this.normalization.candidates,
      overrides,
    );
  }

  public candidatesByOutcome(outcome: ZavorthNativeRegistryReconciliationOutcome): ZavorthNativeRegistryRefreshCandidate[] {
    return this.normalization.candidates.filter((candidateRow) => candidateRow.outcome === outcome);
  }
}

export function createZavorthNativeRegistryRefreshReconciliationFixtureSource(): ZavorthNativeRegistryRefreshReconciliationSource {
  return {
    partialAdapterDeprecation: normalizeZavorthPartialAdapterDeprecationGateFixture(),
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
    authenticatedHealth: authenticatedHealthOkFixture(),
    optionalCapabilitySnapshot: normalizeExternalExecutorRealCapabilitySnapshotReadOnlyFixture(),
    adapterCalledDuringDefaultLookup: false,
    adapterCalledDuringDefaultRender: false,
    registryMutationAttempted: false,
    stateMigrationAttempted: false,
    executionAttempted: false,
    rawSecretSerialized: false,
  };
}

export function normalizeZavorthNativeRegistryRefreshReconciliation<TRuntimeId extends string>(
  options: ZavorthNativeRegistryRefreshReconciliationOptions<TRuntimeId>,
): ZavorthNativeRegistryRefreshReconciliationNormalization {
  const policies = refreshPolicies();
  const candidates = buildCandidates(options.source);
  const gate = executionGate();
  const receipt = buildReceipt(options.idPrefix, 'live-adapter-optional', candidates);
  const ready = sourceReady(options.source) &&
    policies.length === 5 &&
    candidates.length === 5 &&
    candidates.some((row) => row.outcome === 'updated') &&
    candidates.some((row) => row.outcome === 'conflict') &&
    candidates.some((row) => row.outcome === 'source-unavailable') &&
    candidates.some((row) => row.outcome === 'degraded') &&
    !receipt.adapterActuallyCalled &&
    !receipt.registryMutationCommitted;

  return {
    nativeContract: 'ZavorthNativeRegistryRefreshReconciliation/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'native-registry-refresh-reconciliation-ready' : 'blocked',
    status: ready ? 'native-registry-refresh-reconciliation-ready' : 'blocked',
    sourceReadiness: {
      partialAdapterDeprecation: options.source.partialAdapterDeprecation.decision,
      authenticatedHealth: options.source.authenticatedHealth.decision,
      optionalCapabilitySnapshot: options.source.optionalCapabilitySnapshot.decision,
      nativeCapabilityRegistry: options.source.nativeCapabilityRegistry.decision,
      nativeDashboardViewModelRegistry: options.source.nativeDashboardViewModelRegistry.decision,
      nativeIntegrationRegistry: options.source.nativeIntegrationRegistry.decision,
      nativeSessionHistoryRegistry: options.source.nativeSessionHistoryRegistry.decision,
      nativeConfigStateRegistry: options.source.nativeConfigStateRegistry.decision,
    },
    refreshPolicies: policies,
    candidates,
    dryRunReceipt: receipt,
    commandCenterDefaultPath: {
      nativeFirstLookupPreserved: true,
      nativeFirstRenderPreserved: true,
      commandCenterNativeFirstEnabled: true,
      commandCenterDefaultAdapterCall: false,
      runtimeExternalExecutorRequiredForCommandCenterRender: false,
      runtimeExternalExecutorRequiredForCommandCenterLookup: false,
    },
    dependencyProtection: {
      externalExecutorOptionalForRefreshOnly: true,
      externalExecutorRequiredForLookupAgain: false,
      externalExecutorRequiredForRenderAgain: false,
      adapterRemovalAllowed: false,
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
    nextGateRecommended: 'future-native-registry-refresh-commit-or-adapter-removal-parity-gate',
  };
}

export function normalizeZavorthNativeRegistryRefreshReconciliationFixture(): ZavorthNativeRegistryRefreshReconciliationNormalization {
  return normalizeZavorthNativeRegistryRefreshReconciliation({
    generatedAt: ZAVORTH_NATIVE_REGISTRY_REFRESH_RECONCILIATION_NOW,
    runtimeId: ZAVORTH_NATIVE_REGISTRY_REFRESH_RECONCILIATION_RUNTIME_ID,
    idPrefix: 'zavorth-native-registry-refresh-reconciliation',
    source: createZavorthNativeRegistryRefreshReconciliationFixtureSource(),
  });
}

export function createZavorthNativeRegistryRefreshReconciliationFixture(): ZavorthNativeRegistryRefreshReconciliation {
  return new ZavorthNativeRegistryRefreshReconciliation(
    normalizeZavorthNativeRegistryRefreshReconciliationFixture(),
  );
}
