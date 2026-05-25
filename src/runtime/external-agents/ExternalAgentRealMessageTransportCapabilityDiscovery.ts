import {
  normalizeExternalAgentDashboardLiveAssimilationFixture,
} from './ExternalAgentDashboardLiveAssimilation.js';
import {
  normalizeMessageSendLiveRehearsalTransportBlockedFixture,
} from './ExternalAgentMessageSendLiveRehearsalTransportBlocked.js';
import {
  normalizeExternalExecutorLiveObservabilityProjectionFixture,
} from './ExternalAgentExternalExecutorLiveObservabilityProjection.js';
import {
  normalizeExternalExecutorLiveReadOnlyBridgeBoundaryFixture,
} from './ExternalAgentExternalExecutorLiveReadOnlyBridgeBoundary.js';
import {
  normalizeExternalExecutorRealCapabilitySnapshotReadOnlyFixture,
} from './ExternalAgentExternalExecutorRealCapabilitySnapshotReadOnly.js';
import {
  normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture,
} from './ExternalAgentExternalExecutorSessionHistoryReadOnlyBridge.js';
import type {
  ExternalAgentDashboardLiveAssimilationNormalization,
} from './ExternalAgentDashboardLiveAssimilation.js';
import type {
  ZavorthMessageSendLiveRehearsalTransportBlockedNormalization,
} from './ExternalAgentMessageSendLiveRehearsalTransportBlocked.js';
import type {
  ExternalExecutorLiveObservabilityProjectionNormalization,
} from './ExternalAgentExternalExecutorLiveObservabilityProjection.js';
import type {
  ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization,
} from './ExternalAgentExternalExecutorLiveReadOnlyBridgeBoundary.js';
import type {
  ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization,
} from './ExternalAgentExternalExecutorRealCapabilitySnapshotReadOnly.js';
import type {
  ExternalExecutorSessionHistoryReadOnlyBridgeNormalization,
} from './ExternalAgentExternalExecutorSessionHistoryReadOnlyBridge.js';

export const EXTERNAL_AGENT_REAL_MESSAGE_TRANSPORT_CAPABILITY_DISCOVERY_NOW = '2026-04-29T00:00:00.000Z' as const;
export const EXTERNAL_AGENT_REAL_MESSAGE_TRANSPORT_CAPABILITY_DISCOVERY_RUNTIME_ID = 'external-agent-real-message-transport-capability-discovery' as const;

export type ZavorthMessageTransportCapabilityDiscoveryDecision =
  | 'real-message-transport-capability-discovery-ready'
  | 'blocked';

export type ZavorthExternalMessageTransportKind =
  | 'discord'
  | 'imessage'
  | 'mattermost'
  | 'matrix'
  | 'msteams'
  | 'qa-channel'
  | 'signal'
  | 'slack'
  | 'status-only'
  | 'telegram'
  | 'twitch'
  | 'unknown'
  | 'whatsapp';

export type ZavorthMessageTransportCapabilityState =
  | 'degraded-unknown'
  | 'read-only'
  | 'send-capable-but-blocked'
  | 'unconfigured';

export type ZavorthMessageTransportCapabilityRisk =
  | 'blocked-mutable-send'
  | 'read-only-metadata'
  | 'unknown';

export type ZavorthMessageTransportCredentialRequirement =
  | 'none'
  | 'secret-ref-required'
  | 'unknown';

export type ZavorthMessageTransportSourceRecord = {
  sourceCase: string;
  transportKind: ZavorthExternalMessageTransportKind;
  sourceChannelType: string;
  configured: boolean;
  status: 'degraded' | 'ready' | 'unavailable' | 'unknown';
  supportsSend: boolean;
  supportsDryRun: boolean;
  readOnlyOnly: boolean;
  requiredScopes: string[];
  credentialRequirement: ZavorthMessageTransportCredentialRequirement;
  secretRefName?: string;
  targetRequirements: string[];
  ackModel: string;
  errorModel: string;
  rateLimitModel: string;
  sourceEvidence: string[];
};

export type ZavorthMessageTransportSkipChannelsDecision = {
  nativeContract: 'ZavorthMessageTransportSkipChannelsDecision/v1';
  skipChannelsUsed: true;
  skipChannelsReason: string;
  realChannelActivationBlocked: true;
  discoveryCompleteness: 'limited-by-read-only-safety';
};

