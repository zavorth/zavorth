import type {
  ZavorthDiscoveredPlugin,
  ZavorthLoadedPlugin,
  ZavorthPluginChannelAdapterBinding,
  ZavorthPluginDiscoverySnapshot,
  ZavorthPluginLoadSnapshot,
  ZavorthPluginMemoryBackendBinding,
  ZavorthPluginProviderBinding,
  ZavorthPluginRuntimeBootstrapSnapshot,
  ZavorthPluginWirePlan,
} from '../contracts/core/PluginRuntimeContract.js';
import { ZAVORTH_PLUGIN_RUNTIME_CONTRACT_VERSION } from '../contracts/core/PluginRuntimeContract.js';
import { PluginCapabilityTool } from '../tools/PluginCapabilityTool.js';
import type { ToolRegistry } from '../tools/ToolRegistry.js';
import {
  PluginDiscoveryService,
  type PluginDiscoveryInput,
  type PluginDiscoveryRuntime,
  type PluginDiscoveryStateLookup,
} from './PluginDiscoveryService.js';
import { PluginLoadService, type PluginLoadRuntime } from './PluginLoadService.js';
import type { PluginRegistryService } from './PluginRegistryService.js';
import { PluginStateBridgeService } from './PluginStateBridgeService.js';
import type { ToolHookPipelineService } from './ToolHookPipelineService.js';

export type PluginRuntimeWireTargets = {
  pluginRegistry?: Pick<PluginRegistryService, 'registerManifest' | 'registerHandler' | 'getEntry'> & {
    install?: PluginRegistryService['install'];
    enable?: PluginRegistryService['enable'];
  };
  toolRegistry?: Pick<ToolRegistry, 'register'> | {
    register(tool: {
      name: string;
      description: string;
      parameters: unknown;
      execute(args: Record<string, unknown>): Promise<string>;
      getDefinition?(): unknown;
    }): void;
  };
  hookPipeline?: Pick<ToolHookPipelineService, 'registerListener'>;
  channelAdapters?: {
    register(adapter: ZavorthPluginChannelAdapterBinding & { pluginId: string }): void;
  };
  memoryBackends?: {
    register(backend: ZavorthPluginMemoryBackendBinding & { pluginId: string }): void;
  };
  providers?: {
    register(provider: ZavorthPluginProviderBinding & { pluginId: string }): void;
  };
};

export type PluginRuntimeServiceRuntime = {
  now?: () => Date;
  discovery?: PluginDiscoveryService;
  loader?: PluginLoadService;
  pluginRegistry?: PluginRegistryService;
  projectRoot?: string;
  workspaceRoot?: string | null;
  userHome?: string | null;
  stateLookup?: PluginDiscoveryStateLookup;
  stateBridge?: PluginStateBridgeService;
  wireTargets?: PluginRuntimeWireTargets;
  loadRuntime?: PluginLoadRuntime;
  discoveryRuntime?: PluginDiscoveryRuntime;
};

export class PluginRuntimeService {
  private readonly now: () => Date;
  private readonly discovery: PluginDiscoveryService;
  private readonly loader: PluginLoadService;
  private readonly stateBridge: PluginStateBridgeService | null;
  private readonly defaultWireTargets: PluginRuntimeWireTargets;
  private discoverySnapshot: ZavorthPluginDiscoverySnapshot | null = null;
  private loadSnapshot: ZavorthPluginLoadSnapshot | null = null;
  private bootstrapSnapshot: ZavorthPluginRuntimeBootstrapSnapshot | null = null;
  private readonly hookUnsubscribers: Array<() => void> = [];
  private readonly hookUnsubscribersByPlugin = new Map<string, Array<() => void>>();
  private readonly registeredToolNames = new Set<string>();
  private lastWireTargets: PluginRuntimeWireTargets = {};

  constructor(runtime: PluginRuntimeServiceRuntime = {}) {
    this.now = runtime.now || (() => new Date());
    this.stateBridge = runtime.stateBridge
      || (runtime.projectRoot
        ? new PluginStateBridgeService({ now: this.now, projectRoot: runtime.projectRoot })
        : null);
    const stateLookup = runtime.stateLookup
      || this.stateBridge?.asStateLookup()
      || undefined;
    this.discovery = runtime.discovery || new PluginDiscoveryService({
      now: this.now,
      projectRoot: runtime.projectRoot,
      workspaceRoot: runtime.workspaceRoot,
      userHome: runtime.userHome,
      stateLookup,
      registry: runtime.pluginRegistry,
      ...(runtime.discoveryRuntime || {}),
    });
    this.loader = runtime.loader || new PluginLoadService({
      now: this.now,
      workspacePath: runtime.workspaceRoot || runtime.projectRoot || process.cwd(),
      ...(runtime.loadRuntime || {}),
    });
    this.defaultWireTargets = runtime.wireTargets || {};
  }

