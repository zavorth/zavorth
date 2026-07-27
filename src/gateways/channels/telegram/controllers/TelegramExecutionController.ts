import { Context, InlineKeyboard } from 'grammy';
import { config } from '../../../../config/index.js';
import { Task } from '../../../../contracts/TaskContract.js';
import { PermissionRequest } from '../../../../contracts/PermissionRequest.js';
import { TaskManager } from '../../../../orchestrator/TaskManager.js';
import { LogRepository } from '../../../../storage/LogRepository.js';
import { ExecutionGateway } from '../../../../execution/ExecutionGateway.js';
import { AuditLogger } from '../../../../monitoring/AuditLogger.js';
import { PermissionService } from '../../../../services/PermissionService.js';
import { SmartOutputService } from '../../../../services/SmartOutputService.js';
import { PresentationModeService } from '../../../../services/PresentationModeService.js';
import { TelegramExecutionDirectService } from '../../../../gateways/channels/telegram/controllers/TelegramExecutionDirectService.js';
import type { ToolRuntimeService } from '../../../../services/tools/ToolRuntimeService.js';
import { TelegramExecutionArtifactDeliveryService } from '../../../../gateways/channels/telegram/controllers/TelegramExecutionArtifactDeliveryService.js';
import { TelegramExecutionGatewayPlanService } from '../../../../gateways/channels/telegram/controllers/TelegramExecutionGatewayPlanService.js';
import { TelegramExecutionGatewaySubmissionService } from '../../../../gateways/channels/telegram/controllers/TelegramExecutionGatewaySubmissionService.js';
import { TelegramExecutionLifecycleService } from '../../../../gateways/channels/telegram/controllers/TelegramExecutionLifecycleService.js';
import { TelegramExecutionPlannedTaskService } from '../../../../gateways/channels/telegram/controllers/TelegramExecutionPlannedTaskService.js';
import { TelegramExecutionPlanningService } from '../../../../gateways/channels/telegram/controllers/TelegramExecutionPlanningService.js';
import { TelegramExecutionResearchService } from '../../../../gateways/channels/telegram/controllers/TelegramExecutionResearchService.js';
import { TelegramExecutionResultService } from '../../../../gateways/channels/telegram/controllers/TelegramExecutionResultService.js';
import { isExternalCommand } from '../../../../gateways/channels/telegram/ExternalExecutorIdentity.js';
import { asErrorLike } from '../../../../utils/errorLike.js';

type PersistedPolicyApplier = (task: Task, executor: string) => Promise<void>;
type PermissionKeyboardBuilder = (permission: PermissionRequest) => InlineKeyboard;
type PermissionMessageFormatter = (permission: PermissionRequest) => string;
type ExternalExecutorPermissionFactory = (task: Task, result: unknown) => Promise<PermissionRequest>;
type AiStudioPermissionFactory = (task: Task, result: unknown) => Promise<PermissionRequest>;
type PersistTaskFn = (task: Task) => void;
type ToolRuntimeLike = Pick<ToolRuntimeService, 'executeTool'>;

export type TelegramExecutionControllerDeps = {
  taskManager: TaskManager;
  logRepo: LogRepository;
  executionGateway: ExecutionGateway;
  auditLogger: AuditLogger;
  permissionService: PermissionService;
  persistTask: PersistTaskFn;
  applyPersistedPermissionPolicies: PersistedPolicyApplier;
  buildPermissionKeyboard: PermissionKeyboardBuilder;
  formatPermissionCreatedMessage: PermissionMessageFormatter;
  createExternalExecutorPermissionRequest: ExternalExecutorPermissionFactory;
  createAiStudioPermissionRequest: AiStudioPermissionFactory;
  presentationModeService: PresentationModeService;
};

export class TelegramExecutionController {
  private readonly artifactDelivery: TelegramExecutionArtifactDeliveryService;
  private readonly directExecutionService: TelegramExecutionDirectService;
  private readonly gatewayPlanService = new TelegramExecutionGatewayPlanService();
  private readonly gatewaySubmissionService: TelegramExecutionGatewaySubmissionService;
  private readonly lifecycleService: TelegramExecutionLifecycleService;
  private readonly plannedTaskExecution: TelegramExecutionPlannedTaskService;
  private readonly planningService: TelegramExecutionPlanningService;
  private readonly researchService: TelegramExecutionResearchService;
  private readonly resultService: TelegramExecutionResultService;

