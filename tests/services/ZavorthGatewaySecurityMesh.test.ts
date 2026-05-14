import { ZavorthGatewayService } from '../../src/services/ZavorthGatewayService.js';

describe('ZavorthGatewayService security mesh slice', () => {
  it('includes the Runtime & Security Mesh in the gateway snapshot', () => {
    const service = new ZavorthGatewayService({
      securityMeshService: {
        buildSnapshot: jest.fn(() => ({
          posture: {
            level: 'guarded',
            label: 'Guarded',
            summary: 'Container forte pronto; microVM em preparo.',
          },
          summary: {
            totalModes: 5,
            coreReady: 2,
            extensionsReady: 0,
            gvisorActive: true,
            firecrackerReady: false,
            neverDowngrade: true,
          },
          policies: {
            lowRiskToLocalJail: true,
            mediumRiskToContainer: true,
            highRiskToMicrovm: true,
            neverDowngrade: true,
            containerHardening: true,
            gvisorActive: true,
            firecrackerReady: false,
            nodeHostAvailable: false,
            remoteSidecarAvailable: false,
          },
          modes: {
            core: [],
            extensions: [],
          },
          suggestedActions: [],
          narrative: {
            headline: 'Runtime & Security Mesh',
            operatorSummary: 'Container forte pronto; microVM em preparo.',
            trustBoundary: 'Alto risco nao rebaixa.',
          },
        })),
      } as any,
      runtimeModesService: {
        buildSnapshot: jest.fn(() => ({
          summary: { ready: 2 },
        })),
      } as any,
      capabilityCatalogService: {
        buildSnapshot: jest.fn(() => ({
          integrations: { ready: 0 },
        })),
      } as any,
      toolSurfaceService: {
        buildSnapshot: jest.fn(() => ({
          summary: { families: 1 },
        })),
      } as any,
      hookPlaneService: {
        buildSnapshot: jest.fn(() => ({
          summary: { supportedEvents: 1 },
        })),
      } as any,
      teamCatalogService: {
        buildSnapshot: jest.fn(() => ({
          summary: { total: 0, active: 0, resumable: 0, completedRecently: 0, executors: [] },
          teams: [],
          narrative: { headline: 'Sem teams.', operatorSummary: 'idle' },
        })),
      } as any,
      nodeMeshService: {
        buildSnapshot: jest.fn(() => ({
          summary: { total: 0, paired: 0, pending: 0, online: 0, offline: 0, invokable: 0, capabilities: 0 },
          entries: [],
          selected: null,
          capabilityCatalog: [],
          suggestedActions: [],
          narrative: { headline: 'Sem nodes.', operatorSummary: 'Nada pareado.' },
        })),
      } as any,
      pluginRegistryService: {
        buildSnapshot: jest.fn(() => ({
          summary: { total: 0 },
        })),
      } as any,
      platformCapabilityService: {
        getCapabilities: jest.fn(() => []),
        getSummary: jest.fn(),
      } as any,
    });

    const snapshot = service.buildSnapshot();

    expect(snapshot.securityMesh).toEqual(
      expect.objectContaining({
        posture: expect.objectContaining({
          level: 'guarded',
        }),
      }),
    );
    expect(snapshot.summary.securityPosture).toBe('guarded');
  });
});
