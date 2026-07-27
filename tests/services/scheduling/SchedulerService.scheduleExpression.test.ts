import { SchedulerService } from '../../../src/services/SchedulerService';

describe('SchedulerService schedule expressions', () => {
  function makeService(): SchedulerService {
    return new SchedulerService({
      listActiveTasks: jest.fn(),
      listTasks: jest.fn(),
      updateLastRun: jest.fn(),
      createTask: jest.fn(),
      getTask: jest.fn(),
      updateStatus: jest.fn(),
      deleteTask: jest.fn(),
    } as any);
  }

  it('accepts canonical JSON schedule expressions only', () => {
    const service = makeService();
    expect(service.parseSchedule('{"kind":"interval","intervalMs":1800000}')).toMatchObject({
      kind: 'interval',
      normalized: '{"kind":"interval","intervalMs":1800000}',
    });
    expect(service.parseSchedule('{"kind":"calendar_day","targetHour":9,"targetMinute":30}')).toMatchObject({
      kind: 'calendar_day',
      normalized: '{"kind":"calendar_day","targetHour":9,"targetMinute":30}',
      cron: '30 9 * * *',
    });
    expect(service.parseSchedule('{"kind":"calendar_week","targetWeekday":5,"targetHour":18,"targetMinute":0}')).toMatchObject({
      kind: 'calendar_week',
      normalized: '{"kind":"calendar_week","targetWeekday":5,"targetHour":18,"targetMinute":0}',
    });
    expect(service.parseSchedule('{"kind":"cron","cron":"0 10 * * 1"}')).toMatchObject({
      kind: 'cron',
      normalized: '{"kind":"cron","cron":"0 10 * * 1"}',
    });
  });

  it('rejects legacy keyword expressions at the deterministic boundary', () => {
    const service = makeService();
    expect(service.parseSchedule('legacy interval schedule text')).toBeNull();
    expect(service.parseSchedule('legacy calendar schedule text')).toBeNull();
    expect(service.parseSchedule('weekly 5 18:00')).toBeNull();
    expect(service.parseSchedule('every day at 9am')).toBeNull();
  });

  it('describes canonical schedules from parser labels', () => {
    const service = makeService();
    expect(service.describeSchedule('{"kind":"interval","intervalMs":900000}')).toBe('interval 900000ms');
    expect(service.describeSchedule('{"kind":"calendar_day","targetHour":9,"targetMinute":0}')).toBe('calendar_day 09:00');
  });
});