  constructor(private deps: TelegramExecutionControllerDeps, private toolRuntime?: ToolRuntimeLike) {
    this.artifactDelivery = new TelegramExecutionArtifactDeliveryService({
      persistTask: this.deps.persistTask,
    });
    this.directExecutionService = new TelegramExecutionDirectService({
      auditLogger: this.deps.auditLogger,
      storeExecutionResult: (task, result) => this.storeExecutionResult(task, result),
      formatExecutionOutput: (label, workspace, result) =>
        this.formatExecutionOutput(label, workspace, result),
    });
    this.resultService = new TelegramExecutionResultService({
      logRepo: this.deps.logRepo,
      persistTask: this.deps.persistTask,
      presentationModeService: this.deps.presentationModeService,
    });
    this.gatewaySubmissionService = new TelegramExecutionGatewaySubmissionService({
      executionGateway: this.deps.executionGateway,
      permissionService: this.deps.permissionService,
      taskManager: this.deps.taskManager,
      persistTask: this.deps.persistTask,
      applyPersistedPermissionPolicies: this.deps.applyPersistedPermissionPolicies,
      formatPermissionCreatedMessage: this.deps.formatPermissionCreatedMessage,
      createExternalExecutorPermissionRequest: this.deps.createExternalExecutorPermissionRequest,
      createAiStudioPermissionRequest: this.deps.createAiStudioPermissionRequest,
      storeExecutionResult: (task, result) => this.storeExecutionResult(task, result),
      formatExecutionOutput: (label, workspace, result) =>
        this.formatExecutionOutput(label, workspace, result),
      executePlannedTask: (task) => this.executePlannedTask(task),
      gatewayPlanService: this.gatewayPlanService,
    });
    this.lifecycleService = new TelegramExecutionLifecycleService({
      taskManager: this.deps.taskManager,
      auditLogger: this.deps.auditLogger,
      executionGateway: this.deps.executionGateway,
      logRepo: this.deps.logRepo,
      permissionService: this.deps.permissionService,
      persistTask: this.deps.persistTask,
      buildPermissionKeyboard: this.deps.buildPermissionKeyboard,
      executeTask: (task, isDryRun) => this.executeTask(task, isDryRun),
      captureExecutionEnvelope: (task, userFacingText, success) =>
        this.captureExecutionEnvelope(task, userFacingText, success),
      sendTaskArtifacts: (ctx, task) => this.sendTaskArtifacts(ctx, task),
    });
    this.plannedTaskExecution = new TelegramExecutionPlannedTaskService({
      executionGateway: this.deps.executionGateway,
      auditLogger: this.deps.auditLogger,
      toolRuntime: this.toolRuntime,
      storeExecutionResult: (task, result) => this.storeExecutionResult(task, result),
      formatExecutionOutput: (label, workspace, result) =>
        this.formatExecutionOutput(label, workspace, result),
    });
    this.planningService = new TelegramExecutionPlanningService({
      taskManager: this.deps.taskManager,
      logRepo: this.deps.logRepo,
      executionGateway: this.deps.executionGateway,
      auditLogger: this.deps.auditLogger,
      persistTask: this.deps.persistTask,
      presentationModeService: this.deps.presentationModeService,
    });
    this.researchService = new TelegramExecutionResearchService({
      logRepo: this.deps.logRepo,
      persistTask: this.deps.persistTask,
    });
  }

  public async handlePlan(ctx: Context, task: Task): Promise<void> {
    await this.planningService.handlePlan(ctx, task);
  }

  public async resumeTaskExecution(ctx: Context, task: Task): Promise<void> {
    await this.lifecycleService.resumeTaskExecution(ctx, task);
  }

  public async executeImmediate(ctx: Context, task: Task, isDryRun: boolean): Promise<void> {
    await this.lifecycleService.executeImmediate(ctx, task, isDryRun);
  }

