import type { WorkspaceTaskKind, WorkspaceTaskSubtype } from '../WorkspaceTaskKind.js';
import {
  normalizeExecutor,
} from './shared.js';
import type {
  ApprovedPolicyAggregate,
  ApprovalFrictionRecommendation,
  RouteOutcomeAggregate,
  WorkflowFrictionRecommendation,
  WorkflowStageExecutorRecommendation,
} from './types.js';

type WorkspaceRoutingMemory = {
  repeated_failures?: Array<{ executor: string }>;
  task_kind_recommendations?: Array<{ kind: string; repeated_failure_executor: string }>;
  task_subtype_recommendations?: Array<{ kind: string; subtype: string; repeated_failure_executor: string }>;
  approval_friction_recommendations?: ApprovalFrictionRecommendation[];
  [key: string]: unknown;
};

export function collectBlockedExecutors(
  memory: WorkspaceRoutingMemory,
  kind: WorkspaceTaskKind,
  subtype: WorkspaceTaskSubtype,
  approvedPolicies: ApprovedPolicyAggregate[] = [],
  routeOutcomes: RouteOutcomeAggregate[] = [],
  findDominantApprovalFriction: (recommendations: ApprovalFrictionRecommendation[], kind: WorkspaceTaskKind, subtype: WorkspaceTaskSubtype) => ApprovalFrictionRecommendation,
  shouldBlockByApprovalFriction: (friction: ApprovalFrictionRecommendation) => boolean,
  findApprovedPolicyBoost: (
    approvedPolicies: ApprovedPolicyAggregate[],
    executor: string,
    kind: WorkspaceTaskKind,
    subtype: WorkspaceTaskSubtype,
  ) => ApprovedPolicyAggregate,
  shouldBlockByRouteOutcome: (routeOutcome: RouteOutcomeAggregate) => boolean,
): string[] {
  const repeatedFailures = Array.isArray(memory.repeated_failures) ? memory.repeated_failures : [];
  const taskKindRecommendations = Array.isArray(memory.task_kind_recommendations) ? memory.task_kind_recommendations : [];
  const taskSubtypeRecommendations = Array.isArray(memory.task_subtype_recommendations) ? memory.task_subtype_recommendations : [];
  const approvalFrictionRecommendations = Array.isArray(memory.approval_friction_recommendations)
    ? memory.approval_friction_recommendations
    : [];
  const blocked = new Set<string>();

  const failureExecutor = normalizeExecutor(repeatedFailures[0]?.executor);
  if (failureExecutor) {
    blocked.add(failureExecutor);
  }

  const kindFailureExecutor = normalizeExecutor(
    taskKindRecommendations.find((entry) => String(entry?.kind || '').trim().toLowerCase() === kind)?.repeated_failure_executor,
  );
  if (kindFailureExecutor) {
    blocked.add(kindFailureExecutor);
  }

  const subtypeFailureExecutor = normalizeExecutor(
    taskSubtypeRecommendations.find((entry) => {
      return String(entry?.kind || '').trim().toLowerCase() === kind
        && String(entry?.subtype || '').trim().toLowerCase() === subtype;
    })?.repeated_failure_executor,
  );
  if (subtypeFailureExecutor) {
    blocked.add(subtypeFailureExecutor);
  }

  const dominantApprovalFriction = findDominantApprovalFriction(
    approvalFrictionRecommendations,
    kind,
    subtype,
  );
  if (
    dominantApprovalFriction
    && shouldBlockByApprovalFriction(dominantApprovalFriction)
    && !findApprovedPolicyBoost(
      approvedPolicies,
      dominantApprovalFriction.executor,
      kind,
      subtype,
    )
  ) {
    blocked.add(dominantApprovalFriction.executor);
  }

  for (const entry of routeOutcomes) {
    const executor = normalizeExecutor(entry?.executor);
    const entryKind = String(entry?.task_kind || '').trim().toLowerCase();
    const entrySubtype = String(entry?.task_subtype || '').trim().toLowerCase();
    if (!executor || entryKind !== kind || ![subtype, 'general'].includes(entrySubtype)) {
      continue;
    }
    if (
      shouldBlockByRouteOutcome(entry)
      && !findApprovedPolicyBoost(approvedPolicies, executor, kind, subtype)
    ) {
      blocked.add(executor);
    }
  }

  return Array.from(blocked);
}

export function findApprovalFriction(
  recommendations: ApprovalFrictionRecommendation[],
  executor: string | null,
  kind: WorkspaceTaskKind,
  subtype: WorkspaceTaskSubtype,
): ApprovalFrictionRecommendation {
  const normalizedExecutor = normalizeExecutor(executor);
  if (!normalizedExecutor) {
    return null;
  }

  return recommendations.find((entry) => {
    const entryExecutor = normalizeExecutor(entry?.executor);
    const entryKind = String(entry?.kind || '').trim().toLowerCase();
    const entrySubtype = String(entry?.subtype || '').trim().toLowerCase();
    return entryExecutor === normalizedExecutor
      && entryKind === kind
      && (entrySubtype === subtype || entrySubtype === 'general');
  }) || null;
}

