export const ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_MILESTONE_REPORT_NOW = '2026-04-30T17:00:00.000Z' as const;
export const ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_MILESTONE_REPORT_RUNTIME_ID = 'zavorth-wave4c-session-history-metadata-migration-milestone-report' as const;

export type ZavorthWave4CSessionHistoryMetadataMilestoneDecision =
  | 'blocked'
  | 'wave4c-session-history-metadata-milestone-recorded';

export type ZavorthWave4CSessionHistoryMetadataMilestoneSurfaceClassification =
  | 'blocked'
  | 'future-wave'
  | 'migrated-native'
  | 'migrated-native-partial'
  | 'native-existing-no-migration-needed';

export type ZavorthWave4CSessionHistoryMetadataMilestoneDataClass =
  | 'attachments-files'
  | 'backup-rollback-metadata'
  | 'channel-transport-linkage'
  | 'execution-state-mutable'
  | 'raw-message-content'
  | 'raw-sqlite-db-copy'
  | 'redacted-message-metadata'
  | 'redacted-participant-metadata'
  | 'secrets-tokens'
  | 'session-metadata'
  | 'sqlite-write'
  | 'thread-metadata'
  | 'timestamps-status'
  | 'workspace-logs-cache-raw';

export type ZavorthWave4CSessionHistoryMetadataMigratedItem = {
  nativeContract: 'ZavorthWave4CSessionHistoryMetadataMigratedItem/v1';
  dataClass: ZavorthWave4CSessionHistoryMetadataMilestoneDataClass;
  label: string;
  classification: Extract<ZavorthWave4CSessionHistoryMetadataMilestoneSurfaceClassification, 'migrated-native' | 'migrated-native-partial'>;
  evidenceGates: ['218', '219', '220'];
  migrationPlanPrepared: true;
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
  rawMessageContentSerialized: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4CSessionHistoryMetadataBlockedItem = {
  nativeContract: 'ZavorthWave4CSessionHistoryMetadataBlockedItem/v1';
  dataClass: ZavorthWave4CSessionHistoryMetadataMilestoneDataClass;
  label: string;
  classification: 'blocked';
  reason: string;
  evidenceGates: ['167', '172', '188', '218', '219', '220'];
  migrationAllowed: false;
  futureWaveRequired: true;
  rawMessageContentMigrationAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4CSessionHistoryMetadataExistingNativeSurface = {
  nativeContract: 'ZavorthWave4CSessionHistoryMetadataExistingNativeSurface/v1';
  surfaceId:
    | 'command-center-native-first-session-views'
    | 'consumer-expansion-session-consumers'
    | 'native-session-history-registry'
    | 'session-history-read-only-bridge'
    | 'wave4b-low-risk-executable-governance';
  label: string;
  classification: 'native-existing-no-migration-needed';
  evidenceGates: string[];
  runtimeExternalExecutorRequiredForDefaultPath: false;
  adapterDefaultPath: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4CSessionHistoryMetadataMilestoneEvidence = {
  nativeContract: 'ZavorthWave4CSessionHistoryMetadataMilestoneEvidence/v1';
  migrationPlanBy218: true;
  batchExecutedUnderFlagBy219: true;
  loadVerifyParityBy220: true;
  commandCenterPlannerPolicyObservabilityConsumptionProven: true;
  rollbackCleanupVerified: true;
  redactionScanPassed: true;
  externalExecutorLiveRequiredForMilestone: false;
  rawMessageContentSerialized: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4CSessionHistoryMetadataNextRecommendation = {
  nativeContract: 'ZavorthWave4CSessionHistoryMetadataNextRecommendation/v1';
  primaryRecommendation: 'wave-4b.2-medium-risk-executable-capabilities';
  alternateRecommendation: 'wave-4c.2-raw-history-sqlite-controlled-migration-planning';
  rationale: string;
  prerequisites: string[];
  stillBlocked: string[];
  highImpactExecutionStillBlocked: true;
  adapterRemovalGlobalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4CSessionHistoryMetadataMilestoneGate = {
  wave4cSessionHistoryMetadataMilestoneCreated: true;
  sessionHistoryMetadataMigrationMilestoneRecorded: true;
  migratedSessionMetadataSurfacesExplicit: true;
  blockedRawHistorySurfacesExplicit: true;
  nextWaveRecommendationCreated: true;
  rawMessageContentMigrationAllowed: false;
  rawSqliteCopyAllowed: false;
  sqliteWriteAllowed: false;
  attachmentsMigrationAllowed: false;
  rawSecretMigrationAllowed: false;
  workspaceLogsCacheRawMigrationAllowed: false;
  executionStateMigrationAllowed: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
  rawSecretSerialized: false;
  newMigrationExecutedByReport: false;
};

export type ZavorthWave4CSessionHistoryMetadataMilestoneSource = {
  migrationPlanReady: true;
  firstBatchMigrationReady: true;
  loadVerifyParityReady: true;
  nativeSessionHistoryRegistryReady: true;
  readOnlySessionHistoryBridgeReady: true;
  commandCenterNativeFirstReady: true;
  consumerExpansionReady: true;
  wave4bLowRiskExecutableMilestoneReady: true;
  externalExecutorLiveRequiredForMilestone: false;
  newMigrationAttempted: false;
  rawMessageContentMigrationAttempted: false;
  rawSqliteCopyAttempted: false;
  sqliteWriteAttempted: false;
  attachmentsMigrationAttempted: false;
  rawSecretMigrationAttempted: false;
  workspaceLogsCacheRawMigrationAttempted: false;
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

export type ZavorthWave4CSessionHistoryMetadataMigrationMilestoneReportNormalization = {
  nativeContract: 'ZavorthWave4CSessionHistoryMetadataMigrationMilestoneReport/v1';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_MILESTONE_REPORT_RUNTIME_ID;
  decision: ZavorthWave4CSessionHistoryMetadataMilestoneDecision;
  status: 'blocked' | 'wave4c-session-history-metadata-milestone-recorded';
  sourceReadiness: ZavorthWave4CSessionHistoryMetadataMilestoneSource;
  migratedItems: ZavorthWave4CSessionHistoryMetadataMigratedItem[];
  blockedItems: ZavorthWave4CSessionHistoryMetadataBlockedItem[];
  existingNativeSurfaces: ZavorthWave4CSessionHistoryMetadataExistingNativeSurface[];
  evidence: ZavorthWave4CSessionHistoryMetadataMilestoneEvidence;
  nextRecommendation: ZavorthWave4CSessionHistoryMetadataNextRecommendation;
  executionGate: ZavorthWave4CSessionHistoryMetadataMilestoneGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    sourceIdentityPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'wave-4b.2-medium-risk-executable-capabilities-or-wave-4c.2-raw-history-sqlite-controlled-migration-planning';
};

export type ZavorthWave4CSessionHistoryMetadataMigrationMilestoneReportOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_MILESTONE_REPORT_RUNTIME_ID;
  source: ZavorthWave4CSessionHistoryMetadataMilestoneSource;
};

function migratedItems(): ZavorthWave4CSessionHistoryMetadataMigratedItem[] {
  const items: Array<Pick<ZavorthWave4CSessionHistoryMetadataMigratedItem, 'dataClass' | 'label' | 'classification'>> = [
    { dataClass: 'session-metadata', label: 'Session metadata', classification: 'migrated-native' },
    { dataClass: 'thread-metadata', label: 'Thread metadata', classification: 'migrated-native' },
    { dataClass: 'redacted-message-metadata', label: 'Redacted message metadata', classification: 'migrated-native' },
    { dataClass: 'channel-transport-linkage', label: 'Channel/transport linkage', classification: 'migrated-native' },
    { dataClass: 'redacted-participant-metadata', label: 'Redacted participant metadata', classification: 'migrated-native' },
    { dataClass: 'timestamps-status', label: 'Timestamps/status', classification: 'migrated-native' },
    { dataClass: 'backup-rollback-metadata', label: 'Backup/rollback metadata', classification: 'migrated-native' },
  ];

  return items.map((item) => ({
    nativeContract: 'ZavorthWave4CSessionHistoryMetadataMigratedItem/v1',
    ...item,
    evidenceGates: ['218', '219', '220'],
    migrationPlanPrepared: true,
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
    rawMessageContentSerialized: false,
    rawSecretSerialized: false,
  }));
}

function blockedItems(): ZavorthWave4CSessionHistoryMetadataBlockedItem[] {
  const rows: Array<Pick<ZavorthWave4CSessionHistoryMetadataBlockedItem, 'dataClass' | 'label' | 'reason'>> = [
    { dataClass: 'raw-message-content', label: 'Raw message content', reason: 'Only redacted message metadata was migrated in Wave 4C.' },
    { dataClass: 'raw-sqlite-db-copy', label: 'Raw SQLite DB copy', reason: 'Real database copy requires a future controlled raw-history/SQLite gate.' },
    { dataClass: 'sqlite-write', label: 'SQLite write', reason: 'Source SQLite open-for-write remains forbidden.' },
    { dataClass: 'attachments-files', label: 'Attachments/files', reason: 'Attachment content and files need a future artifact/privacy gate.' },
    { dataClass: 'secrets-tokens', label: 'Secrets/tokens', reason: 'Secret values remain SecretRef-only and cannot migrate as raw data.' },
    { dataClass: 'workspace-logs-cache-raw', label: 'Workspace/log/cache raw data', reason: 'Raw workspace, logs, and cache are outside the metadata-only Wave 4C milestone.' },
    { dataClass: 'execution-state-mutable', label: 'Mutable execution state', reason: 'Mutable execution state migration remains blocked.' },
  ];

  return rows.map((row) => ({
    nativeContract: 'ZavorthWave4CSessionHistoryMetadataBlockedItem/v1',
    ...row,
    classification: 'blocked',
    evidenceGates: ['167', '172', '188', '218', '219', '220'],
    migrationAllowed: false,
    futureWaveRequired: true,
    rawMessageContentMigrationAllowed: false,
    rawSecretSerialized: false,
  }));
}

function existingNativeSurfaces(): ZavorthWave4CSessionHistoryMetadataExistingNativeSurface[] {
  return [
    {
      nativeContract: 'ZavorthWave4CSessionHistoryMetadataExistingNativeSurface/v1',
      surfaceId: 'native-session-history-registry',
      label: 'ZavorthNativeSessionHistoryRegistry',
      classification: 'native-existing-no-migration-needed',
      evidenceGates: ['188', '220'],
      runtimeExternalExecutorRequiredForDefaultPath: false,
      adapterDefaultPath: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthWave4CSessionHistoryMetadataExistingNativeSurface/v1',
      surfaceId: 'session-history-read-only-bridge',
      label: 'Session/history read-only bridge baseline',
      classification: 'native-existing-no-migration-needed',
      evidenceGates: ['172', '220'],
      runtimeExternalExecutorRequiredForDefaultPath: false,
      adapterDefaultPath: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthWave4CSessionHistoryMetadataExistingNativeSurface/v1',
      surfaceId: 'command-center-native-first-session-views',
      label: 'Command Center native-first session views',
      classification: 'native-existing-no-migration-needed',
      evidenceGates: ['192', '205', '220'],
      runtimeExternalExecutorRequiredForDefaultPath: false,
      adapterDefaultPath: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthWave4CSessionHistoryMetadataExistingNativeSurface/v1',
      surfaceId: 'consumer-expansion-session-consumers',
      label: 'Planner/policy/observability session metadata consumers',
      classification: 'native-existing-no-migration-needed',
      evidenceGates: ['205', '220'],
      runtimeExternalExecutorRequiredForDefaultPath: false,
      adapterDefaultPath: false,
      rawSecretSerialized: false,
    },
    {
      nativeContract: 'ZavorthWave4CSessionHistoryMetadataExistingNativeSurface/v1',
      surfaceId: 'wave4b-low-risk-executable-governance',
      label: 'Wave 4B low-risk executable governance',
      classification: 'native-existing-no-migration-needed',
      evidenceGates: ['213', '214', '215', '216', '217'],
      runtimeExternalExecutorRequiredForDefaultPath: false,
      adapterDefaultPath: false,
      rawSecretSerialized: false,
    },
  ];
}

function evidence(): ZavorthWave4CSessionHistoryMetadataMilestoneEvidence {
  return {
    nativeContract: 'ZavorthWave4CSessionHistoryMetadataMilestoneEvidence/v1',
    migrationPlanBy218: true,
    batchExecutedUnderFlagBy219: true,
    loadVerifyParityBy220: true,
    commandCenterPlannerPolicyObservabilityConsumptionProven: true,
    rollbackCleanupVerified: true,
    redactionScanPassed: true,
    externalExecutorLiveRequiredForMilestone: false,
    rawMessageContentSerialized: false,
    rawSecretSerialized: false,
  };
}

function nextRecommendation(): ZavorthWave4CSessionHistoryMetadataNextRecommendation {
  return {
    nativeContract: 'ZavorthWave4CSessionHistoryMetadataNextRecommendation/v1',
    primaryRecommendation: 'wave-4b.2-medium-risk-executable-capabilities',
    alternateRecommendation: 'wave-4c.2-raw-history-sqlite-controlled-migration-planning',
    rationale: 'Wave 4C proved controlled metadata-only session/history migration, load, parity, consumption, rollback/cleanup, and redaction without ExternalExecutor live. The next useful path is either medium-risk executable capabilities or a new raw-history/SQLite planning wave with stronger privacy and rollback gates.',
    prerequisites: [
      'keep session/history lookup and render independent from ExternalExecutor live',
      'keep raw message content and SQLite copy blocked until a future explicit gate',
      'preserve rollback/cleanup receipts for migrated metadata',
      'require policy/approval before medium-risk executable capabilities',
    ],
    stillBlocked: [
      'raw message content',
      'raw SQLite DB copy',
      'SQLite write',
      'attachments/files',
      'secrets/tokens',
      'workspace/log/cache raw data',
      'mutable execution state',
      'real message send',
      'provider/tool/command execution',
      'global adapter removal',
    ],
    highImpactExecutionStillBlocked: true,
    adapterRemovalGlobalAllowed: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthWave4CSessionHistoryMetadataMilestoneGate {
  return {
    wave4cSessionHistoryMetadataMilestoneCreated: true,
    sessionHistoryMetadataMigrationMilestoneRecorded: true,
    migratedSessionMetadataSurfacesExplicit: true,
    blockedRawHistorySurfacesExplicit: true,
    nextWaveRecommendationCreated: true,
    rawMessageContentMigrationAllowed: false,
    rawSqliteCopyAllowed: false,
    sqliteWriteAllowed: false,
    attachmentsMigrationAllowed: false,
    rawSecretMigrationAllowed: false,
    workspaceLogsCacheRawMigrationAllowed: false,
    executionStateMigrationAllowed: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    sourceModuleCopied: false,
    adapterRemovalGlobalAllowed: false,
    rawSecretSerialized: false,
    newMigrationExecutedByReport: false,
  };
}

function sourceReady(source: ZavorthWave4CSessionHistoryMetadataMilestoneSource): boolean {
  return (
    source.migrationPlanReady &&
    source.firstBatchMigrationReady &&
    source.loadVerifyParityReady &&
    source.nativeSessionHistoryRegistryReady &&
    source.readOnlySessionHistoryBridgeReady &&
    source.commandCenterNativeFirstReady &&
    source.consumerExpansionReady &&
    source.wave4bLowRiskExecutableMilestoneReady &&
    !source.externalExecutorLiveRequiredForMilestone &&
    !source.newMigrationAttempted &&
    !source.rawMessageContentMigrationAttempted &&
    !source.rawSqliteCopyAttempted &&
    !source.sqliteWriteAttempted &&
    !source.attachmentsMigrationAttempted &&
    !source.rawSecretMigrationAttempted &&
    !source.workspaceLogsCacheRawMigrationAttempted &&
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

export class ZavorthWave4CSessionHistoryMetadataMigrationMilestoneReport {
  public constructor(public readonly normalization: ZavorthWave4CSessionHistoryMetadataMigrationMilestoneReportNormalization) {}

  public migratedDataClasses(): ZavorthWave4CSessionHistoryMetadataMilestoneDataClass[] {
    return this.normalization.migratedItems.map((item) => item.dataClass);
  }

  public blockedDataClasses(): ZavorthWave4CSessionHistoryMetadataMilestoneDataClass[] {
    return this.normalization.blockedItems.map((item) => item.dataClass);
  }
}

export function createZavorthWave4CSessionHistoryMetadataMigrationMilestoneReportFixtureSource(
  overrides: Partial<ZavorthWave4CSessionHistoryMetadataMilestoneSource> = {},
): ZavorthWave4CSessionHistoryMetadataMilestoneSource {
  return {
    migrationPlanReady: true,
    firstBatchMigrationReady: true,
    loadVerifyParityReady: true,
    nativeSessionHistoryRegistryReady: true,
    readOnlySessionHistoryBridgeReady: true,
    commandCenterNativeFirstReady: true,
    consumerExpansionReady: true,
    wave4bLowRiskExecutableMilestoneReady: true,
    externalExecutorLiveRequiredForMilestone: false,
    newMigrationAttempted: false,
    rawMessageContentMigrationAttempted: false,
    rawSqliteCopyAttempted: false,
    sqliteWriteAttempted: false,
    attachmentsMigrationAttempted: false,
    rawSecretMigrationAttempted: false,
    workspaceLogsCacheRawMigrationAttempted: false,
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

export function normalizeZavorthWave4CSessionHistoryMetadataMigrationMilestoneReport(
  options: ZavorthWave4CSessionHistoryMetadataMigrationMilestoneReportOptions,
): ZavorthWave4CSessionHistoryMetadataMigrationMilestoneReportNormalization {
  const migrated = migratedItems();
  const blocked = blockedItems();
  const existing = existingNativeSurfaces();
  const milestoneEvidence = evidence();
  const recommendation = nextRecommendation();
  const gate = executionGate();
  const ready = sourceReady(options.source) &&
    migrated.length === 7 &&
    blocked.length === 7 &&
    migrated.every((item) => (
      item.evidenceGates.join(',') === '218,219,220' &&
      item.loadVerifyParity === 'parity-ok' &&
      item.runtimeExternalExecutorRequiredForConsumption === false &&
      item.rawMessageContentSerialized === false
    )) &&
    blocked.every((item) => !item.migrationAllowed && item.futureWaveRequired && !item.rawMessageContentMigrationAllowed) &&
    milestoneEvidence.migrationPlanBy218 &&
    milestoneEvidence.batchExecutedUnderFlagBy219 &&
    milestoneEvidence.loadVerifyParityBy220 &&
    recommendation.primaryRecommendation === 'wave-4b.2-medium-risk-executable-capabilities';

  return {
    nativeContract: 'ZavorthWave4CSessionHistoryMetadataMigrationMilestoneReport/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'wave4c-session-history-metadata-milestone-recorded' : 'blocked',
    status: ready ? 'wave4c-session-history-metadata-milestone-recorded' : 'blocked',
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
    nextGateRecommended: 'wave-4b.2-medium-risk-executable-capabilities-or-wave-4c.2-raw-history-sqlite-controlled-migration-planning',
  };
}

export function normalizeZavorthWave4CSessionHistoryMetadataMigrationMilestoneReportFixture(
  overrides: Partial<ZavorthWave4CSessionHistoryMetadataMilestoneSource> = {},
): ZavorthWave4CSessionHistoryMetadataMigrationMilestoneReportNormalization {
  return normalizeZavorthWave4CSessionHistoryMetadataMigrationMilestoneReport({
    generatedAt: ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_MILESTONE_REPORT_NOW,
    runtimeId: ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_MILESTONE_REPORT_RUNTIME_ID,
    source: createZavorthWave4CSessionHistoryMetadataMigrationMilestoneReportFixtureSource(overrides),
  });
}

export function createZavorthWave4CSessionHistoryMetadataMigrationMilestoneReportFixture(
  overrides: Partial<ZavorthWave4CSessionHistoryMetadataMilestoneSource> = {},
): ZavorthWave4CSessionHistoryMetadataMigrationMilestoneReport {
  return new ZavorthWave4CSessionHistoryMetadataMigrationMilestoneReport(
    normalizeZavorthWave4CSessionHistoryMetadataMigrationMilestoneReportFixture(overrides),
  );
}
