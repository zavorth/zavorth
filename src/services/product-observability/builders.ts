import type { PermissionRequest } from '../../contracts/PermissionRequest.js';
import type { Task } from '../../contracts/TaskContract.js';
import type { WorkflowRunSnapshot } from '../../runtime/workflows/WorkflowRunService.js';
import type {
  ApprovalExecutorStat,
  ApprovedPolicyStat,
  ArtifactKindStat,
  ExecutorStat,
  MutableRouteLearningStat,
  ProductObservabilitySnapshot,
  RouteLearningStat,
  RouteSubtypeCount,
  SurfaceSourceStat,
  WeightedCount,
  WorkflowOverview,
  WorkflowResumeStageStat,
} from './types.js';
import {
  bumpWeightedCount,
  computeWeightedAverage,
  formatDurationMs,
  sortWeightedCounts,
  toRecord,
} from './shared.js';
import {
  computeApprovalWaitMs,
  computeArtifactDeliveryAfterApprovalMs,
  computePostApprovalRecoveryMs,
  isHighRiskTask,
  isRecoveredWorkflow,
} from './readers.js';

export function collectWorkspaceStats(tasks: Task[], workflowRuns: WorkflowRunSnapshot[]): WeightedCount[] {
  const buckets = new Map<string, WeightedCount>();
  for (const task of tasks) {
    const workspace = toRecord(task.metadata).workspace || task.workspace || 'sem-workspace';
    bumpWeightedCount(buckets, workspace, task.updated_at);
  }
  for (const run of workflowRuns) {
    const workspace = run.workspace || 'sem-workspace';
    bumpWeightedCount(buckets, workspace, run.updated_at);
  }
  return sortWeightedCounts(buckets);
}

export function collectRouteStrategies(tasks: Task[]): WeightedCount[] {
  const buckets = new Map<string, WeightedCount>();
  for (const task of tasks) {
    const metadata = toRecord(task.metadata);
    const label = String(
      metadata.auto_route_strategy
      || toRecord(metadata.workspace_learned_route).strategy
      || toRecord(metadata.workspace_routing_advice).source
      || metadata.auto_route_source
      || 'sem_roteamento',
    ).trim().toLowerCase();
    bumpWeightedCount(buckets, label, task.updated_at);
  }
  return sortWeightedCounts(buckets);
}

export function collectRouteKinds(tasks: Task[]): WeightedCount[] {
  const buckets = new Map<string, WeightedCount>();
  for (const task of tasks) {
    const metadata = toRecord(task.metadata);
    const outcome = toRecord(metadata.workspace_route_outcome);
    const label = String(
      outcome.task_kind
      || metadata.route_task_kind
      || toRecord(metadata.workspace_routing_advice).task_kind
      || 'unknown',
    ).trim().toLowerCase();
    bumpWeightedCount(buckets, label, task.updated_at);
  }
  return sortWeightedCounts(buckets);
}

export function collectRouteSubtypes(tasks: Task[]): RouteSubtypeCount[] {
  const buckets = new Map<string, RouteSubtypeCount>();
  for (const task of tasks) {
    const metadata = toRecord(task.metadata);
    const outcome = toRecord(metadata.workspace_route_outcome);
    const kind = String(
      outcome.task_kind
      || metadata.route_task_kind
      || toRecord(metadata.workspace_routing_advice).task_kind
      || 'unknown',
    ).trim().toLowerCase();
    const subtype = String(
      outcome.task_subtype
      || metadata.route_task_subtype
      || toRecord(metadata.workspace_routing_advice).task_subtype
      || 'general',
    ).trim().toLowerCase();
    const key = `${kind}::${subtype}`;
    const existing = buckets.get(key) || { label: subtype, kind, count: 0, last_seen_at: task.updated_at };
    existing.count += 1;
    if (task.updated_at > existing.last_seen_at) {
      existing.last_seen_at = task.updated_at;
    }
    buckets.set(key, existing);
  }
  return Array.from(buckets.values()).sort((left, right) =>
    right.count - left.count || right.last_seen_at.localeCompare(left.last_seen_at),
  );
}

