import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
} from './ZavorthNativeRegistryPersistenceDryRun.js';
import {
  ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
  ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI,
} from './ZavorthNativeRegistryProductionStorageDesign.js';
import type {
  ZavorthNativeRegistryPersistenceKind,
  ZavorthNativeRegistryPersistenceRedactionEnvelope,
} from './ZavorthNativeRegistryPersistenceDryRun.js';
import type {
  ZavorthNativeRegistryProductionManifest,
  ZavorthNativeRegistryProductionPersistedSnapshot,
} from './ZavorthNativeRegistryProductionPersistenceFlagged.js';

export const ZAVORTH_NATIVE_REGISTRY_PRODUCTION_RESTORE_COMMAND_CENTER_NOW = '2026-04-29T07:00:00.000Z' as const;
export const ZAVORTH_NATIVE_REGISTRY_PRODUCTION_RESTORE_COMMAND_CENTER_RUNTIME_ID = 'zavorth-native-registry-production-restore-load-command-center' as const;

export type ZavorthNativeRegistryProductionCommandCenterRestoreDecision =
  | 'blocked'
  | 'production-restore-load-command-center-ready';

export type ZavorthNativeRegistryProductionCommandCenterValidationStatus =
  | 'checksum-invalid'
  | 'contract-invalid'
  | 'idempotency-invalid'
  | 'manifest-invalid'
  | 'missing'
  | 'redaction-invalid'
  | 'schema-incompatible'
  | 'valid';

