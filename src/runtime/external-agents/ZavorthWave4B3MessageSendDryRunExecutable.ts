import {
  ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTE_FLAG,
  normalizeZavorthWave4B3MessageSendDryRunExecutableSelectionFixture,
} from './ZavorthWave4B3MessageSendDryRunExecutableSelection.js';
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
  ZavorthNativeMessageMetadataRecord,
  ZavorthNativeSessionHistoryRegistry,
  ZavorthNativeSessionMetadataRecord,
  ZavorthNativeThreadMetadataRecord,
} from './ZavorthNativeSessionHistoryRegistry.js';
import type {
  ZavorthWave4B3MessageSendDryRunExecutableSelectionNormalization,
} from './ZavorthWave4B3MessageSendDryRunExecutableSelection.js';
import type {
  ZavorthWave4C2RedactedContentPayload,
} from './ZavorthWave4C2FirstRedactedSessionContentMigrationBatch.js';
import type {
  ZavorthWave4C2RedactedContentNativeView,
} from './ZavorthWave4C2RedactedSessionContentLoadVerifyParity.js';

export const ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLE_NOW = '2026-05-01T03:00:00.000Z' as const;
export const ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLE_RUNTIME_ID = 'zavorth-wave4b3-message-send-dry-run-executable' as const;

export type ZavorthWave4B3MessageSendDryRunDecision =
  | 'dry-run-blocked'
  | 'dry-run-degraded'
  | 'dry-run-ok'
  | 'execution-blocked'
  | 'policy-rejected'
  | 'raw-content-rejected'
  | 'target-unavailable'
  | 'transport-unconfigured';

export type ZavorthWave4B3MessageSendDryRunStatus =
  | 'approval-metadata-recorded'
  | 'channel-resolved'
  | 'channel-unavailable'
  | 'derived-content-accepted'
  | 'feature-flag-disabled'
  | 'high-impact-execution-attempted'
  | 'idempotency-valid'
  | 'external-executor-touch-attempted'
  | 'policy-eligible'
  | 'policy-rejected'
  | 'raw-content-rejected'
  | 'redacted-content-accepted'
  | 'secretref-metadata-only'
  | 'send-capable-blocked'
  | 'source-not-ready'
  | 'target-resolved'
  | 'target-unavailable'
  | 'thread-resolved'
  | 'thread-unavailable'
  | 'transport-degraded'
  | 'transport-resolved'
  | 'transport-unconfigured'
  | 'transport-unavailable'
  | 'valid';

export type ZavorthWave4B3MessageSendDryRunFeatureFlagGate = {
  nativeContract: 'ZavorthWave4B3MessageSendDryRunFeatureFlagGate/v1';
  flagName: typeof ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTE_FLAG;
  enabled: boolean;
  safetyGate: 'controlled-production' | 'controlled-test';
  operatorAcknowledgedNoExternalTransport: boolean;
  messageSendDryRunFeatureFlagRequired: true;
};