export function findRouteOutcome(
  routeOutcomes: RouteOutcomeAggregate[],
  executor: string,
  kind: WorkspaceTaskKind,
  subtype: WorkspaceTaskSubtype,
  surfaceSource: string | null,
): RouteOutcomeAggregate {
  const normalizedSurface = String(surfaceSource || '').trim().toLowerCase() || null;
  return routeOutcomes
    .filter((entry) => {
      return normalizeExecutor(entry?.executor) === executor
        && String(entry?.task_kind || '').trim().toLowerCase() === kind
        && (
          String(entry?.task_subtype || '').trim().toLowerCase() === subtype
          || String(entry?.task_subtype || '').trim().toLowerCase() === 'general'
          || subtype === 'general'
        );
    })
    .sort((left, right) => {
      const leftSurface = String(left?.source_surface || '').trim().toLowerCase() || null;
      const rightSurface = String(right?.source_surface || '').trim().toLowerCase() || null;
      const leftSurfaceBoost = normalizedSurface && leftSurface === normalizedSurface ? 15 : 0;
      const rightSurfaceBoost = normalizedSurface && rightSurface === normalizedSurface ? 15 : 0;
      const leftScore =
        leftSurfaceBoost
        + Number(left?.approval_granted_count || 0) * 2
        + Number(left?.permission_granted_count || 0)
        + Number(left?.gated_completion_count || 0) * 3
        + Number(left?.gated_artifactful_count || 0) * 4
        + Number(left?.workflow_recovery_success_count || 0) * 3
        + Number(left?.workflow_recovery_artifactful_count || 0) * 4
        + Number(left?.success_rate || 0) * 100
        - Number(left?.friction_rate || 0) * 40
        + Number(left?.completed_count || 0) * 3
        - Number(left?.rejected_count || 0) * 2
        - Number(left?.approval_rejected_count || 0) * 2
        - Number(left?.permission_rejected_count || 0) * 2;
      const rightScore =
        rightSurfaceBoost
        + Number(right?.approval_granted_count || 0) * 2
        + Number(right?.permission_granted_count || 0)
        + Number(right?.gated_completion_count || 0) * 3
        + Number(right?.gated_artifactful_count || 0) * 4
        + Number(right?.workflow_recovery_success_count || 0) * 3
        + Number(right?.workflow_recovery_artifactful_count || 0) * 4
        + Number(right?.success_rate || 0) * 100
        - Number(right?.friction_rate || 0) * 40
        + Number(right?.completed_count || 0) * 3
        - Number(right?.rejected_count || 0) * 2
        - Number(right?.approval_rejected_count || 0) * 2
        - Number(right?.permission_rejected_count || 0) * 2;
      return rightScore - leftScore
        || String(right?.last_seen_at || '').localeCompare(String(left?.last_seen_at || ''));
    })[0] || null;
}

export function findApprovedPolicyBoost(
  approvedPolicies: ApprovedPolicyAggregate[],
  executor: string,
  kind: WorkspaceTaskKind,
  subtype: WorkspaceTaskSubtype,
): ApprovedPolicyAggregate {
  return approvedPolicies.find((entry) => {
    if (normalizeExecutor(entry?.executor) !== executor) {
      return false;
    }
    const policyKind = String(entry?.kind || '').trim().toLowerCase();
    const family = String(entry?.policy_family || '').trim().toLowerCase();
    if (policyKind === 'workspace_access' && (kind === 'code' || kind === 'automation')) {
      return true;
    }
    if (policyKind === 'command_access' && (kind === 'automation' || subtype === 'implementation')) {
      return true;
    }
    if (policyKind === 'service_access' && (kind === 'research' || kind === 'design')) {
      return true;
    }
    if (policyKind === 'builtin_tool_access' && kind === 'research') {
      return true;
    }
    if (policyKind === 'agent_binding' && family === 'external_executor_role_binding') {
      return executor === 'external_executor';
    }
    return false;
  }) || null;
}

export function findDominantApprovalFriction(
  recommendations: ApprovalFrictionRecommendation[],
  kind: WorkspaceTaskKind,
  subtype: WorkspaceTaskSubtype,
): ApprovalFrictionRecommendation {
  return recommendations
    .filter((entry) => {
      const entryExecutor = normalizeExecutor(entry?.executor);
      const entryKind = String(entry?.kind || '').trim().toLowerCase();
      const entrySubtype = String(entry?.subtype || '').trim().toLowerCase();
      return Boolean(entryExecutor)
        && entryKind === kind
        && (entrySubtype === subtype || entrySubtype === 'general');
    })
    .sort((left, right) => {
      const leftWeight =
        Number(left?.rejected_count || 0) * 3
        + Number(left?.high_risk_count || 0) * 2
        + Number(left?.permission_count || 0)
        + Number(left?.pending_count || 0);
      const rightWeight =
        Number(right?.rejected_count || 0) * 3
        + Number(right?.high_risk_count || 0) * 2
        + Number(right?.permission_count || 0)
        + Number(right?.pending_count || 0);
      return rightWeight - leftWeight;
    })[0] || null;
}

export function findWorkflowFriction(
  recommendations: WorkflowFrictionRecommendation[],
  workflow: string | null,
): WorkflowFrictionRecommendation {
  const normalizedWorkflow = String(workflow || '').trim().toLowerCase();
  if (!normalizedWorkflow) {
    return null;
  }

  return recommendations.find((entry) => {
    return String(entry?.workflow || '').trim().toLowerCase() === normalizedWorkflow;
  }) || null;
}

export function findWorkflowStageExecutorRecommendation(
  recommendations: WorkflowStageExecutorRecommendation[],
  workflow: string | null,
  role: string | null,
): WorkflowStageExecutorRecommendation {
  const normalizedWorkflow = String(workflow || '').trim().toLowerCase();
  const normalizedRole = String(role || '').trim().toLowerCase();
  if (!normalizedWorkflow || !normalizedRole) {
    return null;
  }

  return recommendations.find((entry) => {
    return String(entry?.workflow || '').trim().toLowerCase() === normalizedWorkflow
      && String(entry?.role || '').trim().toLowerCase() === normalizedRole;
  }) || null;
}
