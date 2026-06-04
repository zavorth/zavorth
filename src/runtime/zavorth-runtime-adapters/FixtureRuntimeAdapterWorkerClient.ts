import type {
  RuntimeAdapterNodeDaemonHealthSnapshot,
  RuntimeAdapterRemoteWorkerDescriptor,
  RuntimeAdapterWorkerBridgeClient,
  RuntimeAdapterWorkerLifecycleActionResult,
  RuntimeAdapterWorkerTaskEnvelope,
  RuntimeAdapterWorkerTaskResult,
} from './RuntimeAdapterWorkerBridge.js';

export type FixtureRuntimeAdapterWorkerClientMode = 'complete' | 'deferred' | 'fail';

export type FixtureRuntimeAdapterWorkerClientOptions = {
  mode?: FixtureRuntimeAdapterWorkerClientMode;
  now?: () => Date;
};

const RUNTIME_ID = 'external-runtime:primary-sidecar';

export class FixtureRuntimeAdapterWorkerClient implements RuntimeAdapterWorkerBridgeClient {
  public readonly dispatchedTasks: RuntimeAdapterWorkerTaskEnvelope[] = [];
  public readonly cancelledTasks: Array<{ taskId: string; reason?: string }> = [];
  public readonly lifecycleActions: Array<{
    workerId: string;
    action: string;
    dryRun: boolean;
    requestedAt: string;
  }> = [];

  private readonly mode: FixtureRuntimeAdapterWorkerClientMode;
  private readonly now: () => Date;

  constructor(options: FixtureRuntimeAdapterWorkerClientOptions = {}) {
    this.mode = options.mode || 'complete';
    this.now = options.now || (() => new Date('2026-04-27T23:30:00.000Z'));
  }

  public async listWorkers(): Promise<RuntimeAdapterRemoteWorkerDescriptor[]> {
    return [
      {
        id: 'fixture-local',
        runtimeId: RUNTIME_ID,
        label: 'External local worker fixture',
        location: 'local',
        status: 'available',
        endpointLabel: 'fixture local worker endpoint',
        capabilities: ['task.delegate', 'artifact.return'],
        lifecycleMode: 'safe-control-dry-run',
        safeLifecycleActions: ['status', 'restart'],
        taskPolicy: {
          dispatch: 'zavorth-gateway-delegated-only',
          canLaunchSourceWorker: false,
          cancellation: true,
          defaultTimeoutMs: 30_000,
          maxTimeoutMs: 120_000,
        },
        diagnosticsAvailable: true,
      },
      {
        id: 'fixture-remote',
        runtimeId: RUNTIME_ID,
        label: 'External remote worker fixture',
        location: 'remote',
        status: 'degraded',
        endpointLabel: 'fixture remote worker endpoint',
        capabilities: ['task.delegate'],
        lifecycleMode: 'status-only',
        safeLifecycleActions: ['status'],
        taskPolicy: {
          dispatch: 'zavorth-gateway-delegated-only',
          canLaunchSourceWorker: false,
          cancellation: true,
          defaultTimeoutMs: 45_000,
          maxTimeoutMs: 180_000,
        },
        diagnosticsAvailable: true,
      },
    ];
  }

  public async getNodeDaemonHealth(): Promise<RuntimeAdapterNodeDaemonHealthSnapshot> {
    const checkedAt = this.now().toISOString();
    return {
      runtimeId: RUNTIME_ID,
      generatedAt: checkedAt,
      status: 'degraded',
      checks: [
        {
          id: 'fixture-sidecar-client',
          label: 'Fixture sidecar client',
          status: 'available',
          detail: 'Read-only fixture client is reachable.',
          checkedAt,
        },
        {
          id: 'fixture-local-worker',
          label: 'Fixture local worker',
          status: 'available',
          detail: 'Existing worker endpoint can accept Zavorth delegated tasks.',
          checkedAt,
        },
        {
          id: 'fixture-remote-worker',
          label: 'Fixture remote worker',
          status: 'degraded',
          detail: 'Remote worker is visible but kept status-only in this phase.',
          checkedAt,
        },
      ],
    };
  }

