import { EventEmitter } from 'node:events';
import type fs from 'node:fs';

import { PluginHotReloadService } from '../../src/services/PluginHotReloadService.js';
import { PluginOsRuntimeWatchService } from '../../src/services/PluginOsRuntimeWatchService.js';

describe('PluginOsRuntimeWatchService', () => {
  it('is disabled unless ZAVORTH_PLUGIN_WATCH=1', () => {
    const service = new PluginOsRuntimeWatchService({
      enabled: false,
      env: {},
      runtime: {
        reloadPlugin: jest.fn(),
        getLoadSnapshot: () => null,
        discover: () => ({ plugins: [] } as never),
      },
    });
    const result = service.start([{ pluginId: 'demo', packageDir: '/tmp/demo' }]);
    expect(result.started).toBe(false);
    expect(result.reason).toMatch(/ZAVORTH_PLUGIN_WATCH/i);
  });

  it('watches targets and reloads plugin on change via mock hot reload', async () => {
    const reloadPlugin = jest.fn(async () => ({
      load: { status: 'loaded', capabilities: ['main.run'], findings: [] },
      wire: null,
    }));
    const discover = jest.fn(() => ({
      plugins: [{
        pluginId: 'demo',
        packageDir: 'C:\\tmp\\demo',
        state: { enabled: true, trust: 'trusted' },
        loadEligible: true,
      }],
    }));

    const emitters: EventEmitter[] = [];
    const hotReload = new PluginHotReloadService();
    // Patch watch to use synthetic emitters and force fingerprint change via direct callback path
    const originalWatch = hotReload.watch.bind(hotReload);
    hotReload.watch = ((input) => {
      const emitter = new EventEmitter() as EventEmitter & { close: () => void };
      emitter.close = () => emitter.removeAllListeners();
      emitters.push(emitter);
      return originalWatch({
        ...input,
        mode: 'watch',
        debounceMs: 10,
        watchFn: (_t, _o, listener) => {
          emitter.on('change', () => listener('change', 'index.js'));
          return emitter as unknown as fs.FSWatcher;
        },
      });
    }) as typeof hotReload.watch;

    // Force fingerprint change by intercepting onChange through a thin wrapper
    let capturedOnChange: ((info: { path: string; mtimeMs: number }) => void | Promise<void>) | null = null;
    const hotReload2 = {
      watch: (input: {
        pluginPath: string;
        root: string;
        onChange: (info: { path: string; mtimeMs: number }) => void | Promise<void>;
      }) => {
        capturedOnChange = input.onChange;
        return {
          stop: () => undefined,
          getFingerprint: () => 'fp',
          getMode: () => 'watch' as const,
        };
      },
    };

    const reloads: Array<{ pluginId: string; ok: boolean }> = [];
    const service = new PluginOsRuntimeWatchService({
      enabled: true,
      env: { ZAVORTH_PLUGIN_WATCH: '1' },
      projectRoot: process.cwd(),
      hotReload: hotReload2 as unknown as PluginHotReloadService,
      runtime: {
        reloadPlugin: reloadPlugin as never,
        getLoadSnapshot: () => null,
        discover: discover as never,
      },
      discovery: {
        discover: discover as never,
      },
      onReload: async (info) => {
        reloads.push({ pluginId: info.pluginId, ok: info.ok });
      },
    });

    const started = service.start([{ pluginId: 'demo', packageDir: 'C:\\tmp\\demo' }]);
    expect(started.started).toBe(true);
    expect(started.watching).toBe(1);
    expect(service.getWatchedPluginIds()).toEqual(['demo']);
    expect(capturedOnChange).toBeTruthy();

    await capturedOnChange?.({ path: 'C:\\tmp\\demo', mtimeMs: Date.now() });
    expect(reloadPlugin).toHaveBeenCalled();
    expect(reloads.some((item) => item.pluginId === 'demo')).toBe(true);

    service.dispose();
    expect(service.getWatchedPluginIds()).toEqual([]);
  });
});
