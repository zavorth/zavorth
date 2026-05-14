import type { PermissionRequest } from '../../contracts/PermissionRequest.js';
import type { Task } from '../../contracts/TaskContract.js';
import type { WorkflowRunSnapshot } from '../../runtime/workflows/WorkflowRunService.js';
import type { ProductObservabilitySnapshot } from './types.js';
import { normalizeOptionalString, toRecord } from './shared.js';

export function matchesTaskScope(task: Task, scope: ProductObservabilitySnapshot['scope']): boolean {
  if (scope.workspace && normalizeOptionalString(task.workspace) !== scope.workspace) {
    return false;
  }

  const metadata = toRecord(task.metadata);
  const outcome = toRecord(metadata.workspace_route_outcome);
  const surface = normalizeOptionalString(outcome.source_surface || task.source);
  if (scope.sourceSurface && surface !== scope.sourceSurface) {
    return false;
  }

  const executor = normalizeOptionalString(
    outcome.final_executor
    || outcome.selected_executor
    || task.executor_used
    || toRecord(metadata.workspace_routing_advice).executor
    || task.command_type,
  );
  if (scope.executor && executor !== scope.executor) {
    return false;
  }

  const workflow = normalizeOptionalString(outcome.workflow_name || metadata.workflow_name);
  if (scope.workflow && workflow !== scope.workflow) {
    return false;
  }

  return true;
}

export function matchesPermissionScope(
  permission: PermissionRequest,
  scope: ProductObservabilitySnapshot['scope'],
  filteredTaskIds: Set<string>,
): boolean {
  if (!scope.scoped) {
    return true;
  }
  if (permission.task_id && filteredTaskIds.has(permission.task_id)) {
    return true;
  }
  if (scope.workspace && normalizeOptionalString(permission.workspace) !== scope.workspace) {
    return false;
  }
  if (scope.executor && normalizeOptionalString(permission.executor) !== scope.executor) {
    return false;
  }
  return !scope.workflow && !scope.sourceSurface;
}

export function matchesWorkflowScope(run: WorkflowRunSnapshot, scope: ProductObservabilitySnapshot['scope']): boolean {
  if (scope.workspace && normalizeOptionalString(run.workspace) !== scope.workspace) {
    return false;
  }
  if (scope.workflow && normalizeOptionalString(run.workflow_name) !== scope.workflow) {
    return false;
  }
  if (scope.executor) {
    const hasExecutor = Array.isArray(run.stages)
      && run.stages.some((stage) => normalizeOptionalString(stage.executor) === scope.executor);
    if (!hasExecutor) {
      return false;
    }
  }
  return true;
}

export function isHighRiskTask(task: Task): boolean {
  const metadata = toRecord(task.metadata);
  const posture = toRecord(metadata.security_posture);
  const approvalHistory = Array.isArray(metadata.approval_history) ? metadata.approval_history : [];
  return posture.high_risk_confirmation_required === true
    || approvalHistory.some((entry: any) => entry?.required_high_risk_pin === true);
}

export function collectGateDecisionTimes(approvalHistory: any[], permissionHistory: any[]): number[] {
  return [
    ...approvalHistory
      .filter((entry: any) => String(entry?.action || '').trim().toLowerCase() === 'approve')
      .map((entry: any) => Date.parse(String(entry?.at || ''))),
    ...permissionHistory
      .filter((entry: any) => {
        const action = String(entry?.action || '').trim().toLowerCase();
        return action === 'grant' || action === 'approve';
      })
      .map((entry: any) => Date.parse(String(entry?.at || ''))),
  ]
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
}

export function computeApprovalWaitMs(task: Task, approvalHistory: any[], permissionHistory: any[]): number {
  const createdAtMs = Date.parse(String(task.created_at || ''));
  if (!Number.isFinite(createdAtMs)) {
    return 0;
  }

  const gateTimes = collectGateDecisionTimes(approvalHistory, permissionHistory);
  const pending =
    String(task.approval_status || '').trim().toLowerCase() === 'pending'
    || String(task.status || '').trim().toLowerCase() === 'waiting_approval'
    || Number(toRecord(task.metadata).workspace_route_outcome?.permission_pending_count || 0) > 0;
  const referenceMs = gateTimes[0]
    || (pending ? Date.parse(String(task.updated_at || '')) : NaN);
  if (!Number.isFinite(referenceMs)) {
    return 0;
  }

  return Math.max(0, Math.round(referenceMs - createdAtMs));
}

export function computePostApprovalRecoveryMs(task: Task, approvalHistory: any[], permissionHistory: any[]): number {
  const gateTimes = collectGateDecisionTimes(approvalHistory, permissionHistory);
  const finalGateAt = gateTimes.length > 0 ? gateTimes[gateTimes.length - 1] : NaN;
  const finishedAtMs = Date.parse(String(task.updated_at || ''));
  if (!Number.isFinite(finalGateAt) || !Number.isFinite(finishedAtMs) || String(task.status || '').trim().toLowerCase() !== 'completed') {
    return 0;
  }

  return Math.max(0, Math.round(finishedAtMs - finalGateAt));
}

export function computeArtifactDeliveryAfterApprovalMs(task: Task, approvalHistory: any[], permissionHistory: any[]): number {
  const gateTimes = collectGateDecisionTimes(approvalHistory, permissionHistory);
  const finalGateAt = gateTimes.length > 0 ? gateTimes[gateTimes.length - 1] : NaN;
  if (!Number.isFinite(finalGateAt)) {
    return 0;
  }

  const artifactTimes = (Array.isArray(task.artifacts) ? task.artifacts : [])
    .map((artifact: any) => Date.parse(String(artifact?.created_at || artifact?.createdAt || '')))
    .filter((value) => Number.isFinite(value) && value >= finalGateAt)
    .sort((left, right) => left - right);
  if (artifactTimes.length > 0) {
    return Math.max(0, Math.round(artifactTimes[0] - finalGateAt));
  }

  return 0;
}

export function isRecoveredWorkflow(run: WorkflowRunSnapshot): boolean {
  const checkpoints = Array.isArray(run.externalized_state?.recent_checkpoints)
    ? run.externalized_state?.recent_checkpoints
    : [];
  return checkpoints.some((checkpoint: any) => String(checkpoint?.event || '').trim().toLowerCase() === 'stage_interrupted');
}
