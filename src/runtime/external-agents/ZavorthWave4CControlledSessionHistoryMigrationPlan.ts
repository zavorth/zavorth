export const ZAVORTH_WAVE4C_CONTROLLED_SESSION_HISTORY_MIGRATION_PLAN_NOW = '2026-04-30T14:00:00.000Z' as const;
export const ZAVORTH_WAVE4C_CONTROLLED_SESSION_HISTORY_MIGRATION_PLAN_RUNTIME_ID = 'zavorth-wave4c-controlled-session-history-migration-plan' as const;
export const ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_SCHEMA_VERSION = 'zavorth-wave4c-session-history-metadata/v1' as const;

export type ZavorthWave4CSessionHistoryMigrationPlanDecision =
  | 'blocked'
  | 'wave4c-controlled-session-history-migration-plan-ready';

export type ZavorthWave4CSessionHistoryMigratableClass =
  | 'channel-transport-linkage'
  | 'redacted-message-metadata'
  | 'redacted-participant-metadata'
  | 'session-metadata'
  | 'thread-metadata'
  | 'timestamps-status';

export type ZavorthWave4CSessionHistoryBlockedClass =
  | 'attachments-files'
  | 'raw-message-content'
  | 'raw-sqlite-db-copy'
  | 'secrets-tokens'
  | 'sqlite-write'
  | 'workspace-logs-cache-raw';

export type ZavorthWave4CSessionHistoryRedactionEnvelope = {
  nativeContract: 'ZavorthWave4CSessionHistoryRedactionEnvelope/v1';
  rawMessageContentSerialized: false;
  rawSecretSerialized: false;
  rawSqlitePayloadSerialized: false;
  attachmentContentSerialized: false;
  sourceIdentityPublic: false;
  provenanceInternalOnly: true;
  safeMetadataOnly: true;
  forbiddenFields: [
    'rawMessageContent',
    'rawSecretValue',
    'sqlitePayload',
    'attachmentBody',
    'workspaceFileBody',
    'rawLogLine',
    'rawCacheEntry',
  ];
};

