import type {
  ZavorthCapabilityProviderRegistryStatus,
} from './ZavorthCapabilityProviderRegistryContract.js';

export const ZAVORTH_CHANNEL_MESSAGING_BRIDGE_CONTRACT_VERSION =
  'zavorth-channel-messaging-bridge/5' as const;

export type ZavorthChannelMessagingBridgeStatus =
  | 'channel-messaging-bridge-ready'
  | 'attention'
  | 'blocked';

export type ZavorthChannelKind =
  | 'telegram'
  | 'discord'
  | 'web'
  | 'cli'
  | 'api'
  | 'other';

export type ZavorthChannelTrustLevel =
  | 'untrusted'
  | 'paired'
  | 'trusted'
  | 'owner';

export type ZavorthChannelCredentialKind =
  | 'external-port'
  | 'zavorth-secret-ref'
  | 'none'
  | 'raw-secret';

export type ZavorthChannelDescriptorInput = {
  sourceRuntimeId: string;
  sourceChannelId: string;
  kind: ZavorthChannelKind;
  displayName: string;
  inboundSupported: boolean;
  outboundSupported: boolean;
  credentialKind: ZavorthChannelCredentialKind;
  credentialRef?: string | null;
  pairingRef?: string | null;
  trustHint?: ZavorthChannelTrustLevel;
};

export type ZavorthChannelCredentialIsolationReceipt = {
  channelId: string;
  status: 'isolated' | 'blocked';
  credentialKind: ZavorthChannelCredentialKind;
  portRef: string | null;
  secretRef: string | null;
  rawSecretStored: false;
  reason: string;
  safety: {
    credentialsBehindPorts: true;
    noRawSecretStorage: true;
    noSourceCredentialLeak: true;
  };
};

export type ZavorthChannelPairingTrustReceipt = {
  channelId: string;
  trustPlane: 'ZavorthTrustPlane';
  trustLevel: ZavorthChannelTrustLevel;
  pairingRequired: boolean;
  paired: boolean;
  channelTrustRef: string;
  reason: string;
  safety: {
    sourceIdentityCanonical: false;
    publicIdentityChanged: false;
    trustIsZavorthOwned: true;
  };
};

export type ZavorthNormalizedChannelDescriptor = {
  channelId: string;
  sourceChannelId: string;
  sourceRuntimeId: string;
  sourceRuntimeDiagnosticsOnly: true;
  publicName: 'Zavorth';
  kind: ZavorthChannelKind;
  displayName: string;
  inboundSupported: boolean;
  outboundSupported: boolean;
  credentialIsolation: ZavorthChannelCredentialIsolationReceipt;
  trustMapping: ZavorthChannelPairingTrustReceipt;
};

export type ZavorthInboundChannelMessageInput = {
  sourceRuntimeId: string;
  sourceChannelId: string;
  sourceMessageId: string;
  kind: ZavorthChannelKind;
  senderRef: string;
  senderDisplayName?: string | null;
  text: string;
  threadRef?: string | null;
  receivedAt?: string | null;
  attachments?: Array<{ id: string; kind: string; safeRef: string }>;
  pairingRef?: string | null;
};

export type ZavorthNormalizedInboundMessage = {
  messageId: string;
  channelId: string;
  sessionId: string;
  eventId: string;
  sourceMessageId: string;
  sourceRuntimeId: string;
  sourceRuntimeDiagnosticsOnly: true;
  publicName: 'Zavorth';
  kind: ZavorthChannelKind;
  sender: {
    senderRef: string;
    displayName: string;
    trustLevel: ZavorthChannelTrustLevel;
  };
  text: string;
  attachments: Array<{ id: string; kind: string; safeRef: string }>;
  receivedAt: string;
  gatewayEntrypoint: 'ZavorthAgentGateway';
  directReplyFromSourceAllowed: false;
  safety: {
    normalizedInboundOnly: true;
    noSourceRuntimeCodeExecuted: true;
    noToolExecution: true;
  };
};

