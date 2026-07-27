const ALLOWLISTED_KEYS = ['theme', 'accent', 'profile', 'effort'] as const;
const VALID_THEMES = ['system', 'light', 'dark', 'zavorth'] as const;
const VALID_ACCENTS = ['orange', 'green', 'blue', 'purple', 'red', 'pink'] as const;
const VALID_PROFILES = ['personal', 'developer', 'daily'] as const;
const VALID_EFFORTS = ['low', 'medium', 'high'] as const;

export const MAX_SETTINGS_BACKUP_BYTES = 64 * 1024;

export function createSettingsBackup(settings: Record<string, unknown>) {
  const filtered: Record<string, unknown> = {};
  for (const key of ALLOWLISTED_KEYS) {
    if (key in settings) {
      filtered[key] = settings[key];
    }
  }
  return { version: 1, settings: filtered };
}

export function parseSettingsBackup(raw: string): { settings: Record<string, unknown> } {
  if (typeof raw === 'string' && raw.length > MAX_SETTINGS_BACKUP_BYTES) {
    throw new Error('settings_backup_too_large');
  }

  const parsed = JSON.parse(raw);

  if (parsed.providers || parsed.apiKey || parsed.token) {
    throw new Error('settings_backup_unknown_field');
  }

  const extraKeys = Object.keys(parsed).filter(
    (k) => k !== 'version' && k !== 'settings',
  );
  if (extraKeys.length > 0) {
    throw new Error('settings_backup_unknown_field');
  }

  const settings = parsed.settings || {};

  if (settings.theme && !(VALID_THEMES as readonly string[]).includes(settings.theme)) {
    throw new Error('settings_backup_value_invalid');
  }

  return { settings };
}
