import { buildDashboardDashboardViewModel } from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/adapters/dashboardDashboardAdapter.js';
import { buildDashboardRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  AgentRunService,
  CrossChannelContinuityService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-cross-channel-${++index}`;
}

describe('Dashboard Cross-Channel Continuity Channel mesh1', () => {
  it('projects crossChannelContinuity metadata into the dashboard view model', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:41:00.000Z'),
      idFactory: createIdFactory(),
    }).createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-cross-channel',
      text: 'continue no telegram',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: {
        channelMeshBridge: {
          source: 'ZavorthAgentGateway.attachChannelMeshEventBus',
          channels: [
            {
              id: 'telegram:ops',
              label: 'Telegram Ops',
              kind: 'telegram',
              status: 'available',
            },
          ],
        },
      },
    });
    run.metadata.crossChannelContinuity = new CrossChannelContinuityService().buildSnapshot({
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
      crossChannelContinuity: run.metadata.crossChannelContinuity as any,
    });

    expect(viewModel.crossChannelContinuity).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.cross-channel',
      status: 'handoff-ready',
      summary: expect.objectContaining({
        channelCount: expect.any(Number),
        handoffCount: expect.any(Number),
        bridgeDetected: true,
        sameGateway: true,
      }),
      policy: expect.objectContaining({
        noCrossChannelMessageSent: true,
        noSessionForkCreated: true,
        approvalRequiredForChannelSwitch: true,
      }),
    }));
    expect(viewModel.crossChannelContinuity?.channels.some((channel) => channel.kind === 'telegram')).toBe(true);
  });

  it('maps gateway snapshots with Cross-Channel Continuity into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T00:41:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed',
        summary: 'ok com continuity',
        replyText: 'ok',
      }),
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-cross-channel-live',
      text: 'continue esta sessao no terminal e no telegram',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: {
        channelMeshBridge: {
          source: 'ZavorthAgentGateway.attachChannelMeshEventBus',
          channels: [
            {
              id: 'cli:local',
              label: 'Terminal local',
              kind: 'cli',
              status: 'available',
            },
          ],
        },
      },
    });

    const projection = buildDashboardRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.crossChannelContinuity).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.cross-channel',
      summary: expect.objectContaining({
        channelCount: expect.any(Number),
        handoffCount: expect.any(Number),
        bridgeDetected: true,
        sameGateway: true,
      }),
      policy: expect.objectContaining({
        noCrossChannelMessageSent: true,
      }),
    }));
  });
});
