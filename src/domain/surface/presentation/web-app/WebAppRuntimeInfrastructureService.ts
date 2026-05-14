import { ZavorthCapabilityCatalogService } from '../../../../services/ZavorthCapabilityCatalogService.js';
import { ZavorthGatewayService } from '../../../../services/ZavorthGatewayService.js';
import { ZavorthHookPlaneService } from '../../../../services/ZavorthHookPlaneService.js';
import { ZavorthMemoryPlaneService } from '../../../../services/ZavorthMemoryPlaneService.js';
import { ZavorthNodeMeshService } from '../../../../services/ZavorthNodeMeshService.js';
import { ZavorthPluginRegistryService } from '../../../../services/ZavorthPluginRegistryService.js';
import type { ZavorthChannelMeshService } from '../../../../services/ZavorthChannelMeshService.js';
import type { ZavorthPlatformRegistryService } from '../../../../services/ZavorthPlatformRegistryService.js';
import { ZavorthRemoteTransportService } from '../../../../services/ZavorthRemoteTransportService.js';
import { ZavorthRuntimeModesService } from '../../../../services/ZavorthRuntimeModesService.js';
import { ZavorthSecurityMeshService } from '../../../../services/ZavorthSecurityMeshService.js';
import { ZavorthSessionPlaneService } from '../../../../services/ZavorthSessionPlaneService.js';
import { ZavorthSessionToolsService } from '../../../../runtime/sessions/ZavorthSessionToolsService.js';
import { ZavorthTeamCatalogService } from '../../../../services/ZavorthTeamCatalogService.js';
import { ZavorthToolSurfaceService } from '../../../../services/ZavorthToolSurfaceService.js';
import { GatewayChannelRegistryService } from '../../../../services/GatewayChannelRegistryService.js';
import { GatewayChannelRouterService } from '../../../../services/GatewayChannelRouterService.js';
import { GatewaySessionReadModelService } from '../../../../runtime/sessions/GatewaySessionReadModelService.js';
import { GatewaySessionService } from '../../../../runtime/sessions/GatewaySessionService.js';
import { GatewaySessionStoreService } from '../../../../runtime/sessions/GatewaySessionStoreService.js';
import { GatewaySessionToolsService } from '../../../../runtime/sessions/GatewaySessionToolsService.js';
import { GatewaySessionLedgerService } from '../../../../services/GatewaySessionLedgerService.js';
import { IntegrationHubService } from '../../../../services/IntegrationHubService.js';
import { MemoryService } from '../../../../services/MemoryService.js';
import type { OperationsHealthService } from '../../../../observability/OperationsHealthService.js';
import type { ProviderControlPlaneService } from '../../../../services/ProviderControlPlaneService.js';
import type { SharedSurfaceRuntime } from '../../../../services/SurfaceRuntime.js';
import { SurfaceTaskDispatchService } from '../../../../services/SurfaceTaskDispatchService.js';
import { WebRealtimeService } from '../../../../services/WebRealtimeService.js';
import { WorkspaceOperationalMemoryService } from '../../../../runtime/context/WorkspaceOperationalMemoryService.js';

export type WebAppRealtimeInfrastructure = {
  runtime: SharedSurfaceRuntime;
  realtime: WebRealtimeService;
  gatewaySessionStore: GatewaySessionStoreService;
  gatewaySessionService: GatewaySessionService;
  gatewaySessionReadModel: GatewaySessionReadModelService;
  gatewayChannelRegistry: GatewayChannelRegistryService;
  gatewayChannelRouter: GatewayChannelRouterService;
};

export type WebAppRuntimeGatewayInfrastructureInput = {
  runtime: SharedSurfaceRuntime;
  gatewaySessionStore: GatewaySessionStoreService;
  gatewaySessionService: GatewaySessionService;
  gatewaySessionReadModel: GatewaySessionReadModelService;
  gatewayChannelRegistry: GatewayChannelRegistryService;
  gatewayChannelRouter: GatewayChannelRouterService;
  capabilityCatalog: ZavorthCapabilityCatalogService | null;
  channelMesh: ZavorthChannelMeshService | null;
  memoryPlane: ZavorthMemoryPlaneService | null;
  securityMesh: ZavorthSecurityMeshService | null;
  runtimeModes: ZavorthRuntimeModesService | null;
  teamCatalog: ZavorthTeamCatalogService | null;
  hookPlane: ZavorthHookPlaneService | null;
  nodeMesh: ZavorthNodeMeshService | null;
  pluginRegistry: ZavorthPluginRegistryService | null;
  platformRegistry: ZavorthPlatformRegistryService | null;
  remoteTransports: ZavorthRemoteTransportService | null;
  operationsHealth: OperationsHealthService | null;
  providerControlPlane: ProviderControlPlaneService | null;
  integrationHub: IntegrationHubService | null;
};

export type WebAppRuntimeGatewayInfrastructure = {
  gateway: ZavorthGatewayService;
  memoryPlane: ZavorthMemoryPlaneService;
  sessionPlane: ZavorthSessionPlaneService;
  sessionTools: ZavorthSessionToolsService;
  gatewaySessionTools: GatewaySessionToolsService | null;
  toolSurface: ZavorthToolSurfaceService;
};

