import * as http from 'http';
import {
  DashboardOperationsNodeRouteService,
  type DashboardOperationsNodeRouteDeps,
} from './DashboardOperationsNodeRouteService.js';
import {
  DashboardOperationsIntegrationRouteService,
  type DashboardOperationsIntegrationRouteDeps,
} from './DashboardOperationsIntegrationRouteService.js';
import {
  DashboardOperationsPlaneRouteService,
  type DashboardOperationsPlaneRouteDeps,
} from './DashboardOperationsPlaneRouteService.js';
import {
  DashboardOperationsRuntimeRouteService,
  type DashboardOperationsRuntimeRouteDeps,
} from './DashboardOperationsRuntimeRouteService.js';
import {
  DashboardOperationsSnapshotRouteService,
  type DashboardOperationsSnapshotRouteDeps,
} from './DashboardOperationsSnapshotRouteService.js';
import {
  DashboardOperationsActionRouteService,
  type DashboardOperationsActionRouteDeps,
} from './DashboardOperationsActionRouteService.js';

type WriteJson = (res: http.ServerResponse, body: unknown, statusCode?: number) => void;
type ReadJsonBody = (req: http.IncomingMessage) => Promise<RouteCompatRecord>;
type RouteCompatPayload = any;
type RouteCompatRecord = Record<string, RouteCompatPayload>;

type SnapshotReader = {
  readSnapshot: () => RouteCompatPayload;
};

type SnapshotBuilder = {
  buildSnapshot: (input?: RouteCompatPayload) => RouteCompatPayload;
};

type AsyncPipelineBuilder = {
  buildSnapshot: (workspaceHint?: string | null) => Promise<RouteCompatPayload>;
  buildExecutionPlan: (input: { workspace: string; event: string }) => Promise<RouteCompatPayload[]>;
  runEvent: (input: { workspace: string; event: string; dryRun?: boolean }) => Promise<RouteCompatPayload>;
};

type AsyncSnapshotBuilder = {
  buildSnapshot: (input?: RouteCompatPayload) => Promise<RouteCompatPayload>;
};

type OperationsReportBuilder = {
  buildSnapshot: (
    referenceDate?: Date,
    overviewReaders?: {
      readOperationalOverviewSnapshot?: () => Promise<RouteCompatRecord>;
      readTrustOverviewSnapshot?: () => Promise<RouteCompatRecord>;
      readProductOverviewSnapshot?: () => Promise<RouteCompatRecord>;
    },
  ) => Promise<RouteCompatPayload>;
};

type HydratedGatewayBuilder = {
  buildHydratedSnapshot: (input: RouteCompatPayload) => Promise<RouteCompatPayload>;
};

type ManifestBuilder = {
  buildManifest: () => Promise<RouteCompatPayload>;
};

type TransportActionExecutor = {
  execute: (input: RouteCompatPayload) => Promise<RouteCompatPayload>;
};

type PlatformCatalogSyncExecutor = {
  sync: () => Promise<RouteCompatPayload>;
};

type PlatformPublisherExecutor = {
  publishDetailed: (input: {
    packagePath: string;
    authToken: string;
    signLocal: boolean;
  }) => Promise<RouteCompatPayload>;
};

type MaybeAsyncActionExecutor = {
  execute: (input: RouteCompatPayload) => RouteCompatPayload | Promise<RouteCompatPayload>;
};

type RemoteTransportDoctorLike = {
  run: (input?: { selectedId?: string | null }) => Promise<RouteCompatPayload>;
  readLastReport?: (input?: { selectedId?: string | null }) => RouteCompatPayload;
};

type RemoteTransportActionPlaneLike = {
  execute: (input: RouteCompatPayload) => Promise<RouteCompatPayload>;
  readHistory?: (input?: { transportId?: string | null; limit?: number | null }) => RouteCompatPayload;
};

type OperationsActionExecutor = {
  execute: (actionId: string) => RouteCompatPayload;
};

type NodeMeshLike = {
  buildSnapshot: (input?: RouteCompatPayload) => RouteCompatPayload;
};

type NodeInvokeLike = {
  invoke: (input: RouteCompatPayload) => RouteCompatPayload;
};

type NodePairingLike = {
  createPairingDraft: (input: RouteCompatPayload) => RouteCompatPayload;
  approvePairing: (nodeId: string, input: RouteCompatPayload) => RouteCompatPayload;
  revokePairing: (nodeId: string, reason: string | null) => RouteCompatPayload;
};

type NodeHeartbeatLike = {
  claimPairing: (input: RouteCompatPayload) => RouteCompatPayload;
  receiveHeartbeat: (input: RouteCompatPayload) => RouteCompatPayload;
};

type IntegrationHubLike = {
  buildCatalogSnapshot: (selectedId?: string | null) => RouteCompatPayload;
  executeGuidedAction: (integrationId: string, actionId: string, context: RouteCompatPayload) => Promise<RouteCompatPayload>;
};

type DashboardAuthLike = {
  validate: (token: string | null) => boolean;
};

