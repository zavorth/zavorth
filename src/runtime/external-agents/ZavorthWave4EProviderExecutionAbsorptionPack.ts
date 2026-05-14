import {
  createZavorthNativeConfigStateRegistryFixture,
} from './ZavorthNativeConfigStateRegistry.js';
import {
  createZavorthNativeIntegrationRegistryFixture,
} from './ZavorthNativeIntegrationRegistry.js';
import {
  createZavorthWave4DMessageSendExpansionAndAuditPackFixture,
} from './ZavorthWave4DMessageSendExpansionAndAuditPack.js';
import type {
  ZavorthNativeConfigStateRecord,
  ZavorthNativeConfigStateRegistry,
  ZavorthNativeConfigStateSecretRefMetadata,
} from './ZavorthNativeConfigStateRegistry.js';
import type {
  ZavorthNativeIntegrationRecord,
  ZavorthNativeIntegrationRegistry,
  ZavorthNativeIntegrationSecretRefMetadata,
} from './ZavorthNativeIntegrationRegistry.js';
import type {
  ZavorthWave4DMessageSendExpansionAndAuditPackNormalization,
} from './ZavorthWave4DMessageSendExpansionAndAuditPack.js';

export const ZAVORTH_WAVE4E_PROVIDER_EXECUTION_EXECUTE_FLAG = 'ZAVORTH_WAVE4E_PROVIDER_EXECUTION_EXECUTE' as const;
export const ZAVORTH_WAVE4E_PROVIDER_EXECUTION_ABSORPTION_PACK_NOW = '2026-05-01T12:00:00.000Z' as const;
export const ZAVORTH_WAVE4E_PROVIDER_EXECUTION_ABSORPTION_PACK_RUNTIME_ID = 'zavorth-wave4e-provider-execution-absorption-pack' as const;

export type ZavorthWave4EProviderExecutionPackDecision =
  | 'blocked'
  | 'no-safe-provider-execution-target'
  | 'provider-execution-absorption-pack-ready';

export type ZavorthWave4EProviderClass =
  | 'approval-required'
  | 'blocked'
  | 'dry-run-only'
  | 'sandbox/no-cost'
  | 'unknown';

export type ZavorthWave4EProviderCostClass =
  | 'no-cost'
  | 'paid'
  | 'unknown';

export type ZavorthWave4EProviderSideEffectClass =
  | 'external-side-effect'
  | 'none'
  | 'unknown';

export type ZavorthWave4EProviderDryRunDecision =
  | 'dry-run-blocked'
  | 'dry-run-ok'
  | 'raw-input-rejected';

export type ZavorthWave4EProviderExecutionDecision =
  | 'no-safe-provider-execution-target'
  | 'provider-execution-blocked'
  | 'provider-execution-blocked-feature-flag'
  | 'provider-execution-policy-rejected'
  | 'provider-execution-raw-input-rejected'
  | 'sandbox-no-cost-execution-ok';

export type ZavorthWave4EProviderExecutionStatus =
  | 'dry-run-plan-ready'
  | 'feature-flag-disabled'
  | 'idempotency-duplicate'
  | 'idempotency-valid'
  | 'no-safe-provider-target'
  | 'paid-provider-blocked'
  | 'policy-recheck-accepted'
  | 'policy-rejected'
  | 'provider-metadata-ready'
  | 'raw-input-rejected'
  | 'sandbox-no-cost-provider-executed'
  | 'sandbox-no-cost-provider-ready'
  | 'secretref-metadata-only'
  | 'side-effect-provider-blocked'
  | 'source-not-ready'
  | 'unsafe-provider-attempted';

export type ZavorthWave4EProviderFeatureFlagGate = {
  nativeContract: 'ZavorthWave4EProviderFeatureFlagGate/v1';
  flagName: typeof ZAVORTH_WAVE4E_PROVIDER_EXECUTION_EXECUTE_FLAG;
  enabled: boolean;
  safetyGate: 'sandbox-no-cost-only';
  providerExecutionFeatureFlagRequired: true;
};

export type ZavorthWave4EProviderSecretRefMetadata = {
  nativeContract: 'ZavorthWave4EProviderSecretRefMetadata/v1';
  name: string;
  purpose: 'provider-auth-metadata' | 'provider-api-key' | 'sandbox-none';
  status: 'metadata-only' | 'present-redacted' | 'not-required' | 'unknown';
  sourceRegistry: 'config-state-registry' | 'integration-registry' | 'sandbox-fixture';
  rawValueSerialized: false;
};

