import { buildDashboardCommandCenterViewModel } from '../../../src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.js';
import { buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  AgentRunService,
  UniversalIntentTrustEnforcementService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-uni-trust-${++index}`;
}

describe('Command Center UNI / Trust enforcement Wave 44', () => {
  it('projects universalIntentTrustEnforcement metadata into the dashboard view model', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:44:00.000Z'),
      idFactory: createIdFactory(),
    }).createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-uni-trust',
      text: 'aplique um patch em src/app.ts',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['write_file'],
      metadata: {
        trustMode: 'collaborator',
        workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
        targetPath: 'C:\\TESTES DEV\\zavorth-core\\Zavorth\\src\\app.ts',
      },
    });
    run.metadata.universalIntentTrustEnforcement = new UniversalIntentTrustEnforcementService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    const viewModel = buildDashboardCommandCenterViewModel({
      runtime: {
        status: 'ready',
      },
      wsStatus: 'connected',
      agentRun: {
        id: run.id,
        status: 'completed',
        metadata: run.metadata,
      },
      universalIntentTrustEnforcement: run.metadata.universalIntentTrustEnforcement as any,
    });

    expect(viewModel.universalIntentTrustEnforcement).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.wave-44',
      status: 'requires-permission',
      summary: expect.objectContaining({
        trustLevel: 'collaborator',
        trustDecision: 'requires_permission',
        requiresPermission: true,
      }),
      policy: expect.objectContaining({
        universalIntentIsSourceOfTruth: true,
        trustSliderEnforcedBeforeExecutor: true,
        secretsSerialized: false,
      }),
    }));
    expect(viewModel.universalIntentTrustEnforcement?.gates.length).toBeGreaterThan(0);
  });

  it('maps gateway snapshots with UNI / Trust into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T00:44:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed',
        summary: 'ok com uni trust',
        replyText: 'ok',
      }),
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-uni-trust-live',
      text: 'aplique um patch em src/app.ts',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['write_file'],
      metadata: {
        trustMode: 'collaborator',
        workspaceRoot: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
        targetPath: 'C:\\TESTES DEV\\zavorth-core\\Zavorth\\src\\app.ts',
      },
    });

    const projection = buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.universalIntentTrustEnforcement).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.wave-44',
      summary: expect.objectContaining({
        trustLevel: 'collaborator',
        trustDecision: 'requires_permission',
      }),
      policy: expect.objectContaining({
        universalIntentIsSourceOfTruth: true,
        trustSliderEnforcedBeforeExecutor: true,
      }),
    }));
  });
});
