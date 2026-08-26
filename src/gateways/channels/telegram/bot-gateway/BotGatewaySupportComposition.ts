import { ChannelCommandParser } from '../../../../channels/commands/ChannelCommandParser.js';
import { TelegramChannelContractService } from '../../../../gateways/channels/telegram/TelegramChannelContractService.js';
import { EchoOutputStageService } from '../../../../services/EchoOutputStageService.js';
import { HostIdentityService } from '../../../../services/HostIdentityService.js';
import { LogRepository } from '../../../../storage/LogRepository.js';
import { BotGatewaySupport } from '../../../../gateways/channels/telegram/bot-gateway/BotGatewaySupport.js';
import type { Context } from 'grammy';
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

type BotGatewayCompositionInput = Pick<BotGatewaySupportRuntime, 'bot' | 'parser' | 'hostIdentityService'> &
  Required<Pick<BotGatewaySupportRuntime, 'processTextMessage' | 'processGroupCommand' | 'canUseInteractiveGroupAi'>> &
  Partial<Omit<BotGatewaySupportRuntime, 'bot' | 'parser' | 'hostIdentityService' | 'processTextMessage' | 'processGroupCommand' | 'canUseInteractiveGroupAi'>>;

type SharedSupportDefaults = Pick<
  BotGatewaySupportRuntime,
  | 'priorityCommandService'
  | 'surfaceTaskDispatcher'
  | 'legacyUnifiedGateway'
  | 'agentGateway'
  | 'surfaceIdentityService'
  | 'workspaceProfileService'
  | 'workspaceCommandService'
  | 'telemetryRuntime'
  | 'runtimeComposition'
  | 'runtimeDiagnostics'
  | 'runtimeProfileService'
  | 'capabilityLifecycleService'
  | 'dailyReportService'
  | 'lifecycleController'
  | 'supervisedRuntimeNotificationService'
  | 'researchQueueWorker'
  | 'julesQueueWorker'
  | 'chatCleanup'
  | 'callbackController'
>;

function resolveSharedSupportDefaults(
  gateway: Partial<BotGatewaySupportRuntime>,
): SharedSupportDefaults {
  return {
    priorityCommandService: gateway.priorityCommandService || { handle: async () => false },
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
    lifecycleController: gateway.lifecycleController || { start: async () => undefined },
    supervisedRuntimeNotificationService: gateway.supervisedRuntimeNotificationService || {
      flushPending: async () => ({ delivered: false, skipped: true }),
    },
    researchQueueWorker: gateway.researchQueueWorker || { start: () => undefined },
    julesQueueWorker: gateway.julesQueueWorker || { start: () => undefined },
    chatCleanup: gateway.chatCleanup || { trackMessage: () => undefined },
    callbackController: gateway.callbackController || { handleCallback: async () => undefined },
  };
}

export function createBotGatewaySupport(
  gateway: BotGatewayCompositionInput,
  logRepo: LogRepository,
): BotGatewaySupport {
  return new BotGatewaySupport({
    ...resolveSharedSupportDefaults(gateway),
    bot: gateway.bot,
    logRepo,
    parser: gateway.parser,
    securityLock: gateway.securityLock,
    chainController: gateway.chainController,
    hubController: gateway.hubController,
    opsController: gateway.opsController,
    capabilityController: gateway.capabilityController,
    commandRoutingService: gateway.commandRoutingService,
    groupEventController: gateway.groupEventController,
    mediaController: gateway.mediaController,
    hostIdentityService: gateway.hostIdentityService,
    telegramChannelContractService:
      gateway.telegramChannelContractService ||
      new TelegramChannelContractService(),
    zavorthControlService: gateway.zavorthControlService || {
      start: async () => undefined,
      getUrl: () => '',
    },
    processTextMessage: (ctx: Context, text: string) => gateway.processTextMessage(ctx, text),
    processGroupCommand: (ctx: Context, text: string) => gateway.processGroupCommand(ctx, text),
    canUseInteractiveGroupAi: (ctx: Context) => gateway.canUseInteractiveGroupAi(ctx),
    state: {
      supervisedRuntimeNotificationTimer: null,
      supervisedRuntimeNotificationFlushInFlight: false,
      zavorthControlSurfaceStarted: false,
    },
    getSharedSurfaceCommandService: () =>
      gateway.getSharedSurfaceCommandService?.()
      ?? (gateway as { sharedSurfaceCommandService?: BotGatewaySupportState['sharedSurfaceCommandService'] }).sharedSurfaceCommandService
      ?? null,
  } as BotGatewaySupportRuntime);
}

