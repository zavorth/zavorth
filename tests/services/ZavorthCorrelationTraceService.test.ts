import { ZavorthCorrelationTraceService } from '../../src/services/ZavorthCorrelationTraceService.js';

describe('ZavorthCorrelationTraceService', () => {
  it('decorates tasks with a stable trace id and links permissions, executors, replies and telemetry', () => {
    const service = new ZavorthCorrelationTraceService();
    const task = {
      task_id: 'task-35',
      chat_id: 'chat-35',
      raw_message: '/run token=SUPERSECRET',
      metadata: {},
    };

    const decorated = service.decorateTask(task);
    const snapshot = service.buildSnapshot({
      task: decorated,
      permissions: [
        { id: 'perm-35', task_id: 'task-35', metadata: { token: 'SUPERSECRET' } },
      ],
      executors: [
        { id: 'exec-35', traceId: 'task:task-35' },
      ],
      replies: [
        { id: 'reply-35', metadata: { traceId: 'task:task-35' } },
      ],
      telemetryEvents: [
        { id: 'event-35', traceId: 'task:task-35', source: 'execution-gateway', eventType: 'execution.completed' },
      ],
    });

    expect(decorated.metadata.traceId).toBe('task:task-35');
    expect(decorated.metadata.runId).toBe('task:task-35');
    expect(snapshot).toEqual(expect.objectContaining({
      traceId: 'task:task-35',
      runId: 'task:task-35',
      taskId: 'task-35',
      sessionId: 'chat-35',
    }));
    expect(snapshot.links).toEqual({
      task: true,
      permissions: 1,
      executors: 1,
      replies: 1,
      telemetryEvents: 1,
    });
    expect(JSON.stringify(snapshot)).not.toContain('SUPERSECRET');
  });
});