export type ZavorthWave4B3MessageSendDryRunSource = {
  dryRunSelection: ZavorthWave4B3MessageSendDryRunExecutableSelectionNormalization;
  sessionHistoryRegistry: ZavorthNativeSessionHistoryRegistry;
  integrationRegistry: ZavorthNativeIntegrationRegistry;
  redactedContentViews: ZavorthWave4C2RedactedContentNativeView[];
  messageSendTransportBlockedRehearsalReady: true;
  realMessageTransportDiscoveryReady: true;
  wave4b2MediumRiskExecutablesReady: true;
  wave4c2RedactedContentMigrationReady: true;
  actionGovernancePipelineReady: true;
  nativeIntegrationRegistryReady: true;
  nativeSessionHistoryRegistryReady: true;
  migratedSessionChannelTransportMetadataReady: true;
  redactedDerivedContentReady: true;
  policyAllowsDryRun: boolean;
  approvalMetadataRequired: boolean;
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

export type ZavorthWave4B3MessageSendDryRunTarget = {
  nativeContract: 'ZavorthWave4B3MessageSendDryRunTarget/v1';
  sessionRecordId: string;
  sessionAlias: string;
  threadRecordId: string;
  threadAlias: string;
  channelIntegrationId: string;
  channelType: string;
  transportIntegrationId: string;
  transportType: string;
  targetMessageMetadataIds: string[];
  participantCount: number;
  participantKinds: ZavorthNativeSessionMetadataRecord['participantMetadata']['participantKinds'];
  sendCapableStatus: 'not-send-capable' | 'send-capable-but-blocked' | 'unknown';
  transportConfigured: boolean;
  transportSupportsDryRun: boolean;
  sourceIdentityPublic: false;
  rawParticipantIdsSerialized: false;
  rawMessageContentSerialized: false;
};

export type ZavorthWave4B3MessageSendDryRunContentEnvelope = {
  nativeContract: 'ZavorthWave4B3MessageSendDryRunContentEnvelope/v1';
  viewIds: string[];
  contentHashes: string[];
  contentLengthBuckets: string[];
  redactedExcerpts: Array<'[redacted-content]' | '[unavailable]'>;
  sensitivityClassifications: string[];
  messageMetadataIds: string[];
  redactedDerivedContentUsed: true;
  rawContentUsed: false;
  rawMessageContentSerialized: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4B3MessageSendDryRunPlan = {
  nativeContract: 'ZavorthWave4B3MessageSendDryRunPlan/v1';
  planId: string;
  mode: 'dry-run-only';
  action: 'message-send-dry-run-action';
  target: ZavorthWave4B3MessageSendDryRunTarget;
  content: ZavorthWave4B3MessageSendDryRunContentEnvelope;
  requiredSecretRefs: ZavorthNativeIntegrationSecretRefMetadata[];
  sendCapableButBlocked: boolean;
  transportLiveBlocked: true;
  externalTransportInvoked: false;
  messageActuallySent: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  externalExecutorTouched: false;
  rawSecretSerialized: false;
};

export type ZavorthWave4B3MessageSendDryRunPolicyPreflight = {
  nativeContract: 'ZavorthWave4B3MessageSendDryRunPolicyPreflight/v1';
  policyPreflightRequired: true;
  policyRecheckedImmediatelyBeforeExecution: true;
  approvalRequiredForDryRun: false;
  approvalRequiredBeforeFutureLiveSend: true;
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

export type ZavorthWave4B3MessageSendDryRunApprovalMetadata = {
  nativeContract: 'ZavorthWave4B3MessageSendDryRunApprovalMetadata/v1';
  approvalMetadataRequired: boolean;
  approvalActuallyGranted: false;
  approvalGrantRequiredBeforeLiveSend: true;
  approverIdentitySerialized: false;
  exactScopeRequired: true;
  ttlRequired: true;
  idempotencyKeyRequired: true;
};

export type ZavorthWave4B3MessageSendDryRunDetail = {
  nativeContract: 'ZavorthWave4B3MessageSendDryRunDetail/v1';
  validation:
    | 'approval-metadata'
    | 'content-redaction'
    | 'feature-flag'
    | 'high-impact-block'
    | 'idempotency'
    | 'metadata-source'
    | 'external-executor-isolation'
    | 'policy-preflight'
    | 'secretref-metadata'
    | 'send-capable-block'
    | 'session-target'
    | 'thread-target'
    | 'transport-target';
  status: 'blocked' | 'failed' | 'passed';
  reason: string;
};

export type ZavorthWave4B3MessageSendDryRunCleanupReceipt = {
  nativeContract: 'ZavorthWave4B3MessageSendDryRunCleanupReceipt/v1';
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

export type ZavorthWave4B3MessageSendDryRunReceipt = {
  nativeContract: 'ZavorthWave4B3MessageSendDryRunActionReceipt/v1';
  runtimeId: typeof ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLE_RUNTIME_ID;
  generatedAt: string;
  selectedDryRunCapability: 'message-send-dry-run-action';
  decision: ZavorthWave4B3MessageSendDryRunDecision;
  classification: ZavorthWave4B3MessageSendDryRunDecision;
  validations: ZavorthWave4B3MessageSendDryRunStatus[];
  validationDetails: ZavorthWave4B3MessageSendDryRunDetail[];
  featureFlag: ZavorthWave4B3MessageSendDryRunFeatureFlagGate;
  idempotencyKey: string;
  dryRunPlan: ZavorthWave4B3MessageSendDryRunPlan;
  policyPreflight: ZavorthWave4B3MessageSendDryRunPolicyPreflight;
  approvalMetadata: ZavorthWave4B3MessageSendDryRunApprovalMetadata;
  requiredSecretRefs: ZavorthNativeIntegrationSecretRefMetadata[];
  sourceMetadata: {
    sessionRegistryRecordCount: number;
    threadRegistryRecordCount: number;
    messageRegistryRecordCount: number;
    integrationRegistryRecordCount: number;
    redactedContentViewCount: number;
    migratedSessionChannelTransportMetadataUsed: true;
    redactedDerivedContentUsed: true;
    nativeSessionHistoryRegistryUsed: true;
    nativeIntegrationRegistryUsed: true;
    sourceProvenanceInternalRedacted: true;
  };
  cleanupReceipt: ZavorthWave4B3MessageSendDryRunCleanupReceipt;
  wave4b3MessageSendDryRunExecutableCreated: true;
  messageSendDryRunActuallyExecuted: boolean;
  messageSendDryRunActuallyExecutedOnlyWhenFlagEnabled: true;
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

export type ZavorthWave4B3MessageSendDryRunOptions = {
  generatedAt: string;
  runtimeId: typeof ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLE_RUNTIME_ID;
  source: ZavorthWave4B3MessageSendDryRunSource;
  featureFlag: ZavorthWave4B3MessageSendDryRunFeatureFlagGate;
  targetSessionId?: string;
  targetThreadId?: string;
  targetChannelIntegrationId?: string;
  targetTransportIntegrationId?: string;
};

function firstSession(source: ZavorthWave4B3MessageSendDryRunSource): ZavorthNativeSessionMetadataRecord | undefined {
  return source.sessionHistoryRegistry.listSessions({ hasMessages: true })[0] ?? source.sessionHistoryRegistry.listSessions()[0];
}

function findSession(
  source: ZavorthWave4B3MessageSendDryRunSource,
  sessionId?: string,
): ZavorthNativeSessionMetadataRecord | undefined {
  return sessionId ? source.sessionHistoryRegistry.lookupSession(sessionId).record : firstSession(source);
}

function findThread(
  source: ZavorthWave4B3MessageSendDryRunSource,
  session: ZavorthNativeSessionMetadataRecord | undefined,
  threadId?: string,
): ZavorthNativeThreadMetadataRecord | undefined {
  if (!session) {
    return undefined;
  }
  const selectedThreadId = threadId ?? session.threadRecordIds[0];
  return selectedThreadId ? source.sessionHistoryRegistry.lookupThread(selectedThreadId).record : undefined;
}

function listMessages(
  source: ZavorthWave4B3MessageSendDryRunSource,
  session: ZavorthNativeSessionMetadataRecord | undefined,
  thread: ZavorthNativeThreadMetadataRecord | undefined,
): ZavorthNativeMessageMetadataRecord[] {
  if (!session || !thread) {
    return [];
  }
  return source.sessionHistoryRegistry.listMessages({
    sessionRecordId: session.id,
    threadRecordId: thread.id,
  });
}

function lookupIntegration(
  source: ZavorthWave4B3MessageSendDryRunSource,
  integrationId: string | undefined,
): ZavorthNativeIntegrationRecord | undefined {
  return integrationId ? source.integrationRegistry.lookup(integrationId).record : undefined;
}

function chooseChannel(
  source: ZavorthWave4B3MessageSendDryRunSource,
  session: ZavorthNativeSessionMetadataRecord | undefined,
  channelId?: string,
): ZavorthNativeIntegrationRecord | undefined {
  return lookupIntegration(source, channelId ?? session?.channelIntegrationIds[0]);
}

function chooseTransport(
  source: ZavorthWave4B3MessageSendDryRunSource,
  session: ZavorthNativeSessionMetadataRecord | undefined,
  transportId?: string,
): ZavorthNativeIntegrationRecord | undefined {
  const selectedTransportId = transportId ?? session?.transportIntegrationIds
    .map((id) => source.integrationRegistry.lookup(id).record)
    .find((record): record is ZavorthNativeIntegrationRecord => record !== undefined && record.supportsSend && record.sendPolicy === 'blocked')
    ?.id ?? source.integrationRegistry.list({
      integrationKind: 'message-transport',
      supportsSend: true,
    }).find((record) => record.sendPolicy === 'blocked')?.id ?? session?.transportIntegrationIds[0];
  return lookupIntegration(source, selectedTransportId);
}

function redactedPayloadValid(view: ZavorthWave4C2RedactedContentNativeView): boolean {
  return (
    view.payload.contentRawStored === false &&
    view.payload.rawMessageContentSerialized === false &&
    view.payload.rawSecretSerialized === false &&
    view.payload.attachmentContentSerialized === false &&
    view.payload.sqlitePayloadSerialized === false &&
    view.rawMessageContentSerialized === false &&
    view.rawSecretSerialized === false
  );
}

function unique<TValue>(values: TValue[]): TValue[] {
  return Array.from(new Set(values));
}

function sourceStatuses(source: ZavorthWave4B3MessageSendDryRunSource): ZavorthWave4B3MessageSendDryRunStatus[] {
  const statuses: ZavorthWave4B3MessageSendDryRunStatus[] = [];

  if (
    source.dryRunSelection.decision !== 'wave4b3-message-send-dry-run-executable-selection-ready' ||
    !source.messageSendTransportBlockedRehearsalReady ||
    !source.realMessageTransportDiscoveryReady ||
    !source.wave4b2MediumRiskExecutablesReady ||
    !source.wave4c2RedactedContentMigrationReady ||
    !source.actionGovernancePipelineReady ||
    !source.nativeIntegrationRegistryReady ||
    !source.nativeSessionHistoryRegistryReady ||
    !source.migratedSessionChannelTransportMetadataReady ||
    !source.redactedDerivedContentReady ||
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
  if (source.rawContentUsageAttempted || source.redactedContentViews.some((view) => !redactedPayloadValid(view))) {
    statuses.push('raw-content-rejected');
  }
  if (source.newStateMigrationAttempted || source.sourceModuleCopyAttempted || source.adapterRemovalAttempted) {
    statuses.push('source-not-ready');
  }
  if (!source.policyAllowsDryRun) {
    statuses.push('policy-rejected');
  }

  return statuses;
}

function targetRecord(input: {
  channel: ZavorthNativeIntegrationRecord | undefined;
  messages: ZavorthNativeMessageMetadataRecord[];
  session: ZavorthNativeSessionMetadataRecord | undefined;
  thread: ZavorthNativeThreadMetadataRecord | undefined;
  transport: ZavorthNativeIntegrationRecord | undefined;
}): ZavorthWave4B3MessageSendDryRunTarget {
  return {
    nativeContract: 'ZavorthWave4B3MessageSendDryRunTarget/v1',
    sessionRecordId: input.session?.id ?? 'missing-session',
    sessionAlias: input.session?.publicSessionAlias ?? 'missing-session-alias',
    threadRecordId: input.thread?.id ?? 'missing-thread',
    threadAlias: input.thread?.publicThreadAlias ?? 'missing-thread-alias',
    channelIntegrationId: input.channel?.id ?? 'missing-channel',
    channelType: input.channel?.integrationType ?? 'missing-channel-type',
    transportIntegrationId: input.transport?.id ?? 'missing-transport',
    transportType: input.transport?.integrationType ?? 'missing-transport-type',
    targetMessageMetadataIds: input.messages.map((message) => message.id),
    participantCount: input.session?.participantMetadata.participantCount ?? 0,
    participantKinds: input.session?.participantMetadata.participantKinds ?? [],
    sendCapableStatus: input.transport?.supportsSend && input.transport.sendPolicy === 'blocked'
      ? 'send-capable-but-blocked'
      : input.transport ? 'not-send-capable' : 'unknown',
    transportConfigured: input.transport?.configured ?? false,
    transportSupportsDryRun: input.transport?.supportsDryRun ?? false,
    sourceIdentityPublic: false,
    rawParticipantIdsSerialized: false,
    rawMessageContentSerialized: false,
  };
}

function contentEnvelope(
  views: ZavorthWave4C2RedactedContentNativeView[],
  messages: ZavorthNativeMessageMetadataRecord[],
): ZavorthWave4B3MessageSendDryRunContentEnvelope {
  return {
    nativeContract: 'ZavorthWave4B3MessageSendDryRunContentEnvelope/v1',
    viewIds: views.map((view) => view.viewId),
    contentHashes: views.map((view) => view.contentHash).filter((hash): hash is string => Boolean(hash)),
    contentLengthBuckets: views.flatMap((view) => view.contentLengthBucket ? [view.contentLengthBucket] : []),
    redactedExcerpts: views.map((view) => view.redactedExcerpt).filter((excerpt): excerpt is '[redacted-content]' | '[unavailable]' => Boolean(excerpt)),
    sensitivityClassifications: unique(views.map((view) => view.sensitivityClassification)),
    messageMetadataIds: messages.map((message) => message.id),
    redactedDerivedContentUsed: true,
    rawContentUsed: false,
    rawMessageContentSerialized: false,
    rawSecretSerialized: false,
  };
}

function statuses(input: {
  channel: ZavorthNativeIntegrationRecord | undefined;
  featureFlag: ZavorthWave4B3MessageSendDryRunFeatureFlagGate;
  messages: ZavorthNativeMessageMetadataRecord[];
  session: ZavorthNativeSessionMetadataRecord | undefined;
  source: ZavorthWave4B3MessageSendDryRunSource;
  thread: ZavorthNativeThreadMetadataRecord | undefined;
  transport: ZavorthNativeIntegrationRecord | undefined;
}): ZavorthWave4B3MessageSendDryRunStatus[] {
  const result = sourceStatuses(input.source);

  if (!input.featureFlag.enabled) {
    result.push('feature-flag-disabled');
  }
  if (!input.session) {
    result.push('target-unavailable');
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
    if (input.transport.requiredSecretRefs.every((secretRef) => !secretRef.rawValueSerialized)) {
      result.push('secretref-metadata-only');
    }
  }
  if (input.source.redactedContentViews.some((view) => view.viewKind === 'redacted-excerpt')) {
    result.push('redacted-content-accepted');
  }
  if (input.source.redactedContentViews.some((view) => view.viewKind === 'content-hash' || view.viewKind === 'content-length-count-metadata' || view.viewKind === 'sensitivity-classification')) {
    result.push('derived-content-accepted');
  }
  if (input.source.policyAllowsDryRun) {
    result.push('policy-eligible');
  }
  if (input.source.approvalMetadataRequired) {
    result.push('approval-metadata-recorded');
  }
  result.push('idempotency-valid');

  if (
    result.includes('target-resolved') &&
    result.includes('thread-resolved') &&
    result.includes('channel-resolved') &&
    result.includes('transport-resolved') &&
    result.includes('send-capable-blocked') &&
    result.includes('secretref-metadata-only') &&
    result.includes('redacted-content-accepted') &&
    result.includes('derived-content-accepted') &&
    result.includes('policy-eligible') &&
    result.includes('idempotency-valid') &&
    !result.includes('transport-unconfigured') &&
    !result.includes('transport-degraded') &&
    !result.includes('raw-content-rejected')
  ) {
    result.push('valid');
  }

  return unique(result);
}

function decision(statuses: ZavorthWave4B3MessageSendDryRunStatus[]): ZavorthWave4B3MessageSendDryRunDecision {
  if (statuses.includes('feature-flag-disabled')) {
    return 'execution-blocked';
  }
  if (statuses.includes('external-executor-touch-attempted') || statuses.includes('high-impact-execution-attempted') || statuses.includes('source-not-ready')) {
    return 'dry-run-blocked';
  }
  if (statuses.includes('raw-content-rejected')) {
    return 'raw-content-rejected';
  }
  if (statuses.includes('policy-rejected')) {
    return 'policy-rejected';
  }
  if (statuses.includes('target-unavailable') || statuses.includes('thread-unavailable') || statuses.includes('channel-unavailable')) {
    return 'target-unavailable';
  }
  if (statuses.includes('transport-unavailable')) {
    return 'transport-unconfigured';
  }
  if (statuses.includes('transport-unconfigured') || statuses.includes('transport-degraded')) {
    return 'dry-run-degraded';
  }
  return statuses.includes('valid') ? 'dry-run-ok' : 'dry-run-degraded';
}

function detail(
  validation: ZavorthWave4B3MessageSendDryRunDetail['validation'],
  status: ZavorthWave4B3MessageSendDryRunDetail['status'],
  reason: string,
): ZavorthWave4B3MessageSendDryRunDetail {
  return {
    nativeContract: 'ZavorthWave4B3MessageSendDryRunDetail/v1',
    validation,
    status,
    reason,
  };
}

function validationDetails(statuses: ZavorthWave4B3MessageSendDryRunStatus[]): ZavorthWave4B3MessageSendDryRunDetail[] {
  return [
    detail('feature-flag', statuses.includes('feature-flag-disabled') ? 'blocked' : 'passed', statuses.includes('feature-flag-disabled')
      ? 'The required Wave 4B.3 message-send dry-run feature flag is disabled.'
      : 'The message-send dry-run feature flag is enabled for controlled tests.'),
    detail('metadata-source', statuses.includes('source-not-ready') ? 'failed' : 'passed', statuses.includes('source-not-ready')
      ? 'Native/migrated metadata sources are not ready or attempted out-of-scope work.'
      : 'Native session/history, integration, and redacted content metadata are the source.'),
    detail('session-target', statuses.includes('target-resolved') ? 'passed' : 'failed', statuses.includes('target-resolved')
      ? 'Target session resolves from migrated/native metadata.'
      : 'Target session is unavailable.'),
    detail('thread-target', statuses.includes('thread-resolved') ? 'passed' : 'failed', statuses.includes('thread-resolved')
      ? 'Target thread resolves from migrated/native metadata.'
      : 'Target thread is unavailable.'),
    detail('transport-target', statuses.includes('transport-resolved') && statuses.includes('channel-resolved') ? 'passed' : 'failed', statuses.includes('transport-unconfigured')
      ? 'Transport exists but is unconfigured.'
      : statuses.includes('transport-resolved') && statuses.includes('channel-resolved')
        ? 'Channel and transport resolve from native integration metadata.'
        : 'Channel or transport metadata is unavailable.'),
    detail('content-redaction', statuses.includes('raw-content-rejected') ? 'failed' : 'passed', statuses.includes('raw-content-rejected')
      ? 'Raw content was attempted or detected and is rejected.'
      : 'Only redacted/derived content views are used.'),
    detail('send-capable-block', statuses.includes('send-capable-blocked') ? 'passed' : 'blocked', statuses.includes('send-capable-blocked')
      ? 'Send-capable transport remains blocked for live transport.'
      : 'No send-capable blocked transport metadata was selected.'),
    detail('secretref-metadata', statuses.includes('secretref-metadata-only') ? 'passed' : 'failed', statuses.includes('secretref-metadata-only')
      ? 'Required credentials are represented only as SecretRef metadata.'
      : 'SecretRef metadata failed redaction rules.'),
    detail('policy-preflight', statuses.includes('policy-rejected') ? 'blocked' : 'passed', statuses.includes('policy-rejected')
      ? 'Zavorth policy rejected the dry-run plan.'
      : 'Zavorth policy preflight/recheck allows dry-run planning only.'),
    detail('approval-metadata', statuses.includes('approval-metadata-recorded') ? 'passed' : 'passed', 'Approval metadata is recorded for future live send; no approval is granted in this dry-run.'),
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

function policyPreflight(target: ZavorthWave4B3MessageSendDryRunTarget): ZavorthWave4B3MessageSendDryRunPolicyPreflight {
  return {
    nativeContract: 'ZavorthWave4B3MessageSendDryRunPolicyPreflight/v1',
    policyPreflightRequired: true,
    policyRecheckedImmediatelyBeforeExecution: true,
    approvalRequiredForDryRun: false,
    approvalRequiredBeforeFutureLiveSend: true,
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

function approvalMetadata(source: ZavorthWave4B3MessageSendDryRunSource): ZavorthWave4B3MessageSendDryRunApprovalMetadata {
  return {
    nativeContract: 'ZavorthWave4B3MessageSendDryRunApprovalMetadata/v1',
    approvalMetadataRequired: source.approvalMetadataRequired,
    approvalActuallyGranted: false,
    approvalGrantRequiredBeforeLiveSend: true,
    approverIdentitySerialized: false,
    exactScopeRequired: true,
    ttlRequired: true,
    idempotencyKeyRequired: true,
  };
}

function cleanupReceipt(): ZavorthWave4B3MessageSendDryRunCleanupReceipt {
  return {
    nativeContract: 'ZavorthWave4B3MessageSendDryRunCleanupReceipt/v1',
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

function idempotencyKey(target: ZavorthWave4B3MessageSendDryRunTarget, content: ZavorthWave4B3MessageSendDryRunContentEnvelope): string {
  return [
    'zavorth-wave4b3-message-send-dry-run',
    target.sessionRecordId,
    target.threadRecordId,
    target.channelIntegrationId,
    target.transportIntegrationId,
    content.contentHashes.join('+') || 'no-content-hash',
  ].join(':');
}

function dryRunPlan(input: {
  content: ZavorthWave4B3MessageSendDryRunContentEnvelope;
  idempotencyKey: string;
  target: ZavorthWave4B3MessageSendDryRunTarget;
  transport: ZavorthNativeIntegrationRecord | undefined;
}): ZavorthWave4B3MessageSendDryRunPlan {
  return {
    nativeContract: 'ZavorthWave4B3MessageSendDryRunPlan/v1',
    planId: input.idempotencyKey,
    mode: 'dry-run-only',
    action: 'message-send-dry-run-action',
    target: input.target,
    content: input.content,
    requiredSecretRefs: input.transport?.requiredSecretRefs ?? [],
    sendCapableButBlocked: input.target.sendCapableStatus === 'send-capable-but-blocked',
    transportLiveBlocked: true,
    externalTransportInvoked: false,
    messageActuallySent: false,
    providerActuallyExecuted: false,
    commandActuallyExecuted: false,
    toolActuallyExecuted: false,
    externalExecutorTouched: false,
    rawSecretSerialized: false,
  };
}

export class ZavorthWave4B3MessageSendDryRunExecutable {
  public constructor(public readonly receipt: ZavorthWave4B3MessageSendDryRunReceipt) {}

  public dryRunSucceeded(): boolean {
    return this.receipt.decision === 'dry-run-ok' || this.receipt.decision === 'dry-run-degraded';
  }

  public messageSendStillBlocked(): boolean {
    return this.receipt.realMessageSendAllowed === false &&
      this.receipt.transportActuallyOpened === false &&
      this.receipt.policyPreflight.messageSendBlocked;
  }

  public isIdempotentWith(other: ZavorthWave4B3MessageSendDryRunExecutable): boolean {
    return this.receipt.idempotencyKey === other.receipt.idempotencyKey &&
      this.receipt.decision === other.receipt.decision;
  }
}

export function createZavorthWave4B3MessageSendDryRunFeatureFlagGate(
  enabled: boolean,
): ZavorthWave4B3MessageSendDryRunFeatureFlagGate {
  return {
    nativeContract: 'ZavorthWave4B3MessageSendDryRunFeatureFlagGate/v1',
    flagName: ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTE_FLAG,
    enabled,
    safetyGate: 'controlled-test',
    operatorAcknowledgedNoExternalTransport: true,
    messageSendDryRunFeatureFlagRequired: true,
  };
}

function redactedContentView(
  viewKind: ZavorthWave4C2RedactedContentNativeView['viewKind'],
  itemId: ZavorthWave4C2RedactedContentNativeView['itemId'],
  overrides: Partial<ZavorthWave4C2RedactedContentNativeView> = {},
): ZavorthWave4C2RedactedContentNativeView {
  const payload: ZavorthWave4C2RedactedContentPayload = {
    nativeContract: 'ZavorthWave4C2RedactedContentPayload/v1',
    itemClass: itemId,
    payloadKind: 'redacted-session-content-derived-metadata-only',
    contentRawStored: false,
    rawMessageContentSerialized: false,
    rawSecretSerialized: false,
    attachmentContentSerialized: false,
    sqlitePayloadSerialized: false,
    redactedExcerpt: viewKind === 'redacted-excerpt' ? '[redacted-content]' as const : undefined,
    contentHash: viewKind === 'content-hash' ? `sha256:wave4c2:${itemId}` : undefined,
    contentLengthBucket: viewKind === 'content-length-count-metadata' ? 'short' as const : undefined,
    countMetadata: viewKind === 'content-length-count-metadata' ? { messageCountBucket: 'few' as const, participantCountBucket: 'few' as const } : undefined,
    linkageMetadata: viewKind === 'participant-channel-thread-linkage' ? {
      sessionAlias: 'session-alias-redacted' as const,
      threadAlias: 'thread-alias-redacted' as const,
      channelAlias: 'channel-alias-redacted' as const,
    } : undefined,
    sensitivityClassification: viewKind === 'participant-channel-thread-linkage'
      ? 'channel-link' as const
      : viewKind === 'sensitivity-classification' || viewKind === 'redacted-excerpt' || viewKind === 'content-hash'
        ? 'message-content' as const
        : 'timestamp' as const,
  };

  return {
    nativeContract: 'ZavorthWave4C2RedactedContentNativeView/v1',
    viewId: `wave4c2:redacted-content:${itemId}`,
    itemId,
    viewKind,
    label: `${viewKind} view`,
    status: 'available',
    payload,
    contentHash: payload.contentHash,
    contentLengthBucket: payload.contentLengthBucket,
    redactedExcerpt: payload.redactedExcerpt,
    sensitivityClassification: payload.sensitivityClassification,
    commandCenterConsumable: true,
    plannerConsumable: true,
    policyConsumable: true,
    observabilityConsumable: true,
    redactedContentLoadedFromZavorthStorage: true,
    runtimeExternalExecutorRequiredForRedactedContentLoad: false,
    runtimeExternalExecutorRequiredForRedactedContentRender: false,
    sourceRuntimeAuthority: false,
    rawMessageContentMigrationAllowed: false,
    rawMessageContentSerialized: false,
    rawSecretSerialized: false,
    ...overrides,
  };
}

export function createZavorthWave4B3MessageSendDryRunRedactedContentViewsFixture(): ZavorthWave4C2RedactedContentNativeView[] {
  return [
    redactedContentView('content-hash', 'message-content-hash'),
    redactedContentView('content-length-count-metadata', 'message-token-count-bucket'),
    redactedContentView('redacted-excerpt', 'message-redacted-excerpt'),
    redactedContentView('sensitivity-classification', 'session-content-presence'),
    redactedContentView('participant-channel-thread-linkage', 'channel-linkage-metadata'),
  ];
}

export function createZavorthWave4B3MessageSendDryRunSource(
  overrides: Partial<Omit<
    ZavorthWave4B3MessageSendDryRunSource,
    'dryRunSelection' | 'integrationRegistry' | 'redactedContentViews' | 'sessionHistoryRegistry'
  >> & {
    dryRunSelection?: ZavorthWave4B3MessageSendDryRunExecutableSelectionNormalization;
    integrationRegistry?: ZavorthNativeIntegrationRegistry;
    redactedContentViews?: ZavorthWave4C2RedactedContentNativeView[];
    sessionHistoryRegistry?: ZavorthNativeSessionHistoryRegistry;
  } = {},
): ZavorthWave4B3MessageSendDryRunSource {
  return {
    dryRunSelection: normalizeZavorthWave4B3MessageSendDryRunExecutableSelectionFixture(),
    sessionHistoryRegistry: createZavorthNativeSessionHistoryRegistryFixture(),
    integrationRegistry: createZavorthNativeIntegrationRegistryFixture(),
    redactedContentViews: createZavorthWave4B3MessageSendDryRunRedactedContentViewsFixture(),
    messageSendTransportBlockedRehearsalReady: true,
    realMessageTransportDiscoveryReady: true,
    wave4b2MediumRiskExecutablesReady: true,
    wave4c2RedactedContentMigrationReady: true,
    actionGovernancePipelineReady: true,
    nativeIntegrationRegistryReady: true,
    nativeSessionHistoryRegistryReady: true,
    migratedSessionChannelTransportMetadataReady: true,
    redactedDerivedContentReady: true,
    policyAllowsDryRun: true,
    approvalMetadataRequired: true,
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

export function normalizeZavorthWave4B3MessageSendDryRunExecutable(
  options: ZavorthWave4B3MessageSendDryRunOptions,
): ZavorthWave4B3MessageSendDryRunReceipt {
  const session = findSession(options.source, options.targetSessionId);
  const thread = findThread(options.source, session, options.targetThreadId);
  const messages = listMessages(options.source, session, thread);
  const channel = chooseChannel(options.source, session, options.targetChannelIntegrationId);
  const transport = chooseTransport(options.source, session, options.targetTransportIntegrationId);
  const target = targetRecord({ channel, messages, session, thread, transport });
  const content = contentEnvelope(options.source.redactedContentViews, messages);
  const key = idempotencyKey(target, content);
  const plan = dryRunPlan({ content, idempotencyKey: key, target, transport });
  const dryRunStatuses = statuses({
    channel,
    featureFlag: options.featureFlag,
    messages,
    session,
    source: options.source,
    thread,
    transport,
  });
  const gateDecision = decision(dryRunStatuses);

  return {
    nativeContract: 'ZavorthWave4B3MessageSendDryRunActionReceipt/v1',
    runtimeId: options.runtimeId,
    generatedAt: options.generatedAt,
    selectedDryRunCapability: 'message-send-dry-run-action',
    decision: gateDecision,
    classification: gateDecision,
    validations: dryRunStatuses,
    validationDetails: validationDetails(dryRunStatuses),
    featureFlag: options.featureFlag,
    idempotencyKey: key,
    dryRunPlan: plan,
    policyPreflight: policyPreflight(target),
    approvalMetadata: approvalMetadata(options.source),
    requiredSecretRefs: transport?.requiredSecretRefs ?? [],
    sourceMetadata: {
      sessionRegistryRecordCount: options.source.sessionHistoryRegistry.snapshot.sessions.length,
      threadRegistryRecordCount: options.source.sessionHistoryRegistry.snapshot.threads.length,
      messageRegistryRecordCount: options.source.sessionHistoryRegistry.snapshot.messages.length,
      integrationRegistryRecordCount: options.source.integrationRegistry.snapshot.records.length,
      redactedContentViewCount: options.source.redactedContentViews.length,
      migratedSessionChannelTransportMetadataUsed: true,
      redactedDerivedContentUsed: true,
      nativeSessionHistoryRegistryUsed: true,
      nativeIntegrationRegistryUsed: true,
      sourceProvenanceInternalRedacted: true,
    },
    cleanupReceipt: cleanupReceipt(),
    wave4b3MessageSendDryRunExecutableCreated: true,
    messageSendDryRunActuallyExecuted: options.featureFlag.enabled,
    messageSendDryRunActuallyExecutedOnlyWhenFlagEnabled: true,
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

export function createZavorthWave4B3MessageSendDryRunExecutableFixture(
  overrides: {
    featureFlagEnabled?: boolean;
    generatedAt?: string;
    source?: Partial<Parameters<typeof createZavorthWave4B3MessageSendDryRunSource>[0]>;
    targetChannelIntegrationId?: string;
    targetSessionId?: string;
    targetThreadId?: string;
    targetTransportIntegrationId?: string;
  } = {},
): ZavorthWave4B3MessageSendDryRunExecutable {
  const source = createZavorthWave4B3MessageSendDryRunSource(overrides.source);
  const receipt = normalizeZavorthWave4B3MessageSendDryRunExecutable({
    generatedAt: overrides.generatedAt ?? ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLE_NOW,
    runtimeId: ZAVORTH_WAVE4B3_MESSAGE_SEND_DRY_RUN_EXECUTABLE_RUNTIME_ID,
    source,
    featureFlag: createZavorthWave4B3MessageSendDryRunFeatureFlagGate(overrides.featureFlagEnabled ?? true),
    targetSessionId: overrides.targetSessionId,
    targetThreadId: overrides.targetThreadId,
    targetChannelIntegrationId: overrides.targetChannelIntegrationId,
    targetTransportIntegrationId: overrides.targetTransportIntegrationId,
  });

  return new ZavorthWave4B3MessageSendDryRunExecutable(receipt);
}
