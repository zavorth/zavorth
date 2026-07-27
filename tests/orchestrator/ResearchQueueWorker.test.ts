import { ResearchQueueWorker } from '../../src/orchestrator/ResearchQueueWorker';

jest.setTimeout(15000);

describe('ResearchQueueWorker', () => {
  it('executes queued research tasks and delivers the result to Telegram', async () => {
    const task = {
      task_id: 'task-research-1',
      chat_id: '42',
      user_id: '42',
      command_type: '/research',
      normalized_message: 'latest ai news',
      status: 'pending',
      result_summary: null,
      error_summary: null,
      metadata: {
        research_query: 'latest ai news',
      },
    } as any;
    const taskManager = {
      claimNextTaskByCommands: jest.fn().mockReturnValue(task),
      advanceState: jest.fn((targetTask: any, status: string) => {
        targetTask.status = status;
      }),
      saveTask: jest.fn(),
    } as any;
    const deepSearchService = {
      research: jest.fn().mockResolvedValue('synthesized result'),
      deepResearch: jest.fn(),
    } as any;
    const botApi = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
    } as any;
    const worker = new ResearchQueueWorker({
      taskManager,
      deepSearchService,
      botApi,
      log: jest.fn(),
    });

    await (worker as any).tick();

    expect(deepSearchService.research).toHaveBeenCalledWith('latest ai news');
    expect(botApi.sendMessage).toHaveBeenCalled();
    expect(task.status).toBe('completed');
    expect(task.result_summary).toContain('synthesized result');
  });
});
