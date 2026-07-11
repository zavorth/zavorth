import {
  ZAVORTH_CHANNEL_MESSAGING_BRIDGE_CONTRACT_VERSION,
  type ZavorthChannelCredentialIsolationReceipt,
  type ZavorthChannelDescriptorInput,
  type ZavorthChannelMessagingBridgeSnapshot,
  type ZavorthChannelMessagingBridgeStatus,
  type ZavorthChannelMessagingZavorthControlProjection,
  type ZavorthChannelPairingTrustReceipt,
  type ZavorthInboundChannelMessageInput,
  type ZavorthNormalizedChannelDescriptor,
  type ZavorthNormalizedInboundMessage,
  type ZavorthOutboundReplyInput,
  type ZavorthReplyPipelinePacket,
  type ZavorthChannelSessionEventReceipt,
  type ZavorthChannelTrustLevel,
} from '../contracts/ZavorthChannelMessagingBridgeContract.js';
import type {
  ZavorthCapabilityProviderRegistryStatus,
} from '../contracts/ZavorthCapabilityProviderRegistryContract.js';

type Runtime = {
  now?: () => Date;
  capabilityProviderStatus?: ZavorthCapabilityProviderRegistryStatus;
};

type SnapshotInput = {
  capabilityProviderStatus?: ZavorthCapabilityProviderRegistryStatus | null;
};

const DEFAULT_CHANNELS: ZavorthChannelDescriptorInput[] = [
  {
    sourceRuntimeId: 'reference-runtime-a',
    sourceChannelId: 'telegram-main',
    kind: 'telegram',
    displayName: 'Telegram main',
    inboundSupported: true,
    outboundSupported: true,
    credentialKind: 'external-port',
    credentialRef: 'port://telegram-main',
    pairingRef: 'pairing://owner-device',
    trustHint: 'owner',
  },
  {
    sourceRuntimeId: 'reference-runtime-b',
    sourceChannelId: 'discord-ops',
    kind: 'discord',
    displayName: 'Discord ops',
    inboundSupported: true,
    outboundSupported: true,
    credentialKind: 'zavorth-secret-ref',
    credentialRef: 'secret://channels/discord-ops',
    pairingRef: 'pairing://ops-team',
    trustHint: 'paired',
  },
];

export class ZavorthChannelMessagingBridgeService {
  private readonly now: () => Date;
  private readonly defaultCapabilityProviderStatus: ZavorthCapabilityProviderRegistryStatus;

  constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.defaultCapabilityProviderStatus = runtime.capabilityProviderStatus || 'capability-provider-registry-ready';
  }

  public buildSnapshot(input: SnapshotInput = {}): ZavorthChannelMessagingBridgeSnapshot {
    const previousCapabilityProviderStatus = input.capabilityProviderStatus || this.defaultCapabilityProviderStatus;
    const channelDescriptors = DEFAULT_CHANNELS.map((channel) => this.normalizeChannelDescriptor(channel));
    const normalizedInboundMessage = this.normalizeInboundMessage({
      sourceRuntimeId: 'reference-runtime-a',
      sourceChannelId: 'telegram-main',
      sourceMessageId: 'msg-fixture-001',
      kind: 'telegram',
      senderRef: 'operator-fixture',
      senderDisplayName: 'Operator fixture',
      text: 'continue a etapa de canais pelo gateway',
      threadRef: 'thread-fixture-001',
      receivedAt: this.now().toISOString(),
      attachments: [{ id: 'att-fixture-001', kind: 'text', safeRef: 'attachment://att-fixture-001' }],
      pairingRef: 'pairing://owner-device',
    });
    const sessionEventReceipt = this.mapMessageToSessionEvent(normalizedInboundMessage);
    const outboundReplyPacket = this.buildOutboundReplyPacket({
      channelId: normalizedInboundMessage.channelId,
      sessionId: normalizedInboundMessage.sessionId,
      targetRef: normalizedInboundMessage.sender.senderRef,
      text: 'Resposta pronta para sair somente como ZavorthReplyPacket.',
      risk: 'low',
    });
    const blockedOutboundReplyPacket = this.buildOutboundReplyPacket({
      channelId: normalizedInboundMessage.channelId,
      sessionId: normalizedInboundMessage.sessionId,
      targetRef: normalizedInboundMessage.sender.senderRef,
      text: 'Enviar acao arriscada sem approval.',
      risk: 'high',
      approvalGranted: false,
    });
    const credentialIsolationReceipts = channelDescriptors.map((entry) => entry.credentialIsolation);
    const pairingTrustReceipts = channelDescriptors.map((entry) => entry.trustMapping);
    const acceptanceMatrix = buildAcceptanceMatrix(
      previousCapabilityProviderStatus,
      channelDescriptors,
      normalizedInboundMessage,
      sessionEventReceipt,
      outboundReplyPacket,
      blockedOutboundReplyPacket,
      credentialIsolationReceipts,
      pairingTrustReceipts,
    );
    const status = resolveStatus(previousCapabilityProviderStatus, acceptanceMatrix);
    const zavorthControlProjection = this.buildZavorthControlProjection({
      status,
      channelDescriptors,
      sessionEventReceipt,
      outboundReplyPacket,
      blockedOutboundReplyPacket,
      credentialIsolationReceipts,
      pairingTrustReceipts,
    });

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_CHANNEL_MESSAGING_BRIDGE_CONTRACT_VERSION,
      status,
      planId: 'Zavorth External Runtime Integration',
      gate: 'channels-and-messaging',
      previousCapabilityProviderStatus,
      channelDescriptors,
      normalizedInboundMessage,
      sessionEventReceipt,
      outboundReplyPacket,
      blockedOutboundReplyPacket,
      credentialIsolationReceipts,
      pairingTrustReceipts,
      zavorthControlProjection,
      acceptanceMatrix,
      summary: {
        normalizedChannels: channelDescriptors.length,
        inboundMessagesNormalized: normalizedInboundMessage.gatewayEntrypoint === 'ZavorthAgentGateway' ? 1 : 0,
        sessionsMapped: sessionEventReceipt.status === 'mapped' ? 1 : 0,
        eventsMapped: sessionEventReceipt.status === 'mapped' ? 1 : 0,
        replyPacketsBuilt: outboundReplyPacket.status === 'queued-for-reply-pipeline' ? 1 : 0,
        blockedRiskyReplyPackets: blockedOutboundReplyPacket.status === 'blocked' ? 1 : 0,
        credentialsBehindPorts: credentialIsolationReceipts.filter((entry) => entry.status === 'isolated').length,
        rawCredentialsStored: 0,
        trustMappings: pairingTrustReceipts.length,
        directChannelSends: 0,
        sourceRuntimeCodeExecuted: false,
        liveOutboundSendPerformed: false,
      },
      safety: {
        channelBridgeOnly: true,
        noSourceRuntimeCodeExecuted: true,
        noDirectChannelSend: true,
        noLiveOutboundSend: true,
        noRawCredentialStorage: true,
        noToolExecutionPerformed: true,
        noProviderCallPerformed: true,
        publicIdentityChanged: false,
      },
      commands: {
        inspect: 'npm run zavorth:channel-messaging-bridge',
        inspectJson: 'npm run zavorth:channel-messaging-bridge:json',
        check: 'npm run zavorth:channel-messaging-bridge:check --silent',
        nextStage: '291 Runtime gateway - Sessions, Memory, And Continuation',
      },
    };
  }

  public normalizeChannelDescriptor(input: ZavorthChannelDescriptorInput): ZavorthNormalizedChannelDescriptor {
    const normalizedChannelId = buildChannelId(input.kind, input.sourceChannelId);
    const credentialIsolation = this.isolateCredential({
      channelId: normalizedChannelId,
      credentialKind: input.credentialKind,
      credentialRef: input.credentialRef || null,
    });
    const trustMapping = this.mapPairingTrust({
      channelId: normalizedChannelId,
      pairingRef: input.pairingRef || null,
      trustHint: input.trustHint || 'untrusted',
    });

    return {
      channelId: normalizedChannelId,
      sourceChannelId: input.sourceChannelId,
      sourceRuntimeId: input.sourceRuntimeId,
      sourceRuntimeDiagnosticsOnly: true,
      publicName: 'Zavorth',
      kind: input.kind,
      displayName: input.displayName.trim() || input.kind,
      inboundSupported: input.inboundSupported,
      outboundSupported: input.outboundSupported,
      credentialIsolation,
      trustMapping,
    };
  }

  public isolateCredential(input: {
    channelId: string;
    credentialKind: ZavorthChannelDescriptorInput['credentialKind'];
    credentialRef: string | null;
  }): ZavorthChannelCredentialIsolationReceipt {
    if (input.credentialKind === 'raw-secret') {
      return {
        channelId: input.channelId,
        status: 'blocked',
        credentialKind: input.credentialKind,
        portRef: null,
        secretRef: null,
        rawSecretStored: false,
        reason: 'Raw channel credential was rejected; use an external port or Zavorth secret reference.',
        safety: credentialSafety(),
      };
    }

    const safeRef = input.credentialRef && input.credentialRef.trim()
      ? input.credentialRef.trim()
      : null;
    return {
      channelId: input.channelId,
      status: 'isolated',
      credentialKind: input.credentialKind,
      portRef: input.credentialKind === 'external-port'
        ? safeRef || `port://${input.channelId}`
        : input.credentialKind === 'none'
          ? null
          : `port://${input.channelId}`,
      secretRef: input.credentialKind === 'zavorth-secret-ref' ? safeRef || `secret://${input.channelId}` : null,
      rawSecretStored: false,
      reason: input.credentialKind === 'none'
        ? 'Channel has no credential requirement.'
        : 'Channel credential is isolated behind a Zavorth-owned port or secret reference.',
      safety: credentialSafety(),
    };
  }

  public mapPairingTrust(input: {
    channelId: string;
    pairingRef: string | null;
    trustHint: ZavorthChannelTrustLevel;
  }): ZavorthChannelPairingTrustReceipt {
    const paired = !!(input.pairingRef && input.pairingRef.trim());
    const trustLevel = paired ? input.trustHint : 'untrusted';
    return {
      channelId: input.channelId,
      trustPlane: 'ZavorthTrustPlane',
      trustLevel,
      pairingRequired: trustLevel !== 'owner',
      paired,
      channelTrustRef: `zavorth.trust.${safeId(input.channelId)}.${safeId(trustLevel)}`,
      reason: paired
        ? 'Source pairing reference was mapped into the Zavorth trust plane.'
        : 'No pairing reference was provided; channel remains untrusted.',
      safety: {
        sourceIdentityCanonical: false,
        publicIdentityChanged: false,
        trustIsZavorthOwned: true,
      },
    };
  }

  public normalizeInboundMessage(input: ZavorthInboundChannelMessageInput): ZavorthNormalizedInboundMessage {
    const channel = buildChannelId(input.kind, input.sourceChannelId);
    const threadRef = input.threadRef && input.threadRef.trim()
      ? input.threadRef.trim()
      : input.senderRef;
    const trust = this.mapPairingTrust({
      channelId: channel,
      pairingRef: input.pairingRef || null,
      trustHint: input.pairingRef ? 'paired' : 'untrusted',
    });
    const messageId = `zavorth.message.${safeId(input.sourceMessageId)}`;
    const sessionId = `zavorth.session.${safeId(channel)}.${safeId(threadRef)}`;
    const eventId = `zavorth.event.${safeId(input.sourceMessageId)}`;

    return {
      messageId,
      channelId: channel,
      sessionId,
      eventId,
      sourceMessageId: input.sourceMessageId,
      sourceRuntimeId: input.sourceRuntimeId,
      sourceRuntimeDiagnosticsOnly: true,
      publicName: 'Zavorth',
      kind: input.kind,
      sender: {
        senderRef: input.senderRef,
        displayName: input.senderDisplayName?.trim() || 'Unknown sender',
        trustLevel: trust.trustLevel,
      },
      text: input.text.trim(),
      attachments: input.attachments || [],
      receivedAt: input.receivedAt || this.now().toISOString(),
      gatewayEntrypoint: 'ZavorthAgentGateway',
      directReplyFromSourceAllowed: false,
      safety: {
        normalizedInboundOnly: true,
        noSourceRuntimeCodeExecuted: true,
        noToolExecution: true,
      },
    };
  }

  public mapMessageToSessionEvent(
    message: ZavorthNormalizedInboundMessage,
  ): ZavorthChannelSessionEventReceipt {
    if (!message.text || !message.channelId || !message.sessionId || !message.eventId) {
      return {
        status: 'blocked',
        session: {
          sessionId: message.sessionId || 'zavorth.session.blocked',
          channelId: message.channelId || 'zavorth.channel.blocked',
          sourceThreadRef: 'blocked',
          continuityOwner: 'Zavorth',
        },
        event: {
          eventId: message.eventId || 'zavorth.event.blocked',
          messageId: message.messageId || 'zavorth.message.blocked',
          eventType: 'inbound-message',
          gatewayEntrypoint: 'ZavorthAgentGateway',
        },
        safety: sessionEventSafety(),
      };
    }

    return {
      status: 'mapped',
      session: {
        sessionId: message.sessionId,
        channelId: message.channelId,
        sourceThreadRef: message.sourceMessageId,
        continuityOwner: 'Zavorth',
      },
      event: {
        eventId: message.eventId,
        messageId: message.messageId,
        eventType: 'inbound-message',
        gatewayEntrypoint: 'ZavorthAgentGateway',
      },
      safety: sessionEventSafety(),
    };
  }

  public buildOutboundReplyPacket(input: ZavorthOutboundReplyInput): ZavorthReplyPipelinePacket {
    const approvalRequired = input.risk === 'high' || input.risk === 'critical';
    const approvalGranted = input.approvalGranted === true;
    const blocked = approvalRequired && !approvalGranted;

    return {
      replyPacketId: `zavorth.reply.${safeId(input.channelId)}.${safeId(input.sessionId)}`,
      status: blocked ? 'blocked' : 'queued-for-reply-pipeline',
      channelId: input.channelId,
      sessionId: input.sessionId,
      targetRef: input.targetRef,
      textPreview: input.text.trim().slice(0, 160),
      replyPipeline: 'ReplyPipeline',
      userFacingOutputExit: 'ZavorthReplyPacket',
      approvalRequired,
      approvalGranted,
      directChannelSendAllowed: false,
      liveSendPerformed: false,
      sourceRuntimeSendBypassAllowed: false,
      reason: blocked
        ? 'Sensitive outbound is held until a Zavorth approval envelope is granted.'
        : 'Conversational reply can flow through ReplyPipeline; approvals appear only if risk rises.',
      safety: {
        replyPacketOnly: true,
        noDirectChannelSend: true,
        noSourceRuntimeSend: true,
        noApprovalBypass: true,
      },
    };
  }

  public buildZavorthControlProjection(input: {
    status: ZavorthChannelMessagingBridgeStatus;
    channelDescriptors: ZavorthNormalizedChannelDescriptor[];
    sessionEventReceipt: ZavorthChannelSessionEventReceipt;
    outboundReplyPacket: ZavorthReplyPipelinePacket;
    blockedOutboundReplyPacket: ZavorthReplyPipelinePacket;
    credentialIsolationReceipts: ZavorthChannelCredentialIsolationReceipt[];
    pairingTrustReceipts: ZavorthChannelPairingTrustReceipt[];
  }): ZavorthChannelMessagingZavorthControlProjection {
    return {
      title: 'Channel Messaging Bridge',
      status: input.status,
      tone: input.status === 'channel-messaging-bridge-ready' ? 'ready' : input.status === 'attention' ? 'attention' : 'blocked',
      cards: [
        card('channels', 'Channels', String(input.channelDescriptors.length), 'Available ways to talk to Zavorth'),
        card('inbound', 'Inbound', input.sessionEventReceipt.status, 'Messages become normal Zavorth session events'),
        card('reply-pipeline', 'Reply pipeline', input.outboundReplyPacket.status, 'Conversation flows through the shared reply pipeline'),
        card('blocked-risk', 'Sensitive outbound', input.blockedOutboundReplyPacket.status, 'Only risky sends wait for approval'),
        card('credentials', 'Credentials', String(input.credentialIsolationReceipts.filter((entry) => entry.status === 'isolated').length), 'Secrets stay behind protected references'),
        card('trust', 'Trust', String(input.pairingTrustReceipts.length), 'Pairings map to the same trust rules'),
        card('direct-send', 'Bypasses', '0', 'No channel can bypass Zavorth policy'),
      ],
      policyPills: [
        'conversational by default',
        'approval only on risk',
        'shared reply pipeline',
        'credential isolation',
        'ZavorthTrustPlane',
        'no channel bypass',
      ],
      nextSafeAction: input.status === 'channel-messaging-bridge-ready'
        ? 'Use channels naturally; Zavorth only interrupts for sensitive outbound actions.'
        : 'Fix failed channel gates before using remote chat.',
    };
  }

  public formatSnapshotText(snapshot: ZavorthChannelMessagingBridgeSnapshot): string {
    const lines = [
      'Zavorth Channel Messaging Bridge - Conversational guardrails',
      '',
      `Status: ${snapshot.status}`,
      `Previous capability providers: ${snapshot.previousCapabilityProviderStatus}`,
      `Channels normalized: ${snapshot.summary.normalizedChannels}`,
      `Inbound messages normalized: ${snapshot.summary.inboundMessagesNormalized}`,
      `Sessions mapped: ${snapshot.summary.sessionsMapped}`,
      `Events mapped: ${snapshot.summary.eventsMapped}`,
      `Reply packets built: ${snapshot.summary.replyPacketsBuilt}`,
      `Risky reply packets blocked: ${snapshot.summary.blockedRiskyReplyPackets}`,
      `Credentials behind ports: ${snapshot.summary.credentialsBehindPorts}`,
      `Raw credentials stored: ${snapshot.summary.rawCredentialsStored}`,
      `Direct channel sends: ${snapshot.summary.directChannelSends}`,
      '',
      'ZavorthControl:',
      ...snapshot.zavorthControlProjection.cards.map((entry) => `- ${entry.label}: ${entry.value} (${entry.detail})`),
      '',
      'Acceptance:',
      ...snapshot.acceptanceMatrix.map((entry) => `- ${entry.status} ${entry.requirementId}: ${entry.evidence}`),
      '',
      `Next: ${snapshot.commands.nextStage}`,
    ];
    return lines.join('\n');
  }
}