export function getOrCreateBotGatewaySupport(gateway: BotGatewaySupportHost): BotGatewaySupport {
  if (gateway.botGatewaySupport) {
    return gateway.botGatewaySupport;
  }

  const created = new BotGatewaySupport({
    // Test fixtures compose partial gateways without a live bot instance; message paths
    // require one, but support construction itself must not fail without it.
    ...resolveSharedSupportDefaults(gateway),
    bot: gateway.bot || (null as unknown as import('grammy').Bot),
    logRepo: gateway.logRepo || { log: () => undefined },
    parser: gateway.parser || new ChannelCommandParser(),
    securityLock: gateway.securityLock || { isLocked: () => false, isCommandAllowedWhenLocked: () => true },
    chainController: gateway.chainController || { handleCommandChain: async () => undefined },
    hubController: gateway.hubController || { handleStartCommand: async () => undefined },
    opsController: gateway.opsController || { handleStatus: async () => undefined },
    capabilityController: gateway.capabilityController || { handleCommand: async () => false },
    commandRoutingService: gateway.commandRoutingService || {
      dispatchPrivateCommand: async () => false,
      dispatchGroupCommand: async () => false,
    },
    groupEventController: gateway.groupEventController || {
      processAntiSpam: async () => false,
      processMessageFilter: async () => false,
      trackMessage: async () => undefined,
      handleNewMembers: async () => undefined,
      handleLeftMember: async () => undefined,
    },
    mediaController: gateway.mediaController || {
      handlePhoto: async () => undefined,
      handleVoice: async () => undefined,
      handleVideo: async () => undefined,
      handleDocument: async () => undefined,
    },
    hostIdentityService: gateway.hostIdentityService || new HostIdentityService(),
    telegramChannelContractService: gateway.telegramChannelContractService || new TelegramChannelContractService(),
    zavorthControlService: gateway.zavorthControlService || { start: async () => ({}), getUrl: () => '' },
    // Certification matrix: Echo Mode — voice response
    echoAudioHandler: gateway.audioHandler || undefined,
    echoPreferenceStore: gateway.zavorthBridgePreferenceStore || undefined,
    echoOutputStage: gateway.echoOutputStage || new EchoOutputStageService({
      audioHandler: gateway.audioHandler || null,
      preferenceStore: gateway.zavorthBridgePreferenceStore || null,
    }),
    processTextMessage: (ctx: Context, text: string) => gateway.processTextMessage?.(ctx, text) ?? Promise.resolve(),
    processGroupCommand: (ctx: Context, text: string) => gateway.processGroupCommand?.(ctx, text) ?? Promise.resolve(),
    canUseInteractiveGroupAi: (ctx: Context) => gateway.canUseInteractiveGroupAi?.(ctx) ?? Promise.resolve(false),
    state: {
      supervisedRuntimeNotificationTimer: null,
      supervisedRuntimeNotificationFlushInFlight: false,
      zavorthControlSurfaceStarted: false,
    },
    getSharedSurfaceCommandService: () =>
      gateway.getSharedSurfaceCommandService?.()
      ?? gateway.sharedSurfaceCommandService
      ?? null,
  });

  gateway.botGatewaySupport = created;
  return created;
}
