import {
  ZAVORTH_DELEGATED_WORKER_BRIDGE_CONTRACT_VERSION,
} from '../../src/contracts/ZavorthDelegatedWorkerBridgeContract.js';
import { ZavorthDelegatedWorkerBridgeService } from '../../src/services/ZavorthDelegatedWorkerBridgeService.js';

describe('ZavorthDelegatedWorkerBridgeService Surface controls', () => {
  it('publishes the delegated worker bridge snapshot after Runtime gateway readiness', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot).toEqual(expect.objectContaining({
      generatedAt: '2026-05-11T22:25:00.000Z',
      contractVersion: ZAVORTH_DELEGATED_WORKER_BRIDGE_CONTRACT_VERSION,
      status: 'delegated-worker-bridge-ready',
      planId: 'Zavorth External Runtime Integration',
      stage: 'delegated-workers',
      previousSessionMemoryStatus: 'session-memory-continuation-ready',
    }));
    expect(snapshot.summary).toEqual(expect.objectContaining({
      workerDescriptors: 2,
      delegatedTaskEnvelopes: 1,
      dryRunLifecycleReceipts: 1,
      timeoutPolicies: 1,
      cancellationPolicies: 1,
      sourceWorkerLaunchesBlocked: 1,
      executorResultsMapped: 1,
      liveWorkersStarted: 0,
      sourceRuntimeCodeExecuted: false,
      toolExecutionPerformed: false,
    }));
    expect(snapshot.summary.artifactEventsReturned).toBeGreaterThanOrEqual(1);
    expect(snapshot.commands.nextStage).toBe('291 Dashboard controls - Native Replacement And Decommission');
  });

  it('normalizes worker descriptors without making source workers canonical', () => {
    const descriptor = createService().normalizeWorkerDescriptor({
      sourceRuntimeId: 'source-runtime-test',
      sourceWorkerId: ' Reader Worker ',
      role: 'reader',
      health: 'ready',
      capabilities: ['Read Repo', 'Summarize Context'],
      maxRuntimeMs: 90000,
      canMutateFiles: false,
      requiresApprovalToLaunch: true,
    });

    expect(descriptor).toEqual(expect.objectContaining({
      workerId: 'zavorth.worker.reader-worker',
      sourceRuntimeId: 'source-runtime-test',
      sourceWorkerId: ' Reader Worker ',
      sourceRuntimeDiagnosticsOnly: true,
      publicName: 'Zavorth',
      role: 'reader',
      health: 'ready',
      capabilities: ['read-repo', 'summarize-context'],
      maxRuntimeMs: 90000,
      canMutateFiles: false,
      dispatchMode: 'zavorth-gateway-delegated-only',
      directSourceLaunchAllowed: false,
      approvalRequiredForLiveLaunch: true,
    }));
    expect(descriptor.safety).toEqual(expect.objectContaining({
      sourceWorkerNotCanonical: true,
      noDirectLaunch: true,
      noSourceRuntimeCodeExecuted: true,
    }));
  });

  it('builds delegated task envelopes as gateway-only dry-runs', () => {
    const envelope = createService().buildDelegatedTaskEnvelope({
      taskId: 'task-test',
      workerId: 'zavorth.worker.reader',
      requestedBySessionId: 'zavorth.session.test',
      objective: '  summarize repository status  ',
      resourceRefs: ['repo://current'],
      risk: 'medium',
      timeoutMs: 45000,
      cancellationToken: 'cancel-test',
    });

    expect(envelope).toEqual(expect.objectContaining({
      delegatedTaskId: 'zavorth.delegated-task.task-test',
      workerId: 'zavorth.worker.reader',
      requestedBySessionId: 'zavorth.session.test',
      objective: 'summarize repository status',
      risk: 'medium',
      timeoutMs: 45000,
      cancellationToken: 'cancel-test',
      status: 'dry-run-ready',
      dispatchMode: 'zavorth-gateway-delegated-only',
      gatewayEntrypoint: 'ZavorthAgentGateway',
      approvalRequired: false,
      directSourceWorkerLaunchAllowed: false,
      liveDispatchPerformed: false,
    }));
    expect(envelope.safety).toEqual(expect.objectContaining({
      boundedTaskEnvelope: true,
      noWorkerLaunch: true,
      noToolExecution: true,
      noApprovalBypass: true,
    }));
  });

  it('blocks high risk delegated task envelopes without approval', () => {
    const envelope = createService().buildDelegatedTaskEnvelope({
      taskId: 'dangerous-test',
      workerId: 'zavorth.worker.runner',
      requestedBySessionId: 'zavorth.session.test',
      objective: 'delete build artifacts and push',
      resourceRefs: ['repo://current'],
      risk: 'high',
      timeoutMs: 60000,
      cancellationToken: 'cancel-danger',
      approvalGranted: false,
    });

    expect(envelope).toEqual(expect.objectContaining({
      status: 'blocked',
      approvalRequired: true,
      approvalGranted: false,
      liveDispatchPerformed: false,
      directSourceWorkerLaunchAllowed: false,
    }));
  });

  it('builds timeout and cancellation receipts without starting timers', () => {
    const service = createService();
    const envelope = service.buildDelegatedTaskEnvelope({
      taskId: 'timeout-test',
      workerId: 'zavorth.worker.reader',
      requestedBySessionId: 'zavorth.session.test',
      objective: 'inspect docs',
      resourceRefs: ['docs://291'],
      risk: 'low',
      timeoutMs: 30000,
      cancellationToken: 'cancel-timeout',
    });
    const receipt = service.buildTimeoutCancellation(envelope);

    expect(receipt).toEqual(expect.objectContaining({
      delegatedTaskId: envelope.delegatedTaskId,
      timeoutMs: 30000,
      cancellationToken: 'cancel-timeout',
      timeoutPolicy: 'cancel-task-and-return-status',
      cancellationAvailable: true,
      timerStarted: false,
    }));
    expect(receipt.safety).toEqual(expect.objectContaining({
      dryRunOnly: true,
      noBackgroundTimerStarted: true,
      cancellationTokenRequired: true,
    }));
  });

  it('keeps source worker launch blocked until a later explicit gate', () => {
    const worker = createService().normalizeWorkerDescriptor({
      sourceRuntimeId: 'source-runtime-test',
      sourceWorkerId: 'runner',
      role: 'runner',
      health: 'ready',
      capabilities: ['run-tests'],
      maxRuntimeMs: 120000,
      canMutateFiles: false,
      requiresApprovalToLaunch: true,
    });
    const gate = createService().blockSourceWorkerLaunch(worker, false);

    expect(gate).toEqual(expect.objectContaining({
      workerId: worker.workerId,
      status: 'blocked',
      approvalRequired: true,
      approvalGranted: false,
      sourceWorkerLaunchBlocked: true,
    }));
    expect(gate.safety).toEqual(expect.objectContaining({
      noSourceWorkerLaunch: true,
      laterGateRequired: true,
      noApprovalBypass: true,
    }));
  });

  it('builds lifecycle status as dry-run first', () => {
    const service = createService();
    const snapshot = service.buildSnapshot();

    expect(snapshot.lifecycleDryRunReceipt).toEqual(expect.objectContaining({
      delegatedTaskId: snapshot.delegatedTaskEnvelope.delegatedTaskId,
      workerId: snapshot.delegatedTaskEnvelope.workerId,
      status: 'dry-run-ready',
      sourceWorkerLaunchBlocked: true,
      liveWorkerStarted: false,
    }));
    expect(snapshot.lifecycleDryRunReceipt.lifecycle.map((entry) => entry.state)).toEqual(['queued', 'leased', 'blocked']);
    expect(snapshot.lifecycleDryRunReceipt.lifecycle.every((entry) => entry.dryRunOnly)).toBe(true);
  });

  it('maps executor results into Zavorth artifact, event, and status receipts', () => {
    const receipt = createService().mapExecutorResult({
      delegatedTaskId: 'zavorth.delegated-task.result-test',
      workerId: 'zavorth.worker.reader',
      status: 'success',
      exitCode: 0,
      stdoutPreview: 'ok',
      stderrPreview: '',
      artifactRefs: ['artifact://summary'],
    });

    expect(receipt).toEqual(expect.objectContaining({
      delegatedTaskId: 'zavorth.delegated-task.result-test',
      workerId: 'zavorth.worker.reader',
      status: 'mapped',
      event: expect.objectContaining({
        eventType: 'delegated-worker-result',
        status: 'success',
      }),
      runStatus: expect.objectContaining({
        state: 'completed',
        exitCode: 0,
      }),
    }));
    expect(receipt.artifactEvents).toEqual([
      expect.objectContaining({
        sourceRef: 'artifact://summary',
        artifactType: 'worker-output',
      }),
    ]);
    expect(receipt.safety).toEqual(expect.objectContaining({
      resultMappingOnly: true,
      noArtifactWritePerformed: true,
      noMemoryWritePerformed: true,
    }));
  });

  it('projects delegated worker state for Dashboard', () => {
    const snapshot = createService().buildSnapshot();

    expect(snapshot.dashboardProjection).toEqual(expect.objectContaining({
      title: 'Delegated Worker Bridge',
      status: 'delegated-worker-bridge-ready',
      tone: 'ready',
      policyPills: expect.arrayContaining([
        'zavorth-gateway-delegated-only',
        'bounded task envelope',
        'timeout/cancellation',
        'source launch blocked',
        'dry-run lifecycle',
        'artifact/event/status mapping',
      ]),
      nextSafeAction: 'Proceed to 291 Dashboard controls - Native Replacement And Decommission.',
    }));
    expect(snapshot.dashboardProjection.cards.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'workers',
      'task',
      'timeout',
      'launch',
      'lifecycle',
      'result',
      'live-workers',
    ]));
  });

  it('blocks Surface controls if Runtime gateway session memory is not ready', () => {
    const snapshot = createService().buildSnapshot({ sessionMemoryStatus: 'blocked' });

    expect(snapshot.status).toBe('blocked');
    expect(snapshot.previousSessionMemoryStatus).toBe('blocked');
    expect(snapshot.acceptanceMatrix.find((entry) => entry.requirementId === 'sessions-memory-continuation-ready')).toEqual(expect.objectContaining({
      status: 'failed',
    }));
  });

  it('formats an operator summary for the delegated worker bridge pack', () => {
    const service = createService();
    const text = service.formatSnapshotText(service.buildSnapshot());

    expect(text).toContain('Zavorth Delegated Worker Bridge - Surface controls');
    expect(text).toContain('Status: delegated-worker-bridge-ready');
    expect(text).toContain('Worker descriptors: 2');
    expect(text).toContain('Live workers started: 0');
    expect(text).toContain('Next: 291 Dashboard controls - Native Replacement And Decommission');
  });
});

function createService(): ZavorthDelegatedWorkerBridgeService {
  return new ZavorthDelegatedWorkerBridgeService({
    now: () => new Date('2026-05-11T22:25:00.000Z'),
    sessionMemoryStatus: 'session-memory-continuation-ready',
  });
}
