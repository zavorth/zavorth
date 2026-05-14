import {
  buildZavorthCommandCenterAssimilationSnapshot,
  buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot,
} from '../../../src/ai-gateway/app/(dashboard)/control/command-center/projections/index.js';
import {
  ZavorthAgentGateway,
} from '../../../src/runtime/agent/index.js';
import {
  ExternalAgentWorkerBridge,
  FixtureExternalAgentWorkerClient,
} from '../../../src/runtime/external-agents/index.js';
import {
  FixtureExternalExecutorSidecarClient,
  QuarantinedExternalExecutorSidecarAdapter,
} from '../../../src/runtime/external-agents/external-executor/index.js';

function createIdFactory() {
  let index = 0;
  return (prefix: string) => {
    index += 1;
    return `${prefix}-phase8-${index}`;
  };
}

function createBridge(mode: 'complete' | 'deferred' | 'fail' = 'complete') {
  const adapter = new QuarantinedExternalExecutorSidecarAdapter({
    client: new FixtureExternalExecutorSidecarClient(),
    now: () => new Date('2026-04-28T00:00:00.000Z'),
  });
  const client = new FixtureExternalAgentWorkerClient({
    mode,
    now: () => new Date('2026-04-28T00:01:00.000Z'),
  });
  const bridge = new ExternalAgentWorkerBridge({
    adapter,
    client,
    now: () => new Date('2026-04-28T00:02:00.000Z'),
  });
  return { adapter, client, bridge };
}

