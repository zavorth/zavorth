import { Context } from 'grammy';
import { PermissionRequest } from '../../../../contracts/PermissionRequest.js';
import { Task } from '../../../../contracts/TaskContract.js';
import { TaskSecurityPostureService } from '../../../../services/TaskSecurityPostureService.js';

const WORKFLOW_APPROVAL_SUMMARY =
  'Permission approved. Workflow released to continue this stage.';

export type TelegramTaskExecutorApprovalSupportServiceDeps = {
  taskSecurityPosture: TaskSecurityPostureService;
  persistTask: (task: Task) => void;
  replyWithPermissionDecision: (
    ctx: Context,
    permission: PermissionRequest,
    action: 'approve' | 'reject' | 'edit',
  ) => Promise<void>;
  resumeApprovedTaskOrWorkflow: (ctx: Context, task: Task) => Promise<void>;
  syncWorkflowApprovalDecision: (
    task: Task | undefined,
    action: 'approve' | 'reject',
    summary: string,
  ) => void;
};

export class TelegramTaskExecutorApprovalSupportService {
  constructor(private readonly deps: TelegramTaskExecutorApprovalSupportServiceDeps) {}

  public appendApprovalDecision(
    task: Task,
    approved: PermissionRequest,
    userId: string,
  ): Record<string, any> {
    return this.deps.taskSecurityPosture.appendPermissionDecision(task.metadata, {
      permission_id: approved.permission_id,
      action: 'approve',
      actor: userId,
      at: new Date().toISOString(),
      executor: approved.executor,
      kind: approved.kind,
      scope: approved.scope,
      value: approved.resolved_value || approved.requested_value || null,
      source: 'telegram_perm_approve',
    });
  }

  public async completeTaskApproval(
    ctx: Context,
    task: Task,
    approved: PermissionRequest,
    metadata: Record<string, any>,
  ): Promise<boolean> {
    task.metadata = metadata;
    task.requires_approval = false;
    task.approval_status = 'approved';
    this.deps.persistTask(task);

    if (task.status === 'waiting_approval') {
      this.deps.syncWorkflowApprovalDecision(task, 'approve', WORKFLOW_APPROVAL_SUMMARY);
      await this.deps.replyWithPermissionDecision(ctx, approved, 'approve');
      await this.deps.resumeApprovedTaskOrWorkflow(ctx, task);
      return true;
    }

    return false;
  }
}
