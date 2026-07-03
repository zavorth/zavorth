import { TaskManager } from '../../../../orchestrator/TaskManager.js';
import { LogRepository } from '../../../../storage/LogRepository.js';
import { DemoGuideService } from '../../../../services/DemoGuideService.js';
import { DemoModeService } from '../../../../services/DemoModeService.js';
import { DeepSearchService } from '../../../../services/DeepSearchService.js';
import { FileDeliveryService } from '../../../../runtime/artifacts/FileDeliveryService.js';
import { SnippetService } from '../../../../services/SnippetService.js';
import { MemoryService } from '../../../../services/MemoryService.js';
import { OperatorModeService } from '../../../../services/OperatorModeService.js';
import { PresentationModeService } from '../../../../services/PresentationModeService.js';
import { JulesQueueWorker } from '../../../../orchestrator/JulesQueueWorker.js';
import { ResearchQueueWorker } from '../../../../orchestrator/ResearchQueueWorker.js';
import { SelfModificationCommandService } from '../../../../services/SelfModificationCommandService.js';
import { GroupModerationService } from '../../../../services/GroupModerationService.js';
import { TelegramMenuController } from '../../../../gateways/channels/telegram/controllers/TelegramMenuController.js';
import { TelegramOpsController } from '../../../../gateways/channels/telegram/controllers/TelegramOpsController.js';
import { TelegramFunController } from '../../../../gateways/channels/telegram/controllers/TelegramFunController.js';
import { TelegramMediaController } from '../../../../gateways/channels/telegram/controllers/TelegramMediaController.js';
import { TelegramZavorthBridgeController } from '../../../../gateways/channels/telegram/controllers/TelegramZavorthBridgeController.js';
import { TelegramHubController } from '../../../../gateways/channels/telegram/controllers/TelegramHubController.js';
import { TelegramPermissionController } from '../../../../gateways/channels/telegram/controllers/TelegramPermissionController.js';
import { TelegramEchoApprovalController } from '../../../../gateways/channels/telegram/controllers/TelegramEchoApprovalController.js';
import { TelegramKnowledgeController } from '../../../../gateways/channels/telegram/controllers/TelegramKnowledgeController.js';
import { TelegramSchedulerController } from '../../../../gateways/channels/telegram/controllers/TelegramSchedulerController.js';
import { TelegramInspectionController } from '../../../../gateways/channels/telegram/controllers/TelegramInspectionController.js';
import { TelegramSecurityController } from '../../../../gateways/channels/telegram/controllers/TelegramSecurityController.js';
import { TelegramExecutionController } from '../../../../gateways/channels/telegram/controllers/TelegramExecutionController.js';
import { TelegramChainController } from '../../../../gateways/channels/telegram/controllers/TelegramChainController.js';
import { TelegramGroupAdminController } from '../../../../gateways/channels/telegram/controllers/TelegramGroupAdminController.js';
import { TelegramGroupEventController } from '../../../../gateways/channels/telegram/controllers/TelegramGroupEventController.js';
import { TelegramLifecycleController } from '../../../../gateways/channels/telegram/controllers/TelegramLifecycleController.js';
import { TelegramProviderController } from '../../../../gateways/channels/telegram/controllers/TelegramProviderController.js';
import { TelegramResearchController } from '../../../../gateways/channels/telegram/controllers/TelegramResearchController.js';
import { TelegramPipelineController } from '../../../../gateways/channels/telegram/controllers/TelegramPipelineController.js';
import { TelegramCapabilityController } from '../../../../gateways/channels/telegram/controllers/TelegramCapabilityController.js';
import { TelegramSelfModificationController } from '../../../../gateways/channels/telegram/controllers/TelegramSelfModificationController.js';
import { TelegramFileDeliveryController } from '../../../../gateways/channels/telegram/controllers/TelegramFileDeliveryController.js';
import { TelegramSkillCatalogController } from '../../../../gateways/channels/telegram/controllers/TelegramSkillCatalogController.js';
import {
  createAiStudioPermissionRequest,
  createZavorthBridgePermissionRequest,
  createExternalExecutorPermissionRequest,
  truncateForTelegram,
} from '../../../../gateways/channels/telegram/BotGatewayHelpers.js';
import { getDefaultWorkspace, persistTask } from '../../../../gateways/channels/telegram/TelegramTaskSupport.js';
import type { BotGatewayRuntimeOptions } from '../../../../gateways/channels/telegram/bot-gateway/BotGatewayBootstrapTypes.js';

