import crypto from 'node:crypto';
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
} from './ZavorthNativeRegistryPersistenceDryRun.js';
import type {
  ZavorthWave4AMigrationDataClass,
} from './ZavorthWave4AControlledMetadataConfigRegistryMigrationPlan.js';

export const ZAVORTH_WAVE4B_LOW_RISK_NATIVE_REGISTRY_RECONCILIATION_COMMIT_EXECUTABLE_NOW = '2026-04-30T11:00:00.000Z' as const;
export const ZAVORTH_WAVE4B_LOW_RISK_NATIVE_REGISTRY_RECONCILIATION_COMMIT_EXECUTABLE_RUNTIME_ID = 'zavorth-wave4b-low-risk-native-registry-reconciliation-commit-executable' as const;
export const ZAVORTH_WAVE4B_REGISTRY_RECONCILIATION_COMMIT_EXECUTE_FLAG = 'ZAVORTH_WAVE4B_REGISTRY_RECONCILIATION_COMMIT_EXECUTE' as const;

export type ZavorthWave4BRegistryReconciliationCommitDecision =
  | 'execution-blocked'
  | 'reconciliation-commit-corrupt'
  | 'reconciliation-commit-degraded'
  | 'reconciliation-commit-ok'
  | 'reconciliation-commit-rejected';

export type ZavorthWave4BRegistryReconciliationCommitValidationStatus =
  | 'checksum-invalid'
  | 'feature-flag-disabled'
  | 'high-impact-execution-attempted'
  | 'idempotency-invalid'
  | 'external-executor-touch-attempted'
  | 'policy-invalid'
  | 'raw-secret-detected'
  | 'redaction-invalid'
  | 'schema-invalid'
  | 'scope-invalid'
  | 'source-not-ready'
  | 'valid';

export type ZavorthWave4BRegistryReconciliationCommitWriteStatus =
  | 'already-present'
  | 'blocked'
  | 'checksum-conflict'
  | 'written';

export type ZavorthWave4BRegistryReconciliationCommitFeatureFlagGate = {
  nativeContract: 'ZavorthWave4BRegistryReconciliationCommitFeatureFlagGate/v1';
  flagName: typeof ZAVORTH_WAVE4B_REGISTRY_RECONCILIATION_COMMIT_EXECUTE_FLAG;
  enabled: boolean;
  safetyGate: 'controlled-production' | 'controlled-test';
  operatorAcknowledgedZavorthOwnedStorage: boolean;
  registryReconciliationCommitFeatureFlagRequired: true;
};

export type ZavorthWave4BRegistryReconciliationRedactionEnvelope = {
  nativeContract: 'ZavorthWave4BRegistryReconciliationRedactionEnvelope/v1';
  rawSecretSerialized: false;
  rawMessageContentSerialized: false;
  sourceIdentityPublic: false;
  provenanceInternalOnly: true;
  safeMetadataOnly: true;
  forbiddenFields: string[];
};

export type ZavorthWave4BRegistryReconciliationDiffInput = {
  nativeContract: 'ZavorthWave4BRegistryReconciliationDiffInput/v1';
  diffId: string;
  registryKind: ZavorthNativeRegistryPersistenceKind;
  dataClass: ZavorthWave4AMigrationDataClass;
  operation: 'noop' | 'upsert';
  schemaVersion: typeof ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION;
  idempotencyKey: string;
  checksum: string;
  redactionEnvelope: ZavorthWave4BRegistryReconciliationRedactionEnvelope;
  policyDecision: 'allow-native-registry-reconciliation-commit' | 'block';
  scope: 'metadata-registry-level' | 'out-of-scope';
  payload: Record<string, unknown>;
  rawSecretSerialized: false;
};

