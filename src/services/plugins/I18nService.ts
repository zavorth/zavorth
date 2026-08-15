import fs from 'fs';
import path from 'path';

export type SupportedLocale = 'en' | 'pt' | 'es' | 'fr' | 'de' | 'ja' | 'zh' | 'ko' | 'ru' | 'ar';

export interface I18nMessages {
  [key: string]: string;
}

export interface I18nLocale {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  messages: I18nMessages;
}

interface LocaleFile {
  meta: { code: SupportedLocale; name: string; nativeName: string };
  messages: I18nMessages;
}

const FALLBACK_LOCALE: SupportedLocale = 'en';

export class I18nService {
  private readonly storageDir: string;
  private readonly locales: Map<SupportedLocale, I18nLocale> = new Map();
  private currentLocale: SupportedLocale = FALLBACK_LOCALE;

  constructor(options?: { storageDir?: string; defaultLocale?: SupportedLocale }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'i18n');
    if (options?.defaultLocale) this.currentLocale = options.defaultLocale;
    this.loadBundledLocales();
  }

  private loadBundledLocales(): void {
    const bundledDir = path.join(__dirname, 'locales');
    if (!fs.existsSync(bundledDir)) return;
    for (const file of fs.readdirSync(bundledDir)) {
      if (!file.endsWith('.json')) continue;
      try {
        const raw = fs.readFileSync(path.join(bundledDir, file), 'utf8');
        const parsed = JSON.parse(raw) as LocaleFile;
        if (!parsed?.meta?.code || !parsed?.messages) continue;
        this.locales.set(parsed.meta.code, {
          code: parsed.meta.code,
          name: parsed.meta.name,
          nativeName: parsed.meta.nativeName,
          messages: parsed.messages,
        });
      } catch {
        // Skip invalid locale files; i18n remains functional with already-loaded locales.
      }
    }
  }

  public setLocale(locale: SupportedLocale): void {
    if (this.locales.has(locale)) {
      this.currentLocale = locale;
    }
  }

  public getLocale(): SupportedLocale {
    return this.currentLocale;
  }

  public t(key: string, params?: Record<string, string | number>): string {
    const locale = this.locales.get(this.currentLocale);
    let message = locale?.messages[key] || this.locales.get(FALLBACK_LOCALE)?.messages[key] || key;

    if (params) {
      for (const [paramKey, paramValue] of Object.entries(params)) {
        message = message.replace(`{${paramKey}}`, String(paramValue));
      }
    }

    return message;
  }

  public listLocales(): Array<{ code: SupportedLocale; name: string; nativeName: string }> {
    return Array.from(this.locales.values()).map((l) => ({
      code: l.code,
      name: l.name,
      nativeName: l.nativeName,
    }));
  }

  public addLocale(locale: I18nLocale): void {
    this.locales.set(locale.code, locale);
  }

  public getMessageCount(locale: SupportedLocale): number {
    const l = this.locales.get(locale);
    return l ? Object.keys(l.messages).length : 0;
  }
}
