import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4A_METADATA_MIGRATION_SCHEMA_VERSION,
  normalizeZavorthWave4AControlledMetadataConfigRegistryMigrationPlanFixture,
} from './ZavorthWave4AControlledMetadataConfigRegistryMigrationPlan.js';
import type {
  ZavorthWave4AControlledMigrationNormalization,
  ZavorthWave4AMigrationBackupRollback,
  ZavorthWave4AMigrationDataClass,
  ZavorthWave4AMigrationPlanItem,
  ZavorthWave4AMigrationRedactionEnvelope,
  ZavorthWave4AMigrationTarget,
} from './ZavorthWave4AControlledMetadataConfigRegistryMigrationPlan.js';

export const ZAVORTH_WAVE4A_FIRST_CONTROLLED_METADATA_CONFIG_REGISTRY_MIGRATION_BATCH_NOW = '2026-04-29T17:00:00.000Z' as const;
export const ZAVORTH_WAVE4A_FIRST_CONTROLLED_METADATA_CONFIG_REGISTRY_MIGRATION_BATCH_RUNTIME_ID = 'zavorth-wave4a-first-controlled-metadata-config-registry-migration-batch' as const;
export const ZAVORTH_WAVE4A_METADATA_MIGRATION_WRITE_FLAG = 'ZAVORTH_WAVE4A_METADATA_MIGRATION_WRITE' as const;
export const ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE = 'zavorth-wave4a-metadata-config-registry-migration' as const;
export const ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE_URI = 'zavorth://wave4a/metadata-config-registry-migration' as const;

export type ZavorthWave4AFirstBatchMigrationDecision =
  | 'blocked'
  | 'migration-write-blocked'
  | 'wave4a-first-batch-migration-ready';

export type ZavorthWave4AFirstBatchMigrationValidationStatus =
  | 'checksum-invalid'
  | 'feature-flag-disabled'
  | 'idempotency-invalid'
  | 'policy-blocked'
  | 'redaction-invalid'
  | 'schema-invalid'
  | 'scope-invalid'
  | 'source-not-ready'
  | 'valid';

export type ZavorthWave4AFirstBatchMigrationWriteStatus =
  | 'already-present'
  | 'checksum-conflict'
  | 'written';

export type ZavorthWave4AFirstBatchMigrationFeatureFlagGate = {
  nativeContract: 'ZavorthWave4AFirstBatchMigrationFeatureFlagGate/v1';
  flagName: typeof ZAVORTH_WAVE4A_METADATA_MIGRATION_WRITE_FLAG;
  enabled: boolean;
  safetyGate: 'controlled-production' | 'controlled-test';
  operatorAcknowledgedZavorthOwnedNamespace: boolean;
  migrationWriteFeatureFlagRequired: true;
};

