import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_SCHEMA_VERSION,
  ZAVORTH_WAVE4C_SESSION_METADATA_MIGRATION_NAMESPACE,
  createZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatchFixture,
  createZavorthWave4CFirstSessionMetadataMigrationFeatureFlag,
  createZavorthWave4CSessionHistoryMetadataLoadVerifyParityFixture,
  createZavorthWave4CSessionHistoryMetadataLoadVerifyParityFixtureSource,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4CFirstSessionMetadataMigratedRecord,
  ZavorthWave4CFirstSessionMetadataMigrationManifest,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/220-wave-4c-session-history-metadata-load-verify-parity.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/219-wave-4c-first-controlled-session-history-metadata-migration-batch.md';
const PRIOR_TEST = 'tests/runtime/external-agents/ZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatch.test.ts';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4CSessionHistoryMetadataLoadVerifyParity.ts';
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
    'zavorth-wave4c-session-history-metadata-load-verify-parity-test',
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

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function seedMigratedBatch(root: string): void {
  const batch = createZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatchFixture();
  batch.migrate({
    migrationRoot: root,
    featureFlag: createZavorthWave4CFirstSessionMetadataMigrationFeatureFlag(true),
  });
}

function firstRecordPath(root: string): string {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')) as ZavorthWave4CFirstSessionMetadataMigrationManifest;
  return path.join(root, manifest.records[0].relativePath);
}