export function collectSurfaceSources(tasks: Task[]): SurfaceSourceStat[] {
  const buckets = new Map<string, SurfaceSourceStat>();
  for (const task of tasks) {
    const label = String(task.source || 'other').trim().toLowerCase() || 'other';
    bumpWeightedCount(buckets, label, task.updated_at);
  }
  return sortWeightedCounts(buckets);
}

export function collectExecutorStats(tasks: Task[]): ExecutorStat[] {
  const buckets = new Map<string, ExecutorStat>();
  for (const task of tasks) {
    const metadata = toRecord(task.metadata);
    const executor = String(
      task.executor_used
      || toRecord(metadata.workspace_routing_advice).executor
      || task.command_type
      || 'unknown',
    ).trim().toLowerCase();
    const existing = buckets.get(executor) || {
      executor,
      total: 0,
      completed: 0,
      failed: 0,
      waiting_approval: 0,
      approval_friction: 0,
      success_rate: 0,
      last_seen_at: task.updated_at,
    };
    existing.total += 1;
    if (task.status === 'completed') {
      existing.completed += 1;
    } else if (['failed', 'rejected', 'cancelled'].includes(String(task.status || ''))) {
      existing.failed += 1;
    }
    if (task.status === 'waiting_approval' || task.approval_status === 'pending') {
      existing.waiting_approval += 1;
    }
    const approvalHistory = Array.isArray(metadata.approval_history) ? metadata.approval_history : [];
    const permissionHistory = Array.isArray(metadata.permission_history) ? metadata.permission_history : [];
    existing.approval_friction += approvalHistory.filter((entry: any) => String(entry?.action || '').trim() === 'reject').length;
    existing.approval_friction += permissionHistory.filter((entry: any) => String(entry?.action || '').trim() === 'reject').length;
    if (task.updated_at > existing.last_seen_at) {
      existing.last_seen_at = task.updated_at;
    }
    buckets.set(executor, existing);
  }

  return Array.from(buckets.values())
    .map((entry) => ({
      ...entry,
      success_rate: entry.total > 0 ? Number((entry.completed / entry.total).toFixed(3)) : 0,
    }))
    .sort((left, right) => {
      const leftWeight = left.completed * 3 - left.failed * 2 - left.approval_friction + left.waiting_approval;
      const rightWeight = right.completed * 3 - right.failed * 2 - right.approval_friction + right.waiting_approval;
      return rightWeight - leftWeight || right.last_seen_at.localeCompare(left.last_seen_at);
    });
}

export function collectApprovalExecutorStats(tasks: Task[]): ApprovalExecutorStat[] {
  const buckets = new Map<string, ApprovalExecutorStat>();
  for (const task of tasks) {
    const metadata = toRecord(task.metadata);
    const executor = String(
      task.executor_used
      || toRecord(metadata.workspace_routing_advice).executor
      || task.command_type
      || 'unknown',
    ).trim().toLowerCase();
    const existing = buckets.get(executor) || {
      executor,
      pending: 0,
      rejected: 0,
      high_risk: 0,
      permissions: 0,
      last_seen_at: task.updated_at,
    };
    if (task.approval_status === 'pending' || task.status === 'waiting_approval') {
      existing.pending += 1;
    }
    const approvalHistory = Array.isArray(metadata.approval_history) ? metadata.approval_history : [];
    const permissionHistory = Array.isArray(metadata.permission_history) ? metadata.permission_history : [];
    existing.rejected += approvalHistory.filter((entry: any) => String(entry?.action || '').trim() === 'reject').length;
    existing.permissions += permissionHistory.length;
    if (isHighRiskTask(task)) {
      existing.high_risk += 1;
    }
    if (task.updated_at > existing.last_seen_at) {
      existing.last_seen_at = task.updated_at;
    }
    buckets.set(executor, existing);
  }

  return Array.from(buckets.values()).sort((left, right) => {
    const leftWeight = left.rejected * 3 + left.high_risk * 2 + left.permissions + left.pending;
    const rightWeight = right.rejected * 3 + right.high_risk * 2 + right.permissions + right.pending;
    return rightWeight - leftWeight || right.last_seen_at.localeCompare(left.last_seen_at);
  });
}

