import fs from 'node:fs';
import path from 'node:path';

import {
  createZavorthNativeSessionHistoryRegistryFixture,
  createZavorthWave4C3SessionStorageSchemaParityAbsorptionPackFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4C3NativeSchemaImprovementId,
  ZavorthWave4C3ExternalExecutorSchemaTableName,
  ZavorthWave4C3SchemaParityClassification,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/235-wave-4c3-session-storage-schema-parity-absorption-pack.md';
const NEXT_DOC = 'docs/236-wave-4d-real-message-send-test-target-provisioning-plan.md';
const PRIOR_DOC = 'docs/234-wave-4d-real-message-send-readiness-plan.md';
const PRIOR_TEST = 'tests/runtime/external-agents/ZavorthWave4DRealMessageSendReadinessPlan.test.ts';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4C3SessionStorageSchemaParityAbsorptionPack.ts';
const REGISTRY_BOUNDARY = 'src/runtime/external-agents/ZavorthNativeSessionHistoryRegistry.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const TABLES: ZavorthWave4C3ExternalExecutorSchemaTableName[] = [
  'sessions',
  'threads',
  'messages',
  'participants',
  'channels',
  'message_metadata',
  'attachments',
];

const CLASSIFICATIONS: ZavorthWave4C3SchemaParityClassification[] = [
  'already-covered-by-zavorth',
  'adopt-into-zavorth-native',
  'adapt-not-copy',
  'reject-legacy',
  'blocked-sensitive',
];

