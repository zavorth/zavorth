import { Context } from 'grammy';
import { Task } from '@zavorth/contracts/TaskContract.js';
import { PermissionRequest, PermissionScope } from '@zavorth/contracts/PermissionRequest.js';
import { PermissionService } from '@zavorth/services/PermissionService.js';
import { TaskSecurityPostureService } from '@zavorth/services/TaskSecurityPostureService.js';
import type { ZavorthBridgePromptStartResult } from '@zavorth/services/ZavorthBridgePromptService.js';
import { TelegramZavorthBridgeController } from '../../../../gateways/channels/telegram/controllers/TelegramZavorthBridgeController.js';
import {
  TelegramZavorthBridgePermissionAutomationService,
  type ZavorthBridgeCompanionBridgeLike,
} from '../../../../gateways/channels/telegram/controllers/TelegramZavorthBridgePermissionAutomationService.js';
import type { TelegramPermissionApprovalPatch } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionDecisionService.js';

export type TelegramZavorthBridgePermissionServiceDeps = {
  permissionService: PermissionService;
  taskSecurityPosture: TaskSecurityPostureService;
  getZavorthBridgeController: () => TelegramZavorthBridgeController;
  persistTask: (task: Task) => void;
  createCompanionBridge?: () => ZavorthBridgeCompanionBridgeLike;
  replyWithPermissionDecision: (
    ctx: Context,
    permission: PermissionRequest,
    action: 'approve' | 'reject' | 'edit',
  ) => Promise<void>;
  advanceTaskState: (task: Task, nextState: Task['status']) => void;
};

export class TelegramZavorthBridgePermissionService {
  private readonly automation: TelegramZavorthBridgePermissionAutomationService;

  constructor(private readonly deps: TelegramZavorthBridgePermissionServiceDeps) {
    this.automation = new TelegramZavorthBridgePermissionAutomationService({
      createCompanionBridge: this.deps.createCompanionBridge,
    });
  }

  public isZavorthBridgeUiPermission(permission: PermissionRequest): boolean {
    return permission.executor === 'zavorthBridge' && permission.kind === 'ui_permission';
  }

  public resolveApprovalCommand(
    value: string | null | undefined,
    scope: PermissionScope | undefined,
  ): string {
    const normalized = String(value || '').trim().toLowerCase();
    if (scope === 'session' || scope === 'workspace' || scope === 'persistent') {
      return 'approve-visible-step-conversation';
    }
    if (normalized === 'approve-visible-step-conversation') {
      return 'approve-visible-step-conversation';
    }
    if (normalized === 'approve-visible-step-once' || normalized === 'approve-visible-step') {
      return 'approve-visible-step-once';
    }
    return this.resolveApprovalMode(normalized, scope) === 'conversation'
      ? 'approve-visible-step-conversation'
      : 'approve-visible-step-once';
  }

  public async prepareApproval(
    permission: PermissionRequest,
    patch: TelegramPermissionApprovalPatch,
    existingTask?: Task,
  ): Promise<void> {
    const zavorthBridgeCommand = this.resolveApprovalCommand(
      patch.resolved_value || permission.resolved_value || permission.requested_value,
      patch.scope || permission.scope,
    );
    const zavorthBridgeMode = this.resolveApprovalMode(zavorthBridgeCommand, patch.scope || permission.scope);
    const automationResult = await this.automation.applyApproval(
      permission,
      existingTask,
      zavorthBridgeMode,
    );

    patch.resolved_value = zavorthBridgeCommand;
    if (!patch.requested_value) {
      patch.requested_value = zavorthBridgeCommand;
    }
    patch.metadata = {
      ...(patch.metadata || {}),
      companion_process_id: automationResult.effectiveProcessId > 0 ? automationResult.effectiveProcessId : null,
    };
    if (automationResult.instanceId) {
      patch.metadata = {
        ...patch.metadata,
        companion_instance_id: automationResult.instanceId,
      };
    }
    if (patch.scope === 'session' || permission.scope === 'session') {
      patch.metadata = {
        ...patch.metadata,
        companion_instance_id: automationResult.instanceId || permission.metadata?.companion_instance_id || null,
      };
    }

    if (existingTask) {
      existingTask.metadata = {
        ...(existingTask.metadata || {}),
        zavorthBridgeCompanionProcessId: automationResult.effectiveProcessId > 0 ? automationResult.effectiveProcessId : null,
        zavorthBridgeCompanionInstanceId:
          automationResult.instanceId ||
          existingTask.metadata?.zavorthBridgeCompanionInstanceId ||
          permission.metadata?.companion_instance_id ||
          null,
      };
    }
  }

