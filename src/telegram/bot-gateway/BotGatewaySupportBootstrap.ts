import { LogRepository } from "../../storage/LogRepository.js";
import { TelegramChannelContractService } from "../TelegramChannelContractService.js";
import { BotGatewaySupport } from "./BotGatewaySupport.js";

export function createBotGatewaySupport(
  gateway: any,
  logRepo: LogRepository,
): BotGatewaySupport {
  return new BotGatewaySupport({
    bot: gateway.bot,
    logRepo,
    parser: gateway.parser,
    priorityCommandService: gateway.priorityCommandService || {
      handle: async () => false,
    },
    securityLock: gateway.securityLock,
    chainController: gateway.chainController,
    hubController: gateway.hubController,
    opsController: gateway.opsController,
    capabilityController: gateway.capabilityController,
    commandRoutingService: gateway.commandRoutingService,
    groupEventController: gateway.groupEventController,
    mediaController: gateway.mediaController,
    surfaceTaskDispatcher: gateway.surfaceTaskDispatcher || {
      dispatchTaskMessage: async () => undefined,
    },
    legacyUnifiedGateway: gateway.legacyUnifiedGateway || null,
    agentGateway: gateway.agentGateway || null,
    surfaceIdentityService: gateway.surfaceIdentityService || {
      linkIdentity: () => undefined,
    },
    workspaceProfileService: gateway.workspaceProfileService || {
      getProfile: async () => null,
    },
    workspaceCommandService: gateway.workspaceCommandService || {
      resolveInvocation: () => null,
    },
    telemetryRuntime: gateway.telemetryRuntime || {
      record: async () => undefined,
    },
    runtimeComposition: gateway.runtimeComposition || {
      getTelemetryRuntime: () =>
        gateway.telemetryRuntime || { record: async () => undefined },
    },
    runtimeDiagnostics: gateway.runtimeDiagnostics || {
      start: () => undefined,
    },
    runtimeProfileService: gateway.runtimeProfileService || {
      supportsAdvancedRuntime: () => false,
      getProfile: () => "default",
    },
    capabilityLifecycleService: gateway.capabilityLifecycleService || {
      shouldBootCapability: () => false,
      markCapabilityState: () => null,
    },
    dailyReportService: gateway.dailyReportService || {
      start: () => undefined,
    },
    dashboardService: gateway.dashboardService || {
      start: async () => undefined,
      getUrl: () => "",
    },
    lifecycleController: gateway.lifecycleController || {
      start: async () => undefined,
    },
    supervisedRuntimeNotificationService:
      gateway.supervisedRuntimeNotificationService || {
        flushPending: async () => ({ delivered: false, skipped: true }),
      },
    researchQueueWorker: gateway.researchQueueWorker || {
      start: () => undefined,
    },
    julesQueueWorker: gateway.julesQueueWorker || { start: () => undefined },
    chatCleanup: gateway.chatCleanup || { trackMessage: () => undefined },
    hostIdentityService: gateway.hostIdentityService,
    telegramChannelContractService:
      gateway.telegramChannelContractService ||
      new TelegramChannelContractService(),
    callbackController: gateway.callbackController || {
      handleCallback: async () => undefined,
    },
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
}
