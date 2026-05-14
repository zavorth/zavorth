import { Context, InputFile } from "grammy";
import { config } from "../../config/index.js";
import { TaskManager } from "../../orchestrator/TaskManager.js";
import { LogRepository } from "../../storage/LogRepository.js";
import type { Task } from "../../contracts/TaskContract.js";
import { TrustedBoundary } from "../../security/TrustedBoundary.js";
import { WorkspaceOperationalMemoryService } from "../../runtime/context/WorkspaceOperationalMemoryService.js";
import { SurfaceTaskDispatchService } from "../../services/SurfaceTaskDispatchService.js";
import type { EchoOutputStageService } from "../../services/EchoOutputStageService.js";
import { TelegramTaskOrchestrationController } from "../controllers/TelegramTaskOrchestrationController.js";
import {
  extractTaskPayload,
  getDefaultWorkspace,
  persistTask,
} from "../TelegramTaskSupport.js";

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

export function buildTaskNaturalConversationIngress(
  gateway: TaskRuntimeIngressGateway,
  taskManager: TaskManager,
): TaskConversationIngress {
  return async (ctx, task, messageText, inlineData) => {
    const sourcePlatform = String(task.source || 'telegram').trim().toLowerCase();
    const normalizedText = String(messageText || '').trim();
    const surface = sourcePlatform === 'discord' || sourcePlatform === 'web'
      ? sourcePlatform
      : 'telegram';
    const userId = ctx.from?.id?.toString?.() || task.user_id || '';
    const chatId = ctx.chat?.id?.toString?.() || task.chat_id || '';
    const legacyUnifiedGateway = gateway.legacyUnifiedGateway || null;

    if (!normalizedText) {
      gateway.logRepo.log(
        'warn',
        'BotGateway',
        'Ingresso natural unificado ignorado por payload vazio.',
        {
          taskId: task.task_id,
          source: task.source || 'telegram',
        },
      );
      await ctx.reply('Nao consegui encaminhar essa mensagem pela conversa unificada porque ela veio vazia.');
      return;
    }

    if (!legacyUnifiedGateway) {
      gateway.logRepo.log(
        'error',
        'BotGateway',
        'LegacyUnifiedGatewayAdapter indisponivel durante o ingresso natural de task.',
        {
          taskId: task.task_id,
          source: task.source || 'telegram',
        },
      );
      await ctx.reply('A conversa unificada do Zavorth nao esta disponivel agora. Tente novamente em instantes.');
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

        await outputStage.deliver({
          surface,
          text,
          rawInput: normalizedText,
          taskId: task.task_id,
          requestedBy: userId || 'telegram-task-ingress',
          sessionId: chatId,
          voiceFlow: (task.metadata?.voiceFlow || null) as Record<string, unknown> | null,
          preferredLanguageCode:
            typeof task.metadata?.preferredLanguageCode === 'string'
              ? task.metadata.preferredLanguageCode
              : null,
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
              typeof (ctx as any).replyWithVoice === 'function'
                ? async (audioPath) => {
                    await (ctx as any).replyWithVoice(new InputFile(audioPath));
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
  gateway: any,
  taskManager: TaskManager,
  logRepo: LogRepository,
  workflowRunService: any,
): void {
  const {
    TelegramSwarmController,
  } = require("../controllers/TelegramSwarmController.js");
  gateway.swarmController = new TelegramSwarmController({
    botApi: gateway.bot.api,
    getLlmRuntime: () =>
      new (require("../../services/llm/LlmRuntimeService.js").LlmRuntimeService)(),
  });
  gateway.taskOrchestrationController = new TelegramTaskOrchestrationController(
    {
      taskManager,
      logRepo,
      auditLogger: gateway.auditLogger,
      attachRecentContext: async (task) => {
        const ContextModule =
          require("../../orchestrator/ContextManager.js").ContextManager;
        const contextManager = new ContextModule(taskManager);
        await contextManager.attachRecentContext(task);
      },
      routeIntent: (parsed) => {
        const intentRouter =
          new (require("../../orchestrator/IntentRouter.js").IntentRouter)();
        return intentRouter.route(parsed);
      },
      classifyRisk: (parsed, route) => {
        const riskClassifier =
          new (require("../../orchestrator/RiskClassifier.js").RiskClassifier)();
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
        gateway.permissionService,
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
      workflowController: gateway.pipelineController,
    },
  );
  gateway.surfaceTaskDispatcher = new SurfaceTaskDispatchService({
    parser: gateway.parser as any,
    taskOrchestrationController: gateway.taskOrchestrationController as any,
    surfaceIdentityService: gateway.surfaceIdentityService,
  });
  gateway.dashboardService.attachChatRuntime({
    permissionService: gateway.permissionService as any,
    taskManager: taskManager as any,
    workflowRunService,
    parser: gateway.parser as any,
    taskOrchestrationController: gateway.taskOrchestrationController as any,
    workflowController: gateway.pipelineController as any,
    surfaceTaskDispatcher: gateway.surfaceTaskDispatcher as any,
    legacyUnifiedGateway: gateway.legacyUnifiedGateway || null,
    echoOutputStage: gateway.echoOutputStage || null,
    permissionController: gateway.permissionController as any,
    hostIdentityService: gateway.hostIdentityService as any,
    webUserId: config.allowedUserIds[0] || "1",
  });
}

function classifyTaskTrust(text: string, input: any) {
  const platform = String(
    input?.surfaceMetadata?.platform || input?.source || "telegram",
  )
    .trim()
    .toLowerCase();

  if (platform === "discord") {
    const chatId = String(
      input?.surfaceMetadata?.chatId || input?.chatId || "",
    ).trim();
    if (chatId.startsWith("discord:dm:")) {
      return TrustedBoundary.classify(text, "discord_dm_user");
    }

    return TrustedBoundary.classify(
      text,
      input?.surfaceMetadata?.publicServerMode === true
        ? "discord_public_user"
        : "discord_user",
    );
  }

  if (platform === "web") {
    return TrustedBoundary.classify(text, "web_user");
  }

  return TrustedBoundary.classify(text, "telegram_user");
}
