import fs from 'node:fs';
import path from 'node:path';

import {
  ZAVORTH_WAVE4F_TOOL_COMMAND_EXECUTION_EXECUTE_FLAG,
  createZavorthWave4FToolCommandExecutionAbsorptionPackFixture,
} from '../../../src/runtime/external-agents/index.js';
import type {
  ZavorthWave4FToolCommandClass,
} from '../../../src/runtime/external-agents/index.js';

const DOC = 'docs/242-wave-4f-tool-command-execution-absorption-pack.md';
const GO_NO_GO_DOC = 'docs/117-external-agent-full-absorption-go-no-go.md';
const PAUSE_DOC = 'docs/159-external-executor-secret-provisioning-pause.md';
const PRIOR_DOC = 'docs/241-wave-4e-provider-execution-absorption-pack.md';
const BOUNDARY = 'src/runtime/external-agents/ZavorthWave4FToolCommandExecutionAbsorptionPack.ts';
const INDEX = 'src/runtime/external-agents/index.ts';
const RAW_GATEWAY_TOKEN_ASSIGNMENT_PATTERN = new RegExp(
  'EXTERNAL_EXECUTOR_GATEWAY_TOKEN' + '=(?!present-redacted|<redacted-local-secret>)[^\\s`]+',
);

const TOOL_COMMAND_CLASSES: ZavorthWave4FToolCommandClass[] = [
  'sandbox/no-op',
  'read-only',
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

describe('Wave 4F tool/command execution absorption pack', () => {
  it('documents 242 as the tool/command execution absorption pack', () => {
    const content = read(DOC);

    expect(content).toContain('Status: `tool-command-execution-absorption-pack-ready`');
    expect(content).toContain('ZavorthWave4FToolCommandExecutionAbsorptionPack.ts');
    expect(content).toContain('ZavorthWave4FToolCommandExecutionAbsorptionPack/v1');
    expect(content).toContain('ZavorthWave4FToolCommandReadinessRecord/v1');
    expect(content).toContain('ZavorthWave4FToolCommandDryRunEnvelope/v1');
    expect(content).toContain('ZavorthWave4FToolCommandSandboxExecutionReceipt/v1');
    expect(content).toContain(ZAVORTH_WAVE4F_TOOL_COMMAND_EXECUTION_EXECUTE_FLAG);
    expect(content).toContain('toolCommandExecutionAbsorptionPackCreated=true');
    expect(content).toContain('toolCommandDryRunSupported=true');
    expect(content).toContain('toolCommandRealExecutionOnlySandboxNoopOrReadOnlyWhenFlagEnabled=true');
    expect(content).toContain('dangerousToolCommandExecutionAllowed=false');
    expect(content).toContain('filesystemMutationAllowed=false');
    expect(content).toContain('networkMutationAllowed=false');
    expect(content).toContain('processSpawnAllowedOnlyIfSandboxApproved=true');
    expect(content).toContain('final-adapter-domain-decommission-pack');
    TOOL_COMMAND_CLASSES.forEach((toolCommandClass) => expect(content).toContain(toolCommandClass));
    assertNoRawSecretOrContent(content);
  });

  it('updates tracking docs and the 241 handoff for 242', () => {
    expect(read(GO_NO_GO_DOC)).toContain(DOC);
    expect(read(PAUSE_DOC)).toContain('`242` opens Wave 4F');
    expect(read(PRIOR_DOC)).toContain('Tool/Command Execution Absorption Follow-Up');
    expect(read(PRIOR_DOC)).toContain(DOC);
    expect(read(PRIOR_DOC)).toContain('Do not advance beyond `242`');
  });

  it('exports the tool/command execution absorption boundary and contracts', () => {
    const boundary = read(BOUNDARY);
    const index = read(INDEX);

    expect(boundary).toContain('ZavorthWave4FToolCommandExecutionAbsorptionPack/v1');
    expect(boundary).toContain('ZavorthWave4FToolCommandReadinessRecord/v1');
    expect(boundary).toContain('ZavorthWave4FToolCommandDryRunReceipt/v1');
    expect(boundary).toContain('ZavorthWave4FToolCommandSandboxExecutionReceipt/v1');
    expect(index).toContain("from './ZavorthWave4FToolCommandExecutionAbsorptionPack.js'");
    expect(index).toContain('ZAVORTH_WAVE4F_TOOL_COMMAND_EXECUTION_EXECUTE_FLAG');
  });

  it('classifies tools and commands by risk, sandbox policy, filesystem, network, process, and SecretRef metadata', () => {
    const pack = createZavorthWave4FToolCommandExecutionAbsorptionPackFixture();

    expect(pack.normalization.decision).toBe('tool-command-execution-absorption-pack-ready');
    TOOL_COMMAND_CLASSES.forEach((toolCommandClass) => {
      expect(pack.commandsByClass(toolCommandClass).length).toBeGreaterThan(0);
    });
    expect(pack.commandsByClass('sandbox/no-op')[0]).toEqual(expect.objectContaining({
      toolCommandClass: 'sandbox/no-op',
      riskClass: 'sandbox-no-op',
      filesystemRisk: 'none',
      networkRisk: 'none',
      processRisk: 'sandbox-approved-no-spawn',
      workingDirectoryPolicy: 'zavorth-owned-sandbox',
      policyDisposition: 'safe-sandbox-noop',
      runtimeExternalExecutorRequiredForToolCommandReadiness: false,
      rawSecretSerialized: false,
    }));
    pack.normalization.toolCommandReadiness.forEach((record) => {
      record.requiredSecretRefs.forEach((secretRef) => {
        expect(secretRef.nativeContract).toBe('ZavorthWave4FToolCommandSecretRefMetadata/v1');
        expect(secretRef.rawValueSerialized).toBe(false);
      });
    });
  });

  it('builds a dry-run execution envelope without dangerous execution or process spawn', () => {
    const pack = createZavorthWave4FToolCommandExecutionAbsorptionPackFixture();

    expect(pack.normalization.toolCommandDryRun).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4FToolCommandDryRunReceipt/v1',
      decision: 'dry-run-ok',
      toolCommandDryRunSupported: true,
      commandActuallyExecuted: false,
      processSpawnActuallyPerformed: false,
      rawInputRejected: false,
      rawSecretSerialized: false,
    }));
    expect(pack.normalization.toolCommandDryRun.envelope).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4FToolCommandDryRunEnvelope/v1',
      mode: 'tool-command-dry-run-only',
      workingDirectoryPolicy: 'zavorth-owned-sandbox',
      filesystemMutationAllowed: false,
      networkMutationAllowed: false,
      processSpawnActuallyPerformed: false,
      processSpawnAllowedOnlyIfSandboxApproved: true,
      dangerousToolCommandExecutionAllowed: false,
      rawSecretSerialized: false,
    }));
    expect(pack.normalization.toolCommandDryRun.envelope.argsEnvelope).toEqual({
      nativeContract: 'ZavorthWave4FToolCommandArgsEnvelope/v1',
      argsKind: 'redacted-fixture',
      redactedArgs: ['--dry-run'],
      rawArgsSerialized: false,
      rawContentUsageAllowed: false,
      rawSecretSerialized: false,
    });
  });

  it('blocks sandbox/no-op execution when the feature flag is disabled', () => {
    const pack = createZavorthWave4FToolCommandExecutionAbsorptionPackFixture({
      featureFlagEnabled: false,
    });

    expect(pack.normalization.sandboxExecution.decision).toBe('tool-command-execution-blocked-feature-flag');
    expect(pack.normalization.sandboxExecution.statuses).toContain('feature-flag-disabled');
    expect(pack.normalization.sandboxExecution.sandboxNoopCommandActuallyExecuted).toBe(false);
    expect(pack.normalization.sandboxExecution.featureFlag.enabled).toBe(false);
  });

  it('records no-safe-tool-command-execution-target when no safe command target exists', () => {
    const pack = createZavorthWave4FToolCommandExecutionAbsorptionPackFixture({
      source: {
        sandboxNoopCommandAvailable: false,
        sandboxNoopCommandExplicitlyAllowed: false,
      },
    });

    expect(pack.normalization.decision).toBe('no-safe-tool-command-execution-target');
    expect(pack.noSafeTargetRecorded()).toBe(true);
    expect(pack.normalization.sandboxExecution).toEqual(expect.objectContaining({
      decision: 'no-safe-tool-command-execution-target',
      sandboxNoopCommandActuallyExecuted: false,
    }));
  });

  it('executes only the sandbox/no-op fixture command when flag, policy, idempotency, and sandbox guards pass', () => {
    const pack = createZavorthWave4FToolCommandExecutionAbsorptionPackFixture({
      featureFlagEnabled: true,
    });

    expect(pack.sandboxNoopExecutionSucceeded()).toBe(true);
    expect(pack.normalization.sandboxExecution).toEqual(expect.objectContaining({
      nativeContract: 'ZavorthWave4FToolCommandSandboxExecutionReceipt/v1',
      decision: 'sandbox-noop-execution-ok',
      selectedCommandId: 'zavorth-native-tool-command:sandbox-noop-fixture',
      sandboxNoopCommandActuallyExecuted: true,
      toolCommandRealExecutionOnlySandboxNoopOrReadOnlyWhenFlagEnabled: true,
      dangerousToolCommandExecutionAllowed: false,
      filesystemMutationAllowed: false,
      networkMutationAllowed: false,
      processSpawnAllowedOnlyIfSandboxApproved: true,
      rawSecretSerialized: false,
    }));
    expect(pack.normalization.sandboxExecution.commandResultEnvelope).toEqual({
      nativeContract: 'ZavorthWave4FToolCommandSandboxResultEnvelope/v1',
      resultKind: 'fixture-noop-ack',
      output: '[redacted-tool-command-sandbox-result]',
      filesystemMutation: false,
      networkMutation: false,
      processSpawnActuallyPerformed: false,
      rawOutputSerialized: false,
      rawSecretSerialized: false,
    });
    expect(pack.normalization.sandboxExecution.cleanupReceipt.cleanupConfirmed).toBe(true);
  });

  it('keeps dangerous commands, filesystem mutation, network mutation, and unsafe process spawn blocked', () => {
    const pack = createZavorthWave4FToolCommandExecutionAbsorptionPackFixture();

    expect(pack.dangerousExecutionBlocked()).toBe(true);
    expect(pack.commandsByClass('blocked')).toEqual(expect.arrayContaining([
      expect.objectContaining({
        toolCommandClass: 'blocked',
        riskClass: 'dangerous',
        filesystemRisk: 'mutation-blocked',
        policyDisposition: 'blocked-dangerous',
      }),
    ]));
    expect(pack.normalization.executionGate.dangerousToolCommandExecutionAllowed).toBe(false);
    expect(pack.normalization.executionGate.filesystemMutationAllowed).toBe(false);
    expect(pack.normalization.executionGate.networkMutationAllowed).toBe(false);
    expect(pack.normalization.executionGate.processSpawnAllowedOnlyIfSandboxApproved).toBe(true);
  });

  it('blocks unsafe attempts, raw input, raw secrets, message send, paid/side-effect providers, ExternalExecutor mutation, source copy, and adapter removal', () => {
    const pack = createZavorthWave4FToolCommandExecutionAbsorptionPackFixture({
      source: {
        rawInputAttempted: true,
        rawSecretSerialized: true,
        rawContentUsageAttempted: true,
        dangerousCommandExecutionAttempted: true,
        filesystemMutationAttempted: true,
        networkMutationAttempted: true,
        processSpawnAttemptedWithoutSandbox: true,
        messageSendAttempted: true,
        paidProviderExecutionAttempted: true,
        sideEffectProviderExecutionAttempted: true,
        externalExecutorMutationAttempted: true,
        sourceModuleCopyAttempted: true,
        adapterRemovalAttempted: true,
        publicExternalExecutorIdentityExposed: true,
      },
    });

    expect(pack.normalization.decision).toBe('blocked');
    expect(pack.normalization.sandboxExecution.decision).toBe('tool-command-execution-raw-input-rejected');
    expect(pack.normalization.sandboxExecution.sandboxNoopCommandActuallyExecuted).toBe(false);
    expect(pack.normalization.executionGate).toEqual(expect.objectContaining({
      dangerousToolCommandExecutionAllowed: false,
      filesystemMutationAllowed: false,
      networkMutationAllowed: false,
      rawSecretSerialized: false,
      rawContentUsageAllowed: false,
      messageActuallySent: false,
      paidProviderExecutionAllowed: false,
      sideEffectProviderExecutionAllowed: false,
      externalExecutorMutationAllowed: false,
      sourceModuleCopied: false,
      adapterRemovalGlobalAllowed: false,
    }));
  });

  it('records the milestone, recommendation, closed guarantees, and redaction envelope', () => {
    const pack = createZavorthWave4FToolCommandExecutionAbsorptionPackFixture();
    const serialized = JSON.stringify(pack.normalization);

    expect(pack.normalization.milestone).toEqual({
      nativeContract: 'ZavorthWave4FToolCommandAbsorptionMilestone/v1',
      readinessRecorded: true,
      dryRunRecorded: true,
      sandboxNoopExecutionRecorded: true,
      noSafeToolCommandExecutionTargetRecorded: false,
      dangerousToolsCommandsBlocked: true,
      nextDomainRecommendation: 'final-adapter-domain-decommission-pack',
      rawSecretSerialized: false,
    });
    expect(pack.normalization.executionGate).toEqual({
      toolCommandExecutionAbsorptionPackCreated: true,
      toolCommandDryRunSupported: true,
      toolCommandRealExecutionOnlySandboxNoopOrReadOnlyWhenFlagEnabled: true,
      dangerousToolCommandExecutionAllowed: false,
      filesystemMutationAllowed: false,
      networkMutationAllowed: false,
      processSpawnAllowedOnlyIfSandboxApproved: true,
      rawSecretSerialized: false,
      rawContentUsageAllowed: false,
      messageActuallySent: false,
      paidProviderExecutionAllowed: false,
      sideEffectProviderExecutionAllowed: false,
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
    expect(pack.normalization.nextDomainRecommended).toBe('final-adapter-domain-decommission-pack');
    assertNoRawSecretOrContent(serialized);
  });
});
