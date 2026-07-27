import { ReplyPipeline, MemoryReplyPort } from '../../../src/runtime/reply/index.js';
import type {
  UniversalAgentRun,
  UniversalReplyPort,
} from '../../../src/runtime/agent/index.js';

function createRun(replyPorts: UniversalReplyPort[]): UniversalAgentRun {
  return {
    id: 'run-reply-surface',
    traceId: 'trace-reply-surface',
    requestId: 'request-reply-surface',
    sessionId: 'session-reply-surface',
    userId: 'grey',
    channel: 'web',
    title: 'Reply conformance',
    input: 'confirm output',
    workspace: null,
    status: 'completed',
    createdAt: '2026-04-27T16:40:00.000Z',
    updatedAt: '2026-04-27T16:40:00.000Z',
    summary: 'Saida pronta.',
    events: [],
    toolExposure: {
      mode: 'safe',
      summary: 'Sem tools.',
      tools: [],
    },
    replyPorts,
    modelProfile: {
      providerLabel: 'Zavorth',
      modelLabel: 'modelo atual',
      routingPolicy: 'gateway',
    },
    approvals: [],
    artifacts: [],
    memorySignals: [],
    metadata: {},
  };
}

describe('ReplyPipeline surface conformance', () => {
  it('emits traceable reply packets for web, Telegram, API and CLI ports', () => {
    const ports: UniversalReplyPort[] = [
      { id: 'web-control', label: 'Dashboard', kind: 'web', status: 'available', primary: true },
      { id: 'telegram-main', label: 'Telegram', kind: 'telegram', status: 'available' },
      { id: 'api-client', label: 'API client', kind: 'api', status: 'available' },
      { id: 'cli-terminal', label: 'Terminal', kind: 'cli', status: 'available' },
    ];
    const pipeline = new ReplyPipeline();

    const replies = pipeline.buildReplies({
      run: createRun(ports),
      text: 'Zavorth-native response for every surface.',
      now: new Date('2026-04-27T16:41:00.000Z'),
    });

    expect(replies.map((reply) => reply.port.kind)).toEqual(['web', 'telegram', 'api', 'cli']);
    expect(replies.every((reply) => reply.runId === 'run-reply-surface')).toBe(true);
    expect(replies.every((reply) => reply.metadata?.traceId === 'trace-reply-surface')).toBe(true);
    expect(replies.every((reply) => reply.metadata?.sessionId === 'session-reply-surface')).toBe(true);
  });

  it('delivers any surface packet through MemoryReplyPort during readiness smoke checks', async () => {
    const pipeline = new ReplyPipeline();
    const replies = pipeline.buildReplies({
      run: createRun([
        { id: 'api-client', label: 'API client', kind: 'api', status: 'available', primary: true },
      ]),
      text: 'Pacote rastreavel.',
      now: new Date('2026-04-27T16:42:00.000Z'),
    });
    const memoryPort = new MemoryReplyPort({
      now: () => new Date('2026-04-27T16:43:00.000Z'),
    });

    const deliveries = await memoryPort.sendAll(replies);

    expect(deliveries).toEqual([
      expect.objectContaining({
        runId: 'run-reply-surface',
        text: 'Pacote rastreavel.',
        deliveredAt: '2026-04-27T16:43:00.000Z',
        metadata: expect.objectContaining({
          traceId: 'trace-reply-surface',
          sessionId: 'session-reply-surface',
        }),
      }),
    ]);
  });
});
