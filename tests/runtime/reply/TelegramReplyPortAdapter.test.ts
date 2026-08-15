import {
  ReplyPipeline,
  TelegramReplyPortAdapter,
} from '../../../src/runtime/reply/index.js';
import type { UniversalAgentRun } from '../../../src/runtime/agent/index.js';

function createRun(input: Partial<UniversalAgentRun> = {}): UniversalAgentRun {
  return {
    id: 'run-telegram-reply',
    traceId: 'trace-telegram-reply',
    requestId: 'request-telegram-reply',
    sessionId: 'telegram-chat-1',
    userId: 'grey',
    channel: 'telegram',
    title: 'Telegram reply test',
    input: 'responda no Telegram',
    workspace: null,
    status: 'completed',
    createdAt: '2026-04-27T11:00:00.000Z',
    updatedAt: '2026-04-27T11:00:00.000Z',
    summary: 'Resposta pronta.',
    events: [],
    toolExposure: {
      mode: 'safe',
      summary: 'Sem ferramentas.',
      tools: [],
    },
    replyPorts: [
      {
        id: 'telegram-primary',
        label: 'Telegram',
        kind: 'telegram',
        status: 'available',
        primary: true,
      },
    ],
    modelProfile: {
      providerLabel: 'Zavorth',
      modelLabel: 'modelo atual',
      routingPolicy: 'gateway',
    },
    approvals: [],
    artifacts: [],
    memorySignals: [],
    metadata: {},
    ...input,
  };
}

describe('TelegramReplyPortAdapter', () => {
  it('delivers Telegram reply packets through a minimal reply sender', async () => {
    const sentTexts: string[] = [];
    const adapter = new TelegramReplyPortAdapter({
      reply: async (text: string) => {
        sentTexts.push(text);
        return { message_id: sentTexts.length };
      },
    });
    const pipeline = new ReplyPipeline();
    const replies = pipeline.buildReplies({
      run: createRun(),
      text: 'Mensagem para Telegram.',
      now: new Date('2026-04-27T11:01:00.000Z'),
    });

    const deliveries = await adapter.sendAll(replies);

    expect(sentTexts).toEqual(['Mensagem para Telegram.']);
    expect(deliveries).toEqual([
      expect.objectContaining({
        sent: true,
        result: { message_id: 1 },
      }),
    ]);
  });

  it('skips packets that are not addressed to Telegram', async () => {
    const sentTexts: string[] = [];
    const adapter = new TelegramReplyPortAdapter({
      reply: (text: string) => {
        sentTexts.push(text);
      },
    });
    const pipeline = new ReplyPipeline();
    const replies = pipeline.buildReplies({
      run: createRun({
        channel: 'web',
        replyPorts: [
          {
            id: 'web-primary',
            label: 'Dashboard',
            kind: 'web',
            status: 'available',
            primary: true,
          },
        ],
      }),
      text: 'Mensagem web.',
      now: new Date('2026-04-27T11:02:00.000Z'),
    });

    const deliveries = await adapter.sendAll(replies);

    expect(sentTexts).toEqual([]);
    expect(deliveries).toEqual([
      expect.objectContaining({
        sent: false,
        skippedReason: 'Port web is not Telegram.',
      }),
    ]);
  });
});
