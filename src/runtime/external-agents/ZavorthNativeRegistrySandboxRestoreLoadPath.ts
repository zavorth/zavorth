import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
} from './ZavorthNativeRegistryPersistenceDryRun.js';
import {
  ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE,
} from './ZavorthNativeRegistrySandboxPersistence.js';
import type {
  ZavorthNativeRegistryPersistenceKind,
  ZavorthNativeRegistryPersistenceRedactionEnvelope,
  ZavorthNativeRegistryPersistenceRollbackMetadata,
} from './ZavorthNativeRegistryPersistenceDryRun.js';
import type {
  ZavorthNativeRegistrySandboxPersistedSnapshot,
} from './ZavorthNativeRegistrySandboxPersistence.js';

export const ZAVORTH_NATIVE_REGISTRY_SANDBOX_RESTORE_LOAD_NOW = '2026-04-29T05:30:00.000Z' as const;
export const ZAVORTH_NATIVE_REGISTRY_SANDBOX_RESTORE_LOAD_RUNTIME_ID = 'zavorth-native-registry-sandbox-restore-load-path' as const;

export type ZavorthNativeRegistrySandboxRestoreDecision =
  | 'blocked'
  | 'native-registry-sandbox-restore-load-ready';

export type ZavorthNativeRegistrySandboxRestoreValidationStatus =
  | 'checksum-invalid'
  | 'contract-invalid'
  | 'idempotency-invalid'
  | 'manifest-invalid'
  | 'missing'
  | 'namespace-invalid'
  | 'parse-error'
  | 'redaction-invalid'
  | 'schema-incompatible'
  | 'valid';

export type ZavorthNativeRegistrySandboxManifestSnapshot = {
  registryKind: ZavorthNativeRegistryPersistenceKind;
  idempotencyKey: string;
  contentChecksum: string;
  relativePath: string;
  status: string;
};

export type ZavorthNativeRegistrySandboxManifest = {
  nativeContract: 'ZavorthNativeRegistrySandboxManifest/v1';
  namespace: typeof ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE;
  persistedAt: string;
  snapshotCount: number;
  snapshots: ZavorthNativeRegistrySandboxManifestSnapshot[];
  rawSecretSerialized: false;
  runtimeExternalExecutorRequiredForPersistence: false;
};

