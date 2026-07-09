import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from '../../../logger.js';

export const SWARM_SCALE_PLANE_CONTRACT_VERSION = '2026-06-01.swarm-scale-plane' as const;

export type SwarmScalePlannerMode = 'heuristic' | 'llm' | 'custom';
export type SwarmScaleExecutionMode = 'deterministic' | 'llm-live' | 'custom';
export type SwarmScaleExecutionBackendId =
  | 'auto'
  | 'local'
  | 'docker'
  | 'ssh'
  | 'wsl'
  | 'vercel-sandbox'
  | 'modal'
  | 'daytona'
  | 'singularity';
export type SwarmScaleControlSurface = 'cli' | 'tui' | 'desktop' | 'zavorthControl' | 'api' | 'agent' | 'system';
export type SwarmScaleRunStatus = 'planned' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type SwarmScaleAgentStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type SwarmScaleStepStatus = 'running' | 'completed' | 'failed' | 'skipped';
export type SwarmScaleStepKind = 'agent_execution' | 'llm_call' | 'tool_call' | 'reducer';

export type SwarmScaleDynamicConfigPatch = {
  maxConcurrency?: number | null;
  maxSteps?: number | null;
  executionMode?: SwarmScaleExecutionMode | null;
  executionBackend?: SwarmScaleExecutionBackendId | null;
  cloudSandboxEnabled?: boolean | null;
  deviceNodeRouting?: boolean | null;
  pauseReason?: string | null;
};

export type SwarmScaleNormalizedDynamicConfigPatch = {
  maxConcurrency: number;
  maxSteps: number;
  executionMode: SwarmScaleExecutionMode;
  executionBackend: SwarmScaleExecutionBackendId;
  cloudSandboxEnabled: boolean;
  deviceNodeRouting: boolean;
};

export type SwarmScaleDynamicConfigChange = {
  revision: number;
  changedAt: string;
  sourceSurface: SwarmScaleControlSurface;
  actorId: string | null;
  reason: string | null;
  requestedPatch: SwarmScaleDynamicConfigPatch;
  normalizedPatch: SwarmScaleNormalizedDynamicConfigPatch;
  appliedToQueuedWorkersOnly: true;
};

export type SwarmScaleDynamicConfig = {
  revision: number;
  updatedAt: string;
  updatedBy: string | null;
  sourceSurface: SwarmScaleControlSurface;
  maxConcurrency: number;
  maxSteps: number;
  executionMode: SwarmScaleExecutionMode;
  executionBackend: SwarmScaleExecutionBackendId;
  cloudSandboxEnabled: boolean;
  deviceNodeRouting: boolean;
  queuedWorkersOnly: true;
  history: SwarmScaleDynamicConfigChange[];
};

export type SwarmScaleAgentTask = {
  agentId: string;
  index: number;
  lane: 'planner' | 'researcher' | 'builder' | 'critic' | 'verifier' | 'synthesizer' | 'operator';
  title: string;
  instruction: string;
  dependencies: string[];
  status: SwarmScaleAgentStatus;
  attempts: number;
  claimedAt: string | null;
  completedAt: string | null;
  output: string | null;
  summary: string | null;
  error: string | null;
  digest: string | null;
  stepIds: string[];
  conflictKey: string | null;
  metadata: Record<string, unknown>;
};

export type SwarmScaleStep = {
  stepId: string;
  index: number;
  agentId: string | null;
  kind: SwarmScaleStepKind;
  status: SwarmScaleStepStatus;
  startedAt: string;
  completedAt: string | null;
  summary: string;
  digest: string | null;
  metadata: Record<string, unknown>;
};

export type SwarmScaleLedger = {
  maxSteps: number;
  usedSteps: number;
  remainingSteps: number;
  steps: SwarmScaleStep[];
};

export type SwarmScaleReducerConflict = {
  conflictId: string;
  key: string;
  agentIds: string[];
  severity: 'info' | 'warning' | 'critical';
  summary: string;
};

export type SwarmScaleReducerSnapshot = {
  status: 'pending' | 'ready';
  completedAgents: number;
  failedAgents: number;
  conflictCount: number;
  conflicts: SwarmScaleReducerConflict[];
  synthesis: string;
  confidence: number;
};

export type SwarmScaleSnapshot = {
  contractVersion: typeof SWARM_SCALE_PLANE_CONTRACT_VERSION;
  runId: string;
  objective: string;
  status: SwarmScaleRunStatus;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  planner: {
    mode: SwarmScalePlannerMode;
    requestedAgents: number;
    plannedAgents: number;
    maxAgents: number;
    rationale: string;
  };
  workerPool: {
    mode: SwarmScaleExecutionMode;
    maxConcurrency: number;
    actualMaxConcurrency: number;
    batchesStarted: number;
    durable: boolean;
    pauseReason: string | null;
  };
  cooperationContract: {
    isolatedContextPerAgent: true;
    noSharedMutableWorkspace: true;
    structuredOutputExpected: true;
    reducerOwnsMerge: true;
    toolCallsGoverned: true;
  };
  metrics: {
    queuedAgents: number;
    runningAgents: number;
    completedAgents: number;
    failedAgents: number;
    cancelledAgents: number;
    elapsedMs: number;
    throughputAgentsPerSecond: number;
  };
  ledger: SwarmScaleLedger;
  agents: SwarmScaleAgentTask[];
  reducer: SwarmScaleReducerSnapshot;
  dynamicConfig: SwarmScaleDynamicConfig;
};

export type SwarmScaleLaunchInput = {
  runId?: string | null;
  objective: string;
  desiredAgents?: number | null;
  maxAgents?: number | null;
  maxSteps?: number | null;
  maxConcurrency?: number | null;
  plannerMode?: SwarmScalePlannerMode | null;
  executionMode?: SwarmScaleExecutionMode | null;
  executionBackend?: SwarmScaleExecutionBackendId | null;
  cloudSandboxEnabled?: boolean | null;
  deviceNodeRouting?: boolean | null;
  stopAfterSteps?: number | null;
  persistState?: boolean | null;
  allowMutatingTools?: boolean | null;
  approvalId?: string | null;
};

