import { SafeMcpInstaller } from '../../src/mcp/SafeMcpInstaller';

describe('SafeMcpInstaller audit sanitization', () => {
  it('sanitizes forbidden secret markers from audit records and summaries', async () => {
    const records: any[] = [];
    const installer = new SafeMcpInstaller({
      manifestStore: { list: () => [], save: jest.fn() },
      policyStore: { read: () => ({ version: 1, updatedAt: null, profile: 'safe', allowlist: [], tools: {} }), save: jest.fn() },
      discovery: {
        discover: jest.fn(async () => ({
          ok: true,
          tools: [{ name: 'read', inputSchema: { type: 'object' }, risk: 'safe' }],
          stdout: 'Authorization: Bearer sk-live OPENAI_API_KEY=abc secretRef=prod rawKey=123 ciphertext=x authTag=y',
          stderr: 'BEGIN PRIVATE KEY\nabc\nGOOGLE_API_KEY=xyz',
          sandbox: { cwd: 'C:/sandbox', restrictedEnv: true, timeoutMs: 1000, killedOnTimeout: false },
        })),
      },
      auditSink: { write: (record) => records.push(record) },
    });

    const result = await installer.install({
      id: 'safe',
      command: 'node',
      env: { ANTHROPIC_API_KEY: 'secret' },
      confirmInstall: true,
    });

    const serialized = JSON.stringify({ result, records });
    expect(result.ok).toBe(true);
    expect(serialized).not.toMatch(/Authorization|Bearer|secretRef|apiKey|rawKey|ciphertext|authTag|BEGIN PRIVATE KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|GOOGLE_API_KEY/);
    expect(serialized).toContain('[REDACTED]');
  });
});
