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
      title: 'Aprovar a acao pendente',
      description: permissionReason || 'Continua a execucao no mesmo contexto.',
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
          label: 'Aprovar no chat',
          value: permissionId,
        },
        telegram: {
          mode: 'inline',
          label: 'Aprovar inline no Telegram',
          value: permissionId,
        },
        discord: {
          mode: 'hidden',
          label: 'Nao exposto no Discord',
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
      title: 'Recusar a acao pendente',
      description: permissionReason || 'Cancela a acao pendente e preserva o restante do contexto.',
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
          label: 'Recusar no chat',
          value: permissionId,
        },
        telegram: {
          mode: 'inline',
          label: 'Recusar inline no Telegram',
          value: permissionId,
        },
        discord: {
          mode: 'hidden',
          label: 'Nao exposto no Discord',
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
