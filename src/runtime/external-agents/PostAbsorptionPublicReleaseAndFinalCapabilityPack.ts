import {
  createZavorthLimitedProductionMessageSendExpansionPackFixture,
} from './PostAbsorptionLimitedProductionMessageSendExpansionPack.js';
import {
  createZavorthPostAbsorptionFinalMaintenanceBacklogRoadmapPackFixture,
} from './PostAbsorptionFinalMaintenanceBacklogRoadmapPack.js';
import {
  createZavorthPostAbsorptionRuntimeHealthSummaryFixture,
} from './ZavorthPostAbsorptionRuntimeHealthSummary.js';
import {
  createOptionalRawHistorySqliteImporterFixture,
} from './OptionalRawHistorySqliteImporterDesignPack.js';
import {
  createProductInstallDistributionBootstrapPackFixture,
} from './ProductInstallDistributionBootstrapPack.js';
import {
  createProductInstallSmokeTempEnvironmentPackFixture,
} from './ProductInstallSmokeTempEnvironmentPack.js';
import type {
  ZavorthLimitedProductionMessageSendNormalization,
} from './PostAbsorptionLimitedProductionMessageSendExpansionPack.js';
import type {
  ZavorthPostAbsorptionMaintenanceRoadmapNormalization,
} from './PostAbsorptionFinalMaintenanceBacklogRoadmapPack.js';
import type {
  ZavorthPostAbsorptionRuntimeHealthNormalization,
} from './ZavorthPostAbsorptionRuntimeHealthSummary.js';
import type {
  OptionalRawHistorySqliteImporterDesignNormalization,
} from './OptionalRawHistorySqliteImporterDesignPack.js';
import type {
  ProductInstallDistributionNormalization,
} from './ProductInstallDistributionBootstrapPack.js';
import type {
  ProductInstallSmokeNormalization,
} from './ProductInstallSmokeTempEnvironmentPack.js';

export const POST_ABSORPTION_PUBLIC_RELEASE_AND_FINAL_CAPABILITY_PACK_NOW = '2026-05-02T01:00:00.000Z' as const;
export const POST_ABSORPTION_PUBLIC_RELEASE_AND_FINAL_CAPABILITY_PACK_RUNTIME_ID = 'post-absorption-public-release-and-final-capability-pack' as const;

export type PostAbsorptionPublicReleaseFinalCapabilityDecision =
  | 'blocked'
  | 'public-release-final-capability-ready';

export type PostAbsorptionPublicReleaseState =
  | 'adapterRetirement=domain-scoped-only'
  | 'heavyShardOptimization=optimized-or-measured-with-plan'
  | 'limitedProductionSend=policy-ready-no-send'
  | 'monitoringPolish=local-receipts-ready'
  | 'npmCreateZavorth=implemented-or-designed-with-concrete-blocker'
  | 'publishReadiness=ready-dry-run-only'
  | 'rawSqliteImporter=disabled-design-ready';

export type PostAbsorptionPublicReleaseCheckId =
  | 'bin-help'
  | 'build'
  | 'npm-pack-dry-run'
  | 'public-surface-scan'
  | 'redaction-scan'
  | 'representative-external-agents'
  | 'runtime-check';

export type PostAbsorptionPublicReleaseCheck = {
  nativeContract: 'PostAbsorptionPublicReleaseCheck/v1';
  checkId: PostAbsorptionPublicReleaseCheckId;
  commandOrCheck: string;
  expectedStatus: 'passed-or-recorded';
  publishAllowed: false;
  externalActionAllowed: false;
  rawSecretSerialized: false;
};

export type PostAbsorptionNpmPublishReadiness = {
  nativeContract: 'PostAbsorptionNpmPublishReadiness/v1';
  publishReadiness: 'ready-dry-run-only';
  npmPublishActuallyPerformed: false;
  explicitOperatorApprovalForPublish: false;
  buildCommand: 'npm run build --silent';
  packDryRunCommand: 'npm pack --dry-run';
  packageName: 'zavorth';
  binEntrypoint: './bin/zavorth.js';
  packageContentsDryRunOnly: true;
  rawSecretSerialized: false;
};

