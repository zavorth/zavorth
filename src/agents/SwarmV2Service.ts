import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  SwarmOrchestrator,
  type SwarmRole,
  type SwarmSnapshot,
  type SwarmTaskResult,
} from '../runtime/sessions/v2/SwarmOrchestrator.js';
import type { LlmRunOptions, LlmRuntimeService } from '../services/llm/LlmRuntimeService.js';
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
import { CanonicalExecutionPipelineService } from '../services/CanonicalExecutionPipelineService.js';
import { logger } from '../logger.js';

export const SWARM_V2_OFFICIAL_CONTRACT_VERSION = '2026-05-17.official-swarm-v2' as const;

export type SwarmV2IsolationMode = 'direct' | 'temp-worktree' | 'docker' | 'wsl' | 'external-sandbox';

export type SwarmV2ToolSpec = {
  id: string;
  kind: 'shell';
  label: string;
  command: string;
  args?: string[];
  cwd?: string | null;
  risk?: 'safe' | 'attention' | 'danger';
  requiresApproval?: boolean;
};

export type SwarmV2RoleSelectionSnapshot = {
  mode: 'manual' | 'heuristic' | 'llm';
  requestedRoleCount: number;
  selectedRoleIds: string[];
  availableRoleCount: number;
  rationale: string;
};

export type SwarmV2BenchmarkSnapshot = {
  enabled: boolean;
  baseline: 'estimated-serial' | 'not-requested';
  elapsedMs: number;
  estimatedSerialMs: number;
  speedup: number;
  throughputRolesPerSecond: number;
  failureRate: number;
  qualityScore: number;
};

export type SwarmV2TokenBudgetInput = {
  maxLlmCalls?: number | null;
  maxEstimatedTokens?: number | null;
  maxEstimatedUsd?: number | null;
  modelClass?: 'cheap' | 'standard' | 'premium' | null;
  approved?: boolean | null;
  allowHighCost?: boolean | null;
};

export type SwarmV2TokenBudgetSnapshot = {
  enabled: true;
  status: 'passed' | 'approval_required' | 'blocked';
  risk: 'low' | 'medium' | 'high' | 'critical';
  estimatedLlmCalls: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTotalTokens: number;
  estimatedUsd: number;
  limits: {
    maxLlmCalls: number;
    maxEstimatedTokens: number;
    maxEstimatedUsd: number;
  };
  approved: boolean;
  modelClass: 'cheap' | 'standard' | 'premium';
  rationale: string;
};

