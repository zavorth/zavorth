import { TaskManager } from '../../../../orchestrator/TaskManager.js';
import { LogRepository } from '../../../../storage/LogRepository.js';
import { RuntimeCompositionService } from '../../../../services/RuntimeCompositionService.js';
import { initializeBotGatewayControllers } from '../../../../gateways/channels/telegram/bot-gateway/BotGatewayControllerBootstrap.js';
import { finalizeBotGatewayBootstrap } from '../../../../gateways/channels/telegram/bot-gateway/BotGatewayFinalizationBootstrap.js';
import { initializeBotGatewayFoundation } from '../../../../gateways/channels/telegram/bot-gateway/BotGatewayFoundationBootstrap.js';
import { initializeTelegramOperationsServices } from '../../../../gateways/channels/telegram/bot-gateway/BotGatewayOperationsBootstrap.js';
import type { BotGatewayRuntimeOptions } from '../../../../gateways/channels/telegram/bot-gateway/BotGatewayBootstrapTypes.js';
import type { BotGateway } from '../../../../gateways/channels/telegram/BotGateway.js';

export type { BotGatewayRuntimeOptions } from '../../../../gateways/channels/telegram/bot-gateway/BotGatewayBootstrapTypes.js';

export function initializeBotGateway(
  gateway: BotGateway,
  token: string,
  taskManager: TaskManager,
  logRepo: LogRepository,
  runtimeComposition?: RuntimeCompositionService,
  runtimeOptions?: BotGatewayRuntimeOptions,
): void {
  // Bootstrap step: assign private properties via Object.assign
  Object.assign(gateway, { taskManager, logRepo });
  initializeBotGatewayFoundation(
    gateway as any,
    token,
    logRepo,
    runtimeComposition,
    runtimeOptions,
  );

  const { workflowRunService, productObservabilityService } =
    initializeTelegramOperationsServices(
      gateway as any,
      taskManager,
      logRepo,
      runtimeOptions as any,
    );
  initializeBotGatewayControllers(
    gateway as any,
    taskManager,
    logRepo,
    workflowRunService,
    productObservabilityService,
    runtimeOptions as any,
  );
  finalizeBotGatewayBootstrap(gateway as any, taskManager, logRepo, workflowRunService, runtimeOptions);
}
