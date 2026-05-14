import { config } from './DashboardServiceDependencies.js';
import { RuntimeAccessManifestService } from './DashboardServiceDependencies.js';
import { SessionContinuityService } from './DashboardServiceDependencies.js';
import { SessionHandoffService } from './DashboardServiceDependencies.js';
import { SessionReplayService } from './DashboardServiceDependencies.js';
import { WorkflowRunService } from './DashboardServiceDependencies.js';
import { DashboardObservabilityService } from './DashboardServiceDependencies.js';
import { OperationsHealthService } from './DashboardServiceDependencies.js';
import { OperatorBriefService } from './DashboardServiceDependencies.js';
import { OperationsReportService } from './DashboardServiceDependencies.js';
import { ProductObservabilityService } from './DashboardServiceDependencies.js';
import { LogRepository } from './DashboardServiceDependencies.js';
import { DashboardAuthService } from '../DashboardAuthService.js';
import { DashboardClassicAccessService } from '../DashboardClassicAccessService.js';
import { DashboardClassicAssetService } from '../DashboardClassicAssetService.js';
import { DashboardCoreRouteService } from '../DashboardCoreRouteService.js';
import { DashboardHttpSupportService } from '../DashboardHttpSupportService.js';
import { DashboardLegacyRouteService } from '../DashboardLegacyRouteService.js';
import { DashboardOperationsRouteService } from '../DashboardOperationsRouteService.js';
import { DashboardEchoRouteService } from '../DashboardEchoRouteService.js';
import { DashboardOperationalSnapshotService } from '../DashboardOperationalSnapshotService.js';
import { DashboardOperationsOverviewReaderBridgeService } from '../DashboardOperationsOverviewReaderBridgeService.js';
import { DashboardOperationsOverviewSnapshotService } from '../DashboardOperationsOverviewSnapshotService.js';
import { DashboardOperationsDepsBridgeService } from '../DashboardOperationsDepsBridgeService.js';
import { DashboardPresentationDepsBridgeService } from '../DashboardPresentationDepsBridgeService.js';
import { DashboardResponseWriterService } from '../DashboardResponseWriterService.js';
import { DashboardRuntimeStateService } from '../DashboardRuntimeStateService.js';
import { OperationsActionService } from './DashboardServiceDependencies.js';
import { ZavorthHookPipelineService } from './DashboardServiceDependencies.js';
import { ZavorthSecurityMeshService } from './DashboardServiceDependencies.js';
import { ZavorthCapabilityCatalogService } from './DashboardServiceDependencies.js';
import { ZavorthRuntimeModesService } from './DashboardServiceDependencies.js';
import { ZavorthAgentOperatingSystemService } from './DashboardServiceDependencies.js';
import { ZavorthAgentOperatingSystemActionService } from './DashboardServiceDependencies.js';
import { ZavorthTeamCatalogService } from './DashboardServiceDependencies.js';
import { ZavorthTenantGovernanceService } from './DashboardServiceDependencies.js';
import { ZavorthTenantGovernanceActionService } from './DashboardServiceDependencies.js';
import { CodexRemoteControlPlaneService } from './DashboardServiceDependencies.js';
import { CodexRemoteActionService } from './DashboardServiceDependencies.js';
import { IntegrationHubService } from './DashboardServiceDependencies.js';
import { NodeCapabilityService } from './DashboardServiceDependencies.js';
import { NodeHeartbeatService } from './DashboardServiceDependencies.js';
import { SkillCatalogApiService } from './DashboardServiceDependencies.js';
import { SkillMcpSidecarService } from './DashboardServiceDependencies.js';
import { SkillLibraryPresentationService } from './DashboardServiceDependencies.js';
import { UniversalSkillBridgeRegistryService } from './DashboardServiceDependencies.js';
import { SkillInstallPlanPresentationService } from './DashboardServiceDependencies.js';
import { McpCapabilityControlPlaneService } from './DashboardServiceDependencies.js';
import { NodeInvocationStoreService } from './DashboardServiceDependencies.js';
import { NodeDeviceProfileService } from './DashboardServiceDependencies.js';
import { NodeRegistryService } from './DashboardServiceDependencies.js';
import { OperationsCockpitService } from './DashboardServiceDependencies.js';
import { ProviderControlPlaneService } from './DashboardServiceDependencies.js';
import { ZavorthBridgeMobileAccessService } from './DashboardServiceDependencies.js';
import { AIGatewayProxyService } from './DashboardServiceDependencies.js';
import { ZavorthGatewayLauncherService } from './DashboardServiceDependencies.js';
import { GatewayCompatibilityDoctorService } from './DashboardServiceDependencies.js';
import { GatewayUpstreamSyncService } from './DashboardServiceDependencies.js';
import { SidecarStatusService } from './DashboardServiceDependencies.js';
import { WebAppService } from './DashboardServiceDependencies.js';
import { WorkspaceExtensionRegistryService } from './DashboardServiceDependencies.js';
import { AutomaticBrowserDoctorService } from './DashboardServiceDependencies.js';
import { ZavorthA2UIService } from './DashboardServiceDependencies.js';
import { ZavorthProactivePermissionService } from './DashboardServiceDependencies.js';
import { ZavorthEchoService } from './DashboardServiceDependencies.js';
import type { DashboardOperationsDepsBridgeSource } from '../DashboardOperationsDepsBridgeService.js';
import { WebAppOperationsDepsBridgeService } from './DashboardServiceDependencies.js';
import { ZavorthPackagePublisher } from './DashboardServiceDependencies.js';
import {
  attachChatRuntime,
  buildChannelActionService,
  buildChannelMeshService,
  buildGatewayService,
  buildHookPlaneService,
  buildLayeredMemoryService,
  buildLearningPlaneService,
  buildMemoryPlaneService,
  buildNodeHeartbeatService,
  buildNodeInvokeService,
  buildNodeMeshService,
  buildNodePairingService,
  buildPlatformActionService,
  buildPlatformCatalogSyncService,
  buildPlatformRegistryService,
  buildPluginActionService,
  buildPluginRegistryService,
  buildRemoteTransportActionService,
  buildRemoteTransportDoctorService,
  buildRemoteTransportService,
  buildSessionPlaneService,
  buildSessionToolsService,
  buildToolSurfaceService,
  syncWebAppOperationsServices,
} from './DashboardServiceHelpers.js';