export type ZavorthMessageTransportLiveDiscoveryEvidence = {
  nativeContract: 'ZavorthMessageTransportLiveDiscoveryEvidence/v1';
  tokenStatus: 'present-redacted';
  commandArgTokenUsed: false;
  gatewayBind: 'loopback';
  gatewayPort: 18789;
  readinessRpcFrom156Used: true;
  skipProviders: true;
  disableBonjour: true;
  skipChannelsDecision: ZavorthMessageTransportSkipChannelsDecision;
  preListenerCount: 0;
  preProcessCount: 0;
  listenerObserved: true;
  listenerObservedAtMs: number;
  channelsHelpExitCode: 0;
  channelsStatusHelpExitCode: 0;
  channelsListHelpExitCode: 0;
  messageHelpExitCode: 0;
  messageSendHelpExitCode: 0;
  gatewayCallHelpExitCode: 0;
  channelsStatusJsonExitCode: 0;
  channelsListJsonExitCode: 0;
  gatewayStatusExitCode: 0;
  gatewayProbeExitCode: number;
  configuredChannelsCount: 0;
  configuredAuthProviders: string[];
  cliSendChannelsDiscovered: string[];
  messageSendDryRunFlagExposed: true;
  firstCleanupListenerCount: number;
  firstCleanupProcessCount: number;
  finalCleanupListenerCount: 0;
  finalCleanupProcessCount: 0;
  rawSecretSerialized: false;
};

export type ZavorthExternalMessageTransportSecretRef = {
  nativeContract: 'ZavorthExternalMessageTransportSecretRef/v1';
  name: string;
  purpose: 'channel-credential' | 'gateway-token' | 'provider-auth-metadata';
  status: 'metadata-only' | 'present-redacted' | 'unknown';
  rawValueSerialized: false;
};

export type ZavorthExternalMessageTransportCapability = {
  nativeContract: 'ZavorthExternalMessageTransportCapability/v1';
  id: string;
  transportKind: ZavorthExternalMessageTransportKind;
  channelType: string;
  status: ZavorthMessageTransportCapabilityState;
  configured: boolean;
  supportsSend: boolean;
  sendPolicy: 'blocked' | 'not-supported';
  supportsDryRun: boolean;
  requiredScopes: string[];
  credentialRequirement: ZavorthMessageTransportCredentialRequirement;
  secretRef?: ZavorthExternalMessageTransportSecretRef;
  targetRequirements: string[];
  ackModel: string;
  errorModel: string;
  rateLimitModel: string;
  risk: ZavorthMessageTransportCapabilityRisk;
  sourceEvidence: string[];
  sourceIdsEvidenceOnly: true;
  sourceAuthorityGranted: false;
  rawSecretSerialized: false;
};

export type ZavorthMessageTransportDiscoveryRow = {
  nativeContract: 'ZavorthMessageTransportDiscoveryRow/v1';
  id: string;
  capabilityId: string;
  transportKind: ZavorthExternalMessageTransportKind;
  status: ZavorthMessageTransportCapabilityState;
  supportsSend: boolean;
  sendBlocked: boolean;
  credentialRequirement: ZavorthMessageTransportCredentialRequirement;
};

export type ZavorthMessageTransportDiscoveryExecutionGate = {
  transportCapabilityDiscoveryPerformed: true;
  messageActuallySent: false;
  transportMutationActuallyCalled: false;
  providerActuallyExecuted: false;
  commandActuallyExecuted: false;
  toolActuallyExecuted: false;
  sessionMutationActuallyPerformed: false;
  sourceAuthorityGranted: false;
  sourceModuleCopied: false;
  nativeReplacementAuthorized: false;
  rawSecretSerialized: false;
};

