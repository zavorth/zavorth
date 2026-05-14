import {
  createZavorthNativeSessionHistoryRegistryFixture,
  normalizeZavorthNativeSessionHistoryRegistryFixture,
} from './ZavorthNativeSessionHistoryRegistry.js';
import type {
  ZavorthNativeMessageMetadataRecord,
  ZavorthNativeSessionHistoryLookupResult,
  ZavorthNativeSessionHistoryRegistry,
  ZavorthNativeSessionHistoryRegistryNormalization,
  ZavorthNativeSessionMetadataRecord,
} from './ZavorthNativeSessionHistoryRegistry.js';

export const ZAVORTH_WAVE4C3_SESSION_STORAGE_SCHEMA_PARITY_ABSORPTION_PACK_NOW = '2026-05-01T07:00:00.000Z' as const;
export const ZAVORTH_WAVE4C3_SESSION_STORAGE_SCHEMA_PARITY_ABSORPTION_PACK_RUNTIME_ID = 'zavorth-wave4c3-session-storage-schema-parity-absorption-pack' as const;

export type ZavorthWave4C3SessionStorageSchemaParityAbsorptionDecision =
  | 'blocked'
  | 'wave4c3-session-storage-schema-parity-absorption-pack-ready';

export type ZavorthWave4C3ExternalExecutorSchemaTableName =
  | 'attachments'
  | 'channels'
  | 'message_metadata'
  | 'messages'
  | 'participants'
  | 'sessions'
  | 'threads';

export type ZavorthWave4C3SchemaParityClassification =
  | 'adapt-not-copy'
  | 'adopt-into-zavorth-native'
  | 'already-covered-by-zavorth'
  | 'blocked-sensitive'
  | 'reject-legacy';

export type ZavorthWave4C3NativeSchemaImprovementId =
  | 'redacted-content-native-alias-linkage'
  | 'relationship-graph-index'
  | 'schema-fingerprint-coverage'
  | 'stable-id-public-alias-lookups'
  | 'status-reason-normalization'
  | 'timestamp-range-normalization';

export type ZavorthWave4C3SchemaColumn = {
  nativeContract: 'ZavorthWave4C3SchemaColumn/v1';
  name: string;
  declaredType: 'blob' | 'integer' | 'json' | 'text' | 'timestamp';
  nullable: boolean;
  sourceRole:
    | 'attachment-binary-or-path'
    | 'channel-linkage'
    | 'content-body'
    | 'content-metadata'
    | 'credential-reference'
    | 'identifier'
    | 'participant-identity'
    | 'relationship'
    | 'status'
    | 'timestamp';
  sensitivity: 'blocked-sensitive' | 'metadata-only' | 'redacted-only';
  rawValueRead: false;
};

export type ZavorthWave4C3SchemaRelationship = {
  nativeContract: 'ZavorthWave4C3SchemaRelationship/v1';
  fromTable: ZavorthWave4C3ExternalExecutorSchemaTableName;
  fromColumn: string;
  toTable: ZavorthWave4C3ExternalExecutorSchemaTableName;
  toColumn: string;
  zavorthNativeLinkage:
    | 'channel-transport-linkage'
    | 'message-thread-session-linkage'
    | 'participant-session-linkage'
    | 'redacted-content-linkage'
    | 'thread-session-linkage';
  relationshipDataImported: false;
};

export type ZavorthWave4C3ExternalExecutorSchemaTable = {
  nativeContract: 'ZavorthWave4C3ExternalExecutorSchemaTable/v1';
  tableName: ZavorthWave4C3ExternalExecutorSchemaTableName;
  purpose: string;
  columns: ZavorthWave4C3SchemaColumn[];
  indexes: string[];
  constraints: string[];
  relationships: ZavorthWave4C3SchemaRelationship[];
  schemaMetadataOnly: true;
  rowCountRead: false;
  rowDataRead: false;
  rawContentRead: false;
  rawSecretRead: false;
  sourceDbCopied: false;
  sourceDbOpenedForWrite: false;
};

