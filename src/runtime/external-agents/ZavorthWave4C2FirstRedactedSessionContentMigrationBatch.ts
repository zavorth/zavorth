import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4C2_RAW_SESSION_CONTENT_MIGRATION_READINESS_PACK_RUNTIME_ID,
  ZAVORTH_WAVE4C2_SESSION_CONTENT_METADATA_SCHEMA_VERSION,
  createZavorthWave4C2RawSessionContentMigrationReadinessPackFixture,
} from './ZavorthWave4C2RawSessionContentMigrationReadinessPack.js';
import type {
  ZavorthWave4C2ContentRedactionPolicyRule,
  ZavorthWave4C2FutureMigrationBatchItem,
  ZavorthWave4C2RawSessionContentMigrationReadinessPackNormalization,
  ZavorthWave4C2ReadinessBatchItemClass,
  ZavorthWave4C2RedactionEnvelope,
} from './ZavorthWave4C2RawSessionContentMigrationReadinessPack.js';

export const ZAVORTH_WAVE4C2_FIRST_REDACTED_SESSION_CONTENT_MIGRATION_BATCH_NOW = '2026-04-30T23:00:00.000Z' as const;
export const ZAVORTH_WAVE4C2_FIRST_REDACTED_SESSION_CONTENT_MIGRATION_BATCH_RUNTIME_ID = 'zavorth-wave4c2-first-redacted-session-content-migration-batch' as const;
export const ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_WRITE_FLAG = 'ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_WRITE' as const;
export const ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE = 'zavorth-wave4c2-redacted-session-content-migration' as const;
export const ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE_URI = 'zavorth://wave4c2/redacted-session-content-migration' as const;

export type ZavorthWave4C2FirstRedactedContentMigrationDecision =
  | 'blocked'
  | 'migration-write-blocked'
  | 'wave4c2-first-redacted-content-migration-ready';

export type ZavorthWave4C2FirstRedactedContentMigrationValidationStatus =
  | 'checksum-invalid'
  | 'content-policy-invalid'
  | 'feature-flag-disabled'
  | 'idempotency-invalid'
  | 'policy-blocked'
  | 'raw-content-detected'
  | 'redaction-invalid'
  | 'schema-invalid'
  | 'scope-invalid'
  | 'source-not-ready'
  | 'valid';

export type ZavorthWave4C2FirstRedactedContentMigrationWriteStatus =
  | 'already-present'
  | 'checksum-conflict'
  | 'written';

export type ZavorthWave4C2RedactedContentSensitivity =
  | 'channel-link'
  | 'message-content'
  | 'participant-identifier'
  | 'timestamp';

export type ZavorthWave4C2FirstRedactedContentMigrationFeatureFlagGate = {
  nativeContract: 'ZavorthWave4C2FirstRedactedContentMigrationFeatureFlagGate/v1';
  flagName: typeof ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_WRITE_FLAG;
  enabled: boolean;
  safetyGate: 'controlled-production' | 'controlled-test';
  operatorAcknowledgedZavorthOwnedNamespace: boolean;
  redactedContentMigrationWriteFeatureFlagRequired: true;
};

export type ZavorthWave4C2RedactedContentPayload = {
  nativeContract: 'ZavorthWave4C2RedactedContentPayload/v1';
  itemClass: ZavorthWave4C2ReadinessBatchItemClass;
  payloadKind: 'redacted-session-content-derived-metadata-only';
  contentRawStored: false;
  rawMessageContentSerialized: false;
  rawSecretSerialized: false;
  attachmentContentSerialized: false;
  sqlitePayloadSerialized: false;
  redactedExcerpt?: '[redacted-content]' | '[unavailable]';
  contentHash?: string;
  contentLengthBucket?: 'empty' | 'short' | 'medium' | 'long' | 'unknown';
  countMetadata?: {
    messageCountBucket?: 'one' | 'few' | 'many' | 'unknown';
    participantCountBucket?: 'one' | 'few' | 'many' | 'unknown';
  };
  linkageMetadata?: {
    sessionAlias: 'session-alias-redacted';
    threadAlias: 'thread-alias-redacted';
    channelAlias?: 'channel-alias-redacted';
  };
  sensitivityClassification: ZavorthWave4C2RedactedContentSensitivity;
};

