import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_SCHEMA_VERSION,
} from './ZavorthWave4CControlledSessionHistoryMigrationPlan.js';
import {
  ZAVORTH_WAVE4C_FIRST_CONTROLLED_SESSION_HISTORY_METADATA_MIGRATION_BATCH_RUNTIME_ID,
  ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE,
  ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE_URI,
} from './ZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatch.js';
import {
  normalizeZavorthNativeSessionHistoryRegistryFixture,
} from './ZavorthNativeSessionHistoryRegistry.js';
import {
  normalizeExternalAgentCommandCenterLiveAssimilationFixture,
} from './ExternalAgentCommandCenterLiveAssimilation.js';
import {
  normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture,
} from './ExternalAgentExternalExecutorSessionHistoryReadOnlyBridge.js';
import type {
  ZavorthWave4CSessionHistoryMigratableClass,
  ZavorthWave4CSessionHistoryRedactionEnvelope,
} from './ZavorthWave4CControlledSessionHistoryMigrationPlan.js';
import type {
  ZavorthWave4CFirstSessionMetadataMigratedRecord,
  ZavorthWave4CFirstSessionMetadataMigrationBackupRollbackManifest,
  ZavorthWave4CFirstSessionMetadataMigrationManifest,
} from './ZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatch.js';
import type {
  ZavorthNativeSessionHistoryRegistryNormalization,
} from './ZavorthNativeSessionHistoryRegistry.js';
import type {
  ExternalAgentCommandCenterLiveAssimilationNormalization,
} from './ExternalAgentCommandCenterLiveAssimilation.js';
import type {
  ExternalExecutorSessionHistoryReadOnlyBridgeNormalization,
} from './ExternalAgentExternalExecutorSessionHistoryReadOnlyBridge.js';

export const ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_LOAD_VERIFY_PARITY_NOW = '2026-04-30T16:00:00.000Z' as const;
export const ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_LOAD_VERIFY_PARITY_RUNTIME_ID = 'zavorth-wave4c-session-history-metadata-load-verify-parity' as const;

export type ZavorthWave4CSessionHistoryMetadataParityClassification =
  | 'corrupt'
  | 'degraded'
  | 'parity-ok'
  | 'parity-partial'
  | 'rejected';

export type ZavorthWave4CSessionHistoryMetadataLoadValidationStatus =
  | 'backup-rollback-missing'
  | 'checksum-invalid'
  | 'idempotency-invalid'
  | 'manifest-missing'
  | 'policy-invalid'
  | 'record-missing'
  | 'redaction-invalid'
  | 'schema-invalid'
  | 'scope-invalid'
  | 'source-not-ready'
  | 'valid';

export type ZavorthWave4CSessionHistoryMigratedNativeViewKind =
  | 'channel-transport-linkage'
  | 'message-metadata'
  | 'participant-metadata'
  | 'session'
  | 'thread'
  | 'timestamps-status';

