export const ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_MILESTONE_REPORT_NOW = '2026-05-01T01:00:00.000Z' as const;
export const ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_MILESTONE_REPORT_RUNTIME_ID = 'zavorth-wave4c2-redacted-session-content-migration-milestone-report' as const;

export type ZavorthWave4C2RedactedContentMilestoneDecision =
  | 'blocked'
  | 'wave4c2-redacted-content-migration-milestone-recorded';

export type ZavorthWave4C2RedactedContentMilestoneSurfaceClassification =
  | 'blocked'
  | 'future-wave'
  | 'migrated-derived-native'
  | 'migrated-native-partial'
  | 'migrated-redacted-native';

export type ZavorthWave4C2RedactedContentMilestoneDataClass =
  | 'attachments-files-binary-payloads'
  | 'backup-rollback-metadata'
  | 'content-hash'
  | 'content-length-count-metadata'
  | 'execution-state-mutable'
  | 'participant-channel-thread-linkage-redacted'
  | 'raw-message-content'
  | 'raw-sqlite-db-copy'
  | 'redacted-excerpt'
  | 'secrets-tokens'
  | 'sensitivity-classification'
  | 'sqlite-write'
  | 'timestamps-status'
  | 'workspace-logs-cache-raw';

export type ZavorthWave4C2RedactedContentMigratedItem = {
  nativeContract: 'ZavorthWave4C2RedactedContentMigratedItem/v1';
  dataClass: ZavorthWave4C2RedactedContentMilestoneDataClass;
  label: string;
  classification: Extract<
    ZavorthWave4C2RedactedContentMilestoneSurfaceClassification,
    'migrated-derived-native' | 'migrated-native-partial' | 'migrated-redacted-native'
  >;
  evidenceGates: ['226', '227', '228'];
  readinessPackPrepared: true;
  batchExecutedUnderFlag: true;
  loadVerifyParity: 'parity-ok';
  consumedBy: [
    'command-center',
    'controlled-dry-run-planner',
    'command-http-policy-preflight',
    'command-http-observability-projection',
  ];
  rollbackCleanupVerified: true;
  redactionScanPassed: true;
  runtimeExternalExecutorRequiredForConsumption: false;
  sourceRuntimeAuthority: false;
  rawMessageContentSerialized: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4C2RedactedContentBlockedItem = {
  nativeContract: 'ZavorthWave4C2RedactedContentBlockedItem/v1';
  dataClass: ZavorthWave4C2RedactedContentMilestoneDataClass;
  label: string;
  classification: 'blocked';
  reason: string;
  evidenceGates: ['167', '172', '188', '219', '220', '226', '227', '228'];
  migrationAllowed: false;
  futureWaveRequired: true;
  rawMessageContentMigrationAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4C2RedactedContentMilestoneEvidence = {
  nativeContract: 'ZavorthWave4C2RedactedContentMilestoneEvidence/v1';
  readinessPackBy226: true;
  batchExecutedUnderFlagBy227: true;
  loadVerifyParityBy228: true;
  sessionHistoryMetadataMilestoneBy219To221: true;
  commandCenterPlannerPolicyObservabilityConsumptionProven: true;
  rollbackCleanupVerified: true;
  redactionScanPassed: true;
  externalExecutorLiveRequiredForMilestone: false;
  rawMessageContentSerialized: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4C2RedactedContentNextRecommendation = {
  nativeContract: 'ZavorthWave4C2RedactedContentNextRecommendation/v1';
  primaryRecommendation: 'wave-4b3-medium-high-risk-dry-run-executables';
  alternateRecommendation: 'wave-4c3-raw-content-migration-planning-with-explicit-justification';
  rationale: string;
  prerequisites: string[];
  stillBlocked: string[];
  highImpactExecutionStillBlocked: true;
  adapterRemovalGlobalAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4C2RedactedContentMilestoneGate = {
  wave4c2RedactedContentMigrationMilestoneCreated: true;
  redactedDerivedContentMigrationMilestoneRecorded: true;
  migratedRedactedContentSurfacesExplicit: true;
  blockedRawContentSurfacesExplicit: true;
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

export type ZavorthWave4C2RedactedContentMilestoneSource = {
  readinessPackReady: true;
  firstRedactedContentMigrationBatchReady: true;
  redactedContentLoadVerifyParityReady: true;
  sessionHistoryMetadataMigrationMilestoneReady: true;
  nativeSessionHistoryRegistryReady: true;
  readOnlySessionHistoryBridgeReady: true;
  commandCenterNativeFirstReady: true;
  consumerExpansionReady: true;
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

export type ZavorthWave4C2RedactedSessionContentMigrationMilestoneReportNormalization = {
  nativeContract: 'ZavorthWave4C2RedactedSessionContentMigrationMilestoneReport/v1';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_MILESTONE_REPORT_RUNTIME_ID;
  decision: ZavorthWave4C2RedactedContentMilestoneDecision;
  status: 'blocked' | 'wave4c2-redacted-content-migration-milestone-recorded';
  sourceReadiness: ZavorthWave4C2RedactedContentMilestoneSource;
  migratedItems: ZavorthWave4C2RedactedContentMigratedItem[];
  blockedItems: ZavorthWave4C2RedactedContentBlockedItem[];
  surfaceClassifications: ZavorthWave4C2RedactedContentMilestoneSurfaceClassification[];
  evidence: ZavorthWave4C2RedactedContentMilestoneEvidence;
  nextRecommendation: ZavorthWave4C2RedactedContentNextRecommendation;
  executionGate: ZavorthWave4C2RedactedContentMilestoneGate;
  redaction: {
    rawSecretSerialized: false;
    rawMessageContentSerialized: false;
    sourceIdentityPublic: false;
    provenanceInternalOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'wave-4b3-medium-high-risk-dry-run-executables-or-wave-4c3-by-explicit-justification';
};

export type ZavorthWave4C2RedactedSessionContentMigrationMilestoneReportOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_MILESTONE_REPORT_RUNTIME_ID;
  source: ZavorthWave4C2RedactedContentMilestoneSource;
};

function migratedItems(): ZavorthWave4C2RedactedContentMigratedItem[] {
  const items: Array<Pick<ZavorthWave4C2RedactedContentMigratedItem, 'dataClass' | 'label' | 'classification'>> = [
    { dataClass: 'content-hash', label: 'Content hash', classification: 'migrated-derived-native' },
    { dataClass: 'content-length-count-metadata', label: 'Content length/count metadata', classification: 'migrated-derived-native' },
    { dataClass: 'redacted-excerpt', label: 'Redacted excerpt placeholder', classification: 'migrated-redacted-native' },
    { dataClass: 'sensitivity-classification', label: 'Sensitivity classification', classification: 'migrated-derived-native' },
    { dataClass: 'participant-channel-thread-linkage-redacted', label: 'Participant/channel/thread linkage redacted', classification: 'migrated-redacted-native' },
    { dataClass: 'timestamps-status', label: 'Timestamps/status metadata', classification: 'migrated-derived-native' },
    { dataClass: 'backup-rollback-metadata', label: 'Backup/rollback metadata', classification: 'migrated-derived-native' },
  ];

  return items.map((item) => ({
    nativeContract: 'ZavorthWave4C2RedactedContentMigratedItem/v1',
    ...item,
    evidenceGates: ['226', '227', '228'],
    readinessPackPrepared: true,
    batchExecutedUnderFlag: true,
    loadVerifyParity: 'parity-ok',
    consumedBy: [
      'command-center',
      'controlled-dry-run-planner',
      'command-http-policy-preflight',
      'command-http-observability-projection',
    ],
    rollbackCleanupVerified: true,
    redactionScanPassed: true,
    runtimeExternalExecutorRequiredForConsumption: false,
    sourceRuntimeAuthority: false,
    rawMessageContentSerialized: false,
    rawSecretSerialized: false,
  }));
}

function blockedItems(): ZavorthWave4C2RedactedContentBlockedItem[] {
  const rows: Array<Pick<ZavorthWave4C2RedactedContentBlockedItem, 'dataClass' | 'label' | 'reason'>> = [
    { dataClass: 'raw-message-content', label: 'Raw message content', reason: 'Wave 4C.2 migrated only redacted or derived content metadata.' },
    { dataClass: 'raw-sqlite-db-copy', label: 'Raw SQLite DB copy', reason: 'Real database copy remains blocked without a future explicit SQLite gate.' },
    { dataClass: 'sqlite-write', label: 'SQLite write', reason: 'Source SQLite open-for-write remains forbidden.' },
    { dataClass: 'attachments-files-binary-payloads', label: 'Attachments/files/binary payloads', reason: 'Attachment and binary migration requires a future artifact/privacy gate.' },
    { dataClass: 'secrets-tokens', label: 'Secrets/tokens', reason: 'Secret values remain SecretRef-only and cannot migrate as raw data.' },
    { dataClass: 'workspace-logs-cache-raw', label: 'Workspace/log/cache raw data', reason: 'Raw workspace, logs, and cache remain outside redacted content migration.' },
    { dataClass: 'execution-state-mutable', label: 'Mutable execution state', reason: 'Mutable execution state migration and execution remain blocked.' },
  ];

  return rows.map((row) => ({
    nativeContract: 'ZavorthWave4C2RedactedContentBlockedItem/v1',
    ...row,
    classification: 'blocked',
    evidenceGates: ['167', '172', '188', '219', '220', '226', '227', '228'],
    migrationAllowed: false,
    futureWaveRequired: true,
    rawMessageContentMigrationAllowed: false,
    rawSecretSerialized: false,
  }));
}

function evidence(): ZavorthWave4C2RedactedContentMilestoneEvidence {
  return {
    nativeContract: 'ZavorthWave4C2RedactedContentMilestoneEvidence/v1',
    readinessPackBy226: true,
    batchExecutedUnderFlagBy227: true,
    loadVerifyParityBy228: true,
    sessionHistoryMetadataMilestoneBy219To221: true,
    commandCenterPlannerPolicyObservabilityConsumptionProven: true,
    rollbackCleanupVerified: true,
    redactionScanPassed: true,
    externalExecutorLiveRequiredForMilestone: false,
    rawMessageContentSerialized: false,
    rawSecretSerialized: false,
  };
}

function nextRecommendation(): ZavorthWave4C2RedactedContentNextRecommendation {
  return {
    nativeContract: 'ZavorthWave4C2RedactedContentNextRecommendation/v1',
    primaryRecommendation: 'wave-4b3-medium-high-risk-dry-run-executables',
    alternateRecommendation: 'wave-4c3-raw-content-migration-planning-with-explicit-justification',
    rationale: 'Wave 4C.2 proved readiness, controlled redacted/derived content batch write, load/verify/parity, consumption, rollback/cleanup, and redaction without ExternalExecutor live. The safer next path is medium/high-risk dry-run executable planning; raw content migration planning requires explicit justification and stronger privacy gates.',
    prerequisites: [
      '226 readiness pack remains passing',
      '227 controlled redacted content batch remains passing',
      '228 redacted content load/verify/parity remains passing',
      'raw content and high-impact execution stay blocked unless a future explicit gate changes scope',
    ],
    stillBlocked: [
      'raw message content',
      'raw SQLite DB copy',
      'SQLite write',
      'attachments/files/binary payloads',
      'secrets/tokens',
      'workspace/log/cache raw data',
      'execution state mutable',
      'real message send',
      'provider/tool/command execution',
      'global adapter removal',
    ],
    highImpactExecutionStillBlocked: true,
    adapterRemovalGlobalAllowed: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthWave4C2RedactedContentMilestoneGate {
  return {
    wave4c2RedactedContentMigrationMilestoneCreated: true,
    redactedDerivedContentMigrationMilestoneRecorded: true,
    migratedRedactedContentSurfacesExplicit: true,
    blockedRawContentSurfacesExplicit: true,
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

function sourceReady(source: ZavorthWave4C2RedactedContentMilestoneSource): boolean {
  return (
    source.readinessPackReady &&
    source.firstRedactedContentMigrationBatchReady &&
    source.redactedContentLoadVerifyParityReady &&
    source.sessionHistoryMetadataMigrationMilestoneReady &&
    source.nativeSessionHistoryRegistryReady &&
    source.readOnlySessionHistoryBridgeReady &&
    source.commandCenterNativeFirstReady &&
    source.consumerExpansionReady &&
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

export class ZavorthWave4C2RedactedSessionContentMigrationMilestoneReport {
  public constructor(public readonly normalization: ZavorthWave4C2RedactedSessionContentMigrationMilestoneReportNormalization) {}

  public migratedDataClasses(): ZavorthWave4C2RedactedContentMilestoneDataClass[] {
    return this.normalization.migratedItems.map((item) => item.dataClass);
  }

  public blockedDataClasses(): ZavorthWave4C2RedactedContentMilestoneDataClass[] {
    return this.normalization.blockedItems.map((item) => item.dataClass);
  }
}

export function createZavorthWave4C2RedactedSessionContentMigrationMilestoneReportFixtureSource(
  overrides: Partial<ZavorthWave4C2RedactedContentMilestoneSource> = {},
): ZavorthWave4C2RedactedContentMilestoneSource {
  return {
    readinessPackReady: true,
    firstRedactedContentMigrationBatchReady: true,
    redactedContentLoadVerifyParityReady: true,
    sessionHistoryMetadataMigrationMilestoneReady: true,
    nativeSessionHistoryRegistryReady: true,
    readOnlySessionHistoryBridgeReady: true,
    commandCenterNativeFirstReady: true,
    consumerExpansionReady: true,
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

export function normalizeZavorthWave4C2RedactedSessionContentMigrationMilestoneReport(
  options: ZavorthWave4C2RedactedSessionContentMigrationMilestoneReportOptions,
): ZavorthWave4C2RedactedSessionContentMigrationMilestoneReportNormalization {
  const migrated = migratedItems();
  const blocked = blockedItems();
  const ready = sourceReady(options.source) &&
    migrated.length === 7 &&
    blocked.length === 7 &&
    migrated.every((item) => item.evidenceGates.join(',') === '226,227,228' && !item.rawMessageContentSerialized && !item.rawSecretSerialized) &&
    blocked.every((item) => !item.migrationAllowed && item.futureWaveRequired && !item.rawMessageContentMigrationAllowed);

  return {
    nativeContract: 'ZavorthWave4C2RedactedSessionContentMigrationMilestoneReport/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: ready ? 'wave4c2-redacted-content-migration-milestone-recorded' : 'blocked',
    status: ready ? 'wave4c2-redacted-content-migration-milestone-recorded' : 'blocked',
    sourceReadiness: options.source,
    migratedItems: migrated,
    blockedItems: blocked,
    surfaceClassifications: [
      'migrated-redacted-native',
      'migrated-derived-native',
      'migrated-native-partial',
      'blocked',
      'future-wave',
    ],
    evidence: evidence(),
    nextRecommendation: nextRecommendation(),
    executionGate: executionGate(),
    redaction: {
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'wave-4b3-medium-high-risk-dry-run-executables-or-wave-4c3-by-explicit-justification',
  };
}

export function normalizeZavorthWave4C2RedactedSessionContentMigrationMilestoneReportFixture(
  overrides: Partial<ZavorthWave4C2RedactedContentMilestoneSource> = {},
): ZavorthWave4C2RedactedSessionContentMigrationMilestoneReportNormalization {
  return normalizeZavorthWave4C2RedactedSessionContentMigrationMilestoneReport({
    generatedAt: ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_MILESTONE_REPORT_NOW,
    runtimeId: ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_MILESTONE_REPORT_RUNTIME_ID,
    source: createZavorthWave4C2RedactedSessionContentMigrationMilestoneReportFixtureSource(overrides),
  });
}

export function createZavorthWave4C2RedactedSessionContentMigrationMilestoneReportFixture(
  overrides: Partial<ZavorthWave4C2RedactedContentMilestoneSource> = {},
): ZavorthWave4C2RedactedSessionContentMigrationMilestoneReport {
  return new ZavorthWave4C2RedactedSessionContentMigrationMilestoneReport(
    normalizeZavorthWave4C2RedactedSessionContentMigrationMilestoneReportFixture(overrides),
  );
}
