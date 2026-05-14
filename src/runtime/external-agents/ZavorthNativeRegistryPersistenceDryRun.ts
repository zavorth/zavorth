import { createHash } from 'node:crypto';

import {
  createZavorthNativeCapabilityRegistryFixture,
  normalizeZavorthNativeCapabilityRegistryReplacementFixture,
} from './ZavorthNativeCapabilityRegistry.js';
import {
  createZavorthNativeConfigStateRegistryFixture,
  normalizeZavorthNativeConfigStateRegistryFixture,
} from './ZavorthNativeConfigStateRegistry.js';
import {
  createZavorthNativeDashboardViewModelRegistryFixture,
  normalizeZavorthNativeDashboardViewModelRegistryFixture,
} from './ZavorthNativeDashboardViewModelRegistry.js';
import {
  createZavorthNativeIntegrationRegistryFixture,
  normalizeZavorthNativeIntegrationRegistryFixture,
} from './ZavorthNativeIntegrationRegistry.js';
import {
  normalizeZavorthNativeRegistryRefreshReconciliationFixture,
} from './ZavorthNativeRegistryRefreshReconciliation.js';
import {
  createZavorthNativeSessionHistoryRegistryFixture,
  normalizeZavorthNativeSessionHistoryRegistryFixture,
} from './ZavorthNativeSessionHistoryRegistry.js';
import type {
  ZavorthNativeCapabilityRegistry,
  ZavorthNativeCapabilityRegistryReplacementNormalization,
} from './ZavorthNativeCapabilityRegistry.js';
import type {
  ZavorthNativeConfigStateRegistry,
  ZavorthNativeConfigStateRegistryNormalization,
} from './ZavorthNativeConfigStateRegistry.js';
import type {
  ZavorthNativeDashboardViewModelRegistry,
  ZavorthNativeDashboardViewModelRegistryNormalization,
} from './ZavorthNativeDashboardViewModelRegistry.js';
import type {
  ZavorthNativeIntegrationRegistry,
  ZavorthNativeIntegrationRegistryNormalization,
} from './ZavorthNativeIntegrationRegistry.js';
import type {
  ZavorthNativeRegistryRefreshReconciliationNormalization,
} from './ZavorthNativeRegistryRefreshReconciliation.js';
import type {
  ZavorthNativeSessionHistoryRegistry,
  ZavorthNativeSessionHistoryRegistryNormalization,
} from './ZavorthNativeSessionHistoryRegistry.js';

export const ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_DRY_RUN_NOW = '2026-04-29T04:30:00.000Z' as const;
export const ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_DRY_RUN_RUNTIME_ID = 'zavorth-native-registry-persistence-dry-run' as const;
export const ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION = 'zavorth-native-registry-persistence/v1' as const;

export type ZavorthNativeRegistryPersistenceDryRunDecision =
  | 'blocked'
  | 'native-registry-persistence-dry-run-ready';

export type ZavorthNativeRegistryPersistenceKind =
  | 'capability-registry'
  | 'config-state-registry'
  | 'dashboard-view-model-registry'
  | 'integration-registry'
  | 'session-history-registry';

export type ZavorthNativeRegistryPersistenceEligibility =
  | 'dry-run-only'
  | 'eligible-after-future-commit-gate'
  | 'metadata-only'
  | 'not-eligible';

export type ZavorthNativeRegistryPersistenceRedactionEnvelope = {
  nativeContract: 'ZavorthNativeRegistryPersistenceRedactionEnvelope/v1';
  rawSecretSerialized: false;
  rawMessageContentSerialized: false;
  sourceIdentityPublic: false;
  provenanceInternalOnly: true;
  forbiddenFields: string[];
  safeMetadataOnly: true;
};

export type ZavorthNativeRegistryPersistenceRollbackMetadata = {
  nativeContract: 'ZavorthNativeRegistryPersistenceRollbackMetadata/v1';
  backupManifestPlanned: true;
  restoreManifestPlanned: true;
  rollbackReceiptPlanned: true;
  backupActuallyCreated: false;
  restoreActuallyPerformed: false;
  checksumRequiredBeforeCommit: true;
  rollbackRequiredBeforeFutureMutation: true;
};

