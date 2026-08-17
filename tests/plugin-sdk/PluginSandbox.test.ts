import { PluginSandbox } from '../../src/plugin-sdk/sandbox.js';
import type { PluginManifest } from '../../src/plugin-sdk/manifest.js';

describe('PluginSandbox', () => {
  const manifest: PluginManifest = {
    name: 'test-sandbox-plugin',
    version: '1.0.0',
    description: 'Sandbox verification plugin',
    main: 'index.js',
    capabilities: ['tools'],
    permissions: ['filesystem.read'], // network.http is missing
  };

  it('should verify granted permissions correctly', () => {
    const sandbox = new PluginSandbox('test-plugin', manifest);
    expect(sandbox.hasPermission('filesystem.read')).toBe(true);
    expect(sandbox.hasPermission('filesystem.write')).toBe(false);
    expect(sandbox.hasPermission('network.http')).toBe(false);
  });

  it('should throw error when asserting missing permission', () => {
    const sandbox = new PluginSandbox('test-plugin', manifest);
    expect(() => {
      sandbox.assertPermission('network.http', 'Calling external API');
    }).toThrow(/denied permission "network.http"/);
  });
});
