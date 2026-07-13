/**
 * Canonical default identity when no surface/user is provided.
 * Aligned across AgentRun, learning stores, CLI flags, and bridge prefs.
 */
export const ZAVORTH_DEFAULT_USER_ID = 'local-user';

export function normalizeZavorthUserId(userId?: string | null): string {
  const raw = String(userId || '').trim();
  if (!raw) return ZAVORTH_DEFAULT_USER_ID;
  const safe = raw.replace(/[^a-zA-Z0-9._@+-]+/g, '_').slice(0, 120);
  return safe || ZAVORTH_DEFAULT_USER_ID;
}

/** CLI / gateway fallback when --user-id is omitted. */
export function resolveCliDefaultUserId(input: {
  flagUserId?: string | null;
  allowedUserIds?: Array<string | number> | null;
  envUser?: string | null;
} = {}): string {
  const fromFlag = String(input.flagUserId || '').trim();
  if (fromFlag) return normalizeZavorthUserId(fromFlag);
  const allowed = Array.isArray(input.allowedUserIds) ? input.allowedUserIds : [];
  const firstAllowed = String(allowed[0] || '').trim();
  if (firstAllowed) return normalizeZavorthUserId(firstAllowed);
  const envUser = String(input.envUser || '').trim();
  if (envUser) return normalizeZavorthUserId(envUser);
  return ZAVORTH_DEFAULT_USER_ID;
}
