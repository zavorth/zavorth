import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTE_FLAG,
  ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTABLE_RUNTIME_ID,
  createZavorthNativeIntegrationRegistryFixture,
  createZavorthWave4B2TargetSessionChannelValidationExecutableFixture,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/223-wave-4b2-target-session-channel-validation-executable.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/222-wave-4b2-medium-risk-executable-capability-selection.md';
const PRIOR_TEST = 'tests/runtime/external-agents/ZavorthWave4B2MediumRiskExecutableCapabilitySelection.test.ts';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4B2TargetSessionChannelValidationExecutable.ts';
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

describe('Wave 4B.2 target/session/channel validation executable', () => {
  it('documents 223 as a guarded metadata-only executable gate', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `wave4b2-target-session-channel-validation-executable-ready`');
    expect(content).toContain('target-session-channel-validation-action');
    expect(content).toContain('ZavorthWave4B2TargetSessionChannelValidationExecutable.ts');
    expect(content).toContain('ZavorthWave4B2TargetSessionChannelValidationExecutableReceipt/v1');
    expect(content).toContain(ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTE_FLAG);
    expect(content).toContain('wave4b2TargetSessionChannelValidationExecutableCreated=true');
    expect(content).toContain('targetSessionChannelValidationActuallyExecutedOnlyWhenFlagEnabled=true');
    expect(content).toContain('runtimeExternalExecutorRequiredForExecution=false');
    expect(content).toContain('externalExecutorTouched=false');
    expect(content).toContain('realMessageSendAllowed=false');
    expect(content).toContain('transportActuallyOpened=false');
    expect(content).toContain('rawSecretSerialized=false');
    expect(content).toContain('docs/224-wave-4b2-transport-readiness-check-executable.md');
    expect(content).toContain('Do not advance beyond `224`');
    expect(content).not.toMatch(RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN);
  });

  it('updates tracking docs and the 222 handoff for 223', () => {
    expect(read(GO_NO_GO_DOC)).toContain('docs/223-wave-4b2-target-session-channel-validation-executable.md');
    expect(read(PAUSE_DOC)).toContain('`223` executes the first Wave 4B.2 medium-risk');
    expect(read(PRIOR_DOC)).toContain('Wave 4B.2 target/session/channel validation executable follow-up:');
    expect(read(PRIOR_DOC)).toContain('docs/223-wave-4b2-target-session-channel-validation-executable.md');
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond `223`');
    expect(read(PRIOR_TEST)).toContain('docs/223-wave-4b2-target-session-channel-validation-executable.md');
  });

  it('exports the executable boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4B2TargetSessionChannelValidationExecutableReceipt/v1');
    expect(boundary).toContain('ZavorthWave4B2TargetSessionChannelValidationFeatureFlagGate/v1');
    expect(boundary).toContain('ZavorthWave4B2TargetSessionChannelValidationTarget/v1');
    expect(boundary).toContain('ZavorthWave4B2TargetSessionChannelValidationPolicyPreflight/v1');
    expect(boundary).toContain('ZavorthWave4B2TargetSessionChannelValidationCleanupReceipt/v1');
    expect(index).toContain("from './ZavorthWave4B2TargetSessionChannelValidationExecutable.js'");
    expect(index).toContain('ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTABLE_RUNTIME_ID');
  });

  it('blocks execution when the feature flag is disabled', () => {
    const executable = createZavorthWave4B2TargetSessionChannelValidationExecutableFixture({
      featureFlagEnabled: false,
    });

    expect(executable.receipt).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4B2TargetSessionChannelValidationExecutableReceipt/v1',
      runtimeId: ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTABLE_RUNTIME_ID,
      selectedMediumRiskCapability: 'target-session-channel-validation-action',
      decision: 'execution-blocked',
      classification: 'execution-blocked',
      targetSessionChannelValidationActuallyExecuted: false,
      targetSessionChannelValidationActuallyExecutedOnlyWhenFlagEnabled: true,
      runtimeExternalExecutorRequiredForExecution: false,
      externalExecutorTouched: false,
    }));
    expect(executable.receipt.validations).toContain('feature-flag-disabled');
    expect(executable.validationSucceeded()).toBe(false);
    assertNoRawSecret(JSON.stringify(executable.receipt));
  });

  it('executes metadata-only target/session/channel validation when the feature flag is enabled', () => {
    const executable = createZavorthWave4B2TargetSessionChannelValidationExecutableFixture({
      featureFlagEnabled: true,
    });

    expect(executable.receipt.decision).toBe('validation-degraded');
    expect(executable.validationSucceeded()).toBe(false);
    expect(executable.messageSendStillBlocked()).toBe(true);
    expect(executable.receipt.validations).toEqual(expect.arrayContaining([
      'session-linkage-valid',
      'thread-linkage-valid',
      'channel-linkage-valid',
      'transport-linkage-valid',
      'secretref-metadata-only',
      'participant-metadata-redacted',
      'policy-eligible',
      'idempotency-valid',
      'degraded-state',
    ]));
    expect(executable.receipt.target).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4B2TargetSessionChannelValidationTarget/v1',
      sourceIdentityPublic: false,
      rawParticipantIdsSerialized: false,
      rawMessageContentSerialized: false,
    }));
    expect(executable.receipt.policyPreflight).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4B2TargetSessionChannelValidationPolicyPreflight/v1',
      policyPreflightRequired: true,
      policyRecheckedImmediatelyBeforeExecution: true,
      approvalRequired: false,
      messageSendBlocked: true,
      providerExecutionBlocked: true,
      toolCommandExecutionBlocked: true,
      externalTransportBlocked: true,
      rawHistoryMigrationBlocked: true,
    }));
  });

  it('keeps send-capable transport blocked and SecretRefs as metadata only', () => {
    const integrationRegistry = createZavorthNativeIntegrationRegistryFixture();
    const sendCapableTransport = integrationRegistry.list({
      integrationKind: 'message-transport',
      classification: 'send-capable-but-blocked',
      supportsSend: true,
    })[0];

    const executable = createZavorthWave4B2TargetSessionChannelValidationExecutableFixture({
      source: {
        integrationRegistry,
      },
      targetTransportIntegrationId: sendCapableTransport?.id,
    });

    expect(executable.receipt.target.sendCapableStatus).toBe('send-capable-but-blocked');
    expect(executable.receipt.validations).toEqual(expect.arrayContaining([
      'send-capable-blocked',
      'degraded-state',
    ]));
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

  it('detects missing target sessions without crashing or touching ExternalExecutor', () => {
    const executable = createZavorthWave4B2TargetSessionChannelValidationExecutableFixture({
      targetSessionId: 'missing-zavorth-session',
    });

    expect(executable.receipt.decision).toBe('validation-target-missing');
    expect(executable.receipt.validations).toEqual(expect.arrayContaining([
      'target-missing',
      'thread-linkage-invalid',
    ]));
    expect(executable.receipt.externalExecutorTouched).toBe(false);
    expect(executable.receipt.runtimeExternalExecutorRequiredForExecution).toBe(false);
  });

  it('detects unavailable channel or transport metadata as validation-channel-unavailable', () => {
    const executable = createZavorthWave4B2TargetSessionChannelValidationExecutableFixture({
      targetChannelIntegrationId: 'missing-zavorth-channel',
    });

    expect(executable.receipt.decision).toBe('validation-channel-unavailable');
    expect(executable.receipt.validations).toContain('channel-unavailable');
    expect(executable.receipt.externalExecutorTouched).toBe(false);
    expect(executable.receipt.transportActuallyOpened).toBe(false);
  });

  it('preserves degraded or unavailable state honestly', () => {
    const integrationRegistry = createZavorthNativeIntegrationRegistryFixture();
    const degradedTransport = integrationRegistry.list({
      degradedOrUnavailable: true,
      integrationKind: 'message-transport',
    })[0];

    const executable = createZavorthWave4B2TargetSessionChannelValidationExecutableFixture({
      source: {
        integrationRegistry,
      },
      targetTransportIntegrationId: degradedTransport?.id ?? 'missing-degraded-transport',
    });

    expect(executable.receipt.decision).toBe('validation-degraded');
    expect(executable.receipt.validations).toEqual(expect.arrayContaining([
      'transport-linkage-valid',
      'degraded-state',
    ]));
    expect(executable.receipt.externalExecutorTouched).toBe(false);
  });

  it('returns validation-policy-rejected when Zavorth policy blocks the target', () => {
    const executable = createZavorthWave4B2TargetSessionChannelValidationExecutableFixture({
      source: {
        policyAllowsValidation: false,
      },
    });

    expect(executable.receipt.decision).toBe('validation-policy-rejected');
    expect(executable.receipt.validations).toContain('policy-rejected');
    expect(executable.receipt.policyPreflight.messageSendBlocked).toBe(true);
    expect(executable.receipt.externalExecutorTouched).toBe(false);
  });

  it('blocks high-impact attempts instead of executing send/provider/tool/transport paths', () => {
    const executable = createZavorthWave4B2TargetSessionChannelValidationExecutableFixture({
      source: {
        realMessageSendAttempted: true,
        transportOpenAttempted: true,
        providerRealExecutionAttempted: true,
        toolCommandRealExecutionAttempted: true,
      },
    });

    expect(executable.receipt.decision).toBe('validation-blocked');
    expect(executable.receipt.validations).toContain('high-impact-execution-attempted');
    expect(executable.receipt.realMessageSendAllowed).toBe(false);
    expect(executable.receipt.providerRealExecutionAllowed).toBe(false);
    expect(executable.receipt.toolCommandRealExecutionAllowed).toBe(false);
    expect(executable.receipt.transportActuallyOpened).toBe(false);
  });

  it('is idempotent across re-runs and never serializes raw secret or raw message content', () => {
    const first = createZavorthWave4B2TargetSessionChannelValidationExecutableFixture();
    const second = createZavorthWave4B2TargetSessionChannelValidationExecutableFixture();

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
    const executable = createZavorthWave4B2TargetSessionChannelValidationExecutableFixture();

    expect(executable.receipt).toEqual(expect.objectContaining({
      wave4b2TargetSessionChannelValidationExecutableCreated: true,
      targetSessionChannelValidationActuallyExecutedOnlyWhenFlagEnabled: true,
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
      migratedSessionChannelTargetMetadataUsed: true,
      nativeSessionHistoryRegistryUsed: true,
      nativeIntegrationRegistryUsed: true,
      sourceProvenanceInternalRedacted: true,
    }));
  });
});
