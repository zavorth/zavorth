import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4A_METADATA_MIGRATION_SCHEMA_VERSION,
  createZavorthWave4AControlledMetadataConfigRegistryMigrationPlanFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4AMigrationDataClass,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/209-wave-4a-controlled-metadata-config-registry-migration-plan.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/208-wave-3-native-absorption-regression-release-hardening-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4AControlledMetadataConfigRegistryMigrationPlan.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const ELIGIBLE_CLASSES: ZavorthWave4AMigrationDataClass[] = [
  'registry-metadata',
  'capability-metadata',
  'provider-channel-transport-metadata',
  'secretref-metadata',
  'config-metadata-redacted',
  'plugin-metadata-redacted',
  'backup-rollback-metadata',
];

const BLOCKED_CLASSES: ZavorthWave4AMigrationDataClass[] = [
  'raw-secrets',
  'message-content',
  'sqlite-real',
  'session-history-raw',
  'workspace-files',
  'logs-raw',
  'cache-raw',
  'execution-state-mutable',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Wave 4A controlled metadata/config/registry migration plan', () => {
  it('documents 209 as the Wave 4A controlled migration plan without execution', () => {
    const content = read(DOC);

    expect(content).toContain('Status: wave4a-controlled-migration-plan-ready');
    expect(content).toContain('ZavorthWave4AControlledMetadataConfigRegistryMigrationPlan.ts');
    expect(content).toContain('ZavorthWave4AControlledMetadataConfigRegistryMigrationPlan/v1');
    expect(content).toContain('ZavorthWave4AMigrationPlanItem/v1');
    expect(content).toContain('ZavorthWave4AControlledMigrationBatch/v1');
    expect(content).toContain(ZAVORTH_WAVE4A_METADATA_MIGRATION_SCHEMA_VERSION);
    expect(content).toContain('wave4aControlledMigrationPlanCreated=true');
    expect(content).toContain('migrationScopeMetadataConfigRegistryOnly=true');
    expect(content).toContain('rawSecretMigrationAllowed=false');
    expect(content).toContain('first batch executed: false');
    expect(content).toContain('First controlled metadata/config/registry migration batch follow-up:');
    expect(content).toContain('docs/210-wave-4a-first-controlled-metadata-config-registry-migration-batch.md');
    expect(content).toContain('Do not advance beyond the first controlled Wave 4A batch');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the previous hardening pack for 209', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/209-wave-4a-controlled-metadata-config-registry-migration-plan.md');
    expect(read(PAUSE_DOC)).toContain('`209` opens Wave 4A');
    expect(read(PRIOR_DOC)).toContain('Wave 4A controlled metadata/config/registry migration plan follow-up:');
    expect(read(PRIOR_DOC)).toContain('docs/209-wave-4a-controlled-metadata-config-registry-migration-plan.md');
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond the Wave 4A migration plan');
  });

  it('exports the Wave 4A migration plan boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4AControlledMetadataConfigRegistryMigrationPlan/v1');
    expect(boundary).toContain('ZavorthWave4AMigrationPlanItem/v1');
    expect(boundary).toContain('ZavorthWave4ABlockedDataClassRow/v1');
    expect(index).toContain("from './ZavorthWave4AControlledMetadataConfigRegistryMigrationPlan.js'");
    expect(index).toContain('ZAVORTH_WAVE4A_METADATA_MIGRATION_SCHEMA_VERSION');
  });

  it('includes only metadata/config/registry-level data as migratable items', () => {
    const plan = createZavorthWave4AControlledMetadataConfigRegistryMigrationPlanFixture();

    expect(plan.normalization.decision).toBe('wave4a-controlled-migration-plan-ready');
    expect(plan.migratableItems().map((item) => item.dataClass)).toEqual(ELIGIBLE_CLASSES);
    plan.migratableItems().forEach((item) => {
      expect(item.target).not.toBe('blocked-no-target');
      expect(item.schemaVersion).toBe(ZAVORTH_WAVE4A_METADATA_MIGRATION_SCHEMA_VERSION);
      expect(item.idempotencyKey).toContain(`wave4a:${item.dataClass}:`);
      expect(item.checksumAlgorithm).toBe('sha256-stable-metadata');
      expect(item.checksum).toHaveLength(64);
      expect(item.redactionEnvelope).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthWave4AMigrationRedactionEnvelope/v1',
        rawSecretSerialized: false,
        rawMessageContentSerialized: false,
        sourceIdentityPublic: false,
        provenanceInternalOnly: true,
        safeMetadataOnly: true,
      }));
      expect(item.redactionEnvelope.forbiddenFields).toEqual(expect.arrayContaining([
        'rawSecretValue',
        'rawMessageContent',
        'sqlitePayload',
        'workspaceFileBody',
        'rawLogLine',
        'rawCacheEntry',
      ]));
      expect(item.backupRollback).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthWave4AMigrationBackupRollback/v1',
        backupManifestRequired: true,
        restoreManifestRequired: true,
        rollbackReceiptRequired: true,
        backupActuallyCreated: false,
        restoreActuallyPerformed: false,
      }));
      expect(item.policyDecision).toBe('allow-metadata-config-registry-only');
      expect(item.migrationActuallyExecuted).toBe(false);
      expect(item.persistentWriteActuallyPerformed).toBe(false);
      expect(item.rawSecretSerialized).toBe(false);
    });
  });

  it('blocks raw secrets, message content, SQLite, workspace, logs, cache, and mutable execution state', () => {
    const plan = createZavorthWave4AControlledMetadataConfigRegistryMigrationPlanFixture();

    expect(plan.normalization.blockedDataClasses.map((row) => row.dataClass)).toEqual(BLOCKED_CLASSES);
    plan.normalization.blockedDataClasses.forEach((row) => {
      expect(row.blocked).toBe(true);
      expect(row.target).toBe('blocked-no-target');
      expect(row.migrationAllowed).toBe(false);
      expect(row.rawSecretSerialized).toBe(false);
    });
    expect(plan.normalization.planItems.map((item) => item.dataClass)).not.toEqual(expect.arrayContaining(BLOCKED_CLASSES));
  });

  it('prepares the first controlled batch but does not execute it', () => {
    const plan = createZavorthWave4AControlledMetadataConfigRegistryMigrationPlanFixture();

    expect(plan.normalization.firstBatch).toEqual({
      nativeContract: 'ZavorthWave4AControlledMigrationBatch/v1',
      batchId: 'wave4a-metadata-config-registry-batch-001',
      prepared: true,
      executed: false,
      itemIds: [
        'registry-metadata',
        'capability-metadata',
        'provider-channel-transport-metadata',
        'secretref-metadata',
        'config-metadata-redacted',
        'plugin-metadata-redacted',
        'backup-rollback-metadata',
      ],
      itemCount: 7,
      requiresFeatureFlagForExecution: true,
      requiresPolicyRecheckBeforeExecution: true,
      requiresRollbackManifestBeforeExecution: true,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      rawSecretSerialized: false,
    });
  });

  it('lets policy block a sensitive item before execution without authorizing migration', () => {
    const plan = createZavorthWave4AControlledMetadataConfigRegistryMigrationPlanFixture({
      policyBlockedDataClasses: ['plugin-metadata-redacted'],
    });

    expect(plan.normalization.decision).toBe('wave4a-controlled-migration-plan-ready');
    expect(plan.policyBlockedItems()).toHaveLength(1);
    expect(plan.lookupItem('plugin-metadata-redacted')).toEqual(expect.objectContaining({
      dataClass: 'plugin-metadata-redacted',
      eligibility: 'policy-blocked',
      policyDecision: 'block-sensitive-item',
      firstBatchIncluded: false,
      migrationActuallyExecuted: false,
      rawSecretSerialized: false,
    }));
    expect(plan.normalization.firstBatch.itemIds).not.toContain('plugin-metadata-redacted');
  });

  it('keeps execution, raw migration, adapter removal, source copy, and raw secret serialization blocked', () => {
    const plan = createZavorthWave4AControlledMetadataConfigRegistryMigrationPlanFixture();
    const serialized = JSON.stringify(plan.normalization);

    expect(plan.normalization.executionGate).toEqual({
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
    });
    expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(serialized).not.toContain('<redacted-local-secret>');
  });
});
