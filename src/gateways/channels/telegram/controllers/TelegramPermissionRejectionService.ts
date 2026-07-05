import { PermissionRequest } from '../../../../contracts/PermissionRequest.js';
import { Task } from '../../../../contracts/TaskContract.js';
import { TaskSecurityPostureService } from '../../../../services/TaskSecurityPostureService.js';

const TERMINAL_TASK_STATUSES = new Set<Task['status']>([
  'completed',
  'failed',
  'rejected',
  'cancelled',
  'reverted',
]);

export type TelegramPermissionRejectionServiceDeps = {
  taskSecurityPosture: TaskSecurityPostureService;
  persistTask: (task: Task) => void;
  advanceTaskState: (task: Task, nextState: Task['status']) => void;
  syncWorkflowApprovalDecision: (
    task: Task | undefined,
    action: 'approve' | 'reject',
    summary: string,
  ) => void;
};

export class TelegramPermissionRejectionService {
  constructor(private readonly deps: TelegramPermissionRejectionServiceDeps) {}

  public finalizeRejection(
    permission: PermissionRequest,
    rejectedPermission: PermissionRequest,
    userId: string,
    note: string | null,
    existingTask: Task | undefined,
    isZavorthBridgePermission: boolean,
  ): void {
    if (!existingTask || TERMINAL_TASK_STATUSES.has(existingTask.status)) {
      return;
    }

    const rejectionSummary =
      note || `Permission request ${rejectedPermission.permission_id} rejected by the operator.`;

    if (isZavorthBridgePermission) {
      this.deps.syncWorkflowApprovalDecision(existingTask, 'reject', rejectionSummary);
      return;
    }

    const decisionAt = new Date().toISOString();
    existingTask.requires_approval = false;
    existingTask.approval_status = 'rejected';
    existingTask.error_summary = rejectionSummary;
    existingTask.metadata = {
      ...this.deps.taskSecurityPosture.appendPermissionDecision(existingTask.metadata, {
        permission_id: rejectedPermission.permission_id,
        action: 'reject',
        actor: userId,
        at: decisionAt,
        executor: rejectedPermission.executor,
        kind: rejectedPermission.kind,
        scope: rejectedPermission.scope,
        value: rejectedPermission.resolved_value || rejectedPermission.requested_value || null,
        source: 'telegram_perm_reject',
      }),
      pendingPermissionId: null,
      pendingPermissionNotifiedAt: null,
      pendingPermissionNotificationError: null,
      zavorthBridgePermissionRejectedAt: existingTask.metadata?.zavorthBridgePermissionRejectedAt || null,
      zavorthBridgePermissionScope: existingTask.metadata?.zavorthBridgePermissionScope || null,
      zavorthBridgePermissionValue: existingTask.metadata?.zavorthBridgePermissionValue || null,
    };

    this.deps.persistTask(existingTask);
    this.deps.advanceTaskState(
      existingTask,
      existingTask.status === 'waiting_approval' ? 'rejected' : 'failed',
    );
    this.deps.syncWorkflowApprovalDecision(existingTask, 'reject', rejectionSummary);
  }
}
