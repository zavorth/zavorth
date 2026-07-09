import type { Task } from '../../../../contracts/TaskContract.js';
import type {
  ApprovalHistoryEntry,
  MutableRouteOutcomeAggregate,
  PermissionHistoryEntry,
  RecentWorkflowRunAggregate,
  RouteOutcomeAggregate,
} from './WorkspaceOperationalMemoryTypes.js';
import {
  computeWorkspaceApprovalWaitMs,
  computeWorkspaceArtifactDeliveryAfterApprovalMs,
  computeWorkspacePostApprovalRecoveryMs,
  formatWorkspaceMemoryDurationMs,
  getWorkspaceMemoryLearningExecutor,
  toWorkspaceMemoryRecord,
} from './WorkspaceOperationalMemoryTaskUtilities.js';
import { classifyWorkspaceMemoryTaskProfile } from './WorkspaceOperationalMemoryTaskUtilities.js';


import type { WorkspaceTaskKind, WorkspaceTaskSubtype } from '../../../../services/WorkspaceTaskKind.js';

function createRouteOutcomeBucket(
  task: Task,
  executor: string,
  kind: WorkspaceTaskKind,
  subtype: WorkspaceTaskSubtype,
  sourceSurface: string | null,
  source: string | null,
  strategy: string | null,
  workflowName: string | null,
): MutableRouteOutcomeAggregate {
  return {
    executor,
    source,
    source_surface: sourceSurface,
    strategy,
    workflow_name: workflowName,
    task_kind: kind,
    task_subtype: subtype,
    total_count: 0,
    completed_count: 0,
    failed_count: 0,
    approval_pending_count: 0,
    approval_granted_count: 0,
    approval_rejected_count: 0,
    permission_pending_count: 0,
    permission_granted_count: 0,
    permission_rejected_count: 0,
    gated_completion_count: 0,
    gated_artifactful_count: 0,
    rejected_count: 0,
    high_risk_count: 0,
    artifactful_count: 0,
    workflow_recovered_count: 0,
    workflow_recovery_success_count: 0,
    workflow_recovery_artifactful_count: 0,
    average_duration_ms: 0,
    average_approval_wait_ms: 0,
    average_post_approval_recovery_ms: 0,
    average_artifact_delivery_after_approval_ms: 0,
    operator_cost_score: 0,
    success_rate: 0,
    friction_rate: 0,
    last_seen_at: task.updated_at,
    confidence: 'low',
    rationale: '',
    approval_wait_total_ms: 0,
    approval_wait_samples: 0,
    post_approval_recovery_total_ms: 0,
    post_approval_recovery_samples: 0,
    artifact_delivery_after_approval_total_ms: 0,
    artifact_delivery_after_approval_samples: 0,
  };
}

function computeRouteOutcomeConfidence(entry: MutableRouteOutcomeAggregate, successRate: number): RouteOutcomeAggregate['confidence'] {
  if (
    (
      successRate >= 0.8
      && entry.completed_count >= 3
      && entry.rejected_count === 0
    )
    || (
      entry.workflow_recovery_success_count > 0
      && entry.workflow_recovery_artifactful_count > 0
      && entry.completed_count >= entry.failed_count
    )
    || (
      entry.gated_completion_count > 0
      && entry.gated_artifactful_count > 0
      && entry.approval_rejected_count === 0
    )
  ) {
    return 'high';
  }

  if (
    (successRate >= 0.5 && entry.completed_count >= entry.failed_count)
    || entry.workflow_recovery_success_count > 0
    || entry.gated_completion_count > 0
  ) {
    return 'medium';
  }

  return 'low';
}

