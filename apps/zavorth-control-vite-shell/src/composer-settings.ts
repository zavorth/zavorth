import { translate } from './locale';

export type ComposerSettings = {
  voice: string;
  model: string;
  effort: string;
  sensitivity: string;
  thinking: boolean;
  tools: boolean;
  focus: boolean;
  fast: boolean;
  verbose: string;
  trace: boolean;
};

const COMPOSER_SETTINGS_KEY = 'zavorth.control.composerSettings';

export const DEFAULT_COMPOSER_SETTINGS: ComposerSettings = {
  voice: 'default',
  model: 'auto',
  effort: 'balanced',
  sensitivity: 'default',
  thinking: false,
  tools: true,
  focus: false,
  fast: false,
  verbose: 'off',
  trace: false,
};

export function readComposerSettings(): ComposerSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(COMPOSER_SETTINGS_KEY) || '{}');
    return normalizeComposerSettings(parsed);
  } catch {
    return { ...DEFAULT_COMPOSER_SETTINGS };
  }
}

export function persistComposerSettings(nextSettings: Partial<ComposerSettings>): ComposerSettings {
  const normalized = normalizeComposerSettings(nextSettings);
  try {
    localStorage.setItem(COMPOSER_SETTINGS_KEY, JSON.stringify(normalized));
  } catch {
    // Local composer preferences are best-effort.
  }
  return normalized;
}

export function normalizeComposerSettings(nextSettings: unknown): ComposerSettings {
  const merged = {
    ...DEFAULT_COMPOSER_SETTINGS,
    ...(nextSettings && typeof nextSettings === 'object' ? nextSettings : {}),
  };
  const effort = String(merged.effort || '').toLowerCase();
  const verbose = String(merged.verbose || '').toLowerCase();
  return {
    ...merged,
    effort: ['low', 'balanced', 'deep', 'ultra'].includes(effort) ? effort : DEFAULT_COMPOSER_SETTINGS.effort,
    verbose: ['off', 'on', 'full'].includes(verbose) ? verbose : DEFAULT_COMPOSER_SETTINGS.verbose,
    fast: Boolean(merged.fast),
    trace: Boolean(merged.trace),
  };
}

export function getComposePlaceholder(settings: ComposerSettings) {
  if (settings.model === 'safe') return translate('Ask Zavorth safely');
  if (settings.model === 'local') return translate('Ask Zavorth locally');
  return translate('Ask Zavorth');
}

export function composerSettingLabel(key: string, value: unknown) {
  const normalized = String(value || '').trim();
  if (!normalized || normalized === 'default') return '';
  if (key === 'voice') return normalized.replace('-', ' ');
  if (key === 'model') {
    if (normalized === 'auto') return '';
    if (normalized === 'safe') return 'Safe model';
    if (normalized === 'local') return 'Local model';
    return normalized;
  }
  if (key === 'effort') return normalized === 'balanced' ? 'normal effort' : `${normalized} effort`;
  if (key === 'sensitivity') return `${normalized} sensitivity`;
  if (key === 'verbose') return normalized === 'off' ? '' : `${normalized} verbose`;
  return normalized;
}

export function isComposerPresetActive(preset: string, settings: ComposerSettings) {
  if (preset === 'safe-review') return settings.model === 'safe' && settings.sensitivity === 'high';
  if (preset === 'fast-local') return settings.model === 'local' && settings.focus;
  return settings.model === 'auto' && settings.sensitivity === 'default';
}

export function composerPresetSettings(preset: string): Partial<ComposerSettings> {
  if (preset === 'safe-review') return { model: 'safe', effort: 'deep', sensitivity: 'high', tools: true, thinking: true, focus: false };
  if (preset === 'fast-local') return { model: 'local', effort: 'low', sensitivity: 'low', tools: false, thinking: false, focus: true, fast: true };
  return { model: 'auto', effort: 'balanced', sensitivity: 'default', tools: true, thinking: false, focus: false, fast: false };
}
