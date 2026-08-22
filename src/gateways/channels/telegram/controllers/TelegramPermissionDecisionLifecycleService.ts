import { Context } from 'grammy';
import { PermissionRequest } from '../../../../contracts/PermissionRequest.js';
import { Task } from '../../../../contracts/TaskContract.js';
import { TaskManager } from '../../../../orchestrator/TaskManager.js';
import { AuditLogger } from '../../../../monitoring/AuditLogger.js';
import type { WorkflowRunService } from '../../../../runtime/workflows/WorkflowRunService.js';
import { logger } from '../../../../logger';
export type TelegramPermissionDecisionLifecycleServiceDeps = {
  taskManager: Pick<TaskManager, 'advanceState'>;
  resumeTaskExecution: (ctx: Context, task: Task) => Promise<void>;
  resumeWorkflowExecution?: (ctx: Context, task: Task) => Promise<boolean>;
  workflowRunService?: Pick<WorkflowRunService, 'applyStageApprovalDecision'>;
  auditLogger?: AuditLogger;
};

export class TelegramPermissionDecisionLifecycleService {
  constructor(private readonly deps: TelegramPermissionDecisionLifecycleServiceDeps) {}

  public async resumeApprovedTaskOrWorkflow(ctx: Context, task: Task): Promise<void> {
    const resumedWorkflow = await this.tryResumeWorkflowExecution(ctx, task);
    if (resumedWorkflow) {
      return;
    }

    this.deps.taskManager.advanceState(task, 'running');
    await this.deps.resumeTaskExecution(ctx, task);
  }

  public syncWorkflowApprovalDecision(
    task: Task | undefined,
    action: 'approve' | 'reject',
    summary: string,
  ): void {
    if (!task || !this.deps.workflowRunService) {
      return;
    }

    const workflowRunId = String(task.metadata?.workflow_run_id || '').trim();
    if (!workflowRunId) {
      return;
    }

    this.deps.workflowRunService.applyStageApprovalDecision({
      workflowRunId,
      stageId:
        String(
          task.metadata?.workflow_stage_id || task.metadata?.workflow_resume_stage_id || '',
        ).trim() || null,
      taskId: task.task_id,
      action,
      summary,
    });
  }

  public async recordPermissionDecisionAudit(
    permission: PermissionRequest | undefined,
    action: 'approve' | 'reject' | 'grant' | 'revoke',
    userId: string | null,
    details: Record<string, unknown> = {},
  ): Promise<void> {
    if (!this.deps.auditLogger || !permission) {
      return;
    }

    try {
      await this.deps.auditLogger.logPermissionDecision(permission, action, userId, details);
    } catch (error: unknown) {// audit should never block permission handling
      logger.warn('[Telegram Permission Decision Lifecycle] operation failed', error);
    }
  }

  private async tryResumeWorkflowExecution(ctx: Context, task: Task): Promise<boolean> {
    if (!this.deps.resumeWorkflowExecution) {
      return false;
    }

    const workflowRunId = String(task.metadata?.workflow_run_id || '').trim();
    if (!workflowRunId) {
      return false;
    }

    return this.deps.resumeWorkflowExecution(ctx, task);
  }
}
