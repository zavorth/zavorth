import type {
  UniversalAgentEvent,
  UniversalAgentExecutorResult,
  UniversalAgentRequest,
  UniversalArtifactSummary,
} from '../agent/index.js';
import type {
  ExternalAgentAdapter,
} from './contracts.js';

export type ExternalAgentWorkerLocation = 'local' | 'remote';

export type ExternalAgentWorkerLifecycleAction = 'status' | 'start' | 'stop' | 'restart';

export type ExternalAgentWorkerLifecycleMode =
  | 'status-only'
  | 'safe-control-dry-run'
  | 'controlled-existing-process';

export type ExternalAgentWorkerRuntimeStatus =
  | 'available'
  | 'degraded'
  | 'offline'
  | 'blocked';

export type ExternalAgentWorkerTaskStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out';

export type ExternalAgentRemoteWorkerDescriptor = {
  id: string;
  runtimeId: string;
  label: string;
  location: ExternalAgentWorkerLocation;
  status: ExternalAgentWorkerRuntimeStatus;
  endpointLabel: string;
  capabilities: string[];
  lifecycleMode: ExternalAgentWorkerLifecycleMode;
  safeLifecycleActions: ExternalAgentWorkerLifecycleAction[];
  taskPolicy: {
    dispatch: 'zavorth-gateway-delegated-only';
    canLaunchSourceWorker: false;
    cancellation: boolean;
    defaultTimeoutMs: number;
    maxTimeoutMs: number;
  };
  diagnosticsAvailable: boolean;
};

export type ExternalAgentNodeDaemonHealthCheck = {
  id: string;
  label: string;
  status: ExternalAgentWorkerRuntimeStatus;
  detail?: string;
  checkedAt: string;
};

export type ExternalAgentNodeDaemonHealthSnapshot = {
  runtimeId: string;
  generatedAt: string;
  status: ExternalAgentWorkerRuntimeStatus;
  checks: ExternalAgentNodeDaemonHealthCheck[];
};

export type ExternalAgentWorkerTaskEnvelope = {
  id: string;
  runtimeId: string;
  workerId: string;
  runId?: string;
  sessionId?: string | null;
  userId: string;
  text: string;
  workspace?: string | null;
  requestedAt: string;
  timeoutMs: number;
  cancellationToken: string;
  metadata: Record<string, unknown>;
  boundary: 'zavorth-gateway-delegated-worker-task/v1';
};

export type ExternalAgentWorkerTaskResult = {
  id: string;
  taskId: string;
  runtimeId: string;
  workerId: string;
  runId?: string;
  sessionId?: string | null;
  status: ExternalAgentWorkerTaskStatus;
  summary: string;
  startedAt: string;
  completedAt?: string;
  timedOutAt?: string;
  cancelledAt?: string;
  artifacts: UniversalArtifactSummary[];
  events: Array<Omit<UniversalAgentEvent, 'id' | 'runId' | 'createdAt'> & Partial<Pick<UniversalAgentEvent, 'id' | 'createdAt'>>>;
  diagnosticsAvailable: boolean;
  nativeContract: 'UniversalAgentExecutorResult';
};

export type ExternalAgentWorkerLifecycleActionResult = {
  id: string;
  runtimeId: string;
  workerId: string;
  action: ExternalAgentWorkerLifecycleAction;
  status: 'dry-run' | 'dispatched' | 'blocked' | 'failed';
  allowed: boolean;
  reason: string;
  requestedAt: string;
  diagnosticsAvailable: boolean;
};

export type ExternalAgentWorkerStatusSnapshot = {
  id: string;
  kind: 'external-worker';
  status: 'idle' | 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled';
  runId?: string;
  summary: string;
  updatedAt: string;
};

export type ExternalAgentWorkerBridgeClient = {
  listWorkers(): Promise<ExternalAgentRemoteWorkerDescriptor[]>;
  getNodeDaemonHealth(): Promise<ExternalAgentNodeDaemonHealthSnapshot>;
  dispatchTask(task: ExternalAgentWorkerTaskEnvelope): Promise<ExternalAgentWorkerTaskResult>;
  cancelTask(taskId: string, reason?: string): Promise<ExternalAgentWorkerTaskResult | null>;
  runLifecycleAction?(input: {
    workerId: string;
    action: ExternalAgentWorkerLifecycleAction;
    dryRun: boolean;
    requestedAt: string;
  }): Promise<ExternalAgentWorkerLifecycleActionResult>;
};

export type ExternalAgentWorkerBridgeOptions = {
  adapter: ExternalAgentAdapter;
  client: ExternalAgentWorkerBridgeClient;
  now?: () => Date;
};

function normalizeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function normalizeId(value: unknown, fallback: string): string {
  const normalized = normalizeText(value, fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function toWorkerId(value: unknown): string {
  const normalized = normalizeId(value, 'worker');
  return normalized.startsWith('external-worker:')
    ? normalized
    : `external-worker:${normalized}`;
}

function toTaskId(value: unknown): string {
  const normalized = normalizeId(value, 'task');
  return normalized.startsWith('external-worker-task:')
    ? normalized
    : `external-worker-task:${normalized}`;
}

function clampTimeout(value: unknown, worker: ExternalAgentRemoteWorkerDescriptor): number {
  const timeout = typeof value === 'number' && Number.isFinite(value)
    ? value
    : worker.taskPolicy.defaultTimeoutMs;
  return Math.max(0, Math.min(timeout, worker.taskPolicy.maxTimeoutMs));
}

function mapTaskStatusToWorkerStatus(
  status: ExternalAgentWorkerTaskStatus,
): ExternalAgentWorkerStatusSnapshot['status'] {
  if (status === 'timed_out' || status === 'failed') {
    return 'failed';
  }
  if (status === 'cancelled') {
    return 'cancelled';
  }
  return status;
}

function isTerminalTask(status: ExternalAgentWorkerTaskStatus): boolean {
  return status === 'completed'
    || status === 'failed'
    || status === 'cancelled'
    || status === 'timed_out';
}

export class ExternalAgentWorkerBridge {
  private readonly adapter: ExternalAgentAdapter;
  private readonly client: ExternalAgentWorkerBridgeClient;
  private readonly now: () => Date;
  private readonly tasks = new Map<string, ExternalAgentWorkerTaskResult>();

  constructor(options: ExternalAgentWorkerBridgeOptions) {
    this.adapter = options.adapter;
    this.client = options.client;
    this.now = options.now || (() => new Date());
  }

  public async listWorkers(): Promise<ExternalAgentRemoteWorkerDescriptor[]> {
    const workers = await this.client.listWorkers();
    return workers.map((worker) => ({
      ...worker,
      id: toWorkerId(worker.id),
      runtimeId: this.adapter.descriptor.id,
      endpointLabel: normalizeText(worker.endpointLabel, worker.location === 'local' ? 'local worker endpoint' : 'remote worker endpoint'),
      capabilities: Array.from(new Set((worker.capabilities || []).map((capability) => normalizeText(capability)).filter(Boolean))),
      taskPolicy: {
        dispatch: 'zavorth-gateway-delegated-only',
        canLaunchSourceWorker: false,
        cancellation: worker.taskPolicy.cancellation,
        defaultTimeoutMs: Math.max(1, worker.taskPolicy.defaultTimeoutMs || 30_000),
        maxTimeoutMs: Math.max(1, worker.taskPolicy.maxTimeoutMs || worker.taskPolicy.defaultTimeoutMs || 30_000),
      },
      diagnosticsAvailable: Boolean(this.adapter.descriptor.diagnostics || worker.diagnosticsAvailable),
    }));
  }

  public async buildNodeDaemonHealthSnapshot(): Promise<ExternalAgentNodeDaemonHealthSnapshot> {
    const health = await this.client.getNodeDaemonHealth();
    return {
      runtimeId: this.adapter.descriptor.id,
      generatedAt: this.now().toISOString(),
      status: health.status,
      checks: health.checks.map((check) => ({
        ...check,
        id: `external-worker-health:${normalizeId(check.id, 'check')}`,
        checkedAt: check.checkedAt || this.now().toISOString(),
      })),
    };
  }

  public async requestLifecycleAction(input: {
    workerId: string;
    action: ExternalAgentWorkerLifecycleAction;
    dryRun?: boolean;
  }): Promise<ExternalAgentWorkerLifecycleActionResult> {
    const requestedAt = this.now().toISOString();
    const worker = await this.findWorker(input.workerId);
    if (!worker) {
      return {
        id: `external-worker-lifecycle:${normalizeId(input.workerId, 'worker')}:${input.action}`,
        runtimeId: this.adapter.descriptor.id,
        workerId: toWorkerId(input.workerId),
        action: input.action,
        status: 'blocked',
        allowed: false,
        reason: 'Worker descriptor not found.',
        requestedAt,
        diagnosticsAvailable: false,
      };
    }
    const dryRun = input.dryRun ?? worker.lifecycleMode !== 'controlled-existing-process';
    const allowed = input.action === 'status' || worker.safeLifecycleActions.includes(input.action);
    if (!allowed) {
      return {
        id: `external-worker-lifecycle:${normalizeId(worker.id, 'worker')}:${input.action}`,
        runtimeId: this.adapter.descriptor.id,
        workerId: worker.id,
        action: input.action,
        status: 'blocked',
        allowed: false,
        reason: 'Lifecycle action is not marked safe for this worker.',
        requestedAt,
        diagnosticsAvailable: worker.diagnosticsAvailable,
      };
    }
    if (!dryRun && worker.lifecycleMode !== 'controlled-existing-process') {
      return {
        id: `external-worker-lifecycle:${normalizeId(worker.id, 'worker')}:${input.action}`,
        runtimeId: this.adapter.descriptor.id,
        workerId: worker.id,
        action: input.action,
        status: 'blocked',
        allowed: false,
        reason: 'Worker only permits dry-run lifecycle control in this phase.',
        requestedAt,
        diagnosticsAvailable: worker.diagnosticsAvailable,
      };
    }

    const result = await this.client.runLifecycleAction?.({
      workerId: worker.id,
      action: input.action,
      dryRun,
      requestedAt,
    });
    return result || {
      id: `external-worker-lifecycle:${normalizeId(worker.id, 'worker')}:${input.action}`,
      runtimeId: this.adapter.descriptor.id,
      workerId: worker.id,
      action: input.action,
      status: dryRun ? 'dry-run' : 'dispatched',
      allowed: true,
      reason: dryRun
        ? 'Lifecycle bridge accepted as a Zavorth dry-run; no source process was launched.'
        : 'Lifecycle bridge dispatched to an existing controlled worker endpoint.',
      requestedAt,
      diagnosticsAvailable: worker.diagnosticsAvailable,
    };
  }

  public async delegateTask(input: {
    request: UniversalAgentRequest;
    workerId: string;
    runId?: string;
    timeoutMs?: number;
  }): Promise<ExternalAgentWorkerTaskResult> {
    const worker = await this.findWorker(input.workerId);
    const requestedAt = this.now().toISOString();
    if (!worker) {
      return this.buildFailedResult({
        taskId: toTaskId(`${input.runId || input.request.sessionId || 'unknown'}:missing-worker`),
        workerId: toWorkerId(input.workerId),
        runId: input.runId,
        sessionId: input.request.sessionId,
        status: 'failed',
        summary: 'Worker descriptor not found.',
        at: requestedAt,
      });
    }
    if (worker.status === 'offline' || worker.status === 'blocked') {
      return this.buildFailedResult({
        taskId: toTaskId(`${input.runId || input.request.sessionId || worker.id}:unavailable`),
        workerId: worker.id,
        runId: input.runId,
        sessionId: input.request.sessionId,
        status: 'failed',
        summary: `Worker is ${worker.status}.`,
        at: requestedAt,
      });
    }

    const timeoutMs = clampTimeout(input.timeoutMs, worker);
    const taskId = toTaskId(`${input.runId || input.request.requestId || input.request.sessionId || worker.id}:${worker.id}`);
    if (timeoutMs <= 0) {
      const timedOut = this.buildFailedResult({
        taskId,
        workerId: worker.id,
        runId: input.runId,
        sessionId: input.request.sessionId,
        status: 'timed_out',
        summary: 'Worker delegation timed out before dispatch.',
        at: requestedAt,
      });
      this.tasks.set(timedOut.taskId, timedOut);
      return timedOut;
    }

    const envelope: ExternalAgentWorkerTaskEnvelope = {
      id: taskId,
      runtimeId: this.adapter.descriptor.id,
      workerId: worker.id,
      runId: input.runId,
      sessionId: input.request.sessionId,
      userId: input.request.userId,
      text: input.request.text,
      workspace: input.request.workspace ?? null,
      requestedAt,
      timeoutMs,
      cancellationToken: `external-worker-cancel:${normalizeId(taskId, 'task')}`,
      metadata: {
        ...(input.request.metadata || {}),
        zavorthDelegation: true,
        canLaunchSourceWorker: false,
      },
      boundary: 'zavorth-gateway-delegated-worker-task/v1',
    };
    const result = this.normalizeTaskResult(
      await this.client.dispatchTask(envelope),
      envelope,
      worker,
    );
    this.tasks.set(result.taskId, result);
    return result;
  }

  public async cancelTask(taskId: string, reason = 'Cancelled by Zavorth operator.'): Promise<ExternalAgentWorkerTaskResult | null> {
    const normalizedTaskId = toTaskId(taskId);
    const existing = this.tasks.get(normalizedTaskId);
    if (!existing) {
      return null;
    }
    if (isTerminalTask(existing.status)) {
      return existing;
    }

    const cancelledAt = this.now().toISOString();
    const clientResult = await this.client.cancelTask(normalizedTaskId, reason);
    const cancelled = clientResult || {
      ...existing,
      id: `${existing.taskId}:cancelled`,
      status: 'cancelled' as const,
      summary: reason,
      cancelledAt,
      events: [
        ...existing.events,
        {
          kind: 'status',
          title: 'External worker task cancelled',
          detail: reason,
          status: 'done',
          createdAt: cancelledAt,
        },
      ],
    };
    const normalized = {
      ...cancelled,
      taskId: normalizedTaskId,
      runtimeId: this.adapter.descriptor.id,
      workerId: cancelled.workerId || existing.workerId,
      runId: cancelled.runId || existing.runId,
      sessionId: cancelled.sessionId ?? existing.sessionId,
      nativeContract: 'UniversalAgentExecutorResult' as const,
    };
    this.tasks.set(normalized.taskId, normalized);
    return normalized;
  }

  public toExecutorResult(result: ExternalAgentWorkerTaskResult): UniversalAgentExecutorResult {
    const status: UniversalAgentExecutorResult['status'] =
      result.status === 'completed'
        ? 'completed'
        : result.status === 'cancelled'
          ? 'cancelled'
          : result.status === 'queued' || result.status === 'running'
            ? 'queued'
            : 'failed';

    return {
      status,
      summary: result.summary,
      replyText: result.summary,
      artifacts: result.artifacts,
      events: result.events,
      metadata: {
        externalWorkerDelegation: {
          taskId: result.taskId,
          workerId: result.workerId,
          status: result.status,
          canLaunchSourceWorker: false,
        },
      },
    };
  }

  public buildWorkerStatusSnapshots(): ExternalAgentWorkerStatusSnapshot[] {
    const latestByWorker = new Map<string, ExternalAgentWorkerTaskResult>();
    for (const task of this.tasks.values()) {
      latestByWorker.set(task.workerId, task);
    }

    return Array.from(latestByWorker.values()).map((task) => ({
      id: task.workerId,
      kind: 'external-worker',
      status: mapTaskStatusToWorkerStatus(task.status),
      runId: task.runId,
      summary: task.summary,
      updatedAt: task.completedAt || task.cancelledAt || task.timedOutAt || task.startedAt,
    }));
  }

  private async findWorker(workerId: string): Promise<ExternalAgentRemoteWorkerDescriptor | null> {
    const normalized = toWorkerId(workerId);
    const workers = await this.listWorkers();
    return workers.find((worker) => worker.id === normalized) || null;
  }

  private buildFailedResult(input: {
    taskId: string;
    workerId: string;
    runId?: string;
    sessionId?: string | null;
    status: Extract<ExternalAgentWorkerTaskStatus, 'failed' | 'timed_out'>;
    summary: string;
    at: string;
  }): ExternalAgentWorkerTaskResult {
    return {
      id: `${input.taskId}:result`,
      taskId: input.taskId,
      runtimeId: this.adapter.descriptor.id,
      workerId: input.workerId,
      runId: input.runId,
      sessionId: input.sessionId,
      status: input.status,
      summary: input.summary,
      startedAt: input.at,
      ...(input.status === 'timed_out' ? { timedOutAt: input.at } : { completedAt: input.at }),
      artifacts: [],
      events: [
        {
          kind: 'error',
          title: input.status === 'timed_out' ? 'External worker timeout' : 'External worker delegation failed',
          detail: input.summary,
          status: 'failed',
          createdAt: input.at,
        },
      ],
      diagnosticsAvailable: Boolean(this.adapter.descriptor.diagnostics),
      nativeContract: 'UniversalAgentExecutorResult',
    };
  }

  private normalizeTaskResult(
    result: ExternalAgentWorkerTaskResult,
    envelope: ExternalAgentWorkerTaskEnvelope,
    worker: ExternalAgentRemoteWorkerDescriptor,
  ): ExternalAgentWorkerTaskResult {
    const startedAt = result.startedAt || envelope.requestedAt;
    return {
      ...result,
      id: normalizeText(result.id, `${envelope.id}:result`),
      taskId: toTaskId(result.taskId || envelope.id),
      runtimeId: this.adapter.descriptor.id,
      workerId: worker.id,
      runId: result.runId || envelope.runId,
      sessionId: result.sessionId ?? envelope.sessionId ?? null,
      summary: normalizeText(result.summary, 'External worker task finished.'),
      startedAt,
      artifacts: (result.artifacts || []).map((artifact) => ({
        ...artifact,
        sessionId: artifact.sessionId || envelope.sessionId || undefined,
      })),
      events: result.events || [],
      diagnosticsAvailable: worker.diagnosticsAvailable,
      nativeContract: 'UniversalAgentExecutorResult',
    };
  }
}
