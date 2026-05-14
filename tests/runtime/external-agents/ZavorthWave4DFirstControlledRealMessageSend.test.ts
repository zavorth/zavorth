import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4D_FIRST_CONTROLLED_REAL_MESSAGE_SEND_RUNTIME_ID,
  ZAVORTH_WAVE4D_FIRST_REAL_MESSAGE_SEND_EXECUTE_FLAG,
  createZavorthWave4DFirstControlledRealMessageSendFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/238-wave-4d-first-controlled-real-message-send.md';
const NEXT_DOC = 'docs/240-wave-4d-message-send-expansion-and-audit-pack.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/237-wave-4d-final-dry-run-against-approved-test-target.md';
const PRIOR_TEST = 'tests/runtime/external-agents/ZavorthWave4DFinalDryRunAgainstApprovedTestTarget.test.ts';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4DFirstControlledRealMessageSend.ts';
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

describe('Wave 4D first controlled real message send', () => {
  it('documents 238 as the first controlled real test message send gate', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `wave4d-first-controlled-real-message-send-ready`');
    expect(content).toContain('ZavorthWave4DFirstControlledRealMessageSend.ts');
    expect(content).toContain('ZavorthWave4DFirstControlledRealMessageSendReceipt/v1');
    expect(content).toContain('ZavorthWave4DFirstControlledRealMessageSendTransportReceipt/v1');
    expect(content).toContain(ZAVORTH_WAVE4D_FIRST_REAL_MESSAGE_SEND_EXECUTE_FLAG);
    expect(content).toContain('wave4dFirstControlledRealMessageSendCreated=true');
    expect(content).toContain('realMessageSendActuallyPerformedOnlyWhenFlagEnabled=true');
    expect(content).toContain('realMessageSendAllowedOnlyForApprovedTestTarget=true');
    expect(content).toContain('approvalRequiredForLiveSend=true');
    expect(content).toContain('dryRunRequiredBeforeLiveSend=true');
    expect(content).toContain('policyRecheckRequired=true');
    expect(content).toContain('idempotencyRequired=true');
    expect(content).toContain('Expansion And Audit Pack Follow-Up');
    expect(content).toContain(NEXT_DOC);
    expect(content).toContain('Do not advance beyond `240`');
    assertNoRawSecretOrContent(content);
  });

  it('updates tracking docs and the 237 handoff for 238', () => {
    expect(read(GO_NO_GO_DOC)).toContain(DOC);
    expect(read(PAUSE_DOC)).toContain('`238` executes the first controlled real message send');
    expect(read(PRIOR_DOC)).toContain('First Controlled Send Follow-Up');
    expect(read(PRIOR_DOC)).toContain(DOC);
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond `238`');
    expect(read(PRIOR_TEST)).toContain(DOC);
  });

  it('exports the first controlled send boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4DFirstControlledRealMessageSendReceipt/v1');
    expect(boundary).toContain('ZavorthWave4DFirstControlledRealMessageSendPlan/v1');
    expect(boundary).toContain('ZavorthWave4DFirstControlledRealMessageSendTransportReceipt/v1');
    expect(boundary).toContain('ZavorthWave4DFirstControlledRealMessageSendCleanupReceipt/v1');
    expect(index).toContain("from './ZavorthWave4DFirstControlledRealMessageSend.js'");
    expect(index).toContain('ZAVORTH_WAVE4D_FIRST_CONTROLLED_REAL_MESSAGE_SEND_RUNTIME_ID');
  });

  it('blocks live send when the feature flag is disabled', () => {
    const executable = createZavorthWave4DFirstControlledRealMessageSendFixture({
      featureFlagEnabled: false,
    });

    expect(executable.receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4DFirstControlledRealMessageSendReceipt/v1',
      runtimeId: ZAVORTH_WAVE4D_FIRST_CONTROLLED_REAL_MESSAGE_SEND_RUNTIME_ID,
      selectedCapability: 'first-controlled-real-message-send',
      decision: 'live-send-blocked-feature-flag',
      classification: 'live-send-blocked-feature-flag',
      realMessageSendActuallyPerformed: false,
      realMessageSendActuallyPerformedOnlyWhenFlagEnabled: true,
    }));
    expect(executable.receipt.validations).toContain('feature-flag-disabled');
    expect(executable.receipt.transportReceipt.messageCount).toBe(0);
    expect(executable.liveSendSucceeded()).toBe(false);
  });

  it('sends exactly one controlled test message when all gates pass', () => {
    const executable = createZavorthWave4DFirstControlledRealMessageSendFixture({
      featureFlagEnabled: true,
    });

    expect(executable.receipt.decision).toBe('live-send-ok');
    expect(executable.liveSendSucceeded()).toBe(true);
    expect(executable.highImpactStillBlocked()).toBe(true);
    expect(executable.receipt.validations).toEqual(expect.arrayContaining([
      'target-approved-test-sandbox',
      'approval-grant-real-present',
      'policy-recheck-accepted',
      'dry-run-ready-for-live-approval',
      'secretref-metadata-resolver-ready',
      'idempotency-valid',
      'test-transport-opened',
      'live-test-message-sent',
      'ack-status-recorded',
      'test-transport-cleaned-up',
      'cleanup-confirmed',
    ]));
    expect(executable.receipt.transportReceipt).toEqual({
      nativeContract: 'ZavorthWave4DFirstControlledRealMessageSendTransportReceipt/v1',
      transportKind: 'local-test-harness',
      transportActuallyOpened: true,
      openedOnlyForApprovedTestTarget: true,
      externalUserReachable: false,
      messageActuallySent: true,
      messageCount: 1,
      ackStatus: 'ack-recorded',
      providerActuallyExecuted: false,
      toolCommandActuallyExecuted: false,
      rawSecretSerialized: false,
    });
    expect(executable.receipt.cleanupReceipt).toEqual({
      nativeContract: 'ZavorthWave4DFirstControlledRealMessageSendCleanupReceipt/v1',
      cleanupAttempted: true,
      cleanupConfirmed: true,
      transportStillOpen: false,
      messageActuallySent: true,
      rawSecretSerialized: false,
    });
  });

  it('blocks non-test/sandbox targets', () => {
    const executable = createZavorthWave4DFirstControlledRealMessageSendFixture({
      source: {
        approvedTestTargetMarkedSandbox: false,
      },
    });

    expect(executable.receipt.decision).toBe('live-send-missing-test-target');
    expect(executable.receipt.validations).toContain('target-not-approved-test-sandbox');
    expect(executable.receipt.realMessageSendActuallyPerformed).toBe(false);
    expect(executable.receipt.transportReceipt.messageCount).toBe(0);
  });

  it('blocks missing approval, missing dry-run, policy rejection, missing SecretRef, and transport unavailable', () => {
    expect(createZavorthWave4DFirstControlledRealMessageSendFixture({
      source: { approvalGrantRealPresent: false },
    }).receipt.decision).toBe('live-send-missing-approval');
    expect(createZavorthWave4DFirstControlledRealMessageSendFixture({
      source: { dryRunReadyForLiveApproval: false },
    }).receipt.decision).toBe('live-send-blocked');
    expect(createZavorthWave4DFirstControlledRealMessageSendFixture({
      source: { policyRecheckAccepted: false },
    }).receipt.decision).toBe('live-send-policy-rejected');
    expect(createZavorthWave4DFirstControlledRealMessageSendFixture({
      source: { secretRefsAvailableAsResolver: false },
    }).receipt.decision).toBe('live-send-secretref-unavailable');
    expect(createZavorthWave4DFirstControlledRealMessageSendFixture({
      source: { testTransportAvailable: false },
    }).receipt.decision).toBe('live-send-transport-unavailable');
  });

  it('prevents duplicate sends with an already-used idempotency key', () => {
    const executable = createZavorthWave4DFirstControlledRealMessageSendFixture({
      source: { idempotencyKeyAlreadyUsed: true },
    });

    expect(executable.receipt.decision).toBe('live-send-blocked');
    expect(executable.receipt.validations).toContain('idempotency-duplicate');
    expect(executable.receipt.realMessageSendActuallyPerformed).toBe(false);
    expect(executable.receipt.transportReceipt.messageCount).toBe(0);
  });

  it('records degraded send when ack/status is unavailable but cleanup succeeds', () => {
    const executable = createZavorthWave4DFirstControlledRealMessageSendFixture({
      source: { ackStatusAvailable: false },
    });

    expect(executable.receipt.decision).toBe('live-send-degraded');
    expect(executable.receipt.realMessageSendActuallyPerformed).toBe(true);
    expect(executable.receipt.transportReceipt.ackStatus).toBe('ack-unavailable');
    expect(executable.receipt.cleanupReceipt.cleanupConfirmed).toBe(true);
  });

  it('keeps provider/tool/command execution, ExternalExecutor mutation, raw content, source copy, adapter removal, and raw secrets blocked', () => {
    const executable = createZavorthWave4DFirstControlledRealMessageSendFixture();
    const serialized = JSON.stringify(executable.receipt);

    expect(executable.receipt).toEqual(expect.objectContaining({
      wave4dFirstControlledRealMessageSendCreated: true,
      realMessageSendActuallyPerformedOnlyWhenFlagEnabled: true,
      realMessageSendAllowedOnlyForApprovedTestTarget: true,
      approvalRequiredForLiveSend: true,
      dryRunRequiredBeforeLiveSend: true,
      policyRecheckRequired: true,
      idempotencyRequired: true,
      providerRealExecutionAllowed: false,
      toolCommandRealExecutionAllowed: false,
      externalExecutorMutationAllowed: false,
      rawContentUsageAllowed: false,
      runtimeExternalExecutorRequiredForExecution: false,
      rawSecretSerialized: false,
      sourceModuleCopied: false,
      adapterRemovalGlobalAllowed: false,
    }));
    expect(executable.receipt.liveSendPlan).toEqual(expect.objectContaining({
      targetScope: 'explicit-test-sandbox-only',
      testMessageContent: '[zavorth-controlled-test-message]',
      rawContentUsed: false,
      providerActuallyExecuted: false,
      toolCommandActuallyExecuted: false,
      rawSecretSerialized: false,
    }));
    assertNoRawSecretOrContent(serialized);
  });

  it('blocks prohibited execution, raw content, ExternalExecutor touch, migration, source copy, adapter removal, and public source identity attempts', () => {
    const executable = createZavorthWave4DFirstControlledRealMessageSendFixture({
      source: {
        externalExecutorTouched: true,
        realMessageSendAttemptedOutsideGate: true,
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

    expect(executable.receipt.decision).toBe('live-send-blocked');
    expect(executable.receipt.validations).toEqual(expect.arrayContaining([
      'external-executor-touch-attempted',
      'prohibited-execution-attempted',
      'raw-content-rejected',
    ]));
    expect(executable.receipt.realMessageSendActuallyPerformed).toBe(false);
    expect(executable.receipt.transportReceipt.messageCount).toBe(0);
    expect(executable.receipt.cleanupReceipt.transportStillOpen).toBe(false);
  });
});
