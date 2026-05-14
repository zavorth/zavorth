export const ZAVORTH_WAVE4C2_RAW_SESSION_CONTENT_MIGRATION_READINESS_PACK_NOW = '2026-04-30T22:00:00.000Z' as const;
export const ZAVORTH_WAVE4C2_RAW_SESSION_CONTENT_MIGRATION_READINESS_PACK_RUNTIME_ID = 'zavorth-wave4c2-raw-session-content-migration-readiness-pack' as const;
export const ZAVORTH_WAVE4C2_SESSION_CONTENT_METADATA_SCHEMA_VERSION = 'zavorth-wave4c2-session-content-metadata/v1' as const;
export const ZAVORTH_WAVE4C2_CONTENT_METADATA_MIGRATION_WRITE_FLAG = 'ZAVORTH_WAVE4C2_CONTENT_METADATA_MIGRATION_WRITE' as const;

export type ZavorthWave4C2RawSessionContentReadinessDecision =
  | 'blocked'
  | 'wave4c2-raw-session-content-migration-readiness-pack-ready';

export type ZavorthWave4C2SourceInventoryCategory =
  | 'attachment-reference-table'
  | 'channel-thread-link-table'
  | 'message-content-table'
  | 'participant-table'
  | 'session-table'
  | 'sqlite-database-candidate'
  | 'thread-table';

export type ZavorthWave4C2ContentSensitivityClass =
  | 'attachment-binary'
  | 'channel-link'
  | 'message-content'
  | 'participant-identifier'
  | 'secret-or-token'
  | 'timestamp'
  | 'unknown-sensitive';

export type ZavorthWave4C2ContentPolicyDisposition =
  | 'blocked'
  | 'count-only'
  | 'hash-only'
  | 'redacted-excerpt-eligible'
  | 'summary-metadata-eligible';

export type ZavorthWave4C2ReadinessBatchItemClass =
  | 'channel-linkage-metadata'
  | 'message-content-hash'
  | 'message-redacted-excerpt'
  | 'message-token-count-bucket'
  | 'participant-count-kind'
  | 'session-content-presence'
  | 'timestamp-range';

export type ZavorthWave4C2BlockedContentClass =
  | 'attachment-binary-payload'
  | 'raw-message-content'
  | 'raw-secret-token'
  | 'raw-sqlite-db-copy'
  | 'sqlite-write'
  | 'workspace-log-cache-raw';

export type ZavorthWave4C2LoadVerifyOutcome =
  | 'corrupt'
  | 'degraded'
  | 'parity-ok'
  | 'parity-partial'
  | 'rejected';

export type ZavorthWave4C2ReadOnlySourceInventoryRow = {
  nativeContract: 'ZavorthWave4C2ReadOnlySourceInventoryRow/v1';
  inventoryId: string;
  sourceCategory: ZavorthWave4C2SourceInventoryCategory;
  candidateSource: string;
  candidateSchemaOrTable: string;
  candidateFields: string[];
  safeMetadataAllowed: string[];
  forbiddenOutput: string[];
  inventoryMode: 'read-only-metadata-only';
  sqliteReadOnlyInventoryOnly: true;
  sqliteOpenedForWrite: false;
  rawDbCopied: false;
  rawContentSerialized: false;
  rawSecretSerialized: false;
  attachmentsSerialized: false;
  risk: 'high' | 'medium';
  notes: string;
};

export type ZavorthWave4C2ContentRedactionPolicyRule = {
  nativeContract: 'ZavorthWave4C2ContentRedactionPolicyRule/v1';
  sensitivityClass: ZavorthWave4C2ContentSensitivityClass;
  sourceFields: string[];
  disposition: ZavorthWave4C2ContentPolicyDisposition;
  allowedDerivedOutputs: Array<'count' | 'hash' | 'redacted-excerpt' | 'summary-metadata'>;
  forbiddenOutputs: string[];
  rawContentMigrationAllowed: false;
  rawSecretSerialized: false;
  attachmentsMigrationAllowed: false;
  policyDecision: 'allow-derived-metadata-only' | 'blocked';
};

