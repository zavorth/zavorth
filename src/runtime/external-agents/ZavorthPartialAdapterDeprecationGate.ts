import {
  normalizeZavorthNativeRegistryParityDependencyReductionFixture,
} from './ZavorthNativeRegistryParityDependencyReduction.js';
import type {
  ZavorthNativeRegistryParityDecision,
  ZavorthNativeRegistryParityNormalization,
  ZavorthNativeRegistryParitySurface,
  ZavorthNativeRegistryParitySurfaceClassification,
  ZavorthNativeRegistryParitySurfaceId,
} from './ZavorthNativeRegistryParityDependencyReduction.js';

export const ZAVORTH_PARTIAL_ADAPTER_DEPRECATION_GATE_NOW = '2026-04-29T03:30:00.000Z' as const;
export const ZAVORTH_PARTIAL_ADAPTER_DEPRECATION_GATE_RUNTIME_ID = 'zavorth-partial-adapter-deprecation-gate' as const;

export type ZavorthPartialAdapterDeprecationDecision =
  | 'blocked'
  | 'partial-adapter-deprecation-ready';

export type ZavorthAdapterDeprecationPolicyMode =
  | 'adapter-refresh-allowed'
  | 'adapter-required'
  | 'blocked'
  | 'native-first'
  | 'native-only';

export type ZavorthAdapterDeprecationAdapterRole =
  | 'blocked'
  | 'degraded-fallback'
  | 'not-default-render-lookup-path'
  | 'optional-refresh-source'
  | 'reconciliation-source'
  | 'required-for-gap';

export type ZavorthAdapterDeprecationDefaultPath =
  | 'adapter'
  | 'native-registry'
  | 'none';

