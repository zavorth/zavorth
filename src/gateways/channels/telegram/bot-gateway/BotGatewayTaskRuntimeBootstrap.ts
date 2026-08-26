import { Context, InputFile, Bot } from 'grammy';
import { config } from '../../../../config/index.js';
import { TaskManager } from '../../../../orchestrator/TaskManager.js';
import { LogRepository } from '../../../../storage/LogRepository.js';
import type { Task } from '../../../../contracts/TaskContract.js';
import { TrustedBoundary } from '../../../../security/TrustedBoundary.js';
import { WorkspaceOperationalMemoryService } from '../../../../runtime/context/WorkspaceOperationalMemoryService.js';
import { SurfaceTaskDispatchService } from '../../../../orchestrator/SurfaceTaskDispatchService.js';
import type { EchoOutputStageService } from '../../../../services/EchoOutputStageService.js';
import { TelegramTaskOrchestrationController } from '../../../../gateways/channels/telegram/controllers/TelegramTaskOrchestrationController.js';
import type { TelegramTaskPreparationInput } from '../../../../gateways/channels/telegram/controllers/TelegramTaskPreparationService.js';
import { TelegramSwarmController } from '../../../../gateways/channels/telegram/controllers/TelegramSwarmController.js';
import { LlmRuntimeService } from '../../../../services/llm/LlmRuntimeService.js';
import { ContextManager } from '../../../../orchestrator/ContextManager.js';
import { IntentRouter } from '../../../../orchestrator/IntentRouter.js';
import { RiskClassifier } from '../../../../orchestrator/RiskClassifier.js';
import type {
  ParserLike,
  TaskOrchestrationControllerLike,
  PermissionServiceLike,
  TaskManagerLike,
  WorkflowControllerLike,
  SurfaceTaskDispatcherLike,
  PermissionControllerLike,
  HostIdentityServiceLike,
} from '../../../../orchestrator/SurfaceRuntime.js';
import type { WorkflowRunService } from '../../../../services/WorkflowRunService.js';
import type { SecurityAuditLogger } from '../../../../services/SecurityAuditLogger.js';
import type { OperatorModeService } from '../../../../services/OperatorModeService.js';
import type { PresentationModeService } from '../../../../services/PresentationModeService.js';
import type { WorkspaceProfileService } from '../../../../services/WorkspaceProfileService.js';
import {
  extractTaskPayload,
  getDefaultWorkspace,
  persistTask,
} from '../../../../gateways/channels/telegram/TelegramTaskSupport.js';

type InlineDataEntry = { mimeType: string; data: string };

type TaskConversationIngress = (
  ctx: Context,
  task: Task,
  messageText: string,
  inlineData?: InlineDataEntry[],
) => Promise<void>;

type TaskLegacyUnifiedGatewayAdapterLike = {
  handleEvent(event: {
    surface: 'telegram' | 'discord' | 'web';
    chatId: string;
    userId: string;
    text: string;
    isGroup: boolean;
    inlineData?: InlineDataEntry[];
    reply: (text: string) => Promise<void>;
    metadata: Record<string, unknown>;
  }): Promise<{ responseText?: string | null }>;
};

type TaskRuntimeIngressGateway = {
  legacyUnifiedGateway?: TaskLegacyUnifiedGatewayAdapterLike | null;
  echoOutputStage?: Pick<EchoOutputStageService, 'deliver'> | null;
  logRepo: Pick<LogRepository, 'log'>;
};

type VoiceReplyCapableContext = Context & {
  replyWithVoice(audio: InputFile): Promise<unknown>;
};

type ExecutionControllerLike = {
  handlePlan(ctx: Context, task: Task): Promise<void>;
  executeImmediate(ctx: Context, task: Task, isDryRun: boolean): Promise<void>;
};

type ZavorthBridgeControllerLike = {
  handleTaskExecution(ctx: Context, task: Task, payload: string): Promise<void>;
};

type VideoHandlerLike = {
  containsSupportedVideoUrl(text: string): boolean;
  prepareFromText(
    text: string,
  ): Promise<{ messageText: string; inlineData?: Array<{ mimeType: string; data: string }> } | null>;
};