export type ZavorthWave4CSessionHistoryMigrationPlanItem = {
  nativeContract: 'ZavorthWave4CSessionHistoryMigrationPlanItem/v1';
  dataClass: ZavorthWave4CSessionHistoryMigratableClass;
  sourceInventoryItem: string;
  targetZavorthStorage: 'ZavorthNativeSessionHistoryRegistry' | 'ZavorthOwnedSessionHistoryMetadataStorage';
  schemaVersion: typeof ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_SCHEMA_VERSION;
  idempotencyKey: string;
  checksum: string;
  redactionEnvelope: ZavorthWave4CSessionHistoryRedactionEnvelope;
  backupRollback: {
    backupManifestRequired: true;
    restoreManifestRequired: true;
    rollbackReceiptRequired: true;
    sourceDbBackupCreatedBy218: false;
    sourceDbRestoreAuthorizedBy218: false;
  };
  eligibility: 'eligible-for-first-controlled-metadata-batch';
  policyDecision: 'allow-session-history-metadata-plan';
  batchPrepared: true;
  batchExecuted: false;
  runtimeExternalExecutorRequiredForPlanning: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4CSessionHistoryBlockedItem = {
  nativeContract: 'ZavorthWave4CSessionHistoryBlockedItem/v1';
  dataClass: ZavorthWave4CSessionHistoryBlockedClass;
  label: string;
  reason: string;
  migrationAllowed: false;
  futureGateRequired: true;
  policyDecision: 'blocked';
  rawSecretSerialized: false;
};

export type ZavorthWave4CSessionHistoryFirstBatch = {
  nativeContract: 'ZavorthWave4CSessionHistoryFirstBatch/v1';
  batchId: 'wave4c-session-history-metadata-batch-001';
  prepared: true;
  executed: false;
  itemIds: ZavorthWave4CSessionHistoryMigratableClass[];
  migrationScopeMetadataOnly: true;
  runtimeExternalExecutorRequiredForBatch: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4CSessionHistoryMigrationPlanEvidence = {
  nativeContract: 'ZavorthWave4CSessionHistoryMigrationPlanEvidence/v1';
  sqliteSessionStoreDryRunDesignBy167: true;
  sessionHistoryReadOnlyBridgeBy172: true;
  nativeSessionHistoryRegistryBy188: true;
  wave4aMigrationBy209To212: true;
  wave4bLowRiskExecutablesBy213To217: true;
  configStateReadinessBy162To166: true;
  runtimeExternalExecutorRequiredForPlan: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4CSessionHistoryMigrationPlanGate = {
  wave4cControlledSessionHistoryMigrationPlanCreated: true;
  sessionHistoryMigrationScopeMetadataOnly: true;
  rawMessageContentMigrationAllowed: false;
  rawSqliteCopyAllowed: false;
  sqliteWriteAllowed: false;
  attachmentsMigrationAllowed: false;
  rawSecretMigrationAllowed: false;
  workspaceLogsCacheRawMigrationAllowed: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
  rawSecretSerialized: false;
  migrationActuallyExecutedBy218: false;
};

export type ZavorthWave4CSessionHistoryMigrationPlanSource = {
  sqliteSessionStoreDryRunDesignReady: true;
  sessionHistoryReadOnlyBridgeReady: true;
  nativeSessionHistoryRegistryReady: true;
  wave4aMigrationReady: true;
  wave4bLowRiskExecutablesReady: true;
  configStateMigrationReadinessReady: true;
  externalExecutorLiveRequiredForPlan: false;
  migrationExecutionAttempted: false;
  rawMessageContentMigrationAttempted: false;
  rawSqliteCopyAttempted: false;
  sqliteWriteAttempted: false;
  attachmentsMigrationAttempted: false;
  rawSecretMigrationAttempted: false;
  workspaceLogsCacheRawMigrationAttempted: false;
  messageSendAttempted: false;
  providerExecutionAttempted: false;
  commandExecutionAttempted: false;
  toolExecutionAttempted: false;
  sourceModuleCopyAttempted: false;
  adapterRemovalAttempted: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4CControlledSessionHistoryMigrationPlanNormalization = {
  nativeContract: 'ZavorthWave4CControlledSessionHistoryMigrationPlan/v1';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4C_CONTROLLED_SESSION_HISTORY_MIGRATION_PLAN_RUNTIME_ID;
  decision: ZavorthWave4CSessionHistoryMigrationPlanDecision;
  status: 'blocked' | 'wave4c-controlled-session-history-migration-plan-ready';
  sourceReadiness: ZavorthWave4CSessionHistoryMigrationPlanSource;
  migratableItems: ZavorthWave4CSessionHistoryMigrationPlanItem[];
  blockedItems: ZavorthWave4CSessionHistoryBlockedItem[];
  firstBatch: ZavorthWave4CSessionHistoryFirstBatch;
  evidence: ZavorthWave4CSessionHistoryMigrationPlanEvidence;
  executionGate: ZavorthWave4CSessionHistoryMigrationPlanGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    rawSqlitePayloadSerialized: false;
    attachmentContentSerialized: false;
    sourceIdentityPublic: false;
    provenanceInternalOnly: true;
  };
  nextGateRecommended: 'wave-4c-first-controlled-session-history-metadata-batch';
};

export type ZavorthWave4CControlledSessionHistoryMigrationPlanOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4C_CONTROLLED_SESSION_HISTORY_MIGRATION_PLAN_RUNTIME_ID;
  source: ZavorthWave4CSessionHistoryMigrationPlanSource;
};

function redactionEnvelope(): ZavorthWave4CSessionHistoryRedactionEnvelope {
  return {
    nativeContract: 'ZavorthWave4CSessionHistoryRedactionEnvelope/v1',
    rawMessageContentSerialized: false,
    rawSecretSerialized: false,
    rawSqlitePayloadSerialized: false,
    attachmentContentSerialized: false,
    sourceIdentityPublic: false,
    provenanceInternalOnly: true,
    safeMetadataOnly: true,
    forbiddenFields: [
      'rawMessageContent',
      'rawSecretValue',
      'sqlitePayload',
      'attachmentBody',
      'workspaceFileBody',
      'rawLogLine',
      'rawCacheEntry',
    ],
  };
}

function checksumFor(dataClass: ZavorthWave4CSessionHistoryMigratableClass): string {
  const checksums: Record<ZavorthWave4CSessionHistoryMigratableClass, string> = {
    'channel-transport-linkage': 'sha256:wave4c-channel-transport-linkage-metadata',
    'redacted-message-metadata': 'sha256:wave4c-redacted-message-metadata',
    'redacted-participant-metadata': 'sha256:wave4c-redacted-participant-metadata',
    'session-metadata': 'sha256:wave4c-session-metadata',
    'thread-metadata': 'sha256:wave4c-thread-metadata',
    'timestamps-status': 'sha256:wave4c-timestamps-status',
  };
  return checksums[dataClass];
}

function migrationPlanItem(dataClass: ZavorthWave4CSessionHistoryMigratableClass): ZavorthWave4CSessionHistoryMigrationPlanItem {
  return {
    nativeContract: 'ZavorthWave4CSessionHistoryMigrationPlanItem/v1',
    dataClass,
    sourceInventoryItem: `external-executor-derived-${dataClass}-read-only-inventory`,
    targetZavorthStorage: dataClass === 'session-metadata' || dataClass === 'thread-metadata'
      ? 'ZavorthNativeSessionHistoryRegistry'
      : 'ZavorthOwnedSessionHistoryMetadataStorage',
    schemaVersion: ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_SCHEMA_VERSION,
    idempotencyKey: `wave4c:session-history-metadata:v1:${dataClass}`,
    checksum: checksumFor(dataClass),
    redactionEnvelope: redactionEnvelope(),
    backupRollback: {
      backupManifestRequired: true,
      restoreManifestRequired: true,
      rollbackReceiptRequired: true,
      sourceDbBackupCreatedBy218: false,
      sourceDbRestoreAuthorizedBy218: false,
    },
    eligibility: 'eligible-for-first-controlled-metadata-batch',
    policyDecision: 'allow-session-history-metadata-plan',
    batchPrepared: true,
    batchExecuted: false,
    runtimeExternalExecutorRequiredForPlanning: false,
    rawSecretSerialized: false,
  };
}

function migratableItems(): ZavorthWave4CSessionHistoryMigrationPlanItem[] {
  return [
    'session-metadata',
    'thread-metadata',
    'redacted-message-metadata',
    'channel-transport-linkage',
    'redacted-participant-metadata',
    'timestamps-status',
  ].map((dataClass) => migrationPlanItem(dataClass as ZavorthWave4CSessionHistoryMigratableClass));
}

function blockedItems(): ZavorthWave4CSessionHistoryBlockedItem[] {
  const items: Array<Pick<ZavorthWave4CSessionHistoryBlockedItem, 'dataClass' | 'label' | 'reason'>> = [
    { dataClass: 'raw-message-content', label: 'Raw message content', reason: 'Only redacted message metadata is allowed in Wave 4C planning.' },
    { dataClass: 'raw-sqlite-db-copy', label: 'Raw SQLite DB copy', reason: 'Real database copy remains blocked; only metadata planning is allowed.' },
    { dataClass: 'sqlite-write', label: 'SQLite write', reason: 'Source SQLite write/open-for-write is forbidden.' },
    { dataClass: 'attachments-files', label: 'Attachments/files', reason: 'Attachment content and files require a future artifact/privacy gate.' },
    { dataClass: 'secrets-tokens', label: 'Secrets/tokens', reason: 'Secret values remain SecretRef-only and cannot migrate as raw data.' },
    { dataClass: 'workspace-logs-cache-raw', label: 'Workspace/log/cache raw data', reason: 'Raw workspace, log, and cache data remain outside session/history metadata scope.' },
  ];

  return items.map((item) => ({
    nativeContract: 'ZavorthWave4CSessionHistoryBlockedItem/v1',
    ...item,
    migrationAllowed: false,
    futureGateRequired: true,
    policyDecision: 'blocked',
    rawSecretSerialized: false,
  }));
}

function firstBatch(items: ZavorthWave4CSessionHistoryMigrationPlanItem[]): ZavorthWave4CSessionHistoryFirstBatch {
  return {
    nativeContract: 'ZavorthWave4CSessionHistoryFirstBatch/v1',
    batchId: 'wave4c-session-history-metadata-batch-001',
    prepared: true,
    executed: false,
    itemIds: items.map((item) => item.dataClass),
    migrationScopeMetadataOnly: true,
    runtimeExternalExecutorRequiredForBatch: false,
    rawSecretSerialized: false,
  };
}

function evidence(): ZavorthWave4CSessionHistoryMigrationPlanEvidence {
  return {
    nativeContract: 'ZavorthWave4CSessionHistoryMigrationPlanEvidence/v1',
    sqliteSessionStoreDryRunDesignBy167: true,
    sessionHistoryReadOnlyBridgeBy172: true,
    nativeSessionHistoryRegistryBy188: true,
    wave4aMigrationBy209To212: true,
    wave4bLowRiskExecutablesBy213To217: true,
    configStateReadinessBy162To166: true,
    runtimeExternalExecutorRequiredForPlan: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthWave4CSessionHistoryMigrationPlanGate {
  return {
    wave4cControlledSessionHistoryMigrationPlanCreated: true,
    sessionHistoryMigrationScopeMetadataOnly: true,
    rawMessageContentMigrationAllowed: false,
    rawSqliteCopyAllowed: false,
    sqliteWriteAllowed: false,
    attachmentsMigrationAllowed: false,
    rawSecretMigrationAllowed: false,
    workspaceLogsCacheRawMigrationAllowed: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    sourceModuleCopied: false,
    adapterRemovalGlobalAllowed: false,
    rawSecretSerialized: false,
    migrationActuallyExecutedBy218: false,
  };
}

function sourceReady(source: ZavorthWave4CSessionHistoryMigrationPlanSource): boolean {
  return (
    source.sqliteSessionStoreDryRunDesignReady &&
    source.sessionHistoryReadOnlyBridgeReady &&
    source.nativeSessionHistoryRegistryReady &&
    source.wave4aMigrationReady &&
    source.wave4bLowRiskExecutablesReady &&
    source.configStateMigrationReadinessReady &&
    !source.externalExecutorLiveRequiredForPlan &&
    !source.migrationExecutionAttempted &&
    !source.rawMessageContentMigrationAttempted &&
    !source.rawSqliteCopyAttempted &&
    !source.sqliteWriteAttempted &&
    !source.attachmentsMigrationAttempted &&
    !source.rawSecretMigrationAttempted &&
    !source.workspaceLogsCacheRawMigrationAttempted &&
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

export class ZavorthWave4CControlledSessionHistoryMigrationPlan {
  public constructor(public readonly normalization: ZavorthWave4CControlledSessionHistoryMigrationPlanNormalization) {}

  public migratableDataClasses(): ZavorthWave4CSessionHistoryMigratableClass[] {
    return this.normalization.migratableItems.map((item) => item.dataClass);
  }

  public blockedDataClasses(): ZavorthWave4CSessionHistoryBlockedClass[] {
    return this.normalization.blockedItems.map((item) => item.dataClass);
  }
}

export function createZavorthWave4CControlledSessionHistoryMigrationPlanFixtureSource(
  overrides: Partial<ZavorthWave4CSessionHistoryMigrationPlanSource> = {},
): ZavorthWave4CSessionHistoryMigrationPlanSource {
  return {
    sqliteSessionStoreDryRunDesignReady: true,
    sessionHistoryReadOnlyBridgeReady: true,
    nativeSessionHistoryRegistryReady: true,
    wave4aMigrationReady: true,
    wave4bLowRiskExecutablesReady: true,
    configStateMigrationReadinessReady: true,
    externalExecutorLiveRequiredForPlan: false,
    migrationExecutionAttempted: false,
    rawMessageContentMigrationAttempted: false,
    rawSqliteCopyAttempted: false,
    sqliteWriteAttempted: false,
    attachmentsMigrationAttempted: false,
    rawSecretMigrationAttempted: false,
    workspaceLogsCacheRawMigrationAttempted: false,
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

export function normalizeZavorthWave4CControlledSessionHistoryMigrationPlan(
  options: ZavorthWave4CControlledSessionHistoryMigrationPlanOptions,
): ZavorthWave4CControlledSessionHistoryMigrationPlanNormalization {
  const migratable = migratableItems();
  const blocked = blockedItems();
  const batch = firstBatch(migratable);
  const planEvidence = evidence();
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    migratable.length === 6 &&
    blocked.length === 6 &&
    migratable.every((item) => (
      item.batchPrepared &&
      !item.batchExecuted &&
      item.policyDecision === 'allow-session-history-metadata-plan' &&
      item.redactionEnvelope.safeMetadataOnly &&
      !item.redactionEnvelope.rawMessageContentSerialized &&
      !item.redactionEnvelope.rawSecretSerialized &&
      item.backupRollback.backupManifestRequired &&
      item.backupRollback.restoreManifestRequired &&
      item.backupRollback.rollbackReceiptRequired
    )) &&
    batch.prepared &&
    !batch.executed &&
    !planEvidence.runtimeExternalExecutorRequiredForPlan;

  return {
    nativeContract: 'ZavorthWave4CControlledSessionHistoryMigrationPlan/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'wave4c-controlled-session-history-migration-plan-ready' : 'blocked',
    status: ready ? 'wave4c-controlled-session-history-migration-plan-ready' : 'blocked',
    sourceReadiness: options.source,
    migratableItems: migratable,
    blockedItems: blocked,
    firstBatch: batch,
    evidence: planEvidence,
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      rawSqlitePayloadSerialized: false,
      attachmentContentSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
    },
    nextGateRecommended: 'wave-4c-first-controlled-session-history-metadata-batch',
  };
}

export function normalizeZavorthWave4CControlledSessionHistoryMigrationPlanFixture(
  overrides: Partial<ZavorthWave4CSessionHistoryMigrationPlanSource> = {},
): ZavorthWave4CControlledSessionHistoryMigrationPlanNormalization {
  return normalizeZavorthWave4CControlledSessionHistoryMigrationPlan({
    generatedAt: ZAVORTH_WAVE4C_CONTROLLED_SESSION_HISTORY_MIGRATION_PLAN_NOW,
    runtimeId: ZAVORTH_WAVE4C_CONTROLLED_SESSION_HISTORY_MIGRATION_PLAN_RUNTIME_ID,
    source: createZavorthWave4CControlledSessionHistoryMigrationPlanFixtureSource(overrides),
  });
}

export function createZavorthWave4CControlledSessionHistoryMigrationPlanFixture(
  overrides: Partial<ZavorthWave4CSessionHistoryMigrationPlanSource> = {},
): ZavorthWave4CControlledSessionHistoryMigrationPlan {
  return new ZavorthWave4CControlledSessionHistoryMigrationPlan(
    normalizeZavorthWave4CControlledSessionHistoryMigrationPlanFixture(overrides),
  );
}
