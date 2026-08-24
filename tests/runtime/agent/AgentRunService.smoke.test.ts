import { AgentRunService } from '../../../src/runtime/agent/index.js';
import { MemoryReplyPort } from '../../../src/runtime/reply/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-${index}`;
  };
}

// Contention budget: agent-run pipeline tests exceed the 5s Jest default
// when full-group parallel workers load the machine.
jest.setTimeout(120000);

describe('AgentRunService smoke', () => {
  it('produces a channel-neutral reply with observable run context and tool exposure', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T15:00:00.000Z'),
      idFactory: createIdFactory(),
      defaultProviderLabel: 'Zavorth smoke provider',
      defaultModelLabel: 'smoke-model',
    });
    const memoryPort = new MemoryReplyPort({
      now: () => new Date('2026-04-27T15:01:00.000Z'),
    });

    const result = await service.run({
      requestId: 'request-smoke-service',
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-smoke-service',
      text: 'resuma o contexto atual do workspace',
      workspace: 'C:/workspace/zavorth',
      replyPort: {
        id: 'memory-smoke-service',
        label: 'Memory smoke port',
        kind: 'cli',
        status: 'available',
        primary: true,
      },
      metadata: {
        contextSnapshot: {
          source: 'smoke',
          layers: ['hot'],
        },
        toolHintProfile: {
          intentCategory: 'file_operation',
          groups: ['workspace'],
          recommendedToolNames: ['read_file', 'list_directory'],
          reason: 'smoke-context-request',
        },
        capabilityNegotiationApproved: true,
      },
    });
    const deliveries = await memoryPort.sendAll(result.replies);

    expect(result.ok).toBe(true);
    expect(result.run).toEqual(expect.objectContaining({
      id: 'agent-run-2',
      requestId: 'request-smoke-service',
      traceId: 'cli:session-smoke-service:request-smoke-service',
      sessionId: 'session-smoke-service',
      channel: 'cli',
      workspace: 'C:/workspace/zavorth',
      input: 'resuma o contexto atual do workspace',
      status: 'completed',
    }));
    expect(result.run.modelProfile).toEqual(expect.objectContaining({
      providerLabel: 'Zavorth smoke provider',
      modelLabel: 'smoke-model',
    }));
    expect(result.run.toolExposure.tools).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'read_file',
        risk: 'safe',
        requiresApproval: false,
      }),
      expect.objectContaining({
        id: 'list_directory',
        risk: 'safe',
        requiresApproval: false,
      }),
    ]));
    expect(result.run.metadata).toEqual(expect.objectContaining({
      adapterSource: 'universal-agent-runtime',
      contextSnapshot: {
        source: 'smoke',
        layers: ['hot'],
      },
      toolExposureHint: expect.objectContaining({
        source: 'toolHintProfile',
        usedAsPolicyInput: true,
      }),
    }));
    expect(result.replies).toEqual([
      expect.objectContaining({
        runId: result.run.id,
        text: expect.stringContaining('Received: "resuma o contexto atual do workspace"'),
        port: expect.objectContaining({
          id: 'memory-smoke-service',
          kind: 'cli',
          primary: true,
        }),
        metadata: expect.objectContaining({
          channel: 'cli',
          sessionId: 'session-smoke-service',
          traceId: 'cli:session-smoke-service:request-smoke-service',
        }),
      }),
    ]);
    expect(deliveries).toEqual([
      expect.objectContaining({
        runId: result.run.id,
        deliveredAt: '2026-04-27T15:01:00.000Z',
        metadata: expect.objectContaining({
          traceId: 'cli:session-smoke-service:request-smoke-service',
          sessionId: 'session-smoke-service',
        }),
      }),
    ]);
  });
});
