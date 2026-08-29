import {
  nextRunFromNaturalSchedule,
  parseCanonicalSchedule,
  parseNaturalSchedule,
  parseNaturalScheduleAsync,
  registerLlmScheduleResolver,
  type LlmScheduleIntentResolver,
  type NaturalScheduleParseResult,
} from '../../../src/services/scheduling/NaturalScheduleParser';

describe('NaturalScheduleParser', () => {
  const fixedNow = new Date('2026-03-24T10:05:00.000Z');

  describe('canonical JSON contract', () => {
    it('parses canonical interval', () => {
      expect(parseCanonicalSchedule('{"kind":"interval","intervalMs":1800000}')).toMatchObject({
        kind: 'interval',
        intervalMs: 1800000,
        cron: null,
      });
    });

    it('parses canonical calendar_day', () => {
      expect(parseCanonicalSchedule('{"kind":"calendar_day","targetHour":9,"targetMinute":30}')).toMatchObject({
        kind: 'calendar_day',
        localTime: '09:30',
        cron: '30 9 * * *',
      });
    });

    it('parses canonical calendar_week', () => {
      expect(parseCanonicalSchedule('{"kind":"calendar_week","targetWeekday":5,"targetHour":18,"targetMinute":0}')).toMatchObject({
        kind: 'calendar_week',
        weekday: 5,
        cron: '0 18 * * 5',
      });
    });

    it('parses canonical one_shot', () => {
      expect(parseCanonicalSchedule('{"kind":"one_shot","targetTimestamp":"2026-04-01T00:00:00.000Z"}')).toMatchObject({
        kind: 'one_shot',
        targetTimestamp: '2026-04-01T00:00:00.000Z',
      });
    });

    it('parses canonical cron', () => {
      expect(parseCanonicalSchedule('{"kind":"cron","cron":"0 9 * * 1"}')).toMatchObject({
        kind: 'cron',
        cron: '0 9 * * 1',
      });
    });

    it('rejects malformed or unknown canonical input', () => {
      expect(parseCanonicalSchedule('')).toBeNull();
      expect(parseCanonicalSchedule('not json')).toBeNull();
      expect(parseCanonicalSchedule('{"kind":"unknown"}')).toBeNull();
      expect(parseCanonicalSchedule('{"kind":"interval","intervalMs":0}')).toBeNull();
      expect(parseCanonicalSchedule('{"kind":"one_shot"}')).toBeNull();
    });
  });

  describe('deterministic boundary stays language-agnostic', () => {
    it('does not interpret natural-language phrases from any language', () => {
      expect(parseNaturalSchedule('every 30m')).toBeNull();
      expect(parseNaturalSchedule('daily 09:30')).toBeNull();
      expect(parseNaturalSchedule('a cada 30 minutos')).toBeNull();
      expect(parseNaturalSchedule('toda sexta as 18h')).toBeNull();
      expect(parseNaturalSchedule('every day at 9am')).toBeNull();
      expect(parseNaturalSchedule('')).toBeNull();
    });

    it('still accepts canonical JSON through the deterministic entry point', () => {
      expect(parseNaturalSchedule('{"kind":"calendar_day","targetHour":9,"targetMinute":0}')).toMatchObject({
        kind: 'calendar_day',
        localTime: '09:00',
      });
    });
  });

  describe('LLM-centered natural resolution', () => {
    it('returns null for natural text when no resolver is registered', async () => {
      expect(await parseNaturalScheduleAsync('remind me every day at 09:30')).toBeNull();
    });

    it('passes canonical JSON through without invoking the resolver', async () => {
      const resolver = jest.fn();
      registerLlmScheduleResolver(resolver);
      const parsed = await parseNaturalScheduleAsync('{"kind":"interval","intervalMs":900000}');
      expect(parsed).toMatchObject({ kind: 'interval', intervalMs: 900000 });
      expect(resolver).not.toHaveBeenCalled();
    });

    it('resolves natural text through the injected resolver regardless of language', async () => {
      const resolver: LlmScheduleIntentResolver = {
        resolveScheduleIntent: jest.fn(async (prompt: string): Promise<NaturalScheduleParseResult | null> => {
          if (prompt.includes('09:30')) {
            return parseCanonicalSchedule('{"kind":"calendar_day","targetHour":9,"targetMinute":30}')!;
          }
          return null;
        }),
      };
      registerLlmScheduleResolver(resolver);

      const parsed = await parseNaturalScheduleAsync('lembre-me todos os dias as 09:30');
      expect(resolver.resolveScheduleIntent).toHaveBeenCalledWith('lembre-me todos os dias as 09:30');
      expect(parsed).toMatchObject({ kind: 'calendar_day', localTime: '09:30', cron: '30 9 * * *' });
    });
  });

  describe('next run computation', () => {
    it('adds the interval to the reference time', () => {
      const parsed = parseCanonicalSchedule('{"kind":"interval","intervalMs":3600000}')!;
      expect(nextRunFromNaturalSchedule(parsed, fixedNow)?.toISOString()).toBe('2026-03-24T11:05:00.000Z');
    });

    it('rolls a past daily time to the next day', () => {
      const from = new Date(2026, 2, 24, 10, 5, 0);
      const parsed = parseCanonicalSchedule('{"kind":"calendar_day","targetHour":9,"targetMinute":0}')!;
      const next = nextRunFromNaturalSchedule(parsed, from)!;
      expect(next.getHours()).toBe(9);
      expect(next.getMinutes()).toBe(0);
      expect(next.getDate()).toBe(25);
    });

    it('finds the next weekly occurrence', () => {
      const from = new Date(2026, 2, 24, 10, 5, 0);
      const parsed = parseCanonicalSchedule('{"kind":"calendar_week","targetWeekday":1,"targetHour":10,"targetMinute":0}')!;
      const next = nextRunFromNaturalSchedule(parsed, from)!;
      expect(next.getDay()).toBe(1);
      expect(next.getDate()).toBe(30);
      expect(next.getHours()).toBe(10);
    });

    it('advances a cron schedule by one minute', () => {
      const parsed = parseCanonicalSchedule('{"kind":"cron","cron":"0 9 * * *"}')!;
      expect(nextRunFromNaturalSchedule(parsed, fixedNow)?.getTime()).toBe(fixedNow.getTime() + 60_000);
    });

    it('returns the target timestamp for one_shot', () => {
      const parsed = parseCanonicalSchedule('{"kind":"one_shot","targetTimestamp":"2026-04-01T00:00:00.000Z"}')!;
      expect(nextRunFromNaturalSchedule(parsed, fixedNow)?.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    });
  });
});
