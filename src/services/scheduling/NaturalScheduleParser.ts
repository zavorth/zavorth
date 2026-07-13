/**
 * Phase 5 — Natural language schedule parser (PT + EN).
 *
 * Shared by SchedulerService, governed scheduled-task registry, and autonomy plane.
 * Produces a canonical normalized form + cron + next-run helpers.
 *
 * Supported examples:
 *   every 30m | every 2h | every 15 minutes | a cada 30 minutos | de hora em hora
 *   daily 09:00 | daily at 9am | todo dia às 9h | todos os dias as 09:30
 *   every monday | every monday at 10:00 | toda segunda-feira às 10h
 *   hourly | weekly on friday at 18:00
 */

export type NaturalScheduleKind = 'interval' | 'daily' | 'weekly' | 'cron';

export type NaturalScheduleParseResult = {
  kind: NaturalScheduleKind;
  /** Canonical: every Nm|Nh | daily HH:mm | weekly D HH:mm | raw cron */
  normalized: string;
  label: string;
  /** 5-field cron (min hour dom mon dow) */
  cron: string;
  intervalMs: number | null;
  localTime: string | null;
  /** 0=Sunday … 6=Saturday (cron DOW) */
  weekday: number | null;
};

const MIN_INTERVAL_MS = 60_000;
const MAX_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

const WEEKDAY_MAP: Record<string, number> = {
  sunday: 0,
  sun: 0,
  domingo: 0,
  dom: 0,
  monday: 1,
  mon: 1,
  segunda: 1,
  'segunda-feira': 1,
  seg: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  terca: 2,
  'terca-feira': 2,
  terça: 2,
  'terça-feira': 2,
  ter: 2,
  wednesday: 3,
  wed: 3,
  quarta: 3,
  'quarta-feira': 3,
  qua: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  quinta: 4,
  'quinta-feira': 4,
  qui: 4,
  friday: 5,
  fri: 5,
  sexta: 5,
  'sexta-feira': 5,
  sex: 5,
  saturday: 6,
  sat: 6,
  sabado: 6,
  sábado: 6,
  sab: 6,
};

/**
 * Parse natural or canonical schedule text.
 */