function buildAcceptanceMatrix(
  previousCapabilityProviderStatus: ZavorthCapabilityProviderRegistryStatus,
  channelDescriptors: ZavorthNormalizedChannelDescriptor[],
  normalizedInboundMessage: ZavorthNormalizedInboundMessage,
  sessionEventReceipt: ZavorthChannelSessionEventReceipt,
  outboundReplyPacket: ZavorthReplyPipelinePacket,
  blockedOutboundReplyPacket: ZavorthReplyPipelinePacket,
  credentialIsolationReceipts: ZavorthChannelCredentialIsolationReceipt[],
  pairingTrustReceipts: ZavorthChannelPairingTrustReceipt[],
): ZavorthChannelMessagingBridgeSnapshot['acceptanceMatrix'] {
  const rawCredentialCount = credentialIsolationReceipts.filter((entry) => entry.rawSecretStored).length;
  const directSendCount = [outboundReplyPacket, blockedOutboundReplyPacket]
    .filter((entry) => entry.directChannelSendAllowed || entry.liveSendPerformed || entry.sourceRuntimeSendBypassAllowed).length;

  return [
    acceptance('capability-providers-ready', previousCapabilityProviderStatus === 'capability-provider-registry-ready', `previousCapabilityProviderStatus=${previousCapabilityProviderStatus}`),
    acceptance('channel-descriptors-normalized', channelDescriptors.length >= 2
      && channelDescriptors.every((entry) => entry.channelId.startsWith('zavorth.channel.') && entry.publicName === 'Zavorth' && entry.sourceRuntimeDiagnosticsOnly), `${channelDescriptors.length} channel descriptor(s)`),
    acceptance('inbound-message-normalized-for-gateway', normalizedInboundMessage.gatewayEntrypoint === 'ZavorthAgentGateway'
      && normalizedInboundMessage.directReplyFromSourceAllowed === false
      && normalizedInboundMessage.safety.normalizedInboundOnly, `${normalizedInboundMessage.messageId} -> ${normalizedInboundMessage.gatewayEntrypoint}`),
    acceptance('external-channel-event-becomes-zavorth-session-event', sessionEventReceipt.status === 'mapped'
      && sessionEventReceipt.session.continuityOwner === 'Zavorth'
      && sessionEventReceipt.event.gatewayEntrypoint === 'ZavorthAgentGateway', `${sessionEventReceipt.session.sessionId}/${sessionEventReceipt.event.eventId}`),
    acceptance('outbound-reply-exits-through-reply-pipeline', outboundReplyPacket.status === 'queued-for-reply-pipeline'
      && outboundReplyPacket.replyPipeline === 'ReplyPipeline'
      && outboundReplyPacket.userFacingOutputExit === 'ZavorthReplyPacket'
      && outboundReplyPacket.directChannelSendAllowed === false
      && outboundReplyPacket.liveSendPerformed === false, `${outboundReplyPacket.replyPacketId}, liveSend=${outboundReplyPacket.liveSendPerformed}`),
    acceptance('risky-outbound-blocks-without-approval', blockedOutboundReplyPacket.status === 'blocked'
      && blockedOutboundReplyPacket.approvalRequired
      && !blockedOutboundReplyPacket.approvalGranted
      && blockedOutboundReplyPacket.safety.noApprovalBypass, `${blockedOutboundReplyPacket.status}, approvalRequired=${blockedOutboundReplyPacket.approvalRequired}`),
    acceptance('source-credentials-stay-behind-ports', credentialIsolationReceipts.length >= 2
      && credentialIsolationReceipts.every((entry) => entry.status === 'isolated' && entry.safety.credentialsBehindPorts && entry.safety.noRawSecretStorage)
      && rawCredentialCount === 0, `${credentialIsolationReceipts.length} credential isolation receipt(s), raw=${rawCredentialCount}`),
    acceptance('pairing-mapped-to-zavorth-trust-plane', pairingTrustReceipts.length >= 2
      && pairingTrustReceipts.every((entry) => entry.trustPlane === 'ZavorthTrustPlane' && entry.safety.trustIsZavorthOwned && !entry.safety.sourceIdentityCanonical), `${pairingTrustReceipts.length} trust mapping(s)`),
    acceptance('no-direct-channel-or-source-runtime-send', directSendCount === 0, `${directSendCount} direct send(s)`),
  ];
}

