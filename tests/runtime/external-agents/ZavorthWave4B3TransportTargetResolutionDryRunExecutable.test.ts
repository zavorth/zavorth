import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4B3_TRANSPORT_TARGET_RESOLUTION_DRY_RUN_EXECUTE_FLAG,
  ZAVORTH_WAVE4B3_TRANSPORT_TARGET_RESOLUTION_DRY_RUN_RUNTIME_ID,
  ZavorthNativeIntegrationRegistry,
  createZavorthNativeIntegrationRegistryFixture,
  createZavorthWave4B3TransportTargetResolutionDryRunExecutableFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthNativeIntegrationRecord,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/232-wave-4b3-transport-target-resolution-dry-run-executable.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/231-wave-4b3-message-send-dry-run-executable.md';
const NEXT_DOC = 'docs/233-wave-4b3-message-send-dry-run-executables-milestone-report.md';
const PRIOR_TEST = 'tests/runtime/external-agents/ZavorthWave4B3MessageSendDryRunExecutable.test.ts';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4B3TransportTargetResolutionDryRunExecutable.ts';
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

function registryWithModifiedSendTransport(
  update: (record: ZavorthNativeIntegrationRecord) => ZavorthNativeIntegrationRecord,
): { registry: ZavorthNativeIntegrationRegistry; transportId: string } {
  const registry = createZavorthNativeIntegrationRegistryFixture();
  const transport = registry.list({
    integrationKind: 'message-transport',
    supportsSend: true,
  })[0];

  if (!transport) {
    throw new Error('Expected send-capable transport fixture');
  }

  return {
    transportId: transport.id,
    registry: new ZavorthNativeIntegrationRegistry({
      ...registry.snapshot,
      records: registry.snapshot.records.map((record) => record.id === transport.id ? update(record) : record),
    }),
  };
}

