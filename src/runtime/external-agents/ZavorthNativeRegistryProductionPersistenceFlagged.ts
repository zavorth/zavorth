import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
} from './ZavorthNativeRegistryPersistenceDryRun.js';
import {
  ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
  ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI,
  normalizeZavorthNativeRegistryProductionStorageDesignFixture,
} from './ZavorthNativeRegistryProductionStorageDesign.js';
import type {
  ZavorthNativeRegistryPersistenceKind,
  ZavorthNativeRegistryPersistenceRedactionEnvelope,
} from './ZavorthNativeRegistryPersistenceDryRun.js';
import type {
  ZavorthNativeRegistryProductionBackupRollbackStrategy,
  ZavorthNativeRegistryProductionSnapshotPlan,
  ZavorthNativeRegistryProductionStorageDesignNormalization,
} from './ZavorthNativeRegistryProductionStorageDesign.js';

export const ZAVORTH_NATIVE_REGISTRY_PRODUCTION_PERSISTENCE_FLAGGED_NOW = '2026-04-29T06:30:00.000Z' as const;
export const ZAVORTH_NATIVE_REGISTRY_PRODUCTION_PERSISTENCE_FLAGGED_RUNTIME_ID = 'zavorth-native-registry-production-persistence-flagged' as const;
export const ZAVORTH_NATIVE_REGISTRY_PRODUCTION_WRITE_FLAG = 'ZAVORTH_NATIVE_REGISTRY_PRODUCTION_WRITE' as const;

export type ZavorthNativeRegistryProductionPersistenceDecision =
  | 'blocked'
  | 'native-registry-production-persistence-ready'
  | 'production-write-blocked';

export type ZavorthNativeRegistryProductionSnapshotWriteStatus =
  | 'already-present'
  | 'checksum-conflict'
  | 'written';

export type ZavorthNativeRegistryProductionPersistenceValidationStatus =
  | 'checksum-invalid'
  | 'feature-flag-disabled'
  | 'idempotency-invalid'
  | 'redaction-invalid'
  | 'schema-invalid'
  | 'source-not-ready'
  | 'valid';

export type ZavorthNativeRegistryProductionFeatureFlagGate = {
  nativeContract: 'ZavorthNativeRegistryProductionFeatureFlagGate/v1';
  flagName: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_WRITE_FLAG;
  enabled: boolean;
  safetyGate: 'controlled-test' | 'controlled-production';
  operatorAcknowledgedZavorthOwnedNamespace: boolean;
  productionPersistenceFeatureFlagRequired: true;
};

