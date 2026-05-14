import { config } from '../config/index.js';
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
  supervisor.updateProgress('telegram-gateway');
  console.log('[BOOT] telegram-gateway');
  await surfaceRuntime.botGateway.start();

  await startOptionalGateway({
    capabilityId: 'discord',
    start: async () => {
      await Promise.resolve(surfaceRuntime.discordGateway.start?.()).catch((error: unknown) => {
        const message = `Falha ao iniciar gateway do Discord: ${describeError(error)}`;
        if (
          foundation.discordBootPolicy.shouldFailClosed({
            requiredOnBoot: config.discordRequiredOnBoot,
            nativeTokenConfigured: Boolean(config.discordBotToken),
            bridgeConfigured: config.discordBridgeEnabled,
          })
        ) {
          foundation.logRepo.log('error', 'DiscordGateway', `${message} O boot esta em modo fail-closed.`);
          throw error;
        }

        foundation.logRepo.log('warn', 'DiscordGateway', message);
      });
    },
    activeMessage: 'Gateway do Discord ativo no boot.',
    dormantMessage: `Perfil ${foundation.runtimeProfileService.getProfile()} nao preaquece Discord.`,
    foundation,
  });

  await startOptionalGateway({
    capabilityId: 'whatsapp',
    gatewayName: 'WhatsAppGateway',
    start: () => surfaceRuntime.whatsAppGateway.start?.(),
    activeMessage: 'Gateway do WhatsApp ativo no boot.',
    dormantMessage: `Perfil ${foundation.runtimeProfileService.getProfile()} nao preaquece WhatsApp.`,
    foundation,
  });
  await startOptionalGateway({
    capabilityId: 'instagram',
    gatewayName: 'InstagramGateway',
    start: () => surfaceRuntime.instagramGateway.start?.(),
    activeMessage: 'Gateway do Instagram ativo no boot.',
    dormantMessage: `Perfil ${foundation.runtimeProfileService.getProfile()} nao preaquece Instagram.`,
    foundation,
  });
  await startOptionalGateway({
    capabilityId: 'slack',
    gatewayName: 'SlackGateway',
    start: () => surfaceRuntime.slackGateway.start?.(),
    activeMessage: 'Gateway do Slack ativo no boot.',
    dormantMessage: `Perfil ${foundation.runtimeProfileService.getProfile()} nao preaquece Slack.`,
    foundation,
  });
  await startOptionalGateway({
    capabilityId: 'signal',
    gatewayName: 'SignalGateway',
    start: () => surfaceRuntime.signalGateway.start?.(),
    activeMessage: 'Gateway do Signal ativo no boot.',
    dormantMessage: `Perfil ${foundation.runtimeProfileService.getProfile()} nao preaquece Signal.`,
    foundation,
  });
  await startOptionalGateway({
    capabilityId: 'imessage',
    gatewayName: 'IMessageGateway',
    start: () => surfaceRuntime.imessageGateway.start?.(),
    activeMessage: 'Gateway do iMessage ativo no boot.',
    dormantMessage: `Perfil ${foundation.runtimeProfileService.getProfile()} nao preaquece iMessage.`,
    foundation,
  });
  await startOptionalGateway({
    capabilityId: 'teams',
    gatewayName: 'TeamsGateway',
    start: () => surfaceRuntime.teamsGateway.start?.(),
    activeMessage: 'Gateway do Teams ativo no boot.',
    dormantMessage: `Perfil ${foundation.runtimeProfileService.getProfile()} nao preaquece Teams.`,
    foundation,
  });
  await startOptionalGateway({
    capabilityId: 'email',
    gatewayName: 'EmailGateway',
    start: () => surfaceRuntime.emailGateway.start?.(),
    activeMessage: 'Gateway do Email ativo no boot.',
    dormantMessage: `Perfil ${foundation.runtimeProfileService.getProfile()} nao preaquece Email.`,
    foundation,
  });

  const runtimeChannelSnapshot = surfaceRuntime.sharedGatewayChannelRegistry.buildSnapshot();
  console.log('Mesh operacional de canais no runtime atual:');
  for (const channel of runtimeChannelSnapshot.channels) {
    console.log(`- ${channel.id}: ${channel.readiness} (${channel.transport})`);
  }

  foundation.logRepo.log(
    'info',
    'Bootstrap',
    `Mesh operacional de canais: ${runtimeChannelSnapshot.summary.ready} pronto(s), ${runtimeChannelSnapshot.summary.partial} parcial(is), ${runtimeChannelSnapshot.summary.planned} planejado(s) e ${runtimeChannelSnapshot.summary.disabled} desabilitado(s).`,
  );
  for (const channel of runtimeChannelSnapshot.channels) {
    foundation.logRepo.log(
      channel.readiness === 'ready' ? 'info' : channel.readiness === 'partial' ? 'warn' : 'info',
      'Bootstrap',
      `Mesh canal ${channel.id}: ${channel.readiness}/${channel.transport}. ${channel.notes.join(' ')}`,
    );
  }

  if (foundation.capabilityLifecycleService.shouldBootCapability('maintenance-automation')) {
    setTimeout(() => {
      foundation.maintenanceAutomation.start();
      foundation.capabilityLifecycleService.markCapabilityState(
        'maintenance-automation',
        'active',
        'Automacao recorrente iniciada apos o bootstrap principal.',
      );
      foundation.logRepo.log('info', 'MaintenanceAutomationService', 'Automacao recorrente iniciada apos o bootstrap principal.');
    }, 30_000).unref();
  } else {
    foundation.capabilityLifecycleService.markCapabilityState(
      'maintenance-automation',
      'dormant',
      `Perfil ${foundation.runtimeProfileService.getProfile()} manteve a manutencao recorrente desativada no boot.`,
    );
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
      `Falha ao iniciar gateway preparado de ${params.capabilityId}: ${describeError(error)}`,
    );
  });
  params.foundation.capabilityLifecycleService.markCapabilityState(params.capabilityId, 'active', params.activeMessage);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
