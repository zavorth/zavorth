import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTE_FLAG,
  ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLE_RUNTIME_ID,
  createZavorthNativeIntegrationRegistryFixture,
  createZavorthWave4B3MessageSendDryRunExecutableFixture,
  createZavorthWave4B3MessageSendDryRunRedactedContentViewsFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4C2RedactedContentNativeView,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/231-wave-4b3-message-send-dry-run-executable.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/230-wave-4b3-message-send-dry-run-executable-selection.md';
const NEXT_DOC = 'docs/232-wave-4b3-transport-target-resolution-dry-run-executable.md';
const PRIOR_TEST = 'tests/runtime/external-agents/ZavorthWave4B3MessageSendDryRunExecutableSelection.test.ts';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4B3MessageSendDryRunExecutable.ts';
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

function unsafeRawContentView(): ZavorthWave4C2RedactedContentNativeView {
  const [view] = createZavorthWave4B3MessageSendDryRunRedactedContentViewsFixture();
  return {
    ...view,
    payload: {
      ...view.payload,
      contentRawStored: true,
      rawMessageContentSerialized: true,
    },
    rawMessageContentSerialized: true,
  } as unknown as ZavorthWave4C2RedactedContentNativeView;
}

describe('Wave 4B.3 message-send dry-run executable', () => {
  it('documents 231 as the guarded message-send dry-run executable gate', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `wave4b3-message-send-dry-run-executable-ready`');
    expect(content).toContain('message-send-dry-run-action');
    expect(content).toContain('ZavorthWave4B3MessageSendDryRunExecutable.ts');
    expect(content).toContain('ZavorthWave4B3MessageSendDryRunActionReceipt/v1');
    expect(content).toContain('ZavorthWave4B3MessageSendDryRunPlan/v1');
    expect(content).toContain('ZavorthWave4B3MessageSendDryRunPolicyPreflight/v1');
    expect(content).toContain(ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTE_FLAG);
    expect(content).toContain('wave4b3MessageSendDryRunExecutableCreated=true');
    expect(content).toContain('messageSendDryRunActuallyExecutedOnlyWhenFlagEnabled=true');
    expect(content).toContain('realMessageSendAllowed=false');
    expect(content).toContain('transportActuallyOpened=false');
    expect(content).toContain('runtimeExternalExecutorRequiredForExecution=false');
    expect(content).toContain('Wave 4B.3 transport target resolution dry-run executable follow-up:');
    expect(content).toContain(NEXT_DOC);
    expect(content).toContain('Do not advance beyond `232`');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the 230 handoff for 231', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/231-wave-4b3-message-send-dry-run-executable.md');
    expect(read(PAUSE_DOC)).toContain('`231` executes the first Wave 4B.3 dry-run executable');
    expect(read(PRIOR_DOC)).toContain('Wave 4B.3 message-send dry-run executable follow-up:');
    expect(read(PRIOR_DOC)).toContain('docs/231-wave-4b3-message-send-dry-run-executable.md');
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond `231`');
    expect(read(PRIOR_TEST)).toContain('docs/231-wave-4b3-message-send-dry-run-executable.md');
  });

  it('exports the dry-run executable boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4B3MessageSendDryRunActionReceipt/v1');
    expect(boundary).toContain('ZavorthWave4B3MessageSendDryRunPlan/v1');
    expect(boundary).toContain('ZavorthWave4B3MessageSendDryRunFeatureFlagGate/v1');
    expect(boundary).toContain('ZavorthWave4B3MessageSendDryRunPolicyPreflight/v1');
    expect(boundary).toContain('ZavorthWave4B3MessageSendDryRunCleanupReceipt/v1');
    expect(index).toContain("from './ZavorthWave4B3MessageSendDryRunExecutable.js'");
    expect(index).toContain('ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLE_RUNTIME_ID');
  });

  it('blocks execution when the feature flag is disabled', () => {
    const executable = createZavorthWave4B3MessageSendDryRunExecutableFixture({
      featureFlagEnabled: false,
    });

    expect(executable.receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4B3MessageSendDryRunActionReceipt/v1',
      runtimeId: ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLE_RUNTIME_ID,
      selectedDryRunCapability: 'message-send-dry-run-action',
      decision: 'execution-blocked',
      classification: 'execution-blocked',
      messageSendDryRunActuallyExecuted: false,
      messageSendDryRunActuallyExecutedOnlyWhenFlagEnabled: true,
      runtimeExternalExecutorRequiredForExecution: false,
      externalExecutorTouched: false,
    }));
    expect(executable.receipt.validations).toContain('feature-flag-disabled');
    expect(executable.dryRunSucceeded()).toBe(false);
    assertNoRawSecretOrContent(JSON.stringify(executable.receipt));
  });

  it('executes the dry-run with migrated metadata and redacted content when the flag is enabled', () => {
    const executable = createZavorthWave4B3MessageSendDryRunExecutableFixture({
      featureFlagEnabled: true,
    });

    expect(['dry-run-ok', 'dry-run-degraded']).toContain(executable.receipt.decision);
    expect(executable.dryRunSucceeded()).toBe(true);
    expect(executable.messageSendStillBlocked()).toBe(true);
    expect(executable.receipt.validations).toEqual(expect.arrayContaining([
      'target-resolved',
      'thread-resolved',
      'channel-resolved',
      'transport-resolved',
      'send-capable-blocked',
      'secretref-metadata-only',
      'redacted-content-accepted',
      'derived-content-accepted',
      'policy-eligible',
      'approval-metadata-recorded',
      'idempotency-valid',
    ]));
    expect(executable.receipt.dryRunPlan).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4B3MessageSendDryRunPlan/v1',
      mode: 'dry-run-only',
      action: 'message-send-dry-run-action',
      transportLiveBlocked: true,
      externalTransportInvoked: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      externalExecutorTouched: false,
    }));
    expect(executable.receipt.sourceMetadata).toEqual(expect.objectContaining({
      migratedSessionChannelTransportMetadataUsed: true,
      redactedDerivedContentUsed: true,
      nativeSessionHistoryRegistryUsed: true,
      nativeIntegrationRegistryUsed: true,
      sourceProvenanceInternalRedacted: true,
    }));
  });

  it('resolves target/session/thread/channel/transport through migrated/native metadata', () => {
    const executable = createZavorthWave4B3MessageSendDryRunExecutableFixture();
    const target = executable.receipt.dryRunPlan.target;

    expect(target).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4B3MessageSendDryRunTarget/v1',
      sourceIdentityPublic: false,
      rawParticipantIdsSerialized: false,
      rawMessageContentSerialized: false,
    }));
    expect(target.sessionRecordId).not.toBe('missing-session');
    expect(target.threadRecordId).not.toBe('missing-thread');
    expect(target.channelIntegrationId).not.toBe('missing-channel');
    expect(target.transportIntegrationId).not.toBe('missing-transport');
    expect(target.targetMessageMetadataIds.length).toBeGreaterThan(0);
    expect(executable.receipt.policyPreflight.exactScope).toEqual({
      sessionRecordId: target.sessionRecordId,
      threadRecordId: target.threadRecordId,
      channelIntegrationId: target.channelIntegrationId,
      transportIntegrationId: target.transportIntegrationId,
    });
  });

  it('accepts redacted/derived content and never serializes raw content', () => {
    const executable = createZavorthWave4B3MessageSendDryRunExecutableFixture();
    const content = executable.receipt.dryRunPlan.content;

    expect(content).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4B3MessageSendDryRunContentEnvelope/v1',
      redactedDerivedContentUsed: true,
      rawContentUsed: false,
      rawMessageContentSerialized: false,
      rawSecretSerialized: false,
    }));
    expect(content.viewIds.length).toBeGreaterThan(0);
    expect(content.contentHashes.length).toBeGreaterThan(0);
    expect(content.redactedExcerpts).toContain('[redacted-content]');
    assertNoRawSecretOrContent(JSON.stringify(executable.receipt));
  });

  it('rejects raw content attempts before a dry-run plan can be considered valid', () => {
    const executable = createZavorthWave4B3MessageSendDryRunExecutableFixture({
      source: {
        rawContentUsageAttempted: true,
        redactedContentViews: [unsafeRawContentView()],
      },
    });

    expect(executable.receipt.decision).toBe('raw-content-rejected');
    expect(executable.receipt.validations).toContain('raw-content-rejected');
    expect(executable.receipt.rawContentUsageAllowed).toBe(false);
    expect(executable.receipt.realMessageSendAllowed).toBe(false);
    expect(executable.receipt.transportActuallyOpened).toBe(false);
  });

  it('keeps send-capable transport blocked and SecretRefs as metadata only', () => {
    const integrationRegistry = createZavorthNativeIntegrationRegistryFixture();
    const sendCapableTransport = integrationRegistry.list({
      integrationKind: 'message-transport',
      supportsSend: true,
    })[0];
    const executable = createZavorthWave4B3MessageSendDryRunExecutableFixture({
      source: { integrationRegistry },
      targetTransportIntegrationId: sendCapableTransport?.id,
    });

    expect(executable.receipt.dryRunPlan.target.sendCapableStatus).toBe('send-capable-but-blocked');
    expect(executable.receipt.dryRunPlan.sendCapableButBlocked).toBe(true);
    expect(executable.receipt.realMessageSendAllowed).toBe(false);
    expect(executable.receipt.transportActuallyOpened).toBe(false);
    expect(executable.receipt.policyPreflight.messageSendBlocked).toBe(true);
    executable.receipt.requiredSecretRefs.forEach((secretRef) => {
      expect(secretRef.nativeContract).toBe('ZavorthNativeIntegrationSecretRefMetadata/v1');
      expect(secretRef.rawValueSerialized).toBe(false);
    });
    assertNoRawSecretOrContent(JSON.stringify(executable.receipt));
  });

  it('classifies target, transport, and policy failures without touching ExternalExecutor', () => {
    expect(createZavorthWave4B3MessageSendDryRunExecutableFixture({
      targetSessionId: 'missing-session',
    }).receipt.decision).toBe('target-unavailable');
    expect(createZavorthWave4B3MessageSendDryRunExecutableFixture({
      targetTransportIntegrationId: 'missing-transport',
    }).receipt.decision).toBe('transport-unconfigured');
    expect(createZavorthWave4B3MessageSendDryRunExecutableFixture({
      source: { policyAllowsDryRun: false },
    }).receipt.decision).toBe('policy-rejected');
  });

  it('blocks high-impact attempts instead of sending, opening transport, or executing providers/tools', () => {
    const executable = createZavorthWave4B3MessageSendDryRunExecutableFixture({
      source: {
        realMessageSendAttempted: true,
        transportOpenAttempted: true,
        providerRealExecutionAttempted: true,
        toolCommandRealExecutionAttempted: true,
        externalExecutorTouched: true,
      },
    });

    expect(executable.receipt.decision).toBe('dry-run-blocked');
    expect(executable.receipt.validations).toEqual(expect.arrayContaining([
      'external-executor-touch-attempted',
      'high-impact-execution-attempted',
    ]));
    expect(executable.receipt.realMessageSendAllowed).toBe(false);
    expect(executable.receipt.transportActuallyOpened).toBe(false);
    expect(executable.receipt.providerRealExecutionAllowed).toBe(false);
    expect(executable.receipt.toolCommandRealExecutionAllowed).toBe(false);
  });

  it('records approval metadata without granting approval', () => {
    const executable = createZavorthWave4B3MessageSendDryRunExecutableFixture();

    expect(executable.receipt.approvalMetadata).toEqual({
      nativeContract: 'ZavorthWave4B3MessageSendDryRunApprovalMetadata/v1',
      approvalMetadataRequired: true,
      approvalActuallyGranted: false,
      approvalGrantRequiredBeforeLiveSend: true,
      approverIdentitySerialized: false,
      exactScopeRequired: true,
      ttlRequired: true,
      idempotencyKeyRequired: true,
    });
    expect(executable.receipt.policyPreflight).toEqual(expect.objectContaining({
      policyPreflightRequired: true,
      policyRecheckedImmediatelyBeforeExecution: true,
      approvalRequiredForDryRun: false,
      approvalRequiredBeforeFutureLiveSend: true,
      messageSendBlocked: true,
      providerExecutionBlocked: true,
      toolCommandExecutionBlocked: true,
      externalTransportBlocked: true,
      rawContentBlocked: true,
    }));
  });

  it('is idempotent across re-runs and never serializes raw secret or raw message content', () => {
    const first = createZavorthWave4B3MessageSendDryRunExecutableFixture();
    const second = createZavorthWave4B3MessageSendDryRunExecutableFixture();

    expect(first.isIdempotentWith(second)).toBe(true);
    expect(first.receipt.idempotencyKey).toBe(second.receipt.idempotencyKey);
    expect(first.receipt.cleanupReceipt).toEqual(expect.objectContaining({
      cleanupActuallyPerformed: true,
      transportActuallyOpened: false,
      externalExecutorTouched: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      rawSecretSerialized: false,
    }));
    assertNoRawSecretOrContent(JSON.stringify(first.receipt));
  });

  it('keeps every required high-impact guarantee false', () => {
    const executable = createZavorthWave4B3MessageSendDryRunExecutableFixture();

    expect(executable.receipt).toEqual(expect.objectContaining({
      wave4b3MessageSendDryRunExecutableCreated: true,
      messageSendDryRunActuallyExecutedOnlyWhenFlagEnabled: true,
      realMessageSendAllowed: false,
      transportActuallyOpened: false,
      providerRealExecutionAllowed: false,
      toolCommandRealExecutionAllowed: false,
      externalExecutorMutationAllowed: false,
      rawContentUsageAllowed: false,
      runtimeExternalExecutorRequiredForExecution: false,
      rawSecretSerialized: false,
      sourceModuleCopied: false,
      adapterRemovalGlobalAllowed: false,
      externalExecutorTouched: false,
    }));
    expect(executable.receipt.dryRunPlan).toEqual(expect.objectContaining({
      externalTransportInvoked: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      rawSecretSerialized: false,
    }));
  });
});
