import { CanonicalPublicApiService } from '../../../../api/public/CanonicalPublicApiService.js';
import { PublicApiRouter } from '../../../../api/public/PublicApiRouter.js';
import { getDefaultCapabilityRegistry } from '../../../../capabilities/CapabilityRegistry.js';
import { ComputerUseAgent } from '../../../../agents/ComputerUseAgent.js';
import { AutomaticBrowserDoctorService } from '../../../../mcp/AutomaticBrowserDoctorService.js';
import { PtyWebSocketServer } from '../../../../runtime/sessions/v2/PtyWebSocketServer.js';
import {
  ZavorthAgentGateway,
  createDefaultAgentRunStore,
  createDefaultAgentWorkflowQueueStore,
} from '../../../../runtime/agent/index.js';
import { RuntimeAccessManifestService } from '../../../../runtime/access/RuntimeAccessManifestService.js';
import { RuntimeAccessReadinessService } from '../../../../runtime/access/RuntimeAccessReadinessService.js';
import { RuntimeInstallJourneyService } from '../../../../runtime/access/RuntimeInstallJourneyService.js';
import { RuntimeOfficialRemoteAccessService } from '../../../../runtime/access/RuntimeOfficialRemoteAccessService.js';
import { RuntimeRemoteAccessService } from '../../../../runtime/access/RuntimeRemoteAccessService.js';
import type { DashboardAuthService } from '../../../../services/DashboardAuthService.js';
import { ZavorthGatewayControlSocketService } from '../../../../services/ZavorthGatewayControlSocketService.js';
import { ZavorthGatewayLauncherService } from '../../../../services/ZavorthGatewayLauncherService.js';
import { ZavorthGatewayRuntimeService } from '../../../../services/ZavorthGatewayRuntimeService.js';
import { ZavorthMutationPlaneService } from '../../../../services/ZavorthMutationPlaneService.js';
import { ZavorthPublicTunnelService } from '../../../../services/ZavorthPublicTunnelService.js';
import { CapabilityLifecycleService } from '../../../../services/CapabilityLifecycleService.js';
import { ChannelInstallScaffoldService } from '../../../../services/ChannelInstallScaffoldService.js';
import { ChannelProviderDoctorService } from '../../../../services/ChannelProviderDoctorService.js';
import { ChannelSetupAssistantService } from '../../../../services/ChannelSetupAssistantService.js';
import { CompanionControlService } from '../../../../services/CompanionControlService.js';
import { CompanionWorkspaceOptimizerService } from '../../../../services/CompanionWorkspaceOptimizerService.js';
import { ComputerUseWatchModePolicyFileService } from '../../../../services/ComputerUseWatchModePolicyFileService.js';
import { ComputerUseWatchModeService } from '../../../../services/ComputerUseWatchModeService.js';
import { ComputerUseWatchModeStateFileService } from '../../../../services/ComputerUseWatchModeStateFileService.js';
import { DesktopResourcePlaneService } from '../../../../services/DesktopResourcePlaneService.js';
import { EngineeringCoreService } from '../../../../services/EngineeringCoreService.js';
import { EngineeringSessionService } from '../../../../services/EngineeringSessionService.js';
import { ModeEscalationService } from '../../../../services/ModeEscalationService.js';
import { PermissionService } from '../../../../services/PermissionService.js';
import { RuntimeBootstrapRepairService } from '../../../../services/RuntimeBootstrapRepairService.js';
import { RuntimeStartupService } from '../../../../services/RuntimeStartupService.js';
import { SatellitePwaRouteService } from '../../../../services/SatellitePwaRouteService.js';
import { SatelliteTransportService } from '../../../../services/SatelliteTransportService.js';
import type {
  SatelliteCapabilityInvokePayload,
  SatelliteChatSendPayload,
  SatelliteHeartbeatPingPayload,
} from '../../../../contracts/SatelliteContract.js';
import { SessionV2Service } from '../../../../services/SessionV2Service.js';
import { SelfModificationCommandService } from '../../../../services/SelfModificationCommandService.js';
import { SharedSurfaceParityService } from '../../../../services/SharedSurfaceParityService.js';
import { SkillCatalogApiService } from '../../../../services/SkillCatalogApiService.js';
import { SkillInstallPlanPresentationService } from '../../../../services/SkillInstallPlanPresentationService.js';
import { SkillLibraryPresentationService } from '../../../../services/SkillLibraryPresentationService.js';
import { SkillMcpSidecarService } from '../../../../services/SkillMcpSidecarService.js';
import { UniversalSkillBridgeActivationService } from '../../../../services/UniversalSkillBridgeActivationService.js';
import { SupervisedExecutionGatewayService } from '../../../../services/SupervisedExecutionGatewayService.js';
import { SupervisedRuntimeAdapterRegistryService } from '../../../../services/SupervisedRuntimeAdapterRegistryService.js';
import { SwarmV2Service } from '../../../../services/SwarmV2Service.js';
import type { SharedSurfaceRuntime } from '../../../../services/SurfaceRuntime.js';
import { SystemOverlordControlService } from '../../../../services/SystemOverlordControlService.js';
import { TaskResourcePlannerService } from '../../../../services/TaskResourcePlannerService.js';
import { TrustDecisionService } from '../../../../services/TrustDecisionService.js';
import { WebAppConversationService } from '../../../../services/WebAppConversationService.js';
import { WebAppNodeRouteService } from '../../../../services/WebAppNodeRouteService.js';
import { WebAppRuntimeRouteService } from './WebAppRuntimeRouteService.js';
import { WebAppSecurityService } from '../../../../services/WebAppSecurityService.js';
import { WebAppSurfaceRouteService } from '../../../../services/WebAppSurfaceRouteService.js';
import { WebConsoleAssetService } from '../web-console/WebConsoleAssetService.js';
import type { WebRealtimeService } from '../../../../services/WebRealtimeService.js';
import { LlmRuntimeService } from '../../../../services/llm/LlmRuntimeService.js';
import { WebAppOperationsAttachmentService } from './WebAppOperationsAttachmentService.js';
import { WebAppRealtimeTransportService } from './WebAppRealtimeTransportService.js';
import { WebAppRouteDepsFactoryService } from './WebAppRouteDepsFactoryService.js';
import { WebAppRuntimeContextBridge } from './WebAppRuntimeContextBridge.js';
import { WebAppRuntimeInfrastructureService } from './WebAppRuntimeInfrastructureService.js';
import {
  WebAppSharedSurfaceFactoryService,
  type WebAppSharedSurfaceFactorySource,
} from './WebAppSharedSurfaceFactoryService.js';
import type { WebAppOperationsState, WebAppRuntimeServiceState } from './WebAppServiceState.js';

