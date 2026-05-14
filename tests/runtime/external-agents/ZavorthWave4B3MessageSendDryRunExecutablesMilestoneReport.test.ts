import fs from 'node:fs';
import path from 'node:path';

import {
  createZavorthWave4B3MessageSendDryRunExecutablesMilestoneReportFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4B3MessageSendDryRunBlockedCapabilityId,
  ZavorthWave4B3MessageSendDryRunExecutableCapabilityId,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/233-wave-4b3-message-send-dry-run-executables-milestone-report.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/232-wave-4b3-transport-target-resolution-dry-run-executable.md';
const NEXT_DOC = 'docs/234-wave-4d-real-message-send-readiness-plan.md';
const PRIOR_TEST = 'tests/runtime/external-agents/ZavorthWave4B3TransportTargetResolutionDryRunExecutable.test.ts';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4B3MessageSendDryRunExecutablesMilestoneReport.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const ABSORBED: ZavorthWave4B3MessageSendDryRunExecutableCapabilityId[] = [
  'message-send-dry-run-action',
  'transport-target-resolution-dry-run',
];

const BLOCKED: ZavorthWave4B3MessageSendDryRunBlockedCapabilityId[] = [
  'real-message-send',
  'real-transport-open',
  'provider-execution',
  'tool-command-execution',
  'external-executor-mutation',
  'raw-content-usage',
  'raw-sqlite-history-migration',
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

describe('Wave 4B.3 message-send dry-run executables milestone report', () => {
  it('documents 233 as the Wave 4B.3 message-send dry-run milestone report', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `wave4b3-message-send-dry-run-milestone-recorded`');
    expect(content).toContain('ZavorthWave4B3MessageSendDryRunExecutablesMilestoneReport.ts');
    expect(content).toContain('ZavorthWave4B3MessageSendDryRunExecutablesMilestoneReport/v1');
    expect(content).toContain('ZavorthWave4B3MessageSendDryRunMilestoneCapability/v1');
    expect(content).toContain('ZavorthWave4B3MessageSendDryRunBlockedCapability/v1');
    expect(content).toContain('wave4b3MessageSendDryRunMilestoneCreated=true');
    expect(content).toContain('messageSendDryRunExecutablesAbsorbedAsZavorthOwned=true');
    ABSORBED.forEach((capability) => expect(content).toContain(capability));
    [
      'real message send',
      'real transport open',
      'provider execution',
      'tool/command execution',
      'ExternalExecutor mutation',
      'raw content usage',
      'raw SQLite/history migration',
    ].forEach((capability) => expect(content).toContain(capability));
    expect(content).toContain('Wave 4D: real message send readiness by explicit gate');
    expect(content).toContain('Wave 4C.3: raw content migration planning with explicit justification');
    expect(content).toContain('Wave 4D real message send readiness follow-up:');
    expect(content).toContain(NEXT_DOC);
    expect(content).toContain('Do not advance beyond `234`');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the 232 handoff for 233', () => {
    expect(read(GO_NO_GO_DOC)).toContain(DOC);
    expect(read(PAUSE_DOC)).toContain('`233` closes Wave 4B.3');
    expect(read(PRIOR_DOC)).toContain('Wave 4B.3 message-send dry-run executables milestone follow-up:');
    expect(read(PRIOR_DOC)).toContain(DOC);
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond `233`');
    expect(read(PRIOR_TEST)).toContain(DOC);
  });

  it('exports the Wave 4B.3 milestone boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4B3MessageSendDryRunExecutablesMilestoneReport/v1');
    expect(boundary).toContain('ZavorthWave4B3MessageSendDryRunMilestoneCapability/v1');
    expect(boundary).toContain('ZavorthWave4B3MessageSendDryRunMilestoneGate');
    expect(index).toContain("from './ZavorthWave4B3MessageSendDryRunExecutablesMilestoneReport.js'");
    expect(index).toContain('ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLES_MILESTONE_REPORT_RUNTIME_ID');
  });

  it('lists 231 and 232 as absorbed Zavorth-owned dry-run executables', () => {
    const report = createZavorthWave4B3MessageSendDryRunExecutablesMilestoneReportFixture();

    expect(report.normalization.decision).toBe('wave4b3-message-send-dry-run-milestone-recorded');
    expect(report.absorbedCapabilityIds()).toEqual(ABSORBED);
    report.normalization.absorbedCapabilities.forEach((capability) => {
      expect(capability).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthWave4B3MessageSendDryRunMilestoneCapability/v1',
        classification: 'absorbed-message-send-dry-run-executable',
        ownership: 'Zavorth-owned',
        executableMode: 'dry-run',
        noExternalSideEffects: true,
        usesMigratedNativeMetadata: true,
        usesRedactedDerivedContentOnly: true,
        rawContentUsageAllowed: false,
        runtimeExternalExecutorRequired: false,
        idempotent: true,
        safetyGate: 'feature-flag',
        policyPreflightRequired: true,
        targetSessionChannelTransportResolutionEvidence: true,
        secretRefMetadataOnly: true,
        auditReceiptSupported: true,
        redactionScanPassed: true,
        realMessageSent: false,
        transportActuallyOpened: false,
        providerActuallyExecuted: false,
        toolCommandActuallyExecuted: false,
        externalExecutorMutationAllowed: false,
        sourceModuleCopied: false,
        rawSecretSerialized: false,
      }));
      expect(capability.featureFlag).toMatch(/^ZAVORTH_WAVE4B3_/);
      expect(capability.receiptContract).toContain('/v1');
      expect(capability.tests).toHaveLength(1);
      expect(capability.evidenceGates).toEqual(expect.arrayContaining(['230']));
    });
  });

  it('records feature flag, policy, idempotency, receipt, and redaction evidence for each absorbed capability', () => {
    const report = createZavorthWave4B3MessageSendDryRunExecutablesMilestoneReportFixture();

    expect(report.normalization.absorbedCapabilities[0]).toEqual(expect.objectContaining({
      capabilityId: 'message-send-dry-run-action',
      featureFlag: 'ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTE',
      receiptContract: 'ZavorthWave4B3MessageSendDryRunActionReceipt/v1',
    }));
    expect(report.normalization.absorbedCapabilities[1]).toEqual(expect.objectContaining({
      capabilityId: 'transport-target-resolution-dry-run',
      featureFlag: 'ZAVORTH_WAVE4B3_TRANSPORT_TARGET_RESOLUTION_DRY_RUN_EXECUTE',
      receiptContract: 'ZavorthWave4B3TransportTargetResolutionDryRunReceipt/v1',
    }));
    report.normalization.absorbedCapabilities.forEach((capability) => {
      expect(capability.idempotent).toBe(true);
      expect(capability.policyPreflightRequired).toBe(true);
      expect(capability.secretRefMetadataOnly).toBe(true);
      expect(capability.auditReceiptSupported).toBe(true);
      expect(capability.redactionScanPassed).toBe(true);
    });
  });

  it('keeps high-impact and raw-content capabilities blocked explicitly', () => {
    const report = createZavorthWave4B3MessageSendDryRunExecutablesMilestoneReportFixture();

    expect(report.blockedCapabilityIds()).toEqual(BLOCKED);
    report.normalization.blockedCapabilities.forEach((capability) => {
      expect(capability).toEqual(expect.objectContaining({
        nativeContract: 'ZavorthWave4B3MessageSendDryRunBlockedCapability/v1',
        classification: 'blocked',
        futureGateRequired: true,
        highImpactExecutionStillBlocked: true,
        runtimeExternalExecutorRequiredForDryRunExecutables: false,
        rawSecretSerialized: false,
      }));
    });
  });

  it('records milestone evidence and next-wave recommendation', () => {
    const report = createZavorthWave4B3MessageSendDryRunExecutablesMilestoneReportFixture();

    expect(report.normalization.evidence).toEqual({
      nativeContract: 'ZavorthWave4B3MessageSendDryRunMilestoneEvidence/v1',
      selectionBy230: true,
      messageSendDryRunBy231: true,
      transportTargetResolutionBy232: true,
      wave4b2MediumRiskExecutablesBy222To225: true,
      wave4c2RedactedContentMigrationBy226To229: true,
      messageSendTransportBlockedRehearsalBy182: true,
      transportCapabilityDiscoveryBy183: true,
      actionGovernancePipelineBy174To180: true,
      featureFlagsSafetyGatesReady: true,
      policyPreflightReady: true,
      targetSessionChannelTransportResolutionReady: true,
      redactedDerivedContentOnly: true,
      secretRefMetadataOnly: true,
      idempotencyVerified: true,
      receiptsAuditReady: true,
      redactionScansPassed: true,
      testsPassed: true,
      runtimeExternalExecutorRequiredForMilestone: false,
      rawMessageContentSerialized: false,
      rawSecretSerialized: false,
    });
    expect(report.normalization.nextRecommendation).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4B3MessageSendDryRunNextRecommendation/v1',
      primaryRecommendation: 'wave-4d-real-message-send-readiness-by-explicit-gate',
      alternateRecommendation: 'wave-4c3-raw-content-migration-planning-with-explicit-justification',
      highImpactExecutionStillBlocked: true,
      adapterRemovalGlobalAllowed: false,
      rawSecretSerialized: false,
    }));
    expect(report.normalization.nextRecommendation.stillBlocked).toEqual(BLOCKED);
  });

  it('does not execute a new capability and keeps ExternalExecutor/high-impact paths blocked', () => {
    const report = createZavorthWave4B3MessageSendDryRunExecutablesMilestoneReportFixture();
    const serialized = JSON.stringify(report.normalization);

    expect(report.normalization.executionGate).toEqual({
      wave4b3MessageSendDryRunMilestoneCreated: true,
      messageSendDryRunExecutablesAbsorbedAsZavorthOwned: true,
      realMessageSendAllowed: false,
      transportActuallyOpened: false,
      providerRealExecutionAllowed: false,
      toolCommandRealExecutionAllowed: false,
      externalExecutorMutationAllowed: false,
      rawContentUsageAllowed: false,
      runtimeExternalExecutorRequiredForDryRunExecutables: false,
      rawSecretSerialized: false,
      sourceModuleCopied: false,
      adapterRemovalGlobalAllowed: false,
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
    assertNoRawSecretOrContent(serialized);
  });

  it('blocks the milestone if execution, raw content, ExternalExecutor, transport, or provider/tool paths are attempted', () => {
    const report = createZavorthWave4B3MessageSendDryRunExecutablesMilestoneReportFixture({
      newCapabilityExecutionAttempted: true,
      externalExecutorLiveRequiredForMilestone: true,
      realMessageSendAttempted: true,
      transportOpenAttempted: true,
      providerExecutionAttempted: true,
      toolCommandExecutionAttempted: true,
      externalExecutorMutationAttempted: true,
      rawContentUsageAttempted: true,
      rawSqliteHistoryMigrationAttempted: true,
    });

    expect(report.normalization.decision).toBe('blocked');
    expect(report.normalization.executionGate.realMessageSendAllowed).toBe(false);
    expect(report.normalization.executionGate.transportActuallyOpened).toBe(false);
    expect(report.normalization.executionGate.providerRealExecutionAllowed).toBe(false);
    expect(report.normalization.executionGate.toolCommandRealExecutionAllowed).toBe(false);
    expect(report.normalization.executionGate.externalExecutorMutationAllowed).toBe(false);
    expect(report.normalization.executionGate.rawContentUsageAllowed).toBe(false);
    expect(report.normalization.executionGate.newExecutableCapabilityExecutedByReport).toBe(false);
  });
});
