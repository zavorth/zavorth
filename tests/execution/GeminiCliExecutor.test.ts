import {
  buildGeminiCliChildEnv,
  GeminiCliExecutor,
} from '../../src/execution/GeminiCliExecutor';

describe('GeminiCliExecutor', () => {
  function buildRequest() {
    return {
      execution_id: 'exec-gemini-1',
      task_id: 'task-gemini-1',
      executor: 'gemini_cli',
      workspace: __dirname,
      objective: 'Teste do Gemini CLI',
      instructions: ['Reply only with ZAVORTH_GEMINI_CLI_SMOKE_OK.'],
      allowed_paths: ['C:/workspace/zavorth'],
      blocked_paths: [],
      allowed_commands: [],
      blocked_commands: [],
      timeout_seconds: 120,
      dry_run: false,
      requires_backup: false,
      metadata: {},
    };
  }

  it('maps quota failures to a friendly classified error', async () => {
    const executor = new GeminiCliExecutor();
    jest.spyOn(executor as any, 'spawnGemini').mockRejectedValue({
      message: 'Gemini CLI saiu com codigo 1',
      stderr: 'TerminalQuotaError: You have exhausted your daily quota on this model.',
    });

    const result = await executor.execute(buildRequest() as any);

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('GEMINI_CLI_QUOTA_EXCEEDED');
    expect(result.error_message).toContain('quota da API');
    expect(result.metadata).toEqual(
      expect.objectContaining({
        gemini_failure_kind: 'quota_exceeded',
      }),
    );
  });

  it('does not inherit unrelated provider secrets into the Gemini CLI child env', () => {
    const env = buildGeminiCliChildEnv('explicit-gemini-key', {
      PATH: 'C:/bin',
      NODE_ENV: 'test',
      OPENAI_API_KEY: 'host-openai-secret',
      TELEGRAM_BOT_TOKEN: 'host-telegram-secret',
      GEMINI_TRANSCRIPTION_API_KEY: 'host-transcription-secret',
    });

    expect(env).toEqual({
      PATH: 'C:/bin',
      NODE_ENV: 'test',
      GEMINI_API_KEY: 'explicit-gemini-key',
    });
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.TELEGRAM_BOT_TOKEN).toBeUndefined();
    expect(env.GEMINI_TRANSCRIPTION_API_KEY).toBeUndefined();
  });

  it('blocks execution when the requested workspace is outside the allowed roots', async () => {
    const executor = new GeminiCliExecutor();
    const spawnGemini = jest.spyOn(executor as any, 'spawnGemini');
    const request = {
      ...buildRequest(),
      workspace: 'C:/definitely-outside-zavorth-policy',
    };

    const result = await executor.execute(request as any);

    expect(result.success).toBe(false);
    expect(result.error_message).toContain('Workspace');
    expect(spawnGemini).not.toHaveBeenCalled();
  });
});