export type ZavorthWave4EProviderReadinessRecord = {
  nativeContract: 'ZavorthWave4EProviderReadinessRecord/v1';
  providerId: string;
  providerType: string;
  providerClass: ZavorthWave4EProviderClass;
  costClass: ZavorthWave4EProviderCostClass;
  sideEffectClass: ZavorthWave4EProviderSideEffectClass;
  configuredByMetadata: boolean;
  sandboxExplicitlyAllowed: boolean;
  dryRunSupported: boolean;
  requiredSecretRefs: ZavorthWave4EProviderSecretRefMetadata[];
  requiredScopes: string[];
  policyDisposition:
    | 'approval-required'
    | 'blocked-paid-or-side-effect'
    | 'dry-run-only'
    | 'safe-sandbox-no-cost'
    | 'unknown-blocked';
  sourceEvidence: string[];
  runtimeExternalExecutorRequiredForProviderReadiness: false;
  sourceRuntimeAuthority: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4EProviderDryRunPlan = {
  nativeContract: 'ZavorthWave4EProviderDryRunPlan/v1';
  planId: string;
  providerId: string;
  mode: 'provider-dry-run-only';
  promptEnvelope: {
    nativeContract: 'ZavorthWave4EProviderPromptEnvelope/v1';
    inputKind: 'redacted-fixture';
    redactedPrompt: '[redacted-provider-dry-run-input]';
    rawPromptSerialized: false;
    rawContentUsageAllowed: false;
    rawSecretSerialized: false;
  };
  requiredSecretRefs: ZavorthWave4EProviderSecretRefMetadata[];
  policyPreflightRequired: true;
  policyRecheckedImmediatelyBeforeExecution: true;
  providerActuallyInvoked: false;
  paidProviderExecutionAllowed: false;
  sideEffectProviderExecutionAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4EProviderDryRunReceipt = {
  nativeContract: 'ZavorthWave4EProviderDryRunReceipt/v1';
  decision: ZavorthWave4EProviderDryRunDecision;
  dryRunPlan: ZavorthWave4EProviderDryRunPlan;
  providerDryRunSupported: boolean;
  providerActuallyInvoked: false;
  rawInputRejected: boolean;
  rawSecretSerialized: false;
};

export type ZavorthWave4EProviderSandboxExecutionReceipt = {
  nativeContract: 'ZavorthWave4EProviderSandboxExecutionReceipt/v1';
  decision: ZavorthWave4EProviderExecutionDecision;
  selectedProviderId: string;
  featureFlag: ZavorthWave4EProviderFeatureFlagGate;
  statuses: ZavorthWave4EProviderExecutionStatus[];
  idempotencyKey: string;
  sandboxNoCostProviderActuallyExecuted: boolean;
  providerResultEnvelope:
    | {
      nativeContract: 'ZavorthWave4EProviderSandboxResultEnvelope/v1';
      resultKind: 'fixture-no-cost-ack';
      output: '[redacted-provider-sandbox-result]';
      tokenUsageCostClass: 'no-cost';
      externalSideEffect: false;
      rawOutputSerialized: false;
      rawSecretSerialized: false;
    }
    | {
      nativeContract: 'ZavorthWave4EProviderSandboxResultEnvelope/v1';
      resultKind: 'not-executed';
      output: '[not-executed]';
      tokenUsageCostClass: 'no-cost' | 'unknown';
      externalSideEffect: false;
      rawOutputSerialized: false;
      rawSecretSerialized: false;
    };
  cleanupReceipt: {
    nativeContract: 'ZavorthWave4EProviderCleanupReceipt/v1';
    cleanupAttempted: boolean;
    cleanupConfirmed: boolean;
    providerSessionStillOpen: false;
    rawSecretSerialized: false;
  };
  providerRealExecutionOnlySandboxNoCostWhenFlagEnabled: true;
  paidProviderExecutionAllowed: false;
  sideEffectProviderExecutionAllowed: false;
  rawContentUsageAllowed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4EProviderAbsorptionMilestone = {
  nativeContract: 'ZavorthWave4EProviderAbsorptionMilestone/v1';
  readinessRecorded: true;
  dryRunRecorded: true;
  sandboxNoCostExecutionRecorded: boolean;
  noSafeProviderExecutionTargetRecorded: boolean;
  providersRealCostSideEffectsBlocked: true;
  nextDomainRecommendation: 'tool-command-execution-absorption-pack';
  rawSecretSerialized: false;
};

export type ZavorthWave4EProviderExecutionGate = {
  providerExecutionAbsorptionPackCreated: true;
  providerDryRunSupported: true;
  providerRealExecutionOnlySandboxNoCostWhenFlagEnabled: true;
  paidProviderExecutionAllowed: false;
  sideEffectProviderExecutionAllowed: false;
  rawSecretSerialized: false;
  rawContentUsageAllowed: false;
  messageActuallySent: false;
  toolCommandRealExecutionAllowed: false;
  externalExecutorMutationAllowed: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
};

export type ZavorthWave4EProviderExecutionSource = {
  actionGovernancePipelineReady: true;
  nativeRegistriesReady: true;
  providerMetadataRegistry: ZavorthNativeIntegrationRegistry;
  configSecretRefRegistry: ZavorthNativeConfigStateRegistry;
  messageSendExpansionPack: ZavorthWave4DMessageSendExpansionAndAuditPackNormalization;
  providerMetadataRegistryReady: true;
  configSecretRefRegistryReady: true;
  lowRiskExecutablesReady: true;
  dryRunExecutablesReady: true;
  sandboxNoCostProviderAvailable: boolean;
  sandboxNoCostProviderExplicitlyAllowed: boolean;
  policyRecheckAccepted: boolean;
  idempotencyKey: string;
  idempotencyKeyAlreadyUsed: boolean;
  dryRunInputRedacted: boolean;
  rawInputAttempted: false;
  rawSecretSerialized: false;
  rawContentUsageAttempted: false;
  paidProviderExecutionAttempted: false;
  sideEffectProviderExecutionAttempted: false;
  unsafeProviderExecutionAttempted: false;
  messageSendAttempted: false;
  toolCommandExecutionAttempted: false;
  externalExecutorMutationAttempted: false;
  sourceModuleCopyAttempted: false;
  adapterRemovalAttempted: false;
  publicExternalExecutorIdentityExposed: false;
  runtimeExternalExecutorRequiredForExecution: false;
};

export type ZavorthWave4EProviderExecutionAbsorptionPackNormalization = {
  nativeContract: 'ZavorthWave4EProviderExecutionAbsorptionPack/v1';
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4E_PROVIDER_EXECUTION_ABSORPTION_PACK_RUNTIME_ID;
  decision: ZavorthWave4EProviderExecutionPackDecision;
  status: ZavorthWave4EProviderExecutionPackDecision;
  sourceReadiness: {
    actionGovernancePipelineReady: true;
    nativeRegistriesReady: true;
    providerMetadataRegistryReady: true;
    configSecretRefRegistryReady: true;
    messageSendExpansionPack: ZavorthWave4DMessageSendExpansionAndAuditPackNormalization['decision'];
    runtimeExternalExecutorRequiredForExecution: false;
  };
  providerReadiness: ZavorthWave4EProviderReadinessRecord[];
  providerDryRun: ZavorthWave4EProviderDryRunReceipt;
  sandboxExecution: ZavorthWave4EProviderSandboxExecutionReceipt;
  milestone: ZavorthWave4EProviderAbsorptionMilestone;
  executionGate: ZavorthWave4EProviderExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    rawContentSerialized: false;
    secretRefsMetadataOnly: true;
    sourceIdentityPublic: false;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextDomainRecommended: 'tool-command-execution-absorption-pack';
};

export type ZavorthWave4EProviderExecutionAbsorptionPackOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4E_PROVIDER_EXECUTION_ABSORPTION_PACK_RUNTIME_ID;
  source: ZavorthWave4EProviderExecutionSource;
  featureFlag: ZavorthWave4EProviderFeatureFlagGate;
};

function secretRefFromIntegration(
  ref: ZavorthNativeIntegrationSecretRefMetadata,
): ZavorthWave4EProviderSecretRefMetadata {
  return {
    nativeContract: 'ZavorthWave4EProviderSecretRefMetadata/v1',
    name: ref.name,
    purpose: 'provider-auth-metadata',
    status: ref.status === 'present-redacted' ? 'present-redacted' : 'metadata-only',
    sourceRegistry: 'integration-registry',
    rawValueSerialized: false,
  };
}

function secretRefFromConfig(
  ref: ZavorthNativeConfigStateSecretRefMetadata,
): ZavorthWave4EProviderSecretRefMetadata {
  return {
    nativeContract: 'ZavorthWave4EProviderSecretRefMetadata/v1',
    name: ref.name,
    purpose: 'provider-api-key',
    status: 'metadata-only',
    sourceRegistry: 'config-state-registry',
    rawValueSerialized: false,
  };
}

function configProviderSecretRefs(configRegistry: ZavorthNativeConfigStateRegistry): ZavorthWave4EProviderSecretRefMetadata[] {
  return configRegistry
    .list({ category: 'provider-credentials' })
    .flatMap((record: ZavorthNativeConfigStateRecord) => record.secretRefs.map(secretRefFromConfig));
}

function sandboxSecretRef(): ZavorthWave4EProviderSecretRefMetadata {
  return {
    nativeContract: 'ZavorthWave4EProviderSecretRefMetadata/v1',
    name: 'zavorth-sandbox-provider-no-secret-required',
    purpose: 'sandbox-none',
    status: 'not-required',
    sourceRegistry: 'sandbox-fixture',
    rawValueSerialized: false,
  };
}

function readinessFromProviderRecord(
  record: ZavorthNativeIntegrationRecord,
  configRefs: ZavorthWave4EProviderSecretRefMetadata[],
): ZavorthWave4EProviderReadinessRecord {
  const requiredSecretRefs = record.requiredSecretRefs.length > 0
    ? record.requiredSecretRefs.map(secretRefFromIntegration)
    : configRefs;
  const unknown = record.status === 'unknown' || record.status === 'unavailable' || record.status === 'degraded';

  return {
    nativeContract: 'ZavorthWave4EProviderReadinessRecord/v1',
    providerId: record.id,
    providerType: record.integrationType,
    providerClass: unknown ? 'unknown' : 'approval-required',
    costClass: 'unknown',
    sideEffectClass: 'unknown',
    configuredByMetadata: record.configured,
    sandboxExplicitlyAllowed: false,
    dryRunSupported: true,
    requiredSecretRefs,
    requiredScopes: record.requiredScopes,
    policyDisposition: unknown ? 'unknown-blocked' : 'approval-required',
    sourceEvidence: [
      record.id,
      'docs/187-wave-3-provider-channel-transport-native-registry.md',
      'docs/189-wave-3-config-secrets-state-native-registry.md',
    ],
    runtimeExternalExecutorRequiredForProviderReadiness: false,
    sourceRuntimeAuthority: false,
    rawSecretSerialized: false,
  };
}

function sandboxProviderRecord(): ZavorthWave4EProviderReadinessRecord {
  return {
    nativeContract: 'ZavorthWave4EProviderReadinessRecord/v1',
    providerId: 'zavorth-native-provider:sandbox-no-cost-fixture',
    providerType: 'sandbox-no-cost-fixture',
    providerClass: 'sandbox/no-cost',
    costClass: 'no-cost',
    sideEffectClass: 'none',
    configuredByMetadata: true,
    sandboxExplicitlyAllowed: true,
    dryRunSupported: true,
    requiredSecretRefs: [sandboxSecretRef()],
    requiredScopes: ['provider.sandbox.no-cost.execute'],
    policyDisposition: 'safe-sandbox-no-cost',
    sourceEvidence: [
      'docs/174-wave-2-controlled-action-dispatch-design.md',
      'docs/180-wave-2-approved-mutation-execution-harness.md',
      'docs/241-wave-4e-provider-execution-absorption-pack.md',
    ],
    runtimeExternalExecutorRequiredForProviderReadiness: false,
    sourceRuntimeAuthority: false,
    rawSecretSerialized: false,
  };
}

function dryRunOnlyProviderRecord(): ZavorthWave4EProviderReadinessRecord {
  return {
    nativeContract: 'ZavorthWave4EProviderReadinessRecord/v1',
    providerId: 'zavorth-native-provider:provider-plan-dry-run-only',
    providerType: 'provider-plan-dry-run-only',
    providerClass: 'dry-run-only',
    costClass: 'no-cost',
    sideEffectClass: 'none',
    configuredByMetadata: true,
    sandboxExplicitlyAllowed: false,
    dryRunSupported: true,
    requiredSecretRefs: [sandboxSecretRef()],
    requiredScopes: ['provider.plan.dry-run'],
    policyDisposition: 'dry-run-only',
    sourceEvidence: [
      'docs/174-wave-2-controlled-action-dispatch-design.md',
      'docs/175-wave-2-controlled-dry-run-action-planner.md',
    ],
    runtimeExternalExecutorRequiredForProviderReadiness: false,
    sourceRuntimeAuthority: false,
    rawSecretSerialized: false,
  };
}

function approvalRequiredProviderRecord(): ZavorthWave4EProviderReadinessRecord {
  return {
    nativeContract: 'ZavorthWave4EProviderReadinessRecord/v1',
    providerId: 'zavorth-native-provider:approval-required-metadata',
    providerType: 'approval-required-provider-metadata',
    providerClass: 'approval-required',
    costClass: 'unknown',
    sideEffectClass: 'unknown',
    configuredByMetadata: true,
    sandboxExplicitlyAllowed: false,
    dryRunSupported: true,
    requiredSecretRefs: [sandboxSecretRef()],
    requiredScopes: ['provider.metadata.approval-required'],
    policyDisposition: 'approval-required',
    sourceEvidence: [
      'docs/187-wave-3-provider-channel-transport-native-registry.md',
      'docs/189-wave-3-config-secrets-state-native-registry.md',
    ],
    runtimeExternalExecutorRequiredForProviderReadiness: false,
    sourceRuntimeAuthority: false,
    rawSecretSerialized: false,
  };
}

function blockedProviderRecord(): ZavorthWave4EProviderReadinessRecord {
  return {
    nativeContract: 'ZavorthWave4EProviderReadinessRecord/v1',
    providerId: 'zavorth-native-provider:paid-side-effect-blocked',
    providerType: 'paid-side-effect-provider',
    providerClass: 'blocked',
    costClass: 'paid',
    sideEffectClass: 'external-side-effect',
    configuredByMetadata: false,
    sandboxExplicitlyAllowed: false,
    dryRunSupported: false,
    requiredSecretRefs: [],
    requiredScopes: ['provider.external.execute'],
    policyDisposition: 'blocked-paid-or-side-effect',
    sourceEvidence: [
      'docs/187-wave-3-provider-channel-transport-native-registry.md',
      'docs/241-wave-4e-provider-execution-absorption-pack.md',
    ],
    runtimeExternalExecutorRequiredForProviderReadiness: false,
    sourceRuntimeAuthority: false,
    rawSecretSerialized: false,
  };
}

function unknownProviderRecord(): ZavorthWave4EProviderReadinessRecord {
  return {
    nativeContract: 'ZavorthWave4EProviderReadinessRecord/v1',
    providerId: 'zavorth-native-provider:unknown-provider-metadata',
    providerType: 'unknown-provider-metadata',
    providerClass: 'unknown',
    costClass: 'unknown',
    sideEffectClass: 'unknown',
    configuredByMetadata: false,
    sandboxExplicitlyAllowed: false,
    dryRunSupported: false,
    requiredSecretRefs: [],
    requiredScopes: [],
    policyDisposition: 'unknown-blocked',
    sourceEvidence: [
      'docs/187-wave-3-provider-channel-transport-native-registry.md',
    ],
    runtimeExternalExecutorRequiredForProviderReadiness: false,
    sourceRuntimeAuthority: false,
    rawSecretSerialized: false,
  };
}

function providerReadiness(source: ZavorthWave4EProviderExecutionSource): ZavorthWave4EProviderReadinessRecord[] {
  const configRefs = configProviderSecretRefs(source.configSecretRefRegistry);
  const providerRecords = source.providerMetadataRegistry
    .list({ integrationKind: 'provider' })
    .map((record) => readinessFromProviderRecord(record, configRefs));
  const records = [
    ...providerRecords,
    dryRunOnlyProviderRecord(),
    approvalRequiredProviderRecord(),
    blockedProviderRecord(),
    unknownProviderRecord(),
  ];

  if (source.sandboxNoCostProviderAvailable) {
    records.unshift(sandboxProviderRecord());
  }

  return records;
}

function safeProvider(records: ZavorthWave4EProviderReadinessRecord[]): ZavorthWave4EProviderReadinessRecord | undefined {
  return records.find((record) => (
    record.providerClass === 'sandbox/no-cost' &&
    record.costClass === 'no-cost' &&
    record.sideEffectClass === 'none' &&
    record.sandboxExplicitlyAllowed
  ));
}

function dryRunPlan(provider: ZavorthWave4EProviderReadinessRecord): ZavorthWave4EProviderDryRunPlan {
  return {
    nativeContract: 'ZavorthWave4EProviderDryRunPlan/v1',
    planId: `zavorth-wave4e-provider-dry-run:${provider.providerId}`,
    providerId: provider.providerId,
    mode: 'provider-dry-run-only',
    promptEnvelope: {
      nativeContract: 'ZavorthWave4EProviderPromptEnvelope/v1',
      inputKind: 'redacted-fixture',
      redactedPrompt: '[redacted-provider-dry-run-input]',
      rawPromptSerialized: false,
      rawContentUsageAllowed: false,
      rawSecretSerialized: false,
    },
    requiredSecretRefs: provider.requiredSecretRefs,
    policyPreflightRequired: true,
    policyRecheckedImmediatelyBeforeExecution: true,
    providerActuallyInvoked: false,
    paidProviderExecutionAllowed: false,
    sideEffectProviderExecutionAllowed: false,
    rawSecretSerialized: false,
  };
}

function dryRunReceipt(
  source: ZavorthWave4EProviderExecutionSource,
  provider: ZavorthWave4EProviderReadinessRecord,
): ZavorthWave4EProviderDryRunReceipt {
  const rawRejected = !source.dryRunInputRedacted || source.rawInputAttempted || source.rawContentUsageAttempted || source.rawSecretSerialized;
  return {
    nativeContract: 'ZavorthWave4EProviderDryRunReceipt/v1',
    decision: rawRejected ? 'raw-input-rejected' : provider.dryRunSupported ? 'dry-run-ok' : 'dry-run-blocked',
    dryRunPlan: dryRunPlan(provider),
    providerDryRunSupported: provider.dryRunSupported && !rawRejected,
    providerActuallyInvoked: false,
    rawInputRejected: rawRejected,
    rawSecretSerialized: false,
  };
}

function statusList(input: {
  dryRun: ZavorthWave4EProviderDryRunReceipt;
  featureFlag: ZavorthWave4EProviderFeatureFlagGate;
  safe: ZavorthWave4EProviderReadinessRecord | undefined;
  source: ZavorthWave4EProviderExecutionSource;
}): ZavorthWave4EProviderExecutionStatus[] {
  const result: ZavorthWave4EProviderExecutionStatus[] = [];

  if (
    input.source.messageSendExpansionPack.decision !== 'wave4d-message-send-expansion-and-audit-pack-ready' ||
    !input.source.actionGovernancePipelineReady ||
    !input.source.nativeRegistriesReady ||
    !input.source.providerMetadataRegistryReady ||
    !input.source.configSecretRefRegistryReady ||
    !input.source.lowRiskExecutablesReady ||
    !input.source.dryRunExecutablesReady ||
    input.source.runtimeExternalExecutorRequiredForExecution ||
    input.source.publicExternalExecutorIdentityExposed
  ) {
    result.push('source-not-ready');
  }
  if (!input.featureFlag.enabled) {
    result.push('feature-flag-disabled');
  }
  if (input.safe) {
    result.push('sandbox-no-cost-provider-ready');
  } else {
    result.push('no-safe-provider-target');
  }
  if (input.dryRun.decision === 'dry-run-ok') {
    result.push('dry-run-plan-ready');
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
  if (input.safe?.requiredSecretRefs.every((ref) => ref.rawValueSerialized === false) ?? false) {
    result.push('secretref-metadata-only');
  }
  if (input.source.rawInputAttempted || input.source.rawContentUsageAttempted || input.source.rawSecretSerialized || input.dryRun.rawInputRejected) {
    result.push('raw-input-rejected');
  }
  if (input.source.paidProviderExecutionAttempted) {
    result.push('paid-provider-blocked');
  }
  if (input.source.sideEffectProviderExecutionAttempted) {
    result.push('side-effect-provider-blocked');
  }
  if (
    input.source.unsafeProviderExecutionAttempted ||
    input.source.messageSendAttempted ||
    input.source.toolCommandExecutionAttempted ||
    input.source.externalExecutorMutationAttempted ||
    input.source.sourceModuleCopyAttempted ||
    input.source.adapterRemovalAttempted
  ) {
    result.push('unsafe-provider-attempted');
  }

  const safeToExecute = input.featureFlag.enabled &&
    input.safe !== undefined &&
    input.dryRun.decision === 'dry-run-ok' &&
    input.source.policyRecheckAccepted &&
    input.source.sandboxNoCostProviderExplicitlyAllowed &&
    input.source.idempotencyKeyAlreadyUsed === false &&
    !result.includes('raw-input-rejected') &&
    !result.includes('paid-provider-blocked') &&
    !result.includes('side-effect-provider-blocked') &&
    !result.includes('unsafe-provider-attempted') &&
    !result.includes('source-not-ready');

  if (safeToExecute) {
    result.push('sandbox-no-cost-provider-executed');
  }

  return Array.from(new Set(result));
}

function executionDecision(statuses: ZavorthWave4EProviderExecutionStatus[]): ZavorthWave4EProviderExecutionDecision {
  if (statuses.includes('no-safe-provider-target')) {
    return 'no-safe-provider-execution-target';
  }
  if (statuses.includes('feature-flag-disabled')) {
    return 'provider-execution-blocked-feature-flag';
  }
  if (statuses.includes('policy-rejected')) {
    return 'provider-execution-policy-rejected';
  }
  if (statuses.includes('raw-input-rejected')) {
    return 'provider-execution-raw-input-rejected';
  }
  if (
    statuses.includes('source-not-ready') ||
    statuses.includes('idempotency-duplicate') ||
    statuses.includes('paid-provider-blocked') ||
    statuses.includes('side-effect-provider-blocked') ||
    statuses.includes('unsafe-provider-attempted')
  ) {
    return 'provider-execution-blocked';
  }
  return statuses.includes('sandbox-no-cost-provider-executed')
    ? 'sandbox-no-cost-execution-ok'
    : 'provider-execution-blocked';
}

function sandboxExecutionReceipt(input: {
  featureFlag: ZavorthWave4EProviderFeatureFlagGate;
  provider: ZavorthWave4EProviderReadinessRecord;
  source: ZavorthWave4EProviderExecutionSource;
  statuses: ZavorthWave4EProviderExecutionStatus[];
}): ZavorthWave4EProviderSandboxExecutionReceipt {
  const decision = executionDecision(input.statuses);
  const executed = decision === 'sandbox-no-cost-execution-ok';

  return {
    nativeContract: 'ZavorthWave4EProviderSandboxExecutionReceipt/v1',
    decision,
    selectedProviderId: input.provider.providerId,
    featureFlag: input.featureFlag,
    statuses: input.statuses,
    idempotencyKey: input.source.idempotencyKey,
    sandboxNoCostProviderActuallyExecuted: executed,
    providerResultEnvelope: executed
      ? {
        nativeContract: 'ZavorthWave4EProviderSandboxResultEnvelope/v1',
        resultKind: 'fixture-no-cost-ack',
        output: '[redacted-provider-sandbox-result]',
        tokenUsageCostClass: 'no-cost',
        externalSideEffect: false,
        rawOutputSerialized: false,
        rawSecretSerialized: false,
      }
      : {
        nativeContract: 'ZavorthWave4EProviderSandboxResultEnvelope/v1',
        resultKind: 'not-executed',
        output: '[not-executed]',
        tokenUsageCostClass: input.provider.costClass === 'no-cost' ? 'no-cost' : 'unknown',
        externalSideEffect: false,
        rawOutputSerialized: false,
        rawSecretSerialized: false,
      },
    cleanupReceipt: {
      nativeContract: 'ZavorthWave4EProviderCleanupReceipt/v1',
      cleanupAttempted: executed,
      cleanupConfirmed: executed,
      providerSessionStillOpen: false,
      rawSecretSerialized: false,
    },
    providerRealExecutionOnlySandboxNoCostWhenFlagEnabled: true,
    paidProviderExecutionAllowed: false,
    sideEffectProviderExecutionAllowed: false,
    rawContentUsageAllowed: false,
    rawSecretSerialized: false,
  };
}

function executionGate(): ZavorthWave4EProviderExecutionGate {
  return {
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
  };
}

function milestone(execution: ZavorthWave4EProviderSandboxExecutionReceipt): ZavorthWave4EProviderAbsorptionMilestone {
  return {
    nativeContract: 'ZavorthWave4EProviderAbsorptionMilestone/v1',
    readinessRecorded: true,
    dryRunRecorded: true,
    sandboxNoCostExecutionRecorded: execution.decision === 'sandbox-no-cost-execution-ok',
    noSafeProviderExecutionTargetRecorded: execution.decision === 'no-safe-provider-execution-target',
    providersRealCostSideEffectsBlocked: true,
    nextDomainRecommendation: 'tool-command-execution-absorption-pack',
    rawSecretSerialized: false,
  };
}

function blockedBySource(source: ZavorthWave4EProviderExecutionSource): boolean {
  return (
    source.rawInputAttempted ||
    source.rawSecretSerialized ||
    source.rawContentUsageAttempted ||
    source.paidProviderExecutionAttempted ||
    source.sideEffectProviderExecutionAttempted ||
    source.unsafeProviderExecutionAttempted ||
    source.messageSendAttempted ||
    source.toolCommandExecutionAttempted ||
    source.externalExecutorMutationAttempted ||
    source.sourceModuleCopyAttempted ||
    source.adapterRemovalAttempted ||
    source.publicExternalExecutorIdentityExposed ||
    source.runtimeExternalExecutorRequiredForExecution
  );
}

export class ZavorthWave4EProviderExecutionAbsorptionPack {
  public constructor(public readonly normalization: ZavorthWave4EProviderExecutionAbsorptionPackNormalization) {}

  public providersByClass(providerClass: ZavorthWave4EProviderClass): ZavorthWave4EProviderReadinessRecord[] {
    return this.normalization.providerReadiness.filter((record) => record.providerClass === providerClass);
  }

  public sandboxExecutionSucceeded(): boolean {
    return this.normalization.sandboxExecution.decision === 'sandbox-no-cost-execution-ok' &&
      this.normalization.sandboxExecution.sandboxNoCostProviderActuallyExecuted;
  }

  public noSafeTargetRecorded(): boolean {
    return this.normalization.sandboxExecution.decision === 'no-safe-provider-execution-target' &&
      this.normalization.milestone.noSafeProviderExecutionTargetRecorded;
  }

  public highImpactProvidersBlocked(): boolean {
    return !this.normalization.executionGate.paidProviderExecutionAllowed &&
      !this.normalization.executionGate.sideEffectProviderExecutionAllowed &&
      !this.normalization.executionGate.messageActuallySent &&
      !this.normalization.executionGate.toolCommandRealExecutionAllowed;
  }
}

export function createZavorthWave4EProviderFeatureFlagGate(
  enabled: boolean,
): ZavorthWave4EProviderFeatureFlagGate {
  return {
    nativeContract: 'ZavorthWave4EProviderFeatureFlagGate/v1',
    flagName: ZAVORTH_WAVE4E_PROVIDER_EXECUTION_EXECUTE_FLAG,
    enabled,
    safetyGate: 'sandbox-no-cost-only',
    providerExecutionFeatureFlagRequired: true,
  };
}

export function createZavorthWave4EProviderExecutionSource(
  overrides: Partial<Omit<
    ZavorthWave4EProviderExecutionSource,
    'configSecretRefRegistry' | 'messageSendExpansionPack' | 'providerMetadataRegistry'
  >> & {
    configSecretRefRegistry?: ZavorthNativeConfigStateRegistry;
    messageSendExpansionPack?: ZavorthWave4DMessageSendExpansionAndAuditPackNormalization;
    providerMetadataRegistry?: ZavorthNativeIntegrationRegistry;
  } = {},
): ZavorthWave4EProviderExecutionSource {
  return {
    actionGovernancePipelineReady: true,
    nativeRegistriesReady: true,
    providerMetadataRegistry: createZavorthNativeIntegrationRegistryFixture(),
    configSecretRefRegistry: createZavorthNativeConfigStateRegistryFixture(),
    messageSendExpansionPack: createZavorthWave4DMessageSendExpansionAndAuditPackFixture().normalization,
    providerMetadataRegistryReady: true,
    configSecretRefRegistryReady: true,
    lowRiskExecutablesReady: true,
    dryRunExecutablesReady: true,
    sandboxNoCostProviderAvailable: true,
    sandboxNoCostProviderExplicitlyAllowed: true,
    policyRecheckAccepted: true,
    idempotencyKey: 'zavorth-wave4e-provider-execution:sandbox-no-cost-fixture',
    idempotencyKeyAlreadyUsed: false,
    dryRunInputRedacted: true,
    rawInputAttempted: false,
    rawSecretSerialized: false,
    rawContentUsageAttempted: false,
    paidProviderExecutionAttempted: false,
    sideEffectProviderExecutionAttempted: false,
    unsafeProviderExecutionAttempted: false,
    messageSendAttempted: false,
    toolCommandExecutionAttempted: false,
    externalExecutorMutationAttempted: false,
    sourceModuleCopyAttempted: false,
    adapterRemovalAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    runtimeExternalExecutorRequiredForExecution: false,
    ...overrides,
  };
}

export function normalizeZavorthWave4EProviderExecutionAbsorptionPack(
  options: ZavorthWave4EProviderExecutionAbsorptionPackOptions,
): ZavorthWave4EProviderExecutionAbsorptionPackNormalization {
  const readiness = providerReadiness(options.source);
  const sandbox = safeProvider(readiness);
  const selectedProvider = sandbox ?? readiness.find((record) => record.dryRunSupported) ?? unknownProviderRecord();
  const dryRun = dryRunReceipt(options.source, selectedProvider);
  const statuses = statusList({
    dryRun,
    featureFlag: options.featureFlag,
    safe: sandbox,
    source: options.source,
  });
  const execution = sandboxExecutionReceipt({
    featureFlag: options.featureFlag,
    provider: selectedProvider,
    source: options.source,
    statuses,
  });
  const packMilestone = milestone(execution);
  const unsafe = blockedBySource(options.source);
  const packDecision: ZavorthWave4EProviderExecutionPackDecision = unsafe
    ? 'blocked'
    : execution.decision === 'no-safe-provider-execution-target'
      ? 'no-safe-provider-execution-target'
      : 'provider-execution-absorption-pack-ready';

  return {
    nativeContract: 'ZavorthWave4EProviderExecutionAbsorptionPack/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: packDecision,
    status: packDecision,
    sourceReadiness: {
      actionGovernancePipelineReady: true,
      nativeRegistriesReady: true,
      providerMetadataRegistryReady: true,
      configSecretRefRegistryReady: true,
      messageSendExpansionPack: options.source.messageSendExpansionPack.decision,
      runtimeExternalExecutorRequiredForExecution: false,
    },
    providerReadiness: readiness,
    providerDryRun: dryRun,
    sandboxExecution: execution,
    milestone: packMilestone,
    executionGate: executionGate(),
    redaction: {
      rawSecretSerialized: false,
      rawContentSerialized: false,
      secretRefsMetadataOnly: true,
      sourceIdentityPublic: false,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextDomainRecommended: 'tool-command-execution-absorption-pack',
  };
}

export function createZavorthWave4EProviderExecutionAbsorptionPackFixture(
  overrides: {
    featureFlagEnabled?: boolean;
    generatedAt?: string;
    source?: Parameters<typeof createZavorthWave4EProviderExecutionSource>[0];
  } = {},
): ZavorthWave4EProviderExecutionAbsorptionPack {
  const source = createZavorthWave4EProviderExecutionSource(overrides.source);
  return new ZavorthWave4EProviderExecutionAbsorptionPack(
    normalizeZavorthWave4EProviderExecutionAbsorptionPack({
      generatedAt: overrides.generatedAt ?? ZAVORTH_WAVE4E_PROVIDER_EXECUTION_ABSORPTION_PACK_NOW,
      runtimeId: ZAVORTH_WAVE4E_PROVIDER_EXECUTION_ABSORPTION_PACK_RUNTIME_ID,
      source,
      featureFlag: createZavorthWave4EProviderFeatureFlagGate(overrides.featureFlagEnabled ?? true),
    }),
  );
}
