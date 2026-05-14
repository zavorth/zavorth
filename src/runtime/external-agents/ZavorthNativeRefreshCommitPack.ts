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
import {
  normalizeZavorthNativeAbsorptionConsolidationPackFixture,
} from './ZavorthNativeAbsorptionConsolidationPack.js';
import {
  normalizeZavorthNativeRegistryRefreshReconciliationFixture,
} from './ZavorthNativeRegistryRefreshReconciliation.js';
import type {
  ZavorthNativeRegistryPersistenceKind,
  ZavorthNativeRegistryPersistenceRedactionEnvelope,
} from './ZavorthNativeRegistryPersistenceDryRun.js';
import type {
  ZavorthNativeAbsorptionConsolidationNormalization,
} from './ZavorthNativeAbsorptionConsolidationPack.js';
import type {
  ZavorthNativeRegistryRefreshCandidate,
  ZavorthNativeRegistryRefreshReconciliationNormalization,
  ZavorthNativeRegistryRefreshSurfaceId,
  ZavorthNativeRegistryReconciliationOutcome,
} from './ZavorthNativeRegistryRefreshReconciliation.js';

export const ZAVORTH_NATIVE_REFRESH_COMMIT_PACK_NOW = '2026-04-29T09:00:00.000Z' as const;
export const ZAVORTH_NATIVE_REFRESH_COMMIT_PACK_RUNTIME_ID = 'zavorth-native-refresh-commit-pack' as const;
export const ZAVORTH_NATIVE_REFRESH_COMMIT_FLAG = 'ZAVORTH_NATIVE_REFRESH_COMMIT_WRITE' as const;

export type ZavorthNativeRefreshCommitDecision =
  | 'native-refresh-commit-ready'
  | 'refresh-commit-blocked';

export type ZavorthNativeRefreshCommitPlanOutcome =
  | 'conflict'
  | 'degraded'
  | 'no-change'
  | 'rejected-by-policy'
  | 'source-unavailable'
  | 'updated';

export type ZavorthNativeRefreshCommitWriteStatus =
  | 'already-present'
  | 'blocked'
  | 'checksum-conflict'
  | 'skipped'
  | 'written';

export type ZavorthNativeRefreshCommitValidationStatus =
  | 'feature-flag-disabled'
  | 'policy-rejected'
  | 'redaction-invalid'
  | 'schema-invalid'
  | 'source-not-ready'
  | 'valid';

export type ZavorthNativeRefreshCommitFeatureFlagGate = {
  nativeContract: 'ZavorthNativeRefreshCommitFeatureFlagGate/v1';
  flagName: typeof ZAVORTH_NATIVE_REFRESH_COMMIT_FLAG;
  enabled: boolean;
  safetyGate: 'controlled-test' | 'controlled-production';
  operatorAcknowledgedZavorthOwnedNamespace: boolean;
  refreshCommitFeatureFlagRequired: true;
};

