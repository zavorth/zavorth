import { Context } from 'grammy';
import { PermissionRequest } from '../../../../contracts/PermissionRequest.js';
import { Task } from '../../../../contracts/TaskContract.js';
import { TaskSecurityPostureService } from '../../../../services/TaskSecurityPostureService.js';
import { TelegramAiStudioPermissionApprovalService } from '../../../../gateways/channels/telegram/controllers/TelegramAiStudioPermissionApprovalService.js';
import { TelegramCodexRemotePermissionApprovalService } from '../../../../gateways/channels/telegram/controllers/TelegramCodexRemotePermissionApprovalService.js';
import { TelegramFileDeliveryPermissionApprovalService } from '../../../../gateways/channels/telegram/controllers/TelegramFileDeliveryPermissionApprovalService.js';
import { TelegramExternalExecutorPermissionApprovalService } from '../../../../gateways/channels/telegram/controllers/TelegramExternalExecutorPermissionApprovalService.js';
import { TelegramPermissionPolicyService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionPolicyService.js';
import { TelegramTaskExecutorApprovalSupportService } from '../../../../gateways/channels/telegram/controllers/TelegramTaskExecutorApprovalSupportService.js';
import type { TelegramPermissionApprovalPatch } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionDecisionService.js';

export type TelegramPermissionExecutorApprovalServiceDeps = {
  permissionPolicy: TelegramPermissionPolicyService;
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
  resumeFileDeliveryPermission?: (ctx: Context, permission: PermissionRequest) => Promise<boolean>;
  resumeFileInspectionPermission?: (ctx: Context, permission: PermissionRequest) => Promise<boolean>;
};

export class TelegramPermissionExecutorApprovalService {
  private readonly aiStudioApprovals: TelegramAiStudioPermissionApprovalService;
  private readonly codexRemoteApprovals: TelegramCodexRemotePermissionApprovalService;
  private readonly fileDeliveryApprovals: TelegramFileDeliveryPermissionApprovalService;
  private readonly externalExecutorApprovals: TelegramExternalExecutorPermissionApprovalService;

  constructor(private readonly deps: TelegramPermissionExecutorApprovalServiceDeps) {
    const taskApprovalSupport = new TelegramTaskExecutorApprovalSupportService({
      taskSecurityPosture: this.deps.taskSecurityPosture,
      persistTask: this.deps.persistTask,
      replyWithPermissionDecision: this.deps.replyWithPermissionDecision,
      resumeApprovedTaskOrWorkflow: this.deps.resumeApprovedTaskOrWorkflow,
      syncWorkflowApprovalDecision: this.deps.syncWorkflowApprovalDecision,
    });

    this.externalExecutorApprovals = new TelegramExternalExecutorPermissionApprovalService({
      permissionPolicy: this.deps.permissionPolicy,
      taskApprovalSupport,
    });
    this.aiStudioApprovals = new TelegramAiStudioPermissionApprovalService({
      permissionPolicy: this.deps.permissionPolicy,
      taskApprovalSupport,
    });
    this.codexRemoteApprovals = new TelegramCodexRemotePermissionApprovalService();
    this.fileDeliveryApprovals = new TelegramFileDeliveryPermissionApprovalService({
      replyWithPermissionDecision: this.deps.replyWithPermissionDecision,
      resumeFileDeliveryPermission: this.deps.resumeFileDeliveryPermission,
      resumeFileInspectionPermission: this.deps.resumeFileInspectionPermission,
    });
  }

  public prepareApprovalPatch(
    permission: PermissionRequest,
    patch: TelegramPermissionApprovalPatch,
  ): void {
    if (permission.executor === 'aistudio') {
      this.aiStudioApprovals.prepareApprovalPatch(permission, patch);
    }
  }

  public async finalizeApproval(
    ctx: Context,
    permission: PermissionRequest,
    approved: PermissionRequest,
    userId: string,
    existingTask?: Task,
  ): Promise<boolean> {
    if (permission.executor === 'codex_remote') {
      return this.codexRemoteApprovals.finalizeApproval(ctx, approved, userId);
    }

    if (permission.executor === 'external_executor' && existingTask) {
      return this.externalExecutorApprovals.finalizeApproval(
        ctx,
        permission,
        approved,
        userId,
        existingTask,
      );
    }

    if (permission.executor === 'aistudio' && existingTask) {
      return this.aiStudioApprovals.finalizeApproval(
        ctx,
        permission,
        approved,
        userId,
        existingTask,
      );
    }

    if (permission.executor === 'file_delivery' && permission.kind === 'workspace_access') {
      return this.fileDeliveryApprovals.finalizeApproval(ctx, approved);
    }

    return false;
  }
}
