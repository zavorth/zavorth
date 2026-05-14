import {
  ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLE_SELECTION_RUNTIME_ID,
  normalizeZavorthWave4B3MessageSendDryRunExecutableSelectionFixture,
} from './ZavorthWave4B3MessageSendDryRunExecutableSelection.js';
import {
  createZavorthNativeIntegrationRegistryFixture,
} from './ZavorthNativeIntegrationRegistry.js';
import {
  createZavorthNativeSessionHistoryRegistryFixture,
} from './ZavorthNativeSessionHistoryRegistry.js';
import {
  createZavorthWave4B3MessageSendDryRunExecutableFixture,
} from './ZavorthWave4B3MessageSendDryRunExecutable.js';
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
  ZavorthWave4B3MessageSendDryRunExecutableSelectionNormalization,
} from './ZavorthWave4B3MessageSendDryRunExecutableSelection.js';
import type {
  ZavorthWave4B3MessageSendDryRunReceipt,
} from './ZavorthWave4B3MessageSendDryRunExecutable.js';

export const ZAVORTH_WAVE4B3_TRANSPORT_TARGET_RESOLUTION_DRY_RUN_EXECUTE_FLAG = 'ZAVORTH_WAVE4B3_TRANSPORT_TARGET_RESOLUTION_DRY_RUN_EXECUTE' as const;
export const ZAVORTH_WAVE4B3_TRANSPORT_TARGET_RESOLUTION_DRY_RUN_NOW = '2026-05-01T04:00:00.000Z' as const;
export const ZAVORTH_WAVE4B3_TRANSPORT_TARGET_RESOLUTION_DRY_RUN_RUNTIME_ID = 'zavorth-wave4b3-transport-target-resolution-dry-run-executable' as const;

export type ZavorthWave4B3TransportTargetResolutionDecision =
  | 'channel-unavailable'
  | 'execution-blocked'
  | 'missing-secretref'
  | 'policy-rejected'
  | 'resolution-blocked'
  | 'resolution-degraded'
  | 'resolution-ok'
  | 'target-ambiguous'
  | 'target-missing'
  | 'transport-unconfigured';

export type ZavorthWave4B3TransportTargetResolutionStatus =
  | 'channel-resolved'
  | 'channel-unavailable'
  | 'feature-flag-disabled'
  | 'high-impact-execution-attempted'
  | 'idempotency-valid'
  | 'missing-secretref'
  | 'external-executor-touch-attempted'
  | 'policy-eligible'
  | 'policy-rejected'
  | 'raw-content-blocked'
  | 'scope-permission-metadata'
  | 'secretref-metadata-only'
  | 'send-capable-blocked'
  | 'source-not-ready'
  | 'target-ambiguous'
  | 'target-missing'
  | 'target-resolved'
  | 'thread-resolved'
  | 'thread-unavailable'
  | 'transport-degraded'
  | 'transport-resolved'
  | 'transport-unconfigured'
  | 'transport-unavailable'
  | 'valid';

export type ZavorthWave4B3TransportTargetResolutionFeatureFlagGate = {
  nativeContract: 'ZavorthWave4B3TransportTargetResolutionFeatureFlagGate/v1';
  flagName: typeof ZAVORTH_WAVE4B3_TRANSPORT_TARGET_RESOLUTION_DRY_RUN_EXECUTE_FLAG;
  enabled: boolean;
  safetyGate: 'controlled-production' | 'controlled-test';
  operatorAcknowledgedNoExternalTransport: boolean;
  transportTargetResolutionDryRunFeatureFlagRequired: true;
};

export type ZavorthWave4B3TransportTargetResolutionSource = {
  dryRunSelection: ZavorthWave4B3MessageSendDryRunExecutableSelectionNormalization;
  messageSendDryRunReceipt: ZavorthWave4B3MessageSendDryRunReceipt;
  sessionHistoryRegistry: ZavorthNativeSessionHistoryRegistry;
  integrationRegistry: ZavorthNativeIntegrationRegistry;
  realMessageTransportDiscoveryReady: true;
  wave4b2TargetSessionChannelValidationReady: true;
  wave4b2TransportReadinessReady: true;
  wave4cSessionMetadataMigrationReady: true;
  wave4c2RedactedContentMigrationReady: true;
  actionGovernancePipelineReady: true;
  nativeIntegrationRegistryReady: true;
  nativeSessionHistoryRegistryReady: true;
  migratedSessionChannelTransportMetadataReady: true;
  policyAllowsResolution: boolean;
  targetAliasCollisionDetected: boolean;
  runtimeExternalExecutorRequiredForExecution: false;
  externalExecutorTouched: false;
  realMessageSendAttempted: false;
  transportOpenAttempted: false;
  providerRealExecutionAttempted: false;
  toolCommandRealExecutionAttempted: false;
  externalExecutorMutationAttempted: false;
  rawContentUsageAttempted: false;
  newStateMigrationAttempted: false;
  rawSecretSerialized: false;
  sourceModuleCopyAttempted: false;
  adapterRemovalAttempted: false;
  publicExternalExecutorIdentityExposed: false;
};

