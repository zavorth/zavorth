/**
 * Zavorth Web Control Console Localization Facade.
 *
 * Connects the Web Console directly to the universal ZavorthLocalizationService
 * supporting 18 global locales, endonyms, RTL, and on-demand translation.
 */

import { shellWarn } from './shell-debug';
import { ZavorthLocalizationService } from '../../../src/services/localization/ZavorthLocalizationService.js';
import {
  SUPPORTED_LOCALES,
  LOCALE_ENDONYMS,
  RTL_LOCALES,
  type SupportedLocale,
} from '../../../src/services/localization/localeContracts.js';

export type SupportedControlLocale =
  | 'en-US'
  | 'pt-BR'
  | 'es-AR'
  | 'zh-CN'
  | 'zh-TW'
  | 'de'
  | 'es'
  | 'ja-JP'
  | 'ko'
  | 'fr'
  | 'ar'
  | 'it'
  | 'tr'
  | 'uk'
  | 'id'
  | 'pl'
  | 'th'
  | 'vi'
  | 'nl'
  | 'fa';

export type ControlLocalePreference = SupportedControlLocale | 'system';
export type ControlLocale = SupportedControlLocale;

const LOCALE_KEY = 'zavorth.control.locale';
const localizationService = new ZavorthLocalizationService();

export const CONTROL_LOCALES: Array<{ code: ControlLocalePreference; label: string; hint: string }> = [
  { code: 'system', label: 'System language', hint: 'Follow this device automatically' },
  ...SUPPORTED_LOCALES.map((code) => ({
    code: (code === 'en' ? 'en-US' : code === 'pt' ? 'pt-BR' : code === 'zh' ? 'zh-CN' : code === 'ja' ? 'ja-JP' : code) as ControlLocalePreference,
    label: LOCALE_ENDONYMS[code] || code,
    hint: RTL_LOCALES.has(code) ? 'RTL Interface' : 'Native Interface',
  })),
];

export function readControlLocalePreference(): ControlLocalePreference {
  const stored = localStorage.getItem(LOCALE_KEY) as ControlLocalePreference | null;
  if (stored && (stored === 'system' || SUPPORTED_LOCALES.includes(localizationService.normalizeLocaleTag(stored)))) {
    return stored;
  }
  return 'system';
}

export function readControlLocale(): SupportedControlLocale {
  const pref = readControlLocalePreference();
  if (pref !== 'system') {
    return pref;
  }
  const detected = localizationService.getLocale();
  return (detected === 'en' ? 'en-US' : detected === 'pt' ? 'pt-BR' : detected) as SupportedControlLocale;
}

export function readEffectiveDocumentLocale(): SupportedControlLocale {
  const htmlLang = document.documentElement.lang;
  if (htmlLang) {
    const normalized = localizationService.normalizeLocaleTag(htmlLang);
    if (normalized) return (normalized === 'en' ? 'en-US' : normalized === 'pt' ? 'pt-BR' : normalized) as SupportedControlLocale;
  }
  return readControlLocale();
}

export function persistControlLocale(preference: ControlLocalePreference): SupportedControlLocale {
  if (preference === 'system') {
    localStorage.removeItem(LOCALE_KEY);
  } else {
    localStorage.setItem(LOCALE_KEY, preference);
    localizationService.setLocale(localizationService.normalizeLocaleTag(preference));
  }
  return readControlLocale();
}

export function translate(text: string, locale?: string | null): string {
  if (!text) return '';
  const targetLocale = (locale ? localizationService.normalizeLocaleTag(locale) : localizationService.getLocale()) as SupportedLocale;
  const result = localizationService.t(text, {}, targetLocale);
  return result || text;
}

export function translateCount(count: number, singularKey: string, pluralKey: string, locale?: string | null): string {
  const key = count === 1 ? singularKey : pluralKey;
  const text = translate(key, locale);
  return text.replace('{count}', String(count)).replace('%d', String(count));
}

