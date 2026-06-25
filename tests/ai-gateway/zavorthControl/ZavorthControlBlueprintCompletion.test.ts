import { buildZavorthControlZavorthControlViewModel } from '../../../src/zavorth-control/app/(zavorthControl)/control/zavorth-control/adapters/zavorthControlZavorthControlAdapter.js';
import { buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/zavorth-control/app/(zavorthControl)/control/zavorth-control/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  AgentRunService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';
import { blueprintMetadata } from '../../runtime/agent/BlueprintCompletionGateService.test.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-blueprint-${++index}`;
}

function agentService() {
  return new AgentRunService({
    now: () => new Date('2026-05-04T07:00:00.000Z'),
    idFactory: createIdFactory(),
    releaseCandidatePreCanaryGate: {
      buildSnapshot: () => ({
        status: 'pre-canary-ready',
        readiness: { canOpenPreCanary: true },
      }),
    } as any,
  });
}

describe('ZavorthControl Blueprint Completion final gate', () => {
  it('projects blueprintCompletionGate metadata into the zavorthControl view model', () => {
    const run = agentService().createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-blueprint',
      text: 'complete blueprint',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: blueprintMetadata(),
    });

    const viewModel = buildZavorthControlZavorthControlViewModel({
      runtime: { status: 'ready' },
      wsStatus: 'connected',
      agentRun: { id: run.id, status: 'completed', metadata: run.metadata },
      blueprintCompletionGate: run.metadata.blueprintCompletionGate as any,
    });

    expect(viewModel.blueprintCompletionGate).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.blueprint-complete',
      status: 'blueprint-complete',
      summary: expect.objectContaining({
        completedGateCount: 5,
        blueprintComplete: true,
      }),
      readiness: expect.objectContaining({
        blueprintComplete: true,
        safeguardsReady: true,
      }),
      policy: expect.objectContaining({
        noAutoExecute: true,
        noGlobalRolloutByDefault: true,
        noSkipApproval: true,
      }),
    }));
    expect(viewModel.blueprintCompletionGate?.gates.length).toBeGreaterThan(0);
  });

  it('maps gateway snapshots with blueprint completion into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T07:00:00.000Z'),
      idFactory: createIdFactory(),
      releaseCandidatePreCanaryGate: {
        buildSnapshot: () => ({
          status: 'pre-canary-ready',
          readiness: { canOpenPreCanary: true },
        }),
      },
      executor: () => ({ status: 'completed', summary: 'ok blueprint completo', replyText: 'ok' }),
    } as any);

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-blueprint-live',
      text: 'complete blueprint',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: blueprintMetadata(),
    });

    const projection = buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.blueprintCompletionGate).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.blueprint-complete',
      status: 'blueprint-complete',
      summary: expect.objectContaining({
        blueprintComplete: true,
      }),
      policy: expect.objectContaining({
        noUngovernedDeploy: true,
        manualPromotionRequired: true,
        noAutoExecute: true,
        noSkipCanary: true,
      }),
    }));
    expect(projection.blueprintCompletionGate?.gates.length).toBeGreaterThan(0);
  });
});
