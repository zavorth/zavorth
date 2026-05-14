import type { ChannelAdapterContract } from '../../../../contracts/ChannelMeshContract.js';
import type { AutomaticBrowserDoctorService } from '../../../../mcp/AutomaticBrowserDoctorService.js';
import type { McpRuntimeService } from '../../../../mcp/McpRuntimeService.js';
import type { OperatorBriefService } from '../../../../observability/OperatorBriefService.js';
import type { OperationsHealthService } from '../../../../observability/OperationsHealthService.js';
import type { ProductObservabilityService } from '../../../../observability/ProductObservabilityService.js';
import type { ZavorthPackagePublisher } from '../../../../platform/publish/ZavorthPackagePublisher.js';
import type { RuntimeAccessManifestService } from '../../../../runtime/access/RuntimeAccessManifestService.js';
import type { RuntimeAccessReadinessService } from '../../../../runtime/access/RuntimeAccessReadinessService.js';
import type { RuntimeInstallJourneyService } from '../../../../runtime/access/RuntimeInstallJourneyService.js';
import type { RuntimeOfficialRemoteAccessService } from '../../../../runtime/access/RuntimeOfficialRemoteAccessService.js';
import type { RuntimeRemoteAccessService } from '../../../../runtime/access/RuntimeRemoteAccessService.js';
import type { ZavorthSessionToolsService } from '../../../../runtime/sessions/ZavorthSessionToolsService.js';
import type { GatewaySessionReadModelService } from '../../../../runtime/sessions/GatewaySessionReadModelService.js';
import type { GatewaySessionService } from '../../../../runtime/sessions/GatewaySessionService.js';
import type { GatewaySessionStoreService } from '../../../../runtime/sessions/GatewaySessionStoreService.js';
import type { GatewaySessionToolsService } from '../../../../runtime/sessions/GatewaySessionToolsService.js';
import type { AIGatewayProxyService } from '../../../../services/AIGatewayProxyService.js';
import type { ZavorthBridgeMobileAccessService } from '../../../../services/ZavorthBridgeMobileAccessService.js';
import type { ZavorthAgentOperatingSystemActionService } from '../../../../services/ZavorthAgentOperatingSystemActionService.js';
import type { ZavorthAgentOperatingSystemService } from '../../../../services/ZavorthAgentOperatingSystemService.js';
import type { ZavorthCapabilityCatalogService } from '../../../../services/ZavorthCapabilityCatalogService.js';
import type { ZavorthChannelActionService } from '../../../../services/ZavorthChannelActionService.js';
import type { ZavorthChannelMeshService } from '../../../../services/ZavorthChannelMeshService.js';
import type { ZavorthGatewayLauncherService } from '../../../../services/ZavorthGatewayLauncherService.js';
import type { ZavorthGatewayService } from '../../../../services/ZavorthGatewayService.js';
import type { ZavorthHookPipelineService } from '../../../../services/ZavorthHookPipelineService.js';
import type { ZavorthHookPlaneService } from '../../../../services/ZavorthHookPlaneService.js';
import type { ZavorthLayeredMemoryService } from '../../../../services/ZavorthLayeredMemoryService.js';
import type { ZavorthLearningPlaneService } from '../../../../services/ZavorthLearningPlaneService.js';
import type { ZavorthMemoryPlaneService } from '../../../../services/ZavorthMemoryPlaneService.js';
import type { ZavorthNodeMeshService } from '../../../../services/ZavorthNodeMeshService.js';
import type { ZavorthPlatformActionService } from '../../../../services/ZavorthPlatformActionService.js';
import type { ZavorthPlatformCatalogSyncService } from '../../../../services/ZavorthPlatformCatalogSyncService.js';
import type { ZavorthPlatformRegistryService } from '../../../../services/ZavorthPlatformRegistryService.js';
import type { ZavorthPluginActionService } from '../../../../services/ZavorthPluginActionService.js';
import type { ZavorthPluginRegistryService } from '../../../../services/ZavorthPluginRegistryService.js';
import type { ZavorthRemoteTransportActionService } from '../../../../services/ZavorthRemoteTransportActionService.js';
import type { ZavorthRemoteTransportService } from '../../../../services/ZavorthRemoteTransportService.js';
import type { ZavorthRuntimeModesService } from '../../../../services/ZavorthRuntimeModesService.js';
import type { ZavorthSecurityMeshService } from '../../../../services/ZavorthSecurityMeshService.js';
import type { ZavorthSessionPlaneService } from '../../../../services/ZavorthSessionPlaneService.js';
import type { ZavorthTeamCatalogService } from '../../../../services/ZavorthTeamCatalogService.js';
import type { ZavorthTenantGovernanceActionService } from '../../../../services/ZavorthTenantGovernanceActionService.js';
import type { ZavorthTenantGovernanceService } from '../../../../services/ZavorthTenantGovernanceService.js';
import type { ZavorthToolSurfaceService } from '../../../../services/ZavorthToolSurfaceService.js';
import type { CodexRemoteActionService } from '../../../../services/CodexRemoteActionService.js';
import type { CodexRemoteControlPlaneService } from '../../../../services/CodexRemoteControlPlaneService.js';
import type { GatewayChannelRegistryService } from '../../../../services/GatewayChannelRegistryService.js';
import type { GatewayChannelRouterService } from '../../../../services/GatewayChannelRouterService.js';
import type { GatewayCompatibilityDoctorService } from '../../../../services/GatewayCompatibilityDoctorService.js';
import type { GatewayUpstreamSyncService } from '../../../../services/GatewayUpstreamSyncService.js';
import type { IntegrationHubService } from '../../../../services/IntegrationHubService.js';
import type { McpCapabilityControlPlaneService } from '../../../../services/McpCapabilityControlPlaneService.js';
import type { NodeHeartbeatService } from '../../../../services/NodeHeartbeatService.js';
import type { NodeInvokeService } from '../../../../services/NodeInvokeService.js';
import type { NodePairingService } from '../../../../services/NodePairingService.js';
import type { OperationsActionService } from '../../../../services/OperationsActionService.js';
import type { ProviderControlPlaneService } from '../../../../services/ProviderControlPlaneService.js';
import type { RemoteTransportDoctorService } from '../../../../services/RemoteTransportDoctorService.js';
import type { WorkspaceExtensionRegistryService } from '../../../../services/WorkspaceExtensionRegistryService.js';

