import {
  normalizeZavorthWave4B2MediumRiskExecutableCapabilitySelectionFixture,
} from './ZavorthWave4B2MediumRiskExecutableCapabilitySelection.js';
import {
  createZavorthNativeIntegrationRegistryFixture,
} from './ZavorthNativeIntegrationRegistry.js';
import {
  createZavorthWave4B2TargetSessionChannelValidationExecutableFixture,
} from './ZavorthWave4B2TargetSessionChannelValidationExecutable.js';
import type {
  ZavorthNativeIntegrationClassification,
  ZavorthNativeIntegrationRecord,
  ZavorthNativeIntegrationRegistry,
  ZavorthNativeIntegrationSecretRefMetadata,
  ZavorthNativeIntegrationStatus,
} from './ZavorthNativeIntegrationRegistry.js';
import type {
  ZavorthWave4B2MediumRiskExecutableCapabilitySelectionNormalization,
} from './ZavorthWave4B2MediumRiskExecutableCapabilitySelection.js';
import type {
  ZavorthWave4B2TargetSessionChannelValidationReceipt,
} from './ZavorthWave4B2TargetSessionChannelValidationExecutable.js';

export const ZAVORTH_WAVE4B2_TRANSPORT_READINESS_CHECK_EXECUTE_FLAG = 'ZAVORTH_WAVE4B2_TRANSPORT_READINESS_CHECK_EXECUTE' as const;
export const ZAVORTH_WAVE4B2_TRANSPORT_READINESS_CHECK_EXECUTABLE_NOW = '2026-04-30T20:00:00.000Z' as const;
export const ZAVORTH_WAVE4B2_TRANSPORT_READINESS_CHECK_EXECUTABLE_RUNTIME_ID = 'zavorth-wave4b2-transport-readiness-check-executable' as const;

export type ZavorthWave4B2TransportReadinessCheckDecision =
  | 'execution-blocked'
  | 'readiness-blocked'
  | 'readiness-degraded'
  | 'readiness-missing-secretref'
  | 'readiness-ok'
  | 'readiness-policy-rejected'
  | 'readiness-unconfigured'
  | 'readiness-unknown';

export type ZavorthWave4B2TransportReadinessCheckStatus =
  | 'ack-model-metadata'
  | 'channel-degraded'
  | 'channel-metadata-valid'
  | 'channel-unavailable'
  | 'dry-run-supported'
  | 'dry-run-unsupported'
  | 'error-model-metadata'
  | 'feature-flag-disabled'
  | 'high-impact-execution-attempted'
  | 'idempotency-valid'
  | 'external-executor-touch-attempted'
  | 'policy-eligible'
  | 'policy-rejected'
  | 'rate-limit-metadata'
  | 'receive-capable-metadata'
  | 'scope-permission-metadata'
  | 'secretref-metadata-only'
  | 'secretref-missing'
  | 'send-capable-blocked'
  | 'source-not-ready'
  | 'transport-degraded'
  | 'transport-metadata-valid'
  | 'transport-unavailable'
  | 'transport-unconfigured'
  | 'valid';

export type ZavorthWave4B2TransportReadinessCheckFeatureFlagGate = {
  nativeContract: 'ZavorthWave4B2TransportReadinessCheckFeatureFlagGate/v1';
  flagName: typeof ZAVORTH_WAVE4B2_TRANSPORT_READINESS_CHECK_EXECUTE_FLAG;
  enabled: boolean;
  safetyGate: 'controlled-production' | 'controlled-test';
  operatorAcknowledgedNoExternalTransport: boolean;
  transportReadinessCheckFeatureFlagRequired: true;
};