type DashboardAuthorizationDeps = {
  authService: DashboardAuthLike;
  isLoopbackAddress: (remoteAddress: string | undefined) => boolean;
  resolveDashboardToken: (req: http.IncomingMessage) => string | null;
};

export type DashboardOperationsRouteDeps = {
  auth: DashboardAuthorizationDeps;
  continuityUserId: string | null;
  operationsHealth: SnapshotReader;
  operationsCockpit: SnapshotReader;
  operatorBrief: SnapshotReader;
  productObservability: AsyncSnapshotBuilder;
  accessManifest: ManifestBuilder;
  capabilityCatalog: SnapshotBuilder;
  gateway: HydratedGatewayBuilder;
  sessionTools: SnapshotBuilder;
  sessionPlane: AsyncSnapshotBuilder;
  toolSurface: SnapshotBuilder;
  remoteTransports: SnapshotBuilder;
  remoteTransportActions: RemoteTransportActionPlaneLike;
  remoteTransportDoctor: RemoteTransportDoctorLike;
  pluginRegistry: SnapshotBuilder;
  pluginActions: TransportActionExecutor;
  platformRegistry: SnapshotBuilder;
  platformActions: TransportActionExecutor;
  platformCatalogSync: PlatformCatalogSyncExecutor;
  platformPublisher: PlatformPublisherExecutor;
  hookPlane: SnapshotBuilder;
  hookPipeline: AsyncPipelineBuilder;
  workspaceExtensions: SnapshotBuilder;
  runtimeModes: SnapshotBuilder;
  securityMesh: SnapshotBuilder;
  channelMesh: SnapshotBuilder;
  channelActions: MaybeAsyncActionExecutor;
  nodeMesh: NodeMeshLike;
  nodeInvoke: NodeInvokeLike;
  nodePairing: NodePairingLike;
  nodeHeartbeat: NodeHeartbeatLike;
  teamCatalog: SnapshotBuilder;
  integrationHub: IntegrationHubLike;
  operationsReport: OperationsReportBuilder;
  operationsActions: OperationsActionExecutor;
  readOperationsOverviewSnapshot: () => Promise<RouteCompatRecord>;
  readOperationsTrustOverviewSnapshot: () => Promise<RouteCompatRecord>;
  readOperationsProductOverviewSnapshot: () => Promise<RouteCompatRecord>;
  readOperationsControlPlaneCatalogSnapshot: () => Promise<RouteCompatRecord>;
  readOperationsContinuitySnapshot: () => RouteCompatRecord;
  readOperationsMemoryPlaneSnapshot: () => Promise<RouteCompatRecord>;
  readOperationsReplaySnapshot: () => RouteCompatRecord;
  readOperationsLifecycleSnapshot: () => RouteCompatRecord;
  readOperationsHandoffSnapshot: () => RouteCompatRecord;
  writeJson: WriteJson;
  readJsonBody: ReadJsonBody;
};

export class DashboardOperationsRouteService {
  private readonly actionRoutes = new DashboardOperationsActionRouteService();
  private readonly integrationRoutes = new DashboardOperationsIntegrationRouteService();
  private readonly nodeRoutes = new DashboardOperationsNodeRouteService();
  private readonly planeRoutes = new DashboardOperationsPlaneRouteService();
  private readonly runtimeRoutes = new DashboardOperationsRuntimeRouteService();
  private readonly snapshotRoutes = new DashboardOperationsSnapshotRouteService();

