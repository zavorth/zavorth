import { EventEmitter, once } from 'events';
import { SessionManager } from '../../../../src/runtime/sessions/v2/SessionManager.js';
import { SessionRegistryService } from '../../../../src/runtime/sessions/v2/SessionRegistryService.js';

describe('SessionManager', () => {
  function createMockChildProcess() {
    const child = new EventEmitter() as any;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = {
      write: jest.fn((input: string) => {
        setImmediate(() => {
          child.stdout.emit('data', Buffer.from(`echo:${input}`));
          child.emit('exit', 0);
        });
        return true;
      }),
    };
    child.kill = jest.fn(() => {
      child.emit('exit', null);
    });
    return child;
  }

  it('echoes stdin through the fallback child process and emits input/output events', async () => {
    const child = createMockChildProcess();
    const spawnProcess = jest.fn(() => child);
    const manager = new SessionManager('session-real-1', process.cwd(), {
      loadNodePty: () => null,
      spawnProcess,
    });
    const outputs: string[] = [];
    const inputs: string[] = [];

    manager.getEvents().on('pty:data', (data: string) => {
      outputs.push(data);
    });
    manager.getEvents().on('pty:input', (data: string) => {
      inputs.push(data);
    });

    manager.startProcess('fake-shell', ['--interactive']);

    const exitPromise = once(manager.getEvents(), 'pty:exit');
    manager.write('hello-session\n');
    const [exitCode] = await exitPromise;

    expect(spawnProcess).toHaveBeenCalledWith('fake-shell', ['--interactive'], expect.any(Object));
    expect(exitCode).toBe(0);
    expect(inputs.join('')).toContain('hello-session');
    expect(outputs.join('')).toContain('echo:hello-session');
    expect(manager.getState().logs.join('\n')).toContain('[stdin] hello-session');
  });

  it('redacts secret-looking terminal input and output before logs and events persist them', async () => {
    const child = createMockChildProcess();
    const spawnProcess = jest.fn(() => child);
    const manager = new SessionManager('session-redact-1', process.cwd(), {
      loadNodePty: () => null,
      spawnProcess,
    });
    const outputs: string[] = [];
    const inputs: string[] = [];
    const secretInput = 'OPENAI_API_KEY=sk-test12345678901234567890\n';

    manager.getEvents().on('pty:data', (data: string) => {
      outputs.push(data);
    });
    manager.getEvents().on('pty:input', (data: string) => {
      inputs.push(data);
    });

    manager.startProcess('fake-shell', ['--interactive']);

    const exitPromise = once(manager.getEvents(), 'pty:exit');
    manager.write(secretInput);
    await exitPromise;

    const serialized = [
      ...inputs,
      ...outputs,
      ...manager.getState().logs,
    ].join('\n');
    expect(serialized).toContain('[redacted-secret]');
    expect(serialized).not.toContain('sk-test12345678901234567890');
  });

  it('starts terminal sessions without inheriting unrelated provider secrets', () => {
    const previousOpenAi = process.env.OPENAI_API_KEY;
    const previousGemini = process.env.GEMINI_API_KEY;
    const previousTelegram = process.env.TELEGRAM_BOT_TOKEN;
    process.env.OPENAI_API_KEY = 'host-openai-secret';
    process.env.GEMINI_API_KEY = 'host-gemini-secret';
    process.env.TELEGRAM_BOT_TOKEN = 'host-telegram-secret';
    const child = createMockChildProcess();
    const spawnProcess = jest.fn(() => child);

    try {
      const manager = new SessionManager('session-env-1', process.cwd(), {
        loadNodePty: () => null,
        spawnProcess,
      });
      manager.startProcess('fake-shell', []);

      const env = spawnProcess.mock.calls[0][2].env;
      expect(env.OPENAI_API_KEY).toBeUndefined();
      expect(env.GEMINI_API_KEY).toBeUndefined();
      expect(env.TELEGRAM_BOT_TOKEN).toBeUndefined();
      expect(manager.getState().context.env.OPENAI_API_KEY).toBeUndefined();
    } finally {
      if (previousOpenAi === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previousOpenAi;
      if (previousGemini === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previousGemini;
      if (previousTelegram === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
      else process.env.TELEGRAM_BOT_TOKEN = previousTelegram;
    }
  });

  it('prefers node-pty when the optional transport is available', async () => {
    const writes: string[] = [];
    const manager = new SessionManager(
      'session-pty-1',
      process.cwd(),
      {
        loadNodePty: () => ({
          spawn: () => {
            let onDataHandler: ((event: string | { data?: string }) => void) | null = null;
            let onExitHandler: ((event: number | { exitCode?: number | null }) => void) | null = null;
            return {
              write(data: string) {
                writes.push(data);
                onDataHandler?.(`pty:${data}`);
                onExitHandler?.({ exitCode: 0 });
              },
              kill() {
                onExitHandler?.({ exitCode: 0 });
              },
              onData(listener: (event: string | { data?: string }) => void) {
                onDataHandler = listener;
              },
              onExit(listener: (event: number | { exitCode?: number | null }) => void) {
                onExitHandler = listener;
              },
            };
          },
        }),
      },
    );
    const outputs: string[] = [];

    manager.getEvents().on('pty:data', (data: string) => {
      outputs.push(data);
    });

    manager.startProcess('fake-shell', []);
    const exitPromise = once(manager.getEvents(), 'pty:exit');
    manager.write('hello-pty');
    const [exitCode] = await exitPromise;

    expect(exitCode).toBe(0);
    expect(writes).toEqual(['hello-pty']);
    expect(outputs.join('')).toContain('pty:hello-pty');
  });

  it('emits pty:error instead of crashing when spawn fails', async () => {
    const child = createMockChildProcess();
    child.stdin.write = jest.fn();
    const spawnProcess = jest.fn(() => {
      setImmediate(() => {
        child.emit('error', new Error('spawn EPERM'));
      });
      return child;
    });
    const manager = new SessionManager('session-spawn-error', process.cwd(), {
      loadNodePty: () => null,
      spawnProcess,
    });
    const errors: string[] = [];

    manager.getEvents().on('pty:error', (error: string) => {
      errors.push(error);
    });

    const exitPromise = once(manager.getEvents(), 'pty:exit');
    manager.startProcess('__zavorth_missing_command__', []);
    const [exitCode] = await exitPromise;

    expect(exitCode).toBeNull();
    expect(errors.join('\n')).toContain('__zavorth_missing_command__');
    expect(manager.getState().status).toBe('ERROR');
  });

  it('registers optional canonical ownership without replacing the session manager', () => {
    const registry = new SessionRegistryService({
      now: () => new Date('2026-04-27T15:20:00.000Z'),
      idFactory: (prefix) => `${prefix}-fixed`,
    });
    const manager = new SessionManager('session-owned-1', process.cwd(), {
      sessionRegistry: registry,
      ownership: {
        kind: 'agent_run',
        surface: 'cli',
        runId: 'run-owned-1',
        taskId: 'task-owned-1',
      },
    });

    expect(manager.getState().id).toBe('session-owned-1');
    expect(registry.getSession('session-owned-1')).toEqual(expect.objectContaining({
      ownershipId: 'session-owner-fixed',
      sessionId: 'session-owned-1',
      ownerRef: 'run:run-owned-1',
      kind: 'agent_run',
      surface: 'cli',
      status: 'active',
      runId: 'run-owned-1',
      taskId: 'task-owned-1',
    }));

    manager.kill();

    expect(registry.getSession('session-owned-1')).toEqual(expect.objectContaining({
      status: 'released',
      orphanReason: 'session_killed',
    }));
  });
});
