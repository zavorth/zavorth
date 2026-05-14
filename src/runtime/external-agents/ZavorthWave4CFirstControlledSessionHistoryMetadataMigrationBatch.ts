import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_SCHEMA_VERSION,
  normalizeZavorthWave4CControlledSessionHistoryMigrationPlanFixture,
} from './ZavorthWave4CControlledSessionHistoryMigrationPlan.js';
import type {
  ZavorthWave4CControlledSessionHistoryMigrationPlanNormalization,
  ZavorthWave4CSessionHistoryMigratableClass,
  ZavorthWave4CSessionHistoryMigrationPlanItem,
  ZavorthWave4CSessionHistoryRedactionEnvelope,
} from './ZavorthWave4CControlledSessionHistoryMigrationPlan.js';

export const ZAVORTH_WAVE4C_FIRST_CONTROLLED_SESSION_HISTORY_METADATA_MIGRATION_BATCH_NOW = '2026-04-30T15:00:00.000Z' as const;
export const ZAVORTH_WAVE4C_FIRST_CONTROLLED_SESSION_HISTORY_METADATA_MIGRATION_BATCH_RUNTIME_ID = 'zavorth-wave4c-first-controlled-session-history-metadata-migration-batch' as const;
export const ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_WRITE_FLAG = 'ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_WRITE' as const;
export const ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE = 'zavorth-wave4c-session-history-metadata-migration' as const;
export const ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE_URI = 'zavorth://wave4c/session-history-metadata-migration' as const;

export type ZavorthWave4CFirstSessionMetadataMigrationDecision =
  | 'blocked'
  | 'migration-write-blocked'
  | 'wave4c-first-session-metadata-migration-ready';

export type ZavorthWave4CFirstSessionMetadataMigrationValidationStatus =
  | 'checksum-invalid'
  | 'feature-flag-disabled'
  | 'idempotency-invalid'
  | 'policy-blocked'
  | 'redaction-invalid'
  | 'schema-invalid'
  | 'scope-invalid'
  | 'source-not-ready'
  | 'valid';

export type ZavorthWave4CFirstSessionMetadataMigrationWriteStatus =
  | 'already-present'
  | 'checksum-conflict'
  | 'written';

export type ZavorthWave4CFirstSessionMetadataMigrationFeatureFlagGate = {
  nativeContract: 'ZavorthWave4CFirstSessionMetadataMigrationFeatureFlagGate/v1';
  flagName: typeof ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_WRITE_FLAG;
  enabled: boolean;
  safetyGate: 'controlled-production' | 'controlled-test';
  operatorAcknowledgedZavorthOwnedNamespace: boolean;
  sessionMetadataMigrationWriteFeatureFlagRequired: true;
};

