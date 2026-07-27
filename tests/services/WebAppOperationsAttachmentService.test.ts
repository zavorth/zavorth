import { ZavorthPlatformActionService } from '../../src/services/ZavorthPlatformActionService.js';
import { ZavorthPluginActionService } from '../../src/services/ZavorthPluginActionService.js';
import { WebAppOperationsAttachmentService } from '../../src/domain/surface/presentation/web-app/WebAppOperationsAttachmentService.js';

describe('WebAppOperationsAttachmentService', () => {
  it('applies WebApp operations deps to runtime state and builds gateway attachment payloads', () => {
    const service = new WebAppOperationsAttachmentService();
    const adapters = [{ id: 'web' }, { id: 'slack' }] as any;
    const state = {
      capabilityCatalog: null,
      cchannelActions: null,
      cchannelMesh: null,
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
    } as any;
    const deps = {
      cchannelActionService: { id: 'cchannelActions' },
      cchannelMeshService: { id: 'cchannelMesh' },
      gatewayService: { id: 'gateway' },
      hookPlaneService: { id: 'hookPlane' },
      memoryPlaneService: { id: 'memoryPlane' },
      nodeMeshService: { id: 'nodeMesh' },
      securityMeshService: { id: 'securityMesh' },
      runtimeModesService: { id: 'runtimeModes' },
      teamCatalogService: { id: 'teamCatalog' },
      pluginRegistryService: { id: 'pluginRegistry' },
      platformRegistryService: { id: 'platformRegistry' },
      remoteTransportService: { id: 'remoteTransports' },
      operationsHealthService: { id: 'operationsHealth' },
      providerControlPlaneService: { id: 'providerControlPlane' },
      integrationHubService: { id: 'integrationHub' },
      runtimeChannelAdapters: adapters,
    } as any;

    service.apply(state, deps);
    const gatewayAttachment = service.buildGatewayRuntimeAttachment(state);

    expect(state.pluginActions).toBeInstanceOf(ZavorthPluginActionService);
    expect(state.platformActions).toBeInstanceOf(ZavorthPlatformActionService);
    expect(state.runtimeChannelAdapters).toEqual(adapters);
    expect(state.runtimeChannelAdapters).not.toBe(adapters);
    expect(gatewayAttachment).toEqual({
      capabilityCatalog: null,
      cchannelMesh: deps.cchannelMeshService,
      memoryPlane: deps.memoryPlaneService,
      securityMesh: deps.securityMeshService,
      runtimeModes: deps.runtimeModesService,
      teamCatalog: deps.teamCatalogService,
      hookPlane: deps.hookPlaneService,
      nodeMesh: deps.nodeMeshService,
      pluginRegistry: deps.pluginRegistryService,
      platformRegistry: deps.platformRegistryService,
      remoteTransports: deps.remoteTransportService,
      operationsHealth: deps.operationsHealthService,
      providerControlPlane: deps.providerControlPlaneService,
      integrationHub: deps.integrationHubService,
      gateway: deps.gatewayService,
      runtimeChannelAdapters: adapters,
    });
    expect(gatewayAttachment.runtimeChannelAdapters).not.toBe(state.runtimeChannelAdapters);
  });
});

