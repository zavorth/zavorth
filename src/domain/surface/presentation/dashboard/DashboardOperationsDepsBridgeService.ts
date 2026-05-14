import type { DashboardOperationalSnapshotDeps } from './DashboardOperationalSnapshotService.js';
import type { DashboardOperationsOverviewSnapshotDeps } from './DashboardOperationsOverviewSnapshotService.js';
import type { DashboardOperationsRouteDeps } from './DashboardOperationsRouteService.js';
import type { DashboardOperationsOverviewReaderBridgeService } from './DashboardOperationsOverviewReaderBridgeService.js';

export type DashboardOperationsDepsBridgeInput = {
  workspaceRoot: string;
  continuityUserId: string;
};

export type DashboardOperationsDepsBridgeSource = {
  continuityUserId: string | null;
  authService: DashboardOperationsRouteDeps['auth']['authService'];
  classicAccess: {
    isLoopbackAddress: DashboardOperationsRouteDeps['auth']['isLoopbackAddress'];
    resolveDashboardToken: DashboardOperationsRouteDeps['auth']['resolveDashboardToken'];
  };
  operationsHealth: DashboardOperationsRouteDeps['operationsHealth'];
  operationsCockpit: DashboardOperationsRouteDeps['operationsCockpit'];
  operatorBrief: DashboardOperationsRouteDeps['operatorBrief'];
  productObservability: DashboardOperationsRouteDeps['productObservability'];
  accessManifest: DashboardOperationsRouteDeps['accessManifest'];
  capabilityCatalog: DashboardOperationsRouteDeps['capabilityCatalog'];
  gateway: DashboardOperationsRouteDeps['gateway'];
  sessionTools: DashboardOperationsRouteDeps['sessionTools'];
  sessionPlane: DashboardOperationsRouteDeps['sessionPlane'];
  toolSurface: DashboardOperationsRouteDeps['toolSurface'];
  remoteTransports: DashboardOperationsRouteDeps['remoteTransports'];
  remoteTransportDoctor: DashboardOperationsRouteDeps['remoteTransportDoctor'];
  remoteTransportActions: DashboardOperationsRouteDeps['remoteTransportActions'];
  pluginRegistry: DashboardOperationsRouteDeps['pluginRegistry'];
  pluginActions: DashboardOperationsRouteDeps['pluginActions'];
  platformRegistry: DashboardOperationsRouteDeps['platformRegistry'];
  platformActions: DashboardOperationsRouteDeps['platformActions'];
  platformCatalogSync: DashboardOperationsRouteDeps['platformCatalogSync'];
  platformPublisher: DashboardOperationsRouteDeps['platformPublisher'];
  hookPlane: DashboardOperationsRouteDeps['hookPlane'];
  hookPipeline: DashboardOperationsRouteDeps['hookPipeline'];
  runtimeModes: DashboardOperationsRouteDeps['runtimeModes'];
  securityMesh: DashboardOperationsRouteDeps['securityMesh'];
  workspaceExtensions: DashboardOperationsRouteDeps['workspaceExtensions'];
  channelMesh: DashboardOperationsRouteDeps['channelMesh'];
  channelActions: DashboardOperationsRouteDeps['channelActions'];
  nodeMesh: DashboardOperationsRouteDeps['nodeMesh'];
  nodeInvoke: DashboardOperationsRouteDeps['nodeInvoke'];
  nodePairing: DashboardOperationsRouteDeps['nodePairing'];
  nodeHeartbeat: DashboardOperationsRouteDeps['nodeHeartbeat'];
  teamCatalog: DashboardOperationsRouteDeps['teamCatalog'];
  integrationHub: DashboardOperationsRouteDeps['integrationHub'];
  operationsReport: DashboardOperationsRouteDeps['operationsReport'];
  operationsActions: DashboardOperationsRouteDeps['operationsActions'];
  operationsOverviewBridge: Pick<
    DashboardOperationsOverviewReaderBridgeService,
    | 'readOperationalOverviewSnapshot'
    | 'readTrustOverviewSnapshot'
    | 'readProductOverviewSnapshot'
    | 'readControlPlaneCatalogSnapshot'
  >;
  operationalSnapshots: {
    readContinuitySnapshot: (deps: DashboardOperationalSnapshotDeps) => Record<string, any>;
    readMemoryPlaneSnapshot: (deps: DashboardOperationalSnapshotDeps) => Promise<Record<string, any>>;
    readReplaySnapshot: (deps: DashboardOperationalSnapshotDeps) => Record<string, any>;
    readLifecycleSnapshot: (deps: DashboardOperationalSnapshotDeps) => Record<string, any>;
    readHandoffSnapshot: (deps: DashboardOperationalSnapshotDeps) => Record<string, any>;
  };
  responseWriter: {
    writeJson: DashboardOperationsRouteDeps['writeJson'];
  };
  httpSupport: {
    readJsonBody: DashboardOperationsRouteDeps['readJsonBody'];
  };
  sessionContinuity: DashboardOperationalSnapshotDeps['sessionContinuity'];
  memoryPlane: DashboardOperationalSnapshotDeps['memoryPlane'];
  sessionReplay: DashboardOperationalSnapshotDeps['sessionReplay'];
  sessionHandoff: DashboardOperationalSnapshotDeps['sessionHandoff'];
  workflowRuns: DashboardOperationalSnapshotDeps['workflowRuns'];
  reportTaskManager: unknown;
  executionGateway: DashboardOperationalSnapshotDeps['hostActions'];
  layeredMemory: DashboardOperationsOverviewSnapshotDeps['layeredMemory'];
  learningPlane: DashboardOperationsOverviewSnapshotDeps['learningPlane'];
  tenantGovernance: DashboardOperationsOverviewSnapshotDeps['tenantGovernance'];
  mcpCapabilityControlPlane: DashboardOperationsOverviewSnapshotDeps['mcpCapabilityControlPlane'];
  skillLibraryPresentation: DashboardOperationsOverviewSnapshotDeps['skillLibraryPresentation'];
  skillInstallPlanPresentation: DashboardOperationsOverviewSnapshotDeps['skillInstallPlanPresentation'];
  mcpRuntime: DashboardOperationsOverviewSnapshotDeps['mcpRuntime'];
};