export type PostAbsorptionNpmCreateZavorthBootstrap = {
  nativeContract: 'PostAbsorptionNpmCreateZavorthBootstrap/v1';
  npmCreateZavorth: 'implemented-or-designed-with-concrete-blocker';
  status: 'design-ready-with-blocker';
  smallestCompatibleCurrentPath: 'npx zavorth setup';
  concreteBlocker: 'npm create zavorth resolves the separate npm initializer package create-zavorth; this repo currently publishes the zavorth CLI package and is not a create-package monorepo.';
  monorepoInvented: false;
  bootstrapRuntimePersisted: false;
  secretsWritten: false;
  providerOrTransportCalled: false;
  rawSecretSerialized: false;
};

export type PostAbsorptionHeavyShardOptimization = {
  nativeContract: 'PostAbsorptionHeavyShardOptimization/v1';
  heavyShardOptimization: 'optimized-or-measured-with-plan';
  knownHeavyShards: ['8/16', '3/16', '12/16', '11/16', '15/16'];
  measuredShard: '8/16';
  measurementCommand: 'npm run test:external-agents:shard -- 8/16 --testTimeout=30000';
  measuredResult: '8/16 passed 11 suites and 103 tests in 113.179s';
  coverageReductionAllowed: false;
  assertionsReducedForSpeed: false;
  externalExecutorLiveRequiredForUnitTests: false;
  optimizationPlan: string[];
  rawSecretSerialized: false;
};

export type PostAbsorptionLimitedProductionSendPolicy = {
  nativeContract: 'PostAbsorptionLimitedProductionSendPolicy/v1';
  limitedProductionSend: 'policy-ready-no-send';
  featureFlagRequired: 'ZAVORTH_LIMITED_PRODUCTION_MESSAGE_SEND_EXECUTE';
  targetChannelTransportAllowlistRequired: true;
  explicitApprovalRequired: true;
  idempotencyKeyRequired: true;
  rateLimitRequired: true;
  immediateDryRunBeforeLiveRequired: true;
  auditReceiptRequired: true;
  realMessageSentInThisPack: false;
  rawContentUsageAllowed: false;
  rawSecretSerialized: false;
};

export type PostAbsorptionRawSqliteImporterPosture = {
  nativeContract: 'PostAbsorptionRawSqliteImporterPosture/v1';
  rawSqliteImporter: 'disabled-design-ready';
  defaultMode: 'disabled';
  schemaParityFocus: true;
  operatorHistoryAssumption: 'empty-or-test-history-without-product-value';
  rawDbCopied: false;
  sqliteWriteAllowed: false;
  rawMessageContentSerialized: false;
  attachmentsOrBinariesSerialized: false;
  tokensOrCredentialsSerialized: false;
  rawSecretSerialized: false;
};

export type PostAbsorptionFallbackAdapterRetirementPosture = {
  nativeContract: 'PostAbsorptionFallbackAdapterRetirementPosture/v1';
  adapterRetirement: 'domain-scoped-only';
  onlyDomainsWithZavorthNativeSubstituteEligible: true;
  adapterGlobalStillAvailable: true;
  adapterRemovalGlobalAllowed: false;
  refreshReconciliationFallbackPreserved: true;
  defaultRuntimeRequiresAdapter: false;
  publicExternalExecutorIdentityLeak: false;
  rawSecretSerialized: false;
};

export type PostAbsorptionMonitoringReleasePolish = {
  nativeContract: 'PostAbsorptionMonitoringReleasePolish/v1';
  monitoringPolish: 'local-receipts-ready';
  localChecksConsolidated: true;
  receiptsRedacted: true;
  externalHeavyMonitoringAdded: false;
  externalExecutorLiveRequiredForMonitoring: false;
  listener18789Required: false;
  rawSecretSerialized: false;
};

