import { Context } from 'grammy';
import { ParsedCommand } from '../CommandParser.js';
import { Task } from '../../contracts/TaskContract.js';
import { RouteIntent } from '../../orchestrator/IntentRouter.js';
import { RiskClassification } from '../../orchestrator/RiskClassifier.js';
import { StateMachine } from '../../orchestrator/StateMachine.js';
import type { OperatorModeService } from '../../services/OperatorModeService.js';
import type { PresentationModeService } from '../../services/PresentationModeService.js';
import { TaskResponseEnvelopeService } from '../../services/TaskResponseEnvelopeService.js';
import { UserFacingResponseService } from '../../services/UserFacingResponseService.js';
import { WorkspaceProfileService } from '../../services/WorkspaceProfileService.js';
import { WorkspaceOperationalMemoryService } from '../../runtime/context/WorkspaceOperationalMemoryService.js';
import type { WorkspaceRoutingAdvice } from '../../runtime/context/WorkspaceRoutingAdvisor.js';
import type {
  WorkflowRunCreateOptions,
  WorkflowWorkspaceContext,
} from '../../runtime/workflows/WorkflowRunService.js';
import type { TrustClassification } from '../../security/TrustedBoundary.js';
import { TelegramTaskApprovalGateService } from './TelegramTaskApprovalGateService.js';
import { TelegramTaskAutoRouteService } from './TelegramTaskAutoRouteService.js';
import { TelegramTaskDispatchService } from './TelegramTaskDispatchService.js';
import {
  TelegramTaskPreparationService,
  type TelegramTaskPreparationInput,
} from './TelegramTaskPreparationService.js';
import { TelegramTaskSurfaceSecurityService } from './TelegramTaskSurfaceSecurityService.js';
import { TelegramTaskWorkflowRoutingService } from './TelegramTaskWorkflowRoutingService.js';
import { buildTaskEventSurfaceResponse } from '../../domain/surface/application/surface-response/index.js';
import { replyWithTelegramSurfaceResponse } from '../TelegramSurfaceResponseSender.js';

type AttachRecentContextFn = (task: Task) => Promise<void>;
type RouteIntentFn = (parsed: ParsedCommand) => RouteIntent;
type RiskClassifierFn = (parsed: ParsedCommand, route: RouteIntent) => RiskClassification;
type TrustClassifierFn = (text: string, input: TelegramTaskPreparationInput) => TrustClassification;
type PersistTaskFn = (task: Task) => void;
type DefaultWorkspaceResolver = (commandType: string) => string;
type PayloadExtractor = (task: Task) => string;

type ExecutionControllerLike = {
  handlePlan(ctx: Context, task: Task): Promise<void>;
  executeImmediate(ctx: Context, task: Task, isDryRun: boolean): Promise<void>;
};

type ZavorthBridgeControllerLike = {
  handleTaskExecution(ctx: Context, task: Task, payload: string): Promise<void>;
};

type NaturalConversationIngressLike = (
  ctx: Context,
  task: Task,
  messageText: string,
  inlineData?: Array<{ mimeType: string; data: string }>,
) => Promise<void>;

type VideoHandlerLike = {
  containsSupportedVideoUrl(text: string): boolean;
  prepareFromText(
    text: string,
  ): Promise<{ messageText: string; inlineData?: Array<{ mimeType: string; data: string }> } | null>;
};

type WorkflowControllerLike = {
  handleNamedWorkflow(
    ctx: Context,
    workflow: string,
    objective: string,
    workspace?: string,
    workspaceContext?: WorkflowWorkspaceContext | null,
    launchOptions?: WorkflowRunCreateOptions,
  ): Promise<void>;
};

export type TelegramTaskOrchestrationControllerDeps = {
  taskManager: any;
  logRepo: any;
  auditLogger: any;
  attachRecentContext: AttachRecentContextFn;
  routeIntent: RouteIntentFn;
  classifyRisk: RiskClassifierFn;
  classifyTrust: TrustClassifierFn;
  persistTask: PersistTaskFn;
  getDefaultWorkspace: DefaultWorkspaceResolver;
  extractTaskPayload: PayloadExtractor;
  operatorModeService: OperatorModeService;
  presentationModeService: PresentationModeService;
  workspaceProfileService: WorkspaceProfileService;
  workspaceOperationalMemoryService: WorkspaceOperationalMemoryService;
  executionController: ExecutionControllerLike;
  zavorthBridgeController: ZavorthBridgeControllerLike;
  naturalConversationIngress: NaturalConversationIngressLike;
  videoHandler: VideoHandlerLike;
  workflowController: WorkflowControllerLike;
};