const IMPROVEMENTS: ZavorthWave4C3NativeSchemaImprovementId[] = [
  'stable-id-public-alias-lookups',
  'relationship-graph-index',
  'timestamp-range-normalization',
  'status-reason-normalization',
  'schema-fingerprint-coverage',
  'redacted-content-native-alias-linkage',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assertNoRawSecretOrContent(serialized: string): void {
  expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{8,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{8,}/);
  expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  expect(serialized).not.toContain('<redacted-local-secret>');
  expect(serialized).not.toContain('raw user message body that must never migrate');
  expect(serialized).not.toContain('unredacted private message fixture');
  expect(serialized).not.toContain('attachment binary fixture that must never migrate');
}

describe('Wave 4C.3 session storage schema parity absorption pack', () => {
  it('documents 235 as schema-only absorption with raw history migration blocked', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `wave4c3-session-storage-schema-parity-absorption-pack-ready`');
    expect(content).toContain('ZavorthWave4C3SessionStorageSchemaParityAbsorptionPack.ts');
    expect(content).toContain('ZavorthWave4C3SessionStorageSchemaParityAbsorptionPack/v1');
    expect(content).toContain('rawHistoryDataMigrationAllowed=false');
    expect(content).toContain('sqliteSchemaReadOnlyAuditAllowed=true');
    expect(content).toContain('sqliteDataImportAllowed=false');
    expect(content).toContain('sourceDbCopied=false');
    expect(content).toContain('sourceDbOpenedForWrite=false');
    expect(content).toContain('zavorthNativeSchemaAuthority=true');
    expect(content).toContain('externalExecutorSchemaUsedAsReferenceOnly=true');
    expect(content).toContain('rawSecretSerialized=false');
    TABLES.forEach((table) => expect(content).toContain(`\`${table}\``));
    IMPROVEMENTS.forEach((improvement) => expect(content).toContain(improvement));
    expect(content).toContain('Wave 4D Test Target Follow-Up');
    expect(content).toContain(NEXT_DOC);
    assertNoRawSecretOrContent(content);
  });

  it('updates tracking docs and the 234 handoff for the schema parity redirect', () => {
    expect(read(PRIOR_DOC)).toContain('Wave 4C.3 Schema Parity Handoff');
    expect(read(PRIOR_DOC)).toContain(DOC);
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond `235`');
    expect(read(PRIOR_TEST)).toContain(DOC);
    expect(read(GO_NO_GO_DOC)).toContain(DOC);
    expect(read(PAUSE_DOC)).toContain('`235` opens Wave 4C.3');
  });

  it('exports the Wave 4C.3 boundary and registry lookup improvements', () => {
    const boundary = read(BOUNDARY);
    const registryBoundary = read(REGISTRY_BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4C3SessionStorageSchemaParityAbsorptionPack/v1');
    expect(boundary).toContain('ZavorthWave4C3SchemaFingerprint/v1');
    expect(boundary).toContain('ZavorthWave4C3RelationshipGraph/v1');
    expect(index).toContain("from './ZavorthWave4C3SessionStorageSchemaParityAbsorptionPack.js'");
    expect(index).toContain('ZavorthWave4C3SchemaParityExecutionGate');
    expect(registryBoundary).toContain('lookupSessionByStableId');
    expect(registryBoundary).toContain('lookupSessionByPublicAlias');
    expect(registryBoundary).toContain('lookupThreadByStableId');
    expect(registryBoundary).toContain('lookupThreadByPublicAlias');
    expect(registryBoundary).toContain('lookupMessageByStableId');
    expect(registryBoundary).toContain('lookupMessageByPublicAlias');
  });

  it('inventories only schema metadata for session/history storage reference tables', () => {
    const pack = createZavorthWave4C3SessionStorageSchemaParityAbsorptionPackFixture();

    expect(pack.normalization.decision).toBe('wave4c3-session-storage-schema-parity-absorption-pack-ready');
    expect(pack.tableNames()).toEqual(TABLES);
    pack.normalization.schemaInventory.forEach((table) => {
      expect(table).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthWave4C3ExternalExecutorSchemaTable/v1',
        schemaMetadataOnly: true,
        rowCountRead: false,
        rowDataRead: false,
        rawContentRead: false,
        rawSecretRead: false,
        sourceDbCopied: false,
        sourceDbOpenedForWrite: false,
      }));
      expect(table.columns.length).toBeGreaterThan(0);
      expect(table.indexes.length).toBeGreaterThan(0);
      expect(table.constraints.length).toBeGreaterThan(0);
      table.columns.forEach((column) => expect(column.rawValueRead).toBe(false));
    });
    expect(pack.normalization.schemaInventory.some((table) => table.relationships.length > 0)).toBe(true);
  });

  it('classifies schema parity as covered, adopted, adapted, rejected, or blocked-sensitive', () => {
    const pack = createZavorthWave4C3SessionStorageSchemaParityAbsorptionPackFixture();

    CLASSIFICATIONS.forEach((classification) => {
      expect(pack.classificationsByDisposition(classification).length).toBeGreaterThan(0);
    });
    expect(pack.classificationsByDisposition('blocked-sensitive')).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceTable: 'messages', sourceElement: 'body' }),
      expect.objectContaining({ sourceTable: 'participants', sourceElement: 'display_name' }),
      expect.objectContaining({ sourceTable: 'channels', sourceElement: 'credential_ref' }),
      expect.objectContaining({ sourceTable: 'attachments', sourceElement: 'path/binary payload' }),
    ]));
    pack.normalization.parityComparison.forEach((element) => {
      expect(element.rawHistoryDataMigrationAllowed).toBe(false);
      expect(element.rawContentUsageAllowed).toBe(false);
      expect(element.rawSecretSerialized).toBe(false);
    });
  });

  it('implements safe Zavorth-native schema improvements without source schema authority', () => {
    const pack = createZavorthWave4C3SessionStorageSchemaParityAbsorptionPackFixture();

    expect(pack.implementedImprovementIds()).toEqual(IMPROVEMENTS);
    pack.normalization.nativeSchemaImprovements.forEach((improvement) => {
      expect(improvement).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthWave4C3NativeSchemaImprovement/v1',
        implemented: true,
        noSourceSchemaCopy: true,
        zavorthNativeSchemaAuthority: true,
        rawHistoryDataMigrationAllowed: false,
      }));
    });
  });

  it('supports stable id and public alias lookup for sessions, threads, and messages', () => {
    const registry = createZavorthNativeSessionHistoryRegistryFixture();
    const [session] = registry.listSessions();
    const [thread] = registry.listThreads({ sessionRecordId: session.id });
    const [message] = registry.listMessages({ threadRecordId: thread.id });

    expect(registry.lookupSessionByStableId(session.stableSessionId).record?.id).toBe(session.id);
    expect(registry.lookupSessionByPublicAlias(session.publicSessionAlias).record?.id).toBe(session.id);
    expect(registry.lookupThreadByStableId(thread.stableThreadId).record?.id).toBe(thread.id);
    expect(registry.lookupThreadByPublicAlias(thread.publicThreadAlias).record?.id).toBe(thread.id);
    expect(registry.lookupMessageByStableId(message.stableMessageId).record?.id).toBe(message.id);
    expect(registry.lookupMessageByPublicAlias(message.publicMessageAlias).record?.id).toBe(message.id);
  });

  it('builds relationship, timestamp, status, and redacted content parity helpers without raw data', () => {
    const pack = createZavorthWave4C3SessionStorageSchemaParityAbsorptionPackFixture();
    const graph = pack.normalization.relationshipGraph;

    expect(graph.nativeContract).toBe('ZavorthWave4C3RelationshipGraph/v1');
    expect(graph.sessions.length).toBeGreaterThan(0);
    expect(graph.messages.length).toBeGreaterThan(0);
    expect(graph.orphanRecordsDetected).toBe(false);
    expect(graph.rawContentSerialized).toBe(false);
    expect(graph.sourceIdsPublic).toBe(false);
    graph.sessions.forEach((session) => {
      expect(session.publicSessionAlias).toContain('session:');
      expect(session.rawParticipantIdsSerialized).toBe(false);
      expect(session.rawContentSerialized).toBe(false);
    });
    graph.messages.forEach((message) => {
      expect(message.publicMessageAlias).toContain('message:');
      expect(message.redactedContentNativeAlias).toContain(':redacted-content');
      expect(message.messageOrdinalWithinThread).toBeGreaterThanOrEqual(0);
      expect(message.rawContentSerialized).toBe(false);
    });
    expect(graph.timestampNormalizations.length).toBe(graph.sessions.length);
    expect(graph.statusNormalizations.length).toBe(graph.sessions.length);
  });

  it('generates a schema fingerprint from field coverage without reading rows', () => {
    const pack = createZavorthWave4C3SessionStorageSchemaParityAbsorptionPackFixture();

    expect(pack.normalization.schemaFingerprint).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4C3SchemaFingerprint/v1',
      schemaVersion: 'wave4c3-session-storage-schema-parity-v1',
      tableCount: TABLES.length,
      fieldCoverageMatrixGenerated: true,
      rowDataRead: false,
      sourceDbCopied: false,
      sourceDbOpenedForWrite: false,
      rawSecretSerialized: false,
    }));
    expect(pack.normalization.schemaFingerprint.columnCount).toBeGreaterThan(TABLES.length);
    expect(pack.normalization.schemaFingerprint.relationshipCount).toBeGreaterThan(0);
    expect(pack.normalization.schemaFingerprint.fingerprintId).toContain('schema-parity:');
  });

  it('keeps the execution gate and serialized output free of raw data, execution, migration, and adapter removal', () => {
    const pack = createZavorthWave4C3SessionStorageSchemaParityAbsorptionPackFixture();
    const serialized = JSON.stringify(pack.normalization);

    expect(pack.normalization.executionGate).toEqual({
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
    });
    expect(pack.normalization.redaction).toEqual({
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      rawHistoryDataSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    assertNoRawSecretOrContent(serialized);
  });

  it('blocks the pack if raw data import, SQLite write/copy, execution, adapter removal, or public source identity is attempted', () => {
    const pack = createZavorthWave4C3SessionStorageSchemaParityAbsorptionPackFixture({
      rawHistoryDataMigrationAttempted: true,
      sqliteDataImportAttempted: true,
      sourceDbCopied: true,
      sourceDbOpenedForWrite: true,
      rawMessageContentRead: true,
      rawMessageContentSerialized: true,
      attachmentsMigrationAttempted: true,
      rawSecretSerialized: true,
      messageSendAttempted: true,
      providerExecutionAttempted: true,
      toolCommandExecutionAttempted: true,
      adapterRemovalAttempted: true,
      publicExternalExecutorIdentityExposed: true,
    });

    expect(pack.normalization.decision).toBe('blocked');
    expect(pack.normalization.executionGate.sqliteDataImportAllowed).toBe(false);
    expect(pack.normalization.executionGate.sourceDbCopied).toBe(false);
    expect(pack.normalization.executionGate.sourceDbOpenedForWrite).toBe(false);
    expect(pack.normalization.executionGate.messageActuallySent).toBe(false);
    expect(pack.normalization.executionGate.providerActuallyExecuted).toBe(false);
    expect(pack.normalization.executionGate.toolCommandActuallyExecuted).toBe(false);
    expect(pack.normalization.executionGate.adapterRemovalGlobalAllowed).toBe(false);
  });
});
