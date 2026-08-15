import fs from 'fs';
import path from 'path';

export type PluginLoadTipId =
  | 'tip.export_register'
  | 'tip.bind_capability'
  | 'tip.declare_capability'
  | 'tip.enable_plugin'
  | 'tip.install_enable'
  | 'tip.entrypoint_module'
  | 'tip.declare_capabilities'
  | 'tip.bind_all_capabilities'
  | 'tip.add_manifest'
  | 'tip.export_function'
  | 'tip.fast_register'
  | 'tip.clear_block';

export type PluginLoadTipsCatalog = Record<PluginLoadTipId, string>;

const BASE_LOCALE = 'en';

const PARTIAL_BASE: Record<string, string> = {
  'pt-BR': 'pt',
};

const LOCALE_ALIASES: Record<string, string> = {
  'pt-PT': 'pt',
  'zh-CN': 'zh',
  'zh-Hans': 'zh',
  'zh-TW': 'zh-Hant',
  'already': 'ja',
};

function loadCatalog(filePath: string): PluginLoadTipsCatalog | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as PluginLoadTipsCatalog;
  } catch {
    return null;
  }
}

function findLocalesDir(): string {
  return path.join(__dirname, 'locales');
}

function buildCatalogs(): Record<string, PluginLoadTipsCatalog> {
  const localesDir = findLocalesDir();
  const base = loadCatalog(path.join(localesDir, `${BASE_LOCALE}.json`));
  if (!base) {
    throw new Error(`PluginLoadTipsI18n: missing base locale file ${BASE_LOCALE}.json`);
  }

  const catalogs: Record<string, PluginLoadTipsCatalog> = { [BASE_LOCALE]: base };

  if (!fs.existsSync(localesDir)) return catalogs;

  for (const file of fs.readdirSync(localesDir)) {
    if (!file.endsWith('.json')) continue;
    const code = path.basename(file, '.json');
    if (code === BASE_LOCALE) continue;

    const loaded = loadCatalog(path.join(localesDir, file));
    if (!loaded) continue;

    const mergeBase = PARTIAL_BASE[code] || BASE_LOCALE;
    const merged: PluginLoadTipsCatalog = { ...catalogs[mergeBase], ...loaded };
    catalogs[code] = merged;
  }

  for (const [alias, target] of Object.entries(LOCALE_ALIASES)) {
    if (catalogs[target]) {
      catalogs[alias] = catalogs[target];
    }
  }

  return catalogs;
}

export const PLUGIN_LOAD_TIPS_CATALOGS: Record<string, PluginLoadTipsCatalog> = buildCatalogs();

export function resolvePluginLoadLocale(
  preferred?: string | null,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const candidates = [preferred, env.ZAVORTH_LOCALE, env.LANG, env.LC_ALL]
    .map((value) => normalizeLocaleTag(value))
    .filter(Boolean) as string[];

  for (const candidate of candidates) {
    const matched = matchLocale(candidate);
    if (matched) return matched;
  }
  return BASE_LOCALE;
}

export function getPluginLoadTipsCatalog(locale?: string | null): PluginLoadTipsCatalog {
  const resolved = resolvePluginLoadLocale(locale);
  return PLUGIN_LOAD_TIPS_CATALOGS[resolved] || PLUGIN_LOAD_TIPS_CATALOGS[BASE_LOCALE];
}

export function formatPluginLoadTip(
  id: PluginLoadTipId,
  vars: Record<string, string> = {},
  locale?: string | null,
): string {
  const catalog = getPluginLoadTipsCatalog(locale);
  const template = catalog[id] || PLUGIN_LOAD_TIPS_CATALOGS[BASE_LOCALE][id] || id;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return vars[key] !== undefined ? vars[key] : `{{${key}}}`;
  });
}

function normalizeLocaleTag(value?: string | null): string | null {
  if (!value) return null;
  let tag = String(value).trim().replace(/_/g, '-');
  tag = tag.split('.')[0] || tag;
  tag = tag.split('@')[0] || tag;
  if (!tag) return null;
  const parts = tag.split('-');
  if (parts.length === 1) return parts[0].toLowerCase();
  const lang = parts[0].toLowerCase();
  const rest = parts.slice(1).map((part) => {
    const lower = part.toLowerCase();
    if (lower === 'hant' || lower === 'hans') {
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }
    if (part.length === 2 || part.length === 3) return part.toUpperCase();
    return part;
  });
  return [lang, ...rest].join('-');
}

function matchLocale(tag: string): string | null {
  if (PLUGIN_LOAD_TIPS_CATALOGS[tag]) return tag;
  const lower = tag.toLowerCase();
  for (const key of Object.keys(PLUGIN_LOAD_TIPS_CATALOGS)) {
    if (key.toLowerCase() === lower) return key;
  }
  const lang = tag.split('-')[0]?.toLowerCase();
  if (lang && PLUGIN_LOAD_TIPS_CATALOGS[lang]) return lang;
  if (lang === 'zh' && /hant|tw|hk/i.test(tag)) {
    if (PLUGIN_LOAD_TIPS_CATALOGS['zh-Hant']) return 'zh-Hant';
  }
  return null;
}