  public getStateBridge(): PluginStateBridgeService | null {
    return this.stateBridge;
  }

  public discover(input: PluginDiscoveryInput = {}): ZavorthPluginDiscoverySnapshot {
    const snapshot = this.discovery.discover(input);
    this.discoverySnapshot = snapshot;
    return snapshot;
  }

  public async load(
    discovery?: ZavorthPluginDiscoverySnapshot,
    options: { approvedPluginIds?: Set<string> | string[] } = {},
  ): Promise<ZavorthPluginLoadSnapshot> {
    const view = discovery || this.discoverySnapshot || this.discover();
    const approvedPluginIds = this.toApprovedSet(options.approvedPluginIds);
    const snapshot = await this.loader.loadAll(view.plugins, { approvedPluginIds });
    this.loadSnapshot = snapshot;
    return snapshot;
  }

  public wire(
    loaded?: ZavorthLoadedPlugin[],
    targets?: PluginRuntimeWireTargets,
  ): {
    plans: ZavorthPluginWirePlan[];
    toolsRegistered: number;
    hooksRegistered: number;
    handlersRegistered: number;
    registryEntries: number;
    channelsRegistered: number;
    memoryBackendsRegistered: number;
    providersRegistered: number;
  } {
    const plugins = loaded || this.loader.getLoadedPlugins();
    const wireTargets = {
      ...this.defaultWireTargets,
      ...(targets || {}),
    };
    this.lastWireTargets = wireTargets;

    const plans: ZavorthPluginWirePlan[] = [];
    let toolsRegistered = 0;
    let hooksRegistered = 0;
    let handlersRegistered = 0;
    let registryEntries = 0;
    let channelsRegistered = 0;
    let memoryBackendsRegistered = 0;
    let providersRegistered = 0;

    for (const plugin of plugins) {
      const plan: ZavorthPluginWirePlan = {
        pluginId: plugin.pluginId,
        capabilityIds: [...plugin.capabilities],
        hookEvents: [...plugin.hooks],
        toolNames: [],
        channelIds: [],
        memoryBackendIds: [],
        providerIds: [],
      };
      const pluginHookUnsubs: Array<() => void> = [];

      const registry = wireTargets.pluginRegistry;
      if (registry) {
        try {
          registry.registerManifest(plugin.manifest);
          registryEntries += 1;

          try {
            registry.install?.(plugin.pluginId, { approved: true });
          } catch {
            /* lifecycle may already be applied */
          }
          try {
            registry.enable?.(plugin.pluginId, { approved: true });
          } catch {
            /* lifecycle may already be applied */
          }

          const handler = this.loader.createRegistryHandler(plugin.pluginId);
          if (handler) {
            registry.registerHandler(plugin.pluginId, handler);
            handlersRegistered += 1;
          }
        } catch {
          /* keep remaining plugins wiring */
        }
      }

      if (wireTargets.toolRegistry) {
        for (const capabilityId of plugin.capabilities) {
          const capability = plugin.manifest.capabilities.find((item) => item.id === capabilityId);
          const toolName = this.resolveToolName(plugin.pluginId, capabilityId, capability?.command?.name);
          const description = capability?.summary || capability?.label || capabilityId;
          const handler = this.loader.getCapabilityHandler(plugin.pluginId, capabilityId);
          if (!handler) {
            continue;
          }

          const tool = new PluginCapabilityTool({
            name: toolName,
            description,
            execute: async (args) => {
              const input = (args && typeof args === 'object' && args.input && typeof args.input === 'object')
                ? args.input as Record<string, unknown>
                : (args || {});
              const result = await handler({
                pluginId: plugin.pluginId,
                capabilityId,
                input,
                requestedBy: null,
              });
              if (result && typeof result === 'object' && 'output' in result) {
                return (result as { output: unknown }).output;
              }
              return result;
            },
          });

          try {
            const securityDefinition = buildPluginCapabilitySecurityDefinition(toolName, description, capabilityId);
            const registry = wireTargets.toolRegistry as {
              register(tool: unknown, securityDefinition?: unknown): void;
            };
            registry.register(tool, securityDefinition);
            plan.toolNames.push(toolName);
            this.registeredToolNames.add(toolName);
            toolsRegistered += 1;
          } catch {
            /* keep remaining tools */
          }
        }
      }

      if (wireTargets.hookPipeline) {
        const bindings = this.loader.getHookBindings(plugin.pluginId);
        for (const binding of bindings) {
          try {
            const unsubscribe = wireTargets.hookPipeline.registerListener(
              binding.event,
              async ({ context }) => {
                await binding.callback({
                  event: binding.event,
                  context: context || {},
                });
              },
            );
            this.hookUnsubscribers.push(unsubscribe);
            pluginHookUnsubs.push(unsubscribe);
            hooksRegistered += 1;
          } catch {
            /* keep remaining hooks */
          }
        }
      }

      if (pluginHookUnsubs.length > 0) {
        this.hookUnsubscribersByPlugin.set(plugin.pluginId, pluginHookUnsubs);
      }

      if (wireTargets.channelAdapters) {
        for (const adapter of this.loader.getChannelBindings(plugin.pluginId)) {
          try {
            wireTargets.channelAdapters.register({ ...adapter, pluginId: plugin.pluginId });
            plan.channelIds.push(adapter.id);
            channelsRegistered += 1;
          } catch {
            /* keep remaining adapters */
          }
        }
      }

      if (wireTargets.memoryBackends) {
        for (const backend of this.loader.getMemoryBindings(plugin.pluginId)) {
          try {
            wireTargets.memoryBackends.register({ ...backend, pluginId: plugin.pluginId });
            plan.memoryBackendIds.push(backend.id);
            memoryBackendsRegistered += 1;
          } catch {
            /* keep remaining backends */
          }
        }
      }

      if (wireTargets.providers) {
        for (const provider of this.loader.getProviderBindings(plugin.pluginId)) {
          try {
            wireTargets.providers.register({ ...provider, pluginId: plugin.pluginId });
            plan.providerIds.push(provider.id);
            providersRegistered += 1;
          } catch {
            /* keep remaining providers */
          }
        }
      }

      plans.push(plan);
    }

    return {
      plans,
      toolsRegistered,
      hooksRegistered,
      handlersRegistered,
      registryEntries,
      channelsRegistered,
      memoryBackendsRegistered,
      providersRegistered,
    };
  }

