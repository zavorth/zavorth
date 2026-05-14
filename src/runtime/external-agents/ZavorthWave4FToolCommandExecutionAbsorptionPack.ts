import {
  createZavorthNativeConfigStateRegistryFixture,
} from './ZavorthNativeConfigStateRegistry.js';
import {
  createZavorthWave4EProviderExecutionAbsorptionPackFixture,
} from './ZavorthWave4EProviderExecutionAbsorptionPack.js';
import {
  normalizeWave1PluginCliCommandSurfaces,
  normalizeWave1PluginCommandDescriptors,
  normalizeWave1PluginGatewayMethodSurfaces,
  normalizeWave1PluginHttpRouteSurfaces,
  normalizeWave1PluginToolExposurePolicy,
} from './ExternalAgentWave1PluginCommandHttpFixtures.js';
import type {
  ZavorthNativeConfigStateRegistry,
} from './ZavorthNativeConfigStateRegistry.js';
import type {
  ZavorthWave4EProviderExecutionAbsorptionPackNormalization,
} from './ZavorthWave4EProviderExecutionAbsorptionPack.js';
import type {
  ExternalAgentWave1PluginCliCommandSurfaceNormalization,
  ExternalAgentWave1PluginCommandDescriptorNormalization,
  ExternalAgentWave1PluginGatewayMethodSurfaceNormalization,
  ExternalAgentWave1PluginHttpRouteSurfaceNormalization,
  ExternalAgentWave1PluginToolExposurePolicyNormalization,
} from './ExternalAgentWave1PluginCommandHttpFixtures.js';

export const ZAVORTH_WAVE4F_TOOL_COMMAND_EXECUTION_EXECUTE_FLAG = 'ZAVORTH_WAVE4F_TOOL_COMMAND_EXECUTION_EXECUTE' as const;
export const ZAVORTH_WAVE4F_TOOL_COMMAND_EXECUTION_ABSORPTION_PACK_NOW = '2026-05-01T13:00:00.000Z' as const;
export const ZAVORTH_WAVE4F_TOOL_COMMAND_EXECUTION_ABSORPTION_PACK_RUNTIME_ID = 'zavorth-wave4f-tool-command-execution-absorption-pack' as const;

export type ZavorthWave4FToolCommandExecutionPackDecision =
  | 'blocked'
  | 'no-safe-tool-command-execution-target'
  | 'tool-command-execution-absorption-pack-ready';

export type ZavorthWave4FToolCommandClass =
  | 'approval-required'
  | 'blocked'
  | 'dry-run-only'
  | 'read-only'
  | 'sandbox/no-op'
  | 'unknown';

export type ZavorthWave4FToolCommandRiskClass =
  | 'dangerous'
  | 'filesystem-mutation'
  | 'network-mutation'
  | 'process-spawn'
  | 'read-only'
  | 'sandbox-no-op'
  | 'unknown';

export type ZavorthWave4FToolCommandDryRunDecision =
  | 'dry-run-blocked'
  | 'dry-run-ok'
  | 'raw-input-rejected'
  | 'sandbox-policy-rejected';

export type ZavorthWave4FToolCommandExecutionDecision =
  | 'no-safe-tool-command-execution-target'
  | 'sandbox-noop-execution-ok'
  | 'tool-command-execution-blocked'
  | 'tool-command-execution-blocked-feature-flag'
  | 'tool-command-execution-policy-rejected'
  | 'tool-command-execution-raw-input-rejected'
  | 'tool-command-execution-sandbox-rejected';

export type ZavorthWave4FToolCommandExecutionStatus =
  | 'dangerous-command-blocked'
  | 'dry-run-envelope-ready'
  | 'feature-flag-disabled'
  | 'filesystem-mutation-blocked'
  | 'idempotency-duplicate'
  | 'idempotency-valid'
  | 'network-mutation-blocked'
  | 'no-safe-tool-command-target'
  | 'policy-recheck-accepted'
  | 'policy-rejected'
  | 'process-spawn-guarded'
  | 'raw-input-rejected'
  | 'sandbox-noop-executed'
  | 'sandbox-working-dir-approved'
  | 'sandbox-working-dir-rejected'
  | 'secretref-metadata-only'
  | 'source-not-ready'
  | 'tool-command-metadata-ready'
  | 'unsafe-execution-attempted';

export type ZavorthWave4FToolCommandFeatureFlagGate = {
  nativeContract: 'ZavorthWave4FToolCommandFeatureFlagGate/v1';
  flagName: typeof ZAVORTH_WAVE4F_TOOL_COMMAND_EXECUTION_EXECUTE_FLAG;
  enabled: boolean;
  safetyGate: 'sandbox-noop-or-read-only-only';
  toolCommandExecutionFeatureFlagRequired: true;
};

export type ZavorthWave4FToolCommandSecretRefMetadata = {
  nativeContract: 'ZavorthWave4FToolCommandSecretRefMetadata/v1';
  name: string;
  purpose: 'command-http-auth-metadata' | 'sandbox-none';
  status: 'metadata-only' | 'not-required' | 'unknown';
  rawValueSerialized: false;
};

