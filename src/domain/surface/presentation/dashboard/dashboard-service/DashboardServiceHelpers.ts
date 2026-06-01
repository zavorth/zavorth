import http from 'http';
import fs from 'fs';
import path from 'path';
import { config } from './DashboardServiceDependencies.js';
import { DashboardOperationsRouteService } from '../DashboardOperationsRouteService.js';
import { DashboardPresentationDepsBridgeService } from '../DashboardPresentationDepsBridgeService.js';
import { DashboardOperationsDepsBridgeService } from '../DashboardOperationsDepsBridgeService.js';
import { WebAppOperationsDepsBridgeService } from './DashboardServiceDependencies.js';
import { DashboardOperationsOverviewReaderBridgeService } from '../DashboardOperationsOverviewReaderBridgeService.js';
import { DashboardOperationsOverviewSnapshotService } from '../DashboardOperationsOverviewSnapshotService.js';
import { DashboardCoreRouteService } from '../DashboardCoreRouteService.js';
import { DashboardLegacyRouteService } from '../DashboardLegacyRouteService.js';
import { DashboardHttpSupportService } from '../DashboardHttpSupportService.js';
import { DashboardClassicAccessService } from '../DashboardClassicAccessService.js';
import { DashboardClassicAssetService } from '../DashboardClassicAssetService.js';
import { DashboardResponseWriterService } from '../DashboardResponseWriterService.js';
import { ZavorthChannelActionService } from './DashboardServiceDependencies.js';
import { ZavorthChannelMeshService } from './DashboardServiceDependencies.js';
import { ZavorthGatewayService } from './DashboardServiceDependencies.js';
import { ZavorthHookPlaneService } from './DashboardServiceDependencies.js';
import { ZavorthMemoryPlaneService } from './DashboardServiceDependencies.js';
import { ZavorthLayeredMemoryService } from './DashboardServiceDependencies.js';
import { ZavorthLearningPlaneService } from './DashboardServiceDependencies.js';
import { ZavorthNodeMeshService } from './DashboardServiceDependencies.js';
import { ZavorthPluginRegistryService } from './DashboardServiceDependencies.js';
import { ZavorthPluginActionService } from './DashboardServiceDependencies.js';
import { ZavorthPlatformRegistryService } from './DashboardServiceDependencies.js';
import { ZavorthPlatformCatalogSyncService } from './DashboardServiceDependencies.js';
import { ZavorthPlatformActionService } from './DashboardServiceDependencies.js';
import { ZavorthRemoteTransportActionService } from './DashboardServiceDependencies.js';
import { ZavorthRemoteTransportService } from './DashboardServiceDependencies.js';
import { RemoteTransportDoctorService } from './DashboardServiceDependencies.js';
import { ZavorthSessionPlaneService } from './DashboardServiceDependencies.js';
import { ZavorthSessionToolsService } from './DashboardServiceDependencies.js';
import { ZavorthToolSurfaceService } from './DashboardServiceDependencies.js';
import { GatewayChannelAdapterRegistryService } from './DashboardServiceDependencies.js';
import { GatewayChannelRegistryService } from './DashboardServiceDependencies.js';
import { GatewayChannelRouterService } from './DashboardServiceDependencies.js';
import { GatewaySessionReadModelService } from './DashboardServiceDependencies.js';
import { GatewaySessionService } from './DashboardServiceDependencies.js';
import { GatewaySessionStoreService } from './DashboardServiceDependencies.js';
import { GatewaySessionToolsService } from './DashboardServiceDependencies.js';
import { WorkspaceOperationalMemoryService } from './DashboardServiceDependencies.js';
import { MemoryService } from './DashboardServiceDependencies.js';
import { SessionContinuityService } from './DashboardServiceDependencies.js';
import { WebRuntimeChannelAdapter, TelegramRuntimeChannelAdapter, DiscordRuntimeChannelAdapter, SlackRuntimeChannelAdapter, SignalRuntimeChannelAdapter, IMessageRuntimeChannelAdapter, TeamsRuntimeChannelAdapter, EmailRuntimeChannelAdapter, WhatsAppRuntimeChannelAdapter } from './DashboardServiceDependencies.js';

