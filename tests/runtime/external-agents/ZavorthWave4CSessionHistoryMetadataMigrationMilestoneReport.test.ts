import fs from 'node:fs';
import path from 'node:path';

import {
  createZavorthWave4CSessionHistoryMetadataMigrationMilestoneReportFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4CSessionHistoryMetadataMilestoneDataClass,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/221-wave-4c-session-history-metadata-migration-milestone-report.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/220-wave-4c-session-history-metadata-load-verify-parity.md';
const PRIOR_TEST = 'tests/runtime/external-agents/ZavorthWave4CSessionHistoryMetadataLoadVerifyParity.test.ts';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4CSessionHistoryMetadataMigrationMilestoneReport.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const MIGRATED: ZavorthWave4CSessionHistoryMetadataMilestoneDataClass[] = [
  'session-metadata',
  'thread-metadata',
  'redacted-message-metadata',
  'channel-transport-linkage',
  'redacted-participant-metadata',
  'timestamps-status',
  'backup-rollback-metadata',
];

const BLOCKED: ZavorthWave4CSessionHistoryMetadataMilestoneDataClass[] = [
  'raw-message-content',
  'raw-sqlite-db-copy',
  'sqlite-write',
  'attachments-files',
  'secrets-tokens',
  'workspace-logs-cache-raw',
  'execution-state-mutable',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assertNoRawSecretOrContent(serialized: string): void {
  expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{8,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{8,}/);
  expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  expect(serialized).not.toContain('<redacted-local-secret>');
  expect(serialized).not.toContain('raw user message body that must never migrate');
}

describe('Wave 4C session/history metadata migration milestone report', () => {
  it('documents 221 as the Wave 4C session/history metadata migration milestone report', () => {
    const content = read(DOC);

    expect(content).toContain('Status: wave4c-session-history-metadata-milestone-recorded');
    expect(content).toContain('ZavorthWave4CSessionHistoryMetadataMigrationMilestoneReport.ts');
    expect(content).toContain('ZavorthWave4CSessionHistoryMetadataMigrationMilestoneReport/v1');
    expect(content).toContain('ZavorthWave4CSessionHistoryMetadataMigratedItem/v1');
    expect(content).toContain('ZavorthWave4CSessionHistoryMetadataBlockedItem/v1');
    expect(content).toContain('ZavorthWave4CSessionHistoryMetadataNextRecommendation/v1');
    expect(content).toContain('wave4cSessionHistoryMetadataMilestoneCreated=true');
    expect(content).toContain('sessionHistoryMetadataMigrationMilestoneRecorded=true');
    expect(content).toContain('nextWaveRecommendationCreated=true');
    expect(content).toContain('Wave 4B.2: medium-risk executable capabilities');
    expect(content).toContain('Wave 4C.2: raw history/SQLite controlled migration planning');
    expect(content).toContain('Wave 4B.2 medium-risk executable capability selection follow-up:');
    expect(content).toContain('docs/222-wave-4b2-medium-risk-executable-capability-selection.md');
    expect(content).toContain('Do not advance beyond Wave 4B.2 medium-risk executable selection');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the 220 handoff for 221', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/221-wave-4c-session-history-metadata-migration-milestone-report.md');
    expect(read(PAUSE_DOC)).toContain('`221` is the first Wave 4C session/history metadata migration milestone report');
    expect(read(PRIOR_DOC)).toContain('Wave 4C session/history metadata migration milestone follow-up:');
    expect(read(PRIOR_DOC)).toContain('docs/221-wave-4c-session-history-metadata-migration-milestone-report.md');
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond the Wave 4C session/history metadata migration milestone');
    expect(read(PRIOR_TEST)).toContain('docs/221-wave-4c-session-history-metadata-migration-milestone-report.md');
  });

  it('exports the Wave 4C milestone report boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4CSessionHistoryMetadataMigrationMilestoneReport/v1');
    expect(boundary).toContain('ZavorthWave4CSessionHistoryMetadataMigratedItem/v1');
    expect(boundary).toContain('ZavorthWave4CSessionHistoryMetadataMilestoneGate');
    expect(index).toContain("from './ZavorthWave4CSessionHistoryMetadataMigrationMilestoneReport.js'");
    expect(index).toContain('ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_MILESTONE_REPORT_RUNTIME_ID');
  });

  it('lists migrated session/history metadata items with evidence from 218/219/220', () => {
    const report = createZavorthWave4CSessionHistoryMetadataMigrationMilestoneReportFixture();

    expect(report.normalization.decision).toBe('wave4c-session-history-metadata-milestone-recorded');
    expect(report.migratedDataClasses()).toEqual(MIGRATED);
    report.normalization.migratedItems.forEach((item) => {
      expect(item.classification).toBe('migrated-native');
      expect(item.evidenceGates).toEqual(['218', '219', '220']);
      expect(item.migrationPlanPrepared).toBe(true);
      expect(item.batchExecutedUnderFlag).toBe(true);
      expect(item.loadVerifyParity).toBe('parity-ok');
      expect(item.rollbackCleanupVerified).toBe(true);
      expect(item.redactionScanPassed).toBe(true);
      expect(item.consumedBy).toEqual([
        'command-center',
        'controlled-dry-run-planner',
        'command-http-policy-preflight',
        'command-http-observability-projection',
      ]);
      expect(item.runtimeExternalExecutorRequiredForConsumption).toBe(false);
      expect(item.rawMessageContentSerialized).toBe(false);
      expect(item.rawSecretSerialized).toBe(false);
    });
  });

  it('lists dangerous raw history and SQLite surfaces as blocked', () => {
    const report = createZavorthWave4CSessionHistoryMetadataMigrationMilestoneReportFixture();

    expect(report.blockedDataClasses()).toEqual(BLOCKED);
    report.normalization.blockedItems.forEach((item) => {
      expect(item.classification).toBe('blocked');
      expect(item.migrationAllowed).toBe(false);
      expect(item.futureWaveRequired).toBe(true);
      expect(item.evidenceGates).toEqual(['167', '172', '188', '218', '219', '220']);
      expect(item.rawMessageContentMigrationAllowed).toBe(false);
      expect(item.rawSecretSerialized).toBe(false);
    });
  });

  it('records existing native surfaces that did not need migration', () => {
    const report = createZavorthWave4CSessionHistoryMetadataMigrationMilestoneReportFixture();

    expect(report.normalization.existingNativeSurfaces.map((surface) => surface.surfaceId)).toEqual([
      'native-session-history-registry',
      'session-history-read-only-bridge',
      'command-center-native-first-session-views',
      'consumer-expansion-session-consumers',
      'wave4b-low-risk-executable-governance',
    ]);
    report.normalization.existingNativeSurfaces.forEach((surface) => {
      expect(surface.classification).toBe('native-existing-no-migration-needed');
      expect(surface.runtimeExternalExecutorRequiredForDefaultPath).toBe(false);
      expect(surface.adapterDefaultPath).toBe(false);
      expect(surface.rawSecretSerialized).toBe(false);
    });
  });

  it('records milestone evidence and recommends the next wave', () => {
    const report = createZavorthWave4CSessionHistoryMetadataMigrationMilestoneReportFixture();

    expect(report.normalization.evidence).toEqual({
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
    });
    expect(report.normalization.nextRecommendation).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4CSessionHistoryMetadataNextRecommendation/v1',
      primaryRecommendation: 'wave-4b.2-medium-risk-executable-capabilities',
      alternateRecommendation: 'wave-4c.2-raw-history-sqlite-controlled-migration-planning',
      highImpactExecutionStillBlocked: true,
      adapterRemovalGlobalAllowed: false,
      rawSecretSerialized: false,
    }));
    expect(report.normalization.nextRecommendation.stillBlocked).toEqual(expect.arrayContaining([
      'raw message content',
      'raw SQLite DB copy',
      'SQLite write',
      'real message send',
      'provider/tool/command execution',
      'global adapter removal',
    ]));
  });

  it('keeps ExternalExecutor optional and blocks new migration/execution side effects', () => {
    const report = createZavorthWave4CSessionHistoryMetadataMigrationMilestoneReportFixture();
    const serialized = JSON.stringify(report.normalization);

    expect(report.normalization.executionGate).toEqual({
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
    });
    expect(report.normalization.sourceReadiness.externalExecutorLiveRequiredForMilestone).toBe(false);
    expect(report.normalization.sourceReadiness.newMigrationAttempted).toBe(false);
    expect(report.normalization.redaction).toEqual({
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    assertNoRawSecretOrContent(serialized);
  });

  it('blocks the milestone if a new migration, ExternalExecutor touch, or high-impact path is attempted', () => {
    const report = createZavorthWave4CSessionHistoryMetadataMigrationMilestoneReportFixture({
      externalExecutorLiveRequiredForMilestone: true,
      newMigrationAttempted: true,
      rawMessageContentMigrationAttempted: true,
      rawSqliteCopyAttempted: true,
      sqliteWriteAttempted: true,
      messageSendAttempted: true,
      providerExecutionAttempted: true,
      commandExecutionAttempted: true,
      toolExecutionAttempted: true,
    });

    expect(report.normalization.decision).toBe('blocked');
    expect(report.normalization.executionGate.rawMessageContentMigrationAllowed).toBe(false);
    expect(report.normalization.executionGate.rawSqliteCopyAllowed).toBe(false);
    expect(report.normalization.executionGate.sqliteWriteAllowed).toBe(false);
    expect(report.normalization.executionGate.messageActuallySent).toBe(false);
    expect(report.normalization.executionGate.providerActuallyExecuted).toBe(false);
    expect(report.normalization.executionGate.commandActuallyExecuted).toBe(false);
    expect(report.normalization.executionGate.toolActuallyExecuted).toBe(false);
  });
});
