import fs from 'node:fs';
import path from 'node:path';

import {
  normalizeZavorthNativeRegistryPersistenceDryRunFixture,
} from './ZavorthNativeRegistryPersistenceDryRun.js';
import type {
  ZavorthNativeRegistryPersistenceDryRunNormalization,
  ZavorthNativeRegistryPersistenceKind,
  ZavorthNativeRegistryPersistenceSnapshot,
} from './ZavorthNativeRegistryPersistenceDryRun.js';

export const ZAVORTH_NATIVE_REGISTRY_SANDBOX_PERSISTENCE_NOW = '2026-04-29T05:00:00.000Z' as const;
export const ZAVORTH_NATIVE_REGISTRY_SANDBOX_PERSISTENCE_RUNTIME_ID = 'zavorth-native-registry-sandbox-persistence' as const;
export const ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE = 'zavorth-owned-sandbox' as const;

export type ZavorthNativeRegistrySandboxPersistenceDecision =
  | 'blocked'
  | 'native-registry-sandbox-persistence-ready';

export type ZavorthNativeRegistrySandboxPersistedSnapshot = {
  nativeContract: 'ZavorthNativeRegistrySandboxPersistedSnapshot/v1';
  namespace: typeof ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE;
  persistedAt: string;
  registryKind: ZavorthNativeRegistryPersistenceKind;
  registryId: string;
  schemaVersion: string;
  schemaName: string;
  recordCount: number;
  checksumAlgorithm: ZavorthNativeRegistryPersistenceSnapshot['checksumAlgorithm'];
  contentChecksum: string;
  idempotencyKey: string;
  redactionEnvelope: ZavorthNativeRegistryPersistenceSnapshot['redactionEnvelope'];
  rollback: ZavorthNativeRegistryPersistenceSnapshot['rollback'];
  provenance: ZavorthNativeRegistryPersistenceSnapshot['provenance'];
  payloadSensitiveFieldsPersisted: false;
  rawSecretSerialized: false;
  runtimeExternalExecutorRequiredForPersistence: false;
  sourceRuntimeAuthority: false;
};

export type ZavorthNativeRegistrySandboxSnapshotWriteStatus =
  | 'already-present'
  | 'checksum-conflict'
  | 'written';

