import { config } from './ZavorthControlServiceDependencies.js';
import { RuntimeAccessManifestService } from './ZavorthControlServiceDependencies.js';
import { SessionContinuityService } from './ZavorthControlServiceDependencies.js';
import { SessionHandoffService } from './ZavorthControlServiceDependencies.js';
import { SessionReplayService } from './ZavorthControlServiceDependencies.js';
import { WorkflowRunService } from './ZavorthControlServiceDependencies.js';
import { ZavorthControlObservabilityService } from './ZavorthControlServiceDependencies.js';
import { OperationsHealthService } from './ZavorthControlServiceDependencies.js';
import { OperatorBriefService } from './ZavorthControlServiceDependencies.js';
import { OperationsReportService } from './ZavorthControlServiceDependencies.js';
import { ProductObservabilityService } from './ZavorthControlServiceDependencies.js';
import { LogRepository } from './ZavorthControlServiceDependencies.js';
import { ZavorthControlAuthService } from '../ZavorthControlAuthService.js';
import { ZavorthControlClassicAccessService } from '../ZavorthControlClassicAccessService.js';
import { ZavorthControlClassicAssetService } from '../ZavorthControlClassicAssetService.js';
import { ZavorthControlCoreRouteService } from '../ZavorthControlCoreRouteService.js';
import { TrustedDeviceAccessService } from '../../../../../services/TrustedDeviceAccessService.js';
import { ZavorthControlHttpSupportService } from '../ZavorthControlHttpSupportService.js';
import { ZavorthControlLegacyRouteService } from '../ZavorthControlLegacyRouteService.js';
import { ZavorthControlOperationsRouteService } from '../ZavorthControlOperationsRouteService.js';
import { ZavorthControlEchoRouteService } from '../ZavorthControlEchoRouteService.js';
import { ZavorthControlOperationalSnapshotService } from '../ZavorthControlOperationalSnapshotService.js';
import { ZavorthControlOperationsOverviewReaderBridgeService } from '../ZavorthControlOperationsOverviewReaderBridgeService.js';
import { ZavorthControlOperationsOverviewSnapshotService } from '../ZavorthControlOperationsOverviewSnapshotService.js';
import { ZavorthControlOperationsDepsBridgeService } from '../ZavorthControlOperationsDepsBridgeService.js';
import { ZavorthControlPresentationDepsBridgeService } from '../ZavorthControlPresentationDepsBridgeService.js';
import { ZavorthControlResponseWriterService } from '../ZavorthControlResponseWriterService.js';
import { ZavorthControlRuntimeStateService } from '../ZavorthControlRuntimeStateService.js';
import { OperationsActionService } from './ZavorthControlServiceDependencies.js';
import { ZavorthHookPipelineService } from './ZavorthControlServiceDependencies.js';
import { ZavorthSecurityMeshService } from './ZavorthControlServiceDependencies.js';
import { ZavorthCapabilityCatalogService } from './ZavorthControlServiceDependencies.js';
import { ZavorthRuntimeModesService } from './ZavorthControlServiceDependencies.js';
import { ZavorthAgentOperatingSystemService } from './ZavorthControlServiceDependencies.js';
import { ZavorthAgentOperatingSystemActionService } from './ZavorthControlServiceDependencies.js';
import { ZavorthTeamCatalogService } from './ZavorthControlServiceDependencies.js';
import { ZavorthTenantGovernanceService } from './ZavorthControlServiceDependencies.js';
import { ZavorthTenantGovernanceActionService } from './ZavorthControlServiceDependencies.js';
import { CodexRemoteControlPlaneService } from './ZavorthControlServiceDependencies.js';
import { CodexRemoteActionService } from './ZavorthControlServiceDependencies.js';
import { IntegrationHubService } from './ZavorthControlServiceDependencies.js';
import { NodeCapabilityService } from './ZavorthControlServiceDependencies.js';
import { NodeHeartbeatService } from './ZavorthControlServiceDependencies.js';
import { SkillCatalogApiService } from './ZavorthControlServiceDependencies.js';
import { SkillMcpSidecarService } from './ZavorthControlServiceDependencies.js';
import { SkillLibraryPresentationService } from './ZavorthControlServiceDependencies.js';
import { UniversalSkillBridgeRegistryService } from './ZavorthControlServiceDependencies.js';
import { SkillInstallPlanPresentationService } from './ZavorthControlServiceDependencies.js';
import { McpCapabilityControlPlaneService } from './ZavorthControlServiceDependencies.js';
import { NodeInvocationStoreService } from './ZavorthControlServiceDependencies.js';
import { NodeDeviceProfileService } from './ZavorthControlServiceDependencies.js';
import { NodeRegistryService } from './ZavorthControlServiceDependencies.js';
import { OperationsCockpitService } from './ZavorthControlServiceDependencies.js';
import { ProviderControlPlaneService } from './ZavorthControlServiceDependencies.js';
import { ZavorthBridgeMobileAccessService } from './ZavorthControlServiceDependencies.js';
import { AIGatewayProxyService } from './ZavorthControlServiceDependencies.js';
import { ZavorthGatewayLauncherService } from './ZavorthControlServiceDependencies.js';
import { GatewayCompatibilityDoctorService } from './ZavorthControlServiceDependencies.js';
import { GatewayUpstreamSyncService } from './ZavorthControlServiceDependencies.js';
import { SidecarStatusService } from './ZavorthControlServiceDependencies.js';
import { WebAppService } from './ZavorthControlServiceDependencies.js';
import { WorkspaceExtensionRegistryService } from './ZavorthControlServiceDependencies.js';
import { AutomaticBrowserDoctorService } from './ZavorthControlServiceDependencies.js';
import { ZavorthA2UIService } from './ZavorthControlServiceDependencies.js';
import { ZavorthProactivePermissionService } from './ZavorthControlServiceDependencies.js';
import { ZavorthEchoService } from './ZavorthControlServiceDependencies.js';
import type { ZavorthControlOperationsDepsBridgeSource } from '../ZavorthControlOperationsDepsBridgeService.js';
import { WebAppOperationsDepsBridgeService } from './ZavorthControlServiceDependencies.js';
import { ZavorthPackagePublisher } from './ZavorthControlServiceDependencies.js';
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
} from './ZavorthControlServiceHelpers.js';

