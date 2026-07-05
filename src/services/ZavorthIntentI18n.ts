/**
 * IntentI18n — Language-agnostic intent pattern registry.
 *
 * Loads intent keywords from YAML files in src/i18n/locales/<locale>/intents.yaml
 * Falls back to English if a locale doesn't have intent definitions.
 *
 * To add a new language:
 * 1. Create src/i18n/locales/<locale>/intents.yaml
 * 2. No code changes needed — the system auto-discovers it
 */

import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntentKeywordSet {
  verbs: string[];
  nouns: string[];
  phrases?: string[];
}

export interface IntentLanguagePack {
  code: string;
  name: string;
  intents: Record<string, IntentKeywordSet>;
}

// ---------------------------------------------------------------------------
// Locale detection (uses existing Zavorth i18n infrastructure)
// ---------------------------------------------------------------------------

function findLocalesDir(): string {
  const candidates = [
    path.join(process.cwd(), 'src', 'i18n', 'locales'),
    path.join(__dirname, '..', '..', 'i18n', 'locales'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(process.cwd(), 'src', 'i18n', 'locales');
}

export function detectDeviceLocale(): string {
  if (typeof process !== 'undefined' && process.env) {
    const lang = process.env.LANG || process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANGUAGE;
    if (lang) {
      return lang.split('.')[0]?.split('_')[0]?.split('-')[0]?.toLowerCase() ?? 'en';
    }
  }
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language || (navigator as { userLanguage?: string }).userLanguage;
    if (lang) {
      return lang.split('-')[0].toLowerCase();
    }
  }
  return 'en';
}

// ---------------------------------------------------------------------------
// YAML loader (simple parser, no external dependency)
// ---------------------------------------------------------------------------

function parseYamlKeywords(content: string): Record<string, IntentKeywordSet> {
  const intents: Record<string, IntentKeywordSet> = {};
  let currentIntent = '';
  let currentSection: 'verbs' | 'nouns' | 'phrases' | null = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Detect indentation level
    const indent = line.length - line.trimStart().length;

    // New intent (top-level key, no indentation)
    if (indent === 0 && trimmed.endsWith(':')) {
      currentIntent = trimmed.slice(0, -1).trim();
      if (currentIntent && !intents[currentIntent]) {
        intents[currentIntent] = { verbs: [], nouns: [], phrases: [] };
      }
      currentSection = null;
      continue;
    }

    // Section header (verbs, nouns, phrases) — 2 spaces indent
    if (indent === 2 && trimmed.endsWith(':')) {
      const sectionName = trimmed.slice(0, -1).trim();
      if (['verbs', 'nouns', 'phrases'].includes(sectionName)) {
        currentSection = sectionName as 'verbs' | 'nouns' | 'phrases';
      }
      continue;
    }

    // Handle inline array format: verbs: [item1, item2, item3]
    if (indent === 2 && trimmed.includes('[') && trimmed.includes(']') && currentIntent) {
      const match = trimmed.match(/^(\w+):\s*\[(.+)\]$/);
      if (match) {
        const sectionName = match[1];
        const items = match[2].split(',').map((s) => s.trim()).filter(Boolean);
        if (['verbs', 'nouns', 'phrases'].includes(sectionName) && intents[currentIntent]) {
          if (!intents[currentIntent][sectionName as 'verbs' | 'nouns' | 'phrases']) {
            intents[currentIntent][sectionName as 'verbs' | 'nouns' | 'phrases'] = [];
          }
          (intents[currentIntent][sectionName as 'verbs' | 'nouns' | 'phrases'] as string[]).push(...items);
        }
      }
      continue;
    }

    // Array item (keyword) — 4 spaces indent with dash
    if (indent >= 4 && trimmed.startsWith('- ')) {
      const keyword = trimmed.slice(2).trim();
      if (keyword && currentIntent && currentSection && intents[currentIntent]) {
        if (!intents[currentIntent][currentSection]) {
          intents[currentIntent][currentSection] = [];
        }
        (intents[currentIntent][currentSection] as string[]).push(keyword);
      }
    }
  }

  return intents;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const packCache = new Map<string, IntentLanguagePack>();
let localesDir = '';

function getLocalesDir(): string {
  if (!localesDir) localesDir = findLocalesDir();
  return localesDir;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getLanguagePack(locale: string): IntentLanguagePack {
  const normalized = locale.trim().toLowerCase();
  if (packCache.has(normalized)) return packCache.get(normalized)!;

  // Try exact match (e.g., 'zh-TW')
  const dir = getLocalesDir();
  const exactDir = path.join(dir, normalized);
  if (fs.existsSync(exactDir)) {
    const pack = loadPack(exactDir, normalized);
    packCache.set(normalized, pack);
    return pack;
  }

  // Try base language (e.g., 'pt-BR' → 'pt-BR' first, then 'pt')
  const base = normalized.split('-')[0];
  const baseDir = path.join(dir, base);
  if (fs.existsSync(baseDir)) {
    const pack = loadPack(baseDir, normalized);
    packCache.set(normalized, pack);
    return pack;
  }

  // Try with region variants (e.g., 'pt' → 'pt-BR')
  if (base === normalized) {
    const variants = fs.readdirSync(dir).filter((d) => d.startsWith(base + '-'));
    if (variants.length > 0) {
      const pack = loadPack(path.join(dir, variants[0]), normalized);
      packCache.set(normalized, pack);
      return pack;
    }
  }

  // Fallback to English
  const enDir = path.join(dir, 'en-US');
  if (fs.existsSync(enDir)) {
    const pack = loadPack(enDir, normalized);
    packCache.set(normalized, pack);
    return pack;
  }

  // Ultimate fallback: empty pack
  return { code: normalized, name: normalized, intents: {} };
}

function loadPack(dirPath: string, code: string): IntentLanguagePack {
  const intentsFile = path.join(dirPath, 'intents.yaml');
  if (!fs.existsSync(intentsFile)) {
    return { code, name: code, intents: {} };
  }

  const content = fs.readFileSync(intentsFile, 'utf-8');
  const intents = parseYamlKeywords(content);

  // Derive name and code from directory name
  const dirName = dirPath.split(path.sep).pop() ?? code;

  return { code: dirName, name: dirName, intents };
}

export function mergeLanguagePacks(primary: string, ...fallbacks: string[]): IntentLanguagePack {
  const primaryPack = getLanguagePack(primary);
  const fallbackPack = getLanguagePack('en');

  const mergedIntents: Record<string, IntentKeywordSet> = {};

  // Merge all intent categories from fallback (base)
  for (const key of Object.keys(fallbackPack.intents)) {
    const primarySet = primaryPack.intents[key];
    const fallbackSet = fallbackPack.intents[key];

    mergedIntents[key] = {
      verbs: Array.from(new Set([...(primarySet?.verbs ?? []), ...(fallbackSet?.verbs ?? [])])),
      nouns: Array.from(new Set([...(primarySet?.nouns ?? []), ...(fallbackSet?.nouns ?? [])])),
      phrases: Array.from(new Set([...(primarySet?.phrases ?? []), ...(fallbackSet?.phrases ?? [])])),
    };
  }

  // Add any intents from primary that aren't in fallback
  for (const key of Object.keys(primaryPack.intents)) {
    if (!mergedIntents[key]) {
      mergedIntents[key] = primaryPack.intents[key];
    }
  }

  return {
    code: primaryPack.code,
    name: primaryPack.name,
    intents: mergedIntents,
  };
}

export function listAvailableLocales(): string[] {
  const dir = getLocalesDir();
  if (!fs.existsSync(dir)) return ['en'];

  return fs.readdirSync(dir)
    .filter((entry) => {
      const entryDir = path.join(dir, entry);
      return fs.statSync(entryDir).isDirectory() && fs.existsSync(path.join(entryDir, 'intents.yaml'));
    })
    .sort();
}
