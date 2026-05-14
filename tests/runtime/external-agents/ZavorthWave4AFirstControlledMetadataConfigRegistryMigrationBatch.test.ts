import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE,
  ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE_URI,
  ZAVORTH_WAVE4A_METADATA_MIGRATION_SCHEMA_VERSION,
  ZAVORTH_WAVE4A_METADATA_MIGRATION_WRITE_FLAG,
  createZavorthWave4AControlledMetadataConfigRegistryMigrationPlanFixture,
  createZavorthWave4AFirstBatchMigrationFeatureFlag,
  createZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatchFixture,
  createZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatchFixtureSource,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4AControlledMigrationNormalization,
  ZavorthWave4AFirstBatchMigratedRecord,
  ZavorthWave4AFirstBatchMigrationManifest,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/210-wave-4a-first-controlled-metadata-config-registry-migration-batch.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/209-wave-4a-controlled-metadata-config-registry-migration-plan.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatch.ts';
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
    'zavorth-wave4a-first-controlled-metadata-config-registry-migration-batch-test',
    ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE,
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

function assertNoRawSecret(root: string): void {
  listJsonFiles(root).forEach((file) => {
    const content = fs.readFileSync(file, 'utf8');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
    expect(content).not.toMatch(/ghp_[A-Za-z0-9_]{8,}/);
    expect(content).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{8,}/);
    expect(content).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  });
}

function corruptPlan(): ZavorthWave4AControlledMigrationNormalization {
  const plan = JSON.parse(JSON.stringify(
    createZavorthWave4AControlledMetadataConfigRegistryMigrationPlanFixture().normalization,
  )) as ZavorthWave4AControlledMigrationNormalization;

  plan.planItems[0] = {
    ...plan.planItems[0],
    checksum: '0'.repeat(64),
    idempotencyKey: 'invalid-idempotency-key',
    policyDecision: 'block-sensitive-item',
    eligibility: 'policy-blocked',
    schemaVersion: 'zavorth-wave4a-metadata-config-registry-migration/v0' as typeof ZAVORTH_WAVE4A_METADATA_MIGRATION_SCHEMA_VERSION,
  };

  return plan;
}

function unsafeScopePlan(): ZavorthWave4AControlledMigrationNormalization {
  const plan = JSON.parse(JSON.stringify(
    createZavorthWave4AControlledMetadataConfigRegistryMigrationPlanFixture().normalization,
  )) as ZavorthWave4AControlledMigrationNormalization;

  plan.planItems[0] = {
    ...plan.planItems[0],
    dataClass: 'raw-secrets',
    target: 'blocked-no-target',
  };

  return plan;
}

