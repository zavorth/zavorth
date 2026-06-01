import http from 'http';
import fs from 'fs';
import path from 'path';
import { config } from './ZavorthControlServiceDependencies.js';
import { ZavorthControlOperationsRouteService } from '../ZavorthControlOperationsRouteService.js';
import { ZavorthControlPresentationDepsBridgeService } from '../ZavorthControlPresentationDepsBridgeService.js';
import { ZavorthControlOperationsDepsBridgeService } from '../ZavorthControlOperationsDepsBridgeService.js';
import { WebAppOperationsDepsBridgeService } from './ZavorthControlServiceDependencies.js';
import { ZavorthControlOperationsOverviewReaderBridgeService } from '../ZavorthControlOperationsOverviewReaderBridgeService.js';
import { ZavorthControlOperationsOverviewSnapshotService } from '../ZavorthControlOperationsOverviewSnapshotService.js';
import { ZavorthControlCoreRouteService } from '../ZavorthControlCoreRouteService.js';
import { ZavorthControlLegacyRouteService } from '../ZavorthControlLegacyRouteService.js';
import { ZavorthControlHttpSupportService } from '../ZavorthControlHttpSupportService.js';
import { ZavorthControlClassicAccessService } from '../ZavorthControlClassicAccessService.js';
import { ZavorthControlClassicAssetService } from '../ZavorthControlClassicAssetService.js';
import { ZavorthControlResponseWriterService } from '../ZavorthControlResponseWriterService.js';
import { ZavorthChannelActionService } from './ZavorthControlServiceDependencies.js';
import { ZavorthChannelMeshService } from './ZavorthControlServiceDependencies.js';
import { ZavorthGatewayService } from './ZavorthControlServiceDependencies.js';
import { ZavorthHookPlaneService } from './ZavorthControlServiceDependencies.js';
import { ZavorthMemoryPlaneService } from './ZavorthControlServiceDependencies.js';
import { ZavorthLayeredMemoryService } from './ZavorthControlServiceDependencies.js';
import { ZavorthLearningPlaneService } from './ZavorthControlServiceDependencies.js';
import { ZavorthNodeMeshService } from './ZavorthControlServiceDependencies.js';
import { ZavorthPluginRegistryService } from './ZavorthControlServiceDependencies.js';
import { ZavorthPluginActionService } from './ZavorthControlServiceDependencies.js';
import { ZavorthPlatformRegistryService } from './ZavorthControlServiceDependencies.js';
import { ZavorthPlatformCatalogSyncService } from './ZavorthControlServiceDependencies.js';
import { ZavorthPlatformActionService } from './ZavorthControlServiceDependencies.js';
import { ZavorthRemoteTransportActionService } from './ZavorthControlServiceDependencies.js';
import { ZavorthRemoteTransportService } from './ZavorthControlServiceDependencies.js';
import { RemoteTransportDoctorService } from './ZavorthControlServiceDependencies.js';
import { ZavorthSessionPlaneService } from './ZavorthControlServiceDependencies.js';
import { ZavorthSessionToolsService } from './ZavorthControlServiceDependencies.js';
import { ZavorthToolSurfaceService } from './ZavorthControlServiceDependencies.js';
import { GatewayChannelAdapterRegistryService } from './ZavorthControlServiceDependencies.js';
import { GatewayChannelRegistryService } from './ZavorthControlServiceDependencies.js';
import { GatewayChannelRouterService } from './ZavorthControlServiceDependencies.js';
import { GatewaySessionReadModelService } from './ZavorthControlServiceDependencies.js';
import { GatewaySessionService } from './ZavorthControlServiceDependencies.js';
import { GatewaySessionStoreService } from './ZavorthControlServiceDependencies.js';
import { GatewaySessionToolsService } from './ZavorthControlServiceDependencies.js';
import { WorkspaceOperationalMemoryService } from './ZavorthControlServiceDependencies.js';
import { MemoryService } from './ZavorthControlServiceDependencies.js';
import { SessionContinuityService } from './ZavorthControlServiceDependencies.js';
import { WebRuntimeChannelAdapter, TelegramRuntimeChannelAdapter, DiscordRuntimeChannelAdapter, SlackRuntimeChannelAdapter, SignalRuntimeChannelAdapter, IMessageRuntimeChannelAdapter, TeamsRuntimeChannelAdapter, EmailRuntimeChannelAdapter, WhatsAppRuntimeChannelAdapter } from './ZavorthControlServiceDependencies.js';