export type ZavorthMessageTransportCapabilityDiscoveryNormalization = {
  nativeContract: 'ZavorthRealMessageTransportCapabilityDiscovery/v1';
  generatedAt: string;
  runtimeId: string;
  decision: ZavorthMessageTransportCapabilityDiscoveryDecision;
  sourceReadiness: {
    capabilitySnapshot: ExternalExecutorRealCapabilitySnapshotReadOnlyNormalization['decision'];
    bridge: ExternalExecutorLiveReadOnlyBridgeBoundaryNormalization['decision'];
    observability: ExternalExecutorLiveObservabilityProjectionNormalization['decision'];
    sessionHistory: ExternalExecutorSessionHistoryReadOnlyBridgeNormalization['decision'];
    dashboard: ExternalAgentDashboardLiveAssimilationNormalization['decision'];
    messageSendRehearsal: ZavorthMessageSendLiveRehearsalTransportBlockedNormalization['decision'];
  };
  discoveryEvidence: ZavorthMessageTransportLiveDiscoveryEvidence;
  capabilities: ZavorthExternalMessageTransportCapability[];
  rows: ZavorthMessageTransportDiscoveryRow[];
  feedsRehearsal: {
    doc: 'docs/message-send-live-rehearsal-transport-blocked.md';
    rehearsalDecision: ZavorthMessageSendLiveRehearsalTransportBlockedNormalization['decision'];
    transportLiveBlocked: true;
  };
  executionGate: ZavorthMessageTransportDiscoveryExecutionGate;
  redaction: {
    rawSecretSerialized: false;
    credentialsAsSecretRefOnly: true;
    serializedOutputContainsSensitiveFixture: false;
  };
  nextGateRecommended: 'future-explicit-message-send-transport-target-gate';
};

export type ZavorthMessageTransportCapabilityDiscoveryOptions<TRuntimeId extends string = string> = {
  generatedAt: string;
  idPrefix: string;
  runtimeId: TRuntimeId;
  sourceReadiness: ZavorthMessageTransportCapabilityDiscoveryNormalization['sourceReadiness'];
  discoveryEvidence: ZavorthMessageTransportLiveDiscoveryEvidence;
  sourceRecords: ZavorthMessageTransportSourceRecord[];
  messageSendRehearsal: ZavorthMessageSendLiveRehearsalTransportBlockedNormalization;
};

function capabilityStatus(record: ZavorthMessageTransportSourceRecord): ZavorthMessageTransportCapabilityState {
  if (record.readOnlyOnly) {
    return 'read-only';
  }

  if (record.supportsSend) {
    return record.configured ? 'send-capable-but-blocked' : 'unconfigured';
  }

  return 'degraded-unknown';
}

function capabilityRisk(record: ZavorthMessageTransportSourceRecord): ZavorthMessageTransportCapabilityRisk {
  if (record.supportsSend) {
    return 'blocked-mutable-send';
  }

  if (record.readOnlyOnly) {
    return 'read-only-metadata';
  }

  return 'unknown';
}

function buildCapability(
  idPrefix: string,
  record: ZavorthMessageTransportSourceRecord,
  index: number,
): ZavorthExternalMessageTransportCapability {
  const secretRef = record.secretRefName
    ? {
        nativeContract: 'ZavorthExternalMessageTransportSecretRef/v1' as const,
        name: record.secretRefName,
        purpose: 'channel-credential' as const,
        status: 'metadata-only' as const,
        rawValueSerialized: false as const,
      }
    : undefined;

  return {
    nativeContract: 'ZavorthExternalMessageTransportCapability/v1',
    id: `${idPrefix}:capability-${index + 1}-${record.transportKind}`,
    transportKind: record.transportKind,
    channelType: record.sourceChannelType,
    status: capabilityStatus(record),
    configured: record.configured,
    supportsSend: record.supportsSend,
    sendPolicy: record.supportsSend ? 'blocked' : 'not-supported',
    supportsDryRun: record.supportsDryRun,
    requiredScopes: record.requiredScopes,
    credentialRequirement: record.credentialRequirement,
    ...(secretRef ? { secretRef } : {}),
    targetRequirements: record.targetRequirements,
    ackModel: record.ackModel,
    errorModel: record.errorModel,
    rateLimitModel: record.rateLimitModel,
    risk: capabilityRisk(record),
    sourceEvidence: record.sourceEvidence,
    sourceIdsEvidenceOnly: true,
    sourceAuthorityGranted: false,
    rawSecretSerialized: false,
  };
}

