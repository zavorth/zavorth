import { randomUUID } from 'crypto';
import {
  SwarmOrchestrator,
  type SwarmRole,
  type SwarmSnapshot,
  type SwarmTaskResult,
} from '../runtime/sessions/v2/SwarmOrchestrator.js';
import {
  createSubagentApprovalBoundary,
  createSubagentBudget,
  createSubagentCapabilityScope,
  createSubagentResultReceipt,
  evaluateSubagentBudget,
  type SubagentBudgetInput,
  type SubagentResultReceipt,
  type SubagentResultStatus,
} from '../runtime/agent/subagents/index.js';
import { CanonicalExecutionPipelineService } from './CanonicalExecutionPipelineService.js';

export type SwarmV2CreateInput = {
  swarmId?: string | null;
  objective: string;
  roles: SwarmRole[];
  subagentReceipts?: SubagentResultReceipt[] | null;
  subagentBudget?: SubagentBudgetInput | null;
};

export type SwarmV2TrackedSnapshot = SwarmSnapshot & { swarmId: string; createdAt: string };

type ManagedSwarm = {
  swarmId: string;
  orchestrator: SwarmOrchestrator;
  roles: SwarmRole[];
  subagentReceipts: SubagentResultReceipt[];
  subagentBudget: SubagentBudgetInput | null;
  lastSnapshot: SwarmSnapshot;
  createdAt: string;
  execution: Promise<SwarmSnapshot>;
};

export class SwarmV2Service {
  private readonly swarms = new Map<string, ManagedSwarm>();

  constructor(
    private readonly options: {
      orchestratorFactory?: (objective: string, roles: SwarmRole[]) => SwarmOrchestrator;
      canonicalExecutionPipeline?: CanonicalExecutionPipelineService;
    } = {},
  ) {}

  public launchSwarm(input: SwarmV2CreateInput): SwarmSnapshot {
    const objective = String(input.objective || '').trim();
    if (!objective) {
      throw new Error('objective obrigatorio.');
    }
    if (!Array.isArray(input.roles) || input.roles.length === 0) {
      throw new Error('roles obrigatorios.');
    }

    const swarmId = String(input.swarmId || '').trim() || randomUUID();
    const orchestrator = this.options.orchestratorFactory?.(objective, input.roles)
      || new SwarmOrchestrator(objective, input.roles);
    const subagentReceipts = this.resolveSubagentReceipts(input.roles, {
      objective,
      receiptSeeds: input.subagentReceipts,
      budgetInput: input.subagentBudget,
    });
    const initialSnapshot = this.withLifecycle({
      ...orchestrator.getSnapshot(),
      swarmId,
      status: 'running',
    }, {
      summary: `Swarm launched: ${objective}.`,
    }, subagentReceipts);
    const entry: ManagedSwarm = {
      swarmId,
      orchestrator,
      roles: input.roles,
      subagentReceipts,
      subagentBudget: input.subagentBudget || null,
      lastSnapshot: initialSnapshot,
      createdAt: new Date().toISOString(),
      execution: Promise.resolve(initialSnapshot),
    };

    orchestrator.on('role:data', () => {
      const snapshot = orchestrator.getSnapshot();
      entry.subagentReceipts = this.resolveSubagentReceipts(entry.roles, {
        objective,
        snapshot,
        receiptSeeds: entry.subagentReceipts,
        budgetInput: entry.subagentBudget,
      });
      entry.lastSnapshot = this.withLifecycle({
        ...snapshot,
        swarmId,
      }, {
        summary: `Swarm ${swarmId} emitted role output.`,
      }, entry.subagentReceipts);
    });
    orchestrator.on('role:finished', () => {
      const snapshot = orchestrator.getSnapshot();
      entry.subagentReceipts = this.resolveSubagentReceipts(entry.roles, {
        objective,
        snapshot,
        receiptSeeds: entry.subagentReceipts,
        budgetInput: entry.subagentBudget,
      });
      entry.lastSnapshot = this.withLifecycle({
        ...snapshot,
        swarmId,
      }, {
        summary: `Swarm ${swarmId} role finished.`,
      }, entry.subagentReceipts);
    });
    orchestrator.on('swarm:finished', (snapshot: SwarmSnapshot) => {
      entry.subagentReceipts = this.resolveSubagentReceipts(entry.roles, {
        objective,
        snapshot,
        receiptSeeds: entry.subagentReceipts,
        budgetInput: entry.subagentBudget,
      });
      entry.lastSnapshot = this.withLifecycle({
        ...snapshot,
        swarmId,
      }, {
        summary: `Swarm ${swarmId} finished with status ${snapshot.status}.`,
      }, entry.subagentReceipts);
    });

    entry.execution = orchestrator.execute()
      .then((snapshot) => {
        entry.subagentReceipts = this.resolveSubagentReceipts(entry.roles, {
          objective,
          snapshot,
          receiptSeeds: entry.subagentReceipts,
          budgetInput: entry.subagentBudget,
        });
        entry.lastSnapshot = this.withLifecycle({
          ...snapshot,
          swarmId,
        }, {
          summary: `Swarm ${swarmId} completed with status ${snapshot.status}.`,
        }, entry.subagentReceipts);
        return entry.lastSnapshot;
      })
      .catch((error: any) => {
        const snapshot = orchestrator.getSnapshot();
        entry.subagentReceipts = this.resolveSubagentReceipts(entry.roles, {
          objective,
          snapshot,
          receiptSeeds: entry.subagentReceipts,
          budgetInput: entry.subagentBudget,
        });
        entry.lastSnapshot = this.withLifecycle({
          ...snapshot,
          swarmId,
          status: 'failed',
          finishedAt: new Date().toISOString(),
          synthesizedOutput: error?.message || snapshot.synthesizedOutput,
        }, {
          summary: error?.message || `Swarm ${swarmId} failed.`,
        }, entry.subagentReceipts);
        return entry.lastSnapshot;
      });

    this.swarms.set(swarmId, entry);
    return initialSnapshot;
  }

