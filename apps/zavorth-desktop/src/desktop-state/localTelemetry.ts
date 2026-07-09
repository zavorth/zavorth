export const TELEMETRY_OPT_IN_KEY = 'zvd:telemetry-opt-in';
export const TELEMETRY_EVENTS_KEY = 'zvd:telemetry-events:v1';
const MAX_EVENTS = 300;

export type DesktopTelemetryEvent = {
  id: string;
  name: string;
  at: string;
  props?: Record<string, string | number | boolean | null>;
};

function storage(): Storage | null {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export function isTelemetryOptIn(store: Storage | null = storage()): boolean {
  return store?.getItem(TELEMETRY_OPT_IN_KEY) === 'true';
}

export function setTelemetryOptIn(enabled: boolean, store: Storage | null = storage()): void {
  store?.setItem(TELEMETRY_OPT_IN_KEY, enabled ? 'true' : 'false');
}

export function loadTelemetryEvents(store: Storage | null = storage()): DesktopTelemetryEvent[] {
  if (!store) return [];
  try {
    const raw = store.getItem(TELEMETRY_EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_EVENTS) : [];
  } catch {
    return [];
  }
}

/** Local-only UX telemetry. Never store prompt text or secrets. */
export function trackDesktopEvent(
  name: string,
  props?: Record<string, string | number | boolean | null>,
  store: Storage | null = storage(),
): DesktopTelemetryEvent | null {
  if (!isTelemetryOptIn(store)) return null;
  const safeProps: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(props || {})) {
    const k = key.toLowerCase();
    if (k.includes('prompt') || k.includes('secret') || k.includes('token') || k.includes('key') || k.includes('password')) {
      continue;
    }
    if (typeof value === 'string' && value.length > 120) {
      safeProps[key] = `${value.slice(0, 117)}...`;
    } else {
      safeProps[key] = value;
    }
  }
  const event: DesktopTelemetryEvent = {
    id: `tel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    at: new Date().toISOString(),
    props: safeProps,
  };
  const next = [event, ...loadTelemetryEvents(store)].slice(0, MAX_EVENTS);
  store?.setItem(TELEMETRY_EVENTS_KEY, JSON.stringify(next));
  return event;
}
