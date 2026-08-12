import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  buildInboundChannelEvent,
  buildNormalizedInboundMessageFromChannelMessage,
  buildOutboundChannelEnvelope,
  persistChannelOutboxEnvelope,
} from '../../src/channels/contracts/ChannelMessageContract.js';
import { ZavorthAgentGateway } from '../../src/runtime/agent/index.js';

describe('ChannelMessageContract', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('builds canonical inbound events for channel adapters', () => {
    const event = buildInboundChannelEvent({
      platform: 'slack',
      userId: 'U123',
      chatId: 'C-ops',
      rawText: 'deploy approved',
      messageId: '171234.0001',
      now: new Date('2026-04-13T15:00:00.000Z'),
      fields: {
        channelId: 'C-ops',
        threadTs: '171200.0001',
      },
    });

    expect(event).toEqual({
      type: 'public_ws',
      payload: {
        id: 'slack-171234.0001',
        type: 'event',
        payload: {
          topic: 'im_message',
          data: {
            platform: 'slack',
            userId: 'U123',
            chatId: 'C-ops',
            rawText: 'deploy approved',
            messageId: '171234.0001',
            receivedAt: '2026-04-13T15:00:00.000Z',
            channelId: 'C-ops',
            threadTs: '171200.0001',
            normalizedInboundMessage: expect.objectContaining({
              requestId: 'slack:171234.0001',
              userId: 'U123',
              sessionId: 'slack:C-ops',
              channel: 'api',
              text: 'deploy approved',
              replyPort: expect.objectContaining({
                id: 'slack:C-ops:channel-mesh',
                kind: 'api',
              }),
              metadata: expect.objectContaining({
                source: 'channel-mesh',
                platform: 'slack',
                channelPlatform: 'slack',
                channelUserId: 'U123',
                chatId: 'C-ops',
                messageId: '171234.0001',
                normalizedInboundMessage: true,
                canonicalChannelInboundMessage: true,
                channelFields: expect.objectContaining({
                  channelId: 'C-ops',
                  threadTs: '171200.0001',
                }),
              }),
            }),
          },
        },
      },
    });
  });

  it('builds a NormalizedInboundMessage that can enter ZavorthAgentGateway', async () => {
    const normalized = buildNormalizedInboundMessageFromChannelMessage({
      platform: 'whatsapp',
      userId: '+5511999999999',
      chatId: '+5511999999999',
      rawText: 'resuma o status',
      messageId: 'wamid-1',
      receivedAt: '2026-04-13T15:02:00.000Z',
    });
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-13T15:02:01.000Z'),
      idFactory: (prefix) => `${prefix}-channel-test`,
      executor: async ({ request }) => ({
        replyText: `Gateway recebeu ${request.metadata?.platform}: ${request.text}`,
        summary: 'Canal nao-Telegram normalizado pelo Channel Mesh.',
      }),
    });

    const result = await gateway.handle(normalized);

    expect(normalized).toEqual(expect.objectContaining({
      userId: '+5511999999999',
      sessionId: 'whatsapp:+5511999999999',
      channel: 'api',
      text: 'resuma o status',
      metadata: expect.objectContaining({
        source: 'channel-mesh',
        platform: 'whatsapp',
        normalizedInboundMessage: true,
      }),
    }));
    expect(result.run).toEqual(expect.objectContaining({
      channel: 'api',
      sessionId: 'whatsapp:+5511999999999',
      input: 'resuma o status',
      summary: 'Canal nao-Telegram normalizado pelo Channel Mesh.',
    }));
    expect(result.replies[0].text).toContain('Gateway recebeu whatsapp');
  });

  it('builds and persists canonical outbound envelopes for channel adapters', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-channel-contract-'));
    tempDirs.push(root);
    const envelope = buildOutboundChannelEnvelope({
      platform: 'whatsapp',
      transport: 'cloud-api-configured',
      recipients: ['+5511999999999', '+5511999999999'],
      message: 'agente online',
      payload: { chatId: '+5511999999999' },
      now: new Date('2026-04-13T15:01:00.000Z'),
      fields: {
        chatId: '+5511999999999',
        messageId: 'wamid-1',
      },
    });

    const targetFile = persistChannelOutboxEnvelope(root, envelope);
    const persisted = JSON.parse(fs.readFileSync(targetFile, 'utf8'));

    expect(envelope).toEqual(expect.objectContaining({
      platform: 'whatsapp',
      transport: 'cloud-api-configured',
      recipients: ['+5511999999999'],
      message: 'agente online',
      chatId: '+5511999999999',
      messageId: 'wamid-1',
    }));
    expect(persisted).toEqual(envelope);
  });
});
