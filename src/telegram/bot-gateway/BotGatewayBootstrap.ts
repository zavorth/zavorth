import { TaskManager } from '../../orchestrator/TaskManager.js';
import { LogRepository } from '../../storage/LogRepository.js';
import { RuntimeCompositionService } from '../../services/RuntimeCompositionService.js';
import { initializeBotGatewayControllers } from './BotGatewayControllerBootstrap.js';
import { finalizeBotGatewayBootstrap } from './BotGatewayFinalizationBootstrap.js';
import { initializeBotGatewayFoundation } from './BotGatewayFoundationBootstrap.js';
import { initializeTelegramOperationsServices } from './BotGatewayOperationsBootstrap.js';
import type { BotGatewayRuntimeOptions } from './BotGatewayBootstrapTypes.js';

export type { BotGatewayRuntimeOptions } from './BotGatewayBootstrapTypes.js';

export function initializeBotGateway(
  gateway: any,
  token: string,
  taskManager: TaskManager,
  logRepo: LogRepository,
  runtimeComposition?: RuntimeCompositionService,
  runtimeOptions?: BotGatewayRuntimeOptions,
): void {
  gateway.taskManager = taskManager;
  gateway.logRepo = logRepo;
  initializeBotGatewayFoundation(
    gateway,
    token,
    logRepo,
    runtimeComposition,
    runtimeOptions,
  );

  const { workflowRunService, productObservabilityService } =
    initializeTelegramOperationsServices(
      gateway,
      taskManager,
      logRepo,
      runtimeOptions,
    );
  initializeBotGatewayControllers(
    gateway,
    taskManager,
    logRepo,
    workflowRunService,
    productObservabilityService,
    runtimeOptions,
  );
  finalizeBotGatewayBootstrap(gateway, taskManager, logRepo, workflowRunService, runtimeOptions);
}
