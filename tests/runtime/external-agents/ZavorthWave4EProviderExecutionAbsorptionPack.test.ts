import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4E_PROVIDER_EXECUTION_EXECUTE_FLAG,
  createZavorthWave4EProviderExecutionAbsorptionPackFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4EProviderClass,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/241-wave-4e-provider-execution-absorption-pack.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/240-wave-4d-message-send-expansion-and-audit-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4EProviderExecutionAbsorptionPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const PROVIDER_CLASSES: ZavorthWave4EProviderClass[] = [
  'sandbox/no-cost',
  'dry-run-only',
  'approval-required',
  'blocked',
  'unknown',
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

describe('Wave 4E provider execution absorption pack', () => {
  it('documents 241 as the provider execution absorption pack', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `provider-execution-absorption-pack-ready`');
    expect(content).toContain('ZavorthWave4EProviderExecutionAbsorptionPack.ts');
    expect(content).toContain('ZavorthWave4EProviderExecutionAbsorptionPack/v1');
    expect(content).toContain('ZavorthWave4EProviderReadinessRecord/v1');
    expect(content).toContain('ZavorthWave4EProviderDryRunPlan/v1');
    expect(content).toContain('ZavorthWave4EProviderSandboxExecutionReceipt/v1');
    expect(content).toContain(ZAVORTH_WAVE4E_PROVIDER_EXECUTION_EXECUTE_FLAG);
    expect(content).toContain('providerExecutionAbsorptionPackCreated=true');
    expect(content).toContain('providerDryRunSupported=true');
    expect(content).toContain('providerRealExecutionOnlySandboxNoCostWhenFlagEnabled=true');
    expect(content).toContain('paidProviderExecutionAllowed=false');
    expect(content).toContain('sideEffectProviderExecutionAllowed=false');
    expect(content).toContain('tool-command-execution-absorption-pack');
    PROVIDER_CLASSES.forEach((providerClass) => expect(content).toContain(providerClass));
    assertNoRawSecretOrContent(content);
  });

  it('updates tracking docs and the 240 handoff for 241', () => {
    expect(read(GO_NO_GO_DOC)).toContain(DOC);
    expect(read(PAUSE_DOC)).toContain('`241` opens Wave 4E');
    expect(read(PRIOR_DOC)).toContain('Provider Execution Absorption Follow-Up');
    expect(read(PRIOR_DOC)).toContain(DOC);
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond `241`');
  });

  it('exports the provider execution absorption boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4EProviderExecutionAbsorptionPack/v1');
    expect(boundary).toContain('ZavorthWave4EProviderReadinessRecord/v1');
    expect(boundary).toContain('ZavorthWave4EProviderDryRunReceipt/v1');
    expect(boundary).toContain('ZavorthWave4EProviderSandboxExecutionReceipt/v1');
    expect(index).toContain("from './ZavorthWave4EProviderExecutionAbsorptionPack.js'");
    expect(index).toContain('ZAVORTH_WAVE4E_PROVIDER_EXECUTION_EXECUTE_FLAG');
  });

  it('classifies providers by readiness, risk, cost, side effects, and SecretRef metadata', () => {
    const pack = createZavorthWave4EProviderExecutionAbsorptionPackFixture();

    expect(pack.normalization.decision).toBe('provider-execution-absorption-pack-ready');
    PROVIDER_CLASSES.forEach((providerClass) => {
      expect(pack.providersByClass(providerClass).length).toBeGreaterThan(0);
    });
    expect(pack.providersByClass('sandbox/no-cost')[0]).toEqual(expect.objectContaining({
      providerClass: 'sandbox/no-cost',
      costClass: 'no-cost',
      sideEffectClass: 'none',
      sandboxExplicitlyAllowed: true,
      policyDisposition: 'safe-sandbox-no-cost',
      runtimeExternalExecutorRequiredForProviderReadiness: false,
      rawSecretSerialized: false,
    }));
    pack.normalization.providerReadiness.forEach((provider) => {
      provider.requiredSecretRefs.forEach((secretRef) => {
        expect(secretRef.nativeContract).toBe('ZavorthWave4EProviderSecretRefMetadata/v1');
        expect(secretRef.rawValueSerialized).toBe(false);
      });
    });
  });

  it('builds a provider dry-run plan without invoking a provider', () => {
    const pack = createZavorthWave4EProviderExecutionAbsorptionPackFixture();

    expect(pack.normalization.providerDryRun).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4EProviderDryRunReceipt/v1',
      decision: 'dry-run-ok',
      providerDryRunSupported: true,
      providerActuallyInvoked: false,
      rawInputRejected: false,
      rawSecretSerialized: false,
    }));
    expect(pack.normalization.providerDryRun.dryRunPlan).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4EProviderDryRunPlan/v1',
      mode: 'provider-dry-run-only',
      providerActuallyInvoked: false,
      paidProviderExecutionAllowed: false,
      sideEffectProviderExecutionAllowed: false,
      rawSecretSerialized: false,
    }));
    expect(pack.normalization.providerDryRun.dryRunPlan.promptEnvelope).toEqual({
      nativeContract: 'ZavorthWave4EProviderPromptEnvelope/v1',
      inputKind: 'redacted-fixture',
      redactedPrompt: '[redacted-provider-dry-run-input]',
      rawPromptSerialized: false,
      rawContentUsageAllowed: false,
      rawSecretSerialized: false,
    });
  });

  it('blocks sandbox/no-cost execution when the feature flag is disabled', () => {
    const pack = createZavorthWave4EProviderExecutionAbsorptionPackFixture({
      featureFlagEnabled: false,
    });

    expect(pack.normalization.sandboxExecution.decision).toBe('provider-execution-blocked-feature-flag');
    expect(pack.normalization.sandboxExecution.statuses).toContain('feature-flag-disabled');
    expect(pack.normalization.sandboxExecution.sandboxNoCostProviderActuallyExecuted).toBe(false);
    expect(pack.normalization.sandboxExecution.featureFlag.enabled).toBe(false);
  });

  it('records no-safe-provider-execution-target when no sandbox/no-cost target exists', () => {
    const pack = createZavorthWave4EProviderExecutionAbsorptionPackFixture({
      source: {
        sandboxNoCostProviderAvailable: false,
        sandboxNoCostProviderExplicitlyAllowed: false,
      },
    });

    expect(pack.normalization.decision).toBe('no-safe-provider-execution-target');
    expect(pack.noSafeTargetRecorded()).toBe(true);
    expect(pack.normalization.sandboxExecution).toEqual(expect.objectContaining({
      decision: 'no-safe-provider-execution-target',
      sandboxNoCostProviderActuallyExecuted: false,
    }));
  });

  it('executes only the sandbox/no-cost fixture provider when the feature flag and policy pass', () => {
    const pack = createZavorthWave4EProviderExecutionAbsorptionPackFixture({
      featureFlagEnabled: true,
    });

    expect(pack.sandboxExecutionSucceeded()).toBe(true);
    expect(pack.normalization.sandboxExecution).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4EProviderSandboxExecutionReceipt/v1',
      decision: 'sandbox-no-cost-execution-ok',
      selectedProviderId: 'zavorth-native-provider:sandbox-no-cost-fixture',
      sandboxNoCostProviderActuallyExecuted: true,
      providerRealExecutionOnlySandboxNoCostWhenFlagEnabled: true,
      paidProviderExecutionAllowed: false,
      sideEffectProviderExecutionAllowed: false,
      rawContentUsageAllowed: false,
      rawSecretSerialized: false,
    }));
    expect(pack.normalization.sandboxExecution.providerResultEnvelope).toEqual({
      nativeContract: 'ZavorthWave4EProviderSandboxResultEnvelope/v1',
      resultKind: 'fixture-no-cost-ack',
      output: '[redacted-provider-sandbox-result]',
      tokenUsageCostClass: 'no-cost',
      externalSideEffect: false,
      rawOutputSerialized: false,
      rawSecretSerialized: false,
    });
    expect(pack.normalization.sandboxExecution.cleanupReceipt.cleanupConfirmed).toBe(true);
  });

  it('keeps paid and side-effect providers blocked', () => {
    const pack = createZavorthWave4EProviderExecutionAbsorptionPackFixture();

    expect(pack.highImpactProvidersBlocked()).toBe(true);
    expect(pack.providersByClass('blocked')).toEqual(expect.arrayContaining([
      expect.objectContaining({
        providerClass: 'blocked',
        costClass: 'paid',
        sideEffectClass: 'external-side-effect',
        policyDisposition: 'blocked-paid-or-side-effect',
      }),
    ]));
    expect(pack.normalization.executionGate.paidProviderExecutionAllowed).toBe(false);
    expect(pack.normalization.executionGate.sideEffectProviderExecutionAllowed).toBe(false);
  });

  it('blocks unsafe attempts, raw input, raw secrets, message send, tool/command execution, ExternalExecutor mutation, source copy, and adapter removal', () => {
    const pack = createZavorthWave4EProviderExecutionAbsorptionPackFixture({
      source: {
        rawInputAttempted: true,
        rawSecretSerialized: true,
        rawContentUsageAttempted: true,
        paidProviderExecutionAttempted: true,
        sideEffectProviderExecutionAttempted: true,
        unsafeProviderExecutionAttempted: true,
        messageSendAttempted: true,
        toolCommandExecutionAttempted: true,
        externalExecutorMutationAttempted: true,
        sourceModuleCopyAttempted: true,
        adapterRemovalAttempted: true,
        publicExternalExecutorIdentityExposed: true,
      },
    });

    expect(pack.normalization.decision).toBe('blocked');
    expect(pack.normalization.sandboxExecution.decision).toBe('provider-execution-raw-input-rejected');
    expect(pack.normalization.sandboxExecution.sandboxNoCostProviderActuallyExecuted).toBe(false);
    expect(pack.normalization.executionGate).toEqual(expect.objectContaining({
      paidProviderExecutionAllowed: false,
      sideEffectProviderExecutionAllowed: false,
      rawSecretSerialized: false,
      rawContentUsageAllowed: false,
      messageActuallySent: false,
      toolCommandRealExecutionAllowed: false,
      externalExecutorMutationAllowed: false,
      sourceModuleCopied: false,
      adapterRemovalGlobalAllowed: false,
    }));
  });

  it('records the milestone, recommendation, closed guarantees, and redaction envelope', () => {
    const pack = createZavorthWave4EProviderExecutionAbsorptionPackFixture();
    const serialized = JSON.stringify(pack.normalization);

    expect(pack.normalization.milestone).toEqual({
      nativeContract: 'ZavorthWave4EProviderAbsorptionMilestone/v1',
      readinessRecorded: true,
      dryRunRecorded: true,
      sandboxNoCostExecutionRecorded: true,
      noSafeProviderExecutionTargetRecorded: false,
      providersRealCostSideEffectsBlocked: true,
      nextDomainRecommendation: 'tool-command-execution-absorption-pack',
      rawSecretSerialized: false,
    });
    expect(pack.normalization.executionGate).toEqual({
      providerExecutionAbsorptionPackCreated: true,
      providerDryRunSupported: true,
      providerRealExecutionOnlySandboxNoCostWhenFlagEnabled: true,
      paidProviderExecutionAllowed: false,
      sideEffectProviderExecutionAllowed: false,
      rawSecretSerialized: false,
      rawContentUsageAllowed: false,
      messageActuallySent: false,
      toolCommandRealExecutionAllowed: false,
      externalExecutorMutationAllowed: false,
      sourceModuleCopied: false,
      adapterRemovalGlobalAllowed: false,
    });
    expect(pack.normalization.redaction).toEqual({
      rawSecretSerialized: false,
      rawContentSerialized: false,
      secretRefsMetadataOnly: true,
      sourceIdentityPublic: false,
      serializedOutputContainsSensitiveFixture: false,
    });
    expect(pack.normalization.nextDomainRecommended).toBe('tool-command-execution-absorption-pack');
    assertNoRawSecretOrContent(serialized);
  });
});
