import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
  createZavorthNativeDashboardViewModelRegistryFixture,
  createZavorthNativeRegistryPersistenceDryRunFixture,
  normalizeZavorthNativeRegistryPersistenceDryRunFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthNativeRegistryPersistenceDryRunNormalization,
  ZavorthNativeRegistryPersistenceKind,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/194-wave-3-native-registry-persistence-dry-run.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const REFRESH_DOC = 'docs/193-wave-3-native-registry-refresh-reconciliation-design.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthNativeRegistryPersistenceDryRun.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Zavorth native registry persistence dry-run', () => {
  let normalized: ZavorthNativeRegistryPersistenceDryRunNormalization;

  beforeAll(() => {
    normalized = normalizeZavorthNativeRegistryPersistenceDryRunFixture();
  });

  it('documents 194 as the native registry persistence dry-run gate', () => {
    const content = read(DOC);

    expect(content).toContain('Status: native-registry-persistence-dry-run-ready');
    expect(content).toContain('ZavorthNativeRegistryPersistenceDryRun/v1');
    expect(content).toContain('ZavorthNativeRegistryPersistencePlan/v1');
    expect(content).toContain('ZavorthNativeRegistryPersistenceSnapshot/v1');
    expect(content).toContain('ZavorthNativeRegistryPersistenceRedactionEnvelope/v1');
    expect(content).toContain('ZavorthNativeRegistryPersistenceRollbackMetadata/v1');
    expect(content).toContain('ZavorthNativeRegistryPersistenceReceipt/v1');
    expect(content).toContain('docs/185-wave-3-first-native-capability-registry-replacement-slice.md');
    expect(content).toContain('docs/186-wave-3-dashboard-view-model-registry-native-slice.md');
    expect(content).toContain('docs/187-wave-3-provider-channel-transport-native-registry.md');
    expect(content).toContain('docs/188-wave-3-session-history-native-registry.md');
    expect(content).toContain('docs/189-wave-3-config-secrets-state-native-registry.md');
    expect(content).toContain('docs/193-wave-3-native-registry-refresh-reconciliation-design.md');
    expect(content).toContain('nativeRegistryPersistenceMode=dry-run');
    expect(content).toContain('persistentWriteActuallyPerformed=false');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('updates tracking docs and prior refresh gate for 194', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/194-wave-3-native-registry-persistence-dry-run.md');
    expect(read(PAUSE_DOC)).toContain('`194` is the native registry persistence dry-run gate');
    expect(read(REFRESH_DOC)).toContain('native registry persistence dry-run follow-up: docs/194-wave-3-native-registry-persistence-dry-run.md');
    expect(read(REFRESH_DOC)).toContain('Do not');
    expect(read(REFRESH_DOC)).toContain('`195`');
  });

  it('exports the persistence dry-run boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthNativeRegistryPersistenceDryRun/v1');
    expect(boundary).toContain('ZavorthNativeRegistryPersistenceDryRun');
    expect(boundary).toContain('normalizeZavorthNativeRegistryPersistenceDryRun');
    expect(index).toContain("from './ZavorthNativeRegistryPersistenceDryRun.js'");
    expect(index).toContain('ZavorthNativeRegistryPersistenceDryRunNormalization');
  });

  it('normalizes all native registries into dry-run persistence snapshots', () => {
    const kinds = normalized.plan.snapshots.map((snapshot) => snapshot.registryKind);

    expect(normalized.decision).toBe('native-registry-persistence-dry-run-ready');
    expect(normalized.sourceReadiness).toEqual({
      nativeCapabilityRegistry: 'native-capability-registry-replacement-ready',
      nativeDashboardViewModelRegistry: 'native-dashboard-view-model-registry-ready',
      nativeIntegrationRegistry: 'native-integration-registry-ready',
      nativeSessionHistoryRegistry: 'native-session-history-registry-ready',
      nativeConfigStateRegistry: 'native-config-state-registry-ready',
      refreshReconciliation: 'native-registry-refresh-reconciliation-ready',
    });
    expect(kinds).toEqual(expect.arrayContaining([
      'capability-registry',
      'dashboard-view-model-registry',
      'integration-registry',
      'session-history-registry',
      'config-state-registry',
    ] satisfies ZavorthNativeRegistryPersistenceKind[]));
    expect(normalized.plan.snapshots).toHaveLength(5);
  });

  it('produces schema version, checksum, and idempotency metadata for every snapshot', () => {
    normalized.plan.snapshots.forEach((snapshot) => {
      expect(snapshot.schemaVersion).toBe(ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION);
      expect(snapshot.schemaName).toMatch(/^ZavorthNative.*RegistrySnapshot$/);
      expect(snapshot.snapshotVersion).toBe('dry-run');
      expect(snapshot.checksumAlgorithm).toBe('sha256-stable-metadata');
      expect(snapshot.contentChecksum).toMatch(/^[a-f0-9]{64}$/);
      expect(snapshot.idempotencyKey).toMatch(/^[a-f0-9]{32}$/);
      expect(snapshot.storageTarget).toBe('zavorth-native-registry-store');
      expect(snapshot.storagePathPreview).toContain(snapshot.idempotencyKey);
      expect(snapshot.payloadIncludedInDryRun).toBe(false);
      expect(snapshot.recordCount).toBeGreaterThan(0);
    });
    expect(normalized.plan.allChecksumsPresent).toBe(true);
    expect(normalized.plan.allIdempotencyKeysPresent).toBe(true);
  });

  it('generates redaction envelopes and blocks raw secret or raw message payloads', () => {
    normalized.plan.snapshots.forEach((snapshot) => {
      expect(snapshot.redactionEnvelope).toEqual(expect.objectContaining({
        rawSecretSerialized: false,
        rawMessageContentSerialized: false,
        sourceIdentityPublic: false,
        provenanceInternalOnly: true,
        safeMetadataOnly: true,
      }));
      expect(snapshot.redactionEnvelope.forbiddenFields).toEqual(expect.arrayContaining([
        'rawSecretValue',
        'rawToken',
        'rawApiKey',
        'authorizationHeader',
        'credentialedUrl',
        'rawMessageContent',
        'sourceDbContent',
      ]));
      expect(snapshot.rawSecretSerialized).toBe(false);
    });
  });

  it('generates rollback and restore metadata without creating backups or restores', () => {
    normalized.plan.snapshots.forEach((snapshot) => {
      expect(snapshot.rollback).toEqual({
        nativeContract: 'ZavorthNativeRegistryPersistenceRollbackMetadata/v1',
        backupManifestPlanned: true,
        restoreManifestPlanned: true,
        rollbackReceiptPlanned: true,
        backupActuallyCreated: false,
        restoreActuallyPerformed: false,
        checksumRequiredBeforeCommit: true,
        rollbackRequiredBeforeFutureMutation: true,
      });
    });
  });

  it('creates an audit receipt without persistent writes or ExternalExecutor live requirements', () => {
    expect(normalized.receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthNativeRegistryPersistenceReceipt/v1',
      mode: 'dry-run',
      snapshotCount: 5,
      writePlannedForFutureGate: true,
      persistentWriteActuallyPerformed: false,
      receiptRedacted: true,
      runtimeExternalExecutorRequiredForPersistencePlan: false,
      stateMigrated: false,
      sourceFileCopied: false,
      sourceDbCopied: false,
      sourceDbOpenedForWrite: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      rawSecretSerialized: false,
    }));
    expect(normalized.receipt.checksums).toHaveLength(5);
    normalized.receipt.checksums.forEach((row) => {
      expect(row.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(row.idempotencyKey).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  it('preserves Command Center/native lookup independence from ExternalExecutor', () => {
    const dashboardRegistry = createZavorthNativeDashboardViewModelRegistryFixture();
    const render = dashboardRegistry.render();
    const persistence = createZavorthNativeRegistryPersistenceDryRunFixture();
    const dashboardSnapshot = persistence.lookupSnapshot('dashboard-view-model-registry');

    expect(render.rows.length).toBeGreaterThan(0);
    expect(render.runtimeExternalExecutorRequiredForDashboardRender).toBe(false);
    expect(render.runtimeExternalExecutorRequiredForDashboardViewLookup).toBe(false);
    expect(dashboardSnapshot).toEqual(expect.objectContaining({
      registryKind: 'dashboard-view-model-registry',
      runtimeExternalExecutorRequiredForPersistencePlan: false,
      persistentWriteActuallyPerformed: false,
    }));
    expect(normalized.commandCenterNativeLookupPreserved).toBe(true);
  });

  it('keeps the required dry-run/no-write guarantees closed', () => {
    expect(normalized.executionGate).toEqual({
      nativeRegistryPersistenceMode: 'dry-run',
      persistentWriteActuallyPerformed: false,
      stateMigrated: false,
      sourceFileCopied: false,
      sourceDbCopied: false,
      sourceDbOpenedForWrite: false,
      runtimeExternalExecutorRequiredForPersistencePlan: false,
      sourceRuntimeAuthority: false,
      executionAuthority: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      rawSecretSerialized: false,
      adapterRemovalAllowed: false,
    });
    expect(normalized.plan.persistentWriteActuallyPerformed).toBe(false);
    expect(normalized.plan.runtimeExternalExecutorRequiredForPersistencePlan).toBe(false);
    expect(normalized.plan.adapterRemovalAllowed).toBe(false);
  });

  it('does not serialize raw secrets or sensitive payloads', () => {
    const serialized = JSON.stringify(normalized);

    expect(normalized.redaction).toEqual({
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
    expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
    expect(normalized.nextGateRecommended).toBe('future-native-registry-persistence-commit-gate');
  });
});
