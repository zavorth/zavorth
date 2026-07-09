import { Database } from '../storage/Database.js';
import type {
  BootstrapFoundation,
  BootstrapRuntimeServices,
  BootstrapSupervisor,
  BootstrapSurfaceRuntime,
} from './bootstrapTypes.js';
import { logger } from '../logger.js';

export function registerShutdownHandlers(
  foundation: BootstrapFoundation,
  runtimeServices: BootstrapRuntimeServices,
  surfaceRuntime: BootstrapSurfaceRuntime,
  supervisor: BootstrapSupervisor,
): void {
  const shutdown = async (signal?: string) => {
    foundation.logRepo.log('info', 'System', 'Encerrando Zavorth V2...');
    supervisor.clear();
    foundation.stopRuntimeMaintenance();
    runtimeServices.sysMonitor.stopHeartbeat();
    foundation.maintenanceAutomation.stop();

    await runtimeServices.terminalSidecar.stop().catch((error) => {
      foundation.logRepo.log('warn', 'ZavorthTerminalSidecar', `Failed to shut down remote sidecar: ${error.message || error}`);
    });
    await runtimeServices.aiGatewayGateway.stop().catch((error) => {
      foundation.logRepo.log('warn', 'AIGatewayGateway', `Failed to shut down own gateway: ${error.message || error}`);
    });
    await runtimeServices.aiGatewaySidecar.stop().catch((error) => {
      foundation.logRepo.log('warn', 'AIGatewaySidecar', `Failed to shut down sidecar: ${error.message || error}`);
    });
    await Promise.resolve(surfaceRuntime.discordGateway.stop?.()).catch((error: unknown) => {
      foundation.logRepo.log('warn', 'DiscordGateway', `Failed to shut down Discord gateway: ${describeError(error)}`);
    });
    await Promise.resolve(surfaceRuntime.whatsAppGateway.stop?.()).catch((error: unknown) => {
      foundation.logRepo.log('warn', 'WhatsAppGateway', `Failed to shut down prepared WhatsApp gateway: ${describeError(error)}`);
    });
    await Promise.resolve(surfaceRuntime.instagramGateway.stop?.()).catch((error: unknown) => {
      foundation.logRepo.log('warn', 'InstagramGateway', `Failed to shut down prepared Instagram gateway: ${describeError(error)}`);
    });
    await Promise.resolve(surfaceRuntime.slackGateway.stop?.()).catch((error: unknown) => {
      foundation.logRepo.log('warn', 'SlackGateway', `Failed to shut down prepared Slack gateway: ${describeError(error)}`);
    });
    await Promise.resolve(surfaceRuntime.signalGateway.stop?.()).catch((error: unknown) => {
      foundation.logRepo.log('warn', 'SignalGateway', `Failed to shut down prepared Signal gateway: ${describeError(error)}`);
    });
    await Promise.resolve(surfaceRuntime.imessageGateway.stop?.()).catch((error: unknown) => {
      foundation.logRepo.log('warn', 'IMessageGateway', `Failed to shut down prepared iMessage gateway: ${describeError(error)}`);
    });
    await Promise.resolve(surfaceRuntime.teamsGateway.stop?.()).catch((error: unknown) => {
      foundation.logRepo.log('warn', 'TeamsGateway', `Failed to shut down prepared Teams gateway: ${describeError(error)}`);
    });
    await Promise.resolve(surfaceRuntime.emailGateway.stop?.()).catch((error: unknown) => {
      foundation.logRepo.log('warn', 'EmailGateway', `Failed to shut down prepared Email gateway: ${describeError(error)}`);
    });

    await foundation.mcpRuntime.stop();

    foundation.processLock.release();
    const db = await Database.getInstance();
    db.close();
    process.exit(0);
  };

  // Re-entrancy guard to prevent double-shutdown on rapid Ctrl+C
  let shutdownInProgress = false;
  const guardedShutdown = async (signal: string) => {
    if (shutdownInProgress) {
      logger.info(`\n${signal} received again — forcing exit.`);
      process.exit(1);
    }
    shutdownInProgress = true;
    await shutdown(signal);
  };

  process.on('SIGINT', (sig) => guardedShutdown(sig));
  process.on('SIGTERM', (sig) => guardedShutdown(sig));
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
