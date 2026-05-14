import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE,
  ZAVORTH_WAVE4A_METADATA_MIGRATION_SCHEMA_VERSION,
  createZavorthWave4AFirstBatchMigrationFeatureFlag,
  createZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatchFixture,
  createZavorthWave4AMigratedMetadataBatchLoadVerifyParityFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4AFirstBatchMigratedRecord,
  ZavorthWave4AFirstBatchMigrationManifest,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/211-wave-4a-migrated-metadata-batch-load-verify-parity.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/210-wave-4a-first-controlled-metadata-config-registry-migration-batch.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4AMigratedMetadataBatchLoadVerifyParity.ts';
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
    'zavorth-wave4a-migrated-metadata-batch-load-verify-parity-test',
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

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function seedMigratedBatch(root: string): void {
  const batch = createZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatchFixture();
  batch.migrate({
    migrationRoot: root,
    featureFlag: createZavorthWave4AFirstBatchMigrationFeatureFlag(true),
  });
}

function firstRecordPath(root: string): string {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')) as ZavorthWave4AFirstBatchMigrationManifest;
  return path.join(root, manifest.records[0].relativePath);
}

describe('Wave 4A migrated metadata batch load/verify parity', () => {
  const root = migrationRoot();

  beforeEach(() => {
    const loader = createZavorthWave4AMigratedMetadataBatchLoadVerifyParityFixture();
    if (fs.existsSync(root)) {
      loader.cleanup(root);
    }
  });

  afterEach(() => {
    const loader = createZavorthWave4AMigratedMetadataBatchLoadVerifyParityFixture();
    if (fs.existsSync(root)) {
      loader.cleanup(root);
    }
  });

  it('documents 211 as the migrated metadata load/verify/parity gate', () => {
    const content = read(DOC);

    expect(content).toContain('Status: wave4a-migrated-metadata-load-verify-parity-ready');
    expect(content).toContain('ZavorthWave4AMigratedMetadataBatchLoadVerifyParity.ts');
    expect(content).toContain('ZavorthWave4AMigratedMetadataParityReceipt/v1');
    expect(content).toContain('ZavorthWave4AMigratedMetadataRegistryView/v1');
    expect(content).toContain('ZavorthWave4AMigratedMetadataConsumerProjection/v1');
    expect(content).toContain('wave4aMigratedBatchLoadVerifyCreated=true');
    expect(content).toContain('migratedMetadataLoadedFromZavorthStorage=true');
    expect(content).toContain('runtimeExternalExecutorRequiredForMigratedMetadataLoad=false');
    expect(content).toContain('Wave 4A controlled metadata migration milestone follow-up:');
    expect(content).toContain('docs/212-wave-4a-controlled-metadata-migration-milestone-report.md');
    expect(content).toContain('Do not advance beyond the Wave 4A milestone report');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the previous migration batch for 211', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/211-wave-4a-migrated-metadata-batch-load-verify-parity.md');
    expect(read(PAUSE_DOC)).toContain('`211` is the migrated metadata batch load/verify/parity gate');
    expect(read(PRIOR_DOC)).toContain('Migrated metadata batch load/verify/parity follow-up:');
    expect(read(PRIOR_DOC)).toContain('docs/211-wave-4a-migrated-metadata-batch-load-verify-parity.md');
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond the migrated metadata batch load/verify/parity gate');
  });

  it('exports the load/verify/parity boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4AMigratedMetadataParityReceipt/v1');
    expect(boundary).toContain('ZavorthWave4AMigratedMetadataRegistryView/v1');
    expect(boundary).toContain('ZavorthWave4AMigratedMetadataBatchCleanupReceipt/v1');
    expect(index).toContain("from './ZavorthWave4AMigratedMetadataBatchLoadVerifyParity.js'");
    expect(index).toContain('ZAVORTH_WAVE4A_MIGRATED_METADATA_BATCH_LOAD_VERIFY_PARITY_RUNTIME_ID');
  });

  it('loads the migrated batch from Zavorth-owned storage and classifies parity-ok', () => {
    seedMigratedBatch(root);
    const loader = createZavorthWave4AMigratedMetadataBatchLoadVerifyParityFixture();
    const receipt = loader.loadVerify({ migrationRoot: root });

    expect(receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4AMigratedMetadataParityReceipt/v1',
      classification: 'parity-ok',
      validations: ['valid'],
      manifestRecordCount: 7,
      loadedRecordCount: 7,
      wave4aMigratedBatchLoadVerifyCreated: true,
      migratedMetadataLoadedFromZavorthStorage: true,
      runtimeExternalExecutorRequiredForMigratedMetadataLoad: false,
      runtimeExternalExecutorRequiredForMigratedMetadataRender: false,
      rawSecretSerialized: false,
    }));
    expect(receipt.registryViews).toHaveLength(7);
    expect(receipt.registryViews.map((view) => view.viewKind)).toEqual(expect.arrayContaining([
      'backup-rollback',
      'capability',
      'config-state',
      'integration',
      'registry',
    ]));
    assertNoRawSecret(root);
  });

  it('reconstructs native views consumed by Command Center, planner, policy, and observability', () => {
    seedMigratedBatch(root);
    const receipt = createZavorthWave4AMigratedMetadataBatchLoadVerifyParityFixture().loadVerify({ migrationRoot: root });

    expect(receipt.consumerProjections).toHaveLength(4);
    expect(receipt.consumerProjections.map((projection) => projection.consumerId)).toEqual([
      'command-center',
      'controlled-dry-run-planner',
      'command-http-policy-preflight',
      'command-http-observability-projection',
    ]);
    receipt.consumerProjections.forEach((projection) => {
      expect(projection.consumesMigratedMetadata).toBe(true);
      expect(projection.registryViewIds).toHaveLength(7);
      expect(projection.runtimeExternalExecutorRequiredForLookup).toBe(false);
      expect(projection.runtimeExternalExecutorRequiredForRender).toBe(false);
      expect(projection.adapterDefaultPath).toBe(false);
      expect(projection.publicExternalExecutorIdentityLeak).toBe(false);
    });
    expect(receipt.baselineComparison).toEqual({
      nativeRegistrySurfaceCount: 7,
      migratedRegistryViewCount: 7,
      baselineProjectionCount: 4,
      commandCenterParity: 'parity-ok',
      plannerPolicyObservabilityParity: 'parity-ok',
    });
  });

  it('classifies checksum/schema/idempotency failures as corrupt', () => {
    seedMigratedBatch(root);
    const recordPath = firstRecordPath(root);
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as ZavorthWave4AFirstBatchMigratedRecord;
    writeJson(recordPath, {
      ...record,
      checksum: '0'.repeat(64),
      idempotencyKey: 'invalid-idempotency',
      schemaVersion: 'zavorth-wave4a-metadata-config-registry-migration/v0',
    });

    const receipt = createZavorthWave4AMigratedMetadataBatchLoadVerifyParityFixture().loadVerify({ migrationRoot: root });

    expect(receipt.classification).toBe('corrupt');
    expect(receipt.validations).toEqual(expect.arrayContaining([
      'checksum-invalid',
      'idempotency-invalid',
    ]));
  });

  it('classifies invalid redaction or policy as rejected', () => {
    seedMigratedBatch(root);
    const recordPath = firstRecordPath(root);
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as ZavorthWave4AFirstBatchMigratedRecord;
    writeJson(recordPath, {
      ...record,
      redactionEnvelope: {
        ...record.redactionEnvelope,
        rawSecretSerialized: true,
      },
      policyDecision: 'block-sensitive-item',
    });

    const receipt = createZavorthWave4AMigratedMetadataBatchLoadVerifyParityFixture().loadVerify({ migrationRoot: root });

    expect(receipt.classification).toBe('rejected');
    expect(receipt.validations).toEqual(expect.arrayContaining(['redaction-invalid', 'policy-invalid']));
  });

  it('classifies missing migrated records as parity-partial', () => {
    seedMigratedBatch(root);
    fs.rmSync(firstRecordPath(root));

    const receipt = createZavorthWave4AMigratedMetadataBatchLoadVerifyParityFixture().loadVerify({ migrationRoot: root });

    expect(receipt.classification).toBe('parity-partial');
    expect(receipt.validations).toContain('record-missing');
    expect(receipt.loadedRecordCount).toBe(6);
    expect(receipt.registryViews).toHaveLength(6);
  });

  it('classifies missing manifest or source readiness failures as degraded', () => {
    seedMigratedBatch(root);
    fs.rmSync(path.join(root, 'manifest.json'));

    const receipt = createZavorthWave4AMigratedMetadataBatchLoadVerifyParityFixture({
      parityBaselineReady: false,
    }).loadVerify({ migrationRoot: root });

    expect(receipt.classification).toBe('degraded');
    expect(receipt.validations).toEqual(expect.arrayContaining(['manifest-missing', 'source-not-ready']));
    expect(receipt.loadedRecordCount).toBe(0);
  });

  it('keeps raw migration, external execution, ExternalExecutor live, source copy, and adapter removal blocked', () => {
    seedMigratedBatch(root);
    const receipt = createZavorthWave4AMigratedMetadataBatchLoadVerifyParityFixture().loadVerify({ migrationRoot: root });
    const serialized = JSON.stringify(receipt);

    expect(receipt).toEqual(expect.objectContaining({
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

  it('cleans up the controlled migrated metadata namespace used by the test gate', () => {
    seedMigratedBatch(root);
    expect(fs.existsSync(root)).toBe(true);

    const cleanup = createZavorthWave4AMigratedMetadataBatchLoadVerifyParityFixture().cleanup(root);

    expect(cleanup).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4AMigratedMetadataBatchCleanupReceipt/v1',
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
