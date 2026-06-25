import { TaskManager } from '../../../../orchestrator/TaskManager.js';
import { LogRepository } from '@zavorth/storage/LogRepository.js';
import { TelegramCallbackController } from '../../../../gateways/channels/telegram/controllers/TelegramCallbackController.js';
import { defaultTelegramExperienceActionCardRegistry } from '../../../../gateways/channels/telegram/TelegramExperienceActionCardRegistry.js';
import { TelegramMnemosController } from '../../../../gateways/channels/telegram/controllers/TelegramMnemosController.js';
import { TelegramMnemosMemoryUxController } from '../../../../gateways/channels/telegram/controllers/TelegramMnemosMemoryUxController.js';
import { TelegramCommandRoutingService } from '../../../../gateways/channels/telegram/TelegramCommandRoutingService.js';
import { TelegramNaturalCapabilityRoutingService } from '../../../../gateways/channels/telegram/TelegramNaturalCapabilityRoutingService.js';
import { TelegramPriorityCommandService } from '../../../../gateways/channels/telegram/TelegramPriorityCommandService.js';
import { TelegramSchedulerBootstrap } from '../../../../gateways/channels/telegram/TelegramSchedulerSupport.js';
import { createBotGatewaySupport } from '../../../../gateways/channels/telegram/bot-gateway/BotGatewaySupportBootstrap.js';
import { initializeTelegramTaskRuntime } from '../../../../gateways/channels/telegram/bot-gateway/BotGatewayTaskRuntimeBootstrap.js';
import type { BotGatewayRuntimeOptions } from '../../../../gateways/channels/telegram/bot-gateway/BotGatewayBootstrapTypes.js';
import { processTextMessage } from '../../../../gateways/channels/telegram/bot-gateway/support/BotGatewayMessageProcessing.js';
import { LlmRuntimeService } from '@zavorth/services/llm/LlmRuntimeService.js';
import { TelegramIntentClassifier } from '../../../../gateways/channels/telegram/controllers/TelegramIntentClassifier.js';

export function finalizeBotGatewayBootstrap(
  gateway: any,
  taskManager: TaskManager,
  logRepo: LogRepository,
  workflowRunService: any,
  runtimeOptions?: BotGatewayRuntimeOptions,
): void {
  initializeTelegramTaskRuntime(
    gateway,
    taskManager,
    logRepo,
    workflowRunService,
  );

  gateway.mnemosController = new TelegramMnemosController({
    logRepo,
    mcpRuntimeService: runtimeOptions?.mcpRuntimeService || null,
    toolInvoker: {
      execute: (toolName, args) =>
        gateway.runtimeComposition.getToolRuntime().executeTool(toolName, args),
    },
  });
  gateway.mnemosMemoryUxController = new TelegramMnemosMemoryUxController();
  gateway.callbackController = new TelegramCallbackController({
    handleHubCallback: gateway.hubController.handleHubCallback.bind(
      gateway.hubController,
    ),
    handlePermissionCallback:
      gateway.permissionController.handlePermissionCallback.bind(
        gateway.permissionController,
      ),
    handleEchoApprovalCallback:
      gateway.echoApprovalController.handleEchoCallback.bind(
        gateway.echoApprovalController,
      ),
    handleMnemosCallback:
      gateway.mnemosController.handleMnemosCallback.bind(gateway.mnemosController),
    handleStatusAction: gateway.opsController.handleStatus.bind(
      gateway.opsController,
    ),
    handleHelpAction: gateway.menuController.renderHelpCard.bind(
      gateway.menuController,
    ),
    handleAuditAction: (ctx) => gateway.opsController.handleAudit(ctx, '10'),
    handleModeAction: (ctx) =>
      gateway.opsController.handleOperationalMode(ctx, ''),
    handleModelsAction: gateway.opsController.handleModels.bind(
      gateway.opsController,
    ),
    handleSurfaceCommandCallback: async (ctx, commandText) => {
      await processTextMessage(gateway, ctx, commandText);
    },
    handleExperienceActionCardCallback: async (ctx, data) => {
      const resolved = defaultTelegramExperienceActionCardRegistry.resolve(data, {
        userId: String(ctx.from?.id || '').trim() || null,
        chatId: String(ctx.chat?.id || '').trim() || null,
      });
      if (!resolved.ok) {
        const reason = resolved.reason === 'forbidden'
          ? 'Action card nao pertence a este usuario/chat.'
          : resolved.reason === 'expired'
            ? 'Action card expirou. Peca status novamente.'
            : 'Action card invalido ou nao encontrado.';
        await ctx.answerCallbackQuery({ text: reason });
        return;
      }
      await ctx.answerCallbackQuery({ text: 'Action card recebido.' });
      await processTextMessage(gateway, ctx, resolved.entry.commandText);
    },
    logError: (message) =>
      logRepo.log('error', 'BotGateway', `Callback error: ${message}`),
  });
  gateway.commandRoutingService = new TelegramCommandRoutingService({
    menuController: gateway.menuController,
    opsController: gateway.opsController,
    hubController: gateway.hubController,
    skillCatalogController: gateway.skillCatalogController,
    securityController: gateway.securityController,
    providerController: gateway.providerController,
    permissionController: gateway.permissionController,
    echoApprovalController: gateway.echoApprovalController,
    schedulerController: gateway.schedulerController,
    funController: gateway.funController,
    groupAdminController: gateway.groupAdminController,
    researchController: gateway.researchController,
    knowledgeController: gateway.knowledgeController,
    executionController: gateway.executionController,
    selfModificationController: gateway.selfModificationController,
    zavorthBridgeController: gateway.zavorthBridgeController,
    fileDeliveryController: gateway.fileDeliveryController,
    swarmController: gateway.swarmController,
    mnemosMemoryUxController: gateway.mnemosMemoryUxController,
    naturalCapabilityRouter: new TelegramNaturalCapabilityRoutingService({
      fileDeliveryController: gateway.fileDeliveryController,
      inspectionController: gateway.inspectionController,
      researchController: gateway.researchController,
      schedulerController: gateway.schedulerController,
    }),
    // Certification matrix: Modo Echo
    echoPreferenceStore: gateway.zavorthBridgePreferenceStore,
  });
  gateway.priorityCommandService = new TelegramPriorityCommandService({
    opsController: gateway.opsController,
    zavorthBridgeController: gateway.zavorthBridgeController,
    securityLock: gateway.securityLock,
    intentClassifier: new TelegramIntentClassifier(new LlmRuntimeService('gemini')),
  });

  gateway.botGatewaySupport = createBotGatewaySupport(gateway, logRepo);

  gateway.registerOutgoingTracker();
  gateway.registerMiddlewares();
  gateway.registerHandlers();
  void new TelegramSchedulerBootstrap({
    botApi: gateway.bot.api,
    processTextMessage: (ctx, text) => gateway.processTextMessage(ctx, text),
    onReady: (schedulerService) => {
      gateway.schedulerService = schedulerService;
    },
  }).init();
}
