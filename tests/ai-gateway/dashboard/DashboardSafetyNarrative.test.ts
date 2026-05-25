import { buildDashboardDashboardViewModel } from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/adapters/dashboardDashboardAdapter.js';
import { buildDashboardRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(dashboard)/dashboard/dashboard/projections/zavorthAgentGatewayRuntimeProjection.js';
import { ZavorthAgentGateway } from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-safety-${++index}`;
}

describe('Dashboard Safety Narrative Safety Narrative', () => {
  it('projects safety narrative metadata into the dashboard view model', () => {
    const viewModel = buildDashboardDashboardViewModel({
      runtime: {
        status: 'ready',
      },
      wsStatus: 'connected',
      agentRun: {
        id: 'run-safety',
        status: 'waiting_approval',
        metadata: {
          safetyNarrative: {
            contractVersion: '2026-05-03.safety-narrative',
            generatedAt: '2026-05-03T22:30:00.000Z',
            status: 'waiting-approval',
            highRiskBlockPresent: true,
            summary: 'Safety Narrative: approval pendente.',
            userMessage: 'Bloqueei por seguranca.',
            reasons: [
              {
                id: 'safety:approval:1',
                kind: 'approval-required',
                title: 'Approval obrigatorio antes da execucao',
                detail: 'Bloqueei porque shell.exec exige approval.',
                risk: 'danger',
                source: 'approval-gate',
                toolIds: ['shell.exec'],
                redactionApplied: false,
              },
            ],
            alternatives: [
              {
                id: 'safety:alternative:preview',
                label: 'Rodar preview antes do apply',
                detail: 'Use preview sem executar.',
                safe: true,
                requiresApproval: false,
              },
            ],
            redaction: {
              pathRedactionApplied: false,
              secretRedactionApplied: false,
              sensitivePathCount: 0,
              secretCount: 0,
              rawSecretSerialized: false,
            },
            policy: {
              naturalLanguageDoesNotBypassPolicy: true,
              alternativesDoNotExecute: true,
              workspaceBoundaryRespected: true,
              approvalsRemainRequired: true,
              previewRemainsRequired: false,
              quarantineRemainsRequired: false,
            },
            nextSafeAction: 'Revisar o plano e aprovar explicitamente as tools sensiveis.',
          },
        },
      },
    });

    expect(viewModel.safetyNarrative).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.safety-narrative',
      status: 'waiting-approval',
      highRiskBlockPresent: true,
      reasons: [
        expect.objectContaining({
          kind: 'approval-required',
          risk: 'danger',
        }),
      ],
      policy: expect.objectContaining({
        alternativesDoNotExecute: true,
        approvalsRemainRequired: true,
      }),
    }));
  });

  it('maps gateway snapshots with safety narrative into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-03T22:35:00.000Z'),
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
      sessionId: 'session-cc-safety',
      text: 'corrija arquivo e rode testes',
      requestedTools: [],
    });
    const projection = buildDashboardRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.safetyNarrative).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.safety-narrative',
      status: 'waiting-approval',
      highRiskBlockPresent: true,
      reasons: expect.arrayContaining([
        expect.objectContaining({
          kind: 'approval-required',
        }),
      ]),
    }));
  });
});
