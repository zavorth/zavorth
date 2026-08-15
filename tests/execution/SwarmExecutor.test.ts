import { SwarmExecutor } from '../../src/execution/SwarmExecutor';
import { SwarmOrchestrator } from '../../src/runtime/sessions/v2/SwarmOrchestrator';
import type { ExecutionRequest } from '../../src/contracts/ExecutionContract';


// Mock SwarmOrchestrator
jest.mock('../../src/runtime/sessions/v2/SwarmOrchestrator', () => {
  return {
    SwarmOrchestrator: jest.fn().mockImplementation((objective, roles, options) => {
      return {
        execute: jest.fn().mockResolvedValue({
          status: 'completed',
          synthesizedOutput: 'Mocked output',
          roles: [],
        }),
        getSnapshot: jest.fn().mockReturnValue({
          status: 'completed',
          objective,
          roles: [],
        }),
      };
    }),
  };
});

describe('SwarmExecutor Isolation Configuration', () => {
  const originalEnv = process.env;
  const originalPlatform = process.platform;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
  });

  function buildRequest(): ExecutionRequest {
    return {
      execution_id: 'swarm-exec-1',
      task_id: 'task-1',
      executor: 'swarm',
      workspace: __dirname.replace(/\\/g, '/'),
      objective: 'test objective',
      instructions: ['step 1'],
      allowed_paths: [],
      blocked_paths: [],
      allowed_commands: [],
      blocked_commands: [],
      timeout_seconds: 60,
      dry_run: false,
      requires_backup: false,
    };
  }

  it('runs directly on the host (direct) when ZAVORTH_SWARM_DEFAULT_ISOLATION is direct or undefined', async () => {
    delete process.env.ZAVORTH_SWARM_DEFAULT_ISOLATION;
    const executor = new SwarmExecutor({} as any);
    const result = await executor.execute(buildRequest());

    expect(result.success).toBe(true);
    expect(SwarmOrchestrator).toHaveBeenCalled();
    const calls = (SwarmOrchestrator as any).mock.calls;
    const lastCallRoles = calls[calls.length - 1][1];

    // Under direct execution, commands should be process.execPath (node)
    expect(lastCallRoles[0].command).toBe(process.execPath);
    expect(lastCallRoles[0].args[0]).toContain('zavorth-cli.js');
  });

  it('wraps commands in docker when ZAVORTH_SWARM_DEFAULT_ISOLATION is set to docker', async () => {
    process.env.ZAVORTH_SWARM_DEFAULT_ISOLATION = 'docker';
    const executor = new SwarmExecutor({} as any);
    const result = await executor.execute(buildRequest());

    expect(result.success).toBe(true);
    const calls = (SwarmOrchestrator as any).mock.calls;
    const lastCallRoles = calls[calls.length - 1][1];

    expect(lastCallRoles[0].command).toBe('docker');
    expect(lastCallRoles[0].args).toContain('run');
    expect(lastCallRoles[0].args).toContain('--rm');
    expect(lastCallRoles[0].args).toContain('node:22');
  });

  it('wraps commands in wsl when ZAVORTH_SWARM_DEFAULT_ISOLATION is set to wsl on Windows', async () => {
    // Force platform to win32 for wsl wrapping test
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true,
    });

    process.env.ZAVORTH_SWARM_DEFAULT_ISOLATION = 'wsl';
    const executor = new SwarmExecutor({} as any);
    const result = await executor.execute(buildRequest());

    expect(result.success).toBe(true);
    const calls = (SwarmOrchestrator as any).mock.calls;
    const lastCallRoles = calls[calls.length - 1][1];

    expect(lastCallRoles[0].command).toBe('wsl.exe');
    expect(lastCallRoles[0].args).toContain('--cd');
  });
});