export type ZavorthWave4BRegistryReconciliationPlanItem = {
  nativeContract: 'ZavorthWave4BRegistryReconciliationPlanItem/v1';
  diffId: string;
  registryKind: ZavorthNativeRegistryPersistenceKind;
  dataClass: ZavorthWave4AMigrationDataClass;
  operation: 'noop' | 'upsert';
  schemaVersion: typeof ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION;
  idempotencyKey: string;
  checksum: string;
  payloadSummary: string;
  policyDecision: 'allow-native-registry-reconciliation-commit' | 'block';
  scope: 'metadata-registry-level' | 'out-of-scope';
  commitEligible: boolean;
  sourceIdsEvidenceOnly: true;
  provenanceInternalOnly: true;
  rawSecretSerialized: false;
};

export type ZavorthWave4BRegistryReconciliationCommittedUpdate = {
  nativeContract: 'ZavorthWave4BRegistryReconciliationCommittedUpdate/v1';
  committedAt: string;
  productionNamespace: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE;
  productionNamespaceUri: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI;
  selectedLowRiskCapability: 'native-registry-reconciliation-commit-action';
  diffId: string;
  registryKind: ZavorthNativeRegistryPersistenceKind;
  dataClass: ZavorthWave4AMigrationDataClass;
  operation: 'noop' | 'upsert';
  schemaVersion: typeof ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION;
  idempotencyKey: string;
  checksum: string;
  safeMetadata: {
    label: string;
    status: 'available' | 'degraded' | 'unavailable';
    recordDelta: number;
  };
  redactionEnvelope: ZavorthWave4BRegistryReconciliationRedactionEnvelope;
  registryReconciliationCommitActuallyExecutedOnlyWhenFlagEnabled: true;
  runtimeExternalExecutorRequiredForExecution: false;
  externalExecutorTouched: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4BRegistryReconciliationCommitWriteReceipt = {
  nativeContract: 'ZavorthWave4BRegistryReconciliationCommitWriteReceipt/v1';
  diffId: string;
  registryKind: ZavorthNativeRegistryPersistenceKind;
  dataClass: ZavorthWave4AMigrationDataClass;
  relativePath: string;
  idempotencyKey: string;
  checksum: string;
  status: ZavorthWave4BRegistryReconciliationCommitWriteStatus;
  bytesWritten: number;
  atomicWriteUsed: true;
  registryReconciliationCommitActuallyExecuted: boolean;
  rawSecretSerialized: false;
};

export type ZavorthWave4BRegistryReconciliationCommitManifest = {
  nativeContract: 'ZavorthWave4BRegistryReconciliationCommitManifest/v1';
  committedAt: string;
  productionNamespace: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE;
  productionNamespaceUri: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI;
  schemaVersion: typeof ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION;
  writeCount: number;
  writes: Array<{
    diffId: string;
    registryKind: ZavorthNativeRegistryPersistenceKind;
    dataClass: ZavorthWave4AMigrationDataClass;
    relativePath: string;
    idempotencyKey: string;
    checksum: string;
    status: ZavorthWave4BRegistryReconciliationCommitWriteStatus;
  }>;
  backupRollbackMetadataCreated: boolean;
  rawSecretSerialized: false;
};

export type ZavorthWave4BRegistryReconciliationCommitReceipt = {
  nativeContract: 'ZavorthWave4BRegistryReconciliationCommitReceipt/v1';
  runtimeId: typeof ZAVORTH_WAVE4B_LOW_RISK_NATIVE_REGISTRY_RECONCILIATION_COMMIT_EXECUTABLE_RUNTIME_ID;
  generatedAt: string;
  selectedLowRiskCapability: 'native-registry-reconciliation-commit-action';
  productionRoot: string;
  productionNamespace: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE;
  productionNamespaceUri: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI;
  decision: ZavorthWave4BRegistryReconciliationCommitDecision;
  classification: ZavorthWave4BRegistryReconciliationCommitDecision;
  validations: ZavorthWave4BRegistryReconciliationCommitValidationStatus[];
  featureFlag: ZavorthWave4BRegistryReconciliationCommitFeatureFlagGate;
  plan: ZavorthWave4BRegistryReconciliationPlanItem[];
  writes: ZavorthWave4BRegistryReconciliationCommitWriteReceipt[];
  manifestPath: string;
  backupManifestPath: string;
  wave4bRegistryReconciliationCommitExecutableCreated: true;
  selectedLowRiskCapabilityConfirmed: 'native-registry-reconciliation-commit-action';
  registryReconciliationCommitActuallyExecutedOnlyWhenFlagEnabled: true;
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

export type ZavorthWave4BRegistryReconciliationRollbackReceipt = {
  nativeContract: 'ZavorthWave4BRegistryReconciliationRollbackReceipt/v1';
  productionRoot: string;
  outcome: 'rollback-applied';
  removedRelativePaths: string[];
  rollbackApplied: true;
  runtimeExternalExecutorRequiredForExecution: false;
  externalExecutorTouched: false;
  stateMigrated: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4BRegistryReconciliationCleanupReceipt = {
  nativeContract: 'ZavorthWave4BRegistryReconciliationCleanupReceipt/v1';
  productionRoot: string;
  cleanupActuallyPerformed: boolean;
  namespaceExistsAfterCleanup: boolean;
  cleanupLimitedToControlledTestNamespace: true;
  externalExecutorTouched: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4BRegistryReconciliationCommitSource = {
  nativeRefreshCommitPackReady: true;
  wave4aFirstBatchReady: true;
  wave4aLoadVerifyParityReady: true;
  metadataValidationExecutableReady: true;
  actionGovernancePipelineReady: true;
  nativeRegistriesReady: true;
  persistenceRestoreReady: true;
  hardeningDecommissionReady: true;
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

export type ZavorthWave4BRegistryReconciliationCommitOptions = {
  productionRoot: string;
  featureFlag: ZavorthWave4BRegistryReconciliationCommitFeatureFlagGate;
  diffPlan: ZavorthWave4BRegistryReconciliationDiffInput[];
  generatedAt?: string;
};

const ALLOWED_DATA_CLASSES = new Set<ZavorthWave4AMigrationDataClass>([
  'backup-rollback-metadata',
  'capability-metadata',
  'config-metadata-redacted',
  'plugin-metadata-redacted',
  'provider-channel-transport-metadata',
  'registry-metadata',
  'secretref-metadata',
]);

const FORBIDDEN_KEYS = new Set([
  'rawCacheEntry',
  'rawLogLine',
  'rawMessageContent',
  'rawSecretValue',
  'sqlitePayload',
  'workspaceFileBody',
]);

const RAW_SECRET_PATTERNS = [
  /EXTERNAL_EXECUTOR_GATEWAY_TOKEN=(?!present-redacted|<redacted-local-secret>)[^\s`]+/,
  /(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/,
  /ghp_[A-Za-z0-9_]{8,}/,
  /xox[baprs]-[A-Za-z0-9-]{8,}/,
  /synthetic-raw-credential-sentinel-that-must-not-appear/,
];

function assertProductionRoot(productionRoot: string): string {
  const resolved = path.resolve(productionRoot);
  const cwd = path.resolve(process.cwd());

  if (!resolved.startsWith(`${cwd}${path.sep}`)) {
    throw new Error(`Registry reconciliation root must stay inside workspace: ${resolved}`);
  }
  if (!resolved.includes(`${path.sep}.tmp${path.sep}`) && !resolved.includes(`${path.sep}.zavorth${path.sep}`)) {
    throw new Error(`Registry reconciliation root must live under .tmp or .zavorth: ${resolved}`);
  }
  if (path.basename(resolved) !== ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE) {
    throw new Error(`Registry reconciliation root must end with ${ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE}: ${resolved}`);
  }

  return resolved;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value: unknown): string {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex');
}

function redactionEnvelope(): ZavorthWave4BRegistryReconciliationRedactionEnvelope {
  return {
    nativeContract: 'ZavorthWave4BRegistryReconciliationRedactionEnvelope/v1',
    rawSecretSerialized: false,
    rawMessageContentSerialized: false,
    sourceIdentityPublic: false,
    provenanceInternalOnly: true,
    safeMetadataOnly: true,
    forbiddenFields: [
      'rawSecretValue',
      'rawMessageContent',
      'sqlitePayload',
      'workspaceFileBody',
      'rawLogLine',
      'rawCacheEntry',
    ],
  };
}

function redactionEnvelopeValid(envelope: ZavorthWave4BRegistryReconciliationRedactionEnvelope): boolean {
  return (
    envelope.nativeContract === 'ZavorthWave4BRegistryReconciliationRedactionEnvelope/v1' &&
    envelope.rawSecretSerialized === false &&
    envelope.rawMessageContentSerialized === false &&
    envelope.sourceIdentityPublic === false &&
    envelope.provenanceInternalOnly === true &&
    envelope.safeMetadataOnly === true &&
    envelope.forbiddenFields.includes('rawSecretValue') &&
    envelope.forbiddenFields.includes('rawMessageContent') &&
    envelope.forbiddenFields.includes('sqlitePayload')
  );
}

function expectedChecksum(input: Pick<
  ZavorthWave4BRegistryReconciliationDiffInput,
  'dataClass' | 'diffId' | 'operation' | 'payload' | 'registryKind' | 'schemaVersion' | 'scope'
>): string {
  return sha256({
    dataClass: input.dataClass,
    diffId: input.diffId,
    operation: input.operation,
    payload: input.payload,
    registryKind: input.registryKind,
    schemaVersion: input.schemaVersion,
    scope: input.scope,
  });
}

function idempotencyKey(input: Pick<ZavorthWave4BRegistryReconciliationDiffInput, 'dataClass' | 'diffId' | 'registryKind'>): string {
  return `wave4b:registry-reconciliation:${input.registryKind}:${input.dataClass}:${input.diffId}`;
}

function hasRawSecret(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'string' && RAW_SECRET_PATTERNS.some((pattern) => pattern.test(value));
  }
  if (Array.isArray(value)) {
    return value.some(hasRawSecret);
  }
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => (
    FORBIDDEN_KEYS.has(key) || hasRawSecret(child)
  ));
}

function sourceStatuses(source: ZavorthWave4BRegistryReconciliationCommitSource): ZavorthWave4BRegistryReconciliationCommitValidationStatus[] {
  const statuses: ZavorthWave4BRegistryReconciliationCommitValidationStatus[] = [];

  if (!source.nativeRefreshCommitPackReady ||
    !source.wave4aFirstBatchReady ||
    !source.wave4aLoadVerifyParityReady ||
    !source.metadataValidationExecutableReady ||
    !source.actionGovernancePipelineReady ||
    !source.nativeRegistriesReady ||
    !source.persistenceRestoreReady ||
    !source.hardeningDecommissionReady ||
    source.runtimeExternalExecutorRequiredForExecution ||
    source.rawSecretSerialized ||
    source.publicExternalExecutorIdentityExposed ||
    source.stateMigrationAttempted ||
    source.sourceModuleCopyAttempted ||
    source.adapterRemovalAttempted) {
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

function validatePlan(diffPlan: ZavorthWave4BRegistryReconciliationDiffInput[]): ZavorthWave4BRegistryReconciliationCommitValidationStatus[] {
  const statuses: ZavorthWave4BRegistryReconciliationCommitValidationStatus[] = [];

  diffPlan.forEach((diff) => {
    if (diff.schemaVersion !== ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION ||
      diff.nativeContract !== 'ZavorthWave4BRegistryReconciliationDiffInput/v1') {
      statuses.push('schema-invalid');
    }
    if (diff.checksum !== expectedChecksum(diff) || diff.checksum.length !== 64) {
      statuses.push('checksum-invalid');
    }
    if (diff.idempotencyKey !== idempotencyKey(diff)) {
      statuses.push('idempotency-invalid');
    }
    if (!redactionEnvelopeValid(diff.redactionEnvelope) || diff.rawSecretSerialized) {
      statuses.push('redaction-invalid');
    }
    if (diff.policyDecision !== 'allow-native-registry-reconciliation-commit') {
      statuses.push('policy-invalid');
    }
    if (diff.scope !== 'metadata-registry-level' || !ALLOWED_DATA_CLASSES.has(diff.dataClass)) {
      statuses.push('scope-invalid');
    }
    if (hasRawSecret(diff.payload)) {
      statuses.push('raw-secret-detected', 'redaction-invalid');
    }
  });

  return Array.from(new Set(statuses));
}

function classify(validations: ZavorthWave4BRegistryReconciliationCommitValidationStatus[]): ZavorthWave4BRegistryReconciliationCommitDecision {
  if (validations.includes('feature-flag-disabled')) {
    return 'execution-blocked';
  }
  if (validations.includes('checksum-invalid') ||
    validations.includes('idempotency-invalid') ||
    validations.includes('schema-invalid')) {
    return 'reconciliation-commit-corrupt';
  }
  if (validations.includes('high-impact-execution-attempted') ||
    validations.includes('external-executor-touch-attempted') ||
    validations.includes('policy-invalid') ||
    validations.includes('raw-secret-detected') ||
    validations.includes('redaction-invalid') ||
    validations.includes('scope-invalid')) {
    return 'reconciliation-commit-rejected';
  }
  if (validations.includes('source-not-ready')) {
    return 'reconciliation-commit-degraded';
  }
  return 'reconciliation-commit-ok';
}

function planItem(diff: ZavorthWave4BRegistryReconciliationDiffInput): ZavorthWave4BRegistryReconciliationPlanItem {
  return {
    nativeContract: 'ZavorthWave4BRegistryReconciliationPlanItem/v1',
    diffId: diff.diffId,
    registryKind: diff.registryKind,
    dataClass: diff.dataClass,
    operation: diff.operation,
    schemaVersion: diff.schemaVersion,
    idempotencyKey: diff.idempotencyKey,
    checksum: diff.checksum,
    payloadSummary: `redacted ${diff.operation} for ${diff.registryKind}/${diff.dataClass}`,
    policyDecision: diff.policyDecision,
    scope: diff.scope,
    commitEligible: diff.operation === 'upsert' &&
      diff.policyDecision === 'allow-native-registry-reconciliation-commit' &&
      diff.scope === 'metadata-registry-level',
    sourceIdsEvidenceOnly: true,
    provenanceInternalOnly: true,
    rawSecretSerialized: false,
  };
}

function relativePathForItem(item: ZavorthWave4BRegistryReconciliationPlanItem): string {
  return path.join('wave4b-registry-reconciliation', item.registryKind, `${sha256(item.idempotencyKey).slice(0, 32)}.json`);
}

function safeMetadata(diff: ZavorthWave4BRegistryReconciliationDiffInput): ZavorthWave4BRegistryReconciliationCommittedUpdate['safeMetadata'] {
  return {
    label: typeof diff.payload.label === 'string' ? diff.payload.label : `Zavorth ${diff.registryKind} reconciliation`,
    status: diff.payload.status === 'degraded' || diff.payload.status === 'unavailable' ? diff.payload.status : 'available',
    recordDelta: typeof diff.payload.recordDelta === 'number' ? diff.payload.recordDelta : 0,
  };
}

function updatePayload(
  diff: ZavorthWave4BRegistryReconciliationDiffInput,
  item: ZavorthWave4BRegistryReconciliationPlanItem,
  committedAt: string,
): ZavorthWave4BRegistryReconciliationCommittedUpdate {
  return {
    nativeContract: 'ZavorthWave4BRegistryReconciliationCommittedUpdate/v1',
    committedAt,
    productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
    productionNamespaceUri: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI,
    selectedLowRiskCapability: 'native-registry-reconciliation-commit-action',
    diffId: diff.diffId,
    registryKind: diff.registryKind,
    dataClass: diff.dataClass,
    operation: diff.operation,
    schemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
    idempotencyKey: item.idempotencyKey,
    checksum: item.checksum,
    safeMetadata: safeMetadata(diff),
    redactionEnvelope: diff.redactionEnvelope,
    registryReconciliationCommitActuallyExecutedOnlyWhenFlagEnabled: true,
    runtimeExternalExecutorRequiredForExecution: false,
    externalExecutorTouched: false,
    rawSecretSerialized: false,
  };
}

function writeJsonAtomic(absolutePath: string, payload: ZavorthWave4BRegistryReconciliationCommittedUpdate | ZavorthWave4BRegistryReconciliationCommitManifest): {
  bytesWritten: number;
  status: Exclude<ZavorthWave4BRegistryReconciliationCommitWriteStatus, 'blocked'>;
} {
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;

  if (fs.existsSync(absolutePath)) {
    const current = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as Partial<ZavorthWave4BRegistryReconciliationCommittedUpdate>;
    if (current.checksum === (payload as Partial<ZavorthWave4BRegistryReconciliationCommittedUpdate>).checksum &&
      current.idempotencyKey === (payload as Partial<ZavorthWave4BRegistryReconciliationCommittedUpdate>).idempotencyKey &&
      current.rawSecretSerialized === false) {
      return {
        bytesWritten: 0,
        status: 'already-present',
      };
    }

    return {
      bytesWritten: 0,
      status: 'checksum-conflict',
    };
  }

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const tempPath = `${absolutePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, serialized, 'utf8');
  fs.renameSync(tempPath, absolutePath);

  return {
    bytesWritten: Buffer.byteLength(serialized, 'utf8'),
    status: 'written',
  };
}

function manifestPayload(
  committedAt: string,
  writes: ZavorthWave4BRegistryReconciliationCommitWriteReceipt[],
): ZavorthWave4BRegistryReconciliationCommitManifest {
  return {
    nativeContract: 'ZavorthWave4BRegistryReconciliationCommitManifest/v1',
    committedAt,
    productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
    productionNamespaceUri: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI,
    schemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
    writeCount: writes.length,
    writes: writes.map((write) => ({
      diffId: write.diffId,
      registryKind: write.registryKind,
      dataClass: write.dataClass,
      relativePath: write.relativePath,
      idempotencyKey: write.idempotencyKey,
      checksum: write.checksum,
      status: write.status,
    })),
    backupRollbackMetadataCreated: writes.some((write) => write.registryReconciliationCommitActuallyExecuted),
    rawSecretSerialized: false,
  };
}

function writeReceipt(
  item: ZavorthWave4BRegistryReconciliationPlanItem,
  status: ZavorthWave4BRegistryReconciliationCommitWriteStatus,
  bytesWritten: number,
  executed: boolean,
): ZavorthWave4BRegistryReconciliationCommitWriteReceipt {
  return {
    nativeContract: 'ZavorthWave4BRegistryReconciliationCommitWriteReceipt/v1',
    diffId: item.diffId,
    registryKind: item.registryKind,
    dataClass: item.dataClass,
    relativePath: relativePathForItem(item),
    idempotencyKey: item.idempotencyKey,
    checksum: item.checksum,
    status,
    bytesWritten,
    atomicWriteUsed: true,
    registryReconciliationCommitActuallyExecuted: executed,
    rawSecretSerialized: false,
  };
}

export class ZavorthWave4BLowRiskNativeRegistryReconciliationCommitExecutable {
  public constructor(private readonly source: ZavorthWave4BRegistryReconciliationCommitSource) {}

  public execute(options: ZavorthWave4BRegistryReconciliationCommitOptions): ZavorthWave4BRegistryReconciliationCommitReceipt {
    const productionRoot = assertProductionRoot(options.productionRoot);
    const generatedAt = options.generatedAt ?? ZAVORTH_WAVE4B_LOW_RISK_NATIVE_REGISTRY_RECONCILIATION_COMMIT_EXECUTABLE_NOW;
    const plan = options.diffPlan.map(planItem);
    const baseValidations = [
      ...sourceStatuses(this.source),
      ...validatePlan(options.diffPlan),
    ];
    const validations = options.featureFlag.enabled
      ? baseValidations
      : [...baseValidations, 'feature-flag-disabled' as const];
    const finalValidations = validations.length === 0 ? ['valid' as const] : Array.from(new Set(validations));
    const decision = classify(finalValidations);
    const writes = decision === 'reconciliation-commit-ok'
      ? plan.map((item, index) => {
        if (!item.commitEligible) {
          return writeReceipt(item, 'blocked', 0, false);
        }
        const payload = updatePayload(options.diffPlan[index], item, generatedAt);
        const write = writeJsonAtomic(path.join(productionRoot, relativePathForItem(item)), payload);
        return writeReceipt(item, write.status, write.bytesWritten, write.status === 'written' || write.status === 'already-present');
      })
      : plan.map((item) => writeReceipt(item, 'blocked', 0, false));

    const manifestPath = path.join(productionRoot, 'wave4b-registry-reconciliation-manifest.json');
    const backupManifestPath = path.join(productionRoot, 'rollback', 'wave4b-registry-reconciliation-backup-manifest.json');
    if (writes.some((write) => write.registryReconciliationCommitActuallyExecuted)) {
      writeJsonAtomic(manifestPath, manifestPayload(generatedAt, writes));
      fs.mkdirSync(path.dirname(backupManifestPath), { recursive: true });
      fs.writeFileSync(backupManifestPath, `${JSON.stringify({
        nativeContract: 'ZavorthWave4BRegistryReconciliationBackupManifest/v1',
        generatedAt,
        productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
        affectedRelativePaths: writes
          .filter((write) => write.registryReconciliationCommitActuallyExecuted)
          .map((write) => write.relativePath),
        backupActuallyCreated: true,
        restoreActuallyPerformed: false,
        rawSecretSerialized: false,
      }, null, 2)}\n`, 'utf8');
    }

    return {
      nativeContract: 'ZavorthWave4BRegistryReconciliationCommitReceipt/v1',
      runtimeId: ZAVORTH_WAVE4B_LOW_RISK_NATIVE_REGISTRY_RECONCILIATION_COMMIT_EXECUTABLE_RUNTIME_ID,
      generatedAt,
      selectedLowRiskCapability: 'native-registry-reconciliation-commit-action',
      productionRoot,
      productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
      productionNamespaceUri: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI,
      decision,
      classification: decision,
      validations: finalValidations,
      featureFlag: options.featureFlag,
      plan,
      writes,
      manifestPath,
      backupManifestPath,
      wave4bRegistryReconciliationCommitExecutableCreated: true,
      selectedLowRiskCapabilityConfirmed: 'native-registry-reconciliation-commit-action',
      registryReconciliationCommitActuallyExecutedOnlyWhenFlagEnabled: true,
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
    receipt: ZavorthWave4BRegistryReconciliationCommitReceipt,
  ): ZavorthWave4BRegistryReconciliationRollbackReceipt {
    const resolved = assertProductionRoot(productionRoot);
    if (!resolved.includes(`${path.sep}.tmp${path.sep}`)) {
      throw new Error(`Registry reconciliation rollback is only allowed for controlled test namespace: ${resolved}`);
    }

    const removedRelativePaths: string[] = [];
    receipt.writes
      .filter((write) => write.registryReconciliationCommitActuallyExecuted)
      .forEach((write) => {
        const absolutePath = path.join(resolved, write.relativePath);
        if (fs.existsSync(absolutePath)) {
          fs.rmSync(absolutePath, { force: true });
          removedRelativePaths.push(write.relativePath);
        }
      });

    const rollbackReceipt: ZavorthWave4BRegistryReconciliationRollbackReceipt = {
      nativeContract: 'ZavorthWave4BRegistryReconciliationRollbackReceipt/v1',
      productionRoot: resolved,
      outcome: 'rollback-applied',
      removedRelativePaths,
      rollbackApplied: true,
      runtimeExternalExecutorRequiredForExecution: false,
      externalExecutorTouched: false,
      stateMigrated: false,
      rawSecretSerialized: false,
    };
    if (removedRelativePaths.length > 0) {
      fs.mkdirSync(path.join(resolved, 'rollback'), { recursive: true });
      fs.writeFileSync(
        path.join(resolved, 'rollback', 'wave4b-registry-reconciliation-rollback-receipt.json'),
        `${JSON.stringify(rollbackReceipt, null, 2)}\n`,
        'utf8',
      );
    }

    return rollbackReceipt;
  }

  public cleanup(productionRoot: string): ZavorthWave4BRegistryReconciliationCleanupReceipt {
    const resolved = assertProductionRoot(productionRoot);
    if (!resolved.includes(`${path.sep}.tmp${path.sep}`)) {
      throw new Error(`Registry reconciliation cleanup is only allowed for controlled test namespace: ${resolved}`);
    }

    const existedBefore = fs.existsSync(resolved);
    if (existedBefore) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }

    return {
      nativeContract: 'ZavorthWave4BRegistryReconciliationCleanupReceipt/v1',
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
}

export function createZavorthWave4BRegistryReconciliationCommitFeatureFlag(
  enabled: boolean,
): ZavorthWave4BRegistryReconciliationCommitFeatureFlagGate {
  return {
    nativeContract: 'ZavorthWave4BRegistryReconciliationCommitFeatureFlagGate/v1',
    flagName: ZAVORTH_WAVE4B_REGISTRY_RECONCILIATION_COMMIT_EXECUTE_FLAG,
    enabled,
    safetyGate: 'controlled-test',
    operatorAcknowledgedZavorthOwnedStorage: true,
    registryReconciliationCommitFeatureFlagRequired: true,
  };
}

export function createZavorthWave4BRegistryReconciliationRedactionEnvelope(): ZavorthWave4BRegistryReconciliationRedactionEnvelope {
  return redactionEnvelope();
}

export function createZavorthWave4BRegistryReconciliationDiffInput(
  overrides: Partial<Omit<ZavorthWave4BRegistryReconciliationDiffInput, 'checksum' | 'idempotencyKey' | 'nativeContract' | 'rawSecretSerialized' | 'redactionEnvelope' | 'schemaVersion'>> & {
    checksum?: string;
    idempotencyKey?: string;
    redactionEnvelope?: ZavorthWave4BRegistryReconciliationRedactionEnvelope;
  } = {},
): ZavorthWave4BRegistryReconciliationDiffInput {
  const base = {
    nativeContract: 'ZavorthWave4BRegistryReconciliationDiffInput/v1' as const,
    diffId: overrides.diffId ?? 'capability-registry-classification-refresh-001',
    registryKind: overrides.registryKind ?? 'capability-registry',
    dataClass: overrides.dataClass ?? 'capability-metadata',
    operation: overrides.operation ?? 'upsert',
    schemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
    redactionEnvelope: overrides.redactionEnvelope ?? redactionEnvelope(),
    policyDecision: overrides.policyDecision ?? 'allow-native-registry-reconciliation-commit',
    scope: overrides.scope ?? 'metadata-registry-level',
    payload: overrides.payload ?? {
      label: 'Zavorth capability registry reconciliation',
      recordDelta: 1,
      status: 'available',
    },
    rawSecretSerialized: false as const,
  };

  return {
    ...base,
    idempotencyKey: overrides.idempotencyKey ?? idempotencyKey(base),
    checksum: overrides.checksum ?? expectedChecksum(base),
  };
}

export function createZavorthWave4BRegistryReconciliationCommitFixtureSource(
  overrides: Partial<ZavorthWave4BRegistryReconciliationCommitSource> = {},
): ZavorthWave4BRegistryReconciliationCommitSource {
  return {
    nativeRefreshCommitPackReady: true,
    wave4aFirstBatchReady: true,
    wave4aLoadVerifyParityReady: true,
    metadataValidationExecutableReady: true,
    actionGovernancePipelineReady: true,
    nativeRegistriesReady: true,
    persistenceRestoreReady: true,
    hardeningDecommissionReady: true,
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

export function createZavorthWave4BLowRiskNativeRegistryReconciliationCommitExecutableFixture(
  source: ZavorthWave4BRegistryReconciliationCommitSource = createZavorthWave4BRegistryReconciliationCommitFixtureSource(),
): ZavorthWave4BLowRiskNativeRegistryReconciliationCommitExecutable {
  return new ZavorthWave4BLowRiskNativeRegistryReconciliationCommitExecutable(source);
}
