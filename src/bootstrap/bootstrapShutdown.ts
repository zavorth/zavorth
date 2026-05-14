import { Database } from '../storage/Database.js';
import type {
  BootstrapFoundation,
  BootstrapRuntimeServices,
  BootstrapSupervisor,
  BootstrapSurfaceRuntime,
} from './bootstrapTypes.js';

export function registerShutdownHandlers(
  foundation: BootstrapFoundation,
  runtimeServices: BootstrapRuntimeServices,
  surfaceRuntime: BootstrapSurfaceRuntime,
  supervisor: BootstrapSupervisor,
): void {
  const shutdown = async () => {
    foundation.logRepo.log('info', 'System', 'Encerrando Zavorth V2...');
    supervisor.clear();
    foundation.stopRuntimeMaintenance();
    runtimeServices.sysMonitor.stopHeartbeat();
    foundation.maintenanceAutomation.stop();

    await runtimeServices.terminalSidecar.stop().catch((error) => {
      foundation.logRepo.log('warn', 'ZavorthTerminalSidecar', `Falha ao encerrar sidecar remoto: ${error.message || error}`);
    });
    await runtimeServices.aiGatewayGateway.stop().catch((error) => {
      foundation.logRepo.log('warn', 'AIGatewayGateway', `Falha ao encerrar gateway proprio: ${error.message || error}`);
    });
    await runtimeServices.aiGatewaySidecar.stop().catch((error) => {
      foundation.logRepo.log('warn', 'AIGatewaySidecar', `Falha ao encerrar sidecar: ${error.message || error}`);
    });
    await Promise.resolve(surfaceRuntime.discordGateway.stop?.()).catch((error: unknown) => {
      foundation.logRepo.log('warn', 'DiscordGateway', `Falha ao encerrar gateway do Discord: ${describeError(error)}`);
    });
    await Promise.resolve(surfaceRuntime.whatsAppGateway.stop?.()).catch((error: unknown) => {
      foundation.logRepo.log('warn', 'WhatsAppGateway', `Falha ao encerrar gateway preparado de WhatsApp: ${describeError(error)}`);
    });
    await Promise.resolve(surfaceRuntime.instagramGateway.stop?.()).catch((error: unknown) => {
      foundation.logRepo.log('warn', 'InstagramGateway', `Falha ao encerrar gateway preparado de Instagram: ${describeError(error)}`);
    });
    await Promise.resolve(surfaceRuntime.slackGateway.stop?.()).catch((error: unknown) => {
      foundation.logRepo.log('warn', 'SlackGateway', `Falha ao encerrar gateway preparado de Slack: ${describeError(error)}`);
    });
    await Promise.resolve(surfaceRuntime.signalGateway.stop?.()).catch((error: unknown) => {
      foundation.logRepo.log('warn', 'SignalGateway', `Falha ao encerrar gateway preparado de Signal: ${describeError(error)}`);
    });
    await Promise.resolve(surfaceRuntime.imessageGateway.stop?.()).catch((error: unknown) => {
      foundation.logRepo.log('warn', 'IMessageGateway', `Falha ao encerrar gateway preparado de iMessage: ${describeError(error)}`);
    });
    await Promise.resolve(surfaceRuntime.teamsGateway.stop?.()).catch((error: unknown) => {
      foundation.logRepo.log('warn', 'TeamsGateway', `Falha ao encerrar gateway preparado de Teams: ${describeError(error)}`);
    });
    await Promise.resolve(surfaceRuntime.emailGateway.stop?.()).catch((error: unknown) => {
      foundation.logRepo.log('warn', 'EmailGateway', `Falha ao encerrar gateway preparado de Email: ${describeError(error)}`);
    });

    await foundation.mcpRuntime.stop();

    foundation.processLock.release();
    const db = await Database.getInstance();
    db.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
