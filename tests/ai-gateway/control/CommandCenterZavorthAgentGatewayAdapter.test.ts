import { ZavorthAgentGateway } from '../../../src/runtime/agent/index.js';
import {
  buildCommandCenterViewModelFromZavorthAgentGatewaySnapshot,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/adapters/zavorthAgentGatewayCommandCenterAdapter.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-${index}`;
  };
}

describe('CommandCenterZavorthAgentGatewayAdapter', () => {
  it('projects a Universal Agent Runtime snapshot into the Command Center view model', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T14:00:00.000Z'),
      idFactory: createIdFactory(),
      defaultProviderLabel: 'OpenAI',
      defaultModelLabel: 'gpt-5.2',
      executor: ({ run }) => ({
        status: 'completed',
        summary: 'Relatorio preparado pelo runtime universal.',
        replyText: 'Relatorio pronto.',
        memorySignals: [
          {
            id: 'memory-1',
            title: 'Preferencia do operador',
            layer: 'semantic',
            summary: 'Prefere Command Center como entrada oficial.',
            confidence: 0.95,
          },
        ],
        artifacts: [
          {
            id: 'artifact-1',
            title: 'Relatorio',
            kind: 'report',
            createdAt: run.createdAt,
            sessionId: run.sessionId,
            status: 'ready',
          },
        ],
      }),
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-ui',
      text: 'me envie o relatorio em PDF',
      requestedTools: ['pdf.generate'],
      modelProfile: {
        routingPolicy: 'gateway',
        supportsTools: true,
      },
      metadata: {
        capabilityNegotiationApproved: true,
      },
    });
    const viewModel = buildCommandCenterViewModelFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );

    expect(viewModel.adapterSource).toEqual(expect.objectContaining({
      kind: 'universal-agent-runtime',
      label: 'Zavorth Agent Gateway',
    }));
    expect(viewModel.agentRun).toEqual(expect.objectContaining({
      id: result.run.id,
      status: 'completed',
      sessionId: 'session-ui',
      title: 'me envie o relatorio em PDF',
    }));
    expect(viewModel.runtime).toEqual(expect.objectContaining({
      currentProviderLabel: 'OpenAI',
      currentModelLabel: 'gpt-5.2',
      activeSessionId: 'session-ui',
    }));
    expect(viewModel.toolExposure).toEqual(expect.objectContaining({
      mode: 'confirm',
      tools: [
        expect.objectContaining({
          id: 'pdf.generate',
          risk: 'attention',
          requiresApproval: false,
        }),
      ],
    }));
    expect(viewModel.replyPorts).toEqual([
      expect.objectContaining({
        id: 'web:primary',
        kind: 'web',
        label: 'Command Center',
        primary: true,
      }),
    ]);
    expect(viewModel.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: 'user',
        text: 'me envie o relatorio em PDF',
      }),
      expect.objectContaining({
        role: 'assistant',
        text: 'Relatorio preparado pelo runtime universal.',
      }),
    ]));
    expect(viewModel.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: result.run.id,
        runId: result.run.id,
        status: 'completed',
      }),
    ]));
    expect(viewModel.replay).toEqual(expect.objectContaining({
      runId: result.run.id,
      status: 'available',
      artifactCount: 1,
    }));
    expect(viewModel.artifacts).toEqual([
      expect.objectContaining({
        id: 'artifact-1',
        kind: 'report',
      }),
    ]);
    expect(viewModel.memorySignals).toEqual([
      expect.objectContaining({
        id: 'memory-1',
        layer: 'semantic',
      }),
    ]);
  });
});