export type ZavorthNativeRegistryPersistenceSnapshot = {
  nativeContract: 'ZavorthNativeRegistryPersistenceSnapshot/v1';
  registryKind: ZavorthNativeRegistryPersistenceKind;
  registryId: string;
  schemaVersion: typeof ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION;
  schemaName: string;
  snapshotVersion: 'dry-run';
  generatedAt: string;
  recordCount: number;
  checksumAlgorithm: 'sha256-stable-metadata';
  contentChecksum: string;
  idempotencyKey: string;
  payloadIncludedInDryRun: false;
  storageTarget: 'zavorth-native-registry-store';
  storagePathPreview: string;
  migrationEligibility: ZavorthNativeRegistryPersistenceEligibility;
  redactionEnvelope: ZavorthNativeRegistryPersistenceRedactionEnvelope;
  rollback: ZavorthNativeRegistryPersistenceRollbackMetadata;
  provenance: {
    internalOnly: true;
    redacted: true;
    sourceRuntimeAuthority: false;
    sourceRuntimePublicIdentity: false;
  };
  runtimeExternalExecutorRequiredForPersistencePlan: false;
  persistentWriteActuallyPerformed: false;
  stateMigrated: false;
  sourceFileCopied: false;
  sourceDbCopied: false;
  sourceDbOpenedForWrite: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryPersistencePlan = {
  nativeContract: 'ZavorthNativeRegistryPersistencePlan/v1';
  mode: 'dry-run';
  snapshots: ZavorthNativeRegistryPersistenceSnapshot[];
  schemaVersion: typeof ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION;
  storagePattern: 'content-addressed-snapshot-with-idempotency-key';
  totalRecordCount: number;
  allChecksumsPresent: boolean;
  allIdempotencyKeysPresent: boolean;
  persistentWriteActuallyPerformed: false;
  runtimeExternalExecutorRequiredForPersistencePlan: false;
  adapterRemovalAllowed: false;
};

export type ZavorthNativeRegistryPersistenceReceipt = {
  nativeContract: 'ZavorthNativeRegistryPersistenceReceipt/v1';
  id: string;
  mode: 'dry-run';
  planId: string;
  snapshotCount: number;
  totalRecordCount: number;
  writePlannedForFutureGate: boolean;
  persistentWriteActuallyPerformed: false;
  receiptRedacted: true;
  checksums: Array<{
    registryKind: ZavorthNativeRegistryPersistenceKind;
    checksum: string;
    idempotencyKey: string;
  }>;
  diagnostics: string[];
  runtimeExternalExecutorRequiredForPersistencePlan: false;
  stateMigrated: false;
  sourceFileCopied: false;
  sourceDbCopied: false;
  sourceDbOpenedForWrite: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryPersistenceExecutionGate = {
  nativeRegistryPersistenceMode: 'dry-run';
  persistentWriteActuallyPerformed: false;
  stateMigrated: false;
  sourceFileCopied: false;
  sourceDbCopied: false;
  sourceDbOpenedForWrite: false;
  runtimeExternalExecutorRequiredForPersistencePlan: false;
  sourceRuntimeAuthority: false;
  executionAuthority: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  rawSecretSerialized: false;
  adapterRemovalAllowed: false;
};

export type ZavorthNativeRegistryPersistenceDryRunSource = {
  nativeCapabilityRegistry: ZavorthNativeCapabilityRegistryReplacementNormalization;
  capabilityRegistry: ZavorthNativeCapabilityRegistry;
  nativeDashboardViewModelRegistry: ZavorthNativeDashboardViewModelRegistryNormalization;
  dashboardRegistry: ZavorthNativeDashboardViewModelRegistry;
  nativeIntegrationRegistry: ZavorthNativeIntegrationRegistryNormalization;
  integrationRegistry: ZavorthNativeIntegrationRegistry;
  nativeSessionHistoryRegistry: ZavorthNativeSessionHistoryRegistryNormalization;
  sessionHistoryRegistry: ZavorthNativeSessionHistoryRegistry;
  nativeConfigStateRegistry: ZavorthNativeConfigStateRegistryNormalization;
  configStateRegistry: ZavorthNativeConfigStateRegistry;
  refreshReconciliation: ZavorthNativeRegistryRefreshReconciliationNormalization;
  persistentWriteAttempted: false;
  externalExecutorLiveRequiredForPlan: false;
  sourceFileCopyAttempted: false;
  sourceDbCopyAttempted: false;
  sourceDbWriteOpenAttempted: false;
  stateMigrationAttempted: false;
  executionAttempted: false;
  rawSecretSerialized: false;
};

export type ZavorthNativeRegistryPersistenceDryRunNormalization = {
  nativeContract: 'ZavorthNativeRegistryPersistenceDryRun/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthNativeRegistryPersistenceDryRunDecision;
  status: 'blocked' | 'native-registry-persistence-dry-run-ready';
  sourceReadiness: {
    nativeCapabilityRegistry: ZavorthNativeCapabilityRegistryReplacementNormalization['decision'];
    nativeDashboardViewModelRegistry: ZavorthNativeDashboardViewModelRegistryNormalization['decision'];
    nativeIntegrationRegistry: ZavorthNativeIntegrationRegistryNormalization['decision'];
    nativeSessionHistoryRegistry: ZavorthNativeSessionHistoryRegistryNormalization['decision'];
    nativeConfigStateRegistry: ZavorthNativeConfigStateRegistryNormalization['decision'];
    refreshReconciliation: ZavorthNativeRegistryRefreshReconciliationNormalization['decision'];
  };
  plan: ZavorthNativeRegistryPersistencePlan;
  receipt: ZavorthNativeRegistryPersistenceReceipt;
  executionGate: ZavorthNativeRegistryPersistenceExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    sourceIdentityPublic: false;
    sourceStructuresPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  commandCenterNativeLookupPreserved: true;
  runtimeExternalExecutorRequiredForPersistencePlan: false;
  nextGateRecommended: 'future-native-registry-persistence-commit-gate';
};

export type ZavorthNativeRegistryPersistenceDryRunOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  source: ZavorthNativeRegistryPersistenceDryRunSource;
};

type SnapshotInput = {
  registryKind: ZavorthNativeRegistryPersistenceKind;
  registryId: string;
  recordCount: number;
  schemaName: string;
  storageSlug: string;
  migrationEligibility: ZavorthNativeRegistryPersistenceEligibility;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function checksum(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
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
      'rawToken',
      'rawApiKey',
      'authorizationHeader',
      'credentialedUrl',
      'rawMessageContent',
      'sourceDbContent',
    ],
    safeMetadataOnly: true,
  };
}

