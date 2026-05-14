import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE,
  ZAVORTH_WAVE4B_METADATA_VALIDATION_EXECUTE_FLAG,
  createZavorthWave4AFirstBatchMigrationFeatureFlag,
  createZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatchFixture,
  createZavorthWave4BFirstLowRiskMetadataValidationExecutableFixture,
  createZavorthWave4BMetadataValidationFeatureFlag,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4AFirstBatchMigratedRecord,
  ZavorthWave4AFirstBatchMigrationManifest,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/214-wave-4b-first-low-risk-metadata-validation-executable.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/213-wave-4b-low-risk-executable-capability-selection.md';
const PRIOR_TEST = 'tests/runtime/external-agents/ZavorthWave4BLowRiskExecutableCapabilitySelection.test.ts';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4BFirstLowRiskMetadataValidationExecutable.ts';
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
    'zavorth-wave4b-first-low-risk-metadata-validation-executable-test',
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

function seedMigratedBatch(root: string): void {
  const batch = createZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatchFixture();
  batch.migrate({
    migrationRoot: root,
    featureFlag: createZavorthWave4AFirstBatchMigrationFeatureFlag(true),
  });
}

function manifest(root: string): ZavorthWave4AFirstBatchMigrationManifest {
  return JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')) as ZavorthWave4AFirstBatchMigrationManifest;
}