export function parseNaturalSchedule(
  rawInput: string,
  now: Date = new Date(),
): NaturalScheduleParseResult | null {
  const raw = String(rawInput || '').trim();
  if (!raw) return null;

  // Strip accents for matching but keep original for labels where useful
  const normalized = stripAccents(raw).toLowerCase().replace(/\s+/g, ' ').trim();

  // Already 5-field cron
  const cronMatch = normalized.match(/^(\d+|\*)\s+(\d+|\*)\s+(\d+|\*)\s+(\d+|\*)\s+(\d+|\*)$/);
  if (cronMatch) {
    return {
      kind: 'cron',
      normalized: raw.trim(),
      label: `cron ${raw.trim()}`,
      cron: raw.trim(),
      intervalMs: null,
      localTime: null,
      weekday: null,
    };
  }

  // --- Interval forms ---
  // every 30m / every 2h
  let m = normalized.match(/^every\s+(\d+)\s*([mh])$/);
  if (m) {
    return buildInterval(Number(m[1]), m[2] === 'h' ? 'h' : 'm', now);
  }

  // every 30 minutes|mins|min | every 2 hours|hrs|hour
  m = normalized.match(/^every\s+(\d+)\s*(minutes?|mins?|m|hours?|hrs?|h)$/);
  if (m) {
    const unit = /^h/.test(m[2]) ? 'h' : 'm';
    return buildInterval(Number(m[1]), unit, now);
  }

  // a cada 30 minutos | a cada 2 horas | a cada 5 min
  m = normalized.match(/^a cada\s+(\d+)\s*(minutos?|mins?|min|horas?|hrs?|h)$/);
  if (m) {
    const unit = /^h/.test(m[2]) ? 'h' : 'm';
    return buildInterval(Number(m[1]), unit, now);
  }

  // de hora em hora / hourly
  if (
    normalized === 'hourly'
    || normalized === 'de hora em hora'
    || normalized === 'a cada hora'
    || normalized === 'every hour'
  ) {
    return buildInterval(1, 'h', now);
  }

  // --- Daily forms ---
  // daily 09:00 | daily 9:00
  m = normalized.match(/^daily\s+(\d{1,2}):(\d{2})$/);
  if (m) {
    return buildDaily(Number(m[1]), Number(m[2]), now);
  }

  // daily at 9am | daily at 9:30pm | daily at 09:00
  m = normalized.match(/^daily\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (m) {
    const hm = applyAmPm(Number(m[1]), m[2] ? Number(m[2]) : 0, m[3] || null);
    if (hm) return buildDaily(hm.hour, hm.minute, now);
  }

  // every day at 9:00 | every day at 9am
  m = normalized.match(/^every\s+day\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (m) {
    const hm = applyAmPm(Number(m[1]), m[2] ? Number(m[2]) : 0, m[3] || null);
    if (hm) return buildDaily(hm.hour, hm.minute, now);
  }

  // todo dia as 9h | todo dia as 9:00 | todos os dias as 09:30 | todo dia às 9
  m = normalized.match(
    /^(?:todo\s+dia|todos\s+os\s+dias)\s+(?:as|a\s+as)?\s*(\d{1,2})(?::(\d{2}))?\s*h?$/,
  );
  if (m) {
    return buildDaily(Number(m[1]), m[2] ? Number(m[2]) : 0, now);
  }

  // todo dia 9h / todo dia 9
  m = normalized.match(/^(?:todo\s+dia|todos\s+os\s+dias)\s+(\d{1,2})h$/);
  if (m) {
    return buildDaily(Number(m[1]), 0, now);
  }

  // diariamente as 9h | diariamente as 09:30 | diariamente 9:00
  m = normalized.match(
    /^diariamente\s+(?:as|a\s+as)?\s*(\d{1,2})(?::(\d{2}))?\s*h?$/,
  );
  if (m) {
    return buildDaily(Number(m[1]), m[2] ? Number(m[2]) : 0, now);
  }

  // daily / diariamente (default 09:00)
  if (normalized === 'daily' || normalized === 'diariamente' || normalized === 'todo dia') {
    return buildDaily(9, 0, now);
  }

  // --- Weekly forms ---
  // every monday | every mon at 10:00 | every monday at 9am
  m = normalized.match(
    /^every\s+([a-z-]+)(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/,
  );
  if (m && WEEKDAY_MAP[m[1]] !== undefined) {
    const dow = WEEKDAY_MAP[m[1]];
    if (m[2] !== undefined) {
      const hm = applyAmPm(Number(m[2]), m[3] ? Number(m[3]) : 0, m[4] || null);
      if (hm) return buildWeekly(dow, hm.hour, hm.minute, now);
    }
    return buildWeekly(dow, 9, 0, now);
  }

  // weekly on friday at 18:00
  m = normalized.match(
    /^weekly\s+(?:on\s+)?([a-z-]+)(?:\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?)?$/,
  );
  if (m && WEEKDAY_MAP[m[1]] !== undefined) {
    const dow = WEEKDAY_MAP[m[1]];
    if (m[2] !== undefined) {
      const hm = applyAmPm(Number(m[2]), m[3] ? Number(m[3]) : 0, m[4] || null);
      if (hm) return buildWeekly(dow, hm.hour, hm.minute, now);
    }
    return buildWeekly(dow, 9, 0, now);
  }

  // toda segunda-feira as 10h | toda sexta as 18:00 | toda segunda
  m = normalized.match(
    /^tod[ao]s?\s+([a-z-]+)(?:-feira)?(?:\s+(?:as|a\s+as)?\s*(\d{1,2})(?::(\d{2}))?\s*h?)?$/,
  );
  if (m) {
    const dayKey = m[1].replace(/-feira$/, '');
    const dow = WEEKDAY_MAP[dayKey] ?? WEEKDAY_MAP[`${dayKey}-feira`];
    if (dow !== undefined) {
      if (m[2] !== undefined) {
        return buildWeekly(dow, Number(m[2]), m[3] ? Number(m[3]) : 0, now);
      }
      return buildWeekly(dow, 9, 0, now);
    }
  }

  // Canonical weekly already: weekly 1 09:00
  m = normalized.match(/^weekly\s+([0-6])\s+(\d{2}):(\d{2})$/);
  if (m) {
    return buildWeekly(Number(m[1]), Number(m[2]), Number(m[3]), now);
  }

  // semanalmente / weekly (default Monday 09:00)
  if (normalized === 'weekly' || normalized === 'semanalmente') {
    return buildWeekly(1, 9, 0, now);
  }

  return null;
}

/**
 * Compute next run from a parse result.
 */
export function nextRunFromNaturalSchedule(
  parsed: NaturalScheduleParseResult,
  fromDate: Date = new Date(),
): Date | null {
  if (parsed.kind === 'interval' && parsed.intervalMs) {
    return new Date(fromDate.getTime() + parsed.intervalMs);
  }

  if (parsed.kind === 'daily' && parsed.localTime) {
    const [hh, mm] = parsed.localTime.split(':').map(Number);
    const next = new Date(fromDate);
    next.setSeconds(0, 0);
    next.setHours(hh, mm, 0, 0);
    if (next.getTime() <= fromDate.getTime()) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  if (parsed.kind === 'weekly' && parsed.localTime !== null && parsed.weekday !== null) {
    const [hh, mm] = (parsed.localTime || '09:00').split(':').map(Number);
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

  // cron: conservative +1 min (host re-evaluates) — full cron engine out of scope
  if (parsed.kind === 'cron') {
    return new Date(fromDate.getTime() + 60_000);
  }

  return null;
}

// ── builders ─────────────────────────────────────────────────────────

function buildInterval(
  amount: number,
  unit: 'm' | 'h',
  _now: Date,
): NaturalScheduleParseResult | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const intervalMs = amount * (unit === 'h' ? 3_600_000 : 60_000);
  if (intervalMs < MIN_INTERVAL_MS || intervalMs > MAX_INTERVAL_MS) return null;
  const normalized = `every ${amount}${unit}`;
  const cron = unit === 'h'
    ? `0 */${amount} * * *`
    : amount === 60
      ? '0 * * * *'
      : `*/${amount} * * * *`;
  return {
    kind: 'interval',
    normalized,
    label: unit === 'm'
      ? `every ${amount} minute(s) / a cada ${amount} minuto(s)`
      : `every ${amount} hour(s) / a cada ${amount} hora(s)`,
    cron,
    intervalMs,
    localTime: null,
    weekday: null,
  };
}

function buildDaily(
  hour: number,
  minute: number,
  _now: Date,
): NaturalScheduleParseResult | null {
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const localTime = `${hh}:${mm}`;
  return {
    kind: 'daily',
    normalized: `daily ${localTime}`,
    label: `daily at ${localTime} / todo dia as ${localTime}`,
    cron: `${minute} ${hour} * * *`,
    intervalMs: 24 * 60 * 60 * 1000,
    localTime,
    weekday: null,
  };
}

function buildWeekly(
  weekday: number,
  hour: number,
  minute: number,
  _now: Date,
): NaturalScheduleParseResult | null {
  if (weekday < 0 || weekday > 6 || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const localTime = `${hh}:${mm}`;
  const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const namesPt = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
  return {
    kind: 'weekly',
    normalized: `weekly ${weekday} ${localTime}`,
    label: `every ${names[weekday]} at ${localTime} / toda ${namesPt[weekday]} as ${localTime}`,
    cron: `${minute} ${hour} * * ${weekday}`,
    intervalMs: 7 * 24 * 60 * 60 * 1000,
    localTime,
    weekday,
  };
}

function applyAmPm(
  hour: number,
  minute: number,
  ampm: string | null,
): { hour: number; minute: number } | null {
  if (minute < 0 || minute > 59 || hour < 0) return null;
  let h = hour;
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  if (!ampm && h > 23) return null;
  if (h > 23) return null;
  return { hour: h, minute };
}

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
