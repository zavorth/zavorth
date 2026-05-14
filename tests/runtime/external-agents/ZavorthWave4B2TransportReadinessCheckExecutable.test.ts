import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4B2_TRANSPORT_READINESS_CHECK_EXECUTE_FLAG,
  ZAVORTH_WAVE4B2_TRANSPORT_READINESS_CHECK_EXECUTABLE_RUNTIME_ID,
  ZavorthNativeIntegrationRegistry,
  createZavorthNativeIntegrationRegistryFixture,
  createZavorthWave4B2TransportReadinessCheckExecutableFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthNativeIntegrationRecord,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/224-wave-4b2-transport-readiness-check-executable.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/223-wave-4b2-target-session-channel-validation-executable.md';
const PRIOR_TEST = 'tests/runtime/external-agents/ZavorthWave4B2TargetSessionChannelValidationExecutable.test.ts';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4B2TransportReadinessCheckExecutable.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

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

function sendCapableTransportId(registry = createZavorthNativeIntegrationRegistryFixture()): string {
  const transport = registry.list({
    integrationKind: 'message-transport',
    classification: 'send-capable-but-blocked',
    supportsSend: true,
  })[0];

  if (!transport) {
    throw new Error('Expected send-capable blocked transport fixture');
  }
  return transport.id;
}

function channelId(registry = createZavorthNativeIntegrationRegistryFixture()): string {
  const channel = registry.list({ integrationKind: 'channel' })[0];

  if (!channel) {
    throw new Error('Expected channel fixture');
  }
  return channel.id;
}

function registryWithPatches(
  patches: Record<string, Partial<ZavorthNativeIntegrationRecord>>,
): ZavorthNativeIntegrationRegistry {
  const registry = createZavorthNativeIntegrationRegistryFixture();
  const records = registry.snapshot.records.map((record) => (
    patches[record.id] ? { ...record, ...patches[record.id] } : record
  ));

  return new ZavorthNativeIntegrationRegistry({
    ...registry.snapshot,
    records,
  });
}

function readyRegistry(): { channel: string; registry: ZavorthNativeIntegrationRegistry; transport: string } {
  const base = createZavorthNativeIntegrationRegistryFixture();
  const targetChannelId = channelId(base);
  const targetTransportId = sendCapableTransportId(base);
  const registry = registryWithPatches({
    [targetChannelId]: {
      status: 'ready',
      classification: 'read-only',
      configured: true,
      supportsReceive: true,
      receivePolicy: 'metadata-only',
    },
    [targetTransportId]: {
      status: 'ready',
      configured: true,
      classification: 'send-capable-but-blocked',
      supportsSend: true,
      supportsDryRun: true,
      sendPolicy: 'blocked',
    },
  });

  return {
    channel: targetChannelId,
    registry,
    transport: targetTransportId,
  };
}

