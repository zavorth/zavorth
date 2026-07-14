import { EN_COMMAND_ALIASES } from './en.js';

/**
 * CLI first-token command aliases are English-only (Zavorth style).
 * UI copy still uses the full i18n stack (src/i18n/locales/*) for many languages.
 * Free-text natural language goes to the agent, not CLI synonym packs.
 */

export type ZavorthCliLocale = 'en';

export type LocaleEnvironment = Record<string, string | undefined>;

export type CommandAliasOptions = {
  env?: LocaleEnvironment;
  locale?: string | null;
};

/** Always English for CLI command tokens. Kept for API compatibility. */
export function normalizeCliLocale(_value: string | null | undefined): ZavorthCliLocale {
  return 'en';
}

/** Always English for CLI command tokens. Kept for API compatibility. */
export function detectSystemLanguage(_env: LocaleEnvironment = process.env): ZavorthCliLocale {
  return 'en';
}

/**
 * First-token CLI synonyms (English only).
 * Typos / short forms also live in SimpleCommandRouter for the anyone-path.
 */
export function getCommandAliases(_options: CommandAliasOptions = {}): Record<string, string> {
  return { ...EN_COMMAND_ALIASES };
}
