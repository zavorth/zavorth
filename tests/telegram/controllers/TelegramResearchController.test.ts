import { TelegramResearchController } from '../../../src/telegram/controllers/TelegramResearchController';

describe('TelegramResearchController', () => {
  it('queues research requests and replies with a short reference', async () => {
    const task = {
      task_id: 'abcd1234-1234-1234-1234-1234567890ab',
      metadata: {},
    };
    const taskManager = {
      createPendingTask: jest.fn().mockReturnValue(task),
      saveTask: jest.fn(),
    } as any;
    const controller = new TelegramResearchController(taskManager);
    const ctx = {
      chat: { id: 42 },
      from: { id: 7 },
      reply: jest.fn().mockResolvedValue(undefined),
    } as any;

    await controller.handleResearch(ctx, 'latest news');

    expect(taskManager.createPendingTask).toHaveBeenCalled();
    expect(taskManager.saveTask).toHaveBeenCalledWith(task);
    expect(String(ctx.reply.mock.calls.map((c) => c?.[0]).join('\n'))).toContain('Short reference: abcd1234');
  });
});