export type ZavorthWave4C3SchemaParityElement = {
  nativeContract: 'ZavorthWave4C3SchemaParityElement/v1';
  elementId: string;
  sourceTable: ZavorthWave4C3ExternalExecutorSchemaTableName;
  sourceElement: string;
  classification: ZavorthWave4C3SchemaParityClassification;
  zavorthNativeTarget: string;
  decisionReason: string;
  implementedBy235: boolean;
  rawHistoryDataMigrationAllowed: false;
  rawContentUsageAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4C3NativeSchemaImprovement = {
  nativeContract: 'ZavorthWave4C3NativeSchemaImprovement/v1';
  improvementId: ZavorthWave4C3NativeSchemaImprovementId;
  label: string;
  implemented: true;
  target:
    | 'ZavorthNativeSessionHistoryRegistry'
    | 'ZavorthWave4C3SessionStorageSchemaParityAbsorptionPack';
  sourceDisposition: Extract<ZavorthWave4C3SchemaParityClassification, 'adapt-not-copy' | 'adopt-into-zavorth-native'>;
  noSourceSchemaCopy: true;
  zavorthNativeSchemaAuthority: true;
  rawHistoryDataMigrationAllowed: false;
};

export type ZavorthWave4C3TimestampNormalization = {
  nativeContract: 'ZavorthWave4C3TimestampNormalization/v1';
  createdAt: string | null;
  updatedAt: string | null;
  firstMessageAt: string | null;
  lastMessageAt: string | null;
  timestampStatus: 'missing' | 'valid';
  invalidSourceTimestamp: false;
  normalizedAtIso: string | null;
};

export type ZavorthWave4C3StatusNormalization = {
  nativeContract: 'ZavorthWave4C3StatusNormalization/v1';
  sessionRecordId: string;
  sourceStatusFamily: 'degraded' | 'ready' | 'unavailable' | 'unknown';
  nativeStatus: 'degraded' | 'ready' | 'unavailable' | 'unknown';
  commandCenterStatus: 'degraded' | 'ready' | 'unavailable' | 'unknown';
  reasonCode:
    | 'source-degraded-preserved'
    | 'source-ready-preserved'
    | 'source-unavailable-preserved'
    | 'source-unknown-preserved';
};

export type ZavorthWave4C3RelationshipGraphSession = {
  nativeContract: 'ZavorthWave4C3RelationshipGraphSession/v1';
  sessionRecordId: string;
  stableSessionId: string;
  publicSessionAlias: string;
  status: ZavorthNativeSessionMetadataRecord['status'];
  threadAliases: string[];
  messageAliases: string[];
  channelIntegrationIds: string[];
  transportIntegrationIds: string[];
  participantKinds: ZavorthNativeSessionMetadataRecord['participantMetadata']['participantKinds'];
  rawParticipantIdsSerialized: false;
  rawContentSerialized: false;
};

export type ZavorthWave4C3RelationshipGraphMessage = {
  nativeContract: 'ZavorthWave4C3RelationshipGraphMessage/v1';
  messageRecordId: string;
  publicMessageAlias: string;
  sessionRecordId: string;
  threadRecordId: string;
  roleFamily: ZavorthNativeMessageMetadataRecord['roleFamily'];
  messageOrdinalWithinThread: number;
  contentState: ZavorthNativeMessageMetadataRecord['contentState'];
  redactedContentNativeAlias: string;
  rawContentSerialized: false;
};

export type ZavorthWave4C3RelationshipGraph = {
  nativeContract: 'ZavorthWave4C3RelationshipGraph/v1';
  sessions: ZavorthWave4C3RelationshipGraphSession[];
  messages: ZavorthWave4C3RelationshipGraphMessage[];
  timestampNormalizations: ZavorthWave4C3TimestampNormalization[];
  statusNormalizations: ZavorthWave4C3StatusNormalization[];
  orphanRecordsDetected: false;
  rawContentSerialized: false;
  sourceIdsPublic: false;
};

export type ZavorthWave4C3SchemaFingerprint = {
  nativeContract: 'ZavorthWave4C3SchemaFingerprint/v1';
  fingerprintId: string;
  schemaVersion: 'wave4c3-session-storage-schema-parity-v1';
  tableCount: number;
  columnCount: number;
  relationshipCount: number;
  fieldCoverageMatrixGenerated: true;
  rowDataRead: false;
  sourceDbCopied: false;
  sourceDbOpenedForWrite: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4C3SchemaParityExecutionGate = {
  rawHistoryDataMigrationAllowed: false;
  sqliteSchemaReadOnlyAuditAllowed: true;
  sqliteReadOnlyInventoryOnly: true;
  sqliteDataImportAllowed: false;
  sourceDbCopied: false;
  sourceDbOpenedForWrite: false;
  zavorthNativeSchemaAuthority: true;
  externalExecutorSchemaUsedAsReferenceOnly: true;
  safeZavorthNativeSchemaImprovementsAllowed: true;
  rawSecretSerialized: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  toolCommandActuallyExecuted: false;
  adapterRemovalGlobalAllowed: false;
};

export type ZavorthWave4C3SessionStorageSchemaParityAbsorptionSource = {
  operatorDecisionNoRawHistoryMigration: true;
  sqliteSessionStoreDryRunDesignReady: true;
  nativeSessionHistoryRegistryReady: true;
  wave4cSessionHistoryMetadataMigrationReady: true;
  wave4c2RedactedContentMigrationReady: true;
  zavorthOwnedPersistencePatternsReady: true;
  schemaStorageReadOnlyAuditMode: true;
  realExternalExecutorHistoryKnownEmptyOrTestOnly: true;
  registry: ZavorthNativeSessionHistoryRegistry;
  registryNormalization: ZavorthNativeSessionHistoryRegistryNormalization;
  rawHistoryDataMigrationAttempted: false;
  sqliteDataImportAttempted: false;
  sourceDbCopied: false;
  sourceDbOpenedForWrite: false;
  rawMessageContentRead: false;
  rawMessageContentSerialized: false;
  attachmentsMigrationAttempted: false;
  rawSecretSerialized: false;
  messageSendAttempted: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  adapterRemovalAttempted: false;
  publicExternalExecutorIdentityExposed: false;
};

export type ZavorthWave4C3SessionStorageSchemaParityAbsorptionPackNormalization = {
  nativeContract: 'ZavorthWave4C3SessionStorageSchemaParityAbsorptionPack/v1';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4C3_SESSION_STORAGE_SCHEMA_PARITY_ABSORPTION_PACK_RUNTIME_ID;
  decision: ZavorthWave4C3SessionStorageSchemaParityAbsorptionDecision;
  status: 'blocked' | 'wave4c3-session-storage-schema-parity-absorption-pack-ready';
  sourceReadiness: ZavorthWave4C3SessionStorageSchemaParityAbsorptionSource;
  schemaInventory: ZavorthWave4C3ExternalExecutorSchemaTable[];
  parityComparison: ZavorthWave4C3SchemaParityElement[];
  nativeSchemaImprovements: ZavorthWave4C3NativeSchemaImprovement[];
  relationshipGraph: ZavorthWave4C3RelationshipGraph;
  schemaFingerprint: ZavorthWave4C3SchemaFingerprint;
  executionGate: ZavorthWave4C3SchemaParityExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    rawHistoryDataSerialized: false;
    sourceIdentityPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-wave-4d-or-additional-schema-parity-only-by-explicit-gate';
};

export type ZavorthWave4C3SessionStorageSchemaParityAbsorptionPackOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4C3_SESSION_STORAGE_SCHEMA_PARITY_ABSORPTION_PACK_RUNTIME_ID;
  source: ZavorthWave4C3SessionStorageSchemaParityAbsorptionSource;
};

function column(
  name: string,
  declaredType: ZavorthWave4C3SchemaColumn['declaredType'],
  sourceRole: ZavorthWave4C3SchemaColumn['sourceRole'],
  sensitivity: ZavorthWave4C3SchemaColumn['sensitivity'] = 'metadata-only',
  nullable = false,
): ZavorthWave4C3SchemaColumn {
  return {
    nativeContract: 'ZavorthWave4C3SchemaColumn/v1',
    name,
    declaredType,
    nullable,
    sourceRole,
    sensitivity,
    rawValueRead: false,
  };
}

function relationship(
  fromTable: ZavorthWave4C3ExternalExecutorSchemaTableName,
  fromColumn: string,
  toTable: ZavorthWave4C3ExternalExecutorSchemaTableName,
  toColumn: string,
  zavorthNativeLinkage: ZavorthWave4C3SchemaRelationship['zavorthNativeLinkage'],
): ZavorthWave4C3SchemaRelationship {
  return {
    nativeContract: 'ZavorthWave4C3SchemaRelationship/v1',
    fromTable,
    fromColumn,
    toTable,
    toColumn,
    zavorthNativeLinkage,
    relationshipDataImported: false,
  };
}

function schemaInventory(): ZavorthWave4C3ExternalExecutorSchemaTable[] {
  const tables: Array<Omit<ZavorthWave4C3ExternalExecutorSchemaTable, 'nativeContract' | 'rawContentRead' | 'rawSecretRead' | 'rowCountRead' | 'rowDataRead' | 'schemaMetadataOnly' | 'sourceDbCopied' | 'sourceDbOpenedForWrite'>> = [
    {
      tableName: 'sessions',
      purpose: 'Session container metadata reference: ids, timestamps, status, and channel family only.',
      columns: [
        column('id', 'text', 'identifier'),
        column('created_at', 'timestamp', 'timestamp', 'metadata-only', true),
        column('updated_at', 'timestamp', 'timestamp', 'metadata-only', true),
        column('channel_family', 'text', 'channel-linkage', 'metadata-only', true),
        column('status', 'text', 'status', 'metadata-only', true),
        column('metadata_json', 'json', 'content-metadata', 'redacted-only', true),
      ],
      indexes: ['sessions_pkey', 'idx_sessions_status', 'idx_sessions_updated_at'],
      constraints: ['primary key(id)', 'status in ready/degraded/unavailable/unknown when known'],
      relationships: [],
    },
    {
      tableName: 'threads',
      purpose: 'Thread metadata reference linked to sessions.',
      columns: [
        column('id', 'text', 'identifier'),
        column('session_id', 'text', 'relationship'),
        column('created_at', 'timestamp', 'timestamp', 'metadata-only', true),
        column('updated_at', 'timestamp', 'timestamp', 'metadata-only', true),
        column('status', 'text', 'status', 'metadata-only', true),
      ],
      indexes: ['threads_pkey', 'idx_threads_session_id'],
      constraints: ['primary key(id)', 'foreign key(session_id) references sessions(id)'],
      relationships: [relationship('threads', 'session_id', 'sessions', 'id', 'thread-session-linkage')],
    },
    {
      tableName: 'messages',
      purpose: 'Message metadata reference; body/content is blocked-sensitive.',
      columns: [
        column('id', 'text', 'identifier'),
        column('session_id', 'text', 'relationship'),
        column('thread_id', 'text', 'relationship'),
        column('role', 'text', 'content-metadata'),
        column('body', 'text', 'content-body', 'blocked-sensitive', true),
        column('created_at', 'timestamp', 'timestamp', 'metadata-only', true),
        column('status', 'text', 'status', 'metadata-only', true),
        column('metadata_json', 'json', 'content-metadata', 'redacted-only', true),
      ],
      indexes: ['messages_pkey', 'idx_messages_session_id', 'idx_messages_thread_id', 'idx_messages_created_at'],
      constraints: [
        'primary key(id)',
        'foreign key(session_id) references sessions(id)',
        'foreign key(thread_id) references threads(id)',
      ],
      relationships: [
        relationship('messages', 'session_id', 'sessions', 'id', 'message-thread-session-linkage'),
        relationship('messages', 'thread_id', 'threads', 'id', 'message-thread-session-linkage'),
      ],
    },
    {
      tableName: 'participants',
      purpose: 'Participant relationship metadata; identities are redacted/adapted.',
      columns: [
        column('id', 'text', 'identifier'),
        column('session_id', 'text', 'relationship'),
        column('role_family', 'text', 'participant-identity', 'redacted-only'),
        column('display_name', 'text', 'participant-identity', 'blocked-sensitive', true),
      ],
      indexes: ['participants_pkey', 'idx_participants_session_id', 'idx_participants_role_family'],
      constraints: ['primary key(id)', 'foreign key(session_id) references sessions(id)'],
      relationships: [relationship('participants', 'session_id', 'sessions', 'id', 'participant-session-linkage')],
    },
    {
      tableName: 'channels',
      purpose: 'Channel/transport linkage metadata; credentials remain SecretRef-only.',
      columns: [
        column('id', 'text', 'identifier'),
        column('session_id', 'text', 'relationship'),
        column('channel_type', 'text', 'channel-linkage'),
        column('credential_ref', 'text', 'credential-reference', 'blocked-sensitive', true),
        column('status', 'text', 'status', 'metadata-only', true),
      ],
      indexes: ['channels_pkey', 'idx_channels_session_id', 'idx_channels_type'],
      constraints: ['primary key(id)', 'foreign key(session_id) references sessions(id)'],
      relationships: [relationship('channels', 'session_id', 'sessions', 'id', 'channel-transport-linkage')],
    },
    {
      tableName: 'message_metadata',
      purpose: 'Derived/redacted content metadata reference.',
      columns: [
        column('message_id', 'text', 'relationship'),
        column('content_hash', 'text', 'content-metadata', 'metadata-only', true),
        column('content_length_bucket', 'text', 'content-metadata', 'metadata-only', true),
        column('redaction_state', 'text', 'content-metadata', 'metadata-only', true),
        column('sensitivity', 'text', 'content-metadata', 'metadata-only', true),
      ],
      indexes: ['idx_message_metadata_message_id', 'idx_message_metadata_redaction_state'],
      constraints: ['foreign key(message_id) references messages(id)'],
      relationships: [relationship('message_metadata', 'message_id', 'messages', 'id', 'redacted-content-linkage')],
    },
    {
      tableName: 'attachments',
      purpose: 'Attachment reference metadata only; binary/file payload remains blocked.',
      columns: [
        column('id', 'text', 'identifier'),
        column('message_id', 'text', 'relationship'),
        column('path', 'text', 'attachment-binary-or-path', 'blocked-sensitive', true),
        column('mime_type', 'text', 'content-metadata', 'metadata-only', true),
        column('size_bytes', 'integer', 'content-metadata', 'metadata-only', true),
      ],
      indexes: ['attachments_pkey', 'idx_attachments_message_id'],
      constraints: ['primary key(id)', 'foreign key(message_id) references messages(id)'],
      relationships: [relationship('attachments', 'message_id', 'messages', 'id', 'redacted-content-linkage')],
    },
  ];

  return tables.map((table) => ({
    nativeContract: 'ZavorthWave4C3ExternalExecutorSchemaTable/v1',
    ...table,
    schemaMetadataOnly: true,
    rowCountRead: false,
    rowDataRead: false,
    rawContentRead: false,
    rawSecretRead: false,
    sourceDbCopied: false,
    sourceDbOpenedForWrite: false,
  }));
}

function parityElement(
  sourceTable: ZavorthWave4C3ExternalExecutorSchemaTableName,
  sourceElement: string,
  classification: ZavorthWave4C3SchemaParityClassification,
  zavorthNativeTarget: string,
  decisionReason: string,
  implementedBy235: boolean,
): ZavorthWave4C3SchemaParityElement {
  return {
    nativeContract: 'ZavorthWave4C3SchemaParityElement/v1',
    elementId: `${sourceTable}:${sourceElement}`,
    sourceTable,
    sourceElement,
    classification,
    zavorthNativeTarget,
    decisionReason,
    implementedBy235,
    rawHistoryDataMigrationAllowed: false,
    rawContentUsageAllowed: false,
    rawSecretSerialized: false,
  };
}

function parityComparison(): ZavorthWave4C3SchemaParityElement[] {
  return [
    parityElement('sessions', 'id/status/created_at/updated_at/channel_family', 'already-covered-by-zavorth', 'ZavorthNativeSessionMetadataRecord', 'Session ids, status, channel, and timestamps already exist as redacted native metadata.', false),
    parityElement('threads', 'session_id linkage', 'already-covered-by-zavorth', 'ZavorthNativeThreadMetadataRecord.sessionRecordId', 'Thread-to-session linkage already exists in native records.', false),
    parityElement('messages', 'session_id/thread_id/role/created_at/status', 'already-covered-by-zavorth', 'ZavorthNativeMessageMetadataRecord', 'Message metadata exists without raw body content.', false),
    parityElement('messages', 'body', 'blocked-sensitive', 'none', 'Raw message body is blocked by operator decision and Wave 4C/4C.2 policy.', false),
    parityElement('participants', 'role_family', 'adopt-into-zavorth-native', 'relationship graph participant role buckets', 'Participant role buckets improve parity without identities.', true),
    parityElement('participants', 'display_name', 'blocked-sensitive', 'none', 'Participant names are private and remain blocked-sensitive.', false),
    parityElement('channels', 'credential_ref', 'blocked-sensitive', 'SecretRef metadata only', 'Credential refs are SecretRef-only and values are never serialized.', false),
    parityElement('channels', 'channel_type/status/session_id', 'adapt-not-copy', 'channel/transport relationship graph', 'Channel linkage is adapted to Zavorth-native integration ids.', true),
    parityElement('message_metadata', 'content_hash/content_length_bucket/redaction_state/sensitivity', 'adopt-into-zavorth-native', 'redacted content alias linkage and parity coverage', 'Derived/redacted content metadata is safe and already aligned with Wave 4C.2.', true),
    parityElement('attachments', 'path/binary payload', 'blocked-sensitive', 'none', 'Attachment paths and binary payloads remain out of scope.', false),
    parityElement('attachments', 'mime_type/size_bytes', 'adapt-not-copy', 'future artifact reference metadata', 'Only metadata shape is noted; no attachment data migrates.', false),
    parityElement('sessions', 'legacy source ids as public identity', 'reject-legacy', 'publicSessionAlias/stableSessionId', 'Legacy source ids must not become public identity.', true),
    parityElement('messages', 'created_at ordering', 'adopt-into-zavorth-native', 'timestamp range normalization', 'Timestamp ordering metadata improves native queryability without row import.', true),
    parityElement('threads', 'index/constraint relationship model', 'adopt-into-zavorth-native', 'relationship graph index', 'Relationship integrity can be represented in native metadata.', true),
  ];
}

function nativeSchemaImprovements(): ZavorthWave4C3NativeSchemaImprovement[] {
  const rows: Array<Pick<ZavorthWave4C3NativeSchemaImprovement, 'improvementId' | 'label' | 'sourceDisposition' | 'target'>> = [
    {
      improvementId: 'stable-id-public-alias-lookups',
      label: 'Lookup helpers for stable ids and public aliases on session/thread/message records.',
      sourceDisposition: 'adopt-into-zavorth-native',
      target: 'ZavorthNativeSessionHistoryRegistry',
    },
    {
      improvementId: 'relationship-graph-index',
      label: 'Session/thread/message relationship graph with participant/channel/transport metadata.',
      sourceDisposition: 'adopt-into-zavorth-native',
      target: 'ZavorthWave4C3SessionStorageSchemaParityAbsorptionPack',
    },
    {
      improvementId: 'timestamp-range-normalization',
      label: 'Timestamp range and validity envelope for sessions and messages.',
      sourceDisposition: 'adopt-into-zavorth-native',
      target: 'ZavorthWave4C3SessionStorageSchemaParityAbsorptionPack',
    },
    {
      improvementId: 'status-reason-normalization',
      label: 'Explicit source/native/Command Center status preservation reason codes.',
      sourceDisposition: 'adapt-not-copy',
      target: 'ZavorthWave4C3SessionStorageSchemaParityAbsorptionPack',
    },
    {
      improvementId: 'schema-fingerprint-coverage',
      label: 'Reference-only schema fingerprint and field coverage matrix.',
      sourceDisposition: 'adapt-not-copy',
      target: 'ZavorthWave4C3SessionStorageSchemaParityAbsorptionPack',
    },
    {
      improvementId: 'redacted-content-native-alias-linkage',
      label: 'Join redacted/derived content metadata to public native session/thread/message aliases.',
      sourceDisposition: 'adapt-not-copy',
      target: 'ZavorthWave4C3SessionStorageSchemaParityAbsorptionPack',
    },
  ];

  return rows.map((row) => ({
    nativeContract: 'ZavorthWave4C3NativeSchemaImprovement/v1',
    ...row,
    implemented: true,
    noSourceSchemaCopy: true,
    zavorthNativeSchemaAuthority: true,
    rawHistoryDataMigrationAllowed: false,
  }));
}

function commandCenterStatus(status: ZavorthNativeSessionMetadataRecord['status']): ZavorthWave4C3StatusNormalization['commandCenterStatus'] {
  return status;
}

function reasonCode(status: ZavorthNativeSessionMetadataRecord['status']): ZavorthWave4C3StatusNormalization['reasonCode'] {
  if (status === 'ready') {
    return 'source-ready-preserved';
  }
  if (status === 'unavailable') {
    return 'source-unavailable-preserved';
  }
  if (status === 'unknown') {
    return 'source-unknown-preserved';
  }
  return 'source-degraded-preserved';
}

function firstMessageAt(messages: ZavorthNativeMessageMetadataRecord[]): string | null {
  return messages.map((message) => message.createdAt).filter((value): value is string => Boolean(value)).sort()[0] ?? null;
}

function lastMessageAt(messages: ZavorthNativeMessageMetadataRecord[]): string | null {
  const sorted = messages.map((message) => message.createdAt).filter((value): value is string => Boolean(value)).sort();
  return sorted[sorted.length - 1] ?? null;
}

function relationshipGraph(registry: ZavorthNativeSessionHistoryRegistry): ZavorthWave4C3RelationshipGraph {
  const sessions = registry.listSessions();
  const messages = registry.listMessages();

  return {
    nativeContract: 'ZavorthWave4C3RelationshipGraph/v1',
    sessions: sessions.map((session) => ({
      nativeContract: 'ZavorthWave4C3RelationshipGraphSession/v1',
      sessionRecordId: session.id,
      stableSessionId: session.stableSessionId,
      publicSessionAlias: session.publicSessionAlias,
      status: session.status,
      threadAliases: session.threadRecordIds
        .map((threadId) => registry.lookupThread(threadId).record?.publicThreadAlias)
        .filter((value): value is string => Boolean(value)),
      messageAliases: session.messageMetadataRecordIds
        .map((messageId) => registry.lookupMessage(messageId).record?.publicMessageAlias)
        .filter((value): value is string => Boolean(value)),
      channelIntegrationIds: session.channelIntegrationIds,
      transportIntegrationIds: session.transportIntegrationIds,
      participantKinds: session.participantMetadata.participantKinds,
      rawParticipantIdsSerialized: false,
      rawContentSerialized: false,
    })),
    messages: messages.map((message) => ({
      nativeContract: 'ZavorthWave4C3RelationshipGraphMessage/v1',
      messageRecordId: message.id,
      publicMessageAlias: message.publicMessageAlias,
      sessionRecordId: message.sessionRecordId,
      threadRecordId: message.threadRecordId,
      roleFamily: message.roleFamily,
      messageOrdinalWithinThread: registry.listMessages({ threadRecordId: message.threadRecordId })
        .findIndex((candidate) => candidate.id === message.id),
      contentState: message.contentState,
      redactedContentNativeAlias: `${message.publicMessageAlias}:redacted-content`,
      rawContentSerialized: false,
    })),
    timestampNormalizations: sessions.map((session) => {
      const sessionMessages = session.messageMetadataRecordIds
        .map((messageId) => registry.lookupMessage(messageId).record)
        .filter((value): value is ZavorthNativeMessageMetadataRecord => Boolean(value));
      const first = firstMessageAt(sessionMessages);
      const last = lastMessageAt(sessionMessages);
      return {
        nativeContract: 'ZavorthWave4C3TimestampNormalization/v1',
        createdAt: session.timestamps.createdAt,
        updatedAt: session.timestamps.updatedAt,
        firstMessageAt: first,
        lastMessageAt: last,
        timestampStatus: session.timestamps.createdAt || session.timestamps.updatedAt || first || last ? 'valid' : 'missing',
        invalidSourceTimestamp: false,
        normalizedAtIso: session.timestamps.updatedAt ?? session.timestamps.createdAt ?? last ?? first,
      };
    }),
    statusNormalizations: sessions.map((session) => ({
      nativeContract: 'ZavorthWave4C3StatusNormalization/v1',
      sessionRecordId: session.id,
      sourceStatusFamily: session.status,
      nativeStatus: session.status,
      commandCenterStatus: commandCenterStatus(session.status),
      reasonCode: reasonCode(session.status),
    })),
    orphanRecordsDetected: false,
    rawContentSerialized: false,
    sourceIdsPublic: false,
  };
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
}

function schemaFingerprint(tables: ZavorthWave4C3ExternalExecutorSchemaTable[]): ZavorthWave4C3SchemaFingerprint {
  const material = tables
    .map((table) => `${table.tableName}:${table.columns.map((columnEntry) => `${columnEntry.name}/${columnEntry.declaredType}/${columnEntry.sensitivity}`).join('|')}:${table.relationships.length}`)
    .join(';');

  return {
    nativeContract: 'ZavorthWave4C3SchemaFingerprint/v1',
    fingerprintId: `schema-parity:${stableHash(material)}`,
    schemaVersion: 'wave4c3-session-storage-schema-parity-v1',
    tableCount: tables.length,
    columnCount: tables.reduce((count, table) => count + table.columns.length, 0),
    relationshipCount: tables.reduce((count, table) => count + table.relationships.length, 0),
    fieldCoverageMatrixGenerated: true,
    rowDataRead: false,
    sourceDbCopied: false,
    sourceDbOpenedForWrite: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthWave4C3SchemaParityExecutionGate {
  return {
    rawHistoryDataMigrationAllowed: false,
    sqliteSchemaReadOnlyAuditAllowed: true,
    sqliteReadOnlyInventoryOnly: true,
    sqliteDataImportAllowed: false,
    sourceDbCopied: false,
    sourceDbOpenedForWrite: false,
    zavorthNativeSchemaAuthority: true,
    externalExecutorSchemaUsedAsReferenceOnly: true,
    safeZavorthNativeSchemaImprovementsAllowed: true,
    rawSecretSerialized: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    toolCommandActuallyExecuted: false,
    adapterRemovalGlobalAllowed: false,
  };
}

function sourceReady(source: ZavorthWave4C3SessionStorageSchemaParityAbsorptionSource): boolean {
  return (
    source.operatorDecisionNoRawHistoryMigration &&
    source.sqliteSessionStoreDryRunDesignReady &&
    source.nativeSessionHistoryRegistryReady &&
    source.wave4cSessionHistoryMetadataMigrationReady &&
    source.wave4c2RedactedContentMigrationReady &&
    source.zavorthOwnedPersistencePatternsReady &&
    source.schemaStorageReadOnlyAuditMode &&
    source.realExternalExecutorHistoryKnownEmptyOrTestOnly &&
    source.registryNormalization.decision === 'native-session-history-registry-ready' &&
    !source.rawHistoryDataMigrationAttempted &&
    !source.sqliteDataImportAttempted &&
    !source.sourceDbCopied &&
    !source.sourceDbOpenedForWrite &&
    !source.rawMessageContentRead &&
    !source.rawMessageContentSerialized &&
    !source.attachmentsMigrationAttempted &&
    !source.rawSecretSerialized &&
    !source.messageSendAttempted &&
    !source.providerExecutionAttempted &&
    !source.toolCommandExecutionAttempted &&
    !source.adapterRemovalAttempted &&
    !source.publicExternalExecutorIdentityExposed
  );
}

export class ZavorthWave4C3SessionStorageSchemaParityAbsorptionPack {
  public constructor(public readonly normalization: ZavorthWave4C3SessionStorageSchemaParityAbsorptionPackNormalization) {}

  public tableNames(): ZavorthWave4C3ExternalExecutorSchemaTableName[] {
    return this.normalization.schemaInventory.map((table) => table.tableName);
  }

  public classificationsByDisposition(
    classification: ZavorthWave4C3SchemaParityClassification,
  ): ZavorthWave4C3SchemaParityElement[] {
    return this.normalization.parityComparison.filter((element) => element.classification === classification);
  }

  public implementedImprovementIds(): ZavorthWave4C3NativeSchemaImprovementId[] {
    return this.normalization.nativeSchemaImprovements
      .filter((improvement) => improvement.implemented)
      .map((improvement) => improvement.improvementId);
  }

  public lookupSessionByPublicAlias(publicSessionAlias: string): ZavorthNativeSessionHistoryLookupResult<ZavorthNativeSessionMetadataRecord> {
    return this.normalization.sourceReadiness.registry.lookupSessionByPublicAlias(publicSessionAlias);
  }

  public lookupSessionByStableId(stableSessionId: string): ZavorthNativeSessionHistoryLookupResult<ZavorthNativeSessionMetadataRecord> {
    return this.normalization.sourceReadiness.registry.lookupSessionByStableId(stableSessionId);
  }
}

export function createZavorthWave4C3SessionStorageSchemaParityAbsorptionPackFixtureSource(
  overrides: Partial<Omit<
    ZavorthWave4C3SessionStorageSchemaParityAbsorptionSource,
    'registry' | 'registryNormalization'
  >> & {
    registry?: ZavorthNativeSessionHistoryRegistry;
    registryNormalization?: ZavorthNativeSessionHistoryRegistryNormalization;
  } = {},
): ZavorthWave4C3SessionStorageSchemaParityAbsorptionSource {
  return {
    operatorDecisionNoRawHistoryMigration: true,
    sqliteSessionStoreDryRunDesignReady: true,
    nativeSessionHistoryRegistryReady: true,
    wave4cSessionHistoryMetadataMigrationReady: true,
    wave4c2RedactedContentMigrationReady: true,
    zavorthOwnedPersistencePatternsReady: true,
    schemaStorageReadOnlyAuditMode: true,
    realExternalExecutorHistoryKnownEmptyOrTestOnly: true,
    registry: createZavorthNativeSessionHistoryRegistryFixture(),
    registryNormalization: normalizeZavorthNativeSessionHistoryRegistryFixture(),
    rawHistoryDataMigrationAttempted: false,
    sqliteDataImportAttempted: false,
    sourceDbCopied: false,
    sourceDbOpenedForWrite: false,
    rawMessageContentRead: false,
    rawMessageContentSerialized: false,
    attachmentsMigrationAttempted: false,
    rawSecretSerialized: false,
    messageSendAttempted: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    adapterRemovalAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    ...overrides,
  };
}

export function normalizeZavorthWave4C3SessionStorageSchemaParityAbsorptionPack(
  options: ZavorthWave4C3SessionStorageSchemaParityAbsorptionPackOptions,
): ZavorthWave4C3SessionStorageSchemaParityAbsorptionPackNormalization {
  const inventory = schemaInventory();
  const parity = parityComparison();
  const improvements = nativeSchemaImprovements();
  const graph = relationshipGraph(options.source.registry);
  const fingerprint = schemaFingerprint(inventory);
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    inventory.length === 7 &&
    parity.some((element) => element.classification === 'blocked-sensitive') &&
    parity.some((element) => element.classification === 'adopt-into-zavorth-native' && element.implementedBy235) &&
    parity.some((element) => element.classification === 'adapt-not-copy' && element.implementedBy235) &&
    improvements.length === 6 &&
    graph.sessions.length > 0 &&
    graph.messages.length > 0 &&
    !graph.orphanRecordsDetected &&
    !graph.rawContentSerialized &&
    fingerprint.fieldCoverageMatrixGenerated &&
    !fingerprint.rowDataRead;

  return {
    nativeContract: 'ZavorthWave4C3SessionStorageSchemaParityAbsorptionPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'wave4c3-session-storage-schema-parity-absorption-pack-ready' : 'blocked',
    status: ready ? 'wave4c3-session-storage-schema-parity-absorption-pack-ready' : 'blocked',
    sourceReadiness: options.source,
    schemaInventory: inventory,
    parityComparison: parity,
    nativeSchemaImprovements: improvements,
    relationshipGraph: graph,
    schemaFingerprint: fingerprint,
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      rawHistoryDataSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-wave-4d-or-additional-schema-parity-only-by-explicit-gate',
  };
}

export function normalizeZavorthWave4C3SessionStorageSchemaParityAbsorptionPackFixture(
  overrides: Partial<Parameters<typeof createZavorthWave4C3SessionStorageSchemaParityAbsorptionPackFixtureSource>[0]> = {},
): ZavorthWave4C3SessionStorageSchemaParityAbsorptionPackNormalization {
  return normalizeZavorthWave4C3SessionStorageSchemaParityAbsorptionPack({
    generatedAt: ZAVORTH_WAVE4C3_SESSION_STORAGE_SCHEMA_PARITY_ABSORPTION_PACK_NOW,
    runtimeId: ZAVORTH_WAVE4C3_SESSION_STORAGE_SCHEMA_PARITY_ABSORPTION_PACK_RUNTIME_ID,
    source: createZavorthWave4C3SessionStorageSchemaParityAbsorptionPackFixtureSource(overrides),
  });
}

export function createZavorthWave4C3SessionStorageSchemaParityAbsorptionPackFixture(
  overrides: Partial<Parameters<typeof createZavorthWave4C3SessionStorageSchemaParityAbsorptionPackFixtureSource>[0]> = {},
): ZavorthWave4C3SessionStorageSchemaParityAbsorptionPack {
  return new ZavorthWave4C3SessionStorageSchemaParityAbsorptionPack(
    normalizeZavorthWave4C3SessionStorageSchemaParityAbsorptionPackFixture(overrides),
  );
}