function rollbackMetadata(): ZavorthNativeRegistryPersistenceRollbackMetadata {
  return {
    nativeContract: 'ZavorthNativeRegistryPersistenceRollbackMetadata/v1',
    backupManifestPlanned: true,
    restoreManifestPlanned: true,
    rollbackReceiptPlanned: true,
    backupActuallyCreated: false,
    restoreActuallyPerformed: false,
    checksumRequiredBeforeCommit: true,
    rollbackRequiredBeforeFutureMutation: true,
  };
}

function snapshot(
  generatedAt: string,
  input: SnapshotInput,
): ZavorthNativeRegistryPersistenceSnapshot {
  const digestMaterial = {
    registryKind: input.registryKind,
    registryId: input.registryId,
    recordCount: input.recordCount,
    schemaName: input.schemaName,
    schemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
    snapshotVersion: 'dry-run',
    generatedAt,
  };
  const contentChecksum = checksum(digestMaterial);
  const idempotencyKey = checksum({
    registryKind: input.registryKind,
    registryId: input.registryId,
    contentChecksum,
    mode: 'dry-run',
  }).slice(0, 32);

  return {
    nativeContract: 'ZavorthNativeRegistryPersistenceSnapshot/v1',
    registryKind: input.registryKind,
    registryId: input.registryId,
    schemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
    schemaName: input.schemaName,
    snapshotVersion: 'dry-run',
    generatedAt,
    recordCount: input.recordCount,
    checksumAlgorithm: 'sha256-stable-metadata',
    contentChecksum,
    idempotencyKey,
    payloadIncludedInDryRun: false,
    storageTarget: 'zavorth-native-registry-store',
    storagePathPreview: `zavorth/native-registries/${input.storageSlug}/${idempotencyKey}.json`,
    migrationEligibility: input.migrationEligibility,
    redactionEnvelope: redactionEnvelope(),
    rollback: rollbackMetadata(),
    provenance: {
      internalOnly: true,
      redacted: true,
      sourceRuntimeAuthority: false,
      sourceRuntimePublicIdentity: false,
    },
    runtimeExternalExecutorRequiredForPersistencePlan: false,
    persistentWriteActuallyPerformed: false,
    stateMigrated: false,
    sourceFileCopied: false,
    sourceDbCopied: false,
    sourceDbOpenedForWrite: false,
    rawSecretSerialized: false,
  };
}

