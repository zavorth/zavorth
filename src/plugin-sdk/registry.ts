/**
 * Zavorth Plugin SDK - Central Plugin Registry.
 * Manages plugin lifecycles, active tools, event emitters, and security scopes.
 */

import { logger } from '../logger.js';
import type { BaseTool } from '../tools/BaseTool.js';
import type { ZavorthPlugin, PluginContext, PluginLifecycleHooks, PluginStorage, PluginLogger, PluginEventBus } from './types.js';
import { PluginSandbox } from './sandbox.js';

export interface InstalledPluginRecord {
  id: string;
  plugin: ZavorthPlugin;
  sandbox: PluginSandbox;
  context: PluginContext;
  registeredTools: Map<string, BaseTool>;
  hooks: PluginLifecycleHooks[];
  status: 'active' | 'disabled' | 'error';
  loadedAt: string;
  error?: string;
}

export class PluginSdkRegistry {
  private static instance: PluginSdkRegistry | null = null;
  private readonly installed = new Map<string, InstalledPluginRecord>();
  private readonly eventListeners = new Map<string, Set<(payload: unknown) => void | Promise<void>>>();

  public static getInstance(): PluginSdkRegistry {
    if (!this.instance) {
      this.instance = new PluginSdkRegistry();
    }
    return this.instance;
  }

  public async registerAndInitialize(plugin: ZavorthPlugin, config: Record<string, unknown> = {}): Promise<InstalledPluginRecord> {
    const pluginId = plugin.id;

    if (this.installed.has(pluginId)) {
      await this.unload(pluginId);
    }

    const sandbox = new PluginSandbox(pluginId, plugin.manifest);
    const registeredTools = new Map<string, BaseTool>();
    const hooks: PluginLifecycleHooks[] = [];

    const scopedLogger: PluginLogger = {
      debug: (msg, ...args) => logger.debug(`[Plugin:${pluginId}] ${msg}`, ...args),
      info: (msg, ...args) => logger.info(`[Plugin:${pluginId}] ${msg}`, ...args),
      warn: (msg, ...args) => logger.warn(`[Plugin:${pluginId}] ${msg}`, ...args),
      error: (msg, ...args) => logger.error(`[Plugin:${pluginId}] ${msg}`, ...args),
    };

    const inMemoryStorage = new Map<string, unknown>();
    const scopedStorage: PluginStorage = {
      get: async <T>(key: string) => (inMemoryStorage.get(key) as T) ?? null,
      set: async <T>(key: string, val: T) => { inMemoryStorage.set(key, val); },
      delete: async (key: string) => inMemoryStorage.delete(key),
      clear: async () => { inMemoryStorage.clear(); },
      listKeys: async () => Array.from(inMemoryStorage.keys()),
    };

    const scopedEventBus: PluginEventBus = {
      on: (event: string, handler: (payload: unknown) => void | Promise<void>) => {
        if (!this.eventListeners.has(event)) {
          this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event)!.add(handler);
        return () => {
          this.eventListeners.get(event)?.delete(handler);
        };
      },
      emit: (event: string, payload: unknown) => {
        const handlers = this.eventListeners.get(event);
        if (handlers) {
          for (const handler of handlers) {
            try {
              void handler(payload);
            } catch (err: unknown) {
              logger.warn(`[PluginRegistry] Event handler error for "${event}": ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
      },
    };

    const context: PluginContext = {
      pluginId,
      manifest: plugin.manifest,
      logger: scopedLogger,
      storage: scopedStorage,
      events: scopedEventBus,
      config,
      registerTool: (tool: BaseTool) => {
        registeredTools.set(tool.name, tool);
        scopedLogger.info(`Registered dynamic tool: "${tool.name}"`);
      },
      unregisterTool: (toolName: string) => registeredTools.delete(toolName),
      registerHook: (hook: PluginLifecycleHooks) => {
        hooks.push(hook);
      },
      hasPermission: (perm) => sandbox.hasPermission(perm),
      fetch: (url, init) => sandbox.fetch(url, init),
    };

    const record: InstalledPluginRecord = {
      id: pluginId,
      plugin,
      sandbox,
      context,
      registeredTools,
      hooks,
      status: 'active',
      loadedAt: new Date().toISOString(),
    };

    try {
      await plugin.initialize(context);
      this.installed.set(pluginId, record);
      logger.info(`[PluginRegistry] Successfully loaded and initialized plugin "${pluginId}" v${plugin.manifest.version}.`);
      return record;
    } catch (err: unknown) {
      record.status = 'error';
      record.error = err instanceof Error ? err.message : String(err);
      this.installed.set(pluginId, record);
      logger.error(`[PluginRegistry] Failed to initialize plugin "${pluginId}": ${record.error}`);
      return record;
    }
  }

  public async unload(pluginId: string): Promise<boolean> {
    const record = this.installed.get(pluginId);
    if (!record) return false;

    try {
      if (typeof record.plugin.shutdown === 'function') {
        await record.plugin.shutdown();
      }
    } catch (err: unknown) {
      logger.warn(`[PluginRegistry] Error during plugin "${pluginId}" shutdown: ${err instanceof Error ? err.message : String(err)}`);
    }

    this.installed.delete(pluginId);
    logger.info(`[PluginRegistry] Unloaded plugin "${pluginId}".`);
    return true;
  }

  public getPlugin(pluginId: string): InstalledPluginRecord | undefined {
    return this.installed.get(pluginId);
  }

  public listPlugins(): InstalledPluginRecord[] {
    return Array.from(this.installed.values());
  }

  public getAllTools(): BaseTool[] {
    const tools: BaseTool[] = [];
    for (const record of this.installed.values()) {
      if (record.status === 'active') {
        for (const tool of record.registeredTools.values()) {
          tools.push(tool);
        }
      }
    }
    return tools;
  }

  public clear(): void {
    this.installed.clear();
    this.eventListeners.clear();
  }
}
