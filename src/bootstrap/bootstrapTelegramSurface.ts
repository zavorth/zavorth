import { config } from '../config/index.js';
import { BotGateway } from '../gateways/channels/telegram/BotGateway.js';
import type {
  BootstrapFoundation,
  BootstrapSupervisor,
} from './bootstrapTypes.js';
import { logger } from '../logger.js';

export async function startZavorthControlSurface(
  foundation: BootstrapFoundation,
  supervisor: BootstrapSupervisor,
): Promise<BotGateway> {
  const botGateway = new BotGateway(
    config.telegramBotToken,
    foundation.taskManager,
    foundation.logRepo,
    foundation.runtimeComposition,
    {
      runtimeProfileService: foundation.runtimeProfileService,
      contextEngine: foundation.contextEngine,
      legacyUnifiedGateway: foundation.legacyUnifiedGateway,
      agentGateway: foundation.agentGateway,
      capabilityLifecycleService: foundation.capabilityLifecycleService,
      mcpRuntimeService: foundation.mcpRuntime,
      mcpCapabilityControlPlaneService: foundation.mcpCapabilityControlPlaneService,
    },
  );

  supervisor.updateProgress('web-surface');
  logger.info('[BOOT] web-surface');
  await botGateway.startZavorthControlSurface();
  logger.info('[BOOT] web-surface-ready');

  setTimeout(() => {
    void foundation.configVersioningService.snapshot('bootstrap').catch((error: unknown) => {
      foundation.logRepo.log('warn', 'ConfigVersioning', `Failed to register bootstrap snapshot: ${describeError(error)}`);
    });
  }, 1_000).unref();

  return botGateway;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
