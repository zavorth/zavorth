import {
  normalizeZavorthNativeAbsorptionConsolidationPackFixture,
} from './ZavorthNativeAbsorptionConsolidationPack.js';
import {
  normalizeZavorthPartialAdapterDeprecationGateFixture,
} from './ZavorthPartialAdapterDeprecationGate.js';
import type {
  ZavorthNativeAbsorptionConsolidationNormalization,
} from './ZavorthNativeAbsorptionConsolidationPack.js';
import type {
  ZavorthNativeRefreshCommitReceipt,
} from './ZavorthNativeRefreshCommitPack.js';
import type {
  ZavorthNativeRegistryParitySurfaceId,
} from './ZavorthNativeRegistryParityDependencyReduction.js';
import type {
  ZavorthPartialAdapterDeprecationNormalization,
  ZavorthPartialAdapterDeprecationSurfacePolicy,
} from './ZavorthPartialAdapterDeprecationGate.js';

export const ZAVORTH_PARTIAL_ADAPTER_REMOVAL_IMPLEMENTATION_PACK_NOW = '2026-04-29T10:00:00.000Z' as const;
export const ZAVORTH_PARTIAL_ADAPTER_REMOVAL_IMPLEMENTATION_PACK_RUNTIME_ID = 'zavorth-partial-adapter-removal-implementation-pack' as const;

export type ZavorthPartialAdapterRemovalDecision =
  | 'blocked'
  | 'partial-adapter-removal-implemented';

export type ZavorthPartialAdapterRemovalAdapterRole =
  | 'degraded-fallback-explicit'
  | 'not-default-provider'
  | 'reconciliation-source'
  | 'refresh-source';

export type ZavorthPartialAdapterRemovalDefaultPath =
  | 'blocked'
  | 'native-registry'
  | 'none';

export type ZavorthPartialAdapterRemovalSurfaceEnforcement = {
  nativeContract: 'ZavorthPartialAdapterRemovalSurfaceEnforcement/v1';
  surfaceId: ZavorthNativeRegistryParitySurfaceId;
  label: string;
  defaultLookupPath: ZavorthPartialAdapterRemovalDefaultPath;
  defaultRenderPath: ZavorthPartialAdapterRemovalDefaultPath;
  adapterBypassedForDefaultLookup: boolean;
  adapterBypassedForDefaultRender: boolean;
  adapterDefaultPathForNativeReadySurfaces: false;
  commandCenterDefaultAdapterCall: false;
  nativeRegistryLookupDefault: boolean;
  fallbackRequiresExplicitMode: boolean;
  runtimeExternalExecutorRequiredForNativeReadyLookup: false;
  runtimeExternalExecutorRequiredForCommandCenterRender: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  rawSecretSerialized: false;
};

export type ZavorthPartialAdapterRemovalConsumerCleanup = {
  nativeContract: 'ZavorthPartialAdapterRemovalConsumerCleanup/v1';
  consumerId: string;
  consumerPath: string;
  consumerKind:
    | 'command-center-default-projection'
    | 'native-registry-lookup'
    | 'production-loaded-restore'
    | 'refresh-reconciliation';
  nativeReadyConsumer: boolean;
  defaultAdapterImportRemovedOrIsolated: boolean;
  fallbackAdapterExplicitOnly: boolean;
  externalExecutorAdapterImportInDefaultPath: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
};

export type ZavorthPartialAdapterRemovalStaticGuardFile = {
  path: string;
  content: string;
  defaultConsumer: boolean;
};

export type ZavorthPartialAdapterRemovalStaticGuardFinding = {
  nativeContract: 'ZavorthPartialAdapterRemovalStaticGuardFinding/v1';
  path: string;
  pattern: string;
  reason: string;
  defaultPathRegression: true;
};

export type ZavorthPartialAdapterRemovalStaticGuard = {
  nativeContract: 'ZavorthPartialAdapterRemovalStaticGuard/v1';
  checkedPaths: string[];
  findings: ZavorthPartialAdapterRemovalStaticGuardFinding[];
  passed: boolean;
  staticGuardCatchesDefaultAdapterRegression: true;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
};

