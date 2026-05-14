import {
  ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
  normalizeZavorthNativeRegistryPersistenceDryRunFixture,
} from './ZavorthNativeRegistryPersistenceDryRun.js';
import type {
  ZavorthNativeRegistryPersistenceDryRunNormalization,
  ZavorthNativeRegistryPersistenceKind,
  ZavorthNativeRegistryPersistenceRedactionEnvelope,
  ZavorthNativeRegistryPersistenceSnapshot,
} from './ZavorthNativeRegistryPersistenceDryRun.js';

export const ZAVORTH_NATIVE_REGISTRY_PRODUCTION_STORAGE_DESIGN_NOW = '2026-04-29T06:00:00.000Z' as const;
export const ZAVORTH_NATIVE_REGISTRY_PRODUCTION_STORAGE_DESIGN_RUNTIME_ID = 'zavorth-native-registry-production-storage-design' as const;
export const ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE = 'zavorth-owned-native-registry-production' as const;
export const ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI = 'zavorth://native-registries/production/v1' as const;
export const ZAVORTH_NATIVE_REGISTRY_PRODUCTION_STORAGE_ROOT_PREVIEW = '.zavorth/native-registries/production/v1' as const;

export type ZavorthNativeRegistryProductionStorageDesignDecision =
  | 'blocked'
  | 'native-registry-production-storage-design-ready';

export type ZavorthNativeRegistryProductionStorageRefreshMode =
  | 'disabled'
  | 'manual'
  | 'scheduled-future'
  | 'live-adapter-optional'
  | 'blocked';

export type ZavorthNativeRegistryProductionStorageValidationStatus =
  | 'namespace-invalid'
  | 'production-write-attempted'
  | 'raw-secret-blocked'
  | 'redaction-envelope-missing'
  | 'schema-invalid'
  | 'source-not-ready'
  | 'valid';

export type ZavorthNativeRegistryProductionAtomicWriteStrategy = {
  nativeContract: 'ZavorthNativeRegistryProductionAtomicWriteStrategy/v1';
  strategy: 'write-temp-fsync-rename';
  tempPathPreview: string;
  finalPathPreview: string;
  manifestCommitOrder: 'snapshots-before-manifest';
  lockRequired: true;
  productionWriteActuallyPerformed: false;
};

export type ZavorthNativeRegistryProductionLockStrategy = {
  nativeContract: 'ZavorthNativeRegistryProductionLockStrategy/v1';
  lockScope: 'namespace-manifest';
  lockPathPreview: string;
  lockMode: 'exclusive-single-writer';
  staleLockPolicy: 'future-timeout-and-audit-only';
  concurrentWriterPolicy: 'reject-or-retry-future';
  lockActuallyAcquired: false;
};

export type ZavorthNativeRegistryProductionBackupRollbackStrategy = {
  nativeContract: 'ZavorthNativeRegistryProductionBackupRollbackStrategy/v1';
  backupManifestPathPreview: string;
  restoreManifestPathPreview: string;
  rollbackReceiptPathPreview: string;
  backupBeforeCommitRequired: true;
  restoreLoadValidationRequired: true;
  checksumValidationRequired: true;
  rollbackOnPartialCommitRequired: true;
  backupActuallyCreated: false;
  restoreActuallyPerformed: false;
};

export type ZavorthNativeRegistryProductionRetentionCleanupStrategy = {
  nativeContract: 'ZavorthNativeRegistryProductionRetentionCleanupStrategy/v1';
  keepLatestManifests: 5;
  keepLatestSnapshotsPerRegistry: 3;
  cleanupRequiresVerifiedBackup: true;
  cleanupDeletesOnlyZavorthOwnedNamespace: true;
  cleanupActuallyPerformed: false;
};