type ZavorthControlFacadeCompat = any;
type ZavorthControlRuntimeCompat = any;
type ZavorthControlGatewayMapCompat = any;
type ZavorthControlRouteDepsCompat = any;

export function buildRuntimeChannelAdapters(service: ZavorthControlFacadeCompat) {
  const hasRuntimeBackbone = Boolean(service.reportTaskManager && service.reportPermissionService);
  const adapters: any[] = [new WebRuntimeChannelAdapter(hasRuntimeBackbone, hasRuntimeBackbone)];
  const mapping: Array<[string, any]> = [
    ['telegram', TelegramRuntimeChannelAdapter],
    ['discord', DiscordRuntimeChannelAdapter],
    ['slack', SlackRuntimeChannelAdapter],
    ['signal', SignalRuntimeChannelAdapter],
    ['imessage', IMessageRuntimeChannelAdapter],
    ['teams', TeamsRuntimeChannelAdapter],
    ['email', EmailRuntimeChannelAdapter],
    ['whatsapp', WhatsAppRuntimeChannelAdapter],
  ];
  for (const [key, Adapter] of mapping) {
    const gateway = service.channelBroadcastGateways[key] || null;
    if (gateway) {
      adapters.push(new Adapter(gateway, hasRuntimeBackbone));
    }
  }
  return adapters;
}

export function buildRuntimeChannelAdapterRegistryService(service: ZavorthControlFacadeCompat): GatewayChannelAdapterRegistryService {
  const hasRuntimeBackbone = Boolean(service.reportTaskManager && service.reportPermissionService);
  return new GatewayChannelAdapterRegistryService({
    hasDispatcher: hasRuntimeBackbone,
    canSpawnWeb: hasRuntimeBackbone,
    runtimeAdapters: buildRuntimeChannelAdapters(service),
    includeLongTailActivationAdapters: true,
  });
}

export function buildRuntimeChannelRegistryService(service: ZavorthControlFacadeCompat): GatewayChannelRegistryService {
  return new GatewayChannelRegistryService({
    adapterRegistryService: buildRuntimeChannelAdapterRegistryService(service),
  });
}

export function buildChannelMeshService(service: ZavorthControlFacadeCompat): ZavorthChannelMeshService {
  return new ZavorthChannelMeshService({
    channelAdapterRegistryService: buildRuntimeChannelAdapterRegistryService(service),
  });
}

export function buildChannelActionService(service: ZavorthControlFacadeCompat): ZavorthChannelActionService {
  return new ZavorthChannelActionService({
    channelMeshService: service.channelMesh,
    broadcastGateways: service.channelBroadcastGateways,
  });
}

