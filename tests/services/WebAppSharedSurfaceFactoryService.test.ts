import { SharedSurfaceCommandService } from '../../src/services/SharedSurfaceCommandService.js';
import { WebAppSharedSurfaceFactoryService } from '../../src/domain/surface/presentation/web-app/WebAppSharedSurfaceFactoryService.js';

describe('WebAppSharedSurfaceFactoryService', () => {
  it('builds a shared-surface command service with the expected runtime adapters', () => {
    const factory = new WebAppSharedSurfaceFactoryService();
    const handleApproval = jest.fn();
    const handleRejection = jest.fn();
    const source = {
      runtime: {
        permissionService: { id: 'permissionService' },
        surfaceTaskDispatcher: { id: 'dispatcher' },
        taskManager: { id: 'taskManager' },
        permissionController: {
          handleApproval,
          handleRejection,
        },
        workflowController: { id: 'workflowController' },
      },
      operations: {
        channelActions: { id: 'channelActions' },
        channelMesh: { id: 'channelMesh' },
        securityMesh: null,
        integrationHub: null,
        mcpCapabilityControlPlane: null,
        mcpRuntime: null,
        pluginRegistry: null,
        workspaceExtensions: null,
        nodeMesh: null,
        pluginActions: null,
        platformActions: null,
        platformRegistry: null,
        platformCatalogSync: null,
        platformPublisher: null,
        remoteTransportActions: null,
        remoteTransports: null,
        memoryPlane: null,
        layeredMemory: null,
        learningPlane: null,
        sessionPlane: null,
        hookPlane: null,
        toolSurface: null,
        nodePairing: null,
        nodeInvoke: null,
        providerControlPlane: null,
        zavorthBridgeMobileAccess: null,
        AIGatewayGateway: null,
        AIGatewayGatewayLauncher: null,
        AIGatewayCompatibilityDoctor: null,
        AIGatewayUpstreamSync: null,
        mcpBrowserDoctor: null,
        teamCatalog: null,
        tenantGovernance: null,
        tenantGovernanceActions: null,
        codexRemote: null,
        codexRemoteActions: null,
      },
      runtimeServices: {
        sessionPlane: null,
        toolSurface: null,
      },
      channelSetupAssistant: { id: 'assistant' },
      computerUseWatchModePolicy: { id: 'policy' },
      computerUseWatchModeState: { id: 'state' },
      computerUseWatchMode: { id: 'watchMode' },
      accessManifest: { id: 'accessManifest' },
      installJourney: { id: 'installJourney' },
      officialRemoteAccess: { id: 'officialRemoteAccess' },
      desktopResources: { id: 'desktopResources' },
      companions: { id: 'companions' },
      taskResourcePlanner: { id: 'taskResourcePlanner' },
      modeEscalation: { id: 'modeEscalation' },
      workspaceOptimizer: { id: 'workspaceOptimizer' },
      surfaceParity: { id: 'surfaceParity' },
      skillCatalogApi: { id: 'skillCatalogApi' },
      skillMcpSidecar: { id: 'skillMcpSidecar' },
      skillLibraryPresentation: { id: 'skillLibraryPresentation' },
      skillInstallPlanPresentation: { id: 'skillInstallPlanPresentation' },
      selfModificationCommandService: { id: 'selfModification' },
      systemOverlordControl: { id: 'systemOverlordControl' },
      engineeringCore: { id: 'engineeringCore' },
    } as any;

    const service = factory.build(source);
    const deps = (service as any).deps;

    expect(service).toBeInstanceOf(SharedSurfaceCommandService);
    expect(deps.channelActionService).toBe(source.operations.channelActions);
    expect(deps.naturalChannelSetupTurnService).toBeDefined();
    expect(deps.trustPlaneService).toBeDefined();
    expect(deps.hubControlPlaneService).toBeDefined();
    expect(deps.automationActionService).toBeDefined();
    expect(deps.watchModeControlPlaneService).toBeDefined();
    expect(deps.permissionService).toBe(source.runtime.permissionService);
    expect(deps.workflowController).toBe(source.runtime.workflowController);
    deps.taskApprovalController.handleApproval('approve');
    deps.taskApprovalController.handleRejection('reject');
    expect(handleApproval).toHaveBeenCalledWith('approve');
    expect(handleRejection).toHaveBeenCalledWith('reject');
  });
});

