import * as fs from 'node:fs';
import * as path from 'node:path';
import { PluginHotReloadController } from '../../src/plugin-sdk/hot-reload.js';
import { PluginSdkRegistry } from '../../src/plugin-sdk/registry.js';

describe('PluginHotReloadController', () => {
  const testWatchDir = path.join(process.cwd(), '.zavorth', 'test_watch_dir');

  beforeAll(() => {
    if (!fs.existsSync(testWatchDir)) {
      fs.mkdirSync(testWatchDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testWatchDir)) {
      try {
        fs.rmSync(testWatchDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  });

  it('should start and stop watching plugins for hot reload', () => {
    const registry = new PluginSdkRegistry();
    const controller = new PluginHotReloadController(undefined, registry);

    const handle = controller.watchPlugin({
      pluginId: 'demo_watch_plugin',
      pluginDir: testWatchDir,
    });

    expect(handle).toBeDefined();
    expect(controller.listWatchedPlugins()).toContain('demo_watch_plugin');

    const unwatched = controller.unwatchPlugin('demo_watch_plugin');
    expect(unwatched).toBe(true);
    expect(controller.listWatchedPlugins()).not.toContain('demo_watch_plugin');
  });
});