export function applyControlLocale(root: Document | HTMLElement = document) {
  const locale = readControlLocale();
  const normalized = localizationService.normalizeLocaleTag(locale);
  const isRtl = RTL_LOCALES.includes(normalized);

  document.documentElement.lang = locale;
  document.documentElement.dir = isRtl ? 'rtl' : 'ltr';

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.textContent || '';
      if (!text.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (parent.closest('script, style, code, pre, .mono, .artifact-render, .data-table'))
        return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach((node) => {
    const record = node as Text & { __zavorthI18nOriginal?: string };
    if (!record.__zavorthI18nOriginal) record.__zavorthI18nOriginal = node.textContent || '';
    const original = record.__zavorthI18nOriginal;
    const leading = original.match(/^\s*/)?.[0] || '';
    const trailing = original.match(/\s*$/)?.[0] || '';
    const translated = translate(original, locale);
    if (translated !== original) node.textContent = `${leading}${translated.trim()}${trailing}`;
    if (locale === 'en-US' || locale === 'en') node.textContent = original;
  });

  root.querySelectorAll?.('[placeholder], [title], [aria-label], [data-tooltip], [data-prompt]').forEach((el) => {
    ['placeholder', 'title', 'aria-label', 'data-tooltip', 'data-prompt'].forEach((attr) => {
      const key = `zavorthI18n${attr.replace(/[^a-z0-9]/gi, '')}`;
      const value = el.getAttribute(attr);
      if (!value) return;
      if (!el.getAttribute(`data-${key}`)) el.setAttribute(`data-${key}`, value);
      const original = el.getAttribute(`data-${key}`) || value;
      const translated = translate(original, locale);
      if (translated !== value) el.setAttribute(attr, translated);
      if (locale === 'en-US' || locale === 'en') el.setAttribute(attr, original);
    });
  });
}

async function syncLocaleToBackend(locale: string) {
  try {
    const token = sessionStorage.getItem('zavorth.zavorthControl.webToken');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['X-Zavorth-Token'] = token;
    }
    const response = await fetch('/api/v2/agent/locale', {
      method: 'POST',
      headers,
      body: JSON.stringify({ lang: locale }),
    });
    if (!response.ok) {
      shellWarn(`LocaleSync failed to sync language to backend: ${response.status}`);
    }
  } catch (error: unknown) {
    shellWarn(`LocaleSync error syncing language to backend: ${(error as Error).message}`);
  }
}

async function loadLocaleFromBackend() {
  try {
    const token = sessionStorage.getItem('zavorth.zavorthControl.webToken');
    const headers: Record<string, string> = {};
    if (token) {
      headers['X-Zavorth-Token'] = token;
    }
    const response = await fetch('/api/v2/agent/locale', { headers });
    if (response.ok) {
      const payload = await response.json();
      if (payload.ok && payload.data && typeof payload.data.lang === 'string') {
        const backendLang = payload.data.lang;
        const currentPref = readControlLocalePreference();
        if (currentPref !== backendLang) {
          persistControlLocale(backendLang as any);
          applyControlLocale();
        }
      }
    }
  } catch (error: unknown) {
    shellWarn(`LocaleSync error loading language from backend: ${(error as Error).message}`);
  }
}

declare global {
  interface Window {
    ZavorthLocale?: {
      get: () => SupportedControlLocale;
      getPreference: () => ControlLocalePreference;
      set: (locale: ControlLocalePreference) => SupportedControlLocale;
      apply: (root?: Document | HTMLElement) => void;
      t: (value: string) => string;
    };
  }
}

export function installControlLocale() {
  window.ZavorthLocale = {
    get: readEffectiveDocumentLocale,
    getPreference: readControlLocalePreference,
    set: (locale) => {
      const resolved = persistControlLocale(locale);
      applyControlLocale();
      void syncLocaleToBackend(locale);
      return resolved;
    },
    apply: applyControlLocale,
    t: (value) => translate(value),
  };
  applyControlLocale();
  void loadLocaleFromBackend();

  window.addEventListener('languagechange', () => {
    if (readControlLocalePreference() !== 'system') return;
    applyControlLocale();
    window.dispatchEvent(
      new CustomEvent('zavorth-control-locale-change', {
        detail: {
          locale: readControlLocale(),
          documentLocale: readEffectiveDocumentLocale(),
          preference: 'system',
        },
      }),
    );
  });

  window.addEventListener('zavorth-control-locale-change', (event: any) => {
    const pref = event.detail?.preference;
    if (pref) {
      const select = document.querySelector('[data-zavorth-locale-select]');
      if (select instanceof HTMLSelectElement) {
        select.value = pref;
      }
    }
  });
}
