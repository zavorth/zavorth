export type PremiumThemeTranslucency = 'solid' | 'soft' | 'glass';

export interface PremiumTheme {
  id: string;
  name: string;
  description: string;
  author?: string;
  translucency: PremiumThemeTranslucency;
  cssVars: Record<string, string>;
  builtin?: boolean;
}

export interface PremiumThemeState {
  selectedByProfile: Record<string, string>;
  selectedBySession: Record<string, string>;
  fontByProfile: Record<string, string>;
  customThemes: PremiumTheme[];
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export const PREMIUM_THEME_STORAGE_KEY = 'zvd:premium-themes:v1';
export const DEFAULT_PREMIUM_THEME_ID = 'zavorth-official';
export const DEFAULT_PREMIUM_FONT = 'Inter';

export const premiumThemeFonts = [
  'Inter',
  'Segoe UI',
  'Geist',
  'SF Pro Text',
  'JetBrains Mono',
  'Atkinson Hyperlegible',
] as const;

const allowedVariablePattern = /^--zvd-(seed|glass|premium)-[a-z0-9-]+$/;
const unsafeValuePattern = /(url\s*\(|expression\s*\(|javascript:|<|>|;)/i;

export const premiumThemeMarketplace: PremiumTheme[] = [
  {
    id: 'zavorth-official',
    name: 'Zavorth Official',
    description: 'Brand green #00e88f on calm surfaces — Kael-ready daily desktop.',
    author: 'Zavorth',
    translucency: 'soft',
    builtin: true,
    cssVars: {
      '--zvd-seed-accent': '#00e88f',
      '--zvd-seed-accent-2': '#5ef0b5',
      '--zvd-seed-bg': '#f4faf7',
      '--zvd-seed-surface': '#fbfffd',
      '--zvd-seed-sidebar': '#eef6f2',
      '--zvd-glass-opacity': '0.88',
      '--zvd-glass-blur': '18px',
    },
  },
  {
    id: 'zavorth-atelier',
    name: 'Zavorth Atelier',
    description: 'Warm neutral surfaces with restrained depth for daily work.',
    author: 'Zavorth',
    translucency: 'soft',
    builtin: true,
    cssVars: {
      '--zvd-seed-accent': '#d86b2a',
      '--zvd-seed-accent-2': '#e8a276',
      '--zvd-seed-bg': '#f7f4ef',
      '--zvd-seed-surface': '#fffaf5',
      '--zvd-seed-sidebar': '#eee9e2',
      '--zvd-glass-opacity': '0.88',
      '--zvd-glass-blur': '18px',
    },
  },
  {
    id: 'graphite-glass',
    name: 'Graphite Glass',
    description: 'A quiet translucent dark desktop for long technical sessions.',
    author: 'Zavorth',
    translucency: 'glass',
    builtin: true,
    cssVars: {
      '--zvd-seed-accent': '#9e7bff',
      '--zvd-seed-accent-2': '#c8b8ff',
      '--zvd-seed-bg': '#121316',
      '--zvd-seed-surface': '#181a1f',
      '--zvd-seed-sidebar': '#101115',
      '--zvd-glass-opacity': '0.74',
      '--zvd-glass-blur': '24px',
    },
  },
  {
    id: 'daylight-focus',
    name: 'Daylight Focus',
    description: 'Clear modern contrast with cooler accents and less visual heat.',
    author: 'Zavorth',
    translucency: 'solid',
    builtin: true,
    cssVars: {
      '--zvd-seed-accent': '#4f8dff',
      '--zvd-seed-accent-2': '#94b8ff',
      '--zvd-seed-bg': '#f5f8fc',
      '--zvd-seed-surface': '#ffffff',
      '--zvd-seed-sidebar': '#edf2f8',
      '--zvd-glass-opacity': '0.94',
      '--zvd-glass-blur': '14px',
    },
  },
];

export function loadPremiumThemeState(storage: StorageLike = defaultStorage()): PremiumThemeState {
  try {
    const parsed = JSON.parse(storage.getItem(PREMIUM_THEME_STORAGE_KEY) || '{}');
    return sanitizeThemeState(parsed);
  } catch {
    return emptyThemeState();
  }
}

export function savePremiumThemeState(
  state: PremiumThemeState,
  storage: StorageLike = defaultStorage(),
): PremiumThemeState {
  const sanitized = sanitizeThemeState(state);
  storage.setItem(PREMIUM_THEME_STORAGE_KEY, JSON.stringify(sanitized));
  return sanitized;
}

export function selectPremiumThemeForProfile(
  profile: string,
  themeId: string,
  storage: StorageLike = defaultStorage(),
): PremiumThemeState {
  const current = loadPremiumThemeState(storage);
  const next = sanitizeThemeState({
    ...current,
    selectedByProfile: {
      ...current.selectedByProfile,
      [profileKey(profile)]: themeId,
    },
  });
  return savePremiumThemeState(next, storage);
}

export function selectPremiumThemeForSession(
  sessionId: string,
  themeId: string,
  storage: StorageLike = defaultStorage(),
): PremiumThemeState {
  const current = loadPremiumThemeState(storage);
  const next = sanitizeThemeState({
    ...current,
    selectedBySession: {
      ...current.selectedBySession,
      [sessionKey(sessionId)]: themeId,
    },
  });
  return savePremiumThemeState(next, storage);
}

export function selectPremiumFontForProfile(
  profile: string,
  fontFamily: string,
  storage: StorageLike = defaultStorage(),
): PremiumThemeState {
  const current = loadPremiumThemeState(storage);
  const font = sanitizeFontFamily(fontFamily);
  const next = sanitizeThemeState({
    ...current,
    fontByProfile: {
      ...current.fontByProfile,
      [profileKey(profile)]: font,
    },
  });
  return savePremiumThemeState(next, storage);
}

export function resolvePremiumThemeForProfile(
  profile: string,
  state: PremiumThemeState = loadPremiumThemeState(),
): PremiumTheme {
  const selectedId = state.selectedByProfile[profileKey(profile)] || state.selectedByProfile.default || DEFAULT_PREMIUM_THEME_ID;
  return findPremiumTheme(selectedId, state.customThemes) || premiumThemeMarketplace[0];
}

export function resolvePremiumThemeForSession(
  sessionId: string,
  profile: string,
  state: PremiumThemeState | undefined = undefined,
  storage: StorageLike = defaultStorage(),
): PremiumTheme {
  const themeState = state || loadPremiumThemeState(storage);
  const selectedId = themeState.selectedBySession[sessionKey(sessionId)];
  if (selectedId) {
    return findPremiumTheme(selectedId, themeState.customThemes) || resolvePremiumThemeForProfile(profile, themeState);
  }
  return resolvePremiumThemeForProfile(profile, themeState);
}

export function resolvePremiumFontForProfile(
  profile: string,
  state: PremiumThemeState | undefined = undefined,
  storage: StorageLike = defaultStorage(),
): string {
  const themeState = state || loadPremiumThemeState(storage);
  return sanitizeFontFamily(themeState.fontByProfile[profileKey(profile)] || themeState.fontByProfile.default || DEFAULT_PREMIUM_FONT);
}

export function findPremiumTheme(themeId: string, customThemes: PremiumTheme[] = []): PremiumTheme | null {
  return [...customThemes, ...premiumThemeMarketplace].find(theme => theme.id === themeId) || null;
}

export function importPremiumTheme(input: string | unknown, storage: StorageLike = defaultStorage()): PremiumTheme {
  const raw = typeof input === 'string' ? parseThemeInput(input) : input;
  const imported = sanitizeTheme(raw) || sanitizeVsCodeTheme(raw);
  if (!imported) {
    throw new Error('Invalid premium theme.');
  }

  const state = loadPremiumThemeState(storage);
  const customThemes = [
    imported,
    ...state.customThemes.filter(theme => theme.id !== imported.id),
  ];
  savePremiumThemeState({ ...state, customThemes }, storage);
  return imported;
}

export function premiumThemeClassName(themeId: string): string {
  return `premium-theme-${themeId.replace(/[^a-z0-9-]/gi, '').toLowerCase() || DEFAULT_PREMIUM_THEME_ID}`;
}

export function exportPremiumThemeState(state: PremiumThemeState): string {
  return JSON.stringify(sanitizeThemeState(state), null, 2);
}

function sanitizeThemeState(value: unknown): PremiumThemeState {
  const root = isRecord(value) ? value : {};
  const selectedByProfile = isRecord(root.selectedByProfile)
    ? Object.fromEntries(
        Object.entries(root.selectedByProfile)
          .filter(([key, themeId]) => typeof key === 'string' && typeof themeId === 'string')
          .map(([key, themeId]) => [profileKey(key), themeId]),
      )
    : {};
  const selectedBySession = isRecord(root.selectedBySession)
    ? Object.fromEntries(
        Object.entries(root.selectedBySession)
          .filter(([key, themeId]) => typeof key === 'string' && typeof themeId === 'string')
          .map(([key, themeId]) => [sessionKey(key), themeId]),
      )
    : {};
  const fontByProfile = isRecord(root.fontByProfile)
    ? Object.fromEntries(
        Object.entries(root.fontByProfile)
          .filter(([key, font]) => typeof key === 'string' && typeof font === 'string')
          .map(([key, font]) => [profileKey(key), sanitizeFontFamily(font)]),
      )
    : {};
  const customThemes = Array.isArray(root.customThemes)
    ? root.customThemes.map(sanitizeTheme).filter(Boolean) as PremiumTheme[]
    : [];
  return { selectedByProfile, selectedBySession, fontByProfile, customThemes };
}

function sanitizeTheme(value: unknown): PremiumTheme | null {
  if (!isRecord(value)) {
    return null;
  }
  const name = String(value.name || '').trim().slice(0, 48);
  if (!name) {
    return null;
  }
  const id = String(value.id || `custom-${slugify(name)}`).trim().toLowerCase();
  const cssVars = sanitizeCssVars(value.cssVars);
  if (Object.keys(cssVars).length === 0) {
    return null;
  }
  const translucency = value.translucency === 'glass' || value.translucency === 'solid' || value.translucency === 'soft'
    ? value.translucency
    : 'soft';
  return {
    id: id.startsWith('custom-') ? id : `custom-${slugify(id)}`,
    name,
    description: String(value.description || 'Imported premium theme.').trim().slice(0, 140),
    author: value.author ? String(value.author).trim().slice(0, 40) : 'Imported',
    translucency,
    cssVars,
    builtin: false,
  };
}

function sanitizeVsCodeTheme(value: unknown): PremiumTheme | null {
  if (!isRecord(value) || !isRecord(value.colors)) {
    return null;
  }
  const name = String(value.name || '').trim().slice(0, 48);
  if (!name) {
    return null;
  }
  const colors = value.colors as Record<string, unknown>;
  const cssVars = sanitizeCssVars({
    '--zvd-seed-bg': colors['editor.background'],
    '--zvd-seed-surface': colors['editorWidget.background'] || colors['panel.background'] || colors['editor.background'],
    '--zvd-seed-sidebar': colors['sideBar.background'] || colors['activityBar.background'] || colors['editor.background'],
    '--zvd-seed-accent': colors['button.background'] || colors['activityBarBadge.background'] || colors['focusBorder'],
    '--zvd-seed-accent-2': colors['textLink.foreground'] || colors['editorCursor.foreground'] || colors['button.background'],
    '--zvd-glass-opacity': '0.9',
    '--zvd-glass-blur': '18px',
  });
  if (Object.keys(cssVars).length === 0) {
    return null;
  }
  const type = String(value.type || '').toLowerCase();
  return {
    id: `custom-${slugify(name)}`,
    name,
    description: `Imported VS Code ${type === 'light' ? 'light' : 'dark'} theme.`,
    author: 'VS Code import',
    translucency: 'solid',
    cssVars,
    builtin: false,
  };
}

function sanitizeCssVars(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }
  const entries = Object.entries(value).filter(([key, rawValue]) => {
    const stringValue = String(rawValue || '').trim();
    return allowedVariablePattern.test(key)
      && stringValue.length > 0
      && stringValue.length <= 80
      && !unsafeValuePattern.test(stringValue);
  });
  return Object.fromEntries(entries.map(([key, rawValue]) => [key, String(rawValue).trim()]));
}

function emptyThemeState(): PremiumThemeState {
  return { selectedByProfile: {}, selectedBySession: {}, fontByProfile: {}, customThemes: [] };
}

function profileKey(profile: string): string {
  return String(profile || 'default').trim().toLowerCase() || 'default';
}

function sessionKey(sessionId: string): string {
  return String(sessionId || 'default').trim().toLowerCase() || 'default';
}

function sanitizeFontFamily(value: unknown): string {
  const font = String(value || '').trim().slice(0, 64);
  if (!font || unsafeValuePattern.test(font)) {
    return DEFAULT_PREMIUM_FONT;
  }
  return font;
}

function parseThemeInput(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    const withoutComments = input
      .replace(/\/\*[\s\S]*...\*\//g, '')
      .replace(/(^|\s)\/\/.*$/gm, '$1');
    return JSON.parse(withoutComments.replace(/,\s*([}\]])/g, '$1'));
  }
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'theme';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function defaultStorage(): StorageLike {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  const memory = new Map<string, string>();
  return {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { memory.set(key, value); },
  };
}
