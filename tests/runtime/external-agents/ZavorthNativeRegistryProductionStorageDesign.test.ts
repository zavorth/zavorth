import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
  ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI,
  ZAVORTH_NATIVE_REGISTRY_PRODUCTION_STORAGE_ROOT_PREVIEW,
  createZavorthNativeRegistryProductionStorageDesignFixtureSource,
  normalizeZavorthNativeRegistryProductionStorageDesign,
  normalizeZavorthNativeRegistryProductionStorageDesignFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthNativeRegistryProductionStorageDesignSource,
  ZavorthNativeRegistryProductionStorageDesignNormalization,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/197-wave-3-native-registry-production-storage-design.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const RESTORE_DOC = 'docs/196-wave-3-native-registry-sandbox-restore-load-path.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthNativeRegistryProductionStorageDesign.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);
let defaultSource: ZavorthNativeRegistryProductionStorageDesignSource;

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function normalizeWithSourceOverride(overrides: Parameters<typeof createZavorthNativeRegistryProductionStorageDesignFixtureSource>[0]) {
  return normalizeZavorthNativeRegistryProductionStorageDesign({
    generatedAt: '2026-04-29T06:00:00.000Z',
    runtimeId: 'zavorth-native-registry-production-storage-design-test',
    idPrefix: 'zavorth-native-registry-production-storage-design-test',
    source: {
      ...defaultSource,
      ...overrides,
    },
  });
}

