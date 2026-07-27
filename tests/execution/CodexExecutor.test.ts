import { CodexExecutor } from '../../src/execution/CodexExecutor';

describe('CodexExecutor', () => {
  it('delegates availability checks to the Codex CLI adapter', async () => {
    const adapter = {
      executePrompt: jest.fn(),
      isAvailable: jest.fn().mockResolvedValue(false),
    } as any;
    const executor = new CodexExecutor(adapter);

    await expect(executor.isAvailable()).resolves.toBe(false);
    expect(adapter.isAvailable).toHaveBeenCalledTimes(1);
  });

  it('forwards the built prompt and workspace to the adapter', async () => {
    const adapter = {
      executePrompt: jest.fn().mockResolvedValue({ success: true, stdout: 'ok' }),
      isAvailable: jest.fn().mockResolvedValue(true),
    } as any;
    const executor = new CodexExecutor(adapter);

    await executor.execute({
      execution_id: 'exec-1',
      task_id: 'task-1',
      executor: 'codex',
      workspace: 'C:/repo',
      objective: 'Corrigir o bug principal',
      instructions: ['Abra o modulo', 'Corrija o fluxo', 'Rode os testes'],
      allowed_paths: ['C:/repo', 'C:/repo/docs'],
      blocked_paths: [],
      allowed_commands: ['npm test'],
      blocked_commands: [],
      timeout_seconds: 120,
      dry_run: false,
      requires_backup: false,
      metadata: {
        source: 'test',
        allowed_path_policies: [
          {
            path: 'C:/repo',
            access_level: 'read_only',
            scope: 'once',
          },
          {
            path: 'C:/repo/docs',
            access_level: 'read_write',
            scope: 'once',
          },
        ],
      },
    });

    expect(adapter.executePrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        command_type: '/codex',
        executor_used: 'codex',
        workspace: 'C:/repo',
      }),
      expect.stringContaining('1. Abra o modulo'),
      'C:/repo',
      expect.objectContaining({
        dryRun: false,
        timeoutSeconds: 120,
      }),
    );
    expect(adapter.executePrompt.mock.calls[0][1]).toContain('Extra folders approved by Zavorth: C:/repo/docs');
    expect(adapter.executePrompt.mock.calls[0][1]).toContain('Zavorth write rule: treat the rest of the workspace as read-only.');
    expect(adapter.executePrompt.mock.calls[0][1]).toContain('Write approved scope by Zavorth: C:/repo/docs');
    expect(adapter.executePrompt.mock.calls[0][1]).toContain('Extra commands approved by Zavorth: npm test');
  });

  it('forwards the requested Codex profile to the adapter options', async () => {
    const adapter = {
      executePrompt: jest.fn().mockResolvedValue({ success: true, stdout: 'ok' }),
      isAvailable: jest.fn().mockResolvedValue(true),
    } as any;
    const executor = new CodexExecutor(adapter);

    await executor.execute({
      execution_id: 'exec-2',
      task_id: 'task-2',
      executor: 'codex',
      workspace: 'C:/repo',
      objective: 'Continue the current stage',
      instructions: ['Verifique o estado atual'],
      allowed_paths: ['C:/repo'],
      blocked_paths: [],
      allowed_commands: [],
      blocked_commands: [],
      timeout_seconds: 90,
      dry_run: false,
      requires_backup: false,
      metadata: {
        codex_profile_id: 'paid-alt',
      },
    });

    expect(adapter.executePrompt).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      'C:/repo',
      expect.objectContaining({
        profileId: 'paid-alt',
      }),
    );
  });
});
