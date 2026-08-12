import { ZavorthAgentGateway } from '../../../src/runtime/agent/ZavorthAgentGateway.js';

describe('ZavorthAgentGateway native steering', () => {
  it('records add, replace, and cancel steering directly on the active run', async () => {
    const gateway = new ZavorthAgentGateway();
    const pending = await gateway.handle({
      userId: 'operator',
      channel: 'web',
      sessionId: 'web:steering',
      text: 'corrija o arquivo e rode npm test',
      requestedTools: ['workspace.write', 'shell.run'],
    });

    expect(pending.run.status).toBe('waiting_approval');

    const added = gateway.steer({
      runId: pending.run.id,
      sessionId: 'web:steering',
      text: 'Use runtime:check before broad tests.',
      source: 'zavorth-control-steer',
      queueItemId: 'queue-1',
      backoffMs: 2500,
      maxAttempts: 4,
    });

    expect(added.ok).toBe(true);
    expect(added.ack).toEqual(expect.objectContaining({
      runId: pending.run.id,
      status: 'accepted',
    }));
    expect(added.run?.steering).toEqual([
      expect.objectContaining({
        text: 'Use runtime:check before broad tests.',
        queueItemId: 'queue-1',
        backoffMs: 2500,
        maxAttempts: 4,
        status: 'accepted',
      }),
    ]);
    expect(added.run?.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'steering',
        title: 'Steering accepted',
        metadata: expect.objectContaining({
          nativeAgentRunSteering: true,
        }),
      }),
    ]));

    const replaced = gateway.steer({
      action: 'replace',
      runId: pending.run.id,
      sessionId: 'web:steering',
      steeringId: added.steering?.id,
      text: 'Run targeted tests first, then runtime:check.',
      source: 'zavorth-control-steer',
    });

    expect(replaced.ok).toBe(true);
    expect(replaced.steering).toEqual(expect.objectContaining({
      text: 'Run targeted tests first, then runtime:check.',
      replaceTargetId: added.steering?.id,
      status: 'accepted',
    }));
    expect(replaced.run?.steering?.find((entry) => entry.id === added.steering?.id)).toEqual(expect.objectContaining({
      status: 'superseded',
      replacedById: replaced.steering?.id,
    }));

    const cancelled = gateway.steer({
      action: 'cancel',
      runId: pending.run.id,
      sessionId: 'web:steering',
      steeringId: replaced.steering?.id,
      text: 'Operator replaced direction again.',
      source: 'zavorth-control-steer',
    });

    expect(cancelled.ok).toBe(true);
    expect(cancelled.steering).toEqual(expect.objectContaining({
      id: replaced.steering?.id,
      status: 'cancelled',
      cancelReason: 'Operator replaced direction again.',
    }));
    expect(cancelled.run?.metadata.agentRunSteering).toEqual(expect.objectContaining({
      schemaVersion: 1,
      source: 'AgentRunService',
      total: 2,
    }));
  });
});
