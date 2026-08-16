import { describe, it, expect } from '@jest/globals';
import { createZavorthCli } from '../../src/cli/ZavorthCliBootstrap.js';
import { ZavorthCli } from '../../src/cli/ZavorthCli.js';

describe('ZavorthCliBootstrap & Inversion of Control', () => {
  it('should instantiate ZavorthCli via composition root with 7-layer config', () => {
    const cli = createZavorthCli({
      cliOverrides: {
        logging: { level: 'debug' },
      },
    });

    expect(cli).toBeInstanceOf(ZavorthCli);
  });

  it('should support dependency injection of custom writer and mock runtime', async () => {
    const outputs: string[] = [];
    const customWriter = {
      line: (text: string) => outputs.push(text),
      error: (text: string) => outputs.push(`ERROR: ${text}`),
    };

    const mockRuntime: any = {
      commandService: {
        execute: async () => ({ ok: true, output: ['Mocked command output'] }),
      },
      agentGateway: {
        handle: async () => ({ ok: true, text: 'Agent response' }),
      },
    };

    const cli = createZavorthCli({
      deps: {
        writer: customWriter,
        runtime: mockRuntime,
      },
    });

    expect(cli).toBeInstanceOf(ZavorthCli);
    // Execute a non-repl one-shot run
    const result = await cli.runOnce('help', {
      command: 'help',
      repl: false,
      json: false,
      live: false,
      userId: 'test-user',
      platform: 'web',
      chatId: 'test-chat',
      sessionId: 'test-session',
      workspaceHint: null,
      commandText: 'help',
      headless: false,
      approvalMode: null,
    });

    expect(result).toBeDefined();
  });
});
