import type { ChannelAdapterContract } from '../../../../contracts/ChannelMeshContract.js';
import { ZavorthPlatformActionService } from '../../../../services/ZavorthPlatformActionService.js';
import { ZavorthPluginActionService } from '../../../../services/ZavorthPluginActionService.js';
import type { WebAppOperationsDeps } from '../../../../services/WebAppService.js';

type RuntimeChannelAdapters = Exclude<WebAppOperationsDeps['runtimeChannelAdapters'], null | undefined>;

export type WebAppOperationsAttachmentState = {
  capabilityCatalog: WebAppOperationsDeps['capabilityCatalogService'];
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
  runtimeModes: WebAppOperationsDeps['runtimeModesService'];
  sessionPlane: WebAppOperationsDeps['sessionPlaneService'];
  sessionTools: WebAppOperationsDeps['sessionToolsService'];
  agentOperatingSystem: WebAppOperationsDeps['agentOperatingSystemService'];
  agentOperatingSystemActions: WebAppOperationsDeps['agentOperatingSystemActionService'];
  teamCatalog: WebAppOperationsDeps['teamCatalogService'];
  tenantGovernance: WebAppOperationsDeps['tenantGovernanceService'];
  tenantGovernanceActions: WebAppOperationsDeps['tenantGovernanceActionService'];
  codexRemote: WebAppOperationsDeps['codexRemoteControlPlaneService'];
  codexRemoteActions: WebAppOperationsDeps['codexRemoteActionService'];
  toolSurface: WebAppOperationsDeps['toolSurfaceService'];
  integrationHub: WebAppOperationsDeps['integrationHubService'];
  operatorBrief: WebAppOperationsDeps['operatorBriefService'];
  operationsHealth: WebAppOperationsDeps['operationsHealthService'];
  operationsActions: WebAppOperationsDeps['operationsActionService'];
  productObservability: WebAppOperationsDeps['productObservabilityService'];
  providerControlPlane: WebAppOperationsDeps['providerControlPlaneService'];
  workspaceExtensions: WebAppOperationsDeps['workspaceExtensionRegistryService'];
  zavorthBridgeMobileAccess: WebAppOperationsDeps['zavorthBridgeMobileAccessService'];
  mcpCapabilityControlPlane: WebAppOperationsDeps['mcpCapabilityControlPlaneService'];
  mcpRuntime: WebAppOperationsDeps['mcpRuntimeService'];
  mcpBrowserDoctor: WebAppOperationsDeps['mcpBrowserDoctorService'];
  AIGatewayGateway: WebAppOperationsDeps['AIGatewayGatewayService'];
  AIGatewayGatewayLauncher: WebAppOperationsDeps['AIGatewayGatewayLauncherService'];
  AIGatewayCompatibilityDoctor: WebAppOperationsDeps['GatewayCompatibilityDoctorService'];
  AIGatewayUpstreamSync: WebAppOperationsDeps['GatewayUpstreamSyncService'];
  runtimeChannelAdapters: RuntimeChannelAdapters;
};

type GatewayRuntimeAttachment = {
  capabilityCatalog: WebAppOperationsDeps['capabilityCatalogService'];
  channelMesh: WebAppOperationsDeps['channelMeshService'];
  memoryPlane: WebAppOperationsDeps['memoryPlaneService'];
  securityMesh: WebAppOperationsDeps['securityMeshService'];
  runtimeModes: WebAppOperationsDeps['runtimeModesService'];
  teamCatalog: WebAppOperationsDeps['teamCatalogService'];
  hookPlane: WebAppOperationsDeps['hookPlaneService'];
  nodeMesh: WebAppOperationsDeps['nodeMeshService'];
  pluginRegistry: WebAppOperationsDeps['pluginRegistryService'];
  platformRegistry: WebAppOperationsDeps['platformRegistryService'];
  remoteTransports: WebAppOperationsDeps['remoteTransportService'];
  operationsHealth: WebAppOperationsDeps['operationsHealthService'];
  providerControlPlane: WebAppOperationsDeps['providerControlPlaneService'];
  aiGatewayGateway: WebAppOperationsDeps['AIGatewayGatewayService'];
  integrationHub: WebAppOperationsDeps['integrationHubService'];
  gateway: WebAppOperationsDeps['gatewayService'];
  runtimeChannelAdapters: ChannelAdapterContract[];
};

