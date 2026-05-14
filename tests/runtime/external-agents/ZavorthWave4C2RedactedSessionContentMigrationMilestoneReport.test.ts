import fs from 'node:fs';
import path from 'node:path';

import {
  createZavorthWave4C2RedactedSessionContentMigrationMilestoneReportFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4C2RedactedContentMilestoneDataClass,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/229-wave-4c2-redacted-session-content-migration-milestone-report.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/228-wave-4c2-redacted-session-content-load-verify-parity.md';
const PRIOR_TEST = 'tests/runtime/external-agents/ZavorthWave4C2RedactedSessionContentLoadVerifyParity.test.ts';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4C2RedactedSessionContentMigrationMilestoneReport.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const MIGRATED: ZavorthWave4C2RedactedContentMilestoneDataClass[] = [
  'content-hash',
  'content-length-count-metadata',
  'redacted-excerpt',
  'sensitivity-classification',
  'participant-channel-thread-linkage-redacted',
  'timestamps-status',
  'backup-rollback-metadata',
];

const BLOCKED: ZavorthWave4C2RedactedContentMilestoneDataClass[] = [
  'raw-message-content',
  'raw-sqlite-db-copy',
  'sqlite-write',
  'attachments-files-binary-payloads',
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
  expect(serialized).not.toContain('unredacted private message fixture');
  expect(serialized).not.toContain('attachment binary fixture that must never migrate');
}

describe('Wave 4C.2 redacted session content migration milestone report', () => {
  it('documents 229 as the Wave 4C.2 redacted/derived content migration milestone', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `wave4c2-redacted-content-migration-milestone-recorded`');
    expect(content).toContain('ZavorthWave4C2RedactedSessionContentMigrationMilestoneReport.ts');
    expect(content).toContain('ZavorthWave4C2RedactedSessionContentMigrationMilestoneReport/v1');
    expect(content).toContain('ZavorthWave4C2RedactedContentMigratedItem/v1');
    expect(content).toContain('ZavorthWave4C2RedactedContentBlockedItem/v1');
    expect(content).toContain('ZavorthWave4C2RedactedContentNextRecommendation/v1');
    expect(content).toContain('wave4c2RedactedContentMigrationMilestoneCreated=true');
    expect(content).toContain('redactedDerivedContentMigrationMilestoneRecorded=true');
    expect(content).toContain('migratedRedactedContentSurfacesExplicit=true');
    expect(content).toContain('blockedRawContentSurfacesExplicit=true');
    expect(content).toContain('Wave 4B.3: medium/high-risk dry-run executables');
    expect(content).toContain('Wave 4C.3: raw content migration planning');
    expect(content).toContain('Wave 4B.3 message-send dry-run executable selection follow-up:');
    expect(content).toContain('docs/230-wave-4b3-message-send-dry-run-executable-selection.md');
    expect(content).toContain('Do not advance beyond `230`');
    MIGRATED.concat(BLOCKED).forEach((dataClass) => expect(content).toContain(dataClass));
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the 228 handoff for 229', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/229-wave-4c2-redacted-session-content-migration-milestone-report.md');
    expect(read(PAUSE_DOC)).toContain('`229` closes Wave 4C.2');
    expect(read(PRIOR_DOC)).toContain('Wave 4C.2 redacted session content migration milestone follow-up:');
    expect(read(PRIOR_DOC)).toContain('docs/229-wave-4c2-redacted-session-content-migration-milestone-report.md');
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond `229`');
    expect(read(PRIOR_TEST)).toContain('docs/229-wave-4c2-redacted-session-content-migration-milestone-report.md');
  });

  it('exports the Wave 4C.2 milestone report boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4C2RedactedSessionContentMigrationMilestoneReport/v1');
    expect(boundary).toContain('ZavorthWave4C2RedactedContentMigratedItem/v1');
    expect(boundary).toContain('ZavorthWave4C2RedactedContentBlockedItem/v1');
    expect(boundary).toContain('ZavorthWave4C2RedactedContentMilestoneGate');
    expect(index).toContain("from './ZavorthWave4C2RedactedSessionContentMigrationMilestoneReport.js'");
    expect(index).toContain('ZAVORTH_WAVE4C2_REDACTED_CONTENT_MIGRATION_MILESTONE_REPORT_RUNTIME_ID');
  });

  it('lists migrated redacted/derived content items with evidence from 226/227/228', () => {
    const report = createZavorthWave4C2RedactedSessionContentMigrationMilestoneReportFixture();

    expect(report.normalization.decision).toBe('wave4c2-redacted-content-migration-milestone-recorded');
    expect(report.migratedDataClasses()).toEqual(MIGRATED);
    report.normalization.migratedItems.forEach((item) => {
      expect(['migrated-redacted-native', 'migrated-derived-native']).toContain(item.classification);
      expect(item.evidenceGates).toEqual(['226', '227', '228']);
      expect(item.readinessPackPrepared).toBe(true);
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

  it('keeps raw content, SQLite, attachments, secrets, and mutable state blocked', () => {
    const report = createZavorthWave4C2RedactedSessionContentMigrationMilestoneReportFixture();

    expect(report.blockedDataClasses()).toEqual(BLOCKED);
    report.normalization.blockedItems.forEach((item) => {
      expect(item.classification).toBe('blocked');
      expect(item.migrationAllowed).toBe(false);
      expect(item.futureWaveRequired).toBe(true);
      expect(item.evidenceGates).toEqual(['167', '172', '188', '219', '220', '226', '227', '228']);
      expect(item.rawMessageContentMigrationAllowed).toBe(false);
      expect(item.rawSecretSerialized).toBe(false);
    });
  });

  it('records evidence and recommends the next safe path', () => {
    const report = createZavorthWave4C2RedactedSessionContentMigrationMilestoneReportFixture();

    expect(report.normalization.evidence).toEqual({
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
    });
    expect(report.normalization.surfaceClassifications).toEqual([
      'migrated-redacted-native',
      'migrated-derived-native',
      'migrated-native-partial',
      'blocked',
      'future-wave',
    ]);
    expect(report.normalization.nextRecommendation).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4C2RedactedContentNextRecommendation/v1',
      primaryRecommendation: 'wave-4b3-medium-high-risk-dry-run-executables',
      alternateRecommendation: 'wave-4c3-raw-content-migration-planning-with-explicit-justification',
      highImpactExecutionStillBlocked: true,
      adapterRemovalGlobalAllowed: false,
      rawSecretSerialized: false,
    }));
    expect(report.normalization.nextRecommendation.stillBlocked).toEqual(expect.arrayContaining([
      'raw message content',
      'raw SQLite DB copy',
      'SQLite write',
      'attachments/files/binary payloads',
      'secrets/tokens',
      'provider/tool/command execution',
      'global adapter removal',
    ]));
  });

  it('does not execute new migration or authorize external side effects', () => {
    const report = createZavorthWave4C2RedactedSessionContentMigrationMilestoneReportFixture();
    const serialized = JSON.stringify(report.normalization);

    expect(report.normalization.executionGate).toEqual({
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
    const report = createZavorthWave4C2RedactedSessionContentMigrationMilestoneReportFixture({
      externalExecutorLiveRequiredForMilestone: true,
      newMigrationAttempted: true,
      rawMessageContentMigrationAttempted: true,
      rawSqliteCopyAttempted: true,
      sqliteWriteAttempted: true,
      attachmentsMigrationAttempted: true,
      rawSecretMigrationAttempted: true,
      workspaceLogsCacheRawMigrationAttempted: true,
      executionStateMigrationAttempted: true,
      messageSendAttempted: true,
      providerExecutionAttempted: true,
      commandExecutionAttempted: true,
      toolExecutionAttempted: true,
      sourceModuleCopyAttempted: true,
      adapterRemovalAttempted: true,
      publicExternalExecutorIdentityExposed: true,
      rawSecretSerialized: true,
    });

    expect(report.normalization.decision).toBe('blocked');
    expect(report.normalization.executionGate.rawMessageContentMigrationAllowed).toBe(false);
    expect(report.normalization.executionGate.rawSqliteCopyAllowed).toBe(false);
    expect(report.normalization.executionGate.sqliteWriteAllowed).toBe(false);
    expect(report.normalization.executionGate.attachmentsMigrationAllowed).toBe(false);
    expect(report.normalization.executionGate.messageActuallySent).toBe(false);
    expect(report.normalization.executionGate.providerActuallyExecuted).toBe(false);
    expect(report.normalization.executionGate.commandActuallyExecuted).toBe(false);
    expect(report.normalization.executionGate.toolActuallyExecuted).toBe(false);
  });
});