export type ZavorthNativeRegistrySandboxSnapshotWriteReceipt = {
  nativeContract: 'ZavorthNativeRegistrySandboxSnapshotWriteReceipt/v1';
  registryKind: ZavorthNativeRegistryPersistenceKind;
  idempotencyKey: string;
  contentChecksum: string;
  relativePath: string;
  status: ZavorthNativeRegistrySandboxSnapshotWriteStatus;
  bytesWritten: number;
  persistentWriteActuallyPerformed: boolean;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistrySandboxPersistenceReceipt = {
  nativeContract: 'ZavorthNativeRegistrySandboxPersistenceReceipt/v1';
  runtimeId: typeof ZAVORTH_NATIVE_REGISTRY_SANDBOX_PERSISTENCE_RUNTIME_ID;
  decision: ZavorthNativeRegistrySandboxPersistenceDecision;
  persistedAt: string;
  nativeRegistryPersistenceMode: 'sandbox-live';
  persistentWriteNamespace: typeof ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE;
  sandboxRoot: string;
  snapshotWrites: ZavorthNativeRegistrySandboxSnapshotWriteReceipt[];
  manifestPath: string;
  idempotencyAvoidedDuplicateWrites: boolean;
  persistentWriteActuallyPerformed: true;
  runtimeExternalExecutorRequiredForPersistence: false;
  stateMigrated: false;
  sourceFileCopied: false;
  sourceDbCopied: false;
  sourceDbOpenedForWrite: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  rawSecretSerialized: false;
  adapterRemovalAllowed: false;
};

export type ZavorthNativeRegistrySandboxPersistenceVerification = {
  nativeContract: 'ZavorthNativeRegistrySandboxPersistenceVerification/v1';
  namespace: typeof ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE;
  snapshotCount: number;
  manifestExists: boolean;
  allChecksumsVerified: boolean;
  rawSecretSerialized: false;
  runtimeExternalExecutorRequiredForPersistence: false;
};

export type ZavorthNativeRegistrySandboxCleanupReceipt = {
  nativeContract: 'ZavorthNativeRegistrySandboxCleanupReceipt/v1';
  namespace: typeof ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE;
  sandboxRoot: string;
  cleanupActuallyPerformed: boolean;
  namespaceExistsAfterCleanup: boolean;
  persistentStorageOutsideSandboxTouched: false;
  sourceFileCopied: false;
  sourceDbCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistrySandboxPersistenceOptions = {
  sandboxRoot: string;
  persistedAt?: string;
};

export type ZavorthNativeRegistrySandboxPersistenceSource = {
  dryRun: ZavorthNativeRegistryPersistenceDryRunNormalization;
  externalExecutorLiveRequiredForPersistence: false;
  sourceStateMigrationAttempted: false;
  sourceFileCopyAttempted: false;
  sourceDbCopyAttempted: false;
  sourceDbWriteOpenAttempted: false;
  executionAttempted: false;
  adapterRemovalAttempted: false;
  rawSecretSerialized: false;
};

function relativePathForSnapshot(snapshot: ZavorthNativeRegistryPersistenceSnapshot): string {
  return path.join('native-registries', snapshot.registryKind, `${snapshot.idempotencyKey}.json`);
}

function assertSandboxRoot(sandboxRoot: string): string {
  const resolved = path.resolve(sandboxRoot);
  const cwd = path.resolve(process.cwd());
  const tmpSegment = `${path.sep}.tmp${path.sep}`;

  if (!resolved.startsWith(`${cwd}${path.sep}`)) {
    throw new Error(`Sandbox root must stay inside workspace: ${resolved}`);
  }
  if (!resolved.includes(tmpSegment)) {
    throw new Error(`Sandbox root must live under .tmp: ${resolved}`);
  }
  if (path.basename(resolved) !== ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE) {
    throw new Error(`Sandbox root must end with ${ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE}: ${resolved}`);
  }

  return resolved;
}

function persistedSnapshot(
  snapshot: ZavorthNativeRegistryPersistenceSnapshot,
  persistedAt: string,
): ZavorthNativeRegistrySandboxPersistedSnapshot {
  return {
    nativeContract: 'ZavorthNativeRegistrySandboxPersistedSnapshot/v1',
    namespace: ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE,
    persistedAt,
    registryKind: snapshot.registryKind,
    registryId: snapshot.registryId,
    schemaVersion: snapshot.schemaVersion,
    schemaName: snapshot.schemaName,
    recordCount: snapshot.recordCount,
    checksumAlgorithm: snapshot.checksumAlgorithm,
    contentChecksum: snapshot.contentChecksum,
    idempotencyKey: snapshot.idempotencyKey,
    redactionEnvelope: snapshot.redactionEnvelope,
    rollback: snapshot.rollback,
    provenance: snapshot.provenance,
    payloadSensitiveFieldsPersisted: false,
    rawSecretSerialized: false,
    runtimeExternalExecutorRequiredForPersistence: false,
    sourceRuntimeAuthority: false,
  };
}

function writeJsonIfNeeded(
  absolutePath: string,
  payload: ZavorthNativeRegistrySandboxPersistedSnapshot,
): Pick<ZavorthNativeRegistrySandboxSnapshotWriteReceipt, 'bytesWritten' | 'persistentWriteActuallyPerformed' | 'status'> {
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;

  if (fs.existsSync(absolutePath)) {
    const current = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as ZavorthNativeRegistrySandboxPersistedSnapshot;
    if (
      current.contentChecksum === payload.contentChecksum &&
      current.idempotencyKey === payload.idempotencyKey &&
      current.schemaVersion === payload.schemaVersion
    ) {
      return {
        bytesWritten: 0,
        persistentWriteActuallyPerformed: false,
        status: 'already-present',
      };
    }

    return {
      bytesWritten: 0,
      persistentWriteActuallyPerformed: false,
      status: 'checksum-conflict',
    };
  }

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, serialized, 'utf8');

  return {
    bytesWritten: Buffer.byteLength(serialized, 'utf8'),
    persistentWriteActuallyPerformed: true,
    status: 'written',
  };
}

function sourceReady(source: ZavorthNativeRegistrySandboxPersistenceSource): boolean {
  return (
    source.dryRun.decision === 'native-registry-persistence-dry-run-ready' &&
    !source.externalExecutorLiveRequiredForPersistence &&
    !source.sourceStateMigrationAttempted &&
    !source.sourceFileCopyAttempted &&
    !source.sourceDbCopyAttempted &&
    !source.sourceDbWriteOpenAttempted &&
    !source.executionAttempted &&
    !source.adapterRemovalAttempted &&
    !source.rawSecretSerialized
  );
}

export class ZavorthNativeRegistrySandboxPersistence {
  public constructor(private readonly source: ZavorthNativeRegistrySandboxPersistenceSource) {}

  public persist(options: ZavorthNativeRegistrySandboxPersistenceOptions): ZavorthNativeRegistrySandboxPersistenceReceipt {
    const sandboxRoot = assertSandboxRoot(options.sandboxRoot);
    const persistedAt = options.persistedAt ?? ZAVORTH_NATIVE_REGISTRY_SANDBOX_PERSISTENCE_NOW;
    const ready = sourceReady(this.source);

    fs.mkdirSync(sandboxRoot, { recursive: true });

    const snapshotWrites: ZavorthNativeRegistrySandboxSnapshotWriteReceipt[] = this.source.dryRun.plan.snapshots.map((snapshot): ZavorthNativeRegistrySandboxSnapshotWriteReceipt => {
      const relativePath = relativePathForSnapshot(snapshot);
      const absolutePath = path.join(sandboxRoot, relativePath);
      const payload = persistedSnapshot(snapshot, persistedAt);
      const write = ready
        ? writeJsonIfNeeded(absolutePath, payload)
        : {
          bytesWritten: 0,
          persistentWriteActuallyPerformed: false,
          status: 'checksum-conflict' as const,
        };

      return {
        nativeContract: 'ZavorthNativeRegistrySandboxSnapshotWriteReceipt/v1',
        registryKind: snapshot.registryKind,
        idempotencyKey: snapshot.idempotencyKey,
        contentChecksum: snapshot.contentChecksum,
        relativePath,
        status: write.status,
        bytesWritten: write.bytesWritten,
        persistentWriteActuallyPerformed: write.persistentWriteActuallyPerformed,
        rawSecretSerialized: false,
      };
    });

    const manifest = {
      nativeContract: 'ZavorthNativeRegistrySandboxManifest/v1',
      namespace: ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE,
      persistedAt,
      snapshotCount: snapshotWrites.length,
      snapshots: snapshotWrites.map((write) => ({
        registryKind: write.registryKind,
        idempotencyKey: write.idempotencyKey,
        contentChecksum: write.contentChecksum,
        relativePath: write.relativePath,
        status: write.status,
      })),
      rawSecretSerialized: false,
      runtimeExternalExecutorRequiredForPersistence: false,
    };
    const manifestPath = path.join(sandboxRoot, 'manifest.json');
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    const allWritesSafe = snapshotWrites.every((write) => write.status === 'written' || write.status === 'already-present');

    return {
      nativeContract: 'ZavorthNativeRegistrySandboxPersistenceReceipt/v1',
      runtimeId: ZAVORTH_NATIVE_REGISTRY_SANDBOX_PERSISTENCE_RUNTIME_ID,
      decision: ready && allWritesSafe ? 'native-registry-sandbox-persistence-ready' : 'blocked',
      persistedAt,
      nativeRegistryPersistenceMode: 'sandbox-live',
      persistentWriteNamespace: ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE,
      sandboxRoot,
      snapshotWrites,
      manifestPath,
      idempotencyAvoidedDuplicateWrites: snapshotWrites.some((write) => write.status === 'already-present'),
      persistentWriteActuallyPerformed: true,
      runtimeExternalExecutorRequiredForPersistence: false,
      stateMigrated: false,
      sourceFileCopied: false,
      sourceDbCopied: false,
      sourceDbOpenedForWrite: false,
      sourceRuntimeAuthority: false,
      executionAuthority: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      rawSecretSerialized: false,
      adapterRemovalAllowed: false,
    };
  }

  public verify(sandboxRoot: string): ZavorthNativeRegistrySandboxPersistenceVerification {
    const resolved = assertSandboxRoot(sandboxRoot);
    const manifestPath = path.join(resolved, 'manifest.json');
    const checks = this.source.dryRun.plan.snapshots.map((snapshot) => {
      const absolutePath = path.join(resolved, relativePathForSnapshot(snapshot));
      if (!fs.existsSync(absolutePath)) {
        return false;
      }
      const persisted = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as ZavorthNativeRegistrySandboxPersistedSnapshot;
      return (
        persisted.contentChecksum === snapshot.contentChecksum &&
        persisted.idempotencyKey === snapshot.idempotencyKey &&
        persisted.schemaVersion === snapshot.schemaVersion &&
        !persisted.rawSecretSerialized &&
        !persisted.payloadSensitiveFieldsPersisted
      );
    });

    return {
      nativeContract: 'ZavorthNativeRegistrySandboxPersistenceVerification/v1',
      namespace: ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE,
      snapshotCount: checks.length,
      manifestExists: fs.existsSync(manifestPath),
      allChecksumsVerified: checks.every(Boolean),
      rawSecretSerialized: false,
      runtimeExternalExecutorRequiredForPersistence: false,
    };
  }

  public cleanup(sandboxRoot: string): ZavorthNativeRegistrySandboxCleanupReceipt {
    const resolved = assertSandboxRoot(sandboxRoot);
    const existedBefore = fs.existsSync(resolved);

    if (existedBefore) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }

    return {
      nativeContract: 'ZavorthNativeRegistrySandboxCleanupReceipt/v1',
      namespace: ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE,
      sandboxRoot: resolved,
      cleanupActuallyPerformed: existedBefore,
      namespaceExistsAfterCleanup: fs.existsSync(resolved),
      persistentStorageOutsideSandboxTouched: false,
      sourceFileCopied: false,
      sourceDbCopied: false,
      rawSecretSerialized: false,
    };
  }
}

export function createZavorthNativeRegistrySandboxPersistenceFixtureSource(): ZavorthNativeRegistrySandboxPersistenceSource {
  return {
    dryRun: normalizeZavorthNativeRegistryPersistenceDryRunFixture(),
    externalExecutorLiveRequiredForPersistence: false,
    sourceStateMigrationAttempted: false,
    sourceFileCopyAttempted: false,
    sourceDbCopyAttempted: false,
    sourceDbWriteOpenAttempted: false,
    executionAttempted: false,
    adapterRemovalAttempted: false,
    rawSecretSerialized: false,
  };
}

export function createZavorthNativeRegistrySandboxPersistenceFixture(): ZavorthNativeRegistrySandboxPersistence {
  return new ZavorthNativeRegistrySandboxPersistence(
    createZavorthNativeRegistrySandboxPersistenceFixtureSource(),
  );
}
