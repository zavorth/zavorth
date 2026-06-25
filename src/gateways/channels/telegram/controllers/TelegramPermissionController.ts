import { Context, InlineKeyboard } from 'grammy';
import { TaskManager } from '../../../../orchestrator/TaskManager.js';
import { Task } from '../../../../contracts/TaskContract.js';
import {
  PermissionRequest,
  PermissionStatus,
} from '../../../../contracts/PermissionRequest.js';
import { PermissionService } from '../../../../services/PermissionService.js';
import type { ZavorthBridgeCompanionBridge } from '../../../../agents/ZavorthBridgeCompanionBridge.js';
import { HostIdentityService } from '../../../../services/HostIdentityService.js';
import { TelemetryRuntimeService } from '../../../../observability/telemetry/TelemetryRuntimeService.js';
import { AuditLogger } from '../../../../monitoring/AuditLogger.js';
import { TaskSecurityPostureService } from '../../../../services/TaskSecurityPostureService.js';
import type { WorkflowRunService } from '../../../../runtime/workflows/WorkflowRunService.js';
import { TelegramZavorthBridgeController } from '../../../../gateways/channels/telegram/controllers/TelegramZavorthBridgeController.js';
import {
  TelegramPermissionDecisionService,
} from '../../../../gateways/channels/telegram/controllers/TelegramPermissionDecisionService.js';
import { TelegramPermissionCommandService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionCommandService.js';
import { TelegramPermissionInteractionService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionInteractionService.js';
import { TelegramPermissionPolicyService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionPolicyService.js';
import { TelegramPermissionPresentationService } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionPresentationService.js';
import { TelegramPersistedPermissionPolicyService } from '../../../../gateways/channels/telegram/controllers/TelegramPersistedPermissionPolicyService.js';
import { TelegramTaskApprovalService } from '../../../../gateways/channels/telegram/controllers/TelegramTaskApprovalService.js';
import { replyWithTelegramSurfaceResponse } from '../../../../gateways/channels/telegram/TelegramSurfaceResponseSender.js';

type ZavorthBridgeCompanionBridgeLike = Pick<ZavorthBridgeCompanionBridge, 'readStatus' | 'isOnline'>;

export type TelegramPermissionControllerDeps = {
  permissionService: PermissionService;
  taskManager: TaskManager;
  persistTask: (task: Task) => void;
  getZavorthBridgeController: () => TelegramZavorthBridgeController;
  resumeTaskExecution: (ctx: Context, task: Task) => Promise<void>;
  resumeWorkflowExecution?: (ctx: Context, task: Task) => Promise<boolean>;
  resumeFileDeliveryPermission?: (ctx: Context, permission: PermissionRequest) => Promise<boolean>;
  resumeFileInspectionPermission?: (ctx: Context, permission: PermissionRequest) => Promise<boolean>;
  workflowRunService?: Pick<WorkflowRunService, 'applyStageApprovalDecision'>;
  hostIdentityService?: HostIdentityService;
  telemetryRuntime?: TelemetryRuntimeService;
  auditLogger?: AuditLogger;
  createCompanionBridge?: () => ZavorthBridgeCompanionBridgeLike;
};

export class TelegramPermissionController {
  private taskSecurityPosture = new TaskSecurityPostureService();
  private readonly permissionDecision: TelegramPermissionDecisionService;
  private readonly permissionPolicy = new TelegramPermissionPolicyService();
  private readonly permissionPresentation: TelegramPermissionPresentationService;
  private readonly persistedPolicies: TelegramPersistedPermissionPolicyService;
  private readonly taskApproval: TelegramTaskApprovalService;
  private readonly permissionCommands: TelegramPermissionCommandService;
  private readonly permissionInteraction: TelegramPermissionInteractionService;

  constructor(private deps: TelegramPermissionControllerDeps) {
    this.permissionPresentation = new TelegramPermissionPresentationService(this.permissionPolicy);
    this.persistedPolicies = new TelegramPersistedPermissionPolicyService({
      permissionService: this.deps.permissionService,
      permissionPolicy: this.permissionPolicy,
      persistTask: this.deps.persistTask,
    });
    this.taskApproval = new TelegramTaskApprovalService({
      taskManager: this.deps.taskManager,
      persistTask: this.deps.persistTask,
      resumeTaskExecution: this.deps.resumeTaskExecution,
      resumeWorkflowExecution: this.deps.resumeWorkflowExecution,
      workflowRunService: this.deps.workflowRunService,
      telemetryRuntime: this.deps.telemetryRuntime,
      auditLogger: this.deps.auditLogger,
      taskSecurityPosture: this.taskSecurityPosture,
    });
    this.permissionDecision = new TelegramPermissionDecisionService({
      permissionService: this.deps.permissionService,
      taskManager: this.deps.taskManager,
      persistTask: this.deps.persistTask,
      getZavorthBridgeController: this.deps.getZavorthBridgeController,
      resumeTaskExecution: this.deps.resumeTaskExecution,
      resumeWorkflowExecution: this.deps.resumeWorkflowExecution,
      resumeFileDeliveryPermission: this.deps.resumeFileDeliveryPermission,
      resumeFileInspectionPermission: this.deps.resumeFileInspectionPermission,
      workflowRunService: this.deps.workflowRunService,
      auditLogger: this.deps.auditLogger,
      createCompanionBridge: this.deps.createCompanionBridge,
      permissionPolicy: this.permissionPolicy,
      taskSecurityPosture: this.taskSecurityPosture,
      replyWithPermissionDecision: (ctx, permission, action) =>
        this.replyWithPermissionDecision(ctx, permission, action),
    });
    this.permissionCommands = new TelegramPermissionCommandService({
      permissionService: this.deps.permissionService,
      permissionPolicy: this.permissionPolicy,
      permissionPresentation: this.permissionPresentation,
      permissionDecision: this.permissionDecision,
      assertHostWritable: () => this.assertHostWritable(),
    });
    this.permissionInteraction = new TelegramPermissionInteractionService({
      permissionDecision: this.permissionDecision,
      permissionPolicy: this.permissionPolicy,
      resolvePermissionReference: (ref) => this.resolvePermissionReference(ref),
      shortPermissionId: (permission) => this.shortPermissionId(permission),
      assertHostWritable: () => this.assertHostWritable(),
    });
  }

  public async handlePermissionAllowCommand(ctx: Context, args: string): Promise<void> {
    await this.permissionCommands.handlePermissionAllowCommand(ctx, args);
  }

  public async handlePermissionRevokeCommand(ctx: Context, args: string): Promise<void> {
    await this.permissionCommands.handlePermissionRevokeCommand(ctx, args);
  }

  public async handleApproval(ctx: Context, args: string): Promise<void> {
    this.assertHostWritable();
    await this.taskApproval.handleApproval(ctx, args);
  }

  public async handleRejection(ctx: Context, taskId: string): Promise<void> {
    this.assertHostWritable();
    await this.taskApproval.handleRejection(ctx, taskId);
  }

  public async handlePermissionCommand(ctx: Context, args: string): Promise<void> {
    await this.permissionCommands.handlePermissionCommand(ctx, args);
  }

  public async handlePermissionCallback(ctx: Context, data: string): Promise<void> {
    await this.permissionInteraction.handlePermissionCallback(ctx, data);
  }

  public buildPermissionKeyboard(permission: PermissionRequest): InlineKeyboard {
    return this.permissionInteraction.buildPermissionKeyboard(permission);
  }

  public async applyPersistedPermissionPolicies(task: Task, executor: string): Promise<void> {
    await this.persistedPolicies.applyPersistedPermissionPolicies(task, executor);
  }

  public formatPermissionList(
    permissions: PermissionRequest[],
    status: PermissionStatus | 'all',
  ): string {
    return this.permissionPresentation.formatPermissionList(permissions, status);
  }

  private formatPermissionDetails(permission: PermissionRequest): string {
    return this.permissionPresentation.formatPermissionDetails(permission);
  }

  public formatPermissionDecisionMessage(permission: PermissionRequest, action: 'approve' | 'reject' | 'edit'): string {
    return this.permissionPresentation.formatPermissionDecisionMessage(permission, action);
  }

  public formatPermissionCreatedMessage(permission: PermissionRequest): string {
    return this.permissionPresentation.formatPermissionCreatedMessage(permission);
  }

  private async replyWithPermissionDecision(
    ctx: Context,
    permission: PermissionRequest,
    action: 'approve' | 'reject' | 'edit',
  ): Promise<void> {
    await replyWithTelegramSurfaceResponse(
      ctx,
      this.permissionPresentation.buildPermissionDecisionSurfaceResponse(permission, action),
    );
  }

  public async resolvePermissionReference(ref: string): Promise<PermissionRequest> {
    return this.permissionCommands.resolvePermissionReference(ref);
  }

  public shortPermissionId(permission: PermissionRequest): string {
    return this.permissionPolicy.shortPermissionId(permission);
  }

  private assertHostWritable(): void {
    const status = this.deps.hostIdentityService?.getStatus();
    if (status && !status.authorized) {
      throw new Error('Host novo detectado. O Zavorth esta em modo somente leitura ate /hostauth trust.');
    }
  }
}