  public async handleUndo(ctx: Context, taskId: string): Promise<void> {
    // Same admin policy as task:undo callbacks / /approve (AuthGuard + explicit role check).
    try {
      const userId = ctx.from?.id?.toString();
      if (!userId) {
        throw new Error('Invalid user ID.');
      }
      const userRoles = config.telegramUserRoles?.[userId] || ['admin'];
      if (!userRoles.includes('admin')) {
        throw new Error('Only administrators can undo tasks.');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await SmartOutputService.reply(ctx, message);
      return;
    }

    const RollbackManager = require('../../execution/RollbackManager.js').RollbackManager;
    const rollbackManager = new RollbackManager(this.deps.taskManager);

    try {
      const restored = await rollbackManager.rollback(taskId, config.defaultWorkspace);
      await SmartOutputService.reply(
        ctx,
        `Done. I attempted to undo task ${taskId}.\n\nRestored items:\n${restored.join('\n')}`,
      );
    } catch (error: unknown) {
      const err = asErrorLike(error);
      const message = error instanceof Error ? err.message : String(error);
      await SmartOutputService.reply(ctx, `I could not undo this task right now.\n\nReason: ${message}`);
    }
  }

  private async executeTask(task: Task, isDryRun: boolean): Promise<{ output: string; success: boolean }> {
    const policyEngine = this.deps.executionGateway.getPolicyEngine();
    const modeManager = this.deps.executionGateway.getModeManager();
    const autoRoutedExecutor = String(task.metadata?.auto_route_executor || '').trim().toLowerCase();
    const routedExecutor = this.gatewayPlanService.resolveGatewayExecutorName(
      String(task.executor_used || task.metadata?.route_executor_preference || '').trim(),
    );

    if (task.command_type === '/ag' || task.command_type === '/bridge') {
      return this.directExecutionService.executeZavorthBridge(task, this.extractTaskPayload(task));
    }

    if (
      (task.command_type === '/task' || task.command_type === '/auto') &&
      autoRoutedExecutor === 'zavorthBridge'
    ) {
      return this.directExecutionService.executeZavorthBridge(task, this.extractTaskPayload(task));
    }

    if (
      (task.command_type === '/task' || task.command_type === '/auto') &&
      autoRoutedExecutor === 'web_research'
    ) {
      return this.executeStructuredWebResearch(task);
    }

    if (
      task.command_type !== '/task' &&
      task.command_type !== '/auto' &&
      task.command_type !== '/ag' &&
      task.command_type !== '/bridge' &&
      task.command_type !== '/run' &&
      task.command_type !== '/dryrun' &&
      routedExecutor !== 'local'
    ) {
      return this.executeViaGateway(task, isDryRun);
    }

    if (
      task.command_type === '/codex' ||
      isExternalCommand(task.command_type) ||
      task.command_type === '/gemini' ||
      task.command_type === '/aistudio' ||
      task.command_type === '/stitch' ||
      task.command_type === '/jules' ||
      ((task.command_type === '/task' || task.command_type === '/auto') && Boolean(task.metadata?.auto_route_executor)) ||
      task.command_type === '/run' ||
      task.command_type === '/dryrun'
    ) {
      return this.executeViaGateway(task, isDryRun);
    }

    if (task.metadata?.gateway_plan) {
      return this.executeStoredGatewayPlan(task, isDryRun);
    }

    if (task.command_type === '/codex') {
      return this.directExecutionService.executeCodexDirect(task, this.extractTaskPayload(task), modeManager);
    }

    if (isExternalCommand(task.command_type)) {
      return this.directExecutionService.executeExternalExecutorDirect(
        task,
        this.extractTaskPayload(task),
        isDryRun,
        modeManager,
      );
    }

    if (task.actions_planned && task.actions_planned.length > 0) {
      return this.executePlannedTask(task);
    }

    const command = this.extractTaskPayload(task);
    const workspace = task.workspace || 'core';

    return this.directExecutionService.executeLocalShell(
      task,
      command,
      workspace,
      isDryRun,
      modeManager,
      policyEngine,
    );
  }

  private async executeViaGateway(task: Task, isDryRun: boolean): Promise<{ output: string; success: boolean }> {
    return this.gatewaySubmissionService.executeViaGateway(task, isDryRun, this.extractTaskPayload(task));
  }

  private async executeStoredGatewayPlan(task: Task, isDryRun: boolean): Promise<{ output: string; success: boolean }> {
    return this.gatewaySubmissionService.executeStoredGatewayPlan(task, isDryRun);
  }

  private async executeStructuredWebResearch(task: Task): Promise<{ output: string; success: boolean }> {
    const query = String(this.extractTaskPayload(task) || task.normalized_message || task.raw_message || '').trim();
    return this.researchService.executeStructuredWebResearch(task, query);
  }

  private async executePlannedTask(task: Task): Promise<{ output: string; success: boolean }> {
    return this.plannedTaskExecution.executePlannedTask(task);
  }

  private formatExecutionOutput(label: string, workspace: string, result: unknown): string {
    return this.resultService.formatExecutionOutput(label, workspace, result);
  }

  private captureExecutionEnvelope(task: Task, userFacingText: string, success: boolean): void {
    this.resultService.captureExecutionEnvelope(task, userFacingText, success);
  }

  private async sendTaskArtifacts(ctx: Context, task: Task): Promise<void> {
    await this.artifactDelivery.sendTaskArtifacts(ctx, task);
  }

  private extractTaskPayload(task: Task): string {
    const raw = task.raw_message.trim();

    if (!raw.startsWith('/')) {
      return raw;
    }

    const prefix = `${task.command_type} `;
    if (raw === task.command_type) {
      return '';
    }

    if (raw.startsWith(prefix)) {
      return raw.slice(prefix.length).trim();
    }

    return raw.replace(task.command_type, '').trim();
  }

  private storeExecutionResult(task: Task, result: unknown): void {
    this.resultService.storeExecutionResult(task, result);
  }
}
