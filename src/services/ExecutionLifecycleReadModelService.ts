import type {
  ZavorthExecutionEntityKind,
  ZavorthExecutionLifecycleStatus,
  ExecutionLifecycleRecord,
} from '../contracts/ExecutionLifecycleContract.js';
import type { Task } from '../contracts/TaskContract.js';
import type { WorkflowRunSnapshot } from './WorkflowRunService.js';
// Dynamic service bag: read model accepts arbitrary execution snapshot shapes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExecutionLifecycleDynamic = any;

export type ExecutionLifecycleReadModelOrigin =
  | 'task'
  | 'task-artifact-manifest'
  | 'workflow'
  | 'workflow-artifact-manifest'
  | 'host-action'
  | 'automation'
  | 'node-invoke'
  | 'swarm'
  | 'selfmod'
  | 'replay'
  | 'memory-plane'
  | 'direct'
  | 'unknown';

export type ExecutionLifecycleReadModelEntry = ExecutionLifecycleRecord & {
  origin: ExecutionLifecycleReadModelOrigin;
  originId: string | null;
};

export type ExecutionLifecycleReadModelSnapshot = {
  generatedAt: string;
  summary: {
    total: number;
    recent: number;
    traces: number;
    runs: number;
    sessions: number;
    approvals: number;
    artifacts: number;
    replays: number;
    approvalRequired: number;
    blocked: number;
    failed: number;
    completed: number;
    linked: number;
    replayed: number;
  };
  byKind: Record<string, number>;
  byStatus: Record<string, number>;
  byRun: Array<{
    runId: string;
    total: number;
    latestAt: string | null;
    approvals: number;
    artifacts: number;
    statuses: Record<string, number>;
  }>;
  latest: ExecutionLifecycleReadModelEntry[];
  narrative: {
    headline: string;
    operatorSummary: string;
    nextAction: string;
  };
  sourceSnapshots: {
    taskCount: number;
    workflowRunCount: number;
    hostActionCount: number;
    directLifecycleCount: number;
    replayLifecycleCount: number;
    automationExecutionCount: number;
    nodeInvocationCount: number;
    swarmRunCount: number;
    selfModificationResultCount: number;
  };
};

type BuildLifecycleReadModelInput = {
  tasks?: Array<Partial<Task> | Record<string, ExecutionLifecycleDynamic>> | null;
  workflowRuns?: Array<Partial<WorkflowRunSnapshot> | Record<string, ExecutionLifecycleDynamic>> | null;
  hostActions?: Array<Record<string, ExecutionLifecycleDynamic>> | null;
  automationExecutions?: Array<Record<string, ExecutionLifecycleDynamic>> | null;
  nodeInvocations?: Array<Record<string, ExecutionLifecycleDynamic>> | null;
  swarmRuns?: Array<Record<string, ExecutionLifecycleDynamic>> | null;
  selfModificationResults?: Array<Record<string, ExecutionLifecycleDynamic>> | null;
  replay?: Record<string, ExecutionLifecycleDynamic> | null;
  memoryPlane?: Record<string, ExecutionLifecycleDynamic> | null;
  lifecycle?: Array<Partial<ExecutionLifecycleRecord> | Record<string, ExecutionLifecycleDynamic>> | null;
  limit?: number | null;
};

const ENTITY_KINDS: ZavorthExecutionEntityKind[] = [
  'intent',
  'plan',
  'execution',
  'approval',
  'run',
  'session',
  'artifact',
  'replay',
];

const STATUSES: ZavorthExecutionLifecycleStatus[] = [
  'received',
  'planned',
  'approval_required',
  'approved',
  'blocked',
  'running',
  'completed',
  'failed',
  'noop',
  'linked',
  'replayed',
];

export class ExecutionLifecycleReadModelService {
  private readonly now: () => Date;

  constructor(runtime: { now?: () => Date } = {}) {
    this.now = runtime.now || (() => new Date());
  }

