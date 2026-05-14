import { JulesQueueWorker } from '../../src/orchestrator/JulesQueueWorker';

jest.setTimeout(15000);

describe('JulesQueueWorker', () => {
  it('delivers the final Jules result to Telegram when the remote session completes', async () => {
    const task = {
      task_id: 'task-jules-1',
      chat_id: '42',
      user_id: '42',
      command_type: '/jules',
      status: 'delivery_pending',
      result_summary: null,
      diff_summary: null,
      error_summary: null,
      metadata: {
        jules_session_id: 'sessions/123',
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
    const worker = new JulesQueueWorker({
      taskManager,
      botApi,
      log: jest.fn(),
      julesClient: {
        inspectSession: jest.fn().mockResolvedValue({
          state: 'COMPLETED',
          summary: 'Resumo final do Jules',
          diffUrl: 'https://example.com/diff/123',
        }),
      },
    });

    await (worker as any).tick();

    expect(botApi.sendMessage).toHaveBeenCalled();
    expect(task.result_summary).toBe('Resumo final do Jules');
    expect(task.diff_summary).toBe('https://example.com/diff/123');
    expect(task.status).toBe('completed');
  });

  it('keeps Jules tasks in waiting_approval while the external plan still awaits approval', async () => {
    const task = {
      task_id: 'task-jules-approval',
      chat_id: '42',
      user_id: '42',
      command_type: '/jules',
      status: 'waiting_approval',
      result_summary: null,
      diff_summary: null,
      error_summary: null,
      metadata: {
        jules_session_id: 'sessions/approval',
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
    const worker = new JulesQueueWorker({
      taskManager,
      botApi,
      log: jest.fn(),
      julesClient: {
        inspectSession: jest.fn().mockResolvedValue({
          state: 'PLAN_REVIEW',
        }),
      },
    });

    await (worker as any).tick();

    expect(task.status).toBe('waiting_approval');
    expect(task.metadata.jules_requires_approval).toBe(true);
    expect(botApi.sendMessage).not.toHaveBeenCalled();
  });
});
