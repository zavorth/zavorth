import type {
  SurfaceConsistencyActionContext,
  SurfaceConsistencyReadiness,
} from './SharedSurfaceConsistencyTypes.js';
import {
  buildActionAvailability,
  buildActionSnapshot,
  type SurfaceConsistencyPrioritizedAction,
} from './SharedSurfaceConsistencyActionSupport.js';

export function pushApprovalActions(
  actions: SurfaceConsistencyPrioritizedAction[],
  context: SurfaceConsistencyActionContext,
  readiness: SurfaceConsistencyReadiness,
): void {
  const pendingPermission = (context.permissions || []).find((permission) => {
    return String(permission?.status || '').trim().toLowerCase() === 'pending';
  }) || null;
  if (!pendingPermission) {
    return;
  }

  const permissionId = String(pendingPermission.permission_id || '').trim();
  const permissionTaskId = String(pendingPermission.task_id || '').trim();
  const permissionReason = String(pendingPermission.reason || pendingPermission.scope || '').trim();
  actions.push({
    priority: 80,
    snapshot: buildActionSnapshot({
      actionId: `approve-pending-task:${permissionId}`,
      actionType: 'approve-pending-task',
      title: 'Approve pending action',
      description: permissionReason || 'Continues execution in the same context.',
      category: 'approval',
      availability: buildActionAvailability(
        { mode: 'inline' },
        { mode: 'inline' },
        { mode: 'hidden' },
        readiness,
      ),
      equivalents: {
        web: {
          mode: 'inline',
          label: 'Approve in chat',
          value: permissionId,
        },
        telegram: {
          mode: 'inline',
          label: 'Approve inline on Telegram',
          value: permissionId,
        },
        discord: {
          mode: 'hidden',
          label: 'Not exposed on Discord',
          value: null,
        },
      },
      context: {
        taskId: permissionTaskId || null,
        permissionId: permissionId || null,
        workflowRunId: null,
        workflowStageId: null,
        artifactId: null,
        artifactPath: null,
        reason: permissionReason || null,
      },
    }),
  });
  actions.push({
    priority: 79,
    snapshot: buildActionSnapshot({
      actionId: `reject-pending-task:${permissionId}`,
      actionType: 'reject-pending-task',
      title: 'Recusar a action pending',
      description: permissionReason || 'Cancela a action pending e preserva o restante do contexto.',
      category: 'approval',
      availability: buildActionAvailability(
        { mode: 'inline' },
        { mode: 'inline' },
        { mode: 'hidden' },
        readiness,
      ),
      equivalents: {
        web: {
          mode: 'inline',
          label: 'Reject in chat',
          value: permissionId,
        },
        telegram: {
          mode: 'inline',
          label: 'Reject inline on Telegram',
          value: permissionId,
        },
        discord: {
          mode: 'hidden',
          label: 'Not exposed on Discord',
          value: null,
        },
      },
      context: {
        taskId: permissionTaskId || null,
        permissionId: permissionId || null,
        workflowRunId: null,
        workflowStageId: null,
        artifactId: null,
        artifactPath: null,
        reason: permissionReason || null,
      },
    }),
  });
}
