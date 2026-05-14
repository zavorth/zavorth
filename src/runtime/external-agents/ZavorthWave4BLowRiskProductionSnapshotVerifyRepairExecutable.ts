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
  ZavorthNativeRegistryProductionBackupRollbackManifest,
  ZavorthNativeRegistryProductionManifest,
  ZavorthNativeRegistryProductionPersistedSnapshot,
  ZavorthNativeRegistryProductionSnapshotWriteStatus,
} from './ZavorthNativeRegistryProductionPersistenceFlagged.js';

export const ZAVORTH_WAVE4B_LOW_RISK_PRODUCTION_SNAPSHOT_VERIFY_REPAIR_EXECUTABLE_NOW = '2026-04-30T12:00:00.000Z' as const;
export const ZAVORTH_WAVE4B_LOW_RISK_PRODUCTION_SNAPSHOT_VERIFY_REPAIR_EXECUTABLE_RUNTIME_ID = 'zavorth-wave4b-low-risk-production-snapshot-verify-repair-executable' as const;
export const ZAVORTH_WAVE4B_PRODUCTION_SNAPSHOT_REPAIR_EXECUTE_FLAG = 'ZAVORTH_WAVE4B_PRODUCTION_SNAPSHOT_REPAIR_EXECUTE' as const;

export type ZavorthWave4BProductionSnapshotVerifyRepairDecision =
  | 'execution-blocked'
  | 'repair-applied'
  | 'repair-blocked'
  | 'repair-degraded'
  | 'repair-rejected'
  | 'verify-ok';

export type ZavorthWave4BProductionSnapshotVerifyRepairValidationStatus =
  | 'checksum-mismatch'
  | 'feature-flag-disabled'
  | 'high-impact-execution-attempted'
  | 'idempotency-invalid'
  | 'manifest-invalid'
  | 'manifest-missing'
  | 'external-executor-touch-attempted'
  | 'partial-write'
  | 'raw-secret-detected'
  | 'redaction-envelope-invalid'
  | 'rollback-metadata-missing'
  | 'schema-invalid'
  | 'source-not-ready'
  | 'valid'
  | 'version-incompatible';

export type ZavorthWave4BProductionSnapshotRepairActionKind =
  | 'mark-degraded-blocked'
  | 'none'
  | 'regenerate-derived-checksum-metadata'
  | 'restore-manifest-from-backup-metadata';

export type ZavorthWave4BProductionSnapshotRepairWriteStatus =
  | 'already-present'
  | 'blocked'
  | 'skipped'
  | 'written';

export type ZavorthWave4BProductionSnapshotRepairFeatureFlagGate = {
  nativeContract: 'ZavorthWave4BProductionSnapshotRepairFeatureFlagGate/v1';
  flagName: typeof ZAVORTH_WAVE4B_PRODUCTION_SNAPSHOT_REPAIR_EXECUTE_FLAG;
  enabled: boolean;
  safetyGate: 'controlled-production' | 'controlled-test';
  operatorAcknowledgedZavorthOwnedStorage: boolean;
  productionSnapshotRepairFeatureFlagRequired: true;
};