describe('Plan 111 Phase 8 external daemon, nodes and remote worker bridge', () => {
  it('exposes worker descriptors, node/daemon health checks, and safe lifecycle bridge decisions', async () => {
    const { client, bridge } = createBridge();

    const workers = await bridge.listWorkers();
    const health = await bridge.buildNodeDaemonHealthSnapshot();
    const restart = await bridge.requestLifecycleAction({
      workerId: 'fixture-local',
      action: 'restart',
    });
    const unsafeStart = await bridge.requestLifecycleAction({
      workerId: 'fixture-local',
      action: 'start',
      dryRun: false,
    });

    expect(workers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'external-worker:fixture-local',
        runtimeId: 'external-runtime:primary-sidecar',
        location: 'local',
        status: 'available',
        taskPolicy: expect.objectContaining({
          dispatch: 'zavorth-gateway-delegated-only',
          canLaunchSourceWorker: false,
          cancellation: true,
        }),
      }),
      expect.objectContaining({
        id: 'external-worker:fixture-remote',
        location: 'remote',
        lifecycleMode: 'status-only',
      }),
    ]));
    expect(health).toEqual(expect.objectContaining({
      runtimeId: 'external-runtime:primary-sidecar',
      status: 'degraded',
      checks: expect.arrayContaining([
        expect.objectContaining({
          id: 'external-worker-health:fixture-local-worker',
          status: 'available',
        }),
      ]),
    }));
    expect(restart).toEqual(expect.objectContaining({
      workerId: 'external-worker:fixture-local',
      action: 'restart',
      status: 'dry-run',
      allowed: true,
    }));
    expect(unsafeStart).toEqual(expect.objectContaining({
      workerId: 'external-worker:fixture-local',
      action: 'start',
      status: 'blocked',
      allowed: false,
    }));
    expect(client.lifecycleActions).toHaveLength(1);
    expect(JSON.stringify({ workers, health, restart, unsafeStart })).not.toContain('ExternalExecutor');
  });

  it('delegates a Zavorth run to an existing worker and returns artifacts through UniversalAgentExecutorResult', async () => {
    const { client, bridge } = createBridge();
    const gateway = new ZavorthAgentGateway({
      now: () => new Date('2026-04-28T00:10:00.000Z'),
      idFactory: createIdFactory(),
      executor: async ({ request, run }) => bridge.toExecutorResult(
        await bridge.delegateTask({
          request,
          runId: run.id,
          workerId: 'fixture-local',
          timeoutMs: 5000,
        }),
      ),
    });

    const result = await gateway.handle({
      userId: 'grey',
      channel: 'web',
      sessionId: 'session-phase8-worker',
      text: 'delegue esta tarefa para o worker externo existente',
      requestedTools: ['external_worker.delegate'],
    });
    const projection = buildCommandCenterRuntimeProjectionFromZavorthAgentGatewaySnapshot(
      gateway.buildSnapshot({ activeRunId: result.run.id }),
    );
    const commandCenterSnapshot = buildZavorthCommandCenterAssimilationSnapshot({
      projection,
      externalWorkers: bridge.buildWorkerStatusSnapshots(),
      identityLeakTerms: ['ExternalExecutor'],
      now: () => new Date('2026-04-28T00:11:00.000Z'),
    });

    expect(result.run).toEqual(expect.objectContaining({
      status: 'completed',
      sessionId: 'session-phase8-worker',
      summary: 'Fixture worker completed the Zavorth delegated task.',
      artifacts: [
        expect.objectContaining({
          id: expect.stringContaining('external-worker-artifact:external-worker-task:'),
          kind: 'report',
          status: 'ready',
        }),
      ],
      metadata: expect.objectContaining({
        externalWorkerDelegation: expect.objectContaining({
          workerId: 'external-worker:fixture-local',
          status: 'completed',
          canLaunchSourceWorker: false,
        }),
      }),
    }));
    expect(client.dispatchedTasks).toEqual([
      expect.objectContaining({
        workerId: 'external-worker:fixture-local',
        boundary: 'zavorth-gateway-delegated-worker-task/v1',
        metadata: expect.objectContaining({
          zavorthDelegation: true,
          canLaunchSourceWorker: false,
        }),
      }),
    ]);
    expect(commandCenterSnapshot.workers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'external-worker:fixture-local',
        kind: 'external-worker',
        status: 'completed',
        runId: result.run.id,
      }),
    ]));
    expect(commandCenterSnapshot.workflows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'workers.inspect',
        enabled: true,
      }),
    ]));
    expect(commandCenterSnapshot.identityLeakScan.passed).toBe(true);
    expect(JSON.stringify({ result, commandCenterSnapshot })).not.toContain('ExternalExecutor');
  });

  it('handles worker timeouts before dispatch and cancellation for running delegated tasks', async () => {
    const timeoutBridge = createBridge().bridge;
    const timedOut = await timeoutBridge.delegateTask({
      request: {
        userId: 'grey',
        channel: 'web',
        sessionId: 'session-phase8-timeout',
        text: 'timeout imediato',
      },
      workerId: 'fixture-local',
      runId: 'run-phase8-timeout',
      timeoutMs: 0,
    });
    const deferred = createBridge('deferred');
    const running = await deferred.bridge.delegateTask({
      request: {
        userId: 'grey',
        channel: 'web',
        sessionId: 'session-phase8-cancel',
        text: 'tarefa longa cancelavel',
      },
      workerId: 'fixture-local',
      runId: 'run-phase8-cancel',
      timeoutMs: 5000,
    });
    const cancelled = await deferred.bridge.cancelTask(running.taskId, 'Cancelado pelo gate Phase 8.');

    expect(timedOut).toEqual(expect.objectContaining({
      status: 'timed_out',
      summary: 'Worker delegation timed out before dispatch.',
      artifacts: [],
      timedOutAt: expect.any(String),
    }));
    expect(running).toEqual(expect.objectContaining({
      status: 'running',
      workerId: 'external-worker:fixture-local',
    }));
    expect(cancelled).toEqual(expect.objectContaining({
      status: 'cancelled',
      taskId: running.taskId,
      summary: 'Cancelado pelo gate Phase 8.',
    }));
    expect(deferred.client.cancelledTasks).toEqual([
      expect.objectContaining({
        taskId: running.taskId,
        reason: 'Cancelado pelo gate Phase 8.',
      }),
    ]);
    expect(deferred.bridge.buildWorkerStatusSnapshots()).toEqual([
      expect.objectContaining({
        id: 'external-worker:fixture-local',
        status: 'cancelled',
        runId: 'run-phase8-cancel',
      }),
    ]);
  });
});
