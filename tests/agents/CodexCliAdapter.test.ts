import {
  buildCodexCliChildEnv,
  CodexCliAdapter,
} from '../../src/agents/CodexCliAdapter';
import { config } from '../../src/config/index.js';

describe('CodexCliAdapter', () => {
  it('resolves the selected Codex Remote profile and passes CODEX_HOME through metadata and execution', async () => {
    const resolveExecutionProfile = jest.fn(() => ({
      id: 'work',
      label: 'Work Codex',
      description: 'Perfil de trabalho',
      codexCliPath: 'C:\\Codex\\work\\codex.exe',
      codexHome: 'C:\\Users\\ermys\\.codex-work',
      workspaceRoot: config.defaultWorkspace,
      enabled: true,
      active: true,
      source: 'stored',
    }));
    const adapter = new CodexCliAdapter({
      resolveExecutionProfile,
    } as any) as any;

    adapter.runCodex = jest.fn(async () => ({ stdout: 'ok', stderr: '' }));
    adapter.readOutputFile = jest.fn(async () => '');

    const result = await adapter.executePrompt(
      {
        task_id: 'task-codex-profile-1',
      } as any,
      'implement the change',
      config.defaultWorkspace,
      {
        profileId: 'work',
      },
    );

    expect(resolveExecutionProfile).toHaveBeenCalledWith('work');
    expect(adapter.runCodex).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(String),
      config.codexTimeoutSeconds,
      expect.objectContaining({
        id: 'work',
        codexHome: 'C:\\Users\\ermys\\.codex-work',
      }),
    );
    expect(result.metadata).toEqual(
      expect.objectContaining({
        codex_profile_id: 'work',
        codex_home: 'C:\\Users\\ermys\\.codex-work',
        cli_path: 'C:\\Codex\\work\\codex.exe',
      }),
    );
  });

  it('does not inherit unrelated provider secrets into the Codex CLI child env', () => {
    const env = buildCodexCliChildEnv(
      {
        codexHome: 'C:\\Users\\ermys\\.codex-work',
      },
      {
        PATH: 'C:/bin',
        NODE_ENV: 'test',
        OPENAI_API_KEY: 'host-openai-secret',
        GEMINI_API_KEY: 'host-gemini-secret',
        TELEGRAM_BOT_TOKEN: 'host-telegram-secret',
      },
    );

    expect(env).toEqual({
      PATH: 'C:/bin',
      NODE_ENV: 'test',
      CODEX_HOME: 'C:\\Users\\ermys\\.codex-work',
    });
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.TELEGRAM_BOT_TOKEN).toBeUndefined();
  });
});
