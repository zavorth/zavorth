import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
  ZAVORTH_WAVE4B_PRODUCTION_SNAPSHOT_REPAIR_EXECUTE_FLAG,
  createZavorthNativeRegistryProductionPersistenceFeatureFlag,
  createZavorthNativeRegistryProductionPersistenceFlaggedFixture,
  createZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutableFixture,
  createZavorthWave4BProductionSnapshotRepairFeatureFlag,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthNativeRegistryProductionManifest,
  ZavorthNativeRegistryProductionPersistedSnapshot,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/216-wave-4b-low-risk-production-snapshot-verify-repair-executable.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/215-wave-4b-low-risk-native-registry-reconciliation-commit-executable.md';
const PRIOR_TEST = 'tests/runtime/external-agents/ZavorthWave4BLowRiskNativeRegistryReconciliationCommitExecutable.test.ts';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutable.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJson<TValue>(filePath: string): TValue {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as TValue;
}

function productionRoot(): string {
  return path.join(
    process.cwd(),
    '.tmp',
    'zavorth-wave4b-production-snapshot-verify-repair-test',
    ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
  );
}

function productionBaselineRoot(): string {
  return path.join(
    process.cwd(),
    '.tmp',
    'zavorth-wave4b-production-snapshot-verify-repair-baseline',
    ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
  );
}

function seedProductionSnapshots(root: string): void {
  const baseline = productionBaselineRoot();
  if (root !== baseline && fs.existsSync(baseline)) {
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(root), { recursive: true });
    fs.cpSync(baseline, root, { recursive: true });
    return;
  }

  const persistence = createZavorthNativeRegistryProductionPersistenceFlaggedFixture();
  const receipt = persistence.persist({
    productionRoot: root,
    featureFlag: createZavorthNativeRegistryProductionPersistenceFeatureFlag(true),
  });

  expect(receipt.decision).toBe('native-registry-production-persistence-ready');
}

function manifestPath(root: string): string {
  return path.join(root, 'manifest.json');
}

function backupRollbackPath(root: string): string {
  return path.join(root, 'rollback', 'backup-rollback-manifest.json');
}

function manifest(root: string): ZavorthNativeRegistryProductionManifest {
  return readJson<ZavorthNativeRegistryProductionManifest>(manifestPath(root));
}

function firstSnapshotPath(root: string): string {
  const current = manifest(root);
  return path.join(root, current.snapshots[0].relativePath);
}

function mutateManifest(
  root: string,
  mutator: (manifest: ZavorthNativeRegistryProductionManifest) => ZavorthNativeRegistryProductionManifest,
): void {
  writeJson(manifestPath(root), mutator(manifest(root)));
}

function mutateFirstSnapshot(
  root: string,
  mutator: (snapshot: ZavorthNativeRegistryProductionPersistedSnapshot & Record<string, unknown>) => ZavorthNativeRegistryProductionPersistedSnapshot & Record<string, unknown>,
): void {
  const filePath = firstSnapshotPath(root);
  const snapshot = readJson<ZavorthNativeRegistryProductionPersistedSnapshot & Record<string, unknown>>(filePath);
  writeJson(filePath, mutator(snapshot));
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
}

