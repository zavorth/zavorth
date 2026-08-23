export const PERMISSION_CALLBACK_PREFIX = 'perm:';

export type PermissionCallbackScope = 'once' | 'session' | 'workspace' | 'persistent';

/**
 * Normalized decision carried by a legacy `perm:*` callback. Approve
 * callbacks may carry a scope token (`scope: null` when absent); reject
 * callbacks never do.
 */
export type ParsedPermissionCallback =
  | { action: 'approve'; reference: string; scope: PermissionCallbackScope | null }
  | { action: 'deny'; reference: string };

const PERMISSION_CALLBACK_PATTERN =
  /^perm:(approve|reject):([A-Za-z0-9][A-Za-z0-9_-]{0,159})(?::(once|session|workspace|persistent))?$/i;

const TASK_APPROVAL_SCOPE_BY_PERMISSION_SCOPE: Record<PermissionCallbackScope, 'once' | 'session' | 'always'> = {
  once: 'once',
  session: 'session',
  workspace: 'always',
  persistent: 'always',
};

/**
 * Alias layer used at callback-router boundaries: parses legacy
 * `perm:<action>:<reference>[:<scope>]` callback data into the same decision
 * shape consumed by unified approval paths. Returns null for data outside
 * the permission-callback grammar.
 */
export function parsePermissionCallbackData(data: string): ParsedPermissionCallback | null {
  const match = PERMISSION_CALLBACK_PATTERN.exec(String(data || '').trim());
  if (!match) {
    return null;
  }
  const action = match[1].toLowerCase();
  const reference = match[2];
  if (action === 'reject') {
    return { action: 'deny', reference };
  }
  const scope = match[3] ? (match[3].toLowerCase() as PermissionCallbackScope) : null;
  return { action: 'approve', reference, scope };
}

/**
 * Maps a legacy permission scope onto the unified task-approval choice
 * vocabulary (project/persistent memory collapses onto "always"). A missing
 * explicit scope behaves like "once".
 */
export function toTaskApprovalChoice(scope: PermissionCallbackScope | null): 'once' | 'session' | 'always' {
  return TASK_APPROVAL_SCOPE_BY_PERMISSION_SCOPE[scope ?? 'once'];
}
