import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SwarmV2Service as ExperimentalSwarmV2Service } from '@zavorth/agents/SwarmV2Service.js';

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

  it('runs the official swarm surface with role library, batch queue, replay, isolation and metrics', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-swarm-official-'));
    try {
      const service = new ExperimentalSwarmV2Service({
        roleLibraryPath: path.join(tempDir, 'roles.json'),
        orchestratorFactory: (objective, roles) => new FakeSwarmOrchestrator(objective, roles) as any,
      });

      const initial = service.launchOfficialSwarm({
        objective: 'Auditar release grande',
        roles: [],
        roleLibraryIds: ['planner', 'verifier'],
        maxConcurrency: 1,
        batchSize: 1,
        isolationMode: 'temp-worktree',
      });

      const completed = await service.waitForSwarm(initial.swarmId);
      const replay = service.getSwarmReplay(initial.swarmId);

      expect(initial.official).toBe(true);
      expect(initial.experimental).toBe(false);
      expect(initial.queue?.mode).toBe('batch-queue');
      expect(initial.roleLibrary?.persistent).toBe(true);
      expect(completed.status).toBe('completed');
      expect(completed.batches).toHaveLength(2);
      expect(completed.metrics).toEqual(expect.objectContaining({
        totalRoles: 2,
        completedRoles: 2,
        maxConcurrency: 1,
        batchCount: 2,
      }));
      expect(completed.isolation).toEqual(expect.objectContaining({
        mode: 'temp-worktree',
        workersIsolated: true,
      }));
      expect(completed.isolation?.workerRoots.every((worker) => fs.existsSync(worker.cwd))).toBe(true);
      expect(completed.synthesis).toEqual(expect.objectContaining({
        status: 'completed',
        mode: 'deterministic',
      }));
      expect(completed.replayInsights).toEqual(expect.objectContaining({
        status: 'ready',
        synthesisConfidence: expect.any(Number),
        nextReplayAction: expect.any(String),
        compare: expect.objectContaining({
          completedRoles: 2,
          failedRoles: 0,
        }),
        timeline: expect.arrayContaining([
          expect.objectContaining({ id: 'queued' }),
          expect.objectContaining({ id: 'synthesis' }),
        ]),
        byRole: expect.arrayContaining([
          expect.objectContaining({
            roleId: 'planner',
            confidence: expect.any(Number),
          }),
        ]),
      }));
      expect(completed.synthesizedOutput).toContain('Swarm v2 Official Synthesis');
      expect(replay?.events).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'swarm.queued' }),
        expect.objectContaining({ type: 'batch.started' }),
        expect.objectContaining({ type: 'swarm.synthesized' }),
      ]));
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('persists custom role library entries for future swarms', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-swarm-roles-'));
    try {
      const service = new ExperimentalSwarmV2Service({
        roleLibraryPath: path.join(tempDir, 'roles.json'),
        orchestratorFactory: (objective, roles) => new FakeSwarmOrchestrator(objective, roles) as any,
      });
      const role = service.upsertRoleLibraryEntry({
        id: 'docs-auditor',
        label: 'Docs Auditor',
        kind: 'researcher',
        systemPrompt: 'Leia documentacao em modo seguro e aponte lacunas.',
        scope: 'read_only',
        risk: 'safe',
      });

      expect(role.id).toBe('docs-auditor');
      expect(service.listRoleLibrary()).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 'docs-auditor', label: 'Docs Auditor' }),
      ]));

      const launched = service.launchOfficialSwarm({
        objective: 'Auditar docs',
        roles: [],
        roleLibraryIds: ['docs-auditor'],
        maxConcurrency: 1,
        batchSize: 1,
      });
      const completed = await service.waitForSwarm(launched.swarmId);
      expect(completed.roles[0]?.roleId).toBe('docs-auditor');
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('uses LLM synthesis when a runtime is attached and keeps deterministic fallback available', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-swarm-llm-'));
    try {
      const llmRuntime = {
        chat: jest.fn(async () => ({ content: 'LLM final synthesis with blockers and next steps.' })),
      };
      const service = new ExperimentalSwarmV2Service({
        roleLibraryPath: path.join(tempDir, 'roles.json'),
        orchestratorFactory: (objective, roles) => new FakeSwarmOrchestrator(objective, roles) as any,
        llmRuntime: llmRuntime as any,
      });

      const launched = service.launchOfficialSwarm({
        objective: 'Sintetizar com provider',
        roles: [],
        roleLibraryIds: ['planner'],
        maxConcurrency: 1,
        batchSize: 1,
      });
      const completed = await service.waitForSwarm(launched.swarmId);

      expect(completed.synthesis?.mode).toBe('llm');
      expect(completed.synthesizedOutput).toBe('LLM final synthesis with blockers and next steps.');
      expect(llmRuntime.chat).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ content: expect.stringContaining('Zavorth Swarm v2 final synthesizer') }),
        ]),
        [],
        expect.objectContaining({
          allowFallback: true,
          telemetry: expect.objectContaining({ surface: 'swarm-v2-official' }),
        }),
      );
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('cancels an official swarm even when a batch orchestrator is active', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-swarm-cancel-'));
    try {
      const service = new ExperimentalSwarmV2Service({
        roleLibraryPath: path.join(tempDir, 'roles.json'),
        orchestratorFactory: (objective, roles) => new FakeSwarmOrchestrator(objective, roles) as any,
      });

      const launched = service.launchOfficialSwarm({
        objective: 'Cancelar execucao em andamento',
        roles: [],
        roleLibraryIds: ['planner'],
        maxConcurrency: 1,
        batchSize: 1,
      });
      const cancelled = service.cancelSwarm(launched.swarmId);
      const replay = service.getSwarmReplay(launched.swarmId);

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.official).toBe(true);
      expect(cancelled.queue?.status).toBe('cancelled');
      expect(cancelled.synthesis?.status).toBe('failed');
      expect(cancelled.synthesizedOutput).toContain('cancelado');
      expect(replay?.events).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'swarm.cancelled' }),
      ]));
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('auto-selects roles through the LLM selector and records benchmark/tool snapshots', async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'zavorth-swarm-autoselect-'));
    try {
      const llmRuntime = {
        chat: jest.fn(async (messages: any[]) => {
          const content = String(messages?.[0]?.content || '');
          if (content.includes('role selector')) {
            return {
              content: JSON.stringify({
                selectedRoleIds: ['planner', 'safety-reviewer', 'verifier'],
                rationale: 'Security-heavy review needs planning, safety and verification.',
              }),
            };
          }
          return { content: 'LLM final synthesis.' };
        }),
      };
      const service = new ExperimentalSwarmV2Service({
        roleLibraryPath: path.join(tempDir, 'roles.json'),
        orchestratorFactory: (objective, roles) => new FakeSwarmOrchestrator(objective, roles) as any,
        llmRuntime: llmRuntime as any,
      });

      const launched = await service.launchOfficialSwarmAsync({
        objective: 'Auditar seguranca do runtime',
        roles: [],
        autoSelectRoles: true,
        desiredRoleCount: 3,
        maxConcurrency: 2,
        batchSize: 2,
        benchmark: true,
        toolSpecs: [
          {
            id: 'echo-check',
            kind: 'shell',
            label: 'Echo check',
            command: process.platform === 'win32' ? 'cmd.exe' : 'sh',
            args: process.platform === 'win32' ? ['/c', 'echo ok'] : ['-lc', 'echo ok'],
            requiresApproval: false,
          },
        ],
      });
      const completed = await service.waitForSwarm(launched.swarmId);

      expect(completed.roleSelection).toEqual(expect.objectContaining({
        mode: 'llm',
        selectedRoleIds: ['planner', 'safety-reviewer', 'verifier'],
      }));
      expect(completed.toolExecution).toEqual(expect.objectContaining({
        plannedToolCount: 3,
        commandToolCount: 3,
      }));
      expect(completed.benchmark).toEqual(expect.objectContaining({
        enabled: true,
        baseline: 'estimated-serial',
      }));
      expect(completed.tokenBudget).toEqual(expect.objectContaining({
        status: 'passed',
        estimatedLlmCalls: expect.any(Number),
        risk: expect.any(String),
      }));
      expect(completed.replay?.events).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'role.selection' }),
      ]));
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('fails closed when strong isolation is required but a soft mode is requested', async () => {
    const service = new ExperimentalSwarmV2Service({
      orchestratorFactory: (objective, roles) => new FakeSwarmOrchestrator(objective, roles) as any,
    });

    expect(() => service.launchOfficialSwarm({
      objective: 'Mutacao sensivel',
      roles: [{ id: 'operator', label: 'Operator', systemPrompt: 'Do it.' }],
      requireStrongIsolation: true,
      isolationMode: 'temp-worktree',
    })).toThrow(/isolamento forte/i);
  });

  it('wraps command roles with a Docker runner when strong Docker isolation is selected', async () => {
    let capturedRoles: any[] = [];
    const service = new ExperimentalSwarmV2Service({
      orchestratorFactory: (objective, roles) => {
        capturedRoles = roles;
        return new FakeSwarmOrchestrator(objective, roles) as any;
      },
    });

    const launched = service.launchOfficialSwarm({
      objective: 'Executar mutacao isolada',
      roles: [{
        id: 'docker-worker',
        label: 'Docker Worker',
        systemPrompt: 'Run isolated command.',
        command: process.platform === 'win32' ? 'cmd.exe' : 'sh',
        args: process.platform === 'win32' ? ['/c', 'echo ok'] : ['-lc', 'echo ok'],
        stdinMode: 'none',
      }],
      requireStrongIsolation: true,
      isolationMode: 'docker',
      isolationImage: 'node:22',
      maxConcurrency: 1,
      batchSize: 1,
    });

    await service.waitForSwarm(launched.swarmId);

    expect(capturedRoles[0]).toEqual(expect.objectContaining({
      command: 'docker',
      stdinMode: 'none',
      isolation: expect.objectContaining({ mode: 'docker' }),
    }));
    expect(capturedRoles[0].args).toEqual(expect.arrayContaining([
      'run',
      '--network',
      'none',
      'node:22',
    ]));
    expect(service.getSwarm(launched.swarmId)?.strongIsolation).toEqual(expect.objectContaining({
      required: true,
      satisfied: true,
      wrapper: 'docker',
    }));
  });

  it('requires explicit approval when the estimated LLM token budget is exceeded', async () => {
    const llmRuntime = {
      chat: jest.fn(async () => ({ content: 'LLM synthesis.' })),
    };
    const service = new ExperimentalSwarmV2Service({
      orchestratorFactory: (objective, roles) => new FakeSwarmOrchestrator(objective, roles) as any,
      llmRuntime: llmRuntime as any,
    });
    const roles = Array.from({ length: 12 }, (_, index) => ({
      id: `llm-role-${index + 1}`,
      label: `LLM Role ${index + 1}`,
      systemPrompt: 'Think carefully about this expensive role. '.repeat(50),
    }));

    expect(() => service.launchOfficialSwarm({
      objective: 'Run an expensive LLM-heavy swarm',
      roles,
      maxConcurrency: 3,
      batchSize: 3,
      tokenBudget: {
        maxLlmCalls: 2,
        maxEstimatedTokens: 1000,
        maxEstimatedUsd: 0.01,
      },
    })).toThrow(/Swarm Token Budget Guard/i);

    const launched = service.launchOfficialSwarm({
      objective: 'Run an approved LLM-heavy swarm',
      roles,
      maxConcurrency: 3,
      batchSize: 3,
      tokenBudget: {
        maxLlmCalls: 2,
        maxEstimatedTokens: 1000,
        maxEstimatedUsd: 0.01,
        approved: true,
      },
    });
    expect(launched.tokenBudget).toEqual(expect.objectContaining({
      status: 'passed',
      approved: true,
    }));
  });
});