export type ZavorthPartialAdapterDeprecationSurfacePolicy = {
  nativeContract: 'ZavorthPartialAdapterDeprecationSurfacePolicy/v1';
  surfaceId: ZavorthNativeRegistryParitySurfaceId;
  label: string;
  parityClassification: ZavorthNativeRegistryParitySurfaceClassification;
  policyMode: ZavorthAdapterDeprecationPolicyMode;
  defaultLookupPath: ZavorthAdapterDeprecationDefaultPath;
  defaultRenderPath: ZavorthAdapterDeprecationDefaultPath;
  nativeRegistryIds: string[];
  adapterRoles: ZavorthAdapterDeprecationAdapterRole[];
  adapterDefaultPathForNativeReadySurfaces: false;
  adapterInvokedForDefaultLookup: false;
  adapterInvokedForDefaultRender: false;
  adapterRefreshAllowed: boolean;
  fallbackBehavior:
    | 'adapter-refresh-only'
    | 'blocked'
    | 'degraded-native-fallback';
  consumerSafe: boolean;
  runtimeExternalExecutorRequiredForNativeReadyLookup: false;
  runtimeExternalExecutorRequiredForNativeReadyRender: false;
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

export type ZavorthPartialAdapterDeprecationConsumerRoute = {
  nativeContract: 'ZavorthPartialAdapterDeprecationConsumerRoute/v1';
  id: string;
  surfaceId: ZavorthNativeRegistryParitySurfaceId;
  consumerKind:
    | 'command-center-render'
    | 'policy-classification'
    | 'runtime-lookup';
  path: 'native-first';
  registryIds: string[];
  adapterInvokedForDefaultPath: false;
  runtimeExternalExecutorRequiredForLookup: false;
  runtimeExternalExecutorRequiredForRender: false;
  publicSourceIdentityExposed: false;
  rawSecretSerialized: false;
};

export type ZavorthPartialAdapterRefreshPolicy = {
  nativeContract: 'ZavorthPartialAdapterRefreshPolicy/v1';
  policyMode: 'adapter-refresh-allowed';
  adapterRoles: [
    'optional-refresh-source',
    'reconciliation-source',
    'degraded-fallback',
    'not-default-render-lookup-path',
  ];
  allowedOnlyFor: [
    'refresh',
    'reconciliation',
    'degraded-fallback',
  ];
  nativeReadyDefaultPath: 'native-registry';
  adapterDefaultPathForNativeReadySurfaces: false;
  adapterRemovalAllowed: false;
  executionAuthority: false;
};

export type ZavorthPartialAdapterNativeOnlyGuard = {
  nativeContract: 'ZavorthPartialAdapterNativeOnlyGuard/v1';
  policyMode: 'native-only';
  appliesTo: [
    'public-dashboard-identity',
    'raw-secret-values',
    'default-native-ready-render-lookup',
  ];
  adapterFallbackAllowedForTheseConcerns: false;
  rawSecretSerialized: false;
  publicSourceIdentityExposed: false;
};

export type ZavorthPartialAdapterDeprecationExecutionGate = {
  nativeFirstLookupEnabled: true;
  nativeFirstRenderEnabled: true;
  runtimeExternalExecutorRequiredForNativeReadyLookup: false;
  runtimeExternalExecutorRequiredForNativeReadyRender: false;
  adapterDefaultPathForNativeReadySurfaces: false;
  adapterRefreshAllowed: true;
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

export type ZavorthPartialAdapterDeprecationSource = {
  parity: ZavorthNativeRegistryParityNormalization;
  adapterCalledDuringDefaultLookup: false;
  adapterCalledDuringDefaultRender: false;
  externalExecutorLiveCalledDuringDefaultPath: false;
  adapterRemovalAttempted: false;
  executionAttempted: false;
  stateMigrationAttempted: false;
  sourceModuleCopyAttempted: false;
  rawSecretSerialized: false;
};

export type ZavorthPartialAdapterDeprecationNormalization = {
  nativeContract: 'ZavorthPartialAdapterDeprecationGate/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthPartialAdapterDeprecationDecision;
  status: 'blocked' | 'partial-adapter-deprecation-ready';
  sourceReadiness: {
    nativeRegistryParity: ZavorthNativeRegistryParityDecision;
    nativeCapabilityRegistry: ZavorthNativeRegistryParityNormalization['sourceReadiness']['nativeCapabilityRegistry'];
    nativeDashboardViewModelRegistry: ZavorthNativeRegistryParityNormalization['sourceReadiness']['nativeDashboardViewModelRegistry'];
    nativeIntegrationRegistry: ZavorthNativeRegistryParityNormalization['sourceReadiness']['nativeIntegrationRegistry'];
    nativeSessionHistoryRegistry: ZavorthNativeRegistryParityNormalization['sourceReadiness']['nativeSessionHistoryRegistry'];
    nativeConfigStateRegistry: ZavorthNativeRegistryParityNormalization['sourceReadiness']['nativeConfigStateRegistry'];
  };
  policies: ZavorthPartialAdapterDeprecationSurfacePolicy[];
  consumerRoutes: ZavorthPartialAdapterDeprecationConsumerRoute[];
  refreshPolicy: ZavorthPartialAdapterRefreshPolicy;
  nativeOnlyGuard: ZavorthPartialAdapterNativeOnlyGuard;
  deprecatedDefaultAdapterSurfaces: ZavorthNativeRegistryParitySurfaceId[];
  adapterRequiredSurfaces: ZavorthNativeRegistryParitySurfaceId[];
  blockedSurfaces: ZavorthNativeRegistryParitySurfaceId[];
  executionGate: ZavorthPartialAdapterDeprecationExecutionGate;
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

export type ZavorthPartialAdapterDeprecationOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  source: ZavorthPartialAdapterDeprecationSource;
};

export type ZavorthPartialAdapterDeprecationPolicyFilter = {
  policyMode?: ZavorthAdapterDeprecationPolicyMode;
  nativeFirst?: boolean;
  adapterRequired?: boolean;
};

function nativeReadyPolicy(surface: ZavorthNativeRegistryParitySurface): ZavorthPartialAdapterDeprecationSurfacePolicy {
  return {
    nativeContract: 'ZavorthPartialAdapterDeprecationSurfacePolicy/v1',
    surfaceId: surface.id,
    label: surface.label,
    parityClassification: surface.classification,
    policyMode: 'native-first',
    defaultLookupPath: 'native-registry',
    defaultRenderPath: 'native-registry',
    nativeRegistryIds: surface.nativeRegistryIds,
    adapterRoles: [
      'optional-refresh-source',
      'reconciliation-source',
      'degraded-fallback',
      'not-default-render-lookup-path',
    ],
    adapterDefaultPathForNativeReadySurfaces: false,
    adapterInvokedForDefaultLookup: false,
    adapterInvokedForDefaultRender: false,
    adapterRefreshAllowed: true,
    fallbackBehavior: 'degraded-native-fallback',
    consumerSafe: true,
    runtimeExternalExecutorRequiredForNativeReadyLookup: false,
    runtimeExternalExecutorRequiredForNativeReadyRender: false,
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

function adapterRequiredPolicy(surface: ZavorthNativeRegistryParitySurface): ZavorthPartialAdapterDeprecationSurfacePolicy {
  return {
    nativeContract: 'ZavorthPartialAdapterDeprecationSurfacePolicy/v1',
    surfaceId: surface.id,
    label: surface.label,
    parityClassification: surface.classification,
    policyMode: 'adapter-required',
    defaultLookupPath: 'none',
    defaultRenderPath: 'none',
    nativeRegistryIds: surface.nativeRegistryIds,
    adapterRoles: ['required-for-gap', 'reconciliation-source'],
    adapterDefaultPathForNativeReadySurfaces: false,
    adapterInvokedForDefaultLookup: false,
    adapterInvokedForDefaultRender: false,
    adapterRefreshAllowed: true,
    fallbackBehavior: 'adapter-refresh-only',
    consumerSafe: true,
    runtimeExternalExecutorRequiredForNativeReadyLookup: false,
    runtimeExternalExecutorRequiredForNativeReadyRender: false,
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

function blockedPolicy(surface: ZavorthNativeRegistryParitySurface): ZavorthPartialAdapterDeprecationSurfacePolicy {
  return {
    nativeContract: 'ZavorthPartialAdapterDeprecationSurfacePolicy/v1',
    surfaceId: surface.id,
    label: surface.label,
    parityClassification: surface.classification,
    policyMode: 'blocked',
    defaultLookupPath: 'none',
    defaultRenderPath: 'none',
    nativeRegistryIds: surface.nativeRegistryIds,
    adapterRoles: ['blocked'],
    adapterDefaultPathForNativeReadySurfaces: false,
    adapterInvokedForDefaultLookup: false,
    adapterInvokedForDefaultRender: false,
    adapterRefreshAllowed: false,
    fallbackBehavior: 'blocked',
    consumerSafe: true,
    runtimeExternalExecutorRequiredForNativeReadyLookup: false,
    runtimeExternalExecutorRequiredForNativeReadyRender: false,
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

function policyForSurface(surface: ZavorthNativeRegistryParitySurface): ZavorthPartialAdapterDeprecationSurfacePolicy {
  if (surface.classification === 'native-ready') {
    return nativeReadyPolicy(surface);
  }

  if (surface.classification === 'adapter-required') {
    return adapterRequiredPolicy(surface);
  }

  return blockedPolicy(surface);
}

function buildPolicies(source: ZavorthPartialAdapterDeprecationSource): ZavorthPartialAdapterDeprecationSurfacePolicy[] {
  return source.parity.surfaces.map(policyForSurface);
}

function buildConsumerRoutes(
  idPrefix: string,
  policies: ZavorthPartialAdapterDeprecationSurfacePolicy[],
): ZavorthPartialAdapterDeprecationConsumerRoute[] {
  const nativeFirstPolicies = policies.filter((policy) => policy.policyMode === 'native-first');

  return nativeFirstPolicies.flatMap((policy) => ([
    {
      nativeContract: 'ZavorthPartialAdapterDeprecationConsumerRoute/v1',
      id: `${idPrefix}:${policy.surfaceId}:runtime-lookup`,
      surfaceId: policy.surfaceId,
      consumerKind: 'runtime-lookup',
      path: 'native-first',
      registryIds: policy.nativeRegistryIds,
      adapterInvokedForDefaultPath: false,
      runtimeExternalExecutorRequiredForLookup: false,
      runtimeExternalExecutorRequiredForRender: false,
      publicSourceIdentityExposed: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthPartialAdapterDeprecationConsumerRoute/v1',
      id: `${idPrefix}:${policy.surfaceId}:command-center-render`,
      surfaceId: policy.surfaceId,
      consumerKind: 'command-center-render',
      path: 'native-first',
      registryIds: policy.nativeRegistryIds,
      adapterInvokedForDefaultPath: false,
      runtimeExternalExecutorRequiredForLookup: false,
      runtimeExternalExecutorRequiredForRender: false,
      publicSourceIdentityExposed: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthPartialAdapterDeprecationConsumerRoute/v1',
      id: `${idPrefix}:${policy.surfaceId}:policy-classification`,
      surfaceId: policy.surfaceId,
      consumerKind: 'policy-classification',
      path: 'native-first',
      registryIds: policy.nativeRegistryIds,
      adapterInvokedForDefaultPath: false,
      runtimeExternalExecutorRequiredForLookup: false,
      runtimeExternalExecutorRequiredForRender: false,
      publicSourceIdentityExposed: false,
      rawSecretSerialized: false,
    },
  ]));
}

function refreshPolicy(): ZavorthPartialAdapterRefreshPolicy {
  return {
    nativeContract: 'ZavorthPartialAdapterRefreshPolicy/v1',
    policyMode: 'adapter-refresh-allowed',
    adapterRoles: [
      'optional-refresh-source',
      'reconciliation-source',
      'degraded-fallback',
      'not-default-render-lookup-path',
    ],
    allowedOnlyFor: [
      'refresh',
      'reconciliation',
      'degraded-fallback',
    ],
    nativeReadyDefaultPath: 'native-registry',
    adapterDefaultPathForNativeReadySurfaces: false,
    adapterRemovalAllowed: false,
    executionAuthority: false,
  };
}

function nativeOnlyGuard(): ZavorthPartialAdapterNativeOnlyGuard {
  return {
    nativeContract: 'ZavorthPartialAdapterNativeOnlyGuard/v1',
    policyMode: 'native-only',
    appliesTo: [
      'public-dashboard-identity',
      'raw-secret-values',
      'default-native-ready-render-lookup',
    ],
    adapterFallbackAllowedForTheseConcerns: false,
    rawSecretSerialized: false,
    publicSourceIdentityExposed: false,
  };
}

function executionGate(): ZavorthPartialAdapterDeprecationExecutionGate {
  return {
    nativeFirstLookupEnabled: true,
    nativeFirstRenderEnabled: true,
    runtimeExternalExecutorRequiredForNativeReadyLookup: false,
    runtimeExternalExecutorRequiredForNativeReadyRender: false,
    adapterDefaultPathForNativeReadySurfaces: false,
    adapterRefreshAllowed: true,
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

function sourceReady(source: ZavorthPartialAdapterDeprecationSource): boolean {
  return (
    source.parity.decision === 'native-registry-parity-ready' &&
    !source.adapterCalledDuringDefaultLookup &&
    !source.adapterCalledDuringDefaultRender &&
    !source.externalExecutorLiveCalledDuringDefaultPath &&
    !source.adapterRemovalAttempted &&
    !source.executionAttempted &&
    !source.stateMigrationAttempted &&
    !source.sourceModuleCopyAttempted &&
    !source.rawSecretSerialized
  );
}

function matchesPolicyFilter(
  policy: ZavorthPartialAdapterDeprecationSurfacePolicy,
  filter: ZavorthPartialAdapterDeprecationPolicyFilter,
): boolean {
  if (filter.policyMode && policy.policyMode !== filter.policyMode) {
    return false;
  }
  if (filter.nativeFirst !== undefined && (policy.policyMode === 'native-first') !== filter.nativeFirst) {
    return false;
  }
  if (filter.adapterRequired !== undefined && (policy.policyMode === 'adapter-required') !== filter.adapterRequired) {
    return false;
  }
  return true;
}

export class ZavorthPartialAdapterDeprecationPolicy {
  private readonly policiesBySurfaceId: Map<ZavorthNativeRegistryParitySurfaceId, ZavorthPartialAdapterDeprecationSurfacePolicy>;

  public constructor(public readonly normalization: ZavorthPartialAdapterDeprecationNormalization) {
    this.policiesBySurfaceId = new Map(normalization.policies.map((policy) => [policy.surfaceId, policy]));
  }

  public listPolicies(filter: ZavorthPartialAdapterDeprecationPolicyFilter = {}): ZavorthPartialAdapterDeprecationSurfacePolicy[] {
    return this.normalization.policies.filter((policy) => matchesPolicyFilter(policy, filter));
  }

  public lookupPolicy(surfaceId: ZavorthNativeRegistryParitySurfaceId): ZavorthPartialAdapterDeprecationSurfacePolicy | undefined {
    return this.policiesBySurfaceId.get(surfaceId);
  }

  public nativeFirstPolicies(): ZavorthPartialAdapterDeprecationSurfacePolicy[] {
    return this.listPolicies({ nativeFirst: true });
  }

  public consumerRoutes(): ZavorthPartialAdapterDeprecationConsumerRoute[] {
    return this.normalization.consumerRoutes;
  }
}

export function createZavorthPartialAdapterDeprecationFixtureSource(): ZavorthPartialAdapterDeprecationSource {
  return {
    parity: normalizeZavorthNativeRegistryParityDependencyReductionFixture(),
    adapterCalledDuringDefaultLookup: false,
    adapterCalledDuringDefaultRender: false,
    externalExecutorLiveCalledDuringDefaultPath: false,
    adapterRemovalAttempted: false,
    executionAttempted: false,
    stateMigrationAttempted: false,
    sourceModuleCopyAttempted: false,
    rawSecretSerialized: false,
  };
}

export function normalizeZavorthPartialAdapterDeprecationGate<TRuntimeId extends string>(
  options: ZavorthPartialAdapterDeprecationOptions<TRuntimeId>,
): ZavorthPartialAdapterDeprecationNormalization {
  const policies = buildPolicies(options.source);
  const consumerRoutes = buildConsumerRoutes(options.idPrefix, policies);
  const nativeFirstPolicies = policies.filter((policy) => policy.policyMode === 'native-first');
  const adapterRequiredPolicies = policies.filter((policy) => policy.policyMode === 'adapter-required');
  const blockedPolicies = policies.filter((policy) => policy.policyMode === 'blocked');
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    nativeFirstPolicies.length === 5 &&
    consumerRoutes.length === nativeFirstPolicies.length * 3 &&
    adapterRequiredPolicies.some((policy) => policy.surfaceId === 'live-refresh-reconciliation') &&
    blockedPolicies.some((policy) => policy.surfaceId === 'action-dispatch-execution') &&
    blockedPolicies.some((policy) => policy.surfaceId === 'state-migration-import');

  return {
    nativeContract: 'ZavorthPartialAdapterDeprecationGate/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'partial-adapter-deprecation-ready' : 'blocked',
    status: ready ? 'partial-adapter-deprecation-ready' : 'blocked',
    sourceReadiness: {
      nativeRegistryParity: options.source.parity.decision,
      nativeCapabilityRegistry: options.source.parity.sourceReadiness.nativeCapabilityRegistry,
      nativeDashboardViewModelRegistry: options.source.parity.sourceReadiness.nativeDashboardViewModelRegistry,
      nativeIntegrationRegistry: options.source.parity.sourceReadiness.nativeIntegrationRegistry,
      nativeSessionHistoryRegistry: options.source.parity.sourceReadiness.nativeSessionHistoryRegistry,
      nativeConfigStateRegistry: options.source.parity.sourceReadiness.nativeConfigStateRegistry,
    },
    policies,
    consumerRoutes,
    refreshPolicy: refreshPolicy(),
    nativeOnlyGuard: nativeOnlyGuard(),
    deprecatedDefaultAdapterSurfaces: nativeFirstPolicies.map((policy) => policy.surfaceId),
    adapterRequiredSurfaces: adapterRequiredPolicies.map((policy) => policy.surfaceId),
    blockedSurfaces: blockedPolicies.map((policy) => policy.surfaceId),
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

export function normalizeZavorthPartialAdapterDeprecationGateFixture(): ZavorthPartialAdapterDeprecationNormalization {
  return normalizeZavorthPartialAdapterDeprecationGate({
    generatedAt: ZAVORTH_PARTIAL_ADAPTER_DEPRECATION_GATE_NOW,
    runtimeId: ZAVORTH_PARTIAL_ADAPTER_DEPRECATION_GATE_RUNTIME_ID,
    idPrefix: 'zavorth-partial-adapter-deprecation',
    source: createZavorthPartialAdapterDeprecationFixtureSource(),
  });
}

export function createZavorthPartialAdapterDeprecationPolicyFixture(): ZavorthPartialAdapterDeprecationPolicy {
  return new ZavorthPartialAdapterDeprecationPolicy(
    normalizeZavorthPartialAdapterDeprecationGateFixture(),
  );
}
