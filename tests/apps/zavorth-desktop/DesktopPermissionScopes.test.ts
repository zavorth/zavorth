import {
  buildPermissionRevocationRequest,
  buildScopedApprovalResolution,
  describePermissionScope,
  type PermissionScope,
} from '../../../apps/zavorth-desktop/src/security/permissionScopes';

describe('desktop scoped permission policy', () => {
  const now = Date.parse('2026-06-29T12:00:00.000Z');

  it.each<PermissionScope>(['once', 'session', 'always', 'deny'])(
    'describes %s in user-facing language',
    scope => {
      expect(describePermissionScope(scope)).toEqual(expect.any(String));
      expect(describePermissionScope(scope).length).toBeGreaterThan(10);
    },
  );

  it('builds a one-time approval that is not persisted', () => {
    expect(buildScopedApprovalResolution({
      operationId: 'op-1',
      decision: 'approve',
      scope: 'once',
      subject: 'workspace.filesystem.write',
      workspaceId: 'local',
      sessionId: 'session-1',
      now,
    })).toEqual({
      operationId: 'op-1',
      decision: 'approve',
      permission: {
        scope: 'once',
        subject: 'workspace.filesystem.write',
        workspaceId: 'local',
        sessionId: 'session-1',
        remember: false,
        revocable: false,
        expiresAt: null,
      },
    });
  });

  it('builds session and always grants with explicit revocation metadata', () => {
    expect(buildScopedApprovalResolution({
      operationId: 'op-2',
      decision: 'approve',
      scope: 'session',
      subject: 'host.command',
      workspaceId: 'local',
      sessionId: 'session-2',
      now,
    }).permission).toMatchObject({
      scope: 'session',
      remember: true,
      revocable: true,
      expiresAt: '2026-06-29T20:00:00.000Z',
    });

    expect(buildScopedApprovalResolution({
      operationId: 'op-3',
      decision: 'approve',
      scope: 'always',
      subject: 'workspace.filesystem.write',
      workspaceId: 'local',
      sessionId: 'session-3',
      now,
    }).permission).toMatchObject({
      scope: 'always',
      remember: true,
      revocable: true,
      expiresAt: null,
    });
  });

  it('builds a temporary deny grant and a revocation request', () => {
    expect(buildScopedApprovalResolution({
      operationId: 'op-4',
      decision: 'deny',
      scope: 'deny',
      subject: 'host.command',
      workspaceId: 'local',
      sessionId: 'session-4',
      now,
    }).permission).toMatchObject({
      scope: 'deny',
      remember: true,
      revocable: true,
      expiresAt: '2026-06-29T12:30:00.000Z',
    });

    expect(buildPermissionRevocationRequest({
      grantId: 'grant-1',
      workspaceId: 'local',
      reason: 'User revoked from settings',
    })).toEqual({
      method: 'POST',
      path: '/api/v2/workspace/permissions/revoke',
      body: {
        grantId: 'grant-1',
        workspaceId: 'local',
        reason: 'User revoked from settings',
      },
    });
  });
});
