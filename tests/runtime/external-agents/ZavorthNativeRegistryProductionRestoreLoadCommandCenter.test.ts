import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
  createZavorthNativeRegistryProductionPersistenceFeatureFlag,
  createZavorthNativeRegistryProductionPersistenceFlaggedFixture,
  createZavorthNativeRegistryProductionRestoreLoadCommandCenterFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthNativeRegistryPersistenceKind,
  ZavorthNativeRegistryProductionManifest,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/199-wave-3-production-restore-load-command-center-native-first.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PERSISTENCE_DOC = 'docs/198-wave-3-native-registry-production-persistence-flagged.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthNativeRegistryProductionRestoreLoadCommandCenter.ts';
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
    'zavorth-native-registry-production-restore-command-center-test',
    ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
  );
}

function productionBaselineRoot(): string {
  return path.join(
    process.cwd(),
    '.tmp',
    'zavorth-native-registry-production-restore-command-center-baseline',
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

function writeProductionFixture(root: string): void {
  if (fs.existsSync(root)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  fs.cpSync(productionBaselineRoot(), root, { recursive: true });
}

function manifest(root: string): ZavorthNativeRegistryProductionManifest {
  return JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')) as ZavorthNativeRegistryProductionManifest;
}

function mutateFirstSnapshot(
  root: string,
  mutate: (payload: Record<string, unknown>) => void,
): ZavorthNativeRegistryPersistenceKind {
  const productionManifest = manifest(root);
  const first = productionManifest.snapshots[0];
  const absolutePath = path.join(root, first.relativePath);
  const payload = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as Record<string, unknown>;
  mutate(payload);
  fs.writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return first.registryKind;
}

describe('Zavorth production restore/load Command Center native-first', () => {
  const root = productionRoot();
  const baselineRoot = productionBaselineRoot();
  const restoreLoad = createZavorthNativeRegistryProductionRestoreLoadCommandCenterFixture();

  beforeAll(() => {
    const persistence = createZavorthNativeRegistryProductionPersistenceFlaggedFixture();
    if (fs.existsSync(baselineRoot)) {
      persistence.cleanup(baselineRoot);
    }
    const receipt = persistence.persist({
      productionRoot: baselineRoot,
      featureFlag: createZavorthNativeRegistryProductionPersistenceFeatureFlag(true),
    });
    expect(receipt.decision).toBe('native-registry-production-persistence-ready');
  });

  afterEach(() => {
    if (fs.existsSync(root)) {
      restoreLoad.cleanup(root);
    }
  });

  afterAll(() => {
    if (fs.existsSync(baselineRoot)) {
      restoreLoad.cleanup(baselineRoot);
    }
  });

  it('documents 199 as the production restore/load Command Center gate', () => {
    const content = read(DOC);

    expect(content).toContain('Status: production-restore-load-command-center-ready');
    expect(content).toContain('docs/198-wave-3-native-registry-production-persistence-flagged.md');
    expect(content).toContain('ZavorthNativeRegistryProductionCommandCenterRestoreReceipt/v1');
    expect(content).toContain('ZavorthNativeRegistryProductionCommandCenterProjection/v1');
    expect(content).toContain('productionRestoreLoadPathCreated=true');
    expect(content).toContain('productionSnapshotReadActuallyPerformed=true');
    expect(content).toContain('commandCenterProductionBackedNativeFirst=true');
    expect(content).toContain('Wave 3 native absorption milestone report follow-up: docs/200-wave-3-native-absorption-milestone-report.md');
    expect(content).toContain('Do not');
    expect(content).toContain('`201`');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('updates tracking docs and prior flagged persistence gate for 199', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/199-wave-3-production-restore-load-command-center-native-first.md');
    expect(read(PAUSE_DOC)).toContain('`199` is the production restore/load Command Center native-first gate');
    expect(read(PERSISTENCE_DOC)).toContain('production restore/load Command Center native-first follow-up: docs/199-wave-3-production-restore-load-command-center-native-first.md');
    expect(read(PERSISTENCE_DOC)).toContain('Do not');
    expect(read(PERSISTENCE_DOC)).toContain('`200`');
  });

  it('exports the production restore/load Command Center boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthNativeRegistryProductionRestoreLoadCommandCenter');
    expect(boundary).toContain('ZavorthNativeRegistryProductionCommandCenterRestoreReceipt/v1');
    expect(boundary).toContain('ZavorthNativeRegistryProductionCommandCenterProjection/v1');
    expect(index).toContain("from './ZavorthNativeRegistryProductionRestoreLoadCommandCenter.js'");
    expect(index).toContain('ZavorthNativeRegistryProductionCommandCenterRestoreReceipt');
  });

  it('loads production-controlled snapshots from 198 into Command Center native-first views', () => {
    writeProductionFixture(root);

    const receipt = restoreLoad.load(root);
    const projection = restoreLoad.renderCommandCenter(receipt);
    const lookup = restoreLoad.lookup(receipt, 'dashboard-view-model-registry');

    expect(receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthNativeRegistryProductionCommandCenterRestoreReceipt/v1',
      decision: 'production-restore-load-command-center-ready',
      productionRestoreLoadPathCreated: true,
      productionSnapshotReadActuallyPerformed: true,
      commandCenterProductionBackedNativeFirst: true,
      runtimeExternalExecutorRequiredForProductionLoadedLookup: false,
      runtimeExternalExecutorRequiredForProductionLoadedRender: false,
      adapterDefaultPathForNativeReadySurfaces: false,
      adapterRefreshAllowed: true,
      adapterRemovalAllowed: false,
      rawSecretSerialized: false,
    }));
    expect(receipt.views).toHaveLength(5);
    expect(receipt.validations.every((entry) => entry.status === 'valid')).toBe(true);
    expect(projection.rows).toHaveLength(5);
    expect(projection.commandCenterProductionBackedNativeFirst).toBe(true);
    expect(projection.runtimeExternalExecutorRequiredForProductionLoadedRender).toBe(false);
    expect(lookup).toEqual(expect.objectContaining({
      registryKind: 'dashboard-view-model-registry',
      found: true,
      runtimeExternalExecutorRequiredForProductionLoadedLookup: false,
      adapterDefaultPathForNativeReadySurfaces: false,
    }));
    assertNoRawSecret(root);
  });

  it('validates manifest, schema, checksum, and idempotency for loaded snapshots', () => {
    writeProductionFixture(root);

    const receipt = restoreLoad.load(root);

    receipt.validations.forEach((entry) => {
      expect(entry.status).toBe('valid');
      expect(entry.expectedChecksum).toBe(entry.observedChecksum);
      expect(entry.expectedIdempotencyKey).toBe(entry.observedIdempotencyKey);
      expect(entry.expectedSchemaVersion).toBe('zavorth-native-registry-persistence/v1');
      expect(entry.observedSchemaVersion).toBe('zavorth-native-registry-persistence/v1');
      expect(entry.productionSnapshotReadActuallyPerformed).toBe(true);
      expect(entry.rawSecretSerialized).toBe(false);
    });
  });

  it('rejects corrupted production snapshot checksum as blocked', () => {
    writeProductionFixture(root);
    const corruptedKind = mutateFirstSnapshot(root, (payload) => {
      payload.contentChecksum = 'bad-production-checksum';
    });

    const receipt = restoreLoad.load(root);
    const corrupted = receipt.validations.find((entry) => entry.registryKind === corruptedKind);

    expect(receipt.decision).toBe('blocked');
    expect(corrupted).toEqual(expect.objectContaining({
      status: 'checksum-invalid',
      observedChecksum: 'bad-production-checksum',
      rawSecretSerialized: false,
    }));
    expect(receipt.views).toHaveLength(4);
    expect(receipt.runtimeExternalExecutorRequiredForProductionLoadedLookup).toBe(false);
  });

  it('rejects incompatible production snapshot schema as blocked', () => {
    writeProductionFixture(root);
    const corruptedKind = mutateFirstSnapshot(root, (payload) => {
      payload.schemaVersion = 'zavorth-native-registry-persistence/v0';
    });

    const receipt = restoreLoad.load(root);
    const corrupted = receipt.validations.find((entry) => entry.registryKind === corruptedKind);

    expect(receipt.decision).toBe('blocked');
    expect(corrupted).toEqual(expect.objectContaining({
      status: 'schema-incompatible',
      expectedSchemaVersion: 'zavorth-native-registry-persistence/v1',
      observedSchemaVersion: 'zavorth-native-registry-persistence/v0',
    }));
    expect(receipt.stateMigrated).toBe(false);
    expect(receipt.sourceFileCopied).toBe(false);
  });

  it('rejects invalid redaction envelope and never serializes raw secrets', () => {
    writeProductionFixture(root);
    const corruptedKind = mutateFirstSnapshot(root, (payload) => {
      const redactionEnvelope = payload.redactionEnvelope as Record<string, unknown>;
      redactionEnvelope.rawSecretSerialized = true;
    });

    const receipt = restoreLoad.load(root);
    const corrupted = receipt.validations.find((entry) => entry.registryKind === corruptedKind);
    const serialized = JSON.stringify(receipt);

    expect(receipt.decision).toBe('blocked');
    expect(corrupted).toEqual(expect.objectContaining({
      status: 'redaction-invalid',
      rawSecretSerialized: false,
    }));
    expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('keeps adapter fallback/refresh only and blocks execution/migration/source copy', () => {
    writeProductionFixture(root);

    const receipt = restoreLoad.load(root);
    const projection = restoreLoad.renderCommandCenter(receipt);

    expect(receipt.adapterDefaultPathForNativeReadySurfaces).toBe(false);
    expect(receipt.adapterRefreshAllowed).toBe(true);
    expect(receipt.adapterRemovalAllowed).toBe(false);
    expect(receipt.stateMigrated).toBe(false);
    expect(receipt.sourceFileCopied).toBe(false);
    expect(receipt.sourceDbCopied).toBe(false);
    expect(receipt.sourceRuntimeAuthority).toBe(false);
    expect(receipt.executionAuthority).toBe(false);
    expect(receipt.messageActuallySent).toBe(false);
    expect(receipt.providerActuallyExecuted).toBe(false);
    expect(receipt.commandActuallyExecuted).toBe(false);
    expect(receipt.toolActuallyExecuted).toBe(false);
    expect(projection.adapterDefaultPathForNativeReadySurfaces).toBe(false);
    expect(projection.adapterRefreshAllowed).toBe(true);
  });

  it('cleans up the controlled production namespace used by the restore/load gate', () => {
    writeProductionFixture(root);
    restoreLoad.load(root);
    expect(fs.existsSync(root)).toBe(true);

    const cleanup = restoreLoad.cleanup(root);

    expect(cleanup).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthNativeRegistryProductionCommandCenterCleanupReceipt/v1',
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