export function refreshRuntimeBackedReporting(service: ZavorthControlFacadeCompat, runtime: ZavorthControlRuntimeCompat): void {
  service.reportTaskManager = runtime.taskManager || null;
  service.reportPermissionService = runtime.permissionService || null;
  service.sessionContinuity = runtime.taskManager ? new SessionContinuityService(runtime.taskManager as any) : null;
  service.continuityUserId = runtime.webUserId || service.continuityUserId || config.allowedUserIds[0] || '1';
  if (!service.productObservabilityInjected) {
    service.productObservability = new (require('./ZavorthControlServiceDependencies.js').ProductObservabilityService)(
      (service.reportTaskManager as any) || null,
      (service.reportPermissionService as any) || null,
      { workflowRunService: service.workflowRuns },
    );
  }
  if (!service.reportServiceInjected) {
    service.operationsReport = new (require('./ZavorthControlServiceDependencies.js').OperationsReportService)(
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
  }
}

export function rebuildRuntimeDependentServices(service: ZavorthControlFacadeCompat): void {
  if (!service.hookPlaneInjected) service.hookPlane = buildHookPlaneService(service);
  if (!service.memoryPlaneInjected) service.memoryPlane = buildMemoryPlaneService(service);
  if (!service.learningPlaneInjected) service.learningPlane = buildLearningPlaneService(service);
  if (!service.layeredMemoryInjected) service.layeredMemory = buildLayeredMemoryService(service);
  if (!service.channelMeshInjected) service.channelMesh = buildChannelMeshService(service);
  if (!service.channelActionsInjected) service.channelActions = buildChannelActionService(service);
  if (!service.nodeInvokeInjected) service.nodeInvoke = buildNodeInvokeService(service);
  if (!service.nodeHeartbeatInjected) service.nodeHeartbeat = buildNodeHeartbeatService(service);
  if (!service.nodeMeshInjected) service.nodeMesh = buildNodeMeshService(service);
  if (!service.remoteTransportsInjected) service.remoteTransports = buildRemoteTransportService(service);
  if (!service.remoteTransportDoctorInjected || !service.remoteTransportsInjected) {
    service.remoteTransportDoctor = buildRemoteTransportDoctorService(service);
  }
  if (!service.remoteTransportActionsInjected) service.remoteTransportActions = buildRemoteTransportActionService(service);
  if (!service.nodePairingInjected) service.nodePairing = buildNodePairingService(service);
  if (!service.pluginRegistryInjected) service.pluginRegistry = buildPluginRegistryService(service);
  if (!service.platformRegistryInjected) service.platformRegistry = buildPlatformRegistryService(service);
  if (!service.platformCatalogSyncInjected) service.platformCatalogSync = buildPlatformCatalogSyncService();
  if (!service.pluginActionsInjected) service.pluginActions = buildPluginActionService(service);
  if (!service.platformActionsInjected) service.platformActions = buildPlatformActionService(service);
  if (!service.sessionPlaneInjected) service.sessionPlane = buildSessionPlaneService(service);
  if (!service.sessionToolsInjected) service.sessionTools = buildSessionToolsService(service);
  if (!service.toolSurfaceInjected) service.toolSurface = buildToolSurfaceService(service);
  if (!service.gatewayInjected) service.gateway = buildGatewayService(service);
}

export function syncWebAppOperationsServices(service: ZavorthControlFacadeCompat): void {
  service.webApp.attachOperationsServices(
    service.webAppOperationsDepsBridge.build({
      ...service,
      buildRuntimeChannelAdapters: () => buildRuntimeChannelAdapters(service),
    }),
  );
}

export function buildZavorthControlOperationsRouteDeps(service: ZavorthControlFacadeCompat): ZavorthControlRouteDepsCompat {
  return service.operationsDepsBridge.buildRouteDeps(
    service as any,
    {
      workspaceRoot: config.projectRoot || process.cwd(),
      continuityUserId: service.continuityUserId || config.allowedUserIds[0] || '1',
    },
  );
}

export function buildZavorthControlPresentationInput(service: ZavorthControlFacadeCompat): ZavorthControlRouteDepsCompat {
  return {
    host: service.host,
    port: service.port,
    snippetUserId: service.continuityUserId || config.allowedUserIds[0] || '1',
    localBaseUrl: service.getUrl(),
    publicBaseUrl: service.getPublicBaseUrl(),
  };
}

export function attachChatRuntime(service: ZavorthControlFacadeCompat, runtime: ZavorthControlRuntimeCompat): void {
  const canonicalRuntime = {
    ...runtime,
    workflowRunService: runtime.workflowRunService || service.workflowRuns,
  };
  service.agentGateway = canonicalRuntime.agentGateway || service.agentGateway || null;
  service.webApp.attachRuntime(canonicalRuntime);
  refreshRuntimeBackedReporting(service, canonicalRuntime);
  rebuildRuntimeDependentServices(service);
  service.agentOperatingSystemActions = new (require('./ZavorthControlServiceDependencies.js').ZavorthAgentOperatingSystemActionService)({
    workflowController: canonicalRuntime.workflowController || null,
    teamCatalogService: service.teamCatalog,
    agentOperatingSystemService: service.agentOperatingSystem,
    capabilityCatalogService: service.capabilityCatalog,
  });
  service.tenantGovernanceActions = new (require('./ZavorthControlServiceDependencies.js').ZavorthTenantGovernanceActionService)({
    tenantGovernanceService: service.tenantGovernance,
    teamCatalogService: service.teamCatalog,
    channelMeshService: service.channelMesh,
    memoryPlaneService: service.memoryPlane,
    runtimeModesService: service.runtimeModes,
    securityMeshService: service.securityMesh,
    sessionPlaneService: service.sessionPlane,
    workflowController: canonicalRuntime.workflowController || null,
    runtimeUserId: canonicalRuntime.webUserId || service.continuityUserId || config.allowedUserIds[0] || '1',
  });
  service.codexRemoteActions = new (require('./ZavorthControlServiceDependencies.js').CodexRemoteActionService)({
    controlPlaneService: service.codexRemote,
    permissionService: (service.reportPermissionService as any) || null,
    runtimeUserId: canonicalRuntime.webUserId || service.continuityUserId || config.allowedUserIds[0] || '1',
  });
  syncWebAppOperationsServices(service);
}

export function attachChannelBroadcastGateways(service: ZavorthControlFacadeCompat, gateways: ZavorthControlGatewayMapCompat): void {
  service.channelBroadcastGateways = gateways;
  if (!service.channelMeshInjected) service.channelMesh = buildChannelMeshService(service);
  if (!service.gatewayInjected) service.gateway = buildGatewayService(service);
  service.channelActions = new ZavorthChannelActionService({
    channelMeshService: service.channelMesh,
    broadcastGateways: gateways,
  });
  syncWebAppOperationsServices(service);
}

export function attachChannelIngressGateways(service: ZavorthControlFacadeCompat, gateways: ZavorthControlGatewayMapCompat): void {
  service.slackIngressGateway = gateways.slack || null;
  service.teamsIngressGateway = gateways.teams || null;
  service.whatsappIngressGateway = gateways.whatsapp || null;
  service.instagramIngressGateway = gateways.instagram || null;
}

export function buildHookPlaneService(service: ZavorthControlFacadeCompat): ZavorthHookPlaneService {
  return new ZavorthHookPlaneService({
    workspaceExtensions: service.workspaceExtensions,
    hookPipelineService: service.hookPipeline,
  });
}

export function buildMemoryPlaneService(service: ZavorthControlFacadeCompat): ZavorthMemoryPlaneService {
  const gatewayReadModel = (service.reportTaskManager || service.reportPermissionService)
    ? new GatewaySessionReadModelService(new GatewaySessionService({
        taskManager: (service.reportTaskManager as any) || null,
        permissionService: (service.reportPermissionService as any) || null,
        workflowRunService: service.workflowRuns,
      }))
    : null;
  return new ZavorthMemoryPlaneService({
    gatewaySessionReadModelService: gatewayReadModel || undefined,
    memoryService: new MemoryService(),
    workspaceOperationalMemoryService:
      service.reportTaskManager && service.reportPermissionService
        ? new WorkspaceOperationalMemoryService(
            service.reportTaskManager as any,
            service.reportPermissionService as any,
          )
        : undefined,
  });
}

export function buildNodeInvokeService(service: ZavorthControlFacadeCompat): ZavorthControlRouteDepsCompat {
  return new (require('./ZavorthControlServiceDependencies.js').NodeInvokeService)({
    registryService: service.nodeRegistry,
    capabilityService: service.nodeCapabilities,
    invocationStoreService: service.nodeInvocationStore,
  });
}

export function buildNodeHeartbeatService(service: ZavorthControlFacadeCompat): ZavorthControlRouteDepsCompat {
  return new (require('./ZavorthControlServiceDependencies.js').NodeHeartbeatService)({
    registryService: service.nodeRegistry,
    invokeService: service.nodeInvoke,
    pairingService: service.nodePairing,
  });
}

export function buildNodeMeshService(service: ZavorthControlFacadeCompat): ZavorthNodeMeshService {
  return new ZavorthNodeMeshService({
    registryService: service.nodeRegistry,
    capabilityService: service.nodeCapabilities,
    invokeService: service.nodeInvoke,
    deviceProfileService: service.nodeDeviceProfiles,
  });
}

export function buildNodePairingService(service: ZavorthControlFacadeCompat): ZavorthControlRouteDepsCompat {
  return new (require('./ZavorthControlServiceDependencies.js').NodePairingService)({
    registryService: service.nodeRegistry,
    capabilityService: service.nodeCapabilities,
    deviceProfileService: service.nodeDeviceProfiles,
  });
}

export function buildPluginRegistryService(service: ZavorthControlFacadeCompat): ZavorthPluginRegistryService {
  return new ZavorthPluginRegistryService({
    integrationHubService: service.integrationHub,
    workspaceExtensions: service.workspaceExtensions,
  });
}

export function buildPluginActionService(service: ZavorthControlFacadeCompat): ZavorthPluginActionService {
  return new ZavorthPluginActionService({
    pluginRegistryService: service.pluginRegistry,
    integrationHubService: service.integrationHub,
  });
}

export function buildPlatformRegistryService(service: ZavorthControlFacadeCompat): ZavorthPlatformRegistryService {
  return new ZavorthPlatformRegistryService({
    pluginRegistryService: service.pluginRegistry,
    learningPlaneService: service.learningPlane,
  });
}

export function buildPlatformCatalogSyncService(): ZavorthPlatformCatalogSyncService {
  return new ZavorthPlatformCatalogSyncService();
}

export function buildPlatformActionService(service: ZavorthControlFacadeCompat): ZavorthPlatformActionService {
  return new ZavorthPlatformActionService({
    platformRegistryService: service.platformRegistry,
    pluginActionService: service.pluginActions,
    learningPlaneService: service.learningPlane,
  });
}

export function buildLearningPlaneService(service: ZavorthControlFacadeCompat): ZavorthLearningPlaneService {
  return new ZavorthLearningPlaneService({
    workflowRunService: service.workflowRuns,
  });
}

export function buildLayeredMemoryService(service: ZavorthControlFacadeCompat): ZavorthLayeredMemoryService {
  return new ZavorthLayeredMemoryService({
    memoryPlaneService: service.memoryPlane,
    sessionPlaneService: service.sessionPlane,
  } as any);
}

export function buildRemoteTransportActionService(service: ZavorthControlFacadeCompat): ZavorthRemoteTransportActionService {
  return new ZavorthRemoteTransportActionService({
    remoteTransportService: service.remoteTransports,
  });
}

export function buildRemoteTransportService(service: ZavorthControlFacadeCompat): ZavorthRemoteTransportService {
  return new ZavorthRemoteTransportService({
    platformRegistryService: service.platformRegistry,
  } as any);
}

export function buildRemoteTransportDoctorService(service: ZavorthControlFacadeCompat): RemoteTransportDoctorService {
  return new RemoteTransportDoctorService({
    remoteTransportService: service.remoteTransports,
  });
}

export function buildSessionPlaneService(service: ZavorthControlFacadeCompat): ZavorthSessionPlaneService {
  if (!service.reportTaskManager && !service.reportPermissionService) {
    return new ZavorthSessionPlaneService();
  }
  const sessionStore = new GatewaySessionStoreService();
  const sessionService = new GatewaySessionService({
    taskManager: (service.reportTaskManager as any) || null,
    permissionService: (service.reportPermissionService as any) || null,
    workflowRunService: service.workflowRuns,
  });
  const readModel = new GatewaySessionReadModelService(sessionService, {
    sessionStoreService: sessionStore,
  });
  const channelRegistry = buildRuntimeChannelRegistryService(service);
  const channelRouter = new GatewayChannelRouterService({
    sessionStoreService: sessionStore,
    sessionReadModelService: readModel,
    channelRegistryService: channelRegistry,
  });
  const gatewaySessionTools = new GatewaySessionToolsService(sessionService, {
    sessionStoreService: sessionStore,
    sessionReadModelService: readModel,
    channelRouterService: channelRouter,
  });
  return new ZavorthSessionPlaneService({
    sessionToolsService: new ZavorthSessionToolsService({
      taskManager: (service.reportTaskManager as any) || null,
      workflowRunService: service.workflowRuns,
      gatewaySessionReadModelService: readModel,
    }),
    gatewaySessionToolsService: gatewaySessionTools,
    sessionStoreService: sessionStore,
    channelRegistryService: channelRegistry,
  });
}

export function buildSessionToolsService(service: ZavorthControlFacadeCompat): ZavorthSessionToolsService {
  const gatewayReadModel = (service.reportTaskManager || service.reportPermissionService)
    ? new GatewaySessionReadModelService(
        new GatewaySessionService({
          taskManager: (service.reportTaskManager as any) || null,
          permissionService: (service.reportPermissionService as any) || null,
          workflowRunService: service.workflowRuns,
        }),
      )
    : null;
  return new ZavorthSessionToolsService({
    taskManager: (service.reportTaskManager as any) || null,
    workflowRunService: service.workflowRuns,
    gatewaySessionReadModelService: gatewayReadModel || undefined,
  });
}

export function buildToolSurfaceService(service: ZavorthControlFacadeCompat): ZavorthToolSurfaceService {
  return new ZavorthToolSurfaceService({
    sessionToolsService: service.sessionTools,
    integrationHubService: service.integrationHub,
    teamCatalogService: service.teamCatalog,
    workspaceExtensions: service.workspaceExtensions,
    hookPlaneService: service.hookPlane,
    pluginRegistryService: service.pluginRegistry,
  });
}

export function buildGatewayService(service: ZavorthControlFacadeCompat): ZavorthGatewayService {
  return new ZavorthGatewayService({
    capabilityCatalogService: service.capabilityCatalog,
    channelMeshService: service.channelMesh,
    memoryPlaneService: service.memoryPlane,
    securityMeshService: service.securityMesh,
    runtimeModesService: service.runtimeModes,
    teamCatalogService: service.teamCatalog,
    sessionPlaneService: service.sessionPlane,
    sessionToolsService: service.sessionTools,
    toolSurfaceService: service.toolSurface,
    nodeMeshService: service.nodeMesh,
    pluginRegistryService: service.pluginRegistry,
    platformRegistryService: service.platformRegistry,
    remoteTransportService: service.remoteTransports,
    operationsHealthService: service.operationsHealth,
    providerControlPlaneService: service.providerControlPlane,
    channelRegistryService: buildRuntimeChannelRegistryService(service),
  });
}

export function routeRequest(service: ZavorthControlFacadeCompat, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', service.getUrl());
  const pathname = service.httpSupport.normalizePath(url.pathname);
  const presentationInput = buildZavorthControlPresentationInput(service);
  const presentationSource = service as any;

  service.httpSupport.applyCorsHeaders(
    req,
    res,
    service.presentationDepsBridge.buildHttpCorsDeps(presentationInput),
  );
    if (service.httpSupport.handlePreflight(req, res)) {
      return Promise.resolve();
    }

  return (async () => {
    if (isRetiredControlSurfacePath(pathname)) {
      service.responseWriter.writeRedirect(res, '/zavorthControl');
      return;
    }

    if (isLegacyWebSurfacePath(pathname)) {
      service.responseWriter.writeJson(
        res,
        {
          ok: false,
          error: 'This web surface has been removed. Use /zavorthControl.',
          zavorthControlUrl: '/zavorthControl',
          visibleSurfaces: ['/zavorthControl', '/satellite', 'cli'],
        },
        410,
      );
      return;
    }

    if (
      pathname === '/zavorthControl'
      || pathname === '/zavorthControl/'
      || pathname === '/zavorthControl'
      || pathname === '/zavorthControl/'
    ) {
      if (serveZavorthControlAsset(res, 'index.html')) return;
      service.responseWriter.writeText(res, 'ZavorthControl not found', 404);
      return;
    }


    if (
      pathname.startsWith('/styles/') ||
      pathname.startsWith('/scripts/') ||
      pathname.startsWith('/assets/')
    ) {
      if (serveZavorthControlAsset(res, pathname.slice(1))) return;
      service.responseWriter.writeText(res, 'Asset not found', 404);
      return;
    }

    if (
      pathname === '/satellite' ||
      pathname === '/satellite/' ||
      pathname.startsWith('/satellite/') ||
      pathname === '/favicon.svg' ||
      pathname === '/icons.svg' ||
      pathname.startsWith('/api/v1') ||
      pathname.startsWith('/api/auth') ||
      (pathname.startsWith('/api/web') && !pathname.startsWith('/api/webhooks'))
    ) {
      const handled = await service.webApp.handleRequest(req, res, url, pathname);
      if (handled) return;
    }

    const handledCore = await service.coreRoutes.handleRequest(
      req,
      res,
      url,
      pathname,
      service.presentationDepsBridge.buildCoreRouteDeps(presentationSource),
    );
    if (handledCore) return;

    if (
      service.classicAccess.requiresAuthorization(pathname) &&
      !service.classicAccess.isAuthorized(
        req,
        service.presentationDepsBridge.buildClassicAccessDeps(presentationSource),
      )
    ) {
      service.responseWriter.writeJson(
        res,
        { ok: false, error: 'ZavorthControl classico permitido apenas localmente ou com token valido.' },
        403,
      );
      return;
    }

    const handledLegacy = await service.legacyRoutes.handleRequest(
      req,
      res,
      url,
      pathname,
      service.presentationDepsBridge.buildLegacyRouteDeps(presentationSource, presentationInput),
    );
    if (handledLegacy) return;

    const handledOperations = await service.operationsRoutes.handleRequest(
      req,
      res,
      url,
      pathname,
      buildZavorthControlOperationsRouteDeps(service),
    );
    if (handledOperations) return;

    if (pathname.startsWith('/api/v2/echo/') || pathname.startsWith('/api/v2/nexus/')) {
      const handledEcho = await service.echoRoutes.handleRequest(
        req,
        res,
        url,
        pathname,
        {
          echo: service.echoService,
          writeJson: (r: any, body: any, status: number) => service.responseWriter.writeJson(r, body, status),
          agentGateway: service.agentGateway || null,
        },
      );
      if (handledEcho) return;
    }

    service.responseWriter.writeText(res, 'Not found', 404);
  })();
}

function serveZavorthControlAsset(res: http.ServerResponse, relativePath: string): boolean {
  const root = path.resolve(process.cwd(), 'assets', 'zavorth-control');
  const target = path.resolve(root, relativePath);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return true;
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    return false;
  }
  const contentType = contentTypeFor(target);
  res.writeHead(200, { 'Content-Type': contentType });
  res.end(fs.readFileSync(target));
  return true;
}

