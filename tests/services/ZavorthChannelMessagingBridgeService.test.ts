import {
  ZAVORTH_CHANNEL_MESSAGING_BRIDGE_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthChannelMessagingBridgeContract.js';
import { ZavorthChannelMessagingBridgeService } from '../../src/services/ZavorthChannelMessagingBridgeService.js';

describe('ZavorthChannelMessagingBridgeService Credential vault', () => {
  it('publishes the channel messaging bridge snapshot after Connector registry readiness', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot).toEqual(expect.objectContaining({
      generatedAt: '2026-05-11T21:35:00.000Z',
      contractVersion: ZAVORTH_CHANNEL_MESSAGING_BRIDGE_CONTRACT_VERSION,
      status: 'channel-messaging-bridge-ready',
      planId: 'Zavorth External Runtime Integration',
      stage: 'checkpoint-5-channels-and-messaging',
      previousCapabilityProviderStatus: 'capability-provider-registry-ready',
    }));
    expect(snapshot.summary).toEqual(expect.objectContaining({
      normalizedChannels: 2,
      inboundMessagesNormalized: 1,
      sessionsMapped: 1,
      eventsMapped: 1,
      replyPacketsBuilt: 1,
      blockedRiskyReplyPackets: 1,
      credentialsBehindPorts: 2,
      rawCredentialsStored: 0,
      trustMappings: 2,
      directChannelSends: 0,
      sourceRuntimeCodeExecuted: false,
      liveOutboundSendPerformed: false,
    }));
    expect(snapshot.commands.nextStage).toBe('291 Runtime gateway - Sessions, Memory, And Continuation');
  });

  it('normalizes channel descriptors without adopting source identity', () => {
    const descriptor = createService().normalizeChannelDescriptor({
      sourceRuntimeId: 'source-runtime-test',
      sourceChannelId: 'telegram-test',
      kind: 'telegram',
      displayName: ' Telegram Test ',
      inboundSupported: true,
      outboundSupported: true,
      credentialKind: 'external-port',
      credentialRef: 'port://telegram-test',
      pairingRef: 'pairing://owner',
      trustHint: 'owner',
    });

    expect(descriptor).toEqual(expect.objectContaining({
      channelId: 'zavorth.channel.telegram.telegram-test',
      sourceChannelId: 'telegram-test',
      sourceRuntimeId: 'source-runtime-test',
      sourceRuntimeDiagnosticsOnly: true,
      publicName: 'Zavorth',
      kind: 'telegram',
      displayName: 'Telegram Test',
      inboundSupported: true,
      outboundSupported: true,
    }));
    expect(descriptor.credentialIsolation).toEqual(expect.objectContaining({
      status: 'isolated',
      portRef: 'port://telegram-test',
      rawSecretStored: false,
    }));
    expect(descriptor.trustMapping).toEqual(expect.objectContaining({
      trustPlane: 'ZavorthTrustPlane',
      trustLevel: 'owner',
      paired: true,
      safety: expect.objectContaining({
        sourceIdentityCanonical: false,
        publicIdentityChanged: false,
        trustIsZavorthOwned: true,
      }),
    }));
  });

  it('blocks raw channel credentials while keeping them out of storage', () => {
    const receipt = createService().isolateCredential({
      channelId: 'zavorth.channel.telegram.raw-test',
      credentialKind: 'raw-secret',
      credentialRef: 'token-should-not-be-stored',
    });

    expect(receipt).toEqual(expect.objectContaining({
      status: 'blocked',
      credentialKind: 'raw-secret',
      portRef: null,
      secretRef: null,
      rawSecretStored: false,
      safety: expect.objectContaining({
        credentialsBehindPorts: true,
        noRawSecretStorage: true,
        noSourceCredentialLeak: true,
      }),
    }));
  });

  it('normalizes inbound messages into gateway-owned session and event ids', () => {
    const message = createService().normalizeInboundMessage({
      sourceRuntimeId: 'source-runtime-test',
      sourceChannelId: 'discord-test',
      sourceMessageId: 'msg-123',
      kind: 'discord',
      senderRef: 'user-123',
      senderDisplayName: 'User 123',
      text: 'me explica o status',
      threadRef: 'thread-123',
      receivedAt: '2026-05-11T21:35:00.000Z',
      attachments: [{ id: 'a1', kind: 'text', safeRef: 'attachment://a1' }],
      pairingRef: 'pairing://user-123',
    });

    expect(message).toEqual(expect.objectContaining({
      messageId: 'zavorth.message.msg-123',
      channelId: 'zavorth.channel.discord.discord-test',
      sessionId: 'zavorth.session.zavorth-channel-discord-discord-test.thread-123',
      eventId: 'zavorth.event.msg-123',
      sourceRuntimeDiagnosticsOnly: true,
      publicName: 'Zavorth',
      gatewayEntrypoint: 'ZavorthAgentGateway',
      directReplyFromSourceAllowed: false,
      safety: expect.objectContaining({
        normalizedInboundOnly: true,
        noSourceRuntimeCodeExecuted: true,
        noToolExecution: true,
      }),
    }));
    expect(message.sender).toEqual(expect.objectContaining({
      senderRef: 'user-123',
      displayName: 'User 123',
      trustLevel: 'paired',
    }));
  });

  it('maps inbound messages to Zavorth session and event receipts', () => {
    const service = createService();
    const message = service.normalizeInboundMessage({
      sourceRuntimeId: 'source-runtime-test',
      sourceChannelId: 'telegram-test',
      sourceMessageId: 'msg-map',
      kind: 'telegram',
      senderRef: 'operator',
      text: 'continue',
      threadRef: 'thread-map',
    });
    const receipt = service.mapMessageToSessionEvent(message);

    expect(receipt).toEqual(expect.objectContaining({
      status: 'mapped',
      session: expect.objectContaining({
        sessionId: message.sessionId,
        channelId: message.channelId,
        continuityOwner: 'Zavorth',
      }),
      event: expect.objectContaining({
        eventId: message.eventId,
        messageId: message.messageId,
        eventType: 'inbound-message',
        gatewayEntrypoint: 'ZavorthAgentGateway',
      }),
      safety: expect.objectContaining({
        sourceSessionNotCanonical: true,
        continuationThroughGateway: true,
        noMemoryWritePerformed: true,
      }),
    }));
  });

  it('builds outbound replies only as ReplyPipeline packets', () => {
    const packet = createService().buildOutboundReplyPacket({
      channelId: 'zavorth.channel.telegram.main',
      sessionId: 'zavorth.session.main',
      targetRef: 'operator',
      text: 'Resposta pronta',
      risk: 'low',
    });

    expect(packet).toEqual(expect.objectContaining({
      status: 'queued-for-reply-pipeline',
      replyPipeline: 'ReplyPipeline',
      userFacingOutputExit: 'ZavorthReplyPacket',
      approvalRequired: false,
      approvalGranted: false,
      directChannelSendAllowed: false,
      liveSendPerformed: false,
      sourceRuntimeSendBypassAllowed: false,
      safety: expect.objectContaining({
        replyPacketOnly: true,
        noDirectChannelSend: true,
        noSourceRuntimeSend: true,
        noApprovalBypass: true,
      }),
    }));
  });

  it('blocks risky outbound reply packets without approval', () => {
    const packet = createService().buildOutboundReplyPacket({
      channelId: 'zavorth.channel.telegram.main',
      sessionId: 'zavorth.session.main',
      targetRef: 'operator',
      text: 'Mensagem arriscada',
      risk: 'high',
      approvalGranted: false,
    });

    expect(packet).toEqual(expect.objectContaining({
      status: 'blocked',
      approvalRequired: true,
      approvalGranted: false,
      directChannelSendAllowed: false,
      liveSendPerformed: false,
      sourceRuntimeSendBypassAllowed: false,
      reason: expect.stringContaining('blocked'),
    }));
  });

  it('projects channel messaging state for Dashboard', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot.dashboardProjection).toEqual(expect.objectContaining({
      title: 'Channel Messaging Bridge',
      status: 'channel-messaging-bridge-ready',
      tone: 'ready',
      policyPills: expect.arrayContaining([
        'NormalizedInboundMessage',
        'ZavorthAgentGateway inbound',
        'ReplyPipeline outbound',
        'credential isolation',
        'ZavorthTrustPlane',
        'no direct channel send',
      ]),
      nextSafeAction: 'Proceed to 291 Runtime gateway - Sessions, Memory, And Continuation.',
    }));
    expect(snapshot.dashboardProjection.cards.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'channels',
      'inbound',
      'reply-pipeline',
      'blocked-risk',
      'credentials',
      'trust',
      'direct-send',
    ]));
  });

  it('blocks Credential vault if Connector registry capability providers are not ready', () => {
    const snapshot = createService().buildSnapshot({ capabilityProviderStatus: 'blocked' });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.previousCapabilityProviderStatus).toBe('blocked');
    expect(snapshot.acceptanceMatrix.find((entry) => entry.requirementId === 'capability-providers-ready')).toEqual(expect.objectContaining({
      status: 'failed',
    }));
  });

  it('formats an operator summary for the channel messaging pack', () => {
    const service = createService();
    const text = service.formatSnapshotText(service.buildSnapshot());

    expect(text).toContain('Zavorth Channel Messaging Bridge - Credential vault');
    expect(text).toContain('Status: channel-messaging-bridge-ready');
    expect(text).toContain('Reply packets built: 1');
    expect(text).toContain('Raw credentials stored: 0');
    expect(text).toContain('Direct channel sends: 0');
    expect(text).toContain('Next: 291 Runtime gateway - Sessions, Memory, And Continuation');
  });
});

function createService(): ZavorthChannelMessagingBridgeService {
  return new ZavorthChannelMessagingBridgeService({
    now: () => new Date('2026-05-11T21:35:00.000Z'),
    capabilityProviderStatus: 'capability-provider-registry-ready',
  });
}
