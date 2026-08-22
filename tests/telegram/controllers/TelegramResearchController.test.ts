import { TelegramResearchController } from '../../../src/telegram/controllers/TelegramResearchController';

interface MockTask {
  task_id: string;
  metadata: Record<string, unknown>;
}

interface MockTaskManager {
  createPendingTask: jest.Mock;
  saveTask: jest.Mock;
}

interface MockContext {
  chat: { id: number };
  from: { id: number };
  reply: jest.Mock;
}

describe('TelegramResearchController', () => {
  it('queues research requests and replies with a short reference', async () => {
    const task: MockTask = {
      task_id: 'abcd1234-1234-1234-1234-1234567890ab',
      metadata: {},
    };
    const taskManager: MockTaskManager = {
      createPendingTask: jest.fn().mockReturnValue(task),
      saveTask: jest.fn(),
    };
    const controller = new TelegramResearchController(taskManager as unknown as never);
    const ctx: MockContext = {
      chat: { id: 42 },
      from: { id: 7 },
      reply: jest.fn().mockResolvedValue(undefined),
    };

    await controller.handleResearch(ctx as unknown as Parameters<typeof controller.handleResearch>[0], 'ultimas noticias');

    expect(taskManager.createPendingTask).toHaveBeenCalled();
    expect(taskManager.saveTask).toHaveBeenCalledWith(task);
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Short reference: abcd1234');
  });
});