describe('Zavorth native registry production storage design', () => {
  let defaultNormalization: ZavorthNativeRegistryProductionStorageDesignNormalization;

  beforeAll(() => {
    defaultSource = createZavorthNativeRegistryProductionStorageDesignFixtureSource();
    defaultNormalization = normalizeZavorthNativeRegistryProductionStorageDesign({
      generatedAt: '2026-04-29T06:00:00.000Z',
      runtimeId: 'zavorth-native-registry-production-storage-design-test-default',
      idPrefix: 'zavorth-native-registry-production-storage-design-test-default',
      source: defaultSource,
    });
  });

  it('documents 197 as the production storage design gate', () => {
    const content = read(DOC);

    expect(content).toContain('Status: native-registry-production-storage-design-ready');
    expect(content).toContain('docs/194-wave-3-native-registry-persistence-dry-run.md');
    expect(content).toContain('docs/195-wave-3-native-registry-sandbox-persistence.md');
    expect(content).toContain('docs/196-wave-3-native-registry-sandbox-restore-load-path.md');
    expect(content).toContain('ZavorthNativeRegistryProductionStorageDesign/v1');
    expect(content).toContain('ZavorthNativeRegistryProductionStoragePlan/v1');
    expect(content).toContain('ZavorthNativeRegistryProductionAtomicWriteStrategy/v1');
    expect(content).toContain('ZavorthNativeRegistryProductionBackupRollbackStrategy/v1');
    expect(content).toContain('zavorth-owned-native-registry-production');
    expect(content).toContain('productionWriteActuallyPerformed=false');
    expect(content).toContain('native registry production persistence flagged follow-up: docs/198-wave-3-native-registry-production-persistence-flagged.md');
    expect(content).toContain('Do not');
    expect(content).toContain('`199`');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('updates tracking docs and prior restore/load gate for 197', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/197-wave-3-native-registry-production-storage-design.md');
    expect(read(PAUSE_DOC)).toContain('`197` is the native registry production storage design');
    expect(read(RESTORE_DOC)).toContain('native registry production storage design follow-up: docs/197-wave-3-native-registry-production-storage-design.md');
    expect(read(RESTORE_DOC)).toContain('Do not');
    expect(read(RESTORE_DOC)).toContain('`198`');
  });

  it('exports the production storage design boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthNativeRegistryProductionStorageDesign/v1');
    expect(boundary).toContain('ZavorthNativeRegistryProductionStoragePlan/v1');
    expect(boundary).toContain('normalizeZavorthNativeRegistryProductionStorageDesignFixture');
    expect(index).toContain("from './ZavorthNativeRegistryProductionStorageDesign.js'");
    expect(index).toContain('ZavorthNativeRegistryProductionStoragePlan');
    expect(index).toContain('ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE');
  });

  it('produces a valid Zavorth-owned production storage plan without production writes', () => {
    const normalization = defaultNormalization;

    expect(normalization).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthNativeRegistryProductionStorageDesign/v1',
      decision: 'native-registry-production-storage-design-ready',
      status: 'native-registry-production-storage-design-ready',
      nextGateRecommended: 'future-native-registry-production-storage-dry-run-or-controlled-commit-gate',
    }));
    expect(normalization.plan).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthNativeRegistryProductionStoragePlan/v1',
      productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
      productionNamespaceUri: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI,
      productionStorageRootPreview: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_STORAGE_ROOT_PREVIEW,
      productionStorageDesignCreated: true,
      productionWriteActuallyPerformed: false,
      runtimeExternalExecutorRequiredForProductionLookup: false,
      runtimeExternalExecutorRequiredForProductionRender: false,
      rawSecretSerialized: false,
      adapterRemovalAllowed: false,
    }));
    expect(normalization.plan.snapshots).toHaveLength(5);
    expect(normalization.plan.validationStatuses).toEqual(['valid']);
    expect(normalization.receipt.productionWriteActuallyPerformed).toBe(false);
  });

  it('defines manifest, schema, checksum, idempotency, atomic write, lock, backup, rollback, restore, and cleanup strategy', () => {
    const normalization = defaultNormalization;

    expect(normalization.plan.manifest).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthNativeRegistryProductionManifestPlan/v1',
      schemaVersion: 'zavorth-native-registry-persistence/v1',
      checksumAlgorithm: 'sha256-stable-metadata',
      idempotencyStrategy: 'content-addressed-idempotency-key',
      atomicWriteStrategy: 'write-temp-fsync-rename',
      redactionEnvelopeRequired: true,
      productionWriteActuallyPerformed: false,
    }));
    normalization.plan.snapshots.forEach((snapshot) => {
      expect(snapshot.productionPathPreview).toContain('.zavorth/native-registries/production/v1/native-registries/');
      expect(snapshot.contentChecksum).toMatch(/^[a-f0-9]{64}$/);
      expect(snapshot.idempotencyKey).toMatch(/^[a-f0-9]{32}$/);
      expect(snapshot.atomicWrite).toEqual(expect.objectContaining({
        strategy: 'write-temp-fsync-rename',
        manifestCommitOrder: 'snapshots-before-manifest',
        lockRequired: true,
        productionWriteActuallyPerformed: false,
      }));
      expect(snapshot.lock).toEqual(expect.objectContaining({
        lockScope: 'namespace-manifest',
        lockMode: 'exclusive-single-writer',
        lockActuallyAcquired: false,
      }));
      expect(snapshot.backupRollback).toEqual(expect.objectContaining({
        backupBeforeCommitRequired: true,
        restoreLoadValidationRequired: true,
        rollbackOnPartialCommitRequired: true,
        backupActuallyCreated: false,
        restoreActuallyPerformed: false,
      }));
    });
    expect(normalization.plan.retentionCleanup).toEqual(expect.objectContaining({
      keepLatestManifests: 5,
      keepLatestSnapshotsPerRegistry: 3,
      cleanupRequiresVerifiedBackup: true,
      cleanupDeletesOnlyZavorthOwnedNamespace: true,
      cleanupActuallyPerformed: false,
    }));
  });

  it('requires a redaction envelope for every production snapshot', () => {
    const normalization = defaultNormalization;

    expect(normalization.redaction).toEqual(expect.objectContaining({
      redactionEnvelopeRequired: true,
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
    }));
    normalization.plan.snapshots.forEach((snapshot) => {
      expect(snapshot.redactionEnvelopeRequired).toBe(true);
      expect(snapshot.redactionEnvelope).toEqual(expect.objectContaining({
        rawSecretSerialized: false,
        rawMessageContentSerialized: false,
        sourceIdentityPublic: false,
        provenanceInternalOnly: true,
        safeMetadataOnly: true,
      }));
    });
  });

  it('rejects raw secret payload attempts without serializing the secret', () => {
    const normalization = normalizeWithSourceOverride({ rawSecretSerialized: true });
    const serialized = JSON.stringify(normalization);

    expect(normalization.decision).toBe('blocked');
    expect(normalization.plan.validationStatuses).toContain('raw-secret-blocked');
    expect(normalization.receipt.rawSecretSerialized).toBe(false);
    expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
    expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  });

  it('rejects missing redaction envelope requirements', () => {
    const normalization = normalizeWithSourceOverride({ redactionEnvelopeRequired: false });

    expect(normalization.decision).toBe('blocked');
    expect(normalization.plan.validationStatuses).toContain('redaction-envelope-missing');
    expect(normalization.plan.productionWriteActuallyPerformed).toBe(false);
  });

  it('rejects invalid schema versions before any production write', () => {
    const normalization = normalizeZavorthNativeRegistryProductionStorageDesign({
      generatedAt: '2026-04-29T06:00:00.000Z',
      runtimeId: 'zavorth-native-registry-production-storage-design-schema-test',
      idPrefix: 'zavorth-native-registry-production-storage-design-schema-test',
      source: defaultSource,
      schemaVersionOverride: 'zavorth-native-registry-persistence/v0',
    });

    expect(normalization.decision).toBe('blocked');
    expect(normalization.plan.validationStatuses).toContain('schema-invalid');
    expect(normalization.plan.productionWriteActuallyPerformed).toBe(false);
    expect(normalization.receipt.productionWriteActuallyPerformed).toBe(false);
  });

  it('blocks production write attempts and ExternalExecutor-required lookup/render', () => {
    const normalization = normalizeWithSourceOverride({
      externalExecutorRequiredForLookupOrRender: true,
      productionWriteAttempted: true,
      sourceRuntimeAuthority: true,
    });

    expect(normalization.decision).toBe('blocked');
    expect(normalization.plan.validationStatuses).toEqual(expect.arrayContaining([
      'production-write-attempted',
      'source-not-ready',
    ]));
    expect(normalization.plan.productionWriteActuallyPerformed).toBe(false);
    expect(normalization.plan.runtimeExternalExecutorRequiredForProductionLookup).toBe(false);
    expect(normalization.plan.runtimeExternalExecutorRequiredForProductionRender).toBe(false);
  });

  it('lets Command Center point to future production-loaded registries without ExternalExecutor live', () => {
    const normalization = defaultNormalization;

    expect(normalization.plan.commandCenterConsumption).toEqual(expect.objectContaining({
      commandCenterProductionLoadedRegistryPointer: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI,
      defaultLookupPath: 'production-loaded-native-registry',
      defaultRenderPath: 'production-loaded-native-registry',
      adapterRefreshAllowedExplicitly: true,
      runtimeExternalExecutorRequiredForProductionLookup: false,
      runtimeExternalExecutorRequiredForProductionRender: false,
      publicSourceIdentityExposed: false,
    }));
    expect(normalization.plan.refreshReconciliation).toEqual(expect.objectContaining({
      defaultRefreshMode: 'manual',
      refreshSourceRole: 'optional-refresh-source',
      reconciliationFrom193RequiredBeforeCommit: true,
      dryRunDiffRequiredBeforeCommit: true,
      productionCommitRequiresFutureGate: true,
      externalExecutorRequiredForLookupOrRender: false,
    }));
    expect(normalization.plan.refreshReconciliation.refreshModes).toEqual([
      'disabled',
      'manual',
      'scheduled-future',
      'live-adapter-optional',
      'blocked',
    ]);
  });

  it('keeps execution, migration, source copy, and adapter removal blocked', () => {
    const normalization = defaultNormalization;

    expect(normalization.executionGate).toEqual(expect.objectContaining({
      productionStorageDesignCreated: true,
      productionWriteActuallyPerformed: false,
      runtimeExternalExecutorRequiredForProductionLookup: false,
      runtimeExternalExecutorRequiredForProductionRender: false,
      sourceRuntimeAuthority: false,
      stateMigrated: false,
      sourceFileCopied: false,
      sourceDbCopied: false,
      sourceDbOpenedForWrite: false,
      executionAuthority: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      rawSecretSerialized: false,
      adapterRemovalAllowed: false,
    }));
    normalization.plan.snapshots.forEach((snapshot) => {
      expect(snapshot.migrationGuardrails).toEqual(expect.objectContaining({
        stateMigrated: false,
        sourceFileCopied: false,
        sourceDbCopied: false,
        sourceDbOpenedForWrite: false,
        externalExecutorLiveRequiredForLookup: false,
        externalExecutorLiveRequiredForRender: false,
        sourceRuntimeAuthority: false,
        adapterRemovalAllowed: false,
      }));
    });
  });
});
