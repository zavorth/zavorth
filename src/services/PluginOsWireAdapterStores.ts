import type {
  ZavorthPluginChannelAdapterBinding,
  ZavorthPluginMemoryBackendBinding,
  ZavorthPluginProviderBinding,
} from '../contracts/core/PluginRuntimeContract.js';

/**
 * Soft host-side stores for Plugin OS channel/memory/provider bindings.
 * Bootstrap passes these as wireTargets so plugin adapters are not dropped.
 * They do not replace core gateways/providers — they capture plugin bindings
 * for discovery, diagnostics, and future dispatch.
 */
export type PluginOsWireAdapterStores = {
  channelAdapters: {
    register(adapter: ZavorthPluginChannelAdapterBinding & { pluginId: string }): void;
  };
  memoryBackends: {
    register(backend: ZavorthPluginMemoryBackendBinding & { pluginId: string }): void;
  };
  providers: {
    register(provider: ZavorthPluginProviderBinding & { pluginId: string }): void;
  };
  snapshot(): {
    channels: Array<ZavorthPluginChannelAdapterBinding & { pluginId: string }>;
    memoryBackends: Array<ZavorthPluginMemoryBackendBinding & { pluginId: string }>;
    providers: Array<ZavorthPluginProviderBinding & { pluginId: string }>;
  };
};

export function createPluginOsWireAdapterStores(): PluginOsWireAdapterStores {
  const channels = new Map<string, ZavorthPluginChannelAdapterBinding & { pluginId: string }>();
  const memory = new Map<string, ZavorthPluginMemoryBackendBinding & { pluginId: string }>();
  const providers = new Map<string, ZavorthPluginProviderBinding & { pluginId: string }>();

  return {
    channelAdapters: {
      register(adapter) {
        const id = String(adapter?.id || adapter?.capabilityId || '').trim();
        if (!id) return;
        channels.set(`${adapter.pluginId}:${id}`, { ...adapter });
      },
    },
    memoryBackends: {
      register(backend) {
        const id = String(backend?.id || backend?.capabilityId || '').trim();
        if (!id) return;
        memory.set(`${backend.pluginId}:${id}`, { ...backend });
      },
    },
    providers: {
      register(provider) {
        const id = String(provider?.id || provider?.name || provider?.capabilityId || '').trim();
        if (!id) return;
        providers.set(`${provider.pluginId}:${id}`, { ...provider });
      },
    },
    snapshot() {
      return {
        channels: Array.from(channels.values()),
        memoryBackends: Array.from(memory.values()),
        providers: Array.from(providers.values()),
      };
    },
  };
}
