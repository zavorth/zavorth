import { Context } from 'grammy';
import { Task } from '../../contracts/TaskContract.js';
import { PermissionRequest, PermissionScope } from '../../contracts/PermissionRequest.js';
import { TaskManager } from '../../orchestrator/TaskManager.js';
import { PermissionService } from '../../services/PermissionService.js';
import type { WorkflowRunService } from '../../runtime/workflows/WorkflowRunService.js';
import type { ZavorthBridgeCompanionBridge } from '../../agents/ZavorthBridgeCompanionBridge.js';
import { AuditLogger } from '../../monitoring/AuditLogger.js';
import { TaskSecurityPostureService } from '../../services/TaskSecurityPostureService.js';
import { TelegramZavorthBridgePermissionService } from './TelegramZavorthBridgePermissionService.js';
import { TelegramPermissionExecutorApprovalService } from './TelegramPermissionExecutorApprovalService.js';
import { TelegramPermissionDecisionLifecycleService } from './TelegramPermissionDecisionLifecycleService.js';
import { TelegramPermissionPolicyService } from './TelegramPermissionPolicyService.js';
import { TelegramPermissionRejectionService } from './TelegramPermissionRejectionService.js';
import { TelegramZavorthBridgeController } from './TelegramZavorthBridgeController.js';

type ZavorthBridgeCompanionBridgeLike = Pick<ZavorthBridgeCompanionBridge, 'readStatus' | 'isOnline'>;

export type TelegramPermissionApprovalPatch = {
  scope?: PermissionScope;
  workspace?: string | null;
  requested_value?: string | null;
  resolved_value?: string | null;
  reason?: string;
  decision_note?: string | null;
  metadata?: Record<string, any>;
};

export type TelegramPermissionDecisionServiceDeps = {
  permissionService: PermissionService;
  taskManager: TaskManager;
  persistTask: (task: Task) => void;
  getZavorthBridgeController: () => TelegramZavorthBridgeController;
  resumeTaskExecution: (ctx: Context, task: Task) => Promise<void>;
  resumeWorkflowExecution?: (ctx: Context, task: Task) => Promise<boolean>;
  resumeFileDeliveryPermission?: (ctx: Context, permission: PermissionRequest) => Promise<boolean>;
  resumeFileInspectionPermission?: (ctx: Context, permission: PermissionRequest) => Promise<boolean>;
  workflowRunService?: Pick<WorkflowRunService, 'applyStageApprovalDecision'>;
  auditLogger?: AuditLogger;
  createCompanionBridge?: () => ZavorthBridgeCompanionBridgeLike;
  permissionPolicy: TelegramPermissionPolicyService;
  taskSecurityPosture: TaskSecurityPostureService;
  replyWithPermissionDecision: (
    ctx: Context,
    permission: PermissionRequest,
    action: 'approve' | 'reject' | 'edit',
  ) => Promise<void>;
};

export class TelegramPermissionDecisionService {
  private readonly zavorthBridgePermissions: TelegramZavorthBridgePermissionService;
  private readonly decisionLifecycle: TelegramPermissionDecisionLifecycleService;
  private readonly executorApprovals: TelegramPermissionExecutorApprovalService;
  private readonly rejectionOutcomes: TelegramPermissionRejectionService;