export type SwarmScaleResumeInput = {
  runId: string;
  stopAfterSteps?: number | null;
  persistState?: boolean | null;
};

export type SwarmScaleConfigureInput = {
  runId: string;
  sourceSurface?: SwarmScaleControlSurface | string | null;
  actorId?: string | null;
  reason?: string | null;
  patch: SwarmScaleDynamicConfigPatch;
  persistState?: boolean | null;
};

type ScaleChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolName?: string;
  toolCalls?: Array<{ id: string; name: string; arguments: unknown }>;
};

type ScaleToolDefinition = {
  name: string;
  description?: string;
  parameters?: unknown;
};

type LlmRuntimeLike = {
  chatDetailed(
    messages: ScaleChatMessage[],
    tools: ScaleToolDefinition[],
    options: Record<string, unknown>,
  ): Promise<{
    response: {
      content?: string | null;
      toolCalls?: Array<{ id: string; name: string; arguments: unknown }> | null;
    };
    providerName?: string | null;
    modelName?: string | null;
    route?: { fallbackUsed?: boolean; attempts?: unknown[] } | null;
  }>;
};

type ToolRuntimeLike = {
  getToolDefinitions(): ScaleToolDefinition[];
  executeTool(toolName: string, args: unknown): Promise<string>;
};

export type SwarmScalePlanner = (input: {
  objective: string;
  desiredAgents: number;
  maxAgents: number;
}) => Promise<Array<Partial<SwarmScaleAgentTask>>>;

export type SwarmScaleWorker = (input: {
  snapshot: SwarmScaleSnapshot;
  task: SwarmScaleAgentTask;
  reserveStep: (kind: SwarmScaleStepKind, summary: string, metadata?: Record<string, unknown>) => SwarmScaleStep | null;
}) => Promise<SwarmScaleWorkerResult>;

export type SwarmScaleWorkerResult = {
  output: string;
  summary?: string | null;
  conflictKey?: string | null;
  metadata?: Record<string, unknown>;
};

type Runtime = {
  now?: () => Date;
  stateFilePath?: string | null;
  planner?: SwarmScalePlanner | null;
  worker?: SwarmScaleWorker | null;
  llmRuntime?: LlmRuntimeLike | null;
  toolRuntime?: ToolRuntimeLike | null;
  existsSync?: typeof fs.existsSync;
  mkdirSync?: typeof fs.mkdirSync;
  readFileSync?: typeof fs.readFileSync;
  writeFileSync?: typeof fs.writeFileSync;
};

type StoredState = {
  runs: SwarmScaleSnapshot[];
};

const MAX_SCALE_AGENTS = 4000;
const DEFAULT_MAX_CONCURRENCY = 30;
const DEFAULT_MAX_STEPS = 4000;
const ROLE_LANES: SwarmScaleAgentTask['lane'][] = [
  'planner',
  'researcher',
  'builder',
  'critic',
  'verifier',
  'operator',
  'synthesizer',
];

export class SwarmScalePlaneService {
  private readonly now: () => Date;
  private readonly stateFilePath: string | null;
  private readonly planner: SwarmScalePlanner | null;
  private readonly worker: SwarmScaleWorker | null;
  private readonly llmRuntime: LlmRuntimeLike | null;
  private readonly toolRuntime: ToolRuntimeLike | null;
  private readonly existsSyncImpl: typeof fs.existsSync;
  private readonly mkdirSyncImpl: typeof fs.mkdirSync;
  private readonly readFileSyncImpl: typeof fs.readFileSync;
  private readonly writeFileSyncImpl: typeof fs.writeFileSync;

  public constructor(runtime: Runtime = {}) {
    this.now = runtime.now || (() => new Date());
    this.stateFilePath = runtime.stateFilePath === undefined
      ? path.join(process.cwd(), '.zavorth', 'swarm-scale-plane.json')
      : runtime.stateFilePath;
    this.planner = runtime.planner || null;
    this.worker = runtime.worker || null;
    this.llmRuntime = runtime.llmRuntime || null;
    this.toolRuntime = runtime.toolRuntime || null;
    this.existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    this.mkdirSyncImpl = runtime.mkdirSync || fs.mkdirSync.bind(fs);
    this.readFileSyncImpl = runtime.readFileSync || fs.readFileSync.bind(fs);
    this.writeFileSyncImpl = runtime.writeFileSync || fs.writeFileSync.bind(fs);
  }

  public async launch(input: SwarmScaleLaunchInput): Promise<SwarmScaleSnapshot> {
    const snapshot = await this.createSnapshot(input);
    this.persistSnapshot(snapshot, input.persistState !== false);
    return this.drain(snapshot, {
      stopAfterSteps: normalizeOptionalPositiveInt(input.stopAfterSteps),
      persistState: input.persistState !== false,
      allowMutatingTools: input.allowMutatingTools === true,
      approvalId: normalizeNullable(input.approvalId),
    });
  }

  public async resume(input: SwarmScaleResumeInput): Promise<SwarmScaleSnapshot> {
    const snapshot = this.getRun(input.runId);
    if (!snapshot) {
      throw new Error(`Swarm scale run not found: ${input.runId}`);
    }
    if (snapshot.status === 'completed' || snapshot.status === 'cancelled') {
      return snapshot;
    }
    const updated = {
      ...snapshot,
      status: 'running' as const,
      updatedAt: this.now().toISOString(),
      agents: snapshot.agents.map((agent) => agent.status === 'running'
        ? { ...agent, status: 'queued' as const, claimedAt: null }
        : agent),
      workerPool: {
        ...snapshot.workerPool,
        pauseReason: null,
      },
    };
    this.persistSnapshot(updated, input.persistState !== false);
    return this.drain(updated, {
      stopAfterSteps: normalizeOptionalPositiveInt(input.stopAfterSteps),
      persistState: input.persistState !== false,
      allowMutatingTools: false,
      approvalId: null,
    });
  }