export type ZavorthWave4BProductionSnapshotVerifyRepairSource = {
  nativeRegistryPersistenceDryRunReady: true;
  sandboxPersistenceReady: true;
  sandboxRestoreLoadReady: true;
  productionStorageDesignReady: true;
  productionPersistenceFlaggedReady: true;
  productionRestoreLoadReady: true;
  metadataValidationExecutableReady: true;
  registryReconciliationCommitExecutableReady: true;
  actionGovernancePipelineReady: true;
  runtimeExternalExecutorRequiredForExecution: false;
  externalExecutorTouched: false;
  highImpactExecutionAttempted: false;
  messageSendAttempted: false;
  providerExecutionAttempted: false;
  toolCommandExecutionAttempted: false;
  externalExecutorMutationAttempted: false;
  stateMigrationAttempted: false;
  sourceModuleCopyAttempted: false;
  adapterRemovalAttempted: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4BProductionSnapshotVerificationRow = {
  nativeContract: 'ZavorthWave4BProductionSnapshotVerificationRow/v1';
  registryKind?: ZavorthNativeRegistryPersistenceKind;
  relativePath: string;
  status: ZavorthWave4BProductionSnapshotVerifyRepairValidationStatus;
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

export type ZavorthWave4BProductionSnapshotRepairAction = {
  nativeContract: 'ZavorthWave4BProductionSnapshotRepairAction/v1';
  action: ZavorthWave4BProductionSnapshotRepairActionKind;
  relativePath: string;
  status: ZavorthWave4BProductionSnapshotRepairWriteStatus;
  reason: string;
  bytesWritten: number;
  atomicWriteUsed: true;
  safeMetadataOnly: true;
  rawSecretSerialized: false;
};

export type ZavorthWave4BProductionSnapshotRepairStatusMarker = {
  nativeContract: 'ZavorthWave4BProductionSnapshotRepairStatusMarker/v1';
  generatedAt: string;
  productionNamespace: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE;
  decision: 'blocked' | 'degraded';
  validationStatuses: ZavorthWave4BProductionSnapshotVerifyRepairValidationStatus[];
  reason: string;
  safeMetadataOnly: true;
  rawSecretSerialized: false;
};

export type ZavorthWave4BProductionSnapshotVerifyRepairReceipt = {
  nativeContract: 'ZavorthWave4BProductionSnapshotVerifyRepairReceipt/v1';
  runtimeId: typeof ZAVORTH_WAVE4B_LOW_RISK_PRODUCTION_SNAPSHOT_VERIFY_REPAIR_EXECUTABLE_RUNTIME_ID;
  generatedAt: string;
  selectedLowRiskCapability: 'production-snapshot-verify-repair-action';
  productionRoot: string;
  productionNamespace: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE;
  productionNamespaceUri: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI;
  decision: ZavorthWave4BProductionSnapshotVerifyRepairDecision;
  classification: ZavorthWave4BProductionSnapshotVerifyRepairDecision;
  validations: ZavorthWave4BProductionSnapshotVerifyRepairValidationStatus[];
  verificationRows: ZavorthWave4BProductionSnapshotVerificationRow[];
  repairActions: ZavorthWave4BProductionSnapshotRepairAction[];
  featureFlag: ZavorthWave4BProductionSnapshotRepairFeatureFlagGate;
  manifestPath: string;
  backupRollbackManifestPath: string;
  snapshotCount: number;
  repairNeeded: boolean;
  repairActuallyPerformed: boolean;
  wave4bProductionSnapshotVerifyRepairExecutableCreated: true;
  verifyActionAlwaysAllowed: true;
  repairActuallyPerformedOnlyWhenFlagEnabled: true;
  runtimeExternalExecutorRequiredForExecution: false;
  externalExecutorTouched: false;
  highImpactExecutionBlocked: true;
  messageSendRealAllowed: false;
  providerExecutionRealAllowed: false;
  toolCommandExecutionRealAllowed: false;
  externalExecutorMutationAllowed: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  rawSecretSerialized: false;
  adapterRemovalGlobalAllowed: false;
};

export type ZavorthWave4BProductionSnapshotVerifyRepairRollbackReceipt = {
  nativeContract: 'ZavorthWave4BProductionSnapshotVerifyRepairRollbackReceipt/v1';
  productionRoot: string;
  outcome: 'rollback-applied';
  restoredRelativePaths: string[];
  removedRelativePaths: string[];
  rollbackApplied: true;
  runtimeExternalExecutorRequiredForExecution: false;
  externalExecutorTouched: false;
  stateMigrated: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4BProductionSnapshotVerifyRepairCleanupReceipt = {
  nativeContract: 'ZavorthWave4BProductionSnapshotVerifyRepairCleanupReceipt/v1';
  productionRoot: string;
  cleanupActuallyPerformed: boolean;
  namespaceExistsAfterCleanup: boolean;
  cleanupLimitedToControlledTestNamespace: true;
  externalExecutorTouched: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4BProductionSnapshotVerifyRepairOptions = {
  productionRoot: string;
  featureFlag: ZavorthWave4BProductionSnapshotRepairFeatureFlagGate;
  generatedAt?: string;
};

type SnapshotCandidate = {
  relativePath: string;
  snapshot?: ZavorthNativeRegistryProductionPersistedSnapshot;
  manifestEntry?: ZavorthNativeRegistryProductionManifest['snapshots'][number];
};

const RAW_SECRET_PATTERNS = [
  /EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/,
  /(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/,
  /ghp_[A-Za-z0-9_]{8,}/,
  /xox[baprs]-[A-Za-z0-9-]{8,}/,
  /synthetic-raw-credential-sentinel-that-must-not-appear/,
];

const FORBIDDEN_PAYLOAD_KEYS = new Set([
  'rawCacheEntry',
  'rawLogLine',
  'rawMessageContent',
  'rawSecretValue',
  'sqlitePayload',
  'workspaceFileBody',
]);

function assertProductionRoot(productionRoot: string): string {
  const resolved = path.resolve(productionRoot);
  const cwd = path.resolve(process.cwd());

  if (!resolved.startsWith(`${cwd}${path.sep}`)) {
    throw new Error(`Production snapshot verify/repair root must stay inside workspace: ${resolved}`);
  }
  if (!resolved.includes(`${path.sep}.tmp${path.sep}`) && !resolved.includes(`${path.sep}.zavorth${path.sep}`)) {
    throw new Error(`Production snapshot verify/repair root must live under .tmp or .zavorth: ${resolved}`);
  }
  if (path.basename(resolved) !== ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE) {
    throw new Error(`Production snapshot verify/repair root must end with ${ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE}: ${resolved}`);
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

function writeJsonAtomic(filePath: string, value: unknown): { bytesWritten: number; status: 'already-present' | 'written' } {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;

  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === serialized) {
    return {
      bytesWritten: 0,
      status: 'already-present',
    };
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, serialized, 'utf8');
  fs.renameSync(tempPath, filePath);

  return {
    bytesWritten: Buffer.byteLength(serialized, 'utf8'),
    status: 'written',
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

function containsRawSecret(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'string' && RAW_SECRET_PATTERNS.some((pattern) => pattern.test(value));
  }
  if (Array.isArray(value)) {
    return value.some(containsRawSecret);
  }
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => (
    FORBIDDEN_PAYLOAD_KEYS.has(key) || containsRawSecret(child)
  ));
}

function isManifest(value: unknown): value is ZavorthNativeRegistryProductionManifest {
  if (value === undefined || value === null || typeof value !== 'object') {
    return false;
  }
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

function isBackupRollbackManifest(value: unknown): value is ZavorthNativeRegistryProductionBackupRollbackManifest {
  if (value === undefined || value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<ZavorthNativeRegistryProductionBackupRollbackManifest>;
  return (
    candidate.nativeContract === 'ZavorthNativeRegistryProductionBackupRollbackManifest/v1' &&
    candidate.productionNamespace === ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE &&
    candidate.backupRollbackMetadataCreated === true &&
    candidate.rawSecretSerialized === false
  );
}

function isSnapshot(value: unknown): value is ZavorthNativeRegistryProductionPersistedSnapshot {
  if (value === undefined || value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<ZavorthNativeRegistryProductionPersistedSnapshot>;
  return (
    candidate.nativeContract === 'ZavorthNativeRegistryProductionPersistedSnapshot/v1' &&
    candidate.productionNamespace === ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE &&
    candidate.productionNamespaceUri === ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI &&
    typeof candidate.registryKind === 'string' &&
    typeof candidate.registryId === 'string' &&
    typeof candidate.contentChecksum === 'string' &&
    typeof candidate.idempotencyKey === 'string' &&
    candidate.payloadSensitiveFieldsPersisted === false &&
    candidate.rawSecretSerialized === false
  );
}

function listSnapshotFiles(root: string): string[] {
  const snapshotRoot = path.join(root, 'native-registries');
  if (!fs.existsSync(snapshotRoot)) {
    return [];
  }

  const pending = [snapshotRoot];
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
        files.push(path.relative(root, absolute));
      }
    });
  }

  return files.sort();
}

function row(input: Partial<ZavorthWave4BProductionSnapshotVerificationRow> & {
  reason: string;
  relativePath: string;
  status: ZavorthWave4BProductionSnapshotVerifyRepairValidationStatus;
}): ZavorthWave4BProductionSnapshotVerificationRow {
  return {
    nativeContract: 'ZavorthWave4BProductionSnapshotVerificationRow/v1',
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

function sourceStatuses(source: ZavorthWave4BProductionSnapshotVerifyRepairSource): ZavorthWave4BProductionSnapshotVerifyRepairValidationStatus[] {
  const statuses: ZavorthWave4BProductionSnapshotVerifyRepairValidationStatus[] = [];

  if (!source.nativeRegistryPersistenceDryRunReady ||
    !source.sandboxPersistenceReady ||
    !source.sandboxRestoreLoadReady ||
    !source.productionStorageDesignReady ||
    !source.productionPersistenceFlaggedReady ||
    !source.productionRestoreLoadReady ||
    !source.metadataValidationExecutableReady ||
    !source.registryReconciliationCommitExecutableReady ||
    !source.actionGovernancePipelineReady ||
    source.runtimeExternalExecutorRequiredForExecution ||
    source.stateMigrationAttempted ||
    source.sourceModuleCopyAttempted ||
    source.adapterRemovalAttempted ||
    source.publicExternalExecutorIdentityExposed ||
    source.rawSecretSerialized) {
    statuses.push('source-not-ready');
  }
  if (source.externalExecutorTouched || source.externalExecutorMutationAttempted) {
    statuses.push('external-executor-touch-attempted');
  }
  if (source.highImpactExecutionAttempted ||
    source.messageSendAttempted ||
    source.providerExecutionAttempted ||
    source.toolCommandExecutionAttempted) {
    statuses.push('high-impact-execution-attempted');
  }

  return statuses;
}

function loadCandidates(root: string, manifest?: ZavorthNativeRegistryProductionManifest): SnapshotCandidate[] {
  if (manifest) {
    return manifest.snapshots.map((entry) => ({
      manifestEntry: entry,
      relativePath: entry.relativePath,
      snapshot: readJson<ZavorthNativeRegistryProductionPersistedSnapshot>(path.join(root, entry.relativePath)),
    }));
  }

  return listSnapshotFiles(root).map((relativePath) => ({
    relativePath,
    snapshot: readJson<ZavorthNativeRegistryProductionPersistedSnapshot>(path.join(root, relativePath)),
  }));
}

function verifySnapshots(
  root: string,
  candidates: SnapshotCandidate[],
): ZavorthWave4BProductionSnapshotVerificationRow[] {
  return candidates.flatMap((candidate) => {
    if (!candidate.snapshot || !isSnapshot(candidate.snapshot)) {
      return [row({
        registryKind: candidate.manifestEntry?.registryKind,
        relativePath: candidate.relativePath,
        status: 'partial-write',
        reason: 'snapshot is missing or failed the persisted snapshot contract',
        expectedChecksum: candidate.manifestEntry?.contentChecksum,
        expectedIdempotencyKey: candidate.manifestEntry?.idempotencyKey,
        productionSnapshotReadActuallyPerformed: fs.existsSync(path.join(root, candidate.relativePath)),
      })];
    }

    const snapshot = candidate.snapshot;
    const rows: ZavorthWave4BProductionSnapshotVerificationRow[] = [];
    if (snapshot.schemaVersion !== ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION) {
      rows.push(row({
        registryKind: snapshot.registryKind,
        relativePath: candidate.relativePath,
        status: 'version-incompatible',
        reason: 'snapshot schemaVersion is incompatible with production registry persistence schema',
        expectedSchemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
        observedSchemaVersion: snapshot.schemaVersion,
        productionSnapshotReadActuallyPerformed: true,
      }));
    }
    if (candidate.manifestEntry && snapshot.contentChecksum !== candidate.manifestEntry.contentChecksum) {
      rows.push(row({
        registryKind: snapshot.registryKind,
        relativePath: candidate.relativePath,
        status: 'checksum-mismatch',
        reason: 'manifest checksum metadata does not match snapshot checksum',
        expectedChecksum: candidate.manifestEntry.contentChecksum,
        observedChecksum: snapshot.contentChecksum,
        productionSnapshotReadActuallyPerformed: true,
      }));
    }
    if (candidate.manifestEntry && snapshot.idempotencyKey !== candidate.manifestEntry.idempotencyKey) {
      rows.push(row({
        registryKind: snapshot.registryKind,
        relativePath: candidate.relativePath,
        status: 'idempotency-invalid',
        reason: 'manifest idempotency metadata does not match snapshot idempotency key',
        expectedIdempotencyKey: candidate.manifestEntry.idempotencyKey,
        observedIdempotencyKey: snapshot.idempotencyKey,
        productionSnapshotReadActuallyPerformed: true,
      }));
    }
    if (!redactionEnvelopeValid(snapshot.redactionEnvelope)) {
      rows.push(row({
        registryKind: snapshot.registryKind,
        relativePath: candidate.relativePath,
        status: 'redaction-envelope-invalid',
        reason: 'snapshot redaction envelope is invalid',
        productionSnapshotReadActuallyPerformed: true,
      }));
    }
    if (containsRawSecret(snapshot)) {
      rows.push(row({
        registryKind: snapshot.registryKind,
        relativePath: candidate.relativePath,
        status: 'raw-secret-detected',
        reason: 'snapshot contains forbidden raw sensitive payload',
        productionSnapshotReadActuallyPerformed: true,
      }));
    }
    if (rows.length === 0) {
      rows.push(row({
        registryKind: snapshot.registryKind,
        relativePath: candidate.relativePath,
        status: 'valid',
        reason: 'snapshot passed manifest, schema, checksum, idempotency, redaction, and raw-data checks',
        expectedChecksum: candidate.manifestEntry?.contentChecksum ?? snapshot.contentChecksum,
        observedChecksum: snapshot.contentChecksum,
        expectedIdempotencyKey: candidate.manifestEntry?.idempotencyKey ?? snapshot.idempotencyKey,
        observedIdempotencyKey: snapshot.idempotencyKey,
        expectedSchemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
        observedSchemaVersion: snapshot.schemaVersion,
        productionSnapshotReadActuallyPerformed: true,
      }));
    }
    return rows;
  });
}

function statuses(rows: ZavorthWave4BProductionSnapshotVerificationRow[]): ZavorthWave4BProductionSnapshotVerifyRepairValidationStatus[] {
  const values = rows.map((entry) => entry.status);
  return Array.from(new Set(values.length === 0 ? ['valid' as const] : values));
}

function manifestFromSnapshots(
  generatedAt: string,
  snapshots: SnapshotCandidate[],
): ZavorthNativeRegistryProductionManifest {
  const entries = snapshots
    .filter((candidate): candidate is SnapshotCandidate & { snapshot: ZavorthNativeRegistryProductionPersistedSnapshot } => Boolean(candidate.snapshot && isSnapshot(candidate.snapshot)))
    .map((candidate) => ({
      registryKind: candidate.snapshot.registryKind,
      idempotencyKey: candidate.snapshot.idempotencyKey,
      contentChecksum: candidate.snapshot.contentChecksum,
      relativePath: candidate.relativePath,
      status: 'written' as ZavorthNativeRegistryProductionSnapshotWriteStatus,
    }));

  return {
    nativeContract: 'ZavorthNativeRegistryProductionManifest/v1',
    productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
    productionNamespaceUri: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI,
    persistedAt: generatedAt,
    schemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
    snapshotCount: entries.length,
    snapshots: entries,
    backupRollbackMetadataCreated: true,
    rawSecretSerialized: false,
    runtimeExternalExecutorRequiredForProductionLookup: false,
  };
}

function repairAction(
  input: Omit<ZavorthWave4BProductionSnapshotRepairAction, 'atomicWriteUsed' | 'nativeContract' | 'rawSecretSerialized' | 'safeMetadataOnly'>,
): ZavorthWave4BProductionSnapshotRepairAction {
  return {
    nativeContract: 'ZavorthWave4BProductionSnapshotRepairAction/v1',
    ...input,
    atomicWriteUsed: true,
    safeMetadataOnly: true,
    rawSecretSerialized: false,
  };
}

function classify(
  values: ZavorthWave4BProductionSnapshotVerifyRepairValidationStatus[],
  flagEnabled: boolean,
): ZavorthWave4BProductionSnapshotVerifyRepairDecision {
  if (values.includes('high-impact-execution-attempted') || values.includes('external-executor-touch-attempted') || values.includes('source-not-ready')) {
    return 'repair-rejected';
  }
  if (values.length === 1 && values[0] === 'valid') {
    return 'verify-ok';
  }
  if (!flagEnabled) {
    return 'repair-blocked';
  }
  if (values.includes('redaction-envelope-invalid') ||
    values.includes('raw-secret-detected') ||
    values.includes('version-incompatible') ||
    values.includes('partial-write') ||
    values.includes('rollback-metadata-missing')) {
    return 'repair-degraded';
  }
  return 'repair-applied';
}

export class ZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutable {
  public constructor(private readonly source: ZavorthWave4BProductionSnapshotVerifyRepairSource) {}

  public execute(options: ZavorthWave4BProductionSnapshotVerifyRepairOptions): ZavorthWave4BProductionSnapshotVerifyRepairReceipt {
    const productionRoot = assertProductionRoot(options.productionRoot);
    const generatedAt = options.generatedAt ?? ZAVORTH_WAVE4B_LOW_RISK_PRODUCTION_SNAPSHOT_VERIFY_REPAIR_EXECUTABLE_NOW;
    const manifestPath = path.join(productionRoot, 'manifest.json');
    const backupRollbackManifestPath = path.join(productionRoot, 'rollback', 'backup-rollback-manifest.json');
    const parsedManifest = readJson<unknown>(manifestPath);
    const manifest = isManifest(parsedManifest) ? parsedManifest : undefined;
    const backupRollbackManifest = readJson<unknown>(backupRollbackManifestPath);
    const backupValid = isBackupRollbackManifest(backupRollbackManifest);
    const candidates = loadCandidates(productionRoot, manifest);
    const verificationRows = [
      ...sourceStatuses(this.source).map((status) => row({
        relativePath: 'source-readiness',
        status,
        reason: 'source readiness or safety precondition failed',
        productionSnapshotReadActuallyPerformed: false,
      })),
      ...(parsedManifest === undefined
        ? [row({
          relativePath: 'manifest.json',
          status: 'manifest-missing',
          reason: 'production manifest is missing',
          productionSnapshotReadActuallyPerformed: false,
        })]
        : manifest
          ? []
          : [row({
            relativePath: 'manifest.json',
            status: 'manifest-invalid',
            reason: 'production manifest contract, namespace, schema, or counts are invalid',
            productionSnapshotReadActuallyPerformed: true,
          })]),
      ...(backupValid
        ? []
        : [row({
          relativePath: 'rollback/backup-rollback-manifest.json',
          status: 'rollback-metadata-missing',
          reason: 'backup/rollback metadata is missing or invalid',
          productionSnapshotReadActuallyPerformed: fs.existsSync(backupRollbackManifestPath),
        })]),
      ...verifySnapshots(productionRoot, candidates),
    ];
    const validationStatuses = statuses(verificationRows).filter((status) => status !== 'valid');
    const finalValidations = validationStatuses.length === 0 ? ['valid' as const] : Array.from(new Set(validationStatuses));
    const decision = classify(finalValidations, options.featureFlag.enabled);
    const repairActions = this.repair({
      candidates,
      decision,
      finalValidations,
      generatedAt,
      manifestPath,
      productionRoot,
    });

    return {
      nativeContract: 'ZavorthWave4BProductionSnapshotVerifyRepairReceipt/v1',
      runtimeId: ZAVORTH_WAVE4B_LOW_RISK_PRODUCTION_SNAPSHOT_VERIFY_REPAIR_EXECUTABLE_RUNTIME_ID,
      generatedAt,
      selectedLowRiskCapability: 'production-snapshot-verify-repair-action',
      productionRoot,
      productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
      productionNamespaceUri: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI,
      decision,
      classification: decision,
      validations: options.featureFlag.enabled ? finalValidations : (
        decision === 'repair-blocked' ? [...finalValidations, 'feature-flag-disabled'] : finalValidations
      ),
      verificationRows,
      repairActions,
      featureFlag: options.featureFlag,
      manifestPath,
      backupRollbackManifestPath,
      snapshotCount: candidates.length,
      repairNeeded: finalValidations.some((status) => status !== 'valid'),
      repairActuallyPerformed: repairActions.some((action) => action.status === 'written' || action.status === 'already-present'),
      wave4bProductionSnapshotVerifyRepairExecutableCreated: true,
      verifyActionAlwaysAllowed: true,
      repairActuallyPerformedOnlyWhenFlagEnabled: true,
      runtimeExternalExecutorRequiredForExecution: false,
      externalExecutorTouched: false,
      highImpactExecutionBlocked: true,
      messageSendRealAllowed: false,
      providerExecutionRealAllowed: false,
      toolCommandExecutionRealAllowed: false,
      externalExecutorMutationAllowed: false,
      stateMigrated: false,
      sourceModuleCopied: false,
      rawSecretSerialized: false,
      adapterRemovalGlobalAllowed: false,
    };
  }

  public rollback(
    productionRoot: string,
    receipt: ZavorthWave4BProductionSnapshotVerifyRepairReceipt,
  ): ZavorthWave4BProductionSnapshotVerifyRepairRollbackReceipt {
    const resolved = assertProductionRoot(productionRoot);
    if (!resolved.includes(`${path.sep}.tmp${path.sep}`)) {
      throw new Error(`Production snapshot verify/repair rollback is only allowed for controlled test namespace: ${resolved}`);
    }

    const removedRelativePaths: string[] = [];
    receipt.repairActions.forEach((action) => {
      if (action.status !== 'written' && action.status !== 'already-present') {
        return;
      }
      if (action.action === 'restore-manifest-from-backup-metadata' || action.action === 'regenerate-derived-checksum-metadata') {
        return;
      }
      const absolutePath = path.join(resolved, action.relativePath);
      if (fs.existsSync(absolutePath)) {
        fs.rmSync(absolutePath, { force: true });
        removedRelativePaths.push(action.relativePath);
      }
    });

    return {
      nativeContract: 'ZavorthWave4BProductionSnapshotVerifyRepairRollbackReceipt/v1',
      productionRoot: resolved,
      outcome: 'rollback-applied',
      restoredRelativePaths: [],
      removedRelativePaths,
      rollbackApplied: true,
      runtimeExternalExecutorRequiredForExecution: false,
      externalExecutorTouched: false,
      stateMigrated: false,
      rawSecretSerialized: false,
    };
  }

  public cleanup(productionRoot: string): ZavorthWave4BProductionSnapshotVerifyRepairCleanupReceipt {
    const resolved = assertProductionRoot(productionRoot);
    if (!resolved.includes(`${path.sep}.tmp${path.sep}`)) {
      throw new Error(`Production snapshot verify/repair cleanup is only allowed for controlled test namespace: ${resolved}`);
    }

    const existedBefore = fs.existsSync(resolved);
    if (existedBefore) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }

    return {
      nativeContract: 'ZavorthWave4BProductionSnapshotVerifyRepairCleanupReceipt/v1',
      productionRoot: resolved,
      cleanupActuallyPerformed: existedBefore,
      namespaceExistsAfterCleanup: fs.existsSync(resolved),
      cleanupLimitedToControlledTestNamespace: true,
      externalExecutorTouched: false,
      stateMigrated: false,
      sourceModuleCopied: false,
      rawSecretSerialized: false,
    };
  }

  private repair(input: {
    candidates: SnapshotCandidate[];
    decision: ZavorthWave4BProductionSnapshotVerifyRepairDecision;
    finalValidations: ZavorthWave4BProductionSnapshotVerifyRepairValidationStatus[];
    generatedAt: string;
    manifestPath: string;
    productionRoot: string;
  }): ZavorthWave4BProductionSnapshotRepairAction[] {
    if (input.decision === 'verify-ok' || input.decision === 'repair-blocked' || input.decision === 'repair-rejected') {
      return [repairAction({
        action: 'none',
        bytesWritten: 0,
        reason: input.decision === 'verify-ok' ? 'snapshot metadata verified; no repair needed' : 'repair not permitted for this decision',
        relativePath: 'none',
        status: 'skipped',
      })];
    }

    if (input.decision === 'repair-applied') {
      const manifest = manifestFromSnapshots(input.generatedAt, input.candidates);
      const write = writeJsonAtomic(input.manifestPath, manifest);
      return [repairAction({
        action: input.finalValidations.includes('manifest-missing') || input.finalValidations.includes('manifest-invalid')
          ? 'restore-manifest-from-backup-metadata'
          : 'regenerate-derived-checksum-metadata',
        bytesWritten: write.bytesWritten,
        reason: 'safe manifest metadata was regenerated from validated Zavorth-owned snapshots and rollback metadata',
        relativePath: 'manifest.json',
        status: write.status,
      })];
    }

    const marker: ZavorthWave4BProductionSnapshotRepairStatusMarker = {
      nativeContract: 'ZavorthWave4BProductionSnapshotRepairStatusMarker/v1',
      generatedAt: input.generatedAt,
      productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
      decision: 'degraded',
      validationStatuses: input.finalValidations,
      reason: 'snapshot was unsafe or incomplete; marked degraded/blocked without repairing payload',
      safeMetadataOnly: true,
      rawSecretSerialized: false,
    };
    const relativePath = path.join('repair-status', 'production-snapshot-degraded.json');
    const write = writeJsonAtomic(path.join(input.productionRoot, relativePath), marker);
    return [repairAction({
      action: 'mark-degraded-blocked',
      bytesWritten: write.bytesWritten,
      reason: 'unsafe snapshot was marked degraded/blocked; payload repair was not attempted',
      relativePath,
      status: write.status,
    })];
  }
}

export function createZavorthWave4BProductionSnapshotRepairFeatureFlag(
  enabled: boolean,
): ZavorthWave4BProductionSnapshotRepairFeatureFlagGate {
  return {
    nativeContract: 'ZavorthWave4BProductionSnapshotRepairFeatureFlagGate/v1',
    flagName: ZAVORTH_WAVE4B_PRODUCTION_SNAPSHOT_REPAIR_EXECUTE_FLAG,
    enabled,
    safetyGate: 'controlled-test',
    operatorAcknowledgedZavorthOwnedStorage: true,
    productionSnapshotRepairFeatureFlagRequired: true,
  };
}

export function createZavorthWave4BProductionSnapshotVerifyRepairFixtureSource(
  overrides: Partial<ZavorthWave4BProductionSnapshotVerifyRepairSource> = {},
): ZavorthWave4BProductionSnapshotVerifyRepairSource {
  return {
    nativeRegistryPersistenceDryRunReady: true,
    sandboxPersistenceReady: true,
    sandboxRestoreLoadReady: true,
    productionStorageDesignReady: true,
    productionPersistenceFlaggedReady: true,
    productionRestoreLoadReady: true,
    metadataValidationExecutableReady: true,
    registryReconciliationCommitExecutableReady: true,
    actionGovernancePipelineReady: true,
    runtimeExternalExecutorRequiredForExecution: false,
    externalExecutorTouched: false,
    highImpactExecutionAttempted: false,
    messageSendAttempted: false,
    providerExecutionAttempted: false,
    toolCommandExecutionAttempted: false,
    externalExecutorMutationAttempted: false,
    stateMigrationAttempted: false,
    sourceModuleCopyAttempted: false,
    adapterRemovalAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    rawSecretSerialized: false,
    ...overrides,
  };
}

export function createZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutableFixture(
  source: ZavorthWave4BProductionSnapshotVerifyRepairSource = createZavorthWave4BProductionSnapshotVerifyRepairFixtureSource(),
): ZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutable {
  return new ZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutable(source);
}