export type PostAbsorptionPublicReleaseFinalCapabilityGate = {
  postAbsorptionPublicReleaseAndFinalCapabilityPackCreated: true;
  publishReadiness: 'ready-dry-run-only';
  npmCreateZavorth: 'implemented-or-designed-with-concrete-blocker';
  heavyShardOptimization: 'optimized-or-measured-with-plan';
  limitedProductionSend: 'policy-ready-no-send';
  rawSqliteImporter: 'disabled-design-ready';
  adapterRetirement: 'domain-scoped-only';
  monitoringPolish: 'local-receipts-ready';
  npmPublishActuallyPerformed: false;
  explicitOperatorApprovalForPublish: false;
  defaultRuntimeZavorthOwned: true;
  publicExternalExecutorIdentityLeak: false;
  batFilesNotProductPath: true;
  rawSecretSerialized: false;
};

export type PostAbsorptionPublicReleaseFinalCapabilitySource = {
  installDistribution: Pick<
    ProductInstallDistributionNormalization,
    'decision' | 'packageReadiness' | 'paths'
  >;
  installSmoke: Pick<
    ProductInstallSmokeNormalization,
    'decision' | 'packageInspection' | 'tempEnvironment'
  >;
  limitedProductionSend: Pick<
    ZavorthLimitedProductionMessageSendNormalization,
    'decision' | 'executionGate'
  >;
  rawSqliteImporter: Pick<
    OptionalRawHistorySqliteImporterDesignNormalization,
    'decision' | 'executionGate' | 'sourceDbSafety'
  >;
  runtimeHealth: Pick<
    ZavorthPostAbsorptionRuntimeHealthNormalization,
    'executionGate' | 'status'
  >;
  maintenanceRoadmap: Pick<
    ZavorthPostAbsorptionMaintenanceRoadmapNormalization,
    'decision' | 'finalGuardrails'
  >;
  buildDryRunPassed: true;
  npmPackDryRunPassed: true;
  binHelpPassed: true;
  representativeExternalAgentsPassed: true;
  runtimeCheckPassed: true;
  publicSurfaceScanPassed: true;
  redactionScanPassed: true;
  heavyShardMeasuredOrOptimized: true;
  npmCreateConcreteBlockerDocumented: true;
  npxSetupBootstrapAvailable: true;
  limitedProductionPolicyConsolidated: true;
  rawSqliteImporterDisabledByDefault: true;
  adapterRetirementDomainScoped: true;
  monitoringLocalReceiptsReady: true;
  npmPublishAttempted: false;
  explicitOperatorApprovalForPublish: false;
  packageBlockerFoundUnresolved: false;
  monorepoInventedForCreate: false;
  coverageReductionAttempted: false;
  docsPromoteBatFiles: false;
  publicExternalExecutorIdentityExposed: false;
  defaultRuntimeRequiresExternalExecutor: false;
  messageSendAttempted: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  rawSqliteImportAttempted: false;
  rawDbCopyAttempted: false;
  sqliteWriteAttempted: false;
  adapterGlobalRemovalAttempted: false;
  externalExecutorLiveCalledForDefaultRuntime: false;
  sourceModuleCopyAttempted: false;
  rawSecretSerialized: false;
};