export type ZavorthWave4C2FutureMigrationBatchItem = {
  nativeContract: 'ZavorthWave4C2FutureMigrationBatchItem/v1';
  itemClass: ZavorthWave4C2ReadinessBatchItemClass;
  sourceInventoryId: string;
  targetZavorthStorage: 'ZavorthOwnedSessionContentMetadataStorage' | 'ZavorthNativeSessionHistoryRegistry';
  schemaVersion: typeof ZAVORTH_WAVE4C2_SESSION_CONTENT_METADATA_SCHEMA_VERSION;
  idempotencyKey: string;
  checksum: string;
  redactionEnvelope: ZavorthWave4C2RedactionEnvelope;
  rollbackRequirement: {
    backupManifestRequired: true;
    restoreManifestRequired: true;
    rollbackReceiptRequired: true;
    sourceDbBackupCreatedBy226: false;
    sourceDbRestoreAuthorizedBy226: false;
  };
  featureFlag: typeof ZAVORTH_WAVE4C2_CONTENT_METADATA_MIGRATION_WRITE_FLAG;
  safetyGate: 'future-controlled-write-gate-required';
  batchPrepared: true;
  batchExecuted: false;
  rawContentMigrationPreparedButNotExecuted: true;
  policyDecision: 'allow-future-derived-content-metadata-batch';
};

export type ZavorthWave4C2LoadVerifyParityDesignRow = {
  nativeContract: 'ZavorthWave4C2LoadVerifyParityDesignRow/v1';
  futureBatchItemClass: ZavorthWave4C2ReadinessBatchItemClass;
  loadValidation: Array<'checksum' | 'idempotency' | 'manifest' | 'policy' | 'redaction' | 'schema'>;
  parityTargets: Array<'command-center-session-view' | 'native-session-history-registry' | 'read-only-session-bridge'>;
  acceptedOutcomes: ZavorthWave4C2LoadVerifyOutcome[];
  rawContentRenderAllowed: false;
  commandCenterConsumesDerivedMetadataOnly: true;
  externalExecutorLiveRequired: false;
};

