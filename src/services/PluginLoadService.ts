import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type {
  ZavorthPluginManifest,
  ZavorthPluginPermissionKind,
} from '../contracts/PluginManifestContract.js';
import {
  ZAVORTH_PLUGIN_RUNTIME_CONTRACT_VERSION,
  ZAVORTH_PLUGIN_RUNTIME_HOOK_EVENTS,
  type ZavorthDiscoveredPlugin,
  type ZavorthLoadedPlugin,
  type ZavorthPluginCapabilityHandler,
  type ZavorthPluginChannelAdapterBinding,
  type ZavorthPluginLoadResult,
  type ZavorthPluginLoadSnapshot,
  type ZavorthPluginLoadStatus,
  type ZavorthPluginMemoryBackendBinding,
  type ZavorthPluginProviderBinding,
  type ZavorthPluginRegistrationContext,
  type ZavorthPluginRuntimeHookEvent,
} from '../contracts/core/PluginRuntimeContract.js';
import type { PluginRuntimeHandler } from './PluginRegistryService.js';
import {
  createChannelCapabilityHandler,
  createMemoryCapabilityHandler,
  createProviderCapabilityHandler,
  normalizeChannelBinding,
  normalizeMemoryBinding,
  normalizeProviderBinding,
  normalizeToolBinding,
} from './PluginModuleKindAdapters.js';
import { createSpecializedRegistrars } from './PluginSpecializedRegistrars.js';
import { PluginSandboxPolicyService } from './PluginSandboxPolicyService.js';
import { withHumanizedPluginLoadFindings } from './PluginLoadErrorMessages.js';
import type { ZavorthPluginSpecializedBinding } from '../contracts/core/PluginRuntimeContract.js';
import { validatePluginEntrypointPath } from '../security/PluginEntrypointSecurity.js';
import type {
  LoadedPluginRuntimeRecord as LoadedRuntimeRecord,
  PluginHookBinding as HookBinding,
  PluginLoadAllOptions,
  PluginLoadLogger,
  PluginLoadOneOptions,
  PluginLoadRuntime,
} from './PluginLoadContracts.js';

export type {
  PluginLoadAllOptions,
  PluginLoadLogger,
  PluginLoadOneOptions,
  PluginLoadRuntime,
} from './PluginLoadContracts.js';

const HOOK_EVENT_SET = new Set<string>(ZAVORTH_PLUGIN_RUNTIME_HOOK_EVENTS);

const NOOP_LOGGER: PluginLoadLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

export class PluginLoadService {
  private readonly now: () => Date;
  private readonly workspacePath: string;
  private readonly pluginConfig: Record<string, unknown> | ((pluginId: string) => Record<string, unknown>);
  private readonly sandbox: Pick<PluginSandboxPolicyService, 'evaluate'>;
  private readonly importModule: (modulePath: string) => Promise<Record<string, unknown>>;
  private readonly resolveEntrypointPath: (packageDir: string, moduleRef: string) => string;
  private readonly existsSync: typeof fs.existsSync;
  private readonly registerTimeoutMs: number;
  private readonly concurrency: number;
  private readonly logger: PluginLoadLogger;
  private readonly records = new Map<string, LoadedRuntimeRecord>();

  constructor(runtime: PluginLoadRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.workspacePath = path.resolve(runtime.workspacePath || process.cwd());
    this.pluginConfig = runtime.pluginConfig || {};
    this.sandbox = runtime.sandbox || new PluginSandboxPolicyService({ now: this.now });
    this.existsSync = runtime.existsSync || fs.existsSync.bind(fs);
    this.importModule = runtime.importModule || (async (modulePath: string) => {
      const mod = await import(pathToFileURL(modulePath).href);
      return mod as Record<string, unknown>;
    });
    this.resolveEntrypointPath = runtime.resolveEntrypointPath
      || ((packageDir, moduleRef) => this.defaultResolveEntrypointPath(packageDir, moduleRef));
    this.registerTimeoutMs = Math.max(1, Number(runtime.registerTimeoutMs || 5000));
    this.concurrency = Math.max(1, Number(runtime.concurrency || 4));
    this.logger = runtime.logger || NOOP_LOGGER;
  }

