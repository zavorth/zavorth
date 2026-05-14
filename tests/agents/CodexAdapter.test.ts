import { CodexAdapter } from '../../src/agents/CodexAdapter';

describe('CodexAdapter', () => {
  it('delegates legacy executeDirect calls to the real Codex CLI adapter', async () => {
    const cliAdapter = {
      executeDirect: jest.fn().mockResolvedValue({
        success: true,
        stdout: 'ok',
        stderr: null,
      }),
    } as any;
    const adapter = new CodexAdapter(cliAdapter);
    const task = {
      task_id: 'task-codex-1',
      normalized_message: '/codex revise o modulo atual',
    } as any;

    const result = await adapter.executeDirect(task, ['revise o modulo atual'], 'core');

    expect(cliAdapter.executeDirect).toHaveBeenCalledWith(
      task,
      ['revise o modulo atual'],
      'core',
    );
    expect(result.success).toBe(true);
  });
});