function snapshotInputs(source: ZavorthNativeRegistryPersistenceDryRunSource): SnapshotInput[] {
  return [
    {
      registryKind: 'capability-registry',
      registryId: source.nativeCapabilityRegistry.registry.id,
      recordCount: source.nativeCapabilityRegistry.registry.entries.length,
      schemaName: 'ZavorthNativeCapabilityRegistrySnapshot',
      storageSlug: 'capabilities',
      migrationEligibility: 'eligible-after-future-commit-gate',
    },
    {
      registryKind: 'dashboard-view-model-registry',
      registryId: source.nativeDashboardViewModelRegistry.registry.id,
      recordCount: source.nativeDashboardViewModelRegistry.registry.records.length,
      schemaName: 'ZavorthNativeDashboardViewModelRegistrySnapshot',
      storageSlug: 'dashboard-view-models',
      migrationEligibility: 'eligible-after-future-commit-gate',
    },
    {
      registryKind: 'integration-registry',
      registryId: source.nativeIntegrationRegistry.registry.id,
      recordCount: source.nativeIntegrationRegistry.registry.records.length,
      schemaName: 'ZavorthNativeIntegrationRegistrySnapshot',
      storageSlug: 'integrations',
      migrationEligibility: 'eligible-after-future-commit-gate',
    },
    {
      registryKind: 'session-history-registry',
      registryId: source.nativeSessionHistoryRegistry.registry.id,
      recordCount: source.nativeSessionHistoryRegistry.registry.sessions.length +
        source.nativeSessionHistoryRegistry.registry.threads.length +
        source.nativeSessionHistoryRegistry.registry.messages.length,
      schemaName: 'ZavorthNativeSessionHistoryRegistrySnapshot',
      storageSlug: 'session-history',
      migrationEligibility: 'metadata-only',
    },
    {
      registryKind: 'config-state-registry',
      registryId: source.nativeConfigStateRegistry.registry.id,
      recordCount: source.nativeConfigStateRegistry.registry.records.length,
      schemaName: 'ZavorthNativeConfigStateRegistrySnapshot',
      storageSlug: 'config-state',
      migrationEligibility: 'dry-run-only',
    },
  ];
}

function buildPlan(
  generatedAt: string,
  source: ZavorthNativeRegistryPersistenceDryRunSource,
): ZavorthNativeRegistryPersistencePlan {
  const snapshots = snapshotInputs(source).map((input) => snapshot(generatedAt, input));

  return {
    nativeContract: 'ZavorthNativeRegistryPersistencePlan/v1',
    mode: 'dry-run',
    snapshots,
    schemaVersion: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_SCHEMA_VERSION,
    storagePattern: 'content-addressed-snapshot-with-idempotency-key',
    totalRecordCount: snapshots.reduce((total, row) => total + row.recordCount, 0),
    allChecksumsPresent: snapshots.every((row) => row.contentChecksum.length === 64),
    allIdempotencyKeysPresent: snapshots.every((row) => row.idempotencyKey.length > 0),
    persistentWriteActuallyPerformed: false,
    runtimeExternalExecutorRequiredForPersistencePlan: false,
    adapterRemovalAllowed: false,
  };
}

