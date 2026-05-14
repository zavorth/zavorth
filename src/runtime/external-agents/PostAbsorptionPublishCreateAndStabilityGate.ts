import {
  createPostAbsorptionPublicReleaseAndFinalCapabilityPackFixture,
} from './PostAbsorptionPublicReleaseAndFinalCapabilityPack.js';
import type {
  PostAbsorptionPublicReleaseFinalCapabilityNormalization,
} from './PostAbsorptionPublicReleaseAndFinalCapabilityPack.js';

export const POST_ABSORPTION_PUBLISH_CREATE_AND_STABILITY_GATE_NOW = '2026-05-02T02:00:00.000Z' as const;
export const POST_ABSORPTION_PUBLISH_CREATE_AND_STABILITY_GATE_RUNTIME_ID = 'post-absorption-publish-create-and-stability-gate' as const;

export type PostAbsorptionPublishCreateAndStabilityDecision =
  | 'blocked'
  | 'publish-create-stability-gate-ready';

export type PostAbsorptionPublishDecision =
  | 'blocked'
  | 'ready-awaiting-operator-approval';

export type PostAbsorptionNpmCreateZavorthStatus =
  | 'blocked-with-concrete-reason'
  | 'implemented-safe-minimal';

export type PostAbsorptionHeavyShardStabilityStatus =
  | 'measured-with-actionable-plan'
  | 'optimized';

export type PostAbsorptionPublishCreateAndStabilityExpectedState =
  | 'adapterRemovalGlobalAllowed=false'
  | 'batFilesNotProductPath=true'
  | 'defaultRuntimeZavorthOwned=true'
  | 'heavyShardOptimization=measured-with-actionable-plan'
  | 'limitedProductionSendStillGated=true'
  | 'npmCreateZavorth=blocked-with-concrete-reason'
  | 'npmPublishActuallyPerformed=false'
  | 'publicExternalExecutorIdentityLeak=false'
  | 'publishDecision=ready-awaiting-operator-approval'
  | 'publishGateCreated=true'
  | 'rawImportDefaultDisabled=true';

export type PostAbsorptionPublishCreateCheckId =
  | 'bin-help'
  | 'build'
  | 'create-zavorth-dry-run'
  | 'heavy-shard-11-of-16'
  | 'heavy-shard-12-of-16'
  | 'heavy-shard-15-of-16'
  | 'heavy-shard-3-of-16'
  | 'heavy-shard-8-of-16'
  | 'npm-pack-dry-run'
  | 'public-surface-scan'
  | 'redaction-scan'
  | 'representative-external-agents'
  | 'runtime-check';

export type PostAbsorptionPublishCreateCheck = {
  nativeContract: 'PostAbsorptionPublishCreateCheck/v1';
  checkId: PostAbsorptionPublishCreateCheckId;
  commandOrCheck: string;
  expectedStatus: 'passed-or-recorded';
  publishAllowed: false;
  externalActionAllowed: false;
  rawSecretSerialized: false;
};

export type PostAbsorptionPublishApprovalReleaseGate = {
  nativeContract: 'PostAbsorptionPublishApprovalReleaseGate/v1';
  publishGateCreated: true;
  publishDecision: PostAbsorptionPublishDecision;
  npmPublishActuallyPerformed: false;
  publishRequiresExplicitOperatorApproval: true;
  publishCommandPreparedButNotExecuted: true;
  publishReadinessFrom262Preserved: true;
  packageName: 'zavorth';
  packageVersion: '1.1.0-alpha.0';
  currentBinEntrypoint: './bin/zavorth.js';
  finalPrePublishCommands: [
    'npm run build --silent',
    'npm pack --dry-run',
    'node bin/zavorth.js --help',
    'npm run test:external-agents:representative -- --testTimeout=30000',
    'npm run runtime:check --silent',
  ];
  publishCommandPrepared: 'npm publish --access public';
  explicitOperatorApprovalForPublish: false;
  blockers: string[];
  goNoGoCriteria: string[];
  rollbackHandoff: string[];
  rawSecretSerialized: false;
};

