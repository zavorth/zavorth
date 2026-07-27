import { ZavorthAgentGateway } from '../../../src/runtime/agent/index.js';
import { MemoryReplyPort } from '../../../src/runtime/reply/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-${index}`;
  };
}

describe('ZavorthAgentGateway smoke', () => {
  it('handles a normalized request and delivers the reply through MemoryReplyPort', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T15:10:00.000Z'),
      idFactory: createIdFactory(),
      defaultProviderLabel: 'Zavorth smoke provider',
      defaultModelLabel: 'smoke-model',
    });
    const memoryPort = new MemoryReplyPort({
      now: () => new Date('2026-04-27T15:11:00.000Z'),
    });

    const result = await gateway.handle({
      requestId: 'request-smoke-gateway',
      traceId: 'trace-smoke-gateway',
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-smoke-gateway',
      text: 'confirme que o agent loop esta vivo',
      workspace: 'C:/workspace/zavorth',
      replyPort: {
        id: 'memory-smoke-gateway',
        label: 'Memory smoke port',
        kind: 'cli',
        status: 'available',
        primary: true,
      },
      requestedTools: ['read_file'],
      metadata: {
        contextSnapshot: {
          source: 'smoke',
          layers: ['hot'],
        },
      },
    });
    const deliveries = await memoryPort.sendAll(result.replies);

    expect(result.ok).toBe(true);
    expect(result.run).toEqual(expect.objectContaining({
      id: 'agent-run-2',
      requestId: 'request-smoke-gateway',
      traceId: 'trace-smoke-gateway',
      sessionId: 'session-smoke-gateway',
      channel: 'cli',
      workspace: 'C:/workspace/zavorth',
      status: 'completed',
    }));
    expect(result.run.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'input',
        title: 'Request received',
        detail: 'confirme que o agent loop esta vivo',
      }),
      expect.objectContaining({
        kind: 'planning',
        title: 'Initial plan prepared',
      }),
      expect.objectContaining({
        kind: 'reply',
        title: 'Prepared response',
      }),
    ]));
    expect(result.run.toolExposure).toEqual(expect.objectContaining({
      mode: 'safe',
      tools: [
        expect.objectContaining({
          id: 'read_file',
          risk: 'safe',
          requiresApproval: false,
        }),
      ],
    }));
    expect(result.run.metadata).toEqual(expect.objectContaining({
      traceId: 'trace-smoke-gateway',
      adapterSource: 'universal-agent-runtime',
      contextSnapshot: {
        source: 'smoke',
        layers: ['hot'],
      },
    }));
    expect(result.replies[0]).toEqual(expect.objectContaining({
      runId: result.run.id,
      text: expect.stringContaining('Received: "confirme que o agent loop esta vivo"'),
      metadata: expect.objectContaining({
        traceId: 'trace-smoke-gateway',
        sessionId: 'session-smoke-gateway',
      }),
    }));
    expect(deliveries[0]).toEqual(expect.objectContaining({
      runId: result.run.id,
      text: result.replies[0].text,
      deliveredAt: '2026-04-27T15:11:00.000Z',
    }));
    expect(gateway.buildSnapshot({ activeRunId: result.run.id })).toEqual(expect.objectContaining({
      activeRun: expect.objectContaining({
        id: result.run.id,
        traceId: 'trace-smoke-gateway',
      }),
    }));
  });
});