function buildReceipt(
  idPrefix: string,
  plan: ZavorthNativeRegistryPersistencePlan,
): ZavorthNativeRegistryPersistenceReceipt {
  return {
    nativeContract: 'ZavorthNativeRegistryPersistenceReceipt/v1',
    id: `${idPrefix}:persistence-receipt`,
    mode: 'dry-run',
    planId: `${idPrefix}:persistence-plan`,
    snapshotCount: plan.snapshots.length,
    totalRecordCount: plan.totalRecordCount,
    writePlannedForFutureGate: true,
    persistentWriteActuallyPerformed: false,
    receiptRedacted: true,
    checksums: plan.snapshots.map((row) => ({
      registryKind: row.registryKind,
      checksum: row.contentChecksum,
      idempotencyKey: row.idempotencyKey,
    })),
    diagnostics: [
      'mode:dry-run',
      `snapshot-count:${plan.snapshots.length}`,
      `total-record-count:${plan.totalRecordCount}`,
      'persistent-write:false',
      'runtime-external-executor-required:false',
    ],
    runtimeExternalExecutorRequiredForPersistencePlan: false,
    stateMigrated: false,
    sourceFileCopied: false,
    sourceDbCopied: false,
    sourceDbOpenedForWrite: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthNativeRegistryPersistenceExecutionGate {
  return {
    nativeRegistryPersistenceMode: 'dry-run',
    persistentWriteActuallyPerformed: false,
    stateMigrated: false,
    sourceFileCopied: false,
    sourceDbCopied: false,
    sourceDbOpenedForWrite: false,
    runtimeExternalExecutorRequiredForPersistencePlan: false,
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

function sourceReady(source: ZavorthNativeRegistryPersistenceDryRunSource): boolean {
  return (
    source.nativeCapabilityRegistry.decision === 'native-capability-registry-replacement-ready' &&
    source.nativeDashboardViewModelRegistry.decision === 'native-dashboard-view-model-registry-ready' &&
    source.nativeIntegrationRegistry.decision === 'native-integration-registry-ready' &&
    source.nativeSessionHistoryRegistry.decision === 'native-session-history-registry-ready' &&
    source.nativeConfigStateRegistry.decision === 'native-config-state-registry-ready' &&
    source.refreshReconciliation.decision === 'native-registry-refresh-reconciliation-ready' &&
    !source.persistentWriteAttempted &&
    !source.externalExecutorLiveRequiredForPlan &&
    !source.sourceFileCopyAttempted &&
    !source.sourceDbCopyAttempted &&
    !source.sourceDbWriteOpenAttempted &&
    !source.stateMigrationAttempted &&
    !source.executionAttempted &&
    !source.rawSecretSerialized
  );
}

export class ZavorthNativeRegistryPersistenceDryRun {
  public constructor(public readonly normalization: ZavorthNativeRegistryPersistenceDryRunNormalization) {}

  public listSnapshots(): ZavorthNativeRegistryPersistenceSnapshot[] {
    return this.normalization.plan.snapshots;
  }

  public lookupSnapshot(kind: ZavorthNativeRegistryPersistenceKind): ZavorthNativeRegistryPersistenceSnapshot | undefined {
    return this.normalization.plan.snapshots.find((snapshotRow) => snapshotRow.registryKind === kind);
  }

  public receipt(): ZavorthNativeRegistryPersistenceReceipt {
    return this.normalization.receipt;
  }
}

export function createZavorthNativeRegistryPersistenceDryRunFixtureSource(): ZavorthNativeRegistryPersistenceDryRunSource {
  return {
    nativeCapabilityRegistry: normalizeZavorthNativeCapabilityRegistryReplacementFixture(),
    capabilityRegistry: createZavorthNativeCapabilityRegistryFixture(),
    nativeDashboardViewModelRegistry: normalizeZavorthNativeDashboardViewModelRegistryFixture(),
    dashboardRegistry: createZavorthNativeDashboardViewModelRegistryFixture(),
    nativeIntegrationRegistry: normalizeZavorthNativeIntegrationRegistryFixture(),
    integrationRegistry: createZavorthNativeIntegrationRegistryFixture(),
    nativeSessionHistoryRegistry: normalizeZavorthNativeSessionHistoryRegistryFixture(),
    sessionHistoryRegistry: createZavorthNativeSessionHistoryRegistryFixture(),
    nativeConfigStateRegistry: normalizeZavorthNativeConfigStateRegistryFixture(),
    configStateRegistry: createZavorthNativeConfigStateRegistryFixture(),
    refreshReconciliation: normalizeZavorthNativeRegistryRefreshReconciliationFixture(),
    persistentWriteAttempted: false,
    externalExecutorLiveRequiredForPlan: false,
    sourceFileCopyAttempted: false,
    sourceDbCopyAttempted: false,
    sourceDbWriteOpenAttempted: false,
    stateMigrationAttempted: false,
    executionAttempted: false,
    rawSecretSerialized: false,
  };
}

export function normalizeZavorthNativeRegistryPersistenceDryRun<TRuntimeId extends string>(
  options: ZavorthNativeRegistryPersistenceDryRunOptions<TRuntimeId>,
): ZavorthNativeRegistryPersistenceDryRunNormalization {
  const plan = buildPlan(options.generatedAt, options.source);
  const receipt = buildReceipt(options.idPrefix, plan);
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    plan.snapshots.length === 5 &&
    plan.allChecksumsPresent &&
    plan.allIdempotencyKeysPresent &&
    plan.snapshots.every((snapshotRow) => !snapshotRow.payloadIncludedInDryRun) &&
    !plan.persistentWriteActuallyPerformed &&
    !receipt.persistentWriteActuallyPerformed;

  return {
    nativeContract: 'ZavorthNativeRegistryPersistenceDryRun/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'native-registry-persistence-dry-run-ready' : 'blocked',
    status: ready ? 'native-registry-persistence-dry-run-ready' : 'blocked',
    sourceReadiness: {
      nativeCapabilityRegistry: options.source.nativeCapabilityRegistry.decision,
      nativeDashboardViewModelRegistry: options.source.nativeDashboardViewModelRegistry.decision,
      nativeIntegrationRegistry: options.source.nativeIntegrationRegistry.decision,
      nativeSessionHistoryRegistry: options.source.nativeSessionHistoryRegistry.decision,
      nativeConfigStateRegistry: options.source.nativeConfigStateRegistry.decision,
      refreshReconciliation: options.source.refreshReconciliation.decision,
    },
    plan,
    receipt,
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      sourceStructuresPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    commandCenterNativeLookupPreserved: true,
    runtimeExternalExecutorRequiredForPersistencePlan: false,
    nextGateRecommended: 'future-native-registry-persistence-commit-gate',
  };
}

export function normalizeZavorthNativeRegistryPersistenceDryRunFixture(): ZavorthNativeRegistryPersistenceDryRunNormalization {
  return normalizeZavorthNativeRegistryPersistenceDryRun({
    generatedAt: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_DRY_RUN_NOW,
    runtimeId: ZAVORTH_NATIVE_REGISTRY_PERSISTENCE_DRY_RUN_RUNTIME_ID,
    idPrefix: 'zavorth-native-registry-persistence-dry-run',
    source: createZavorthNativeRegistryPersistenceDryRunFixtureSource(),
  });
}

export function createZavorthNativeRegistryPersistenceDryRunFixture(): ZavorthNativeRegistryPersistenceDryRun {
  return new ZavorthNativeRegistryPersistenceDryRun(
    normalizeZavorthNativeRegistryPersistenceDryRunFixture(),
  );
}