export function createMessageTransportLiveDiscoveryEvidence(): ZavorthMessageTransportLiveDiscoveryEvidence {
  return {
    nativeContract: 'ZavorthMessageTransportLiveDiscoveryEvidence/v1',
    tokenStatus: 'present-redacted',
    commandArgTokenUsed: false,
    gatewayBind: 'loopback',
    gatewayPort: 18789,
    readinessRpcFrom156Used: true,
    skipProviders: true,
    disableBonjour: true,
    skipChannelsDecision: {
      nativeContract: 'ZavorthMessageTransportSkipChannelsDecision/v1',
      skipChannelsUsed: true,
      skipChannelsReason: 'Kept EXTERNAL_EXECUTOR_SKIP_CHANNELS=1 because disabling it may initialize real channel bridges/watchers; this gate is metadata-only and must not open mutable transport.',
      realChannelActivationBlocked: true,
      discoveryCompleteness: 'limited-by-read-only-safety',
    },
    preListenerCount: 0,
    preProcessCount: 0,
    listenerObserved: true,
    listenerObservedAtMs: 19000,
    channelsHelpExitCode: 0,
    channelsStatusHelpExitCode: 0,
    channelsListHelpExitCode: 0,
    messageHelpExitCode: 0,
    messageSendHelpExitCode: 0,
    gatewayCallHelpExitCode: 0,
    channelsStatusJsonExitCode: 0,
    channelsListJsonExitCode: 0,
    gatewayStatusExitCode: 0,
    gatewayProbeExitCode: 1,
    configuredChannelsCount: 0,
    configuredAuthProviders: ['google:default:api_key'],
    cliSendChannelsDiscovered: [
      'telegram',
      'whatsapp',
      'discord',
      'slack',
      'signal',
      'imessage',
      'matrix',
      'msteams',
      'mattermost',
      'twitch',
      'qa-channel',
    ],
    messageSendDryRunFlagExposed: true,
    firstCleanupListenerCount: 2,
    firstCleanupProcessCount: 1,
    finalCleanupListenerCount: 0,
    finalCleanupProcessCount: 0,
    rawSecretSerialized: false,
  };
}

export function createMessageTransportCapabilitySourceRecords(): ZavorthMessageTransportSourceRecord[] {
  const sendTargets = [
    'telegram',
    'whatsapp',
    'discord',
    'slack',
    'signal',
    'imessage',
    'matrix',
    'msteams',
    'mattermost',
    'twitch',
    'qa-channel',
  ] as const;

  return [
    {
      sourceCase: 'gateway-status-read-only',
      transportKind: 'status-only',
      sourceChannelType: 'gateway-status',
      configured: true,
      status: 'ready',
      supportsSend: false,
      supportsDryRun: false,
      readOnlyOnly: true,
      requiredScopes: ['gateway.status.read'],
      credentialRequirement: 'none',
      targetRequirements: ['none'],
      ackModel: 'status-exit-code-only',
      errorModel: 'degraded-receipt',
      rateLimitModel: 'not-exposed',
      sourceEvidence: ['gateway status --json exit 0', 'read-only observability'],
    },
    ...sendTargets.map((channel): ZavorthMessageTransportSourceRecord => ({
      sourceCase: `message-send-cli-${channel}`,
      transportKind: channel === 'qa-channel' ? 'qa-channel' : channel,
      sourceChannelType: channel,
      configured: false,
      status: 'unavailable',
      supportsSend: true,
      supportsDryRun: true,
      readOnlyOnly: false,
      requiredScopes: ['channel.message.send'],
      credentialRequirement: 'secret-ref-required',
      secretRefName: `external-channel-${channel}-credential`,
      targetRequirements: ['--target', '--message or --media', '--channel', 'optional --thread-id'],
      ackModel: 'delivery-result-json-when-real-send-is-authorized-later',
      errorModel: 'transport-error-receipt',
      rateLimitModel: 'not-exposed-by-read-only-discovery',
      sourceEvidence: ['external-executor message send --help', 'send-capable CLI metadata only', '--dry-run exposed'],
    })),
    {
      sourceCase: 'configured-google-auth-not-message-transport',
      transportKind: 'unknown',
      sourceChannelType: 'google-auth-provider',
      configured: true,
      status: 'unknown',
      supportsSend: false,
      supportsDryRun: false,
      readOnlyOnly: false,
      requiredScopes: [],
      credentialRequirement: 'secret-ref-required',
      secretRefName: 'external-auth-google-default-api-key',
      targetRequirements: ['unknown'],
      ackModel: 'unknown',
      errorModel: 'degraded-unknown',
      rateLimitModel: 'unknown',
      sourceEvidence: ['channels list --json auth provider metadata', 'not classified as message transport'],
    },
  ];
}

