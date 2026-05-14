import fs from 'node:fs';
import path from 'node:path';

import {
  createZavorthWave4AControlledMetadataMigrationMilestoneReportFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4AMilestoneDataClass,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/212-wave-4a-controlled-metadata-migration-milestone-report.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/211-wave-4a-migrated-metadata-batch-load-verify-parity.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4AControlledMetadataMigrationMilestoneReport.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const MIGRATED: ZavorthWave4AMilestoneDataClass[] = [
  'registry-metadata',
  'capability-metadata',
  'provider-channel-transport-metadata',
  'secretref-metadata',
  'config-metadata-redacted',
  'plugin-metadata-redacted',
  'backup-rollback-metadata',
];

const BLOCKED: ZavorthWave4AMilestoneDataClass[] = [
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

describe('Wave 4A controlled metadata migration milestone report', () => {
  it('documents 212 as the Wave 4A milestone report', () => {
    const content = read(DOC);

    expect(content).toContain('Status: wave4a-controlled-metadata-migration-milestone-recorded');
    expect(content).toContain('ZavorthWave4AControlledMetadataMigrationMilestoneReport.ts');
    expect(content).toContain('ZavorthWave4AControlledMetadataMigrationMilestoneReport/v1');
    expect(content).toContain('ZavorthWave4AMilestoneMigratedItem/v1');
    expect(content).toContain('ZavorthWave4AMilestoneBlockedItem/v1');
    expect(content).toContain('ZavorthWave4AMilestoneNextRecommendation/v1');
    expect(content).toContain('wave4aMilestoneReportCreated=true');
    expect(content).toContain('metadataConfigRegistryMigrationMilestoneRecorded=true');
    expect(content).toContain('nextWaveRecommendationCreated=true');
    expect(content).toContain('Wave 4B low-risk executable capability selection follow-up:');
    expect(content).toContain('docs/213-wave-4b-low-risk-executable-capability-selection.md');
    expect(content).toContain('Do not advance beyond Wave 4B selection');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the previous load/verify/parity gate for 212', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/212-wave-4a-controlled-metadata-migration-milestone-report.md');
    expect(read(PAUSE_DOC)).toContain('`212` is the Wave 4A controlled metadata migration milestone report');
    expect(read(PRIOR_DOC)).toContain('Wave 4A controlled metadata migration milestone follow-up:');
    expect(read(PRIOR_DOC)).toContain('docs/212-wave-4a-controlled-metadata-migration-milestone-report.md');
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond the Wave 4A milestone report');
  });

  it('exports the Wave 4A milestone report boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4AControlledMetadataMigrationMilestoneReport/v1');
    expect(boundary).toContain('ZavorthWave4AMilestoneMigratedItem/v1');
    expect(boundary).toContain('ZavorthWave4AMilestoneExecutionGate');
    expect(index).toContain("from './ZavorthWave4AControlledMetadataMigrationMilestoneReport.js'");
    expect(index).toContain('ZAVORTH_WAVE4A_CONTROLLED_METADATA_MIGRATION_MILESTONE_REPORT_RUNTIME_ID');
  });

  it('lists migrated metadata/config/registry items with evidence from 209/210/211', () => {
    const report = createZavorthWave4AControlledMetadataMigrationMilestoneReportFixture();

    expect(report.normalization.decision).toBe('wave4a-controlled-metadata-migration-milestone-recorded');
    expect(report.migratedDataClasses()).toEqual(MIGRATED);
    report.normalization.migratedItems.forEach((item) => {
      expect(item.classification).toBe('migrated-native');
      expect(item.evidenceGates).toEqual(['209', '210', '211']);
      expect(item.batchPrepared).toBe(true);
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
      expect(item.rawSecretSerialized).toBe(false);
    });
  });

  it('lists dangerous blocked data classes explicitly', () => {
    const report = createZavorthWave4AControlledMetadataMigrationMilestoneReportFixture();

    expect(report.blockedDataClasses()).toEqual(BLOCKED);
    report.normalization.blockedItems.forEach((item) => {
      expect(item.classification).toBe('blocked');
      expect(item.migrationAllowed).toBe(false);
      expect(item.futureWaveRequired).toBe(true);
      expect(item.evidenceGates).toEqual(['162', '163', '164', '165', '166', '209', '210', '211']);
      expect(item.rawSecretSerialized).toBe(false);
    });
  });

  it('records existing native surfaces that did not need migration', () => {
    const report = createZavorthWave4AControlledMetadataMigrationMilestoneReportFixture();

    expect(report.normalization.existingNativeSurfaces.map((surface) => surface.surfaceId)).toEqual([
      'dashboard-command-center-view-models',
      'native-registry-lookup-render',
      'partial-adapter-decommission',
      'public-product-hardening',
      'refresh-reconciliation-policy',
    ]);
    report.normalization.existingNativeSurfaces.forEach((surface) => {
      expect(surface.classification).toBe('native-existing-no-migration-needed');
      expect(surface.runtimeExternalExecutorRequiredForDefaultPath).toBe(false);
      expect(surface.adapterDefaultPath).toBe(false);
      expect(surface.rawSecretSerialized).toBe(false);
    });
  });

  it('records milestone evidence and recommends the next wave', () => {
    const report = createZavorthWave4AControlledMetadataMigrationMilestoneReportFixture();

    expect(report.normalization.evidence).toEqual({
      nativeContract: 'ZavorthWave4AMilestoneEvidence/v1',
      batchPreparedBy209: true,
      batchExecutedUnderFlagBy210: true,
      loadVerifyParityBy211: true,
      commandCenterPlannerPolicyObservabilityConsumptionProven: true,
      rollbackCleanupVerified: true,
      redactionScanPassed: true,
      externalExecutorLiveRequiredForMilestone: false,
      rawSecretSerialized: false,
    });
    expect(report.normalization.nextRecommendation).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4AMilestoneNextRecommendation/v1',
      primaryRecommendation: 'wave-4b-low-risk-executable-capabilities',
      fallbackRecommendation: 'additional-metadata-batch-only-if-concrete-gap-found',
      adapterRemovalGlobalAllowed: false,
      rawSecretSerialized: false,
    }));
    expect(report.normalization.nextRecommendation.stillBlocked).toEqual(expect.arrayContaining([
      'raw secrets',
      'message content',
      'real SQLite',
      'mutable execution state',
      'global adapter removal',
    ]));
  });

  it('keeps ExternalExecutor optional and blocks new migration/execution side effects', () => {
    const report = createZavorthWave4AControlledMetadataMigrationMilestoneReportFixture();
    const serialized = JSON.stringify(report.normalization);

    expect(report.normalization.executionGate).toEqual({
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
    });
    expect(report.normalization.sourceReadiness.externalExecutorLiveRequiredForMilestone).toBe(false);
    expect(report.normalization.sourceReadiness.newMigrationAttempted).toBe(false);
    expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(serialized).not.toContain('<redacted-local-secret>');
  });
});
