import type { ZavorthControlOperationalSnapshotDeps } from './ZavorthControlOperationalSnapshotService.js';
import type { ZavorthControlOperationsOverviewSnapshotDeps } from './ZavorthControlOperationsOverviewSnapshotService.js';
import type { ZavorthControlOperationsRouteDeps } from './ZavorthControlOperationsRouteService.js';
import type { ZavorthControlOperationsOverviewReaderBridgeService } from './ZavorthControlOperationsOverviewReaderBridgeService.js';

export type ZavorthControlOperationsDepsBridgeInput = {
  workspaceRoot: string;
  continuityUserId: string;
};

export type ZavorthControlOperationsDepsBridgeSource = {
  continuityUserId: string | null;
  authService: ZavorthControlOperationsRouteDeps['auth']['authService'];
  classicAccess: {
    isLoopbackAddress: ZavorthControlOperationsRouteDeps['auth']['isLoopbackAddress'];
    resolveZavorthControlToken: ZavorthControlOperationsRouteDeps['auth']['resolveZavorthControlToken'];
  };
  operationsHealth: ZavorthControlOperationsRouteDeps['operationsHealth'];
  operationsCockpit: ZavorthControlOperationsRouteDeps['operationsCockpit'];
  operatorBrief: ZavorthControlOperationsRouteDeps['operatorBrief'];
  productObservability: ZavorthControlOperationsRouteDeps['productObservability'];
  accessManifest: ZavorthControlOperationsRouteDeps['accessManifest'];
  capabilityCatalog: ZavorthControlOperationsRouteDeps['capabilityCatalog'];
  gateway: ZavorthControlOperationsRouteDeps['gateway'];
  sessionTools: ZavorthControlOperationsRouteDeps['sessionTools'];
  sessionPlane: ZavorthControlOperationsRouteDeps['sessionPlane'];
  toolSurface: ZavorthControlOperationsRouteDeps['toolSurface'];
  remoteTransports: ZavorthControlOperationsRouteDeps['remoteTransports'];
  remoteTransportDoctor: ZavorthControlOperationsRouteDeps['remoteTransportDoctor'];
  remoteTransportActions: ZavorthControlOperationsRouteDeps['remoteTransportActions'];
  pluginRegistry: ZavorthControlOperationsRouteDeps['pluginRegistry'];
  pluginActions: ZavorthControlOperationsRouteDeps['pluginActions'];
  platformRegistry: ZavorthControlOperationsRouteDeps['platformRegistry'];
  platformActions: ZavorthControlOperationsRouteDeps['platformActions'];
  platformCatalogSync: ZavorthControlOperationsRouteDeps['platformCatalogSync'];
  platformPublisher: ZavorthControlOperationsRouteDeps['platformPublisher'];
  hookPlane: ZavorthControlOperationsRouteDeps['hookPlane'];
  hookPipeline: ZavorthControlOperationsRouteDeps['hookPipeline'];
  runtimeModes: ZavorthControlOperationsRouteDeps['runtimeModes'];
  securityMesh: ZavorthControlOperationsRouteDeps['securityMesh'];
  workspaceExtensions: ZavorthControlOperationsRouteDeps['workspaceExtensions'];
  channelMesh: ZavorthControlOperationsRouteDeps['channelMesh'];
  channelActions: ZavorthControlOperationsRouteDeps['channelActions'];
  nodeMesh: ZavorthControlOperationsRouteDeps['nodeMesh'];
  nodeInvoke: ZavorthControlOperationsRouteDeps['nodeInvoke'];
  nodePairing: ZavorthControlOperationsRouteDeps['nodePairing'];
  nodeHeartbeat: ZavorthControlOperationsRouteDeps['nodeHeartbeat'];
  teamCatalog: ZavorthControlOperationsRouteDeps['teamCatalog'];
  integrationHub: ZavorthControlOperationsRouteDeps['integrationHub'];
  operationsReport: ZavorthControlOperationsRouteDeps['operationsReport'];
  operationsActions: ZavorthControlOperationsRouteDeps['operationsActions'];
  operationsOverviewBridge: Pick<
    ZavorthControlOperationsOverviewReaderBridgeService,
    | 'readOperationalOverviewSnapshot'
    | 'readTrustOverviewSnapshot'
    | 'readProductOverviewSnapshot'
    | 'readControlPlaneCatalogSnapshot'
  >;
  operationalSnapshots: {
    readContinuitySnapshot: (deps: ZavorthControlOperationalSnapshotDeps) => Record<string, unknown>;
    readMemoryPlaneSnapshot: (deps: ZavorthControlOperationalSnapshotDeps) => Promise<Record<string, unknown>>;
    readReplaySnapshot: (deps: ZavorthControlOperationalSnapshotDeps) => Record<string, unknown>;
    readLifecycleSnapshot: (deps: ZavorthControlOperationalSnapshotDeps) => Record<string, unknown>;
    readHandoffSnapshot: (deps: ZavorthControlOperationalSnapshotDeps) => Record<string, unknown>;
  };
  responseWriter: {
    writeJson: ZavorthControlOperationsRouteDeps['writeJson'];
  };
  httpSupport: {
    readJsonBody: ZavorthControlOperationsRouteDeps['readJsonBody'];
  };
  sessionContinuity: ZavorthControlOperationalSnapshotDeps['sessionContinuity'];
  memoryPlane: ZavorthControlOperationalSnapshotDeps['memoryPlane'];
  sessionReplay: ZavorthControlOperationalSnapshotDeps['sessionReplay'];
  sessionHandoff: ZavorthControlOperationalSnapshotDeps['sessionHandoff'];
  workflowRuns: ZavorthControlOperationalSnapshotDeps['workflowRuns'];
  reportTaskManager: unknown;
  executionGateway: ZavorthControlOperationalSnapshotDeps['hostActions'];
  layeredMemory: ZavorthControlOperationsOverviewSnapshotDeps['layeredMemory'];
  learningPlane: ZavorthControlOperationsOverviewSnapshotDeps['learningPlane'];
  tenantGovernance: ZavorthControlOperationsOverviewSnapshotDeps['tenantGovernance'];
  mcpCapabilityControlPlane: ZavorthControlOperationsOverviewSnapshotDeps['mcpCapabilityControlPlane'];
  skillLibraryPresentation: ZavorthControlOperationsOverviewSnapshotDeps['skillLibraryPresentation'];
  skillInstallPlanPresentation: ZavorthControlOperationsOverviewSnapshotDeps['skillInstallPlanPresentation'];
  mcpRuntime: ZavorthControlOperationsOverviewSnapshotDeps['mcpRuntime'];
};

