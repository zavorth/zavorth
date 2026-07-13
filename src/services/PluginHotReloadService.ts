import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';

export type PluginHotReloadMode = 'auto' | 'watch' | 'poll';

export type PluginHotReloadWatchInput = {
  pluginPath: string;
  root: string;
  intervalMs?: number;
  /** Debounce for fs.watch events (default 150ms). */
  debounceMs?: number;
  /** Watch strategy. Default auto: prefer fs.watch, fall back to poll. */
  mode?: PluginHotReloadMode;
  onChange: (info: { path: string; mtimeMs: number }) => void | Promise<void>;
  /** Optional injectable clock for tests */
  nowMs?: () => number;
  existsSync?: typeof fs.existsSync;
  statSync?: typeof fs.statSync;
  readdirSync?: typeof fs.readdirSync;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
  /** Injectable fs.watch for tests / platforms. */
  watchFn?: (
    target: string,
    options: { recursive?: boolean },
    listener: (eventType: string, filename: string | Buffer | null) => void,
  ) => fs.FSWatcher | EventEmitter;
};

export type PluginHotReloadWatchHandle = {
  stop: () => void;
  /** Last known fingerprint of watched files (for tests). */
  getFingerprint: () => string;
  /** Active strategy after start (for tests). */
  getMode: () => 'watch' | 'poll';
};

const WATCH_BASENAMES = new Set([
  'manifest.json',
  'zavorth.plugin.json',
  'plugin.json',
  'index.js',
  'index.cjs',
  'index.mjs',
  'index.ts',
  'janitor.js',
  'package.json',
]);

const WATCH_EXTENSIONS = new Set(['.js', '.cjs', '.mjs', '.ts', '.json']);

export class PluginHotReloadService {
  public watch(input: PluginHotReloadWatchInput): PluginHotReloadWatchHandle {
    const root = path.resolve(input.root || process.cwd());
    const pluginPath = path.resolve(input.pluginPath);
    const intervalMs = Math.max(25, Number(input.intervalMs || 500));
    const debounceMs = Math.max(0, Number(input.debounceMs ?? 150));
    const preferredMode: PluginHotReloadMode = input.mode || 'auto';
    const existsSyncImpl = input.existsSync || fs.existsSync.bind(fs);
    const statSyncImpl = input.statSync || fs.statSync.bind(fs);
    const readdirSyncImpl = input.readdirSync || fs.readdirSync.bind(fs);
    const setIntervalFn = input.setIntervalFn || setInterval;
    const clearIntervalFn = input.clearIntervalFn || clearInterval;
    const setTimeoutFn = input.setTimeoutFn || setTimeout;
    const clearTimeoutFn = input.clearTimeoutFn || clearTimeout;
    const watchFn = input.watchFn || defaultWatchFn;

    let stopped = false;
    let inFlight = false;
    let activeMode: 'watch' | 'poll' = 'poll';
    let lastFingerprint = this.computeFingerprint(pluginPath, {
      existsSync: existsSyncImpl,
      statSync: statSyncImpl,
      readdirSync: readdirSyncImpl,
    });

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let watcher: fs.FSWatcher | EventEmitter | null = null;

    const emitChange = async () => {
      if (stopped || inFlight) {
        return;
      }
      const next = this.computeFingerprint(pluginPath, {
        existsSync: existsSyncImpl,
        statSync: statSyncImpl,
        readdirSync: readdirSyncImpl,
      });
      if (next === lastFingerprint) {
        return;
      }
      lastFingerprint = next;
      const mtimeMs = this.maxMtimeMs(pluginPath, {
        existsSync: existsSyncImpl,
        statSync: statSyncImpl,
        readdirSync: readdirSyncImpl,
      });
      inFlight = true;
      try {
        await input.onChange({ path: pluginPath, mtimeMs });
      } catch {
        /* soft-fail reload callback */
      } finally {
        inFlight = false;
      }
    };

    const scheduleEmit = () => {
      if (stopped) {
        return;
      }
      if (debounceMs <= 0) {
        void emitChange();
        return;
      }
      if (debounceTimer) {
        clearTimeoutFn(debounceTimer);
      }
      debounceTimer = setTimeoutFn(() => {
        debounceTimer = null;
        void emitChange();
      }, debounceMs);
      if (typeof (debounceTimer as { unref?: () => void }).unref === 'function') {
        (debounceTimer as { unref: () => void }).unref();
      }
    };

    const startPoll = () => {
      activeMode = 'poll';
      if (pollTimer) {
        return;
      }
      pollTimer = setIntervalFn(() => {
        void emitChange();
      }, intervalMs);
      if (typeof (pollTimer as { unref?: () => void }).unref === 'function') {
        (pollTimer as { unref: () => void }).unref();
      }
    };

    const startWatch = (): boolean => {
      try {
        const created = watchFn(
          pluginPath,
          { recursive: true },
          () => {
            scheduleEmit();
          },
        );
        watcher = created;
        activeMode = 'watch';

        const onError = () => {
          if (stopped) {
            return;
          }
          tryCloseWatcher(watcher);
          watcher = null;
          startPoll();
        };

        if (typeof (created as fs.FSWatcher).on === 'function') {
          (created as fs.FSWatcher).on('error', onError);
        }

        return true;
      } catch {
        return false;
      }
    };

    if (preferredMode === 'poll') {
      startPoll();
    } else if (preferredMode === 'watch') {
      if (!startWatch()) {
        startPoll();
      }
    } else {
      // auto
      if (!startWatch()) {
        startPoll();
      }
    }

    void root; // reserved for future path filtering

    return {
      stop: () => {
        if (stopped) {
          return;
        }
        stopped = true;
        if (debounceTimer) {
          clearTimeoutFn(debounceTimer);
          debounceTimer = null;
        }
        if (pollTimer) {
          clearIntervalFn(pollTimer as ReturnType<typeof setInterval>);
          pollTimer = null;
        }
        tryCloseWatcher(watcher);
        watcher = null;
      },
      getFingerprint: () => lastFingerprint,
      getMode: () => activeMode,
    };
  }