  constructor(private readonly deps: TelegramPermissionDecisionServiceDeps) {
    this.zavorthBridgePermissions = new TelegramZavorthBridgePermissionService({
      permissionService: this.deps.permissionService,
      taskSecurityPosture: this.deps.taskSecurityPosture,
      getZavorthBridgeController: this.deps.getZavorthBridgeController,
      persistTask: this.deps.persistTask,
      createCompanionBridge: this.deps.createCompanionBridge,
      replyWithPermissionDecision: this.deps.replyWithPermissionDecision,
      advanceTaskState: (task, nextState) => this.deps.taskManager.advanceState(task, nextState),
    });
    this.decisionLifecycle = new TelegramPermissionDecisionLifecycleService({
      taskManager: this.deps.taskManager,
      resumeTaskExecution: this.deps.resumeTaskExecution,
      resumeWorkflowExecution: this.deps.resumeWorkflowExecution,
      workflowRunService: this.deps.workflowRunService,
      auditLogger: this.deps.auditLogger,
    });
    this.executorApprovals = new TelegramPermissionExecutorApprovalService({
      permissionPolicy: this.deps.permissionPolicy,
      taskSecurityPosture: this.deps.taskSecurityPosture,
      persistTask: this.deps.persistTask,
      replyWithPermissionDecision: this.deps.replyWithPermissionDecision,
      syncWorkflowApprovalDecision: (task, action, summary) =>
        this.decisionLifecycle.syncWorkflowApprovalDecision(task, action, summary),
      resumeApprovedTaskOrWorkflow: (ctx, task) =>
        this.decisionLifecycle.resumeApprovedTaskOrWorkflow(ctx, task),
      resumeFileDeliveryPermission: this.deps.resumeFileDeliveryPermission,
      resumeFileInspectionPermission: this.deps.resumeFileInspectionPermission,
    });
    this.rejectionOutcomes = new TelegramPermissionRejectionService({
      taskSecurityPosture: this.deps.taskSecurityPosture,
      persistTask: this.deps.persistTask,
      advanceTaskState: (task, nextState) => this.deps.taskManager.advanceState(task, nextState),
      syncWorkflowApprovalDecision: (task, action, summary) =>
        this.decisionLifecycle.syncWorkflowApprovalDecision(task, action, summary),
    });
  }

  public resolveZavorthBridgeApprovalCommand(
    value: string | null | undefined,
    scope: PermissionScope | undefined,
  ): string {
    return this.zavorthBridgePermissions.resolveApprovalCommand(value, scope);
  }

  public async applyPermissionApproval(
    ctx: Context,
    permission: PermissionRequest,
    patch: TelegramPermissionApprovalPatch,
    userId: string,
  ): Promise<void> {
    const existingTask = permission.task_id ? this.deps.taskManager.getTask(permission.task_id) : undefined;
    const isZavorthBridgePermission = this.zavorthBridgePermissions.isZavorthBridgeUiPermission(permission);

    if (isZavorthBridgePermission) {
      await this.zavorthBridgePermissions.prepareApproval(permission, patch, existingTask);
    }

    this.executorApprovals.prepareApprovalPatch(permission, patch);

    const approved = await this.deps.permissionService.approveRequest(
      permission.permission_id,
      userId,
      patch,
    );
    await this.decisionLifecycle.recordPermissionDecisionAudit(approved, 'approve', userId, {
      patch,
    });

    const handledExecutorApproval = await this.executorApprovals.finalizeApproval(
      ctx,
      permission,
      approved,
      userId,
      existingTask,
    );
    if (handledExecutorApproval) {
      return;
    }

    if (isZavorthBridgePermission) {
      const handled = await this.zavorthBridgePermissions.finalizeApproval(
        ctx,
        permission,
        approved,
        userId,
        existingTask,
      );
      if (handled) {
        return;
      }
    }

    await this.deps.replyWithPermissionDecision(ctx, approved, 'approve');
  }

  public async applyPermissionRejection(
    ctx: Context,
    permission: PermissionRequest,
    userId: string,
    note: string | null,
  ): Promise<void> {
    const existingTask = permission.task_id ? this.deps.taskManager.getTask(permission.task_id) : undefined;
    const isZavorthBridgePermission = this.zavorthBridgePermissions.isZavorthBridgeUiPermission(permission);

    if (isZavorthBridgePermission) {
      await this.zavorthBridgePermissions.prepareRejection(permission, existingTask);
    }

    const rejected = await this.deps.permissionService.rejectRequest(
      permission.permission_id,
      userId,
      note,
    );
    await this.decisionLifecycle.recordPermissionDecisionAudit(rejected, 'reject', userId, {
      note,
    });
    if (isZavorthBridgePermission) {
      await this.zavorthBridgePermissions.finalizeRejection(
        permission,
        rejected,
        userId,
        note,
        existingTask,
      );
    }

    this.rejectionOutcomes.finalizeRejection(
      permission,
      rejected,
      userId,
      note,
      existingTask,
      isZavorthBridgePermission,
    );

    await this.deps.replyWithPermissionDecision(ctx, rejected, 'reject');
  }
}