  public async finalizeApproval(
    ctx: Context,
    originalPermission: PermissionRequest,
    approvedPermission: PermissionRequest,
    userId: string,
    existingTask?: Task,
  ): Promise<boolean> {
    if (!existingTask) {
      return false;
    }

    await this.rejectSiblingPermissions(
      originalPermission.task_id || existingTask.task_id,
      originalPermission.permission_id,
      `Request replaced by approval ${originalPermission.permission_id}.`,
    );
    existingTask.approval_status = 'approved';
    existingTask.requires_approval = false;
    existingTask.metadata = {
      ...this.deps.taskSecurityPosture.appendPermissionDecision(existingTask.metadata, {
        permission_id: approvedPermission.permission_id,
        action: 'approve',
        actor: userId,
        at: new Date().toISOString(),
        executor: approvedPermission.executor,
        kind: approvedPermission.kind,
        scope: approvedPermission.scope,
        value: approvedPermission.resolved_value || approvedPermission.requested_value || null,
        source: 'telegram_perm_approve',
      }),
      pendingPermissionId: null,
      pendingPermissionNotifiedAt: null,
      pendingPermissionNotificationError: null,
      zavorthBridgePermissionApprovedAt: new Date().toISOString(),
      zavorthBridgePermissionScope: approvedPermission.scope,
      zavorthBridgePermissionValue:
        approvedPermission.resolved_value || approvedPermission.requested_value || null,
    };
    this.deps.persistTask(existingTask);
    if (existingTask.status === 'waiting_approval') {
      this.deps.advanceTaskState(existingTask, 'running');
    }

    const startResult = existingTask.metadata?.zavorthBridgeStartResult as
      | ZavorthBridgePromptStartResult
      | undefined;
    const trackingFile = String(existingTask.metadata?.zavorthBridgeTrackingFile || '').trim();
    await this.deps.replyWithPermissionDecision(ctx, approvedPermission, 'approve');

    if (startResult) {
      await ctx.reply(
        'Permission sent to ZavorthBridge. Resuming response monitoring now.',
      );
      void this.deps.getZavorthBridgeController().finishPrompt(existingTask, startResult);
    } else if (trackingFile) {
      await ctx.reply(
        'Permission sent to ZavorthBridge. I will monitor the real task and notify you when it finishes.',
      );
    } else {
      await ctx.reply(
        'Permission was approved, but I lost the ZavorthBridge prompt state. Resubmit the task if needed.',
      );
    }

    return true;
  }

  public async prepareRejection(
    permission: PermissionRequest,
    existingTask?: Task,
  ): Promise<void> {
    const automationResult = await this.automation.applyRejection(permission, existingTask);

    if (existingTask) {
      existingTask.metadata = {
        ...(existingTask.metadata || {}),
        zavorthBridgeCompanionProcessId: automationResult.effectiveProcessId > 0 ? automationResult.effectiveProcessId : null,
        zavorthBridgeCompanionInstanceId:
          automationResult.instanceId ||
          existingTask.metadata?.zavorthBridgeCompanionInstanceId ||
          permission.metadata?.companion_instance_id ||
          null,
      };
    }
  }

  public async finalizeRejection(
    permission: PermissionRequest,
    rejectedPermission: PermissionRequest,
    userId: string,
    note: string | null,
    existingTask?: Task,
  ): Promise<void> {
    if (permission.task_id) {
      await this.rejectSiblingPermissions(
        permission.task_id,
        permission.permission_id,
        `Request replaced by rejection ${permission.permission_id}.`,
      );
    }

    if (
      existingTask &&
      !['completed', 'failed', 'rejected', 'cancelled', 'reverted'].includes(existingTask.status)
    ) {
      existingTask.requires_approval = false;
      existingTask.approval_status = 'rejected';
      existingTask.error_summary =
        note || `Permission request ${rejectedPermission.permission_id} rejected by the operator.`;
      existingTask.metadata = {
        ...this.deps.taskSecurityPosture.appendPermissionDecision(existingTask.metadata, {
          permission_id: rejectedPermission.permission_id,
          action: 'reject',
          actor: userId,
          at: new Date().toISOString(),
          executor: rejectedPermission.executor,
          kind: rejectedPermission.kind,
          scope: rejectedPermission.scope,
          value: rejectedPermission.resolved_value || rejectedPermission.requested_value || null,
          source: 'telegram_perm_reject',
        }),
        pendingPermissionId: null,
        pendingPermissionNotifiedAt: null,
        pendingPermissionNotificationError: null,
        zavorthBridgePermissionRejectedAt: new Date().toISOString(),
        zavorthBridgePermissionScope: rejectedPermission.scope,
        zavorthBridgePermissionValue:
          rejectedPermission.resolved_value || rejectedPermission.requested_value || null,
      };

      if (existingTask.status === 'waiting_approval') {
        this.deps.persistTask(existingTask);
        this.deps.advanceTaskState(existingTask, 'rejected');
      } else {
        this.deps.persistTask(existingTask);
        this.deps.advanceTaskState(existingTask, 'failed');
      }
    }
  }

  private resolveApprovalMode(
    command: string | null | undefined,
    scope: PermissionScope | undefined,
  ): 'once' | 'conversation' {
    const normalized = String(command || '').trim().toLowerCase();
    if (
      normalized.includes('conversation') ||
      scope === 'session' ||
      scope === 'workspace' ||
      scope === 'persistent'
    ) {
      return 'conversation';
    }
    return 'once';
  }

  private async rejectSiblingPermissions(
    taskId: string,
    keepPermissionId: string,
    note: string,
  ): Promise<void> {
    const pending = await this.deps.permissionService.listRequests('pending', 100);
    const siblings = pending.filter((permission) => {
      return (
        permission.permission_id !== keepPermissionId &&
        permission.task_id === taskId &&
        permission.executor === 'zavorthBridge' &&
        permission.kind === 'ui_permission'
      );
    });

    for (const sibling of siblings) {
      await this.deps.permissionService.rejectRequest(sibling.permission_id, 'system', note);
    }
  }
}
