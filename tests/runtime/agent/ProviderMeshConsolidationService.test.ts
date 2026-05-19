import {
  AgentRunService,
  PROVIDER_MESH_CONSOLIDATION_CONTRACT_VERSION,
  ProviderMeshConsolidationService,
} from '../../../src/runtime/agent/index.js';

describe('ProviderMeshConsolidationService Channel mesh3', () => {
  it('consolidates P0-extra services without executing providers or serializing secrets', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:43:00.000Z'),
    }).createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-provider-mesh',
      text: 'escolha um modelo para coding',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: {
        requestedCapability: 'coding',
        providerArena: {
          source: 'ProviderArenaService',
          status: 'ready',
        },
      },
    });

    const snapshot = new ProviderMeshConsolidationService({
      now: () => new Date('2026-05-04T00:43:00.000Z'),
    }).buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    expect(snapshot).toEqual(expect.objectContaining({
      contractVersion: PROVIDER_MESH_CONSOLIDATION_CONTRACT_VERSION,
      source: 'ProviderMeshConsolidationService',
      summary: expect.objectContaining({
        manifestCount: expect.any(Number),
        routeCount: expect.any(Number),
        modelCount: expect.any(Number),
        providerArenaLinked: true,
      }),
      p0ExtraCoverage: expect.objectContaining({
        canonicalContracts: true,
        providerIntegrationRegistry: true,
        modelCatalogAggregation: true,
        accessRouteResolution: true,
        modelPicker: true,
        modelSelection: true,
        providerFactory: true,
        onboarding: true,
      }),
      policy: expect.objectContaining({
        noProviderExecutionPerformed: true,
        modelPickerContractIsSourceOfTruth: true,
        providerFactoryUsesSelectedProfile: true,
        noLegacyProviderSwitch: true,
        secretsSerialized: false,
      }),
    }));
    expect(snapshot.summary.routeCount).toBeGreaterThan(0);
    expect(snapshot.summary.modelCount).toBeGreaterThan(0);
    expect(snapshot.routes.length).toBeGreaterThan(0);
    expect(snapshot.families.length).toBeGreaterThan(0);
    expect(snapshot.receipts.some((receipt) => receipt.kind === 'provider-factory')).toBe(true);
  });
});