export type ZavorthChannelSessionEventReceipt = {
  status: 'mapped' | 'blocked';
  session: {
    sessionId: string;
    channelId: string;
    sourceThreadRef: string;
    continuityOwner: 'Zavorth';
  };
  event: {
    eventId: string;
    messageId: string;
    eventType: 'inbound-message';
    gatewayEntrypoint: 'ZavorthAgentGateway';
  };
  safety: {
    sourceSessionNotCanonical: true;
    continuationThroughGateway: true;
    noMemoryWritePerformed: true;
  };
};

export type ZavorthOutboundReplyInput = {
  channelId: string;
  sessionId: string;
  targetRef: string;
  text: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  approvalGranted?: boolean;
};

export type ZavorthReplyPipelinePacket = {
  replyPacketId: string;
  status: 'queued-for-reply-pipeline' | 'blocked';
  channelId: string;
  sessionId: string;
  targetRef: string;
  textPreview: string;
  replyPipeline: 'ReplyPipeline';
  userFacingOutputExit: 'ZavorthReplyPacket';
  approvalRequired: boolean;
  approvalGranted: boolean;
  directChannelSendAllowed: false;
  liveSendPerformed: false;
  sourceRuntimeSendBypassAllowed: false;
  reason: string;
  safety: {
    replyPacketOnly: true;
    noDirectChannelSend: true;
    noSourceRuntimeSend: true;
    noApprovalBypass: true;
  };
};

export type ZavorthChannelMessagingCommandCenterProjection = {
  title: 'Channel Messaging Bridge';
  status: ZavorthChannelMessagingBridgeStatus;
  tone: 'ready' | 'attention' | 'blocked';
  cards: Array<{
    id: string;
    label: string;
    value: string;
    detail: string;
  }>;
  policyPills: string[];
  nextSafeAction: string;
};

export type ZavorthChannelMessagingBridgeSnapshot = {
  generatedAt: string;
  contractVersion: typeof ZAVORTH_CHANNEL_MESSAGING_BRIDGE_CONTRACT_VERSION;
  status: ZavorthChannelMessagingBridgeStatus;
  planId: '291 - Plano Zavorth External Runtime Absorption';
  phase: 'phase-5-channels-and-messaging';
  previousCapabilityProviderStatus: ZavorthCapabilityProviderRegistryStatus;
  channelDescriptors: ZavorthNormalizedChannelDescriptor[];
  normalizedInboundMessage: ZavorthNormalizedInboundMessage;
  sessionEventReceipt: ZavorthChannelSessionEventReceipt;
  outboundReplyPacket: ZavorthReplyPipelinePacket;
  blockedOutboundReplyPacket: ZavorthReplyPipelinePacket;
  credentialIsolationReceipts: ZavorthChannelCredentialIsolationReceipt[];
  pairingTrustReceipts: ZavorthChannelPairingTrustReceipt[];
  commandCenterProjection: ZavorthChannelMessagingCommandCenterProjection;
  acceptanceMatrix: Array<{
    requirementId: string;
    status: 'passed' | 'failed';
    evidence: string;
  }>;
  summary: {
    normalizedChannels: number;
    inboundMessagesNormalized: number;
    sessionsMapped: number;
    eventsMapped: number;
    replyPacketsBuilt: number;
    blockedRiskyReplyPackets: number;
    credentialsBehindPorts: number;
    rawCredentialsStored: 0;
    trustMappings: number;
    directChannelSends: 0;
    sourceRuntimeCodeExecuted: false;
    liveOutboundSendPerformed: false;
  };
  safety: {
    channelBridgeOnly: true;
    noSourceRuntimeCodeExecuted: true;
    noDirectChannelSend: true;
    noLiveOutboundSend: true;
    noRawCredentialStorage: true;
    noToolExecutionPerformed: true;
    noProviderCallPerformed: true;
    publicIdentityChanged: false;
  };
  commands: {
    inspect: 'npm run zavorth:channel-messaging-bridge';
    inspectJson: 'npm run zavorth:channel-messaging-bridge:json';
    check: 'npm run zavorth:channel-messaging-bridge:check --silent';
    nextPhase: '291 Phase 6 - Sessions, Memory, And Continuation';
  };
};
