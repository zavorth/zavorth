import { SchedulerService } from '../../src/services/SchedulerService';

describe('SchedulerService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-24T10:05:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('schedules recurring tasks from the previous scheduled run to avoid drift', async () => {
    const repo = {
      listActiveTasks: jest.fn().mockReturnValue([
        {
          id: 'task-1',
          command: '/deepresearch ia',
          schedule: 'every 1h',
          created_at: '2026-03-24T09:00:00.000Z',
          last_run: null,
          next_run: '2026-03-24T10:00:00.000Z',
          created_by: 'u1',
          status: 'active',
        },
      ]),
      updateLastRun: jest.fn(),
      createTask: jest.fn(),
      getTask: jest.fn(),
      listTasks: jest.fn().mockReturnValue([]),
      updateStatus: jest.fn(),
      deleteTask: jest.fn(),
    } as any;

    const dispatcher = jest.fn().mockResolvedValue({ summary: 'ok' });
    const deliveryService = { deliver: jest.fn() };
    const service = new SchedulerService(repo, { deliveryService } as any);
    (service as any).dispatcher = dispatcher;

    await (service as any).tick();

    expect(dispatcher).toHaveBeenCalledWith('/deepresearch ia', 'u1', expect.objectContaining({ id: 'task-1' }));
    expect(deliveryService.deliver).not.toHaveBeenCalled();
    expect(repo.updateLastRun).toHaveBeenCalledWith(
      'task-1',
      expect.objectContaining({
        lastRun: '2026-03-24T10:05:00.000Z',
        nextRun: '2026-03-24T11:00:00.000Z',
        lastStatus: 'completed',
        lastResult: 'ok',
      }),
    );
  });

  it('supports daily schedules in the normalized parser', () => {
    const service = new SchedulerService({
      listActiveTasks: jest.fn(),
      listTasks: jest.fn(),
      updateLastRun: jest.fn(),
      createTask: jest.fn(),
      getTask: jest.fn(),
      updateStatus: jest.fn(),
      deleteTask: jest.fn(),
    } as any);

    expect(service.parseSchedule('daily 09:30')).toEqual({
      kind: 'daily',
      normalized: 'daily 09:30',
      label: 'todo dia as 09:30',
    });
  });

  it('auto-pauses repeated failures and records a system notice', async () => {
    const repo = {
      listActiveTasks: jest.fn().mockReturnValue([
        {
          id: 'task-failing',
          command: '/ops failing',
          intent_text: 'a cada 1h rodar tarefa instavel',
          schedule: 'every 1h',
          created_at: '2026-03-24T09:00:00.000Z',
          last_run: '2026-03-24T09:00:00.000Z',
          next_run: '2026-03-24T10:00:00.000Z',
          created_by: 'u1',
          status: 'active',
          last_status: 'failed',
          consecutive_failures: 2,
          failure_count: 2,
          guardrail_json: JSON.stringify({
            autoPauseAfterConsecutiveFailures: 3,
            pauseCreatesInboxNotice: true,
          }),
        },
      ]),
      updateLastRun: jest.fn(),
      createTask: jest.fn(),
      getTask: jest.fn(),
      listTasks: jest.fn().mockReturnValue([]),
      updateStatus: jest.fn(),
      deleteTask: jest.fn(),
    } as any;

    const dispatcher = jest.fn().mockRejectedValue(new Error('boom'));
    const deliveryService = {
      deliver: jest.fn(),
      recordSystemNotice: jest.fn(),
    };
    const service = new SchedulerService(repo, { deliveryService } as any);
    (service as any).dispatcher = dispatcher;

    await (service as any).tick();

    expect(repo.updateLastRun).toHaveBeenCalledWith(
      'task-failing',
      expect.objectContaining({
        lastStatus: 'failed',
        consecutiveFailures: 3,
        failureCount: 3,
      }),
    );
    expect(repo.updateStatus).toHaveBeenCalledWith(
      'task-failing',
      'paused',
      'auto-paused after 3 consecutive failures',
    );
    expect(deliveryService.recordSystemNotice).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-failing',
      summary: expect.stringContaining('Automacao pausada automaticamente'),
    }));
  });
});
