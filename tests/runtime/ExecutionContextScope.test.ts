import { executionContextScope, ExecutionContextScope } from '../../src/runtime/context/ExecutionContextScope';

describe('ExecutionContextScope', () => {
  it('keeps async execution contexts isolated', async () => {
    const scope = new ExecutionContextScope();

    const [developer, personal] = await Promise.all([
      scope.run({
        traceId: 'trace-dev',
        runId: 'run-dev',
        sessionId: 'session-dev',
        surface: 'cli',
        requestedBy: 'developer',
        profile: 'developer',
        workspace: 'C:/repo',
      }, async () => {
        await Promise.resolve();
        return scope.requireCurrent();
      }),
      scope.run({
        traceId: 'trace-personal',
        runId: 'run-personal',
        sessionId: 'session-personal',
        surface: 'telegram',
        requestedBy: 'operator',
        profile: 'personal',
        workspace: null,
      }, async () => {
        await Promise.resolve();
        return scope.requireCurrent();
      }),
    ]);

    expect(developer.profile).toBe('developer');
    expect(developer.surface).toBe('cli');
    expect(personal.profile).toBe('personal');
    expect(personal.surface).toBe('telegram');
  });

  it('does not leak context after a scoped run finishes', async () => {
    await executionContextScope.run({
      traceId: 'trace',
      runId: 'run',
      sessionId: 'session',
      surface: 'cli',
      requestedBy: 'operator',
      profile: 'developer',
    }, async () => {
      expect(executionContextScope.current()?.runId).toBe('run');
    });

    expect(executionContextScope.current()).toBeNull();
  });
});