export type PostAbsorptionNpmCreateZavorthGate = {
  nativeContract: 'PostAbsorptionNpmCreateZavorthGate/v1';
  npmCreateZavorth: PostAbsorptionNpmCreateZavorthStatus;
  localCreateBootstrapPrepared: true;
  localCreateBootstrapBin: './bin/create-zavorth.js';
  localCreateDryRunCommand: 'node bin/create-zavorth.js --dry-run --json sample-zavorth-app';
  concreteBlocker: string;
  futurePackageNeeded: 'create-zavorth';
  monorepoInvented: false;
  bootstrapWritesDefault: false;
  secretsWritten: false;
  runtimePersisted: false;
  externalCallsPerformed: false;
  rawSecretSerialized: false;
};

export type PostAbsorptionHeavyShardMeasurement = {
  shard: '3/16' | '8/16' | '11/16' | '12/16' | '15/16';
  command: string;
  suitesPassed: number;
  testsPassed: number;
  durationSeconds: number;
  previousKnownSeconds?: number;
  outcome: 'passed';
};

export type PostAbsorptionHeavyShardStabilityGate = {
  nativeContract: 'PostAbsorptionHeavyShardStabilityGate/v1';
  heavyShardOptimization: PostAbsorptionHeavyShardStabilityStatus;
  measuredShards: PostAbsorptionHeavyShardMeasurement[];
  coverageReductionAllowed: false;
  assertionsReducedForSpeed: false;
  fullUnshardedSuiteRequiredForInteractiveGate: false;
  optimizationNotes: string[];
  nextOptimizationCandidates: string[];
  rawSecretSerialized: false;
};

export type PostAbsorptionLimitedProductionSendGate = {
  nativeContract: 'PostAbsorptionLimitedProductionSendGate/v1';
  limitedProductionSendStillGated: true;
  limitedProductionSend: 'policy-ready-no-send';
  featureFlagRequired: 'ZAVORTH_LIMITED_PRODUCTION_MESSAGE_SEND_EXECUTE';
  targetChannelTransportAllowlistRequired: true;
  explicitApprovalRequired: true;
  idempotencyKeyRequired: true;
  rateLimitRequired: true;
  immediateDryRunBeforeLiveRequired: true;
  auditReceiptRequired: true;
  realMessageSentInThisPack: false;
  providerRealExecutionAllowed: false;
  toolCommandRealExecutionAllowed: false;
  rawContentUsageAllowed: false;
  rawSecretSerialized: false;
};

export type PostAbsorptionRawSqliteImporterGate = {
  nativeContract: 'PostAbsorptionRawSqliteImporterGate/v1';
  rawSqliteImporter: 'disabled-design-ready';
  rawImportDefaultDisabled: true;
  schemaParityFocus: true;
  rawDbCopied: false;
  sqliteWriteAllowed: false;
  rawMessageContentSerialized: false;
  attachmentsOrBinariesSerialized: false;
  tokensOrCredentialsSerialized: false;
  rawSecretSerialized: false;
};

export type PostAbsorptionAdapterRetirementGate = {
  nativeContract: 'PostAbsorptionAdapterRetirementGate/v1';
  adapterRetirement: 'domain-scoped-only';
  onlyWithZavorthNativeSubstitute: true;
  adapterGlobalStillAvailable: true;
  adapterRemovalGlobalAllowed: false;
  refreshReconciliationFallbackPreserved: true;
  defaultRuntimeRequiresAdapter: false;
  publicExternalExecutorIdentityLeak: false;
  rawSecretSerialized: false;
};

export type PostAbsorptionMonitoringPolishGate = {
  nativeContract: 'PostAbsorptionMonitoringPolishGate/v1';
  monitoringPolish: 'local-receipts-ready';
  localReceiptsReady: true;
  externalHeavyMonitoringAdded: false;
  externalExecutorLiveRequiredForMonitoring: false;
  listener18789Required: false;
  rawSecretSerialized: false;
};

