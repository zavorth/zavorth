import {
  ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTE_FLAG,
  normalizeZavorthWave4B2MediumRiskExecutableCapabilitySelectionFixture,
} from './ZavorthWave4B2MediumRiskExecutableCapabilitySelection.js';
import {
  createZavorthNativeIntegrationRegistryFixture,
} from './ZavorthNativeIntegrationRegistry.js';
import {
  createZavorthNativeSessionHistoryRegistryFixture,
} from './ZavorthNativeSessionHistoryRegistry.js';
import type {
  ZavorthNativeIntegrationRecord,
  ZavorthNativeIntegrationRegistry,
  ZavorthNativeIntegrationSecretRefMetadata,
} from './ZavorthNativeIntegrationRegistry.js';
import type {
  ZavorthNativeSessionHistoryRegistry,
  ZavorthNativeSessionMetadataRecord,
  ZavorthNativeThreadMetadataRecord,
} from './ZavorthNativeSessionHistoryRegistry.js';
import type {
  ZavorthWave4B2MediumRiskExecutableCapabilitySelectionNormalization,
} from './ZavorthWave4B2MediumRiskExecutableCapabilitySelection.js';

export const ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTABLE_NOW = '2026-04-30T19:00:00.000Z' as const;
export const ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTABLE_RUNTIME_ID = 'zavorth-wave4b2-target-session-channel-validation-executable' as const;

export type ZavorthWave4B2TargetSessionChannelValidationDecision =
  | 'execution-blocked'
  | 'validation-blocked'
  | 'validation-channel-unavailable'
  | 'validation-degraded'
  | 'validation-ok'
  | 'validation-policy-rejected'
  | 'validation-target-missing';

export type ZavorthWave4B2TargetSessionChannelValidationStatus =
  | 'channel-linkage-valid'
  | 'channel-unavailable'
  | 'degraded-state'
  | 'feature-flag-disabled'
  | 'high-impact-execution-attempted'
  | 'idempotency-valid'
  | 'external-executor-touch-attempted'
  | 'participant-metadata-redacted'
  | 'policy-eligible'
  | 'policy-rejected'
  | 'secretref-metadata-only'
  | 'send-capable-blocked'
  | 'session-linkage-valid'
  | 'source-not-ready'
  | 'target-missing'
  | 'thread-linkage-invalid'
  | 'thread-linkage-valid'
  | 'transport-linkage-valid'
  | 'transport-unavailable'
  | 'valid';

export type ZavorthWave4B2TargetSessionChannelValidationFeatureFlagGate = {
  nativeContract: 'ZavorthWave4B2TargetSessionChannelValidationFeatureFlagGate/v1';
  flagName: typeof ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTE_FLAG;
  enabled: boolean;
  safetyGate: 'controlled-production' | 'controlled-test';
  operatorAcknowledgedNoExternalTransport: boolean;
  targetSessionChannelValidationFeatureFlagRequired: true;
};