type WebAppServiceCompositionOptions = {
  auth: DashboardAuthService;
  operations: WebAppOperationsState;
  runtimeServices: WebAppRuntimeServiceState;
  getRuntime: () => SharedSurfaceRuntime | null;
  getRealtime: () => WebRealtimeService | null;
  getConversationService: () => WebAppConversationService;
  getSharedSurfaceFactorySource: () => WebAppSharedSurfaceFactorySource;
  isComputerUseEnabled: () => boolean;
  agentGateway?: ZavorthAgentGateway | null;
};

async function handleSatelliteChatSend(
  payload: SatelliteChatSendPayload,
  sessionId: string,
  options: WebAppServiceCompositionOptions,
) {
  if (!options.getRuntime() || !options.getRealtime()) {
    return {
      text: 'Satellite conectado, mas o runtime de conversa ainda nao foi anexado.',
      streaming: false,
      artifacts: null,
    };
  }

  const result = await options.getConversationService().processChatSend({
    message: payload.text,
    sessionId: `satellite-${sessionId}`,
    attachments: payload.attachments || [],
    source: 'satellite',
  });
  return {
    text: extractLatestAssistantText(result.snapshot)
      || 'Pedido recebido pelo runtime. Abra o Command Center para acompanhar a execucao.',
    streaming: false,
    artifacts: null,
  };
}

async function invokeSatelliteCapability(
  payload: SatelliteCapabilityInvokePayload,
  sessionId: string,
  capability: unknown,
  options: WebAppServiceCompositionOptions,
) {
  const args = payload.args && typeof payload.args === 'object' && !Array.isArray(payload.args)
    ? payload.args as Record<string, any>
    : {};
  const nodeId = String(args.nodeId || args.node_id || '').trim();
  if (nodeId && options.operations.nodeInvoke) {
    return {
      ok: true,
      result: options.operations.nodeInvoke.invoke({
        nodeId,
        capabilityId: payload.capabilityId,
        action: String(args.action || 'invoke').trim() || 'invoke',
        payload: args.payload && typeof args.payload === 'object' ? args.payload : args,
        requestedBy: options.getRuntime()?.webUserId || `satellite:${sessionId}`,
      }),
      error: null,
    };
  }

  return {
    ok: false,
    result: {
      capabilityId: payload.capabilityId,
      registered: true,
      dispatcher: 'capability-registry',
      capability,
    },
    error: 'Capability registrada, mas sem dispatcher direto nesta superficie. Envie args.nodeId para rotear via Node Mesh ou use chat.send.',
  };
}