type DashboardFacadeCompat = any;
type DashboardRuntimeCompat = any;
type DashboardGatewayMapCompat = any;
type DashboardRouteDepsCompat = any;

export function buildRuntimeChannelAdapters(service: DashboardFacadeCompat) {
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

export function buildRuntimeChannelAdapterRegistryService(service: DashboardFacadeCompat): GatewayChannelAdapterRegistryService {
  const hasRuntimeBackbone = Boolean(service.reportTaskManager && service.reportPermissionService);
  return new GatewayChannelAdapterRegistryService({
    hasDispatcher: hasRuntimeBackbone,
    canSpawnWeb: hasRuntimeBackbone,
    runtimeAdapters: buildRuntimeChannelAdapters(service),
    includeLongTailActivationAdapters: true,
  });
}

export function buildRuntimeChannelRegistryService(service: DashboardFacadeCompat): GatewayChannelRegistryService {
  return new GatewayChannelRegistryService({
    adapterRegistryService: buildRuntimeChannelAdapterRegistryService(service),
  });
}

export function buildChannelMeshService(service: DashboardFacadeCompat): ZavorthChannelMeshService {
  return new ZavorthChannelMeshService({
    channelAdapterRegistryService: buildRuntimeChannelAdapterRegistryService(service),
  });
}

export function buildChannelActionService(service: DashboardFacadeCompat): ZavorthChannelActionService {
  return new ZavorthChannelActionService({
    channelMeshService: service.channelMesh,
    broadcastGateways: service.channelBroadcastGateways,
  });
}

export function refreshRuntimeBackedReporting(service: DashboardFacadeCompat, runtime: DashboardRuntimeCompat): void {
  service.reportTaskManager = runtime.taskManager || null;
  service.reportPermissionService = runtime.permissionService || null;
  service.sessionContinuity = runtime.taskManager ? new SessionContinuityService(runtime.taskManager as any) : null;
  service.continuityUserId = runtime.webUserId || service.continuityUserId || config.allowedUserIds[0] || '1';
  if (!service.productObservabilityInjected) {
    service.productObservability = new (require('./DashboardServiceDependencies.js').ProductObservabilityService)(
      (service.reportTaskManager as any) || null,
      (service.reportPermissionService as any) || null,
      { workflowRunService: service.workflowRuns },
    );
  }
  if (!service.reportServiceInjected) {
    service.operationsReport = new (require('./DashboardServiceDependencies.js').OperationsReportService)(
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

export function rebuildRuntimeDependentServices(service: DashboardFacadeCompat): void {
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

export function syncWebAppOperationsServices(service: DashboardFacadeCompat): void {
  service.webApp.attachOperationsServices(
    service.webAppOperationsDepsBridge.build({
      ...service,
      buildRuntimeChannelAdapters: () => buildRuntimeChannelAdapters(service),
    }),
  );
}

export function buildDashboardOperationsRouteDeps(service: DashboardFacadeCompat): DashboardRouteDepsCompat {
  return service.operationsDepsBridge.buildRouteDeps(
    service as any,
    {
      workspaceRoot: config.projectRoot || process.cwd(),
      continuityUserId: service.continuityUserId || config.allowedUserIds[0] || '1',
    },
  );
}

export function buildDashboardPresentationInput(service: DashboardFacadeCompat): DashboardRouteDepsCompat {
  return {
    host: service.host,
    port: service.port,
    snippetUserId: service.continuityUserId || config.allowedUserIds[0] || '1',
    localBaseUrl: service.getUrl(),
    publicBaseUrl: service.getPublicBaseUrl(),
  };
}

export function attachChatRuntime(service: DashboardFacadeCompat, runtime: DashboardRuntimeCompat): void {
  const canonicalRuntime = {
    ...runtime,
    workflowRunService: runtime.workflowRunService || service.workflowRuns,
  };
  service.agentGateway = canonicalRuntime.agentGateway || service.agentGateway || null;
  service.webApp.attachRuntime(canonicalRuntime);
  refreshRuntimeBackedReporting(service, canonicalRuntime);
  rebuildRuntimeDependentServices(service);
  service.agentOperatingSystemActions = new (require('./DashboardServiceDependencies.js').ZavorthAgentOperatingSystemActionService)({
    workflowController: canonicalRuntime.workflowController || null,
    teamCatalogService: service.teamCatalog,
    agentOperatingSystemService: service.agentOperatingSystem,
    capabilityCatalogService: service.capabilityCatalog,
  });
  service.tenantGovernanceActions = new (require('./DashboardServiceDependencies.js').ZavorthTenantGovernanceActionService)({
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
  service.codexRemoteActions = new (require('./DashboardServiceDependencies.js').CodexRemoteActionService)({
    controlPlaneService: service.codexRemote,
    permissionService: (service.reportPermissionService as any) || null,
    runtimeUserId: canonicalRuntime.webUserId || service.continuityUserId || config.allowedUserIds[0] || '1',
  });
  syncWebAppOperationsServices(service);
}

export function attachChannelBroadcastGateways(service: DashboardFacadeCompat, gateways: DashboardGatewayMapCompat): void {
  service.channelBroadcastGateways = gateways;
  if (!service.channelMeshInjected) service.channelMesh = buildChannelMeshService(service);
  if (!service.gatewayInjected) service.gateway = buildGatewayService(service);
  service.channelActions = new ZavorthChannelActionService({
    channelMeshService: service.channelMesh,
    broadcastGateways: gateways,
  });
  syncWebAppOperationsServices(service);
}

export function attachChannelIngressGateways(service: DashboardFacadeCompat, gateways: DashboardGatewayMapCompat): void {
  service.slackIngressGateway = gateways.slack || null;
  service.teamsIngressGateway = gateways.teams || null;
  service.whatsappIngressGateway = gateways.whatsapp || null;
  service.instagramIngressGateway = gateways.instagram || null;
}

export function buildHookPlaneService(service: DashboardFacadeCompat): ZavorthHookPlaneService {
  return new ZavorthHookPlaneService({
    workspaceExtensions: service.workspaceExtensions,
    hookPipelineService: service.hookPipeline,
  });
}

export function buildMemoryPlaneService(service: DashboardFacadeCompat): ZavorthMemoryPlaneService {
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

export function buildNodeInvokeService(service: DashboardFacadeCompat): DashboardRouteDepsCompat {
  return new (require('./DashboardServiceDependencies.js').NodeInvokeService)({
    registryService: service.nodeRegistry,
    capabilityService: service.nodeCapabilities,
    invocationStoreService: service.nodeInvocationStore,
  });
}

export function buildNodeHeartbeatService(service: DashboardFacadeCompat): DashboardRouteDepsCompat {
  return new (require('./DashboardServiceDependencies.js').NodeHeartbeatService)({
    registryService: service.nodeRegistry,
    invokeService: service.nodeInvoke,
    pairingService: service.nodePairing,
  });
}

export function buildNodeMeshService(service: DashboardFacadeCompat): ZavorthNodeMeshService {
  return new ZavorthNodeMeshService({
    registryService: service.nodeRegistry,
    capabilityService: service.nodeCapabilities,
    invokeService: service.nodeInvoke,
    deviceProfileService: service.nodeDeviceProfiles,
  });
}

export function buildNodePairingService(service: DashboardFacadeCompat): DashboardRouteDepsCompat {
  return new (require('./DashboardServiceDependencies.js').NodePairingService)({
    registryService: service.nodeRegistry,
    capabilityService: service.nodeCapabilities,
    deviceProfileService: service.nodeDeviceProfiles,
  });
}

export function buildPluginRegistryService(service: DashboardFacadeCompat): ZavorthPluginRegistryService {
  return new ZavorthPluginRegistryService({
    integrationHubService: service.integrationHub,
    workspaceExtensions: service.workspaceExtensions,
  });
}

export function buildPluginActionService(service: DashboardFacadeCompat): ZavorthPluginActionService {
  return new ZavorthPluginActionService({
    pluginRegistryService: service.pluginRegistry,
    integrationHubService: service.integrationHub,
  });
}

export function buildPlatformRegistryService(service: DashboardFacadeCompat): ZavorthPlatformRegistryService {
  return new ZavorthPlatformRegistryService({
    pluginRegistryService: service.pluginRegistry,
    learningPlaneService: service.learningPlane,
  });
}

export function buildPlatformCatalogSyncService(): ZavorthPlatformCatalogSyncService {
  return new ZavorthPlatformCatalogSyncService();
}

export function buildPlatformActionService(service: DashboardFacadeCompat): ZavorthPlatformActionService {
  return new ZavorthPlatformActionService({
    platformRegistryService: service.platformRegistry,
    pluginActionService: service.pluginActions,
    learningPlaneService: service.learningPlane,
  });
}

export function buildLearningPlaneService(service: DashboardFacadeCompat): ZavorthLearningPlaneService {
  return new ZavorthLearningPlaneService({
    workflowRunService: service.workflowRuns,
  });
}

export function buildLayeredMemoryService(service: DashboardFacadeCompat): ZavorthLayeredMemoryService {
  return new ZavorthLayeredMemoryService({
    memoryPlaneService: service.memoryPlane,
    sessionPlaneService: service.sessionPlane,
  } as any);
}

export function buildRemoteTransportActionService(service: DashboardFacadeCompat): ZavorthRemoteTransportActionService {
  return new ZavorthRemoteTransportActionService({
    remoteTransportService: service.remoteTransports,
  });
}

export function buildRemoteTransportService(service: DashboardFacadeCompat): ZavorthRemoteTransportService {
  return new ZavorthRemoteTransportService({
    platformRegistryService: service.platformRegistry,
  } as any);
}

export function buildRemoteTransportDoctorService(service: DashboardFacadeCompat): RemoteTransportDoctorService {
  return new RemoteTransportDoctorService({
    remoteTransportService: service.remoteTransports,
  });
}

export function buildSessionPlaneService(service: DashboardFacadeCompat): ZavorthSessionPlaneService {
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

export function buildSessionToolsService(service: DashboardFacadeCompat): ZavorthSessionToolsService {
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

export function buildToolSurfaceService(service: DashboardFacadeCompat): ZavorthToolSurfaceService {
  return new ZavorthToolSurfaceService({
    sessionToolsService: service.sessionTools,
    integrationHubService: service.integrationHub,
    teamCatalogService: service.teamCatalog,
    workspaceExtensions: service.workspaceExtensions,
    hookPlaneService: service.hookPlane,
    pluginRegistryService: service.pluginRegistry,
  });
}

export function buildGatewayService(service: DashboardFacadeCompat): ZavorthGatewayService {
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

export function routeRequest(service: DashboardFacadeCompat, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', service.getUrl());
  const pathname = service.httpSupport.normalizePath(url.pathname);
  const presentationInput = buildDashboardPresentationInput(service);
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
      service.responseWriter.writeRedirect(res, '/dashboard');
      return;
    }

    if (isLegacyWebSurfacePath(pathname)) {
      service.responseWriter.writeJson(
        res,
        {
          ok: false,
          error: 'This web surface has been removed. Use /dashboard.',
          dashboardUrl: '/dashboard',
          visibleSurfaces: ['/dashboard', '/satellite', 'cli'],
        },
        410,
      );
      return;
    }

    if (
      pathname === '/dashboard'
      || pathname === '/dashboard/'
      || pathname === '/dashboard'
      || pathname === '/dashboard/'
    ) {
      if (serveDashboardAsset(res, 'index.html')) return;
      service.responseWriter.writeText(res, 'Dashboard not found', 404);
      return;
    }


    if (
      pathname.startsWith('/styles/') ||
      pathname.startsWith('/scripts/') ||
      pathname.startsWith('/assets/')
    ) {
      if (serveDashboardAsset(res, pathname.slice(1))) return;
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
        { ok: false, error: 'Dashboard classico permitido apenas localmente ou com token valido.' },
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
      buildDashboardOperationsRouteDeps(service),
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

function serveDashboardAsset(res: http.ServerResponse, relativePath: string): boolean {
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
  return pathname === '/dashboard/review'
    || pathname === '/dashboard/review/';
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

export function handleOperationsActionRequest(service: DashboardFacadeCompat, req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  return service.operationsRoutes.handleOperationsActionRequest(
    req,
    res,
    buildDashboardOperationsRouteDeps(service),
  );
}

export function getClassicDashboardHtml(service: DashboardFacadeCompat): string {
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
