export const ZAVORTH_WAVE4A_CONTROLLED_METADATA_MIGRATION_MILESTONE_REPORT_NOW = '2026-04-29T19:00:00.000Z' as const;
export const ZAVORTH_WAVE4A_CONTROLLED_METADATA_MIGRATION_MILESTONE_REPORT_RUNTIME_ID = 'zavorth-wave4a-controlled-metadata-migration-milestone-report' as const;

export type ZavorthWave4AMetadataMigrationMilestoneDecision =
  | 'blocked'
  | 'wave4a-controlled-metadata-migration-milestone-recorded';

export type ZavorthWave4AMilestoneSurfaceClassification =
  | 'blocked'
  | 'future-wave'
  | 'migrated-native'
  | 'migrated-native-partial'
  | 'native-existing-no-migration-needed';

export type ZavorthWave4AMilestoneDataClass =
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

export type ZavorthWave4AMilestoneMigratedItem = {
  nativeContract: 'ZavorthWave4AMilestoneMigratedItem/v1';
  dataClass: ZavorthWave4AMilestoneDataClass;
  label: string;
  classification: Extract<ZavorthWave4AMilestoneSurfaceClassification, 'migrated-native' | 'migrated-native-partial'>;
  evidenceGates: ['209', '210', '211'];
  batchPrepared: true;
  batchExecutedUnderFlag: true;
  loadVerifyParity: 'parity-ok';
  rollbackCleanupVerified: true;
  redactionScanPassed: true;
  consumedBy: [
    'command-center',
    'controlled-dry-run-planner',
    'command-http-policy-preflight',
    'command-http-observability-projection',
  ];
  runtimeExternalExecutorRequiredForConsumption: false;
  sourceRuntimeAuthority: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4AMilestoneBlockedItem = {
  nativeContract: 'ZavorthWave4AMilestoneBlockedItem/v1';
  dataClass: ZavorthWave4AMilestoneDataClass;
  label: string;
  classification: 'blocked';
  reason: string;
  evidenceGates: ['162', '163', '164', '165', '166', '209', '210', '211'];
  migrationAllowed: false;
  futureWaveRequired: true;
  rawSecretSerialized: false;
};

export type ZavorthWave4AMilestoneExistingNativeSurface = {
  nativeContract: 'ZavorthWave4AMilestoneExistingNativeSurface/v1';
  surfaceId:
    | 'dashboard-command-center-view-models'
    | 'native-registry-lookup-render'
    | 'partial-adapter-decommission'
    | 'public-product-hardening'
    | 'refresh-reconciliation-policy';
  label: string;
  classification: 'native-existing-no-migration-needed';
  evidenceGates: string[];
  runtimeExternalExecutorRequiredForDefaultPath: false;
  adapterDefaultPath: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4AMilestoneEvidence = {
  nativeContract: 'ZavorthWave4AMilestoneEvidence/v1';
  batchPreparedBy209: true;
  batchExecutedUnderFlagBy210: true;
  loadVerifyParityBy211: true;
  commandCenterPlannerPolicyObservabilityConsumptionProven: true;
  rollbackCleanupVerified: true;
  redactionScanPassed: true;
  externalExecutorLiveRequiredForMilestone: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4AMilestoneNextRecommendation = {
  nativeContract: 'ZavorthWave4AMilestoneNextRecommendation/v1';
  primaryRecommendation: 'wave-4b-low-risk-executable-capabilities';
  fallbackRecommendation: 'additional-metadata-batch-only-if-concrete-gap-found';
  rationale: string;
  prerequisites: string[];
  stillBlocked: string[];
  adapterRemovalGlobalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4AMilestoneExecutionGate = {
  wave4aMilestoneReportCreated: true;
  metadataConfigRegistryMigrationMilestoneRecorded: true;
  migratedSurfacesExplicit: true;
  blockedSurfacesExplicit: true;
  nextWaveRecommendationCreated: true;
  rawSecretMigrationAllowed: false;
  sessionHistoryRawMigrationAllowed: false;
  sqliteRealMigrationAllowed: false;
  workspaceMigrationAllowed: false;
  logsRawMigrationAllowed: false;
  cacheRawMigrationAllowed: false;
  executionStateMigrationAllowed: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4AMilestoneSource = {
  migrationPlanReady: true;
  firstBatchMigrationReady: true;
  loadVerifyParityReady: true;
  nativeRegistriesReady: true;
  wave3AbsorptionHardeningReady: true;
  configStateMigrationStrategyReady: true;
  rollbackRestoreRehearsalReady: true;
  commandCenterConsumptionReady: true;
  plannerPolicyObservabilityConsumptionReady: true;
  externalExecutorLiveRequiredForMilestone: false;
  newMigrationAttempted: false;
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
};

export type ZavorthWave4AMetadataMigrationMilestoneReportNormalization = {
  nativeContract: 'ZavorthWave4AControlledMetadataMigrationMilestoneReport/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthWave4AMetadataMigrationMilestoneDecision;
  status: 'blocked' | 'wave4a-controlled-metadata-migration-milestone-recorded';
  sourceReadiness: ZavorthWave4AMilestoneSource;
  migratedItems: ZavorthWave4AMilestoneMigratedItem[];
  blockedItems: ZavorthWave4AMilestoneBlockedItem[];
  existingNativeSurfaces: ZavorthWave4AMilestoneExistingNativeSurface[];
  evidence: ZavorthWave4AMilestoneEvidence;
  nextRecommendation: ZavorthWave4AMilestoneNextRecommendation;
  executionGate: ZavorthWave4AMilestoneExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    sourceIdentityPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'wave-4b-low-risk-executable-capabilities-or-targeted-metadata-gap-batch';
};

export type ZavorthWave4AMetadataMigrationMilestoneReportOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  runtimeId: TRuntimeId;
  source: ZavorthWave4AMilestoneSource;
};

function migratedItems(): ZavorthWave4AMilestoneMigratedItem[] {
  const items: Array<Pick<ZavorthWave4AMilestoneMigratedItem, 'dataClass' | 'label' | 'classification'>> = [
    { dataClass: 'registry-metadata', label: 'Registry metadata', classification: 'migrated-native' },
    { dataClass: 'capability-metadata', label: 'Capability metadata', classification: 'migrated-native' },
    { dataClass: 'provider-channel-transport-metadata', label: 'Provider/channel/transport metadata', classification: 'migrated-native' },
    { dataClass: 'secretref-metadata', label: 'SecretRef metadata without values', classification: 'migrated-native' },
    { dataClass: 'config-metadata-redacted', label: 'Redacted config metadata', classification: 'migrated-native' },
    { dataClass: 'plugin-metadata-redacted', label: 'Redacted plugin metadata', classification: 'migrated-native' },
    { dataClass: 'backup-rollback-metadata', label: 'Backup/rollback metadata', classification: 'migrated-native' },
  ];

  return items.map((item) => ({
    nativeContract: 'ZavorthWave4AMilestoneMigratedItem/v1',
    ...item,
    evidenceGates: ['209', '210', '211'],
    batchPrepared: true,
    batchExecutedUnderFlag: true,
    loadVerifyParity: 'parity-ok',
    rollbackCleanupVerified: true,
    redactionScanPassed: true,
    consumedBy: [
      'command-center',
      'controlled-dry-run-planner',
      'command-http-policy-preflight',
      'command-http-observability-projection',
    ],
    runtimeExternalExecutorRequiredForConsumption: false,
    sourceRuntimeAuthority: false,
    rawSecretSerialized: false,
  }));
}

function blockedItems(): ZavorthWave4AMilestoneBlockedItem[] {
  const rows: Array<Pick<ZavorthWave4AMilestoneBlockedItem, 'dataClass' | 'label' | 'reason'>> = [
    { dataClass: 'raw-secrets', label: 'Raw secrets', reason: 'SecretRef metadata only; raw value migration remains forbidden' },
    { dataClass: 'message-content', label: 'Message content', reason: 'Message content requires separate privacy/redaction and approval gates' },
    { dataClass: 'sqlite-real', label: 'Real SQLite stores', reason: 'Real database import requires a dedicated future dry-run and restore gate' },
    { dataClass: 'session-history-raw', label: 'Raw session history', reason: 'Raw history remains blocked outside metadata-only Wave 4A scope' },
    { dataClass: 'workspace-files', label: 'Workspace files', reason: 'Workspace copy/import is outside registry metadata scope' },
    { dataClass: 'logs-raw', label: 'Raw logs', reason: 'Raw logs require separate redaction and retention policy' },
    { dataClass: 'cache-raw', label: 'Raw cache', reason: 'Raw cache is not canonical registry metadata' },
    { dataClass: 'execution-state-mutable', label: 'Mutable execution state', reason: 'Mutable execution state migration remains blocked' },
  ];

  return rows.map((row) => ({
    nativeContract: 'ZavorthWave4AMilestoneBlockedItem/v1',
    ...row,
    classification: 'blocked',
    evidenceGates: ['162', '163', '164', '165', '166', '209', '210', '211'],
    migrationAllowed: false,
    futureWaveRequired: true,
    rawSecretSerialized: false,
  }));
}

function existingNativeSurfaces(): ZavorthWave4AMilestoneExistingNativeSurface[] {
  return [
    {
      nativeContract: 'ZavorthWave4AMilestoneExistingNativeSurface/v1',
      surfaceId: 'dashboard-command-center-view-models',
      label: 'Dashboard and Command Center view models',
      classification: 'native-existing-no-migration-needed',
      evidenceGates: ['186', '192', '199', '201', '208'],
      runtimeExternalExecutorRequiredForDefaultPath: false,
      adapterDefaultPath: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthWave4AMilestoneExistingNativeSurface/v1',
      surfaceId: 'native-registry-lookup-render',
      label: 'Native registry lookup/render',
      classification: 'native-existing-no-migration-needed',
      evidenceGates: ['185', '187', '188', '189', '190', '199', '208'],
      runtimeExternalExecutorRequiredForDefaultPath: false,
      adapterDefaultPath: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthWave4AMilestoneExistingNativeSurface/v1',
      surfaceId: 'partial-adapter-decommission',
      label: 'Partial adapter decommission default path',
      classification: 'native-existing-no-migration-needed',
      evidenceGates: ['203', '206', '207', '208'],
      runtimeExternalExecutorRequiredForDefaultPath: false,
      adapterDefaultPath: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthWave4AMilestoneExistingNativeSurface/v1',
      surfaceId: 'public-product-hardening',
      label: 'Public product hardening',
      classification: 'native-existing-no-migration-needed',
      evidenceGates: ['204', '208'],
      runtimeExternalExecutorRequiredForDefaultPath: false,
      adapterDefaultPath: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthWave4AMilestoneExistingNativeSurface/v1',
      surfaceId: 'refresh-reconciliation-policy',
      label: 'Refresh/reconciliation policy',
      classification: 'native-existing-no-migration-needed',
      evidenceGates: ['193', '202', '208'],
      runtimeExternalExecutorRequiredForDefaultPath: false,
      adapterDefaultPath: false,
      rawSecretSerialized: false,
    },
  ];
}

function evidence(): ZavorthWave4AMilestoneEvidence {
  return {
    nativeContract: 'ZavorthWave4AMilestoneEvidence/v1',
    batchPreparedBy209: true,
    batchExecutedUnderFlagBy210: true,
    loadVerifyParityBy211: true,
    commandCenterPlannerPolicyObservabilityConsumptionProven: true,
    rollbackCleanupVerified: true,
    redactionScanPassed: true,
    externalExecutorLiveRequiredForMilestone: false,
    rawSecretSerialized: false,
  };
}

function nextRecommendation(): ZavorthWave4AMilestoneNextRecommendation {
  return {
    nativeContract: 'ZavorthWave4AMilestoneNextRecommendation/v1',
    primaryRecommendation: 'wave-4b-low-risk-executable-capabilities',
    fallbackRecommendation: 'additional-metadata-batch-only-if-concrete-gap-found',
    rationale: 'Wave 4A proved metadata/config/registry migration, load, parity, and consumption without ExternalExecutor live; the next useful risk boundary is low-risk executable capability governance, unless a concrete metadata gap appears.',
    prerequisites: [
      'keep native registry lookup/render independent from ExternalExecutor live',
      'keep migrated metadata rollback receipts available',
      'require approval/policy preflight before any executable capability',
      'keep raw state/session/secret imports blocked',
    ],
    stillBlocked: [
      'raw secrets',
      'message content',
      'real SQLite',
      'raw session history',
      'workspace/log/cache raw data',
      'mutable execution state',
      'global adapter removal',
    ],
    adapterRemovalGlobalAllowed: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthWave4AMilestoneExecutionGate {
  return {
    wave4aMilestoneReportCreated: true,
    metadataConfigRegistryMigrationMilestoneRecorded: true,
    migratedSurfacesExplicit: true,
    blockedSurfacesExplicit: true,
    nextWaveRecommendationCreated: true,
    rawSecretMigrationAllowed: false,
    sessionHistoryRawMigrationAllowed: false,
    sqliteRealMigrationAllowed: false,
    workspaceMigrationAllowed: false,
    logsRawMigrationAllowed: false,
    cacheRawMigrationAllowed: false,
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

function sourceReady(source: ZavorthWave4AMilestoneSource): boolean {
  return (
    source.migrationPlanReady &&
    source.firstBatchMigrationReady &&
    source.loadVerifyParityReady &&
    source.nativeRegistriesReady &&
    source.wave3AbsorptionHardeningReady &&
    source.configStateMigrationStrategyReady &&
    source.rollbackRestoreRehearsalReady &&
    source.commandCenterConsumptionReady &&
    source.plannerPolicyObservabilityConsumptionReady &&
    !source.externalExecutorLiveRequiredForMilestone &&
    !source.newMigrationAttempted &&
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

export class ZavorthWave4AControlledMetadataMigrationMilestoneReport {
  public constructor(public readonly normalization: ZavorthWave4AMetadataMigrationMilestoneReportNormalization) {}

  public migratedDataClasses(): ZavorthWave4AMilestoneDataClass[] {
    return this.normalization.migratedItems.map((item) => item.dataClass);
  }

  public blockedDataClasses(): ZavorthWave4AMilestoneDataClass[] {
    return this.normalization.blockedItems.map((item) => item.dataClass);
  }
}

export function createZavorthWave4AControlledMetadataMigrationMilestoneReportFixtureSource(
  overrides: Partial<ZavorthWave4AMilestoneSource> = {},
): ZavorthWave4AMilestoneSource {
  return {
    migrationPlanReady: true,
    firstBatchMigrationReady: true,
    loadVerifyParityReady: true,
    nativeRegistriesReady: true,
    wave3AbsorptionHardeningReady: true,
    configStateMigrationStrategyReady: true,
    rollbackRestoreRehearsalReady: true,
    commandCenterConsumptionReady: true,
    plannerPolicyObservabilityConsumptionReady: true,
    externalExecutorLiveRequiredForMilestone: false,
    newMigrationAttempted: false,
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
    ...overrides,
  };
}

export function normalizeZavorthWave4AControlledMetadataMigrationMilestoneReport<TRuntimeId extends string>(
  options: ZavorthWave4AMetadataMigrationMilestoneReportOptions<TRuntimeId>,
): ZavorthWave4AMetadataMigrationMilestoneReportNormalization {
  const migrated = migratedItems();
  const blocked = blockedItems();
  const existing = existingNativeSurfaces();
  const milestoneEvidence = evidence();
  const recommendation = nextRecommendation();
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    migrated.length === 7 &&
    blocked.length === 8 &&
    migrated.every((item) => item.evidenceGates.join(',') === '209,210,211' && item.loadVerifyParity === 'parity-ok') &&
    blocked.every((item) => !item.migrationAllowed && item.futureWaveRequired) &&
    milestoneEvidence.batchPreparedBy209 &&
    milestoneEvidence.batchExecutedUnderFlagBy210 &&
    milestoneEvidence.loadVerifyParityBy211 &&
    recommendation.primaryRecommendation === 'wave-4b-low-risk-executable-capabilities';

  return {
    nativeContract: 'ZavorthWave4AControlledMetadataMigrationMilestoneReport/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'wave4a-controlled-metadata-migration-milestone-recorded' : 'blocked',
    status: ready ? 'wave4a-controlled-metadata-migration-milestone-recorded' : 'blocked',
    sourceReadiness: options.source,
    migratedItems: migrated,
    blockedItems: blocked,
    existingNativeSurfaces: existing,
    evidence: milestoneEvidence,
    nextRecommendation: recommendation,
    executionGate: gate,
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'wave-4b-low-risk-executable-capabilities-or-targeted-metadata-gap-batch',
  };
}

export function normalizeZavorthWave4AControlledMetadataMigrationMilestoneReportFixture(
  overrides: Partial<ZavorthWave4AMilestoneSource> = {},
): ZavorthWave4AMetadataMigrationMilestoneReportNormalization {
  return normalizeZavorthWave4AControlledMetadataMigrationMilestoneReport({
    generatedAt: ZAVORTH_WAVE4A_CONTROLLED_METADATA_MIGRATION_MILESTONE_REPORT_NOW,
    runtimeId: ZAVORTH_WAVE4A_CONTROLLED_METADATA_MIGRATION_MILESTONE_REPORT_RUNTIME_ID,
    source: createZavorthWave4AControlledMetadataMigrationMilestoneReportFixtureSource(overrides),
  });
}

export function createZavorthWave4AControlledMetadataMigrationMilestoneReportFixture(
  overrides: Partial<ZavorthWave4AMilestoneSource> = {},
): ZavorthWave4AControlledMetadataMigrationMilestoneReport {
  return new ZavorthWave4AControlledMetadataMigrationMilestoneReport(
    normalizeZavorthWave4AControlledMetadataMigrationMilestoneReportFixture(overrides),
  );
}
