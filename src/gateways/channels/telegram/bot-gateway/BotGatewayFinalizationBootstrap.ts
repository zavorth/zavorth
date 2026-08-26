import type { Bot, Context } from 'grammy';
import { TaskManager } from '../../../../orchestrator/TaskManager.js';
import { LogRepository } from '@zavorth/storage/LogRepository.js';
import { TelegramCallbackController } from '../../../../gateways/channels/telegram/controllers/TelegramCallbackController.js';
import { defaultTelegramExperienceActionCardRegistry } from '../../../../gateways/channels/telegram/TelegramExperienceActionCardRegistry.js';
import { TelegramMnemosController } from '../../../../gateways/channels/telegram/controllers/TelegramMnemosController.js';
import { TelegramMnemosMemoryUxController } from '../../../../gateways/channels/telegram/controllers/TelegramMnemosMemoryUxController.js';
import { TelegramCommandRoutingService } from '../../../../gateways/channels/telegram/TelegramCommandRoutingService.js';

import { TelegramPriorityCommandService } from '../../../../gateways/channels/telegram/TelegramPriorityCommandService.js';
import { TelegramSchedulerBootstrap } from '../../../../gateways/channels/telegram/TelegramSchedulerSupport.js';
import { createBotGatewaySupport } from '../../../../gateways/channels/telegram/bot-gateway/BotGatewaySupportBootstrap.js';
import { initializeTelegramTaskRuntime } from '../../../../gateways/channels/telegram/bot-gateway/BotGatewayTaskRuntimeBootstrap.js';
import type { BotGatewayRuntimeOptions } from '../../../../gateways/channels/telegram/bot-gateway/BotGatewayBootstrapTypes.js';
import { processTextMessage } from '../../../../gateways/channels/telegram/bot-gateway/support/BotGatewayMessageProcessing.js';
import type { BotGateway } from '../../../../gateways/channels/telegram/BotGateway.js';
import type { WorkflowRunService } from '../../../../services/WorkflowRunService.js';
import type { RuntimeCompositionService } from '../../../../services/RuntimeCompositionService.js';
import type { SecurityLockService } from '../../../../services/SecurityLockService.js';
import type { SchedulerService } from '../../../../services/SchedulerService.js';
import type { ZavorthBridgePreferenceStore } from '../../../../agents/ZavorthBridgePreferenceStore.js';
import type { BotGatewaySupport } from './BotGatewaySupport.js';
import type { TelegramHubController } from '../controllers/TelegramHubController.js';
import type { TelegramPermissionController } from '../controllers/TelegramPermissionController.js';
import type { TelegramEchoApprovalController } from '../controllers/TelegramToolRuntimeApprovalController.js';
import type { TelegramOpsController } from '../controllers/TelegramOpsController.js';
import type { TelegramMenuController } from '../controllers/TelegramMenuController.js';
import type { TelegramSchedulerController } from '../controllers/TelegramSchedulerController.js';
import type { TelegramFunController } from '../controllers/TelegramFunController.js';
import type { TelegramGroupAdminController } from '../controllers/TelegramGroupAdminController.js';
import type { TelegramResearchController } from '../controllers/TelegramResearchController.js';
import type { TelegramKnowledgeController } from '../controllers/TelegramKnowledgeController.js';
import type { TelegramExecutionController } from '../controllers/TelegramExecutionController.js';
import type { TelegramSelfModificationController } from '../controllers/TelegramSelfModificationController.js';
import type { TelegramZavorthBridgeController } from '../controllers/TelegramZavorthBridgeController.js';
import type { TelegramFileDeliveryController } from '../controllers/TelegramFileDeliveryController.js';
import type { TelegramSwarmController } from '../controllers/TelegramSwarmController.js';
import type { TelegramInspectionController } from '../controllers/TelegramInspectionController.js';
import type { TelegramSkillCatalogController } from '../controllers/TelegramSkillCatalogController.js';
import type { TelegramSecurityController } from '../controllers/TelegramSecurityController.js';
import type { TelegramProviderController } from '../controllers/TelegramProviderController.js';

type BotGatewayFinalizationTarget = {
  mnemosController: TelegramMnemosController;
  mnemosMemoryUxController: TelegramMnemosMemoryUxController;
  callbackController: TelegramCallbackController;
  commandRoutingService: TelegramCommandRoutingService;
  priorityCommandService: TelegramPriorityCommandService;
  botGatewaySupport: BotGatewaySupport;
  schedulerService: SchedulerService;
  registerOutgoingTracker(): void;
  registerMiddlewares(): void;
  registerHandlers(): void;
  bot: { api: Bot['api'] };
  processTextMessage(ctx: Context, text: string): Promise<void>;
  hubController: TelegramHubController;
  permissionController: TelegramPermissionController;
  echoApprovalController: TelegramEchoApprovalController;
  opsController: TelegramOpsController;
  menuController: TelegramMenuController;
  zavorthBridgePreferenceStore: ZavorthBridgePreferenceStore;
  runtimeComposition: RuntimeCompositionService;
  schedulerController: TelegramSchedulerController;
  funController: TelegramFunController;
  groupAdminController: TelegramGroupAdminController;
  researchController: TelegramResearchController;
  knowledgeController: TelegramKnowledgeController;
  executionController: TelegramExecutionController;
  selfModificationController: TelegramSelfModificationController;
  zavorthBridgeController: TelegramZavorthBridgeController;
  fileDeliveryController: TelegramFileDeliveryController;
  swarmController: TelegramSwarmController;
  inspectionController: TelegramInspectionController;
  skillCatalogController: TelegramSkillCatalogController;
  securityController: TelegramSecurityController;
  providerController: TelegramProviderController;
  securityLock: SecurityLockService;
};