export function normalizeMessageTransportCapabilityDiscovery<TRuntimeId extends string>(
  options: ZavorthMessageTransportCapabilityDiscoveryOptions<TRuntimeId>,
): ZavorthMessageTransportCapabilityDiscoveryNormalization {
  const capabilities = options.sourceRecords.map((record, index) => buildCapability(options.idPrefix, record, index));
  const rows = capabilities.map((capability, index): ZavorthMessageTransportDiscoveryRow => ({
    nativeContract: 'ZavorthMessageTransportDiscoveryRow/v1',
    id: `${options.idPrefix}:row-${index + 1}`,
    capabilityId: capability.id,
    transportKind: capability.transportKind,
    status: capability.status,
    supportsSend: capability.supportsSend,
    sendBlocked: capability.supportsSend && capability.sendPolicy === 'blocked',
    credentialRequirement: capability.credentialRequirement,
  }));

  return {
    nativeContract: 'ZavorthRealMessageTransportCapabilityDiscovery/v1',
    generatedAt: options.generatedAt,
    runtimeId: options.runtimeId,
    decision: 'real-message-transport-capability-discovery-ready',
    sourceReadiness: options.sourceReadiness,
    discoveryEvidence: options.discoveryEvidence,
    capabilities,
    rows,
    feedsRehearsal: {
      doc: 'docs/message-send-live-rehearsal-transport-blocked.md',
      rehearsalDecision: options.messageSendRehearsal.decision,
      transportLiveBlocked: true,
    },
    executionGate: {
      transportCapabilityDiscoveryPerformed: true,
      messageActuallySent: false,
      transportMutationActuallyCalled: false,
      providerActuallyExecuted: false,
      commandActuallyExecuted: false,
      toolActuallyExecuted: false,
      sessionMutationActuallyPerformed: false,
      sourceAuthorityGranted: false,
      sourceModuleCopied: false,
      nativeReplacementAuthorized: false,
      rawSecretSerialized: false,
    },
    redaction: {
      rawSecretSerialized: false,
      credentialsAsSecretRefOnly: true,
      serializedOutputContainsSensitiveFixture: false,
    },
    nextGateRecommended: 'future-explicit-message-send-transport-target-gate',
  };
}

export function normalizeMessageTransportCapabilityDiscoveryFixture(): ZavorthMessageTransportCapabilityDiscoveryNormalization {
  return normalizeMessageTransportCapabilityDiscovery({
    generatedAt: EXTERNAL_AGENT_REAL_MESSAGE_TRANSPORT_CAPABILITY_DISCOVERY_NOW,
    runtimeId: EXTERNAL_AGENT_REAL_MESSAGE_TRANSPORT_CAPABILITY_DISCOVERY_RUNTIME_ID,
    idPrefix: 'external-agent-real-message-transport-capability-discovery',
    sourceReadiness: {
      capabilitySnapshot: normalizeExternalExecutorRealCapabilitySnapshotReadOnlyFixture().decision,
      bridge: normalizeExternalExecutorLiveReadOnlyBridgeBoundaryFixture().decision,
      observability: normalizeExternalExecutorLiveObservabilityProjectionFixture().decision,
      sessionHistory: normalizeExternalExecutorSessionHistoryReadOnlyBridgeFixture().decision,
      dashboard: normalizeExternalAgentDashboardLiveAssimilationFixture().decision,
      messageSendRehearsal: normalizeMessageSendLiveRehearsalTransportBlockedFixture().decision,
    },
    discoveryEvidence: createMessageTransportLiveDiscoveryEvidence(),
    sourceRecords: createMessageTransportCapabilitySourceRecords(),
    messageSendRehearsal: normalizeMessageSendLiveRehearsalTransportBlockedFixture(),
  });
}
