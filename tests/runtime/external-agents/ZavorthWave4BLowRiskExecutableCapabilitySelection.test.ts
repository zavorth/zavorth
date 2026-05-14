import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4B_METADATA_VALIDATION_EXECUTE_FLAG,
  createZavorthWave4BLowRiskExecutableCapabilitySelectionFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4BLowRiskExecutableCandidateId,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/213-wave-4b-low-risk-executable-capability-selection.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/212-wave-4a-controlled-metadata-migration-milestone-report.md';
const PRIOR_TEST = 'tests/runtime/external-agents/ZavorthWave4AControlledMetadataMigrationMilestoneReport.test.ts';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4BLowRiskExecutableCapabilitySelection.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const CANDIDATES: ZavorthWave4BLowRiskExecutableCandidateId[] = [
  'native-registry-refresh-commit',
  'capability-classification-reclassification',
  'metadata-validation-action',
  'production-snapshot-verify-action',
  'controlled-refresh-reconciliation-commit',
  'read-only-external-status-health-refresh',
  'message-send-dry-run-only',
  'provider-dry-run-only',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Wave 4B low-risk executable capability selection', () => {
  it('documents 213 as the Wave 4B low-risk executable selection gate', () => {
    const content = read(DOC);

    expect(content).toContain('Status: wave4b-low-risk-executable-selection-ready');
    expect(content).toContain('ZavorthWave4BLowRiskExecutableCapabilitySelection.ts');
    expect(content).toContain('ZavorthWave4BLowRiskExecutableCapabilitySelection/v1');
    expect(content).toContain('ZavorthWave4BLowRiskExecutableCandidate/v1');
    expect(content).toContain('ZavorthWave4BPolicyApprovalRequirement/v1');
    expect(content).toContain('ZavorthWave4BReceiptRollbackRequirement/v1');
    expect(content).toContain('wave4bLowRiskExecutableSelectionCreated=true');
    expect(content).toContain('highImpactExecutionBlocked=true');
    expect(content).toContain('messageSendRealAllowed=false');
    expect(content).toContain('providerExecutionRealAllowed=false');
    expect(content).toContain('toolCommandExecutionRealAllowed=false');
    expect(content).toContain('externalExecutorMutationAllowed=false');
    expect(content).toContain('Wave 4B first low-risk executable follow-up:');
    expect(content).toContain('docs/214-wave-4b-first-low-risk-metadata-validation-executable.md');
    expect(content).toContain('Do not advance beyond the first low-risk metadata validation executable');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the Wave 4A milestone handoff for 213', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/213-wave-4b-low-risk-executable-capability-selection.md');
    expect(read(PAUSE_DOC)).toContain('`213` opens Wave 4B');
    expect(read(PRIOR_DOC)).toContain('Wave 4B low-risk executable capability selection follow-up:');
    expect(read(PRIOR_DOC)).toContain('docs/213-wave-4b-low-risk-executable-capability-selection.md');
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond Wave 4B selection');
    expect(read(PRIOR_TEST)).toContain('docs/213-wave-4b-low-risk-executable-capability-selection.md');
  });

  it('exports the Wave 4B selection boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4BLowRiskExecutableCapabilitySelection/v1');
    expect(boundary).toContain('ZavorthWave4BLowRiskExecutableCandidate/v1');
    expect(boundary).toContain('ZavorthWave4BPolicyApprovalRequirement/v1');
    expect(boundary).toContain('ZavorthWave4BReceiptRollbackRequirement/v1');
    expect(index).toContain("from './ZavorthWave4BLowRiskExecutableCapabilitySelection.js'");
    expect(index).toContain('ZAVORTH_WAVE4B_LOW_RISK_EXECUTABLE_CAPABILITY_SELECTION_RUNTIME_ID');
  });

  it('classifies all requested candidates by risk and selection status', () => {
    const selection = createZavorthWave4BLowRiskExecutableCapabilitySelectionFixture();

    expect(selection.normalization.decision).toBe('wave4b-low-risk-executable-selection-ready');
    expect(selection.normalization.candidates.map((row) => row.candidateId)).toEqual(CANDIDATES);
    expect(selection.normalization.candidates.map((row) => row.risk)).toEqual([
      'medium',
      'medium',
      'low',
      'low',
      'medium',
      'medium',
      'high',
      'high',
    ]);
    expect(selection.normalization.candidates.map((row) => row.classification)).toEqual([
      'deferred-stateful-commit',
      'deferred-stateful-commit',
      'selected-first-target',
      'second-target-probable',
      'deferred-stateful-commit',
      'deferred-external-executor-optional',
      'deferred-dry-run-only',
      'deferred-dry-run-only',
    ]);
  });

  it('selects metadata validation as low-risk, idempotent, and Zavorth-owned', () => {
    const selection = createZavorthWave4BLowRiskExecutableCapabilitySelectionFixture();
    const first = selection.selectedTarget();

    expect(first).toEqual(expect.objectContaining({
      candidateId: 'metadata-validation-action',
      risk: 'low',
      classification: 'selected-first-target',
      sideEffectLevel: 'receipt-only',
      executionAllowedInFutureGate: true,
      idempotent: true,
      usesZavorthOwnedRegistryOrStorage: true,
      reducesExternalExecutorDependency: true,
      runtimeExternalExecutorRequiredForDefaultPath: false,
      featureFlag: ZAVORTH_WAVE4B_METADATA_VALIDATION_EXECUTE_FLAG,
    }));
    expect(first?.policyApproval.approvalRequirement).toBe('not-required-for-idempotent-readonly-validation');
    expect(first?.policyApproval.policyPreflightRequired).toBe(true);
    expect(first?.policyApproval.idempotencyKeyRequired).toBe(true);
    expect(first?.receiptRollback.receiptContract).toBe('ZavorthWave4BLowRiskExecutableActionReceipt/v1');
    expect(first?.receiptRollback.rollbackRequirement).toBe('no-op-validation-receipt');
  });

  it('selects production snapshot verify as the second likely target', () => {
    const selection = createZavorthWave4BLowRiskExecutableCapabilitySelectionFixture();
    const second = selection.secondLikelyTarget();

    expect(second).toEqual(expect.objectContaining({
      candidateId: 'production-snapshot-verify-action',
      risk: 'low',
      classification: 'second-target-probable',
      sideEffectLevel: 'none',
      executionAllowedInFutureGate: true,
      idempotent: true,
      usesZavorthOwnedRegistryOrStorage: true,
      runtimeExternalExecutorRequiredForDefaultPath: false,
    }));
    expect(second?.policyApproval.approvalRequirement).toBe('not-required-for-idempotent-readonly-validation');
    expect(second?.receiptRollback.rollbackRequirement).toBe('no-op-validation-receipt');
  });

  it('keeps message send, provider execution, tool/command execution, and ExternalExecutor mutation blocked', () => {
    const selection = createZavorthWave4BLowRiskExecutableCapabilitySelectionFixture();

    selection.normalization.candidates.forEach((row) => {
      expect(row.messageSendRealAllowed).toBe(false);
      expect(row.providerExecutionRealAllowed).toBe(false);
      expect(row.toolCommandExecutionRealAllowed).toBe(false);
      expect(row.externalExecutorMutationAllowed).toBe(false);
      expect(row.sourceCapabilityIsEvidenceOnly).toBe(true);
      expect(row.sourceModuleCopied).toBe(false);
      expect(row.adapterRemovalGlobalAllowed).toBe(false);
    });

    expect(selection.highImpactBlockedCandidates().map((row) => row.candidateId)).toEqual([
      'message-send-dry-run-only',
      'provider-dry-run-only',
    ]);
    expect(selection.highImpactBlockedCandidates().every((row) => row.executionAllowedInFutureGate === false)).toBe(true);
  });

  it('defines policy, approval escalation, receipt, audit, rollback, and feature flag requirements', () => {
    const selection = createZavorthWave4BLowRiskExecutableCapabilitySelectionFixture();

    expect(selection.normalization.selectionSummary).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4BLowRiskExecutableSelectionSummary/v1',
      selectedFirstTarget: 'metadata-validation-action',
      secondLikelyTarget: 'production-snapshot-verify-action',
      featureFlagRequired: ZAVORTH_WAVE4B_METADATA_VALIDATION_EXECUTE_FLAG,
      nextGateCandidate: '214-wave-4b-first-controlled-metadata-validation-action',
      externalExecutorRuntimeRequiredForDefaultPath: false,
      rawSecretSerialized: false,
    }));
    expect(selection.normalization.selectionSummary.executionPermitted).toEqual(expect.arrayContaining([
      'validate Zavorth-owned migrated metadata',
      'emit redacted audit receipt',
      'record no-op rollback/compensation metadata',
    ]));
    expect(selection.normalization.selectionSummary.executionProhibited).toEqual(expect.arrayContaining([
      'real message send',
      'real provider execution',
      'real tool/command execution',
      'ExternalExecutor mutation',
      'raw secret serialization',
    ]));
    selection.normalization.candidates.forEach((row) => {
      expect(row.policyApproval.policyPreflightRequired).toBe(true);
      expect(row.policyApproval.exactScopeRequired).toBe(true);
      expect(row.policyApproval.ttlRequired).toBe(true);
      expect(row.policyApproval.idempotencyKeyRequired).toBe(true);
      expect(row.receiptRollback.auditReceiptRequired).toBe(true);
      expect(row.receiptRollback.redactionRequired).toBe(true);
    });
  });

  it('blocks the selection if high-impact execution or unsafe state changes are attempted', () => {
    expect(createZavorthWave4BLowRiskExecutableCapabilitySelectionFixture({
      messageSendAttempted: true,
    }).normalization.decision).toBe('blocked');
    expect(createZavorthWave4BLowRiskExecutableCapabilitySelectionFixture({
      providerExecutionAttempted: true,
    }).normalization.decision).toBe('blocked');
    expect(createZavorthWave4BLowRiskExecutableCapabilitySelectionFixture({
      toolCommandExecutionAttempted: true,
    }).normalization.decision).toBe('blocked');
    expect(createZavorthWave4BLowRiskExecutableCapabilitySelectionFixture({
      externalExecutorMutationAttempted: true,
    }).normalization.decision).toBe('blocked');
    expect(createZavorthWave4BLowRiskExecutableCapabilitySelectionFixture({
      stateMigrationAttempted: true,
    }).normalization.decision).toBe('blocked');
  });

  it('keeps required guarantees false for high-impact execution, migration, source copy, and raw secrets', () => {
    const selection = createZavorthWave4BLowRiskExecutableCapabilitySelectionFixture();
    const serialized = JSON.stringify(selection.normalization);

    expect(selection.normalization.executionGate).toEqual({
      wave4bLowRiskExecutableSelectionCreated: true,
      highImpactExecutionBlocked: true,
      messageSendRealAllowed: false,
      providerExecutionRealAllowed: false,
      toolCommandExecutionRealAllowed: false,
      externalExecutorMutationAllowed: false,
      rawSecretSerialized: false,
      stateMigrated: false,
      sourceModuleCopied: false,
      adapterRemovalGlobalAllowed: false,
    });
    expect(selection.normalization.sourceReadiness.defaultPathRequiresExternalExecutor).toBe(false);
    expect(selection.normalization.redaction.rawSecretSerialized).toBe(false);
    expect(selection.normalization.redaction.rawMessageContentSerialized).toBe(false);
    expect(serialized).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
    expect(serialized).not.toContain('<redacted-local-secret>');
  });
});