function buildRouteOutcomeRationale(
  entry: MutableRouteOutcomeAggregate,
  averageApprovalWaitMs: number,
  averageRecoveryMs: number,
  averageArtifactDeliveryMs: number,
): string {
  return (
    `${entry.completed_count} concluida(s), ${entry.failed_count} falha(s), `
    + `${entry.rejected_count} rejeicao(oes), ${entry.approval_pending_count} aguardando aprovacao, `
    + `${entry.permission_pending_count} permissao(oes) pendente(s), `
    + `${entry.approval_granted_count + entry.permission_granted_count} liberacao(oes) registrada(s)`
    + `${entry.gated_completion_count > 0
      ? `, ${entry.gated_completion_count} fluxo(s) aprovados concluido(s)`
      : ''}`
    + `${entry.gated_artifactful_count > 0
      ? ` com ${entry.gated_artifactful_count} entrega(s) apos aprovacao`
      : ''}`
    + `${entry.workflow_recovery_success_count > 0
      ? `, ${entry.workflow_recovery_success_count} retomada(s) concluida(s)`
      : ''}`
    + `${entry.workflow_recovery_artifactful_count > 0
      ? ` com ${entry.workflow_recovery_artifactful_count} entrega(s) finais`
      : ''}`
    + `${averageApprovalWaitMs > 0 ? `, espera media ${formatWorkspaceMemoryDurationMs(averageApprovalWaitMs)}` : ''}`
    + `${averageRecoveryMs > 0 ? `, retomada media ${formatWorkspaceMemoryDurationMs(averageRecoveryMs)}` : ''}`
    + `${averageArtifactDeliveryMs > 0 ? `, entrega final media ${formatWorkspaceMemoryDurationMs(averageArtifactDeliveryMs)}` : ''}`
    + `${entry.source_surface ? ` via ${entry.source_surface}` : ''}.`
  );
}

function finalizeRouteOutcome(entry: MutableRouteOutcomeAggregate): RouteOutcomeAggregate {
  const successRate = entry.total_count > 0
    ? Number((entry.completed_count / entry.total_count).toFixed(3))
    : 0;
  const frictionCount =
    entry.failed_count
    + entry.approval_pending_count
    + entry.permission_pending_count
    + entry.rejected_count;
  const frictionRate = entry.total_count > 0
    ? Number((frictionCount / entry.total_count).toFixed(3))
    : 0;
  const averageDurationMs = entry.total_count > 0
    ? Math.round(entry.average_duration_ms / entry.total_count)
    : 0;
  const averageApprovalWaitMs = entry.approval_wait_samples > 0
    ? Math.round(entry.approval_wait_total_ms / entry.approval_wait_samples)
    : 0;
  const averageRecoveryMs = entry.post_approval_recovery_samples > 0
    ? Math.round(entry.post_approval_recovery_total_ms / entry.post_approval_recovery_samples)
    : 0;
  const averageArtifactDeliveryMs = entry.artifact_delivery_after_approval_samples > 0
    ? Math.round(entry.artifact_delivery_after_approval_total_ms / entry.artifact_delivery_after_approval_samples)
    : 0;
  const operatorCostScore = averageApprovalWaitMs + averageRecoveryMs + averageArtifactDeliveryMs;

  return {
    ...entry,
    average_duration_ms: averageDurationMs,
    average_approval_wait_ms: averageApprovalWaitMs,
    average_post_approval_recovery_ms: averageRecoveryMs,
    average_artifact_delivery_after_approval_ms: averageArtifactDeliveryMs,
    operator_cost_score: operatorCostScore,
    success_rate: successRate,
    friction_rate: frictionRate,
    confidence: computeRouteOutcomeConfidence(entry, successRate),
    rationale: buildRouteOutcomeRationale(entry, averageApprovalWaitMs, averageRecoveryMs, averageArtifactDeliveryMs),
  };
}

