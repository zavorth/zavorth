import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE,
  ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE_URI,
  ZAVORTH_WAVE4C2_SESSION_CONTENT_METADATA_SCHEMA_VERSION,
  createZavorthWave4C2FirstRedactedSessionContentMigrationBatchFixture,
  createZavorthWave4C2RedactedContentMigrationFeatureFlag,
  createZavorthWave4C2RedactedSessionContentLoadVerifyParityFixture,
  createZavorthWave4C2RedactedSessionContentLoadVerifyParityFixtureSource,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4C2FirstRedactedContentMigratedRecord,
  ZavorthWave4C2FirstRedactedContentMigrationManifest,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/228-wave-4c2-redacted-session-content-load-verify-parity.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/227-wave-4c2-first-redacted-session-content-migration-batch.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4C2RedactedSessionContentLoadVerifyParity.ts';
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
    'zavorth-wave4c2-redacted-session-content-load-verify-parity-test',
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

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function seedRedactedBatch(root: string): void {
  const batch = createZavorthWave4C2FirstRedactedSessionContentMigrationBatchFixture();
  batch.migrate({
    migrationRoot: root,
    featureFlag: createZavorthWave4C2RedactedContentMigrationFeatureFlag(true),
  });
}

function firstRecordPath(root: string): string {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')) as ZavorthWave4C2FirstRedactedContentMigrationManifest;
  return path.join(root, manifest.records[0].relativePath);
}