  public buildSnapshot(input: BuildLifecycleReadModelInput = {}): ExecutionLifecycleReadModelSnapshot {
    const limit = this.normalizeLimit(input.limit);
    const collected = this.collectEntries(input);
    const uniqueEntries = this.dedupe(collected);
    const latest = uniqueEntries
      .sort((left, right) => this.getTimestamp(right.updatedAt || right.createdAt) - this.getTimestamp(left.updatedAt || left.createdAt))
      .slice(0, limit);
    const byKind = this.emptyCounter(ENTITY_KINDS);
    const byStatus = this.emptyCounter(STATUSES);

    for (const entry of latest) {
      byKind[entry.kind] = (byKind[entry.kind] || 0) + 1;
      byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;
    }

    const byRun = this.buildRunGroups(latest);
    const summary = {
      total: uniqueEntries.length,
      recent: latest.length,
      traces: new Set(latest.map((entry) => entry.traceId).filter(Boolean)).size,
      runs: byRun.length,
      sessions: byKind.session || 0,
      approvals: byKind.approval || 0,
      artifacts: byKind.artifact || 0,
      replays: byKind.replay || 0,
      approvalRequired: byStatus.approval_required || 0,
      blocked: byStatus.blocked || 0,
      failed: byStatus.failed || 0,
      completed: byStatus.completed || 0,
      linked: byStatus.linked || 0,
      replayed: byStatus.replayed || 0,
    };

    return {
      generatedAt: this.now().toISOString(),
      summary,
      byKind,
      byStatus,
      byRun,
      latest,
      narrative: this.buildNarrative(summary),
      sourceSnapshots: {
        taskCount: Array.isArray(input.tasks) ? input.tasks.length : 0,
        workflowRunCount: Array.isArray(input.workflowRuns) ? input.workflowRuns.length : 0,
        hostActionCount: Array.isArray(input.hostActions) ? input.hostActions.length : 0,
        directLifecycleCount: Array.isArray(input.lifecycle) ? input.lifecycle.length : 0,
        replayLifecycleCount: Array.isArray(input.replay?.lifecycle)
          ? input.replay!.lifecycle.length
          : (Array.isArray(input.memoryPlane?.replay?.lifecycle) ? input.memoryPlane!.replay.lifecycle.length : 0),
        automationExecutionCount: Array.isArray(input.automationExecutions) ? input.automationExecutions.length : 0,
        nodeInvocationCount: Array.isArray(input.nodeInvocations) ? input.nodeInvocations.length : 0,
        swarmRunCount: Array.isArray(input.swarmRuns) ? input.swarmRuns.length : 0,
        selfModificationResultCount: Array.isArray(input.selfModificationResults) ? input.selfModificationResults.length : 0,
      },
    };
  }