  public async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    url: URL,
    pathname: string,
    deps: DashboardOperationsRouteDeps,
  ): Promise<boolean> {
    if (!pathname.startsWith('/api/operations')) {
      return false;
    }

    if (
      await this.snapshotRoutes.handleRequest(
        req,
        res,
        url,
        pathname,
        this.buildSnapshotRouteDeps(deps),
      )
    ) {
      return true;
    }

    if (await this.runtimeRoutes.handleRequest(req, res, url, pathname, this.buildRuntimeRouteDeps(deps))) {
      return true;
    }

    if (
      await this.planeRoutes.handleRequest(
        req,
        res,
        url,
        pathname,
        this.buildPlaneRoutingDeps(deps),
      )
    ) {
      return true;
    }

    if (await this.nodeRoutes.handleRequest(req, res, url, pathname, this.buildNodeRouteDeps(deps))) {
      return true;
    }

    if (
      await this.integrationRoutes.handleRequest(
        req,
        res,
        url,
        pathname,
        this.buildIntegrationRouteDeps(deps),
      )
    ) {
      return true;
    }

    if (await this.actionRoutes.handleRequest(req, res, pathname, this.buildActionRouteDeps(deps))) {
      return true;
    }

    return false;
  }

  public async handleOperationsActionRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: DashboardOperationsRouteDeps,
  ): Promise<void> {
    await this.actionRoutes.handleRequest(req, res, '/api/operations/actions', this.buildActionRouteDeps(deps));
  }

  private buildNodeRouteDeps(
    deps: DashboardOperationsRouteDeps,
  ): DashboardOperationsNodeRouteDeps {
    return {
      continuityUserId: deps.continuityUserId,
      nodeMesh: deps.nodeMesh,
      nodeInvoke: deps.nodeInvoke,
      nodePairing: deps.nodePairing,
      nodeHeartbeat: deps.nodeHeartbeat,
      readJsonBody: deps.readJsonBody,
      writeJson: deps.writeJson,
      ensureAuthorized: (req, res, errorMessage, statusCode) =>
        this.ensureAuthorized(req, res, deps, errorMessage, statusCode),
    };
  }

  private buildIntegrationRouteDeps(
    deps: DashboardOperationsRouteDeps,
  ): DashboardOperationsIntegrationRouteDeps {
    return {
      integrationHub: deps.integrationHub,
      readJsonBody: deps.readJsonBody,
      writeJson: deps.writeJson,
      ensureAuthorized: (req, res, errorMessage, statusCode) =>
        this.ensureAuthorized(req, res, deps, errorMessage, statusCode),
    };
  }

  private buildPlaneRoutingDeps(
    deps: DashboardOperationsRouteDeps,
  ): DashboardOperationsPlaneRouteDeps {
    return {
      remoteTransports: deps.remoteTransports,
      remoteTransportActions: deps.remoteTransportActions,
      remoteTransportDoctor: deps.remoteTransportDoctor,
      pluginRegistry: deps.pluginRegistry,
      pluginActions: deps.pluginActions,
      platformRegistry: deps.platformRegistry,
      platformActions: deps.platformActions,
      platformCatalogSync: deps.platformCatalogSync,
      platformPublisher: deps.platformPublisher,
      hookPlane: deps.hookPlane,
      hookPipeline: deps.hookPipeline,
      workspaceExtensions: deps.workspaceExtensions,
      channelMesh: deps.channelMesh,
      channelActions: deps.channelActions,
      workspaceRoot: process.cwd(),
      readJsonBody: deps.readJsonBody,
      writeJson: deps.writeJson,
    };
  }

  private buildRuntimeRouteDeps(
    deps: DashboardOperationsRouteDeps,
  ): DashboardOperationsRuntimeRouteDeps {
    return {
      continuityUserId: deps.continuityUserId,
      gateway: deps.gateway,
      sessionTools: deps.sessionTools,
      sessionPlane: deps.sessionPlane,
      toolSurface: deps.toolSurface,
      writeJson: deps.writeJson,
    };
  }

  private buildSnapshotRouteDeps(
    deps: DashboardOperationsRouteDeps,
  ): DashboardOperationsSnapshotRouteDeps {
    return {
      operationsHealth: deps.operationsHealth,
      operationsCockpit: deps.operationsCockpit,
      operatorBrief: deps.operatorBrief,
      productObservability: deps.productObservability,
      accessManifest: deps.accessManifest,
      capabilityCatalog: deps.capabilityCatalog,
      hookPlane: deps.hookPlane,
      runtimeModes: deps.runtimeModes,
      securityMesh: deps.securityMesh,
      teamCatalog: deps.teamCatalog,
      operationsReport: deps.operationsReport,
      readOperationsOverviewSnapshot: deps.readOperationsOverviewSnapshot,
      readOperationsTrustOverviewSnapshot: deps.readOperationsTrustOverviewSnapshot,
      readOperationsProductOverviewSnapshot: deps.readOperationsProductOverviewSnapshot,
      readOperationsControlPlaneCatalogSnapshot: deps.readOperationsControlPlaneCatalogSnapshot,
      readOperationsContinuitySnapshot: deps.readOperationsContinuitySnapshot,
      readOperationsMemoryPlaneSnapshot: deps.readOperationsMemoryPlaneSnapshot,
      readOperationsReplaySnapshot: deps.readOperationsReplaySnapshot,
      readOperationsLifecycleSnapshot: deps.readOperationsLifecycleSnapshot,
      readOperationsHandoffSnapshot: deps.readOperationsHandoffSnapshot,
      writeJson: deps.writeJson,
    };
  }

  private buildActionRouteDeps(
    deps: DashboardOperationsRouteDeps,
  ): DashboardOperationsActionRouteDeps {
    return {
      operationsActions: deps.operationsActions,
      readJsonBody: deps.readJsonBody,
      writeJson: deps.writeJson,
      ensureAuthorized: (req, res, errorMessage, statusCode) =>
        this.ensureAuthorized(req, res, deps, errorMessage, statusCode),
    };
  }

  private ensureAuthorized(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    deps: DashboardOperationsRouteDeps,
    errorMessage: string,
    statusCode: number,
  ): boolean {
    const authorized =
      deps.auth.isLoopbackAddress(req.socket.remoteAddress) ||
      deps.auth.authService.validate(deps.auth.resolveDashboardToken(req));
    if (authorized) {
      return true;
    }

    deps.writeJson(res, { ok: false, error: errorMessage }, statusCode);
    return false;
  }
}

