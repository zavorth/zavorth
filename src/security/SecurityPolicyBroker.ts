import { createHash } from 'node:crypto';
import type {
  AgentInputTrust,
  AgentPolicyDecision,
  AgentRiskLevel,
} from './AgentSecurityPolicyEngine.js';
import {
  resolveSecurityProfile,
  type SecurityProfileId,
} from './SecurityProfile.js';

export type SecurityPolicyBrokerAction =
  | 'allow'
  | 'allow_with_redaction'
  | 'require_user_confirmation'
  | 'require_admin_policy'
  | 'deny';

export type SecurityPolicyBrokerSurface =
  | 'tool'
  | 'llm-egress'
  | 'web-fetch'
  | 'desktop-automation'
  | 'workspace'
  | 'mcp'
  | 'plugin'
  | 'skill'
  | 'provider'
  | 'local-write';

export type SecurityPolicyBrokerProfile = {
  id: SecurityProfileId;
  label: string;
  source: string;
};

export type SecurityPolicyBrokerRedaction = {
  applied: boolean;
  findingCount: number;
};

export type SecurityPolicyBrokerReceipt = {
  receiptId: string;
  generatedAt: string;
  surface: SecurityPolicyBrokerSurface;
  operation: string;
  target: string;
  action: SecurityPolicyBrokerAction;
  allowed: boolean;
  rule: string;
  reasons: string[];
  profile: SecurityPolicyBrokerProfile;
  sourceTrust: string;
  redaction: SecurityPolicyBrokerRedaction;
  risk: string;
  riskBlocked: boolean;
  userConfirmationRequired: boolean;
  adminPolicyRequired: boolean;
};

export type SecurityPolicyBrokerDecision = {
  action: SecurityPolicyBrokerAction;
  allowed: boolean;
  rule: string;
  reasons: string[];
  profile: SecurityPolicyBrokerProfile;
  redactionApplied: boolean;
  riskBlocked: boolean;
  requiresUserConfirmation: boolean;
  requiresAdminPolicy: boolean;
  receipt: SecurityPolicyBrokerReceipt;
};

export type SecurityPolicyBrokerRequest = {
  surface: SecurityPolicyBrokerSurface;
  operation: string;
  target?: string;
  profile?: SecurityProfileId | string;
  workspace?: string | null;
  sourceTrust?: AgentInputTrust | string;
  metadata?: Record<string, unknown> | null;
  toolDecision?: AgentPolicyDecision | null;
  mcpDecision?: {
    allowed: boolean;
    profile?: string;
    reason?: string;
  } | null;
  redaction?: {
    applied?: boolean;
    findingCount?: number;
    reasons?: string[];
  } | null;
  blocked?: boolean;
  adminPolicyRequired?: boolean;
  userConfirmationRequired?: boolean;
  risk?: AgentRiskLevel | string;
  rule?: string;
  reasons?: string[];
};

type BrokerRuntime = {
  now?: () => Date;
};

export function decideSecurityPolicy(
  request: SecurityPolicyBrokerRequest,
  runtime: BrokerRuntime = {},
): SecurityPolicyBrokerDecision {
  const profileResolution = resolveSecurityProfile({
    profile: request.profile || request.toolDecision?.securityProfile?.id,
    metadata: request.metadata || {},
    workspace: request.workspace || undefined,
  });
  const profile: SecurityPolicyBrokerProfile = {
    id: profileResolution.profile.id,
    label: profileResolution.profile.label,
    source: request.toolDecision?.securityProfile?.source || profileResolution.source,
  };
  const redaction = normalizeRedaction(request);
  const reasons = normalizeReasons(request);
  const action = chooseAction(request, redaction);
  const allowed = action === 'allow' || action === 'allow_with_redaction';
  const rule = normalizeRule(request, action);
  const risk = normalizeRiskLabel(request);
  const now = runtime.now ? runtime.now() : new Date();
  const generatedAt = now.toISOString();
  const riskBlocked = !allowed && (request.blocked === true || risk === 'forbidden');
  const receipt: SecurityPolicyBrokerReceipt = {
    receiptId: buildReceiptId({
      generatedAt,
      surface: request.surface,
      operation: request.operation,
      target: normalizeTarget(request),
      action,
      rule,
      reasons,
      profile,
    }),
    generatedAt,
    surface: request.surface,
    operation: normalizeOperation(request.operation),
    target: normalizeTarget(request),
    action,
    allowed,
    rule,
    reasons,
    profile,
    sourceTrust: normalizeSourceTrust(request),
    redaction,
    risk,
    riskBlocked,
    userConfirmationRequired: action === 'require_user_confirmation',
    adminPolicyRequired: action === 'require_admin_policy',
  };

  return {
    action,
    allowed,
    rule,
    reasons,
    profile,
    redactionApplied: redaction.applied,
    riskBlocked,
    requiresUserConfirmation: action === 'require_user_confirmation',
    requiresAdminPolicy: action === 'require_admin_policy',
    receipt,
  };
}

