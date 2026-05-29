import { AgentRunService } from '../../src/runtime/agent/AgentRunService';
import { executionContextScope, type ExecutionContextScopeSnapshot } from '../../src/runtime/context/ExecutionContextScope';

describe('AgentRunService execution context isolation', () => {
  it('binds the exact run context while the executor is running', async () => {
    let captured: ExecutionContextScopeSnapshot | null = null;

    const service = new AgentRunService({
      idFactory: (prefix) => `${prefix}-stable`,
      executor: () => {
        captured = executionContextScope.requireCurrent();
        return {
          status: 'completed',
          summary: 'context captured',
          replyText: 'context captured',
        };
      },
    });

    const result = await service.run({
      requestId: 'request-alpha',
      traceId: 'trace-alpha',
      userId: 'operator-1',
      sessionId: 'session-alpha',
      channel: 'cli',
      text: 'capture execution context',
      workspace: 'C:/workspaces/zavorth',
      metadata: {
        profile: 'developer',
      },
    });

    expect(result.ok).toBe(true);
    expect(captured).not.toBeNull();
    expect(captured?.runId).toBe(result.run.id);
    expect(captured?.traceId).toBe(result.run.traceId);
    expect(captured?.sessionId).toBe('session-alpha');
    expect(captured?.surface).toBe('cli');
    expect(captured?.requestedBy).toBe('operator-1');
    expect(captured?.profile).toBe('developer');
    expect(captured?.profileBundle?.id).toBe('developer');
    expect(captured?.profileBundle?.runtimePolicy.sandboxMode).toBe('required');
    expect(captured?.workspace).toBe('C:/workspaces/zavorth');
    expect(executionContextScope.current()).toBeNull();
  });
});
