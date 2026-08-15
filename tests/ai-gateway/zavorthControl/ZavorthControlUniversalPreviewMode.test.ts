import { buildZavorthControlZavorthControlViewModel } from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/adapters/ZavorthControlAdapter.js';
import { buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/projections/zavorthAgentGatewayRuntimeProjection.js';
import { ZavorthAgentGateway } from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-preview-${++index}`;
}

describe('ZavorthControl Universal Preview Mode Universal Preview', () => {
  it('projects preview metadata into the zavorthControl view model', () => {
    const viewModel = buildZavorthControlZavorthControlViewModel({
      runtime: {
        status: 'ready',
      },
      wsStatus: 'connected',
      agentRun: {
        id: 'run-preview',
        status: 'completed',
        metadata: {
          universalPreviewMode: {
            contractVersion: '2026-05-03.universal-preview',
            generatedAt: '2026-05-03T21:30:00.000Z',
            mode: 'preview-only',
            planSteps: [
              {
                id: 'universal-preview:tool:write_file',
                kind: 'write',
                label: 'Write file',
                toolId: 'write_file',
                risk: 'danger',
                requiresApproval: true,
                previewRequired: false,
                action: 'Solicitar approval antes de executar.',
                impact: 'Pode alterar arquivos.',
              },
            ],
            toolExposure: {
              mode: 'restricted',
              exposedToolIds: ['write_file'],
              blockedToolIds: [],
            },
            risk: {
              highestRisk: 'danger',
              requiresApproval: true,
              previewRequired: false,
              approvalRequiredToolIds: ['write_file'],
              previewRequiredToolIds: [],
            },
            safety: {
              noExecutionPerformed: true,
              naturalLanguageDoesNotBypassPolicy: true,
              workspacePolicyApplies: true,
              approvalsStillRequired: true,
              selfmodApplyBlocked: false,
              computerUseBlockedUntilApproval: false,
              executorBlockedInPreviewMode: true,
              toolsActuallyCalled: [],
            },
            nextSafeAction: 'Revisar o plano e pedir approval antes de executar tools sensiveis.',
          },
        },
      },
    });

    expect(viewModel.universalPreviewMode).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.universal-preview',
      mode: 'preview-only',
      risk: expect.objectContaining({
        highestRisk: 'danger',
        requiresApproval: true,
      }),
      safety: expect.objectContaining({
        noExecutionPerformed: true,
        executorBlockedInPreviewMode: true,
        toolsActuallyCalled: [],
      }),
      planSteps: [
        expect.objectContaining({
          id: 'universal-preview:tool:write_file',
          toolId: 'write_file',
          requiresApproval: true,
        }),
      ],
    }));
  });

  it('maps gateway snapshots with preview into runtime projection', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-03T21:35:00.000Z'),
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
      sessionId: 'session-cc-preview',
      text: 'simule corrigir arquivo sem executar',
      requestedTools: [],
      metadata: {
        universalPreviewMode: {
          contractVersion: '2026-05-03.universal-preview',
          generatedAt: '2026-05-03T21:35:00.000Z',
          mode: 'preview-only',
          toolExposure: {
            mode: 'restricted',
            exposedToolIds: ['write_file'],
            blockedToolIds: [],
          },
          risk: {
            highestRisk: 'danger',
            requiresApproval: true,
            previewRequired: false,
            approvalRequiredToolIds: ['write_file'],
            previewRequiredToolIds: [],
          },
          safety: {
            noExecutionPerformed: true,
            naturalLanguageDoesNotBypassPolicy: true,
            workspacePolicyApplies: true,
            approvalsStillRequired: true,
            previewRemainsRequired: false,
            quarantineRemainsRequired: false,
            selfmodApplyBlocked: false,
            computerUseBlockedUntilApproval: false,
            executorBlockedInPreviewMode: true,
            toolsActuallyCalled: [],
          },
          planSteps: [
            {
              id: 'universal-preview:tool:write_file',
              kind: 'write',
              label: 'Write file',
              toolId: 'write_file',
              risk: 'danger',
              requiresApproval: true,
              previewRequired: false,
              action: 'Solicitar approval antes de executar.',
              impact: 'Pode alterar arquivos.',
            },
          ],
          nextSafeAction: 'Revisar o plano e pedir approval antes de executar tools sensiveis.',
        },
      },
    });
    const projection = buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(projection.universalPreviewMode).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.universal-preview',
      safety: expect.objectContaining({
        noExecutionPerformed: true,
      }),
    }));
  });
});
