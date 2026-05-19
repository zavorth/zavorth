import { buildDashboardCommandCenterViewModel } from '../../../src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.js';
import { buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  AgentRunService,
  AgentTeamCompilerService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-agent-team-${++index}`;
}

describe('Command Center Agent Team Compiler Channel mesh0', () => {
  it('projects agentTeamCompiler metadata into the dashboard view model', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:40:00.000Z'),
      idFactory: createIdFactory(),
    }).createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-agent-team',
      text: 'compile equipe de agentes para revisar e implementar',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: {
        suggestedSubagents: ['planner', 'implementer', 'verifier'],
      },
    });
    run.metadata.agentTeamCompiler = new AgentTeamCompilerService().buildSnapshot({
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
      agentTeamCompiler: run.metadata.agentTeamCompiler as any,
    });

    expect(viewModel.agentTeamCompiler).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.track-40',
      status: 'waiting-approval',
      summary: expect.objectContaining({
        roleCount: 3,
        approvalRequiredCount: 3,
        compilerOnly: true,
      }),
      policy: expect.objectContaining({
        noSubagentsLaunched: true,
        approvalRequiredBeforeLaunch: true,
        budgetsDefaultToZero: true,
      }),
    }));
    expect(viewModel.agentTeamCompiler?.roles[0]?.actions.previewCommand).toContain('zavorth agent-team preview');
  });

  it('maps gateway snapshots with Agent Team Compiler into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T00:40:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed',
        summary: 'ok com agent team compiler',
        replyText: 'ok',
      }),
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-agent-team-live',
      text: 'compile uma equipe de agentes para validar esta entrega',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: {
        suggestedSubagents: ['planner', 'verifier'],
      },
    });

    const projection = buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.agentTeamCompiler).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.track-40',
      summary: expect.objectContaining({
        roleCount: 2,
        approvalRequiredCount: 2,
        compilerOnly: true,
      }),
      policy: expect.objectContaining({
        noSubagentsLaunched: true,
      }),
    }));
  });
});
