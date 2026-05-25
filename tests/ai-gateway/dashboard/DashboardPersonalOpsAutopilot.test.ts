import { buildDashboardDashboardViewModel } from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/adapters/dashboardDashboardAdapter.js';
import { buildDashboardRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  AgentRunService,
  PersonalOpsAutopilotService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-personal-ops-${++index}`;
}

describe('Dashboard Personal Ops Autopilot Personal Ops Autopilot', () => {
  it('projects personalOpsAutopilot metadata into the dashboard view model', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:39:00.000Z'),
      idFactory: createIdFactory(),
    }).createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-personal-ops',
      text: 'observe ops',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: {
        runBudget: {
          degraded: true,
          reason: 'budget alto',
        },
      },
    });
    run.metadata.personalOpsAutopilot = new PersonalOpsAutopilotService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    const viewModel = buildDashboardDashboardViewModel({
      runtime: {
        status: 'ready',
      },
      wsStatus: 'connected',
      agentRun: {
        id: run.id,
        status: 'completed',
        metadata: run.metadata,
      },
      personalOpsAutopilot: run.metadata.personalOpsAutopilot as any,
    });

    expect(viewModel.personalOpsAutopilot).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.personal-ops',
      status: 'waiting-approval',
      summary: expect.objectContaining({
        suggestionCount: expect.any(Number),
        budgetIssueCount: 1,
      }),
      policy: expect.objectContaining({
        noMutableActionExecuted: true,
        noAutorepairStarted: true,
        approvalsRequiredForMutation: true,
      }),
    }));
    expect(viewModel.personalOpsAutopilot?.suggestions[0]?.actions.previewCommand).toContain('zavorth personal-ops preview');
  });

  it('maps gateway snapshots with Personal Ops Autopilot into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T00:40:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed',
        summary: 'ok com personal ops',
        replyText: 'ok',
        metadata: {
          runBudget: {
            degraded: true,
            reason: 'budget acima',
          },
        },
      }),
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-personal-ops-live',
      text: 'publique personal ops',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
    });

    const projection = buildDashboardRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.personalOpsAutopilot).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.personal-ops',
      summary: expect.objectContaining({
        budgetIssueCount: 1,
        suggestionCount: expect.any(Number),
      }),
      policy: expect.objectContaining({
        previewBeforeAutorepair: true,
      }),
    }));
  });
});