export function finalizeBotGatewayBootstrap(
  gateway: BotGateway,
  taskManager: TaskManager,
  logRepo: LogRepository,
  workflowRunService: WorkflowRunService,
  runtimeOptions?: BotGatewayRuntimeOptions,
): void {
  // Bootstrap step: cast to access all gateway properties for initialization
  const gw = gateway as unknown as BotGatewayFinalizationTarget;
  initializeTelegramTaskRuntime(
    gw as never,
    taskManager,
    logRepo,
    workflowRunService,
  );

  gw.mnemosController = new TelegramMnemosController({
    logRepo,
    mcpRuntimeService: runtimeOptions?.mcpRuntimeService || null,
    toolInvoker: {
      execute: (toolName: string, args: Record<string, unknown>) =>
        gw.runtimeComposition.getToolRuntime().executeTool(toolName, args),
    },
  });
  gw.mnemosMemoryUxController = new TelegramMnemosMemoryUxController();
  gw.callbackController = new TelegramCallbackController({
    handleHubCallback: gw.hubController.handleHubCallback.bind(
      gw.hubController,
    ),
    handlePermissionCallback:
      gw.permissionController.handlePermissionCallback.bind(
        gw.permissionController,
      ),
    handleTaskCallback:
      gw.permissionController.handleTaskCallback.bind(
        gw.permissionController,
      ),
    handleEchoApprovalCallback:
      gw.echoApprovalController.handleEchoCallback.bind(
        gw.echoApprovalController,
      ),
    handleMnemosCallback:
      gw.mnemosController.handleMnemosCallback.bind(gw.mnemosController),
    handleStatusAction: gw.opsController.handleStatus.bind(
      gw.opsController,
    ),
    handleHelpAction: gw.menuController.renderHelpCard.bind(
      gw.menuController,
    ),
    handleAuditAction: (ctx: Context) => gw.opsController.handleAudit(ctx, '10'),
    handleModeAction: (ctx: Context) =>
      gw.opsController.handleOperationalMode(ctx, ''),
    handleModelsAction: gw.opsController.handleModels.bind(
      gw.opsController,
    ),
    handleSurfaceCommandCallback: async (ctx: Context, commandText: string) => {
      await processTextMessage(gw as never, ctx, commandText);
    },
    handleExperienceActionCardCallback: async (ctx: Context, data: string) => {
      const resolved = defaultTelegramExperienceActionCardRegistry.resolve(data, {
        userId: String(ctx.from?.id || '').trim() || null,
        chatId: String(ctx.chat?.id || '').trim() || null,
      });
      if (!resolved.ok) {
        const reason = resolved.reason === 'forbidden'
          ? 'Action card does not belong to this user/chat.'
          : resolved.reason === 'expired'
            ? 'Action card expired. Request status again.'
            : 'Action card is invalid or not found.';
        await ctx.answerCallbackQuery({ text: reason });
        return;
      }
      await ctx.answerCallbackQuery({ text: 'Action card received.' });
      await processTextMessage(gw as never, ctx, resolved.entry.commandText);
    },
    logError: (message: string) =>
      logRepo.log('error', 'BotGateway', `Callback error: ${message}`),
  });
  gw.commandRoutingService = new TelegramCommandRoutingService({
    menuController: gw.menuController,
    opsController: gw.opsController,
    hubController: gw.hubController,
    skillCatalogController: gw.skillCatalogController,
    securityController: gw.securityController,
    providerController: gw.providerController,
    permissionController: gw.permissionController,
    echoApprovalController: gw.echoApprovalController,
    schedulerController: gw.schedulerController,
    funController: gw.funController,
    groupAdminController: gw.groupAdminController,
    researchController: gw.researchController,
    knowledgeController: gw.knowledgeController,
    executionController: gw.executionController,
    selfModificationController: gw.selfModificationController,
    zavorthBridgeController: gw.zavorthBridgeController,
    fileDeliveryController: gw.fileDeliveryController,
    swarmController: gw.swarmController,
    mnemosMemoryUxController: gw.mnemosMemoryUxController,
    echoPreferenceStore: gw.zavorthBridgePreferenceStore,
  });
  gw.priorityCommandService = new TelegramPriorityCommandService({
    opsController: gw.opsController,
    zavorthBridgeController: gw.zavorthBridgeController,
    securityLock: gw.securityLock,
  });

  gw.botGatewaySupport = createBotGatewaySupport(gw as never, logRepo);

  gw.registerOutgoingTracker();
  gw.registerMiddlewares();
  gw.registerHandlers();
  void new TelegramSchedulerBootstrap({
    botApi: gw.bot.api,
    processTextMessage: (ctx: Context, text: string) => gw.processTextMessage(ctx, text),
    onReady: (schedulerService: SchedulerService) => {
      gw.schedulerService = schedulerService;
    },
  }).init();
}
