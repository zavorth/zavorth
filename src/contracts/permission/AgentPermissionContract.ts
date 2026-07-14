/**
 * Standard agent permission model.
 * Choices: once | session | always | deny
 * Decisions: allow | ask | deny
 * No TOTP. Surfaces only render the same four actions.
 */

export const ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION =
  '2026-07-13.agent-permission-v1' as const;

export type AgentPermissionChoice = 'once' | 'session' | 'always' | 'deny';

export type AgentPermissionAction = 'allow' | 'ask' | 'deny';

export type AgentPermissionRisk = 'safe' | 'attention' | 'danger' | 'unknown' | string;

export type AgentPermissionEvaluateInput = {
  toolName?: string | null;
  /** Command / path / pattern fingerprint (optional). */
  pattern?: string | null;
  risk?: AgentPermissionRisk | null;
  requiresApproval?: boolean | null;
  workspaceId?: string | null;
  sessionId?: string | null;
  /** ISO expiry override for session grants. */
  sessionTtlMs?: number | null;
};

export type AgentPermissionEvaluateResult = {
  contractVersion: typeof ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION;
  action: AgentPermissionAction;
  reason: string;
  matchedRule: string | null;
  /** If allow, which scope satisfied it. */
  satisfiedBy: 'safe' | 'session' | 'always' | 'workspace-grant' | null;
};

export type AgentPermissionRespondInput = {
  choice: AgentPermissionChoice;
  toolName?: string | null;
  pattern?: string | null;
  risk?: AgentPermissionRisk | null;
  workspaceId?: string | null;
  sessionId?: string | null;
  /** Default 8h for session. */
  sessionTtlMs?: number | null;
  actorId?: string | null;
  surface?: string | null;
};

export type AgentPermissionRespondResult = {
  contractVersion: typeof ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION;
  choice: AgentPermissionChoice;
  allowed: boolean;
  remembered: boolean;
  scope: 'once' | 'session' | 'always' | 'none';
  expiresAt: string | null;
  message: string;
};

export const AGENT_PERMISSION_CHOICES: readonly AgentPermissionChoice[] = [
  'once',
  'session',
  'always',
  'deny',
] as const;

export function normalizeAgentPermissionChoice(
  value: unknown,
): AgentPermissionChoice | null {
  const v = String(value || '')
    .trim()
    .toLowerCase();
  if (v === 'once' || v === 'run' || v === 'approve' || v === 'allow' || v === 'yes') {
    return 'once';
  }
  if (v === 'session' || v === 'allow_session' || v === 'this-session') {
    return 'session';
  }
  if (v === 'always' || v === 'allow_always' || v === 'permanent') {
    return 'always';
  }
  if (v === 'deny' || v === 'reject' || v === 'no' || v === 'block') {
    return 'deny';
  }
  return null;
}

export function formatAgentPermissionPitch(): string {
  return [
    `Agent permissions ${ZAVORTH_AGENT_PERMISSION_CONTRACT_VERSION}`,
    'Industry model: allow | ask | deny + once | session | always | deny',
    'Same choices on every surface. No TOTP. Session grants reduce friction.',
  ].join('\n');
}
