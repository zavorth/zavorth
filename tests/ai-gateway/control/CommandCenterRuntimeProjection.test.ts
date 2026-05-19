import { ZavorthAgentGateway } from '../../../src/runtime/agent/index.js';
import {
  COMMAND_CENTER_RUNTIME_PROJECTION_VERSION,
  buildDashboardAdapterInputFromCommandCenterRuntimeProjection,
  buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections/index.js';
import {
  buildCommandCenterAdapterInputFromZavorthAgentGatewaySnapshot,
  buildCommandCenterViewModelFromZavorthAgentGatewaySnapshot,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/adapters/zavorthAgentGatewayCommandCenterAdapter.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-projection-${index}`;
  };
}

describe('CommandCenterRuntimeProjection', () => {
  it('projects ZavorthAgentGateway snapshots through a formal projection before the ViewModel', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T15:00:00.000Z'),
      idFactory: createIdFactory(),
      defaultProviderLabel: 'OpenAI',
      defaultModelLabel: 'gpt-5.2',
      executor: ({ run }) => ({
        status: 'completed',
        summary: 'Inventario entregue pelo runtime universal.',
        replyText: 'Inventario pronto.',
        events: [
          {
            kind: 'tool',
            title: 'workspace_scan',
            detail: 'Workspace analisado em modo leitura.',
            status: 'done',
          },
        ],
        artifacts: [
          {
            id: 'artifact-projection-1',
            title: 'Inventario',
            kind: 'report',
            createdAt: run.createdAt,
            sessionId: run.sessionId,
            status: 'ready',
          },
        ],
      }),
    });

    const pending = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-projection',
      text: 'atualize o inventario do workspace',
      requestedTools: ['write_file'],
      modelProfile: {
        routingPolicy: 'gateway',
        supportsTools: true,
      },
    });
    expect(pending.run.status).toBe('waiting_approval');

    const result = await gateway.approve(pending.run.id);
    expect(result).toEqual(expect.objectContaining({
      resumed: true,
    }));
    if (!result) {
      throw new Error('Expected approved projection run to resume.');
    }

    const snapshot = gateway.buildSnapshot({ activeRunId: result.run.id });
    const projection = buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot(snapshot);
    const adapterInput = buildCommandCenterAdapterInputFromZavorthAgentGatewaySnapshot(snapshot);
    const adapterInputFromProjection = buildDashboardAdapterInputFromCommandCenterRuntimeProjection(projection);
    const viewModel = buildCommandCenterViewModelFromZavorthAgentGatewaySnapshot(snapshot);

    expect(projection).toEqual(expect.objectContaining({
      projectionVersion: COMMAND_CENTER_RUNTIME_PROJECTION_VERSION,
      runtimeStatus: 'ready',
      wsStatus: 'connected',
      effectiveSessionId: 'session-projection',
    }));
    expect(projection.agentRun).toEqual(expect.objectContaining({
      id: result.run.id,
      status: 'completed',
      title: 'atualize o inventario do workspace',
    }));
    expect(projection.artifacts).toEqual([
      expect.objectContaining({
        id: 'artifact-projection-1',
        kind: 'report',
      }),
    ]);
    expect(adapterInput.adapterSource).toEqual(expect.objectContaining({
      kind: 'universal-agent-runtime',
      version: COMMAND_CENTER_RUNTIME_PROJECTION_VERSION,
    }));
    expect(adapterInputFromProjection).toEqual(expect.objectContaining({
      adapterSource: expect.objectContaining({
        version: COMMAND_CENTER_RUNTIME_PROJECTION_VERSION,
      }),
      agentRun: expect.objectContaining({
        id: result.run.id,
      }),
    }));
    expect(adapterInput.agentRun).toEqual(expect.objectContaining({
      id: result.run.id,
    }));
    expect(viewModel.agentRun).toEqual(expect.objectContaining({
      id: result.run.id,
      status: 'completed',
    }));
    expect(viewModel.replay).toEqual(expect.objectContaining({
      runId: result.run.id,
      status: 'available',
      artifactCount: 1,
    }));
  });

  it('projects Run Observatory queries from the gateway snapshot into the Command Center view model', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T15:05:00.000Z'),
      idFactory: createIdFactory(),
      defaultProviderLabel: 'Gemini',
      defaultModelLabel: 'gemini-2.5-flash',
      executor: ({ request }) => ({
        status: request.text.includes('falhe') ? 'failed' : 'completed',
        summary: `Resultado para ${request.traceId}.`,
        replyText: 'Resultado observavel.',
      }),
    });

    await gateway.handle({
      requestId: 'request-projection-observatory-a',
      traceId: 'trace-projection-observatory-a',
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-projection-observatory-a',
      text: 'responda sem ferramenta',
      requestedTools: [],
    });
    const failed = await gateway.handle({
      requestId: 'request-projection-observatory-b',
      traceId: 'trace-projection-observatory-b',
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-projection-observatory-b',
      text: 'falhe para observar status',
      requestedTools: [],
      metadata: {
        estimatedCostUnits: 3,
      },
    });

    const snapshot = gateway.buildSnapshot({
      activeTraceId: 'trace-projection-observatory-b',
      runStatus: 'failed',
    });
    const projection = buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot(snapshot);
    const adapterInput = buildDashboardAdapterInputFromCommandCenterRuntimeProjection(projection);
    const viewModel = buildCommandCenterViewModelFromZavorthAgentGatewaySnapshot(snapshot);

    expect(projection.runObservatory).toEqual(expect.objectContaining({
      contractVersion: '2026-05-03.run-observatory',
      query: expect.objectContaining({
        traceId: 'trace-projection-observatory-b',
        status: 'failed',
      }),
      totalRuns: 2,
      matchedRuns: 1,
      summary: expect.objectContaining({
        failedRunCount: 1,
        receiptCount: expect.any(Number),
      }),
      health: expect.objectContaining({
        status: 'degraded',
        receiptsAvailable: true,
      }),
      replay: expect.objectContaining({
        available: true,
      }),
      runs: [
        expect.objectContaining({
          id: failed.run.id,
          traceId: 'trace-projection-observatory-b',
          status: 'failed',
          matchedBy: expect.arrayContaining(['traceId', 'status']),
        }),
      ],
    }));
    expect(adapterInput.runObservatory).toEqual(expect.objectContaining({
      matchedRuns: 1,
    }));
    expect(viewModel.runObservatory.runs).toEqual([
      expect.objectContaining({
        id: failed.run.id,
        traceId: 'trace-projection-observatory-b',
        status: 'failed',
      }),
    ]);
    expect(viewModel.budget).toEqual(expect.objectContaining({
      source: 'RunBudgetPolicy',
      estimatedCostUnits: 3,
    }));
  });

  it('keeps approvals and durable workflow jobs visible in the Projection layer', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T15:10:00.000Z'),
      idFactory: createIdFactory(),
      defaultProviderLabel: 'OpenAI',
      defaultModelLabel: 'gpt-5.2',
    });

    const pending = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-projection-approval',
      text: 'corrija o arquivo e rode os testes',
      requestedTools: ['write_file', 'shell.exec'],
      modelProfile: {
        routingPolicy: 'gateway',
        supportsTools: true,
      },
    });

    const projection = buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: pending.run.id }),
    );

    expect(projection.runtimeStatus).toBe('degraded');
    expect(projection.runtimeWarnings).toEqual(expect.arrayContaining([
      'Ha uma aprovacao pendente antes de continuar.',
    ]));
    expect(projection.approvals).toEqual([
      expect.objectContaining({
        id: pending.run.approvals[0].id,
        status: 'pending',
        risk: 'danger',
      }),
    ]);
    expect(projection.workflowJobs).toEqual([
      expect.objectContaining({
        runId: pending.run.id,
        status: 'waiting_approval',
      }),
    ]);
    expect(projection.health?.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'approval-gate',
        status: 'degraded',
      }),
      expect.objectContaining({
        id: 'workflow-queue',
        status: 'degraded',
      }),
    ]));
  });

  it('projects automatic subagent decision telemetry for the dashboard', async () => {
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-26T15:15:00.000Z'),
      idFactory: createIdFactory(),
      defaultProviderLabel: 'Gemini',
      defaultModelLabel: 'gemini-2.5-flash',
      executor: () => ({
        status: 'completed',
        summary: 'Auditoria sintetizada.',
        replyText: 'Auditoria pronta.',
      }),
    });

    const result = await gateway.handle({
      requestId: 'request-subagent-auto-projection',
      traceId: 'trace-subagent-auto-projection',
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-subagent-auto-projection',
      text: 'faca uma auditoria profunda em todo o Zavorth, procure falhas e valide os achados',
      requestedTools: [],
      metadata: {
        taskSubtype: 'audit',
      },
    });

    const snapshot = gateway.buildSnapshot({ activeRunId: result.run.id });
    const projection = buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot(snapshot);
    const viewModel = buildCommandCenterViewModelFromZavorthAgentGatewaySnapshot(snapshot);

    expect(projection.subagentAutoInvocation).toEqual(expect.objectContaining({
      status: 'auto-selected',
      selectedBy: 'implicit-complexity',
      roles: expect.arrayContaining([expect.objectContaining({ roleId: 'auditor' })]),
      operational: expect.objectContaining({
        runId: result.run.id,
        traceId: 'trace-subagent-auto-projection',
        requestId: 'request-subagent-auto-projection',
        sessionId: 'session-subagent-auto-projection',
        selectedSessionId: 'session-subagent-auto-projection',
        selectedRunId: result.run.id,
        runtimeStatus: 'completed',
        workerResults: expect.any(Number),
      }),
      actions: expect.arrayContaining([
        expect.objectContaining({ command: '/agents status' }),
        expect.objectContaining({ command: '/agents read session-subagent-auto-projection' }),
        expect.objectContaining({ command: '/agents summarize session-subagent-auto-projection' }),
      ]),
      timeline: expect.arrayContaining([
        expect.objectContaining({ title: 'Decisao de subagentes' }),
      ]),
      receipts: expect.arrayContaining([
        expect.objectContaining({ kind: 'decision' }),
      ]),
      surface: expect.objectContaining({
        channelCommand: '/agents status',
      }),
      safety: expect.objectContaining({
        noRawChainOfThought: true,
        noSecretValuesSerialized: true,
      }),
    }));
    expect(viewModel.subagentAutoInvocation).toEqual(expect.objectContaining({
      selectedBy: 'implicit-complexity',
      nextSafeAction: expect.stringContaining('Acompanhar'),
      operational: expect.objectContaining({
        selectedSessionId: 'session-subagent-auto-projection',
      }),
      actions: expect.arrayContaining([
        expect.objectContaining({ id: 'agents-status' }),
      ]),
    }));
  });
});
