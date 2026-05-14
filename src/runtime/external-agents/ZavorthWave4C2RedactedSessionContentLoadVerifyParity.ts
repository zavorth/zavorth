import fs from 'node:fs';
import path from 'node:path';

import {
  normalizeZavorthNativeSessionHistoryRegistryFixture,
} from './ZavorthNativeSessionHistoryRegistry.js';
import {
  ZAVORTH_WAVE4C2_FIRST_REDACTED_SESSION_CONTENT_MIGRATION_BATCH_RUNTIME_ID,
  ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE,
  ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE_URI,
} from './ZavorthWave4C2FirstRedactedSessionContentMigrationBatch.js';
import {
  ZAVORTH_WAVE4C2_SESSION_CONTENT_METADATA_SCHEMA_VERSION,
  createZavorthWave4C2RawSessionContentMigrationReadinessPackFixture,
} from './ZavorthWave4C2RawSessionContentMigrationReadinessPack.js';
import {
  normalizeExternalAgentCommandCenterLiveAssimilationFixture,
} from './ExternalAgentCommandCenterLiveAssimilation.js';
import {
  normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture,
} from './ExternalAgentExternalExecutorSessionHistoryReadOnlyBridge.js';
import type {
  ZavorthNativeSessionHistoryRegistryNormalization,
} from './ZavorthNativeSessionHistoryRegistry.js';
import type {
  ZavorthWave4C2FirstRedactedContentMigratedRecord,
  ZavorthWave4C2FirstRedactedContentMigrationBackupRollbackManifest,
  ZavorthWave4C2FirstRedactedContentMigrationManifest,
  ZavorthWave4C2RedactedContentPayload,
} from './ZavorthWave4C2FirstRedactedSessionContentMigrationBatch.js';
import type {
  ZavorthWave4C2ContentRedactionPolicyRule,
  ZavorthWave4C2RawSessionContentMigrationReadinessPackNormalization,
  ZavorthWave4C2ReadinessBatchItemClass,
} from './ZavorthWave4C2RawSessionContentMigrationReadinessPack.js';
import type {
  ExternalAgentCommandCenterLiveAssimilationNormalization,
} from './ExternalAgentCommandCenterLiveAssimilation.js';
import type {
  ExternalExecutorSessionHistoryReadOnlyBridgeNormalization,
} from './ExternalAgentExternalExecutorSessionHistoryReadOnlyBridge.js';

export const ZAVORTH_WAVE4C2_REDACTED_SESSION_CONTENT_LOAD_VERIFY_PARITY_NOW = '2026-05-01T00:00:00.000Z' as const;
export const ZAVORTH_WAVE4C2_REDACTED_SESSION_CONTENT_LOAD_VERIFY_PARITY_RUNTIME_ID = 'zavorth-wave4c2-redacted-session-content-load-verify-parity' as const;

export type ZavorthWave4C2RedactedContentParityClassification =
  | 'corrupt'
  | 'degraded'
  | 'parity-ok'
  | 'parity-partial'
  | 'rejected';

export type ZavorthWave4C2RedactedContentLoadValidationStatus =
  | 'backup-rollback-missing'
  | 'checksum-invalid'
  | 'content-policy-invalid'
  | 'idempotency-invalid'
  | 'manifest-missing'
  | 'policy-invalid'
  | 'record-missing'
  | 'redaction-invalid'
  | 'schema-invalid'
  | 'scope-invalid'
  | 'source-not-ready'
  | 'valid';

export type ZavorthWave4C2RedactedContentNativeViewKind =
  | 'content-hash'
  | 'content-length-count-metadata'
  | 'participant-channel-thread-linkage'
  | 'redacted-excerpt'
  | 'sensitivity-classification'
  | 'session-content-presence'
  | 'timestamps-status';

