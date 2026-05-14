import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4A_MIGRATED_METADATA_BATCH_LOAD_VERIFY_PARITY_RUNTIME_ID,
  createZavorthWave4AMigratedMetadataBatchLoadVerifyParityFixture,
} from './ZavorthWave4AMigratedMetadataBatchLoadVerifyParity.js';
import {
  ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE,
  ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE_URI,
} from './ZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatch.js';
import {
  ZAVORTH_WAVE4B_METADATA_VALIDATION_EXECUTE_FLAG,
} from './ZavorthWave4BLowRiskExecutableCapabilitySelection.js';
import type {
  ZavorthWave4AFirstBatchMigratedRecord,
  ZavorthWave4AFirstBatchMigrationManifest,
} from './ZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatch.js';
import type {
  ZavorthWave4AMigrationDataClass,
} from './ZavorthWave4AControlledMetadataConfigRegistryMigrationPlan.js';
import type {
  ZavorthWave4AMigratedMetadataParityReceipt,
} from './ZavorthWave4AMigratedMetadataBatchLoadVerifyParity.js';

export const ZAVORTH_WAVE4B_FIRST_LOW_RISK_METADATA_VALIDATION_EXECUTABLE_NOW = '2026-04-30T10:00:00.000Z' as const;
export const ZAVORTH_WAVE4B_FIRST_LOW_RISK_METADATA_VALIDATION_EXECUTABLE_RUNTIME_ID = 'zavorth-wave4b-first-low-risk-metadata-validation-executable' as const;

export type ZavorthWave4BMetadataValidationDecision =
  | 'execution-blocked'
  | 'validation-corrupt'
  | 'validation-degraded'
  | 'validation-ok'
  | 'validation-rejected';

export type ZavorthWave4BMetadataValidationStatus =
  | 'backup-rollback-missing'
  | 'checksum-invalid'
  | 'feature-flag-disabled'
  | 'forbidden-raw-data-detected'
  | 'high-impact-execution-attempted'
  | 'idempotency-invalid'
  | 'manifest-missing'
  | 'external-executor-touch-attempted'
  | 'policy-invalid'
  | 'record-missing'
  | 'redaction-invalid'
  | 'schema-invalid'
  | 'scope-invalid'
  | 'source-not-ready'
  | 'valid';

export type ZavorthWave4BMetadataValidationFeatureFlagGate = {
  nativeContract: 'ZavorthWave4BMetadataValidationFeatureFlagGate/v1';
  flagName: typeof ZAVORTH_WAVE4B_METADATA_VALIDATION_EXECUTE_FLAG;
  enabled: boolean;
  safetyGate: 'controlled-production' | 'controlled-test';
  operatorAcknowledgedZavorthOwnedStorage: boolean;
  metadataValidationFeatureFlagRequired: true;
};