export type ZavorthWave4AFirstBatchMigratedRecord = {
  nativeContract: 'ZavorthWave4AFirstBatchMigratedRecord/v1';
  migrationNamespace: typeof ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE;
  migrationNamespaceUri: typeof ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE_URI;
  migratedAt: string;
  itemId: string;
  sourceInventoryItem: string;
  dataClass: ZavorthWave4AMigrationDataClass;
  target: ZavorthWave4AMigrationTarget;
  schemaVersion: typeof ZAVORTH_WAVE4A_METADATA_MIGRATION_SCHEMA_VERSION;
  idempotencyKey: string;
  checksumAlgorithm: 'sha256-stable-metadata';
  checksum: string;
  redactionEnvelope: ZavorthWave4AMigrationRedactionEnvelope;
  backupRollback: ZavorthWave4AMigrationBackupRollback;
  policyDecision: 'allow-metadata-config-registry-only';
  payloadKind: 'metadata-config-registry-only';
  payloadSensitiveFieldsPersisted: false;
  provenance: {
    internalOnly: true;
    redacted: true;
    sourceRuntimeAuthority: false;
    sourceRuntimePublicIdentity: false;
  };
  sourceRuntimeAuthority: false;
  runtimeExternalExecutorRequiredForMigration: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4AFirstBatchMigrationWriteReceipt = {
  nativeContract: 'ZavorthWave4AFirstBatchMigrationWriteReceipt/v1';
  itemId: string;
  dataClass: ZavorthWave4AMigrationDataClass;
  idempotencyKey: string;
  checksum: string;
  relativePath: string;
  status: ZavorthWave4AFirstBatchMigrationWriteStatus;
  bytesWritten: number;
  atomicWriteUsed: true;
  metadataConfigRegistryMigrationActuallyPerformed: boolean;
  rawSecretSerialized: false;
};

export type ZavorthWave4AFirstBatchMigrationManifest = {
  nativeContract: 'ZavorthWave4AFirstBatchMigrationManifest/v1';
  migrationNamespace: typeof ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE;
  migrationNamespaceUri: typeof ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE_URI;
  migratedAt: string;
  schemaVersion: typeof ZAVORTH_WAVE4A_METADATA_MIGRATION_SCHEMA_VERSION;
  batchId: 'wave4a-metadata-config-registry-batch-001';
  recordCount: number;
  records: Array<{
    itemId: string;
    dataClass: ZavorthWave4AMigrationDataClass;
    idempotencyKey: string;
    checksum: string;
    relativePath: string;
    status: ZavorthWave4AFirstBatchMigrationWriteStatus;
  }>;
  backupRollbackMetadataCreated: true;
  runtimeExternalExecutorRequiredForMigration: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4AFirstBatchMigrationBackupRollbackManifest = {
  nativeContract: 'ZavorthWave4AFirstBatchMigrationBackupRollbackManifest/v1';
  migrationNamespace: typeof ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE;
  migratedAt: string;
  manifestPath: string;
  restoreManifestPath: string;
  rollbackReceiptPath: string;
  backupRollbackMetadataCreated: true;
  backupActuallyCreated: false;
  restoreActuallyPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4AFirstBatchMigrationReceipt = {
  nativeContract: 'ZavorthWave4AFirstBatchMigrationReceipt/v1';
  runtimeId: typeof ZAVORTH_WAVE4A_FIRST_CONTROLLED_METADATA_CONFIG_REGISTRY_MIGRATION_BATCH_RUNTIME_ID;
  decision: ZavorthWave4AFirstBatchMigrationDecision;
  migratedAt: string;
  migrationRoot: string;
  migrationNamespace: typeof ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE;
  migrationNamespaceUri: typeof ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE_URI;
  featureFlag: ZavorthWave4AFirstBatchMigrationFeatureFlagGate;
  validations: ZavorthWave4AFirstBatchMigrationValidationStatus[];
  recordWrites: ZavorthWave4AFirstBatchMigrationWriteReceipt[];
  manifestPath: string;
  backupRollbackManifestPath: string;
  idempotencyAvoidedDuplicateWrites: boolean;
  wave4aFirstBatchMigrationCreated: true;
  migrationWriteFeatureFlagRequired: true;
  metadataConfigRegistryMigrationActuallyPerformedOnlyWhenFlagEnabled: true;
  migrationScopeMetadataConfigRegistryOnly: true;
  backupRollbackMetadataCreated: boolean;
  rawSecretMigrationAllowed: false;
  sessionHistoryRawMigrationAllowed: false;
  sqliteRealMigrationAllowed: false;
  workspaceMigrationAllowed: false;
  logsRawMigrationAllowed: false;
  cacheRawMigrationAllowed: false;
  executionStateMigrationAllowed: false;
  sourceRuntimeAuthority: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4AFirstBatchMigrationCleanupReceipt = {
  nativeContract: 'ZavorthWave4AFirstBatchMigrationCleanupReceipt/v1';
  migrationRoot: string;
  cleanupActuallyPerformed: boolean;
  namespaceExistsAfterCleanup: boolean;
  cleanupLimitedToControlledTestNamespace: true;
  sourceFileCopied: false;
  sourceDbCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4AFirstBatchMigrationSource = {
  migrationPlan: ZavorthWave4AControlledMigrationNormalization;
  externalExecutorLiveRequiredForMigration: false;
  rawSecretMigrationAttempted: false;
  sessionHistoryRawMigrationAttempted: false;
  sqliteRealMigrationAttempted: false;
  workspaceMigrationAttempted: false;
  logsRawMigrationAttempted: false;
  cacheRawMigrationAttempted: false;
  executionStateMigrationAttempted: false;
  messageSendAttempted: false;
  providerExecutionAttempted: false;
  commandExecutionAttempted: false;
  toolExecutionAttempted: false;
  sourceModuleCopyAttempted: false;
  adapterRemovalAttempted: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4AFirstBatchMigrationOptions = {
  migrationRoot: string;
  featureFlag: ZavorthWave4AFirstBatchMigrationFeatureFlagGate;
  migratedAt?: string;
};

const ALLOWED_DATA_CLASSES = new Set<ZavorthWave4AMigrationDataClass>([
  'backup-rollback-metadata',
  'capability-metadata',
  'config-metadata-redacted',
  'plugin-metadata-redacted',
  'provider-channel-transport-metadata',
  'registry-metadata',
  'secretref-metadata',
]);

function assertMigrationRoot(migrationRoot: string): string {
  const resolved = path.resolve(migrationRoot);
  const cwd = path.resolve(process.cwd());

  if (!resolved.startsWith(`${cwd}${path.sep}`)) {
    throw new Error(`Migration root must stay inside workspace: ${resolved}`);
  }
  if (!resolved.includes(`${path.sep}.tmp${path.sep}`) && !resolved.includes(`${path.sep}.zavorth${path.sep}`)) {
    throw new Error(`Migration root must live under .tmp or .zavorth: ${resolved}`);
  }
  if (path.basename(resolved) !== ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE) {
    throw new Error(`Migration root must end with ${ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE}: ${resolved}`);
  }

  return resolved;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}

function expectedChecksumForPlanItem(item: ZavorthWave4AMigrationPlanItem): string {
  return createHash('sha256')
    .update(stableStringify({
      dataClass: item.dataClass,
      itemId: item.itemId,
      schemaVersion: item.schemaVersion,
      sourceInventoryItem: item.sourceInventoryItem,
      target: item.target,
    }))
    .digest('hex');
}

function relativePathForItem(item: ZavorthWave4AMigrationPlanItem): string {
  return path.join('metadata-config-registry', item.dataClass, `${item.itemId}.json`);
}

function readJson<TValue>(filePath: string): TValue | undefined {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as TValue;
  } catch {
    return undefined;
  }
}

function redactionEnvelopeValid(envelope: ZavorthWave4AMigrationRedactionEnvelope): boolean {
  return (
    envelope.nativeContract === 'ZavorthWave4AMigrationRedactionEnvelope/v1' &&
    envelope.rawSecretSerialized === false &&
    envelope.rawMessageContentSerialized === false &&
    envelope.sourceIdentityPublic === false &&
    envelope.provenanceInternalOnly === true &&
    envelope.safeMetadataOnly === true &&
    envelope.forbiddenFields.includes('rawSecretValue') &&
    envelope.forbiddenFields.includes('rawMessageContent') &&
    envelope.forbiddenFields.includes('sqlitePayload') &&
    envelope.forbiddenFields.includes('rawLogLine') &&
    envelope.forbiddenFields.includes('rawCacheEntry')
  );
}

function sourceValid(source: ZavorthWave4AFirstBatchMigrationSource): ZavorthWave4AFirstBatchMigrationValidationStatus[] {
  const statuses: ZavorthWave4AFirstBatchMigrationValidationStatus[] = [];
  const batchItemIds = new Set(source.migrationPlan.firstBatch.itemIds);
  const batchItems = source.migrationPlan.planItems.filter((item) => batchItemIds.has(item.itemId));

  if (source.migrationPlan.decision !== 'wave4a-controlled-migration-plan-ready' ||
    !source.migrationPlan.firstBatch.prepared ||
    source.migrationPlan.firstBatch.executed ||
    batchItems.length !== source.migrationPlan.firstBatch.itemCount) {
    statuses.push('source-not-ready');
  }
  if (source.rawSecretSerialized) {
    statuses.push('redaction-invalid');
  }
  if (source.externalExecutorLiveRequiredForMigration || source.rawSecretMigrationAttempted ||
    source.sessionHistoryRawMigrationAttempted || source.sqliteRealMigrationAttempted ||
    source.workspaceMigrationAttempted || source.logsRawMigrationAttempted || source.cacheRawMigrationAttempted ||
    source.executionStateMigrationAttempted || source.messageSendAttempted || source.providerExecutionAttempted ||
    source.commandExecutionAttempted || source.toolExecutionAttempted || source.sourceModuleCopyAttempted ||
    source.adapterRemovalAttempted || source.publicExternalExecutorIdentityExposed) {
    statuses.push('source-not-ready');
  }
  if (batchItems.some((item) => item.schemaVersion !== ZAVORTH_WAVE4A_METADATA_MIGRATION_SCHEMA_VERSION)) {
    statuses.push('schema-invalid');
  }
  if (batchItems.some((item) => !redactionEnvelopeValid(item.redactionEnvelope))) {
    statuses.push('redaction-invalid');
  }
  if (batchItems.some((item) => item.checksum !== expectedChecksumForPlanItem(item) || item.checksum.length !== 64)) {
    statuses.push('checksum-invalid');
  }
  if (batchItems.some((item) => item.idempotencyKey !== `wave4a:${item.dataClass}:${item.itemId}`)) {
    statuses.push('idempotency-invalid');
  }
  if (batchItems.some((item) => item.policyDecision !== 'allow-metadata-config-registry-only' || item.eligibility !== 'eligible-controlled-batch')) {
    statuses.push('policy-blocked');
  }
  if (batchItems.some((item) => !ALLOWED_DATA_CLASSES.has(item.dataClass) || item.target === 'blocked-no-target')) {
    statuses.push('scope-invalid');
  }

  return statuses;
}

function migratedRecord(item: ZavorthWave4AMigrationPlanItem, migratedAt: string): ZavorthWave4AFirstBatchMigratedRecord {
  return {
    nativeContract: 'ZavorthWave4AFirstBatchMigratedRecord/v1',
    migrationNamespace: ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE,
    migrationNamespaceUri: ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE_URI,
    migratedAt,
    itemId: item.itemId,
    sourceInventoryItem: item.sourceInventoryItem,
    dataClass: item.dataClass,
    target: item.target,
    schemaVersion: ZAVORTH_WAVE4A_METADATA_MIGRATION_SCHEMA_VERSION,
    idempotencyKey: item.idempotencyKey,
    checksumAlgorithm: 'sha256-stable-metadata',
    checksum: item.checksum,
    redactionEnvelope: item.redactionEnvelope,
    backupRollback: item.backupRollback,
    policyDecision: 'allow-metadata-config-registry-only',
    payloadKind: 'metadata-config-registry-only',
    payloadSensitiveFieldsPersisted: false,
    provenance: {
      internalOnly: true,
      redacted: true,
      sourceRuntimeAuthority: false,
      sourceRuntimePublicIdentity: false,
    },
    sourceRuntimeAuthority: false,
    runtimeExternalExecutorRequiredForMigration: false,
    rawSecretSerialized: false,
  };
}

function writeJsonAtomic(
  absolutePath: string,
  payload: ZavorthWave4AFirstBatchMigratedRecord | ZavorthWave4AFirstBatchMigrationManifest | ZavorthWave4AFirstBatchMigrationBackupRollbackManifest,
): Pick<ZavorthWave4AFirstBatchMigrationWriteReceipt, 'bytesWritten' | 'metadataConfigRegistryMigrationActuallyPerformed' | 'status'> {
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;

  if (fs.existsSync(absolutePath) && payload.nativeContract === 'ZavorthWave4AFirstBatchMigratedRecord/v1') {
    const current = readJson<ZavorthWave4AFirstBatchMigratedRecord>(absolutePath);
    if (
      current?.checksum === payload.checksum &&
      current.idempotencyKey === payload.idempotencyKey &&
      current.schemaVersion === payload.schemaVersion &&
      !current.rawSecretSerialized
    ) {
      return {
        bytesWritten: 0,
        metadataConfigRegistryMigrationActuallyPerformed: false,
        status: 'already-present',
      };
    }

    return {
      bytesWritten: 0,
      metadataConfigRegistryMigrationActuallyPerformed: false,
      status: 'checksum-conflict',
    };
  }

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const tempPath = `${absolutePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, serialized, 'utf8');
  fs.renameSync(tempPath, absolutePath);

  return {
    bytesWritten: Buffer.byteLength(serialized, 'utf8'),
    metadataConfigRegistryMigrationActuallyPerformed: true,
    status: 'written',
  };
}

function featureFlag(enabled: boolean): ZavorthWave4AFirstBatchMigrationFeatureFlagGate {
  return {
    nativeContract: 'ZavorthWave4AFirstBatchMigrationFeatureFlagGate/v1',
    flagName: ZAVORTH_WAVE4A_METADATA_MIGRATION_WRITE_FLAG,
    enabled,
    safetyGate: 'controlled-test',
    operatorAcknowledgedZavorthOwnedNamespace: true,
    migrationWriteFeatureFlagRequired: true,
  };
}

export class ZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatch {
  public constructor(private readonly source: ZavorthWave4AFirstBatchMigrationSource) {}

  public migrate(options: ZavorthWave4AFirstBatchMigrationOptions): ZavorthWave4AFirstBatchMigrationReceipt {
    const migrationRoot = assertMigrationRoot(options.migrationRoot);
    const migratedAt = options.migratedAt ?? ZAVORTH_WAVE4A_FIRST_CONTROLLED_METADATA_CONFIG_REGISTRY_MIGRATION_BATCH_NOW;
    const baseValidations = sourceValid(this.source);
    const validations = options.featureFlag.enabled
      ? baseValidations
      : [...baseValidations, 'feature-flag-disabled' as const];

    if (validations.length > 0) {
      return this.receipt({
        backupRollbackMetadataCreated: false,
        featureFlag: options.featureFlag,
        migratedAt,
        migrationRoot,
        recordWrites: [],
        validations,
      });
    }

    const batchItemIds = new Set(this.source.migrationPlan.firstBatch.itemIds);
    const batchItems = this.source.migrationPlan.planItems.filter((item) => batchItemIds.has(item.itemId));
    const recordWrites = batchItems.map((item): ZavorthWave4AFirstBatchMigrationWriteReceipt => {
      const relativePath = relativePathForItem(item);
      const absolutePath = path.join(migrationRoot, relativePath);
      const payload = migratedRecord(item, migratedAt);
      const write = writeJsonAtomic(absolutePath, payload);

      return {
        nativeContract: 'ZavorthWave4AFirstBatchMigrationWriteReceipt/v1',
        itemId: item.itemId,
        dataClass: item.dataClass,
        idempotencyKey: item.idempotencyKey,
        checksum: item.checksum,
        relativePath,
        status: write.status,
        bytesWritten: write.bytesWritten,
        atomicWriteUsed: true,
        metadataConfigRegistryMigrationActuallyPerformed: write.metadataConfigRegistryMigrationActuallyPerformed,
        rawSecretSerialized: false,
      };
    });
    const allWritesSafe = recordWrites.every((write) => write.status === 'written' || write.status === 'already-present');
    const manifest: ZavorthWave4AFirstBatchMigrationManifest = {
      nativeContract: 'ZavorthWave4AFirstBatchMigrationManifest/v1',
      migrationNamespace: ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE,
      migrationNamespaceUri: ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE_URI,
      migratedAt,
      schemaVersion: ZAVORTH_WAVE4A_METADATA_MIGRATION_SCHEMA_VERSION,
      batchId: 'wave4a-metadata-config-registry-batch-001',
      recordCount: recordWrites.length,
      records: recordWrites.map((write) => ({
        itemId: write.itemId,
        dataClass: write.dataClass,
        idempotencyKey: write.idempotencyKey,
        checksum: write.checksum,
        relativePath: write.relativePath,
        status: write.status,
      })),
      backupRollbackMetadataCreated: true,
      runtimeExternalExecutorRequiredForMigration: false,
      rawSecretSerialized: false,
    };
    const manifestPath = path.join(migrationRoot, 'manifest.json');
    writeJsonAtomic(manifestPath, manifest);

    const backupRollback: ZavorthWave4AFirstBatchMigrationBackupRollbackManifest = {
      nativeContract: 'ZavorthWave4AFirstBatchMigrationBackupRollbackManifest/v1',
      migrationNamespace: ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE,
      migratedAt,
      manifestPath,
      restoreManifestPath: path.join(migrationRoot, 'restore-manifest.json'),
      rollbackReceiptPath: path.join(migrationRoot, 'rollback-receipt.json'),
      backupRollbackMetadataCreated: true,
      backupActuallyCreated: false,
      restoreActuallyPerformed: false,
      rawSecretSerialized: false,
    };
    const backupRollbackManifestPath = path.join(migrationRoot, 'rollback', 'backup-rollback-manifest.json');
    writeJsonAtomic(backupRollbackManifestPath, backupRollback);

    return this.receipt({
      backupRollbackMetadataCreated: true,
      featureFlag: options.featureFlag,
      migratedAt,
      migrationRoot,
      recordWrites,
      validations: allWritesSafe ? ['valid'] : ['checksum-invalid'],
    });
  }

  public cleanup(migrationRoot: string): ZavorthWave4AFirstBatchMigrationCleanupReceipt {
    const resolved = assertMigrationRoot(migrationRoot);
    if (!resolved.includes(`${path.sep}.tmp${path.sep}`)) {
      throw new Error(`Wave 4A migration cleanup is only allowed for controlled test namespace: ${resolved}`);
    }

    const existedBefore = fs.existsSync(resolved);
    if (existedBefore) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }

    return {
      nativeContract: 'ZavorthWave4AFirstBatchMigrationCleanupReceipt/v1',
      migrationRoot: resolved,
      cleanupActuallyPerformed: existedBefore,
      namespaceExistsAfterCleanup: fs.existsSync(resolved),
      cleanupLimitedToControlledTestNamespace: true,
      sourceFileCopied: false,
      sourceDbCopied: false,
      rawSecretSerialized: false,
    };
  }

  private receipt(input: {
    backupRollbackMetadataCreated: boolean;
    featureFlag: ZavorthWave4AFirstBatchMigrationFeatureFlagGate;
    migratedAt: string;
    migrationRoot: string;
    recordWrites: ZavorthWave4AFirstBatchMigrationWriteReceipt[];
    validations: ZavorthWave4AFirstBatchMigrationValidationStatus[];
  }): ZavorthWave4AFirstBatchMigrationReceipt {
    const decision: ZavorthWave4AFirstBatchMigrationDecision = input.validations.includes('feature-flag-disabled')
      ? 'migration-write-blocked'
      : input.validations.length === 1 && input.validations[0] === 'valid'
        ? 'wave4a-first-batch-migration-ready'
        : 'blocked';

    return {
      nativeContract: 'ZavorthWave4AFirstBatchMigrationReceipt/v1',
      runtimeId: ZAVORTH_WAVE4A_FIRST_CONTROLLED_METADATA_CONFIG_REGISTRY_MIGRATION_BATCH_RUNTIME_ID,
      decision,
      migratedAt: input.migratedAt,
      migrationRoot: input.migrationRoot,
      migrationNamespace: ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE,
      migrationNamespaceUri: ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE_URI,
      featureFlag: input.featureFlag,
      validations: Array.from(new Set(input.validations)),
      recordWrites: input.recordWrites,
      manifestPath: path.join(input.migrationRoot, 'manifest.json'),
      backupRollbackManifestPath: path.join(input.migrationRoot, 'rollback', 'backup-rollback-manifest.json'),
      idempotencyAvoidedDuplicateWrites: input.recordWrites.some((write) => write.status === 'already-present'),
      wave4aFirstBatchMigrationCreated: true,
      migrationWriteFeatureFlagRequired: true,
      metadataConfigRegistryMigrationActuallyPerformedOnlyWhenFlagEnabled: true,
      migrationScopeMetadataConfigRegistryOnly: true,
      backupRollbackMetadataCreated: input.backupRollbackMetadataCreated,
      rawSecretMigrationAllowed: false,
      sessionHistoryRawMigrationAllowed: false,
      sqliteRealMigrationAllowed: false,
      workspaceMigrationAllowed: false,
      logsRawMigrationAllowed: false,
      cacheRawMigrationAllowed: false,
      executionStateMigrationAllowed: false,
      sourceRuntimeAuthority: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      sourceModuleCopied: false,
      adapterRemovalGlobalAllowed: false,
      rawSecretSerialized: false,
    };
  }
}

export function createZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatchFixtureSource(
  overrides: Partial<ZavorthWave4AFirstBatchMigrationSource> = {},
): ZavorthWave4AFirstBatchMigrationSource {
  return {
    migrationPlan: normalizeZavorthWave4AControlledMetadataConfigRegistryMigrationPlanFixture(),
    externalExecutorLiveRequiredForMigration: false,
    rawSecretMigrationAttempted: false,
    sessionHistoryRawMigrationAttempted: false,
    sqliteRealMigrationAttempted: false,
    workspaceMigrationAttempted: false,
    logsRawMigrationAttempted: false,
    cacheRawMigrationAttempted: false,
    executionStateMigrationAttempted: false,
    messageSendAttempted: false,
    providerExecutionAttempted: false,
    commandExecutionAttempted: false,
    toolExecutionAttempted: false,
    sourceModuleCopyAttempted: false,
    adapterRemovalAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    rawSecretSerialized: false,
    ...overrides,
  };
}

export function createZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatchFixture(
  source: ZavorthWave4AFirstBatchMigrationSource = createZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatchFixtureSource(),
): ZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatch {
  return new ZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatch(source);
}

export function createZavorthWave4AFirstBatchMigrationFeatureFlag(
  enabled: boolean,
): ZavorthWave4AFirstBatchMigrationFeatureFlagGate {
  return featureFlag(enabled);
}
