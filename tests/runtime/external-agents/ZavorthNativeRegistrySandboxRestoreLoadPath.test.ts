import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE,
  createZavorthNativeRegistrySandboxPersistenceFixture,
  createZavorthNativeRegistrySandboxRestoreLoadPathFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthNativeRegistryPersistenceKind,
  ZavorthNativeRegistrySandboxManifest,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/196-wave-3-native-registry-sandbox-restore-load-path.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PERSISTENCE_DOC = 'docs/195-wave-3-native-registry-sandbox-persistence.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthNativeRegistrySandboxRestoreLoadPath.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function sandboxRoot(): string {
  return path.join(
    process.cwd(),
    '.tmp',
    'zavorth-native-registry-restore-load-test',
    ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE,
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

function assertNoRawSecretInSandbox(root: string): void {
  listJsonFiles(root).forEach((file) => {
    const content = fs.readFileSync(file, 'utf8');

    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
    expect(content).not.toMatch(/ghp_[A-Za-z0-9_]{8,}/);
    expect(content).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{8,}/);
    expect(content).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  });
}

function manifest(root: string): ZavorthNativeRegistrySandboxManifest {
  return JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8')) as ZavorthNativeRegistrySandboxManifest;
}

function mutateFirstSnapshot(
  root: string,
  mutate: (payload: Record<string, unknown>) => void,
): ZavorthNativeRegistryPersistenceKind {
  const sandboxManifest = manifest(root);
  const first = sandboxManifest.snapshots[0];
  const absolutePath = path.join(root, first.relativePath);
  const payload = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as Record<string, unknown>;
  mutate(payload);
  fs.writeFileSync(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return first.registryKind;
}

describe('Zavorth native registry sandbox restore/load path', () => {
  const root = sandboxRoot();
  const persistence = createZavorthNativeRegistrySandboxPersistenceFixture();
  const restoreLoadPath = createZavorthNativeRegistrySandboxRestoreLoadPathFixture();

  afterEach(() => {
    if (fs.existsSync(root)) {
      restoreLoadPath.cleanup(root);
    }
  });

  it('documents 196 as the sandbox restore/load gate', () => {
    const content = read(DOC);

    expect(content).toContain('Status: native-registry-sandbox-restore-load-ready');
    expect(content).toContain('docs/195-wave-3-native-registry-sandbox-persistence.md');
    expect(content).toContain('ZavorthNativeRegistrySandboxRestoreReceipt/v1');
    expect(content).toContain('ZavorthNativeRegistrySandboxRestoredView/v1');
    expect(content).toContain('ZavorthNativeRegistrySandboxRestoredCommandCenterProjection/v1');
    expect(content).toContain('nativeRegistryRestoreMode=sandbox-live');
    expect(content).toContain('persistentReadActuallyPerformed=true');
    expect(content).toContain('runtimeExternalExecutorRequiredForRestore=false');
    expect(content).toContain('runtimeExternalExecutorRequiredForRestoredLookup=false');
    expect(content).toContain('runtimeExternalExecutorRequiredForRestoredRender=false');
    expect(content).toContain('native registry production storage design follow-up: docs/197-wave-3-native-registry-production-storage-design.md');
    expect(content).toContain('Do not');
    expect(content).toContain('`198`');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('updates tracking docs and prior sandbox persistence gate for 196', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/196-wave-3-native-registry-sandbox-restore-load-path.md');
    expect(read(PAUSE_DOC)).toContain('`196` is the native registry sandbox restore/load path');
    expect(read(PERSISTENCE_DOC)).toContain('native registry sandbox restore/load follow-up: docs/196-wave-3-native-registry-sandbox-restore-load-path.md');
    expect(read(PERSISTENCE_DOC)).toContain('Do not');
    expect(read(PERSISTENCE_DOC)).toContain('`197`');
  });

  it('exports the restore/load path boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthNativeRegistrySandboxRestoreLoadPath');
    expect(boundary).toContain('ZavorthNativeRegistrySandboxRestoreReceipt/v1');
    expect(boundary).toContain('ZavorthNativeRegistrySandboxRestoredView/v1');
    expect(boundary).toContain('ZavorthNativeRegistrySandboxRestoreValidation/v1');
    expect(index).toContain("from './ZavorthNativeRegistrySandboxRestoreLoadPath.js'");
    expect(index).toContain('ZavorthNativeRegistrySandboxRestoreReceipt');
  });

  it('loads 195 sandbox snapshots into restored Zavorth-native views without ExternalExecutor live', () => {
    persistence.persist({ sandboxRoot: root });

    const receipt = restoreLoadPath.load(root);
    const projection = restoreLoadPath.renderCommandCenter(receipt);

    expect(receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthNativeRegistrySandboxRestoreReceipt/v1',
      decision: 'native-registry-sandbox-restore-load-ready',
      nativeRegistryRestoreMode: 'sandbox-live',
      persistentReadActuallyPerformed: true,
      runtimeExternalExecutorRequiredForRestore: false,
      runtimeExternalExecutorRequiredForRestoredLookup: false,
      runtimeExternalExecutorRequiredForRestoredRender: false,
      stateMigrated: false,
      sourceFileCopied: false,
      sourceDbCopied: false,
      sourceDbOpenedForWrite: false,
      sourceRuntimeAuthority: false,
      executionAuthority: false,
      rawSecretSerialized: false,
      adapterRemovalAllowed: false,
    }));
    expect(receipt.validSnapshotCount).toBe(5);
    expect(receipt.invalidSnapshotCount).toBe(0);
    expect(receipt.validations.every((entry) => entry.status === 'valid')).toBe(true);
    expect(receipt.restoredSnapshots).toHaveLength(5);
    expect(receipt.restoredViews).toHaveLength(5);
    expect(projection.rows).toHaveLength(5);
    expect(projection.runtimeExternalExecutorRequiredForRestoredRender).toBe(false);
    expect(projection.sourceIdentityPublic).toBe(false);
    assertNoRawSecretInSandbox(root);
  });

  it('validates schemaVersion, checksum, and idempotency from the sandbox manifest', () => {
    persistence.persist({ sandboxRoot: root });

    const receipt = restoreLoadPath.load(root);

    receipt.validations.forEach((entry) => {
      expect(entry.status).toBe('valid');
      expect(entry.expectedChecksum).toBe(entry.observedChecksum);
      expect(entry.expectedIdempotencyKey).toBe(entry.observedIdempotencyKey);
      expect(entry.expectedSchemaVersion).toBe('zavorth-native-registry-persistence/v1');
      expect(entry.observedSchemaVersion).toBe('zavorth-native-registry-persistence/v1');
      expect(entry.rawSecretSerialized).toBe(false);
    });
  });

  it('rejects a corrupted snapshot checksum without crashing', () => {
    persistence.persist({ sandboxRoot: root });
    const corruptedKind = mutateFirstSnapshot(root, (payload) => {
      payload.contentChecksum = 'bad-checksum';
    });

    const receipt = restoreLoadPath.load(root);
    const corrupted = receipt.validations.find((entry) => entry.registryKind === corruptedKind);

    expect(receipt.decision).toBe('blocked');
    expect(receipt.invalidSnapshotCount).toBe(1);
    expect(corrupted).toEqual(expect.objectContaining({
      status: 'checksum-invalid',
      observedChecksum: 'bad-checksum',
      rawSecretSerialized: false,
    }));
    expect(receipt.restoredSnapshots).toHaveLength(4);
    expect(receipt.runtimeExternalExecutorRequiredForRestore).toBe(false);
  });

  it('rejects an incompatible schema version', () => {
    persistence.persist({ sandboxRoot: root });
    const corruptedKind = mutateFirstSnapshot(root, (payload) => {
      payload.schemaVersion = 'zavorth-native-registry-persistence/v0';
    });

    const receipt = restoreLoadPath.load(root);
    const corrupted = receipt.validations.find((entry) => entry.registryKind === corruptedKind);

    expect(receipt.decision).toBe('blocked');
    expect(corrupted).toEqual(expect.objectContaining({
      status: 'schema-incompatible',
      expectedSchemaVersion: 'zavorth-native-registry-persistence/v1',
      observedSchemaVersion: 'zavorth-native-registry-persistence/v0',
    }));
    expect(receipt.stateMigrated).toBe(false);
    expect(receipt.sourceDbOpenedForWrite).toBe(false);
  });

  it('blocks load when the redaction envelope is invalid', () => {
    persistence.persist({ sandboxRoot: root });
    const corruptedKind = mutateFirstSnapshot(root, (payload) => {
      const redactionEnvelope = payload.redactionEnvelope as Record<string, unknown>;
      redactionEnvelope.rawSecretSerialized = true;
    });

    const receipt = restoreLoadPath.load(root);
    const corrupted = receipt.validations.find((entry) => entry.registryKind === corruptedKind);

    expect(receipt.decision).toBe('blocked');
    expect(corrupted).toEqual(expect.objectContaining({
      status: 'redaction-invalid',
      rawSecretSerialized: false,
    }));
    expect(JSON.stringify(receipt)).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(JSON.stringify(receipt)).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('feeds restored lookup and Command Center render paths without ExternalExecutor live', () => {
    persistence.persist({ sandboxRoot: root });

    const receipt = restoreLoadPath.load(root);
    const lookup = restoreLoadPath.lookupRestoredView(receipt, 'dashboard-view-model-registry');
    const projection = restoreLoadPath.renderCommandCenter(receipt);

    expect(lookup).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthNativeRegistrySandboxRestoredLookupResult/v1',
      registryKind: 'dashboard-view-model-registry',
      found: true,
      runtimeExternalExecutorRequiredForRestoredLookup: false,
      sourceRuntimeAuthority: false,
      rawSecretSerialized: false,
    }));
    expect(lookup.view).toEqual(expect.objectContaining({
      commandCenterConsumable: true,
      sourceIdentityPublic: false,
      executionAuthority: false,
      runtimeExternalExecutorRequiredForRestoredRender: false,
    }));
    expect(projection.rows.map((row) => row.registryKind)).toEqual(expect.arrayContaining([
      'capability-registry',
      'config-state-registry',
      'dashboard-view-model-registry',
      'integration-registry',
      'session-history-registry',
    ]));
    expect(projection.rows.every((row) => !row.sourceIdentityPublic && !row.executionAuthority)).toBe(true);
  });

  it('keeps execution, migration, and adapter removal blocked for restored receipts', () => {
    persistence.persist({ sandboxRoot: root });

    const receipt = restoreLoadPath.load(root);

    expect(receipt.messageActuallySent).toBe(false);
    expect(receipt.providerActuallyExecuted).toBe(false);
    expect(receipt.commandActuallyExecuted).toBe(false);
    expect(receipt.toolActuallyExecuted).toBe(false);
    expect(receipt.stateMigrated).toBe(false);
    expect(receipt.sourceFileCopied).toBe(false);
    expect(receipt.sourceDbCopied).toBe(false);
    expect(receipt.sourceDbOpenedForWrite).toBe(false);
    expect(receipt.sourceRuntimeAuthority).toBe(false);
    expect(receipt.executionAuthority).toBe(false);
    expect(receipt.adapterRemovalAllowed).toBe(false);
    expect(receipt.rawSecretSerialized).toBe(false);
  });

  it('cleans up only the sandbox namespace after restore/load tests', () => {
    persistence.persist({ sandboxRoot: root });
    restoreLoadPath.load(root);
    expect(fs.existsSync(root)).toBe(true);

    const cleanup = restoreLoadPath.cleanup(root);

    expect(cleanup).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthNativeRegistrySandboxRestoreCleanupReceipt/v1',
      namespace: ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE,
      cleanupActuallyPerformed: true,
      namespaceExistsAfterCleanup: false,
      persistentStorageOutsideSandboxTouched: false,
      sourceFileCopied: false,
      sourceDbCopied: false,
      rawSecretSerialized: false,
    }));
    expect(fs.existsSync(root)).toBe(false);
  });
});
