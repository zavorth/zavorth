import { PluginSdkRegistry } from '../../src/plugin-sdk/registry.js';
import { definePlugin } from '../../src/plugin-sdk/api.js';
import { BaseTool } from '../../src/tools/BaseTool.js';

class MockPluginTool extends BaseTool {
  readonly name = 'mock_plugin_tool';
  readonly description = 'Tool registered dynamically by plugin';
  readonly parameters = { type: 'object' as const, properties: {} };
  public async execute(): Promise<string> {
    return 'mock result';
  }
}

describe('PluginSdkRegistry', () => {
  let registry: PluginSdkRegistry;

  beforeEach(() => {
    registry = new PluginSdkRegistry();
  });

  it('should initialize plugin, register dynamic tools, and unregister on unload', async () => {
    const plugin = definePlugin({
      id: 'custom_calc_plugin',
      manifest: {
        name: 'custom_calc_plugin',
        version: '1.0.0',
        description: 'Test calc plugin',
        main: 'index.js',
        capabilities: ['tools'],
        permissions: ['filesystem.read'],
      },
      initialize: (ctx) => {
        ctx.registerTool(new MockPluginTool());
      },
    });

    const record = await registry.registerAndInitialize(plugin);
    expect(record.status).toBe('active');
    expect(record.registeredTools.has('mock_plugin_tool')).toBe(true);

    const tools = registry.getAllTools();
    expect(tools.some((t) => t.name === 'mock_plugin_tool')).toBe(true);

    const unloaded = await registry.unload('custom_calc_plugin');
    expect(unloaded).toBe(true);
    expect(registry.getPlugin('custom_calc_plugin')).toBeUndefined();
    expect(registry.getAllTools().some((t) => t.name === 'mock_plugin_tool')).toBe(false);
  });
});