describe('Wave 4B.3 transport target resolution dry-run executable', () => {
  it('documents 232 as the guarded transport-target-resolution dry-run executable gate', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `wave4b3-transport-target-resolution-dry-run-executable-ready`');
    expect(content).toContain('transport-target-resolution-dry-run');
    expect(content).toContain('ZavorthWave4B3TransportTargetResolutionDryRunExecutable.ts');
    expect(content).toContain('ZavorthWave4B3TransportTargetResolutionDryRunReceipt/v1');
    expect(content).toContain('ZavorthWave4B3TransportTargetResolutionPlan/v1');
    expect(content).toContain('ZavorthWave4B3TransportTargetResolutionPolicyPreflight/v1');
    expect(content).toContain(ZAVORTH_WAVE4B3_TRANSPORT_TARGET_RESOLUTION_DRY_RUN_EXECUTE_FLAG);
    expect(content).toContain('wave4b3TransportTargetResolutionDryRunCreated=true');
    expect(content).toContain('transportTargetResolutionDryRunActuallyExecutedOnlyWhenFlagEnabled=true');
    expect(content).toContain('realMessageSendAllowed=false');
    expect(content).toContain('transportActuallyOpened=false');
    expect(content).toContain('runtimeExternalExecutorRequiredForExecution=false');
    expect(content).toContain('Wave 4B.3 message-send dry-run executables milestone follow-up:');
    expect(content).toContain(NEXT_DOC);
    expect(content).toContain('Do not advance beyond `233`');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the 231 handoff for 232', () => {
    expect(read(GO_NO_GO_DOC)).toContain(DOC);
    expect(read(PAUSE_DOC)).toContain('`232` executes the second Wave 4B.3 dry-run executable');
    expect(read(PRIOR_DOC)).toContain('Wave 4B.3 transport target resolution dry-run executable follow-up:');
    expect(read(PRIOR_DOC)).toContain(DOC);
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond `232`');
    expect(read(PRIOR_TEST)).toContain(DOC);
  });

  it('exports the transport target resolution boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4B3TransportTargetResolutionDryRunReceipt/v1');
    expect(boundary).toContain('ZavorthWave4B3TransportTargetResolutionPlan/v1');
    expect(boundary).toContain('ZavorthWave4B3TransportTargetResolutionFeatureFlagGate/v1');
    expect(boundary).toContain('ZavorthWave4B3TransportTargetResolutionPolicyPreflight/v1');
    expect(boundary).toContain('ZavorthWave4B3TransportTargetResolutionCleanupReceipt/v1');
    expect(index).toContain("from './ZavorthWave4B3TransportTargetResolutionDryRunExecutable.js'");
    expect(index).toContain('ZAVORTH_WAVE4B3_TRANSPORT_TARGET_RESOLUTION_DRY_RUN_RUNTIME_ID');
  });

  it('blocks execution when the feature flag is disabled', () => {
    const executable = createZavorthWave4B3TransportTargetResolutionDryRunExecutableFixture({
      featureFlagEnabled: false,
    });

    expect(executable.receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4B3TransportTargetResolutionDryRunReceipt/v1',
      runtimeId: ZAVORTH_WAVE4B3_TRANSPORT_TARGET_RESOLUTION_DRY_RUN_RUNTIME_ID,
      selectedDryRunCapability: 'transport-target-resolution-dry-run',
      decision: 'execution-blocked',
      classification: 'execution-blocked',
      transportTargetResolutionDryRunActuallyExecuted: false,
      transportTargetResolutionDryRunActuallyExecutedOnlyWhenFlagEnabled: true,
      runtimeExternalExecutorRequiredForExecution: false,
      externalExecutorTouched: false,
    }));
    expect(executable.receipt.validations).toContain('feature-flag-disabled');
    expect(executable.resolutionSucceeded()).toBe(false);
    assertNoRawSecretOrContent(JSON.stringify(executable.receipt));
  });

  it('executes the resolution dry-run with migrated/native metadata and no real transport', () => {
    const executable = createZavorthWave4B3TransportTargetResolutionDryRunExecutableFixture({
      featureFlagEnabled: true,
    });

    expect(['resolution-ok', 'resolution-degraded']).toContain(executable.receipt.decision);
    expect(executable.resolutionSucceeded()).toBe(true);
    expect(executable.transportStillBlocked()).toBe(true);
    expect(executable.receipt.validations).toEqual(expect.arrayContaining([
      'target-resolved',
      'thread-resolved',
      'channel-resolved',
      'transport-resolved',
      'send-capable-blocked',
      'secretref-metadata-only',
      'scope-permission-metadata',
      'policy-eligible',
      'idempotency-valid',
    ]));
    expect(executable.receipt.resolutionPlan).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4B3TransportTargetResolutionPlan/v1',
      mode: 'dry-run-resolution-only',
      action: 'transport-target-resolution-dry-run',
      externalTransportInvoked: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      rawContentUsed: false,
    }));
    expect(executable.receipt.sourceMetadata).toEqual(expect.objectContaining({
      migratedSessionChannelTransportMetadataUsed: true,
      nativeSessionHistoryRegistryUsed: true,
      nativeIntegrationRegistryUsed: true,
      transportDiscoveryMetadataUsed: true,
      sourceProvenanceInternalRedacted: true,
    }));
  });

  it('resolves target/session/thread/channel/transport through migrated/native metadata', () => {
    const executable = createZavorthWave4B3TransportTargetResolutionDryRunExecutableFixture();
    const target = executable.receipt.resolutionPlan.target;
    const transport = executable.receipt.resolutionPlan.transport;

    expect(target).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4B3TransportTargetResolutionTarget/v1',
      sourceIdentityPublic: false,
      rawParticipantIdsSerialized: false,
      rawMessageContentSerialized: false,
    }));
    expect(target.sessionRecordId).not.toBe('missing-session');
    expect(target.threadRecordId).not.toBe('missing-thread');
    expect(target.channelIntegrationId).not.toBe('missing-channel');
    expect(target.transportIntegrationId).not.toBe('missing-transport');
    expect(transport).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4B3TransportTargetResolutionTransport/v1',
      supportsSend: true,
      sendPolicy: 'blocked',
      sendCapableStatus: 'send-capable-but-blocked',
      secretRefsMetadataOnly: true,
      rawSecretSerialized: false,
    }));
    expect(executable.receipt.policyPreflight.exactScope).toEqual({
      sessionRecordId: target.sessionRecordId,
      threadRecordId: target.threadRecordId,
      channelIntegrationId: target.channelIntegrationId,
      transportIntegrationId: target.transportIntegrationId,
    });
  });

  it('classifies target ambiguity, missing target, missing channel, and missing transport', () => {
    expect(createZavorthWave4B3TransportTargetResolutionDryRunExecutableFixture({
      source: { targetAliasCollisionDetected: true },
    }).receipt.decision).toBe('target-ambiguous');
    expect(createZavorthWave4B3TransportTargetResolutionDryRunExecutableFixture({
      targetSessionId: 'missing-session',
    }).receipt.decision).toBe('target-missing');
    expect(createZavorthWave4B3TransportTargetResolutionDryRunExecutableFixture({
      targetChannelIntegrationId: 'missing-channel',
    }).receipt.decision).toBe('channel-unavailable');
    expect(createZavorthWave4B3TransportTargetResolutionDryRunExecutableFixture({
      targetTransportIntegrationId: 'missing-transport',
    }).receipt.decision).toBe('transport-unconfigured');
  });

  it('blocks missing SecretRef metadata without reading or serializing secret values', () => {
    const { registry, transportId } = registryWithModifiedSendTransport((record) => ({
      ...record,
      requiredSecretRefs: [],
    }));
    const executable = createZavorthWave4B3TransportTargetResolutionDryRunExecutableFixture({
      source: { integrationRegistry: registry },
      targetTransportIntegrationId: transportId,
    });

    expect(executable.receipt.decision).toBe('missing-secretref');
    expect(executable.receipt.validations).toContain('missing-secretref');
    expect(executable.receipt.requiredSecretRefs).toEqual([]);
    expect(executable.receipt.realMessageSendAllowed).toBe(false);
    expect(executable.receipt.transportActuallyOpened).toBe(false);
    assertNoRawSecretOrContent(JSON.stringify(executable.receipt));
  });

  it('represents unavailable/unconfigured and policy rejected states without crashes', () => {
    const { registry, transportId } = registryWithModifiedSendTransport((record) => ({
      ...record,
      configured: false,
      status: 'degraded',
      classification: 'degraded',
    }));
    const degraded = createZavorthWave4B3TransportTargetResolutionDryRunExecutableFixture({
      source: { integrationRegistry: registry },
      targetTransportIntegrationId: transportId,
    });
    const policyRejected = createZavorthWave4B3TransportTargetResolutionDryRunExecutableFixture({
      source: { policyAllowsResolution: false },
    });

    expect(degraded.receipt.decision).toBe('resolution-degraded');
    expect(degraded.receipt.validations).toEqual(expect.arrayContaining([
      'transport-unconfigured',
      'transport-degraded',
    ]));
    expect(policyRejected.receipt.decision).toBe('policy-rejected');
    expect(policyRejected.receipt.validations).toContain('policy-rejected');
  });

  it('keeps send-capable transport blocked and SecretRefs as metadata only', () => {
    const executable = createZavorthWave4B3TransportTargetResolutionDryRunExecutableFixture();

    expect(executable.receipt.resolutionPlan.transport.sendCapableStatus).toBe('send-capable-but-blocked');
    expect(executable.receipt.policyPreflight.externalTransportBlocked).toBe(true);
    expect(executable.receipt.policyPreflight.messageSendBlocked).toBe(true);
    expect(executable.receipt.realMessageSendAllowed).toBe(false);
    expect(executable.receipt.transportActuallyOpened).toBe(false);
    executable.receipt.requiredSecretRefs.forEach((secretRef) => {
      expect(secretRef.nativeContract).toBe('ZavorthNativeIntegrationSecretRefMetadata/v1');
      expect(secretRef.rawValueSerialized).toBe(false);
    });
    assertNoRawSecretOrContent(JSON.stringify(executable.receipt));
  });

  it('blocks high-impact attempts instead of sending, opening transport, touching ExternalExecutor, or executing providers/tools', () => {
    const executable = createZavorthWave4B3TransportTargetResolutionDryRunExecutableFixture({
      source: {
        externalExecutorTouched: true,
        realMessageSendAttempted: true,
        transportOpenAttempted: true,
        providerRealExecutionAttempted: true,
        toolCommandRealExecutionAttempted: true,
      },
    });

    expect(executable.receipt.decision).toBe('resolution-blocked');
    expect(executable.receipt.validations).toEqual(expect.arrayContaining([
      'external-executor-touch-attempted',
      'high-impact-execution-attempted',
    ]));
    expect(executable.receipt.realMessageSendAllowed).toBe(false);
    expect(executable.receipt.transportActuallyOpened).toBe(false);
    expect(executable.receipt.providerRealExecutionAllowed).toBe(false);
    expect(executable.receipt.toolCommandRealExecutionAllowed).toBe(false);
    expect(executable.receipt.externalExecutorTouched).toBe(false);
  });

  it('is idempotent across re-runs and records cleanup without process/listener work', () => {
    const first = createZavorthWave4B3TransportTargetResolutionDryRunExecutableFixture();
    const second = createZavorthWave4B3TransportTargetResolutionDryRunExecutableFixture();

    expect(first.isIdempotentWith(second)).toBe(true);
    expect(first.receipt.idempotencyKey).toBe(second.receipt.idempotencyKey);
    expect(first.receipt.cleanupReceipt).toEqual(expect.objectContaining({
      cleanupActuallyPerformed: true,
      cleanupLimitedToControlledTestMetadata: true,
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

  it('keeps every required no-transport and no-execution guarantee false', () => {
    const executable = createZavorthWave4B3TransportTargetResolutionDryRunExecutableFixture();

    expect(executable.receipt).toEqual(expect.objectContaining({
      wave4b3TransportTargetResolutionDryRunCreated: true,
      transportTargetResolutionDryRunActuallyExecutedOnlyWhenFlagEnabled: true,
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
    expect(executable.receipt.resolutionPlan).toEqual(expect.objectContaining({
      externalTransportInvoked: false,
      messageActuallySent: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      rawSecretSerialized: false,
    }));
  });
});
