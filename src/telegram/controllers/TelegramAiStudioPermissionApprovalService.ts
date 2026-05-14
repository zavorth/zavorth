import { Context } from 'grammy';
import { config } from '../../config/index.js';
import { PermissionRequest } from '../../contracts/PermissionRequest.js';
import { Task } from '../../contracts/TaskContract.js';
import { TelegramPermissionPolicyService } from './TelegramPermissionPolicyService.js';
import { TelegramTaskExecutorApprovalSupportService } from './TelegramTaskExecutorApprovalSupportService.js';
import type { TelegramPermissionApprovalPatch } from './TelegramPermissionDecisionService.js';

export type TelegramAiStudioPermissionApprovalServiceDeps = {
  permissionPolicy: TelegramPermissionPolicyService;
  taskApprovalSupport: TelegramTaskExecutorApprovalSupportService;
};

export class TelegramAiStudioPermissionApprovalService {
  constructor(private readonly deps: TelegramAiStudioPermissionApprovalServiceDeps) {}

  public prepareApprovalPatch(
    permission: PermissionRequest,
    patch: TelegramPermissionApprovalPatch,
  ): void {
    if (
      !patch.resolved_value &&
      (permission.kind === 'builtin_tool_access' || permission.kind === 'service_access')
    ) {
      patch.resolved_value = permission.resolved_value || permission.requested_value || null;
      patch.requested_value =
        patch.requested_value || permission.requested_value || patch.resolved_value;
    }
  }

  public async finalizeApproval(
    ctx: Context,
    permission: PermissionRequest,
    approved: PermissionRequest,
    userId: string,
    existingTask: Task,
  ): Promise<boolean> {
    const approvedValues = this.deps.permissionPolicy.extractAiStudioPermissionValues(approved);
    const nextMetadata = {
      ...this.deps.taskApprovalSupport.appendApprovalDecision(existingTask, approved, userId),
      pendingPermissionId: null,
      pendingPermissionNotifiedAt: null,
      pendingPermissionNotificationError: null,
      aistudioPermissionApprovedAt: new Date().toISOString(),
      aistudio_model:
        approved.metadata?.suggested_model ||
        existingTask.metadata?.aistudio_model ||
        config.aiStudioModel,
    } as Record<string, any>;

    if (permission.kind === 'builtin_tool_access') {
      nextMetadata.aistudio_allowed_tools = this.deps.permissionPolicy.mergeNormalizedValues(
        Array.isArray(existingTask.metadata?.aistudio_allowed_tools)
          ? existingTask.metadata.aistudio_allowed_tools
          : [],
        approvedValues,
      );
    }

    if (permission.kind === 'service_access') {
      nextMetadata.aistudio_allowed_services = this.deps.permissionPolicy.mergeNormalizedValues(
        Array.isArray(existingTask.metadata?.aistudio_allowed_services)
          ? existingTask.metadata.aistudio_allowed_services
          : [],
        approvedValues,
      );
    }

    return this.deps.taskApprovalSupport.completeTaskApproval(
      ctx,
      existingTask,
      approved,
      nextMetadata,
    );
  }
}
