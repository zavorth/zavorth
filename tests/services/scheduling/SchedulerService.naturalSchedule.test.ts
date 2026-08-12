import { SchedulerService } from '../../../src/services/SchedulerService';
import {
  parseCanonicalSchedule,
  registerLlmScheduleResolver,
  type LlmScheduleIntentResolver,
  type NaturalScheduleParseResult,
} from '../../../src/services/scheduling/NaturalScheduleParser';

describe('SchedulerService schedule parsing', () => {
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

  it('parses canonical JSON schedules deterministically', () => {
    const service = makeService();
    expect(service.parseSchedule('{"kind":"interval","intervalMs":1800000}')).toMatchObject({
      kind: 'interval',
      normalized: '{"kind":"interval","intervalMs":1800000}',
    });
    expect(service.parseSchedule('{"kind":"calendar_day","targetHour":9,"targetMinute":30}')).toMatchObject({
      kind: 'calendar_day',
      cron: '30 9 * * *',
    });
    expect(service.parseSchedule('{"kind":"calendar_week","targetWeekday":5,"targetHour":18,"targetMinute":0}')).toMatchObject({
      kind: 'calendar_week',
      cron: '0 18 * * 5',
    });
    expect(service.parseSchedule('{"kind":"cron","cron":"0 10 * * 1"}')).toMatchObject({
      kind: 'cron',
      normalized: '{"kind":"cron","cron":"0 10 * * 1"}',
    });
  });

  it('keeps the deterministic boundary agnostic: natural text in any language is null', () => {
    const service = makeService();
    expect(service.parseSchedule('every day at 9am')).toBeNull();
    expect(service.parseSchedule('daily 09:30')).toBeNull();
    expect(service.parseSchedule('a cada 30 minutos')).toBeNull();
    expect(service.parseSchedule('toda sexta as 18h')).toBeNull();
    expect(service.parseSchedule('legacy interval schedule text')).toBeNull();
    expect(service.parseSchedule('legacy calendar schedule text')).toBeNull();
  });

  it('resolves natural-language schedules through the LLM resolver, regardless of language', async () => {
    const resolver: LlmScheduleIntentResolver = {
      resolveScheduleIntent: jest.fn(async (prompt: string): Promise<NaturalScheduleParseResult | null> => {
        if (prompt.includes('09:30')) {
          return parseCanonicalSchedule('{"kind":"calendar_day","targetHour":9,"targetMinute":30}')!;
        }
        return null;
      }),
    };
    registerLlmScheduleResolver(resolver);

    const service = makeService();
    const result = await service.parseScheduleAsync('lembre-me todos os dias as 09:30');
    expect(resolver.resolveScheduleIntent).toHaveBeenCalledWith('lembre-me todos os dias as 09:30');
    expect(result).toMatchObject({
      kind: 'calendar_day',
      normalized: '{"kind":"calendar_day","targetHour":9,"targetMinute":30}',
      cron: '30 9 * * *',
    });
  });

  it('describes canonical schedules from parser labels', () => {
    const service = makeService();
    expect(service.describeSchedule('{"kind":"interval","intervalMs":900000}')).toBe('interval 900000ms');
    expect(service.describeSchedule('{"kind":"calendar_day","targetHour":9,"targetMinute":0}')).toBe('calendar_day 09:00');
  });
});