type BotGatewayRuntimeTarget = {
  bot: { api: Bot['api'] };
  swarmController: unknown;
  taskOrchestrationController: TelegramTaskOrchestrationController;
  surfaceTaskDispatcher: SurfaceTaskDispatchService;
  auditLogger: SecurityAuditLogger;
  operatorModeService: OperatorModeService;
  presentationModeService: PresentationModeService;
  workspaceProfileService: WorkspaceProfileService;
  permissionService: PermissionServiceLike;
  executionController: ExecutionControllerLike;
  zavorthBridgeController: ZavorthBridgeControllerLike;
  legacyUnifiedGateway?: TaskLegacyUnifiedGatewayAdapterLike | null;
  echoOutputStage?: EchoOutputStageService | null;
  videoHandler: VideoHandlerLike;
  pipelineController: WorkflowControllerLike;
  parser: ParserLike;
  surfaceIdentityService: unknown;
  zavorthControlService: {
    attachChatRuntime(runtime: ZavorthControlChatRuntime): void;
  };
  permissionController: PermissionControllerLike;
  hostIdentityService: HostIdentityServiceLike;
};

type ZavorthControlChatRuntime = {
  permissionService: PermissionServiceLike;
  taskManager: TaskManagerLike;
  workflowRunService: WorkflowRunService;
  parser: ParserLike;
  taskOrchestrationController: TaskOrchestrationControllerLike;
  workflowController: WorkflowControllerLike;
  surfaceTaskDispatcher: SurfaceTaskDispatcherLike;
  legacyUnifiedGateway?: TaskLegacyUnifiedGatewayAdapterLike | null;
  echoOutputStage?: Pick<EchoOutputStageService, 'deliver'> | null;
  permissionController: PermissionControllerLike;
  hostIdentityService: HostIdentityServiceLike;
  webUserId: string;
};