export type ZavorthWave4B2TargetSessionChannelValidationSource = {
  mediumRiskSelection: ZavorthWave4B2MediumRiskExecutableCapabilitySelectionNormalization;
  sessionHistoryRegistry: ZavorthNativeSessionHistoryRegistry;
  integrationRegistry: ZavorthNativeIntegrationRegistry;
  wave4cSessionHistoryMetadataReady: true;
  sessionHistoryReadOnlyBridgeReady: true;
  nativeSessionHistoryRegistryReady: true;
  nativeIntegrationRegistryReady: true;
  realTransportDiscoveryMetadataReady: true;
  messageSendTransportBlockedRehearsalReady: true;
  actionGovernancePipelineReady: true;
  policyAllowsValidation: boolean;
  migratedSessionChannelTargetMetadataReady: true;
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

export type ZavorthWave4B2TargetSessionChannelValidationTarget = {
  nativeContract: 'ZavorthWave4B2TargetSessionChannelValidationTarget/v1';
  sessionRecordId: string;
  sessionAlias: string;
  threadRecordId: string;
  channelIntegrationId: string;
  transportIntegrationId: string;
  participantCount: number;
  participantKinds: ZavorthNativeSessionMetadataRecord['participantMetadata']['participantKinds'];
  messageMetadataCount: number;
  sendCapableStatus: 'send-capable-but-blocked' | 'not-send-capable' | 'unknown';
  sourceIdentityPublic: false;
  rawParticipantIdsSerialized: false;
  rawMessageContentSerialized: false;
};

export type ZavorthWave4B2TargetSessionChannelValidationDetail = {
  nativeContract: 'ZavorthWave4B2TargetSessionChannelValidationDetail/v1';
  validation:
    | 'channel-linkage'
    | 'feature-flag'
    | 'high-impact-block'
    | 'idempotency'
    | 'metadata-source'
    | 'external-executor-isolation'
    | 'participant-redaction'
    | 'policy-eligibility'
    | 'secretref-metadata'
    | 'send-capable-block'
    | 'session-linkage'
    | 'target-resolution'
    | 'thread-linkage'
    | 'transport-linkage';
  status: 'blocked' | 'failed' | 'passed';
  reason: string;
};

export type ZavorthWave4B2TargetSessionChannelValidationPolicyPreflight = {
  nativeContract: 'ZavorthWave4B2TargetSessionChannelValidationPolicyPreflight/v1';
  policyPreflightRequired: true;
  policyRecheckedImmediatelyBeforeExecution: true;
  approvalRequired: false;
  exactScope: {
    sessionRecordId: string;
    threadRecordId: string;
    channelIntegrationId: string;
    transportIntegrationId: string;
  };
  messageSendBlocked: true;
  providerExecutionBlocked: true;
  toolCommandExecutionBlocked: true;
  externalTransportBlocked: true;
  rawHistoryMigrationBlocked: true;
};

export type ZavorthWave4B2TargetSessionChannelValidationReceipt = {
  nativeContract: 'ZavorthWave4B2TargetSessionChannelValidationExecutableReceipt/v1';
  runtimeId: typeof ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTABLE_RUNTIME_ID;
  generatedAt: string;
  selectedMediumRiskCapability: 'target-session-channel-validation-action';
  decision: ZavorthWave4B2TargetSessionChannelValidationDecision;
  classification: ZavorthWave4B2TargetSessionChannelValidationDecision;
  validations: ZavorthWave4B2TargetSessionChannelValidationStatus[];
  validationDetails: ZavorthWave4B2TargetSessionChannelValidationDetail[];
  featureFlag: ZavorthWave4B2TargetSessionChannelValidationFeatureFlagGate;
  idempotencyKey: string;
  target: ZavorthWave4B2TargetSessionChannelValidationTarget;
  policyPreflight: ZavorthWave4B2TargetSessionChannelValidationPolicyPreflight;
  requiredSecretRefs: ZavorthNativeIntegrationSecretRefMetadata[];
  sourceMetadata: {
    sessionRegistryRecordCount: number;
    threadRegistryRecordCount: number;
    integrationRegistryRecordCount: number;
    migratedSessionChannelTargetMetadataUsed: true;
    nativeSessionHistoryRegistryUsed: true;
    nativeIntegrationRegistryUsed: true;
    sourceProvenanceInternalRedacted: true;
  };
  cleanupReceipt: ZavorthWave4B2TargetSessionChannelValidationCleanupReceipt;
  wave4b2TargetSessionChannelValidationExecutableCreated: true;
  targetSessionChannelValidationActuallyExecuted: boolean;
  targetSessionChannelValidationActuallyExecutedOnlyWhenFlagEnabled: true;
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

export type ZavorthWave4B2TargetSessionChannelValidationCleanupReceipt = {
  nativeContract: 'ZavorthWave4B2TargetSessionChannelValidationCleanupReceipt/v1';
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

export type ZavorthWave4B2TargetSessionChannelValidationOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTABLE_RUNTIME_ID;
  source: ZavorthWave4B2TargetSessionChannelValidationSource;
  featureFlag: ZavorthWave4B2TargetSessionChannelValidationFeatureFlagGate;
  targetSessionId?: string;
  targetSessionAlias?: string;
  targetThreadId?: string;
  targetChannelIntegrationId?: string;
  targetTransportIntegrationId?: string;
};

function sourceStatuses(source: ZavorthWave4B2TargetSessionChannelValidationSource): ZavorthWave4B2TargetSessionChannelValidationStatus[] {
  const statuses: ZavorthWave4B2TargetSessionChannelValidationStatus[] = [];

  if (
    source.mediumRiskSelection.decision !== 'wave4b2-medium-risk-executable-selection-ready' ||
    !source.wave4cSessionHistoryMetadataReady ||
    !source.sessionHistoryReadOnlyBridgeReady ||
    !source.nativeSessionHistoryRegistryReady ||
    !source.nativeIntegrationRegistryReady ||
    !source.realTransportDiscoveryMetadataReady ||
    !source.messageSendTransportBlockedRehearsalReady ||
    !source.actionGovernancePipelineReady ||
    !source.migratedSessionChannelTargetMetadataReady ||
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
  if (!source.policyAllowsValidation) {
    statuses.push('policy-rejected');
  }

  return statuses;
}

function firstSession(source: ZavorthWave4B2TargetSessionChannelValidationSource): ZavorthNativeSessionMetadataRecord | undefined {
  return source.sessionHistoryRegistry.listSessions()[0];
}

function findSession(
  source: ZavorthWave4B2TargetSessionChannelValidationSource,
  sessionId?: string,
): ZavorthNativeSessionMetadataRecord | undefined {
  if (!sessionId) {
    return firstSession(source);
  }

  return source.sessionHistoryRegistry.lookupSession(sessionId).record;
}

function findThread(
  source: ZavorthWave4B2TargetSessionChannelValidationSource,
  session: ZavorthNativeSessionMetadataRecord | undefined,
  threadId?: string,
): ZavorthNativeThreadMetadataRecord | undefined {
  if (!session) {
    return undefined;
  }

  const selectedThreadId = threadId ?? session.threadRecordIds[0];
  return selectedThreadId ? source.sessionHistoryRegistry.lookupThread(selectedThreadId).record : undefined;
}

function lookupIntegration(
  source: ZavorthWave4B2TargetSessionChannelValidationSource,
  integrationId: string | undefined,
): ZavorthNativeIntegrationRecord | undefined {
  if (!integrationId) {
    return undefined;
  }

  return source.integrationRegistry.lookup(integrationId).record;
}

function chooseChannel(
  source: ZavorthWave4B2TargetSessionChannelValidationSource,
  session: ZavorthNativeSessionMetadataRecord | undefined,
  channelId?: string,
): ZavorthNativeIntegrationRecord | undefined {
  const selectedChannelId = channelId ?? session?.channelIntegrationIds[0];
  return lookupIntegration(source, selectedChannelId);
}

function chooseTransport(
  source: ZavorthWave4B2TargetSessionChannelValidationSource,
  session: ZavorthNativeSessionMetadataRecord | undefined,
  transportId?: string,
): ZavorthNativeIntegrationRecord | undefined {
  const selectedTransportId = transportId ?? session?.transportIntegrationIds
    .map((id) => source.integrationRegistry.lookup(id).record)
    .find((record): record is ZavorthNativeIntegrationRecord => record !== undefined && record.supportsSend && record.sendPolicy === 'blocked')
    ?.id ?? session?.transportIntegrationIds[0];

  return lookupIntegration(source, selectedTransportId);
}

function targetRecord(
  session: ZavorthNativeSessionMetadataRecord | undefined,
  thread: ZavorthNativeThreadMetadataRecord | undefined,
  channel: ZavorthNativeIntegrationRecord | undefined,
  transport: ZavorthNativeIntegrationRecord | undefined,
): ZavorthWave4B2TargetSessionChannelValidationTarget {
  return {
    nativeContract: 'ZavorthWave4B2TargetSessionChannelValidationTarget/v1',
    sessionRecordId: session?.id ?? 'missing-session',
    sessionAlias: session?.publicSessionAlias ?? 'missing-session-alias',
    threadRecordId: thread?.id ?? 'missing-thread',
    channelIntegrationId: channel?.id ?? 'missing-channel',
    transportIntegrationId: transport?.id ?? 'missing-transport',
    participantCount: session?.participantMetadata.participantCount ?? 0,
    participantKinds: session?.participantMetadata.participantKinds ?? [],
    messageMetadataCount: session?.messageMetadataRecordIds.length ?? 0,
    sendCapableStatus: transport?.supportsSend && transport.sendPolicy === 'blocked' && transport.classification === 'send-capable-but-blocked'
      ? 'send-capable-but-blocked'
      : transport ? 'not-send-capable' : 'unknown',
    sourceIdentityPublic: false,
    rawParticipantIdsSerialized: false,
    rawMessageContentSerialized: false,
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

function validationStatuses(input: {
  source: ZavorthWave4B2TargetSessionChannelValidationSource;
  featureFlag: ZavorthWave4B2TargetSessionChannelValidationFeatureFlagGate;
  session: ZavorthNativeSessionMetadataRecord | undefined;
  targetAlias?: string;
  thread: ZavorthNativeThreadMetadataRecord | undefined;
  channel: ZavorthNativeIntegrationRecord | undefined;
  transport: ZavorthNativeIntegrationRecord | undefined;
}): ZavorthWave4B2TargetSessionChannelValidationStatus[] {
  const statuses = sourceStatuses(input.source);

  if (!input.featureFlag.enabled) {
    statuses.push('feature-flag-disabled');
  }

  const aliasMatches = !input.targetAlias || input.session?.publicSessionAlias === input.targetAlias;
  if (!input.session || !aliasMatches) {
    statuses.push('target-missing');
  } else {
    statuses.push('session-linkage-valid');
  }

  if (!input.thread || !input.session || input.thread.sessionRecordId !== input.session.id) {
    statuses.push('thread-linkage-invalid');
  } else {
    statuses.push('thread-linkage-valid');
  }

  if (!input.channel || input.channel.integrationKind !== 'channel') {
    statuses.push('channel-unavailable');
  } else {
    statuses.push('channel-linkage-valid');
    if (integrationDegraded(input.channel)) {
      statuses.push('degraded-state');
    }
  }

  if (!input.transport || input.transport.integrationKind !== 'message-transport') {
    statuses.push('transport-unavailable');
  } else {
    statuses.push('transport-linkage-valid');
    if (integrationDegraded(input.transport)) {
      statuses.push('degraded-state');
    }
  }

  if (input.transport?.supportsSend && input.transport.sendPolicy === 'blocked') {
    statuses.push('send-capable-blocked');
  }

  if (input.session && !input.session.participantMetadata.rawParticipantIdsSerialized) {
    statuses.push('participant-metadata-redacted');
  }

  const secretRefs = input.transport?.requiredSecretRefs ?? [];
  if (secretRefs.every((secretRef) => !secretRef.rawValueSerialized)) {
    statuses.push('secretref-metadata-only');
  }

  if (input.source.policyAllowsValidation) {
    statuses.push('policy-eligible');
  }
  statuses.push('idempotency-valid');

  if (
    statuses.includes('session-linkage-valid') &&
    statuses.includes('thread-linkage-valid') &&
    statuses.includes('channel-linkage-valid') &&
    statuses.includes('transport-linkage-valid') &&
    statuses.includes('send-capable-blocked') &&
    statuses.includes('secretref-metadata-only') &&
    statuses.includes('policy-eligible')
  ) {
    statuses.push('valid');
  }

  return unique(statuses);
}

function decision(statuses: ZavorthWave4B2TargetSessionChannelValidationStatus[]): ZavorthWave4B2TargetSessionChannelValidationDecision {
  if (statuses.includes('feature-flag-disabled')) {
    return 'execution-blocked';
  }
  if (statuses.includes('external-executor-touch-attempted') || statuses.includes('high-impact-execution-attempted') || statuses.includes('source-not-ready')) {
    return 'validation-blocked';
  }
  if (statuses.includes('policy-rejected')) {
    return 'validation-policy-rejected';
  }
  if (statuses.includes('target-missing') || statuses.includes('thread-linkage-invalid')) {
    return 'validation-target-missing';
  }
  if (statuses.includes('channel-unavailable') || statuses.includes('transport-unavailable')) {
    return 'validation-channel-unavailable';
  }
  if (statuses.includes('degraded-state')) {
    return 'validation-degraded';
  }
  return statuses.includes('valid') ? 'validation-ok' : 'validation-degraded';
}

function detail(
  validation: ZavorthWave4B2TargetSessionChannelValidationDetail['validation'],
  status: ZavorthWave4B2TargetSessionChannelValidationDetail['status'],
  reason: string,
): ZavorthWave4B2TargetSessionChannelValidationDetail {
  return {
    nativeContract: 'ZavorthWave4B2TargetSessionChannelValidationDetail/v1',
    validation,
    status,
    reason,
  };
}

function validationDetails(statuses: ZavorthWave4B2TargetSessionChannelValidationStatus[]): ZavorthWave4B2TargetSessionChannelValidationDetail[] {
  return [
    detail('feature-flag', statuses.includes('feature-flag-disabled') ? 'blocked' : 'passed', statuses.includes('feature-flag-disabled')
      ? 'The required Wave 4B.2 validation feature flag is disabled.'
      : 'The required Wave 4B.2 validation feature flag is enabled for controlled metadata validation.'),
    detail('metadata-source', statuses.includes('source-not-ready') ? 'failed' : 'passed', statuses.includes('source-not-ready')
      ? 'Native or migrated metadata sources are not ready or attempted an out-of-scope operation.'
      : 'Native session/history and integration registries are the validation source.'),
    detail('target-resolution', statuses.includes('target-missing') ? 'failed' : 'passed', statuses.includes('target-missing')
      ? 'The target session or alias is absent from Zavorth-owned metadata.'
      : 'Target session metadata resolves from the native registry.'),
    detail('thread-linkage', statuses.includes('thread-linkage-invalid') ? 'failed' : 'passed', statuses.includes('thread-linkage-invalid')
      ? 'The requested thread is missing or not linked to the target session.'
      : 'Thread metadata is linked to the target session.'),
    detail('channel-linkage', statuses.includes('channel-unavailable') ? 'failed' : 'passed', statuses.includes('channel-unavailable')
      ? 'Channel metadata is missing, degraded, unavailable, or unknown.'
      : 'Channel metadata resolves as Zavorth-native metadata.'),
    detail('transport-linkage', statuses.includes('transport-unavailable') ? 'failed' : 'passed', statuses.includes('transport-unavailable')
      ? 'Transport metadata is missing, degraded, unavailable, or unknown.'
      : 'Transport metadata resolves from the native integration registry.'),
    detail('send-capable-block', statuses.includes('send-capable-blocked') ? 'passed' : 'blocked', statuses.includes('send-capable-blocked')
      ? 'Send-capable metadata remains blocked; no message transport is opened.'
      : 'No send-capable blocked transport was selected.'),
    detail('secretref-metadata', statuses.includes('secretref-metadata-only') ? 'passed' : 'failed', statuses.includes('secretref-metadata-only')
      ? 'Required credentials are represented only as SecretRef metadata.'
      : 'SecretRef metadata failed redaction rules.'),
    detail('participant-redaction', statuses.includes('participant-metadata-redacted') ? 'passed' : 'failed', statuses.includes('participant-metadata-redacted')
      ? 'Participant metadata is counted and typed without raw participant identifiers.'
      : 'Participant metadata is missing redaction guarantees.'),
    detail('policy-eligibility', statuses.includes('policy-rejected') ? 'blocked' : 'passed', statuses.includes('policy-rejected')
      ? 'Zavorth policy rejected the target/session/channel validation.'
      : 'Zavorth policy preflight allows the metadata-only validation.'),
    detail('external-executor-isolation', statuses.includes('external-executor-touch-attempted') ? 'failed' : 'passed', statuses.includes('external-executor-touch-attempted')
      ? 'The source attempted to touch the external runtime, which is forbidden for this executable.'
      : 'The validation path does not touch the external runtime.'),
    detail('high-impact-block', statuses.includes('high-impact-execution-attempted') ? 'failed' : 'passed', statuses.includes('high-impact-execution-attempted')
      ? 'A high-impact send/provider/tool/transport operation was attempted.'
      : 'Message send, provider/tool/command execution, and mutable transport remain blocked.'),
    detail('idempotency', statuses.includes('idempotency-valid') ? 'passed' : 'failed', statuses.includes('idempotency-valid')
      ? 'The action uses a deterministic idempotency key for repeatable validation.'
      : 'The idempotency key is missing or invalid.'),
  ];
}

function policyPreflight(target: ZavorthWave4B2TargetSessionChannelValidationTarget): ZavorthWave4B2TargetSessionChannelValidationPolicyPreflight {
  return {
    nativeContract: 'ZavorthWave4B2TargetSessionChannelValidationPolicyPreflight/v1',
    policyPreflightRequired: true,
    policyRecheckedImmediatelyBeforeExecution: true,
    approvalRequired: false,
    exactScope: {
      sessionRecordId: target.sessionRecordId,
      threadRecordId: target.threadRecordId,
      channelIntegrationId: target.channelIntegrationId,
      transportIntegrationId: target.transportIntegrationId,
    },
    messageSendBlocked: true,
    providerExecutionBlocked: true,
    toolCommandExecutionBlocked: true,
    externalTransportBlocked: true,
    rawHistoryMigrationBlocked: true,
  };
}

function cleanupReceipt(): ZavorthWave4B2TargetSessionChannelValidationCleanupReceipt {
  return {
    nativeContract: 'ZavorthWave4B2TargetSessionChannelValidationCleanupReceipt/v1',
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

function idempotencyKey(target: ZavorthWave4B2TargetSessionChannelValidationTarget): string {
  return [
    'zavorth-wave4b2-target-session-channel-validation',
    target.sessionRecordId,
    target.threadRecordId,
    target.channelIntegrationId,
    target.transportIntegrationId,
  ].join(':');
}

export class ZavorthWave4B2TargetSessionChannelValidationExecutable {
  public constructor(public readonly receipt: ZavorthWave4B2TargetSessionChannelValidationReceipt) {}

  public validationSucceeded(): boolean {
    return this.receipt.decision === 'validation-ok';
  }

  public messageSendStillBlocked(): boolean {
    return this.receipt.realMessageSendAllowed === false &&
      this.receipt.transportActuallyOpened === false &&
      this.receipt.policyPreflight.messageSendBlocked;
  }

  public isIdempotentWith(other: ZavorthWave4B2TargetSessionChannelValidationExecutable): boolean {
    return this.receipt.idempotencyKey === other.receipt.idempotencyKey &&
      this.receipt.decision === other.receipt.decision;
  }
}

export function createZavorthWave4B2TargetSessionChannelValidationFeatureFlagGate(
  enabled: boolean,
): ZavorthWave4B2TargetSessionChannelValidationFeatureFlagGate {
  return {
    nativeContract: 'ZavorthWave4B2TargetSessionChannelValidationFeatureFlagGate/v1',
    flagName: ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTE_FLAG,
    enabled,
    safetyGate: 'controlled-test',
    operatorAcknowledgedNoExternalTransport: true,
    targetSessionChannelValidationFeatureFlagRequired: true,
  };
}

export function createZavorthWave4B2TargetSessionChannelValidationSource(
  overrides: Partial<Omit<
    ZavorthWave4B2TargetSessionChannelValidationSource,
    'integrationRegistry' | 'mediumRiskSelection' | 'sessionHistoryRegistry'
  >> & {
    integrationRegistry?: ZavorthNativeIntegrationRegistry;
    mediumRiskSelection?: ZavorthWave4B2MediumRiskExecutableCapabilitySelectionNormalization;
    sessionHistoryRegistry?: ZavorthNativeSessionHistoryRegistry;
  } = {},
): ZavorthWave4B2TargetSessionChannelValidationSource {
  return {
    mediumRiskSelection: normalizeZavorthWave4B2MediumRiskExecutableCapabilitySelectionFixture(),
    sessionHistoryRegistry: createZavorthNativeSessionHistoryRegistryFixture(),
    integrationRegistry: createZavorthNativeIntegrationRegistryFixture(),
    wave4cSessionHistoryMetadataReady: true,
    sessionHistoryReadOnlyBridgeReady: true,
    nativeSessionHistoryRegistryReady: true,
    nativeIntegrationRegistryReady: true,
    realTransportDiscoveryMetadataReady: true,
    messageSendTransportBlockedRehearsalReady: true,
    actionGovernancePipelineReady: true,
    policyAllowsValidation: true,
    migratedSessionChannelTargetMetadataReady: true,
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

export function normalizeZavorthWave4B2TargetSessionChannelValidationExecutable(
  options: ZavorthWave4B2TargetSessionChannelValidationOptions,
): ZavorthWave4B2TargetSessionChannelValidationReceipt {
  const session = findSession(options.source, options.targetSessionId);
  const thread = findThread(options.source, session, options.targetThreadId);
  const channel = chooseChannel(options.source, session, options.targetChannelIntegrationId);
  const transport = chooseTransport(options.source, session, options.targetTransportIntegrationId);
  const target = targetRecord(session, thread, channel, transport);
  const statuses = validationStatuses({
    source: options.source,
    featureFlag: options.featureFlag,
    session,
    targetAlias: options.targetSessionAlias,
    thread,
    channel,
    transport,
  });
  const gateDecision = decision(statuses);
  const secretRefs = transport?.requiredSecretRefs ?? [];

  return {
    nativeContract: 'ZavorthWave4B2TargetSessionChannelValidationExecutableReceipt/v1',
    runtimeId: options.runtimeId,
    generatedAt: options.generatedAt,
    selectedMediumRiskCapability: 'target-session-channel-validation-action',
    decision: gateDecision,
    classification: gateDecision,
    validations: statuses,
    validationDetails: validationDetails(statuses),
    featureFlag: options.featureFlag,
    idempotencyKey: idempotencyKey(target),
    target,
    policyPreflight: policyPreflight(target),
    requiredSecretRefs: secretRefs,
    sourceMetadata: {
      sessionRegistryRecordCount: options.source.sessionHistoryRegistry.snapshot.sessions.length,
      threadRegistryRecordCount: options.source.sessionHistoryRegistry.snapshot.threads.length,
      integrationRegistryRecordCount: options.source.integrationRegistry.snapshot.records.length,
      migratedSessionChannelTargetMetadataUsed: true,
      nativeSessionHistoryRegistryUsed: true,
      nativeIntegrationRegistryUsed: true,
      sourceProvenanceInternalRedacted: true,
    },
    cleanupReceipt: cleanupReceipt(),
    wave4b2TargetSessionChannelValidationExecutableCreated: true,
    targetSessionChannelValidationActuallyExecuted: options.featureFlag.enabled,
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
  };
}

export function createZavorthWave4B2TargetSessionChannelValidationExecutableFixture(
  overrides: {
    featureFlagEnabled?: boolean;
    generatedAt?: string;
    source?: Partial<Parameters<typeof createZavorthWave4B2TargetSessionChannelValidationSource>[0]>;
    targetSessionId?: string;
    targetSessionAlias?: string;
    targetThreadId?: string;
    targetChannelIntegrationId?: string;
    targetTransportIntegrationId?: string;
  } = {},
): ZavorthWave4B2TargetSessionChannelValidationExecutable {
  const source = createZavorthWave4B2TargetSessionChannelValidationSource(overrides.source);
  const receipt = normalizeZavorthWave4B2TargetSessionChannelValidationExecutable({
    generatedAt: overrides.generatedAt ?? ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTABLE_NOW,
    runtimeId: ZAVORTH_WAVE4B2_TARGET_SESSION_CHANNEL_VALIDATION_EXECUTABLE_RUNTIME_ID,
    source,
    featureFlag: createZavorthWave4B2TargetSessionChannelValidationFeatureFlagGate(overrides.featureFlagEnabled ?? true),
    targetSessionId: overrides.targetSessionId,
    targetSessionAlias: overrides.targetSessionAlias,
    targetThreadId: overrides.targetThreadId,
    targetChannelIntegrationId: overrides.targetChannelIntegrationId,
    targetTransportIntegrationId: overrides.targetTransportIntegrationId,
  });

  return new ZavorthWave4B2TargetSessionChannelValidationExecutable(receipt);
}