  private collectEntries(input: BuildLifecycleReadModelInput): ExecutionLifecycleReadModelEntry[] {
    const entries: ExecutionLifecycleReadModelEntry[] = [];
    this.pushLifecycle(entries, input.lifecycle, 'direct', null);
    this.pushLifecycle(entries, input.replay?.lifecycle, 'replay', this.text(input.replay?.recommendedEntry?.targetId, null));
    this.pushLifecycle(entries, input.memoryPlane?.replay?.lifecycle, 'memory-plane', this.text(input.memoryPlane?.replay?.recommendedEntry?.targetId, null));

    for (const task of Array.isArray(input.tasks) ? input.tasks : []) {
      const taskRecord = task as Record<string, ExecutionLifecycleDynamic>;
      const taskId = this.text(taskRecord?.task_id || taskRecord?.taskId, null);
      this.pushLifecycle(entries, taskRecord?.execution?.lifecycle, 'task', taskId);
      this.pushLifecycle(entries, taskRecord?.metadata?.execution_lifecycle, 'task', taskId);
      this.pushLifecycle(entries, taskRecord?.metadata?.artifacts_manifest?.lifecycle, 'task-artifact-manifest', taskId);
      this.pushLifecycle(entries, taskRecord?.metadata?.artifact_manifest?.lifecycle, 'task-artifact-manifest', taskId);
    }

    for (const run of Array.isArray(input.workflowRuns) ? input.workflowRuns : []) {
      const runRecord = run as Record<string, ExecutionLifecycleDynamic>;
      const runId = this.text(runRecord?.workflow_run_id || runRecord?.runId, null);
      this.pushLifecycle(entries, (run as ExecutionLifecycleDynamic)?.execution_lifecycle, 'workflow', runId);
      this.pushLifecycle(entries, (run as ExecutionLifecycleDynamic)?.artifacts_manifest?.lifecycle, 'workflow-artifact-manifest', runId);
    }

    for (const action of Array.isArray(input.hostActions) ? input.hostActions : []) {
      const actionRecord = action as Record<string, ExecutionLifecycleDynamic>;
      const actionId = this.text(actionRecord?.actionId || actionRecord?.action_id, null);
      this.pushLifecycle(entries, actionRecord?.metadata?.execution_lifecycle, 'host-action', actionId);
    }

    for (const automation of Array.isArray(input.automationExecutions) ? input.automationExecutions : []) {
      const automationRecord = automation as Record<string, ExecutionLifecycleDynamic>;
      const automationId = this.text(automationRecord?.runId || automationRecord?.actionId || automationRecord?.action_id, null);
      this.pushLifecycle(entries, automationRecord?.execution_lifecycle, 'automation', automationId);
      this.pushLifecycle(entries, automationRecord?.execution?.lifecycle, 'automation', automationId);
    }

    for (const invocation of Array.isArray(input.nodeInvocations) ? input.nodeInvocations : []) {
      const invocationRecord = invocation as Record<string, ExecutionLifecycleDynamic>;
      const invocationId = this.text(invocationRecord?.id || invocationRecord?.invocationId || invocationRecord?.invocation_id, null);
      this.pushLifecycle(entries, invocationRecord?.execution_lifecycle, 'node-invoke', invocationId);
    }

    for (const swarm of Array.isArray(input.swarmRuns) ? input.swarmRuns : []) {
      const swarmRecord = swarm as Record<string, ExecutionLifecycleDynamic>;
      const swarmId = this.text(swarmRecord?.swarmId || swarmRecord?.runId || swarmRecord?.run_id, null);
      this.pushLifecycle(entries, swarmRecord?.execution_lifecycle, 'swarm', swarmId);
    }

    for (const result of Array.isArray(input.selfModificationResults) ? input.selfModificationResults : []) {
      const resultRecord = result as Record<string, ExecutionLifecycleDynamic>;
      const selfmodId = this.text(resultRecord?.runId || resultRecord?.changeId || resultRecord?.previewId, null);
      this.pushLifecycle(entries, resultRecord?.execution_lifecycle, 'selfmod', selfmodId);
    }

    return entries;
  }

  private pushLifecycle(
    target: ExecutionLifecycleReadModelEntry[],
    records: unknown,
    origin: ExecutionLifecycleReadModelOrigin,
    originId: string | null,
  ): void {
    if (!Array.isArray(records)) {
      return;
    }

    for (const record of records) {
      const normalized = this.normalizeRecord(record, origin, originId);
      if (normalized) {
        target.push(normalized);
      }
    }
  }

  private normalizeRecord(
    record: unknown,
    origin: ExecutionLifecycleReadModelOrigin,
    originId: string | null,
  ): ExecutionLifecycleReadModelEntry | null {
    if (!record || typeof record !== 'object') {
      return null;
    }

    const raw = record as Record<string, ExecutionLifecycleDynamic>;
    const kind = this.normalizeKind(raw.kind);
    const status = this.normalizeStatus(raw.status);
    const traceId = this.text(raw.traceId || raw.trace_id, this.text(raw.runId || raw.run_id || originId, 'trace:unknown'))!;
    const runId = this.text(raw.runId || raw.run_id, traceId)!;
    const id = this.text(raw.id, `${kind}:${runId}`)!;
    const createdAt = this.text(raw.createdAt || raw.created_at, this.now().toISOString())!;
    const updatedAt = this.text(raw.updatedAt || raw.updated_at, createdAt)!;

    return {
      kind,
      id,
      traceId,
      runId,
      sessionId: this.text(raw.sessionId || raw.session_id, null),
      approvalId: this.text(raw.approvalId || raw.approval_id, null),
      artifactId: this.text(raw.artifactId || raw.artifact_id, null),
      status,
      summary: this.text(raw.summary, `${kind} ${status}`)!,
      source: this.text(raw.source, origin)!,
      surface: this.text(raw.surface, null),
      parentId: this.text(raw.parentId || raw.parent_id, null),
      createdAt,
      updatedAt,
      metadata: {
        ...(raw.metadata || {}),
      },
      origin,
      originId,
    };
  }