export class TelegramTaskOrchestrationController {
  private readonly approvalGateService: TelegramTaskApprovalGateService;
  private readonly autoRouteService: TelegramTaskAutoRouteService;
  private readonly dispatchService: TelegramTaskDispatchService;
  private readonly preparationService: TelegramTaskPreparationService;
  private readonly surfaceSecurityService: TelegramTaskSurfaceSecurityService;
  private readonly workflowRoutingService: TelegramTaskWorkflowRoutingService;

  constructor(private deps: TelegramTaskOrchestrationControllerDeps) {
    this.approvalGateService = new TelegramTaskApprovalGateService({
      logRepo: this.deps.logRepo,
      operatorModeService: this.deps.operatorModeService,
      persistTask: this.deps.persistTask,
      presentationModeService: this.deps.presentationModeService,
      taskManager: this.deps.taskManager,
    });
    this.surfaceSecurityService = new TelegramTaskSurfaceSecurityService();
    this.workflowRoutingService = new TelegramTaskWorkflowRoutingService();
    this.preparationService = new TelegramTaskPreparationService({
      getDefaultWorkspace: this.deps.getDefaultWorkspace,
      workspaceProfileService: this.deps.workspaceProfileService,
      workspaceOperationalMemoryService: this.deps.workspaceOperationalMemoryService,
      requiresHighRiskPin: (task) => this.approvalGateService.requiresHighRiskPin(task),
      resolveWorkspaceLearnedRoute: (parsed, route, advice) =>
        this.workflowRoutingService.resolveWorkspaceLearnedRoute(parsed, route, advice),
      buildWorkspaceRouteOutcome: (task, route, advice, learnedRoute) =>
        this.workflowRoutingService.buildWorkspaceRouteOutcome(task, route, advice, learnedRoute),
    });
    this.autoRouteService = new TelegramTaskAutoRouteService({
      zavorthBridgeController: this.deps.zavorthBridgeController,
      naturalConversationIngress: this.deps.naturalConversationIngress,
      executionController: this.deps.executionController,
      videoHandler: this.deps.videoHandler,
      workflowController: this.deps.workflowController,
      persistTask: this.deps.persistTask,
      maybeHoldForApproval: (ctx, task, classification, executorLabel, routingReason, forceApproval = false) =>
        this.approvalGateService.maybeHoldForApproval(ctx, task, classification, executorLabel, routingReason, forceApproval),
      describeExecutor: (executor) => this.describeExecutor(executor),
      buildWorkflowLaunchOptions: (task) => this.workflowRoutingService.buildWorkflowLaunchOptions(task),
      buildWorkspaceRouteOutcome: (task, route, advice, learnedRoute) =>
        this.workflowRoutingService.buildWorkspaceRouteOutcome(task, route, advice, learnedRoute),
    });
    this.dispatchService = new TelegramTaskDispatchService({
      executionController: this.deps.executionController,
      zavorthBridgeController: this.deps.zavorthBridgeController,
      workflowController: this.deps.workflowController,
      autoRouteService: this.autoRouteService,
      maybeHoldForApproval: (ctx, task, classification, executorLabel, routingReason, forceApproval = false) =>
        this.approvalGateService.maybeHoldForApproval(ctx, task, classification, executorLabel, routingReason, forceApproval),
      describeExecutor: (executor) => this.describeExecutor(executor),
      extractTaskPayload: (task) => this.deps.extractTaskPayload(task),
      buildWorkflowLaunchOptions: (task) => this.workflowRoutingService.buildWorkflowLaunchOptions(task),
    });
  }

