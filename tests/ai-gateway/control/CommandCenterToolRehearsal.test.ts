import { buildDashboardCommandCenterViewModel } from '../../../src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.js';
import { buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  AgentRunService,
  ToolRehearsalService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-tool-rehearsal-${++index}`;
}

describe('Command Center Tool Rehearsal Wave 36', () => {
  it('projects toolRehearsal metadata into the dashboard view model', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:36:00.000Z'),
      idFactory: createIdFactory(),
    }).createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-tool-rehearsal',
      text: 'corrija e rode testes',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read', 'write_file', 'shell.exec'],
      metadata: {
        toolRehearsalRequired: true,
        targetPaths: ['src/runtime/agent'],
      },
    });
    const negotiation = run.metadata.capabilityNegotiation as any;
    run.metadata.capabilityNegotiation = {
      ...negotiation,
      status: 'approved',
      scope: {
        ...negotiation.scope,
        approved: true,
      },
    };
    run.metadata.toolRehearsal = new ToolRehearsalService().buildSnapshot({
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
        status: 'waiting_approval',
        metadata: run.metadata,
      },
    });

    expect(viewModel.toolRehearsal).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.wave-36',
      status: 'proposal',
      summary: expect.objectContaining({
        callCount: 3,
        scopeApproved: true,
      }),
      policy: expect.objectContaining({
        noToolExecuted: true,
        noShellSpawned: true,
        realExecutionLimitedToRehearsedScope: true,
      }),
    }));
    expect(viewModel.toolRehearsal?.calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        toolId: 'write_file',
      }),
    ]));
  });

  it('maps gateway snapshots with Tool Rehearsal into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T00:37:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed',
        summary: 'ok',
        replyText: 'ok',
      }),
    });

    const first = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-tool-rehearsal-live',
      text: 'corrija a wave 36 e rode testes',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read', 'write_file', 'shell.exec'],
      metadata: {
        toolRehearsalRequired: true,
        targetPaths: ['src/runtime/agent', 'tests/runtime/agent'],
      },
    });
    const afterScope = await gateway.approve(first.run.id);
    const projection = buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: afterScope?.run.id }),
    );

    expect(projection.toolRehearsal).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.wave-36',
      status: 'waiting-approval',
      summary: expect.objectContaining({
        callCount: 3,
        scopeApproved: true,
      }),
    }));
    expect(projection.approvals.some((approval) => approval.title === 'Aprovar tool rehearsal')).toBe(true);
  });
});