  public listWatchTargets(pluginPath: string, runtime: {
    existsSync?: typeof fs.existsSync;
    readdirSync?: typeof fs.readdirSync;
    statSync?: typeof fs.statSync;
  } = {}): string[] {
    const existsSyncImpl = runtime.existsSync || fs.existsSync.bind(fs);
    const readdirSyncImpl = runtime.readdirSync || fs.readdirSync.bind(fs);
    const statSyncImpl = runtime.statSync || fs.statSync.bind(fs);
    const resolved = path.resolve(pluginPath);
    if (!existsSyncImpl(resolved)) {
      return [];
    }

    const targets: string[] = [];
    const stack = [resolved];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      let stat: fs.Stats;
      try {
        stat = statSyncImpl(current);
      } catch {
        continue;
      }
      if (stat.isFile()) {
        const base = path.basename(current).toLowerCase();
        const ext = path.extname(current).toLowerCase();
        if (WATCH_BASENAMES.has(base) || WATCH_EXTENSIONS.has(ext)) {
          targets.push(current);
        }
        continue;
      }
      if (!stat.isDirectory()) {
        continue;
      }
      const baseName = path.basename(current);
      if (baseName === 'node_modules' || baseName === '.git' || baseName === 'dist') {
        continue;
      }
      let entries: string[] = [];
      try {
        entries = readdirSyncImpl(current);
      } catch {
        continue;
      }
      for (const entry of entries) {
        stack.push(path.join(current, entry));
      }
    }
    return targets.sort((left, right) => left.localeCompare(right));
  }

  private computeFingerprint(pluginPath: string, runtime: {
    existsSync: typeof fs.existsSync;
    statSync: typeof fs.statSync;
    readdirSync: typeof fs.readdirSync;
  }): string {
    const targets = this.listWatchTargets(pluginPath, runtime);
    const parts: string[] = [];
    for (const target of targets) {
      try {
        const stat = runtime.statSync(target);
        parts.push(`${target}:${stat.mtimeMs}:${stat.size}`);
      } catch {
        parts.push(`${target}:missing`);
      }
    }
    return parts.join('|');
  }

  private maxMtimeMs(pluginPath: string, runtime: {
    existsSync: typeof fs.existsSync;
    statSync: typeof fs.statSync;
    readdirSync: typeof fs.readdirSync;
  }): number {
    let max = 0;
    for (const target of this.listWatchTargets(pluginPath, runtime)) {
      try {
        const stat = runtime.statSync(target);
        if (stat.mtimeMs > max) {
          max = stat.mtimeMs;
        }
      } catch {
        /* soft-fail */
      }
    }
    return max;
  }
}

function defaultWatchFn(
  target: string,
  options: { recursive?: boolean },
  listener: (eventType: string, filename: string | Buffer | null) => void,
): fs.FSWatcher {
  return fs.watch(target, options, listener);
}

function tryCloseWatcher(watcher: fs.FSWatcher | EventEmitter | null): void {
  if (!watcher) {
    return;
  }
  try {
    if (typeof (watcher as fs.FSWatcher).close === 'function') {
      (watcher as fs.FSWatcher).close();
    } else if (typeof (watcher as EventEmitter).removeAllListeners === 'function') {
      (watcher as EventEmitter).removeAllListeners();
    }
  } catch {
    /* soft-fail close */
  }
}
