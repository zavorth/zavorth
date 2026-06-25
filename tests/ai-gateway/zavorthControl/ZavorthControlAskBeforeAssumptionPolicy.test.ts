import { buildZavorthControlZavorthControlViewModel } from '../../../src/zavorth-control/app/(zavorthControl)/control/zavorth-control/adapters/zavorthControlZavorthControlAdapter.js';
import { buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/zavorth-control/app/(zavorthControl)/control/zavorth-control/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  AgentRunService,
  AskBeforeAssumptionPolicyService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-ask-policy-${++index}`;
}

describe('ZavorthControl Ask Before Assumption Policy Channel mesh2', () => {
  it('projects askBeforeAssumptionPolicy metadata into the zavorthControl view model', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:42:00.000Z'),
      idFactory: createIdFactory(),
    }).createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-ask-policy',
      text: 'apague isso e publique no canal certo',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.write'],
    });
    run.metadata.askBeforeAssumptionPolicy = new AskBeforeAssumptionPolicyService().buildSnapshot({
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
      askBeforeAssumptionPolicy: run.metadata.askBeforeAssumptionPolicy as any,
    });

    expect(viewModel.askBeforeAssumptionPolicy).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.track-42',
      status: 'blocked',
      summary: expect.objectContaining({
        questionCount: expect.any(Number),
        mutableActionBlockedCount: expect.any(Number),
      }),
      policy: expect.objectContaining({
        noAssumptionActedOn: true,
        noMutationExecuted: true,
        asksBeforeMutation: true,
      }),
    }));
    expect(viewModel.askBeforeAssumptionPolicy?.questions.some((question) => question.blocksMutation)).toBe(true);
  });

  it('maps gateway snapshots with Ask Before Assumption Policy into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T00:42:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed',
        summary: 'ok com ask policy',
        replyText: 'ok',
      }),
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-ask-policy-live',
      text: 'delete isso e envie para o destino certo',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.write'],
    });

    const projection = buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.askBeforeAssumptionPolicy).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.track-42',
      summary: expect.objectContaining({
        questionCount: expect.any(Number),
      }),
      policy: expect.objectContaining({
        noAssumptionActedOn: true,
        noMutationExecuted: true,
      }),
    }));
  });
});