describe('Wave 4B.2 transport readiness check executable', () => {
  it('documents 224 as a guarded metadata-only transport readiness executable gate', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `wave4b2-transport-readiness-check-executable-ready`');
    expect(content).toContain('transport-readiness-check-action');
    expect(content).toContain('ZavorthWave4B2TransportReadinessCheckExecutable.ts');
    expect(content).toContain('ZavorthWave4B2TransportReadinessCheckExecutableReceipt/v1');
    expect(content).toContain(ZAVORTH_WAVE4B2_TRANSPORT_READINESS_CHECK_EXECUTE_FLAG);
    expect(content).toContain('wave4b2TransportReadinessCheckExecutableCreated=true');
    expect(content).toContain('transportReadinessCheckActuallyExecutedOnlyWhenFlagEnabled=true');
    expect(content).toContain('runtimeExternalExecutorRequiredForExecution=false');
    expect(content).toContain('externalExecutorTouched=false');
    expect(content).toContain('realMessageSendAllowed=false');
    expect(content).toContain('transportActuallyOpened=false');
    expect(content).toContain('rawSecretSerialized=false');
    expect(content).toContain('docs/225-wave-4b2-medium-risk-executable-capabilities-milestone-report.md');
    expect(content).toContain('Do not advance beyond `225`');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the 223 handoff for 224', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/224-wave-4b2-transport-readiness-check-executable.md');
    expect(read(PAUSE_DOC)).toContain('`224` executes the second Wave 4B.2 medium-risk');
    expect(read(PRIOR_DOC)).toContain('Wave 4B.2 transport readiness executable follow-up:');
    expect(read(PRIOR_DOC)).toContain('docs/224-wave-4b2-transport-readiness-check-executable.md');
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond `224`');
    expect(read(PRIOR_TEST)).toContain('docs/224-wave-4b2-transport-readiness-check-executable.md');
  });

  it('exports the transport readiness boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4B2TransportReadinessCheckExecutableReceipt/v1');
    expect(boundary).toContain('ZavorthWave4B2TransportReadinessCheckFeatureFlagGate/v1');
    expect(boundary).toContain('ZavorthWave4B2TransportReadinessCheckTarget/v1');
    expect(boundary).toContain('ZavorthWave4B2TransportReadinessPolicyPreflight/v1');
    expect(boundary).toContain('ZavorthWave4B2TransportReadinessCheckCleanupReceipt/v1');
    expect(index).toContain("from './ZavorthWave4B2TransportReadinessCheckExecutable.js'");
    expect(index).toContain('ZAVORTH_WAVE4B2_TRANSPORT_READINESS_CHECK_EXECUTABLE_RUNTIME_ID');
  });

  it('blocks execution when the feature flag is disabled', () => {
    const executable = createZavorthWave4B2TransportReadinessCheckExecutableFixture({
      featureFlagEnabled: false,
    });

    expect(executable.receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4B2TransportReadinessCheckExecutableReceipt/v1',
      runtimeId: ZAVORTH_WAVE4B2_TRANSPORT_READINESS_CHECK_EXECUTABLE_RUNTIME_ID,
      selectedMediumRiskCapability: 'transport-readiness-check-action',
      decision: 'execution-blocked',
      classification: 'execution-blocked',
      transportReadinessCheckActuallyExecuted: false,
      transportReadinessCheckActuallyExecutedOnlyWhenFlagEnabled: true,
      runtimeExternalExecutorRequiredForExecution: false,
      externalExecutorTouched: false,
    }));
    expect(executable.receipt.validations).toContain('feature-flag-disabled');
    expect(executable.readinessSucceeded()).toBe(false);
    assertNoRawSecret(JSON.stringify(executable.receipt));
  });

  it('executes a metadata-only readiness check with flag enabled and reports unconfigured send-capable transport honestly', () => {
    const executable = createZavorthWave4B2TransportReadinessCheckExecutableFixture({
      featureFlagEnabled: true,
    });

    expect(executable.receipt.decision).toBe('readiness-unconfigured');
    expect(executable.readinessSucceeded()).toBe(false);
    expect(executable.messageSendStillBlocked()).toBe(true);
    expect(executable.receipt.validations).toEqual(expect.arrayContaining([
      'channel-metadata-valid',
      'transport-metadata-valid',
      'transport-unconfigured',
      'transport-degraded',
      'send-capable-blocked',
      'dry-run-supported',
      'secretref-metadata-only',
      'scope-permission-metadata',
      'rate-limit-metadata',
      'ack-model-metadata',
      'error-model-metadata',
      'policy-eligible',
      'idempotency-valid',
    ]));
    expect(executable.receipt.target).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4B2TransportReadinessCheckTarget/v1',
      sendCapableStatus: 'send-capable-but-blocked',
      sourceIdentityPublic: false,
      rawSecretSerialized: false,
    }));
    expect(executable.receipt.policyPreflight).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4B2TransportReadinessPolicyPreflight/v1',
      policyPreflightRequired: true,
      policyRecheckedImmediatelyBeforeExecution: true,
      approvalRequired: false,
      approvalEscalatesForExternalProbe: true,
      messageSendBlocked: true,
      providerExecutionBlocked: true,
      toolCommandExecutionBlocked: true,
      externalTransportBlocked: true,
      rawHistoryMigrationBlocked: true,
    }));
  });

  it('can classify a fully configured metadata fixture as readiness-ok without opening transport', () => {
    const { channel, registry, transport } = readyRegistry();
    const executable = createZavorthWave4B2TransportReadinessCheckExecutableFixture({
      source: {
        integrationRegistry: registry,
      },
      targetChannelIntegrationId: channel,
      targetTransportIntegrationId: transport,
    });

    expect(executable.receipt.decision).toBe('readiness-ok');
    expect(executable.readinessSucceeded()).toBe(true);
    expect(executable.receipt.validations).toEqual(expect.arrayContaining([
      'channel-metadata-valid',
      'transport-metadata-valid',
      'send-capable-blocked',
      'dry-run-supported',
      'secretref-metadata-only',
      'scope-permission-metadata',
      'valid',
    ]));
    expect(executable.receipt.transportActuallyOpened).toBe(false);
    expect(executable.receipt.realMessageSendAllowed).toBe(false);
  });

  it('keeps send-capable transports blocked and SecretRefs as metadata only', () => {
    const executable = createZavorthWave4B2TransportReadinessCheckExecutableFixture();

    expect(executable.receipt.target.sendCapableStatus).toBe('send-capable-but-blocked');
    expect(executable.receipt.target.transport.supportsSend).toBe(true);
    expect(executable.receipt.target.transport.sendPolicy).toBe('blocked');
    expect(executable.receipt.realMessageSendAllowed).toBe(false);
    expect(executable.receipt.transportActuallyOpened).toBe(false);
    expect(executable.receipt.requiredSecretRefs.length).toBeGreaterThan(0);
    executable.receipt.requiredSecretRefs.forEach((secretRef) => {
      expect(secretRef.nativeContract).toBe('ZavorthNativeIntegrationSecretRefMetadata/v1');
      expect(secretRef.rawValueSerialized).toBe(false);
      expect(secretRef.status).toMatch(/metadata-only|present-redacted|unknown/);
    });
    assertNoRawSecret(JSON.stringify(executable.receipt));
  });

  it('detects missing SecretRef metadata on send-capable transport', () => {
    const base = createZavorthNativeIntegrationRegistryFixture();
    const transport = sendCapableTransportId(base);
    const registry = registryWithPatches({
      [transport]: {
        status: 'ready',
        configured: true,
        requiredSecretRefs: [],
      },
    });

    const executable = createZavorthWave4B2TransportReadinessCheckExecutableFixture({
      source: {
        integrationRegistry: registry,
      },
      targetTransportIntegrationId: transport,
    });

    expect(executable.receipt.decision).toBe('readiness-missing-secretref');
    expect(executable.receipt.validations).toContain('secretref-missing');
    expect(executable.receipt.requiredSecretRefs).toHaveLength(0);
    expect(executable.receipt.transportActuallyOpened).toBe(false);
  });

  it('detects unknown or degraded transport metadata without crashing', () => {
    const registry = createZavorthNativeIntegrationRegistryFixture();
    const unknownTransport = registry.list({
      integrationKind: 'message-transport',
      classification: 'unknown',
    })[0];

    const executable = createZavorthWave4B2TransportReadinessCheckExecutableFixture({
      source: {
        integrationRegistry: registry,
      },
      targetTransportIntegrationId: unknownTransport?.id ?? 'missing-unknown-transport',
    });

    expect(executable.receipt.decision).toBe('readiness-degraded');
    expect(executable.receipt.validations).toEqual(expect.arrayContaining([
      'transport-metadata-valid',
      'transport-degraded',
      'secretref-metadata-only',
    ]));
    expect(executable.receipt.externalExecutorTouched).toBe(false);
  });

  it('detects missing channel or transport metadata as readiness-unknown', () => {
    const executable = createZavorthWave4B2TransportReadinessCheckExecutableFixture({
      targetChannelIntegrationId: 'missing-zavorth-channel',
      targetTransportIntegrationId: 'missing-zavorth-transport',
    });

    expect(executable.receipt.decision).toBe('readiness-unknown');
    expect(executable.receipt.validations).toEqual(expect.arrayContaining([
      'channel-unavailable',
      'transport-unavailable',
    ]));
    expect(executable.receipt.externalExecutorTouched).toBe(false);
    expect(executable.receipt.transportActuallyOpened).toBe(false);
  });

  it('returns readiness-policy-rejected when Zavorth policy blocks readiness', () => {
    const executable = createZavorthWave4B2TransportReadinessCheckExecutableFixture({
      source: {
        policyAllowsReadinessCheck: false,
      },
    });

    expect(executable.receipt.decision).toBe('readiness-policy-rejected');
    expect(executable.receipt.validations).toContain('policy-rejected');
    expect(executable.receipt.policyPreflight.messageSendBlocked).toBe(true);
    expect(executable.receipt.externalExecutorTouched).toBe(false);
  });

  it('blocks high-impact attempts instead of sending or opening transport', () => {
    const executable = createZavorthWave4B2TransportReadinessCheckExecutableFixture({
      source: {
        realMessageSendAttempted: true,
        transportOpenAttempted: true,
        providerRealExecutionAttempted: true,
        toolCommandRealExecutionAttempted: true,
      },
    });

    expect(executable.receipt.decision).toBe('readiness-blocked');
    expect(executable.receipt.validations).toContain('high-impact-execution-attempted');
    expect(executable.receipt.realMessageSendAllowed).toBe(false);
    expect(executable.receipt.providerRealExecutionAllowed).toBe(false);
    expect(executable.receipt.toolCommandRealExecutionAllowed).toBe(false);
    expect(executable.receipt.transportActuallyOpened).toBe(false);
  });

  it('is idempotent across re-runs and never serializes raw secret or raw message content', () => {
    const first = createZavorthWave4B2TransportReadinessCheckExecutableFixture();
    const second = createZavorthWave4B2TransportReadinessCheckExecutableFixture();

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
    assertNoRawSecret(JSON.stringify(first.receipt));
    expect(JSON.stringify(first.receipt)).not.toContain('raw user message body that must never migrate');
  });

  it('keeps every required high-impact guarantee false', () => {
    const executable = createZavorthWave4B2TransportReadinessCheckExecutableFixture();

    expect(executable.receipt).toEqual(expect.objectContaining({
      wave4b2TransportReadinessCheckExecutableCreated: true,
      transportReadinessCheckActuallyExecutedOnlyWhenFlagEnabled: true,
      runtimeExternalExecutorRequiredForExecution: false,
      externalExecutorTouched: false,
      realMessageSendAllowed: false,
      providerRealExecutionAllowed: false,
      toolCommandRealExecutionAllowed: false,
      externalExecutorMutationAllowed: false,
      rawHistoryMigrationAllowed: false,
      rawSqliteMigrationAllowed: false,
      transportActuallyOpened: false,
      rawSecretSerialized: false,
      sourceModuleCopied: false,
      adapterRemovalGlobalAllowed: false,
    }));
    expect(executable.receipt.sourceMetadata).toEqual(expect.objectContaining({
      nativeIntegrationRegistryUsed: true,
      transportDiscoveryMetadataUsed: true,
      messageSendTransportBlockedRehearsalUsed: true,
      sourceProvenanceInternalRedacted: true,
    }));
  });
});