export type ZavorthWave4FToolCommandReadinessRecord = {
  nativeContract: 'ZavorthWave4FToolCommandReadinessRecord/v1';
  commandId: string;
  commandKind: 'command' | 'gateway-method' | 'http-route' | 'tool' | 'cli-command';
  label: string;
  toolCommandClass: ZavorthWave4FToolCommandClass;
  riskClass: ZavorthWave4FToolCommandRiskClass;
  filesystemRisk: 'mutation-blocked' | 'none' | 'read-only' | 'unknown';
  networkRisk: 'mutation-blocked' | 'none' | 'read-only' | 'unknown';
  processRisk: 'sandbox-approved-no-spawn' | 'spawn-blocked' | 'unknown';
  dryRunSupported: boolean;
  sandboxExplicitlyAllowed: boolean;
  workingDirectoryPolicy: 'zavorth-owned-sandbox' | 'not-required' | 'rejected' | 'unknown';
  requiredSecretRefs: ZavorthWave4FToolCommandSecretRefMetadata[];
  requiredScopes: string[];
  policyDisposition:
    | 'approval-required'
    | 'blocked-dangerous'
    | 'dry-run-only'
    | 'read-only'
    | 'safe-sandbox-noop'
    | 'unknown-blocked';
  sourceEvidence: string[];
  sourceRuntimeAuthority: false;
  runtimeExternalExecutorRequiredForToolCommandReadiness: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4FToolCommandDryRunEnvelope = {
  nativeContract: 'ZavorthWave4FToolCommandDryRunEnvelope/v1';
  envelopeId: string;
  commandId: string;
  mode: 'tool-command-dry-run-only';
  argsEnvelope: {
    nativeContract: 'ZavorthWave4FToolCommandArgsEnvelope/v1';
    argsKind: 'redacted-fixture';
    redactedArgs: ['--dry-run'];
    rawArgsSerialized: false;
    rawContentUsageAllowed: false;
    rawSecretSerialized: false;
  };
  workingDirectoryPolicy: 'zavorth-owned-sandbox' | 'not-required' | 'rejected' | 'unknown';
  filesystemMutationAllowed: false;
  networkMutationAllowed: false;
  processSpawnActuallyPerformed: false;
  processSpawnAllowedOnlyIfSandboxApproved: true;
  dangerousToolCommandExecutionAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4FToolCommandDryRunReceipt = {
  nativeContract: 'ZavorthWave4FToolCommandDryRunReceipt/v1';
  decision: ZavorthWave4FToolCommandDryRunDecision;
  envelope: ZavorthWave4FToolCommandDryRunEnvelope;
  toolCommandDryRunSupported: boolean;
  commandActuallyExecuted: false;
  processSpawnActuallyPerformed: false;
  rawInputRejected: boolean;
  rawSecretSerialized: false;
};

export type ZavorthWave4FToolCommandSandboxExecutionReceipt = {
  nativeContract: 'ZavorthWave4FToolCommandSandboxExecutionReceipt/v1';
  decision: ZavorthWave4FToolCommandExecutionDecision;
  selectedCommandId: string;
  featureFlag: ZavorthWave4FToolCommandFeatureFlagGate;
  statuses: ZavorthWave4FToolCommandExecutionStatus[];
  idempotencyKey: string;
  sandboxNoopCommandActuallyExecuted: boolean;
  commandResultEnvelope:
    | {
      nativeContract: 'ZavorthWave4FToolCommandSandboxResultEnvelope/v1';
      resultKind: 'fixture-noop-ack';
      output: '[redacted-tool-command-sandbox-result]';
      filesystemMutation: false;
      networkMutation: false;
      processSpawnActuallyPerformed: false;
      rawOutputSerialized: false;
      rawSecretSerialized: false;
    }
    | {
      nativeContract: 'ZavorthWave4FToolCommandSandboxResultEnvelope/v1';
      resultKind: 'not-executed';
      output: '[not-executed]';
      filesystemMutation: false;
      networkMutation: false;
      processSpawnActuallyPerformed: false;
      rawOutputSerialized: false;
      rawSecretSerialized: false;
    };
  cleanupReceipt: {
    nativeContract: 'ZavorthWave4FToolCommandCleanupReceipt/v1';
    cleanupAttempted: boolean;
    cleanupConfirmed: boolean;
    filesystemMutation: false;
    networkMutation: false;
    processStillRunning: false;
    rawSecretSerialized: false;
  };
  toolCommandRealExecutionOnlySandboxNoopOrReadOnlyWhenFlagEnabled: true;
  dangerousToolCommandExecutionAllowed: false;
  filesystemMutationAllowed: false;
  networkMutationAllowed: false;
  processSpawnAllowedOnlyIfSandboxApproved: true;
  rawSecretSerialized: false;
};

export type ZavorthWave4FToolCommandAbsorptionMilestone = {
  nativeContract: 'ZavorthWave4FToolCommandAbsorptionMilestone/v1';
  readinessRecorded: true;
  dryRunRecorded: true;
  sandboxNoopExecutionRecorded: boolean;
  noSafeToolCommandExecutionTargetRecorded: boolean;
  dangerousToolsCommandsBlocked: true;
  nextDomainRecommendation: 'final-adapter-domain-decommission-pack';
  rawSecretSerialized: false;
};

export type ZavorthWave4FToolCommandExecutionGate = {
  toolCommandExecutionAbsorptionPackCreated: true;
  toolCommandDryRunSupported: true;
  toolCommandRealExecutionOnlySandboxNoopOrReadOnlyWhenFlagEnabled: true;
  dangerousToolCommandExecutionAllowed: false;
  filesystemMutationAllowed: false;
  networkMutationAllowed: false;
  processSpawnAllowedOnlyIfSandboxApproved: true;
  rawSecretSerialized: false;
  rawContentUsageAllowed: false;
  messageActuallySent: false;
  paidProviderExecutionAllowed: false;
  sideEffectProviderExecutionAllowed: false;
  externalExecutorMutationAllowed: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
};

export type ZavorthWave4FToolCommandExecutionSource = {
  actionGovernancePipelineReady: true;
  commandHttpExecutableRuntimeGatesReady: true;
  nativeRegistriesReady: true;
  providerExecutionAbsorptionPack: ZavorthWave4EProviderExecutionAbsorptionPackNormalization;
  commandDescriptors: ExternalAgentWave1PluginCommandDescriptorNormalization;
  cliCommands: ExternalAgentWave1PluginCliCommandSurfaceNormalization;
  gatewayMethods: ExternalAgentWave1PluginGatewayMethodSurfaceNormalization;
  httpRoutes: ExternalAgentWave1PluginHttpRouteSurfaceNormalization;
  toolExposurePolicy: ExternalAgentWave1PluginToolExposurePolicyNormalization;
  configSecretRefRegistry: ZavorthNativeConfigStateRegistry;
  sandboxNoopCommandAvailable: boolean;
  sandboxNoopCommandExplicitlyAllowed: boolean;
  sandboxWorkingDirectoryApproved: boolean;
  policyRecheckAccepted: boolean;
  idempotencyKey: string;
  idempotencyKeyAlreadyUsed: boolean;
  dryRunInputRedacted: boolean;
  rawInputAttempted: false;
  rawSecretSerialized: false;
  rawContentUsageAttempted: false;
  dangerousCommandExecutionAttempted: false;
  filesystemMutationAttempted: false;
  networkMutationAttempted: false;
  processSpawnAttemptedWithoutSandbox: false;
  messageSendAttempted: false;
  paidProviderExecutionAttempted: false;
  sideEffectProviderExecutionAttempted: false;
  externalExecutorMutationAttempted: false;
  sourceModuleCopyAttempted: false;
  adapterRemovalAttempted: false;
  publicExternalExecutorIdentityExposed: false;
  runtimeExternalExecutorRequiredForExecution: false;
};

export type ZavorthWave4FToolCommandExecutionAbsorptionPackNormalization = {
  nativeContract: 'ZavorthWave4FToolCommandExecutionAbsorptionPack/v1';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4F_TOOL_COMMAND_EXECUTION_ABSORPTION_PACK_RUNTIME_ID;
  decision: ZavorthWave4FToolCommandExecutionPackDecision;
  status: ZavorthWave4FToolCommandExecutionPackDecision;
  sourceReadiness: {
    actionGovernancePipelineReady: true;
    commandHttpExecutableRuntimeGatesReady: true;
    nativeRegistriesReady: true;
    providerExecutionAbsorptionPack: ZavorthWave4EProviderExecutionAbsorptionPackNormalization['decision'];
    runtimeExternalExecutorRequiredForExecution: false;
  };
  toolCommandReadiness: ZavorthWave4FToolCommandReadinessRecord[];
  toolCommandDryRun: ZavorthWave4FToolCommandDryRunReceipt;
  sandboxExecution: ZavorthWave4FToolCommandSandboxExecutionReceipt;
  milestone: ZavorthWave4FToolCommandAbsorptionMilestone;
  executionGate: ZavorthWave4FToolCommandExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawContentSerialized: false;
    secretRefsMetadataOnly: true;
    sourceIdentityPublic: false;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextDomainRecommended: 'final-adapter-domain-decommission-pack';
};

export type ZavorthWave4FToolCommandExecutionAbsorptionPackOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4F_TOOL_COMMAND_EXECUTION_ABSORPTION_PACK_RUNTIME_ID;
  source: ZavorthWave4FToolCommandExecutionSource;
  featureFlag: ZavorthWave4FToolCommandFeatureFlagGate;
};

function noSecretRef(): ZavorthWave4FToolCommandSecretRefMetadata {
  return {
    nativeContract: 'ZavorthWave4FToolCommandSecretRefMetadata/v1',
    name: 'zavorth-tool-command-no-secret-required',
    purpose: 'sandbox-none',
    status: 'not-required',
    rawValueSerialized: false,
  };
}

function sandboxNoopRecord(): ZavorthWave4FToolCommandReadinessRecord {
  return {
    nativeContract: 'ZavorthWave4FToolCommandReadinessRecord/v1',
    commandId: 'zavorth-native-tool-command:sandbox-noop-fixture',
    commandKind: 'tool',
    label: 'Sandbox no-op tool command fixture',
    toolCommandClass: 'sandbox/no-op',
    riskClass: 'sandbox-no-op',
    filesystemRisk: 'none',
    networkRisk: 'none',
    processRisk: 'sandbox-approved-no-spawn',
    dryRunSupported: true,
    sandboxExplicitlyAllowed: true,
    workingDirectoryPolicy: 'zavorth-owned-sandbox',
    requiredSecretRefs: [noSecretRef()],
    requiredScopes: ['tool-command.sandbox.noop.execute'],
    policyDisposition: 'safe-sandbox-noop',
    sourceEvidence: [
      'docs/174-wave-2-controlled-action-dispatch-design.md',
      'docs/180-wave-2-approved-mutation-execution-harness.md',
      'docs/242-wave-4f-tool-command-execution-absorption-pack.md',
    ],
    sourceRuntimeAuthority: false,
    runtimeExternalExecutorRequiredForToolCommandReadiness: false,
    rawSecretSerialized: false,
  };
}

function readOnlyRecord(id: string, label: string, evidence: string[]): ZavorthWave4FToolCommandReadinessRecord {
  return {
    nativeContract: 'ZavorthWave4FToolCommandReadinessRecord/v1',
    commandId: id,
    commandKind: 'command',
    label,
    toolCommandClass: 'read-only',
    riskClass: 'read-only',
    filesystemRisk: 'read-only',
    networkRisk: 'none',
    processRisk: 'spawn-blocked',
    dryRunSupported: true,
    sandboxExplicitlyAllowed: false,
    workingDirectoryPolicy: 'not-required',
    requiredSecretRefs: [noSecretRef()],
    requiredScopes: ['sessions.read'],
    policyDisposition: 'read-only',
    sourceEvidence: evidence,
    sourceRuntimeAuthority: false,
    runtimeExternalExecutorRequiredForToolCommandReadiness: false,
    rawSecretSerialized: false,
  };
}

function dryRunOnlyRecord(): ZavorthWave4FToolCommandReadinessRecord {
  return {
    nativeContract: 'ZavorthWave4FToolCommandReadinessRecord/v1',
    commandId: 'zavorth-native-tool-command:dry-run-envelope-only',
    commandKind: 'tool',
    label: 'Dry-run command envelope only',
    toolCommandClass: 'dry-run-only',
    riskClass: 'process-spawn',
    filesystemRisk: 'unknown',
    networkRisk: 'unknown',
    processRisk: 'spawn-blocked',
    dryRunSupported: true,
    sandboxExplicitlyAllowed: false,
    workingDirectoryPolicy: 'unknown',
    requiredSecretRefs: [noSecretRef()],
    requiredScopes: ['tool-command.plan.dry-run'],
    policyDisposition: 'dry-run-only',
    sourceEvidence: [
      'docs/145-wave-1-command-http-invocation-envelope-boundary-slice.md',
      'docs/146-wave-1-command-http-policy-preflight-boundary-slice.md',
    ],
    sourceRuntimeAuthority: false,
    runtimeExternalExecutorRequiredForToolCommandReadiness: false,
    rawSecretSerialized: false,
  };
}

function approvalRequiredRecord(): ZavorthWave4FToolCommandReadinessRecord {
  return {
    nativeContract: 'ZavorthWave4FToolCommandReadinessRecord/v1',
    commandId: 'zavorth-native-tool-command:network-approval-required',
    commandKind: 'http-route',
    label: 'Network command envelope approval required',
    toolCommandClass: 'approval-required',
    riskClass: 'network-mutation',
    filesystemRisk: 'none',
    networkRisk: 'mutation-blocked',
    processRisk: 'spawn-blocked',
    dryRunSupported: true,
    sandboxExplicitlyAllowed: false,
    workingDirectoryPolicy: 'not-required',
    requiredSecretRefs: [noSecretRef()],
    requiredScopes: ['network.egress.approval-required'],
    policyDisposition: 'approval-required',
    sourceEvidence: [
      'docs/142-wave-1-plugin-tool-exposure-policy-boundary-slice.md',
      'docs/146-wave-1-command-http-policy-preflight-boundary-slice.md',
    ],
    sourceRuntimeAuthority: false,
    runtimeExternalExecutorRequiredForToolCommandReadiness: false,
    rawSecretSerialized: false,
  };
}

function blockedRecord(): ZavorthWave4FToolCommandReadinessRecord {
  return {
    nativeContract: 'ZavorthWave4FToolCommandReadinessRecord/v1',
    commandId: 'zavorth-native-tool-command:dangerous-workspace-delete-blocked',
    commandKind: 'tool',
    label: 'Dangerous workspace mutation blocked',
    toolCommandClass: 'blocked',
    riskClass: 'dangerous',
    filesystemRisk: 'mutation-blocked',
    networkRisk: 'none',
    processRisk: 'spawn-blocked',
    dryRunSupported: false,
    sandboxExplicitlyAllowed: false,
    workingDirectoryPolicy: 'rejected',
    requiredSecretRefs: [noSecretRef()],
    requiredScopes: ['workspace.delete'],
    policyDisposition: 'blocked-dangerous',
    sourceEvidence: [
      'docs/142-wave-1-plugin-tool-exposure-policy-boundary-slice.md',
      'docs/143-wave-0-command-http-executable-runtime-matrix.md',
    ],
    sourceRuntimeAuthority: false,
    runtimeExternalExecutorRequiredForToolCommandReadiness: false,
    rawSecretSerialized: false,
  };
}

function unknownRecord(): ZavorthWave4FToolCommandReadinessRecord {
  return {
    nativeContract: 'ZavorthWave4FToolCommandReadinessRecord/v1',
    commandId: 'zavorth-native-tool-command:unknown-command-metadata',
    commandKind: 'tool',
    label: 'Unknown tool command metadata',
    toolCommandClass: 'unknown',
    riskClass: 'unknown',
    filesystemRisk: 'unknown',
    networkRisk: 'unknown',
    processRisk: 'unknown',
    dryRunSupported: false,
    sandboxExplicitlyAllowed: false,
    workingDirectoryPolicy: 'unknown',
    requiredSecretRefs: [],
    requiredScopes: [],
    policyDisposition: 'unknown-blocked',
    sourceEvidence: [
      'docs/143-wave-0-command-http-executable-runtime-matrix.md',
    ],
    sourceRuntimeAuthority: false,
    runtimeExternalExecutorRequiredForToolCommandReadiness: false,
    rawSecretSerialized: false,
  };
}

function readiness(source: ZavorthWave4FToolCommandExecutionSource): ZavorthWave4FToolCommandReadinessRecord[] {
  const records: ZavorthWave4FToolCommandReadinessRecord[] = [
    ...source.commandDescriptors.descriptors
      .filter((descriptor) => descriptor.risk === 'safe')
      .map((descriptor) => readOnlyRecord(descriptor.id, descriptor.label, [
        'docs/139-wave-1-plugin-command-descriptor-boundary-slice.md',
        'docs/143-wave-0-command-http-executable-runtime-matrix.md',
      ])),
    dryRunOnlyRecord(),
    approvalRequiredRecord(),
    blockedRecord(),
    unknownRecord(),
  ];

  if (source.sandboxNoopCommandAvailable) {
    records.unshift(sandboxNoopRecord());
  }

  return records;
}

function safeTarget(records: ZavorthWave4FToolCommandReadinessRecord[]): ZavorthWave4FToolCommandReadinessRecord | undefined {
  return records.find((record) => (
    (record.toolCommandClass === 'sandbox/no-op' || record.toolCommandClass === 'read-only') &&
    record.sandboxExplicitlyAllowed &&
    record.filesystemRisk !== 'mutation-blocked' &&
    record.networkRisk !== 'mutation-blocked' &&
    record.processRisk === 'sandbox-approved-no-spawn'
  ));
}

function dryRunEnvelope(record: ZavorthWave4FToolCommandReadinessRecord): ZavorthWave4FToolCommandDryRunEnvelope {
  return {
    nativeContract: 'ZavorthWave4FToolCommandDryRunEnvelope/v1',
    envelopeId: `zavorth-wave4f-tool-command-dry-run:${record.commandId}`,
    commandId: record.commandId,
    mode: 'tool-command-dry-run-only',
    argsEnvelope: {
      nativeContract: 'ZavorthWave4FToolCommandArgsEnvelope/v1',
      argsKind: 'redacted-fixture',
      redactedArgs: ['--dry-run'],
      rawArgsSerialized: false,
      rawContentUsageAllowed: false,
      rawSecretSerialized: false,
    },
    workingDirectoryPolicy: record.workingDirectoryPolicy,
    filesystemMutationAllowed: false,
    networkMutationAllowed: false,
    processSpawnActuallyPerformed: false,
    processSpawnAllowedOnlyIfSandboxApproved: true,
    dangerousToolCommandExecutionAllowed: false,
    rawSecretSerialized: false,
  };
}

function dryRunReceipt(
  source: ZavorthWave4FToolCommandExecutionSource,
  record: ZavorthWave4FToolCommandReadinessRecord,
): ZavorthWave4FToolCommandDryRunReceipt {
  const rawRejected = !source.dryRunInputRedacted || source.rawInputAttempted || source.rawContentUsageAttempted || source.rawSecretSerialized;
  const sandboxRejected = record.workingDirectoryPolicy === 'rejected' || source.sandboxWorkingDirectoryApproved === false;
  return {
    nativeContract: 'ZavorthWave4FToolCommandDryRunReceipt/v1',
    decision: rawRejected
      ? 'raw-input-rejected'
      : sandboxRejected
        ? 'sandbox-policy-rejected'
        : record.dryRunSupported
          ? 'dry-run-ok'
          : 'dry-run-blocked',
    envelope: dryRunEnvelope(record),
    toolCommandDryRunSupported: record.dryRunSupported && !rawRejected && !sandboxRejected,
    commandActuallyExecuted: false,
    processSpawnActuallyPerformed: false,
    rawInputRejected: rawRejected,
    rawSecretSerialized: false,
  };
}

function statusList(input: {
  dryRun: ZavorthWave4FToolCommandDryRunReceipt;
  featureFlag: ZavorthWave4FToolCommandFeatureFlagGate;
  safe: ZavorthWave4FToolCommandReadinessRecord | undefined;
  source: ZavorthWave4FToolCommandExecutionSource;
}): ZavorthWave4FToolCommandExecutionStatus[] {
  const result: ZavorthWave4FToolCommandExecutionStatus[] = [];

  if (
    input.source.providerExecutionAbsorptionPack.decision !== 'provider-execution-absorption-pack-ready' ||
    !input.source.actionGovernancePipelineReady ||
    !input.source.commandHttpExecutableRuntimeGatesReady ||
    !input.source.nativeRegistriesReady ||
    input.source.runtimeExternalExecutorRequiredForExecution ||
    input.source.publicExternalExecutorIdentityExposed
  ) {
    result.push('source-not-ready');
  }
  result.push('tool-command-metadata-ready');
  if (!input.featureFlag.enabled) {
    result.push('feature-flag-disabled');
  }
  if (input.safe) {
    result.push('sandbox-working-dir-approved');
    result.push('process-spawn-guarded');
  } else {
    result.push('no-safe-tool-command-target');
  }
  if (input.dryRun.decision === 'dry-run-ok') {
    result.push('dry-run-envelope-ready');
  }
  if (input.source.policyRecheckAccepted) {
    result.push('policy-recheck-accepted');
  } else {
    result.push('policy-rejected');
  }
  if (input.source.idempotencyKey && !input.source.idempotencyKeyAlreadyUsed) {
    result.push('idempotency-valid');
  } else {
    result.push('idempotency-duplicate');
  }
  if (input.safe?.requiredSecretRefs.every((ref) => !ref.rawValueSerialized) ?? false) {
    result.push('secretref-metadata-only');
  }
  if (input.source.rawInputAttempted || input.source.rawContentUsageAttempted || input.source.rawSecretSerialized || input.dryRun.rawInputRejected) {
    result.push('raw-input-rejected');
  }
  if (input.source.dangerousCommandExecutionAttempted) {
    result.push('dangerous-command-blocked');
  }
  if (input.source.filesystemMutationAttempted) {
    result.push('filesystem-mutation-blocked');
  }
  if (input.source.networkMutationAttempted) {
    result.push('network-mutation-blocked');
  }
  if (!input.source.sandboxWorkingDirectoryApproved) {
    result.push('sandbox-working-dir-rejected');
  }
  if (
    input.source.processSpawnAttemptedWithoutSandbox ||
    input.source.messageSendAttempted ||
    input.source.paidProviderExecutionAttempted ||
    input.source.sideEffectProviderExecutionAttempted ||
    input.source.externalExecutorMutationAttempted ||
    input.source.sourceModuleCopyAttempted ||
    input.source.adapterRemovalAttempted
  ) {
    result.push('unsafe-execution-attempted');
  }

  const safeToExecute = input.featureFlag.enabled &&
    input.safe !== undefined &&
    input.dryRun.decision === 'dry-run-ok' &&
    input.source.policyRecheckAccepted &&
    input.source.sandboxNoopCommandExplicitlyAllowed &&
    input.source.sandboxWorkingDirectoryApproved &&
    !input.source.idempotencyKeyAlreadyUsed &&
    !result.includes('raw-input-rejected') &&
    !result.includes('dangerous-command-blocked') &&
    !result.includes('filesystem-mutation-blocked') &&
    !result.includes('network-mutation-blocked') &&
    !result.includes('sandbox-working-dir-rejected') &&
    !result.includes('unsafe-execution-attempted') &&
    !result.includes('source-not-ready');

  if (safeToExecute) {
    result.push('sandbox-noop-executed');
  }

  return Array.from(new Set(result));
}

function executionDecision(statuses: ZavorthWave4FToolCommandExecutionStatus[]): ZavorthWave4FToolCommandExecutionDecision {
  if (statuses.includes('no-safe-tool-command-target')) {
    return 'no-safe-tool-command-execution-target';
  }
  if (statuses.includes('feature-flag-disabled')) {
    return 'tool-command-execution-blocked-feature-flag';
  }
  if (statuses.includes('policy-rejected')) {
    return 'tool-command-execution-policy-rejected';
  }
  if (statuses.includes('raw-input-rejected')) {
    return 'tool-command-execution-raw-input-rejected';
  }
  if (statuses.includes('sandbox-working-dir-rejected')) {
    return 'tool-command-execution-sandbox-rejected';
  }
  if (
    statuses.includes('source-not-ready') ||
    statuses.includes('idempotency-duplicate') ||
    statuses.includes('dangerous-command-blocked') ||
    statuses.includes('filesystem-mutation-blocked') ||
    statuses.includes('network-mutation-blocked') ||
    statuses.includes('unsafe-execution-attempted')
  ) {
    return 'tool-command-execution-blocked';
  }
  return statuses.includes('sandbox-noop-executed')
    ? 'sandbox-noop-execution-ok'
    : 'tool-command-execution-blocked';
}

function sandboxExecutionReceipt(input: {
  featureFlag: ZavorthWave4FToolCommandFeatureFlagGate;
  record: ZavorthWave4FToolCommandReadinessRecord;
  source: ZavorthWave4FToolCommandExecutionSource;
  statuses: ZavorthWave4FToolCommandExecutionStatus[];
}): ZavorthWave4FToolCommandSandboxExecutionReceipt {
  const decision = executionDecision(input.statuses);
  const executed = decision === 'sandbox-noop-execution-ok';
  return {
    nativeContract: 'ZavorthWave4FToolCommandSandboxExecutionReceipt/v1',
    decision,
    selectedCommandId: input.record.commandId,
    featureFlag: input.featureFlag,
    statuses: input.statuses,
    idempotencyKey: input.source.idempotencyKey,
    sandboxNoopCommandActuallyExecuted: executed,
    commandResultEnvelope: executed
      ? {
        nativeContract: 'ZavorthWave4FToolCommandSandboxResultEnvelope/v1',
        resultKind: 'fixture-noop-ack',
        output: '[redacted-tool-command-sandbox-result]',
        filesystemMutation: false,
        networkMutation: false,
        processSpawnActuallyPerformed: false,
        rawOutputSerialized: false,
        rawSecretSerialized: false,
      }
      : {
        nativeContract: 'ZavorthWave4FToolCommandSandboxResultEnvelope/v1',
        resultKind: 'not-executed',
        output: '[not-executed]',
        filesystemMutation: false,
        networkMutation: false,
        processSpawnActuallyPerformed: false,
        rawOutputSerialized: false,
        rawSecretSerialized: false,
      },
    cleanupReceipt: {
      nativeContract: 'ZavorthWave4FToolCommandCleanupReceipt/v1',
      cleanupAttempted: executed,
      cleanupConfirmed: executed,
      filesystemMutation: false,
      networkMutation: false,
      processStillRunning: false,
      rawSecretSerialized: false,
    },
    toolCommandRealExecutionOnlySandboxNoopOrReadOnlyWhenFlagEnabled: true,
    dangerousToolCommandExecutionAllowed: false,
    filesystemMutationAllowed: false,
    networkMutationAllowed: false,
    processSpawnAllowedOnlyIfSandboxApproved: true,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthWave4FToolCommandExecutionGate {
  return {
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
  };
}

function milestone(execution: ZavorthWave4FToolCommandSandboxExecutionReceipt): ZavorthWave4FToolCommandAbsorptionMilestone {
  return {
    nativeContract: 'ZavorthWave4FToolCommandAbsorptionMilestone/v1',
    readinessRecorded: true,
    dryRunRecorded: true,
    sandboxNoopExecutionRecorded: execution.decision === 'sandbox-noop-execution-ok',
    noSafeToolCommandExecutionTargetRecorded: execution.decision === 'no-safe-tool-command-execution-target',
    dangerousToolsCommandsBlocked: true,
    nextDomainRecommendation: 'final-adapter-domain-decommission-pack',
    rawSecretSerialized: false,
  };
}

function blockedBySource(source: ZavorthWave4FToolCommandExecutionSource): boolean {
  return (
    source.rawInputAttempted ||
    source.rawSecretSerialized ||
    source.rawContentUsageAttempted ||
    source.dangerousCommandExecutionAttempted ||
    source.filesystemMutationAttempted ||
    source.networkMutationAttempted ||
    source.processSpawnAttemptedWithoutSandbox ||
    source.messageSendAttempted ||
    source.paidProviderExecutionAttempted ||
    source.sideEffectProviderExecutionAttempted ||
    source.externalExecutorMutationAttempted ||
    source.sourceModuleCopyAttempted ||
    source.adapterRemovalAttempted ||
    source.publicExternalExecutorIdentityExposed ||
    source.runtimeExternalExecutorRequiredForExecution
  );
}

export class ZavorthWave4FToolCommandExecutionAbsorptionPack {
  public constructor(public readonly normalization: ZavorthWave4FToolCommandExecutionAbsorptionPackNormalization) {}

  public commandsByClass(toolCommandClass: ZavorthWave4FToolCommandClass): ZavorthWave4FToolCommandReadinessRecord[] {
    return this.normalization.toolCommandReadiness.filter((record) => record.toolCommandClass === toolCommandClass);
  }

  public sandboxNoopExecutionSucceeded(): boolean {
    return this.normalization.sandboxExecution.decision === 'sandbox-noop-execution-ok' &&
      this.normalization.sandboxExecution.sandboxNoopCommandActuallyExecuted;
  }

  public noSafeTargetRecorded(): boolean {
    return this.normalization.sandboxExecution.decision === 'no-safe-tool-command-execution-target' &&
      this.normalization.milestone.noSafeToolCommandExecutionTargetRecorded;
  }

  public dangerousExecutionBlocked(): boolean {
    return !this.normalization.executionGate.dangerousToolCommandExecutionAllowed &&
      !this.normalization.executionGate.filesystemMutationAllowed &&
      !this.normalization.executionGate.networkMutationAllowed;
  }
}

export function createZavorthWave4FToolCommandFeatureFlagGate(
  enabled: boolean,
): ZavorthWave4FToolCommandFeatureFlagGate {
  return {
    nativeContract: 'ZavorthWave4FToolCommandFeatureFlagGate/v1',
    flagName: ZAVORTH_WAVE4F_TOOL_COMMAND_EXECUTION_EXECUTE_FLAG,
    enabled,
    safetyGate: 'sandbox-noop-or-read-only-only',
    toolCommandExecutionFeatureFlagRequired: true,
  };
}

export function createZavorthWave4FToolCommandExecutionSource(
  overrides: Partial<Omit<
    ZavorthWave4FToolCommandExecutionSource,
    | 'cliCommands'
    | 'commandDescriptors'
    | 'configSecretRefRegistry'
    | 'gatewayMethods'
    | 'httpRoutes'
    | 'providerExecutionAbsorptionPack'
    | 'toolExposurePolicy'
  >> & {
    cliCommands?: ExternalAgentWave1PluginCliCommandSurfaceNormalization;
    commandDescriptors?: ExternalAgentWave1PluginCommandDescriptorNormalization;
    configSecretRefRegistry?: ZavorthNativeConfigStateRegistry;
    gatewayMethods?: ExternalAgentWave1PluginGatewayMethodSurfaceNormalization;
    httpRoutes?: ExternalAgentWave1PluginHttpRouteSurfaceNormalization;
    providerExecutionAbsorptionPack?: ZavorthWave4EProviderExecutionAbsorptionPackNormalization;
    toolExposurePolicy?: ExternalAgentWave1PluginToolExposurePolicyNormalization;
  } = {},
): ZavorthWave4FToolCommandExecutionSource {
  return {
    actionGovernancePipelineReady: true,
    commandHttpExecutableRuntimeGatesReady: true,
    nativeRegistriesReady: true,
    providerExecutionAbsorptionPack: createZavorthWave4EProviderExecutionAbsorptionPackFixture().normalization,
    commandDescriptors: normalizeWave1PluginCommandDescriptors(),
    cliCommands: normalizeWave1PluginCliCommandSurfaces(),
    gatewayMethods: normalizeWave1PluginGatewayMethodSurfaces(),
    httpRoutes: normalizeWave1PluginHttpRouteSurfaces(),
    toolExposurePolicy: normalizeWave1PluginToolExposurePolicy(),
    configSecretRefRegistry: createZavorthNativeConfigStateRegistryFixture(),
    sandboxNoopCommandAvailable: true,
    sandboxNoopCommandExplicitlyAllowed: true,
    sandboxWorkingDirectoryApproved: true,
    policyRecheckAccepted: true,
    idempotencyKey: 'zavorth-wave4f-tool-command-execution:sandbox-noop-fixture',
    idempotencyKeyAlreadyUsed: false,
    dryRunInputRedacted: true,
    rawInputAttempted: false,
    rawSecretSerialized: false,
    rawContentUsageAttempted: false,
    dangerousCommandExecutionAttempted: false,
    filesystemMutationAttempted: false,
    networkMutationAttempted: false,
    processSpawnAttemptedWithoutSandbox: false,
    messageSendAttempted: false,
    paidProviderExecutionAttempted: false,
    sideEffectProviderExecutionAttempted: false,
    externalExecutorMutationAttempted: false,
    sourceModuleCopyAttempted: false,
    adapterRemovalAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    runtimeExternalExecutorRequiredForExecution: false,
    ...overrides,
  };
}

export function normalizeZavorthWave4FToolCommandExecutionAbsorptionPack(
  options: ZavorthWave4FToolCommandExecutionAbsorptionPackOptions,
): ZavorthWave4FToolCommandExecutionAbsorptionPackNormalization {
  const rows = readiness(options.source);
  const safe = safeTarget(rows);
  const selected = safe ?? rows.find((record) => record.dryRunSupported) ?? unknownRecord();
  const dryRun = dryRunReceipt(options.source, selected);
  const statuses = statusList({
    dryRun,
    featureFlag: options.featureFlag,
    safe,
    source: options.source,
  });
  const execution = sandboxExecutionReceipt({
    featureFlag: options.featureFlag,
    record: selected,
    source: options.source,
    statuses,
  });
  const unsafe = blockedBySource(options.source);
  const decision: ZavorthWave4FToolCommandExecutionPackDecision = unsafe
    ? 'blocked'
    : execution.decision === 'no-safe-tool-command-execution-target'
      ? 'no-safe-tool-command-execution-target'
      : 'tool-command-execution-absorption-pack-ready';

  return {
    nativeContract: 'ZavorthWave4FToolCommandExecutionAbsorptionPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision,
    status: decision,
    sourceReadiness: {
      actionGovernancePipelineReady: true,
      commandHttpExecutableRuntimeGatesReady: true,
      nativeRegistriesReady: true,
      providerExecutionAbsorptionPack: options.source.providerExecutionAbsorptionPack.decision,
      runtimeExternalExecutorRequiredForExecution: false,
    },
    toolCommandReadiness: rows,
    toolCommandDryRun: dryRun,
    sandboxExecution: execution,
    milestone: milestone(execution),
    executionGate: executionGate(),
    redaction: {
      rawSecretSerialized: false,
      rawContentSerialized: false,
      secretRefsMetadataOnly: true,
      sourceIdentityPublic: false,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextDomainRecommended: 'final-adapter-domain-decommission-pack',
  };
}

export function createZavorthWave4FToolCommandExecutionAbsorptionPackFixture(
  overrides: {
    featureFlagEnabled?: boolean;
    generatedAt?: string;
    source?: Parameters<typeof createZavorthWave4FToolCommandExecutionSource>[0];
  } = {},
): ZavorthWave4FToolCommandExecutionAbsorptionPack {
  const source = createZavorthWave4FToolCommandExecutionSource(overrides.source);
  return new ZavorthWave4FToolCommandExecutionAbsorptionPack(
    normalizeZavorthWave4FToolCommandExecutionAbsorptionPack({
      generatedAt: overrides.generatedAt ?? ZAVORTH_WAVE4F_TOOL_COMMAND_EXECUTION_ABSORPTION_PACK_NOW,
      runtimeId: ZAVORTH_WAVE4F_TOOL_COMMAND_EXECUTION_ABSORPTION_PACK_RUNTIME_ID,
      source,
      featureFlag: createZavorthWave4FToolCommandFeatureFlagGate(overrides.featureFlagEnabled ?? true),
    }),
  );
}
