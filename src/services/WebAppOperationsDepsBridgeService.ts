import type { WebAppOperationsDeps } from './WebAppService.js';

type RuntimeChannelAdapters = Exclude<WebAppOperationsDeps['runtimeChannelAdapters'], null | undefined>;

export type WebAppOperationsDepsBridgeSource = {
  channelActions: WebAppOperationsDeps['channelActionService'];
  channelMesh: WebAppOperationsDeps['channelMeshService'];
  gateway: WebAppOperationsDeps['gatewayService'];
  hookPipeline: WebAppOperationsDeps['hookPipelineService'];
  hookPlane: WebAppOperationsDeps['hookPlaneService'];
  memoryPlane: WebAppOperationsDeps['memoryPlaneService'];
  layeredMemory: WebAppOperationsDeps['layeredMemoryService'];
  learningPlane: WebAppOperationsDeps['learningPlaneService'];
  nodeMesh: WebAppOperationsDeps['nodeMeshService'];
  nodeHeartbeat: WebAppOperationsDeps['nodeHeartbeatService'];
  nodeInvoke: WebAppOperationsDeps['nodeInvokeService'];
  nodePairing: WebAppOperationsDeps['nodePairingService'];
  pluginActions: WebAppOperationsDeps['pluginActionService'];
  platformActions: WebAppOperationsDeps['platformActionService'];
  pluginRegistry: WebAppOperationsDeps['pluginRegistryService'];
  platformRegistry: WebAppOperationsDeps['platformRegistryService'];
  platformCatalogSync: WebAppOperationsDeps['platformCatalogSyncService'];
  platformPublisher: WebAppOperationsDeps['platformPublisherService'];
  remoteTransportDoctor: WebAppOperationsDeps['remoteTransportDoctorService'];
  remoteTransportActions: WebAppOperationsDeps['remoteTransportActionService'];
  remoteTransports: WebAppOperationsDeps['remoteTransportService'];
  securityMesh: WebAppOperationsDeps['securityMeshService'];
  sessionPlane: WebAppOperationsDeps['sessionPlaneService'];
  sessionTools: WebAppOperationsDeps['sessionToolsService'];
  agentOperatingSystem: WebAppOperationsDeps['agentOperatingSystemService'];
  agentOperatingSystemActions: WebAppOperationsDeps['agentOperatingSystemActionService'];
  toolSurface: WebAppOperationsDeps['toolSurfaceService'];
  capabilityCatalog: WebAppOperationsDeps['capabilityCatalogService'];
  runtimeModes: WebAppOperationsDeps['runtimeModesService'];
  teamCatalog: WebAppOperationsDeps['teamCatalogService'];
  tenantGovernance: WebAppOperationsDeps['tenantGovernanceService'];
  tenantGovernanceActions: WebAppOperationsDeps['tenantGovernanceActionService'];
  codexRemote: WebAppOperationsDeps['codexRemoteControlPlaneService'];
  codexRemoteActions: WebAppOperationsDeps['codexRemoteActionService'];
  integrationHub: WebAppOperationsDeps['integrationHubService'];
  providerControlPlane: WebAppOperationsDeps['providerControlPlaneService'];
  workspaceExtensions: WebAppOperationsDeps['workspaceExtensionRegistryService'];
  operatorBrief: WebAppOperationsDeps['operatorBriefService'];
  operationsHealth: WebAppOperationsDeps['operationsHealthService'];
  operationsActions: WebAppOperationsDeps['operationsActionService'];
  productObservability: WebAppOperationsDeps['productObservabilityService'];
  zavorthBridgeMobileAccess: WebAppOperationsDeps['zavorthBridgeMobileAccessService'];
  mcpCapabilityControlPlane: WebAppOperationsDeps['mcpCapabilityControlPlaneService'];
  mcpRuntime: WebAppOperationsDeps['mcpRuntimeService'];
  mcpBrowserDoctor: WebAppOperationsDeps['mcpBrowserDoctorService'];
  AIGatewayGateway: WebAppOperationsDeps['AIGatewayGatewayService'];
  AIGatewayGatewayLauncher: WebAppOperationsDeps['AIGatewayGatewayLauncherService'];
  AIGatewayCompatibilityDoctor: WebAppOperationsDeps['GatewayCompatibilityDoctorService'];
  AIGatewayUpstreamSync: WebAppOperationsDeps['GatewayUpstreamSyncService'];
  buildRuntimeChannelAdapters: () => RuntimeChannelAdapters;
};

export class WebAppOperationsDepsBridgeService {
  public build(source: WebAppOperationsDepsBridgeSource): WebAppOperationsDeps {
    const runtimeChannelAdapters = source.buildRuntimeChannelAdapters().slice();

    return {
      channelActionService: source.channelActions,
      channelMeshService: source.channelMesh,
      gatewayService: source.gateway,
      hookPipelineService: source.hookPipeline,
      hookPlaneService: source.hookPlane,
      memoryPlaneService: source.memoryPlane,
      layeredMemoryService: source.layeredMemory,
      learningPlaneService: source.learningPlane,
      nodeMeshService: source.nodeMesh,
      nodeHeartbeatService: source.nodeHeartbeat,
      nodeInvokeService: source.nodeInvoke,
      nodePairingService: source.nodePairing,
      pluginActionService: source.pluginActions,
      platformActionService: source.platformActions,
      pluginRegistryService: source.pluginRegistry,
      platformRegistryService: source.platformRegistry,
      platformCatalogSyncService: source.platformCatalogSync,
      platformPublisherService: source.platformPublisher,
      remoteTransportDoctorService: source.remoteTransportDoctor,
      remoteTransportActionService: source.remoteTransportActions,
      remoteTransportService: source.remoteTransports,
      securityMeshService: source.securityMesh,
      sessionPlaneService: source.sessionPlane,
      sessionToolsService: source.sessionTools,
      agentOperatingSystemService: source.agentOperatingSystem,
      agentOperatingSystemActionService: source.agentOperatingSystemActions,
      toolSurfaceService: source.toolSurface,
      capabilityCatalogService: source.capabilityCatalog,
      runtimeModesService: source.runtimeModes,
      teamCatalogService: source.teamCatalog,
      tenantGovernanceService: source.tenantGovernance,
      tenantGovernanceActionService: source.tenantGovernanceActions,
      codexRemoteControlPlaneService: source.codexRemote,
      codexRemoteActionService: source.codexRemoteActions,
      integrationHubService: source.integrationHub,
      providerControlPlaneService: source.providerControlPlane,
      workspaceExtensionRegistryService: source.workspaceExtensions,
      operatorBriefService: source.operatorBrief,
      operationsHealthService: source.operationsHealth,
      operationsActionService: source.operationsActions,
      productObservabilityService: source.productObservability,
      zavorthBridgeMobileAccessService: source.zavorthBridgeMobileAccess,
      mcpCapabilityControlPlaneService: source.mcpCapabilityControlPlane,
      mcpRuntimeService: source.mcpRuntime,
      mcpBrowserDoctorService: source.mcpBrowserDoctor,
      AIGatewayGatewayService: source.AIGatewayGateway,
      AIGatewayGatewayLauncherService: source.AIGatewayGatewayLauncher,
      GatewayCompatibilityDoctorService: source.AIGatewayCompatibilityDoctor,
      GatewayUpstreamSyncService: source.AIGatewayUpstreamSync,
      runtimeChannelAdapters,
    };
  }
}