  public async loadAll(
    plugins: ZavorthDiscoveredPlugin[],
    options: PluginLoadAllOptions = {},
  ): Promise<ZavorthPluginLoadSnapshot> {
    const list = Array.isArray(plugins) ? plugins : [];
    const results = await this.mapPool(
      list,
      this.concurrency,
      (plugin) => this.loadOne(plugin, {
        approvedPluginIds: options.approvedPluginIds,
        approved: options.approvedPluginIds?.has(this.normalizeId(plugin.pluginId)) === true
          || options.approvedPluginIds?.has(plugin.pluginId) === true,
      }),
    );

    const loaded = results
      .filter((result) => result.status === 'loaded')
      .map((result) => this.records.get(this.normalizeId(result.pluginId))?.loaded)
      .filter((entry): entry is ZavorthLoadedPlugin => Boolean(entry));

    const summary = {
      total: results.length,
      loaded: results.filter((result) => result.status === 'loaded').length,
      skipped: results.filter((result) => result.status === 'skipped').length,
      failed: results.filter((result) => result.status === 'failed').length,
      blocked: results.filter((result) => result.status === 'blocked').length,
      capabilities: loaded.reduce((total, entry) => total + entry.capabilities.length, 0),
      hooks: loaded.reduce((total, entry) => total + entry.hooks.length, 0),
    };

    return {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_PLUGIN_RUNTIME_CONTRACT_VERSION,
      results,
      loaded,
      summary,
    };
  }

