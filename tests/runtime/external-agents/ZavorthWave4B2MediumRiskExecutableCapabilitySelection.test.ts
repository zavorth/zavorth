import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTE_FLAG,
  createZavorthWave4B2MediumRiskExecutableCapabilitySelectionFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4B2MediumRiskExecutableCandidateId,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/222-wave-4b2-medium-risk-executable-capability-selection.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/221-wave-4c-session-history-metadata-migration-milestone-report.md';
const PRIOR_TEST = 'tests/runtime/external-agents/ZavorthWave4CSessionHistoryMetadataMigrationMilestoneReport.test.ts';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4B2MediumRiskExecutableCapabilitySelection.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const CANDIDATES: ZavorthWave4B2MediumRiskExecutableCandidateId[] = [
  'message-send-dry-run-against-real-transport',
  'target-session-channel-validation-action',
  'transport-readiness-check-action',
  'provider-dry-run-schema-validation',
  'tool-dry-run-manifest-validation',
  'command-http-dry-run-envelope-validation',
  'scheduled-refresh-action-with-rollback',
  'channel-capability-refresh-action',
  'session-threading-consistency-check',
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

describe('Wave 4B.2 medium-risk executable capability selection', () => {
  it('documents 222 as the Wave 4B.2 medium-risk executable selection gate', () => {
    const content = read(DOC);

    expect(content).toContain('Status: wave4b2-medium-risk-executable-selection-ready');
    expect(content).toContain('ZavorthWave4B2MediumRiskExecutableCapabilitySelection.ts');
    expect(content).toContain('ZavorthWave4B2MediumRiskExecutableCapabilitySelection/v1');
    expect(content).toContain('ZavorthWave4B2MediumRiskExecutableCandidate/v1');
    expect(content).toContain('ZavorthWave4B2PolicyApprovalRequirement/v1');
    expect(content).toContain('ZavorthWave4B2ReceiptRollbackRequirement/v1');
    expect(content).toContain('wave4b2MediumRiskExecutableSelectionCreated=true');
    expect(content).toContain('mediumRiskExecutionSelectionOnly=true');
    expect(content).toContain('realMessageSendAllowed=false');
    expect(content).toContain('providerRealExecutionAllowed=false');
    expect(content).toContain('toolCommandRealExecutionAllowed=false');
    expect(content).toContain('externalExecutorMutationAllowed=false');
    expect(content).toContain('docs/223-wave-4b2-target-session-channel-validation-executable.md');
    expect(content).toContain('Do not advance beyond `223`');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the Wave 4C milestone handoff for 222', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/222-wave-4b2-medium-risk-executable-capability-selection.md');
    expect(read(PAUSE_DOC)).toContain('`222` opens Wave 4B.2');
    expect(read(PRIOR_DOC)).toContain('Wave 4B.2 medium-risk executable capability selection follow-up:');
    expect(read(PRIOR_DOC)).toContain('docs/222-wave-4b2-medium-risk-executable-capability-selection.md');
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond Wave 4B.2 medium-risk executable selection');
    expect(read(PRIOR_TEST)).toContain('docs/222-wave-4b2-medium-risk-executable-capability-selection.md');
  });

  it('exports the Wave 4B.2 selection boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4B2MediumRiskExecutableCapabilitySelection/v1');
    expect(boundary).toContain('ZavorthWave4B2MediumRiskExecutableCandidate/v1');
    expect(boundary).toContain('ZavorthWave4B2PolicyApprovalRequirement/v1');
    expect(boundary).toContain('ZavorthWave4B2ReceiptRollbackRequirement/v1');
    expect(index).toContain("from './ZavorthWave4B2MediumRiskExecutableCapabilitySelection.js'");
    expect(index).toContain('ZAVORTH_WAVE4B2_MEDIUM_RISK_EXECUTABLE_CAPABILITY_SELECTION_RUNTIME_ID');
  });

  it('classifies all requested medium-risk candidates by risk and selection status', () => {
    const selection = createZavorthWave4B2MediumRiskExecutableCapabilitySelectionFixture();

    expect(selection.normalization.decision).toBe('wave4b2-medium-risk-executable-selection-ready');
    expect(selection.normalization.candidates.map((row) => row.candidateId)).toEqual(CANDIDATES);
    expect(selection.normalization.candidates.map((row) => row.risk)).toEqual([
      'high',
      'medium',
      'medium',
      'medium',
      'medium',
      'medium',
      'medium',
      'medium',
      'medium',
    ]);
    expect(selection.normalization.candidates.map((row) => row.classification)).toEqual([
      'deferred-dry-run-only',
      'selected-first-target',
      'second-target-probable',
      'deferred-approval-required',
      'deferred-approval-required',
      'deferred-approval-required',
      'deferred-approval-required',
      'deferred-approval-required',
      'deferred-approval-required',
    ]);
  });

  it('selects target/session/channel validation as medium-risk, controllable, and metadata-backed', () => {
    const selection = createZavorthWave4B2MediumRiskExecutableCapabilitySelectionFixture();
    const first = selection.selectedTarget();

    expect(first).toEqual(expect.objectContaining({
      candidateId: 'target-session-channel-validation-action',
      risk: 'medium',
      classification: 'selected-first-target',
      sideEffectLevel: 'zavorth-owned-metadata-validation',
      executionAllowedInFutureGate: true,
      idempotent: true,
      controllable: true,
      reversibleOrDryRun: true,
      usesMigratedSessionMetadata: true,
      usesMigratedChannelMetadata: true,
      usesMigratedTargetMetadata: true,
      usesZavorthOwnedRegistryOrStorage: true,
      reducesExternalExecutorDependency: true,
      runtimeExternalExecutorRequiredForNativeReadyPaths: false,
      featureFlag: ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTE_FLAG,
      executionDefinedFor223: true,
    }));
    expect(first?.policyApproval.approvalRequirement).toBe('not-required-for-idempotent-metadata-validation');
    expect(first?.policyApproval.policyPreflightRequired).toBe(true);
    expect(first?.policyApproval.migratedSessionChannelTargetMetadataRequired).toBe(true);
    expect(first?.receiptRollback.receiptContract).toBe('ZavorthWave4B2MediumRiskExecutableActionReceipt/v1');
    expect(first?.receiptRollback.rollbackRequirement).toBe('no-op-validation-receipt');
  });

  it('selects transport readiness check as the second likely target', () => {
    const selection = createZavorthWave4B2MediumRiskExecutableCapabilitySelectionFixture();
    const second = selection.secondLikelyTarget();

    expect(second).toEqual(expect.objectContaining({
      candidateId: 'transport-readiness-check-action',
      risk: 'medium',
      classification: 'second-target-probable',
      sideEffectLevel: 'external-read-only-optional',
      executionAllowedInFutureGate: true,
      idempotent: true,
      controllable: true,
      reversibleOrDryRun: true,
      usesMigratedSessionMetadata: true,
      usesMigratedChannelMetadata: true,
      usesMigratedTargetMetadata: true,
      runtimeExternalExecutorRequiredForNativeReadyPaths: false,
    }));
    expect(second?.policyApproval.approvalRequirement).toBe('approval-required-before-any-external-read-or-commit');
    expect(second?.receiptRollback.rollbackRequirement).toBe('no-op-validation-receipt');
  });

  it('uses migrated target/session/channel metadata in the selected 223 scope', () => {
    const selection = createZavorthWave4B2MediumRiskExecutableCapabilitySelectionFixture();
    const first = selection.selectedTarget();

    expect(selection.normalization.selectionSummary).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4B2MediumRiskExecutableSelectionSummary/v1',
      selectedFirstTarget: 'target-session-channel-validation-action',
      secondLikelyTarget: 'transport-readiness-check-action',
      nextGateCandidate: '223-wave-4b2-target-session-channel-validation-executable',
      featureFlagRequired: ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTE_FLAG,
      policyPreflightRequired: true,
      approvalRequirement: 'not-required-for-idempotent-metadata-validation',
      receiptContract: 'ZavorthWave4B2MediumRiskExecutableActionReceipt/v1',
      rollbackRequirement: 'no-op-validation-receipt',
      migratedSessionChannelTargetMetadataUsed: true,
      runtimeExternalExecutorRequiredForNativeReadyPaths: false,
      rawSecretSerialized: false,
    }));
    expect(first?.usesMigratedSessionMetadata).toBe(true);
    expect(first?.usesMigratedChannelMetadata).toBe(true);
    expect(first?.usesMigratedTargetMetadata).toBe(true);
    expect(selection.normalization.selectionSummary.executionPermittedIn223).toEqual(expect.arrayContaining([
      'validate migrated session metadata',
      'validate migrated channel/transport linkage',
      'validate target/session/thread readiness',
      'emit redacted audit receipt',
    ]));
  });

  it('keeps high-impact message/provider/tool/ExternalExecutor/raw-history paths blocked', () => {
    const selection = createZavorthWave4B2MediumRiskExecutableCapabilitySelectionFixture();

    selection.normalization.candidates.forEach((row) => {
      expect(row.realMessageSendAllowed).toBe(false);
      expect(row.providerRealExecutionAllowed).toBe(false);
      expect(row.toolCommandRealExecutionAllowed).toBe(false);
      expect(row.externalExecutorMutationAllowed).toBe(false);
      expect(row.rawHistoryMigrationAllowed).toBe(false);
      expect(row.rawSqliteMigrationAllowed).toBe(false);
      expect(row.sourceCapabilityIsEvidenceOnly).toBe(true);
      expect(row.sourceModuleCopied).toBe(false);
      expect(row.adapterRemovalGlobalAllowed).toBe(false);
    });

    expect(selection.blockedHighImpactCandidates().map((row) => row.candidateId)).toEqual([
      'message-send-dry-run-against-real-transport',
    ]);
    expect(selection.blockedHighImpactCandidates().every((row) => row.executionAllowedInFutureGate === false)).toBe(true);
  });

  it('defines policy, approval escalation, receipt, audit, rollback, and feature flag requirements', () => {
    const selection = createZavorthWave4B2MediumRiskExecutableCapabilitySelectionFixture();

    expect(selection.normalization.selectionSummary.executionProhibitedIn223).toEqual(expect.arrayContaining([
      'real message send',
      'real provider execution',
      'real tool/command execution',
      'ExternalExecutor mutation',
      'raw history or SQLite migration',
      'raw secret serialization',
    ]));
    selection.normalization.candidates.forEach((row) => {
      expect(row.policyApproval.policyPreflightRequired).toBe(true);
      expect(row.policyApproval.exactScopeRequired).toBe(true);
      expect(row.policyApproval.ttlRequired).toBe(true);
      expect(row.policyApproval.idempotencyKeyRequired).toBe(true);
      expect(row.policyApproval.migratedSessionChannelTargetMetadataRequired).toBe(true);
      expect(row.receiptRollback.auditReceiptRequired).toBe(true);
      expect(row.receiptRollback.redactionRequired).toBe(true);
    });
  });

  it('blocks the selection if high-impact execution, raw migration, or unsafe state changes are attempted', () => {
    expect(createZavorthWave4B2MediumRiskExecutableCapabilitySelectionFixture({
      realMessageSendAttempted: true,
    }).normalization.decision).toBe('blocked');
    expect(createZavorthWave4B2MediumRiskExecutableCapabilitySelectionFixture({
      providerRealExecutionAttempted: true,
    }).normalization.decision).toBe('blocked');
    expect(createZavorthWave4B2MediumRiskExecutableCapabilitySelectionFixture({
      toolCommandRealExecutionAttempted: true,
    }).normalization.decision).toBe('blocked');
    expect(createZavorthWave4B2MediumRiskExecutableCapabilitySelectionFixture({
      externalExecutorMutationAttempted: true,
    }).normalization.decision).toBe('blocked');
    expect(createZavorthWave4B2MediumRiskExecutableCapabilitySelectionFixture({
      rawHistoryMigrationAttempted: true,
    }).normalization.decision).toBe('blocked');
    expect(createZavorthWave4B2MediumRiskExecutableCapabilitySelectionFixture({
      rawSqliteMigrationAttempted: true,
    }).normalization.decision).toBe('blocked');
  });

  it('keeps required guarantees false for high-impact execution, migration, source copy, and raw secrets', () => {
    const selection = createZavorthWave4B2MediumRiskExecutableCapabilitySelectionFixture();
    const serialized = JSON.stringify(selection.normalization);

    expect(selection.normalization.executionGate).toEqual({
      wave4b2MediumRiskExecutableSelectionCreated: true,
      mediumRiskExecutionSelectionOnly: true,
      realMessageSendAllowed: false,
      providerRealExecutionAllowed: false,
      toolCommandRealExecutionAllowed: false,
      externalExecutorMutationAllowed: false,
      rawHistoryMigrationAllowed: false,
      rawSqliteMigrationAllowed: false,
      runtimeExternalExecutorRequiredForNativeReadyPaths: false,
      rawSecretSerialized: false,
      sourceModuleCopied: false,
      adapterRemovalGlobalAllowed: false,
    });
    expect(selection.normalization.sourceReadiness.runtimeExternalExecutorRequiredForNativeReadyPaths).toBe(false);
    expect(selection.normalization.redaction.rawSecretSerialized).toBe(false);
    expect(selection.normalization.redaction.rawMessageContentSerialized).toBe(false);
    assertNoRawSecret(serialized);
  });
});
