import type { DesktopApiRequest } from '../global';

export type PermissionScope = 'once' | 'session' | 'always' | 'deny';

export type PermissionSubject = 'workspace.filesystem.write' | 'workspace.filesystem.mkdir' | 'host.command';

export type ScopedApprovalResolution = {
  operationId: string;
  decision: 'approve' | 'deny';
  permission: {
    scope: PermissionScope;
    subject: PermissionSubject;
    workspaceId?: string | null;
    sessionId?: string | null;
    remember: boolean;
    revocable: boolean;
    expiresAt: string | null;
  };
};

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const DENY_TTL_MS = 30 * 60 * 1000;

export function describePermissionScope(scope: PermissionScope): string {
  switch (scope) {
    case 'once':
      return 'Allow only this pending operation. Nothing is remembered.';
    case 'session':
      return 'Allow matching low-risk operations until this desktop session expires.';
    case 'always':
      return 'Remember this trusted decision until you revoke it in settings.';
    case 'deny':
      return 'Deny this operation and remember the denial briefly to avoid repeated prompts.';
  }
}

export function buildScopedApprovalResolution(input: {
  operationId: string;
  decision: 'approve' | 'deny';
  scope: PermissionScope;
  subject: PermissionSubject;
  workspaceId?: string | null;
  sessionId?: string | null;
  now?: number;
}): ScopedApprovalResolution {
  const now = input.now ?? Date.now();
  const remember = input.scope === 'session' || input.scope === 'always' || input.scope === 'deny';
  const expiresAt = input.scope === 'session'
    ? new Date(now + SESSION_TTL_MS).toISOString()
    : input.scope === 'deny'
      ? new Date(now + DENY_TTL_MS).toISOString()
      : null;

  return {
    operationId: input.operationId,
    decision: input.decision,
    permission: {
      scope: input.scope,
      subject: input.subject,
      workspaceId: input.workspaceId ?? null,
      sessionId: input.sessionId ?? null,
      remember,
      revocable: remember,
      expiresAt,
    },
  };
}

export function buildPermissionRevocationRequest(input: {
  grantId: string;
  workspaceId?: string | null;
  reason: string;
}): DesktopApiRequest {
  return {
    method: 'POST',
    path: '/api/v2/workspace/permissions/revoke',
    body: {
      grantId: input.grantId,
      workspaceId: input.workspaceId ?? null,
      reason: input.reason,
    },
  };
}

