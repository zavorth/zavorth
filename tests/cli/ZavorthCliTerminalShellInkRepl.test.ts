import { runZavorthCliRepl } from '../../src/cli/ZavorthCliReplLifecycle';
import { executeCliUniversalAgentRuntime } from '../../src/cli/ZavorthCliFlowHelpers';
import type { CliWriter, ZavorthCliFlags } from '../../src/cli/ZavorthCliContract';
import { runTerminalShellCardDecision } from '../../src/cli/ZavorthCliTerminalShellInkApp';

function createFlags(overrides: Partial<ZavorthCliFlags> = {}): ZavorthCliFlags {
  return {
    command: null,
    repl: true,
    json: false,
    live: false,
    userId: 'operator',
    platform: 'web',
    chatId: 'cli',
    sessionId: 'main',
    workspaceHint: null,
    commandText: null,
    headless: false,
    approvalMode: null,
    ...overrides,
  };
}

function createWriter() {
  const lines: string[] = [];
  return {
    lines,
    writer: {
      line: (text: string) => lines.push(String(text)),
      error: (text: string) => lines.push(String(text)),
    },
  };
}

describe('Zavorth CLI Terminal Shell Ink REPL bridge', () => {
  test('uses the live terminal shell runner before creating readline in an interactive terminal', async () => {
    const { lines, writer } = createWriter();
    const steerActiveRun = jest.fn();
    const exitCode = await runZavorthCliRepl({
      flags: createFlags(),
      readlineFactory: () => {
        throw new Error('readline should not be used when terminal shell renders');
      },
      writer,
      runOnce: async () => ({ ok: true, handled: true, output: [], error: null }),
      steerActiveRun,
      terminalShellRunner: async ({ initialText, steerActiveRun: forwardedSteer }) => {
        lines.push(initialText.includes('Zavorth Terminal Shell') ? 'terminal-shell-rendered' : 'missing-shell');
        expect(forwardedSteer).toBe(steerActiveRun);
        return { rendered: true, exitCode: 0 };
      },
      forceTerminalShell: true,
    } as any);

    expect(exitCode).toBe(0);
    expect(lines).toContain('terminal-shell-rendered');
  });

  test('falls back to readline when the live terminal shell is unavailable', async () => {
    const { lines, writer } = createWriter();
    const questions: string[] = ['quit'];
    const closed: string[] = [];
    const exitCode = await runZavorthCliRepl({
      flags: createFlags(),
      readlineFactory: () => ({
        history: [],
        question: async (prompt: string) => {
          lines.push(prompt);
          return questions.shift() || 'quit';
        },
        close: () => closed.push('closed'),
        on: () => undefined,
      }),
      writer,
      runOnce: async () => ({ ok: true, handled: true, output: [], error: null }),
      terminalShellRunner: async () => ({ rendered: false, exitCode: 0 }),
      forceTerminalShell: true,
    } as any);

    expect(exitCode).toBe(0);
    expect(closed).toContain('closed');
    expect(lines.join('\n')).toContain('Session closed. Nothing was changed.');
  });

  test('forwards universal runtime assistant deltas to the terminal stream before final output', async () => {
    const observed: string[] = [];
    let runtimeBus: any = null;
    const flags = createFlags({
      terminalStream: {
        onEvent: async (event) => {
          observed.push(`${event.type}:${event.delta || event.text || event.accumulated || ''}`);
        },
      },
    } as Partial<ZavorthCliFlags>);
    const writer: CliWriter = {
      line: (text) => observed.push(`final:${text}`),
      error: (text) => observed.push(`error:${text}`),
    };
    const runtime: any = {
      agentGateway: {
        addRuntimeEventBus: (bus: any) => {
          runtimeBus = bus;
        },
        removeRuntimeEventBus: (bus: any) => {
          if (runtimeBus === bus) runtimeBus = null;
        },
        handle: async () => {
          await runtimeBus.emit('agent.stream.assistant', {
            phase: 'start',
            accumulated: '',
            delta: '',
            done: false,
          });
          await runtimeBus.emit('agent.stream.assistant', {
            phase: 'delta',
            accumulated: 'Hel',
            delta: 'Hel',
            done: false,
          });
          await runtimeBus.emit('agent.stream.assistant', {
            phase: 'delta',
            accumulated: 'Hello',
            delta: 'lo',
            done: false,
          });
          await runtimeBus.emit('agent.stream.assistant', {
            phase: 'done',
            accumulated: 'Hello',
            delta: '',
            done: true,
          });
          return {
            ok: true,
            replies: [{ text: 'Hello' }],
            run: {
              id: 'run-stream',
              requestId: 'request-stream',
              sessionId: 'main',
              status: 'completed',
              summary: 'Hello',
              approvals: [],
              toolExposure: null,
              metadata: {},
            },
          };
        },
      },
      surfaceOperationalIntentService: {
        decideResponse: async () => ({
          responsePath: 'fast-chat',
          requestedTools: [],
          artifactPolicy: null,
        }),
      },
    };

    const result = await executeCliUniversalAgentRuntime(runtime, 'say hello', flags, writer);

    expect(result.ok).toBe(true);
    expect(observed.indexOf('delta:Hel')).toBeGreaterThan(-1);
    expect(observed.indexOf('delta:lo')).toBeGreaterThan(observed.indexOf('delta:Hel'));
    expect(observed.findIndex((entry) => entry.startsWith('final:'))).toBeGreaterThan(observed.indexOf('delta:lo'));
    expect(runtimeBus).toBeNull();
  });

  test('does not call the universal runtime when terminal abort is already signaled', async () => {
    const observed: string[] = [];
    const abortController = new AbortController();
    abortController.abort();
    const flags = createFlags({
      terminalAbortSignal: abortController.signal,
    } as Partial<ZavorthCliFlags>);
    const runtime: any = {
      agentGateway: {
        handle: jest.fn(async () => {
          throw new Error('should not be called after terminal abort');
        }),
      },
    };

    const result = await executeCliUniversalAgentRuntime(runtime, 'review workspace', flags, {
      line: (text) => observed.push(text),
      error: (text) => observed.push(text),
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('interrupted');
    expect(runtime.agentGateway.handle).not.toHaveBeenCalled();
  });

  test('runs selected approval shortcuts through the governed HUD command path', async () => {
    const calls: string[] = [];
    const result = await runTerminalShellCardDecision({
      action: 'approve',
      flags: createFlags(),
      cards: [
        { kind: 'tool', title: 'Read workspace', status: 'done' },
        {
          kind: 'approval',
          title: 'Apply safe patch',
          status: 'waiting',
          body: 'Plan: plan-terminal-pty',
          command: 'zavorth approve plan-terminal-pty --yes',
        },
      ],
      selection: { selectedIndex: 1 },
      runOnce: async (rawInput) => {
        calls.push(rawInput);
        return {
          ok: true,
          handled: true,
          output: ['Approval captured by shell.'],
          error: null,
        };
      },
    });

    expect(calls).toEqual(['hud --action approve --plan plan-terminal-pty --yes']);
    expect(result.ok).toBe(true);
    expect(result.notice).toBe('Decision applied through the governed HUD.');
    expect(result.card).toMatchObject({
      kind: 'result',
      title: 'Decision recorded',
      status: 'approve',
    });
  });
});