describe('Wave 4A first controlled metadata/config/registry migration batch', () => {
  const root = migrationRoot();

  beforeEach(() => {
    const batch = createZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatchFixture();
    if (fs.existsSync(root)) {
      batch.cleanup(root);
    }
  });

  afterEach(() => {
    const batch = createZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatchFixture();
    if (fs.existsSync(root)) {
      batch.cleanup(root);
    }
  });

  it('documents 210 as the first controlled Wave 4A migration batch', () => {
    const content = read(DOC);

    expect(content).toContain('Status: wave4a-first-batch-migration-ready');
    expect(content).toContain('ZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatch.ts');
    expect(content).toContain('ZavorthWave4AFirstBatchMigrationFeatureFlagGate/v1');
    expect(content).toContain('ZavorthWave4AFirstBatchMigratedRecord/v1');
    expect(content).toContain('ZavorthWave4AFirstBatchMigrationReceipt/v1');
    expect(content).toContain(ZAVORTH_WAVE4A_METADATA_MIGRATION_WRITE_FLAG);
    expect(content).toContain('wave4aFirstBatchMigrationCreated=true');
    expect(content).toContain('metadataConfigRegistryMigrationActuallyPerformedOnlyWhenFlagEnabled=true');
    expect(content).toContain('cacheRawMigrationAllowed=false');
    expect(content).toContain('Migrated metadata batch load/verify/parity follow-up:');
    expect(content).toContain('docs/211-wave-4a-migrated-metadata-batch-load-verify-parity.md');
    expect(content).toContain('Do not advance beyond the migrated metadata batch load/verify/parity gate');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the previous migration plan for 210', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/210-wave-4a-first-controlled-metadata-config-registry-migration-batch.md');
    expect(read(PAUSE_DOC)).toContain('`210` is the first controlled Wave 4A metadata/config/registry migration batch');
    expect(read(PRIOR_DOC)).toContain('First controlled metadata/config/registry migration batch follow-up:');
    expect(read(PRIOR_DOC)).toContain('docs/210-wave-4a-first-controlled-metadata-config-registry-migration-batch.md');
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond the first controlled Wave 4A batch');
  });

  it('exports the migration batch boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4AFirstBatchMigrationReceipt/v1');
    expect(boundary).toContain('ZavorthWave4AFirstBatchMigrationWriteReceipt/v1');
    expect(boundary).toContain('ZavorthWave4AFirstBatchMigrationCleanupReceipt/v1');
    expect(index).toContain("from './ZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatch.js'");
    expect(index).toContain('ZAVORTH_WAVE4A_METADATA_MIGRATION_WRITE_FLAG');
  });

  it('blocks writes when the feature flag is disabled', () => {
    const batch = createZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatchFixture();
    const receipt = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4AFirstBatchMigrationFeatureFlag(false),
    });

    expect(receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4AFirstBatchMigrationReceipt/v1',
      decision: 'migration-write-blocked',
      migrationWriteFeatureFlagRequired: true,
      metadataConfigRegistryMigrationActuallyPerformedOnlyWhenFlagEnabled: true,
      migrationScopeMetadataConfigRegistryOnly: true,
      backupRollbackMetadataCreated: false,
      sourceRuntimeAuthority: false,
      rawSecretSerialized: false,
    }));
    expect(receipt.validations).toContain('feature-flag-disabled');
    expect(receipt.recordWrites).toHaveLength(0);
    expect(fs.existsSync(root)).toBe(false);
  });

  it('writes only the permitted metadata/config/registry batch when the feature flag is enabled', () => {
    const batch = createZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatchFixture();
    const receipt = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4AFirstBatchMigrationFeatureFlag(true),
    });
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')) as ZavorthWave4AFirstBatchMigrationManifest;

    expect(receipt.decision).toBe('wave4a-first-batch-migration-ready');
    expect(receipt.validations).toEqual(['valid']);
    expect(receipt.migrationNamespace).toBe(ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE);
    expect(receipt.migrationNamespaceUri).toBe(ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE_URI);
    expect(receipt.backupRollbackMetadataCreated).toBe(true);
    expect(receipt.recordWrites).toHaveLength(7);
    expect(receipt.recordWrites.every((write) => write.status === 'written')).toBe(true);
    expect(receipt.recordWrites.every((write) => write.atomicWriteUsed && write.metadataConfigRegistryMigrationActuallyPerformed)).toBe(true);
    expect(manifest).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4AFirstBatchMigrationManifest/v1',
      migrationNamespace: ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE,
      schemaVersion: ZAVORTH_WAVE4A_METADATA_MIGRATION_SCHEMA_VERSION,
      batchId: 'wave4a-metadata-config-registry-batch-001',
      recordCount: 7,
      backupRollbackMetadataCreated: true,
      runtimeExternalExecutorRequiredForMigration: false,
      rawSecretSerialized: false,
    }));
    expect(fs.existsSync(path.join(root, 'rollback', 'backup-rollback-manifest.json'))).toBe(true);
    assertNoRawSecret(root);
  });

  it('validates schema, redaction, checksum, idempotency, and policy in written records', () => {
    const batch = createZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatchFixture();
    const receipt = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4AFirstBatchMigrationFeatureFlag(true),
    });

    receipt.recordWrites.forEach((write) => {
      const persisted = JSON.parse(fs.readFileSync(path.join(root, write.relativePath), 'utf8')) as ZavorthWave4AFirstBatchMigratedRecord;

      expect(persisted).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthWave4AFirstBatchMigratedRecord/v1',
        migrationNamespace: ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE,
        schemaVersion: ZAVORTH_WAVE4A_METADATA_MIGRATION_SCHEMA_VERSION,
        idempotencyKey: write.idempotencyKey,
        checksum: write.checksum,
        checksumAlgorithm: 'sha256-stable-metadata',
        policyDecision: 'allow-metadata-config-registry-only',
        payloadKind: 'metadata-config-registry-only',
        payloadSensitiveFieldsPersisted: false,
        runtimeExternalExecutorRequiredForMigration: false,
        sourceRuntimeAuthority: false,
        rawSecretSerialized: false,
      }));
      expect(persisted.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(persisted.idempotencyKey).toContain(`wave4a:${persisted.dataClass}:`);
      expect(persisted.redactionEnvelope.rawSecretSerialized).toBe(false);
      expect(persisted.redactionEnvelope.forbiddenFields).toEqual(expect.arrayContaining([
        'rawSecretValue',
        'rawMessageContent',
        'sqlitePayload',
        'workspaceFileBody',
        'rawLogLine',
        'rawCacheEntry',
      ]));
      expect(persisted.backupRollback).toEqual(expect.objectContaining({
        backupManifestRequired: true,
        restoreManifestRequired: true,
        rollbackReceiptRequired: true,
        backupActuallyCreated: false,
        restoreActuallyPerformed: false,
      }));
    });
  });

  it('blocks invalid schema/checksum/idempotency/policy before writing', () => {
    const batch = createZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatchFixture(
      createZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatchFixtureSource({
        migrationPlan: corruptPlan(),
      }),
    );
    const receipt = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4AFirstBatchMigrationFeatureFlag(true),
    });

    expect(receipt.decision).toBe('blocked');
    expect(receipt.validations).toEqual(expect.arrayContaining([
      'schema-invalid',
      'checksum-invalid',
      'idempotency-invalid',
      'policy-blocked',
    ]));
    expect(receipt.recordWrites).toHaveLength(0);
    expect(fs.existsSync(root)).toBe(false);
  });

  it('blocks out-of-scope raw classes before writing', () => {
    const batch = createZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatchFixture(
      createZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatchFixtureSource({
        migrationPlan: unsafeScopePlan(),
      }),
    );
    const receipt = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4AFirstBatchMigrationFeatureFlag(true),
    });

    expect(receipt.decision).toBe('blocked');
    expect(receipt.validations).toEqual(expect.arrayContaining(['scope-invalid', 'checksum-invalid']));
    expect(receipt.recordWrites).toHaveLength(0);
    expect(fs.existsSync(root)).toBe(false);
  });

  it('uses idempotency on re-run without duplicating records', () => {
    const batch = createZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatchFixture();
    const first = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4AFirstBatchMigrationFeatureFlag(true),
    });
    const second = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4AFirstBatchMigrationFeatureFlag(true),
    });

    expect(first.recordWrites.every((write) => write.status === 'written')).toBe(true);
    expect(second.idempotencyAvoidedDuplicateWrites).toBe(true);
    expect(second.recordWrites.every((write) => write.status === 'already-present')).toBe(true);
    expect(listJsonFiles(root)).toHaveLength(9);
    assertNoRawSecret(root);
  });

  it('keeps external execution, raw migration, ExternalExecutor live requirement, and adapter removal blocked', () => {
    const batch = createZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatchFixture();
    const receipt = batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4AFirstBatchMigrationFeatureFlag(true),
    });
    const serialized = JSON.stringify(receipt);

    expect(receipt).toEqual(expect.objectContaining({
      wave4aFirstBatchMigrationCreated: true,
      migrationWriteFeatureFlagRequired: true,
      metadataConfigRegistryMigrationActuallyPerformedOnlyWhenFlagEnabled: true,
      migrationScopeMetadataConfigRegistryOnly: true,
      rawSecretMigrationAllowed: false,
      sessionHistoryRawMigrationAllowed: false,
      sqliteRealMigrationAllowed: false,
      workspaceMigrationAllowed: false,
      logsRawMigrationAllowed: false,
      cacheRawMigrationAllowed: false,
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
    expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(serialized).not.toContain('<redacted-local-secret>');
  });

  it('cleans up the controlled migration namespace used by the test gate', () => {
    const batch = createZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatchFixture();
    batch.migrate({
      migrationRoot: root,
      featureFlag: createZavorthWave4AFirstBatchMigrationFeatureFlag(true),
    });
    expect(fs.existsSync(root)).toBe(true);

    const cleanup = batch.cleanup(root);

    expect(cleanup).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4AFirstBatchMigrationCleanupReceipt/v1',
      cleanupActuallyPerformed: true,
      namespaceExistsAfterCleanup: false,
      cleanupLimitedToControlledTestNamespace: true,
      sourceFileCopied: false,
      sourceDbCopied: false,
      rawSecretSerialized: false,
    }));
    expect(fs.existsSync(root)).toBe(false);
  });
});