export type ZavorthWave4CSessionHistoryMigratedNativeView = {
  nativeContract: 'ZavorthWave4CSessionHistoryMigratedNativeView/v1';
  viewId: string;
  itemId: ZavorthWave4CSessionHistoryMigratableClass;
  dataClass: ZavorthWave4CSessionHistoryMigratableClass;
  viewKind: ZavorthWave4CSessionHistoryMigratedNativeViewKind;
  label: string;
  status: 'available' | 'degraded' | 'unavailable';
  commandCenterConsumable: true;
  plannerConsumable: true;
  policyConsumable: true;
  observabilityConsumable: true;
  migratedSessionMetadataLoadedFromZavorthStorage: true;
  runtimeExternalExecutorRequiredForMigratedSessionMetadataLoad: false;
  runtimeExternalExecutorRequiredForMigratedSessionMetadataRender: false;
  sourceRuntimeAuthority: false;
  rawMessageContentMigrationAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4CSessionHistoryMetadataConsumerProjection = {
  nativeContract: 'ZavorthWave4CSessionHistoryMetadataConsumerProjection/v1';
  consumerId:
    | 'command-center'
    | 'command-http-observability-projection'
    | 'command-http-policy-preflight'
    | 'controlled-dry-run-planner';
  consumesMigratedSessionMetadata: true;
  nativeViewIds: string[];
  runtimeExternalExecutorRequiredForRender: false;
  runtimeExternalExecutorRequiredForLookup: false;
  adapterDefaultPath: false;
  publicExternalExecutorIdentityLeak: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4CSessionHistoryMetadataParityReceipt = {
  nativeContract: 'ZavorthWave4CSessionHistoryMetadataParityReceipt/v1';
  runtimeId: typeof ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_LOAD_VERIFY_PARITY_RUNTIME_ID;
  generatedAt: string;
  migrationRoot: string;
  migrationNamespace: typeof ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE;
  migrationNamespaceUri: typeof ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE_URI;
  sourceBatchRuntimeId: typeof ZAVORTH_WAVE4C_FIRST_CONTROLLED_SESSION_HISTORY_METADATA_MIGRATION_BATCH_RUNTIME_ID;
  classification: ZavorthWave4CSessionHistoryMetadataParityClassification;
  validations: ZavorthWave4CSessionHistoryMetadataLoadValidationStatus[];
  manifestRecordCount: number;
  loadedRecordCount: number;
  nativeViews: ZavorthWave4CSessionHistoryMigratedNativeView[];
  consumerProjections: ZavorthWave4CSessionHistoryMetadataConsumerProjection[];
  baselineComparison: {
    nativeRegistrySessionCount: number;
    nativeRegistryThreadCount: number;
    nativeRegistryMessageCount: number;
    readOnlyBridgeSessionViewCount: number;
    readOnlyBridgeCommandCenterViewCount: number;
    commandCenterSessionViewCount: number;
    commandCenterMessageMetadataViewCount: number;
    migratedNativeViewCount: number;
    commandCenterParity: ZavorthWave4CSessionHistoryMetadataParityClassification;
    plannerPolicyObservabilityParity: ZavorthWave4CSessionHistoryMetadataParityClassification;
  };
  wave4cSessionHistoryMetadataLoadVerifyCreated: true;
  migratedSessionMetadataLoadedFromZavorthStorage: true;
  runtimeExternalExecutorRequiredForMigratedSessionMetadataLoad: false;
  runtimeExternalExecutorRequiredForMigratedSessionMetadataRender: false;
  sessionHistoryMigrationScopeMetadataOnly: true;
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

export type ZavorthWave4CSessionHistoryMetadataLoadVerifySource = {
  controlledSessionHistoryMigrationPlanReady: true;
  firstSessionMetadataMigrationReady: true;
  nativeSessionHistoryRegistry: ZavorthNativeSessionHistoryRegistryNormalization;
  readOnlySessionHistoryBridge: ExternalExecutorSessionHistoryReadOnlyBridgeNormalization;
  commandCenterAssimilation: ExternalAgentCommandCenterLiveAssimilationNormalization;
  commandCenterNativeFirstReady: true;
  consumerExpansionReady: true;
  wave4bLowRiskExecutableMilestoneReady: true;
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

export type ZavorthWave4CSessionHistoryMetadataLoadVerifyOptions = {
  generatedAt?: string;
  migrationRoot: string;
};

export type ZavorthWave4CSessionHistoryMetadataLoadVerifyCleanupReceipt = {
  nativeContract: 'ZavorthWave4CSessionHistoryMetadataLoadVerifyCleanupReceipt/v1';
  migrationRoot: string;
  cleanupActuallyPerformed: boolean;
  namespaceExistsAfterCleanup: boolean;
  cleanupLimitedToControlledTestNamespace: true;
  sourceFileCopied: false;
  sourceDbCopied: false;
  rawSecretSerialized: false;
};

const EXPECTED_CHECKSUM_BY_DATA_CLASS: Record<ZavorthWave4CSessionHistoryMigratableClass, string> = {
  'channel-transport-linkage': 'sha256:wave4c-channel-transport-linkage-metadata',
  'redacted-message-metadata': 'sha256:wave4c-redacted-message-metadata',
  'redacted-participant-metadata': 'sha256:wave4c-redacted-participant-metadata',
  'session-metadata': 'sha256:wave4c-session-metadata',
  'thread-metadata': 'sha256:wave4c-thread-metadata',
  'timestamps-status': 'sha256:wave4c-timestamps-status',
};

const VIEW_KIND_BY_DATA_CLASS: Record<ZavorthWave4CSessionHistoryMigratableClass, ZavorthWave4CSessionHistoryMigratedNativeViewKind> = {
  'channel-transport-linkage': 'channel-transport-linkage',
  'redacted-message-metadata': 'message-metadata',
  'redacted-participant-metadata': 'participant-metadata',
  'session-metadata': 'session',
  'thread-metadata': 'thread',
  'timestamps-status': 'timestamps-status',
};

function assertMigrationRoot(migrationRoot: string): string {
  const resolved = path.resolve(migrationRoot);
  const cwd = path.resolve(process.cwd());

  if (!resolved.startsWith(`${cwd}${path.sep}`)) {
    throw new Error(`Wave 4C load/verify root must stay inside workspace: ${resolved}`);
  }
  if (!resolved.includes(`${path.sep}.tmp${path.sep}`) && !resolved.includes(`${path.sep}.zavorth${path.sep}`)) {
    throw new Error(`Wave 4C load/verify root must live under .tmp or .zavorth: ${resolved}`);
  }
  if (path.basename(resolved) !== ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE) {
    throw new Error(`Wave 4C load/verify root must end with ${ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE}: ${resolved}`);
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

function sourceReady(source: ZavorthWave4CSessionHistoryMetadataLoadVerifySource): boolean {
  return (
    source.controlledSessionHistoryMigrationPlanReady &&
    source.firstSessionMetadataMigrationReady &&
    source.nativeSessionHistoryRegistry.decision === 'native-session-history-registry-ready' &&
    source.readOnlySessionHistoryBridge.decision === 'external-executor-session-history-read-only-bridge-ready' &&
    source.commandCenterAssimilation.decision === 'command-center-live-assimilation-ready' &&
    source.commandCenterNativeFirstReady &&
    source.consumerExpansionReady &&
    source.wave4bLowRiskExecutableMilestoneReady &&
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

function nativeViewForRecord(record: ZavorthWave4CFirstSessionMetadataMigratedRecord): ZavorthWave4CSessionHistoryMigratedNativeView {
  const viewKind = VIEW_KIND_BY_DATA_CLASS[record.dataClass];

  return {
    nativeContract: 'ZavorthWave4CSessionHistoryMigratedNativeView/v1',
    viewId: `wave4c:migrated-session-history:${viewKind}:${record.dataClass}`,
    itemId: record.itemId,
    dataClass: record.dataClass,
    viewKind,
    label: `Zavorth ${viewKind} metadata: ${record.dataClass}`,
    status: 'available',
    commandCenterConsumable: true,
    plannerConsumable: true,
    policyConsumable: true,
    observabilityConsumable: true,
    migratedSessionMetadataLoadedFromZavorthStorage: true,
    runtimeExternalExecutorRequiredForMigratedSessionMetadataLoad: false,
    runtimeExternalExecutorRequiredForMigratedSessionMetadataRender: false,
    sourceRuntimeAuthority: false,
    rawMessageContentMigrationAllowed: false,
    rawSecretSerialized: false,
  };
}

function consumerProjections(
  views: ZavorthWave4CSessionHistoryMigratedNativeView[],
): ZavorthWave4CSessionHistoryMetadataConsumerProjection[] {
  const viewIds = views.map((view) => view.viewId);
  return [
    'command-center',
    'controlled-dry-run-planner',
    'command-http-policy-preflight',
    'command-http-observability-projection',
  ].map((consumerId) => ({
    nativeContract: 'ZavorthWave4CSessionHistoryMetadataConsumerProjection/v1',
    consumerId: consumerId as ZavorthWave4CSessionHistoryMetadataConsumerProjection['consumerId'],
    consumesMigratedSessionMetadata: true,
    nativeViewIds: viewIds,
    runtimeExternalExecutorRequiredForRender: false,
    runtimeExternalExecutorRequiredForLookup: false,
    adapterDefaultPath: false,
    publicExternalExecutorIdentityLeak: false,
    rawSecretSerialized: false,
  }));
}

function classify(
  validations: ZavorthWave4CSessionHistoryMetadataLoadValidationStatus[],
  manifestCount: number,
  loadedCount: number,
): ZavorthWave4CSessionHistoryMetadataParityClassification {
  if (validations.includes('redaction-invalid') || validations.includes('policy-invalid') || validations.includes('scope-invalid')) {
    return 'rejected';
  }
  if (validations.includes('checksum-invalid') || validations.includes('schema-invalid') || validations.includes('idempotency-invalid')) {
    return 'corrupt';
  }
  if (validations.includes('manifest-missing') || validations.includes('source-not-ready') || validations.includes('backup-rollback-missing')) {
    return 'degraded';
  }
  if (validations.includes('record-missing') || loadedCount < manifestCount) {
    return 'parity-partial';
  }
  return 'parity-ok';
}

export class ZavorthWave4CSessionHistoryMetadataLoadVerifyParity {
  public constructor(private readonly source: ZavorthWave4CSessionHistoryMetadataLoadVerifySource) {}

  public loadVerify(options: ZavorthWave4CSessionHistoryMetadataLoadVerifyOptions): ZavorthWave4CSessionHistoryMetadataParityReceipt {
    const migrationRoot = assertMigrationRoot(options.migrationRoot);
    const generatedAt = options.generatedAt ?? ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_LOAD_VERIFY_PARITY_NOW;
    const validations: ZavorthWave4CSessionHistoryMetadataLoadValidationStatus[] = [];

    if (!sourceReady(this.source)) {
      validations.push('source-not-ready');
    }

    const manifest = readJson<ZavorthWave4CFirstSessionMetadataMigrationManifest>(path.join(migrationRoot, 'manifest.json'));
    if (
      manifest?.nativeContract !== 'ZavorthWave4CFirstSessionMetadataMigrationManifest/v1' ||
      manifest.migrationNamespace !== ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE ||
      manifest.migrationNamespaceUri !== ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE_URI ||
      manifest.schemaVersion !== ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_SCHEMA_VERSION ||
      manifest.rawSecretSerialized
    ) {
      validations.push(manifest ? 'schema-invalid' : 'manifest-missing');
    }

    const backupRollback = readJson<ZavorthWave4CFirstSessionMetadataMigrationBackupRollbackManifest>(
      path.join(migrationRoot, 'rollback', 'backup-rollback-manifest.json'),
    );
    if (
      backupRollback?.nativeContract !== 'ZavorthWave4CFirstSessionMetadataMigrationBackupRollbackManifest/v1' ||
      backupRollback.migrationNamespace !== ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE ||
      backupRollback.rawSecretSerialized
    ) {
      validations.push('backup-rollback-missing');
    }

    const records = (manifest?.records ?? []).map((entry) => {
      const record = readJson<ZavorthWave4CFirstSessionMetadataMigratedRecord>(path.join(migrationRoot, entry.relativePath));
      if (!record) {
        validations.push('record-missing');
        return undefined;
      }
      if (
        record.nativeContract !== 'ZavorthWave4CFirstSessionMetadataMigratedRecord/v1' ||
        record.schemaVersion !== ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_SCHEMA_VERSION
      ) {
        validations.push('schema-invalid');
      }
      if (
        record.checksum !== entry.checksum ||
        record.checksum !== EXPECTED_CHECKSUM_BY_DATA_CLASS[record.dataClass]
      ) {
        validations.push('checksum-invalid');
      }
      if (record.idempotencyKey !== entry.idempotencyKey || record.idempotencyKey !== `wave4c:session-history-metadata:v1:${record.dataClass}`) {
        validations.push('idempotency-invalid');
      }
      if (!redactionEnvelopeValid(record.redactionEnvelope) || record.rawSecretSerialized || record.payloadSensitiveFieldsPersisted) {
        validations.push('redaction-invalid');
      }
      if (record.policyDecision !== 'allow-session-history-metadata-plan' || record.payloadKind !== 'session-history-metadata-only') {
        validations.push('policy-invalid');
      }
      if (!Object.prototype.hasOwnProperty.call(EXPECTED_CHECKSUM_BY_DATA_CLASS, record.dataClass)) {
        validations.push('scope-invalid');
      }
      return record;
    }).filter((record): record is ZavorthWave4CFirstSessionMetadataMigratedRecord => Boolean(record));

    if (validations.length === 0) {
      validations.push('valid');
    }

    const nativeViews = records.map(nativeViewForRecord);
    const projections = consumerProjections(nativeViews);
    const manifestRecordCount = manifest?.recordCount ?? 0;
    const classification = classify(validations, manifestRecordCount, records.length);

    return {
      nativeContract: 'ZavorthWave4CSessionHistoryMetadataParityReceipt/v1',
      runtimeId: ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_LOAD_VERIFY_PARITY_RUNTIME_ID,
      generatedAt,
      migrationRoot,
      migrationNamespace: ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE,
      migrationNamespaceUri: ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE_URI,
      sourceBatchRuntimeId: ZAVORTH_WAVE4C_FIRST_CONTROLLED_SESSION_HISTORY_METADATA_MIGRATION_BATCH_RUNTIME_ID,
      classification,
      validations: Array.from(new Set(validations)),
      manifestRecordCount,
      loadedRecordCount: records.length,
      nativeViews,
      consumerProjections: projections,
      baselineComparison: {
        nativeRegistrySessionCount: this.source.nativeSessionHistoryRegistry.registry.sessions.length,
        nativeRegistryThreadCount: this.source.nativeSessionHistoryRegistry.registry.threads.length,
        nativeRegistryMessageCount: this.source.nativeSessionHistoryRegistry.registry.messages.length,
        readOnlyBridgeSessionViewCount: this.source.readOnlySessionHistoryBridge.sessionViews.length,
        readOnlyBridgeCommandCenterViewCount: this.source.readOnlySessionHistoryBridge.commandCenterViews.length,
        commandCenterSessionViewCount: this.source.commandCenterAssimilation.viewModel.sessions.length,
        commandCenterMessageMetadataViewCount: this.source.commandCenterAssimilation.viewModel.messages.length,
        migratedNativeViewCount: nativeViews.length,
        commandCenterParity: classification === 'parity-ok' ? 'parity-ok' : classification,
        plannerPolicyObservabilityParity: classification === 'parity-ok' ? 'parity-ok' : classification,
      },
      wave4cSessionHistoryMetadataLoadVerifyCreated: true,
      migratedSessionMetadataLoadedFromZavorthStorage: true,
      runtimeExternalExecutorRequiredForMigratedSessionMetadataLoad: false,
      runtimeExternalExecutorRequiredForMigratedSessionMetadataRender: false,
      sessionHistoryMigrationScopeMetadataOnly: true,
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

  public cleanup(migrationRoot: string): ZavorthWave4CSessionHistoryMetadataLoadVerifyCleanupReceipt {
    const resolved = assertMigrationRoot(migrationRoot);
    if (!resolved.includes(`${path.sep}.tmp${path.sep}`)) {
      throw new Error(`Wave 4C session metadata load/verify cleanup is only allowed for controlled test namespace: ${resolved}`);
    }

    const existedBefore = fs.existsSync(resolved);
    if (existedBefore) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }

    return {
      nativeContract: 'ZavorthWave4CSessionHistoryMetadataLoadVerifyCleanupReceipt/v1',
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

export function createZavorthWave4CSessionHistoryMetadataLoadVerifyParityFixtureSource(
  overrides: Partial<ZavorthWave4CSessionHistoryMetadataLoadVerifySource> = {},
): ZavorthWave4CSessionHistoryMetadataLoadVerifySource {
  return {
    controlledSessionHistoryMigrationPlanReady: true,
    firstSessionMetadataMigrationReady: true,
    nativeSessionHistoryRegistry: normalizeZavorthNativeSessionHistoryRegistryFixture(),
    readOnlySessionHistoryBridge: normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture(),
    commandCenterAssimilation: normalizeExternalAgentCommandCenterLiveAssimilationFixture(),
    commandCenterNativeFirstReady: true,
    consumerExpansionReady: true,
    wave4bLowRiskExecutableMilestoneReady: true,
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

export function createZavorthWave4CSessionHistoryMetadataLoadVerifyParityFixture(
  source: ZavorthWave4CSessionHistoryMetadataLoadVerifySource = createZavorthWave4CSessionHistoryMetadataLoadVerifyParityFixtureSource(),
): ZavorthWave4CSessionHistoryMetadataLoadVerifyParity {
  return new ZavorthWave4CSessionHistoryMetadataLoadVerifyParity(source);
}
