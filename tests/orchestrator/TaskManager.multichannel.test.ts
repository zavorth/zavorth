import { TaskManager } from '../../src/orchestrator/TaskManager';

function buildTaskRepo() {
  const saved: any[] = [];

  return {
    saved,
    save: jest.fn((task) => {
      saved.push(task);
    }),
    getById: jest.fn(),
    getPendingTasks: jest.fn().mockReturnValue([]),
    getRecentTasks: jest.fn().mockReturnValue([]),
    getLatestTaskForUser: jest.fn(),
  } as any;
}

describe('TaskManager multichannel readiness', () => {
  it('keeps Telegram as the default source for backward compatibility', () => {
    const taskRepo = buildTaskRepo();
    const taskManager = new TaskManager(taskRepo, { log: jest.fn() } as any);

    const task = taskManager.createPendingTask('chat-1', 'user-1', 'oi', 'oi', '/ping');

    expect(task.source).toBe('telegram');
    expect(taskRepo.save).toHaveBeenCalledWith(task);
  });

  it('persists an explicit Discord task source through the production API', () => {
    const taskRepo = buildTaskRepo();
    const taskManager = new TaskManager(taskRepo, { log: jest.fn() } as any);

    const task = taskManager.createPendingTask('chat-2', 'user-2', 'olha isso', 'olha isso', '/task', 'discord');

    expect(task).toMatchObject({
      source: 'discord',
      command_type: '/task',
      chat_id: 'chat-2',
      user_id: 'user-2',
    });
    expect(taskRepo.save).toHaveBeenLastCalledWith(task);
  });

  it('persists an explicit WhatsApp task source without mutating the payload shape', () => {
    const taskRepo = buildTaskRepo();
    const taskManager = new TaskManager(taskRepo, { log: jest.fn() } as any);

    const task = taskManager.createPendingTask('chat-3', 'user-3', 'bom dia', 'bom dia', '/auto', 'whatsapp');

    expect(taskRepo.saved.at(-1)).toMatchObject({
      source: 'whatsapp',
      command_type: '/auto',
      chat_id: 'chat-3',
      user_id: 'user-3',
      raw_message: 'bom dia',
    });
  });
});