export type WebAppOperationsDeps = {
  capabilityCatalogService?: ZavorthCapabilityCatalogService | null;
  channelActionService?: ZavorthChannelActionService | null;
  channelMeshService?: ZavorthChannelMeshService | null;
  gatewayService?: ZavorthGatewayService | null;
  hookPipelineService?: ZavorthHookPipelineService | null;
  hookPlaneService?: ZavorthHookPlaneService | null;
  memoryPlaneService?: ZavorthMemoryPlaneService | null;
  layeredMemoryService?: ZavorthLayeredMemoryService | null;
  learningPlaneService?: ZavorthLearningPlaneService | null;
  nodeMeshService?: ZavorthNodeMeshService | null;
  nodeHeartbeatService?: NodeHeartbeatService | null;
  nodeInvokeService?: NodeInvokeService | null;
  nodePairingService?: NodePairingService | null;
  pluginActionService?: ZavorthPluginActionService | null;
  platformActionService?: ZavorthPlatformActionService | null;
  pluginRegistryService?: ZavorthPluginRegistryService | null;
  platformRegistryService?: ZavorthPlatformRegistryService | null;
  platformCatalogSyncService?: ZavorthPlatformCatalogSyncService | null;
  platformPublisherService?: ZavorthPackagePublisher | null;
  remoteTransportDoctorService?: RemoteTransportDoctorService | null;
  remoteTransportActionService?: ZavorthRemoteTransportActionService | null;
  remoteTransportService?: ZavorthRemoteTransportService | null;
  securityMeshService?: ZavorthSecurityMeshService | null;
  runtimeModesService?: ZavorthRuntimeModesService | null;
  sessionPlaneService?: ZavorthSessionPlaneService | null;
  sessionToolsService?: ZavorthSessionToolsService | null;
  agentOperatingSystemService?: ZavorthAgentOperatingSystemService | null;
  agentOperatingSystemActionService?: ZavorthAgentOperatingSystemActionService | null;
  teamCatalogService?: ZavorthTeamCatalogService | null;
  tenantGovernanceService?: ZavorthTenantGovernanceService | null;
  tenantGovernanceActionService?: ZavorthTenantGovernanceActionService | null;
  codexRemoteControlPlaneService?: CodexRemoteControlPlaneService | null;
  codexRemoteActionService?: CodexRemoteActionService | null;
  toolSurfaceService?: ZavorthToolSurfaceService | null;
  integrationHubService?: IntegrationHubService | null;
  operatorBriefService?: OperatorBriefService | null;
  operationsHealthService?: OperationsHealthService | null;
  operationsActionService?: OperationsActionService | null;
  productObservabilityService?: ProductObservabilityService | null;
  providerControlPlaneService?: ProviderControlPlaneService | null;
  workspaceExtensionRegistryService?: WorkspaceExtensionRegistryService | null;
  zavorthBridgeMobileAccessService?: ZavorthBridgeMobileAccessService | null;
  mcpCapabilityControlPlaneService?: McpCapabilityControlPlaneService | null;
  mcpRuntimeService?: Pick<McpRuntimeService, 'readSnapshot' | 'reloadServer' | 'stopServer'> | null;
  mcpBrowserDoctorService?: AutomaticBrowserDoctorService | null;
  AIGatewayGatewayService?: AIGatewayProxyService | null;
  AIGatewayGatewayLauncherService?: ZavorthGatewayLauncherService | null;
  GatewayCompatibilityDoctorService?: GatewayCompatibilityDoctorService | null;
  GatewayUpstreamSyncService?: GatewayUpstreamSyncService | null;
  runtimeChannelAdapters?: ChannelAdapterContract[] | null;
};

