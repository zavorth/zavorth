import {
  createSettingsBackup,
  MAX_SETTINGS_BACKUP_BYTES,
  parseSettingsBackup,
} from './mocks/settingsBackup';

describe('desktop settings backup', () => {
  const settings = { theme: 'system', accent: 'green', profile: 'personal', effort: 'medium' };

  it('exports and imports only allowlisted preferences', () => {
    const backup = createSettingsBackup(settings);
    expect(parseSettingsBackup(JSON.stringify(backup)).settings).toEqual(settings);
    expect(JSON.stringify(backup)).not.toMatch(/apiKey|token|provider|baseUrl/i);
  });

  it('rejects credentials, unknown fields, invalid values, and oversized files', () => {
    expect(() => parseSettingsBackup(JSON.stringify({
      version: 1,
      settings,
      providers: [{ apiKey: 'secret' }],
    }))).toThrow('settings_backup_unknown_field');
    expect(() => parseSettingsBackup(JSON.stringify({
      version: 1,
      settings: { ...settings, theme: 'injected' },
    }))).toThrow('settings_backup_value_invalid');
    expect(() => parseSettingsBackup('x'.repeat(MAX_SETTINGS_BACKUP_BYTES + 1))).toThrow('settings_backup_too_large');
  });
});
