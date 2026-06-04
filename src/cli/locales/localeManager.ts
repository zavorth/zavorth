import { EN_COMMAND_ALIASES } from './en.js';
import { PT_COMMAND_ALIASES } from './pt.js';

export type ZavorthCliLocale = 'en' | 'pt';

export type LocaleEnvironment = Record<string, string | undefined>;

export type CommandAliasOptions = {
  env?: LocaleEnvironment;
  locale?: string | null;
};

const LANGUAGE_ENV_PRIORITY = [
  'ZAVORTH_LANG',
  'LC_ALL',
  'LC_MESSAGES',
  'LANG',
  'LANGUAGE',
  'USERLANGUAGE',
  'USER_LANGUAGE',
];

export function normalizeCliLocale(value: string | null | undefined): ZavorthCliLocale {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-');
  if (normalized.startsWith('pt')) {
    return 'pt';
  }
  return 'en';
}

export function detectSystemLanguage(env: LocaleEnvironment = process.env): ZavorthCliLocale {
  for (const key of LANGUAGE_ENV_PRIORITY) {
    const value = env[key];
    if (value) {
      const locale = normalizeCliLocale(value);
      if (locale !== 'en' || key === 'ZAVORTH_LANG') {
        return locale;
      }
    }
  }
  return 'en';
}

export function getCommandAliases(options: CommandAliasOptions = {}): Record<string, string> {
  const locale = options.locale
    ? normalizeCliLocale(options.locale)
    : detectSystemLanguage(options.env || process.env);
  if (locale === 'pt') {
    return { ...PT_COMMAND_ALIASES };
  }
  return { ...EN_COMMAND_ALIASES };
}