export function initializeDashboardService(service: any, logRepo: LogRepository, deps: any = {}): void {
  initializeSurfaceFields(service, logRepo, deps);
  initializeRuntimeComposition(service, deps);
}

function initializeSurfaceFields(service: any, logRepo: LogRepository, deps: any = {}): void {
  service.authService = new DashboardAuthService();
  service.agentGateway = deps.agentGateway || null;
  service.webApp = new WebAppService(service.authService, {
    agentGateway: service.agentGateway,
  });
  service.classicAccess = new DashboardClassicAccessService();
  service.classicAssets = new DashboardClassicAssetService();
  service.a2ui = new ZavorthA2UIService();
  service.proactivePermissions = new ZavorthProactivePermissionService();
  service.coreRoutes = new DashboardCoreRouteService();
  service.httpSupport = new DashboardHttpSupportService();
  service.legacyRoutes = new DashboardLegacyRouteService();
  service.operationsRoutes = new DashboardOperationsRouteService();
  service.echoService = new ZavorthEchoService({
    permissionService: service.proactivePermissions,
  });
  service.echoRoutes = new DashboardEchoRouteService();
  service.skillBridgeRegistry = new UniversalSkillBridgeRegistryService();
  service.skillCatalogApi = new SkillCatalogApiService({
    skillBridgeRegistryService: service.skillBridgeRegistry,
  });
  service.skillMcpSidecar = new SkillMcpSidecarService({
    skillCatalogApiService: service.skillCatalogApi,
  });
  service.skillLibraryPresentation = new SkillLibraryPresentationService({
    skillCatalogApiService: service.skillCatalogApi,
    skillMcpSidecarService: service.skillMcpSidecar,
  });
  service.skillInstallPlanPresentation = new SkillInstallPlanPresentationService({
    skillLibraryPresentationService: service.skillLibraryPresentation,
  });
  service.presentationDepsBridge = new DashboardPresentationDepsBridgeService();
  service.operationalSnapshots = new DashboardOperationalSnapshotService();
  service.operationsDepsBridge = new DashboardOperationsDepsBridgeService();
  service.webAppOperationsDepsBridge = new WebAppOperationsDepsBridgeService();
  service.overviewSnapshots = new DashboardOperationsOverviewSnapshotService();
  service.responseWriter = new DashboardResponseWriterService();
  service.sidecarStatus = new SidecarStatusService();
  service.observability = new DashboardObservabilityService(
    logRepo,
    () => service.sidecarStatus.readSummary(),
  );
  service.runtimeState = new DashboardRuntimeStateService((message) => {
    logRepo.log('warn', 'DashboardService', message);
  });
  service.operationsOverviewBridge = new DashboardOperationsOverviewReaderBridgeService(
    () => service.operationsDepsBridge.buildOverviewSnapshotDeps(
      service as DashboardOperationsDepsBridgeSource,
      {
        workspaceRoot: config.projectRoot || process.cwd(),
        continuityUserId: service.continuityUserId || config.allowedUserIds[0] || '1',
      },
    ),
    service.overviewSnapshots,
  );
  service.channelBroadcastGateways = {};
  service.slackIngressGateway = null;
  service.teamsIngressGateway = null;
  service.whatsappIngressGateway = null;
  service.instagramIngressGateway = null;
  service.reportTaskManager = null;
  service.reportPermissionService = null;
  service.sessionContinuity = null;
  service.continuityUserId = null;
  service.sessionHandoff = new SessionHandoffService();
  service.sessionReplay = new SessionReplayService();
  service.accessManifest = new RuntimeAccessManifestService();
}