  public configureRun(input: SwarmScaleConfigureInput): SwarmScaleSnapshot {
    const current = this.getRun(input.runId);
    if (!current) {
      throw new Error(`Swarm scale run not found: ${input.runId}`);
    }
    const sourceSurface = normalizeControlSurface(input.sourceSurface);
    const actorId = normalizeNullable(input.actorId);
    const reason = normalizeNullable(input.reason);
    const patch = input.patch || {};
    const snapshot = this.ensureDynamicConfig(current);
    const normalizedPatch = this.normalizeDynamicPatch(snapshot, patch);
    const changedAt = this.now().toISOString();
    const revision = snapshot.dynamicConfig.revision + 1;
    const executionMode = normalizedPatch.executionMode;
    const maxConcurrency = normalizedPatch.maxConcurrency;
    const maxSteps = normalizedPatch.maxSteps;
    const historyEntry: SwarmScaleDynamicConfigChange = {
      revision,
      changedAt,
      sourceSurface,
      actorId,
      reason,
      requestedPatch: { ...patch },
      normalizedPatch,
      appliedToQueuedWorkersOnly: true,
    };
    const dynamicConfig: SwarmScaleDynamicConfig = {
      ...snapshot.dynamicConfig,
      revision,
      updatedAt: changedAt,
      updatedBy: actorId,
      sourceSurface,
      maxConcurrency,
      maxSteps,
      executionMode,
      executionBackend: normalizedPatch.executionBackend,
      cloudSandboxEnabled: normalizedPatch.cloudSandboxEnabled,
      deviceNodeRouting: normalizedPatch.deviceNodeRouting,
      history: [
        historyEntry,
        ...snapshot.dynamicConfig.history,
      ].slice(0, 25),
    };
    const configured = this.recompute({
      ...snapshot,
      status: snapshot.status === 'completed' || snapshot.status === 'cancelled'
        ? snapshot.status
        : snapshot.status === 'planned'
          ? 'planned'
          : 'paused',
      updatedAt: changedAt,
      workerPool: {
        ...snapshot.workerPool,
        maxConcurrency,
        mode: executionMode,
        pauseReason: patch.pauseReason === undefined
          ? snapshot.workerPool.pauseReason
          : normalizeNullable(patch.pauseReason),
      },
      ledger: {
        ...snapshot.ledger,
        maxSteps,
      },
      dynamicConfig,
    });
    this.persistSnapshot(configured, input.persistState !== false);
    return configured;
  }