export class WebAppRuntimeInfrastructureService {
  public ensureSurfaceDispatcher(runtime: SharedSurfaceRuntime): SharedSurfaceRuntime {
    return runtime.surfaceTaskDispatcher
      ? runtime
      : {
          ...runtime,
          surfaceTaskDispatcher: new SurfaceTaskDispatchService({
            parser: runtime.parser,
            taskOrchestrationController: runtime.taskOrchestrationController,
          }),
        };
  }

  public buildRealtimeInfrastructure(runtime: SharedSurfaceRuntime): WebAppRealtimeInfrastructure {
    let realtime!: WebRealtimeService;
    const sessionLedger = new GatewaySessionLedgerService();
    const gatewaySessionStore = new GatewaySessionStoreService({
      createWebSession: () => realtime.createSession(),
    });
    const gatewaySessionService = new GatewaySessionService({
      taskManager: runtime.taskManager as any,
      permissionService: runtime.permissionService as any,
      workflowRunService: runtime.workflowRunService as any,
      sessionLedgerService: sessionLedger,
    });
    const gatewaySessionReadModel = new GatewaySessionReadModelService(
      gatewaySessionService,
      {
        sessionStoreService: gatewaySessionStore,
      },
    );
    realtime = new WebRealtimeService(
      runtime.taskManager as any,
      runtime.permissionService as any,
      runtime.permissionController.formatPermissionCreatedMessage.bind(runtime.permissionController),
      runtime.webUserId,
      {
        sessionReadModelService: gatewaySessionReadModel,
        workflowRunService: runtime.workflowRunService as any,
        sessionLedgerService: sessionLedger,
      },
    );
    const gatewayChannelRegistry = new GatewayChannelRegistryService({
      hasDispatcher: Boolean(runtime.surfaceTaskDispatcher),
      canSpawnWeb: true,
    });
    const gatewayChannelRouter = new GatewayChannelRouterService({
      sessionStoreService: gatewaySessionStore,
      sessionReadModelService: gatewaySessionReadModel,
      channelRegistryService: gatewayChannelRegistry,
      surfaceTaskDispatcher: runtime.surfaceTaskDispatcher || null,
    });

    return {
      runtime,
      realtime,
      gatewaySessionStore,
      gatewaySessionService,
      gatewaySessionReadModel,
      gatewayChannelRegistry,
      gatewayChannelRouter,
    };
  }

  public buildRuntimeGatewayInfrastructure(
    input: WebAppRuntimeGatewayInfrastructureInput,
  ): WebAppRuntimeGatewayInfrastructure {
    const sessionTools = new ZavorthSessionToolsService({
      taskManager: input.runtime.taskManager as any,
      gatewaySessionReadModelService: input.gatewaySessionReadModel,
    });
    const gatewaySessionTools = new GatewaySessionToolsService(input.gatewaySessionService, {
      sessionStoreService: input.gatewaySessionStore,
      sessionReadModelService: input.gatewaySessionReadModel,
      channelRouterService: input.gatewayChannelRouter,
    });
    const toolSurface = new ZavorthToolSurfaceService({
      sessionToolsService: sessionTools,
      integrationHubService: input.integrationHub || undefined,
      teamCatalogService: input.teamCatalog || undefined,
      hookPlaneService: input.hookPlane || undefined,
      pluginRegistryService: input.pluginRegistry || undefined,
    });
    const memoryPlane = new ZavorthMemoryPlaneService({
      gatewaySessionReadModelService: input.gatewaySessionReadModel,
      memoryService: new MemoryService(),
      workspaceOperationalMemoryService:
        input.runtime.taskManager && input.runtime.permissionService
          ? new WorkspaceOperationalMemoryService(
              input.runtime.taskManager as any,
              input.runtime.permissionService as any,
            )
          : undefined,
    });
    const sessionPlane = new ZavorthSessionPlaneService({
      sessionToolsService: sessionTools,
      gatewaySessionToolsService: gatewaySessionTools,
      sessionStoreService: input.gatewaySessionStore,
      channelRegistryService: input.gatewayChannelRegistry,
    });
    const gateway = new ZavorthGatewayService({
      capabilityCatalogService: input.capabilityCatalog || undefined,
      channelMeshService: input.channelMesh || undefined,
      memoryPlaneService: input.memoryPlane || memoryPlane,
      securityMeshService: input.securityMesh || undefined,
      runtimeModesService: input.runtimeModes || undefined,
      teamCatalogService: input.teamCatalog || undefined,
      sessionPlaneService: sessionPlane,
      sessionToolsService: sessionTools,
      toolSurfaceService: toolSurface,
      hookPlaneService: input.hookPlane || undefined,
      nodeMeshService: input.nodeMesh || undefined,
      pluginRegistryService: input.pluginRegistry || undefined,
      platformRegistryService: input.platformRegistry || undefined,
      remoteTransportService: input.remoteTransports || undefined,
      operationsHealthService: input.operationsHealth || undefined,
      providerControlPlaneService: input.providerControlPlane || undefined,
      channelRegistryService: input.gatewayChannelRegistry,
    });

    return {
      gateway,
      memoryPlane,
      sessionPlane,
      sessionTools,
      gatewaySessionTools,
      toolSurface,
    };
  }
}

