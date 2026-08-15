import { buildZavorthControlZavorthControlViewModel } from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/adapters/ZavorthControlAdapter.js'
import { buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  AgentRunService,
  ProviderMeshConsolidationService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-provider-mesh-${++index}`;
}

describe('ZavorthControl Provider Mesh Consolidation Channel mesh3', () => {
  it('projects providerMeshConsolidation metadata into the zavorthControl view model', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:43:00.000Z'),
      idFactory: createIdFactory(),
    }).createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-provider-mesh',
      text: 'escolha modelo para coding',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
    });
    run.metadata.providerMeshConsolidation = new ProviderMeshConsolidationService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    const viewModel = buildZavorthControlZavorthControlViewModel({
      runtime: {
        status: 'ready',
      },
      wsStatus: 'connected',
      agentRun: {
        id: run.id,
        status: 'completed',
        metadata: run.metadata,
      },
      providerMeshConsolidation: run.metadata.providerMeshConsolidation as any,
    });

    expect(viewModel.providerMeshConsolidation).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.provider-mesh',
      summary: expect.objectContaining({
        routeCount: expect.any(Number),
        readyRouteCount: expect.any(Number),
        modelCount: expect.any(Number),
      }),
      policy: expect.objectContaining({
        noProviderExecutionPerformed: true,
        modelPickerContractIsSourceOfTruth: true,
        secretsSerialized: false,
      }),
    }));
    expect(viewModel.providerMeshConsolidation?.routes.length).toBeGreaterThan(0);
  });

  it('maps gateway snapshots with Provider Mesh into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T00:43:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed',
        summary: 'ok com provider mesh',
        replyText: 'ok',
      }),
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-provider-mesh-live',
      text: 'qual provider para reasoning?',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
    });

    const projection = buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.providerMeshConsolidation).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.provider-mesh',
      summary: expect.objectContaining({
        routeCount: expect.any(Number),
        modelCount: expect.any(Number),
      }),
      p0ExtraCoverage: expect.objectContaining({
        modelPicker: true,
        providerFactory: true,
      }),
    }));
  });
});
