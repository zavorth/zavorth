import fs from 'fs';
import os from 'os';
import path from 'path';
import { WhatsAppChannelAdapter } from '../../src/channels/adapters/WhatsAppChannelAdapter.js';
import { ChannelPolicyManager } from '../../src/channels/policies/ChannelPolicyManager.js';

describe('WhatsApp group mention filter', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const target = tempDirs.pop();
      if (target && fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
    }
  });

  it('ignores allowed group messages without a bot mention or reply', async () => {
    const { adapter, events } = createAdapter();

    await adapter.onMessageReceived({
      from: '+15559990000',
      chatId: '120363025555555555@g.us',
      text: 'general chatter',
      messageId: 'msg-1',
    });

    expect(events).toEqual([]);
  });

  it('processes allowed group messages that mention a configured bot alias', async () => {
    const { adapter, events } = createAdapter();

    await adapter.onMessageReceived({
      from: '+15559990000',
      chatId: '120363025555555555@g.us',
      text: '@zv summarize this thread',
      messageId: 'msg-2',
      botAliases: ['zavorth', 'zv'],
    });

    expect(events).toHaveLength(1);
    const data = events[0].payload.payload.data;
    expect(data.channelUserIdAllowed).toBe(false);
    expect(data.normalizedInboundMessage.metadata.channelFields.channelUserIdAllowed).toBe(false);
  });

  it('processes replies to the bot and ignores replies to someone else unless mentioned', async () => {
    const { adapter, events } = createAdapter();

    await adapter.onMessageReceived({
      from: '+15559990000',
      chatId: '120363025555555555@g.us',
      text: 'replying to another participant',
      messageId: 'msg-3',
      quotedMessage: { fromMe: false },
    });
    await adapter.onMessageReceived({
      from: '+15559990000',
      chatId: '120363025555555555@g.us',
      text: 'please continue',
      messageId: 'msg-4',
      quotedMessage: { fromMe: true },
    });

    expect(events).toHaveLength(1);
    expect(events[0].payload.payload.data.messageId).toBe('msg-4');
  });
});

function createAdapter(): { adapter: WhatsAppChannelAdapter; events: any[] } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-whatsapp-groups-mention-'));
  const policyFile = path.join(root, 'channel-policies.json');
  fs.writeFileSync(policyFile, `${JSON.stringify({
    version: 1,
    updatedAt: '2026-06-17T00:00:00.000Z',
    policies: {
      whatsapp: {
        channelId: 'whatsapp',
        isOpenAccess: false,
        allowedList: ['120363025555555555@g.us', '+15550001111'],
        blockedList: [],
        updatedAt: '2026-06-17T00:00:00.000Z',
        groupToolPolicy: {
          untrustedUserMode: 'safe-only',
          allowedToolsForUntrustedUsers: [],
        },
      },
    },
  }, null, 2)}\n`);
  const policyManager = new ChannelPolicyManager({ policyFile, cacheWindowMs: 0 });
  const events: any[] = [];
  const adapter = new WhatsAppChannelAdapter(
    { emit: async (event: any) => { events.push(event); } } as any,
    policyManager,
    '',
    {
      outboxDir: path.join(root, 'outbox'),
      now: () => new Date('2026-06-17T00:00:00.000Z'),
      auditLogger: { logChannelAccessDecision: jest.fn() } as any,
    },
  );
  return { adapter, events };
}