export function formatSecurityPolicyReceipt(receipt: SecurityPolicyBrokerReceipt): string {
  const redaction = receipt.redaction.applied
    ? `redaction applied (${receipt.redaction.findingCount} finding(s))`
    : 'no redaction';
  const blocked = receipt.riskBlocked ? 'risk blocked' : 'no risk block';
  return [
    `Receipt ${receipt.receiptId}: ${receipt.action} ${receipt.surface}/${receipt.operation} on ${receipt.target}.`,
    `Profile: ${receipt.profile.id} (${receipt.profile.source}).`,
    `Rule: ${receipt.rule}.`,
    `Evidence: ${redaction}; ${blocked}.`,
    `Why: ${receipt.reasons.join(' ')}`,
  ].join(' ');
}

function chooseAction(
  request: SecurityPolicyBrokerRequest,
  redaction: SecurityPolicyBrokerRedaction,
): SecurityPolicyBrokerAction {
  if (request.toolDecision) {
    if (request.toolDecision.action === 'deny') {
      return 'deny';
    }
    if (request.toolDecision.action === 'require_confirmation') {
      return 'require_user_confirmation';
    }
    return redaction.applied ? 'allow_with_redaction' : 'allow';
  }

  if (request.mcpDecision) {
    if (request.mcpDecision.allowed) {
      return redaction.applied ? 'allow_with_redaction' : 'allow';
    }
    return 'require_admin_policy';
  }

  if (request.adminPolicyRequired) {
    return 'require_admin_policy';
  }

  if (request.blocked || request.risk === 'forbidden') {
    return 'deny';
  }

  if (request.userConfirmationRequired || request.risk === 'review' || request.risk === 'dangerous') {
    return 'require_user_confirmation';
  }

  if (redaction.applied) {
    return 'allow_with_redaction';
  }

  return 'allow';
}

function normalizeReasons(request: SecurityPolicyBrokerRequest): string[] {
  const reasons = [
    ...(request.reasons || []),
    ...(request.redaction?.reasons || []),
    ...(request.toolDecision?.reasons || []),
    request.mcpDecision?.reason,
  ]
    .map((reason) => String(reason || '').trim())
    .filter(Boolean);

  if (reasons.length === 0) {
    reasons.push('SecurityPolicyBroker evaluated the action against the active policy.');
  }

  return Array.from(new Set(reasons));
}

function normalizeRedaction(request: SecurityPolicyBrokerRequest): SecurityPolicyBrokerRedaction {
  const findingCount = Math.max(0, Number(request.redaction?.findingCount || 0));
  return {
    applied: request.redaction?.applied === true || findingCount > 0,
    findingCount,
  };
}

function normalizeRule(
  request: SecurityPolicyBrokerRequest,
  action: SecurityPolicyBrokerAction,
): string {
  if (request.rule) {
    return String(request.rule);
  }
  if (request.toolDecision?.rule) {
    return request.toolDecision.rule;
  }
  if (request.mcpDecision && !request.mcpDecision.allowed) {
    return 'MCP_ADMIN_POLICY_REQUIRED';
  }
  if (action === 'allow_with_redaction') {
    return 'ALLOW_WITH_REDACTION';
  }
  if (action === 'require_user_confirmation') {
    return 'USER_CONFIRMATION_REQUIRED';
  }
  if (action === 'require_admin_policy') {
    return 'ADMIN_POLICY_REQUIRED';
  }
  if (action === 'deny') {
    return 'BROKER_DENY';
  }
  return 'BROKER_ALLOW';
}

function normalizeRiskLabel(request: SecurityPolicyBrokerRequest): string {
  return String(request.risk || request.toolDecision?.risk || (request.blocked ? 'forbidden' : 'safe'));
}

function normalizeSourceTrust(request: SecurityPolicyBrokerRequest): string {
  const explicit = String(request.sourceTrust || '').trim();
  if (explicit) {
    return explicit;
  }

  const reasons = request.toolDecision?.reasons || [];
  return reasons.some((reason) => /untrusted content/i.test(reason)) ? 'untrusted-content' : 'unknown';
}

function normalizeOperation(operation: string): string {
  return String(operation || 'execute').trim() || 'execute';
}

function normalizeTarget(request: SecurityPolicyBrokerRequest): string {
  return String(request.target || request.toolDecision?.toolName || 'unknown').trim() || 'unknown';
}

function buildReceiptId(input: {
  generatedAt: string;
  surface: SecurityPolicyBrokerSurface;
  operation: string;
  target: string;
  action: SecurityPolicyBrokerAction;
  rule: string;
  reasons: string[];
  profile: SecurityPolicyBrokerProfile;
}): string {
  const digest = createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex')
    .slice(0, 16);
  return `spb_${digest}`;
}
