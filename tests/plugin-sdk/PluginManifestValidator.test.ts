import { PluginManifestValidator } from '../../src/plugin-sdk/manifest.js';

describe('PluginManifestValidator', () => {
  it('should validate a complete and correct manifest', () => {
    const raw = {
      name: 'git-sentinel-plugin',
      version: '1.2.0',
      description: 'Automated Git branch hygiene and PR watchdog',
      author: 'Zavorth Team',
      license: 'MIT',
      main: 'dist/index.js',
      capabilities: ['tools', 'lifecycle_hook'],
      permissions: ['filesystem.read', 'filesystem.write'],
      settingsSchema: {
        autoCommit: {
          type: 'boolean',
          label: 'Auto Commit',
          defaultValue: true,
        },
      },
    };

    const result = PluginManifestValidator.validate(raw);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.manifest?.name).toBe('git-sentinel-plugin');
    expect(result.manifest?.capabilities).toContain('tools');
  });

  it('should reject manifest with missing required fields', () => {
    const raw = {
      description: 'Incomplete plugin',
    };

    const result = PluginManifestValidator.validate(raw);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