export class ZavorthControlOperationsDepsBridgeService {
  public buildRouteDeps(
    source: ZavorthControlOperationsDepsBridgeSource,
    input: ZavorthControlOperationsDepsBridgeInput,
  ): ZavorthControlOperationsRouteDeps {
    const operationalSnapshotDeps = this.buildOperationalSnapshotDeps(source, input);
    return {
      auth: {
        authService: source.authService,
        isLoopbackAddress: source.classicAccess.isLoopbackAddress,
        resolveZavorthControlToken: source.classicAccess.resolveZavorthControlToken,
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
    source: ZavorthControlOperationsDepsBridgeSource,
    input: ZavorthControlOperationsDepsBridgeInput,
  ): ZavorthControlOperationalSnapshotDeps {
    return {
      continuityUserId: input.continuityUserId,
      sessionContinuity: source.sessionContinuity,
      memoryPlane: source.memoryPlane,
      sessionReplay: source.sessionReplay,
      sessionHandoff: source.sessionHandoff,
      workflowRuns: source.workflowRuns,
      taskManager: (source.reportTaskManager as never) || null,
      hostActions: source.executionGateway,
    };
  }

  public buildOverviewSnapshotDeps(
    source: ZavorthControlOperationsDepsBridgeSource,
    input: ZavorthControlOperationsDepsBridgeInput,
  ): ZavorthControlOperationsOverviewSnapshotDeps {
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

