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
      tools: {},
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

  // ── Phase 5A: Namespace & Legacy Allowlist ──────────────────────────────────

  it('approves namespaced tool by exact case-sensitive allowlist entry', () => {
    const policy = new McpToolPolicy({ profile: 'safe', allowlist: ['serverA:Calendar.Query'] });

    expect(policy.decide('serverA:Calendar.Query').allowed).toBe(true);
    // Different case is a different ID — must NOT be approved
    expect(policy.decide('serverA:calendar.query').allowed).toBe(false);
    expect(policy.decide('ServerA:Calendar.Query').allowed).toBe(false);
  });

  it('approves namespaced tool via legacy simple name when exactly one server exposes it', () => {
    const policy = new McpToolPolicy({ profile: 'safe', allowlist: ['search'] });
    const activeTools = ['serverA:search'];

    expect(policy.decide('serverA:search', activeTools).allowed).toBe(true);
  });

  it('does NOT auto-approve via legacy simple name when serverA:search appears first then serverB:search is also present', () => {
    // The full list must be evaluated — serverA appearing first must not bypass the collision check
    const policy = new McpToolPolicy({ profile: 'safe', allowlist: ['search'] });
    const activeTools = ['serverA:search', 'serverB:search'];

    expect(policy.decide('serverA:search', activeTools).allowed).toBe(false);
    expect(policy.decide('serverB:search', activeTools).allowed).toBe(false);
  });

  it('legacy simple name lookup is case-insensitive but the registered ID is preserved exactly', () => {
    // 'Search' (capital S) in allowlist should match 'serverA:search' (lowercase) as legacy fallback
    const policy = new McpToolPolicy({ profile: 'safe', allowlist: ['Search'] });
    const activeTools = ['serverA:search'];

    expect(policy.decide('serverA:search', activeTools).allowed).toBe(true);
    // 'serverA:Search' is a DIFFERENT namespaced ID — also matches via case-insensitive simple name
    const activeToolsCapital = ['serverA:Search'];
    expect(policy.decide('serverA:Search', activeToolsCapital).allowed).toBe(true);
  });

  it('reads and preserves the tools map from disk', () => {
    const document = McpToolPolicy.readDocument('X:/tmp/mcp-tool-policy.json', {
      existsSync: jest.fn(() => true),
      readFileSync: jest.fn(() => JSON.stringify({
        version: 2,
        updatedAt: '2026-06-12T00:00:00.000Z',
        profile: 'safe',
        allowlist: [],
        tools: {
          'serverA:search': {
            status: 'approved',
            fingerprint: 'abc123',
            description: 'search tool',
          },
          'serverB:write': {
            status: 'pending_approval',
            fingerprint: 'def456',
            pendingReason: 'new_tool',
          },
        },
      })) as any,
    });

    expect(document.tools?.['serverA:search']?.status).toBe('approved');
    expect(document.tools?.['serverB:write']?.status).toBe('pending_approval');
  });
});