async function handleSatelliteHeartbeat(
  payload: SatelliteHeartbeatPingPayload,
  options: WebAppServiceCompositionOptions,
) {
  const nodeId = String(payload.nodeId || '').trim();
  const sharedSecret = String(payload.sharedSecret || '').trim();
  if (!nodeId || !sharedSecret || !options.operations.nodeHeartbeat) {
    return null;
  }

  const heartbeat = options.operations.nodeHeartbeat.receiveHeartbeat({
    nodeId,
    sharedSecret,
    capabilityIds: Array.isArray(payload.capabilities) ? payload.capabilities : [],
    results: Array.isArray(payload.completedInvocations) ? payload.completedInvocations as any : [],
    hostHints: {
      surface: 'satellite-pwa',
    } as any,
  });
  const nodeMesh = options.operations.nodeMesh?.buildSnapshot
    ? options.operations.nodeMesh.buildSnapshot({ selectedNodeId: nodeId })
    : null;
  return {
    heartbeat,
    nodeMesh,
  };
}

function extractLatestAssistantText(snapshot: any): string | null {
  const candidates = [
    snapshot?.messages,
    snapshot?.history,
    snapshot?.session?.messages,
    snapshot?.conversation?.messages,
    snapshot?.timeline,
  ];
  const messages = candidates.find((candidate) => Array.isArray(candidate));
  if (!messages) {
    return null;
  }

  for (const message of [...messages].reverse()) {
    const role = String(message?.role || message?.kind || message?.type || '').toLowerCase();
    if (!role.includes('assistant') && !role.includes('agent') && !role.includes('reply')) {
      continue;
    }
    const text = String(message?.text || message?.content || message?.message || message?.body || '').trim();
    if (text) {
      return text;
    }
  }
  return null;
}

export type WebAppServiceComposition = {
  accessReadiness: RuntimeAccessReadinessService;
  accessManifest: RuntimeAccessManifestService;
  installJourney: RuntimeInstallJourneyService;
  bootstrapRepair: RuntimeBootstrapRepairService;
  startupService: RuntimeStartupService;
  officialRemoteAccess: RuntimeOfficialRemoteAccessService;
  remoteAccess: RuntimeRemoteAccessService;
  surfaceParity: SharedSurfaceParityService;
  webSecurity: WebAppSecurityService;
  consoleAssets: WebConsoleAssetService;
  satellitePwaRoutes: SatellitePwaRouteService;
  satelliteTransport: SatelliteTransportService;
  realtimeTransport: WebAppRealtimeTransportService;
  runtimeRoutes: WebAppRuntimeRouteService;
  agentGateway: ZavorthAgentGateway;
  selfModificationCommandService: SelfModificationCommandService;
  permissionAuditService: PermissionService;
  capabilityLifecycle: CapabilityLifecycleService;
  mutationPlane: ZavorthMutationPlaneService;
  trustDecision: TrustDecisionService;
  desktopResources: DesktopResourcePlaneService;
  taskResourcePlanner: TaskResourcePlannerService;
  modeEscalation: ModeEscalationService;
  companions: CompanionControlService;
  workspaceOptimizer: CompanionWorkspaceOptimizerService;
  sessionV2: SessionV2Service;
  computerUseAgent: ComputerUseAgent;
  computerUseWatchModePolicy: ComputerUseWatchModePolicyFileService;
  computerUseWatchModeState: ComputerUseWatchModeStateFileService;
  computerUseWatchMode: ComputerUseWatchModeService;
  publicTunnelService: ZavorthPublicTunnelService;
  systemOverlordGateway: SupervisedExecutionGatewayService;
  systemOverlordControl: SystemOverlordControlService;
  engineeringCore: EngineeringCoreService;
  swarmV2: SwarmV2Service;
  sessionV2Sockets: PtyWebSocketServer;
  gatewayControlSockets: ZavorthGatewayControlSocketService;
  surfaceRoutes: WebAppSurfaceRouteService;
  nodeRoutes: WebAppNodeRouteService;
  channelInstall: ChannelInstallScaffoldService;
  channelProviderDoctor: ChannelProviderDoctorService;
  channelSetupAssistant: ChannelSetupAssistantService;
  runtimeInfrastructure: WebAppRuntimeInfrastructureService;
  gatewayRuntime: ZavorthGatewayRuntimeService;
  skillCatalogApi: SkillCatalogApiService;
  skillMcpSidecar: SkillMcpSidecarService;
  skillLibraryPresentation: SkillLibraryPresentationService;
  skillInstallPlanPresentation: SkillInstallPlanPresentationService;
  skillBridgeActivation: UniversalSkillBridgeActivationService;
  publicApiRouter: PublicApiRouter;
  publicApi: CanonicalPublicApiService;
  operationsAttachment: WebAppOperationsAttachmentService;
  sharedSurfaceFactory: WebAppSharedSurfaceFactoryService;
  runtimeContextBridge: WebAppRuntimeContextBridge;
  routeDepsFactory: WebAppRouteDepsFactoryService;
};