function hydrateWorkflowRecoverySignals(
  grouped: Map<string, MutableRouteOutcomeAggregate>,
  workflowRouteKeys: Map<string, Set<string>>,
  recentWorkflowRuns: RecentWorkflowRunAggregate[],
): void {
  for (const run of recentWorkflowRuns) {
    const workflowRunId = String(run.workflow_run_id || '').trim();
    if (!workflowRunId) {
      continue;
    }

    const routeKeys = workflowRouteKeys.get(workflowRunId);
    if (!routeKeys || routeKeys.size === 0) {
      continue;
    }

    const recoveredCount = Boolean(run.recovered_from_interruption) ? 1 : 0;
    const recoverySuccessCount =
      recoveredCount > 0 && String(run.status || '').trim().toLowerCase() === 'completed' ? 1 : 0;
    const recoveryArtifactfulCount =
      recoverySuccessCount > 0 && Boolean(String(run.primary_artifact_name || '').trim()) ? 1 : 0;
    if (recoveredCount === 0 && recoverySuccessCount === 0 && recoveryArtifactfulCount === 0) {
      continue;
    }

    for (const routeKey of routeKeys) {
      const existing = grouped.get(routeKey);
      if (!existing) {
        continue;
      }
      existing.workflow_recovered_count += recoveredCount;
      existing.workflow_recovery_success_count += recoverySuccessCount;
      existing.workflow_recovery_artifactful_count += recoveryArtifactfulCount;
      if (run.updated_at > existing.last_seen_at) {
        existing.last_seen_at = run.updated_at;
      }
      grouped.set(routeKey, existing);
    }
  }
}