  public listSwarms(): SwarmV2TrackedSnapshot[] {
    return Array.from(this.swarms.values())
      .map((entry) => ({
        ...entry.lastSnapshot,
        swarmId: entry.swarmId,
        createdAt: entry.createdAt,
      }))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  public getSwarm(swarmId: string): SwarmV2TrackedSnapshot | null {
    const entry = this.swarms.get(String(swarmId || '').trim());
    if (!entry) {
      return null;
    }
    return {
      ...entry.lastSnapshot,
      swarmId: entry.swarmId,
      createdAt: entry.createdAt,
    };
  }

  public async waitForSwarm(swarmId: string): Promise<SwarmV2TrackedSnapshot> {
    const entry = this.swarms.get(String(swarmId || '').trim());
    if (!entry) {
      throw new Error('Swarm v2 nao encontrado.');
    }
    const snapshot = await entry.execution;
    entry.lastSnapshot = snapshot;
    return {
      ...entry.lastSnapshot,
      swarmId: entry.swarmId,
      createdAt: entry.createdAt,
    };
  }

  public cancelSwarm(swarmId: string): SwarmV2TrackedSnapshot {
    const entry = this.swarms.get(String(swarmId || '').trim());
    if (!entry) {
      throw new Error('Swarm v2 nao encontrado.');
    }
    entry.orchestrator.killAll();
    const snapshot = entry.orchestrator.getSnapshot();
    entry.subagentReceipts = this.resolveSubagentReceipts(entry.roles, {
      objective: snapshot.objective,
      snapshot,
      receiptSeeds: entry.subagentReceipts,
      budgetInput: entry.subagentBudget,
    });
    entry.lastSnapshot = this.withLifecycle({
      ...snapshot,
      swarmId: entry.swarmId,
      status: 'failed',
    }, {
      summary: `Swarm ${entry.swarmId} cancelled by operator.`,
    }, entry.subagentReceipts);
    return {
      ...entry.lastSnapshot,
      swarmId: entry.swarmId,
      createdAt: entry.createdAt,
    };
  }

  public shutdown(): void {
    for (const entry of this.swarms.values()) {
      entry.orchestrator.killAll();
    }
    this.swarms.clear();
  }

  private withLifecycle(
    snapshot: SwarmSnapshot,
    input: { summary: string },
    subagentReceipts: SubagentResultReceipt[] = snapshot.subagentReceipts || [],
  ): SwarmSnapshot {
    const canonicalExecution = this.options.canonicalExecutionPipeline || new CanonicalExecutionPipelineService();
    const link = canonicalExecution.buildLink({
      engine: 'swarm',
      kind: 'run',
      id: snapshot.swarmId,
      status: canonicalExecution.mapSwarmStatus(snapshot.status),
      summary: input.summary,
      objective: snapshot.objective,
      requestedBy: 'operator',
      surface: 'swarm-v2',
      traceId: snapshot.traceId || snapshot.swarmId,
      runId: snapshot.runId || snapshot.swarmId,
      at: snapshot.finishedAt || snapshot.startedAt,
      metadata: {
        roleCount: snapshot.roles.length,
        roleStatuses: snapshot.roles.map((role) => ({
          roleId: role.roleId,
          status: role.status,
        })),
        subagentReceiptCount: subagentReceipts.length,
        subagentReceiptStatuses: subagentReceipts.map((receipt) => ({
          roleId: receipt.roleId,
          status: receipt.status,
          budgetExceeded: receipt.budgetDecision.exceeded,
          approvalRequired: receipt.approvalBoundary.requiresApproval,
        })),
      },
    });
    return {
      ...snapshot,
      subagentReceipts,
      traceId: link.traceId,
      runId: link.runId,
      sessionId: link.sessionId,
      execution_lifecycle: canonicalExecution.mergeLifecycle(snapshot.execution_lifecycle, link.lifecycle),
    };
  }

  private resolveSubagentReceipts(
    roles: SwarmRole[],
    input: {
      objective: string;
      snapshot?: SwarmSnapshot | null;
      receiptSeeds?: SubagentResultReceipt[] | null;
      budgetInput?: SubagentBudgetInput | null;
    },
  ): SubagentResultReceipt[] {
    const resultsByRole = new Map((input.snapshot?.roles || []).map((result) => [result.roleId, result]));
    const seedsByRole = new Map((input.receiptSeeds || []).map((receipt) => [receipt.roleId, receipt]));

    return roles.map((role) => {
      const result = resultsByRole.get(role.id);
      const seed = seedsByRole.get(role.id);
      const outputBytes = result ? Buffer.byteLength(result.output.join(''), 'utf8') : 0;
      const elapsedMs = this.calculateRoleElapsedMs(result);
      const budget = createSubagentBudget({
        maxToolCalls: input.budgetInput?.maxToolCalls ?? seed?.budget.maxToolCalls ?? 0,
        maxWallClockMs: input.budgetInput?.maxWallClockMs ?? seed?.budget.maxWallClockMs ?? 120000,
        maxOutputBytes: input.budgetInput?.maxOutputBytes ?? seed?.budget.maxOutputBytes ?? 65536,
        usedToolCalls: seed?.budget.usedToolCalls ?? 0,
        elapsedMs,
        outputBytes,
        policyTags: [
          ...(seed?.budget.policyTags ?? []),
          ...(input.budgetInput?.policyTags ?? []),
          'swarm-v2-subagent-budget',
        ],
        metadata: {
          ...(seed?.budget.metadata ?? {}),
          ...(input.budgetInput?.metadata ?? {}),
          objective: input.objective,
          swarmId: input.snapshot?.swarmId || null,
          roleId: role.id,
          outputBytes,
        },
      });
      const scope = seed?.scope || createSubagentCapabilityScope({
        roleId: role.id,
        mode: 'tool_limited',
        allowedTools: this.resolveRoleTools(role),
        allowedPaths: [],
        requiresApproval: true,
        metadata: {
          objective: input.objective,
          swarmRoleLabel: role.label,
          command: role.command || null,
        },
      });
      const approvalBoundary = seed?.approvalBoundary || createSubagentApprovalBoundary({
        scope,
        budget,
        risk: role.command ? 'attention' : 'unknown',
        approvalReason: 'SwarmV2 records the approval boundary before subagent execution.',
        metadata: {
          objective: input.objective,
          swarmRoleLabel: role.label,
          swarmId: input.snapshot?.swarmId || null,
        },
      });
      const budgetDecision = evaluateSubagentBudget(budget);
      const status = budgetDecision.ok
        ? this.mapSubagentStatus(result, input.snapshot)
        : 'budget_exceeded';

      return createSubagentResultReceipt({
        roleId: role.id,
        status,
        summary: result
          ? `Swarm subagent ${role.label} finished with status ${result.status}.`
          : `Swarm subagent ${role.label} registered before execution.`,
        scope,
        budget,
        approvalBoundary,
        budgetDecision,
        artifacts: outputBytes > 0 ? [`swarm-output:${role.id}`] : [],
        risks: approvalBoundary.requiresApproval ? ['approval-boundary-required'] : [],
        policyTags: ['swarm-v2-subagent-receipt'],
        metadata: {
          objective: input.objective,
          swarmId: input.snapshot?.swarmId || null,
          roleLabel: role.label,
          roleStatus: result?.status || null,
          outputBytes,
        },
      });
    });
  }

  private resolveRoleTools(role: SwarmRole): string[] {
    const command = String(role.command || '').trim();
    return command ? [command] : ['swarm-session'];
  }

  private mapSubagentStatus(
    result: SwarmTaskResult | undefined,
    snapshot: SwarmSnapshot | null | undefined,
  ): SubagentResultStatus {
    if (!result) {
      return snapshot?.status === 'failed' || snapshot?.status === 'cancelled' ? 'failed' : 'planned';
    }
    if (result.status === 'IDLE') {
      return 'completed';
    }
    if (result.status === 'TIMEOUT') {
      return 'budget_exceeded';
    }
    if (result.status === 'CANCELLED') {
      return 'blocked';
    }
    return 'failed';
  }

  private calculateRoleElapsedMs(result: SwarmTaskResult | undefined): number {
    if (!result?.startedAt || !result.finishedAt) {
      return 0;
    }
    const elapsed = new Date(result.finishedAt).getTime() - new Date(result.startedAt).getTime();
    return Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
  }
}

export {
  SwarmV2Service as ExperimentalSwarmV2Service,
};

export type ExperimentalSwarmV2CreateInput = SwarmV2CreateInput;