export class DashboardOperationsDepsBridgeService {
  public buildRouteDeps(
    source: DashboardOperationsDepsBridgeSource,
    input: DashboardOperationsDepsBridgeInput,
  ): DashboardOperationsRouteDeps {
    const operationalSnapshotDeps = this.buildOperationalSnapshotDeps(source, input);
    return {
      auth: {
        authService: source.authService,
        isLoopbackAddress: source.classicAccess.isLoopbackAddress,
        resolveDashboardToken: source.classicAccess.resolveDashboardToken,
      },
      continuityUserId: source.continuityUserId,
      operationsHealth: source.operationsHealth,
      operationsCockpit: source.operationsCockpit,
      operatorBrief: source.operatorBrief,
      productObservability: source.productObservability,
      accessManifest: source.accessManifest,
      capabilityCatalog: source.capabilityCatalog,
      gateway: source.gateway,
      sessionTools: source.sessionTools,
      sessionPlane: source.sessionPlane,
      toolSurface: source.toolSurface,
      remoteTransports: source.remoteTransports,
      remoteTransportDoctor: source.remoteTransportDoctor,
      remoteTransportActions: source.remoteTransportActions,
      pluginRegistry: source.pluginRegistry,
      pluginActions: source.pluginActions,
      platformRegistry: source.platformRegistry,
      platformActions: source.platformActions,
      platformCatalogSync: source.platformCatalogSync,
      platformPublisher: source.platformPublisher,
      hookPlane: source.hookPlane,
      hookPipeline: source.hookPipeline,
      runtimeModes: source.runtimeModes,
      securityMesh: source.securityMesh,
      workspaceExtensions: source.workspaceExtensions,
      channelMesh: source.channelMesh,
      channelActions: source.channelActions,
      nodeMesh: source.nodeMesh,
      nodeInvoke: source.nodeInvoke,
      nodePairing: source.nodePairing,
      nodeHeartbeat: source.nodeHeartbeat,
      teamCatalog: source.teamCatalog,
      integrationHub: source.integrationHub,
      operationsReport: source.operationsReport,
      operationsActions: source.operationsActions,
      readOperationsOverviewSnapshot: source.operationsOverviewBridge.readOperationalOverviewSnapshot.bind(source.operationsOverviewBridge),
      readOperationsTrustOverviewSnapshot: source.operationsOverviewBridge.readTrustOverviewSnapshot.bind(source.operationsOverviewBridge),
      readOperationsProductOverviewSnapshot: source.operationsOverviewBridge.readProductOverviewSnapshot.bind(source.operationsOverviewBridge),
      readOperationsControlPlaneCatalogSnapshot: source.operationsOverviewBridge.readControlPlaneCatalogSnapshot.bind(source.operationsOverviewBridge),
      readOperationsContinuitySnapshot: () => source.operationalSnapshots.readContinuitySnapshot(operationalSnapshotDeps),
      readOperationsMemoryPlaneSnapshot: () => source.operationalSnapshots.readMemoryPlaneSnapshot(operationalSnapshotDeps),
      readOperationsReplaySnapshot: () => source.operationalSnapshots.readReplaySnapshot(operationalSnapshotDeps),
      readOperationsLifecycleSnapshot: () => source.operationalSnapshots.readLifecycleSnapshot(operationalSnapshotDeps),
      readOperationsHandoffSnapshot: () => source.operationalSnapshots.readHandoffSnapshot(operationalSnapshotDeps),
      writeJson: source.responseWriter.writeJson.bind(source.responseWriter),
      readJsonBody: source.httpSupport.readJsonBody.bind(source.httpSupport),
    };
  }

