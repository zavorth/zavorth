import path from 'node:path';

import {
  PluginHotReloadService,
  type PluginHotReloadMode,
  type PluginHotReloadWatchHandle,
} from './PluginHotReloadService.js';
import type { PluginRuntimeService } from './PluginRuntimeService.js';
import type { PluginDiscoveryService } from './PluginDiscoveryService.js';
import type { ZavorthDiscoveredPlugin } from '../contracts/core/PluginRuntimeContract.js';

export type PluginOsRuntimeWatchTarget = {
  pluginId: string;
  packageDir: string;
};

export type PluginOsRuntimeWatchRuntime = {
  enabled?: boolean;
  env?: NodeJS.ProcessEnv;
  projectRoot?: string;
  hotReload?: PluginHotReloadService;
  runtime?: Pick<PluginRuntimeService, 'reloadPlugin' | 'getLoadSnapshot' | 'discover'>;
  discovery?: Pick<PluginDiscoveryService, 'discover'>;
  mode?: PluginHotReloadMode;
  debounceMs?: number;
  intervalMs?: number;
  onReload?: (info: {
    pluginId: string;
    path: string;
    mtimeMs: number;
    ok: boolean;
    summary: string;
  }) => void | Promise<void>;
  now?: () => Date;
};

/**
 * Watches packageDirs of loaded/enabled plugins and reloads on change.
 * Enabled when ZAVORTH_PLUGIN_WATCH=1 (default off).
 */
export class PluginOsRuntimeWatchService {
  private readonly env: NodeJS.ProcessEnv;
  private readonly projectRoot: string;
  private readonly hotReload: PluginHotReloadService;
  private readonly runtime: PluginOsRuntimeWatchRuntime['runtime'] | null;
  private readonly discovery: PluginOsRuntimeWatchRuntime['discovery'] | null;
  private readonly mode: PluginHotReloadMode;
  private readonly debounceMs: number;
  private readonly intervalMs: number;
  private readonly onReload: PluginOsRuntimeWatchRuntime['onReload'];
  private readonly forcedEnabled: boolean | null;
  private readonly handles = new Map<string, PluginHotReloadWatchHandle>();
  private started = false;

  constructor(runtime: PluginOsRuntimeWatchRuntime = {}) {
    this.env = runtime.env || process.env;
    this.projectRoot = path.resolve(runtime.projectRoot || process.cwd());
    this.hotReload = runtime.hotReload || new PluginHotReloadService();
    this.runtime = runtime.runtime || null;
    this.discovery = runtime.discovery || null;
    this.mode = runtime.mode || 'auto';
    this.debounceMs = runtime.debounceMs ?? 150;
    this.intervalMs = runtime.intervalMs ?? 500;
    this.onReload = runtime.onReload;
    this.forcedEnabled = typeof runtime.enabled === 'boolean' ? runtime.enabled : null;
  }

  public isEnabled(): boolean {
    if (this.forcedEnabled !== null) {
      return this.forcedEnabled;
    }
    return this.env.ZAVORTH_PLUGIN_WATCH === '1';
  }

  /**
   * Start watching targets. Soft-fails if disabled or runtime missing.
   */
  public start(targets?: PluginOsRuntimeWatchTarget[]): { started: boolean; watching: number; reason?: string } {
    if (!this.isEnabled()) {
      return { started: false, watching: 0, reason: 'ZAVORTH_PLUGIN_WATCH is not 1' };
    }
    if (!this.runtime) {
      return { started: false, watching: 0, reason: 'runtime not configured' };
    }

    const resolved = targets && targets.length > 0
      ? targets
      : this.collectTargetsFromRuntime();

    this.dispose();
    this.started = true;

    for (const target of resolved) {
      this.watchOne(target);
    }

    return { started: true, watching: this.handles.size };
  }

  public watchPlugin(target: PluginOsRuntimeWatchTarget): void {
    if (!this.isEnabled() || !this.runtime) {
      return;
    }
    this.started = true;
    this.watchOne(target);
  }

  public getWatchedPluginIds(): string[] {
    return Array.from(this.handles.keys()).sort((a, b) => a.localeCompare(b));
  }

  public dispose(): void {
    for (const handle of this.handles.values()) {
      try {
        handle.stop();
      } catch {
        /* soft-fail */
      }
    }
    this.handles.clear();
    this.started = false;
  }