export type ZavorthNativeRegistryProductionCommandCenterValidation = {
  nativeContract: 'ZavorthNativeRegistryProductionCommandCenterValidation/v1';
  registryKind?: ZavorthNativeRegistryPersistenceKind;
  relativePath: string;
  status: ZavorthNativeRegistryProductionCommandCenterValidationStatus;
  reason: string;
  expectedChecksum?: string;
  observedChecksum?: string;
  expectedIdempotencyKey?: string;
  observedIdempotencyKey?: string;
  expectedSchemaVersion?: string;
  observedSchemaVersion?: string;
  productionSnapshotReadActuallyPerformed: boolean;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryProductionLoadedCommandCenterView = {
  nativeContract: 'ZavorthNativeRegistryProductionLoadedCommandCenterView/v1';
  id: string;
  registryKind: ZavorthNativeRegistryPersistenceKind;
  registryId: string;
  label: string;
  summary: string;
  status: 'ready';
  recordCount: number;
  contentChecksum: string;
  idempotencyKey: string;
  commandCenterConsumable: true;
  nativeLookupConsumable: true;
  productionBacked: true;
  sourceIdentityPublic: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryProductionCommandCenterProjectionRow = {
  nativeContract: 'ZavorthNativeRegistryProductionCommandCenterProjectionRow/v1';
  id: string;
  registryKind: ZavorthNativeRegistryPersistenceKind;
  label: string;
  summary: string;
  status: 'ready';
  recordCount: number;
  productionBacked: true;
  sourceIdentityPublic: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryProductionCommandCenterProjection = {
  nativeContract: 'ZavorthNativeRegistryProductionCommandCenterProjection/v1';
  generatedAt: string;
  rows: ZavorthNativeRegistryProductionCommandCenterProjectionRow[];
  commandCenterProductionBackedNativeFirst: true;
  runtimeExternalExecutorRequiredForProductionLoadedRender: false;
  adapterDefaultPathForNativeReadySurfaces: false;
  adapterRefreshAllowed: true;
  sourceIdentityPublic: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryProductionCommandCenterLookupResult = {
  nativeContract: 'ZavorthNativeRegistryProductionCommandCenterLookupResult/v1';
  registryKind: ZavorthNativeRegistryPersistenceKind;
  found: boolean;
  view?: ZavorthNativeRegistryProductionLoadedCommandCenterView;
  runtimeExternalExecutorRequiredForProductionLoadedLookup: false;
  adapterDefaultPathForNativeReadySurfaces: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryProductionCommandCenterRestoreReceipt = {
  nativeContract: 'ZavorthNativeRegistryProductionCommandCenterRestoreReceipt/v1';
  runtimeId: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_RESTORE_COMMAND_CENTER_RUNTIME_ID;
  decision: ZavorthNativeRegistryProductionCommandCenterRestoreDecision;
  restoredAt: string;
  productionRoot: string;
  productionNamespace: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE;
  productionNamespaceUri: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI;
  manifestPath: string;
  validations: ZavorthNativeRegistryProductionCommandCenterValidation[];
  views: ZavorthNativeRegistryProductionLoadedCommandCenterView[];
  productionRestoreLoadPathCreated: true;
  productionSnapshotReadActuallyPerformed: true;
  commandCenterProductionBackedNativeFirst: true;
  runtimeExternalExecutorRequiredForProductionLoadedLookup: false;
  runtimeExternalExecutorRequiredForProductionLoadedRender: false;
  adapterDefaultPathForNativeReadySurfaces: false;
  adapterRefreshAllowed: true;
  adapterRemovalAllowed: false;
  stateMigrated: false;
  sourceFileCopied: false;
  sourceDbCopied: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryProductionCommandCenterCleanupReceipt = {
  nativeContract: 'ZavorthNativeRegistryProductionCommandCenterCleanupReceipt/v1';
  productionRoot: string;
  cleanupActuallyPerformed: boolean;
  namespaceExistsAfterCleanup: boolean;
  cleanupLimitedToControlledTestNamespace: true;
  sourceFileCopied: false;
  sourceDbCopied: false;
  rawSecretSerialized: false;
};

type SnapshotValidationResult = {
  snapshot?: ZavorthNativeRegistryProductionPersistedSnapshot;
  validation: ZavorthNativeRegistryProductionCommandCenterValidation;
};

function assertProductionRoot(productionRoot: string): string {
  const resolved = path.resolve(productionRoot);
  const cwd = path.resolve(process.cwd());

  if (!resolved.startsWith(`${cwd}${path.sep}`)) {
    throw new Error(`Production root must stay inside workspace: ${resolved}`);
  }
  if (!resolved.includes(`${path.sep}.tmp${path.sep}`) && !resolved.includes(`${path.sep}.zavorth${path.sep}`)) {
    throw new Error(`Production root must live under .tmp or .zavorth: ${resolved}`);
  }
  if (path.basename(resolved) !== ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE) {
    throw new Error(`Production root must end with ${ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE}: ${resolved}`);
  }

  return resolved;
}

function readJson<TValue>(filePath: string): TValue | undefined {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as TValue;
  } catch {
    return undefined;
  }
}

function validation(
  input: Partial<ZavorthNativeRegistryProductionCommandCenterValidation> & {
    relativePath: string;
    status: ZavorthNativeRegistryProductionCommandCenterValidationStatus;
    reason: string;
  },
): ZavorthNativeRegistryProductionCommandCenterValidation {
  return {
    nativeContract: 'ZavorthNativeRegistryProductionCommandCenterValidation/v1',
    ...(input.registryKind ? { registryKind: input.registryKind } : {}),
    relativePath: input.relativePath,
    status: input.status,
    reason: input.reason,
    ...(input.expectedChecksum ? { expectedChecksum: input.expectedChecksum } : {}),
    ...(input.observedChecksum ? { observedChecksum: input.observedChecksum } : {}),
    ...(input.expectedIdempotencyKey ? { expectedIdempotencyKey: input.expectedIdempotencyKey } : {}),
    ...(input.observedIdempotencyKey ? { observedIdempotencyKey: input.observedIdempotencyKey } : {}),
    ...(input.expectedSchemaVersion ? { expectedSchemaVersion: input.expectedSchemaVersion } : {}),
    ...(input.observedSchemaVersion ? { observedSchemaVersion: input.observedSchemaVersion } : {}),
    productionSnapshotReadActuallyPerformed: Boolean(input.productionSnapshotReadActuallyPerformed),
    rawSecretSerialized: false,
  };
}

function redactionEnvelopeValid(envelope: ZavorthNativeRegistryPersistenceRedactionEnvelope): boolean {
  return (
    envelope.nativeContract === 'ZavorthNativeRegistryPersistenceRedactionEnvelope/v1' &&
    envelope.rawSecretSerialized === false &&
    envelope.rawMessageContentSerialized === false &&
    envelope.sourceIdentityPublic === false &&
    envelope.provenanceInternalOnly === true &&
    envelope.safeMetadataOnly === true &&
    envelope.forbiddenFields.includes('rawSecretValue') &&
    envelope.forbiddenFields.includes('rawMessageContent')
  );
}

function isManifest(value: unknown): value is ZavorthNativeRegistryProductionManifest {
  const candidate = value as Partial<ZavorthNativeRegistryProductionManifest>;
  return (
    candidate.nativeContract === 'ZavorthNativeRegistryProductionManifest/v1' &&
    candidate.productionNamespace === ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE &&
    candidate.productionNamespaceUri === ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI &&
    candidate.schemaVersion === ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION &&
    Array.isArray(candidate.snapshots) &&
    candidate.snapshotCount === candidate.snapshots.length &&
    candidate.rawSecretSerialized === false &&
    candidate.runtimeExternalExecutorRequiredForProductionLookup === false
  );
}

function isPersistedSnapshot(value: unknown): value is ZavorthNativeRegistryProductionPersistedSnapshot {
  const candidate = value as Partial<ZavorthNativeRegistryProductionPersistedSnapshot>;
  return (
    candidate.nativeContract === 'ZavorthNativeRegistryProductionPersistedSnapshot/v1' &&
    candidate.productionNamespace === ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE &&
    candidate.productionNamespaceUri === ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI &&
    typeof candidate.registryKind === 'string' &&
    typeof candidate.registryId === 'string' &&
    typeof candidate.schemaVersion === 'string' &&
    typeof candidate.recordCount === 'number' &&
    typeof candidate.contentChecksum === 'string' &&
    typeof candidate.idempotencyKey === 'string' &&
    candidate.payloadSensitiveFieldsPersisted === false &&
    candidate.sourceRuntimeAuthority === false &&
    candidate.rawSecretSerialized === false
  );
}

function labelForRegistry(kind: ZavorthNativeRegistryPersistenceKind): string {
  return kind
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function view(snapshot: ZavorthNativeRegistryProductionPersistedSnapshot): ZavorthNativeRegistryProductionLoadedCommandCenterView {
  return {
    nativeContract: 'ZavorthNativeRegistryProductionLoadedCommandCenterView/v1',
    id: `production-loaded:${snapshot.registryKind}:${snapshot.idempotencyKey}`,
    registryKind: snapshot.registryKind,
    registryId: snapshot.registryId,
    label: labelForRegistry(snapshot.registryKind),
    summary: `Production-loaded Zavorth-native ${snapshot.registryKind} descriptor with ${snapshot.recordCount} redacted records.`,
    status: 'ready',
    recordCount: snapshot.recordCount,
    contentChecksum: snapshot.contentChecksum,
    idempotencyKey: snapshot.idempotencyKey,
    commandCenterConsumable: true,
    nativeLookupConsumable: true,
    productionBacked: true,
    sourceIdentityPublic: false,
    sourceRuntimeAuthority: false,
    executionAuthority: false,
    rawSecretSerialized: false,
  };
}

function validateSnapshot(
  productionRoot: string,
  manifestSnapshot: ZavorthNativeRegistryProductionManifest['snapshots'][number],
): SnapshotValidationResult {
  const absolutePath = path.join(productionRoot, manifestSnapshot.relativePath);

  if (!fs.existsSync(absolutePath)) {
    return {
      validation: validation({
        registryKind: manifestSnapshot.registryKind,
        relativePath: manifestSnapshot.relativePath,
        status: 'missing',
        reason: 'production snapshot file missing',
        expectedChecksum: manifestSnapshot.contentChecksum,
        expectedIdempotencyKey: manifestSnapshot.idempotencyKey,
        productionSnapshotReadActuallyPerformed: false,
      }),
    };
  }

  const parsed = readJson<unknown>(absolutePath);
  if (!isPersistedSnapshot(parsed)) {
    return {
      validation: validation({
        registryKind: manifestSnapshot.registryKind,
        relativePath: manifestSnapshot.relativePath,
        status: 'contract-invalid',
        reason: 'production persisted snapshot contract or safety flags are invalid',
        expectedChecksum: manifestSnapshot.contentChecksum,
        expectedIdempotencyKey: manifestSnapshot.idempotencyKey,
        productionSnapshotReadActuallyPerformed: true,
      }),
    };
  }

  if (parsed.schemaVersion !== ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION) {
    return {
      validation: validation({
        registryKind: manifestSnapshot.registryKind,
        relativePath: manifestSnapshot.relativePath,
        status: 'schema-incompatible',
        reason: 'production snapshot schemaVersion is incompatible',
        expectedChecksum: manifestSnapshot.contentChecksum,
        observedChecksum: parsed.contentChecksum,
        expectedIdempotencyKey: manifestSnapshot.idempotencyKey,
        observedIdempotencyKey: parsed.idempotencyKey,
        expectedSchemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
        observedSchemaVersion: parsed.schemaVersion,
        productionSnapshotReadActuallyPerformed: true,
      }),
    };
  }

  if (parsed.contentChecksum !== manifestSnapshot.contentChecksum) {
    return {
      validation: validation({
        registryKind: manifestSnapshot.registryKind,
        relativePath: manifestSnapshot.relativePath,
        status: 'checksum-invalid',
        reason: 'production snapshot checksum does not match manifest',
        expectedChecksum: manifestSnapshot.contentChecksum,
        observedChecksum: parsed.contentChecksum,
        expectedIdempotencyKey: manifestSnapshot.idempotencyKey,
        observedIdempotencyKey: parsed.idempotencyKey,
        expectedSchemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
        observedSchemaVersion: parsed.schemaVersion,
        productionSnapshotReadActuallyPerformed: true,
      }),
    };
  }

  if (parsed.idempotencyKey !== manifestSnapshot.idempotencyKey) {
    return {
      validation: validation({
        registryKind: manifestSnapshot.registryKind,
        relativePath: manifestSnapshot.relativePath,
        status: 'idempotency-invalid',
        reason: 'production snapshot idempotency key does not match manifest',
        expectedChecksum: manifestSnapshot.contentChecksum,
        observedChecksum: parsed.contentChecksum,
        expectedIdempotencyKey: manifestSnapshot.idempotencyKey,
        observedIdempotencyKey: parsed.idempotencyKey,
        expectedSchemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
        observedSchemaVersion: parsed.schemaVersion,
        productionSnapshotReadActuallyPerformed: true,
      }),
    };
  }

  if (!redactionEnvelopeValid(parsed.redactionEnvelope)) {
    return {
      validation: validation({
        registryKind: manifestSnapshot.registryKind,
        relativePath: manifestSnapshot.relativePath,
        status: 'redaction-invalid',
        reason: 'production snapshot redaction envelope is invalid',
        expectedChecksum: manifestSnapshot.contentChecksum,
        observedChecksum: parsed.contentChecksum,
        expectedIdempotencyKey: manifestSnapshot.idempotencyKey,
        observedIdempotencyKey: parsed.idempotencyKey,
        expectedSchemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
        observedSchemaVersion: parsed.schemaVersion,
        productionSnapshotReadActuallyPerformed: true,
      }),
    };
  }

  return {
    snapshot: parsed,
    validation: validation({
      registryKind: manifestSnapshot.registryKind,
      relativePath: manifestSnapshot.relativePath,
      status: 'valid',
      reason: 'production snapshot passed schema, checksum, idempotency, and redaction validation',
      expectedChecksum: manifestSnapshot.contentChecksum,
      observedChecksum: parsed.contentChecksum,
      expectedIdempotencyKey: manifestSnapshot.idempotencyKey,
      observedIdempotencyKey: parsed.idempotencyKey,
      expectedSchemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
      observedSchemaVersion: parsed.schemaVersion,
      productionSnapshotReadActuallyPerformed: true,
    }),
  };
}

export class ZavorthNativeRegistryProductionRestoreLoadCommandCenter {
  public load(productionRoot: string): ZavorthNativeRegistryProductionCommandCenterRestoreReceipt {
    const resolved = assertProductionRoot(productionRoot);
    const manifestPath = path.join(resolved, 'manifest.json');
    const manifest = fs.existsSync(manifestPath)
      ? readJson<unknown>(manifestPath)
      : undefined;

    if (!isManifest(manifest)) {
      return this.receipt({
        productionRoot: resolved,
        manifestPath,
        validations: [
          validation({
            relativePath: 'manifest.json',
            status: 'manifest-invalid',
            reason: 'production manifest is missing or invalid',
            productionSnapshotReadActuallyPerformed: fs.existsSync(manifestPath),
          }),
        ],
        snapshots: [],
      });
    }

    const validationResults = manifest.snapshots.map((snapshot) => validateSnapshot(resolved, snapshot));
    return this.receipt({
      productionRoot: resolved,
      manifestPath,
      validations: validationResults.map((result) => result.validation),
      snapshots: validationResults
        .map((result) => result.snapshot)
        .filter((snapshot): snapshot is ZavorthNativeRegistryProductionPersistedSnapshot => Boolean(snapshot)),
    });
  }

  public lookup(
    receipt: ZavorthNativeRegistryProductionCommandCenterRestoreReceipt,
    registryKind: ZavorthNativeRegistryPersistenceKind,
  ): ZavorthNativeRegistryProductionCommandCenterLookupResult {
    const found = receipt.views.find((entry) => entry.registryKind === registryKind);
    return {
      nativeContract: 'ZavorthNativeRegistryProductionCommandCenterLookupResult/v1',
      registryKind,
      found: Boolean(found),
      ...(found ? { view: found } : {}),
      runtimeExternalExecutorRequiredForProductionLoadedLookup: false,
      adapterDefaultPathForNativeReadySurfaces: false,
      rawSecretSerialized: false,
    };
  }

  public renderCommandCenter(
    receipt: ZavorthNativeRegistryProductionCommandCenterRestoreReceipt,
  ): ZavorthNativeRegistryProductionCommandCenterProjection {
    return {
      nativeContract: 'ZavorthNativeRegistryProductionCommandCenterProjection/v1',
      generatedAt: receipt.restoredAt,
      rows: receipt.views.map((entry): ZavorthNativeRegistryProductionCommandCenterProjectionRow => ({
        nativeContract: 'ZavorthNativeRegistryProductionCommandCenterProjectionRow/v1',
        id: entry.id,
        registryKind: entry.registryKind,
        label: entry.label,
        summary: entry.summary,
        status: entry.status,
        recordCount: entry.recordCount,
        productionBacked: true,
        sourceIdentityPublic: false,
        sourceRuntimeAuthority: false,
        executionAuthority: false,
        rawSecretSerialized: false,
      })),
      commandCenterProductionBackedNativeFirst: true,
      runtimeExternalExecutorRequiredForProductionLoadedRender: false,
      adapterDefaultPathForNativeReadySurfaces: false,
      adapterRefreshAllowed: true,
      sourceIdentityPublic: false,
      rawSecretSerialized: false,
    };
  }

  public cleanup(productionRoot: string): ZavorthNativeRegistryProductionCommandCenterCleanupReceipt {
    const resolved = assertProductionRoot(productionRoot);
    if (!resolved.includes(`${path.sep}.tmp${path.sep}`)) {
      throw new Error(`Production cleanup is only allowed for controlled test namespace: ${resolved}`);
    }

    const existedBefore = fs.existsSync(resolved);
    if (existedBefore) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }

    return {
      nativeContract: 'ZavorthNativeRegistryProductionCommandCenterCleanupReceipt/v1',
      productionRoot: resolved,
      cleanupActuallyPerformed: existedBefore,
      namespaceExistsAfterCleanup: fs.existsSync(resolved),
      cleanupLimitedToControlledTestNamespace: true,
      sourceFileCopied: false,
      sourceDbCopied: false,
      rawSecretSerialized: false,
    };
  }

  private receipt(input: {
    productionRoot: string;
    manifestPath: string;
    validations: ZavorthNativeRegistryProductionCommandCenterValidation[];
    snapshots: ZavorthNativeRegistryProductionPersistedSnapshot[];
  }): ZavorthNativeRegistryProductionCommandCenterRestoreReceipt {
    const views = input.snapshots.map(view);
    const allValid = input.validations.length > 0 &&
      input.validations.every((entry) => entry.status === 'valid') &&
      views.length === input.validations.length;

    return {
      nativeContract: 'ZavorthNativeRegistryProductionCommandCenterRestoreReceipt/v1',
      runtimeId: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_RESTORE_COMMAND_CENTER_RUNTIME_ID,
      decision: allValid ? 'production-restore-load-command-center-ready' : 'blocked',
      restoredAt: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_RESTORE_COMMAND_CENTER_NOW,
      productionRoot: input.productionRoot,
      productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
      productionNamespaceUri: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI,
      manifestPath: input.manifestPath,
      validations: input.validations,
      views,
      productionRestoreLoadPathCreated: true,
      productionSnapshotReadActuallyPerformed: true,
      commandCenterProductionBackedNativeFirst: true,
      runtimeExternalExecutorRequiredForProductionLoadedLookup: false,
      runtimeExternalExecutorRequiredForProductionLoadedRender: false,
      adapterDefaultPathForNativeReadySurfaces: false,
      adapterRefreshAllowed: true,
      adapterRemovalAllowed: false,
      stateMigrated: false,
      sourceFileCopied: false,
      sourceDbCopied: false,
      sourceRuntimeAuthority: false,
      executionAuthority: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      rawSecretSerialized: false,
    };
  }
}

export function createZavorthNativeRegistryProductionRestoreLoadCommandCenterFixture(): ZavorthNativeRegistryProductionRestoreLoadCommandCenter {
  return new ZavorthNativeRegistryProductionRestoreLoadCommandCenter();
}
