/**
 * On-demand string hydration for the desktop plane.
 *
 * Missing translations are requested once from the runtime's intelligent
 * localization endpoint, applied to the in-memory plane, and persisted to
 * localStorage so subsequent launches resolve fully offline.
 */

import {
  DESKTOP_PLANE_EN,
  registerHydratedDesktopPlane,
} from './desktopPlane';

const HYDRATED_STRINGS_STORAGE_PREFIX = 'zavorth-desktop-strings';

interface LocalizationStringsPayload {
  ok?: boolean;
  data?: { translations?: Record<string, unknown>; locale?: string; persisted?: boolean };
}

type DesktopApiBridge = {
  apiRequest<T = unknown>(request: {
    method: string;
    path: string;
    body?: unknown;
    timeoutMs?: number;
  }): Promise<{ ok: boolean; data: T; error?: string }>;
};

function desktopApiBridge(): DesktopApiBridge | null {
  const candidate = (globalThis as { window?: { zavorthDesktop?: DesktopApiBridge } }).window
    ?.zavorthDesktop;
  return candidate ?? null;
}

function storageKeyFor(locale: string): string {
  return `${HYDRATED_STRINGS_STORAGE_PREFIX}:${locale.toLowerCase()}`;
}

function readHydratedEntry(locale: string, key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(storageKeyFor(locale));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const value = parsed[key];
    return typeof value === 'string' && value.trim() ? value : null;
  } catch {
    return null;
  }
}

/** Resolve one previously hydrated translation, or null when absent. */
export function hydratedDesktopString(locale: string, key: string): string | null {
  return readHydratedEntry(locale.toLowerCase(), key);
}

function storeHydratedEntries(locale: string, entries: Record<string, string>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const key = storageKeyFor(locale);
    const raw = localStorage.getItem(key);
    const merged: Record<string, string> = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    for (const [entryKey, value] of Object.entries(entries)) {
      if (typeof value === 'string' && value.trim()) merged[entryKey] = value;
    }
    localStorage.setItem(key, JSON.stringify(merged));
  } catch {
    // Persistence is best-effort; hydration stays effective in memory.
  }
}

/** Keys of the en plane that still lack a hydrated translation for the locale. */
export function missingDesktopKeys(localeInput: string): string[] {
  const locale = localeInput.toLowerCase();
  if (locale === 'en') return [];
  try {
    if (typeof localStorage === 'undefined') return Object.keys(DESKTOP_PLANE_EN);
    const raw = localStorage.getItem(storageKeyFor(locale));
    const stored: Record<string, unknown> = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    return Object.keys(DESKTOP_PLANE_EN).filter((key) => {
      const value = stored[key];
      return !(typeof value === 'string' && value.trim());
    });
  } catch {
    return Object.keys(DESKTOP_PLANE_EN);
  }
}

const inflightHydrations = new Map<string, Promise<boolean>>();

/**
 * Hydrate missing desktop strings for a locale through the runtime's on-demand
 * translation endpoint. Strings are translated once, persisted under
 * ~/.zavorth/locales/, cached in localStorage, and applied to the live plane so
 * the UI can re-render without a reload.
 */
export async function hydrateDesktopStrings(localeInput: string): Promise<boolean> {
  const locale = localeInput.toLowerCase();
  if (locale === 'en') return true;

  const inflight = inflightHydrations.get(locale);
  if (inflight) return inflight;

  const task = (async () => {
    const keys = missingDesktopKeys(locale);
    if (!keys.length) return true;

    const sourceEntries: Record<string, string> = {};
    for (const key of keys) sourceEntries[key] = DESKTOP_PLANE_EN[key];

    try {
      const bridge = desktopApiBridge();
      if (!bridge) return false;
      const result = await bridge.apiRequest<LocalizationStringsPayload>({
        method: 'POST',
        path: '/api/v2/localization/strings',
        body: { locale, entries: sourceEntries },
        timeoutMs: 45000,
      });
      const payload = result.ok ? result.data?.data?.translations : undefined;
      if (!payload || typeof payload !== 'object') return false;

      const cleanEntries: Record<string, string> = {};
      for (const [key, value] of Object.entries(payload)) {
        if (typeof value === 'string' && value.trim() && value !== sourceEntries[key]) {
          cleanEntries[key] = value;
        }
      }
      if (!Object.keys(cleanEntries).length) return false;

      registerHydratedDesktopPlane(locale, cleanEntries);
      storeHydratedEntries(locale, cleanEntries);
      return true;
    } catch {
      // Offline or runtime unavailable: keep the en fallback until next attempt.
      return false;
    }
  })().finally(() => {
    inflightHydrations.delete(locale);
  });

  inflightHydrations.set(locale, task);
  return task;
}
