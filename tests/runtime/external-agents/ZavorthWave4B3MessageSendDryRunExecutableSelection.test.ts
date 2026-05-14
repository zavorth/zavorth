import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTE_FLAG,
  createZavorthWave4B3MessageSendDryRunExecutableSelectionFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4B3MessageSendDryRunCandidateId,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/230-wave-4b3-message-send-dry-run-executable-selection.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/229-wave-4c2-redacted-session-content-migration-milestone-report.md';
const PRIOR_TEST = 'tests/runtime/external-agents/ZavorthWave4C2RedactedSessionContentMigrationMilestoneReport.test.ts';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4B3MessageSendDryRunExecutableSelection.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const CANDIDATES: ZavorthWave4B3MessageSendDryRunCandidateId[] = [
  'message-send-dry-run-action',
  'transport-target-resolution-dry-run',
  'reply-context-assembly-dry-run',
  'provider-prompt-build-dry-run',
  'command-envelope-build-dry-run',
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

describe('Wave 4B.3 message-send dry-run executable selection', () => {
  it('documents 230 as the Wave 4B.3 dry-run executable selection gate', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `wave4b3-message-send-dry-run-executable-selection-ready`');
    expect(content).toContain('ZavorthWave4B3MessageSendDryRunExecutableSelection.ts');
    expect(content).toContain('ZavorthWave4B3MessageSendDryRunExecutableSelection/v1');
    expect(content).toContain('ZavorthWave4B3MessageSendDryRunCandidate/v1');
    expect(content).toContain('ZavorthWave4B3MessageSendDryRunPolicyApprovalRequirement/v1');
    expect(content).toContain('ZavorthWave4B3MessageSendDryRunReceiptRollbackRequirement/v1');
    expect(content).toContain('wave4b3DryRunExecutableSelectionCreated=true');
    expect(content).toContain('realMessageSendAllowed=false');
    expect(content).toContain('providerRealExecutionAllowed=false');
    expect(content).toContain('toolCommandRealExecutionAllowed=false');
    expect(content).toContain('externalExecutorMutationAllowed=false');
    expect(content).toContain('rawContentUsageAllowed=false');
    expect(content).toContain('ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTE');
    expect(content).toContain('docs/231-wave-4b3-message-send-dry-run-executable.md');
    expect(content).toContain('Wave 4B.3 message-send dry-run executable follow-up:');
    expect(content).toContain('Do not advance beyond `231`');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the Wave 4C.2 milestone handoff for 230', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/230-wave-4b3-message-send-dry-run-executable-selection.md');
    expect(read(PAUSE_DOC)).toContain('`230` opens Wave 4B.3');
    expect(read(PRIOR_DOC)).toContain('Wave 4B.3 message-send dry-run executable selection follow-up:');
    expect(read(PRIOR_DOC)).toContain('docs/230-wave-4b3-message-send-dry-run-executable-selection.md');
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond `230`');
    expect(read(PRIOR_TEST)).toContain('docs/230-wave-4b3-message-send-dry-run-executable-selection.md');
  });

  it('exports the Wave 4B.3 dry-run selection boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4B3MessageSendDryRunExecutableSelection/v1');
    expect(boundary).toContain('ZavorthWave4B3MessageSendDryRunCandidate/v1');
    expect(boundary).toContain('ZavorthWave4B3MessageSendDryRunPolicyApprovalRequirement/v1');
    expect(boundary).toContain('ZavorthWave4B3MessageSendDryRunReceiptRollbackRequirement/v1');
    expect(index).toContain("from './ZavorthWave4B3MessageSendDryRunExecutableSelection.js'");
    expect(index).toContain('ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLE_SELECTION_RUNTIME_ID');
  });

  it('classifies all requested dry-run candidates by risk and selection status', () => {
    const selection = createZavorthWave4B3MessageSendDryRunExecutableSelectionFixture();

    expect(selection.normalization.decision).toBe('wave4b3-message-send-dry-run-executable-selection-ready');
    expect(selection.normalization.candidates.map((row) => row.candidateId)).toEqual(CANDIDATES);
    expect(selection.normalization.candidates.map((row) => row.risk)).toEqual([
      'dry-run-medium',
      'dry-run-medium',
      'dry-run-medium',
      'medium-high-dry-run',
      'medium-high-dry-run',
    ]);
    expect(selection.normalization.candidates.map((row) => row.classification)).toEqual([
      'selected-first-target',
      'second-target-probable',
      'deferred-dry-run',
      'blocked-until-provider-or-command-dry-run-gate',
      'blocked-until-provider-or-command-dry-run-gate',
    ]);
  });

  it('selects message-send dry-run as controllable, idempotent, redacted-content-backed, and dry-run only', () => {
    const selection = createZavorthWave4B3MessageSendDryRunExecutableSelectionFixture();
    const first = selection.selectedTarget();

    expect(first).toEqual(expect.objectContaining({
      candidateId: 'message-send-dry-run-action',
      risk: 'dry-run-medium',
      classification: 'selected-first-target',
      sideEffectLevel: 'dry-run-message-plan-only',
      executionAllowedIn231: true,
      idempotent: true,
      controllable: true,
      dryRunOnly: true,
      usesMigratedSessionMetadata: true,
      usesMigratedChannelTransportMetadata: true,
      usesRedactedDerivedContent: true,
      usesRawContent: false,
      usesZavorthOwnedRegistryOrStorage: true,
      preparesFutureRealSend: true,
      runtimeExternalExecutorRequiredForNativeReadyPaths: false,
      featureFlag: ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTE_FLAG,
      executionDefinedFor231: true,
    }));
    expect(first?.policyApproval.approvalRequirement).toBe('not-required-for-dry-run-only');
    expect(first?.policyApproval.policyPreflightRequired).toBe(true);
    expect(first?.policyApproval.policyRecheckRequired).toBe(true);
    expect(first?.policyApproval.redactedDerivedContentRequired).toBe(true);
    expect(first?.receiptRollback.receiptContract).toBe('ZavorthWave4B3MessageSendDryRunActionReceipt/v1');
    expect(first?.receiptRollback.rollbackRequirement).toBe('dry-run-no-op-receipt');
  });

  it('selects transport target resolution as the second likely dry-run target', () => {
    const selection = createZavorthWave4B3MessageSendDryRunExecutableSelectionFixture();
    const second = selection.secondLikelyTarget();

    expect(second).toEqual(expect.objectContaining({
      candidateId: 'transport-target-resolution-dry-run',
      risk: 'dry-run-medium',
      classification: 'second-target-probable',
      sideEffectLevel: 'dry-run-target-resolution-only',
      executionAllowedIn231: false,
      idempotent: true,
      controllable: true,
      dryRunOnly: true,
      usesMigratedSessionMetadata: true,
      usesMigratedChannelTransportMetadata: true,
      usesRawContent: false,
      runtimeExternalExecutorRequiredForNativeReadyPaths: false,
    }));
  });

  it('uses migrated metadata and redacted/derived content in the selected 231 scope', () => {
    const selection = createZavorthWave4B3MessageSendDryRunExecutableSelectionFixture();

    expect(selection.normalization.selectionSummary).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4B3MessageSendDryRunSelectionSummary/v1',
      selectedFirstTarget: 'message-send-dry-run-action',
      secondLikelyTarget: 'transport-target-resolution-dry-run',
      nextGateCandidate: '231-wave-4b3-message-send-dry-run-executable',
      featureFlagRequired: ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTE_FLAG,
      policyPreflightRequired: true,
      policyRecheckRequired: true,
      approvalRequirement: 'not-required-for-dry-run-only',
      receiptContract: 'ZavorthWave4B3MessageSendDryRunActionReceipt/v1',
      rollbackRequirement: 'dry-run-no-op-receipt',
      migratedSessionChannelTransportMetadataUsed: true,
      redactedDerivedContentUsed: true,
      rawContentUsageAllowed: false,
      runtimeExternalExecutorRequiredForNativeReadyPaths: false,
      rawSecretSerialized: false,
    }));
    expect(selection.normalization.selectionSummary.executionPermittedIn231).toEqual(expect.arrayContaining([
      'load migrated session/channel/transport metadata',
      'load redacted/derived content views',
      'build Zavorth-owned message-send dry-run plan',
      'run policy preflight and recheck',
      'emit redacted dry-run audit receipt',
    ]));
  });

  it('keeps real message send, provider/tool execution, ExternalExecutor mutation, raw content, and adapter removal blocked', () => {
    const selection = createZavorthWave4B3MessageSendDryRunExecutableSelectionFixture();

    selection.normalization.candidates.forEach((row) => {
      expect(row.realMessageSendAllowed).toBe(false);
      expect(row.providerRealExecutionAllowed).toBe(false);
      expect(row.toolCommandRealExecutionAllowed).toBe(false);
      expect(row.externalExecutorMutationAllowed).toBe(false);
      expect(row.rawContentUsageAllowed).toBe(false);
      expect(row.usesRawContent).toBe(false);
      expect(row.sourceCapabilityIsEvidenceOnly).toBe(true);
      expect(row.sourceModuleCopied).toBe(false);
      expect(row.adapterRemovalGlobalAllowed).toBe(false);
    });
    expect(selection.blockedCandidates().map((row) => row.candidateId)).toEqual([
      'provider-prompt-build-dry-run',
      'command-envelope-build-dry-run',
    ]);
  });

  it('defines policy, approval escalation, receipt, audit, rollback, and feature flag requirements', () => {
    const selection = createZavorthWave4B3MessageSendDryRunExecutableSelectionFixture();

    expect(selection.normalization.selectionSummary.executionProhibitedIn231).toEqual(expect.arrayContaining([
      'real message send',
      'transport open or invocation',
      'real provider execution',
      'real tool/command execution',
      'ExternalExecutor mutation',
      'raw content access',
      'raw secret serialization',
    ]));
    selection.normalization.candidates.forEach((row) => {
      expect(row.policyApproval.policyPreflightRequired).toBe(true);
      expect(row.policyApproval.policyRecheckRequired).toBe(true);
      expect(row.policyApproval.exactTargetSessionChannelScopeRequired).toBe(true);
      expect(row.policyApproval.ttlRequired).toBe(true);
      expect(row.policyApproval.idempotencyKeyRequired).toBe(true);
      expect(row.receiptRollback.auditReceiptRequired).toBe(true);
      expect(row.receiptRollback.redactionRequired).toBe(true);
    });
  });

  it('blocks selection if live send, provider/tool execution, raw content, ExternalExecutor mutation, or unsafe state is attempted', () => {
    expect(createZavorthWave4B3MessageSendDryRunExecutableSelectionFixture({
      realMessageSendAttempted: true,
    }).normalization.decision).toBe('blocked');
    expect(createZavorthWave4B3MessageSendDryRunExecutableSelectionFixture({
      providerRealExecutionAttempted: true,
    }).normalization.decision).toBe('blocked');
    expect(createZavorthWave4B3MessageSendDryRunExecutableSelectionFixture({
      toolCommandRealExecutionAttempted: true,
    }).normalization.decision).toBe('blocked');
    expect(createZavorthWave4B3MessageSendDryRunExecutableSelectionFixture({
      externalExecutorMutationAttempted: true,
    }).normalization.decision).toBe('blocked');
    expect(createZavorthWave4B3MessageSendDryRunExecutableSelectionFixture({
      rawContentUsageAttempted: true,
    }).normalization.decision).toBe('blocked');
    expect(createZavorthWave4B3MessageSendDryRunExecutableSelectionFixture({
      sourceModuleCopyAttempted: true,
    }).normalization.decision).toBe('blocked');
  });

  it('keeps required guarantees false and serializes no raw secrets or raw content', () => {
    const selection = createZavorthWave4B3MessageSendDryRunExecutableSelectionFixture();
    const serialized = JSON.stringify(selection.normalization);

    expect(selection.normalization.executionGate).toEqual({
      wave4b3DryRunExecutableSelectionCreated: true,
      realMessageSendAllowed: false,
      providerRealExecutionAllowed: false,
      toolCommandRealExecutionAllowed: false,
      externalExecutorMutationAllowed: false,
      rawContentUsageAllowed: false,
      runtimeExternalExecutorRequiredForNativeReadyPaths: false,
      rawSecretSerialized: false,
      sourceModuleCopied: false,
      adapterRemovalGlobalAllowed: false,
    });
    expect(selection.normalization.sourceReadiness.runtimeExternalExecutorRequiredForNativeReadyPaths).toBe(false);
    expect(selection.normalization.redaction.rawSecretSerialized).toBe(false);
    expect(selection.normalization.redaction.rawMessageContentSerialized).toBe(false);
    assertNoRawSecretOrContent(serialized);
  });
});
