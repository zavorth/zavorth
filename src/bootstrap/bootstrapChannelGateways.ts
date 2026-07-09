import { config } from '../config/index.js';
import { logger } from '../logger.js';
import type {
  BootstrapFoundation,
  BootstrapSupervisor,
  BootstrapSurfaceRuntime,
} from './bootstrapTypes.js';

export async function startChannelGateways(
  foundation: BootstrapFoundation,
  surfaceRuntime: BootstrapSurfaceRuntime,
  supervisor: BootstrapSupervisor,
): Promise<void> {
  await startOptionalGateway({
    capabilityId: 'telegram',
    start: async () => {
      supervisor.updateProgress('telegram-gateway');
      logger.info('[BOOT] telegram-gateway');
      await surfaceRuntime.botGateway.start();
    },
    activeMessage: 'Telegram gateway active on boot.',
    dormantMessage: `Profile ${foundation.runtimeProfileService.getProfile()} does not warm up Telegram.`,
    foundation,
  });

  await startOptionalGateway({
    capabilityId: 'discord',
    start: async () => {
      await Promise.resolve(surfaceRuntime.discordGateway.start?.()).catch((error: unknown) => {
        const message = `Failed to start Discord gateway: ${describeError(error)}`;
        if (
          foundation.discordBootPolicy.shouldFailClosed({
            requiredOnBoot: config.discordRequiredOnBoot,
            nativeTokenConfigured: Boolean(config.discordBotToken),
            bridgeConfigured: config.discordBridgeEnabled,
          })
        ) {
          foundation.logRepo.log('error', 'DiscordGateway', `${message} Boot is running in fail-closed mode.`);
          throw error;
        }

        foundation.logRepo.log('warn', 'DiscordGateway', message);
      });
    },
    activeMessage: 'Discord gateway active on boot.',
    dormantMessage: `Profile ${foundation.runtimeProfileService.getProfile()} does not prewarm Discord.`,
    foundation,
  });

  await startOptionalGateway({
    capabilityId: 'whatsapp',
    gatewayName: 'WhatsAppGateway',
    start: () => surfaceRuntime.whatsAppGateway.start?.(),
    activeMessage: 'WhatsApp gateway active on boot.',
    dormantMessage: `Profile ${foundation.runtimeProfileService.getProfile()} does not prewarm WhatsApp.`,
    foundation,
  });
  await startOptionalGateway({
    capabilityId: 'instagram',
    gatewayName: 'InstagramGateway',
    start: () => surfaceRuntime.instagramGateway.start?.(),
    activeMessage: 'Instagram gateway active on boot.',
    dormantMessage: `Profile ${foundation.runtimeProfileService.getProfile()} does not prewarm Instagram.`,
    foundation,
  });
  await startOptionalGateway({
    capabilityId: 'slack',
    gatewayName: 'SlackGateway',
    start: () => surfaceRuntime.slackGateway.start?.(),
    activeMessage: 'Slack gateway active on boot.',
    dormantMessage: `Profile ${foundation.runtimeProfileService.getProfile()} does not prewarm Slack.`,
    foundation,
  });
  await startOptionalGateway({
    capabilityId: 'signal',
    gatewayName: 'SignalGateway',
    start: () => surfaceRuntime.signalGateway.start?.(),
    activeMessage: 'Signal gateway active on boot.',
    dormantMessage: `Profile ${foundation.runtimeProfileService.getProfile()} does not prewarm Signal.`,
    foundation,
  });
  await startOptionalGateway({
    capabilityId: 'imessage',
    gatewayName: 'IMessageGateway',
    start: () => surfaceRuntime.imessageGateway.start?.(),
    activeMessage: 'iMessage gateway active on boot.',
    dormantMessage: `Profile ${foundation.runtimeProfileService.getProfile()} does not prewarm iMessage.`,
    foundation,
  });
  await startOptionalGateway({
    capabilityId: 'teams',
    gatewayName: 'TeamsGateway',
    start: () => surfaceRuntime.teamsGateway.start?.(),
    activeMessage: 'Teams gateway active on boot.',
    dormantMessage: `Profile ${foundation.runtimeProfileService.getProfile()} does not prewarm Teams.`,
    foundation,
  });
  await startOptionalGateway({
    capabilityId: 'email',
    gatewayName: 'EmailGateway',
    start: () => surfaceRuntime.emailGateway.start?.(),
    activeMessage: 'Email gateway active on boot.',
    dormantMessage: `Profile ${foundation.runtimeProfileService.getProfile()} does not prewarm Email.`,
    foundation,
  });

  const runtimeChannelSnapshot = surfaceRuntime.sharedGatewayChannelRegistry.buildSnapshot();
  logger.info('Mesh operacional de canais no runtime atual:');
  for (const channel of runtimeChannelSnapshot.channels) {
    logger.info(`- ${channel.id}: ${channel.readiness} (${channel.transport})`);
  }

  foundation.logRepo.log(
    'info',
    'Bootstrap',
    `Operational channel mesh: ${runtimeChannelSnapshot.summary.ready} ready, ${runtimeChannelSnapshot.summary.partial} partial, ${runtimeChannelSnapshot.summary.planned} planned, and ${runtimeChannelSnapshot.summary.disabled} disabled.`,
  );
  for (const channel of runtimeChannelSnapshot.channels) {
    foundation.logRepo.log(
      channel.readiness === 'ready' ? 'info' : channel.readiness === 'partial' ? 'warn' : 'info',
      'Bootstrap',
      `Mesh channel ${channel.id}: ${channel.readiness}/${channel.transport}. ${channel.notes.join(' ')}`,
    );
  }

  if (foundation.capabilityLifecycleService.shouldBootCapability('maintenance-automation')) {
    setTimeout(() => {
      foundation.maintenanceAutomation.start();
      foundation.capabilityLifecycleService.markCapabilityState(
        'maintenance-automation',
        'active',
        'Recurring automation started after the main bootstrap.',
      );
      foundation.logRepo.log('info', 'MaintenanceAutomationService', 'Recurring automation started after the main bootstrap.');
    }, 30_000).unref();
  } else {
    foundation.capabilityLifecycleService.markCapabilityState(
      'maintenance-automation',
      'dormant',
      `Profile ${foundation.runtimeProfileService.getProfile()} kept recurring maintenance disabled on boot.`,
    );
  }

  // Start Outbox Retry Service daemon
  try {
    const { ChannelGatewayFactory } = await import('../gateways/ChannelGatewayFactory.js');
    const { OutboxRetryService } = await import('../services/OutboxRetryService.js');
    const gatewayRegistry = ChannelGatewayFactory.createAll();
    const outboxRetryService = OutboxRetryService.getInstance(gatewayRegistry);
    outboxRetryService.start();
    foundation.logRepo.log('info', 'OutboxRetryService', 'Outbox retry daemon started successfully.');
  } catch (error: any) { const err = error; const e = error;
    foundation.logRepo.log('warn', 'OutboxRetryService', `Failed to start outbox retry daemon: ${describeError(error)}`);
  }

  supervisor.markBootReady();
}

async function startOptionalGateway(params: {
  capabilityId: string;
  foundation: BootstrapFoundation;
  start(): Promise<void> | void;
  activeMessage: string;
  dormantMessage: string;
  gatewayName?: string;
}): Promise<void> {
  if (!params.foundation.capabilityLifecycleService.shouldBootCapability(params.capabilityId)) {
    params.foundation.capabilityLifecycleService.markCapabilityState(
      params.capabilityId,
      'dormant',
      params.dormantMessage,
    );
    return;
  }

  await Promise.resolve(params.start()).catch((error: unknown) => {
    params.foundation.logRepo.log(
      'warn',
      params.gatewayName ?? `${params.capabilityId}Gateway`,
      `Failed to start prepared gateway for ${params.capabilityId}: ${describeError(error)}`,
    );
  });
  params.foundation.capabilityLifecycleService.markCapabilityState(params.capabilityId, 'active', params.activeMessage);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
