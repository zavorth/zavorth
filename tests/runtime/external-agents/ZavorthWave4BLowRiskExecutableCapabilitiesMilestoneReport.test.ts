import fs from 'node:fs';
import path from 'node:path';

import {
  createZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReportFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4BBlockedExecutableCapabilityId,
  ZavorthWave4BLowRiskExecutableCapabilityId,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/217-wave-4b-low-risk-executable-capabilities-milestone-report.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/216-wave-4b-low-risk-production-snapshot-verify-repair-executable.md';
const PRIOR_TEST = 'tests/runtime/external-agents/ZavorthWave4BLowRiskProductionSnapshotVerifyRepairExecutable.test.ts';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReport.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const ABSORBED: ZavorthWave4BLowRiskExecutableCapabilityId[] = [
  'metadata-validation-action',
  'native-registry-reconciliation-commit-action',
  'production-snapshot-verify-repair-action',
];

const BLOCKED: ZavorthWave4BBlockedExecutableCapabilityId[] = [
  'real-message-send',
  'provider-execution',
  'tool-command-execution',
  'external-executor-mutation',
  'sqlite-session-history-raw-migration',
  'workspace-log-cache-raw-migration',
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

describe('Wave 4B low-risk executable capabilities milestone report', () => {
  it('documents 217 as the Wave 4B low-risk executable milestone report', () => {
    const content = read(DOC);

    expect(content).toContain('Status: wave4b-low-risk-executable-capabilities-milestone-recorded');
    expect(content).toContain('ZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReport.ts');
    expect(content).toContain('ZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReport/v1');
    expect(content).toContain('ZavorthWave4BLowRiskExecutableMilestoneCapability/v1');
    expect(content).toContain('ZavorthWave4BBlockedExecutableCapability/v1');
    expect(content).toContain('wave4bLowRiskExecutableMilestoneCreated=true');
    expect(content).toContain('lowRiskExecutablesAbsorbedAsZavorthOwned=true');
    expect(content).toContain('highImpactExecutionStillBlocked=true');
    ABSORBED.forEach((capability) => expect(content).toContain(capability));
    [
      'real message send',
      'provider execution',
      'tool/command execution',
      'ExternalExecutor mutation',
      'SQLite/session history raw migration',
      'workspace/log/cache raw migration',
    ].forEach((capability) => expect(content).toContain(capability));
    expect(content).toContain('Wave 4B.2: medium-risk executable capabilities');
    expect(content).toContain('Wave 4C: controlled session/history migration');
    expect(content).toContain('Wave 4C controlled session/history migration plan follow-up:');
    expect(content).toContain('docs/218-wave-4c-controlled-session-history-migration-plan.md');
    expect(content).toContain('Do not advance beyond the Wave 4C controlled session/history migration plan');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the 216 handoff for 217', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/217-wave-4b-low-risk-executable-capabilities-milestone-report.md');
    expect(read(PAUSE_DOC)).toContain('`217` is the Wave 4B low-risk executable capabilities milestone report');
    expect(read(PRIOR_DOC)).toContain('Wave 4B low-risk executable capabilities milestone follow-up:');
    expect(read(PRIOR_DOC)).toContain('docs/217-wave-4b-low-risk-executable-capabilities-milestone-report.md');
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond the Wave 4B low-risk executable capabilities milestone');
    expect(read(PRIOR_TEST)).toContain('docs/217-wave-4b-low-risk-executable-capabilities-milestone-report.md');
  });

  it('exports the Wave 4B low-risk executable milestone boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReport/v1');
    expect(boundary).toContain('ZavorthWave4BLowRiskExecutableMilestoneCapability/v1');
    expect(boundary).toContain('ZavorthWave4BLowRiskExecutableMilestoneGate');
    expect(index).toContain("from './ZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReport.js'");
    expect(index).toContain('ZAVORTH_WAVE4B_LOW_RISK_EXECUTABLE_CAPABILITIES_MILESTONE_REPORT_RUNTIME_ID');
  });

  it('lists the three absorbed low-risk executable capabilities with full evidence', () => {
    const report = createZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReportFixture();

    expect(report.normalization.decision).toBe('wave4b-low-risk-executable-capabilities-milestone-recorded');
    expect(report.absorbedCapabilityIds()).toEqual(ABSORBED);
    report.normalization.absorbedCapabilities.forEach((capability) => {
      expect(capability).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthWave4BLowRiskExecutableMilestoneCapability/v1',
        classification: 'absorbed-low-risk-executable',
        ownership: 'Zavorth-owned',
        risk: 'low-risk',
        idempotent: true,
        storageNativeRegistryScoped: true,
        runtimeExternalExecutorRequired: false,
        externalSideEffects: false,
        safetyGate: 'feature-flag',
        policyRecheckRequired: true,
        rollbackCleanupEvidence: true,
        redactionScanPassed: true,
        highImpactExecutionBlocked: true,
        rawSecretSerialized: false,
      }));
      expect(capability.featureFlag).toMatch(/^ZAVORTH_WAVE4B_/);
      expect(capability.receiptContract).toContain('/v1');
      expect(capability.tests).toHaveLength(1);
      expect(capability.evidenceGates).toEqual(expect.arrayContaining(['213']));
    });
  });

  it('keeps high-impact executable capabilities blocked explicitly', () => {
    const report = createZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReportFixture();

    expect(report.blockedCapabilityIds()).toEqual(BLOCKED);
    report.normalization.blockedCapabilities.forEach((capability) => {
      expect(capability).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthWave4BBlockedExecutableCapability/v1',
        classification: 'blocked',
        futureGateRequired: true,
        highImpactExecutionStillBlocked: true,
        runtimeExternalExecutorRequiredForLowRiskExecutables: false,
        rawSecretSerialized: false,
      }));
    });
  });

  it('records milestone evidence and next-step recommendation', () => {
    const report = createZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReportFixture();

    expect(report.normalization.evidence).toEqual({
      nativeContract: 'ZavorthWave4BLowRiskExecutableMilestoneEvidence/v1',
      selectionBy213: true,
      metadataValidationBy214: true,
      reconciliationCommitBy215: true,
      productionSnapshotVerifyRepairBy216: true,
      actionGovernancePipelineReady: true,
      nativeRegistriesReady: true,
      wave4aMigrationReady: true,
      wave3AbsorptionHardeningReady: true,
      receiptsAuditReady: true,
      rollbackCleanupVerified: true,
      redactionScansPassed: true,
      runtimeExternalExecutorRequiredForMilestone: false,
      rawSecretSerialized: false,
    });
    expect(report.normalization.nextRecommendation).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4BLowRiskExecutableNextRecommendation/v1',
      primaryRecommendation: 'wave-4b.2-medium-risk-executable-capabilities',
      alternateRecommendation: 'wave-4c-controlled-session-history-migration',
      highImpactExecutionStillBlocked: true,
      adapterRemovalGlobalAllowed: false,
      rawSecretSerialized: false,
    }));
    expect(report.normalization.nextRecommendation.stillBlocked).toEqual(BLOCKED);
  });

  it('does not perform a new execution and keeps ExternalExecutor and high-impact paths blocked', () => {
    const report = createZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReportFixture();
    const serialized = JSON.stringify(report.normalization);

    expect(report.normalization.executionGate).toEqual({
      wave4bLowRiskExecutableMilestoneCreated: true,
      lowRiskExecutablesAbsorbedAsZavorthOwned: true,
      highImpactExecutionStillBlocked: true,
      messageSendRealAllowed: false,
      providerExecutionRealAllowed: false,
      toolCommandExecutionRealAllowed: false,
      externalExecutorMutationAllowed: false,
      runtimeExternalExecutorRequiredForLowRiskExecutables: false,
      stateMigrated: false,
      sourceModuleCopied: false,
      adapterRemovalGlobalAllowed: false,
      rawSecretSerialized: false,
      newExecutableCapabilityExecutedByReport: false,
    });
    expect(report.normalization.sourceReadiness.externalExecutorLiveRequiredForMilestone).toBe(false);
    expect(report.normalization.sourceReadiness.newCapabilityExecutionAttempted).toBe(false);
    expect(report.normalization.redaction).toEqual({
      rawSecretSerialized: false,
      rawMessageContentSerialized: false,
      sourceIdentityPublic: false,
      provenanceInternalOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    });
    assertNoRawSecret(serialized);
  });

  it('blocks the milestone if a new execution, ExternalExecutor touch, or high-impact path is attempted', () => {
    const report = createZavorthWave4BLowRiskExecutableCapabilitiesMilestoneReportFixture({
      newCapabilityExecutionAttempted: true,
      externalExecutorLiveRequiredForMilestone: true,
      messageSendAttempted: true,
      providerExecutionAttempted: true,
      toolCommandExecutionAttempted: true,
      externalExecutorMutationAttempted: true,
    });

    expect(report.normalization.decision).toBe('blocked');
    expect(report.normalization.executionGate.messageSendRealAllowed).toBe(false);
    expect(report.normalization.executionGate.providerExecutionRealAllowed).toBe(false);
    expect(report.normalization.executionGate.toolCommandExecutionRealAllowed).toBe(false);
    expect(report.normalization.executionGate.externalExecutorMutationAllowed).toBe(false);
    expect(report.normalization.executionGate.newExecutableCapabilityExecutedByReport).toBe(false);
  });
});
