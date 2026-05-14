import { createHash } from 'node:crypto';

export const ZAVORTH_WAVE4A_CONTROLLED_METADATA_CONFIG_REGISTRY_MIGRATION_PLAN_NOW = '2026-04-29T16:00:00.000Z' as const;
export const ZAVORTH_WAVE4A_CONTROLLED_METADATA_CONFIG_REGISTRY_MIGRATION_PLAN_RUNTIME_ID = 'zavorth-wave4a-controlled-metadata-config-registry-migration-plan' as const;
export const ZAVORTH_WAVE4A_METADATA_MIGRATION_SCHEMA_VERSION = 'zavorth-wave4a-metadata-config-registry-migration/v1' as const;

export type ZavorthWave4AControlledMigrationDecision =
  | 'blocked'
  | 'wave4a-controlled-migration-plan-ready';

export type ZavorthWave4AMigrationDataClass =
  | 'backup-rollback-metadata'
  | 'cache-raw'
  | 'capability-metadata'
  | 'config-metadata-redacted'
  | 'execution-state-mutable'
  | 'logs-raw'
  | 'message-content'
  | 'plugin-metadata-redacted'
  | 'provider-channel-transport-metadata'
  | 'raw-secrets'
  | 'registry-metadata'
  | 'secretref-metadata'
  | 'session-history-raw'
  | 'sqlite-real'
  | 'workspace-files';

export type ZavorthWave4AMigrationEligibility =
  | 'blocked'
  | 'eligible-controlled-batch'
  | 'policy-blocked';

export type ZavorthWave4AMigrationPolicyDecision =
  | 'allow-metadata-config-registry-only'
  | 'block-sensitive-item';

export type ZavorthWave4AMigrationTarget =
  | 'zavorth-native-capability-registry'
  | 'zavorth-native-config-state-registry'
  | 'zavorth-native-integration-registry'
  | 'zavorth-native-registry-production-store'
  | 'blocked-no-target';

export type ZavorthWave4AMigrationRedactionEnvelope = {
  nativeContract: 'ZavorthWave4AMigrationRedactionEnvelope/v1';
  rawSecretSerialized: false;
  rawMessageContentSerialized: false;
  sourceIdentityPublic: false;
  provenanceInternalOnly: true;
  safeMetadataOnly: true;
  forbiddenFields: string[];
};

export type ZavorthWave4AMigrationBackupRollback = {
  nativeContract: 'ZavorthWave4AMigrationBackupRollback/v1';
  backupManifestRequired: true;
  restoreManifestRequired: true;
  rollbackReceiptRequired: true;
  checksumRequiredBeforeCommit: true;
  rollbackRequiredBeforeMutation: true;
  backupActuallyCreated: false;
  restoreActuallyPerformed: false;
};

