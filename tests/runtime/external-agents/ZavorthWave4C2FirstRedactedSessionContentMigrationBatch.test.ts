import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE,
  ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE_URI,
  ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_WRITE_FLAG,
  ZAVORTH_WAVE4C2_SESSION_CONTENT_METADATA_SCHEMA_VERSION,
  createZavorthWave4C2FirstRedactedSessionContentMigrationBatchFixture,
  createZavorthWave4C2FirstRedactedSessionContentMigrationBatchFixtureSource,
  createZavorthWave4C2RawSessionContentMigrationReadinessPackFixture,
  createZavorthWave4C2RedactedContentMigrationFeatureFlag,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4C2FirstRedactedContentMigratedRecord,
  ZavorthWave4C2FirstRedactedContentMigrationManifest,
  ZavorthWave4C2RawSessionContentMigrationReadinessPackNormalization,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/227-wave-4c2-first-redacted-session-content-migration-batch.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/226-wave-4c2-raw-session-content-migration-readiness-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4C2FirstRedactedSessionContentMigrationBatch.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function migrationRoot(): string {
  return path.join(
    process.cwd(),
    '.tmp',
    'zavorth-wave4c2-first-redacted-session-content-migration-batch-test',
    ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE,
  );
}

function listJsonFiles(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }

  const pending = [root];
  const files: string[] = [];
  while (pending.length > 0) {
    const current = pending.pop() as string;
    fs.readdirSync(current, { withFileTypes: true }).forEach((entry) => {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(absolute);
        return;
      }
      if (entry.isFile() && entry.name.endsWith('.json')) {
        files.push(absolute);
      }
    });
  }
  return files.sort();
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

function assertNoRawSecretOrContentInRoot(root: string): void {
  listJsonFiles(root).forEach((file) => assertNoRawSecretOrContent(fs.readFileSync(file, 'utf8')));
}

function corruptReadinessPack(): ZavorthWave4C2RawSessionContentMigrationReadinessPackNormalization {
  const pack = JSON.parse(JSON.stringify(
    createZavorthWave4C2RawSessionContentMigrationReadinessPackFixture().normalization,
  )) as ZavorthWave4C2RawSessionContentMigrationReadinessPackNormalization;

  pack.firstFutureBatchDesign[0] = {
    ...pack.firstFutureBatchDesign[0],
    schemaVersion: 'zavorth-wave4c2-session-content-metadata/v0' as typeof ZAVORTH_WAVE4C2_SESSION_CONTENT_METADATA_SCHEMA_VERSION,
    idempotencyKey: 'invalid-idempotency-key',
    checksum: 'sha256:invalid',
    policyDecision: 'blocked' as 'allow-future-derived-content-metadata-batch',
    redactionEnvelope: {
      ...pack.firstFutureBatchDesign[0].redactionEnvelope,
      rawMessageContentSerialized: true,
    },
  };
  pack.redactionPolicy = pack.redactionPolicy.map((rule) => rule.sensitivityClass === 'message-content'
    ? { ...rule, allowedDerivedOutputs: [], policyDecision: 'blocked' }
    : rule);

  return pack;
}

function unsafeScopeReadinessPack(): ZavorthWave4C2RawSessionContentMigrationReadinessPackNormalization {
  const pack = JSON.parse(JSON.stringify(
    createZavorthWave4C2RawSessionContentMigrationReadinessPackFixture().normalization,
  )) as ZavorthWave4C2RawSessionContentMigrationReadinessPackNormalization;

  pack.firstFutureBatchDesign[0] = {
    ...pack.firstFutureBatchDesign[0],
    itemClass: 'raw-message-content' as never,
    idempotencyKey: 'wave4c2:derived-content-metadata:v1:raw-message-content',
    checksum: 'sha256:wave4c2-derived-content-metadata:raw-message-content',
  };

  return pack;
}

