/**
 * Zavorth Plugin SDK - Hot Reload Controller.
 * Monitors plugin source directories and triggers live hot-reloads in PluginSdkRegistry without agent restarts.
 * Strictly typed (Zero any) and EN-First.
 */

import { logger } from '../logger.js';
import { PluginHotReloadService, type PluginHotReloadWatchHandle } from '../services/PluginHotReloadService.js';
import { PluginSdkRegistry } from './registry.js';
import type { ZavorthPlugin } from './types.js';

export interface WatchPluginOptions {
  pluginId: string;
  pluginDir: string;
  pluginFactory?: () => Promise<ZavorthPlugin> | ZavorthPlugin;
  debounceMs?: number;
}

export class PluginHotReloadController {
  private readonly hotReloadService: PluginHotReloadService;
  private readonly registry: PluginSdkRegistry;
  private readonly activeWatches = new Map<string, PluginHotReloadWatchHandle>();

  constructor(
    hotReloadService: PluginHotReloadService = new PluginHotReloadService(),
    registry: PluginSdkRegistry = PluginSdkRegistry.getInstance(),
  ) {
    this.hotReloadService = hotReloadService;
    this.registry = registry;
  }

  /**
   * Starts a hot-reload watcher for a specific plugin directory.
   */
  public watchPlugin(options: WatchPluginOptions): PluginHotReloadWatchHandle {
    const { pluginId, pluginDir, pluginFactory, debounceMs } = options;

    if (this.activeWatches.has(pluginId)) {
      this.unwatchPlugin(pluginId);
    }

    logger.info(`[PluginHotReload] Starting hot-reload watcher for plugin "${pluginId}" at "${pluginDir}".`);

    const handle = this.hotReloadService.watch({
      pluginPath: pluginDir,
      root: pluginDir,
      debounceMs: debounceMs || 200,
      onChange: async (info) => {
        logger.info(`[PluginHotReload] Detected file modification in "${pluginId}": ${info.path}. Reloading...`);

        try {
          await this.registry.unload(pluginId);

          if (pluginFactory) {
            const reloadedPlugin = await pluginFactory();
            await this.registry.registerAndInitialize(reloadedPlugin);
            logger.info(`[PluginHotReload] Successfully hot-reloaded plugin "${pluginId}".`);
          }
        } catch (err: unknown) {
          logger.error(`[PluginHotReload] Failed to hot-reload plugin "${pluginId}": ${err instanceof Error ? err.message : String(err)}`);
        }
      },
    });

    this.activeWatches.set(pluginId, handle);
    return handle;
  }

  /**
   * Stops hot-reload watcher for a plugin.
   */
  public unwatchPlugin(pluginId: string): boolean {
    const handle = this.activeWatches.get(pluginId);
    if (!handle) return false;

    handle.stop();
    this.activeWatches.delete(pluginId);
    logger.info(`[PluginHotReload] Stopped watching plugin "${pluginId}".`);
    return true;
  }

  public listWatchedPlugins(): string[] {
    return Array.from(this.activeWatches.keys());
  }

  public stopAll(): void {
    for (const handle of this.activeWatches.values()) {
      handle.stop();
    }
    this.activeWatches.clear();
  }
}