  public async runLifecycleAction(input: {
    workerId: string;
    action: string;
    dryRun: boolean;
    requestedAt: string;
  }): Promise<RuntimeAdapterWorkerLifecycleActionResult> {
    this.lifecycleActions.push(input);
    return {
      id: `fixture-worker-lifecycle:${input.workerId}:${input.action}`,
      runtimeId: RUNTIME_ID,
      workerId: input.workerId,
      action: input.action as RuntimeAdapterWorkerLifecycleActionResult['action'],
      status: input.dryRun ? 'dry-run' : 'dispatched',
      allowed: true,
      reason: input.dryRun
        ? 'Fixture accepted lifecycle action as dry-run only.'
        : 'Fixture dispatched lifecycle action to an existing endpoint.',
      requestedAt: input.requestedAt,
      diagnosticsAvailable: true,
    };
  }

  public async dispatchTask(task: RuntimeAdapterWorkerTaskEnvelope): Promise<RuntimeAdapterWorkerTaskResult> {
    this.dispatchedTasks.push(task);
    const startedAt = this.now().toISOString();
    if (this.mode === 'fail') {
      return {
        id: `${task.id}:result`,
        taskId: task.id,
        runtimeId: task.runtimeId,
        workerId: task.workerId,
        runId: task.runId,
        sessionId: task.sessionId,
        status: 'failed',
        summary: 'Fixture worker failed the delegated task.',
        startedAt,
        completedAt: startedAt,
        artifacts: [],
        events: [
          {
            kind: 'error',
            title: 'Fixture worker failure',
            detail: 'Failure mode requested by test fixture.',
            status: 'failed',
          },
        ],
        diagnosticsAvailable: true,
        nativeContract: 'UniversalAgentExecutorResult',
      };
    }
    if (this.mode === 'deferred') {
      return {
        id: `${task.id}:running`,
        taskId: task.id,
        runtimeId: task.runtimeId,
        workerId: task.workerId,
        runId: task.runId,
        sessionId: task.sessionId,
        status: 'running',
        summary: 'Fixture worker accepted the task and is running.',
        startedAt,
        artifacts: [],
        events: [
          {
            kind: 'status',
            title: 'External worker task running',
            detail: 'Fixture task is waiting for cancellation or completion.',
            status: 'running',
          },
        ],
        diagnosticsAvailable: true,
        nativeContract: 'UniversalAgentExecutorResult',
      };
    }

    return {
      id: `${task.id}:result`,
      taskId: task.id,
      runtimeId: task.runtimeId,
      workerId: task.workerId,
      runId: task.runId,
      sessionId: task.sessionId,
      status: 'completed',
      summary: 'Fixture worker completed the Zavorth delegated task.',
      startedAt,
      completedAt: startedAt,
      artifacts: [
        {
          id: `external-worker-artifact:${task.id}`,
          title: 'External worker result',
          kind: 'report',
          createdAt: startedAt,
          sessionId: task.sessionId || undefined,
          status: 'ready',
        },
      ],
      events: [
        {
          kind: 'artifact',
          title: 'External worker artifact returned',
          detail: 'Artifact was mapped back to UniversalArtifactSummary.',
          status: 'done',
        },
      ],
      diagnosticsAvailable: true,
      nativeContract: 'UniversalAgentExecutorResult',
    };
  }

  public async cancelTask(taskId: string, reason = 'Cancelled by Zavorth operator.'): Promise<RuntimeAdapterWorkerTaskResult | null> {
    this.cancelledTasks.push({ taskId, reason });
    const cancelledAt = this.now().toISOString();
    return {
      id: `${taskId}:cancelled`,
      taskId,
      runtimeId: RUNTIME_ID,
      workerId: 'external-worker:fixture-local',
      status: 'cancelled',
      summary: reason,
      startedAt: cancelledAt,
      cancelledAt,
      artifacts: [],
      events: [
        {
          kind: 'status',
          title: 'External worker task cancelled',
          detail: reason,
          status: 'done',
        },
      ],
      diagnosticsAvailable: true,
      nativeContract: 'UniversalAgentExecutorResult',
    };
  }
}
