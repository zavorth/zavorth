import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE,
  createZavorthNativeDashboardViewModelRegistryFixture,
  createZavorthNativeRegistrySandboxPersistenceFixture,
  normalizeZavorthPartialAdapterDeprecationGateFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthNativeRegistrySandboxPersistenceReceipt,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/195-wave-3-native-registry-sandbox-persistence.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const DRY_RUN_DOC = 'docs/194-wave-3-native-registry-persistence-dry-run.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthNativeRegistrySandboxPersistence.ts';
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
    'zavorth-native-registry-sandbox-persistence-test',
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
    expect(content).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  });
}

describe('Zavorth native registry sandbox persistence', () => {
  const root = sandboxRoot();
  const persistence = createZavorthNativeRegistrySandboxPersistenceFixture();

  afterEach(() => {
    if (fs.existsSync(root)) {
      persistence.cleanup(root);
    }
  });

  it('documents 195 as the native registry sandbox persistence gate', () => {
    const content = read(DOC);

    expect(content).toContain('Status: native-registry-sandbox-persistence-ready');
    expect(content).toContain('ZavorthNativeRegistrySandboxPersistedSnapshot/v1');
    expect(content).toContain('ZavorthNativeRegistrySandboxSnapshotWriteReceipt/v1');
    expect(content).toContain('ZavorthNativeRegistrySandboxPersistenceReceipt/v1');
    expect(content).toContain('ZavorthNativeRegistrySandboxPersistenceVerification/v1');
    expect(content).toContain('ZavorthNativeRegistrySandboxCleanupReceipt/v1');
    expect(content).toContain('docs/194-wave-3-native-registry-persistence-dry-run.md');
    expect(content).toContain('nativeRegistryPersistenceMode=sandbox-live');
    expect(content).toContain('persistentWriteActuallyPerformed=true');
    expect(content).toContain('persistentWriteNamespace=zavorth-owned-sandbox');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(content).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  });

  it('updates tracking docs and prior dry-run gate for 195', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/195-wave-3-native-registry-sandbox-persistence.md');
    expect(read(PAUSE_DOC)).toContain('`195` is the native registry sandbox persistence gate');
    expect(read(DRY_RUN_DOC)).toContain('native registry sandbox persistence follow-up: docs/195-wave-3-native-registry-sandbox-persistence.md');
    expect(read(DRY_RUN_DOC)).toContain('Do not');
    expect(read(DRY_RUN_DOC)).toContain('`196`');
  });

  it('exports the sandbox persistence boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthNativeRegistrySandboxPersistedSnapshot/v1');
    expect(boundary).toContain('ZavorthNativeRegistrySandboxPersistence');
    expect(boundary).toContain('createZavorthNativeRegistrySandboxPersistenceFixture');
    expect(index).toContain("from './ZavorthNativeRegistrySandboxPersistence.js'");
    expect(index).toContain('ZavorthNativeRegistrySandboxPersistenceReceipt');
  });

  it('persists redacted snapshots into the Zavorth-owned sandbox namespace', () => {
    const receipt = persistence.persist({ sandboxRoot: root });
    const verification = persistence.verify(root);
    const files = listJsonFiles(root);

    expect(receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthNativeRegistrySandboxPersistenceReceipt/v1',
      decision: 'native-registry-sandbox-persistence-ready',
      nativeRegistryPersistenceMode: 'sandbox-live',
      persistentWriteNamespace: ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE,
      persistentWriteActuallyPerformed: true,
      runtimeExternalExecutorRequiredForPersistence: false,
      stateMigrated: false,
      sourceFileCopied: false,
      sourceDbCopied: false,
      sourceDbOpenedForWrite: false,
      rawSecretSerialized: false,
      adapterRemovalAllowed: false,
    }));
    expect(receipt.snapshotWrites).toHaveLength(5);
    expect(receipt.snapshotWrites.every((write) => write.status === 'written')).toBe(true);
    expect(files).toHaveLength(6);
    expect(verification).toEqual(expect.objectContaining({
      snapshotCount: 5,
      manifestExists: true,
      allChecksumsVerified: true,
      rawSecretSerialized: false,
      runtimeExternalExecutorRequiredForPersistence: false,
    }));
    assertNoRawSecretInSandbox(root);
  });

  it('uses idempotency to avoid duplicate snapshot files on re-run', () => {
    const first = persistence.persist({ sandboxRoot: root });
    const firstFiles = listJsonFiles(root);
    const second = persistence.persist({ sandboxRoot: root });
    const secondFiles = listJsonFiles(root);

    expect(first.snapshotWrites.every((write) => write.status === 'written')).toBe(true);
    expect(second.idempotencyAvoidedDuplicateWrites).toBe(true);
    expect(second.snapshotWrites.every((write) => write.status === 'already-present')).toBe(true);
    expect(secondFiles).toEqual(firstFiles);
    expect(secondFiles).toHaveLength(6);
    assertNoRawSecretInSandbox(root);
  });

  it('writes verifiable schemaVersion, checksum, idempotency, and redacted provenance metadata', () => {
    const receipt = persistence.persist({ sandboxRoot: root });

    receipt.snapshotWrites.forEach((write) => {
      const persisted = JSON.parse(
        fs.readFileSync(path.join(root, write.relativePath), 'utf8'),
      ) as Record<string, unknown>;

      expect(persisted).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthNativeRegistrySandboxPersistedSnapshot/v1',
        namespace: ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE,
        registryKind: write.registryKind,
        contentChecksum: write.contentChecksum,
        idempotencyKey: write.idempotencyKey,
        payloadSensitiveFieldsPersisted: false,
        rawSecretSerialized: false,
        runtimeExternalExecutorRequiredForPersistence: false,
        sourceRuntimeAuthority: false,
      }));
      expect(String(persisted.schemaVersion)).toBe('zavorth-native-registry-persistence/v1');
      expect(String(persisted.contentChecksum)).toMatch(/^[a-f0-9]{64}$/);
      expect(String(persisted.idempotencyKey)).toMatch(/^[a-f0-9]{32}$/);
      expect(persisted.provenance).toEqual(expect.objectContaining({
        internalOnly: true,
        redacted: true,
        sourceRuntimeAuthority: false,
        sourceRuntimePublicIdentity: false,
      }));
    });
  });

  it('supports cleanup of only the sandbox namespace', () => {
    persistence.persist({ sandboxRoot: root });
    expect(fs.existsSync(root)).toBe(true);

    const cleanup = persistence.cleanup(root);

    expect(cleanup).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthNativeRegistrySandboxCleanupReceipt/v1',
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

  it('keeps Command Center/native lookup independent and adapter refresh/fallback only', () => {
    const receipt: ZavorthNativeRegistrySandboxPersistenceReceipt = persistence.persist({ sandboxRoot: root });
    const dashboardRegistry = createZavorthNativeDashboardViewModelRegistryFixture();
    const render = dashboardRegistry.render();
    const adapterPolicy = normalizeZavorthPartialAdapterDeprecationGateFixture();

    expect(render.rows.length).toBeGreaterThan(0);
    expect(render.runtimeExternalExecutorRequiredForDashboardRender).toBe(false);
    expect(render.runtimeExternalExecutorRequiredForDashboardViewLookup).toBe(false);
    expect(adapterPolicy.refreshPolicy.adapterRoles).toEqual([
      'optional-refresh-source',
      'reconciliation-source',
      'degraded-fallback',
      'not-default-render-lookup-path',
    ]);
    expect(adapterPolicy.executionGate.adapterRemovalAllowed).toBe(false);
    expect(receipt.runtimeExternalExecutorRequiredForPersistence).toBe(false);
  });

  it('does not migrate or copy ExternalExecutor state and does not grant execution authority', () => {
    const receipt = persistence.persist({ sandboxRoot: root });

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
    expect(receipt.rawSecretSerialized).toBe(false);
    assertNoRawSecretInSandbox(root);
  });
});
