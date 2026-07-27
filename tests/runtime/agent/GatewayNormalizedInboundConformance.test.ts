import {
  ZavorthAgentGateway,
  type NormalizedInboundMessage,
  type UniversalAgentExecutor,
} from '../../../src/runtime/agent/index.js';
import { FixtureRuntimeAdapterAdapter } from '../../../src/runtime/zavorth-runtime-adapters/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-${index}`;
  };
}

describe('Gateway normalized inbound conformance', () => {
  it('accepts web, Telegram, Discord, API, CLI and external fixture requests through ZavorthAgentGateway', async () => {
    const executor = jest.fn<ReturnType<UniversalAgentExecutor>, Parameters<UniversalAgentExecutor>>(({ request }) => ({
      status: 'completed',
      summary: `${request.channel} entrou pelo gateway.`,
      replyText: `gateway:${request.channel}:${request.text}`,
    }));
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T16:20:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });
    const externalAdapter = new FixtureRuntimeAdapterAdapter();
    const [externalEvent] = await externalAdapter.pullTestEvents();
    const messages: NormalizedInboundMessage[] = [
      {
        requestId: 'web-conformance',
        userId: 'grey',
        channel: 'web',
        sessionId: 'web:session-conformance',
        text: 'show status in the panel',
        requestedTools: ['read_file'],
      },
      {
        requestId: 'telegram-conformance',
        userId: 'telegram-42',
        channel: 'telegram',
        sessionId: 'telegram:42',
        text: 'resuma o estado',
        requestedTools: ['read_file'],
      },
      {
        requestId: 'discord-conformance',
        userId: 'discord-42',
        channel: 'discord',
        sessionId: 'discord:guild:guild-1:channel:channel-1',
        text: 'continue a tarefa',
        requestedTools: ['read_file'],
      },
      {
        requestId: 'api-conformance',
        userId: 'api-client',
        channel: 'api',
        sessionId: 'api:session-conformance',
        text: 'liste capabilities',
        requestedTools: ['read_file'],
      },
      {
        requestId: 'cli-conformance',
        userId: 'operator',
        channel: 'cli',
        sessionId: 'cli:session-conformance',
        text: 'resuma o estado textual',
        requestedTools: ['read_file'],
      },
      {
        ...externalAdapter.normalizeEvent(externalEvent),
        requestedTools: ['read_file'],
      },
    ];

    const results = [];
    for (const message of messages) {
      results.push(await gateway.handle(message));
    }

    expect(executor).toHaveBeenCalledTimes(messages.length);
    expect(results.map((result) => result.run.channel)).toEqual([
      'web',
      'telegram',
      'discord',
      'api',
      'cli',
      'api',
    ]);
    expect(results.every((result) => result.run.metadata.adapterSource === 'universal-agent-runtime')).toBe(true);
    expect(results.at(-1)?.run.metadata.externalAdapter).toEqual(expect.objectContaining({
      adapterId: 'external-sidecar-fixture',
      boundary: expect.objectContaining({
        gatewayEntry: 'ZavorthAgentGateway.handle',
      }),
    }));
    expect(gateway.listRuns()).toHaveLength(messages.length);
  });
});
