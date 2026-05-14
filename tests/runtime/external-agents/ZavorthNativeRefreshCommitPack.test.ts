import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_NATIVE_REFRESH_COMMIT_FLAG,
  ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
  createZavorthNativeRefreshCommitFeatureFlag,
  createZavorthNativeRefreshCommitPackFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthNativeRefreshCommitPlanOutcome,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/202-wave-3-native-refresh-commit-pack.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const CONSOLIDATION_DOC = 'docs/201-wave-3-native-absorption-consolidation-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthNativeRefreshCommitPack.ts';
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
    'zavorth-native-refresh-commit-pack-test',
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

describe('Wave 3 native refresh commit pack', () => {
  const root = productionRoot();
  const pack = createZavorthNativeRefreshCommitPackFixture();

  function cleanupRoot(): void {
    if (fs.existsSync(root)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }

  beforeEach(cleanupRoot);

  afterEach(cleanupRoot);

  it('documents 202 as a single native refresh commit pack', () => {
    const content = read(DOC);

    expect(content).toContain('Status: native-refresh-commit-ready');
    expect(content).toContain('ZavorthNativeRefreshCommitPack.ts');
    expect(content).toContain('ZavorthNativeRefreshCommitFeatureFlagGate/v1');
    expect(content).toContain('ZavorthNativeRefreshCommitPlanItem/v1');
    expect(content).toContain('ZavorthNativeRefreshCommittedRegistryUpdate/v1');
    expect(content).toContain('ZavorthNativeRefreshCommitReceipt/v1');
    expect(content).toContain(ZAVORTH_NATIVE_REFRESH_COMMIT_FLAG);
    expect(content).toContain('nativeRefreshCommitPackCreated=true');
    expect(content).toContain('refreshCommitFeatureFlagRequired=true');
    expect(content).toContain('registryMutationCommittedOnlyWhenFlagEnabled=true');
    expect(content).toContain('runtimeExternalExecutorRequiredForDefaultLookup=false');
    expect(content).toContain('adapterDefaultPathForNativeReadySurfaces=false');
    expect(content).toContain('externalMutationActuallyPerformed=false');
    expect(content).toContain('partial adapter removal implementation follow-up: docs/203-wave-3-partial-adapter-removal-implementation-pack.md');
    expect(content).toContain('advance beyond the partial adapter removal implementation pack');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and prior consolidation pack for 202', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/202-wave-3-native-refresh-commit-pack.md');
    expect(read(PAUSE_DOC)).toContain('`202` is the Wave 3 native refresh commit pack');
    expect(read(CONSOLIDATION_DOC)).toContain('native refresh commit follow-up: docs/202-wave-3-native-refresh-commit-pack.md');
    expect(read(CONSOLIDATION_DOC)).toContain('advance beyond the native refresh commit pack');
  });

  it('exports the refresh commit pack boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthNativeRefreshCommitPack');
    expect(boundary).toContain('ZavorthNativeRefreshCommitReceipt/v1');
    expect(boundary).toContain('ZavorthNativeRefreshCommittedRegistryUpdate/v1');
    expect(index).toContain("from './ZavorthNativeRefreshCommitPack.js'");
    expect(index).toContain('ZavorthNativeRefreshCommitReceipt');
  });

  it('blocks refresh commit when the feature flag is disabled', () => {
    const receipt = pack.commit({
      productionRoot: root,
      featureFlag: createZavorthNativeRefreshCommitFeatureFlag(false),
    });

    expect(receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthNativeRefreshCommitReceipt/v1',
      decision: 'refresh-commit-blocked',
      nativeRefreshCommitPackCreated: true,
      refreshCommitFeatureFlagRequired: true,
      registryMutationCommittedOnlyWhenFlagEnabled: true,
      runtimeExternalExecutorRequiredForDefaultLookup: false,
      runtimeExternalExecutorRequiredForDefaultRender: false,
      adapterDefaultPathForNativeReadySurfaces: false,
      externalMutationActuallyPerformed: false,
      rawSecretSerialized: false,
    }));
    expect(receipt.validations).toContain('feature-flag-disabled');
    expect(receipt.writes.every((write) => write.status === 'blocked')).toBe(true);
    expect(fs.existsSync(root)).toBe(false);
  });

  it('commits updated diff metadata only to Zavorth-owned registries when the flag is enabled', () => {
    const receipt = pack.commit({
      productionRoot: root,
      featureFlag: createZavorthNativeRefreshCommitFeatureFlag(true),
    });
    const committedWrites = receipt.writes.filter((write) => write.registryMutationCommitted);

    expect(receipt.decision).toBe('native-refresh-commit-ready');
    expect(receipt.validations).toEqual(['valid']);
    expect(committedWrites).toHaveLength(1);
    expect(committedWrites[0]).toEqual(expect.objectContaining({
      surfaceId: 'capability-lookup-classify',
      registryKind: 'capability-registry',
      status: 'written',
      atomicWriteUsed: true,
      rawSecretSerialized: false,
    }));
    expect(fs.existsSync(path.join(root, committedWrites[0].relativePath))).toBe(true);
    expect(fs.existsSync(receipt.manifestPath)).toBe(true);
    expect(fs.existsSync(receipt.backupManifestPath)).toBe(true);
    assertNoRawSecret(root);
  });

  it('validates committed update schema, checksum, idempotency, and redaction envelope', () => {
    const receipt = pack.commit({
      productionRoot: root,
      featureFlag: createZavorthNativeRefreshCommitFeatureFlag(true),
    });
    const write = receipt.writes.find((entry) => entry.registryMutationCommitted);
    expect(write).toBeDefined();

    const payload = JSON.parse(fs.readFileSync(path.join(root, (write as NonNullable<typeof write>).relativePath), 'utf8')) as Record<string, unknown>;

    expect(payload).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthNativeRefreshCommittedRegistryUpdate/v1',
      registryKind: 'capability-registry',
      surfaceId: 'capability-lookup-classify',
      schemaVersion: 'zavorth-native-registry-persistence/v1',
      idempotencyKey: write?.idempotencyKey,
      contentChecksum: write?.contentChecksum,
      registryMutationCommittedOnlyWhenFlagEnabled: true,
      runtimeExternalExecutorRequiredForDefaultLookup: false,
      runtimeExternalExecutorRequiredForDefaultRender: false,
      adapterDefaultPathForNativeReadySurfaces: false,
      externalMutationActuallyPerformed: false,
      rawSecretSerialized: false,
    }));
    expect(payload.redactionEnvelope).toEqual(expect.objectContaining({
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
      safeMetadataOnly: true,
    }));
    expect(write?.contentChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(write?.idempotencyKey).toMatch(/^[a-f0-9]{32}$/);
  });

  it('represents no-change, updated, degraded, conflict, source-unavailable, and rejected-by-policy outcomes', () => {
    const plan = pack.buildPlan();
    const rejected = pack.commit({
      productionRoot: root,
      featureFlag: createZavorthNativeRefreshCommitFeatureFlag(true),
      policyAllowsCommit: false,
    });

    const outcomes = plan.map((item) => item.commitOutcome);
    expect(outcomes).toEqual(expect.arrayContaining([
      'no-change',
      'updated',
      'degraded',
      'conflict',
      'source-unavailable',
    ] satisfies ZavorthNativeRefreshCommitPlanOutcome[]));
    expect(plan.filter((item) => item.riskChangeDetected).every((item) => item.policyApprovalRequired)).toBe(true);
    expect(rejected.decision).toBe('refresh-commit-blocked');
    expect(rejected.validations).toContain('policy-rejected');
    expect(rejected.plan.every((item) => item.commitOutcome === 'rejected-by-policy')).toBe(true);
    expect(rejected.writes.every((write) => !write.registryMutationCommitted)).toBe(true);
  });

  it('keeps Command Center native-first and adapter isolated after commit or refresh failure', () => {
    const committed = pack.commit({
      productionRoot: root,
      featureFlag: createZavorthNativeRefreshCommitFeatureFlag(true),
    });
    const unavailable = pack.commit({
      productionRoot: root,
      featureFlag: createZavorthNativeRefreshCommitFeatureFlag(true),
      optionalSourceAvailable: false,
    });

    [committed, unavailable].forEach((receipt) => {
      expect(receipt.commandCenterConsistency).toEqual({
        nativeContract: 'ZavorthNativeRefreshCommitCommandCenterConsistency/v1',
        commandCenterNativeFirstAfterCommit: true,
        runtimeExternalExecutorRequiredForDefaultLookup: false,
        runtimeExternalExecutorRequiredForDefaultRender: false,
        adapterDefaultPathForNativeReadySurfaces: false,
        adapterRefreshAllowed: true,
        refreshFailureBreaksLookupRender: false,
        productionLoadedNativeFirstDefaultPrepared: true,
        rawSecretSerialized: false,
      });
      expect(receipt.adapterDefaultPathForNativeReadySurfaces).toBe(false);
      expect(receipt.runtimeExternalExecutorRequiredForDefaultLookup).toBe(false);
      expect(receipt.runtimeExternalExecutorRequiredForDefaultRender).toBe(false);
      expect(receipt.adapterRefreshAllowed).toBe(true);
    });
    expect(unavailable.plan.every((item) => item.commitOutcome === 'source-unavailable')).toBe(true);
    expect(unavailable.writes.every((write) => write.status === 'skipped')).toBe(true);
  });

  it('supports rollback for controlled Zavorth-owned registry updates', () => {
    const receipt = pack.commit({
      productionRoot: root,
      featureFlag: createZavorthNativeRefreshCommitFeatureFlag(true),
    });
    const committedWrite = receipt.writes.find((write) => write.registryMutationCommitted);
    expect(committedWrite).toBeDefined();
    expect(fs.existsSync(path.join(root, committedWrite?.relativePath || ''))).toBe(true);

    const rollback = pack.rollback(root, receipt);

    expect(rollback).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthNativeRefreshCommitRollbackReceipt/v1',
      outcome: 'rollback-applied',
      rollbackApplied: true,
      externalMutationActuallyPerformed: false,
      stateMigrated: false,
      rawSecretSerialized: false,
    }));
    expect(rollback.removedRelativePaths).toContain(committedWrite?.relativePath);
    expect(fs.existsSync(path.join(root, committedWrite?.relativePath || ''))).toBe(false);
    assertNoRawSecret(root);
  });

  it('does not serialize raw secrets or grant execution/external mutation authority', () => {
    const receipt = pack.commit({
      productionRoot: root,
      featureFlag: createZavorthNativeRefreshCommitFeatureFlag(true),
    });
    const serialized = JSON.stringify(receipt);

    expect(receipt.messageActuallySent).toBe(false);
    expect(receipt.providerActuallyExecuted).toBe(false);
    expect(receipt.commandActuallyExecuted).toBe(false);
    expect(receipt.toolActuallyExecuted).toBe(false);
    expect(receipt.externalMutationActuallyPerformed).toBe(false);
    expect(receipt.stateMigrated).toBe(false);
    expect(receipt.sourceModuleCopied).toBe(false);
    expect(receipt.rawSecretSerialized).toBe(false);
    expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
    expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{8,}/);
    expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{8,}/);
  });

  it('cleans up the controlled refresh commit namespace', () => {
    pack.commit({
      productionRoot: root,
      featureFlag: createZavorthNativeRefreshCommitFeatureFlag(true),
    });
    expect(fs.existsSync(root)).toBe(true);

    const cleanup = pack.cleanup(root);

    expect(cleanup).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthNativeRefreshCommitCleanupReceipt/v1',
      cleanupActuallyPerformed: true,
      namespaceExistsAfterCleanup: false,
      cleanupLimitedToControlledTestNamespace: true,
      stateMigrated: false,
      sourceModuleCopied: false,
      rawSecretSerialized: false,
    }));
    expect(fs.existsSync(root)).toBe(false);
  });
});
