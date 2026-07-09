/**
 * Pure session helpers used by the desktop shell and unit tests.
 */

export type DesktopSessionCreateInput = {
  sessionId?: string;
  label?: string;
  surface?: string;
  workspaceId?: string | null;
};

export type DesktopSessionCreateResult = {
  sessionId: string;
  label?: string;
  surface?: string;
};

export function generateDesktopSessionId(
  now: () => number = Date.now,
  random: () => string = () => Math.random().toString(36).slice(2, 10),
): string {
  return `desktop-${now().toString(36)}-${random()}`;
}

export function normalizeSessionCreateInput(
  input: DesktopSessionCreateInput = {},
  idFactory: () => string = generateDesktopSessionId,
): Required<Pick<DesktopSessionCreateResult, 'sessionId' | 'label' | 'surface'>> & {
  workspaceId: string | null;
} {
  const sessionId = String(input.sessionId || '').trim() || idFactory();
  const label = String(input.label || 'New Chat').trim() || 'New Chat';
  const surface = String(input.surface || input.workspaceId || 'desktop').trim() || 'desktop';
  const workspaceId = input.workspaceId ? String(input.workspaceId) : null;
  return { sessionId, label, surface, workspaceId };
}

export function resolveCreatedSessionId(
  data: unknown,
  fallbackId: string,
): string {
  if (!data || typeof data !== 'object') return fallbackId;
  const raw = data as { sessionId?: unknown; id?: unknown; data?: { sessionId?: unknown; id?: unknown } };
  const nested = raw.data && typeof raw.data === 'object' ? raw.data : null;
  const resolved = String(nested?.sessionId || nested?.id || raw.sessionId || raw.id || fallbackId).trim();
  return resolved || fallbackId;
}

/** Normalize approval decision payloads used by desktop approval cards. */
export function resolveApprovalItemId(
  item: { id?: string; approvalId?: string } | null | undefined,
  fallback: string,
): string {
  return String(item?.id || item?.approvalId || fallback).trim() || fallback;
}

export function isApprovalDecision(value: string): value is 'approve' | 'reject' {
  return value === 'approve' || value === 'reject';
}
