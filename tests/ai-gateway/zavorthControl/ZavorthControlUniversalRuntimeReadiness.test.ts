import { buildZavorthControlZavorthControlViewModel } from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/adapters/zavorthControlZavorthControlAdapter.js';
import { buildZavorthControlViewModelFromZavorthAgentGatewaySnapshot } from '../../../src/ai-gateway/app/(zavorthControl)/control/zavorth-control/adapters/zavorthAgentGatewayZavorthControlAdapter.js';
import { ZavorthAgentGateway } from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-${index}`;
  };
}

describe('ZavorthControlUniversalRuntimeReadiness', () => {
  it('accepts future Universal Agent Runtime fields without changing the UI contract', () => {
    const viewModel = buildZavorthControlZavorthControlViewModel({
      adapterSource: {
        kind: 'universal-agent-runtime',
        label: 'Zavorth Agent Gateway',
        version: '0.1',
      },
      runtime: {
        status: 'ready',
      },
      wsStatus: 'connected',
      effectiveSessionId: 'session-42',
      agentRun: {
        runId: 'run-42',
        status: 'running',
        goal: 'Comparar o que mudou nesta pasta',
        sessionId: 'session-42',
        events: [
          {
            id: 'run-event-1',
            kind: 'tool',
            title: 'workspace_compare',
            status: 'running',
          },
        ],
      },
      agentEvents: [
        {
          id: 'agent-event-1',
          kind: 'thinking',
          title: 'Plano preparado',
          status: 'thinking',
        },
      ],
      toolExposureProfile: {
        mode: 'confirm',
        summary: 'Ferramentas expostas pelo gateway universal.',
        tools: [
          {
            id: 'fs.read',
            label: 'Ler arquivos',
            risk: 'safe',
          },
          {
            id: 'shell.exec',
            label: 'Executar shell',
            risk: 'danger',
            requiresApproval: true,
          },
        ],
      },
      replyPorts: [
        {
          id: 'web-control',
          label: 'ZavorthControl',
          kind: 'web',
          status: 'available',
          primary: true,
        },
        {
          id: 'terminal',
          label: 'Terminal',
          kind: 'cli',
          status: 'degraded',
        },
      ],
      modelProfile: {
        provider: 'OpenAI',
        model: 'gpt-5.2',
        routingPolicy: 'gateway',
        supportsTools: true,
      },
    });

    expect(viewModel.adapterSource).toEqual(expect.objectContaining({
      kind: 'universal-agent-runtime',
      label: 'Zavorth Agent Gateway',
    }));
    expect(viewModel.agentRun).toEqual(expect.objectContaining({
      id: 'run-42',
      sessionId: 'session-42',
      status: 'running',
      title: 'Comparar o que mudou nesta pasta',
    }));
    expect(viewModel.agentRun?.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'run-event-1',
        kind: 'tool',
        status: 'running',
      }),
      expect.objectContaining({
        id: 'agent-event-1',
        kind: 'thinking',
        status: 'running',
      }),
    ]));
    expect(viewModel.toolExposure).toEqual(expect.objectContaining({
      mode: 'confirm',
      summary: 'Ferramentas expostas pelo gateway universal.',
      tools: expect.arrayContaining([
        expect.objectContaining({
          id: 'fs.read',
          risk: 'safe',
          requiresApproval: false,
        }),
        expect.objectContaining({
          id: 'shell.exec',
          risk: 'danger',
          requiresApproval: true,
        }),
      ]),
    }));
    expect(viewModel.replyPorts).toEqual([
      expect.objectContaining({
        id: 'web-control',
        kind: 'web',
        status: 'available',
        primary: true,
      }),
      expect.objectContaining({
        id: 'terminal',
        kind: 'cli',
        status: 'degraded',
      }),
    ]);
    expect(viewModel.modelProfile).toEqual(expect.objectContaining({
      providerLabel: 'OpenAI',
      modelLabel: 'gpt-5.2',
      routingPolicy: 'gateway',
      supportsTools: true,
    }));
  });

  it('keeps the current adapter honest and channel-neutral while the universal runtime is absent', () => {
    const viewModel = buildZavorthControlZavorthControlViewModel({
      runtime: {
        provider: 'Google',
        model: 'gemini-live',
      },
      wsStatus: 'connected',
      capabilities: [
        {
          capabilityId: 'workspace.read',
          title: 'Ler workspace',
          risk: 'safe',
        },
      ],
    });

    expect(viewModel.adapterSource.kind).toBe('control-page');
    expect(viewModel.agentRun).toBeNull();
    expect(viewModel.toolExposure).toEqual(expect.objectContaining({
      mode: 'safe',
      tools: [
        expect.objectContaining({
          id: 'workspace.read',
          label: 'Ler workspace',
          risk: 'safe',
        }),
      ],
    }));
    expect(viewModel.replyPorts).toEqual([
      expect.objectContaining({
        id: 'zavorthControl',
        kind: 'web',
        status: 'available',
        primary: true,
      }),
    ]);
    expect(viewModel.replyPorts.some((port) => port.kind === 'telegram')).toBe(false);
    expect(viewModel.modelProfile).toEqual(expect.objectContaining({
      providerLabel: 'Google',
      modelLabel: 'gemini-live',
      routingPolicy: 'direct',
    }));
  });

  it('projects ZavorthAgentGatewaySnapshot into the zavorthControl view model without source-runtime shapes', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T17:00:00.000Z'),
      idFactory: createIdFactory(),
      executor: ({ run }) => ({
        status: 'completed',
        summary: 'Artifact pronto pelo runtime universal.',
        replyText: 'Artifact pronto.',
        artifacts: [
          {
            id: 'artifact-zavorthControl-readiness',
            title: 'Readiness report',
            kind: 'report',
            createdAt: run.createdAt,
            sessionId: run.sessionId,
            status: 'ready',
          },
        ],
        memorySignals: [
          {
            id: 'memory-zavorthControl-readiness',
            title: 'Contexto usado',
            layer: 'working',
            summary: 'Contexto hot/warm/cold preservado no run.',
          },
        ],
      }),
    });

    const completed = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-zavorthControl-readiness',
      text: 'gere um artifact rastreavel',
      requestedTools: ['read_file'],
      modelProfile: {
        providerLabel: 'Zavorth',
        modelLabel: 'readiness-model',
        routingPolicy: 'gateway',
        supportsTools: true,
      },
      metadata: {
        context: {
          hot: { metadata: { layer: 'hot' } },
          warm: { metadata: { layer: 'warm' } },
          cold: { metadata: { layer: 'cold' } },
        },
      },
    });
    const viewModel = buildZavorthControlViewModelFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: completed.run.id }),
    );

    expect(viewModel.adapterSource).toEqual(expect.objectContaining({
      kind: 'universal-agent-runtime',
      label: 'Zavorth Agent Gateway',
    }));
    expect(viewModel.runtime.status).toBe('ready');
    expect(viewModel.agentRun).toEqual(expect.objectContaining({
      id: completed.run.id,
      sessionId: 'session-zavorthControl-readiness',
      status: 'completed',
      summary: 'Artifact pronto pelo runtime universal.',
    }));
    expect(viewModel.artifacts).toEqual([
      expect.objectContaining({
        id: 'artifact-zavorthControl-readiness',
        status: 'ready',
      }),
    ]);
    expect(viewModel.memorySignals).toEqual([
      expect.objectContaining({
        id: 'memory-zavorthControl-readiness',
        layer: 'working',
      }),
    ]);
    expect(viewModel.modelProfile).toEqual(expect.objectContaining({
      providerLabel: 'Zavorth',
      modelLabel: 'readiness-model',
      routingPolicy: 'gateway',
      supportsTools: true,
    }));
    expect(JSON.stringify(viewModel)).not.toContain('Fixture External Runtime');
  });

  it('represents approval waiting, worker queued, offline and loading states as Zavorth UI concepts', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-27T17:05:00.000Z'),
      idFactory: createIdFactory(),
    });
    const pending = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-zavorthControl-approval',
      text: 'edite um arquivo quando aprovado',
      requestedTools: ['write_file'],
    });
    const approved = await gateway.approve(pending.run.approvals[0].id);
    const queuedViewModel = buildZavorthControlViewModelFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: approved?.run.id }),
    );
    const offlineViewModel = buildZavorthControlZavorthControlViewModel({
      runtimeStatus: 'offline',
      wsStatus: 'disconnected',
      loading: true,
    });

    expect(queuedViewModel.runtime.status).toBe('degraded');
    expect(queuedViewModel.agentRun).toEqual(expect.objectContaining({
      status: 'queued',
    }));
    expect(queuedViewModel.tasks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: 'queued',
        summary: expect.stringContaining('worker/executor'),
      }),
    ]));
    expect(queuedViewModel.health.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'workflow-queue',
        status: 'degraded',
      }),
    ]));
    expect(offlineViewModel.runtime.status).toBe('offline');
    expect(offlineViewModel.replyPorts).toEqual([
      expect.objectContaining({
        kind: 'web',
        status: 'offline',
      }),
    ]);
  });
});
