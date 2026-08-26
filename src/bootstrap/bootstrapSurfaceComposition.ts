import { config } from '../config/index.js';
import type { PlatformGatewayContract } from '../contracts/PlatformContract.js';
import { CoreOrchestrator } from '../core/CoreOrchestrator.js';
import { InternalSurfaceApiService } from '../api/internal/InternalSurfaceApiService.js';
import { WorkspaceOperationalMemoryService } from '../runtime/context/WorkspaceOperationalMemoryService.js';
import { ZavorthSessionToolsService } from '../runtime/sessions/ZavorthSessionToolsService.js';
import { GatewaySessionReadModelService } from '../runtime/sessions/GatewaySessionReadModelService.js';
import { GatewaySessionService } from '../runtime/sessions/GatewaySessionService.js';
import { GatewaySessionStoreService } from '../runtime/sessions/GatewaySessionStoreService.js';
import { GatewaySessionToolsService } from '../runtime/sessions/GatewaySessionToolsService.js';
import type { BotGateway } from '../gateways/channels/telegram/BotGateway.js';
import {
  DiscordBridgeGateway,
  DiscordGateway,
  EmailGateway,
  InstagramGateway,
  IMessageGateway,
  SignalGateway,
  SlackGateway,
  TeamsGateway,
  WhatsAppGateway,
} from '../adapters/channels/index.js';
import { ZavorthGatewayService } from '../services/ZavorthGatewayService.js';
import { ToolRuntimeDecisionPort } from '../services/approvals/ports/ToolRuntimeDecisionPort.js';

import { GoalLoopStatusProjectionService } from '../services/GoalLoopStatusProjectionService.js';
import type { BroadcastCapableGateway } from '../services/ZavorthChannelActionService.js';
import { ZavorthMemoryPlaneService } from '../services/ZavorthMemoryPlaneService.js';
import { ZavorthSessionPlaneService } from '../services/ZavorthSessionPlaneService.js';
import { ZavorthToolSurfaceService } from '../services/ZavorthToolSurfaceService.js';
import { DiscordSurfacePolicyService } from '../services/DiscordSurfacePolicyService.js';
import { GatewayChannelRegistryService } from '../services/GatewayChannelRegistryService.js';
import { GatewayChannelRouterService } from '../services/GatewayChannelRouterService.js';
import {
  DiscordRuntimeChannelAdapter,
  EmailRuntimeChannelAdapter,
  IMessageRuntimeChannelAdapter,
  InstagramRuntimeChannelAdapter,
  SignalRuntimeChannelAdapter,
  SlackRuntimeChannelAdapter,
  TelegramRuntimeChannelAdapter,
  TeamsRuntimeChannelAdapter,
  WhatsAppRuntimeChannelAdapter,
} from '../services/GatewayRuntimeChannelAdapters.js';
import type { RuntimeAwareChannelGateway } from '../services/GatewayRuntimeChannelAdapters.js';
import { MemoryService } from '../services/MemoryService.js';
import { LocalMemoryBackend } from '../services/memory/LocalMemoryBackend.js';
import {
  MemoryWriteWorker,
  registerSharedMemoryWriteWorker,
} from '../services/memory/MemoryWriteWorker.js';
import { RuntimeDiagnosticsService } from '../services/RuntimeDiagnosticsService.js';
import { SelfModificationCommandService } from '../services/SelfModificationCommandService.js';
import { SharedSurfaceCommandService } from '../services/SharedSurfaceCommandService.js';
import type {
  BootstrapFoundation,
  BootstrapSurfaceRuntime,
} from './bootstrapTypes.js';
import type { SharedSurfaceCommandServiceDeps } from '../domain/surface/presentation/shared-surface/factory/SharedSurfaceCommandServiceFactory.js';