export function collectArtifactStats(tasks: Task[]): {
  topKinds: ArtifactKindStat[];
  recent: Array<{
    name: string;
    kind: string;
    type: string;
    task_id: string | null;
    created_at: string;
  }>;
} {
  const kindBuckets = new Map<string, ArtifactKindStat>();
  const recent: Array<{ name: string; kind: string; type: string; task_id: string | null; created_at: string }> = [];

  for (const task of tasks) {
    for (const artifact of Array.isArray(task.artifacts) ? task.artifacts : []) {
      const kind = String(artifact.kind || 'artifact').trim().toLowerCase() || 'artifact';
      const type = String(artifact.type || 'file').trim().toLowerCase() || 'file';
      const key = `${kind}::${type}`;
      const createdAt = String(artifact.createdAt || task.updated_at || '').trim() || task.updated_at;
      const existing = kindBuckets.get(key) || { label: kind, type, count: 0, last_seen_at: createdAt };
      existing.count += 1;
      if (createdAt > existing.last_seen_at) {
        existing.last_seen_at = createdAt;
      }
      kindBuckets.set(key, existing);
      recent.push({
        name: String(artifact.name || artifact.id || 'artefato').trim(),
        kind,
        type,
        task_id: task.task_id || null,
        created_at: createdAt,
      });
    }
  }

  recent.sort((left, right) => right.created_at.localeCompare(left.created_at));

  return {
    topKinds: Array.from(kindBuckets.values()).sort((left, right) =>
      right.count - left.count || right.last_seen_at.localeCompare(left.last_seen_at),
    ),
    recent,
  };
}