  public listRuns(): SwarmScaleSnapshot[] {
    return this.readState().runs
      .map((run) => this.ensureDynamicConfig(run))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  public getRun(runId: string): SwarmScaleSnapshot | null {
    const normalized = String(runId || '').trim();
    if (!normalized) return null;
    const run = this.readState().runs.find((entry) => entry.runId === normalized) || null;
    return run ? this.ensureDynamicConfig(run) : null;
  }

  private async createSnapshot(input: SwarmScaleLaunchInput): Promise<SwarmScaleSnapshot> {
    const objective = String(input.objective || '').trim();
    if (!objective) {
      throw new Error('objective is required for SwarmScalePlaneService.');
    }
    const requestedAgents = this.resolveDesiredAgents(input);
    const maxAgents = clampInt(input.maxAgents, 1, MAX_SCALE_AGENTS, MAX_SCALE_AGENTS);
    const plannedAgents = Math.min(requestedAgents, maxAgents);
    const plannerMode = input.plannerMode || (this.planner ? 'custom' : this.llmRuntime ? 'llm' : 'heuristic');
    const runId = normalizeNullable(input.runId) || `swarm-scale:${randomUUID()}`;
    const createdAt = this.now().toISOString();
    const agents = await this.buildAgents({
      objective,
      desiredAgents: plannedAgents,
      maxAgents,
      plannerMode,
    });
    const maxSteps = clampInt(input.maxSteps, 1, DEFAULT_MAX_STEPS, Math.max(agents.length, DEFAULT_MAX_STEPS));
    const maxConcurrency = clampInt(input.maxConcurrency, 1, Math.min(MAX_SCALE_AGENTS, maxSteps), Math.min(DEFAULT_MAX_CONCURRENCY, agents.length || 1));
    const executionMode = input.executionMode || (this.worker ? 'custom' : this.llmRuntime ? 'llm-live' : 'deterministic');
    const snapshot: SwarmScaleSnapshot = {
      contractVersion: SWARM_SCALE_PLANE_CONTRACT_VERSION,
      runId,
      objective,
      status: 'planned',
      createdAt,
      updatedAt: createdAt,
      completedAt: null,
      planner: {
        mode: plannerMode,
        requestedAgents,
        plannedAgents: agents.length,
        maxAgents,
        rationale: this.describePlanner(plannerMode, objective, agents.length),
      },
      workerPool: {
        mode: executionMode,
        maxConcurrency,
        actualMaxConcurrency: 0,
        batchesStarted: 0,
        durable: this.stateFilePath !== null && input.persistState !== false,
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
        queuedAgents: agents.length,
        runningAgents: 0,
        completedAgents: 0,
        failedAgents: 0,
        cancelledAgents: 0,
        elapsedMs: 0,
        throughputAgentsPerSecond: 0,
      },
      ledger: {
        maxSteps,
        usedSteps: 0,
        remainingSteps: maxSteps,
        steps: [],
      },
      agents,
      reducer: {
        status: 'pending',
        completedAgents: 0,
        failedAgents: 0,
        conflictCount: 0,
        conflicts: [],
        synthesis: 'Reducer has not run yet.',
        confidence: 0,
      },
      dynamicConfig: {
        revision: 1,
        updatedAt: createdAt,
        updatedBy: null,
        sourceSurface: 'system',
        maxConcurrency,
        maxSteps,
        executionMode,
        executionBackend: normalizeExecutionBackend(input.executionBackend),
        cloudSandboxEnabled: input.cloudSandboxEnabled === true,
        deviceNodeRouting: input.deviceNodeRouting === true,
        queuedWorkersOnly: true,
        history: [],
      },
    };
    return this.recompute(snapshot);
  }

  private async buildAgents(input: {
    objective: string;
    desiredAgents: number;
    maxAgents: number;
    plannerMode: SwarmScalePlannerMode;
  }): Promise<SwarmScaleAgentTask[]> {
    if (this.planner) {
      const custom = await this.planner(input);
      return this.normalizePlannerTasks(custom, input);
    }
    if (input.plannerMode === 'llm' && this.llmRuntime) {
      const planned = await this.tryLlmPlanner(input);
      if (planned.length > 0) {
        return planned;
      }
    }
    return this.buildHeuristicAgents(input.objective, input.desiredAgents);
  }

  private async tryLlmPlanner(input: {
    objective: string;
    desiredAgents: number;
    maxAgents: number;
  }): Promise<SwarmScaleAgentTask[]> {
    try {
      const result = await this.llmRuntime?.chatDetailed([
        {
          role: 'system',
          content: [
            'You are the Zavorth Swarm Scale planner.',
            'Return compact JSON only.',
            'Schema: {"lanes":[{"lane":"researcher","title":"...","instruction":"..."}]}',
            'Create reusable lane templates, not thousands of full prompts.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: [
            `Objective: ${input.objective}`,
            `Desired agents: ${input.desiredAgents}`,
            'Generate enough diverse lane templates for a large dynamic swarm.',
          ].join('\n'),
        },
      ], [], {
        telemetry: {
          surface: 'swarm-scale-plane',
          kind: 'planner',
        },
      });
      const parsed = parseJsonObject(String(result?.response?.content || ''));
      const lanes = Array.isArray(parsed?.lanes) ? parsed.lanes : [];
      const templates = lanes
        .map((entry: unknown) => normalizePlannerTemplate(entry))
        .filter((entry): entry is { lane: SwarmScaleAgentTask['lane']; title: string; instruction: string } => Boolean(entry));
      if (templates.length === 0) return [];
      return Array.from({ length: input.desiredAgents }, (_, index) => {
        const template = templates[index % templates.length];
        return this.createAgentTask({
          index,
          objective: input.objective,
          lane: template.lane,
          title: `${template.title} ${index + 1}`,
          instruction: `${template.instruction}\nShard: ${index + 1}/${input.desiredAgents}.`,
        });
      });
    } catch (error: any) { const err = error; const e = error; logger.warn('[Swarm Scale Plane] creation failed', error); return []; }
  }

  private normalizePlannerTasks(
    tasks: Array<Partial<SwarmScaleAgentTask>>,
    input: { objective: string; desiredAgents: number },
  ): SwarmScaleAgentTask[] {
    const limited = tasks.slice(0, input.desiredAgents);
    if (limited.length === 0) {
      return this.buildHeuristicAgents(input.objective, input.desiredAgents);
    }
    return limited.map((task, index) => this.createAgentTask({
      index,
      objective: input.objective,
      lane: normalizeLane(task.lane),
      title: String(task.title || `${normalizeLane(task.lane)} shard ${index + 1}`),
      instruction: String(task.instruction || `Work on shard ${index + 1} of: ${input.objective}`),
      dependencies: Array.isArray(task.dependencies) ? task.dependencies.map(String) : [],
      metadata: task.metadata && typeof task.metadata === 'object' ? task.metadata : {},
    }));
  }

  private buildHeuristicAgents(objective: string, desiredAgents: number): SwarmScaleAgentTask[] {
    return Array.from({ length: desiredAgents }, (_, index) => {
      const lane = ROLE_LANES[index % ROLE_LANES.length];
      const shard = index + 1;
      return this.createAgentTask({
        index,
        objective,
        lane,
        title: `${labelForLane(lane)} ${shard}`,
        instruction: [
          `Shard ${shard}/${desiredAgents} for objective: ${objective}`,
          `Act as ${labelForLane(lane)}.`,
          'Return isolated findings, risks, artifact notes and a recommended next step.',
        ].join('\n'),
      });
    });
  }

  private createAgentTask(input: {
    index: number;
    objective: string;
    lane: SwarmScaleAgentTask['lane'];
    title: string;
    instruction: string;
    dependencies?: string[];
    metadata?: Record<string, unknown>;
  }): SwarmScaleAgentTask {
    const agentId = `agent-${String(input.index + 1).padStart(4, '0')}`;
    return {
      agentId,
      index: input.index,
      lane: input.lane,
      title: input.title,
      instruction: input.instruction,
      dependencies: input.dependencies || [],
      status: 'queued',
      attempts: 0,
      claimedAt: null,
      completedAt: null,
      output: null,
      summary: null,
      error: null,
      digest: null,
      stepIds: [],
      conflictKey: null,
      metadata: {
        objectiveDigest: digest(input.objective),
        ...(input.metadata || {}),
      },
    };
  }

  private async drain(
    inputSnapshot: SwarmScaleSnapshot,
    options: {
      stopAfterSteps: number | null;
      persistState: boolean;
      allowMutatingTools: boolean;
      approvalId: string | null;
    },
  ): Promise<SwarmScaleSnapshot> {
    let snapshot = this.recompute({
      ...inputSnapshot,
      status: 'running',
      updatedAt: this.now().toISOString(),
    });
    const startedMs = Date.parse(snapshot.createdAt) || Date.now();

    while (snapshot.agents.some((agent) => agent.status === 'queued')) {
      const stopAt = options.stopAfterSteps;
      if (stopAt !== null && snapshot.ledger.usedSteps >= stopAt) {
        snapshot = this.pause(snapshot, `Paused after ${stopAt} global step(s).`);
        this.persistSnapshot(snapshot, options.persistState);
        return snapshot;
      }
      if (snapshot.ledger.remainingSteps <= 0) {
        snapshot = this.pause(snapshot, 'Global swarm step ledger exhausted.');
        this.persistSnapshot(snapshot, options.persistState);
        return snapshot;
      }

      const remainingBeforeStop = stopAt === null ? snapshot.ledger.remainingSteps : Math.max(0, stopAt - snapshot.ledger.usedSteps);
      const batchSize = Math.min(
        snapshot.workerPool.maxConcurrency,
        remainingBeforeStop,
        snapshot.ledger.remainingSteps,
        snapshot.agents.filter((agent) => agent.status === 'queued').length,
      );
      if (batchSize <= 0) {
        snapshot = this.pause(snapshot, 'No step budget available for the next worker batch.');
        this.persistSnapshot(snapshot, options.persistState);
        return snapshot;
      }

      const selectedIds = snapshot.agents
        .filter((agent) => agent.status === 'queued')
        .slice(0, batchSize)
        .map((agent) => agent.agentId);
      const claimedAt = this.now().toISOString();
      snapshot = {
        ...snapshot,
        workerPool: {
          ...snapshot.workerPool,
          batchesStarted: snapshot.workerPool.batchesStarted + 1,
          actualMaxConcurrency: Math.max(snapshot.workerPool.actualMaxConcurrency, selectedIds.length),
        },
        agents: snapshot.agents.map((agent) => selectedIds.includes(agent.agentId)
          ? { ...agent, status: 'running' as const, attempts: agent.attempts + 1, claimedAt }
          : agent),
      };
      snapshot = this.recompute(snapshot);
      this.persistSnapshot(snapshot, options.persistState);

      const results = await Promise.all(selectedIds.map(async (agentId) => {
        const task = snapshot.agents.find((agent) => agent.agentId === agentId);
        if (!task) return null;
        return this.executeAgentTask(snapshot, task, options);
      }));
      const updates = new Map(results.filter(Boolean).map((agent) => [agent!.agentId, agent!]));
      snapshot = {
        ...snapshot,
        updatedAt: this.now().toISOString(),
        agents: snapshot.agents.map((agent) => updates.get(agent.agentId) || agent),
      };
      snapshot = this.recompute(snapshot, startedMs);
      this.persistSnapshot(snapshot, options.persistState);
    }

    const completedAt = this.now().toISOString();
    snapshot = this.recompute({
      ...snapshot,
      status: snapshot.agents.some((agent) => agent.status === 'failed') ? 'failed' : 'completed',
      updatedAt: completedAt,
      completedAt,
      reducer: this.reduce(snapshot),
    }, startedMs);
    this.persistSnapshot(snapshot, options.persistState);
    return snapshot;
  }

  private async executeAgentTask(
    snapshot: SwarmScaleSnapshot,
    task: SwarmScaleAgentTask,
    options: { allowMutatingTools: boolean; approvalId: string | null },
  ): Promise<SwarmScaleAgentTask> {
    const completedAt = this.now().toISOString();
    try {
      const reserveStep = (kind: SwarmScaleStepKind, summary: string, metadata: Record<string, unknown> = {}) => {
        return this.reserveStep(snapshot, task.agentId, kind, summary, metadata);
      };
      const result = this.worker
        ? await this.worker({ snapshot, task, reserveStep })
        : snapshot.workerPool.mode === 'llm-live' && this.llmRuntime
          ? await this.runLlmAgent(snapshot, task, reserveStep, options)
          : await this.runDeterministicAgent(snapshot, task, reserveStep);
      const output = clampText(result.output, 12000);
      const conflictKey = result.conflictKey || detectConflictKey(output);
      return {
        ...task,
        status: 'completed',
        completedAt,
        output,
        summary: result.summary || firstLine(output),
        error: null,
        digest: digest(output),
        conflictKey,
        metadata: {
          ...task.metadata,
          ...(result.metadata || {}),
        },
      };
    } catch (error: any) { const err = error; const e = error;
    logger.warn('[Swarm Scale Plane] filesystem check failed', error);
    return {
        ...task,
        status: 'failed',
        completedAt,
        output: null,
        summary: null,
        error: error instanceof Error ? error.message : String(error),
        digest: null,
      };
  }
  }

  private async runDeterministicAgent(
    snapshot: SwarmScaleSnapshot,
    task: SwarmScaleAgentTask,
    reserveStep: (kind: SwarmScaleStepKind, summary: string, metadata?: Record<string, unknown>) => SwarmScaleStep | null,
  ): Promise<SwarmScaleWorkerResult> {
    const step = reserveStep('agent_execution', `${task.agentId} deterministic execution.`, {
      lane: task.lane,
      executionBackend: snapshot.dynamicConfig.executionBackend,
      cloudSandboxEnabled: snapshot.dynamicConfig.cloudSandboxEnabled,
      deviceNodeRouting: snapshot.dynamicConfig.deviceNodeRouting,
    });
    if (!step) {
      throw new Error('Global step ledger exhausted before deterministic agent execution.');
    }
    this.completeStep(step, 'completed', `${task.agentId} completed deterministic shard.`, digest(task.instruction));
    const output = [
      `Agent: ${task.agentId}`,
      `Lane: ${task.lane}`,
      `Title: ${task.title}`,
      'Findings:',
      `- Processed isolated shard ${task.index + 1}.`,
      `- Instruction digest ${digest(task.instruction).slice(0, 12)}.`,
      'Risks:',
      '- No workspace mutation was performed.',
      'Recommended next step:',
      '- Feed this shard into the reducer for conflict detection and synthesis.',
    ].join('\n');
    return {
      output,
      summary: `${task.agentId} completed ${task.lane} shard.`,
      conflictKey: null,
      metadata: {
        backend: 'deterministic-scale-worker',
        executionBackend: snapshot.dynamicConfig.executionBackend,
        cloudSandboxEnabled: snapshot.dynamicConfig.cloudSandboxEnabled,
        deviceNodeRouting: snapshot.dynamicConfig.deviceNodeRouting,
      },
    };
  }

  private async runLlmAgent(
    snapshot: SwarmScaleSnapshot,
    task: SwarmScaleAgentTask,
    reserveStep: (kind: SwarmScaleStepKind, summary: string, metadata?: Record<string, unknown>) => SwarmScaleStep | null,
    options: { allowMutatingTools: boolean; approvalId: string | null },
  ): Promise<SwarmScaleWorkerResult> {
    const llmStep = reserveStep('llm_call', `${task.agentId} provider reasoning call.`, {
      lane: task.lane,
    });
    if (!llmStep) {
      throw new Error('Global step ledger exhausted before LLM worker call.');
    }
    const tools = this.selectTools(options);
    const messages: ScaleChatMessage[] = [
      {
        role: 'system',
        content: [
          'You are a real Zavorth swarm subagent.',
          'You receive isolated context and must not mutate shared state directly.',
          'Use tools only when they are exposed by policy. Return structured findings, risks and next step.',
          'If you discover contradictory evidence, include a line starting with CONFLICT: <short key>.',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          `Global run: ${snapshot.runId}`,
          `Agent: ${task.agentId}`,
          `Lane: ${task.lane}`,
          `Objective: ${snapshot.objective}`,
          `Instruction: ${task.instruction}`,
        ].join('\n'),
      },
    ];
    let result = await this.llmRuntime!.chatDetailed(messages, tools, {
      telemetry: {
        surface: 'swarm-scale-plane',
        runId: snapshot.runId,
        agentId: task.agentId,
      },
      toolPolicy: {
        mode: options.allowMutatingTools && options.approvalId ? 'approved_mutation' : 'readonly',
        approvalId: options.approvalId,
        exposedTools: tools.map((tool) => tool.name),
      },
    });
    this.completeStep(llmStep, 'completed', `${task.agentId} provider call completed.`, digest(String(result.response.content || '')));

    let toolCalls = result.response.toolCalls || [];
    let toolCallsExecuted = 0;
    while (toolCalls.length > 0 && this.toolRuntime && toolCallsExecuted < 8) {
      const toolMessages: ScaleChatMessage[] = [];
      for (const toolCall of toolCalls.slice(0, 8 - toolCallsExecuted)) {
        const toolStep = reserveStep('tool_call', `${task.agentId} tool ${toolCall.name}.`, {
          toolName: toolCall.name,
        });
        if (!toolStep) {
          toolMessages.push({
            role: 'tool',
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            content: 'Global swarm step ledger exhausted. Tool call was not executed.',
          });
          continue;
        }
        if (!this.isToolAllowed(toolCall.name, options)) {
          this.completeStep(toolStep, 'skipped', `${toolCall.name} blocked by swarm tool policy.`, null);
          toolMessages.push({
            role: 'tool',
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            content: `Blocked by Swarm Scale policy: ${toolCall.name}`,
          });
          continue;
        }
        try {
          const toolOutput = await this.toolRuntime.executeTool(toolCall.name, toolCall.arguments);
          toolCallsExecuted += 1;
          this.completeStep(toolStep, 'completed', `${toolCall.name} executed.`, digest(toolOutput));
          toolMessages.push({
            role: 'tool',
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            content: clampText(toolOutput, 6000),
          });
        } catch (error: any) { const err = error; const e = error;
          this.completeStep(toolStep, 'failed', `${toolCall.name} failed.`, null);
          toolMessages.push({
            role: 'tool',
            toolCallId: toolCall.id,
            toolName: toolCall.name,
            content: `Tool failed: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      }
      messages.push({
        role: 'assistant',
        content: String(result.response.content || ''),
        toolCalls,
      });
      messages.push(...toolMessages);
      const nextStep = reserveStep('llm_call', `${task.agentId} provider follow-up after tools.`, {
        lane: task.lane,
        toolMessages: toolMessages.length,
      });
      if (!nextStep) break;
      result = await this.llmRuntime!.chatDetailed(messages, tools, {
        telemetry: {
          surface: 'swarm-scale-plane',
          runId: snapshot.runId,
          agentId: task.agentId,
          phase: 'tool-follow-up',
        },
      });
      this.completeStep(nextStep, 'completed', `${task.agentId} provider follow-up completed.`, digest(String(result.response.content || '')));
      toolCalls = result.response.toolCalls || [];
    }

    const output = String(result.response.content || '').trim() || 'LLM worker completed with an empty response.';
    return {
      output,
      summary: `${task.agentId} completed through ${result.providerName || 'llm-runtime'}.`,
      conflictKey: detectConflictKey(output),
      metadata: {
        backend: 'llm-live-scale-worker',
        executionBackend: snapshot.dynamicConfig.executionBackend,
        cloudSandboxEnabled: snapshot.dynamicConfig.cloudSandboxEnabled,
        deviceNodeRouting: snapshot.dynamicConfig.deviceNodeRouting,
        providerName: result.providerName || null,
        modelName: result.modelName || null,
        toolCallsExecuted,
        fallbackUsed: result.route?.fallbackUsed || false,
      },
    };
  }

  private reserveStep(
    snapshot: SwarmScaleSnapshot,
    agentId: string | null,
    kind: SwarmScaleStepKind,
    summary: string,
    metadata: Record<string, unknown>,
  ): SwarmScaleStep | null {
    if (snapshot.ledger.usedSteps >= snapshot.ledger.maxSteps) {
      return null;
    }
    const startedAt = this.now().toISOString();
    const step: SwarmScaleStep = {
      stepId: `step-${String(snapshot.ledger.usedSteps + 1).padStart(5, '0')}`,
      index: snapshot.ledger.usedSteps,
      agentId,
      kind,
      status: 'running',
      startedAt,
      completedAt: null,
      summary,
      digest: null,
      metadata,
    };
    snapshot.ledger.steps.push(step);
    snapshot.ledger.usedSteps += 1;
    snapshot.ledger.remainingSteps = Math.max(0, snapshot.ledger.maxSteps - snapshot.ledger.usedSteps);
    if (agentId) {
      const agent = snapshot.agents.find((entry) => entry.agentId === agentId);
      agent?.stepIds.push(step.stepId);
    }
    return step;
  }

  private completeStep(step: SwarmScaleStep, status: SwarmScaleStepStatus, summary: string, outputDigest: string | null): void {
    step.status = status;
    step.summary = summary;
    step.completedAt = this.now().toISOString();
    step.digest = outputDigest;
  }

  private reduce(snapshot: SwarmScaleSnapshot): SwarmScaleReducerSnapshot {
    const completed = snapshot.agents.filter((agent) => agent.status === 'completed');
    const failed = snapshot.agents.filter((agent) => agent.status === 'failed');
    const conflicts = this.detectConflicts(completed);
    const reducerStep = this.reserveStep(snapshot, null, 'reducer', 'Reducer synthesis and conflict detection.', {
      completedAgents: completed.length,
      failedAgents: failed.length,
      conflictCount: conflicts.length,
    });
    if (reducerStep) {
      this.completeStep(reducerStep, 'completed', 'Reducer synthesis completed.', digest(`${completed.length}:${failed.length}:${conflicts.length}`));
    }
    const confidence = Math.max(0, Math.min(1, (completed.length / Math.max(1, snapshot.agents.length)) - conflicts.length * 0.03));
    return {
      status: 'ready',
      completedAgents: completed.length,
      failedAgents: failed.length,
      conflictCount: conflicts.length,
      conflicts,
      synthesis: [
        `Swarm Scale Plane completed ${completed.length}/${snapshot.agents.length} agent(s).`,
        `Global steps used ${snapshot.ledger.usedSteps}/${snapshot.ledger.maxSteps}.`,
        conflicts.length > 0
          ? `Reducer found ${conflicts.length} conflict(s) that need operator or verifier review.`
          : 'Reducer found no structured conflicts.',
      ].join(' '),
      confidence,
    };
  }

  private detectConflicts(agents: SwarmScaleAgentTask[]): SwarmScaleReducerConflict[] {
    const groups = new Map<string, SwarmScaleAgentTask[]>();
    for (const agent of agents) {
      if (!agent.conflictKey) continue;
      const current = groups.get(agent.conflictKey) || [];
      current.push(agent);
      groups.set(agent.conflictKey, current);
    }
    return Array.from(groups.entries())
      .filter(([, entries]) => new Set(entries.map((entry) => entry.digest)).size > 1)
      .map(([key, entries], index) => ({
        conflictId: `conflict-${index + 1}`,
        key,
        agentIds: entries.map((entry) => entry.agentId),
        severity: entries.length >= 4 ? 'critical' : 'warning',
        summary: `Conflicting outputs for ${key} across ${entries.length} agent(s).`,
      }));
  }

  private selectTools(options: { allowMutatingTools: boolean; approvalId: string | null }): ScaleToolDefinition[] {
    if (!this.toolRuntime) return [];
    const readonlyTools = new Set(['read_file', 'list_directory', 'workspace.read', 'workspace.list', 'web_search', 'get_datetime', 'action.schema.lookup', 'action.preview']);
    const definitions = this.toolRuntime.getToolDefinitions();
    if (options.allowMutatingTools && options.approvalId) {
      return definitions.slice(0, 24);
    }
    return definitions.filter((tool) => readonlyTools.has(tool.name)).slice(0, 12);
  }

  private isToolAllowed(toolName: string, options: { allowMutatingTools: boolean; approvalId: string | null }): boolean {
    if (options.allowMutatingTools && options.approvalId) return true;
    return new Set(['read_file', 'list_directory', 'workspace.read', 'workspace.list', 'web_search', 'get_datetime', 'action.schema.lookup', 'action.preview']).has(toolName);
  }

  private pause(snapshot: SwarmScaleSnapshot, reason: string): SwarmScaleSnapshot {
    return this.recompute({
      ...snapshot,
      status: 'paused',
      updatedAt: this.now().toISOString(),
      workerPool: {
        ...snapshot.workerPool,
        pauseReason: reason,
      },
      agents: snapshot.agents.map((agent) => agent.status === 'running'
        ? { ...agent, status: 'queued' as const, claimedAt: null }
        : agent),
    });
  }

  private recompute(snapshot: SwarmScaleSnapshot, startedMs?: number): SwarmScaleSnapshot {
    const queuedAgents = snapshot.agents.filter((agent) => agent.status === 'queued').length;
    const runningAgents = snapshot.agents.filter((agent) => agent.status === 'running').length;
    const completedAgents = snapshot.agents.filter((agent) => agent.status === 'completed').length;
    const failedAgents = snapshot.agents.filter((agent) => agent.status === 'failed').length;
    const cancelledAgents = snapshot.agents.filter((agent) => agent.status === 'cancelled').length;
    const start = startedMs || Date.parse(snapshot.createdAt) || Date.now();
    const elapsedMs = Math.max(0, Date.now() - start);
    return {
      ...snapshot,
      metrics: {
        queuedAgents,
        runningAgents,
        completedAgents,
        failedAgents,
        cancelledAgents,
        elapsedMs,
        throughputAgentsPerSecond: elapsedMs > 0 ? Number((completedAgents / (elapsedMs / 1000)).toFixed(2)) : completedAgents,
      },
      ledger: {
        ...snapshot.ledger,
        remainingSteps: Math.max(0, snapshot.ledger.maxSteps - snapshot.ledger.usedSteps),
      },
    };
  }

  private resolveDesiredAgents(input: SwarmScaleLaunchInput): number {
    if (input.desiredAgents !== undefined && input.desiredAgents !== null) {
      return clampInt(input.desiredAgents, 1, MAX_SCALE_AGENTS, 1);
    }
    const objective = String(input.objective || '').toLowerCase();
    if (/\b(huge|massive|gigante|monorepo|empresa inteira|toda a base|profunda|deep)\b/.test(objective)) return 80;
    if (/\b(auditoria|refator|migrar|comparar|pesquisa|research|sistema)\b/.test(objective)) return 20;
    return 4;
  }

  private describePlanner(mode: SwarmScalePlannerMode, objective: string, plannedAgents: number): string {
    if (mode === 'custom') return `Custom planner produced ${plannedAgents} isolated agent task(s).`;
    if (mode === 'llm') return `LLM planner decomposed objective into ${plannedAgents} generated shard(s), with heuristic fallback if needed.`;
    return `Heuristic planner decomposed "${firstLine(objective)}" into ${plannedAgents} deterministic shard(s).`;
  }

  private ensureDynamicConfig(snapshot: SwarmScaleSnapshot): SwarmScaleSnapshot {
    if (snapshot.dynamicConfig) {
      return snapshot;
    }
    const executionMode = snapshot.workerPool.mode;
    return {
      ...snapshot,
      dynamicConfig: {
        revision: 1,
        updatedAt: snapshot.updatedAt || snapshot.createdAt,
        updatedBy: null,
        sourceSurface: 'system',
        maxConcurrency: snapshot.workerPool.maxConcurrency,
        maxSteps: snapshot.ledger.maxSteps,
        executionMode,
        executionBackend: 'auto',
        cloudSandboxEnabled: false,
        deviceNodeRouting: false,
        queuedWorkersOnly: true,
        history: [],
      },
    };
  }

  private normalizeDynamicPatch(
    snapshot: SwarmScaleSnapshot,
    patch: SwarmScaleDynamicConfigPatch,
  ): SwarmScaleNormalizedDynamicConfigPatch {
    const requestedMaxSteps = patch.maxSteps === undefined || patch.maxSteps === null
      ? snapshot.ledger.maxSteps
      : Number(patch.maxSteps);
    const maxSteps = Number.isFinite(requestedMaxSteps)
      ? Math.max(snapshot.ledger.usedSteps, Math.trunc(requestedMaxSteps))
      : snapshot.ledger.maxSteps;
    const maxConcurrency = clampInt(
      patch.maxConcurrency,
      1,
      Math.max(1, Math.min(MAX_SCALE_AGENTS, maxSteps || 1)),
      snapshot.workerPool.maxConcurrency,
    );
    return {
      maxConcurrency,
      maxSteps,
      executionMode: normalizeExecutionMode(patch.executionMode, snapshot.workerPool.mode),
      executionBackend: normalizeExecutionBackend(patch.executionBackend ?? snapshot.dynamicConfig.executionBackend),
      cloudSandboxEnabled: patch.cloudSandboxEnabled === undefined || patch.cloudSandboxEnabled === null
        ? snapshot.dynamicConfig.cloudSandboxEnabled
        : patch.cloudSandboxEnabled === true,
      deviceNodeRouting: patch.deviceNodeRouting === undefined || patch.deviceNodeRouting === null
        ? snapshot.dynamicConfig.deviceNodeRouting
        : patch.deviceNodeRouting === true,
    };
  }

  private readState(): StoredState {
    if (!this.stateFilePath || !this.existsSyncImpl(this.stateFilePath)) {
      return { runs: [] };
    }
    try {
      const parsed = JSON.parse(this.readFileSyncImpl(this.stateFilePath, 'utf8'));
      return {
        runs: Array.isArray(parsed?.runs) ? parsed.runs : [],
      };
    } catch (error: any) { const err = error; const e = error;
    logger.warn('[Swarm Scale Plane] JSON parse failed', error);
    return { runs: [] };
  }
  }

  private persistSnapshot(snapshot: SwarmScaleSnapshot, persistState: boolean): void {
    if (!persistState || !this.stateFilePath) return;
    const state = this.readState();
    const index = state.runs.findIndex((run) => run.runId === snapshot.runId);
    if (index >= 0) {
      state.runs[index] = snapshot;
    } else {
      state.runs.push(snapshot);
    }
    this.mkdirSyncImpl(path.dirname(this.stateFilePath), { recursive: true });
    this.writeFileSyncImpl(this.stateFilePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  }
}

function normalizePlannerTemplate(value: unknown): { lane: SwarmScaleAgentTask['lane']; title: string; instruction: string } | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const title = String(record.title || '').trim();
  const instruction = String(record.instruction || '').trim();
  if (!title || !instruction) return null;
  return {
    lane: normalizeLane(record.lane),
    title,
    instruction,
  };
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch (error: any) { const err = error; const e = error;
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (error: any) { const err = error; const e = error; logger.warn('[Swarm Scale Plane] JSON parse failed', error); return null; }
  }
}

function normalizeLane(value: unknown): SwarmScaleAgentTask['lane'] {
  const normalized = String(value || '').trim().toLowerCase();
  return ROLE_LANES.includes(normalized as SwarmScaleAgentTask['lane'])
    ? normalized as SwarmScaleAgentTask['lane']
    : 'researcher';
}

function labelForLane(lane: SwarmScaleAgentTask['lane']): string {
  return lane.split('-').map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`).join(' ');
}

function normalizeNullable(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeControlSurface(value: unknown): SwarmScaleControlSurface {
  const normalized = String(value || '').trim().toLowerCase();
  if (['cli', 'tui', 'desktop', 'zavorthControl', 'api', 'agent', 'system'].includes(normalized)) {
    return normalized as SwarmScaleControlSurface;
  }
  return 'api';
}

function normalizeExecutionMode(value: unknown, fallback: SwarmScaleExecutionMode): SwarmScaleExecutionMode {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'deterministic' || normalized === 'llm-live' || normalized === 'custom') {
    return normalized;
  }
  return fallback;
}

function normalizeExecutionBackend(value: unknown): SwarmScaleExecutionBackendId {
  const normalized = String(value || '').trim().toLowerCase();
  if (
    normalized === 'local'
    || normalized === 'docker'
    || normalized === 'ssh'
    || normalized === 'wsl'
    || normalized === 'vercel-sandbox'
    || normalized === 'modal'
    || normalized === 'daytona'
    || normalized === 'singularity'
  ) {
    return normalized;
  }
  return 'auto';
}

function normalizeOptionalPositiveInt(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function firstLine(value: string): string {
  return String(value || '').split(/\r?\n/)[0]?.trim().slice(0, 240) || 'n/d';
}

function clampText(value: string, maxChars: number): string {
  const text = String(value || '');
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(0, maxChars - 20)).trim()}\n[truncated]`;
}

function detectConflictKey(output: string): string | null {
  const match = output.match(/^\s*CONFLICT\s*:\s*([^\r\n]+)/im);
  return match?.[1]?.trim().slice(0, 120) || null;
}
