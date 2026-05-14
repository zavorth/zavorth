import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
  ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI,
  ZAVORTH_NATIVE_REGISTRY_PRODUCTION_WRITE_FLAG,
  createZavorthNativeRegistryProductionPersistenceFeatureFlag,
  createZavorthNativeRegistryProductionPersistenceFlaggedFixture,
  normalizeZavorthNativeRegistryProductionStorageDesign,
  createZavorthNativeRegistryProductionStorageDesignFixtureSource,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthNativeRegistryProductionManifest,
  ZavorthNativeRegistryProductionPersistenceFlaggedSource,
  ZavorthNativeRegistryProductionPersistedSnapshot,
  ZavorthNativeRegistryProductionStorageDesignSource,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/198-wave-3-native-registry-production-persistence-flagged.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const DESIGN_DOC = 'docs/197-wave-3-native-registry-production-storage-design.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthNativeRegistryProductionPersistenceFlagged.ts';
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
    'zavorth-native-registry-production-persistence-flagged-test',
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

let cachedPersistence: ReturnType<typeof createZavorthNativeRegistryProductionPersistenceFlaggedFixture> | undefined;
let cachedDesignSource: ZavorthNativeRegistryProductionStorageDesignSource | undefined;
let cachedSource: ZavorthNativeRegistryProductionPersistenceFlaggedSource | undefined;

function designSourceFixture(): ZavorthNativeRegistryProductionStorageDesignSource {
  cachedDesignSource ??= createZavorthNativeRegistryProductionStorageDesignFixtureSource();
  return cachedDesignSource;
}

function persistenceSourceFixture(
  overrides: Partial<ZavorthNativeRegistryProductionPersistenceFlaggedSource> = {},
): ZavorthNativeRegistryProductionPersistenceFlaggedSource {
  cachedSource ??= {
    design: normalizeZavorthNativeRegistryProductionStorageDesign({
      generatedAt: '2026-04-29T06:00:00.000Z',
      runtimeId: 'zavorth-native-registry-production-persistence-flagged-test-design',
      idPrefix: 'zavorth-native-registry-production-persistence-flagged-test-design',
      source: designSourceFixture(),
    }),
    adapterRetainedAsFallbackRefresh: true,
    rawSecretSerialized: false,
    sourceStateMigrationAttempted: false,
    sourceFileCopyAttempted: false,
    sourceDbCopyAttempted: false,
    sourceDbWriteOpenAttempted: false,
    executionAttempted: false,
    externalExecutorLiveRequiredForProductionWrite: false,
  };
  return {
    ...cachedSource,
    ...overrides,
  };
}

function persistenceFixture(): ReturnType<typeof createZavorthNativeRegistryProductionPersistenceFlaggedFixture> {
  cachedPersistence ??= createZavorthNativeRegistryProductionPersistenceFlaggedFixture(persistenceSourceFixture());
  return cachedPersistence;
}

