import { config } from '../config/index.js';
import { BotGateway } from '../gateways/channels/telegram/BotGateway.js';
import type {
  BootstrapFoundation,
  BootstrapSupervisor,
} from './bootstrapTypes.js';

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
  console.log('[BOOT] web-surface');
  await botGateway.startZavorthControlSurface();
  console.log('[BOOT] web-surface-ready');

  setTimeout(() => {
    void foundation.configVersioningService.snapshot('bootstrap').catch((error: unknown) => {
      foundation.logRepo.log('warn', 'ConfigVersioning', `Falha ao registrar snapshot de bootstrap: ${describeError(error)}`);
    });
  }, 1_000).unref();

  return botGateway;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