export type ZavorthWave4C2RedactedContentNativeView = {
  nativeContract: 'ZavorthWave4C2RedactedContentNativeView/v1';
  viewId: string;
  itemId: ZavorthWave4C2ReadinessBatchItemClass;
  viewKind: ZavorthWave4C2RedactedContentNativeViewKind;
  label: string;
  status: 'available' | 'degraded' | 'unavailable';
  payload: ZavorthWave4C2RedactedContentPayload;
  contentHash?: string;
  contentLengthBucket?: ZavorthWave4C2RedactedContentPayload['contentLengthBucket'];
  redactedExcerpt?: ZavorthWave4C2RedactedContentPayload['redactedExcerpt'];
  sensitivityClassification: ZavorthWave4C2RedactedContentPayload['sensitivityClassification'];
  commandCenterConsumable: true;
  plannerConsumable: true;
  policyConsumable: true;
  observabilityConsumable: true;
  redactedContentLoadedFromZavorthStorage: true;
  runtimeExternalExecutorRequiredForRedactedContentLoad: false;
  runtimeExternalExecutorRequiredForRedactedContentRender: false;
  sourceRuntimeAuthority: false;
  rawMessageContentMigrationAllowed: false;
  rawMessageContentSerialized: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4C2RedactedContentConsumerProjection = {
  nativeContract: 'ZavorthWave4C2RedactedContentConsumerProjection/v1';
  consumerId:
    | 'command-center'
    | 'command-http-observability-projection'
    | 'command-http-policy-preflight'
    | 'controlled-dry-run-planner';
  consumesRedactedSessionContent: true;
  nativeViewIds: string[];
  runtimeExternalExecutorRequiredForRender: false;
  runtimeExternalExecutorRequiredForLookup: false;
  adapterDefaultPath: false;
  publicExternalExecutorIdentityLeak: false;
  rawMessageContentSerialized: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4C2RedactedContentParityReceipt = {
  nativeContract: 'ZavorthWave4C2RedactedContentParityReceipt/v1';
  runtimeId: typeof ZAVORTH_WAVE4C2_REDACTED_SESSION_CONTENT_LOAD_VERIFY_PARITY_RUNTIME_ID;
  generatedAt: string;
  migrationRoot: string;
  migrationNamespace: typeof ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE;
  migrationNamespaceUri: typeof ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE_URI;
  sourceBatchRuntimeId: typeof ZAVORTH_WAVE4C2_FIRST_REDACTED_SESSION_CONTENT_MIGRATION_BATCH_RUNTIME_ID;
  classification: ZavorthWave4C2RedactedContentParityClassification;
  validations: ZavorthWave4C2RedactedContentLoadValidationStatus[];
  manifestRecordCount: number;
  loadedRecordCount: number;
  nativeViews: ZavorthWave4C2RedactedContentNativeView[];
  consumerProjections: ZavorthWave4C2RedactedContentConsumerProjection[];
  baselineComparison: {
    migratedSessionMetadataBaselineReady: true;
    nativeRegistrySessionCount: number;
    nativeRegistryThreadCount: number;
    nativeRegistryMessageCount: number;
    readOnlyBridgeSessionViewCount: number;
    readOnlyBridgeCommandCenterViewCount: number;
    commandCenterSessionViewCount: number;
    commandCenterMessageMetadataViewCount: number;
    redactedContentNativeViewCount: number;
    commandCenterParity: ZavorthWave4C2RedactedContentParityClassification;
    plannerPolicyObservabilityParity: ZavorthWave4C2RedactedContentParityClassification;
  };
  wave4c2RedactedContentLoadVerifyCreated: true;
  redactedContentLoadedFromZavorthStorage: true;
  runtimeExternalExecutorRequiredForRedactedContentLoad: false;
  runtimeExternalExecutorRequiredForRedactedContentRender: false;
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

export type ZavorthWave4C2RedactedContentLoadVerifySource = {
  readinessPack: ZavorthWave4C2RawSessionContentMigrationReadinessPackNormalization;
  firstRedactedContentMigrationReady: true;
  sessionMetadataMigrationLoadVerifyReady: true;
  nativeSessionHistoryRegistry: ZavorthNativeSessionHistoryRegistryNormalization;
  readOnlySessionHistoryBridge: ExternalExecutorSessionHistoryReadOnlyBridgeNormalization;
  commandCenterAssimilation: ExternalAgentCommandCenterLiveAssimilationNormalization;
  commandCenterNativeFirstReady: true;
  consumerExpansionReady: true;
  externalExecutorLiveRequiredForLoad: false;
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

export type ZavorthWave4C2RedactedContentLoadVerifyOptions = {
  generatedAt?: string;
  migrationRoot: string;
};

export type ZavorthWave4C2RedactedContentLoadVerifyCleanupReceipt = {
  nativeContract: 'ZavorthWave4C2RedactedContentLoadVerifyCleanupReceipt/v1';
  migrationRoot: string;
  cleanupActuallyPerformed: boolean;
  namespaceExistsAfterCleanup: boolean;
  cleanupLimitedToControlledTestNamespace: true;
  sourceFileCopied: false;
  sourceDbCopied: false;
  rawSecretSerialized: false;
};

const EXPECTED_ITEM_CLASSES = new Set<ZavorthWave4C2ReadinessBatchItemClass>([
  'channel-linkage-metadata',
  'message-content-hash',
  'message-redacted-excerpt',
  'message-token-count-bucket',
  'participant-count-kind',
  'session-content-presence',
  'timestamp-range',
]);

const VIEW_KIND_BY_ITEM_CLASS: Record<ZavorthWave4C2ReadinessBatchItemClass, ZavorthWave4C2RedactedContentNativeViewKind> = {
  'channel-linkage-metadata': 'participant-channel-thread-linkage',
  'message-content-hash': 'content-hash',
  'message-redacted-excerpt': 'redacted-excerpt',
  'message-token-count-bucket': 'content-length-count-metadata',
  'participant-count-kind': 'participant-channel-thread-linkage',
  'session-content-presence': 'session-content-presence',
  'timestamp-range': 'timestamps-status',
};

function assertMigrationRoot(migrationRoot: string): string {
  const resolved = path.resolve(migrationRoot);
  const cwd = path.resolve(process.cwd());

  if (!resolved.startsWith(`${cwd}${path.sep}`)) {
    throw new Error(`Wave 4C.2 redacted content load/verify root must stay inside workspace: ${resolved}`);
  }
  if (!resolved.includes(`${path.sep}.tmp${path.sep}`) && !resolved.includes(`${path.sep}.zavorth${path.sep}`)) {
    throw new Error(`Wave 4C.2 redacted content load/verify root must live under .tmp or .zavorth: ${resolved}`);
  }
  if (path.basename(resolved) !== ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE) {
    throw new Error(`Wave 4C.2 redacted content load/verify root must end with ${ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE}: ${resolved}`);
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

function redactionEnvelopeValid(record: ZavorthWave4C2FirstRedactedContentMigratedRecord): boolean {
  const envelope = record.redactionEnvelope;
  return (
    envelope.nativeContract === 'ZavorthWave4C2RedactionEnvelope/v1' &&
    envelope.rawMessageContentSerialized === false &&
    envelope.rawSecretSerialized === false &&
    envelope.rawSqlitePayloadSerialized === false &&
    envelope.attachmentContentSerialized === false &&
    envelope.binaryPayloadSerialized === false &&
    envelope.sourceIdentityPublic === false &&
    envelope.provenanceInternalOnly === true &&
    record.payload.rawMessageContentSerialized === false &&
    record.payload.rawSecretSerialized === false &&
    record.payload.attachmentContentSerialized === false &&
    record.payload.sqlitePayloadSerialized === false &&
    record.payload.contentRawStored === false &&
    record.rawSecretSerialized === false &&
    !record.payloadSensitiveFieldsPersisted &&
    envelope.forbiddenFields.includes('rawMessageContent') &&
    envelope.forbiddenFields.includes('rawSecretValue') &&
    envelope.forbiddenFields.includes('sqlitePayload') &&
    envelope.forbiddenFields.includes('attachmentBody') &&
    envelope.forbiddenFields.includes('binaryPayload')
  );
}

function expectedChecksumForItem(itemClass: ZavorthWave4C2ReadinessBatchItemClass): string {
  return `sha256:wave4c2-derived-content-metadata:${itemClass}`;
}

function expectedIdempotencyKeyForItem(itemClass: ZavorthWave4C2ReadinessBatchItemClass): string {
  return `wave4c2:derived-content-metadata:v1:${itemClass}`;
}

function policyForItem(
  itemClass: ZavorthWave4C2ReadinessBatchItemClass,
  rules: ZavorthWave4C2ContentRedactionPolicyRule[],
): boolean {
  const sensitivity = itemClass === 'participant-count-kind'
    ? 'participant-identifier'
    : itemClass === 'timestamp-range'
      ? 'timestamp'
      : itemClass === 'channel-linkage-metadata'
        ? 'channel-link'
        : 'message-content';
  const rule = rules.find((candidate) => candidate.sensitivityClass === sensitivity);

  if (!rule || rule.policyDecision !== 'allow-derived-metadata-only') {
    return false;
  }
  if (itemClass === 'message-content-hash') {
    return rule.allowedDerivedOutputs.includes('hash');
  }
  if (itemClass === 'message-redacted-excerpt') {
    return rule.allowedDerivedOutputs.includes('redacted-excerpt');
  }
  if (itemClass === 'message-token-count-bucket' ||
    itemClass === 'participant-count-kind' ||
    itemClass === 'session-content-presence') {
    return rule.allowedDerivedOutputs.includes('count');
  }
  return rule.allowedDerivedOutputs.includes('summary-metadata');
}

function sourceReady(source: ZavorthWave4C2RedactedContentLoadVerifySource): boolean {
  return (
    source.readinessPack.decision === 'wave4c2-raw-session-content-migration-readiness-pack-ready' &&
    source.firstRedactedContentMigrationReady &&
    source.sessionMetadataMigrationLoadVerifyReady &&
    source.nativeSessionHistoryRegistry.decision === 'native-session-history-registry-ready' &&
    source.readOnlySessionHistoryBridge.decision === 'external-executor-session-history-read-only-bridge-ready' &&
    source.commandCenterAssimilation.decision === 'command-center-live-assimilation-ready' &&
    source.commandCenterNativeFirstReady &&
    source.consumerExpansionReady &&
    !source.externalExecutorLiveRequiredForLoad &&
    !source.rawMessageContentMigrationAttempted &&
    !source.rawSqliteCopyAttempted &&
    !source.sqliteWriteAttempted &&
    !source.attachmentsMigrationAttempted &&
    !source.rawSecretMigrationAttempted &&
    !source.workspaceLogsCacheRawMigrationAttempted &&
    !source.executionStateMigrationAttempted &&
    !source.messageSendAttempted &&
    !source.providerExecutionAttempted &&
    !source.commandExecutionAttempted &&
    !source.toolExecutionAttempted &&
    !source.sourceModuleCopyAttempted &&
    !source.adapterRemovalAttempted &&
    !source.publicExternalExecutorIdentityExposed &&
    !source.rawSecretSerialized
  );
}

function nativeViewForRecord(record: ZavorthWave4C2FirstRedactedContentMigratedRecord): ZavorthWave4C2RedactedContentNativeView {
  const viewKind = VIEW_KIND_BY_ITEM_CLASS[record.itemId];

  return {
    nativeContract: 'ZavorthWave4C2RedactedContentNativeView/v1',
    viewId: `wave4c2:redacted-session-content:${viewKind}:${record.itemId}`,
    itemId: record.itemId,
    viewKind,
    label: `Zavorth redacted content metadata: ${record.itemId}`,
    status: 'available',
    payload: record.payload,
    contentHash: record.payload.contentHash,
    contentLengthBucket: record.payload.contentLengthBucket,
    redactedExcerpt: record.payload.redactedExcerpt,
    sensitivityClassification: record.payload.sensitivityClassification,
    commandCenterConsumable: true,
    plannerConsumable: true,
    policyConsumable: true,
    observabilityConsumable: true,
    redactedContentLoadedFromZavorthStorage: true,
    runtimeExternalExecutorRequiredForRedactedContentLoad: false,
    runtimeExternalExecutorRequiredForRedactedContentRender: false,
    sourceRuntimeAuthority: false,
    rawMessageContentMigrationAllowed: false,
    rawMessageContentSerialized: false,
    rawSecretSerialized: false,
  };
}

function consumerProjections(
  views: ZavorthWave4C2RedactedContentNativeView[],
): ZavorthWave4C2RedactedContentConsumerProjection[] {
  const nativeViewIds = views.map((view) => view.viewId);

  return [
    'command-center',
    'controlled-dry-run-planner',
    'command-http-policy-preflight',
    'command-http-observability-projection',
  ].map((consumerId) => ({
    nativeContract: 'ZavorthWave4C2RedactedContentConsumerProjection/v1',
    consumerId: consumerId as ZavorthWave4C2RedactedContentConsumerProjection['consumerId'],
    consumesRedactedSessionContent: true,
    nativeViewIds,
    runtimeExternalExecutorRequiredForRender: false,
    runtimeExternalExecutorRequiredForLookup: false,
    adapterDefaultPath: false,
    publicExternalExecutorIdentityLeak: false,
    rawMessageContentSerialized: false,
    rawSecretSerialized: false,
  }));
}

function classify(
  validations: ZavorthWave4C2RedactedContentLoadValidationStatus[],
  manifestCount: number,
  loadedCount: number,
): ZavorthWave4C2RedactedContentParityClassification {
  if (
    validations.includes('redaction-invalid') ||
    validations.includes('content-policy-invalid') ||
    validations.includes('policy-invalid') ||
    validations.includes('scope-invalid')
  ) {
    return 'rejected';
  }
  if (
    validations.includes('checksum-invalid') ||
    validations.includes('schema-invalid') ||
    validations.includes('idempotency-invalid')
  ) {
    return 'corrupt';
  }
  if (
    validations.includes('manifest-missing') ||
    validations.includes('source-not-ready') ||
    validations.includes('backup-rollback-missing')
  ) {
    return 'degraded';
  }
  if (validations.includes('record-missing') || loadedCount < manifestCount) {
    return 'parity-partial';
  }
  return 'parity-ok';
}

export class ZavorthWave4C2RedactedSessionContentLoadVerifyParity {
  public constructor(private readonly source: ZavorthWave4C2RedactedContentLoadVerifySource) {}

  public loadVerify(options: ZavorthWave4C2RedactedContentLoadVerifyOptions): ZavorthWave4C2RedactedContentParityReceipt {
    const migrationRoot = assertMigrationRoot(options.migrationRoot);
    const generatedAt = options.generatedAt ?? ZAVORTH_WAVE4C2_REDACTED_SESSION_CONTENT_LOAD_VERIFY_PARITY_NOW;
    const validations: ZavorthWave4C2RedactedContentLoadValidationStatus[] = [];

    if (!sourceReady(this.source)) {
      validations.push('source-not-ready');
    }

    const manifest = readJson<ZavorthWave4C2FirstRedactedContentMigrationManifest>(path.join(migrationRoot, 'manifest.json'));
    if (
      manifest?.nativeContract !== 'ZavorthWave4C2FirstRedactedContentMigrationManifest/v1' ||
      manifest.migrationNamespace !== ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE ||
      manifest.migrationNamespaceUri !== ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE_URI ||
      manifest.schemaVersion !== ZAVORTH_WAVE4C2_SESSION_CONTENT_METADATA_SCHEMA_VERSION ||
      manifest.rawSecretSerialized
    ) {
      validations.push(manifest ? 'schema-invalid' : 'manifest-missing');
    }

    const backupRollback = readJson<ZavorthWave4C2FirstRedactedContentMigrationBackupRollbackManifest>(
      path.join(migrationRoot, 'rollback', 'backup-rollback-manifest.json'),
    );
    if (
      backupRollback?.nativeContract !== 'ZavorthWave4C2FirstRedactedContentMigrationBackupRollbackManifest/v1' ||
      backupRollback.migrationNamespace !== ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE ||
      backupRollback.rawSecretSerialized
    ) {
      validations.push('backup-rollback-missing');
    }

    const records = (manifest?.records ?? []).map((entry) => {
      const record = readJson<ZavorthWave4C2FirstRedactedContentMigratedRecord>(path.join(migrationRoot, entry.relativePath));
      if (!record) {
        validations.push('record-missing');
        return undefined;
      }
      if (
        record.nativeContract !== 'ZavorthWave4C2FirstRedactedContentMigratedRecord/v1' ||
        record.schemaVersion !== ZAVORTH_WAVE4C2_SESSION_CONTENT_METADATA_SCHEMA_VERSION
      ) {
        validations.push('schema-invalid');
      }
      if (
        record.checksum !== entry.checksum ||
        record.checksum !== expectedChecksumForItem(record.itemId)
      ) {
        validations.push('checksum-invalid');
      }
      if (
        record.idempotencyKey !== entry.idempotencyKey ||
        record.idempotencyKey !== expectedIdempotencyKeyForItem(record.itemId)
      ) {
        validations.push('idempotency-invalid');
      }
      if (!redactionEnvelopeValid(record)) {
        validations.push('redaction-invalid');
      }
      if (
        record.policyDecision !== 'allow-future-derived-content-metadata-batch' ||
        record.contentPolicyDecision !== 'allow-derived-metadata-only' ||
        record.payload.payloadKind !== 'redacted-session-content-derived-metadata-only'
      ) {
        validations.push('policy-invalid');
      }
      if (!EXPECTED_ITEM_CLASSES.has(record.itemId)) {
        validations.push('scope-invalid');
      }
      if (!policyForItem(record.itemId, this.source.readinessPack.redactionPolicy)) {
        validations.push('content-policy-invalid');
      }
      return record;
    }).filter((record): record is ZavorthWave4C2FirstRedactedContentMigratedRecord => Boolean(record));

    if (validations.length === 0) {
      validations.push('valid');
    }

    const nativeViews = records.map(nativeViewForRecord);
    const projections = consumerProjections(nativeViews);
    const manifestRecordCount = manifest?.recordCount ?? 0;
    const classification = classify(validations, manifestRecordCount, records.length);

    return {
      nativeContract: 'ZavorthWave4C2RedactedContentParityReceipt/v1',
      runtimeId: ZAVORTH_WAVE4C2_REDACTED_SESSION_CONTENT_LOAD_VERIFY_PARITY_RUNTIME_ID,
      generatedAt,
      migrationRoot,
      migrationNamespace: ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE,
      migrationNamespaceUri: ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE_URI,
      sourceBatchRuntimeId: ZAVORTH_WAVE4C2_FIRST_REDACTED_SESSION_CONTENT_MIGRATION_BATCH_RUNTIME_ID,
      classification,
      validations: Array.from(new Set(validations)),
      manifestRecordCount,
      loadedRecordCount: records.length,
      nativeViews,
      consumerProjections: projections,
      baselineComparison: {
        migratedSessionMetadataBaselineReady: this.source.sessionMetadataMigrationLoadVerifyReady,
        nativeRegistrySessionCount: this.source.nativeSessionHistoryRegistry.registry.sessions.length,
        nativeRegistryThreadCount: this.source.nativeSessionHistoryRegistry.registry.threads.length,
        nativeRegistryMessageCount: this.source.nativeSessionHistoryRegistry.registry.messages.length,
        readOnlyBridgeSessionViewCount: this.source.readOnlySessionHistoryBridge.sessionViews.length,
        readOnlyBridgeCommandCenterViewCount: this.source.readOnlySessionHistoryBridge.commandCenterViews.length,
        commandCenterSessionViewCount: this.source.commandCenterAssimilation.viewModel.sessions.length,
        commandCenterMessageMetadataViewCount: this.source.commandCenterAssimilation.viewModel.messages.length,
        redactedContentNativeViewCount: nativeViews.length,
        commandCenterParity: classification === 'parity-ok' ? 'parity-ok' : classification,
        plannerPolicyObservabilityParity: classification === 'parity-ok' ? 'parity-ok' : classification,
      },
      wave4c2RedactedContentLoadVerifyCreated: true,
      redactedContentLoadedFromZavorthStorage: true,
      runtimeExternalExecutorRequiredForRedactedContentLoad: false,
      runtimeExternalExecutorRequiredForRedactedContentRender: false,
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

  public cleanup(migrationRoot: string): ZavorthWave4C2RedactedContentLoadVerifyCleanupReceipt {
    const resolved = assertMigrationRoot(migrationRoot);
    if (!resolved.includes(`${path.sep}.tmp${path.sep}`)) {
      throw new Error(`Wave 4C.2 redacted content load/verify cleanup is only allowed for controlled test namespace: ${resolved}`);
    }

    const existedBefore = fs.existsSync(resolved);
    if (existedBefore) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }

    return {
      nativeContract: 'ZavorthWave4C2RedactedContentLoadVerifyCleanupReceipt/v1',
      migrationRoot: resolved,
      cleanupActuallyPerformed: existedBefore,
      namespaceExistsAfterCleanup: fs.existsSync(resolved),
      cleanupLimitedToControlledTestNamespace: true,
      sourceFileCopied: false,
      sourceDbCopied: false,
      rawSecretSerialized: false,
    };
  }
}

export function createZavorthWave4C2RedactedSessionContentLoadVerifyParityFixtureSource(
  overrides: Partial<ZavorthWave4C2RedactedContentLoadVerifySource> = {},
): ZavorthWave4C2RedactedContentLoadVerifySource {
  return {
    readinessPack: createZavorthWave4C2RawSessionContentMigrationReadinessPackFixture().normalization,
    firstRedactedContentMigrationReady: true,
    sessionMetadataMigrationLoadVerifyReady: true,
    nativeSessionHistoryRegistry: normalizeZavorthNativeSessionHistoryRegistryFixture(),
    readOnlySessionHistoryBridge: normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture(),
    commandCenterAssimilation: normalizeExternalAgentCommandCenterLiveAssimilationFixture(),
    commandCenterNativeFirstReady: true,
    consumerExpansionReady: true,
    externalExecutorLiveRequiredForLoad: false,
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

export function createZavorthWave4C2RedactedSessionContentLoadVerifyParityFixture(
  source: ZavorthWave4C2RedactedContentLoadVerifySource = createZavorthWave4C2RedactedSessionContentLoadVerifyParityFixtureSource(),
): ZavorthWave4C2RedactedSessionContentLoadVerifyParity {
  return new ZavorthWave4C2RedactedSessionContentLoadVerifyParity(source);
}
