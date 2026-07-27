import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { asErrorLike } from '../../src/utils/errorLike.js';
function asErrorLike(error: unknown): { message?: string; stack?: string; name?: string; code?: string | number; [key: string]: unknown } {
  if (error && typeof error === 'object') return error as { message?: string; stack?: string; name?: string; code?: string | number; [key: string]: unknown };
  if (typeof error === 'string' && error.trim()) return { message: error };
  if (typeof error === 'number' || typeof error === 'boolean') return { message: String(error) };
  return { message: 'Unexpected error' };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const localesDir = path.resolve(__dirname, '../locales');

export type MessageKey = string;

let activeLang = 'en';
let osLang = 'en';
const dictionaries: Record<string, Record<string, string>> = {
  en: {
    '__language_name__': 'English (EN)',
    'error_prefix': 'Error: {message}',
    'error_backend': 'Backend error ({status}): {error}',
    'error_connection': 'Connection with backend failed: {message}',
    'error_timeout': 'The backend took too long to respond. Make sure Ollama is running.',
  }
};
const pendingTranslations = new Set<string>();

// Callback for remote LLM translation
type TranslatorCallback = (key: string, englishText: string, targetLang: string) => Promise<string>;
let remoteTranslator: TranslatorCallback | null = null;

// Ensure locales directory exists
if (!fs.existsSync(localesDir)) {
  fs.mkdirSync(localesDir, { recursive: true });
}

/**
 * Detect the default OS locale.
 */
function detectSystemLanguage(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (locale) {
      const code = locale.split('-')[0].toLowerCase();
      return code;
    }
  } catch (error: unknown) {
    // continue
  }
  return 'en';
}

/**
 * Load all locales dynamically from the locales/ folder.
 */
export function loadAllLocales(): void {
  try {
    const files = fs.readdirSync(localesDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const langCode = path.basename(file, '.json');
        const filePath = path.join(localesDir, file);
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          dictionaries[langCode] = JSON.parse(content);
        } catch (error: unknown) {
          const err = asErrorLike(error);
          console.warn(`[i18n] Failed to parse locale file ${file}: ${err.message}`);
        }
      }
    }
  } catch (error: unknown) {
    const err = asErrorLike(error);
    console.error(`[i18n] Failed to read locales directory: ${err.message}`);
  }

  // Ensure 'en' is loaded (at least in memory as a fallback if file doesn't exist)
  if (!dictionaries.en) {
    dictionaries.en = {
      '__language_name__': 'English (EN)',
      'error_prefix': 'Error: {message}',
      'error_backend': 'Backend error ({status}): {error}',
      'error_connection': 'Connection with backend failed: {message}',
      'error_timeout': 'The backend took too long to respond. Make sure Ollama is running.',
    };
  }
}

/**
 * Set the remote translator callback.
 */
export function setTranslatorCallback(cb: TranslatorCallback): void {
  remoteTranslator = cb;
}

/**
 * Get all available languages (code -> friendly name).
 */
export function getLanguages(): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [code, dict] of Object.entries(dictionaries)) {
    result[code] = dict.__language_name__ || code.toUpperCase();
  }
  return result;
}

/**
 * Get the active language code.
 */
export function getActiveLanguage(): string {
  return activeLang;
}

/**
 * Get the system detected language code.
 */
export function getSystemLanguage(): string {
  return osLang;
}

/**
 * Initialize i18n configurations.
 */
export function initI18n(configLang: string): void {
  loadAllLocales();
  osLang = detectSystemLanguage();

  if (configLang === 'auto') {
    activeLang = dictionaries[osLang] ? osLang : 'en';
  } else {
    activeLang = dictionaries[configLang] ? configLang : 'en';
  }
  console.log(`[i18n] Initialized. OS Locale: ${osLang} | Active Language: ${activeLang}`);
}

/**
 * Set the active language dynamically.
 */
export function setLanguage(langCode: string): void {
  if (langCode === 'auto') {
    activeLang = dictionaries[osLang] ? osLang : 'en';
  } else if (dictionaries[langCode]) {
    activeLang = langCode;
  } else {
    // If we switch to a completely new language that doesn't exist in locales yet,
    // we initialize a new empty dictionary and trigger on-the-fly translation.
    dictionaries[langCode] = {
      '__language_name__': langCode.toUpperCase(),
    };
    activeLang = langCode;
  }
}

/**
 * Translate a key, replacing variables.
 */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  const currentDict = dictionaries[activeLang] || dictionaries.en;
  let msg = currentDict[key];

  if (msg === undefined) {
    // Key is missing in active language. Fallback to English.
    const enDict = dictionaries.en || {};
    msg = enDict[key] || key;

    // Trigger AI translation on-the-fly in the background
    if (activeLang !== 'en') {
      const englishText = enDict[key];
      if (englishText && remoteTranslator) {
        const cacheKey = `${activeLang}:${key}`;
        if (!pendingTranslations.has(cacheKey)) {
          pendingTranslations.add(cacheKey);
          void translateAndCacheKey(key, englishText, activeLang);
        }
      }
    }
  }

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }

  return msg;
}

/**
 * Asynchronously call LLM to translate a missing key and persist it to locales file.
 */
async function translateAndCacheKey(key: string, englishText: string, targetLang: string): Promise<void> {
  const cacheKey = `${targetLang}:${key}`;
  try {
    if (!remoteTranslator) {
      pendingTranslations.delete(cacheKey);
      return;
    }

    const translatedText = await remoteTranslator(key, englishText, targetLang);
    if (translatedText && translatedText.trim()) {
      const cleanText = translatedText.trim();

      // Update in memory
      if (!dictionaries[targetLang]) {
        dictionaries[targetLang] = {
          '__language_name__': targetLang.toUpperCase(),
        };
      }
      dictionaries[targetLang][key] = cleanText;

      // Persist to disk
      const filePath = path.join(localesDir, `${targetLang}.json`);
      fs.writeFileSync(filePath, JSON.stringify(dictionaries[targetLang], null, 2), 'utf8');
      console.log(`[i18n] Translation cached: "${key}" -> "${cleanText}" (${targetLang})`);
    }
  } catch (error: unknown) {
    const err = asErrorLike(error);
    console.warn(`[i18n] Failed to translate key "${key}" to "${targetLang}": ${err.message}`);
  } finally {
    pendingTranslations.delete(cacheKey);
  }
}

// Initial load on import
try {
  loadAllLocales();
  osLang = detectSystemLanguage();
  activeLang = dictionaries[osLang] ? osLang : 'en';
} catch (error: unknown) {
  // Silent fallback
}
