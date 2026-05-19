import { buildDashboardCommandCenterViewModel } from '../../../src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.js';
import { buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  AgentRunService,
  ArtifactMemoryService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-artifact-memory-${++index}`;
}

describe('Command Center Artifact Memory Track 38', () => {
  it('projects artifactMemory metadata into the dashboard view model', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:38:00.000Z'),
      idFactory: createIdFactory(),
    }).createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-artifact-memory',
      text: 'indexe artifacts',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read', 'artifacts.read'],
      metadata: {
        taskId: 'cc-track-38',
      },
    });
    run.summary = 'Artifact Memory disponivel.';
    run.artifacts = [
      {
        id: 'artifact-cc-plan',
        title: 'Plano Command Center',
        kind: 'plan',
        createdAt: run.updatedAt,
        status: 'ready',
      },
    ];
    run.metadata.artifactMemory = new ArtifactMemoryService().buildSnapshot({
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
      artifactMemory: run.metadata.artifactMemory as any,
    });

    expect(viewModel.artifactMemory).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.track-38',
      status: 'ready',
      summary: expect.objectContaining({
        artifactCount: 1,
        memoryEntryCount: 2,
        reusableCount: 2,
      }),
      policy: expect.objectContaining({
        noArtifactContentInvented: true,
        noFilesystemReadPerformed: true,
        reusedArtifactMustCiteOrigin: true,
      }),
    }));
    expect(viewModel.artifactMemory?.entries[0]?.actions.citeCommand).toContain('zavorth artifact-memory cite');
  });

  it('maps gateway snapshots with Artifact Memory into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T00:39:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed',
        summary: 'ok com artifact memory',
        replyText: 'ok',
        artifacts: [
          {
            id: 'artifact-projection-report',
            title: 'Relatorio projetado',
            kind: 'report',
            createdAt: '2026-05-04T00:39:00.000Z',
            status: 'ready',
          },
        ],
      }),
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-artifact-memory-live',
      text: 'publique artifact memory',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
    });

    const projection = buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.artifactMemory).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.track-38',
      summary: expect.objectContaining({
        artifactCount: 1,
        memoryEntryCount: 2,
      }),
      policy: expect.objectContaining({
        promotionRequiresExplicitAction: true,
      }),
    }));
  });
});
