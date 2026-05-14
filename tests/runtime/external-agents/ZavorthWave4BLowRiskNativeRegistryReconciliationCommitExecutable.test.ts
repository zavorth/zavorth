import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
  ZAVORTH_WAVE4B_REGISTRY_RECONCILIATION_COMMIT_EXECUTE_FLAG,
  createZavorthWave4BLowRiskNativeRegistryReconciliationCommitExecutableFixture,
  createZavorthWave4BRegistryReconciliationCommitFeatureFlag,
  createZavorthWave4BRegistryReconciliationDiffInput,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4BRegistryReconciliationCommittedUpdate,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/215-wave-4b-low-risk-native-registry-reconciliation-commit-executable.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/214-wave-4b-first-low-risk-metadata-validation-executable.md';
const PRIOR_TEST = 'tests/runtime/external-agents/ZavorthWave4BFirstLowRiskMetadataValidationExecutable.test.ts';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4BLowRiskNativeRegistryReconciliationCommitExecutable.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function productionRoot(): string {
  return path.join(
    process.cwd(),
    '.tmp',
    'zavorth-wave4b-native-registry-reconciliation-commit-test',
    ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
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
}

describe('Wave 4B low-risk native registry reconciliation commit executable', () => {
  const root = productionRoot();

  beforeEach(() => {
    const executable = createZavorthWave4BLowRiskNativeRegistryReconciliationCommitExecutableFixture();
    if (fs.existsSync(root)) {
      executable.cleanup(root);
    }
  });

  afterEach(() => {
    const executable = createZavorthWave4BLowRiskNativeRegistryReconciliationCommitExecutableFixture();
    if (fs.existsSync(root)) {
      executable.cleanup(root);
    }
  });

  it('documents 215 as the low-risk native registry reconciliation commit executable', () => {
    const content = read(DOC);

    expect(content).toContain('Status: wave4b-native-registry-reconciliation-commit-executable-ready');
    expect(content).toContain('ZavorthWave4BLowRiskNativeRegistryReconciliationCommitExecutable.ts');
    expect(content).toContain('ZavorthWave4BRegistryReconciliationDiffInput/v1');
    expect(content).toContain('ZavorthWave4BRegistryReconciliationCommitReceipt/v1');
    expect(content).toContain('ZavorthWave4BRegistryReconciliationCommitFeatureFlagGate/v1');
    expect(content).toContain(ZAVORTH_WAVE4B_REGISTRY_RECONCILIATION_COMMIT_EXECUTE_FLAG);
    expect(content).toContain('wave4bRegistryReconciliationCommitExecutableCreated=true');
    expect(content).toContain('selectedLowRiskCapability=native-registry-reconciliation-commit-action');
    expect(content).toContain('registryReconciliationCommitActuallyExecutedOnlyWhenFlagEnabled=true');
    expect(content).toContain('externalExecutorTouched=false');
    expect(content).toContain('Wave 4B production snapshot verify/repair follow-up:');
    expect(content).toContain('docs/216-wave-4b-low-risk-production-snapshot-verify-repair-executable.md');
    expect(content).toContain('Do not advance beyond the low-risk production snapshot verify/repair executable');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the 214 handoff for 215', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/215-wave-4b-low-risk-native-registry-reconciliation-commit-executable.md');
    expect(read(PAUSE_DOC)).toContain('`215` is the second Wave 4B low-risk executable');
    expect(read(PRIOR_DOC)).toContain('Wave 4B low-risk native registry reconciliation commit follow-up:');
    expect(read(PRIOR_DOC)).toContain('docs/215-wave-4b-low-risk-native-registry-reconciliation-commit-executable.md');
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond the low-risk native registry reconciliation commit');
    expect(read(PRIOR_TEST)).toContain('docs/215-wave-4b-low-risk-native-registry-reconciliation-commit-executable.md');
  });

  it('exports the reconciliation commit executable boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4BRegistryReconciliationCommitReceipt/v1');
    expect(boundary).toContain('ZavorthWave4BRegistryReconciliationCommittedUpdate/v1');
    expect(boundary).toContain('ZavorthWave4BRegistryReconciliationRollbackReceipt/v1');
    expect(index).toContain("from './ZavorthWave4BLowRiskNativeRegistryReconciliationCommitExecutable.js'");
    expect(index).toContain('ZAVORTH_WAVE4B_LOW_RISK_NATIVE_REGISTRY_RECONCILIATION_COMMIT_EXECUTABLE_RUNTIME_ID');
  });

  it('blocks execution when the feature flag is disabled', () => {
    const executable = createZavorthWave4BLowRiskNativeRegistryReconciliationCommitExecutableFixture();
    const receipt = executable.execute({
      productionRoot: root,
      featureFlag: createZavorthWave4BRegistryReconciliationCommitFeatureFlag(false),
      diffPlan: [createZavorthWave4BRegistryReconciliationDiffInput()],
    });

    expect(receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4BRegistryReconciliationCommitReceipt/v1',
      decision: 'execution-blocked',
      classification: 'execution-blocked',
      validations: ['feature-flag-disabled'],
      wave4bRegistryReconciliationCommitExecutableCreated: true,
      selectedLowRiskCapabilityConfirmed: 'native-registry-reconciliation-commit-action',
      registryReconciliationCommitActuallyExecutedOnlyWhenFlagEnabled: true,
      runtimeExternalExecutorRequiredForExecution: false,
      externalExecutorTouched: false,
      rawSecretSerialized: false,
    }));
    expect(receipt.writes.every((write) => write.status === 'blocked')).toBe(true);
    expect(fs.existsSync(root)).toBe(false);
    assertNoRawSecret(JSON.stringify(receipt));
  });

  it('executes controlled reconciliation commit into Zavorth-owned registry storage when flag is enabled', () => {
    const executable = createZavorthWave4BLowRiskNativeRegistryReconciliationCommitExecutableFixture();
    const receipt = executable.execute({
      productionRoot: root,
      featureFlag: createZavorthWave4BRegistryReconciliationCommitFeatureFlag(true),
      diffPlan: [createZavorthWave4BRegistryReconciliationDiffInput()],
    });
    const write = receipt.writes[0];
    const persisted = JSON.parse(fs.readFileSync(path.join(root, write.relativePath), 'utf8')) as ZavorthWave4BRegistryReconciliationCommittedUpdate;

    expect(receipt).toEqual(expect.objectContaining({
      decision: 'reconciliation-commit-ok',
      classification: 'reconciliation-commit-ok',
      validations: ['valid'],
      selectedLowRiskCapabilityConfirmed: 'native-registry-reconciliation-commit-action',
      registryReconciliationCommitActuallyExecutedOnlyWhenFlagEnabled: true,
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
    expect(write).toEqual(expect.objectContaining({
      registryKind: 'capability-registry',
      dataClass: 'capability-metadata',
      status: 'written',
      atomicWriteUsed: true,
      registryReconciliationCommitActuallyExecuted: true,
      rawSecretSerialized: false,
    }));
    expect(persisted).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4BRegistryReconciliationCommittedUpdate/v1',
      selectedLowRiskCapability: 'native-registry-reconciliation-commit-action',
      registryKind: 'capability-registry',
      dataClass: 'capability-metadata',
      operation: 'upsert',
      registryReconciliationCommitActuallyExecutedOnlyWhenFlagEnabled: true,
      runtimeExternalExecutorRequiredForExecution: false,
      externalExecutorTouched: false,
      rawSecretSerialized: false,
    }));
    expect(persisted.safeMetadata).toEqual({
      label: 'Zavorth capability registry reconciliation',
      recordDelta: 1,
      status: 'available',
    });
    expect(fs.existsSync(receipt.manifestPath)).toBe(true);
    expect(fs.existsSync(receipt.backupManifestPath)).toBe(true);
    assertNoRawSecret(JSON.stringify(receipt));
    listJsonFiles(root).forEach((file) => assertNoRawSecret(fs.readFileSync(file, 'utf8')));
  });

  it('validates schema, checksum, idempotency, redaction, policy, and scope', () => {
    const corrupt = createZavorthWave4BRegistryReconciliationDiffInput({
      checksum: '0'.repeat(64),
      idempotencyKey: 'invalid-idempotency',
    });
    const receipt = createZavorthWave4BLowRiskNativeRegistryReconciliationCommitExecutableFixture().execute({
      productionRoot: root,
      featureFlag: createZavorthWave4BRegistryReconciliationCommitFeatureFlag(true),
      diffPlan: [corrupt],
    });

    expect(receipt.decision).toBe('reconciliation-commit-corrupt');
    expect(receipt.validations).toEqual(expect.arrayContaining(['checksum-invalid', 'idempotency-invalid']));
    expect(receipt.writes.every((write) => write.status === 'blocked')).toBe(true);
    expect(fs.existsSync(root)).toBe(false);
  });

  it('rejects diffs that contain raw secrets without serializing them in the receipt', () => {
    const rawSecretDiff = createZavorthWave4BRegistryReconciliationDiffInput({
      payload: {
        label: 'unsafe diff',
        rawSecretValue: 'synthetic-raw-credential-sentinel-that-must-not-appear',
        recordDelta: 1,
      },
    });
    const receipt = createZavorthWave4BLowRiskNativeRegistryReconciliationCommitExecutableFixture().execute({
      productionRoot: root,
      featureFlag: createZavorthWave4BRegistryReconciliationCommitFeatureFlag(true),
      diffPlan: [rawSecretDiff],
    });

    expect(receipt.decision).toBe('reconciliation-commit-rejected');
    expect(receipt.validations).toEqual(expect.arrayContaining(['raw-secret-detected', 'redaction-invalid']));
    expect(receipt.plan[0].payloadSummary).toBe('redacted upsert for capability-registry/capability-metadata');
    expect(receipt.writes.every((write) => write.status === 'blocked')).toBe(true);
    assertNoRawSecret(JSON.stringify(receipt));
  });

  it('rejects diffs outside metadata/registry-level scope', () => {
    const outOfScope = createZavorthWave4BRegistryReconciliationDiffInput({
      dataClass: 'message-content',
      scope: 'out-of-scope',
    });
    const receipt = createZavorthWave4BLowRiskNativeRegistryReconciliationCommitExecutableFixture().execute({
      productionRoot: root,
      featureFlag: createZavorthWave4BRegistryReconciliationCommitFeatureFlag(true),
      diffPlan: [outOfScope],
    });

    expect(receipt.decision).toBe('reconciliation-commit-rejected');
    expect(receipt.validations).toContain('scope-invalid');
    expect(receipt.writes.every((write) => write.status === 'blocked')).toBe(true);
  });

  it('supports idempotent re-run without duplicating writes', () => {
    const executable = createZavorthWave4BLowRiskNativeRegistryReconciliationCommitExecutableFixture();
    const diffPlan = [createZavorthWave4BRegistryReconciliationDiffInput()];
    const first = executable.execute({
      productionRoot: root,
      featureFlag: createZavorthWave4BRegistryReconciliationCommitFeatureFlag(true),
      diffPlan,
    });
    const second = executable.execute({
      productionRoot: root,
      featureFlag: createZavorthWave4BRegistryReconciliationCommitFeatureFlag(true),
      diffPlan,
    });

    expect(first.decision).toBe('reconciliation-commit-ok');
    expect(first.writes[0].status).toBe('written');
    expect(second.decision).toBe('reconciliation-commit-ok');
    expect(second.writes[0].status).toBe('already-present');
    expect(second.writes[0].idempotencyKey).toBe(first.writes[0].idempotencyKey);
    expect(listJsonFiles(root).filter((file) => file.includes('wave4b-registry-reconciliation')).length).toBeGreaterThanOrEqual(1);
  });

  it('supports rollback and cleanup for the controlled test namespace', () => {
    const executable = createZavorthWave4BLowRiskNativeRegistryReconciliationCommitExecutableFixture();
    const receipt = executable.execute({
      productionRoot: root,
      featureFlag: createZavorthWave4BRegistryReconciliationCommitFeatureFlag(true),
      diffPlan: [createZavorthWave4BRegistryReconciliationDiffInput()],
    });
    const write = receipt.writes[0];
    expect(fs.existsSync(path.join(root, write.relativePath))).toBe(true);

    const rollback = executable.rollback(root, receipt);

    expect(rollback).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4BRegistryReconciliationRollbackReceipt/v1',
      outcome: 'rollback-applied',
      rollbackApplied: true,
      runtimeExternalExecutorRequiredForExecution: false,
      externalExecutorTouched: false,
      stateMigrated: false,
      rawSecretSerialized: false,
    }));
    expect(rollback.removedRelativePaths).toContain(write.relativePath);
    expect(fs.existsSync(path.join(root, write.relativePath))).toBe(false);

    const cleanup = executable.cleanup(root);
    expect(cleanup).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4BRegistryReconciliationCleanupReceipt/v1',
      cleanupActuallyPerformed: true,
      namespaceExistsAfterCleanup: false,
      cleanupLimitedToControlledTestNamespace: true,
      externalExecutorTouched: false,
      stateMigrated: false,
      sourceModuleCopied: false,
      rawSecretSerialized: false,
    }));
  });

  it('rejects high-impact attempts and ExternalExecutor touch attempts without granting execution authority', () => {
    const receipt = createZavorthWave4BLowRiskNativeRegistryReconciliationCommitExecutableFixture({
      messageSendAttempted: true,
      providerExecutionAttempted: true,
      toolCommandExecutionAttempted: true,
      externalExecutorTouched: true,
    }).execute({
      productionRoot: root,
      featureFlag: createZavorthWave4BRegistryReconciliationCommitFeatureFlag(true),
      diffPlan: [createZavorthWave4BRegistryReconciliationDiffInput()],
    });

    expect(receipt.decision).toBe('reconciliation-commit-rejected');
    expect(receipt.validations).toEqual(expect.arrayContaining([
      'high-impact-execution-attempted',
      'external-executor-touch-attempted',
    ]));
    expect(receipt.externalExecutorTouched).toBe(false);
    expect(receipt.messageSendRealAllowed).toBe(false);
    expect(receipt.providerExecutionRealAllowed).toBe(false);
    expect(receipt.toolCommandExecutionRealAllowed).toBe(false);
    expect(receipt.externalExecutorMutationAllowed).toBe(false);
    expect(receipt.writes.every((write) => write.status === 'blocked')).toBe(true);
  });

  it('keeps required safety guarantees false for high-impact execution, state migration, source copy, and raw secrets', () => {
    const receipt = createZavorthWave4BLowRiskNativeRegistryReconciliationCommitExecutableFixture().execute({
      productionRoot: root,
      featureFlag: createZavorthWave4BRegistryReconciliationCommitFeatureFlag(true),
      diffPlan: [createZavorthWave4BRegistryReconciliationDiffInput()],
    });
    const serialized = JSON.stringify(receipt);

    expect(receipt).toEqual(expect.objectContaining({
      wave4bRegistryReconciliationCommitExecutableCreated: true,
      selectedLowRiskCapabilityConfirmed: 'native-registry-reconciliation-commit-action',
      registryReconciliationCommitActuallyExecutedOnlyWhenFlagEnabled: true,
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
});
