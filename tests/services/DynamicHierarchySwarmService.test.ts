import { DynamicHierarchySwarmService } from '../../src/domain/execution/application/DynamicHierarchySwarmService.js';

describe('DynamicHierarchySwarmService', () => {
  it('expands a high-complexity swarm into leaf roles and launches through the swarm boundary', () => {
    const launchSwarm = jest.fn(() => ({
      swarmId: 'hierarchy-1',
      status: 'running',
      objective: 'Close runtime cycle',
      roles: [],
      startedAt: '2026-04-18T10:00:00.000Z',
      finishedAt: null,
      synthesizedOutput: null,
    }));

    const service = new DynamicHierarchySwarmService({
      swarmLauncher: { launchSwarm } as any,
    });

    const result = service.launchHierarchy({
      hierarchyId: 'hierarchy-1',
      objective: 'Fechar a runtime cycle com refactor, sandbox profundo, cross-surface QA e housekeeping supervisionado.',
      roles: [
        {
          id: 'planner',
          label: 'Planner',
          systemPrompt: 'Quebre a missao em trilhas.',
        },
        {
          id: 'implementer',
          label: 'Implementer',
          systemPrompt: 'Implemente a parte principal.',
        },
        {
          id: 'verifier',
          label: 'Verifier',
          systemPrompt: 'Valide riscos e testes.',
        },
      ],
      complexity: 'high',
      maxDepth: 2,
      maxLeafRoles: 6,
      requestedBy: 'tester',
    });

    expect(result.plan.complexity).toBe('high');
    expect(result.plan.totalNodes).toBeGreaterThan(3);
    expect(result.plan.leafRoles.length).toBeGreaterThan(3);
    expect(result.plan.subagentReceipts).toHaveLength(result.plan.leafRoles.length);
    expect(result.plan.subagentReceipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        status: 'planned',
        approvalBoundary: expect.objectContaining({
          requiresApproval: true,
        }),
        scope: expect.objectContaining({
          mode: 'tool_limited',
          allowedPaths: [],
        }),
      }),
    ]));
    expect(result.plan.execution_lifecycle).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'plan',
        status: 'planned',
        source: 'swarm',
        metadata: expect.objectContaining({
          subagentReceiptCount: result.plan.subagentReceipts.length,
        }),
      }),
    ]));
    expect(launchSwarm).toHaveBeenCalledWith(expect.objectContaining({
      swarmId: 'hierarchy-1',
      subagentReceipts: result.plan.subagentReceipts,
      roles: expect.arrayContaining([
        expect.objectContaining({ label: expect.stringContaining('Scope Scout') }),
        expect.objectContaining({ label: expect.stringContaining('Patch Worker') }),
      ]),
    }));
  });

  it('waits for the existing swarm launcher final snapshot when available', async () => {
    const launchSwarm = jest.fn((input: any) => ({
      swarmId: input.swarmId,
      status: 'running',
      objective: input.objective,
      roles: [],
      startedAt: '2026-04-18T10:00:00.000Z',
      finishedAt: null,
      synthesizedOutput: null,
    }));
    const waitForSwarm = jest.fn((swarmId: string) => Promise.resolve({
      swarmId,
      status: 'completed',
      objective: 'Close runtime cycle',
      roles: [],
      startedAt: '2026-04-18T10:00:00.000Z',
      finishedAt: '2026-04-18T10:00:02.000Z',
      synthesizedOutput: 'Governance closed by final swarm synthesis.',
      subagentReceipts: [
        { roleId: 'planner', status: 'completed' },
      ],
    }));

    const service = new DynamicHierarchySwarmService({
      swarmLauncher: { launchSwarm, waitForSwarm } as any,
    });

    const result = await service.launchHierarchyAndWait({
      hierarchyId: 'hierarchy-2',
      objective: 'Fechar a runtime cycle com revisao final.',
      requestedBy: 'tester',
    });

    expect(launchSwarm).toHaveBeenCalledWith(expect.objectContaining({
      swarmId: 'hierarchy-2',
      subagentReceipts: result.plan.subagentReceipts,
    }));
    expect(waitForSwarm).toHaveBeenCalledWith('hierarchy-2');
    expect(result.snapshot).toEqual(expect.objectContaining({
      swarmId: 'hierarchy-2',
      status: 'completed',
      synthesizedOutput: 'Governance closed by final swarm synthesis.',
    }));
  });
});