export function initializeBotGatewayControllers(
  gateway: any,
  taskManager: TaskManager,
  logRepo: LogRepository,
  workflowRunService: any,
  productObservabilityService: any,
  runtimeOptions?: BotGatewayRuntimeOptions,
): void {
  gateway.demoGuideService = new DemoGuideService();
  gateway.demoModeService = new DemoModeService();
  gateway.operatorModeService = new OperatorModeService();
  gateway.presentationModeService = new PresentationModeService();
  gateway.menuController = new TelegramMenuController(gateway.bot);
  gateway.opsController = new TelegramOpsController(
    logRepo,
    gateway.auditLogger,
    gateway.executionGateway,
    gateway.zavorthBridgePreferenceStore,
    gateway.zavorthControlService,
    gateway.dailyReportService,
    gateway.demoModeService,
    gateway.demoGuideService,
    gateway.operatorModeService,
    gateway.presentationModeService,
    gateway.remoteModeManager,
    gateway.runtimeDiagnostics,
    gateway.wslControl,
    undefined,
    undefined,
    undefined,
    productObservabilityService,
    gateway.capabilityLifecycleService,
  );
  gateway.providerController = new TelegramProviderController();
  const deepSearchService = new DeepSearchService(logRepo);
  gateway.researchController = new TelegramResearchController(taskManager);
  gateway.researchQueueWorker = new ResearchQueueWorker({
    taskManager,
    deepSearchService,
    botApi: gateway.bot.api,
    log: logRepo.log.bind(logRepo),
  });
  gateway.julesQueueWorker = new JulesQueueWorker({
    taskManager,
    botApi: gateway.bot.api,
    log: logRepo.log.bind(logRepo),
  });
  gateway.lifecycleController = new TelegramLifecycleController({
    logRepo,
    menuController: gateway.menuController,
  });
  gateway.funController = new TelegramFunController(
    gateway.funGamesService,
    gateway.bot.api,
  );
  gateway.groupModerationService = new GroupModerationService(
    gateway.bot.api,
    gateway.auditLogger,
  );
  gateway.groupAdminController = new TelegramGroupAdminController({
    warnService: gateway.warnService,
    moderationService: gateway.groupModerationService,
    statsService: gateway.groupStatsService,
    welcomeService: gateway.welcomeService,
    antiSpamService: gateway.antiSpamService,
    messageFilterService: gateway.messageFilterService,
  });
  gateway.groupEventController = new TelegramGroupEventController({
    welcomeService: gateway.welcomeService,
    antiSpamService: gateway.antiSpamService,
    messageFilterService: gateway.messageFilterService,
    moderationService: gateway.groupModerationService,
    statsService: gateway.groupStatsService,
    warnService: gateway.warnService,
  });
  gateway.mediaController = new TelegramMediaController(
    gateway.audioHandler,
    gateway.videoHandler,
    async (ctx, messageText, inlineData, ingressMetadata) => {
      await gateway.processTextMessage(ctx, messageText, inlineData, ingressMetadata);
    },
    gateway.capabilityLifecycleService,
    gateway.zavorthBridgePreferenceStore,
    gateway.echoOutputStage,
  );
  gateway.permissionController = new TelegramPermissionController({
    permissionService: gateway.permissionService,
    taskManager,
    persistTask: (task) => persistTask(taskManager, task),
    getZavorthBridgeController: () => gateway.zavorthBridgeController,
    resumeTaskExecution: (ctx, task) =>
      gateway.executionController.resumeTaskExecution(ctx, task),
    resumeWorkflowExecution: async (ctx, task) => {
      const workflowRunId = String(task.metadata?.workflow_run_id || '').trim();
      if (!workflowRunId) {
        return false;
      }

      const resumeStageId = String(
        task.metadata?.workflow_stage_id ||
          task.metadata?.workflow_resume_stage_id ||
          '',
      ).trim();
      const resumeArgs = ['resume', workflowRunId, resumeStageId]
        .filter(Boolean)
        .join(' ');
      await gateway.pipelineController.handleWorkflow(ctx, resumeArgs);
      return true;
    },
    resumeFileDeliveryPermission: (ctx, permission) =>
      gateway.fileDeliveryController.handleApprovedPermission(ctx, permission),
    resumeFileInspectionPermission: (ctx, permission) =>
      gateway.inspectionController.handleApprovedPermission(ctx, permission),
    workflowRunService,
    hostIdentityService: gateway.hostIdentityService,
    telemetryRuntime: gateway.telemetryRuntime,
    auditLogger: gateway.auditLogger,
  });
  gateway.echoApprovalController = new TelegramEchoApprovalController();
  gateway.knowledgeController = new TelegramKnowledgeController(
    new MemoryService(),
    new SnippetService(),
  );
  gateway.schedulerController = new TelegramSchedulerController(
    () => gateway.schedulerService,
  );
  gateway.inspectionController = new TelegramInspectionController(
    taskManager,
    logRepo,
    {
      permissionService: gateway.permissionService,
      buildPermissionKeyboard:
        gateway.permissionController.buildPermissionKeyboard.bind(
          gateway.permissionController,
        ),
      formatPermissionCreatedMessage:
        gateway.permissionController.formatPermissionCreatedMessage.bind(
          gateway.permissionController,
        ),
    },
  );
  gateway.securityController = new TelegramSecurityController(
    gateway.bot,
    gateway.systemCleanup,
    gateway.chatCleanup,
    gateway.securityLock,
    gateway.hostIdentityService,
  );
  gateway.executionController = new TelegramExecutionController(
    {
      taskManager,
      logRepo,
      executionGateway: gateway.executionGateway,
      auditLogger: gateway.auditLogger,
      permissionService: gateway.permissionService,
      persistTask: (task) => persistTask(taskManager, task),
      applyPersistedPermissionPolicies: (task, executor) =>
        gateway.permissionController.applyPersistedPermissionPolicies(
          task,
          executor,
        ),
      buildPermissionKeyboard: gateway.buildPermissionKeyboard.bind(gateway),
      formatPermissionCreatedMessage:
        gateway.permissionController.formatPermissionCreatedMessage.bind(
          gateway.permissionController,
        ),
      createExternalExecutorPermissionRequest: (task, result) =>
        createExternalExecutorPermissionRequest(
          {
            taskManager,
            permissionService: gateway.permissionService,
            resolveRuntimeAdapterRole: (currentTask) =>
              gateway.botGatewaySupport.resolveRuntimeAdapterRole(currentTask),
            resolveApprovedExternalAccessPath: (currentResult) =>
              gateway.botGatewaySupport.resolveApprovedExternalAccessPath(
                currentResult,
              ),
            toWslPath: (targetPath) =>
              gateway.botGatewaySupport.toWslPath(targetPath),
          },
          task,
          result,
        ),
      createAiStudioPermissionRequest: (task, result) =>
        createAiStudioPermissionRequest(
          {
            taskManager,
            permissionService: gateway.permissionService,
          },
          task,
          result,
        ),
      presentationModeService: gateway.presentationModeService,
    },
    gateway.runtimeComposition.getToolRuntime(),
  );
  gateway.chainController = new TelegramChainController({
    parser: gateway.parser,
    processTextMessage: (ctx, text) => gateway.processTextMessage(ctx, text),
    truncateForTelegram,
  });
  gateway.pipelineController = new TelegramPipelineController(
    () =>
      new (require('../../runtime/workflows/MultiAgentPipeline.js').MultiAgentPipeline)(
        gateway.executionGateway,
        {
          taskManager,
          workflowRuns: workflowRunService,
        },
      ),
    getDefaultWorkspace,
  );
  gateway.selfModificationController = new TelegramSelfModificationController({
    taskManager,
    executionGateway: gateway.executionGateway,
    auditLogger: gateway.auditLogger,
    persistTask: (task) => persistTask(taskManager, task),
    selfModificationService: new SelfModificationCommandService(),
  });
  gateway.fileDeliveryController = new TelegramFileDeliveryController(
    new FileDeliveryService(),
    {
      permissionService: gateway.permissionService,
      buildPermissionKeyboard:
        gateway.permissionController.buildPermissionKeyboard.bind(
          gateway.permissionController,
        ),
      formatPermissionCreatedMessage:
        gateway.permissionController.formatPermissionCreatedMessage.bind(
          gateway.permissionController,
        ),
    },
  );
  gateway.capabilityController = new TelegramCapabilityController({
    researchController: gateway.researchController,
    pipelineController: gateway.pipelineController,
    inspectionController: gateway.inspectionController,
    fileDeliveryController: gateway.fileDeliveryController,
    opsController: gateway.opsController,
  });
  gateway.hubController = new TelegramHubController({
    zavorthBridgePreferenceStore: gateway.zavorthBridgePreferenceStore,
    permissionService: gateway.permissionService,
    isDemoModeEnabled: () => gateway.demoModeService.isEnabled(),
    isOperatorModeEnabled: () => gateway.operatorModeService.isEnabled(),
    isPresentationModeEnabled: () =>
      gateway.presentationModeService.isEnabled(),
    getHealthStats: () => {
      const MonitorModule = require('../../monitoring/Monitor.js').Monitor;
      const monitor = new MonitorModule(logRepo);
      return monitor.getHealthStats();
    },
    formatSystemStatusReply: gateway.opsController.formatSystemStatusReply.bind(
      gateway.opsController,
    ),
    formatModelsReply: gateway.opsController.formatModelsReply.bind(
      gateway.opsController,
    ),
    formatPermissionList:
      gateway.permissionController.formatPermissionList.bind(
        gateway.permissionController,
      ),
    handleZavorthControl: gateway.opsController.handleZavorthControl.bind(
      gateway.opsController,
    ),
    handleOperationalMode: gateway.opsController.handleOperationalMode.bind(
      gateway.opsController,
    ),
    handleWslCommand: gateway.opsController.handleWslCommand.bind(
      gateway.opsController,
    ),
    handleAudit: gateway.opsController.handleAudit.bind(gateway.opsController),
    renderHelpCard: gateway.menuController.renderHelpCard.bind(
      gateway.menuController,
    ),
  });
  gateway.skillCatalogController = new TelegramSkillCatalogController();
  gateway.zavorthBridgeController = new TelegramZavorthBridgeController({
    taskManager,
    zavorthBridgeControlService: gateway.zavorthBridgeControlService,
    zavorthBridgePromptService: gateway.zavorthBridgePromptService,
    zavorthBridgePreferenceStore: gateway.zavorthBridgePreferenceStore,
    capabilityLifecycleService: gateway.capabilityLifecycleService,
    permissionService: gateway.permissionService,
    botApi: gateway.bot.api,
    persistTask: (task) => persistTask(taskManager, task),
    truncateForTelegram,
    createPermissionRequest: (task, startResult, completion) =>
      createZavorthBridgePermissionRequest(
        {
          permissionService: gateway.permissionService,
        },
        task,
        startResult,
        completion,
      ),
    formatPermissionCreatedMessage:
      gateway.permissionController.formatPermissionCreatedMessage.bind(
        gateway.permissionController,
      ),
    buildPermissionKeyboard:
      gateway.permissionController.buildPermissionKeyboard.bind(
        gateway.permissionController,
      ),
    shortPermissionId: gateway.permissionController.shortPermissionId.bind(
      gateway.permissionController,
    ),
    runResearchFallback: (query) => deepSearchService.research(query),
  });
}
