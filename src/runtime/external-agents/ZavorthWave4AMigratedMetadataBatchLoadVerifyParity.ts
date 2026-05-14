import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4A_FIRST_CONTROLLED_METADATA_CONFIG_REGISTRY_MIGRATION_BATCH_RUNTIME_ID,
  ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE,
  ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE_URI,
} from './ZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatch.js';
import {
  ZAVORTH_WAVE4A_METADATA_MIGRATION_SCHEMA_VERSION,
} from './ZavorthWave4AControlledMetadataConfigRegistryMigrationPlan.js';
import type {
  ZavorthWave4AFirstBatchMigratedRecord,
  ZavorthWave4AFirstBatchMigrationBackupRollbackManifest,
  ZavorthWave4AFirstBatchMigrationManifest,
} from './ZavorthWave4AFirstControlledMetadataConfigRegistryMigrationBatch.js';
import type {
  ZavorthWave4AMigrationDataClass,
  ZavorthWave4AMigrationRedactionEnvelope,
} from './ZavorthWave4AControlledMetadataConfigRegistryMigrationPlan.js';

export const ZAVORTH_WAVE4A_MIGRATED_METADATA_BATCH_LOAD_VERIFY_PARITY_NOW = '2026-04-29T18:00:00.000Z' as const;
export const ZAVORTH_WAVE4A_MIGRATED_METADATA_BATCH_LOAD_VERIFY_PARITY_RUNTIME_ID = 'zavorth-wave4a-migrated-metadata-batch-load-verify-parity' as const;

export type ZavorthWave4AMigratedMetadataParityClassification =
  | 'corrupt'
  | 'degraded'
  | 'parity-ok'
  | 'parity-partial'
  | 'rejected';

export type ZavorthWave4AMigratedMetadataLoadValidationStatus =
  | 'backup-rollback-missing'
  | 'checksum-invalid'
  | 'idempotency-invalid'
  | 'manifest-missing'
  | 'policy-invalid'
  | 'record-missing'
  | 'redaction-invalid'
  | 'schema-invalid'
  | 'source-not-ready'
  | 'valid';