function initializeRuntimeComposition(service: any, deps: any): void {
  const continuityUserId = deps.webUserId || config.allowedUserIds[0] || '1';

  service.workflowRuns = deps.workflowRunService || new WorkflowRunService();
  service.executionGateway =
    deps.executionGateway && typeof deps.executionGateway.listActions === 'function'
      ? deps.executionGateway
      : null;
  service.operationsActions = deps.operationsActionService || new OperationsActionService(service.logRepo);
  service.operationsHealth = deps.operationsHealthService || new OperationsHealthService(service.logRepo);
  service.operationsCockpit =
    deps.operationsCockpitService ||
    new OperationsCockpitService(service.logRepo, {
      operationsHealthService: service.operationsHealth,
    });
  service.operatorBrief =
    deps.operatorBriefService ||
    new OperatorBriefService(service.operationsCockpit);
  service.providerControlPlane =
    deps.providerControlPlaneService ||
    new ProviderControlPlaneService();
  service.zavorthBridgeMobileAccess =
    deps.zavorthBridgeMobileAccessService ||
    new ZavorthBridgeMobileAccessService();
  service.AIGatewayGateway =
    deps.AIGatewayGatewayService ||
    new AIGatewayProxyService();
  service.AIGatewayGatewayLauncher =
    deps.AIGatewayGatewayLauncherService ||
    new ZavorthGatewayLauncherService({
      gatewayService: service.AIGatewayGateway,
    });
  service.AIGatewayCompatibilityDoctor =
    deps.GatewayCompatibilityDoctorService ||
    new GatewayCompatibilityDoctorService({
      gatewayService: service.AIGatewayGateway,
    });
  service.AIGatewayUpstreamSync =
    deps.GatewayUpstreamSyncService ||
    new GatewayUpstreamSyncService({
      compatibilityDoctorService: service.AIGatewayCompatibilityDoctor,
    });
  service.integrationHub =
    deps.integrationHubService ||
    new IntegrationHubService({
      providerControlPlaneService: service.providerControlPlane,
    });
  service.workspaceExtensions =
    deps.workspaceExtensionRegistryService ||
    new WorkspaceExtensionRegistryService();
  service.mcpCapabilityControlPlane =
    deps.mcpCapabilityControlPlaneService ||
    new McpCapabilityControlPlaneService();
  service.mcpRuntime = deps.mcpRuntimeService || null;
  service.mcpBrowserDoctor =
    deps.mcpBrowserDoctorService ||
    new AutomaticBrowserDoctorService();
  service.hookPipeline =
    deps.hookPipelineService ||
    new ZavorthHookPipelineService();
  service.capabilityCatalog =
    deps.capabilityCatalogService ||
    new ZavorthCapabilityCatalogService({
      integrationHubService: service.integrationHub,
    });
  service.runtimeModes =
    deps.runtimeModesService ||
    new ZavorthRuntimeModesService({
      operationsHealthService: service.operationsHealth,
      integrationHubService: service.integrationHub,
    });
  service.securityMesh =
    deps.securityMeshService ||
    new ZavorthSecurityMeshService({
      operationsHealthService: service.operationsHealth,
      runtimeModesService: service.runtimeModes,
    });
  service.teamCatalog = deps.teamCatalogService || new ZavorthTeamCatalogService();
  service.tenantGovernance =
    deps.tenantGovernanceService ||
    new ZavorthTenantGovernanceService();
  service.codexRemote =
    deps.codexRemoteControlPlaneService ||
    new CodexRemoteControlPlaneService();
  service.agentOperatingSystem = new ZavorthAgentOperatingSystemService({
    teamCatalogService: service.teamCatalog,
  });
  service.agentOperatingSystemActions = new ZavorthAgentOperatingSystemActionService({
    workflowController: null,
    teamCatalogService: service.teamCatalog,
    agentOperatingSystemService: service.agentOperatingSystem,
    capabilityCatalogService: service.capabilityCatalog,
  });

  service.gatewayInjected = Boolean(deps.gatewayService);
  service.channelActionsInjected = Boolean(deps.channelActionService);
  service.channelMeshInjected = Boolean(deps.channelMeshService);
  service.hookPlaneInjected = Boolean(deps.hookPlaneService);
  service.memoryPlaneInjected = Boolean(deps.memoryPlaneService);
  service.layeredMemoryInjected = Boolean(deps.layeredMemoryService);
  service.learningPlaneInjected = Boolean(deps.learningPlaneService);
  service.nodeMeshInjected = Boolean(deps.nodeMeshService);
  service.nodeInvokeInjected = Boolean(deps.nodeInvokeService);
  service.nodeHeartbeatInjected = Boolean(deps.nodeHeartbeatService);
  service.nodePairingInjected = Boolean(deps.nodePairingService);
  service.pluginActionsInjected = Boolean(deps.pluginActionService);
  service.platformActionsInjected = Boolean(deps.platformActionService);
  service.pluginRegistryInjected = Boolean(deps.pluginRegistryService);
  service.platformRegistryInjected = Boolean(deps.platformRegistryService);
  service.platformCatalogSyncInjected = Boolean(deps.platformCatalogSyncService);
  service.remoteTransportDoctorInjected = Boolean(deps.remoteTransportDoctorService);
  service.remoteTransportActionsInjected = Boolean(deps.remoteTransportActionService);
  service.remoteTransportsInjected = Boolean(deps.remoteTransportService);
  service.operationsHealthInjected = Boolean(deps.operationsHealthService);
  service.sessionPlaneInjected = Boolean(deps.sessionPlaneService);
  service.sessionToolsInjected = Boolean(deps.sessionToolsService);
  service.toolSurfaceInjected = Boolean(deps.toolSurfaceService);
  service.reportServiceInjected = Boolean(deps.operationsReportService);
  service.productObservabilityInjected = Boolean(deps.productObservabilityService);

  service.nodeRegistry = new NodeRegistryService();
  service.nodeCapabilities = new NodeCapabilityService();
  service.nodeDeviceProfiles = new NodeDeviceProfileService();
  service.nodeInvocationStore = new NodeInvocationStoreService();
  service.reportTaskManager = deps.taskManager || null;
  service.reportPermissionService = deps.permissionService || null;
  service.sessionContinuity = deps.taskManager
    ? new SessionContinuityService(deps.taskManager as any)
    : null;
  service.continuityUserId = continuityUserId;
  service.productObservability =
    deps.productObservabilityService ||
    new ProductObservabilityService(
      (service.reportTaskManager as any) || null,
      (service.reportPermissionService as any) || null,
      { workflowRunService: service.workflowRuns },
    );
  service.operationsReport =
    deps.operationsReportService ||
    new OperationsReportService(
      service.operationsCockpit,
      null,
      (service.reportTaskManager as any) || null,
      (service.reportPermissionService as any) || null,
      service.operatorBrief,
      service.sessionContinuity,
      service.continuityUserId,
      {},
      service.productObservability,
    );

  service.channelMesh = deps.channelMeshService || buildChannelMeshService(service);
  service.channelActions = deps.channelActionService || buildChannelActionService(service);
  service.hookPlane = deps.hookPlaneService || buildHookPlaneService(service);
  service.memoryPlane = deps.memoryPlaneService || buildMemoryPlaneService(service);
  service.learningPlane = deps.learningPlaneService || buildLearningPlaneService(service);
  service.layeredMemory = deps.layeredMemoryService || buildLayeredMemoryService(service);
  service.nodeInvoke = deps.nodeInvokeService || buildNodeInvokeService(service);
  service.nodePairing = deps.nodePairingService || buildNodePairingService(service);
  service.nodeHeartbeat = deps.nodeHeartbeatService || buildNodeHeartbeatService(service);
  service.nodeMesh = deps.nodeMeshService || buildNodeMeshService(service);
  service.pluginRegistry = deps.pluginRegistryService || buildPluginRegistryService(service);
  service.pluginActions = deps.pluginActionService || buildPluginActionService(service);
  service.platformCatalogSync = deps.platformCatalogSyncService || buildPlatformCatalogSyncService();
  service.platformRegistry = deps.platformRegistryService || buildPlatformRegistryService(service);
  service.platformActions = deps.platformActionService || buildPlatformActionService(service);
  service.platformPublisher = deps.platformPublisherService || new ZavorthPackagePublisher();
  service.remoteTransports = deps.remoteTransportService || buildRemoteTransportService(service);
  service.remoteTransportDoctor =
    deps.remoteTransportDoctorService || buildRemoteTransportDoctorService(service);
  service.remoteTransportActions =
    deps.remoteTransportActionService || buildRemoteTransportActionService(service);
  service.sessionPlane = deps.sessionPlaneService || buildSessionPlaneService(service);
  service.sessionTools = deps.sessionToolsService || buildSessionToolsService(service);
  service.toolSurface = deps.toolSurfaceService || buildToolSurfaceService(service);
  service.gateway = deps.gatewayService || buildGatewayService(service);
  service.tenantGovernanceActions =
    deps.tenantGovernanceActionService ||
    new ZavorthTenantGovernanceActionService({
      tenantGovernanceService: service.tenantGovernance,
      teamCatalogService: service.teamCatalog,
      channelMeshService: service.channelMesh,
      memoryPlaneService: service.memoryPlane,
      runtimeModesService: service.runtimeModes,
      securityMeshService: service.securityMesh,
      sessionPlaneService: service.sessionPlane,
      workflowController: null,
      runtimeUserId: continuityUserId,
    });
  service.codexRemoteActions =
    deps.codexRemoteActionService ||
    new CodexRemoteActionService({
      controlPlaneService: service.codexRemote,
      permissionService: deps.permissionService as any,
      runtimeUserId: continuityUserId,
    });

  syncWebAppOperationsServices(service);

  if (
    deps.permissionService &&
    deps.taskManager &&
    deps.parser &&
    deps.taskOrchestrationController &&
    deps.permissionController
  ) {
    attachChatRuntime(service, {
      permissionService: deps.permissionService as any,
      taskManager: deps.taskManager as any,
      parser: deps.parser as any,
      taskOrchestrationController: deps.taskOrchestrationController as any,
      surfaceTaskDispatcher: deps.surfaceTaskDispatcher as any,
      legacyUnifiedGateway: deps.legacyUnifiedGateway || null,
      echoOutputStage: deps.echoOutputStage || null,
      permissionController: deps.permissionController as any,
      hostIdentityService: deps.hostIdentityService as any,
      webUserId: continuityUserId,
    });
  }
}