export type SwarmV2RoleLibraryEntry = {
  id: string;
  label: string;
  kind: 'planner' | 'researcher' | 'implementer' | 'verifier' | 'critic' | 'synthesizer' | 'operator' | 'custom';
  systemPrompt: string;
  defaultTools: string[];
  risk: 'safe' | 'attention' | 'danger' | 'unknown';
  scope: 'read_only' | 'tool_limited' | 'workspace_patch';
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type SwarmV2ReplayEvent = {
  id: string;
  at: string;
  type:
    | 'swarm.queued'
    | 'batch.queued'
    | 'batch.started'
    | 'batch.finished'
    | 'role.started'
    | 'role.output'
    | 'role.finished'
    | 'role.tool.bound'
    | 'role.selection'
    | 'benchmark.completed'
    | 'swarm.synthesized'
    | 'swarm.cancelled'
    | 'swarm.failed';
  swarmId: string;
  batchId?: string | null;
  roleId?: string | null;
  summary: string;
  payload?: Record<string, unknown>;
};

export type SwarmV2ReplayInsights = {
  status: 'empty' | 'recording' | 'ready';
  operatorSummary: string;
  timeline: Array<{
    id: string;
    label: string;
    eventCount: number;
    status: 'pending' | 'active' | 'done' | 'failed';
  }>;
  byRole: Array<{
    roleId: string;
    label: string;
    eventCount: number;
    outputBytes: number;
    status: string;
    confidence: number;
  }>;
  bottlenecks: Array<{
    id: string;
    severity: 'info' | 'warning' | 'critical';
    summary: string;
  }>;
  compare: {
    completedRoles: number;
    failedRoles: number;
    outputSpreadBytes: number;
    strongestRoleId: string | null;
    weakestRoleId: string | null;
  };
  synthesisConfidence: number;
  nextReplayAction: string;
};

export type SwarmV2BatchSnapshot = {
  batchId: string;
  index: number;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  roleIds: string[];
  maxConcurrency: number;
  startedAt: string | null;
  finishedAt: string | null;
};

export type SwarmV2ParallelMetrics = {
  totalRoles: number;
  queuedRoles: number;
  runningRoles: number;
  completedRoles: number;
  failedRoles: number;
  timedOutRoles: number;
  cancelledRoles: number;
  maxConcurrency: number;
  batchCount: number;
  completedBatchCount: number;
  elapsedMs: number;
  outputBytes: number;
  synthesisChars: number;
  parallelismScore: number;
};

export type SwarmV2OfficialSurface = {
  official: true;
  experimental: false;
  contractVersion: typeof SWARM_V2_OFFICIAL_CONTRACT_VERSION;
  queue: {
    mode: 'batch-queue';
    status: 'queued' | 'running' | 'draining' | 'completed' | 'cancelled' | 'failed';
    maxRoles: number;
    maxConcurrency: number;
    pendingBatchIds: string[];
  };
  batches: SwarmV2BatchSnapshot[];
  replay: {
    eventCount: number;
    events: SwarmV2ReplayEvent[];
  };
  replayInsights: SwarmV2ReplayInsights;
  metrics: SwarmV2ParallelMetrics;
  roleLibrary: {
    persistent: true;
    selectedRoleIds: string[];
    availableRoleCount: number;
  };
  isolation: {
    mode: SwarmV2IsolationMode;
    workersIsolated: boolean;
    workerRoots: Array<{ roleId: string; cwd: string; mode: SwarmV2IsolationMode }>;
    note: string;
  };
  synthesis: {
    mode: 'deterministic' | 'llm';
    status: 'pending' | 'completed' | 'failed';
    summary: string;
  };
  roleSelection: SwarmV2RoleSelectionSnapshot;
  toolExecution: {
    plannedToolCount: number;
    executedToolCount: number;
    commandToolCount: number;
    approvalRequiredToolCount: number;
    toolIds: string[];
  };
  benchmark: SwarmV2BenchmarkSnapshot;
  tokenBudget: SwarmV2TokenBudgetSnapshot;
  strongIsolation: {
    required: boolean;
    satisfied: boolean;
    mode: SwarmV2IsolationMode;
    wrapper: 'none' | 'docker' | 'wsl' | 'external-sandbox';
    note: string;
  };
};

export type SwarmV2CreateInput = {
  swarmId?: string | null;
  objective: string;
  roles: SwarmRole[];
  subagentReceipts?: SubagentResultReceipt[] | null;
  subagentBudget?: SubagentBudgetInput | null;
  official?: boolean | null;
  roleLibraryIds?: string[] | null;
  maxRoles?: number | null;
  maxConcurrency?: number | null;
  batchSize?: number | null;
  isolationMode?: SwarmV2IsolationMode | null;
  isolationImage?: string | null;
  wslDistro?: string | null;
  requireStrongIsolation?: boolean | null;
  autoSelectRoles?: boolean | null;
  desiredRoleCount?: number | null;
  benchmark?: boolean | null;
  toolSpecs?: SwarmV2ToolSpec[] | null;
  tokenBudget?: SwarmV2TokenBudgetInput | null;
  roleSelectionOverride?: SwarmV2RoleSelectionSnapshot | null;
};

export type SwarmV2TrackedSnapshot = SwarmSnapshot & { swarmId: string; createdAt: string } & Partial<SwarmV2OfficialSurface>;

type ManagedSwarm = {
  swarmId: string;
  orchestrator: SwarmOrchestrator | null;
  roles: SwarmRole[];
  subagentReceipts: SubagentResultReceipt[];
  subagentBudget: SubagentBudgetInput | null;
  lastSnapshot: SwarmSnapshot;
  createdAt: string;
  execution: Promise<SwarmSnapshot>;
  officialState?: SwarmV2OfficialState;
};

type SwarmV2OfficialState = {
  swarmId: string;
  objective: string;
  createdAt: string;
  roles: SwarmRole[];
  selectedRoleIds: string[];
  queueStatus: SwarmV2OfficialSurface['queue']['status'];
  maxRoles: number;
  maxConcurrency: number;
  batches: SwarmV2BatchSnapshot[];
  replay: SwarmV2ReplayEvent[];
  isolationMode: SwarmV2IsolationMode;
  workerRoots: Array<{ roleId: string; cwd: string; mode: SwarmV2IsolationMode }>;
  synthesisStatus: SwarmV2OfficialSurface['synthesis']['status'];
  synthesisMode: SwarmV2OfficialSurface['synthesis']['mode'];
  synthesisSummary: string;
  startedAt: string;
  roleSelection: SwarmV2RoleSelectionSnapshot;
  toolSpecs: SwarmV2ToolSpec[];
  benchmarkEnabled: boolean;
  tokenBudget: SwarmV2TokenBudgetSnapshot;
  strongIsolationRequired: boolean;
  strongIsolationSatisfied: boolean;
  strongIsolationWrapper: SwarmV2OfficialSurface['strongIsolation']['wrapper'];
};

interface SwarmOrchestratorRoleStartedEvent {
  swarmId: string;
  roleId: string;
  label: string;
}

interface SwarmOrchestratorRoleDataEvent {
  swarmId: string;
  roleId: string;
  data: string;
}

interface SwarmOrchestratorRoleFinishedEvent {
  swarmId: string;
  roleId: string;
  status: string;
  exitCode: number | null;
}

interface RawToolSpecInput {
  id?: unknown;
  command?: unknown;
  label?: unknown;
  args?: unknown;
  cwd?: unknown;
  risk?: unknown;
  requiresApproval?: unknown;
  [key: string]: unknown;
}

interface RawRoleLibraryEntry {
  id?: unknown;
  label?: unknown;
  kind?: unknown;
  systemPrompt?: unknown;
  defaultTools?: unknown;
  risk?: unknown;
  scope?: unknown;
  tags?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  [key: string]: unknown;
}

export class SwarmV2Service {
  private readonly swarms = new Map<string, ManagedSwarm>();

  constructor(
    private readonly options: {
      orchestratorFactory?: (objective: string, roles: SwarmRole[]) => SwarmOrchestrator;
      canonicalExecutionPipeline?: CanonicalExecutionPipelineService;
      roleLibraryPath?: string;
      llmRuntime?: Pick<LlmRuntimeService, 'chat'> | null;
    } = {},
  ) {}

  public launchSwarm(input: SwarmV2CreateInput): SwarmSnapshot {
    if (
      input.official
      || input.maxConcurrency
      || input.batchSize
      || input.autoSelectRoles
      || input.benchmark
      || input.requireStrongIsolation
      || (input.toolSpecs?.length || 0) > 0
      || (input.roleLibraryIds?.length || 0) > 0
    ) {
      return this.launchOfficialSwarm(input);
    }

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
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error ?? '');
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
          synthesizedOutput: message || snapshot.synthesizedOutput,
        }, {
          summary: message || `Swarm ${swarmId} failed.`,
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
      throw new Error('Swarm v2 not found.');
    }
    const snapshot = await entry.execution;
    entry.lastSnapshot = snapshot;
    return {
      ...entry.lastSnapshot,
      swarmId: entry.swarmId,
      createdAt: entry.createdAt,
    };
  }

  public listRoleLibrary(): SwarmV2RoleLibraryEntry[] {
    return this.readRoleLibrary();
  }

  public upsertRoleLibraryEntry(
    entry: Partial<SwarmV2RoleLibraryEntry> & { id: string; label: string; systemPrompt: string },
  ): SwarmV2RoleLibraryEntry {
    const now = new Date().toISOString();
    const current = this.readRoleLibrary();
    const index = current.findIndex((item) => item.id === entry.id);
    const next: SwarmV2RoleLibraryEntry = {
      id: this.normalizeKey(entry.id, 'custom-role'),
      label: String(entry.label || '').trim() || entry.id,
      kind: entry.kind || 'custom',
      systemPrompt: String(entry.systemPrompt || '').trim(),
      defaultTools: Array.isArray(entry.defaultTools) ? entry.defaultTools.map(String) : [],
      risk: entry.risk || 'unknown',
      scope: entry.scope || 'tool_limited',
      tags: Array.isArray(entry.tags) ? entry.tags.map(String) : [],
      createdAt: index >= 0 ? current[index].createdAt : now,
      updatedAt: now,
    };
    if (!next.systemPrompt) {
      throw new Error('systemPrompt obrigatorio para role library.');
    }
    if (index >= 0) {
      current[index] = next;
    } else {
      current.push(next);
    }
    this.writeRoleLibrary(current);
    return next;
  }

  public getSwarmReplay(swarmId: string): { ok: true; events: SwarmV2ReplayEvent[] } | null {
    const entry = this.swarms.get(String(swarmId || '').trim());
    if (!entry?.officialState) {
      return null;
    }
    return { ok: true, events: entry.officialState.replay.slice() };
  }

  public async launchOfficialSwarmAsync(input: SwarmV2CreateInput): Promise<SwarmV2TrackedSnapshot> {
    if (!input.autoSelectRoles || (input.roles?.length || 0) > 0 || (input.roleLibraryIds?.length || 0) > 0) {
      return this.launchOfficialSwarm(input);
    }
    const library = this.readRoleLibrary();
    const desiredRoleCount = this.clampNumber(input.desiredRoleCount, 1, 300, 6);
    const selection = await this.selectRoleIdsForObjective({
      objective: input.objective,
      desiredRoleCount,
      library,
    });
    return this.launchOfficialSwarm({
      ...input,
      roleLibraryIds: selection.selectedRoleIds,
      maxRoles: input.maxRoles || desiredRoleCount,
      roleSelectionOverride: selection,
    });
  }

  public launchOfficialSwarm(input: SwarmV2CreateInput): SwarmV2TrackedSnapshot {
    const objective = String(input.objective || '').trim();
    if (!objective) {
      throw new Error('objective obrigatorio.');
    }

    const swarmId = String(input.swarmId || '').trim() || randomUUID();
    const createdAt = new Date().toISOString();
    const roleLibrary = this.readRoleLibrary();
    const defaultIsolation = ((): SwarmV2IsolationMode => {
      const envVal = process.env.ZAVORTH_SWARM_DEFAULT_ISOLATION;
      if (
        envVal === 'direct' ||
        envVal === 'temp-worktree' ||
        envVal === 'docker' ||
        envVal === 'wsl' ||
        envVal === 'external-sandbox'
      ) {
        return envVal as SwarmV2IsolationMode;
      }
      return 'temp-worktree';
    })();
    const autoSelection = input.roleSelectionOverride || this.resolveSyncRoleSelection({
      objective,
      library: roleLibrary,
      selectedRoleIds: Array.isArray(input.roleLibraryIds)
        ? input.roleLibraryIds.map((entry) => this.normalizeKey(entry, '')).filter(Boolean)
        : [],
      requestedRoles: Array.isArray(input.roles) ? input.roles : [],
      autoSelectRoles: input.autoSelectRoles === true,
      desiredRoleCount: this.clampNumber(input.desiredRoleCount, 1, 300, 6),
    });
    const selectedRoleIds = autoSelection.selectedRoleIds;
    const requestedRoles = Array.isArray(input.roles) ? input.roles : [];
    const libraryRoles = this.rolesFromLibrary(
      roleLibrary,
      selectedRoleIds.length > 0
        ? selectedRoleIds
        : requestedRoles.length === 0
          ? ['planner', 'researcher', 'implementer', 'verifier', 'synthesizer']
          : [],
    );
    const roles = this.prepareOfficialRoles([...requestedRoles, ...libraryRoles], {
      objective,
      maxRoles: this.clampNumber(input.maxRoles, 1, 300, 300),
      isolationMode: input.isolationMode || defaultIsolation,
      swarmId,
      toolSpecs: this.normalizeToolSpecs(input.toolSpecs),
      isolationImage: input.isolationImage,
      wslDistro: input.wslDistro,
    });
    if (roles.length === 0) {
      throw new Error('roles obrigatorios.');
    }
    const tokenBudget = this.buildTokenBudgetSnapshot({
      objective,
      roles,
      roleSelection: autoSelection,
      input: input.tokenBudget,
      benchmark: input.benchmark === true,
      hasLlmRuntime: Boolean(this.options.llmRuntime),
    });
    if (tokenBudget.status !== 'passed') {
      throw new Error(`Swarm Token Budget Guard: ${tokenBudget.status}. ${tokenBudget.rationale}`);
    }

    const maxConcurrency = this.clampNumber(input.maxConcurrency, 1, 30, Math.min(6, roles.length));
    const batchSize = this.clampNumber(input.batchSize, 1, maxConcurrency, maxConcurrency);
    const batches = this.chunkRoles(roles, batchSize).map((batch, index): SwarmV2BatchSnapshot => ({
      batchId: `${swarmId}:batch-${index + 1}`,
      index,
      status: 'queued',
      roleIds: batch.map((role) => role.id),
      maxConcurrency,
      startedAt: null,
      finishedAt: null,
    }));
    const state: SwarmV2OfficialState = {
      swarmId,
      objective,
      createdAt,
      roles,
      selectedRoleIds,
      queueStatus: 'queued',
      maxRoles: 300,
      maxConcurrency,
      batches,
      replay: [],
      isolationMode: input.isolationMode || defaultIsolation,
      workerRoots: roles.map((role) => ({
        roleId: role.id,
        cwd: role.cwd || process.cwd(),
        mode: role.isolation?.mode || 'direct',
      })),
      synthesisStatus: 'pending',
      synthesisMode: this.options.llmRuntime ? 'llm' : 'deterministic',
      synthesisSummary: 'Synthesis is waiting for batches to complete.',
      startedAt: createdAt,
      roleSelection: {
        ...autoSelection,
        selectedRoleIds: selectedRoleIds.length > 0 ? selectedRoleIds.slice() : roles.map((role) => role.id),
        requestedRoleCount: roles.length,
        availableRoleCount: roleLibrary.length,
      },
      toolSpecs: this.normalizeToolSpecs(input.toolSpecs),
      benchmarkEnabled: input.benchmark === true,
      tokenBudget,
      strongIsolationRequired: input.requireStrongIsolation === true,
      strongIsolationSatisfied: this.isStrongIsolationMode(input.isolationMode || defaultIsolation),
      strongIsolationWrapper: this.strongIsolationWrapper(input.isolationMode || defaultIsolation),
    };
    if (state.strongIsolationRequired && !state.strongIsolationSatisfied) {
      throw new Error('Swarm v2 exige isolamento forte: use isolationMode docker, wsl ou external-sandbox.');
    }
    this.pushReplay(state, 'swarm.queued', 'Swarm oficial enfileirado.', {
      roleCount: roles.length,
      maxConcurrency,
      batchSize,
      autoSelectRoles: input.autoSelectRoles === true,
      benchmark: input.benchmark === true,
      strongIsolation: state.strongIsolationSatisfied,
    });
    this.pushReplay(state, 'role.selection', 'Roles selecionadas para o Swarm oficial.', {
      mode: state.roleSelection.mode,
      selectedRoleIds: state.roleSelection.selectedRoleIds,
      rationale: state.roleSelection.rationale,
    });
    for (const role of roles) {
      if (!role.toolSpecId) continue;
      this.pushReplay(state, 'role.tool.bound', `Tool spec ${role.toolSpecId} ligado a role ${role.id}.`, {
        roleId: role.id,
        toolSpecId: role.toolSpecId,
      });
    }
    for (const batch of batches) {
      this.pushReplay(state, 'batch.queued', `Batch ${batch.index + 1} is waiting for execution.`, {
        batchId: batch.batchId,
        roleIds: batch.roleIds,
      });
    }

    const initialSnapshot = this.withOfficialSurface(this.withLifecycle({
      swarmId,
      status: 'running',
      objective,
      roles: [],
      startedAt: createdAt,
      finishedAt: null,
      synthesizedOutput: null,
    }, {
      summary: `Official Swarm v2 queued: ${objective}.`,
    }, []), state);

    const entry: ManagedSwarm = {
      swarmId,
      orchestrator: null,
      roles,
      subagentReceipts: [],
      subagentBudget: input.subagentBudget || null,
      lastSnapshot: initialSnapshot,
      createdAt,
      execution: Promise.resolve(initialSnapshot),
      officialState: state,
    };

    entry.execution = this.executeOfficialBatches(entry, input);
    this.swarms.set(swarmId, entry);
    return { ...initialSnapshot, createdAt };
  }

  public cancelSwarm(swarmId: string): SwarmV2TrackedSnapshot {
    const entry = this.swarms.get(String(swarmId || '').trim());
    if (!entry) {
      throw new Error('Swarm v2 not found.');
    }
    if (entry.officialState) {
      entry.orchestrator?.killAll();
      entry.officialState.queueStatus = 'cancelled';
      entry.officialState.synthesisStatus = 'failed';
      entry.officialState.synthesisSummary = 'Swarm cancelled by the operator.';
      for (const batch of entry.officialState.batches) {
        if (batch.status === 'queued' || batch.status === 'running') {
          batch.status = 'cancelled';
          batch.finishedAt = new Date().toISOString();
        }
      }
      this.pushReplay(entry.officialState, 'swarm.cancelled', `Swarm ${entry.swarmId} cancelled by the operator.`);
      entry.lastSnapshot = this.withOfficialSurface({
        ...entry.lastSnapshot,
        status: 'cancelled',
        finishedAt: new Date().toISOString(),
        synthesizedOutput: entry.officialState.synthesisSummary,
      }, entry.officialState);
      return {
        ...entry.lastSnapshot,
        swarmId: entry.swarmId,
        createdAt: entry.createdAt,
      };
    }
    if (!entry.orchestrator) {
      throw new Error('Swarm v2 has no active orchestrator.');
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
      entry.orchestrator?.killAll();
    }
    this.swarms.clear();
  }

  private async executeOfficialBatches(
    entry: ManagedSwarm,
    input: SwarmV2CreateInput,
  ): Promise<SwarmSnapshot> {
    const state = entry.officialState;
    if (!state) {
      return entry.lastSnapshot;
    }
    state.queueStatus = 'running';
    const allResults: SwarmTaskResult[] = [];
    let finalStatus: SwarmSnapshot['status'] = 'completed';

    for (const batch of state.batches) {
      const queueStatus: SwarmV2OfficialSurface['queue']['status'] = entry.officialState?.queueStatus || state.queueStatus;
      if (queueStatus === 'cancelled') {
        finalStatus = 'cancelled';
        break;
      }
      batch.status = 'running';
      batch.startedAt = new Date().toISOString();
      this.pushReplay(state, 'batch.started', `Batch ${batch.index + 1} iniciado.`, {
        batchId: batch.batchId,
        roleIds: batch.roleIds,
      });
      const batchRoles = state.roles.filter((role) => batch.roleIds.includes(role.id));
      const orchestrator = this.options.orchestratorFactory?.(state.objective, batchRoles)
        || new SwarmOrchestrator(entry.lastSnapshot.objective, batchRoles, {
          roleTimeoutMs: input.subagentBudget?.maxWallClockMs || 120000,
          traceId: entry.lastSnapshot.traceId || entry.swarmId,
          runId: entry.lastSnapshot.runId || entry.swarmId,
          sessionId: entry.lastSnapshot.sessionId || null,
          surface: 'swarm-v2-official',
        });
      entry.orchestrator = orchestrator;
      orchestrator.on('role:started', (event: SwarmOrchestratorRoleStartedEvent) => {
        this.pushReplay(state, 'role.started', `Role ${String(event.label || event.roleId || 'unknown')} iniciado.`, {
          batchId: batch.batchId,
          roleId: event.roleId,
        });
      });
      orchestrator.on('role:data', (event: SwarmOrchestratorRoleDataEvent) => {
        this.pushReplay(state, 'role.output', `Role ${String(event.roleId || 'unknown')} emitiu output.`, {
          batchId: batch.batchId,
          roleId: event.roleId,
          bytes: Buffer.byteLength(String(event.data || ''), 'utf8'),
        });
      });
      orchestrator.on('role:finished', (event: SwarmOrchestratorRoleFinishedEvent) => {
        this.pushReplay(state, 'role.finished', `Role ${String(event.roleId || 'unknown')} finalizado.`, {
          batchId: batch.batchId,
          roleId: event.roleId,
          status: event.status,
          exitCode: event.exitCode,
        });
      });

      const batchSnapshot = await orchestrator.execute();
      allResults.push(...batchSnapshot.roles);
      batch.finishedAt = new Date().toISOString();
      batch.status = batchSnapshot.status === 'completed'
        ? 'completed'
        : batchSnapshot.status === 'cancelled'
          ? 'cancelled'
          : 'failed';
      this.pushReplay(state, 'batch.finished', `Batch ${batch.index + 1} finalizado como ${batch.status}.`, {
        batchId: batch.batchId,
        status: batchSnapshot.status,
      });
      if (batchSnapshot.status === 'timed_out') {
        finalStatus = 'timed_out';
      } else if (batchSnapshot.status === 'cancelled') {
        finalStatus = 'cancelled';
      } else if (batchSnapshot.status !== 'completed' && finalStatus === 'completed') {
        finalStatus = 'failed';
      }

      const intermediate = this.buildOfficialSnapshot(entry, state, allResults, finalStatus, null);
      entry.lastSnapshot = intermediate;
      if ((entry.officialState?.queueStatus as SwarmV2OfficialSurface['queue']['status'] | undefined) === 'cancelled') {
        finalStatus = 'cancelled';
        break;
      }
    }

    state.queueStatus = finalStatus === 'completed' ? 'completed' : finalStatus === 'cancelled' ? 'cancelled' : 'failed';
    state.synthesisStatus = finalStatus === 'cancelled' ? 'failed' : 'completed';
    state.synthesisMode = this.options.llmRuntime && finalStatus !== 'cancelled' ? 'llm' : 'deterministic';
    const synthesizedOutput = finalStatus === 'cancelled'
      ? state.synthesisSummary
      : await this.synthesizeOfficialOutput(state, allResults, finalStatus);
    state.synthesisSummary = finalStatus === 'cancelled'
      ? 'Swarm cancelled by the operator.'
      : `Sintese oficial gerada com ${allResults.length}/${state.roles.length} role(s).`;
    this.pushReplay(state, 'swarm.synthesized', state.synthesisSummary, {
      outputChars: synthesizedOutput.length,
      finalStatus,
    });
    entry.subagentReceipts = this.resolveSubagentReceipts(state.roles, {
      objective: state.objective,
      snapshot: {
        ...entry.lastSnapshot,
        roles: allResults,
        status: finalStatus,
        synthesizedOutput,
      },
      receiptSeeds: entry.subagentReceipts,
      budgetInput: entry.subagentBudget,
    });
    entry.lastSnapshot = this.buildOfficialSnapshot(entry, state, allResults, finalStatus, synthesizedOutput);
    return entry.lastSnapshot;
  }

  private buildOfficialSnapshot(
    entry: ManagedSwarm,
    state: SwarmV2OfficialState,
    roles: SwarmTaskResult[],
    status: SwarmSnapshot['status'],
    synthesizedOutput: string | null,
  ): SwarmSnapshot {
    return this.withOfficialSurface(this.withLifecycle({
      ...entry.lastSnapshot,
      swarmId: entry.swarmId,
      status,
      objective: state.objective,
      roles,
      startedAt: state.startedAt,
      finishedAt: status === 'running' ? null : new Date().toISOString(),
      synthesizedOutput,
    }, {
      summary: `Official Swarm v2 ${status} with ${roles.length} role result(s).`,
    }, entry.subagentReceipts), state);
  }

  private withOfficialSurface(snapshot: SwarmSnapshot, state: SwarmV2OfficialState): SwarmSnapshot & SwarmV2OfficialSurface {
    const metrics = this.buildOfficialMetrics(snapshot, state);
    return {
      ...snapshot,
      official: true,
      experimental: false,
      contractVersion: SWARM_V2_OFFICIAL_CONTRACT_VERSION,
      queue: {
        mode: 'batch-queue',
        status: state.queueStatus,
        maxRoles: state.maxRoles,
        maxConcurrency: state.maxConcurrency,
        pendingBatchIds: state.batches.filter((batch) => batch.status === 'queued').map((batch) => batch.batchId),
      },
      batches: state.batches.map((batch) => ({ ...batch, roleIds: batch.roleIds.slice() })),
      replay: {
        eventCount: state.replay.length,
        events: state.replay.slice(-200),
      },
      replayInsights: this.buildReplayInsights(snapshot, state),
      metrics,
      roleLibrary: {
        persistent: true,
        selectedRoleIds: state.selectedRoleIds.slice(),
        availableRoleCount: this.readRoleLibrary().length,
      },
      isolation: {
        mode: state.isolationMode,
        workersIsolated: state.isolationMode !== 'direct',
        workerRoots: state.workerRoots.map((worker) => ({ ...worker })),
        note: state.isolationMode === 'temp-worktree'
          ? 'Cada role roda em cwd temporario separado; use docker/wsl/external-sandbox para isolamento de SO forte.'
          : 'Isolamento declarado pelo perfil do worker e registrado nos receipts.',
      },
      synthesis: {
        mode: state.synthesisMode,
        status: state.synthesisStatus,
        summary: state.synthesisSummary,
      },
      roleSelection: {
        ...state.roleSelection,
        selectedRoleIds: state.roleSelection.selectedRoleIds.slice(),
      },
      toolExecution: this.buildToolExecutionSnapshot(snapshot, state),
      benchmark: this.buildBenchmarkSnapshot(snapshot, state, metrics),
      tokenBudget: state.tokenBudget,
      strongIsolation: {
        required: state.strongIsolationRequired,
        satisfied: state.strongIsolationSatisfied,
        mode: state.isolationMode,
        wrapper: state.strongIsolationWrapper,
        note: state.strongIsolationRequired
          ? 'Strong isolation was explicitly required by the operator.'
          : 'Strong isolation is optional for this run; sensitive mutations still require approval.',
      },
    };
  }

  private buildOfficialMetrics(snapshot: SwarmSnapshot, state: SwarmV2OfficialState): SwarmV2ParallelMetrics {
    const roles = snapshot.roles || [];
    const completedRoles = roles.filter((role) => role.status === 'IDLE').length;
    const timedOutRoles = roles.filter((role) => role.status === 'TIMEOUT').length;
    const cancelledRoles = roles.filter((role) => role.status === 'CANCELLED').length;
    const failedRoles = roles.filter((role) => !['IDLE', 'TIMEOUT', 'CANCELLED'].includes(String(role.status))).length;
    const outputBytes = roles.reduce((total, role) => total + Buffer.byteLength(role.output.join(''), 'utf8'), 0);
    const started = new Date(state.startedAt).getTime();
    const elapsedMs = Number.isFinite(started) ? Math.max(0, Date.now() - started) : 0;
    return {
      totalRoles: state.roles.length,
      queuedRoles: Math.max(0, state.roles.length - roles.length),
      runningRoles: state.batches.some((batch) => batch.status === 'running') ? state.maxConcurrency : 0,
      completedRoles,
      failedRoles,
      timedOutRoles,
      cancelledRoles,
      maxConcurrency: state.maxConcurrency,
      batchCount: state.batches.length,
      completedBatchCount: state.batches.filter((batch) => batch.status === 'completed').length,
      elapsedMs,
      outputBytes,
      synthesisChars: snapshot.synthesizedOutput?.length || 0,
      parallelismScore: Math.round((Math.min(state.maxConcurrency, state.roles.length) / Math.max(1, state.roles.length)) * 100),
    };
  }

  private buildReplayInsights(snapshot: SwarmSnapshot, state: SwarmV2OfficialState): SwarmV2ReplayInsights {
    const events = state.replay;
    const roles = snapshot.roles || [];
    const roleOutputs = roles.map((role) => ({
      roleId: role.roleId,
      label: role.label,
      status: String(role.status || 'unknown'),
      outputBytes: Buffer.byteLength(role.output.join(''), 'utf8'),
      eventCount: events.filter((event) => event.roleId === role.roleId).length,
    }));
    const completedRoles = roles.filter((role) => role.status === 'IDLE').length;
    const failedRoles = roles.filter((role) => !['IDLE', 'PROCESSING'].includes(String(role.status))).length;
    const outputBytes = roleOutputs.map((role) => role.outputBytes);
    const strongest = roleOutputs.slice().sort((left, right) => right.outputBytes - left.outputBytes)[0] || null;
    const weakest = roleOutputs.slice().sort((left, right) => left.outputBytes - right.outputBytes)[0] || null;
    const outputSpreadBytes = outputBytes.length > 0
      ? Math.max(...outputBytes) - Math.min(...outputBytes)
      : 0;
    const bottlenecks: SwarmV2ReplayInsights['bottlenecks'] = [];
    if (state.batches.some((batch) => batch.status === 'failed')) {
      bottlenecks.push({
        id: 'batch-failed',
        severity: 'critical',
        summary: 'Um batch falhou; revise eventos de role.finished e saida por role.',
      });
    }
    if (failedRoles > 0) {
      bottlenecks.push({
        id: 'role-failed',
        severity: 'warning',
        summary: `${failedRoles} role(s) terminaram sem sucesso limpo.`,
      });
    }
    if (outputSpreadBytes > 16_000) {
      bottlenecks.push({
        id: 'output-spread',
        severity: 'info',
        summary: 'Uma role produziu muito mais contexto que as outras; revise a sintese por vies de volume.',
      });
    }
    const synthesisConfidence = Math.max(0, Math.min(100, Math.round(
      100
      - failedRoles * 18
      - (state.synthesisStatus === 'completed' ? 0 : 25)
      - (roles.length === 0 ? 20 : 0)
      - (bottlenecks.some((item) => item.severity === 'critical') ? 25 : 0),
    )));
    return {
      status: events.length === 0 ? 'empty' : state.queueStatus === 'running' ? 'recording' : 'ready',
      operatorSummary: events.length === 0
        ? 'Replay ainda sem eventos.'
        : `${events.length} evento(s), ${completedRoles}/${state.roles.length} role(s) concluidas, confianca ${synthesisConfidence}/100.`,
      timeline: [
        this.buildReplayTimelineItem('queued', 'Fila', events, ['swarm.queued', 'batch.queued'], state.queueStatus === 'queued' ? 'active' : 'done'),
        this.buildReplayTimelineItem('roles', 'Roles', events, ['role.started', 'role.output', 'role.finished'], state.queueStatus === 'running' ? 'active' : completedRoles > 0 ? 'done' : 'pending'),
        this.buildReplayTimelineItem('batches', 'Batches', events, ['batch.started', 'batch.finished'], state.batches.some((batch) => batch.status === 'failed') ? 'failed' : state.batches.some((batch) => batch.status === 'running') ? 'active' : 'done'),
        this.buildReplayTimelineItem('synthesis', 'Sintese', events, ['swarm.synthesized', 'swarm.failed'], state.synthesisStatus === 'failed' ? 'failed' : state.synthesisStatus === 'completed' ? 'done' : 'pending'),
      ],
      byRole: roleOutputs.map((role) => ({
        ...role,
        confidence: role.status === 'IDLE'
          ? Math.min(100, 70 + Math.min(20, Math.floor(role.outputBytes / 400)))
          : role.status === 'PROCESSING'
            ? 45
            : 20,
      })),
      bottlenecks,
      compare: {
        completedRoles,
        failedRoles,
        outputSpreadBytes,
        strongestRoleId: strongest?.roleId || null,
        weakestRoleId: weakest?.roleId || null,
      },
      synthesisConfidence,
      nextReplayAction: bottlenecks.length > 0
        ? 'Abra os eventos por role e compare a sintese antes de confiar no resultado.'
        : state.synthesisStatus === 'completed'
          ? 'Use a sintese final e mantenha o replay como evidencia.'
          : 'Aguarde a sintese ou cancele se o swarm travar.',
    };
  }

  private buildReplayTimelineItem(
    id: string,
    label: string,
    events: SwarmV2ReplayEvent[],
    types: SwarmV2ReplayEvent['type'][],
    status: SwarmV2ReplayInsights['timeline'][number]['status'],
  ): SwarmV2ReplayInsights['timeline'][number] {
    return {
      id,
      label,
      eventCount: events.filter((event) => types.includes(event.type)).length,
      status,
    };
  }

  private buildToolExecutionSnapshot(snapshot: SwarmSnapshot, state: SwarmV2OfficialState): SwarmV2OfficialSurface['toolExecution'] {
    const toolIds = state.roles.map((role) => String(role.toolSpecId || '')).filter(Boolean);
    const commandToolCount = state.roles.filter((role) => Boolean(role.command)).length;
    return {
      plannedToolCount: toolIds.length,
      executedToolCount: (snapshot.roles || []).filter((role) => toolIds.includes(role.roleId) || state.roles.find((item) => item.id === role.roleId)?.toolSpecId).length,
      commandToolCount,
      approvalRequiredToolCount: state.toolSpecs.filter((tool) => tool.requiresApproval !== false).length,
      toolIds,
    };
  }

  private buildBenchmarkSnapshot(
    snapshot: SwarmSnapshot,
    state: SwarmV2OfficialState,
    metrics: SwarmV2ParallelMetrics,
  ): SwarmV2BenchmarkSnapshot {
    if (!state.benchmarkEnabled) {
      return {
        enabled: false,
        baseline: 'not-requested',
        elapsedMs: metrics.elapsedMs,
        estimatedSerialMs: 0,
        speedup: 0,
        throughputRolesPerSecond: 0,
        failureRate: 0,
        qualityScore: 0,
      };
    }
    const roleDurations = (snapshot.roles || []).map((role) => {
      const started = Date.parse(String(role.startedAt || ''));
      const finished = Date.parse(String(role.finishedAt || ''));
      return Number.isFinite(started) && Number.isFinite(finished) ? Math.max(0, finished - started) : 0;
    });
    const estimatedSerialMs = roleDurations.reduce((total, value) => total + value, 0) || metrics.elapsedMs;
    const failures = metrics.failedRoles + metrics.timedOutRoles + metrics.cancelledRoles;
    const failureRate = Math.round((failures / Math.max(1, metrics.totalRoles)) * 1000) / 1000;
    const qualityScore = Math.max(0, Math.min(100, Math.round(
      100
      - failureRate * 100
      - (metrics.synthesisChars > 0 ? 0 : 20)
      - (metrics.outputBytes > 0 ? 0 : 20),
    )));
    return {
      enabled: true,
      baseline: 'estimated-serial',
      elapsedMs: metrics.elapsedMs,
      estimatedSerialMs,
      speedup: Math.round((estimatedSerialMs / Math.max(1, metrics.elapsedMs)) * 100) / 100,
      throughputRolesPerSecond: Math.round((metrics.completedRoles / Math.max(1, metrics.elapsedMs / 1000)) * 100) / 100,
      failureRate,
      qualityScore,
    };
  }

  private buildTokenBudgetSnapshot(input: {
    objective: string;
    roles: SwarmRole[];
    roleSelection: SwarmV2RoleSelectionSnapshot;
    input?: SwarmV2TokenBudgetInput | null;
    benchmark: boolean;
    hasLlmRuntime: boolean;
  }): SwarmV2TokenBudgetSnapshot {
    const modelClass = ['cheap', 'standard', 'premium'].includes(String(input.input?.modelClass || ''))
      ? input.input?.modelClass as 'cheap' | 'standard' | 'premium'
      : 'standard';
    const limits = {
      maxLlmCalls: this.clampNumber(input.input?.maxLlmCalls, 1, 100, 6),
      maxEstimatedTokens: this.clampNumber(input.input?.maxEstimatedTokens, 1000, 1000000, 48000),
      maxEstimatedUsd: this.clampMoney(input.input?.maxEstimatedUsd, 0.01, 100, 0.5),
    };
    const approved = input.input?.approved === true || input.input?.allowHighCost === true;
    const rolePromptTokens = input.roles.reduce((total, role) => (
      total
      + this.estimateTokens(role.systemPrompt)
      + this.estimateTokens(role.label)
      + this.estimateTokens(role.command || '')
      + this.estimateTokens((role.args || []).join(' '))
    ), 0);
    const objectiveTokens = this.estimateTokens(input.objective);
    const roleSelectionCalls = input.hasLlmRuntime && input.roleSelection.mode === 'llm' ? 1 : 0;
    const synthesisCalls = input.hasLlmRuntime ? 1 : 0;
    const roleLlmCalls = input.hasLlmRuntime
      ? input.roles.filter((role) => !role.command && !role.toolSpecId).length
      : 0;
    const estimatedLlmCalls = roleSelectionCalls + synthesisCalls + roleLlmCalls;
    const estimatedInputTokens = input.hasLlmRuntime
      ? objectiveTokens * Math.max(1, estimatedLlmCalls)
        + rolePromptTokens
        + input.roles.length * (input.benchmark ? 120 : 220)
      : 0;
    const estimatedOutputTokens = input.hasLlmRuntime
      ? 900 + roleLlmCalls * 700 + Math.ceil(input.roles.length * 35)
      : 0;
    const estimatedTotalTokens = estimatedInputTokens + estimatedOutputTokens;
    const estimatedUsd = this.estimateUsd(estimatedTotalTokens, modelClass);
    const risk = this.classifyTokenBudgetRisk({
      estimatedLlmCalls,
      estimatedTotalTokens,
      estimatedUsd,
    });
    const overLimit = estimatedLlmCalls > limits.maxLlmCalls
      || estimatedTotalTokens > limits.maxEstimatedTokens
      || estimatedUsd > limits.maxEstimatedUsd;
    const status: SwarmV2TokenBudgetSnapshot['status'] = !input.hasLlmRuntime
      ? 'passed'
      : risk === 'critical' && !approved
        ? 'blocked'
        : overLimit && !approved
          ? 'approval_required'
          : 'passed';
    const rationale = !input.hasLlmRuntime
      ? 'No LLM runtime is attached; this swarm uses local/tool execution and deterministic synthesis.'
      : status === 'passed'
        ? `Estimated ${estimatedLlmCalls} LLM call(s), ${estimatedTotalTokens} token(s), US$${estimatedUsd.toFixed(4)} within budget.`
        : `Estimated ${estimatedLlmCalls} LLM call(s), ${estimatedTotalTokens} token(s), US$${estimatedUsd.toFixed(4)} exceeds budget; approve explicitly or lower roles/output.`;
    return {
      enabled: true,
      status,
      risk,
      estimatedLlmCalls,
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedTotalTokens,
      estimatedUsd,
      limits,
      approved,
      modelClass,
      rationale,
    };
  }

  private classifyTokenBudgetRisk(input: {
    estimatedLlmCalls: number;
    estimatedTotalTokens: number;
    estimatedUsd: number;
  }): SwarmV2TokenBudgetSnapshot['risk'] {
    if (input.estimatedLlmCalls > 50 || input.estimatedTotalTokens > 250000 || input.estimatedUsd > 5) {
      return 'critical';
    }
    if (input.estimatedLlmCalls > 12 || input.estimatedTotalTokens > 100000 || input.estimatedUsd > 1.5) {
      return 'high';
    }
    if (input.estimatedLlmCalls > 4 || input.estimatedTotalTokens > 32000 || input.estimatedUsd > 0.35) {
      return 'medium';
    }
    return 'low';
  }

  private estimateTokens(text: unknown): number {
    return Math.ceil(String(text || '').length / 4);
  }

  private estimateUsd(tokens: number, modelClass: 'cheap' | 'standard' | 'premium'): number {
    const perMillion = modelClass === 'cheap' ? 0.25 : modelClass === 'premium' ? 10 : 2.5;
    return Math.round((tokens / 1_000_000) * perMillion * 10000) / 10000;
  }

  private clampMoney(value: unknown, min: number, max: number, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, parsed));
  }

  private async synthesizeOfficialOutput(
    state: SwarmV2OfficialState,
    results: SwarmTaskResult[],
    status: SwarmSnapshot['status'],
  ): Promise<string> {
    const lines = [
      '# Swarm v2 Official Synthesis',
      '',
      `Status: ${status}`,
      `Objective: ${state.objective}`,
      `Roles: ${results.length}/${state.roles.length}`,
      `Batches: ${state.batches.filter((batch) => batch.status === 'completed').length}/${state.batches.length}`,
      `Max concurrency: ${state.maxConcurrency}`,
      '',
      '## Role results',
    ];
    for (const result of results) {
      const text = result.output.join('').trim();
      lines.push(
        '',
        `### ${result.label} (${result.status})`,
        text ? text.slice(0, 4000) : 'No output captured.',
      );
    }
    lines.push(
      '',
      '## Operational notes',
      `Replay events: ${state.replay.length}`,
      `Isolation: ${state.isolationMode}`,
      'Mutation remains governed by Zavorth approvals and receipts.',
    );
    const deterministic = lines.join('\n');

    if (!this.options.llmRuntime) {
      return deterministic;
    }

    try {
      const response = await this.options.llmRuntime.chat([
        {
          role: 'user',
          content: [
            'You are Zavorth Swarm v2 final synthesizer.',
            'Create a concise, accurate final report from the role outputs below.',
            'Preserve blockers, failed roles, metrics and next safe steps.',
            'Do not expose chain-of-thought or raw secrets.',
            '',
            deterministic,
          ].join('\n'),
        },
      ], [], {
        allowFallback: true,
        telemetry: {
          surface: 'swarm-v2-official',
          runId: state.swarmId,
          traceId: state.swarmId,
        },
      } satisfies LlmRunOptions);
      return response.content?.trim() || deterministic;
    } catch (error: any) { const err = error; const e = error;
      this.pushReplay(state, 'swarm.failed', 'LLM synthesis failed; deterministic synthesis was used.', {
        error: String(error instanceof Error ? error.message : String(error ?? 'unknown')).slice(0, 240),
      });
      state.synthesisMode = 'deterministic';
      return deterministic;
    }
  }

  private async selectRoleIdsForObjective(input: {
    objective: string;
    desiredRoleCount: number;
    library: SwarmV2RoleLibraryEntry[];
  }): Promise<SwarmV2RoleSelectionSnapshot> {
    const fallback = this.resolveSyncRoleSelection({
      objective: input.objective,
      library: input.library,
      selectedRoleIds: [],
      requestedRoles: [],
      autoSelectRoles: true,
      desiredRoleCount: input.desiredRoleCount,
    });
    if (!this.options.llmRuntime) {
      return fallback;
    }
    try {
      const available = input.library.map((role) => ({
        id: role.id,
        label: role.label,
        kind: role.kind,
        risk: role.risk,
        scope: role.scope,
        tags: role.tags,
      }));
      const response = await this.options.llmRuntime.chat([
        {
          role: 'user',
          content: [
            'You are Zavorth Swarm v2 role selector.',
            'Select the smallest useful role set for the objective.',
            'Return JSON only: {"selectedRoleIds":["planner"],"rationale":"short reason"}.',
            'Use only role IDs from the available list. Prefer planner, researcher, verifier and synthesizer for broad work.',
            `Desired role count: ${input.desiredRoleCount}`,
            `Objective: ${input.objective}`,
            `Available roles: ${JSON.stringify(available)}`,
          ].join('\n'),
        },
      ], [], {
        allowFallback: true,
        telemetry: {
          surface: 'swarm-v2-role-selection',
          runId: 'swarm-v2-role-selection',
          traceId: 'swarm-v2-role-selection',
        },
      } satisfies LlmRunOptions);
      const parsed = this.parseJsonObject(response.content);
      const libraryIds = new Set(input.library.map((role) => role.id));
      const selected = Array.isArray(parsed?.selectedRoleIds)
        ? parsed.selectedRoleIds
          .map((value: unknown) => this.normalizeKey(value, ''))
          .filter((value: string, index: number, values: string[]) => libraryIds.has(value) && values.indexOf(value) === index)
          .slice(0, input.desiredRoleCount)
        : [];
      if (selected.length === 0) {
        return fallback;
      }
      return {
        mode: 'llm',
        requestedRoleCount: input.desiredRoleCount,
        selectedRoleIds: selected,
        availableRoleCount: input.library.length,
        rationale: String(parsed?.rationale || 'LLM selected roles from the persistent role library.').slice(0, 400),
      };
    } catch (error: any) { const err = error; const e = error; logger.warn('[Swarm V2] parsing failed', error); return fallback; }
  }

  private resolveSyncRoleSelection(input: {
    objective: string;
    library: SwarmV2RoleLibraryEntry[];
    selectedRoleIds: string[];
    requestedRoles: SwarmRole[];
    autoSelectRoles: boolean;
    desiredRoleCount: number;
  }): SwarmV2RoleSelectionSnapshot {
    const libraryIds = new Set(input.library.map((role) => role.id));
    if (input.selectedRoleIds.length > 0) {
      const selected = input.selectedRoleIds
        .filter((id, index, values) => libraryIds.has(id) && values.indexOf(id) === index)
        .slice(0, input.desiredRoleCount);
      return {
        mode: 'manual',
        requestedRoleCount: input.desiredRoleCount,
        selectedRoleIds: selected,
        availableRoleCount: input.library.length,
        rationale: 'Operator provided explicit role library IDs.',
      };
    }
    if (input.requestedRoles.length > 0) {
      return {
        mode: 'manual',
        requestedRoleCount: input.requestedRoles.length,
        selectedRoleIds: input.requestedRoles.map((role, index) => this.normalizeKey(role.id || `role-${index + 1}`, `role-${index + 1}`)),
        availableRoleCount: input.library.length,
        rationale: 'Operator provided concrete swarm roles.',
      };
    }
    if (!input.autoSelectRoles) {
      return {
        mode: 'manual',
        requestedRoleCount: input.desiredRoleCount,
        selectedRoleIds: [],
        availableRoleCount: input.library.length,
        rationale: 'No automatic role selection requested; default official role bundle will be used.',
      };
    }

    const objective = input.objective.toLowerCase();
    const wanted = ['planner', 'researcher'];
    if (/(implementar|implemente|code|codigo|patch|corrigir|fix|build|test|teste|execut)/i.test(objective)) {
      wanted.push('implementer');
    }
    if (/(seguranca|security|risco|approval|permiss|secret|vulnerab|auditoria)/i.test(objective)) {
      wanted.push('safety-reviewer');
    }
    wanted.push('verifier', 'synthesizer');

    const selected = wanted
      .filter((id, index, values) => libraryIds.has(id) && values.indexOf(id) === index)
      .slice(0, input.desiredRoleCount);
    for (const role of input.library) {
      if (selected.length >= input.desiredRoleCount) break;
      if (!selected.includes(role.id)) selected.push(role.id);
    }
    return {
      mode: 'heuristic',
      requestedRoleCount: input.desiredRoleCount,
      selectedRoleIds: selected,
      availableRoleCount: input.library.length,
      rationale: 'Zavorth selected roles from objective keywords, risk hints and the persistent role library.',
    };
  }

  private normalizeToolSpecs(raw: unknown): SwarmV2ToolSpec[] {
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.map((entry, index): SwarmV2ToolSpec | null => {
      const tool = entry as RawToolSpecInput;
      const id = this.normalizeKey(tool.id, `tool-${index + 1}`);
      const command = String(tool.command || '').trim();
      if (!command) {
        return null;
      }
      const risk = ['safe', 'attention', 'danger'].includes(String(tool.risk || ''))
        ? (tool.risk as SwarmV2ToolSpec['risk'])
        : 'attention';
      return {
        id,
        kind: 'shell',
        label: String(tool.label || id).trim(),
        command,
        args: Array.isArray(tool.args) ? tool.args.map((value: unknown) => String(value)) : [],
        cwd: String(tool.cwd || '').trim() || null,
        risk,
        requiresApproval: tool.requiresApproval === false ? false : true,
      };
    }).filter(Boolean) as SwarmV2ToolSpec[];
  }

  private isStrongIsolationMode(mode: SwarmV2IsolationMode): boolean {
    return mode === 'docker' || mode === 'wsl' || mode === 'external-sandbox';
  }

  private strongIsolationWrapper(mode: SwarmV2IsolationMode): SwarmV2OfficialSurface['strongIsolation']['wrapper'] {
    if (mode === 'docker') return 'docker';
    if (mode === 'wsl') return 'wsl';
    if (mode === 'external-sandbox') return 'external-sandbox';
    return 'none';
  }

  private parseJsonObject(raw: unknown): Record<string, unknown> | null {
    const text = String(raw || '').trim();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (error: any) { const err = error; const e = error;
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try {
        return JSON.parse(match[0]);
      } catch (error: any) { const err = error; const e = error; logger.warn('[Swarm V2] JSON parse failed', error); return null; }
    }
  }

  private prepareOfficialRoles(
    roles: SwarmRole[],
    input: {
      objective: string;
      maxRoles: number;
      isolationMode: SwarmV2IsolationMode;
      swarmId: string;
      toolSpecs: SwarmV2ToolSpec[];
      isolationImage?: string | null;
      wslDistro?: string | null;
    },
  ): SwarmRole[] {
    return roles.slice(0, input.maxRoles).map((role, index) => {
      const id = this.normalizeKey(role.id || `role-${index + 1}`, `role-${index + 1}`);
      const cwd = this.resolveRoleCwd(input.swarmId, id, input.isolationMode, role.cwd);
      const toolSpec = !role.command && input.toolSpecs.length > 0
        ? input.toolSpecs[index % input.toolSpecs.length]
        : null;
      const commandRole = toolSpec
        ? this.applyToolSpecToRole(role, toolSpec)
        : role;
      const isolatedCommand = this.applyStrongIsolationWrapper(commandRole, {
        mode: input.isolationMode,
        cwd,
        isolationImage: input.isolationImage,
        wslDistro: input.wslDistro,
      });
      return {
        ...isolatedCommand,
        id,
        label: String(role.label || `Role ${index + 1}`).trim(),
        systemPrompt: String(role.systemPrompt || 'Execute sua parte da missao com saida objetiva e auditavel.').trim(),
        cwd,
        toolSpecId: toolSpec?.id || role.toolSpecId || null,
        isolation: {
          mode: input.isolationMode,
          workerId: `${input.swarmId}:${id}`,
          receiptId: `swarm-isolation:${input.swarmId}:${id}`,
          description: `Official Swarm v2 worker for ${id}.`,
        },
        delegationPolicy: role.delegationPolicy,
      };
    });
  }

  private resolveRoleCwd(
    swarmId: string,
    roleId: string,
    mode: SwarmV2IsolationMode,
    requestedCwd?: string,
  ): string {
    if (mode === 'direct') {
      return requestedCwd || process.cwd();
    }
    if (mode === 'temp-worktree') {
      const root = path.join(os.tmpdir(), 'zavorth-swarm-v2', this.normalizeKey(swarmId, 'swarm'), roleId);
      fs.mkdirSync(root, { recursive: true });
      return root;
    }
    return requestedCwd || process.cwd();
  }

  private applyToolSpecToRole(role: SwarmRole, tool: SwarmV2ToolSpec): SwarmRole {
    return {
      ...role,
      command: tool.command,
      args: tool.args?.slice() || [],
      cwd: tool.cwd || role.cwd,
      stdinMode: 'none',
      toolSpecId: tool.id,
    };
  }

  private applyStrongIsolationWrapper(
    role: SwarmRole,
    input: {
      mode: SwarmV2IsolationMode;
      cwd: string;
      isolationImage?: string | null;
      wslDistro?: string | null;
    },
  ): SwarmRole {
    if (!role.command) {
      return role;
    }
    if (input.mode === 'docker') {
      const image = String(input.isolationImage || 'node:22').trim();
      return {
        ...role,
        command: 'docker',
        args: [
          'run',
          '--rm',
          '--network',
          'none',
          '-v',
          `${input.cwd}:/workspace`,
          '-w',
          '/workspace',
          image,
          role.command,
          ...(role.args || []),
        ],
        cwd: input.cwd,
        stdinMode: 'none',
      };
    }
    if (input.mode === 'wsl' && process.platform === 'win32') {
      const distro = String(input.wslDistro || '').trim();
      return {
        ...role,
        command: 'wsl.exe',
        args: [
          ...(distro ? ['-d', distro] : []),
          '--cd',
          input.cwd,
          '--',
          role.command,
          ...(role.args || []),
        ],
        cwd: input.cwd,
        stdinMode: 'none',
      };
    }
    return role;
  }

  private rolesFromLibrary(library: SwarmV2RoleLibraryEntry[], ids: string[]): SwarmRole[] {
    const wanted = new Set(ids.map((id) => this.normalizeKey(id, '')));
    return library
      .filter((entry) => wanted.has(entry.id))
      .map((entry): SwarmRole => ({
        id: entry.id,
        label: entry.label,
        systemPrompt: entry.systemPrompt,
      }));
  }

  private readRoleLibrary(): SwarmV2RoleLibraryEntry[] {
    const filePath = this.resolveRoleLibraryPath();
    if (!fs.existsSync(filePath)) {
      const seeded = this.defaultRoleLibrary();
      this.writeRoleLibrary(seeded);
      return seeded;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (Array.isArray(parsed)) {
        return parsed.map((entry) => this.normalizeRoleLibraryEntry(entry)).filter(Boolean) as SwarmV2RoleLibraryEntry[];
      }
    } catch (error: any) { const err = error; const e = error;
      // fall through to defaults
      logger.warn('[Swarm V2] JSON parse failed', error);
    }
    const seeded = this.defaultRoleLibrary();
    this.writeRoleLibrary(seeded);
    return seeded;
  }

  private writeRoleLibrary(entries: SwarmV2RoleLibraryEntry[]): void {
    const filePath = this.resolveRoleLibraryPath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), 'utf8');
  }

  private resolveRoleLibraryPath(): string {
    return this.options.roleLibraryPath || path.resolve(process.cwd(), 'data', 'runtime', 'swarm-role-library.json');
  }

  private normalizeRoleLibraryEntry(raw: unknown): SwarmV2RoleLibraryEntry | null {
    const entry = raw as RawRoleLibraryEntry | undefined | null;
    const id = this.normalizeKey(entry?.id, '');
    const systemPrompt = String(entry?.systemPrompt || '').trim();
    if (!id || !systemPrompt) {
      return null;
    }
    const now = new Date().toISOString();
    return {
      id,
      label: String(entry?.label || id).trim(),
      kind: ['planner', 'researcher', 'implementer', 'verifier', 'critic', 'synthesizer', 'operator', 'custom'].includes(String(entry?.kind || ''))
        ? (entry?.kind as SwarmV2RoleLibraryEntry['kind'])
        : 'custom',
      systemPrompt,
      defaultTools: Array.isArray(entry?.defaultTools) ? entry.defaultTools.map(String) : [],
      risk: ['safe', 'attention', 'danger', 'unknown'].includes(String(entry?.risk || ''))
        ? (entry?.risk as SwarmV2RoleLibraryEntry['risk'])
        : 'unknown',
      scope: ['read_only', 'tool_limited', 'workspace_patch'].includes(String(entry?.scope || ''))
        ? (entry?.scope as SwarmV2RoleLibraryEntry['scope'])
        : 'tool_limited',
      tags: Array.isArray(entry?.tags) ? entry.tags.map(String) : [],
      createdAt: String(entry?.createdAt || now),
      updatedAt: String(entry?.updatedAt || now),
    };
  }

  private defaultRoleLibrary(): SwarmV2RoleLibraryEntry[] {
    const now = new Date().toISOString();
    return [
      ['planner', 'Planner', 'planner', 'Quebre a missao em etapas, riscos, dependencias, criterios de aceite e handoffs claros.'],
      ['researcher', 'Researcher', 'researcher', 'Collect evidence, files, context, and facts. Work in read-only mode and cite gaps.'],
      ['implementer', 'Implementer', 'implementer', 'Proponha ou execute a implementacao permitida, mantendo escopo, rollback e diffs pequenos.'],
      ['verifier', 'Verifier', 'verifier', 'Validate tests, regression risk, security, acceptance criteria, and operational risks.'],
      ['synthesizer', 'Synthesizer', 'synthesizer', 'Una os resultados dos demais agentes em uma resposta final objetiva, sem chain-of-thought bruto.'],
      ['safety-reviewer', 'Safety Reviewer', 'critic', 'Look for risks, improper permission use, secret leaks, prompt injection, and actions without approval.'],
    ].map(([id, label, kind, systemPrompt]) => ({
      id,
      label,
      kind: kind as SwarmV2RoleLibraryEntry['kind'],
      systemPrompt,
      defaultTools: [],
      risk: kind === 'implementer' ? 'attention' : 'safe',
      scope: kind === 'implementer' ? 'workspace_patch' : 'read_only',
      tags: ['official', 'default'],
      createdAt: now,
      updatedAt: now,
    }));
  }

  private chunkRoles(roles: SwarmRole[], size: number): SwarmRole[][] {
    const chunks: SwarmRole[][] = [];
    for (let index = 0; index < roles.length; index += size) {
      chunks.push(roles.slice(index, index + size));
    }
    return chunks;
  }

  private pushReplay(
    state: SwarmV2OfficialState,
    type: SwarmV2ReplayEvent['type'],
    summary: string,
    payload: Record<string, unknown> = {},
  ): void {
    state.replay.push({
      id: `swarm-replay-${state.replay.length + 1}`,
      at: new Date().toISOString(),
      type,
      swarmId: state.swarmId,
      batchId: typeof payload.batchId === 'string' ? payload.batchId : null,
      roleId: typeof payload.roleId === 'string' ? payload.roleId : null,
      summary,
      payload,
    });
  }

  private clampNumber(value: unknown, min: number, max: number, fallback: number): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return Math.min(max, Math.max(min, fallback));
    }
    return Math.min(max, Math.max(min, Math.trunc(parsed)));
  }

  private normalizeKey(value: unknown, fallback: string): string {
    const normalized = String(value || '').trim().toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return normalized || fallback;
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
      const allowedTools = role.delegationPolicy?.allowedTools ?? this.resolveRoleTools(role);
      const requiresApproval = role.delegationPolicy?.requiresApprovalTools
        ? role.delegationPolicy.requiresApprovalTools.length > 0
        : true;

      const scope = seed?.scope || createSubagentCapabilityScope({
        roleId: role.id,
        mode: 'tool_limited',
        allowedTools,
        allowedPaths: [],
        requiresApproval,
        metadata: {
          objective: input.objective,
          swarmRoleLabel: role.label,
          command: role.command || null,
          delegationPolicy: role.delegationPolicy ? JSON.stringify(role.delegationPolicy) : null,
        },
      });
      const approvalBoundary = seed?.approvalBoundary || createSubagentApprovalBoundary({
        scope,
        budget,
        risk: role.delegationPolicy?.requiresApprovalTools && role.delegationPolicy.requiresApprovalTools.length === 0
          ? 'unknown'
          : (role.command ? 'attention' : 'unknown'),
        approvalReason: 'SwarmV2 records the approval boundary before subagent execution.',
        metadata: {
          objective: input.objective,
          swarmRoleLabel: role.label,
          swarmId: input.snapshot?.swarmId || null,
        },
      });
      if (role.delegationPolicy?.requiresApprovalTools && role.delegationPolicy.requiresApprovalTools.length === 0) {
        approvalBoundary.requiresApproval = false;
      }
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