export type ZavorthWave4AMigratedMetadataRegistryView = {
  nativeContract: 'ZavorthWave4AMigratedMetadataRegistryView/v1';
  itemId: string;
  dataClass: ZavorthWave4AMigrationDataClass;
  target: string;
  viewKind:
    | 'backup-rollback'
    | 'capability'
    | 'config-state'
    | 'integration'
    | 'registry';
  label: string;
  status: 'available' | 'degraded' | 'unavailable';
  commandCenterConsumable: true;
  plannerConsumable: true;
  policyConsumable: true;
  observabilityConsumable: true;
  migratedMetadataLoadedFromZavorthStorage: true;
  runtimeExternalExecutorRequiredForMigratedMetadataLoad: false;
  runtimeExternalExecutorRequiredForMigratedMetadataRender: false;
  sourceRuntimeAuthority: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4AMigratedMetadataConsumerProjection = {
  nativeContract: 'ZavorthWave4AMigratedMetadataConsumerProjection/v1';
  consumerId:
    | 'command-center'
    | 'command-http-observability-projection'
    | 'command-http-policy-preflight'
    | 'controlled-dry-run-planner';
  consumesMigratedMetadata: true;
  registryViewIds: string[];
  runtimeExternalExecutorRequiredForRender: false;
  runtimeExternalExecutorRequiredForLookup: false;
  adapterDefaultPath: false;
  publicExternalExecutorIdentityLeak: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4AMigratedMetadataParityReceipt = {
  nativeContract: 'ZavorthWave4AMigratedMetadataParityReceipt/v1';
  runtimeId: typeof ZAVORTH_WAVE4A_MIGRATED_METADATA_BATCH_LOAD_VERIFY_PARITY_RUNTIME_ID;
  generatedAt: string;
  migrationRoot: string;
  migrationNamespace: typeof ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE;
  migrationNamespaceUri: typeof ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE_URI;
  sourceBatchRuntimeId: typeof ZAVORTH_WAVE4A_FIRST_CONTROLLED_METADATA_CONFIG_REGISTRY_MIGRATION_BATCH_RUNTIME_ID;
  classification: ZavorthWave4AMigratedMetadataParityClassification;
  validations: ZavorthWave4AMigratedMetadataLoadValidationStatus[];
  manifestRecordCount: number;
  loadedRecordCount: number;
  registryViews: ZavorthWave4AMigratedMetadataRegistryView[];
  consumerProjections: ZavorthWave4AMigratedMetadataConsumerProjection[];
  baselineComparison: {
    nativeRegistrySurfaceCount: number;
    migratedRegistryViewCount: number;
    baselineProjectionCount: number;
    commandCenterParity: ZavorthWave4AMigratedMetadataParityClassification;
    plannerPolicyObservabilityParity: ZavorthWave4AMigratedMetadataParityClassification;
  };
  wave4aMigratedBatchLoadVerifyCreated: true;
  migratedMetadataLoadedFromZavorthStorage: true;
  runtimeExternalExecutorRequiredForMigratedMetadataLoad: false;
  runtimeExternalExecutorRequiredForMigratedMetadataRender: false;
  migrationScopeMetadataConfigRegistryOnly: true;
  rawSecretMigrationAllowed: false;
  sessionHistoryRawMigrationAllowed: false;
  sqliteRealMigrationAllowed: false;
  workspaceMigrationAllowed: false;
  logsRawMigrationAllowed: false;
  cacheRawMigrationAllowed: false;
  executionStateMigrationAllowed: false;
  sourceRuntimeAuthority: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4AMigratedMetadataBatchLoadVerifySource = {
  migrationPlanReady: true;
  firstBatchMigrationReady: true;
  nativeRegistriesReady: true;
  parityBaselineReady: true;
  commandCenterNativeFirstReady: true;
  productionRestoreLoadReady: true;
  absorptionHardeningReady: true;
  externalExecutorLiveRequiredForLoad: false;
  rawSecretSerialized: false;
  executionAttempted: false;
  stateMigrationAttempted: false;
  sourceModuleCopyAttempted: false;
  adapterRemovalAttempted: false;
};

export type ZavorthWave4AMigratedMetadataBatchLoadOptions = {
  generatedAt?: string;
  migrationRoot: string;
};

export type ZavorthWave4AMigratedMetadataBatchCleanupReceipt = {
  nativeContract: 'ZavorthWave4AMigratedMetadataBatchCleanupReceipt/v1';
  migrationRoot: string;
  cleanupActuallyPerformed: boolean;
  namespaceExistsAfterCleanup: boolean;
  cleanupLimitedToControlledTestNamespace: true;
  sourceFileCopied: false;
  sourceDbCopied: false;
  rawSecretSerialized: false;
};

const VIEW_KIND_BY_DATA_CLASS: Record<ZavorthWave4AMigrationDataClass, ZavorthWave4AMigratedMetadataRegistryView['viewKind'] | undefined> = {
  'backup-rollback-metadata': 'backup-rollback',
  'cache-raw': undefined,
  'capability-metadata': 'capability',
  'config-metadata-redacted': 'config-state',
  'execution-state-mutable': undefined,
  'logs-raw': undefined,
  'message-content': undefined,
  'plugin-metadata-redacted': 'config-state',
  'provider-channel-transport-metadata': 'integration',
  'raw-secrets': undefined,
  'registry-metadata': 'registry',
  'secretref-metadata': 'config-state',
  'session-history-raw': undefined,
  'sqlite-real': undefined,
  'workspace-files': undefined,
};

function assertMigrationRoot(migrationRoot: string): string {
  const resolved = path.resolve(migrationRoot);
  const cwd = path.resolve(process.cwd());

  if (!resolved.startsWith(`${cwd}${path.sep}`)) {
    throw new Error(`Migration root must stay inside workspace: ${resolved}`);
  }
  if (!resolved.includes(`${path.sep}.tmp${path.sep}`) && !resolved.includes(`${path.sep}.zavorth${path.sep}`)) {
    throw new Error(`Migration root must live under .tmp or .zavorth: ${resolved}`);
  }
  if (path.basename(resolved) !== ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE) {
    throw new Error(`Migration root must end with ${ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE}: ${resolved}`);
  }

  return resolved;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}

function expectedChecksum(record: ZavorthWave4AFirstBatchMigratedRecord): string {
  return createHash('sha256')
    .update(stableStringify({
      dataClass: record.dataClass,
      itemId: record.itemId,
      schemaVersion: record.schemaVersion,
      sourceInventoryItem: record.sourceInventoryItem,
      target: record.target,
    }))
    .digest('hex');
}

function readJson<TValue>(filePath: string): TValue | undefined {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as TValue;
  } catch {
    return undefined;
  }
}

function redactionEnvelopeValid(envelope: ZavorthWave4AMigrationRedactionEnvelope): boolean {
  return (
    envelope.nativeContract === 'ZavorthWave4AMigrationRedactionEnvelope/v1' &&
    envelope.rawSecretSerialized === false &&
    envelope.rawMessageContentSerialized === false &&
    envelope.sourceIdentityPublic === false &&
    envelope.provenanceInternalOnly === true &&
    envelope.safeMetadataOnly === true &&
    envelope.forbiddenFields.includes('rawSecretValue') &&
    envelope.forbiddenFields.includes('rawMessageContent') &&
    envelope.forbiddenFields.includes('sqlitePayload') &&
    envelope.forbiddenFields.includes('workspaceFileBody') &&
    envelope.forbiddenFields.includes('rawLogLine') &&
    envelope.forbiddenFields.includes('rawCacheEntry')
  );
}

function sourceReady(source: ZavorthWave4AMigratedMetadataBatchLoadVerifySource): boolean {
  return (
    source.migrationPlanReady &&
    source.firstBatchMigrationReady &&
    source.nativeRegistriesReady &&
    source.parityBaselineReady &&
    source.commandCenterNativeFirstReady &&
    source.productionRestoreLoadReady &&
    source.absorptionHardeningReady &&
    !source.externalExecutorLiveRequiredForLoad &&
    !source.rawSecretSerialized &&
    !source.executionAttempted &&
    !source.stateMigrationAttempted &&
    !source.sourceModuleCopyAttempted &&
    !source.adapterRemovalAttempted
  );
}

function viewForRecord(record: ZavorthWave4AFirstBatchMigratedRecord): ZavorthWave4AMigratedMetadataRegistryView | undefined {
  const viewKind = VIEW_KIND_BY_DATA_CLASS[record.dataClass];
  if (!viewKind) {
    return undefined;
  }

  return {
    nativeContract: 'ZavorthWave4AMigratedMetadataRegistryView/v1',
    itemId: record.itemId,
    dataClass: record.dataClass,
    target: record.target,
    viewKind,
    label: `Zavorth ${viewKind} metadata: ${record.itemId}`,
    status: 'available',
    commandCenterConsumable: true,
    plannerConsumable: true,
    policyConsumable: true,
    observabilityConsumable: true,
    migratedMetadataLoadedFromZavorthStorage: true,
    runtimeExternalExecutorRequiredForMigratedMetadataLoad: false,
    runtimeExternalExecutorRequiredForMigratedMetadataRender: false,
    sourceRuntimeAuthority: false,
    rawSecretSerialized: false,
  };
}

function consumerProjections(views: ZavorthWave4AMigratedMetadataRegistryView[]): ZavorthWave4AMigratedMetadataConsumerProjection[] {
  const ids = views.map((view) => view.itemId);
  return [
    'command-center',
    'controlled-dry-run-planner',
    'command-http-policy-preflight',
    'command-http-observability-projection',
  ].map((consumerId) => ({
    nativeContract: 'ZavorthWave4AMigratedMetadataConsumerProjection/v1',
    consumerId: consumerId as ZavorthWave4AMigratedMetadataConsumerProjection['consumerId'],
    consumesMigratedMetadata: true,
    registryViewIds: ids,
    runtimeExternalExecutorRequiredForRender: false,
    runtimeExternalExecutorRequiredForLookup: false,
    adapterDefaultPath: false,
    publicExternalExecutorIdentityLeak: false,
    rawSecretSerialized: false,
  }));
}

function classify(validations: ZavorthWave4AMigratedMetadataLoadValidationStatus[], manifestCount: number, loadedCount: number): ZavorthWave4AMigratedMetadataParityClassification {
  if (validations.includes('checksum-invalid') || validations.includes('schema-invalid') || validations.includes('idempotency-invalid')) {
    return 'corrupt';
  }
  if (validations.includes('redaction-invalid') || validations.includes('policy-invalid')) {
    return 'rejected';
  }
  if (validations.includes('manifest-missing') || validations.includes('source-not-ready') || validations.includes('backup-rollback-missing')) {
    return 'degraded';
  }
  if (validations.includes('record-missing') || loadedCount < manifestCount) {
    return 'parity-partial';
  }
  return 'parity-ok';
}

export class ZavorthWave4AMigratedMetadataBatchLoadVerifyParity {
  public constructor(private readonly source: ZavorthWave4AMigratedMetadataBatchLoadVerifySource) {}

  public loadVerify(options: ZavorthWave4AMigratedMetadataBatchLoadOptions): ZavorthWave4AMigratedMetadataParityReceipt {
    const migrationRoot = assertMigrationRoot(options.migrationRoot);
    const generatedAt = options.generatedAt ?? ZAVORTH_WAVE4A_MIGRATED_METADATA_BATCH_LOAD_VERIFY_PARITY_NOW;
    const validations: ZavorthWave4AMigratedMetadataLoadValidationStatus[] = [];

    if (!sourceReady(this.source)) {
      validations.push('source-not-ready');
    }

    const manifest = readJson<ZavorthWave4AFirstBatchMigrationManifest>(path.join(migrationRoot, 'manifest.json'));
    if (
      manifest?.nativeContract !== 'ZavorthWave4AFirstBatchMigrationManifest/v1' ||
      manifest.migrationNamespace !== ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE ||
      manifest.schemaVersion !== ZAVORTH_WAVE4A_METADATA_MIGRATION_SCHEMA_VERSION ||
      manifest.rawSecretSerialized
    ) {
      validations.push(manifest ? 'schema-invalid' : 'manifest-missing');
    }

    const backupRollback = readJson<ZavorthWave4AFirstBatchMigrationBackupRollbackManifest>(
      path.join(migrationRoot, 'rollback', 'backup-rollback-manifest.json'),
    );
    if (
      backupRollback?.nativeContract !== 'ZavorthWave4AFirstBatchMigrationBackupRollbackManifest/v1' ||
      backupRollback.migrationNamespace !== ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE ||
      backupRollback.rawSecretSerialized
    ) {
      validations.push('backup-rollback-missing');
    }

    const records = (manifest?.records ?? []).map((entry) => {
      const record = readJson<ZavorthWave4AFirstBatchMigratedRecord>(path.join(migrationRoot, entry.relativePath));
      if (!record) {
        validations.push('record-missing');
        return undefined;
      }
      if (
        record.nativeContract !== 'ZavorthWave4AFirstBatchMigratedRecord/v1' ||
        record.schemaVersion !== ZAVORTH_WAVE4A_METADATA_MIGRATION_SCHEMA_VERSION ||
        record.checksum !== entry.checksum ||
        record.checksum !== expectedChecksum(record)
      ) {
        validations.push('checksum-invalid');
      }
      if (record.idempotencyKey !== entry.idempotencyKey || record.idempotencyKey !== `wave4a:${record.dataClass}:${record.itemId}`) {
        validations.push('idempotency-invalid');
      }
      if (!redactionEnvelopeValid(record.redactionEnvelope) || record.rawSecretSerialized || record.payloadSensitiveFieldsPersisted) {
        validations.push('redaction-invalid');
      }
      if (record.policyDecision !== 'allow-metadata-config-registry-only' || record.payloadKind !== 'metadata-config-registry-only') {
        validations.push('policy-invalid');
      }
      return record;
    }).filter((record): record is ZavorthWave4AFirstBatchMigratedRecord => Boolean(record));

    if (validations.length === 0) {
      validations.push('valid');
    }

    const registryViews = records
      .map(viewForRecord)
      .filter((view): view is ZavorthWave4AMigratedMetadataRegistryView => Boolean(view));
    const projections = consumerProjections(registryViews);
    const manifestRecordCount = manifest?.recordCount ?? 0;
    const classification = classify(validations, manifestRecordCount, records.length);

    return {
      nativeContract: 'ZavorthWave4AMigratedMetadataParityReceipt/v1',
      runtimeId: ZAVORTH_WAVE4A_MIGRATED_METADATA_BATCH_LOAD_VERIFY_PARITY_RUNTIME_ID,
      generatedAt,
      migrationRoot,
      migrationNamespace: ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE,
      migrationNamespaceUri: ZAVORTH_WAVE4A_METADATA_MIGRATION_NAMESPACE_URI,
      sourceBatchRuntimeId: ZAVORTH_WAVE4A_FIRST_CONTROLLED_METADATA_CONFIG_REGISTRY_MIGRATION_BATCH_RUNTIME_ID,
      classification,
      validations: Array.from(new Set(validations)),
      manifestRecordCount,
      loadedRecordCount: records.length,
      registryViews,
      consumerProjections: projections,
      baselineComparison: {
        nativeRegistrySurfaceCount: 7,
        migratedRegistryViewCount: registryViews.length,
        baselineProjectionCount: 4,
        commandCenterParity: classification === 'parity-ok' ? 'parity-ok' : classification,
        plannerPolicyObservabilityParity: classification === 'parity-ok' ? 'parity-ok' : classification,
      },
      wave4aMigratedBatchLoadVerifyCreated: true,
      migratedMetadataLoadedFromZavorthStorage: true,
      runtimeExternalExecutorRequiredForMigratedMetadataLoad: false,
      runtimeExternalExecutorRequiredForMigratedMetadataRender: false,
      migrationScopeMetadataConfigRegistryOnly: true,
      rawSecretMigrationAllowed: false,
      sessionHistoryRawMigrationAllowed: false,
      sqliteRealMigrationAllowed: false,
      workspaceMigrationAllowed: false,
      logsRawMigrationAllowed: false,
      cacheRawMigrationAllowed: false,
      executionStateMigrationAllowed: false,
      sourceRuntimeAuthority: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      sourceModuleCopied: false,
      adapterRemovalGlobalAllowed: false,
      rawSecretSerialized: false,
    };
  }

  public cleanup(migrationRoot: string): ZavorthWave4AMigratedMetadataBatchCleanupReceipt {
    const resolved = assertMigrationRoot(migrationRoot);
    if (!resolved.includes(`${path.sep}.tmp${path.sep}`)) {
      throw new Error(`Wave 4A migrated metadata cleanup is only allowed for controlled test namespace: ${resolved}`);
    }

    const existedBefore = fs.existsSync(resolved);
    if (existedBefore) {
      fs.rmSync(resolved, { recursive: true, force: true });
    }

    return {
      nativeContract: 'ZavorthWave4AMigratedMetadataBatchCleanupReceipt/v1',
      migrationRoot: resolved,
      cleanupActuallyPerformed: existedBefore,
      namespaceExistsAfterCleanup: fs.existsSync(resolved),
      cleanupLimitedToControlledTestNamespace: true,
      sourceFileCopied: false,
      sourceDbCopied: false,
      rawSecretSerialized: false,
    };
  }
}

export function createZavorthWave4AMigratedMetadataBatchLoadVerifyParityFixtureSource(
  overrides: Partial<ZavorthWave4AMigratedMetadataBatchLoadVerifySource> = {},
): ZavorthWave4AMigratedMetadataBatchLoadVerifySource {
  return {
    migrationPlanReady: true,
    firstBatchMigrationReady: true,
    nativeRegistriesReady: true,
    parityBaselineReady: true,
    commandCenterNativeFirstReady: true,
    productionRestoreLoadReady: true,
    absorptionHardeningReady: true,
    externalExecutorLiveRequiredForLoad: false,
    rawSecretSerialized: false,
    executionAttempted: false,
    stateMigrationAttempted: false,
    sourceModuleCopyAttempted: false,
    adapterRemovalAttempted: false,
    ...overrides,
  };
}

export function createZavorthWave4AMigratedMetadataBatchLoadVerifyParityFixture(
  source: ZavorthWave4AMigratedMetadataBatchLoadVerifySource = createZavorthWave4AMigratedMetadataBatchLoadVerifyParityFixtureSource(),
): ZavorthWave4AMigratedMetadataBatchLoadVerifyParity {
  return new ZavorthWave4AMigratedMetadataBatchLoadVerifyParity(source);
}
