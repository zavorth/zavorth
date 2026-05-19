import { ZavorthSupervisorGraphService } from '../../src/services/ZavorthSupervisorGraphService';

function createRoute(overrides: Record<string, unknown> = {}) {
  return {
    stage: '26',
    surface: 'capability-route',
    generatedAt: '2026-04-24T14:00:00.000Z',
    input: 'corrija um bug e rode os testes',
    commandType: '/task',
    selected: {
      id: 'codex',
      label: 'Codex',
      type: 'executor',
      source: 'builtin',
      enabled: true,
      intent: 'code_execution',
      dispatchMode: 'supervised',
      executorPreference: 'codex',
      command: '/task',
      aliases: [],
      matcherCount: 1,
      allowedCommandTypes: ['/task'],
      risk: { level: 'medium', reason: 'Executor tecnico.' },
      permissions: {
        requiresApproval: true,
        policySource: 'manifest',
        scopes: ['approval', 'executor:codex'],
        networkScope: 'local',
        allowedHosts: [],
      },
      artifacts: { kinds: ['patch', 'logs', 'test-report'] },
      lifecycle: null,
      health: { status: 'needs_approval', reason: 'Precisa de aprovacao.' },
      fallback: { chain: ['local_executor', 'conversation'], reason: 'Fallback local.' },
      routing: {
        reason: 'Pedido parece alteracao direcionada de codigo.',
        confidence: 0.88,
        requiresPlanning: true,
        workspaceHint: 'workspace',
      },
    },
    fallbackChain: ['local_executor', 'conversation'],
    decision: {
      intent: 'code_execution',
      dispatchMode: 'supervised',
      executorPreference: 'codex',
      reason: 'Pedido parece alteracao direcionada de codigo.',
      confidence: 0.88,
      requiresApproval: true,
      riskLevel: 'medium',
    },
    ledger: {
      recorded: false,
      entryId: null,
      status: null,
      reason: 'Preview read-only.',
    },
    ...overrides,
  };
}

describe('ZavorthSupervisorGraphService', () => {
  function createService(route = createRoute()) {
    return new ZavorthSupervisorGraphService({
      now: () => new Date('2026-04-24T14:00:00.000Z'),
      capabilityOsService: {
        explainRoute: jest.fn(() => route as any),
      },
    });
  }

  it('plans complex code work through planner, execution, critic and sandbox validation', async () => {
    const service = createService();

    const snapshot = await service.buildSnapshot({
      objective: 'corrija um bug no projeto e rode os testes',
    });

    expect(snapshot.phase).toBe('28');
    expect(snapshot.surface).toBe('supervisor-graph');
    expect(snapshot.mode).toBe('graph');
    expect(snapshot.status).toBe('ready');
    expect(snapshot.nodes.find((node) => node.id === 'planner')?.status).toBe('planned');
    expect(snapshot.nodes.find((node) => node.id === 'coder')?.status).toBe('planned');
    expect(snapshot.nodes.find((node) => node.id === 'critic')?.status).toBe('planned');
    expect(snapshot.nodes.find((node) => node.id === 'sandbox_runner')?.status).toBe('planned');
    expect(snapshot.contracts.criticBeforeDelivery).toBe(true);
    expect(snapshot.contracts.sandboxBeforeRiskyDelivery).toBe(true);
    expect(snapshot.contracts.supervisorDoesNotMutate).toBe(true);
    expect(snapshot.finalResponseContract.includesTests).toBe(true);
  });

  it('keeps simple work linear instead of forcing the graph', async () => {
    const service = new ZavorthSupervisorGraphService({
      now: () => new Date('2026-04-24T14:00:00.000Z'),
    });

    const snapshot = await service.buildSnapshot({ objective: 'responda bom dia' });

    expect(snapshot.mode).toBe('linear');
    expect(snapshot.nodes.filter((node) => node.status !== 'skipped').map((node) => node.id)).toEqual([
      'intake',
      'executor_picker',
      'delivery',
    ]);
    expect(snapshot.contracts.simpleFlowRemainsLinear).toBe(true);
  });

  it('returns a failed sandbox check to correction once before delivery', async () => {
    const service = createService();

    const snapshot = await service.buildSnapshot({
      objective: 'corrija o bug e rode os testes',
      simulateTestFailure: true,
      maxRetries: 1,
    });

    expect(snapshot.reflexion.enabled).toBe(true);
    expect(snapshot.reflexion.attemptsUsed).toBe(1);
    expect(snapshot.reflexion.correctionLoop[0]).toEqual(
      expect.objectContaining({
        from: 'sandbox_runner',
        to: 'coder',
        retryBudgetRemaining: 0,
      }),
    );
    expect(snapshot.ledger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'sandbox_runner',
          to: 'coder',
        }),
      ]),
    );
  });

  it('pauses with a clear summary when budget is exceeded', async () => {
    const service = createService();

    const snapshot = await service.buildSnapshot({
      objective: 'corrija um bug e rode os testes',
      maxCost: 1,
    });

    expect(snapshot.status).toBe('paused');
    expect(snapshot.budget.exceeded).toBe(true);
    expect(snapshot.budget.pauseReason).toContain('Budget insuficiente');
    expect(snapshot.ledger.at(-1)).toEqual(
      expect.objectContaining({
        to: 'paused',
      }),
    );
  });

  it('redacts sensitive data from the decision ledger', async () => {
    const service = createService();

    const snapshot = await service.buildSnapshot({
      objective: 'corrija o deploy usando token sk-secret123456789 e me avise',
    });

    expect(snapshot.objective.preview).toContain('[redacted-secret]');
    expect(snapshot.ledger.every((entry) => entry.evidence.sensitiveData === 'redacted')).toBe(true);
    expect(JSON.stringify(snapshot.ledger)).not.toContain('sk-secret123456789');
  });
});
