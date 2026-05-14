import {
  ChannelCapabilityMatrix,
  MemoryReplyPort,
  ReplyChunker,
  ReplyPipeline,
} from '../../../src/runtime/reply/index.js';
import type { UniversalAgentRun } from '../../../src/runtime/agent/index.js';

function createRun(input: Partial<UniversalAgentRun> = {}): UniversalAgentRun {
  return {
    id: 'run-reply',
    traceId: 'trace-reply',
    requestId: 'request-reply',
    sessionId: 'session-reply',
    userId: 'grey',
    channel: 'web',
    title: 'Reply test',
    input: 'responda',
    workspace: null,
    status: 'completed',
    createdAt: '2026-04-27T10:00:00.000Z',
    updatedAt: '2026-04-27T10:00:00.000Z',
    summary: 'Resposta pronta.',
    events: [],
    toolExposure: {
      mode: 'safe',
      summary: 'Sem ferramentas.',
      tools: [],
    },
    replyPorts: [
      {
        id: 'web-primary',
        label: 'Command Center',
        kind: 'web',
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

describe('Reply runtime primitives', () => {
  it('chunks long replies without exceeding the channel limit', () => {
    const chunker = new ReplyChunker();
    const chunks = chunker.chunk({
      text: 'alpha beta gamma delta',
      maxLength: 10,
    });

    expect(chunks).toHaveLength(3);
    expect(chunks.every((chunk) => chunk.text.length <= 10)).toBe(true);
    expect(chunks.map((chunk) => chunk.index)).toEqual([0, 1, 2]);
    expect(chunks.every((chunk) => chunk.total === 3)).toBe(true);
  });

  it('uses channel capabilities while building reply packets from the existing pipeline', () => {
    const pipeline = new ReplyPipeline({
      channelCapabilities: new ChannelCapabilityMatrix({
        web: {
          maxTextLength: 8,
        },
      }),
    });

    const replies = pipeline.buildReplies({
      run: createRun(),
      text: 'one two three',
      now: new Date('2026-04-27T10:01:00.000Z'),
    });

    expect(replies).toHaveLength(2);
    expect(replies[0]).toEqual(expect.objectContaining({
      id: 'run-reply:reply:1',
      text: 'one two',
      metadata: expect.objectContaining({
        channel: 'web',
        chunkIndex: 0,
        chunkCount: 2,
        traceId: 'trace-reply',
      }),
    }));
    expect(replies[1]).toEqual(expect.objectContaining({
      id: 'run-reply:reply:1:chunk:2',
      text: 'three',
      metadata: expect.objectContaining({
        chunkIndex: 1,
        chunkCount: 2,
      }),
    }));
  });

  it('keeps primary degraded ports as a safe fallback target', () => {
    const pipeline = new ReplyPipeline();
    const replies = pipeline.buildReplies({
      run: createRun({
        replyPorts: [
          {
            id: 'web-primary',
            label: 'Command Center',
            kind: 'web',
            status: 'degraded',
            primary: true,
          },
        ],
      }),
      text: 'fallback',
      now: new Date('2026-04-27T10:02:00.000Z'),
    });

    expect(replies).toHaveLength(1);
    expect(replies[0].port.status).toBe('degraded');
    expect(replies[0].port.primary).toBe(true);
  });

  it('delivers reply packets through a memory reply port for smoke tests', async () => {
    const pipeline = new ReplyPipeline();
    const replies = pipeline.buildReplies({
      run: createRun(),
      text: 'mensagem simples',
      now: new Date('2026-04-27T10:03:00.000Z'),
    });
    const memoryPort = new MemoryReplyPort({
      now: () => new Date('2026-04-27T10:04:00.000Z'),
    });

    await memoryPort.sendAll(replies);

    expect(memoryPort.list()).toEqual([
      expect.objectContaining({
        text: 'mensagem simples',
        deliveredAt: '2026-04-27T10:04:00.000Z',
      }),
    ]);
  });
});