describe('Wave 4C.2 redacted session content load/verify/parity', () => {
  const root = migrationRoot();

  beforeEach(() => {
    const loader = createZavorthWave4C2RedactedSessionContentLoadVerifyParityFixture();
    if (fs.existsSync(root)) {
      loader.cleanup(root);
    }
  });

  afterEach(() => {
    const loader = createZavorthWave4C2RedactedSessionContentLoadVerifyParityFixture();
    if (fs.existsSync(root)) {
      loader.cleanup(root);
    }
  });

  it('documents 228 as the Wave 4C.2 redacted session content load/verify/parity gate', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `wave4c2-redacted-session-content-load-verify-parity-ready`');
    expect(content).toContain('ZavorthWave4C2RedactedSessionContentLoadVerifyParity.ts');
    expect(content).toContain('ZavorthWave4C2RedactedContentParityReceipt/v1');
    expect(content).toContain('ZavorthWave4C2RedactedContentNativeView/v1');
    expect(content).toContain('ZavorthWave4C2RedactedContentConsumerProjection/v1');
    expect(content).toContain('wave4c2RedactedContentLoadVerifyCreated=true');
    expect(content).toContain('redactedContentLoadedFromZavorthStorage=true');
    expect(content).toContain('runtimeExternalExecutorRequiredForRedactedContentLoad=false');
    expect(content).toContain('Wave 4C.2 redacted session content migration milestone follow-up:');
    expect(content).toContain('docs/229-wave-4c2-redacted-session-content-migration-milestone-report.md');
    expect(content).toContain('Do not advance beyond `229`');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the previous migration batch for 228', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/228-wave-4c2-redacted-session-content-load-verify-parity.md');
    expect(read(PAUSE_DOC)).toContain('`228` loads and verifies the Wave 4C.2 redacted session content batch');
    expect(read(PRIOR_DOC)).toContain('Redacted session content load/verify/parity follow-up:');
    expect(read(PRIOR_DOC)).toContain('docs/228-wave-4c2-redacted-session-content-load-verify-parity.md');
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond `228`');
  });

  it('exports the redacted content load/verify/parity boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4C2RedactedContentParityReceipt/v1');
    expect(boundary).toContain('ZavorthWave4C2RedactedContentNativeView/v1');
    expect(boundary).toContain('ZavorthWave4C2RedactedContentLoadVerifyCleanupReceipt/v1');
    expect(index).toContain("from './ZavorthWave4C2RedactedSessionContentLoadVerifyParity.js'");
    expect(index).toContain('ZAVORTH_WAVE4C2_REDACTED_SESSION_CONTENT_LOAD_VERIFY_PARITY_RUNTIME_ID');
  });

  it('loads the redacted/derived content batch from Zavorth-owned storage and classifies parity-ok', () => {
    seedRedactedBatch(root);
    const loader = createZavorthWave4C2RedactedSessionContentLoadVerifyParityFixture();
    const receipt = loader.loadVerify({ migrationRoot: root });

    expect(receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4C2RedactedContentParityReceipt/v1',
      classification: 'parity-ok',
      validations: ['valid'],
      manifestRecordCount: 7,
      loadedRecordCount: 7,
      wave4c2RedactedContentLoadVerifyCreated: true,
      redactedContentLoadedFromZavorthStorage: true,
      runtimeExternalExecutorRequiredForRedactedContentLoad: false,
      runtimeExternalExecutorRequiredForRedactedContentRender: false,
      rawSecretSerialized: false,
    }));
    expect(receipt.migrationNamespace).toBe(ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE);
    expect(receipt.migrationNamespaceUri).toBe(ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_NAMESPACE_URI);
    expect(receipt.nativeViews).toHaveLength(7);
    expect(receipt.nativeViews.map((view) => view.viewKind)).toEqual(expect.arrayContaining([
      'content-hash',
      'content-length-count-metadata',
      'participant-channel-thread-linkage',
      'redacted-excerpt',
      'session-content-presence',
      'timestamps-status',
    ]));
    assertNoRawSecretOrContent(JSON.stringify(receipt));
    assertNoRawSecretOrContentInRoot(root);
  });

  it('reconstructs native redacted content views consumed by Command Center, planner, policy, and observability', () => {
    seedRedactedBatch(root);
    const receipt = createZavorthWave4C2RedactedSessionContentLoadVerifyParityFixture().loadVerify({ migrationRoot: root });

    expect(receipt.consumerProjections).toHaveLength(4);
    expect(receipt.consumerProjections.map((projection) => projection.consumerId)).toEqual([
      'command-center',
      'controlled-dry-run-planner',
      'command-http-policy-preflight',
      'command-http-observability-projection',
    ]);
    receipt.consumerProjections.forEach((projection) => {
      expect(projection.consumesRedactedSessionContent).toBe(true);
      expect(projection.nativeViewIds).toHaveLength(7);
      expect(projection.runtimeExternalExecutorRequiredForLookup).toBe(false);
      expect(projection.runtimeExternalExecutorRequiredForRender).toBe(false);
      expect(projection.adapterDefaultPath).toBe(false);
      expect(projection.publicExternalExecutorIdentityLeak).toBe(false);
      expect(projection.rawMessageContentSerialized).toBe(false);
    });
    receipt.nativeViews.forEach((view) => {
      expect(view.commandCenterConsumable).toBe(true);
      expect(view.plannerConsumable).toBe(true);
      expect(view.policyConsumable).toBe(true);
      expect(view.observabilityConsumable).toBe(true);
      expect(view.payload.contentRawStored).toBe(false);
      expect(view.rawMessageContentSerialized).toBe(false);
    });
    expect(receipt.baselineComparison).toEqual(expect.objectContaining({
      migratedSessionMetadataBaselineReady: true,
      nativeRegistrySessionCount: 3,
      nativeRegistryThreadCount: 3,
      nativeRegistryMessageCount: 3,
      readOnlyBridgeSessionViewCount: 3,
      readOnlyBridgeCommandCenterViewCount: 3,
      commandCenterSessionViewCount: 3,
      commandCenterMessageMetadataViewCount: 3,
      redactedContentNativeViewCount: 7,
      commandCenterParity: 'parity-ok',
      plannerPolicyObservabilityParity: 'parity-ok',
    }));
  });

  it('classifies checksum/schema/idempotency failures as corrupt', () => {
    seedRedactedBatch(root);
    const recordPath = firstRecordPath(root);
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as ZavorthWave4C2FirstRedactedContentMigratedRecord;
    writeJson(recordPath, {
      ...record,
      checksum: '0'.repeat(64),
      idempotencyKey: 'invalid-idempotency',
      schemaVersion: 'zavorth-wave4c2-session-content-metadata/v0',
    });

    const receipt = createZavorthWave4C2RedactedSessionContentLoadVerifyParityFixture().loadVerify({ migrationRoot: root });

    expect(receipt.classification).toBe('corrupt');
    expect(receipt.validations).toEqual(expect.arrayContaining([
      'checksum-invalid',
      'idempotency-invalid',
      'schema-invalid',
    ]));
  });

  it('classifies invalid redaction, content policy, policy decision, or scope as rejected', () => {
    seedRedactedBatch(root);
    const recordPath = firstRecordPath(root);
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as ZavorthWave4C2FirstRedactedContentMigratedRecord;
    writeJson(recordPath, {
      ...record,
      itemId: 'raw-message-content',
      redactionEnvelope: {
        ...record.redactionEnvelope,
        rawMessageContentSerialized: true,
      },
      payload: {
        ...record.payload,
        rawMessageContentSerialized: true,
        contentRawStored: true,
      },
      policyDecision: 'block-sensitive-item',
      contentPolicyDecision: 'blocked',
    });

    const receipt = createZavorthWave4C2RedactedSessionContentLoadVerifyParityFixture().loadVerify({ migrationRoot: root });

    expect(receipt.classification).toBe('rejected');
    expect(receipt.validations).toEqual(expect.arrayContaining([
      'redaction-invalid',
      'policy-invalid',
      'scope-invalid',
    ]));
  });

  it('classifies missing redacted content records as parity-partial', () => {
    seedRedactedBatch(root);
    fs.rmSync(firstRecordPath(root));

    const receipt = createZavorthWave4C2RedactedSessionContentLoadVerifyParityFixture().loadVerify({ migrationRoot: root });

    expect(receipt.classification).toBe('parity-partial');
    expect(receipt.validations).toContain('record-missing');
    expect(receipt.loadedRecordCount).toBe(6);
    expect(receipt.nativeViews).toHaveLength(6);
  });

  it('classifies missing manifest, rollback manifest, or source readiness failures as degraded', () => {
    seedRedactedBatch(root);
    fs.rmSync(path.join(root, 'rollback', 'backup-rollback-manifest.json'));

    const receipt = createZavorthWave4C2RedactedSessionContentLoadVerifyParityFixture(
      createZavorthWave4C2RedactedSessionContentLoadVerifyParityFixtureSource({
        commandCenterNativeFirstReady: false,
      }),
    ).loadVerify({ migrationRoot: root });

    expect(receipt.classification).toBe('degraded');
    expect(receipt.validations).toEqual(expect.arrayContaining(['backup-rollback-missing', 'source-not-ready']));
  });

  it('keeps raw content, external execution, ExternalExecutor live, source copy, and adapter removal blocked', () => {
    seedRedactedBatch(root);
    const receipt = createZavorthWave4C2RedactedSessionContentLoadVerifyParityFixture().loadVerify({ migrationRoot: root });
    const serialized = JSON.stringify(receipt);

    expect(receipt).toEqual(expect.objectContaining({
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
    assertNoRawSecretOrContent(serialized);
  });

  it('supports rollback with 227 and cleanup in the controlled test namespace', () => {
    const batch = createZavorthWave4C2FirstRedactedSessionContentMigrationBatchFixture();
    const receipt = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4C2RedactedContentMigrationFeatureFlag(true),
    });
    const loader = createZavorthWave4C2RedactedSessionContentLoadVerifyParityFixture();

    expect(loader.loadVerify({ migrationRoot: root }).classification).toBe('parity-ok');

    const rollback = batch.rollback(root, receipt);
    expect(rollback.rollbackApplied).toBe(true);
    expect(rollback.removedRelativePaths).toEqual(expect.arrayContaining([
      'manifest.json',
      path.join('rollback', 'backup-rollback-manifest.json'),
    ]));

    const cleanup = loader.cleanup(root);
    expect(cleanup).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4C2RedactedContentLoadVerifyCleanupReceipt/v1',
      cleanupActuallyPerformed: true,
      namespaceExistsAfterCleanup: false,
      cleanupLimitedToControlledTestNamespace: true,
      sourceFileCopied: false,
      sourceDbCopied: false,
      rawSecretSerialized: false,
    }));
  });

  it('does not require ExternalExecutor live and rejects unsafe source readiness', () => {
    seedRedactedBatch(root);
    const receipt = createZavorthWave4C2RedactedSessionContentLoadVerifyParityFixture(
      createZavorthWave4C2RedactedSessionContentLoadVerifyParityFixtureSource({
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
    expect(receipt.runtimeExternalExecutorRequiredForRedactedContentLoad).toBe(false);
    expect(receipt.runtimeExternalExecutorRequiredForRedactedContentRender).toBe(false);
    expect(receipt.messageActuallySent).toBe(false);
    expect(receipt.providerActuallyExecuted).toBe(false);
    expect(receipt.commandActuallyExecuted).toBe(false);
    expect(receipt.toolActuallyExecuted).toBe(false);
  });
});
