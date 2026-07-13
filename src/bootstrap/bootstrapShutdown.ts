import path from 'node:path';
import { Database } from '../storage/Database.js';
import type {
  BootstrapFoundation,
  BootstrapRuntimeServices,
  BootstrapSupervisor,
  BootstrapSurfaceRuntime,
} from './bootstrapTypes.js';
import { logger } from '../logger.js';
import {
  CronDrainService,
  formatCronDrainForLog,
} from '../services/CronDrainService.js';

export function registerShutdownHandlers(
  foundation: BootstrapFoundation,
  runtimeServices: BootstrapRuntimeServices,
  surfaceRuntime: BootstrapSurfaceRuntime,
  supervisor: BootstrapSupervisor,
): void {
  const shutdown = async (signal?: string) => {
    foundation.logRepo.log('info', 'System', `Encerrando Zavorth V2${signal ? ` (${signal})` : ''}...`);

    try {
      const { runPluginOsHook } = await import('../services/PluginOsHookPipelineAccess.js');
      await runPluginOsHook({
        event: 'shutdown.before',
        context: { signal: signal || null, source: 'bootstrapShutdown' },
      });
    } catch {
      /* ignore */
    }

    // Cron drain visibility before tearing down runtimes
    try {
      const drainTimeoutMs = Math.max(
        0,
        Number(process.env.ZAVORTH_CRON_DRAIN_TIMEOUT_MS || 5_000) || 5_000,
      );
      const cronDrain = new CronDrainService({
        runtimeDir: path.join(process.cwd(), 'data', 'runtime'),
      });
      const before = cronDrain.buildSnapshot();
      foundation.logRepo.log('info', 'CronDrain', formatCronDrainForLog(before));
      if (before.processDueInFlight > 0 || before.dueCount > 0) {
        const result = await cronDrain.drainForShutdown({ timeoutMs: drainTimeoutMs });
        foundation.logRepo.log(
          result.timedOut ? 'warn' : 'info',
          'CronDrain',
          result.summary,
        );
      }
    } catch (error: unknown) {
      foundation.logRepo.log(
        'warn',
        'CronDrain',
        `Cron drain skipped: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

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
    try {
      const { runPluginOsHook } = await import('../services/PluginOsHookPipelineAccess.js');
      await runPluginOsHook({
        event: 'shutdown.after',
        context: { signal: signal || null, source: 'bootstrapShutdown' },
      });
    } catch {
      /* ignore */
    }
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