function acceptance(
  requirementId: string,
  passed: boolean,
  evidence: string,
): ZavorthChannelMessagingBridgeSnapshot['acceptanceMatrix'][number] {
  return {
    requirementId,
    status: passed ? 'passed' : 'failed',
    evidence,
  };
}

function resolveStatus(
  previousCapabilityProviderStatus: ZavorthCapabilityProviderRegistryStatus,
  acceptanceMatrix: ZavorthChannelMessagingBridgeSnapshot['acceptanceMatrix'],
): ZavorthChannelMessagingBridgeStatus {
  if (previousCapabilityProviderStatus !== 'capability-provider-registry-ready') {
    return 'blocked';
  }
  if (acceptanceMatrix.some((entry) => entry.status === 'failed')) {
    return 'blocked';
  }
  return 'channel-messaging-bridge-ready';
}

function credentialSafety(): ZavorthChannelCredentialIsolationReceipt['safety'] {
  return {
    credentialsBehindPorts: true,
    noRawSecretStorage: true,
    noSourceCredentialLeak: true,
  };
}

function sessionEventSafety(): ZavorthChannelSessionEventReceipt['safety'] {
  return {
    sourceSessionNotCanonical: true,
    continuationThroughGateway: true,
    noMemoryWritePerformed: true,
  };
}

function buildChannelId(kind: string, sourceChannelId: string): string {
  return `zavorth.channel.${safeId(kind)}.${safeId(sourceChannelId)}`;
}

function safeId(value: string): string {
  const clean = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return clean || 'item';
}

function card(
  id: string,
  label: string,
  value: string,
  detail: string,
): ZavorthChannelMessagingZavorthControlProjection['cards'][number] {
  return { id, label, value, detail };
}