export function collectWorkflowOverviews(runs: WorkflowRunSnapshot[]): WorkflowOverview[] {
  return runs
    .map((run) => {
      const recentCheckpoints = Array.isArray(run.externalized_state?.recent_checkpoints)
        ? run.externalized_state.recent_checkpoints
        : [];
      const lastInterrupted = recentCheckpoints.find((checkpoint) => String(checkpoint?.event || '').trim() === 'stage_interrupted') || null;
      const lastInterruptedStageId = String(lastInterrupted?.resume_stage_id || '').trim() || null;
      const lastInterruptedStageLabel = lastInterruptedStageId
        ? (run.stages.find((stage) => stage.id === lastInterruptedStageId)?.label || null)
        : null;
      const recoveredFromInterruption = run.status === 'completed'
        && Boolean(lastInterrupted || run.stages.some((stage) => Number(stage.attempt_count || 0) > 1));

      return {
        workflow_run_id: run.workflow_run_id,
        workflow: run.workflow_name,
        status: run.status,
        operator_state: (run.operator_state === 'closed' ? 'closed' : 'active') as 'active' | 'closed',
        operator_close_reason: String(run.operator_close_reason || '').trim() || null,
        completed_stages: run.stages.filter((stage) => stage.status === 'completed').length,
        total_stages: run.stages.length,
        resume_stage_id: run.resume_stage?.id || null,
        resume_stage_label: run.resume_stage?.label || null,
        recovered_from_interruption: recoveredFromInterruption,
        last_interrupted_stage_label: lastInterruptedStageLabel,
        primary_artifact_name: String(run.artifacts_manifest?.primary_artifact_name || '').trim() || null,
        updated_at: run.updated_at,
      };
    })
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

export function collectRouteLearning(tasks: Task[], workflowRuns: WorkflowRunSnapshot[]): {
  topSuccessful: RouteLearningStat[];
  highestFriction: RouteLearningStat[];
  highestOperatorCost: RouteLearningStat[];
} {
  const buckets = new Map<string, MutableRouteLearningStat>();
  const workflowRouteKeys = new Map<string, Set<string>>();
  for (const task of tasks) {
    const metadata = toRecord(task.metadata);
    const outcome = toRecord(metadata.workspace_route_outcome);
    const approvalHistory = Array.isArray(metadata.approval_history) ? metadata.approval_history : [];
    const permissionHistory = Array.isArray(metadata.permission_history) ? metadata.permission_history : [];
    const securityPosture = toRecord(metadata.security_posture);
    const executor = String(
      outcome.final_executor
      || outcome.selected_executor
      || task.executor_used
      || toRecord(metadata.workspace_routing_advice).executor
      || task.command_type
      || 'unknown',
    ).trim().toLowerCase();
    const kind = String(outcome.task_kind || metadata.route_task_kind || 'unknown').trim().toLowerCase();
    const subtype = String(outcome.task_subtype || metadata.route_task_subtype || 'general').trim().toLowerCase();
    const workflow = String(outcome.workflow_name || metadata.workflow_name || '').trim().toLowerCase() || null;
    const source = String(outcome.source || metadata.auto_route_source || '').trim().toLowerCase() || null;
    const sourceSurface = String(outcome.source_surface || task.source || '').trim().toLowerCase() || null;
    const strategy = String(outcome.strategy || metadata.auto_route_strategy || '').trim().toLowerCase() || null;
    const key = [executor, workflow || 'none', kind, subtype, sourceSurface || 'none', source || 'none', strategy || 'none'].join('::');
    const existing: MutableRouteLearningStat = buckets.get(key) || {
      executor,
      source,
      source_surface: sourceSurface,
      strategy,
      workflow,
      kind,
      subtype,
      total: 0,
      completed: 0,
      failed: 0,
      waitingApproval: 0,
      waitingPermission: 0,
      rejected: 0,
      approvalGranted: 0,
      permissionGranted: 0,
      highRisk: 0,
      artifactful: 0,
      gatedCompletion: 0,
      gatedArtifactful: 0,
      workflowRecovered: 0,
      workflowRecoverySuccess: 0,
      workflowRecoveryArtifactful: 0,
      average_duration_ms: 0,
      average_approval_wait_ms: 0,
      average_post_approval_recovery_ms: 0,
      average_artifact_delivery_after_approval_ms: 0,
      operator_cost_score: 0,
      evaluable_total: 0,
      success_rate: 0,
      friction_rate: 0,
      last_seen_at: task.updated_at,
      rationale: '',
      approval_wait_total_ms: 0,
      approval_wait_samples: 0,
      post_approval_recovery_total_ms: 0,
      post_approval_recovery_samples: 0,
      artifact_delivery_after_approval_total_ms: 0,
      artifact_delivery_after_approval_samples: 0,
    };
    existing.total += 1;
    const directResponse = toRecord(metadata.direct_response_last_run);
    const directResponseCompleted =
      String(directResponse.finishedAt || '').trim().length > 0
      && String(task.result_summary || '').trim().length > 0
      && String(task.error_summary || '').trim().length === 0
      && String(task.approval_status || '').trim() !== 'pending';
    if (task.status === 'completed' || directResponseCompleted) {
      existing.completed += 1;
    } else if (['failed', 'rejected', 'cancelled'].includes(String(task.status || ''))) {
      existing.failed += 1;
    }
    if (task.status === 'waiting_approval' || task.approval_status === 'pending') {
      existing.waitingApproval += 1;
    }
    const permissionPending = String(task.approval_status || '').trim() === 'permission_pending'
      || Number(outcome.permission_pending_count || 0) > 0;
    if (permissionPending) {
      existing.waitingPermission += 1;
    }
    const approvalGrantedForTask = approvalHistory.filter((entry: any) => String(entry?.action || '').trim().toLowerCase() === 'approve').length;
    const permissionGrantedForTask = permissionHistory.filter((entry: any) => {
      const action = String(entry?.action || '').trim().toLowerCase();
      return action === 'grant' || action === 'approve';
    }).length;
    const approvalWaitMs = computeApprovalWaitMs(task, approvalHistory, permissionHistory);
    const recoveryMs = computePostApprovalRecoveryMs(task, approvalHistory, permissionHistory);
    const artifactDeliveryMs = computeArtifactDeliveryAfterApprovalMs(task, approvalHistory, permissionHistory);
    existing.rejected +=
      approvalHistory.filter((entry: any) => String(entry?.action || '').trim().toLowerCase() === 'reject').length
      + permissionHistory.filter((entry: any) => {
        const action = String(entry?.action || '').trim().toLowerCase();
        return action === 'reject' || action === 'deny';
      }).length
      + (String(task.approval_status || '').trim() === 'rejected' ? 1 : 0);
    existing.approvalGranted += approvalGrantedForTask;
    existing.permissionGranted += permissionGrantedForTask;
    const gatedFlow = approvalGrantedForTask > 0 || permissionGrantedForTask > 0;
    if (Boolean(securityPosture.high_risk_confirmation_required) || Number(task.risk_level || 0) >= 7) {
      existing.highRisk += 1;
    }
    if (Array.isArray(task.artifacts) && task.artifacts.length > 0) {
      existing.artifactful += 1;
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
    existing.gatedCompletion += Math.max(
      Number(outcome.gated_completion_count || 0),
      task.status === 'completed' && gatedFlow ? 1 : 0,
    );
    existing.gatedArtifactful += Math.max(
      Number(outcome.gated_artifactful_count || 0),
      task.status === 'completed' && gatedFlow && Array.isArray(task.artifacts) && task.artifacts.length > 0 ? 1 : 0,
    );
    existing.average_duration_ms += Math.max(0, Number(outcome.duration_ms || 0));
    if (task.updated_at > existing.last_seen_at) {
      existing.last_seen_at = task.updated_at;
    }
    buckets.set(key, existing);

    const workflowRunId = String(metadata.workflow_run_id || '').trim();
    if (workflowRunId) {
      const keys = workflowRouteKeys.get(workflowRunId) || new Set<string>();
      keys.add(key);
      workflowRouteKeys.set(workflowRunId, keys);
    }
  }

  for (const run of workflowRuns) {
    const workflowRunId = String(run.workflow_run_id || '').trim();
    if (!workflowRunId) {
      continue;
    }
    const routeKeys = workflowRouteKeys.get(workflowRunId);
    if (!routeKeys || routeKeys.size === 0) {
      continue;
    }
    const recovered =
      String(run.status || '').trim().toLowerCase() === 'completed'
      && isRecoveredWorkflow(run);
    const recoverySuccess = recovered ? 1 : 0;
    const recoveryArtifactful =
      recoverySuccess > 0 && Boolean(String(run.artifacts_manifest?.primary_artifact_name || '').trim()) ? 1 : 0;
    if (!recovered && recoveryArtifactful === 0) {
      continue;
    }

    for (const routeKey of routeKeys) {
      const existing = buckets.get(routeKey);
      if (!existing) {
        continue;
      }
      existing.workflowRecovered += recovered ? 1 : 0;
      existing.workflowRecoverySuccess += recoverySuccess;
      existing.workflowRecoveryArtifactful += recoveryArtifactful;
      if (run.updated_at > existing.last_seen_at) {
        existing.last_seen_at = run.updated_at;
      }
      buckets.set(routeKey, existing);
    }
  }

  const values = Array.from(buckets.values()).map((entry) => {
    const frictionCount = entry.failed + entry.waitingApproval + entry.waitingPermission + entry.rejected;
    const evaluableTotal = entry.completed + frictionCount;
    const successRate = evaluableTotal > 0 ? Number((entry.completed / evaluableTotal).toFixed(3)) : 0;
    const frictionRate = evaluableTotal > 0 ? Number((frictionCount / evaluableTotal).toFixed(3)) : 0;
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
      average_duration_ms: entry.total > 0 ? Math.round(entry.average_duration_ms / entry.total) : 0,
      average_approval_wait_ms: averageApprovalWaitMs,
      average_post_approval_recovery_ms: averageRecoveryMs,
      average_artifact_delivery_after_approval_ms: averageArtifactDeliveryMs,
      operator_cost_score: operatorCostScore,
      evaluable_total: evaluableTotal,
      success_rate: successRate,
      friction_rate: frictionRate,
      rationale:
        `${entry.completed}/${evaluableTotal || entry.total} concluido(s) avaliaveis, ${entry.total} observado(s), ${entry.failed} falha(s), `
        + `${entry.rejected} rejeicao(oes), ${entry.waitingApproval} aguardando aprovacao`
        + `${entry.gatedCompletion > 0 ? `, ${entry.gatedCompletion} fluxo(s) aprovados concluido(s)` : ''}`
        + `${entry.gatedArtifactful > 0 ? ` com ${entry.gatedArtifactful} entrega(s) apos aprovacao` : ''}`
        + `${entry.workflowRecoverySuccess > 0 ? `, ${entry.workflowRecoverySuccess} retomada(s) concluida(s)` : ''}`
        + `${entry.workflowRecoveryArtifactful > 0 ? ` com ${entry.workflowRecoveryArtifactful} entrega(s) finais` : ''}`
        + `${averageApprovalWaitMs > 0 ? `, espera media ${formatDurationMs(averageApprovalWaitMs)}` : ''}`
        + `${averageRecoveryMs > 0 ? `, retomada media ${formatDurationMs(averageRecoveryMs)}` : ''}`
        + `${averageArtifactDeliveryMs > 0 ? `, entrega final media ${formatDurationMs(averageArtifactDeliveryMs)}` : ''}`
        + `${entry.source_surface ? ` via ${entry.source_surface}` : ''}.`,
    };
  });

  return {
    topSuccessful: [...values].sort((left, right) => {
      const leftWeight =
        left.success_rate * 100
        + left.completed * 3
        + left.artifactful
        + left.gatedCompletion * 2
        + left.gatedArtifactful * 3
        + left.workflowRecoverySuccess * 3
        + left.workflowRecoveryArtifactful * 4
        + left.approvalGranted * 2
        + left.permissionGranted
        - left.rejected * 2;
      const rightWeight =
        right.success_rate * 100
        + right.completed * 3
        + right.artifactful
        + right.gatedCompletion * 2
        + right.gatedArtifactful * 3
        + right.workflowRecoverySuccess * 3
        + right.workflowRecoveryArtifactful * 4
        + right.approvalGranted * 2
        + right.permissionGranted
        - right.rejected * 2;
      return rightWeight - leftWeight || right.last_seen_at.localeCompare(left.last_seen_at);
    }),
    highestFriction: [...values]
      .filter((entry) => entry.friction_rate > 0)
      .sort((left, right) => {
        const leftWeight =
          left.friction_rate * 100
          + left.failed * 3
          + left.rejected * 3
          + left.waitingApproval * 2
          + left.waitingPermission
          + left.highRisk;
        const rightWeight =
          right.friction_rate * 100
          + right.failed * 3
          + right.rejected * 3
          + right.waitingApproval * 2
          + right.waitingPermission
          + right.highRisk;
        return rightWeight - leftWeight || right.last_seen_at.localeCompare(left.last_seen_at);
      }),
    highestOperatorCost: [...values]
      .filter((entry) => Number(entry.operator_cost_score || 0) > 0)
      .sort((left, right) => {
        return (
          Number(right.operator_cost_score || 0) - Number(left.operator_cost_score || 0)
          || Number(right.gatedArtifactful || 0) - Number(left.gatedArtifactful || 0)
          || Number(right.workflowRecoveryArtifactful || 0) - Number(left.workflowRecoveryArtifactful || 0)
          || right.last_seen_at.localeCompare(left.last_seen_at)
        );
      }),
  };
}

export function collectApprovedPolicyLearning(permissions: PermissionRequest[]): ApprovedPolicyStat[] {
  const buckets = new Map<string, ApprovedPolicyStat>();
  for (const permission of permissions) {
    if (String(permission.status || '').trim() !== 'approved') {
      continue;
    }
    const executor = String(permission.executor || 'unknown').trim().toLowerCase();
    const kind = String(permission.kind || 'permission').trim().toLowerCase();
    const scope = String(permission.scope || 'once').trim().toLowerCase();
    const key = `${executor}::${kind}::${scope}`;
    const existing = buckets.get(key) || {
      executor,
      kind,
      scope,
      count: 0,
      last_seen_at: permission.updated_at,
      rationale: '',
    };
    existing.count += 1;
    if (permission.updated_at > existing.last_seen_at) {
      existing.last_seen_at = permission.updated_at;
    }
    buckets.set(key, existing);
  }

  return Array.from(buckets.values())
    .map((entry) => ({
      ...entry,
      rationale: `${entry.count} aprovacao(oes) recente(s) de ${entry.kind} para ${entry.executor}.`,
    }))
    .sort((left, right) =>
      right.count - left.count || right.last_seen_at.localeCompare(left.last_seen_at),
    );
}

export function collectWorkflowResumeStages(runs: WorkflowRunSnapshot[]): WorkflowResumeStageStat[] {
  const buckets = new Map<string, WorkflowResumeStageStat>();
  for (const run of runs) {
    const stageLabel = String(run.resume_stage?.label || '').trim();
    if (!stageLabel) {
      continue;
    }
    const workflow = String(run.workflow_name || 'workflow').trim().toLowerCase();
    const key = `${workflow}::${stageLabel.toLowerCase()}`;
    const existing = buckets.get(key) || {
      workflow,
      stage_label: stageLabel,
      count: 0,
      approval_pending: 0,
      blocked: 0,
      failed: 0,
      last_seen_at: run.updated_at,
      rationale: '',
    };
    existing.count += 1;
    const status = String(run.resume_stage?.status || '').trim().toLowerCase();
    if (status === 'approval_pending') {
      existing.approval_pending += 1;
    } else if (status === 'blocked') {
      existing.blocked += 1;
    } else if (status === 'failed') {
      existing.failed += 1;
    }
    if (run.updated_at > existing.last_seen_at) {
      existing.last_seen_at = run.updated_at;
    }
    buckets.set(key, existing);
  }

  return Array.from(buckets.values())
    .map((entry) => ({
      ...entry,
      rationale: `${entry.count} run(s) recente(s) param em ${entry.stage_label}${entry.approval_pending ? `, ${entry.approval_pending} aguardando aprovacao` : ''}.`,
    }))
    .sort((left, right) => {
      const leftWeight = left.count * 3 + left.approval_pending * 2 + left.blocked * 2 + left.failed * 3;
      const rightWeight = right.count * 3 + right.approval_pending * 2 + right.blocked * 2 + right.failed * 3;
      return rightWeight - leftWeight || right.last_seen_at.localeCompare(left.last_seen_at);
    });
}

export function collectOperatorCostSummary(
  routes: RouteLearningStat[],
): ProductObservabilitySnapshot['operatorCost'] {
  const relevantRoutes = routes.filter((entry) => {
    return (
      Number(entry.average_approval_wait_ms || 0) > 0
      || Number(entry.average_post_approval_recovery_ms || 0) > 0
      || Number(entry.average_artifact_delivery_after_approval_ms || 0) > 0
    );
  });
  return {
    averageApprovalWaitMs: computeWeightedAverage(relevantRoutes, 'average_approval_wait_ms'),
    averageRecoveryMs: computeWeightedAverage(relevantRoutes, 'average_post_approval_recovery_ms'),
    averageArtifactDeliveryMs: computeWeightedAverage(relevantRoutes, 'average_artifact_delivery_after_approval_ms'),
    heaviestRoute: relevantRoutes[0] || null,
  };
}