export type ZavorthWave4AMigrationPlanItem = {
  nativeContract: 'ZavorthWave4AMigrationPlanItem/v1';
  itemId: string;
  sourceInventoryItem: string;
  dataClass: ZavorthWave4AMigrationDataClass;
  target: ZavorthWave4AMigrationTarget;
  schemaVersion: typeof ZAVORTH_WAVE4A_METADATA_MIGRATION_SCHEMA_VERSION;
  idempotencyKey: string;
  redactionEnvelope: ZavorthWave4AMigrationRedactionEnvelope;
  checksumAlgorithm: 'sha256-stable-metadata';
  checksum: string;
  backupRollback: ZavorthWave4AMigrationBackupRollback;
  eligibility: ZavorthWave4AMigrationEligibility;
  policyDecision: ZavorthWave4AMigrationPolicyDecision;
  firstBatchIncluded: boolean;
  sourceRuntimeEvidenceOnly: true;
  runtimeExternalExecutorRequiredForDefaultLookup: false;
  migrationActuallyExecuted: false;
  persistentWriteActuallyPerformed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4ABlockedDataClassRow = {
  nativeContract: 'ZavorthWave4ABlockedDataClassRow/v1';
  dataClass: ZavorthWave4AMigrationDataClass;
  reason: string;
  blocked: true;
  target: 'blocked-no-target';
  migrationAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4AControlledMigrationBatch = {
  nativeContract: 'ZavorthWave4AControlledMigrationBatch/v1';
  batchId: 'wave4a-metadata-config-registry-batch-001';
  prepared: true;
  executed: false;
  itemIds: string[];
  itemCount: number;
  requiresFeatureFlagForExecution: true;
  requiresPolicyRecheckBeforeExecution: true;
  requiresRollbackManifestBeforeExecution: true;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4AControlledMigrationExecutionGate = {
  wave4aControlledMigrationPlanCreated: true;
  migrationScopeMetadataConfigRegistryOnly: true;
  rawSecretMigrationAllowed: false;
  sessionHistoryRawMigrationAllowed: false;
  sqliteRealMigrationAllowed: false;
  workspaceMigrationAllowed: false;
  logsRawMigrationAllowed: false;
  executionStateMigrationAllowed: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4AControlledMigrationSource = {
  configStateMigrationStrategy: 'design-only-no-migration';
  readOnlyInventory: 'read-only-inventory-no-migration';
  redactionSecretRefMapping: 'redaction-secretref-mapping-no-migration';
  dryRunMigrationPlan: 'dry-run-plan-no-migration';
  rollbackRestoreRehearsal: 'rollback-restore-rehearsal-no-mutation';
  nativeRegistriesReady: true;
  productionPersistenceRestoreReady: true;
  nativeAbsorptionHardeningReady: true;
  externalExecutorRuntimeRequiredForMigrationPlan: false;
  rawSecretMigrationAttempted: false;
  sessionHistoryRawMigrationAttempted: false;
  sqliteRealMigrationAttempted: false;
  workspaceMigrationAttempted: false;
  logsRawMigrationAttempted: false;
  cacheRawMigrationAttempted: false;
  executionStateMigrationAttempted: false;
  messageSendAttempted: false;
  providerExecutionAttempted: false;
  commandExecutionAttempted: false;
  toolExecutionAttempted: false;
  sourceModuleCopyAttempted: false;
  adapterRemovalAttempted: false;
  publicExternalExecutorIdentityExposed: false;
  rawSecretSerialized: false;
  policyBlockedDataClasses: ZavorthWave4AMigrationDataClass[];
};

export type ZavorthWave4AControlledMigrationNormalization = {
  nativeContract: 'ZavorthWave4AControlledMetadataConfigRegistryMigrationPlan/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthWave4AControlledMigrationDecision;
  status: 'blocked' | 'wave4a-controlled-migration-plan-ready';
  sourceReadiness: Omit<ZavorthWave4AControlledMigrationSource, 'policyBlockedDataClasses'>;
  planItems: ZavorthWave4AMigrationPlanItem[];
  blockedDataClasses: ZavorthWave4ABlockedDataClassRow[];
  firstBatch: ZavorthWave4AControlledMigrationBatch;
  executionGate: ZavorthWave4AControlledMigrationExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    sourceIdentityPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: '210-wave-4a-controlled-metadata-config-registry-migration-execution';
};

export type ZavorthWave4AControlledMigrationOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  runtimeId: TRuntimeId;
  source: ZavorthWave4AControlledMigrationSource;
};

type EligibleInput = {
  itemId: string;
  sourceInventoryItem: string;
  dataClass: ZavorthWave4AMigrationDataClass;
  target: ZavorthWave4AMigrationTarget;
};

const ELIGIBLE_ITEMS: EligibleInput[] = [
  {
    itemId: 'registry-metadata',
    sourceInventoryItem: '163: native registry metadata inventory rows',
    dataClass: 'registry-metadata',
    target: 'zavorth-native-registry-production-store',
  },
  {
    itemId: 'capability-metadata',
    sourceInventoryItem: '185: native capability registry metadata',
    dataClass: 'capability-metadata',
    target: 'zavorth-native-capability-registry',
  },
  {
    itemId: 'provider-channel-transport-metadata',
    sourceInventoryItem: '187: provider/channel/transport metadata registry rows',
    dataClass: 'provider-channel-transport-metadata',
    target: 'zavorth-native-integration-registry',
  },
  {
    itemId: 'secretref-metadata',
    sourceInventoryItem: '164: canonical SecretRef mapping without values',
    dataClass: 'secretref-metadata',
    target: 'zavorth-native-config-state-registry',
  },
  {
    itemId: 'config-metadata-redacted',
    sourceInventoryItem: '189: redacted config/state metadata records',
    dataClass: 'config-metadata-redacted',
    target: 'zavorth-native-config-state-registry',
  },
  {
    itemId: 'plugin-metadata-redacted',
    sourceInventoryItem: '185/189: redacted plugin metadata records',
    dataClass: 'plugin-metadata-redacted',
    target: 'zavorth-native-config-state-registry',
  },
  {
    itemId: 'backup-rollback-metadata',
    sourceInventoryItem: '166/194/198/199: backup and rollback metadata',
    dataClass: 'backup-rollback-metadata',
    target: 'zavorth-native-registry-production-store',
  },
];

const BLOCKED_CLASSES: Array<Pick<ZavorthWave4ABlockedDataClassRow, 'dataClass' | 'reason'>> = [
  { dataClass: 'raw-secrets', reason: 'raw secret migration is never allowed; SecretRef metadata only' },
  { dataClass: 'message-content', reason: 'message content remains outside Wave 4A metadata scope' },
  { dataClass: 'sqlite-real', reason: 'real SQLite import requires a later dedicated gate' },
  { dataClass: 'session-history-raw', reason: 'raw history import remains blocked' },
  { dataClass: 'workspace-files', reason: 'workspace file migration is outside registry metadata scope' },
  { dataClass: 'logs-raw', reason: 'raw logs require separate redaction/import gates' },
  { dataClass: 'cache-raw', reason: 'raw cache migration is outside Wave 4A scope' },
  { dataClass: 'execution-state-mutable', reason: 'mutable execution state migration is blocked' },
];

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

function checksumFor(input: EligibleInput): string {
  return createHash('sha256')
    .update(stableStringify({
      dataClass: input.dataClass,
      itemId: input.itemId,
      schemaVersion: ZAVORTH_WAVE4A_METADATA_MIGRATION_SCHEMA_VERSION,
      sourceInventoryItem: input.sourceInventoryItem,
      target: input.target,
    }))
    .digest('hex');
}

function redactionEnvelope(): ZavorthWave4AMigrationRedactionEnvelope {
  return {
    nativeContract: 'ZavorthWave4AMigrationRedactionEnvelope/v1',
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
      'mutableExecutionState',
    ],
  };
}

function backupRollback(): ZavorthWave4AMigrationBackupRollback {
  return {
    nativeContract: 'ZavorthWave4AMigrationBackupRollback/v1',
    backupManifestRequired: true,
    restoreManifestRequired: true,
    rollbackReceiptRequired: true,
    checksumRequiredBeforeCommit: true,
    rollbackRequiredBeforeMutation: true,
    backupActuallyCreated: false,
    restoreActuallyPerformed: false,
  };
}

function planItem(input: EligibleInput, policyBlockedDataClasses: ZavorthWave4AMigrationDataClass[]): ZavorthWave4AMigrationPlanItem {
  const policyBlocked = policyBlockedDataClasses.includes(input.dataClass);
  return {
    nativeContract: 'ZavorthWave4AMigrationPlanItem/v1',
    itemId: input.itemId,
    sourceInventoryItem: input.sourceInventoryItem,
    dataClass: input.dataClass,
    target: input.target,
    schemaVersion: ZAVORTH_WAVE4A_METADATA_MIGRATION_SCHEMA_VERSION,
    idempotencyKey: `wave4a:${input.dataClass}:${input.itemId}`,
    redactionEnvelope: redactionEnvelope(),
    checksumAlgorithm: 'sha256-stable-metadata',
    checksum: checksumFor(input),
    backupRollback: backupRollback(),
    eligibility: policyBlocked ? 'policy-blocked' : 'eligible-controlled-batch',
    policyDecision: policyBlocked ? 'block-sensitive-item' : 'allow-metadata-config-registry-only',
    firstBatchIncluded: !policyBlocked,
    sourceRuntimeEvidenceOnly: true,
    runtimeExternalExecutorRequiredForDefaultLookup: false,
    migrationActuallyExecuted: false,
    persistentWriteActuallyPerformed: false,
    rawSecretSerialized: false,
  };
}

function blockedDataClasses(): ZavorthWave4ABlockedDataClassRow[] {
  return BLOCKED_CLASSES.map((row) => ({
    nativeContract: 'ZavorthWave4ABlockedDataClassRow/v1',
    dataClass: row.dataClass,
    reason: row.reason,
    blocked: true,
    target: 'blocked-no-target',
    migrationAllowed: false,
    rawSecretSerialized: false,
  }));
}

function firstBatch(items: ZavorthWave4AMigrationPlanItem[]): ZavorthWave4AControlledMigrationBatch {
  const itemIds = items
    .filter((item) => item.firstBatchIncluded)
    .map((item) => item.itemId);

  return {
    nativeContract: 'ZavorthWave4AControlledMigrationBatch/v1',
    batchId: 'wave4a-metadata-config-registry-batch-001',
    prepared: true,
    executed: false,
    itemIds,
    itemCount: itemIds.length,
    requiresFeatureFlagForExecution: true,
    requiresPolicyRecheckBeforeExecution: true,
    requiresRollbackManifestBeforeExecution: true,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthWave4AControlledMigrationExecutionGate {
  return {
    wave4aControlledMigrationPlanCreated: true,
    migrationScopeMetadataConfigRegistryOnly: true,
    rawSecretMigrationAllowed: false,
    sessionHistoryRawMigrationAllowed: false,
    sqliteRealMigrationAllowed: false,
    workspaceMigrationAllowed: false,
    logsRawMigrationAllowed: false,
    executionStateMigrationAllowed: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    sourceModuleCopied: false,
    adapterRemovalGlobalAllowed: false,
    rawSecretSerialized: false,
  };
}

function sourceReady(source: ZavorthWave4AControlledMigrationSource): boolean {
  return (
    source.configStateMigrationStrategy === 'design-only-no-migration' &&
    source.readOnlyInventory === 'read-only-inventory-no-migration' &&
    source.redactionSecretRefMapping === 'redaction-secretref-mapping-no-migration' &&
    source.dryRunMigrationPlan === 'dry-run-plan-no-migration' &&
    source.rollbackRestoreRehearsal === 'rollback-restore-rehearsal-no-mutation' &&
    source.nativeRegistriesReady &&
    source.productionPersistenceRestoreReady &&
    source.nativeAbsorptionHardeningReady &&
    !source.externalExecutorRuntimeRequiredForMigrationPlan &&
    !source.rawSecretMigrationAttempted &&
    !source.sessionHistoryRawMigrationAttempted &&
    !source.sqliteRealMigrationAttempted &&
    !source.workspaceMigrationAttempted &&
    !source.logsRawMigrationAttempted &&
    !source.cacheRawMigrationAttempted &&
    !source.executionStateMigrationAttempted &&
    !source.messageSendAttempted &&
    !source.providerExecutionAttempted &&
    !source.commandExecutionAttempted &&
    !source.toolExecutionAttempted &&
    !source.sourceModuleCopyAttempted &&
    !source.adapterRemovalAttempted &&
    !source.publicExternalExecutorIdentityExposed &&
    !source.rawSecretSerialized
  );
}

export class ZavorthWave4AControlledMetadataConfigRegistryMigrationPlan {
  private readonly itemsById: Map<string, ZavorthWave4AMigrationPlanItem>;

  public constructor(public readonly normalization: ZavorthWave4AControlledMigrationNormalization) {
    this.itemsById = new Map(normalization.planItems.map((item) => [item.itemId, item]));
  }

  public lookupItem(itemId: string): ZavorthWave4AMigrationPlanItem | undefined {
    return this.itemsById.get(itemId);
  }

  public migratableItems(): ZavorthWave4AMigrationPlanItem[] {
    return this.normalization.planItems.filter((item) => item.eligibility === 'eligible-controlled-batch');
  }

  public policyBlockedItems(): ZavorthWave4AMigrationPlanItem[] {
    return this.normalization.planItems.filter((item) => item.eligibility === 'policy-blocked');
  }
}

export function createZavorthWave4AControlledMetadataConfigRegistryMigrationFixtureSource(
  overrides: Partial<ZavorthWave4AControlledMigrationSource> = {},
): ZavorthWave4AControlledMigrationSource {
  return {
    configStateMigrationStrategy: 'design-only-no-migration',
    readOnlyInventory: 'read-only-inventory-no-migration',
    redactionSecretRefMapping: 'redaction-secretref-mapping-no-migration',
    dryRunMigrationPlan: 'dry-run-plan-no-migration',
    rollbackRestoreRehearsal: 'rollback-restore-rehearsal-no-mutation',
    nativeRegistriesReady: true,
    productionPersistenceRestoreReady: true,
    nativeAbsorptionHardeningReady: true,
    externalExecutorRuntimeRequiredForMigrationPlan: false,
    rawSecretMigrationAttempted: false,
    sessionHistoryRawMigrationAttempted: false,
    sqliteRealMigrationAttempted: false,
    workspaceMigrationAttempted: false,
    logsRawMigrationAttempted: false,
    cacheRawMigrationAttempted: false,
    executionStateMigrationAttempted: false,
    messageSendAttempted: false,
    providerExecutionAttempted: false,
    commandExecutionAttempted: false,
    toolExecutionAttempted: false,
    sourceModuleCopyAttempted: false,
    adapterRemovalAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    rawSecretSerialized: false,
    policyBlockedDataClasses: [],
    ...overrides,
  };
}

export function normalizeZavorthWave4AControlledMetadataConfigRegistryMigrationPlan<TRuntimeId extends string>(
  options: ZavorthWave4AControlledMigrationOptions<TRuntimeId>,
): ZavorthWave4AControlledMigrationNormalization {
  const planItems = ELIGIBLE_ITEMS.map((item) => planItem(item, options.source.policyBlockedDataClasses));
  const blocked = blockedDataClasses();
  const batch = firstBatch(planItems);
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    planItems.length === ELIGIBLE_ITEMS.length &&
    batch.itemCount > 0 &&
    planItems.every((item) => (
      item.target !== 'blocked-no-target' &&
      item.schemaVersion === ZAVORTH_WAVE4A_METADATA_MIGRATION_SCHEMA_VERSION &&
      item.idempotencyKey.length > 0 &&
      item.checksum.length === 64 &&
      !item.redactionEnvelope.rawSecretSerialized &&
      !item.migrationActuallyExecuted &&
      !item.persistentWriteActuallyPerformed
    )) &&
    blocked.length === BLOCKED_CLASSES.length &&
    blocked.every((row) => row.blocked && !row.migrationAllowed && !row.rawSecretSerialized);

  const {
    policyBlockedDataClasses: _policyBlockedDataClasses,
    ...sourceReadiness
  } = options.source;

  return {
    nativeContract: 'ZavorthWave4AControlledMetadataConfigRegistryMigrationPlan/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'wave4a-controlled-migration-plan-ready' : 'blocked',
    status: ready ? 'wave4a-controlled-migration-plan-ready' : 'blocked',
    sourceReadiness,
    planItems,
    blockedDataClasses: blocked,
    firstBatch: batch,
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: '210-wave-4a-controlled-metadata-config-registry-migration-execution',
  };
}

export function normalizeZavorthWave4AControlledMetadataConfigRegistryMigrationPlanFixture(
  overrides: Partial<ZavorthWave4AControlledMigrationSource> = {},
): ZavorthWave4AControlledMigrationNormalization {
  return normalizeZavorthWave4AControlledMetadataConfigRegistryMigrationPlan({
    generatedAt: ZAVORTH_WAVE4A_CONTROLLED_METADATA_CONFIG_REGISTRY_MIGRATION_PLAN_NOW,
    runtimeId: ZAVORTH_WAVE4A_CONTROLLED_METADATA_CONFIG_REGISTRY_MIGRATION_PLAN_RUNTIME_ID,
    source: createZavorthWave4AControlledMetadataConfigRegistryMigrationFixtureSource(overrides),
  });
}

export function createZavorthWave4AControlledMetadataConfigRegistryMigrationPlanFixture(
  overrides: Partial<ZavorthWave4AControlledMigrationSource> = {},
): ZavorthWave4AControlledMetadataConfigRegistryMigrationPlan {
  return new ZavorthWave4AControlledMetadataConfigRegistryMigrationPlan(
    normalizeZavorthWave4AControlledMetadataConfigRegistryMigrationPlanFixture(overrides),
  );
}
