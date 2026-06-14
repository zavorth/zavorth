/**
 * Fase 21K-A — ToolExposurePolicy × AgentWorkspaceConfig Smoke Tests
 *
 * Validates that ToolExposurePolicy correctly applies AgentWorkspaceConfig
 * as a narrowing policy over tool exposure:
 *   - PTY tools blocked unless allowPty=true AND allowHostPowerMode=true
 *   - HPM tools blocked unless allowHostPowerMode=true
 *   - Developer tools blocked unless allowDeveloperMode=true
 *   - Task mandate tools blocked unless allowTaskMandates=true
 *   - Temporary directory trust tools blocked unless allowTemporaryDirectoryTrust=true
 *
 * Security marker: sk-zavorth-e2e-runtime-smoke-DO-NOT-LEAK-21K-A
 * Must NEVER appear outside tests/mocks.
 */

import { ToolExposurePolicy } from '../../../src/runtime/agent/ToolExposurePolicy.js';

const SMOKE_MARKER = 'sk-zavorth-e2e-runtime-smoke-DO-NOT-LEAK-21K-A';

/**
 * Builds metadata.workspace in the shape that ToolExposurePolicy.buildProfile expects.
 * Uses `metadata.workspace` with `workspacePermissions` (internal API).
 */
function buildWorkspaceMeta(overrides: Partial<{
  allowDeveloperMode: boolean;
  allowHostPowerMode: boolean;
  allowPty: boolean;
  allowTaskMandates: boolean;
  allowTemporaryDirectoryTrust: boolean;
  allowProviderFallback: boolean;
}> = {}) {
  return {
    workspaceId: 'test-ws-21k-a',
    workspaceRoot: 'C:/TESTES DEV/1_PROJETOS_ATIVOS/Zavorth',
    rootPathHash: 'hash-test',
    rootPathSuffix: 'Zavorth',
    workspacePermissions: {
      gitReadOnly: true,
      filesystemRead: true,
      filesystemWrite: false,
      notes: false,
    },
    config: {
      workspaceId: 'test-ws-21k-a',
      allowedCapabilities: ['chat'],
      defaultAutonomyProfile: 'safe' as const,
      allowDeveloperMode: false,
      allowHostPowerMode: false,
      allowPty: false,
      allowTaskMandates: true,
      allowTemporaryDirectoryTrust: false,
      allowProviderFallback: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    }
  };
}

