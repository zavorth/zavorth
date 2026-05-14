import { buildChildProcessEnv } from '../../src/security/ChildProcessEnv.js';

describe('buildChildProcessEnv', () => {
  it('keeps child processes on a minimal env by default', () => {
    const env = buildChildProcessEnv({
      hostEnv: {
        PATH: 'C:/bin',
        NODE_ENV: 'test',
        OPENAI_API_KEY: 'host-openai-secret',
        GEMINI_API_KEY: 'host-gemini-secret',
        TELEGRAM_BOT_TOKEN: 'host-telegram-secret',
      },
    });

    expect(env).toEqual({
      PATH: 'C:/bin',
      NODE_ENV: 'test',
    });
  });

  it('requires explicit env or an allowlist for additional values', () => {
    const env = buildChildProcessEnv({
      explicitEnv: {
        GEMINI_API_KEY: 'explicit-gemini-secret',
      },
      allowedEnv: ['HTTPS_PROXY', ' TELEGRAM_BOT_TOKEN ', ''],
      hostEnv: {
        PATH: 'C:/bin',
        HTTPS_PROXY: 'http://proxy.local',
        TELEGRAM_BOT_TOKEN: 'host-telegram-secret',
        OPENAI_API_KEY: 'host-openai-secret',
      },
    });

    expect(env).toEqual({
      PATH: 'C:/bin',
      HTTPS_PROXY: 'http://proxy.local',
      TELEGRAM_BOT_TOKEN: 'host-telegram-secret',
      GEMINI_API_KEY: 'explicit-gemini-secret',
    });
    expect(env.OPENAI_API_KEY).toBeUndefined();
  });
});
