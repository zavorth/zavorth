import { buildMcpChildEnv, normalizeMcpToolName } from '../../src/mcp/McpClientManager';

describe('McpClientManager env isolation', () => {
  it('does not pass provider secrets from the host env by default', () => {
    const env = buildMcpChildEnv(
      {
        STITCH_API_KEY: 'explicit-stitch-key',
      },
      [],
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
      STITCH_API_KEY: 'explicit-stitch-key',
    });
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.GEMINI_API_KEY).toBeUndefined();
    expect(env.TELEGRAM_BOT_TOKEN).toBeUndefined();
  });

  it('inherits only env keys explicitly allowed by the manifest', () => {
    const env = buildMcpChildEnv(
      {},
      ['HTTPS_PROXY'],
      {
        PATH: 'C:/bin',
        HTTPS_PROXY: 'http://proxy.local:8080',
        OPENAI_API_KEY: 'host-openai-secret',
      },
    );

    expect(env).toEqual({
      PATH: 'C:/bin',
      HTTPS_PROXY: 'http://proxy.local:8080',
    });
  });

  it('normalizes remote MCP tool names before exposing them to the native registry', () => {
    expect(normalizeMcpToolName('Read-File ../Secrets')).toBe('read_file_secrets');
    expect(normalizeMcpToolName('  $$$  ')).toBe('');
    expect(normalizeMcpToolName('A'.repeat(100))).toHaveLength(64);
  });
});
