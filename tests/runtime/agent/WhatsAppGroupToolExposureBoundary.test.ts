import { AgentRunService } from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-${index}`;
  };
}

describe('WhatsApp group tool exposure boundary', () => {
  it('propagates channelUserIdAllowed=false into AgentRun tool exposure narrowing', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-06-17T00:00:00.000Z'),
      idFactory: createIdFactory(),
      defaultProviderLabel: 'Zavorth test provider',
      defaultModelLabel: 'test-model',
    });

    const result = await service.run({
      requestId: 'whatsapp-group-untrusted',
      userId: '+15559990000',
      channel: 'api',
      sessionId: 'whatsapp:120363025555555555@g.us',
      text: '@zavorth inspect the linked file',
      requestedTools: ['read_file', 'write_file', 'unknown_tool'],
      metadata: {
        source: 'channel-mesh',
        surface: 'whatsapp',
        channelFields: {
          channelUserIdAllowed: false,
          groupToolPolicy: {
            untrustedUserMode: 'safe-only',
            allowedToolsForUntrustedUsers: [],
          },
        },
      },
    });

    expect(result.run.metadata.channelFields).toEqual(expect.objectContaining({
      channelUserIdAllowed: false,
    }));
    expect(result.run.toolExposure.tools.map((tool) => tool.id)).toEqual(['read_file']);
    expect(result.run.toolExposure.blockedTools).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'write_file', reason: 'unauthorized-user-in-group' }),
      expect.objectContaining({ id: 'unknown_tool', reason: 'unauthorized-user-in-group' }),
    ]));
  });

  it('propagates channelUserIdAllowed=true and keeps trusted group participant behavior authorized', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-06-17T00:00:00.000Z'),
      idFactory: createIdFactory(),
      defaultProviderLabel: 'Zavorth test provider',
      defaultModelLabel: 'test-model',
    });

    const result = await service.run({
      requestId: 'whatsapp-group-trusted',
      userId: '+15550001111',
      channel: 'api',
      sessionId: 'whatsapp:120363025555555555@g.us',
      text: '@zavorth prepare the workspace update',
      requestedTools: ['read_file', 'write_file'],
      metadata: {
        source: 'channel-mesh',
        surface: 'whatsapp',
        channelFields: {
          channelUserIdAllowed: true,
          groupToolPolicy: {
            untrustedUserMode: 'none',
          },
        },
      },
    });

    expect(result.run.metadata.channelFields).toEqual(expect.objectContaining({
      channelUserIdAllowed: true,
    }));
    expect(result.run.toolExposure.tools.map((tool) => tool.id)).toEqual(expect.arrayContaining([
      'read_file',
      'write_file',
    ]));
  });
});
