import {
  createZavorthNativeCapabilityRegistryFixture,
} from './ZavorthNativeCapabilityRegistry.js';
import {
  normalizeZavorthNativeAbsorptionPublicSurfaceHardeningPackFixture,
} from './ZavorthNativeAbsorptionPublicSurfaceHardeningPack.js';
import {
  createZavorthNativeConfigStateRegistryFixture,
} from './ZavorthNativeConfigStateRegistry.js';
import {
  createZavorthNativeIntegrationRegistryFixture,
} from './ZavorthNativeIntegrationRegistry.js';
import {
  createZavorthNativeSessionHistoryRegistryFixture,
} from './ZavorthNativeSessionHistoryRegistry.js';
import type {
  ZavorthNativeAbsorptionPublicSurface,
  ZavorthNativeAbsorptionPublicSurfaceHardeningNormalization,
} from './ZavorthNativeAbsorptionPublicSurfaceHardeningPack.js';
import type {
  ZavorthNativeCapabilityRegistry,
  ZavorthNativeCapabilityRegistryClassification,
} from './ZavorthNativeCapabilityRegistry.js';
import type {
  ZavorthNativeConfigStateRegistry,
} from './ZavorthNativeConfigStateRegistry.js';
import type {
  ZavorthNativeIntegrationRegistry,
} from './ZavorthNativeIntegrationRegistry.js';
import type {
  ZavorthNativeSessionHistoryRegistry,
} from './ZavorthNativeSessionHistoryRegistry.js';

export const ZAVORTH_NATIVE_REGISTRY_CONSUMER_EXPANSION_PACK_NOW = '2026-04-29T12:00:00.000Z' as const;
export const ZAVORTH_NATIVE_REGISTRY_CONSUMER_EXPANSION_PACK_RUNTIME_ID = 'zavorth-native-registry-consumer-expansion-pack' as const;

export type ZavorthNativeRegistryConsumerExpansionDecision =
  | 'blocked'
  | 'native-registry-consumer-expansion-ready';

export type ZavorthNativeRegistryExpandedConsumerKind =
  | 'action-planner-policy-preflight'
  | 'command-http-policy-preflight'
  | 'command-http-observability-projection'
  | 'gateway-surface-conformance'
  | 'runtime-readiness-projection';

export type ZavorthNativeRegistryKind =
  | 'capability-registry'
  | 'config-state-registry'
  | 'integration-registry'
  | 'session-history-registry';

export type ZavorthNativeRegistryExpandedConsumerStatus =
  | 'candidate'
  | 'integrated-native-first';

