import { CommandParser } from '../../../../gateways/channels/telegram/CommandParser.js';
import { TelegramChannelContractService } from '../../../../gateways/channels/telegram/TelegramChannelContractService.js';
import { EchoOutputStageService } from '../../../../services/EchoOutputStageService.js';
import { BotGatewaySupport } from '../../../../gateways/channels/telegram/bot-gateway/BotGatewaySupport.js';
import type {
  BotGatewaySupportRuntime,
  BotGatewaySupportState,
} from '../../../../gateways/channels/telegram/bot-gateway/BotGatewaySupportTypes.js';

export type BotGatewaySupportHost = Partial<BotGatewaySupportRuntime> & {
  botGatewaySupport?: BotGatewaySupport;
  audioHandler?: BotGatewaySupportRuntime['echoAudioHandler'];
  zavorthBridgePreferenceStore?: BotGatewaySupportRuntime['echoPreferenceStore'];
  sharedSurfaceCommandService?: BotGatewaySupportState['sharedSurfaceCommandService'];
  getSharedSurfaceCommandService?: () => BotGatewaySupportState['sharedSurfaceCommandService'];
};

export function getOrCreateBotGatewaySupport(gateway: BotGatewaySupportHost): BotGatewaySupport {
  if (gateway.botGatewaySupport) {
    return gateway.botGatewaySupport;
  }

  const created = new BotGatewaySupport({
    bot: gateway.bot,
    logRepo: gateway.logRepo,
    parser: gateway.parser || new CommandParser(),
    priorityCommandService: gateway.priorityCommandService || { handle: async () => false },
    securityLock: gateway.securityLock,
    chainController: gateway.chainController,
    hubController: gateway.hubController,
    opsController: gateway.opsController,
    capabilityController: gateway.capabilityController,
    commandRoutingService: gateway.commandRoutingService,
    groupEventController: gateway.groupEventController,
    mediaController: gateway.mediaController,
    surfaceTaskDispatcher: gateway.surfaceTaskDispatcher || { dispatchTaskMessage: async () => undefined },
    legacyUnifiedGateway: gateway.legacyUnifiedGateway || null,
    agentGateway: gateway.agentGateway || null,
    surfaceIdentityService: gateway.surfaceIdentityService || { linkIdentity: () => undefined },
    workspaceProfileService: gateway.workspaceProfileService || { getProfile: async () => null },
    workspaceCommandService: gateway.workspaceCommandService || { resolveInvocation: () => null },
    telemetryRuntime: gateway.telemetryRuntime || { record: async () => undefined },
    runtimeComposition: gateway.runtimeComposition || {
      getTelemetryRuntime: () => gateway.telemetryRuntime || { record: async () => undefined },
    },
    runtimeDiagnostics: gateway.runtimeDiagnostics || { start: () => undefined },
    runtimeProfileService: gateway.runtimeProfileService || {
      supportsAdvancedRuntime: () => false,
      getProfile: () => 'default',
    },
    capabilityLifecycleService: gateway.capabilityLifecycleService || {
      shouldBootCapability: () => false,
      markCapabilityState: () => null,
    },
    dailyReportService: gateway.dailyReportService || { start: () => undefined },
    zavorthControlService: gateway.zavorthControlService || { start: async () => ({}), getUrl: () => '' },
    lifecycleController: gateway.lifecycleController || { start: async () => undefined },
    supervisedRuntimeNotificationService: gateway.supervisedRuntimeNotificationService || {
      flushPending: async () => ({ delivered: false, skipped: true }),
    },
    researchQueueWorker: gateway.researchQueueWorker || { start: () => undefined },
    julesQueueWorker: gateway.julesQueueWorker || { start: () => undefined },
    chatCleanup: gateway.chatCleanup || { trackMessage: () => undefined },
    hostIdentityService: gateway.hostIdentityService,
    telegramChannelContractService: gateway.telegramChannelContractService || new TelegramChannelContractService(),
    callbackController: gateway.callbackController || { handleCallback: async () => undefined },
    // Certification matrix: Modo Echo — resposta por voz
    echoAudioHandler: gateway.audioHandler || undefined,
    echoPreferenceStore: gateway.zavorthBridgePreferenceStore || undefined,
    echoOutputStage: gateway.echoOutputStage || new EchoOutputStageService({
      audioHandler: gateway.audioHandler || null,
      preferenceStore: gateway.zavorthBridgePreferenceStore || null,
    }),
    processTextMessage: (ctx: any, text: any) => gateway.processTextMessage?.(ctx, text) ?? Promise.resolve(),
    processGroupCommand: (ctx: any, text: any) => gateway.processGroupCommand?.(ctx, text) ?? Promise.resolve(),
    canUseInteractiveGroupAi: (ctx: any) => gateway.canUseInteractiveGroupAi?.(ctx) ?? Promise.resolve(false),
    state: {
      supervisedRuntimeNotificationTimer: null,
      supervisedRuntimeNotificationFlushInFlight: false,
      zavorthControlSurfaceStarted: false,
    },
    getSharedSurfaceCommandService: () =>
      gateway.getSharedSurfaceCommandService?.()
      ?? gateway.sharedSurfaceCommandService
      ?? null,
  } as any);

  gateway.botGatewaySupport = created;
  return created;
}
