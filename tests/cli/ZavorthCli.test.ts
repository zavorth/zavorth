import { ZavorthCli, parseZavorthCliFlags, runZavorthCli } from '../../src/cli/ZavorthCli';

describe('ZavorthCli public surface', () => {
  it('parses chat as the official terminal entrypoint', () => {
    const parsed = parseZavorthCliFlags(['chat']);

    expect(parsed).toEqual(expect.objectContaining({
      repl: true,
      command: null,
      commandText: null,
    }));
  });

  it('normalizes the core daily aliases without exposing internal commands', () => {
    expect(parseZavorthCliFlags(['run', 'review', 'this', 'repo'])).toEqual(expect.objectContaining({
      command: 'task',
      commandText: 'task review this repo',
    }));
    expect(parseZavorthCliFlags(['history', 'session-web-1'])).toEqual(expect.objectContaining({
      command: 'sessionhistory',
      commandText: 'sessionhistory session-web-1',
    }));
    expect(parseZavorthCliFlags(['approve', 'task-123'])).toEqual(expect.objectContaining({
      command: 'approve',
      commandText: '/approve task-123',
    }));
  });

  it('shows the current premium help when called with no arguments outside a TTY', async () => {
    const writes: string[] = [];
    const errors: string[] = [];
    const cli = new ZavorthCli({
      writer: {
        line: (text: string) => writes.push(text),
        error: (text: string) => errors.push(text),
      },
    });

    const descriptor = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
    Object.defineProperty(process.stdin, 'isTTY', {
      value: false,
      configurable: true,
    });

    try {
      const exitCode = await cli.run([]);

      expect(exitCode).toBe(0);
      expect(errors).toEqual([]);
      expect(writes[0]).toContain('Zavorth CLI');
      expect(writes[0]).toContain('Speak naturally. Approve sensitive work. Keep evidence.');
      expect(writes[0]).toContain('Daily commands');
      expect(writes[0]).toContain('zavorth chat');
      expect(writes[0]).toContain('zavorth setup');
      expect(writes[0]).toContain('zavorth approve');
      expect(writes[0]).toContain('Advanced groups');
      expect(writes[0]).not.toContain('npm run');
      expect(writes[0]).not.toContain('runtime universal');
    } finally {
      if (descriptor) {
        Object.defineProperty(process.stdin, 'isTTY', descriptor);
      } else {
        delete (process.stdin as any).isTTY;
      }
    }
  });

  it('renders the root help as a small product entrypoint', async () => {
    const writes: string[] = [];

    const exitCode = await runZavorthCli(
      ['help'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(writes[0]).toContain('Daily commands');
    expect(writes[0]).toContain('When needed');
    expect(writes[0]).toContain('zavorth ask "review this repo"');
    expect(writes[0]).toContain('zavorth inspect');
    expect(writes[0]).toContain('Provider/channel/ability inventory');
    expect(writes[0]).not.toContain('nodes invoke');
  });

  it('renders focused help pages without falling back to legacy Portuguese copy', async () => {
    const writes: string[] = [];

    const exitCode = await runZavorthCli(
      ['help', 'chat'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(writes[0]).toContain('zavorth chat');
    expect(writes[0]).toContain('terminal');
    expect(writes[0]).toContain('Start terminal conversation.');
    expect(writes[0]).not.toContain('Abre a conversa principal');
  });

  it('renders setup dry-run as a compact first-run entrypoint', async () => {
    const writes: string[] = [];

    const exitCode = await runZavorthCli(
      ['setup', '--dry-run'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(writes[0]).toContain('Zavorth Onboarding');
    expect(writes[0]).toContain('Guided first-run path for daily local use.');
    expect(writes[0]).toContain('zavorth setup');
    expect(writes[0]).toContain('zavorth doctor --simple');
    expect(writes[0]).toContain('zavorth go');
    expect(writes[0]).not.toContain('npm run');
  });

  it('routes shared slash commands through the canonical surface API when available', async () => {
    const writes: string[] = [];
    const surfaceApi = {
      handleCommand: jest.fn(async (input: any) => {
        await input.context.reply(`Boundary ${input.request.surface}: ${input.context.rawText}`);
        return {
          ok: true,
          handled: true,
          status: 'ok',
          summary: 'Handled by canonical CLI boundary.',
          messages: [`Boundary ${input.request.surface}: ${input.context.rawText}`],
          correlation: {
            traceId: 'trace-cli',
            runId: 'run-cli',
            sessionId: input.request.threadId,
            approvalId: null,
            artifactId: null,
          },
          error: null,
          metadata: {},
        };
      }),
    };

    const exitCode = await runZavorthCli(
      ['hooks', 'transport'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: surfaceApi as any,
        hookPlane: false as any,
      },
    );

    expect(exitCode).toBe(0);
    expect(surfaceApi.handleCommand).toHaveBeenCalledWith(expect.objectContaining({
      context: expect.objectContaining({
        platform: 'web',
        rawText: '/hooks transport',
      }),
      request: expect.objectContaining({
        surface: 'web',
        requestedBy: expect.any(String),
        chatId: expect.stringContaining('cli:'),
      }),
    }));
    expect(writes[0]).toContain('Boundary web: /hooks transport');
  });

  it('keeps JSON output structured for setup automation', async () => {
    const writes: string[] = [];

    const exitCode = await runZavorthCli(
      ['setup', '--dry-run', '--json'],
      {
        write: (value) => writes.push(value),
        error: () => undefined,
      },
      {
        commandService: { maybeHandle: jest.fn(async () => false) } as any,
      },
    );

    const payload = JSON.parse(writes[0] || '{}');
    expect(exitCode).toBe(0);
    expect(payload).toEqual(expect.objectContaining({
      surface: 'zavorth-cli',
      title: 'Zavorth Onboarding',
      command: 'setup',
      canExecuteMutations: false,
      dashboardPath: '/dashboard',
      rows: expect.arrayContaining([
        expect.objectContaining({ status: 'zavorth setup' }),
        expect.objectContaining({ status: 'zavorth doctor --simple' }),
        expect.objectContaining({ status: 'zavorth go' }),
      ]),
    }));
  });
});