export type ZavorthNativeRegistrySandboxRestoreValidation = {
  nativeContract: 'ZavorthNativeRegistrySandboxRestoreValidation/v1';
  registryKind?: ZavorthNativeRegistryPersistenceKind;
  relativePath: string;
  expectedChecksum?: string;
  observedChecksum?: string;
  expectedIdempotencyKey?: string;
  observedIdempotencyKey?: string;
  expectedSchemaVersion?: string;
  observedSchemaVersion?: string;
  status: ZavorthNativeRegistrySandboxRestoreValidationStatus;
  reason: string;
  persistentReadActuallyPerformed: boolean;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistrySandboxRestoredSnapshot = {
  nativeContract: 'ZavorthNativeRegistrySandboxRestoredSnapshot/v1';
  namespace: typeof ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE;
  registryKind: ZavorthNativeRegistryPersistenceKind;
  registryId: string;
  schemaVersion: typeof ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION;
  schemaName: string;
  recordCount: number;
  contentChecksum: string;
  idempotencyKey: string;
  redactionEnvelope: ZavorthNativeRegistryPersistenceRedactionEnvelope;
  rollback: ZavorthNativeRegistryPersistenceRollbackMetadata;
  provenance: ZavorthNativeRegistrySandboxPersistedSnapshot['provenance'];
  restoredFromSandbox: true;
  payloadSensitiveFieldsLoaded: false;
  runtimeExternalExecutorRequiredForRestoredLookup: false;
  runtimeExternalExecutorRequiredForRestoredRender: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistrySandboxRestoredView = {
  nativeContract: 'ZavorthNativeRegistrySandboxRestoredView/v1';
  id: string;
  registryKind: ZavorthNativeRegistryPersistenceKind;
  registryId: string;
  label: string;
  summary: string;
  recordCount: number;
  status: 'ready';
  lookupConsumable: true;
  renderConsumable: true;
  commandCenterConsumable: true;
  provenanceInternalOnly: true;
  sourceIdentityPublic: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  runtimeExternalExecutorRequiredForRestoredLookup: false;
  runtimeExternalExecutorRequiredForRestoredRender: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistrySandboxRestoredLookupResult = {
  nativeContract: 'ZavorthNativeRegistrySandboxRestoredLookupResult/v1';
  registryKind: ZavorthNativeRegistryPersistenceKind;
  found: boolean;
  view?: ZavorthNativeRegistrySandboxRestoredView;
  runtimeExternalExecutorRequiredForRestoredLookup: false;
  sourceRuntimeAuthority: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistrySandboxRestoredCommandCenterRow = {
  nativeContract: 'ZavorthNativeRegistrySandboxRestoredCommandCenterRow/v1';
  id: string;
  registryKind: ZavorthNativeRegistryPersistenceKind;
  label: string;
  summary: string;
  status: 'ready';
  recordCount: number;
  sourceIdentityPublic: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistrySandboxRestoredCommandCenterProjection = {
  nativeContract: 'ZavorthNativeRegistrySandboxRestoredCommandCenterProjection/v1';
  generatedAt: string;
  rows: ZavorthNativeRegistrySandboxRestoredCommandCenterRow[];
  runtimeExternalExecutorRequiredForRestoredRender: false;
  runtimeExternalExecutorRequiredForRestoredLookup: false;
  sourceIdentityPublic: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistrySandboxRestoreReceipt = {
  nativeContract: 'ZavorthNativeRegistrySandboxRestoreReceipt/v1';
  runtimeId: typeof ZAVORTH_NATIVE_REGISTRY_SANDBOX_RESTORE_LOAD_RUNTIME_ID;
  decision: ZavorthNativeRegistrySandboxRestoreDecision;
  restoredAt: string;
  nativeRegistryRestoreMode: 'sandbox-live';
  namespace: typeof ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE;
  sandboxRoot: string;
  manifestPath: string;
  manifestValid: boolean;
  validations: ZavorthNativeRegistrySandboxRestoreValidation[];
  restoredSnapshots: ZavorthNativeRegistrySandboxRestoredSnapshot[];
  restoredViews: ZavorthNativeRegistrySandboxRestoredView[];
  validSnapshotCount: number;
  invalidSnapshotCount: number;
  persistentReadActuallyPerformed: true;
  runtimeExternalExecutorRequiredForRestore: false;
  runtimeExternalExecutorRequiredForRestoredLookup: false;
  runtimeExternalExecutorRequiredForRestoredRender: false;
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

export type ZavorthNativeRegistrySandboxRestoreCleanupReceipt = {
  nativeContract: 'ZavorthNativeRegistrySandboxRestoreCleanupReceipt/v1';
  namespace: typeof ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE;
  sandboxRoot: string;
  cleanupActuallyPerformed: boolean;
  namespaceExistsAfterCleanup: boolean;
  persistentStorageOutsideSandboxTouched: false;
  sourceFileCopied: false;
  sourceDbCopied: false;
  rawSecretSerialized: false;
};

type SnapshotValidationInput = {
  sandboxRoot: string;
  manifestSnapshot: ZavorthNativeRegistrySandboxManifestSnapshot;
};

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

function validation(
  input: Partial<ZavorthNativeRegistrySandboxRestoreValidation> & {
    relativePath: string;
    status: ZavorthNativeRegistrySandboxRestoreValidationStatus;
    reason: string;
  },
): ZavorthNativeRegistrySandboxRestoreValidation {
  return {
    nativeContract: 'ZavorthNativeRegistrySandboxRestoreValidation/v1',
    relativePath: input.relativePath,
    ...(input.registryKind ? { registryKind: input.registryKind } : {}),
    ...(input.expectedChecksum ? { expectedChecksum: input.expectedChecksum } : {}),
    ...(input.observedChecksum ? { observedChecksum: input.observedChecksum } : {}),
    ...(input.expectedIdempotencyKey ? { expectedIdempotencyKey: input.expectedIdempotencyKey } : {}),
    ...(input.observedIdempotencyKey ? { observedIdempotencyKey: input.observedIdempotencyKey } : {}),
    ...(input.expectedSchemaVersion ? { expectedSchemaVersion: input.expectedSchemaVersion } : {}),
    ...(input.observedSchemaVersion ? { observedSchemaVersion: input.observedSchemaVersion } : {}),
    status: input.status,
    reason: input.reason,
    persistentReadActuallyPerformed: Boolean(input.persistentReadActuallyPerformed),
    rawSecretSerialized: false,
  };
}

function parseJsonFile<TValue>(filePath: string): TValue | undefined {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as TValue;
  } catch {
    return undefined;
  }
}

function isManifest(value: unknown): value is ZavorthNativeRegistrySandboxManifest {
  const candidate = value as Partial<ZavorthNativeRegistrySandboxManifest>;
  return (
    candidate.nativeContract === 'ZavorthNativeRegistrySandboxManifest/v1' &&
    candidate.namespace === ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE &&
    Array.isArray(candidate.snapshots) &&
    candidate.snapshotCount === candidate.snapshots.length &&
    candidate.rawSecretSerialized === false &&
    candidate.runtimeExternalExecutorRequiredForPersistence === false
  );
}

function isPersistedSnapshot(value: unknown): value is ZavorthNativeRegistrySandboxPersistedSnapshot {
  const candidate = value as Partial<ZavorthNativeRegistrySandboxPersistedSnapshot>;
  return (
    candidate.nativeContract === 'ZavorthNativeRegistrySandboxPersistedSnapshot/v1' &&
    candidate.namespace === ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE &&
    typeof candidate.registryKind === 'string' &&
    typeof candidate.registryId === 'string' &&
    typeof candidate.schemaVersion === 'string' &&
    typeof candidate.schemaName === 'string' &&
    typeof candidate.recordCount === 'number' &&
    typeof candidate.contentChecksum === 'string' &&
    typeof candidate.idempotencyKey === 'string' &&
    candidate.payloadSensitiveFieldsPersisted === false &&
    candidate.rawSecretSerialized === false &&
    candidate.runtimeExternalExecutorRequiredForPersistence === false &&
    candidate.sourceRuntimeAuthority === false
  );
}

function redactionEnvelopeValid(envelope: ZavorthNativeRegistryPersistenceRedactionEnvelope): boolean {
  return (
    envelope.nativeContract === 'ZavorthNativeRegistryPersistenceRedactionEnvelope/v1' &&
    envelope.rawSecretSerialized === false &&
    envelope.rawMessageContentSerialized === false &&
    envelope.sourceIdentityPublic === false &&
    envelope.provenanceInternalOnly === true &&
    envelope.safeMetadataOnly === true &&
    Array.isArray(envelope.forbiddenFields) &&
    envelope.forbiddenFields.includes('rawSecretValue') &&
    envelope.forbiddenFields.includes('rawMessageContent')
  );
}

function snapshotPath(sandboxRoot: string, relativePath: string): string | undefined {
  const absolute = path.resolve(sandboxRoot, relativePath);
  if (!absolute.startsWith(`${sandboxRoot}${path.sep}`)) {
    return undefined;
  }
  return absolute;
}

function restoredSnapshot(persisted: ZavorthNativeRegistrySandboxPersistedSnapshot): ZavorthNativeRegistrySandboxRestoredSnapshot {
  return {
    nativeContract: 'ZavorthNativeRegistrySandboxRestoredSnapshot/v1',
    namespace: ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE,
    registryKind: persisted.registryKind,
    registryId: persisted.registryId,
    schemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
    schemaName: persisted.schemaName,
    recordCount: persisted.recordCount,
    contentChecksum: persisted.contentChecksum,
    idempotencyKey: persisted.idempotencyKey,
    redactionEnvelope: persisted.redactionEnvelope,
    rollback: persisted.rollback,
    provenance: persisted.provenance,
    restoredFromSandbox: true,
    payloadSensitiveFieldsLoaded: false,
    runtimeExternalExecutorRequiredForRestoredLookup: false,
    runtimeExternalExecutorRequiredForRestoredRender: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    rawSecretSerialized: false,
  };
}

function labelForRegistry(kind: ZavorthNativeRegistryPersistenceKind): string {
  return kind
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function restoredView(snapshot: ZavorthNativeRegistrySandboxRestoredSnapshot): ZavorthNativeRegistrySandboxRestoredView {
  return {
    nativeContract: 'ZavorthNativeRegistrySandboxRestoredView/v1',
    id: `restored:${snapshot.registryKind}:${snapshot.idempotencyKey}`,
    registryKind: snapshot.registryKind,
    registryId: snapshot.registryId,
    label: labelForRegistry(snapshot.registryKind),
    summary: `Restored Zavorth-native ${snapshot.registryKind} descriptor with ${snapshot.recordCount} redacted metadata records.`,
    recordCount: snapshot.recordCount,
    status: 'ready',
    lookupConsumable: true,
    renderConsumable: true,
    commandCenterConsumable: true,
    provenanceInternalOnly: true,
    sourceIdentityPublic: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    runtimeExternalExecutorRequiredForRestoredLookup: false,
    runtimeExternalExecutorRequiredForRestoredRender: false,
    rawSecretSerialized: false,
  };
}

function validateSnapshot(input: SnapshotValidationInput): {
  persisted?: ZavorthNativeRegistrySandboxPersistedSnapshot;
  validation: ZavorthNativeRegistrySandboxRestoreValidation;
} {
  const expected = input.manifestSnapshot;
  const absolutePath = snapshotPath(input.sandboxRoot, expected.relativePath);

  if (!absolutePath) {
    return {
      validation: validation({
        registryKind: expected.registryKind,
        relativePath: expected.relativePath,
        status: 'manifest-invalid',
        reason: 'snapshot relative path escapes sandbox namespace',
        expectedChecksum: expected.contentChecksum,
        expectedIdempotencyKey: expected.idempotencyKey,
        persistentReadActuallyPerformed: false,
      }),
    };
  }

  if (!fs.existsSync(absolutePath)) {
    return {
      validation: validation({
        registryKind: expected.registryKind,
        relativePath: expected.relativePath,
        status: 'missing',
        reason: 'snapshot file missing',
        expectedChecksum: expected.contentChecksum,
        expectedIdempotencyKey: expected.idempotencyKey,
        persistentReadActuallyPerformed: false,
      }),
    };
  }

  const parsed = parseJsonFile<unknown>(absolutePath);
  if (!parsed) {
    return {
      validation: validation({
        registryKind: expected.registryKind,
        relativePath: expected.relativePath,
        status: 'parse-error',
        reason: 'snapshot JSON could not be parsed',
        expectedChecksum: expected.contentChecksum,
        expectedIdempotencyKey: expected.idempotencyKey,
        persistentReadActuallyPerformed: true,
      }),
    };
  }

  if (!isPersistedSnapshot(parsed)) {
    return {
      validation: validation({
        registryKind: expected.registryKind,
        relativePath: expected.relativePath,
        status: 'contract-invalid',
        reason: 'persisted snapshot contract or mandatory safety flags are invalid',
        expectedChecksum: expected.contentChecksum,
        expectedIdempotencyKey: expected.idempotencyKey,
        persistentReadActuallyPerformed: true,
      }),
    };
  }

  if (parsed.namespace !== ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE) {
    return {
      validation: validation({
        registryKind: expected.registryKind,
        relativePath: expected.relativePath,
        status: 'namespace-invalid',
        reason: 'snapshot namespace does not match Zavorth-owned sandbox namespace',
        expectedChecksum: expected.contentChecksum,
        observedChecksum: parsed.contentChecksum,
        expectedIdempotencyKey: expected.idempotencyKey,
        observedIdempotencyKey: parsed.idempotencyKey,
        persistentReadActuallyPerformed: true,
      }),
    };
  }

  if (parsed.schemaVersion !== ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION) {
    return {
      validation: validation({
        registryKind: expected.registryKind,
        relativePath: expected.relativePath,
        status: 'schema-incompatible',
        reason: 'snapshot schemaVersion is not compatible with the restore/load path',
        expectedChecksum: expected.contentChecksum,
        observedChecksum: parsed.contentChecksum,
        expectedIdempotencyKey: expected.idempotencyKey,
        observedIdempotencyKey: parsed.idempotencyKey,
        expectedSchemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
        observedSchemaVersion: parsed.schemaVersion,
        persistentReadActuallyPerformed: true,
      }),
    };
  }

  if (parsed.contentChecksum !== expected.contentChecksum) {
    return {
      validation: validation({
        registryKind: expected.registryKind,
        relativePath: expected.relativePath,
        status: 'checksum-invalid',
        reason: 'snapshot checksum does not match manifest',
        expectedChecksum: expected.contentChecksum,
        observedChecksum: parsed.contentChecksum,
        expectedIdempotencyKey: expected.idempotencyKey,
        observedIdempotencyKey: parsed.idempotencyKey,
        expectedSchemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
        observedSchemaVersion: parsed.schemaVersion,
        persistentReadActuallyPerformed: true,
      }),
    };
  }

  if (parsed.idempotencyKey !== expected.idempotencyKey) {
    return {
      validation: validation({
        registryKind: expected.registryKind,
        relativePath: expected.relativePath,
        status: 'idempotency-invalid',
        reason: 'snapshot idempotency key does not match manifest',
        expectedChecksum: expected.contentChecksum,
        observedChecksum: parsed.contentChecksum,
        expectedIdempotencyKey: expected.idempotencyKey,
        observedIdempotencyKey: parsed.idempotencyKey,
        expectedSchemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
        observedSchemaVersion: parsed.schemaVersion,
        persistentReadActuallyPerformed: true,
      }),
    };
  }

  if (!redactionEnvelopeValid(parsed.redactionEnvelope)) {
    return {
      validation: validation({
        registryKind: expected.registryKind,
        relativePath: expected.relativePath,
        status: 'redaction-invalid',
        reason: 'snapshot redaction envelope is invalid or allows unsafe output',
        expectedChecksum: expected.contentChecksum,
        observedChecksum: parsed.contentChecksum,
        expectedIdempotencyKey: expected.idempotencyKey,
        observedIdempotencyKey: parsed.idempotencyKey,
        expectedSchemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
        observedSchemaVersion: parsed.schemaVersion,
        persistentReadActuallyPerformed: true,
      }),
    };
  }

  return {
    persisted: parsed,
    validation: validation({
      registryKind: expected.registryKind,
      relativePath: expected.relativePath,
      status: 'valid',
      reason: 'snapshot descriptor passed schema, checksum, idempotency, and redaction validation',
      expectedChecksum: expected.contentChecksum,
      observedChecksum: parsed.contentChecksum,
      expectedIdempotencyKey: expected.idempotencyKey,
      observedIdempotencyKey: parsed.idempotencyKey,
      expectedSchemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
      observedSchemaVersion: parsed.schemaVersion,
      persistentReadActuallyPerformed: true,
    }),
  };
}

export class ZavorthNativeRegistrySandboxRestoreLoadPath {
  public load(sandboxRoot: string): ZavorthNativeRegistrySandboxRestoreReceipt {
    const resolved = assertSandboxRoot(sandboxRoot);
    const manifestPath = path.join(resolved, 'manifest.json');
    const manifest = fs.existsSync(manifestPath)
      ? parseJsonFile<unknown>(manifestPath)
      : undefined;

    if (!isManifest(manifest)) {
      const manifestValidation = validation({
        relativePath: 'manifest.json',
        status: 'manifest-invalid',
        reason: 'sandbox manifest is missing or invalid',
        persistentReadActuallyPerformed: fs.existsSync(manifestPath),
      });
      return this.receipt(resolved, manifestPath, false, [manifestValidation], []);
    }

    const validated = manifest.snapshots.map((manifestSnapshot) => (
      validateSnapshot({ sandboxRoot: resolved, manifestSnapshot })
    ));
    const validations = validated.map((entry) => entry.validation);
    const restoredSnapshots = validated
      .map((entry) => entry.persisted)
      .filter((entry): entry is ZavorthNativeRegistrySandboxPersistedSnapshot => Boolean(entry))
      .map(restoredSnapshot);

    return this.receipt(
      resolved,
      manifestPath,
      validations.every((entry) => entry.status === 'valid') && manifest.snapshotCount === restoredSnapshots.length,
      validations,
      restoredSnapshots,
    );
  }

  public lookupRestoredView(
    receipt: ZavorthNativeRegistrySandboxRestoreReceipt,
    registryKind: ZavorthNativeRegistryPersistenceKind,
  ): ZavorthNativeRegistrySandboxRestoredLookupResult {
    const view = receipt.restoredViews.find((entry) => entry.registryKind === registryKind);
    return {
      nativeContract: 'ZavorthNativeRegistrySandboxRestoredLookupResult/v1',
      registryKind,
      found: Boolean(view),
      ...(view ? { view } : {}),
      runtimeExternalExecutorRequiredForRestoredLookup: false,
      sourceRuntimeAuthority: false,
      rawSecretSerialized: false,
    };
  }

  public renderCommandCenter(
    receipt: ZavorthNativeRegistrySandboxRestoreReceipt,
  ): ZavorthNativeRegistrySandboxRestoredCommandCenterProjection {
    return {
      nativeContract: 'ZavorthNativeRegistrySandboxRestoredCommandCenterProjection/v1',
      generatedAt: receipt.restoredAt,
      rows: receipt.restoredViews.map((view): ZavorthNativeRegistrySandboxRestoredCommandCenterRow => ({
        nativeContract: 'ZavorthNativeRegistrySandboxRestoredCommandCenterRow/v1',
        id: view.id,
        registryKind: view.registryKind,
        label: view.label,
        summary: view.summary,
        status: view.status,
        recordCount: view.recordCount,
        sourceIdentityPublic: false,
        sourceRuntimeAuthority: false,
        executionAuthority: false,
        rawSecretSerialized: false,
      })),
      runtimeExternalExecutorRequiredForRestoredRender: false,
      runtimeExternalExecutorRequiredForRestoredLookup: false,
      sourceIdentityPublic: false,
      rawSecretSerialized: false,
    };
  }

  public cleanup(sandboxRoot: string): ZavorthNativeRegistrySandboxRestoreCleanupReceipt {
    const resolved = assertSandboxRoot(sandboxRoot);
    const existedBefore = fs.existsSync(resolved);

    if (existedBefore) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }

    return {
      nativeContract: 'ZavorthNativeRegistrySandboxRestoreCleanupReceipt/v1',
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

  private receipt(
    sandboxRoot: string,
    manifestPath: string,
    manifestValid: boolean,
    validations: ZavorthNativeRegistrySandboxRestoreValidation[],
    restoredSnapshots: ZavorthNativeRegistrySandboxRestoredSnapshot[],
  ): ZavorthNativeRegistrySandboxRestoreReceipt {
    const restoredViews = restoredSnapshots.map(restoredView);
    const invalidSnapshotCount = validations.filter((entry) => entry.status !== 'valid').length;

    return {
      nativeContract: 'ZavorthNativeRegistrySandboxRestoreReceipt/v1',
      runtimeId: ZAVORTH_NATIVE_REGISTRY_SANDBOX_RESTORE_LOAD_RUNTIME_ID,
      decision: manifestValid && invalidSnapshotCount === 0
        ? 'native-registry-sandbox-restore-load-ready'
        : 'blocked',
      restoredAt: ZAVORTH_NATIVE_REGISTRY_SANDBOX_RESTORE_LOAD_NOW,
      nativeRegistryRestoreMode: 'sandbox-live',
      namespace: ZAVORTH_NATIVE_REGISTRY_SANDBOX_NAMESPACE,
      sandboxRoot,
      manifestPath,
      manifestValid,
      validations,
      restoredSnapshots,
      restoredViews,
      validSnapshotCount: restoredSnapshots.length,
      invalidSnapshotCount,
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
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      rawSecretSerialized: false,
      adapterRemovalAllowed: false,
    };
  }
}

export function createZavorthNativeRegistrySandboxRestoreLoadPathFixture(): ZavorthNativeRegistrySandboxRestoreLoadPath {
  return new ZavorthNativeRegistrySandboxRestoreLoadPath();
}
