import { InternalExecutionApiService } from '../../src/api/internal/InternalExecutionApiService';

describe('InternalExecutionApiService', () => {
  it('attaches canonical lifecycle records to execution decisions', async () => {
    const service = new InternalExecutionApiService();

    const decision = await service.decide({
      objective: 'Run a supervised build',
      surface: 'cli',
      requestedBy: 'operator',
      correlation: {
        traceId: 'trace-1',
        runId: 'run-1',
        sessionId: 'session-1',
        approvalId: 'approval-1',
      },
    });

    expect(decision.ok).toBe(false);
    expect(decision.decision).toBe('approval_required');
    expect(decision.correlation).toEqual(expect.objectContaining({
      traceId: 'trace-1',
      runId: 'run-1',
      sessionId: 'session-1',
      approvalId: 'approval-1',
    }));
    expect(decision.lifecycle).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'intent',
        status: 'received',
        runId: 'run-1',
      }),
      expect.objectContaining({
        kind: 'run',
        status: 'approval_required',
        runId: 'run-1',
      }),
      expect.objectContaining({
        kind: 'approval',
        status: 'approval_required',
        approvalId: 'approval-1',
      }),
    ]));
  });

  it('links outcome artifacts to the same canonical run', async () => {
    const service = new InternalExecutionApiService({
      executeExecution: async () => ({
        status: 'completed',
        artifacts: ['artifact-1'],
        summary: 'Completed with artifact.',
      }),
    });

    const outcome = await service.execute({
      objective: 'Produce artifact',
      surface: 'web',
      requestedBy: 'operator',
      approved: true,
      correlation: {
        traceId: 'trace-2',
        runId: 'run-2',
      },
    });

    expect(outcome.ok).toBe(true);
    expect(outcome.lifecycle).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'run',
        status: 'completed',
        runId: 'run-2',
      }),
      expect.objectContaining({
        kind: 'artifact',
        id: 'artifact-1',
        artifactId: 'artifact-1',
        parentId: 'run-2',
      }),
    ]));
  });
});