  public buildOperationalSnapshotDeps(
    source: DashboardOperationsDepsBridgeSource,
    input: DashboardOperationsDepsBridgeInput,
  ): DashboardOperationalSnapshotDeps {
    return {
      continuityUserId: input.continuityUserId,
      sessionContinuity: source.sessionContinuity,
      memoryPlane: source.memoryPlane,
      sessionReplay: source.sessionReplay,
      sessionHandoff: source.sessionHandoff,
      workflowRuns: source.workflowRuns,
      taskManager: (source.reportTaskManager as any) || null,
      hostActions: source.executionGateway,
    };
  }

  public buildOverviewSnapshotDeps(
    source: DashboardOperationsDepsBridgeSource,
    input: DashboardOperationsDepsBridgeInput,
  ): DashboardOperationsOverviewSnapshotDeps {
    return {
      workspaceRoot: input.workspaceRoot,
      continuityUserId: input.continuityUserId,
      channelMesh: source.channelMesh,
      nodeMesh: source.nodeMesh,
      remoteTransports: source.remoteTransports,
      accessManifest: source.accessManifest,
      remoteTransportDoctor: source.remoteTransportDoctor,
      memoryPlane: source.memoryPlane,
      layeredMemory: source.layeredMemory,
      learningPlane: source.learningPlane,
      workflowRuns: source.workflowRuns,
      executionGateway: source.executionGateway,
      tenantGovernance: source.tenantGovernance,
      securityMesh: source.securityMesh,
      pluginRegistry: source.pluginRegistry,
      platformRegistry: source.platformRegistry,
      teamCatalog: source.teamCatalog,
      workspaceExtensions: source.workspaceExtensions,
      mcpCapabilityControlPlane: source.mcpCapabilityControlPlane,
      integrationHub: source.integrationHub,
      skillLibraryPresentation: source.skillLibraryPresentation,
      skillInstallPlanPresentation: source.skillInstallPlanPresentation,
      mcpRuntime: source.mcpRuntime,
      productObservability: source.productObservability,
      operatorBrief: source.operatorBrief,
      operationsHealth: source.operationsHealth,
    };
  }
}

