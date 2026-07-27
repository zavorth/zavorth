import { RepositoryQueueWorker } from './stubs/RepositoryQueueWorker';

jest.setTimeout(15000);

describe('RepositoryQueueWorker', () => {
  it('delivers the final repository result to Telegram when the session completes', async () => {
    const task = {
      task_id: 'task-repository-1',
      chat_id: '42',
      user_id: '42',
      command_type: '/repository-executor',
      status: 'delivery_pending',
      result_summary: null,
      diff_summary: null,
      error_summary: null,
      metadata: {
        repository_session_id: 'sessions/123',
      },
    } as any;
    const taskManager = {
      claimNextTaskByCommands: jest.fn().mockReturnValue(task),
      advanceState: jest.fn((targetTask: any, status: string) => {
        targetTask.status = status;
      }),
      saveTask: jest.fn(),
    } as any;
    const botApi = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
    } as any;
    const worker = new RepositoryQueueWorker({
      taskManager,
      botApi,
      log: jest.fn(),
      repositoryClient: {
        inspectSession: jest.fn().mockResolvedValue({
          state: 'COMPLETED',
          summary: 'Final repository result',
          diffUrl: 'https://example.com/diff/123',
        }),
      },
    });

    await (worker as any).tick();

    expect(botApi.sendMessage).toHaveBeenCalled();
    expect(task.result_summary).toBe('Final repository result');
    expect(task.diff_summary).toBe('https://example.com/diff/123');
    expect(task.status).toBe('completed');
  });

  it('keeps repository tasks in waiting_approval while the plan awaits approval', async () => {
    const task = {
      task_id: 'task-repository-approval',
      chat_id: '42',
      user_id: '42',
      command_type: '/repository-executor',
      status: 'waiting_approval',
      result_summary: null,
      diff_summary: null,
      error_summary: null,
      metadata: {
        repository_session_id: 'sessions/approval',
      },
    } as any;
    const taskManager = {
      claimNextTaskByCommands: jest.fn().mockReturnValue(task),
      advanceState: jest.fn((targetTask: any, status: string) => {
        targetTask.status = status;
      }),
      saveTask: jest.fn(),
    } as any;
    const botApi = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
    } as any;
    const worker = new RepositoryQueueWorker({
      taskManager,
      botApi,
      log: jest.fn(),
      repositoryClient: {
        inspectSession: jest.fn().mockResolvedValue({
          state: 'PLAN_REVIEW',
        }),
      },
    });

    await (worker as any).tick();

    expect(task.status).toBe('waiting_approval');
    expect(task.metadata.repository_requires_approval).toBe(true);
    expect(botApi.sendMessage).not.toHaveBeenCalled();
  });
});
