import { buildDashboardCommandCenterViewModel } from '../../../src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.js';
import { buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  AgentRunService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-capability-negotiation-${++index}`;
}

describe('Command Center Capability Negotiation Wave 35', () => {
  it('projects capabilityNegotiation metadata into the dashboard view model', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:35:00.000Z'),
      idFactory: createIdFactory(),
    }).createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-capability-negotiation',
      text: 'corrija e rode testes',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read', 'write_file', 'shell.exec'],
      metadata: {
        targetPaths: ['src/runtime/agent'],
      },
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

    expect(viewModel.capabilityNegotiation).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.wave-35',
      status: 'proposal',
      summary: expect.objectContaining({
        approvalRequired: true,
        highestRisk: 'danger',
      }),
      scope: expect.objectContaining({
        allowedToolIds: expect.arrayContaining(['write_file', 'shell.exec']),
      }),
      policy: expect.objectContaining({
        noExecutionPerformed: true,
        approvedScopeLimitsPaths: true,
      }),
    }));
  });

  it('maps gateway snapshots with Capability Negotiation into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T00:36:00.000Z'),
      idFactory: createIdFactory(),
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-capability-negotiation-live',
      text: 'corrija a wave 35 e rode testes',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read', 'write_file', 'shell.exec'],
      metadata: {
        targetPaths: ['src/runtime/agent', 'tests/runtime/agent'],
      },
    });
    const projection = buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.capabilityNegotiation).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.wave-35',
      status: 'waiting-approval',
      summary: expect.objectContaining({
        approvalRequired: true,
        sensitiveTask: true,
      }),
      scope: expect.objectContaining({
        allowedToolIds: expect.arrayContaining(['write_file', 'shell.exec']),
      }),
    }));
    expect(projection.approvals[0]).toEqual(expect.objectContaining({
      title: 'Aprovar escopo de capabilities',
      status: 'pending',
    }));
  });
});