export type ZavorthNativeRegistryProductionPersistedSnapshot = {
  nativeContract: 'ZavorthNativeRegistryProductionPersistedSnapshot/v1';
  productionNamespace: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE;
  productionNamespaceUri: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI;
  persistedAt: string;
  registryKind: ZavorthNativeRegistryPersistenceKind;
  registryId: string;
  schemaVersion: typeof ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION;
  schemaName: string;
  recordCount: number;
  checksumAlgorithm: 'sha256-stable-metadata';
  contentChecksum: string;
  idempotencyKey: string;
  redactionEnvelope: ZavorthNativeRegistryPersistenceRedactionEnvelope;
  rollback: ZavorthNativeRegistryProductionBackupRollbackStrategy;
  backupRollbackMetadataCreated: true;
  provenance: {
    internalOnly: true;
    redacted: true;
    sourceRuntimeAuthority: false;
    sourceRuntimePublicIdentity: false;
  };
  payloadSensitiveFieldsPersisted: false;
  runtimeExternalExecutorRequiredForProductionLookup: false;
  runtimeExternalExecutorRequiredForProductionWrite: false;
  sourceRuntimeAuthority: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryProductionSnapshotWriteReceipt = {
  nativeContract: 'ZavorthNativeRegistryProductionSnapshotWriteReceipt/v1';
  registryKind: ZavorthNativeRegistryPersistenceKind;
  idempotencyKey: string;
  contentChecksum: string;
  relativePath: string;
  status: ZavorthNativeRegistryProductionSnapshotWriteStatus;
  bytesWritten: number;
  atomicWriteUsed: true;
  productionWriteActuallyPerformed: boolean;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryProductionManifest = {
  nativeContract: 'ZavorthNativeRegistryProductionManifest/v1';
  productionNamespace: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE;
  productionNamespaceUri: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI;
  persistedAt: string;
  schemaVersion: typeof ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION;
  snapshotCount: number;
  snapshots: Array<{
    registryKind: ZavorthNativeRegistryPersistenceKind;
    idempotencyKey: string;
    contentChecksum: string;
    relativePath: string;
    status: ZavorthNativeRegistryProductionSnapshotWriteStatus;
  }>;
  backupRollbackMetadataCreated: true;
  rawSecretSerialized: false;
  runtimeExternalExecutorRequiredForProductionLookup: false;
};

export type ZavorthNativeRegistryProductionBackupRollbackManifest = {
  nativeContract: 'ZavorthNativeRegistryProductionBackupRollbackManifest/v1';
  productionNamespace: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE;
  persistedAt: string;
  manifestPath: string;
  restoreManifestPath: string;
  rollbackReceiptPath: string;
  backupRollbackMetadataCreated: true;
  backupActuallyCreated: false;
  restoreActuallyPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryProductionPersistenceReceipt = {
  nativeContract: 'ZavorthNativeRegistryProductionPersistenceReceipt/v1';
  runtimeId: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_PERSISTENCE_FLAGGED_RUNTIME_ID;
  decision: ZavorthNativeRegistryProductionPersistenceDecision;
  persistedAt: string;
  productionRoot: string;
  productionNamespace: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE;
  productionNamespaceUri: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI;
  featureFlag: ZavorthNativeRegistryProductionFeatureFlagGate;
  validations: ZavorthNativeRegistryProductionPersistenceValidationStatus[];
  snapshotWrites: ZavorthNativeRegistryProductionSnapshotWriteReceipt[];
  manifestPath: string;
  backupRollbackManifestPath: string;
  idempotencyAvoidedDuplicateWrites: boolean;
  productionPersistenceFeatureFlagRequired: true;
  productionWriteActuallyPerformedOnlyWhenFlagEnabled: true;
  productionNamespaceZavorthOwned: true;
  backupRollbackMetadataCreated: boolean;
  runtimeExternalExecutorRequiredForProductionWrite: false;
  runtimeExternalExecutorRequiredForProductionLookup: false;
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

export type ZavorthNativeRegistryProductionLoadedSnapshot = {
  nativeContract: 'ZavorthNativeRegistryProductionLoadedSnapshot/v1';
  registryKind: ZavorthNativeRegistryPersistenceKind;
  registryId: string;
  schemaVersion: typeof ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION;
  recordCount: number;
  contentChecksum: string;
  idempotencyKey: string;
  runtimeExternalExecutorRequiredForProductionLookup: false;
  sourceRuntimeAuthority: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryProductionLoadReceipt = {
  nativeContract: 'ZavorthNativeRegistryProductionLoadReceipt/v1';
  decision: 'blocked' | 'production-snapshot-load-ready';
  productionRoot: string;
  productionNamespace: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE;
  loadedSnapshots: ZavorthNativeRegistryProductionLoadedSnapshot[];
  runtimeExternalExecutorRequiredForProductionLookup: false;
  sourceRuntimeAuthority: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryProductionLookupResult = {
  nativeContract: 'ZavorthNativeRegistryProductionLookupResult/v1';
  registryKind: ZavorthNativeRegistryPersistenceKind;
  found: boolean;
  snapshot?: ZavorthNativeRegistryProductionLoadedSnapshot;
  runtimeExternalExecutorRequiredForProductionLookup: false;
  sourceRuntimeAuthority: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryProductionCleanupReceipt = {
  nativeContract: 'ZavorthNativeRegistryProductionCleanupReceipt/v1';
  productionRoot: string;
  cleanupActuallyPerformed: boolean;
  namespaceExistsAfterCleanup: boolean;
  cleanupLimitedToControlledTestNamespace: true;
  sourceFileCopied: false;
  sourceDbCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryProductionPersistenceFlaggedSource = {
  design: ZavorthNativeRegistryProductionStorageDesignNormalization;
  adapterRetainedAsFallbackRefresh: boolean;
  rawSecretSerialized: boolean;
  sourceStateMigrationAttempted: boolean;
  sourceFileCopyAttempted: boolean;
  sourceDbCopyAttempted: boolean;
  sourceDbWriteOpenAttempted: boolean;
  executionAttempted: boolean;
  externalExecutorLiveRequiredForProductionWrite: boolean;
};

export type ZavorthNativeRegistryProductionPersistenceOptions = {
  productionRoot: string;
  featureFlag: ZavorthNativeRegistryProductionFeatureFlagGate;
  persistedAt?: string;
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

function relativePathForSnapshot(snapshot: ZavorthNativeRegistryProductionSnapshotPlan): string {
  return path.join('native-registries', snapshot.registryKind, `${snapshot.idempotencyKey}.json`);
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

function sourceValid(source: ZavorthNativeRegistryProductionPersistenceFlaggedSource): ZavorthNativeRegistryProductionPersistenceValidationStatus[] {
  const statuses: ZavorthNativeRegistryProductionPersistenceValidationStatus[] = [];

  if (source.design.decision !== 'native-registry-production-storage-design-ready' || !source.adapterRetainedAsFallbackRefresh) {
    statuses.push('source-not-ready');
  }
  if (source.rawSecretSerialized) {
    statuses.push('redaction-invalid');
  }
  if (source.sourceStateMigrationAttempted || source.sourceFileCopyAttempted || source.sourceDbCopyAttempted ||
    source.sourceDbWriteOpenAttempted || source.executionAttempted || source.externalExecutorLiveRequiredForProductionWrite) {
    statuses.push('source-not-ready');
  }
  if (source.design.plan.snapshots.some((snapshot) => snapshot.schemaVersion !== ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION)) {
    statuses.push('schema-invalid');
  }
  if (source.design.plan.snapshots.some((snapshot) => !redactionEnvelopeValid(snapshot.redactionEnvelope))) {
    statuses.push('redaction-invalid');
  }

  return statuses;
}

function persistedSnapshot(
  snapshot: ZavorthNativeRegistryProductionSnapshotPlan,
  persistedAt: string,
): ZavorthNativeRegistryProductionPersistedSnapshot {
  return {
    nativeContract: 'ZavorthNativeRegistryProductionPersistedSnapshot/v1',
    productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
    productionNamespaceUri: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI,
    persistedAt,
    registryKind: snapshot.registryKind,
    registryId: snapshot.registryId,
    schemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
    schemaName: snapshot.schemaName,
    recordCount: snapshot.recordCount,
    checksumAlgorithm: 'sha256-stable-metadata',
    contentChecksum: snapshot.contentChecksum,
    idempotencyKey: snapshot.idempotencyKey,
    redactionEnvelope: snapshot.redactionEnvelope,
    rollback: snapshot.backupRollback,
    backupRollbackMetadataCreated: true,
    provenance: {
      internalOnly: true,
      redacted: true,
      sourceRuntimeAuthority: false,
      sourceRuntimePublicIdentity: false,
    },
    payloadSensitiveFieldsPersisted: false,
    runtimeExternalExecutorRequiredForProductionLookup: false,
    runtimeExternalExecutorRequiredForProductionWrite: false,
    sourceRuntimeAuthority: false,
    rawSecretSerialized: false,
  };
}

function readJson<TValue>(filePath: string): TValue | undefined {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as TValue;
  } catch {
    return undefined;
  }
}

function writeJsonAtomic(
  absolutePath: string,
  payload: ZavorthNativeRegistryProductionPersistedSnapshot | ZavorthNativeRegistryProductionManifest | ZavorthNativeRegistryProductionBackupRollbackManifest,
): Pick<ZavorthNativeRegistryProductionSnapshotWriteReceipt, 'bytesWritten' | 'productionWriteActuallyPerformed' | 'status'> {
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;

  if (fs.existsSync(absolutePath) && payload.nativeContract === 'ZavorthNativeRegistryProductionPersistedSnapshot/v1') {
    const current = readJson<ZavorthNativeRegistryProductionPersistedSnapshot>(absolutePath);
    if (
      current?.contentChecksum === payload.contentChecksum &&
      current.idempotencyKey === payload.idempotencyKey &&
      current.schemaVersion === payload.schemaVersion &&
      !current.rawSecretSerialized
    ) {
      return {
        bytesWritten: 0,
        productionWriteActuallyPerformed: false,
        status: 'already-present',
      };
    }

    return {
      bytesWritten: 0,
      productionWriteActuallyPerformed: false,
      status: 'checksum-conflict',
    };
  }

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const tempPath = `${absolutePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, serialized, 'utf8');
  fs.renameSync(tempPath, absolutePath);

  return {
    bytesWritten: Buffer.byteLength(serialized, 'utf8'),
    productionWriteActuallyPerformed: true,
    status: 'written',
  };
}

function featureFlag(enabled: boolean): ZavorthNativeRegistryProductionFeatureFlagGate {
  return {
    nativeContract: 'ZavorthNativeRegistryProductionFeatureFlagGate/v1',
    flagName: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_WRITE_FLAG,
    enabled,
    safetyGate: 'controlled-test',
    operatorAcknowledgedZavorthOwnedNamespace: true,
    productionPersistenceFeatureFlagRequired: true,
  };
}

export class ZavorthNativeRegistryProductionPersistenceFlagged {
  public constructor(private readonly source: ZavorthNativeRegistryProductionPersistenceFlaggedSource) {}

  public persist(options: ZavorthNativeRegistryProductionPersistenceOptions): ZavorthNativeRegistryProductionPersistenceReceipt {
    const productionRoot = assertProductionRoot(options.productionRoot);
    const persistedAt = options.persistedAt ?? ZAVORTH_NATIVE_REGISTRY_PRODUCTION_PERSISTENCE_FLAGGED_NOW;
    const baseValidations = sourceValid(this.source);
    const validations = options.featureFlag.enabled
      ? baseValidations
      : [...baseValidations, 'feature-flag-disabled' as const];

    if (validations.length > 0) {
      return this.receipt({
        productionRoot,
        persistedAt,
        featureFlag: options.featureFlag,
        validations,
        snapshotWrites: [],
        backupRollbackMetadataCreated: false,
      });
    }

    const snapshotWrites = this.source.design.plan.snapshots.map((snapshot): ZavorthNativeRegistryProductionSnapshotWriteReceipt => {
      const relativePath = relativePathForSnapshot(snapshot);
      const absolutePath = path.join(productionRoot, relativePath);
      const payload = persistedSnapshot(snapshot, persistedAt);
      const write = writeJsonAtomic(absolutePath, payload);

      return {
        nativeContract: 'ZavorthNativeRegistryProductionSnapshotWriteReceipt/v1',
        registryKind: snapshot.registryKind,
        idempotencyKey: snapshot.idempotencyKey,
        contentChecksum: snapshot.contentChecksum,
        relativePath,
        status: write.status,
        bytesWritten: write.bytesWritten,
        atomicWriteUsed: true,
        productionWriteActuallyPerformed: write.productionWriteActuallyPerformed,
        rawSecretSerialized: false,
      };
    });

    const allWritesSafe = snapshotWrites.every((write) => write.status === 'written' || write.status === 'already-present');
    const manifest: ZavorthNativeRegistryProductionManifest = {
      nativeContract: 'ZavorthNativeRegistryProductionManifest/v1',
      productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
      productionNamespaceUri: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI,
      persistedAt,
      schemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
      snapshotCount: snapshotWrites.length,
      snapshots: snapshotWrites.map((write) => ({
        registryKind: write.registryKind,
        idempotencyKey: write.idempotencyKey,
        contentChecksum: write.contentChecksum,
        relativePath: write.relativePath,
        status: write.status,
      })),
      backupRollbackMetadataCreated: true,
      rawSecretSerialized: false,
      runtimeExternalExecutorRequiredForProductionLookup: false,
    };
    const manifestPath = path.join(productionRoot, 'manifest.json');
    writeJsonAtomic(manifestPath, manifest);

    const backupRollback: ZavorthNativeRegistryProductionBackupRollbackManifest = {
      nativeContract: 'ZavorthNativeRegistryProductionBackupRollbackManifest/v1',
      productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
      persistedAt,
      manifestPath,
      restoreManifestPath: path.join(productionRoot, 'restore-manifest.json'),
      rollbackReceiptPath: path.join(productionRoot, 'rollback-receipt.json'),
      backupRollbackMetadataCreated: true,
      backupActuallyCreated: false,
      restoreActuallyPerformed: false,
      rawSecretSerialized: false,
    };
    const backupRollbackManifestPath = path.join(productionRoot, 'rollback', 'backup-rollback-manifest.json');
    writeJsonAtomic(backupRollbackManifestPath, backupRollback);

    return this.receipt({
      productionRoot,
      persistedAt,
      featureFlag: options.featureFlag,
      validations: allWritesSafe ? ['valid'] : ['checksum-invalid'],
      snapshotWrites,
      backupRollbackMetadataCreated: true,
    });
  }

  public load(productionRoot: string): ZavorthNativeRegistryProductionLoadReceipt {
    const resolved = assertProductionRoot(productionRoot);
    const manifest = readJson<ZavorthNativeRegistryProductionManifest>(path.join(resolved, 'manifest.json'));

    if (
      manifest?.nativeContract !== 'ZavorthNativeRegistryProductionManifest/v1' ||
      manifest.productionNamespace !== ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE ||
      manifest.rawSecretSerialized !== false
    ) {
      return {
        nativeContract: 'ZavorthNativeRegistryProductionLoadReceipt/v1',
        decision: 'blocked',
        productionRoot: resolved,
        productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
        loadedSnapshots: [],
        runtimeExternalExecutorRequiredForProductionLookup: false,
        sourceRuntimeAuthority: false,
        rawSecretSerialized: false,
      };
    }

    const loadedSnapshots = manifest.snapshots.map((entry) => {
      const snapshot = readJson<ZavorthNativeRegistryProductionPersistedSnapshot>(path.join(resolved, entry.relativePath));
      if (
        snapshot?.nativeContract !== 'ZavorthNativeRegistryProductionPersistedSnapshot/v1' ||
        snapshot.contentChecksum !== entry.contentChecksum ||
        snapshot.idempotencyKey !== entry.idempotencyKey ||
        snapshot.schemaVersion !== ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION ||
        snapshot.rawSecretSerialized
      ) {
        return undefined;
      }

      return {
        nativeContract: 'ZavorthNativeRegistryProductionLoadedSnapshot/v1' as const,
        registryKind: snapshot.registryKind,
        registryId: snapshot.registryId,
        schemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
        recordCount: snapshot.recordCount,
        contentChecksum: snapshot.contentChecksum,
        idempotencyKey: snapshot.idempotencyKey,
        runtimeExternalExecutorRequiredForProductionLookup: false as const,
        sourceRuntimeAuthority: false as const,
        rawSecretSerialized: false as const,
      };
    }).filter((entry): entry is ZavorthNativeRegistryProductionLoadedSnapshot => Boolean(entry));

    return {
      nativeContract: 'ZavorthNativeRegistryProductionLoadReceipt/v1',
      decision: loadedSnapshots.length === manifest.snapshotCount ? 'production-snapshot-load-ready' : 'blocked',
      productionRoot: resolved,
      productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
      loadedSnapshots,
      runtimeExternalExecutorRequiredForProductionLookup: false,
      sourceRuntimeAuthority: false,
      rawSecretSerialized: false,
    };
  }

  public lookup(
    receipt: ZavorthNativeRegistryProductionLoadReceipt,
    registryKind: ZavorthNativeRegistryPersistenceKind,
  ): ZavorthNativeRegistryProductionLookupResult {
    const snapshot = receipt.loadedSnapshots.find((entry) => entry.registryKind === registryKind);
    return {
      nativeContract: 'ZavorthNativeRegistryProductionLookupResult/v1',
      registryKind,
      found: Boolean(snapshot),
      ...(snapshot ? { snapshot } : {}),
      runtimeExternalExecutorRequiredForProductionLookup: false,
      sourceRuntimeAuthority: false,
      rawSecretSerialized: false,
    };
  }

  public cleanup(productionRoot: string): ZavorthNativeRegistryProductionCleanupReceipt {
    const resolved = assertProductionRoot(productionRoot);
    if (!resolved.includes(`${path.sep}.tmp${path.sep}`)) {
      throw new Error(`Production cleanup is only allowed for controlled test namespace: ${resolved}`);
    }

    const existedBefore = fs.existsSync(resolved);
    if (existedBefore) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }

    return {
      nativeContract: 'ZavorthNativeRegistryProductionCleanupReceipt/v1',
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
    persistedAt: string;
    featureFlag: ZavorthNativeRegistryProductionFeatureFlagGate;
    validations: ZavorthNativeRegistryProductionPersistenceValidationStatus[];
    snapshotWrites: ZavorthNativeRegistryProductionSnapshotWriteReceipt[];
    backupRollbackMetadataCreated: boolean;
  }): ZavorthNativeRegistryProductionPersistenceReceipt {
    const decision: ZavorthNativeRegistryProductionPersistenceDecision = input.validations.includes('feature-flag-disabled')
      ? 'production-write-blocked'
      : input.validations.length === 1 && input.validations[0] === 'valid'
        ? 'native-registry-production-persistence-ready'
        : 'blocked';

    return {
      nativeContract: 'ZavorthNativeRegistryProductionPersistenceReceipt/v1',
      runtimeId: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_PERSISTENCE_FLAGGED_RUNTIME_ID,
      decision,
      persistedAt: input.persistedAt,
      productionRoot: input.productionRoot,
      productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
      productionNamespaceUri: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI,
      featureFlag: input.featureFlag,
      validations: Array.from(new Set(input.validations)),
      snapshotWrites: input.snapshotWrites,
      manifestPath: path.join(input.productionRoot, 'manifest.json'),
      backupRollbackManifestPath: path.join(input.productionRoot, 'rollback', 'backup-rollback-manifest.json'),
      idempotencyAvoidedDuplicateWrites: input.snapshotWrites.some((write) => write.status === 'already-present'),
      productionPersistenceFeatureFlagRequired: true,
      productionWriteActuallyPerformedOnlyWhenFlagEnabled: true,
      productionNamespaceZavorthOwned: true,
      backupRollbackMetadataCreated: input.backupRollbackMetadataCreated,
      runtimeExternalExecutorRequiredForProductionWrite: false,
      runtimeExternalExecutorRequiredForProductionLookup: false,
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

export function createZavorthNativeRegistryProductionPersistenceFlaggedFixtureSource(
  overrides: Partial<ZavorthNativeRegistryProductionPersistenceFlaggedSource> = {},
): ZavorthNativeRegistryProductionPersistenceFlaggedSource {
  return {
    design: normalizeZavorthNativeRegistryProductionStorageDesignFixture(),
    adapterRetainedAsFallbackRefresh: true,
    rawSecretSerialized: false,
    sourceStateMigrationAttempted: false,
    sourceFileCopyAttempted: false,
    sourceDbCopyAttempted: false,
    sourceDbWriteOpenAttempted: false,
    executionAttempted: false,
    externalExecutorLiveRequiredForProductionWrite: false,
    ...overrides,
  };
}

export function createZavorthNativeRegistryProductionPersistenceFlaggedFixture(
  source: ZavorthNativeRegistryProductionPersistenceFlaggedSource = createZavorthNativeRegistryProductionPersistenceFlaggedFixtureSource(),
): ZavorthNativeRegistryProductionPersistenceFlagged {
  return new ZavorthNativeRegistryProductionPersistenceFlagged(source);
}

export function createZavorthNativeRegistryProductionPersistenceFeatureFlag(
  enabled: boolean,
): ZavorthNativeRegistryProductionFeatureFlagGate {
  return featureFlag(enabled);
}