export function composeSurfaceRuntime(
  foundation: BootstrapFoundation,
  botGateway: BotGateway,
): BootstrapSurfaceRuntime {
  const discordSurfacePolicyService = new DiscordSurfacePolicyService();
  const coreOrchestrator = new CoreOrchestrator(foundation.logRepo, discordSurfacePolicyService);
  const sharedRuntimeDiagnostics = new RuntimeDiagnosticsService(foundation.taskManager, foundation.logRepo);
  const sharedGatewaySessionStore = new GatewaySessionStoreService();
  const sharedGatewaySessionService = new GatewaySessionService({
    taskManager: foundation.taskManager,
    permissionService: botGateway.getPermissionService(),
  });
  const sharedGatewaySessionReadModel = new GatewaySessionReadModelService(sharedGatewaySessionService, {
    sessionStoreService: sharedGatewaySessionStore,
  });
  const sharedGatewayChannelRegistry = new GatewayChannelRegistryService({
    hasDispatcher: true,
    canSpawnWeb: false,
  });
  const sharedGatewayChannelRouter = new GatewayChannelRouterService({
    sessionStoreService: sharedGatewaySessionStore,
    sessionReadModelService: sharedGatewaySessionReadModel,
    channelRegistryService: sharedGatewayChannelRegistry,
    surfaceTaskDispatcher: botGateway.getSurfaceTaskDispatcher(),
  });
  const sharedMemoryService = new MemoryService();
  const sharedGatewaySessionTools = new GatewaySessionToolsService(sharedGatewaySessionService, {
    sessionStoreService: sharedGatewaySessionStore,
    sessionReadModelService: sharedGatewaySessionReadModel,
    channelRouterService: sharedGatewayChannelRouter,
  });
  const sharedSessionToolsService = new ZavorthSessionToolsService({
    taskManager: foundation.taskManager,
    gatewaySessionReadModelService: sharedGatewaySessionReadModel,
  });
  const sharedSessionPlaneService = new ZavorthSessionPlaneService({
    sessionToolsService: sharedSessionToolsService,
    gatewaySessionToolsService: sharedGatewaySessionTools,
    sessionStoreService: sharedGatewaySessionStore,
    channelRegistryService: sharedGatewayChannelRegistry,
  });
  const sharedMemoryPlaneService = new ZavorthMemoryPlaneService({
    gatewaySessionReadModelService: sharedGatewaySessionReadModel,
    memoryService: sharedMemoryService,
    workspaceOperationalMemoryService: new WorkspaceOperationalMemoryService(
      foundation.taskManager,
      botGateway.getPermissionService(),
    ),
  });
  const sharedToolSurfaceService = new ZavorthToolSurfaceService({
    sessionToolsService: sharedSessionToolsService,
    runtimeToolCatalogService: foundation.runtimeToolCatalogService,
  });
  const sharedGatewayService = new ZavorthGatewayService({
    memoryPlaneService: sharedMemoryPlaneService,
    sessionToolsService: sharedSessionToolsService,
    toolSurfaceService: sharedToolSurfaceService,
    goalLoopStatusService: new GoalLoopStatusProjectionService({
      taskStorePath: `${config.runtimeDir}/task-plane.json`,
      goalStorePath: `${config.runtimeDir}/goal-plane.json`,
      stateDbPath: config.dbPath,
      daemonId: 'bootstrap-goal-loop-daemon',
      daemonEnabled: config.goalLoopDaemonEnabled,
      intervalMs: config.goalLoopDaemonIntervalMs,
      leaseMs: config.goalLoopDaemonLeaseMs,
      staleAfterMs: config.goalLoopDaemonStaleAfterMs,
    }),
  });
  const sharedSelfModificationCommandService = new SelfModificationCommandService();
  foundation.agentGateway.attachSelfModificationService(sharedSelfModificationCommandService);
  const surfaceDecisionSpine = botGateway.getSurfaceDecisionSpine();
  surfaceDecisionSpine.registerDecisionPort(
    'tool-runtime',
    new ToolRuntimeDecisionPort(botGateway.getEchoApprovalController()),
  );
  const sharedSurfaceCommandService = new SharedSurfaceCommandService({
    runtimeDiagnostics: sharedRuntimeDiagnostics,
    taskManager: foundation.taskManager as unknown as SharedSurfaceCommandServiceDeps['taskManager'],
    memoryPlaneService: sharedMemoryPlaneService,
    sessionPlaneService: sharedSessionPlaneService,
    toolSurfaceService: sharedToolSurfaceService,
    gatewayService: sharedGatewayService,
    discordSurfacePolicyService,
    permissionService: botGateway.getPermissionService(),
    taskApprovalController: botGateway.getPermissionController() as unknown as SharedSurfaceCommandServiceDeps['taskApprovalController'],
    taskExecutionController: botGateway.getExecutionController() as unknown as SharedSurfaceCommandServiceDeps['taskExecutionController'],
    surfaceTaskDispatcher: botGateway.getSurfaceTaskDispatcher(),
    selfModificationCommandService: sharedSelfModificationCommandService,
    formatPermissionCreatedMessage: botGateway.formatPermissionCreatedMessage.bind(botGateway) as unknown as SharedSurfaceCommandServiceDeps['formatPermissionCreatedMessage'],
    buildPermissionKeyboard: botGateway.buildPermissionKeyboard.bind(botGateway) as unknown as SharedSurfaceCommandServiceDeps['buildPermissionKeyboard'],
    workflowController: botGateway.getWorkflowController() as unknown as SharedSurfaceCommandServiceDeps['workflowController'],
    opsController: botGateway.getOpsController(),
    surfaceDecisionSpine,
  });
  const sharedSurfaceApi = new InternalSurfaceApiService({
    commandService: sharedSurfaceCommandService,
  });

  botGateway.attachSharedSurfaceCommandService(sharedSurfaceApi);
  coreOrchestrator.attachSurfaceTaskDispatcher(botGateway.getSurfaceTaskDispatcher());
  coreOrchestrator.attachSharedSurfaceCommandService(sharedSurfaceApi);
  coreOrchestrator.attachAgentGateway(foundation.agentGateway);
  coreOrchestrator.registerGateway('telegram', botGateway);

  if (foundation.contextEngine) {
    coreOrchestrator.attachContextEngine(foundation.contextEngine);
  }
  if (foundation.legacyUnifiedGateway) {
    coreOrchestrator.attachLegacyUnifiedGatewayAdapter(foundation.legacyUnifiedGateway);
  }
  coreOrchestrator.attachEchoOutputStage(botGateway.getEchoOutputStage());
  if (foundation.episodicMemoryBridge) {
    foundation.episodicMemoryBridge.attach(sharedMemoryService);
    const memoryWriteWorker = new MemoryWriteWorker(new LocalMemoryBackend(sharedMemoryService));
    foundation.episodicMemoryBridge.attachBackgroundWriter(memoryWriteWorker);
    registerSharedMemoryWriteWorker(memoryWriteWorker);
  }

  const discordGateway = config.discordBotToken
    ? new DiscordGateway(coreOrchestrator)
    : new DiscordBridgeGateway({
      broker: coreOrchestrator,
      agentGateway: foundation.agentGateway,
      logRepo: foundation.logRepo,
    });
  const whatsAppGateway = new WhatsAppGateway(coreOrchestrator);
  const instagramGateway = new InstagramGateway(coreOrchestrator);
  const slackGateway = new SlackGateway(coreOrchestrator);
  const signalGateway = new SignalGateway(coreOrchestrator);
  const imessageGateway = new IMessageGateway(coreOrchestrator);
  const teamsGateway = new TeamsGateway(coreOrchestrator);
  const emailGateway = new EmailGateway(coreOrchestrator);
  const sharedChannelBroadcastGateways = {
    telegram: botGateway,
    discord: discordGateway,
    whatsapp: whatsAppGateway,
    instagram: instagramGateway,
    slack: slackGateway,
    signal: signalGateway,
    imessage: imessageGateway,
    teams: teamsGateway,
    email: emailGateway,
  } satisfies Partial<Record<string, BroadcastCapableGateway>>;

  sharedSurfaceCommandService.attachChannelBroadcastGateways(sharedChannelBroadcastGateways);
  botGateway.attachChannelBroadcastGateways(sharedChannelBroadcastGateways);
  botGateway.attachChannelIngressGateways({
    whatsapp: whatsAppGateway,
    instagram: instagramGateway,
    slack: slackGateway,
    teams: teamsGateway,
  });

  coreOrchestrator.registerGateway('discord', discordGateway);
  coreOrchestrator.registerGateway('whatsapp', whatsAppGateway);
  coreOrchestrator.registerGateway('instagram', instagramGateway);
  coreOrchestrator.registerGateway('slack', slackGateway);
  coreOrchestrator.registerGateway('signal', signalGateway);
  coreOrchestrator.registerGateway('imessage', imessageGateway);
  coreOrchestrator.registerGateway('teams', teamsGateway);
  coreOrchestrator.registerGateway('email', emailGateway);

  sharedGatewayChannelRegistry.setRuntimeAdapters([
    new TelegramRuntimeChannelAdapter(asRuntimeGateway(botGateway), true),
    new DiscordRuntimeChannelAdapter(asRuntimeGateway(discordGateway), true),
    new WhatsAppRuntimeChannelAdapter(asRuntimeGateway(whatsAppGateway), true),
    new InstagramRuntimeChannelAdapter(asRuntimeGateway(instagramGateway), true),
    new SlackRuntimeChannelAdapter(asRuntimeGateway(slackGateway), true),
    new SignalRuntimeChannelAdapter(asRuntimeGateway(signalGateway), true),
    new IMessageRuntimeChannelAdapter(asRuntimeGateway(imessageGateway), true),
    new TeamsRuntimeChannelAdapter(asRuntimeGateway(teamsGateway), true),
    new EmailRuntimeChannelAdapter(asRuntimeGateway(emailGateway), true),
  ]);

  foundation.logRepo.log(
    'info',
    'Bootstrap',
    `CoreOrchestrator ready with registered gateways: ${coreOrchestrator.getRegisteredPlatforms().join(', ')}`,
  );

  return {
    botGateway,
    coreOrchestrator,
    sharedSurfaceCommandService,
    sharedGatewayChannelRegistry,
    discordGateway,
    whatsAppGateway,
    instagramGateway,
    slackGateway,
    signalGateway,
    imessageGateway,
    teamsGateway,
    emailGateway,
  };
}

function asRuntimeGateway(gateway: PlatformGatewayContract): RuntimeAwareChannelGateway {
  return gateway;
}