export type ZavorthPartialAdapterRemovalAdapterRoleNarrowing = {
  nativeContract: 'ZavorthPartialAdapterRemovalAdapterRoleNarrowing/v1';
  allowedRoles: [
    'refresh-source',
    'reconciliation-source',
    'degraded-fallback-explicit',
  ];
  prohibitedRoles: [
    'default-lookup-provider',
    'default-render-provider',
    'source-authority',
    'execution-provider',
  ];
  adapterRefreshAllowed: true;
  adapterRemovalGlobalAllowed: false;
  adapterDefaultPathForNativeReadySurfaces: false;
  rawSecretSerialized: false;
};

export type ZavorthPartialAdapterRemovalImplementationExecutionGate = {
  partialAdapterRemovalImplemented: true;
  adapterDefaultPathForNativeReadySurfaces: false;
  commandCenterDefaultAdapterCall: false;
  nativeRegistryLookupDefault: true;
  runtimeExternalExecutorRequiredForNativeReadyLookup: false;
  runtimeExternalExecutorRequiredForCommandCenterRender: false;
  adapterRefreshAllowed: true;
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

export type ZavorthPartialAdapterRemovalImplementationSource = {
  partialAdapterDeprecation: ZavorthPartialAdapterDeprecationNormalization;
  consolidation: ZavorthNativeAbsorptionConsolidationNormalization;
  refreshCommitReceipt?: ZavorthNativeRefreshCommitReceipt;
  staticGuardFiles: ZavorthPartialAdapterRemovalStaticGuardFile[];
  adapterCalledForDefaultLookup: false;
  adapterCalledForDefaultRender: false;
  externalExecutorLiveCalledForDefaultPath: false;
  executionAttempted: false;
  externalMutationAttempted: false;
  stateMigrationAttempted: false;
  sourceModuleCopyAttempted: false;
  rawSecretSerialized: false;
};

export type ZavorthPartialAdapterRemovalImplementationNormalization = {
  nativeContract: 'ZavorthPartialAdapterRemovalImplementationPack/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthPartialAdapterRemovalDecision;
  status: 'blocked' | 'partial-adapter-removal-implemented';
  sourceReadiness: {
    partialAdapterDeprecation: ZavorthPartialAdapterDeprecationNormalization['decision'];
    consolidation: ZavorthNativeAbsorptionConsolidationNormalization['decision'];
    refreshCommit?: ZavorthNativeRefreshCommitReceipt['decision'];
  };
  enforcedSurfaces: ZavorthPartialAdapterRemovalSurfaceEnforcement[];
  consumerCleanup: ZavorthPartialAdapterRemovalConsumerCleanup[];
  staticGuard: ZavorthPartialAdapterRemovalStaticGuard;
  adapterRoleNarrowing: ZavorthPartialAdapterRemovalAdapterRoleNarrowing;
  executionGate: ZavorthPartialAdapterRemovalImplementationExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    sourceIdentityPublic: false;
    sourceStructuresPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-global-adapter-removal-readiness-or-refresh-fallback-hardening-pack';
};

export type ZavorthPartialAdapterRemovalImplementationOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  runtimeId: TRuntimeId;
  source: ZavorthPartialAdapterRemovalImplementationSource;
};

const NATIVE_READY_SURFACE_IDS: ZavorthNativeRegistryParitySurfaceId[] = [
  'capability-lookup-classify',
  'dashboard-render-view-lookup',
  'provider-channel-transport-metadata-lookup',
  'session-history-metadata-lookup',
  'config-secretref-state-metadata-lookup',
];

