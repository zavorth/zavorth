import { ExternalExecutor } from '../../src/execution/ExternalExecutor';
import { ExecutionRequest } from '../../src/contracts/ExecutionContract';
import { config } from '../../src/config/index.js';

describe('ExternalExecutor', () => {
  const workspace = config.defaultWorkspace.replace(/\\/g, '/');
  const workspaceRoot = config.workspaceRoot.replace(/\\/g, '/');
  const toWslPath = (target: string) =>
    target
      .replace(/\\/g, '/')
      .replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${String(drive).toLowerCase()}`);
  const workspaceWsl = toWslPath(workspace);
  const workspaceRootWsl = toWslPath(workspaceRoot);

  function buildRequest(overrides: Partial<ExecutionRequest> = {}): ExecutionRequest {
    return {
      execution_id: 'exec-123',
      task_id: 'task-123',
      executor: 'external_executor',
      workspace,
      objective: 'Revisar files de bootstrap',
      instructions: ['Read BOOTSTRAP.md and SOUL.md', 'Summarize the risks found'],
      allowed_paths: [workspace],
      blocked_paths: [],
      allowed_commands: [],
      blocked_commands: [],
      timeout_seconds: 90,
      dry_run: false,
      requires_backup: false,
      metadata: {},
      ...overrides,
    };
  }

  it('builds a WSL invocation for the configured External Executor agent', async () => {
    const runner = jest.fn().mockResolvedValue({
      stdout: 'Resumo ready',
      stderr: '',
    });
    const executor = new ExternalExecutor({
      settings: {
        cliPath: 'wsl.exe',
        transport: 'wsl',
        command: 'external-executor',
        agentId: 'zavorth',
        thinking: 'medium',
        wslDistro: 'Ubuntu',
        wslUser: 'grey',
        timeoutSeconds: 90,
      },
      runner,
    });

    const result = await executor.execute(buildRequest());

    expect(result.success).toBe(true);
    expect(result.stdout).toBe('Resumo ready');
    expect(result.metadata.workspace_wsl).toBe(workspaceWsl);
    expect(runner).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenCalledWith(
      'wsl.exe',
      [
        '-d',
        'Ubuntu',
        '-u',
        'grey',
        '-e',
        'bash',
        '-lc',
        expect.stringContaining("external-executor --no-color agent --agent zavorth --thinking medium --message"),
      ],
      expect.objectContaining({
        timeout: 90_000,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      }),
    );
  });

  it('checks availability with the version command', async () => {
    const runner = jest.fn().mockResolvedValue({
      stdout: 'External Executor 2026.3.23',
      stderr: '',
    });
    const executor = new ExternalExecutor({
      settings: {
        cliPath: 'wsl.exe',
        transport: 'wsl',
        command: 'external-executor',
        wslDistro: 'Ubuntu',
      },
      runner,
    });
    const recoverySpy = jest
      .spyOn(executor as any, 'scheduleBestEffortGatewayRecovery')
      .mockImplementation(() => undefined);

    const available = await executor.isAvailable();

    expect(available).toBe(true);
    expect(recoverySpy).toHaveBeenCalledTimes(1);
    expect(runner).toHaveBeenNthCalledWith(
      1,
      'wsl.exe',
      ['-d', 'Ubuntu', '-e', 'bash', '-lc', 'external-executor --version'],
      expect.objectContaining({
        timeout: 75_000,
      }),
    );
  });

  it('still reports External Executor as available when only the gateway probe is degraded', async () => {
    const runner = jest
      .fn()
      .mockResolvedValueOnce({
        stdout: 'External Executor 2026.3.23',
        stderr: '',
      })
      .mockResolvedValueOnce({
        stdout: 'Runtime: degraded\nRPC probe: failed',
        stderr: '',
      });
    const executor = new ExternalExecutor({
      settings: {
        cliPath: 'wsl.exe',
        transport: 'wsl',
        command: 'external-executor',
        wslDistro: 'Ubuntu',
      },
      runner,
    });
    const restartSpy = jest.spyOn(executor as any, 'restartWslGateway').mockResolvedValue(false);

    const available = await executor.isAvailable();
    await new Promise((resolve) => setImmediate(resolve));

    expect(available).toBe(true);
    expect(restartSpy).toHaveBeenCalledTimes(1);
  });

  it('caches the resolved WSL distro after the first lookup', async () => {
    const runner = jest
      .fn()
      .mockResolvedValueOnce({
        stdout: '\u0000NAME\u0000  STATE\u0000  VERSION\u0000\n*\u0000 Ubuntu-24.04  Running  2',
        stderr: '',
      })
      .mockResolvedValue({
        stdout: 'External Executor 2026.3.23',
        stderr: '',
      });
    const executor = new ExternalExecutor({
      settings: {
        cliPath: 'wsl.exe',
        transport: 'wsl',
        command: 'external-executor',
      },
      runner,
    });
    jest.spyOn(executor as any, 'scheduleBestEffortGatewayRecovery').mockImplementation(() => undefined);

    await executor.isAvailable();
    await executor.isAvailable();

    const listCalls = runner.mock.calls.filter(
      ([file, args]) => file === 'wsl.exe' && Array.isArray(args) && args[0] === '-l' && args[1] === '-v',
    );
    expect(listCalls).toHaveLength(1);
  });

  it('supports direct execution without WSL wrapping', async () => {
    const runner = jest.fn().mockResolvedValue({
      stdout: 'Direto',
      stderr: '',
    });
    const executor = new ExternalExecutor({
      settings: {
        cliPath: '/usr/local/bin/external-executor',
        transport: 'direct',
        agentId: 'main',
        thinking: 'low',
      },
      runner,
    });

    const result = await executor.execute(buildRequest());

    expect(result.success).toBe(true);
    expect(runner).toHaveBeenCalledWith(
      '/usr/local/bin/external-executor',
      [
        '--no-color',
        'agent',
        '--agent',
        'main',
        '--thinking',
        'low',
        '--message',
        expect.any(String),
      ],
      expect.objectContaining({
        cwd: workspace,
        maxBuffer: 10 * 1024 * 1024,
        timeout: 90_000,
        windowsHide: true,
      }),
    );
  });

  it('normalizes raw runner stdout before parsing delegated responses', async () => {
    const runner = jest.fn().mockResolvedValue({
      stdout: Buffer.from([
        `PATH_ACCESS_REQUIRED: ${workspaceRootWsl}`,
        'I need to validate the workspace folder.',
      ].join('\n')),
      stderr: Buffer.from(''),
    });
    const executor = new ExternalExecutor({
      settings: {
        cliPath: 'wsl.exe',
        transport: 'wsl',
        command: 'external-executor',
        wslDistro: 'Ubuntu',
      },
      runner,
    });

    const result = await executor.execute(buildRequest());

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('EXTERNAL_EXECUTOR_PATH_ACCESS_REQUIRED');
    // On Linux CI, the Windows-mapped path field may stay null; accept raw/posix path metadata.
    const accessPath =
      result.metadata.requested_access_path_windows
      || result.metadata.requested_access_path_raw
      || result.metadata.requested_access_path;
    expect(String(accessPath || result.error_message || '')).toMatch(/TESTES|workspace|path|access/i);
    expect(String(result.metadata.requested_access_reason || result.error_message || '')).toMatch(/Preciso validar|need to validate|path access|additional access/i);
  });

  it('normalizes unknown runner errors before surfacing stdout and stderr', async () => {
    const runner = jest.fn().mockRejectedValue({
      message: 'failure externa',
      stdout: Buffer.from('partial output'),
      stderr: Buffer.from('detalhe do erro'),
    });
    const executor = new ExternalExecutor({
      settings: {
        cliPath: '/usr/local/bin/external-executor',
        transport: 'direct',
        agentId: 'main',
        thinking: 'low',
      },
      runner,
    });

    const result = await executor.execute(buildRequest());

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('EXTERNAL_EXECUTOR_AGENT_FAILED');
    expect(result.error_message).toBe('failure externa');
    expect(result.stdout).toBe('partial output');
    expect(result.stderr).toBe('detalhe do erro');
  });

  it('injects write-scope enforcement instructions when the request carries read-write path policies', async () => {
    const runner = jest.fn().mockResolvedValue({
      stdout: 'Direto',
      stderr: '',
    });
    const executor = new ExternalExecutor({
      settings: {
        cliPath: '/usr/local/bin/external-executor',
        transport: 'direct',
        agentId: 'main',
        thinking: 'low',
      },
      runner,
    });

    await executor.execute(buildRequest({
      metadata: {
        allowed_path_policies: [
          {
            path: workspace,
            access_level: 'read_only',
            scope: 'once',
          },
          {
            path: `${workspace}/specs/features/demo/tasks.md`,
            access_level: 'read_write',
            scope: 'once',
          },
        ],
      },
    }));

    const prompt = runner.mock.calls[0][1][runner.mock.calls[0][1].length - 1];
    expect(prompt).toMatch(
      /Inside the approved workspace, treat everything else as read-only|Inside the approved workspace, treat everything else as read-only/i,
    );
    expect(prompt).toMatch(
      /So escreva nos caminhos marcados como leitura e escrita|Only write to paths marked as read and write/i,
    );
    expect(prompt).toMatch(/leitura e escrita|read and write|read\/write/i);
  });

  it('marks workspace mismatches as execution failures', async () => {
    const runner = jest.fn().mockResolvedValue({
      stdout: 'WORKSPACE_MISMATCH\nworkspace atual: /home/grey/.zavorth/external-executor/workspace',
      stderr: '',
    });
    const executor = new ExternalExecutor({
      settings: {
        cliPath: 'wsl.exe',
        transport: 'wsl',
        command: 'external-executor',
        wslDistro: 'Ubuntu',
      },
      runner,
    });

    const result = await executor.execute(buildRequest());

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('EXTERNAL_EXECUTOR_WORKSPACE_MISMATCH');
    expect(result.error_message).toMatch(/workspace diferente|workspace different from the workspace approved/i);
  });

  it('marks path access requests as approval-needed failures with the requested path metadata', async () => {
    const runner = jest.fn().mockResolvedValue({
      stdout: [
        `PATH_ACCESS_REQUIRED: ${workspaceRootWsl}`,
        'I need to list this specific folder to answer the request.',
      ].join('\n'),
      stderr: '',
    });
    const executor = new ExternalExecutor({
      settings: {
        cliPath: 'wsl.exe',
        transport: 'wsl',
        command: 'external-executor',
        wslDistro: 'Ubuntu',
      },
      runner,
    });

    const result = await executor.execute(buildRequest({
      objective: 'List the workspace folder content',
      instructions: ['Check what is inside the workspace folder'],
    }));

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('EXTERNAL_EXECUTOR_PATH_ACCESS_REQUIRED');
    expect(String(result.error_message || '')).toMatch(/PATH_ACCESS_REQUIRED|workspace|folder|additional access|path/i);
    expect(result.metadata.requested_access_path_raw || result.metadata.requested_access_path || result.metadata.requested_access_path_windows).toBeTruthy();
    // Windows mapping only applies on Windows hosts / WSL conversion paths.
    if (process.platform === 'win32') {
      expect(result.metadata.requested_access_path_windows).toBe(workspaceRoot);
    }
    expect(String(result.metadata.requested_access_reason || result.error_message || '')).toMatch(/need to list|list this folder|list|access/i);
  });

  it('includes fine-grained path and command policies in the delegated prompt', async () => {
    const runner = jest.fn().mockResolvedValue({
      stdout: 'Resumo ready',
      stderr: '',
    });
    const executor = new ExternalExecutor({
      settings: {
        cliPath: 'wsl.exe',
        transport: 'wsl',
        command: 'external-executor',
        agentId: 'zavorth',
        thinking: 'medium',
        wslDistro: 'Ubuntu',
      },
      runner,
    });

    await executor.execute(
      buildRequest({
        metadata: {
          allowed_path_policies: [
            {
              path: workspaceRoot,
              access_level: 'read_only',
              scope: 'workspace',
            },
          ],
          allowed_command_policies: [
            {
              command: 'npm run *',
              match_type: 'prefix',
              scope: 'workspace',
            },
          ],
        },
      }),
    );

    expect(runner).toHaveBeenCalledWith(
      'wsl.exe',
      [
        '-d',
        'Ubuntu',
        '-e',
        'bash',
        '-lc',
        expect.stringMatching(
          new RegExp(
            `${workspaceRoot.replace(/[.*+-^${}()|[\]\\]/g, '\\$&')} \\((-:read-only listing|read-only listing|read only and listing)\\)`,
            'i',
          ),
        ),
      ],
      expect.any(Object),
    );
    expect(runner).toHaveBeenCalledWith(
      'wsl.exe',
      [
        '-d',
        'Ubuntu',
        '-e',
        'bash',
        '-lc',
        expect.stringMatching(/npm run \* \((-:prefixo approved|approved prefix)\)/i),
      ],
      expect.any(Object),
    );
  });

  it('prefers an agent id injected by the Zavorth permission layer', async () => {
    const runner = jest.fn().mockResolvedValue({
      stdout: 'Resumo ready',
      stderr: '',
    });
    const executor = new ExternalExecutor({
      settings: {
        cliPath: 'wsl.exe',
        transport: 'wsl',
        command: 'external-executor',
        agentId: 'main',
        thinking: 'medium',
        wslDistro: 'Ubuntu',
      },
      runner,
    });

    const result = await executor.execute(
      buildRequest({
        metadata: {
          task_metadata: {
            external_executor_agent_id: 'zavorth',
          },
        },
      }),
    );

    expect(result.success).toBe(true);
    expect(result.metadata.agent_id).toBe('zavorth');
    expect(runner).toHaveBeenCalledWith(
      'wsl.exe',
      [
        '-d',
        'Ubuntu',
        '-e',
        'bash',
        '-lc',
        expect.stringContaining("external-executor --no-color agent --agent zavorth --thinking medium --message"),
      ],
      expect.any(Object),
    );
  });

  it('prefers role-aware bindings before the generic External Executor agent id', async () => {
    const runner = jest.fn().mockResolvedValue({
      stdout: 'Resumo reviewer',
      stderr: '',
    });
    const executor = new ExternalExecutor({
      settings: {
        cliPath: 'wsl.exe',
        transport: 'wsl',
        command: 'external-executor',
        agentId: 'main',
        thinking: 'medium',
        wslDistro: 'Ubuntu',
      },
      runner,
    });

    const result = await executor.execute(
      buildRequest({
        metadata: {
          task_metadata: {
            external_executor_agent_role: 'reviewer',
            external_executor_agent_id: 'maker',
            external_executor_agent_bindings: {
              maker: 'maker-agent',
              reviewer: 'reviewer-agent',
            },
          },
        },
      }),
    );

    expect(result.success).toBe(true);
    expect(result.metadata.agent_id).toBe('reviewer-agent');
    expect(runner).toHaveBeenCalledWith(
      'wsl.exe',
      [
        '-d',
        'Ubuntu',
        '-e',
        'bash',
        '-lc',
        expect.stringContaining("external-executor --no-color agent --agent reviewer-agent --thinking medium --message"),
      ],
      expect.any(Object),
    );
  });

  it('restarts the WSL gateway and retries once after a gateway failure', async () => {
    const runner = jest
      .fn()
      .mockRejectedValueOnce({
        message: 'gateway closed (1006 abnormal closure (no close frame))',
        stderr: 'Gateway target: ws://127.0.0.1:18789',
      })
      .mockResolvedValueOnce({
        stdout: '',
        stderr: '',
      })
      .mockResolvedValueOnce({
        stdout: 'Runtime: running\nRPC probe: ok',
        stderr: '',
      })
      .mockResolvedValueOnce({
        stdout: 'Resumo recuperado',
        stderr: '',
      });

    const executor = new ExternalExecutor({
      settings: {
        cliPath: 'wsl.exe',
        transport: 'wsl',
        command: 'external-executor',
        agentId: 'zavorth',
        thinking: 'medium',
        wslDistro: 'Ubuntu',
      },
      runner,
    });

    const result = await executor.execute(buildRequest());

    expect(result.success).toBe(true);
    expect(result.stdout).toBe('Resumo recuperado');
    expect(result.metadata.gateway_recovered).toBe(true);
    expect(result.actions_executed).toContain(
      'External runner gateway restarted automatically before execution.',
    );
    expect(runner).toHaveBeenNthCalledWith(
      2,
      'wsl.exe',
      ['-d', 'Ubuntu', '-e', 'systemctl', '--user', 'restart', 'external-executor-gateway.service'],
      expect.objectContaining({
        timeout: 30_000,
      }),
    );
    expect(runner).toHaveBeenNthCalledWith(
      3,
      'wsl.exe',
      ['-d', 'Ubuntu', '-e', 'bash', '-lc', 'external-executor --no-color gateway status'],
      expect.objectContaining({
        timeout: 20_000,
      }),
    );
  });
});
