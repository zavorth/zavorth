import { EventEmitter } from 'events';
import { ExperimentalSwarmV2Service } from '../../src/services/SwarmV2Service.js';

class FakeSwarmOrchestrator extends EventEmitter {
  private status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled' = 'idle';
  private readonly startedAt = '2026-04-13T10:00:00.000Z';
  private finishedAt: string | null = null;
  private synthesizedOutput: string | null = null;

  constructor(
    private readonly objective: string,
    private readonly roles: Array<{ id: string; label: string }>,
  ) {
    super();
  }

  public async execute() {
    this.status = 'running';
    setTimeout(() => {
      this.emit('role:data', { roleId: this.roles[0]?.id, data: 'research:ok' });
      this.emit('role:finished', { roleId: this.roles[0]?.id, status: 'IDLE' });
      this.status = 'completed';
      this.finishedAt = '2026-04-13T10:00:01.000Z';
      this.synthesizedOutput = 'research:ok';
      this.emit('swarm:finished', this.getSnapshot());
    }, 10);
    return new Promise((resolve) => {
      setTimeout(() => resolve(this.getSnapshot()), 20);
    });
  }

  public getSnapshot() {
    return {
      swarmId: 'fake-swarm',
      status: this.status,
      objective: this.objective,
      roles: this.roles.map((role) => ({
        roleId: role.id,
        label: role.label,
        status: this.status === 'completed' ? 'IDLE' : 'PROCESSING',
        output: this.status === 'completed' ? ['research:ok'] : [],
        startedAt: this.startedAt,
        finishedAt: this.finishedAt,
      })),
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      synthesizedOutput: this.synthesizedOutput,
    };
  }

  public killAll() {
    this.status = 'cancelled';
    this.finishedAt = '2026-04-13T10:00:02.000Z';
  }
}

function waitFor(predicate: () => boolean, timeoutMs: number = 3000): Promise<void> {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error('Timed out waiting for swarm state.'));
        return;
      }
      setTimeout(tick, 25);
    };
    tick();
  });
}

describe('ExperimentalSwarmV2Service', () => {
  it('launches and tracks an experimental swarm until completion', async () => {
    const service = new ExperimentalSwarmV2Service({
      orchestratorFactory: (objective, roles) => new FakeSwarmOrchestrator(objective, roles) as any,
    });

    const initial = service.launchSwarm({
      objective: 'Validate release rollout',
      roles: [
        {
          id: 'research',
          label: 'Research',
          systemPrompt: 'Inspect rollout state.',
        },
      ],
    });

    const awaited = await service.waitForSwarm(initial.swarmId);

    const listed = service.listSwarms();
    const current = service.getSwarm(initial.swarmId);

    expect(initial.status).toBe('running');
    expect(initial.traceId).toBe(initial.swarmId);
    expect(initial.subagentReceipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        roleId: 'research',
        status: 'planned',
        approvalBoundary: expect.objectContaining({
          requiresApproval: true,
        }),
      }),
    ]));
    expect(initial.execution_lifecycle).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'run',
        status: 'running',
        source: 'swarm',
        metadata: expect.objectContaining({
          subagentReceiptCount: 1,
        }),
      }),
    ]));
    expect(awaited.status).toBe('completed');
    expect(awaited.synthesizedOutput).toContain('research:');
    expect(listed).toHaveLength(1);
    expect(current?.status).toBe('completed');
    expect(current?.synthesizedOutput).toContain('research:');
    expect(current?.subagentReceipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        roleId: 'research',
        status: 'completed',
        budgetDecision: expect.objectContaining({
          ok: true,
        }),
        artifacts: ['swarm-output:research'],
      }),
    ]));
    expect(current?.execution_lifecycle).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'completed', runId: initial.swarmId }),
    ]));
  });

  it('returns budget overflow as a subagent receipt instead of hiding it', async () => {
    const service = new ExperimentalSwarmV2Service({
      orchestratorFactory: (objective, roles) => new FakeSwarmOrchestrator(objective, roles) as any,
    });

    const initial = service.launchSwarm({
      objective: 'Validate release rollout',
      roles: [
        {
          id: 'research',
          label: 'Research',
          systemPrompt: 'Inspect rollout state.',
        },
      ],
      subagentBudget: {
        maxOutputBytes: 4,
      },
    });

    await waitFor(() => service.getSwarm(initial.swarmId)?.status === 'completed');

    const current = service.getSwarm(initial.swarmId);

    expect(current?.subagentReceipts).toEqual(expect.arrayContaining([
      expect.objectContaining({
        roleId: 'research',
        status: 'budget_exceeded',
        budgetDecision: expect.objectContaining({
          ok: false,
          exceeded: 'output_bytes',
        }),
      }),
    ]));
  });
});
