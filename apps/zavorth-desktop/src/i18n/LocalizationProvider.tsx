import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import {
  type SupportedLocale,
  type LocalizationCatalog,
  SUPPORTED_LOCALES,
  RTL_LOCALES,
  LOCALE_ENDONYMS,
} from '../../../../src/services/localization/localeContracts.js';
import { ZavorthLocalizationService } from '../../../../src/services/localization/ZavorthLocalizationService.js';

export interface LocalizationContextValue {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  t: (keyPath: string, params?: Record<string, string | number>) => string;
  catalog: LocalizationCatalog;
  isRtl: boolean;
  availableLocales: Array<{ code: string; name: string; isRtl: boolean }>;
}

const STORAGE_KEY = 'zavorth-user-locale';

const defaultLocalizationService = new ZavorthLocalizationService();

const LocalizationContext = createContext<LocalizationContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: (keyPath: string) => keyPath,
  catalog: defaultLocalizationService.getCatalog('en'),
  isRtl: false,
  availableLocales: defaultLocalizationService.getAvailableLocales(),
});

function getInitialLocale(): SupportedLocale {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && (SUPPORTED_LOCALES as readonly string[]).includes(stored)) {
        return stored as SupportedLocale;
      }
    }
  } catch {
    // Gracefully handle storage errors
  }

  return defaultLocalizationService.detectSystemLocale();
}

export interface LocalizationProviderProps {
  children: ReactNode;
  initialLocale?: SupportedLocale;
}

export function LocalizationProvider({ children, initialLocale }: LocalizationProviderProps) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => initialLocale || getInitialLocale());
  const localizationService = useMemo(() => new ZavorthLocalizationService({ locale }), [locale]);

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, newLocale);
      }
    } catch {
      // Storage write error
    }
  }, []);

  const isRtl = useMemo(() => RTL_LOCALES.has(locale), [locale]);
  const catalog = useMemo(() => localizationService.getCatalog(locale), [localizationService, locale]);
  const availableLocales = useMemo(() => localizationService.getAvailableLocales(), [localizationService]);

  const t = useCallback(
    (keyPath: string, params: Record<string, string | number> = {}) => {
      return localizationService.t(keyPath, params, locale);
    },
    [localizationService, locale],
  );

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
      document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    }
  }, [locale, isRtl]);

  const value = useMemo<LocalizationContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      catalog,
      isRtl,
      availableLocales,
    }),
    [locale, setLocale, t, catalog, isRtl, availableLocales],
  );

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization(): LocalizationContextValue {
  return useContext(LocalizationContext);
}