export type ZavorthWave4C2BlockedContentRow = {
  nativeContract: 'ZavorthWave4C2BlockedContentRow/v1';
  contentClass: ZavorthWave4C2BlockedContentClass;
  label: string;
  reason: string;
  futureGateRequired: true;
  migrationAllowedBy226: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4C2RedactionEnvelope = {
  nativeContract: 'ZavorthWave4C2RedactionEnvelope/v1';
  rawMessageContentSerialized: false;
  rawSecretSerialized: false;
  rawSqlitePayloadSerialized: false;
  attachmentContentSerialized: false;
  binaryPayloadSerialized: false;
  sourceIdentityPublic: false;
  provenanceInternalOnly: true;
  allowedDerivedOutputs: Array<'count' | 'hash' | 'redacted-excerpt' | 'summary-metadata'>;
  forbiddenFields: [
    'rawMessageContent',
    'rawSecretValue',
    'sqlitePayload',
    'attachmentBody',
    'binaryPayload',
    'workspaceFileBody',
    'rawLogLine',
    'rawCacheEntry',
  ];
};

export type ZavorthWave4C2PackEvidence = {
  nativeContract: 'ZavorthWave4C2PackEvidence/v1';
  sourceInventoryByAgentA: true;
  redactionPolicyByAgentB: true;
  migrationBatchDesignByAgentC: true;
  loadVerifyParityDesignByAgentD: true;
  wave4cMetadataMigrationBy218To221: true;
  wave4b2MediumRiskMilestoneBy225: true;
  sessionRegistryBy188: true;
  sessionReadOnlyBridgeBy172: true;
  sqliteDryRunDesignBy167: true;
  configStateReadinessBy162To166: true;
  externalExecutorLiveRequired: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4C2PackGate = {
  rawContentMigrationPreparedButNotExecuted: true;
  sqliteReadOnlyInventoryOnly: true;
  sqliteWriteAllowed: false;
  rawDbCopyAllowed: false;
  rawSecretSerialized: false;
  attachmentsMigrationAllowed: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  externalExecutorLiveRequired: false;
  adapterRemovalGlobalAllowed: false;
  migrationActuallyExecutedBy226: false;
};

export type ZavorthWave4C2PackSource = {
  wave4cMetadataMigrationReady: true;
  wave4b2MediumRiskMilestoneReady: true;
  sessionRegistryReady: true;
  sessionReadOnlyBridgeReady: true;
  sqliteDryRunDesignReady: true;
  configStateReadinessReady: true;
  externalExecutorLiveRequired: false;
  migrationExecutionAttempted: false;
  rawContentMigrationAttempted: false;
  sqliteWriteAttempted: false;
  rawDbCopyAttempted: false;
  rawSecretSerializationAttempted: false;
  attachmentsMigrationAttempted: false;
  messageSendAttempted: false;
  providerExecutionAttempted: false;
  commandExecutionAttempted: false;
  toolExecutionAttempted: false;
  sourceModuleCopyAttempted: false;
  adapterRemovalAttempted: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4C2RawSessionContentMigrationReadinessPackNormalization = {
  nativeContract: 'ZavorthWave4C2RawSessionContentMigrationReadinessPack/v1';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4C2_RAW_SESSION_CONTENT_MIGRATION_READINESS_PACK_RUNTIME_ID;
  decision: ZavorthWave4C2RawSessionContentReadinessDecision;
  status: 'blocked' | 'wave4c2-raw-session-content-migration-readiness-pack-ready';
  sourceReadiness: ZavorthWave4C2PackSource;
  readOnlySourceInventory: ZavorthWave4C2ReadOnlySourceInventoryRow[];
  redactionPolicy: ZavorthWave4C2ContentRedactionPolicyRule[];
  firstFutureBatchDesign: ZavorthWave4C2FutureMigrationBatchItem[];
  loadVerifyParityDesign: ZavorthWave4C2LoadVerifyParityDesignRow[];
  blockedContent: ZavorthWave4C2BlockedContentRow[];
  evidence: ZavorthWave4C2PackEvidence;
  executionGate: ZavorthWave4C2PackGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    rawSqlitePayloadSerialized: false;
    attachmentContentSerialized: false;
    sourceIdentityPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-wave-4c2-first-controlled-derived-session-content-metadata-batch-by-explicit-follow-up-only';
};

export type ZavorthWave4C2RawSessionContentMigrationReadinessPackOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4C2_RAW_SESSION_CONTENT_MIGRATION_READINESS_PACK_RUNTIME_ID;
  source: ZavorthWave4C2PackSource;
};

function redactionEnvelope(): ZavorthWave4C2RedactionEnvelope {
  return {
    nativeContract: 'ZavorthWave4C2RedactionEnvelope/v1',
    rawMessageContentSerialized: false,
    rawSecretSerialized: false,
    rawSqlitePayloadSerialized: false,
    attachmentContentSerialized: false,
    binaryPayloadSerialized: false,
    sourceIdentityPublic: false,
    provenanceInternalOnly: true,
    allowedDerivedOutputs: ['count', 'hash', 'redacted-excerpt', 'summary-metadata'],
    forbiddenFields: [
      'rawMessageContent',
      'rawSecretValue',
      'sqlitePayload',
      'attachmentBody',
      'binaryPayload',
      'workspaceFileBody',
      'rawLogLine',
      'rawCacheEntry',
    ],
  };
}

function readOnlySourceInventory(): ZavorthWave4C2ReadOnlySourceInventoryRow[] {
  const rows: Array<Omit<ZavorthWave4C2ReadOnlySourceInventoryRow, 'nativeContract' | 'inventoryMode' | 'sqliteReadOnlyInventoryOnly' | 'sqliteOpenedForWrite' | 'rawDbCopied' | 'rawContentSerialized' | 'rawSecretSerialized' | 'attachmentsSerialized'>> = [
    {
      inventoryId: 'wave4c2-inventory-sqlite-database-candidate',
      sourceCategory: 'sqlite-database-candidate',
      candidateSource: 'docs/167 sqlite/session dry-run design and docs/218-221 migrated metadata',
      candidateSchemaOrTable: 'sqlite database path/classification only',
      candidateFields: ['path-exists', 'size-bucket', 'schema-fingerprint-future', 'row-count-future'],
      safeMetadataAllowed: ['existence', 'kind', 'size-bucket', 'timestamp-bucket', 'schema-fingerprint'],
      forbiddenOutput: ['sqlitePayload', 'rawDbCopy', 'rawMessageContent'],
      risk: 'high',
      notes: 'Read-only inventory may identify candidates but cannot copy DB or open SQLite in write mode.',
    },
    {
      inventoryId: 'wave4c2-inventory-message-content-table',
      sourceCategory: 'message-content-table',
      candidateSource: 'session/history message metadata from 172/188/218-221',
      candidateSchemaOrTable: 'messages or message_chunks candidate',
      candidateFields: ['message_id', 'thread_id', 'role', 'content_length', 'content_hash_future'],
      safeMetadataAllowed: ['message count', 'content length bucket', 'hash placeholder', 'redaction-needed flag'],
      forbiddenOutput: ['rawMessageContent', 'prompt text', 'completion text', 'tool payload body'],
      risk: 'high',
      notes: 'Raw content remains blocked; only future derived metadata/redacted excerpt design is prepared.',
    },
    {
      inventoryId: 'wave4c2-inventory-session-table',
      sourceCategory: 'session-table',
      candidateSource: 'ZavorthNativeSessionHistoryRegistry and Wave 4C migrated metadata',
      candidateSchemaOrTable: 'sessions',
      candidateFields: ['session_id', 'alias', 'status', 'created_at', 'updated_at'],
      safeMetadataAllowed: ['stable alias', 'status', 'timestamp bucket', 'message count'],
      forbiddenOutput: ['raw external ids if identifying', 'raw participant ids'],
      risk: 'medium',
      notes: 'Session linkage is already migrated as metadata; content readiness can reference it.',
    },
    {
      inventoryId: 'wave4c2-inventory-thread-table',
      sourceCategory: 'thread-table',
      candidateSource: 'ZavorthNativeSessionHistoryRegistry threads',
      candidateSchemaOrTable: 'threads',
      candidateFields: ['thread_id', 'session_id', 'status', 'message_count'],
      safeMetadataAllowed: ['stable thread alias', 'message count', 'status'],
      forbiddenOutput: ['raw thread id if identifying', 'raw message body'],
      risk: 'medium',
      notes: 'Thread metadata can constrain future content batches without reading content.',
    },
    {
      inventoryId: 'wave4c2-inventory-participant-table',
      sourceCategory: 'participant-table',
      candidateSource: 'redacted participant metadata from 172/188/218-221',
      candidateSchemaOrTable: 'participants',
      candidateFields: ['participant_kind', 'participant_count', 'redacted_identity_flag'],
      safeMetadataAllowed: ['participant count', 'participant kind', 'redacted identity flag'],
      forbiddenOutput: ['raw participant id', 'email', 'phone', 'account token'],
      risk: 'high',
      notes: 'Participant data must stay redacted and aggregated.',
    },
    {
      inventoryId: 'wave4c2-inventory-attachment-reference-table',
      sourceCategory: 'attachment-reference-table',
      candidateSource: 'message attachment metadata if exposed by future read-only inventory',
      candidateSchemaOrTable: 'attachments',
      candidateFields: ['attachment_count', 'mime_family', 'size_bucket', 'hash_placeholder'],
      safeMetadataAllowed: ['count', 'mime family', 'size bucket', 'hash placeholder'],
      forbiddenOutput: ['attachmentBody', 'binaryPayload', 'file path with private content'],
      risk: 'high',
      notes: 'Attachment migration remains blocked; only reference metadata is considered for a future gate.',
    },
    {
      inventoryId: 'wave4c2-inventory-channel-thread-link-table',
      sourceCategory: 'channel-thread-link-table',
      candidateSource: 'channel/transport linkage from Wave 4C metadata',
      candidateSchemaOrTable: 'channel_thread_links',
      candidateFields: ['channel_alias', 'transport_alias', 'thread_alias', 'status'],
      safeMetadataAllowed: ['alias linkage', 'status', 'count'],
      forbiddenOutput: ['raw channel credential', 'raw target address'],
      risk: 'medium',
      notes: 'Channel linkage can support future parity checks without opening transports.',
    },
  ];

  return rows.map((row) => ({
    nativeContract: 'ZavorthWave4C2ReadOnlySourceInventoryRow/v1',
    inventoryMode: 'read-only-metadata-only',
    sqliteReadOnlyInventoryOnly: true,
    sqliteOpenedForWrite: false,
    rawDbCopied: false,
    rawContentSerialized: false,
    rawSecretSerialized: false,
    attachmentsSerialized: false,
    ...row,
  }));
}

function redactionPolicy(): ZavorthWave4C2ContentRedactionPolicyRule[] {
  const rules: Array<Pick<ZavorthWave4C2ContentRedactionPolicyRule, 'sensitivityClass' | 'sourceFields' | 'disposition' | 'allowedDerivedOutputs' | 'forbiddenOutputs' | 'policyDecision'>> = [
    {
      sensitivityClass: 'message-content',
      sourceFields: ['body', 'content', 'prompt', 'completion', 'tool_result'],
      disposition: 'redacted-excerpt-eligible',
      allowedDerivedOutputs: ['hash', 'count', 'redacted-excerpt', 'summary-metadata'],
      forbiddenOutputs: ['rawMessageContent', 'unredacted prompt', 'unredacted completion'],
      policyDecision: 'allow-derived-metadata-only',
    },
    {
      sensitivityClass: 'attachment-binary',
      sourceFields: ['attachment_body', 'binary_payload', 'file_bytes'],
      disposition: 'blocked',
      allowedDerivedOutputs: ['count'],
      forbiddenOutputs: ['attachmentBody', 'binaryPayload', 'file bytes'],
      policyDecision: 'blocked',
    },
    {
      sensitivityClass: 'participant-identifier',
      sourceFields: ['participant_id', 'email', 'phone', 'account_id'],
      disposition: 'count-only',
      allowedDerivedOutputs: ['count', 'summary-metadata'],
      forbiddenOutputs: ['raw participant id', 'email', 'phone'],
      policyDecision: 'allow-derived-metadata-only',
    },
    {
      sensitivityClass: 'timestamp',
      sourceFields: ['created_at', 'updated_at', 'sent_at'],
      disposition: 'summary-metadata-eligible',
      allowedDerivedOutputs: ['summary-metadata'],
      forbiddenOutputs: ['timezone-private free text'],
      policyDecision: 'allow-derived-metadata-only',
    },
    {
      sensitivityClass: 'channel-link',
      sourceFields: ['channel_alias', 'transport_alias', 'thread_alias'],
      disposition: 'summary-metadata-eligible',
      allowedDerivedOutputs: ['count', 'summary-metadata'],
      forbiddenOutputs: ['raw target address', 'channel credential'],
      policyDecision: 'allow-derived-metadata-only',
    },
    {
      sensitivityClass: 'secret-or-token',
      sourceFields: ['token', 'secret', 'api_key', 'authorization'],
      disposition: 'blocked',
      allowedDerivedOutputs: [],
      forbiddenOutputs: ['rawSecretValue', 'token', 'api key', 'authorization header'],
      policyDecision: 'blocked',
    },
    {
      sensitivityClass: 'unknown-sensitive',
      sourceFields: ['unknown_content_blob', 'opaque_payload'],
      disposition: 'blocked',
      allowedDerivedOutputs: [],
      forbiddenOutputs: ['opaque raw payload'],
      policyDecision: 'blocked',
    },
  ];

  return rules.map((rule) => ({
    nativeContract: 'ZavorthWave4C2ContentRedactionPolicyRule/v1',
    rawContentMigrationAllowed: false,
    rawSecretSerialized: false,
    attachmentsMigrationAllowed: false,
    ...rule,
  }));
}

function checksumFor(itemClass: ZavorthWave4C2ReadinessBatchItemClass): string {
  return `sha256:wave4c2-derived-content-metadata:${itemClass}`;
}

function futureBatchDesign(): ZavorthWave4C2FutureMigrationBatchItem[] {
  const rows: Array<Pick<ZavorthWave4C2FutureMigrationBatchItem, 'itemClass' | 'sourceInventoryId' | 'targetZavorthStorage'>> = [
    { itemClass: 'session-content-presence', sourceInventoryId: 'wave4c2-inventory-session-table', targetZavorthStorage: 'ZavorthNativeSessionHistoryRegistry' },
    { itemClass: 'message-content-hash', sourceInventoryId: 'wave4c2-inventory-message-content-table', targetZavorthStorage: 'ZavorthOwnedSessionContentMetadataStorage' },
    { itemClass: 'message-redacted-excerpt', sourceInventoryId: 'wave4c2-inventory-message-content-table', targetZavorthStorage: 'ZavorthOwnedSessionContentMetadataStorage' },
    { itemClass: 'message-token-count-bucket', sourceInventoryId: 'wave4c2-inventory-message-content-table', targetZavorthStorage: 'ZavorthOwnedSessionContentMetadataStorage' },
    { itemClass: 'participant-count-kind', sourceInventoryId: 'wave4c2-inventory-participant-table', targetZavorthStorage: 'ZavorthOwnedSessionContentMetadataStorage' },
    { itemClass: 'timestamp-range', sourceInventoryId: 'wave4c2-inventory-thread-table', targetZavorthStorage: 'ZavorthOwnedSessionContentMetadataStorage' },
    { itemClass: 'channel-linkage-metadata', sourceInventoryId: 'wave4c2-inventory-channel-thread-link-table', targetZavorthStorage: 'ZavorthOwnedSessionContentMetadataStorage' },
  ];

  return rows.map((row) => ({
    nativeContract: 'ZavorthWave4C2FutureMigrationBatchItem/v1',
    ...row,
    schemaVersion: ZAVORTH_WAVE4C2_SESSION_CONTENT_METADATA_SCHEMA_VERSION,
    idempotencyKey: `wave4c2:derived-content-metadata:v1:${row.itemClass}`,
    checksum: checksumFor(row.itemClass),
    redactionEnvelope: redactionEnvelope(),
    rollbackRequirement: {
      backupManifestRequired: true,
      restoreManifestRequired: true,
      rollbackReceiptRequired: true,
      sourceDbBackupCreatedBy226: false,
      sourceDbRestoreAuthorizedBy226: false,
    },
    featureFlag: ZAVORTH_WAVE4C2_CONTENT_METADATA_MIGRATION_WRITE_FLAG,
    safetyGate: 'future-controlled-write-gate-required',
    batchPrepared: true,
    batchExecuted: false,
    rawContentMigrationPreparedButNotExecuted: true,
    policyDecision: 'allow-future-derived-content-metadata-batch',
  }));
}

function loadVerifyParityDesign(): ZavorthWave4C2LoadVerifyParityDesignRow[] {
  return futureBatchDesign().map((item) => ({
    nativeContract: 'ZavorthWave4C2LoadVerifyParityDesignRow/v1',
    futureBatchItemClass: item.itemClass,
    loadValidation: ['manifest', 'schema', 'checksum', 'idempotency', 'redaction', 'policy'],
    parityTargets: ['native-session-history-registry', 'read-only-session-bridge', 'command-center-session-view'],
    acceptedOutcomes: ['parity-ok', 'parity-partial', 'degraded', 'rejected', 'corrupt'],
    rawContentRenderAllowed: false,
    commandCenterConsumesDerivedMetadataOnly: true,
    externalExecutorLiveRequired: false,
  }));
}

function blockedContent(): ZavorthWave4C2BlockedContentRow[] {
  const rows: Array<Pick<ZavorthWave4C2BlockedContentRow, 'contentClass' | 'label' | 'reason'>> = [
    { contentClass: 'raw-message-content', label: 'Raw message content', reason: 'Wave 4C.2 only prepares derived/redacted content metadata.' },
    { contentClass: 'raw-sqlite-db-copy', label: 'Raw SQLite DB copy', reason: 'The source database cannot be copied by this readiness pack.' },
    { contentClass: 'sqlite-write', label: 'SQLite write', reason: 'Source SQLite write/open-for-write remains forbidden.' },
    { contentClass: 'attachment-binary-payload', label: 'Attachment binary payload', reason: 'Attachment/binary migration requires a future artifact gate.' },
    { contentClass: 'raw-secret-token', label: 'Raw secret/token', reason: 'Secrets remain SecretRef-only and cannot be serialized.' },
    { contentClass: 'workspace-log-cache-raw', label: 'Workspace/log/cache raw data', reason: 'Raw workspace/log/cache data remains outside session content readiness.' },
  ];

  return rows.map((row) => ({
    nativeContract: 'ZavorthWave4C2BlockedContentRow/v1',
    ...row,
    futureGateRequired: true,
    migrationAllowedBy226: false,
    rawSecretSerialized: false,
  }));
}

function evidence(): ZavorthWave4C2PackEvidence {
  return {
    nativeContract: 'ZavorthWave4C2PackEvidence/v1',
    sourceInventoryByAgentA: true,
    redactionPolicyByAgentB: true,
    migrationBatchDesignByAgentC: true,
    loadVerifyParityDesignByAgentD: true,
    wave4cMetadataMigrationBy218To221: true,
    wave4b2MediumRiskMilestoneBy225: true,
    sessionRegistryBy188: true,
    sessionReadOnlyBridgeBy172: true,
    sqliteDryRunDesignBy167: true,
    configStateReadinessBy162To166: true,
    externalExecutorLiveRequired: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthWave4C2PackGate {
  return {
    rawContentMigrationPreparedButNotExecuted: true,
    sqliteReadOnlyInventoryOnly: true,
    sqliteWriteAllowed: false,
    rawDbCopyAllowed: false,
    rawSecretSerialized: false,
    attachmentsMigrationAllowed: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    externalExecutorLiveRequired: false,
    adapterRemovalGlobalAllowed: false,
    migrationActuallyExecutedBy226: false,
  };
}

function sourceReady(source: ZavorthWave4C2PackSource): boolean {
  return (
    source.wave4cMetadataMigrationReady &&
    source.wave4b2MediumRiskMilestoneReady &&
    source.sessionRegistryReady &&
    source.sessionReadOnlyBridgeReady &&
    source.sqliteDryRunDesignReady &&
    source.configStateReadinessReady &&
    !source.externalExecutorLiveRequired &&
    !source.migrationExecutionAttempted &&
    !source.rawContentMigrationAttempted &&
    !source.sqliteWriteAttempted &&
    !source.rawDbCopyAttempted &&
    !source.rawSecretSerializationAttempted &&
    !source.attachmentsMigrationAttempted &&
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

export class ZavorthWave4C2RawSessionContentMigrationReadinessPack {
  public constructor(public readonly normalization: ZavorthWave4C2RawSessionContentMigrationReadinessPackNormalization) {}

  public futureBatchItemClasses(): ZavorthWave4C2ReadinessBatchItemClass[] {
    return this.normalization.firstFutureBatchDesign.map((item) => item.itemClass);
  }

  public blockedContentClasses(): ZavorthWave4C2BlockedContentClass[] {
    return this.normalization.blockedContent.map((item) => item.contentClass);
  }
}

export function createZavorthWave4C2RawSessionContentMigrationReadinessPackFixtureSource(
  overrides: Partial<ZavorthWave4C2PackSource> = {},
): ZavorthWave4C2PackSource {
  return {
    wave4cMetadataMigrationReady: true,
    wave4b2MediumRiskMilestoneReady: true,
    sessionRegistryReady: true,
    sessionReadOnlyBridgeReady: true,
    sqliteDryRunDesignReady: true,
    configStateReadinessReady: true,
    externalExecutorLiveRequired: false,
    migrationExecutionAttempted: false,
    rawContentMigrationAttempted: false,
    sqliteWriteAttempted: false,
    rawDbCopyAttempted: false,
    rawSecretSerializationAttempted: false,
    attachmentsMigrationAttempted: false,
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

export function normalizeZavorthWave4C2RawSessionContentMigrationReadinessPack(
  options: ZavorthWave4C2RawSessionContentMigrationReadinessPackOptions,
): ZavorthWave4C2RawSessionContentMigrationReadinessPackNormalization {
  const inventory = readOnlySourceInventory();
  const policy = redactionPolicy();
  const batch = futureBatchDesign();
  const parity = loadVerifyParityDesign();
  const blocked = blockedContent();
  const packEvidence = evidence();
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    inventory.length === 7 &&
    policy.length === 7 &&
    batch.length === 7 &&
    parity.length === batch.length &&
    blocked.length === 6 &&
    inventory.every((row) => row.sqliteReadOnlyInventoryOnly && !row.rawDbCopied && !row.rawContentSerialized && !row.rawSecretSerialized) &&
    policy.every((rule) => !rule.rawContentMigrationAllowed && !rule.rawSecretSerialized && !rule.attachmentsMigrationAllowed) &&
    batch.every((item) => item.batchPrepared && !item.batchExecuted && item.rawContentMigrationPreparedButNotExecuted) &&
    parity.every((row) => !row.rawContentRenderAllowed && !row.externalExecutorLiveRequired) &&
    blocked.every((row) => !row.migrationAllowedBy226 && row.futureGateRequired);

  return {
    nativeContract: 'ZavorthWave4C2RawSessionContentMigrationReadinessPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'wave4c2-raw-session-content-migration-readiness-pack-ready' : 'blocked',
    status: ready ? 'wave4c2-raw-session-content-migration-readiness-pack-ready' : 'blocked',
    sourceReadiness: options.source,
    readOnlySourceInventory: inventory,
    redactionPolicy: policy,
    firstFutureBatchDesign: batch,
    loadVerifyParityDesign: parity,
    blockedContent: blocked,
    evidence: packEvidence,
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      rawSqlitePayloadSerialized: false,
      attachmentContentSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-wave-4c2-first-controlled-derived-session-content-metadata-batch-by-explicit-follow-up-only',
  };
}

export function normalizeZavorthWave4C2RawSessionContentMigrationReadinessPackFixture(
  overrides: Partial<ZavorthWave4C2PackSource> = {},
): ZavorthWave4C2RawSessionContentMigrationReadinessPackNormalization {
  return normalizeZavorthWave4C2RawSessionContentMigrationReadinessPack({
    generatedAt: ZAVORTH_WAVE4C2_RAW_SESSION_CONTENT_MIGRATION_READINESS_PACK_NOW,
    runtimeId: ZAVORTH_WAVE4C2_RAW_SESSION_CONTENT_MIGRATION_READINESS_PACK_RUNTIME_ID,
    source: createZavorthWave4C2RawSessionContentMigrationReadinessPackFixtureSource(overrides),
  });
}

export function createZavorthWave4C2RawSessionContentMigrationReadinessPackFixture(
  overrides: Partial<ZavorthWave4C2PackSource> = {},
): ZavorthWave4C2RawSessionContentMigrationReadinessPack {
  return new ZavorthWave4C2RawSessionContentMigrationReadinessPack(
    normalizeZavorthWave4C2RawSessionContentMigrationReadinessPackFixture(overrides),
  );
}