  public async handleTaskMessage(ctx: Context, input: TelegramTaskPreparationInput): Promise<Task> {
    const { chatId, userId, text, parsed } = input;
    const task = this.deps.taskManager.createPendingTask(
      chatId,
      userId,
      text,
      parsed.normalized_message,
      parsed.command_type,
      input.source || 'telegram',
      this.preparationService.buildSurfaceMetadata(input),
    );

    try {
      this.deps.taskManager.advanceState(task, 'parsed');
      this.deps.auditLogger.logInput(task.task_id, userId, text, parsed.command_type).catch(() => {});

      const trustClassification = this.deps.classifyTrust(text, input);
      if (!trustClassification.can_generate_execution) {
        this.deps.auditLogger
          .logSecurityBlock(task.task_id, `Trusted Boundary: ${trustClassification.reason}`)
          .catch(() => {});
        this.deps.logRepo.log(
          'warn',
          'TrustedBoundary',
          `Input bloqueado para execucao: ${trustClassification.reason}`,
        );
        task.error_summary = trustClassification.reason;
        const userFacingText = `Preferi bloquear esse pedido por seguranca.\n\nMotivo: ${trustClassification.reason}`;
        TaskResponseEnvelopeService.capture(
          task,
          'security_block',
          userFacingText,
          TaskResponseEnvelopeService.buildSecurityBlock(task, trustClassification.reason),
        );
        this.deps.persistTask(task);
        this.deps.taskManager.advanceState(task, 'failed');
        this.deps.logRepo.log('warn', 'ResponseEnvelope', TaskResponseEnvelopeService.buildSecurityBlock(task, trustClassification.reason), {
          taskId: task.task_id,
          kind: 'security_block',
        });
        await this.replyTaskEvent(ctx, task, {
          event: 'security_block',
          title: 'Pedido bloqueado por seguranca',
          summary: trustClassification.reason,
          text: userFacingText,
          status: 'blocked',
          reason: trustClassification.reason,
          riskBlocked: true,
        });
        return task;
      }

      await this.deps.attachRecentContext(task);

      const route = this.deps.routeIntent(parsed);
      const initialClassification = this.deps.classifyRisk(parsed, route);
      const surfaceSecurity = this.surfaceSecurityService.inspect(input, text);
      const {
        classification,
        workspaceRoutingAdvice,
        learnedRoute,
        surfaceForceApproval,
      } = await this.preparationService.prepareTaskState({
        task,
        input,
        parsed,
        route,
        userId,
        classification: initialClassification,
        surfaceSecurity,
      });
      this.deps.persistTask(task);

      const workflowWorkspaceContext = this.workflowRoutingService.buildWorkflowWorkspaceContext(task);
      await this.dispatchService.dispatchTaskMessage({
        ctx,
        task,
        text,
        inlineData: input.inlineData,
        parsed,
        route,
        classification,
        learnedRoute,
        workflowWorkspaceContext,
        workspaceRoutingAdvice,
        surfaceForceApproval,
      });
      return task;
    } catch (error: any) {
      this.deps.logRepo.log('error', 'BotGateway', `Erro ao processar tarefa: ${error.message}`);
      if (!StateMachine.isTerminal(task.status)) {
        this.deps.taskManager.advanceState(task, 'failed');
      }
      const userFacingText = UserFacingResponseService.formatPreparationFailure(error.message);
      const operationalText = TaskResponseEnvelopeService.buildPreparationFailure(task, error.message);
      TaskResponseEnvelopeService.capture(task, 'preparation_failure', userFacingText, operationalText);
      this.deps.persistTask(task);
      this.deps.logRepo.log('error', 'ResponseEnvelope', operationalText, {
        taskId: task.task_id,
        kind: 'preparation_failure',
      });
      await this.replyTaskEvent(ctx, task, {
        event: 'preparation_failure',
        title: 'Falha ao preparar tarefa',
        summary: error.message,
        text: userFacingText,
        status: 'failed',
        reason: error.message,
        riskBlocked: false,
      });
      return task;
    }
  }

  private async replyTaskEvent(
    ctx: Context,
    task: Task,
    input: {
      event: string;
      title: string;
      summary: string;
      text: string;
      status: 'blocked' | 'failed';
      reason: string;
      riskBlocked: boolean;
    },
  ): Promise<void> {
    await replyWithTelegramSurfaceResponse(
      ctx,
      buildTaskEventSurfaceResponse({
        taskId: task.task_id,
        event: input.event,
        title: input.title,
        summary: input.summary,
        text: input.text,
        status: input.status,
        reason: input.reason,
        riskBlocked: input.riskBlocked,
        metadata: {
          commandType: task.command_type,
          source: task.source,
          status: task.status,
        },
      }),
    );
  }

  private describeExecutor(executor: string): string {
    switch ((executor || '').toLowerCase()) {
      case 'codex':
        return 'Codex';
      case 'external_executor':
        return 'ExternalExecutor';
      case 'gemini_cli':
      case 'gemini':
        return 'Gemini CLI';
      case 'web_research':
        return 'Pesquisa web estruturada';
      case 'aistudio':
        return 'Google AI Studio';
      case 'jules':
        return 'Jules';
      case 'stitch':
        return 'Google Stitch';
      case 'zavorthBridge':
        return 'ZavorthBridge';
      default:
        if (String(executor || '').startsWith('workflow:')) {
          return `workflow ${String(executor).replace(/^workflow:/, '').trim()}`;
        }
        return executor || 'o executor padrao';
    }
  }
}