describe('Zavorth native registry production persistence flagged', () => {
  const root = productionRoot();

  beforeEach(() => {
    const persistence = persistenceFixture();
    if (fs.existsSync(root)) {
      persistence.cleanup(root);
    }
  });

  afterEach(() => {
    const persistence = persistenceFixture();
    if (fs.existsSync(root)) {
      persistence.cleanup(root);
    }
  });

  it('documents 198 as the flagged production persistence gate', () => {
    const content = read(DOC);

    expect(content).toContain('Status: native-registry-production-persistence-ready');
    expect(content).toContain('docs/197-wave-3-native-registry-production-storage-design.md');
    expect(content).toContain('ZavorthNativeRegistryProductionFeatureFlagGate/v1');
    expect(content).toContain('ZavorthNativeRegistryProductionPersistedSnapshot/v1');
    expect(content).toContain('ZavorthNativeRegistryProductionPersistenceReceipt/v1');
    expect(content).toContain(ZAVORTH_NATIVE_REGISTRY_PRODUCTION_WRITE_FLAG);
    expect(content).toContain('productionPersistenceFeatureFlagRequired=true');
    expect(content).toContain('productionWriteActuallyPerformedOnlyWhenFlagEnabled=true');
    expect(content).toContain('production restore/load Command Center native-first follow-up: docs/199-wave-3-production-restore-load-command-center-native-first.md');
    expect(content).toContain('Do not');
    expect(content).toContain('`200`');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('updates tracking docs and prior production storage design gate for 198', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/198-wave-3-native-registry-production-persistence-flagged.md');
    expect(read(PAUSE_DOC)).toContain('`198` is the flagged native registry production persistence gate');
    expect(read(DESIGN_DOC)).toContain('native registry production persistence flagged follow-up: docs/198-wave-3-native-registry-production-persistence-flagged.md');
    expect(read(DESIGN_DOC)).toContain('Do not');
    expect(read(DESIGN_DOC)).toContain('`199`');
  });

  it('exports the flagged production persistence boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthNativeRegistryProductionPersistenceFlagged');
    expect(boundary).toContain('ZavorthNativeRegistryProductionPersistenceReceipt/v1');
    expect(boundary).toContain('ZavorthNativeRegistryProductionLoadReceipt/v1');
    expect(boundary).toContain('ZavorthNativeRegistryProductionCleanupReceipt/v1');
    expect(index).toContain("from './ZavorthNativeRegistryProductionPersistenceFlagged.js'");
    expect(index).toContain('ZAVORTH_NATIVE_REGISTRY_PRODUCTION_WRITE_FLAG');
  });

  it('blocks production writes when the feature flag is disabled', () => {
    const persistence = persistenceFixture();
    const receipt = persistence.persist({
      productionRoot: root,
      featureFlag: createZavorthNativeRegistryProductionPersistenceFeatureFlag(false),
    });

    expect(receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthNativeRegistryProductionPersistenceReceipt/v1',
      decision: 'production-write-blocked',
      productionPersistenceFeatureFlagRequired: true,
      productionWriteActuallyPerformedOnlyWhenFlagEnabled: true,
      productionNamespaceZavorthOwned: true,
      backupRollbackMetadataCreated: false,
      runtimeExternalExecutorRequiredForProductionWrite: false,
      runtimeExternalExecutorRequiredForProductionLookup: false,
      rawSecretSerialized: false,
      adapterRemovalAllowed: false,
    }));
    expect(receipt.validations).toContain('feature-flag-disabled');
    expect(receipt.snapshotWrites).toHaveLength(0);
    expect(fs.existsSync(root)).toBe(false);
  });

  it('writes redacted snapshots when the feature flag is enabled in the controlled namespace', () => {
    const persistence = persistenceFixture();
    const receipt = persistence.persist({
      productionRoot: root,
      featureFlag: createZavorthNativeRegistryProductionPersistenceFeatureFlag(true),
    });
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')) as ZavorthNativeRegistryProductionManifest;

    expect(receipt.decision).toBe('native-registry-production-persistence-ready');
    expect(receipt.validations).toEqual(['valid']);
    expect(receipt.productionNamespace).toBe(ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE);
    expect(receipt.productionNamespaceUri).toBe(ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI);
    expect(receipt.backupRollbackMetadataCreated).toBe(true);
    expect(receipt.snapshotWrites).toHaveLength(5);
    expect(receipt.snapshotWrites.every((write) => write.status === 'written')).toBe(true);
    expect(receipt.snapshotWrites.every((write) => write.atomicWriteUsed && write.productionWriteActuallyPerformed)).toBe(true);
    expect(manifest).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthNativeRegistryProductionManifest/v1',
      productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
      schemaVersion: 'zavorth-native-registry-persistence/v1',
      snapshotCount: 5,
      backupRollbackMetadataCreated: true,
      rawSecretSerialized: false,
      runtimeExternalExecutorRequiredForProductionLookup: false,
    }));
    expect(fs.existsSync(path.join(root, 'rollback', 'backup-rollback-manifest.json'))).toBe(true);
    assertNoRawSecret(root);
  });

  it('validates atomic write, checksum, schema, and idempotency in written snapshots', () => {
    const persistence = persistenceFixture();
    const receipt = persistence.persist({
      productionRoot: root,
      featureFlag: createZavorthNativeRegistryProductionPersistenceFeatureFlag(true),
    });

    receipt.snapshotWrites.forEach((write) => {
      const persisted = JSON.parse(fs.readFileSync(path.join(root, write.relativePath), 'utf8')) as ZavorthNativeRegistryProductionPersistedSnapshot;

      expect(persisted).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthNativeRegistryProductionPersistedSnapshot/v1',
        productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
        schemaVersion: 'zavorth-native-registry-persistence/v1',
        contentChecksum: write.contentChecksum,
        idempotencyKey: write.idempotencyKey,
        backupRollbackMetadataCreated: true,
        payloadSensitiveFieldsPersisted: false,
        runtimeExternalExecutorRequiredForProductionLookup: false,
        runtimeExternalExecutorRequiredForProductionWrite: false,
        sourceRuntimeAuthority: false,
        rawSecretSerialized: false,
      }));
      expect(persisted.contentChecksum).toMatch(/^[a-f0-9]{64}$/);
      expect(persisted.idempotencyKey).toMatch(/^[a-f0-9]{32}$/);
      expect(persisted.redactionEnvelope.rawSecretSerialized).toBe(false);
    });
  });

  it('uses idempotency on re-run without duplicating snapshots', () => {
    const persistence = persistenceFixture();
    const first = persistence.persist({
      productionRoot: root,
      featureFlag: createZavorthNativeRegistryProductionPersistenceFeatureFlag(true),
    });
    const second = persistence.persist({
      productionRoot: root,
      featureFlag: createZavorthNativeRegistryProductionPersistenceFeatureFlag(true),
    });

    expect(first.snapshotWrites.every((write) => write.status === 'written')).toBe(true);
    expect(second.idempotencyAvoidedDuplicateWrites).toBe(true);
    expect(second.snapshotWrites.every((write) => write.status === 'already-present')).toBe(true);
    expect(listJsonFiles(root)).toHaveLength(7);
    assertNoRawSecret(root);
  });

  it('restores/loads written snapshots for production lookup without ExternalExecutor live', () => {
    const persistence = persistenceFixture();
    persistence.persist({
      productionRoot: root,
      featureFlag: createZavorthNativeRegistryProductionPersistenceFeatureFlag(true),
    });

    const load = persistence.load(root);
    const lookup = persistence.lookup(load, 'capability-registry');

    expect(load).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthNativeRegistryProductionLoadReceipt/v1',
      decision: 'production-snapshot-load-ready',
      productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
      runtimeExternalExecutorRequiredForProductionLookup: false,
      sourceRuntimeAuthority: false,
      rawSecretSerialized: false,
    }));
    expect(load.loadedSnapshots).toHaveLength(5);
    expect(lookup).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthNativeRegistryProductionLookupResult/v1',
      registryKind: 'capability-registry',
      found: true,
      runtimeExternalExecutorRequiredForProductionLookup: false,
      sourceRuntimeAuthority: false,
      rawSecretSerialized: false,
    }));
  });

  it('rejects raw secret payload attempts before writing', () => {
    const persistence = createZavorthNativeRegistryProductionPersistenceFlaggedFixture(
      persistenceSourceFixture({
        rawSecretSerialized: true,
      }),
    );
    const receipt = persistence.persist({
      productionRoot: root,
      featureFlag: createZavorthNativeRegistryProductionPersistenceFeatureFlag(true),
    });

    expect(receipt.decision).toBe('blocked');
    expect(receipt.validations).toContain('redaction-invalid');
    expect(receipt.snapshotWrites).toHaveLength(0);
    expect(receipt.rawSecretSerialized).toBe(false);
    expect(fs.existsSync(root)).toBe(false);
  });

  it('rejects invalid schema designs before writing', () => {
    const invalidDesign = normalizeZavorthNativeRegistryProductionStorageDesign({
      generatedAt: '2026-04-29T06:00:00.000Z',
      runtimeId: 'zavorth-native-registry-production-storage-design-invalid-for-198-test',
      idPrefix: 'zavorth-native-registry-production-storage-design-invalid-for-198-test',
      source: designSourceFixture(),
      schemaVersionOverride: 'zavorth-native-registry-persistence/v0',
    });
    const persistence = createZavorthNativeRegistryProductionPersistenceFlaggedFixture(
      persistenceSourceFixture({
        design: invalidDesign,
      }),
    );
    const receipt = persistence.persist({
      productionRoot: root,
      featureFlag: createZavorthNativeRegistryProductionPersistenceFeatureFlag(true),
    });

    expect(receipt.decision).toBe('blocked');
    expect(receipt.validations).toEqual(expect.arrayContaining(['source-not-ready', 'schema-invalid']));
    expect(receipt.snapshotWrites).toHaveLength(0);
    expect(fs.existsSync(root)).toBe(false);
  });

  it('keeps adapter fallback/refresh and blocks ExternalExecutor migration/copy/execution', () => {
    const persistence = persistenceFixture();
    const receipt = persistence.persist({
      productionRoot: root,
      featureFlag: createZavorthNativeRegistryProductionPersistenceFeatureFlag(true),
    });

    expect(receipt.runtimeExternalExecutorRequiredForProductionWrite).toBe(false);
    expect(receipt.runtimeExternalExecutorRequiredForProductionLookup).toBe(false);
    expect(receipt.stateMigrated).toBe(false);
    expect(receipt.sourceFileCopied).toBe(false);
    expect(receipt.sourceDbCopied).toBe(false);
    expect(receipt.sourceDbOpenedForWrite).toBe(false);
    expect(receipt.sourceRuntimeAuthority).toBe(false);
    expect(receipt.executionAuthority).toBe(false);
    expect(receipt.messageActuallySent).toBe(false);
    expect(receipt.providerActuallyExecuted).toBe(false);
    expect(receipt.commandActuallyExecuted).toBe(false);
    expect(receipt.toolActuallyExecuted).toBe(false);
    expect(receipt.adapterRemovalAllowed).toBe(false);
  });

  it('cleans up the controlled production namespace used by the test gate', () => {
    const persistence = persistenceFixture();
    persistence.persist({
      productionRoot: root,
      featureFlag: createZavorthNativeRegistryProductionPersistenceFeatureFlag(true),
    });
    expect(fs.existsSync(root)).toBe(true);

    const cleanup = persistence.cleanup(root);

    expect(cleanup).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthNativeRegistryProductionCleanupReceipt/v1',
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
