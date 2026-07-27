import type {
  ApprovedPathAggregate,
  ApprovedPolicyAggregate,
} from './WorkspaceOperationalMemoryTypes.js';
import { toWorkspaceMemoryRecord } from './WorkspaceOperationalMemoryTaskUtilities.js';

export function buildApprovedPathsFromPolicies(policies: ApprovedPolicyAggregate[]): ApprovedPathAggregate[] {
  const deduped = new Map<string, ApprovedPathAggregate>();
  for (const policy of policies) {
    if (policy.kind !== 'workspace_access') {
      continue;
    }

    const resolvedPath = String(policy.resolved_value || policy.requested_value || '').trim();
    if (!resolvedPath) {
      continue;
    }

    const item: ApprovedPathAggregate = {
      executor: policy.executor,
      path: resolvedPath.replace(/\\/g, '/'),
      scope: policy.scope || 'once',
      last_seen_at: policy.last_seen_at,
    };
    const key = `${item.executor}::${item.path}`;
    const existing = deduped.get(key);
    if (!existing || existing.last_seen_at < item.last_seen_at) {
      deduped.set(key, item);
    }
  }

  return Array.from(deduped.values())
    .sort((left, right) => right.last_seen_at.localeCompare(left.last_seen_at))
    .slice(0, 5);
}

export function collectApprovedPoliciesFromRequests(
  policies: Array<{
    executor?: string | null;
    kind?: string | null;
    scope?: string | null;
    requested_value?: string | null;
    resolved_value?: string | null;
    metadata?: unknown;
    updated_at?: string | null;
    created_at?: string | null;
    reason?: string | null;
  }>,
): ApprovedPolicyAggregate[] {
  const deduped = new Map<string, ApprovedPolicyAggregate>();

  for (const policy of policies) {
    const executor = String(policy.executor || '').trim().toLowerCase();
    const kind = String(policy.kind || '').trim().toLowerCase();
    const requestedValue = String(policy.requested_value || '').trim() || null;
    const resolvedValue = String(policy.resolved_value || '').trim() || null;
    const metadata = toWorkspaceMemoryRecord(policy.metadata);
    if (!executor || !kind) {
      continue;
    }

    const aggregate: ApprovedPolicyAggregate = {
      executor,
      kind,
      scope: String(policy.scope || '').trim() || null,
      policy_family: String(metadata.policy_family || '').trim() || null,
      requested_value: requestedValue,
      resolved_value: resolvedValue,
      access_level: String(metadata.access_level || '').trim() || null,
      match_type: String(metadata.match_type || '').trim() || null,
      last_seen_at: String(policy.updated_at || policy.created_at || new Date().toISOString()),
      confidence: String(policy.scope || '').trim() === 'persistent' ? 'high' : 'medium',
      rationale: String(policy.reason || 'Policy approved no workspace.').trim(),
    };

    const key = [
      aggregate.executor,
      aggregate.kind,
      aggregate.policy_family || 'none',
      aggregate.resolved_value || aggregate.requested_value || 'none',
    ].join('::');
    const existing = deduped.get(key);
    if (!existing || existing.last_seen_at < aggregate.last_seen_at) {
      deduped.set(key, aggregate);
    }
  }

  return Array.from(deduped.values())
    .sort((left, right) => right.last_seen_at.localeCompare(left.last_seen_at))
    .slice(0, 12);
}