export type ZavorthNativeRefreshCommitPlanItem = {
  nativeContract: 'ZavorthNativeRefreshCommitPlanItem/v1';
  id: string;
  surfaceId: ZavorthNativeRegistryRefreshSurfaceId;
  registryKind: ZavorthNativeRegistryPersistenceKind;
  nativeRegistryId: string;
  dryRunOutcome: ZavorthNativeRegistryReconciliationOutcome;
  commitOutcome: ZavorthNativeRefreshCommitPlanOutcome;
  diffSummary: string;
  previousRecordCount: number;
  proposedRecordDelta: number;
  nextRecordCount: number;
  riskChangeDetected: boolean;
  policyApprovalRequired: boolean;
  policyApprovalGranted: boolean;
  commitEligible: boolean;
  idempotencyKey: string;
  contentChecksum: string;
  schemaVersion: typeof ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION;
  redactionEnvelope: ZavorthNativeRegistryPersistenceRedactionEnvelope;
  sourceIdsEvidenceOnly: true;
  provenanceInternalOnly: true;
  sourceRuntimeAuthority: false;
  externalMutationActuallyPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRefreshCommittedRegistryUpdate = {
  nativeContract: 'ZavorthNativeRefreshCommittedRegistryUpdate/v1';
  committedAt: string;
  productionNamespace: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE;
  productionNamespaceUri: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI;
  registryKind: ZavorthNativeRegistryPersistenceKind;
  nativeRegistryId: string;
  surfaceId: ZavorthNativeRegistryRefreshSurfaceId;
  schemaVersion: typeof ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION;
  idempotencyKey: string;
  contentChecksum: string;
  previousRecordCount: number;
  proposedRecordDelta: number;
  nextRecordCount: number;
  diffSummary: string;
  redactionEnvelope: ZavorthNativeRegistryPersistenceRedactionEnvelope;
  provenance: {
    internalOnly: true;
    redacted: true;
    sourceRuntimeAuthority: false;
    sourceRuntimePublicIdentity: false;
  };
  registryMutationCommittedOnlyWhenFlagEnabled: true;
  runtimeExternalExecutorRequiredForDefaultLookup: false;
  runtimeExternalExecutorRequiredForDefaultRender: false;
  adapterDefaultPathForNativeReadySurfaces: false;
  externalMutationActuallyPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRefreshCommitWriteReceipt = {
  nativeContract: 'ZavorthNativeRefreshCommitWriteReceipt/v1';
  itemId: string;
  surfaceId: ZavorthNativeRegistryRefreshSurfaceId;
  registryKind: ZavorthNativeRegistryPersistenceKind;
  relativePath: string;
  idempotencyKey: string;
  contentChecksum: string;
  status: ZavorthNativeRefreshCommitWriteStatus;
  bytesWritten: number;
  atomicWriteUsed: true;
  registryMutationCommitted: boolean;
  rawSecretSerialized: false;
};

export type ZavorthNativeRefreshCommitManifest = {
  nativeContract: 'ZavorthNativeRefreshCommitManifest/v1';
  committedAt: string;
  productionNamespace: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE;
  productionNamespaceUri: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI;
  schemaVersion: typeof ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION;
  writeCount: number;
  writes: Array<{
    itemId: string;
    surfaceId: ZavorthNativeRegistryRefreshSurfaceId;
    registryKind: ZavorthNativeRegistryPersistenceKind;
    relativePath: string;
    idempotencyKey: string;
    contentChecksum: string;
    status: ZavorthNativeRefreshCommitWriteStatus;
  }>;
  backupRollbackMetadataCreated: boolean;
  rawSecretSerialized: false;
};

export type ZavorthNativeRefreshCommitBackupManifest = {
  nativeContract: 'ZavorthNativeRefreshCommitBackupManifest/v1';
  committedAt: string;
  productionNamespace: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE;
  rollbackReceiptPath: string;
  affectedRelativePaths: string[];
  backupActuallyCreated: boolean;
  restoreActuallyPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRefreshCommitCommandCenterConsistency = {
  nativeContract: 'ZavorthNativeRefreshCommitCommandCenterConsistency/v1';
  commandCenterNativeFirstAfterCommit: true;
  runtimeExternalExecutorRequiredForDefaultLookup: false;
  runtimeExternalExecutorRequiredForDefaultRender: false;
  adapterDefaultPathForNativeReadySurfaces: false;
  adapterRefreshAllowed: true;
  refreshFailureBreaksLookupRender: false;
  productionLoadedNativeFirstDefaultPrepared: true;
  rawSecretSerialized: false;
};

export type ZavorthNativeRefreshCommitReceipt = {
  nativeContract: 'ZavorthNativeRefreshCommitReceipt/v1';
  runtimeId: typeof ZAVORTH_NATIVE_REFRESH_COMMIT_PACK_RUNTIME_ID;
  decision: ZavorthNativeRefreshCommitDecision;
  committedAt: string;
  productionRoot: string;
  productionNamespace: typeof ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE;
  featureFlag: ZavorthNativeRefreshCommitFeatureFlagGate;
  validations: ZavorthNativeRefreshCommitValidationStatus[];
  plan: ZavorthNativeRefreshCommitPlanItem[];
  writes: ZavorthNativeRefreshCommitWriteReceipt[];
  manifestPath: string;
  backupManifestPath: string;
  commandCenterConsistency: ZavorthNativeRefreshCommitCommandCenterConsistency;
  nativeRefreshCommitPackCreated: true;
  refreshCommitFeatureFlagRequired: true;
  registryMutationCommittedOnlyWhenFlagEnabled: true;
  runtimeExternalExecutorRequiredForDefaultLookup: false;
  runtimeExternalExecutorRequiredForDefaultRender: false;
  adapterDefaultPathForNativeReadySurfaces: false;
  adapterRefreshAllowed: true;
  adapterRemovalGlobalAllowed: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  externalMutationActuallyPerformed: false;
  stateMigrated: false;
  sourceModuleCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRefreshCommitRollbackReceipt = {
  nativeContract: 'ZavorthNativeRefreshCommitRollbackReceipt/v1';
  productionRoot: string;
  outcome: 'rollback-applied';
  removedRelativePaths: string[];
  rollbackApplied: true;
  registryMutationCommittedOnlyWhenFlagEnabled: true;
  runtimeExternalExecutorRequiredForDefaultLookup: false;
  runtimeExternalExecutorRequiredForDefaultRender: false;
  externalMutationActuallyPerformed: false;
  stateMigrated: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRefreshCommitCleanupReceipt = {
  nativeContract: 'ZavorthNativeRefreshCommitCleanupReceipt/v1';
  productionRoot: string;
  cleanupActuallyPerformed: boolean;
  namespaceExistsAfterCleanup: boolean;
  cleanupLimitedToControlledTestNamespace: true;
  stateMigrated: false;
  sourceModuleCopied: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRefreshCommitPackSource = {
  refreshReconciliation: ZavorthNativeRegistryRefreshReconciliationNormalization;
  consolidation: ZavorthNativeAbsorptionConsolidationNormalization;
  adapterCalledForDefaultLookup: false;
  adapterCalledForDefaultRender: false;
  externalExecutorLiveCalledForDefaultPath: false;
  externalMutationAttempted: false;
  stateMigrationAttempted: false;
  sourceModuleCopyAttempted: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRefreshCommitOptions = {
  productionRoot: string;
  featureFlag: ZavorthNativeRefreshCommitFeatureFlagGate;
  committedAt?: string;
  policyAllowsCommit?: boolean;
  policyApprovalForRiskChange?: boolean;
  optionalSourceAvailable?: boolean;
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

function redactionEnvelope(): ZavorthNativeRegistryPersistenceRedactionEnvelope {
  return {
    nativeContract: 'ZavorthNativeRegistryPersistenceRedactionEnvelope/v1',
    rawSecretSerialized: false,
    rawMessageContentSerialized: false,
    sourceIdentityPublic: false,
    provenanceInternalOnly: true,
    forbiddenFields: [
      'rawSecretValue',
      'rawMessageContent',
      'externalExecutorGatewayToken',
      'providerApiKey',
    ],
    safeMetadataOnly: true,
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

function registryKindForSurface(surfaceId: ZavorthNativeRegistryRefreshSurfaceId): ZavorthNativeRegistryPersistenceKind {
  if (surfaceId === 'capability-lookup-classify') {
    return 'capability-registry';
  }
  if (surfaceId === 'dashboard-render-view-lookup') {
    return 'dashboard-view-model-registry';
  }
  if (surfaceId === 'provider-channel-transport-metadata-lookup') {
    return 'integration-registry';
  }
  if (surfaceId === 'session-history-metadata-lookup') {
    return 'session-history-registry';
  }
  return 'config-state-registry';
}

function riskChangeDetected(candidate: ZavorthNativeRegistryRefreshCandidate): boolean {
  return candidate.outcome === 'conflict' || candidate.outcome === 'degraded';
}

function commitOutcome(
  candidate: ZavorthNativeRegistryRefreshCandidate,
  options: Required<Pick<ZavorthNativeRefreshCommitOptions, 'optionalSourceAvailable' | 'policyAllowsCommit' | 'policyApprovalForRiskChange'>>,
): ZavorthNativeRefreshCommitPlanOutcome {
  if (!options.policyAllowsCommit) {
    return 'rejected-by-policy';
  }
  if (!options.optionalSourceAvailable || candidate.outcome === 'source-unavailable') {
    return 'source-unavailable';
  }
  if (candidate.outcome === 'conflict') {
    return 'conflict';
  }
  if (candidate.outcome === 'degraded') {
    return 'degraded';
  }
  if (candidate.outcome === 'updated') {
    return riskChangeDetected(candidate) && !options.policyApprovalForRiskChange
      ? 'rejected-by-policy'
      : 'updated';
  }
  return 'no-change';
}

function itemFromCandidate(
  candidate: ZavorthNativeRegistryRefreshCandidate,
  options: Required<Pick<ZavorthNativeRefreshCommitOptions, 'optionalSourceAvailable' | 'policyAllowsCommit' | 'policyApprovalForRiskChange'>>,
): ZavorthNativeRefreshCommitPlanItem {
  const registryKind = registryKindForSurface(candidate.surfaceId);
  const nextRecordCount = candidate.currentNativeRecordCount + (
    candidate.outcome === 'updated' ? candidate.proposedRecordDelta : 0
  );
  const riskChange = riskChangeDetected(candidate);
  const outcome = commitOutcome(candidate, options);
  const idBasis = {
    candidate: candidate.surfaceId,
    registryKind,
    nativeRegistryId: candidate.nativeRegistryId,
    nextRecordCount,
    outcome,
    schemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
  };
  const contentBasis = {
    surfaceId: candidate.surfaceId,
    registryKind,
    previousRecordCount: candidate.currentNativeRecordCount,
    proposedRecordDelta: candidate.proposedRecordDelta,
    nextRecordCount,
    outcome,
    diffSummary: candidate.diffSummary,
  };
  const idempotencyKey = sha256(idBasis).slice(0, 32);

  return {
    nativeContract: 'ZavorthNativeRefreshCommitPlanItem/v1',
    id: `refresh-commit:${candidate.surfaceId}:${idempotencyKey}`,
    surfaceId: candidate.surfaceId,
    registryKind,
    nativeRegistryId: candidate.nativeRegistryId,
    dryRunOutcome: candidate.outcome,
    commitOutcome: outcome,
    diffSummary: candidate.diffSummary,
    previousRecordCount: candidate.currentNativeRecordCount,
    proposedRecordDelta: candidate.proposedRecordDelta,
    nextRecordCount,
    riskChangeDetected: riskChange,
    policyApprovalRequired: riskChange,
    policyApprovalGranted: riskChange ? options.policyApprovalForRiskChange : true,
    commitEligible: outcome === 'updated',
    idempotencyKey,
    contentChecksum: sha256(contentBasis),
    schemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
    redactionEnvelope: redactionEnvelope(),
    sourceIdsEvidenceOnly: true,
    provenanceInternalOnly: true,
    sourceRuntimeAuthority: false,
    externalMutationActuallyPerformed: false,
    rawSecretSerialized: false,
  };
}

function relativePathForItem(item: ZavorthNativeRefreshCommitPlanItem): string {
  return path.join('native-refresh-commits', item.registryKind, `${item.idempotencyKey}.json`);
}

function updatePayload(
  item: ZavorthNativeRefreshCommitPlanItem,
  committedAt: string,
): ZavorthNativeRefreshCommittedRegistryUpdate {
  return {
    nativeContract: 'ZavorthNativeRefreshCommittedRegistryUpdate/v1',
    committedAt,
    productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
    productionNamespaceUri: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI,
    registryKind: item.registryKind,
    nativeRegistryId: item.nativeRegistryId,
    surfaceId: item.surfaceId,
    schemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
    idempotencyKey: item.idempotencyKey,
    contentChecksum: item.contentChecksum,
    previousRecordCount: item.previousRecordCount,
    proposedRecordDelta: item.proposedRecordDelta,
    nextRecordCount: item.nextRecordCount,
    diffSummary: item.diffSummary,
    redactionEnvelope: item.redactionEnvelope,
    provenance: {
      internalOnly: true,
      redacted: true,
      sourceRuntimeAuthority: false,
      sourceRuntimePublicIdentity: false,
    },
    registryMutationCommittedOnlyWhenFlagEnabled: true,
    runtimeExternalExecutorRequiredForDefaultLookup: false,
    runtimeExternalExecutorRequiredForDefaultRender: false,
    adapterDefaultPathForNativeReadySurfaces: false,
    externalMutationActuallyPerformed: false,
    rawSecretSerialized: false,
  };
}

function writeJsonAtomic(absolutePath: string, payload: unknown): {
  bytesWritten: number;
  status: Exclude<ZavorthNativeRefreshCommitWriteStatus, 'blocked' | 'skipped'>;
} {
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;

  if (fs.existsSync(absolutePath)) {
    const current = JSON.parse(fs.readFileSync(absolutePath, 'utf8')) as Partial<ZavorthNativeRefreshCommittedRegistryUpdate>;
    if (
      current.contentChecksum === (payload as Partial<ZavorthNativeRefreshCommittedRegistryUpdate>).contentChecksum &&
      current.idempotencyKey === (payload as Partial<ZavorthNativeRefreshCommittedRegistryUpdate>).idempotencyKey &&
      current.rawSecretSerialized === false
    ) {
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

function sourceValid(source: ZavorthNativeRefreshCommitPackSource): ZavorthNativeRefreshCommitValidationStatus[] {
  const validations: ZavorthNativeRefreshCommitValidationStatus[] = [];

  if (
    source.refreshReconciliation.decision !== 'native-registry-refresh-reconciliation-ready' ||
    source.consolidation.decision !== 'native-absorption-consolidation-ready'
  ) {
    validations.push('source-not-ready');
  }
  if (
    source.adapterCalledForDefaultLookup ||
    source.adapterCalledForDefaultRender ||
    source.externalExecutorLiveCalledForDefaultPath ||
    source.externalMutationAttempted ||
    source.stateMigrationAttempted ||
    source.sourceModuleCopyAttempted
  ) {
    validations.push('source-not-ready');
  }
  if (source.rawSecretSerialized) {
    validations.push('redaction-invalid');
  }

  return validations;
}

function commandCenterConsistency(): ZavorthNativeRefreshCommitCommandCenterConsistency {
  return {
    nativeContract: 'ZavorthNativeRefreshCommitCommandCenterConsistency/v1',
    commandCenterNativeFirstAfterCommit: true,
    runtimeExternalExecutorRequiredForDefaultLookup: false,
    runtimeExternalExecutorRequiredForDefaultRender: false,
    adapterDefaultPathForNativeReadySurfaces: false,
    adapterRefreshAllowed: true,
    refreshFailureBreaksLookupRender: false,
    productionLoadedNativeFirstDefaultPrepared: true,
    rawSecretSerialized: false,
  };
}

function manifestPayload(
  committedAt: string,
  writes: ZavorthNativeRefreshCommitWriteReceipt[],
): ZavorthNativeRefreshCommitManifest {
  return {
    nativeContract: 'ZavorthNativeRefreshCommitManifest/v1',
    committedAt,
    productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
    productionNamespaceUri: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE_URI,
    schemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
    writeCount: writes.length,
    writes: writes.map((write) => ({
      itemId: write.itemId,
      surfaceId: write.surfaceId,
      registryKind: write.registryKind,
      relativePath: write.relativePath,
      idempotencyKey: write.idempotencyKey,
      contentChecksum: write.contentChecksum,
      status: write.status,
    })),
    backupRollbackMetadataCreated: writes.some((write) => write.registryMutationCommitted),
    rawSecretSerialized: false,
  };
}

function backupManifestPayload(
  productionRoot: string,
  committedAt: string,
  writes: ZavorthNativeRefreshCommitWriteReceipt[],
): ZavorthNativeRefreshCommitBackupManifest {
  return {
    nativeContract: 'ZavorthNativeRefreshCommitBackupManifest/v1',
    committedAt,
    productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
    rollbackReceiptPath: path.join(productionRoot, 'rollback', 'refresh-commit-rollback-receipt.json'),
    affectedRelativePaths: writes
      .filter((write) => write.registryMutationCommitted)
      .map((write) => write.relativePath),
    backupActuallyCreated: writes.some((write) => write.registryMutationCommitted),
    restoreActuallyPerformed: false,
    rawSecretSerialized: false,
  };
}

export class ZavorthNativeRefreshCommitPack {
  public constructor(private readonly source: ZavorthNativeRefreshCommitPackSource) {}

  public buildPlan(options: Pick<ZavorthNativeRefreshCommitOptions, 'optionalSourceAvailable' | 'policyAllowsCommit' | 'policyApprovalForRiskChange'> = {}): ZavorthNativeRefreshCommitPlanItem[] {
    return this.source.refreshReconciliation.candidates.map((candidate) => itemFromCandidate(candidate, {
      optionalSourceAvailable: options.optionalSourceAvailable ?? true,
      policyAllowsCommit: options.policyAllowsCommit ?? true,
      policyApprovalForRiskChange: options.policyApprovalForRiskChange ?? false,
    }));
  }

  public commit(options: ZavorthNativeRefreshCommitOptions): ZavorthNativeRefreshCommitReceipt {
    const productionRoot = assertProductionRoot(options.productionRoot);
    const committedAt = options.committedAt ?? ZAVORTH_NATIVE_REFRESH_COMMIT_PACK_NOW;
    const plan = this.buildPlan(options);
    const baseValidations = sourceValid(this.source);
    const validations = options.featureFlag.enabled
      ? baseValidations
      : [...baseValidations, 'feature-flag-disabled' as const];

    if (options.policyAllowsCommit === false) {
      validations.push('policy-rejected');
    }
    if (plan.some((item) => item.schemaVersion !== ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION)) {
      validations.push('schema-invalid');
    }
    if (plan.some((item) => !redactionEnvelopeValid(item.redactionEnvelope))) {
      validations.push('redaction-invalid');
    }

    const writes = validations.length > 0
      ? plan.map((item) => this.writeReceipt(item, 'blocked', 0, false))
      : plan.map((item) => {
        if (!item.commitEligible) {
          return this.writeReceipt(item, 'skipped', 0, false);
        }
        const relativePath = relativePathForItem(item);
        const payload = updatePayload(item, committedAt);
        const write = writeJsonAtomic(path.join(productionRoot, relativePath), payload);
        return this.writeReceipt(
          item,
          write.status,
          write.bytesWritten,
          write.status === 'written' || write.status === 'already-present',
        );
      });

    const successfulWrites = writes.filter((write) => write.registryMutationCommitted);
    if (validations.length === 0 && writes.some((write) => write.status === 'checksum-conflict')) {
      validations.push('checksum-invalid' as ZavorthNativeRefreshCommitValidationStatus);
    }
    if (validations.length === 0) {
      validations.push('valid');
    }

    const manifestPath = path.join(productionRoot, 'refresh-commit-manifest.json');
    const backupManifestPath = path.join(productionRoot, 'rollback', 'refresh-commit-backup-manifest.json');
    if (successfulWrites.length > 0) {
      writeJsonAtomic(manifestPath, manifestPayload(committedAt, writes));
      writeJsonAtomic(backupManifestPath, backupManifestPayload(productionRoot, committedAt, writes));
    }

    return {
      nativeContract: 'ZavorthNativeRefreshCommitReceipt/v1',
      runtimeId: ZAVORTH_NATIVE_REFRESH_COMMIT_PACK_RUNTIME_ID,
      decision: validations.length === 1 && validations[0] === 'valid'
        ? 'native-refresh-commit-ready'
        : 'refresh-commit-blocked',
      committedAt,
      productionRoot,
      productionNamespace: ZAVORTH_NATIVE_REGISTRY_PRODUCTION_NAMESPACE,
      featureFlag: options.featureFlag,
      validations: Array.from(new Set(validations)),
      plan,
      writes,
      manifestPath,
      backupManifestPath,
      commandCenterConsistency: commandCenterConsistency(),
      nativeRefreshCommitPackCreated: true,
      refreshCommitFeatureFlagRequired: true,
      registryMutationCommittedOnlyWhenFlagEnabled: true,
      runtimeExternalExecutorRequiredForDefaultLookup: false,
      runtimeExternalExecutorRequiredForDefaultRender: false,
      adapterDefaultPathForNativeReadySurfaces: false,
      adapterRefreshAllowed: true,
      adapterRemovalGlobalAllowed: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      externalMutationActuallyPerformed: false,
      stateMigrated: false,
      sourceModuleCopied: false,
      rawSecretSerialized: false,
    };
  }

  public rollback(
    productionRoot: string,
    receipt: ZavorthNativeRefreshCommitReceipt,
  ): ZavorthNativeRefreshCommitRollbackReceipt {
    const resolved = assertProductionRoot(productionRoot);
    if (!resolved.includes(`${path.sep}.tmp${path.sep}`)) {
      throw new Error(`Refresh commit rollback is only allowed for controlled test namespace: ${resolved}`);
    }

    const removedRelativePaths: string[] = [];
    receipt.writes
      .filter((write) => write.registryMutationCommitted)
      .forEach((write) => {
        const absolutePath = path.join(resolved, write.relativePath);
        if (fs.existsSync(absolutePath)) {
          fs.rmSync(absolutePath, { force: true });
          removedRelativePaths.push(write.relativePath);
        }
      });

    const rollbackReceipt: ZavorthNativeRefreshCommitRollbackReceipt = {
      nativeContract: 'ZavorthNativeRefreshCommitRollbackReceipt/v1',
      productionRoot: resolved,
      outcome: 'rollback-applied',
      removedRelativePaths,
      rollbackApplied: true,
      registryMutationCommittedOnlyWhenFlagEnabled: true,
      runtimeExternalExecutorRequiredForDefaultLookup: false,
      runtimeExternalExecutorRequiredForDefaultRender: false,
      externalMutationActuallyPerformed: false,
      stateMigrated: false,
      rawSecretSerialized: false,
    };
    if (removedRelativePaths.length > 0) {
      writeJsonAtomic(path.join(resolved, 'rollback', 'refresh-commit-rollback-receipt.json'), rollbackReceipt);
    }

    return rollbackReceipt;
  }

  public cleanup(productionRoot: string): ZavorthNativeRefreshCommitCleanupReceipt {
    const resolved = assertProductionRoot(productionRoot);
    if (!resolved.includes(`${path.sep}.tmp${path.sep}`)) {
      throw new Error(`Refresh commit cleanup is only allowed for controlled test namespace: ${resolved}`);
    }

    const existedBefore = fs.existsSync(resolved);
    if (existedBefore) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }

    return {
      nativeContract: 'ZavorthNativeRefreshCommitCleanupReceipt/v1',
      productionRoot: resolved,
      cleanupActuallyPerformed: existedBefore,
      namespaceExistsAfterCleanup: fs.existsSync(resolved),
      cleanupLimitedToControlledTestNamespace: true,
      stateMigrated: false,
      sourceModuleCopied: false,
      rawSecretSerialized: false,
    };
  }

  private writeReceipt(
    item: ZavorthNativeRefreshCommitPlanItem,
    status: ZavorthNativeRefreshCommitWriteStatus,
    bytesWritten: number,
    registryMutationCommitted: boolean,
  ): ZavorthNativeRefreshCommitWriteReceipt {
    return {
      nativeContract: 'ZavorthNativeRefreshCommitWriteReceipt/v1',
      itemId: item.id,
      surfaceId: item.surfaceId,
      registryKind: item.registryKind,
      relativePath: relativePathForItem(item),
      idempotencyKey: item.idempotencyKey,
      contentChecksum: item.contentChecksum,
      status,
      bytesWritten,
      atomicWriteUsed: true,
      registryMutationCommitted,
      rawSecretSerialized: false,
    };
  }
}

export function createZavorthNativeRefreshCommitFeatureFlag(
  enabled: boolean,
): ZavorthNativeRefreshCommitFeatureFlagGate {
  return {
    nativeContract: 'ZavorthNativeRefreshCommitFeatureFlagGate/v1',
    flagName: ZAVORTH_NATIVE_REFRESH_COMMIT_FLAG,
    enabled,
    safetyGate: 'controlled-test',
    operatorAcknowledgedZavorthOwnedNamespace: true,
    refreshCommitFeatureFlagRequired: true,
  };
}

export function createZavorthNativeRefreshCommitPackFixtureSource(
  overrides: Partial<ZavorthNativeRefreshCommitPackSource> = {},
): ZavorthNativeRefreshCommitPackSource {
  return {
    refreshReconciliation: normalizeZavorthNativeRegistryRefreshReconciliationFixture(),
    consolidation: normalizeZavorthNativeAbsorptionConsolidationPackFixture(),
    adapterCalledForDefaultLookup: false,
    adapterCalledForDefaultRender: false,
    externalExecutorLiveCalledForDefaultPath: false,
    externalMutationAttempted: false,
    stateMigrationAttempted: false,
    sourceModuleCopyAttempted: false,
    rawSecretSerialized: false,
    ...overrides,
  };
}

export function createZavorthNativeRefreshCommitPackFixture(
  source: ZavorthNativeRefreshCommitPackSource = createZavorthNativeRefreshCommitPackFixtureSource(),
): ZavorthNativeRefreshCommitPack {
  return new ZavorthNativeRefreshCommitPack(source);
}
