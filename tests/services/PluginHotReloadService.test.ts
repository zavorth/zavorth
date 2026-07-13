import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';

import { PluginHotReloadService } from '../../src/services/PluginHotReloadService.js';

describe('PluginHotReloadService', () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('triggers onChange when package file mtime changes (poll mode)', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-hot-reload-'));
    tempRoots.push(root);
    const pluginPath = path.join(root, 'plugin');
    fs.mkdirSync(pluginPath, { recursive: true });
    const indexPath = path.join(pluginPath, 'index.js');
    fs.writeFileSync(indexPath, 'module.exports = { register() {} };\n', 'utf8');
    fs.writeFileSync(path.join(pluginPath, 'manifest.json'), JSON.stringify({ id: 'demo' }), 'utf8');

    const service = new PluginHotReloadService();
    let fired = 0;
    let lastInfo: { path: string; mtimeMs: number } | null = null;

    const handle = service.watch({
      pluginPath,
      root,
      mode: 'poll',
      intervalMs: 40,
      debounceMs: 0,
      onChange: (info) => {
        fired += 1;
        lastInfo = info;
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(fired).toBe(0);
    expect(handle.getMode()).toBe('poll');

    const next = `${Date.now()}\nmodule.exports = { register() {} };\n`;
    fs.writeFileSync(indexPath, next, 'utf8');
    const past = new Date(Date.now() + 2000);
    fs.utimesSync(indexPath, past, past);

    await new Promise((resolve) => setTimeout(resolve, 150));
    handle.stop();

    expect(fired).toBeGreaterThanOrEqual(1);
    expect(lastInfo?.path).toBe(path.resolve(pluginPath));
    expect(typeof lastInfo?.mtimeMs).toBe('number');
  });

  it('uses injectable watch emitter in watch mode with debounce', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-hot-watch-'));
    tempRoots.push(root);
    const pluginPath = path.join(root, 'plugin');
    fs.mkdirSync(pluginPath, { recursive: true });
    const indexPath = path.join(pluginPath, 'index.js');
    fs.writeFileSync(indexPath, 'module.exports = { register() {} };\n', 'utf8');
    fs.writeFileSync(path.join(pluginPath, 'manifest.json'), JSON.stringify({ id: 'demo' }), 'utf8');

    const emitter = new EventEmitter() as EventEmitter & { close: () => void };
    emitter.close = () => {
      emitter.removeAllListeners();
    };

    let fired = 0;
    const service = new PluginHotReloadService();
    const handle = service.watch({
      pluginPath,
      root,
      mode: 'watch',
      debounceMs: 30,
      watchFn: (_target, _options, listener) => {
        emitter.on('change', () => listener('change', 'index.js'));
        return emitter as unknown as fs.FSWatcher;
      },
      onChange: () => {
        fired += 1;
      },
    });

    expect(handle.getMode()).toBe('watch');

    // First change: update fingerprint then emit watch event
    fs.writeFileSync(indexPath, `${Date.now()}\nmodule.exports = { register() {} };\n`, 'utf8');
    emitter.emit('change');
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(fired).toBeGreaterThanOrEqual(1);

    handle.stop();
  });

  it('falls back to poll when watchFn throws', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-hot-fallback-'));
    tempRoots.push(root);
    const pluginPath = path.join(root, 'plugin');
    fs.mkdirSync(pluginPath, { recursive: true });
    fs.writeFileSync(path.join(pluginPath, 'index.js'), 'x', 'utf8');

    const handle = new PluginHotReloadService().watch({
      pluginPath,
      root,
      mode: 'auto',
      intervalMs: 1000,
      watchFn: () => {
        throw Object.assign(new Error('ENOSYS'), { code: 'ENOSYS' });
      },
      onChange: () => undefined,
    });

    expect(handle.getMode()).toBe('poll');
    handle.stop();
  });

  it('lists watch targets for known package files', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-hot-targets-'));
    tempRoots.push(root);
    const pluginPath = path.join(root, 'plugin');
    fs.mkdirSync(pluginPath, { recursive: true });
    fs.writeFileSync(path.join(pluginPath, 'index.js'), 'x', 'utf8');
    fs.writeFileSync(path.join(pluginPath, 'janitor.js'), 'x', 'utf8');
    fs.writeFileSync(path.join(pluginPath, 'readme.txt'), 'x', 'utf8');

    const targets = new PluginHotReloadService().listWatchTargets(pluginPath);
    expect(targets.some((item) => item.endsWith('index.js'))).toBe(true);
    expect(targets.some((item) => item.endsWith('janitor.js'))).toBe(true);
    expect(targets.some((item) => item.endsWith('readme.txt'))).toBe(false);
  });
});
