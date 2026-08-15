import { buildZavorthControlZavorthControlViewModel } from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/adapters/ZavorthControlAdapter.js'
import { buildZavorthControlAdapterInputFromZavorthControlRuntimeProjection } from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/projections/zavorthControlRuntimeProjection.js';
import { buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/projections/zavorthAgentGatewayRuntimeProjection.js';
import { ZavorthAgentGateway } from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-cc-natural-first-${++index}`;
}

describe('ZavorthControl Natural First Runtime ZavorthControl controls', () => {
  it('projects Natural First metadata into a ZavorthControl UX snapshot', () => {
    const viewModel = buildZavorthControlZavorthControlViewModel({
      runtime: {
        status: 'ready',
      },
      wsStatus: 'connected',
      agentRun: {
        id: 'run-natural-first',
        status: 'waiting_approval',
        title: 'publique agora',
        input: 'publique agora',
        channel: 'cli',
        summary: 'Aprovacao Natural First aguardando decisao do operador.',
        updatedAt: '2026-05-11T15:20:00.000Z',
        metadata: {
          naturalFirstEntrypoint: {
            inputKind: 'free-text',
            gatewayRequired: true,
          },
          naturalFirstRoute: {
            route: 'approval-proposal',
            reason: 'Pedido sugere mutacao sensivel ou ferramenta que exige approval.',
            shouldEnterGateway: true,
            effort: 'standard',
            usesLlm: 'optional',
            cost: {
              tier: 'standard',
            },
            risk: {
              level: 'danger',
              requiresApproval: true,
              previewRequired: true,
              reasons: ['dangerous-text-intent'],
            },
          },
          naturalFirstApprovalSafety: {
            contractVersion: 'natural-first-approval-safety/7',
            generatedAt: '2026-05-11T15:20:00.000Z',
            route: 'approval-proposal',
            status: 'approval-required',
            summary: 'Rota approval-proposal exige approval antes de executor/tool.',
            risk: {
              routeRequiresApproval: true,
              toolRequiresApproval: false,
              discoveryRequiresApproval: false,
              previewRequired: true,
              reasons: ['route:approval-proposal'],
            },
            approvals: {
              pendingIds: ['approval-1'],
              approvedIds: [],
              createdApprovalId: 'approval-1',
            },
            enforcement: {
              executorBlockedUntilApproval: true,
              naturalLanguageDoesNotBypassPolicy: true,
              noToolExecutionBeforeApproval: true,
              noApprovalBypass: true,
              existingApprovalHonored: true,
            },
            nextSafeAction: 'Abrir approval generico de intencao sensivel e nao chamar executor.',
          },
        },
      },
    });

    expect(viewModel.naturalFirstRuntime).toEqual(expect.objectContaining({
      contractVersion: 'natural-first-zavorthControl-ux/8',
      route: 'approval-proposal',
      routeLabel: 'Approval',
      status: 'approval-required',
      tone: 'degraded',
      headline: 'Action waiting for approval',
      shouldEnterGateway: true,
      inputKind: 'free-text',
      channel: 'cli',
      costTier: 'standard',
      risk: expect.objectContaining({
        level: 'danger',
        requiresApproval: true,
        previewRequired: true,
        reasons: ['route:approval-proposal'],
      }),
      policies: expect.objectContaining({
        noToolExecutionBeforeApproval: true,
        noApprovalBypass: true,
      }),
      nextSafeAction: 'Abrir approval generico de intencao sensivel e nao chamar executor.',
    }));
    expect(viewModel.naturalFirstRuntime?.stages).toEqual([
      expect.objectContaining({
        id: 'received',
        label: 'Message received',
        status: 'done',
      }),
      expect.objectContaining({
        id: 'classified',
        label: 'Classified as Approval',
        status: 'done',
      }),
      expect.objectContaining({
        id: 'result',
        label: 'Waiting for approval',
        status: 'pending',
      }),
    ]);
  });

  it('maps gateway snapshots into the ZavorthControl Natural First panel contract', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-05-11T15:25:00.000Z'),
      idFactory: createIdFactory(),
      executor: jest.fn(() => ({
        status: 'completed',
        summary: 'Executor nao deveria rodar.',
        replyText: 'executor-called',
      })),
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'cli',
      sessionId: 'session-cc-natural-first',
      text: 'publique agora',
      requestedTools: [],
      metadata: {
        naturalFirstEntrypoint: {
          inputKind: 'free-text',
          gatewayRequired: true,
        },
        naturalFirstRoute: {
          route: 'approval-proposal',
          reason: 'Pedido sugere mutacao sensivel ou ferramenta que exige approval.',
          shouldEnterGateway: true,
          effort: 'standard',
          usesLlm: 'optional',
          cost: {
            tier: 'standard',
          },
          risk: {
            level: 'danger',
            requiresApproval: true,
            previewRequired: true,
            reasons: ['dangerous-text-intent'],
          },
        },
        naturalFirstApprovalSafety: {
          contractVersion: 'natural-first-approval-safety/7',
          generatedAt: '2026-05-11T15:25:00.000Z',
          route: 'approval-proposal',
          status: 'approval-required',
          summary: 'Rota approval-proposal exige approval antes de executor/tool.',
          risk: {
            routeRequiresApproval: true,
            toolRequiresApproval: false,
            discoveryRequiresApproval: false,
            previewRequired: true,
            reasons: ['route:approval-proposal'],
          },
          approvals: {
            pendingIds: ['approval-1'],
            approvedIds: [],
            createdApprovalId: 'approval-1',
          },
          enforcement: {
            executorBlockedUntilApproval: true,
            naturalLanguageDoesNotBypassPolicy: true,
            noToolExecutionBeforeApproval: true,
            noApprovalBypass: true,
            existingApprovalHonored: true,
          },
          nextSafeAction: 'Abrir approval generico de intencao sensivel e nao chamar executor.',
        },
      },
    });
    const projection = buildZavorthControlRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );
    const viewModel = buildZavorthControlZavorthControlViewModel(
      buildZavorthControlAdapterInputFromZavorthControlRuntimeProjection(projection),
    );

    expect(projection.naturalFirstRuntime).toEqual(expect.objectContaining({
      contractVersion: 'natural-first-zavorthControl-ux/8',
      status: 'approval-required',
      headline: 'Action waiting for approval',
      risk: expect.objectContaining({
        requiresApproval: true,
      }),
    }));
    expect(viewModel.naturalFirstRuntime).toEqual(expect.objectContaining({
      status: 'approval-required',
      shouldEnterGateway: true,
      risk: expect.objectContaining({
        requiresApproval: true,
      }),
    }));
    expect(viewModel.naturalFirstRuntime?.stages.map((stage) => stage.label)).toEqual([
      'Message received',
      'Classified as llm-reply',
      'Waiting for approval',
    ]);
  });
});
