import { McpToolPolicy } from '../../src/mcp/McpToolPolicy.js';

describe('McpToolPolicy', () => {
  it('merges the persisted policy file with env overrides', () => {
    const policy = McpToolPolicy.fromEnv(
      {
        ZAVORTH_MCP_PROFILE: 'trusted',
        ZAVORTH_MCP_ALLOW_TOOLS: 'remote_shell',
      },
      {
        policyFile: 'X:/tmp/mcp-tool-policy.json',
        existsSync: jest.fn(() => true),
        readFileSync: jest.fn(() => JSON.stringify({
          version: 1,
          updatedAt: '2026-04-12T09:00:00.000Z',
          profile: 'safe',
          allowlist: ['desktop_automation'],
        })) as any,
      },
    );

    expect(policy.profile).toBe('trusted');
    expect(policy.getAllowlist()).toEqual(['desktop_automation', 'remote_shell']);
  });

  it('reads the policy document from disk helpers', () => {
    const document = McpToolPolicy.readDocument('X:/tmp/mcp-tool-policy.json', {
      existsSync: jest.fn(() => true),
      readFileSync: jest.fn(() => JSON.stringify({
        version: 1,
        updatedAt: '2026-04-12T10:00:00.000Z',
        profile: 'dangerous',
        allowlist: ['desktop_automation', 'REMOTE_SHELL'],
      })) as any,
    });

    expect(document).toEqual({
      version: 1,
      updatedAt: '2026-04-12T10:00:00.000Z',
      profile: 'dangerous',
      allowlist: ['desktop_automation', 'remote_shell'],
    });
  });

  it('emits broker receipts for admin-gated MCP tools', () => {
    const decision = new McpToolPolicy({ profile: 'safe' }).decide('remote_shell');

    expect(decision.allowed).toBe(false);
    expect(decision.policyAction).toBe('require_admin_policy');
    expect(decision.policyReceipt).toEqual(expect.objectContaining({
      surface: 'mcp',
      action: 'require_admin_policy',
      target: 'remote_shell',
    }));
  });
});