export type WebAppOperationsState = {
  capabilityCatalog: ZavorthCapabilityCatalogService | null;
  channelActions: ZavorthChannelActionService | null;
  channelMesh: ZavorthChannelMeshService | null;
  gateway: ZavorthGatewayService | null;
  hookPipeline: ZavorthHookPipelineService | null;
  hookPlane: ZavorthHookPlaneService | null;
  memoryPlane: ZavorthMemoryPlaneService | null;
  layeredMemory: ZavorthLayeredMemoryService | null;
  learningPlane: ZavorthLearningPlaneService | null;
  nodeMesh: ZavorthNodeMeshService | null;
  nodeHeartbeat: NodeHeartbeatService | null;
  nodeInvoke: NodeInvokeService | null;
  nodePairing: NodePairingService | null;
  pluginActions: ZavorthPluginActionService | null;
  platformActions: ZavorthPlatformActionService | null;
  pluginRegistry: ZavorthPluginRegistryService | null;
  platformRegistry: ZavorthPlatformRegistryService | null;
  platformCatalogSync: ZavorthPlatformCatalogSyncService | null;
  platformPublisher: ZavorthPackagePublisher | null;
  remoteTransportDoctor: RemoteTransportDoctorService | null;
  remoteTransportActions: ZavorthRemoteTransportActionService | null;
  remoteTransports: ZavorthRemoteTransportService | null;
  securityMesh: ZavorthSecurityMeshService | null;
  runtimeModes: ZavorthRuntimeModesService | null;
  sessionPlane: ZavorthSessionPlaneService | null;
  sessionTools: ZavorthSessionToolsService | null;
  agentOperatingSystem: ZavorthAgentOperatingSystemService | null;
  agentOperatingSystemActions: ZavorthAgentOperatingSystemActionService | null;
  teamCatalog: ZavorthTeamCatalogService | null;
  tenantGovernance: ZavorthTenantGovernanceService | null;
  tenantGovernanceActions: ZavorthTenantGovernanceActionService | null;
  codexRemote: CodexRemoteControlPlaneService | null;
  codexRemoteActions: CodexRemoteActionService | null;
  toolSurface: ZavorthToolSurfaceService | null;
  integrationHub: IntegrationHubService | null;
  operatorBrief: OperatorBriefService | null;
  operationsHealth: OperationsHealthService | null;
  operationsActions: OperationsActionService | null;
  productObservability: ProductObservabilityService | null;
  providerControlPlane: ProviderControlPlaneService | null;
  workspaceExtensions: WorkspaceExtensionRegistryService | null;
  zavorthBridgeMobileAccess: ZavorthBridgeMobileAccessService | null;
  mcpCapabilityControlPlane: McpCapabilityControlPlaneService | null;
  mcpRuntime: Pick<McpRuntimeService, 'readSnapshot' | 'reloadServer' | 'stopServer'> | null;
  mcpBrowserDoctor: AutomaticBrowserDoctorService | null;
  AIGatewayGateway: AIGatewayProxyService | null;
  AIGatewayGatewayLauncher: ZavorthGatewayLauncherService | null;
  AIGatewayCompatibilityDoctor: GatewayCompatibilityDoctorService | null;
  AIGatewayUpstreamSync: GatewayUpstreamSyncService | null;
  runtimeChannelAdapters: ChannelAdapterContract[];
};

