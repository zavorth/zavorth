import { buildDashboardDashboardViewModel } from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/adapters/dashboardDashboardAdapter.js';
import { buildDashboardRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  AgentRunService,
  SelfingDashboardService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-selfing-${++index}`;
}

describe('Dashboard Selfing Dashboard Selfing Dashboard', () => {
  it('projects selfingDashboard metadata into the dashboard view model', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:37:00.000Z'),
      idFactory: createIdFactory(),
    }).createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-selfing-dashboard',
      text: 'revise selfing',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read', 'memory.read'],
      metadata: {
        contextInput: {
          warm: {
            workspaceProfile: {
              workspaceName: 'Zavorth',
              agentDisplayName: 'Zavorth',
              userDisplayName: 'Grey',
              tonePreference: 'direto',
              memoryMode: 'receipts-first',
              safetyPosture: 'preview-before-apply',
            },
            identityFiles: [
              {
                path: 'SOUL.md',
                exists: true,
                summary: 'Identidade viva do agente.',
              },
            ],
          },
        },
      },
    });
    run.metadata.selfingDashboard = new SelfingDashboardService().buildSnapshot({
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
      selfingDashboard: run.metadata.selfingDashboard as any,
    });

    expect(viewModel.selfingDashboard).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.selfing-dashboard',
      status: expect.any(String),
      identity: expect.objectContaining({
        agentName: 'Zavorth',
        userName: 'Grey',
      }),
      summary: expect.objectContaining({
        cardCount: expect.any(Number),
        identityFileCount: 1,
        versionedChangesRequired: true,
      }),
      policy: expect.objectContaining({
        readOnlySnapshot: true,
        noIdentityChanged: true,
        noMemoryChanged: true,
      }),
    }));
  });

  it('maps gateway snapshots with Selfing Dashboard into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-04T00:38:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed',
        summary: 'ok',
        replyText: 'ok',
        memorySignals: [
          {
            id: 'projection-memory',
            title: 'Memoria projetada',
            layer: 'semantic',
            summary: 'Selfing deve mostrar memoria com receipt.',
            confidence: 0.78,
          },
        ],
      }),
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-selfing-dashboard-live',
      text: 'publique selfing dashboard',
      workspace: 'C:\\TESTES DEV\\zavorth-core\\Zavorth',
      requestedTools: ['workspace.read'],
      metadata: {
        contextInput: {
          warm: {
            workspaceProfile: {
              workspaceName: 'Zavorth',
              agentDisplayName: 'Zavorth',
              userDisplayName: 'Grey',
              tonePreference: 'direto',
              memoryMode: 'receipts-first',
              safetyPosture: 'preview-before-apply',
            },
            identityFiles: [
              {
                path: 'IDENTITY.md',
                exists: true,
                summary: 'Identidade operacional.',
              },
            ],
          },
        },
      },
    });

    const projection = buildDashboardRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.selfingDashboard).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.selfing-dashboard',
      identity: expect.objectContaining({
        agentName: 'Zavorth',
      }),
      summary: expect.objectContaining({
        identityFileCount: 1,
        memoryReceiptCount: 1,
      }),
    }));
  });
});
