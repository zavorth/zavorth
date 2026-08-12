import { ZavorthAgentGateway } from '../../../src/runtime/agent/index.js';
import {
  buildZavorthControlViewModelFromZavorthAgentGatewaySnapshot,
} from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/adapters/zavorthAgentGatewayZavorthControlAdapter.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-${index}`;
  };
}

describe('ZavorthControlZavorthAgentGatewayAdapter', () => {
  it('projects a Universal Agent Runtime snapshot into the ZavorthControl view model', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T14:00:00.000Z'),
      idFactory: createIdFactory(),
      defaultProviderLabel: 'OpenAI',
      defaultModelLabel: 'gpt-4o',
      executor: ({ run }) => ({
        status: 'completed',
        summary: 'Report preparado pelo runtime universal.',
        replyText: 'Report ready.',
        memorySignals: [
          {
            id: 'memory-1',
            title: 'Preferencia do operador',
            layer: 'semantic',
            summary: 'Prefere ZavorthControl como entrada oficial.',
            confidence: 0.95,
          },
        ],
        artifacts: [
          {
            id: 'artifact-1',
            title: 'Report',
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
      text: 'send me the PDF report',
      requestedTools: ['pdf.generate'],
      modelProfile: {
        routingPolicy: 'gateway',
        supportsTools: true,
      },
      metadata: {
        capabilityNegotiationApproved: true,
      },
    });
    const viewModel = buildZavorthControlViewModelFromZavorthAgentGatewaySnapshot(
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
      title: 'send me the PDF report',
    }));
    expect(viewModel.runtime).toEqual(expect.objectContaining({
      currentProviderLabel: 'OpenAI',
      currentModelLabel: 'gpt-4o',
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
        label: 'ZavorthControl',
        primary: true,
      }),
    ]);
    expect(viewModel.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: 'user',
        text: 'send me the PDF report',
      }),
      expect.objectContaining({
        role: 'assistant',
        text: 'Report preparado pelo runtime universal.',
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