export type ZavorthWave4BMetadataValidationSource = {
  lowRiskExecutableSelectionReady: true;
  selectedLowRiskCapability: 'metadata-validation-action';
  wave4aFirstBatchReady: true;
  wave4aLoadVerifyParityReady: true;
  wave4aMilestoneReady: true;
  actionGovernancePipelineReady: true;
  nativeRegistriesReady: true;
  persistenceRestoreReady: true;
  hardeningDecommissionReady: true;
  runtimeExternalExecutorRequiredForExecution: false;
  externalExecutorTouched: false;
  highImpactExecutionAttempted: false;
  messageSendAttempted: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  externalExecutorMutationAttempted: false;
  stateMigrationAttempted: false;
  sourceModuleCopyAttempted: false;
  adapterRemovalAttempted: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4BMetadataValidationDetail = {
  nativeContract: 'ZavorthWave4BMetadataValidationDetail/v1';
  validation:
    | 'checksum'
    | 'forbidden-raw-data-absence'
    | 'idempotency'
    | 'migration-scope'
    | 'policy-decision'
    | 'redaction-envelope'
    | 'registry-view-reconstruction'
    | 'schema-version';
  status: 'blocked' | 'failed' | 'passed';
  reason: string;
};

export type ZavorthWave4BMetadataValidationReceipt = {
  nativeContract: 'ZavorthWave4BMetadataValidationExecutableReceipt/v1';
  runtimeId: typeof ZAVORTH_WAVE4B_FIRST_LOW_RISK_METADATA_VALIDATION_EXECUTABLE_RUNTIME_ID;
  generatedAt: string;
  selectedLowRiskCapability: 'metadata-validation-action';
  migrationRoot: string;
  migrationNamespace: typeof ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE;
  migrationNamespaceUri: typeof ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE_URI;
  sourceLoadVerifyRuntimeId: typeof ZAVORTH_WAVE4A_MIGRATED_METADATA_BATCH_LOAD_VERIFY_PARITY_RUNTIME_ID;
  decision: ZavorthWave4BMetadataValidationDecision;
  classification: ZavorthWave4BMetadataValidationDecision;
  validations: ZavorthWave4BMetadataValidationStatus[];
  validationDetails: ZavorthWave4BMetadataValidationDetail[];
  featureFlag: ZavorthWave4BMetadataValidationFeatureFlagGate;
  idempotencyKey: string;
  manifestRecordCount: number;
  loadedRecordCount: number;
  registryViewReconstructionReady: boolean;
  forbiddenRawDataAbsent: boolean;
  parityReceipt?: ZavorthWave4AMigratedMetadataParityReceipt;
  cleanupReceipt?: ZavorthWave4BMetadataValidationCleanupReceipt;
  wave4bMetadataValidationExecutableCreated: true;
  selectedLowRiskCapabilityConfirmed: 'metadata-validation-action';
  metadataValidationActuallyExecuted: boolean;
  metadataValidationActuallyExecutedOnlyWhenFlagEnabled: true;
  runtimeExternalExecutorRequiredForExecution: false;
  externalExecutorTouched: false;
  highImpactExecutionBlocked: true;
  messageSendRealAllowed: false;
  providerExecutionRealAllowed: false;
  toolCommandExecutionRealAllowed: false;
  externalExecutorMutationAllowed: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  rawSecretSerialized: false;
  adapterRemovalGlobalAllowed: false;
};

export type ZavorthWave4BMetadataValidationCleanupReceipt = {
  nativeContract: 'ZavorthWave4BMetadataValidationCleanupReceipt/v1';
  migrationRoot: string;
  cleanupActuallyPerformed: boolean;
  namespaceExistsAfterCleanup: boolean;
  cleanupLimitedToControlledTestNamespace: true;
  externalExecutorTouched: false;
  sourceFileCopied: false;
  sourceDbCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4BMetadataValidationExecutableOptions = {
  migrationRoot: string;
  featureFlag: ZavorthWave4BMetadataValidationFeatureFlagGate;
  generatedAt?: string;
};

const FORBIDDEN_DATA_CLASSES = new Set<ZavorthWave4AMigrationDataClass>([
  'cache-raw',
  'execution-state-mutable',
  'logs-raw',
  'message-content',
  'raw-secrets',
  'session-history-raw',
  'sqlite-real',
  'workspace-files',
]);

const FORBIDDEN_PAYLOAD_KEYS = new Set([
  'rawCacheEntry',
  'rawLogLine',
  'rawMessageContent',
  'rawSecretValue',
  'sqlitePayload',
  'workspaceFileBody',
]);

const RAW_SECRET_PATTERNS = [
  /EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/,
  /(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/,
  /ghp_[A-Za-z0-9_]{8,}/,
  /xox[baprs]-[A-Za-z0-9-]{8,}/,
  /synthetic-raw-credential-sentinel-that-must-not-appear/,
];

function assertMigrationRoot(migrationRoot: string): string {
  const resolved = path.resolve(migrationRoot);
  const cwd = path.resolve(process.cwd());

  if (!resolved.startsWith(`${cwd}${path.sep}`)) {
    throw new Error(`Metadata validation root must stay inside workspace: ${resolved}`);
  }
  if (!resolved.includes(`${path.sep}.tmp${path.sep}`) && !resolved.includes(`${path.sep}.zavorth${path.sep}`)) {
    throw new Error(`Metadata validation root must live under .tmp or .zavorth: ${resolved}`);
  }
  if (path.basename(resolved) !== ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE) {
    throw new Error(`Metadata validation root must end with ${ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE}: ${resolved}`);
  }

  return resolved;
}

function readJson<TValue>(filePath: string): TValue | undefined {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as TValue;
  } catch {
    return undefined;
  }
}

function hasForbiddenPayloadKey(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'string' && RAW_SECRET_PATTERNS.some((pattern) => pattern.test(value));
  }
  if (Array.isArray(value)) {
    return value.some(hasForbiddenPayloadKey);
  }

  return Object.entries(value as Record<string, unknown>).some(([key, child]) => (
    FORBIDDEN_PAYLOAD_KEYS.has(key) || hasForbiddenPayloadKey(child)
  ));
}

function unique<TValue>(values: TValue[]): TValue[] {
  return Array.from(new Set(values));
}

function sourceStatuses(source: ZavorthWave4BMetadataValidationSource): ZavorthWave4BMetadataValidationStatus[] {
  const statuses: ZavorthWave4BMetadataValidationStatus[] = [];

  if (!source.lowRiskExecutableSelectionReady ||
    source.selectedLowRiskCapability !== 'metadata-validation-action' ||
    !source.wave4aFirstBatchReady ||
    !source.wave4aLoadVerifyParityReady ||
    !source.wave4aMilestoneReady ||
    !source.actionGovernancePipelineReady ||
    !source.nativeRegistriesReady ||
    !source.persistenceRestoreReady ||
    !source.hardeningDecommissionReady ||
    source.runtimeExternalExecutorRequiredForExecution ||
    source.rawSecretSerialized ||
    source.publicExternalExecutorIdentityExposed) {
    statuses.push('source-not-ready');
  }
  if (source.externalExecutorTouched || source.externalExecutorMutationAttempted) {
    statuses.push('external-executor-touch-attempted');
  }
  if (source.highImpactExecutionAttempted || source.messageSendAttempted ||
    source.providerExecutionAttempted || source.toolCommandExecutionAttempted) {
    statuses.push('high-impact-execution-attempted');
  }
  if (source.stateMigrationAttempted || source.sourceModuleCopyAttempted || source.adapterRemovalAttempted) {
    statuses.push('source-not-ready');
  }

  return statuses;
}

function loadRecords(migrationRoot: string): {
  forbiddenRawDataDetected: boolean;
  manifest?: ZavorthWave4AFirstBatchMigrationManifest;
  records: ZavorthWave4AFirstBatchMigratedRecord[];
} {
  const manifest = readJson<ZavorthWave4AFirstBatchMigrationManifest>(path.join(migrationRoot, 'manifest.json'));
  const records = (manifest?.records ?? [])
    .map((entry) => readJson<ZavorthWave4AFirstBatchMigratedRecord>(path.join(migrationRoot, entry.relativePath)))
    .filter((record): record is ZavorthWave4AFirstBatchMigratedRecord => Boolean(record));
  const forbiddenRawDataDetected = records.some((record) => (
    FORBIDDEN_DATA_CLASSES.has(record.dataClass) ||
    record.payloadSensitiveFieldsPersisted ||
    record.rawSecretSerialized ||
    hasForbiddenPayloadKey(record)
  ));

  return { forbiddenRawDataDetected, manifest, records };
}

function mapParityValidations(
  parity: ZavorthWave4AMigratedMetadataParityReceipt,
  forbiddenRawDataDetected: boolean,
): ZavorthWave4BMetadataValidationStatus[] {
  const mapped = parity.validations
    .filter((status) => status !== 'valid')
    .map((status): ZavorthWave4BMetadataValidationStatus => {
      if (status === 'policy-invalid') {
        return 'policy-invalid';
      }
      return status;
    });

  if (forbiddenRawDataDetected) {
    mapped.push('forbidden-raw-data-detected', 'scope-invalid');
  }

  return mapped.length === 0 ? ['valid'] : unique(mapped);
}

function classify(validations: ZavorthWave4BMetadataValidationStatus[]): ZavorthWave4BMetadataValidationDecision {
  if (validations.includes('feature-flag-disabled')) {
    return 'execution-blocked';
  }
  if (validations.includes('checksum-invalid') ||
    validations.includes('idempotency-invalid') ||
    validations.includes('schema-invalid')) {
    return 'validation-corrupt';
  }
  if (validations.includes('forbidden-raw-data-detected') ||
    validations.includes('high-impact-execution-attempted') ||
    validations.includes('external-executor-touch-attempted') ||
    validations.includes('policy-invalid') ||
    validations.includes('redaction-invalid') ||
    validations.includes('scope-invalid')) {
    return 'validation-rejected';
  }
  if (validations.includes('backup-rollback-missing') ||
    validations.includes('manifest-missing') ||
    validations.includes('record-missing') ||
    validations.includes('source-not-ready')) {
    return 'validation-degraded';
  }
  return 'validation-ok';
}

function details(
  validations: ZavorthWave4BMetadataValidationStatus[],
  registryViewReconstructionReady: boolean,
  forbiddenRawDataAbsent: boolean,
): ZavorthWave4BMetadataValidationDetail[] {
  const statusFor = (failed: ZavorthWave4BMetadataValidationStatus[]): 'failed' | 'passed' => (
    failed.some((status) => validations.includes(status)) ? 'failed' : 'passed'
  );

  return [
    {
      nativeContract: 'ZavorthWave4BMetadataValidationDetail/v1',
      validation: 'schema-version',
      status: statusFor(['schema-invalid']),
      reason: 'Schema/version metadata must match the Wave 4A migration schema.',
    },
    {
      nativeContract: 'ZavorthWave4BMetadataValidationDetail/v1',
      validation: 'checksum',
      status: statusFor(['checksum-invalid']),
      reason: 'Checksum must match the stable metadata checksum recorded by the Wave 4A batch.',
    },
    {
      nativeContract: 'ZavorthWave4BMetadataValidationDetail/v1',
      validation: 'idempotency',
      status: statusFor(['idempotency-invalid']),
      reason: 'Idempotency keys must match the migrated metadata item identity.',
    },
    {
      nativeContract: 'ZavorthWave4BMetadataValidationDetail/v1',
      validation: 'redaction-envelope',
      status: statusFor(['redaction-invalid', 'forbidden-raw-data-detected']),
      reason: 'Raw secrets, raw messages, SQLite payloads, workspace bodies, raw logs, and raw cache entries must be absent.',
    },
    {
      nativeContract: 'ZavorthWave4BMetadataValidationDetail/v1',
      validation: 'policy-decision',
      status: statusFor(['policy-invalid', 'high-impact-execution-attempted', 'external-executor-touch-attempted']),
      reason: 'Only the metadata/config/registry-only policy is executable in this gate.',
    },
    {
      nativeContract: 'ZavorthWave4BMetadataValidationDetail/v1',
      validation: 'migration-scope',
      status: statusFor(['scope-invalid']),
      reason: 'Wave 4B validation accepts only metadata/config/registry-level data.',
    },
    {
      nativeContract: 'ZavorthWave4BMetadataValidationDetail/v1',
      validation: 'forbidden-raw-data-absence',
      status: forbiddenRawDataAbsent ? 'passed' : 'failed',
      reason: 'Forbidden raw data classes and payload keys must not appear in persisted metadata.',
    },
    {
      nativeContract: 'ZavorthWave4BMetadataValidationDetail/v1',
      validation: 'registry-view-reconstruction',
      status: registryViewReconstructionReady ? 'passed' : 'failed',
      reason: 'Validated metadata must reconstruct registry/view projections for native consumers.',
    },
  ];
}

function blockedReceipt(input: {
  featureFlag: ZavorthWave4BMetadataValidationFeatureFlagGate;
  generatedAt: string;
  migrationRoot: string;
}): ZavorthWave4BMetadataValidationReceipt {
  return {
    nativeContract: 'ZavorthWave4BMetadataValidationExecutableReceipt/v1',
    runtimeId: ZAVORTH_WAVE4B_FIRST_LOW_RISK_METADATA_VALIDATION_EXECUTABLE_RUNTIME_ID,
    generatedAt: input.generatedAt,
    selectedLowRiskCapability: 'metadata-validation-action',
    migrationRoot: input.migrationRoot,
    migrationNamespace: ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE,
    migrationNamespaceUri: ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE_URI,
    sourceLoadVerifyRuntimeId: ZAVORTH_WAVE4A_MIGRATED_METADATA_BATCH_LOAD_VERIFY_PARITY_RUNTIME_ID,
    decision: 'execution-blocked',
    classification: 'execution-blocked',
    validations: ['feature-flag-disabled'],
    validationDetails: details(['feature-flag-disabled'], false, true).map((detail) => ({
      ...detail,
      status: 'blocked' as const,
    })),
    featureFlag: input.featureFlag,
    idempotencyKey: 'wave4b:metadata-validation-action:zavorth-wave4a-metadata-config-registry-migration',
    manifestRecordCount: 0,
    loadedRecordCount: 0,
    registryViewReconstructionReady: false,
    forbiddenRawDataAbsent: true,
    wave4bMetadataValidationExecutableCreated: true,
    selectedLowRiskCapabilityConfirmed: 'metadata-validation-action',
    metadataValidationActuallyExecuted: false,
    metadataValidationActuallyExecutedOnlyWhenFlagEnabled: true,
    runtimeExternalExecutorRequiredForExecution: false,
    externalExecutorTouched: false,
    highImpactExecutionBlocked: true,
    messageSendRealAllowed: false,
    providerExecutionRealAllowed: false,
    toolCommandExecutionRealAllowed: false,
    externalExecutorMutationAllowed: false,
    stateMigrated: false,
    sourceModuleCopied: false,
    rawSecretSerialized: false,
    adapterRemovalGlobalAllowed: false,
  };
}

export class ZavorthWave4BFirstLowRiskMetadataValidationExecutable {
  public constructor(private readonly source: ZavorthWave4BMetadataValidationSource) {}

  public execute(options: ZavorthWave4BMetadataValidationExecutableOptions): ZavorthWave4BMetadataValidationReceipt {
    const migrationRoot = assertMigrationRoot(options.migrationRoot);
    const generatedAt = options.generatedAt ?? ZAVORTH_WAVE4B_FIRST_LOW_RISK_METADATA_VALIDATION_EXECUTABLE_NOW;

    if (!options.featureFlag.enabled) {
      return blockedReceipt({
        featureFlag: options.featureFlag,
        generatedAt,
        migrationRoot,
      });
    }

    const parityReceipt = createZavorthWave4AMigratedMetadataBatchLoadVerifyParityFixture().loadVerify({
      generatedAt,
      migrationRoot,
    });
    const loaded = loadRecords(migrationRoot);
    const sourceValidationStatuses = sourceStatuses(this.source);
    const parityValidationStatuses = mapParityValidations(parityReceipt, loaded.forbiddenRawDataDetected);
    const validations = unique([
      ...sourceValidationStatuses,
      ...parityValidationStatuses.filter((status) => status !== 'valid'),
    ]);
    const finalValidations = validations.length === 0 ? ['valid' as const] : validations;
    const forbiddenRawDataAbsent = !loaded.forbiddenRawDataDetected;
    const registryViewReconstructionReady = (
      parityReceipt.registryViews.length > 0 &&
      parityReceipt.consumerProjections.length === 4 &&
      !finalValidations.includes('manifest-missing') &&
      !finalValidations.includes('record-missing') &&
      !finalValidations.includes('scope-invalid')
    );
    const decision = classify(finalValidations);

    return {
      nativeContract: 'ZavorthWave4BMetadataValidationExecutableReceipt/v1',
      runtimeId: ZAVORTH_WAVE4B_FIRST_LOW_RISK_METADATA_VALIDATION_EXECUTABLE_RUNTIME_ID,
      generatedAt,
      selectedLowRiskCapability: 'metadata-validation-action',
      migrationRoot,
      migrationNamespace: ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE,
      migrationNamespaceUri: ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE_URI,
      sourceLoadVerifyRuntimeId: ZAVORTH_WAVE4A_MIGRATED_METADATA_BATCH_LOAD_VERIFY_PARITY_RUNTIME_ID,
      decision,
      classification: decision,
      validations: finalValidations,
      validationDetails: details(finalValidations, registryViewReconstructionReady, forbiddenRawDataAbsent),
      featureFlag: options.featureFlag,
      idempotencyKey: 'wave4b:metadata-validation-action:zavorth-wave4a-metadata-config-registry-migration',
      manifestRecordCount: parityReceipt.manifestRecordCount,
      loadedRecordCount: parityReceipt.loadedRecordCount,
      registryViewReconstructionReady,
      forbiddenRawDataAbsent,
      parityReceipt,
      wave4bMetadataValidationExecutableCreated: true,
      selectedLowRiskCapabilityConfirmed: 'metadata-validation-action',
      metadataValidationActuallyExecuted: true,
      metadataValidationActuallyExecutedOnlyWhenFlagEnabled: true,
      runtimeExternalExecutorRequiredForExecution: false,
      externalExecutorTouched: false,
      highImpactExecutionBlocked: true,
      messageSendRealAllowed: false,
      providerExecutionRealAllowed: false,
      toolCommandExecutionRealAllowed: false,
      externalExecutorMutationAllowed: false,
      stateMigrated: false,
      sourceModuleCopied: false,
      rawSecretSerialized: false,
      adapterRemovalGlobalAllowed: false,
    };
  }

  public cleanup(migrationRoot: string): ZavorthWave4BMetadataValidationCleanupReceipt {
    const cleanup = createZavorthWave4AMigratedMetadataBatchLoadVerifyParityFixture().cleanup(migrationRoot);

    return {
      nativeContract: 'ZavorthWave4BMetadataValidationCleanupReceipt/v1',
      migrationRoot: cleanup.migrationRoot,
      cleanupActuallyPerformed: cleanup.cleanupActuallyPerformed,
      namespaceExistsAfterCleanup: cleanup.namespaceExistsAfterCleanup,
      cleanupLimitedToControlledTestNamespace: true,
      externalExecutorTouched: false,
      sourceFileCopied: false,
      sourceDbCopied: false,
      rawSecretSerialized: false,
    };
  }
}

export function createZavorthWave4BMetadataValidationFeatureFlag(
  enabled: boolean,
): ZavorthWave4BMetadataValidationFeatureFlagGate {
  return {
    nativeContract: 'ZavorthWave4BMetadataValidationFeatureFlagGate/v1',
    flagName: ZAVORTH_WAVE4B_METADATA_VALIDATION_EXECUTE_FLAG,
    enabled,
    safetyGate: 'controlled-test',
    operatorAcknowledgedZavorthOwnedStorage: true,
    metadataValidationFeatureFlagRequired: true,
  };
}

export function createZavorthWave4BMetadataValidationExecutableFixtureSource(
  overrides: Partial<ZavorthWave4BMetadataValidationSource> = {},
): ZavorthWave4BMetadataValidationSource {
  return {
    lowRiskExecutableSelectionReady: true,
    selectedLowRiskCapability: 'metadata-validation-action',
    wave4aFirstBatchReady: true,
    wave4aLoadVerifyParityReady: true,
    wave4aMilestoneReady: true,
    actionGovernancePipelineReady: true,
    nativeRegistriesReady: true,
    persistenceRestoreReady: true,
    hardeningDecommissionReady: true,
    runtimeExternalExecutorRequiredForExecution: false,
    externalExecutorTouched: false,
    highImpactExecutionAttempted: false,
    messageSendAttempted: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    externalExecutorMutationAttempted: false,
    stateMigrationAttempted: false,
    sourceModuleCopyAttempted: false,
    adapterRemovalAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    rawSecretSerialized: false,
    ...overrides,
  };
}

export function createZavorthWave4BFirstLowRiskMetadataValidationExecutableFixture(
  source: ZavorthWave4BMetadataValidationSource = createZavorthWave4BMetadataValidationExecutableFixtureSource(),
): ZavorthWave4BFirstLowRiskMetadataValidationExecutable {
  return new ZavorthWave4BFirstLowRiskMetadataValidationExecutable(source);
}