  public async loadOne(
    plugin: ZavorthDiscoveredPlugin,
    options: PluginLoadOneOptions = {},
  ): Promise<ZavorthPluginLoadResult> {
    const started = Date.now();
    const pluginId = this.normalizeId(plugin.pluginId) || String(plugin.pluginId || '').trim();
    const base = {
      pluginId,
      packageDir: plugin.packageDir || '',
      sourceKind: plugin.sourceKind,
      entrypointModule: plugin.manifest?.entrypoint?.module || null,
      exportName: plugin.manifest?.entrypoint?.exportName || null,
      capabilities: [] as string[],
      hooks: [] as ZavorthPluginRuntimeHookEvent[],
    };

    try {
      if (!plugin.loadEligible || !plugin.selected) {
        return this.finish(base, started, 'skipped', plugin.manifest || null, [
          !plugin.selected ? 'plugin is not selected for this source priority' : 'plugin is not load eligible',
        ]);
      }

      if (!plugin.manifest) {
        return this.finish(base, started, 'failed', null, ['manifest is missing']);
      }

      const manifest = plugin.manifest;
      const approved = options.approved === true
        || plugin.state.trust === 'trusted'
        || options.approvedPluginIds?.has(pluginId) === true
        || options.approvedPluginIds?.has(plugin.pluginId) === true;

      const decision = this.sandbox.evaluate({
        manifest,
        action: 'enable',
        approved,
        trustOverride: plugin.state.trust,
      });

      if (decision.status === 'blocked') {
        return this.finish(base, started, 'blocked', manifest, [
          ...decision.reasons,
          ...decision.requiredApprovals,
        ]);
      }

      if (decision.status === 'needs_approval' && !approved) {
        return this.finish(base, started, 'blocked', manifest, [
          'sandbox requires approval before enable',
          ...decision.requiredApprovals,
        ]);
      }

      if (manifest.policy.sandboxProfile === 'metadata-only') {
        return this.finish(base, started, 'skipped', manifest, [
          'sandboxProfile metadata-only does not import entrypoint code',
        ]);
      }

      if (manifest.entrypoint.runtime === 'browser' || manifest.entrypoint.runtime === 'none') {
        return this.finish(base, started, 'skipped', manifest, [
          `entrypoint.runtime ${manifest.entrypoint.runtime} is not loadable in node runtime`,
        ]);
      }

      const moduleRef = String(manifest.entrypoint.module || '').trim();
      if (!moduleRef) {
        return this.finish(base, started, 'failed', manifest, ['entrypoint.module is empty']);
      }
      if (path.isAbsolute(moduleRef) || /^[a-z][a-z0-9+.-]*:/iu.test(moduleRef)) {
        return this.finish(base, started, 'blocked', manifest, [
          'entrypoint.module must be a relative path inside the plugin package',
        ]);
      }

      const entrypointPath = this.resolveEntrypointPath(plugin.packageDir, moduleRef);
      base.entrypointModule = entrypointPath;
      const pathPolicyError = validatePluginEntrypointPath(plugin.packageDir, entrypointPath);
      if (pathPolicyError) {
        return this.finish(base, started, 'blocked', manifest, [pathPolicyError]);
      }
      if (!this.existsSync(entrypointPath)) {
        return this.finish(base, started, 'failed', manifest, [
          `entrypoint module not found: ${entrypointPath}`,
        ]);
      }

      const imported = await this.withTimeout(
        this.importModule(entrypointPath),
        this.registerTimeoutMs,
        `import timed out after ${this.registerTimeoutMs}ms`,
      );

      const exportCandidates = this.unique([
        manifest.entrypoint.exportName,
        'createZavorthModule',
        'register',
        'default',
      ].filter((value): value is string => Boolean(value && String(value).trim())));

      let exportName: string | null = null;
      let exportValue: unknown = undefined;
      for (const candidate of exportCandidates) {
        if (candidate in imported && imported[candidate] !== undefined) {
          exportName = candidate;
          exportValue = imported[candidate];
          break;
        }
      }

      if (exportValue === undefined && exportCandidates.length > 0) {
        return this.finish(base, started, 'failed', manifest, [
          `entrypoint export not found (tried: ${exportCandidates.join(', ')})`,
        ]);
      }

      base.exportName = exportName;

      const capabilityHandlers = new Map<string, ZavorthPluginCapabilityHandler>();
      const hookBindings: HookBinding[] = [];
      const channelBindings: ZavorthPluginChannelAdapterBinding[] = [];
      const memoryBindings: ZavorthPluginMemoryBackendBinding[] = [];
      const providerBindings: ZavorthPluginProviderBinding[] = [];
      const findings: string[] = [];
      let moduleHandler: ZavorthPluginCapabilityHandler | null = null;

      const declaredCapabilities = new Set(
        (manifest.capabilities || []).map((capability) => String(capability.id || '').trim()).filter(Boolean),
      );
      const declaredPermissions = new Set(
        (manifest.permissions || []).map((permission) => permission.kind),
      );

      const ctx = this.createRegistrationContext({
        pluginId,
        manifest,
        declaredCapabilities,
        declaredPermissions,
        capabilityHandlers,
        hookBindings,
        channelBindings,
        memoryBindings,
        providerBindings,
        findings,
        approved,
        trust: plugin.state.trust,
      });

      await this.withTimeout(
        this.activateExport({
          exportValue,
          exportName,
          ctx,
          findings,
          setModuleHandler: (handler) => {
            moduleHandler = handler;
          },
          hasHandlers: () => capabilityHandlers.size > 0 || moduleHandler !== null,
        }),
        this.registerTimeoutMs,
        `plugin registration timed out after ${this.registerTimeoutMs}ms`,
      );

      if (declaredCapabilities.size === 0) {
        return this.finish(base, started, 'failed', manifest, [
          ...findings,
          'manifest declares no capabilities',
        ]);
      }

      if (capabilityHandlers.size === 0 && !moduleHandler) {
        return this.finish(base, started, 'failed', manifest, [
          ...findings,
          'no capability handlers registered',
        ]);
      }

      const missing = Array.from(declaredCapabilities).filter((capabilityId) => {
        return !capabilityHandlers.has(capabilityId) && !moduleHandler;
      });
      if (missing.length > 0) {
        findings.push(`missing handlers for capabilities: ${missing.join(', ')}`);
        return this.finish(base, started, 'failed', manifest, findings);
      }

      const boundCapabilities = moduleHandler
        ? Array.from(declaredCapabilities)
        : Array.from(capabilityHandlers.keys()).sort((left, right) => left.localeCompare(right));
      const boundHooks = this.unique(hookBindings.map((binding) => binding.event)) as ZavorthPluginRuntimeHookEvent[];

      const loaded: ZavorthLoadedPlugin = {
        pluginId,
        manifest,
        packageDir: plugin.packageDir,
        sourceKind: plugin.sourceKind,
        capabilities: boundCapabilities,
        hooks: boundHooks,
      };

      this.records.set(pluginId, {
        loaded,
        capabilityHandlers,
        moduleHandler,
        hooks: hookBindings,
        channels: channelBindings,
        memoryBackends: memoryBindings,
        providers: providerBindings,
      });

      this.logger.info(`[plugin-load] loaded ${pluginId}`, {
        capabilities: boundCapabilities.length,
        hooks: boundHooks.length,
      });

      return this.finish(base, started, 'loaded', manifest, findings, {
        capabilities: boundCapabilities,
        hooks: boundHooks,
        entrypointModule: entrypointPath,
        exportName,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[plugin-load] failed ${pluginId}: ${message}`);
      return this.finish(base, started, 'failed', plugin.manifest || null, [message]);
    }
  }

  public getLoadedPlugins(): ZavorthLoadedPlugin[] {
    return Array.from(this.records.values())
      .map((record) => record.loaded)
      .sort((left, right) => left.pluginId.localeCompare(right.pluginId));
  }

  public getCapabilityHandler(
    pluginId: string,
    capabilityId: string,
  ): ZavorthPluginCapabilityHandler | null {
    const record = this.records.get(this.normalizeId(pluginId));
    if (!record) {
      return null;
    }
    return record.capabilityHandlers.get(String(capabilityId || '').trim())
      || record.moduleHandler
      || null;
  }

  public getModuleHandler(pluginId: string): ZavorthPluginCapabilityHandler | null {
    return this.records.get(this.normalizeId(pluginId))?.moduleHandler || null;
  }

  public getHookBindings(pluginId: string): HookBinding[] {
    const record = this.records.get(this.normalizeId(pluginId));
    return record ? record.hooks.slice() : [];
  }

  public getChannelBindings(pluginId: string): ZavorthPluginChannelAdapterBinding[] {
    const record = this.records.get(this.normalizeId(pluginId));
    return record ? record.channels.slice() : [];
  }

  public getMemoryBindings(pluginId: string): ZavorthPluginMemoryBackendBinding[] {
    const record = this.records.get(this.normalizeId(pluginId));
    return record ? record.memoryBackends.slice() : [];
  }

  public getProviderBindings(pluginId: string): ZavorthPluginProviderBinding[] {
    const record = this.records.get(this.normalizeId(pluginId));
    return record ? record.providers.slice() : [];
  }

  public createRegistryHandler(pluginId: string): PluginRuntimeHandler | null {
    const id = this.normalizeId(pluginId);
    const record = this.records.get(id);
    if (!record) {
      return null;
    }
    if (record.capabilityHandlers.size === 0 && !record.moduleHandler) {
      return null;
    }

    return async (request) => {
      const capabilityId = String(request.capabilityId || '').trim();
      const handler = record.capabilityHandlers.get(capabilityId) || record.moduleHandler;
      if (!handler) {
        throw new Error(`No handler for capability ${capabilityId} on plugin ${id}`);
      }
      const result = await handler({
        pluginId: id,
        capabilityId,
        input: (request.input && typeof request.input === 'object')
          ? request.input as Record<string, unknown>
          : {},
        requestedBy: request.requestedBy ?? null,
      });
      if (result && typeof result === 'object' && 'output' in result) {
        return (result as { output: unknown }).output;
      }
      return result;
    };
  }

  public dispose(pluginId?: string): void {
    if (pluginId) {
      this.records.delete(this.normalizeId(pluginId));
      return;
    }
    this.records.clear();
  }

  private createRegistrationContext(input: {
    pluginId: string;
    manifest: ZavorthPluginManifest;
    declaredCapabilities: Set<string>;
    declaredPermissions: Set<ZavorthPluginPermissionKind>;
    capabilityHandlers: Map<string, ZavorthPluginCapabilityHandler>;
    hookBindings: HookBinding[];
    channelBindings: ZavorthPluginChannelAdapterBinding[];
    memoryBindings: ZavorthPluginMemoryBackendBinding[];
    providerBindings: ZavorthPluginProviderBinding[];
    findings: string[];
    approved: boolean;
    trust: string;
  }): ZavorthPluginRegistrationContext {
    const {
      pluginId,
      manifest,
      declaredCapabilities,
      declaredPermissions,
      capabilityHandlers,
      hookBindings,
      channelBindings,
      memoryBindings,
      providerBindings,
      findings,
      approved,
      trust,
    } = input;

    const specializedBindings: ZavorthPluginSpecializedBinding[] = [];

    const bindCapability = (capabilityId: string, handler: ZavorthPluginCapabilityHandler) => {
      const id = String(capabilityId || '').trim();
      if (!id) {
        findings.push('bindCapability called with empty capability id');
        return;
      }
      if (!declaredCapabilities.has(id)) {
        findings.push(`bindCapability rejected undeclared capability: ${id}`);
        return;
      }
      if (typeof handler !== 'function') {
        findings.push(`bindCapability requires a function for ${id}`);
        return;
      }
      capabilityHandlers.set(id, handler);
    };

    const bindChannel = (adapter: ZavorthPluginChannelAdapterBinding) => {
      const result = normalizeChannelBinding(manifest, adapter);
      if (!result.ok) {
        findings.push(result.finding);
        return;
      }
      channelBindings.push(result.value);
      if (!capabilityHandlers.has(result.value.capabilityId)) {
        capabilityHandlers.set(
          result.value.capabilityId,
          createChannelCapabilityHandler(result.value),
        );
      }
    };

    const registerHook = (
      event: ZavorthPluginRuntimeHookEvent,
      callback: (payload: {
        event: ZavorthPluginRuntimeHookEvent;
        context: Record<string, unknown>;
      }) => void | Promise<void>,
    ) => {
      const normalized = String(event || '').trim() as ZavorthPluginRuntimeHookEvent;
      if (!HOOK_EVENT_SET.has(normalized)) {
        findings.push(`registerHook rejected unknown event: ${event}`);
        return;
      }
      if (typeof callback !== 'function') {
        findings.push(`registerHook requires a callback for ${normalized}`);
        return;
      }
      hookBindings.push({ event: normalized, callback });
    };

    const specialized = createSpecializedRegistrars({
      bindCapability,
      bindChannel,
      registerHook,
      findings,
      specializedBindings,
    });

    return {
      bindCapability,
      bindChannel,
      bindMemoryBackend: (backend) => {
        const result = normalizeMemoryBinding(manifest, backend);
        if (!result.ok) {
          findings.push(result.finding);
          return;
        }
        memoryBindings.push(result.value);
        if (!capabilityHandlers.has(result.value.capabilityId)) {
          capabilityHandlers.set(
            result.value.capabilityId,
            createMemoryCapabilityHandler(result.value),
          );
        }
      },
      bindProvider: (provider) => {
        const result = normalizeProviderBinding(manifest, provider);
        if (!result.ok) {
          findings.push(result.finding);
          return;
        }
        providerBindings.push(result.value);
        if (!capabilityHandlers.has(result.value.capabilityId)) {
          capabilityHandlers.set(
            result.value.capabilityId,
            createProviderCapabilityHandler(result.value),
          );
        }
      },
      bindTool: (tool) => {
        const result = normalizeToolBinding(manifest, tool);
        if (!result.ok) {
          findings.push(result.finding);
          return;
        }
        capabilityHandlers.set(result.value.capabilityId, result.value.handler);
      },
      registerHook,
      ...specialized,
      getConfig: () => {
        if (typeof this.pluginConfig === 'function') {
          return this.pluginConfig(pluginId) || {};
        }
        const scoped = this.pluginConfig[pluginId];
        if (scoped && typeof scoped === 'object' && !Array.isArray(scoped)) {
          return scoped as Record<string, unknown>;
        }
        return { ...this.pluginConfig };
      },
      getLogger: () => ({
        debug: (message, meta) => this.logger.debug(`[${pluginId}] ${message}`, meta),
        info: (message, meta) => this.logger.info(`[${pluginId}] ${message}`, meta),
        warn: (message, meta) => this.logger.warn(`[${pluginId}] ${message}`, meta),
        error: (message, meta) => this.logger.error(`[${pluginId}] ${message}`, meta),
      }),
      getWorkspacePath: () => this.workspacePath,
      requestPermission: async (kind) => {
        if (!declaredPermissions.has(kind)) {
          findings.push(`requestPermission denied undeclared kind: ${kind}`);
          return false;
        }
        if (trust === 'trusted' || approved) {
          return true;
        }
        return false;
      },
      emit: () => {},
    };
  }

  private async activateExport(input: {
    exportValue: unknown;
    exportName: string | null;
    ctx: ZavorthPluginRegistrationContext;
    findings: string[];
    setModuleHandler: (handler: ZavorthPluginCapabilityHandler) => void;
    hasHandlers: () => boolean;
  }): Promise<void> {
    const { exportValue, exportName, ctx, findings, setModuleHandler, hasHandlers } = input;

    if (this.isModuleDefinition(exportValue)) {
      setModuleHandler(exportValue.handler as ZavorthPluginCapabilityHandler);
      return;
    }

    if (typeof exportValue !== 'function') {
      findings.push('entrypoint export is not a function or module definition');
      return;
    }

    const fn = exportValue as (...args: unknown[]) => unknown;
    const isRegister = fn.name === 'register' || exportName === 'register';

    if (isRegister) {
      await fn(ctx);
      return;
    }

    if (exportName === 'createZavorthModule' || fn.name === 'createZavorthModule' || fn.length === 0) {
      const result = await fn();
      if (this.isModuleDefinition(result)) {
        setModuleHandler(result.handler as ZavorthPluginCapabilityHandler);
        return;
      }
      if (typeof result === 'function') {
        setModuleHandler(result as ZavorthPluginCapabilityHandler);
        return;
      }
      if (result === undefined || result === null) {
        if (!hasHandlers()) {
          await fn(ctx);
        }
        return;
      }
    }

    const result = await fn(ctx);
    if (this.isModuleDefinition(result)) {
      setModuleHandler(result.handler as ZavorthPluginCapabilityHandler);
      return;
    }
    if (typeof result === 'function') {
      setModuleHandler(result as ZavorthPluginCapabilityHandler);
      return;
    }

    if (!hasHandlers()) {
      setModuleHandler(fn as ZavorthPluginCapabilityHandler);
    }
  }

  private isModuleDefinition(value: unknown): value is { handler: unknown; manifest?: unknown } {
    return Boolean(
      value
      && typeof value === 'object'
      && !Array.isArray(value)
      && typeof (value as { handler?: unknown }).handler === 'function',
    );
  }

  private defaultResolveEntrypointPath(packageDir: string, moduleRef: string): string {
    const resolved = path.resolve(packageDir, moduleRef);
    if (this.existsSync(resolved)) {
      return resolved;
    }

    const extensions = ['.js', '.mjs', '.cjs', '.ts'];
    const hasExtension = /\.(js|mjs|cjs|ts)$/i.test(resolved);
    const stem = hasExtension ? resolved.replace(/\.(js|mjs|cjs|ts)$/i, '') : resolved;

    for (const extension of extensions) {
      const candidate = `${stem}${extension}`;
      if (this.existsSync(candidate)) {
        return candidate;
      }
    }

    if (!hasExtension) {
      for (const extension of extensions) {
        const candidate = `${resolved}${extension}`;
        if (this.existsSync(candidate)) {
          return candidate;
        }
      }
    }

    return resolved;
  }

  private finish(
    base: {
      pluginId: string;
      packageDir: string;
      sourceKind: ZavorthDiscoveredPlugin['sourceKind'];
      entrypointModule: string | null;
      exportName: string | null;
      capabilities: string[];
      hooks: ZavorthPluginRuntimeHookEvent[];
    },
    started: number,
    status: ZavorthPluginLoadStatus,
    manifest: ZavorthPluginLoadResult['manifest'],
    findings: string[],
    extras: Partial<Pick<ZavorthPluginLoadResult, 'capabilities' | 'hooks' | 'entrypointModule' | 'exportName'>> = {},
  ): ZavorthPluginLoadResult {
    const uniqueFindings = this.unique(findings);
    const enriched = (status === 'failed' || status === 'blocked')
      ? withHumanizedPluginLoadFindings(uniqueFindings, {
        pluginId: base.pluginId,
        packageDir: base.packageDir,
        status,
        locale: process.env.ZAVORTH_LOCALE || process.env.LANG || process.env.LC_ALL || null,
      })
      : uniqueFindings;

    return {
      pluginId: base.pluginId,
      status,
      packageDir: base.packageDir,
      sourceKind: base.sourceKind,
      manifest,
      entrypointModule: extras.entrypointModule ?? base.entrypointModule,
      exportName: extras.exportName ?? base.exportName,
      capabilities: extras.capabilities || base.capabilities,
      hooks: extras.hooks || base.hooks,
      findings: enriched,
      durationMs: Math.max(0, Date.now() - started),
    };
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error(message)), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private async mapPool<T, R>(
    items: T[],
    concurrency: number,
    worker: (item: T) => Promise<R>,
  ): Promise<R[]> {
    if (items.length === 0) {
      return [];
    }
    const results: R[] = new Array(items.length);
    let cursor = 0;
    const runWorker = async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index]);
      }
    };
    const size = Math.min(concurrency, items.length);
    await Promise.all(Array.from({ length: size }, () => runWorker()));
    return results;
  }

  private normalizeId(value: string | null | undefined): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.:/-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private unique(values: string[]): string[] {
    return Array.from(new Set(values.filter(Boolean)));
  }
}
