import fs from 'node:fs';
import path from 'node:path';

import {
  createZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReportFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4B2BlockedExecutableCapabilityId,
  ZavorthWave4B2MediumRiskExecutableCapabilityId,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/225-wave-4b2-medium-risk-executable-capabilities-milestone-report.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/224-wave-4b2-transport-readiness-check-executable.md';
const PRIOR_TEST = 'tests/runtime/external-agents/ZavorthWave4B2TransportReadinessCheckExecutable.test.ts';
const NEXT_DOC = 'docs/226-wave-4c2-raw-session-content-migration-readiness-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReport.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const ABSORBED: ZavorthWave4B2MediumRiskExecutableCapabilityId[] = [
  'target-session-channel-validation-action',
  'transport-readiness-check-action',
];

const BLOCKED: ZavorthWave4B2BlockedExecutableCapabilityId[] = [
  'real-message-send',
  'transport-open-mutable',
  'provider-execution',
  'tool-command-execution',
  'external-executor-mutation',
  'raw-history-sqlite-migration',
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
  expect(serialized).not.toContain('raw user message body that must never migrate');
}

describe('Wave 4B.2 medium-risk executable capabilities milestone report', () => {
  it('documents 225 as the Wave 4B.2 medium-risk executable milestone report', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `wave4b2-medium-risk-executable-capabilities-milestone-recorded`');
    expect(content).toContain('ZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReport.ts');
    expect(content).toContain('ZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReport/v1');
    expect(content).toContain('ZavorthWave4B2MediumRiskExecutableMilestoneCapability/v1');
    expect(content).toContain('ZavorthWave4B2BlockedExecutableCapability/v1');
    expect(content).toContain('wave4b2MediumRiskExecutableMilestoneCreated=true');
    expect(content).toContain('mediumRiskExecutablesAbsorbedAsZavorthOwned=true');
    expect(content).toContain('highImpactExecutionStillBlocked=true');
    ABSORBED.forEach((capability) => expect(content).toContain(capability));
    [
      'real message send',
      'mutable transport open',
      'provider execution',
      'tool/command execution',
      'ExternalExecutor mutation',
      'raw history/SQLite migration',
    ].forEach((capability) => expect(content).toContain(capability));
    expect(content).toContain('Wave 4B.3: transport readiness follow-up by explicit gate');
    expect(content).toContain('Wave 4C.2: raw history/SQLite planning by explicit gate');
    expect(content).toContain('226 was opened by explicit gate');
    expect(content).toContain(NEXT_DOC);
    expect(content).toContain('Do not advance beyond `226`');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the 224 handoff for 225', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/225-wave-4b2-medium-risk-executable-capabilities-milestone-report.md');
    expect(read(PAUSE_DOC)).toContain('`225` closes Wave 4B.2');
    expect(read(PRIOR_DOC)).toContain('Wave 4B.2 medium-risk executable capabilities milestone follow-up:');
    expect(read(PRIOR_DOC)).toContain('docs/225-wave-4b2-medium-risk-executable-capabilities-milestone-report.md');
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond `225`');
    expect(read(PRIOR_TEST)).toContain('docs/225-wave-4b2-medium-risk-executable-capabilities-milestone-report.md');
  });

  it('exports the Wave 4B.2 medium-risk executable milestone boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReport/v1');
    expect(boundary).toContain('ZavorthWave4B2MediumRiskExecutableMilestoneCapability/v1');
    expect(boundary).toContain('ZavorthWave4B2MediumRiskExecutableMilestoneGate');
    expect(index).toContain("from './ZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReport.js'");
    expect(index).toContain('ZAVORTH_WAVE4B2_MEDIUM_RISK_EXECUTABLE_CAPABILITIES_MILESTONE_REPORT_RUNTIME_ID');
  });

  it('lists the two absorbed medium-risk executable capabilities with full evidence', () => {
    const report = createZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReportFixture();

    expect(report.normalization.decision).toBe('wave4b2-medium-risk-executable-capabilities-milestone-recorded');
    expect(report.absorbedCapabilityIds()).toEqual(ABSORBED);
    report.normalization.absorbedCapabilities.forEach((capability) => {
      expect(capability).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthWave4B2MediumRiskExecutableMilestoneCapability/v1',
        classification: 'absorbed-medium-risk-executable',
        ownership: 'Zavorth-owned',
        risk: 'medium-risk',
        idempotent: true,
        runtimeExternalExecutorRequired: false,
        externalSideEffects: false,
        externalExecutorTouched: false,
        safetyGate: 'feature-flag',
        policyRecheckRequired: true,
        approvalRequired: false,
        auditReceiptSupported: true,
        rollbackCleanupEvidence: true,
        redactionScanPassed: true,
        highImpactExecutionBlocked: true,
        messageActuallySent: false,
        providerActuallyExecuted: false,
        toolCommandActuallyExecuted: false,
        transportActuallyOpened: false,
        rawSecretSerialized: false,
      }));
      expect(capability.featureFlag).toMatch(/^ZAVORTH_WAVE4B2_/);
      expect(capability.receiptContract).toContain('/v1');
      expect(capability.tests).toHaveLength(1);
      expect(capability.evidenceGates).toEqual(expect.arrayContaining(['222']));
    });
  });

  it('keeps high-impact and external side-effect capabilities blocked explicitly', () => {
    const report = createZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReportFixture();

    expect(report.blockedCapabilityIds()).toEqual(BLOCKED);
    report.normalization.blockedCapabilities.forEach((capability) => {
      expect(capability).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthWave4B2BlockedExecutableCapability/v1',
        classification: 'blocked',
        futureGateRequired: true,
        highImpactExecutionStillBlocked: true,
        runtimeExternalExecutorRequiredForMediumRiskExecutables: false,
        rawSecretSerialized: false,
      }));
    });
  });

  it('records milestone evidence and next-step recommendation', () => {
    const report = createZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReportFixture();

    expect(report.normalization.evidence).toEqual({
      nativeContract: 'ZavorthWave4B2MediumRiskExecutableMilestoneEvidence/v1',
      selectionBy222: true,
      targetSessionChannelValidationBy223: true,
      transportReadinessCheckBy224: true,
      lowRiskExecutableMilestoneBy217: true,
      wave4cSessionHistoryMetadataMigrationBy218To221: true,
      actionGovernancePipelineReady: true,
      featureFlagsSafetyGatesReady: true,
      policyRechecksReady: true,
      idempotencyVerified: true,
      receiptsAuditReady: true,
      rollbackCleanupVerified: true,
      redactionScansPassed: true,
      runtimeExternalExecutorRequiredForMilestone: false,
      rawMessageContentSerialized: false,
      rawSecretSerialized: false,
    });
    expect(report.normalization.nextRecommendation).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4B2MediumRiskExecutableNextRecommendation/v1',
      primaryRecommendation: 'wave-4b.3-transport-readiness-follow-up-by-explicit-gate',
      alternateRecommendation: 'wave-4c.2-raw-history-sqlite-planning-by-explicit-gate',
      highImpactExecutionStillBlocked: true,
      adapterRemovalGlobalAllowed: false,
      rawSecretSerialized: false,
    }));
    expect(report.normalization.nextRecommendation.stillBlocked).toEqual(BLOCKED);
  });

  it('does not perform a new execution and keeps ExternalExecutor and high-impact paths blocked', () => {
    const report = createZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReportFixture();
    const serialized = JSON.stringify(report.normalization);

    expect(report.normalization.executionGate).toEqual({
      wave4b2MediumRiskExecutableMilestoneCreated: true,
      mediumRiskExecutablesAbsorbedAsZavorthOwned: true,
      highImpactExecutionStillBlocked: true,
      realMessageSendAllowed: false,
      providerExecutionRealAllowed: false,
      toolCommandExecutionRealAllowed: false,
      mutableTransportOpenAllowed: false,
      externalExecutorMutationAllowed: false,
      runtimeExternalExecutorRequiredForMediumRiskExecutables: false,
      rawHistoryMigrationAllowed: false,
      rawSqliteMigrationAllowed: false,
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

  it('blocks the milestone if a new execution, ExternalExecutor touch, side-effect path, or raw migration is attempted', () => {
    const report = createZavorthWave4B2MediumRiskExecutableCapabilitiesMilestoneReportFixture({
      newCapabilityExecutionAttempted: true,
      externalExecutorLiveRequiredForMilestone: true,
      messageSendAttempted: true,
      transportOpenAttempted: true,
      providerExecutionAttempted: true,
      toolCommandExecutionAttempted: true,
      externalExecutorMutationAttempted: true,
      rawHistoryMigrationAttempted: true,
      rawSqliteMigrationAttempted: true,
    });

    expect(report.normalization.decision).toBe('blocked');
    expect(report.normalization.executionGate.realMessageSendAllowed).toBe(false);
    expect(report.normalization.executionGate.mutableTransportOpenAllowed).toBe(false);
    expect(report.normalization.executionGate.providerExecutionRealAllowed).toBe(false);
    expect(report.normalization.executionGate.toolCommandExecutionRealAllowed).toBe(false);
    expect(report.normalization.executionGate.externalExecutorMutationAllowed).toBe(false);
    expect(report.normalization.executionGate.newExecutableCapabilityExecutedByReport).toBe(false);
  });
});
