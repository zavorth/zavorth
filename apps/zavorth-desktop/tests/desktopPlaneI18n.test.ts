import { describe, expect, it, beforeEach } from 'vitest';
import {
  DESKTOP_PLANE_EN,
  DESKTOP_PLANE_PT,
  lookupDesktopPlaneString,
} from '../src/i18n/desktopPlane';
import { PLUGIN_OS_PLANE_I18N } from '../src/i18n/pluginOsPlane';
import {
  hydrateDesktopStrings,
  missingDesktopKeys,
} from '../src/i18n/hydration';
import { t } from '../src/i18n';

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function installMemoryStorage(): void {
  const store = new Map<string, string>();
  const storage: StorageLike = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
  };
  (globalThis as { localStorage?: StorageLike }).localStorage = storage;
}

describe('desktop plane catalogs', () => {
  it('ships a Portuguese value for every English key', () => {
    const enKeys = Object.keys(DESKTOP_PLANE_EN);
    expect(enKeys.length).toBeGreaterThan(400);
    for (const [key, value] of Object.entries(DESKTOP_PLANE_EN)) {
      expect(value.trim(), `en value for ${key}`).not.toBe('');
      const ptValue = DESKTOP_PLANE_PT[key];
      expect(typeof ptValue, `missing pt key ${key}`).toBe('string');
      expect(String(ptValue).trim(), `empty pt value for ${key}`).not.toBe('');
    }
  });

  it('resolves through locale aliases before the en fallback', () => {
    expect(lookupDesktopPlaneString('pt', 'costSavings.tab')).toMatch(/Economia/i);
    expect(lookupDesktopPlaneString('pt-BR', 'memoryGraph.tab')).toBe('Grafo');
    expect(t('terminal.tabs', 'de')).toBe('Terminal tabs');
    expect(lookupDesktopPlaneString('en', 'no-such.key')).toBeNull();
  });
});

describe('plugin os plane seeds', () => {
  it('covers the plugin load tips alias set with localized titles', () => {
    expect(Object.keys(PLUGIN_OS_PLANE_I18N).length).toBeGreaterThanOrEqual(30);
    for (const [locale, entry] of Object.entries(PLUGIN_OS_PLANE_I18N)) {
      expect(entry['pluginOs.title'].length, `title for ${locale}`).toBeGreaterThan(0);
    }
    expect(PLUGIN_OS_PLANE_I18N['zh-CN']['pluginOs.title']).toBeTruthy();
    expect(PLUGIN_OS_PLANE_I18N.already['pluginOs.title']).toBe(PLUGIN_OS_PLANE_I18N.ja['pluginOs.title']);
  });
});

describe('facade resolution chain', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it('prefers plane strings over raw keys and falls back to the key', () => {
    expect(t('thread.approvalTitle', 'en')).toBe('Approval required');
    expect(t('costSavings.tab', 'pt')).toMatch(/Economia/i);
    expect(t('definitely.missing.key', 'de')).toBe('definitely.missing.key');
  });

  it('reports no missing keys for en', () => {
    expect(missingDesktopKeys('en')).toEqual([]);
  });

  it('hydrates missing strings once and resolves them afterwards', async () => {
    const requests: Array<{ path: string; body: unknown }> = [];
    (globalThis as { window?: unknown }).window = {
      zavorthDesktop: {
        apiRequest: async (request: { path: string; body: { entries: Record<string, string> } }) => {
          requests.push(request);
          const translations: Record<string, string> = {};
          for (const key of Object.keys(request.body.entries)) {
            translations[key] = `[nl] ${request.body.entries[key]}`;
          }
          return { ok: true, data: { ok: true, data: { translations, persisted: true } } };
        },
      },
    };

    expect(missingDesktopKeys('nl').length).toBeGreaterThan(0);
    const hydrated = await hydrateDesktopStrings('nl');
    expect(hydrated).toBe(true);
    expect(requests).toHaveLength(1);

    expect(t('nav.newChat', 'nl')).toBe('[nl] New chat');
    expect(missingDesktopKeys('nl')).toEqual([]);

    delete (globalThis as { window?: unknown }).window;
  });

  it('stays on the en fallback when the runtime bridge is unavailable', async () => {
    delete (globalThis as { window?: unknown }).window;
    const hydrated = await hydrateDesktopStrings('sv');
    expect(hydrated).toBe(false);
    expect(t('vibe.title', 'sv')).toBe('Vibe coding');
  });
});
