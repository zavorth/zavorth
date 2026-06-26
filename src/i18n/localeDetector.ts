import type { SupportedLocale, LocaleSource, DEFAULT_LOCALE } from './types.js';

const ENV_PRIORITY = [
  'ZAVORTH_LANG',
  'LC_ALL',
  'LC_MESSAGES',
  'LANG',
  'LANGUAGE',
  'USERLANGUAGE',
  'USER_LANGUAGE',
] as const;

export function normalizeLocale(input: string | null | undefined): SupportedLocale {
  const raw = String(input || '').trim().toLowerCase().replace(/_/g, '-');
  if (raw.startsWith('pt')) return 'pt-BR';
  return 'en-US';
}

export function resolveFromEnv(env?: Record<string, string | undefined>): string {
  if (!env) return '';
  for (const key of ENV_PRIORITY) {
    const value = env[key];
    if (value && value.trim()) return value.trim();
  }
  return '';
}

export function resolveLocale(
  source: LocaleSource,
  fallback: SupportedLocale = 'en-US',
): SupportedLocale {
  const raw =
    source.explicitLocale ||
    source.cookie ||
    source.header ||
    resolveFromEnv(source.env);
  return normalizeLocale(raw) || fallback;
}
