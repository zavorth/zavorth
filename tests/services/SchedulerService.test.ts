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
          schedule: '{"kind":"interval","intervalMs":3600000}',
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

  it('supports canonical schedule JSON in the normalized parser', () => {
    const service = new SchedulerService({
      listActiveTasks: jest.fn(),
      listTasks: jest.fn(),
      updateLastRun: jest.fn(),
      createTask: jest.fn(),
      getTask: jest.fn(),
      updateStatus: jest.fn(),
      deleteTask: jest.fn(),
    } as any);

    expect(service.parseSchedule('{"kind":"calendar_day","targetHour":9,"targetMinute":30}')).toEqual({
      kind: 'calendar_day',
      normalized: '{"kind":"calendar_day","targetHour":9,"targetMinute":30}',
      label: 'calendar_day 09:30',
      cron: '30 9 * * *',
    });
    expect(service.parseSchedule('{"kind":"interval","intervalMs":1800000}')).toMatchObject({
      kind: 'interval',
      normalized: '{"kind":"interval","intervalMs":1800000}',
    });
    expect(service.parseSchedule('{"kind":"calendar_week","targetWeekday":5,"targetHour":18,"targetMinute":0}')).toMatchObject({
      kind: 'calendar_week',
      normalized: '{"kind":"calendar_week","targetWeekday":5,"targetHour":18,"targetMinute":0}',
    });
    expect(service.parseSchedule('legacy calendar schedule text')).toBeNull();
  });

  it('auto-pauses repeated failures and records a system notice', async () => {
    const repo = {
      listActiveTasks: jest.fn().mockReturnValue([
        {
          id: 'task-failing',
          command: '/ops failing',
          intent_text: 'run unstable recurring task',
          schedule: '{"kind":"interval","intervalMs":3600000}',
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
      summary: expect.stringContaining('Automation paused automatically'),
    }));
  });
});
