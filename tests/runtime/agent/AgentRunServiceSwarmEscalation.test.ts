import {
  AgentRunService,
} from '../../../src/runtime/agent/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => `${prefix}-${++index}`;
}

describe('AgentRunService swarm escalation', () => {
  it('turns natural swarm.run requests into an approval-gated proposal through ReplyPipeline', async () => {
    const executor = jest.fn();
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T10:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'operator',
      channel: 'telegram',
      sessionId: 'telegram:42',
      text: 'monte uma equipe de agentes para revisar esta arquitetura',
      requestedTools: ['swarm.run'],
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.run).toEqual(expect.objectContaining({
      status: 'waiting_approval',
      summary: 'Proposta de swarm estruturado aguardando aprovacao.',
    }));
    expect(result.run.approvals).toEqual([
      expect.objectContaining({
        status: 'pending',
        risk: 'attention',
        title: 'Aprovar swarm estruturado',
      }),
    ]);
    expect(result.run.metadata).toEqual(expect.objectContaining({
      executionEscalation: expect.objectContaining({
        target: 'swarm',
        reason: 'complex-objective-swarm',
        subagentReceipts: expect.arrayContaining([
          expect.objectContaining({
            status: 'planned',
            approvalBoundary: expect.objectContaining({
              requiresApproval: true,
            }),
          }),
        ]),
      }),
      swarmEscalationProposal: expect.objectContaining({
        source: 'AgentRunService',
        launchServiceCalled: false,
      }),
    }));
    expect(result.replies[0]).toEqual(expect.objectContaining({
      text: expect.stringContaining('Proposta de swarm estruturado preparada.'),
      port: expect.objectContaining({
        kind: 'telegram',
      }),
    }));
  });

  it('routes discovered swarm intent before generic capability negotiation', async () => {
    const executor = jest.fn();
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T10:05:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'operator',
      channel: 'telegram',
      sessionId: 'telegram:42',
      text: 'monte uma equipe de agentes para revisar esta arquitetura',
      requestedTools: [],
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.run.status).toBe('waiting_approval');
    expect(result.run.metadata.naturalCapabilityDiscovery).toEqual(expect.objectContaining({
      recommendedToolNames: expect.arrayContaining(['swarm.run']),
    }));
    expect(result.run.metadata.capabilityNegotiation).toBeUndefined();
    expect(result.run.metadata.swarmEscalationProposal).toEqual(expect.objectContaining({
      target: 'swarm',
      launchServiceCalled: false,
    }));
    expect(result.replies[0].text).toContain('Proposta de swarm estruturado preparada.');
  });

  it('executes an approved swarm proposal through DynamicHierarchySwarmService and returns via ReplyPipeline', async () => {
    const executor = jest.fn();
    const launchHierarchy = jest.fn((input: any) => ({
      plan: {
        hierarchyId: input.hierarchyId,
        objective: input.objective,
        complexity: 'medium',
        maxDepth: 2,
        maxLeafRoles: 3,
        rootNodes: [],
        leafRoles: [
          { id: 'planner', label: 'Planner', systemPrompt: 'Plan.' },
        ],
        totalNodes: 1,
        traceId: input.hierarchyId,
        runId: input.hierarchyId,
        sessionId: null,
        execution_lifecycle: [],
        subagentReceipts: [
          { roleId: 'planner', status: 'planned' },
        ],
      },
      snapshot: {
        swarmId: input.hierarchyId,
        traceId: input.hierarchyId,
        runId: input.hierarchyId,
        sessionId: null,
        status: 'completed',
        objective: input.objective,
        roles: [],
        startedAt: '2026-04-27T10:00:00.000Z',
        finishedAt: '2026-04-27T10:00:01.000Z',
        synthesizedOutput: 'Swarm revisou a arquitetura.',
        execution_lifecycle: [],
        subagentReceipts: [
          { roleId: 'planner', status: 'completed' },
        ],
      },
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T10:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
      swarmHierarchyService: { launchHierarchy } as any,
    });
    const request = {
      userId: 'operator',
      channel: 'telegram' as const,
      sessionId: 'telegram:42',
      text: 'monte uma equipe de agentes para revisar esta arquitetura',
      requestedTools: ['swarm.run'],
    };

    const pending = await service.run(request);
    const result = await service.resumeApprovedRun(pending.run, request);

    expect(executor).not.toHaveBeenCalled();
    expect(launchHierarchy).toHaveBeenCalledWith(expect.objectContaining({
      hierarchyId: pending.run.id,
      objective: request.text,
      requestedBy: 'operator',
      surface: 'telegram',
    }));
    expect(result.run).toEqual(expect.objectContaining({
      status: 'completed',
      summary: 'Swarm aprovado e concluido pelo runtime existente.',
    }));
    expect(result.run.metadata).toEqual(expect.objectContaining({
      swarmEscalationProposal: expect.objectContaining({
        launchServiceCalled: true,
      }),
      swarmExecutionResult: expect.objectContaining({
        source: 'DynamicHierarchySwarmService',
        launchServiceCalled: true,
        status: 'completed',
        subagentReceiptCount: 1,
      }),
    }));
    expect(result.replies[0]).toEqual(expect.objectContaining({
      text: expect.stringContaining('Swarm aprovado e concluido pelo runtime existente.'),
      port: expect.objectContaining({ kind: 'telegram' }),
    }));
    expect(result.replies[0].text).toContain('Swarm revisou a arquitetura.');
  });

  it('waits for approved swarm completion when the existing hierarchy service exposes a final snapshot', async () => {
    const executor = jest.fn();
    const launchHierarchy = jest.fn();
    const launchHierarchyAndWait = jest.fn((input: any) => Promise.resolve({
      plan: {
        hierarchyId: input.hierarchyId,
        objective: input.objective,
        complexity: 'medium',
        maxDepth: 2,
        maxLeafRoles: 3,
        rootNodes: [],
        leafRoles: [
          { id: 'planner', label: 'Planner', systemPrompt: 'Plan.' },
        ],
        totalNodes: 1,
        traceId: input.hierarchyId,
        runId: input.hierarchyId,
        sessionId: null,
        execution_lifecycle: [],
        subagentReceipts: [
          { roleId: 'planner', status: 'planned' },
        ],
      },
      snapshot: {
        swarmId: input.hierarchyId,
        traceId: input.hierarchyId,
        runId: input.hierarchyId,
        sessionId: null,
        status: 'completed',
        objective: input.objective,
        roles: [],
        startedAt: '2026-04-27T10:00:00.000Z',
        finishedAt: '2026-04-27T10:00:02.000Z',
        synthesizedOutput: 'Swarm entregou o resultado final assinado.',
        execution_lifecycle: [],
        subagentReceipts: [
          { roleId: 'planner', status: 'completed' },
        ],
      },
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-04-27T10:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
      swarmHierarchyService: { launchHierarchy, launchHierarchyAndWait } as any,
    });
    const request = {
      userId: 'operator',
      channel: 'telegram' as const,
      sessionId: 'telegram:42',
      text: 'monte uma equipe de agentes para revisar esta arquitetura',
      requestedTools: ['swarm.run'],
    };

    const pending = await service.run(request);
    const result = await service.resumeApprovedRun(pending.run, request);

    expect(executor).not.toHaveBeenCalled();
    expect(launchHierarchyAndWait).toHaveBeenCalledWith(expect.objectContaining({
      hierarchyId: pending.run.id,
      objective: request.text,
      requestedBy: 'operator',
      surface: 'telegram',
    }));
    expect(launchHierarchy).not.toHaveBeenCalled();
    expect(result.run.status).toBe('completed');
    expect(result.run.metadata.swarmEscalationProposal).toEqual(expect.objectContaining({
      launchServiceCalled: true,
      asyncCompletionReturned: true,
    }));
    expect(result.run.metadata.swarmExecutionResult).toEqual(expect.objectContaining({
      status: 'completed',
      asyncCompletionReturned: true,
    }));
    expect(result.replies[0].text).toContain('Swarm entregou o resultado final assinado.');
  });

  it('proposes a Swarm Scale Plane for explicit high-scale subagent requests', async () => {
    const executor = jest.fn();
    const service = new AgentRunService({
      now: () => new Date('2026-06-01T10:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'operator',
      channel: 'telegram',
      sessionId: 'telegram:42',
      text: 'rode uma auditoria paralela com 4000 subagentes para auditar tudo',
      requestedTools: ['swarm.run'],
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.run.status).toBe('waiting_approval');
    expect(result.run.approvals[0]).toEqual(expect.objectContaining({
      title: 'Aprovar Swarm Scale Plane',
      risk: 'attention',
    }));
    expect(result.run.metadata.swarmEscalationProposal).toEqual(expect.objectContaining({
      kind: 'scale-plane',
      launchServiceCalled: false,
      scalePlan: expect.objectContaining({
        desiredAgents: 4000,
        maxSteps: 4000,
        maxConcurrency: 30,
      }),
    }));
    expect(result.replies[0].text).toContain('Proposta de Swarm Scale Plane preparada.');
    expect(result.replies[0].text).toContain('Agentes planejados: 4000.');
  });

  it('proposes a Swarm Scale Plane from workload complexity without magic words', async () => {
    const executor = jest.fn();
    const service = new AgentRunService({
      now: () => new Date('2026-06-01T10:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
    });

    const result = await service.run({
      userId: 'operator',
      channel: 'telegram',
      sessionId: 'telegram:42',
      text: 'Analise todo o Zavorth, todos os modulos do dashboard, CLI, runtime, providers e canais; faca auditoria profunda de arquitetura, seguranca, DDD, testes e riscos com validacao completa.',
      requestedTools: [],
    });

    expect(executor).not.toHaveBeenCalled();
    expect(result.run.status).toBe('waiting_approval');
    expect(result.run.metadata.swarmEscalationProposal).toEqual(expect.objectContaining({
      kind: 'scale-plane',
      scalePlan: expect.objectContaining({
        desiredAgents: expect.any(Number),
        assessment: expect.objectContaining({
          shouldUseScalePlane: true,
          band: expect.stringMatching(/large|massive/),
          reasons: expect.arrayContaining([
            expect.stringContaining('escopo'),
          ]),
        }),
      }),
    }));
    expect(result.replies[0].text).toContain('Proposta de Swarm Scale Plane preparada.');
  });

  it('executes an approved Swarm Scale Plane through the AgentRun approval path', async () => {
    const executor = jest.fn();
    const launch = jest.fn(async (input: any) => ({
      contractVersion: '2026-06-01.swarm-scale-plane',
      runId: input.runId,
      objective: input.objective,
      status: 'completed',
      createdAt: '2026-06-01T10:00:00.000Z',
      updatedAt: '2026-06-01T10:00:01.000Z',
      completedAt: '2026-06-01T10:00:01.000Z',
      planner: {
        mode: 'heuristic',
        requestedAgents: input.desiredAgents,
        plannedAgents: input.desiredAgents,
        maxAgents: input.maxAgents,
        rationale: 'test scale plane',
      },
      workerPool: {
        mode: input.executionMode,
        maxConcurrency: input.maxConcurrency,
        actualMaxConcurrency: input.maxConcurrency,
        batchesStarted: 10,
        durable: true,
        pauseReason: null,
      },
      cooperationContract: {
        isolatedContextPerAgent: true,
        noSharedMutableWorkspace: true,
        structuredOutputExpected: true,
        reducerOwnsMerge: true,
        toolCallsGoverned: true,
      },
      metrics: {
        queuedAgents: 0,
        runningAgents: 0,
        completedAgents: input.desiredAgents,
        failedAgents: 0,
        cancelledAgents: 0,
        elapsedMs: 1000,
        throughputAgentsPerSecond: input.desiredAgents,
      },
      ledger: {
        maxSteps: input.maxSteps,
        usedSteps: input.desiredAgents,
        remainingSteps: input.maxSteps - input.desiredAgents,
        steps: [],
      },
      agents: [
        { agentId: 'agent-0001', lane: 'planner', status: 'completed', summary: 'ok' },
      ],
      reducer: {
        status: 'ready',
        completedAgents: input.desiredAgents,
        failedAgents: 0,
        conflictCount: 0,
        conflicts: [],
        synthesis: `Swarm Scale Plane completed ${input.desiredAgents}/${input.desiredAgents} agent(s).`,
        confidence: 1,
      },
    }));
    const service = new AgentRunService({
      now: () => new Date('2026-06-01T10:00:00.000Z'),
      idFactory: createIdFactory(),
      executor,
      swarmScalePlaneService: {
        launch,
        resume: jest.fn(),
        listRuns: jest.fn(() => []),
        getRun: jest.fn(),
      } as any,
    });
    const request = {
      userId: 'operator',
      channel: 'telegram' as const,
      sessionId: 'telegram:42',
      text: 'rode uma auditoria paralela com 300 subagentes',
      requestedTools: ['swarm.run'],
    };

    const pending = await service.run(request);
    const result = await service.resumeApprovedRun(pending.run, request);

    expect(executor).not.toHaveBeenCalled();
    expect(launch).toHaveBeenCalledWith(expect.objectContaining({
      runId: `agent-run:${pending.run.id}:scale`,
      objective: request.text,
      desiredAgents: 300,
      maxSteps: 4000,
      maxConcurrency: 30,
      persistState: true,
    }));
    expect(result.run.status).toBe('completed');
    expect(result.run.summary).toContain('Swarm Scale Plane aprovado e concluido');
    expect(result.run.metadata.swarmScaleExecutionResult).toEqual(expect.objectContaining({
      source: 'SwarmScalePlaneService',
      status: 'completed',
      metrics: expect.objectContaining({
        completedAgents: 300,
      }),
    }));
    expect(result.replies[0].text).toContain('Scale run:');
    expect(result.replies[0].text).toContain('Agentes: 300/300');
  });
});