export type ZavorthNativeRegistryProductionMigrationGuardrails = {
  nativeContract: 'ZavorthNativeRegistryProductionMigrationGuardrails/v1';
  stateMigrated: false;
  sourceFileCopied: false;
  sourceDbCopied: false;
  sourceDbOpenedForWrite: false;
  externalExecutorLiveRequiredForLookup: false;
  externalExecutorLiveRequiredForRender: false;
  sourceRuntimeAuthority: false;
  adapterRemovalAllowed: false;
};

export type ZavorthNativeRegistryProductionSnapshotPlan = {
  nativeContract: 'ZavorthNativeRegistryProductionSnapshotPlan/v1';
  productionNamespace: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE;
  productionNamespaceUri: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI;
  registryKind: ZavorthNativeRegistryPersistenceKind;
  registryId: string;
  schemaVersion: string;
  schemaName: string;
  recordCount: number;
  contentChecksum: string;
  idempotencyKey: string;
  productionPathPreview: string;
  manifestEntryPathPreview: string;
  redactionEnvelope: ZavorthNativeRegistryPersistenceRedactionEnvelope;
  redactionEnvelopeRequired: true;
  atomicWrite: ZavorthNativeRegistryProductionAtomicWriteStrategy;
  lock: ZavorthNativeRegistryProductionLockStrategy;
  backupRollback: ZavorthNativeRegistryProductionBackupRollbackStrategy;
  migrationGuardrails: ZavorthNativeRegistryProductionMigrationGuardrails;
  productionWriteActuallyPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryProductionManifestPlan = {
  nativeContract: 'ZavorthNativeRegistryProductionManifestPlan/v1';
  productionNamespace: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE;
  productionNamespaceUri: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI;
  schemaVersion: typeof ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION;
  manifestPathPreview: string;
  snapshotCount: number;
  totalRecordCount: number;
  checksumAlgorithm: 'sha256-stable-metadata';
  idempotencyStrategy: 'content-addressed-idempotency-key';
  atomicWriteStrategy: 'write-temp-fsync-rename';
  redactionEnvelopeRequired: true;
  productionWriteActuallyPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryProductionCommandCenterConsumptionPlan = {
  nativeContract: 'ZavorthNativeRegistryProductionCommandCenterConsumptionPlan/v1';
  commandCenterProductionLoadedRegistryPointer: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI;
  defaultLookupPath: 'production-loaded-native-registry';
  defaultRenderPath: 'production-loaded-native-registry';
  adapterRefreshAllowedExplicitly: true;
  runtimeExternalExecutorRequiredForProductionLookup: false;
  runtimeExternalExecutorRequiredForProductionRender: false;
  publicSourceIdentityExposed: false;
};

export type ZavorthNativeRegistryProductionRefreshReconciliationPlan = {
  nativeContract: 'ZavorthNativeRegistryProductionRefreshReconciliationPlan/v1';
  refreshModes: ZavorthNativeRegistryProductionStorageRefreshMode[];
  defaultRefreshMode: 'manual';
  refreshSourceRole: 'optional-refresh-source';
  reconciliationFrom193RequiredBeforeCommit: true;
  dryRunDiffRequiredBeforeCommit: true;
  productionCommitRequiresFutureGate: true;
  externalExecutorRequiredForLookupOrRender: false;
};

export type ZavorthNativeRegistryProductionAuditReceiptPlan = {
  nativeContract: 'ZavorthNativeRegistryProductionAuditReceiptPlan/v1';
  receiptPathPreview: string;
  receiptRedacted: true;
  includesManifestChecksum: true;
  includesIdempotencyKeys: true;
  includesBackupRestoreRefs: true;
  includesRefreshReconciliationRefs: true;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryProductionStoragePlan = {
  nativeContract: 'ZavorthNativeRegistryProductionStoragePlan/v1';
  generatedAt: string;
  productionNamespace: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE;
  productionNamespaceUri: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI;
  productionStorageRootPreview: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_STORAGE_ROOT_PREVIEW;
  manifest: ZavorthNativeRegistryProductionManifestPlan;
  snapshots: ZavorthNativeRegistryProductionSnapshotPlan[];
  retentionCleanup: ZavorthNativeRegistryProductionRetentionCleanupStrategy;
  commandCenterConsumption: ZavorthNativeRegistryProductionCommandCenterConsumptionPlan;
  refreshReconciliation: ZavorthNativeRegistryProductionRefreshReconciliationPlan;
  auditReceipt: ZavorthNativeRegistryProductionAuditReceiptPlan;
  validationStatuses: ZavorthNativeRegistryProductionStorageValidationStatus[];
  productionStorageDesignCreated: true;
  productionWriteActuallyPerformed: false;
  runtimeExternalExecutorRequiredForProductionLookup: false;
  runtimeExternalExecutorRequiredForProductionRender: false;
  sourceRuntimeAuthority: false;
  stateMigrated: false;
  sourceFileCopied: false;
  sourceDbCopied: false;
  sourceDbOpenedForWrite: false;
  executionAuthority: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  rawSecretSerialized: false;
  adapterRemovalAllowed: false;
};

export type ZavorthNativeRegistryProductionStorageReceipt = {
  nativeContract: 'ZavorthNativeRegistryProductionStorageReceipt/v1';
  id: string;
  decision: ZavorthNativeRegistryProductionStorageDesignDecision;
  productionNamespace: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE;
  productionNamespaceUri: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI;
  validationStatuses: ZavorthNativeRegistryProductionStorageValidationStatus[];
  snapshotCount: number;
  totalRecordCount: number;
  productionStorageDesignCreated: true;
  productionWriteActuallyPerformed: false;
  runtimeExternalExecutorRequiredForProductionLookup: false;
  runtimeExternalExecutorRequiredForProductionRender: false;
  sourceRuntimeAuthority: false;
  stateMigrated: false;
  sourceFileCopied: false;
  sourceDbCopied: false;
  sourceDbOpenedForWrite: false;
  executionAuthority: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  rawSecretSerialized: false;
  adapterRemovalAllowed: false;
};

export type ZavorthNativeRegistryProductionStorageExecutionGate = {
  productionStorageDesignCreated: true;
  productionWriteActuallyPerformed: false;
  runtimeExternalExecutorRequiredForProductionLookup: false;
  runtimeExternalExecutorRequiredForProductionRender: false;
  sourceRuntimeAuthority: false;
  stateMigrated: false;
  sourceFileCopied: false;
  sourceDbCopied: false;
  sourceDbOpenedForWrite: false;
  executionAuthority: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  rawSecretSerialized: false;
  adapterRemovalAllowed: false;
};

export type ZavorthNativeRegistryProductionStorageDesignSource = {
  dryRun: ZavorthNativeRegistryPersistenceDryRunNormalization;
  sandboxPersistenceDecision: 'native-registry-sandbox-persistence-ready' | 'blocked';
  sandboxRestoreDecision: 'native-registry-sandbox-restore-load-ready' | 'blocked';
  storagePatternEvidence: string[];
  productionNamespace: string;
  redactionEnvelopeRequired: boolean;
  productionWriteAttempted: boolean;
  externalExecutorRequiredForLookupOrRender: boolean;
  sourceRuntimeAuthority: boolean;
  sourceStateMigrationAttempted: boolean;
  sourceFileCopyAttempted: boolean;
  sourceDbCopyAttempted: boolean;
  sourceDbWriteOpenAttempted: boolean;
  executionAttempted: boolean;
  rawSecretSerialized: boolean;
};

export type ZavorthNativeRegistryProductionStorageDesignOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  source: ZavorthNativeRegistryProductionStorageDesignSource;
  schemaVersionOverride?: string;
};

export type ZavorthNativeRegistryProductionStorageDesignNormalization = {
  nativeContract: 'ZavorthNativeRegistryProductionStorageDesign/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthNativeRegistryProductionStorageDesignDecision;
  status: ZavorthNativeRegistryProductionStorageDesignDecision;
  sourceReadiness: {
    persistenceDryRun: ZavorthNativeRegistryPersistenceDryRunNormalization['decision'];
    sandboxPersistence: ZavorthNativeRegistryProductionStorageDesignSource['sandboxPersistenceDecision'];
    sandboxRestoreLoad: ZavorthNativeRegistryProductionStorageDesignSource['sandboxRestoreDecision'];
  };
  plan: ZavorthNativeRegistryProductionStoragePlan;
  receipt: ZavorthNativeRegistryProductionStorageReceipt;
  executionGate: ZavorthNativeRegistryProductionStorageExecutionGate;
  redaction: {
    redactionEnvelopeRequired: true;
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    sourceIdentityPublic: false;
    provenanceInternalOnly: true;
  };
  nextGateRecommended: 'future-native-registry-production-storage-dry-run-or-controlled-commit-gate';
};

function productionPath(snapshot: ZavorthNativeRegistryPersistenceSnapshot): string {
  return `${ZAVORTH_NATIVE_REGISTRY_PRODUCTION_STORAGE_ROOT_PREVIEW}/native-registries/${snapshot.registryKind}/${snapshot.idempotencyKey}.json`;
}

function manifestEntryPath(snapshot: ZavorthNativeRegistryPersistenceSnapshot): string {
  return `native-registries/${snapshot.registryKind}/${snapshot.idempotencyKey}.json`;
}

function atomicWrite(snapshot: ZavorthNativeRegistryPersistenceSnapshot): ZavorthNativeRegistryProductionAtomicWriteStrategy {
  const finalPathPreview = productionPath(snapshot);
  return {
    nativeContract: 'ZavorthNativeRegistryProductionAtomicWriteStrategy/v1',
    strategy: 'write-temp-fsync-rename',
    tempPathPreview: `${finalPathPreview}.tmp-${snapshot.idempotencyKey}`,
    finalPathPreview,
    manifestCommitOrder: 'snapshots-before-manifest',
    lockRequired: true,
    productionWriteActuallyPerformed: false,
  };
}

function lockStrategy(snapshot: ZavorthNativeRegistryPersistenceSnapshot): ZavorthNativeRegistryProductionLockStrategy {
  return {
    nativeContract: 'ZavorthNativeRegistryProductionLockStrategy/v1',
    lockScope: 'namespace-manifest',
    lockPathPreview: `${ZAVORTH_NATIVE_REGISTRY_PRODUCTION_STORAGE_ROOT_PREVIEW}/locks/${snapshot.registryKind}.lock`,
    lockMode: 'exclusive-single-writer',
    staleLockPolicy: 'future-timeout-and-audit-only',
    concurrentWriterPolicy: 'reject-or-retry-future',
    lockActuallyAcquired: false,
  };
}

function backupRollback(snapshot: ZavorthNativeRegistryPersistenceSnapshot): ZavorthNativeRegistryProductionBackupRollbackStrategy {
  const base = `${ZAVORTH_NATIVE_REGISTRY_PRODUCTION_STORAGE_ROOT_PREVIEW}/rollback/${snapshot.registryKind}/${snapshot.idempotencyKey}`;
  return {
    nativeContract: 'ZavorthNativeRegistryProductionBackupRollbackStrategy/v1',
    backupManifestPathPreview: `${base}.backup-manifest.json`,
    restoreManifestPathPreview: `${base}.restore-manifest.json`,
    rollbackReceiptPathPreview: `${base}.rollback-receipt.json`,
    backupBeforeCommitRequired: true,
    restoreLoadValidationRequired: true,
    checksumValidationRequired: true,
    rollbackOnPartialCommitRequired: true,
    backupActuallyCreated: false,
    restoreActuallyPerformed: false,
  };
}

function migrationGuardrails(): ZavorthNativeRegistryProductionMigrationGuardrails {
  return {
    nativeContract: 'ZavorthNativeRegistryProductionMigrationGuardrails/v1',
    stateMigrated: false,
    sourceFileCopied: false,
    sourceDbCopied: false,
    sourceDbOpenedForWrite: false,
    externalExecutorLiveRequiredForLookup: false,
    externalExecutorLiveRequiredForRender: false,
    sourceRuntimeAuthority: false,
    adapterRemovalAllowed: false,
  };
}

function snapshotPlan(
  snapshot: ZavorthNativeRegistryPersistenceSnapshot,
  schemaVersion: string,
): ZavorthNativeRegistryProductionSnapshotPlan {
  return {
    nativeContract: 'ZavorthNativeRegistryProductionSnapshotPlan/v1',
    productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
    productionNamespaceUri: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI,
    registryKind: snapshot.registryKind,
    registryId: snapshot.registryId,
    schemaVersion,
    schemaName: snapshot.schemaName,
    recordCount: snapshot.recordCount,
    contentChecksum: snapshot.contentChecksum,
    idempotencyKey: snapshot.idempotencyKey,
    productionPathPreview: productionPath(snapshot),
    manifestEntryPathPreview: manifestEntryPath(snapshot),
    redactionEnvelope: snapshot.redactionEnvelope,
    redactionEnvelopeRequired: true,
    atomicWrite: atomicWrite(snapshot),
    lock: lockStrategy(snapshot),
    backupRollback: backupRollback(snapshot),
    migrationGuardrails: migrationGuardrails(),
    productionWriteActuallyPerformed: false,
    rawSecretSerialized: false,
  };
}

function manifestPlan(
  snapshots: ZavorthNativeRegistryProductionSnapshotPlan[],
): ZavorthNativeRegistryProductionManifestPlan {
  return {
    nativeContract: 'ZavorthNativeRegistryProductionManifestPlan/v1',
    productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
    productionNamespaceUri: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI,
    schemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
    manifestPathPreview: `${ZAVORTH_NATIVE_REGISTRY_PRODUCTION_STORAGE_ROOT_PREVIEW}/manifest.json`,
    snapshotCount: snapshots.length,
    totalRecordCount: snapshots.reduce((total, row) => total + row.recordCount, 0),
    checksumAlgorithm: 'sha256-stable-metadata',
    idempotencyStrategy: 'content-addressed-idempotency-key',
    atomicWriteStrategy: 'write-temp-fsync-rename',
    redactionEnvelopeRequired: true,
    productionWriteActuallyPerformed: false,
    rawSecretSerialized: false,
  };
}

function retentionCleanup(): ZavorthNativeRegistryProductionRetentionCleanupStrategy {
  return {
    nativeContract: 'ZavorthNativeRegistryProductionRetentionCleanupStrategy/v1',
    keepLatestManifests: 5,
    keepLatestSnapshotsPerRegistry: 3,
    cleanupRequiresVerifiedBackup: true,
    cleanupDeletesOnlyZavorthOwnedNamespace: true,
    cleanupActuallyPerformed: false,
  };
}

function commandCenterConsumption(): ZavorthNativeRegistryProductionCommandCenterConsumptionPlan {
  return {
    nativeContract: 'ZavorthNativeRegistryProductionCommandCenterConsumptionPlan/v1',
    commandCenterProductionLoadedRegistryPointer: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI,
    defaultLookupPath: 'production-loaded-native-registry',
    defaultRenderPath: 'production-loaded-native-registry',
    adapterRefreshAllowedExplicitly: true,
    runtimeExternalExecutorRequiredForProductionLookup: false,
    runtimeExternalExecutorRequiredForProductionRender: false,
    publicSourceIdentityExposed: false,
  };
}

function refreshReconciliation(): ZavorthNativeRegistryProductionRefreshReconciliationPlan {
  return {
    nativeContract: 'ZavorthNativeRegistryProductionRefreshReconciliationPlan/v1',
    refreshModes: ['disabled', 'manual', 'scheduled-future', 'live-adapter-optional', 'blocked'],
    defaultRefreshMode: 'manual',
    refreshSourceRole: 'optional-refresh-source',
    reconciliationFrom193RequiredBeforeCommit: true,
    dryRunDiffRequiredBeforeCommit: true,
    productionCommitRequiresFutureGate: true,
    externalExecutorRequiredForLookupOrRender: false,
  };
}

function auditReceipt(): ZavorthNativeRegistryProductionAuditReceiptPlan {
  return {
    nativeContract: 'ZavorthNativeRegistryProductionAuditReceiptPlan/v1',
    receiptPathPreview: `${ZAVORTH_NATIVE_REGISTRY_PRODUCTION_STORAGE_ROOT_PREVIEW}/receipts/<commit-id>.json`,
    receiptRedacted: true,
    includesManifestChecksum: true,
    includesIdempotencyKeys: true,
    includesBackupRestoreRefs: true,
    includesRefreshReconciliationRefs: true,
    rawSecretSerialized: false,
  };
}

function validationStatuses(
  source: ZavorthNativeRegistryProductionStorageDesignSource,
  snapshots: ZavorthNativeRegistryProductionSnapshotPlan[],
): ZavorthNativeRegistryProductionStorageValidationStatus[] {
  const statuses: ZavorthNativeRegistryProductionStorageValidationStatus[] = [];
  const sourceReady = source.dryRun.decision === 'native-registry-persistence-dry-run-ready' &&
    source.sandboxPersistenceDecision === 'native-registry-sandbox-persistence-ready' &&
    source.sandboxRestoreDecision === 'native-registry-sandbox-restore-load-ready';

  if (!sourceReady) {
    statuses.push('source-not-ready');
  }
  if (source.productionNamespace !== ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE) {
    statuses.push('namespace-invalid');
  }
  if (source.productionWriteAttempted) {
    statuses.push('production-write-attempted');
  }
  if (!source.redactionEnvelopeRequired) {
    statuses.push('redaction-envelope-missing');
  }
  if (source.rawSecretSerialized) {
    statuses.push('raw-secret-blocked');
  }
  if (source.externalExecutorRequiredForLookupOrRender || source.sourceRuntimeAuthority || source.sourceStateMigrationAttempted ||
    source.sourceFileCopyAttempted || source.sourceDbCopyAttempted || source.sourceDbWriteOpenAttempted ||
    source.executionAttempted) {
    statuses.push('source-not-ready');
  }
  if (snapshots.some((snapshot) => snapshot.schemaVersion !== ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION)) {
    statuses.push('schema-invalid');
  }
  if (snapshots.some((snapshot) => !snapshot.redactionEnvelopeRequired || snapshot.redactionEnvelope.rawSecretSerialized)) {
    statuses.push('redaction-envelope-missing');
  }

  return statuses.length === 0 ? ['valid'] : Array.from(new Set(statuses));
}

function executionGate(): ZavorthNativeRegistryProductionStorageExecutionGate {
  return {
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
  };
}

function buildPlan(
  generatedAt: string,
  source: ZavorthNativeRegistryProductionStorageDesignSource,
  schemaVersion: string,
): ZavorthNativeRegistryProductionStoragePlan {
  const snapshots = source.dryRun.plan.snapshots.map((snapshot) => snapshotPlan(snapshot, schemaVersion));
  const manifest = manifestPlan(snapshots);
  const statuses = validationStatuses(source, snapshots);

  return {
    nativeContract: 'ZavorthNativeRegistryProductionStoragePlan/v1',
    generatedAt,
    productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
    productionNamespaceUri: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI,
    productionStorageRootPreview: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_STORAGE_ROOT_PREVIEW,
    manifest,
    snapshots,
    retentionCleanup: retentionCleanup(),
    commandCenterConsumption: commandCenterConsumption(),
    refreshReconciliation: refreshReconciliation(),
    auditReceipt: auditReceipt(),
    validationStatuses: statuses,
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
  };
}

function buildReceipt(
  idPrefix: string,
  plan: ZavorthNativeRegistryProductionStoragePlan,
): ZavorthNativeRegistryProductionStorageReceipt {
  return {
    nativeContract: 'ZavorthNativeRegistryProductionStorageReceipt/v1',
    id: `${idPrefix}:production-storage-design-receipt`,
    decision: plan.validationStatuses.length === 1 && plan.validationStatuses[0] === 'valid'
      ? 'native-registry-production-storage-design-ready'
      : 'blocked',
    productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
    productionNamespaceUri: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI,
    validationStatuses: plan.validationStatuses,
    snapshotCount: plan.snapshots.length,
    totalRecordCount: plan.manifest.totalRecordCount,
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
  };
}

export function createZavorthNativeRegistryProductionStorageDesignFixtureSource(
  overrides: Partial<ZavorthNativeRegistryProductionStorageDesignSource> = {},
): ZavorthNativeRegistryProductionStorageDesignSource {
  return {
    dryRun: normalizeZavorthNativeRegistryPersistenceDryRunFixture(),
    sandboxPersistenceDecision: 'native-registry-sandbox-persistence-ready',
    sandboxRestoreDecision: 'native-registry-sandbox-restore-load-ready',
    storagePatternEvidence: [
      'docs/194-wave-3-native-registry-persistence-dry-run.md',
      'docs/195-wave-3-native-registry-sandbox-persistence.md',
      'docs/196-wave-3-native-registry-sandbox-restore-load-path.md',
      'src/services/SecureStorageService.ts',
      'src/host/HostBackupStore.ts',
    ],
    productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
    redactionEnvelopeRequired: true,
    productionWriteAttempted: false,
    externalExecutorRequiredForLookupOrRender: false,
    sourceRuntimeAuthority: false,
    sourceStateMigrationAttempted: false,
    sourceFileCopyAttempted: false,
    sourceDbCopyAttempted: false,
    sourceDbWriteOpenAttempted: false,
    executionAttempted: false,
    rawSecretSerialized: false,
    ...overrides,
  };
}

export function normalizeZavorthNativeRegistryProductionStorageDesign<TRuntimeId extends string>(
  options: ZavorthNativeRegistryProductionStorageDesignOptions<TRuntimeId>,
): ZavorthNativeRegistryProductionStorageDesignNormalization {
  const plan = buildPlan(
    options.generatedAt,
    options.source,
    options.schemaVersionOverride ?? ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
  );
  const receipt = buildReceipt(options.idPrefix, plan);
  const gate = executionGate();

  return {
    nativeContract: 'ZavorthNativeRegistryProductionStorageDesign/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: receipt.decision,
    status: receipt.decision,
    sourceReadiness: {
      persistenceDryRun: options.source.dryRun.decision,
      sandboxPersistence: options.source.sandboxPersistenceDecision,
      sandboxRestoreLoad: options.source.sandboxRestoreDecision,
    },
    plan,
    receipt,
    executionGate: gate,
    redaction: {
      redactionEnvelopeRequired: true,
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
    },
    nextGateRecommended: 'future-native-registry-production-storage-dry-run-or-controlled-commit-gate',
  };
}

export function normalizeZavorthNativeRegistryProductionStorageDesignFixture(): ZavorthNativeRegistryProductionStorageDesignNormalization {
  return normalizeZavorthNativeRegistryProductionStorageDesign({
    generatedAt: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_STORAGE_DESIGN_NOW,
    runtimeId: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_STORAGE_DESIGN_RUNTIME_ID,
    idPrefix: 'zavorth-native-registry-production-storage-design',
    source: createZavorthNativeRegistryProductionStorageDesignFixtureSource(),
  });
}
