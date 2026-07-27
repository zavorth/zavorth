import {
  nextRunFromNaturalSchedule,
  parseNaturalSchedule,
  parseNaturalScheduleAsync,
} from '../../../src/services/scheduling/NaturalScheduleParser';

describe('NaturalScheduleParser canonical contract', () => {
  const fixedNow = new Date('2026-03-24T10:05:00.000Z');

  it('accepts interval JSON without language keywords', () => {
    expect(parseNaturalSchedule('{"kind":"interval","intervalMs":7200000}')).toMatchObject({
      kind: 'interval',
      normalized: '{"kind":"interval","intervalMs":7200000}',
      intervalMs: 7_200_000,
      cron: null,
    });
  });

  it('accepts calendar day and calendar week JSON', () => {
    expect(parseNaturalSchedule('{"kind":"calendar_day","targetHour":9,"targetMinute":30}')).toMatchObject({
      kind: 'calendar_day',
      normalized: '{"kind":"calendar_day","targetHour":9,"targetMinute":30}',
      localTime: '09:30',
      cron: '30 9 * * *',
    });
    expect(parseNaturalSchedule('{"kind":"calendar_week","targetWeekday":5,"targetHour":18,"targetMinute":0}')).toMatchObject({
      kind: 'calendar_week',
      normalized: '{"kind":"calendar_week","targetWeekday":5,"targetHour":18,"targetMinute":0}',
      weekday: 5,
      localTime: '18:00',
    });
  });

  it('does not parse natural language at the deterministic boundary', () => {
    expect(parseNaturalSchedule('legacy interval schedule text')).toBeNull();
    expect(parseNaturalSchedule('legacy calendar schedule text')).toBeNull();
    expect(parseNaturalSchedule('legacy natural-language schedule text')).toBeNull();
  });

  it('delegates natural language to the async resolver', async () => {
    const resolved = await parseNaturalScheduleAsync('user language request', {
      async resolveScheduleIntent() {
        return parseNaturalSchedule('{"kind":"calendar_day","targetHour":9,"targetMinute":0}');
      },
    });

    expect(resolved).toMatchObject({
      kind: 'calendar_day',
      normalized: '{"kind":"calendar_day","targetHour":9,"targetMinute":0}',
    });
  });

  it('computes next runs from canonical schedules', () => {
    const interval = parseNaturalSchedule('{"kind":"interval","intervalMs":3600000}')!;
    expect(nextRunFromNaturalSchedule(interval, fixedNow)?.toISOString())
      .toBe('2026-03-24T11:05:00.000Z');

    const from = new Date(2026, 2, 24, 10, 5, 0);
    const calendarDay = parseNaturalSchedule('{"kind":"calendar_day","targetHour":9,"targetMinute":0}')!;
    const dayNext = nextRunFromNaturalSchedule(calendarDay, from)!;
    expect(dayNext.getDate()).toBe(25);
    expect(dayNext.getHours()).toBe(9);

    const calendarWeek = parseNaturalSchedule('{"kind":"calendar_week","targetWeekday":1,"targetHour":10,"targetMinute":0}')!;
    const weekNext = nextRunFromNaturalSchedule(calendarWeek, from)!;
    expect(weekNext.getDay()).toBe(1);
    expect(weekNext.getDate()).toBe(30);
  });

  it('accepts cron JSON and uses the conservative next-run fallback', () => {
    const parsed = parseNaturalSchedule('{"kind":"cron","cron":"0 9 * * 1"}')!;
    expect(parsed).toMatchObject({
      kind: 'cron',
      normalized: '{"kind":"cron","cron":"0 9 * * 1"}',
      cron: '0 9 * * 1',
    });
    expect(nextRunFromNaturalSchedule(parsed, fixedNow)?.getTime())
      .toBe(fixedNow.getTime() + 60_000);
  });
});
