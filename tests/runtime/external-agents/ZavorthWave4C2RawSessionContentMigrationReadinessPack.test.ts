import fs from 'node:fs';
import path from 'node:path';

import {
  createZavorthWave4C2RawSessionContentMigrationReadinessPackFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4C2BlockedContentClass,
  ZavorthWave4C2ReadinessBatchItemClass,
  ZavorthWave4C2SourceInventoryCategory,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/226-wave-4c2-raw-session-content-migration-readiness-pack.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const WAVE4C_MILESTONE_DOC = 'docs/221-wave-4c-session-history-metadata-migration-milestone-report.md';
const WAVE4B2_MILESTONE_DOC = 'docs/225-wave-4b2-medium-risk-executable-capabilities-milestone-report.md';
const WAVE4B2_MILESTONE_TEST = 'tests/runtime/external-agents/ZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReport.test.ts';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4C2RawSessionContentMigrationReadinessPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const INVENTORY_CATEGORIES: ZavorthWave4C2SourceInventoryCategory[] = [
  'sqlite-database-candidate',
  'message-content-table',
  'session-table',
  'thread-table',
  'participant-table',
  'attachment-reference-table',
  'channel-thread-link-table',
];

const FUTURE_BATCH_ITEMS: ZavorthWave4C2ReadinessBatchItemClass[] = [
  'session-content-presence',
  'message-content-hash',
  'message-redacted-excerpt',
  'message-token-count-bucket',
  'participant-count-kind',
  'timestamp-range',
  'channel-linkage-metadata',
];

const BLOCKED_CONTENT: ZavorthWave4C2BlockedContentClass[] = [
  'raw-message-content',
  'raw-sqlite-db-copy',
  'sqlite-write',
  'attachment-binary-payload',
  'raw-secret-token',
  'workspace-log-cache-raw',
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

describe('Wave 4C.2 raw session content migration readiness pack', () => {
  it('documents 226 as a readiness-only pack with no raw content migration', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `wave4c2-raw-session-content-migration-readiness-pack-ready`');
    expect(content).toContain('Decision: `wave4c2-raw-session-content-migration-readiness-pack-ready`');
    expect(content).toContain('ZavorthWave4C2RawSessionContentMigrationReadinessPack.ts');
    expect(content).toContain('ZavorthWave4C2RawSessionContentMigrationReadinessPack/v1');
    expect(content).toContain('ZavorthWave4C2ReadOnlySourceInventoryRow/v1');
    expect(content).toContain('ZavorthWave4C2ContentRedactionPolicyRule/v1');
    expect(content).toContain('ZavorthWave4C2FutureMigrationBatchItem/v1');
    expect(content).toContain('ZavorthWave4C2LoadVerifyParityDesignRow/v1');
    expect(content).toContain('rawContentMigrationPreparedButNotExecuted=true');
    expect(content).toContain('sqliteReadOnlyInventoryOnly=true');
    expect(content).toContain('sqliteWriteAllowed=false');
    expect(content).toContain('rawDbCopyAllowed=false');
    expect(content).toContain('attachmentsMigrationAllowed=false');
    expect(content).toContain('externalExecutorLiveRequired=false');
    expect(content).toContain('adapterRemovalGlobalAllowed=false');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the Wave 4C / 4B.2 handoff for 226', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/226-wave-4c2-raw-session-content-migration-readiness-pack.md');
    expect(read(PAUSE_DOC)).toContain('`226` opens Wave 4C.2');
    expect(read(WAVE4C_MILESTONE_DOC)).toContain('docs/226-wave-4c2-raw-session-content-migration-readiness-pack.md');
    expect(read(WAVE4B2_MILESTONE_DOC)).toContain('226 was opened by explicit gate');
    expect(read(WAVE4B2_MILESTONE_DOC)).toContain('Do not advance beyond `226`');
    expect(read(WAVE4B2_MILESTONE_TEST)).toContain('docs/226-wave-4c2-raw-session-content-migration-readiness-pack.md');
  });

  it('exports the Wave 4C.2 readiness boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4C2RawSessionContentMigrationReadinessPack/v1');
    expect(boundary).toContain('ZavorthWave4C2RedactionEnvelope/v1');
    expect(boundary).toContain('ZavorthWave4C2PackGate');
    expect(index).toContain("from './ZavorthWave4C2RawSessionContentMigrationReadinessPack.js'");
    expect(index).toContain('ZAVORTH_WAVE4C2_RAW_SESSION_CONTENT_MIGRATION_READINESS_PACK_RUNTIME_ID');
  });

  it('keeps Agent A read-only source inventory metadata-only', () => {
    const pack = createZavorthWave4C2RawSessionContentMigrationReadinessPackFixture();

    expect(pack.normalization.decision).toBe('wave4c2-raw-session-content-migration-readiness-pack-ready');
    expect(pack.normalization.readOnlySourceInventory.map((row) => row.sourceCategory)).toEqual(INVENTORY_CATEGORIES);
    pack.normalization.readOnlySourceInventory.forEach((row) => {
      expect(row).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthWave4C2ReadOnlySourceInventoryRow/v1',
        inventoryMode: 'read-only-metadata-only',
        sqliteReadOnlyInventoryOnly: true,
        sqliteOpenedForWrite: false,
        rawDbCopied: false,
        rawContentSerialized: false,
        rawSecretSerialized: false,
        attachmentsSerialized: false,
      }));
      expect(row.safeMetadataAllowed.length).toBeGreaterThan(0);
      expect(row.forbiddenOutput.length).toBeGreaterThan(0);
    });
  });

  it('keeps Agent B redaction policy derived-metadata-only and blocks sensitive content', () => {
    const pack = createZavorthWave4C2RawSessionContentMigrationReadinessPackFixture();

    expect(pack.normalization.redactionPolicy).toHaveLength(7);
    expect(pack.normalization.redactionPolicy.find((rule) => rule.sensitivityClass === 'message-content')).toEqual(expect.objectContaining({
      disposition: 'redacted-excerpt-eligible',
      allowedDerivedOutputs: expect.arrayContaining(['hash', 'count', 'redacted-excerpt', 'summary-metadata']),
      rawContentMigrationAllowed: false,
      rawSecretSerialized: false,
    }));
    expect(pack.normalization.redactionPolicy.find((rule) => rule.sensitivityClass === 'attachment-binary')).toEqual(expect.objectContaining({
      disposition: 'blocked',
      attachmentsMigrationAllowed: false,
      policyDecision: 'blocked',
    }));
    expect(pack.normalization.redactionPolicy.find((rule) => rule.sensitivityClass === 'secret-or-token')).toEqual(expect.objectContaining({
      disposition: 'blocked',
      allowedDerivedOutputs: [],
      rawSecretSerialized: false,
      policyDecision: 'blocked',
    }));
    pack.normalization.redactionPolicy.forEach((rule) => {
      expect(rule.rawContentMigrationAllowed).toBe(false);
      expect(rule.rawSecretSerialized).toBe(false);
      expect(rule.attachmentsMigrationAllowed).toBe(false);
    });
  });

  it('keeps Agent C future batch prepared but never executed', () => {
    const pack = createZavorthWave4C2RawSessionContentMigrationReadinessPackFixture();

    expect(pack.futureBatchItemClasses()).toEqual(FUTURE_BATCH_ITEMS);
    pack.normalization.firstFutureBatchDesign.forEach((item) => {
      expect(item).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthWave4C2FutureMigrationBatchItem/v1',
        schemaVersion: 'zavorth-wave4c2-session-content-metadata/v1',
        featureFlag: 'ZAVORTH_WAVE4C2_CONTENT_METADATA_MIGRATION_WRITE',
        safetyGate: 'future-controlled-write-gate-required',
        batchPrepared: true,
        batchExecuted: false,
        rawContentMigrationPreparedButNotExecuted: true,
      }));
      expect(item.idempotencyKey).toContain(`:${item.itemClass}`);
      expect(item.checksum).toContain(item.itemClass);
      expect(item.rollbackRequirement).toEqual({
        backupManifestRequired: true,
        restoreManifestRequired: true,
        rollbackReceiptRequired: true,
        sourceDbBackupCreatedBy226: false,
        sourceDbRestoreAuthorizedBy226: false,
      });
      expect(item.redactionEnvelope.rawMessageContentSerialized).toBe(false);
      expect(item.redactionEnvelope.rawSecretSerialized).toBe(false);
      expect(item.redactionEnvelope.attachmentContentSerialized).toBe(false);
    });
  });

  it('keeps Agent D load/verify/parity design consumer-shaped and non-live', () => {
    const pack = createZavorthWave4C2RawSessionContentMigrationReadinessPackFixture();

    expect(pack.normalization.loadVerifyParityDesign).toHaveLength(FUTURE_BATCH_ITEMS.length);
    pack.normalization.loadVerifyParityDesign.forEach((row) => {
      expect(row.loadValidation).toEqual(['manifest', 'schema', 'checksum', 'idempotency', 'redaction', 'policy']);
      expect(row.parityTargets).toEqual([
        'native-session-history-registry',
        'read-only-session-bridge',
        'command-center-session-view',
      ]);
      expect(row.acceptedOutcomes).toEqual(['parity-ok', 'parity-partial', 'degraded', 'rejected', 'corrupt']);
      expect(row.rawContentRenderAllowed).toBe(false);
      expect(row.commandCenterConsumesDerivedMetadataOnly).toBe(true);
      expect(row.externalExecutorLiveRequired).toBe(false);
    });
  });

  it('keeps blocked raw content classes explicit', () => {
    const pack = createZavorthWave4C2RawSessionContentMigrationReadinessPackFixture();

    expect(pack.blockedContentClasses()).toEqual(BLOCKED_CONTENT);
    pack.normalization.blockedContent.forEach((row) => {
      expect(row).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthWave4C2BlockedContentRow/v1',
        futureGateRequired: true,
        migrationAllowedBy226: false,
        rawSecretSerialized: false,
      }));
    });
  });

  it('preserves all execution and migration guarantees', () => {
    const pack = createZavorthWave4C2RawSessionContentMigrationReadinessPackFixture();
    const serialized = JSON.stringify(pack.normalization);

    expect(pack.normalization.executionGate).toEqual({
      rawContentMigrationPreparedButNotExecuted: true,
      sqliteReadOnlyInventoryOnly: true,
      sqliteWriteAllowed: false,
      rawDbCopyAllowed: false,
      rawSecretSerialized: false,
      attachmentsMigrationAllowed: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      externalExecutorLiveRequired: false,
      adapterRemovalGlobalAllowed: false,
      migrationActuallyExecutedBy226: false,
    });
    expect(pack.normalization.redaction).toEqual({
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      rawSqlitePayloadSerialized: false,
      attachmentContentSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    assertNoRawSecretOrContent(serialized);
  });

  it('blocks readiness if migration, SQLite write/copy, secret serialization, ExternalExecutor live, or execution is attempted', () => {
    const pack = createZavorthWave4C2RawSessionContentMigrationReadinessPackFixture({
      externalExecutorLiveRequired: true,
      migrationExecutionAttempted: true,
      rawContentMigrationAttempted: true,
      sqliteWriteAttempted: true,
      rawDbCopyAttempted: true,
      rawSecretSerializationAttempted: true,
      rawSecretSerialized: true,
      attachmentsMigrationAttempted: true,
      messageSendAttempted: true,
      providerExecutionAttempted: true,
      commandExecutionAttempted: true,
      toolExecutionAttempted: true,
      sourceModuleCopyAttempted: true,
      adapterRemovalAttempted: true,
      publicExternalExecutorIdentityExposed: true,
    });

    expect(pack.normalization.decision).toBe('blocked');
    expect(pack.normalization.executionGate.sqliteWriteAllowed).toBe(false);
    expect(pack.normalization.executionGate.rawDbCopyAllowed).toBe(false);
    expect(pack.normalization.executionGate.rawSecretSerialized).toBe(false);
    expect(pack.normalization.executionGate.attachmentsMigrationAllowed).toBe(false);
    expect(pack.normalization.executionGate.messageActuallySent).toBe(false);
    expect(pack.normalization.executionGate.providerActuallyExecuted).toBe(false);
    expect(pack.normalization.executionGate.commandActuallyExecuted).toBe(false);
    expect(pack.normalization.executionGate.toolActuallyExecuted).toBe(false);
    expect(pack.normalization.executionGate.externalExecutorLiveRequired).toBe(false);
    expect(pack.normalization.executionGate.adapterRemovalGlobalAllowed).toBe(false);
  });

  it('records evidence from all four subagent lines and prior gates', () => {
    const pack = createZavorthWave4C2RawSessionContentMigrationReadinessPackFixture();

    expect(pack.normalization.evidence).toEqual({
      nativeContract: 'ZavorthWave4C2PackEvidence/v1',
      sourceInventoryByAgentA: true,
      redactionPolicyByAgentB: true,
      migrationBatchDesignByAgentC: true,
      loadVerifyParityDesignByAgentD: true,
      wave4cMetadataMigrationBy218To221: true,
      wave4b2MediumRiskMilestoneBy225: true,
      sessionRegistryBy188: true,
      sessionReadOnlyBridgeBy172: true,
      sqliteDryRunDesignBy167: true,
      configStateReadinessBy162To166: true,
      externalExecutorLiveRequired: false,
      rawSecretSerialized: false,
    });
    expect(pack.normalization.nextGateRecommended).toBe(
      'future-wave-4c2-first-controlled-derived-session-content-metadata-batch-by-explicit-follow-up-only',
    );
  });
});