  public async bootstrap(input: {
    projectRoot?: string;
    workspaceRoot?: string | null;
    targets?: PluginRuntimeWireTargets;
    approvedPluginIds?: string[];
  } = {}): Promise<ZavorthPluginRuntimeBootstrapSnapshot> {
    const discovery = this.discover({
      projectRoot: input.projectRoot,
      workspaceRoot: input.workspaceRoot,
    });
    const load = await this.load(discovery, {
      approvedPluginIds: input.approvedPluginIds,
    });
    const wire = this.wire(load.loaded, input.targets || this.defaultWireTargets);

    const snapshot: ZavorthPluginRuntimeBootstrapSnapshot = {
      generatedAt: this.now().toISOString(),
      contractVersion: ZAVORTH_PLUGIN_RUNTIME_CONTRACT_VERSION,
      discovery,
      load,
      wire: {
        registryEntries: wire.registryEntries,
        handlersRegistered: wire.handlersRegistered,
        toolsRegistered: wire.toolsRegistered,
        hooksRegistered: wire.hooksRegistered,
        channelsRegistered: wire.channelsRegistered,
        memoryBackendsRegistered: wire.memoryBackendsRegistered,
        providersRegistered: wire.providersRegistered,
        plans: wire.plans,
      },
      summary: {
        discovered: discovery.summary.total,
        loadEligible: discovery.summary.loadEligible,
        loaded: load.summary.loaded,
        wired: wire.plans.length,
        failed: load.summary.failed + load.summary.blocked,
      },
    };

    this.bootstrapSnapshot = snapshot;
    return snapshot;
  }

  public getDiscoverySnapshot(): ZavorthPluginDiscoverySnapshot | null {
    return this.discoverySnapshot;
  }

  public getLoadSnapshot(): ZavorthPluginLoadSnapshot | null {
    return this.loadSnapshot;
  }