export type ZavorthWave4B2TransportReadinessCheckSource = {
  mediumRiskSelection: ZavorthWave4B2MediumRiskExecutableCapabilitySelectionNormalization;
  targetSessionChannelValidation: ZavorthWave4B2TargetSessionChannelValidationReceipt;
  integrationRegistry: ZavorthNativeIntegrationRegistry;
  wave4cSessionHistoryMetadataReady: true;
  nativeIntegrationRegistryReady: true;
  realTransportDiscoveryMetadataReady: true;
  messageSendTransportBlockedRehearsalReady: true;
  actionGovernancePipelineReady: true;
  policyAllowsReadinessCheck: boolean;
  runtimeExternalExecutorRequiredForExecution: false;
  externalExecutorTouched: false;
  realMessageSendAttempted: false;
  transportOpenAttempted: false;
  providerRealExecutionAttempted: false;
  toolCommandRealExecutionAttempted: false;
  externalExecutorMutationAttempted: false;
  rawHistoryMigrationAttempted: false;
  rawSqliteMigrationAttempted: false;
  rawSecretSerialized: false;
  sourceModuleCopyAttempted: false;
  adapterRemovalAttempted: false;
  publicExternalExecutorIdentityExposed: false;
};

export type ZavorthWave4B2TransportReadinessCheckTarget = {
  nativeContract: 'ZavorthWave4B2TransportReadinessCheckTarget/v1';
  channel: {
    id: string;
    type: string;
    status: ZavorthNativeIntegrationStatus | 'missing';
    classification: ZavorthNativeIntegrationClassification | 'missing';
    supportsReceive: boolean;
    receivePolicy: ZavorthNativeIntegrationRecord['receivePolicy'] | 'missing';
  };
  transport: {
    id: string;
    type: string;
    status: ZavorthNativeIntegrationStatus | 'missing';
    classification: ZavorthNativeIntegrationClassification | 'missing';
    configured: boolean;
    supportsSend: boolean;
    supportsReceive: boolean;
    supportsDryRun: boolean;
    sendPolicy: ZavorthNativeIntegrationRecord['sendPolicy'] | 'missing';
    receivePolicy: ZavorthNativeIntegrationRecord['receivePolicy'] | 'missing';
    requiredScopes: string[];
    requiredPermissions: string[];
    targetRequirements: string[];
    rateLimitModel: string;
    ackModel: string;
    errorModel: string;
  };
  sendCapableStatus: 'not-send-capable' | 'send-capable-but-blocked' | 'unknown';
  sourceIdentityPublic: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4B2TransportReadinessCheckDetail = {
  nativeContract: 'ZavorthWave4B2TransportReadinessCheckDetail/v1';
  validation:
    | 'channel-metadata'
    | 'dry-run-support'
    | 'feature-flag'
    | 'high-impact-block'
    | 'idempotency'
    | 'metadata-source'
    | 'external-executor-isolation'
    | 'policy-eligibility'
    | 'rate-ack-error-model'
    | 'scope-permission-metadata'
    | 'secretref-metadata'
    | 'send-capable-block'
    | 'transport-metadata';
  status: 'blocked' | 'failed' | 'passed';
  reason: string;
};

export type ZavorthWave4B2TransportReadinessPolicyPreflight = {
  nativeContract: 'ZavorthWave4B2TransportReadinessPolicyPreflight/v1';
  policyPreflightRequired: true;
  policyRecheckedImmediatelyBeforeExecution: true;
  approvalRequired: false;
  approvalEscalatesForExternalProbe: true;
  exactScope: {
    channelIntegrationId: string;
    transportIntegrationId: string;
  };
  messageSendBlocked: true;
  providerExecutionBlocked: true;
  toolCommandExecutionBlocked: true;
  externalTransportBlocked: true;
  rawHistoryMigrationBlocked: true;
};

export type ZavorthWave4B2TransportReadinessCheckReceipt = {
  nativeContract: 'ZavorthWave4B2TransportReadinessCheckExecutableReceipt/v1';
  runtimeId: typeof ZAVORTH_WAVE4B2_TRANSPORT_READINESS_CHECK_EXECUTABLE_RUNTIME_ID;
  generatedAt: string;
  selectedMediumRiskCapability: 'transport-readiness-check-action';
  decision: ZavorthWave4B2TransportReadinessCheckDecision;
  classification: ZavorthWave4B2TransportReadinessCheckDecision;
  validations: ZavorthWave4B2TransportReadinessCheckStatus[];
  validationDetails: ZavorthWave4B2TransportReadinessCheckDetail[];
  featureFlag: ZavorthWave4B2TransportReadinessCheckFeatureFlagGate;
  idempotencyKey: string;
  target: ZavorthWave4B2TransportReadinessCheckTarget;
  policyPreflight: ZavorthWave4B2TransportReadinessPolicyPreflight;
  requiredSecretRefs: ZavorthNativeIntegrationSecretRefMetadata[];
  sourceMetadata: {
    integrationRegistryRecordCount: number;
    targetSessionChannelValidationDecision: ZavorthWave4B2TargetSessionChannelValidationReceipt['decision'];
    nativeIntegrationRegistryUsed: true;
    transportDiscoveryMetadataUsed: true;
    messageSendTransportBlockedRehearsalUsed: true;
    sourceProvenanceInternalRedacted: true;
  };
  cleanupReceipt: ZavorthWave4B2TransportReadinessCheckCleanupReceipt;
  wave4b2TransportReadinessCheckExecutableCreated: true;
  transportReadinessCheckActuallyExecuted: boolean;
  transportReadinessCheckActuallyExecutedOnlyWhenFlagEnabled: true;
  runtimeExternalExecutorRequiredForExecution: false;
  externalExecutorTouched: false;
  realMessageSendAllowed: false;
  providerRealExecutionAllowed: false;
  toolCommandRealExecutionAllowed: false;
  externalExecutorMutationAllowed: false;
  rawHistoryMigrationAllowed: false;
  rawSqliteMigrationAllowed: false;
  transportActuallyOpened: false;
  rawSecretSerialized: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
};

export type ZavorthWave4B2TransportReadinessCheckCleanupReceipt = {
  nativeContract: 'ZavorthWave4B2TransportReadinessCheckCleanupReceipt/v1';
  cleanupActuallyPerformed: boolean;
  cleanupLimitedToControlledTestMetadata: true;
  transportActuallyOpened: false;
  externalExecutorTouched: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4B2TransportReadinessCheckOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4B2_TRANSPORT_READINESS_CHECK_EXECUTABLE_RUNTIME_ID;
  source: ZavorthWave4B2TransportReadinessCheckSource;
  featureFlag: ZavorthWave4B2TransportReadinessCheckFeatureFlagGate;
  targetChannelIntegrationId?: string;
  targetTransportIntegrationId?: string;
};

function sourceStatuses(source: ZavorthWave4B2TransportReadinessCheckSource): ZavorthWave4B2TransportReadinessCheckStatus[] {
  const statuses: ZavorthWave4B2TransportReadinessCheckStatus[] = [];

  if (
    source.mediumRiskSelection.decision !== 'wave4b2-medium-risk-executable-selection-ready' ||
    source.targetSessionChannelValidation.decision === 'execution-blocked' ||
    source.targetSessionChannelValidation.decision === 'validation-blocked' ||
    !source.wave4cSessionHistoryMetadataReady ||
    !source.nativeIntegrationRegistryReady ||
    !source.realTransportDiscoveryMetadataReady ||
    !source.messageSendTransportBlockedRehearsalReady ||
    !source.actionGovernancePipelineReady ||
    source.runtimeExternalExecutorRequiredForExecution ||
    source.rawSecretSerialized ||
    source.publicExternalExecutorIdentityExposed
  ) {
    statuses.push('source-not-ready');
  }
  if (source.externalExecutorTouched || source.externalExecutorMutationAttempted) {
    statuses.push('external-executor-touch-attempted');
  }
  if (
    source.realMessageSendAttempted ||
    source.transportOpenAttempted ||
    source.providerRealExecutionAttempted ||
    source.toolCommandRealExecutionAttempted
  ) {
    statuses.push('high-impact-execution-attempted');
  }
  if (source.rawHistoryMigrationAttempted || source.rawSqliteMigrationAttempted ||
    source.sourceModuleCopyAttempted || source.adapterRemovalAttempted) {
    statuses.push('source-not-ready');
  }
  if (!source.policyAllowsReadinessCheck) {
    statuses.push('policy-rejected');
  }

  return statuses;
}

function chooseChannel(
  source: ZavorthWave4B2TransportReadinessCheckSource,
  channelId?: string,
): ZavorthNativeIntegrationRecord | undefined {
  if (channelId) {
    return source.integrationRegistry.lookup(channelId).record;
  }

  return source.integrationRegistry.list({ integrationKind: 'channel' })[0];
}

function chooseTransport(
  source: ZavorthWave4B2TransportReadinessCheckSource,
  transportId?: string,
): ZavorthNativeIntegrationRecord | undefined {
  if (transportId) {
    return source.integrationRegistry.lookup(transportId).record;
  }

  return source.integrationRegistry.list({
    integrationKind: 'message-transport',
    classification: 'send-capable-but-blocked',
    supportsSend: true,
  })[0] ?? source.integrationRegistry.list({ integrationKind: 'message-transport' })[0];
}

function targetRecord(
  channel: ZavorthNativeIntegrationRecord | undefined,
  transport: ZavorthNativeIntegrationRecord | undefined,
): ZavorthWave4B2TransportReadinessCheckTarget {
  return {
    nativeContract: 'ZavorthWave4B2TransportReadinessCheckTarget/v1',
    channel: {
      id: channel?.id ?? 'missing-channel',
      type: channel?.integrationType ?? 'missing',
      status: channel?.status ?? 'missing',
      classification: channel?.classification ?? 'missing',
      supportsReceive: channel?.supportsReceive ?? false,
      receivePolicy: channel?.receivePolicy ?? 'missing',
    },
    transport: {
      id: transport?.id ?? 'missing-transport',
      type: transport?.integrationType ?? 'missing',
      status: transport?.status ?? 'missing',
      classification: transport?.classification ?? 'missing',
      configured: transport?.configured ?? false,
      supportsSend: transport?.supportsSend ?? false,
      supportsReceive: transport?.supportsReceive ?? false,
      supportsDryRun: transport?.supportsDryRun ?? false,
      sendPolicy: transport?.sendPolicy ?? 'missing',
      receivePolicy: transport?.receivePolicy ?? 'missing',
      requiredScopes: transport?.requiredScopes ?? [],
      requiredPermissions: transport?.requiredPermissions ?? [],
      targetRequirements: transport?.targetRequirements ?? [],
      rateLimitModel: transport?.rateLimitModel ?? 'missing',
      ackModel: transport?.ackModel ?? 'missing',
      errorModel: transport?.errorModel ?? 'missing',
    },
    sendCapableStatus: transport?.supportsSend && transport.sendPolicy === 'blocked' && transport.classification === 'send-capable-but-blocked'
      ? 'send-capable-but-blocked'
      : transport ? 'not-send-capable' : 'unknown',
    sourceIdentityPublic: false,
    rawSecretSerialized: false,
  };
}

function integrationDegraded(record: ZavorthNativeIntegrationRecord | undefined): boolean {
  return Boolean(record) && (
    record?.status === 'degraded' ||
    record?.status === 'unavailable' ||
    record?.status === 'unknown' ||
    record?.classification === 'degraded' ||
    record?.classification === 'unavailable' ||
    record?.classification === 'unknown'
  );
}

function unique<TValue>(values: TValue[]): TValue[] {
  return Array.from(new Set(values));
}

function readinessStatuses(input: {
  source: ZavorthWave4B2TransportReadinessCheckSource;
  featureFlag: ZavorthWave4B2TransportReadinessCheckFeatureFlagGate;
  channel: ZavorthNativeIntegrationRecord | undefined;
  transport: ZavorthNativeIntegrationRecord | undefined;
}): ZavorthWave4B2TransportReadinessCheckStatus[] {
  const statuses = sourceStatuses(input.source);

  if (!input.featureFlag.enabled) {
    statuses.push('feature-flag-disabled');
  }

  if (!input.channel || input.channel.integrationKind !== 'channel') {
    statuses.push('channel-unavailable');
  } else {
    statuses.push('channel-metadata-valid');
    if (integrationDegraded(input.channel)) {
      statuses.push('channel-degraded');
    }
    if (input.channel.supportsReceive || input.channel.receivePolicy === 'metadata-only') {
      statuses.push('receive-capable-metadata');
    }
  }

  if (!input.transport || input.transport.integrationKind !== 'message-transport') {
    statuses.push('transport-unavailable');
  } else {
    statuses.push('transport-metadata-valid');
    if (!input.transport.configured) {
      statuses.push('transport-unconfigured');
    }
    if (integrationDegraded(input.transport)) {
      statuses.push('transport-degraded');
    }
    if (input.transport.supportsSend && input.transport.sendPolicy === 'blocked') {
      statuses.push('send-capable-blocked');
    }
    if (input.transport.supportsReceive || input.transport.receivePolicy === 'metadata-only') {
      statuses.push('receive-capable-metadata');
    }
    statuses.push(input.transport.supportsDryRun ? 'dry-run-supported' : 'dry-run-unsupported');
    if (input.transport.supportsSend && input.transport.requiredSecretRefs.length === 0) {
      statuses.push('secretref-missing');
    } else if (input.transport.requiredSecretRefs.every((secretRef) => !secretRef.rawValueSerialized)) {
      statuses.push('secretref-metadata-only');
    }
    if (input.transport.requiredScopes.length > 0 && input.transport.requiredPermissions.length > 0) {
      statuses.push('scope-permission-metadata');
    }
    if (input.transport.rateLimitModel.length > 0 && input.transport.rateLimitModel !== 'missing') {
      statuses.push('rate-limit-metadata');
    }
    if (input.transport.ackModel.length > 0 && input.transport.ackModel !== 'missing') {
      statuses.push('ack-model-metadata');
    }
    if (input.transport.errorModel.length > 0 && input.transport.errorModel !== 'missing') {
      statuses.push('error-model-metadata');
    }
  }

  if (input.source.policyAllowsReadinessCheck) {
    statuses.push('policy-eligible');
  }
  statuses.push('idempotency-valid');

  if (
    statuses.includes('channel-metadata-valid') &&
    statuses.includes('transport-metadata-valid') &&
    statuses.includes('policy-eligible') &&
    statuses.includes('idempotency-valid') &&
    !statuses.includes('channel-degraded') &&
    !statuses.includes('transport-degraded') &&
    !statuses.includes('transport-unconfigured') &&
    !statuses.includes('secretref-missing')
  ) {
    statuses.push('valid');
  }

  return unique(statuses);
}

function decision(statuses: ZavorthWave4B2TransportReadinessCheckStatus[]): ZavorthWave4B2TransportReadinessCheckDecision {
  if (statuses.includes('feature-flag-disabled')) {
    return 'execution-blocked';
  }
  if (statuses.includes('source-not-ready') || statuses.includes('external-executor-touch-attempted') || statuses.includes('high-impact-execution-attempted')) {
    return 'readiness-blocked';
  }
  if (statuses.includes('policy-rejected')) {
    return 'readiness-policy-rejected';
  }
  if (statuses.includes('secretref-missing')) {
    return 'readiness-missing-secretref';
  }
  if (statuses.includes('channel-unavailable') || statuses.includes('transport-unavailable')) {
    return 'readiness-unknown';
  }
  if (statuses.includes('transport-unconfigured')) {
    return 'readiness-unconfigured';
  }
  if (statuses.includes('channel-degraded') || statuses.includes('transport-degraded')) {
    return 'readiness-degraded';
  }
  return statuses.includes('valid') ? 'readiness-ok' : 'readiness-unknown';
}

function detail(
  validation: ZavorthWave4B2TransportReadinessCheckDetail['validation'],
  status: ZavorthWave4B2TransportReadinessCheckDetail['status'],
  reason: string,
): ZavorthWave4B2TransportReadinessCheckDetail {
  return {
    nativeContract: 'ZavorthWave4B2TransportReadinessCheckDetail/v1',
    validation,
    status,
    reason,
  };
}

function validationDetails(statuses: ZavorthWave4B2TransportReadinessCheckStatus[]): ZavorthWave4B2TransportReadinessCheckDetail[] {
  return [
    detail('feature-flag', statuses.includes('feature-flag-disabled') ? 'blocked' : 'passed', statuses.includes('feature-flag-disabled')
      ? 'The required Wave 4B.2 transport readiness feature flag is disabled.'
      : 'The transport readiness feature flag is enabled for controlled metadata validation.'),
    detail('metadata-source', statuses.includes('source-not-ready') ? 'failed' : 'passed', statuses.includes('source-not-ready')
      ? 'Native transport/channel metadata sources are not ready or attempted out-of-scope work.'
      : 'Native integration and transport discovery metadata are the readiness source.'),
    detail('channel-metadata', statuses.includes('channel-unavailable') ? 'failed' : 'passed', statuses.includes('channel-unavailable')
      ? 'Channel metadata is missing.'
      : statuses.includes('channel-degraded')
        ? 'Channel metadata exists but is degraded or unavailable.'
        : 'Channel metadata resolves from the native integration registry.'),
    detail('transport-metadata', statuses.includes('transport-unavailable') ? 'failed' : 'passed', statuses.includes('transport-unavailable')
      ? 'Transport metadata is missing.'
      : statuses.includes('transport-unconfigured')
        ? 'Transport metadata exists but is unconfigured.'
        : statuses.includes('transport-degraded')
          ? 'Transport metadata exists but is degraded or unavailable.'
          : 'Transport metadata resolves from the native integration registry.'),
    detail('send-capable-block', statuses.includes('send-capable-blocked') ? 'passed' : 'blocked', statuses.includes('send-capable-blocked')
      ? 'Send-capable transport remains blocked and no message is sent.'
      : 'Selected transport is not send-capable or no blocked-send metadata is present.'),
    detail('dry-run-support', statuses.includes('dry-run-supported') ? 'passed' : 'blocked', statuses.includes('dry-run-supported')
      ? 'Dry-run support is advertised as metadata.'
      : 'Dry-run support is not advertised for the selected transport.'),
    detail('secretref-metadata', statuses.includes('secretref-missing') ? 'failed' : 'passed', statuses.includes('secretref-missing')
      ? 'A send-capable transport has no SecretRef metadata.'
      : 'Required credentials are represented only as SecretRef metadata.'),
    detail('scope-permission-metadata', statuses.includes('scope-permission-metadata') ? 'passed' : 'blocked', statuses.includes('scope-permission-metadata')
      ? 'Scopes and permissions are represented as metadata.'
      : 'Scopes and permissions are absent or unavailable.'),
    detail('rate-ack-error-model', statuses.includes('rate-limit-metadata') && statuses.includes('ack-model-metadata') && statuses.includes('error-model-metadata') ? 'passed' : 'blocked', 'Rate limit, ack, and error models are recorded as metadata when exposed.'),
    detail('policy-eligibility', statuses.includes('policy-rejected') ? 'blocked' : 'passed', statuses.includes('policy-rejected')
      ? 'Zavorth policy rejected the readiness check.'
      : 'Zavorth policy preflight allows the metadata-only readiness check.'),
    detail('external-executor-isolation', statuses.includes('external-executor-touch-attempted') ? 'failed' : 'passed', statuses.includes('external-executor-touch-attempted')
      ? 'The source attempted to touch the external runtime, which is forbidden.'
      : 'The readiness path does not touch the external runtime.'),
    detail('high-impact-block', statuses.includes('high-impact-execution-attempted') ? 'failed' : 'passed', statuses.includes('high-impact-execution-attempted')
      ? 'A high-impact send/provider/tool/transport operation was attempted.'
      : 'Message send, provider/tool/command execution, and mutable transport remain blocked.'),
    detail('idempotency', statuses.includes('idempotency-valid') ? 'passed' : 'failed', statuses.includes('idempotency-valid')
      ? 'The action uses a deterministic idempotency key for repeatable readiness checks.'
      : 'The idempotency key is missing or invalid.'),
  ];
}

function policyPreflight(target: ZavorthWave4B2TransportReadinessCheckTarget): ZavorthWave4B2TransportReadinessPolicyPreflight {
  return {
    nativeContract: 'ZavorthWave4B2TransportReadinessPolicyPreflight/v1',
    policyPreflightRequired: true,
    policyRecheckedImmediatelyBeforeExecution: true,
    approvalRequired: false,
    approvalEscalatesForExternalProbe: true,
    exactScope: {
      channelIntegrationId: target.channel.id,
      transportIntegrationId: target.transport.id,
    },
    messageSendBlocked: true,
    providerExecutionBlocked: true,
    toolCommandExecutionBlocked: true,
    externalTransportBlocked: true,
    rawHistoryMigrationBlocked: true,
  };
}

function cleanupReceipt(): ZavorthWave4B2TransportReadinessCheckCleanupReceipt {
  return {
    nativeContract: 'ZavorthWave4B2TransportReadinessCheckCleanupReceipt/v1',
    cleanupActuallyPerformed: true,
    cleanupLimitedToControlledTestMetadata: true,
    transportActuallyOpened: false,
    externalExecutorTouched: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    rawSecretSerialized: false,
  };
}

function idempotencyKey(target: ZavorthWave4B2TransportReadinessCheckTarget): string {
  return [
    'zavorth-wave4b2-transport-readiness-check',
    target.channel.id,
    target.transport.id,
    target.transport.status,
    target.transport.classification,
  ].join(':');
}

export class ZavorthWave4B2TransportReadinessCheckExecutable {
  public constructor(public readonly receipt: ZavorthWave4B2TransportReadinessCheckReceipt) {}

  public readinessSucceeded(): boolean {
    return this.receipt.decision === 'readiness-ok';
  }

  public messageSendStillBlocked(): boolean {
    return this.receipt.realMessageSendAllowed === false &&
      this.receipt.transportActuallyOpened === false &&
      this.receipt.policyPreflight.messageSendBlocked;
  }

  public isIdempotentWith(other: ZavorthWave4B2TransportReadinessCheckExecutable): boolean {
    return this.receipt.idempotencyKey === other.receipt.idempotencyKey &&
      this.receipt.decision === other.receipt.decision;
  }
}

export function createZavorthWave4B2TransportReadinessCheckFeatureFlagGate(
  enabled: boolean,
): ZavorthWave4B2TransportReadinessCheckFeatureFlagGate {
  return {
    nativeContract: 'ZavorthWave4B2TransportReadinessCheckFeatureFlagGate/v1',
    flagName: ZAVORTH_WAVE4B2_TRANSPORT_READINESS_CHECK_EXECUTE_FLAG,
    enabled,
    safetyGate: 'controlled-test',
    operatorAcknowledgedNoExternalTransport: true,
    transportReadinessCheckFeatureFlagRequired: true,
  };
}

export function createZavorthWave4B2TransportReadinessCheckSource(
  overrides: Partial<Omit<
    ZavorthWave4B2TransportReadinessCheckSource,
    'integrationRegistry' | 'mediumRiskSelection' | 'targetSessionChannelValidation'
  >> & {
    integrationRegistry?: ZavorthNativeIntegrationRegistry;
    mediumRiskSelection?: ZavorthWave4B2MediumRiskExecutableCapabilitySelectionNormalization;
    targetSessionChannelValidation?: ZavorthWave4B2TargetSessionChannelValidationReceipt;
  } = {},
): ZavorthWave4B2TransportReadinessCheckSource {
  return {
    mediumRiskSelection: normalizeZavorthWave4B2MediumRiskExecutableCapabilitySelectionFixture(),
    targetSessionChannelValidation: createZavorthWave4B2TargetSessionChannelValidationExecutableFixture().receipt,
    integrationRegistry: createZavorthNativeIntegrationRegistryFixture(),
    wave4cSessionHistoryMetadataReady: true,
    nativeIntegrationRegistryReady: true,
    realTransportDiscoveryMetadataReady: true,
    messageSendTransportBlockedRehearsalReady: true,
    actionGovernancePipelineReady: true,
    policyAllowsReadinessCheck: true,
    runtimeExternalExecutorRequiredForExecution: false,
    externalExecutorTouched: false,
    realMessageSendAttempted: false,
    transportOpenAttempted: false,
    providerRealExecutionAttempted: false,
    toolCommandRealExecutionAttempted: false,
    externalExecutorMutationAttempted: false,
    rawHistoryMigrationAttempted: false,
    rawSqliteMigrationAttempted: false,
    rawSecretSerialized: false,
    sourceModuleCopyAttempted: false,
    adapterRemovalAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    ...overrides,
  };
}

export function normalizeZavorthWave4B2TransportReadinessCheckExecutable(
  options: ZavorthWave4B2TransportReadinessCheckOptions,
): ZavorthWave4B2TransportReadinessCheckReceipt {
  const channel = chooseChannel(options.source, options.targetChannelIntegrationId);
  const transport = chooseTransport(options.source, options.targetTransportIntegrationId);
  const target = targetRecord(channel, transport);
  const statuses = readinessStatuses({
    source: options.source,
    featureFlag: options.featureFlag,
    channel,
    transport,
  });
  const gateDecision = decision(statuses);

  return {
    nativeContract: 'ZavorthWave4B2TransportReadinessCheckExecutableReceipt/v1',
    runtimeId: options.runtimeId,
    generatedAt: options.generatedAt,
    selectedMediumRiskCapability: 'transport-readiness-check-action',
    decision: gateDecision,
    classification: gateDecision,
    validations: statuses,
    validationDetails: validationDetails(statuses),
    featureFlag: options.featureFlag,
    idempotencyKey: idempotencyKey(target),
    target,
    policyPreflight: policyPreflight(target),
    requiredSecretRefs: transport?.requiredSecretRefs ?? [],
    sourceMetadata: {
      integrationRegistryRecordCount: options.source.integrationRegistry.snapshot.records.length,
      targetSessionChannelValidationDecision: options.source.targetSessionChannelValidation.decision,
      nativeIntegrationRegistryUsed: true,
      transportDiscoveryMetadataUsed: true,
      messageSendTransportBlockedRehearsalUsed: true,
      sourceProvenanceInternalRedacted: true,
    },
    cleanupReceipt: cleanupReceipt(),
    wave4b2TransportReadinessCheckExecutableCreated: true,
    transportReadinessCheckActuallyExecuted: options.featureFlag.enabled,
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
  };
}

export function createZavorthWave4B2TransportReadinessCheckExecutableFixture(
  overrides: {
    featureFlagEnabled?: boolean;
    generatedAt?: string;
    source?: Partial<Parameters<typeof createZavorthWave4B2TransportReadinessCheckSource>[0]>;
    targetChannelIntegrationId?: string;
    targetTransportIntegrationId?: string;
  } = {},
): ZavorthWave4B2TransportReadinessCheckExecutable {
  const source = createZavorthWave4B2TransportReadinessCheckSource(overrides.source);
  const receipt = normalizeZavorthWave4B2TransportReadinessCheckExecutable({
    generatedAt: overrides.generatedAt ?? ZAVORTH_WAVE4B2_TRANSPORT_READINESS_CHECK_EXECUTABLE_NOW,
    runtimeId: ZAVORTH_WAVE4B2_TRANSPORT_READINESS_CHECK_EXECUTABLE_RUNTIME_ID,
    source,
    featureFlag: createZavorthWave4B2TransportReadinessCheckFeatureFlagGate(overrides.featureFlagEnabled ?? true),
    targetChannelIntegrationId: overrides.targetChannelIntegrationId,
    targetTransportIntegrationId: overrides.targetTransportIntegrationId,
  });

  return new ZavorthWave4B2TransportReadinessCheckExecutable(receipt);
}
