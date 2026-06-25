import { CommandParser } from '../../../../gateways/channels/telegram/CommandParser.js';
import { TelegramChannelContractService } from '../../../../gateways/channels/telegram/TelegramChannelContractService.js';
import { EchoOutputStageService } from '../../../../services/EchoOutputStageService.js';
import { BotGatewaySupport } from '../../../../gateways/channels/telegram/bot-gateway/BotGatewaySupport.js';

export type BotGatewaySupportHost = Record<string, any> & {
  botGatewaySupport?: BotGatewaySupport;
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
    dashboardService: gateway.dashboardService || { start: async () => undefined, getUrl: () => '' },
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
    processTextMessage: (ctx, text) => gateway.processTextMessage(ctx, text),
    processGroupCommand: (ctx, text) => gateway.processGroupCommand(ctx, text),
    canUseInteractiveGroupAi: (ctx) => gateway.canUseInteractiveGroupAi(ctx),
    state: {
      supervisedRuntimeNotificationTimer: null,
      supervisedRuntimeNotificationFlushInFlight: false,
      dashboardSurfaceStarted: false,
    },
    getSharedSurfaceCommandService: () => gateway.sharedSurfaceCommandService,
  });

  gateway.botGatewaySupport = created;
  return created;
}
