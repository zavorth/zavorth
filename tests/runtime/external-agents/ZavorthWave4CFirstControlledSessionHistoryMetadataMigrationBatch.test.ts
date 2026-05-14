import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_SCHEMA_VERSION,
  ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE,
  ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE_URI,
  ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_WRITE_FLAG,
  createZavorthWave4CControlledSessionHistoryMigrationPlanFixture,
  createZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatchFixture,
  createZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatchFixtureSource,
  createZavorthWave4CFirstSessionMetadataMigrationFeatureFlag,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4CControlledSessionHistoryMigrationPlanNormalization,
  ZavorthWave4CFirstSessionMetadataMigratedRecord,
  ZavorthWave4CFirstSessionMetadataMigrationManifest,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/219-wave-4c-first-controlled-session-history-metadata-migration-batch.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/218-wave-4c-controlled-session-history-migration-plan.md';
const PRIOR_TEST = 'tests/runtime/external-agents/ZavorthWave4CControlledSessionHistoryMigrationPlan.test.ts';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatch.ts';
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
    'zavorth-wave4c-first-controlled-session-history-metadata-migration-batch-test',
    ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE,
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

function assertNoRawSecret(serialized: string): void {
  expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{8,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{8,}/);
  expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  expect(serialized).not.toContain('<redacted-local-secret>');
  expect(serialized).not.toContain('raw user message body that must never migrate');
}

function assertNoRawSecretInRoot(root: string): void {
  listJsonFiles(root).forEach((file) => assertNoRawSecret(fs.readFileSync(file, 'utf8')));
}

function corruptPlan(): ZavorthWave4CControlledSessionHistoryMigrationPlanNormalization {
  const plan = JSON.parse(JSON.stringify(
    createZavorthWave4CControlledSessionHistoryMigrationPlanFixture().normalization,
  )) as ZavorthWave4CControlledSessionHistoryMigrationPlanNormalization;

  plan.migratableItems[0] = {
    ...plan.migratableItems[0],
    checksum: '0'.repeat(64),
    idempotencyKey: 'invalid-idempotency-key',
    policyDecision: 'block-sensitive-item' as 'allow-session-history-metadata-plan',
    eligibility: 'policy-blocked' as 'eligible-for-first-controlled-metadata-batch',
    schemaVersion: 'zavorth-wave4c-session-history-metadata/v0' as typeof ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_SCHEMA_VERSION,
    redactionEnvelope: {
      ...plan.migratableItems[0].redactionEnvelope,
      rawMessageContentSerialized: true,
    },
  };

  return plan;
}

function unsafeScopePlan(): ZavorthWave4CControlledSessionHistoryMigrationPlanNormalization {
  const plan = JSON.parse(JSON.stringify(
    createZavorthWave4CControlledSessionHistoryMigrationPlanFixture().normalization,
  )) as ZavorthWave4CControlledSessionHistoryMigrationPlanNormalization;

  plan.migratableItems[0] = {
    ...plan.migratableItems[0],
    dataClass: 'raw-message-content' as never,
    checksum: 'sha256:wave4c-raw-message-content',
    idempotencyKey: 'wave4c:session-history-metadata:v1:raw-message-content',
  };
  plan.firstBatch.itemIds[0] = 'raw-message-content' as never;

  return plan;
}