describe('Wave 4C.2 first redacted session content migration batch', () => {
  const root = migrationRoot();

  beforeEach(() => {
    const batch = createZavorthWave4C2FirstRedactedSessionContentMigrationBatchFixture();
    if (fs.existsSync(root)) {
      batch.cleanup(root);
    }
  });

  afterEach(() => {
    const batch = createZavorthWave4C2FirstRedactedSessionContentMigrationBatchFixture();
    if (fs.existsSync(root)) {
      batch.cleanup(root);
    }
  });

  it('documents 227 as the first controlled redacted session content migration batch', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `wave4c2-first-redacted-content-migration-ready`');
    expect(content).toContain('ZavorthWave4C2FirstRedactedSessionContentMigrationBatch.ts');
    expect(content).toContain('ZavorthWave4C2FirstRedactedContentMigrationFeatureFlagGate/v1');
    expect(content).toContain('ZavorthWave4C2FirstRedactedContentMigratedRecord/v1');
    expect(content).toContain('ZavorthWave4C2FirstRedactedContentMigrationReceipt/v1');
    expect(content).toContain(ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_WRITE_FLAG);
    expect(content).toContain('wave4c2FirstRedactedContentMigrationBatchCreated=true');
    expect(content).toContain('redactedContentMigrationActuallyPerformedOnlyWhenFlagEnabled=true');
    expect(content).toContain('rawMessageContentMigrationAllowed=false');
    expect(content).toContain('Redacted session content load/verify/parity follow-up:');
    expect(content).toContain('docs/228-wave-4c2-redacted-session-content-load-verify-parity.md');
    expect(content).toContain('Do not advance beyond `228`');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the 226 handoff for 227', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/227-wave-4c2-first-redacted-session-content-migration-batch.md');
    expect(read(PAUSE_DOC)).toContain('`227` executes the first controlled Wave 4C.2 redacted session content');
    expect(read(PRIOR_DOC)).toContain('First controlled redacted session content migration batch follow-up:');
    expect(read(PRIOR_DOC)).toContain('docs/227-wave-4c2-first-redacted-session-content-migration-batch.md');
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond the first controlled Wave 4C.2 redacted content batch');
  });

  it('exports the redacted content migration batch boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4C2FirstRedactedContentMigrationReceipt/v1');
    expect(boundary).toContain('ZavorthWave4C2FirstRedactedContentMigrationWriteReceipt/v1');
    expect(boundary).toContain('ZavorthWave4C2FirstRedactedContentMigrationRollbackReceipt/v1');
    expect(index).toContain("from './ZavorthWave4C2FirstRedactedSessionContentMigrationBatch.js'");
    expect(index).toContain('ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_WRITE_FLAG');
  });

  it('blocks writes when the feature flag is disabled', () => {
    const batch = createZavorthWave4C2FirstRedactedSessionContentMigrationBatchFixture();
    const receipt = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4C2RedactedContentMigrationFeatureFlag(false),
    });

    expect(receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4C2FirstRedactedContentMigrationReceipt/v1',
      decision: 'migration-write-blocked',
      redactedContentMigrationWriteFeatureFlagRequired: true,
      redactedContentMigrationActuallyPerformedOnlyWhenFlagEnabled: true,
      backupRollbackMetadataCreated: false,
      sourceRuntimeAuthority: false,
      rawSecretSerialized: false,
    }));
    expect(receipt.validations).toContain('feature-flag-disabled');
    expect(receipt.recordWrites).toHaveLength(0);
    expect(fs.existsSync(root)).toBe(false);
  });

  it('writes only permitted redacted/derived session content metadata when the flag is enabled', () => {
    const batch = createZavorthWave4C2FirstRedactedSessionContentMigrationBatchFixture();
    const receipt = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4C2RedactedContentMigrationFeatureFlag(true),
    });
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')) as ZavorthWave4C2FirstRedactedContentMigrationManifest;

    expect(receipt.decision).toBe('wave4c2-first-redacted-content-migration-ready');
    expect(receipt.validations).toEqual(['valid']);
    expect(receipt.migrationNamespace).toBe(ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE);
    expect(receipt.migrationNamespaceUri).toBe(ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE_URI);
    expect(receipt.backupRollbackMetadataCreated).toBe(true);
    expect(receipt.recordWrites).toHaveLength(7);
    expect(receipt.recordWrites.every((write) => write.status === 'written')).toBe(true);
    expect(receipt.recordWrites.every((write) => write.atomicWriteUsed && write.redactedContentMigrationActuallyPerformed)).toBe(true);
    expect(manifest).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4C2FirstRedactedContentMigrationManifest/v1',
      migrationNamespace: ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE,
      schemaVersion: ZAVORTH_WAVE4C2_SESSION_CONTENT_METADATA_SCHEMA_VERSION,
      batchId: 'wave4c2-redacted-session-content-batch-001',
      recordCount: 7,
      backupRollbackMetadataCreated: true,
      runtimeExternalExecutorRequiredForMigration: false,
      rawSecretSerialized: false,
    }));
    expect(fs.existsSync(path.join(root, 'rollback', 'backup-rollback-manifest.json'))).toBe(true);
    assertNoRawSecretOrContentInRoot(root);
  });

  it('validates redaction/content policy/checksum/idempotency/schema/policy in written records', () => {
    const batch = createZavorthWave4C2FirstRedactedSessionContentMigrationBatchFixture();
    const receipt = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4C2RedactedContentMigrationFeatureFlag(true),
    });

    receipt.recordWrites.forEach((write) => {
      const persisted = JSON.parse(fs.readFileSync(path.join(root, write.relativePath), 'utf8')) as ZavorthWave4C2FirstRedactedContentMigratedRecord;

      expect(persisted).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthWave4C2FirstRedactedContentMigratedRecord/v1',
        migrationNamespace: ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE,
        schemaVersion: ZAVORTH_WAVE4C2_SESSION_CONTENT_METADATA_SCHEMA_VERSION,
        idempotencyKey: write.idempotencyKey,
        checksum: write.checksum,
        checksumAlgorithm: 'sha256-stable-redacted-session-content-metadata',
        contentPolicyDecision: 'allow-derived-metadata-only',
        policyDecision: 'allow-future-derived-content-metadata-batch',
        payloadSensitiveFieldsPersisted: false,
        runtimeExternalExecutorRequiredForMigration: false,
        sourceRuntimeAuthority: false,
        rawMessageContentMigrationAllowed: false,
        rawSqliteCopyAllowed: false,
        sqliteWriteAllowed: false,
        attachmentsMigrationAllowed: false,
        rawSecretMigrationAllowed: false,
        workspaceLogsCacheRawMigrationAllowed: false,
        executionStateMigrationAllowed: false,
        rawSecretSerialized: false,
      }));
      expect(persisted.idempotencyKey).toBe(`wave4c2:derived-content-metadata:v1:${persisted.itemId}`);
      expect(persisted.checksum).toBe(`sha256:wave4c2-derived-content-metadata:${persisted.itemId}`);
      expect(persisted.redactionEnvelope.rawMessageContentSerialized).toBe(false);
      expect(persisted.redactionEnvelope.rawSecretSerialized).toBe(false);
      expect(persisted.redactionEnvelope.rawSqlitePayloadSerialized).toBe(false);
      expect(persisted.redactionEnvelope.attachmentContentSerialized).toBe(false);
      expect(persisted.payload.nativeContract).toBe('ZavorthWave4C2RedactedContentPayload/v1');
      expect(persisted.payload.payloadKind).toBe('redacted-session-content-derived-metadata-only');
      expect(persisted.payload.contentRawStored).toBe(false);
      expect(persisted.payload.rawMessageContentSerialized).toBe(false);
      expect(persisted.payload.rawSecretSerialized).toBe(false);
      expect(persisted.payload.attachmentContentSerialized).toBe(false);
      expect(persisted.payload.sqlitePayloadSerialized).toBe(false);
      assertNoRawSecretOrContent(JSON.stringify(persisted));
    });
  });

  it('blocks invalid schema/checksum/idempotency/redaction/content policy before writing', () => {
    const batch = createZavorthWave4C2FirstRedactedSessionContentMigrationBatchFixture(
      createZavorthWave4C2FirstRedactedSessionContentMigrationBatchFixtureSource({
        readinessPack: corruptReadinessPack(),
      }),
    );
    const receipt = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4C2RedactedContentMigrationFeatureFlag(true),
    });

    expect(receipt.decision).toBe('blocked');
    expect(receipt.validations).toEqual(expect.arrayContaining([
      'schema-invalid',
      'checksum-invalid',
      'idempotency-invalid',
      'policy-blocked',
      'redaction-invalid',
      'content-policy-invalid',
    ]));
    expect(receipt.recordWrites).toHaveLength(0);
    expect(fs.existsSync(root)).toBe(false);
  });

  it('blocks raw content attempts, SQLite copy/write, attachments, secrets, and out-of-scope items', () => {
    const batch = createZavorthWave4C2FirstRedactedSessionContentMigrationBatchFixture(
      createZavorthWave4C2FirstRedactedSessionContentMigrationBatchFixtureSource({
        readinessPack: unsafeScopeReadinessPack(),
        rawMessageContentMigrationAttempted: true,
        rawSqliteCopyAttempted: true,
        sqliteWriteAttempted: true,
        attachmentsMigrationAttempted: true,
        rawSecretMigrationAttempted: true,
        workspaceLogsCacheRawMigrationAttempted: true,
        executionStateMigrationAttempted: true,
        messageSendAttempted: true,
        providerExecutionAttempted: true,
        commandExecutionAttempted: true,
        toolExecutionAttempted: true,
        sourceModuleCopyAttempted: true,
        adapterRemovalAttempted: true,
        publicExternalExecutorIdentityExposed: true,
        rawSecretSerialized: true,
      }),
    );
    const receipt = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4C2RedactedContentMigrationFeatureFlag(true),
    });

    expect(receipt.decision).toBe('blocked');
    expect(receipt.validations).toEqual(expect.arrayContaining([
      'source-not-ready',
      'raw-content-detected',
      'scope-invalid',
      'redaction-invalid',
    ]));
    expect(receipt.recordWrites).toHaveLength(0);
    expect(fs.existsSync(root)).toBe(false);
  });

  it('uses idempotency on re-run without duplicating records', () => {
    const batch = createZavorthWave4C2FirstRedactedSessionContentMigrationBatchFixture();
    const first = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4C2RedactedContentMigrationFeatureFlag(true),
    });
    const second = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4C2RedactedContentMigrationFeatureFlag(true),
    });

    expect(first.decision).toBe('wave4c2-first-redacted-content-migration-ready');
    expect(second.decision).toBe('wave4c2-first-redacted-content-migration-ready');
    expect(second.idempotencyAvoidedDuplicateWrites).toBe(true);
    expect(second.recordWrites).toHaveLength(7);
    expect(second.recordWrites.every((write) => write.status === 'already-present')).toBe(true);
    expect(listJsonFiles(root).filter((file) => file.includes(`${path.sep}redacted-session-content${path.sep}`))).toHaveLength(7);
    assertNoRawSecretOrContentInRoot(root);
  });

  it('supports rollback and cleanup in the controlled test namespace', () => {
    const batch = createZavorthWave4C2FirstRedactedSessionContentMigrationBatchFixture();
    const receipt = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4C2RedactedContentMigrationFeatureFlag(true),
    });
    const rollback = batch.rollback(root, receipt);
    const cleanup = batch.cleanup(root);

    expect(rollback).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4C2FirstRedactedContentMigrationRollbackReceipt/v1',
      outcome: 'rollback-applied',
      rollbackApplied: true,
      runtimeExternalExecutorRequiredForMigration: false,
      rawSqliteCopyAllowed: false,
      sqliteWriteAllowed: false,
      rawSecretSerialized: false,
    }));
    expect(rollback.removedRelativePaths).toEqual(expect.arrayContaining(['manifest.json']));
    expect(cleanup).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4C2FirstRedactedContentMigrationCleanupReceipt/v1',
      namespaceExistsAfterCleanup: false,
      cleanupLimitedToControlledTestNamespace: true,
      sourceFileCopied: false,
      sourceDbCopied: false,
      rawSecretSerialized: false,
    }));
  });
});
