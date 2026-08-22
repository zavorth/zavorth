import type {
  SwarmOrchestrator,
  SwarmRole,
  SwarmSnapshot,
} from '../runtime/sessions/v2/SwarmOrchestrator.js';
import type {
  SubagentBudgetInput,
  SubagentResultReceipt,
} from '../runtime/agent/subagents/index.js';

export const ZAVORTH_ENSEMBLE_OFFICIAL_CONTRACT_VERSION = '2026-05-17.official-zavorth-ensemble' as const;

export type ZavorthEnsembleIsolationMode = 'direct' | 'temp-worktree' | 'docker' | 'wsl' | 'external-sandbox';

export type ZavorthEnsembleToolSpec = {
  id: string;
  kind: 'shell';
  label: string;
  command: string;
  args?: string[];
  cwd?: string | null;
  risk?: 'safe' | 'attention' | 'danger';
  requiresApproval?: boolean;
};

export type SwarmRoleStartedEvent = {
  roleId: string;
  label?: string;
};

export type SwarmRoleDataEvent = {
  roleId: string;
  data?: string;
};

export type SwarmRoleFinishedEvent = {
  roleId: string;
  status?: string;
  exitCode?: number;
};

export type LlmRuntimeChatOptions = {
  allowFallback?: boolean;
  telemetry?: {
    surface: string;
    runId: string;
    traceId: string;
  };
};

export type ToolSpecRawInput = {
  id?: unknown;
  command?: unknown;
  risk?: unknown;
  label?: unknown;
  args?: unknown;
  cwd?: unknown;
  requiresApproval?: unknown;
};

export type ZavorthEnsembleRoleSelectionSnapshot = {
  mode: 'manual' | 'heuristic' | 'llm';
  requestedRoleCount: number;
  selectedRoleIds: string[];
  availableRoleCount: number;
  rationale: string;
};

export type ZavorthEnsembleBenchmarkSnapshot = {
  enabled: boolean;
  baseline: 'estimated-serial' | 'not-requested';
  elapsedMs: number;
  estimatedSerialMs: number;
  speedup: number;
  throughputRolesPerSecond: number;
  failureRate: number;
  qualityScore: number;
};

export type ZavorthEnsembleTokenBudgetInput = {
  maxLlmCalls?: number | null;
  maxEstimatedTokens?: number | null;
  maxEstimatedUsd?: number | null;
  modelClass?: 'cheap' | 'standard' | 'premium' | null;
  approved?: boolean | null;
  allowHighCost?: boolean | null;
};

export type ZavorthEnsembleTokenBudgetSnapshot = {
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

export type ZavorthEnsembleRoleLibraryEntry = {
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

export type ZavorthEnsembleReplayEvent = {
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

export type ZavorthEnsembleReplayInsights = {
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

export type ZavorthEnsembleBatchSnapshot = {
  batchId: string;
  index: number;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  roleIds: string[];
  maxConcurrency: number;
  startedAt: string | null;
  finishedAt: string | null;
};

export type ZavorthEnsembleParallelMetrics = {
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

export type ZavorthEnsembleOfficialSurface = {
  official: true;
  experimental: false;
  contractVersion: typeof ZAVORTH_ENSEMBLE_OFFICIAL_CONTRACT_VERSION;
  queue: {
    mode: 'batch-queue';
    status: 'queued' | 'running' | 'draining' | 'completed' | 'cancelled' | 'failed';
    maxRoles: number;
    maxConcurrency: number;
    pendingBatchIds: string[];
  };
  batches: ZavorthEnsembleBatchSnapshot[];
  replay: {
    eventCount: number;
    events: ZavorthEnsembleReplayEvent[];
  };
  replayInsights: ZavorthEnsembleReplayInsights;
  metrics: ZavorthEnsembleParallelMetrics;
  roleLibrary: {
    persistent: true;
    selectedRoleIds: string[];
    availableRoleCount: number;
  };
  isolation: {
    mode: ZavorthEnsembleIsolationMode;
    workersIsolated: boolean;
    workerRoots: Array<{ roleId: string; cwd: string; mode: ZavorthEnsembleIsolationMode }>;
    note: string;
  };
  synthesis: {
    mode: 'deterministic' | 'llm';
    status: 'pending' | 'completed' | 'failed';
    summary: string;
  };
  roleSelection: ZavorthEnsembleRoleSelectionSnapshot;
  toolExecution: {
    plannedToolCount: number;
    executedToolCount: number;
    commandToolCount: number;
    approvalRequiredToolCount: number;
    toolIds: string[];
  };
  benchmark: ZavorthEnsembleBenchmarkSnapshot;
  tokenBudget: ZavorthEnsembleTokenBudgetSnapshot;
  strongIsolation: {
    required: boolean;
    satisfied: boolean;
    mode: ZavorthEnsembleIsolationMode;
    wrapper: 'none' | 'docker' | 'wsl' | 'external-sandbox';
    note: string;
  };
};

export type ZavorthEnsembleCreateInput = {
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
  isolationMode?: ZavorthEnsembleIsolationMode | null;
  isolationImage?: string | null;
  wslDistro?: string | null;
  requireStrongIsolation?: boolean | null;
  autoSelectRoles?: boolean | null;
  desiredRoleCount?: number | null;
  benchmark?: boolean | null;
  toolSpecs?: ZavorthEnsembleToolSpec[] | null;
  tokenBudget?: ZavorthEnsembleTokenBudgetInput | null;
  roleSelectionOverride?: ZavorthEnsembleRoleSelectionSnapshot | null;
};

export type ZavorthEnsembleTrackedSnapshot = SwarmSnapshot & { swarmId: string; createdAt: string } & Partial<ZavorthEnsembleOfficialSurface>;

export type ManagedSwarm = {
  swarmId: string;
  orchestrator: SwarmOrchestrator | null;
  roles: SwarmRole[];
  subagentReceipts: SubagentResultReceipt[];
  subagentBudget: SubagentBudgetInput | null;
  lastSnapshot: SwarmSnapshot;
  createdAt: string;
  execution: Promise<SwarmSnapshot>;
  officialState?: ZavorthEnsembleOfficialState;
};

export type ZavorthEnsembleOfficialState = {
  swarmId: string;
  objective: string;
  createdAt: string;
  roles: SwarmRole[];
  selectedRoleIds: string[];
  queueStatus: ZavorthEnsembleOfficialSurface['queue']['status'];
  maxRoles: number;
  maxConcurrency: number;
  batches: ZavorthEnsembleBatchSnapshot[];
  replay: ZavorthEnsembleReplayEvent[];
  isolationMode: ZavorthEnsembleIsolationMode;
  workerRoots: Array<{ roleId: string; cwd: string; mode: ZavorthEnsembleIsolationMode }>;
  synthesisStatus: ZavorthEnsembleOfficialSurface['synthesis']['status'];
  synthesisMode: ZavorthEnsembleOfficialSurface['synthesis']['mode'];
  synthesisSummary: string;
  startedAt: string;
  roleSelection: ZavorthEnsembleRoleSelectionSnapshot;
  toolSpecs: ZavorthEnsembleToolSpec[];
  benchmarkEnabled: boolean;
  tokenBudget: ZavorthEnsembleTokenBudgetSnapshot;
  strongIsolationRequired: boolean;
  strongIsolationSatisfied: boolean;
  strongIsolationWrapper: ZavorthEnsembleOfficialSurface['strongIsolation']['wrapper'];
};
