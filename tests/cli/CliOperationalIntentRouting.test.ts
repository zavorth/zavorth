import { executeCliUniversalAgentRuntime } from '../../src/cli/ZavorthCliFlowHelpers';
import { ZavorthAgentGateway } from '../../src/runtime/agent';

function createFlags(command: string | null = null): any {
  return {
    command,
    repl: true,
    json: false,
    live: false,
    userId: 'cli-user',
    platform: 'web',
    chatId: 'cli-chat',
    sessionId: 'cli-session',
    workspaceHint: null,
    commandText: null,
  };
}

describe('CLI operational intent routing', () => {
  it('routes low-signal CLI chat through the universal agent run path before legacy fallback', async () => {
    const agentGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T18:00:00.000Z'),
      idFactory: (prefix) => `${prefix}-cli-intent`,
    });
    const legacyUnifiedGateway = {
      handleEvent: jest.fn(async (event: any) => {
        await event.reply('Ola pelo CLI legado.');
        return {
          responseText: 'Ola pelo CLI legado.',
          surface: event.surface,
          intentCategory: 'conversation',
        };
      }),
    };
    const output: string[] = [];
    const writer = {
      line: jest.fn((text: string) => output.push(text)),
      error: jest.fn(),
    };

    const result = await executeCliUniversalAgentRuntime(
      { agentGateway, legacyUnifiedGateway } as any,
      'ola',
      createFlags(null),
      writer,
    );

    expect(result.ok).toBe(true);
    expect(legacyUnifiedGateway.handleEvent).not.toHaveBeenCalled();
    expect(agentGateway.buildSnapshot({ activeSessionId: 'cli-session' }).activeRun).toEqual(expect.objectContaining({
      channel: 'cli',
      input: 'ola',
      metadata: expect.objectContaining({
        responseDecision: expect.objectContaining({
          responsePath: 'fast-chat',
          shouldShowArtifactInChat: false,
        }),
        legacyUnifiedGatewayAvailable: true,
        legacyUnifiedGatewayBypassed: true,
      }),
    }));
    expect(output.join('\n')).toContain('Oi. Estou aqui, pronto para continuar pelo Zavorth.');
  });

  it('honors explicit CLI task execution', async () => {
    const agentGateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T18:10:00.000Z'),
      idFactory: (prefix) => `${prefix}-cli-task`,
    });
    const legacyUnifiedGateway = {
      handleEvent: jest.fn(async (event: any) => {
        await event.reply('Executado pelo gateway legado.');
        return {
          responseText: 'Executado pelo gateway legado.',
          surface: event.surface,
          intentCategory: 'delegated',
        };
      }),
    };
    const writer = { line: jest.fn(), error: jest.fn() };

    const result = await executeCliUniversalAgentRuntime(
      { agentGateway, legacyUnifiedGateway } as any,
      'ola',
      createFlags('task'),
      writer,
    );

    expect(result.ok).toBe(true);
    expect(legacyUnifiedGateway.handleEvent).not.toHaveBeenCalled();
    expect(agentGateway.buildSnapshot({ activeSessionId: 'cli-session' }).activeRun).toEqual(expect.objectContaining({
      channel: 'cli',
      input: expect.stringContaining('ola'),
      metadata: expect.objectContaining({
        responseDecision: expect.objectContaining({
          responsePath: 'agent-runtime',
        }),
      }),
    }));
  });
});