export type ZavorthWave4B3TransportTargetResolutionTarget = {
  nativeContract: 'ZavorthWave4B3TransportTargetResolutionTarget/v1';
  targetAliasOrId: string;
  sessionRecordId: string;
  sessionAlias: string;
  threadRecordId: string;
  threadAlias: string;
  channelIntegrationId: string;
  channelType: string;
  transportIntegrationId: string;
  transportType: string;
  participantCount: number;
  messageMetadataCount: number;
  sourceIdentityPublic: false;
  rawParticipantIdsSerialized: false;
  rawMessageContentSerialized: false;
};

export type ZavorthWave4B3TransportTargetResolutionTransport = {
  nativeContract: 'ZavorthWave4B3TransportTargetResolutionTransport/v1';
  id: string;
  type: string;
  status: ZavorthNativeIntegrationRecord['status'] | 'missing';
  classification: ZavorthNativeIntegrationRecord['classification'] | 'missing';
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
  sendCapableStatus: 'not-send-capable' | 'send-capable-but-blocked' | 'unknown';
  requiredSecretRefs: ZavorthNativeIntegrationSecretRefMetadata[];
  secretRefsMetadataOnly: boolean;
  sourceIdentityPublic: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4B3TransportTargetResolutionPlan = {
  nativeContract: 'ZavorthWave4B3TransportTargetResolutionPlan/v1';
  planId: string;
  mode: 'dry-run-resolution-only';
  action: 'transport-target-resolution-dry-run';
  target: ZavorthWave4B3TransportTargetResolutionTarget;
  transport: ZavorthWave4B3TransportTargetResolutionTransport;
  channel: {
    id: string;
    type: string;
    status: ZavorthNativeIntegrationRecord['status'] | 'missing';
    classification: ZavorthNativeIntegrationRecord['classification'] | 'missing';
  };
  externalTransportInvoked: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  rawContentUsed: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4B3TransportTargetResolutionPolicyPreflight = {
  nativeContract: 'ZavorthWave4B3TransportTargetResolutionPolicyPreflight/v1';
  policyPreflightRequired: true;
  policyRecheckedImmediatelyBeforeExecution: true;
  approvalRequiredForDryRun: false;
  approvalRequiredBeforeFutureTransportOpen: true;
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
  rawContentBlocked: true;
};

export type ZavorthWave4B3TransportTargetResolutionDetail = {
  nativeContract: 'ZavorthWave4B3TransportTargetResolutionDetail/v1';
  validation:
    | 'channel-resolution'
    | 'feature-flag'
    | 'high-impact-block'
    | 'idempotency'
    | 'metadata-source'
    | 'external-executor-isolation'
    | 'policy-preflight'
    | 'scope-permission-metadata'
    | 'secretref-metadata'
    | 'send-capable-block'
    | 'session-target'
    | 'thread-target'
    | 'transport-resolution';
  status: 'blocked' | 'failed' | 'passed';
  reason: string;
};

export type ZavorthWave4B3TransportTargetResolutionCleanupReceipt = {
  nativeContract: 'ZavorthWave4B3TransportTargetResolutionCleanupReceipt/v1';
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

export type ZavorthWave4B3TransportTargetResolutionReceipt = {
  nativeContract: 'ZavorthWave4B3TransportTargetResolutionDryRunReceipt/v1';
  runtimeId: typeof ZAVORTH_WAVE4B3_TRANSPORT_TARGET_RESOLUTION_DRY_RUN_RUNTIME_ID;
  generatedAt: string;
  selectedDryRunCapability: 'transport-target-resolution-dry-run';
  decision: ZavorthWave4B3TransportTargetResolutionDecision;
  classification: ZavorthWave4B3TransportTargetResolutionDecision;
  validations: ZavorthWave4B3TransportTargetResolutionStatus[];
  validationDetails: ZavorthWave4B3TransportTargetResolutionDetail[];
  featureFlag: ZavorthWave4B3TransportTargetResolutionFeatureFlagGate;
  idempotencyKey: string;
  resolutionPlan: ZavorthWave4B3TransportTargetResolutionPlan;
  policyPreflight: ZavorthWave4B3TransportTargetResolutionPolicyPreflight;
  requiredSecretRefs: ZavorthNativeIntegrationSecretRefMetadata[];
  sourceMetadata: {
    selectionRuntimeId: typeof ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLE_SELECTION_RUNTIME_ID;
    messageSendDryRunDecision: ZavorthWave4B3MessageSendDryRunReceipt['decision'];
    sessionRegistryRecordCount: number;
    threadRegistryRecordCount: number;
    integrationRegistryRecordCount: number;
    migratedSessionChannelTransportMetadataUsed: true;
    nativeSessionHistoryRegistryUsed: true;
    nativeIntegrationRegistryUsed: true;
    transportDiscoveryMetadataUsed: true;
    sourceProvenanceInternalRedacted: true;
  };
  cleanupReceipt: ZavorthWave4B3TransportTargetResolutionCleanupReceipt;
  wave4b3TransportTargetResolutionDryRunCreated: true;
  transportTargetResolutionDryRunActuallyExecuted: boolean;
  transportTargetResolutionDryRunActuallyExecutedOnlyWhenFlagEnabled: true;
  realMessageSendAllowed: false;
  transportActuallyOpened: false;
  providerRealExecutionAllowed: false;
  toolCommandRealExecutionAllowed: false;
  externalExecutorMutationAllowed: false;
  rawContentUsageAllowed: false;
  runtimeExternalExecutorRequiredForExecution: false;
  rawSecretSerialized: false;
  sourceModuleCopied: false;
  adapterRemovalGlobalAllowed: false;
  externalExecutorTouched: false;
};

export type ZavorthWave4B3TransportTargetResolutionOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4B3_TRANSPORT_TARGET_RESOLUTION_DRY_RUN_RUNTIME_ID;
  source: ZavorthWave4B3TransportTargetResolutionSource;
  featureFlag: ZavorthWave4B3TransportTargetResolutionFeatureFlagGate;
  targetSessionId?: string;
  targetSessionAlias?: string;
  targetThreadId?: string;
  targetChannelIntegrationId?: string;
  targetTransportIntegrationId?: string;
};

function firstSession(source: ZavorthWave4B3TransportTargetResolutionSource): ZavorthNativeSessionMetadataRecord | undefined {
  return source.sessionHistoryRegistry.listSessions({ hasMessages: true })[0] ?? source.sessionHistoryRegistry.listSessions()[0];
}

function findSession(
  source: ZavorthWave4B3TransportTargetResolutionSource,
  sessionId?: string,
  sessionAlias?: string,
): ZavorthNativeSessionMetadataRecord | undefined {
  if (sessionId) {
    return source.sessionHistoryRegistry.lookupSession(sessionId).record;
  }
  if (sessionAlias) {
    return source.sessionHistoryRegistry.listSessions().find((session) => session.publicSessionAlias === sessionAlias);
  }
  return firstSession(source);
}

function findThread(
  source: ZavorthWave4B3TransportTargetResolutionSource,
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
  source: ZavorthWave4B3TransportTargetResolutionSource,
  integrationId: string | undefined,
): ZavorthNativeIntegrationRecord | undefined {
  return integrationId ? source.integrationRegistry.lookup(integrationId).record : undefined;
}

function chooseChannel(
  source: ZavorthWave4B3TransportTargetResolutionSource,
  session: ZavorthNativeSessionMetadataRecord | undefined,
  channelId?: string,
): ZavorthNativeIntegrationRecord | undefined {
  return lookupIntegration(source, channelId ?? session?.channelIntegrationIds[0]);
}

function chooseTransport(
  source: ZavorthWave4B3TransportTargetResolutionSource,
  session: ZavorthNativeSessionMetadataRecord | undefined,
  transportId?: string,
): ZavorthNativeIntegrationRecord | undefined {
  const selectedTransportId = transportId ?? session?.transportIntegrationIds
    .map((id) => source.integrationRegistry.lookup(id).record)
    .find((record): record is ZavorthNativeIntegrationRecord => record !== undefined && record.supportsSend && record.sendPolicy === 'blocked')
    ?.id ?? source.integrationRegistry.list({ integrationKind: 'message-transport', supportsSend: true })
      .find((record) => record.sendPolicy === 'blocked')?.id ?? session?.transportIntegrationIds[0];
  return lookupIntegration(source, selectedTransportId);
}

function unique<TValue>(values: TValue[]): TValue[] {
  return Array.from(new Set(values));
}

function sourceStatuses(source: ZavorthWave4B3TransportTargetResolutionSource): ZavorthWave4B3TransportTargetResolutionStatus[] {
  const statuses: ZavorthWave4B3TransportTargetResolutionStatus[] = [];

  if (
    source.dryRunSelection.decision !== 'wave4b3-message-send-dry-run-executable-selection-ready' ||
    source.messageSendDryRunReceipt.selectedDryRunCapability !== 'message-send-dry-run-action' ||
    !source.realMessageTransportDiscoveryReady ||
    !source.wave4b2TargetSessionChannelValidationReady ||
    !source.wave4b2TransportReadinessReady ||
    !source.wave4cSessionMetadataMigrationReady ||
    !source.wave4c2RedactedContentMigrationReady ||
    !source.actionGovernancePipelineReady ||
    !source.nativeIntegrationRegistryReady ||
    !source.nativeSessionHistoryRegistryReady ||
    !source.migratedSessionChannelTransportMetadataReady ||
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
  if (source.rawContentUsageAttempted) {
    statuses.push('raw-content-blocked');
  }
  if (source.newStateMigrationAttempted || source.sourceModuleCopyAttempted || source.adapterRemovalAttempted) {
    statuses.push('source-not-ready');
  }
  if (!source.policyAllowsResolution) {
    statuses.push('policy-rejected');
  }
  if (source.targetAliasCollisionDetected) {
    statuses.push('target-ambiguous');
  }

  return statuses;
}

function targetRecord(input: {
  aliasOrId: string;
  channel: ZavorthNativeIntegrationRecord | undefined;
  session: ZavorthNativeSessionMetadataRecord | undefined;
  thread: ZavorthNativeThreadMetadataRecord | undefined;
  transport: ZavorthNativeIntegrationRecord | undefined;
}): ZavorthWave4B3TransportTargetResolutionTarget {
  return {
    nativeContract: 'ZavorthWave4B3TransportTargetResolutionTarget/v1',
    targetAliasOrId: input.aliasOrId,
    sessionRecordId: input.session?.id ?? 'missing-session',
    sessionAlias: input.session?.publicSessionAlias ?? 'missing-session-alias',
    threadRecordId: input.thread?.id ?? 'missing-thread',
    threadAlias: input.thread?.publicThreadAlias ?? 'missing-thread-alias',
    channelIntegrationId: input.channel?.id ?? 'missing-channel',
    channelType: input.channel?.integrationType ?? 'missing-channel-type',
    transportIntegrationId: input.transport?.id ?? 'missing-transport',
    transportType: input.transport?.integrationType ?? 'missing-transport-type',
    participantCount: input.session?.participantMetadata.participantCount ?? 0,
    messageMetadataCount: input.thread?.messageMetadataRecordIds.length ?? 0,
    sourceIdentityPublic: false,
    rawParticipantIdsSerialized: false,
    rawMessageContentSerialized: false,
  };
}

function transportRecord(transport: ZavorthNativeIntegrationRecord | undefined): ZavorthWave4B3TransportTargetResolutionTransport {
  return {
    nativeContract: 'ZavorthWave4B3TransportTargetResolutionTransport/v1',
    id: transport?.id ?? 'missing-transport',
    type: transport?.integrationType ?? 'missing-transport-type',
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
    sendCapableStatus: transport?.supportsSend && transport.sendPolicy === 'blocked' ? 'send-capable-but-blocked' : transport ? 'not-send-capable' : 'unknown',
    requiredSecretRefs: transport?.requiredSecretRefs ?? [],
    secretRefsMetadataOnly: (transport?.requiredSecretRefs ?? []).length > 0 &&
      (transport?.requiredSecretRefs ?? []).every((secretRef) => !secretRef.rawValueSerialized),
    sourceIdentityPublic: false,
    rawSecretSerialized: false,
  };
}

function resolutionStatuses(input: {
  channel: ZavorthNativeIntegrationRecord | undefined;
  featureFlag: ZavorthWave4B3TransportTargetResolutionFeatureFlagGate;
  session: ZavorthNativeSessionMetadataRecord | undefined;
  source: ZavorthWave4B3TransportTargetResolutionSource;
  thread: ZavorthNativeThreadMetadataRecord | undefined;
  transport: ZavorthNativeIntegrationRecord | undefined;
}): ZavorthWave4B3TransportTargetResolutionStatus[] {
  const result = sourceStatuses(input.source);

  if (!input.featureFlag.enabled) {
    result.push('feature-flag-disabled');
  }
  if (!input.session) {
    result.push('target-missing');
  } else {
    result.push('target-resolved');
  }
  if (!input.thread || !input.session || input.thread.sessionRecordId !== input.session.id) {
    result.push('thread-unavailable');
  } else {
    result.push('thread-resolved');
  }
  if (!input.channel || input.channel.integrationKind !== 'channel') {
    result.push('channel-unavailable');
  } else {
    result.push('channel-resolved');
  }
  if (!input.transport || input.transport.integrationKind !== 'message-transport') {
    result.push('transport-unavailable');
  } else {
    result.push('transport-resolved');
    if (!input.transport.configured) {
      result.push('transport-unconfigured');
    }
    if (input.transport.status === 'degraded' || input.transport.status === 'unavailable' || input.transport.status === 'unknown') {
      result.push('transport-degraded');
    }
    if (input.transport.supportsSend && input.transport.sendPolicy === 'blocked') {
      result.push('send-capable-blocked');
    }
    if (input.transport.requiredSecretRefs.length === 0 && input.transport.supportsSend) {
      result.push('missing-secretref');
    } else if (input.transport.requiredSecretRefs.every((secretRef) => !secretRef.rawValueSerialized)) {
      result.push('secretref-metadata-only');
    }
    if (input.transport.requiredScopes.length > 0 && input.transport.requiredPermissions.length > 0) {
      result.push('scope-permission-metadata');
    }
  }
  if (input.source.policyAllowsResolution) {
    result.push('policy-eligible');
  }
  result.push('idempotency-valid');

  if (
    result.includes('target-resolved') &&
    result.includes('thread-resolved') &&
    result.includes('channel-resolved') &&
    result.includes('transport-resolved') &&
    result.includes('send-capable-blocked') &&
    result.includes('secretref-metadata-only') &&
    result.includes('scope-permission-metadata') &&
    result.includes('policy-eligible') &&
    !result.includes('target-ambiguous') &&
    !result.includes('transport-unconfigured') &&
    !result.includes('transport-degraded')
  ) {
    result.push('valid');
  }

  return unique(result);
}

function decision(statuses: ZavorthWave4B3TransportTargetResolutionStatus[]): ZavorthWave4B3TransportTargetResolutionDecision {
  if (statuses.includes('feature-flag-disabled')) {
    return 'execution-blocked';
  }
  if (statuses.includes('source-not-ready') || statuses.includes('external-executor-touch-attempted') || statuses.includes('high-impact-execution-attempted') || statuses.includes('raw-content-blocked')) {
    return 'resolution-blocked';
  }
  if (statuses.includes('policy-rejected')) {
    return 'policy-rejected';
  }
  if (statuses.includes('target-ambiguous')) {
    return 'target-ambiguous';
  }
  if (statuses.includes('target-missing') || statuses.includes('thread-unavailable')) {
    return 'target-missing';
  }
  if (statuses.includes('channel-unavailable')) {
    return 'channel-unavailable';
  }
  if (statuses.includes('missing-secretref')) {
    return 'missing-secretref';
  }
  if (statuses.includes('transport-unavailable')) {
    return 'transport-unconfigured';
  }
  if (statuses.includes('transport-unconfigured') || statuses.includes('transport-degraded')) {
    return 'resolution-degraded';
  }
  return statuses.includes('valid') ? 'resolution-ok' : 'resolution-degraded';
}

function detail(
  validation: ZavorthWave4B3TransportTargetResolutionDetail['validation'],
  status: ZavorthWave4B3TransportTargetResolutionDetail['status'],
  reason: string,
): ZavorthWave4B3TransportTargetResolutionDetail {
  return {
    nativeContract: 'ZavorthWave4B3TransportTargetResolutionDetail/v1',
    validation,
    status,
    reason,
  };
}

function validationDetails(statuses: ZavorthWave4B3TransportTargetResolutionStatus[]): ZavorthWave4B3TransportTargetResolutionDetail[] {
  return [
    detail('feature-flag', statuses.includes('feature-flag-disabled') ? 'blocked' : 'passed', statuses.includes('feature-flag-disabled')
      ? 'The required transport target resolution feature flag is disabled.'
      : 'The transport target resolution feature flag is enabled for controlled tests.'),
    detail('metadata-source', statuses.includes('source-not-ready') ? 'failed' : 'passed', statuses.includes('source-not-ready')
      ? 'Native/migrated metadata sources are not ready or attempted out-of-scope work.'
      : 'Native session/history and integration metadata are the resolution source.'),
    detail('session-target', statuses.includes('target-ambiguous') || statuses.includes('target-missing') ? 'failed' : 'passed', statuses.includes('target-ambiguous')
      ? 'Target alias resolves ambiguously and is rejected.'
      : statuses.includes('target-missing')
        ? 'Target session is missing.'
        : 'Target session resolves from metadata.'),
    detail('thread-target', statuses.includes('thread-unavailable') ? 'failed' : 'passed', statuses.includes('thread-unavailable')
      ? 'Thread metadata is unavailable for the target.'
      : 'Thread metadata resolves from metadata.'),
    detail('channel-resolution', statuses.includes('channel-unavailable') ? 'failed' : 'passed', statuses.includes('channel-unavailable')
      ? 'Channel metadata is unavailable.'
      : 'Channel metadata resolves from native integration metadata.'),
    detail('transport-resolution', statuses.includes('transport-unavailable') || statuses.includes('transport-unconfigured') ? 'failed' : 'passed', statuses.includes('transport-unconfigured')
      ? 'Transport metadata exists but is unconfigured.'
      : statuses.includes('transport-unavailable')
        ? 'Transport metadata is unavailable.'
        : 'Transport metadata resolves from native integration metadata.'),
    detail('secretref-metadata', statuses.includes('missing-secretref') ? 'failed' : 'passed', statuses.includes('missing-secretref')
      ? 'Send-capable transport has no SecretRef metadata.'
      : 'Required credentials are represented only as SecretRef metadata.'),
    detail('scope-permission-metadata', statuses.includes('scope-permission-metadata') ? 'passed' : 'blocked', statuses.includes('scope-permission-metadata')
      ? 'Scopes and permissions are represented as metadata only.'
      : 'Scopes or permissions are missing.'),
    detail('send-capable-block', statuses.includes('send-capable-blocked') ? 'passed' : 'blocked', statuses.includes('send-capable-blocked')
      ? 'Send-capable transport remains blocked for live transport.'
      : 'No blocked send-capable transport was selected.'),
    detail('policy-preflight', statuses.includes('policy-rejected') ? 'blocked' : 'passed', statuses.includes('policy-rejected')
      ? 'Zavorth policy rejected target resolution.'
      : 'Zavorth policy preflight/recheck allows dry-run resolution only.'),
    detail('external-executor-isolation', statuses.includes('external-executor-touch-attempted') ? 'failed' : 'passed', statuses.includes('external-executor-touch-attempted')
      ? 'The executable attempted to touch ExternalExecutor, which is forbidden.'
      : 'The executable does not touch ExternalExecutor.'),
    detail('high-impact-block', statuses.includes('high-impact-execution-attempted') ? 'failed' : 'passed', statuses.includes('high-impact-execution-attempted')
      ? 'A real send/provider/tool/transport operation was attempted.'
      : 'Real send, provider/tool/command execution, and transport opening remain blocked.'),
    detail('idempotency', statuses.includes('idempotency-valid') ? 'passed' : 'failed', statuses.includes('idempotency-valid')
      ? 'A deterministic idempotency key is generated.'
      : 'Idempotency metadata is missing.'),
  ];
}

function policyPreflight(target: ZavorthWave4B3TransportTargetResolutionTarget): ZavorthWave4B3TransportTargetResolutionPolicyPreflight {
  return {
    nativeContract: 'ZavorthWave4B3TransportTargetResolutionPolicyPreflight/v1',
    policyPreflightRequired: true,
    policyRecheckedImmediatelyBeforeExecution: true,
    approvalRequiredForDryRun: false,
    approvalRequiredBeforeFutureTransportOpen: true,
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
    rawContentBlocked: true,
  };
}

function idempotencyKey(target: ZavorthWave4B3TransportTargetResolutionTarget, transport: ZavorthWave4B3TransportTargetResolutionTransport): string {
  return [
    'zavorth-wave4b3-transport-target-resolution-dry-run',
    target.sessionRecordId,
    target.threadRecordId,
    target.channelIntegrationId,
    target.transportIntegrationId,
    transport.status,
    transport.classification,
  ].join(':');
}

function resolutionPlan(input: {
  channel: ZavorthNativeIntegrationRecord | undefined;
  idempotencyKey: string;
  target: ZavorthWave4B3TransportTargetResolutionTarget;
  transport: ZavorthWave4B3TransportTargetResolutionTransport;
}): ZavorthWave4B3TransportTargetResolutionPlan {
  return {
    nativeContract: 'ZavorthWave4B3TransportTargetResolutionPlan/v1',
    planId: input.idempotencyKey,
    mode: 'dry-run-resolution-only',
    action: 'transport-target-resolution-dry-run',
    target: input.target,
    transport: input.transport,
    channel: {
      id: input.channel?.id ?? 'missing-channel',
      type: input.channel?.integrationType ?? 'missing-channel-type',
      status: input.channel?.status ?? 'missing',
      classification: input.channel?.classification ?? 'missing',
    },
    externalTransportInvoked: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    rawContentUsed: false,
    rawSecretSerialized: false,
  };
}

function cleanupReceipt(): ZavorthWave4B3TransportTargetResolutionCleanupReceipt {
  return {
    nativeContract: 'ZavorthWave4B3TransportTargetResolutionCleanupReceipt/v1',
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

export class ZavorthWave4B3TransportTargetResolutionDryRunExecutable {
  public constructor(public readonly receipt: ZavorthWave4B3TransportTargetResolutionReceipt) {}

  public resolutionSucceeded(): boolean {
    return this.receipt.decision === 'resolution-ok' || this.receipt.decision === 'resolution-degraded';
  }

  public transportStillBlocked(): boolean {
    return this.receipt.transportActuallyOpened === false &&
      this.receipt.realMessageSendAllowed === false &&
      this.receipt.policyPreflight.externalTransportBlocked;
  }

  public isIdempotentWith(other: ZavorthWave4B3TransportTargetResolutionDryRunExecutable): boolean {
    return this.receipt.idempotencyKey === other.receipt.idempotencyKey &&
      this.receipt.decision === other.receipt.decision;
  }
}

export function createZavorthWave4B3TransportTargetResolutionFeatureFlagGate(
  enabled: boolean,
): ZavorthWave4B3TransportTargetResolutionFeatureFlagGate {
  return {
    nativeContract: 'ZavorthWave4B3TransportTargetResolutionFeatureFlagGate/v1',
    flagName: ZAVORTH_WAVE4B3_TRANSPORT_TARGET_RESOLUTION_DRY_RUN_EXECUTE_FLAG,
    enabled,
    safetyGate: 'controlled-test',
    operatorAcknowledgedNoExternalTransport: true,
    transportTargetResolutionDryRunFeatureFlagRequired: true,
  };
}

export function createZavorthWave4B3TransportTargetResolutionSource(
  overrides: Partial<Omit<
    ZavorthWave4B3TransportTargetResolutionSource,
    'dryRunSelection' | 'integrationRegistry' | 'messageSendDryRunReceipt' | 'sessionHistoryRegistry'
  >> & {
    dryRunSelection?: ZavorthWave4B3MessageSendDryRunExecutableSelectionNormalization;
    integrationRegistry?: ZavorthNativeIntegrationRegistry;
    messageSendDryRunReceipt?: ZavorthWave4B3MessageSendDryRunReceipt;
    sessionHistoryRegistry?: ZavorthNativeSessionHistoryRegistry;
  } = {},
): ZavorthWave4B3TransportTargetResolutionSource {
  return {
    dryRunSelection: normalizeZavorthWave4B3MessageSendDryRunExecutableSelectionFixture(),
    messageSendDryRunReceipt: createZavorthWave4B3MessageSendDryRunExecutableFixture().receipt,
    sessionHistoryRegistry: createZavorthNativeSessionHistoryRegistryFixture(),
    integrationRegistry: createZavorthNativeIntegrationRegistryFixture(),
    realMessageTransportDiscoveryReady: true,
    wave4b2TargetSessionChannelValidationReady: true,
    wave4b2TransportReadinessReady: true,
    wave4cSessionMetadataMigrationReady: true,
    wave4c2RedactedContentMigrationReady: true,
    actionGovernancePipelineReady: true,
    nativeIntegrationRegistryReady: true,
    nativeSessionHistoryRegistryReady: true,
    migratedSessionChannelTransportMetadataReady: true,
    policyAllowsResolution: true,
    targetAliasCollisionDetected: false,
    runtimeExternalExecutorRequiredForExecution: false,
    externalExecutorTouched: false,
    realMessageSendAttempted: false,
    transportOpenAttempted: false,
    providerRealExecutionAttempted: false,
    toolCommandRealExecutionAttempted: false,
    externalExecutorMutationAttempted: false,
    rawContentUsageAttempted: false,
    newStateMigrationAttempted: false,
    rawSecretSerialized: false,
    sourceModuleCopyAttempted: false,
    adapterRemovalAttempted: false,
    publicExternalExecutorIdentityExposed: false,
    ...overrides,
  };
}

export function normalizeZavorthWave4B3TransportTargetResolutionDryRunExecutable(
  options: ZavorthWave4B3TransportTargetResolutionOptions,
): ZavorthWave4B3TransportTargetResolutionReceipt {
  const session = findSession(options.source, options.targetSessionId, options.targetSessionAlias);
  const thread = findThread(options.source, session, options.targetThreadId);
  const channel = chooseChannel(options.source, session, options.targetChannelIntegrationId);
  const transport = chooseTransport(options.source, session, options.targetTransportIntegrationId);
  const target = targetRecord({
    aliasOrId: options.targetSessionId ?? options.targetSessionAlias ?? session?.publicSessionAlias ?? 'default-target',
    channel,
    session,
    thread,
    transport,
  });
  const transportTarget = transportRecord(transport);
  const key = idempotencyKey(target, transportTarget);
  const plan = resolutionPlan({ channel, idempotencyKey: key, target, transport: transportTarget });
  const resolutionValidationStatuses = resolutionStatuses({
    channel,
    featureFlag: options.featureFlag,
    session,
    source: options.source,
    thread,
    transport,
  });
  const gateDecision = decision(resolutionValidationStatuses);

  return {
    nativeContract: 'ZavorthWave4B3TransportTargetResolutionDryRunReceipt/v1',
    runtimeId: options.runtimeId,
    generatedAt: options.generatedAt,
    selectedDryRunCapability: 'transport-target-resolution-dry-run',
    decision: gateDecision,
    classification: gateDecision,
    validations: resolutionValidationStatuses,
    validationDetails: validationDetails(resolutionValidationStatuses),
    featureFlag: options.featureFlag,
    idempotencyKey: key,
    resolutionPlan: plan,
    policyPreflight: policyPreflight(target),
    requiredSecretRefs: transport?.requiredSecretRefs ?? [],
    sourceMetadata: {
      selectionRuntimeId: ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLE_SELECTION_RUNTIME_ID,
      messageSendDryRunDecision: options.source.messageSendDryRunReceipt.decision,
      sessionRegistryRecordCount: options.source.sessionHistoryRegistry.snapshot.sessions.length,
      threadRegistryRecordCount: options.source.sessionHistoryRegistry.snapshot.threads.length,
      integrationRegistryRecordCount: options.source.integrationRegistry.snapshot.records.length,
      migratedSessionChannelTransportMetadataUsed: true,
      nativeSessionHistoryRegistryUsed: true,
      nativeIntegrationRegistryUsed: true,
      transportDiscoveryMetadataUsed: true,
      sourceProvenanceInternalRedacted: true,
    },
    cleanupReceipt: cleanupReceipt(),
    wave4b3TransportTargetResolutionDryRunCreated: true,
    transportTargetResolutionDryRunActuallyExecuted: options.featureFlag.enabled,
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
  };
}

export function createZavorthWave4B3TransportTargetResolutionDryRunExecutableFixture(
  overrides: {
    featureFlagEnabled?: boolean;
    generatedAt?: string;
    source?: Partial<Parameters<typeof createZavorthWave4B3TransportTargetResolutionSource>[0]>;
    targetChannelIntegrationId?: string;
    targetSessionAlias?: string;
    targetSessionId?: string;
    targetThreadId?: string;
    targetTransportIntegrationId?: string;
  } = {},
): ZavorthWave4B3TransportTargetResolutionDryRunExecutable {
  const source = createZavorthWave4B3TransportTargetResolutionSource(overrides.source);
  const receipt = normalizeZavorthWave4B3TransportTargetResolutionDryRunExecutable({
    generatedAt: overrides.generatedAt ?? ZAVORTH_WAVE4B3_TRANSPORT_TARGET_RESOLUTION_DRY_RUN_NOW,
    runtimeId: ZAVORTH_WAVE4B3_TRANSPORT_TARGET_RESOLUTION_DRY_RUN_RUNTIME_ID,
    source,
    featureFlag: createZavorthWave4B3TransportTargetResolutionFeatureFlagGate(overrides.featureFlagEnabled ?? true),
    targetSessionId: overrides.targetSessionId,
    targetSessionAlias: overrides.targetSessionAlias,
    targetThreadId: overrides.targetThreadId,
    targetChannelIntegrationId: overrides.targetChannelIntegrationId,
    targetTransportIntegrationId: overrides.targetTransportIntegrationId,
  });

  return new ZavorthWave4B3TransportTargetResolutionDryRunExecutable(receipt);
}
