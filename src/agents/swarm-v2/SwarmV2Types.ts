import type {
  SwarmOrchestrator,
  SwarmRole,
  SwarmSnapshot,
} from '../../runtime/sessions/v2/SwarmOrchestrator.js';
import type {
  SubagentBudgetInput,
  SubagentResultReceipt,
} from '../../runtime/agent/subagents/index.js';

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

export type ExperimentalSwarmV2CreateInput = SwarmV2CreateInput;

/** Internal managed swarm entry (package-private). */
export type ManagedSwarm = {
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

/** Internal official run state (package-private). */
export type SwarmV2OfficialState = {
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

export interface SwarmOrchestratorRoleStartedEvent {
  swarmId: string;
  roleId: string;
  label: string;
}

export interface SwarmOrchestratorRoleDataEvent {
  swarmId: string;
  roleId: string;
  data: string;
}

export interface SwarmOrchestratorRoleFinishedEvent {
  swarmId: string;
  roleId: string;
  status: string;
  exitCode: number | null;
}

export interface RawToolSpecInput {
  id?: unknown;
  command?: unknown;
  label?: unknown;
  args?: unknown;
  cwd?: unknown;
  risk?: unknown;
  requiresApproval?: unknown;
  [key: string]: unknown;
}

export interface RawRoleLibraryEntry {
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
