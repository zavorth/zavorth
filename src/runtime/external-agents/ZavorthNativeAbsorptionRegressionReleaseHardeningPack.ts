import {
  evaluateZavorthAdapterDecommissionStaticGuard,
} from './ZavorthAdapterDecommissionReadinessPack.js';
import type {
  ZavorthAdapterDecommissionStaticGuard,
  ZavorthAdapterDecommissionStaticGuardFile,
} from './ZavorthAdapterDecommissionReadinessPack.js';

export const ZAVORTH_NATIVE_ABSORPTION_REGRESSION_RELEASE_HARDENING_PACK_NOW = '2026-04-29T15:00:00.000Z' as const;
export const ZAVORTH_NATIVE_ABSORPTION_REGRESSION_RELEASE_HARDENING_PACK_RUNTIME_ID = 'zavorth-native-absorption-regression-release-hardening-pack' as const;

export type ZavorthNativeAbsorptionRegressionReleaseDecision =
  | 'blocked'
  | 'native-absorption-regression-release-hardened';

export type ZavorthNativeAbsorptionRegressionSurfaceClassification =
  | 'absorbed-native'
  | 'adapter-required'
  | 'blocked'
  | 'native-first-refreshable';

export type ZavorthNativeAbsorptionRegressionSurfaceId =
  | 'action-dispatch'
  | 'capability-registry'
  | 'command-tool-execution'
  | 'config-secretref-state-metadata'
  | 'dashboard-command-center'
  | 'integrations-providers-channels-transports'
  | 'message-send'
  | 'migration-import'
  | 'planner-policy-observability-consumers'
  | 'provider-execution'
  | 'refresh-reconciliation'
  | 'session-history-metadata'
  | 'storage-restore';

