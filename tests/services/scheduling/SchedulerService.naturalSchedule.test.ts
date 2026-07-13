import { SchedulerService } from '../../../src/services/SchedulerService';

describe('SchedulerService natural schedules (Phase 5)', () => {
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

  it('parses canonical daily and exposes cron', () => {
    const service = makeService();
    expect(service.parseSchedule('daily 09:30')).toEqual({
      kind: 'daily',
      normalized: 'daily 09:30',
      label: 'daily at 09:30 / todo dia as 09:30',
      cron: '30 9 * * *',
    });
  });

  it('parses PT/EN natural phrases', () => {
    const service = makeService();
    expect(service.parseSchedule('todo dia as 9h')).toMatchObject({
      kind: 'daily',
      normalized: 'daily 09:00',
    });
    expect(service.parseSchedule('a cada 30 minutos')).toMatchObject({
      kind: 'interval',
      normalized: 'every 30m',
    });
    expect(service.parseSchedule('toda sexta as 18h')).toMatchObject({
      kind: 'weekly',
      normalized: 'weekly 5 18:00',
    });
    expect(service.parseSchedule('every monday at 10am')).toMatchObject({
      kind: 'weekly',
      normalized: 'weekly 1 10:00',
    });
  });

  it('describes schedules with bilingual labels', () => {
    const service = makeService();
    expect(service.describeSchedule('every 15m')).toMatch(/every 15 minute/i);
    expect(service.describeSchedule('daily 09:00')).toMatch(/todo dia/i);
  });
});