export type ZavorthNativeRegistryExpandedConsumerIntegration = {
  nativeContract: 'ZavorthNativeRegistryExpandedConsumerIntegration/v1';
  consumerId: string;
  label: string;
  consumerKind: ZavorthNativeRegistryExpandedConsumerKind;
  consumerPath: string;
  status: ZavorthNativeRegistryExpandedConsumerStatus;
  integrated: boolean;
  nativeRegistryDefault: boolean;
  consumedRegistryKinds: ZavorthNativeRegistryKind[];
  nativeRegistryRecordsConsumed: number;
  registryClassificationsConsumed: ZavorthNativeCapabilityRegistryClassification[];
  policyPlannerClassifiesCapabilitiesUsingRegistry: boolean;
  observabilityConsumesNativeMetadata: boolean;
  readinessConsumesNativeMetadata: boolean;
  adapterCalledForDefaultLookup: false;
  adapterDefaultPathForExpandedConsumers: false;
  fallbackAdapterExplicitOnly: boolean;
  runtimeExternalExecutorRequiredForExpandedConsumerLookup: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  externalMutationActuallyPerformed: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryConsumerInventoryRow = {
  nativeContract: 'ZavorthNativeRegistryConsumerInventoryRow/v1';
  consumerId: string;
  label: string;
  consumerPath: string;
  lookupClassifications:
    | 'capabilities'
    | 'config-secretref-state'
    | 'integrations-providers-channels-transports'
    | 'session-history-metadata';
  safeForNativeFirst: boolean;
  selectedFor205: boolean;
  adapterDefaultPathAllowed: false;
  publicSourceIdentityAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryConsumerStaticGuardFile = {
  path: string;
  content: string;
  defaultConsumer: boolean;
};

export type ZavorthNativeRegistryConsumerStaticGuardFinding = {
  nativeContract: 'ZavorthNativeRegistryConsumerStaticGuardFinding/v1';
  path: string;
  pattern: string;
  reason: string;
  defaultPathRegression: true;
};

export type ZavorthNativeRegistryConsumerStaticGuard = {
  nativeContract: 'ZavorthNativeRegistryConsumerStaticGuard/v1';
  checkedPaths: string[];
  findings: ZavorthNativeRegistryConsumerStaticGuardFinding[];
  passed: boolean;
  staticGuardCatchesDefaultAdapterRegression: true;
  adapterDefaultPathForExpandedConsumers: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryConsumerExpansionExecutionGate = {
  nativeRegistryConsumerExpansionPackCreated: true;
  additionalNativeFirstConsumersIntegrated: true;
  minimumAdditionalConsumers: 2;
  adapterDefaultPathForExpandedConsumers: false;
  runtimeExternalExecutorRequiredForExpandedConsumerLookup: false;
  adapterRefreshAllowed: true;
  adapterRemovalGlobalAllowed: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  externalMutationActuallyPerformed: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryConsumerExpansionSource = {
  publicSurfaceHardening: ZavorthNativeAbsorptionPublicSurfaceHardeningNormalization;
  capabilityRegistry: ZavorthNativeCapabilityRegistry;
  integrationRegistry: ZavorthNativeIntegrationRegistry;
  sessionHistoryRegistry: ZavorthNativeSessionHistoryRegistry;
  configStateRegistry: ZavorthNativeConfigStateRegistry;
  staticGuardFiles: ZavorthNativeRegistryConsumerStaticGuardFile[];
  adapterCalledForDefaultLookup: false;
  externalExecutorLiveCalledForDefaultPath: false;
  executionAttempted: false;
  externalMutationAttempted: false;
  stateMigrationAttempted: false;
  sourceModuleCopyAttempted: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryConsumerExpansionNormalization = {
  nativeContract: 'ZavorthNativeRegistryConsumerExpansionPack/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthNativeRegistryConsumerExpansionDecision;
  status: 'blocked' | 'native-registry-consumer-expansion-ready';
  sourceReadiness: {
    publicSurfaceHardening: ZavorthNativeAbsorptionPublicSurfaceHardeningNormalization['decision'];
    nativeCapabilityRegistryReady: true;
    nativeIntegrationRegistryReady: true;
    nativeSessionHistoryRegistryReady: true;
    nativeConfigStateRegistryReady: true;
  };
  consumerInventory: ZavorthNativeRegistryConsumerInventoryRow[];
  integratedConsumers: ZavorthNativeRegistryExpandedConsumerIntegration[];
  staticGuard: ZavorthNativeRegistryConsumerStaticGuard;
  adapterPolicy: {
    nativeContract: 'ZavorthNativeRegistryConsumerAdapterPolicy/v1';
    adapterRefreshAllowed: true;
    adapterReconciliationAllowed: true;
    adapterFallbackRequiresExplicitMode: true;
    adapterDefaultPathForExpandedConsumers: false;
    adapterRemovalGlobalAllowed: false;
  };
  executionGate: ZavorthNativeRegistryConsumerExpansionExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    publicSourceIdentityExposed: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-native-registry-consumer-expansion-or-global-adapter-removal-readiness';
};

export type ZavorthNativeRegistryConsumerExpansionOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  runtimeId: TRuntimeId;
  source: ZavorthNativeRegistryConsumerExpansionSource;
};

const FORBIDDEN_DEFAULT_PATTERNS: Array<{ pattern: RegExp; label: string; reason: string }> = [
  {
    pattern: /from\s+['"].*ExternalAgentExternalExecutor/i,
    label: 'ExternalAgentExternalExecutor default import',
    reason: 'expanded native-first consumers must not import live source runtime modules by default',
  },
  {
    pattern: /from\s+['"].*FixtureExternalAgentAdapter/i,
    label: 'FixtureExternalAgentAdapter default import',
    reason: 'expanded native-first consumers must not import adapter fixtures by default',
  },
  {
    pattern: /from\s+['"].*ExternalAgentSidecarAdapter/i,
    label: 'ExternalAgentSidecarAdapter default import',
    reason: 'expanded native-first consumers must not import sidecar adapter paths by default',
  },
  {
    pattern: /adapterCalledForDefault(?:Lookup|Render)\s*:\s*true/,
    label: 'default adapter call true',
    reason: 'default lookup/render may not call the adapter',
  },
  {
    pattern: /(?:externalExecutorLiveCalledForDefaultPath|externalSourceLiveCalledForDefaultPath)\s*:\s*true/i,
    label: 'live source runtime default path true',
    reason: 'default consumers may not call the external runtime live path',
  },
  {
    pattern: /label\s*:\s*['"][^'"]*ExternalExecutor[^'"]*['"]/i,
    label: 'public ExternalExecutor label',
    reason: 'expanded consumers must expose Zavorth-native labels on default surfaces',
  },
  {
    pattern: /source\s*:\s*['"][^'"]*external-executor[^'"]*['"]/i,
    label: 'public external-executor source',
    reason: 'expanded consumers must not expose source runtime identity as public source',
  },
];

function minimalPublicSurfaceHardeningSurfaces(): ZavorthNativeAbsorptionPublicSurface[] {
  return [
    publicSurface('capability-labels', 'Capability labels', 'capability-label', 'Zavorth capabilities'),
    publicSurface('command-center-dashboard', 'Command Center dashboard', 'command-center-dashboard', 'Zavorth Command Center'),
    publicSurface('provider-channel-transport-labels', 'Integration labels', 'provider-channel-transport-label', 'Zavorth integrations'),
    publicSurface('public-api-exports', 'Public API exports', 'public-api-export', 'Zavorth native registry exports'),
    publicSurface('runtime-projection', 'Runtime projection', 'runtime-projection', 'Zavorth runtime projection'),
    publicSurface('user-facing-receipts', 'User-facing receipts', 'user-facing-receipt-log', 'Zavorth native registry receipt'),
    publicSurface('view-model-labels', 'View model labels', 'view-model-label', 'Zavorth native view models'),
  ];
}

function publicSurface(
  id: string,
  label: string,
  kind: ZavorthNativeAbsorptionPublicSurface['kind'],
  content: string,
): ZavorthNativeAbsorptionPublicSurface {
  return {
    nativeContract: 'ZavorthNativeAbsorptionPublicSurface/v1',
    id,
    label,
    path: `fixture:${id}`,
    kind,
    content,
  };
}

function uniqueClassifications(
  registry: ZavorthNativeCapabilityRegistry,
): ZavorthNativeCapabilityRegistryClassification[] {
  return Array.from(new Set(registry.toPlannerInputs().map((input) => input.classification))).sort();
}

function integration(
  source: ZavorthNativeRegistryConsumerExpansionSource,
  options: {
    consumerId: string;
    label: string;
    consumerKind: ZavorthNativeRegistryExpandedConsumerKind;
    consumerPath: string;
    status?: ZavorthNativeRegistryExpandedConsumerStatus;
    consumedRegistryKinds: ZavorthNativeRegistryKind[];
    nativeRegistryRecordsConsumed: number;
    policyPlannerClassifiesCapabilitiesUsingRegistry?: boolean;
    observabilityConsumesNativeMetadata?: boolean;
    readinessConsumesNativeMetadata?: boolean;
  },
): ZavorthNativeRegistryExpandedConsumerIntegration {
  const integrated = options.status !== 'candidate';
  return {
    nativeContract: 'ZavorthNativeRegistryExpandedConsumerIntegration/v1',
    consumerId: options.consumerId,
    label: options.label,
    consumerKind: options.consumerKind,
    consumerPath: options.consumerPath,
    status: options.status ?? 'integrated-native-first',
    integrated,
    nativeRegistryDefault: integrated,
    consumedRegistryKinds: options.consumedRegistryKinds,
    nativeRegistryRecordsConsumed: options.nativeRegistryRecordsConsumed,
    registryClassificationsConsumed: uniqueClassifications(source.capabilityRegistry),
    policyPlannerClassifiesCapabilitiesUsingRegistry: options.policyPlannerClassifiesCapabilitiesUsingRegistry ?? false,
    observabilityConsumesNativeMetadata: options.observabilityConsumesNativeMetadata ?? false,
    readinessConsumesNativeMetadata: options.readinessConsumesNativeMetadata ?? false,
    adapterCalledForDefaultLookup: false,
    adapterDefaultPathForExpandedConsumers: false,
    fallbackAdapterExplicitOnly: true,
    runtimeExternalExecutorRequiredForExpandedConsumerLookup: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
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

function buildIntegratedConsumers(
  source: ZavorthNativeRegistryConsumerExpansionSource,
): ZavorthNativeRegistryExpandedConsumerIntegration[] {
  const plannerInputCount = source.capabilityRegistry.toPlannerInputs().length;
  const configCount = source.configStateRegistry.list().length;
  const integrationCount = source.integrationRegistry.list().length;
  const sessionCount = source.sessionHistoryRegistry.listSessions().length;

  return [
    integration(source, {
      consumerId: 'controlled-dry-run-action-planner',
      label: 'Controlled dry-run action planner',
      consumerKind: 'action-planner-policy-preflight',
      consumerPath: 'src/runtime/external-agents/ExternalAgentControlledDryRunActionPlanner.ts',
      consumedRegistryKinds: ['capability-registry'],
      nativeRegistryRecordsConsumed: plannerInputCount,
      policyPlannerClassifiesCapabilitiesUsingRegistry: true,
    }),
    integration(source, {
      consumerId: 'command-http-policy-preflight',
      label: 'Command/http policy preflight',
      consumerKind: 'command-http-policy-preflight',
      consumerPath: 'src/runtime/external-agents/ExternalAgentCommandHttpPolicyPreflightBoundary.ts',
      consumedRegistryKinds: ['capability-registry', 'config-state-registry'],
      nativeRegistryRecordsConsumed: plannerInputCount + configCount,
      policyPlannerClassifiesCapabilitiesUsingRegistry: true,
    }),
    integration(source, {
      consumerId: 'command-http-observability-projection',
      label: 'Command/http observability projection',
      consumerKind: 'command-http-observability-projection',
      consumerPath: 'src/runtime/external-agents/ExternalAgentCommandHttpObservabilityProjectionBoundary.ts',
      consumedRegistryKinds: ['integration-registry', 'session-history-registry', 'config-state-registry'],
      nativeRegistryRecordsConsumed: integrationCount + sessionCount + configCount,
      observabilityConsumesNativeMetadata: true,
    }),
    integration(source, {
      consumerId: 'runtime-readiness-projection',
      label: 'Runtime readiness projection',
      consumerKind: 'runtime-readiness-projection',
      consumerPath: 'src/runtime/external-agents/ExternalAgentLiveReadinessAssimilationPack.ts',
      status: 'candidate',
      consumedRegistryKinds: ['capability-registry', 'integration-registry'],
      nativeRegistryRecordsConsumed: plannerInputCount + integrationCount,
      readinessConsumesNativeMetadata: true,
    }),
    integration(source, {
      consumerId: 'gateway-surface-conformance',
      label: 'Gateway surface conformance',
      consumerKind: 'gateway-surface-conformance',
      consumerPath: 'src/services/GatewaySurfaceConformanceService.ts',
      status: 'candidate',
      consumedRegistryKinds: ['capability-registry'],
      nativeRegistryRecordsConsumed: plannerInputCount,
    }),
  ];
}

function consumerInventory(
  integrations: ZavorthNativeRegistryExpandedConsumerIntegration[],
): ZavorthNativeRegistryConsumerInventoryRow[] {
  return [
    inventoryRow(
      integrations,
      'controlled-dry-run-action-planner',
      'capabilities',
    ),
    inventoryRow(
      integrations,
      'command-http-policy-preflight',
      'config-secretref-state',
    ),
    inventoryRow(
      integrations,
      'command-http-observability-projection',
      'integrations-providers-channels-transports',
    ),
    inventoryRow(
      integrations,
      'runtime-readiness-projection',
      'session-history-metadata',
    ),
    inventoryRow(
      integrations,
      'gateway-surface-conformance',
      'capabilities',
    ),
  ];
}

function inventoryRow(
  integrations: ZavorthNativeRegistryExpandedConsumerIntegration[],
  consumerId: string,
  lookupClassifications: ZavorthNativeRegistryConsumerInventoryRow['lookupClassifications'],
): ZavorthNativeRegistryConsumerInventoryRow {
  const found = integrations.find((consumer) => consumer.consumerId === consumerId);
  if (!found) {
    throw new Error(`Missing consumer integration fixture: ${consumerId}`);
  }

  return {
    nativeContract: 'ZavorthNativeRegistryConsumerInventoryRow/v1',
    consumerId: found.consumerId,
    label: found.label,
    consumerPath: found.consumerPath,
    lookupClassifications,
    safeForNativeFirst: found.status === 'integrated-native-first',
    selectedFor205: found.status === 'integrated-native-first',
    adapterDefaultPathAllowed: false,
    publicSourceIdentityAllowed: false,
    rawSecretSerialized: false,
  };
}

export function evaluateZavorthNativeRegistryConsumerStaticGuard(
  files: ZavorthNativeRegistryConsumerStaticGuardFile[],
): ZavorthNativeRegistryConsumerStaticGuard {
  const findings = files.flatMap((file): ZavorthNativeRegistryConsumerStaticGuardFinding[] => {
    if (!file.defaultConsumer) {
      return [];
    }

    return FORBIDDEN_DEFAULT_PATTERNS
      .filter(({ pattern }) => pattern.test(file.content))
      .map(({ label, reason }) => ({
        nativeContract: 'ZavorthNativeRegistryConsumerStaticGuardFinding/v1',
        path: file.path,
        pattern: label,
        reason,
        defaultPathRegression: true,
      }));
  });

  return {
    nativeContract: 'ZavorthNativeRegistryConsumerStaticGuard/v1',
    checkedPaths: files.map((file) => file.path),
    findings,
    passed: findings.length === 0,
    staticGuardCatchesDefaultAdapterRegression: true,
    adapterDefaultPathForExpandedConsumers: false,
    publicExternalExecutorIdentityExposed: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthNativeRegistryConsumerExpansionExecutionGate {
  return {
    nativeRegistryConsumerExpansionPackCreated: true,
    additionalNativeFirstConsumersIntegrated: true,
    minimumAdditionalConsumers: 2,
    adapterDefaultPathForExpandedConsumers: false,
    runtimeExternalExecutorRequiredForExpandedConsumerLookup: false,
    adapterRefreshAllowed: true,
    adapterRemovalGlobalAllowed: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
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

function sourceReady(source: ZavorthNativeRegistryConsumerExpansionSource): boolean {
  return (
    source.publicSurfaceHardening.decision === 'native-absorption-public-surface-hardened' &&
    !source.adapterCalledForDefaultLookup &&
    !source.externalExecutorLiveCalledForDefaultPath &&
    !source.executionAttempted &&
    !source.externalMutationAttempted &&
    !source.stateMigrationAttempted &&
    !source.sourceModuleCopyAttempted &&
    !source.rawSecretSerialized
  );
}

export class ZavorthNativeRegistryConsumerExpansionPack {
  private readonly consumersById: Map<string, ZavorthNativeRegistryExpandedConsumerIntegration>;

  public constructor(public readonly normalization: ZavorthNativeRegistryConsumerExpansionNormalization) {
    this.consumersById = new Map(normalization.integratedConsumers.map((consumer) => [consumer.consumerId, consumer]));
  }

  public integratedNativeFirstConsumers(): ZavorthNativeRegistryExpandedConsumerIntegration[] {
    return this.normalization.integratedConsumers.filter((consumer) => consumer.integrated);
  }

  public lookupConsumer(consumerId: string): ZavorthNativeRegistryExpandedConsumerIntegration | undefined {
    return this.consumersById.get(consumerId);
  }

  public adapterDefaultGuardPassed(): boolean {
    return this.normalization.staticGuard.passed &&
      this.integratedNativeFirstConsumers().every((consumer) => (
        !consumer.adapterCalledForDefaultLookup &&
        !consumer.adapterDefaultPathForExpandedConsumers &&
        consumer.fallbackAdapterExplicitOnly
      ));
  }
}

export function createZavorthNativeRegistryConsumerExpansionFixtureSource(
  staticGuardFiles: ZavorthNativeRegistryConsumerStaticGuardFile[] = [],
): ZavorthNativeRegistryConsumerExpansionSource {
  return {
    publicSurfaceHardening: normalizeZavorthNativeAbsorptionPublicSurfaceHardeningPackFixture(
      minimalPublicSurfaceHardeningSurfaces(),
    ),
    capabilityRegistry: createZavorthNativeCapabilityRegistryFixture(),
    integrationRegistry: createZavorthNativeIntegrationRegistryFixture(),
    sessionHistoryRegistry: createZavorthNativeSessionHistoryRegistryFixture(),
    configStateRegistry: createZavorthNativeConfigStateRegistryFixture(),
    staticGuardFiles,
    adapterCalledForDefaultLookup: false,
    externalExecutorLiveCalledForDefaultPath: false,
    executionAttempted: false,
    externalMutationAttempted: false,
    stateMigrationAttempted: false,
    sourceModuleCopyAttempted: false,
    rawSecretSerialized: false,
  };
}

export function normalizeZavorthNativeRegistryConsumerExpansionPack<TRuntimeId extends string>(
  options: ZavorthNativeRegistryConsumerExpansionOptions<TRuntimeId>,
): ZavorthNativeRegistryConsumerExpansionNormalization {
  const consumers = buildIntegratedConsumers(options.source);
  const selectedConsumers = consumers.filter((consumer) => consumer.integrated);
  const staticGuard = evaluateZavorthNativeRegistryConsumerStaticGuard(options.source.staticGuardFiles);
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    selectedConsumers.length >= gate.minimumAdditionalConsumers &&
    selectedConsumers.every((consumer) => (
      consumer.nativeRegistryDefault &&
      !consumer.adapterCalledForDefaultLookup &&
      !consumer.adapterDefaultPathForExpandedConsumers &&
      consumer.fallbackAdapterExplicitOnly &&
      !consumer.runtimeExternalExecutorRequiredForExpandedConsumerLookup &&
      !consumer.executionAuthority &&
      !consumer.rawSecretSerialized
    )) &&
    staticGuard.passed;

  return {
    nativeContract: 'ZavorthNativeRegistryConsumerExpansionPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'native-registry-consumer-expansion-ready' : 'blocked',
    status: ready ? 'native-registry-consumer-expansion-ready' : 'blocked',
    sourceReadiness: {
      publicSurfaceHardening: options.source.publicSurfaceHardening.decision,
      nativeCapabilityRegistryReady: true,
      nativeIntegrationRegistryReady: true,
      nativeSessionHistoryRegistryReady: true,
      nativeConfigStateRegistryReady: true,
    },
    consumerInventory: consumerInventory(consumers),
    integratedConsumers: consumers,
    staticGuard,
    adapterPolicy: {
      nativeContract: 'ZavorthNativeRegistryConsumerAdapterPolicy/v1',
      adapterRefreshAllowed: true,
      adapterReconciliationAllowed: true,
      adapterFallbackRequiresExplicitMode: true,
      adapterDefaultPathForExpandedConsumers: false,
      adapterRemovalGlobalAllowed: false,
    },
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      publicSourceIdentityExposed: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-native-registry-consumer-expansion-or-global-adapter-removal-readiness',
  };
}

export function normalizeZavorthNativeRegistryConsumerExpansionPackFixture(
  staticGuardFiles: ZavorthNativeRegistryConsumerStaticGuardFile[] = [],
): ZavorthNativeRegistryConsumerExpansionNormalization {
  return normalizeZavorthNativeRegistryConsumerExpansionPack({
    generatedAt: ZAVORTH_NATIVE_REGISTRY_CONSUMER_EXPANSION_PACK_NOW,
    runtimeId: ZAVORTH_NATIVE_REGISTRY_CONSUMER_EXPANSION_PACK_RUNTIME_ID,
    source: createZavorthNativeRegistryConsumerExpansionFixtureSource(staticGuardFiles),
  });
}

export function createZavorthNativeRegistryConsumerExpansionPackFixture(
  staticGuardFiles: ZavorthNativeRegistryConsumerStaticGuardFile[] = [],
): ZavorthNativeRegistryConsumerExpansionPack {
  return new ZavorthNativeRegistryConsumerExpansionPack(
    normalizeZavorthNativeRegistryConsumerExpansionPackFixture(staticGuardFiles),
  );
}
