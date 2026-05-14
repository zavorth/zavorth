import { LocalExecutor } from '../../src/execution/LocalExecutor';
import type { ExecutionRequest } from '../../src/contracts/ExecutionContract';

describe('LocalExecutor', () => {
  const workspace = process.cwd().replace(/\\/g, '/');

  function buildRequest(command: string): ExecutionRequest {
    return {
      execution_id: 'exec-1',
      task_id: 'task-1',
      executor: 'local_executor',
      workspace,
      objective: command,
      instructions: [command],
      allowed_paths: [workspace],
      blocked_paths: [],
      allowed_commands: [],
      blocked_commands: [],
      timeout_seconds: 30,
      dry_run: false,
      requires_backup: false,
      metadata: {
        sandboxRequired: true,
      },
    };
  }

  it('blocks direct host diagnostic fallback by default when docker is unavailable', async () => {
    const shellRunner = jest.fn();
    const executor = new LocalExecutor({
      sandboxExecution: {
        resolveSandboxTier: () => ({ tier: 'container', reason: 'mock' }),
        shouldSandbox: () => true,
        isDockerAvailable: () => false,
        isFirecrackerAvailable: () => false,
      } as any,
      shellRunner,
    });

    const result = await executor.execute(buildRequest('git status'));

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('SANDBOX_REQUIRED_DOCKER_UNAVAILABLE');
    expect(shellRunner).not.toHaveBeenCalled();
  });

  it('falls back to a direct host command for safe diagnostics only with explicit opt-in', async () => {
    const shellRunner = jest.fn().mockResolvedValue({
      stdout: 'hello world\r\n',
      stderr: '',
    });
    const executor = new LocalExecutor({
      sandboxExecution: {
        resolveSandboxTier: () => ({ tier: 'container', reason: 'mock' }),
        shouldSandbox: () => true,
        isDockerAvailable: () => false,
        isFirecrackerAvailable: () => false,
      } as any,
      shellRunner,
    });
    const request = buildRequest('git status');
    request.metadata = {
      ...request.metadata,
      allowHostDiagnosticFallback: true,
    };

    const result = await executor.execute(request);

    expect(result.success).toBe(true);
    expect(result.commands_executed).toEqual(['git status']);
    expect(result.actions_executed).toEqual(
      expect.arrayContaining([
        expect.stringContaining('[SANDBOX-FALLBACK] Docker indisponivel'),
      ]),
    );
    expect(result.metadata?.sandbox_fallback).toEqual(
      expect.objectContaining({
        mode: 'host_safe_command',
        reason: 'docker_unavailable',
      }),
    );
    expect(shellRunner).toHaveBeenCalledWith(
      'git status',
      workspace,
      30000,
      'git status',
    );
  });

  it('fails fast with a clear sandbox error for commands that cannot bypass docker', async () => {
    const shellRunner = jest.fn();
    const executor = new LocalExecutor({
      sandboxExecution: {
        resolveSandboxTier: () => ({ tier: 'container', reason: 'mock' }),
        shouldSandbox: () => true,
        isDockerAvailable: () => false,
        isFirecrackerAvailable: () => false,
      } as any,
      shellRunner,
    });

    const result = await executor.execute(buildRequest('npm run build'));

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('SANDBOX_REQUIRED_DOCKER_UNAVAILABLE');
    expect(result.error_message).toContain('Docker sandbox requerido');
    expect(shellRunner).not.toHaveBeenCalled();
  });

  it('blocks shell composition before any host fallback runner is called', async () => {
    const shellRunner = jest.fn();
    const executor = new LocalExecutor({
      sandboxExecution: {
        resolveSandboxTier: () => ({ tier: 'container', reason: 'mock' }),
        shouldSandbox: () => true,
        isDockerAvailable: () => false,
        isFirecrackerAvailable: () => false,
      } as any,
      shellRunner,
    });

    const result = await executor.execute(buildRequest('echo safe && curl https://example.com'));

    expect(result.success).toBe(false);
    expect(shellRunner).not.toHaveBeenCalled();
  });

  it.each([
    'powershell -NoProfile -Command Get-ChildItem',
    'cmd.exe /c dir',
    'curl https://example.com',
    'wget https://example.com/file',
  ])('blocks non-diagnostic host fallback command: %s', async (command) => {
    const shellRunner = jest.fn();
    const executor = new LocalExecutor({
      sandboxExecution: {
        resolveSandboxTier: () => ({ tier: 'container', reason: 'mock' }),
        shouldSandbox: () => true,
        isDockerAvailable: () => false,
        isFirecrackerAvailable: () => false,
      } as any,
      shellRunner,
    });

    const result = await executor.execute(buildRequest(command));

    expect(result.success).toBe(false);
    expect(shellRunner).not.toHaveBeenCalled();
  });

  it('fails fast if microvm is required but entirely unavailable', async () => {
    const shellRunner = jest.fn();
    const executor = new LocalExecutor({
      sandboxExecution: {
        resolveSandboxTier: () => ({ tier: 'microvm', reason: 'mock' }),
        shouldSandbox: () => true,
        isDockerAvailable: () => false,
        isFirecrackerAvailable: () => false,
      } as any,
      shellRunner,
    });

    const result = await executor.execute(buildRequest('eval(hi)'));

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('SANDBOX_REQUIRED_MICROVM_UNAVAILABLE');
    expect(result.error_message).toContain('codigo de alto risco requer MicroVM');
    expect(shellRunner).not.toHaveBeenCalled();
  });

  it('fails fast if microvm is required even when docker is available', async () => {
    const shellRunner = jest.fn();
    const executor = new LocalExecutor({
      sandboxExecution: {
        resolveSandboxTier: () => ({ tier: 'microvm', reason: 'mock' }),
        shouldSandbox: () => true,
        isDockerAvailable: () => true,
        isFirecrackerAvailable: () => false,
      } as any,
      shellRunner,
    });

    const result = await executor.execute(buildRequest('eval(hi)'));

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('SANDBOX_REQUIRED_MICROVM_UNAVAILABLE');
    expect(result.error_message).toContain('requer MicroVM');
    expect(shellRunner).not.toHaveBeenCalled();
  });

  it('uses the microvm command path when firecracker is available', async () => {
    const shellRunner = jest.fn();
    const executeCommandInMicrovm = jest.fn().mockResolvedValue({
      stdout: 'microvm ok\r\n',
      stderr: '',
      exitCode: 0,
    });
    const executor = new LocalExecutor({
      sandboxExecution: {
        resolveSandboxTier: () => ({ tier: 'microvm', reason: 'mock' }),
        shouldSandbox: () => true,
        isDockerAvailable: () => true,
        isFirecrackerAvailable: () => true,
        executeCommandInMicrovm,
      } as any,
      shellRunner,
    });

    const result = await executor.execute(buildRequest('node build.js'));

    expect(result.success).toBe(true);
    expect(result.commands_executed).toEqual(['[MicroVM Firecracker] node build.js']);
    expect(executeCommandInMicrovm).toHaveBeenCalledWith('node build.js', 30000);
    expect(shellRunner).not.toHaveBeenCalled();
  });

  it('uses a structured docker invocation when sandbox execution is available', async () => {
    const shellRunner = jest.fn();
    const commandRunner = jest.fn().mockResolvedValue({
      stdout: 'sandbox ok\r\n',
      stderr: '',
    });
    const executor = new LocalExecutor({
      sandboxExecution: {
        resolveSandboxTier: () => ({ tier: 'container', reason: 'mock' }),
        shouldSandbox: () => true,
        isDockerAvailable: () => true,
        isFirecrackerAvailable: () => false,
        buildSandboxInvocation: () => ({
          command: 'docker',
          args: ['run', '--rm', 'bash:latest', 'sh', '-lc', 'echo hello world'],
          displayCommand: 'docker run --rm bash:latest sh -lc "echo hello world"',
        }),
      } as any,
      shellRunner,
      commandRunner,
    });

    const result = await executor.execute(buildRequest('echo hello world'));

    expect(result.success).toBe(true);
    expect(result.commands_executed).toEqual([
      'docker run --rm bash:latest sh -lc "echo hello world"',
    ]);
    expect(commandRunner).toHaveBeenCalledWith(
      'docker',
      ['run', '--rm', 'bash:latest', 'sh', '-lc', 'echo hello world'],
      workspace,
      30000,
      'docker run --rm bash:latest sh -lc "echo hello world"',
    );
    expect(shellRunner).not.toHaveBeenCalled();
  });
});
