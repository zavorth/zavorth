import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4D_FINAL_DRY_RUN_AGAINST_APPROVED_TEST_TARGET_RUNTIME_ID,
  ZAVORTH_WAVE4D_FINAL_TEST_TARGET_DRY_RUN_EXECUTE_FLAG,
  createZavorthWave4DFinalDryRunAgainstApprovedTestTargetFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/237-wave-4d-final-dry-run-against-approved-test-target.md';
const NEXT_DOC = 'docs/238-wave-4d-first-controlled-real-message-send.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/236-wave-4d-real-message-send-test-target-provisioning-plan.md';
const PRIOR_TEST = 'tests/runtime/external-agents/ZavorthWave4DRealMessageSendTestTargetProvisioningPlan.test.ts';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4DFinalDryRunAgainstApprovedTestTarget.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

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

describe('Wave 4D final dry-run against approved test target', () => {
  it('documents 237 as the final dry-run gate without send or transport open', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `wave4d-final-dry-run-against-approved-test-target-ready`');
    expect(content).toContain('ZavorthWave4DFinalDryRunAgainstApprovedTestTarget.ts');
    expect(content).toContain('ZavorthWave4DFinalDryRunAgainstApprovedTestTargetReceipt/v1');
    expect(content).toContain('ZavorthWave4DFinalTestTargetDryRunPlan/v1');
    expect(content).toContain(ZAVORTH_WAVE4D_FINAL_TEST_TARGET_DRY_RUN_EXECUTE_FLAG);
    expect(content).toContain('wave4dFinalDryRunAgainstApprovedTestTargetCreated=true');
    expect(content).toContain('finalDryRunActuallyExecutedOnlyWhenFlagEnabled=true');
    expect(content).toContain('readyForLiveApprovalMayBeProduced=true');
    expect(content).toContain('realMessageSendActuallyPerformed=false');
    expect(content).toContain('transportActuallyOpened=false');
    expect(content).toContain('First Controlled Send Follow-Up');
    expect(content).toContain(NEXT_DOC);
    expect(content).toContain('Do not advance beyond `238`');
    assertNoRawSecretOrContent(content);
  });

  it('updates tracking docs and the 236 handoff for 237', () => {
    expect(read(GO_NO_GO_DOC)).toContain(DOC);
    expect(read(PAUSE_DOC)).toContain('`237` executes the final Wave 4D dry-run');
    expect(read(PRIOR_DOC)).toContain('Final Dry-Run Follow-Up');
    expect(read(PRIOR_DOC)).toContain(DOC);
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond `237`');
    expect(read(PRIOR_TEST)).toContain(DOC);
  });

  it('exports the final dry-run boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4DFinalDryRunAgainstApprovedTestTargetReceipt/v1');
    expect(boundary).toContain('ZavorthWave4DFinalTestTargetDryRunPlan/v1');
    expect(boundary).toContain('ZavorthWave4DFinalTestTargetDryRunFeatureFlagGate/v1');
    expect(boundary).toContain('ZavorthWave4DFinalTestTargetDryRunPolicyPreflight/v1');
    expect(index).toContain("from './ZavorthWave4DFinalDryRunAgainstApprovedTestTarget.js'");
    expect(index).toContain('ZAVORTH_WAVE4D_FINAL_DRY_RUN_AGAINST_APPROVED_TEST_TARGET_RUNTIME_ID');
  });

  it('blocks execution when the feature flag is disabled', () => {
    const executable = createZavorthWave4DFinalDryRunAgainstApprovedTestTargetFixture({
      featureFlagEnabled: false,
    });

    expect(executable.receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4DFinalDryRunAgainstApprovedTestTargetReceipt/v1',
      runtimeId: ZAVORTH_WAVE4D_FINAL_DRY_RUN_AGAINST_APPROVED_TEST_TARGET_RUNTIME_ID,
      selectedCapability: 'final-dry-run-against-approved-test-target',
      decision: 'execution-blocked',
      classification: 'execution-blocked',
      finalDryRunActuallyExecuted: false,
      finalDryRunActuallyExecutedOnlyWhenFlagEnabled: true,
      runtimeExternalExecutorRequiredForExecution: false,
    }));
    expect(executable.receipt.validations).toContain('feature-flag-disabled');
    expect(executable.dryRunReadyForLiveApproval()).toBe(false);
    assertNoRawSecretOrContent(JSON.stringify(executable.receipt));
  });

  it('executes the final dry-run and produces ready-for-live-approval when all validations pass', () => {
    const executable = createZavorthWave4DFinalDryRunAgainstApprovedTestTargetFixture({
      featureFlagEnabled: true,
    });

    expect(executable.receipt.decision).toBe('dry-run-ready-for-live-approval');
    expect(executable.dryRunReadyForLiveApproval()).toBe(true);
    expect(executable.messageSendStillBlocked()).toBe(true);
    expect(executable.receipt.validations).toEqual(expect.arrayContaining([
      'target-approved',
      'target-session-channel-transport-validated',
      'secretref-metadata-only',
      'policy-eligible',
      'approval-modeled',
      'idempotency-valid',
      'dry-run-before-live-validated',
      'transport-open-blocked',
      'valid',
    ]));
    expect(executable.receipt.finalSendPlan).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4DFinalTestTargetDryRunPlan/v1',
      mode: 'final-dry-run-only',
      action: 'final-test-target-message-send-dry-run',
      planState: 'ready-for-live-approval',
      targetExplicitlyMarkedTestSandbox: true,
      targetSessionThreadChannelTransportValidated: true,
      secretRefsMetadataResolverReady: true,
      policyPreflightAccepted: true,
      approvalGrantModeledForTestTarget: true,
      dryRunBeforeLiveEvidencePresent: true,
      realTransportOpenBlocked: true,
      externalTransportInvoked: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      toolCommandActuallyExecuted: false,
      externalExecutorTouched: false,
      rawContentUsed: false,
    }));
  });

  it('blocks test targets without explicit test/sandbox approval', () => {
    const executable = createZavorthWave4DFinalDryRunAgainstApprovedTestTargetFixture({
      source: {
        approvedTestTargetMarkedSandbox: false,
      },
    });

    expect(executable.receipt.decision).toBe('target-not-approved');
    expect(executable.receipt.validations).toContain('target-not-approved');
    expect(executable.receipt.finalSendPlan.planState).toBe('blocked');
    expect(executable.receipt.realMessageSendActuallyPerformed).toBe(false);
  });

  it('blocks missing target/session/thread/channel/transport validation as transport-unconfigured', () => {
    const executable = createZavorthWave4DFinalDryRunAgainstApprovedTestTargetFixture({
      source: {
        targetSessionThreadChannelTransportValidated: false,
        transportConfiguredForFutureSend: false,
      },
    });

    expect(executable.receipt.decision).toBe('transport-unconfigured');
    expect(executable.receipt.validations).toContain('transport-unconfigured');
    expect(executable.receipt.finalSendPlan.planState).toBe('blocked');
    expect(executable.receipt.transportActuallyOpened).toBe(false);
  });

  it('blocks missing SecretRef, policy rejection, and missing approval', () => {
    expect(createZavorthWave4DFinalDryRunAgainstApprovedTestTargetFixture({
      source: { secretRefsAvailableAsResolver: false },
    }).receipt.decision).toBe('missing-secretref');
    expect(createZavorthWave4DFinalDryRunAgainstApprovedTestTargetFixture({
      source: { policyPreflightAccepted: false },
    }).receipt.decision).toBe('policy-rejected');
    expect(createZavorthWave4DFinalDryRunAgainstApprovedTestTargetFixture({
      source: { approvalGrantModeledForTestTarget: false },
    }).receipt.decision).toBe('approval-missing');
  });

  it('records policy preflight and source metadata from 236/234/231/232/223/224/174-180/187/188', () => {
    const executable = createZavorthWave4DFinalDryRunAgainstApprovedTestTargetFixture();

    expect(executable.receipt.policyPreflight).toEqual({
      nativeContract: 'ZavorthWave4DFinalTestTargetDryRunPolicyPreflight/v1',
      policyPreflightRequired: true,
      policyRecheckedImmediatelyBeforeExecution: true,
      approvalGrantModeledForDryRun: true,
      approvalRequiredBeforeFutureLiveSend: true,
      messageSendBlockedInThisGate: true,
      providerExecutionBlocked: true,
      toolCommandExecutionBlocked: true,
      externalTransportBlocked: true,
      rawContentBlocked: true,
    });
    expect(executable.receipt.sourceMetadata).toEqual({
      testTargetProvisioningPlanReady: true,
      messageSendDryRunActionReady: true,
      transportTargetResolutionDryRunReady: true,
      targetSessionChannelValidationReady: true,
      transportReadinessCheckReady: true,
      actionGovernancePipelineReady: true,
      nativeRegistriesUsed: true,
      sourceProvenanceInternalRedacted: true,
    });
  });

  it('keeps real send, transport open, execution, ExternalExecutor mutation, raw content, source copy, adapter removal, and raw secrets blocked', () => {
    const executable = createZavorthWave4DFinalDryRunAgainstApprovedTestTargetFixture();
    const serialized = JSON.stringify(executable.receipt);

    expect(executable.receipt).toEqual(expect.objectContaining({
      wave4dFinalDryRunAgainstApprovedTestTargetCreated: true,
      finalDryRunActuallyExecutedOnlyWhenFlagEnabled: true,
      readyForLiveApprovalMayBeProduced: true,
      realMessageSendActuallyPerformed: false,
      transportActuallyOpened: false,
      providerRealExecutionAllowed: false,
      toolCommandRealExecutionAllowed: false,
      externalExecutorMutationAllowed: false,
      rawContentUsageAllowed: false,
      runtimeExternalExecutorRequiredForExecution: false,
      rawSecretSerialized: false,
      sourceModuleCopied: false,
      adapterRemovalGlobalAllowed: false,
    }));
    assertNoRawSecretOrContent(serialized);
  });

  it('blocks the dry-run if real send, transport open, execution, mutation, raw content, migration, source copy, adapter removal, or raw secret paths are attempted', () => {
    const executable = createZavorthWave4DFinalDryRunAgainstApprovedTestTargetFixture({
      source: {
        externalExecutorTouched: true,
        realMessageSendAttempted: true,
        transportOpenAttempted: true,
        providerRealExecutionAttempted: true,
        toolCommandRealExecutionAttempted: true,
        externalExecutorMutationAttempted: true,
        rawContentUsageAttempted: true,
        newStateMigrationAttempted: true,
        rawSecretSerialized: true,
        sourceModuleCopyAttempted: true,
        adapterRemovalAttempted: true,
        publicExternalExecutorIdentityExposed: true,
      },
    });

    expect(executable.receipt.decision).toBe('dry-run-blocked');
    expect(executable.receipt.validations).toEqual(expect.arrayContaining([
      'external-executor-touch-attempted',
      'high-impact-execution-attempted',
      'raw-content-blocked',
    ]));
    expect(executable.receipt.finalSendPlan.messageActuallySent).toBe(false);
    expect(executable.receipt.finalSendPlan.externalTransportInvoked).toBe(false);
    expect(executable.receipt.finalSendPlan.rawSecretSerialized).toBe(false);
  });
});