  public getBootstrapSnapshot(): ZavorthPluginRuntimeBootstrapSnapshot | null {
    return this.bootstrapSnapshot;
  }

  public formatSnapshotText(
    snapshot?: ZavorthPluginRuntimeBootstrapSnapshot | ZavorthPluginLoadSnapshot | ZavorthPluginDiscoverySnapshot | null,
  ): string {
    if (snapshot && 'wire' in snapshot && 'load' in snapshot) {
      const view = snapshot as ZavorthPluginRuntimeBootstrapSnapshot;
      const lines = [
        'Zavorth Plugin Runtime',
        `Contract: ${view.contractVersion}`,
        `Generated: ${view.generatedAt}`,
        `Discovered: ${view.summary.discovered}`,
        `Load eligible: ${view.summary.loadEligible}`,
        `Loaded: ${view.summary.loaded}`,
        `Wired: ${view.summary.wired}`,
        `Failed: ${view.summary.failed}`,
        `Registry entries: ${view.wire.registryEntries}`,
        `Handlers: ${view.wire.handlersRegistered}`,
        `Tools: ${view.wire.toolsRegistered}`,
        `Hooks: ${view.wire.hooksRegistered}`,
        `Channels: ${view.wire.channelsRegistered ?? 0}`,
        `Memory backends: ${view.wire.memoryBackendsRegistered ?? 0}`,
        `Providers: ${view.wire.providersRegistered ?? 0}`,
      ];
      for (const plan of view.wire.plans.slice(0, 40)) {
        lines.push(
          `- ${plan.pluginId} capabilities=${plan.capabilityIds.length} tools=${plan.toolNames.length} hooks=${plan.hookEvents.length} channels=${(plan.channelIds || []).length}`,
        );
      }
      return lines.join('\n');
    }

    if (snapshot && 'results' in snapshot && 'loaded' in snapshot) {
      const view = snapshot as ZavorthPluginLoadSnapshot;
      const lines = [
        'Zavorth Plugin Load',
        `Contract: ${view.contractVersion}`,
        `Generated: ${view.generatedAt}`,
        `Total: ${view.summary.total}`,
        `Loaded: ${view.summary.loaded}`,
        `Skipped: ${view.summary.skipped}`,
        `Failed: ${view.summary.failed}`,
        `Blocked: ${view.summary.blocked}`,
        `Capabilities: ${view.summary.capabilities}`,
        `Hooks: ${view.summary.hooks}`,
      ];
      for (const result of view.results.slice(0, 40)) {
        lines.push(
          `- ${result.pluginId} status=${result.status} capabilities=${result.capabilities.length} findings=${result.findings.length}`,
        );
      }
      return lines.join('\n');
    }

    if (snapshot && 'plugins' in snapshot) {
      return this.discovery.formatSnapshotText(snapshot as ZavorthPluginDiscoverySnapshot);
    }

    if (this.bootstrapSnapshot) {
      return this.formatSnapshotText(this.bootstrapSnapshot);
    }
    if (this.loadSnapshot) {
      return this.formatSnapshotText(this.loadSnapshot);
    }
    if (this.discoverySnapshot) {
      return this.discovery.formatSnapshotText(this.discoverySnapshot);
    }
    return this.discovery.formatSnapshotText();
  }

  public async unloadPlugin(pluginId: string): Promise<void> {
    const id = String(pluginId || '').trim();
    if (!id) {
      return;
    }

    const unsubs = this.hookUnsubscribersByPlugin.get(id) || [];
    for (const unsubscribe of unsubs) {
      try {
        unsubscribe();
      } catch {
        /* soft-fail */
      }
      const index = this.hookUnsubscribers.indexOf(unsubscribe);
      if (index >= 0) {
        this.hookUnsubscribers.splice(index, 1);
      }
    }
    this.hookUnsubscribersByPlugin.delete(id);
    this.loader.dispose(id);

    if (this.loadSnapshot) {
      this.loadSnapshot = {
        ...this.loadSnapshot,
        loaded: this.loadSnapshot.loaded.filter((entry) => entry.pluginId !== id),
        results: this.loadSnapshot.results.filter((result) => result.pluginId !== id),
        summary: {
          ...this.loadSnapshot.summary,
          loaded: Math.max(0, this.loadSnapshot.summary.loaded - 1),
        },
      };
    }
  }

