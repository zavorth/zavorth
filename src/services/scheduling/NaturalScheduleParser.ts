export type NaturalScheduleKind = 'interval' | 'calendar_day' | 'calendar_week' | 'cron' | 'one_shot';

export type NaturalScheduleParseResult = {
  kind: NaturalScheduleKind;
  normalized: string;
  label: string;
  cron: string | null;
  intervalMs: number | null;
  localTime: string | null;
  weekday: number | null;
  targetTimestamp: string | null;
};

export interface LlmScheduleIntentResolver {
  resolveScheduleIntent(userPrompt: string): Promise<NaturalScheduleParseResult | null>;
}

let activeLlmResolver: LlmScheduleIntentResolver | null = null;

export function registerLlmScheduleResolver(resolver: LlmScheduleIntentResolver): void {
  activeLlmResolver = resolver;
}

export function parseCanonicalSchedule(rawInput: string): NaturalScheduleParseResult | null {
  if (!rawInput) return null;
  const trimmed = rawInput.trim();
  if (trimmed.charAt(0) !== '{' || trimmed.charAt(trimmed.length - 1) !== '}') {
    return null;
  }

  try {
    const data = JSON.parse(trimmed) as Record<string, unknown>;
    const kind = normalizeScheduleKind(data.kind);

    if (kind === 'interval') {
      const intervalMs = Number(data.intervalMs);
      if (!Number.isFinite(intervalMs) || intervalMs <= 0) return null;
      return {
        kind: 'interval',
        normalized: JSON.stringify({ kind: 'interval', intervalMs }),
        label: `interval ${intervalMs}ms`,
        cron: null,
        intervalMs,
        localTime: null,
        weekday: null,
        targetTimestamp: null,
      };
    }

    if (kind === 'calendar_day') {
      const hour = Math.max(0, Math.min(23, Number(data.targetHour ?? data.hour ?? 0)));
      const minute = Math.max(0, Math.min(59, Number(data.targetMinute ?? data.minute ?? 0)));
      const hh = String(hour).padStart(2, '0');
      const mm = String(minute).padStart(2, '0');
      const localTime = `${hh}:${mm}`;
      return {
        kind: 'calendar_day',
        normalized: JSON.stringify({ kind: 'calendar_day', targetHour: hour, targetMinute: minute }),
        label: `calendar_day ${localTime}`,
        cron: `${minute} ${hour} * * *`,
        intervalMs: 24 * 60 * 60 * 1000,
        localTime,
        weekday: null,
        targetTimestamp: null,
      };
    }

    if (kind === 'calendar_week') {
      const weekday = Math.max(0, Math.min(6, Number(data.targetWeekday ?? data.weekday ?? 0)));
      const hour = Math.max(0, Math.min(23, Number(data.targetHour ?? data.hour ?? 0)));
      const minute = Math.max(0, Math.min(59, Number(data.targetMinute ?? data.minute ?? 0)));
      const hh = String(hour).padStart(2, '0');
      const mm = String(minute).padStart(2, '0');
      const localTime = `${hh}:${mm}`;
      return {
        kind: 'calendar_week',
        normalized: JSON.stringify({ kind: 'calendar_week', targetWeekday: weekday, targetHour: hour, targetMinute: minute }),
        label: `calendar_week ${weekday} ${localTime}`,
        cron: `${minute} ${hour} * * ${weekday}`,
        intervalMs: 7 * 24 * 60 * 60 * 1000,
        localTime,
        weekday,
        targetTimestamp: null,
      };
    }

    if (kind === 'one_shot') {
      const targetTimestamp = String(data.targetTimestamp || data.timestamp || '');
      if (!targetTimestamp) return null;
      return {
        kind: 'one_shot',
        normalized: JSON.stringify({ kind: 'one_shot', targetTimestamp }),
        label: `one_shot ${targetTimestamp}`,
        cron: null,
        intervalMs: null,
        localTime: null,
        weekday: null,
        targetTimestamp,
      };
    }

    if (kind === 'cron') {
      const cron = String(data.cron || '').trim();
      if (!cron) return null;
      return {
        kind: 'cron',
        normalized: JSON.stringify({ kind: 'cron', cron }),
        label: 'cron',
        cron,
        intervalMs: null,
        localTime: null,
        weekday: null,
        targetTimestamp: null,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function parseNaturalSchedule(rawInput: string, _now: Date = new Date()): NaturalScheduleParseResult | null {
  return parseCanonicalSchedule(rawInput);
}

export async function parseNaturalScheduleAsync(
  rawInput: string,
  resolver?: LlmScheduleIntentResolver,
): Promise<NaturalScheduleParseResult | null> {
  const directCanonical = parseCanonicalSchedule(rawInput);
  if (directCanonical) return directCanonical;

  const activeResolver = resolver || activeLlmResolver;
  if (!activeResolver) {
    return null;
  }

  return activeResolver.resolveScheduleIntent(rawInput);
}

export function nextRunFromNaturalSchedule(
  parsed: NaturalScheduleParseResult,
  fromDate: Date = new Date(),
): Date | null {
  if (parsed.kind === 'interval' && parsed.intervalMs) {
    return new Date(fromDate.getTime() + parsed.intervalMs);
  }

  if (parsed.kind === 'calendar_day' && parsed.localTime) {
    const parts = parsed.localTime.split(':');
    const hh = Number(parts[0]);
    const mm = Number(parts[1]);
    const next = new Date(fromDate);
    next.setSeconds(0, 0);
    next.setHours(hh, mm, 0, 0);
    if (next.getTime() <= fromDate.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  if (parsed.kind === 'calendar_week' && parsed.localTime && parsed.weekday !== null) {
    const parts = parsed.localTime.split(':');
    const hh = Number(parts[0]);
    const mm = Number(parts[1]);
    const next = new Date(fromDate);
    next.setSeconds(0, 0);
    next.setHours(hh, mm, 0, 0);
    const currentDow = next.getDay();
    let delta = parsed.weekday - currentDow;
    if (delta < 0 || (delta === 0 && next.getTime() <= fromDate.getTime())) {
      delta += 7;
    }
    next.setDate(next.getDate() + delta);
    return next;
  }

  if (parsed.kind === 'one_shot' && parsed.targetTimestamp) {
    const target = new Date(parsed.targetTimestamp);
    return Number.isNaN(target.getTime()) ? null : target;
  }

  if (parsed.kind === 'cron') {
    return new Date(fromDate.getTime() + 60_000);
  }

  return null;
}

function normalizeScheduleKind(value: unknown): NaturalScheduleKind | null {
  switch (String(value || '')) {
    case 'interval':
      return 'interval';
    case 'calendar_day':
      return 'calendar_day';
    case 'calendar_week':
      return 'calendar_week';
    case 'cron':
      return 'cron';
    case 'one_shot':
      return 'one_shot';
    default:
      return null;
  }
}
