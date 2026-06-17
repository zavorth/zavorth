import { SafeMcpInstaller } from '../../src/mcp/SafeMcpInstaller';

describe('SafeMcpInstaller fingerprint drift', () => {
  it('fingerprints include serverId, toolName and inputSchema, and schema drift invalidates approval', async () => {
    const policy: any = {
      version: 1,
      updatedAt: null,
      profile: 'safe',
      allowlist: ['docs:search'],
      tools: {
        'docs:search': {
          status: 'approved',
          fingerprint: SafeMcpInstaller.computeToolFingerprint('docs', 'search', { type: 'object', properties: { q: { type: 'string' } } }),
          description: 'Old',
        },
      },
    };
    const manifest: any[] = [];
    const installer = new SafeMcpInstaller({
      now: () => new Date('2026-06-17T12:00:00.000Z'),
      manifestStore: { list: () => manifest, save: (next) => manifest.splice(0, manifest.length, ...next) },
      policyStore: { read: () => policy, save: (next) => Object.assign(policy, next) },
      discovery: {
        discover: jest.fn(async () => ({
          ok: true,
          tools: [{ name: 'search', description: 'New', inputSchema: { type: 'object', properties: { q: { type: 'string' }, limit: { type: 'number' } } }, risk: 'safe' }],
          stdout: '',
          stderr: '',
          sandbox: { cwd: 'C:/sandbox', restrictedEnv: true, timeoutMs: 1000, killedOnTimeout: false },
        })),
      },
      auditSink: { write: jest.fn() },
    });

    const oldFingerprint = policy.tools['docs:search'].fingerprint;
    const result = await installer.install({ id: 'docs', command: 'node', confirmInstall: true });

    expect(result.ok).toBe(true);
    expect(policy.tools['docs:search'].fingerprint).not.toBe(oldFingerprint);
    expect(policy.tools['docs:search']).toEqual(expect.objectContaining({
      status: 'pending_approval',
      pendingReason: 'schema_drift',
    }));
    expect(policy.allowlist).not.toContain('docs:search');
    expect(SafeMcpInstaller.computeToolFingerprint('other', 'search', { type: 'object' }))
      .not.toBe(SafeMcpInstaller.computeToolFingerprint('docs', 'search', { type: 'object' }));
  });
});