function firstRecordPath(root: string): string {
  return path.join(root, manifest(root).records[0].relativePath);
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function assertNoRawSecret(serialized: string): void {
  expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{8,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{8,}/);
  expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  expect(serialized).not.toContain('<redacted-local-secret>');
}

describe('Wave 4B first low-risk metadata validation executable', () => {
  const root = migrationRoot();

  beforeEach(() => {
    const executable = createZavorthWave4BFirstLowRiskMetadataValidationExecutableFixture();
    if (fs.existsSync(root)) {
      executable.cleanup(root);
    }
  });

  afterEach(() => {
    const executable = createZavorthWave4BFirstLowRiskMetadataValidationExecutableFixture();
    if (fs.existsSync(root)) {
      executable.cleanup(root);
    }
  });

  it('documents 214 as the first low-risk metadata validation executable', () => {
    const content = read(DOC);

    expect(content).toContain('Status: wave4b-metadata-validation-executable-ready');
    expect(content).toContain('ZavorthWave4BFirstLowRiskMetadataValidationExecutable.ts');
    expect(content).toContain('ZavorthWave4BMetadataValidationExecutableReceipt/v1');
    expect(content).toContain('ZavorthWave4BMetadataValidationFeatureFlagGate/v1');
    expect(content).toContain('ZavorthWave4BMetadataValidationDetail/v1');
    expect(content).toContain(ZAVORTH_WAVE4B_METADATA_VALIDATION_EXECUTE_FLAG);
    expect(content).toContain('wave4bMetadataValidationExecutableCreated=true');
    expect(content).toContain('selectedLowRiskCapability=metadata-validation-action');
    expect(content).toContain('metadataValidationActuallyExecutedOnlyWhenFlagEnabled=true');
    expect(content).toContain('externalExecutorTouched=false');
    expect(content).toContain('Wave 4B low-risk native registry reconciliation commit follow-up:');
    expect(content).toContain('docs/215-wave-4b-low-risk-native-registry-reconciliation-commit-executable.md');
    expect(content).toContain('Do not advance beyond the low-risk native registry reconciliation commit');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the 213 handoff for 214', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/214-wave-4b-first-low-risk-metadata-validation-executable.md');
    expect(read(PAUSE_DOC)).toContain('`214` is the first Wave 4B low-risk executable');
    expect(read(PRIOR_DOC)).toContain('Wave 4B first low-risk executable follow-up:');
    expect(read(PRIOR_DOC)).toContain('docs/214-wave-4b-first-low-risk-metadata-validation-executable.md');
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond the first low-risk metadata validation executable');
    expect(read(PRIOR_TEST)).toContain('docs/214-wave-4b-first-low-risk-metadata-validation-executable.md');
  });

  it('exports the metadata validation executable boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4BMetadataValidationExecutableReceipt/v1');
    expect(boundary).toContain('ZavorthWave4BMetadataValidationFeatureFlagGate/v1');
    expect(boundary).toContain('ZavorthWave4BMetadataValidationCleanupReceipt/v1');
    expect(index).toContain("from './ZavorthWave4BFirstLowRiskMetadataValidationExecutable.js'");
    expect(index).toContain('ZAVORTH_WAVE4B_FIRST_LOW_RISK_METADATA_VALIDATION_EXECUTABLE_RUNTIME_ID');
  });

  it('blocks execution when the feature flag is disabled', () => {
    const executable = createZavorthWave4BFirstLowRiskMetadataValidationExecutableFixture();
    const receipt = executable.execute({
      migrationRoot: root,
      featureFlag: createZavorthWave4BMetadataValidationFeatureFlag(false),
    });

    expect(receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4BMetadataValidationExecutableReceipt/v1',
      decision: 'execution-blocked',
      classification: 'execution-blocked',
      validations: ['feature-flag-disabled'],
      metadataValidationActuallyExecuted: false,
      metadataValidationActuallyExecutedOnlyWhenFlagEnabled: true,
      selectedLowRiskCapabilityConfirmed: 'metadata-validation-action',
      runtimeExternalExecutorRequiredForExecution: false,
      externalExecutorTouched: false,
      rawSecretSerialized: false,
    }));
    expect(receipt.featureFlag.flagName).toBe(ZAVORTH_WAVE4B_METADATA_VALIDATION_EXECUTE_FLAG);
    expect(receipt.featureFlag.enabled).toBe(false);
    assertNoRawSecret(JSON.stringify(receipt));
  });

  it('executes metadata-validation-action when the feature flag is enabled', () => {
    seedMigratedBatch(root);
    const executable = createZavorthWave4BFirstLowRiskMetadataValidationExecutableFixture();
    const receipt = executable.execute({
      migrationRoot: root,
      featureFlag: createZavorthWave4BMetadataValidationFeatureFlag(true),
    });

    expect(receipt).toEqual(expect.objectContaining({
      decision: 'validation-ok',
      classification: 'validation-ok',
      validations: ['valid'],
      manifestRecordCount: 7,
      loadedRecordCount: 7,
      registryViewReconstructionReady: true,
      forbiddenRawDataAbsent: true,
      metadataValidationActuallyExecuted: true,
      metadataValidationActuallyExecutedOnlyWhenFlagEnabled: true,
      runtimeExternalExecutorRequiredForExecution: false,
      externalExecutorTouched: false,
      highImpactExecutionBlocked: true,
      messageSendRealAllowed: false,
      providerExecutionRealAllowed: false,
      toolCommandExecutionRealAllowed: false,
      externalExecutorMutationAllowed: false,
      stateMigrated: false,
      sourceModuleCopied: false,
      adapterRemovalGlobalAllowed: false,
      rawSecretSerialized: false,
    }));
    expect(receipt.parityReceipt?.classification).toBe('parity-ok');
    expect(receipt.validationDetails.map((detail) => detail.validation)).toEqual([
      'schema-version',
      'checksum',
      'idempotency',
      'redaction-envelope',
      'policy-decision',
      'migration-scope',
      'forbidden-raw-data-absence',
      'registry-view-reconstruction',
    ]);
    expect(receipt.validationDetails.every((detail) => detail.status === 'passed')).toBe(true);
    assertNoRawSecret(JSON.stringify(receipt));
  });

  it('validates idempotent re-run without duplicating storage output', () => {
    seedMigratedBatch(root);
    const executable = createZavorthWave4BFirstLowRiskMetadataValidationExecutableFixture();
    const filesBefore = listJsonFiles(root);
    const first = executable.execute({
      migrationRoot: root,
      featureFlag: createZavorthWave4BMetadataValidationFeatureFlag(true),
    });
    const second = executable.execute({
      migrationRoot: root,
      featureFlag: createZavorthWave4BMetadataValidationFeatureFlag(true),
    });
    const filesAfter = listJsonFiles(root);

    expect(first.decision).toBe('validation-ok');
    expect(second.decision).toBe('validation-ok');
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(second.manifestRecordCount).toBe(first.manifestRecordCount);
    expect(second.loadedRecordCount).toBe(first.loadedRecordCount);
    expect(filesAfter).toEqual(filesBefore);
  });

  it('classifies schema/checksum/idempotency failures as validation-corrupt', () => {
    seedMigratedBatch(root);
    const recordPath = firstRecordPath(root);
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as ZavorthWave4AFirstBatchMigratedRecord;
    writeJson(recordPath, {
      ...record,
      checksum: '0'.repeat(64),
      idempotencyKey: 'invalid-idempotency',
      schemaVersion: 'zavorth-wave4a-metadata-config-registry-migration/v0',
    });

    const receipt = createZavorthWave4BFirstLowRiskMetadataValidationExecutableFixture().execute({
      migrationRoot: root,
      featureFlag: createZavorthWave4BMetadataValidationFeatureFlag(true),
    });

    expect(receipt.decision).toBe('validation-corrupt');
    expect(receipt.validations).toEqual(expect.arrayContaining(['checksum-invalid', 'idempotency-invalid']));
    expect(receipt.validationDetails.find((detail) => detail.validation === 'checksum')?.status).toBe('failed');
    expect(receipt.validationDetails.find((detail) => detail.validation === 'idempotency')?.status).toBe('failed');
  });

  it('detects forbidden raw secrets/message content/SQLite/workspace/log/cache payloads as validation-rejected', () => {
    seedMigratedBatch(root);
    const recordPath = firstRecordPath(root);
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8')) as ZavorthWave4AFirstBatchMigratedRecord;
    writeJson(recordPath, {
      ...record,
      rawSecretValue: 'synthetic-raw-credential-sentinel-that-must-not-appear',
      rawMessageContent: 'private message body',
      sqlitePayload: 'sqlite bytes',
      workspaceFileBody: 'workspace body',
      rawLogLine: 'raw log line',
      rawCacheEntry: 'raw cache entry',
    });

    const receipt = createZavorthWave4BFirstLowRiskMetadataValidationExecutableFixture().execute({
      migrationRoot: root,
      featureFlag: createZavorthWave4BMetadataValidationFeatureFlag(true),
    });
    const serialized = JSON.stringify(receipt);

    expect(receipt.decision).toBe('validation-rejected');
    expect(receipt.validations).toEqual(expect.arrayContaining(['forbidden-raw-data-detected', 'scope-invalid']));
    expect(receipt.forbiddenRawDataAbsent).toBe(false);
    expect(receipt.validationDetails.find((detail) => detail.validation === 'forbidden-raw-data-absence')?.status).toBe('failed');
    assertNoRawSecret(serialized);
  });

  it('classifies missing manifest/readiness as validation-degraded', () => {
    seedMigratedBatch(root);
    fs.rmSync(path.join(root, 'manifest.json'));

    const receipt = createZavorthWave4BFirstLowRiskMetadataValidationExecutableFixture({
      wave4aLoadVerifyParityReady: false,
    }).execute({
      migrationRoot: root,
      featureFlag: createZavorthWave4BMetadataValidationFeatureFlag(true),
    });

    expect(receipt.decision).toBe('validation-degraded');
    expect(receipt.validations).toEqual(expect.arrayContaining(['manifest-missing', 'source-not-ready']));
    expect(receipt.registryViewReconstructionReady).toBe(false);
  });

  it('rejects high-impact attempts and ExternalExecutor touch attempts without granting execution authority', () => {
    seedMigratedBatch(root);
    const receipt = createZavorthWave4BFirstLowRiskMetadataValidationExecutableFixture({
      messageSendAttempted: true,
      providerExecutionAttempted: true,
      toolCommandExecutionAttempted: true,
      externalExecutorTouched: true,
    }).execute({
      migrationRoot: root,
      featureFlag: createZavorthWave4BMetadataValidationFeatureFlag(true),
    });

    expect(receipt.decision).toBe('validation-rejected');
    expect(receipt.validations).toEqual(expect.arrayContaining([
      'high-impact-execution-attempted',
      'external-executor-touch-attempted',
    ]));
    expect(receipt.externalExecutorTouched).toBe(false);
    expect(receipt.messageSendRealAllowed).toBe(false);
    expect(receipt.providerExecutionRealAllowed).toBe(false);
    expect(receipt.toolCommandExecutionRealAllowed).toBe(false);
    expect(receipt.externalExecutorMutationAllowed).toBe(false);
  });

  it('keeps all required safety guarantees false for high-impact execution, migration, source copy, and raw secrets', () => {
    seedMigratedBatch(root);
    const receipt = createZavorthWave4BFirstLowRiskMetadataValidationExecutableFixture().execute({
      migrationRoot: root,
      featureFlag: createZavorthWave4BMetadataValidationFeatureFlag(true),
    });
    const serialized = JSON.stringify(receipt);

    expect(receipt).toEqual(expect.objectContaining({
      wave4bMetadataValidationExecutableCreated: true,
      selectedLowRiskCapabilityConfirmed: 'metadata-validation-action',
      metadataValidationActuallyExecutedOnlyWhenFlagEnabled: true,
      runtimeExternalExecutorRequiredForExecution: false,
      externalExecutorTouched: false,
      highImpactExecutionBlocked: true,
      messageSendRealAllowed: false,
      providerExecutionRealAllowed: false,
      toolCommandExecutionRealAllowed: false,
      externalExecutorMutationAllowed: false,
      stateMigrated: false,
      sourceModuleCopied: false,
      rawSecretSerialized: false,
      adapterRemovalGlobalAllowed: false,
    }));
    assertNoRawSecret(serialized);
  });

  it('cleans up the controlled test namespace', () => {
    seedMigratedBatch(root);
    expect(fs.existsSync(root)).toBe(true);

    const cleanup = createZavorthWave4BFirstLowRiskMetadataValidationExecutableFixture().cleanup(root);

    expect(cleanup).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4BMetadataValidationCleanupReceipt/v1',
      cleanupActuallyPerformed: true,
      namespaceExistsAfterCleanup: false,
      cleanupLimitedToControlledTestNamespace: true,
      externalExecutorTouched: false,
      sourceFileCopied: false,
      sourceDbCopied: false,
      rawSecretSerialized: false,
    }));
    expect(fs.existsSync(root)).toBe(false);
  });
});
