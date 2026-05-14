import { buildDashboardCommandCenterViewModel } from '../../../src/ai-gateway/app/(dashboard)/control/command-center/adapters/dashboardCommandCenterAdapter.js';
import { buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections/zavorthAgentGatewayRuntimeProjection.js';
import { ZavorthAgentGateway } from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-discovery-${++index}`;
}

describe('Command Center Natural Capability Discovery Wave 29', () => {
  it('projects discovery from run metadata into the dashboard view model', () => {
    const viewModel = buildDashboardCommandCenterViewModel({
      runtime: {
        status: 'ready',
      },
      wsStatus: 'connected',
      agentRun: {
        id: 'run-discovery',
        status: 'waiting_approval',
        metadata: {
          naturalCapabilityDiscovery: {
            contractVersion: '2026-05-03.wave-29',
            generatedAt: '2026-05-03T20:30:00.000Z',
            intentCategory: 'workspace-mutation',
            confidence: 0.9,
            recommendedToolNames: ['write_file', 'shell.exec'],
            groups: ['workspace', 'local_control'],
            recommendations: [
              {
                id: 'intent:workspace-mutation',
                label: 'Workspace mutation',
                capabilityId: 'write_file',
                toolIds: ['write_file'],
                groups: ['workspace'],
                confidence: 0.9,
                risk: 'danger',
                requiresApproval: true,
                previewRequired: false,
                reason: 'Pedido pode alterar arquivos.',
                nextSafeAction: 'Pedir approval antes de executar tools sensiveis.',
              },
            ],
            safety: {
              noExecutionPerformed: true,
              naturalLanguageDoesNotBypassPolicy: true,
              highestRisk: 'danger',
              requiresApproval: true,
              previewRequired: false,
              approvalRequiredToolIds: ['write_file', 'shell.exec'],
              previewRequiredToolIds: [],
            },
            quarantine: {
              importedCapabilityTrustPresent: false,
              quarantinedCount: 0,
              blockedToolIds: [],
              warning: null,
            },
            nextSafeAction: 'Expor tools em modo confirm/restricted e solicitar approval quando necessario.',
          },
        },
      },
    });

    expect(viewModel.capabilityDiscovery).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.wave-29',
      intentCategory: 'workspace-mutation',
      recommendedToolNames: ['write_file', 'shell.exec'],
      safety: expect.objectContaining({
        noExecutionPerformed: true,
        naturalLanguageDoesNotBypassPolicy: true,
        highestRisk: 'danger',
      }),
      recommendations: [
        expect.objectContaining({
          id: 'intent:workspace-mutation',
          risk: 'danger',
          requiresApproval: true,
        }),
      ],
    }));
  });

  it('maps gateway snapshots with discovery into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-03T20:35:00.000Z'),
      idFactory: createIdFactory(),
      executor: () => ({
        status: 'completed',
        summary: 'ok',
        replyText: 'ok',
      }),
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-cc-discovery',
      text: 'analise o repositorio',
      requestedTools: [],
    });
    const projection = buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.capabilityDiscovery).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.wave-29',
      intentCategory: 'workspace-inspection',
      recommendedToolNames: expect.arrayContaining(['read_file']),
    }));
  });
});
