import { ZavorthControlOperationsDepsBridgeService } from '../../src/domain/surface/presentation/zavorthControl/ZavorthControlOperationsDepsBridgeService.js';

describe('ZavorthControlOperationsDepsBridgeService', () => {
  it('builds operational route deps, snapshot deps, and overview deps from a shared source', async () => {
    const bridge = new ZavorthControlOperationsDepsBridgeService();
    const source = {
      continuityUserId: '42',
      authService: { validate: jest.fn() },
      classicAccess: {
        isLoopbackAddress: jest.fn(),
        resolveZavorthControlToken: jest.fn(),
      },
      operationsHealth: { readSnapshot: jest.fn() },
      operationsCockpit: { readSnapshot: jest.fn() },
      operatorBrief: { readSnapshot: jest.fn() },
      productObservability: { buildSnapshot: jest.fn() },
      accessManifest: { buildManifest: jest.fn() },
      capabilityCatalog: { buildSnapshot: jest.fn() },
      gateway: { buildHydratedSnapshot: jest.fn() },
      sessionTools: { buildSnapshot: jest.fn() },
      sessionPlane: { buildSnapshot: jest.fn() },
      toolSurface: { buildSnapshot: jest.fn() },
      remoteTransports: { buildSnapshot: jest.fn() },
      remoteTransportDoctor: { run: jest.fn() },
      remoteTransportActions: { execute: jest.fn() },
      pluginRegistry: { buildSnapshot: jest.fn() },
      pluginActions: { execute: jest.fn() },
      platformRegistry: { buildSnapshot: jest.fn() },
      platformActions: { execute: jest.fn() },
      platformCatalogSync: { sync: jest.fn() },
      platformPublisher: { publishDetailed: jest.fn() },
      hookPlane: { buildSnapshot: jest.fn() },
      hookPipeline: { buildSnapshot: jest.fn(), buildExecutionPlan: jest.fn(), runEvent: jest.fn() },
      runtimeModes: { buildSnapshot: jest.fn() },
      securityMesh: { buildSnapshot: jest.fn() },
      workspaceExtensions: { buildSnapshot: jest.fn() },
      channelMesh: { buildSnapshot: jest.fn() },
      channelActions: { execute: jest.fn() },
      nodeMesh: { buildSnapshot: jest.fn() },
      nodeInvoke: { invoke: jest.fn() },
      nodePairing: { createPairingDraft: jest.fn(), approvePairing: jest.fn(), revokePairing: jest.fn() },
      nodeHeartbeat: { claimPairing: jest.fn(), receiveHeartbeat: jest.fn() },
      teamCatalog: { buildSnapshot: jest.fn() },
      integrationHub: { buildCatalogSnapshot: jest.fn(), executeGuidedAction: jest.fn() },
      operationsReport: { buildSnapshot: jest.fn() },
      operationsActions: { execute: jest.fn() },
      operationsOverviewBridge: {
        readOperationalOverviewSnapshot: jest.fn().mockResolvedValue({ summary: { posture: 'healthy' } }),
        readTrustOverviewSnapshot: jest.fn().mockResolvedValue({ summary: { posture: 'attention' } }),
        readProductOverviewSnapshot: jest.fn().mockResolvedValue({ summary: { posture: 'critical' } }),
        readControlPlaneCatalogSnapshot: jest.fn().mockResolvedValue({ summary: { posture: 'healthy' } }),
      },
      operationalSnapshots: {
        readContinuitySnapshot: jest.fn().mockReturnValue({ available: true }),
        readMemoryPlaneSnapshot: jest.fn().mockResolvedValue({ cards: [] }),
        readReplaySnapshot: jest.fn().mockReturnValue({ available: true }),
        readLifecycleSnapshot: jest.fn().mockReturnValue({ summary: { total: 1 } }),
        readHandoffSnapshot: jest.fn().mockReturnValue({ available: true }),
      },
      responseWriter: {
        writeJson: jest.fn(),
      },
      httpSupport: {
        readJsonBody: jest.fn(),
      },
      sessionContinuity: null,
      memoryPlane: { buildSnapshot: jest.fn() },
      sessionReplay: { buildReplay: jest.fn() },
      sessionHandoff: { buildHandoff: jest.fn() },
      workflowRuns: { listRuns: jest.fn() },
      reportTaskManager: { getRecentTasks: jest.fn() },
      executionGateway: { listActions: jest.fn() },
      layeredMemory: { buildSnapshot: jest.fn() },
      learningPlane: { buildSnapshot: jest.fn() },
      tenantGovernance: { buildSnapshot: jest.fn() },
      mcpCapabilityControlPlane: { buildSnapshot: jest.fn() },
      skillLibraryPresentation: { buildSnapshot: jest.fn() },
      skillInstallPlanPresentation: { buildSnapshot: jest.fn() },
      mcpRuntime: { readSnapshot: jest.fn(), reloadServer: jest.fn(), stopServer: jest.fn() },
    } as any;
    const input = {
      workspaceRoot: 'C:/workspace',
      continuityUserId: '1',
    };

    const operationalDeps = bridge.buildOperationalSnapshotDeps(source, input);
    const overviewDeps = bridge.buildOverviewSnapshotDeps(source, input);
    const routeDeps = bridge.buildRouteDeps(source, input);

    expect(operationalDeps.continuityUserId).toBe('1');
    expect(overviewDeps.workspaceRoot).toBe('C:/workspace');
    await expect(routeDeps.readOperationsOverviewSnapshot()).resolves.toEqual({ summary: { posture: 'healthy' } });
    await expect(routeDeps.readOperationsTrustOverviewSnapshot()).resolves.toEqual({ summary: { posture: 'attention' } });
    await expect(routeDeps.readOperationsProductOverviewSnapshot()).resolves.toEqual({ summary: { posture: 'critical' } });
    await expect(routeDeps.readOperationsControlPlaneCatalogSnapshot()).resolves.toEqual({ summary: { posture: 'healthy' } });
    expect(routeDeps.readOperationsContinuitySnapshot()).toEqual({ available: true });
    await expect(routeDeps.readOperationsMemoryPlaneSnapshot()).resolves.toEqual({ cards: [] });
    expect(routeDeps.readOperationsReplaySnapshot()).toEqual({ available: true });
    expect(routeDeps.readOperationsLifecycleSnapshot()).toEqual({ summary: { total: 1 } });
    expect(routeDeps.readOperationsHandoffSnapshot()).toEqual({ available: true });
  });
});