export function buildRouteOutcomes(
  tasks: Task[],
  recentWorkflowRuns: RecentWorkflowRunAggregate[] = [],
): RouteOutcomeAggregate[] {
  const grouped = new Map<string, MutableRouteOutcomeAggregate>();
  const workflowRouteKeys = new Map<string, Set<string>>();

  for (const task of tasks) {
    const outcome = toWorkspaceMemoryRecord(task.metadata?.workspace_route_outcome);
    const classified = classifyWorkspaceMemoryTaskProfile(task);
    const kind = (String(outcome.task_kind || '').trim().toLowerCase() || classified.kind) as WorkspaceTaskKind;
    const subtype = (String(outcome.task_subtype || '').trim().toLowerCase() || classified.subtype) as WorkspaceTaskSubtype;
    const executor = String(
      outcome.final_executor
      || outcome.selected_executor
      || getWorkspaceMemoryLearningExecutor(task),
    ).trim().toLowerCase();
    if (!executor) {
      continue;
    }

    const source = String(outcome.source || '').trim() || null;
    const sourceSurface = String(outcome.source_surface || task.source || '').trim().toLowerCase() || null;
    const strategy = String(outcome.strategy || '').trim() || null;
    const workflowName = String(outcome.workflow_name || task.metadata?.workflow_name || '').trim() || null;
    const approvalHistory = Array.isArray(task.metadata?.approval_history) ? task.metadata.approval_history : [];
    const permissionHistory = Array.isArray(task.metadata?.permission_history) ? task.metadata.permission_history : [];
    const approvalWaitMs = computeWorkspaceApprovalWaitMs(task, approvalHistory, permissionHistory);
    const recoveryMs = computeWorkspacePostApprovalRecoveryMs(task, approvalHistory, permissionHistory);
    const artifactDeliveryMs = computeWorkspaceArtifactDeliveryAfterApprovalMs(task, approvalHistory, permissionHistory);
    const key = [executor, kind, subtype, sourceSurface || 'none', source || 'none', strategy || 'none', workflowName || 'none'].join('::');
    const existing = grouped.get(key) || createRouteOutcomeBucket(
      task,
      executor,
      kind,
      subtype,
      sourceSurface,
      source,
      strategy,
      workflowName,
    );

    existing.total_count += 1;
    const finalStatus = String(outcome.final_status || task.status || '').trim().toLowerCase();
    const durationMs = Math.max(0, Number(outcome.duration_ms || 0));
    const approvalGrantedCount = approvalHistory.filter((entry: ApprovalHistoryEntry) => String(entry?.action || '').trim().toLowerCase() === 'approve').length;
    const approvalRejectedCount = approvalHistory.filter((entry: ApprovalHistoryEntry) => String(entry?.action || '').trim().toLowerCase() === 'reject').length;
    const permissionGrantedCount = permissionHistory.filter((entry: PermissionHistoryEntry) => {
      const action = String(entry?.action || '').trim().toLowerCase();
      return action === 'grant' || action === 'approve';
    }).length;
    const permissionRejectedCount = permissionHistory.filter((entry: PermissionHistoryEntry) => {
      const action = String(entry?.action || '').trim().toLowerCase();
      return action === 'reject' || action === 'deny';
    }).length;
    const gatedFlow = approvalGrantedCount > 0 || permissionGrantedCount > 0;
    const gatedCompletionCount = Math.max(
      Number(outcome.gated_completion_count || 0),
      finalStatus === 'completed' && gatedFlow ? 1 : 0,
    );
    const gatedArtifactfulCount = Math.max(
      Number(outcome.gated_artifactful_count || 0),
      finalStatus === 'completed'
        && gatedFlow
        && (Array.isArray(task.artifacts) ? task.artifacts.length : 0) > 0
        ? 1
        : 0,
    );
    const explicitRejectedCount = Math.max(
      Number(outcome.approval_rejected_count || 0)
        + Number(outcome.permission_rejected_count || 0)
        + approvalRejectedCount
        + permissionRejectedCount,
      finalStatus === 'rejected' ? 1 : 0,
    );

    if (finalStatus === 'completed') {
      existing.completed_count += 1;
    } else if (finalStatus === 'waiting_approval' || String(task.approval_status || '').trim() === 'pending') {
      existing.approval_pending_count += 1;
    } else if (finalStatus === 'failed' || finalStatus === 'rejected' || finalStatus === 'cancelled') {
      existing.failed_count += 1;
    }
    if (Boolean(outcome.permission_needed) || Boolean(task.metadata?.pendingPermissionId)) {
      existing.permission_pending_count += 1;
    }

    existing.approval_granted_count += Math.max(Number(outcome.approval_granted_count || 0), approvalGrantedCount);
    existing.approval_rejected_count += Math.max(Number(outcome.approval_rejected_count || 0), approvalRejectedCount);
    existing.permission_granted_count += Math.max(Number(outcome.permission_granted_count || 0), permissionGrantedCount);
    existing.permission_rejected_count += Math.max(Number(outcome.permission_rejected_count || 0), permissionRejectedCount);
    existing.gated_completion_count += gatedCompletionCount;
    existing.gated_artifactful_count += gatedArtifactfulCount;
    existing.rejected_count += explicitRejectedCount;
    existing.high_risk_count += Math.max(
      Number(outcome.high_risk_count || 0),
      Boolean(outcome.requires_high_risk_pin) ? 1 : 0,
    );
    if ((Array.isArray(task.artifacts) ? task.artifacts.length : 0) > 0) {
      existing.artifactful_count += 1;
    }
    if (approvalWaitMs > 0) {
      existing.approval_wait_total_ms += approvalWaitMs;
      existing.approval_wait_samples += 1;
    }
    if (recoveryMs > 0) {
      existing.post_approval_recovery_total_ms += recoveryMs;
      existing.post_approval_recovery_samples += 1;
    }
    if (artifactDeliveryMs > 0) {
      existing.artifact_delivery_after_approval_total_ms += artifactDeliveryMs;
      existing.artifact_delivery_after_approval_samples += 1;
    }
    existing.average_duration_ms += durationMs;
    if (task.updated_at > existing.last_seen_at) {
      existing.last_seen_at = task.updated_at;
    }

    grouped.set(key, existing);

    const workflowRunId = String(task.metadata?.workflow_run_id || '').trim();
    if (workflowRunId) {
      const keys = workflowRouteKeys.get(workflowRunId) || new Set<string>();
      keys.add(key);
      workflowRouteKeys.set(workflowRunId, keys);
    }
  }

  hydrateWorkflowRecoverySignals(grouped, workflowRouteKeys, recentWorkflowRuns);

  return Array.from(grouped.values())
    .map((entry) => finalizeRouteOutcome(entry))
    .sort((left, right) => {
      return (
        right.operator_cost_score - left.operator_cost_score
        || right.gated_artifactful_count - left.gated_artifactful_count
        || right.gated_completion_count - left.gated_completion_count
        || right.workflow_recovery_artifactful_count - left.workflow_recovery_artifactful_count
        || right.workflow_recovery_success_count - left.workflow_recovery_success_count
        || right.success_rate - left.success_rate
        || right.completed_count - left.completed_count
        || right.total_count - left.total_count
        || right.last_seen_at.localeCompare(left.last_seen_at)
      );
    })
    .slice(0, 12);
}
