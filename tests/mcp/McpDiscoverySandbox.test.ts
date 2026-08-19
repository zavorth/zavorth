import { McpDiscoverySandbox } from '../../src/mcp/SafeMcpInstaller';
import path from 'path';

describe('McpDiscoverySandbox', () => {
  it('runs discovery with restricted env and sandbox cwd', async () => {
    const calls: any[] = [];
    const sandbox = new McpDiscoverySandbox({
      sandboxCwd: 'C:/tmp/zavorth-mcp-sandbox',
      runner: async (request) => {
        calls.push(request);
        return { ok: true, tools: [], stdout: 'ok', stderr: '' };
      },
    });

    const result = await sandbox.discover({
      serverId: 'docs',
      command: 'node',
      args: ['server.js'],
      env: { OPENAI_API_KEY: 'secret', SAFE_FLAG: '1' },
      allowedEnv: ['SAFE_FLAG'],
      timeoutMs: 250,
    });

    expect(result.ok).toBe(true);
    expect(calls[0]).toEqual(expect.objectContaining({
      cwd: path.resolve('C:/tmp/zavorth-mcp-sandbox'),
      timeoutMs: 250,
      env: { SAFE_FLAG: '1' },
    }));
    expect(result.sandbox).toEqual(expect.objectContaining({
      cwd: path.resolve('C:/tmp/zavorth-mcp-sandbox'),
      restrictedEnv: true,
      timeoutMs: 250,
    }));
  });

  it('fails closed and kills discovery on timeout', async () => {
    const kill = jest.fn();
    const sandbox = new McpDiscoverySandbox({
      sandboxCwd: 'C:/tmp/zavorth-mcp-sandbox',
      runner: () => new Promise(() => {}),
      kill,
    });

    const result = await sandbox.discover({
      serverId: 'slow',
      command: 'node',
      args: [],
      env: {},
      allowedEnv: [],
      timeoutMs: 1,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('timed out');
    expect(result.sandbox.killedOnTimeout).toBe(true);
    expect(kill).toHaveBeenCalledWith('slow');
  });
});