export type ZavorthWave4CFirstSessionMetadataMigratedRecord = {
  nativeContract: 'ZavorthWave4CFirstSessionMetadataMigratedRecord/v1';
  migrationNamespace: typeof ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE;
  migrationNamespaceUri: typeof ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE_URI;
  migratedAt: string;
  itemId: ZavorthWave4CSessionHistoryMigratableClass;
  sourceInventoryItem: string;
  dataClass: ZavorthWave4CSessionHistoryMigratableClass;
  targetZavorthStorage: ZavorthWave4CSessionHistoryMigrationPlanItem['targetZavorthStorage'];
  schemaVersion: typeof ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_SCHEMA_VERSION;
  idempotencyKey: string;
  checksumAlgorithm: 'sha256-stable-session-history-metadata';
  checksum: string;
  redactionEnvelope: ZavorthWave4CSessionHistoryRedactionEnvelope;
  backupRollback: ZavorthWave4CSessionHistoryMigrationPlanItem['backupRollback'];
  policyDecision: 'allow-session-history-metadata-plan';
  payloadKind: 'session-history-metadata-only';
  payloadSensitiveFieldsPersisted: false;
  provenance: {
    internalOnly: true;
    redacted: true;
    sourceRuntimeAuthority: false;
    sourceRuntimePublicIdentity: false;
  };
  sourceRuntimeAuthority: false;
  runtimeExternalExecutorRequiredForMigration: false;
  rawMessageContentMigrationAllowed: false;
  rawSqliteCopyAllowed: false;
  sqliteWriteAllowed: false;
  attachmentsMigrationAllowed: false;
  rawSecretMigrationAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4CFirstSessionMetadataMigrationWriteReceipt = {
  nativeContract: 'ZavorthWave4CFirstSessionMetadataMigrationWriteReceipt/v1';
  itemId: ZavorthWave4CSessionHistoryMigratableClass;
  dataClass: ZavorthWave4CSessionHistoryMigratableClass;
  idempotencyKey: string;
  checksum: string;
  relativePath: string;
  status: ZavorthWave4CFirstSessionMetadataMigrationWriteStatus;
  bytesWritten: number;
  atomicWriteUsed: true;
  sessionMetadataMigrationActuallyPerformed: boolean;
  rawSecretSerialized: false;
};

export type ZavorthWave4CFirstSessionMetadataMigrationManifest = {
  nativeContract: 'ZavorthWave4CFirstSessionMetadataMigrationManifest/v1';
  migrationNamespace: typeof ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE;
  migrationNamespaceUri: typeof ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE_URI;
  migratedAt: string;
  schemaVersion: typeof ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_SCHEMA_VERSION;
  batchId: 'wave4c-session-history-metadata-batch-001';
  recordCount: number;
  records: Array<{
    itemId: ZavorthWave4CSessionHistoryMigratableClass;
    dataClass: ZavorthWave4CSessionHistoryMigratableClass;
    idempotencyKey: string;
    checksum: string;
    relativePath: string;
    status: ZavorthWave4CFirstSessionMetadataMigrationWriteStatus;
  }>;
  backupRollbackMetadataCreated: true;
  runtimeExternalExecutorRequiredForMigration: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4CFirstSessionMetadataMigrationBackupRollbackManifest = {
  nativeContract: 'ZavorthWave4CFirstSessionMetadataMigrationBackupRollbackManifest/v1';
  migrationNamespace: typeof ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE;
  migratedAt: string;
  manifestPath: string;
  restoreManifestPath: string;
  rollbackReceiptPath: string;
  backupRollbackMetadataCreated: true;
  backupActuallyCreated: false;
  restoreActuallyPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4CFirstSessionMetadataMigrationReceipt = {
  nativeContract: 'ZavorthWave4CFirstSessionMetadataMigrationReceipt/v1';
  runtimeId: typeof ZAVORTH_WAVE4C_FIRST_CONTROLLED_SESSION_HISTORY_METADATA_MIGRATION_BATCH_RUNTIME_ID;
  decision: ZavorthWave4CFirstSessionMetadataMigrationDecision;
  migratedAt: string;
  migrationRoot: string;
  migrationNamespace: typeof ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE;
  migrationNamespaceUri: typeof ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE_URI;
  featureFlag: ZavorthWave4CFirstSessionMetadataMigrationFeatureFlagGate;
  validations: ZavorthWave4CFirstSessionMetadataMigrationValidationStatus[];
  recordWrites: ZavorthWave4CFirstSessionMetadataMigrationWriteReceipt[];
  manifestPath: string;
  backupRollbackManifestPath: string;
  idempotencyAvoidedDuplicateWrites: boolean;
  wave4cFirstSessionMetadataMigrationBatchCreated: true;
  sessionMetadataMigrationWriteFeatureFlagRequired: true;
  sessionMetadataMigrationActuallyPerformedOnlyWhenFlagEnabled: true;
  sessionHistoryMigrationScopeMetadataOnly: true;
  backupRollbackMetadataCreated: boolean;
  rawMessageContentMigrationAllowed: false;
  rawSqliteCopyAllowed: false;
  sqliteWriteAllowed: false;
  attachmentsMigrationAllowed: false;
  rawSecretMigrationAllowed: false;
  workspaceLogsCacheRawMigrationAllowed: false;
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

export type ZavorthWave4CFirstSessionMetadataMigrationRollbackReceipt = {
  nativeContract: 'ZavorthWave4CFirstSessionMetadataMigrationRollbackReceipt/v1';
  migrationRoot: string;
  outcome: 'rollback-applied';
  removedRelativePaths: string[];
  rollbackApplied: true;
  runtimeExternalExecutorRequiredForMigration: false;
  rawSqliteCopyAllowed: false;
  sqliteWriteAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4CFirstSessionMetadataMigrationCleanupReceipt = {
  nativeContract: 'ZavorthWave4CFirstSessionMetadataMigrationCleanupReceipt/v1';
  migrationRoot: string;
  cleanupActuallyPerformed: boolean;
  namespaceExistsAfterCleanup: boolean;
  cleanupLimitedToControlledTestNamespace: true;
  sourceFileCopied: false;
  sourceDbCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4CFirstSessionMetadataMigrationSource = {
  migrationPlan: ZavorthWave4CControlledSessionHistoryMigrationPlanNormalization;
  externalExecutorLiveRequiredForMigration: false;
  rawMessageContentMigrationAttempted: false;
  rawSqliteCopyAttempted: false;
  sqliteWriteAttempted: false;
  attachmentsMigrationAttempted: false;
  rawSecretMigrationAttempted: false;
  workspaceLogsCacheRawMigrationAttempted: false;
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

export type ZavorthWave4CFirstSessionMetadataMigrationOptions = {
  migrationRoot: string;
  featureFlag: ZavorthWave4CFirstSessionMetadataMigrationFeatureFlagGate;
  migratedAt?: string;
};

const ALLOWED_DATA_CLASSES = new Set<ZavorthWave4CSessionHistoryMigratableClass>([
  'channel-transport-linkage',
  'redacted-message-metadata',
  'redacted-participant-metadata',
  'session-metadata',
  'thread-metadata',
  'timestamps-status',
]);

function assertMigrationRoot(migrationRoot: string): string {
  const resolved = path.resolve(migrationRoot);
  const cwd = path.resolve(process.cwd());

  if (!resolved.startsWith(`${cwd}${path.sep}`)) {
    throw new Error(`Wave 4C migration root must stay inside workspace: ${resolved}`);
  }
  if (!resolved.includes(`${path.sep}.tmp${path.sep}`) && !resolved.includes(`${path.sep}.zavorth${path.sep}`)) {
    throw new Error(`Wave 4C migration root must live under .tmp or .zavorth: ${resolved}`);
  }
  if (path.basename(resolved) !== ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE) {
    throw new Error(`Wave 4C migration root must end with ${ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE}: ${resolved}`);
  }

  return resolved;
}

function expectedChecksumForPlanItem(item: ZavorthWave4CSessionHistoryMigrationPlanItem): string {
  const checksums: Record<ZavorthWave4CSessionHistoryMigratableClass, string> = {
    'channel-transport-linkage': 'sha256:wave4c-channel-transport-linkage-metadata',
    'redacted-message-metadata': 'sha256:wave4c-redacted-message-metadata',
    'redacted-participant-metadata': 'sha256:wave4c-redacted-participant-metadata',
    'session-metadata': 'sha256:wave4c-session-metadata',
    'thread-metadata': 'sha256:wave4c-thread-metadata',
    'timestamps-status': 'sha256:wave4c-timestamps-status',
  };
  return checksums[item.dataClass];
}

function relativePathForItem(item: ZavorthWave4CSessionHistoryMigrationPlanItem): string {
  return path.join('session-history-metadata', item.dataClass, `${item.dataClass}.json`);
}

function readJson<TValue>(filePath: string): TValue | undefined {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as TValue;
  } catch {
    return undefined;
  }
}

function redactionEnvelopeValid(envelope: ZavorthWave4CSessionHistoryRedactionEnvelope): boolean {
  return (
    envelope.nativeContract === 'ZavorthWave4CSessionHistoryRedactionEnvelope/v1' &&
    envelope.rawMessageContentSerialized === false &&
    envelope.rawSecretSerialized === false &&
    envelope.rawSqlitePayloadSerialized === false &&
    envelope.attachmentContentSerialized === false &&
    envelope.sourceIdentityPublic === false &&
    envelope.provenanceInternalOnly === true &&
    envelope.safeMetadataOnly === true &&
    envelope.forbiddenFields.includes('rawMessageContent') &&
    envelope.forbiddenFields.includes('rawSecretValue') &&
    envelope.forbiddenFields.includes('sqlitePayload') &&
    envelope.forbiddenFields.includes('attachmentBody') &&
    envelope.forbiddenFields.includes('workspaceFileBody') &&
    envelope.forbiddenFields.includes('rawLogLine') &&
    envelope.forbiddenFields.includes('rawCacheEntry')
  );
}

function batchItems(source: ZavorthWave4CFirstSessionMetadataMigrationSource): ZavorthWave4CSessionHistoryMigrationPlanItem[] {
  const batchItemIds = new Set(source.migrationPlan.firstBatch.itemIds);
  return source.migrationPlan.migratableItems.filter((item) => batchItemIds.has(item.dataClass));
}

function sourceValid(source: ZavorthWave4CFirstSessionMetadataMigrationSource): ZavorthWave4CFirstSessionMetadataMigrationValidationStatus[] {
  const statuses: ZavorthWave4CFirstSessionMetadataMigrationValidationStatus[] = [];
  const items = batchItems(source);

  if (source.migrationPlan.decision !== 'wave4c-controlled-session-history-migration-plan-ready' ||
    !source.migrationPlan.firstBatch.prepared ||
    source.migrationPlan.firstBatch.executed ||
    items.length !== source.migrationPlan.firstBatch.itemIds.length) {
    statuses.push('source-not-ready');
  }
  if (source.rawSecretSerialized) {
    statuses.push('redaction-invalid');
  }
  if (source.externalExecutorLiveRequiredForMigration || source.rawMessageContentMigrationAttempted ||
    source.rawSqliteCopyAttempted || source.sqliteWriteAttempted || source.attachmentsMigrationAttempted ||
    source.rawSecretMigrationAttempted || source.workspaceLogsCacheRawMigrationAttempted ||
    source.executionStateMigrationAttempted || source.messageSendAttempted || source.providerExecutionAttempted ||
    source.commandExecutionAttempted || source.toolExecutionAttempted || source.sourceModuleCopyAttempted ||
    source.adapterRemovalAttempted || source.publicExternalExecutorIdentityExposed) {
    statuses.push('source-not-ready');
  }
  if (items.some((item) => item.schemaVersion !== ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_SCHEMA_VERSION)) {
    statuses.push('schema-invalid');
  }
  if (items.some((item) => !redactionEnvelopeValid(item.redactionEnvelope))) {
    statuses.push('redaction-invalid');
  }
  if (items.some((item) => item.checksum !== expectedChecksumForPlanItem(item))) {
    statuses.push('checksum-invalid');
  }
  if (items.some((item) => item.idempotencyKey !== `wave4c:session-history-metadata:v1:${item.dataClass}`)) {
    statuses.push('idempotency-invalid');
  }
  if (items.some((item) => item.policyDecision !== 'allow-session-history-metadata-plan' || item.eligibility !== 'eligible-for-first-controlled-metadata-batch')) {
    statuses.push('policy-blocked');
  }
  if (items.some((item) => !ALLOWED_DATA_CLASSES.has(item.dataClass))) {
    statuses.push('scope-invalid');
  }

  return Array.from(new Set(statuses));
}

function migratedRecord(item: ZavorthWave4CSessionHistoryMigrationPlanItem, migratedAt: string): ZavorthWave4CFirstSessionMetadataMigratedRecord {
  return {
    nativeContract: 'ZavorthWave4CFirstSessionMetadataMigratedRecord/v1',
    migrationNamespace: ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE,
    migrationNamespaceUri: ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE_URI,
    migratedAt,
    itemId: item.dataClass,
    sourceInventoryItem: item.sourceInventoryItem,
    dataClass: item.dataClass,
    targetZavorthStorage: item.targetZavorthStorage,
    schemaVersion: ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_SCHEMA_VERSION,
    idempotencyKey: item.idempotencyKey,
    checksumAlgorithm: 'sha256-stable-session-history-metadata',
    checksum: item.checksum,
    redactionEnvelope: item.redactionEnvelope,
    backupRollback: item.backupRollback,
    policyDecision: 'allow-session-history-metadata-plan',
    payloadKind: 'session-history-metadata-only',
    payloadSensitiveFieldsPersisted: false,
    provenance: {
      internalOnly: true,
      redacted: true,
      sourceRuntimeAuthority: false,
      sourceRuntimePublicIdentity: false,
    },
    sourceRuntimeAuthority: false,
    runtimeExternalExecutorRequiredForMigration: false,
    rawMessageContentMigrationAllowed: false,
    rawSqliteCopyAllowed: false,
    sqliteWriteAllowed: false,
    attachmentsMigrationAllowed: false,
    rawSecretMigrationAllowed: false,
    rawSecretSerialized: false,
  };
}

function writeJsonAtomic(
  absolutePath: string,
  payload: ZavorthWave4CFirstSessionMetadataMigratedRecord | ZavorthWave4CFirstSessionMetadataMigrationManifest | ZavorthWave4CFirstSessionMetadataMigrationBackupRollbackManifest,
): Pick<ZavorthWave4CFirstSessionMetadataMigrationWriteReceipt, 'bytesWritten' | 'sessionMetadataMigrationActuallyPerformed' | 'status'> {
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;

  if (fs.existsSync(absolutePath) && payload.nativeContract === 'ZavorthWave4CFirstSessionMetadataMigratedRecord/v1') {
    const current = readJson<ZavorthWave4CFirstSessionMetadataMigratedRecord>(absolutePath);
    if (
      current?.checksum === payload.checksum &&
      current.idempotencyKey === payload.idempotencyKey &&
      current.schemaVersion === payload.schemaVersion &&
      !current.rawSecretSerialized
    ) {
      return {
        bytesWritten: 0,
        sessionMetadataMigrationActuallyPerformed: false,
        status: 'already-present',
      };
    }

    return {
      bytesWritten: 0,
      sessionMetadataMigrationActuallyPerformed: false,
      status: 'checksum-conflict',
    };
  }

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const tempPath = `${absolutePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, serialized, 'utf8');
  fs.renameSync(tempPath, absolutePath);

  return {
    bytesWritten: Buffer.byteLength(serialized, 'utf8'),
    sessionMetadataMigrationActuallyPerformed: true,
    status: 'written',
  };
}

function featureFlag(enabled: boolean): ZavorthWave4CFirstSessionMetadataMigrationFeatureFlagGate {
  return {
    nativeContract: 'ZavorthWave4CFirstSessionMetadataMigrationFeatureFlagGate/v1',
    flagName: ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_WRITE_FLAG,
    enabled,
    safetyGate: 'controlled-test',
    operatorAcknowledgedZavorthOwnedNamespace: true,
    sessionMetadataMigrationWriteFeatureFlagRequired: true,
  };
}

export class ZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatch {
  public constructor(private readonly source: ZavorthWave4CFirstSessionMetadataMigrationSource) {}

  public migrate(options: ZavorthWave4CFirstSessionMetadataMigrationOptions): ZavorthWave4CFirstSessionMetadataMigrationReceipt {
    const migrationRoot = assertMigrationRoot(options.migrationRoot);
    const migratedAt = options.migratedAt ?? ZAVORTH_WAVE4C_FIRST_CONTROLLED_SESSION_HISTORY_METADATA_MIGRATION_BATCH_NOW;
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

    const items = batchItems(this.source);
    const recordWrites = items.map((item): ZavorthWave4CFirstSessionMetadataMigrationWriteReceipt => {
      const relativePath = relativePathForItem(item);
      const absolutePath = path.join(migrationRoot, relativePath);
      const payload = migratedRecord(item, migratedAt);
      const write = writeJsonAtomic(absolutePath, payload);

      return {
        nativeContract: 'ZavorthWave4CFirstSessionMetadataMigrationWriteReceipt/v1',
        itemId: item.dataClass,
        dataClass: item.dataClass,
        idempotencyKey: item.idempotencyKey,
        checksum: item.checksum,
        relativePath,
        status: write.status,
        bytesWritten: write.bytesWritten,
        atomicWriteUsed: true,
        sessionMetadataMigrationActuallyPerformed: write.sessionMetadataMigrationActuallyPerformed,
        rawSecretSerialized: false,
      };
    });
    const allWritesSafe = recordWrites.every((write) => write.status === 'written' || write.status === 'already-present');
    const manifest: ZavorthWave4CFirstSessionMetadataMigrationManifest = {
      nativeContract: 'ZavorthWave4CFirstSessionMetadataMigrationManifest/v1',
      migrationNamespace: ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE,
      migrationNamespaceUri: ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE_URI,
      migratedAt,
      schemaVersion: ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_SCHEMA_VERSION,
      batchId: 'wave4c-session-history-metadata-batch-001',
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

    const backupRollback: ZavorthWave4CFirstSessionMetadataMigrationBackupRollbackManifest = {
      nativeContract: 'ZavorthWave4CFirstSessionMetadataMigrationBackupRollbackManifest/v1',
      migrationNamespace: ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE,
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

  public rollback(
    migrationRoot: string,
    receipt: ZavorthWave4CFirstSessionMetadataMigrationReceipt,
  ): ZavorthWave4CFirstSessionMetadataMigrationRollbackReceipt {
    const resolved = assertMigrationRoot(migrationRoot);
    if (!resolved.includes(`${path.sep}.tmp${path.sep}`)) {
      throw new Error(`Wave 4C migration rollback is only allowed for controlled test namespace: ${resolved}`);
    }

    const removedRelativePaths: string[] = [];
    [
      ...receipt.recordWrites.map((write) => write.relativePath),
      'manifest.json',
      path.join('rollback', 'backup-rollback-manifest.json'),
    ].forEach((relativePath) => {
      const absolutePath = path.join(resolved, relativePath);
      if (fs.existsSync(absolutePath)) {
        fs.rmSync(absolutePath, { force: true });
        removedRelativePaths.push(relativePath);
      }
    });

    return {
      nativeContract: 'ZavorthWave4CFirstSessionMetadataMigrationRollbackReceipt/v1',
      migrationRoot: resolved,
      outcome: 'rollback-applied',
      removedRelativePaths,
      rollbackApplied: true,
      runtimeExternalExecutorRequiredForMigration: false,
      rawSqliteCopyAllowed: false,
      sqliteWriteAllowed: false,
      rawSecretSerialized: false,
    };
  }

  public cleanup(migrationRoot: string): ZavorthWave4CFirstSessionMetadataMigrationCleanupReceipt {
    const resolved = assertMigrationRoot(migrationRoot);
    if (!resolved.includes(`${path.sep}.tmp${path.sep}`)) {
      throw new Error(`Wave 4C migration cleanup is only allowed for controlled test namespace: ${resolved}`);
    }

    const existedBefore = fs.existsSync(resolved);
    if (existedBefore) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }

    return {
      nativeContract: 'ZavorthWave4CFirstSessionMetadataMigrationCleanupReceipt/v1',
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
    featureFlag: ZavorthWave4CFirstSessionMetadataMigrationFeatureFlagGate;
    migratedAt: string;
    migrationRoot: string;
    recordWrites: ZavorthWave4CFirstSessionMetadataMigrationWriteReceipt[];
    validations: ZavorthWave4CFirstSessionMetadataMigrationValidationStatus[];
  }): ZavorthWave4CFirstSessionMetadataMigrationReceipt {
    const decision: ZavorthWave4CFirstSessionMetadataMigrationDecision = input.validations.includes('feature-flag-disabled')
      ? 'migration-write-blocked'
      : input.validations.length === 1 && input.validations[0] === 'valid'
        ? 'wave4c-first-session-metadata-migration-ready'
        : 'blocked';

    return {
      nativeContract: 'ZavorthWave4CFirstSessionMetadataMigrationReceipt/v1',
      runtimeId: ZAVORTH_WAVE4C_FIRST_CONTROLLED_SESSION_HISTORY_METADATA_MIGRATION_BATCH_RUNTIME_ID,
      decision,
      migratedAt: input.migratedAt,
      migrationRoot: input.migrationRoot,
      migrationNamespace: ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE,
      migrationNamespaceUri: ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE_URI,
      featureFlag: input.featureFlag,
      validations: Array.from(new Set(input.validations)),
      recordWrites: input.recordWrites,
      manifestPath: path.join(input.migrationRoot, 'manifest.json'),
      backupRollbackManifestPath: path.join(input.migrationRoot, 'rollback', 'backup-rollback-manifest.json'),
      idempotencyAvoidedDuplicateWrites: input.recordWrites.some((write) => write.status === 'already-present'),
      wave4cFirstSessionMetadataMigrationBatchCreated: true,
      sessionMetadataMigrationWriteFeatureFlagRequired: true,
      sessionMetadataMigrationActuallyPerformedOnlyWhenFlagEnabled: true,
      sessionHistoryMigrationScopeMetadataOnly: true,
      backupRollbackMetadataCreated: input.backupRollbackMetadataCreated,
      rawMessageContentMigrationAllowed: false,
      rawSqliteCopyAllowed: false,
      sqliteWriteAllowed: false,
      attachmentsMigrationAllowed: false,
      rawSecretMigrationAllowed: false,
      workspaceLogsCacheRawMigrationAllowed: false,
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

export function createZavorthWave4CFirstSessionMetadataMigrationFeatureFlag(
  enabled: boolean,
): ZavorthWave4CFirstSessionMetadataMigrationFeatureFlagGate {
  return featureFlag(enabled);
}

export function createZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatchFixtureSource(
  overrides: Partial<ZavorthWave4CFirstSessionMetadataMigrationSource> = {},
): ZavorthWave4CFirstSessionMetadataMigrationSource {
  return {
    migrationPlan: normalizeZavorthWave4CControlledSessionHistoryMigrationPlanFixture(),
    externalExecutorLiveRequiredForMigration: false,
    rawMessageContentMigrationAttempted: false,
    rawSqliteCopyAttempted: false,
    sqliteWriteAttempted: false,
    attachmentsMigrationAttempted: false,
    rawSecretMigrationAttempted: false,
    workspaceLogsCacheRawMigrationAttempted: false,
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

export function createZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatchFixture(
  source: ZavorthWave4CFirstSessionMetadataMigrationSource = createZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatchFixtureSource(),
): ZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatch {
  return new ZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatch(source);
}