describe('Wave 4C first controlled session/history metadata migration batch', () => {
  const root = migrationRoot();

  beforeEach(() => {
    const batch = createZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatchFixture();
    if (fs.existsSync(root)) {
      batch.cleanup(root);
    }
  });

  afterEach(() => {
    const batch = createZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatchFixture();
    if (fs.existsSync(root)) {
      batch.cleanup(root);
    }
  });

  it('documents 219 as the first controlled Wave 4C session/history metadata migration batch', () => {
    const content = read(DOC);

    expect(content).toContain('Status: wave4c-first-session-metadata-migration-ready');
    expect(content).toContain('ZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatch.ts');
    expect(content).toContain('ZavorthWave4CFirstSessionMetadataMigrationFeatureFlagGate/v1');
    expect(content).toContain('ZavorthWave4CFirstSessionMetadataMigratedRecord/v1');
    expect(content).toContain('ZavorthWave4CFirstSessionMetadataMigrationReceipt/v1');
    expect(content).toContain(ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_WRITE_FLAG);
    expect(content).toContain('wave4cFirstSessionMetadataMigrationBatchCreated=true');
    expect(content).toContain('sessionMetadataMigrationActuallyPerformedOnlyWhenFlagEnabled=true');
    expect(content).toContain('rawMessageContentMigrationAllowed=false');
    expect(content).toContain('Session/history metadata load/verify/parity follow-up:');
    expect(content).toContain('docs/220-wave-4c-session-history-metadata-load-verify-parity.md');
    expect(content).toContain('Do not advance beyond the Wave 4C session/history metadata load/verify/parity gate');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the previous migration plan for 219', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/219-wave-4c-first-controlled-session-history-metadata-migration-batch.md');
    expect(read(PAUSE_DOC)).toContain('`219` is the first controlled Wave 4C session/history metadata migration batch');
    expect(read(PRIOR_DOC)).toContain('First controlled session/history metadata migration batch follow-up:');
    expect(read(PRIOR_DOC)).toContain('docs/219-wave-4c-first-controlled-session-history-metadata-migration-batch.md');
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond the first controlled Wave 4C session/history metadata batch');
    expect(read(PRIOR_TEST)).toContain('docs/219-wave-4c-first-controlled-session-history-metadata-migration-batch.md');
  });

  it('exports the session/history metadata migration batch boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4CFirstSessionMetadataMigrationReceipt/v1');
    expect(boundary).toContain('ZavorthWave4CFirstSessionMetadataMigrationWriteReceipt/v1');
    expect(boundary).toContain('ZavorthWave4CFirstSessionMetadataMigrationRollbackReceipt/v1');
    expect(index).toContain("from './ZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatch.js'");
    expect(index).toContain('ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_WRITE_FLAG');
  });

  it('blocks writes when the feature flag is disabled', () => {
    const batch = createZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatchFixture();
    const receipt = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4CFirstSessionMetadataMigrationFeatureFlag(false),
    });

    expect(receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4CFirstSessionMetadataMigrationReceipt/v1',
      decision: 'migration-write-blocked',
      sessionMetadataMigrationWriteFeatureFlagRequired: true,
      sessionMetadataMigrationActuallyPerformedOnlyWhenFlagEnabled: true,
      sessionHistoryMigrationScopeMetadataOnly: true,
      backupRollbackMetadataCreated: false,
      sourceRuntimeAuthority: false,
      rawSecretSerialized: false,
    }));
    expect(receipt.validations).toContain('feature-flag-disabled');
    expect(receipt.recordWrites).toHaveLength(0);
    expect(fs.existsSync(root)).toBe(false);
  });

  it('writes only the permitted redacted session/history metadata batch when the feature flag is enabled', () => {
    const batch = createZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatchFixture();
    const receipt = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4CFirstSessionMetadataMigrationFeatureFlag(true),
    });
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')) as ZavorthWave4CFirstSessionMetadataMigrationManifest;

    expect(receipt.decision).toBe('wave4c-first-session-metadata-migration-ready');
    expect(receipt.validations).toEqual(['valid']);
    expect(receipt.migrationNamespace).toBe(ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE);
    expect(receipt.migrationNamespaceUri).toBe(ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE_URI);
    expect(receipt.backupRollbackMetadataCreated).toBe(true);
    expect(receipt.recordWrites).toHaveLength(6);
    expect(receipt.recordWrites.every((write) => write.status === 'written')).toBe(true);
    expect(receipt.recordWrites.every((write) => write.atomicWriteUsed && write.sessionMetadataMigrationActuallyPerformed)).toBe(true);
    expect(manifest).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4CFirstSessionMetadataMigrationManifest/v1',
      migrationNamespace: ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE,
      schemaVersion: ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_SCHEMA_VERSION,
      batchId: 'wave4c-session-history-metadata-batch-001',
      recordCount: 6,
      backupRollbackMetadataCreated: true,
      runtimeExternalExecutorRequiredForMigration: false,
      rawSecretSerialized: false,
    }));
    expect(fs.existsSync(path.join(root, 'rollback', 'backup-rollback-manifest.json'))).toBe(true);
    assertNoRawSecretInRoot(root);
  });

  it('validates schema, redaction, checksum, idempotency, policy, scope, and backup/rollback in written records', () => {
    const batch = createZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatchFixture();
    const receipt = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4CFirstSessionMetadataMigrationFeatureFlag(true),
    });

    receipt.recordWrites.forEach((write) => {
      const persisted = JSON.parse(fs.readFileSync(path.join(root, write.relativePath), 'utf8')) as ZavorthWave4CFirstSessionMetadataMigratedRecord;

      expect(persisted).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthWave4CFirstSessionMetadataMigratedRecord/v1',
        migrationNamespace: ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE,
        schemaVersion: ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_SCHEMA_VERSION,
        idempotencyKey: write.idempotencyKey,
        checksum: write.checksum,
        checksumAlgorithm: 'sha256-stable-session-history-metadata',
        policyDecision: 'allow-session-history-metadata-plan',
        payloadKind: 'session-history-metadata-only',
        payloadSensitiveFieldsPersisted: false,
        runtimeExternalExecutorRequiredForMigration: false,
        sourceRuntimeAuthority: false,
        rawMessageContentMigrationAllowed: false,
        rawSqliteCopyAllowed: false,
        sqliteWriteAllowed: false,
        attachmentsMigrationAllowed: false,
        rawSecretMigrationAllowed: false,
        rawSecretSerialized: false,
      }));
      expect(persisted.idempotencyKey).toBe(`wave4c:session-history-metadata:v1:${persisted.dataClass}`);
      expect(persisted.redactionEnvelope.rawMessageContentSerialized).toBe(false);
      expect(persisted.redactionEnvelope.rawSecretSerialized).toBe(false);
      expect(persisted.redactionEnvelope.rawSqlitePayloadSerialized).toBe(false);
      expect(persisted.redactionEnvelope.forbiddenFields).toEqual(expect.arrayContaining([
        'rawMessageContent',
        'rawSecretValue',
        'sqlitePayload',
        'attachmentBody',
        'workspaceFileBody',
        'rawLogLine',
        'rawCacheEntry',
      ]));
      expect(persisted.backupRollback).toEqual({
        backupManifestRequired: true,
        restoreManifestRequired: true,
        rollbackReceiptRequired: true,
        sourceDbBackupCreatedBy218: false,
        sourceDbRestoreAuthorizedBy218: false,
      });
    });
  });

  it('blocks invalid schema/checksum/idempotency/redaction/policy before writing', () => {
    const batch = createZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatchFixture(
      createZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatchFixtureSource({
        migrationPlan: corruptPlan(),
      }),
    );
    const receipt = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4CFirstSessionMetadataMigrationFeatureFlag(true),
    });

    expect(receipt.decision).toBe('blocked');
    expect(receipt.validations).toEqual(expect.arrayContaining([
      'schema-invalid',
      'checksum-invalid',
      'idempotency-invalid',
      'policy-blocked',
      'redaction-invalid',
    ]));
    expect(receipt.recordWrites).toHaveLength(0);
    expect(fs.existsSync(root)).toBe(false);
  });

  it('blocks out-of-scope raw classes before writing', () => {
    const batch = createZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatchFixture(
      createZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatchFixtureSource({
        migrationPlan: unsafeScopePlan(),
      }),
    );
    const receipt = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4CFirstSessionMetadataMigrationFeatureFlag(true),
    });

    expect(receipt.decision).toBe('blocked');
    expect(receipt.validations).toEqual(expect.arrayContaining(['scope-invalid', 'checksum-invalid']));
    expect(receipt.recordWrites).toHaveLength(0);
    expect(fs.existsSync(root)).toBe(false);
  });

  it('uses idempotency on re-run without duplicating records', () => {
    const batch = createZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatchFixture();
    const first = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4CFirstSessionMetadataMigrationFeatureFlag(true),
    });
    const second = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4CFirstSessionMetadataMigrationFeatureFlag(true),
    });

    expect(first.decision).toBe('wave4c-first-session-metadata-migration-ready');
    expect(first.recordWrites.every((write) => write.status === 'written')).toBe(true);
    expect(second.decision).toBe('wave4c-first-session-metadata-migration-ready');
    expect(second.idempotencyAvoidedDuplicateWrites).toBe(true);
    expect(second.recordWrites.every((write) => write.status === 'already-present')).toBe(true);
    expect(listJsonFiles(root).filter((file) => file.includes(`${path.sep}session-history-metadata${path.sep}`)).length).toBe(6);
  });

  it('supports rollback and cleanup in the controlled test namespace', () => {
    const batch = createZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatchFixture();
    const receipt = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4CFirstSessionMetadataMigrationFeatureFlag(true),
    });
    expect(fs.existsSync(receipt.manifestPath)).toBe(true);

    const rollback = batch.rollback(root, receipt);

    expect(rollback).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4CFirstSessionMetadataMigrationRollbackReceipt/v1',
      outcome: 'rollback-applied',
      rollbackApplied: true,
      runtimeExternalExecutorRequiredForMigration: false,
      rawSqliteCopyAllowed: false,
      sqliteWriteAllowed: false,
      rawSecretSerialized: false,
    }));
    expect(rollback.removedRelativePaths).toEqual(expect.arrayContaining([
      'manifest.json',
      path.join('rollback', 'backup-rollback-manifest.json'),
    ]));
    expect(fs.existsSync(receipt.manifestPath)).toBe(false);

    const cleanup = batch.cleanup(root);
    expect(cleanup).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4CFirstSessionMetadataMigrationCleanupReceipt/v1',
      cleanupActuallyPerformed: true,
      namespaceExistsAfterCleanup: false,
      cleanupLimitedToControlledTestNamespace: true,
      sourceFileCopied: false,
      sourceDbCopied: false,
      rawSecretSerialized: false,
    }));
  });

  it('keeps high-risk migration and execution attempts blocked', () => {
    const batch = createZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatchFixture(
      createZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatchFixtureSource({
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
      }),
    );
    const receipt = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4CFirstSessionMetadataMigrationFeatureFlag(true),
    });

    expect(receipt.decision).toBe('blocked');
    expect(receipt.validations).toContain('source-not-ready');
    expect(receipt.rawMessageContentMigrationAllowed).toBe(false);
    expect(receipt.rawSqliteCopyAllowed).toBe(false);
    expect(receipt.sqliteWriteAllowed).toBe(false);
    expect(receipt.messageActuallySent).toBe(false);
    expect(receipt.providerActuallyExecuted).toBe(false);
    expect(receipt.commandActuallyExecuted).toBe(false);
    expect(receipt.toolActuallyExecuted).toBe(false);
    expect(receipt.recordWrites).toHaveLength(0);
  });

  it('keeps required safety guarantees false and does not serialize raw content or secrets', () => {
    const batch = createZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatchFixture();
    const receipt = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4CFirstSessionMetadataMigrationFeatureFlag(true),
    });
    const serialized = JSON.stringify(receipt);

    expect(receipt).toEqual(expect.objectContaining({
      wave4cFirstSessionMetadataMigrationBatchCreated: true,
      sessionMetadataMigrationWriteFeatureFlagRequired: true,
      sessionMetadataMigrationActuallyPerformedOnlyWhenFlagEnabled: true,
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
    }));
    assertNoRawSecret(serialized);
    assertNoRawSecretInRoot(root);
  });
});