export function initializeZavorthControlService(service: any, logRepo: LogRepository, deps: any = {}): void {
  initializeSurfaceFields(service, logRepo, deps);
  initializeRuntimeComposition(service, deps);
}

function initializeSurfaceFields(service: any, logRepo: LogRepository, deps: any = {}): void {
  service.trustedDeviceAccess = deps.trustedDeviceAccess || new TrustedDeviceAccessService();
  service.authService = new ZavorthControlAuthService({
    trustedDevices: service.trustedDeviceAccess,
  });
  service.agentGateway = deps.agentGateway || null;
  service.webApp = new WebAppService(service.authService, {
    agentGateway: service.agentGateway,
    toolRuntime: deps.toolRuntime || null,
  });
  service.classicAccess = new ZavorthControlClassicAccessService();
  service.classicAssets = new ZavorthControlClassicAssetService();
  service.a2ui = new ZavorthA2UIService();
  service.proactivePermissions = new ZavorthProactivePermissionService();
  service.coreRoutes = new ZavorthControlCoreRouteService({
    localAccess: service.trustedDeviceAccess,
  });
  service.httpSupport = new ZavorthControlHttpSupportService();
  service.legacyRoutes = new ZavorthControlLegacyRouteService();
  service.operationsRoutes = new ZavorthControlOperationsRouteService();
  service.echoService = new ZavorthEchoService({
    permissionService: service.proactivePermissions,
  });
  service.echoRoutes = new ZavorthControlEchoRouteService();
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
  service.presentationDepsBridge = new ZavorthControlPresentationDepsBridgeService();
  service.operationalSnapshots = new ZavorthControlOperationalSnapshotService();
  service.operationsDepsBridge = new ZavorthControlOperationsDepsBridgeService();
  service.webAppOperationsDepsBridge = new WebAppOperationsDepsBridgeService();
  service.overviewSnapshots = new ZavorthControlOperationsOverviewSnapshotService();
  service.responseWriter = new ZavorthControlResponseWriterService();
  service.sidecarStatus = new SidecarStatusService();
  service.observability = new ZavorthControlObservabilityService(
    logRepo,
    () => service.sidecarStatus.readSummary(),
  );
  service.runtimeState = new ZavorthControlRuntimeStateService((message) => {
    logRepo.log('warn', 'ZavorthControlService', message);
  });
  service.operationsOverviewBridge = new ZavorthControlOperationsOverviewReaderBridgeService(
    () => service.operationsDepsBridge.buildOverviewSnapshotDeps(
      service as ZavorthControlOperationsDepsBridgeSource,
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