  private buildRunGroups(entries: ExecutionLifecycleReadModelEntry[]): ExecutionLifecycleReadModelSnapshot['byRun'] {
    const groups = new Map<string, ExecutionLifecycleReadModelSnapshot['byRun'][number]>();
    for (const entry of entries) {
      const current = groups.get(entry.runId) || {
        runId: entry.runId,
        total: 0,
        latestAt: null,
        approvals: 0,
        artifacts: 0,
        statuses: {},
      };
      current.total += 1;
      current.statuses[entry.status] = (current.statuses[entry.status] || 0) + 1;
      if (entry.kind === 'approval') {
        current.approvals += 1;
      }
      if (entry.kind === 'artifact') {
        current.artifacts += 1;
      }
      if (!current.latestAt || this.getTimestamp(entry.updatedAt || entry.createdAt) > this.getTimestamp(current.latestAt)) {
        current.latestAt = entry.updatedAt || entry.createdAt || null;
      }
      groups.set(entry.runId, current);
    }

    return Array.from(groups.values())
      .sort((left, right) => this.getTimestamp(right.latestAt) - this.getTimestamp(left.latestAt))
      .slice(0, 12);
  }

  private dedupe(entries: ExecutionLifecycleReadModelEntry[]): ExecutionLifecycleReadModelEntry[] {
    const byKey = new Map<string, ExecutionLifecycleReadModelEntry>();
    for (const entry of entries) {
      const key = [
        entry.kind,
        entry.id,
        entry.traceId,
        entry.runId,
        entry.status,
        entry.updatedAt || entry.createdAt || '',
      ].join('|');
      if (!byKey.has(key)) {
        byKey.set(key, entry);
      }
    }
    return Array.from(byKey.values());
  }

  private buildNarrative(summary: ExecutionLifecycleReadModelSnapshot['summary']): ExecutionLifecycleReadModelSnapshot['narrative'] {
    const blockedSignals = summary.blocked + summary.failed + summary.approvalRequired;
    return {
      headline: summary.recent > 0
        ? `Execution lifecycle with ${summary.recent} recent event(s).`
        : 'Execution lifecycle waiting for the first correlated events.',
      operatorSummary: [
        `${summary.runs} run(s), ${summary.traces} trace(s).`,
        `${summary.approvals} approval(s), ${summary.artifacts} artifact(s), ${summary.replays} replay(s).`,
        blockedSignals > 0 ? `${blockedSignals} sinal(is) need attention.` : 'Sem bloqueios recentes no lifecycle.',
      ].join(' '),
      nextAction: blockedSignals > 0
        ? 'Revisar approvals, failures e bloqueios correlacionados por runId.'
        : 'Manter correlation traceId/runId nas next executions.',
    };
  }

  private normalizeKind(value: unknown): ZavorthExecutionEntityKind {
    const normalized = String(value || '').trim();
    return ENTITY_KINDS.includes(normalized as ZavorthExecutionEntityKind)
      ? normalized as ZavorthExecutionEntityKind
      : 'execution';
  }

  private normalizeStatus(value: unknown): ZavorthExecutionLifecycleStatus {
    const normalized = String(value || '').trim();
    return STATUSES.includes(normalized as ZavorthExecutionLifecycleStatus)
      ? normalized as ZavorthExecutionLifecycleStatus
      : 'linked';
  }

  private emptyCounter(keys: readonly string[]): Record<string, number> {
    return keys.reduce<Record<string, number>>((current, key) => {
      current[key] = 0;
      return current;
    }, {});
  }

  private normalizeLimit(limit: number | null | undefined): number {
    const numeric = Number(limit || 30);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 30;
    }
    return Math.max(1, Math.min(100, Math.floor(numeric)));
  }

  private getTimestamp(value: unknown): number {
    const parsed = Date.parse(String(value || ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private text(value: unknown, fallback: string | null): string | null {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  }
}
