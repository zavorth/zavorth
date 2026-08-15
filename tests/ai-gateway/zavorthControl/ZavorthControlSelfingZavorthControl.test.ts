import { buildZavorthControlZavorthControlViewModel } from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/adapters/ZavorthControlAdapter.js'
import { buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/projections/zavorthAgentGatewayRuntimeProjection.js';
import {
  AgentRunService,
  SelfingZavorthControlService,
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-selfing-${++index}`;
}

describe('ZavorthControl Selfing ZavorthControl Selfing ZavorthControl', () => {
  it('projects selfingZavorthControl metadata into the zavorthControl view model', () => {
    const run = new AgentRunService({
      now: () => new Date('2026-05-04T00:37:00.000Z'),
      idFactory: createIdFactory(),
    }).createRun({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-cc-selfing-zavorthControl',
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
    run.metadata.selfingZavorthControl = new SelfingZavorthControlService().buildSnapshot({
      run,
      generatedAt: run.updatedAt,
    });

    const viewModel = buildZavorthControlZavorthControlViewModel({
      runtime: {
        status: 'ready',
      },
      wsStatus: 'connected',
      agentRun: {
        id: run.id,
        status: 'completed',
        metadata: run.metadata,
      },
      selfingZavorthControl: run.metadata.selfingZavorthControl as any,
    });

    expect(viewModel.selfingZavorthControl).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.selfing-zavorthControl',
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

  it('maps gateway snapshots with Selfing ZavorthControl into runtime projection', async () => {
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
      sessionId: 'session-cc-selfing-zavorthControl-live',
      text: 'publique selfing zavorthControl',
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

    const projection = buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.selfingZavorthControl).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.selfing-zavorthControl',
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