function createSharedSurfaceBuilders(
  factory: WebAppSharedSurfaceFactoryService,
  getSource: () => WebAppSharedSurfaceFactorySource,
): Pick<
  ConstructorParameters<typeof WebAppRouteDepsFactoryService>[0],
  | 'buildHubControlPlane'
  | 'buildHubActionService'
  | 'buildQaControlPlane'
  | 'buildGovernanceControlPlane'
  | 'buildReplayLearningControlPlane'
  | 'buildEcosystemControlPlane'
  | 'buildDistributedRuntimeControlPlane'
  | 'buildRuntimeStabilityControlPlane'
  | 'buildRolloutReadinessControlPlane'
  | 'buildNaturalSetupControlPlane'
  | 'buildAutomationControlPlane'
  | 'buildAutomationActionService'
  | 'buildWatchModeControlPlane'
> {
  return {
    buildHubControlPlane: () => factory.buildHubControlPlane(getSource()),
    buildHubActionService: () => factory.buildHubActionService(getSource()),
    buildQaControlPlane: () => factory.buildQaControlPlane(),
    buildGovernanceControlPlane: () => factory.buildGovernanceControlPlane(getSource()),
    buildReplayLearningControlPlane: () => factory.buildReplayLearningControlPlane(getSource()),
    buildEcosystemControlPlane: () => factory.buildEcosystemControlPlane(getSource()),
    buildDistributedRuntimeControlPlane: () => factory.buildDistributedRuntimeControlPlane(getSource()),
    buildRuntimeStabilityControlPlane: () => factory.buildRuntimeStabilityControlPlane(getSource()),
    buildRolloutReadinessControlPlane: () => factory.buildRolloutReadinessControlPlane(getSource()),
    buildNaturalSetupControlPlane: () => factory.buildNaturalSetupControlPlane(getSource()),
    buildAutomationControlPlane: () => factory.buildAutomationControlPlane(),
    buildAutomationActionService: () => factory.buildAutomationActionService(),
    buildWatchModeControlPlane: () => factory.buildWatchModeControlPlane(getSource()),
  };
}

