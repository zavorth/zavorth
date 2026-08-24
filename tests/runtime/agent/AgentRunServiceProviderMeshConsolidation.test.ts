import {
  AgentRunService,
  PROVIDER_MESH_CONSOLIDATION_CONTRACT_VERSION,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-provider-mesh-${++index}`;
}

// Contention budget: agent-run pipeline tests exceed the 5s Jest default
// when full-group parallel workers load the machine.
jest.setTimeout(120000);

describe('AgentRunService Provider Mesh Consolidation Channel mesh3', () => {
  it('publishes run.metadata.providerMeshConsolidation during the agent run lifecycle', async () => {
    const service = new AgentRunService({
      now: () => new Date('2026-05-04T00:43:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed' as const,
        summary: 'Provider Mesh consolidado.',
        replyText: 'ok',
      }),
    });

    const result = await service.run({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-agent-provider-mesh',
      text: 'qual provider devo usar para reasoning?',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: {
        requestedCapability: 'reasoning',
      },
    });

    const providerMesh = result.run.metadata.providerMeshConsolidation as any;
    expect(providerMesh).toEqual(expect.objectContaining({
      contractVersion: PROVIDER_MESH_CONSOLIDATION_CONTRACT_VERSION,
      source: 'ProviderMeshConsolidationService',
      summary: expect.objectContaining({
        routeCount: expect.any(Number),
        modelCount: expect.any(Number),
      }),
      p0ExtraCoverage: expect.objectContaining({
        providerIntegrationRegistry: true,
        modelPicker: true,
        modelSelection: true,
        providerFactory: true,
        onboarding: true,
      }),
      policy: expect.objectContaining({
        noProviderExecutionPerformed: true,
        secretsSerialized: false,
      }),
    }));
    expect(providerMesh.selected.runtimeFactory).toEqual(expect.objectContaining({
      adapterKind: expect.any(String),
      runtimeSupported: expect.any(Boolean),
    }));
  });
});
