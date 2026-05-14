import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_SCHEMA_VERSION,
  createZavorthWave4CControlledSessionHistoryMigrationPlanFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4CSessionHistoryBlockedClass,
  ZavorthWave4CSessionHistoryMigratableClass,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/218-wave-4c-controlled-session-history-migration-plan.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/217-wave-4b-low-risk-executable-capabilities-milestone-report.md';
const PRIOR_TEST = 'tests/runtime/external-agents/ZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReport.test.ts';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4CControlledSessionHistoryMigrationPlan.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const MIGRATABLE: ZavorthWave4CSessionHistoryMigratableClass[] = [
  'session-metadata',
  'thread-metadata',
  'redacted-message-metadata',
  'channel-transport-linkage',
  'redacted-participant-metadata',
  'timestamps-status',
];

const BLOCKED: ZavorthWave4CSessionHistoryBlockedClass[] = [
  'raw-message-content',
  'raw-sqlite-db-copy',
  'sqlite-write',
  'attachments-files',
  'secrets-tokens',
  'workspace-logs-cache-raw',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function assertNoRawSecret(serialized: string): void {
  expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  expect(serialized).not.toMatch(/(^|[^A-Za-z])sk-[A-Za-z0-9_-]{8,}/);
  expect(serialized).not.toMatch(/ghp_[A-Za-z0-9_]{8,}/);
  expect(serialized).not.toMatch(/xox[baprs]-[A-Za-z0-9-]{8,}/);
  expect(serialized).not.toContain('synthetic-raw-credential-sentinel-that-must-not-appear');
  expect(serialized).not.toContain('<redacted-local-secret>');
}

describe('Wave 4C controlled session/history migration plan', () => {
  it('documents 218 as a plan-only controlled session/history migration gate', () => {
    const content = read(DOC);

    expect(content).toContain('Status: wave4c-controlled-session-history-migration-plan-ready');
    expect(content).toContain('ZavorthWave4CControlledSessionHistoryMigrationPlan.ts');
    expect(content).toContain('ZavorthWave4CControlledSessionHistoryMigrationPlan/v1');
    expect(content).toContain('ZavorthWave4CSessionHistoryMigrationPlanItem/v1');
    expect(content).toContain('ZavorthWave4CSessionHistoryBlockedItem/v1');
    expect(content).toContain('ZavorthWave4CSessionHistoryFirstBatch/v1');
    expect(content).toContain('wave4cControlledSessionHistoryMigrationPlanCreated=true');
    expect(content).toContain('sessionHistoryMigrationScopeMetadataOnly=true');
    MIGRATABLE.forEach((dataClass) => expect(content).toContain(dataClass));
    [
      'raw message content',
      'raw SQLite DB copy',
      'SQLite write',
      'attachments/files',
      'secrets/tokens',
      'logs/cache/workspace bruto',
    ].forEach((label) => expect(content).toContain(label));
    expect(content).toContain('prepared: true');
    expect(content).toContain('executed: false');
    expect(content).toContain('First controlled session/history metadata migration batch follow-up:');
    expect(content).toContain('docs/219-wave-4c-first-controlled-session-history-metadata-migration-batch.md');
    expect(content).toContain('Do not advance beyond the first controlled Wave 4C session/history metadata batch');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the 217 handoff for 218', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/218-wave-4c-controlled-session-history-migration-plan.md');
    expect(read(PAUSE_DOC)).toContain('`218` opens Wave 4C');
    expect(read(PRIOR_DOC)).toContain('Wave 4C controlled session/history migration plan follow-up:');
    expect(read(PRIOR_DOC)).toContain('docs/218-wave-4c-controlled-session-history-migration-plan.md');
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond the Wave 4C controlled session/history migration plan');
    expect(read(PRIOR_TEST)).toContain('docs/218-wave-4c-controlled-session-history-migration-plan.md');
  });

  it('exports the Wave 4C session/history migration plan boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4CControlledSessionHistoryMigrationPlan/v1');
    expect(boundary).toContain('ZavorthWave4CSessionHistoryMigrationPlanItem/v1');
    expect(boundary).toContain('ZavorthWave4CSessionHistoryMigrationPlanGate');
    expect(index).toContain("from './ZavorthWave4CControlledSessionHistoryMigrationPlan.js'");
    expect(index).toContain('ZAVORTH_WAVE4C_CONTROLLED_SESSION_HISTORY_MIGRATION_PLAN_RUNTIME_ID');
  });

  it('plans only redacted session/history metadata with target/schema/idempotency/redaction/checksum/rollback', () => {
    const plan = createZavorthWave4CControlledSessionHistoryMigrationPlanFixture();

    expect(plan.normalization.decision).toBe('wave4c-controlled-session-history-migration-plan-ready');
    expect(plan.migratableDataClasses()).toEqual(MIGRATABLE);
    plan.normalization.migratableItems.forEach((item) => {
      expect(item).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthWave4CSessionHistoryMigrationPlanItem/v1',
        schemaVersion: ZAVORTH_WAVE4C_SESSION_HISTORY_METADATA_SCHEMA_VERSION,
        eligibility: 'eligible-for-first-controlled-metadata-batch',
        policyDecision: 'allow-session-history-metadata-plan',
        batchPrepared: true,
        batchExecuted: false,
        runtimeExternalExecutorRequiredForPlanning: false,
        rawSecretSerialized: false,
      }));
      expect(item.sourceInventoryItem).toContain(item.dataClass);
      expect(item.targetZavorthStorage).toMatch(/^Zavorth/);
      expect(item.idempotencyKey).toBe(`wave4c:session-history-metadata:v1:${item.dataClass}`);
      expect(item.checksum).toContain(item.dataClass);
      expect(item.redactionEnvelope).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthWave4CSessionHistoryRedactionEnvelope/v1',
        rawMessageContentSerialized: false,
        rawSecretSerialized: false,
        rawSqlitePayloadSerialized: false,
        attachmentContentSerialized: false,
        sourceIdentityPublic: false,
        provenanceInternalOnly: true,
        safeMetadataOnly: true,
      }));
      expect(item.redactionEnvelope.forbiddenFields).toEqual(expect.arrayContaining([
        'rawMessageContent',
        'rawSecretValue',
        'sqlitePayload',
        'attachmentBody',
      ]));
      expect(item.backupRollback).toEqual({
        backupManifestRequired: true,
        restoreManifestRequired: true,
        rollbackReceiptRequired: true,
        sourceDbBackupCreatedBy218: false,
        sourceDbRestoreAuthorizedBy218: false,
      });
    });
  });

  it('keeps raw content, attachments, SQLite, secrets, and workspace/log/cache raw data blocked', () => {
    const plan = createZavorthWave4CControlledSessionHistoryMigrationPlanFixture();

    expect(plan.blockedDataClasses()).toEqual(BLOCKED);
    plan.normalization.blockedItems.forEach((item) => {
      expect(item).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthWave4CSessionHistoryBlockedItem/v1',
        migrationAllowed: false,
        futureGateRequired: true,
        policyDecision: 'blocked',
        rawSecretSerialized: false,
      }));
    });
  });

  it('prepares but does not execute the first controlled session/history metadata batch', () => {
    const plan = createZavorthWave4CControlledSessionHistoryMigrationPlanFixture();

    expect(plan.normalization.firstBatch).toEqual({
      nativeContract: 'ZavorthWave4CSessionHistoryFirstBatch/v1',
      batchId: 'wave4c-session-history-metadata-batch-001',
      prepared: true,
      executed: false,
      itemIds: MIGRATABLE,
      migrationScopeMetadataOnly: true,
      runtimeExternalExecutorRequiredForBatch: false,
      rawSecretSerialized: false,
    });
  });

  it('records evidence from 167/172/188, Wave 4A, Wave 4B, and 162-166 readiness', () => {
    const plan = createZavorthWave4CControlledSessionHistoryMigrationPlanFixture();

    expect(plan.normalization.evidence).toEqual({
      nativeContract: 'ZavorthWave4CSessionHistoryMigrationPlanEvidence/v1',
      sqliteSessionStoreDryRunDesignBy167: true,
      sessionHistoryReadOnlyBridgeBy172: true,
      nativeSessionHistoryRegistryBy188: true,
      wave4aMigrationBy209To212: true,
      wave4bLowRiskExecutablesBy213To217: true,
      configStateReadinessBy162To166: true,
      runtimeExternalExecutorRequiredForPlan: false,
      rawSecretSerialized: false,
    });
  });

  it('keeps ExternalExecutor, real migration, raw SQLite, message send, execution, adapter removal, and raw secrets blocked', () => {
    const plan = createZavorthWave4CControlledSessionHistoryMigrationPlanFixture();
    const serialized = JSON.stringify(plan.normalization);

    expect(plan.normalization.executionGate).toEqual({
      wave4cControlledSessionHistoryMigrationPlanCreated: true,
      sessionHistoryMigrationScopeMetadataOnly: true,
      rawMessageContentMigrationAllowed: false,
      rawSqliteCopyAllowed: false,
      sqliteWriteAllowed: false,
      attachmentsMigrationAllowed: false,
      rawSecretMigrationAllowed: false,
      workspaceLogsCacheRawMigrationAllowed: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      sourceModuleCopied: false,
      adapterRemovalGlobalAllowed: false,
      rawSecretSerialized: false,
      migrationActuallyExecutedBy218: false,
    });
    expect(plan.normalization.redaction).toEqual({
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      rawSqlitePayloadSerialized: false,
      attachmentContentSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
    });
    assertNoRawSecret(serialized);
  });

  it('blocks the plan when sensitive migration or execution attempts are present', () => {
    const plan = createZavorthWave4CControlledSessionHistoryMigrationPlanFixture({
      migrationExecutionAttempted: true,
      rawMessageContentMigrationAttempted: true,
      rawSqliteCopyAttempted: true,
      sqliteWriteAttempted: true,
      attachmentsMigrationAttempted: true,
      rawSecretMigrationAttempted: true,
      workspaceLogsCacheRawMigrationAttempted: true,
      messageSendAttempted: true,
      providerExecutionAttempted: true,
      commandExecutionAttempted: true,
      toolExecutionAttempted: true,
    });

    expect(plan.normalization.decision).toBe('blocked');
    expect(plan.normalization.executionGate.rawMessageContentMigrationAllowed).toBe(false);
    expect(plan.normalization.executionGate.rawSqliteCopyAllowed).toBe(false);
    expect(plan.normalization.executionGate.sqliteWriteAllowed).toBe(false);
    expect(plan.normalization.executionGate.messageActuallySent).toBe(false);
    expect(plan.normalization.executionGate.providerActuallyExecuted).toBe(false);
    expect(plan.normalization.executionGate.commandActuallyExecuted).toBe(false);
    expect(plan.normalization.executionGate.toolActuallyExecuted).toBe(false);
  });
});