export type WebAppRuntimeServiceState = {
  gateway: ZavorthGatewayService | null;
  memoryPlane: ZavorthMemoryPlaneService | null;
  layeredMemory: ZavorthLayeredMemoryService | null;
  learningPlane: ZavorthLearningPlaneService | null;
  sessionPlane: ZavorthSessionPlaneService | null;
  sessionTools: ZavorthSessionToolsService | null;
  gatewaySessionTools: GatewaySessionToolsService | null;
  toolSurface: ZavorthToolSurfaceService | null;
  gatewaySessionStore: GatewaySessionStoreService | null;
  gatewaySessionService: GatewaySessionService | null;
  gatewaySessionReadModel: GatewaySessionReadModelService | null;
  gatewayChannelRegistry: GatewayChannelRegistryService | null;
  gatewayChannelRouter: GatewayChannelRouterService | null;
};

export function createWebAppOperationsState(): WebAppOperationsState {
  return {
    capabilityCatalog: null,
    channelActions: null,
    channelMesh: null,
    gateway: null,
    hookPipeline: null,
    hookPlane: null,
    memoryPlane: null,
    layeredMemory: null,
    learningPlane: null,
    nodeMesh: null,
    nodeHeartbeat: null,
    nodeInvoke: null,
    nodePairing: null,
    pluginActions: null,
    platformActions: null,
    pluginRegistry: null,
    platformRegistry: null,
    platformCatalogSync: null,
    platformPublisher: null,
    remoteTransportDoctor: null,
    remoteTransportActions: null,
    remoteTransports: null,
    securityMesh: null,
    runtimeModes: null,
    sessionPlane: null,
    sessionTools: null,
    agentOperatingSystem: null,
    agentOperatingSystemActions: null,
    teamCatalog: null,
    tenantGovernance: null,
    tenantGovernanceActions: null,
    codexRemote: null,
    codexRemoteActions: null,
    toolSurface: null,
    integrationHub: null,
    operatorBrief: null,
    operationsHealth: null,
    operationsActions: null,
    productObservability: null,
    providerControlPlane: null,
    workspaceExtensions: null,
    zavorthBridgeMobileAccess: null,
    mcpCapabilityControlPlane: null,
    mcpRuntime: null,
    mcpBrowserDoctor: null,
    AIGatewayGateway: null,
    AIGatewayGatewayLauncher: null,
    AIGatewayCompatibilityDoctor: null,
    AIGatewayUpstreamSync: null,
    runtimeChannelAdapters: [],
  };
}

export function createWebAppRuntimeServiceState(): WebAppRuntimeServiceState {
  return {
    gateway: null,
    memoryPlane: null,
    layeredMemory: null,
    learningPlane: null,
    sessionPlane: null,
    sessionTools: null,
    gatewaySessionTools: null,
    toolSurface: null,
    gatewaySessionStore: null,
    gatewaySessionService: null,
    gatewaySessionReadModel: null,
    gatewayChannelRegistry: null,
    gatewayChannelRouter: null,
  };
}