export type ZavorthNativeAbsorptionRegressionSurfaceRow = {
  nativeContract: 'ZavorthNativeAbsorptionRegressionSurfaceRow/v1';
  surfaceId: ZavorthNativeAbsorptionRegressionSurfaceId;
  label: string;
  classification: ZavorthNativeAbsorptionRegressionSurfaceClassification;
  evidenceGates: string[];
  regressionChecked: true;
  nativeFirstDefault: boolean;
  productionLoadedDefault: boolean;
  inMemoryFallback: boolean;
  adapterDefaultPath: false;
  adapterRequiredExplicit: boolean;
  adapterRefreshAllowed: boolean;
  blockedSurfaceExplicit: boolean;
  publicSurfaceZavorthNative: true;
  publicExternalExecutorIdentityLeak: false;
  receiptsLogsRedacted: true;
  storageRestoreChecked: boolean;
  failureDoesNotBreakLookupOrRender: true;
  runtimeExternalExecutorRequiredForNativeReadyConsumers: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  externalMutationActuallyPerformed: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeAbsorptionPublicProductHardening = {
  nativeContract: 'ZavorthNativeAbsorptionPublicProductHardening/v1';
  publicSurfaceHardened: true;
  commandCenterPublicIdentityZavorthNative: true;
  publicExternalExecutorIdentityLeak: false;
  internalProvenanceAllowed: true;
  receiptsLogsViewModelsRedacted: true;
  staticAllowlistRequiredForTechnicalProvenance: true;
  rawSecretSerialized: false;
};

export type ZavorthNativeAbsorptionNativeFirstRuntimeHardening = {
  nativeContract: 'ZavorthNativeAbsorptionNativeFirstRuntimeHardening/v1';
  productionLoadedNativeFirstReady: true;
  inMemoryNativeRegistryFallbackReady: true;
  adapterRefreshExplicitOnly: true;
  adapterFailureDoesNotBreakLookupRender: true;
  commandCenterNativeFirst: true;
  plannerPolicyObservabilityNativeFirst: true;
  adapterDefaultPathForNativeReadySurfaces: false;
  runtimeExternalExecutorRequiredForNativeReadyConsumers: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeAbsorptionStorageRestoreHardening = {
  nativeContract: 'ZavorthNativeAbsorptionStorageRestoreHardening/v1';
  persistenceRestoreChecksumValidated: true;
  redactionEnvelopeRequired: true;
  idempotencyValidated: true;
  rollbackMetadataValidated: true;
  controlledProductionNamespaceOnly: true;
  snapshotSecretFree: true;
  persistentWritePerformedByThisPack: false;
  runtimeExternalExecutorRequiredForStorageRestore: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeAbsorptionReleaseDecommissionReport = {
  nativeContract: 'ZavorthNativeAbsorptionReleaseDecommissionReport/v1';
  removedOrIsolatedBy207: string[];
  adapterRequiredStillExplicit: string[];
  blockedStillExplicit: string[];
  nextCandidatesPostWave3: string[];
  adapterGlobalStillAvailable: true;
  adapterRemovalGlobalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeAbsorptionRegressionReleaseExecutionGate = {
  wave3RegressionReleaseHardeningComplete: true;
  nativeFirstSurfacesRegressionChecked: true;
  partialAdapterDecommissionRegressionChecked: true;
  publicSurfaceHardened: true;
  productionLoadedNativeFirstReady: true;
  adapterGlobalStillAvailable: true;
  adapterRemovalGlobalAllowed: false;
  runtimeExternalExecutorRequiredForNativeReadyConsumers: false;
  adapterDefaultPathForNativeReadySurfaces: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  externalMutationActuallyPerformed: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeAbsorptionRegressionReleaseSource = {
  milestoneReport: 'wave3-native-absorption-milestone-recorded';
  consolidationPack: 'native-absorption-consolidation-ready';
  refreshCommitPack: 'native-refresh-commit-ready';
  partialAdapterRemoval: 'partial-adapter-removal-implemented';
  publicSurfaceHardening: 'native-absorption-public-surface-hardened';
  consumerExpansion: 'native-registry-consumer-expansion-ready';
  decommissionReadiness: 'adapter-decommission-readiness-ready';
  partialDecommission: 'partial-adapter-decommission-implemented';
  nativeRegistriesReady: true;
  commandCenterNativeFirstReady: true;
  productionLoadedRestoreReady: true;
  storageRestoreControlled: true;
  adapterGlobalAvailable: true;
  adapterRequiredSurfacesExplicit: true;
  adapterRemovalAttempted: false;
  externalExecutorLiveCalledForDefaultPath: false;
  executionAttempted: false;
  externalMutationAttempted: false;
  stateMigrationAttempted: false;
  sourceModuleCopyAttempted: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
  staticGuardFiles: ZavorthAdapterDecommissionStaticGuardFile[];
};

export type ZavorthNativeAbsorptionRegressionReleaseNormalization = {
  nativeContract: 'ZavorthNativeAbsorptionRegressionReleaseHardeningPack/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthNativeAbsorptionRegressionReleaseDecision;
  status: 'blocked' | 'native-absorption-regression-release-hardened';
  sourceReadiness: Omit<ZavorthNativeAbsorptionRegressionReleaseSource, 'staticGuardFiles'>;
  regressionMatrix: ZavorthNativeAbsorptionRegressionSurfaceRow[];
  staticGuard: ZavorthAdapterDecommissionStaticGuard;
  publicProductHardening: ZavorthNativeAbsorptionPublicProductHardening;
  nativeFirstRuntimeHardening: ZavorthNativeAbsorptionNativeFirstRuntimeHardening;
  storageRestoreHardening: ZavorthNativeAbsorptionStorageRestoreHardening;
  decommissionReport: ZavorthNativeAbsorptionReleaseDecommissionReport;
  executionGate: ZavorthNativeAbsorptionRegressionReleaseExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    publicSourceIdentityExposed: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'post-wave3-next-partial-decommission-or-release-acceptance';
};

export type ZavorthNativeAbsorptionRegressionReleaseOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  runtimeId: TRuntimeId;
  source: ZavorthNativeAbsorptionRegressionReleaseSource;
};

function surfaceRow(input: {
  surfaceId: ZavorthNativeAbsorptionRegressionSurfaceId;
  label: string;
  classification: ZavorthNativeAbsorptionRegressionSurfaceClassification;
  evidenceGates: string[];
  nativeFirstDefault?: boolean;
  productionLoadedDefault?: boolean;
  inMemoryFallback?: boolean;
  adapterRequiredExplicit?: boolean;
  adapterRefreshAllowed?: boolean;
  blockedSurfaceExplicit?: boolean;
  storageRestoreChecked?: boolean;
}): ZavorthNativeAbsorptionRegressionSurfaceRow {
  return {
    nativeContract: 'ZavorthNativeAbsorptionRegressionSurfaceRow/v1',
    surfaceId: input.surfaceId,
    label: input.label,
    classification: input.classification,
    evidenceGates: input.evidenceGates,
    regressionChecked: true,
    nativeFirstDefault: input.nativeFirstDefault ?? false,
    productionLoadedDefault: input.productionLoadedDefault ?? false,
    inMemoryFallback: input.inMemoryFallback ?? false,
    adapterDefaultPath: false,
    adapterRequiredExplicit: input.adapterRequiredExplicit ?? false,
    adapterRefreshAllowed: input.adapterRefreshAllowed ?? false,
    blockedSurfaceExplicit: input.blockedSurfaceExplicit ?? false,
    publicSurfaceZavorthNative: true,
    publicExternalExecutorIdentityLeak: false,
    receiptsLogsRedacted: true,
    storageRestoreChecked: input.storageRestoreChecked ?? false,
    failureDoesNotBreakLookupOrRender: true,
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

function regressionMatrix(): ZavorthNativeAbsorptionRegressionSurfaceRow[] {
  return [
    surfaceRow({
      surfaceId: 'capability-registry',
      label: 'Capability and plugin registry',
      classification: 'absorbed-native',
      evidenceGates: ['185', '190', '201', '203', '207'],
      nativeFirstDefault: true,
      productionLoadedDefault: true,
      inMemoryFallback: true,
    }),
    surfaceRow({
      surfaceId: 'dashboard-command-center',
      label: 'Dashboard and Command Center view models',
      classification: 'native-first-refreshable',
      evidenceGates: ['186', '192', '199', '201', '203', '207'],
      nativeFirstDefault: true,
      productionLoadedDefault: true,
      inMemoryFallback: true,
    }),
    surfaceRow({
      surfaceId: 'integrations-providers-channels-transports',
      label: 'Integrations, providers, channels, and transports metadata',
      classification: 'native-first-refreshable',
      evidenceGates: ['183', '187', '190', '201', '203', '207'],
      nativeFirstDefault: true,
      productionLoadedDefault: true,
      inMemoryFallback: true,
    }),
    surfaceRow({
      surfaceId: 'session-history-metadata',
      label: 'Session and history metadata',
      classification: 'native-first-refreshable',
      evidenceGates: ['172', '188', '190', '201', '203', '207'],
      nativeFirstDefault: true,
      productionLoadedDefault: true,
      inMemoryFallback: true,
    }),
    surfaceRow({
      surfaceId: 'config-secretref-state-metadata',
      label: 'Config, SecretRef, and state metadata',
      classification: 'native-first-refreshable',
      evidenceGates: ['157', '162', '189', '190', '201', '203', '207'],
      nativeFirstDefault: true,
      productionLoadedDefault: true,
      inMemoryFallback: true,
    }),
    surfaceRow({
      surfaceId: 'planner-policy-observability-consumers',
      label: 'Planner, policy, and observability consumers',
      classification: 'native-first-refreshable',
      evidenceGates: ['205', '206', '207'],
      nativeFirstDefault: true,
      productionLoadedDefault: true,
      inMemoryFallback: true,
    }),
    surfaceRow({
      surfaceId: 'storage-restore',
      label: 'Controlled storage and restore path',
      classification: 'native-first-refreshable',
      evidenceGates: ['194', '195', '196', '197', '198', '199'],
      nativeFirstDefault: true,
      productionLoadedDefault: true,
      inMemoryFallback: true,
      storageRestoreChecked: true,
    }),
    surfaceRow({
      surfaceId: 'refresh-reconciliation',
      label: 'Refresh and reconciliation',
      classification: 'adapter-required',
      evidenceGates: ['193', '202', '206', '207'],
      adapterRequiredExplicit: true,
      adapterRefreshAllowed: true,
    }),
    surfaceRow({
      surfaceId: 'action-dispatch',
      label: 'Action dispatch',
      classification: 'blocked',
      evidenceGates: ['174', '175', '178', '179', '180', '181'],
      blockedSurfaceExplicit: true,
    }),
    surfaceRow({
      surfaceId: 'message-send',
      label: 'Message send',
      classification: 'blocked',
      evidenceGates: ['182', '183'],
      blockedSurfaceExplicit: true,
    }),
    surfaceRow({
      surfaceId: 'provider-execution',
      label: 'Provider execution',
      classification: 'blocked',
      evidenceGates: ['174', '175', '178'],
      blockedSurfaceExplicit: true,
    }),
    surfaceRow({
      surfaceId: 'command-tool-execution',
      label: 'Command and tool execution',
      classification: 'blocked',
      evidenceGates: ['174', '175', '178'],
      blockedSurfaceExplicit: true,
    }),
    surfaceRow({
      surfaceId: 'migration-import',
      label: 'Migration and import',
      classification: 'blocked',
      evidenceGates: ['162', '163', '164', '165', '166', '167'],
      blockedSurfaceExplicit: true,
    }),
  ];
}

function publicProductHardening(): ZavorthNativeAbsorptionPublicProductHardening {
  return {
    nativeContract: 'ZavorthNativeAbsorptionPublicProductHardening/v1',
    publicSurfaceHardened: true,
    commandCenterPublicIdentityZavorthNative: true,
    publicExternalExecutorIdentityLeak: false,
    internalProvenanceAllowed: true,
    receiptsLogsViewModelsRedacted: true,
    staticAllowlistRequiredForTechnicalProvenance: true,
    rawSecretSerialized: false,
  };
}

function nativeFirstRuntimeHardening(): ZavorthNativeAbsorptionNativeFirstRuntimeHardening {
  return {
    nativeContract: 'ZavorthNativeAbsorptionNativeFirstRuntimeHardening/v1',
    productionLoadedNativeFirstReady: true,
    inMemoryNativeRegistryFallbackReady: true,
    adapterRefreshExplicitOnly: true,
    adapterFailureDoesNotBreakLookupRender: true,
    commandCenterNativeFirst: true,
    plannerPolicyObservabilityNativeFirst: true,
    adapterDefaultPathForNativeReadySurfaces: false,
    runtimeExternalExecutorRequiredForNativeReadyConsumers: false,
    rawSecretSerialized: false,
  };
}

function storageRestoreHardening(): ZavorthNativeAbsorptionStorageRestoreHardening {
  return {
    nativeContract: 'ZavorthNativeAbsorptionStorageRestoreHardening/v1',
    persistenceRestoreChecksumValidated: true,
    redactionEnvelopeRequired: true,
    idempotencyValidated: true,
    rollbackMetadataValidated: true,
    controlledProductionNamespaceOnly: true,
    snapshotSecretFree: true,
    persistentWritePerformedByThisPack: false,
    runtimeExternalExecutorRequiredForStorageRestore: false,
    rawSecretSerialized: false,
  };
}

function decommissionReport(): ZavorthNativeAbsorptionReleaseDecommissionReport {
  return {
    nativeContract: 'ZavorthNativeAbsorptionReleaseDecommissionReport/v1',
    removedOrIsolatedBy207: [
      'command-center-runtime-projection-default-route',
      'controlled-dry-run-action-planner-default-route',
      'command-http-policy-preflight-default-route',
      'command-http-observability-projection-default-route',
    ],
    adapterRequiredStillExplicit: [
      'external-executor-live-read-only-probe',
      'external-executor-authenticated-health-probe',
      'external-executor-real-capability-snapshot',
      'external-executor-live-read-only-bridge',
      'approved-mutation-execution-harness',
      'native-registry-refresh-reconciliation',
    ],
    blockedStillExplicit: [
      'action-dispatch',
      'message-send',
      'provider-execution',
      'command-tool-execution',
      'migration-import',
    ],
    nextCandidatesPostWave3: [
      'fixture-external-agent-adapter',
      'public-legacy-doc-api-name-cleanup',
      'refresh-boundary-wrapper-hardening',
    ],
    adapterGlobalStillAvailable: true,
    adapterRemovalGlobalAllowed: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthNativeAbsorptionRegressionReleaseExecutionGate {
  return {
    wave3RegressionReleaseHardeningComplete: true,
    nativeFirstSurfacesRegressionChecked: true,
    partialAdapterDecommissionRegressionChecked: true,
    publicSurfaceHardened: true,
    productionLoadedNativeFirstReady: true,
    adapterGlobalStillAvailable: true,
    adapterRemovalGlobalAllowed: false,
    runtimeExternalExecutorRequiredForNativeReadyConsumers: false,
    adapterDefaultPathForNativeReadySurfaces: false,
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

function sourceReady(source: ZavorthNativeAbsorptionRegressionReleaseSource): boolean {
  return (
    source.milestoneReport === 'wave3-native-absorption-milestone-recorded' &&
    source.consolidationPack === 'native-absorption-consolidation-ready' &&
    source.refreshCommitPack === 'native-refresh-commit-ready' &&
    source.partialAdapterRemoval === 'partial-adapter-removal-implemented' &&
    source.publicSurfaceHardening === 'native-absorption-public-surface-hardened' &&
    source.consumerExpansion === 'native-registry-consumer-expansion-ready' &&
    source.decommissionReadiness === 'adapter-decommission-readiness-ready' &&
    source.partialDecommission === 'partial-adapter-decommission-implemented' &&
    source.nativeRegistriesReady &&
    source.commandCenterNativeFirstReady &&
    source.productionLoadedRestoreReady &&
    source.storageRestoreControlled &&
    source.adapterGlobalAvailable &&
    source.adapterRequiredSurfacesExplicit &&
    !source.adapterRemovalAttempted &&
    !source.externalExecutorLiveCalledForDefaultPath &&
    !source.executionAttempted &&
    !source.externalMutationAttempted &&
    !source.stateMigrationAttempted &&
    !source.sourceModuleCopyAttempted &&
    !source.publicExternalExecutorIdentityExposed &&
    !source.rawSecretSerialized
  );
}

export class ZavorthNativeAbsorptionRegressionReleaseHardeningPack {
  private readonly surfacesById: Map<ZavorthNativeAbsorptionRegressionSurfaceId, ZavorthNativeAbsorptionRegressionSurfaceRow>;

  public constructor(public readonly normalization: ZavorthNativeAbsorptionRegressionReleaseNormalization) {
    this.surfacesById = new Map(normalization.regressionMatrix.map((row) => [row.surfaceId, row]));
  }

  public lookupSurface(surfaceId: ZavorthNativeAbsorptionRegressionSurfaceId): ZavorthNativeAbsorptionRegressionSurfaceRow | undefined {
    return this.surfacesById.get(surfaceId);
  }

  public nativeFirstSurfaces(): ZavorthNativeAbsorptionRegressionSurfaceRow[] {
    return this.normalization.regressionMatrix.filter((row) => row.nativeFirstDefault);
  }

  public adapterRequiredOrBlockedSurfaces(): ZavorthNativeAbsorptionRegressionSurfaceRow[] {
    return this.normalization.regressionMatrix.filter((row) => (
      row.classification === 'adapter-required' || row.classification === 'blocked'
    ));
  }
}

export function createZavorthNativeAbsorptionRegressionReleaseFixtureSource(
  staticGuardFiles: ZavorthAdapterDecommissionStaticGuardFile[] = [],
): ZavorthNativeAbsorptionRegressionReleaseSource {
  return {
    milestoneReport: 'wave3-native-absorption-milestone-recorded',
    consolidationPack: 'native-absorption-consolidation-ready',
    refreshCommitPack: 'native-refresh-commit-ready',
    partialAdapterRemoval: 'partial-adapter-removal-implemented',
    publicSurfaceHardening: 'native-absorption-public-surface-hardened',
    consumerExpansion: 'native-registry-consumer-expansion-ready',
    decommissionReadiness: 'adapter-decommission-readiness-ready',
    partialDecommission: 'partial-adapter-decommission-implemented',
    nativeRegistriesReady: true,
    commandCenterNativeFirstReady: true,
    productionLoadedRestoreReady: true,
    storageRestoreControlled: true,
    adapterGlobalAvailable: true,
    adapterRequiredSurfacesExplicit: true,
    adapterRemovalAttempted: false,
    externalExecutorLiveCalledForDefaultPath: false,
    executionAttempted: false,
    externalMutationAttempted: false,
    stateMigrationAttempted: false,
    sourceModuleCopyAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    rawSecretSerialized: false,
    staticGuardFiles,
  };
}

export function normalizeZavorthNativeAbsorptionRegressionReleaseHardeningPack<TRuntimeId extends string>(
  options: ZavorthNativeAbsorptionRegressionReleaseOptions<TRuntimeId>,
): ZavorthNativeAbsorptionRegressionReleaseNormalization {
  const matrix = regressionMatrix();
  const staticGuard = evaluateZavorthAdapterDecommissionStaticGuard(options.source.staticGuardFiles);
  const publicHardening = publicProductHardening();
  const runtimeHardening = nativeFirstRuntimeHardening();
  const storageHardening = storageRestoreHardening();
  const report = decommissionReport();
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    staticGuard.passed &&
    matrix.every((row) => row.regressionChecked && !row.adapterDefaultPath && !row.rawSecretSerialized) &&
    matrix.filter((row) => row.nativeFirstDefault).length >= 7 &&
    matrix.some((row) => row.adapterRequiredExplicit) &&
    matrix.some((row) => row.blockedSurfaceExplicit) &&
    publicHardening.publicSurfaceHardened &&
    runtimeHardening.productionLoadedNativeFirstReady &&
    storageHardening.persistenceRestoreChecksumValidated &&
    report.adapterRequiredStillExplicit.length > 0;

  const {
    staticGuardFiles: _staticGuardFiles,
    ...sourceReadiness
  } = options.source;

  return {
    nativeContract: 'ZavorthNativeAbsorptionRegressionReleaseHardeningPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'native-absorption-regression-release-hardened' : 'blocked',
    status: ready ? 'native-absorption-regression-release-hardened' : 'blocked',
    sourceReadiness,
    regressionMatrix: matrix,
    staticGuard,
    publicProductHardening: publicHardening,
    nativeFirstRuntimeHardening: runtimeHardening,
    storageRestoreHardening: storageHardening,
    decommissionReport: report,
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      publicSourceIdentityExposed: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'post-wave3-next-partial-decommission-or-release-acceptance',
  };
}

export function normalizeZavorthNativeAbsorptionRegressionReleaseHardeningPackFixture(
  staticGuardFiles: ZavorthAdapterDecommissionStaticGuardFile[] = [],
): ZavorthNativeAbsorptionRegressionReleaseNormalization {
  return normalizeZavorthNativeAbsorptionRegressionReleaseHardeningPack({
    generatedAt: ZAVORTH_NATIVE_ABSORPTION_REGRESSION_RELEASE_HARDENING_PACK_NOW,
    runtimeId: ZAVORTH_NATIVE_ABSORPTION_REGRESSION_RELEASE_HARDENING_PACK_RUNTIME_ID,
    source: createZavorthNativeAbsorptionRegressionReleaseFixtureSource(staticGuardFiles),
  });
}

export function createZavorthNativeAbsorptionRegressionReleaseHardeningPackFixture(
  staticGuardFiles: ZavorthAdapterDecommissionStaticGuardFile[] = [],
): ZavorthNativeAbsorptionRegressionReleaseHardeningPack {
  return new ZavorthNativeAbsorptionRegressionReleaseHardeningPack(
    normalizeZavorthNativeAbsorptionRegressionReleaseHardeningPackFixture(staticGuardFiles),
  );
}
