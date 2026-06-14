import { ToolExposurePolicy } from '../../../src/runtime/agent/ToolExposurePolicy.js';

describe('ToolExposurePolicy', () => {
  it('keeps Cognitive Firewall quarantined tools blocked in the universal exposure profile', () => {
    const policy = new ToolExposurePolicy();

    const profile = policy.buildProfile({
      toolHintProfile: {
        intentCategory: 'full_toolset',
        groups: ['all'],
        recommendedToolNames: ['read_file', 'plugin_send'],
        quarantinedToolNames: ['plugin_send'],
        toolExposureGatedByCognitiveFirewall: true,
        isHardGate: true,
        reason: 'plugin not trusted by operator',
      },
    });

    expect(profile.tools.map((tool) => tool.id)).toEqual(['read_file']);
    expect(profile.blockedTools).toEqual([
      expect.objectContaining({
        id: 'plugin_send',
        reason: 'blocked-by-cognitive-firewall-plugin-quarantine',
      }),
    ]);
    expect(profile.toolExposureGatedByCognitiveFirewall).toBe(true);
    expect(profile.toolExposureGatedByImportedCapabilityTrust).toBeUndefined();
    expect(profile.summary).toContain('1 ferramenta bloqueada');
  });

  it('keeps current behavior for trusted users (channelUserIdAllowed !== false)', () => {
    const policy = new ToolExposurePolicy();
    const profile = policy.buildProfile({
      requestedTools: ['read_file', 'write_file'],
      metadata: {
        channelUserIdAllowed: true,
      },
    });
    expect(profile.tools.map((t) => t.id)).toEqual(['read_file', 'write_file']);
    expect(profile.blockedTools).toBeUndefined();
  });

  it('restricts tools for untrusted users with safe-only mode (default)', () => {
    const policy = new ToolExposurePolicy();
    const profile = policy.buildProfile({
      requestedTools: ['read_file', 'write_file', 'network_fetch', 'random_tool'],
      metadata: {
        channelUserIdAllowed: false,
      },
    });
    expect(profile.tools.map((t) => t.id)).toEqual(['read_file']);
    expect(profile.blockedTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'write_file', reason: 'unauthorized-user-in-group' }),
        expect.objectContaining({ id: 'network_fetch', reason: 'unauthorized-user-in-group' }),
        expect.objectContaining({ id: 'random_tool', reason: 'unauthorized-user-in-group' }),
      ])
    );
  });

  it('blocks all tools for untrusted users in none mode', () => {
    const policy = new ToolExposurePolicy();
    const profile = policy.buildProfile({
      requestedTools: ['read_file', 'write_file'],
      metadata: {
        channelUserIdAllowed: false,
        groupToolPolicy: {
          untrustedUserMode: 'none',
        },
      },
    });
    expect(profile.tools).toEqual([]);
    expect(profile.blockedTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'read_file', reason: 'unauthorized-user-in-group' }),
        expect.objectContaining({ id: 'write_file', reason: 'unauthorized-user-in-group' }),
      ])
    );
  });

  it('allows only tools in allowlist for allowlist-only mode', () => {
    const policy = new ToolExposurePolicy();
    const profile = policy.buildProfile({
      requestedTools: ['read_file', 'write_file', 'network_fetch'],
      metadata: {
        channelUserIdAllowed: false,
        groupToolPolicy: {
          untrustedUserMode: 'allowlist-only',
          allowedToolsForUntrustedUsers: ['write_file'],
        },
      },
    });
    expect(profile.tools.map((t) => t.id)).toEqual(['write_file']);
    expect(profile.blockedTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'read_file', reason: 'unauthorized-user-in-group' }),
        expect.objectContaining({ id: 'network_fetch', reason: 'unauthorized-user-in-group' }),
      ])
    );
  });

  it('allows safe tools and allowlisted tools for safe-plus-allowlist mode', () => {
    const policy = new ToolExposurePolicy();
    const profile = policy.buildProfile({
      requestedTools: ['read_file', 'write_file', 'network_fetch'],
      metadata: {
        channelUserIdAllowed: false,
        groupToolPolicy: {
          untrustedUserMode: 'safe-plus-allowlist',
          allowedToolsForUntrustedUsers: ['write_file'],
        },
      },
    });
    expect(profile.tools.map((t) => t.id)).toEqual(['read_file', 'write_file']);
    expect(profile.blockedTools).toEqual([
      expect.objectContaining({ id: 'network_fetch', reason: 'unauthorized-user-in-group' }),
    ]);
  });

  it('keeps allowlisted tools blocked if they are blocked by global policy', () => {
    const policy = new ToolExposurePolicy();
    const profile = policy.buildProfile({
      requestedTools: ['read_file', 'write_file'],
      blockedTools: ['write_file'],
      blockedToolReason: 'blocked-globally',
      metadata: {
        channelUserIdAllowed: false,
        groupToolPolicy: {
          untrustedUserMode: 'allowlist-only',
          allowedToolsForUntrustedUsers: ['write_file'],
        },
      },
    });
    expect(profile.tools).toEqual([]);
    expect(profile.blockedTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'write_file', reason: 'blocked-globally' }),
        expect.objectContaining({ id: 'read_file', reason: 'unauthorized-user-in-group' }),
      ])
    );
  });

  it('applies workspace tool exposure permissions from metadata', () => {
    const policy = new ToolExposurePolicy();
    const profile = policy.buildProfile({
      requestedTools: [
        'workspace:workspace.git.status',
        'workspace_git_status',
        'workspace:workspace.filesystem.read',
        'workspace_filesystem_read',
        'workspace:workspace.filesystem.list',
        'workspace_filesystem_list',
        'workspace:workspace.filesystem.search',
        'workspace_filesystem_search',
        'workspace:workspace.filesystem.write',
        'workspace_filesystem_write',
        'workspace:workspace.notes.create',
        'workspace_notes_create',
      ],
      metadata: {
        workspace: {
          workspaceId: 'test-ws-123',
          rootPathHash: 'hash-abc',
          rootPathSuffix: 'suffix-abc',
          workspacePermissions: {
            gitReadOnly: true,
            filesystemRead: true,
            filesystemWrite: false,
            notes: false,
          },
        },
      },
    });

    const allowed = profile.tools.map((t) => t.id);
    expect(allowed).toContain('workspace:workspace.git.status');
    expect(allowed).toContain('workspace_git_status');
    expect(allowed).toContain('workspace:workspace.filesystem.read');
    expect(allowed).toContain('workspace_filesystem_read');
    expect(allowed).toContain('workspace:workspace.filesystem.list');
    expect(allowed).toContain('workspace_filesystem_list');
    expect(allowed).toContain('workspace:workspace.filesystem.search');
    expect(allowed).toContain('workspace_filesystem_search');
    expect(allowed).not.toContain('workspace:workspace.filesystem.write');
    expect(allowed).not.toContain('workspace_filesystem_write');
    expect(allowed).not.toContain('workspace:workspace.notes.create');
    expect(allowed).not.toContain('workspace_notes_create');

    expect(profile.blockedTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'workspace:workspace.filesystem.write', reason: 'global-policy-block' }),
        expect.objectContaining({ id: 'workspace_filesystem_write', reason: 'global-policy-block' }),
        expect.objectContaining({ id: 'workspace:workspace.notes.create', reason: 'global-policy-block' }),
        expect.objectContaining({ id: 'workspace_notes_create', reason: 'global-policy-block' }),
      ])
    );
  });

  it('blocks read/list/search when filesystemRead is false', () => {
    const policy = new ToolExposurePolicy();
    const profile = policy.buildProfile({
      requestedTools: [
        'workspace:workspace.filesystem.read',
        'workspace_filesystem_read',
        'workspace:workspace.filesystem.list',
        'workspace_filesystem_list',
        'workspace:workspace.filesystem.search',
        'workspace_filesystem_search',
      ],
      metadata: {
        workspace: {
          workspaceId: 'test-ws-123',
          workspacePermissions: {
            gitReadOnly: false,
            filesystemRead: false,
            filesystemWrite: false,
            notes: false,
          },
        },
      },
    });

    expect(profile.tools).toHaveLength(0);
    expect(profile.blockedTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'workspace:workspace.filesystem.read', reason: 'global-policy-block' }),
        expect.objectContaining({ id: 'workspace_filesystem_read', reason: 'global-policy-block' }),
        expect.objectContaining({ id: 'workspace:workspace.filesystem.list', reason: 'global-policy-block' }),
        expect.objectContaining({ id: 'workspace_filesystem_list', reason: 'global-policy-block' }),
        expect.objectContaining({ id: 'workspace:workspace.filesystem.search', reason: 'global-policy-block' }),
        expect.objectContaining({ id: 'workspace_filesystem_search', reason: 'global-policy-block' }),
      ])
    );
  });

  it('does not classify workspace:workspace.filesystem.gitignore.read as a git tool due to substring matching', () => {
    const policy = new ToolExposurePolicy();
    const profile = policy.buildProfile({
      requestedTools: [
        'workspace:workspace.filesystem.gitignore.read',
      ],
      metadata: {
        workspace: {
          workspaceId: 'test-ws-123',
          workspacePermissions: {
            gitReadOnly: false,
            filesystemRead: true,
            filesystemWrite: false,
            notes: false,
          },
        },
      },
    });

    const allowed = profile.tools.map((t) => t.id);
    expect(allowed).toContain('workspace:workspace.filesystem.gitignore.read');
    expect(profile.blockedTools).toBeUndefined();
  });

  it('blocks workspace tools when metadata.workspace is absent', () => {
    const policy = new ToolExposurePolicy();
    const profile = policy.buildProfile({
      requestedTools: [
        'workspace:workspace.filesystem.read',
        'workspace_filesystem_read',
        'workspace_git_status',
      ],
      metadata: {},
    });

    expect(profile.tools).toHaveLength(0);
    expect(profile.blockedTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'workspace:workspace.filesystem.read', reason: 'global-policy-block' }),
        expect.objectContaining({ id: 'workspace_filesystem_read', reason: 'global-policy-block' }),
        expect.objectContaining({ id: 'workspace_git_status', reason: 'global-policy-block' }),
      ])
    );
  });

  it('blocks workspace tools when workspacePermissions is absent', () => {
    const policy = new ToolExposurePolicy();
    const profile = policy.buildProfile({
      requestedTools: [
        'workspace_filesystem_read',
      ],
      metadata: {
        workspace: {
          workspaceId: 'test-ws-123',
        },
      },
    });

    expect(profile.tools).toHaveLength(0);
    expect(profile.blockedTools).toEqual([
      expect.objectContaining({ id: 'workspace_filesystem_read', reason: 'global-policy-block' }),
    ]);
  });

  it('allows workspace tools when workspacePermissions has true', () => {
    const policy = new ToolExposurePolicy();
    const profile = policy.buildProfile({
      requestedTools: [
        'workspace_filesystem_read',
      ],
      metadata: {
        workspace: {
          workspaceId: 'test-ws-123',
          workspacePermissions: {
            filesystemRead: true,
          },
        },
      },
    });

    expect(profile.tools.map(t => t.id)).toEqual(['workspace_filesystem_read']);
    expect(profile.blockedTools).toBeUndefined();
  });

  it('exposes workspace.temp_dir_trust.propose when workspace permissions allow it', () => {
    // Fase 21E-A: verify that the temporary directory trust propose tool is recognized
    // and can be exposed through the policy (basic registry coverage test)
    const policy = new ToolExposurePolicy();
    const profile = policy.buildProfile({
      requestedTools: [
        'workspace.temp_dir_trust.propose',
      ],
      metadata: {
        channelUserIdAllowed: true,
      },
    });
    // The tool should be in the exposed list when user is trusted
    expect(profile.tools.map(t => t.id)).toContain('workspace.temp_dir_trust.propose');
  });

  it('does NOT expose workspace.temp_dir_trust.propose to untrusted users', () => {
    const policy = new ToolExposurePolicy();
    const profile = policy.buildProfile({
      requestedTools: ['workspace.temp_dir_trust.propose'],
      metadata: {
        channelUserIdAllowed: false,
      },
    });
    expect(profile.tools.map(t => t.id)).not.toContain('workspace.temp_dir_trust.propose');
    expect(profile.blockedTools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'workspace.temp_dir_trust.propose', reason: 'unauthorized-user-in-group' }),
      ])
    );
  });

  it('exposes workspace.host_command tools when channel user is trusted', () => {
    const policy = new ToolExposurePolicy();
    const profile = policy.buildProfile({
      requestedTools: ['workspace.host_command.propose', 'workspace.host_command.run'],
      metadata: {
        channelUserIdAllowed: true,
      },
    });
    expect(profile.tools.map(t => t.id)).toContain('workspace.host_command.propose');
    expect(profile.tools.map(t => t.id)).toContain('workspace.host_command.run');
  });
});