describe('AgentWorkspaceToolPolicySmoke — Fase 21K-A', () => {
  const policy = new ToolExposurePolicy();

  // -----------------------------------------------------------------------
  // 1. Safe defaults block risky tools
  // -----------------------------------------------------------------------
  describe('safe default config blocks all risky tools', () => {
    it('PTY tool is blocked when allowPty=false (default)', () => {
      const workspace = buildWorkspaceMeta();
      const profile = policy.buildProfile({
        requestedTools: ['workspace_pty_start'],
        metadata: { workspace }
      } as any);

      const blocked = profile.blockedTools?.some(b => b.id === 'workspace_pty_start');
      expect(blocked).toBe(true);
    });

    it('HPM tool is blocked when allowHostPowerMode=false (default)', () => {
      const workspace = buildWorkspaceMeta();
      const profile = policy.buildProfile({
        requestedTools: ['workspace_host_power_enable'],
        metadata: { workspace }
      } as any);

      const blocked = profile.blockedTools?.some(b => b.id === 'workspace_host_power_enable');
      expect(blocked).toBe(true);
    });

    it('developer tool is blocked when allowDeveloperMode=false (default)', () => {
      const workspace = buildWorkspaceMeta();
      const profile = policy.buildProfile({
        requestedTools: ['workspace_developer_repl'],
        metadata: { workspace }
      } as any);

      const blocked = profile.blockedTools?.some(b => b.id === 'workspace_developer_repl');
      expect(blocked).toBe(true);
    });

    it('temp directory trust tool is blocked when allowTemporaryDirectoryTrust=false (default)', () => {
      const workspace = buildWorkspaceMeta();
      const profile = policy.buildProfile({
        requestedTools: ['workspace_trust_tmp_add'],
        metadata: { workspace }
      } as any);

      const blocked = profile.blockedTools?.some(b => b.id === 'workspace_trust_tmp_add');
      expect(blocked).toBe(true);
    });

    it('filesystem read tool is allowed with filesystemRead=true', () => {
      const workspace = buildWorkspaceMeta();
      // Use full workspace tool set as in the existing ToolExposurePolicy tests
      const profile = policy.buildProfile({
        requestedTools: ['workspace_filesystem_read', 'workspace_git_status'],
        metadata: { workspace }
      } as any);

      const allowed = profile.tools.map(t => t.id);
      expect(allowed).toContain('workspace_filesystem_read');
    });
  });

  // -----------------------------------------------------------------------
  // 2. PTY requires BOTH allowPty=true AND allowHostPowerMode=true
  // -----------------------------------------------------------------------
  describe('PTY requires both allowPty and allowHostPowerMode', () => {
    it('PTY tool blocked when only allowPty=true but allowHostPowerMode=false', () => {
      const workspace = buildWorkspaceMeta({ allowPty: true, allowHostPowerMode: false });
      const profile = policy.buildProfile({
        requestedTools: ['workspace_pty_start'],
        metadata: { workspace }
      } as any);

      const blockedByPtyPolicy = profile.blockedTools?.some(b => b.id === 'workspace_pty_start');
      expect(blockedByPtyPolicy).toBe(true);
    });

    it('PTY tool blocked when only allowHostPowerMode=true but allowPty=false', () => {
      const workspace = buildWorkspaceMeta({ allowPty: false, allowHostPowerMode: true });
      const profile = policy.buildProfile({
        requestedTools: ['workspace_pty_start'],
        metadata: { workspace }
      } as any);

      const blockedByPtyPolicy = profile.blockedTools?.some(b => b.id === 'workspace_pty_start');
      expect(blockedByPtyPolicy).toBe(true);
    });

    it('PTY tool not blocked by workspace-config when both allowPty=true AND allowHostPowerMode=true', () => {
      const workspace = buildWorkspaceMeta({ allowPty: true, allowHostPowerMode: true });
      const profile = policy.buildProfile({
        requestedTools: ['workspace_pty_start'],
        metadata: { workspace }
      } as any);

      // Must not be in blockedTools with the pty-denied reason
      const blockedByWorkspaceConfig = profile.blockedTools?.some(
        b => b.id === 'workspace_pty_start' && b.reason?.includes('pty')
      );
      expect(blockedByWorkspaceConfig).toBeFalsy();
    });
  });

  // -----------------------------------------------------------------------
  // 3. Developer Mode — gating only
  // -----------------------------------------------------------------------
  describe('developer mode is gating only', () => {
    it('allowDeveloperMode=true removes the workspace-config-denied-developer-mode block', () => {
      const workspace = buildWorkspaceMeta({ allowDeveloperMode: true });
      const profile = policy.buildProfile({
        requestedTools: ['workspace_developer_repl'],
        metadata: { workspace }
      } as any);

      const blockedByDeveloperConfig = profile.blockedTools?.some(
        b => b.id === 'workspace_developer_repl' && b.reason?.includes('developer-mode')
      );
      expect(blockedByDeveloperConfig).toBeFalsy();
    });
  });

  // -----------------------------------------------------------------------
  // 4. Task mandates and temp directory trust
  // -----------------------------------------------------------------------
  describe('task mandates and temporary directory trust', () => {
    it('mandate tool allowed when allowTaskMandates=true (default)', () => {
      const workspace = buildWorkspaceMeta({ allowTaskMandates: true });
      const profile = policy.buildProfile({
        requestedTools: ['workspace_mandate_create'],
        metadata: { workspace }
      } as any);

      const blockedByTaskMandates = profile.blockedTools?.some(
        b => b.id === 'workspace_mandate_create' && b.reason?.includes('task-mandates')
      );
      expect(blockedByTaskMandates).toBeFalsy();
    });

    it('mandate tool blocked when allowTaskMandates=false', () => {
      const workspace = buildWorkspaceMeta({ allowTaskMandates: false });
      const profile = policy.buildProfile({
        requestedTools: ['workspace_mandate_create'],
        metadata: { workspace }
      } as any);

      const blocked = profile.blockedTools?.some(b => b.id === 'workspace_mandate_create');
      expect(blocked).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 5. Profile output never contains smoke marker
  // -----------------------------------------------------------------------
  describe('tool profile output security', () => {
    it('profile summary never contains the smoke security marker', () => {
      const workspace = buildWorkspaceMeta();
      const profile = policy.buildProfile({
        requestedTools: ['workspace_filesystem_read', 'workspace_pty_start'],
        metadata: { workspace }
      } as any);

      const serialized = JSON.stringify(profile);
      expect(serialized).not.toContain(SMOKE_MARKER);
      expect(serialized).not.toContain('sk-');
      expect(serialized).not.toContain('Authorization');
      expect(serialized).not.toContain('Bearer');
      expect(serialized).not.toContain('secretRef');
    });
  });
});
