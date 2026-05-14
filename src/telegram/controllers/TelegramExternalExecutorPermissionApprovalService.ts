import { Context } from 'grammy';
import { config } from '../../config/index.js';
import { PermissionRequest } from '../../contracts/PermissionRequest.js';
import { Task } from '../../contracts/TaskContract.js';
import { TelegramPermissionPolicyService } from './TelegramPermissionPolicyService.js';
import { TelegramTaskExecutorApprovalSupportService } from './TelegramTaskExecutorApprovalSupportService.js';

export type TelegramExternalExecutorPermissionApprovalServiceDeps = {
  permissionPolicy: TelegramPermissionPolicyService;
  taskApprovalSupport: TelegramTaskExecutorApprovalSupportService;
};

export class TelegramExternalExecutorPermissionApprovalService {
  constructor(private readonly deps: TelegramExternalExecutorPermissionApprovalServiceDeps) {}

  public async finalizeApproval(
    ctx: Context,
    permission: PermissionRequest,
    approved: PermissionRequest,
    userId: string,
    existingTask: Task,
  ): Promise<boolean> {
    if (permission.kind === 'agent_binding') {
      return this.finalizeAgentBindingApproval(ctx, approved, userId, existingTask);
    }

    if (permission.kind === 'workspace_access') {
      return this.finalizeWorkspaceAccessApproval(ctx, permission, approved, userId, existingTask);
    }

    return false;
  }

  private async finalizeAgentBindingApproval(
    ctx: Context,
    approved: PermissionRequest,
    userId: string,
    existingTask: Task,
  ): Promise<boolean> {
    const role = this.deps.permissionPolicy.getExternalExecutorAgentRole(approved);
    const resolvedAgentId =
      approved.resolved_value ||
      String(approved.metadata?.suggested_agent_id || config.externalExecutorAgentId || 'main');

    return this.deps.taskApprovalSupport.completeTaskApproval(ctx, existingTask, approved, {
      ...this.deps.taskApprovalSupport.appendApprovalDecision(existingTask, approved, userId),
      external_executor_agent_id: resolvedAgentId,
      external_executor_agent_role: role,
      external_executor_agent_bindings: {
        ...(existingTask.metadata?.external_executor_agent_bindings || {}),
        [role]: resolvedAgentId,
      },
      external_executor_permission_ids: {
        ...(existingTask.metadata?.external_executor_permission_ids || {}),
        [role]: approved.permission_id,
      },
      external_executor_permission_id: approved.permission_id,
      pendingPermissionId: null,
      pendingPermissionNotifiedAt: null,
      pendingPermissionNotificationError: null,
      externalExecutorPermissionApprovedAt: new Date().toISOString(),
    });
  }

  private async finalizeWorkspaceAccessApproval(
    ctx: Context,
    permission: PermissionRequest,
    approved: PermissionRequest,
    userId: string,
    existingTask: Task,
  ): Promise<boolean> {
    const resolvedPath = String(
      approved.resolved_value || approved.requested_value || permission.requested_value || '',
    ).trim();
    const mergedPathPolicies = this.deps.permissionPolicy.mergePathPolicies(
      ...(Array.isArray(existingTask.metadata?.extra_allowed_path_policies)
        ? existingTask.metadata.extra_allowed_path_policies
            .map((policy: any) => this.deps.permissionPolicy.normalizePathPolicy(policy))
            .filter(Boolean)
        : []),
      {
        path: resolvedPath,
        access_level: this.deps.permissionPolicy.getPermissionAccessLevel(approved),
        scope: approved.scope,
        permission_id: approved.permission_id,
      },
    );

    return this.deps.taskApprovalSupport.completeTaskApproval(ctx, existingTask, approved, {
      ...this.deps.taskApprovalSupport.appendApprovalDecision(existingTask, approved, userId),
      extra_allowed_paths: Array.from(
        new Set([
          ...(Array.isArray(existingTask.metadata?.extra_allowed_paths)
            ? existingTask.metadata.extra_allowed_paths.filter(
                (value: unknown): value is string =>
                  typeof value === 'string' && value.trim().length > 0,
              )
            : []),
          resolvedPath,
        ]),
      ),
      extra_allowed_path_policies: mergedPathPolicies,
      external_executor_requested_access_path: resolvedPath,
      external_executor_permission_id: approved.permission_id,
      pendingPermissionId: null,
      pendingPermissionNotifiedAt: null,
      pendingPermissionNotificationError: null,
      externalExecutorPermissionApprovedAt: new Date().toISOString(),
      externalExecutorPermissionScope: approved.scope,
    });
  }
}
