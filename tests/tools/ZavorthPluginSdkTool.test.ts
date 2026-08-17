import { ZavorthPluginSdkTool } from '../../src/tools/ZavorthPluginSdkTool.js';
import { PluginSdkRegistry } from '../../src/plugin-sdk/registry.js';
import { definePlugin } from '../../src/plugin-sdk/api.js';

describe('ZavorthPluginSdkTool', () => {
  beforeAll(async () => {
    const registry = PluginSdkRegistry.getInstance();
    const demoPlugin = definePlugin({
      id: 'demo_tool_plugin',
      manifest: {
        name: 'demo_tool_plugin',
        version: '2.1.0',
        description: 'Demo tool provider',
        main: 'index.js',
        capabilities: ['tools'],
        permissions: ['filesystem.read'],
      },
      initialize: () => {},
    });
    await registry.registerAndInitialize(demoPlugin);
  });

  it('should list installed plugins', async () => {
    const raw = await ZavorthPluginSdkTool.execute({
      action: 'list',
    });
    const parsed = JSON.parse(raw);
    expect(parsed.status).toBe('success');
    expect(parsed.total).toBeGreaterThanOrEqual(1);
    expect(parsed.plugins.some((p: any) => p.id === 'demo_tool_plugin')).toBe(true);
  });

  it('should validate valid manifest json', async () => {
    const raw = await ZavorthPluginSdkTool.execute({
      action: 'validate_manifest',
      manifestJson: {
        name: 'valid_plugin',
        version: '1.0.0',
        description: 'Valid description',
        main: 'dist/index.js',
        capabilities: ['tools'],
        permissions: ['filesystem.read'],
      },
    });
    const parsed = JSON.parse(raw);
    expect(parsed.status).toBe('success');
    expect(parsed.valid).toBe(true);
  });

  it('should inspect a loaded plugin', async () => {
    const raw = await ZavorthPluginSdkTool.execute({
      action: 'inspect',
      pluginId: 'demo_tool_plugin',
    });
    const parsed = JSON.parse(raw);
    expect(parsed.status).toBe('success');
    expect(parsed.plugin.id).toBe('demo_tool_plugin');
  });

  it('should unload a loaded plugin', async () => {
    const raw = await ZavorthPluginSdkTool.execute({
      action: 'unload',
      pluginId: 'demo_tool_plugin',
    });
    const parsed = JSON.parse(raw);
    expect(parsed.status).toBe('success');
  });
});