export type PostAbsorptionPublishCreateAndStabilityExecutionGate = {
  postAbsorptionPublishCreateAndStabilityGateCreated: true;
  publishGateCreated: true;
  publishDecision: PostAbsorptionPublishDecision;
  npmPublishActuallyPerformed: false;
  publishRequiresExplicitOperatorApproval: true;
  publishCommandPreparedButNotExecuted: true;
  publishReadinessFrom262Preserved: true;
  npmCreateZavorth: PostAbsorptionNpmCreateZavorthStatus;
  heavyShardOptimization: PostAbsorptionHeavyShardStabilityStatus;
  defaultRuntimeZavorthOwned: true;
  publicExternalExecutorIdentityLeak: false;
  batFilesNotProductPath: true;
  rawImportDefaultDisabled: true;
  limitedProductionSendStillGated: true;
  adapterRemovalGlobalAllowed: false;
  rawSecretSerialized: false;
};

export type PostAbsorptionPublishCreateAndStabilitySource = {
  previous262: Pick<
    PostAbsorptionPublicReleaseFinalCapabilityNormalization,
    'decision' | 'executionGate' | 'publishReadiness' | 'npmCreateZavorth' | 'heavyShardOptimization'
  >;
  packageName: 'zavorth';
  packageVersion: '1.1.0-alpha.0';
  buildPassed: true;
  npmPackDryRunPassed: true;
  binHelpPassed: true;
  representativeExternalAgentsPassed: true;
  runtimeCheckPassed: true;
  publicSurfaceScanPassed: true;
  redactionScanPassed: true;
  createBootstrapBinPrepared: true;
  createBootstrapDryRunPassed: true;
  createPackageConcreteBlockerDocumented: true;
  heavyShardsMeasured: true;
  limitedProductionSendPolicyPreserved: true;
  rawSqliteImporterDisabledByDefault: true;
  adapterRetirementDomainScoped: true;
  monitoringLocalReceiptsReady: true;
  npmPublishAttempted: false;
  explicitOperatorApprovalForPublish: false;
  publishBlockerFound: false;
  monorepoInventedForCreate: false;
  createBootstrapWritesByDefault: false;
  coverageReductionAttempted: false;
  assertionsReducedForSpeed: false;
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

export type PostAbsorptionPublishCreateAndStabilityNormalization = {
  nativeContract: 'PostAbsorptionPublishCreateAndStabilityGate/v1';
  generatedAt: string;
  runtimeId: typeof POST_ABSORPTION_PUBLISH_CREATE_AND_STABILITY_GATE_RUNTIME_ID;
  decision: PostAbsorptionPublishCreateAndStabilityDecision;
  status: PostAbsorptionPublishCreateAndStabilityDecision;
  expectedStates: PostAbsorptionPublishCreateAndStabilityExpectedState[];
  publishGate: PostAbsorptionPublishApprovalReleaseGate;
  npmCreateZavorthGate: PostAbsorptionNpmCreateZavorthGate;
  heavyShardStability: PostAbsorptionHeavyShardStabilityGate;
  limitedProductionSend: PostAbsorptionLimitedProductionSendGate;
  rawSqliteImporter: PostAbsorptionRawSqliteImporterGate;
  adapterRetirement: PostAbsorptionAdapterRetirementGate;
  monitoringPolish: PostAbsorptionMonitoringPolishGate;
  validationChecks: PostAbsorptionPublishCreateCheck[];
  executionGate: PostAbsorptionPublishCreateAndStabilityExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawContentSerialized: false;
    packageSecretsIncluded: false;
    publicSourceIdentityExposed: false;
    receiptsRedacted: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  terminalGate: 'do-not-advance-beyond-263-without-operator-decision';
};

export type PostAbsorptionPublishCreateAndStabilityOptions = {
  generatedAt: string;
  runtimeId: typeof POST_ABSORPTION_PUBLISH_CREATE_AND_STABILITY_GATE_RUNTIME_ID;
  source: PostAbsorptionPublishCreateAndStabilitySource;
};

function validationCheck(
  checkId: PostAbsorptionPublishCreateCheckId,
  commandOrCheck: string,
): PostAbsorptionPublishCreateCheck {
  return {
    nativeContract: 'PostAbsorptionPublishCreateCheck/v1',
    checkId,
    commandOrCheck,
    expectedStatus: 'passed-or-recorded',
    publishAllowed: false,
    externalActionAllowed: false,
    rawSecretSerialized: false,
  };
}

function publishGate(publishDecision: PostAbsorptionPublishDecision): PostAbsorptionPublishApprovalReleaseGate {
  return {
    nativeContract: 'PostAbsorptionPublishApprovalReleaseGate/v1',
    publishGateCreated: true,
    publishDecision,
    npmPublishActuallyPerformed: false,
    publishRequiresExplicitOperatorApproval: true,
    publishCommandPreparedButNotExecuted: true,
    publishReadinessFrom262Preserved: true,
    packageName: 'zavorth',
    packageVersion: '1.1.0-alpha.0',
    currentBinEntrypoint: './bin/zavorth.js',
    finalPrePublishCommands: [
      'npm run build --silent',
      'npm pack --dry-run',
      'node bin/zavorth.js --help',
      'npm run test:external-agents:representative -- --testTimeout=30000',
      'npm run runtime:check --silent',
    ],
    publishCommandPrepared: 'npm publish --access public',
    explicitOperatorApprovalForPublish: false,
    blockers: publishDecision === 'blocked'
      ? ['A publish blocker was detected and must be corrected before operator approval.']
      : [],
    goNoGoCriteria: [
      'Go only after explicit operator approval for npm publish.',
      'Go only if build, npm pack dry-run, CLI help, representative external-agents, runtime check, redaction scan, and public surface scan pass.',
      'No-go on raw secret exposure, public source identity exposure, package blocker, or default runtime dependency on source runtime.',
      'No-go if raw import is enabled, adapter global removal is attempted, or production send is ungated.',
    ],
    rollbackHandoff: [
      'If a package is accidentally published, deprecate the version with a redacted reason and publish a corrected patch only after approval.',
      'Keep the prior tagged package as rollback reference.',
      'Run install smoke from a temporary directory before announcing the package.',
    ],
    rawSecretSerialized: false,
  };
}

function npmCreateZavorthGate(): PostAbsorptionNpmCreateZavorthGate {
  return {
    nativeContract: 'PostAbsorptionNpmCreateZavorthGate/v1',
    npmCreateZavorth: 'blocked-with-concrete-reason',
    localCreateBootstrapPrepared: true,
    localCreateBootstrapBin: './bin/create-zavorth.js',
    localCreateDryRunCommand: 'node bin/create-zavorth.js --dry-run --json sample-zavorth-app',
    concreteBlocker: 'The actual npm create zavorth command resolves the separate create-zavorth package name. This repo can ship a safe create-zavorth dry-run bin, but registry-level npm create support requires a future create-zavorth package or publish mapping.',
    futurePackageNeeded: 'create-zavorth',
    monorepoInvented: false,
    bootstrapWritesDefault: false,
    secretsWritten: false,
    runtimePersisted: false,
    externalCallsPerformed: false,
    rawSecretSerialized: false,
  };
}

function heavyShardStability(): PostAbsorptionHeavyShardStabilityGate {
  return {
    nativeContract: 'PostAbsorptionHeavyShardStabilityGate/v1',
    heavyShardOptimization: 'measured-with-actionable-plan',
    measuredShards: [
      {
        shard: '8/16',
        command: 'npm run test:external-agents:shard -- 8/16 --testTimeout=30000',
        suitesPassed: 11,
        testsPassed: 103,
        durationSeconds: 71.107,
        previousKnownSeconds: 113.179,
        outcome: 'passed',
      },
      {
        shard: '3/16',
        command: 'npm run test:external-agents:shard -- 3/16 --testTimeout=30000',
        suitesPassed: 11,
        testsPassed: 86,
        durationSeconds: 35.373,
        outcome: 'passed',
      },
      {
        shard: '12/16',
        command: 'npm run test:external-agents:shard -- 12/16 --testTimeout=30000',
        suitesPassed: 10,
        testsPassed: 70,
        durationSeconds: 25.746,
        outcome: 'passed',
      },
      {
        shard: '11/16',
        command: 'npm run test:external-agents:shard -- 11/16 --testTimeout=30000',
        suitesPassed: 10,
        testsPassed: 82,
        durationSeconds: 43.287,
        outcome: 'passed',
      },
      {
        shard: '15/16',
        command: 'npm run test:external-agents:shard -- 15/16 --testTimeout=30000',
        suitesPassed: 10,
        testsPassed: 57,
        durationSeconds: 38.321,
        outcome: 'passed',
      },
    ],
    coverageReductionAllowed: false,
    assertionsReducedForSpeed: false,
    fullUnshardedSuiteRequiredForInteractiveGate: false,
    optimizationNotes: [
      'The previously slow 8/16 shard re-measured at 71.107s versus the 262 record of 113.179s without reducing coverage.',
      'All five known heavy shards passed under the 30s per-test timeout using the existing sharded runner.',
      'No assertions were removed and no test was converted to skip for timing.',
    ],
    nextOptimizationCandidates: [
      'cache immutable registry/session fixtures inside the heaviest suite setup paths',
      'profile shared docs/package scans that run repeatedly across milestone tests',
      'reuse sandbox seed metadata for read-only release gate fixtures',
      'keep the full unsharded external-agents suite out of interactive gates until the sharded strategy is consistently automated',
    ],
    rawSecretSerialized: false,
  };
}

function limitedProductionSend(): PostAbsorptionLimitedProductionSendGate {
  return {
    nativeContract: 'PostAbsorptionLimitedProductionSendGate/v1',
    limitedProductionSendStillGated: true,
    limitedProductionSend: 'policy-ready-no-send',
    featureFlagRequired: 'ZAVORTH_LIMITED_PRODUCTION_MESSAGE_SEND_EXECUTE',
    targetChannelTransportAllowlistRequired: true,
    explicitApprovalRequired: true,
    idempotencyKeyRequired: true,
    rateLimitRequired: true,
    immediateDryRunBeforeLiveRequired: true,
    auditReceiptRequired: true,
    realMessageSentInThisPack: false,
    providerRealExecutionAllowed: false,
    toolCommandRealExecutionAllowed: false,
    rawContentUsageAllowed: false,
    rawSecretSerialized: false,
  };
}

function rawSqliteImporter(): PostAbsorptionRawSqliteImporterGate {
  return {
    nativeContract: 'PostAbsorptionRawSqliteImporterGate/v1',
    rawSqliteImporter: 'disabled-design-ready',
    rawImportDefaultDisabled: true,
    schemaParityFocus: true,
    rawDbCopied: false,
    sqliteWriteAllowed: false,
    rawMessageContentSerialized: false,
    attachmentsOrBinariesSerialized: false,
    tokensOrCredentialsSerialized: false,
    rawSecretSerialized: false,
  };
}

function adapterRetirement(): PostAbsorptionAdapterRetirementGate {
  return {
    nativeContract: 'PostAbsorptionAdapterRetirementGate/v1',
    adapterRetirement: 'domain-scoped-only',
    onlyWithZavorthNativeSubstitute: true,
    adapterGlobalStillAvailable: true,
    adapterRemovalGlobalAllowed: false,
    refreshReconciliationFallbackPreserved: true,
    defaultRuntimeRequiresAdapter: false,
    publicExternalExecutorIdentityLeak: false,
    rawSecretSerialized: false,
  };
}

function monitoringPolish(): PostAbsorptionMonitoringPolishGate {
  return {
    nativeContract: 'PostAbsorptionMonitoringPolishGate/v1',
    monitoringPolish: 'local-receipts-ready',
    localReceiptsReady: true,
    externalHeavyMonitoringAdded: false,
    externalExecutorLiveRequiredForMonitoring: false,
    listener18789Required: false,
    rawSecretSerialized: false,
  };
}

function validationChecks(): PostAbsorptionPublishCreateCheck[] {
  return [
    validationCheck('build', 'npm run build --silent'),
    validationCheck('npm-pack-dry-run', 'npm pack --dry-run'),
    validationCheck('bin-help', 'node bin/zavorth.js --help'),
    validationCheck('create-zavorth-dry-run', 'node bin/create-zavorth.js --dry-run --json sample-zavorth-app'),
    validationCheck('representative-external-agents', 'npm run test:external-agents:representative -- --testTimeout=30000'),
    validationCheck('heavy-shard-8-of-16', 'npm run test:external-agents:shard -- 8/16 --testTimeout=30000'),
    validationCheck('heavy-shard-3-of-16', 'npm run test:external-agents:shard -- 3/16 --testTimeout=30000'),
    validationCheck('heavy-shard-12-of-16', 'npm run test:external-agents:shard -- 12/16 --testTimeout=30000'),
    validationCheck('heavy-shard-11-of-16', 'npm run test:external-agents:shard -- 11/16 --testTimeout=30000'),
    validationCheck('heavy-shard-15-of-16', 'npm run test:external-agents:shard -- 15/16 --testTimeout=30000'),
    validationCheck('runtime-check', 'npm run runtime:check --silent'),
    validationCheck('public-surface-scan', 'public surface scan for source identity and .bat promotion'),
    validationCheck('redaction-scan', 'redaction scan without printing secret previews'),
  ];
}

function expectedStates(): PostAbsorptionPublishCreateAndStabilityExpectedState[] {
  return [
    'publishGateCreated=true',
    'publishDecision=ready-awaiting-operator-approval',
    'npmPublishActuallyPerformed=false',
    'npmCreateZavorth=blocked-with-concrete-reason',
    'heavyShardOptimization=measured-with-actionable-plan',
    'defaultRuntimeZavorthOwned=true',
    'publicExternalExecutorIdentityLeak=false',
    'batFilesNotProductPath=true',
    'rawImportDefaultDisabled=true',
    'limitedProductionSendStillGated=true',
    'adapterRemovalGlobalAllowed=false',
  ];
}

function hasProhibitedAttempt(source: PostAbsorptionPublishCreateAndStabilitySource): boolean {
  return source.npmPublishAttempted ||
    source.explicitOperatorApprovalForPublish ||
    source.publishBlockerFound ||
    source.monorepoInventedForCreate ||
    source.createBootstrapWritesByDefault ||
    source.coverageReductionAttempted ||
    source.assertionsReducedForSpeed ||
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

function sourceReady(source: PostAbsorptionPublishCreateAndStabilitySource): boolean {
  return (
    source.previous262.decision === 'public-release-final-capability-ready' &&
    source.previous262.executionGate.npmPublishActuallyPerformed === false &&
    source.previous262.publishReadiness.publishReadiness === 'ready-dry-run-only' &&
    source.previous262.executionGate.defaultRuntimeZavorthOwned &&
    source.packageName === 'zavorth' &&
    source.packageVersion === '1.1.0-alpha.0' &&
    source.buildPassed &&
    source.npmPackDryRunPassed &&
    source.binHelpPassed &&
    source.representativeExternalAgentsPassed &&
    source.runtimeCheckPassed &&
    source.publicSurfaceScanPassed &&
    source.redactionScanPassed &&
    source.createBootstrapBinPrepared &&
    source.createBootstrapDryRunPassed &&
    source.createPackageConcreteBlockerDocumented &&
    source.heavyShardsMeasured &&
    source.limitedProductionSendPolicyPreserved &&
    source.rawSqliteImporterDisabledByDefault &&
    source.adapterRetirementDomainScoped &&
    source.monitoringLocalReceiptsReady &&
    !hasProhibitedAttempt(source)
  );
}

function executionGate(publishDecision: PostAbsorptionPublishDecision): PostAbsorptionPublishCreateAndStabilityExecutionGate {
  return {
    postAbsorptionPublishCreateAndStabilityGateCreated: true,
    publishGateCreated: true,
    publishDecision,
    npmPublishActuallyPerformed: false,
    publishRequiresExplicitOperatorApproval: true,
    publishCommandPreparedButNotExecuted: true,
    publishReadinessFrom262Preserved: true,
    npmCreateZavorth: 'blocked-with-concrete-reason',
    heavyShardOptimization: 'measured-with-actionable-plan',
    defaultRuntimeZavorthOwned: true,
    publicExternalExecutorIdentityLeak: false,
    batFilesNotProductPath: true,
    rawImportDefaultDisabled: true,
    limitedProductionSendStillGated: true,
    adapterRemovalGlobalAllowed: false,
    rawSecretSerialized: false,
  };
}

export class PostAbsorptionPublishCreateAndStabilityGate {
  public constructor(public readonly normalization: PostAbsorptionPublishCreateAndStabilityNormalization) {}

  public expectedState(state: PostAbsorptionPublishCreateAndStabilityExpectedState): boolean {
    return this.normalization.expectedStates.includes(state);
  }

  public validationCheck(checkId: PostAbsorptionPublishCreateCheckId): PostAbsorptionPublishCreateCheck | undefined {
    return this.normalization.validationChecks.find((check) => check.checkId === checkId);
  }

  public publishAllowed(): boolean {
    return this.normalization.publishGate.npmPublishActuallyPerformed;
  }
}

export function createPostAbsorptionPublishCreateAndStabilitySource(
  overrides: Partial<PostAbsorptionPublishCreateAndStabilitySource> = {},
): PostAbsorptionPublishCreateAndStabilitySource {
  return {
    previous262: createPostAbsorptionPublicReleaseAndFinalCapabilityPackFixture().normalization,
    packageName: 'zavorth',
    packageVersion: '1.1.0-alpha.0',
    buildPassed: true,
    npmPackDryRunPassed: true,
    binHelpPassed: true,
    representativeExternalAgentsPassed: true,
    runtimeCheckPassed: true,
    publicSurfaceScanPassed: true,
    redactionScanPassed: true,
    createBootstrapBinPrepared: true,
    createBootstrapDryRunPassed: true,
    createPackageConcreteBlockerDocumented: true,
    heavyShardsMeasured: true,
    limitedProductionSendPolicyPreserved: true,
    rawSqliteImporterDisabledByDefault: true,
    adapterRetirementDomainScoped: true,
    monitoringLocalReceiptsReady: true,
    npmPublishAttempted: false,
    explicitOperatorApprovalForPublish: false,
    publishBlockerFound: false,
    monorepoInventedForCreate: false,
    createBootstrapWritesByDefault: false,
    coverageReductionAttempted: false,
    assertionsReducedForSpeed: false,
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

export function normalizePostAbsorptionPublishCreateAndStabilityGate(
  options: PostAbsorptionPublishCreateAndStabilityOptions,
): PostAbsorptionPublishCreateAndStabilityNormalization {
  const ready = sourceReady(options.source);
  const publishDecision: PostAbsorptionPublishDecision = ready ? 'ready-awaiting-operator-approval' : 'blocked';

  return {
    nativeContract: 'PostAbsorptionPublishCreateAndStabilityGate/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'publish-create-stability-gate-ready' : 'blocked',
    status: ready ? 'publish-create-stability-gate-ready' : 'blocked',
    expectedStates: expectedStates(),
    publishGate: publishGate(publishDecision),
    npmCreateZavorthGate: npmCreateZavorthGate(),
    heavyShardStability: heavyShardStability(),
    limitedProductionSend: limitedProductionSend(),
    rawSqliteImporter: rawSqliteImporter(),
    adapterRetirement: adapterRetirement(),
    monitoringPolish: monitoringPolish(),
    validationChecks: validationChecks(),
    executionGate: executionGate(publishDecision),
    redaction: {
      rawSecretSerialized: false,
      rawContentSerialized: false,
      packageSecretsIncluded: false,
      publicSourceIdentityExposed: false,
      receiptsRedacted: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    terminalGate: 'do-not-advance-beyond-263-without-operator-decision',
  };
}

export function createPostAbsorptionPublishCreateAndStabilityGateFixture(
  overrides: Partial<PostAbsorptionPublishCreateAndStabilitySource> = {},
): PostAbsorptionPublishCreateAndStabilityGate {
  return new PostAbsorptionPublishCreateAndStabilityGate(
    normalizePostAbsorptionPublishCreateAndStabilityGate({
      generatedAt: POST_ABSORPTION_PUBLISH_CREATE_AND_STABILITY_GATE_NOW,
      runtimeId: POST_ABSORPTION_PUBLISH_CREATE_AND_STABILITY_GATE_RUNTIME_ID,
      source: createPostAbsorptionPublishCreateAndStabilitySource(overrides),
    }),
  );
}