export function createWebAppServiceComposition(
  options: WebAppServiceCompositionOptions,
): WebAppServiceComposition {
  const accessReadiness = new RuntimeAccessReadinessService();
  const accessManifest = new RuntimeAccessManifestService();
  const installJourney = new RuntimeInstallJourneyService();
  const bootstrapRepair = new RuntimeBootstrapRepairService();
  const startupService = new RuntimeStartupService();
  const officialRemoteAccess = new RuntimeOfficialRemoteAccessService();
  const remoteAccess = new RuntimeRemoteAccessService({
    officialRemoteAccessService: officialRemoteAccess,
  });
  const surfaceParity = new SharedSurfaceParityService();
  const webSecurity = new WebAppSecurityService(options.auth);
  const consoleAssets = new WebConsoleAssetService();
  const satellitePwaRoutes = new SatellitePwaRouteService();
  const satelliteCapabilityRegistry = getDefaultCapabilityRegistry();
  const satelliteTransport = new SatelliteTransportService({
    auth: options.auth,
    capabilityRegistry: satelliteCapabilityRegistry,
    statusCapabilities: () => satelliteCapabilityRegistry
      .getAll()
      .filter((capability) => capability.enabled !== false)
      .map((capability) => capability.id),
    handleChatSend: async (payload, session) => handleSatelliteChatSend(payload, session.sessionId, options),
    invokeCapability: async (payload, session, _envelope, capability) =>
      invokeSatelliteCapability(payload, session.sessionId, capability, options),
    handleHeartbeat: async (payload) => handleSatelliteHeartbeat(payload, options),
  });
  const realtimeTransport = new WebAppRealtimeTransportService();
  const runtimeRoutes = new WebAppRuntimeRouteService();
  const selfModificationCommandService = new SelfModificationCommandService();
  const agentGateway = options.agentGateway || new ZavorthAgentGateway({
    defaultProviderLabel: 'Zavorth Gateway',
    defaultModelLabel: 'modelo atual',
    runStore: createDefaultAgentRunStore(),
    workflowQueueStore: createDefaultAgentWorkflowQueueStore(),
    selfModificationService: selfModificationCommandService,
  });
  const permissionAuditService = new PermissionService();
  const capabilityLifecycle = new CapabilityLifecycleService();
  const mutationPlane = new ZavorthMutationPlaneService();
  const trustDecision = new TrustDecisionService({
    capabilityLifecycleService: capabilityLifecycle,
    permissionService: permissionAuditService,
  });
  const desktopResources = new DesktopResourcePlaneService();
  const taskResourcePlanner = new TaskResourcePlannerService({
    capabilityLifecycle,
    desktopResources,
  });
  const modeEscalation = new ModeEscalationService({
    capabilityLifecycle,
  });
  const companions = new CompanionControlService({
    desktopResources,
    impactPlanner: taskResourcePlanner,
  });
  const workspaceOptimizer = new CompanionWorkspaceOptimizerService({
    mutationPlane,
    trustDecision,
  });
  const sessionV2 = new SessionV2Service({
    llmRuntime: new LlmRuntimeService(),
  });
  const computerUseAgent = new ComputerUseAgent(new LlmRuntimeService());
  const computerUseWatchModePolicy = new ComputerUseWatchModePolicyFileService();
  const computerUseWatchModeState = new ComputerUseWatchModeStateFileService();
  const computerUseWatchMode = new ComputerUseWatchModeService({
    createAgent: () => new ComputerUseAgent(new LlmRuntimeService()),
    isExecutionAllowed: options.isComputerUseEnabled,
    policyFileService: computerUseWatchModePolicy,
    stateFileService: computerUseWatchModeState,
  });
  agentGateway.attachWatchModeService(computerUseWatchMode);
  const publicTunnelService = new ZavorthPublicTunnelService();
  const systemOverlordGateway = new SupervisedExecutionGatewayService({
    adapterRegistry: new SupervisedRuntimeAdapterRegistryService({
      computerUseAgent,
      publicTunnelService,
    }),
  });
  const systemOverlordControl = new SystemOverlordControlService({
    executionGatewayService: systemOverlordGateway,
  });
  const engineeringCore = new EngineeringCoreService({
    sessionService: new EngineeringSessionService({
      sessionV2,
    }),
    selfModificationCommandService,
    executionGatewayService: systemOverlordGateway,
  });
  const swarmV2 = new SwarmV2Service();
  const sessionV2Sockets = new PtyWebSocketServer();
  const gatewayControlSockets = new ZavorthGatewayControlSocketService();
  const surfaceRoutes = new WebAppSurfaceRouteService();
  const nodeRoutes = new WebAppNodeRouteService();
  const channelInstall = new ChannelInstallScaffoldService();
  const channelProviderDoctor = new ChannelProviderDoctorService();
  const channelSetupAssistant = new ChannelSetupAssistantService({
    installService: channelInstall,
    providerDoctorService: channelProviderDoctor,
  });
  const runtimeInfrastructure = new WebAppRuntimeInfrastructureService();
  const gatewayRuntime = new ZavorthGatewayRuntimeService(options.auth, runtimeInfrastructure);
  const skillCatalogApi = new SkillCatalogApiService();
  const skillMcpSidecar = new SkillMcpSidecarService({
    skillCatalogApiService: skillCatalogApi,
  });
  const skillLibraryPresentation = new SkillLibraryPresentationService({
    skillCatalogApiService: skillCatalogApi,
    skillMcpSidecarService: skillMcpSidecar,
  });
  const skillInstallPlanPresentation = new SkillInstallPlanPresentationService({
    skillLibraryPresentationService: skillLibraryPresentation,
  });
  const skillBridgeActivation = new UniversalSkillBridgeActivationService();
  const publicApiRouter = new PublicApiRouter({
    principalUserIdProvider: () => options.getRuntime()?.webUserId || null,
  });
  const publicApi = new CanonicalPublicApiService({
    getRuntime: options.getRuntime,
    getGateway: () => options.runtimeServices.gateway || options.operations.gateway,
    getSessionPlane: () => options.runtimeServices.sessionPlane || options.operations.sessionPlane,
    getNodeMesh: () => options.operations.nodeMesh,
    getPlatformRegistry: () => options.operations.platformRegistry,
    getRemoteTransports: () => options.operations.remoteTransports,
    getOperationsHealth: () => options.operations.operationsHealth,
    getLearningPlane: () => options.operations.learningPlane,
    getLayeredMemory: () => options.operations.layeredMemory,
    getProviderControlPlane: () => options.operations.providerControlPlane,
    getChannelMesh: () => options.operations.channelMesh,
    getPermissionService: () => permissionAuditService,
    getConversationService: () => {
      try {
        return options.getConversationService();
      } catch {
        return null;
      }
    },
    getRealtime: () => options.getRealtime(),
    getChannelActions: () => options.operations.channelActions,
    getSupervisedExecutionGateway: () => systemOverlordGateway,
  });
  const operationsAttachment = new WebAppOperationsAttachmentService();
  const sharedSurfaceFactory = new WebAppSharedSurfaceFactoryService();
  const runtimeContextBridge = new WebAppRuntimeContextBridge({
    operations: options.operations,
    runtimeServices: options.runtimeServices,
    getRuntime: options.getRuntime,
    getRealtime: options.getRealtime,
    publicApi,
    realtimeTransport,
  });
  const routeDepsFactory = new WebAppRouteDepsFactoryService({
    auth: options.auth,
    operations: options.operations,
    runtimeServices: options.runtimeServices,
    getRuntime: options.getRuntime,
    getRealtime: options.getRealtime,
    getConversationService: options.getConversationService,
    runtimeRoutes,
    gatewayControl: runtimeRoutes.getGatewayControl(),
    gatewayRuntime,
    agentGateway,
    webSecurity,
    accessReadiness,
    accessManifest,
    installJourney,
    bootstrapRepair,
    startupService,
    officialRemoteAccess,
    remoteAccess,
    surfaceParity,
    consoleAssets,
    channelInstall,
    channelProviderDoctor,
    channelSetupAssistant,
    skillCatalogApi,
    skillMcpSidecar,
    skillLibraryPresentation,
    skillInstallPlanPresentation,
    skillBridgeActivation,
    permissionAuditService,
    capabilityLifecycle,
    selfModification: selfModificationCommandService,
    mutationPlane,
    trustDecision,
    desktopResources,
    companions,
    taskResourcePlanner,
    modeEscalation,
    workspaceOptimizer,
    sessionV2,
    swarmV2,
    computerUseAgent,
    watchMode: computerUseWatchMode,
    engineeringCore,
    systemOverlordControl,
    workspaceRoot: process.cwd(),
    runtimeContext: runtimeContextBridge,
    publicApi,
    ...createSharedSurfaceBuilders(sharedSurfaceFactory, options.getSharedSurfaceFactorySource),
  });

  return {
    accessReadiness,
    accessManifest,
    installJourney,
    bootstrapRepair,
    startupService,
    officialRemoteAccess,
    remoteAccess,
    surfaceParity,
    webSecurity,
    consoleAssets,
    satellitePwaRoutes,
    satelliteTransport,
    realtimeTransport,
    runtimeRoutes,
    agentGateway,
    selfModificationCommandService,
    permissionAuditService,
    capabilityLifecycle,
    mutationPlane,
    trustDecision,
    desktopResources,
    taskResourcePlanner,
    modeEscalation,
    companions,
    workspaceOptimizer,
    sessionV2,
    computerUseAgent,
    computerUseWatchModePolicy,
    computerUseWatchModeState,
    computerUseWatchMode,
    publicTunnelService,
    systemOverlordGateway,
    systemOverlordControl,
    engineeringCore,
    swarmV2,
    sessionV2Sockets,
    gatewayControlSockets,
    surfaceRoutes,
    nodeRoutes,
    channelInstall,
    channelProviderDoctor,
    channelSetupAssistant,
    runtimeInfrastructure,
    gatewayRuntime,
    skillCatalogApi,
    skillMcpSidecar,
    skillLibraryPresentation,
    skillInstallPlanPresentation,
    skillBridgeActivation,
    publicApiRouter,
    publicApi,
    operationsAttachment,
    sharedSurfaceFactory,
    runtimeContextBridge,
    routeDepsFactory,
  };
}