export type ZavorthWave4C2FirstRedactedContentMigratedRecord = {
  nativeContract: 'ZavorthWave4C2FirstRedactedContentMigratedRecord/v1';
  migrationNamespace: typeof ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE;
  migrationNamespaceUri: typeof ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE_URI;
  migratedAt: string;
  itemId: ZavorthWave4C2ReadinessBatchItemClass;
  sourceInventoryId: string;
  targetZavorthStorage: ZavorthWave4C2FutureMigrationBatchItem['targetZavorthStorage'];
  schemaVersion: typeof ZAVORTH_WAVE4C2_SESSION_CONTENT_METADATA_SCHEMA_VERSION;
  idempotencyKey: string;
  checksumAlgorithm: 'sha256-stable-redacted-session-content-metadata';
  checksum: string;
  redactionEnvelope: ZavorthWave4C2RedactionEnvelope;
  contentPolicyRule: ZavorthWave4C2ContentRedactionPolicyRule['sensitivityClass'];
  contentPolicyDecision: 'allow-derived-metadata-only';
  payload: ZavorthWave4C2RedactedContentPayload;
  backupRollback: ZavorthWave4C2FutureMigrationBatchItem['rollbackRequirement'];
  policyDecision: 'allow-future-derived-content-metadata-batch';
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
  workspaceLogsCacheRawMigrationAllowed: false;
  executionStateMigrationAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4C2FirstRedactedContentMigrationWriteReceipt = {
  nativeContract: 'ZavorthWave4C2FirstRedactedContentMigrationWriteReceipt/v1';
  itemId: ZavorthWave4C2ReadinessBatchItemClass;
  idempotencyKey: string;
  checksum: string;
  relativePath: string;
  status: ZavorthWave4C2FirstRedactedContentMigrationWriteStatus;
  bytesWritten: number;
  atomicWriteUsed: true;
  redactedContentMigrationActuallyPerformed: boolean;
  rawSecretSerialized: false;
};

export type ZavorthWave4C2FirstRedactedContentMigrationManifest = {
  nativeContract: 'ZavorthWave4C2FirstRedactedContentMigrationManifest/v1';
  migrationNamespace: typeof ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE;
  migrationNamespaceUri: typeof ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE_URI;
  migratedAt: string;
  schemaVersion: typeof ZAVORTH_WAVE4C2_SESSION_CONTENT_METADATA_SCHEMA_VERSION;
  batchId: 'wave4c2-redacted-session-content-batch-001';
  recordCount: number;
  records: Array<{
    itemId: ZavorthWave4C2ReadinessBatchItemClass;
    idempotencyKey: string;
    checksum: string;
    relativePath: string;
    status: ZavorthWave4C2FirstRedactedContentMigrationWriteStatus;
  }>;
  backupRollbackMetadataCreated: true;
  runtimeExternalExecutorRequiredForMigration: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4C2FirstRedactedContentMigrationBackupRollbackManifest = {
  nativeContract: 'ZavorthWave4C2FirstRedactedContentMigrationBackupRollbackManifest/v1';
  migrationNamespace: typeof ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE;
  migratedAt: string;
  manifestPath: string;
  restoreManifestPath: string;
  rollbackReceiptPath: string;
  backupRollbackMetadataCreated: true;
  backupActuallyCreated: false;
  restoreActuallyPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4C2FirstRedactedContentMigrationReceipt = {
  nativeContract: 'ZavorthWave4C2FirstRedactedContentMigrationReceipt/v1';
  runtimeId: typeof ZAVORTH_WAVE4C2_FIRST_REDACTED_SESSION_CONTENT_MIGRATION_BATCH_RUNTIME_ID;
  decision: ZavorthWave4C2FirstRedactedContentMigrationDecision;
  migratedAt: string;
  migrationRoot: string;
  migrationNamespace: typeof ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE;
  migrationNamespaceUri: typeof ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE_URI;
  featureFlag: ZavorthWave4C2FirstRedactedContentMigrationFeatureFlagGate;
  validations: ZavorthWave4C2FirstRedactedContentMigrationValidationStatus[];
  recordWrites: ZavorthWave4C2FirstRedactedContentMigrationWriteReceipt[];
  manifestPath: string;
  backupRollbackManifestPath: string;
  idempotencyAvoidedDuplicateWrites: boolean;
  wave4c2FirstRedactedContentMigrationBatchCreated: true;
  redactedContentMigrationWriteFeatureFlagRequired: true;
  redactedContentMigrationActuallyPerformedOnlyWhenFlagEnabled: true;
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
  backupRollbackMetadataCreated: boolean;
};

export type ZavorthWave4C2FirstRedactedContentMigrationRollbackReceipt = {
  nativeContract: 'ZavorthWave4C2FirstRedactedContentMigrationRollbackReceipt/v1';
  migrationRoot: string;
  outcome: 'rollback-applied';
  removedRelativePaths: string[];
  rollbackApplied: true;
  runtimeExternalExecutorRequiredForMigration: false;
  rawSqliteCopyAllowed: false;
  sqliteWriteAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4C2FirstRedactedContentMigrationCleanupReceipt = {
  nativeContract: 'ZavorthWave4C2FirstRedactedContentMigrationCleanupReceipt/v1';
  migrationRoot: string;
  cleanupActuallyPerformed: boolean;
  namespaceExistsAfterCleanup: boolean;
  cleanupLimitedToControlledTestNamespace: true;
  sourceFileCopied: false;
  sourceDbCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4C2FirstRedactedContentMigrationSource = {
  readinessPack: ZavorthWave4C2RawSessionContentMigrationReadinessPackNormalization;
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

export type ZavorthWave4C2FirstRedactedContentMigrationOptions = {
  migrationRoot: string;
  featureFlag: ZavorthWave4C2FirstRedactedContentMigrationFeatureFlagGate;
  migratedAt?: string;
};

const ALLOWED_ITEM_CLASSES = new Set<ZavorthWave4C2ReadinessBatchItemClass>([
  'channel-linkage-metadata',
  'message-content-hash',
  'message-redacted-excerpt',
  'message-token-count-bucket',
  'participant-count-kind',
  'session-content-presence',
  'timestamp-range',
]);

function assertMigrationRoot(migrationRoot: string): string {
  const resolved = path.resolve(migrationRoot);
  const cwd = path.resolve(process.cwd());

  if (!resolved.startsWith(`${cwd}${path.sep}`)) {
    throw new Error(`Wave 4C.2 redacted content migration root must stay inside workspace: ${resolved}`);
  }
  if (!resolved.includes(`${path.sep}.tmp${path.sep}`) && !resolved.includes(`${path.sep}.zavorth${path.sep}`)) {
    throw new Error(`Wave 4C.2 redacted content migration root must live under .tmp or .zavorth: ${resolved}`);
  }
  if (path.basename(resolved) !== ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE) {
    throw new Error(`Wave 4C.2 redacted content migration root must end with ${ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE}: ${resolved}`);
  }

  return resolved;
}

function expectedChecksumForItem(item: ZavorthWave4C2FutureMigrationBatchItem): string {
  return `sha256:wave4c2-derived-content-metadata:${item.itemClass}`;
}

function expectedIdempotencyKeyForItem(item: ZavorthWave4C2FutureMigrationBatchItem): string {
  return `wave4c2:derived-content-metadata:v1:${item.itemClass}`;
}

function relativePathForItem(item: ZavorthWave4C2FutureMigrationBatchItem): string {
  return path.join('redacted-session-content', item.itemClass, `${item.itemClass}.json`);
}

function readJson<TValue>(filePath: string): TValue | undefined {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as TValue;
  } catch {
    return undefined;
  }
}

function redactionEnvelopeValid(envelope: ZavorthWave4C2RedactionEnvelope): boolean {
  return (
    envelope.nativeContract === 'ZavorthWave4C2RedactionEnvelope/v1' &&
    envelope.rawMessageContentSerialized === false &&
    envelope.rawSecretSerialized === false &&
    envelope.rawSqlitePayloadSerialized === false &&
    envelope.attachmentContentSerialized === false &&
    envelope.binaryPayloadSerialized === false &&
    envelope.sourceIdentityPublic === false &&
    envelope.provenanceInternalOnly === true &&
    envelope.forbiddenFields.includes('rawMessageContent') &&
    envelope.forbiddenFields.includes('rawSecretValue') &&
    envelope.forbiddenFields.includes('sqlitePayload') &&
    envelope.forbiddenFields.includes('attachmentBody') &&
    envelope.forbiddenFields.includes('binaryPayload') &&
    envelope.forbiddenFields.includes('workspaceFileBody') &&
    envelope.forbiddenFields.includes('rawLogLine') &&
    envelope.forbiddenFields.includes('rawCacheEntry')
  );
}

function sensitivityForItem(itemClass: ZavorthWave4C2ReadinessBatchItemClass): ZavorthWave4C2RedactedContentSensitivity {
  if (itemClass === 'participant-count-kind') {
    return 'participant-identifier';
  }
  if (itemClass === 'timestamp-range') {
    return 'timestamp';
  }
  if (itemClass === 'channel-linkage-metadata') {
    return 'channel-link';
  }
  return 'message-content';
}

function contentPolicyValid(
  item: ZavorthWave4C2FutureMigrationBatchItem,
  rules: ZavorthWave4C2ContentRedactionPolicyRule[],
): boolean {
  const sensitivity = sensitivityForItem(item.itemClass);
  const rule = rules.find((candidate) => candidate.sensitivityClass === sensitivity);
  if (!rule || rule.policyDecision !== 'allow-derived-metadata-only') {
    return false;
  }
  if (item.itemClass === 'message-content-hash') {
    return rule.allowedDerivedOutputs.includes('hash');
  }
  if (item.itemClass === 'message-redacted-excerpt') {
    return rule.allowedDerivedOutputs.includes('redacted-excerpt');
  }
  if (item.itemClass === 'message-token-count-bucket' ||
    item.itemClass === 'participant-count-kind' ||
    item.itemClass === 'session-content-presence') {
    return rule.allowedDerivedOutputs.includes('count');
  }
  return rule.allowedDerivedOutputs.includes('summary-metadata');
}

function sourceItems(source: ZavorthWave4C2FirstRedactedContentMigrationSource): ZavorthWave4C2FutureMigrationBatchItem[] {
  return source.readinessPack.firstFutureBatchDesign;
}

function sourceValid(source: ZavorthWave4C2FirstRedactedContentMigrationSource): ZavorthWave4C2FirstRedactedContentMigrationValidationStatus[] {
  const statuses: ZavorthWave4C2FirstRedactedContentMigrationValidationStatus[] = [];
  const items = sourceItems(source);

  if (
    source.readinessPack.runtimeId !== ZAVORTH_WAVE4C2_RAW_SESSION_CONTENT_MIGRATION_READINESS_PACK_RUNTIME_ID ||
    source.readinessPack.decision !== 'wave4c2-raw-session-content-migration-readiness-pack-ready' ||
    items.length !== 7 ||
    !source.readinessPack.executionGate.rawContentMigrationPreparedButNotExecuted ||
    source.readinessPack.executionGate.sqliteWriteAllowed ||
    source.readinessPack.executionGate.rawDbCopyAllowed ||
    source.readinessPack.executionGate.attachmentsMigrationAllowed ||
    source.readinessPack.executionGate.externalExecutorLiveRequired
  ) {
    statuses.push('source-not-ready');
  }
  if (source.rawSecretSerialized || source.readinessPack.redaction.rawSecretSerialized) {
    statuses.push('redaction-invalid');
  }
  if (
    source.externalExecutorLiveRequiredForMigration ||
    source.rawSqliteCopyAttempted ||
    source.sqliteWriteAttempted ||
    source.attachmentsMigrationAttempted ||
    source.rawSecretMigrationAttempted ||
    source.workspaceLogsCacheRawMigrationAttempted ||
    source.executionStateMigrationAttempted ||
    source.messageSendAttempted ||
    source.providerExecutionAttempted ||
    source.commandExecutionAttempted ||
    source.toolExecutionAttempted ||
    source.sourceModuleCopyAttempted ||
    source.adapterRemovalAttempted ||
    source.publicExternalExecutorIdentityExposed
  ) {
    statuses.push('source-not-ready');
  }
  if (source.rawMessageContentMigrationAttempted) {
    statuses.push('raw-content-detected');
  }
  if (items.some((item) => item.schemaVersion !== ZAVORTH_WAVE4C2_SESSION_CONTENT_METADATA_SCHEMA_VERSION)) {
    statuses.push('schema-invalid');
  }
  if (items.some((item) => !redactionEnvelopeValid(item.redactionEnvelope))) {
    statuses.push('redaction-invalid');
  }
  if (items.some((item) => item.checksum !== expectedChecksumForItem(item))) {
    statuses.push('checksum-invalid');
  }
  if (items.some((item) => item.idempotencyKey !== expectedIdempotencyKeyForItem(item))) {
    statuses.push('idempotency-invalid');
  }
  if (items.some((item) => item.policyDecision !== 'allow-future-derived-content-metadata-batch')) {
    statuses.push('policy-blocked');
  }
  if (items.some((item) => !ALLOWED_ITEM_CLASSES.has(item.itemClass))) {
    statuses.push('scope-invalid');
  }
  if (items.some((item) => !contentPolicyValid(item, source.readinessPack.redactionPolicy))) {
    statuses.push('content-policy-invalid');
  }

  return Array.from(new Set(statuses));
}

function payloadForItem(item: ZavorthWave4C2FutureMigrationBatchItem): ZavorthWave4C2RedactedContentPayload {
  const base = {
    nativeContract: 'ZavorthWave4C2RedactedContentPayload/v1' as const,
    itemClass: item.itemClass,
    payloadKind: 'redacted-session-content-derived-metadata-only' as const,
    contentRawStored: false as const,
    rawMessageContentSerialized: false as const,
    rawSecretSerialized: false as const,
    attachmentContentSerialized: false as const,
    sqlitePayloadSerialized: false as const,
    sensitivityClassification: sensitivityForItem(item.itemClass),
  };

  if (item.itemClass === 'message-content-hash') {
    return {
      ...base,
      contentHash: item.checksum,
      contentLengthBucket: 'unknown',
    };
  }
  if (item.itemClass === 'message-redacted-excerpt') {
    return {
      ...base,
      redactedExcerpt: '[redacted-content]',
      contentLengthBucket: 'unknown',
    };
  }
  if (item.itemClass === 'message-token-count-bucket') {
    return {
      ...base,
      contentLengthBucket: 'medium',
      countMetadata: {
        messageCountBucket: 'few',
      },
    };
  }
  if (item.itemClass === 'participant-count-kind') {
    return {
      ...base,
      countMetadata: {
        participantCountBucket: 'few',
      },
    };
  }
  if (item.itemClass === 'channel-linkage-metadata') {
    return {
      ...base,
      linkageMetadata: {
        sessionAlias: 'session-alias-redacted',
        threadAlias: 'thread-alias-redacted',
        channelAlias: 'channel-alias-redacted',
      },
    };
  }

  return {
    ...base,
    linkageMetadata: {
      sessionAlias: 'session-alias-redacted',
      threadAlias: 'thread-alias-redacted',
    },
    countMetadata: {
      messageCountBucket: 'unknown',
    },
  };
}

function migratedRecord(item: ZavorthWave4C2FutureMigrationBatchItem, migratedAt: string): ZavorthWave4C2FirstRedactedContentMigratedRecord {
  return {
    nativeContract: 'ZavorthWave4C2FirstRedactedContentMigratedRecord/v1',
    migrationNamespace: ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE,
    migrationNamespaceUri: ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE_URI,
    migratedAt,
    itemId: item.itemClass,
    sourceInventoryId: item.sourceInventoryId,
    targetZavorthStorage: item.targetZavorthStorage,
    schemaVersion: ZAVORTH_WAVE4C2_SESSION_CONTENT_METADATA_SCHEMA_VERSION,
    idempotencyKey: item.idempotencyKey,
    checksumAlgorithm: 'sha256-stable-redacted-session-content-metadata',
    checksum: item.checksum,
    redactionEnvelope: item.redactionEnvelope,
    contentPolicyRule: sensitivityForItem(item.itemClass),
    contentPolicyDecision: 'allow-derived-metadata-only',
    payload: payloadForItem(item),
    backupRollback: item.rollbackRequirement,
    policyDecision: 'allow-future-derived-content-metadata-batch',
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
    workspaceLogsCacheRawMigrationAllowed: false,
    executionStateMigrationAllowed: false,
    rawSecretSerialized: false,
  };
}

function serializedPayloadSafe(serialized: string): boolean {
  return !serialized.includes('raw user message body that must never migrate') &&
    !serialized.includes('unredacted private message fixture') &&
    !serialized.includes('attachment binary fixture that must never migrate') &&
    !serialized.includes('synthetic-raw-credential-sentinel-that-must-not-appear') &&
    !serialized.includes('<redacted-local-secret>');
}

function writeJsonAtomic(
  absolutePath: string,
  payload: ZavorthWave4C2FirstRedactedContentMigratedRecord | ZavorthWave4C2FirstRedactedContentMigrationManifest | ZavorthWave4C2FirstRedactedContentMigrationBackupRollbackManifest,
): Pick<ZavorthWave4C2FirstRedactedContentMigrationWriteReceipt, 'bytesWritten' | 'redactedContentMigrationActuallyPerformed' | 'status'> {
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  if (!serializedPayloadSafe(serialized)) {
    return {
      bytesWritten: 0,
      redactedContentMigrationActuallyPerformed: false,
      status: 'checksum-conflict',
    };
  }

  if (fs.existsSync(absolutePath) && payload.nativeContract === 'ZavorthWave4C2FirstRedactedContentMigratedRecord/v1') {
    const current = readJson<ZavorthWave4C2FirstRedactedContentMigratedRecord>(absolutePath);
    if (
      current?.checksum === payload.checksum &&
      current.idempotencyKey === payload.idempotencyKey &&
      current.schemaVersion === payload.schemaVersion &&
      !current.rawSecretSerialized &&
      !current.payload.rawMessageContentSerialized
    ) {
      return {
        bytesWritten: 0,
        redactedContentMigrationActuallyPerformed: false,
        status: 'already-present',
      };
    }

    return {
      bytesWritten: 0,
      redactedContentMigrationActuallyPerformed: false,
      status: 'checksum-conflict',
    };
  }

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const tempPath = `${absolutePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, serialized, 'utf8');
  fs.renameSync(tempPath, absolutePath);

  return {
    bytesWritten: Buffer.byteLength(serialized, 'utf8'),
    redactedContentMigrationActuallyPerformed: true,
    status: 'written',
  };
}

function featureFlag(enabled: boolean): ZavorthWave4C2FirstRedactedContentMigrationFeatureFlagGate {
  return {
    nativeContract: 'ZavorthWave4C2FirstRedactedContentMigrationFeatureFlagGate/v1',
    flagName: ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_WRITE_FLAG,
    enabled,
    safetyGate: 'controlled-test',
    operatorAcknowledgedZavorthOwnedNamespace: true,
    redactedContentMigrationWriteFeatureFlagRequired: true,
  };
}

export class ZavorthWave4C2FirstRedactedSessionContentMigrationBatch {
  public constructor(private readonly source: ZavorthWave4C2FirstRedactedContentMigrationSource) {}

  public migrate(options: ZavorthWave4C2FirstRedactedContentMigrationOptions): ZavorthWave4C2FirstRedactedContentMigrationReceipt {
    const migrationRoot = assertMigrationRoot(options.migrationRoot);
    const migratedAt = options.migratedAt ?? ZAVORTH_WAVE4C2_FIRST_REDACTED_SESSION_CONTENT_MIGRATION_BATCH_NOW;
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

    const recordWrites = sourceItems(this.source).map((item): ZavorthWave4C2FirstRedactedContentMigrationWriteReceipt => {
      const relativePath = relativePathForItem(item);
      const absolutePath = path.join(migrationRoot, relativePath);
      const payload = migratedRecord(item, migratedAt);
      const write = writeJsonAtomic(absolutePath, payload);

      return {
        nativeContract: 'ZavorthWave4C2FirstRedactedContentMigrationWriteReceipt/v1',
        itemId: item.itemClass,
        idempotencyKey: item.idempotencyKey,
        checksum: item.checksum,
        relativePath,
        status: write.status,
        bytesWritten: write.bytesWritten,
        atomicWriteUsed: true,
        redactedContentMigrationActuallyPerformed: write.redactedContentMigrationActuallyPerformed,
        rawSecretSerialized: false,
      };
    });
    const allWritesSafe = recordWrites.every((write) => write.status === 'written' || write.status === 'already-present');
    const manifest: ZavorthWave4C2FirstRedactedContentMigrationManifest = {
      nativeContract: 'ZavorthWave4C2FirstRedactedContentMigrationManifest/v1',
      migrationNamespace: ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE,
      migrationNamespaceUri: ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE_URI,
      migratedAt,
      schemaVersion: ZAVORTH_WAVE4C2_SESSION_CONTENT_METADATA_SCHEMA_VERSION,
      batchId: 'wave4c2-redacted-session-content-batch-001',
      recordCount: recordWrites.length,
      records: recordWrites.map((write) => ({
        itemId: write.itemId,
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

    const backupRollback: ZavorthWave4C2FirstRedactedContentMigrationBackupRollbackManifest = {
      nativeContract: 'ZavorthWave4C2FirstRedactedContentMigrationBackupRollbackManifest/v1',
      migrationNamespace: ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE,
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
    receipt: ZavorthWave4C2FirstRedactedContentMigrationReceipt,
  ): ZavorthWave4C2FirstRedactedContentMigrationRollbackReceipt {
    const resolved = assertMigrationRoot(migrationRoot);
    if (!resolved.includes(`${path.sep}.tmp${path.sep}`)) {
      throw new Error(`Wave 4C.2 redacted content migration rollback is only allowed for controlled test namespace: ${resolved}`);
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
      nativeContract: 'ZavorthWave4C2FirstRedactedContentMigrationRollbackReceipt/v1',
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

  public cleanup(migrationRoot: string): ZavorthWave4C2FirstRedactedContentMigrationCleanupReceipt {
    const resolved = assertMigrationRoot(migrationRoot);
    if (!resolved.includes(`${path.sep}.tmp${path.sep}`)) {
      throw new Error(`Wave 4C.2 redacted content migration cleanup is only allowed for controlled test namespace: ${resolved}`);
    }

    const existedBefore = fs.existsSync(resolved);
    if (existedBefore) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }

    return {
      nativeContract: 'ZavorthWave4C2FirstRedactedContentMigrationCleanupReceipt/v1',
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
    featureFlag: ZavorthWave4C2FirstRedactedContentMigrationFeatureFlagGate;
    migratedAt: string;
    migrationRoot: string;
    recordWrites: ZavorthWave4C2FirstRedactedContentMigrationWriteReceipt[];
    validations: ZavorthWave4C2FirstRedactedContentMigrationValidationStatus[];
  }): ZavorthWave4C2FirstRedactedContentMigrationReceipt {
    const decision: ZavorthWave4C2FirstRedactedContentMigrationDecision = input.validations.includes('feature-flag-disabled')
      ? 'migration-write-blocked'
      : input.validations.length === 1 && input.validations[0] === 'valid'
        ? 'wave4c2-first-redacted-content-migration-ready'
        : 'blocked';

    return {
      nativeContract: 'ZavorthWave4C2FirstRedactedContentMigrationReceipt/v1',
      runtimeId: ZAVORTH_WAVE4C2_FIRST_REDACTED_SESSION_CONTENT_MIGRATION_BATCH_RUNTIME_ID,
      decision,
      migratedAt: input.migratedAt,
      migrationRoot: input.migrationRoot,
      migrationNamespace: ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE,
      migrationNamespaceUri: ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE_URI,
      featureFlag: input.featureFlag,
      validations: Array.from(new Set(input.validations)),
      recordWrites: input.recordWrites,
      manifestPath: path.join(input.migrationRoot, 'manifest.json'),
      backupRollbackManifestPath: path.join(input.migrationRoot, 'rollback', 'backup-rollback-manifest.json'),
      idempotencyAvoidedDuplicateWrites: input.recordWrites.some((write) => write.status === 'already-present'),
      wave4c2FirstRedactedContentMigrationBatchCreated: true,
      redactedContentMigrationWriteFeatureFlagRequired: true,
      redactedContentMigrationActuallyPerformedOnlyWhenFlagEnabled: true,
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
      backupRollbackMetadataCreated: input.backupRollbackMetadataCreated,
    };
  }
}

export function createZavorthWave4C2RedactedContentMigrationFeatureFlag(
  enabled: boolean,
): ZavorthWave4C2FirstRedactedContentMigrationFeatureFlagGate {
  return featureFlag(enabled);
}

export function createZavorthWave4C2FirstRedactedSessionContentMigrationBatchFixtureSource(
  overrides: Partial<ZavorthWave4C2FirstRedactedContentMigrationSource> = {},
): ZavorthWave4C2FirstRedactedContentMigrationSource {
  return {
    readinessPack: createZavorthWave4C2RawSessionContentMigrationReadinessPackFixture().normalization,
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

export function createZavorthWave4C2FirstRedactedSessionContentMigrationBatchFixture(
  source: ZavorthWave4C2FirstRedactedContentMigrationSource = createZavorthWave4C2FirstRedactedSessionContentMigrationBatchFixtureSource(),
): ZavorthWave4C2FirstRedactedSessionContentMigrationBatch {
  return new ZavorthWave4C2FirstRedactedSessionContentMigrationBatch(source);
}