const FORBIDDEN_DEFAULT_PATTERNS: Array<{ pattern: RegExp; label: string; reason: string }> = [
  {
    pattern: /from\s+['"].*ExternalAgentExternalExecutor/i,
    label: 'ExternalAgentExternalExecutor default import',
    reason: 'default consumers must not import ExternalExecutor live/probe modules',
  },
  {
    pattern: /from\s+['"].*FixtureExternalAgentAdapter/i,
    label: 'FixtureExternalAgentAdapter default import',
    reason: 'default consumers must not import external adapter fixtures',
  },
  {
    pattern: /from\s+['"].*ExternalAgentSidecarAdapter/i,
    label: 'ExternalAgentSidecarAdapter default import',
    reason: 'default consumers must not import sidecar adapter paths',
  },
  {
    pattern: /adapterCalledForDefault(?:Lookup|Render)\s*:\s*true/,
    label: 'default adapter call true',
    reason: 'default lookup/render may not call the adapter',
  },
  {
    pattern: /externalExecutorLiveCalledForDefaultPath\s*:\s*true/i,
    label: 'ExternalExecutor live default path true',
    reason: 'default path may not call ExternalExecutor live',
  },
  {
    pattern: /label\s*:\s*['"][^'"]*ExternalExecutor[^'"]*['"]/i,
    label: 'public ExternalExecutor label',
    reason: 'public default consumers must not expose ExternalExecutor identity',
  },
  {
    pattern: /source\s*:\s*['"][^'"]*external-executor[^'"]*['"]/i,
    label: 'public external-executor source',
    reason: 'public default consumers must not expose ExternalExecutor source identity',
  },
];

function enforcementFromPolicy(
  policy: ZavorthPartialAdapterDeprecationSurfacePolicy,
): ZavorthPartialAdapterRemovalSurfaceEnforcement {
  const nativeReady = policy.policyMode === 'native-first';
  return {
    nativeContract: 'ZavorthPartialAdapterRemovalSurfaceEnforcement/v1',
    surfaceId: policy.surfaceId,
    label: policy.label,
    defaultLookupPath: nativeReady ? 'native-registry' : policy.policyMode === 'blocked' ? 'blocked' : 'none',
    defaultRenderPath: nativeReady ? 'native-registry' : policy.policyMode === 'blocked' ? 'blocked' : 'none',
    adapterBypassedForDefaultLookup: nativeReady,
    adapterBypassedForDefaultRender: nativeReady,
    adapterDefaultPathForNativeReadySurfaces: false,
    commandCenterDefaultAdapterCall: false,
    nativeRegistryLookupDefault: nativeReady,
    fallbackRequiresExplicitMode: true,
    runtimeExternalExecutorRequiredForNativeReadyLookup: false,
    runtimeExternalExecutorRequiredForCommandCenterRender: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    rawSecretSerialized: false,
  };
}

function consumerCleanup(): ZavorthPartialAdapterRemovalConsumerCleanup[] {
  return [
    {
      nativeContract: 'ZavorthPartialAdapterRemovalConsumerCleanup/v1',
      consumerId: 'command-center-runtime-projection',
      consumerPath: 'src/ai-gateway/app/(dashboard)/control/command-center/projections/commandCenterRuntimeProjection.ts',
      consumerKind: 'command-center-default-projection',
      nativeReadyConsumer: true,
      defaultAdapterImportRemovedOrIsolated: true,
      fallbackAdapterExplicitOnly: true,
      externalExecutorAdapterImportInDefaultPath: false,
      publicExternalExecutorIdentityExposed: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthPartialAdapterRemovalConsumerCleanup/v1',
      consumerId: 'native-registry-lookup',
      consumerPath: 'src/runtime/external-agents/ZavorthNativeAbsorptionConsolidationPack.ts',
      consumerKind: 'native-registry-lookup',
      nativeReadyConsumer: true,
      defaultAdapterImportRemovedOrIsolated: true,
      fallbackAdapterExplicitOnly: true,
      externalExecutorAdapterImportInDefaultPath: false,
      publicExternalExecutorIdentityExposed: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthPartialAdapterRemovalConsumerCleanup/v1',
      consumerId: 'production-loaded-command-center',
      consumerPath: 'src/runtime/external-agents/ZavorthNativeRegistryProductionRestoreLoadCommandCenter.ts',
      consumerKind: 'production-loaded-restore',
      nativeReadyConsumer: true,
      defaultAdapterImportRemovedOrIsolated: true,
      fallbackAdapterExplicitOnly: true,
      externalExecutorAdapterImportInDefaultPath: false,
      publicExternalExecutorIdentityExposed: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthPartialAdapterRemovalConsumerCleanup/v1',
      consumerId: 'refresh-reconciliation',
      consumerPath: 'src/runtime/external-agents/ZavorthNativeRegistryRefreshReconciliation.ts',
      consumerKind: 'refresh-reconciliation',
      nativeReadyConsumer: false,
      defaultAdapterImportRemovedOrIsolated: true,
      fallbackAdapterExplicitOnly: true,
      externalExecutorAdapterImportInDefaultPath: false,
      publicExternalExecutorIdentityExposed: false,
      rawSecretSerialized: false,
    },
  ];
}

export function evaluateZavorthPartialAdapterRemovalStaticGuard(
  files: ZavorthPartialAdapterRemovalStaticGuardFile[],
): ZavorthPartialAdapterRemovalStaticGuard {
  const findings = files.flatMap((file): ZavorthPartialAdapterRemovalStaticGuardFinding[] => {
    if (!file.defaultConsumer) {
      return [];
    }

    return FORBIDDEN_DEFAULT_PATTERNS
      .filter(({ pattern }) => pattern.test(file.content))
      .map(({ label, reason }) => ({
        nativeContract: 'ZavorthPartialAdapterRemovalStaticGuardFinding/v1',
        path: file.path,
        pattern: label,
        reason,
        defaultPathRegression: true,
      }));
  });

  return {
    nativeContract: 'ZavorthPartialAdapterRemovalStaticGuard/v1',
    checkedPaths: files.map((file) => file.path),
    findings,
    passed: findings.length === 0,
    staticGuardCatchesDefaultAdapterRegression: true,
    publicExternalExecutorIdentityExposed: false,
    rawSecretSerialized: false,
  };
}

function adapterRoleNarrowing(): ZavorthPartialAdapterRemovalAdapterRoleNarrowing {
  return {
    nativeContract: 'ZavorthPartialAdapterRemovalAdapterRoleNarrowing/v1',
    allowedRoles: [
      'refresh-source',
      'reconciliation-source',
      'degraded-fallback-explicit',
    ],
    prohibitedRoles: [
      'default-lookup-provider',
      'default-render-provider',
      'source-authority',
      'execution-provider',
    ],
    adapterRefreshAllowed: true,
    adapterRemovalGlobalAllowed: false,
    adapterDefaultPathForNativeReadySurfaces: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthPartialAdapterRemovalImplementationExecutionGate {
  return {
    partialAdapterRemovalImplemented: true,
    adapterDefaultPathForNativeReadySurfaces: false,
    commandCenterDefaultAdapterCall: false,
    nativeRegistryLookupDefault: true,
    runtimeExternalExecutorRequiredForNativeReadyLookup: false,
    runtimeExternalExecutorRequiredForCommandCenterRender: false,
    adapterRefreshAllowed: true,
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

function sourceReady(source: ZavorthPartialAdapterRemovalImplementationSource): boolean {
  return (
    source.partialAdapterDeprecation.decision === 'partial-adapter-deprecation-ready' &&
    source.consolidation.decision === 'native-absorption-consolidation-ready' &&
    !source.adapterCalledForDefaultLookup &&
    !source.adapterCalledForDefaultRender &&
    !source.externalExecutorLiveCalledForDefaultPath &&
    !source.executionAttempted &&
    !source.externalMutationAttempted &&
    !source.stateMigrationAttempted &&
    !source.sourceModuleCopyAttempted &&
    !source.rawSecretSerialized
  );
}

export class ZavorthPartialAdapterRemovalImplementationPack {
  private readonly enforcementBySurfaceId: Map<ZavorthNativeRegistryParitySurfaceId, ZavorthPartialAdapterRemovalSurfaceEnforcement>;

  public constructor(public readonly normalization: ZavorthPartialAdapterRemovalImplementationNormalization) {
    this.enforcementBySurfaceId = new Map(normalization.enforcedSurfaces.map((surface) => [surface.surfaceId, surface]));
  }

  public nativeReadyEnforcement(): ZavorthPartialAdapterRemovalSurfaceEnforcement[] {
    return this.normalization.enforcedSurfaces.filter((surface) => surface.nativeRegistryLookupDefault);
  }

  public lookupEnforcement(surfaceId: ZavorthNativeRegistryParitySurfaceId): ZavorthPartialAdapterRemovalSurfaceEnforcement | undefined {
    return this.enforcementBySurfaceId.get(surfaceId);
  }

  public adapterRoles(): ZavorthPartialAdapterRemovalAdapterRole[] {
    return this.normalization.adapterRoleNarrowing.allowedRoles;
  }
}

export function createZavorthPartialAdapterRemovalImplementationFixtureSource(
  staticGuardFiles: ZavorthPartialAdapterRemovalStaticGuardFile[] = [],
): ZavorthPartialAdapterRemovalImplementationSource {
  return {
    partialAdapterDeprecation: normalizeZavorthPartialAdapterDeprecationGateFixture(),
    consolidation: normalizeZavorthNativeAbsorptionConsolidationPackFixture(),
    staticGuardFiles,
    adapterCalledForDefaultLookup: false,
    adapterCalledForDefaultRender: false,
    externalExecutorLiveCalledForDefaultPath: false,
    executionAttempted: false,
    externalMutationAttempted: false,
    stateMigrationAttempted: false,
    sourceModuleCopyAttempted: false,
    rawSecretSerialized: false,
  };
}

export function normalizeZavorthPartialAdapterRemovalImplementationPack<TRuntimeId extends string>(
  options: ZavorthPartialAdapterRemovalImplementationOptions<TRuntimeId>,
): ZavorthPartialAdapterRemovalImplementationNormalization {
  const nativePolicies = options.source.partialAdapterDeprecation.policies
    .filter((policy) => NATIVE_READY_SURFACE_IDS.includes(policy.surfaceId));
  const enforcedSurfaces = nativePolicies.map(enforcementFromPolicy);
  const staticGuard = evaluateZavorthPartialAdapterRemovalStaticGuard(options.source.staticGuardFiles);
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    enforcedSurfaces.length === NATIVE_READY_SURFACE_IDS.length &&
    enforcedSurfaces.every((surface) => (
      surface.defaultLookupPath === 'native-registry' &&
      surface.defaultRenderPath === 'native-registry' &&
      surface.adapterBypassedForDefaultLookup &&
      surface.adapterBypassedForDefaultRender &&
      !surface.adapterDefaultPathForNativeReadySurfaces
    )) &&
    staticGuard.passed;

  return {
    nativeContract: 'ZavorthPartialAdapterRemovalImplementationPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'partial-adapter-removal-implemented' : 'blocked',
    status: ready ? 'partial-adapter-removal-implemented' : 'blocked',
    sourceReadiness: {
      partialAdapterDeprecation: options.source.partialAdapterDeprecation.decision,
      consolidation: options.source.consolidation.decision,
      ...(options.source.refreshCommitReceipt ? { refreshCommit: options.source.refreshCommitReceipt.decision } : {}),
    },
    enforcedSurfaces,
    consumerCleanup: consumerCleanup(),
    staticGuard,
    adapterRoleNarrowing: adapterRoleNarrowing(),
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-global-adapter-removal-readiness-or-refresh-fallback-hardening-pack',
  };
}

export function normalizeZavorthPartialAdapterRemovalImplementationPackFixture(
  staticGuardFiles: ZavorthPartialAdapterRemovalStaticGuardFile[] = [],
): ZavorthPartialAdapterRemovalImplementationNormalization {
  return normalizeZavorthPartialAdapterRemovalImplementationPack({
    generatedAt: ZAVORTH_PARTIAL_ADAPTER_REMOVAL_IMPLEMENTATION_PACK_NOW,
    runtimeId: ZAVORTH_PARTIAL_ADAPTER_REMOVAL_IMPLEMENTATION_PACK_RUNTIME_ID,
    source: createZavorthPartialAdapterRemovalImplementationFixtureSource(staticGuardFiles),
  });
}

export function createZavorthPartialAdapterRemovalImplementationPackFixture(
  staticGuardFiles: ZavorthPartialAdapterRemovalStaticGuardFile[] = [],
): ZavorthPartialAdapterRemovalImplementationPack {
  return new ZavorthPartialAdapterRemovalImplementationPack(
    normalizeZavorthPartialAdapterRemovalImplementationPackFixture(staticGuardFiles),
  );
}