  public async reloadPlugin(
    pluginId: string,
    discovered: ZavorthDiscoveredPlugin,
    options: { approved?: boolean; targets?: PluginRuntimeWireTargets } = {},
  ): Promise<{
    load: Awaited<ReturnType<PluginLoadService['loadOne']>>;
    wire: ReturnType<PluginRuntimeService['wire']> | null;
  }> {
    const id = String(pluginId || discovered.pluginId || '').trim();
    await this.unloadPlugin(id);

    const load = await this.loader.loadOne(discovered, {
      approved: options.approved === true || discovered.state?.trust === 'trusted',
    });

    let wire: ReturnType<PluginRuntimeService['wire']> | null = null;
    if (load.status === 'loaded') {
      const loaded = this.loader.getLoadedPlugins().filter((entry) => entry.pluginId === id);
      wire = this.wire(loaded, options.targets || this.lastWireTargets || this.defaultWireTargets);
    }

    if (this.loadSnapshot) {
      const results = this.loadSnapshot.results.filter((result) => result.pluginId !== id);
      results.push(load);
      const loadedPlugins = this.loader.getLoadedPlugins();
      this.loadSnapshot = {
        ...this.loadSnapshot,
        results,
        loaded: loadedPlugins,
        summary: {
          ...this.loadSnapshot.summary,
          total: results.length,
          loaded: results.filter((result) => result.status === 'loaded').length,
          failed: results.filter((result) => result.status === 'failed').length,
          blocked: results.filter((result) => result.status === 'blocked').length,
          skipped: results.filter((result) => result.status === 'skipped').length,
          capabilities: loadedPlugins.reduce((total, entry) => total + entry.capabilities.length, 0),
          hooks: loadedPlugins.reduce((total, entry) => total + entry.hooks.length, 0),
        },
      };
    }

    return { load, wire };
  }

  public dispose(): void {
    for (const unsubscribe of this.hookUnsubscribers.splice(0)) {
      try {
        unsubscribe();
      } catch {
        // ignore
      }
    }
    this.hookUnsubscribersByPlugin.clear();
    this.loader.dispose();
    this.registeredToolNames.clear();
  }

  private resolveToolName(
    pluginId: string,
    capabilityId: string,
    commandName?: string | null,
  ): string {
    const preferred = String(commandName || '').trim();
    if (preferred) {
      const sanitized = preferred
        .toLowerCase()
        .replace(/[^a-z0-9_.:/-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      if (sanitized && !this.registeredToolNames.has(sanitized)) {
        return sanitized;
      }
    }

    const fallback = `plugin.${pluginId}.${capabilityId}`
      .toLowerCase()
      .replace(/[^a-z0-9_.:/-]+/g, '_')
      .replace(/_+/g, '_');
    if (!this.registeredToolNames.has(fallback)) {
      return fallback;
    }

    let index = 2;
    while (this.registeredToolNames.has(`${fallback}_${index}`)) {
      index += 1;
    }
    return `${fallback}_${index}`;
  }

  private toApprovedSet(value?: Set<string> | string[]): Set<string> | undefined {
    if (!value) {
      return undefined;
    }
    if (value instanceof Set) {
      return value;
    }
    return new Set(value.map((item) => String(item || '').trim()).filter(Boolean));
  }
}

/**
 * P1: explicit security metadata for dynamically wired Plugin OS capability tools.
 * Avoids fallback/forbidden defs that block legitimate plugin tools after wire.
 */
function buildPluginCapabilitySecurityDefinition(
  toolName: string,
  description: string,
  capabilityId: string,
): {
  toolName: string;
  surface: 'native-tool';
  capabilities: string[];
  defaultRisk: 'safe' | 'review';
  requiresConfirmation: boolean;
  description: string;
  source: 'explicit';
} {
  const name = String(toolName || '').toLowerCase();
  const cap = String(capabilityId || '').toLowerCase();
  const blob = `${name} ${cap} ${description || ''}`.toLowerCase();
  const highRisk = /(send|create|apply|write|delete|deliver|execute|spawn|mutate|forge\.apply|pr\.ship\.create)/u.test(blob);
  return {
    toolName,
    surface: 'native-tool',
    capabilities: highRisk
      ? ['filesystem', 'network', 'local-observation']
      : ['local-observation', 'filesystem'],
    defaultRisk: highRisk ? 'review' : 'safe',
    requiresConfirmation: highRisk,
    description: description || `Plugin OS capability tool (${capabilityId})`,
    source: 'explicit',
  };
}
