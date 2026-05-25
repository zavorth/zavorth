import { buildDashboardDashboardViewModel } from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/adapters/dashboardDashboardAdapter.js';
import { buildDashboardRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  AgentRunService,
  RunArtifactReceiptReplayService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-replay-hardening-${++index}`;
}

describe('Dashboard run/artifact/receipt replay hardening Channel mesh5', () => {
  it('projects runArtifactReceiptReplay metadata into the dashboard view model', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:45:00.000Z'),
      idFactory: createIdFactory(),
    }).createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-replay-hardening',
      text: 'audite artifacts do run',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
    });
    run.artifacts = [
      {
        id: 'artifact-cc-replay',
        title: 'Artifact Dashboard',
        kind: 'report',
        createdAt: run.updatedAt,
        sessionId: run.sessionId,
        status: 'ready',
      },
    ];
    run.metadata.runArtifactReceiptReplay = new RunArtifactReceiptReplayService().buildSnapshot({
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
      runArtifactReceiptReplay: run.metadata.runArtifactReceiptReplay as any,
    });

    expect(viewModel.runArtifactReceiptReplay).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.receipt-replay',
      status: expect.stringMatching(/ready|partial/),
      summary: expect.objectContaining({
        frameCount: expect.any(Number),
        artifactLinkCount: expect.any(Number),
      }),
      policy: expect.objectContaining({
        replayUsesReceiptsOnly: true,
        noFilesystemReadPerformed: true,
        secretsSerialized: false,
      }),
    }));
    expect(viewModel.runArtifactReceiptReplay?.summary.frameCount).toBeGreaterThan(0);
    expect(viewModel.runArtifactReceiptReplay?.summary.artifactLinkCount).toBeGreaterThanOrEqual(1);
  });

  it('maps gateway snapshots with replay hardening into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T00:45:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed',
        summary: 'ok com replay hardening',
        replyText: 'ok',
        artifacts: [
          {
            id: 'artifact-gateway-replay',
            title: 'Artifact Gateway Replay',
            kind: 'plan',
            createdAt: '2026-05-04T00:45:00.000Z',
            status: 'ready',
          },
        ],
      }),
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-replay-hardening-live',
      text: 'gere artifact e prepare replay',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
    });

    const projection = buildDashboardRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.runArtifactReceiptReplay).toEqual(expect.objectContaining({
      contractVersion: '2026-05-04.receipt-replay',
      summary: expect.objectContaining({
        artifactLinkCount: expect.any(Number),
        replayable: true,
      }),
      policy: expect.objectContaining({
        replayUsesReceiptsOnly: true,
        noArtifactMutation: true,
      }),
    }));
    expect(projection.runArtifactReceiptReplay?.summary.artifactLinkCount).toBeGreaterThanOrEqual(1);
  });
});