export type PostAbsorptionPublicReleaseFinalCapabilityNormalization = {
  nativeContract: 'PostAbsorptionPublicReleaseAndFinalCapabilityPack/v1';
  generatedAt: string;
  runtimeId: typeof POST_ABSORPTION_PUBLIC_RELEASE_AND_FINAL_CAPABILITY_PACK_RUNTIME_ID;
  decision: PostAbsorptionPublicReleaseFinalCapabilityDecision;
  status: PostAbsorptionPublicReleaseFinalCapabilityDecision;
  expectedStates: PostAbsorptionPublicReleaseState[];
  publishReadiness: PostAbsorptionNpmPublishReadiness;
  npmCreateZavorth: PostAbsorptionNpmCreateZavorthBootstrap;
  heavyShardOptimization: PostAbsorptionHeavyShardOptimization;
  limitedProductionSend: PostAbsorptionLimitedProductionSendPolicy;
  rawSqliteImporter: PostAbsorptionRawSqliteImporterPosture;
  fallbackAdapterRetirement: PostAbsorptionFallbackAdapterRetirementPosture;
  monitoringPolish: PostAbsorptionMonitoringReleasePolish;
  validationChecks: PostAbsorptionPublicReleaseCheck[];
  executionGate: PostAbsorptionPublicReleaseFinalCapabilityGate;
  redaction: {
    rawSecretSerialized: false;
    rawContentSerialized: false;
    packageSecretsIncluded: false;
    publicSourceIdentityExposed: false;
    receiptsRedacted: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  terminalGate: 'do-not-advance-beyond-262-without-operator-decision';
};

export type PostAbsorptionPublicReleaseFinalCapabilityOptions = {
  generatedAt: string;
  runtimeId: typeof POST_ABSORPTION_PUBLIC_RELEASE_AND_FINAL_CAPABILITY_PACK_RUNTIME_ID;
  source: PostAbsorptionPublicReleaseFinalCapabilitySource;
};

function validationCheck(
  checkId: PostAbsorptionPublicReleaseCheckId,
  commandOrCheck: string,
): PostAbsorptionPublicReleaseCheck {
  return {
    nativeContract: 'PostAbsorptionPublicReleaseCheck/v1',
    checkId,
    commandOrCheck,
    expectedStatus: 'passed-or-recorded',
    publishAllowed: false,
    externalActionAllowed: false,
    rawSecretSerialized: false,
  };
}

function publishReadiness(): PostAbsorptionNpmPublishReadiness {
  return {
    nativeContract: 'PostAbsorptionNpmPublishReadiness/v1',
    publishReadiness: 'ready-dry-run-only',
    npmPublishActuallyPerformed: false,
    explicitOperatorApprovalForPublish: false,
    buildCommand: 'npm run build --silent',
    packDryRunCommand: 'npm pack --dry-run',
    packageName: 'zavorth',
    binEntrypoint: './bin/zavorth.js',
    packageContentsDryRunOnly: true,
    rawSecretSerialized: false,
  };
}

function npmCreateZavorth(): PostAbsorptionNpmCreateZavorthBootstrap {
  return {
    nativeContract: 'PostAbsorptionNpmCreateZavorthBootstrap/v1',
    npmCreateZavorth: 'implemented-or-designed-with-concrete-blocker',
    status: 'design-ready-with-blocker',
    smallestCompatibleCurrentPath: 'npx zavorth setup',
    concreteBlocker: 'npm create zavorth resolves the separate npm initializer package create-zavorth; this repo currently publishes the zavorth CLI package and is not a create-package monorepo.',
    monorepoInvented: false,
    bootstrapRuntimePersisted: false,
    secretsWritten: false,
    providerOrTransportCalled: false,
    rawSecretSerialized: false,
  };
}

function heavyShardOptimization(): PostAbsorptionHeavyShardOptimization {
  return {
    nativeContract: 'PostAbsorptionHeavyShardOptimization/v1',
    heavyShardOptimization: 'optimized-or-measured-with-plan',
    knownHeavyShards: ['8/16', '3/16', '12/16', '11/16', '15/16'],
    measuredShard: '8/16',
    measurementCommand: 'npm run test:external-agents:shard -- 8/16 --testTimeout=30000',
    measuredResult: '8/16 passed 11 suites and 103 tests in 113.179s',
    coverageReductionAllowed: false,
    assertionsReducedForSpeed: false,
    externalExecutorLiveRequiredForUnitTests: false,
    optimizationPlan: [
      'cache immutable registry/session fixtures per suite',
      'keep temp roots per mutation test only',
      'prefer sharded release verification over the unsharded external-agents suite',
      'track shard timing before changing assertions',
    ],
    rawSecretSerialized: false,
  };
}

function limitedProductionSend(): PostAbsorptionLimitedProductionSendPolicy {
  return {
    nativeContract: 'PostAbsorptionLimitedProductionSendPolicy/v1',
    limitedProductionSend: 'policy-ready-no-send',
    featureFlagRequired: 'ZAVORTH_LIMITED_PRODUCTION_MESSAGE_SEND_EXECUTE',
    targetChannelTransportAllowlistRequired: true,
    explicitApprovalRequired: true,
    idempotencyKeyRequired: true,
    rateLimitRequired: true,
    immediateDryRunBeforeLiveRequired: true,
    auditReceiptRequired: true,
    realMessageSentInThisPack: false,
    rawContentUsageAllowed: false,
    rawSecretSerialized: false,
  };
}

function rawSqliteImporter(): PostAbsorptionRawSqliteImporterPosture {
  return {
    nativeContract: 'PostAbsorptionRawSqliteImporterPosture/v1',
    rawSqliteImporter: 'disabled-design-ready',
    defaultMode: 'disabled',
    schemaParityFocus: true,
    operatorHistoryAssumption: 'empty-or-test-history-without-product-value',
    rawDbCopied: false,
    sqliteWriteAllowed: false,
    rawMessageContentSerialized: false,
    attachmentsOrBinariesSerialized: false,
    tokensOrCredentialsSerialized: false,
    rawSecretSerialized: false,
  };
}

function fallbackAdapterRetirement(): PostAbsorptionFallbackAdapterRetirementPosture {
  return {
    nativeContract: 'PostAbsorptionFallbackAdapterRetirementPosture/v1',
    adapterRetirement: 'domain-scoped-only',
    onlyDomainsWithZavorthNativeSubstituteEligible: true,
    adapterGlobalStillAvailable: true,
    adapterRemovalGlobalAllowed: false,
    refreshReconciliationFallbackPreserved: true,
    defaultRuntimeRequiresAdapter: false,
    publicExternalExecutorIdentityLeak: false,
    rawSecretSerialized: false,
  };
}

function monitoringPolish(): PostAbsorptionMonitoringReleasePolish {
  return {
    nativeContract: 'PostAbsorptionMonitoringReleasePolish/v1',
    monitoringPolish: 'local-receipts-ready',
    localChecksConsolidated: true,
    receiptsRedacted: true,
    externalHeavyMonitoringAdded: false,
    externalExecutorLiveRequiredForMonitoring: false,
    listener18789Required: false,
    rawSecretSerialized: false,
  };
}

function validationChecks(): PostAbsorptionPublicReleaseCheck[] {
  return [
    validationCheck('build', 'npm run build --silent'),
    validationCheck('npm-pack-dry-run', 'npm pack --dry-run'),
    validationCheck('bin-help', 'node bin/zavorth.js --help'),
    validationCheck('representative-external-agents', 'npm run test:external-agents:representative -- --testTimeout=30000'),
    validationCheck('runtime-check', 'npm run runtime:check --silent'),
    validationCheck('public-surface-scan', 'public surface scan for public source identity and .bat promotion'),
    validationCheck('redaction-scan', 'redaction scan without printing secret previews'),
  ];
}

function executionGate(): PostAbsorptionPublicReleaseFinalCapabilityGate {
  return {
    postAbsorptionPublicReleaseAndFinalCapabilityPackCreated: true,
    publishReadiness: 'ready-dry-run-only',
    npmCreateZavorth: 'implemented-or-designed-with-concrete-blocker',
    heavyShardOptimization: 'optimized-or-measured-with-plan',
    limitedProductionSend: 'policy-ready-no-send',
    rawSqliteImporter: 'disabled-design-ready',
    adapterRetirement: 'domain-scoped-only',
    monitoringPolish: 'local-receipts-ready',
    npmPublishActuallyPerformed: false,
    explicitOperatorApprovalForPublish: false,
    defaultRuntimeZavorthOwned: true,
    publicExternalExecutorIdentityLeak: false,
    batFilesNotProductPath: true,
    rawSecretSerialized: false,
  };
}

function expectedStates(): PostAbsorptionPublicReleaseState[] {
  return [
    'publishReadiness=ready-dry-run-only',
    'npmCreateZavorth=implemented-or-designed-with-concrete-blocker',
    'heavyShardOptimization=optimized-or-measured-with-plan',
    'limitedProductionSend=policy-ready-no-send',
    'rawSqliteImporter=disabled-design-ready',
    'adapterRetirement=domain-scoped-only',
    'monitoringPolish=local-receipts-ready',
  ];
}

function hasProhibitedAttempt(source: PostAbsorptionPublicReleaseFinalCapabilitySource): boolean {
  return source.npmPublishAttempted ||
    source.explicitOperatorApprovalForPublish ||
    source.packageBlockerFoundUnresolved ||
    source.monorepoInventedForCreate ||
    source.coverageReductionAttempted ||
    source.docsPromoteBatFiles ||
    source.publicExternalExecutorIdentityExposed ||
    source.defaultRuntimeRequiresExternalExecutor ||
    source.messageSendAttempted ||
    source.providerExecutionAttempted ||
    source.toolCommandExecutionAttempted ||
    source.rawSqliteImportAttempted ||
    source.rawDbCopyAttempted ||
    source.sqliteWriteAttempted ||
    source.adapterGlobalRemovalAttempted ||
    source.externalExecutorLiveCalledForDefaultRuntime ||
    source.sourceModuleCopyAttempted ||
    source.rawSecretSerialized;
}

function sourceReady(source: PostAbsorptionPublicReleaseFinalCapabilitySource): boolean {
  return (
    source.installDistribution.decision === 'product-install-distribution-bootstrap-ready' &&
    source.installDistribution.packageReadiness.binZavorth === './bin/zavorth.js' &&
    source.installDistribution.packageReadiness.npmPublishActuallyPerformed === false &&
    source.installSmoke.decision === 'install-smoke-passed' &&
    source.installSmoke.packageInspection.npmPublishActuallyPerformed === false &&
    source.installSmoke.tempEnvironment.cleanedAfterSmoke &&
    source.limitedProductionSend.decision === 'limited-production-message-send-expansion-ready' &&
    source.limitedProductionSend.executionGate.messageActuallySent === false &&
    source.rawSqliteImporter.decision === 'optional-raw-history-sqlite-importer-design-ready' &&
    source.rawSqliteImporter.executionGate.rawImportActuallyPerformed === false &&
    source.rawSqliteImporter.executionGate.rawDbCopied === false &&
    source.rawSqliteImporter.sourceDbSafety.sqliteWriteAllowed === false &&
    source.runtimeHealth.executionGate.defaultRuntimeZavorthOwned &&
    source.runtimeHealth.executionGate.externalExecutorLiveRequiredForHealthSummary === false &&
    source.runtimeHealth.executionGate.adapterDefaultPathForAbsorbedDomains === false &&
    source.maintenanceRoadmap.decision === 'final-maintenance-backlog-roadmap-ready' &&
    source.maintenanceRoadmap.finalGuardrails.defaultRuntimeZavorthOwned &&
    source.maintenanceRoadmap.finalGuardrails.publicExternalExecutorIdentityLeak === false &&
    source.buildDryRunPassed &&
    source.npmPackDryRunPassed &&
    source.binHelpPassed &&
    source.representativeExternalAgentsPassed &&
    source.runtimeCheckPassed &&
    source.publicSurfaceScanPassed &&
    source.redactionScanPassed &&
    source.heavyShardMeasuredOrOptimized &&
    source.npmCreateConcreteBlockerDocumented &&
    source.npxSetupBootstrapAvailable &&
    source.limitedProductionPolicyConsolidated &&
    source.rawSqliteImporterDisabledByDefault &&
    source.adapterRetirementDomainScoped &&
    source.monitoringLocalReceiptsReady &&
    !hasProhibitedAttempt(source)
  );
}

export class PostAbsorptionPublicReleaseAndFinalCapabilityPack {
  public constructor(public readonly normalization: PostAbsorptionPublicReleaseFinalCapabilityNormalization) {}

  public expectedState(state: PostAbsorptionPublicReleaseState): boolean {
    return this.normalization.expectedStates.includes(state);
  }

  public validationCheck(checkId: PostAbsorptionPublicReleaseCheckId): PostAbsorptionPublicReleaseCheck | undefined {
    return this.normalization.validationChecks.find((check) => check.checkId === checkId);
  }

  public publishAllowed(): boolean {
    return this.normalization.publishReadiness.npmPublishActuallyPerformed;
  }
}

export function createPostAbsorptionPublicReleaseFinalCapabilitySource(
  overrides: Partial<PostAbsorptionPublicReleaseFinalCapabilitySource> = {},
): PostAbsorptionPublicReleaseFinalCapabilitySource {
  return {
    installDistribution: createProductInstallDistributionBootstrapPackFixture().normalization,
    installSmoke: createProductInstallSmokeTempEnvironmentPackFixture().normalization,
    limitedProductionSend: createZavorthLimitedProductionMessageSendExpansionPackFixture().normalization,
    rawSqliteImporter: createOptionalRawHistorySqliteImporterFixture().normalization,
    runtimeHealth: createZavorthPostAbsorptionRuntimeHealthSummaryFixture().normalization,
    maintenanceRoadmap: createZavorthPostAbsorptionFinalMaintenanceBacklogRoadmapPackFixture().normalization,
    buildDryRunPassed: true,
    npmPackDryRunPassed: true,
    binHelpPassed: true,
    representativeExternalAgentsPassed: true,
    runtimeCheckPassed: true,
    publicSurfaceScanPassed: true,
    redactionScanPassed: true,
    heavyShardMeasuredOrOptimized: true,
    npmCreateConcreteBlockerDocumented: true,
    npxSetupBootstrapAvailable: true,
    limitedProductionPolicyConsolidated: true,
    rawSqliteImporterDisabledByDefault: true,
    adapterRetirementDomainScoped: true,
    monitoringLocalReceiptsReady: true,
    npmPublishAttempted: false,
    explicitOperatorApprovalForPublish: false,
    packageBlockerFoundUnresolved: false,
    monorepoInventedForCreate: false,
    coverageReductionAttempted: false,
    docsPromoteBatFiles: false,
    publicExternalExecutorIdentityExposed: false,
    defaultRuntimeRequiresExternalExecutor: false,
    messageSendAttempted: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    rawSqliteImportAttempted: false,
    rawDbCopyAttempted: false,
    sqliteWriteAttempted: false,
    adapterGlobalRemovalAttempted: false,
    externalExecutorLiveCalledForDefaultRuntime: false,
    sourceModuleCopyAttempted: false,
    rawSecretSerialized: false,
    ...overrides,
  };
}

export function normalizePostAbsorptionPublicReleaseAndFinalCapabilityPack(
  options: PostAbsorptionPublicReleaseFinalCapabilityOptions,
): PostAbsorptionPublicReleaseFinalCapabilityNormalization {
  const ready = sourceReady(options.source);

  return {
    nativeContract: 'PostAbsorptionPublicReleaseAndFinalCapabilityPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'public-release-final-capability-ready' : 'blocked',
    status: ready ? 'public-release-final-capability-ready' : 'blocked',
    expectedStates: expectedStates(),
    publishReadiness: publishReadiness(),
    npmCreateZavorth: npmCreateZavorth(),
    heavyShardOptimization: heavyShardOptimization(),
    limitedProductionSend: limitedProductionSend(),
    rawSqliteImporter: rawSqliteImporter(),
    fallbackAdapterRetirement: fallbackAdapterRetirement(),
    monitoringPolish: monitoringPolish(),
    validationChecks: validationChecks(),
    executionGate: executionGate(),
    redaction: {
      rawSecretSerialized: false,
      rawContentSerialized: false,
      packageSecretsIncluded: false,
      publicSourceIdentityExposed: false,
      receiptsRedacted: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    terminalGate: 'do-not-advance-beyond-262-without-operator-decision',
  };
}

export function createPostAbsorptionPublicReleaseAndFinalCapabilityPackFixture(
  overrides: Partial<PostAbsorptionPublicReleaseFinalCapabilitySource> = {},
): PostAbsorptionPublicReleaseAndFinalCapabilityPack {
  return new PostAbsorptionPublicReleaseAndFinalCapabilityPack(
    normalizePostAbsorptionPublicReleaseAndFinalCapabilityPack({
      generatedAt: POST_ABSORPTION_PUBLIC_RELEASE_AND_FINAL_CAPABILITY_PACK_NOW,
      runtimeId: POST_ABSORPTION_PUBLIC_RELEASE_AND_FINAL_CAPABILITY_PACK_RUNTIME_ID,
      source: createPostAbsorptionPublicReleaseFinalCapabilitySource(overrides),
    }),
  );
}