export class WebAppOperationsAttachmentService {
  public apply(
    state: WebAppOperationsAttachmentState,
    deps: WebAppOperationsDeps,
  ): void {
    state.capabilityCatalog = deps.capabilityCatalogService || null;
    state.channelActions = deps.channelActionService || null;
    state.channelMesh = deps.channelMeshService || null;
    state.gateway = deps.gatewayService || null;
    state.hookPipeline = deps.hookPipelineService || null;
    state.hookPlane = deps.hookPlaneService || null;
    state.memoryPlane = deps.memoryPlaneService || null;
    state.layeredMemory = deps.layeredMemoryService || null;
    state.learningPlane = deps.learningPlaneService || null;
    state.nodeMesh = deps.nodeMeshService || null;
    state.nodeHeartbeat = deps.nodeHeartbeatService || null;
    state.nodeInvoke = deps.nodeInvokeService || null;
    state.nodePairing = deps.nodePairingService || null;
    state.pluginActions = deps.pluginActionService
      || (deps.pluginRegistryService || deps.integrationHubService
        ? new ZavorthPluginActionService({
            pluginRegistryService: deps.pluginRegistryService || undefined,
            integrationHubService: deps.integrationHubService || undefined,
          })
        : null);
    state.platformActions = deps.platformActionService
      || (deps.platformRegistryService
        ? new ZavorthPlatformActionService({
            platformRegistryService: deps.platformRegistryService || undefined,
            pluginActionService: state.pluginActions || undefined,
          })
        : null);
    state.pluginRegistry = deps.pluginRegistryService || null;
    state.platformRegistry = deps.platformRegistryService || null;
    state.platformCatalogSync = deps.platformCatalogSyncService || null;
    state.platformPublisher = deps.platformPublisherService || null;
    state.remoteTransportDoctor = deps.remoteTransportDoctorService || null;
    state.remoteTransportActions = deps.remoteTransportActionService || null;
    state.remoteTransports = deps.remoteTransportService || null;
    state.securityMesh = deps.securityMeshService || null;
    state.runtimeModes = deps.runtimeModesService || null;
    state.sessionPlane = deps.sessionPlaneService || null;
    state.sessionTools = deps.sessionToolsService || null;
    state.agentOperatingSystem = deps.agentOperatingSystemService || null;
    state.agentOperatingSystemActions = deps.agentOperatingSystemActionService || null;
    state.teamCatalog = deps.teamCatalogService || null;
    state.tenantGovernance = deps.tenantGovernanceService || null;
    state.tenantGovernanceActions = deps.tenantGovernanceActionService || null;
    state.codexRemote = deps.codexRemoteControlPlaneService || null;
    state.codexRemoteActions = deps.codexRemoteActionService || null;
    state.toolSurface = deps.toolSurfaceService || null;
    state.integrationHub = deps.integrationHubService || null;
    state.operatorBrief = deps.operatorBriefService || null;
    state.operationsHealth = deps.operationsHealthService || null;
    state.operationsActions = deps.operationsActionService || null;
    state.productObservability = deps.productObservabilityService || null;
    state.providerControlPlane = deps.providerControlPlaneService || null;
    state.workspaceExtensions = deps.workspaceExtensionRegistryService || null;
    state.zavorthBridgeMobileAccess = deps.zavorthBridgeMobileAccessService || null;
    state.mcpCapabilityControlPlane = deps.mcpCapabilityControlPlaneService || null;
    state.mcpRuntime = deps.mcpRuntimeService || null;
    state.mcpBrowserDoctor = deps.mcpBrowserDoctorService || null;
    state.AIGatewayGateway = deps.AIGatewayGatewayService || null;
    state.AIGatewayGatewayLauncher = deps.AIGatewayGatewayLauncherService || null;
    state.AIGatewayCompatibilityDoctor = deps.GatewayCompatibilityDoctorService || null;
    state.AIGatewayUpstreamSync = deps.GatewayUpstreamSyncService || null;
    state.runtimeChannelAdapters = Array.isArray(deps.runtimeChannelAdapters)
      ? deps.runtimeChannelAdapters.slice()
      : [];
  }

  public buildGatewayRuntimeAttachment(
    state: WebAppOperationsAttachmentState,
  ): GatewayRuntimeAttachment {
    return {
      capabilityCatalog: state.capabilityCatalog,
      channelMesh: state.channelMesh,
      memoryPlane: state.memoryPlane,
      securityMesh: state.securityMesh,
      runtimeModes: state.runtimeModes,
      teamCatalog: state.teamCatalog,
      hookPlane: state.hookPlane,
      nodeMesh: state.nodeMesh,
      pluginRegistry: state.pluginRegistry,
      platformRegistry: state.platformRegistry,
      remoteTransports: state.remoteTransports,
      operationsHealth: state.operationsHealth,
      providerControlPlane: state.providerControlPlane,
      aiGatewayGateway: state.AIGatewayGateway,
      integrationHub: state.integrationHub,
      gateway: state.gateway,
      runtimeChannelAdapters: state.runtimeChannelAdapters.slice(),
    };
  }
}

