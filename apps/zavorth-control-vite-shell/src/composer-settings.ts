import { translate } from './locale';

export type ComposerSettings = {
  voice: string;
  model: string;
  sensitivity: string;
  thinking: boolean;
  tools: boolean;
  focus: boolean;
};

const COMPOSER_SETTINGS_KEY = 'zavorth.control.composerSettings';

export const DEFAULT_COMPOSER_SETTINGS: ComposerSettings = {
  voice: 'default',
  model: 'auto',
  sensitivity: 'default',
  thinking: false,
  tools: true,
  focus: false,
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
  return {
    ...DEFAULT_COMPOSER_SETTINGS,
    ...(nextSettings && typeof nextSettings === 'object' ? nextSettings : {}),
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
  if (key === 'model') return normalized === 'safe' ? 'Safe model' : normalized === 'local' ? 'Local model' : '';
  if (key === 'sensitivity') return `${normalized} sensitivity`;
  return normalized;
}

export function isComposerPresetActive(preset: string, settings: ComposerSettings) {
  if (preset === 'safe-review') return settings.model === 'safe' && settings.sensitivity === 'high';
  if (preset === 'fast-local') return settings.model === 'local' && settings.focus;
  return settings.model === 'auto' && settings.sensitivity === 'default';
}

export function composerPresetSettings(preset: string): Partial<ComposerSettings> {
  if (preset === 'safe-review') return { model: 'safe', sensitivity: 'high', tools: true, thinking: true, focus: false };
  if (preset === 'fast-local') return { model: 'local', sensitivity: 'low', tools: false, thinking: false, focus: true };
  return { model: 'auto', sensitivity: 'default', tools: true, thinking: false, focus: false };
}
