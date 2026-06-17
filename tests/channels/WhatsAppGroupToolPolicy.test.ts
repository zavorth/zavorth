import { ToolExposurePolicy } from '../../src/runtime/agent/ToolExposurePolicy.js';

describe('WhatsApp group tool policy', () => {
  it('safe-only exposes only safe tools to untrusted group participants', () => {
    const profile = buildProfile('safe-only');

    expect(profile.tools.map((tool) => tool.id)).toEqual(['read_file']);
    expect(profile.blockedTools).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'write_file', reason: 'unauthorized-user-in-group' }),
      expect.objectContaining({ id: 'network_fetch', reason: 'unauthorized-user-in-group' }),
      expect.objectContaining({ id: 'unknown_tool', reason: 'unauthorized-user-in-group' }),
    ]));
  });

  it('allowlist-only exposes only explicitly allowlisted tools to untrusted group participants', () => {
    const profile = buildProfile('allowlist-only', ['network_fetch']);

    expect(profile.tools.map((tool) => tool.id)).toEqual(['network_fetch']);
    expect(profile.blockedTools).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'read_file', reason: 'unauthorized-user-in-group' }),
      expect.objectContaining({ id: 'write_file', reason: 'unauthorized-user-in-group' }),
    ]));
  });

  it('safe-plus-allowlist exposes safe tools plus explicit allowlist entries', () => {
    const profile = buildProfile('safe-plus-allowlist', ['network_fetch']);

    expect(profile.tools.map((tool) => tool.id)).toEqual(['read_file', 'network_fetch']);
    expect(profile.blockedTools).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'write_file', reason: 'unauthorized-user-in-group' }),
      expect.objectContaining({ id: 'unknown_tool', reason: 'unauthorized-user-in-group' }),
    ]));
  });

  it('none exposes no tools to untrusted group participants', () => {
    const profile = buildProfile('none', ['read_file']);

    expect(profile.tools).toEqual([]);
    expect(profile.blockedTools?.map((tool) => tool.id)).toEqual(expect.arrayContaining([
      'read_file',
      'write_file',
      'network_fetch',
      'unknown_tool',
      'workspace:workspace.pty.spawn',
    ]));
  });

  it('blocks high critical provider-secret HPM and PTY tools for untrusted group participants', () => {
    const policy = new ToolExposurePolicy();
    const profile = policy.buildProfile({
      requestedTools: [
        'provider.secret.rotate',
        'workspace:workspace.pty.spawn',
        'workspace:workspace.host.execute',
        'critical.activation',
        'read_file',
      ],
      metadata: {
        auditLogger: silentAuditLogger,
        channelUserIdAllowed: false,
        groupToolPolicy: {
          untrustedUserMode: 'safe-plus-allowlist',
          allowedToolsForUntrustedUsers: [
            'provider.secret.rotate',
            'workspace:workspace.pty.spawn',
            'workspace:workspace.host.execute',
            'critical.activation',
          ],
        },
      },
    });

    expect(profile.tools.map((tool) => tool.id)).toEqual(['read_file']);
    expect(profile.blockedTools).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'provider.secret.rotate', reason: 'unauthorized-user-in-group' }),
      expect.objectContaining({ id: 'critical.activation', reason: 'unauthorized-user-in-group' }),
    ]));
    expect(profile.blockedTools?.map((tool) => tool.id)).toEqual(expect.arrayContaining([
      'workspace:workspace.pty.spawn',
      'workspace:workspace.host.execute',
    ]));
  });

  it('trusted individual users keep normal authorized tool behavior in a group context', () => {
    const policy = new ToolExposurePolicy();
    const profile = policy.buildProfile({
      requestedTools: ['read_file', 'write_file'],
      metadata: {
        auditLogger: silentAuditLogger,
        channelUserIdAllowed: true,
        groupToolPolicy: { untrustedUserMode: 'none' },
      },
    });

    expect(profile.tools.map((tool) => tool.id)).toEqual(['read_file', 'write_file']);
  });
});

function buildProfile(
  untrustedUserMode: 'none' | 'safe-only' | 'allowlist-only' | 'safe-plus-allowlist',
  allowedToolsForUntrustedUsers: string[] = [],
) {
  const policy = new ToolExposurePolicy();
  return policy.buildProfile({
    requestedTools: ['read_file', 'write_file', 'network_fetch', 'unknown_tool', 'workspace:workspace.pty.spawn'],
    metadata: {
      auditLogger: silentAuditLogger,
      channelUserIdAllowed: false,
      groupToolPolicy: {
        untrustedUserMode,
        allowedToolsForUntrustedUsers,
      },
    },
  });
}

const silentAuditLogger = {
  logToolExposureDecision: jest.fn(),
  logWorkspaceEvent: jest.fn(),
};
