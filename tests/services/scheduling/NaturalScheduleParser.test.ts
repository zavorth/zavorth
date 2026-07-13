import {
  nextRunFromNaturalSchedule,
  parseNaturalSchedule,
} from '../../../src/services/scheduling/NaturalScheduleParser';

describe('NaturalScheduleParser (Phase 5)', () => {
  const fixedNow = new Date('2026-03-24T10:05:00.000Z'); // Tuesday

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('interval (EN + PT)', () => {
    it('parses every Nm / every Nh', () => {
      expect(parseNaturalSchedule('every 30m')).toMatchObject({
        kind: 'interval',
        normalized: 'every 30m',
        intervalMs: 30 * 60_000,
        cron: '*/30 * * * *',
      });
      expect(parseNaturalSchedule('every 2h')).toMatchObject({
        kind: 'interval',
        normalized: 'every 2h',
        intervalMs: 2 * 3_600_000,
        cron: '0 */2 * * *',
      });
    });

    it('parses every N minutes|hours and PT a cada', () => {
      expect(parseNaturalSchedule('every 15 minutes')?.normalized).toBe('every 15m');
      expect(parseNaturalSchedule('every 3 hours')?.normalized).toBe('every 3h');
      expect(parseNaturalSchedule('a cada 30 minutos')?.normalized).toBe('every 30m');
      expect(parseNaturalSchedule('a cada 2 horas')?.normalized).toBe('every 2h');
    });

    it('parses hourly / de hora em hora', () => {
      expect(parseNaturalSchedule('hourly')?.normalized).toBe('every 1h');
      expect(parseNaturalSchedule('de hora em hora')?.normalized).toBe('every 1h');
      expect(parseNaturalSchedule('a cada hora')?.normalized).toBe('every 1h');
    });

    it('rejects intervals below 1 minute or above 30 days', () => {
      expect(parseNaturalSchedule('every 0m')).toBeNull();
      expect(parseNaturalSchedule('every 50000h')).toBeNull();
    });

    it('computes next run from interval', () => {
      const parsed = parseNaturalSchedule('every 1h', fixedNow)!;
      const next = nextRunFromNaturalSchedule(parsed, fixedNow);
      expect(next?.toISOString()).toBe('2026-03-24T11:05:00.000Z');
    });
  });

  describe('daily (EN + PT)', () => {
    it('parses daily HH:mm and daily at am/pm', () => {
      expect(parseNaturalSchedule('daily 09:30')).toMatchObject({
        kind: 'daily',
        normalized: 'daily 09:30',
        localTime: '09:30',
        cron: '30 9 * * *',
      });
      expect(parseNaturalSchedule('daily at 9am')?.normalized).toBe('daily 09:00');
      expect(parseNaturalSchedule('daily at 9:30pm')?.normalized).toBe('daily 21:30');
      expect(parseNaturalSchedule('every day at 10:00')?.normalized).toBe('daily 10:00');
    });

    it('parses PT todo dia / diariamente', () => {
      expect(parseNaturalSchedule('todo dia as 9h')?.normalized).toBe('daily 09:00');
      expect(parseNaturalSchedule('todos os dias as 09:30')?.normalized).toBe('daily 09:30');
      expect(parseNaturalSchedule('diariamente as 18h')?.normalized).toBe('daily 18:00');
      expect(parseNaturalSchedule('todo dia')?.normalized).toBe('daily 09:00');
    });

    it('computes next daily run (rolls to next day when past)', () => {
      // fixedNow is 10:05 UTC; local depends on TZ — use explicit local clock via fromDate fields
      const from = new Date(2026, 2, 24, 10, 5, 0); // local 10:05
      const parsed = parseNaturalSchedule('daily 09:00', from)!;
      const next = nextRunFromNaturalSchedule(parsed, from)!;
      expect(next.getHours()).toBe(9);
      expect(next.getMinutes()).toBe(0);
      expect(next.getDate()).toBe(25);
    });
  });

  describe('weekly (EN + PT)', () => {
    it('parses every weekday and weekly on', () => {
      expect(parseNaturalSchedule('every monday')).toMatchObject({
        kind: 'weekly',
        weekday: 1,
        localTime: '09:00',
        cron: '0 9 * * 1',
      });
      expect(parseNaturalSchedule('every friday at 18:00')).toMatchObject({
        kind: 'weekly',
        weekday: 5,
        localTime: '18:00',
      });
      expect(parseNaturalSchedule('weekly on friday at 18:00')?.normalized).toBe(
        'weekly 5 18:00',
      );
    });

    it('parses PT toda segunda / toda sexta', () => {
      expect(parseNaturalSchedule('toda segunda')?.normalized).toBe('weekly 1 09:00');
      expect(parseNaturalSchedule('toda sexta-feira as 18h')?.normalized).toBe(
        'weekly 5 18:00',
      );
      expect(parseNaturalSchedule('semanalmente')?.normalized).toBe('weekly 1 09:00');
    });

    it('computes next weekly run', () => {
      // 2026-03-24 is Tuesday (2); next Monday is Mar 30
      const from = new Date(2026, 2, 24, 10, 5, 0);
      const parsed = parseNaturalSchedule('every monday at 10:00', from)!;
      const next = nextRunFromNaturalSchedule(parsed, from)!;
      expect(next.getDay()).toBe(1);
      expect(next.getDate()).toBe(30);
      expect(next.getHours()).toBe(10);
    });
  });

  describe('cron', () => {
    it('accepts 5-field cron as-is', () => {
      expect(parseNaturalSchedule('0 9 * * 1')).toMatchObject({
        kind: 'cron',
        normalized: '0 9 * * 1',
        cron: '0 9 * * 1',
      });
    });

    it('falls back to +1 min for cron next run', () => {
      const parsed = parseNaturalSchedule('0 9 * * *', fixedNow)!;
      const next = nextRunFromNaturalSchedule(parsed, fixedNow);
      expect(next?.getTime()).toBe(fixedNow.getTime() + 60_000);
    });
  });

  describe('invalid', () => {
    it('returns null for empty or unknown phrases', () => {
      expect(parseNaturalSchedule('')).toBeNull();
      expect(parseNaturalSchedule('every second')).toBeNull();
      expect(parseNaturalSchedule('quando der vontade')).toBeNull();
    });
  });
});