describe('Wave 4B low-risk production snapshot verify/repair executable', () => {
  const root = productionRoot();
  const baselineRoot = productionBaselineRoot();

  beforeAll(() => {
    const executable = createZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutableFixture();
    if (fs.existsSync(baselineRoot)) {
      executable.cleanup(baselineRoot);
    }
    seedProductionSnapshots(baselineRoot);
  });

  beforeEach(() => {
    const executable = createZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutableFixture();
    if (fs.existsSync(root)) {
      executable.cleanup(root);
    }
  });

  afterEach(() => {
    const executable = createZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutableFixture();
    if (fs.existsSync(root)) {
      executable.cleanup(root);
    }
  });

  afterAll(() => {
    const executable = createZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutableFixture();
    if (fs.existsSync(baselineRoot)) {
      executable.cleanup(baselineRoot);
    }
  });

  it('documents 216 as the production snapshot verify/repair executable', () => {
    const content = read(DOC);

    expect(content).toContain('Status: wave4b-production-snapshot-verify-repair-executable-ready');
    expect(content).toContain('ZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutable.ts');
    expect(content).toContain('ZavorthWave4BProductionSnapshotVerifyRepairReceipt/v1');
    expect(content).toContain('ZavorthWave4BProductionSnapshotRepairFeatureFlagGate/v1');
    expect(content).toContain(ZAVORTH_WAVE4B_PRODUCTION_SNAPSHOT_REPAIR_EXECUTE_FLAG);
    expect(content).toContain('wave4bProductionSnapshotVerifyRepairExecutableCreated=true');
    expect(content).toContain('verifyActionAlwaysAllowed=true');
    expect(content).toContain('repairActuallyPerformedOnlyWhenFlagEnabled=true');
    expect(content).toContain('runtimeExternalExecutorRequiredForExecution=false');
    expect(content).toContain('externalExecutorTouched=false');
    expect(content).toContain('Wave 4B low-risk executable capabilities milestone follow-up:');
    expect(content).toContain('docs/217-wave-4b-low-risk-executable-capabilities-milestone-report.md');
    expect(content).toContain('Do not advance beyond the Wave 4B low-risk executable capabilities milestone');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the 215 handoff for 216', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/216-wave-4b-low-risk-production-snapshot-verify-repair-executable.md');
    expect(read(PAUSE_DOC)).toContain('`216` is the third Wave 4B low-risk executable');
    expect(read(PRIOR_DOC)).toContain('Wave 4B production snapshot verify/repair follow-up:');
    expect(read(PRIOR_DOC)).toContain('docs/216-wave-4b-low-risk-production-snapshot-verify-repair-executable.md');
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond the low-risk production snapshot verify/repair executable');
    expect(read(PRIOR_TEST)).toContain('docs/216-wave-4b-low-risk-production-snapshot-verify-repair-executable.md');
  });

  it('exports the production snapshot verify/repair boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4BProductionSnapshotVerifyRepairReceipt/v1');
    expect(boundary).toContain('ZavorthWave4BProductionSnapshotVerificationRow/v1');
    expect(boundary).toContain('ZavorthWave4BProductionSnapshotVerifyRepairRollbackReceipt/v1');
    expect(index).toContain("from './ZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutable.js'");
    expect(index).toContain('ZAVORTH_WAVE4B_LOW_RISK_PRODUCTION_SNAPSHOT_VERIFY_REPAIR_EXECUTABLE_RUNTIME_ID');
  });

  it('runs verify-only with the feature flag disabled when no repair is needed', () => {
    seedProductionSnapshots(root);
    const executable = createZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutableFixture();
    const receipt = executable.execute({
      productionRoot: root,
      featureFlag: createZavorthWave4BProductionSnapshotRepairFeatureFlag(false),
    });

    expect(receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4BProductionSnapshotVerifyRepairReceipt/v1',
      decision: 'verify-ok',
      classification: 'verify-ok',
      validations: ['valid'],
      repairNeeded: false,
      repairActuallyPerformed: false,
      wave4bProductionSnapshotVerifyRepairExecutableCreated: true,
      verifyActionAlwaysAllowed: true,
      repairActuallyPerformedOnlyWhenFlagEnabled: true,
      runtimeExternalExecutorRequiredForExecution: false,
      externalExecutorTouched: false,
      rawSecretSerialized: false,
    }));
    expect(receipt.featureFlag.enabled).toBe(false);
    expect(receipt.repairActions[0].status).toBe('skipped');
    assertNoRawSecret(JSON.stringify(receipt));
  });

  it('blocks repair with the feature flag disabled when metadata repair is needed', () => {
    seedProductionSnapshots(root);
    mutateManifest(root, (current) => ({
      ...current,
      snapshots: current.snapshots.map((entry, index) => (
        index === 0 ? { ...entry, contentChecksum: '0'.repeat(64) } : entry
      )),
    }));

    const receipt = createZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutableFixture().execute({
      productionRoot: root,
      featureFlag: createZavorthWave4BProductionSnapshotRepairFeatureFlag(false),
    });

    expect(receipt.decision).toBe('repair-blocked');
    expect(receipt.validations).toEqual(expect.arrayContaining(['checksum-mismatch', 'feature-flag-disabled']));
    expect(receipt.repairNeeded).toBe(true);
    expect(receipt.repairActuallyPerformed).toBe(false);
    expect(receipt.repairActions[0]).toEqual(expect.objectContaining({
      action: 'none',
      status: 'skipped',
    }));
    expect(manifest(root).snapshots[0].contentChecksum).toBe('0'.repeat(64));
  });

  it('repairs safe derived checksum metadata only when the feature flag is enabled', () => {
    seedProductionSnapshots(root);
    const snapshot = readJson<ZavorthNativeRegistryProductionPersistedSnapshot>(firstSnapshotPath(root));
    mutateManifest(root, (current) => ({
      ...current,
      snapshots: current.snapshots.map((entry, index) => (
        index === 0 ? { ...entry, contentChecksum: '0'.repeat(64) } : entry
      )),
    }));

    const receipt = createZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutableFixture().execute({
      productionRoot: root,
      featureFlag: createZavorthWave4BProductionSnapshotRepairFeatureFlag(true),
    });

    expect(receipt.decision).toBe('repair-applied');
    expect(receipt.validations).toContain('checksum-mismatch');
    expect(receipt.repairActions[0]).toEqual(expect.objectContaining({
      action: 'regenerate-derived-checksum-metadata',
      relativePath: 'manifest.json',
      status: 'written',
      safeMetadataOnly: true,
      rawSecretSerialized: false,
    }));
    expect(receipt.repairActuallyPerformed).toBe(true);
    expect(manifest(root).snapshots[0].contentChecksum).toBe(snapshot.contentChecksum);
    assertNoRawSecret(JSON.stringify(receipt));
  });

  it('restores a missing manifest from validated snapshot metadata and rollback metadata', () => {
    seedProductionSnapshots(root);
    fs.rmSync(manifestPath(root), { force: true });

    const receipt = createZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutableFixture().execute({
      productionRoot: root,
      featureFlag: createZavorthWave4BProductionSnapshotRepairFeatureFlag(true),
    });

    expect(receipt.decision).toBe('repair-applied');
    expect(receipt.validations).toContain('manifest-missing');
    expect(receipt.repairActions[0]).toEqual(expect.objectContaining({
      action: 'restore-manifest-from-backup-metadata',
      relativePath: 'manifest.json',
      status: 'written',
    }));
    expect(fs.existsSync(manifestPath(root))).toBe(true);
    expect(manifest(root).snapshotCount).toBe(5);
  });

  it('marks unsafe redaction violations degraded/blocked without repairing payload', () => {
    seedProductionSnapshots(root);
    mutateFirstSnapshot(root, (snapshot) => ({
      ...snapshot,
      rawSecretValue: 'synthetic-raw-credential-sentinel-that-must-not-appear',
      redactionEnvelope: {
        ...snapshot.redactionEnvelope,
        rawSecretSerialized: true,
      },
    }));

    const receipt = createZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutableFixture().execute({
      productionRoot: root,
      featureFlag: createZavorthWave4BProductionSnapshotRepairFeatureFlag(true),
    });

    expect(receipt.decision).toBe('repair-degraded');
    expect(receipt.validations).toEqual(expect.arrayContaining(['redaction-envelope-invalid', 'raw-secret-detected']));
    expect(receipt.repairActions[0]).toEqual(expect.objectContaining({
      action: 'mark-degraded-blocked',
      status: 'written',
    }));
    expect(fs.readFileSync(firstSnapshotPath(root), 'utf8')).toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
    assertNoRawSecret(JSON.stringify(receipt));
  });

  it('marks incompatible versions and partial writes degraded instead of repairing unsafe snapshots', () => {
    seedProductionSnapshots(root);
    mutateFirstSnapshot(root, (snapshot) => ({
      ...snapshot,
      schemaVersion: 'zavorth-native-registry-persistence/v0',
    } as ZavorthNativeRegistryProductionPersistedSnapshot & Record<string, unknown>));

    const incompatible = createZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutableFixture().execute({
      productionRoot: root,
      featureFlag: createZavorthWave4BProductionSnapshotRepairFeatureFlag(true),
    });

    expect(incompatible.decision).toBe('repair-degraded');
    expect(incompatible.validations).toContain('version-incompatible');
    expect(incompatible.repairActions[0].action).toBe('mark-degraded-blocked');

    createZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutableFixture().cleanup(root);
    seedProductionSnapshots(root);
    fs.rmSync(firstSnapshotPath(root), { force: true });

    const partial = createZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutableFixture().execute({
      productionRoot: root,
      featureFlag: createZavorthWave4BProductionSnapshotRepairFeatureFlag(true),
    });

    expect(partial.decision).toBe('repair-degraded');
    expect(partial.validations).toContain('partial-write');
    expect(partial.repairActions[0].action).toBe('mark-degraded-blocked');
  });

  it('does not repair snapshots when rollback metadata is missing', () => {
    seedProductionSnapshots(root);
    mutateManifest(root, (current) => ({
      ...current,
      snapshots: current.snapshots.map((entry, index) => (
        index === 0 ? { ...entry, contentChecksum: '0'.repeat(64) } : entry
      )),
    }));
    fs.rmSync(backupRollbackPath(root), { force: true });

    const receipt = createZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutableFixture().execute({
      productionRoot: root,
      featureFlag: createZavorthWave4BProductionSnapshotRepairFeatureFlag(true),
    });

    expect(receipt.decision).toBe('repair-degraded');
    expect(receipt.validations).toEqual(expect.arrayContaining(['checksum-mismatch', 'rollback-metadata-missing']));
    expect(receipt.repairActions[0].action).toBe('mark-degraded-blocked');
    expect(manifest(root).snapshots[0].contentChecksum).toBe('0'.repeat(64));
  });

  it('supports rollback, cleanup, and idempotent re-run for controlled metadata repairs', () => {
    seedProductionSnapshots(root);
    mutateManifest(root, (current) => ({
      ...current,
      snapshots: current.snapshots.map((entry, index) => (
        index === 0 ? { ...entry, contentChecksum: '0'.repeat(64) } : entry
      )),
    }));
    const executable = createZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutableFixture();
    const repaired = executable.execute({
      productionRoot: root,
      featureFlag: createZavorthWave4BProductionSnapshotRepairFeatureFlag(true),
    });
    const second = executable.execute({
      productionRoot: root,
      featureFlag: createZavorthWave4BProductionSnapshotRepairFeatureFlag(true),
    });

    expect(repaired.decision).toBe('repair-applied');
    expect(second.decision).toBe('verify-ok');
    expect(second.repairActuallyPerformed).toBe(false);

    mutateFirstSnapshot(root, (snapshot) => ({
      ...snapshot,
      schemaVersion: 'zavorth-native-registry-persistence/v0',
    } as ZavorthNativeRegistryProductionPersistedSnapshot & Record<string, unknown>));
    const degraded = executable.execute({
      productionRoot: root,
      featureFlag: createZavorthWave4BProductionSnapshotRepairFeatureFlag(true),
    });
    expect(fs.existsSync(path.join(root, degraded.repairActions[0].relativePath))).toBe(true);

    const rollback = executable.rollback(root, degraded);
    expect(rollback).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4BProductionSnapshotVerifyRepairRollbackReceipt/v1',
      outcome: 'rollback-applied',
      rollbackApplied: true,
      runtimeExternalExecutorRequiredForExecution: false,
      externalExecutorTouched: false,
      stateMigrated: false,
      rawSecretSerialized: false,
    }));
    expect(rollback.removedRelativePaths).toContain(degraded.repairActions[0].relativePath);
    expect(fs.existsSync(path.join(root, degraded.repairActions[0].relativePath))).toBe(false);

    const cleanup = executable.cleanup(root);
    expect(cleanup).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4BProductionSnapshotVerifyRepairCleanupReceipt/v1',
      cleanupActuallyPerformed: true,
      namespaceExistsAfterCleanup: false,
      cleanupLimitedToControlledTestNamespace: true,
      externalExecutorTouched: false,
      stateMigrated: false,
      sourceModuleCopied: false,
      rawSecretSerialized: false,
    }));
  });

  it('rejects high-impact and ExternalExecutor touch attempts without repairing or granting authority', () => {
    seedProductionSnapshots(root);
    const receipt = createZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutableFixture({
      externalExecutorTouched: true,
      messageSendAttempted: true,
      providerExecutionAttempted: true,
      toolCommandExecutionAttempted: true,
    }).execute({
      productionRoot: root,
      featureFlag: createZavorthWave4BProductionSnapshotRepairFeatureFlag(true),
    });

    expect(receipt.decision).toBe('repair-rejected');
    expect(receipt.validations).toEqual(expect.arrayContaining([
      'external-executor-touch-attempted',
      'high-impact-execution-attempted',
    ]));
    expect(receipt.externalExecutorTouched).toBe(false);
    expect(receipt.messageSendRealAllowed).toBe(false);
    expect(receipt.providerExecutionRealAllowed).toBe(false);
    expect(receipt.toolCommandExecutionRealAllowed).toBe(false);
    expect(receipt.externalExecutorMutationAllowed).toBe(false);
    expect(receipt.repairActuallyPerformed).toBe(false);
  });

  it('keeps high-impact execution, ExternalExecutor, migration, source copy, and raw secrets blocked', () => {
    seedProductionSnapshots(root);
    const receipt = createZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutableFixture().execute({
      productionRoot: root,
      featureFlag: createZavorthWave4BProductionSnapshotRepairFeatureFlag(true),
    });

    expect(receipt).toEqual(expect.objectContaining({
      wave4bProductionSnapshotVerifyRepairExecutableCreated: true,
      verifyActionAlwaysAllowed: true,
      repairActuallyPerformedOnlyWhenFlagEnabled: true,
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
    assertNoRawSecret(JSON.stringify(receipt));
    listJsonFiles(root).forEach((file) => {
      if (!file.endsWith('production-snapshot-degraded.json')) {
        assertNoRawSecret(fs.readFileSync(file, 'utf8'));
      }
    });
  });
});