  private watchOne(target: PluginOsRuntimeWatchTarget): void {
    const pluginId = String(target.pluginId || '').trim();
    const packageDir = path.resolve(target.packageDir || '');
    if (!pluginId || !packageDir) {
      return;
    }

    const existing = this.handles.get(pluginId);
    if (existing) {
      try {
        existing.stop();
      } catch {
        /* soft-fail */
      }
      this.handles.delete(pluginId);
    }

    const handle = this.hotReload.watch({
      pluginPath: packageDir,
      root: this.projectRoot,
      mode: this.mode,
      debounceMs: this.debounceMs,
      intervalMs: this.intervalMs,
      onChange: async (info) => {
        await this.handleChange(pluginId, packageDir, info);
      },
    });
    this.handles.set(pluginId, handle);
  }

  private async handleChange(
    pluginId: string,
    packageDir: string,
    info: { path: string; mtimeMs: number },
  ): Promise<void> {
    if (!this.runtime) {
      return;
    }
    try {
      const discovered = this.rediscover(pluginId, packageDir);
      if (!discovered) {
        await this.onReload?.({
          pluginId,
          path: info.path,
          mtimeMs: info.mtimeMs,
          ok: false,
          summary: 'plugin not discovered after change',
        });
        return;
      }
      const reloaded = await this.runtime.reloadPlugin(pluginId, discovered, {
        approved: discovered.state?.trust === 'trusted' || discovered.state?.enabled === true,
      });
      const ok = reloaded.load.status === 'loaded';
      const summary = ok ? `reload ok status=${reloaded.load.status} capabilities=${reloaded.load.capabilities.length}`
        : `reload ${reloaded.load.status}: ${reloaded.load.findings.slice(0, 2).join('; ')}`;
      await this.onReload?.({
        pluginId,
        path: info.path,
        mtimeMs: info.mtimeMs,
        ok,
        summary,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      await this.onReload?.({
        pluginId,
        path: info.path,
        mtimeMs: info.mtimeMs,
        ok: false,
        summary: message,
      });
    }
  }

  private rediscover(pluginId: string, packageDir: string): ZavorthDiscoveredPlugin | null {
    try {
      if (this.discovery) {
        const snapshot = this.discovery.discover({ projectRoot: this.projectRoot });
        const found = snapshot.plugins.find((plugin) => plugin.pluginId === pluginId);
        if (found) {
          return found;
        }
      }
      if (this.runtime && typeof this.runtime.discover === 'function') {
        const snapshot = this.runtime.discover({ projectRoot: this.projectRoot });
        const found = snapshot.plugins.find((plugin) => plugin.pluginId === pluginId);
        if (found) {
          return found;
        }
      }
    } catch {
      /* soft-fail */
    }

    // Minimal discovered local from known packageDir so reload can still attempt load.
    return {
      pluginId,
      sourceKind: 'workspace',
      sourceRoot: this.projectRoot,
      packageDir,
      manifestPath: path.join(packageDir, 'manifest.json'),
      manifestFilename: 'manifest.json',
      manifest: null,
      validation: { ok: true, findings: [] },
      compatibility: { ok: true, findings: [] },
      state: {
        runtimeState: 'enabled',
        trust: 'review',
        installed: true,
        enabled: true,
        installedRevision: null,
        sourceLocator: packageDir,
      },
      loadEligible: true,
      selected: true,
      findings: [],
    };
  }

  private collectTargetsFromRuntime(): PluginOsRuntimeWatchTarget[] {
    const targets: PluginOsRuntimeWatchTarget[] = [];
    try {
      const loadSnapshot = this.runtime?.getLoadSnapshot?.();
      const loaded = loadSnapshot?.loaded || [];
      for (const entry of loaded) {
        const pluginId = String(entry.pluginId || '').trim();
        const packageDir = String(entry.packageDir || '').trim();
        if (pluginId && packageDir) {
          targets.push({ pluginId, packageDir });
        }
      }
    } catch {
      /* soft-fail */
    }

    if (targets.length > 0) {
      return targets;
    }

    try {
      if (this.discovery) {
        const snapshot = this.discovery.discover({ projectRoot: this.projectRoot });
        for (const plugin of snapshot.plugins) {
          if (!plugin.loadEligible && !plugin.state?.enabled) {
            continue;
          }
          if (plugin.pluginId && plugin.packageDir) {
            targets.push({
              pluginId: plugin.pluginId,
              packageDir: plugin.packageDir,
            });
          }
        }
      }
    } catch {
      /* soft-fail */
    }

    return targets;
  }
}