describe('Wave 4C session/history metadata load/verify parity', () => {
  const root = migrationRoot();

  beforeEach(() => {
    const loader = createZavorthWave4CSessionHistoryMetadataLoadVerifyParityFixture();
    if (fs.existsSync(root)) {
      loader.cleanup(root);
    }
  });

  afterEach(() => {
    const loader = createZavorthWave4CSessionHistoryMetadataLoadVerifyParityFixture();
    if (fs.existsSync(root)) {
      loader.cleanup(root);
    }
  });

  it('documents 220 as the Wave 4C session/history metadata load/verify/parity gate', () => {
    const content = read(DOC);

    expect(content).toContain('Status: wave4c-session-history-metadata-load-verify-parity-ready');
    expect(content).toContain('ZavorthWave4CSessionHistoryMetadataLoadVerifyParity.ts');
    expect(content).toContain('ZavorthWave4CSessionHistoryMetadataParityReceipt/v1');
    expect(content).toContain('ZavorthWave4CSessionHistoryMigratedNativeView/v1');
    expect(content).toContain('ZavorthWave4CSessionHistoryMetadataConsumerProjection/v1');
    expect(content).toContain('wave4cSessionHistoryMetadataLoadVerifyCreated=true');
    expect(content).toContain('migratedSessionMetadataLoadedFromZavorthStorage=true');
    expect(content).toContain('runtimeExternalExecutorRequiredForMigratedSessionMetadataLoad=false');
    expect(content).toContain('Wave 4C session/history metadata migration milestone follow-up:');
    expect(content).toContain('docs/221-wave-4c-session-history-metadata-migration-milestone-report.md');
    expect(content).toContain('Do not advance beyond the Wave 4C session/history metadata migration milestone');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the previous migration batch for 220', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/220-wave-4c-session-history-metadata-load-verify-parity.md');
    expect(read(PAUSE_DOC)).toContain('`220` is the Wave 4C session/history metadata load/verify/parity gate');
    expect(read(PRIOR_DOC)).toContain('Session/history metadata load/verify/parity follow-up:');
    expect(read(PRIOR_DOC)).toContain('docs/220-wave-4c-session-history-metadata-load-verify-parity.md');
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond the Wave 4C session/history metadata load/verify/parity gate');
    expect(read(PRIOR_TEST)).toContain('docs/220-wave-4c-session-history-metadata-load-verify-parity.md');
  });

  it('exports the load/verify/parity boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4CSessionHistoryMetadataParityReceipt/v1');
    expect(boundary).toContain('ZavorthWave4CSessionHistoryMigratedNativeView/v1');
    expect(boundary).toContain('ZavorthWave4CSessionHistoryMetadataLoadVerifyCleanupReceipt/v1');
    expect(index).toContain("from './ZavorthWave4CSessionHistoryMetadataLoadVerifyParity.js'");
    expect(index).toContain('ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_LOAD_VERIFY_PARITY_RUNTIME_ID');
  });

  it('loads the migrated session/history metadata batch from Zavorth-owned storage and classifies parity-ok', () => {
    seedMigratedBatch(root);
    const loader = createZavorthWave4CSessionHistoryMetadataLoadVerifyParityFixture();
    const receipt = loader.loadVerify({ migrationRoot: root });

    expect(receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4CSessionHistoryMetadataParityReceipt/v1',
      classification: 'parity-ok',
      validations: ['valid'],
      manifestRecordCount: 6,
      loadedRecordCount: 6,
      wave4cSessionHistoryMetadataLoadVerifyCreated: true,
      migratedSessionMetadataLoadedFromZavorthStorage: true,
      runtimeExternalExecutorRequiredForMigratedSessionMetadataLoad: false,
      runtimeExternalExecutorRequiredForMigratedSessionMetadataRender: false,
      rawSecretSerialized: false,
    }));
    expect(receipt.nativeViews).toHaveLength(6);
    expect(receipt.nativeViews.map((view) => view.viewKind)).toEqual(expect.arrayContaining([
      'channel-transport-linkage',
      'message-metadata',
      'participant-metadata',
      'session',
      'thread',
      'timestamps-status',
    ]));
    assertNoRawSecretInRoot(root);
  });

  it('reconstructs native views consumed by Command Center, planner, policy, and observability', () => {
    seedMigratedBatch(root);
    const receipt = createZavorthWave4CSessionHistoryMetadataLoadVerifyParityFixture().loadVerify({ migrationRoot: root });

    expect(receipt.consumerProjections).toHaveLength(4);
    expect(receipt.consumerProjections.map((projection) => projection.consumerId)).toEqual([
      'command-center',
      'controlled-dry-run-planner',
      'command-http-policy-preflight',
      'command-http-observability-projection',
    ]);
    receipt.consumerProjections.forEach((projection) => {
      expect(projection.consumesMigratedSessionMetadata).toBe(true);
      expect(projection.nativeViewIds).toHaveLength(6);
      expect(projection.runtimeExternalExecutorRequiredForLookup).toBe(false);
      expect(projection.runtimeExternalExecutorRequiredForRender).toBe(false);
      expect(projection.adapterDefaultPath).toBe(false);
      expect(projection.publicExternalExecutorIdentityLeak).toBe(false);
    });
    expect(receipt.baselineComparison).toEqual(expect.objectContaining({
      nativeRegistrySessionCount: 3,
      nativeRegistryThreadCount: 3,
      nativeRegistryMessageCount: 3,
      readOnlyBridgeSessionViewCount: 3,
      readOnlyBridgeCommandCenterViewCount: 3,
      commandCenterSessionViewCount: 3,
      commandCenterMessageMetadataViewCount: 3,
      migratedNativeViewCount: 6,
      commandCenterParity: 'parity-ok',
      plannerPolicyObservabilityParity: 'parity-ok',
    }));
  });

  it('classifies checksum/schema/idempotency failures as corrupt', () => {
    seedMigratedBatch(root);
    const recordPath = firstRecordPath(root);
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as ZavorthWave4CFirstSessionMetadataMigratedRecord;
    writeJson(recordPath, {
      ...record,
      checksum: '0'.repeat(64),
      idempotencyKey: 'invalid-idempotency',
      schemaVersion: 'zavorth-wave4c-session-history-metadata/v0',
    });

    const receipt = createZavorthWave4CSessionHistoryMetadataLoadVerifyParityFixture().loadVerify({ migrationRoot: root });

    expect(receipt.classification).toBe('corrupt');
    expect(receipt.validations).toEqual(expect.arrayContaining([
      'checksum-invalid',
      'idempotency-invalid',
      'schema-invalid',
    ]));
  });

  it('classifies invalid redaction, policy, or scope as rejected', () => {
    seedMigratedBatch(root);
    const recordPath = firstRecordPath(root);
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as ZavorthWave4CFirstSessionMetadataMigratedRecord;
    writeJson(recordPath, {
      ...record,
      dataClass: 'raw-message-content',
      redactionEnvelope: {
        ...record.redactionEnvelope,
        rawMessageContentSerialized: true,
      },
      policyDecision: 'block-sensitive-item',
    });

    const receipt = createZavorthWave4CSessionHistoryMetadataLoadVerifyParityFixture().loadVerify({ migrationRoot: root });

    expect(receipt.classification).toBe('rejected');
    expect(receipt.validations).toEqual(expect.arrayContaining([
      'redaction-invalid',
      'policy-invalid',
      'scope-invalid',
    ]));
  });

  it('classifies missing migrated records as parity-partial', () => {
    seedMigratedBatch(root);
    fs.rmSync(firstRecordPath(root));

    const receipt = createZavorthWave4CSessionHistoryMetadataLoadVerifyParityFixture().loadVerify({ migrationRoot: root });

    expect(receipt.classification).toBe('parity-partial');
    expect(receipt.validations).toContain('record-missing');
    expect(receipt.loadedRecordCount).toBe(5);
    expect(receipt.nativeViews).toHaveLength(5);
  });

  it('classifies missing manifest, rollback manifest, or source readiness failures as degraded', () => {
    seedMigratedBatch(root);
    fs.rmSync(path.join(root, 'rollback', 'backup-rollback-manifest.json'));

    const receipt = createZavorthWave4CSessionHistoryMetadataLoadVerifyParityFixture(
      createZavorthWave4CSessionHistoryMetadataLoadVerifyParityFixtureSource({
        commandCenterNativeFirstReady: false,
      }),
    ).loadVerify({ migrationRoot: root });

    expect(receipt.classification).toBe('degraded');
    expect(receipt.validations).toEqual(expect.arrayContaining(['backup-rollback-missing', 'source-not-ready']));
  });

  it('keeps raw migration, external execution, ExternalExecutor live, source copy, and adapter removal blocked', () => {
    seedMigratedBatch(root);
    const receipt = createZavorthWave4CSessionHistoryMetadataLoadVerifyParityFixture().loadVerify({ migrationRoot: root });
    const serialized = JSON.stringify(receipt);

    expect(receipt).toEqual(expect.objectContaining({
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
  });

  it('supports rollback with 219 and cleanup in the controlled test namespace', () => {
    const batch = createZavorthWave4CFirstControlledSessionHistoryMetadataMigrationBatchFixture();
    const receipt = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4CFirstSessionMetadataMigrationFeatureFlag(true),
    });
    const loader = createZavorthWave4CSessionHistoryMetadataLoadVerifyParityFixture();

    expect(loader.loadVerify({ migrationRoot: root }).classification).toBe('parity-ok');

    const rollback = batch.rollback(root, receipt);
    expect(rollback.rollbackApplied).toBe(true);
    expect(rollback.removedRelativePaths).toEqual(expect.arrayContaining([
      'manifest.json',
      path.join('rollback', 'backup-rollback-manifest.json'),
    ]));

    const cleanup = loader.cleanup(root);
    expect(cleanup).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4CSessionHistoryMetadataLoadVerifyCleanupReceipt/v1',
      cleanupActuallyPerformed: true,
      namespaceExistsAfterCleanup: false,
      cleanupLimitedToControlledTestNamespace: true,
      sourceFileCopied: false,
      sourceDbCopied: false,
      rawSecretSerialized: false,
    }));
  });

  it('does not require ExternalExecutor live and rejects unsafe source readiness', () => {
    seedMigratedBatch(root);
    const receipt = createZavorthWave4CSessionHistoryMetadataLoadVerifyParityFixture(
      createZavorthWave4CSessionHistoryMetadataLoadVerifyParityFixtureSource({
        externalExecutorLiveRequiredForLoad: true,
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
    ).loadVerify({ migrationRoot: root });

    expect(receipt.classification).toBe('degraded');
    expect(receipt.validations).toContain('source-not-ready');
    expect(receipt.runtimeExternalExecutorRequiredForMigratedSessionMetadataLoad).toBe(false);
    expect(receipt.messageActuallySent).toBe(false);
    expect(receipt.providerActuallyExecuted).toBe(false);
    expect(receipt.commandActuallyExecuted).toBe(false);
    expect(receipt.toolActuallyExecuted).toBe(false);
  });

  it('does not serialize raw content or secrets from storage or receipts', () => {
    seedMigratedBatch(root);
    const receipt = createZavorthWave4CSessionHistoryMetadataLoadVerifyParityFixture().loadVerify({ migrationRoot: root });

    assertNoRawSecret(JSON.stringify(receipt));
    assertNoRawSecretInRoot(root);
    expect(receipt.nativeViews.every((view) => view.rawMessageContentMigrationAllowed === false)).toBe(true);
    expect(receipt.nativeViews.every((view) => view.rawSecretSerialized === false)).toBe(true);
    expect(receipt.nativeViews.every((view) => view.status === 'available')).toBe(true);
    expect(receipt.nativeViews.every((view) => view.commandCenterConsumable && view.plannerConsumable)).toBe(true);
    expect(receipt.nativeViews.every((view) => view.policyConsumable && view.observabilityConsumable)).toBe(true);
  });

  it('validates the schema version used by the migrated session metadata batch', () => {
    seedMigratedBatch(root);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')) as ZavorthWave4CFirstSessionMetadataMigrationManifest;

    expect(manifest.schemaVersion).toBe(ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_SCHEMA_VERSION);
    expect(manifest.records.every((record) => record.idempotencyKey.startsWith('wave4c:session-history-metadata:v1:'))).toBe(true);
    expect(manifest.records.every((record) => record.relativePath.startsWith('session-history-metadata'))).toBe(true);
  });
});