export function buildTaskNaturalConversationIngress(
  gateway: TaskRuntimeIngressGateway,
  taskManager: TaskManager,
): TaskConversationIngress {
  return async (ctx, task, messageText, inlineData) => {
    const sourcePlatform = String(task.source || 'telegram')
      .trim()
      .toLowerCase();
    const normalizedText = String(messageText || '').trim();
    const surface = sourcePlatform === 'discord' || sourcePlatform === 'web' ? sourcePlatform : 'telegram';
    const userId = ctx.from?.id?.toString?.() || task.user_id || '';
    const chatId = ctx.chat?.id?.toString?.() || task.chat_id || '';
    const legacyUnifiedGateway = gateway.legacyUnifiedGateway || null;

    if (!normalizedText) {
      gateway.logRepo.log('warn', 'BotGateway', 'Unified natural ingress ignored due to empty payload.', {
        taskId: task.task_id,
        source: task.source || 'telegram',
      });
      await ctx.reply('Could not forward this message through the unified conversation because it was empty.');
      return;
    }

    if (!legacyUnifiedGateway) {
      gateway.logRepo.log(
        'error',
        'BotGateway',
        'LegacyUnifiedGatewayAdapter unavailable during natural task ingress.',
        {
          taskId: task.task_id,
          source: task.source || 'telegram',
        },
      );
      await ctx.reply('The Zavorth unified conversation is not available right now. Please try again in a few moments.');
      return;
    }

    const result = await legacyUnifiedGateway.handleEvent({
      surface,
      chatId,
      userId,
      text: normalizedText,
      isGroup: Boolean(ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup'),
      inlineData,
      reply: async (text: string) => {
        const outputStage = gateway.echoOutputStage || null;
        if (!outputStage) {
          await ctx.reply(text);
          return;
        }

        const voiceFlow = (task.metadata?.voiceFlow || null) as Record<string, unknown> | null;
        await outputStage.deliver({
          surface,
          text,
          rawInput: normalizedText,
          taskId: task.task_id,
          requestedBy: userId || 'telegram-task-ingress',
          sessionId: chatId,
          voiceFlow,
          preferVoiceReply:
            voiceFlow?.preferVoiceReply === true ||
            voiceFlow?.ttsReplyDesired === true ||
            voiceFlow?.replyWithAudio === true,
          forceVoice: voiceFlow?.forceVoice === true,
          preferredLanguageCode:
            typeof task.metadata?.preferredLanguageCode === 'string' ? task.metadata.preferredLanguageCode : null,
          sink: {
            sendText: async (nextText) => {
              await ctx.reply(nextText);
            },
            sendChatAction: async (action) => {
              if (!ctx.chat?.id) {
                return;
              }
              await ctx.api.sendChatAction(ctx.chat.id, action);
            },
            sendVoice:
              typeof (ctx as VoiceReplyCapableContext).replyWithVoice === 'function'
                ? async (audioPath) => {
                    await (ctx as VoiceReplyCapableContext).replyWithVoice(new InputFile(audioPath));
                  }
                : undefined,
          },
        });
      },
      metadata: {
        phase: 'legacy-unified-task-route-v1',
        transport: 'text',
        taskId: task.task_id,
        source: task.source || 'telegram',
      },
    });

    task.result_summary = String(result.responseText || '').trim() || task.result_summary || null;
    persistTask(taskManager, task);
  };
}

export function initializeTelegramTaskRuntime(
  gateway: BotGatewayRuntimeTarget,
  taskManager: TaskManager,
  logRepo: LogRepository,
  workflowRunService: WorkflowRunService,
): void {
  gateway.swarmController = new TelegramSwarmController({
    botApi: gateway.bot.api,
    getLlmRuntime: () => new LlmRuntimeService(),
  });
  gateway.taskOrchestrationController = new TelegramTaskOrchestrationController({
    taskManager,
    logRepo,
    auditLogger: gateway.auditLogger,
    attachRecentContext: async (task) => {
      const contextManager = new ContextManager(taskManager);
      await contextManager.attachRecentContext(task);
    },
    routeIntent: (parsed) => {
      const intentRouter = new IntentRouter();
      return intentRouter.route(parsed);
    },
    classifyRisk: (parsed, route) => {
      const riskClassifier = new RiskClassifier();
      return riskClassifier.classify(parsed, route);
    },
    classifyTrust: (text, input) => classifyTaskTrust(text, input),
    persistTask: (task) => persistTask(taskManager, task),
    getDefaultWorkspace,
    extractTaskPayload,
    operatorModeService: gateway.operatorModeService,
    presentationModeService: gateway.presentationModeService,
    workspaceProfileService: gateway.workspaceProfileService,
    workspaceOperationalMemoryService: new WorkspaceOperationalMemoryService(
      taskManager,
      gateway.permissionService as unknown as ConstructorParameters<typeof WorkspaceOperationalMemoryService>[1],
    ),
    executionController: gateway.executionController,
    zavorthBridgeController: gateway.zavorthBridgeController,
    naturalConversationIngress: buildTaskNaturalConversationIngress(
      {
        legacyUnifiedGateway: gateway.legacyUnifiedGateway || null,
        echoOutputStage: gateway.echoOutputStage || null,
        logRepo,
      },
      taskManager,
    ),
    videoHandler: gateway.videoHandler,
    workflowController: gateway.pipelineController as unknown as ConstructorParameters<
      typeof TelegramTaskOrchestrationController
    >[0]['workflowController'],
  });
  gateway.surfaceTaskDispatcher = new SurfaceTaskDispatchService({
    parser: gateway.parser,
    taskOrchestrationController: gateway.taskOrchestrationController as unknown as ConstructorParameters<
      typeof SurfaceTaskDispatchService
    >[0]['taskOrchestrationController'],
    surfaceIdentityService: gateway.surfaceIdentityService as unknown as ConstructorParameters<
      typeof SurfaceTaskDispatchService
    >[0]['surfaceIdentityService'],
  });
  gateway.zavorthControlService.attachChatRuntime({
    permissionService: gateway.permissionService,
    taskManager: taskManager as unknown as TaskManagerLike,
    workflowRunService,
    parser: gateway.parser,
    taskOrchestrationController: gateway.taskOrchestrationController as unknown as TaskOrchestrationControllerLike,
    workflowController: gateway.pipelineController as unknown as WorkflowControllerLike,
    surfaceTaskDispatcher: gateway.surfaceTaskDispatcher,
    legacyUnifiedGateway: gateway.legacyUnifiedGateway || null,
    echoOutputStage: gateway.echoOutputStage || null,
    permissionController: gateway.permissionController,
    hostIdentityService: gateway.hostIdentityService,
    webUserId: config.allowedUserIds[0] || '1',
  });
}

function classifyTaskTrust(text: string, input: TelegramTaskPreparationInput) {
  const platform = String(input?.surfaceMetadata?.platform || input?.source || 'telegram')
    .trim()
    .toLowerCase();

  if (platform === 'discord') {
    const chatId = String(input?.surfaceMetadata?.chatId || input?.chatId || '').trim();
    if (chatId.startsWith('discord:dm:')) {
      return TrustedBoundary.classify(text, 'discord_dm_user');
    }

    return TrustedBoundary.classify(
      text,
      input?.surfaceMetadata?.publicServerMode === true ? 'discord_public_user' : 'discord_user',
    );
  }

  if (platform === 'web') {
    return TrustedBoundary.classify(text, 'web_user');
  }

  return TrustedBoundary.classify(text, 'telegram_user');
}