function isRetiredControlSurfacePath(pathname: string): boolean {
  return pathname === '/control/review'
    || pathname === '/control/review/';
}

function isLegacyWebSurfacePath(pathname: string): boolean {
  return pathname === '/app'
    || pathname === '/app/'
    || pathname === '/app.js'
    || pathname === '/styles.css'
    || pathname === '/classic'
    || pathname === '/classic/';
}

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html; charset=utf-8';
  if (ext === '.css') return 'text/css; charset=utf-8';
  if (ext === '.js') return 'text/javascript; charset=utf-8';
  if (ext === '.png') return 'image/png';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

export function handleOperationsActionRequest(service: ZavorthControlFacadeCompat, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  return service.operationsRoutes.handleOperationsActionRequest(
    req,
    res,
    buildZavorthControlOperationsRouteDeps(service),
  );
}

export function getClassicZavorthControlHtml(service: ZavorthControlFacadeCompat): string {
  let auditTrailSummary: string | null = null;
  let auditReplaySummary: string | null = null;

  if (service.operationsHealthInjected) {
    const operationsHealthSnapshot = service.operationsHealth.readSnapshot() as any;
    const lastAudit = operationsHealthSnapshot?.security?.lastAudit || null;
    auditTrailSummary = Number(lastAudit?.totalEvents || 0) > 0
      ? `Trilha: ${String(lastAudit.totalEvents)} evento(s) | ultimo ${String(lastAudit.latestEventType || 'n/d')} | hash ${String(lastAudit.latestChainHash || '').slice(0, 10)}`
      : null;
    auditReplaySummary = Array.isArray(lastAudit?.recentChain) && lastAudit.recentChain.length
      ? `Replay: ${lastAudit.recentChain
          .map((entry: any) => `${String(entry?.eventType || 'evento')} -> ${String(entry?.taskId || 'task')}`)
          .join(' | ')}`
      : null;
  }

  return service.classicAssets.render({
    host: service.host,
    port: service.port,
    publicBaseUrl: service.getPublicBaseUrl(),
    auditTrailSummary,
    auditReplaySummary,
  });
}
